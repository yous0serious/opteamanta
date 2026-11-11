import { describe, expect, it } from 'vitest';
import { GAME_VERSION, Game, parseReplay, runReplay, type EnemyType, type TowerType } from '../../src/sim/index';

// AC-3: Spielversion, Replay-Roundtrip und Determinismus mit allen neun Rollen und den neuen Gegnern.

const ROLES: readonly TowerType[] = ['dualo', 'analyst', 'dev', 'ppl', 'scrum', 'rte', 'rta', 'rto', 'board'];
const CELLS: Record<TowerType, [number, number]> = {
  dualo: [5, 4], analyst: [6, 4], dev: [7, 4], ppl: [8, 4], scrum: [9, 4],
  rte: [7, 5], rta: [6, 5], rto: [10, 5], board: [11, 5],
};

/** Deterministischer Bot: alle 30 Ticks Rolle in fester Reihenfolge kaufen (falls bezahlbar), Wellen automatisch starten. */
function play(seed: number, ticks: number): { game: Game; spawned: Set<EnemyType> } {
  const game = new Game({ seed, mapId: 'waterfall', mode: 'endless' });
  const spawned = new Set<EnemyType>();
  for (let t = 0; t < ticks && !game.state.over; t++) {
    if (t % 30 === 0) {
      if (!game.state.running) game.apply({ type: 'startWave' });
      const next = ROLES.find((r) => !game.state.towers.some((x) => x.type === r));
      if (next) game.apply({ type: 'place', tower: next, cx: CELLS[next][0], cy: CELLS[next][1] });
      else if (t % 300 === 0) for (const tw of game.state.towers) game.apply({ type: 'upgrade', towerId: tw.id });
    }
    for (const e of game.step()) if (e.type === 'spawned') spawned.add(e.enemy.type);
  }
  return { game, spawned };
}

describe('AC-3 Version', () => {
  it("GAME_VERSION ist '0.3.0'", () => {
    expect(GAME_VERSION).toBe('0.3.0');
    expect(new Game({ seed: 1 }).toReplay().gameVersion).toBe('0.3.0');
  });
  it('parseReplay lehnt gameVersion 0.2.0 ab, nimmt 0.3.0 an; Format bleibt 2', () => {
    const r = JSON.parse(JSON.stringify(new Game({ seed: 1 }).toReplay()));
    expect(r.format).toBe(2);
    expect(() => parseReplay(r)).not.toThrow();
    r.gameVersion = '0.2.0';
    expect(() => parseReplay(r)).toThrow();
  });
});

describe('AC-3 Replay und Determinismus mit allen neuen Rollen/Gegnern', () => {
  const { game, spawned } = play(42, 30000);

  it('der Lauf nutzt alle 9 Rollen sowie Meeting und Hotfix', () => {
    expect([...new Set(game.state.towers.map((t) => t.type))].sort()).toEqual([...ROLES].sort());
    expect(spawned.has('meeting')).toBe(true);
    expect(spawned.has('hotfix')).toBe(true);
    expect(game.state.wave).toBeGreaterThanOrEqual(5);
  });
  it('Replay-Roundtrip: runReplay stimmt überein, neue Turmtypen sind gültige Kommandos', () => {
    const replay = game.toReplay();
    const types = new Set(replay.commands.filter((c) => c[1] === 'place').map((c) => c[2]));
    for (const r of ROLES) expect(types.has(r)).toBe(true);
    const check = runReplay(parseReplay(JSON.parse(JSON.stringify(replay))));
    expect(check.matches).toBe(true);
    expect(check.hash).toBe(game.stateHash());
  });
  it('gleicher Seed und gleiche Kommandos: identischer stateHash', () => {
    const again = play(42, 30000).game;
    expect(again.stateHash()).toBe(game.stateHash());
    expect(again.toReplay()).toEqual(game.toReplay());
  });
  it('stateHash reagiert auf syncTime, phase und frozenTime', () => {
    const g = new Game({ seed: 5, mapId: 'waterfall', mode: 'endless' });
    g.state.money = 1000;
    g.apply({ type: 'place', tower: 'rte', cx: 10, cy: 5 });
    const e = g.spawnEnemy('req');
    const h0 = g.stateHash();
    g.state.towers[0]!.syncTime = 1;
    const h1 = g.stateHash();
    g.state.towers[0]!.phase = 1;
    const h2 = g.stateHash();
    e.frozenTime = 1;
    const h3 = g.stateHash();
    expect(new Set([h0, h1, h2, h3]).size).toBe(4);
  });
});
