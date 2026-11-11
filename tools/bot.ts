import { COLS, Game, ROWS, TILE, TOWERS, type Tower, type TowerType } from '../src/sim/index';
import type { BotOptions } from './bot-strong';

/** Kauf-Rotation des Referenz-Bots: Mix aus Spec 1, ab Saison 2 inkl. RTO, RTA und RTE (Spec season-2 AC-4). */
export const BOT_ROTATION: readonly TowerType[] = ['dualo', 'dev', 'analyst', 'ppl', 'scrum', 'dev', 'rto', 'rta', 'rte'];

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
 * Referenz-Bot: vor jeder Welle Türme der Rotation kaufen, sonst das billigste Upgrade, dann Welle spielen.
 * Endet bei Game Over, Sieg oder nach maxWave abgeschlossenen Wellen. Standardmodus: endless.
 */
export function playBot(opts: BotOptions): Game {
  const game = new Game({ seed: opts.seed, mapId: opts.mapId, mode: opts.mode ?? 'endless', balance: opts.balance });
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
    opts.onWaveEnd?.(game);
  }
  return game;
}
