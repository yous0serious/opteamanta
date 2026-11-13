import { describe, expect, it } from 'vitest';
import type { EnemyType } from '../../src/sim/index';
import { makeGame, stepN } from './helpers';

/** Zieht Welle `w` in `runs` Spielen (Seeds 2024…; jede Welle hat ihren eigenen Zufallsstrom) und zählt die Typen (ohne den angehängten Boss). */
function sample(w: number, runs: number): { counts: Record<string, number>; total: number; bosses: number } {
  const counts: Record<string, number> = {};
  let total = 0;
  let bosses = 0;
  for (let i = 0; i < runs; i++) {
    const g = makeGame(2024 + i);
    g.state.wave = w - 1;
    g.apply({ type: 'startWave' });
    const q: EnemyType[] = [...g.state.queue];
    if (q[q.length - 1] === 'boss') {
      bosses++;
      q.pop();
    }
    for (const t of q) {
      counts[t] = (counts[t] ?? 0) + 1;
      total++;
    }
  }
  return { counts, total, bosses };
}

function expectShare(s: ReturnType<typeof sample>, type: string, share: number): void {
  expect(Math.abs((s.counts[type] ?? 0) / s.total - share)).toBeLessThanOrEqual(0.03);
}

describe('AC-5 Größe und PIP', () => {
  it('Welle 1 hat 10 Gegner, kein Boss', () => {
    const g = makeGame();
    g.apply({ type: 'startWave' });
    expect(g.state.wave).toBe(1);
    expect(g.state.queue.length).toBe(10);
    expect(g.state.queue.includes('boss')).toBe(false);
  });
  it('Welle 6 hat 21 Gegner (20 + Boss am Ende)', () => {
    const g = makeGame();
    g.state.wave = 5;
    const ev = g.apply({ type: 'startWave' });
    expect(g.state.queue.length).toBe(21);
    expect(g.state.queue[20]).toBe('boss');
    expect(g.state.queue.slice(0, 20).includes('boss')).toBe(false);
    expect(ev.find((e) => e.type === 'waveStarted')).toMatchObject({ wave: 6, pip: true, boss: true });
  });
  it('Wellengrößen 8 + 2w; Boss genau in Wellen 6, 11, 16, ...', () => {
    const g = makeGame();
    for (let w = 1; w <= 30; w++) {
      g.state.running = false;
      g.apply({ type: 'startWave' });
      const boss = [1, 6, 11, 16, 21, 26].includes(w) ? (w > 1 ? 1 : 0) : 0;
      expect(g.state.queue.length).toBe(8 + 2 * w + boss);
      expect(g.state.queue.filter((t) => t === 'boss').length).toBe(boss);
      const ev = g.apply({ type: 'startWave' });
      expect(ev[0]).toMatchObject({ type: 'rejected', reason: 'waveRunning' });
    }
  });
});

describe('AC-5 Typverteilung (2000+ Ziehungen, +-3 Prozentpunkte)', () => {
  it('Welle 1 (PIP): feat 15 %, req 85 %', () => {
    const s = sample(1, 250);
    expect(s.total).toBeGreaterThanOrEqual(2000);
    expectShare(s, 'feat', 0.15);
    expectShare(s, 'req', 0.85);
  });
  it('PIP Welle 11: obj 35 %, feat 40 %, req 25 %, je 1 Boss', () => {
    const s = sample(11, 80);
    expect(s.total).toBeGreaterThanOrEqual(2000);
    expect(s.bosses).toBe(80);
    expectShare(s, 'obj', 0.35);
    expectShare(s, 'feat', 0.4);
    expectShare(s, 'req', 0.25);
    expect(s.counts.cr ?? 0).toBe(0);
    expect(s.counts.creep ?? 0).toBe(0);
  });
  it('Welle 2: cr 25 %, sonst req', () => {
    const s = sample(2, 170);
    expect(s.total).toBeGreaterThanOrEqual(2000);
    expectShare(s, 'cr', 0.25);
    expectShare(s, 'req', 0.75);
    expect(Object.keys(s.counts).sort()).toEqual(['cr', 'req']);
  });
  it('Welle 3: cr 25, obj 12, feat 12, creep 13, hotfix 18, req 20 %; kein debt, kein meeting', () => {
    const s = sample(3, 150);
    expect(s.total).toBeGreaterThanOrEqual(2000);
    expectShare(s, 'cr', 0.25);
    expectShare(s, 'obj', 0.12);
    expectShare(s, 'feat', 0.12);
    expectShare(s, 'creep', 0.13);
    expectShare(s, 'hotfix', 0.18);
    expectShare(s, 'req', 0.2);
    expect(s.counts.debt ?? 0).toBe(0);
    expect(s.counts.meeting ?? 0).toBe(0);
  });
  it('Welle 4: cr 25, obj 12, feat 12, creep 13, debt 10, hotfix 8, meeting 6, req 14 %', () => {
    const s = sample(4, 130);
    expect(s.total).toBeGreaterThanOrEqual(2000);
    expectShare(s, 'cr', 0.25);
    expectShare(s, 'obj', 0.12);
    expectShare(s, 'feat', 0.12);
    expectShare(s, 'creep', 0.13);
    expectShare(s, 'debt', 0.1);
    expectShare(s, 'hotfix', 0.08);
    expectShare(s, 'meeting', 0.06);
    expectShare(s, 'req', 0.14);
  });
});

