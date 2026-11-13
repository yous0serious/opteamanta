import Phaser from 'phaser';
import { COLS, HEIGHT, ROWS, TILE, WIDTH, type Game, type MapId, type ThemeId } from '../../../sim/index';
import { ATLAS } from '../../PreloadScene';
import { HAND } from '../../texts';
import { OfficeLight } from './lighting';
import { THEMES, floorOf, themeOf, type BeltStyle, type DecorDef, type FloorStyle, type OfficeTheme } from './themes';

// Heller Büroboden mit Kanban-Laufband (Spec office-makeover AC-3, ADR-0005), je Kampagne eigenes Theme
// (Spec campaigns AC-7: Boden, Deko, Licht, Laufband, Beschilderung, Umgebungsleben).

const BELT = 30;
const CHEVRON_GAP = 28;
const BELT_SPEED = 36;

/** Erzeugt die Bodentextur `floor-<stil>` (einmal je Stil, deterministisch). */
function makeFloor(scene: Phaser.Scene, style: FloorStyle): string {
  const key = `floor-${style}`;
  if (scene.textures.exists(key)) return key;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  const rnd = lcg(style.length * 7919);
  const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rnd() * xs.length)]!;
  if (style === 'oak' || style === 'birch') {
    const tones = style === 'oak' ? [0xf2e0c4, 0xeedabb, 0xf5e6cf, 0xebd5b5, 0xf1e0c6] : [0xf5ebda, 0xf1e5d1, 0xf7efe2, 0xefe2cc];
    const joint = style === 'oak' ? 0xd6bd9a : 0xdecdb2;
    const vertical = style === 'birch';
    const along = vertical ? WIDTH : HEIGHT;
    const span = vertical ? HEIGHT : WIDTH;
    const plankW = 20;
    for (let row = 0; row * plankW < along; row++) {
      let pos = -Math.floor(rnd() * 160);
      while (pos < span) {
        const len = 110 + Math.floor(rnd() * 130);
        const [x, y, w, h] = vertical ? [row * plankW, pos, plankW, len] : [pos, row * plankW, len, plankW];
        g.fillStyle(pick(tones), 1).fillRect(x, y, w, h);
        // Maserung: feine, leicht versetzte Linien
        g.lineStyle(1, 0xcfb38f, 0.4);
        for (let k = 0; k < 2; k++) {
          const off = 5 + rnd() * 10;
          if (vertical) g.lineBetween(x + off, y + 6, x + off + (rnd() - 0.5) * 3, y + h - 6);
          else g.lineBetween(x + 6, y + off, x + w - 6, y + off + (rnd() - 0.5) * 3);
        }
        g.lineStyle(1, joint, 1);
        if (vertical) g.lineBetween(x, y + h, x + w, y + h);
        else g.lineBetween(x + w, y, x + w, y + h);
        pos += len;
      }
      g.lineStyle(1, joint, 1);
      if (vertical) g.lineBetween(row * plankW, 0, row * plankW, HEIGHT);
      else g.lineBetween(0, row * plankW, WIDTH, row * plankW);
    }
  } else if (style === 'carpet') {
    for (let y = 0; y < HEIGHT; y += 80) {
      for (let x = 0; x < WIDTH; x += 80) {
        const alt = ((x + y) / 80) % 2 === 0;
        g.fillStyle(alt ? 0xe9eef3 : 0xe2e8ee, 1).fillRect(x, y, 80, 80);
        g.lineStyle(1, alt ? 0xd9e1e8 : 0xd5dde5, 0.9);
        for (let k = 6; k < 80; k += 6) {
          if (alt) g.lineBetween(x + 3, y + k, x + 77, y + k);
          else g.lineBetween(x + k, y + 3, x + k, y + 77);
        }
      }
    }
  } else if (style === 'hall') {
    // Messe-/Hallenteppich: Teppichfliesen mit Rautenmuster, kühles Hellgrau-Blau
    for (let y = 0; y < HEIGHT; y += 96) {
      for (let x = 0; x < WIDTH; x += 96) {
        g.fillStyle(((x + y) / 96) % 2 === 0 ? 0xdce6f0 : 0xd4dfeb, 1).fillRect(x, y, 96, 96);
      }
    }
    g.lineStyle(1.5, 0xc3d1e1, 1);
    for (let y = 0; y < HEIGHT + 48; y += 48) {
      for (let x = 0; x < WIDTH + 48; x += 48) {
        g.beginPath();
        g.moveTo(x, y - 18).lineTo(x + 18, y).lineTo(x, y + 18).lineTo(x - 18, y).closePath();
        g.strokePath();
      }
    }
    g.fillStyle(0xa3b7ce, 1);
    for (let y = 24; y < HEIGHT; y += 48) for (let x = 24; x < WIDTH; x += 48) g.fillCircle(x, y, 1.6);
    g.lineStyle(1.5, 0xcbd6e3, 1);
    for (let x = 0; x <= WIDTH; x += 96) g.lineBetween(x, 0, x, HEIGHT);
    for (let y = 0; y <= HEIGHT; y += 96) g.lineBetween(0, y, WIDTH, y);
  } else if (style === 'server') {
    // Doppelboden: helle Platten, einzelne Lochplatten (Kaltluft), feine Fugen
    for (let y = 0; y < HEIGHT; y += 40) {
      for (let x = 0; x < WIDTH; x += 40) {
        g.fillStyle(pick([0xeef3f7, 0xebf1f6, 0xf1f5f8]), 1).fillRect(x, y, 40, 40);
        g.fillStyle(0xffffff, 0.55).fillRect(x + 2, y + 2, 36, 2);
        const cx = x / 40;
        const cy = y / 40;
        if ((cx * 7 + cy * 3) % 11 === 0) {
          g.fillStyle(0xd9e5ef, 1).fillRect(x + 3, y + 3, 34, 34);
          g.fillStyle(0xa3b9ce, 1);
          for (let a = 0; a < 5; a++) for (let b = 0; b < 5; b++) g.fillCircle(x + 8 + a * 6, y + 8 + b * 6, 1.4);
        }
        g.fillStyle(0xbccad7, 1);
        for (const [dx, dy] of [[3, 3], [37, 3], [3, 37], [37, 37]] as const) g.fillCircle(x + dx, y + dy, 1);
      }
    }
    g.lineStyle(2, 0xc9d5df, 1);
    for (let x = 0; x <= WIDTH; x += 40) g.lineBetween(x, 0, x, HEIGHT);
    for (let y = 0; y <= HEIGHT; y += 40) g.lineBetween(0, y, WIDTH, y);
  } else if (style === 'marble') {
    // Marmorplatten mit Äderung, Holzrand und zwei Teppichen (Vorstandsetage)
    for (let y = 0; y < HEIGHT; y += 80) {
      for (let x = 0; x < WIDTH; x += 80) {
        g.fillStyle(((x + y) / 80) % 2 === 0 ? 0xf5f2ec : 0xebe6dd, 1).fillRect(x, y, 80, 80);
        g.lineStyle(1.2, 0xcdc2b2, 0.6);
        for (let k = 0; k < 2; k++) {
          const p = new Phaser.Curves.CubicBezier(
            new Phaser.Math.Vector2(x + rnd() * 80, y),
            new Phaser.Math.Vector2(x + rnd() * 80, y + 25),
            new Phaser.Math.Vector2(x + rnd() * 80, y + 55),
            new Phaser.Math.Vector2(x + rnd() * 80, y + 80),
          );
          p.draw(g, 16);
        }
      }
    }
    g.lineStyle(1.5, 0xdccdb3, 1);
    for (let x = 0; x <= WIDTH; x += 80) g.lineBetween(x, 0, x, HEIGHT);
    for (let y = 0; y <= HEIGHT; y += 80) g.lineBetween(0, y, WIDTH, y);
    for (const [rx, ry, rw, rh] of [[70, 330, 250, 170], [600, 120, 260, 160]] as const) {
      g.fillStyle(0xe3d5c8, 1).fillRoundedRect(rx, ry, rw, rh, 6);
      g.lineStyle(5, 0xb08968, 1).strokeRoundedRect(rx + 6, ry + 6, rw - 12, rh - 12, 4);
      g.lineStyle(1.5, 0xc9b29b, 1).strokeRoundedRect(rx + 16, ry + 16, rw - 32, rh - 32, 3);
      g.fillStyle(0xd4c2b0, 1);
      for (let k = 0; k < 4; k++) g.fillCircle(rx + rw / 2 + (k - 1.5) * 26, ry + rh / 2, 5);
    }
    g.fillStyle(0x8d6e63, 1).fillRect(0, HEIGHT - 8, WIDTH, 8).fillRect(0, 0, 8, HEIGHT).fillRect(WIDTH - 8, 0, 8, HEIGHT);
    g.fillStyle(0xa1887f, 1).fillRect(8, HEIGHT - 10, WIDTH - 16, 2).fillRect(8, 0, 2, HEIGHT - 8).fillRect(WIDTH - 10, 0, 2, HEIGHT - 8);
  } else {
    for (let y = 0; y < HEIGHT; y += 40) {
      for (let x = 0; x < WIDTH; x += 40) {
        g.fillStyle(pick([0xfafafa, 0xf7f7f5, 0xf8f8f8]), 1).fillRect(x, y, 40, 40);
        g.fillStyle(0xeceae5, 0.8);
        for (let k = 0; k < 4; k++) g.fillRect(x + rnd() * 36 + 2, y + rnd() * 36 + 2, 1.5, 1.5);
      }
    }
    g.lineStyle(2, 0xe3e1db, 1);
    for (let x = 0; x <= WIDTH; x += 40) g.lineBetween(x, 0, x, HEIGHT);
    for (let y = 0; y <= HEIGHT; y += 40) g.lineBetween(0, y, WIDTH, y);
  }
  // Weiche Raumkante (eingebacken, kein Filter): Boden wirkt eingefasst und plastischer
  const edge = style === 'oak' || style === 'birch' || style === 'marble' ? 0x5d4630 : 0x34495e;
  for (let i = 0; i < 14; i++) g.lineStyle(2, edge, 0.045 * (1 - i / 14)).strokeRect(i * 2 + 1, i * 2 + 1, WIDTH - i * 4 - 2, HEIGHT - i * 4 - 2);
  g.generateTexture(key, WIDTH, HEIGHT);
  g.destroy();
  return key;
}

