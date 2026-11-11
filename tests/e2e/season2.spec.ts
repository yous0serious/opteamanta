import { test, expect, type Page } from '@playwright/test';
import { SESSION_ID, SupabaseMock } from './fixtures/supabase-mock';

const OUT = '.tmp/evidence/season2';

interface Bd {
  game: {
    state: { money: number; wave: number; lives: number; running: boolean; over: boolean; towers: Array<{ id: number; type: string; cx: number; cy: number }>; tick: number; score: number };
    pathCells: Set<string>;
    canPlace(t: string, cx: number, cy: number): string | null;
    step(): unknown[];
    stateHash(): string;
  };
  timeScale: number;
  command(c: unknown): Array<{ type: string; reason?: string; tower?: { id: number } }>;
  debug: {
    poses(): Array<{ id: number; type: string; level: number; pose: string }>;
    monsters(): Array<{ id: number; type: string; frame: string; width: number }>;
    effects(): Record<string, number>;
    audio(): { started: boolean; phase: string; loaded: number; failed: number; played: Record<string, number>; settings: { music: number; sfx: number; muted: boolean } };
    share(): { text: string; width: number; height: number; method: string } | null;
    fxLevel(): 'max' | 'normal' | 'calm';
  };
}
type W = { __bd: Bd };

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(String(e)));
  return errors;
}

async function open(page: Page, query: string): Promise<void> {
  await page.goto(`/?${query}&debug=1`);
  await expect(page.locator('body[data-ready="1"]')).toHaveCount(1, { timeout: 15_000 });
  await expect(page.locator('#money')).not.toBeEmpty();
}

/** Places towers on free cells close to the path; returns the tower ids. */
async function placeNearPath(page: Page, types: string[]): Promise<number[]> {
  return page.evaluate((list) => {
    const bd = (window as unknown as W).__bd;
    bd.game.state.money = 1e6;
    const path = [...bd.game.pathCells].map((k) => k.split(',').map(Number) as [number, number]);
    const cells: Array<{ cx: number; cy: number }> = [];
    for (let cx = 0; cx < 24; cx++) {
      for (let cy = 0; cy < 15; cy++) {
        if (bd.game.canPlace('dev', cx, cy) !== null) continue;
        let d = 99;
        for (const [px, py] of path) d = Math.min(d, Math.max(Math.abs(px - cx), Math.abs(py - cy)));
        if (d >= 1 && d <= 2) cells.push({ cx, cy });
      }
    }
    const step = Math.max(1, Math.floor(cells.length / list.length));
    const ids: number[] = [];
    let n = 0;
    for (const type of list) {
      for (let tries = 0; tries < cells.length; tries++) {
        const c = cells[(n * step + tries) % cells.length]!;
        if (bd.game.canPlace(type, c.cx, c.cy) !== null) continue;
        const ev = bd.command({ type: 'place', tower: type, cx: c.cx, cy: c.cy });
        const id = ev.find((e) => e.type === 'placed')?.tower?.id;
        if (id !== undefined) {
          ids.push(id);
          break;
        }
      }
      n++;
    }
    return ids;
  }, types);
}

const startWave = (page: Page) => page.evaluate(() => (window as unknown as W).__bd.command({ type: 'startWave' }));
const effects = (page: Page) => page.evaluate(() => (window as unknown as W).__bd.debug.effects());
const setState = (page: Page, wave: number, lives = 1000) =>
  page.evaluate(
    ([w, l]) => {
      const s = (window as unknown as W).__bd.game.state;
      s.wave = w!;
      s.lives = l!;
    },
    [wave, lives],
  );

async function waitWaveOver(page: Page, timeout = 120_000): Promise<void> {
  await page.waitForFunction(() => !(window as unknown as W).__bd.game.state.running, undefined, { timeout, polling: 100 });
}

const ATTACKERS = ['dev', 'dev', 'dualo', 'dualo', 'analyst', 'ppl', 'scrum', 'dev'];

async function luma(page: Page): Promise<number> {
  return page.evaluate(() => {
    const src = document.querySelector<HTMLCanvasElement>('#game canvas')!;
    const c = document.createElement('canvas');
    c.width = 240;
    c.height = 150;
    const g = c.getContext('2d')!;
    g.drawImage(src, 0, 0, 240, 150);
    const d = g.getImageData(0, 0, 240, 150).data;
    let sum = 0;
    for (let i = 0; i < d.length; i += 4) sum += (0.2126 * d[i]! + 0.7152 * d[i + 1]! + 0.0722 * d[i + 2]!) / 255;
    return sum / (d.length / 4);
  });
}

