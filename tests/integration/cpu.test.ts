// AC-5: CPU-Zeit der Prüfung des längsten Strong-Bot-Replays (Challenge) < 1500 ms.
import { createHash, randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { MAPS, type Replay } from '../../src/sim/index';
import { playStrongBot } from '../../tools/bot-strong';
import { HAVE_ENV, SKIP_MESSAGE, VERIFY_SECRET, createUser, deleteCreatedUsers, fn, rest, secretHeaders, sleep } from './helpers';

if (!HAVE_ENV) console.warn(SKIP_MESSAGE);

describe.skipIf(!HAVE_ENV)('CPU-Messung längster Lauf (AC-5)', () => {
  afterAll(deleteCreatedUsers);

  it('verify-runs prüft das längste Bot-Replay mit cpuMs < 1500', async () => {
    let best: Replay | null = null;
    for (let seed = 1; seed <= 5; seed++) {
      for (const m of MAPS) {
        const r = playStrongBot({ seed, maxWave: 30, mode: 'challenge', mapId: m.id }).toReplay();
        if (!best || r.endTick > best.endTick) best = r;
      }
    }
    const replay = best!;
    const u = await createUser();
    const sid = randomUUID();
    const sess = await rest('POST', 'run_sessions', secretHeaders(), {
      id: sid, user_id: u.id, daily_date: '2000-01-01', seed: replay.seed, map_id: replay.mapId, game_version: replay.gameVersion,
      expires_at: '2030-01-01T00:00:00Z', used_at: new Date().toISOString(),
    });
    expect(sess.status).toBe(201);
    const ins = await rest<Array<{ id: string }>>('POST', 'submissions', secretHeaders(), {
      session_id: sid, user_id: u.id, daily_date: '2000-01-01', game_version: replay.gameVersion, replay, end_tick: replay.endTick,
      replay_hash: createHash('sha256').update(randomUUID()).digest('hex'), status: 'pending',
    }, { Prefer: 'return=representation' });
    expect(ins.status).toBe(201);
    const id = ins.body[0]!.id;

    let measured: { cpuMs: number; status: string } | null = null;
    for (let attempt = 0; attempt < 3 && !measured; attempt++) {
      for (let i = 0; i < 40 && !measured; i++) {
        const r = await fn<{ id?: string; status?: string; cpuMs?: number; idle?: boolean }>('verify-runs', {}, { 'Content-Type': 'application/json', 'x-verify-secret': VERIFY_SECRET });
        expect(r.status).toBe(200);
        if (r.body.id === id) measured = { cpuMs: r.body.cpuMs!, status: r.body.status! };
        else {
          const row = await rest<Array<{ status: string }>>('GET', `submissions?id=eq.${id}&select=status`, secretHeaders());
          if (row.body[0]?.status !== 'pending') break; // Cron war schneller
          await sleep(500);
        }
      }
      if (!measured) {
        // Cron hat geprüft: zurück auf pending und erneut messen
        await sleep(1000);
        await rest('PATCH', `submissions?id=eq.${id}`, secretHeaders(), { status: 'pending', reason: null, score: null, verified_at: null, attempts: 0, claimed_at: null });
      }
    }
    expect(measured).not.toBeNull();
    console.log(`cpuMs=${measured!.cpuMs} endTick=${replay.endTick} map=${replay.mapId} seed=${replay.seed}`);
    expect(measured!.status).toBe('verified');
    expect(measured!.cpuMs).toBeLessThan(1500);
  });
});
