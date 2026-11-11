import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp, { type OverlayOptions } from 'sharp';

// Monster-Baukasten (Spec office-makeover, ADR-0005): setzt Gegner aus Kenney-„Monster Builder Pack“-Teilen zusammen
// und erzeugt Lauf-Frames (walk0..3) sowie eine weiße Treffer-Silhouette (hit). Weiße Teile werden beim Build
// eingefärbt (der Canvas-Renderer färbt nicht ein).

const PARTS = 'assets-src/kenney/monster-builder-pack/parts';

export interface MonsterRecipe {
  /** Frame-Präfix, z. B. `enemy/req` → `enemy/req/walk0` … `enemy/req/hit`. */
  name: string;
  body: string;
  arm: string;
  leg: string;
  eye: string;
  /** Anzahl Augen (1–3). */
  eyes?: number;
  mouth: string;
  /** Paariges Detail oben (Fühler, Hörner, Ohren), gespiegelt. */
  detail?: string;
  /** Färbung (#rrggbb) für weiße Teile (body/arm/leg/detail mit `_white`). */
  tint?: string;
  /** Zusatz-Bild (z. B. Ticket-Symbol), relativ zur Körpermitte; optional auf eingefärbtem Hintergrund (Post-it). */
  badge?: { src: string; size: number; dx: number; dy: number; rotate?: number; bg?: string; bgTint?: string };
  /** Krone o. Ä. über dem Kopf. */
  crown?: { src: string; size: number };
  /** Zielbreite der Frames in px. */
  width: number;
}

interface Img {
  buf: Buffer;
  w: number;
  h: number;
}

async function load(file: string, tint?: string, flip = false, rotate = 0): Promise<Img> {
  const path = file.includes('/') ? join('assets-src', file) : join(PARTS, `${file}.png`);
  let img = sharp(readFileSync(path), path.endsWith('.svg') ? { density: 288 } : {}).ensureAlpha();
  if (flip) img = img.flop();
  if (tint) {
    const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
    const c = tint.replace('#', '');
    const t = [0, 2, 4].map((i) => parseInt(c.slice(i, i + 2), 16));
    for (let i = 0; i < data.length; i += 4) for (let k = 0; k < 3; k++) data[i + k] = Math.round((data[i + k]! * t[k]!) / 255);
    img = sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } });
  }
  if (rotate) img = sharp(await img.png().toBuffer()).rotate(rotate, { background: { r: 0, g: 0, b: 0, alpha: 0 } });
  const { data, info } = await img.png().toBuffer({ resolveWithObject: true });
  return { buf: data, w: info.width, h: info.height };
}

async function resizeTo(img: Img, width: number): Promise<Img> {
  const { data, info } = await sharp(img.buf).resize({ width: Math.round(width) }).png().toBuffer({ resolveWithObject: true });
  return { buf: data, w: info.width, h: info.height };
}

const isWhite = (part: string): boolean => part.includes('white');

