import { describe, expect, it } from 'vitest';
import {
  ACHIEVEMENTS, LEVELS, MAX_ACCOUNT_LEVEL, XP, achievementProgress, achievementsFor, addRunToStats, emptyStats, levelForXp, skillPointsForLevel,
  xpForLevel, xpForRun, type RunRecord,
} from '../../src/sim/index';

// Spec campaigns „Progression“: XP-Formel, Account-Level, Skillpunkte, Erfolge.

const run = (over: Partial<RunRecord> = {}): RunRecord => ({
  levelId: 'team-1', mode: 'level', daily: false, won: true, stars: 3, wave: 8, kills: 50, leaks: 0, bestCombo: 10,
  bossesDefeated: [], skillPoints: 0, ...over,
});

describe('XP je Lauf', () => {
  it('kills × 1 + Wellen × 5 + Sterne × 40 + Erstabschluss 100 + Sieg 50', () => {
    expect(XP).toEqual({ kill: 1, wave: 5, star: 40, firstClear: 100, win: 50 });
    expect(xpForRun({ kills: 100, wave: 10, stars: 3 }, { firstClear: true, won: true })).toBe(100 + 50 + 120 + 100 + 50);
    expect(xpForRun({ kills: 100, wave: 10, stars: 2 }, { firstClear: false, won: true })).toBe(100 + 50 + 80 + 50);
  });
  it('Niederlage: nur abgeschlossene Wellen, keine Sterne/Sieg-XP', () => {
    expect(xpForRun({ kills: 37, wave: 6, stars: 0 }, { firstClear: false, won: false })).toBe(37 + 25);
    expect(xpForRun({ kills: 0, wave: 0, stars: 0 }, { firstClear: false, won: false })).toBe(0);
  });
  it('Werte werden begrenzt (negativ → 0, Sterne ≤ 3)', () => {
    expect(xpForRun({ kills: -5, wave: 1, stars: 9 }, { firstClear: false, won: true })).toBe(5 + 120 + 50);
  });
});

describe('Account-Level', () => {
  it('xpForLevel(l) = 100·l + 25·l·(l − 1) kumulativ', () => {
    expect([0, 1, 2, 3, 10, 49].map(xpForLevel)).toEqual([0, 100, 250, 450, 3250, 4900 + 58800]);
  });
  it('levelForXp: Level, XP im Level, Bedarf bis zum nächsten', () => {
    expect(levelForXp(0)).toEqual({ level: 1, into: 0, need: 100 });
    expect(levelForXp(99)).toEqual({ level: 1, into: 99, need: 100 });
    expect(levelForXp(100)).toEqual({ level: 2, into: 0, need: 150 });
    expect(levelForXp(249)).toEqual({ level: 2, into: 149, need: 150 });
    expect(levelForXp(250)).toEqual({ level: 3, into: 0, need: 200 });
    expect(levelForXp(-10)).toEqual({ level: 1, into: 0, need: 100 });
  });
  it('Höchstlevel 50, danach kein Bedarf mehr', () => {
    expect(MAX_ACCOUNT_LEVEL).toBe(50);
    const max = levelForXp(xpForLevel(49));
    expect(max).toEqual({ level: 50, into: 0, need: 0 });
    expect(levelForXp(1e9).level).toBe(50);
  });
  it('Skillpunkte: 1 je Level (1…50)', () => {
    expect([0, 1, 2, 25, 50, 99].map(skillPointsForLevel)).toEqual([1, 1, 2, 25, 50, 50]);
  });
});

