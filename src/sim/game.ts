import { COLS, DT, LEVEL_DMG, LEVEL_RATE, MAX_LEVEL, ROWS, START_LIVES, START_MONEY, TILE } from './constants';
import { toReplayCommand } from './commands';
import { ENEMIES, HP_SCALE_PER_WAVE, JAM_FIRST, JAM_INTERVAL, JAM_OFF_TIME } from './data/enemies';
import { MAPS } from './data/maps';
import {
  DUALO_ABSENT_CHANCE,
  DUALO_ABSENT_TIME,
  PPL_BOOST,
  PPL_SHOT_SPEED,
  SHOT_SPEED,
  SLOW_FACTOR,
  TOWERS,
} from './data/towers';
import { fnv1a } from './hash';
import { computePathCells, dist2, pathLength, segmentLength, toPixelPath } from './path';
import { createRng, type Rng } from './rng';
import type {
  Command,
  Enemy,
  EnemyType,
  GameState,
  MapDef,
  MapId,
  Point,
  RejectReason,
  ReplayCommand,
  ReplayV1,
  Shot,
  SimEvent,
  Tower,
  TowerStats,
  TowerType,
} from './types';
import { GAME_VERSION } from './version';

export interface GameOptions {
  seed: number;
  mapId?: MapId;
}

/**
 * Deterministische Spielsimulation (ADR-0002).
 * Zustand ändert sich nur über apply(command) und step(); ein step() ist genau ein Tick (DT).
 */
export class Game {
  readonly state: GameState;
  readonly map: MapDef;
  readonly path: readonly Point[];
  readonly pathLength: number;
  readonly pathCells: ReadonlySet<string>;
  private readonly rng: Rng;
  private readonly commands: ReplayCommand[] = [];
  private readonly statsCache = new Map<number, { level: number; x: number; y: number; stats: TowerStats }>();
  private statsTowers: Tower[] | null = null;
  private statsCount = 0;

  constructor(opts: GameOptions) {
    const seed = opts.seed >>> 0;
    this.rng = createRng(seed);
    // D-2: der erste Zug bestimmt die Karte – immer, damit die Folge unabhängig von mapId gleich bleibt.
    const index = this.rng.int(MAPS.length);
    const map = opts.mapId ? MAPS.find((m) => m.id === opts.mapId) : MAPS[index];
    if (!map) throw new Error(`Unbekannte Karte: ${String(opts.mapId)}`);
    this.map = map;
    this.path = toPixelPath(map.waypoints);
    this.pathLength = pathLength(this.path);
    this.pathCells = computePathCells(map.waypoints);
    this.state = {
      tick: 0,
      seed,
      mapId: map.id,
      money: START_MONEY,
      lives: START_LIVES,
      wave: 0,
      score: 0,
      running: false,
      over: false,
      towers: [],
      enemies: [],
      shots: [],
      queue: [],
      spawnTimer: 0,
      nextId: 1,
    };
  }

  // ===================== Kommandos =====================

  apply(cmd: Command): SimEvent[] {
    const events: SimEvent[] = [];
    const reason = this.execute(cmd, events);
    if (reason) events.push({ type: 'rejected', command: cmd, reason });
    else this.commands.push(toReplayCommand(this.state.tick, cmd));
    return events;
  }

