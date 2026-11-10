// GENERIERT von npm run build:sim – nicht von Hand ändern. Quelle: src/sim (sha256 fbb4ec3fc5464dd0)

// src/sim/constants.ts
var TILE = 40;
var COLS = 24;
var ROWS = 15;
var WIDTH = 960;
var HEIGHT = 600;
var TICK_RATE = 60;
var DT = 1 / 60;
var START_LIVES = 100;
var MAX_LEVEL = 5;
var LEVEL_DMG = [1, 1.5, 2.25, 3.375, 5.0625];
var LEVEL_RATE = [1, 0.9, 0.81, 0.729, 0.6561];
var MAX_REPLAY_TICKS = 60 * 60 * 120;
var MAX_REPLAY_COMMANDS = 1e4;
var MAX_TOWER_ID = 2147483648;
var CHALLENGE_WAVES = 30;
var VICTORY_BONUS_PER_LIFE = 100;

// src/sim/version.ts
var GAME_VERSION = "0.2.0";

// src/sim/data/towers.ts
var TOWERS = {
  dualo: { id: "dualo", name: "Dualo", emoji: "\u{1F393}", cost: 30, range: 100, rate: 0.35, dmg: 6, color: "#1e88e5" },
  analyst: { id: "analyst", name: "Business Analyst", emoji: "\u{1F4CB}", cost: 70, range: 105, rate: 0.7, dmg: 5, color: "#43a047" },
  dev: { id: "dev", name: "Entwickler", emoji: "\u{1F469}\u200D\u{1F4BB}", cost: 120, range: 150, dps: 45, color: "#d81b60" },
  ppl: { id: "ppl", name: "PPL", emoji: "\u{1F9ED}", cost: 150, range: 140, rate: 1.5, dmg: 40, splash: 65, aura: 120, color: "#f9a825" },
  scrum: { id: "scrum", name: "Scrum Master", emoji: "\u{1F501}", cost: 110, range: 115, rate: 2.4, dmg: 4, push: 70, color: "#8e24aa" }
};
var TOWER_ORDER = ["dualo", "analyst", "dev", "ppl", "scrum"];
var DUALO_ABSENT_CHANCE = 0.08;
var DUALO_ABSENT_TIME = 2;
var SLOW_FACTOR = 0.5;
var PPL_BOOST = 1.25;
var SHOT_SPEED = 520;
var PPL_SHOT_SPEED = 320;

// src/sim/data/enemies.ts
var ENEMIES = {
  req: { id: "req", name: "Anforderung", emoji: "\u{1F4DD}", hp: 30, speed: 60, reward: 6, color: "#fff176", leakDamage: 5 },
  cr: { id: "cr", name: "Change Request", emoji: "\u{1F504}", hp: 16, speed: 115, reward: 4, color: "#a5d6a7", leakDamage: 5 },
  story: { id: "story", name: "User Story", emoji: "\u{1F9E9}", hp: 14, speed: 90, reward: 3, color: "#b3e5fc", leakDamage: 5 },
  obj: { id: "obj", name: "Objective", emoji: "\u{1F3AF}", hp: 110, speed: 38, reward: 12, color: "#ffcc80", leakDamage: 8 },
  feat: { id: "feat", name: "Feature", emoji: "\u{1F4E6}", hp: 70, speed: 55, reward: 15, color: "#f48fb1", leakDamage: 5, split: true },
  creep: { id: "creep", name: "Scope Creep", emoji: "\u{1F41B}", hp: 40, speed: 62, reward: 8, color: "#dce775", leakDamage: 5, grow: 0.05 },
  debt: { id: "debt", name: "Tech Debt", emoji: "\u{1F4B8}", hp: 65, speed: 45, reward: 11, color: "#cfd8dc", leakDamage: 5, jam: 75 },
  boss: {
    id: "boss",
    name: "MEGA-OBJECTIVE \u201EAlles digital bis Q4\u201C",
    emoji: "\u{1F418}",
    hp: 900,
    speed: 28,
    reward: 150,
    color: "#ef9a9a",
    leakDamage: 40,
    boss: true
  }
};
var JAM_FIRST = 1;
var JAM_INTERVAL = 3;
var JAM_OFF_TIME = 2;

