import { test, expect, type Page } from '@playwright/test';
import { Game } from '../../src/sim/index';
import { SESSION_ID, SUBMISSION_ID, SupabaseMock, USER_ID, type MockBoardRow } from './fixtures/supabase-mock';

const OUT = '.tmp/evidence';
const SEED = 1;
/** Today in Europe/Berlin (the client only shows the daily rank for today's challenge). */
const TODAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const [, TODAY_M, TODAY_D] = TODAY.split('-');
const MAP_ID = new Game({ seed: SEED }).state.mapId;

/** Collects console errors; browser "Failed to load resource" lines for deliberately answered statuses are ignored. */
function collectErrors(page: Page, allowedStatuses: number[] = []): string[] {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const t = m.text();
    const res = /^Failed to load resource: the server responded with a status of (\d+)/.exec(t);
    if (res && allowedStatuses.includes(Number(res[1]))) return;
    errors.push(t);
  });
  page.on('pageerror', (e) => errors.push(String(e)));
  return errors;
}

const row = (rank: number, nickname: string, score: number, is_me = false): MockBoardRow => ({
  rank,
  nickname,
  score,
  wave: 30,
  lives: 50,
  won: rank === 1,
  is_me,
});

const topTen = (): MockBoardRow[] => Array.from({ length: 10 }, (_, i) => row(i + 1, `Team${i + 1}`, 20_000 - i * 1000));

async function setup(page: Page, configure?: (m: SupabaseMock) => void): Promise<SupabaseMock> {
  const mock = new SupabaseMock(page);
  mock.config.startRun = {
    status: 200,
    body: {
      sessionId: SESSION_ID,
      seed: SEED,
      mapId: MAP_ID,
      mode: 'challenge',
      gameVersion: '0.2.0',
      dailyDate: TODAY,
      issuedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 3 * 3600_000).toISOString(),
    },
  };
  configure?.(mock);
  await mock.install();
  return mock;
}

async function open(page: Page, query = 'debug=1&speed=10'): Promise<void> {
  await page.goto(`/?${query}`);
  await expect(page.locator('body[data-ready="1"]')).toHaveCount(1, { timeout: 15_000 });
  await expect(page.locator('#money')).not.toBeEmpty();
}

async function startDaily(page: Page): Promise<void> {
  await page.locator('#daily').click();
  await expect(page.locator('#lb-status')).toContainText(`📅 Daily ${TODAY_D}.${TODAY_M}.`);
}

async function playToBurnout(page: Page): Promise<void> {
  await expect(async () => {
    if (!(await page.locator('#big').innerText()).includes('NEU')) await page.keyboard.press(' ');
    await expect(page.locator('#big')).toContainText('NEU', { timeout: 1000 });
  }).toPass({ timeout: 120_000, intervals: [500] });
}

interface BdWindow {
  __bd: { game: { state: { seed: number } }; daily: { sessionId: string; seed: number } | null };
}

test.describe('offline build', () => {
  test.use({ baseURL: 'http://localhost:4173' });

  test('1 shows offline state and makes no external requests', async ({ page }) => {
    const errors = collectErrors(page);
    const hosts = new Set<string>();
    page.on('request', (r) => {
      const u = new URL(r.url());
      // data:/blob: (Phaser-Texturen) sind lokal; geprüft werden nur Netzwerk-Requests
      if (u.protocol === 'http:' || u.protocol === 'https:') hosts.add(u.hostname);
    });
    await open(page, 'seed=7&map=waterfall');
    await expect(page.locator('#lb-status')).toHaveText('Bestenliste offline');
    await expect(page.locator('#daily')).toBeHidden();
    await expect(page.locator('#lb-tabs')).toBeHidden();
    expect([...hosts].filter((h) => h !== 'localhost')).toEqual([]);
    expect(errors).toEqual([]);
  });
});

