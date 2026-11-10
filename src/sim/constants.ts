// Feste Größen der Simulation (Spec foundation-phaser-port, „Referenzwerte“).
export const TILE = 40;
export const COLS = 24;
export const ROWS = 15;
export const WIDTH = 960;
export const HEIGHT = 600;

/** Feste Tickrate (D-1). Spielgeschwindigkeit ändert nur die Ticks pro Frame. */
export const TICK_RATE = 60;
export const DT = 1 / 60;

export const START_MONEY = 200;
export const START_LIVES = 100;
export const MAX_LEVEL = 5;

/** Faktoren je Stufe als Literale statt Math.pow (engine-unabhängig exakt, ADR-0002). */
export const LEVEL_DMG = [1, 1.5, 2.25, 3.375, 5.0625] as const;
export const LEVEL_RATE = [1, 0.9, 0.81, 0.729, 0.6561] as const;

/** Grenzen für Replays: 2 h Spielzeit, 10 000 Kommandos. */
export const MAX_REPLAY_TICKS = 60 * 60 * 120;
export const MAX_REPLAY_COMMANDS = 10_000;
