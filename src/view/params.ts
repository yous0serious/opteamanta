import { MAPS, type MapId } from '../sim/index';

export interface Params {
  seed: number | null;
  mapId: MapId | undefined;
  speed: number;
  debug: boolean;
  /** Effektstufe (Spec visual-overhaul): high = Filter an, low = keine Filter, halbe Partikel. */
  fx: 'high' | 'low';
  /** Performance-Szenario (Spec visual-overhaul AC-12). */
  bench: boolean;
}

/** URL-Parameter: ?seed=<uint32>&map=<MapId>&speed=<1..10>&debug=1&fx=high|low&bench=1 */
export function readParams(search: string = location.search): Params {
  const q = new URLSearchParams(search);
  const seedRaw = q.get('seed');
  const seedNum = seedRaw !== null && /^\d+$/.test(seedRaw) ? Number(seedRaw) : NaN;
  const seed = Number.isSafeInteger(seedNum) && seedNum <= 0xffffffff ? seedNum : null;
  const mapRaw = q.get('map');
  const mapId = MAPS.some((m) => m.id === mapRaw) ? (mapRaw as MapId) : undefined;
  const speedNum = Number(q.get('speed') ?? '1');
  const speed = Number.isInteger(speedNum) && speedNum >= 1 && speedNum <= 10 ? speedNum : 1;
  const fx = q.get('fx') === 'low' ? 'low' : 'high';
  return { seed, mapId, speed, debug: q.get('debug') === '1', fx, bench: q.get('bench') === '1' };
}

export function randomSeed(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0]!;
}
