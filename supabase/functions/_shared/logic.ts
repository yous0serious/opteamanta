// Reine Server-Logik (Spec leaderboard-supabase T04, Spec campaigns). Nur Web-Standards (WebCrypto, Intl),
// daher identisch in Deno (Edge Functions) und Node (Vitest) lauffähig.
import {
  CAMPAIGNS, GAME_VERSION, Game, MAPS, achievementsFor, addRunToStats, emptyStats, levelById, levelForXp, parseReplay,
  skillPointsForLevel, validateLoadout, xpForRun, type AchievementStats, type EnemyType, type MapId, type Replay,
  type ReplayResult, type RunRecord,
} from './sim.js';

/**
 * Tick-Grenze aller Server-Läufe (Daily/Karte: Challenge, Kampagne: level). Gemessen mit dem starken Bot (0.4.0):
 * Challenge bis ~110k Ticks, Level bis ~75k Ticks; Prüfung des längsten Laufs in Node ~0,25 s CPU.
 */
export const MAX_TICKS_RANKED = 200_000;
/** Höchstes Spieltempo im Client (URL-Parameter speed=1…10) – Grundlage der Echtzeit-Prüfung. */
export const MAX_SPEED = 10;
export const SESSION_TTL_MS = 3 * 60 * 60 * 1000;
/** Daily-Sessions pro Nutzer und Tag. */
export const MAX_SESSIONS_PER_DAY = 30;
/** Level- und Karten-Sessions pro Nutzer und Tag (Kampagne mit Wiederholungen). */
export const MAX_RANKED_SESSIONS_PER_DAY = 150;
/** Skill-Änderungen pro Nutzer und Tag. */
export const MAX_SKILL_CHANGES_PER_DAY = 500;
/** Höchster Rang eines Skills (DB-Constraint skill_alloc.rank). */
export const MAX_SKILL_RANK = 10;

export type RunKind = 'daily' | 'level' | 'map';
export type RunMode = 'challenge' | 'level';
export type Loadout = Record<string, number>;

export type Reason =
  | 'request_invalid'
  | 'kind_invalid'
  | 'level_unknown'
  | 'map_unknown'
  | 'level_locked'
  | 'loadout_invalid'
  | 'session_unknown'
  | 'session_used'
  | 'session_expired'
  | 'seed_mismatch'
  | 'map_mismatch'
  | 'mode_mismatch'
  | 'level_mismatch'
  | 'loadout_mismatch'
  | 'version_mismatch'
  | 'replay_invalid'
  | 'too_fast'
  | 'duplicate'
  | 'rate_limited';

export const REASON_STATUS: Record<Reason, number> = {
  request_invalid: 400,
  kind_invalid: 400,
  level_unknown: 404,
  map_unknown: 404,
  level_locked: 403,
  loadout_invalid: 409,
  session_unknown: 403,
  session_used: 409,
  session_expired: 410,
  seed_mismatch: 422,
  map_mismatch: 422,
  mode_mismatch: 422,
  level_mismatch: 422,
  loadout_mismatch: 422,
  version_mismatch: 422,
  replay_invalid: 400,
  too_fast: 422,
  duplicate: 409,
  rate_limited: 429,
};

export interface SessionRow {
  id: string;
  user_id: string;
  /** Lauf-Datum (Berlin) – bei Daily der Daily-Tag. */
  daily_date: string;
  seed: number;
  map_id: string;
  mode: string;
  game_version: string;
  issued_at: string;
  expires_at: string;
  used_at: string | null;
  /** Ab Migration 20261112200000; ältere Sessions: daily, kein Level, leeres Loadout. */
  kind?: RunKind;
  level_id?: string | null;
  board?: string;
  loadout?: unknown;
}

export type Check = { ok: true; replay: Replay } | { ok: false; status: number; reason: Reason; detail?: string };

const fail = (reason: Reason, detail?: string): Check => ({ ok: false, status: REASON_STATUS[reason], reason, detail });

// ===================== Datum, Seeds =====================

