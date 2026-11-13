// Spec campaigns AC-5: Skill-RPC prüft Punkte/Voraussetzungen, start-run friert das Loadout ein, submit-run lehnt fremde
// Loadouts ab, XP/Level-Bestwerte nur aus geprüften Läufen.
import { randomInt } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CAMPAIGNS, SKILLS, xpForRun, type ReplayResult } from '../../src/sim/index';
import {
  HAVE_ENV, SKIP_MESSAGE, createUser, deleteCreatedUsers, fn, makeRunReplay, pollSubmission, rest, sleep, startRun, type TestUser,
} from './helpers';

if (!HAVE_ENV) console.warn(SKIP_MESSAGE);

interface Progress {
  nickname: string | null;
  xp: number;
  levels: Array<{ level_id: string; best_stars: number; best_score: number | null }>;
  skills: Record<string, number>;
  achievements: Array<{ id: string; unlocked_at: string }>;
}

describe.skipIf(!HAVE_ENV)('Skills, Loadout-Snapshot und XP (Spec campaigns AC-5)', () => {
  let u: TestUser;
  const root = SKILLS.find((s) => s.requires.length === 0)!;
  const child = SKILLS.find((s) => s.requires.length > 0)!;
  const first = CAMPAIGNS[0]!.levels[0]!;
  const skill = (body: unknown) => fn<{ error?: string; loadout?: Record<string, number>; points?: number; spent?: number }>('allocate-skill', body, u.headers);
  const progress = async (): Promise<Progress> => (await rest<Progress>('POST', 'rpc/get_progress', u.headers, {})).body;

  beforeAll(async () => {
    u = await createUser();
  });
  afterAll(deleteCreatedUsers);

  it('Level 1 = 1 Skillpunkt: erster Rang ok, zweiter no_points, Voraussetzung fehlt → locked', async () => {
    const ok = await skill({ skillId: root.id, rank: 1 });
    expect(ok.status).toBe(200);
    expect(ok.body).toMatchObject({ loadout: { [root.id]: 1 }, points: 1, spent: 1 });
    expect([(await skill({ skillId: root.id, rank: 2 })).body.error]).toEqual(['no_points']);
    expect((await skill({ skillId: child.id, rank: 1 })).body.error).toMatch(/^(locked|no_points)$/);
    expect((await skill({ skillId: 'gibt-es-nicht', rank: 1 })).status).toBe(400);
    expect((await progress()).skills).toEqual({ [root.id]: 1 });
  });

  it('start-run friert das Loadout ein; Replay mit anderem Loadout → loadout_mismatch', async () => {
    const s = await startRun(u, { kind: 'level', levelId: first });
    expect(s.status).toBe(200);
    expect(s.body.loadout).toEqual({ [root.id]: 1 });
    const foreign = makeRunReplay({ ...s.body, loadout: {} }, randomInt(0, 160_000));
    await sleep(1500);
    const r = await fn<{ error?: string }>('submit-run', { sessionId: s.body.sessionId, replay: foreign }, u.headers);
    expect([r.status, r.body.error]).toEqual([422, 'loadout_mismatch']);
  });

  it('Respec nach dem Start ändert den eingefrorenen Lauf nicht; geprüfter Level-Lauf schreibt XP und Bestwert gut', async () => {
    const s = await startRun(u, { kind: 'level', levelId: first });
    expect(s.status).toBe(200);
    expect((await skill({ respec: true })).status).toBe(200);
    expect((await progress()).skills).toEqual({});
    const replay = makeRunReplay(s.body, randomInt(0, 160_000));
    await sleep(1500);
    const r = await fn<{ submissionId?: string }>('submit-run', { sessionId: s.body.sessionId, replay }, u.headers);
    expect(r.status).toBe(202);
    const done = await pollSubmission(u, r.body.submissionId!);
    expect(done.status).toBe('verified');
    const res = replay.result as ReplayResult;
    const firstClear = res.stars >= 1;
    const expected = xpForRun(res, { firstClear, won: res.won });
    const sub = await rest<Array<{ xp: number; stars: number; kills: number; kind: string; board: string; loadout: Record<string, number> }>>(
      'GET', `submissions?id=eq.${r.body.submissionId}&select=xp,stars,kills,kind,board,loadout`, u.headers,
    );
    expect(sub.body[0]).toMatchObject({ xp: expected, stars: res.stars, kills: res.kills, kind: 'level', board: `level:${first}`, loadout: { [root.id]: 1 } });
    const p = await progress();
    expect(p.xp).toBe(expected);
    expect(p.levels).toEqual([{ level_id: first, best_stars: res.stars, best_score: res.score }]);
  });

  it('abgelehnter Lauf bringt keine XP', async () => {
    const before = (await progress()).xp;
    const s = await startRun(u, { kind: 'level', levelId: first });
    const replay = makeRunReplay(s.body, randomInt(0, 160_000));
    replay.result.kills += 50;
    await sleep(1500);
    const r = await fn<{ submissionId?: string }>('submit-run', { sessionId: s.body.sessionId, replay }, u.headers);
    expect(r.status).toBe(202);
    const done = await pollSubmission(u, r.body.submissionId!);
    expect(done.status).toBe('rejected');
    expect((await progress()).xp).toBe(before);
  });
});
