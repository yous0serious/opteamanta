// Reine Server-Logik der Bestenliste (Spec leaderboard-supabase T04). Nur Web-Standards (WebCrypto, Intl),
// daher identisch in Deno (Edge Functions) und Node (Vitest) lauffähig.
import { GAME_VERSION, Game, parseReplay, type MapId, type Replay } from './sim.js';

export const MAX_TICKS_CHALLENGE = 200_000;
/** Höchstes Spieltempo im Client (URL-Parameter speed=1…10) – Grundlage der Echtzeit-Prüfung. */
export const MAX_SPEED = 10;
export const SESSION_TTL_MS = 3 * 60 * 60 * 1000;
export const MAX_SESSIONS_PER_DAY = 30;

export type Reason =
  | 'session_unknown'
  | 'session_used'
  | 'session_expired'
  | 'seed_mismatch'
  | 'map_mismatch'
  | 'mode_mismatch'
  | 'version_mismatch'
  | 'replay_invalid'
  | 'too_fast'
  | 'duplicate'
  | 'rate_limited';

export const REASON_STATUS: Record<Reason, number> = {
  session_unknown: 403,
  session_used: 409,
  session_expired: 410,
  seed_mismatch: 422,
  map_mismatch: 422,
  mode_mismatch: 422,
  version_mismatch: 422,
  replay_invalid: 400,
  too_fast: 422,
  duplicate: 409,
  rate_limited: 429,
};

export interface SessionRow {
  id: string;
  user_id: string;
  daily_date: string;
  seed: number;
  map_id: string;
  mode: string;
  game_version: string;
  issued_at: string;
  expires_at: string;
  used_at: string | null;
}

export type Check = { ok: true; replay: Replay } | { ok: false; status: number; reason: Reason; detail?: string };

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

/** Tages-Seed: erste 32 Bit von HMAC-SHA256(secret, date) – ohne Geheimnis nicht vorhersagbar. */
export async function dailySeed(secret: string, date: string): Promise<number> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(`daily:${date}`)));
  return ((sig[0]! << 24) | (sig[1]! << 16) | (sig[2]! << 8) | sig[3]!) >>> 0;
}

/** Karte, die das Spiel aus diesem Seed wählt (erster RNG-Zug, wie im Client). */
export function mapForSeed(seed: number): MapId {
  return new Game({ seed, mode: 'challenge' }).state.mapId;
}

const fail = (reason: Reason, detail?: string): Check => ({ ok: false, status: REASON_STATUS[reason], reason, detail });

/** Prüft eine Einreichung gegen die Session (ohne Datenbank; Duplikate erkennt der Unique-Index). */
export function checkSubmission(session: SessionRow | null, userId: string, raw: unknown, now: Date): Check {
  if (!session || session.user_id !== userId) return fail('session_unknown');
  if (session.used_at) return fail('session_used');
  if (now.getTime() > Date.parse(session.expires_at)) return fail('session_expired');
  if (!raw || typeof raw !== 'object') return fail('replay_invalid', 'kein Objekt');
  const r = raw as Record<string, unknown>;
  if (r.gameVersion !== session.game_version || session.game_version !== GAME_VERSION) return fail('version_mismatch');
  if (r.seed !== session.seed) return fail('seed_mismatch');
  if (r.mapId !== session.map_id) return fail('map_mismatch');
  if (r.mode !== session.mode) return fail('mode_mismatch');
  let replay: Replay;
  try {
    replay = parseReplay(raw, { maxTicks: MAX_TICKS_CHALLENGE });
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
  const canonical = JSON.stringify([r.gameVersion, r.seed, r.mapId, r.mode, r.endTick, r.commands]);
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical)));
  return Array.from(digest, (b) => b.toString(16).padStart(2, '0')).join('');
}
