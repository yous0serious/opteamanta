import type { SupabaseClient } from '@supabase/supabase-js';
import type { BoardId, RankPeriod, RankRow, RunVerdict } from '../meta/types';
import { GAME_VERSION, levelForXp, type MapId, type Replay } from '../sim/index';

// Browser-Anbindung an Supabase (Spec leaderboard-supabase T07, Spec campaigns, ADR-0004).
// Der Client liest nur über RPCs bzw. eigene Zeilen (RLS) und schreibt nur den eigenen Nickname;
// Läufe, Einreichungen, XP, Level-Ergebnisse, Skills und Erfolge gehen ausschließlich über die Edge Functions.

export type RunKind = 'daily' | 'level' | 'map';

/** Vom Server vergebener Lauf (start-run). `loadout` ist der eingefrorene Skill-Stand – das Replay muss ihn tragen. */
export interface RunSession {
  sessionId: string;
  kind: RunKind;
  board: BoardId;
  seed: number;
  mapId: MapId;
  levelId: string | null;
  mode: 'challenge' | 'level';
  loadout: Record<string, number>;
  gameVersion: string;
  /** Lauf-Datum (Berlin); bei Daily der Daily-Tag. */
  dailyDate: string;
  issuedAt: string;
  expiresAt: string;
}

export interface DailySession extends RunSession {
  kind: 'daily';
  mode: 'challenge';
  levelId: null;
}

/** Zeile von get_leaderboard (alte Daily-Seitenleiste, Top 10). */
export interface BoardRow {
  rank: number;
  nickname: string;
  score: number;
  wave: number;
  lives: number;
  won: boolean;
  is_me: boolean;
}

