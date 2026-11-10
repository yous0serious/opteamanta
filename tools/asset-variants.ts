import { ENEMIES, MAPS, TOWERS } from '../src/sim/index';
import { hsl } from '../src/view/render/draw';
import { INK } from '../src/view/texts';

// Farbpaletten für vorgefärbte Atlas-Varianten (Ruling R-4 Spec visual-overhaul):
// Phaser 4 färbt im Canvas-Renderer nicht ein, daher werden Farben beim Build erzeugt.
// Die Paletten kommen direkt aus den Sim-Daten, damit Farben und Spiel synchron bleiben.

const toHex = (n: number): string => `#${n.toString(16).padStart(6, '0')}`;
const fromRecord = (r: Readonly<Record<string, { color: string }>>): Record<string, string> =>
  Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v.color]));

export const PALETTES: Record<string, Record<string, string>> = {
  enemies: fromRecord(ENEMIES),
  towers: { ...fromRecord(TOWERS), off: '#9e9e9e' },
  maps: Object.fromEntries(MAPS.map((m) => [m.id, toHex(hsl(m.hue, 65, 82))])),
  /** Partikel: alle Gegner-, Turm- und Stiftfarben. */
  fx: {
    ...Object.fromEntries(Object.entries(fromRecord(ENEMIES)).map(([k, v]) => [`e-${k}`, v])),
    ...Object.fromEntries(Object.entries(fromRecord(TOWERS)).map(([k, v]) => [`t-${k}`, v])),
    ...Object.fromEntries(Object.entries(INK).map(([k, v]) => [`ink-${k}`, v])),
  },
};

/** Multipliziert RGBA-Pixel mit einer Farbe (wie Phaser-Tint MULTIPLY), Alpha bleibt. */
export function multiplyRgba(data: Buffer, color: string): Buffer {
  const c = color.replace('#', '');
  const full = c.length === 3 ? c.split('').map((x) => x + x).join('') : c;
  const tr = parseInt(full.slice(0, 2), 16);
  const tg = parseInt(full.slice(2, 4), 16);
  const tb = parseInt(full.slice(4, 6), 16);
  const out = Buffer.from(data);
  for (let i = 0; i < out.length; i += 4) {
    out[i] = Math.round((out[i]! * tr) / 255);
    out[i + 1] = Math.round((out[i + 1]! * tg) / 255);
    out[i + 2] = Math.round((out[i + 2]! * tb) / 255);
  }
  return out;
}
