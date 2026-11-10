import type { TowerDef, TowerType } from '../types';

// Werte 1:1 aus dem Original (TW, Zeilen 120–125); IDs umbenannt laut Spec.
export const TOWERS: Readonly<Record<TowerType, TowerDef>> = {
  dualo: { id: 'dualo', name: 'Dualo', emoji: '🎓', cost: 30, range: 100, rate: 0.35, dmg: 6, color: '#1e88e5' },
  analyst: { id: 'analyst', name: 'Business Analyst', emoji: '📋', cost: 70, range: 105, rate: 0.7, dmg: 5, color: '#43a047' },
  dev: { id: 'dev', name: 'Entwickler', emoji: '👩‍💻', cost: 120, range: 150, dps: 45, color: '#d81b60' },
  ppl: { id: 'ppl', name: 'PPL', emoji: '🧭', cost: 150, range: 140, rate: 1.5, dmg: 40, splash: 65, aura: 120, color: '#f9a825' },
  scrum: { id: 'scrum', name: 'Scrum Master', emoji: '🔁', cost: 110, range: 115, rate: 2.4, dmg: 4, push: 70, color: '#8e24aa' },
};

/** Reihenfolge der Tasten 1–5. */
export const TOWER_ORDER: readonly TowerType[] = ['dualo', 'analyst', 'dev', 'ppl', 'scrum'];

export const DUALO_ABSENT_CHANCE = 0.08;
export const DUALO_ABSENT_TIME = 2;
export const SLOW_FACTOR = 0.5;
export const PPL_BOOST = 1.25;
export const SHOT_SPEED = 520;
export const PPL_SHOT_SPEED = 320;
