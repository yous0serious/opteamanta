import { Game, type Command, type Enemy, type EnemyType, type SimEvent, type Tower, type TowerType } from '../../src/sim/index';

export function makeGame(seed = 1): Game {
  return new Game({ seed, mapId: 'waterfall' });
}

export function place(game: Game, tower: TowerType, cx: number, cy: number): Tower {
  const events = game.apply({ type: 'place', tower, cx, cy });
  const placed = events.find((e) => e.type === 'placed');
  if (!placed || placed.type !== 'placed') throw new Error(`Platzieren abgelehnt: ${JSON.stringify(events)}`);
  return placed.tower;
}

export function stepN(game: Game, n: number): SimEvent[] {
  const all: SimEvent[] = [];
  for (let i = 0; i < n; i++) all.push(...game.step());
  return all;
}

/** Steppt, bis pred auf die Events eines Ticks zutrifft; liefert die Events dieses Ticks und die Zahl der Ticks. */
export function stepUntil(game: Game, pred: (events: SimEvent[]) => boolean, max = 5000): { events: SimEvent[]; ticks: number } {
  for (let i = 1; i <= max; i++) {
    const events = game.step();
    if (pred(events)) return { events, ticks: i };
  }
  throw new Error(`Bedingung nach ${max} Ticks nicht erreicht`);
}

/** Gegner mit praktisch unendlichen Lebenspunkten. */
export function tank(game: Game, type: EnemyType, dist: number): Enemy {
  const e = game.spawnEnemy(type, { dist });
  e.hp = 1e9;
  e.maxHp = 1e9;
  e.baseMaxHp = 1e9;
  return e;
}

export interface ScriptCommand {
  tick: number;
  cmd: Command;
}

/** Spielt eine Kommandoliste (Tick, Kommando) bis `ticks` ab. */
export function runScript(seed: number, script: ScriptCommand[], ticks: number): Game {
  const game = makeGame(seed);
  let i = 0;
  for (let t = 0; t < ticks; t++) {
    while (i < script.length && script[i]!.tick === t) game.apply(script[i++]!.cmd);
    game.step();
  }
  return game;
}

export const STANDARD_SCRIPT: ScriptCommand[] = [
  { tick: 0, cmd: { type: 'place', tower: 'dualo', cx: 5, cy: 4 } },
  { tick: 0, cmd: { type: 'place', tower: 'analyst', cx: 6, cy: 4 } },
  { tick: 10, cmd: { type: 'place', tower: 'dualo', cx: 7, cy: 4 } },
  { tick: 20, cmd: { type: 'startWave' } },
  { tick: 3700, cmd: { type: 'startWave' } },
  { tick: 7500, cmd: { type: 'startWave' } },
];
