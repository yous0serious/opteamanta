import { NICKNAME_RE } from './api';

// Automatische Teamnamen (Spec office-makeover AC-2): „<Adjektiv> <Tier> <NNNN>“, höchstens 16 Zeichen.
// Adjektive und Tiere haben je höchstens 5 Zeichen → 5 + 1 + 5 + 1 + 4 = 16.

export const ADJECTIVES = [
  'Agile', 'Lean', 'Swift', 'Bold', 'Rapid', 'Smart', 'Lucky', 'Happy', 'Brave', 'Quick',
  'Calm', 'Epic', 'Mega', 'Turbo', 'Super', 'Hyper', 'Witty', 'Jolly', 'Fancy', 'Zen',
] as const;

export const ANIMALS = [
  'Otter', 'Panda', 'Koala', 'Lynx', 'Fox', 'Owl', 'Yak', 'Gnu', 'Llama', 'Bison',
  'Moose', 'Eagle', 'Shark', 'Whale', 'Tiger', 'Hippo', 'Sloth', 'Squid', 'Gecko', 'Lemur',
] as const;

/** Zufallszahl in [0, 1); Standard: kryptografischer Zufall (kein Teil der Simulation). */
export type RandomFn = () => number;

const cryptoRandom: RandomFn = () => crypto.getRandomValues(new Uint32Array(1))[0]! / 0x1_0000_0000;

export function generateName(random: RandomFn = cryptoRandom): string {
  const pick = <T>(xs: readonly T[]): T => xs[Math.floor(random() * xs.length)]!;
  const adjective = pick(ADJECTIVES);
  const animal = pick(ANIMALS);
  const digits = String(Math.floor(random() * 10_000)).padStart(4, '0');
  const name = `${adjective} ${animal} ${digits}`;
  if (!NICKNAME_RE.test(name)) throw new Error(`Ungültiger generierter Name: ${name}`);
  return name;
}
