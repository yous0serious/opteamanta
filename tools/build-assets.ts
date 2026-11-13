import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import pack from 'free-tex-packer-core';
import sharp, { type OverlayOptions, type Sharp } from 'sharp';
import { PALETTES, multiplyRgba } from './asset-variants';
import { buildCharacterPose, type CharacterRecipe, type HeadAnchor } from './characters';
import { buildMonster, buildMonsterPortrait, type MonsterRecipe } from './monsters';

// Baut den Spiel-Atlas aus assets-src/manifest.json (ADR-0003). Aufruf: npm run assets
interface FrameSpec {
  name: string;
  src: string;
  /** Zielbreite in px (Seitenverhältnis bleibt). */
  width?: number;
  /** Zielhöhe in px (nur mit width: exakte Größe, sonst Seitenverhältnis). */
  height?: number;
  /** Helligkeit → Transparenz, Farbe weiß (für Partikel auf hellem Grund; danach per Tint einfärbbar). */
  lumaToAlpha?: boolean;
  /** Vorgefärbte Varianten aus einer Palette (`tools/asset-variants.ts`): Frames `<name>/<schlüssel>`. */
  variants?: keyof typeof PALETTES;
  /** Nur die Varianten erzeugen, nicht den ungefärbten Grund-Frame. */
  variantsOnly?: boolean;
  /** Aufhellen: Anteil (0–1), mit dem jede Farbe zu Weiß gemischt wird (helle Böden, Spec office-makeover AC-3). */
  lighten?: number;
  /** Ausschnitt vor dem Skalieren (Quell-px), z. B. einheitlicher oberer Rand aller Posen. */
  crop?: { left: number; top: number; width: number; height: number };
  /** Transparente Ränder abschneiden. */
  trim?: boolean;
  /** Horizontale Scherung vor dem Skalieren (x += shear · y), z. B. schräg einfallendes Fensterlicht. */
  shear?: number;
  /** Weichzeichnen (Gauß-Sigma in Quell-px) nach der Scherung. */
  blur?: number;
}
/** Icon für Oberfläche und Spiel (Spec campaigns): eigenes SVG oder Kenney-Glyphe, optional auf Plakette. */
interface IconSpec {
  name: string;
  /** Fertiges Bild (wird nur eingepasst). */
  src?: string;
  /** Weiße Glyphe (Kenney Board Game Icons / Game Icons oder eigenes SVG). */
  glyph?: string;
  /** Färbung der Glyphe ohne Plakette (sonst weiß). */
  color?: string;
  /** Plakette hinter der Glyphe. */
  bg?: 'circle' | 'medal' | 'shield' | 'hex';
  bgColor?: string;
  /** Randfarbe der Plakette (Kapstein: Gold). */
  ring?: string;
  /** Glyphengröße relativ zum Icon (Standard 0.56 mit Plakette, 0.9 ohne). */
  scale?: number;
}
interface Manifest {
  atlas: string;
  maxSize: number;
  padding: number;
  frames: FrameSpec[];
  /** Zusammengesetzte Monster (tools/monsters.ts); Farbe aus PALETTES.monsters, falls nicht angegeben. */
  monsters?: MonsterRecipe[];
  /** Porträts aller Monster als icon/enemy-<typ> (Kantenlänge in px). */
  monsterPortraits?: number;
  /** Icons (icon/*), Kantenlänge in px. */
  icons?: { size: number; items: IconSpec[] };
  /** Neue Rollen und Statisten aus vorhandenen Posen (tools/characters.ts, Spec season-2). */
  characters?: {
    poses: string[];
    crop: { left: number; top: number; width: number; height: number };
    width: number;
    anchors: Record<string, HeadAnchor>;
    recipes: CharacterRecipe[];
  };
}

const SRC = 'assets-src';
const OUT = 'public/assets';

