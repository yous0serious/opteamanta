import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { GAME_VERSION, Game, MAPS, type LevelId, type SkillLoadout } from '../../src/sim/index';
import {
  MAX_TICKS_RANKED, berlinDate, boardSeed, checkSubmission, dailySeed, isoWeek, isoWeekRange, mapForSeed, replayHash, type SessionRow,
} from '../../supabase/functions/_shared/logic';

// Spec leaderboard-supabase AC-2/AC-3, Spec campaigns AC-5 (Server-Logik ohne Datenbank).

describe('berlinDate', () => {
  it('wechselt um Mitternacht Berlin (Winterzeit, UTC+1)', () => {
    expect(berlinDate(new Date('2026-11-10T22:59:00Z'))).toBe('2026-11-10');
    expect(berlinDate(new Date('2026-11-10T23:00:00Z'))).toBe('2026-11-11');
  });
  it('wechselt um Mitternacht Berlin (Sommerzeit, UTC+2)', () => {
    expect(berlinDate(new Date('2026-07-01T21:59:00Z'))).toBe('2026-07-01');
    expect(berlinDate(new Date('2026-07-01T22:00:00Z'))).toBe('2026-07-02');
  });
  it('Tag der Zeitumstellung', () => {
    expect(berlinDate(new Date('2026-03-29T00:30:00Z'))).toBe('2026-03-29');
  });
});

describe('isoWeekRange', () => {
  it('Montag bis Sonntag', () => {
    expect(isoWeekRange('2026-11-10')).toEqual({ from: '2026-11-09', to: '2026-11-15' });
    expect(isoWeekRange('2026-11-15')).toEqual({ from: '2026-11-09', to: '2026-11-15' });
    expect(isoWeekRange('2026-11-16')).toEqual({ from: '2026-11-16', to: '2026-11-22' });
  });
});

describe('isoWeek', () => {
  it.each([
    ['2026-11-09', '2026-W46'], // Montag
    ['2026-11-15', '2026-W46'], // Sonntag
    ['2026-11-16', '2026-W47'],
    ['2026-01-01', '2026-W01'], // Donnerstag
    ['2027-01-01', '2026-W53'], // Freitag → letzte Woche des Vorjahres
    ['2024-12-30', '2025-W01'], // Montag → erste Woche des Folgejahres
  ])('%s → %s', (date, week) => {
    expect(isoWeek(date)).toBe(week);
  });
  it('Wechsel Montag 00:00 Berlin (über berlinDate)', () => {
    expect(isoWeek(berlinDate(new Date('2026-11-15T22:59:59Z')))).toBe('2026-W46'); // So 23:59:59 Berlin
    expect(isoWeek(berlinDate(new Date('2026-11-15T23:00:00Z')))).toBe('2026-W47'); // Mo 00:00 Berlin
    expect(isoWeek(berlinDate(new Date('2026-06-14T21:59:59Z')))).toBe('2026-W24'); // Sommerzeit
    expect(isoWeek(berlinDate(new Date('2026-06-14T22:00:00Z')))).toBe('2026-W25');
  });
});

describe('boardSeed', () => {
  it('gleiches Board + Woche → gleicher Seed; andere Woche/Board/Geheimnis → anders; uint32; ≠ Daily', async () => {
    const a = await boardSeed('geheim', 'level:team-1', '2026-W46');
    expect(await boardSeed('geheim', 'level:team-1', '2026-W46')).toBe(a);
    expect(await boardSeed('geheim', 'level:team-1', '2026-W47')).not.toBe(a);
    expect(await boardSeed('geheim', 'level:team-2', '2026-W46')).not.toBe(a);
    expect(await boardSeed('geheim', 'map:waterfall', '2026-W46')).not.toBe(a);
    expect(await boardSeed('anderes', 'level:team-1', '2026-W46')).not.toBe(a);
    expect(Number.isInteger(a) && a >= 0 && a <= 0xffffffff).toBe(true);
  });
});