  private execute(cmd: Command, events: SimEvent[]): RejectReason | null {
    const s = this.state;
    if (s.over) return 'gameOver';
    switch (cmd.type) {
      case 'place': {
        const def = Object.hasOwn(TOWERS, cmd.tower) ? TOWERS[cmd.tower] : undefined;
        if (!def) return 'unknownTower';
        const reason = this.canPlace(cmd.tower, cmd.cx, cmd.cy);
        if (reason) return reason;
        s.money -= def.cost;
        const tower: Tower = {
          id: s.nextId++,
          type: def.id,
          cx: cmd.cx,
          cy: cmd.cy,
          x: cmd.cx * TILE + TILE / 2,
          y: cmd.cy * TILE + TILE / 2,
          level: 1,
          cooldown: 0,
          spent: def.cost,
          offTime: 0,
          targetId: null,
          beam: false,
        };
        s.towers.push(tower);
        events.push({ type: 'placed', tower });
        return null;
      }
      case 'upgrade': {
        const tower = this.towerById(cmd.towerId);
        if (!tower) return 'unknownTower';
        const cost = this.upgradeCost(tower);
        if (cost === null) return 'maxLevel';
        if (s.money < cost) return 'noMoney';
        s.money -= cost;
        tower.spent += cost;
        tower.level++;
        events.push({ type: 'upgraded', tower, cost });
        return null;
      }
      case 'sell': {
        const tower = this.towerById(cmd.towerId);
        if (!tower) return 'unknownTower';
        const refund = this.sellValue(tower);
        s.money += refund;
        s.towers = s.towers.filter((t) => t !== tower);
        events.push({ type: 'sold', tower, refund });
        return null;
      }
      case 'startWave':
        if (s.running) return 'waveRunning';
        this.startWave(events);
        return null;
    }
  }

  canPlace(type: TowerType, cx: number, cy: number): RejectReason | null {
    const s = this.state;
    if (s.over) return 'gameOver';
    if (!Object.hasOwn(TOWERS, type)) return 'unknownTower';
    if (!Number.isInteger(cx) || !Number.isInteger(cy) || cx < 0 || cy < 0 || cx >= COLS || cy >= ROWS) return 'outOfBounds';
    if (this.pathCells.has(`${cx},${cy}`)) return 'path';
    if (s.towers.some((t) => t.cx === cx && t.cy === cy)) return 'occupied';
    if (s.money < TOWERS[type].cost) return 'noMoney';
    return null;
  }

  private startWave(events: SimEvent[]): void {
    const s = this.state;
    s.wave++;
    s.running = true;
    const w = s.wave;
    const pip = (w - 1) % 5 === 0;
    const count = 8 + w * 2;
    const list: EnemyType[] = [];
    for (let i = 0; i < count; i++) {
      const r = this.rng.next();
      let t: EnemyType = 'req';
      if (pip && w > 1) t = r < 0.35 ? 'obj' : r < 0.75 ? 'feat' : 'req';
      else if (pip) t = r < 0.15 ? 'feat' : 'req';
      else if (w > 1 && r < 0.25) t = 'cr';
      else if (w > 2 && r < 0.37) t = 'obj';
      else if (w > 2 && r < 0.49) t = 'feat';
      else if (w > 2 && r < 0.62) t = 'creep';
      else if (w > 3 && r < 0.72) t = 'debt';
      list.push(t);
    }
    const boss = pip && w > 1;
    if (boss) list.push('boss');
    s.queue = list;
    s.spawnTimer = 0;
    events.push({ type: 'waveStarted', wave: w, pip, boss });
  }

  // ===================== Tick =====================

