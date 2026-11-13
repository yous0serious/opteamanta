export type TowerType = 'dualo' | 'analyst' | 'dev' | 'ppl' | 'scrum' | 'rte' | 'rta' | 'rto' | 'board';
export type EnemyType =
  | 'req'
  | 'cr'
  | 'story'
  | 'obj'
  | 'feat'
  | 'creep'
  | 'debt'
  | 'boss'
  | 'meeting'
  | 'hotfix'
  // Kampagnen (Spec campaigns)
  | 'impediment'
  | 'spike'
  | 'dependency'
  | 'enabler'
  | 'compliance'
  | 'shadow-it'
  | 'vendor-lock'
  | 'epic'
  | 'b-scope'
  | 'b-pi'
  | 'b-hydra'
  | 'b-lbc';
export type MapId =
  | 'spaghetti'
  | 'waterfall'
  | 'release-train'
  | 'matrix'
  // Kampagnen (Spec campaigns)
  | 'open-plan'
  | 'kanban-loop'
  | 'retro-spiral'
  | 'big-room'
  | 'program-board'
  | 'dependency-web'
  | 'server-aisles'
  | 'cable-maze'
  | 'firewall'
  | 'glass-tower'
  | 'boardroom-table'
  | 'stage-gate';
/** Challenge: 30 Wellen, dann Sieg. Endlos: bis Game Over. Level: Kampagnen-Level mit eigener Wellenzahl. */
export type GameMode = 'challenge' | 'endless' | 'level';
export type CampaignId = 'team' | 'art' | 'solution' | 'portfolio';
export type LevelId = `${CampaignId}-${1 | 2 | 3 | 4 | 5 | 6}`;
export type ThemeId = 'open-office' | 'big-room' | 'server-room' | 'boardroom';
/** Zielmodus angreifender Rollen: weitester Fortschritt, geringster Fortschritt, meiste HP, geringster Abstand. */
export type TargetMode = 'first' | 'last' | 'strong' | 'near';
/** Upgrade-Zweig ab Stufe 3. */
export type Branch = 'a' | 'b';
export type SkillTreeBranch = 'team' | 'process' | 'leadership';
export type SkillId =
  | 'team-pair'
  | 'team-dual'
  | 'team-tdd'
  | 'team-swarm'
  | 'team-dod'
  | 'team-cop'
  | 'team-mob'
  | 'team-tshape'
  | 'team-cap'
  | 'proc-wsjf'
  | 'proc-kanban'
  | 'proc-lbc'
  | 'proc-ci'
  | 'proc-refine'
  | 'proc-flow'
  | 'proc-devops'
  | 'proc-rod'
  | 'proc-cap'
  | 'lead-servant'
  | 'lead-ia'
  | 'lead-pi'
  | 'lead-sync'
  | 'lead-runway'
  | 'lead-coach'
  | 'lead-gemba'
  | 'lead-vision'
  | 'lead-cap';
/** Rang je Skill (fehlend oder 0 = nicht gelernt). */
export type SkillLoadout = Partial<Record<SkillId, number>>;

/** Prozentwerte je Rolle (ganzzahlig, z. B. 10 = +10 %). */
export interface RoleModifiers {
  /** Kosten in % (negativ = billiger). */
  cost: number;
  damage: number;
  range: number;
  /** Feuerrate in % (positiv = schneller). */
  rate: number;
}

/** Wirkung der Skills in der Simulation (Summe aller gelernten Ränge, `modifiersFor`). */
export interface Modifiers {
  /** SP zusätzlich zu Spielbeginn. */
  startMoney: number;
  /** Moral zusätzlich zu Spielbeginn. */
  startLives: number;
  /** SP zusätzlich je abgeschlossener Welle. */
  waveBonus: number;
  /** % auf Abschuss-Belohnungen. */
  killReward: number;
  /** Prozentpunkte auf den Verkaufswert (Basis 60 %). */
  sellRefund: number;
  /** % auf Upgrade-Kosten (negativ = billiger). */
  upgradeCost: number;
  /** % Schaden gegen Bosse. */
  bossDamage: number;
  /** % Verlangsamungsdauer (Business Analyst). */
  slowDuration: number;
  /** % Störungsdauer durch Gegner (negativ = kürzer). */
  jamTime: number;
  /** % Intervall der Fähigkeiten von RTE und Vorstand (negativ = kürzer). */
  abilityCooldown: number;
  /** % Moralverlust bei Lecks (negativ = weniger). */
  leakDamage: number;
  /** % Ertrag des RTO („Business Value“). */
  businessValue: number;
  role: Record<TowerType, RoleModifiers>;
}

