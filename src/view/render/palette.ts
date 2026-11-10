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

export const PALETTES: Record<string, Record<string, string>> = {
  enemies: colors(ENEMIES),
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
