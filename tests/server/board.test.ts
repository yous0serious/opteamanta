import { describe, expect, it } from 'vitest';
import {
  boardId, isFirstClear, levelUnlocked, loadoutFromRows, mergeLevelBest, normalizeLoadout, parseBoardId, sameLoadout, spentPoints,
  type CampaignOrder,
} from '../../supabase/functions/_shared/logic';

// Spec campaigns AC-5 (Server-Logik ohne Sim-Regeln und ohne Datenbank).

describe('parseBoardId', () => {
  it.each([
    ['daily:2026-11-12', { kind: 'daily', key: '2026-11-12' }],
    ['level:team-1', { kind: 'level', key: 'team-1' }],
    ['map:release-train', { kind: 'map', key: 'release-train' }],
  ])('gültig: %s', (id, ref) => {
    expect(parseBoardId(id)).toEqual(ref);
    expect(boardId(ref.kind as 'daily', ref.key)).toBe(id);
  });
  it.each([
    'daily:2026-13-01', 'daily:2026-02-30', 'daily:heute', 'level:', 'level:Team 1', 'map:../x', 'map:' + 'a'.repeat(33),
    'season:2026', 'team-1', '', 42, null,
  ])('ungültig: %s', (id) => {
    expect(parseBoardId(id)).toBeNull();
  });
});

describe('Loadout', () => {
  it('normalisiert: Rang 0 entfällt, Schlüssel sortiert', () => {
    expect(normalizeLoadout({ b: 2, a: 1, c: 0 })).toEqual({ a: 1, b: 2 });
    expect(Object.keys(normalizeLoadout({ z: 1, a: 1 })!)).toEqual(['a', 'z']);
    expect(normalizeLoadout({})).toEqual({});
  });
  it.each([
    ['kein Objekt', 'x'], ['Array', [1]], ['null', null], ['negativ', { a: -1 }], ['Bruch', { a: 1.5 }], ['zu hoch', { a: 11 }],
    ['String-Rang', { a: '1' }], ['ungültiger Schlüssel', { 'a b': 1 }], ['__proto__', JSON.parse('{"__proto__": 1}')],
    ['Ziffer am Anfang', { '1a': 1 }],
  ])('ungültig: %s', (_n, raw) => {
    expect(normalizeLoadout(raw)).toBeNull();
  });
  it('Gleichheit unabhängig von Reihenfolge und Rang 0', () => {
    expect(sameLoadout({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true);
    expect(sameLoadout({ a: 1, b: 0 }, { a: 1 })).toBe(true);
    expect(sameLoadout({}, {})).toBe(true);
  });
  it('fremdes Loadout wird erkannt', () => {
    expect(sameLoadout({ a: 1 }, { a: 2 })).toBe(false);
    expect(sameLoadout({ a: 1 }, { a: 1, b: 1 })).toBe(false);
    expect(sameLoadout({ a: 1 }, {})).toBe(false);
    expect(sameLoadout({ a: 1 }, null)).toBe(false);
    expect(sameLoadout(undefined, {})).toBe(false);
  });
  it('DB-Zeilen → Loadout, Punkte', () => {
    const l = loadoutFromRows([{ skill_id: 'b', rank: 2 }, { skill_id: 'a', rank: 1 }]);
    expect(l).toEqual({ a: 1, b: 2 });
    expect(Object.keys(l)).toEqual(['a', 'b']);
    expect(loadoutFromRows(null)).toEqual({});
    expect(spentPoints(l)).toBe(3);
  });
});

describe('levelUnlocked', () => {
  const campaigns: CampaignOrder[] = [{ levels: ['a-1', 'a-2', 'a-3'] }, { levels: ['b-1', 'b-2'] }];
  it('erstes Level der ersten Kampagne ist offen', () => {
    expect(levelUnlocked('a-1', {}, campaigns)).toBe(true);
  });
  it('nächstes Level nach ≥ 1 Stern im vorigen', () => {
    expect(levelUnlocked('a-2', {}, campaigns)).toBe(false);
    expect(levelUnlocked('a-2', { 'a-1': 0 }, campaigns)).toBe(false);
    expect(levelUnlocked('a-2', { 'a-1': 1 }, campaigns)).toBe(true);
    expect(levelUnlocked('a-3', { 'a-1': 3 }, campaigns)).toBe(false);
  });
  it('nächste Kampagne nach dem Boss-Level (letztes Level) der vorigen', () => {
    expect(levelUnlocked('b-1', { 'a-1': 3, 'a-2': 3 }, campaigns)).toBe(false);
    expect(levelUnlocked('b-1', { 'a-3': 1 }, campaigns)).toBe(true);
  });
  it('unbekanntes Level ist gesperrt', () => {
    expect(levelUnlocked('x-1', { 'a-3': 3 }, campaigns)).toBe(false);
  });
});

describe('Level-Bestwerte und Erstabschluss (wie finish_run)', () => {
  it('Sterne und Score sind unabhängig voneinander maximal', () => {
    expect(mergeLevelBest(null, 2, 500)).toEqual({ best_stars: 2, best_score: 500 });
    expect(mergeLevelBest({ best_stars: 3, best_score: 400 }, 1, 900)).toEqual({ best_stars: 3, best_score: 900 });
    expect(mergeLevelBest({ best_stars: 1, best_score: 900 }, 2, 100)).toEqual({ best_stars: 2, best_score: 900 });
    expect(mergeLevelBest({ best_stars: 0, best_score: null }, 0, 10)).toEqual({ best_stars: 0, best_score: 10 });
  });
  it('Erstabschluss nur beim ersten Lauf mit ≥ 1 Stern', () => {
    expect(isFirstClear(undefined, 1)).toBe(true);
    expect(isFirstClear(null, 3)).toBe(true);
    expect(isFirstClear(0, 2)).toBe(true);
    expect(isFirstClear(undefined, 0)).toBe(false);
    expect(isFirstClear(1, 3)).toBe(false);
    expect(isFirstClear(3, 3)).toBe(false);
  });
});
