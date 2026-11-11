import type { Params } from './params';

/** Effektstufe (Spec season-2 AC-9): Maximal, Normal, Ruhig. */
export type FxLevel = 'max' | 'normal' | 'calm';

/**
 * Effektstufe und Bewegungspräferenz (Spec visual-overhaul AC-8/AC-9, Spec season-2 AC-9).
 * Das Objekt ist veränderlich: Ein Wechsel über die Oberfläche wirkt sofort (Werte werden live gelesen).
 */
export interface FxSettings {
  level: FxLevel;
  /** Ruhig: kein Wackeln, kein Hitstop, keine Combo-Effekte, keine Lauf-/Atemanimationen. */
  reducedMotion: boolean;
  /** Partikelmenge: Maximal 1, Normal 0.8, Ruhig 0.5. */
  particleScale: number;
  /** Nur Maximal: Zeitlupe und Kamerazoom. */
  cinematic: boolean;
}

export const FX_STORAGE_KEY = 'bd.fx';
const SCALE: Record<FxLevel, number> = { max: 1, normal: 0.8, calm: 0.5 };

function levelFrom(raw: string | null | undefined): FxLevel | null {
  if (raw === 'max' || raw === 'high') return 'max';
  if (raw === 'normal') return 'normal';
  if (raw === 'calm' || raw === 'low') return 'calm';
  return null;
}

/** Werte einer Stufe in das (geteilte) Einstellungsobjekt schreiben. */
export function applyLevel(s: FxSettings, level: FxLevel): FxSettings {
  s.level = level;
  s.reducedMotion = level === 'calm';
  s.particleScale = SCALE[level];
  s.cinematic = level === 'max';
  return s;
}

/**
 * Reihenfolge: URL-Parameter `fx` (high→Maximal, low→Ruhig, auch max/normal/calm) > gespeicherte Wahl >
 * `prefers-reduced-motion` (→ Ruhig) > Maximal.
 */
export function readFx(params: Pick<Params, 'fx'>, mql?: Pick<MediaQueryList, 'matches'>, stored?: string | null): FxSettings {
  const media = mql ?? (typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : { matches: false });
  let saved = stored;
  if (saved === undefined) {
    try {
      saved = typeof localStorage !== 'undefined' ? localStorage.getItem(FX_STORAGE_KEY) : null;
    } catch {
      saved = null;
    }
  }
  const level = levelFrom(params.fx) ?? levelFrom(saved) ?? (media.matches ? 'calm' : 'max');
  return applyLevel({ level, reducedMotion: false, particleScale: 1, cinematic: true }, level);
}

/** Wahl der Oberfläche speichern und anwenden. */
export function setFxLevel(s: FxSettings, level: FxLevel): void {
  applyLevel(s, level);
  try {
    localStorage.setItem(FX_STORAGE_KEY, level);
  } catch {
    // Speicher gesperrt – gilt nur für diese Sitzung
  }
}
