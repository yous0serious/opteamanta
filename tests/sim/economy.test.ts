import { describe, expect, it } from 'vitest';
import { Game } from '../../src/sim/index';
import { makeGame, place, stepN, stepUntil } from './helpers';

function rejection(game: Game, cmd: Parameters<Game['apply']>[0]): string | undefined {
  const e = game.apply(cmd).find((x) => x.type === 'rejected');
  return e && e.type === 'rejected' ? e.reason : undefined;
}

describe('AC-4 Start und Platzieren', () => {
  it('Startwerte', () => {
    const g = makeGame();
    expect(g.state.money).toBe(300);
    expect(g.state.lives).toBe(100);
    expect(g.state.wave).toBe(0);
    expect(g.state.score).toBe(0);
  });
  it('Platzieren zieht Kosten ab und setzt Mittelpunkt', () => {
    const g = makeGame();
    const t = place(g, 'dualo', 5, 4);
    expect(g.state.money).toBe(270);
    expect([t.x, t.y, t.level, t.spent]).toEqual([220, 180, 1, 30]);
  });
  it('lehnt Pfadzellen ab (inkl. Endpunkte)', () => {
    const g = makeGame();
    for (const [cx, cy] of [[5, 2], [0, 2], [21, 2], [21, 5], [10, 7], [2, 10], [24 - 1, 12], [2, 12], [2, 7]]) {
      expect(rejection(g, { type: 'place', tower: 'dualo', cx: cx!, cy: cy! })).toBe('path');
    }
    expect(g.state.towers.length).toBe(0);
    expect(g.state.money).toBe(300);
  });
  it('lehnt belegte Zelle ab', () => {
    const g = makeGame();
    place(g, 'dualo', 5, 4);
    expect(rejection(g, { type: 'place', tower: 'dualo', cx: 5, cy: 4 })).toBe('occupied');
    expect(g.state.money).toBe(270);
  });
  it('lehnt außerhalb ab', () => {
    const g = makeGame();
    for (const [cx, cy] of [[-1, 4], [24, 4], [5, -1], [5, 15]]) {
      expect(rejection(g, { type: 'place', tower: 'dualo', cx: cx!, cy: cy! })).toBe('outOfBounds');
    }
  });
  it('lehnt ohne Geld ab', () => {
    const g = makeGame();
    g.state.money = 29;
    expect(rejection(g, { type: 'place', tower: 'dualo', cx: 5, cy: 4 })).toBe('noMoney');
    g.state.money = 30;
    expect(rejection(g, { type: 'place', tower: 'dualo', cx: 5, cy: 4 })).toBeUndefined();
    expect(g.state.money).toBe(0);
  });
});

describe('AC-4 Upgrade und Verkauf', () => {
  it('Upgrade-Kosten dev: 96, 192, 288, 384; kein Upgrade auf Stufe 5', () => {
    const g = makeGame();
    g.state.money = 100000;
    const t = place(g, 'dev', 5, 4);
    const costs: Array<number | null> = [];
    for (let i = 0; i < 4; i++) {
      costs.push(g.upgradeCost(t));
      const before = g.state.money;
      const ev = g.apply({ type: 'upgrade', towerId: t.id, branch: 'b' });
      const up = ev.find((e) => e.type === 'upgraded');
      expect(up).toBeDefined();
      expect(before - g.state.money).toBe(costs[i]);
    }
    expect(costs).toEqual([96, 192, 288, 384]);
    expect(t.level).toBe(5);
    expect(g.upgradeCost(t)).toBeNull();
    expect(rejection(g, { type: 'upgrade', towerId: t.id })).toBe('maxLevel');
    expect(t.level).toBe(5);
  });
  it('Upgrade ohne Geld abgelehnt', () => {
    const g = makeGame();
    const t = place(g, 'dev', 5, 4);
    g.state.money = 95;
    expect(rejection(g, { type: 'upgrade', towerId: t.id })).toBe('noMoney');
    expect(t.level).toBe(1);
  });
  it('Verkauf dev nach einem Upgrade = 130', () => {
    const g = makeGame();
    g.state.money = 1000;
    const t = place(g, 'dev', 5, 4);
    g.apply({ type: 'upgrade', towerId: t.id });
    expect(t.spent).toBe(216);
    expect(g.sellValue(t)).toBe(130);
    const before = g.state.money;
    g.apply({ type: 'sell', towerId: t.id });
    expect(g.state.money - before).toBe(130);
    expect(g.state.towers.length).toBe(0);
  });
  it('Verkauf ohne Upgrade: dualo 18, ppl 90', () => {
    const g = makeGame();
    g.state.money = 1000;
    expect(g.sellValue(place(g, 'dualo', 5, 4))).toBe(18);
    expect(g.sellValue(place(g, 'ppl', 6, 4))).toBe(90);
  });
});

