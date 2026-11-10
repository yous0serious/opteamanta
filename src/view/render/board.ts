import Phaser from 'phaser';
import { COLS, HEIGHT, ROWS, TILE, WIDTH, type Game } from '../../sim/index';
import { ATLAS } from '../PreloadScene';
import { HAND } from '../texts';
import { dashedLine, dashedPolyline, hsl } from './draw';

const PATH_WIDTH = 32;

/** Karteikarte (Start/Deadline) als kleines Post-it mit Handschrift; `paper` = vorgefärbter Post-it-Frame. */
export function card(scene: Phaser.Scene, label: string, x: number, y: number, paper: string, fg: string): Phaser.GameObjects.Container {
  const text = scene.add.text(0, 1, label, { fontFamily: HAND, fontSize: '20px', fontStyle: 'bold', color: fg, resolution: 2 }).setOrigin(0.5);
  const w = text.width + 22;
  const img = scene.add.image(0, 0, ATLAS, paper).setDisplaySize(w, 32);
  const shadow = scene.add.rectangle(2, 3, w - 2, 30, 0x000000, 0.12);
  return scene.add.container(x, y, [shadow, img, text]);
}

/**
 * Whiteboard: Textur, Raster, Kanban-Spalten, Klebeband-Pfad, Start-/Deadline-Karte.
 * Dazu die animierte Pfadmarkierung und der Marker-Strich bei Wellenbeginn (Spec visual-overhaul AC-10).
 */
export class Board {
  readonly root: Phaser.GameObjects.Container;
  private readonly deadline: Phaser.GameObjects.Container;
  private readonly deadlineY: number;
  private readonly dash: Phaser.GameObjects.Graphics;
  private readonly marker: Phaser.GameObjects.Graphics;
  private readonly lengths: number[];
  private readonly total: number;
  private markerT = -1;
  private markerAlpha = 0;

  constructor(
    scene: Phaser.Scene,
    private readonly game: Game,
    private readonly reducedMotion: boolean,
  ) {
    const bg = scene.add.tileSprite(0, 0, WIDTH, HEIGHT, ATLAS, 'prop/whiteboard').setOrigin(0);

    const g = scene.add.graphics();
    g.lineStyle(1, 0xdfe4e8, 0.7);
    g.beginPath();
    for (let i = 0; i <= COLS; i++) {
      g.moveTo(i * TILE + 0.5, 0);
      g.lineTo(i * TILE + 0.5, HEIGHT);
    }
    for (let j = 0; j <= ROWS; j++) {
      g.moveTo(0, j * TILE + 0.5);
      g.lineTo(WIDTH, j * TILE + 0.5);
    }
    g.strokePath();
    g.lineStyle(2.5, 0xb0bac3, 0.9);
    for (let i = 1; i < 4; i++) dashedLine(g, (i * WIDTH) / 4, 0, (i * WIDTH) / 4, HEIGHT, 14, 9);

    const headers = ['BACKLOG', 'IN ARBEIT', 'REVIEW', 'DONE'].map((s, i) =>
      scene.add
        .text(((i + 0.5) * WIDTH) / 4, 16, s, { fontFamily: HAND, fontSize: '24px', fontStyle: 'bold', color: '#9aa5af', resolution: 2 })
        .setOrigin(0.5),
    );

    // Klebeband: pro Segment ein gestrecktes, eingefärbtes Bild (TileSprite ignoriert in Phaser 4 Tint und Blend).
    const half = PATH_WIDTH / 2;
    const tapeShadow = scene.add.graphics();
    const tapes: Phaser.GameObjects.Image[] = [];
    game.path.slice(1).forEach((b, i) => {
      const a = game.path[i]!;
      const horizontal = a.y === b.y;
      const len = Math.abs(horizontal ? b.x - a.x : b.y - a.y) + PATH_WIDTH;
      const cx = (a.x + b.x) / 2;
      const cy = (a.y + b.y) / 2;
      const rx = horizontal ? cx - len / 2 : cx - half;
      const ry = horizontal ? cy - half : cy - len / 2;
      tapeShadow.fillStyle(0x000000, 0.1).fillRect(rx, ry + 2, horizontal ? len : PATH_WIDTH, horizontal ? PATH_WIDTH : len);
      const t = scene.add.image(cx, cy, ATLAS, `prop/tape/${game.map.id}`).setDisplaySize(len, PATH_WIDTH);
      if (!horizontal) t.setRotation(Math.PI / 2);
      tapes.push(t);
    });

    this.dash = scene.add.graphics();
    this.marker = scene.add.graphics();

    const first = game.path[0]!;
    const last = game.path[game.path.length - 1]!;
    const start = card(scene, 'FACHBEREICH', 78, first.y < 60 ? first.y + 38 : first.y - 32, 'prop/postit/story', '#1565c0');
    this.deadlineY = last.y < 60 ? last.y + 38 : last.y - 32;
    this.deadline = card(scene, 'DEADLINE!', WIDTH - 64, this.deadlineY, 'prop/postit/boss', '#c62828');

    this.lengths = game.path.slice(1).map((b, i) => Math.hypot(b.x - game.path[i]!.x, b.y - game.path[i]!.y));
    this.total = this.lengths.reduce((s, l) => s + l, 0);
    this.root = scene.add.container(0, 0, [bg, g, ...headers, tapeShadow, ...tapes, this.dash, this.marker, start, this.deadline]);
  }

  /** Zu Wellenbeginn zeichnet ein Marker den Pfad nach (0,8 s; bei reduzierter Bewegung sofort). */
  startMarker(): void {
    this.markerT = this.reducedMotion ? 0.8 : 0;
    this.markerAlpha = 1;
  }

  update(time: number, dt: number): void {
    if (!this.reducedMotion) this.deadline.y = this.deadlineY + Math.sin(time * 4) * 2;

    const game = this.game;
    this.dash.clear();
    this.dash.lineStyle(2.5, hsl(game.map.hue, 40, 42), 0.9);
    const offset = this.reducedMotion ? 0 : -time * 40;
    // gestrichelte Laufmarkierung (wie Spec 1)
    dashedPolyline(this.dash, game.path, 10, 16, offset);

    // Marker-Strich zu Wellenbeginn
    this.marker.clear();
    if (this.markerT < 0) return;
    this.markerT += dt;
    const p = Math.min(1, this.markerT / 0.8);
    if (p >= 1) this.markerAlpha = Math.max(0, this.markerAlpha - dt * 0.8);
    if (this.markerAlpha <= 0) {
      this.markerT = -1;
      return;
    }
    this.marker.lineStyle(7, hsl(game.map.hue, 70, 38), 0.55 * this.markerAlpha);
    this.marker.beginPath();
    let remain = this.total * p;
    this.marker.moveTo(game.path[0]!.x, game.path[0]!.y);
    for (let i = 1; i < game.path.length && remain > 0; i++) {
      const a = game.path[i - 1]!;
      const b = game.path[i]!;
      const len = this.lengths[i - 1]!;
      const f = Math.min(1, remain / len);
      this.marker.lineTo(a.x + (b.x - a.x) * f, a.y + (b.y - a.y) * f);
      remain -= len;
    }
    this.marker.strokePath();
  }

  destroy(): void {
    this.root.destroy();
  }
}
