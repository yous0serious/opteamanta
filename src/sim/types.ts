export type TowerType = 'dualo' | 'analyst' | 'dev' | 'ppl' | 'scrum';
export type EnemyType = 'req' | 'cr' | 'story' | 'obj' | 'feat' | 'creep' | 'debt' | 'boss';
export type MapId = 'spaghetti' | 'waterfall' | 'release-train' | 'matrix';

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
  color: string;
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
  boss?: boolean;
}

export interface MapDef {
  id: MapId;
  name: string;
  hue: number;
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
}

export interface GameState {
  tick: number;
  seed: number;
  mapId: MapId;
  money: number;
  lives: number;
  wave: number;
  score: number;
  running: boolean;
  over: boolean;
  towers: Tower[];
  enemies: Enemy[];
  shots: Shot[];
  queue: EnemyType[];
  spawnTimer: number;
  nextId: number;
}

export type Command =
  | { type: 'place'; tower: TowerType; cx: number; cy: number }
  | { type: 'upgrade'; towerId: number }
  | { type: 'sell'; towerId: number }
  | { type: 'startWave' };

export type RejectReason =
  | 'outOfBounds'
  | 'path'
  | 'occupied'
  | 'noMoney'
  | 'maxLevel'
  | 'unknownTower'
  | 'waveRunning'
  | 'gameOver';

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
  | { type: 'gameOver'; wave: number; score: number };

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
  | [tick: number, 'sell', number]
  | [tick: number, 'startWave'];

export interface ReplayResult {
  score: number;
  wave: number;
  lives: number;
  over: boolean;
}

export interface ReplayV1 {
  format: 1;
  gameVersion: string;
  seed: number;
  mapId: MapId;
  commands: ReplayCommand[];
  endTick: number;
  result: ReplayResult;
}
