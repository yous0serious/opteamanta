import Phaser from 'phaser';
import { ENEMIES, type Enemy, type Tower } from '../../sim/index';
import { registerFilter, unregisterFilter } from '../layers';
import { ATLAS } from '../PreloadScene';
import { HAND } from '../texts';
import { dashedRect } from './draw';

/** Gemeinsamer Darstellungskontext für Spielobjekte. */
export interface ViewCtx {
  scene: Phaser.Scene;
  /** WebGL aktiv (Filter verfügbar); sonst Canvas-Fallback mit gezeichneten Schatten. */
  webgl: boolean;
  /** Filter erlaubt (WebGL und fx=high). */
  filters: boolean;
  reducedMotion: boolean;
}

const BADGE = 36;
const HEAD = 25;

/** Turm als Magnet-Badge mit Rollenfigur (Spec visual-overhaul AC-4). */
export class TowerView {
  readonly root: Phaser.GameObjects.Container;
  private readonly badge: Phaser.GameObjects.Container;
  private readonly ring: Phaser.GameObjects.Image;
  private readonly head: Phaser.GameObjects.Image;
  private readonly aim: Phaser.GameObjects.Container;
  private readonly zzz: Phaser.GameObjects.Image;
  private readonly stars: Phaser.GameObjects.Image[] = [];
  private drawnLevel = 0;
  private drawnFace = '';
  private drawnOff: boolean | null = null;
  private readonly phase = Math.random() * Math.PI * 2;
  private readonly period = 2 + Math.random();
  private squashT = 0;
  private focusT = 0;
  private popT = 0;
  private appearT = 0.2;
  angle = -Math.PI / 2;

  constructor(
    private readonly ctx: ViewCtx,
    readonly tower: Tower,
  ) {
    const s = ctx.scene;
    const parts: Phaser.GameObjects.GameObject[] = [];
    if (!ctx.webgl) parts.push(s.add.ellipse(1, 4, BADGE + 2, BADGE, 0x000000, 0.18));
    this.ring = s.add.image(0, 0, ATLAS, `prop/magnet-ring/${tower.type}`).setDisplaySize(BADGE, BADGE);
    const disc = s.add.image(0, 0, ATLAS, 'prop/magnet-disc').setDisplaySize(BADGE, BADGE);
    this.head = s.add.image(0, 1, ATLAS, `head/${tower.type}`);
    this.head.setScale(HEAD / this.head.width);
    const gloss = s.add.image(0, 0, ATLAS, 'prop/magnet-gloss').setDisplaySize(BADGE, BADGE);
    this.badge = s.add.container(0, 0, [this.ring, disc, this.head, gloss]);
    const arrow = s.add.image(BADGE / 2 + 4, 0, ATLAS, `ui/arrow/${tower.type}`).setDisplaySize(12, 12);
    this.aim = s.add.container(0, 0, [arrow]);
    this.zzz = s.add.image(16, -18, ATLAS, 'ui/zzz').setDisplaySize(15, 15).setVisible(false);
    parts.push(this.aim, this.badge, this.zzz);
    this.root = s.add.container(tower.x, tower.y, parts);
    if (ctx.reducedMotion) this.appearT = 0;
  }

  /** Schuss: kurzer Squash + Fokus-Gesicht. */
  fire(): void {
    this.focusT = 0.25;
    if (!this.ctx.reducedMotion) this.squashT = 0.12;
  }

  /** Upgrade: Pop-Animation. */
  upgrade(): void {
    if (!this.ctx.reducedMotion) this.popT = 0.3;
  }

  update(dt: number, time: number, target: { x: number; y: number } | null): void {
    const t = this.tower;
    const off = t.offTime > 0;
    if (off !== this.drawnOff) {
      this.drawnOff = off;
      this.ring.setFrame(`prop/magnet-ring/${off ? 'off' : t.type}`).setDisplaySize(BADGE, BADGE);
      this.head.setAlpha(off ? 0.7 : 1);
      this.zzz.setVisible(off);
    }
    this.focusT -= dt;
    const face = off ? '-shock' : t.beam || this.focusT > 0 ? '-focus' : '';
    if (face !== this.drawnFace) {
      this.drawnFace = face;
      this.head.setFrame(`head/${t.type}${face}`);
      this.head.setScale(HEAD / this.head.width);
    }
    if (target) this.angle = Math.atan2(target.y - t.y, target.x - t.x);
    this.aim.rotation = this.angle;

    // Skalierung: Erscheinen, Pop beim Upgrade, Squash beim Schuss
    let sx = 1;
    let sy = 1;
    if (this.appearT > 0) {
      this.appearT -= dt;
      const p = 1 - Math.max(0, this.appearT) / 0.2;
      sx = sy = Phaser.Math.Easing.Back.Out(p);
    }
    if (this.popT > 0) {
      this.popT -= dt;
      const p = Math.max(0, this.popT) / 0.3;
      const k = 1 + 0.3 * Math.sin(p * Math.PI);
      sx *= k;
      sy *= k;
    }
    if (this.squashT > 0) {
      this.squashT -= dt;
      const p = Math.max(0, this.squashT) / 0.12;
      sx *= 1 + 0.15 * p;
      sy *= 1 - 0.15 * p;
    }
    this.badge.setScale(sx, sy);
    if (!this.ctx.reducedMotion) {
      this.head.y = 1 + Math.sin(time * ((Math.PI * 2) / this.period) + this.phase) * 1.5;
      if (off) this.zzz.y = -18 + Math.sin(time * 3) * 2;
    }

    if (t.level !== this.drawnLevel) {
      this.drawnLevel = t.level;
      for (const st of this.stars) st.destroy();
      this.stars.length = 0;
      for (let i = 1; i < t.level; i++) {
        const star = this.ctx.scene.add.image(-20 + i * 8, 22, ATLAS, 'ui/star').setDisplaySize(10, 10);
        this.stars.push(star);
        this.root.add(star);
      }
    }
  }