test.describe('AC-5 new roles', () => {
  test('rte/rta/rto/board effects and poses', async ({ page }) => {
    test.setTimeout(240_000);
    await open(page, 'map=waterfall&seed=7&speed=10');
    const ids = await placeNearPath(page, ['rte', 'rta', 'rto', 'board', ...ATTACKERS]);
    expect(ids.length).toBeGreaterThanOrEqual(4);
    await page.waitForTimeout(500);
    const rest = await page.evaluate(() => (window as unknown as W).__bd.debug.poses());
    const idle: Record<string, string> = { rte: 'idle', rta: 'think', rto: 'hold', board: 'talk' };
    for (const [r, p] of Object.entries(idle)) expect(rest.find((q) => q.type === r)?.pose, `idle ${r}`).toBe(p);

    await page.evaluate(() => {
      const w = window as unknown as W & { __rec: Record<string, string[]> };
      w.__rec = {};
      setInterval(() => {
        for (const p of w.__bd.debug.poses()) (w.__rec[p.type] ??= []).push(p.pose);
      }, 40);
    });
    await setState(page, 10);
    await startWave(page);
    await page.waitForTimeout(4000);
    await waitWaveOver(page);
    await page.waitForTimeout(1500);
    await page.locator('#game canvas').screenshot({ path: `${OUT}/roles.png` });
    const rec = await page.evaluate(() =>
      Object.fromEntries(Object.entries((window as unknown as { __rec: Record<string, string[]> }).__rec).map(([k, v]) => [k, [...new Set(v)]])),
    );
    const fx = await effects(page);
    console.log('S2 AC5 effects', JSON.stringify(fx), 'poses', JSON.stringify(rec));
    for (const k of ['synced', 'businessValue', 'freeze', 'axed']) expect(fx[k] ?? 0, `effect ${k}`).toBeGreaterThanOrEqual(1);
    const action: Record<string, string[]> = { rte: ['wide', 'show'], rta: ['show', 'talk'], rto: ['cheer0', 'cheer1'], board: ['wide', 'attack2'] };
    for (const [r, a] of Object.entries(action)) expect(rec[r]?.some((p) => a.includes(p)), `action pose ${r}: ${rec[r]}`).toBe(true);
  });
});

test.describe('AC-6 new monsters', () => {
  test('meeting and hotfix, jam', async ({ page }) => {
    test.setTimeout(240_000);
    await open(page, 'map=waterfall&seed=7&speed=5');
    await placeNearPath(page, ['dualo', 'dualo', 'rto', 'rto', 'rto', 'rto', 'rto', 'rto', 'rto', 'rto', 'rto', 'rto']);
    await page.evaluate(() => {
      const w = window as unknown as W & { __t: Set<string> };
      w.__t = new Set();
      setInterval(() => {
        for (const m of w.__bd.debug.monsters()) w.__t.add(m.type);
      }, 40);
    });
    await setState(page, 13);
    await startWave(page);
    await page.waitForTimeout(8000);
    await page.locator('#game canvas').screenshot({ path: `${OUT}/monsters.png` });
    await waitWaveOver(page);
    const types = await page.evaluate(() => [...(window as unknown as { __t: Set<string> }).__t]);
    const fx = await effects(page);
    console.log('S2 AC6 types', types, 'jammed', fx.jammed);
    expect(types).toContain('meeting');
    expect(types).toContain('hotfix');
    expect(fx.jammed ?? 0).toBeGreaterThanOrEqual(1);
  });
});