export interface TowerDef {
  id: TowerType;
  name: string;
  emoji: string;
  cost: number;
  range: number;
  /** Sekunden zwischen Schüssen (fehlt beim Dauerstrahl). */
  rate?: number;
  dmg?: number;
  /** Schaden pro Sekunde (Dauerstrahl). */
  dps?: number;
  splash?: number;
  aura?: number;
  push?: number;
  /** Unterstützungsrolle ohne eigenes Ziel (RTE, RTA, RTO, Vorstand – Spec season-2). */
  support?: boolean;
  /** Höchstzahl gleichzeitig im Spiel (Vorstand: 1). */
  limit?: number;
  color: string;
}

/** Upgrade-Zweig einer Rolle (Stufe 3–5). Faktoren multiplizieren, fehlende Felder = keine Wirkung. */
export interface BranchDef {
  id: Branch;
  name: string;
  description: string;
  /** Faktor Reichweite. */
  range?: number;
  /** Faktor Schaden/DPS. */
  damage?: number;
  /** Faktor Abklingzeit (kleiner = schneller). */
  rate?: number;
  /** Faktor Splash-Radius (PPL). */
  splash?: number;
  /** Faktor Aura-Radius (PPL). */
  aura?: number;
  /** Aura-Schadensfaktor statt PPL_BOOST (PPL). */
  boost?: number;
  /** Faktor Rückstoß (Scrum Master). */
  push?: number;
  /** Radius einer Verlangsamung im Umkreis des Treffers (Scrum Master). */
  slowArea?: number;
  /** Faktor Verlangsamungsdauer (Business Analyst). */
  slow?: number;
  /** Dualo fehlt nie. */
  reliable?: boolean;
  /** Faktor Fähigkeits-Intervall (RTE, Vorstand). */
  interval?: number;
  /** Zusätzliche Sekunden PI-Sync (RTE). */
  duration?: number;
  /** Zusätzlicher Runway-Faktor (RTA). */
  runway?: number;
  /** Faktor Business Value (RTO). */
  value?: number;
  /** Zinsen in % der aktuellen Kapazität je Wellenende (RTO), gedeckelt. */
  interest?: number;
  /** Faktor Freeze-Dauer (Vorstand). */
  freeze?: number;
}

export interface EnemyDef {
  id: EnemyType;
  name: string;
  emoji: string;
  hp: number;
  /** Pixel pro Sekunde. */
  speed: number;
  reward: number;
  color: string;
  /** Moralverlust bei Leck. */
  leakDamage: number;
  split?: boolean;
  /** Wachstum pro Sekunde, relativ zur aktuellen Max-HP. */
  grow?: number;
  /** Radius des Störimpulses. */
  jam?: number;
  /** Dauer der Störung in Sekunden (Standard: JAM_OFF_TIME). */
  jamTime?: number;
  /** Abstand der Störimpulse in Sekunden (Standard: JAM_INTERVAL). */
  jamEvery?: number;
  boss?: true;
  /** Kampagne, in der der Gegner eingeführt wird. */
  campaign?: CampaignId;
  /** Impediment: bleibt alle `every` s für `time` s stehen; Schadensfaktor währenddessen. */
  stall?: { every: number; time: number; dmg: number };
  /** Spike: alle `every` s Sprint für `time` s mit Tempo × `factor`. */
  sprint?: { every: number; time: number; factor: number };
  /** Abhängigkeit: spawnt als gekoppeltes Paar, Schaden wird geteilt, solange beide leben. */
  pair?: boolean;
  /** Enabler: heilt andere Gegner im Umkreis alle `every` s um `pct` der Max-HP (keine Bosse). */
  heal?: { radius: number; pct: number; every: number };
  /** Panzer: Schadensfaktor außerhalb des RTA-Runways. */
  armor?: number;
  /** Schatten-IT: nur anvisierbar in Reichweite eines Business Analyst oder RTA. */
  stealth?: boolean;
  /** Vendor Lock-in: Rollen im Umkreis feuern mit Faktor `factor`. */
  drag?: { radius: number; factor: number };
  /** Zerfall in `count` Gegner des Typs `type`. */
  splitInto?: { type: EnemyType; count: number };
  /** Spawnt alle `every` s einen Gegner `type` an seiner Position. */
  minion?: { type: EnemyType; every: number };
  /** Bei diesen HP-Anteilen spawnt der Boss `count` Gegner `type` (Abhängigkeiten als Paar). */
  phases?: { at: readonly number[]; type: EnemyType; count: number };
  /** Alle `every` s: Kapazität −`pct` (abgerundet). */
  budgetCut?: { every: number; pct: number };
}

