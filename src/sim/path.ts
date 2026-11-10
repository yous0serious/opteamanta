import { TILE } from './constants';
import type { Point } from './types';

export function toPixelPath(waypoints: ReadonlyArray<readonly [number, number]>): Point[] {
  return waypoints.map(([cx, cy]) => ({ x: cx * TILE + TILE / 2, y: cy * TILE + TILE / 2 }));
}

/** Alle Zellen auf den Wegsegmenten inkl. Endpunkte (Original Zeile 74–75). */
export function computePathCells(waypoints: ReadonlyArray<readonly [number, number]>): Set<string> {
  const cells = new Set<string>();
  for (let i = 0; i < waypoints.length - 1; i++) {
    const from = waypoints[i]!;
    const to = waypoints[i + 1]!;
    let a = from[0];
    let b = from[1];
    const c = to[0];
    const d = to[1];
    while (a !== c || b !== d) {
      cells.add(`${a},${b}`);
      a += Math.sign(c - a);
      b += Math.sign(d - b);
    }
    cells.add(`${c},${d}`);
  }
  return cells;
}

export function segmentLength(a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export function pathLength(path: readonly Point[]): number {
  let total = 0;
  for (let i = 1; i < path.length; i++) total += segmentLength(path[i - 1]!, path[i]!);
  return total;
}

/** Quadrat des Abstands (D-6: Vergleiche ohne Math.hypot). */
export function dist2(a: Point, b: Point): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}