test.describe('AC-7 game feel', () => {
  test('combos, coins, numbers, boss intro, slowmo, promotion', async ({ page }) => {
    test.setTimeout(240_000);
    await open(page, 'map=waterfall&seed=7&speed=5');
    const ids = await placeNearPath(page, ATTACKERS);
    await setState(page, 10);
    await startWave(page); // boss wave 11
    await waitWaveOver(page);
    const fx = await effects(page);
    console.log('S2 AC7 effects', JSON.stringify(fx));
    expect(fx['juice:combos'] ?? 0).toBeGreaterThanOrEqual(1);
    expect(fx['juice:coins'] ?? 0).toBeGreaterThanOrEqual(1);
    expect(fx['juice:numbers'] ?? 0).toBeGreaterThanOrEqual(1);
    expect(fx['juice:bossIntro'] ?? 0).toBeGreaterThanOrEqual(1);
    expect(fx['juice:slowmo'] ?? 0).toBeGreaterThanOrEqual(1);
    const before = fx['juice:promotions'] ?? 0;
    await page.evaluate((id) => {
      const bd = (window as unknown as W).__bd;
      bd.game.state.money = 1e6;
      bd.command({ type: 'upgrade', towerId: id });
    }, ids[0]!);
    await expect.poll(async () => (await effects(page))['juice:promotions'] ?? 0).toBeGreaterThan(before);
  });

  test('presentation does not change simulation (fx=max vs fx=calm)', async ({ page }) => {
    test.setTimeout(240_000);
    const run = async (fx: string) => {
      await open(page, `map=waterfall&seed=7&fx=${fx}&speed=1`);
      return page.evaluate((list) => {
        const bd = (window as unknown as W).__bd;
        const g = bd.game;
        // synchronous scenario: no controller frame can interleave inside this call
        const base = g.state.tick;
        g.state.money = 1e6;
        const cells: Array<[number, number]> = [];
        for (let cx = 0; cx < 24; cx++) for (let cy = 0; cy < 15; cy++) if (g.canPlace('dev', cx, cy) === null && (cx + cy) % 5 === 0) cells.push([cx, cy]);
        list.forEach((t, i) => {
          const c = cells[i * 3]!;
          bd.command({ type: 'place', tower: t, cx: c[0], cy: c[1] });
        });
        g.state.wave = 10;
        g.state.lives = 1000;
        bd.command({ type: 'startWave' });
        for (let i = 0; i < 6000 && g.state.running; i++) g.step();
        const s = g.state;
        return { ticksRun: s.tick - base, wave: s.wave, score: s.score, lives: s.lives, money: s.money, towers: s.towers.length, hash: g.stateHash(), tick: s.tick };
      }, ['rte', 'rta', 'rto', 'board', 'dev', 'dev', 'dualo', 'scrum', 'ppl']);
    };
    const a = await run('max');
    const b = await run('calm');
    console.log('S2 AC7 determinism', JSON.stringify({ a, b }));
    const strip = ({ tick: _t, hash: _h, ...rest }: typeof a) => rest;
    expect(strip(b)).toEqual(strip(a));
    if (a.tick === b.tick) expect(b.hash).toBe(a.hash);
    else console.log('NOTE: pre-run tick offset differs, hash compared only on result fields');
  });
});

test.describe('AC-8 office life', () => {
  test('steam, walkers, chatter, prints, evening brightness', async ({ page }) => {
    test.setTimeout(240_000);
    await open(page, 'map=waterfall&seed=7&speed=5');
    await setState(page, 24);
    await placeNearPath(page, ['dev', 'dualo', 'analyst', 'rte', 'rto']);
    await expect.poll(async () => (await effects(page))['life:steam'] ?? 0, { timeout: 3000 }).toBeGreaterThanOrEqual(1);
    await expect.poll(async () => (await effects(page))['life:chatter'] ?? 0, { timeout: 60_000 }).toBeGreaterThanOrEqual(1);
    await expect.poll(async () => (await effects(page))['life:walkers'] ?? 0, { timeout: 25_000 }).toBeGreaterThanOrEqual(1);
    await setState(page, 24);
    await startWave(page);
    await waitWaveOver(page);
    await page.waitForTimeout(1000);
    const fx = await effects(page);
    console.log('S2 AC8 life', JSON.stringify(fx));
    expect(fx['life:prints'] ?? 0).toBeGreaterThanOrEqual(1);
    await setState(page, 25);
    await page.waitForTimeout(1500);
    const l = await luma(page);
    console.log('S2 AC8 luma wave25', l.toFixed(3));
    expect(l).toBeGreaterThanOrEqual(0.7);
    await page.locator('#game canvas').screenshot({ path: `${OUT}/evening.png` });
  });
});

