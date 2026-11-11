import { describe, expect, it } from 'vitest';
import { Game } from '../../src/sim/index';
import {
  berlinDate, checkSubmission, dailySeed, isoWeekRange, mapForSeed, replayHash, type SessionRow,
} from '../../supabase/functions/_shared/logic';

// Spec leaderboard-supabase AC-2/AC-3 (Server-Logik ohne Datenbank).

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

describe('dailySeed', () => {
  it('gleicher Tag + Geheimnis → gleicher Seed; sonst anders; uint32', async () => {
    const a = await dailySeed('geheim', '2026-11-10');
    expect(await dailySeed('geheim', '2026-11-10')).toBe(a);
    expect(await dailySeed('geheim', '2026-11-11')).not.toBe(a);
    expect(await dailySeed('anderes', '2026-11-10')).not.toBe(a);
    expect(Number.isInteger(a) && a >= 0 && a <= 0xffffffff).toBe(true);
  });
  it('Karte folgt aus dem Seed wie im Spiel', () => {
    expect(['spaghetti', 'waterfall', 'release-train', 'matrix']).toContain(mapForSeed(123));
    expect(mapForSeed(123)).toBe(new Game({ seed: 123 }).state.mapId);
  });
});

describe('checkSubmission', () => {
  const seed = 4242;
  const mapId = mapForSeed(seed);
  const game = new Game({ seed, mode: 'challenge' });
  game.apply({ type: 'startWave' });
  for (let i = 0; i < 600; i++) game.step(); // 10 s Spielzeit
  const replay = game.toReplay();
  const issued = new Date('2026-11-10T12:00:00Z');
  const session: SessionRow = {
    id: 's1', user_id: 'u1', daily_date: '2026-11-10', seed, map_id: mapId, mode: 'challenge', game_version: '0.3.0',
    issued_at: issued.toISOString(), expires_at: new Date(issued.getTime() + 3 * 3600_000).toISOString(), used_at: null,
  };
  const later = new Date(issued.getTime() + 60_000);

  it('gültige Einreichung', () => {
    const r = checkSubmission(session, 'u1', replay, later);
    expect(r.ok).toBe(true);
  });
  it.each([
    ['fremde Session', null, 'u1', replay, later, 403, 'session_unknown'],
    ['anderer Nutzer', session, 'u2', replay, later, 403, 'session_unknown'],
    ['benutzt', { ...session, used_at: later.toISOString() }, 'u1', replay, later, 409, 'session_used'],
    ['abgelaufen', session, 'u1', replay, new Date(issued.getTime() + 3 * 3600_000 + 1), 410, 'session_expired'],
    ['falscher Seed', session, 'u1', { ...replay, seed: seed + 1 }, later, 422, 'seed_mismatch'],
    ['falsche Karte', session, 'u1', { ...replay, mapId: mapId === 'matrix' ? 'waterfall' : 'matrix' }, later, 422, 'map_mismatch'],
    ['falscher Modus', session, 'u1', { ...replay, mode: 'endless' }, later, 422, 'mode_mismatch'],
    ['falsche Version', session, 'u1', { ...replay, gameVersion: '0.2.0' }, later, 422, 'version_mismatch'],
    ['kaputtes Replay', session, 'u1', { ...replay, commands: [[0, 'place', ['dev'], 1, 1]] }, later, 400, 'replay_invalid'],
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

describe('replayHash', () => {
  it('hängt an den Eingaben, nicht am behaupteten Ergebnis', async () => {
    const g = new Game({ seed: 1, mode: 'challenge' });
    g.apply({ type: 'startWave' });
    const r = g.toReplay();
    const h = await replayHash(r);
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(await replayHash({ ...r, result: { ...r.result, score: 999 } })).toBe(h);
    expect(await replayHash({ ...r, commands: [] })).not.toBe(h);
  });
});
