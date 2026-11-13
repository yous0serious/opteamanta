import { describe, expect, it } from 'vitest';
import { CAMPAIGNS, Game, LEVELS, MAPS, SKILLS, emptyStats, levelForXp, xpForLevel, type ReplayResult } from '../../src/sim/index';
import {
  availablePoints, boardSeed, changeSkill, creditFor, creditedXp, levelUnlocked, loadoutError, newAchievements, parseStartRequest, planRun,
  runRecord,
} from '../../supabase/functions/_shared/logic';

// Spec campaigns AC-5: Start-Anfragen, Freischaltung, Skill-Prüfung, XP-Gutschrift, Erfolge (mit den Regeln der Sim).

const result = (r: Partial<ReplayResult> = {}): ReplayResult => ({
  score: 1000, wave: 6, lives: 80, over: true, won: true, kills: 120, stars: 2, leaks: 1, ...r,
});

describe('parseStartRequest', () => {
  const level = LEVELS[0]!.id;
  const map = MAPS[0]!.id;
  it.each([
    [{}, { kind: 'daily' }],
    [null, { kind: 'daily' }],
    [{ kind: 'daily' }, { kind: 'daily' }],
    [{ kind: 'level', levelId: level }, { kind: 'level', levelId: level }],
    [{ kind: 'map', mapId: map }, { kind: 'map', mapId: map }],
  ])('gültig: %j', (body, req) => {
    expect(parseStartRequest(body)).toEqual(req);
  });
  it.each([
    [[], 'request_invalid'],
    ['daily', 'request_invalid'],
    [{ kind: 'endless' }, 'kind_invalid'],
    [{ kind: 'level' }, 'level_unknown'],
    [{ kind: 'level', levelId: 'team-99' }, 'level_unknown'],
    [{ kind: 'level', levelId: '__proto__' }, 'level_unknown'],
    [{ kind: 'map', mapId: 'nirgendwo' }, 'map_unknown'],
    [{ kind: 'map', mapId: 7 }, 'map_unknown'],
  ])('ungültig: %j → %s', (body, error) => {
    expect(parseStartRequest(body)).toEqual({ error });
  });
});

describe('planRun', () => {
  it('Daily: Tages-Seed, Karte aus dem Seed, Challenge', async () => {
    const a = await planRun({ kind: 'daily' }, '2026-11-12', 'geheim');
    const b = await planRun({ kind: 'daily' }, '2026-11-12', 'geheim');
    expect(a).toEqual(b);
    expect(a).toMatchObject({ kind: 'daily', board: 'daily:2026-11-12', mode: 'challenge', levelId: null });
  });
  it('Level: Karte und Modus aus den Level-Daten, Wochen-Seed des Boards', async () => {
    const lv = LEVELS[3]!;
    const p = await planRun({ kind: 'level', levelId: lv.id }, '2026-11-12', 'geheim');
    const seed = await boardSeed('geheim', `level:${lv.id}`, '2026-W46');
    expect(p).toEqual({ kind: 'level', board: `level:${lv.id}`, seed, mapId: lv.mapId, mode: 'level', levelId: lv.id });
    expect((await planRun({ kind: 'level', levelId: lv.id }, '2026-11-15', 'geheim')).seed).toBe(seed);
    expect((await planRun({ kind: 'level', levelId: lv.id }, '2026-11-16', 'geheim')).seed).not.toBe(seed);
  });
  it('Karte: Challenge auf der gewählten Karte, Wochen-Seed des Boards', async () => {
    const m = MAPS[1]!.id;
    const p = await planRun({ kind: 'map', mapId: m }, '2026-11-12', 'geheim');
    expect(p).toEqual({ kind: 'map', board: `map:${m}`, seed: await boardSeed('geheim', `map:${m}`, '2026-W46'), mapId: m, mode: 'challenge', levelId: null });
    expect(new Game({ seed: p.seed, mapId: m, mode: 'challenge' }).state.mapId).toBe(m);
  });
});

describe('levelUnlocked (echte Kampagnen)', () => {
  const [c1, c2] = [CAMPAIGNS[0]!, CAMPAIGNS[1]!];
  it('Start offen, Rest gesperrt', () => {
    expect(levelUnlocked(c1.levels[0]!, {})).toBe(true);
    expect(levelUnlocked(c1.levels[1]!, {})).toBe(false);
    expect(levelUnlocked(c2.levels[0]!, {})).toBe(false);
  });
  it('Kampagne 2 nach dem Boss-Level von Kampagne 1', () => {
    expect(levelUnlocked(c2.levels[0]!, { [c1.levels.at(-1)!]: 1 })).toBe(true);
  });
});

