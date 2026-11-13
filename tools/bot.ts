import { COLS, Game, ROWS, TILE, type Branch, type Tower, type TowerType } from '../src/sim/index';
import type { BotOptions } from './bot-strong';

/** Kauf-Rotation des Referenz-Bots: Mix aus Spec 1, ab Saison 2 inkl. RTO, RTA und RTE (Spec season-2 AC-4). */
export const BOT_ROTATION: readonly TowerType[] = ['dualo', 'dev', 'analyst', 'ppl', 'scrum', 'dev', 'rto', 'rta', 'rte'];

/** Zweigwahl der Bots beim Schritt Stufe 2 → 3 (Spec campaigns). */
export const BOT_BRANCH: Readonly<Record<TowerType, Branch>> = {
  dualo: 'a', analyst: 'a', dev: 'b', ppl: 'a', scrum: 'a', rte: 'a', rta: 'a', rto: 'a', board: 'b',
};

const MAX_TICKS_PER_WAVE = 60 * 60 * 10;

/** Upgrade-Kommando inkl. Zweig, falls der Schritt 2 → 3 ansteht. */
export function upgradeCommand(t: Tower): { type: 'upgrade'; towerId: number; branch?: Branch } {
  return t.level === 2 ? { type: 'upgrade', towerId: t.id, branch: BOT_BRANCH[t.type] } : { type: 'upgrade', towerId: t.id };
}

/** Neues Spiel für die Bot-Optionen (Level, Loadout, Modus). */
export function botGame(opts: BotOptions): Game {
  return new Game({
    seed: opts.seed, mapId: opts.levelId ? undefined : opts.mapId, mode: opts.levelId ? 'level' : (opts.mode ?? 'endless'),
    levelId: opts.levelId, loadout: opts.loadout, balance: opts.balance,
  });
}

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
 * In Leveln nutzt er nur die freigeschalteten Rollen.
 */
export function playBot(opts: BotOptions): Game {
  const game = botGame(opts);
  const rotation = BOT_ROTATION.filter((r) => game.roles.includes(r));
  const cells = candidateCells(game);
  let next = 0;
  const s = game.state;
  const maxWave = s.waves ?? opts.maxWave;
  while (!s.over && s.wave < Math.min(opts.maxWave, maxWave)) {
    for (;;) {
      const type = rotation[next % rotation.length]!;
      const cell = cells.find(([cx, cy]) => game.canPlace(type, cx, cy) === null);
      if (cell && s.money >= game.towerCost(type)) {
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
        game.apply(upgradeCommand(cheapest));
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
