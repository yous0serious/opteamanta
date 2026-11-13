// allocate-skill: setzt den Rang eines Skills oder verteilt alle Punkte neu (Respec, kostenlos).
// Prüft serverseitig mit den Regeln der Sim (Punkte aus XP, Höchstränge, Voraussetzungen: validateLoadout) und
// schreibt mit Secret Key über replace_skill_alloc (optimistische Sperre). Spec campaigns AC-5.
// Body: { skillId: string, rank: number }  (rank 0 = entfernen)  |  { respec: true }
import { MAX_SKILL_CHANGES_PER_DAY, availablePoints, berlinDate, changeSkill, loadoutFromRows, spentPoints } from '../_shared/logic.ts';
import { json, preflight, serviceClient, userFromRequest } from '../_shared/http.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight(req);
  if (req.method !== 'POST') return json(req, 405, { error: 'method_not_allowed' });
  const db = serviceClient();
  const user = await userFromRequest(req, db);
  if (!user) return json(req, 401, { error: 'unauthorized' });

  let body: { skillId?: unknown; rank?: unknown; respec?: unknown };
  try {
    body = await req.json();
  } catch {
    return json(req, 400, { error: 'invalid' });
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return json(req, 400, { error: 'invalid' });

  const { data: allowed, error: rateErr } = await db.rpc('bump_rate', {
    p_user: user.id, p_bucket: 'skill', p_day: berlinDate(new Date()), p_limit: MAX_SKILL_CHANGES_PER_DAY,
  });
  if (rateErr) return json(req, 500, { error: 'rate_check_failed' });
  if (!allowed) return json(req, 429, { error: 'rate_limited' });

  const [rows, xpRes] = await Promise.all([
    db.from('skill_alloc').select('skill_id, rank').eq('user_id', user.id),
    db.rpc('user_xp', { p_user: user.id }),
  ]);
  if (rows.error || xpRes.error) return json(req, 500, { error: 'progress_failed' });
  const current = loadoutFromRows(rows.data as Array<{ skill_id: string; rank: number }>);
  const xp = Number(xpRes.data ?? 0);

  let next: Record<string, number>;
  if (body.respec === true) {
    next = {};
  } else {
    const change = changeSkill(current, body.skillId, body.rank, xp);
    if (!change.ok) return json(req, change.reason === 'invalid' ? 400 : 422, { error: change.reason, detail: change.detail });
    next = change.loadout;
  }

  const { data: replaced, error } = await db.rpc('replace_skill_alloc', { p_user: user.id, p_expected: current, p_loadout: next });
  if (error) return json(req, 500, { error: 'save_failed' });
  if (!replaced) return json(req, 409, { error: 'conflict' });
  return json(req, 200, { loadout: next, points: availablePoints(xp), spent: spentPoints(next) });
});
