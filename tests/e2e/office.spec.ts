import { test, expect, type Page } from '@playwright/test';

const OUT = '.tmp/evidence/office';
const ROLES = ['dualo', 'analyst', 'dev', 'ppl', 'scrum'] as const;

interface Bd {
  game: {
    state: { money: number; wave: number; lives: number; running: boolean; over: boolean; towers: Array<{ id: number; cx: number; cy: number }> };
    pathCells: Set<string>;
    canPlace(t: string, cx: number, cy: number): string | null;
  };
  command(c: unknown): Array<{ type: string; tower?: { id: number } }>;
  debug: {
    renderer(): string;
    filters(): string[];
    motion(): { shake: boolean; hitstop: boolean };
    poses(): Array<{ id: number; type: string; level: number; pose: string }>;
    monsters(): Array<{ id: number; type: string; frame: string; width: number }>;
    effects(): Record<string, number>;
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
const filters = (page: Page) => page.evaluate(() => (window as unknown as W).__bd.debug.filters());

async function waitWaveOver(page: Page, timeout = 90_000): Promise<void> {
  await page.waitForFunction(() => !(window as unknown as W).__bd.game.state.running, undefined, { timeout, polling: 100 });
}

test.describe('AC-3 brightness', () => {
  for (const map of ['waterfall', 'spaghetti', 'release-train', 'matrix']) {
    test(`bright map ${map}`, async ({ page }) => {
      await open(page, `map=${map}&seed=7&speed=3`);
      const luma = await page.evaluate(() => {
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
      console.log(`LUMA ${map} ${luma.toFixed(3)}`);
      expect(luma).toBeGreaterThanOrEqual(0.7);
      const bad = (f: string[]) => f.filter((n) => /Vignette|ColorMatrix/.test(n));
      expect(bad(await filters(page))).toEqual([]);
      await placeNearPath(page, ['dev', 'dualo']);
      await startWave(page);
      await page.waitForTimeout(1500);
      expect(bad(await filters(page))).toEqual([]);
    });
  }
});

test.describe('AC-4 roles', () => {
  test('poses at rest, attack, cheer, upgrade', async ({ page }) => {
    test.setTimeout(180_000);
    const errors = collectErrors(page);
    await open(page, 'map=waterfall&seed=7&speed=3');
    const ids = await placeNearPath(page, [...ROLES]);
    expect(ids).toHaveLength(5);
    await page.waitForTimeout(600);
    const rest = await page.evaluate(() => (window as unknown as W).__bd.debug.poses());
    const idle: Record<string, string> = { dualo: 'idle', analyst: 'idle', dev: 'interact', ppl: 'think', scrum: 'idle' };
    for (const r of ROLES) expect(rest.find((p) => p.type === r)?.pose, `rest pose ${r}`).toBe(idle[r]);

    await page.evaluate(() => {
      const w = window as unknown as W & { __rec: { during: Record<string, string[]>; after: Record<string, string[]>; base: number } };
      const bd = w.__bd;
      const rec = { during: {} as Record<string, string[]>, after: {} as Record<string, string[]>, base: bd.debug.effects().waveCleared ?? 0 };
      w.__rec = rec;
      setInterval(() => {
        const cleared = (bd.debug.effects().waveCleared ?? 0) > rec.base;
        const tgt = cleared ? rec.after : rec.during;
        for (const p of bd.debug.poses()) (tgt[p.type] ??= []).push(p.pose);
      }, 50);
    });
    await page.evaluate(() => { (window as unknown as W).__bd.game.state.wave = 5; });
    await startWave(page);
    await waitWaveOver(page, 150_000);
    await page.waitForTimeout(3000);
    const rec = await page.evaluate(() => {
      const r = (window as unknown as { __rec: { during: Record<string, string[]>; after: Record<string, string[]> } }).__rec;
      const uniq = (o: Record<string, string[]>) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, [...new Set(v)]]));
      return { during: uniq(r.during), after: uniq(r.after) };
    });
    console.log('POSES', JSON.stringify(rec));
    const attack: Record<string, string[]> = {
      dualo: ['attack0', 'attack1'], analyst: ['talk', 'show'], dev: ['interact', 'hold'], ppl: ['show', 'wide'], scrum: ['kick', 'attack2'],
    };
    for (const r of ROLES) {
      expect(rec.during[r]?.some((p) => attack[r]!.includes(p)), `attack pose ${r}: ${rec.during[r]}`).toBe(true);
      expect(rec.after[r]?.some((p) => p === 'cheer0' || p === 'cheer1'), `cheer after wave ${r}: ${rec.after[r]}`).toBe(true);
    }
    expect(rec.during.dev).toEqual(expect.arrayContaining(['interact', 'hold']));

    const seen = await page.evaluate(async (id) => {
      const bd = (window as unknown as W).__bd;
      bd.command({ type: 'upgrade', towerId: id });
      const poses = new Set<string>();
      const t0 = performance.now();
      while (performance.now() - t0 < 300) {
        const p = bd.debug.poses().find((q) => q.id === id);
        if (p) poses.add(p.pose);
        await new Promise((r) => setTimeout(r, 20));
      }
      return { poses: [...poses], level: bd.debug.poses().find((q) => q.id === id)?.level };
    }, ids[2]!);
    expect(seen.poses.some((p) => p === 'cheer0' || p === 'cheer1'), `upgrade poses ${seen.poses}`).toBe(true);
    expect(seen.level).toBe(2);
    expect(errors).toEqual([]);
  });

  test('screenshot sheet: 5 roles x levels 1-5', async ({ page }) => {
    await open(page, 'map=waterfall&seed=7&speed=3');
    const placed = await page.evaluate(() => {
      const bd = (window as unknown as W).__bd;
      bd.game.state.money = 1e7;
      const free: Array<[number, number]> = [];
      for (let cy = 0; cy < 15; cy++) for (let cx = 0; cx < 24; cx++) if (bd.game.canPlace('dev', cx, cy) === null && cx % 2 === 0 && cy % 2 === 1) free.push([cx, cy]);
      const roles = ['dualo', 'analyst', 'dev', 'ppl', 'scrum'];
      let n = 0;
      let count = 0;
      for (const role of roles) {
        for (let l = 1; l <= 5; l++) {
          const c = free[n++];
          if (!c) return count;
          const ev = bd.command({ type: 'place', tower: role, cx: c[0], cy: c[1] });
          const id = ev.find((e) => e.type === 'placed')?.tower?.id;
          if (id === undefined) continue;
          for (let u = 1; u < l; u++) bd.command({ type: 'upgrade', towerId: id });
          count++;
        }
      }
      return count;
    });
    expect(placed).toBe(25);
    await page.waitForTimeout(2500);
    const poses = await page.evaluate(() => (window as unknown as W).__bd.debug.poses());
    expect(new Set(poses.map((p) => p.level))).toEqual(new Set([1, 2, 3, 4, 5]));
    await page.locator('#game canvas').screenshot({ path: `${OUT}/roles-levels.png` });
  });
});

test.describe('AC-5 monsters', () => {
  test('walk cycle, hit, kill, boss size, screenshot', async ({ page }) => {
    test.setTimeout(180_000);
    await open(page, 'map=waterfall&seed=7&speed=3');
    await placeNearPath(page, ['dev', 'dualo', 'analyst', 'ppl', 'scrum', 'dev', 'dualo']);
    await page.evaluate(() => {
      const w = window as unknown as W & { __m: unknown };
      const bd = w.__bd;
      const m = { frames: {} as Record<string, Set<string>>, types: new Set<string>(), hit: false, widths: {} as Record<string, number> };
      w.__m = m;
      setInterval(() => {
        for (const e of bd.debug.monsters()) {
          (m.frames[e.id] ??= new Set()).add(e.frame);
          m.types.add(e.type);
          m.widths[e.type] = Math.max(m.widths[e.type] ?? 0, e.width);
          if (e.frame.endsWith('/hit')) m.hit = true;
        }
      }, 40);
    });
    // boss wave: pip waves are (w-1)%5==0 and w>1, i.e. wave 6 (src/sim/game.ts startWave)
    await page.evaluate(() => { (window as unknown as W).__bd.game.state.wave = 5; });
    await startWave(page);
    await page.waitForTimeout(6000);
    await page.locator('#game canvas').screenshot({ path: `${OUT}/monsters.png` });
    await waitWaveOver(page, 150_000);
    const m = await page.evaluate(() => {
      const r = (window as unknown as { __m: { frames: Record<string, Set<string>>; types: Set<string>; hit: boolean; widths: Record<string, number> } }).__m;
      return { frames: Object.values(r.frames).map((s) => [...s]), types: [...r.types], hit: r.hit, widths: r.widths };
    });
    console.log('MONSTERS', JSON.stringify({ types: m.types, widths: m.widths, hit: m.hit }));
    const walks = new Set(m.frames.flat().filter((f) => /\/walk\d+$/.test(f)));
    expect(walks.size).toBeGreaterThanOrEqual(2);
    expect(m.hit).toBe(true);
    expect((await effects(page)).killed).toBeGreaterThanOrEqual(1);
    expect(m.types).toContain('boss');
    expect(m.types).toContain('req');
    const ratio = m.widths.boss! / m.widths.req!;
    console.log('BOSS/REQ width ratio', ratio);
    expect(ratio).toBeGreaterThanOrEqual(2);
  });
});

test.describe('AC-6 effects', () => {
  test('all effect types in one session', async ({ page }) => {
    test.setTimeout(400_000);
    const errors = collectErrors(page);
    await open(page, 'map=waterfall&seed=7&speed=10');
    await startWave(page); // no towers: wave 1 leaks
    await waitWaveOver(page, 120_000);
    const ids = await placeNearPath(page, ['dualo', 'analyst', 'dev', 'ppl', 'scrum', 'dev', 'scrum', 'analyst']);
    await page.evaluate((id) => {
      const bd = (window as unknown as W).__bd;
      bd.command({ type: 'upgrade', towerId: id });
      bd.command({ type: 'sell', towerId: id });
    }, ids[ids.length - 1]!);
    await page.evaluate(() => { (window as unknown as W).__bd.game.state.wave = 5; });
    for (let i = 0; i < 3; i++) {
      await startWave(page);
      await waitWaveOver(page, 150_000);
    }
    await page.evaluate(() => {
      const bd = (window as unknown as W).__bd;
      for (const t of [...bd.game.state.towers]) bd.command({ type: 'sell', towerId: t.id });
      bd.game.state.lives = 1;
    });
    await startWave(page);
    await page.waitForFunction(() => (window as unknown as W).__bd.game.state.over, undefined, { timeout: 120_000 });
    await page.waitForTimeout(500);
    const fx = await effects(page);
    console.log('EFFECTS', JSON.stringify(fx));
    for (const k of ['placed', 'upgraded', 'sold', 'killed', 'waveCleared', 'leaked', 'fired:dualo', 'fired:analyst', 'fired:ppl', 'fired:scrum', 'beam', 'gameOver']) {
      expect(fx[k] ?? 0, `effect ${k}`).toBeGreaterThanOrEqual(1);
    }
    expect(errors).toEqual([]);
  });

  test('fx=low has no filters', async ({ page }) => {
    await open(page, 'map=waterfall&seed=7&fx=low&speed=3');
    expect(await filters(page)).toEqual([]);
  });

  test('prefers-reduced-motion: no shake/hitstop, monsters do not animate', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await open(page, 'map=waterfall&seed=7&speed=1');
    expect(await page.evaluate(() => (window as unknown as W).__bd.debug.motion())).toEqual({ shake: false, hitstop: false });
    await startWave(page);
    await expect.poll(() => page.evaluate(() => (window as unknown as W).__bd.debug.monsters().length), { timeout: 20_000 }).toBeGreaterThan(0);
    const a = await page.evaluate(() => (window as unknown as W).__bd.debug.monsters()[0]!);
    const frames = new Set<string>();
    for (let i = 0; i < 20; i++) {
      const cur = await page.evaluate((id) => (window as unknown as W).__bd.debug.monsters().find((m) => m.id === id)?.frame, a.id);
      if (cur) frames.add(cur);
      await page.waitForTimeout(50);
    }
    expect(frames.size).toBe(1);
  });
});

