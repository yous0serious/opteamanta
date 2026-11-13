// GENERIERT von npm run build:sim – nicht von Hand ändern. Quelle: src/sim (sha256 f1c6bc5d23556bf0)

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
var COMBO_WINDOW = 120;
var CHALLENGE_STARS = { two: 60, three: 90 };

// src/sim/version.ts
var GAME_VERSION = "0.4.0";

// src/sim/data/towers.ts
var TOWERS = {
  dualo: { id: "dualo", name: "Dualo", emoji: "\u{1F393}", cost: 30, range: 100, rate: 0.35, dmg: 6, color: "#1e88e5" },
  analyst: { id: "analyst", name: "Business Analyst", emoji: "\u{1F4CB}", cost: 70, range: 105, rate: 0.7, dmg: 5, color: "#43a047" },
  dev: { id: "dev", name: "Entwickler", emoji: "\u{1F469}\u200D\u{1F4BB}", cost: 120, range: 150, dps: 45, color: "#d81b60" },
  ppl: { id: "ppl", name: "PPL", emoji: "\u{1F9ED}", cost: 150, range: 140, rate: 1.5, dmg: 40, splash: 65, aura: 120, color: "#f9a825" },
  scrum: { id: "scrum", name: "Scrum Master", emoji: "\u{1F501}", cost: 110, range: 115, rate: 2.4, dmg: 4, push: 70, color: "#8e24aa" },
  // Saison 2 (Spec season-2): Unterstützungsrollen ohne eigenes Ziel
  rte: { id: "rte", name: "RTE", emoji: "\u{1F682}", cost: 140, range: 130, support: true, color: "#00897b" },
  rta: { id: "rta", name: "RTA", emoji: "\u{1F4D0}", cost: 130, range: 110, support: true, color: "#3949ab" },
  rto: { id: "rto", name: "RTO", emoji: "\u{1F4B0}", cost: 100, range: 0, support: true, color: "#7cb342" },
  board: { id: "board", name: "Vorstand", emoji: "\u{1F454}", cost: 500, range: 0, support: true, limit: 1, color: "#37474f" }
};
var TOWER_ORDER = ["dualo", "analyst", "dev", "ppl", "scrum", "rte", "rta", "rto", "board"];
var RTE_SYNC = { interval: 10, duration: 4, durationPerLevel: 0.5, factor: 1.3 };
var RTA_RUNWAY = { factor: 1.25, perLevel: 0.05, debt: 2 };
var RTO_VALUE = { base: 15, perLevel: 10 };
var BOARD_ABILITY = { interval: 20, perLevel: 1, freeze: 2, bossFreeze: 1 };
var DUALO_ABSENT_CHANCE = 0.08;
var DUALO_ABSENT_TIME = 2;
var SLOW_FACTOR = 0.5;
var PPL_BOOST = 1.25;
var SHOT_SPEED = 520;
var PPL_SHOT_SPEED = 320;
var TARGET_MODES = ["first", "last", "strong", "near"];
var TARGET_MODE_NAMES = {
  first: "Vorderster",
  last: "Hinterster",
  strong: "St\xE4rkster",
  near: "N\xE4chster"
};
var BRANCH_LEVEL = 3;
var SLOW_AREA_TIME = 1.2;
var RTO_INTEREST_CAP = 60;
var BRANCHES = {
  dualo: {
    a: { id: "a", name: "Werkstudent:in", description: "Immer da: f\xE4llt nie aus, +15 % Schaden.", reliable: true, damage: 1.15 },
    b: { id: "b", name: "Hackathon-Held", description: "Abklingzeit \u221230 %, \u221210 % Reichweite.", rate: 0.7, range: 0.9 }
  },
  analyst: {
    a: { id: "a", name: "Requirements Engineer", description: "Verlangsamung h\xE4lt 60 % l\xE4nger.", slow: 1.6 },
    b: { id: "b", name: "Data Analyst", description: "Doppelter Schaden, +10 % Reichweite.", damage: 2.2, range: 1.1 }
  },
  dev: {
    a: { id: "a", name: "Full-Stack", description: "+25 % Reichweite.", range: 1.25 },
    b: { id: "b", name: "10x-Dev", description: "+40 % Schaden pro Sekunde.", damage: 1.4 }
  },
  ppl: {
    a: { id: "a", name: "Portfolio-Stratege", description: "+30 % Splash-Radius, +10 % Schaden.", splash: 1.3, damage: 1.1 },
    b: { id: "b", name: "Product Owner", description: "Aura +25 % Radius, Teamboost \xD71,4 statt \xD71,25.", aura: 1.25, boost: 1.4 }
  },
  scrum: {
    a: { id: "a", name: "Coach", description: "+40 % R\xFCcksto\xDF.", push: 1.4 },
    b: { id: "b", name: "Agile Coach", description: "Treffer verlangsamen alle Gegner im Umkreis von 80 px.", slowArea: 80 }
  },
  rte: {
    a: { id: "a", name: "Taktgeber", description: "PI-Sync 25 % h\xE4ufiger.", interval: 0.75 },
    b: { id: "b", name: "Br\xFCckenbauer", description: "+30 % Reichweite, PI-Sync 1 s l\xE4nger.", range: 1.3, duration: 1 }
  },
  rta: {
    a: { id: "a", name: "Enterprise-Architekt", description: "Runway-Schaden +15 Prozentpunkte.", runway: 0.15 },
    b: { id: "b", name: "Systemarchitekt", description: "+30 % Reichweite (Runway und Entdeckung).", range: 1.3 }
  },
  rto: {
    a: { id: "a", name: "Value Stream", description: "Business Value \xD71,5.", value: 1.5 },
    b: { id: "b", name: "Budget-H\xFCter", description: "4 % Zinsen auf die Kapazit\xE4t je Welle (max. 60 SP).", interest: 4 }
  },
  board: {
    a: { id: "a", name: "Aufsichtsrat", description: "Budget-Freeze h\xE4lt 50 % l\xE4nger.", freeze: 1.5 },
    b: { id: "b", name: "CFO-Fokus", description: "F\xE4higkeiten 20 % h\xE4ufiger.", interval: 0.8 }
  }
};

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
  },
  // Saison 2 (Spec season-2)
  meeting: { id: "meeting", name: "Meeting-Einladung", emoji: "\u{1F4C5}", hp: 35, speed: 70, reward: 7, color: "#90caf9", leakDamage: 5, jam: 60, jamTime: 1.2 },
  hotfix: { id: "hotfix", name: "Hotfix", emoji: "\u{1F525}", hp: 12, speed: 150, reward: 3, color: "#ffab91", leakDamage: 5 },
  // Kampagnen (Spec campaigns): Startwerte aus der Spec-Tabelle, per Bot-Tuning angepasst. Kein Emoji (Monster-Grafik).
  impediment: {
    id: "impediment",
    name: "Impediment",
    emoji: "",
    hp: 90,
    speed: 40,
    reward: 10,
    color: "#bcaaa4",
    leakDamage: 6,
    campaign: "team",
    stall: { every: 4, time: 1.2, dmg: 0.6 }
  },
  spike: {
    id: "spike",
    name: "Spike",
    emoji: "",
    hp: 20,
    speed: 80,
    reward: 4,
    color: "#ffe082",
    leakDamage: 4,
    campaign: "team",
    sprint: { every: 3, time: 0.8, factor: 2.2 }
  },
  dependency: {
    id: "dependency",
    name: "Abh\xE4ngigkeit",
    emoji: "",
    hp: 45,
    speed: 58,
    reward: 7,
    color: "#ce93d8",
    leakDamage: 5,
    campaign: "art",
    pair: true
  },
  enabler: {
    id: "enabler",
    name: "Enabler Story",
    emoji: "",
    hp: 50,
    speed: 52,
    reward: 9,
    color: "#80cbc4",
    leakDamage: 5,
    campaign: "art",
    heal: { radius: 70, pct: 0.04, every: 1 }
  },
  compliance: {
    id: "compliance",
    name: "Compliance-Audit",
    emoji: "",
    hp: 140,
    speed: 36,
    reward: 14,
    color: "#b0bec5",
    leakDamage: 8,
    campaign: "solution",
    armor: 0.5
  },
  "shadow-it": {
    id: "shadow-it",
    name: "Schatten-IT",
    emoji: "",
    hp: 40,
    speed: 75,
    reward: 9,
    color: "#9fa8da",
    leakDamage: 5,
    campaign: "solution",
    stealth: true
  },
  "vendor-lock": {
    id: "vendor-lock",
    name: "Vendor Lock-in",
    emoji: "",
    hp: 80,
    speed: 44,
    reward: 12,
    color: "#ffcc80",
    leakDamage: 6,
    campaign: "solution",
    drag: { radius: 75, factor: 0.6 }
  },
  epic: {
    id: "epic",
    name: "Epic",
    emoji: "",
    hp: 320,
    speed: 30,
    reward: 30,
    color: "#f8bbd0",
    leakDamage: 12,
    campaign: "portfolio",
    splitInto: { type: "feat", count: 3 }
  },
  "b-scope": {
    id: "b-scope",
    name: "Sprint-Scope-Explosion",
    emoji: "",
    hp: 1400,
    speed: 26,
    reward: 160,
    color: "#e6ee9c",
    leakDamage: 40,
    boss: true,
    campaign: "team",
    grow: 0.05,
    minion: { type: "story", every: 5 }
  },
  "b-pi": {
    id: "b-pi",
    name: "Big-Room-Chaos",
    emoji: "",
    hp: 1200,
    speed: 24,
    reward: 180,
    color: "#ffab91",
    leakDamage: 40,
    boss: true,
    campaign: "art",
    jam: 110,
    jamTime: 1.5,
    jamEvery: 6
  },
  "b-hydra": {
    id: "b-hydra",
    name: "Integrations-Hydra",
    emoji: "",
    hp: 1100,
    speed: 24,
    reward: 200,
    color: "#b39ddb",
    leakDamage: 40,
    boss: true,
    campaign: "solution",
    armor: 0.5,
    phases: { at: [0.66, 0.33], type: "dependency", count: 2 }
  },
  "b-lbc": {
    id: "b-lbc",
    name: "Lean Business Case Q4",
    emoji: "",
    hp: 1700,
    speed: 22,
    reward: 250,
    color: "#a5d6a7",
    leakDamage: 40,
    boss: true,
    campaign: "portfolio",
    armor: 0.5,
    budgetCut: { every: 8, pct: 10 }
  }
};
var ENEMY_ORDER = [
  "req",
  "cr",
  "story",
  "obj",
  "feat",
  "creep",
  "debt",
  "boss",
  "meeting",
  "hotfix",
  "impediment",
  "spike",
  "dependency",
  "enabler",
  "compliance",
  "shadow-it",
  "vendor-lock",
  "epic",
  "b-scope",
  "b-pi",
  "b-hydra",
  "b-lbc"
];
var JAM_FIRST = 1;
var JAM_INTERVAL = 3;
var JAM_OFF_TIME = 2;
var PAIR_GAP = 14;

