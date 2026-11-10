// Gemeinsame HTTP-Hilfen der Edge Functions (Deno). Spec leaderboard-supabase T05.
import { createClient, type SupabaseClient, type User } from 'npm:@supabase/supabase-js@2';

const ALLOWED_ORIGINS = new Set(['https://opteamanta.netlify.app', 'http://localhost:5173', 'http://localhost:4173']);

export function env(name: string): string {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`Umgebungsvariable ${name} fehlt`);
  return v;
}

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') ?? '';
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.has(origin) ? origin : 'https://opteamanta.netlify.app',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
}

export function preflight(req: Request): Response {
  return new Response('ok', { headers: corsHeaders(req) });
}

export function json(req: Request, status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } });
}

/** Datenbank-Client mit Secret Key (umgeht RLS) – nur serverseitig. */
export function serviceClient(): SupabaseClient {
  return createClient(env('SUPABASE_URL'), env('SB_SECRET_KEY'), { auth: { persistSession: false, autoRefreshToken: false } });
}

/** Angemeldeter Nutzer aus dem Bearer-Token (auch anonyme Nutzer). */
export async function userFromRequest(req: Request, db: SupabaseClient): Promise<User | null> {
  const auth = req.headers.get('authorization') ?? '';
  const jwt = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!jwt) return null;
  const { data, error } = await db.auth.getUser(jwt);
  return error ? null : data.user;
}
