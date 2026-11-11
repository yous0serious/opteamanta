import type { Page, Route } from '@playwright/test';

export const SUPABASE_URL = 'http://supabase.test';
export const USER_ID = '11111111-2222-4333-8444-555555555555';
export const SESSION_ID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
export const SUBMISSION_ID = '99999999-8888-4777-8666-555555555555';

export interface MockBoardRow {
  rank: number;
  nickname: string;
  score: number;
  wave: number;
  lives: number;
  won: boolean;
  is_me: boolean;
}

export interface MockRequest {
  method: string;
  path: string;
  query: URLSearchParams;
  headers: Record<string, string>;
  body: unknown;
}

export interface MockResponse {
  status: number;
  body?: unknown;
}

export interface MockConfig {
  /** Existing profile nickname (null = no row). */
  nickname: string | null;
  /** Answers to POST /rest/v1/profiles, consumed in order; the last one repeats. */
  profileResults: MockResponse[];
  startRun: MockResponse;
  /** Answers to POST /functions/v1/submit-run, consumed in order; the last one repeats. */
  submitResults: MockResponse[];
  /** Answer to GET /rest/v1/submissions (single row or null). */
  submission: { status: string; reason: string | null; score: number | null } | null;
  board: { day: MockBoardRow[]; week: MockBoardRow[] };
  ticker: Array<{ nickname: string; score: number; daily_date: string; verified_at: string }>;
}

export function defaultConfig(): MockConfig {
  return {
    nickname: null,
    profileResults: [{ status: 201 }],
    startRun: { status: 200 },
    submitResults: [{ status: 202, body: { submissionId: SUBMISSION_ID, status: 'pending' } }],
    submission: { status: 'verified', reason: null, score: 4242 },
    board: { day: [], week: [] },
    ticker: [],
  };
}

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'access-control-expose-headers': '*',
};

/** Small configurable Supabase stand-in (GoTrue, PostgREST, Edge Functions) that records requests. */
export class SupabaseMock {
  readonly requests: MockRequest[] = [];
  readonly config: MockConfig = defaultConfig();
  private profileCalls = 0;
  private submitCalls = 0;

  constructor(private readonly page: Page) {}

  async install(): Promise<void> {
    await this.page.route(`${SUPABASE_URL}/**`, (route) => this.handle(route));
  }

  find(method: string, pathPart: string): MockRequest[] {
    return this.requests.filter((r) => r.method === method && r.path.includes(pathPart));
  }

  private json(route: Route, status: number, body?: unknown): Promise<void> {
    if (body === undefined) return route.fulfill({ status, headers: CORS });
    return route.fulfill({ status, headers: { ...CORS, 'content-type': 'application/json' }, body: JSON.stringify(body) });
  }

  private async handle(route: Route): Promise<void> {
    const req = route.request();
    if (req.method() === 'OPTIONS') {
      const asked = req.headers()['access-control-request-headers'] ?? '*';
      await route.fulfill({ status: 204, headers: { ...CORS, 'access-control-allow-headers': asked, 'access-control-max-age': '600' } });
      return;
    }
    const url = new URL(req.url());
    const text = req.postData();
    let body: unknown = null;
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        body = text;
      }
    }
    const method = req.method();
    const path = url.pathname;
    this.requests.push({ method, path, query: url.searchParams, headers: req.headers(), body });
    const c = this.config;

    if (path === '/auth/v1/signup') {
      const now = Math.floor(Date.now() / 1000);
      return this.json(route, 200, {
        access_token: 'e2e-access-token', // secret-scan: allow (Mock-Dummy)
        token_type: 'bearer',
        expires_in: 3600,
        expires_at: now + 3600,
        refresh_token: 'e2e-refresh', // secret-scan: allow (Mock-Dummy)
        user: {
          id: USER_ID,
          aud: 'authenticated',
          role: 'authenticated',
          is_anonymous: true,
          app_metadata: {},
          user_metadata: {},
          created_at: new Date().toISOString(),
        },
      });
    }
    if (path === '/rest/v1/rpc/get_leaderboard') {
      const period = (body as { period?: string } | null)?.period;
      return this.json(route, 200, period === 'week' ? c.board.week : c.board.day);
    }
    if (path === '/rest/v1/rpc/get_ticker') return this.json(route, 200, c.ticker);
    if (path === '/functions/v1/start-run') return this.json(route, c.startRun.status, c.startRun.body);
    if (path === '/functions/v1/submit-run') {
      const r = c.submitResults[Math.min(this.submitCalls++, c.submitResults.length - 1)]!;
      return this.json(route, r.status, r.body);
    }
    if (path === '/rest/v1/profiles' && method === 'GET') {
      return this.json(route, 200, c.nickname ? [{ nickname: c.nickname }] : []);
    }
    if (path === '/rest/v1/profiles' && method === 'POST') {
      const r = c.profileResults[Math.min(this.profileCalls++, c.profileResults.length - 1)]!;
      return this.json(route, r.status, r.body);
    }
    if (path === '/rest/v1/submissions') return this.json(route, 200, c.submission ? [c.submission] : []);
    return this.json(route, 404, { error: 'unmocked', path });
  }
}
