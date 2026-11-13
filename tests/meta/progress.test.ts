import { describe, expect, it } from 'vitest';
import { applyLocalRun, campaignProgress, emptyLocal, levelUnlocked, nextPlayable } from '../../src/meta/progress';
import type { RunRecord } from '../../src/sim/index';

const run = (o: Partial<RunRecord>): RunRecord => ({
  levelId: 'team-1', mode: 'level', daily: false, won: true, stars: 2, wave: 8, kills: 50, leaks: 1, bestCombo: 5, bossesDefeated: [], skillPoints: 0, ...o,
});

describe('Freischaltung (gleiche Regel wie der Server)', () => {
  it('erstes Level offen, weitere nach ≥ 1 Stern, nächste Kampagne nach dem letzten Level', () => {
    expect(levelUnlocked('team-1', {})).toBe(true);
    expect(levelUnlocked('team-2', {})).toBe(false);
    expect(levelUnlocked('team-2', { 'team-1': 1 })).toBe(true);
    expect(levelUnlocked('art-1', { 'team-5': 3 })).toBe(false);
    expect(levelUnlocked('art-1', { 'team-6': 1 })).toBe(true);
    expect(levelUnlocked('unbekannt', {})).toBe(false);
  });

  it('Kampagnen-Übersicht und „Weiterspielen“', () => {
    const best = { 'team-1': 3, 'team-2': 1 };
    const c = campaignProgress(best, { 'team-1': 1200 });
    expect(c[0]!.unlocked).toBe(true);
    expect(c[1]!.unlocked).toBe(false);
    expect(c[0]!.levels.map((l) => l.unlocked)).toEqual([true, true, true, false, false, false]);
    expect(c[0]!.levels[0]).toMatchObject({ bestStars: 3, bestScore: 1200 });
    expect(nextPlayable(best)).toBe('team-3');
    expect(nextPlayable({})).toBe('team-1');
  });
});

describe('lokale Wertung (offline)', () => {
  it('XP mit Erstabschluss nur einmal, beste Sterne bleiben, Level-Up wird gemeldet', () => {
    const first = applyLocalRun(emptyLocal(), run({}), 900);
    // 50 Kills + 8 Wellen × 5 + 2 Sterne × 40 + Erstabschluss 100 + Sieg 50
    expect(first.xpGained).toBe(50 + 40 + 80 + 100 + 50);
    expect(first.levelUp).toEqual({ from: 1, to: 3 });
    expect(first.progress.best['team-1']).toBe(2);
    expect(first.newAchievements).toContain('first-pi');

    const again = applyLocalRun(first.progress, run({ stars: 1 }), 500);
    expect(again.xpGained).toBe(50 + 40 + 40 + 50);
    expect(again.progress.best['team-1']).toBe(2);
    expect(again.progress.scores['team-1']).toBe(900);
    expect(again.newAchievements).not.toContain('first-pi');
  });

  it('Niederlage schaltet nichts frei', () => {
    const out = applyLocalRun(emptyLocal(), run({ won: false, stars: 0 }), 100);
    expect(out.progress.best['team-1']).toBeUndefined();
    expect(levelUnlocked('team-2', out.progress.best)).toBe(false);
  });
});
