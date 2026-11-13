import {
  CHALLENGE_STARS,
  CHALLENGE_WAVES,
  COLS,
  COMBO_WINDOW,
  DT,
  LEVEL_DMG,
  LEVEL_RATE,
  MAX_LEVEL,
  ROWS,
  START_LIVES,
  TILE,
  VICTORY_BONUS_PER_LIFE,
} from './constants';
import { toReplayCommand } from './commands';
import { BALANCE, hpScaleForWave, rewardForWave, type BalanceConfig } from './data/balance';
import { levelById } from './data/campaigns';
import { ENEMIES, ENEMY_ORDER, JAM_FIRST, JAM_INTERVAL, JAM_OFF_TIME, PAIR_GAP } from './data/enemies';
import { FREE_MAPS, mapById } from './data/maps';
import { modifiersFor, normalizeLoadout, validateLoadout } from './data/skills';
import {
  BOARD_ABILITY,
  BRANCHES,
  BRANCH_LEVEL,
  DUALO_ABSENT_CHANCE,
  DUALO_ABSENT_TIME,
  PPL_BOOST,
  PPL_SHOT_SPEED,
  RTA_RUNWAY,
  RTE_SYNC,
  RTO_INTEREST_CAP,
  RTO_VALUE,
  SHOT_SPEED,
  SLOW_AREA_TIME,
  SLOW_FACTOR,
  TARGET_MODES,
  TOWER_ORDER,
  TOWERS,
} from './data/towers';
import { fnv1a } from './hash';
import { computePathCells, dist2, pathLength, segmentLength, toPixelPath } from './path';
import { createRng, mixSeed, type Rng } from './rng';
import type {
  Branch,
  BranchDef,
  Command,
  Enemy,
  EnemyType,
  GameMode,
  GameState,
  LevelDef,
  LevelId,
  MapDef,
  MapId,
  Modifiers,
  Point,
  RejectReason,
  ReplayCommand,
  ReplayV3,
  Shot,
  SimEvent,
  SkillLoadout,
  TargetMode,
  Tower,
  TowerStats,
  TowerType,
} from './types';
import { GAME_VERSION } from './version';

export interface GameOptions {
  seed: number;
  mapId?: MapId;
  /** Standard: `challenge` (Spec balancing-challenge); mit `levelId` immer `level`. */
  mode?: GameMode;
  /** Kampagnen-Level (Spec campaigns): bestimmt Karte, Wellen, Startwerte, Rollen. */
  levelId?: LevelId | null;
  /** Skill-Loadout (Spec campaigns); wirkt über `modifiersFor`. */
  loadout?: SkillLoadout;
  /** Nur Tools/Tests (Tuning): abweichendes Balancing. Spiel und Replays nutzen immer `BALANCE`. */
  balance?: Readonly<BalanceConfig>;
}

