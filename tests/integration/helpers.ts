// Gemeinsame Helfer der Integrationstests. Geheimnisse werden nur im Testprozess gelesen, nie ausgegeben.
import { existsSync, readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { Game, type Replay } from '../../src/sim/index';

function load(): { url: string; key: string; sk: string; verify: string } | null {
  const files = ['supabase.txt', 'supabase_secret.txt', '.agent-state/fn_secrets.json']; // secret-scan: allow (nur Dateinamen)
  if (!files.every((f) => existsSync(f))) return null;
  const cfg = readFileSync('supabase.txt', 'utf8');
  const url = cfg.match(/SUPABASE_URL=(\S+)/)?.[1];
  const key = cfg.match(/SUPABASE_KEY=(\S+)/)?.[1];
  const sk = readFileSync('supabase_secret.txt', 'utf8').trim();
  const verify = (JSON.parse(readFileSync('.agent-state/fn_secrets.json', 'utf8')) as { VERIFY_SECRET?: string }).VERIFY_SECRET;
  if (!url || !key || !sk || !verify) return null;
  return { url, key, sk, verify };
}

const cfg = load();
export const HAVE_ENV = cfg !== null;
export const SKIP_MESSAGE = 'Integrationstests übersprungen: supabase.txt, supabase_secret.txt oder .agent-state/fn_secrets.json fehlt';
const C = cfg ?? { url: '', key: '', sk: '', verify: '' };
export const URL_ = C.url;
export const VERIFY_SECRET = C.verify;

export const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
export const rand = (n = 6): string => randomBytes(n).toString('hex').slice(0, n);

export const pubHeaders = (token?: string): Record<string, string> => ({
  apikey: C.key,
  Authorization: `Bearer ${token ?? C.key}`,
  'Content-Type': 'application/json',
});
export const secretHeaders = (): Record<string, string> => ({ apikey: C.sk, Authorization: `Bearer ${C.sk}`, 'Content-Type': 'application/json' });

export interface Res<T = unknown> {
  status: number;
  body: T;
}
async function parse<T>(r: Response): Promise<Res<T>> {
  const text = await r.text();
  let body: unknown = text;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    /* Text belassen */
  }
  return { status: r.status, body: body as T };
}

export const rest = async <T = unknown>(method: string, path: string, headers: Record<string, string>, body?: unknown, extra: Record<string, string> = {}): Promise<Res<T>> =>
  parse<T>(await fetch(`${URL_}/rest/v1/${path}`, { method, headers: { ...headers, ...extra }, body: body === undefined ? undefined : JSON.stringify(body) }));

export const fn = async <T = unknown>(name: string, body: unknown, headers: Record<string, string>): Promise<Res<T>> =>
  parse<T>(await fetch(`${URL_}/functions/v1/${name}`, { method: 'POST', headers, body: JSON.stringify(body) }));

export interface TestUser {
  id: string;
  token: string;
  headers: Record<string, string>;
}
const created: string[] = [];

export async function createUser(): Promise<TestUser> {
  const email = `it-${rand(12)}@example.invalid`;
  const password = `Pw-${rand(20)}`;
  const c = await parse<{ id: string }>(
    await fetch(`${URL_}/auth/v1/admin/users`, { method: 'POST', headers: secretHeaders(), body: JSON.stringify({ email, password, email_confirm: true }) }),
  );
  if (c.status >= 300) throw new Error(`createUser failed: ${c.status}`);
  created.push(c.body.id);
  const t = await parse<{ access_token: string }>(
    await fetch(`${URL_}/auth/v1/token?grant_type=password`, { method: 'POST', headers: pubHeaders(), body: JSON.stringify({ email, password }) }),
  );
  if (t.status !== 200) throw new Error(`sign-in failed: ${t.status}`);
  return { id: c.body.id, token: t.body.access_token, headers: pubHeaders(t.body.access_token) };
}

/** Anonymer Sign-up (Projektlimit 30/h/IP – sparsam verwenden). */
export async function createAnonUser(): Promise<TestUser> {
  const s = await parse<{ access_token: string; user: { id: string } }>(
    await fetch(`${URL_}/auth/v1/signup`, { method: 'POST', headers: pubHeaders(), body: '{}' }),
  );
  if (s.status !== 200) throw new Error(`anon signup failed: ${s.status}`);
  created.push(s.body.user.id);
  return { id: s.body.user.id, token: s.body.access_token, headers: pubHeaders(s.body.access_token) };
}

export async function deleteCreatedUsers(): Promise<void> {
  for (const id of created.splice(0)) {
    await fetch(`${URL_}/auth/v1/admin/users/${id}`, { method: 'DELETE', headers: secretHeaders() });
  }
}

export interface StartRun {
  sessionId: string;
  seed: number;
  mapId: string;
  mode: string;
  gameVersion: string;
  dailyDate: string;
  issuedAt: string;
  expiresAt: string;
}
export const startRun = (u: TestUser): Promise<Res<StartRun>> => fn<StartRun>('start-run', {}, u.headers);

/** Kurzes Replay zur Session; `variant` verändert Turmplatz und Länge, damit der Eingabe-Hash eindeutig bleibt. */
export function makeReplay(seed: number, variant: number): Replay {
  const g = new Game({ seed, mode: 'challenge' });
  g.apply({ type: 'place', tower: 'dev', cx: 6 + (variant % 8), cy: 4 });
  g.apply({ type: 'startWave' });
  for (let i = 0; i < 600 + variant; i++) g.step();
  return g.toReplay();
}

export async function pollSubmission(u: TestUser, id: string, timeoutMs = 90000): Promise<{ status: string; reason: string | null; score: number | null; ms: number }> {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const r = await rest<Array<{ status: string; reason: string | null; score: number | null }>>('GET', `submissions?id=eq.${id}&select=status,reason,score`, u.headers);
    const row = r.body[0];
    if (row && (row.status === 'verified' || row.status === 'rejected')) return { ...row, ms: Date.now() - t0 };
    await sleep(1500);
  }
  throw new Error('submission not finished in time');
}
