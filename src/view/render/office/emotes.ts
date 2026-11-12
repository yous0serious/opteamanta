import Phaser from 'phaser';
import { ATLAS } from '../../PreloadScene';

// Reaktions-Sprechblasen (Kenney „Emotes Pack“, CC0): kurze Bild-Signale statt weiterer Textzeilen,
// z. B. Zzz bei Abwesenheit, Herzbruch beim Leak, Sterne beim Upgrade. Rein kosmetisch.

export type EmoteKind =
  | 'alert' | 'alerts' | 'question' | 'sleep' | 'cash' | 'heartbreak' | 'stars' | 'anger' | 'idea' | 'laugh' | 'swirl' | 'dots' | 'sweat' | 'heart';

const MAX_EMOTES = 14;

export class Emotes {
  private readonly active = new Map<string, Phaser.GameObjects.Image>();
  /** Debug/E2E: Anzahl gezeigter Blasen je Art. */
  readonly counters: Record<string, number> = {};

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly layer: Phaser.GameObjects.Container,
    private readonly reducedMotion: () => boolean,
  ) {}

  /** Blase über (x, y) zeigen; `key` verhindert Stapel am selben Objekt (neue Blase ersetzt die alte). */
  show(key: string, x: number, y: number, kind: EmoteKind, seconds = 1.3): void {
    if (this.active.size >= MAX_EMOTES && !this.active.has(key)) return;
    const old = this.active.get(key);
    if (old) {
      this.scene.tweens.killTweensOf(old);
      old.destroy();
    }
    const s = this.scene;
    const img = s.add.image(x, y, ATLAS, `emote/${kind}`).setOrigin(0.5, 1);
    this.layer.add(img);
    this.active.set(key, img);
    this.counters[kind] = (this.counters[kind] ?? 0) + 1;
    const done = (): void => {
      if (this.active.get(key) === img) this.active.delete(key);
      img.destroy();
    };
    if (this.reducedMotion()) {
      s.time.delayedCall(seconds * 1000, done);
      return;
    }
    img.setScale(0.2);
    s.tweens.add({ targets: img, scale: 1, duration: 220, ease: 'Back.easeOut' });
    s.tweens.add({ targets: img, y: y - 10, duration: seconds * 1000, ease: 'Sine.easeOut' });
    s.tweens.add({ targets: img, alpha: 0, scale: 0.7, delay: seconds * 1000 - 220, duration: 220, onComplete: done });
  }

  clear(): void {
    for (const img of this.active.values()) img.destroy();
    this.active.clear();
  }
}