const pct = (p: number): number => 1 + p / 100;

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
  /** Kampagnen-Level oder null (freies Spiel/Daily). */
  readonly level: LevelDef | null;
  /** Wirkung des Skill-Loadouts. */
  readonly mods: Readonly<Modifiers>;
  /** Verfügbare Rollen (Level-Daten, sonst alle). */
  readonly roles: readonly TowerType[];
  private readonly rng: Rng;
  private readonly balance: Readonly<BalanceConfig>;
  private readonly commands: ReplayCommand[] = [];
  private readonly statsCache = new Map<number, { level: number; x: number; y: number; branch: Branch | null; stats: TowerStats }>();
  private statsTowers: Tower[] | null = null;
  /** RTA-Türme des laufenden Ticks (für den Runway-Faktor). */
  private runways: Tower[] = [];
  private statsCount = 0;
  /** Kommando, das bei Annahme aufgezeichnet wird (Upgrade ohne wirksamen Zweig wird normalisiert). */
  private recordAs: Command | null = null;
  private readonly hpMul: number;
  private readonly speedMul: number;
  private readonly rewardMul: number;

  constructor(opts: GameOptions) {
    const seed = opts.seed >>> 0;
    this.rng = createRng(seed);
    this.balance = opts.balance ?? BALANCE;
    // D-2: der erste Zug bestimmt die Karte – immer, damit die Folge unabhängig von mapId/levelId gleich bleibt.
    const index = this.rng.int(FREE_MAPS.length);
    const level = opts.levelId ? levelById(opts.levelId) : null;
    if (opts.levelId && !level) throw new Error(`Unbekanntes Level: ${String(opts.levelId)}`);
    if (!level && opts.mode === 'level') throw new Error('Modus level braucht eine levelId');
    if (level && opts.mapId && opts.mapId !== level.mapId) throw new Error(`Karte ${opts.mapId} passt nicht zu Level ${level.id}`);
    const mapId = level ? level.mapId : opts.mapId;
    const map = mapId ? mapById(mapId) : FREE_MAPS[index];
    if (!map) throw new Error(`Unbekannte Karte: ${String(mapId)}`);
    const invalid = validateLoadout(opts.loadout ?? {}, Infinity);
    if (invalid) throw new Error(`Ungültiges Skill-Loadout: ${invalid}`);
    const loadout = normalizeLoadout(opts.loadout ?? {});
    this.level = level ?? null;
    this.mods = modifiersFor(loadout);
    this.roles = level ? level.roles : TOWER_ORDER;
    this.hpMul = level?.mods?.hp ?? 1;
    this.speedMul = level?.mods?.speed ?? 1;
    this.rewardMul = (level?.mods?.reward ?? 1) * pct(this.mods.killReward);
    this.map = map;
    this.path = toPixelPath(map.waypoints);
    this.pathLength = pathLength(this.path);
    this.pathCells = computePathCells(map.waypoints);
    const mode: GameMode = level ? 'level' : (opts.mode ?? 'challenge');
    this.state = {
      tick: 0,
      seed,
      mapId: map.id,
      mode,
      levelId: level ? level.id : null,
      loadout,
      waves: level ? level.waves : mode === 'challenge' ? CHALLENGE_WAVES : null,
      money: (level ? level.startMoney : this.balance.startMoney) + this.mods.startMoney,
      lives: (level?.lives ?? START_LIVES) + this.mods.startLives,
      wave: 0,
      score: 0,
      running: false,
      over: false,
      won: false,
      kills: 0,
      leaks: 0,
      combo: 0,
      bestCombo: 0,
      lastKillTick: -COMBO_WINDOW - 1,
      bossesDefeated: [],
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
    this.recordAs = cmd;
    const reason = this.execute(cmd, events);
    if (reason) events.push({ type: 'rejected', command: cmd, reason });
    else this.commands.push(toReplayCommand(this.state.tick, this.recordAs));
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
        const cost = this.towerCost(def.id);
        s.money -= cost;
        const tower: Tower = {
          id: s.nextId++,
          type: def.id,
          cx: cmd.cx,
          cy: cmd.cy,
          x: cmd.cx * TILE + TILE / 2,
          y: cmd.cy * TILE + TILE / 2,
          level: 1,
          cooldown: 0,
          spent: cost,
          offTime: 0,
          targetId: null,
          beam: false,
          syncTime: 0,
          phase: 0,
          targetMode: 'first',
          branch: null,
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
        const branching = tower.level === BRANCH_LEVEL - 1;
        if (branching && cmd.branch !== 'a' && cmd.branch !== 'b') return 'branchRequired';
        if (s.money < cost) return 'noMoney';
        s.money -= cost;
        tower.spent += cost;
        tower.level++;
        if (branching) tower.branch = cmd.branch!;
        else if (cmd.branch !== undefined) this.recordAs = { type: 'upgrade', towerId: cmd.towerId };
        // Zweige (PPL-Aura) wirken auf Nachbarn: Werte-Cache verwerfen.
        this.statsTowers = null;
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
      case 'target': {
        const tower = this.towerById(cmd.towerId);
        if (!tower) return 'unknownTower';
        if (TOWERS[tower.type].support || !TARGET_MODES.includes(cmd.mode)) return 'notTargetable';
        tower.targetMode = cmd.mode;
        events.push({ type: 'targetChanged', tower, mode: cmd.mode });
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
    if (!this.roles.includes(type)) return 'roleLocked';
    if (!Number.isInteger(cx) || !Number.isInteger(cy) || cx < 0 || cy < 0 || cx >= COLS || cy >= ROWS) return 'outOfBounds';
    if (this.pathCells.has(`${cx},${cy}`)) return 'path';
    if (s.towers.some((t) => t.cx === cx && t.cy === cy)) return 'occupied';
    const limit = TOWERS[type].limit;
    if (limit !== undefined && s.towers.filter((t) => t.type === type).length >= limit) return 'limit';
    if (s.money < this.towerCost(type)) return 'noMoney';
    return null;
  }

  /**
   * Zusammensetzung von Welle `n` (ohne Abspaltungen/Minions; eine Abhängigkeit steht für ein Paar).
   * Ändert weder Zustand noch RNG: jede Welle hat ihren eigenen Zufallsstrom aus Seed und Wellennummer.
   */
  peekWave(n: number): EnemyType[] {
    if (!Number.isInteger(n) || n < 1) return [];
    if (this.state.waves !== null && n > this.state.waves) return [];
    return this.composeWave(n);
  }

  private composeWave(w: number): EnemyType[] {
    const rng = createRng(mixSeed(this.state.seed, w));
    if (this.level) return this.composeLevelWave(this.level, w, rng);
    const pip = (w - 1) % 5 === 0;
    const count = this.balance.waveSizeBase + this.balance.waveSizePerWave * w;
    const list: EnemyType[] = [];
    for (let i = 0; i < count; i++) {
      const r = rng.next();
      let t: EnemyType = 'req';
      if (pip && w > 1) t = r < 0.35 ? 'obj' : r < 0.75 ? 'feat' : 'req';
      else if (pip) t = r < 0.15 ? 'feat' : 'req';
      else if (w > 1 && r < 0.25) t = 'cr';
      else if (w > 2 && r < 0.37) t = 'obj';
      else if (w > 2 && r < 0.49) t = 'feat';
      else if (w > 2 && r < 0.62) t = 'creep';
      else if (w > 3 && r < 0.72) t = 'debt';
      // Saison 2: Hotfix ab Welle 3, Meeting-Einladung ab Welle 4 (Spec season-2)
      else if (w > 2 && r < 0.8) t = 'hotfix';
      else if (w > 3 && r < 0.86) t = 'meeting';
      list.push(t);
    }
    if (pip && w > 1) list.push('boss');
    return list;
  }

  private composeLevelWave(level: LevelDef, w: number, rng: Rng): EnemyType[] {
    const band = level.pool.find((b) => w >= b.from && w <= b.to) ?? level.pool[level.pool.length - 1]!;
    const count = Math.floor(band.size[0] + band.size[1] * w);
    let total = 0;
    for (const t of ENEMY_ORDER) total += band.weights[t] ?? 0;
    const list: EnemyType[] = [];
    for (let i = 0; i < count; i++) {
      let r = rng.next() * total;
      let pick: EnemyType = 'req';
      for (const t of ENEMY_ORDER) {
        const weight = band.weights[t] ?? 0;
        if (weight <= 0) continue;
        pick = t;
        if (r < weight) break;
        r -= weight;
      }
      list.push(pick);
    }
    for (const b of level.bossWaves) if (b.wave === w) list.push(b.boss);
    return list;
  }

  private startWave(events: SimEvent[]): void {
    const s = this.state;
    s.wave++;
    s.running = true;
    const w = s.wave;
    const boss = this.level ? this.level.bossWaves.some((b) => b.wave === w) : (w - 1) % 5 === 0 && w > 1;
    const pip = this.level ? boss : (w - 1) % 5 === 0;
    s.queue = this.composeWave(w);
    s.spawnTimer = 0;
    events.push({ type: 'waveStarted', wave: w, pip, boss });
  }

  /** 0 = nicht gewonnen, 1 = gewonnen, 2/3 = Moral ≥ Schwelle (Level-Daten, Challenge: CHALLENGE_STARS). */
  stars(): 0 | 1 | 2 | 3 {
    const s = this.state;
    if (!s.won) return 0;
    const th = this.level ? this.level.stars : s.mode === 'challenge' ? CHALLENGE_STARS : null;
    if (!th) return 1;
    return s.lives >= th.three ? 3 : s.lives >= th.two ? 2 : 1;
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
        for (const enemy of this.spawnUnit(type, 0)) events.push({ type: 'spawned', enemy });
        s.spawnTimer = Math.max(0.25, 0.9 - s.wave * 0.03);
      }
    }

    // 2. Gegner: Wachstum, Störimpuls, Sonderaktionen, Bewegung, Leck
    for (const e of s.enemies) {
      if (e.hp <= 0) continue;
      const def = ENEMIES[e.type];
      e.slowTime -= DT;
      e.pushCooldown -= DT;
      // Budget-Freeze (Vorstand): Gegner steht still, wächst nicht und stört nicht.
      if (e.frozenTime > 0) {
        e.frozenTime -= DT;
        continue;
      }
      if (def.grow && e.maxHp < e.baseMaxHp * 2) {
        // Gekappt auf genau 2× Start-Max-HP (Spec; Original überschießt im letzten Tick um < 0,1 %).
        const g = Math.min(e.maxHp * def.grow * DT, e.baseMaxHp * 2 - e.maxHp);
        e.maxHp += g;
        e.hp += g;
      }
      if (def.jam) {
        e.jamCooldown -= DT;
        if (e.jamCooldown <= 0) {
          e.jamCooldown = def.jamEvery ?? JAM_INTERVAL;
          const r2 = def.jam * def.jam;
          const off = (def.jamTime ?? JAM_OFF_TIME) * pct(this.mods.jamTime);
          const towerIds: number[] = [];
          for (const t of s.towers) {
            if (dist2(t, e) <= r2) {
              t.offTime = off;
              towerIds.push(t.id);
            }
          }
          if (towerIds.length) events.push({ type: 'jammed', enemy: e, towerIds, radius: def.jam });
        }
      }
      this.enemyAction(e, events);
      let speed = def.speed * this.speedMul * (e.slowTime > 0 ? SLOW_FACTOR : 1);
      if (e.actTime > 0) speed = def.stall ? 0 : speed * def.sprint!.factor;
      if (speed > 0) this.move(e, speed * DT);
      if (e.wi >= this.path.length) {
        e.hp = 0;
        const damage = this.mods.leakDamage ? Math.round(def.leakDamage * pct(this.mods.leakDamage)) : def.leakDamage;
        s.lives -= damage;
        s.leaks++;
        events.push({ type: 'leaked', enemy: e, damage });
      }
    }

    // 3. Besiegte/durchgelaufene entfernen
    if (s.enemies.some((e) => e.hp <= 0)) s.enemies = s.enemies.filter((e) => e.hp > 0);

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
      const bonus = this.balance.waveBonusBase + this.balance.waveBonusPerWave * s.wave + this.mods.waveBonus;
      s.money += bonus;
      events.push({ type: 'waveCleared', wave: s.wave, bonus });
      // RTO „Business Value“ (Spec season-2), Zweige und Skills (Spec campaigns)
      for (const t of s.towers) {
        if (t.type !== 'rto') continue;
        const br = this.branchOf(t);
        let amount = RTO_VALUE.base + RTO_VALUE.perLevel * (t.level - 1);
        if (br?.value || this.mods.businessValue) amount = Math.round(amount * (br?.value ?? 1) * pct(this.mods.businessValue));
        if (br?.interest) amount += Math.min(RTO_INTEREST_CAP, Math.floor((s.money * br.interest) / 100));
        s.money += amount;
        events.push({ type: 'businessValue', tower: t, amount });
      }
      // Challenge/Level: Sieg nach der letzten Welle; der Zustand ist danach eingefroren (wie bei Game Over).
      if (s.waves !== null && s.wave >= s.waves) {
        const victoryBonus = s.lives * VICTORY_BONUS_PER_LIFE;
        s.score += victoryBonus;
        s.over = true;
        s.won = true;
        s.queue = [];
        events.push({ type: 'victory', wave: s.wave, score: s.score, bonus: victoryBonus });
        s.tick++;
        return events;
      }
    }

    // 6. Türme
    this.runways = s.towers.filter((t) => t.type === 'rta');
    this.updateStealth(events);
    const drags = s.enemies.filter((e) => e.hp > 0 && ENEMIES[e.type].drag);
    for (const t of s.towers) {
      // PI-Sync (RTE): Abklingzeit läuft schneller ab
      const sync = t.syncTime > 0 ? RTE_SYNC.factor : 1;
      // Vendor Lock-in: Rollen im Umkreis arbeiten langsamer (stärkster Effekt zählt)
      const drag = drags.length ? this.dragFactor(t, drags) : 1;
      if (t.syncTime > 0) t.syncTime -= DT;
      t.cooldown -= drag === 1 ? DT * sync : DT * sync * drag;
      t.beam = false;
      if (t.offTime > 0) {
        t.offTime -= DT;
        t.targetId = null;
        continue;
      }
      if (TOWERS[t.type].support) {
        this.supportAction(t, events);
        continue;
      }
      // Performance: Schuss-Türme suchen nur ein Ziel, wenn sie feuern könnten (verhaltensgleich – ohne Ziel
      // wird nicht gefeuert und nicht gewürfelt). `targetId` bleibt dann der zuletzt gesuchte Wert (nur Anzeige).
      if (t.type !== 'dev' && t.cooldown > 0) continue;
      const stats = this.towerStats(t);
      const target = this.findTarget(t, stats.range);
      t.targetId = target ? target.id : null;
      if (!target) continue;
      if (t.type === 'dev') {
        t.beam = true;
        this.hurt(target, drag === 1 ? stats.dps * DT * sync : stats.dps * DT * sync * drag, events);
        continue;
      }
      if (t.cooldown <= 0) {
        t.cooldown = stats.rate;
        if (t.type === 'dualo' && !this.branchOf(t)?.reliable && this.rng.next() < DUALO_ABSENT_CHANCE) {
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
          branch: t.branch,
        };
        s.shots.push(shot);
        events.push({ type: 'fired', tower: t, shot });
      }
    }

    // 7. Projektile
    const byId = s.shots.length ? new Map(s.enemies.map((e) => [e.id, e] as const)) : null;
    const done = new Set<Shot>();
    for (const shot of s.shots) {
      const target = byId?.get(shot.targetId);
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
      const br = shot.branch ? BRANCHES[shot.towerType][shot.branch] : null;
      if (shot.towerType === 'ppl') {
        const radius = TOWERS.ppl.splash! * (1 + 0.1 * (shot.level - 1)) * (br?.splash ?? 1);
        const r2 = radius * radius;
        const center = { x: shot.tx, y: shot.ty };
        events.push({ type: 'splash', x: shot.tx, y: shot.ty, radius });
        // for…of über das lebende Array wie im Original: im selben Splash abgespaltene Stories werden mitgeprüft.
        for (const e of s.enemies) if (dist2(e, center) < r2) this.hurt(e, shot.dmg, events);
        events.push({ type: 'hit', shot, enemyId: null });
      } else if (alive) {
        this.hurt(target, shot.dmg, events);
        if (shot.towerType === 'analyst') {
          target.slowTime = (1.5 + 0.3 * shot.level) * (br?.slow ?? 1) * pct(this.mods.slowDuration);
          events.push({ type: 'slowed', enemy: target });
        }
        if (shot.towerType === 'scrum' && br?.slowArea) {
          const r2 = br.slowArea * br.slowArea;
          for (const e of s.enemies) {
            if (e.hp <= 0 || dist2(e, target) > r2) continue;
            e.slowTime = Math.max(e.slowTime, SLOW_AREA_TIME * pct(this.mods.slowDuration));
            events.push({ type: 'slowed', enemy: e });
          }
        }
        if (shot.towerType === 'scrum' && target.hp > 0 && target.pushCooldown <= 0) {
          const boss = !!ENEMIES[target.type].boss;
          const push = TOWERS.scrum.push! * (1 + 0.2 * (shot.level - 1)) * (br?.push ?? 1) * (boss ? 0.15 : 1);
          this.placeAt(target, target.dist - push);
          target.pushCooldown = boss ? 4 : 1.2;
          events.push({ type: 'pushed', enemy: target });
        }
        events.push({ type: 'hit', shot, enemyId: target.id });
      }
    }
    if (done.size) s.shots = s.shots.filter((sh) => !done.has(sh));
    if (s.enemies.some((e) => e.hp <= 0)) s.enemies = s.enemies.filter((e) => e.hp > 0);

    s.tick++;
    return events;
  }

  // ===================== Hilfen =====================

  /** Erzeugt einen Gegner am Pfadanfang oder an einer Pfaddistanz (intern und für Tests). */
  spawnEnemy(type: EnemyType, at?: { dist: number }): Enemy {
    const s = this.state;
    const def = ENEMIES[type];
    const hpScale = hpScaleForWave(this.balance, Math.max(1, s.wave)) * (type === 'boss' ? this.balance.bossHpFactor : 1) * this.hpMul;
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
      frozenTime: 0,
      mech: def.stall?.every ?? def.sprint?.every ?? def.heal?.every ?? def.minion?.every ?? def.budgetCut?.every ?? 0,
      actTime: 0,
      partnerId: 0,
      phase: 0,
      hidden: !!def.stealth,
    };
    if (at) this.placeAt(e, at.dist);
    s.enemies.push(e);
    return e;
  }

  /** Spawnt einen Gegner bzw. ein gekoppeltes Paar (Abhängigkeit) an Pfaddistanz `dist`. */
  private spawnUnit(type: EnemyType, dist: number): Enemy[] {
    if (!ENEMIES[type].pair) return [this.spawnEnemy(type, dist > 0 ? { dist } : undefined)];
    const a = this.spawnEnemy(type, { dist: dist + PAIR_GAP });
    const b = this.spawnEnemy(type, dist > 0 ? { dist } : undefined);
    a.partnerId = b.id;
    b.partnerId = a.id;
    return [a, b];
  }

  /** Sonderaktionen der Kampagnen-Gegner (Stehen, Sprint, Heilung, Minions, Budget-Kürzung). */
  private enemyAction(e: Enemy, events: SimEvent[]): void {
    const def = ENEMIES[e.type];
    const timed = def.stall ?? def.sprint;
    if (timed) {
      if (e.actTime > 0) {
        e.actTime -= DT;
        return;
      }
      e.mech -= DT;
      if (e.mech > 0) return;
      e.mech = timed.every;
      e.actTime = timed.time;
      events.push(def.stall ? { type: 'stalled', enemy: e, duration: timed.time } : { type: 'sprinted', enemy: e, duration: timed.time });
      return;
    }
    const every = def.heal?.every ?? def.minion?.every ?? def.budgetCut?.every;
    if (every === undefined) return;
    e.mech -= DT;
    if (e.mech > 0) return;
    e.mech = every;
    const s = this.state;
    if (def.heal) {
      const r2 = def.heal.radius * def.heal.radius;
      const enemyIds: number[] = [];
      let amount = 0;
      for (const o of s.enemies) {
        if (o === e || o.hp <= 0 || o.hp >= o.maxHp || ENEMIES[o.type].boss || dist2(o, e) > r2) continue;
        const h = Math.min(o.maxHp - o.hp, o.maxHp * def.heal.pct);
        o.hp += h;
        amount += h;
        enemyIds.push(o.id);
      }
      if (enemyIds.length) events.push({ type: 'healed', enemy: e, enemyIds, amount, radius: def.heal.radius });
    } else if (def.minion) {
      for (const minion of this.spawnUnit(def.minion.type, e.dist)) events.push({ type: 'spawnedMinion', enemy: e, minion });
    } else if (def.budgetCut) {
      const amount = Math.floor((s.money * def.budgetCut.pct) / 100);
      s.money -= amount;
      events.push({ type: 'budgetCut', enemy: e, amount });
    }
  }

  /** Schatten-IT ist nur in Reichweite eines Business Analyst oder RTA anvisierbar. */
  private updateStealth(events: SimEvent[]): void {
    for (const e of this.state.enemies) {
      if (e.hp <= 0 || !ENEMIES[e.type].stealth) continue;
      let seen = false;
      for (const t of this.state.towers) {
        if (t.type !== 'analyst' && t.type !== 'rta') continue;
        const r = this.towerStats(t).range;
        if (dist2(e, t) <= r * r) {
          seen = true;
          break;
        }
      }
      if (e.hidden && seen) events.push({ type: 'revealed', enemy: e });
      e.hidden = !seen;
    }
  }

  private dragFactor(t: Tower, drags: readonly Enemy[]): number {
    let f = 1;
    for (const e of drags) {
      const d = ENEMIES[e.type].drag!;
      if (d.factor < f && dist2(e, t) <= d.radius * d.radius) f = d.factor;
    }
    return f;
  }

  /** Kosten einer Rolle inkl. Skills. */
  towerCost(type: TowerType): number {
    const p = this.mods.role[type].cost;
    return p ? Math.round(TOWERS[type].cost * pct(p)) : TOWERS[type].cost;
  }

  towerStats(t: Tower): TowerStats {
    // Cache: Aura-Boost hängt nur von der Turmmenge ab (ändert sich durch place/sell/upgrade), Werte von Stufe/Zweig.
    const towers = this.state.towers;
    if (this.statsTowers !== towers || this.statsCount !== towers.length) {
      this.statsCache.clear();
      this.statsTowers = towers;
      this.statsCount = towers.length;
    }
    const cached = this.statsCache.get(t.id);
    if (cached && cached.level === t.level && cached.x === t.x && cached.y === t.y && cached.branch === t.branch) return cached.stats;
    const stats = this.computeStats(t);
    this.statsCache.set(t.id, { level: t.level, x: t.x, y: t.y, branch: t.branch, stats });
    return stats;
  }

  private computeStats(t: Tower): TowerStats {
    const def = TOWERS[t.type];
    const br = this.branchOf(t);
    const rm = this.mods.role[t.type];
    let boost = 1;
    if (t.type !== 'ppl' && !def.support) {
      for (const o of this.state.towers) {
        if (o.type !== 'ppl') continue;
        const ob = this.branchOf(o);
        const aura = TOWERS.ppl.aura! * (ob?.aura ?? 1);
        const b = ob?.boost ?? PPL_BOOST;
        if (b > boost && dist2(o, t) <= aura * aura) boost = b;
      }
    }
    const m = LEVEL_DMG[t.level - 1]! * boost;
    const dmgMul = (br?.damage ?? 1) * pct(rm.damage);
    return {
      boosted: boost > 1,
      range: def.range * (1 + 0.1 * (t.level - 1)) * (br?.range ?? 1) * pct(rm.range),
      dmg: (def.dmg ?? 0) * m * dmgMul,
      dps: (def.dps ?? 0) * m * dmgMul,
      rate: def.rate ? (def.rate * LEVEL_RATE[t.level - 1]! * (br?.rate ?? 1)) / pct(rm.rate) : 0,
    };
  }

  /** Zweig-Daten eines Turms (ab Stufe 3) oder null. */
  branchOf(t: Tower): BranchDef | null {
    return t.branch ? BRANCHES[t.type][t.branch] : null;
  }

  upgradeCost(t: Tower): number | null {
    if (t.level >= MAX_LEVEL) return null;
    return Math.round(this.towerCost(t.type) * 0.8 * t.level * pct(this.mods.upgradeCost));
  }

  sellValue(t: Tower): number {
    return Math.round(t.spent * (0.6 + this.mods.sellRefund / 100));
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
        s.tick, s.seed, s.mapId, s.mode, s.levelId, s.loadout, s.money, s.lives, s.wave, s.score, s.running, s.over, s.won,
        s.kills, s.leaks, s.combo, s.bestCombo, s.lastKillTick, s.bossesDefeated, s.spawnTimer, s.nextId, s.queue,
        s.towers.map((t) => [
          t.id, t.type, t.cx, t.cy, t.level, t.cooldown, t.spent, t.offTime, t.targetId, t.beam, t.syncTime, t.phase, t.targetMode, t.branch,
        ]),
        s.enemies.map((e) => [
          e.id, e.type, e.x, e.y, e.wi, e.dist, e.hp, e.maxHp, e.slowTime, e.pushCooldown, e.jamCooldown, e.frozenTime,
          e.mech, e.actTime, e.partnerId, e.phase, e.hidden,
        ]),
        s.shots.map((sh) => [sh.id, sh.towerId, sh.x, sh.y, sh.targetId, sh.tx, sh.ty, sh.dmg, sh.branch]),
        this.rng.state(),
      ]),
    );
  }

  toReplay(): ReplayV3 {
    const s = this.state;
    return {
      format: 3,
      gameVersion: GAME_VERSION,
      seed: s.seed,
      levelId: s.levelId,
      mapId: s.mapId,
      mode: s.mode,
      loadout: { ...s.loadout },
      commands: this.commands.map((c) => [...c] as ReplayCommand),
      endTick: s.tick,
      result: {
        score: s.score, wave: s.wave, lives: s.lives, over: s.over, won: s.won, kills: s.kills, stars: this.stars(), leaks: s.leaks,
      },
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

  /**
   * D-3: nur lebende, sichtbare Gegner. Zielmodus `first`: größte Pfaddistanz; `last`: kleinste; `strong`: meiste HP
   * (Gleichstand: weiter vorn); `near`: kleinster Abstand. Sonst gewinnt der zuerst gespawnte.
   */
  private findTarget(t: Tower, range: number): Enemy | null {
    const r2 = range * range;
    const mode: TargetMode = t.targetMode;
    let best: Enemy | null = null;
    if (mode === 'first') {
      for (const e of this.state.enemies) {
        if (e.hp <= 0 || e.hidden) continue;
        // Kann das bisherige Ziel nicht ablösen (strikt >, Spawn-Reihenfolge entscheidet bei Gleichstand).
        if (best && e.dist <= best.dist) continue;
        // Exakter Vorfilter: dist2 = dx² + dy² ≥ dx² (gleiche Rechnung wie in dist2).
        const dx = e.x - t.x;
        if (dx * dx > r2) continue;
        if (dist2(e, t) <= r2) best = e;
      }
      return best;
    }
    let bestD2 = 0;
    for (const e of this.state.enemies) {
      if (e.hp <= 0 || e.hidden) continue;
      const dx = e.x - t.x;
      if (dx * dx > r2) continue;
      const d2 = dist2(e, t);
      if (d2 > r2) continue;
      if (best) {
        if (mode === 'last' && !(e.dist < best.dist)) continue;
        if (mode === 'strong' && !(e.hp > best.hp || (e.hp === best.hp && e.dist > best.dist))) continue;
        if (mode === 'near' && !(d2 < bestD2)) continue;
      }
      best = e;
      bestD2 = d2;
    }
    return best;
  }

  private hurt(e: Enemy, damage: number, events: SimEvent[]): void {
    if (e.hp <= 0) return;
    let d = damage * this.damageFactor(e);
    if (e.partnerId) {
      // Abhängigkeit: Schaden wird geteilt, solange der Partner lebt.
      const p = this.state.enemies.find((o) => o.id === e.partnerId && o.hp > 0);
      if (p) {
        d /= 2;
        p.hp -= d;
        if (p.hp <= 0) this.kill(p, events);
      }
    }
    e.hp -= d;
    if (e.hp <= 0) this.kill(e, events);
    else if (ENEMIES[e.type].phases) this.bossPhases(e, events);
  }

  /** Runway, Panzer, Impediment-Stehen und Boss-Skills. */
  private damageFactor(e: Enemy): number {
    const def = ENEMIES[e.type];
    let f = this.runwayFactor(e);
    if (def.armor !== undefined && f <= 1) f *= def.armor;
    if (def.stall && e.actTime > 0) f *= def.stall.dmg;
    if (def.boss && this.mods.bossDamage) f *= pct(this.mods.bossDamage);
    return f;
  }

  /** Hydra: bei Erreichen der HP-Schwellen neue Phase und Minions. */
  private bossPhases(e: Enemy, events: SimEvent[]): void {
    const ph = ENEMIES[e.type].phases!;
    while (e.phase < ph.at.length && e.hp <= e.maxHp * ph.at[e.phase]!) {
      e.phase++;
      events.push({ type: 'bossPhase', enemy: e, phase: e.phase });
      const step = ENEMIES[ph.type].pair ? 2 : 1;
      for (let i = 0; i < ph.count; i += step) {
        for (const minion of this.spawnUnit(ph.type, e.dist)) events.push({ type: 'spawnedMinion', enemy: e, minion });
      }
    }
  }

  /** RTA „Architektur-Runway“: höchster Faktor aller RTA in Reichweite (nicht kumulativ), Tech Debt zusätzlich ×2. */
  private runwayFactor(e: Enemy): number {
    let best = 1;
    for (const t of this.runways) {
      if (t.offTime > 0) continue;
      const r = this.towerStats(t).range;
      if (dist2(e, t) > r * r) continue;
      const f = RTA_RUNWAY.factor + RTA_RUNWAY.perLevel * (t.level - 1) + (this.branchOf(t)?.runway ?? 0);
      if (f > best) best = f;
    }
    if (best > 1 && e.type === 'debt') best *= RTA_RUNWAY.debt;
    return best;
  }

  /** Unterstützungsrollen (Spec season-2): RTE PI-Sync, Vorstand-Fähigkeiten; RTA wirkt passiv, RTO beim Wellenende. */
  private supportAction(t: Tower, events: SimEvent[]): void {
    const s = this.state;
    t.targetId = null;
    if (!s.running || t.cooldown > 0) return;
    const br = this.branchOf(t);
    const ability = (br?.interval ?? 1) * pct(this.mods.abilityCooldown);
    if (t.type === 'rte') {
      t.cooldown = RTE_SYNC.interval * ability;
      const radius = this.towerStats(t).range;
      const r2 = radius * radius;
      const duration = RTE_SYNC.duration + RTE_SYNC.durationPerLevel * (t.level - 1) + (br?.duration ?? 0);
      const towerIds: number[] = [];
      for (const o of s.towers) {
        if (o === t || dist2(o, t) > r2) continue;
        o.syncTime = duration;
        o.offTime = 0;
        towerIds.push(o.id);
      }
      events.push({ type: 'synced', tower: t, towerIds, radius });
    } else if (t.type === 'board') {
      const alive = s.enemies.filter((e) => e.hp > 0);
      if (!alive.length) return;
      t.cooldown = (BOARD_ABILITY.interval - BOARD_ABILITY.perLevel * (t.level - 1)) * ability;
      if (t.phase % 2 === 0) {
        const f = br?.freeze ?? 1;
        for (const e of alive) e.frozenTime = (ENEMIES[e.type].boss ? BOARD_ABILITY.bossFreeze : BOARD_ABILITY.freeze) * f;
        events.push({ type: 'freeze', tower: t, enemyIds: alive.map((e) => e.id) });
      } else {
        // Nicht-Boss mit den meisten HP; Gleichstand: zuerst gespawnt (kleinste ID)
        let victim: Enemy | null = null;
        for (const e of alive) {
          if (ENEMIES[e.type].boss) continue;
          if (!victim || e.hp > victim.hp || (e.hp === victim.hp && e.id < victim.id)) victim = e;
        }
        if (victim) {
          events.push({ type: 'axed', tower: t, enemy: victim });
          victim.hp = 0;
          this.kill(victim, events);
        }
      }
      t.phase++;
    }
  }

  private kill(e: Enemy, events: SimEvent[]): void {
    const s = this.state;
    const def = ENEMIES[e.type];
    const reward = rewardForWave(this.balance, def.reward * this.rewardMul, s.wave);
    s.money += reward;
    s.score += reward * 10;
    s.kills++;
    s.combo = s.tick - s.lastKillTick <= COMBO_WINDOW ? s.combo + 1 : 1;
    s.lastKillTick = s.tick;
    if (s.combo > s.bestCombo) s.bestCombo = s.combo;
    if (def.boss && !s.bossesDefeated.includes(e.type)) s.bossesDefeated.push(e.type);
    events.push({ type: 'killed', enemy: e, reward });
    if (def.split) {
      // Original Zeile 173: zwei Stories an der Position des Features, x um ±8 versetzt.
      for (const dx of [-8, 8]) this.spawnFragment('story', e, dx);
      events.push({ type: 'split', enemy: e });
    } else if (def.splitInto) {
      const { type, count } = def.splitInto;
      for (let i = 0; i < count; i++) this.spawnFragment(type, e, (i - (count - 1) / 2) * 10);
      events.push({ type: 'split', enemy: e });
    }
  }

  private spawnFragment(type: EnemyType, from: Enemy, dx: number): void {
    const f = this.spawnEnemy(type);
    f.x = from.x + dx;
    f.y = from.y;
    f.wi = from.wi;
    f.dist = from.dist;
  }
}