// src/sim/data/balance.ts
var BALANCE = {
  hpGrowth: 1.115,
  rewardFactor: 0.25,
  rewardGrowth: 0,
  waveBonusBase: 40,
  waveBonusPerWave: 5,
  waveSizeBase: 8,
  waveSizePerWave: 2,
  bossHpFactor: 2.5,
  startMoney: 300
};
function hpScaleForWave(cfg, wave) {
  let f = 1;
  for (let i = 1; i < wave; i++) f *= cfg.hpGrowth;
  return f;
}
function rewardForWave(cfg, baseReward, wave) {
  return Math.round(baseReward * cfg.rewardFactor * (1 + cfg.rewardGrowth * (Math.max(1, wave) - 1)));
}

// src/sim/data/maps.ts
var MAPS = [
  {
    id: "spaghetti",
    name: "Spaghetti-Prozess",
    hue: 300,
    waypoints: [[-1, 2], [6, 2], [6, 7], [2, 7], [2, 12], [12, 12], [12, 3], [18, 3], [18, 11], [24, 11]]
  },
  {
    id: "waterfall",
    name: "Wasserfall-Modell",
    hue: 190,
    waypoints: [[-1, 2], [21, 2], [21, 7], [2, 7], [2, 12], [24, 12]]
  },
  {
    id: "release-train",
    name: "Release-Train",
    hue: 40,
    waypoints: [[-1, 7], [5, 7], [5, 2], [11, 2], [11, 12], [17, 12], [17, 4], [21, 4], [21, 9], [24, 9]]
  },
  {
    id: "matrix",
    name: "Matrix-Organisation",
    hue: 120,
    waypoints: [[-1, 12], [4, 12], [4, 2], [9, 2], [9, 9], [14, 9], [14, 1], [20, 1], [20, 13], [24, 13]]
  }
];

// src/sim/rng.ts
function createRng(seed) {
  let a = seed >>> 0;
  const next = () => {
    a = a + 1831565813 >>> 0;
    let t = a;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (n) => Math.floor(next() * n),
    state: () => a
  };
}

// src/sim/commands.ts
function toReplayCommand(tick, cmd) {
  switch (cmd.type) {
    case "place":
      return [tick, "place", cmd.tower, cmd.cx, cmd.cy];
    case "upgrade":
      return [tick, "upgrade", cmd.towerId];
    case "sell":
      return [tick, "sell", cmd.towerId];
    case "startWave":
      return [tick, "startWave"];
  }
}
function fromReplayCommand(rc) {
  switch (rc[1]) {
    case "place":
      return { type: "place", tower: rc[2], cx: rc[3], cy: rc[4] };
    case "upgrade":
      return { type: "upgrade", towerId: rc[2] };
    case "sell":
      return { type: "sell", towerId: rc[2] };
    case "startWave":
      return { type: "startWave" };
  }
}

