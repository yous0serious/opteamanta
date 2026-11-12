import { test, expect, devices, type Page } from '@playwright/test';

// Handy-Bedienung: Layout hoch/quer ohne Seitwärts-Scrollen, Tippen = Vorschau, zweites Tippen = einsetzen.
const OUT = '.tmp/evidence';

interface W {
  __bd: {
    game: { state: { towers: Array<{ type: string }> }; canPlace(t: string, cx: number, cy: number): string | null };
    preview: { cx: number; cy: number } | null;
  };
}

async function open(page: Page): Promise<void> {
  await page.goto('/?map=waterfall&seed=7&debug=1');
  await expect(page.locator('body[data-ready="1"]')).toHaveCount(1, { timeout: 15_000 });
}

async function inViewport(page: Page, sel: string): Promise<void> {
  const vp = page.viewportSize()!;
  const b = (await page.locator(sel).first().boundingBox())!;
  expect(b, sel).not.toBeNull();
  expect(b.x, `${sel} left`).toBeGreaterThanOrEqual(0);
  expect(b.x + b.width, `${sel} right`).toBeLessThanOrEqual(vp.width + 0.5);
  expect(b.y + b.height, `${sel} bottom`).toBeLessThanOrEqual(vp.height + 0.5);
}

async function tapCell(page: Page, cx: number, cy: number): Promise<void> {
  const box = (await page.locator('#game canvas').boundingBox())!;
  await page.touchscreen.tap(box.x + ((cx * 40 + 20) / 960) * box.width, box.y + ((cy * 40 + 20) / 600) * box.height);
}

const freeCell = (page: Page) =>
  page.evaluate(() => {
    const g = (window as unknown as W).__bd.game;
    for (let cy = 2; cy < 15; cy++) for (let cx = 2; cx < 22; cx++) if (g.canPlace('dualo', cx, cy) === null) return [cx, cy] as const;
    throw new Error('kein freies Feld');
  });

for (const [name, device] of [
  ['iPhone hoch', devices['iPhone 13']],
  ['iPhone quer', devices['iPhone 13 landscape']],
  ['Android quer', devices['Pixel 7 landscape']],
] as const) {
  test.describe(name, () => {
    // Chromium mit Handy-Viewport und Touch (WebKit-Engine ist für den Test nicht nötig)
    test.use({ viewport: device.viewport, deviceScaleFactor: device.deviceScaleFactor, isMobile: true, hasTouch: true, userAgent: device.userAgent });

    test('Layout passt, Touch-Platzierung mit Bestätigung', async ({ page }) => {
      await open(page);
      await expect(page.locator('html')).toHaveClass(/touch/);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'kein Seitwärts-Scrollen').toBe(true);
      for (const sel of ['#frame', '#big', '#spd', '#mute', '#open-settings']) await inViewport(page, sel);
      // Tasten-Hinweise sind auf Touch ausgeblendet
      await expect(page.locator('.tw .key').first()).toBeHidden();

      await page.locator('.tw[data-t=dualo]').tap();
      const [cx, cy] = await freeCell(page);
      await tapCell(page, cx, cy);
      expect(await page.evaluate(() => (window as unknown as W).__bd.game.state.towers.length)).toBe(0);
      expect(await page.evaluate(() => (window as unknown as W).__bd.preview)).toEqual({ cx, cy });
      await expect(page.locator('#info [data-action=place]')).toBeEnabled();
      await inViewport(page, '#info [data-action=place]');
      await page.screenshot({ path: `${OUT}/mobile-${name.replace(' ', '-')}-preview.png` });

      await tapCell(page, cx, cy);
      await expect.poll(() => page.evaluate(() => (window as unknown as W).__bd.game.state.towers.length)).toBe(1);

      // Arbeitsplatz antippen: Upgrade/Abgeben sichtbar ohne Scrollen
      await tapCell(page, cx, cy);
      await expect(page.locator('#info [data-action=upgrade]')).toBeVisible();
      await inViewport(page, '#info [data-action=sell]');
      await page.locator('#info [data-action=close]').tap();
      await expect(page.locator('#info [data-action=upgrade]')).toHaveCount(0);

      // Start-Button per Tippen
      await page.locator('#big').tap();
      await expect(page.locator('#big')).toContainText('läuft', { timeout: 10_000 });
    });
  });
}
