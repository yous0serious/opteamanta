import { test, expect, type Page } from '@playwright/test';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { runReplay } from '../../src/sim/index';

const OUT = '.tmp/evidence';
const ORIGINAL = pathToFileURL(resolve('tower-defenese-opTEAManta-v2.html')).href;

interface BdWindow {
  __bd: { game: { toReplay(): Parameters<typeof runReplay>[0] } };
}

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(String(e)));
  return errors;
}

async function cellClick(page: Page, canvasSel: string, cx: number, cy: number): Promise<void> {
  const box = await page.locator(canvasSel).boundingBox();
  if (!box) throw new Error('canvas has no box');
  await page.mouse.click(
    box.x + ((cx * 40 + 20) / 960) * box.width,
    box.y + ((cy * 40 + 20) / 600) * box.height,
  );
}

const portCell = (page: Page, cx: number, cy: number) => cellClick(page, '#game canvas', cx, cy);

async function startPort(page: Page, query: string): Promise<void> {
  await page.goto(`/?${query}`);
  await expect(page.locator('#game canvas')).toBeVisible();
  // Spielszene erst nach dem Preload bereit (Spec visual-overhaul T03)
  await expect(page.locator('body[data-ready="1"]')).toHaveCount(1, { timeout: 15_000 });
  await expect(page.locator('#money')).not.toBeEmpty();
}

async function runWaves(page: Page, n: number): Promise<void> {
  for (let i = 0; i < n; i++) {
    await page.keyboard.press(' ');
    await expect(page.locator('#big')).toContainText('läuft', { timeout: 10_000 });
    await expect(page.locator('#big')).toContainText('STARTEN', { timeout: 60_000 });
  }
}