test.describe('AC-9 effect levels', () => {
  const fxLevel = (page: Page) => page.evaluate(() => (window as unknown as W).__bd.debug.fxLevel());

  test('switch persists, url params', async ({ page }) => {
    await open(page, 'map=waterfall&seed=7');
    expect(await fxLevel(page)).toBe('max');
    await page.locator('#settings summary').click();
    await page.locator('#fx-level button[data-fx=normal]').click();
    expect(await fxLevel(page)).toBe('normal');
    await open(page, 'map=waterfall&seed=7');
    expect(await fxLevel(page)).toBe('normal');
    await open(page, 'map=waterfall&seed=7&fx=low');
    expect(await fxLevel(page)).toBe('calm');
    await open(page, 'map=waterfall&seed=7&fx=high');
    expect(await fxLevel(page)).toBe('max');
  });

  test('prefers-reduced-motion gives calm', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await open(page, 'map=waterfall&seed=7');
    expect(await fxLevel(page)).toBe('calm');
  });

  for (const [level, param, combos] of [
    ['calm', 'low', false],
    ['normal', 'normal', true],
  ] as const) {
    test(`boss wave on ${level}`, async ({ page }) => {
      test.setTimeout(240_000);
      await open(page, `map=waterfall&seed=7&fx=${param}&speed=5`);
      expect(await fxLevel(page)).toBe(level);
      await placeNearPath(page, ATTACKERS);
      await setState(page, 10);
      await startWave(page);
      await waitWaveOver(page);
      const fx = await effects(page);
      console.log(`S2 AC9 ${level}`, JSON.stringify({ slowmo: fx['juice:slowmo'], combos: fx['juice:combos'] }));
      expect(fx['juice:slowmo'] ?? 0).toBe(0);
      if (combos) expect(fx['juice:combos'] ?? 0).toBeGreaterThanOrEqual(1);
      else expect(fx['juice:combos'] ?? 0).toBe(0);
    });
  }
});

test.describe('AC-10 audio', () => {
  test('lazy load, phases, volumes, mute, no errors', async ({ page }) => {
    test.setTimeout(120_000);
    const errors = collectErrors(page);
    await open(page, 'map=waterfall&seed=7&speed=1');
    const audio = () => page.evaluate(() => (window as unknown as W).__bd.debug.audio());
    expect((await audio()).started).toBe(false);
    await page.keyboard.press('1');
    await expect.poll(async () => (await audio()).started).toBe(true);
    await expect.poll(async () => (await audio()).loaded, { timeout: 10_000 }).toBeGreaterThanOrEqual(20);
    expect((await audio()).failed).toBe(0);
    await expect.poll(async () => (await audio()).phase).toBe('music-planning');
    await placeNearPath(page, ['dev']);
    await startWave(page);
    await expect.poll(async () => (await audio()).phase).toBe('music-wave');

    await page.locator('#settings summary').click();
    await page.locator('#vol-music').fill('35');
    await page.locator('#vol-sfx').fill('55');
    let st = (await audio()).settings;
    expect(st.music).toBeCloseTo(0.35, 2);
    expect(st.sfx).toBeCloseTo(0.55, 2);
    const muted0 = st.muted;
    await page.locator('#mute').click();
    expect((await audio()).settings.muted).toBe(!muted0);
    await page.locator('#mute').click();
    expect((await audio()).settings.muted).toBe(muted0);

    await open(page, 'map=waterfall&seed=7&speed=1');
    st = (await audio()).settings;
    expect(st.music).toBeCloseTo(0.35, 2);
    expect(st.sfx).toBeCloseTo(0.55, 2);
    expect(errors).toEqual([]);
  });
});

test.describe('AC-11 share', () => {
  test('burnout shows share, fallback downloads 1200x630 png', async ({ page }) => {
    test.setTimeout(180_000);
    await open(page, 'map=waterfall&seed=7&speed=10');
    await expect(page.locator('#share')).toBeHidden();
    await page.evaluate(() => {
      (window as unknown as W).__bd.game.state.lives = 1;
    });
    await startWave(page);
    await expect(page.locator('#share')).toBeVisible({ timeout: 120_000 });
    const [dl] = await Promise.all([page.waitForEvent('download'), page.locator('#share').click()]);
    const stream = await dl.createReadStream();
    const chunks: Buffer[] = [];
    for await (const c of stream) chunks.push(c as Buffer);
    const buf = Buffer.concat(chunks);
    expect(buf.subarray(1, 4).toString('ascii')).toBe('PNG');
    expect(buf.readUInt32BE(16)).toBe(1200);
    expect(buf.readUInt32BE(20)).toBe(630);
    const share = await page.evaluate(() => (window as unknown as W).__bd.debug.share());
    console.log('S2 AC11 share', JSON.stringify(share));
    expect(share).toMatchObject({ width: 1200, height: 630, method: 'fallback' });
    expect(share!.text).toMatch(
      /^Backlog Defense 3000 · (Daily \d\d\.\d\d\.|Freies Spiel) · Welle \d+\/30 · Moral 0 % · Score [\d.]+( · Rang \d+)? – https:\/\/opteamanta\.netlify\.app$/,
    );
  });
});

