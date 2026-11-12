import Phaser from 'phaser';
import { ATLAS } from '../../PreloadScene';

// Sonnenlicht durch die Bürofenster (Kenney „Light Masks“, CC0): weiche, schräg einfallende Fensterflecken, die
// langsam „atmen“ (Wolken). Hellt nur auf (Spec office-makeover AC-3: keine abdunkelnden Filter), liegt unter den Figuren.

/** Fenster an der oberen Wand (x-Mitte des Lichtflecks, Größe). */
const WINDOWS: ReadonlyArray<{ x: number; scale: number }> = [
  { x: 230, scale: 1.45 },
  { x: 560, scale: 1.6 },
  { x: 880, scale: 1.4 },
];

export class OfficeLight {
  readonly objects: Phaser.GameObjects.Image[] = [];

  constructor(scene: Phaser.Scene, reducedMotion: boolean) {
    for (const [i, w] of WINDOWS.entries()) {
      const sun = scene.add.image(w.x, -10, ATLAS, 'light/window/warm').setOrigin(0.5, 0).setScale(w.scale).setAlpha(0.7);
      this.objects.push(sun);
      if (!reducedMotion) {
        scene.tweens.add({ targets: sun, alpha: 0.45, duration: 5200 + i * 1300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: i * 900 });
      }
    }
  }
}