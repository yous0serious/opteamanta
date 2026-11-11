import { test, expect, type Page } from '@playwright/test';
import { Game } from '../../src/sim/index';
import { SESSION_ID, SUBMISSION_ID, SupabaseMock, USER_ID, type MockBoardRow } from './fixtures/supabase-mock';

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

const NAME_RE =
  /^(Agile|Lean|Swift|Bold|Rapid|Smart|Lucky|Happy|Brave|Quick|Calm|Epic|Mega|Turbo|Super|Hyper|Witty|Jolly|Fancy|Zen) (Otter|Panda|Koala|Lynx|Fox|Owl|Yak|Gnu|Llama|Bison|Moose|Eagle|Shark|Whale|Tiger|Hippo|Sloth|Squid|Gecko|Lemur) \d{4}$/;

/** Daily starts by itself after boot (AC-1). */
async function expectDailyRunning(page: Page): Promise<void> {
  await expect(page.locator('#lb-status')).toContainText(`Daily ${TODAY_D}.${TODAY_M}.`);
  await expect(page.locator('#map')).toContainText('Daily');
  await expect(page.locator('#play-kind button[data-kind=daily]')).toHaveClass(/active/);
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
      if (u.protocol === 'http:' || u.protocol === 'https:') hosts.add(u.hostname);
    });
    await open(page, 'seed=7&map=waterfall');
    await expect(page.locator('#lb-status')).toHaveText('Bestenliste offline');
    await expect(page.locator('#play-kind')).toBeHidden();
    await expect(page.locator('#team-name')).toBeHidden();
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

  test('4 boot: generated team name, auto daily, one start-run', async ({ page }) => {
    const errors = collectErrors(page);
    const mock = await setup(page);
    await open(page);
    await expectDailyRunning(page);
    const gets = mock.find('GET', '/rest/v1/profiles');
    expect(gets[0]!.query.get('select')).toBe('nickname');
    expect(gets[0]!.query.get('user_id')).toBe(`eq.${USER_ID}`);
    const posts = mock.find('POST', '/rest/v1/profiles');
    expect(posts).toHaveLength(1);
    expect(posts[0]!.query.get('on_conflict')).toBe('user_id');
    const name = (posts[0]!.body as { nickname: string }).nickname;
    expect(name).toMatch(NAME_RE);
    expect(posts[0]!.body).toMatchObject({ user_id: USER_ID });
    await expect(page.locator('#team-name')).toBeVisible();
    await expect(page.locator('#team-name')).toHaveText(`Team: ${name}`);
    expect(mock.find('POST', '/functions/v1/start-run')).toHaveLength(1);
    const daily = await page.evaluate(() => (window as unknown as BdWindow).__bd.daily);
    expect(daily?.seed).toBe(SEED);
    expect(daily?.sessionId).toBe(SESSION_ID);
    expect(errors).toEqual([]);
  });

  test('5 name collision retries with a new name', async ({ page }) => {
    const errors = collectErrors(page, [409]);
    const mock = await setup(page, (m) => {
      m.config.profileResults = [
        { status: 409, body: { code: '23505', message: 'duplicate key', details: '', hint: '' } },
        { status: 409, body: { code: '23505', message: 'duplicate key', details: '', hint: '' } },
        { status: 201 },
      ];
    });
    await open(page);
    await expectDailyRunning(page);
    const posts = mock.find('POST', '/rest/v1/profiles');
    expect(posts).toHaveLength(3);
    for (const p of posts) expect((p.body as { nickname: string }).nickname).toMatch(NAME_RE);
    const last = (posts[2]!.body as { nickname: string }).nickname;
    await expect(page.locator('#team-name')).toHaveText(`Team: ${last}`);
    expect(errors).toEqual([]);
  });

  test('6 existing profile: no upsert, name shown', async ({ page }) => {
    const errors = collectErrors(page);
    const mock = await setup(page, (m) => {
      m.config.nickname = 'Team Kanban';
    });
    await open(page);
    await expectDailyRunning(page);
    await expect(page.locator('#team-name')).toHaveText('Team: Team Kanban');
    expect(mock.find('POST', '/rest/v1/profiles')).toHaveLength(0);
    expect(errors).toEqual([]);
  });

  test('7 game end submits without dialog, verified with daily rank', async ({ page }) => {
    test.setTimeout(180_000);
    const errors = collectErrors(page);
    const mock = await setup(page, (m) => {
      m.config.board.day = [...topTen(), row(14, 'MeTeam', 4242, true)];
    });
    await open(page);
    await expectDailyRunning(page);
    await playToBurnout(page);
    await expect(page.locator('#lb-status')).toContainText('Wird geprüft…');
    await expect(page.locator('#lb-status')).toContainText('Geprüft: Score 4242 · Tagesrang 14', { timeout: 20_000 });
    await expect(page.locator('dialog#nick')).toHaveCount(0);
    const submits = mock.find('POST', '/functions/v1/submit-run');
    expect(submits).toHaveLength(1);
    const sb = submits[0]!.body as { sessionId: string; replay: { seed: number } };
    expect(sb.sessionId).toBe(SESSION_ID);
    expect(sb.replay.seed).toBe(SEED);
    expect(mock.find('GET', '/rest/v1/submissions')[0]!.query.get('id')).toBe(`eq.${SUBMISSION_ID}`);
    expect(errors).toEqual([]);
  });

  test('8 rejected submission', async ({ page }) => {
    test.setTimeout(180_000);
    const errors = collectErrors(page);
    await setup(page, (m) => {
      m.config.submission = { status: 'rejected', reason: 'Ergebnis stimmt nicht', score: null };
    });
    await open(page);
    await expectDailyRunning(page);
    await playToBurnout(page);
    await expect(page.locator('#lb-status')).toContainText('Abgelehnt: Ergebnis stimmt nicht', { timeout: 20_000 });
    await expect(page.locator('dialog#nick')).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('9 submit 500 shows error and retry succeeds', async ({ page }) => {
    test.setTimeout(180_000);
    const errors = collectErrors(page, [500]);
    const mock = await setup(page, (m) => {
      m.config.submitResults = [
        { status: 500, body: { error: 'internal' } },
        { status: 202, body: { submissionId: SUBMISSION_ID, status: 'pending' } },
      ];
    });
    await open(page);
    await expectDailyRunning(page);
    await playToBurnout(page);
    await expect(page.locator('#lb-status')).toContainText('Einreichen fehlgeschlagen');
    await expect(page.locator('#lb-action')).toHaveText('Erneut einreichen');
    await page.locator('#lb-action').click();
    await expect(page.locator('#lb-status')).toContainText('Geprüft: Score 4242', { timeout: 20_000 });
    expect(mock.find('POST', '/functions/v1/submit-run')).toHaveLength(2);
    expect(errors).toEqual([]);
  });

  test('10 Space and #big after game end start a new daily', async ({ page }) => {
    test.setTimeout(180_000);
    const errors = collectErrors(page);
    const mock = await setup(page);
    await open(page);
    await expectDailyRunning(page);
    await playToBurnout(page);
    expect(mock.find('POST', '/functions/v1/start-run')).toHaveLength(1);
    await page.keyboard.press(' ');
    await expect.poll(() => mock.find('POST', '/functions/v1/start-run').length).toBe(2);
    await expect(page.locator('#big')).not.toContainText('NEU');
    await expectDailyRunning(page);
    await playToBurnout(page);
    await page.locator('#big').click();
    await expect.poll(() => mock.find('POST', '/functions/v1/start-run').length).toBe(3);
    await expect(page.locator('#big')).not.toContainText('NEU');
    expect(errors).toEqual([]);
  });

  test('11 free play: no daily, no submit, switch back to daily', async ({ page }) => {
    test.setTimeout(180_000);
    const errors = collectErrors(page);
    const mock = await setup(page);
    let confirms = 0;
    page.on('dialog', (d) => {
      confirms++;
      void d.accept();
    });
    await open(page);
    await expectDailyRunning(page);
    // start a wave so that a running game exists -> confirm appears
    await page.keyboard.press(' ');
    await expect(page.locator('#big')).not.toContainText('NEU');
    await page.locator('#play-kind button[data-kind=free]').click();
    expect(confirms).toBe(1);
    await expect(page.locator('#play-kind button[data-kind=free]')).toHaveClass(/active/);
    await expect(page.locator('#lb-status')).toHaveText('Freies Spiel – Ergebnisse zählen nicht für die Bestenliste.');
    expect(await page.evaluate(() => (window as unknown as BdWindow).__bd.daily)).toBeNull();
    await playToBurnout(page);
    await page.waitForTimeout(500); // negative check: give a wrongly triggered submit time to appear
    expect(mock.find('POST', '/functions/v1/submit-run')).toHaveLength(0);
    expect(mock.find('POST', '/functions/v1/start-run')).toHaveLength(1);
    await page.locator('#play-kind button[data-kind=daily]').click();
    await expect.poll(() => mock.find('POST', '/functions/v1/start-run').length).toBe(2);
    await expectDailyRunning(page);
    expect(errors).toEqual([]);
  });

  test('12 start-run 429 falls back to free play with retry', async ({ page }) => {
    const errors = collectErrors(page, [429]);
    await setup(page, (m) => {
      m.config.startRun = { status: 429, body: { error: 'rate_limited' } };
    });
    await open(page);
    const status = page.locator('#lb-status');
    await expect(status).toContainText('Daily nicht verfügbar: Tageslimit erreicht (30 Läufe)');
    await expect(status).toContainText('freies Spiel');
    await expect(page.locator('#play-kind button[data-kind=free]')).toHaveClass(/active/);
    await expect(page.locator('#lb-action')).toHaveText('Daily erneut versuchen');
    expect(errors).toEqual([]);
  });

  test('13 team name dialog: prefilled, invalid, taken, success', async ({ page }) => {
    const errors = collectErrors(page, [409]);
    const mock = await setup(page, (m) => {
      m.config.nickname = 'Team Kanban';
    });
    await open(page);
    await expectDailyRunning(page);
    await page.locator('#team-name').click();
    const dlg = page.locator('dialog#nick');
    await expect(dlg).toBeVisible();
    await expect(dlg.locator('h2')).toHaveText('Teamname ändern');
    await expect(page.locator('#nick-input')).toHaveValue('Team Kanban');
    await expect(page.locator('#nick-ok')).toHaveText('Speichern');
    await expect(page.locator('#nick-cancel')).toHaveText('Abbrechen');

    await page.locator('#nick-input').fill('x!');
    await page.locator('#nick-ok').click();
    await expect(page.locator('#nick-msg')).toContainText('Ungültig');
    expect(mock.find('POST', '/rest/v1/profiles')).toHaveLength(0);

    mock.config.profileResults = [{ status: 409, body: { code: '23505', message: 'duplicate key', details: '', hint: '' } }];
    await page.locator('#nick-input').fill('Team Scrum');
    await page.locator('#nick-ok').click();
    await expect(page.locator('#nick-msg')).toContainText('Name schon vergeben');
    await expect(dlg).toBeVisible();

    mock.config.profileResults = [{ status: 201 }];
    await page.locator('#nick-ok').click();
    await expect(dlg).toHaveCount(0);
    await expect(page.locator('#team-name')).toHaveText('Team: Team Scrum');
    const posts = mock.find('POST', '/rest/v1/profiles');
    expect(posts.at(-1)!.body).toMatchObject({ user_id: USER_ID, nickname: 'Team Scrum' });
    expect(errors).toEqual([]);
  });
});
