import Phaser from 'phaser';
import { ATLAS } from '../PreloadScene';
import type { DonePile, PileBall } from '../logic/donePile';

const BALL_SIZE = 16;

/** Darstellung des DONE-Haufens: eine Kugel-Sprite pro PileBall. */
export class PileView {
  private readonly sprites = new Map<number, Phaser.GameObjects.Image>();

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly layer: Phaser.GameObjects.Container,
    readonly pile: DonePile,
  ) {}

  /** Kugel endgültig in den Haufen legen (nach der Flug-Animation). `ball.color` ist der Gegnertyp (Frame-Variante). */
  land(ball: PileBall): void {
    if (!this.pile.balls.includes(ball)) return; // inzwischen verdrängt
    const img = this.scene.add
      .image(ball.x, ball.y, ATLAS, `prop/paperball/${ball.color}`)
      .setDisplaySize(BALL_SIZE, BALL_SIZE)
      .setRotation(ball.rot);
    this.layer.add(img);
    this.sprites.set(ball.id, img);
    this.prune();
  }

  /** Sprites entfernen, deren Kugel nicht mehr im Haufen ist (älteste fallen raus). */
  prune(): void {
    const alive = new Set(this.pile.balls.map((b) => b.id));
    for (const [id, img] of this.sprites) {
      if (!alive.has(id)) {
        img.destroy();
        this.sprites.delete(id);
      }
    }
  }

  clear(): void {
    for (const img of this.sprites.values()) img.destroy();
    this.sprites.clear();
    this.pile.clear();
  }
}