/** Ein Frame: Beine/Arme mit Phase (−1…1), Körper-Wippen in px. */
async function frame(r: MonsterRecipe, phase: number, bob: number): Promise<Buffer> {
  const tint = (p: string): string | undefined => (r.tint && isWhite(p) ? r.tint : undefined);
  const body = await load(r.body, tint(r.body));
  const legR = await load(r.leg, tint(r.leg));
  const legL = await load(r.leg, tint(r.leg), true);
  const armR = await load(r.arm, tint(r.arm), false, 10 * phase);
  const armL = await load(r.arm, tint(r.arm), true, 10 * phase);
  const det = r.detail ? await load(r.detail, tint(r.detail)) : null;
  const detL = r.detail ? await load(r.detail, tint(r.detail), true) : null;

  const top = (det ? det.h * 0.6 : 0) + (r.crown ? r.crown.size * 0.55 : 0) + 12;
  const W = body.w + armR.w * 1.3 + 24;
  const H = Math.round(top + body.h + legR.h * 0.72 + 12);
  const cx = W / 2;
  const by = top + bob;
  const bx = cx - body.w / 2;
  const layers: OverlayOptions[] = [];
  const put = (img: Img, x: number, y: number): void => {
    layers.push({ input: img.buf, left: Math.round(x), top: Math.round(y) });
  };
  // Beine (hinter dem Körper), abwechselnd angehoben
  const legY = by + body.h - legR.h * 0.3;
  const lift = legR.h * 0.07;
  put(legL, cx - body.w * 0.24 - legL.w * 0.75, legY - lift * Math.max(0, phase) + 2);
  put(legR, cx + body.w * 0.24 - legR.w * 0.25, legY - lift * Math.max(0, -phase) + 2);
  // Arme (hinter dem Körper)
  put(armL, bx - armL.w * 0.62, by + body.h * 0.38 - armL.h * 0.08);
  put(armR, bx + body.w - armR.w * 0.38, by + body.h * 0.38 - armR.h * 0.08);
  // Details oben (paarig)
  if (det && detL) {
    put(detL, cx - body.w * 0.28 - detL.w / 2, by - det.h * 0.62);
    put(det, cx + body.w * 0.28 - det.w / 2, by - det.h * 0.62);
  }
  put(body, bx, by);
  // Augen
  const n = r.eyes ?? 2;
  const eyeW = Math.min(64, body.w * (n === 1 ? 0.42 : n === 2 ? 0.3 : 0.24));
  const eye = await resizeTo(await load(r.eye), eyeW);
  const gap = eyeW * 1.08;
  for (let i = 0; i < n; i++) put(eye, cx - eye.w / 2 + (i - (n - 1) / 2) * gap, by + body.h * 0.24);
  const mouth = await resizeTo(await load(r.mouth), Math.min(70, body.w * 0.42));
  put(mouth, cx - mouth.w / 2, by + body.h * 0.24 + eye.h + body.h * 0.06);
  if (r.badge) {
    const rot = r.badge.rotate ?? 0;
    if (r.badge.bg) {
      const bg = await resizeTo(await load(r.badge.bg, r.badge.bgTint, false, rot), r.badge.size * 1.25);
      put(bg, cx + body.w * r.badge.dx - bg.w / 2, by + body.h * r.badge.dy - bg.h / 2);
    }
    const b = await resizeTo(await load(r.badge.src, undefined, false, rot), r.badge.size * (r.badge.bg ? 0.75 : 1));
    put(b, cx + body.w * r.badge.dx - b.w / 2, by + body.h * r.badge.dy - b.h / 2);
  }
  if (r.crown) {
    const c = await resizeTo(await load(r.crown.src), r.crown.size);
    put(c, cx - c.w / 2, by - c.h * 0.75);
  }
  const canvas = sharp({ create: { width: Math.round(W), height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } });
  const composed = await canvas.composite(layers).png().toBuffer();
  return sharp(composed).trim({ threshold: 0 }).resize({ width: r.width }).png().toBuffer();
}

/** Weiße Silhouette (Alpha bleibt) für das Treffer-Aufblitzen. */
async function silhouette(png: Buffer): Promise<Buffer> {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) data[i] = data[i + 1] = data[i + 2] = 255;
  return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
}

/** Alle Frames eines Monsters: walk0..3 und hit. Alle Frames haben dieselbe Größe (gleiche Leinwand vor trim). */
export async function buildMonster(r: MonsterRecipe): Promise<Array<{ name: string; png: Buffer }>> {
  const phases: Array<[number, number]> = [[1, 0], [0, -4], [-1, 0], [0, -4]];
  const frames: Array<{ name: string; png: Buffer }> = [];
  for (const [i, [phase, bob]] of phases.entries()) frames.push({ name: `${r.name}/walk${i}`, png: await frame(r, phase, bob) });
  // Einheitliche Größe: auf die größte Höhe auffüllen (unten bündig), damit die Animation nicht springt.
  const metas = await Promise.all(frames.map((f) => sharp(f.png).metadata()));
  const maxH = Math.max(...metas.map((m) => m.height ?? 0));
  for (const [i, f] of frames.entries()) {
    const h = metas[i]!.height ?? maxH;
    if (h < maxH) f.png = await sharp(f.png).extend({ top: maxH - h, bottom: 0, left: 0, right: 0, background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  }
  frames.push({ name: `${r.name}/hit`, png: await silhouette(frames[0]!.png) });
  return frames;
}