/** Kalendertag in Europe/Berlin als `YYYY-MM-DD` (Tageswechsel der Daily Challenge). */
export function berlinDate(now: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

/** ISO-Woche (Montag–Sonntag) zu einem `YYYY-MM-DD`-Datum. */
export function isoWeekRange(date: string): { from: string; to: string } {
  const d = new Date(`${date}T12:00:00Z`);
  const offset = (d.getUTCDay() + 6) % 7; // Montag = 0
  const from = new Date(d.getTime() - offset * 86_400_000);
  const to = new Date(from.getTime() + 6 * 86_400_000);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

/** ISO-Woche `YYYY-Www` zu einem `YYYY-MM-DD`-Datum (Berliner Datum → Wechsel Montag 00:00 Berlin). */
export function isoWeek(date: string): string {
  const d = new Date(`${date}T12:00:00Z`);
  const thursday = new Date(d.getTime() + (3 - ((d.getUTCDay() + 6) % 7)) * 86_400_000);
  const year = thursday.getUTCFullYear();
  const week = 1 + Math.floor((thursday.getTime() - Date.UTC(year, 0, 1, 12)) / (7 * 86_400_000));
  return `${year}-W${String(week).padStart(2, '0')}`;
}

/** Erste 32 Bit von HMAC-SHA256(secret, message) – ohne Geheimnis nicht vorhersagbar. */
async function hmacSeed(secret: string, message: string): Promise<number> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(message)));
  return ((sig[0]! << 24) | (sig[1]! << 16) | (sig[2]! << 8) | sig[3]!) >>> 0;
}

/** Tages-Seed: HMAC(secret, `daily:<date>`). */
export function dailySeed(secret: string, date: string): Promise<number> {
  return hmacSeed(secret, `daily:${date}`);
}

/**
 * Wochen-Seed eines Level-/Karten-Boards: HMAC(secret, `<board>:<YYYY-Www>`). Für alle Spieler einer Woche gleich –
 * kein Seed-Farmen per wiederholtem start-run (Wellen wären per peekWave vorab sichtbar).
 */
export function boardSeed(secret: string, board: string, week: string): Promise<number> {
  return hmacSeed(secret, `${board}:${week}`);
}

/** Karte, die das Spiel aus diesem Seed wählt (erster RNG-Zug, wie im Client). */
export function mapForSeed(seed: number): MapId {
  return new Game({ seed, mode: 'challenge' }).state.mapId;
}

// ===================== Boards =====================

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const ID_RE = /^[a-z0-9-]{1,32}$/;
/** Skill-/Erfolgs-IDs; Buchstabe am Anfang (schließt u. a. `__proto__` aus). */
const SKILL_RE = /^[A-Za-z][A-Za-z0-9_-]{0,39}$/;

export interface BoardRef {
  kind: RunKind;
  /** Datum (daily), LevelId (level) oder MapId (map). */
  key: string;
}