async function render(frame: FrameSpec): Promise<Buffer> {
  const file = join(SRC, frame.src);
  const input = readFileSync(file);
  const isSvg = extname(file) === '.svg';
  // SVG mit hoher Dichte rendern, damit das Verkleinern scharf bleibt.
  let img = sharp(input, isSvg ? { density: 288 } : {});
  if (frame.trim) img = sharp(await img.trim({ threshold: 1 }).png().toBuffer());
  if (frame.crop) img = sharp(await img.extract(frame.crop).png().toBuffer());
  if (frame.shear) img = sharp(await img.affine([[1, frame.shear], [0, 1]], { background: '#000000' }).png().toBuffer());
  if (frame.blur) img = sharp(await img.blur(frame.blur).png().toBuffer());
  if (frame.width || frame.height) {
    img = img.resize({ width: frame.width, height: frame.height, fit: frame.width && frame.height ? 'fill' : 'inside' });
  }
  if (frame.lumaToAlpha) {
    const { data, info } = await img.greyscale().raw().toBuffer({ resolveWithObject: true });
    const alpha = info.channels === 1 ? data : Buffer.from(data.filter((_, i) => i % info.channels === 0));
    return sharp({ create: { width: info.width, height: info.height, channels: 3, background: '#ffffff' } })
      .joinChannel(alpha, { raw: { width: info.width, height: info.height, channels: 1 } })
      .png()
      .toBuffer();
  }
  if (frame.lighten) {
    const k = frame.lighten;
    const { data, info } = await img.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    for (let i = 0; i < data.length; i += 4) for (let c = 0; c < 3; c++) data[i + c] = Math.round(data[i + c]! + (255 - data[i + c]!) * k);
    return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
  }
  return img.png().toBuffer();
}

const hexRgb = (hex: string): [number, number, number] => {
  const c = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(c.slice(i, i + 2), 16)) as [number, number, number];
};
/** Mischt eine Farbe mit Weiß (k > 0) bzw. Schwarz (k < 0). */
function shade(hex: string, k: number): string {
  const t = k > 0 ? 255 : 0;
  const a = Math.abs(k);
  return `#${hexRgb(hex).map((v) => Math.round(v + (t - v) * a).toString(16).padStart(2, '0')).join('')}`;
}

/** Plakette als SVG (eigenes Werk): Verlauf, Rand, Glanz. */
function badgeSvg(kind: NonNullable<IconSpec['bg']>, color: string, ring: string | undefined, px: number): string {
  const rim = ring ?? shade(color, -0.35);
  const grad = `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${shade(color, 0.28)}"/><stop offset="1" stop-color="${shade(color, -0.08)}"/></linearGradient></defs>`;
  const gloss = `<path d="M26 30 Q48 12 70 30" fill="none" stroke="#ffffff" stroke-width="5" stroke-linecap="round" opacity="0.45"/>`;
  let shape: string;
  if (kind === 'circle') shape = `<circle cx="48" cy="50" r="44" fill="#000" opacity="0.16"/><circle cx="48" cy="47" r="44" fill="${rim}"/><circle cx="48" cy="47" r="37" fill="url(#g)"/>`;
  else if (kind === 'hex') shape = `<path d="M48 6 L86 27 L86 69 L48 90 L10 69 L10 27 Z" transform="translate(0 3)" fill="#000" opacity="0.16"/><path d="M48 4 L86 25 L86 69 L48 90 L10 69 L10 25 Z" fill="${rim}"/><path d="M48 12 L79 29 L79 65 L48 82 L17 65 L17 29 Z" fill="url(#g)"/>`;
  else if (kind === 'shield') shape = `<path d="M48 6 L84 16 L84 46 Q84 74 48 92 Q12 74 12 46 L12 16 Z" transform="translate(0 3)" fill="#000" opacity="0.16"/><path d="M48 4 L86 15 L86 46 Q86 75 48 93 Q10 75 10 46 L10 15 Z" fill="${rim}"/><path d="M48 12 L78 21 L78 46 Q78 69 48 84 Q18 69 18 46 L18 21 Z" fill="url(#g)"/>`;
  else
    shape = `<path d="M30 60 L20 92 L34 86 L42 96 L48 66 Z" fill="#e53935"/><path d="M66 60 L76 92 L62 86 L54 96 L48 66 Z" fill="#1e88e5"/>` +
      `<circle cx="48" cy="42" r="38" fill="#000" opacity="0.16" transform="translate(0 3)"/><circle cx="48" cy="40" r="38" fill="${rim}"/><circle cx="48" cy="40" r="31" fill="url(#g)"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="0 0 96 96">${grad}${shape}${kind === 'medal' ? '' : gloss}</svg>`;
}

