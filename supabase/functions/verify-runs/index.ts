// verify-runs: prüft genau eine wartende Einreichung durch Nachrechnen (eigenes CPU-Budget pro Aufruf) und schreibt
// XP, Level-Bestwert und Erfolge gut – ausschließlich aus dem vom Server berechneten Ergebnis.
// Aufgerufen von submit-run und minütlich per pg_cron. Spec leaderboard-supabase AC-4/AC-5, Spec campaigns, ADR-0004.
import { parseReplay, runReplay, type ReplayCheck } from '../_shared/sim.js';
import {
  MAX_TICKS_RANKED, creditFor, isFirstClear, newAchievements, runRecord, type Credit, type RunKind, type RunMode,
} from '../_shared/logic.ts';
import { env, serviceClient } from '../_shared/http.ts';

interface Claimed {
  id: string;
  user_id: string;
  kind: RunKind;
  level_id: string | null;
  mode: RunMode;
  loadout: unknown;
  replay: unknown;
}

const reply = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method !== 'POST') return reply(405, { error: 'method_not_allowed' });
  if (req.headers.get('x-verify-secret') !== env('VERIFY_SECRET')) return reply(401, { error: 'unauthorized' });

  const db = serviceClient();
  const { data, error } = await db.rpc('claim_submission');
  if (error) return reply(500, { error: 'claim_failed' });
  const sub = (data as Claimed[] | null)?.[0];
  if (!sub) return reply(200, { idle: true });

  let status: 'verified' | 'rejected' = 'rejected';
  let reason: string | null = null;
  let result: ReplayCheck | null = null;
  const t0 = performance.now();
  try {
    const replay = parseReplay(sub.replay, { maxTicks: MAX_TICKS_RANKED });
    const check = runReplay(replay);
    result = check;
    if (check.matches) status = 'verified';
    else reason = 'Ergebnis stimmt nicht';
  } catch (err) {
    reason = `Replay ungültig: ${(err as Error).message}`.slice(0, 300);
  }
  const cpuMs = Math.round(performance.now() - t0);

  // Gutschrift nur für geprüfte Läufe; Erstabschluss und Doppelgutschrift entscheidet finish_run unter Sperre.
  let credit: Credit = { xp: 0, firstClearBonus: 0 };
  let achievements: string[] = [];
  if (status === 'verified' && result) {
    credit = creditFor(result, sub.kind);
    try {
      const [stats, unlocked, xp, prev] = await Promise.all([
        db.rpc('user_stats', { p_user: sub.user_id }),
        db.from('achievements_unlocked').select('achievement_id').eq('user_id', sub.user_id),
        db.rpc('user_xp', { p_user: sub.user_id }),
        sub.level_id
          ? db.from('level_results').select('best_stars').eq('user_id', sub.user_id).eq('level_id', sub.level_id).maybeSingle()
          : Promise.resolve(null),
      ]);
      if (stats.error || unlocked.error || xp.error || prev?.error) throw new Error('Fortschritt nicht lesbar');
      const first = sub.level_id !== null && isFirstClear((prev?.data as { best_stars: number } | null)?.best_stars, result.stars);
      achievements = newAchievements(
        stats.data,
        runRecord({ kind: sub.kind, levelId: sub.level_id, mode: sub.mode, loadout: sub.loadout }, result),
        Number(xp.data ?? 0) + credit.xp + (first ? credit.firstClearBonus : 0),
        ((unlocked.data ?? []) as Array<{ achievement_id: string }>).map((a) => a.achievement_id),
      );
    } catch (err) {
      // Erfolge holt der nächste geprüfte Lauf nach (Statistik kommt aus der DB); XP und Bestwerte gehen trotzdem durch.
      console.error(`Erfolge für ${sub.id} übersprungen: ${(err as Error).message}`);
      achievements = [];
    }
  }

  const { data: fin, error: finErr } = await db.rpc('finish_run', {
    p_id: sub.id, p_status: status, p_reason: reason, p_score: result?.score ?? null, p_wave: result?.wave ?? null,
    p_lives: result?.lives ?? null, p_won: result?.won ?? null, p_kills: result?.kills ?? null, p_stars: result?.stars ?? null,
    p_leaks: result?.leaks ?? null, p_best_combo: result?.bestCombo ?? null, p_bosses: result?.bossesDefeated ?? [],
    p_xp: credit.xp, p_first_clear_bonus: credit.firstClearBonus, p_achievements: achievements,
  });
  if (finErr) return reply(500, { error: 'finish_failed', id: sub.id });
  const granted = fin as { xp: number; firstClear: boolean; achievements: string[] } | null;
  return reply(200, { id: sub.id, status, reason, cpuMs, xp: granted?.xp ?? 0, achievements: granted?.achievements ?? [] });
});
