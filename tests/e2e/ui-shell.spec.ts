import { test, expect, devices, type Page } from '@playwright/test';

// Shell-UI (Spec campaigns „Oberfläche“, AC-6): Navigation per Maus, Tastatur und Touch, ohne Seitwärts-Scrollen.
// Läuft gegen die eingebundene Shell (src/main.ts → mountShell). Für die Entwicklung: UI_SHELL_QUERY='?shell=mock'
// mit einem Vite-Dev-Server als baseURL.
const QUERY = process.env.UI_SHELL_QUERY ?? '';

async function openShell(page: Page, hash = '#/menu'): Promise<void> {
  await page.goto(`/${QUERY}${hash}`);
  await expect(page.locator('#shell:not([hidden]) .sh-screen').first()).toBeVisible({ timeout: 15_000 });
}

const hash = (page: Page): Promise<string> => page.evaluate(() => location.hash);
/** Element im aktuellen Screen (der alte Screen bleibt während des Übergangs kurz mit .leave im DOM). */
const q = (page: Page, sel: string, opts?: { hasText?: string }) => page.locator(`.sh-screen:not(.leave) ${sel}`, opts);
const screen = (page: Page, name: string) => page.locator(`.sh-screen.${name}:not(.leave)`);

async function noSideScroll(page: Page, label: string): Promise<void> {
  const m = await page.evaluate(() => {
    const sh = document.getElementById('shell')!;
    return { doc: document.documentElement.scrollWidth - innerWidth, shell: sh.scrollWidth - sh.clientWidth };
  });
  expect(m.doc, `${label}: Seite`).toBeLessThanOrEqual(0);
  expect(m.shell, `${label}: Shell`).toBeLessThanOrEqual(0);
}