/** Rohzeile von get_board (Top 50 + eigene Umgebung). */
export interface BoardRowRaw {
  rank: number;
  nickname: string;
  score: number;
  wave: number;
  stars: number | null;
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

export type SubmissionStatus = 'pending' | 'verifying' | 'verified' | 'rejected';

export interface SubmissionState {
  status: SubmissionStatus;
  reason: string | null;
  /** Vom Server berechnet (null bis zur Prüfung). */
  score: number | null;
  wave: number | null;
  stars: number | null;
  kills: number | null;
  /** Gutgeschriebene XP (0 bis zur Prüfung bzw. bei Ablehnung). */
  xp: number;
  kind: RunKind;
  board: BoardId;
  /** Durch diesen Lauf neu freigeschaltete Erfolge. */
  newAchievements: string[];
}

export interface LevelResult {
  levelId: string;
  bestStars: 0 | 1 | 2 | 3;
  bestScore: number | null;
}

/** Eigener, serverseitig gespeicherter Fortschritt (get_progress). */
export interface Progress {
  nickname: string | null;
  xp: number;
  levels: LevelResult[];
  /** Skill-Verteilung (SkillId → Rang). */
  skills: Record<string, number>;
  achievements: Array<{ id: string; unlockedAt: string }>;
}

export interface Account {
  userId: string;
  /** Bestätigte E-Mail (Konto gesichert) oder null. */
  email: string | null;
  /** E-Mail, deren Bestätigung noch aussteht. */
  pendingEmail: string | null;
  anonymous: boolean;
}

export type Period = 'day' | 'week';
export type NicknameResult = 'ok' | 'taken' | 'invalid';
export type SkillResult = 'ok' | 'no_points' | 'locked' | 'error';
export type SecureResult = 'ok' | 'invalid' | 'taken' | 'weak' | 'error';
export type LoginResult = 'ok' | 'wrong' | 'error';
/** Mindestlänge wie Supabase Auth (Standard). */
export const MIN_PASSWORD = 6;

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
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Abfrage des Prüfstatus: alle 3 s, höchstens 120 s (Spec leaderboard-supabase T07). */
export const POLL_MS = 3000;
export const POLL_MAX_MS = 120_000;

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
const clampStars = (n: unknown): 0 | 1 | 2 | 3 => (n === 1 || n === 2 || n === 3 ? n : 0);

/** get_board-Zeile → Vertrag der Oberfläche (src/meta/types.ts). */
export function toRankRow(r: BoardRowRaw): RankRow {
  return { rank: r.rank, nickname: r.nickname, score: r.score, wave: r.wave, stars: r.stars, won: r.won, isMe: r.is_me };
}

/** Rohantwort von get_progress → Progress. */
export function toProgress(raw: unknown): Progress {
  const p = (raw ?? {}) as {
    nickname?: string | null;
    xp?: number;
    levels?: Array<{ level_id: string; best_stars: number; best_score: number | null }>;
    skills?: Record<string, number>;
    achievements?: Array<{ id: string; unlocked_at: string }>;
  };
  return {
    nickname: p.nickname ?? null,
    xp: Number(p.xp ?? 0),
    levels: (p.levels ?? []).map((l) => ({ levelId: l.level_id, bestStars: clampStars(l.best_stars), bestScore: l.best_score ?? null })),
    skills: { ...(p.skills ?? {}) },
    achievements: (p.achievements ?? []).map((a) => ({ id: a.id, unlockedAt: a.unlocked_at })),
  };
}

/** Rohzeile aus submissions → SubmissionState. */
export function toSubmissionState(row: Record<string, unknown>): SubmissionState {
  const num = (v: unknown): number | null => (typeof v === 'number' ? v : null);
  return {
    status: row.status as SubmissionStatus,
    reason: (row.reason as string | null) ?? null,
    score: num(row.score),
    wave: num(row.wave),
    stars: num(row.stars),
    kills: num(row.kills),
    xp: num(row.xp) ?? 0,
    kind: (row.kind as RunKind | undefined) ?? 'daily',
    board: row.board as BoardId,
    newAchievements: Array.isArray(row.new_achievements) ? (row.new_achievements as string[]) : [],
  };
}

/** Prüfergebnis → RunVerdict (Ergebnis-Screen). `null` = Prüfung noch nicht fertig (Zeitlimit). */
export function toVerdict(st: SubmissionState | null, xpBefore: number, rank: number | null): RunVerdict {
  if (!st || (st.status !== 'verified' && st.status !== 'rejected')) {
    return { status: 'offline', xpGained: 0, rank: null, levelUp: null, newAchievements: [] };
  }
  if (st.status === 'rejected') return { status: 'rejected', xpGained: 0, rank: null, levelUp: null, newAchievements: [] };
  const from = levelForXp(xpBefore).level;
  const to = levelForXp(xpBefore + st.xp).level;
  return { status: 'verified', xpGained: st.xp, rank, levelUp: to > from ? { from, to } : null, newAchievements: st.newAchievements };
}

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

  // ===================== Konto =====================

  async account(): Promise<Account | null> {
    if (!this.userId) await this.signIn();
    const { data, error } = await this.sb.auth.getUser();
    if (error || !data.user) return null;
    const u = data.user;
    return { userId: u.id, email: u.email || null, pendingEmail: u.new_email || null, anonymous: u.is_anonymous ?? !u.email };
  }

  /**
   * Konto sichern: E-Mail + Passwort an das (anonyme) Konto hängen – sofort aktiv, ohne Bestätigungsmail
   * (Supabase Auth „Confirm email“ aus). Gleiche Nutzer-ID, Fortschritt bleibt; andere Geräte melden sich per
   * `loginWithPassword` an.
   */
  async secureAccount(email: string, password: string): Promise<SecureResult> {
    const addr = email.trim();
    if (!EMAIL_RE.test(addr)) return 'invalid';
    if (password.length < MIN_PASSWORD) return 'weak';
    if (!this.userId) await this.signIn();
    const { error } = await this.sb.auth.updateUser({ email: addr, password });
    return secureResult(error);
  }

