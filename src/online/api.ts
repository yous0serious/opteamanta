import type { SupabaseClient } from '@supabase/supabase-js';
import { GAME_VERSION, type MapId, type Replay } from '../sim/index';

// Browser-Anbindung an Supabase (Spec leaderboard-supabase T07, ADR-0004).
// Der Client liest nur über RPCs bzw. eigene Zeilen (RLS) und schreibt nur das eigene Profil;
// Läufe und Einreichungen gehen ausschließlich über die Edge Functions.

export interface DailySession {
  sessionId: string;
  seed: number;
  mapId: MapId;
  mode: 'challenge';
  gameVersion: string;
  dailyDate: string;
  issuedAt: string;
  expiresAt: string;
}

export interface BoardRow {
  rank: number;
  nickname: string;
  score: number;
  wave: number;
  lives: number;
  won: boolean;
  is_me: boolean;
}

export interface TickerRow {
  nickname: string;
  score: number;
  daily_date: string;
  verified_at: string;
}

export interface SubmissionState {
  status: 'pending' | 'verifying' | 'verified' | 'rejected';
  reason: string | null;
  score: number | null;
}

export type Period = 'day' | 'week';
export type NicknameResult = 'ok' | 'taken' | 'invalid';

/** Fehler einer Edge Function mit maschinenlesbarem Grund (z. B. `rate_limited`). */
export class ApiError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
  ) {
    super(code);
  }
}

/** Gleiche Regel wie der DB-Constraint auf profiles.nickname. */
export const NICKNAME_RE = /^[A-Za-zÄÖÜäöüß0-9_-][A-Za-zÄÖÜäöüß0-9 _-]{1,14}[A-Za-zÄÖÜäöüß0-9_-]$/;

export class OnlineApi {
  private userId: string | null = null;

  constructor(private readonly sb: SupabaseClient) {}

  /** Bestehende Sitzung weiterverwenden, sonst anonym anmelden. Liefert die Nutzer-ID. */
  async signIn(): Promise<string> {
    const { data } = await this.sb.auth.getSession();
    if (data.session) {
      const { data: u, error } = await this.sb.auth.getUser();
      if (!error && u.user) return (this.userId = u.user.id);
      await this.sb.auth.signOut({ scope: 'local' });
    }
    const { data: anon, error } = await this.sb.auth.signInAnonymously();
    if (error || !anon.user) throw new ApiError('signin_failed', error?.status ?? 0);
    return (this.userId = anon.user.id);
  }

  get signedIn(): boolean {
    return this.userId !== null;
  }

  async nickname(): Promise<string | null> {
    if (!this.userId) return null;
    const { data } = await this.sb.from('profiles').select('nickname').eq('user_id', this.userId).maybeSingle();
    return (data as { nickname: string } | null)?.nickname ?? null;
  }

  /** Vorhandenen Teamnamen liefern oder automatisch einen erzeugen (Spec office-makeover AC-2). */
  async ensureProfile(generate: () => string, attempts = 5): Promise<string> {
    const existing = await this.nickname();
    if (existing) return existing;
    for (let i = 0; i < attempts; i++) {
      const name = generate();
      if ((await this.setNickname(name)) === 'ok') return name;
    }
    throw new ApiError('profile_failed', 0);
  }

  async setNickname(nickname: string): Promise<NicknameResult> {
    if (!NICKNAME_RE.test(nickname)) return 'invalid';
    const userId = this.userId ?? (await this.signIn());
    const { error } = await this.sb.from('profiles').upsert({ user_id: userId, nickname }, { onConflict: 'user_id' });
    if (!error) return 'ok';
    if (error.code === '23505') return 'taken';
    if (error.code === '23514') return 'invalid';
    throw new ApiError('profile_failed', 0);
  }

  async startDaily(): Promise<DailySession> {
    return this.invoke<DailySession>('start-run', {});
  }

  async submit(sessionId: string, replay: Replay): Promise<string> {
    const res = await this.invoke<{ submissionId: string }>('submit-run', { sessionId, replay });
    return res.submissionId;
  }

  async submission(id: string): Promise<SubmissionState | null> {
    const { data } = await this.sb.from('submissions').select('status, reason, score').eq('id', id).maybeSingle();
    return (data as SubmissionState | null) ?? null;
  }

  async leaderboard(period: Period, refDate: string): Promise<BoardRow[]> {
    const { data, error } = await this.sb.rpc('get_leaderboard', { period, ref_date: refDate, version: GAME_VERSION });
    if (error) throw new ApiError('leaderboard_failed', 0);
    return (data as BoardRow[] | null) ?? [];
  }

  async ticker(since: string): Promise<TickerRow[]> {
    const { data, error } = await this.sb.rpc('get_ticker', { since, version: GAME_VERSION });
    if (error) throw new ApiError('ticker_failed', 0);
    return (data as TickerRow[] | null) ?? [];
  }

  private async invoke<T>(name: string, body: unknown): Promise<T> {
    if (!this.userId) await this.signIn();
    const { data, error } = await this.sb.functions.invoke<T>(name, { body: body as Record<string, unknown> });
    if (!error && data) return data;
    const ctx = (error as { context?: unknown } | null)?.context;
    if (ctx instanceof Response) {
      const payload = (await ctx.json().catch(() => ({}))) as { error?: string };
      throw new ApiError(payload.error ?? 'request_failed', ctx.status);
    }
    throw new ApiError('network', 0);
  }
}

/** Ohne Supabase-Variablen (lokal, E2E) → null: Spiel läuft offline, keine Netzwerkaufrufe. */
export async function createOnline(env: ImportMetaEnv = import.meta.env): Promise<OnlineApi | null> {
  const url = env.VITE_SUPABASE_URL;
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  const { createClient } = await import('@supabase/supabase-js');
  return new OnlineApi(createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'bd.auth' } }));
}

/** Kalendertag in Europe/Berlin (`YYYY-MM-DD`) – Tageswechsel der Daily Challenge. */
export function berlinDate(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

/** Lesbare Texte zu den Ablehnungsgründen der Edge Functions. */
export const REASON_TEXT: Record<string, string> = {
  session_unknown: 'Lauf unbekannt',
  session_used: 'Lauf wurde schon eingereicht',
  session_expired: 'Lauf abgelaufen (max. 3 Stunden)',
  seed_mismatch: 'Lauf passt nicht zur Daily',
  map_mismatch: 'Lauf passt nicht zur Daily',
  mode_mismatch: 'Lauf passt nicht zur Daily',
  version_mismatch: 'Spielversion veraltet – bitte neu laden',
  replay_invalid: 'Replay ungültig',
  too_fast: 'Unplausibel schnell gespielt',
  duplicate: 'Identischer Lauf wurde schon eingereicht',
  rate_limited: 'Tageslimit erreicht (30 Läufe)',
  unauthorized: 'Anmeldung fehlgeschlagen',
  signin_failed: 'Anmeldung fehlgeschlagen',
  network: 'Server nicht erreichbar',
};

export const reasonText = (code: string): string => REASON_TEXT[code] ?? code;