describe('AC-5 HP-Skalierung', () => {
  it('Welle 6: hpS 1.8629064802239264 -> req 55.8872 HP', () => {
    const g = makeGame();
    g.state.wave = 6;
    const e = g.spawnEnemy('req');
    expect(e.hpScale).toBeCloseTo(1.8629064802239264, 9);
    expect(e.hp).toBeCloseTo(55.88719440671779, 6);
    expect(e.maxHp).toBeCloseTo(55.88719440671779, 6);
  });
  it('Welle 0 und 1: hpS 1; Welle 30: 36.9069460', () => {
    const g = makeGame();
    expect(g.spawnEnemy('req').hpScale).toBeCloseTo(1, 6);
    g.state.wave = 1;
    expect(g.spawnEnemy('boss').hp).toBeCloseTo(2340, 6);
    g.state.wave = 30;
    expect(g.spawnEnemy('req').hpScale).toBeCloseTo(36.90694603920566, 9);
  });
});

describe('AC-5 Spawn-Intervall', () => {
  it('erster Gegner im Starttick, Intervall Welle 1 = 0.87 s', () => {
    const g = makeGame();
    g.apply({ type: 'startWave' });
    expect(g.state.enemies.length).toBe(0);
    g.step();
    expect(g.state.enemies.length).toBe(1);
    expect(g.state.spawnTimer).toBeCloseTo(0.87, 6);
  });
  it('Welle 30 = 0.25 s', () => {
    const g = makeGame();
    g.state.wave = 29;
    g.apply({ type: 'startWave' });
    g.step();
    expect(g.state.spawnTimer).toBeCloseTo(0.25, 6);
  });
  it('Welle 10: 0.9 - 0.3 = 0.6 s', () => {
    const g = makeGame();
    g.state.wave = 9;
    g.apply({ type: 'startWave' });
    g.step();
    expect(g.state.spawnTimer).toBeCloseTo(0.6, 6);
  });
  it('zweiter Gegner nach ca. 0.87 s (52-54 Ticks), höchstens einer pro Tick', () => {
    const g = makeGame();
    g.apply({ type: 'startWave' });
    g.step();
    let ticks = 0;
    while (g.state.enemies.length < 2 && ticks < 200) {
      g.step();
      ticks++;
      expect(g.state.enemies.length).toBeLessThanOrEqual(2);
    }
    expect(ticks).toBeGreaterThanOrEqual(52);
    expect(ticks).toBeLessThanOrEqual(54);
  });
  it('Welle 30 spawnt alle 15 Ticks', () => {
    const g = makeGame();
    g.state.wave = 29;
    g.apply({ type: 'startWave' });
    g.step();
    let ticks = 0;
    while (g.state.enemies.length < 2) {
      g.step();
      ticks++;
    }
    expect(ticks).toBeGreaterThanOrEqual(15);
    expect(ticks).toBeLessThanOrEqual(16);
  });
});

describe('AC-5 Start nur ohne laufende Welle', () => {
  it('zweites startWave wird abgelehnt, Welle bleibt', () => {
    const g = makeGame();
    g.apply({ type: 'startWave' });
    stepN(g, 5);
    const ev = g.apply({ type: 'startWave' });
    expect(ev).toEqual([expect.objectContaining({ type: 'rejected', reason: 'waveRunning' })]);
    expect(g.state.wave).toBe(1);
    expect(g.state.queue.length).toBe(9);
  });
  it('nach Game Over kein Start', () => {
    const g = makeGame();
    g.state.over = true;
    expect(g.apply({ type: 'startWave' })[0]).toMatchObject({ type: 'rejected', reason: 'gameOver' });
    expect(g.state.wave).toBe(0);
  });
});