  step(): SimEvent[] {
    const s = this.state;
    if (s.over) return []; // D-5: Zustand nach Game Over eingefroren
    const events: SimEvent[] = [];

    // 1. Spawn
    if (s.running && s.queue.length) {
      s.spawnTimer -= DT;
      if (s.spawnTimer <= 0) {
        const type = s.queue.shift()!;
        events.push({ type: 'spawned', enemy: this.spawnEnemy(type) });
        s.spawnTimer = Math.max(0.25, 0.9 - s.wave * 0.03);
      }
    }

    // 2. Gegner: Wachstum, Störimpuls, Bewegung, Leck
    for (const e of s.enemies) {
      if (e.hp <= 0) continue;
      const def = ENEMIES[e.type];
      e.slowTime -= DT;
      e.pushCooldown -= DT;
      if (def.grow && e.maxHp < e.baseMaxHp * 2) {
        // Gekappt auf genau 2× Start-Max-HP (Spec; Original überschießt im letzten Tick um < 0,1 %).
        const g = Math.min(e.maxHp * def.grow * DT, e.baseMaxHp * 2 - e.maxHp);
        e.maxHp += g;
        e.hp += g;
      }
      if (def.jam) {
        e.jamCooldown -= DT;
        if (e.jamCooldown <= 0) {
          e.jamCooldown = JAM_INTERVAL;
          const r2 = def.jam * def.jam;
          const towerIds: number[] = [];
          for (const t of s.towers) {
            if (dist2(t, e) <= r2) {
              t.offTime = JAM_OFF_TIME;
              towerIds.push(t.id);
            }
          }
          if (towerIds.length) events.push({ type: 'jammed', enemy: e, towerIds, radius: def.jam });
        }
      }
      this.move(e, def.speed * (e.slowTime > 0 ? SLOW_FACTOR : 1) * DT);
      if (e.wi >= this.path.length) {
        e.hp = 0;
        s.lives -= def.leakDamage;
        events.push({ type: 'leaked', enemy: e, damage: def.leakDamage });
      }
    }

    // 3. Besiegte/durchgelaufene entfernen
    s.enemies = s.enemies.filter((e) => e.hp > 0);

    // 4. Game Over
    if (s.lives <= 0) {
      s.over = true;
      s.running = false;
      s.queue = [];
      events.push({ type: 'gameOver', wave: s.wave, score: s.score });
    }

    // 5. Welle beendet
    if (s.running && !s.queue.length && !s.enemies.length) {
      s.running = false;
      const bonus = 50 + s.wave * 10;
      s.money += bonus;
      events.push({ type: 'waveCleared', wave: s.wave, bonus });
    }

    // 6. Türme
    for (const t of s.towers) {
      const stats = this.towerStats(t);
      t.cooldown -= DT;
      t.beam = false;
      t.targetId = null;
      if (t.offTime > 0) {
        t.offTime -= DT;
        continue;
      }
      const target = this.findTarget(t, stats.range);
      if (!target) continue;
      t.targetId = target.id;
      if (t.type === 'dev') {
        t.beam = true;
        this.hurt(target, stats.dps * DT, events);
        continue;
      }
      if (t.cooldown <= 0) {
        t.cooldown = stats.rate;
        if (t.type === 'dualo' && this.rng.next() < DUALO_ABSENT_CHANCE) {
          t.cooldown = DUALO_ABSENT_TIME;
          events.push({ type: 'absent', tower: t });
          continue;
        }
        const shot: Shot = {
          id: s.nextId++,
          towerId: t.id,
          towerType: t.type,
          x: t.x,
          y: t.y,
          targetId: target.id,
          tx: target.x,
          ty: target.y,
          dmg: stats.dmg,
          level: t.level,
          speed: t.type === 'ppl' ? PPL_SHOT_SPEED : SHOT_SPEED,
        };
        s.shots.push(shot);
        events.push({ type: 'fired', tower: t, shot });
      }
    }

    // 7. Projektile
    const byId = new Map(s.enemies.map((e) => [e.id, e] as const));
    const done = new Set<Shot>();
    for (const shot of s.shots) {
      const target = byId.get(shot.targetId);
      const alive = !!target && target.hp > 0;
      if (alive) {
        shot.tx = target.x;
        shot.ty = target.y;
      }
      const dx = shot.tx - shot.x;
      const dy = shot.ty - shot.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      const stepLen = shot.speed * DT;
      if (d > stepLen) {
        shot.x += (dx / d) * stepLen;
        shot.y += (dy / d) * stepLen;
        continue;
      }
      done.add(shot);
      if (shot.towerType === 'ppl') {
        const radius = TOWERS.ppl.splash! * (1 + 0.1 * (shot.level - 1));
        const r2 = radius * radius;
        const center = { x: shot.tx, y: shot.ty };
        events.push({ type: 'splash', x: shot.tx, y: shot.ty, radius });
        // for…of über das lebende Array wie im Original: im selben Splash abgespaltene Stories werden mitgeprüft.
        for (const e of s.enemies) if (dist2(e, center) < r2) this.hurt(e, shot.dmg, events);
        events.push({ type: 'hit', shot, enemyId: null });
      } else if (alive) {
        this.hurt(target, shot.dmg, events);
        if (shot.towerType === 'analyst') {
          target.slowTime = 1.5 + 0.3 * shot.level;
          events.push({ type: 'slowed', enemy: target });
        }
        if (shot.towerType === 'scrum' && target.hp > 0 && target.pushCooldown <= 0) {
          const boss = !!ENEMIES[target.type].boss;
          const push = TOWERS.scrum.push! * (1 + 0.2 * (shot.level - 1)) * (boss ? 0.15 : 1);
          this.placeAt(target, target.dist - push);
          target.pushCooldown = boss ? 4 : 1.2;
          events.push({ type: 'pushed', enemy: target });
        }
        events.push({ type: 'hit', shot, enemyId: target.id });
      }
    }
    if (done.size) s.shots = s.shots.filter((sh) => !done.has(sh));
    s.enemies = s.enemies.filter((e) => e.hp > 0);

    s.tick++;
    return events;
  }

