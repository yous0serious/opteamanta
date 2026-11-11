import { COLS, Game, LEVEL_DMG, ROWS, TILE, TOWERS, type BalanceConfig, type GameMode, type MapId, type Point, type Tower, type TowerType } from '../src/sim/index';

// Starker Bot (Spec balancing-challenge T03): gleicher ausgewogener Turm-Mix wie der Referenz-Bot, aber
// Platzierung nach Pfadabdeckung, Upgrades nach Nutzen pro SP, Nachkaufen auch während der Wellen.

const ROTATION: readonly TowerType[] = ['dualo', 'dev', 'analyst', 'ppl', 'scrum', 'dev', 'rta', 'rto', 'rte', 'dev'];
/** Geschätzte Wirkung pro Turmtyp und Stufe (für Upgrade-Entscheidungen; Unterstützungsrollen werden nicht aufgewertet). */
const WEIGHT: Partial<Record<TowerType, number>> = { dualo: 17, analyst: 14, dev: 45, ppl: 40, scrum: 14 };
/** Vorstand ab dieser Welle, wenn genug Kapazität da ist (Spec season-2). */
const BOARD_FROM_WAVE = 6;
const BUY_INTERVAL = 60;
const MAX_TICKS_PER_WAVE = 60 * 60 * 10;

export interface BotOptions {
  seed: number;
  maxWave: number;
  mode?: GameMode;
  mapId?: MapId;
  balance?: Readonly<BalanceConfig>;
  /** Wird nach jeder abgeschlossenen Welle aufgerufen (Messwerkzeug). */
  onWaveEnd?: (game: Game) => void;
}

function samplePath(path: readonly Point[], step: number): Point[] {
  const out: Point[] = [];
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1]!;
    const b = path[i]!;
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    for (let d = 0; d < len; d += step) out.push({ x: a.x + ((b.x - a.x) * d) / len, y: a.y + ((b.y - a.y) * d) / len });
  }
  return out;
}

export function playStrongBot(opts: BotOptions): Game {
  const game = new Game({ seed: opts.seed, mapId: opts.mapId, mode: opts.mode ?? 'endless', balance: opts.balance });
  const s = game.state;
  const samples = samplePath(game.path, 10).filter((p) => p.x >= 0 && p.x <= COLS * TILE);
  const coverage = new Map<string, number>();
  const cov = (type: TowerType, cx: number, cy: number): number => {
    const key = `${type}:${cx},${cy}`;
    let c = coverage.get(key);
    if (c === undefined) {
      const r = TOWERS[type].range;
      const x = cx * TILE + TILE / 2;
      const y = cy * TILE + TILE / 2;
      c = 0;
      for (const p of samples) if ((p.x - x) ** 2 + (p.y - y) ** 2 <= r * r) c++;
      coverage.set(key, c);
    }
    return c;
  };
  // Zellen je Typ nach Abdeckung absteigend (stabil nach cy, cx).
  const ranked = new Map<TowerType, Array<[number, number]>>();
  for (const type of ROTATION) {
    if (ranked.has(type) || TOWERS[type].range === 0) continue;
    const cells: Array<[number, number, number]> = [];
    for (let cy = 0; cy < ROWS; cy++) for (let cx = 0; cx < COLS; cx++) cells.push([cov(type, cx, cy), cx, cy]);
    cells.sort((a, b) => b[0] - a[0] || a[2] - b[2] || a[1] - b[1]);
    ranked.set(type, cells.filter((c) => c[0] > 0).map(([, cx, cy]) => [cx, cy]));
  }
  // Wirtschafts-/Vorstandsplätze: Felder mit geringster Abdeckung (gute Plätze bleiben frei)
  const quiet: Array<[number, number]> = [];
  {
    const cells: Array<[number, number, number]> = [];
    for (let cy = 0; cy < ROWS; cy++) for (let cx = 0; cx < COLS; cx++) cells.push([cov('dev', cx, cy), cx, cy]);
    cells.sort((a, b) => a[0] - b[0] || a[2] - b[2] || a[1] - b[1]);
    for (const [, cx, cy] of cells) quiet.push([cx, cy]);
  }
  /** RTE: freies Feld mit den meisten angreifenden Teammitgliedern in Reichweite. */
  const rteCell = (): [number, number] | undefined => {
    const r = TOWERS.rte.range;
    let best: [number, number] | undefined;
    let bestN = 0;
    for (let cy = 0; cy < ROWS; cy++) {
      for (let cx = 0; cx < COLS; cx++) {
        if (game.canPlace('rte', cx, cy) !== null && game.canPlace('rte', cx, cy) !== 'noMoney') continue;
        const x = cx * TILE + TILE / 2;
        const y = cy * TILE + TILE / 2;
        let n = 0;
        for (const t of s.towers) if (!TOWERS[t.type].support && (t.x - x) ** 2 + (t.y - y) ** 2 <= r * r) n++;
        if (n > bestN) {
          bestN = n;
          best = [cx, cy];
        }
      }
    }
    return best;
  };
  const cellFor = (type: TowerType): [number, number] | undefined => {
    const free = ([cx, cy]: [number, number]): boolean => {
      const reason = game.canPlace(type, cx, cy);
      return reason === null || reason === 'noMoney';
    };
    if (type === 'rte') return rteCell();
    if (type === 'rto' || type === 'board') return quiet.find(free);
    return ranked.get(type)!.find(free);
  };

  let next = 0;
  const shop = (): void => {
    // Vorstand einmal, sobald sinnvoll
    if (s.wave >= BOARD_FROM_WAVE && !s.towers.some((t) => t.type === 'board') && s.money >= TOWERS.board.cost) {
      const cell = cellFor('board');
      if (cell) game.apply({ type: 'place', tower: 'board', cx: cell[0], cy: cell[1] });
    }
    for (let guard = 0; guard < 400; guard++) {
      const type = ROTATION[next % ROTATION.length]!;
      const cell = cellFor(type);
      const placeCost = TOWERS[type].cost;
      // Bestes Upgrade nach Nutzen pro SP
      let up: Tower | null = null;
      let upCost = 0;
      let upRatio = 0;
      for (const t of s.towers) {
        const c = game.upgradeCost(t);
        if (c === null) continue;
        const gain = cov(t.type, t.cx, t.cy) * (WEIGHT[t.type] ?? 0) * (LEVEL_DMG[t.level]! - LEVEL_DMG[t.level - 1]!);
        if (gain / c > upRatio) {
          up = t;
          upCost = c;
          upRatio = gain / c;
        }
      }
      // Unterstützungsrollen werden in ihrer Runde immer gesetzt (sofern ein Feld frei ist)
      const placeRatio = !cell ? 0 : TOWERS[type].support ? Infinity : (cov(type, cell[0], cell[1]) * (WEIGHT[type] ?? 0)) / placeCost;
      if (!cell && TOWERS[type].support) {
        next++;
        continue;
      }
      if (cell && placeRatio >= upRatio) {
        if (s.money < placeCost) return;
        game.apply({ type: 'place', tower: type, cx: cell[0], cy: cell[1] });
        next++;
      } else if (up) {
        if (s.money < upCost) return;
        game.apply({ type: 'upgrade', towerId: up.id });
      } else return;
    }
  };

  while (!s.over && s.wave < opts.maxWave) {
    shop();
    game.apply({ type: 'startWave' });
    let ticks = 0;
    while (s.running && !s.over && ticks++ < MAX_TICKS_PER_WAVE) {
      game.step();
      if (ticks % BUY_INTERVAL === 0) shop();
    }
    opts.onWaveEnd?.(game);
  }
  return game;
}
