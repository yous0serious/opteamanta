import type { EnemyDef, EnemyType } from '../types';

// Werte 1:1 aus dem Original (EN, Zeilen 127–135); Leckschaden aus update() Zeile 228.
export const ENEMIES: Readonly<Record<EnemyType, EnemyDef>> = {
  req: { id: 'req', name: 'Anforderung', emoji: '📝', hp: 30, speed: 60, reward: 6, color: '#fff176', leakDamage: 5 },
  cr: { id: 'cr', name: 'Change Request', emoji: '🔄', hp: 16, speed: 115, reward: 4, color: '#a5d6a7', leakDamage: 5 },
  story: { id: 'story', name: 'User Story', emoji: '🧩', hp: 14, speed: 90, reward: 3, color: '#b3e5fc', leakDamage: 5 },
  obj: { id: 'obj', name: 'Objective', emoji: '🎯', hp: 110, speed: 38, reward: 12, color: '#ffcc80', leakDamage: 8 },
  feat: { id: 'feat', name: 'Feature', emoji: '📦', hp: 70, speed: 55, reward: 15, color: '#f48fb1', leakDamage: 5, split: true },
  creep: { id: 'creep', name: 'Scope Creep', emoji: '🐛', hp: 40, speed: 62, reward: 8, color: '#dce775', leakDamage: 5, grow: 0.05 },
  debt: { id: 'debt', name: 'Tech Debt', emoji: '💸', hp: 65, speed: 45, reward: 11, color: '#cfd8dc', leakDamage: 5, jam: 75 },
  boss: {
    id: 'boss',
    name: 'MEGA-OBJECTIVE „Alles digital bis Q4“',
    emoji: '🐘',
    hp: 900,
    speed: 28,
    reward: 150,
    color: '#ef9a9a',
    leakDamage: 40,
    boss: true,
  },
  // Saison 2 (Spec season-2)
  meeting: { id: 'meeting', name: 'Meeting-Einladung', emoji: '📅', hp: 35, speed: 70, reward: 7, color: '#90caf9', leakDamage: 5, jam: 60, jamTime: 1.2 },
  hotfix: { id: 'hotfix', name: 'Hotfix', emoji: '🔥', hp: 12, speed: 150, reward: 3, color: '#ffab91', leakDamage: 5 },
  // Kampagnen (Spec campaigns): Startwerte aus der Spec-Tabelle, per Bot-Tuning angepasst. Kein Emoji (Monster-Grafik).
  impediment: {
    id: 'impediment', name: 'Impediment', emoji: '', hp: 90, speed: 40, reward: 10, color: '#bcaaa4', leakDamage: 6,
    campaign: 'team', stall: { every: 4, time: 1.2, dmg: 0.6 },
  },
  spike: {
    id: 'spike', name: 'Spike', emoji: '', hp: 20, speed: 80, reward: 4, color: '#ffe082', leakDamage: 4,
    campaign: 'team', sprint: { every: 3, time: 0.8, factor: 2.2 },
  },
  dependency: {
    id: 'dependency', name: 'Abhängigkeit', emoji: '', hp: 45, speed: 58, reward: 7, color: '#ce93d8', leakDamage: 5,
    campaign: 'art', pair: true,
  },
  enabler: {
    id: 'enabler', name: 'Enabler Story', emoji: '', hp: 50, speed: 52, reward: 9, color: '#80cbc4', leakDamage: 5,
    campaign: 'art', heal: { radius: 70, pct: 0.04, every: 1 },
  },
  compliance: {
    id: 'compliance', name: 'Compliance-Audit', emoji: '', hp: 140, speed: 36, reward: 14, color: '#b0bec5', leakDamage: 8,
    campaign: 'solution', armor: 0.5,
  },
  'shadow-it': {
    id: 'shadow-it', name: 'Schatten-IT', emoji: '', hp: 40, speed: 75, reward: 9, color: '#9fa8da', leakDamage: 5,
    campaign: 'solution', stealth: true,
  },
  'vendor-lock': {
    id: 'vendor-lock', name: 'Vendor Lock-in', emoji: '', hp: 80, speed: 44, reward: 12, color: '#ffcc80', leakDamage: 6,
    campaign: 'solution', drag: { radius: 75, factor: 0.6 },
  },
  epic: {
    id: 'epic', name: 'Epic', emoji: '', hp: 320, speed: 30, reward: 30, color: '#f8bbd0', leakDamage: 12,
    campaign: 'portfolio', splitInto: { type: 'feat', count: 3 },
  },
  'b-scope': {
    id: 'b-scope', name: 'Sprint-Scope-Explosion', emoji: '', hp: 1400, speed: 26, reward: 160, color: '#e6ee9c', leakDamage: 40,
    boss: true, campaign: 'team', grow: 0.05, minion: { type: 'story', every: 5 },
  },
  'b-pi': {
    id: 'b-pi', name: 'Big-Room-Chaos', emoji: '', hp: 1200, speed: 24, reward: 180, color: '#ffab91', leakDamage: 40,
    boss: true, campaign: 'art', jam: 110, jamTime: 1.5, jamEvery: 6,
  },
  'b-hydra': {
    id: 'b-hydra', name: 'Integrations-Hydra', emoji: '', hp: 1100, speed: 24, reward: 200, color: '#b39ddb', leakDamage: 40,
    boss: true, campaign: 'solution', armor: 0.5, phases: { at: [0.66, 0.33], type: 'dependency', count: 2 },
  },
  'b-lbc': {
    id: 'b-lbc', name: 'Lean Business Case Q4', emoji: '', hp: 1700, speed: 22, reward: 250, color: '#a5d6a7', leakDamage: 40,
    boss: true, campaign: 'portfolio', armor: 0.5, budgetCut: { every: 8, pct: 10 },
  },
};

/** Feste Reihenfolge aller Gegnertypen (Ziehungen, Listen, Vorschau). */
export const ENEMY_ORDER: readonly EnemyType[] = [
  'req', 'cr', 'story', 'obj', 'feat', 'creep', 'debt', 'boss', 'meeting', 'hotfix',
  'impediment', 'spike', 'dependency', 'enabler', 'compliance', 'shadow-it', 'vendor-lock', 'epic',
  'b-scope', 'b-pi', 'b-hydra', 'b-lbc',
];

export const JAM_FIRST = 1;
export const JAM_INTERVAL = 3;
export const JAM_OFF_TIME = 2;
/** Abstand gekoppelter Abhängigkeiten beim Spawn (Pixel Pfaddistanz). */
export const PAIR_GAP = 14;