describe('XP und Account-Level (Formel der Spec)', () => {
  it('xpForLevel(l) = 100·l + 25·l·(l − 1), kumulativ', () => {
    for (let l = 1; l <= 50; l++) expect(xpForLevel(l)).toBe(100 * l + 25 * l * (l - 1));
  });
  it('1 Skillpunkt je Account-Level, Level 1 = 1 Punkt, max. 50', () => {
    expect(availablePoints(0)).toBe(1);
    expect(availablePoints(xpForLevel(1) - 1)).toBe(1);
    expect(availablePoints(xpForLevel(1))).toBe(2);
    expect(availablePoints(xpForLevel(10))).toBe(levelForXp(xpForLevel(10)).level);
    expect(availablePoints(10_000_000)).toBe(50);
    expect(availablePoints(-5)).toBe(1);
  });
  it('Gutschrift: kills + Wellen × 5 + Sterne × 40 + Sieg 50; Erstabschluss-Bonus 100 nur für Level', () => {
    const r = result();
    const level = creditFor(r, 'level');
    expect(level.xp).toBe(120 + 6 * 5 + 2 * 40 + 50);
    expect(level.firstClearBonus).toBe(100);
    expect(creditedXp(level, true)).toBe(level.xp + 100);
    expect(creditedXp(level, false)).toBe(level.xp);
    expect(creditFor(r, 'daily')).toEqual({ xp: level.xp, firstClearBonus: 0 });
    expect(creditFor(r, 'map').firstClearBonus).toBe(0);
  });
  it('verlorener Lauf: keine Sieg-XP, letzte Welle zählt nicht', () => {
    expect(creditFor(result({ won: false, stars: 0, wave: 4, kills: 10 }), 'level').xp).toBe(10 + 3 * 5);
  });
});

describe('Skill-Zuteilung (Regeln der Sim)', () => {
  const root = SKILLS.find((s) => s.requires.length === 0)!;
  const child = SKILLS.find((s) => s.requires.length > 0)!;
  const parent = child.requires[0]!;
  const rich = xpForLevel(20);

  it('erster Rang mit Startpunkt', () => {
    expect(changeSkill({}, root.id, 1, 0)).toEqual({ ok: true, loadout: { [root.id]: 1 }, points: 1 });
  });
  it('mehr Ränge als Punkte → no_points', () => {
    expect(changeSkill({}, root.id, 2, 0)).toMatchObject({ ok: false, reason: 'no_points' });
  });
  it('Voraussetzung fehlt → locked', () => {
    expect(changeSkill({}, child.id, 1, rich)).toMatchObject({ ok: false, reason: 'locked' });
    expect(changeSkill({ [parent]: 1 }, child.id, 1, rich)).toMatchObject({ ok: true });
  });
  it('Voraussetzung entfernen, solange abhängiger Skill gelernt ist → locked', () => {
    expect(changeSkill({ [parent]: 1, [child.id]: 1 }, parent, 0, rich)).toMatchObject({ ok: false, reason: 'locked' });
  });
  it('Rang 0 entfernt den Skill', () => {
    expect(changeSkill({ [root.id]: 1 }, root.id, 0, rich)).toMatchObject({ ok: true, loadout: {} });
  });
  it.each([
    ['unbekannter Skill', 'gibt-es-nicht', 1],
    ['über Höchstrang', root.id, root.maxRank + 1],
    ['negativer Rang', root.id, -1],
    ['Bruch', root.id, 1.5],
    ['kein String', 42, 1],
  ])('%s → invalid', (_n, id, rank) => {
    expect(changeSkill({}, id, rank, rich)).toMatchObject({ ok: false, reason: 'invalid' });
  });
  it('loadoutError (start-run): gültig, zu viele Punkte, Voraussetzung', () => {
    expect(loadoutError({}, 0)).toBeNull();
    expect(loadoutError({ [root.id]: 1 }, 0)).toBeNull();
    expect(loadoutError({ [root.id]: 2 }, 0)).toBe('points');
    expect(loadoutError({ [child.id]: 1 }, rich)).toMatch(/^requires:/);
  });
});

describe('Erfolge (Statistik + Lauf, Regeln der Sim)', () => {
  const first = CAMPAIGNS[0]!.levels[0]!;
  const run = (r: Partial<ReplayResult> & { bestCombo?: number } = {}, kind: 'daily' | 'level' | 'map' = 'level') =>
    runRecord({ kind, levelId: kind === 'level' ? first : null, mode: kind === 'level' ? 'level' : 'challenge', loadout: { a: 1 } }, { ...result(r), bestCombo: r.bestCombo ?? 0 });

  it('Erstes PI, Kein Leck und Combo aus dem geprüften Lauf', () => {
    const ids = newAchievements(emptyStats(), run({ leaks: 0, bestCombo: 30 }), 0, []);
    expect(ids).toEqual(expect.arrayContaining(['first-pi', 'flawless', 'combo-25']));
    expect(ids).not.toContain('combo-50');
  });
  it('bereits freigeschaltete Erfolge kommen nicht erneut', () => {
    expect(newAchievements(emptyStats(), run({ leaks: 0 }), 0, ['first-pi', 'flawless'])).not.toEqual(expect.arrayContaining(['first-pi']));
  });
  it('verlorener Lauf schaltet kein Level-Erfolg frei', () => {
    expect(newAchievements(emptyStats(), run({ won: false, stars: 0 }), 0, [])).not.toContain('first-pi');
  });
  it('Statistik aus der DB zählt mit (Kills über alle Läufe, Daily)', () => {
    const db = { ...emptyStats(), kills: 990, dailyRuns: 9 };
    const ids = newAchievements(db, run({ kills: 10 }, 'daily'), 0, []);
    expect(ids).toEqual(expect.arrayContaining(['kills-1000', 'daily-10']));
  });
  it('Account-Level aus den XP nach der Gutschrift', () => {
    expect(newAchievements(emptyStats(), run(), xpForLevel(24), [])).toContain('level-25');
    expect(newAchievements(emptyStats(), run(), xpForLevel(24) - 1, [])).not.toContain('level-25');
  });
  it('Skillpunkte des Laufs zählen aus dem Loadout', () => {
    expect(runRecord({ kind: 'map', levelId: null, mode: 'challenge', loadout: { a: 3, b: 2, c: 0 } }, result()).skillPoints).toBe(5);
  });
});
