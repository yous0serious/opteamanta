// Balancing v0.2.0 (Spec balancing-challenge). Alle Stellschrauben an einer Stelle.
// Jede Änderung hier erhöht GAME_VERSION (src/sim/version.ts) – alte Replays werden damit ungültig.

export interface BalanceConfig {
  /** HP-Faktor pro Welle (exponentiell): hpScale(w) = hpGrowth^(w−1), per Schleife berechnet. */
  hpGrowth: number;
  /** Kill-Belohnung: round(Grundbelohnung × rewardFactor × (1 + rewardGrowth × (w−1))). */
  rewardFactor: number;
  rewardGrowth: number;
  /** Bonus nach jeder abgeschlossenen Welle: waveBonusBase + waveBonusPerWave × w. */
  waveBonusBase: number;
  waveBonusPerWave: number;
  /** Gegner pro Welle: waveSizeBase + waveSizePerWave × w (Boss kommt bei PIP-Wellen zusätzlich). */
  waveSizeBase: number;
  waveSizePerWave: number;
  /** Zusätzlicher HP-Faktor nur für den Boss. */
  bossHpFactor: number;
  /** Kapazität zu Spielbeginn. */
  startMoney: number;
}

// Werte per Bot-Tuning ermittelt (npm run balance, 2026-11-10; Spec balancing-challenge „Referenzwerte v0.2.0“).
export const BALANCE: Readonly<BalanceConfig> = {
  hpGrowth: 1.115,
  rewardFactor: 0.25,
  rewardGrowth: 0,
  waveBonusBase: 40,
  waveBonusPerWave: 5,
  waveSizeBase: 8,
  waveSizePerWave: 2,
  bossHpFactor: 2.6,
  startMoney: 300,
};

/** hpGrowth^(w−1) per Multiplikationsschleife (ADR-0002: kein Math.pow in src/sim). */
export function hpScaleForWave(cfg: Readonly<BalanceConfig>, wave: number): number {
  let f = 1;
  for (let i = 1; i < wave; i++) f *= cfg.hpGrowth;
  return f;
}

export function rewardForWave(cfg: Readonly<BalanceConfig>, baseReward: number, wave: number): number {
  return Math.round(baseReward * cfg.rewardFactor * (1 + cfg.rewardGrowth * (Math.max(1, wave) - 1)));
}