describe('dailySeed', () => {
  it('Wert unverändert gegenüber der bisherigen Daily-Ableitung (HMAC über daily:<date>)', async () => {
    const key = createHmac('sha256', 'geheim').update('daily:2026-11-10').digest();
    expect(await dailySeed('geheim', '2026-11-10')).toBe(key.readUInt32BE(0));
  });
  it('gleicher Tag + Geheimnis → gleicher Seed; sonst anders; uint32', async () => {
    const a = await dailySeed('geheim', '2026-11-10');
    expect(await dailySeed('geheim', '2026-11-10')).toBe(a);
    expect(await dailySeed('geheim', '2026-11-11')).not.toBe(a);
    expect(await dailySeed('anderes', '2026-11-10')).not.toBe(a);
    expect(Number.isInteger(a) && a >= 0 && a <= 0xffffffff).toBe(true);
  });
  it('Karte folgt aus dem Seed wie im Spiel', () => {
    expect(MAPS.map((m) => m.id)).toContain(mapForSeed(123));
    expect(mapForSeed(123)).toBe(new Game({ seed: 123 }).state.mapId);
  });
});

/** Kurzer Lauf (10 s Spielzeit) und passende Session. */
function fixture(opts: { seed: number; levelId?: LevelId; loadout?: SkillLoadout; kind?: 'daily' | 'level' | 'map' }) {
  const game = new Game({ seed: opts.seed, mode: opts.levelId ? 'level' : 'challenge', levelId: opts.levelId ?? null, loadout: opts.loadout ?? {} });
  game.apply({ type: 'startWave' });
  for (let i = 0; i < 600; i++) game.step();
  const replay = game.toReplay();
  const issued = new Date('2026-11-10T12:00:00Z');
  const kind = opts.kind ?? (opts.levelId ? 'level' : 'daily');
  const session: SessionRow = {
    id: 's1', user_id: 'u1', daily_date: '2026-11-10', seed: opts.seed, map_id: replay.mapId, mode: replay.mode, game_version: GAME_VERSION,
    issued_at: issued.toISOString(), expires_at: new Date(issued.getTime() + 3 * 3600_000).toISOString(), used_at: null,
    kind, level_id: opts.levelId ?? null, board: opts.levelId ? `level:${opts.levelId}` : `daily:2026-11-10`, loadout: opts.loadout ?? {},
  };
  return { replay, session, issued, later: new Date(issued.getTime() + 60_000) };
}

describe('checkSubmission (Daily)', () => {
  const { replay, session, issued, later } = fixture({ seed: 4242 });
  const mapId = session.map_id;

  it('gültige Einreichung', () => {
    expect(checkSubmission(session, 'u1', replay, later).ok).toBe(true);
  });
  it('alte Session ohne kind/level/loadout gilt als Daily mit leerem Loadout', () => {
    const legacy: SessionRow = { ...session, kind: undefined, level_id: undefined, board: undefined, loadout: undefined };
    expect(checkSubmission(legacy, 'u1', replay, later).ok).toBe(true);
  });
  it.each([
    ['fremde Session', null, 'u1', replay, later, 403, 'session_unknown'],
    ['anderer Nutzer', session, 'u2', replay, later, 403, 'session_unknown'],
    ['benutzt', { ...session, used_at: later.toISOString() }, 'u1', replay, later, 409, 'session_used'],
    ['abgelaufen', session, 'u1', replay, new Date(issued.getTime() + 3 * 3600_000 + 1), 410, 'session_expired'],
    ['falscher Seed', session, 'u1', { ...replay, seed: replay.seed + 1 }, later, 422, 'seed_mismatch'],
    ['falsche Karte', session, 'u1', { ...replay, mapId: MAPS.find((m) => m.id !== mapId)!.id }, later, 422, 'map_mismatch'],
    ['falscher Modus', session, 'u1', { ...replay, mode: 'endless' }, later, 422, 'mode_mismatch'],
    ['Level statt Daily', session, 'u1', { ...replay, levelId: 'team-1' }, later, 422, 'level_mismatch'],
    ['falsche Version', session, 'u1', { ...replay, gameVersion: '0.3.0' }, later, 422, 'version_mismatch'],
    ['Session alter Version', { ...session, game_version: '0.3.0' }, 'u1', { ...replay, gameVersion: '0.3.0' }, later, 422, 'version_mismatch'],
    ['fremdes Loadout', session, 'u1', { ...replay, loadout: { 'team-pair': 1 } }, later, 422, 'loadout_mismatch'],
    ['Loadout fehlt', session, 'u1', { ...replay, loadout: undefined }, later, 400, 'replay_invalid'],
    ['Loadout kaputt', session, 'u1', { ...replay, loadout: { 'team-pair': 'max' } }, later, 400, 'replay_invalid'],
    ['Format 2', session, 'u1', { ...replay, format: 2 }, later, 400, 'replay_invalid'],
    ['kaputtes Replay', session, 'u1', { ...replay, commands: [[0, 'place', ['dev'], 1, 1]] }, later, 400, 'replay_invalid'],
    ['kein Objekt', session, 'u1', [replay], later, 400, 'replay_invalid'],
    ['zu schnell', session, 'u1', replay, new Date(issued.getTime() + 500), 422, 'too_fast'],
  ] as const)('%s → %i %s', (_label, s, user, raw, now, status, reason) => {
    const r = checkSubmission(s as SessionRow | null, user, raw, now);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.status).toBe(status);
      expect(r.reason).toBe(reason);
    }
  });
});