// src/sim/data/balance.ts
var BALANCE = {
  hpGrowth: 1.1325,
  rewardFactor: 0.25,
  rewardGrowth: 0,
  waveBonusBase: 40,
  waveBonusPerWave: 5,
  waveSizeBase: 8,
  waveSizePerWave: 2,
  bossHpFactor: 2.6,
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
    theme: "open-office",
    waypoints: [[-1, 2], [6, 2], [6, 7], [2, 7], [2, 12], [12, 12], [12, 3], [18, 3], [18, 11], [24, 11]]
  },
  {
    id: "waterfall",
    name: "Wasserfall-Modell",
    hue: 190,
    theme: "open-office",
    waypoints: [[-1, 2], [21, 2], [21, 7], [2, 7], [2, 12], [24, 12]]
  },
  {
    id: "release-train",
    name: "Release-Train",
    hue: 40,
    theme: "big-room",
    waypoints: [[-1, 7], [5, 7], [5, 2], [11, 2], [11, 12], [17, 12], [17, 4], [21, 4], [21, 9], [24, 9]]
  },
  {
    id: "matrix",
    name: "Matrix-Organisation",
    hue: 120,
    theme: "server-room",
    waypoints: [[-1, 12], [4, 12], [4, 2], [9, 2], [9, 9], [14, 9], [14, 1], [20, 1], [20, 13], [24, 13]]
  },
  // Kampagne „Team“ – Großraumbüro
  {
    id: "open-plan",
    name: "Gro\xDFraumb\xFCro",
    hue: 30,
    theme: "open-office",
    waypoints: [[-1, 2], [4, 2], [4, 12], [10, 12], [10, 2], [16, 2], [16, 12], [20, 12], [20, 6], [24, 6]]
  },
  {
    id: "kanban-loop",
    name: "Kanban-Schleife",
    hue: 160,
    theme: "open-office",
    waypoints: [[-1, 7], [6, 7], [6, 2], [18, 2], [18, 12], [10, 12], [10, 5], [14, 5], [14, 9], [24, 9]]
  },
  {
    id: "retro-spiral",
    name: "Retro-Spirale",
    hue: 260,
    theme: "open-office",
    waypoints: [[-1, 2], [20, 2], [20, 12], [4, 12], [4, 6], [15, 6], [15, 9], [24, 9]]
  },
  // Kampagne „ART“ – PI-Planning-Halle
  {
    id: "big-room",
    name: "Big Room Planning",
    hue: 15,
    theme: "big-room",
    waypoints: [[-1, 11], [3, 11], [3, 3], [9, 3], [9, 11], [15, 11], [15, 3], [21, 3], [21, 11], [24, 11]]
  },
  {
    id: "program-board",
    name: "Program Board",
    hue: 345,
    theme: "big-room",
    waypoints: [[-1, 1], [11, 1], [11, 5], [2, 5], [2, 9], [20, 9], [20, 13], [24, 13]]
  },
  {
    id: "dependency-web",
    name: "Abh\xE4ngigkeitsnetz",
    hue: 280,
    theme: "big-room",
    waypoints: [[-1, 4], [8, 4], [8, 11], [14, 11], [14, 2], [20, 2], [20, 7], [5, 7], [5, 13], [24, 13]]
  },
  // Kampagne „Large Solution“ – Serverraum
  {
    id: "server-aisles",
    name: "Rack-G\xE4nge",
    hue: 200,
    theme: "server-room",
    waypoints: [[-1, 13], [3, 13], [3, 1], [8, 1], [8, 13], [13, 13], [13, 1], [18, 1], [18, 13], [22, 13], [22, 6], [24, 6]]
  },
  {
    id: "cable-maze",
    name: "Kabelsalat",
    hue: 220,
    theme: "server-room",
    waypoints: [[-1, 6], [4, 6], [4, 1], [10, 1], [10, 10], [2, 10], [2, 13], [16, 13], [16, 4], [21, 4], [21, 9], [24, 9]]
  },
  {
    id: "firewall",
    name: "Firewall",
    hue: 5,
    theme: "server-room",
    waypoints: [[-1, 7], [6, 7], [6, 2], [12, 2], [12, 12], [18, 12], [18, 7], [24, 7]]
  },
  // Kampagne „Portfolio“ – Vorstandsetage
  {
    id: "glass-tower",
    name: "Glasturm",
    hue: 190,
    theme: "boardroom",
    waypoints: [[-1, 13], [5, 13], [5, 10], [2, 10], [2, 6], [8, 6], [8, 2], [16, 2], [16, 8], [22, 8], [22, 12], [24, 12]]
  },
  {
    id: "boardroom-table",
    name: "Vorstandstisch",
    hue: 45,
    theme: "boardroom",
    waypoints: [[-1, 2], [19, 2], [19, 12], [5, 12], [5, 6], [24, 6]]
  },
  {
    id: "stage-gate",
    name: "Stage-Gate",
    hue: 0,
    theme: "boardroom",
    waypoints: [[-1, 10], [4, 10], [4, 4], [8, 4], [8, 10], [12, 10], [12, 4], [16, 4], [16, 10], [20, 10], [20, 4], [24, 4]]
  }
];
var FREE_MAP_COUNT = 4;
var FREE_MAPS = MAPS.slice(0, FREE_MAP_COUNT);
function mapById(id) {
  return MAPS.find((m) => m.id === id);
}
var THEMES = {
  "open-office": { id: "open-office", name: "Gro\xDFraumb\xFCro" },
  "big-room": { id: "big-room", name: "PI-Planning-Halle" },
  "server-room": { id: "server-room", name: "Serverraum" },
  boardroom: { id: "boardroom", name: "Vorstandsetage" }
};

