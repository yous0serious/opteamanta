import type { EnemyType, GameMode, LevelId } from '../types';
import { LEVELS } from './campaigns';

// Progression (Spec campaigns): XP, Account-Level, Skillpunkte, Erfolge. Reine Funktionen – der Server rechnet
// mit demselben Bündel (supabase/functions/_shared/sim.js) nach, der Client zeigt damit die Vorschau.

export const MAX_ACCOUNT_LEVEL = 50;

/** XP-Formel je Lauf: kills × 1 + Wellen × 5 + Sterne × 40 + Erstabschluss 100 + Sieg 50. */
export const XP = { kill: 1, wave: 5, star: 40, firstClear: 100, win: 50 } as const;

/**
 * XP für einen geprüften Lauf. `result.wave` ist die erreichte Welle; gezählt werden abgeschlossene Wellen
 * (bei Sieg alle, sonst eine weniger).
 */
export function xpForRun(
  result: { kills: number; wave: number; stars: number; won?: boolean },
  opts: { firstClear: boolean; won: boolean },
): number {
  const waves = Math.max(0, opts.won ? result.wave : result.wave - 1);
  return (
    Math.max(0, result.kills) * XP.kill +
    waves * XP.wave +
    Math.max(0, Math.min(3, result.stars)) * XP.star +
    (opts.firstClear ? XP.firstClear : 0) +
    (opts.won ? XP.win : 0)
  );
}

/** Kumulativer XP-Bedarf, um Level `level` abzuschließen (Level l → l + 1): 100·l + 25·l·(l − 1). */
export function xpForLevel(level: number): number {
  const l = Math.max(0, Math.floor(level));
  return 100 * l + 25 * l * (l - 1);
}

/** Account-Level (1–50) zu einer XP-Summe; `into` = XP im aktuellen Level, `need` = XP bis zum nächsten (0 bei Max). */
export function levelForXp(xp: number): { level: number; into: number; need: number } {
  const total = Math.max(0, Math.floor(xp));
  let level = 1;
  while (level < MAX_ACCOUNT_LEVEL && total >= xpForLevel(level)) level++;
  const base = xpForLevel(level - 1);
  if (level >= MAX_ACCOUNT_LEVEL) return { level, into: total - base, need: 0 };
  return { level, into: total - base, need: xpForLevel(level) - base };
}

/** Skillpunkte insgesamt auf Account-Level `level` (1 je Level, Level 1 = 1 Punkt). */
export function skillPointsForLevel(level: number): number {
  return Math.max(1, Math.min(MAX_ACCOUNT_LEVEL, Math.floor(level)));
}

// ===================== Erfolge =====================

/** Ein geprüfter Lauf aus Sicht der Erfolge (aus runReplay/ReplayResult ableitbar). */
export interface RunRecord {
  levelId: LevelId | null;
  mode: GameMode;
  daily: boolean;
  won: boolean;
  stars: number;
  wave: number;
  kills: number;
  leaks: number;
  bestCombo: number;
  bossesDefeated: readonly EnemyType[];
  /** Summe der Skill-Ränge im Loadout. */
  skillPoints: number;
}

/** Aufsummierte Statistik eines Kontos (Grundlage der Erfolge). */
export interface AchievementStats {
  runs: number;
  wins: number;
  kills: number;
  dailyRuns: number;
  challengeWins: number;
  endlessBestWave: number;
  bestCombo: number;
  flawlessWins: number;
  bossesDefeated: EnemyType[];
  levelStars: Partial<Record<LevelId, number>>;
  maxSkillPoints: number;
  accountLevel: number;
}

export function emptyStats(): AchievementStats {
  return {
    runs: 0, wins: 0, kills: 0, dailyRuns: 0, challengeWins: 0, endlessBestWave: 0, bestCombo: 0, flawlessWins: 0,
    bossesDefeated: [], levelStars: {}, maxSkillPoints: 0, accountLevel: 1,
  };
}

/** Neue Statistik nach einem Lauf (rein, verändert `stats` nicht). */
export function addRunToStats(stats: AchievementStats, run: RunRecord): AchievementStats {
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
    challengeWins: stats.challengeWins + (run.mode === 'challenge' && run.won ? 1 : 0),
    endlessBestWave: run.mode === 'endless' ? Math.max(stats.endlessBestWave, run.wave) : stats.endlessBestWave,
    bestCombo: Math.max(stats.bestCombo, run.bestCombo),
    flawlessWins: stats.flawlessWins + (run.won && run.leaks === 0 ? 1 : 0),
    bossesDefeated: bosses,
    levelStars,
    maxSkillPoints: Math.max(stats.maxSkillPoints, run.skillPoints),
  };
}

export interface AchievementDef {
  id: string;
  name: string;
  description: string;
  /** Icon-Name (`icon/<icon>`). */
  icon: string;
  /** Fortschritt [erreicht, Ziel]; erreicht ≥ Ziel = freigeschaltet. */
  progress: (s: AchievementStats) => [done: number, of: number];
}

export interface AchievementProgress {
  id: string;
  unlocked: boolean;
  progress: [done: number, of: number];
}

const CAMPAIGN_BOSSES: readonly EnemyType[] = ['b-scope', 'b-pi', 'b-hydra', 'b-lbc'];
const levelsOf = (campaign: string): LevelId[] => LEVELS.filter((l) => l.campaign === campaign).map((l) => l.id);
const starsIn = (s: AchievementStats, ids: readonly LevelId[], min: number): number => ids.filter((id) => (s.levelStars[id] ?? 0) >= min).length;
const count = (n: number, of: number): [number, number] => [Math.min(n, of), of];

