import type { TowerDef, TowerType } from '../types';

// Werte 1:1 aus dem Original (TW, Zeilen 120–125); IDs umbenannt laut Spec.
export const TOWERS: Readonly<Record<TowerType, TowerDef>> = {
  dualo: { id: 'dualo', name: 'Dualo', emoji: '🎓', cost: 30, range: 100, rate: 0.35, dmg: 6, color: '#1e88e5' },
  analyst: { id: 'analyst', name: 'Business Analyst', emoji: '📋', cost: 70, range: 105, rate: 0.7, dmg: 5, color: '#43a047' },
  dev: { id: 'dev', name: 'Entwickler', emoji: '👩‍💻', cost: 120, range: 150, dps: 45, color: '#d81b60' },
  ppl: { id: 'ppl', name: 'PPL', emoji: '🧭', cost: 150, range: 140, rate: 1.5, dmg: 40, splash: 65, aura: 120, color: '#f9a825' },
  scrum: { id: 'scrum', name: 'Scrum Master', emoji: '🔁', cost: 110, range: 115, rate: 2.4, dmg: 4, push: 70, color: '#8e24aa' },
  // Saison 2 (Spec season-2): Unterstützungsrollen ohne eigenes Ziel
  rte: { id: 'rte', name: 'RTE', emoji: '🚂', cost: 140, range: 130, support: true, color: '#00897b' },
  rta: { id: 'rta', name: 'RTA', emoji: '📐', cost: 130, range: 110, support: true, color: '#3949ab' },
  rto: { id: 'rto', name: 'RTO', emoji: '💰', cost: 100, range: 0, support: true, color: '#7cb342' },
  board: { id: 'board', name: 'Vorstand', emoji: '👔', cost: 500, range: 0, support: true, limit: 1, color: '#37474f' },
};

/** Reihenfolge der Tasten 1–9. */
export const TOWER_ORDER: readonly TowerType[] = ['dualo', 'analyst', 'dev', 'ppl', 'scrum', 'rte', 'rta', 'rto', 'board'];

/** RTE „PI-Sync“: Intervall, Boost-Dauer (+ je Stufe über 1), Feuerraten-Faktor (Spec season-2). */
export const RTE_SYNC = { interval: 10, duration: 4, durationPerLevel: 0.5, factor: 1.3 } as const;
/** RTA „Architektur-Runway“: Schadensfaktor (+ je Stufe über 1), Zusatzfaktor für Tech Debt. */
export const RTA_RUNWAY = { factor: 1.25, perLevel: 0.05, debt: 2 } as const;
/** RTO „Business Value“ je Wellenende. */
export const RTO_VALUE = { base: 15, perLevel: 10 } as const;
/** Vorstand: Intervall (− je Stufe über 1), Freeze-Dauer normal/Boss. */
export const BOARD_ABILITY = { interval: 20, perLevel: 1, freeze: 2, bossFreeze: 1 } as const;

export const DUALO_ABSENT_CHANCE = 0.08;
export const DUALO_ABSENT_TIME = 2;
export const SLOW_FACTOR = 0.5;
export const PPL_BOOST = 1.25;
export const SHOT_SPEED = 520;
export const PPL_SHOT_SPEED = 320;