test.describe('smoke', () => {
  test('1 loads, initial HUD, no console errors', async ({ page }) => {
    const errors = collectErrors(page);
    await startPort(page, 'seed=7&map=waterfall');
    await expect(page.locator('#money')).toHaveText('300');
    await expect(page.locator('#lives')).toHaveText('100');
    expect(errors).toEqual([]);
  });

  test('2 select tower and place it', async ({ page }) => {
    const errors = collectErrors(page);
    await startPort(page, 'seed=7&map=waterfall');
    await page.keyboard.press('3');
    await expect(page.locator('.tw[data-t=dev]')).toHaveClass(/sel/);
    await portCell(page, 10, 4);
    await expect(page.locator('#money')).toHaveText('180');
    expect(errors).toEqual([]);
  });

  test('3 info, rejected upgrade, sell', async ({ page }) => {
    const errors = collectErrors(page);
    await startPort(page, 'seed=7&map=waterfall');
    // Zwei Entwickler (2 × 120) → 60 SP übrig, Upgrade (96) muss abgelehnt werden
    await page.keyboard.press('3');
    await portCell(page, 12, 4);
    await portCell(page, 10, 4);
    await expect(page.locator('#money')).toHaveText('60');
    await page.keyboard.press('Escape');
    await portCell(page, 10, 4);
    await expect(page.locator('#info')).toContainText('Entwickler');
    await page.keyboard.press('u');
    await page.waitForTimeout(300);
    await expect(page.locator('#money')).toHaveText('60');
    await page.keyboard.press('s');
    await expect(page.locator('#money')).toHaveText('132');
    expect(errors).toEqual([]);
  });

  test('4 three waves at speed 10', async ({ page }) => {
    const errors = collectErrors(page);
    await startPort(page, 'seed=7&map=waterfall&speed=10');
    await page.keyboard.press('3');
    await portCell(page, 10, 4);
    await page.keyboard.press('1');
    await portCell(page, 6, 6);
    await expect(page.locator('#money')).not.toHaveText('300');
    await page.keyboard.press('Escape');
    await runWaves(page, 3);
    await expect(page.locator('#wave')).toContainText(/Sprint ([2-9]|\d{2,})/);
    expect(errors).toEqual([]);
  });

  test('5 replay is reproducible in Node', async ({ page }) => {
    const errors = collectErrors(page);
    await startPort(page, 'seed=7&map=waterfall&speed=10&debug=1');
    await page.keyboard.press('3');
    await portCell(page, 10, 4);
    await page.keyboard.press('Escape');
    await runWaves(page, 1);
    const replay = await page.evaluate(() => (window as unknown as BdWindow).__bd.game.toReplay());
    const result = runReplay(replay);
    expect(result.matches).toBe(true);
    expect(errors).toEqual([]);
  });

  test('6 game over shows restart and replay button', async ({ page }) => {
    test.setTimeout(150_000);
    const errors = collectErrors(page);
    await startPort(page, 'seed=1&speed=10');
    await expect(async () => {
      if (!(await page.locator('#big').innerText()).includes('NEU')) {
        await page.keyboard.press(' ');
      }
      await expect(page.locator('#big')).toContainText('NEU', { timeout: 1000 });
    }).toPass({ timeout: 120_000, intervals: [500] });
    await expect(page.locator('#replay')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('7 escape, right click, speed cycle, mute', async ({ page }) => {
    const errors = collectErrors(page);
    await startPort(page, 'seed=7&map=waterfall');
    await page.keyboard.press('3');
    await expect(page.locator('.tw.sel')).toHaveCount(1);
    await page.keyboard.press('Escape');
    await expect(page.locator('.tw.sel')).toHaveCount(0);
    await page.keyboard.press('2');
    await expect(page.locator('.tw.sel')).toHaveCount(1);
    const box = await page.locator('#game canvas').boundingBox();
    if (!box) throw new Error('no box');
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2, { button: 'right' });
    await expect(page.locator('.tw.sel')).toHaveCount(0);
    const spd = page.locator('#spd');
    await expect(spd).toContainText('x1');
    await spd.click();
    await expect(spd).toContainText('x2');
    await spd.click();
    await expect(spd).toContainText('x3');
    await spd.click();
    await expect(spd).toContainText('x1');
    const mute = page.locator('#mute');
    const before = await mute.innerText();
    await mute.click();
    await expect(mute).not.toHaveText(before);
    expect(errors).toEqual([]);
  });

  test('8 mode switch before first sprint, locked afterwards', async ({ page }) => {
    const errors = collectErrors(page);
    await startPort(page, 'seed=7&map=waterfall&debug=1&speed=10');
    await expect(page.locator('#mode button[data-mode=challenge]')).toHaveClass(/active/);
    await page.locator('#mode button[data-mode=endless]').click();
    await expect(page.locator('#mode button[data-mode=endless]')).toHaveClass(/active/);
    expect(await page.evaluate(() => (window as unknown as { __bd: { game: { state: { mode: string; seed: number } } } }).__bd.game.state.mode)).toBe('endless');
    await page.locator('#mode button[data-mode=challenge]').click();
    await page.keyboard.press(' ');
    await expect(page.locator('#mode button[data-mode=endless]')).toBeDisabled();
    await expect(page.locator('#wave')).toContainText('Welle 1/30');
    expect(errors).toEqual([]);
  });

  test('9 challenge victory shows release screen and verifiable replay', async ({ page }) => {
    test.setTimeout(180_000);
    const errors = collectErrors(page);
    await startPort(page, 'seed=7&map=waterfall&debug=1&speed=10&mode=challenge');
    await page.evaluate(() => {
      const bd = (window as unknown as { __bd: { game: { state: { money: number; wave: number } }; command: (c: unknown) => unknown } }).__bd;
      bd.game.state.money = 1_000_000;
      bd.game.state.wave = 29;
      const cells: Array<[string, number, number]> = [
        ['dev', 10, 4], ['dev', 12, 4], ['ppl', 11, 5], ['dev', 14, 4], ['dev', 8, 4], ['ppl', 13, 5],
        ['dev', 6, 9], ['dev', 8, 9], ['ppl', 7, 10], ['dev', 10, 9], ['analyst', 4, 9], ['scrum', 16, 10],
      ];
      for (const [tower, cx, cy] of cells) {
        const ev = bd.command({ type: 'place', tower, cx, cy }) as Array<{ type: string; tower?: { id: number } }>;
        const id = ev.find((e) => e.type === 'placed')?.tower?.id;
        if (id) for (let i = 0; i < 4; i++) bd.command({ type: 'upgrade', towerId: id });
      }
    });
    await page.keyboard.press(' ');
    await expect(page.locator('#big')).toContainText('NEUES PROGRAMM', { timeout: 150_000 });
    await expect(page.locator('#replay')).toBeVisible();
    const replay = await page.evaluate(() => (window as unknown as BdWindow).__bd.game.toReplay());
    expect(replay.result.won).toBe(true);
    expect(replay.mode).toBe('challenge');
    // Startgeld/Welle wurden per Debug manipuliert → Replay darf NICHT übereinstimmen (Manipulation wird erkannt)
    expect(runReplay(replay).matches).toBe(false);
    await page.screenshot({ path: `${OUT}/victory.png` });
    expect(errors).toEqual([]);
  });
});

test.describe('evidence', () => {
  test.setTimeout(240_000);

  test('new screenshots', async ({ page }) => {
    await startPort(page, 'seed=7&map=waterfall&speed=3');
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${OUT}/new-start.png` });
    await page.keyboard.press('3');
    await portCell(page, 10, 4);
    await page.keyboard.press('1');
    await portCell(page, 6, 6);
    await page.keyboard.press('Escape');
    await runWaves(page, 1);
    await page.keyboard.press(' ');
    await expect(page.locator('#wave')).toContainText('Sprint 1');
    await page.waitForTimeout(4000);
    await page.screenshot({ path: `${OUT}/new-wave.png` });

    await startPort(page, 'seed=1&speed=10');
    await expect(async () => {
      if (!(await page.locator('#big').innerText()).includes('NEU')) {
        await page.keyboard.press(' ');
      }
      await expect(page.locator('#big')).toContainText('NEU', { timeout: 1000 });
    }).toPass({ timeout: 120_000, intervals: [500] });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${OUT}/new-over.png` });
  });

  test('original screenshots', async ({ page }) => {
    await page.goto(ORIGINAL);
    await expect(page.locator('#c')).toBeVisible();
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${OUT}/old-start.png` });
    await page.locator('#spd').click();
    await page.locator('#spd').click();

    const place = async (key: string, cx: number, cy: number): Promise<void> => {
      await page.keyboard.press(key);
      await cellClick(page, '#c', cx, cy);
    };
    // The original map is random; try several cells until two towers are placed.
    const cells: Array<[number, number]> = [[10, 4], [6, 6], [12, 9], [8, 2], [14, 5], [4, 10], [16, 8], [9, 12]];
    let placed = 0;
    for (const [cx, cy] of cells) {
      if (placed >= 2) break;
      const before = await page.locator('#money').innerText();
      await place(placed === 0 ? '3' : '1', cx, cy);
      await page.waitForTimeout(150);
      if ((await page.locator('#money').innerText()) !== before) placed++;
    }
    expect(placed).toBe(2);
    await page.keyboard.press('Escape');

    await page.keyboard.press(' ');
    await expect(page.locator('#big')).toContainText('STARTEN', { timeout: 120_000 });
    await page.keyboard.press(' ');
    await expect(page.locator('#wave')).toContainText('Sprint 1');
    await page.waitForTimeout(4000);
    await page.screenshot({ path: `${OUT}/old-wave.png` });

    await expect(async () => {
      if (!(await page.locator('#big').innerText()).includes('NEU')) {
        await page.keyboard.press(' ');
      }
      await expect(page.locator('#big')).toContainText('NEU', { timeout: 1000 });
    }).toPass({ timeout: 200_000, intervals: [500] });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `${OUT}/old-over.png` });
  });
});