export interface MapDef {
  id: MapId;
  name: string;
  hue: number;
  theme: ThemeId;
  waypoints: ReadonlyArray<readonly [number, number]>;
}

export interface Point {
  x: number;
  y: number;
}

export interface Tower {
  id: number;
  type: TowerType;
  cx: number;
  cy: number;
  x: number;
  y: number;
  level: number;
  cooldown: number;
  spent: number;
  offTime: number;
  targetId: number | null;
  beam: boolean;
  /** Restdauer des PI-Sync-Boosts (RTE, Spec season-2). */
  syncTime: number;
  /** Fähigkeiten-Zähler (Vorstand wechselt Budget-Freeze/„Projekt eingestampft“). */
  phase: number;
  /** Zielmodus (nur angreifende Rollen wirksam). */
  targetMode: TargetMode;
  /** Upgrade-Zweig ab Stufe 3, sonst null. */
  branch: Branch | null;
}

export interface Enemy {
  id: number;
  type: EnemyType;
  x: number;
  y: number;
  /** Index des nächsten Wegpunkts. */
  wi: number;
  /** Zurückgelegte Pfaddistanz in Pixeln. */
  dist: number;
  hp: number;
  maxHp: number;
  baseMaxHp: number;
  hpScale: number;
  slowTime: number;
  pushCooldown: number;
  jamCooldown: number;
  /** Restdauer des Budget-Freeze (Vorstand, Spec season-2). */
  frozenTime: number;
  /** Zeit bis zur nächsten Sonderaktion (Stehen, Sprint, Heilung, Minion, Budget-Kürzung). */
  mech: number;
  /** Restdauer der laufenden Sonderaktion (Stehen/Sprint). */
  actTime: number;
  /** Gekoppelter Partner (Abhängigkeit), 0 = keiner. */
  partnerId: number;
  /** Erreichte Boss-Phasen (Hydra). */
  phase: number;
  /** Schatten-IT: derzeit nicht anvisierbar. */
  hidden: boolean;
}

export interface Shot {
  id: number;
  towerId: number;
  towerType: TowerType;
  x: number;
  y: number;
  targetId: number;
  tx: number;
  ty: number;
  dmg: number;
  level: number;
  speed: number;
  /** Zweig des feuernden Turms (Splash, Rückstoß, Verlangsamung). */
  branch: Branch | null;
}

