import type Phaser from 'phaser';
import type { EnemyType } from '../../../sim/index';
import { ATLAS } from '../../PreloadScene';

// Bodenflecken erledigter Monster (Spec office-makeover AC-5): eingefärbte Kenney-Splats, verblassen langsam.

const LIFE = 9;
const MAX = 60;
const SPLATS = 8;

interface Decal {
  img: Phaser.GameObjects.Image;
  life: number;
}

export class Decals {
  private readonly list: Decal[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly layer: Phaser.GameObjects.Container,
  ) {}

  splat(x: number, y: number, type: EnemyType, size: number): void {
    const n = String(Math.floor(Math.random() * SPLATS)).padStart(2, '0');
    const img = this.scene.add.image(x, y + 8, ATLAS, `splat/${n}/${type}`).setRotation(Math.random() * Math.PI * 2).setAlpha(0.5);
    img.setScale(size / img.width, (size * 0.62) / img.height);
    this.layer.add(img);
    this.list.push({ img, life: LIFE });
    if (this.list.length > MAX) this.list.shift()?.img.destroy();
  }

  update(dt: number): void {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const d = this.list[i]!;
      d.life -= dt;
      if (d.life <= 0) {
        d.img.destroy();
        this.list.splice(i, 1);
      } else d.img.setAlpha(0.5 * Math.min(1, d.life / 3));
    }
  }

  clear(): void {
    for (const d of this.list) d.img.destroy();
    this.list.length = 0;
  }
}