describe('checkSubmission (Level mit Skills)', () => {
  const loadout: SkillLoadout = { 'team-pair': 2, 'team-dual': 1 };
  const { replay, session, later } = fixture({ seed: 77, levelId: 'team-2', loadout });

  it('Replay trägt Level und Loadout der Session', () => {
    expect(replay.levelId).toBe('team-2');
    expect(replay.mode).toBe('level');
    expect(checkSubmission(session, 'u1', replay, later).ok).toBe(true);
  });
  it('Loadout-Gleichheit unabhängig von Reihenfolge und Rang 0', () => {
    const s = { ...session, loadout: { 'team-dual': 1, 'team-pair': 2, 'team-tdd': 0 } };
    expect(checkSubmission(s, 'u1', replay, later).ok).toBe(true);
  });
  it.each([
    ['höherer Rang als eingefroren', { ...replay, loadout: { 'team-pair': 3, 'team-dual': 1 } }, 'loadout_mismatch'],
    ['zusätzlicher Skill', { ...replay, loadout: { ...loadout, 'team-tdd': 1 } }, 'loadout_mismatch'],
    ['ohne Skills', { ...replay, loadout: {} }, 'loadout_mismatch'],
    ['anderes Level', { ...replay, levelId: 'team-3' }, 'level_mismatch'],
    ['Level entfernt', { ...replay, levelId: null }, 'level_mismatch'],
    ['Challenge statt Level', { ...replay, mode: 'challenge' }, 'mode_mismatch'],
  ] as const)('%s → %s', (_label, raw, reason) => {
    const r = checkSubmission(session, 'u1', raw, later);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe(reason);
  });
  it('Session mit anderem Loadout als das Replay → loadout_mismatch', () => {
    const r = checkSubmission({ ...session, loadout: { 'team-pair': 1 } }, 'u1', replay, later);
    expect(r.ok ? null : r.reason).toBe('loadout_mismatch');
  });
  it('lange Level-Läufe (≥ 120k Ticks) sind erlaubt, über MAX_TICKS_RANKED nicht', () => {
    const { replay: r, session: s, issued } = fixture({ seed: 5, levelId: 'solution-5' });
    const hourLater = new Date(issued.getTime() + 3600_000);
    expect(MAX_TICKS_RANKED).toBeGreaterThanOrEqual(120_000);
    expect(checkSubmission(s, 'u1', { ...r, endTick: 120_000 }, hourLater).ok).toBe(true);
    const tooLong = checkSubmission(s, 'u1', { ...r, endTick: MAX_TICKS_RANKED + 1 }, hourLater);
    expect(tooLong.ok ? null : tooLong.reason).toBe('replay_invalid');
  });
});

describe('replayHash', () => {
  it('hängt an den Eingaben (inkl. Level und Loadout), nicht am behaupteten Ergebnis', async () => {
    const g = new Game({ seed: 1, mode: 'challenge' });
    g.apply({ type: 'startWave' });
    const r = g.toReplay();
    const h = await replayHash(r);
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(await replayHash({ ...r, result: { ...r.result, score: 999 } })).toBe(h);
    expect(await replayHash({ ...r, commands: [] })).not.toBe(h);
    expect(await replayHash({ ...r, loadout: { 'team-pair': 1 } })).not.toBe(h);
    expect(await replayHash({ ...r, levelId: 'team-1' })).not.toBe(h);
    expect(await replayHash({ ...r, loadout: { 'team-pair': 0 } })).toBe(h);
  });
});