export interface GameState {
  tick: number;
  seed: number;
  mapId: MapId;
  mode: GameMode;
  /** Kampagnen-Level oder null (freies Spiel/Daily). */
  levelId: LevelId | null;
  /** Skill-Loadout dieses Laufs (zählt in Ranglisten, Replay v3). */
  loadout: SkillLoadout;
  /** Sieg nach dieser Welle (Challenge 30, Level laut Daten), Endlos: null. */
  waves: number | null;
  money: number;
  lives: number;
  wave: number;
  score: number;
  running: boolean;
  over: boolean;
  won: boolean;
  /** Erledigte Gegner (inkl. Abspaltungen und Minions). */
  kills: number;
  /** Durchgelaufene Gegner. */
  leaks: number;
  /** Abschüsse in Folge mit höchstens COMBO_WINDOW Ticks Abstand. */
  combo: number;
  bestCombo: number;
  lastKillTick: number;
  /** Besiegte Bosstypen (einmalig, in Reihenfolge). */
  bossesDefeated: EnemyType[];
  towers: Tower[];
  enemies: Enemy[];
  shots: Shot[];
  queue: EnemyType[];
  spawnTimer: number;
  nextId: number;
}

export type Command =
  | { type: 'place'; tower: TowerType; cx: number; cy: number }
  | { type: 'upgrade'; towerId: number; branch?: Branch }
  | { type: 'sell'; towerId: number }
  | { type: 'target'; towerId: number; mode: TargetMode }
  | { type: 'startWave' };

export type RejectReason =
  | 'outOfBounds'
  | 'path'
  | 'occupied'
  | 'noMoney'
  | 'maxLevel'
  | 'unknownTower'
  | 'waveRunning'
  | 'gameOver'
  | 'limit'
  /** Rolle ist im Level nicht verfügbar. */
  | 'roleLocked'
  /** Schritt Stufe 2 → 3 braucht einen Zweig ('a' | 'b'). */
  | 'branchRequired'
  /** Zielmodus für Unterstützungsrollen bzw. unbekannter Modus. */
  | 'notTargetable';

export type SimEvent =
  | { type: 'placed'; tower: Tower }
  | { type: 'upgraded'; tower: Tower; cost: number }
  | { type: 'sold'; tower: Tower; refund: number }
  | { type: 'rejected'; command: Command; reason: RejectReason }
  | { type: 'waveStarted'; wave: number; pip: boolean; boss: boolean }
  | { type: 'waveCleared'; wave: number; bonus: number }
  | { type: 'spawned'; enemy: Enemy }
  | { type: 'killed'; enemy: Enemy; reward: number }
  | { type: 'split'; enemy: Enemy }
  | { type: 'leaked'; enemy: Enemy; damage: number }
  | { type: 'fired'; tower: Tower; shot: Shot }
  | { type: 'hit'; shot: Shot; enemyId: number | null }
  | { type: 'splash'; x: number; y: number; radius: number }
  | { type: 'slowed'; enemy: Enemy }
  | { type: 'pushed'; enemy: Enemy }
  | { type: 'absent'; tower: Tower }
  | { type: 'jammed'; enemy: Enemy; towerIds: number[]; radius: number }
  | { type: 'synced'; tower: Tower; towerIds: number[]; radius: number }
  | { type: 'businessValue'; tower: Tower; amount: number }
  | { type: 'freeze'; tower: Tower; enemyIds: number[] }
  | { type: 'axed'; tower: Tower; enemy: Enemy }
  | { type: 'gameOver'; wave: number; score: number }
  | { type: 'victory'; wave: number; score: number; bonus: number }
  // Kampagnen (Spec campaigns)
  /** Impediment bleibt stehen (`duration` s, währenddessen weniger Schaden). */
  | { type: 'stalled'; enemy: Enemy; duration: number }
  /** Spike sprintet (`duration` s). */
  | { type: 'sprinted'; enemy: Enemy; duration: number }
  /** Enabler heilt Gegner im Umkreis; `amount` = Summe der geheilten HP. */
  | { type: 'healed'; enemy: Enemy; enemyIds: number[]; amount: number; radius: number }
  /** Schatten-IT wird sichtbar (Business Analyst/RTA in Reichweite). */
  | { type: 'revealed'; enemy: Enemy }
  /** Lean Business Case kürzt die Kapazität. */
  | { type: 'budgetCut'; enemy: Enemy; amount: number }
  /** Boss erreicht eine neue Phase (Hydra: 1 bei 66 %, 2 bei 33 %). */
  | { type: 'bossPhase'; enemy: Enemy; phase: number }
  /** Gegner `enemy` erzeugt `minion` (Scope-Explosion, Hydra). */
  | { type: 'spawnedMinion'; enemy: Enemy; minion: Enemy }
  | { type: 'targetChanged'; tower: Tower; mode: TargetMode };

