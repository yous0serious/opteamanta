import Phaser from 'phaser';
import { HEIGHT, WIDTH } from '../../../sim/index';
import { ATLAS } from '../../PreloadScene';
import type { LightStyle } from './themes';

// Licht je Theme (Kenney „Light Masks“, CC0): weiche Fensterflecken bzw. Hallenstrahler, die langsam „atmen“.
// Hellt nur auf (Spec office-makeover AC-3: keine abdunkelnden Filter), liegt unter den Figuren.

/** Fenster an der oberen Wand (x-Mitte des Lichtflecks, Größe). */
const WINDOWS: ReadonlyArray<{ x: number; scale: number }> = [
  { x: 230, scale: 1.45 },
  { x: 560, scale: 1.6 },
  { x: 880, scale: 1.4 },
];

export class OfficeLight {
  readonly objects: Phaser.GameObjects.Image[] = [];

  constructor(scene: Phaser.Scene, reducedMotion: boolean, style: LightStyle = 'window') {
    const breathe = (target: Phaser.GameObjects.Image, to: number, i: number, base = 5200): void => {
      if (reducedMotion) return;
      scene.tweens.add({ targets: target, alpha: to, duration: base + i * 1300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: i * 900 });
    };
    if (style === 'window' || style === 'cool') {
      const cool = style === 'cool';
      for (const [i, w] of WINDOWS.entries()) {
        const sun = scene.add.image(w.x, -10, ATLAS, `light/window/${cool ? 'cool' : 'warm'}`).setOrigin(0.5, 0).setScale(w.scale).setAlpha(cool ? 0.6 : 0.7);
        this.objects.push(sun);
        breathe(sun, cool ? 0.38 : 0.45, i);
      }
    } else if (style === 'spots') {
      // Hallenstrahler im versetzten Raster: helle, weiche Kreise auf dem Teppich
      let i = 0;
      for (let row = 0, y = 110; y < HEIGHT; row++, y += 230) {
        for (let x = 120 + (row % 2) * 120; x < WIDTH; x += 240) {
          const spot = scene.add.image(x, y, ATLAS, 'light/spot/warm').setScale(1.9, 1.5).setAlpha(0.26);
          this.objects.push(spot);
          breathe(spot, 0.16, i++ % 4, 4200);
        }
      }
    } else {
      // Abendlicht durch die Glasfront: lange, goldene Flecken (gespiegelt, fällt von rechts oben ein)
      for (const [i, w] of WINDOWS.entries()) {
        const sun = scene.add
          .image(w.x + 60, -16, ATLAS, 'light/window/gold')
          .setOrigin(0.5, 0)
          .setScale(w.scale * 1.05, w.scale * 1.25)
          .setFlipX(true)
          .setAlpha(0.5);
        this.objects.push(sun);
        breathe(sun, 0.32, i, 6400);
      }
    }
  }
}
