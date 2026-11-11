import Phaser from 'phaser';
import { COLS, HEIGHT, ROWS, TILE, WIDTH, type Game, type MapId } from '../../../sim/index';
import { ATLAS } from '../../PreloadScene';
import { HAND } from '../../texts';

// Heller Büroboden mit Kanban-Laufband (Spec office-makeover AC-3, ADR-0005). Ersetzt das Whiteboard aus Spec 2a.

/** Bodenbelag je Karte (beim Start erzeugt, hell – Spec office-makeover AC-3). */
type FloorStyle = 'oak' | 'birch' | 'carpet' | 'tiles';
const FLOOR: Record<MapId, FloorStyle> = {
  waterfall: 'oak',
  spaghetti: 'birch',
  'release-train': 'carpet',
  matrix: 'tiles',
};
const BELT = 30;
const CHEVRON_GAP = 28;
const BELT_SPEED = 36;

/** Deko auf freien Zellen: eigene Requisiten in Schrägsicht (Breite in px). */
const DECOR: ReadonlyArray<{ frame: string; w: number }> = [
  { frame: 'deco/plant', w: 30 },
  { frame: 'deco/plant', w: 26 },
  { frame: 'deco/cooler', w: 24 },
  { frame: 'deco/coffee', w: 38 },
  { frame: 'deco/printer', w: 34 },
  { frame: 'deco/cabinet', w: 26 },
];

/** Erzeugt die Bodentextur `floor-<stil>` (einmal je Stil, deterministisch). */
function makeFloor(scene: Phaser.Scene, style: FloorStyle): string {
  const key = `floor-${style}`;
  if (scene.textures.exists(key)) return key;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  const rnd = lcg(style.length * 7919);
  const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rnd() * xs.length)]!;
  if (style === 'oak' || style === 'birch') {
    const tones = style === 'oak' ? [0xf6e8d4, 0xf3e3cc, 0xf8ecdc, 0xf1dfc6, 0xf5e6d0] : [0xf7efe2, 0xf4eadb, 0xf9f2e8, 0xf2e7d6];
    const joint = style === 'oak' ? 0xe2cdb0 : 0xe6d9c4;
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
        g.lineStyle(1, 0xd9c2a3, 0.35);
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
        g.fillStyle(alt ? 0xeef1f4 : 0xe9edf1, 1).fillRect(x, y, 80, 80);
        g.lineStyle(1, alt ? 0xe0e6eb : 0xdde3e9, 0.9);
        for (let k = 6; k < 80; k += 6) {
          if (alt) g.lineBetween(x + 3, y + k, x + 77, y + k);
          else g.lineBetween(x + k, y + 3, x + k, y + 77);
        }
      }
    }
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
  return scene.add.container(x, y, parts);
}

