export interface Rng {
  /** Gleichverteilt in [0, 1). */
  next(): number;
  /** Ganzzahl in [0, n). */
  int(n: number): number;
  /** Interner Zustand (für den State-Hash). */
  state(): number;
  /** Unabhängige Kopie mit gleichem Zustand (Vorschau ohne Seiteneffekt). */
  clone(): Rng;
}

/** mulberry32: kleiner, schneller 32-Bit-PRNG; nur Integer-Operationen, daher engine-unabhängig. */
export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  const next = (): number => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (n) => Math.floor(next() * n),
    state: () => a,
    clone: () => createRng(a),
  };
}

/** Mischt zwei 32-Bit-Werte zu einem neuen Seed (eigener Zufallsstrom je Welle, Spec campaigns „peekWave“). */
export function mixSeed(a: number, b: number): number {
  let h = Math.imul((a >>> 0) ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul((b >>> 0) + 0x7f4a7c15, 0xc2b2ae35);
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}
