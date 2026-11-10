// start-run: vergibt eine Daily-Session (Seed/Karte des Berliner Tages). Spec leaderboard-supabase AC-2.
import { GAME_VERSION } from '../_shared/sim.js';
import { MAX_SESSIONS_PER_DAY, SESSION_TTL_MS, berlinDate, dailySeed, mapForSeed } from '../_shared/logic.ts';
import { env, json, preflight, serviceClient, userFromRequest } from '../_shared/http.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight(req);
  if (req.method !== 'POST') return json(req, 405, { error: 'method_not_allowed' });
  const db = serviceClient();
  const user = await userFromRequest(req, db);
  if (!user) return json(req, 401, { error: 'unauthorized' });

  const date = berlinDate(new Date());
  const { data: allowed, error: rateErr } = await db.rpc('bump_rate', {
    p_user: user.id, p_bucket: 'start', p_day: date, p_limit: MAX_SESSIONS_PER_DAY,
  });
  if (rateErr) return json(req, 500, { error: 'rate_check_failed' });
  if (!allowed) return json(req, 429, { error: 'rate_limited' });

  const seed = await dailySeed(env('DAILY_SECRET'), date);
  const mapId = mapForSeed(seed);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  const { data, error } = await db
    .from('run_sessions')
    .insert({ user_id: user.id, kind: 'daily', daily_date: date, seed, map_id: mapId, mode: 'challenge', game_version: GAME_VERSION, expires_at: expiresAt })
    .select('id, issued_at')
    .single();
  if (error || !data) return json(req, 500, { error: 'session_create_failed' });

  return json(req, 200, {
    sessionId: data.id, seed, mapId, mode: 'challenge', gameVersion: GAME_VERSION, dailyDate: date, issuedAt: data.issued_at, expiresAt,
  });
});
