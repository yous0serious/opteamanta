import Phaser from 'phaser';
import { ENEMIES, TOWERS, type Enemy, type Tower } from '../../sim/index';
import { HAND } from '../texts';
import { dashedRect, hex } from './draw';

const EMOJI_FONT = 'serif';
const OFF_GREY = 0x9e9e9e;

/** Turm als Magnet-Pin (Original Zeilen 288–300). */
export class TowerView {
  readonly root: Phaser.GameObjects.Container;
  private readonly body: Phaser.GameObjects.Graphics;
  private readonly pointer: Phaser.GameObjects.Graphics;
  private readonly emoji: Phaser.GameObjects.Text;
  private readonly zzz: Phaser.GameObjects.Text;
  private readonly stars: Phaser.GameObjects.Text[] = [];
  private drawnOff: boolean | null = null;
  private drawnLevel = 0;
  angle = 0;

  constructor(private readonly scene: Phaser.Scene, readonly tower: Tower) {
    this.body = scene.add.graphics();
    this.pointer = scene.add.graphics();
    this.emoji = scene.add.text(0, 1, TOWERS[tower.type].emoji, { fontFamily: EMOJI_FONT, fontSize: '18px', color: '#000', resolution: 2 }).setOrigin(0.5);
    this.zzz = scene.add.text(15, -16, '💤', { fontFamily: EMOJI_FONT, fontSize: '14px', resolution: 2 }).setOrigin(0.5).setVisible(false);
    this.root = scene.add.container(tower.x, tower.y, [this.body, this.pointer, this.emoji, this.zzz]);
  }

  update(targetPos: { x: number; y: number } | null): void {
    const t = this.tower;
    const off = t.offTime > 0;
    if (off !== this.drawnOff) {
      this.drawnOff = off;
      const color = off ? OFF_GREY : hex(TOWERS[t.type].color);
      this.body.clear();
      this.body.fillStyle(0x000000, 0.22).fillCircle(0, 3, 18);
      this.body.fillStyle(color, 1).fillCircle(0, 0, 17);
      this.body.fillStyle(0xffffff, 1).fillCircle(0, 0, 13);
      this.pointer.clear();
      this.pointer.fillStyle(color, 1).fillTriangle(17, -5, 24, 0, 17, 5);
      this.emoji.setAlpha(off ? 0.35 : 1);
      this.zzz.setVisible(off);
    }
    if (targetPos) this.angle = Math.atan2(targetPos.y - t.y, targetPos.x - t.x);
    this.pointer.rotation = this.angle;
    if (t.level !== this.drawnLevel) {
      this.drawnLevel = t.level;
      for (const s of this.stars) s.destroy();
      this.stars.length = 0;
      for (let i = 1; i < t.level; i++) {
        const star = this.scene.add.text(-20 + i * 8, 23, '⭐', { fontFamily: EMOJI_FONT, fontSize: '10px', resolution: 2 }).setOrigin(0.5);
        this.stars.push(star);
        this.root.add(star);
      }
    }
  }

  destroy(): void {
    this.root.destroy();
  }
}

/** Gegner als Post-it (Original Zeilen 302–310). */
export class EnemyView {
  readonly root: Phaser.GameObjects.Container;
  private readonly paper: Phaser.GameObjects.Graphics;
  private readonly overlay: Phaser.GameObjects.Graphics;
  private readonly name: Phaser.GameObjects.Text | null = null;
  private readonly size: number;
  private wob = Math.random() * 6;
  private lastHp: number;
  private hitTime = 0;

  constructor(scene: Phaser.Scene, readonly enemy: Enemy, overlayLayer: Phaser.GameObjects.Container) {
    const def = ENEMIES[enemy.type];
    this.size = def.boss ? 54 : 30;
    this.paper = scene.add.graphics();
    const emoji = scene.add.text(0, 3, def.emoji, { fontFamily: EMOJI_FONT, fontSize: def.boss ? '30px' : '17px', color: '#000', resolution: 2 }).setOrigin(0.5);
    this.root = scene.add.container(enemy.x, enemy.y, [this.paper, emoji]);
    this.overlay = scene.add.graphics();
    overlayLayer.add(this.overlay);
    if (def.boss) {
      this.name = scene.add
        .text(0, 0, def.name, { fontFamily: HAND, fontSize: '12px', fontStyle: 'bold', color: '#c62828', stroke: '#ffffff', strokeThickness: 4, resolution: 2 })
        .setOrigin(0.5);
      overlayLayer.add(this.name);
    }
    this.lastHp = enemy.hp;
  }

  update(dt: number): void {
    const e = this.enemy;
    const def = ENEMIES[e.type];
    const sz = this.size;
    if (e.hp < this.lastHp - 1e-9) this.hitTime = 0.08;
    this.lastHp = e.hp;
    this.hitTime -= dt;
    this.wob += dt * 8;
    this.root.setPosition(e.x, e.y);
    this.root.rotation = Math.sin(this.wob * 0.5) * 0.08;

    const g = this.paper;
    g.clear();
    g.fillStyle(0x000000, 0.2).fillRect(-sz / 2 + 2, -sz / 2 + 3, sz, sz);
    g.fillStyle(this.hitTime > 0 ? 0xffffff : hex(def.color), 1).fillRect(-sz / 2, -sz / 2, sz, sz);
    g.fillStyle(0x000000, 0.07).fillRect(-sz / 2, -sz / 2, sz, sz * 0.2);
    if (e.slowTime > 0) {
      g.lineStyle(2, 0x43a047, 1);
      dashedRect(g, -sz / 2 - 3, -sz / 2 - 3, sz + 6, sz + 6, 3, 3);
    }

    const o = this.overlay;
    o.clear();
    const w = def.boss ? 60 : 28;
    const f = Math.max(0, Math.min(1, e.hp / e.maxHp));
    const hy = e.y - sz / 2 - 9;
    o.fillStyle(0xe0e0e0, 1).fillRect(e.x - w / 2, hy, w, 4);
    o.fillStyle(f > 0.5 ? 0x43a047 : f > 0.25 ? 0xf9a825 : 0xc62828, 1).fillRect(e.x - w / 2, hy, w * f, 4);
    this.name?.setPosition(e.x, e.y + sz / 2 + 13);
  }

  destroy(): void {
    this.root.destroy();
    this.overlay.destroy();
    this.name?.destroy();
  }
}