// src/sim/data/campaigns.ts
var ATTACK = ["dualo", "analyst", "dev", "ppl", "scrum"];
var ART_ROLES = [...ATTACK, "rte", "rta", "rto"];
var ALL_ROLES = [...ART_ROLES, "board"];
function band(from, to, base, perWave, weights) {
  return { from, to, size: [base, perWave], weights };
}
var CAMPAIGNS = [
  {
    id: "team",
    name: "Team-Ebene: Das erste PI",
    tagline: "Ein frisches agiles Team, ein Backlog voller \xDCberraschungen.",
    theme: "open-office",
    levels: ["team-1", "team-2", "team-3", "team-4", "team-5", "team-6"],
    boss: "b-scope"
  },
  {
    id: "art",
    name: "ART: Der Release Train f\xE4hrt ein",
    tagline: "Zehn Teams, ein Takt \u2013 und \xFCberall rote F\xE4den auf dem Program Board.",
    theme: "big-room",
    levels: ["art-1", "art-2", "art-3", "art-4", "art-5", "art-6"],
    boss: "b-pi"
  },
  {
    id: "solution",
    name: "Large Solution: Abh\xE4ngigkeitsh\xF6lle",
    tagline: "Mehrere Z\xFCge, ein Produkt \u2013 und Lieferanten, die nicht ans Telefon gehen.",
    theme: "server-room",
    levels: ["solution-1", "solution-2", "solution-3", "solution-4", "solution-5", "solution-6"],
    boss: "b-hydra"
  },
  {
    id: "portfolio",
    name: "Portfolio: Lean Portfolio Management",
    tagline: "Strategie trifft Budget \u2013 im 40. Stock wird \xFCber Epics entschieden.",
    theme: "boardroom",
    levels: ["portfolio-1", "portfolio-2", "portfolio-3", "portfolio-4", "portfolio-5", "portfolio-6"],
    boss: "b-lbc"
  }
];
var LEVELS = [
  // ===================== Team =====================
  {
    id: "team-1",
    campaign: "team",
    index: 1,
    name: "Sprint 1: Das Team formiert sich",
    mapId: "waterfall",
    briefing: "Willkommen im Team! Stell Dualos und Entwickler an den Wasserfall und arbeite die ersten Anforderungen ab.",
    waves: 8,
    startMoney: 300,
    roles: ["dualo", "dev"],
    mods: { hp: 2.4 },
    tutorial: true,
    pool: [band(1, 3, 6, 2, { req: 8, cr: 2 }), band(4, 8, 6, 2, { req: 6, cr: 3, story: 2, impediment: 1 })],
    bossWaves: [],
    stars: { two: 70, three: 95 }
  },
  {
    id: "team-2",
    campaign: "team",
    index: 2,
    name: "Daily Stand-up",
    mapId: "open-plan",
    briefing: "Impediments blockieren den Gang. Der Business Analyst verlangsamt sie, bis das Team sie aus dem Weg r\xE4umt.",
    waves: 10,
    startMoney: 300,
    roles: ["dualo", "dev", "analyst"],
    mods: { hp: 2.6 },
    tutorial: true,
    pool: [band(1, 4, 6, 2, { req: 6, cr: 3, impediment: 2 }), band(5, 10, 6, 2, { req: 5, cr: 3, impediment: 3, spike: 2, story: 1 })],
    bossWaves: [],
    stars: { two: 70, three: 95 }
  },
  {
    id: "team-3",
    campaign: "team",
    index: 3,
    name: "Spikes im Sprint",
    mapId: "spaghetti",
    briefing: "Spikes sprinten pl\xF6tzlich los. Der Scrum Master schiebt sie zur\xFCck in die Timebox.",
    waves: 10,
    startMoney: 320,
    roles: ["dualo", "dev", "analyst", "scrum"],
    mods: { hp: 2.6 },
    pool: [band(1, 4, 6, 2, { req: 5, cr: 3, spike: 3 }), band(5, 10, 6, 2, { req: 4, cr: 2, spike: 4, impediment: 2, obj: 1 })],
    bossWaves: [],
    stars: { two: 70, three: 95 }
  },
  {
    id: "team-4",
    campaign: "team",
    index: 4,
    name: "Sprint Review",
    mapId: "kanban-loop",
    briefing: "Features zerfallen in Stories, Scope Creep w\xE4chst. Die PPL trifft ganze Gruppen und motiviert das Team.",
    waves: 12,
    startMoney: 350,
    roles: ATTACK,
    mods: { hp: 2.7 },
    pool: [
      band(1, 4, 6, 2, { req: 5, cr: 3, spike: 2, feat: 1 }),
      band(5, 12, 6, 2, { req: 3, cr: 2, spike: 2, impediment: 2, feat: 2, creep: 2, obj: 1 })
    ],
    bossWaves: [],
    stars: { two: 70, three: 95 }
  },
  {
    id: "team-5",
    campaign: "team",
    index: 5,
    name: "Retrospektive",
    mapId: "retro-spiral",
    briefing: "Tech Debt legt Arbeitspl\xE4tze lahm, Hotfixes rasen vorbei. Der RTO bringt nach jeder Welle Business Value.",
    waves: 12,
    startMoney: 350,
    roles: [...ATTACK, "rto"],
    mods: { hp: 4.1 },
    pool: [
      band(1, 4, 6, 2, { req: 4, cr: 3, hotfix: 2, impediment: 1 }),
      band(5, 12, 6, 2, { req: 3, cr: 2, hotfix: 2, spike: 2, impediment: 2, debt: 2, feat: 1, creep: 1 })
    ],
    bossWaves: [],
    stars: { two: 70, three: 95 }
  },
  {
    id: "team-6",
    campaign: "team",
    index: 6,
    name: "Boss: Sprint-Scope-Explosion",
    mapId: "waterfall",
    briefing: "Kurz vor dem Sprint-Ende explodiert der Scope. Der Boss w\xE4chst und spuckt st\xE4ndig neue User Stories aus.",
    waves: 12,
    startMoney: 380,
    roles: [...ATTACK, "rto"],
    mods: { hp: 1.45 },
    pool: [
      band(1, 6, 6, 2, { req: 4, cr: 3, spike: 2, impediment: 2, story: 1 }),
      band(7, 12, 6, 2, { req: 3, cr: 2, spike: 3, impediment: 2, creep: 2, feat: 1, hotfix: 1 })
    ],
    bossWaves: [{ wave: 12, boss: "b-scope" }],
    stars: { two: 60, three: 90 }
  },
  // ===================== ART =====================
  {
    id: "art-1",
    campaign: "art",
    index: 1,
    name: "PI Planning, Tag 1",
    mapId: "release-train",
    briefing: "Abh\xE4ngigkeiten kommen immer zu zweit. Treffer am einen schaden beiden \u2013 erledige sie gemeinsam.",
    waves: 12,
    startMoney: 400,
    roles: ART_ROLES,
    mods: { hp: 2.35 },
    pool: [
      band(1, 4, 6, 2, { req: 4, cr: 3, dependency: 2, story: 1 }),
      band(5, 12, 6, 2, { req: 3, cr: 2, dependency: 3, obj: 1, feat: 1, spike: 1, impediment: 1 })
    ],
    bossWaves: [],
    stars: { two: 70, three: 95 }
  },
  {
    id: "art-2",
    campaign: "art",
    index: 2,
    name: "Program Board",
    mapId: "big-room",
    briefing: "Enabler Stories halten andere Tickets am Leben. Schalte sie zuerst aus \u2013 Zielmodus \u201ESt\xE4rkster\u201C hilft.",
    waves: 12,
    startMoney: 400,
    roles: ART_ROLES,
    mods: { hp: 1.9 },
    pool: [
      band(1, 4, 6, 2, { req: 4, cr: 3, enabler: 1, obj: 1 }),
      band(5, 12, 6, 2, { req: 3, cr: 2, enabler: 2, obj: 2, dependency: 2, creep: 1, hotfix: 1 })
    ],
    bossWaves: [],
    stars: { two: 70, three: 95 }
  },
  {
    id: "art-3",
    campaign: "art",
    index: 3,
    name: "ART Sync",
    mapId: "program-board",
    briefing: "Meeting-Einladungen und Tech Debt bremsen den Zug. Der RTE synchronisiert und h\xE4lt alle im Takt.",
    waves: 14,
    startMoney: 420,
    roles: ART_ROLES,
    mods: { hp: 1.85 },
    pool: [
      band(1, 5, 6, 2, { req: 4, cr: 3, meeting: 2, dependency: 1 }),
      band(6, 14, 6, 2, { req: 3, cr: 2, meeting: 2, debt: 2, dependency: 2, enabler: 1, feat: 1, hotfix: 1 })
    ],
    bossWaves: [],
    stars: { two: 70, three: 95 }
  },
  {
    id: "art-4",
    campaign: "art",
    index: 4,
    name: "System Demo",
    mapId: "dependency-web",
    briefing: "Der Weg kreuzt sich zweimal \u2013 gute Pl\xE4tze decken mehrere Abschnitte ab. Die Demo muss laufen!",
    waves: 14,
    startMoney: 420,
    roles: ART_ROLES,
    mods: { hp: 3.15 },
    pool: [
      band(1, 5, 6, 2, { req: 4, cr: 3, dependency: 2, spike: 1 }),
      band(6, 14, 6, 2, { req: 3, cr: 2, dependency: 3, enabler: 2, obj: 1, feat: 1, spike: 1, impediment: 1 })
    ],
    bossWaves: [],
    stars: { two: 70, three: 95 }
  },
  {
    id: "art-5",
    campaign: "art",
    index: 5,
    name: "Inspect & Adapt",
    mapId: "big-room",
    briefing: "Alles etwas schneller als geplant: Tickets laufen 10 % z\xFCgiger. Problem-Solving-Workshop inklusive.",
    waves: 15,
    startMoney: 450,
    roles: ART_ROLES,
    mods: { hp: 1.4, speed: 1.1 },
    pool: [
      band(1, 5, 6, 2, { req: 4, cr: 3, enabler: 1, dependency: 1, hotfix: 1 }),
      band(6, 15, 6, 2, { req: 2, cr: 2, enabler: 2, dependency: 2, obj: 2, creep: 1, debt: 1, meeting: 1 })
    ],
    bossWaves: [],
    stars: { two: 70, three: 95 }
  },
  {
    id: "art-6",
    campaign: "art",
    index: 6,
    name: "Boss: Big-Room-Chaos",
    mapId: "program-board",
    briefing: "Zwei Tage PI Planning, 150 Leute, ein Raum. Das Chaos legt alle 6 s die Arbeitspl\xE4tze im Umkreis lahm.",
    waves: 15,
    startMoney: 450,
    roles: ART_ROLES,
    mods: { hp: 1.8 },
    pool: [
      band(1, 7, 6, 2, { req: 4, cr: 3, dependency: 2, enabler: 1, meeting: 1 }),
      band(8, 15, 6, 2, { req: 3, cr: 2, dependency: 2, enabler: 2, obj: 1, meeting: 2, debt: 1 })
    ],
    bossWaves: [{ wave: 15, boss: "b-pi" }],
    stars: { two: 60, three: 90 }
  },
  // ===================== Large Solution =====================
  {
    id: "solution-1",
    campaign: "solution",
    index: 1,
    name: "Solution Train",
    mapId: "matrix",
    briefing: "Compliance-Audits sind gepanzert. Nur im Architektur-Runway eines RTA wirkt der volle Schaden.",
    waves: 15,
    startMoney: 450,
    roles: ALL_ROLES,
    mods: { hp: 1.55 },
    pool: [
      band(1, 5, 6, 2, { req: 4, cr: 3, compliance: 1, dependency: 1 }),
      band(6, 15, 6, 2, { req: 3, cr: 2, compliance: 2, dependency: 2, obj: 1, enabler: 1, spike: 1 })
    ],
    bossWaves: [],
    stars: { two: 70, three: 95 }
  },
  {
    id: "solution-2",
    campaign: "solution",
    index: 2,
    name: "Schatten-IT",
    mapId: "server-aisles",
    briefing: "Irgendwer betreibt Server unter dem Schreibtisch. Nur Business Analyst oder RTA machen Schatten-IT sichtbar.",
    waves: 15,
    startMoney: 450,
    roles: ALL_ROLES,
    mods: { hp: 2.5 },
    pool: [
      band(1, 5, 6, 2, { req: 4, cr: 3, "shadow-it": 2 }),
      band(6, 15, 6, 2, { req: 3, cr: 2, "shadow-it": 3, compliance: 1, hotfix: 1, dependency: 1, creep: 1 })
    ],
    bossWaves: [],
    stars: { two: 70, three: 95 }
  },
  {
    id: "solution-3",
    campaign: "solution",
    index: 3,
    name: "Lieferanten-Sync",
    mapId: "cable-maze",
    briefing: "Vendor Lock-in macht alle Rollen in der N\xE4he tr\xE4ge. Halte Abstand oder baue mehr Feuerkraft.",
    waves: 16,
    startMoney: 480,
    roles: ALL_ROLES,
    mods: { hp: 2.15 },
    pool: [
      band(1, 5, 6, 2, { req: 4, cr: 3, "vendor-lock": 1, dependency: 1 }),
      band(6, 16, 6, 2, { req: 3, cr: 2, "vendor-lock": 2, compliance: 1, "shadow-it": 1, dependency: 2, enabler: 1 })
    ],
    bossWaves: [],
    stars: { two: 70, three: 95 }
  },
  {
    id: "solution-4",
    campaign: "solution",
    index: 4,
    name: "Compliance-Gate",
    mapId: "firewall",
    briefing: "Ein kurzer Weg durch die Firewall \u2013 und alle wollen gleichzeitig durch. Jede Rolle z\xE4hlt.",
    waves: 16,
    startMoney: 500,
    roles: ALL_ROLES,
    mods: { hp: 1 },
    pool: [
      band(1, 5, 6, 2, { req: 4, cr: 3, compliance: 1, "shadow-it": 1 }),
      band(6, 16, 6, 2, { req: 3, cr: 2, compliance: 2, "shadow-it": 2, "vendor-lock": 1, debt: 1, obj: 1 })
    ],
    bossWaves: [],
    stars: { two: 70, three: 95 }
  },
  {
    id: "solution-5",
    campaign: "solution",
    index: 5,
    name: "Pre-PI Planning",
    mapId: "server-aisles",
    briefing: "Alle Z\xFCge stimmen sich ab: robustere Tickets, daf\xFCr 15 % mehr Belohnung.",
    waves: 16,
    startMoney: 500,
    roles: ALL_ROLES,
    mods: { hp: 2.2, reward: 1.15 },
    pool: [
      band(1, 5, 6, 2, { req: 4, cr: 3, dependency: 1, "vendor-lock": 1, enabler: 1 }),
      band(6, 16, 6, 2, { req: 3, cr: 2, dependency: 2, "vendor-lock": 1, compliance: 1, "shadow-it": 1, enabler: 1, feat: 1 })
    ],
    bossWaves: [],
    stars: { two: 70, three: 95 }
  },
  {
    id: "solution-6",
    campaign: "solution",
    index: 6,
    name: "Boss: Integrations-Hydra",
    mapId: "cable-maze",
    briefing: "Schlag ihr eine Schnittstelle ab, wachsen zwei neue Abh\xE4ngigkeiten nach. Gepanzert \u2013 RTA nicht vergessen!",
    waves: 18,
    startMoney: 520,
    roles: ALL_ROLES,
    mods: { hp: 1.8 },
    pool: [
      band(1, 6, 6, 2, { req: 4, cr: 3, dependency: 2, compliance: 1 }),
      band(7, 18, 6, 2, { req: 3, cr: 2, dependency: 2, compliance: 1, "shadow-it": 1, "vendor-lock": 1, enabler: 1 })
    ],
    bossWaves: [{ wave: 18, boss: "b-hydra" }],
    stars: { two: 60, three: 90 }
  },
  // ===================== Portfolio =====================
  {
    id: "portfolio-1",
    campaign: "portfolio",
    index: 1,
    name: "Strategische Themen",
    mapId: "glass-tower",
    briefing: "Epics sind riesig und zerfallen in drei Features \u2013 die wiederum in Stories. Splash-Schaden lohnt sich.",
    waves: 16,
    startMoney: 500,
    roles: ALL_ROLES,
    mods: { hp: 1.6 },
    pool: [
      band(1, 5, 6, 2, { req: 4, cr: 3, feat: 1, epic: 1 }),
      band(6, 16, 6, 2, { req: 3, cr: 2, epic: 1, feat: 1, obj: 1, dependency: 1, enabler: 1, hotfix: 1 })
    ],
    bossWaves: [],
    stars: { two: 70, three: 95 }
  },
  {
    id: "portfolio-2",
    campaign: "portfolio",
    index: 2,
    name: "Portfolio-Kanban",
    mapId: "boardroom-table",
    briefing: "Funnel, Reviewing, Analyzing \u2013 rund um den Vorstandstisch staut sich alles. WSJF entscheidet.",
    waves: 18,
    startMoney: 520,
    roles: ALL_ROLES,
    mods: { hp: 2.25 },
    pool: [
      band(1, 6, 6, 2, { req: 4, cr: 3, epic: 1, spike: 1, impediment: 1 }),
      band(7, 18, 6, 2, { req: 3, cr: 2, epic: 1, compliance: 1, "vendor-lock": 1, spike: 1, impediment: 1, creep: 1 })
    ],
    bossWaves: [],
    stars: { two: 70, three: 95 }
  },
  {
    id: "portfolio-3",
    campaign: "portfolio",
    index: 3,
    name: "Lean Budgets",
    mapId: "stage-gate",
    briefing: "Stage-Gate trifft Lean Budgets: sechs Tore, wenig Kapazit\xE4t. Jeder SP will gut investiert sein.",
    waves: 18,
    startMoney: 450,
    roles: ALL_ROLES,
    mods: { hp: 1.4 },
    pool: [
      band(1, 6, 6, 2, { req: 4, cr: 3, "shadow-it": 1, dependency: 1 }),
      band(7, 18, 6, 2, { req: 3, cr: 2, epic: 1, "shadow-it": 1, dependency: 1, enabler: 1, meeting: 1, debt: 1 })
    ],
    bossWaves: [],
    stars: { two: 70, three: 95 }
  },
  {
    id: "portfolio-4",
    campaign: "portfolio",
    index: 4,
    name: "Guardrails",
    mapId: "glass-tower",
    briefing: "Die Leitplanken sind eng und Compliance pr\xFCft jedes Stockwerk. Panzer knackt nur der Runway.",
    waves: 18,
    startMoney: 520,
    roles: ALL_ROLES,
    mods: { hp: 1.3 },
    pool: [
      band(1, 6, 6, 2, { req: 4, cr: 3, compliance: 1, epic: 1 }),
      band(7, 18, 6, 2, { req: 3, cr: 2, compliance: 2, epic: 1, "vendor-lock": 1, "shadow-it": 1, enabler: 1 })
    ],
    bossWaves: [],
    stars: { two: 70, three: 95 }
  },
  {
    id: "portfolio-5",
    campaign: "portfolio",
    index: 5,
    name: "Value Streams",
    mapId: "boardroom-table",
    briefing: "Alle Wertstr\xF6me flie\xDFen durch den Vorstand. Alles, was du kennst, kommt jetzt zusammen.",
    waves: 20,
    startMoney: 550,
    roles: ALL_ROLES,
    mods: { hp: 2.15 },
    pool: [
      band(1, 6, 6, 2, { req: 4, cr: 3, dependency: 1, enabler: 1, spike: 1 }),
      band(7, 20, 6, 2, {
        req: 2,
        cr: 2,
        epic: 1,
        compliance: 1,
        "shadow-it": 1,
        "vendor-lock": 1,
        dependency: 1,
        enabler: 1,
        impediment: 1,
        spike: 1
      })
    ],
    bossWaves: [],
    stars: { two: 70, three: 95 }
  },
  {
    id: "portfolio-6",
    campaign: "portfolio",
    index: 6,
    name: "Boss: Lean Business Case Q4",
    mapId: "stage-gate",
    briefing: "Der Business Case f\xFCr Q4 rollt an \u2013 gepanzert und mit Budget-K\xFCrzungen alle 8 s. Halte die Kapazit\xE4t zusammen!",
    waves: 20,
    startMoney: 550,
    roles: ALL_ROLES,
    mods: { hp: 1.22 },
    pool: [
      band(1, 7, 6, 2, { req: 4, cr: 3, epic: 1, dependency: 1, compliance: 1 }),
      band(8, 20, 6, 2, { req: 3, cr: 2, epic: 1, compliance: 1, "shadow-it": 1, "vendor-lock": 1, enabler: 1, dependency: 1 })
    ],
    bossWaves: [{ wave: 20, boss: "b-lbc" }],
    stars: { two: 60, three: 90 }
  }
];
var LEVEL_BY_ID = new Map(LEVELS.map((l) => [l.id, l]));
function levelById(id) {
  return LEVEL_BY_ID.get(id);
}
function campaignById(id) {
  return CAMPAIGNS.find((c) => c.id === id);
}
function levelsOfCampaign(id) {
  return LEVELS.filter((l) => l.campaign === id);
}
function nextLevel(id) {
  const l = LEVEL_BY_ID.get(id);
  if (!l) return null;
  return LEVELS.find((x) => x.campaign === l.campaign && x.index === l.index + 1) ?? null;
}