describe('AC-4 Belohnungen', () => {
  function killWithDev(wave: number, type: 'req' | 'feat'): { reward: number; money: number; score: number } {
    const g = makeGame();
    place(g, 'dev', 5, 4);
    g.state.wave = wave;
    g.spawnEnemy(type, { dist: 300 });
    const money0 = g.state.money;
    const { events } = stepUntil(g, (ev) => ev.some((e) => e.type === 'killed'));
    const k = events.find((e) => e.type === 'killed');
    return { reward: k && k.type === 'killed' ? k.reward : -1, money: g.state.money - money0, score: g.state.score };
  }
  it('req Welle 1: 2 SP, Score 20', () => {
    expect(killWithDev(1, 'req')).toEqual({ reward: 2, money: 2, score: 20 });
  });
  it('req Welle 6: Belohnung wellenunabhaengig 2 SP, Score 20', () => {
    expect(killWithDev(6, 'req')).toEqual({ reward: 2, money: 2, score: 20 });
  });
  it('Wellenbonus Welle 1 = 45, Welle 2 = 50', () => {
    const g = makeGame();
    g.apply({ type: 'startWave' });
    g.state.queue = [];
    const m0 = g.state.money;
    const ev = g.step();
    expect(ev.find((e) => e.type === 'waveCleared')).toMatchObject({ wave: 1, bonus: 45 });
    expect(g.state.money - m0).toBe(45);
    expect(g.state.running).toBe(false);
    g.apply({ type: 'startWave' });
    g.state.queue = [];
    const m1 = g.state.money;
    g.step();
    expect(g.state.money - m1).toBe(50);
  });
  it('Welle gilt erst als beendet, wenn Spielfeld leer', () => {
    const g = makeGame();
    g.apply({ type: 'startWave' });
    g.state.queue = [];
    g.spawnEnemy('req', { dist: 100 });
    const ev = g.step();
    expect(ev.some((e) => e.type === 'waveCleared')).toBe(false);
    expect(g.state.running).toBe(true);
  });
});

describe('AC-4 Leck und Game Over', () => {
  function leak(type: 'req' | 'obj' | 'boss'): number {
    const g = makeGame();
    g.spawnEnemy(type, { dist: 2919.5 });
    stepN(g, 2);
    return g.state.lives;
  }
  it('Moralverlust: req 5, obj 8, boss 40', () => {
    expect(leak('req')).toBe(95);
    expect(leak('obj')).toBe(92);
    expect(leak('boss')).toBe(60);
  });
  it('Leck entfernt den Gegner und gibt kein Geld', () => {
    const g = makeGame();
    g.spawnEnemy('req', { dist: 2919.5 });
    const ev = stepN(g, 2);
    expect(ev.some((e) => e.type === 'leaked')).toBe(true);
    expect(g.state.enemies.length).toBe(0);
    expect(g.state.money).toBe(300);
    expect(g.state.score).toBe(0);
  });
  it('Game Over bei Moral <= 0, Warteschlange geleert, Zustand eingefroren', () => {
    const g = makeGame();
    g.state.lives = 5;
    g.state.running = true;
    g.state.wave = 3;
    g.state.queue = ['req', 'req'];
    g.spawnEnemy('req', { dist: 2919.5 });
    const ev = stepN(g, 2);
    expect(ev.some((e) => e.type === 'gameOver')).toBe(true);
    expect(g.state.lives).toBe(0);
    expect(g.state.over).toBe(true);
    expect(g.state.running).toBe(false);
    expect(g.state.queue).toEqual([]);
    const h = g.stateHash();
    const tick = g.state.tick;
    expect(g.step()).toEqual([]);
    stepN(g, 100);
    expect(g.stateHash()).toBe(h);
    expect(g.state.tick).toBe(tick);
    expect(rejection(g, { type: 'place', tower: 'dualo', cx: 5, cy: 4 })).toBe('gameOver');
    expect(rejection(g, { type: 'startWave' })).toBe('gameOver');
  });
});