// Icon-Namen: ach-first-pi, ach-team, ach-art, ach-solution, ach-portfolio, ach-three-team, ach-three-portfolio,
// ach-all-stars, ach-flawless, ach-combo-25, ach-combo-50, ach-kills-1000, ach-kills-10000, ach-boss-first,
// ach-all-bosses, ach-daily, ach-daily-10, ach-challenge, ach-endless-40, ach-skills, ach-level-25
export const ACHIEVEMENTS: readonly AchievementDef[] = [
  { id: 'first-pi', name: 'Erstes PI', description: 'Schließe das erste Level der Team-Kampagne ab.', icon: 'ach-first-pi', progress: (s) => count(starsIn(s, ['team-1'], 1), 1) },
  { id: 'team-done', name: 'Team of Teams', description: 'Schließe alle Level der Team-Kampagne ab.', icon: 'ach-team', progress: (s) => count(starsIn(s, levelsOf('team'), 1), 6) },
  { id: 'art-done', name: 'Der Zug rollt', description: 'Schließe alle Level der ART-Kampagne ab.', icon: 'ach-art', progress: (s) => count(starsIn(s, levelsOf('art'), 1), 6) },
  { id: 'solution-done', name: 'Abhängigkeiten gezähmt', description: 'Schließe alle Level der Large-Solution-Kampagne ab.', icon: 'ach-solution', progress: (s) => count(starsIn(s, levelsOf('solution'), 1), 6) },
  { id: 'portfolio-done', name: 'Lean Portfolio', description: 'Schließe alle Level der Portfolio-Kampagne ab.', icon: 'ach-portfolio', progress: (s) => count(starsIn(s, levelsOf('portfolio'), 1), 6) },
  { id: 'three-team', name: 'Musterteam', description: '3 Sterne in allen Team-Leveln.', icon: 'ach-three-team', progress: (s) => count(starsIn(s, levelsOf('team'), 3), 6) },
  { id: 'three-portfolio', name: '3 Sterne Portfolio', description: '3 Sterne in allen Portfolio-Leveln.', icon: 'ach-three-portfolio', progress: (s) => count(starsIn(s, levelsOf('portfolio'), 3), 6) },
  { id: 'all-stars', name: 'SAFe-Vollausbau', description: '3 Sterne in allen 24 Leveln.', icon: 'ach-all-stars', progress: (s) => count(starsIn(s, LEVELS.map((l) => l.id), 3), LEVELS.length) },
  { id: 'flawless', name: 'Kein Leck', description: 'Gewinne einen Lauf, ohne dass ein Ticket durchrutscht.', icon: 'ach-flawless', progress: (s) => count(s.flawlessWins, 1) },
  { id: 'combo-25', name: 'Combo 25', description: 'Erledige 25 Tickets in Folge (je höchstens 2 s Abstand).', icon: 'ach-combo-25', progress: (s) => count(s.bestCombo, 25) },
  { id: 'combo-50', name: 'Flow-Zustand', description: 'Erledige 50 Tickets in Folge.', icon: 'ach-combo-50', progress: (s) => count(s.bestCombo, 50) },
  { id: 'kills-1000', name: 'Backlog-Bezwinger', description: 'Erledige insgesamt 1.000 Tickets.', icon: 'ach-kills-1000', progress: (s) => count(s.kills, 1000) },
  { id: 'kills-10000', name: 'Durchsatz-Legende', description: 'Erledige insgesamt 10.000 Tickets.', icon: 'ach-kills-10000', progress: (s) => count(s.kills, 10000) },
  { id: 'boss-first', name: 'Boss besiegt', description: 'Besiege einen Kampagnen-Boss.', icon: 'ach-boss-first', progress: (s) => count(s.bossesDefeated.filter((b) => CAMPAIGN_BOSSES.includes(b)).length, 1) },
  { id: 'all-bosses', name: 'Alle Bosse', description: 'Besiege alle vier Kampagnen-Bosse.', icon: 'ach-all-bosses', progress: (s) => count(s.bossesDefeated.filter((b) => CAMPAIGN_BOSSES.includes(b)).length, 4) },
  { id: 'daily', name: 'Daily Stand-up', description: 'Spiele eine Daily Challenge.', icon: 'ach-daily', progress: (s) => count(s.dailyRuns, 1) },
  { id: 'daily-10', name: 'Routine', description: 'Spiele 10 Daily Challenges.', icon: 'ach-daily-10', progress: (s) => count(s.dailyRuns, 10) },
  { id: 'challenge', name: 'Release erreicht', description: 'Gewinne eine Challenge (30 Wellen).', icon: 'ach-challenge', progress: (s) => count(s.challengeWins, 1) },
  { id: 'endless-40', name: 'Dauerbrenner', description: 'Erreiche Welle 40 im Endlos-Modus.', icon: 'ach-endless-40', progress: (s) => count(s.endlessBestWave, 40) },
  { id: 'skills', name: 'Lernende Organisation', description: 'Spiele einen Lauf mit mindestens 10 Skillpunkten.', icon: 'ach-skills', progress: (s) => count(s.maxSkillPoints, 10) },
  { id: 'level-25', name: 'SPC', description: 'Erreiche Account-Level 25.', icon: 'ach-level-25', progress: (s) => count(s.accountLevel, 25) },
];

/** Fortschritt aller Erfolge zu einer Statistik (Anzeige). */
export function achievementProgress(stats: AchievementStats): AchievementProgress[] {
  return ACHIEVEMENTS.map((a) => {
    const progress = a.progress(stats);
    return { id: a.id, unlocked: progress[0] >= progress[1], progress };
  });
}

/** IDs aller freigeschalteten Erfolge (ACHIEVEMENTS-Reihenfolge). */
export function achievementsFor(stats: AchievementStats): string[] {
  return achievementProgress(stats).filter((a) => a.unlocked).map((a) => a.id);
}