/** Einfacher deterministischer Zufall je Karte (nur Darstellung). */
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0x1_0000_0000;
  };
}

/** Schild (Fachbereich/Deadline) mit Beschriftung. */
export function sign(scene: Phaser.Scene, label: string, x: number, y: number, color: string, icon?: string): Phaser.GameObjects.Container {
  const text = scene.add.text(icon ? 10 : 0, 3, label, { fontFamily: HAND, fontSize: '22px', fontStyle: 'bold', color, resolution: 2 }).setOrigin(0.5);
  const w = text.width + (icon ? 52 : 34);
  const bg = scene.add.image(0, 0, ATLAS, 'prop/sign').setDisplaySize(w, 40);
  const parts: Phaser.GameObjects.GameObject[] = [bg, text];
  if (icon) parts.push(scene.add.image(-w / 2 + 20, 3, ATLAS, icon).setDisplaySize(20, 20));
  // Breite Schilder bleiben im Bild
  const cx = Math.min(WIDTH - w / 2 - 4, Math.max(w / 2 + 4, x));
  return scene.add.container(cx, y, parts);
}

interface PlacedDecor {
  img: Phaser.GameObjects.Image;
  /** Weicher Kontaktschatten am Fuß. */
  shadow: Phaser.GameObjects.Ellipse;
  def: DecorDef;
  cells: string[];
  flipT: number;
}

