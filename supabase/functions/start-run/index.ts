// start-run: vergibt eine Lauf-Session – Daily (Seed/Karte des Berliner Tages), Level oder Karte (Wochen-Seed des Boards).
// Friert das aktuelle Skill-Loadout des Nutzers in der Session ein (submit-run verlangt Gleichheit mit dem Replay).
// Spec leaderboard-supabase AC-2, Spec campaigns.
import { GAME_VERSION } from '../_shared/sim.js';
import {
  MAX_RANKED_SESSIONS_PER_DAY, MAX_SESSIONS_PER_DAY, REASON_STATUS, SESSION_TTL_MS, berlinDate, levelUnlocked, loadoutError,
  loadoutFromRows, parseStartRequest, planRun,
} from '../_shared/logic.ts';
import { env, json, preflight, serviceClient, userFromRequest } from '../_shared/http.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight(req);
  if (req.method !== 'POST') return json(req, 405, { error: 'method_not_allowed' });
  const db = serviceClient();
  const user = await userFromRequest(req, db);
  if (!user) return json(req, 401, { error: 'unauthorized' });

  let body: unknown;
  try {
    const text = await req.text();
    body = text ? JSON.parse(text) : null;
  } catch {
    return json(req, REASON_STATUS.request_invalid, { error: 'request_invalid' });
  }
  const request = parseStartRequest(body);
  if ('error' in request) return json(req, REASON_STATUS[request.error], { error: request.error });

  const date = berlinDate(new Date());
  const daily = request.kind === 'daily';
  const { data: allowed, error: rateErr } = await db.rpc('bump_rate', {
    p_user: user.id, p_bucket: daily ? 'start' : 'start-ranked', p_day: date,
    p_limit: daily ? MAX_SESSIONS_PER_DAY : MAX_RANKED_SESSIONS_PER_DAY,
  });
  if (rateErr) return json(req, 500, { error: 'rate_check_failed' });
  if (!allowed) return json(req, 429, { error: 'rate_limited' });

  // Fortschritt: Skills (Loadout-Snapshot), XP (Punkte), Level-Bestwerte (Freischaltung)
  const [skills, xp, levels] = await Promise.all([
    db.from('skill_alloc').select('skill_id, rank').eq('user_id', user.id),
    db.rpc('user_xp', { p_user: user.id }),
    request.kind === 'level' ? db.from('level_results').select('level_id, best_stars').eq('user_id', user.id) : Promise.resolve(null),
  ]);
  if (skills.error || xp.error || levels?.error) return json(req, 500, { error: 'progress_failed' });
  const loadout = loadoutFromRows(skills.data as Array<{ skill_id: string; rank: number }>);
  const invalid = loadoutError(loadout, Number(xp.data ?? 0));
  if (invalid) return json(req, REASON_STATUS.loadout_invalid, { error: 'loadout_invalid', detail: invalid });
  if (request.kind === 'level') {
    const best = Object.fromEntries(((levels?.data ?? []) as Array<{ level_id: string; best_stars: number }>).map((l) => [l.level_id, l.best_stars]));
    if (!levelUnlocked(request.levelId, best)) return json(req, REASON_STATUS.level_locked, { error: 'level_locked' });
  }

  const plan = await planRun(request, date, env('DAILY_SECRET'));
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  const { data, error } = await db
    .from('run_sessions')
    .insert({
      user_id: user.id, kind: plan.kind, board: plan.board, level_id: plan.levelId, daily_date: date, seed: plan.seed,
      map_id: plan.mapId, mode: plan.mode, loadout, game_version: GAME_VERSION, expires_at: expiresAt,
    })
    .select('id, issued_at')
    .single();
  if (error || !data) return json(req, 500, { error: 'session_create_failed' });

  return json(req, 200, {
    sessionId: data.id, kind: plan.kind, board: plan.board, seed: plan.seed, mapId: plan.mapId, levelId: plan.levelId,
    mode: plan.mode, loadout, gameVersion: GAME_VERSION, dailyDate: date, issuedAt: data.issued_at, expiresAt,
  });
});
