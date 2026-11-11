// AC-2: gleicher Tages-Seed für alle, 401 ohne Token, 429 nach 30 Sessions.
import { afterAll, describe, expect, it } from 'vitest';
import { HAVE_ENV, SKIP_MESSAGE, createUser, deleteCreatedUsers, fn, pubHeaders, startRun } from './helpers';

if (!HAVE_ENV) console.warn(SKIP_MESSAGE);

describe.skipIf(!HAVE_ENV)('start-run (AC-2)', () => {
  afterAll(deleteCreatedUsers);

  it('zwei Nutzer erhalten denselben Seed, dieselbe Karte und dasselbe Datum', async () => {
    const [u1, u2] = [await createUser(), await createUser()];
    const [r1, r2] = [await startRun(u1), await startRun(u2)];
    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
    expect(r1.body.sessionId).not.toBe(r2.body.sessionId);
    expect(r1.body.seed).toBe(r2.body.seed);
    expect(r1.body.mapId).toBe(r2.body.mapId);
    expect(r1.body.dailyDate).toBe(r2.body.dailyDate);
    expect(r1.body.mode).toBe('challenge');
    expect(r1.body.gameVersion).toBe('0.3.0');
  });

  it('ohne Token -> 401', async () => {
    const r = await fn('start-run', {}, pubHeaders());
    expect(r.status).toBe(401);
  });

  it('die 31. Session eines Nutzers pro Tag -> 429 rate_limited', async () => {
    const u = await createUser();
    for (let i = 0; i < 30; i++) expect((await startRun(u)).status, `Session ${i + 1}`).toBe(200);
    const r = await fn<{ error: string }>('start-run', {}, u.headers);
    expect(r.status).toBe(429);
    expect(r.body.error).toBe('rate_limited');
  });
});