  // ===================== Hilfen =====================

  /** Erzeugt einen Gegner am Pfadanfang oder an einer Pfaddistanz (intern und für Tests). */
  spawnEnemy(type: EnemyType, at?: { dist: number }): Enemy {
    const s = this.state;
    const def = ENEMIES[type];
    const hpScale = 1 + (Math.max(1, s.wave) - 1) * HP_SCALE_PER_WAVE;
    const hp = def.hp * hpScale;
    const start = this.path[0]!;
    const e: Enemy = {
      id: s.nextId++,
      type,
      x: start.x,
      y: start.y,
      wi: 1,
      dist: 0,
      hp,
      maxHp: hp,
      baseMaxHp: hp,
      hpScale,
      slowTime: 0,
      pushCooldown: 0,
      jamCooldown: JAM_FIRST,
    };
    if (at) this.placeAt(e, at.dist);
    s.enemies.push(e);
    return e;
  }

  towerStats(t: Tower): TowerStats {
    // Cache: Aura-Boost hängt nur von der Turmmenge ab (ändert sich nur durch place/sell), Werte von der Stufe.
    const towers = this.state.towers;
    if (this.statsTowers !== towers || this.statsCount !== towers.length) {
      this.statsCache.clear();
      this.statsTowers = towers;
      this.statsCount = towers.length;
    }
    const cached = this.statsCache.get(t.id);
    if (cached && cached.level === t.level && cached.x === t.x && cached.y === t.y) return cached.stats;
    const stats = this.computeStats(t);
    this.statsCache.set(t.id, { level: t.level, x: t.x, y: t.y, stats });
    return stats;
  }

  private computeStats(t: Tower): TowerStats {
    const def = TOWERS[t.type];
    const aura = TOWERS.ppl.aura!;
    const boosted = t.type !== 'ppl' && this.state.towers.some((o) => o.type === 'ppl' && dist2(o, t) <= aura * aura);
    const m = LEVEL_DMG[t.level - 1]! * (boosted ? PPL_BOOST : 1);
    return {
      boosted,
      range: def.range * (1 + 0.1 * (t.level - 1)),
      dmg: (def.dmg ?? 0) * m,
      dps: (def.dps ?? 0) * m,
      rate: def.rate ? def.rate * LEVEL_RATE[t.level - 1]! : 0,
    };
  }

  upgradeCost(t: Tower): number | null {
    if (t.level >= MAX_LEVEL) return null;
    return Math.round(TOWERS[t.type].cost * 0.8 * t.level);
  }

  sellValue(t: Tower): number {
    return Math.round(t.spent * 0.6);
  }