/** Laufband entlang des Pfads zeichnen (Schatten, Schwellen, Leuchtkante, Band). */
function drawBelt(g: Phaser.GameObjects.Graphics, path: ReadonlyArray<{ x: number; y: number }>, st: BeltStyle): void {
  const drawPath = (width: number, color: number, alpha: number, dy = 0): void => {
    g.lineStyle(width, color, alpha);
    g.beginPath();
    g.moveTo(path[0]!.x, path[0]!.y + dy);
    for (const p of path.slice(1)) g.lineTo(p.x, p.y + dy);
    g.strokePath();
    g.fillStyle(color, alpha);
    for (const p of path.slice(1, -1)) g.fillCircle(p.x, p.y + dy, width / 2);
  };
  drawPath(BELT + 8, 0x000000, 0.12, 4);
  if (st.sleepers !== undefined) {
    // Gleisschwellen quer zur Fahrtrichtung (Release Train)
    g.lineStyle(6, st.sleepers, 1);
    for (let i = 1; i < path.length; i++) {
      const a = path[i - 1]!;
      const b = path[i]!;
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      const dx = (b.x - a.x) / len;
      const dy = (b.y - a.y) / len;
      const half = BELT / 2 + 7;
      for (let d = 6; d < len; d += 15) g.lineBetween(a.x + dx * d - dy * half, a.y + dy * d + dx * half, a.x + dx * d + dy * half, a.y + dy * d - dx * half);
    }
    drawPath(BELT, st.rim, 1);
    drawPath(BELT - 6, st.band, 1);
    drawPath(BELT - 16, st.inner, 1);
    return;
  }
  if (st.glow !== undefined) drawPath(BELT + 14, st.glow, 0.28);
  drawPath(BELT + 8, st.rim, 1);
  drawPath(BELT, st.band, 1);
  drawPath(BELT - 12, st.inner, 1);
}

