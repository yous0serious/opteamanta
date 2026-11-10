// submit-run: nimmt ein Replay zur eigenen Session entgegen, speichert es als `pending` und stößt die Prüfung an.
// Spec leaderboard-supabase AC-3, ADR-0004.
import { REASON_STATUS, checkSubmission, replayHash, type SessionRow } from '../_shared/logic.ts';
import { env, json, preflight, serviceClient, userFromRequest } from '../_shared/http.ts';

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void } | undefined;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight(req);
  if (req.method !== 'POST') return json(req, 405, { error: 'method_not_allowed' });
  const db = serviceClient();
  const user = await userFromRequest(req, db);
  if (!user) return json(req, 401, { error: 'unauthorized' });

  let body: { sessionId?: unknown; replay?: unknown };
  try {
    body = await req.json();
  } catch {
    return json(req, 400, { error: 'replay_invalid', detail: 'kein JSON' });
  }
  if (typeof body.sessionId !== 'string' || !/^[0-9a-f-]{36}$/i.test(body.sessionId)) {
    return json(req, REASON_STATUS.session_unknown, { error: 'session_unknown' });
  }
  const { data: session } = await db.from('run_sessions').select('*').eq('id', body.sessionId).maybeSingle();
  const check = checkSubmission((session as SessionRow | null) ?? null, user.id, body.replay, new Date());
  if (!check.ok) return json(req, check.status, { error: check.reason, detail: check.detail });

  const replay = check.replay;
  const hash = await replayHash(replay);
  const { data: inserted, error } = await db
    .from('submissions')
    .insert({
      session_id: body.sessionId, user_id: user.id, daily_date: (session as SessionRow).daily_date,
      game_version: replay.gameVersion, replay, replay_hash: hash, end_tick: replay.endTick,
    })
    .select('id')
    .single();
  if (error) {
    // 23505: replay_hash oder session_id schon vorhanden
    if (error.code === '23505') {
      const reason = error.message.includes('session_id') ? 'session_used' : 'duplicate';
      return json(req, REASON_STATUS[reason], { error: reason });
    }
    return json(req, 500, { error: 'submit_failed' });
  }
  await db.from('run_sessions').update({ used_at: new Date().toISOString() }).eq('id', body.sessionId);

  // Prüfung sofort anstoßen (eigener Aufruf = eigenes CPU-Budget); der Cron-Job fängt Ausfälle auf.
  const trigger = fetch(`${env('SUPABASE_URL')}/functions/v1/verify-runs`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-verify-secret': env('VERIFY_SECRET') }, body: '{}',
  }).catch(() => undefined);
  if (typeof EdgeRuntime !== 'undefined') EdgeRuntime.waitUntil(trigger);

  return json(req, 202, { submissionId: inserted.id, status: 'pending' });
});