// src/sim/data/skills.ts
var ATTACKERS = ["dualo", "analyst", "dev", "ppl", "scrum"];
var SUPPORTERS = ["rte", "rta", "rto", "board"];
var ALL_ROLES2 = [...ATTACKERS, ...SUPPORTERS];
var SKILL_BRANCHES = [
  { id: "team", name: "Team & Technik", description: "Mehr Schlagkraft f\xFCr die angreifenden Rollen." },
  { id: "process", name: "Prozess & Flow", description: "Kapazit\xE4t, Belohnungen und g\xFCnstigere Upgrades." },
  { id: "leadership", name: "F\xFChrung & Kultur", description: "Moral, F\xE4higkeiten und Unterst\xFCtzungsrollen." }
];
var SKILLS = [
  // ----- Team & Technik -----
  {
    id: "team-pair",
    branch: "team",
    tier: 1,
    col: 0,
    name: "Pair Programming",
    icon: "skill-pair",
    maxRank: 3,
    requires: [],
    description: "Zwei K\xF6pfe, ein Bug weniger: Entwickler +5 % Schaden je Rang.",
    effects: [{ stat: "damage", roles: ["dev"], perRank: 5 }]
  },
  {
    id: "team-dual",
    branch: "team",
    tier: 1,
    col: 1,
    name: "Duales Studium",
    icon: "skill-dual",
    maxRank: 3,
    requires: [],
    description: "Dualos kosten 5 % weniger und machen 5 % mehr Schaden je Rang.",
    effects: [{ stat: "cost", roles: ["dualo"], perRank: -5 }, { stat: "damage", roles: ["dualo"], perRank: 5 }]
  },
  {
    id: "team-tdd",
    branch: "team",
    tier: 2,
    col: 0,
    name: "Test-Driven Development",
    icon: "skill-tdd",
    maxRank: 3,
    requires: ["team-pair"],
    description: "Erst der Test, dann der Treffer: Entwickler +4 % Reichweite je Rang.",
    effects: [{ stat: "range", roles: ["dev"], perRank: 4 }]
  },
  {
    id: "team-swarm",
    branch: "team",
    tier: 2,
    col: 1,
    name: "Swarming",
    icon: "skill-swarm",
    maxRank: 3,
    requires: ["team-dual"],
    description: "Alle st\xFCrzen sich auf das Ticket: angreifende Rollen feuern 3 % schneller je Rang.",
    effects: [{ stat: "rate", roles: ATTACKERS, perRank: 3 }]
  },
  {
    id: "team-dod",
    branch: "team",
    tier: 3,
    col: 0,
    name: "Definition of Done",
    icon: "skill-dod",
    maxRank: 3,
    requires: ["team-tdd"],
    description: "Fertig hei\xDFt fertig: +6 % Schaden gegen Bosse je Rang.",
    effects: [{ stat: "bossDamage", perRank: 6 }]
  },
  {
    id: "team-cop",
    branch: "team",
    tier: 3,
    col: 1,
    name: "Community of Practice",
    icon: "skill-cop",
    maxRank: 3,
    requires: ["team-swarm"],
    description: "Business Analyst und Scrum Master lernen voneinander: +8 % Schaden je Rang.",
    effects: [{ stat: "damage", roles: ["analyst", "scrum"], perRank: 8 }]
  },
  {
    id: "team-mob",
    branch: "team",
    tier: 4,
    col: 0,
    name: "Mob Programming",
    icon: "skill-mob",
    maxRank: 3,
    requires: ["team-dod"],
    description: "Alle an einem Bildschirm: PPL +5 % Schaden und +3 % Reichweite je Rang.",
    effects: [{ stat: "damage", roles: ["ppl"], perRank: 5 }, { stat: "range", roles: ["ppl"], perRank: 3 }]
  },
  {
    id: "team-tshape",
    branch: "team",
    tier: 4,
    col: 1,
    name: "T-Shaped Skills",
    icon: "skill-tshape",
    maxRank: 3,
    requires: ["team-cop"],
    description: "Breit aufgestellt: angreifende Rollen +2 % Reichweite je Rang.",
    effects: [{ stat: "range", roles: ATTACKERS, perRank: 2 }]
  },
  {
    id: "team-cap",
    branch: "team",
    tier: 5,
    col: 0,
    name: "Hochleistungsteam",
    icon: "skill-team-cap",
    maxRank: 1,
    capstone: true,
    requires: ["team-mob", "team-tshape"],
    description: "Kapstein: alle angreifenden Rollen +10 % Schaden.",
    effects: [{ stat: "damage", roles: ATTACKERS, perRank: 10 }]
  },
  // ----- Prozess & Flow -----
  {
    id: "proc-wsjf",
    branch: "process",
    tier: 1,
    col: 0,
    name: "WSJF",
    icon: "skill-wsjf",
    maxRank: 3,
    requires: [],
    description: "Weighted Shortest Job First: +4 % Abschuss-Belohnung je Rang.",
    effects: [{ stat: "killReward", perRank: 4 }]
  },
  {
    id: "proc-kanban",
    branch: "process",
    tier: 1,
    col: 1,
    name: "Kanban-Board",
    icon: "skill-kanban",
    maxRank: 3,
    requires: [],
    description: "Sichtbare Arbeit: +5 SP Wellenbonus je Rang.",
    effects: [{ stat: "waveBonus", perRank: 5 }]
  },
  {
    id: "proc-lbc",
    branch: "process",
    tier: 2,
    col: 0,
    name: "Lean Business Case",
    icon: "skill-lbc",
    maxRank: 3,
    requires: ["proc-wsjf"],
    description: "Gut begr\xFCndet, fr\xFCh finanziert: +25 SP Startkapazit\xE4t je Rang.",
    effects: [{ stat: "startMoney", perRank: 25 }]
  },
  {
    id: "proc-ci",
    branch: "process",
    tier: 2,
    col: 1,
    name: "Continuous Integration",
    icon: "skill-ci",
    maxRank: 3,
    requires: ["proc-kanban"],
    description: "Kleine Schritte, oft integriert: Upgrades 4 % g\xFCnstiger je Rang.",
    effects: [{ stat: "upgradeCost", perRank: -4 }]
  },
  {
    id: "proc-refine",
    branch: "process",
    tier: 3,
    col: 0,
    name: "Backlog Refinement",
    icon: "skill-refine",
    maxRank: 3,
    requires: ["proc-lbc"],
    description: "Weniger Verschwendung: Verkaufswert +5 Prozentpunkte je Rang.",
    effects: [{ stat: "sellRefund", perRank: 5 }]
  },
  {
    id: "proc-flow",
    branch: "process",
    tier: 3,
    col: 1,
    name: "Flow-Metriken",
    icon: "skill-flow",
    maxRank: 3,
    requires: ["proc-ci"],
    description: "Was man misst, wird besser: RTO-Ertrag +15 % je Rang.",
    effects: [{ stat: "businessValue", perRank: 15 }]
  },
  {
    id: "proc-devops",
    branch: "process",
    tier: 4,
    col: 0,
    name: "DevOps",
    icon: "skill-devops",
    maxRank: 3,
    requires: ["proc-refine"],
    description: "You build it, you run it: alle Rollen 3 % g\xFCnstiger je Rang.",
    effects: [{ stat: "cost", roles: ALL_ROLES2, perRank: -3 }]
  },
  {
    id: "proc-rod",
    branch: "process",
    tier: 4,
    col: 1,
    name: "Release on Demand",
    icon: "skill-rod",
    maxRank: 3,
    requires: ["proc-flow"],
    description: "Ausliefern, wenn es Wert stiftet: +3 % Abschuss-Belohnung und +3 SP Wellenbonus je Rang.",
    effects: [{ stat: "killReward", perRank: 3 }, { stat: "waveBonus", perRank: 3 }]
  },
  {
    id: "proc-cap",
    branch: "process",
    tier: 5,
    col: 0,
    name: "Portfolio-Kanban",
    icon: "skill-proc-cap",
    maxRank: 1,
    capstone: true,
    requires: ["proc-devops", "proc-rod"],
    description: "Kapstein: +100 SP Startkapazit\xE4t und +10 SP Wellenbonus.",
    effects: [{ stat: "startMoney", perRank: 100 }, { stat: "waveBonus", perRank: 10 }]
  },
  // ----- Führung & Kultur -----
  {
    id: "lead-servant",
    branch: "leadership",
    tier: 1,
    col: 0,
    name: "Servant Leadership",
    icon: "skill-servant",
    maxRank: 3,
    requires: [],
    description: "Das Team zuerst: +5 Moral zu Spielbeginn je Rang.",
    effects: [{ stat: "startLives", perRank: 5 }]
  },
  {
    id: "lead-ia",
    branch: "leadership",
    tier: 1,
    col: 1,
    name: "Inspect & Adapt",
    icon: "skill-ia",
    maxRank: 3,
    requires: [],
    description: "Aus Fehlern lernen: Lecks kosten 6 % weniger Moral je Rang.",
    effects: [{ stat: "leakDamage", perRank: -6 }]
  },
  {
    id: "lead-pi",
    branch: "leadership",
    tier: 2,
    col: 0,
    name: "PI Planning",
    icon: "skill-pi",
    maxRank: 3,
    requires: ["lead-servant"],
    description: "Alle in einem Raum: RTE und Vorstand nutzen ihre F\xE4higkeiten 6 % h\xE4ufiger je Rang.",
    effects: [{ stat: "abilityCooldown", perRank: -6 }]
  },
  {
    id: "lead-sync",
    branch: "leadership",
    tier: 2,
    col: 1,
    name: "ART Sync",
    icon: "skill-sync",
    maxRank: 3,
    requires: ["lead-ia"],
    description: "Blocker fr\xFCh kl\xE4ren: St\xF6rungen durch Gegner 10 % k\xFCrzer je Rang.",
    effects: [{ stat: "jamTime", perRank: -10 }]
  },
  {
    id: "lead-runway",
    branch: "leadership",
    tier: 3,
    col: 0,
    name: "Architectural Runway",
    icon: "skill-runway",
    maxRank: 3,
    requires: ["lead-pi"],
    description: "Vorausschauend bauen: RTA +6 % Reichweite je Rang.",
    effects: [{ stat: "range", roles: ["rta"], perRank: 6 }]
  },
  {
    id: "lead-coach",
    branch: "leadership",
    tier: 3,
    col: 1,
    name: "SAFe Program Consultant",
    icon: "skill-coach",
    maxRank: 3,
    requires: ["lead-sync"],
    description: "Coaching wirkt: Verlangsamung 10 % l\xE4nger, Scrum Master +5 % Reichweite je Rang.",
    effects: [{ stat: "slowDuration", perRank: 10 }, { stat: "range", roles: ["scrum"], perRank: 5 }]
  },
  {
    id: "lead-gemba",
    branch: "leadership",
    tier: 4,
    col: 0,
    name: "Go See (Gemba)",
    icon: "skill-gemba",
    maxRank: 3,
    requires: ["lead-runway"],
    description: "Hingehen, wo die Arbeit passiert: Unterst\xFCtzungsrollen 6 % g\xFCnstiger je Rang.",
    effects: [{ stat: "cost", roles: SUPPORTERS, perRank: -6 }]
  },
  {
    id: "lead-vision",
    branch: "leadership",
    tier: 4,
    col: 1,
    name: "Vision & Roadmap",
    icon: "skill-vision",
    maxRank: 3,
    requires: ["lead-coach"],
    description: "Alle wissen, wohin: +5 % Schaden gegen Bosse und +3 Moral je Rang.",
    effects: [{ stat: "bossDamage", perRank: 5 }, { stat: "startLives", perRank: 3 }]
  },
  {
    id: "lead-cap",
    branch: "leadership",
    tier: 5,
    col: 0,
    name: "Lean-Agile Leadership",
    icon: "skill-lead-cap",
    maxRank: 1,
    capstone: true,
    requires: ["lead-gemba", "lead-vision"],
    description: "Kapstein: F\xE4higkeiten 15 % h\xE4ufiger, Lecks kosten 15 % weniger Moral, +10 Moral.",
    effects: [{ stat: "abilityCooldown", perRank: -15 }, { stat: "leakDamage", perRank: -15 }, { stat: "startLives", perRank: 10 }]
  }
];
var BY_ID = new Map(SKILLS.map((s) => [s.id, s]));
function skillById(id) {
  return BY_ID.get(id);
}
function emptyModifiers() {
  const role = {};
  for (const r of ALL_ROLES2) role[r] = { cost: 0, damage: 0, range: 0, rate: 0 };
  return {
    startMoney: 0,
    startLives: 0,
    waveBonus: 0,
    killReward: 0,
    sellRefund: 0,
    upgradeCost: 0,
    bossDamage: 0,
    slowDuration: 0,
    jamTime: 0,
    abilityCooldown: 0,
    leakDamage: 0,
    businessValue: 0,
    role
  };
}
function modifiersFor(loadout) {
  const m = emptyModifiers();
  for (const s of SKILLS) {
    const raw = loadout[s.id];
    const rank = typeof raw === "number" && Number.isInteger(raw) ? Math.max(0, Math.min(s.maxRank, raw)) : 0;
    if (!rank) continue;
    for (const e of s.effects) {
      if ("roles" in e) for (const r of e.roles) m.role[r][e.stat] += e.perRank * rank;
      else m[e.stat] += e.perRank * rank;
    }
  }
  return m;
}
function loadoutPoints(loadout) {
  let n = 0;
  for (const v of Object.values(loadout)) if (typeof v === "number") n += v;
  return n;
}
function normalizeLoadout(loadout) {
  const out = {};
  for (const s of SKILLS) {
    const v = loadout[s.id];
    if (typeof v === "number" && v > 0) out[s.id] = v;
  }
  return out;
}
function sameLoadout(a, b) {
  return SKILLS.every((s) => (a[s.id] ?? 0) === (b[s.id] ?? 0));
}
function validateLoadout(loadout, points) {
  if (!loadout || typeof loadout !== "object" || Array.isArray(loadout)) return "invalid";
  const l = loadout;
  let total = 0;
  for (const [id, rank] of Object.entries(l)) {
    const def = BY_ID.get(id);
    if (!def) return `unknown:${id}`;
    if (typeof rank !== "number" || !Number.isInteger(rank) || rank < 0 || rank > def.maxRank) return `rank:${id}`;
    total += rank;
  }
  for (const [id, rank] of Object.entries(l)) {
    if (!rank) continue;
    for (const req of BY_ID.get(id).requires) {
      const r = l[req];
      if (typeof r !== "number" || r < 1) return `requires:${id}`;
    }
  }
  if (total > points) return "points";
  return null;
}

