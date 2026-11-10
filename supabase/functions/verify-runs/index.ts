// verify-runs: prüft genau eine wartende Einreichung durch Nachrechnen (eigenes CPU-Budget pro Aufruf).
// Aufgerufen von submit-run und minütlich per pg_cron. Spec leaderboard-supabase AC-4/AC-5, ADR-0004.
import { parseReplay, runReplay } from '../_shared/sim.js';
import { MAX_TICKS_CHALLENGE } from '../_shared/logic.ts';
import { env, serviceClient } from '../_shared/http.ts';

const reply = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method !== 'POST') return reply(405, { error: 'method_not_allowed' });
  if (req.headers.get('x-verify-secret') !== env('VERIFY_SECRET')) return reply(401, { error: 'unauthorized' });

  const db = serviceClient();
  const { data, error } = await db.rpc('claim_submission');
  if (error) return reply(500, { error: 'claim_failed' });
  const sub = (data as Array<{ id: string; replay: unknown }> | null)?.[0];
  if (!sub) return reply(200, { idle: true });

  let status: 'verified' | 'rejected' = 'rejected';
  let reason: string | null = null;
  let result = { score: null as number | null, wave: null as number | null, lives: null as number | null, won: null as boolean | null };
  const t0 = performance.now();
  try {
    const replay = parseReplay(sub.replay, { maxTicks: MAX_TICKS_CHALLENGE });
    const check = runReplay(replay);
    result = { score: check.score, wave: check.wave, lives: check.lives, won: check.won };
    if (check.matches) status = 'verified';
    else reason = 'Ergebnis stimmt nicht';
  } catch (err) {
    reason = `Replay ungültig: ${(err as Error).message}`.slice(0, 300);
  }
  const cpuMs = Math.round(performance.now() - t0);
  const { error: finErr } = await db.rpc('finish_submission', {
    p_id: sub.id, p_status: status, p_reason: reason, p_score: result.score, p_wave: result.wave, p_lives: result.lives, p_won: result.won,
  });
  if (finErr) return reply(500, { error: 'finish_failed', id: sub.id });
  return reply(200, { id: sub.id, status, reason, cpuMs });
});
