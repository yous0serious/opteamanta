import { describe, expect, it } from 'vitest';
import { makeGame, place, stepUntil } from './helpers';

describe('AC-8 Referenzwerte v0.2.0', () => {
  it('Startkapital 300', () => {
    expect(makeGame().state.money).toBe(300);
  });
  it('HP-Skalierung w = 1, 2, 10, 30', () => {
    const g = makeGame();
    const expected: [number, number][] = [
      [1, 1],
      [2, 1.115],
      [10, 2.663629440812066],
      [30, 23.494767633146218],
    ];
    for (const [w, hpS] of expected) {
      g.state.wave = w;
      const e = g.spawnEnemy('req');
      expect(e.hpScale).toBeCloseTo(hpS, 9);
      expect(e.hp).toBeCloseTo(30 * hpS, 6);
    }
  });
  it('Boss-HP: Grund 900 x 2.5 x Skalierung', () => {
    const g = makeGame();
    g.state.wave = 1;
    expect(g.spawnEnemy('boss').hp).toBeCloseTo(2250, 6);
    g.state.wave = 2;
    expect(g.spawnEnemy('boss').hp).toBeCloseTo(2250 * 1.115, 6);
  });
  const rewards: [string, number][] = [['req', 2], ['cr', 1], ['story', 1], ['obj', 3], ['feat', 4], ['creep', 2], ['debt', 3], ['boss', 38]];
  for (const [type, reward] of rewards) {
    it(`Kill-Belohnung ${type} = ${reward}, wellenunabhaengig`, () => {
      for (const wave of [1, 20]) {
        const g = makeGame();
        g.state.money = 100000;
        place(g, 'dev', 5, 4);
        g.state.wave = wave;
        const e = g.spawnEnemy(type as 'req', { dist: 300 });
        e.hp = 1;
        const { events } = stepUntil(g, (ev) => ev.some((x) => x.type === 'killed' && x.enemy.id === e.id));
        const k = events.find((x) => x.type === 'killed' && x.enemy.id === e.id);
        expect(k && k.type === 'killed' ? k.reward : -1).toBe(reward);
      }
    });
  }
  it('Wellenbonus 40 + 5w', () => {
    for (const [w, bonus] of [[1, 45], [2, 50], [10, 90]] as const) {
      const g = makeGame();
      g.state.wave = w - 1;
      g.apply({ type: 'startWave' });
      g.state.queue = [];
      const ev = g.step();
      expect(ev.find((e) => e.type === 'waveCleared')).toMatchObject({ wave: w, bonus });
    }
  });
  it('Wellengroesse 8 + 2w (Nicht-PIP-Wellen)', () => {
    for (const [w, n] of [[1, 10], [2, 12], [10, 28]] as const) {
      const g = makeGame();
      g.state.wave = w - 1;
      g.apply({ type: 'startWave' });
      expect(g.state.queue.length + g.state.enemies.length).toBe(n);
    }
  });
});