export class OfficeFloor {
  readonly root: Phaser.GameObjects.Container;
  private readonly chevrons: Phaser.GameObjects.Graphics;
  private readonly deadline: Phaser.GameObjects.Container;
  private readonly deadlineY: number;
  private readonly segs: Array<{ ax: number; ay: number; dx: number; dy: number; len: number; start: number }> = [];
  private readonly total: number;
  /** Deko je Zelle (`cx,cy`), wird ausgeblendet, sobald dort ein Arbeitsplatz steht. */
  private readonly decor = new Map<string, Phaser.GameObjects.Image[]>();
  private pulse = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly game: Game,
    private readonly reducedMotion: boolean,
  ) {
    const s = scene;
    const floor = s.add.image(0, 0, makeFloor(s, FLOOR[game.map.id])).setOrigin(0);

    // Kanban-Spalten als Bodenmarkierung (Klebeband) mit Aufklebern
    const lanes = s.add.graphics();
    lanes.fillStyle(0x90a4ae, 0.22);
    for (let i = 1; i < 4; i++) {
      const x = (i * WIDTH) / 4;
      for (let y = 8; y < HEIGHT; y += 22) lanes.fillRect(x - 2, y, 4, 12);
    }
    const labels = ['BACKLOG', 'IN ARBEIT', 'REVIEW', 'DONE'].map((label, i) => {
      const t = s.add.text(((i + 0.5) * WIDTH) / 4, 15, label, { fontFamily: HAND, fontSize: '22px', fontStyle: 'bold', color: '#90a4ae', resolution: 2 }).setOrigin(0.5);
      t.setAlpha(0.8);
      return t;
    });

    // Laufband: Schatten, Schienen, Band, Fugen
    const belt = s.add.graphics();
    const path = game.path;
    const drawPath = (width: number, color: number, alpha: number, dy = 0): void => {
      belt.lineStyle(width, color, alpha);
      belt.beginPath();
      belt.moveTo(path[0]!.x, path[0]!.y + dy);
      for (const p of path.slice(1)) belt.lineTo(p.x, p.y + dy);
      belt.strokePath();
      belt.fillStyle(color, alpha);
      for (const p of path.slice(1, -1)) belt.fillCircle(p.x, p.y + dy, width / 2);
    };
    drawPath(BELT + 8, 0x000000, 0.12, 4);
    drawPath(BELT + 8, 0x90a4ae, 1);
    drawPath(BELT, 0xeef3f6, 1);
    drawPath(BELT - 12, 0xdde6eb, 1);

    let start = 0;
    for (let i = 1; i < path.length; i++) {
      const a = path[i - 1]!;
      const b = path[i]!;
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      this.segs.push({ ax: a.x, ay: a.y, dx: (b.x - a.x) / len, dy: (b.y - a.y) / len, len, start });
      start += len;
    }
    this.total = start;
    this.chevrons = s.add.graphics();

    // Deko (deterministisch je Karte), nicht auf dem Band und nicht direkt daneben
    const near = (cx: number, cy: number): boolean => {
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) if (game.pathCells.has(`${cx + dx},${cy + dy}`)) return true;
      return false;
    };
    const rnd = lcg([...game.map.id].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619), 2166136261));
    const decorImgs: Phaser.GameObjects.Image[] = [];
    const used = new Map<string, string>();
    for (let n = 0, tries = 0; n < 14 && tries < 400; tries++) {
      const d = DECOR[Math.floor(rnd() * DECOR.length)]!;
      const cx = Math.floor(rnd() * COLS);
      const cy = 1 + Math.floor(rnd() * (ROWS - 1));
      const key = `${cx},${cy}`;
      const sameNear = [-1, 0, 1].some((dx) => [-1, 0, 1].some((dy) => used.get(`${cx + dx},${cy + dy}`) === d.frame));
      if (used.has(key) || sameNear || near(cx, cy)) continue;
      const img = s.add.image(cx * TILE + TILE / 2 + (rnd() - 0.5) * 6, cy * TILE + TILE - 3, ATLAS, d.frame).setOrigin(0.5, 1);
      img.setScale(d.w / img.width).setFlipX(rnd() < 0.5);
      used.set(key, d.frame);
      this.decor.set(key, [img]);
      decorImgs.push(img);
      n++;
    }

    const first = path.find((p) => p.x >= 0) ?? path[0]!;
    const last = [...path].reverse().find((p) => p.x <= WIDTH) ?? path[path.length - 1]!;
    const start_ = sign(s, 'FACHBEREICH', 86, first.y < 90 ? first.y + 52 : first.y - 54, '#1565c0', 'item/folder');
    this.deadlineY = last.y < 90 ? last.y + 52 : last.y - 54;
    this.deadline = sign(s, 'DEADLINE', WIDTH - 82, this.deadlineY, '#c62828', 'item/hourglass');

    this.root = s.add.container(0, 0, [floor, lanes, ...labels, ...decorImgs, belt, this.chevrons, start_, this.deadline]);
  }

  /** Arbeitsplatz gesetzt/entfernt: Deko der Zelle aus-/einblenden. */
  setOccupied(cx: number, cy: number, occupied: boolean): void {
    const imgs = this.decor.get(`${cx},${cy}`);
    if (!imgs) return;
    this.scene.tweens.add({ targets: imgs, alpha: occupied ? 0 : 1, duration: 220 });
  }

  /** Wellenbeginn: Laufband „zieht an“ (kurz schneller und kräftiger). */
  startMarker(): void {
    this.pulse = 1;
  }

  update(time: number, dt: number): void {
    if (!this.reducedMotion) this.deadline.y = this.deadlineY + Math.sin(time * 4) * 2;
    this.pulse = Math.max(0, this.pulse - dt * 0.7);
    const running = this.game.state.running;
    const speed = this.reducedMotion ? 0 : BELT_SPEED * (running ? 1 + this.pulse * 2 : 0.35);
    const g = this.chevrons;
    g.clear();
    g.lineStyle(3.5, 0x26a69a, 0.55 + 0.35 * this.pulse);
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
    void this.total;
  }

  destroy(): void {
    this.root.destroy();
  }
}