// src/sim/data/progression.ts
var MAX_ACCOUNT_LEVEL = 50;
var XP = { kill: 1, wave: 5, star: 40, firstClear: 100, win: 50 };
function xpForRun(result, opts) {
  const waves = Math.max(0, opts.won ? result.wave : result.wave - 1);
  return Math.max(0, result.kills) * XP.kill + waves * XP.wave + Math.max(0, Math.min(3, result.stars)) * XP.star + (opts.firstClear ? XP.firstClear : 0) + (opts.won ? XP.win : 0);
}
function xpForLevel(level) {
  const l = Math.max(0, Math.floor(level));
  return 100 * l + 25 * l * (l - 1);
}
function levelForXp(xp) {
  const total = Math.max(0, Math.floor(xp));
  let level = 1;
  while (level < MAX_ACCOUNT_LEVEL && total >= xpForLevel(level)) level++;
  const base = xpForLevel(level - 1);
  if (level >= MAX_ACCOUNT_LEVEL) return { level, into: total - base, need: 0 };
  return { level, into: total - base, need: xpForLevel(level) - base };
}
function skillPointsForLevel(level) {
  return Math.max(1, Math.min(MAX_ACCOUNT_LEVEL, Math.floor(level)));
}
function emptyStats() {
  return {
    runs: 0,
    wins: 0,
    kills: 0,
    dailyRuns: 0,
    challengeWins: 0,
    endlessBestWave: 0,
    bestCombo: 0,
    flawlessWins: 0,
    bossesDefeated: [],
    levelStars: {},
    maxSkillPoints: 0,
    accountLevel: 1
  };
}
function addRunToStats(stats, run) {
  const levelStars = { ...stats.levelStars };
  if (run.levelId && run.won) levelStars[run.levelId] = Math.max(levelStars[run.levelId] ?? 0, run.stars);
  const bosses = [...stats.bossesDefeated];
  for (const b of run.bossesDefeated) if (!bosses.includes(b)) bosses.push(b);
  return {
    ...stats,
    runs: stats.runs + 1,
    wins: stats.wins + (run.won ? 1 : 0),
    kills: stats.kills + run.kills,
    dailyRuns: stats.dailyRuns + (run.daily ? 1 : 0),
    challengeWins: stats.challengeWins + (run.mode === "challenge" && run.won ? 1 : 0),
    endlessBestWave: run.mode === "endless" ? Math.max(stats.endlessBestWave, run.wave) : stats.endlessBestWave,
    bestCombo: Math.max(stats.bestCombo, run.bestCombo),
    flawlessWins: stats.flawlessWins + (run.won && run.leaks === 0 ? 1 : 0),
    bossesDefeated: bosses,
    levelStars,
    maxSkillPoints: Math.max(stats.maxSkillPoints, run.skillPoints)
  };
}
var CAMPAIGN_BOSSES = ["b-scope", "b-pi", "b-hydra", "b-lbc"];
var levelsOf = (campaign) => LEVELS.filter((l) => l.campaign === campaign).map((l) => l.id);
var starsIn = (s, ids, min) => ids.filter((id) => (s.levelStars[id] ?? 0) >= min).length;
var count = (n, of) => [Math.min(n, of), of];
var ACHIEVEMENTS = [
  { id: "first-pi", name: "Erstes PI", description: "Schlie\xDFe das erste Level der Team-Kampagne ab.", icon: "ach-first-pi", progress: (s) => count(starsIn(s, ["team-1"], 1), 1) },
  { id: "team-done", name: "Team of Teams", description: "Schlie\xDFe alle Level der Team-Kampagne ab.", icon: "ach-team", progress: (s) => count(starsIn(s, levelsOf("team"), 1), 6) },
  { id: "art-done", name: "Der Zug rollt", description: "Schlie\xDFe alle Level der ART-Kampagne ab.", icon: "ach-art", progress: (s) => count(starsIn(s, levelsOf("art"), 1), 6) },
  { id: "solution-done", name: "Abh\xE4ngigkeiten gez\xE4hmt", description: "Schlie\xDFe alle Level der Large-Solution-Kampagne ab.", icon: "ach-solution", progress: (s) => count(starsIn(s, levelsOf("solution"), 1), 6) },
  { id: "portfolio-done", name: "Lean Portfolio", description: "Schlie\xDFe alle Level der Portfolio-Kampagne ab.", icon: "ach-portfolio", progress: (s) => count(starsIn(s, levelsOf("portfolio"), 1), 6) },
  { id: "three-team", name: "Musterteam", description: "3 Sterne in allen Team-Leveln.", icon: "ach-three-team", progress: (s) => count(starsIn(s, levelsOf("team"), 3), 6) },
  { id: "three-portfolio", name: "3 Sterne Portfolio", description: "3 Sterne in allen Portfolio-Leveln.", icon: "ach-three-portfolio", progress: (s) => count(starsIn(s, levelsOf("portfolio"), 3), 6) },
  { id: "all-stars", name: "SAFe-Vollausbau", description: "3 Sterne in allen 24 Leveln.", icon: "ach-all-stars", progress: (s) => count(starsIn(s, LEVELS.map((l) => l.id), 3), LEVELS.length) },
  { id: "flawless", name: "Kein Leck", description: "Gewinne einen Lauf, ohne dass ein Ticket durchrutscht.", icon: "ach-flawless", progress: (s) => count(s.flawlessWins, 1) },
  { id: "combo-25", name: "Combo 25", description: "Erledige 25 Tickets in Folge (je h\xF6chstens 2 s Abstand).", icon: "ach-combo-25", progress: (s) => count(s.bestCombo, 25) },
  { id: "combo-50", name: "Flow-Zustand", description: "Erledige 50 Tickets in Folge.", icon: "ach-combo-50", progress: (s) => count(s.bestCombo, 50) },
  { id: "kills-1000", name: "Backlog-Bezwinger", description: "Erledige insgesamt 1.000 Tickets.", icon: "ach-kills-1000", progress: (s) => count(s.kills, 1e3) },
  { id: "kills-10000", name: "Durchsatz-Legende", description: "Erledige insgesamt 10.000 Tickets.", icon: "ach-kills-10000", progress: (s) => count(s.kills, 1e4) },
  { id: "boss-first", name: "Boss besiegt", description: "Besiege einen Kampagnen-Boss.", icon: "ach-boss-first", progress: (s) => count(s.bossesDefeated.filter((b) => CAMPAIGN_BOSSES.includes(b)).length, 1) },
  { id: "all-bosses", name: "Alle Bosse", description: "Besiege alle vier Kampagnen-Bosse.", icon: "ach-all-bosses", progress: (s) => count(s.bossesDefeated.filter((b) => CAMPAIGN_BOSSES.includes(b)).length, 4) },
  { id: "daily", name: "Daily Stand-up", description: "Spiele eine Daily Challenge.", icon: "ach-daily", progress: (s) => count(s.dailyRuns, 1) },
  { id: "daily-10", name: "Routine", description: "Spiele 10 Daily Challenges.", icon: "ach-daily-10", progress: (s) => count(s.dailyRuns, 10) },
  { id: "challenge", name: "Release erreicht", description: "Gewinne eine Challenge (30 Wellen).", icon: "ach-challenge", progress: (s) => count(s.challengeWins, 1) },
  { id: "endless-40", name: "Dauerbrenner", description: "Erreiche Welle 40 im Endlos-Modus.", icon: "ach-endless-40", progress: (s) => count(s.endlessBestWave, 40) },
  { id: "skills", name: "Lernende Organisation", description: "Spiele einen Lauf mit mindestens 10 Skillpunkten.", icon: "ach-skills", progress: (s) => count(s.maxSkillPoints, 10) },
  { id: "level-25", name: "SPC", description: "Erreiche Account-Level 25.", icon: "ach-level-25", progress: (s) => count(s.accountLevel, 25) }
];
function achievementProgress(stats) {
  return ACHIEVEMENTS.map((a) => {
    const progress = a.progress(stats);
    return { id: a.id, unlocked: progress[0] >= progress[1], progress };
  });
}
function achievementsFor(stats) {
  return achievementProgress(stats).filter((a) => a.unlocked).map((a) => a.id);
}

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
    state: () => a,
    clone: () => createRng(a)
  };
}
function mixSeed(a, b) {
  let h = Math.imul(a >>> 0 ^ 2654435769, 2246822507) ^ Math.imul((b >>> 0) + 2135587861, 3266489909);
  h ^= h >>> 16;
  h = Math.imul(h, 2246822507);
  h ^= h >>> 13;
  h = Math.imul(h, 3266489909);
  h ^= h >>> 16;
  return h >>> 0;
}