  destroy(): void {
    this.root.destroy();
  }
}

/** Gegner als Post-it mit Marker-Symbol (Spec visual-overhaul AC-5). */
export class EnemyView {
  readonly root: Phaser.GameObjects.Container;
  private readonly paper: Phaser.GameObjects.Image;
  private readonly marks: Phaser.GameObjects.Graphics;
  private readonly overlay: Phaser.GameObjects.Graphics;
  private readonly name: Phaser.GameObjects.Text | null = null;
  private readonly size: number;
  private readonly frame: string;
  private glow: Phaser.Filters.Glow | null = null;
  private wob = Math.random() * 6;
  private lastHp: number;
  private hitTime = 0;

  constructor(
    private readonly ctx: ViewCtx,
    readonly enemy: Enemy,
    overlayLayer: Phaser.GameObjects.Container,
  ) {
    const s = ctx.scene;
    const def = ENEMIES[enemy.type];
    const boss = !!def.boss;
    this.size = boss ? 54 : 30;
    this.frame = boss ? `prop/postit-curl/${enemy.type}` : `prop/postit/${enemy.type}`;
    const parts: Phaser.GameObjects.GameObject[] = [];
    if (!ctx.webgl) parts.push(s.add.rectangle(2, 3, this.size, this.size, 0x000000, 0.18));
    this.paper = s.add.image(0, 0, ATLAS, this.frame).setDisplaySize(this.size, this.size);
    const symbolSize = boss ? 34 : 20;
    const symbol = s.add.image(0, 2, ATLAS, `sym/${enemy.type}`).setDisplaySize(symbolSize, symbolSize);
    this.marks = s.add.graphics();
    parts.push(this.paper, symbol, this.marks);
    this.root = s.add.container(enemy.x, enemy.y, parts);
    this.overlay = s.add.graphics();
    overlayLayer.add(this.overlay);
    if (boss) {
      this.name = s.add
        .text(0, 0, def.name, { fontFamily: HAND, fontSize: '17px', fontStyle: 'bold', color: '#c62828', stroke: '#ffffff', strokeThickness: 5, resolution: 2 })
        .setOrigin(0.5);
      overlayLayer.add(this.name);
      if (ctx.filters) {
        this.root.enableFilters();
        this.glow = this.root.filters?.internal.addGlow(0xc62828, 4, 0, 1) ?? null;
        registerFilter(s, 'boss', 'Glow');
      }
    }
    this.lastHp = enemy.hp;
  }

  update(dt: number, time: number): void {
    const e = this.enemy;
    const sz = this.size;
    if (e.hp < this.lastHp - 1e-9) this.hitTime = 0.08;
    this.lastHp = e.hp;
    this.hitTime -= dt;
    this.root.setPosition(e.x, e.y);
    if (!this.ctx.reducedMotion) {
      this.wob += dt * 8;
      this.root.rotation = Math.sin(this.wob * 0.5) * 0.08;
    }
    // Treffer-Aufblitzen: ungefärbtes (weißes) Post-it statt Tint – funktioniert auch im Canvas-Renderer.
    const frame = this.hitTime > 0 && sz < 54 ? 'prop/postit' : this.frame;
    if (this.paper.frame.name !== frame) this.paper.setFrame(frame).setDisplaySize(sz, sz);
    if (this.hitTime > 0 && sz >= 54) this.paper.setAlpha(0.65);
    else this.paper.setAlpha(1);
    if (this.glow) this.glow.outerStrength = 4 + 2 * Math.sin(time * ((Math.PI * 2) / 1.2));

    this.marks.clear();
    if (e.slowTime > 0) {
      this.marks.lineStyle(2, 0x43a047, 1);
      dashedRect(this.marks, -sz / 2 - 3, -sz / 2 - 3, sz + 6, sz + 6, 3, 3);
    }

    const o = this.overlay;
    o.clear();
    const w = sz >= 54 ? 60 : 28;
    const f = Math.max(0, Math.min(1, e.hp / e.maxHp));
    const hy = e.y - sz / 2 - 9;
    o.fillStyle(0xffffff, 0.9).fillRect(e.x - w / 2 - 1, hy - 1, w + 2, 6);
    o.fillStyle(0xe0e0e0, 1).fillRect(e.x - w / 2, hy, w, 4);
    o.fillStyle(f > 0.5 ? 0x43a047 : f > 0.25 ? 0xf9a825 : 0xc62828, 1).fillRect(e.x - w / 2, hy, w * f, 4);
    this.name?.setPosition(e.x, e.y + sz / 2 + 14);
  }

  destroy(): void {
    if (this.glow) unregisterFilter(this.ctx.scene, 'boss', 'Glow');
    this.root.destroy();
    this.overlay.destroy();
    this.name?.destroy();
  }
}