test.describe('Shell Desktop', () => {
  test.use({ viewport: { width: 1366, height: 768 } });

  test('Menü → Kampagne → Briefing → Skilltree → Ranglisten, Zurück funktioniert', async ({ page }) => {
    await openShell(page);
    await expect(screen(page, 'menu')).toBeVisible();
    await expect(q(page, '.menu-tiles .tile')).toHaveCount(6);

    await q(page, '.tile-campaign').click();
    await expect.poll(() => hash(page)).toMatch(/^#\/campaign/);
    await expect(q(page, '.hq-floor')).toHaveCount(4);
    await expect(q(page, '.room')).toHaveCount(24);
    await expect(q(page, '.room.boss')).toHaveCount(4);

    await q(page, '.room:not(.locked)').first().click();
    await expect.poll(() => hash(page)).toMatch(/^#\/level\//);
    await expect(q(page, '#briefing-start')).toBeVisible();
    await expect(q(page, '.bf-foes .foe-list li').first()).toBeVisible();

    await page.goBack();
    await expect(screen(page, 'campaign')).toBeVisible();
    await page.goBack();
    await expect(screen(page, 'menu')).toBeVisible();

    await q(page, '.tile-skills').click();
    await expect.poll(() => hash(page)).toBe('#/skills');
    await expect(q(page, '.sk-branch')).toHaveCount(3);
    expect(await q(page, '.sk-node').count()).toBeGreaterThanOrEqual(24);
    await q(page, '.sk-node').first().click();
    await expect(q(page, '.sk-detail .sk-stepper')).toBeVisible();

    await q(page, '.sh-back').click();
    await expect(screen(page, 'menu')).toBeVisible();

    await q(page, '.tile-ranks').click();
    await expect(q(page, '.rk-tabs')).toBeVisible();
    await q(page, '.rk-tabs [role=tab]', { hasText: 'Level' }).click();
    await expect.poll(() => hash(page)).toMatch(/^#\/ranks\/level\//);
    await expect(q(page, '#rk-level')).toBeVisible();
    await page.goBack();
    await expect(screen(page, 'menu')).toBeVisible();
    await expect(page).toHaveTitle(/Hauptmenü/);
  });

  test('Tastatur: Kachel, Räume mit Pfeiltasten, Esc zurück', async ({ page }) => {
    await openShell(page);
    await q(page, '.tile-campaign').focus();
    await page.keyboard.press('Enter');
    await expect(screen(page, 'campaign')).toBeVisible();
    // Fokus springt auf die Überschrift des neuen Screens
    await expect(q(page, 'h1')).toBeFocused();

    const first = q(page, '.room:not(.locked)').first();
    await first.focus();
    await page.keyboard.press('ArrowRight');
    await expect(q(page, '.room[data-fi="0"][data-li="1"]')).toBeFocused();
    await page.keyboard.press('ArrowLeft');
    await expect(first).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(q(page, '#briefing-start')).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(screen(page, 'campaign')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(screen(page, 'menu')).toBeVisible();

    // Tabs per Pfeiltaste
    await q(page, '.tile-ranks').focus();
    await page.keyboard.press('Enter');
    await q(page, '.rk-tabs [role=tab][aria-selected=true]').focus();
    await page.keyboard.press('ArrowRight');
    await expect(q(page, '.rk-tabs [role=tab][aria-selected=true]')).toHaveText('Karten');
  });

  test('Login-Rücksprung (#access_token) bleibt im Hash, Menü erscheint', async ({ page }) => {
    await openShell(page, '#access_token=e2e&token_type=bearer&type=magiclink');
    await expect(screen(page, 'menu')).toBeVisible();
    expect(await hash(page)).toMatch(/^#access_token=e2e/);
  });

  test('keine Emojis in der Shell', async ({ page }) => {
    for (const h of ['#/menu', '#/campaign', '#/level/team-1', '#/skills', '#/ranks', '#/achievements', '#/free']) {
      await openShell(page, h);
      await page.waitForTimeout(400);
      const text = await page.evaluate(() => {
        const sh = document.getElementById('shell')!;
        const attrs = [...sh.querySelectorAll('[title],[aria-label]')].map((e) => `${e.getAttribute('title') ?? ''} ${e.getAttribute('aria-label') ?? ''}`);
        return `${sh.innerText} ${attrs.join(' ')} ${document.title}`;
      });
      expect(text, h).not.toMatch(/\p{Extended_Pictographic}/u);
    }
  });
});

for (const [name, device] of [
  ['iPhone hoch', devices['iPhone 13']],
  ['iPhone quer', devices['iPhone 13 landscape']],
] as const) {
  test.describe(`Shell ${name}`, () => {
    test.use({ viewport: device.viewport, deviceScaleFactor: device.deviceScaleFactor, isMobile: true, hasTouch: true, userAgent: device.userAgent });

    test('alle Screens ohne Seitwärts-Scrollen, Tippziele ≥ 40 px', async ({ page }) => {
      for (const h of ['#/menu', '#/campaign', '#/level/team-1', '#/level/team-6', '#/skills', '#/ranks/level/team-1', '#/achievements', '#/free']) {
        await openShell(page, h);
        await page.waitForTimeout(500);
        await noSideScroll(page, h);
        for (const sel of ['.sh-back', '.tile', '.room', '.sk-node', '#briefing-start', '.rk-tabs [role=tab]']) {
          const el = q(page, sel).first();
          if (!(await el.isVisible().catch(() => false))) continue;
          const b = (await el.boundingBox())!;
          expect(Math.min(b.width, b.height), `${h} ${sel}`).toBeGreaterThanOrEqual(40);
        }
      }
    });

    test('Touch: Kampagne antippen, Level öffnen, Skill wählen', async ({ page }) => {
      await openShell(page);
      await q(page, '.tile-campaign').tap();
      await expect(screen(page, 'campaign')).toBeVisible();
      await q(page, '.room:not(.locked)').first().tap();
      await expect(q(page, '#briefing-start')).toBeVisible();
      await q(page, '.sh-back').tap();
      await expect(screen(page, 'campaign')).toBeVisible();
      await q(page, '.sh-back').tap();
      await q(page, '.tile-skills').tap();
      await q(page, '.sk-node').first().tap();
      // Detail als Bottom-Sheet im sichtbaren Bereich
      const sheet = (await q(page, '.sk-detail').boundingBox())!;
      expect(sheet.y + sheet.height).toBeLessThanOrEqual(device.viewport.height + 1);
      await expect(q(page, '.sk-stepper .sk-plus')).toBeInViewport();
      await noSideScroll(page, 'skills');
    });
  });
}