// src/sim/hash.ts
function fnv1a(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

// src/sim/path.ts
function toPixelPath(waypoints) {
  return waypoints.map(([cx, cy]) => ({ x: cx * TILE + TILE / 2, y: cy * TILE + TILE / 2 }));
}
function computePathCells(waypoints) {
  const cells = /* @__PURE__ */ new Set();
  for (let i = 0; i < waypoints.length - 1; i++) {
    const from = waypoints[i];
    const to = waypoints[i + 1];
    let a = from[0];
    let b = from[1];
    const c = to[0];
    const d = to[1];
    while (a !== c || b !== d) {
      cells.add(`${a},${b}`);
      a += Math.sign(c - a);
      b += Math.sign(d - b);
    }
    cells.add(`${c},${d}`);
  }
  return cells;
}
function segmentLength(a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
}
function pathLength(path) {
  let total = 0;
  for (let i = 1; i < path.length; i++) total += segmentLength(path[i - 1], path[i]);
  return total;
}
function dist2(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

// src/sim/game.ts
var Game = class {
  state;
  map;
  path;
  pathLength;
  pathCells;
  rng;
  balance;
  commands = [];
  statsCache = /* @__PURE__ */ new Map();
  statsTowers = null;
  statsCount = 0;
  constructor(opts) {
    const seed = opts.seed >>> 0;
    this.rng = createRng(seed);
    this.balance = opts.balance ?? BALANCE;
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
      mode: opts.mode ?? "challenge",
      money: this.balance.startMoney,
      lives: START_LIVES,
      wave: 0,
      score: 0,
      running: false,
      over: false,
      won: false,
      towers: [],
      enemies: [],
      shots: [],
      queue: [],
      spawnTimer: 0,
      nextId: 1
    };
  }
  // ===================== Kommandos =====================
  apply(cmd) {
    const events = [];
    const reason = this.execute(cmd, events);
    if (reason) events.push({ type: "rejected", command: cmd, reason });
    else this.commands.push(toReplayCommand(this.state.tick, cmd));
    return events;
  }
  execute(cmd, events) {
    const s = this.state;
    if (s.over) return "gameOver";
    switch (cmd.type) {
      case "place": {
        const def = Object.hasOwn(TOWERS, cmd.tower) ? TOWERS[cmd.tower] : void 0;
        if (!def) return "unknownTower";
        const reason = this.canPlace(cmd.tower, cmd.cx, cmd.cy);
        if (reason) return reason;
        s.money -= def.cost;
        const tower = {
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
          beam: false
        };
        s.towers.push(tower);
        events.push({ type: "placed", tower });
        return null;
      }
      case "upgrade": {
        const tower = this.towerById(cmd.towerId);
        if (!tower) return "unknownTower";
        const cost = this.upgradeCost(tower);
        if (cost === null) return "maxLevel";
        if (s.money < cost) return "noMoney";
        s.money -= cost;
        tower.spent += cost;
        tower.level++;
        events.push({ type: "upgraded", tower, cost });
        return null;
      }
      case "sell": {
        const tower = this.towerById(cmd.towerId);
        if (!tower) return "unknownTower";
        const refund = this.sellValue(tower);
        s.money += refund;
        s.towers = s.towers.filter((t) => t !== tower);
        events.push({ type: "sold", tower, refund });
        return null;
      }
      case "startWave":
        if (s.running) return "waveRunning";
        this.startWave(events);
        return null;
    }
  }
  canPlace(type, cx, cy) {
    const s = this.state;
    if (s.over) return "gameOver";
    if (!Object.hasOwn(TOWERS, type)) return "unknownTower";
    if (!Number.isInteger(cx) || !Number.isInteger(cy) || cx < 0 || cy < 0 || cx >= COLS || cy >= ROWS) return "outOfBounds";
    if (this.pathCells.has(`${cx},${cy}`)) return "path";
    if (s.towers.some((t) => t.cx === cx && t.cy === cy)) return "occupied";
    if (s.money < TOWERS[type].cost) return "noMoney";
    return null;
  }
  startWave(events) {
    const s = this.state;
    s.wave++;
    s.running = true;
    const w = s.wave;
    const pip = (w - 1) % 5 === 0;
    const count = this.balance.waveSizeBase + this.balance.waveSizePerWave * w;
    const list = [];
    for (let i = 0; i < count; i++) {
      const r = this.rng.next();
      let t = "req";
      if (pip && w > 1) t = r < 0.35 ? "obj" : r < 0.75 ? "feat" : "req";
      else if (pip) t = r < 0.15 ? "feat" : "req";
      else if (w > 1 && r < 0.25) t = "cr";
      else if (w > 2 && r < 0.37) t = "obj";
      else if (w > 2 && r < 0.49) t = "feat";
      else if (w > 2 && r < 0.62) t = "creep";
      else if (w > 3 && r < 0.72) t = "debt";
      list.push(t);
    }
    const boss = pip && w > 1;
    if (boss) list.push("boss");
    s.queue = list;
    s.spawnTimer = 0;
    events.push({ type: "waveStarted", wave: w, pip, boss });
  }
  // ===================== Tick =====================
  step() {
    const s = this.state;
    if (s.over) return [];
    const events = [];
    if (s.running && s.queue.length) {
      s.spawnTimer -= DT;
      if (s.spawnTimer <= 0) {
        const type = s.queue.shift();
        events.push({ type: "spawned", enemy: this.spawnEnemy(type) });
        s.spawnTimer = Math.max(0.25, 0.9 - s.wave * 0.03);
      }
    }
    for (const e of s.enemies) {
      if (e.hp <= 0) continue;
      const def = ENEMIES[e.type];
      e.slowTime -= DT;
      e.pushCooldown -= DT;
      if (def.grow && e.maxHp < e.baseMaxHp * 2) {
        const g = Math.min(e.maxHp * def.grow * DT, e.baseMaxHp * 2 - e.maxHp);
        e.maxHp += g;
        e.hp += g;
      }
      if (def.jam) {
        e.jamCooldown -= DT;
        if (e.jamCooldown <= 0) {
          e.jamCooldown = JAM_INTERVAL;
          const r2 = def.jam * def.jam;
          const towerIds = [];
          for (const t of s.towers) {
            if (dist2(t, e) <= r2) {
              t.offTime = JAM_OFF_TIME;
              towerIds.push(t.id);
            }
          }
          if (towerIds.length) events.push({ type: "jammed", enemy: e, towerIds, radius: def.jam });
        }
      }
      this.move(e, def.speed * (e.slowTime > 0 ? SLOW_FACTOR : 1) * DT);
      if (e.wi >= this.path.length) {
        e.hp = 0;
        s.lives -= def.leakDamage;
        events.push({ type: "leaked", enemy: e, damage: def.leakDamage });
      }
    }
    if (s.enemies.some((e) => e.hp <= 0)) s.enemies = s.enemies.filter((e) => e.hp > 0);
    if (s.lives <= 0) {
      s.over = true;
      s.running = false;
      s.queue = [];
      events.push({ type: "gameOver", wave: s.wave, score: s.score });
    }
    if (s.running && !s.queue.length && !s.enemies.length) {
      s.running = false;
      const bonus = this.balance.waveBonusBase + this.balance.waveBonusPerWave * s.wave;
      s.money += bonus;
      events.push({ type: "waveCleared", wave: s.wave, bonus });
      if (s.mode === "challenge" && s.wave >= CHALLENGE_WAVES) {
        const victoryBonus = s.lives * VICTORY_BONUS_PER_LIFE;
        s.score += victoryBonus;
        s.over = true;
        s.won = true;
        s.queue = [];
        events.push({ type: "victory", wave: s.wave, score: s.score, bonus: victoryBonus });
        s.tick++;
        return events;
      }
    }
    for (const t of s.towers) {
      t.cooldown -= DT;
      t.beam = false;
      if (t.offTime > 0) {
        t.offTime -= DT;
        t.targetId = null;
        continue;
      }
      if (t.type !== "dev" && t.cooldown > 0) continue;
      const stats = this.towerStats(t);
      const target = this.findTarget(t, stats.range);
      t.targetId = target ? target.id : null;
      if (!target) continue;
      if (t.type === "dev") {
        t.beam = true;
        this.hurt(target, stats.dps * DT, events);
        continue;
      }
      if (t.cooldown <= 0) {
        t.cooldown = stats.rate;
        if (t.type === "dualo" && this.rng.next() < DUALO_ABSENT_CHANCE) {
          t.cooldown = DUALO_ABSENT_TIME;
          events.push({ type: "absent", tower: t });
          continue;
        }
        const shot = {
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
          speed: t.type === "ppl" ? PPL_SHOT_SPEED : SHOT_SPEED
        };
        s.shots.push(shot);
        events.push({ type: "fired", tower: t, shot });
      }
    }
    const byId = s.shots.length ? new Map(s.enemies.map((e) => [e.id, e])) : null;
    const done = /* @__PURE__ */ new Set();
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
        shot.x += dx / d * stepLen;
        shot.y += dy / d * stepLen;
        continue;
      }
      done.add(shot);
      if (shot.towerType === "ppl") {
        const radius = TOWERS.ppl.splash * (1 + 0.1 * (shot.level - 1));
        const r2 = radius * radius;
        const center = { x: shot.tx, y: shot.ty };
        events.push({ type: "splash", x: shot.tx, y: shot.ty, radius });
        for (const e of s.enemies) if (dist2(e, center) < r2) this.hurt(e, shot.dmg, events);
        events.push({ type: "hit", shot, enemyId: null });
      } else if (alive) {
        this.hurt(target, shot.dmg, events);
        if (shot.towerType === "analyst") {
          target.slowTime = 1.5 + 0.3 * shot.level;
          events.push({ type: "slowed", enemy: target });
        }
        if (shot.towerType === "scrum" && target.hp > 0 && target.pushCooldown <= 0) {
          const boss = !!ENEMIES[target.type].boss;
          const push = TOWERS.scrum.push * (1 + 0.2 * (shot.level - 1)) * (boss ? 0.15 : 1);
          this.placeAt(target, target.dist - push);
          target.pushCooldown = boss ? 4 : 1.2;
          events.push({ type: "pushed", enemy: target });
        }
        events.push({ type: "hit", shot, enemyId: target.id });
      }
    }
    if (done.size) s.shots = s.shots.filter((sh) => !done.has(sh));
    if (s.enemies.some((e) => e.hp <= 0)) s.enemies = s.enemies.filter((e) => e.hp > 0);
    s.tick++;
    return events;
  }
  // ===================== Hilfen =====================
  /** Erzeugt einen Gegner am Pfadanfang oder an einer Pfaddistanz (intern und für Tests). */
  spawnEnemy(type, at) {
    const s = this.state;
    const def = ENEMIES[type];
    const hpScale = hpScaleForWave(this.balance, Math.max(1, s.wave)) * (def.boss ? this.balance.bossHpFactor : 1);
    const hp = def.hp * hpScale;
    const start = this.path[0];
    const e = {
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
      jamCooldown: JAM_FIRST
    };
    if (at) this.placeAt(e, at.dist);
    s.enemies.push(e);
    return e;
  }
  towerStats(t) {
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
  computeStats(t) {
    const def = TOWERS[t.type];
    const aura = TOWERS.ppl.aura;
    const boosted = t.type !== "ppl" && this.state.towers.some((o) => o.type === "ppl" && dist2(o, t) <= aura * aura);
    const m = LEVEL_DMG[t.level - 1] * (boosted ? PPL_BOOST : 1);
    return {
      boosted,
      range: def.range * (1 + 0.1 * (t.level - 1)),
      dmg: (def.dmg ?? 0) * m,
      dps: (def.dps ?? 0) * m,
      rate: def.rate ? def.rate * LEVEL_RATE[t.level - 1] : 0
    };
  }
  upgradeCost(t) {
    if (t.level >= MAX_LEVEL) return null;
    return Math.round(TOWERS[t.type].cost * 0.8 * t.level);
  }
  sellValue(t) {
    return Math.round(t.spent * 0.6);
  }
  towerById(id) {
    return this.state.towers.find((t) => t.id === id);
  }
  /** Setzt einen Gegner auf eine Pfaddistanz (Scrum-Rückstoß, Original Zeile 77–79). */
  placeAt(e, distance) {
    const d = Math.max(0, distance);
    let acc = 0;
    for (let i = 1; i < this.path.length; i++) {
      const a = this.path[i - 1];
      const b = this.path[i];
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
  stateHash() {
    const s = this.state;
    return fnv1a(
      JSON.stringify([
        s.tick,
        s.seed,
        s.mapId,
        s.mode,
        s.money,
        s.lives,
        s.wave,
        s.score,
        s.running,
        s.over,
        s.won,
        s.spawnTimer,
        s.nextId,
        s.queue,
        s.towers.map((t) => [t.id, t.type, t.cx, t.cy, t.level, t.cooldown, t.spent, t.offTime, t.targetId, t.beam]),
        s.enemies.map((e) => [e.id, e.type, e.x, e.y, e.wi, e.dist, e.hp, e.maxHp, e.slowTime, e.pushCooldown, e.jamCooldown]),
        s.shots.map((sh) => [sh.id, sh.towerId, sh.x, sh.y, sh.targetId, sh.tx, sh.ty, sh.dmg]),
        this.rng.state()
      ])
    );
  }
  toReplay() {
    const s = this.state;
    return {
      format: 2,
      gameVersion: GAME_VERSION,
      seed: s.seed,
      mapId: s.mapId,
      mode: s.mode,
      commands: this.commands.map((c) => [...c]),
      endTick: s.tick,
      result: { score: s.score, wave: s.wave, lives: s.lives, over: s.over, won: s.won }
    };
  }
  move(e, distance) {
    let sp = distance;
    while (sp > 0 && e.wi < this.path.length) {
      const p = this.path[e.wi];
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
        e.x += dx / d * sp;
        e.y += dy / d * sp;
        e.dist += sp;
        sp = 0;
      }
    }
  }
  /** D-3: nur lebende Gegner; größte Pfaddistanz, bei Gleichstand der zuerst gespawnte. */
  findTarget(t, range) {
    const r2 = range * range;
    let best = null;
    for (const e of this.state.enemies) {
      if (e.hp <= 0) continue;
      if (best && e.dist <= best.dist) continue;
      const dx = e.x - t.x;
      if (dx * dx > r2) continue;
      if (dist2(e, t) <= r2) best = e;
    }
    return best;
  }
  hurt(e, damage, events) {
    if (e.hp <= 0) return;
    e.hp -= damage;
    if (e.hp <= 0) this.kill(e, events);
  }
  kill(e, events) {
    const s = this.state;
    const def = ENEMIES[e.type];
    const reward = rewardForWave(this.balance, def.reward, s.wave);
    s.money += reward;
    s.score += reward * 10;
    events.push({ type: "killed", enemy: e, reward });
    if (def.split) {
      for (const dx of [-8, 8]) {
        const story = this.spawnEnemy("story");
        story.x = e.x + dx;
        story.y = e.y;
        story.wi = e.wi;
        story.dist = e.dist;
      }
      events.push({ type: "split", enemy: e });
    }
  }
};

// src/sim/replay.ts
var isInt = (v) => typeof v === "number" && Number.isSafeInteger(v);
var inRange = (v, min, max) => isInt(v) && v >= min && v <= max;
function fail(reason) {
  throw new Error(`Ung\xFCltiges Replay: ${reason}`);
}
function parseReplay(input, opts = {}) {
  const data = typeof input === "string" ? JSON.parse(input) : input;
  if (!data || typeof data !== "object" || Array.isArray(data)) fail("kein Objekt");
  const r = data;
  if (r.format === 1) fail("Replay-Format 1 (Spielversion 0.1.x) wird nicht mehr unterst\xFCtzt");
  if (r.format !== 2) fail(`format ${String(r.format)} wird nicht unterst\xFCtzt`);
  const version = opts.version ?? GAME_VERSION;
  if (r.gameVersion !== version) fail(`Spielversion ${String(r.gameVersion)} passt nicht zu ${version}`);
  if (!inRange(r.seed, 0, 4294967295)) fail("seed muss uint32 sein");
  if (typeof r.mapId !== "string" || !MAPS.some((m) => m.id === r.mapId)) fail(`unbekannte Karte ${String(r.mapId)}`);
  if (r.mode !== "challenge" && r.mode !== "endless") fail(`unbekannter Modus ${String(r.mode)}`);
  const maxTicks = Math.min(opts.maxTicks ?? MAX_REPLAY_TICKS, MAX_REPLAY_TICKS);
  if (!inRange(r.endTick, 0, maxTicks)) fail(`endTick au\xDFerhalb 0\u2026${maxTicks}`);
  if (!Array.isArray(r.commands)) fail("commands fehlt");
  if (r.commands.length > MAX_REPLAY_COMMANDS) fail(`mehr als ${MAX_REPLAY_COMMANDS} Kommandos`);
  let lastTick = 0;
  for (const [i, c] of r.commands.entries()) {
    if (!Array.isArray(c) || !inRange(c[0], 0, r.endTick)) fail(`Kommando ${i}: Tick fehlt oder au\xDFerhalb`);
    if (c[0] < lastTick) fail(`Kommando ${i}: Ticks nicht aufsteigend`);
    lastTick = c[0];
    const ok = c[1] === "place" && c.length === 5 && typeof c[2] === "string" && Object.hasOwn(TOWERS, c[2]) && inRange(c[3], 0, COLS - 1) && inRange(c[4], 0, ROWS - 1) || (c[1] === "upgrade" || c[1] === "sell") && c.length === 3 && inRange(c[2], 1, MAX_TOWER_ID) || c[1] === "startWave" && c.length === 2;
    if (!ok) fail(`Kommando ${i}: ung\xFCltig`);
  }
  const res = r.result;
  if (!res || typeof res !== "object" || !isInt(res.score) || !isInt(res.wave) || !isInt(res.lives) || typeof res.over !== "boolean" || typeof res.won !== "boolean") {
    fail("result unvollst\xE4ndig");
  }
  return data;
}
function runReplay(r, opts = {}) {
  const game = new Game({ seed: r.seed, mapId: r.mapId, mode: r.mode, balance: opts.balance });
  const cmds = r.commands;
  let i = 0;
  let rejected = false;
  const applyDue = (tick) => {
    while (i < cmds.length && cmds[i][0] === tick) {
      const events = game.apply(fromReplayCommand(cmds[i]));
      if (events.some((e) => e.type === "rejected")) rejected = true;
      i++;
    }
  };
  for (let t = 0; t < r.endTick && game.state.tick === t; t++) {
    applyDue(t);
    game.step();
  }
  applyDue(game.state.tick);
  if (i < cmds.length) rejected = true;
  const s = game.state;
  const matches = !rejected && s.tick === r.endTick && s.score === r.result.score && s.wave === r.result.wave && s.lives === r.result.lives && s.over === r.result.over && s.won === r.result.won;
  return { score: s.score, wave: s.wave, lives: s.lives, over: s.over, won: s.won, tick: s.tick, hash: game.stateHash(), matches };
}
export {
  BALANCE,
  CHALLENGE_WAVES,
  COLS,
  DT,
  ENEMIES,
  GAME_VERSION,
  Game,
  HEIGHT,
  LEVEL_DMG,
  LEVEL_RATE,
  MAPS,
  MAX_LEVEL,
  MAX_REPLAY_COMMANDS,
  MAX_REPLAY_TICKS,
  MAX_TOWER_ID,
  ROWS,
  START_LIVES,
  TICK_RATE,
  TILE,
  TOWERS,
  TOWER_ORDER,
  VICTORY_BONUS_PER_LIFE,
  WIDTH,
  createRng,
  hpScaleForWave,
  parseReplay,
  rewardForWave,
  runReplay
};
