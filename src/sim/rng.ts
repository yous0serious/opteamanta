export interface Rng {
  /** Gleichverteilt in [0, 1). */
  next(): number;
  /** Ganzzahl in [0, n). */
  int(n: number): number;
  /** Interner Zustand (für den State-Hash). */
  state(): number;
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
  };
}
