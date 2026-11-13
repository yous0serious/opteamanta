import type { Branch, BranchDef, TargetMode, TowerDef, TowerType } from '../types';

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

/** Zielmodi in Anzeige-Reihenfolge (Spec campaigns). */
export const TARGET_MODES: readonly TargetMode[] = ['first', 'last', 'strong', 'near'];
export const TARGET_MODE_NAMES: Readonly<Record<TargetMode, string>> = {
  first: 'Vorderster',
  last: 'Hinterster',
  strong: 'Stärkster',
  near: 'Nächster',
};

/** Stufe, ab der ein Zweig gewählt wird (Schritt 2 → 3). */
export const BRANCH_LEVEL = 3;
/** Verlangsamung im Umkreis (Scrum Master „Agile Coach“): Dauer in Sekunden. */
export const SLOW_AREA_TIME = 1.2;
/** RTO „Budget-Hüter“: Zinsen höchstens so viele SP je Welle. */
export const RTO_INTEREST_CAP = 60;

/** Upgrade-Zweige je Rolle (Stufe 3–5, Spec campaigns). Werte sind Faktoren auf die Stufenwerte. */
export const BRANCHES: Readonly<Record<TowerType, Readonly<Record<Branch, BranchDef>>>> = {
  dualo: {
    a: { id: 'a', name: 'Werkstudent:in', description: 'Immer da: fällt nie aus, +15 % Schaden.', reliable: true, damage: 1.15 },
    b: { id: 'b', name: 'Hackathon-Held', description: 'Abklingzeit −30 %, −10 % Reichweite.', rate: 0.7, range: 0.9 },
  },
  analyst: {
    a: { id: 'a', name: 'Requirements Engineer', description: 'Verlangsamung hält 60 % länger.', slow: 1.6 },
    b: { id: 'b', name: 'Data Analyst', description: 'Doppelter Schaden, +10 % Reichweite.', damage: 2.2, range: 1.1 },
  },
  dev: {
    a: { id: 'a', name: 'Full-Stack', description: '+25 % Reichweite.', range: 1.25 },
    b: { id: 'b', name: '10x-Dev', description: '+40 % Schaden pro Sekunde.', damage: 1.4 },
  },
  ppl: {
    a: { id: 'a', name: 'Portfolio-Stratege', description: '+30 % Splash-Radius, +10 % Schaden.', splash: 1.3, damage: 1.1 },
    b: { id: 'b', name: 'Product Owner', description: 'Aura +25 % Radius, Teamboost ×1,4 statt ×1,25.', aura: 1.25, boost: 1.4 },
  },
  scrum: {
    a: { id: 'a', name: 'Coach', description: '+40 % Rückstoß.', push: 1.4 },
    b: { id: 'b', name: 'Agile Coach', description: 'Treffer verlangsamen alle Gegner im Umkreis von 80 px.', slowArea: 80 },
  },
  rte: {
    a: { id: 'a', name: 'Taktgeber', description: 'PI-Sync 25 % häufiger.', interval: 0.75 },
    b: { id: 'b', name: 'Brückenbauer', description: '+30 % Reichweite, PI-Sync 1 s länger.', range: 1.3, duration: 1 },
  },
  rta: {
    a: { id: 'a', name: 'Enterprise-Architekt', description: 'Runway-Schaden +15 Prozentpunkte.', runway: 0.15 },
    b: { id: 'b', name: 'Systemarchitekt', description: '+30 % Reichweite (Runway und Entdeckung).', range: 1.3 },
  },
  rto: {
    a: { id: 'a', name: 'Value Stream', description: 'Business Value ×1,5.', value: 1.5 },
    b: { id: 'b', name: 'Budget-Hüter', description: '4 % Zinsen auf die Kapazität je Welle (max. 60 SP).', interest: 4 },
  },
  board: {
    a: { id: 'a', name: 'Aufsichtsrat', description: 'Budget-Freeze hält 50 % länger.', freeze: 1.5 },
    b: { id: 'b', name: 'CFO-Fokus', description: 'Fähigkeiten 20 % häufiger.', interval: 0.8 },
  },
};