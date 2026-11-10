import { test, expect, type Page } from '@playwright/test';

const OUT = '.tmp/evidence/visual';

interface Dbg {
  filters(): string[];
  motion(): { shake: boolean; hitstop: boolean };
  renderer(): string;
  pile(): Array<{ x: number; y: number; type: string }>;
  scene(): { scene: { isActive(k: string): boolean } };
}
type W = { __bd: { debug: Dbg } };

async function start(page: Page, query: string): Promise<void> {
  await page.goto(`/?${query}`);
  await expect(page.locator('#game canvas')).toBeVisible();
  await expect(page.locator('body[data-ready="1"]')).toHaveCount(1, { timeout: 15_000 });
  await expect(page.locator('#money')).not.toBeEmpty();
}

async function cell(page: Page, cx: number, cy: number): Promise<void> {
  const box = await page.locator('#game canvas').boundingBox();
  if (!box) throw new Error('canvas has no box');
  await page.mouse.click(box.x + ((cx * 40 + 20) / 960) * box.width, box.y + ((cy * 40 + 20) / 600) * box.height);
}

async function placeTwo(page: Page): Promise<void> {
  await page.keyboard.press('3');
  await cell(page, 10, 4);
  await page.keyboard.press('1');
  await cell(page, 6, 6);
  await page.keyboard.press('Escape');
}

async function waveDone(page: Page): Promise<void> {
  await page.keyboard.press(' ');
  await expect(page.locator('#big')).toContainText('läuft', { timeout: 10_000 });
  await expect(page.locator('#big')).toContainText('STARTEN', { timeout: 90_000 });
}

test.describe('visual overhaul', () => {
  test('AC-8 filters with fx=high', async ({ page }) => {
    await start(page, 'fx=high&debug=1');
    const renderer = await page.evaluate(() => (window as unknown as W).__bd.debug.renderer());
    const filters = await page.evaluate(() => (window as unknown as W).__bd.debug.filters());
    if (renderer === 'webgl') {
      expect(filters).toEqual(expect.arrayContaining(['towers:Shadow', 'enemies:Shadow', 'camera:Vignette']));
    } else {
      test.info().annotations.push({ type: 'note', description: `renderer=${renderer} (no WebGL, R-5): filters must be empty` });
      expect(filters).toEqual([]);
    }
  });

  test('AC-8 no filters with fx=low', async ({ page }) => {
    await start(page, 'fx=low&debug=1');
    expect(await page.evaluate(() => (window as unknown as W).__bd.debug.filters())).toEqual([]);
  });

  test('AC-6 pile after one wave', async ({ page }) => {
    test.setTimeout(150_000);
    await start(page, 'seed=7&map=waterfall&speed=5&debug=1');
    await placeTwo(page);
    await waveDone(page);
    const pile = await page.evaluate(() => (window as unknown as W).__bd.debug.pile());
    expect(pile.length).toBeGreaterThanOrEqual(1);
    for (const b of pile) {
      expect(b.x).toBeGreaterThanOrEqual(720);
      expect(b.x).toBeLessThanOrEqual(960);
      expect(b.y).toBeGreaterThanOrEqual(470);
      expect(b.y).toBeLessThanOrEqual(600);
    }
  });

  test('AC-9 reduced motion', async ({ browser }) => {
    const reduced = await browser.newContext({ reducedMotion: 'reduce', baseURL: 'http://localhost:4173' });
    const p1 = await reduced.newPage();
    await start(p1, 'debug=1');
    expect(await p1.evaluate(() => (window as unknown as W).__bd.debug.motion())).toEqual({ shake: false, hitstop: false });
    await reduced.close();

    const normal = await browser.newContext({ reducedMotion: 'no-preference', baseURL: 'http://localhost:4173' });
    const p2 = await normal.newPage();
    await start(p2, 'debug=1');
    expect(await p2.evaluate(() => (window as unknown as W).__bd.debug.motion())).toEqual({ shake: true, hitstop: true });
    await normal.close();
  });

  test('AC-11 local requests only, preload done, canvas 960x600', async ({ page }) => {
    const hosts = new Set<string>();
    page.on('request', (r) => {
      const u = new URL(r.url());
      if (u.protocol === 'http:' || u.protocol === 'https:') hosts.add(u.host);
    });
    await start(page, 'debug=1');
    expect([...hosts]).toEqual(['localhost:4173']);
    // Ladebildschirm ist Canvas-Text; nach Ready darf die Preload-Szene nicht mehr aktiv sein.
    const active = await page.evaluate(() => (window as unknown as W).__bd.debug.scene().scene.isActive('preload'));
    expect(active).toBe(false);
    const canvas = await page.locator('#game canvas').boundingBox();
    const box = await page.locator('#game').boundingBox();
    expect(canvas?.width).toBe(960);
    expect(canvas?.height).toBe(600);
    expect(box?.width).toBe(960);
    expect(box?.height).toBe(600);
  });

  test('AC-13 screenshots', async ({ page }) => {
    test.setTimeout(240_000);
    await start(page, 'seed=7&map=waterfall&speed=3');
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${OUT}/new-start.png` });
    await placeTwo(page);
    await waveDone(page);
    await page.keyboard.press(' ');
    await expect(page.locator('#wave')).toContainText('Sprint 1'); // second wave running; label is "PIP" for wave 1
    await page.waitForTimeout(4000);
    await page.screenshot({ path: `${OUT}/new-wave2.png` });

    await start(page, 'seed=1&speed=10');
    await expect(async () => {
      if (!(await page.locator('#big').innerText()).includes('NEU')) await page.keyboard.press(' ');
      await expect(page.locator('#big')).toContainText('NEU', { timeout: 1000 });
    }).toPass({ timeout: 120_000, intervals: [500] });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${OUT}/new-over.png` });
  });
});