  towerById(id: number): Tower | undefined {
    return this.state.towers.find((t) => t.id === id);
  }

  /** Setzt einen Gegner auf eine Pfaddistanz (Scrum-Rückstoß, Original Zeile 77–79). */
  placeAt(e: Enemy, distance: number): void {
    const d = Math.max(0, distance);
    let acc = 0;
    for (let i = 1; i < this.path.length; i++) {
      const a = this.path[i - 1]!;
      const b = this.path[i]!;
      const len = segmentLength(a, b);
      if (acc + len >= d) {
        const f = (d - acc) / len;
        e.x = a.x + (b.x - a.x) * f;
        e.y = a.y + (b.y - a.y) * f;
        e.wi = i;
        e.dist = d;
        return;
      }
      acc += len;
    }
  }

  stateHash(): string {
    const s = this.state;
    return fnv1a(
      JSON.stringify([
        s.tick, s.seed, s.mapId, s.money, s.lives, s.wave, s.score, s.running, s.over, s.spawnTimer, s.nextId, s.queue,
        s.towers.map((t) => [t.id, t.type, t.cx, t.cy, t.level, t.cooldown, t.spent, t.offTime, t.targetId, t.beam]),
        s.enemies.map((e) => [e.id, e.type, e.x, e.y, e.wi, e.dist, e.hp, e.maxHp, e.slowTime, e.pushCooldown, e.jamCooldown]),
        s.shots.map((sh) => [sh.id, sh.towerId, sh.x, sh.y, sh.targetId, sh.tx, sh.ty, sh.dmg]),
        this.rng.state(),
      ]),
    );
  }

  toReplay(): ReplayV1 {
    const s = this.state;
    return {
      format: 1,
      gameVersion: GAME_VERSION,
      seed: s.seed,
      mapId: s.mapId,
      commands: this.commands.map((c) => [...c] as ReplayCommand),
      endTick: s.tick,
      result: { score: s.score, wave: s.wave, lives: s.lives, over: s.over },
    };
  }

  private move(e: Enemy, distance: number): void {
    let sp = distance;
    while (sp > 0 && e.wi < this.path.length) {
      const p = this.path[e.wi]!;
      const dx = p.x - e.x;
      const dy = p.y - e.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d <= sp) {
        e.x = p.x;
        e.y = p.y;
        e.wi++;
        sp -= d;
        e.dist += d;
      } else {
        e.x += (dx / d) * sp;
        e.y += (dy / d) * sp;
        e.dist += sp;
        sp = 0;
      }
    }
  }

  /** D-3: nur lebende Gegner; größte Pfaddistanz, bei Gleichstand der zuerst gespawnte. */
  private findTarget(t: Tower, range: number): Enemy | null {
    const r2 = range * range;
    let best: Enemy | null = null;
    for (const e of this.state.enemies) {
      if (e.hp <= 0) continue;
      if (dist2(e, t) <= r2 && (!best || e.dist > best.dist)) best = e;
    }
    return best;
  }

  private hurt(e: Enemy, damage: number, events: SimEvent[]): void {
    if (e.hp <= 0) return;
    e.hp -= damage;
    if (e.hp <= 0) this.kill(e, events);
  }

  private kill(e: Enemy, events: SimEvent[]): void {
    const s = this.state;
    const def = ENEMIES[e.type];
    const reward = Math.round(def.reward * Math.sqrt(e.hpScale));
    s.money += reward;
    s.score += reward * 10;
    events.push({ type: 'killed', enemy: e, reward });
    if (def.split) {
      // Original Zeile 173: zwei Stories an der Position des Features, x um ±8 versetzt.
      for (const dx of [-8, 8]) {
        const story = this.spawnEnemy('story');
        story.x = e.x + dx;
        story.y = e.y;
        story.wi = e.wi;
        story.dist = e.dist;
      }
      events.push({ type: 'split', enemy: e });
    }
  }
}
