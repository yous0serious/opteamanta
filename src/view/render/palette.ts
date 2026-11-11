import { ENEMIES, MAPS, TOWERS } from '../../sim/index';
import { hsl } from './draw';
import { INK } from '../texts';

// Gemeinsame Farbpaletten für vorgefärbte Atlas-Varianten (Ruling R-4, Spec visual-overhaul).
// Wird vom Asset-Build (tools/asset-variants.ts) und vom Spiel (Frame-Auswahl) genutzt.

const toHex = (n: number): string => `#${n.toString(16).padStart(6, '0')}`;
const colors = (r: Readonly<Record<string, { color: string }>>): Record<string, string> =>
  Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v.color]));

/** Partikelfarben: Gegner (`e-*`), Türme (`t-*`), Stiftfarben (`ink-*`). */
export const FX_PALETTE: Record<string, string> = {
  ...Object.fromEntries(Object.entries(colors(ENEMIES)).map(([k, v]) => [`e-${k}`, v])),
  ...Object.fromEntries(Object.entries(colors(TOWERS)).map(([k, v]) => [`t-${k}`, v])),
  ...Object.fromEntries(Object.entries(INK).map(([k, v]) => [`ink-${k}`, v])),
};

/** Kräftigere Körperfarben der Monster (Spec office-makeover); auch für Bodenflecken. */
export const MONSTER_COLORS: Record<string, string> = {
  req: '#ffe14d', cr: '#81c784', story: '#7fd0f7', obj: '#ffb74d', feat: '#f06292', creep: '#c0ca33', debt: '#90a4ae', boss: '#e57373',
};

export const PALETTES: Record<string, Record<string, string>> = {
  enemies: colors(ENEMIES),
  monsters: MONSTER_COLORS,
  towers: { ...colors(TOWERS), off: '#9e9e9e' },
  maps: Object.fromEntries(MAPS.map((m) => [m.id, toHex(hsl(m.hue, 65, 82))])),
  fx: FX_PALETTE,
};

const byColor = new Map<string, string>();
for (const [key, color] of Object.entries(FX_PALETTE)) if (!byColor.has(color.toLowerCase())) byColor.set(color.toLowerCase(), key);

/** Farbe (#rrggbb) → Schlüssel der Partikelpalette; unbekannte Farben fallen auf Neutral zurück. */
export function fxKey(color: string): string {
  return byColor.get(color.toLowerCase()) ?? 'ink-neutral';
}