export class OfficeFloor {
  readonly root: Phaser.GameObjects.Container;
  /** Aktives Theme (Spec campaigns). */
  readonly theme: ThemeId;
  private readonly def: OfficeTheme;
  private readonly chevrons: Phaser.GameObjects.Graphics;
  private readonly leds: Phaser.GameObjects.Graphics | null = null;
  private readonly deadline: Phaser.GameObjects.Container;
  private readonly deadlineY: number;
  private readonly segs: Array<{ ax: number; ay: number; dx: number; dy: number; len: number; start: number }> = [];
  /** Deko je Zelle (`cx,cy`), wird ausgeblendet, sobald dort ein Arbeitsplatz steht. */
  private readonly decor = new Map<string, PlacedDecor>();
  private readonly placed: PlacedDecor[] = [];
  private readonly occupied = new Set<string>();
  private pulse = 0;
  private ledT = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly game: Game,
    private readonly reducedMotion: boolean,
    theme?: ThemeId,
  ) {
    const s = scene;
    this.theme = theme && theme in THEMES ? theme : themeOf(game.map);
    const T = (this.def = THEMES[this.theme]);
    const floor = s.add.image(0, 0, makeFloor(s, floorOf(game.map.id as MapId, this.theme))).setOrigin(0);
    const under: Phaser.GameObjects.GameObject[] = [floor];

    // Kabeltrassen im Doppelboden (Serverraum)
    if (T.cableTrays) under.push(this.cableTrays());

    // Kanban-Spalten als Bodenmarkierung (Klebeband) mit Aufklebern
    const lanes = s.add.graphics();
    lanes.fillStyle(0x90a4ae, 0.22);
    for (let i = 1; i < 4; i++) {
      const x = (i * WIDTH) / 4;
      for (let y = 8; y < HEIGHT; y += 22) lanes.fillRect(x - 2, y, 4, 12);
    }
    under.push(lanes);
    if (T.glassWall) under.push(this.glassWall());
    const labels = T.lanes.map((label, i) => {
      const t = s.add.text(((i + 0.5) * WIDTH) / 4, 15, label, { fontFamily: HAND, fontSize: '22px', fontStyle: 'bold', color: T.laneColor, resolution: 2 }).setOrigin(0.5);
      t.setAlpha(0.8);
      return t;
    });

    // Laufband
    const belt = s.add.graphics();
    const path = game.path;
    drawBelt(belt, path, T.belt);
    let start = 0;
    for (let i = 1; i < path.length; i++) {
      const a = path[i - 1]!;
      const b = path[i]!;
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      this.segs.push({ ax: a.x, ay: a.y, dx: (b.x - a.x) / len, dy: (b.y - a.y) / len, len, start });
      start += len;
    }
    this.chevrons = s.add.graphics();

    const decorImgs = this.placeDecor();
    if (this.placed.some((d) => d.def.leds)) this.leds = s.add.graphics();

    const first = path.find((p) => p.x >= 0) ?? path[0]!;
    const last = [...path].reverse().find((p) => p.x <= WIDTH) ?? path[path.length - 1]!;
    const start_ = sign(s, T.start.label, 86, first.y < 90 ? first.y + 52 : first.y - 54, T.start.color, T.start.icon);
    this.deadlineY = last.y < 90 ? last.y + 52 : last.y - 54;
    this.deadline = sign(s, T.end.label, WIDTH - 82, this.deadlineY, T.end.color, T.end.icon);

    const light = new OfficeLight(s, reducedMotion, T.light);
    const parts: Phaser.GameObjects.GameObject[] = [...under, ...labels, belt, ...light.objects, ...decorImgs];
    if (this.leds) parts.push(this.leds);
    parts.push(this.chevrons, start_, this.deadline);
    this.root = s.add.container(0, 0, parts);
    this.drawLeds(0);
  }

  /** Theme-Daten (Beschilderung, Farben) für andere Darstellungen. */
  get themeDef(): OfficeTheme {
    return this.def;
  }

  /** Deko deterministisch je Karte verteilen: nicht auf dem Band und nicht direkt daneben. */
  private placeDecor(): Array<Phaser.GameObjects.Image | Phaser.GameObjects.Ellipse> {
    const s = this.scene;
    const game = this.game;
    const near = (cx: number, cy: number): boolean => {
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) if (game.pathCells.has(`${cx + dx},${cy + dy}`)) return true;
      return false;
    };
    const rnd = lcg([...game.map.id].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619), 2166136261));
    const imgs: Phaser.GameObjects.Image[] = [];
    const shadows: Phaser.GameObjects.Ellipse[] = [];
    const used = new Map<string, string>();
    const run = (list: readonly DecorDef[], count: number, maxTries: number): void => {
      const total = list.reduce((a, d) => a + (d.weight ?? 1), 0);
      for (let n = 0, tries = 0; n < count && tries < maxTries; tries++) {
        let r = rnd() * total;
        const d = list.find((x) => (r -= x.weight ?? 1) < 0) ?? list[list.length - 1]!;
        const span = d.cells ?? 1;
        const cx = Math.floor(rnd() * COLS);
        const cy = 1 + Math.floor(rnd() * (ROWS - 1));
        const cells = Array.from({ length: span }, (_, i) => `${cx + i},${cy}`);
        const sameNear = [-1, 0, 1].some((dx) => [-1, 0, 1].some((dy) => used.get(`${cx + dx},${cy + dy}`) === d.frame));
        if (cx + span > COLS || cells.some((k) => used.has(k)) || sameNear || cells.some((_, i) => near(cx + i, cy))) continue;
        const img = s.add.image(cx * TILE + (span * TILE) / 2 + (rnd() - 0.5) * 6, cy * TILE + TILE - 3, ATLAS, d.frame).setOrigin(0.5, 1);
        img.setScale(d.w / img.width).setFlipX(rnd() < 0.5);
        // Hohe Requisiten verdecken die Spaltenbeschriftung nicht
        if (img.y - img.displayHeight < 24) {
          img.destroy();
          continue;
        }
        const sw = Math.min(img.displayWidth * 0.92, span * TILE);
        const shadow = s.add.ellipse(img.x + 2, img.y - 1, sw, Math.min(12, 4 + sw * 0.16), 0x2b3a44, 0.16);
        const entry: PlacedDecor = { img, shadow, def: d, cells, flipT: 4 + rnd() * 8 };
        for (const k of cells) {
          used.set(k, d.frame);
          this.decor.set(k, entry);
        }
        this.placed.push(entry);
        shadows.push(shadow);
        imgs.push(img);
        n++;
      }
    };
    run(this.def.decor, this.def.decorCount, 400);
    if (this.def.extraDecor) run(this.def.extraDecor, 4, 200);
    return [...shadows, ...imgs];
  }

  /** Kabeltrassen (Serverraum): Metallrinnen mit farbigen Kabeln im Boden. */
  private cableTrays(): Phaser.GameObjects.Graphics {
    const g = this.scene.add.graphics();
    const tray = (x1: number, y1: number, x2: number, y2: number): void => {
      g.lineStyle(14, 0xcfd8dc, 1).lineBetween(x1, y1, x2, y2);
      g.lineStyle(10, 0xe3eaee, 1).lineBetween(x1, y1, x2, y2);
      const vx = x2 - x1;
      const vy = y2 - y1;
      const len = Math.hypot(vx, vy);
      const nx = -vy / len;
      const ny = vx / len;
      for (const [off, col] of [[-3, 0x42a5f5], [0, 0xfdd835], [3, 0x66bb6a]] as const) {
        g.lineStyle(2, col, 0.9).lineBetween(x1 + nx * off, y1 + ny * off, x2 + nx * off, y2 + ny * off);
      }
    };
    tray(0, 5 * TILE + 20, WIDTH, 5 * TILE + 20);
    tray(0, 11 * TILE + 20, WIDTH, 11 * TILE + 20);
    tray(9 * TILE + 20, 40, 9 * TILE + 20, HEIGHT);
    tray(17 * TILE + 20, 40, 17 * TILE + 20, HEIGHT);
    return g;
  }

  /** Glasfront oben (Vorstandsetage): helle Scheiben mit Sprossen und Spiegelungen. */
  private glassWall(): Phaser.GameObjects.Graphics {
    const g = this.scene.add.graphics();
    g.fillStyle(0xdff1fb, 0.95).fillRect(0, 0, WIDTH, 10);
    g.fillStyle(0x90a4ae, 1).fillRect(0, 10, WIDTH, 2);
    for (let x = 0; x <= WIDTH; x += 120) g.fillRect(x - 1.5, 0, 3, 12);
    g.lineStyle(3, 0xffffff, 0.8);
    for (let x = 30; x < WIDTH; x += 120) g.lineBetween(x, 9, x + 10, 1);
    return g;
  }

  /** Blinkende LEDs der Serverschränke (deterministisches Muster, ~6 Hz). */
  private drawLeds(time: number): void {
    const g = this.leds;
    if (!g) return;
    g.clear();
    const COLORS = [0x43e97b, 0x29b6f6, 0x43e97b, 0xffca28];
    let i = 0;
    for (const d of this.placed) {
      if (!d.def.leds || d.img.alpha < 0.5) continue;
      const w = d.img.displayWidth;
      const h = d.img.displayHeight;
      for (const [u, v] of d.def.leds) {
        i++;
        const phase = Math.floor(time * (2 + (i % 5))) + i * 7;
        const on = this.reducedMotion || (phase * 2654435761) % 7 > 1;
        const x = d.img.x + ((d.img.flipX ? 1 - u : u) - 0.5) * w;
        const y = d.img.y - (1 - v) * h;
        const col = COLORS[i % COLORS.length]!;
        g.fillStyle(col, on ? 1 : 0.25).fillCircle(x, y, 1.3);
        if (on) g.fillStyle(col, 0.25).fillCircle(x, y, 2.6);
      }
    }
  }

  /** Sichtbare Deko eines Typs (z. B. `deco/coffee`) für Büroleben-Effekte. */
  decorOf(frame: string): Array<{ x: number; y: number; top: number }> {
    const out: Array<{ x: number; y: number; top: number }> = [];
    for (const d of this.placed) {
      const img = d.img;
      if (d.def.frame === frame && img.alpha > 0.5) out.push({ x: img.x, y: img.y, top: img.y - img.displayHeight });
    }
    return out;
  }

  /** Arbeitsplatz gesetzt/entfernt: Deko der Zelle aus-/einblenden (mehrzellige Deko, solange eine Zelle belegt ist). */
  setOccupied(cx: number, cy: number, occupied: boolean): void {
    const key = `${cx},${cy}`;
    if (occupied) this.occupied.add(key);
    else this.occupied.delete(key);
    const d = this.decor.get(key);
    if (!d) return;
    const hidden = d.cells.some((k) => this.occupied.has(k));
    this.scene.tweens.add({ targets: d.img, alpha: hidden ? 0 : 1, duration: 220 });
    this.scene.tweens.add({ targets: d.shadow, alpha: hidden ? 0 : 1, duration: 220 });
  }

  /** Wellenbeginn: Laufband „zieht an“ (kurz schneller und kräftiger). */
  startMarker(): void {
    this.pulse = 1;
  }

  update(time: number, dt: number): void {
    if (!this.reducedMotion) {
      this.deadline.y = this.deadlineY + Math.sin(time * 4) * 2;
      // Umgebungsleben: LEDs blinken, Flipcharts werden umgeblättert
      this.ledT -= dt;
      if (this.leds && this.ledT <= 0) {
        this.ledT = 0.16;
        this.drawLeds(time);
      }
      for (const d of this.placed) {
        if (!d.def.flip) continue;
        d.flipT -= dt;
        if (d.flipT > 0) continue;
        d.flipT = 7 + Math.random() * 7;
        const img = d.img;
        const sy = img.scaleY;
        const next = img.frame.name === d.def.frame ? d.def.flip : d.def.frame;
        this.scene.tweens.add({ targets: img, scaleY: sy * 0.9, duration: 110, yoyo: true, onYoyo: () => img.setFrame(next) });
      }
    }
    this.pulse = Math.max(0, this.pulse - dt * 0.7);
    const running = this.game.state.running;
    const speed = this.reducedMotion ? 0 : BELT_SPEED * (running ? 1 + this.pulse * 2 : 0.35);
    const g = this.chevrons;
    g.clear();
    g.lineStyle(3.5, this.def.belt.chevron, 0.55 + 0.35 * this.pulse);
    const offset = (time * speed) % CHEVRON_GAP;
    for (const seg of this.segs) {
      const first = Math.ceil((seg.start - offset) / CHEVRON_GAP) * CHEVRON_GAP + offset - seg.start;
      for (let d = first; d < seg.len; d += CHEVRON_GAP) {
        const x = seg.ax + seg.dx * d;
        const y = seg.ay + seg.dy * d;
        if (x < -10 || x > WIDTH + 10) continue;
        // Pfeilspitze „›“ in Laufrichtung
        const nx = -seg.dy;
        const ny = seg.dx;
        g.beginPath();
        g.moveTo(x - seg.dx * 5 + nx * 7, y - seg.dy * 5 + ny * 7);
        g.lineTo(x + seg.dx * 3, y + seg.dy * 3);
        g.lineTo(x - seg.dx * 5 - nx * 7, y - seg.dy * 5 - ny * 7);
        g.strokePath();
      }
    }
  }

  destroy(): void {
    this.root.destroy();
  }
}