export interface TowerStats {
  range: number;
  dmg: number;
  dps: number;
  rate: number;
  boosted: boolean;
}

export type ReplayCommand =
  | [tick: number, 'place', TowerType, number, number]
  | [tick: number, 'upgrade', number]
  | [tick: number, 'upgrade', number, Branch]
  | [tick: number, 'sell', number]
  | [tick: number, 'target', number, TargetMode]
  | [tick: number, 'startWave'];

export interface ReplayResult {
  score: number;
  wave: number;
  lives: number;
  over: boolean;
  /** Challenge/Level gewonnen. */
  won: boolean;
  /** Erledigte Gegner. */
  kills: number;
  /** 0–3 (0 = nicht gewonnen). */
  stars: 0 | 1 | 2 | 3;
  /** Durchgelaufene Gegner. */
  leaks: number;
}

/** Replay-Format 3 (Spielversion ≥ 0.4.0): Level, Skill-Loadout, Zielmodi, Upgrade-Zweige. */
export interface ReplayV3 {
  format: 3;
  gameVersion: string;
  seed: number;
  levelId: LevelId | null;
  mapId: MapId;
  mode: GameMode;
  loadout: SkillLoadout;
  commands: ReplayCommand[];
  endTick: number;
  result: ReplayResult;
}

/** Aktuelles Replay-Format. */
export type Replay = ReplayV3;

// ===================== Kampagnen, Skills, Progression (Spec campaigns) =====================

export interface WaveBand {
  /** Erste und letzte Welle (inklusive), für die das Band gilt. */
  from: number;
  to: number;
  /** Wellengröße: floor(base + perWave × Welle). */
  size: readonly [base: number, perWave: number];
  /** Ziehungsgewichte je Gegnertyp. */
  weights: Partial<Record<EnemyType, number>>;
}

export interface LevelDef {
  id: LevelId;
  campaign: CampaignId;
  /** 1–6 innerhalb der Kampagne. */
  index: number;
  name: string;
  briefing: string;
  mapId: MapId;
  /** Sieg nach dieser Welle. */
  waves: number;
  startMoney: number;
  /** Start-Moral (Standard START_LIVES). */
  lives?: number;
  /** Verfügbare Rollen. */
  roles: readonly TowerType[];
  pool: readonly WaveBand[];
  /** Boss am Ende dieser Wellen. */
  bossWaves: ReadonlyArray<{ wave: number; boss: EnemyType }>;
  /** Multiplikatoren (Standard 1). */
  mods?: { hp?: number; speed?: number; reward?: number };
  /** Mindest-Moral für 2/3 Sterne (1 Stern = geschafft). */
  stars: { two: number; three: number };
  tutorial?: boolean;
}

export interface CampaignDef {
  id: CampaignId;
  name: string;
  tagline: string;
  theme: ThemeId;
  levels: readonly LevelId[];
  boss: EnemyType;
}

export interface ThemeDef {
  id: ThemeId;
  name: string;
}

/** Wirkung eines Skills je Rang (wird mit dem Rang multipliziert). */
export type SkillEffect =
  | { stat: Exclude<keyof Modifiers, 'role'>; perRank: number }
  | { stat: keyof RoleModifiers; roles: readonly TowerType[]; perRank: number };

export interface SkillDef {
  id: SkillId;
  branch: SkillTreeBranch;
  /** Reihe im Baum (1–5, 5 = Kapstein). */
  tier: number;
  /** Spalte innerhalb des Asts (0 oder 1, Kapstein 0). */
  col: number;
  name: string;
  description: string;
  /** Icon-Name (`icon/<icon>` im Atlas). */
  icon: string;
  maxRank: number;
  /** Alle genannten Skills brauchen Rang ≥ 1. */
  requires: readonly SkillId[];
  effects: readonly SkillEffect[];
  capstone?: true;
}
