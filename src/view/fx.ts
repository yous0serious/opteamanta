import type { Params } from './params';

/** Effektstufe und Bewegungspräferenz (Spec visual-overhaul AC-8, AC-9). */
export interface FxSettings {
  level: 'high' | 'low';
  reducedMotion: boolean;
  /** Faktor für Partikelmengen: 1 bei high, 0.5 bei low. */
  particleScale: number;
}

export function readFx(params: Pick<Params, 'fx'>, mql?: Pick<MediaQueryList, 'matches'>): FxSettings {
  const media = mql ?? (typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : { matches: false });
  const level = params.fx;
  return { level, reducedMotion: media.matches, particleScale: level === 'high' ? 1 : 0.5 };
}
