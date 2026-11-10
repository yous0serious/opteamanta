import Phaser from 'phaser';
import { ATLAS } from '../PreloadScene';
import { fxKey } from './palette';

export type Family = 'circle' | 'spark' | 'star' | 'smoke' | 'dirt';

const START_SCALE: Record<Family, number> = { circle: 0.32, spark: 0.55, star: 0.5, smoke: 0.9, dirt: 0.45 };
const MAX_PER_EMITTER = 400;

/**
 * Partikel über Phaser-Emitter (Spec visual-overhaul AC-7). Pro Familie und Farbe ein Emitter,
 * Texturen sind vorgefärbte Kenney-Partikel (`fx/<familie>/<farbschlüssel>`), daher auch im Canvas-Renderer farbig.
 */
export class Particles {
  private readonly emitters = new Map<string, Phaser.GameObjects.Particles.ParticleEmitter>();

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly layer: Phaser.GameObjects.Container,
    private readonly scale: number,
  ) {}

  burst(x: number, y: number, color: string, count = 20, power = 200, family: Family = 'circle'): void {
    const n = Math.max(1, Math.round(count * this.scale));
    const bucket = power <= 120 ? 100 : power <= 280 ? 250 : 500;
    this.emitter(family, fxKey(color), bucket).explode(n, x, y);
  }

  private emitter(family: Family, key: string, power: number): Phaser.GameObjects.Particles.ParticleEmitter {
    const id = `${family}/${key}/${power}`;
    let em = this.emitters.get(id);
    if (!em) {
      const s0 = START_SCALE[family];
      em = this.scene.add.particles(0, 0, ATLAS, {
        frame: `fx/${family}/${key}`,
        emitting: false,
        lifespan: { min: 400, max: 1000 },
        speed: { min: power * 0.1, max: family === 'smoke' ? power * 0.4 : power },
        scale: { start: s0, end: 0 },
        alpha: { start: 1, end: 0 },
        rotate: { min: 0, max: 360 },
        maxParticles: MAX_PER_EMITTER,
      });
      this.layer.add(em);
      this.emitters.set(id, em);
    }
    return em;
  }

  clear(): void {
    for (const em of this.emitters.values()) em.killAll();
  }
}