test.describe('online build (mocked Supabase)', () => {
  test.use({ baseURL: 'http://localhost:4175' });

  test('2 anonymous signup, top 10 plus own row, week tab, ticker', async ({ page }) => {
    const errors = collectErrors(page);
    const mock = await setup(page, (m) => {
      m.config.board.day = [...topTen(), row(14, 'MeTeam', 5_000, true)];
      m.config.board.week = [row(1, 'WeekHero', 99_999)];
      m.config.ticker = [{ nickname: 'Rekord-Rita', score: 12_345, daily_date: '2026-11-10', verified_at: '2026-11-10T09:00:00Z' }];
    });
    await open(page);
    await expect(page.locator('#lb-list li[data-rank]')).toHaveCount(11);
    await expect(page.locator('#lb-list li.gap')).toHaveText('…');
    const items = page.locator('#lb-list > li');
    await expect(items.nth(10)).toHaveClass(/gap/);
    await expect(items.nth(11)).toHaveClass(/me/);
    await expect(items.nth(11)).toHaveAttribute('data-rank', '14');
    await expect(items.nth(11).locator('.nk')).toHaveText('MeTeam');
    await expect(items.nth(11).locator('.sc')).toHaveText('5.000');
    await expect(items.nth(0).locator('.rk')).toHaveText('1.');
    await expect(items.nth(0).locator('.wv')).toHaveText('🏁');
    await expect(items.nth(1).locator('.wv')).toHaveText('W30');
    await expect(page.locator('#tk')).toContainText('+++ NEUER TAGESREKORD: Rekord-Rita mit 12.345 Punkten +++');

    expect(mock.find('POST', '/auth/v1/signup')).toHaveLength(1);
    const first = mock.find('POST', '/rpc/get_leaderboard')[0]!;
    expect(first.body).toMatchObject({ period: 'day', version: '0.2.0' });
    expect((first.body as { ref_date: string }).ref_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    await page.locator('#lb-tabs button[data-period=week]').click();
    await expect(page.locator('#lb-list .nk')).toHaveText(['WeekHero']);
    expect(mock.find('POST', '/rpc/get_leaderboard').some((r) => (r.body as { period: string }).period === 'week')).toBe(true);
    expect(mock.find('POST', '/auth/v1/signup')).toHaveLength(1);
    expect(errors).toEqual([]);
  });

  test('3 nickname HTML is rendered as plain text', async ({ page }) => {
    const errors = collectErrors(page);
    const evil = '<img src=x onerror=alert(1)>';
    await setup(page, (m) => {
      m.config.board.day = [row(1, evil, 1000)];
    });
    let dialogs = 0;
    page.on('dialog', (d) => {
      dialogs++;
      void d.dismiss();
    });
    await open(page);
    await expect(page.locator('#lb-list .nk')).toHaveText([evil]);
    await expect(page.locator('#lb-list img')).toHaveCount(0);
    expect(dialogs).toBe(0);
    expect(errors).toEqual([]);
  });

  test('4 full daily flow: dialog, validation, taken, submit, verified', async ({ page }) => {
    test.setTimeout(180_000);
    const errors = collectErrors(page, [409]);
    const mock = await setup(page, (m) => {
      m.config.profileResults = [
        { status: 409, body: { code: '23505', message: 'duplicate key', details: '', hint: '' } },
        { status: 201 },
      ];
      m.config.submission = { status: 'verified', reason: null, score: 4242 };
    });
    await open(page);
    await startDaily(page);
    await expect(page.locator('#map')).toContainText('· 📅 Daily');
    const bd = await page.evaluate(() => {
      const w = window as unknown as BdWindow;
      return { seed: w.__bd.game.state.seed, daily: w.__bd.daily };
    });
    expect(bd.seed).toBe(SEED);
    expect(bd.daily?.sessionId).toBe(SESSION_ID);

    await playToBurnout(page);
    const dlg = page.locator('dialog#nick');
    await expect(dlg).toBeVisible();
    await expect(dlg.locator('h2')).toHaveText('Wie heißt dein Team?');
    await expect(page.locator('#nick-cancel')).toHaveText('Später');

    await page.locator('#nick-input').fill('x!');
    await page.locator('#nick-ok').click();
    await expect(page.locator('#nick-msg')).toContainText('Ungültig');
    expect(mock.find('POST', '/rest/v1/profiles')).toHaveLength(0);

    await page.locator('#nick-input').fill('Team Kanban');
    await page.locator('#nick-ok').click();
    await expect(page.locator('#nick-msg')).toContainText('Name schon vergeben');
    await expect(dlg).toBeVisible();

    // After the verified answer the leaderboard contains the own row.
    mock.config.board.day = [...topTen(), row(14, 'Team Kanban', 4242, true)];
    await page.locator('#nick-ok').click();
    await expect(dlg).toHaveCount(0);

    await expect(page.locator('#lb-status')).toContainText('✅ Geprüft: Score 4242 · Tagesrang 14', { timeout: 20_000 });
    const profilePosts = mock.find('POST', '/rest/v1/profiles');
    expect(profilePosts).toHaveLength(2);
    expect(profilePosts[1]!.query.get('on_conflict')).toBe('user_id');
    expect(profilePosts[1]!.body).toMatchObject({ user_id: USER_ID, nickname: 'Team Kanban' });

    const submits = mock.find('POST', '/functions/v1/submit-run');
    expect(submits).toHaveLength(1);
    const sb = submits[0]!.body as { sessionId: string; replay: { seed: number } };
    expect(sb.sessionId).toBe(SESSION_ID);
    expect(sb.replay.seed).toBe(SEED);
    const poll = mock.find('GET', '/rest/v1/submissions')[0]!;
    expect(poll.query.get('id')).toBe(`eq.${SUBMISSION_ID}`);
    await page.screenshot({ path: `${OUT}/lb-e2e-verified.png` });
    expect(errors).toEqual([]);
  });

  test('5 rejected submission', async ({ page }) => {
    test.setTimeout(180_000);
    const errors = collectErrors(page);
    await setup(page, (m) => {
      m.config.nickname = 'Team Kanban';
      m.config.submission = { status: 'rejected', reason: 'Ergebnis stimmt nicht', score: null };
    });
    await open(page);
    await startDaily(page);
    await playToBurnout(page);
    await expect(page.locator('#lb-status')).toContainText('❌ Abgelehnt: Ergebnis stimmt nicht', { timeout: 20_000 });
    expect(errors).toEqual([]);
  });

  test('6 start-run 429 shows rate limit', async ({ page }) => {
    const errors = collectErrors(page, [429]);
    await setup(page, (m) => {
      m.config.startRun = { status: 429, body: { error: 'rate_limited' } };
    });
    await open(page);
    await page.locator('#daily').click();
    await expect(page.locator('#lb-status')).toHaveText('⚠️ Daily nicht verfügbar: Tageslimit erreicht (30 Läufe)');
    expect(errors).toEqual([]);
  });

  test('7 "Später" leaves a retry button that reopens the dialog', async ({ page }) => {
    test.setTimeout(180_000);
    const errors = collectErrors(page);
    const mock = await setup(page);
    await open(page);
    await startDaily(page);
    await playToBurnout(page);
    await expect(page.locator('dialog#nick')).toBeVisible();
    await page.locator('#nick-cancel').click();
    await expect(page.locator('dialog#nick')).toHaveCount(0);
    await expect(page.locator('#lb-status')).toContainText('Nicht eingereicht – ohne Teamnamen keine Bestenliste.');
    await expect(page.locator('#lb-action')).toHaveText('📤 Einreichen');
    expect(mock.find('POST', '/functions/v1/submit-run')).toHaveLength(0);
    await page.locator('#lb-action').click();
    await expect(page.locator('dialog#nick')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('8 submit 500 shows error and retry succeeds', async ({ page }) => {
    test.setTimeout(180_000);
    const errors = collectErrors(page, [500]);
    const mock = await setup(page, (m) => {
      m.config.nickname = 'Team Kanban';
      m.config.submitResults = [
        { status: 500, body: { error: 'internal' } },
        { status: 202, body: { submissionId: SUBMISSION_ID, status: 'pending' } },
      ];
    });
    await open(page);
    await startDaily(page);
    await playToBurnout(page);
    await expect(page.locator('#lb-status')).toContainText('⚠️ Einreichen fehlgeschlagen');
    await expect(page.locator('#lb-action')).toBeVisible();
    await page.locator('#lb-action').click();
    await expect(page.locator('#lb-status')).toContainText('✅ Geprüft: Score 4242', { timeout: 20_000 });
    expect(mock.find('POST', '/functions/v1/submit-run')).toHaveLength(2);
    expect(errors).toEqual([]);
  });

  test('9 existing profile submits without dialog', async ({ page }) => {
    test.setTimeout(180_000);
    const errors = collectErrors(page);
    const mock = await setup(page, (m) => {
      m.config.nickname = 'Team Kanban';
    });
    await open(page);
    await startDaily(page);
    await playToBurnout(page);
    await expect(page.locator('#lb-status')).toContainText('✅ Geprüft: Score 4242', { timeout: 20_000 });
    await expect(page.locator('dialog#nick')).toHaveCount(0);
    expect(mock.find('POST', '/rest/v1/profiles')).toHaveLength(0);
    const get = mock.find('GET', '/rest/v1/profiles')[0]!;
    expect(get.query.get('user_id')).toBe(`eq.${USER_ID}`);
    // postgrest-js maybeSingle(): no Accept override (`*/*`), list response ([] or one row), cardinality checked client-side.
    expect(get.headers['accept']).toBe('*/*');
    expect(mock.find('POST', '/functions/v1/submit-run')).toHaveLength(1);
    expect(errors).toEqual([]);
  });
});
