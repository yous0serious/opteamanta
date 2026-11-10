// Farbpaletten für vorgefärbte Atlas-Varianten (Ruling R-4 Spec visual-overhaul):
// Phaser 4 färbt im Canvas-Renderer nicht ein, daher werden Farben beim Build erzeugt.
// Die Paletten liegen in src/view/render/palette.ts (gemeinsam mit dem Spiel).
export { PALETTES } from '../src/view/render/palette';

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
