import { describe, expect, it } from 'vitest';
import { Game } from '../../src/sim/index';
import { STANDARD_SCRIPT, makeGame, runScript } from './helpers';

describe('AC-8 Determinismus', () => {
  it('Seed 42, gleiche Kommandos, 10000 Ticks: identischer Hash', () => {
    const a = runScript(42, STANDARD_SCRIPT, 10000);
    const b = runScript(42, STANDARD_SCRIPT, 10000);
    expect(a.state.tick).toBe(10000);
    expect(a.state.wave).toBeGreaterThanOrEqual(1);
    expect(a.stateHash()).toBe(b.stateHash());
    expect(a.state.score).toBe(b.state.score);
    expect(a.toReplay()).toEqual(b.toReplay());
  });
  it('Hash hat 8 Hex-Zeichen', () => {
    expect(runScript(42, STANDARD_SCRIPT, 500).stateHash()).toMatch(/^[0-9a-f]{8}$/);
    expect(makeGame(1).stateHash()).toMatch(/^[0-9a-f]{8}$/);
  });
  it('Seed 43 ergibt einen anderen Hash', () => {
    expect(runScript(43, STANDARD_SCRIPT, 10000).stateHash()).not.toBe(runScript(42, STANDARD_SCRIPT, 10000).stateHash());
  });
  it('Hash ändert sich mit dem Zustand', () => {
    const g = makeGame(42);
    const h0 = g.stateHash();
    g.step();
    expect(g.stateHash()).not.toBe(h0);
  });
  it('Tickzahl unabhängig von der Spielgeschwindigkeit (1, 2, 3 Ticks pro Frame)', () => {
    const hashes = [1, 2, 3].map((speed) => {
      const g = makeGame(42);
      let i = 0;
      let frames = 0;
      while (g.state.tick < 6000) {
        for (let k = 0; k < speed && g.state.tick < 6000; k++) {
          while (i < STANDARD_SCRIPT.length && STANDARD_SCRIPT[i]!.tick === g.state.tick) g.apply(STANDARD_SCRIPT[i++]!.cmd);
          g.step();
        }
        frames++;
      }
      expect(frames).toBe(Math.ceil(6000 / speed));
      expect(g.state.tick).toBe(6000);
      return g.stateHash();
    });
    expect(hashes[1]).toBe(hashes[0]);
    expect(hashes[2]).toBe(hashes[0]);
  });
  it('Karte aus dem Seed: gleicher Seed, gleiche Karte; mapId überschreibt', () => {
    expect(new Game({ seed: 5 }).map.id).toBe(new Game({ seed: 5 }).map.id);
    expect(new Game({ seed: 5, mapId: 'matrix' }).map.id).toBe('matrix');
    const ids = new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((s) => new Game({ seed: s }).map.id));
    expect(ids.size).toBeGreaterThan(1);
  });
});
