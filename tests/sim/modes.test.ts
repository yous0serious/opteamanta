import { describe, expect, it } from 'vitest';
import { Game } from '../../src/sim/index';
import { makeGame } from './helpers';

function rejection(g: Game): string | undefined {
  const e = g.apply({ type: 'startWave' }).find((x) => x.type === 'rejected');
  return e && e.type === 'rejected' ? e.reason : undefined;
}

function clearWave(g: Game, wave: number) {
  g.state.wave = wave - 1;
  g.apply({ type: 'startWave' });
  g.state.queue = [];
  return g.step();
}

describe('AC-1 Modi', () => {
  it('Standardmodus ist challenge', () => {
    expect(makeGame().state.mode).toBe('challenge');
    expect(new Game({ seed: 1, mapId: 'waterfall', mode: 'endless' }).state.mode).toBe('endless');
  });
  it('stateHash unterscheidet Modi', () => {
    const a = new Game({ seed: 1, mapId: 'waterfall', mode: 'challenge' });
    const b = new Game({ seed: 1, mapId: 'waterfall', mode: 'endless' });
    expect(a.stateHash()).not.toBe(b.stateHash());
  });
});

describe('AC-2 Sieg und Endlos', () => {
  it('Challenge: Sieg nach Welle 30 mit Bonus Moral x 100, danach gameOver', () => {
    const g = new Game({ seed: 1, mapId: 'waterfall', mode: 'challenge' });
    g.state.lives = 80;
    for (let w = 1; w < 30; w++) {
      const ev = clearWave(g, w);
      expect(ev.some((e) => e.type === 'victory')).toBe(false);
      expect(g.state.over).toBe(false);
    }
    const score0 = g.state.score;
    const ev = clearWave(g, 30);
    expect(g.state.won).toBe(true);
    expect(g.state.over).toBe(true);
    expect(ev.find((e) => e.type === 'victory')).toMatchObject({ wave: 30, bonus: 8000 });
    expect(g.state.score).toBe(score0 + 8000);
    expect(rejection(g)).toBe('gameOver');
    expect(g.toReplay().result.won).toBe(true);
  });
  it('Endlos: nach Welle 30 kein Sieg, Welle 31 startet', () => {
    const g = new Game({ seed: 1, mapId: 'waterfall', mode: 'endless' });
    const ev = clearWave(g, 30);
    expect(ev.some((e) => e.type === 'victory')).toBe(false);
    expect(g.state.won).toBe(false);
    expect(g.state.over).toBe(false);
    g.apply({ type: 'startWave' });
    expect(g.state.wave).toBe(31);
    expect(g.state.running).toBe(true);
  });
});
