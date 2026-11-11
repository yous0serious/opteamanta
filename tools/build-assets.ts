import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import pack from 'free-tex-packer-core';
import sharp from 'sharp';
import { PALETTES, multiplyRgba } from './asset-variants';
import { buildMonster, type MonsterRecipe } from './monsters';

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
}
interface Manifest {
  atlas: string;
  maxSize: number;
  padding: number;
  frames: FrameSpec[];
  /** Zusammengesetzte Monster (tools/monsters.ts); Farbe aus PALETTES.monsters, falls nicht angegeben. */
  monsters?: MonsterRecipe[];
}

const SRC = 'assets-src';
const OUT = 'public/assets';

async function render(frame: FrameSpec): Promise<Buffer> {
  const file = join(SRC, frame.src);
  const input = readFileSync(file);
  const isSvg = extname(file) === '.svg';
  // SVG mit hoher Dichte rendern, damit das Verkleinern scharf bleibt.
  let img = sharp(input, isSvg ? { density: 288 } : {});
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
  return img.png().toBuffer();
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
  for (const r of manifest.monsters ?? []) {
    const key = r.name.split('/').pop() ?? '';
    for (const f of await buildMonster({ ...r, tint: r.tint ?? PALETTES.monsters?.[key] })) push(f.name, f.png);
  }
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
        extrude: 1,
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
  for (const f of files) {
    if (f.name.endsWith('.json')) {
      // Bildpfade relativ zum JSON belassen; Phaser lädt per multiatlas mit Basis-Pfad.
      writeFileSync(join(OUT, f.name), JSON.stringify(JSON.parse(f.buffer.toString('utf8')), null, 1));
    } else writeFileSync(join(OUT, f.name), f.buffer);
  }
  console.log(`atlas=${manifest.atlas} frames=${images.length} files=${files.map((f) => f.name).join(',')}`);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
