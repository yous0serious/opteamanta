import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp, { type OverlayOptions } from 'sharp';

// Figuren-Baukasten (Spec season-2 AC-5): neue Rollen aus vorhandenen Kenney-Posen – Kleidung per Farbtonbereich
// umgefärbt, Zubehör (eigene SVGs) an Kopf/Augen/Kinn. Die Kopfposition je Pose wird per Template-Matching auf dem
// Alpha-Kanal gegenüber der Ruhepose bestimmt.

const POSES_DIR = 'assets-src/kenney/toon-characters-1/poses';

/** Kopf-Anker der Ruhepose (Quellpixel 192 × 256). */
export interface HeadAnchor {
  cx: number;
  top: number;
  eyes: number;
  chin: number;
}

export interface Recolor {
  /** Farbtonbereich in Grad (inklusive). */
  hue: [number, number];
  minSat: number;
  /** Zielfarbe; Helligkeit des Pixels bleibt relativ zur Referenzhelligkeit erhalten. */
  to: string;
  /** Referenzhelligkeit (0–1) der Ausgangsfarbe, Standard 0.6. */
  refLight?: number;
}

export interface Accessory {
  src: string;
  anchor: 'top' | 'eyes' | 'chin';
  /** Breite in Quellpixeln. */
  width: number;
  dx?: number;
  dy?: number;
}

export interface CharacterRecipe {
  role: string;
  /** Rolle, deren Posen die Grundlage bilden (`<base>-<pose>.png`). */
  base: string;
  recolor: Recolor[];
  accessories: Accessory[];
  /** Abweichende Posenliste (z. B. Statisten nur mit Laufposen). */
  poses?: string[];
  /** Zielbreite der Frames (Standard aus `characters.width`). */
  width?: number;
  /** Porträt `head/<role>` für die Oberfläche erzeugen. */
  portrait?: boolean;
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = max === rn ? (gn - bn) / d + (gn < bn ? 6 : 0) : max === gn ? (bn - rn) / d + 2 : (rn - gn) / d + 4;
  h *= 60;
  return [h, s, l];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

function hexToHsl(hex: string): [number, number, number] {
  const c = hex.replace('#', '');
  return rgbToHsl(parseInt(c.slice(0, 2), 16), parseInt(c.slice(2, 4), 16), parseInt(c.slice(4, 6), 16));
}

async function raw(file: string): Promise<{ data: Buffer; w: number; h: number }> {
  const { data, info } = await sharp(readFileSync(file)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, w: info.width, h: info.height };
}

/** Verschiebung (dx, dy) des Kopfes in `pose` gegenüber `idle` per Alpha-Template-Matching. */
function findHeadShift(idle: { data: Buffer; w: number }, pose: { data: Buffer; w: number; h: number }, a: HeadAnchor): [number, number] {
  const x0 = Math.max(0, a.cx - 56);
  const x1 = Math.min(idle.w - 1, a.cx + 56);
  const y0 = Math.max(0, a.top);
  const y1 = a.chin;
  const alpha = (img: { data: Buffer; w: number }, x: number, y: number): number => img.data[(y * img.w + x) * 4 + 3]! > 128 ? 1 : 0;
  let best: [number, number] = [0, 0];
  let bestScore = -1;
  for (let dy = -44; dy <= 44; dy += 2) {
    for (let dx = -44; dx <= 44; dx += 2) {
      let score = 0;
      for (let y = y0; y <= y1; y += 3) {
        const py = y + dy;
        if (py < 0 || py >= pose.h) continue;
        for (let x = x0; x <= x1; x += 3) {
          const px = x + dx;
          if (px < 0 || px >= pose.w) continue;
          if (alpha(idle, x, y) === alpha(pose, px, py)) score++;
        }
      }
      if (score > bestScore || (score === bestScore && Math.abs(dx) + Math.abs(dy) < Math.abs(best[0]) + Math.abs(best[1]))) {
        bestScore = score;
        best = [dx, dy];
      }
    }
  }
  return best;
}

/** Eine Pose einer neuen Rolle: umgefärbt + Zubehör; Ausgabe in Quellgröße (PNG). */
export async function buildCharacterPose(r: CharacterRecipe, pose: string, anchor: HeadAnchor): Promise<Buffer> {
  const idle = await raw(join(POSES_DIR, `${r.base}-idle.png`));
  const img = await raw(join(POSES_DIR, `${r.base}-${pose}.png`));
  const targets = r.recolor.map((c) => ({ ...c, hsl: hexToHsl(c.to) }));
  for (let i = 0; i < img.data.length; i += 4) {
    if (img.data[i + 3]! < 8) continue;
    const [h, s, l] = rgbToHsl(img.data[i]!, img.data[i + 1]!, img.data[i + 2]!);
    for (const t of targets) {
      if (s < t.minSat || h < t.hue[0] || h > t.hue[1]) continue;
      const ref = t.refLight ?? 0.6;
      const nl = Math.min(0.97, Math.max(0.04, t.hsl[2] * (l / ref)));
      const [nr, ng, nb] = hslToRgb(t.hsl[0], t.hsl[1], nl);
      img.data[i] = nr;
      img.data[i + 1] = ng;
      img.data[i + 2] = nb;
      break;
    }
  }
  const [dx, dy] = pose === 'idle' ? [0, 0] : findHeadShift(idle, img, anchor);
  const layers: OverlayOptions[] = [];
  for (const acc of r.accessories) {
    // Rückenansicht (Pose „hurt“): kein Gesichtszubehör
    if (pose === 'hurt' && acc.anchor !== 'top') continue;
    const svg = await sharp(readFileSync(join('assets-src', acc.src)), { density: 288 }).resize({ width: acc.width }).png().toBuffer();
    const meta = await sharp(svg).metadata();
    const w = meta.width ?? acc.width;
    const h = meta.height ?? acc.width;
    const ay = acc.anchor === 'top' ? anchor.top : acc.anchor === 'eyes' ? anchor.eyes : anchor.chin;
    const left = Math.round(anchor.cx + dx + (acc.dx ?? 0) - w / 2);
    const top = Math.round(ay + dy + (acc.dy ?? 0) - (acc.anchor === 'chin' ? 0 : h / 2));
    if (left >= -w && top >= -h && left < img.w && top < img.h) {
      const cl = Math.max(0, left);
      const ct = Math.max(0, top);
      const cropped = await sharp(svg)
        .extract({ left: cl - left, top: ct - top, width: Math.min(w - (cl - left), img.w - cl), height: Math.min(h - (ct - top), img.h - ct) })
        .png()
        .toBuffer();
      layers.push({ input: cropped, left: cl, top: ct });
    }
  }
  return sharp(img.data, { raw: { width: img.w, height: img.h, channels: 4 } }).composite(layers).png().toBuffer();
}