  /** Mit gesichertem Konto anmelden (anderes Gerät). Ersetzt das anonyme Konto dieses Geräts. */
  async loginWithPassword(email: string, password: string): Promise<LoginResult> {
    const addr = email.trim();
    if (!EMAIL_RE.test(addr) || !password) return 'wrong';
    const { data, error } = await this.sb.auth.signInWithPassword({ email: addr, password });
    if (error || !data.user) return error?.code === 'invalid_credentials' || error?.status === 400 ? 'wrong' : 'error';
    this.userId = data.user.id;
    return 'ok';
  }

  /** Abmelden (lokal); der nächste Aufruf meldet wieder anonym an. */
  async signOut(): Promise<void> {
    await this.sb.auth.signOut({ scope: 'local' });
    this.userId = null;
  }

  // ===================== Profil =====================

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

  // ===================== Fortschritt, Skills =====================

  /** XP, Level-Bestwerte, Skills und Erfolge des angemeldeten Nutzers. */
  async progress(): Promise<Progress> {
    if (!this.userId) await this.signIn();
    const { data, error } = await this.sb.rpc('get_progress');
    if (error) throw new ApiError('progress_failed', 0);
    return toProgress(data);
  }

  /** Rang eines Skills setzen (0 = entfernen). Server prüft Punkte, Höchstrang und Voraussetzungen. */
  async allocateSkill(skillId: string, rank: number): Promise<{ result: SkillResult; loadout: Record<string, number> | null }> {
    return this.skillCall({ skillId, rank });
  }

  /** Alle Skillpunkte zurückgeben (kostenlos). */
  async respec(): Promise<'ok' | 'error'> {
    return (await this.skillCall({ respec: true })).result === 'ok' ? 'ok' : 'error';
  }

  private async skillCall(body: Record<string, unknown>, retry = true): Promise<{ result: SkillResult; loadout: Record<string, number> | null }> {
    try {
      const res = await this.invoke<{ loadout: Record<string, number> }>('allocate-skill', body);
      return { result: 'ok', loadout: res.loadout };
    } catch (err) {
      const code = err instanceof ApiError ? err.code : '';
      if (code === 'conflict' && retry) return this.skillCall(body, false);
      if (code === 'no_points' || code === 'locked') return { result: code, loadout: null };
      return { result: 'error', loadout: null };
    }
  }

  // ===================== Läufe =====================

  /** Lauf beim Server holen: Daily (Tages-Seed), Level oder Karte (Challenge). */
  async startRun(kind: 'daily'): Promise<DailySession>;
  async startRun(kind: 'level' | 'map', id: string): Promise<RunSession>;
  async startRun(kind: RunKind, id?: string): Promise<RunSession> {
    const body = kind === 'level' ? { kind, levelId: id } : kind === 'map' ? { kind, mapId: id } : { kind };
    return this.invoke<RunSession>('start-run', body);
  }

  async startDaily(): Promise<DailySession> {
    return this.startRun('daily');
  }

  /** Replay (Format 3) zur Session einreichen; liefert die Einreichungs-ID. */
  async submitRun(sessionId: string, replay: Replay): Promise<string> {
    const res = await this.invoke<{ submissionId: string }>('submit-run', { sessionId, replay });
    return res.submissionId;
  }

  async submit(sessionId: string, replay: Replay): Promise<string> {
    return this.submitRun(sessionId, replay);
  }

  async submission(id: string): Promise<SubmissionState | null> {
    const { data } = await this.sb
      .from('submissions')
      .select('status, reason, score, wave, stars, kills, xp, kind, board, new_achievements')
      .eq('id', id)
      .maybeSingle();
    return data ? toSubmissionState(data as Record<string, unknown>) : null;
  }

  /** Prüfstatus abfragen, bis `verified`/`rejected` oder Zeitlimit (dann null). */
  async waitForSubmission(id: string, opts: { intervalMs?: number; timeoutMs?: number; signal?: AbortSignal } = {}): Promise<SubmissionState | null> {
    const deadline = Date.now() + (opts.timeoutMs ?? POLL_MAX_MS);
    while (Date.now() < deadline && !opts.signal?.aborted) {
      await sleep(opts.intervalMs ?? POLL_MS);
      const st = await this.submission(id).catch(() => null);
      if (st && (st.status === 'verified' || st.status === 'rejected')) return st;
    }
    return null;
  }

