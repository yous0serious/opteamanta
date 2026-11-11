import { describe, expect, it } from 'vitest';
import { COLS, DT, ENEMIES, HEIGHT, LEVEL_DMG, LEVEL_RATE, MAPS, ROWS, TICK_RATE, TILE, TOWERS, TOWER_ORDER, WIDTH } from '../../src/sim/index';

describe('AC-3 Konstanten', () => {
  it('Spielfeld und Takt', () => {
    expect(TILE).toBe(40);
    expect(COLS).toBe(24);
    expect(ROWS).toBe(15);
    expect(WIDTH).toBe(960);
    expect(HEIGHT).toBe(600);
    expect(TICK_RATE).toBe(60);
    expect(DT).toBeCloseTo(1 / 60, 6);
  });
  it('Stufenfaktoren', () => {
    expect([...LEVEL_DMG]).toEqual([1, 1.5, 2.25, 3.375, 5.0625]);
    expect([...LEVEL_RATE]).toEqual([1, 0.9, 0.81, 0.729, 0.6561]);
  });
});

describe('AC-3 Türme', () => {
  it('Reihenfolge', () => {
    expect([...TOWER_ORDER]).toEqual(['dualo', 'analyst', 'dev', 'ppl', 'scrum', 'rte', 'rta', 'rto', 'board']);
  });
  it('dualo', () => {
    const t = TOWERS.dualo;
    expect([t.name, t.emoji, t.cost, t.range, t.rate, t.dmg, t.color]).toEqual(['Dualo', '🎓', 30, 100, 0.35, 6, '#1e88e5']);
  });
  it('analyst', () => {
    const t = TOWERS.analyst;
    expect([t.name, t.emoji, t.cost, t.range, t.rate, t.dmg, t.color]).toEqual(['Business Analyst', '📋', 70, 105, 0.7, 5, '#43a047']);
    expect('slow' in t).toBe(false);
  });
  it('dev', () => {
    const t = TOWERS.dev;
    expect([t.name, t.emoji, t.cost, t.range, t.dps, t.color]).toEqual(['Entwickler', '👩‍💻', 120, 150, 45, '#d81b60']);
    expect(t.rate).toBeUndefined();
  });
  it('ppl', () => {
    const t = TOWERS.ppl;
    expect([t.name, t.emoji, t.cost, t.range, t.rate, t.dmg, t.splash, t.aura, t.color]).toEqual(['PPL', '🧭', 150, 140, 1.5, 40, 65, 120, '#f9a825']);
  });
  it('scrum', () => {
    const t = TOWERS.scrum;
    expect([t.name, t.emoji, t.cost, t.range, t.rate, t.dmg, t.push, t.color]).toEqual(['Scrum Master', '🔁', 110, 115, 2.4, 4, 70, '#8e24aa']);
  });
});

describe('AC-3 Gegner', () => {
  const rows: Array<[string, string, number, number, number, string, number]> = [
    ['req', '📝', 30, 60, 6, '#fff176', 5],
    ['cr', '🔄', 16, 115, 4, '#a5d6a7', 5],
    ['story', '🧩', 14, 90, 3, '#b3e5fc', 5],
    ['obj', '🎯', 110, 38, 12, '#ffcc80', 8],
    ['feat', '📦', 70, 55, 15, '#f48fb1', 5],
    ['creep', '🐛', 40, 62, 8, '#dce775', 5],
    ['debt', '💸', 65, 45, 11, '#cfd8dc', 5],
    ['boss', '🐘', 900, 28, 150, '#ef9a9a', 40],
  ];
  it.each(rows)('%s', (id, emoji, hp, speed, reward, color, leak) => {
    const e = ENEMIES[id as keyof typeof ENEMIES];
    expect([e.emoji, e.hp, e.speed, e.reward, e.color, e.leakDamage]).toEqual([emoji, hp, speed, reward, color, leak]);
  });
  it('Namen und Sonderwerte', () => {
    expect(ENEMIES.req.name).toBe('Anforderung');
    expect(ENEMIES.cr.name).toBe('Change Request');
    expect(ENEMIES.story.name).toBe('User Story');
    expect(ENEMIES.obj.name).toBe('Objective');
    expect(ENEMIES.feat.name).toBe('Feature');
    expect(ENEMIES.creep.name).toBe('Scope Creep');
    expect(ENEMIES.debt.name).toBe('Tech Debt');
    expect(ENEMIES.boss.name).toContain('Alles digital bis Q4');
    expect(ENEMIES.feat.split).toBe(true);
    expect(ENEMIES.creep.grow).toBeCloseTo(0.05, 6);
    expect(ENEMIES.debt.jam).toBe(75);
    expect(ENEMIES.boss.boss).toBe(true);
  });
});

describe('AC-3 Karten', () => {
  const expected: Record<string, [string, Array<[number, number]>]> = {
    spaghetti: ['Spaghetti-Prozess', [[-1, 2], [6, 2], [6, 7], [2, 7], [2, 12], [12, 12], [12, 3], [18, 3], [18, 11], [24, 11]]],
    waterfall: ['Wasserfall-Modell', [[-1, 2], [21, 2], [21, 7], [2, 7], [2, 12], [24, 12]]],
    'release-train': ['Release-Train', [[-1, 7], [5, 7], [5, 2], [11, 2], [11, 12], [17, 12], [17, 4], [21, 4], [21, 9], [24, 9]]],
    matrix: ['Matrix-Organisation', [[-1, 12], [4, 12], [4, 2], [9, 2], [9, 9], [14, 9], [14, 1], [20, 1], [20, 13], [24, 13]]],
  };
  it('Reihenfolge', () => {
    expect(MAPS.map((m) => m.id)).toEqual(['spaghetti', 'waterfall', 'release-train', 'matrix']);
  });
  it.each(Object.keys(expected))('%s', (id) => {
    const m = MAPS.find((x) => x.id === id)!;
    expect(m.name).toBe(expected[id]![0]);
    expect(m.waypoints.map((p) => [p[0], p[1]])).toEqual(expected[id]![1]);
  });
});