describe('Erfolge', () => {
  it('21 Erfolge mit eindeutigen IDs und Icons', () => {
    expect(ACHIEVEMENTS).toHaveLength(21);
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(21);
    expect(new Set(ACHIEVEMENTS.map((a) => a.icon)).size).toBe(21);
  });
  it('leere Statistik: nichts freigeschaltet, Fortschritt 0', () => {
    expect(achievementsFor(emptyStats())).toEqual([]);
    for (const p of achievementProgress(emptyStats())) {
      expect(p.unlocked, p.id).toBe(false);
      expect(p.progress[1], p.id).toBeGreaterThan(0);
    }
  });
  it('addRunToStats ist rein und summiert', () => {
    const s0 = emptyStats();
    const s1 = addRunToStats(s0, run({ kills: 40, leaks: 2, bestCombo: 30 }));
    expect(s0).toEqual(emptyStats());
    expect(s1).toMatchObject({ runs: 1, wins: 1, kills: 40, bestCombo: 30, flawlessWins: 0, levelStars: { 'team-1': 3 } });
    const s2 = addRunToStats(s1, run({ stars: 1, kills: 10, bestCombo: 5 }));
    expect(s2).toMatchObject({ runs: 2, wins: 2, kills: 50, bestCombo: 30, flawlessWins: 1, levelStars: { 'team-1': 3 } });
    const s3 = addRunToStats(s2, run({ won: false, stars: 0, levelId: 'team-2' }));
    expect(s3.levelStars).toEqual({ 'team-1': 3 });
  });
  it('erstes Level, Kein Leck, Combo 25', () => {
    const s = addRunToStats(emptyStats(), run({ bestCombo: 25 }));
    expect(achievementsFor(s)).toEqual(['first-pi', 'flawless', 'combo-25']);
  });
  it('Bosse: erster und alle vier (Mega-Objective zählt nicht)', () => {
    let s = addRunToStats(emptyStats(), run({ levelId: null, mode: 'challenge', won: false, stars: 0, bossesDefeated: ['boss'] }));
    expect(achievementsFor(s)).not.toContain('boss-first');
    s = addRunToStats(s, run({ levelId: 'team-6', bossesDefeated: ['b-scope'] }));
    expect(achievementsFor(s)).toContain('boss-first');
    expect(achievementsFor(s)).not.toContain('all-bosses');
    s = addRunToStats(s, run({ levelId: 'art-6', bossesDefeated: ['b-pi', 'b-scope'] }));
    s = addRunToStats(s, run({ levelId: 'solution-6', bossesDefeated: ['b-hydra'] }));
    s = addRunToStats(s, run({ levelId: 'portfolio-6', bossesDefeated: ['b-lbc'] }));
    expect(s.bossesDefeated).toEqual(['boss', 'b-scope', 'b-pi', 'b-hydra', 'b-lbc']);
    expect(achievementsFor(s)).toContain('all-bosses');
  });
  it('Kampagnen und Sterne', () => {
    let s = emptyStats();
    for (const l of LEVELS.filter((x) => x.campaign === 'team')) s = addRunToStats(s, run({ levelId: l.id, stars: 3 }));
    expect(achievementsFor(s)).toEqual(expect.arrayContaining(['team-done', 'three-team']));
    expect(achievementsFor(s)).not.toContain('art-done');
    for (const l of LEVELS) s = addRunToStats(s, run({ levelId: l.id, stars: 3 }));
    expect(achievementsFor(s)).toEqual(expect.arrayContaining(['art-done', 'solution-done', 'portfolio-done', 'three-portfolio', 'all-stars']));
    expect(achievementProgress(s).find((p) => p.id === 'all-stars')!.progress).toEqual([24, 24]);
  });
  it('Daily, Challenge, Endlos, Skills, Account-Level', () => {
    let s = emptyStats();
    for (let i = 0; i < 10; i++) s = addRunToStats(s, run({ levelId: null, mode: 'challenge', daily: true, won: i === 0, stars: i === 0 ? 2 : 0 }));
    s = addRunToStats(s, run({ levelId: null, mode: 'endless', won: false, stars: 0, wave: 40, skillPoints: 10 }));
    s = { ...s, accountLevel: 25 };
    expect(achievementsFor(s)).toEqual(expect.arrayContaining(['daily', 'daily-10', 'challenge', 'endless-40', 'skills', 'level-25']));
    expect(s.endlessBestWave).toBe(40);
    expect(s.challengeWins).toBe(1);
  });
  it('Fortschritt wird beim Ziel gedeckelt', () => {
    const s = { ...emptyStats(), kills: 123456 };
    expect(achievementProgress(s).find((p) => p.id === 'kills-1000')!.progress).toEqual([1000, 1000]);
  });
});