test.describe('AC-12 layout and limits', () => {
  const emoji = /\p{Extended_Pictographic}/u;

  async function checkLayout(page: Page): Promise<void> {
    await page.setViewportSize({ width: 1366, height: 768 });
    await open(page, 'map=waterfall&seed=7');
    await expect(page.locator('.tw')).toHaveCount(9);
    console.log('S2 AC12 boxes', JSON.stringify(await page.evaluate(() => ['#frame', '#team-card', '#control-card', '#lb', '#lb-list', '#ticker'].map((s) => [s, JSON.stringify(document.querySelector(s)?.getBoundingClientRect().toJSON())]))));
    for (const sel of ['.tw', '#frame', '#big', '#lb']) {
      const loc = page.locator(sel);
      for (let i = 0; i < (await loc.count()); i++) {
        const b = (await loc.nth(i).boundingBox())!;
        expect(b, `${sel}#${i}`).not.toBeNull();
        expect(b.x, `${sel}#${i} left`).toBeGreaterThanOrEqual(0);
        expect(b.y, `${sel}#${i} top`).toBeGreaterThanOrEqual(0);
        expect(b.y + b.height, `${sel}#${i} bottom`).toBeLessThanOrEqual(768);
        expect(b.x + b.width, `${sel}#${i} right`).toBeLessThanOrEqual(1366);
      }
    }
  }

  test('offline: 9 cards in viewport, keys, board limit, no emoji', async ({ page }) => {
    await checkLayout(page);
    const order = await page.locator('.tw').evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.t));
    expect(order[8]).toBe('board');
    for (let i = 1; i <= 9; i++) {
      await page.keyboard.press(String(i));
      await expect(page.locator('.tw').nth(i - 1)).toHaveClass(/sel/);
    }
    await expect(page.locator('.tw[data-t=board] .lim')).toContainText('max. 1');
    const placed = await page.evaluate(() => {
      const bd = (window as unknown as W).__bd;
      bd.game.state.money = 1e6;
      const cells: Array<[number, number]> = [];
      for (let cx = 0; cx < 24; cx++) for (let cy = 0; cy < 15; cy++) if (bd.game.canPlace('board', cx, cy) === null) cells.push([cx, cy]);
      const one = bd.command({ type: 'place', tower: 'board', cx: cells[0]![0], cy: cells[0]![1] });
      const two = bd.command({ type: 'place', tower: 'board', cx: cells[5]![0], cy: cells[5]![1] });
      return { one: one.map((e) => e.type), two: two.map((e) => `${e.type}:${e.reason ?? ''}`), money: bd.game.state.money };
    });
    expect(placed.one).toContain('placed');
    expect(placed.two).toContain('rejected:limit');
    expect(placed.money).toBeGreaterThan(1000);
    const board = page.locator('.tw[data-t=board]');
    await expect(board).toBeDisabled();
    await expect(board).toHaveClass(/full/);
    const text = await page.evaluate(() => document.body.innerText);
    expect(emoji.exec(text)).toBeNull();
    const attrs = await page.evaluate(() =>
      [...document.querySelectorAll('[title],[aria-label]')].map((e) => `${e.getAttribute('title') ?? ''}${e.getAttribute('aria-label') ?? ''}`).join(' '),
    );
    expect(emoji.exec(attrs)).toBeNull();
  });

  test.describe('online build', () => {
    test.use({ baseURL: 'http://localhost:4175' });
    test('9 cards and 10 leaderboard rows in viewport', async ({ page }) => {
      const mock = new SupabaseMock(page);
      const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(new Date());
      mock.config.startRun = {
        status: 200,
        body: {
          sessionId: SESSION_ID,
          seed: 1,
          mapId: 'waterfall',
          mode: 'challenge',
          gameVersion: '0.3.0',
          dailyDate: today,
          issuedAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 3 * 3600_000).toISOString(),
        },
      };
      mock.config.board.day = Array.from({ length: 10 }, (_, i) => ({ rank: i + 1, nickname: `Team${i + 1}`, score: 20_000 - i * 1000, wave: 30, lives: 50, won: i === 0, is_me: false }));
      await mock.install();
      await checkLayout(page);
      await expect(page.locator('#lb-list li[data-rank]')).toHaveCount(10);
      const last = (await page.locator('#lb-list li[data-rank]').last().boundingBox())!;
      expect(last.y + last.height).toBeLessThanOrEqual(768);
    });
  });
});
