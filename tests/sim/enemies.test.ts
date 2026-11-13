import { describe, expect, it } from 'vitest';
import { makeGame, place, stepN, stepUntil, tank } from './helpers';

describe('AC-7 Feature-Zerfall', () => {
  it('Feature-Kill erzeugt 2 User Stories an derselben Pfadposition', () => {
    const g = makeGame();
    place(g, 'dev', 5, 4);
    g.state.wave = 1;
    g.spawnEnemy('feat', { dist: 300 });
    const { events } = stepUntil(g, (ev) => ev.some((x) => x.type === 'killed'));
    const k = events.find((x) => x.type === 'killed');
    expect(k && k.type === 'killed' ? k.reward : 0).toBe(4);
    expect(g.state.score).toBe(40);
    expect(events.some((x) => x.type === 'split')).toBe(true);
    const stories = g.state.enemies.filter((e) => e.type === 'story');
    expect(stories.length).toBe(2);
    expect(g.state.enemies.some((e) => e.type === 'feat')).toBe(false);
    const dead = k && k.type === 'killed' ? k.enemy : null;
    for (const s of stories) {
      expect(s.dist).toBeCloseTo(dead!.dist, 6);
      expect(s.y).toBeCloseTo(dead!.y, 6);
      expect(s.hp).toBeCloseTo(14, 6);
    }
    expect(Math.abs(stories[0]!.x - stories[1]!.x)).toBeCloseTo(16, 6);
  });
  it('User Story zerfällt nicht weiter', () => {
    const g = makeGame();
    place(g, 'dev', 5, 4);
    g.spawnEnemy('story', { dist: 300 });
    const { events } = stepUntil(g, (ev) => ev.some((x) => x.type === 'killed'));
    expect(events.some((x) => x.type === 'split')).toBe(false);
    expect(g.state.enemies.length).toBe(0);
  });
});

describe('AC-7 Scope Creep', () => {
  it('wächst um 5 % der aktuellen Max-HP pro s (HP und Max-HP)', () => {
    const g = makeGame();
    const e = g.spawnEnemy('creep');
    g.step();
    expect(e.maxHp).toBeCloseTo(40 * (1 + 0.05 / 60), 6);
    expect(e.hp).toBeCloseTo(40 * (1 + 0.05 / 60), 6);
    stepN(g, 59);
    expect(e.maxHp).toBeCloseTo(40 * Math.exp(0.05 * 0.98), 1);
    expect(e.hp).toBeCloseTo(e.maxHp, 6);
  });
  it('wächst höchstens auf 2x Start-Max-HP', () => {
    const g = makeGame();
    const e = g.spawnEnemy('creep');
    stepN(g, 1200); // 20 s: Verdopplung nach ca. 13.9 s
    expect(e.maxHp).toBeGreaterThan(79.9);
    expect(e.maxHp).toBeLessThanOrEqual(80);
    expect(e.hp).toBeLessThanOrEqual(80);
    const before = e.maxHp;
    stepN(g, 120);
    expect(e.maxHp).toBe(before);
  });
  it('Obergrenze bezieht sich auf die skalierte Start-Max-HP', () => {
    const g = makeGame();
    g.state.wave = 6;
    const e = g.spawnEnemy('creep');
    stepN(g, 1200);
    expect(e.maxHp).toBeLessThanOrEqual(149.0325184179141 + 1e-6);
    expect(e.maxHp).toBeGreaterThan(149);
  });
});

describe('AC-7 Tech Debt', () => {
  it('erster Störimpuls nach 1 s, dann alle 3 s, Außer-Betrieb 2 s, Radius 75', () => {
    const g = makeGame();
    g.state.money = 1000;
    const near = place(g, 'dualo', 7, 3);
    const far = place(g, 'dualo', 8, 5);
    const e = tank(g, 'debt', 300);
    const jamTicks: number[] = [];
    for (let i = 1; i <= 700; i++) {
      g.placeAt(e, 300);
      for (const ev of g.step()) if (ev.type === 'jammed') jamTicks.push(i);
    }
    expect(jamTicks.length).toBe(4);
    expect(jamTicks[0]!).toBeGreaterThanOrEqual(60);
    expect(jamTicks[0]!).toBeLessThanOrEqual(61);
    for (let i = 1; i < 4; i++) {
      expect(jamTicks[i]! - jamTicks[i - 1]!).toBeGreaterThanOrEqual(179);
      expect(jamTicks[i]! - jamTicks[i - 1]!).toBeLessThanOrEqual(181);
    }
    expect(far.offTime).toBeLessThanOrEqual(0);
    expect(near.offTime).toBeGreaterThanOrEqual(0);
  });
  it('Außer-Betrieb-Zeit nach Impuls = 2 s', () => {
    const g = makeGame();
    const near = place(g, 'dev', 7, 3);
    const e = tank(g, 'debt', 300);
    stepUntil(g, (ev) => ev.some((x) => x.type === 'jammed'), 200);
    expect(near.offTime).toBeCloseTo(2 - 1 / 60, 6);
    expect(near.beam).toBe(false);
    const hp = e.hp;
    g.placeAt(e, 300);
    g.step();
    expect(e.hp).toBe(hp);
  });
  it('Abstand 74.9 ist betroffen, 75.1 nicht', () => {
    const g = makeGame();
    const e = g.spawnEnemy('debt', { dist: 300 });
    e.jamCooldown = 0.001;
    const inside = place(g, 'dualo', 7, 3);
    const outside = place(g, 'dualo', 9, 3);
    // Störimpuls wird vor der Bewegung geprüft: Position des Gegners ist (e.x, e.y)
    inside.x = e.x + 74.9;
    inside.y = e.y;
    outside.x = e.x + 75.1;
    outside.y = e.y;
    g.step();
    expect(inside.offTime).toBeGreaterThan(0);
    expect(outside.offTime).toBe(0);
  });
});
