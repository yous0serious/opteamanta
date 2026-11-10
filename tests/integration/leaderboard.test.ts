// AC-6: Rangliste (Reihenfolge, bester Lauf je Nutzer, eigener Rang, Woche, Ticker) mit Testdaten einer eigenen game_version.
import { createHash, randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { HAVE_ENV, SKIP_MESSAGE, createUser, deleteCreatedUsers, rand, rest, secretHeaders, type TestUser } from './helpers';

if (!HAVE_ENV) console.warn(SKIP_MESSAGE);

interface Row { rank: number; nickname: string; score: number; wave: number; lives: number; won: boolean; is_me: boolean }

describe.skipIf(!HAVE_ENV)('get_leaderboard und get_ticker (AC-6)', () => {
  const version = `it-${rand(8)}`;
  const tag = rand(4);
  // Woche: Montag 2026-03-02 bis Sonntag 2026-03-08
  const DAY = '2026-03-04';
  const users: Record<string, TestUser> = {};
  const nick = (k: string): string => `${k}-${tag}`;

  async function seedRun(k: string, date: string, score: number, lives: number, verifiedAt: string): Promise<void> {
    const sid = randomUUID();
    const sess = await rest('POST', 'run_sessions', secretHeaders(), {
      id: sid, user_id: users[k]!.id, daily_date: date, seed: 1, map_id: 'matrix', game_version: version, expires_at: '2030-01-01T00:00:00Z', used_at: verifiedAt,
    });
    expect(sess.status).toBe(201);
    const sub = await rest('POST', 'submissions', secretHeaders(), {
      session_id: sid, user_id: users[k]!.id, daily_date: date, game_version: version, replay: {}, end_tick: 1,
      replay_hash: createHash('sha256').update(randomUUID()).digest('hex'),
      status: 'verified', score, wave: 5, lives, won: false, verified_at: verifiedAt,
    });
    expect(sub.status).toBe(201);
  }

  const board = async (period: 'day' | 'week', refDate: string, as: string): Promise<Row[]> => {
    const r = await rest<Row[]>('POST', 'rpc/get_leaderboard', users[as]!.headers, { period, ref_date: refDate, version });
    expect(r.status).toBe(200);
    return r.body;
  };

  beforeAll(async () => {
    const keys = ['A', 'B', 'C', 'D', 'Z', ...Array.from({ length: 8 }, (_, i) => `F${i}`)];
    for (const k of keys) {
      users[k] = await createUser();
      const p = await rest('POST', 'profiles', users[k]!.headers, { user_id: users[k]!.id, nickname: nick(k) });
      expect(p.status).toBe(201);
    }
    // Tag 2026-03-04: C 500/12, A 500/10 (früher geprüft), B 500/10 (später), D 400; A hat zusätzlich einen schwächeren Lauf 300
    await seedRun('C', DAY, 500, 12, '2026-03-04T10:00:00Z');
    await seedRun('A', DAY, 500, 10, '2026-03-04T10:01:00Z');
    await seedRun('A', DAY, 300, 20, '2026-03-04T10:02:00Z');
    await seedRun('B', DAY, 500, 10, '2026-03-04T10:03:00Z');
    await seedRun('D', DAY, 400, 20, '2026-03-04T10:04:00Z');
    for (let i = 0; i < 8; i++) await seedRun(`F${i}`, DAY, 100 - i, 5, '2026-03-04T11:00:00Z');
    await seedRun('Z', DAY, 1, 1, '2026-03-04T12:00:00Z');
    // Andere Tage: A besser am Freitag; D extrem hoch am Vorsonntag und am Folgemontag (außerhalb der Woche)
    await seedRun('A', '2026-03-06', 700, 10, '2026-03-06T10:00:00Z');
    await seedRun('D', '2026-03-01', 9999, 10, '2026-03-01T10:00:00Z');
    await seedRun('D', '2026-03-09', 9999, 10, '2026-03-09T10:00:00Z');
  });
  afterAll(async () => {
    await deleteCreatedUsers();
    await rest('DELETE', `submissions?game_version=eq.${version}`, secretHeaders());
    await rest('DELETE', `run_sessions?game_version=eq.${version}`, secretHeaders());
  });

  it('Tag: Score ↓, Moral ↓, Prüfzeit ↑, bester Lauf je Nutzer, eigene Zeile', async () => {
    const rows = await board('day', DAY, 'A');
    expect(rows.slice(0, 4).map((r) => r.nickname)).toEqual([nick('C'), nick('A'), nick('B'), nick('D')]);
    expect(rows.slice(0, 4).map((r) => r.score)).toEqual([500, 500, 500, 400]);
    expect(rows.slice(0, 4).map((r) => r.rank)).toEqual([1, 2, 3, 4]);
    expect(rows.filter((r) => r.nickname === nick('A')).length).toBe(1);
    expect(rows.filter((r) => r.is_me).map((r) => r.nickname)).toEqual([nick('A')]);
    expect(rows.length).toBe(10);
  });

  it('eigene Zeile erscheint auch außerhalb der Top 10', async () => {
    const rows = await board('day', DAY, 'Z');
    expect(rows.length).toBe(11);
    const me = rows[10]!;
    expect([me.nickname, me.rank, me.score, me.is_me]).toEqual([nick('Z'), 13, 1, true]);
    expect(rows.slice(0, 10).some((r) => r.is_me)).toBe(false);
  });

  it('Woche Montag–Sonntag: bester Lauf der Woche, Vor- und Folgetag ausgeschlossen', async () => {
    for (const ref of ['2026-03-02', '2026-03-08', DAY]) {
      const rows = await board('week', ref, 'B');
      expect(rows.slice(0, 4).map((r) => [r.nickname, r.score])).toEqual([[nick('A'), 700], [nick('C'), 500], [nick('B'), 500], [nick('D'), 400]]);
      expect(rows.some((r) => r.score === 9999)).toBe(false);
    }
  });

  it('get_ticker liefert nur Tagesbestwerte', async () => {
    const r = await rest<Array<{ nickname: string; score: number; daily_date: string }>>('POST', 'rpc/get_ticker', users.A!.headers, { since: '2026-03-04T00:00:00Z', version });
    expect(r.status).toBe(200);
    expect(r.body.length).toBeGreaterThan(0);
    expect(r.body.length).toBeLessThanOrEqual(5);
    const max: Record<string, number> = { '2026-03-04': 500, '2026-03-06': 700, '2026-03-09': 9999 };
    for (const t of r.body) expect(t.score).toBe(max[t.daily_date]);
    expect(r.body.some((t) => t.nickname === nick('D') && t.score === 400)).toBe(false);
    expect(r.body.some((t) => t.nickname === nick('A') && t.score === 300)).toBe(false);
  });
});