/** Glyphe laden, auf px einpassen und einfärben (weiß → Farbe). */
async function glyph(src: string, px: number, color = '#ffffff'): Promise<Buffer> {
  const file = join(SRC, src);
  const img = sharp(readFileSync(file), extname(file) === '.svg' ? { density: 288 } : {}).resize({ width: px, height: px, fit: 'inside' });
  const { data, info } = await img.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const out = multiplyRgba(data, color);
  return sharp(out, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
}

/** Ein Icon: Plakette + Glyphe (mit weichem Schatten) bzw. eingefärbte Glyphe mit hellem Rand. */
async function renderIcon(spec: IconSpec, size: number): Promise<Buffer> {
  const S4 = size * 4;
  const canvas = (): Sharp => sharp({ create: { width: S4, height: S4, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } });
  const centered = async (png: Buffer, dy = 0): Promise<OverlayOptions> => {
    const m = await sharp(png).metadata();
    return { input: png, left: Math.round((S4 - (m.width ?? 0)) / 2), top: Math.round((S4 - (m.height ?? 0)) / 2 + dy) };
  };
  let layers: OverlayOptions[] = [];
  if (spec.src) {
    const file = join(SRC, spec.src);
    const png = await sharp(readFileSync(file), extname(file) === '.svg' ? { density: 576 } : {}).resize({ width: S4, height: S4, fit: 'inside' }).png().toBuffer();
    layers = [await centered(png)];
  } else if (spec.glyph && spec.bg) {
    const bg = await sharp(Buffer.from(badgeSvg(spec.bg, spec.bgColor ?? '#1e88e5', spec.ring, S4))).png().toBuffer();
    const gpx = Math.round(S4 * (spec.scale ?? 0.5));
    const dy = spec.bg === 'medal' ? -S4 * 0.07 : spec.bg === 'shield' ? S4 * 0.0 : -S4 * 0.01;
    const shadow = await glyph(spec.glyph, gpx, '#000000');
    const shadowSoft = await sharp(shadow).ensureAlpha().linear([1, 1, 1, 0.3], [0, 0, 0, 0]).png().toBuffer();
    layers = [{ input: bg, left: 0, top: 0 }, await centered(shadowSoft, dy + S4 * 0.025), await centered(await glyph(spec.glyph, gpx), dy)];
  } else if (spec.glyph) {
    const gpx = Math.round(S4 * (spec.scale ?? 0.86));
    const g = await glyph(spec.glyph, gpx, spec.color ?? '#37474f');
    // heller Rand: weichgezeichnete Alpha-Maske, hart geschnitten
    const { data, info } = await sharp(await glyph(spec.glyph, gpx)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const pad = Math.round(S4 * 0.05);
    const alpha = Buffer.from(data.filter((_, i) => i % 4 === 3));
    const grown = await sharp(alpha, { raw: { width: info.width, height: info.height, channels: 1 } })
      .extend({ top: pad, bottom: pad, left: pad, right: pad, background: '#000000' })
      .blur(pad / 2.5)
      .threshold(16)
      .raw()
      .toBuffer({ resolveWithObject: true });
    const rim = await sharp({ create: { width: grown.info.width, height: grown.info.height, channels: 3, background: '#ffffff' } })
      .joinChannel(grown.data, { raw: { width: grown.info.width, height: grown.info.height, channels: 1 } })
      .png()
      .toBuffer();
    layers = [await centered(rim), await centered(g)];
  }
  const png = await canvas().composite(layers).png().toBuffer();
  return sharp(png).resize({ width: size, height: size }).png().toBuffer();
}

async function main(): Promise<void> {
  const manifest = JSON.parse(readFileSync(join(SRC, 'manifest.json'), 'utf8')) as Manifest;
  const names = new Set<string>();
  const images: Array<{ path: string; contents: Buffer }> = [];
  const push = (name: string, contents: Buffer): void => {
    if (names.has(name)) throw new Error(`Frame doppelt: ${name}`);
    names.add(name);
    images.push({ path: name, contents });
  };
  const chars = manifest.characters;
  for (const r of chars?.recipes ?? []) {
    const anchor = chars!.anchors[r.base]!;
    for (const pose of r.poses ?? chars!.poses) {
      const png = await buildCharacterPose(r, pose, anchor);
      push(`char/${r.role}/${pose}`, await sharp(png).extract(chars!.crop).resize({ width: r.width ?? chars!.width }).png().toBuffer());
      if (pose === 'idle' && r.portrait) {
        // Porträt: Kopfbereich der Ruhepose (inkl. Mütze) für die Turmkarten
        const top = Math.max(0, anchor.top - 30);
        const crop = { left: Math.max(0, anchor.cx - 64), top, width: 128, height: Math.min(256 - top, anchor.chin - top + 12) };
        push(`head/${r.role}`, await sharp(png).extract(crop).resize({ width: 56 }).png().toBuffer());
      }
    }
  }
  for (const r of manifest.monsters ?? []) {
    const key = r.name.split('/').pop() ?? '';
    const recipe = { ...r, tint: r.tint ?? PALETTES.monsters?.[key] };
    for (const f of await buildMonster(recipe)) push(f.name, f.png);
    if (manifest.monsterPortraits) push(`icon/enemy-${key}`, await buildMonsterPortrait(recipe, manifest.monsterPortraits));
  }
  for (const spec of manifest.icons?.items ?? []) push(spec.name, await renderIcon(spec, manifest.icons!.size));
  for (const frame of manifest.frames) {
    const png = await render(frame);
    if (!frame.variantsOnly) push(frame.name, png);
    if (frame.variants) {
      const palette = PALETTES[frame.variants];
      if (!palette) throw new Error(`Unbekannte Palette: ${frame.variants}`);
      const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      for (const [key, color] of Object.entries(palette)) {
        const tinted = await sharp(multiplyRgba(data, color), { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
        push(`${frame.name}/${key}`, tinted);
      }
    }
  }
  const files = await new Promise<Array<{ name: string; buffer: Buffer }>>((resolve, reject) =>
    pack(
      images,
      {
        textureName: manifest.atlas,
        width: manifest.maxSize,
        height: manifest.maxSize,
        fixedSize: false,
        powerOfTwo: false,
        padding: manifest.padding,
        // Kein Extrude: free-tex-packer füllt den Rand teils mit falschen Farben (sichtbare Kästen um Deko).
        extrude: 0,
        allowRotation: false,
        allowTrim: false,
        detectIdentical: false,
        removeFileExtension: false,
        prependFolderName: true,
        packer: 'MaxRectsBin',
        packerMethod: 'BestAreaFit',
        exporter: 'Phaser3',
      },
      (out, error) => (error ? reject(error) : resolve(out)),
    ),
  );
  mkdirSync(OUT, { recursive: true });
  for (const old of readdirSync(OUT)) if (old.startsWith(`${manifest.atlas}`) && /\.(png|json)$/.test(old)) rmSync(join(OUT, old));
  // Alle Seiten in eine Multiatlas-JSON (`textures: [...]`); Phaser lädt per multiatlas mit Basis-Pfad.
  const textures: unknown[] = [];
  let meta: unknown;
  for (const f of files) {
    if (f.name.endsWith('.json')) {
      const page = JSON.parse(f.buffer.toString('utf8')) as { textures: unknown[]; meta: unknown };
      textures.push(...page.textures);
      meta = page.meta;
    } else writeFileSync(join(OUT, f.name), f.buffer);
  }
  writeFileSync(join(OUT, `${manifest.atlas}.json`), JSON.stringify({ textures, meta }, null, 1));
  const pngs = files.filter((f) => f.name.endsWith('.png'));
  const bytes = pngs.reduce((s, f) => s + f.buffer.length, 0);
  console.log(`atlas=${manifest.atlas} frames=${images.length} pages=${pngs.map((f) => f.name).join(',')} size=${(bytes / 1048576).toFixed(2)} MB`);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
