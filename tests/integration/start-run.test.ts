// AC-2 (leaderboard-supabase): gleicher Tages-Seed für alle, 401 ohne Token, 429 nach 30 Sessions.
// Spec campaigns: Level-/Karten-Sessions, Freischaltung, Loadout-Snapshot.
import { afterAll, describe, expect, it } from 'vitest';
import { CAMPAIGNS, GAME_VERSION, MAPS } from '../../src/sim/index';
import { HAVE_ENV, SKIP_MESSAGE, createUser, deleteCreatedUsers, fn, pubHeaders, startRun } from './helpers';

if (!HAVE_ENV) console.warn(SKIP_MESSAGE);

describe.skipIf(!HAVE_ENV)('start-run (AC-2)', () => {
  afterAll(deleteCreatedUsers);

  it('zwei Nutzer erhalten denselben Seed, dieselbe Karte und dasselbe Datum', async () => {
    const [u1, u2] = [await createUser(), await createUser()];
    const [r1, r2] = [await startRun(u1), await startRun(u2, { kind: 'daily' })];
    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
    expect(r1.body.sessionId).not.toBe(r2.body.sessionId);
    expect(r1.body.seed).toBe(r2.body.seed);
    expect(r1.body.mapId).toBe(r2.body.mapId);
    expect(r1.body.dailyDate).toBe(r2.body.dailyDate);
    expect(r1.body.mode).toBe('challenge');
    expect(r1.body.kind).toBe('daily');
    expect(r1.body.board).toBe(`daily:${r1.body.dailyDate}`);
    expect(r1.body.levelId).toBeNull();
    expect(r1.body.loadout).toEqual({});
    expect(r1.body.gameVersion).toBe(GAME_VERSION);
  });

  it('ohne Token -> 401', async () => {
    const r = await fn('start-run', {}, pubHeaders());
    expect(r.status).toBe(401);
  });

  it('die 31. Daily-Session eines Nutzers pro Tag -> 429 rate_limited', async () => {
    const u = await createUser();
    for (let i = 0; i < 30; i++) expect((await startRun(u)).status, `Session ${i + 1}`).toBe(200);
    const r = await fn<{ error: string }>('start-run', {}, u.headers);
    expect(r.status).toBe(429);
    expect(r.body.error).toBe('rate_limited');
    // eigenes Limit für Level-/Kartenläufe
    expect((await startRun(u, { kind: 'map', mapId: MAPS[0]!.id })).status).toBe(200);
  });
});

describe.skipIf(!HAVE_ENV)('start-run: Level und Karten (Spec campaigns)', () => {
  afterAll(deleteCreatedUsers);
  const first = CAMPAIGNS[0]!.levels[0]!;

  it('erstes Level: Modus level, Board level:<id>, Karte aus den Level-Daten, Wochen-Seed (kein Seed-Farmen)', async () => {
    const [u, v] = [await createUser(), await createUser()];
    const [a, b, c] = [
      await startRun(u, { kind: 'level', levelId: first }), await startRun(u, { kind: 'level', levelId: first }),
      await startRun(v, { kind: 'level', levelId: first }),
    ];
    expect(a.status).toBe(200);
    expect(a.body).toMatchObject({ kind: 'level', levelId: first, mode: 'level', board: `level:${first}`, loadout: {} });
    expect(b.body.seed).toBe(a.body.seed);
    expect(c.body.seed).toBe(a.body.seed);
  });

  it('Karte: Challenge auf der gewählten Karte', async () => {
    const u = await createUser();
    const m = MAPS[1]!.id;
    const r = await startRun(u, { kind: 'map', mapId: m });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ kind: 'map', mapId: m, mode: 'challenge', board: `map:${m}`, levelId: null });
  });

  it.each([
    [{ kind: 'level', levelId: CAMPAIGNS[0]!.levels[1]! }, 403, 'level_locked'],
    [{ kind: 'level', levelId: CAMPAIGNS[1]!.levels[0]! }, 403, 'level_locked'],
    [{ kind: 'level', levelId: 'team-99' }, 404, 'level_unknown'],
    [{ kind: 'map', mapId: 'nirgendwo' }, 404, 'map_unknown'],
    [{ kind: 'endless' }, 400, 'kind_invalid'],
  ])('%j -> %i %s', async (body, status, error) => {
    const u = await createUser();
    const r = await startRun(u, body);
    expect([r.status, (r.body as unknown as { error: string }).error]).toEqual([status, error]);
  });
});