/** `daily:<YYYY-MM-DD>` | `level:<LevelId>` | `map:<MapId>` – gleiche Regel wie run_sessions_board_check / get_board. */
export function parseBoardId(id: unknown): BoardRef | null {
  if (typeof id !== 'string') return null;
  const i = id.indexOf(':');
  if (i < 0) return null;
  const kind = id.slice(0, i);
  const key = id.slice(i + 1);
  if (kind === 'daily') {
    if (!DATE_RE.test(key)) return null;
    const d = new Date(`${key}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === key ? { kind, key } : null;
  }
  if (kind === 'level' || kind === 'map') return ID_RE.test(key) ? { kind, key } : null;
  return null;
}

export const boardId = (kind: RunKind, key: string): string => `${kind}:${key}`;

// ===================== Start-Anfrage =====================

export type StartRequest = { kind: 'daily' } | { kind: 'level'; levelId: string } | { kind: 'map'; mapId: string };

const knownLevel = (id: string): boolean => levelById(id) !== undefined;
const knownMap = (id: string): boolean => MAPS.some((m) => m.id === id);

/** Body von start-run; `{}` (alte Clients) = Daily. Prüft IDs gegen die Sim-Daten. */
export function parseStartRequest(body: unknown): StartRequest | { error: Reason } {
  if (body === null || body === undefined) return { kind: 'daily' };
  if (typeof body !== 'object' || Array.isArray(body)) return { error: 'request_invalid' };
  const b = body as Record<string, unknown>;
  const kind = b.kind ?? 'daily';
  if (kind === 'daily') return { kind };
  if (kind === 'level') {
    if (typeof b.levelId !== 'string' || !ID_RE.test(b.levelId) || !knownLevel(b.levelId)) return { error: 'level_unknown' };
    return { kind, levelId: b.levelId };
  }
  if (kind === 'map') {
    if (typeof b.mapId !== 'string' || !knownMap(b.mapId)) return { error: 'map_unknown' };
    return { kind, mapId: b.mapId };
  }
  return { error: 'kind_invalid' };
}

export interface RunPlan {
  kind: RunKind;
  board: string;
  seed: number;
  mapId: string;
  mode: RunMode;
  levelId: string | null;
}

/**
 * Seed, Karte, Modus und Board einer neuen Session. Daily: Tages-Seed, Karte aus dem Seed; Level/Karte: Wochen-Seed
 * des Boards (ISO-Woche des Berliner Datums `date`), Karte aus den Level-Daten bzw. der Anfrage.
 */
export async function planRun(req: StartRequest, date: string, dailySecret: string): Promise<RunPlan> {
  if (req.kind === 'daily') {
    const s = await dailySeed(dailySecret, date);
    return { kind: 'daily', board: boardId('daily', date), seed: s, mapId: mapForSeed(s), mode: 'challenge', levelId: null };
  }
  const week = isoWeek(date);
  if (req.kind === 'level') {
    const level = levelById(req.levelId);
    if (!level) throw new Error(`Unbekanntes Level ${req.levelId}`);
    const board = boardId('level', req.levelId);
    return { kind: 'level', board, seed: await boardSeed(dailySecret, board, week), mapId: level.mapId, mode: 'level', levelId: req.levelId };
  }
  const board = boardId('map', req.mapId);
  return { kind: 'map', board, seed: await boardSeed(dailySecret, board, week), mapId: req.mapId, mode: 'challenge', levelId: null };
}

// ===================== Freischaltung =====================

export interface CampaignOrder {
  readonly levels: readonly string[];
}

/**
 * Level n+1 einer Kampagne nach ≥ 1 Stern in Level n; Kampagne k+1 nach dem Boss-Level (letztes Level) von k.
 * Das erste Level der ersten Kampagne ist immer offen. Unbekannte Level sind gesperrt.
 */
export function levelUnlocked(
  levelId: string, bestStars: Readonly<Record<string, number>>, campaigns: readonly CampaignOrder[] = CAMPAIGNS,
): boolean {
  for (const [ci, c] of campaigns.entries()) {
    const li = c.levels.indexOf(levelId);
    if (li < 0) continue;
    if (li > 0) return (bestStars[c.levels[li - 1]!] ?? 0) >= 1;
    if (ci === 0) return true;
    const prev = campaigns[ci - 1]!.levels;
    return prev.length > 0 && (bestStars[prev[prev.length - 1]!] ?? 0) >= 1;
  }
  return false;
}

// ===================== Loadout (Skills) =====================

/** Kanonische Form: nur Ränge > 0, Schlüssel sortiert. null = kein gültiges Loadout-Objekt. */
export function normalizeLoadout(raw: unknown): Loadout | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const out: Loadout = {};
  for (const key of Object.keys(raw).sort()) {
    const v = (raw as Record<string, unknown>)[key];
    if (!SKILL_RE.test(key) || typeof v !== 'number' || !Number.isSafeInteger(v) || v < 0 || v > MAX_SKILL_RANK) return null;
    if (v > 0) out[key] = v;
  }
  return out;
}

/** Gleiche Skills mit gleichen Rängen (Rang 0 = nicht vorhanden). */
export function sameLoadout(a: unknown, b: unknown): boolean {
  const x = normalizeLoadout(a);
  const y = normalizeLoadout(b);
  if (!x || !y) return false;
  const kx = Object.keys(x);
  return kx.length === Object.keys(y).length && kx.every((k) => x[k] === y[k]);
}

/** DB-Zeilen von skill_alloc → Loadout. */
export function loadoutFromRows(rows: ReadonlyArray<{ skill_id: string; rank: number }> | null | undefined): Loadout {
  const out: Loadout = {};
  for (const r of [...(rows ?? [])].sort((a, b) => (a.skill_id < b.skill_id ? -1 : 1))) if (r.rank > 0) out[r.skill_id] = r.rank;
  return out;
}

export const spentPoints = (loadout: Readonly<Loadout>): number => Object.values(loadout).reduce((s, r) => s + r, 0);

/** Verfügbare Skillpunkte aus den XP (Account-Level wie in der Sim: levelForXp → skillPointsForLevel). */
export const availablePoints = (xp: number): number => skillPointsForLevel(levelForXp(Math.max(0, xp)).level);

/** null = Loadout passt zu den Punkten und Regeln der Sim (Ränge, Voraussetzungen); sonst Fehlercode von validateLoadout. */
export function loadoutError(loadout: Readonly<Loadout>, xp: number): string | null {
  return validateLoadout(loadout, availablePoints(xp));
}

export type SkillChange =
  | { ok: true; loadout: Loadout; points: number }
  | { ok: false; reason: 'invalid' | 'no_points' | 'locked'; detail?: string };

/**
 * Neuen Rang eines Skills prüfen (Rang 0 = entfernen). Regeln aus der Sim (validateLoadout):
 * `points` → no_points; `requires:<id>` (Voraussetzung fehlt bzw. abhängiger Skill noch gelernt) → locked; sonst invalid.
 */
export function changeSkill(current: Readonly<Loadout>, skillId: unknown, rank: unknown, xp: number): SkillChange {
  if (typeof skillId !== 'string' || !SKILL_RE.test(skillId)) return { ok: false, reason: 'invalid' };
  if (typeof rank !== 'number' || !Number.isSafeInteger(rank) || rank < 0 || rank > MAX_SKILL_RANK) return { ok: false, reason: 'invalid' };
  const next: Loadout = { ...current };
  if (rank === 0) delete next[skillId];
  else next[skillId] = rank;
  const loadout = normalizeLoadout(next);
  if (!loadout) return { ok: false, reason: 'invalid' };
  const points = availablePoints(xp);
  const err = validateLoadout(loadout, points);
  if (err === 'points') return { ok: false, reason: 'no_points' };
  if (err?.startsWith('requires:')) return { ok: false, reason: 'locked', detail: err };
  if (err) return { ok: false, reason: 'invalid', detail: err };
  return { ok: true, loadout, points };
}

// ===================== Einreichung =====================

/** Prüft eine Einreichung gegen die Session (ohne Datenbank; Duplikate erkennt der Unique-Index). */
export function checkSubmission(session: SessionRow | null, userId: string, raw: unknown, now: Date): Check {
  if (!session || session.user_id !== userId) return fail('session_unknown');
  if (session.used_at) return fail('session_used');
  if (now.getTime() > Date.parse(session.expires_at)) return fail('session_expired');
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return fail('replay_invalid', 'kein Objekt');
  const r = raw as Record<string, unknown>;
  if (r.gameVersion !== session.game_version || session.game_version !== GAME_VERSION) return fail('version_mismatch');
  if (r.seed !== session.seed) return fail('seed_mismatch');
  if (r.mapId !== session.map_id) return fail('map_mismatch');
  if (r.mode !== session.mode) return fail('mode_mismatch');
  if ((r.levelId ?? null) !== (session.level_id ?? null)) return fail('level_mismatch');
  if (!normalizeLoadout(r.loadout)) return fail('replay_invalid', 'loadout fehlt oder ungültig');
  if (!sameLoadout(r.loadout, session.loadout ?? {})) return fail('loadout_mismatch');
  let replay: Replay;
  try {
    replay = parseReplay(raw, { maxTicks: MAX_TICKS_RANKED });
  } catch (err) {
    return fail('replay_invalid', (err as Error).message);
  }
  const elapsedMs = now.getTime() - Date.parse(session.issued_at);
  const minMs = (replay.endTick / 60 / MAX_SPEED) * 1000;
  if (elapsedMs < minMs) return fail('too_fast', `${Math.round(elapsedMs)} ms < ${Math.round(minMs)} ms`);
  return { ok: true, replay };
}

/** SHA-256 über die spielrelevanten Felder (Ergebnis zählt nicht – gleiche Eingaben = Duplikat). */
export async function replayHash(r: Replay): Promise<string> {
  const loadout = normalizeLoadout(r.loadout) ?? {};
  const canonical = JSON.stringify([r.gameVersion, r.seed, r.levelId ?? null, r.mapId, r.mode, Object.entries(loadout), r.endTick, r.commands]);
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical)));
  return Array.from(digest, (b) => b.toString(16).padStart(2, '0')).join('');
}

// ===================== Gutschrift (XP, Level-Bestwerte, Erfolge) =====================

export interface LevelBest {
  best_stars: number;
  best_score: number | null;
}

/** Bestwert-Logik wie in finish_run (SQL): Sterne und Score unabhängig voneinander maximal. */
export function mergeLevelBest(prev: LevelBest | null | undefined, stars: number, score: number): LevelBest {
  if (!prev) return { best_stars: stars, best_score: score };
  return { best_stars: Math.max(prev.best_stars, stars), best_score: prev.best_score === null ? score : Math.max(prev.best_score, score) };
}

/** Erstabschluss = erster Lauf eines Levels mit ≥ 1 Stern (wie in finish_run). */
export const isFirstClear = (prevBestStars: number | null | undefined, stars: number): boolean => (prevBestStars ?? 0) < 1 && stars >= 1;

export interface Credit {
  /** XP ohne Erstabschluss-Bonus. */
  xp: number;
  /** Zusätzliche XP, falls der Lauf ein Erstabschluss ist (entscheidet finish_run unter Sperre). */
  firstClearBonus: number;
}

/** XP nur aus dem vom Server nachgerechneten Ergebnis; Erstabschluss-Bonus nur bei Level-Läufen. */
export function creditFor(result: ReplayResult, kind: RunKind): Credit {
  const base = Math.max(0, Math.floor(xpForRun(result, { firstClear: false, won: result.won })));
  if (kind !== 'level') return { xp: base, firstClearBonus: 0 };
  const first = Math.max(0, Math.floor(xpForRun(result, { firstClear: true, won: result.won })));
  return { xp: base, firstClearBonus: Math.max(0, first - base) };
}

/** Gesamte XP nach finish_run (für Vorschau/Tests): Basis + Bonus nur beim Erstabschluss. */
export const creditedXp = (c: Credit, firstClear: boolean): number => c.xp + (firstClear ? c.firstClearBonus : 0);

/** Lauf aus Sicht der Erfolge – nur aus dem vom Server nachgerechneten Ergebnis. */
export function runRecord(
  run: { kind: RunKind; levelId: string | null; mode: RunMode; loadout: unknown },
  check: ReplayResult & { bestCombo?: number; bossesDefeated?: readonly EnemyType[] },
): RunRecord {
  return {
    levelId: run.levelId as RunRecord['levelId'],
    mode: run.mode,
    daily: run.kind === 'daily',
    won: check.won,
    stars: check.stars,
    wave: check.wave,
    kills: check.kills,
    leaks: check.leaks,
    bestCombo: check.bestCombo ?? 0,
    bossesDefeated: check.bossesDefeated ?? [],
    skillPoints: spentPoints(normalizeLoadout(run.loadout) ?? {}),
  };
}

/**
 * Neu freigeschaltete Erfolge: Statistik aller bisher geprüften Läufe (user_stats, ohne diesen Lauf) + dieser Lauf,
 * Account-Level aus den XP nach der Gutschrift; Regeln aus der Sim (achievementsFor). Bereits vorhandene entfallen.
 */
export function newAchievements(dbStats: unknown, run: RunRecord, xpAfter: number, unlocked: readonly string[]): string[] {
  const base: AchievementStats = { ...emptyStats(), ...((dbStats ?? {}) as Partial<AchievementStats>) };
  const stats = { ...addRunToStats(base, run), accountLevel: levelForXp(Math.max(0, xpAfter)).level };
  const have = new Set(unlocked);
  return achievementsFor(stats)
    .filter((id) => !have.has(id) && SKILL_RE.test(id))
    .sort();
}