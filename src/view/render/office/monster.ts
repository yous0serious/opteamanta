import Phaser from 'phaser';
import { ENEMIES, type Enemy, type EnemyType } from '../../../sim/index';
import { ATLAS } from '../../PreloadScene';
import { HAND } from '../../texts';
import type { ViewCtx } from '../entities';

// Gegner als Monster mit Ticket (Spec office-makeover AC-5). Frames aus tools/monsters.ts: walk0..3, hit.

/** Anzeigebreite je Typ (px) – Boss deutlich größer. */
export const MONSTER_W: Record<EnemyType, number> = { req: 40, cr: 37, story: 32, obj: 44, feat: 46, creep: 37, debt: 42, boss: 84 };
const FEET = 12;

/** Animationen einmal pro Szene anlegen. */
export function createMonsterAnims(scene: Phaser.Scene): void {
  for (const type of Object.keys(ENEMIES) as EnemyType[]) {
    const key = `walk-${type}`;
    if (scene.anims.exists(key)) continue;
    scene.anims.create({
      key,
      frames: [0, 1, 2, 3].map((i) => ({ key: ATLAS, frame: `enemy/${type}/walk${i}` })),
      frameRate: 8,
      repeat: -1,
    });
  }
}

export class MonsterView {
  readonly root: Phaser.GameObjects.Container;
  private readonly body: Phaser.GameObjects.Sprite;
  private readonly flash: Phaser.GameObjects.Image;
  private readonly shadow: Phaser.GameObjects.Ellipse;
  private readonly bar: Phaser.GameObjects.Graphics;
  private readonly slow: Phaser.GameObjects.Text;
  private readonly name: Phaser.GameObjects.Text | null = null;
  private readonly baseScale: number;
  private readonly h: number;
  private lastHp: number;
  private lastX: number;
  private hitT = 0;
  private facing = 1;

  constructor(
    private readonly ctx: ViewCtx,
    readonly enemy: Enemy,
    overlay: Phaser.GameObjects.Container,
  ) {
    const s = ctx.scene;
    const type = enemy.type;
    const boss = !!ENEMIES[type].boss;
    this.shadow = s.add.ellipse(0, 0, MONSTER_W[type] * 0.8, MONSTER_W[type] * 0.24, 0x000000, 0.18);
    this.body = s.add.sprite(0, 0, ATLAS, `enemy/${type}/walk0`).setOrigin(0.5, 1);
    this.baseScale = MONSTER_W[type] / this.body.width;
    this.h = this.body.height * this.baseScale;
    if (!ctx.reducedMotion) {
      this.body.play({ key: `walk-${type}`, startFrame: Math.floor(Math.random() * 4) });
      this.body.anims.timeScale = Math.max(0.6, ENEMIES[type].speed / 60);
    }
    this.flash = s.add.image(0, 0, ATLAS, `enemy/${type}/hit`).setOrigin(0.5, 1).setAlpha(0);
    this.root = s.add.container(enemy.x, enemy.y, [this.shadow, this.body, this.flash]);
    this.bar = s.add.graphics();
    this.slow = s.add
      .text(0, 0, '?', { fontFamily: HAND, fontSize: '22px', fontStyle: 'bold', color: '#2e7d32', stroke: '#ffffff', strokeThickness: 4, resolution: 2 })
      .setOrigin(0.5)
      .setVisible(false);
    overlay.add([this.bar, this.slow]);
    if (boss) {
      this.name = s.add
        .text(0, 0, ENEMIES[type].name, { fontFamily: HAND, fontSize: '17px', fontStyle: 'bold', color: '#c62828', stroke: '#ffffff', strokeThickness: 5, resolution: 2 })
        .setOrigin(0.5);
      overlay.add(this.name);
    }
    this.lastHp = enemy.hp;
    this.lastX = enemy.x;
  }

  get depthY(): number {
    return this.enemy.y + FEET;
  }

  /** Aktueller Frame (Debug/E2E). */
  get frameName(): string {
    return this.body.frame.name;
  }

  /** Angezeigte Breite in px (Debug/E2E). */
  get displayWidth(): number {
    return Math.round(this.body.displayWidth);
  }

  update(dt: number, time: number): void {
    const e = this.enemy;
    if (e.hp < this.lastHp - 1e-9) this.hitT = 0.09;
    this.lastHp = e.hp;
    this.hitT -= dt;
    if (e.x < this.lastX - 0.01) this.facing = -1;
    else if (e.x > this.lastX + 0.01) this.facing = 1;
    this.lastX = e.x;

    // Scope Creep wächst sichtbar (bis zur doppelten Max-HP → Faktor √2)
    const grow = Math.sqrt(Math.max(1, e.maxHp / e.baseMaxHp));
    const sc = this.baseScale * grow;
    this.root.setPosition(e.x, e.y + FEET);
    this.body.setScale(sc).setFlipX(this.facing < 0);
    this.flash.setScale(sc).setFlipX(this.facing < 0).setFrame(`enemy/${e.type}/hit`);
    this.flash.setAlpha(this.hitT > 0 ? 0.85 : 0);
    this.shadow.setScale(grow);
    if (!this.ctx.reducedMotion) this.root.rotation = Math.sin(time * 9 + e.id) * 0.04;

    const top = e.y + FEET - this.h * grow;
    const g = this.bar;
    g.clear();
    const boss = !!ENEMIES[e.type].boss;
    const f = Math.max(0, Math.min(1, e.hp / e.maxHp));
    if (f < 1 || boss) {
      const w = boss ? 64 : 26;
      const y = top - 6;
      g.fillStyle(0x263238, 0.55).fillRoundedRect(e.x - w / 2 - 2, y - 2, w + 4, 7, 3);
      g.fillStyle(0xeceff1, 1).fillRoundedRect(e.x - w / 2, y, w, 3, 1.5);
      g.fillStyle(f > 0.5 ? 0x43a047 : f > 0.25 ? 0xf9a825 : 0xe53935, 1).fillRoundedRect(e.x - w / 2, y, Math.max(2, w * f), 3, 1.5);
    }
    this.slow.setVisible(e.slowTime > 0);
    if (e.slowTime > 0) this.slow.setPosition(e.x + 12, top - 6 + Math.sin(time * 6) * 2);
    this.name?.setPosition(e.x, e.y + FEET + 14);
  }

  destroy(): void {
    this.root.destroy();
    this.bar.destroy();
    this.slow.destroy();
    this.name?.destroy();
  }
}