// src/sim/commands.ts
function toReplayCommand(tick, cmd) {
  switch (cmd.type) {
    case "place":
      return [tick, "place", cmd.tower, cmd.cx, cmd.cy];
    case "upgrade":
      return cmd.branch ? [tick, "upgrade", cmd.towerId, cmd.branch] : [tick, "upgrade", cmd.towerId];
    case "sell":
      return [tick, "sell", cmd.towerId];
    case "target":
      return [tick, "target", cmd.towerId, cmd.mode];
    case "startWave":
      return [tick, "startWave"];
  }
}
function fromReplayCommand(rc) {
  switch (rc[1]) {
    case "place":
      return { type: "place", tower: rc[2], cx: rc[3], cy: rc[4] };
    case "upgrade":
      return rc.length === 4 ? { type: "upgrade", towerId: rc[2], branch: rc[3] } : { type: "upgrade", towerId: rc[2] };
    case "sell":
      return { type: "sell", towerId: rc[2] };
    case "target":
      return { type: "target", towerId: rc[2], mode: rc[3] };
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
var pct = (p) => 1 + p / 100;
var Game = class {
  state;
  map;
  path;
  pathLength;
  pathCells;
  /** Kampagnen-Level oder null (freies Spiel/Daily). */
  level;
  /** Wirkung des Skill-Loadouts. */
  mods;
  /** Verfügbare Rollen (Level-Daten, sonst alle). */
  roles;
  rng;
  balance;
  commands = [];
  statsCache = /* @__PURE__ */ new Map();
  statsTowers = null;
  /** RTA-Türme des laufenden Ticks (für den Runway-Faktor). */
  runways = [];
  statsCount = 0;
  /** Kommando, das bei Annahme aufgezeichnet wird (Upgrade ohne wirksamen Zweig wird normalisiert). */
  recordAs = null;
  hpMul;
  speedMul;
  rewardMul;
  constructor(opts) {
    const seed = opts.seed >>> 0;
    this.rng = createRng(seed);
    this.balance = opts.balance ?? BALANCE;
    const index = this.rng.int(FREE_MAPS.length);
    const level = opts.levelId ? levelById(opts.levelId) : null;
    if (opts.levelId && !level) throw new Error(`Unbekanntes Level: ${String(opts.levelId)}`);
    if (!level && opts.mode === "level") throw new Error("Modus level braucht eine levelId");
    if (level && opts.mapId && opts.mapId !== level.mapId) throw new Error(`Karte ${opts.mapId} passt nicht zu Level ${level.id}`);
    const mapId = level ? level.mapId : opts.mapId;
    const map = mapId ? mapById(mapId) : FREE_MAPS[index];
    if (!map) throw new Error(`Unbekannte Karte: ${String(mapId)}`);
    const invalid = validateLoadout(opts.loadout ?? {}, Infinity);
    if (invalid) throw new Error(`Ung\xFCltiges Skill-Loadout: ${invalid}`);
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
    const mode = level ? "level" : opts.mode ?? "challenge";
    this.state = {
      tick: 0,
      seed,
      mapId: map.id,
      mode,
      levelId: level ? level.id : null,
      loadout,
      waves: level ? level.waves : mode === "challenge" ? CHALLENGE_WAVES : null,
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
      nextId: 1
    };
  }
  // ===================== Kommandos =====================
  apply(cmd) {
    const events = [];
    this.recordAs = cmd;
    const reason = this.execute(cmd, events);
    if (reason) events.push({ type: "rejected", command: cmd, reason });
    else this.commands.push(toReplayCommand(this.state.tick, this.recordAs));
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
        const cost = this.towerCost(def.id);
        s.money -= cost;
        const tower = {
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
          targetMode: "first",
          branch: null
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
        const branching = tower.level === BRANCH_LEVEL - 1;
        if (branching && cmd.branch !== "a" && cmd.branch !== "b") return "branchRequired";
        if (s.money < cost) return "noMoney";
        s.money -= cost;
        tower.spent += cost;
        tower.level++;
        if (branching) tower.branch = cmd.branch;
        else if (cmd.branch !== void 0) this.recordAs = { type: "upgrade", towerId: cmd.towerId };
        this.statsTowers = null;
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
      case "target": {
        const tower = this.towerById(cmd.towerId);
        if (!tower) return "unknownTower";
        if (TOWERS[tower.type].support || !TARGET_MODES.includes(cmd.mode)) return "notTargetable";
        tower.targetMode = cmd.mode;
        events.push({ type: "targetChanged", tower, mode: cmd.mode });
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
    if (!this.roles.includes(type)) return "roleLocked";
    if (!Number.isInteger(cx) || !Number.isInteger(cy) || cx < 0 || cy < 0 || cx >= COLS || cy >= ROWS) return "outOfBounds";
    if (this.pathCells.has(`${cx},${cy}`)) return "path";
    if (s.towers.some((t) => t.cx === cx && t.cy === cy)) return "occupied";
    const limit = TOWERS[type].limit;
    if (limit !== void 0 && s.towers.filter((t) => t.type === type).length >= limit) return "limit";
    if (s.money < this.towerCost(type)) return "noMoney";
    return null;
  }
  /**
   * Zusammensetzung von Welle `n` (ohne Abspaltungen/Minions; eine Abhängigkeit steht für ein Paar).
   * Ändert weder Zustand noch RNG: jede Welle hat ihren eigenen Zufallsstrom aus Seed und Wellennummer.
   */
  peekWave(n) {
    if (!Number.isInteger(n) || n < 1) return [];
    if (this.state.waves !== null && n > this.state.waves) return [];
    return this.composeWave(n);
  }
  composeWave(w) {
    const rng = createRng(mixSeed(this.state.seed, w));
    if (this.level) return this.composeLevelWave(this.level, w, rng);
    const pip = (w - 1) % 5 === 0;
    const count2 = this.balance.waveSizeBase + this.balance.waveSizePerWave * w;
    const list = [];
    for (let i = 0; i < count2; i++) {
      const r = rng.next();
      let t = "req";
      if (pip && w > 1) t = r < 0.35 ? "obj" : r < 0.75 ? "feat" : "req";
      else if (pip) t = r < 0.15 ? "feat" : "req";
      else if (w > 1 && r < 0.25) t = "cr";
      else if (w > 2 && r < 0.37) t = "obj";
      else if (w > 2 && r < 0.49) t = "feat";
      else if (w > 2 && r < 0.62) t = "creep";
      else if (w > 3 && r < 0.72) t = "debt";
      else if (w > 2 && r < 0.8) t = "hotfix";
      else if (w > 3 && r < 0.86) t = "meeting";
      list.push(t);
    }
    if (pip && w > 1) list.push("boss");
    return list;
  }
  composeLevelWave(level, w, rng) {
    const band2 = level.pool.find((b) => w >= b.from && w <= b.to) ?? level.pool[level.pool.length - 1];
    const count2 = Math.floor(band2.size[0] + band2.size[1] * w);
    let total = 0;
    for (const t of ENEMY_ORDER) total += band2.weights[t] ?? 0;
    const list = [];
    for (let i = 0; i < count2; i++) {
      let r = rng.next() * total;
      let pick = "req";
      for (const t of ENEMY_ORDER) {
        const weight = band2.weights[t] ?? 0;
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
  startWave(events) {
    const s = this.state;
    s.wave++;
    s.running = true;
    const w = s.wave;
    const boss = this.level ? this.level.bossWaves.some((b) => b.wave === w) : (w - 1) % 5 === 0 && w > 1;
    const pip = this.level ? boss : (w - 1) % 5 === 0;
    s.queue = this.composeWave(w);
    s.spawnTimer = 0;
    events.push({ type: "waveStarted", wave: w, pip, boss });
  }
  /** 0 = nicht gewonnen, 1 = gewonnen, 2/3 = Moral ≥ Schwelle (Level-Daten, Challenge: CHALLENGE_STARS). */
  stars() {
    const s = this.state;
    if (!s.won) return 0;
    const th = this.level ? this.level.stars : s.mode === "challenge" ? CHALLENGE_STARS : null;
    if (!th) return 1;
    return s.lives >= th.three ? 3 : s.lives >= th.two ? 2 : 1;
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
        for (const enemy of this.spawnUnit(type, 0)) events.push({ type: "spawned", enemy });
        s.spawnTimer = Math.max(0.25, 0.9 - s.wave * 0.03);
      }
    }
    for (const e of s.enemies) {
      if (e.hp <= 0) continue;
      const def = ENEMIES[e.type];
      e.slowTime -= DT;
      e.pushCooldown -= DT;
      if (e.frozenTime > 0) {
        e.frozenTime -= DT;
        continue;
      }
      if (def.grow && e.maxHp < e.baseMaxHp * 2) {
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
          const towerIds = [];
          for (const t of s.towers) {
            if (dist2(t, e) <= r2) {
              t.offTime = off;
              towerIds.push(t.id);
            }
          }
          if (towerIds.length) events.push({ type: "jammed", enemy: e, towerIds, radius: def.jam });
        }
      }
      this.enemyAction(e, events);
      let speed = def.speed * this.speedMul * (e.slowTime > 0 ? SLOW_FACTOR : 1);
      if (e.actTime > 0) speed = def.stall ? 0 : speed * def.sprint.factor;
      if (speed > 0) this.move(e, speed * DT);
      if (e.wi >= this.path.length) {
        e.hp = 0;
        const damage = this.mods.leakDamage ? Math.round(def.leakDamage * pct(this.mods.leakDamage)) : def.leakDamage;
        s.lives -= damage;
        s.leaks++;
        events.push({ type: "leaked", enemy: e, damage });
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
      const bonus = this.balance.waveBonusBase + this.balance.waveBonusPerWave * s.wave + this.mods.waveBonus;
      s.money += bonus;
      events.push({ type: "waveCleared", wave: s.wave, bonus });
      for (const t of s.towers) {
        if (t.type !== "rto") continue;
        const br = this.branchOf(t);
        let amount = RTO_VALUE.base + RTO_VALUE.perLevel * (t.level - 1);
        if (br?.value || this.mods.businessValue) amount = Math.round(amount * (br?.value ?? 1) * pct(this.mods.businessValue));
        if (br?.interest) amount += Math.min(RTO_INTEREST_CAP, Math.floor(s.money * br.interest / 100));
        s.money += amount;
        events.push({ type: "businessValue", tower: t, amount });
      }
      if (s.waves !== null && s.wave >= s.waves) {
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
    this.runways = s.towers.filter((t) => t.type === "rta");
    this.updateStealth(events);
    const drags = s.enemies.filter((e) => e.hp > 0 && ENEMIES[e.type].drag);
    for (const t of s.towers) {
      const sync = t.syncTime > 0 ? RTE_SYNC.factor : 1;
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
      if (t.type !== "dev" && t.cooldown > 0) continue;
      const stats = this.towerStats(t);
      const target = this.findTarget(t, stats.range);
      t.targetId = target ? target.id : null;
      if (!target) continue;
      if (t.type === "dev") {
        t.beam = true;
        this.hurt(target, drag === 1 ? stats.dps * DT * sync : stats.dps * DT * sync * drag, events);
        continue;
      }
      if (t.cooldown <= 0) {
        t.cooldown = stats.rate;
        if (t.type === "dualo" && !this.branchOf(t)?.reliable && this.rng.next() < DUALO_ABSENT_CHANCE) {
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
          speed: t.type === "ppl" ? PPL_SHOT_SPEED : SHOT_SPEED,
          branch: t.branch
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
      const br = shot.branch ? BRANCHES[shot.towerType][shot.branch] : null;
      if (shot.towerType === "ppl") {
        const radius = TOWERS.ppl.splash * (1 + 0.1 * (shot.level - 1)) * (br?.splash ?? 1);
        const r2 = radius * radius;
        const center = { x: shot.tx, y: shot.ty };
        events.push({ type: "splash", x: shot.tx, y: shot.ty, radius });
        for (const e of s.enemies) if (dist2(e, center) < r2) this.hurt(e, shot.dmg, events);
        events.push({ type: "hit", shot, enemyId: null });
      } else if (alive) {
        this.hurt(target, shot.dmg, events);
        if (shot.towerType === "analyst") {
          target.slowTime = (1.5 + 0.3 * shot.level) * (br?.slow ?? 1) * pct(this.mods.slowDuration);
          events.push({ type: "slowed", enemy: target });
        }
        if (shot.towerType === "scrum" && br?.slowArea) {
          const r2 = br.slowArea * br.slowArea;
          for (const e of s.enemies) {
            if (e.hp <= 0 || dist2(e, target) > r2) continue;
            e.slowTime = Math.max(e.slowTime, SLOW_AREA_TIME * pct(this.mods.slowDuration));
            events.push({ type: "slowed", enemy: e });
          }
        }
        if (shot.towerType === "scrum" && target.hp > 0 && target.pushCooldown <= 0) {
          const boss = !!ENEMIES[target.type].boss;
          const push = TOWERS.scrum.push * (1 + 0.2 * (shot.level - 1)) * (br?.push ?? 1) * (boss ? 0.15 : 1);
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
    const hpScale = hpScaleForWave(this.balance, Math.max(1, s.wave)) * (type === "boss" ? this.balance.bossHpFactor : 1) * this.hpMul;
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
      jamCooldown: JAM_FIRST,
      frozenTime: 0,
      mech: def.stall?.every ?? def.sprint?.every ?? def.heal?.every ?? def.minion?.every ?? def.budgetCut?.every ?? 0,
      actTime: 0,
      partnerId: 0,
      phase: 0,
      hidden: !!def.stealth
    };
    if (at) this.placeAt(e, at.dist);
    s.enemies.push(e);
    return e;
  }
  /** Spawnt einen Gegner bzw. ein gekoppeltes Paar (Abhängigkeit) an Pfaddistanz `dist`. */
  spawnUnit(type, dist) {
    if (!ENEMIES[type].pair) return [this.spawnEnemy(type, dist > 0 ? { dist } : void 0)];
    const a = this.spawnEnemy(type, { dist: dist + PAIR_GAP });
    const b = this.spawnEnemy(type, dist > 0 ? { dist } : void 0);
    a.partnerId = b.id;
    b.partnerId = a.id;
    return [a, b];
  }
  /** Sonderaktionen der Kampagnen-Gegner (Stehen, Sprint, Heilung, Minions, Budget-Kürzung). */
  enemyAction(e, events) {
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
      events.push(def.stall ? { type: "stalled", enemy: e, duration: timed.time } : { type: "sprinted", enemy: e, duration: timed.time });
      return;
    }
    const every = def.heal?.every ?? def.minion?.every ?? def.budgetCut?.every;
    if (every === void 0) return;
    e.mech -= DT;
    if (e.mech > 0) return;
    e.mech = every;
    const s = this.state;
    if (def.heal) {
      const r2 = def.heal.radius * def.heal.radius;
      const enemyIds = [];
      let amount = 0;
      for (const o of s.enemies) {
        if (o === e || o.hp <= 0 || o.hp >= o.maxHp || ENEMIES[o.type].boss || dist2(o, e) > r2) continue;
        const h = Math.min(o.maxHp - o.hp, o.maxHp * def.heal.pct);
        o.hp += h;
        amount += h;
        enemyIds.push(o.id);
      }
      if (enemyIds.length) events.push({ type: "healed", enemy: e, enemyIds, amount, radius: def.heal.radius });
    } else if (def.minion) {
      for (const minion of this.spawnUnit(def.minion.type, e.dist)) events.push({ type: "spawnedMinion", enemy: e, minion });
    } else if (def.budgetCut) {
      const amount = Math.floor(s.money * def.budgetCut.pct / 100);
      s.money -= amount;
      events.push({ type: "budgetCut", enemy: e, amount });
    }
  }
  /** Schatten-IT ist nur in Reichweite eines Business Analyst oder RTA anvisierbar. */
  updateStealth(events) {
    for (const e of this.state.enemies) {
      if (e.hp <= 0 || !ENEMIES[e.type].stealth) continue;
      let seen = false;
      for (const t of this.state.towers) {
        if (t.type !== "analyst" && t.type !== "rta") continue;
        const r = this.towerStats(t).range;
        if (dist2(e, t) <= r * r) {
          seen = true;
          break;
        }
      }
      if (e.hidden && seen) events.push({ type: "revealed", enemy: e });
      e.hidden = !seen;
    }
  }
  dragFactor(t, drags) {
    let f = 1;
    for (const e of drags) {
      const d = ENEMIES[e.type].drag;
      if (d.factor < f && dist2(e, t) <= d.radius * d.radius) f = d.factor;
    }
    return f;
  }
  /** Kosten einer Rolle inkl. Skills. */
  towerCost(type) {
    const p = this.mods.role[type].cost;
    return p ? Math.round(TOWERS[type].cost * pct(p)) : TOWERS[type].cost;
  }
  towerStats(t) {
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
  computeStats(t) {
    const def = TOWERS[t.type];
    const br = this.branchOf(t);
    const rm = this.mods.role[t.type];
    let boost = 1;
    if (t.type !== "ppl" && !def.support) {
      for (const o of this.state.towers) {
        if (o.type !== "ppl") continue;
        const ob = this.branchOf(o);
        const aura = TOWERS.ppl.aura * (ob?.aura ?? 1);
        const b = ob?.boost ?? PPL_BOOST;
        if (b > boost && dist2(o, t) <= aura * aura) boost = b;
      }
    }
    const m = LEVEL_DMG[t.level - 1] * boost;
    const dmgMul = (br?.damage ?? 1) * pct(rm.damage);
    return {
      boosted: boost > 1,
      range: def.range * (1 + 0.1 * (t.level - 1)) * (br?.range ?? 1) * pct(rm.range),
      dmg: (def.dmg ?? 0) * m * dmgMul,
      dps: (def.dps ?? 0) * m * dmgMul,
      rate: def.rate ? def.rate * LEVEL_RATE[t.level - 1] * (br?.rate ?? 1) / pct(rm.rate) : 0
    };
  }
  /** Zweig-Daten eines Turms (ab Stufe 3) oder null. */
  branchOf(t) {
    return t.branch ? BRANCHES[t.type][t.branch] : null;
  }
  upgradeCost(t) {
    if (t.level >= MAX_LEVEL) return null;
    return Math.round(this.towerCost(t.type) * 0.8 * t.level * pct(this.mods.upgradeCost));
  }
  sellValue(t) {
    return Math.round(t.spent * (0.6 + this.mods.sellRefund / 100));
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
        s.levelId,
        s.loadout,
        s.money,
        s.lives,
        s.wave,
        s.score,
        s.running,
        s.over,
        s.won,
        s.kills,
        s.leaks,
        s.combo,
        s.bestCombo,
        s.lastKillTick,
        s.bossesDefeated,
        s.spawnTimer,
        s.nextId,
        s.queue,
        s.towers.map((t) => [
          t.id,
          t.type,
          t.cx,
          t.cy,
          t.level,
          t.cooldown,
          t.spent,
          t.offTime,
          t.targetId,
          t.beam,
          t.syncTime,
          t.phase,
          t.targetMode,
          t.branch
        ]),
        s.enemies.map((e) => [
          e.id,
          e.type,
          e.x,
          e.y,
          e.wi,
          e.dist,
          e.hp,
          e.maxHp,
          e.slowTime,
          e.pushCooldown,
          e.jamCooldown,
          e.frozenTime,
          e.mech,
          e.actTime,
          e.partnerId,
          e.phase,
          e.hidden
        ]),
        s.shots.map((sh) => [sh.id, sh.towerId, sh.x, sh.y, sh.targetId, sh.tx, sh.ty, sh.dmg, sh.branch]),
        this.rng.state()
      ])
    );
  }
  toReplay() {
    const s = this.state;
    return {
      format: 3,
      gameVersion: GAME_VERSION,
      seed: s.seed,
      levelId: s.levelId,
      mapId: s.mapId,
      mode: s.mode,
      loadout: { ...s.loadout },
      commands: this.commands.map((c) => [...c]),
      endTick: s.tick,
      result: {
        score: s.score,
        wave: s.wave,
        lives: s.lives,
        over: s.over,
        won: s.won,
        kills: s.kills,
        stars: this.stars(),
        leaks: s.leaks
      }
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
  /**
   * D-3: nur lebende, sichtbare Gegner. Zielmodus `first`: größte Pfaddistanz; `last`: kleinste; `strong`: meiste HP
   * (Gleichstand: weiter vorn); `near`: kleinster Abstand. Sonst gewinnt der zuerst gespawnte.
   */
  findTarget(t, range) {
    const r2 = range * range;
    const mode = t.targetMode;
    let best = null;
    if (mode === "first") {
      for (const e of this.state.enemies) {
        if (e.hp <= 0 || e.hidden) continue;
        if (best && e.dist <= best.dist) continue;
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
        if (mode === "last" && !(e.dist < best.dist)) continue;
        if (mode === "strong" && !(e.hp > best.hp || e.hp === best.hp && e.dist > best.dist)) continue;
        if (mode === "near" && !(d2 < bestD2)) continue;
      }
      best = e;
      bestD2 = d2;
    }
    return best;
  }
  hurt(e, damage, events) {
    if (e.hp <= 0) return;
    let d = damage * this.damageFactor(e);
    if (e.partnerId) {
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
  damageFactor(e) {
    const def = ENEMIES[e.type];
    let f = this.runwayFactor(e);
    if (def.armor !== void 0 && f <= 1) f *= def.armor;
    if (def.stall && e.actTime > 0) f *= def.stall.dmg;
    if (def.boss && this.mods.bossDamage) f *= pct(this.mods.bossDamage);
    return f;
  }
  /** Hydra: bei Erreichen der HP-Schwellen neue Phase und Minions. */
  bossPhases(e, events) {
    const ph = ENEMIES[e.type].phases;
    while (e.phase < ph.at.length && e.hp <= e.maxHp * ph.at[e.phase]) {
      e.phase++;
      events.push({ type: "bossPhase", enemy: e, phase: e.phase });
      const step = ENEMIES[ph.type].pair ? 2 : 1;
      for (let i = 0; i < ph.count; i += step) {
        for (const minion of this.spawnUnit(ph.type, e.dist)) events.push({ type: "spawnedMinion", enemy: e, minion });
      }
    }
  }
  /** RTA „Architektur-Runway“: höchster Faktor aller RTA in Reichweite (nicht kumulativ), Tech Debt zusätzlich ×2. */
  runwayFactor(e) {
    let best = 1;
    for (const t of this.runways) {
      if (t.offTime > 0) continue;
      const r = this.towerStats(t).range;
      if (dist2(e, t) > r * r) continue;
      const f = RTA_RUNWAY.factor + RTA_RUNWAY.perLevel * (t.level - 1) + (this.branchOf(t)?.runway ?? 0);
      if (f > best) best = f;
    }
    if (best > 1 && e.type === "debt") best *= RTA_RUNWAY.debt;
    return best;
  }
  /** Unterstützungsrollen (Spec season-2): RTE PI-Sync, Vorstand-Fähigkeiten; RTA wirkt passiv, RTO beim Wellenende. */
  supportAction(t, events) {
    const s = this.state;
    t.targetId = null;
    if (!s.running || t.cooldown > 0) return;
    const br = this.branchOf(t);
    const ability = (br?.interval ?? 1) * pct(this.mods.abilityCooldown);
    if (t.type === "rte") {
      t.cooldown = RTE_SYNC.interval * ability;
      const radius = this.towerStats(t).range;
      const r2 = radius * radius;
      const duration = RTE_SYNC.duration + RTE_SYNC.durationPerLevel * (t.level - 1) + (br?.duration ?? 0);
      const towerIds = [];
      for (const o of s.towers) {
        if (o === t || dist2(o, t) > r2) continue;
        o.syncTime = duration;
        o.offTime = 0;
        towerIds.push(o.id);
      }
      events.push({ type: "synced", tower: t, towerIds, radius });
    } else if (t.type === "board") {
      const alive = s.enemies.filter((e) => e.hp > 0);
      if (!alive.length) return;
      t.cooldown = (BOARD_ABILITY.interval - BOARD_ABILITY.perLevel * (t.level - 1)) * ability;
      if (t.phase % 2 === 0) {
        const f = br?.freeze ?? 1;
        for (const e of alive) e.frozenTime = (ENEMIES[e.type].boss ? BOARD_ABILITY.bossFreeze : BOARD_ABILITY.freeze) * f;
        events.push({ type: "freeze", tower: t, enemyIds: alive.map((e) => e.id) });
      } else {
        let victim = null;
        for (const e of alive) {
          if (ENEMIES[e.type].boss) continue;
          if (!victim || e.hp > victim.hp || e.hp === victim.hp && e.id < victim.id) victim = e;
        }
        if (victim) {
          events.push({ type: "axed", tower: t, enemy: victim });
          victim.hp = 0;
          this.kill(victim, events);
        }
      }
      t.phase++;
    }
  }
  kill(e, events) {
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
    events.push({ type: "killed", enemy: e, reward });
    if (def.split) {
      for (const dx of [-8, 8]) this.spawnFragment("story", e, dx);
      events.push({ type: "split", enemy: e });
    } else if (def.splitInto) {
      const { type, count: count2 } = def.splitInto;
      for (let i = 0; i < count2; i++) this.spawnFragment(type, e, (i - (count2 - 1) / 2) * 10);
      events.push({ type: "split", enemy: e });
    }
  }
  spawnFragment(type, from, dx) {
    const f = this.spawnEnemy(type);
    f.x = from.x + dx;
    f.y = from.y;
    f.wi = from.wi;
    f.dist = from.dist;
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
  if (r.format === 2) fail("Replay-Format 2 (Spielversion 0.2.x/0.3.x) wird nicht mehr unterst\xFCtzt");
  if (r.format !== 3) fail(`format ${String(r.format)} wird nicht unterst\xFCtzt`);
  const version = opts.version ?? GAME_VERSION;
  if (r.gameVersion !== version) fail(`Spielversion ${String(r.gameVersion)} passt nicht zu ${version}`);
  if (!inRange(r.seed, 0, 4294967295)) fail("seed muss uint32 sein");
  if (typeof r.mapId !== "string" || !mapById(r.mapId)) fail(`unbekannte Karte ${String(r.mapId)}`);
  if (r.mode !== "challenge" && r.mode !== "endless" && r.mode !== "level") fail(`unbekannter Modus ${String(r.mode)}`);
  if (r.mode === "level") {
    const level = typeof r.levelId === "string" ? levelById(r.levelId) : void 0;
    if (!level) fail(`unbekanntes Level ${String(r.levelId)}`);
    if (level.mapId !== r.mapId) fail(`Karte ${String(r.mapId)} passt nicht zu Level ${level.id}`);
  } else if (r.levelId !== null) {
    fail("levelId muss au\xDFerhalb des Level-Modus null sein");
  }
  const loadoutError = validateLoadout(r.loadout, Infinity);
  if (loadoutError) fail(`loadout ung\xFCltig (${loadoutError})`);
  const maxTicks = Math.min(opts.maxTicks ?? MAX_REPLAY_TICKS, MAX_REPLAY_TICKS);
  if (!inRange(r.endTick, 0, maxTicks)) fail(`endTick au\xDFerhalb 0\u2026${maxTicks}`);
  if (!Array.isArray(r.commands)) fail("commands fehlt");
  if (r.commands.length > MAX_REPLAY_COMMANDS) fail(`mehr als ${MAX_REPLAY_COMMANDS} Kommandos`);
  let lastTick = 0;
  for (const [i, c] of r.commands.entries()) {
    if (!Array.isArray(c) || !inRange(c[0], 0, r.endTick)) fail(`Kommando ${i}: Tick fehlt oder au\xDFerhalb`);
    if (c[0] < lastTick) fail(`Kommando ${i}: Ticks nicht aufsteigend`);
    lastTick = c[0];
    const ok = c[1] === "place" && c.length === 5 && typeof c[2] === "string" && Object.hasOwn(TOWERS, c[2]) && inRange(c[3], 0, COLS - 1) && inRange(c[4], 0, ROWS - 1) || c[1] === "upgrade" && c.length === 3 && inRange(c[2], 1, MAX_TOWER_ID) || c[1] === "upgrade" && c.length === 4 && inRange(c[2], 1, MAX_TOWER_ID) && (c[3] === "a" || c[3] === "b") || c[1] === "sell" && c.length === 3 && inRange(c[2], 1, MAX_TOWER_ID) || c[1] === "target" && c.length === 4 && inRange(c[2], 1, MAX_TOWER_ID) && TARGET_MODES.includes(c[3]) || c[1] === "startWave" && c.length === 2;
    if (!ok) fail(`Kommando ${i}: ung\xFCltig`);
  }
  const res = r.result;
  if (!res || typeof res !== "object" || !isInt(res.score) || !isInt(res.wave) || !isInt(res.lives) || typeof res.over !== "boolean" || typeof res.won !== "boolean" || !inRange(res.kills, 0, Number.MAX_SAFE_INTEGER) || !inRange(res.stars, 0, 3) || !inRange(res.leaks, 0, Number.MAX_SAFE_INTEGER)) {
    fail("result unvollst\xE4ndig");
  }
  return data;
}
function runReplay(r, opts = {}) {
  const game = new Game({ seed: r.seed, mapId: r.mapId, mode: r.mode, levelId: r.levelId, loadout: r.loadout, balance: opts.balance });
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
  const stars = game.stars();
  const res = r.result;
  const matches = !rejected && s.tick === r.endTick && s.score === res.score && s.wave === res.wave && s.lives === res.lives && s.over === res.over && s.won === res.won && s.kills === res.kills && stars === res.stars && s.leaks === res.leaks;
  return {
    score: s.score,
    wave: s.wave,
    lives: s.lives,
    over: s.over,
    won: s.won,
    kills: s.kills,
    stars,
    leaks: s.leaks,
    tick: s.tick,
    hash: game.stateHash(),
    matches,
    bestCombo: s.bestCombo,
    bossesDefeated: [...s.bossesDefeated]
  };
}
export {
  ACHIEVEMENTS,
  BALANCE,
  BOARD_ABILITY,
  BRANCHES,
  BRANCH_LEVEL,
  CAMPAIGNS,
  CHALLENGE_STARS,
  CHALLENGE_WAVES,
  COLS,
  COMBO_WINDOW,
  DT,
  ENEMIES,
  ENEMY_ORDER,
  FREE_MAPS,
  FREE_MAP_COUNT,
  GAME_VERSION,
  Game,
  HEIGHT,
  LEVELS,
  LEVEL_DMG,
  LEVEL_RATE,
  MAPS,
  MAX_ACCOUNT_LEVEL,
  MAX_LEVEL,
  MAX_REPLAY_COMMANDS,
  MAX_REPLAY_TICKS,
  MAX_TOWER_ID,
  PAIR_GAP,
  ROWS,
  RTA_RUNWAY,
  RTE_SYNC,
  RTO_VALUE,
  SKILLS,
  SKILL_BRANCHES,
  START_LIVES,
  TARGET_MODES,
  TARGET_MODE_NAMES,
  THEMES,
  TICK_RATE,
  TILE,
  TOWERS,
  TOWER_ORDER,
  VICTORY_BONUS_PER_LIFE,
  WIDTH,
  XP,
  achievementProgress,
  achievementsFor,
  addRunToStats,
  campaignById,
  createRng,
  emptyModifiers,
  emptyStats,
  hpScaleForWave,
  levelById,
  levelForXp,
  levelsOfCampaign,
  loadoutPoints,
  mapById,
  mixSeed,
  modifiersFor,
  nextLevel,
  normalizeLoadout,
  parseReplay,
  rewardForWave,
  runReplay,
  sameLoadout,
  skillById,
  skillPointsForLevel,
  validateLoadout,
  xpForLevel,
  xpForRun
};
