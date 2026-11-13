// Spec campaigns: get_board für Daily-, Level- und Karten-Boards (bester Lauf je Nutzer, Zeitraum, Top 50 + Umgebung).
import { createHash, randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { HAVE_ENV, SKIP_MESSAGE, createUser, deleteCreatedUsers, rand, rest, secretHeaders, type TestUser } from './helpers';

if (!HAVE_ENV) console.warn(SKIP_MESSAGE);

interface Row { rank: number; nickname: string; score: number; wave: number; stars: number | null; lives: number; won: boolean; is_me: boolean }
type Kind = 'daily' | 'level' | 'map';

describe.skipIf(!HAVE_ENV)('get_board (Spec campaigns)', () => {
  const version = `it-${rand(8)}`;
  const tag = rand(4);
  const users: Record<string, TestUser> = {};
  const nick = (k: string): string => `${k}-${tag}`;

  async function seedRun(k: string, kind: Kind, key: string, date: string, score: number, stars: number, verifiedAt: string, mapId = 'matrix'): Promise<void> {
    const sid = randomUUID();
    const levelId = kind === 'level' ? key : null;
    const map = kind === 'map' ? key : mapId;
    const board = kind === 'daily' ? `daily:${date}` : `${kind}:${key}`;
    const mode = kind === 'level' ? 'level' : 'challenge';
    const sess = await rest('POST', 'run_sessions', secretHeaders(), {
      id: sid, user_id: users[k]!.id, kind, board, level_id: levelId, daily_date: date, seed: 1, map_id: map, mode,
      game_version: version, expires_at: '2030-01-01T00:00:00Z', used_at: verifiedAt,
    });
    expect(sess.status).toBe(201);
    const sub = await rest('POST', 'submissions', secretHeaders(), {
      session_id: sid, user_id: users[k]!.id, daily_date: date, kind, board, level_id: levelId, map_id: map, mode, game_version: version,
      replay: {}, end_tick: 1, replay_hash: createHash('sha256').update(randomUUID()).digest('hex'),
      status: 'verified', score, wave: 5, lives: 50, won: stars > 0, stars, verified_at: verifiedAt,
    });
    expect(sub.status).toBe(201);
  }

  const board = async (id: string, period: 'all' | 'week' | 'day', refDate: string | null, as: string): Promise<Row[]> => {
    const r = await rest<Row[]>('POST', 'rpc/get_board', users[as]!.headers, { board: id, period, ref_date: refDate, version });
    expect(r.status).toBe(200);
    return r.body;
  };

  beforeAll(async () => {
    for (const k of ['A', 'B', 'C']) {
      users[k] = await createUser();
      const p = await rest('POST', 'profiles', users[k]!.headers, { user_id: users[k]!.id, nickname: nick(k) });
      expect(p.status).toBe(201);
    }
    // Level team-1: A 300/1★ und 500/3★, B 400/2★ (Vorwoche)
    await seedRun('A', 'level', 'team-1', '2026-03-04', 300, 1, '2026-03-04T10:00:00Z');
    await seedRun('A', 'level', 'team-1', '2026-03-05', 500, 3, '2026-03-05T10:00:00Z');
    await seedRun('B', 'level', 'team-1', '2026-02-25', 400, 2, '2026-02-25T10:00:00Z');
    // Karte matrix: C per Karten-Lauf 900, B per Daily auf matrix 700; Daily auf anderer Karte zählt nicht
    await seedRun('C', 'map', 'matrix', '2026-03-04', 900, 0, '2026-03-04T11:00:00Z');
    await seedRun('B', 'daily', '', '2026-03-04', 700, 0, '2026-03-04T12:00:00Z', 'matrix');
    await seedRun('A', 'daily', '', '2026-03-04', 9999, 0, '2026-03-04T12:30:00Z', 'spaghetti');
  });
  afterAll(async () => {
    await deleteCreatedUsers();
    await rest('DELETE', `submissions?game_version=eq.${version}`, secretHeaders());
    await rest('DELETE', `run_sessions?game_version=eq.${version}`, secretHeaders());
  });

  it('Level-Board: bester Lauf je Nutzer, mit Sternen', async () => {
    const rows = await board('level:team-1', 'all', null, 'A');
    expect(rows.map((r) => [r.nickname, r.score, r.stars, r.is_me])).toEqual([[nick('A'), 500, 3, true], [nick('B'), 400, 2, false]]);
  });

  it('Level-Board Woche/Tag filtern nach Lauf-Datum', async () => {
    expect((await board('level:team-1', 'week', '2026-03-04', 'A')).map((r) => r.score)).toEqual([500]);
    expect((await board('level:team-1', 'day', '2026-03-04', 'A')).map((r) => r.score)).toEqual([300]);
    expect((await board('level:team-1', 'week', '2026-02-25', 'A')).map((r) => r.score)).toEqual([400]);
  });

  it('Karten-Board: Challenge auf der Karte inkl. Daily, ohne andere Karten', async () => {
    const rows = await board('map:matrix', 'all', null, 'B');
    expect(rows.map((r) => [r.nickname, r.score])).toEqual([[nick('C'), 900], [nick('B'), 700]]);
    expect(rows.find((r) => r.is_me)?.nickname).toBe(nick('B'));
  });

  it('Daily-Board: Datum aus der Board-ID, nur Daily-Läufe', async () => {
    const rows = await board('daily:2026-03-04', 'day', null, 'C');
    expect(rows.map((r) => r.score)).toEqual([9999, 700]);
    expect(rows.some((r) => r.is_me)).toBe(false);
  });

  it('ungültige Board-ID oder Zeitraum → leer', async () => {
    expect(await board('level:Team 1', 'all', null, 'A')).toEqual([]);
    expect(await board('season:1', 'all', null, 'A')).toEqual([]);
    const r = await rest<Row[]>('POST', 'rpc/get_board', users.A!.headers, { board: 'level:team-1', period: 'year', ref_date: null, version });
    expect(r.body).toEqual([]);
  });

  it('alte Daily-Liste (get_leaderboard) zeigt keine Level-/Kartenläufe', async () => {
    const r = await rest<Array<{ score: number }>>('POST', 'rpc/get_leaderboard', users.A!.headers, { period: 'day', ref_date: '2026-03-04', version });
    expect(r.body.map((x) => x.score)).toEqual([9999, 700]);
  });
});
