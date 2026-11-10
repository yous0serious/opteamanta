import { COLS, Game, ROWS, TILE, TOWERS, type GameMode, type MapId, type Tower, type TowerType } from '../src/sim/index';

/** Kauf-Rotation des Bots. */
export const BOT_ROTATION: readonly TowerType[] = ['dualo', 'dev', 'analyst', 'ppl', 'scrum', 'dev'];

const MAX_TICKS_PER_WAVE = 60 * 60 * 10;

/** Freie Zellen, sortiert nach Abstand zur Pfadmitte, dann cy, dann cx. */
function candidateCells(game: Game): Array<[number, number]> {
  const mid = game.path[Math.floor(game.path.length / 2)]!;
  const cells: Array<[number, number, number]> = [];
  for (let cy = 0; cy < ROWS; cy++) {
    for (let cx = 0; cx < COLS; cx++) {
      const dx = cx * TILE + TILE / 2 - mid.x;
      const dy = cy * TILE + TILE / 2 - mid.y;
      cells.push([dx * dx + dy * dy, cx, cy]);
    }
  }
  cells.sort((a, b) => a[0] - b[0] || a[2] - b[2] || a[1] - b[1]);
  return cells.map(([, cx, cy]) => [cx, cy]);
}

/**
 * Deterministischer Bot: vor jeder Welle Türme der Rotation kaufen, sonst das billigste Upgrade,
 * dann Welle spielen. Endet bei Game Over oder nach maxWave abgeschlossenen Wellen.
 */
export function playBot(opts: { seed: number; maxWave: number; mode?: GameMode; mapId?: MapId }): Game {
  const game = new Game({ seed: opts.seed, mapId: opts.mapId, mode: opts.mode ?? 'endless' });
  const cells = candidateCells(game);
  let next = 0;
  const s = game.state;
  while (!s.over && s.wave < opts.maxWave) {
    for (;;) {
      const type = BOT_ROTATION[next % BOT_ROTATION.length]!;
      const cell = cells.find(([cx, cy]) => game.canPlace(type, cx, cy) === null);
      if (cell && s.money >= TOWERS[type].cost) {
        game.apply({ type: 'place', tower: type, cx: cell[0], cy: cell[1] });
        next++;
        continue;
      }
      let cheapest: Tower | null = null;
      let cheapestCost = Infinity;
      for (const t of s.towers) {
        const c = game.upgradeCost(t);
        if (c !== null && c < cheapestCost) {
          cheapest = t;
          cheapestCost = c;
        }
      }
      if (cheapest && s.money >= cheapestCost) {
        game.apply({ type: 'upgrade', towerId: cheapest.id });
        continue;
      }
      break;
    }
    game.apply({ type: 'startWave' });
    let ticks = 0;
    while (s.running && !s.over && ticks++ < MAX_TICKS_PER_WAVE) game.step();
  }
  return game;
}
