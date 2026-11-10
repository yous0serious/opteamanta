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
};

export const JAM_FIRST = 1;
export const JAM_INTERVAL = 3;
export const JAM_OFF_TIME = 2;