  /** Warten auf die Prüfung und Ergebnis für den Ergebnis-Screen (Rang im Board des Laufs, Gesamtwertung bzw. Tag). */
  async verdict(id: string, xpBefore: number, opts: { intervalMs?: number; timeoutMs?: number; signal?: AbortSignal } = {}): Promise<RunVerdict> {
    const st = await this.waitForSubmission(id, opts);
    let rank: number | null = null;
    if (st?.status === 'verified') {
      const rows = await this.board(st.board, st.kind === 'daily' ? 'day' : 'all').catch(() => []);
      rank = rows.find((r) => r.isMe)?.rank ?? null;
    }
    return toVerdict(st, xpBefore, rank);
  }

  // ===================== Ranglisten =====================

  /** Rangliste je Board (`daily:<Datum>` | `level:<id>` | `map:<id>`), Top 50 + eigene Umgebung. */
  async board(board: BoardId, period: RankPeriod, refDate: string = berlinDate()): Promise<RankRow[]> {
    const { data, error } = await this.sb.rpc('get_board', { board, period, ref_date: refDate, version: GAME_VERSION });
    if (error) throw new ApiError('leaderboard_failed', 0);
    return ((data as BoardRowRaw[] | null) ?? []).map(toRankRow);
  }

  /** Daily-Rangliste der alten Seitenleiste (Top 10 + eigene Zeile). */
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

function secureResult(error: { code?: string; status?: number } | null): SecureResult {
  if (!error) return 'ok';
  if (error.code === 'email_exists' || error.code === 'user_already_exists') return 'taken';
  if (error.code === 'weak_password') return 'weak';
  if (error.code === 'email_address_invalid' || error.code === 'validation_failed') return 'invalid';
  return 'error';
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

/** Board-ID der heutigen Daily. */
export const dailyBoard = (date: string = berlinDate()): BoardId => `daily:${date}`;

/** Lesbare Texte zu den Ablehnungsgründen der Edge Functions. */
export const REASON_TEXT: Record<string, string> = {
  request_invalid: 'Anfrage ungültig',
  kind_invalid: 'Unbekannte Spielart',
  level_unknown: 'Unbekanntes Level',
  map_unknown: 'Unbekannte Karte',
  level_locked: 'Level noch gesperrt',
  loadout_invalid: 'Skillbaum ungültig – bitte Punkte neu verteilen',
  session_unknown: 'Lauf unbekannt',
  session_used: 'Lauf wurde schon eingereicht',
  session_expired: 'Lauf abgelaufen (max. 3 Stunden)',
  seed_mismatch: 'Replay passt nicht zum gestarteten Lauf',
  map_mismatch: 'Replay passt nicht zum gestarteten Lauf',
  mode_mismatch: 'Replay passt nicht zum gestarteten Lauf',
  level_mismatch: 'Replay passt nicht zum gestarteten Lauf',
  loadout_mismatch: 'Skills passen nicht zum gestarteten Lauf',
  version_mismatch: 'Spielversion veraltet – bitte neu laden',
  replay_invalid: 'Replay ungültig',
  too_fast: 'Unplausibel schnell gespielt',
  duplicate: 'Identischer Lauf wurde schon eingereicht',
  rate_limited: 'Tageslimit erreicht',
  no_points: 'Nicht genug Skillpunkte',
  locked: 'Voraussetzung fehlt',
  conflict: 'Gleichzeitig geändert – bitte erneut versuchen',
  unauthorized: 'Anmeldung fehlgeschlagen',
  signin_failed: 'Anmeldung fehlgeschlagen',
  network: 'Server nicht erreichbar',
};

export const reasonText = (code: string): string => REASON_TEXT[code] ?? code;
