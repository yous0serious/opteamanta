// AC-3, AC-4: Ablehnungsgründe, gültiger Lauf -> verified, manipuliertes Ergebnis -> rejected.
import { randomInt } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CAMPAIGNS, MAPS, SKILLS } from '../../src/sim/index';
import {
  HAVE_ENV, SKIP_MESSAGE, createUser, deleteCreatedUsers, fn, makeReplay, makeRunReplay, pollSubmission, rest, secretHeaders, sleep, startRun,
  type TestUser,
} from './helpers';

if (!HAVE_ENV) console.warn(SKIP_MESSAGE);

describe.skipIf(!HAVE_ENV)('submit-run (AC-3, AC-4)', () => {
  let u: TestUser;
  let other: TestUser;
  const submit = (user: TestUser, sessionId: string, replay: unknown) =>
    fn<{ error?: string; submissionId?: string; status?: string }>('submit-run', { sessionId, replay }, user.headers);
  /** Neue Session + Replay mit zufälliger Variante (eindeutiger Eingabe-Hash). */
  const fresh = async (user = u) => {
    const s = await startRun(user);
    expect(s.status).toBe(200);
    return { s: s.body, replay: makeReplay(s.body.seed, randomInt(0, 200)) };
  };

  beforeAll(async () => {
    u = await createUser();
    other = await createUser();
  });
  afterAll(deleteCreatedUsers);

  it('session_unknown -> 403 (unbekannt und fremde Session)', async () => {
    const { replay } = await fresh();
    const r = await submit(u, '11111111-1111-4111-8111-111111111111', replay);
    expect([r.status, r.body.error]).toEqual([403, 'session_unknown']);
    const foreign = await startRun(other);
    const r2 = await submit(u, foreign.body.sessionId, replay);
    expect([r2.status, r2.body.error]).toEqual([403, 'session_unknown']);
  });

  it('session_expired -> 410', async () => {
    const { s, replay } = await fresh();
    const p = await rest('PATCH', `run_sessions?id=eq.${s.sessionId}`, secretHeaders(), { expires_at: '2020-01-01T00:00:00Z' });
    expect(p.status).toBeLessThan(300);
    const r = await submit(u, s.sessionId, replay);
    expect([r.status, r.body.error]).toEqual([410, 'session_expired']);
  });

  it.each([
    ['seed_mismatch', (r: Record<string, unknown>) => (r.seed = (r.seed as number) + 1)],
    ['map_mismatch', (r: Record<string, unknown>) => (r.mapId = r.mapId === 'matrix' ? 'other-map' : 'matrix')],
    ['mode_mismatch', (r: Record<string, unknown>) => (r.mode = 'endless')],
    ['version_mismatch', (r: Record<string, unknown>) => (r.gameVersion = '9.9.9')],
  ])('%s -> 422', async (reason, mutate) => {
    const { s, replay } = await fresh();
    mutate(replay as unknown as Record<string, unknown>);
    const r = await submit(u, s.sessionId, replay);
    expect([r.status, r.body.error]).toEqual([422, reason]);
  });

  it('replay_invalid -> 400', async () => {
    const { s, replay } = await fresh();
    (replay as unknown as Record<string, unknown>).commands = 'kaputt';
    const r = await submit(u, s.sessionId, replay);
    expect([r.status, r.body.error]).toEqual([400, 'replay_invalid']);
  });

  it('too_fast -> 422 (sofort nach Sessionstart)', async () => {
    const { s, replay } = await fresh();
    const r = await submit(u, s.sessionId, replay);
    expect([r.status, r.body.error]).toEqual([422, 'too_fast']);
  });

  it('session_used -> 409 beim zweiten Einreichen derselben Session', async () => {
    const { s, replay } = await fresh();
    await sleep(1500);
    const first = await submit(u, s.sessionId, replay);
    expect(first.status).toBe(202);
    const again = await submit(u, s.sessionId, replay);
    expect([again.status, again.body.error]).toEqual([409, 'session_used']);
  });

  it('duplicate -> 409 bei gleichen Eingaben in neuer Session', async () => {
    const a = await fresh();
    const b = await startRun(u);
    await sleep(1500);
    expect((await submit(u, a.s.sessionId, a.replay)).status).toBe(202);
    const r = await submit(u, b.body.sessionId, a.replay);
    expect([r.status, r.body.error]).toEqual([409, 'duplicate']);
  });

  it('gültiger Lauf wird verified, gespeicherter Score = echter Score', async () => {
    const { s, replay } = await fresh();
    await sleep(1500);
    const r = await submit(u, s.sessionId, replay);
    expect([r.status, r.body.status]).toEqual([202, 'pending']);
    const done = await pollSubmission(u, r.body.submissionId!);
    console.log(`verify-Latenz (submit -> verified): ${done.ms} ms`);
    expect(done.status).toBe('verified');
    expect(done.score).toBe(replay.result.score);
  });

  it('manipuliertes result.score wird rejected: Ergebnis stimmt nicht', async () => {
    const { s, replay } = await fresh();
    replay.result.score += 1000;
    await sleep(1500);
    const r = await submit(u, s.sessionId, replay);
    expect(r.status).toBe(202);
    const done = await pollSubmission(u, r.body.submissionId!);
    expect([done.status, done.reason]).toEqual(['rejected', 'Ergebnis stimmt nicht']);
  });

  it.each([
    ['loadout_mismatch', 422, (r: Record<string, unknown>) => (r.loadout = { [SKILLS[0]!.id]: 1 })],
    ['level_mismatch', 422, (r: Record<string, unknown>) => (r.levelId = CAMPAIGNS[0]!.levels[0]!)],
    ['replay_invalid', 400, (r: Record<string, unknown>) => delete r.loadout],
  ])('Daily mit %s -> %i (Spec campaigns)', async (reason, status, mutate) => {
    const { s, replay } = await fresh();
    mutate(replay as unknown as Record<string, unknown>);
    await sleep(1500);
    const r = await submit(u, s.sessionId, replay);
    expect([r.status, r.body.error]).toEqual([status, reason]);
  });

  it('Karten-Lauf wird verified und landet im Board map:<id>', async () => {
    const s = await startRun(u, { kind: 'map', mapId: MAPS[0]!.id });
    expect(s.status).toBe(200);
    const replay = makeRunReplay({ ...s.body, loadout: {} }, randomInt(0, 160_000));
    await sleep(1500);
    const r = await submit(u, s.body.sessionId, replay);
    expect(r.status).toBe(202);
    const done = await pollSubmission(u, r.body.submissionId!);
    expect(done.status).toBe('verified');
    const row = await rest<Array<{ board: string; kind: string; map_id: string; mode: string }>>(
      'GET', `submissions?id=eq.${r.body.submissionId}&select=board,kind,map_id,mode`, u.headers,
    );
    expect(row.body[0]).toEqual({ board: `map:${MAPS[0]!.id}`, kind: 'map', map_id: MAPS[0]!.id, mode: 'challenge' });
  });
});