test.describe('AC-7 layout', () => {
  const sels = ['#frame', '.tw', '#lb', '#big', '#money', '#lives', '#wave', '#score'];
  for (const [w, h] of [[1366, 768], [1920, 1080]] as const) {
    test(`layout ${w}x${h}`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await open(page, 'map=waterfall&seed=7');
      if (w === 1366) {
        for (const sel of sels) {
          const loc = page.locator(sel);
          const n = await loc.count();
          expect(n, sel).toBeGreaterThanOrEqual(1);
          if (sel === '.tw') expect(n).toBe(9);
          for (let i = 0; i < n; i++) {
            const b = (await loc.nth(i).boundingBox())!;
            expect(b, `${sel}#${i} visible`).not.toBeNull();
            expect(b.x, `${sel}#${i} left`).toBeGreaterThanOrEqual(0);
            expect(b.y, `${sel}#${i} top`).toBeGreaterThanOrEqual(0);
            expect(b.y + b.height, `${sel}#${i} bottom`).toBeLessThanOrEqual(768);
            expect(b.x + b.width, `${sel}#${i} right`).toBeLessThanOrEqual(1366);
          }
        }
      } else {
        expect((await page.locator('#frame').boundingBox())!.width).toBeGreaterThan(960);
      }
      const text = await page.evaluate(() => ({ main: document.body.innerText, tk: document.getElementById('tk')?.textContent ?? '' }));
      const emoji = /\p{Extended_Pictographic}/u;
      expect(emoji.exec(text.main)).toBeNull();
      console.log('TICKER has emoji:', emoji.test(text.tk));
      await page.screenshot({ path: `${OUT}/layout-${w}.png` });
    });
  }

  test('keyboard: 1-9, Esc, u/s, space', async ({ page }) => {
    await open(page, 'map=waterfall&seed=7&speed=3');
    for (let i = 1; i <= 9; i++) {
      await page.keyboard.press(String(i));
      await expect(page.locator('.tw.sel')).toHaveCount(1);
      await expect(page.locator('.tw').nth(i - 1)).toHaveClass(/sel/);
    }
    await page.keyboard.press('Escape');
    await expect(page.locator('.tw.sel')).toHaveCount(0);
    const ids = await placeNearPath(page, ['dev']);
    const pos = await page.evaluate((id) => (window as unknown as W).__bd.game.state.towers.find((t) => t.id === id)!, ids[0]!);
    const box = (await page.locator('#game canvas').boundingBox())!;
    await page.mouse.click(box.x + ((pos.cx * 40 + 20) / 960) * box.width, box.y + ((pos.cy * 40 + 20) / 600) * box.height);
    await page.keyboard.press('u');
    await expect.poll(() => page.evaluate(() => (window as unknown as W).__bd.debug.poses()[0]?.level)).toBe(2);
    await page.keyboard.press('s');
    await expect.poll(() => page.evaluate(() => (window as unknown as W).__bd.debug.poses().length)).toBe(0);
    await page.keyboard.press(' ');
    await expect.poll(() => page.evaluate(() => (window as unknown as W).__bd.game.state.wave)).toBe(1);
  });
});

test.describe('AC-10 robustness', () => {
  test('canvas + fx=low, three waves, no errors', async ({ page }) => {
    test.setTimeout(240_000);
    const errors = collectErrors(page);
    await open(page, 'fx=low&speed=10&seed=3');
    expect(await page.evaluate(() => (window as unknown as W).__bd.debug.renderer())).toBe('canvas');
    await placeNearPath(page, ['dev', 'dualo', 'ppl', 'scrum']);
    for (let i = 0; i < 3; i++) {
      await startWave(page);
      await waitWaveOver(page, 120_000);
    }
    expect(await page.evaluate(() => (window as unknown as W).__bd.game.state.wave)).toBeGreaterThanOrEqual(3);
    expect(await filters(page)).toEqual([]);
    expect(errors).toEqual([]);
  });
});
