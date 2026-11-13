import Phaser from 'phaser';
import { ENEMIES, WIDTH, type Enemy, type EnemyType } from '../../../sim/index';
import { ATLAS } from '../../PreloadScene';
import { HAND } from '../../texts';
import type { ViewCtx } from '../entities';

// Gegner als Monster mit Ticket (Spec office-makeover AC-5). Frames aus tools/monsters.ts: walk0..3, hit.
// Kampagnen-Mechaniken (Spec campaigns) als Zustandsanzeige: Stehen (Impediment), Sprint (Spike), Panzer (Compliance,
// gepanzerte Bosse), Schatten-IT halb durchsichtig bis entdeckt. Ereignis-Effekte: `mechanics.ts`.

/** Anzeigebreite je Typ (px) – Bosse deutlich größer. */
export const MONSTER_W = {
  req: 40, cr: 37, story: 32, obj: 44, feat: 46, creep: 37, debt: 42, boss: 84, meeting: 38, hotfix: 30,
  impediment: 42, spike: 30, dependency: 36, enabler: 34, compliance: 46, 'shadow-it': 34, 'vendor-lock': 42, epic: 54,
  'b-scope': 88, 'b-pi': 90, 'b-hydra': 96, 'b-lbc': 92,
} as Record<EnemyType, number>;
const FEET = 12;
/** Deckkraft der unentdeckten Schatten-IT. */
const HIDDEN_ALPHA = 0.32;

/** Anzeigebreite eines Typs (unbekannte Typen wie normale Gegner). */
export function monsterWidth(type: EnemyType): number {
  return MONSTER_W[type] ?? 40;
}

/** Animationen einmal pro Szene anlegen. */
export function createMonsterAnims(scene: Phaser.Scene): void {
  for (const type of Object.keys(ENEMIES) as EnemyType[]) {
    const key = `walk-${type}`;
    if (scene.anims.exists(key) || !scene.textures.get(ATLAS).has(`enemy/${type}/walk0`)) continue;
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
  private readonly ice: Phaser.GameObjects.Image;
  private readonly shadow: Phaser.GameObjects.Ellipse;
  private readonly bar: Phaser.GameObjects.Graphics;
  private readonly slow: Phaser.GameObjects.Text;
  private readonly name: Phaser.GameObjects.Text | null = null;
  /** Haltschild über dem Kopf (Impediment steht). */
  private readonly stop: Phaser.GameObjects.Image | null = null;
  /** Panzer-Abzeichen neben der Lebensleiste. */
  private readonly armor: Phaser.GameObjects.Image | null = null;
  private readonly baseScale: number;
  private readonly h: number;
  private readonly w: number;
  private readonly boss: boolean;
  private lastHp: number;
  private lastX: number;
  private lastY: number;
  private hitT = 0;
  private facing = 1;
  private stopT = 0;
  private flashT = 0;
  private popT = 0;
  private wasHidden: boolean;
  private readonly trail: Array<{ x: number; y: number; life: number }> = [];

  constructor(
    private readonly ctx: ViewCtx,
    readonly enemy: Enemy,
    overlay: Phaser.GameObjects.Container,
  ) {
    const s = ctx.scene;
    const type = enemy.type;
    const def = ENEMIES[type];
    this.boss = !!def.boss;
    this.w = monsterWidth(type);
    this.shadow = s.add.ellipse(0, 0, this.w * 0.8, this.w * 0.24, 0x000000, 0.18);
    this.body = s.add.sprite(0, 0, ATLAS, `enemy/${type}/walk0`).setOrigin(0.5, 1);
    this.baseScale = this.w / this.body.width;
    this.h = this.body.height * this.baseScale;
    if (!ctx.reducedMotion && s.anims.exists(`walk-${type}`)) {
      this.body.play({ key: `walk-${type}`, startFrame: Math.floor(Math.random() * 4) });
      this.body.anims.timeScale = Math.max(0.6, def.speed / 60);
    }
    this.flash = s.add.image(0, 0, ATLAS, `enemy/${type}/hit`).setOrigin(0.5, 1).setAlpha(0);
    // Budget-Freeze (Vorstand): Eiskristall vor dem Monster
    this.ice = s.add.image(0, -this.body.height * this.baseScale * 0.5, ATLAS, 'prop/ice').setVisible(false);
    this.ice.setDisplaySize(this.w * 0.9, this.w * 0.9).setAlpha(0.85);
    const parts: Phaser.GameObjects.GameObject[] = [this.shadow, this.body, this.flash, this.ice];
    if (def.stall) {
      this.stop = s.add.image(0, -this.h - 14, ATLAS, 'prop/stop').setDisplaySize(22, 22).setVisible(false);
      parts.push(this.stop);
    }
    this.root = s.add.container(enemy.x, enemy.y, parts);
    this.bar = s.add.graphics();
    this.slow = s.add
      .text(0, 0, '?', { fontFamily: HAND, fontSize: '22px', fontStyle: 'bold', color: '#2e7d32', stroke: '#ffffff', strokeThickness: 4, resolution: 2 })
      .setOrigin(0.5)
      .setVisible(false);
    overlay.add([this.bar, this.slow]);
    if (def.armor !== undefined) {
      this.armor = s.add.image(0, 0, ATLAS, 'prop/shield').setDisplaySize(this.boss ? 14 : 11, this.boss ? 16 : 13);
      overlay.add(this.armor);
    }
    if (this.boss) {
      this.name = s.add
        .text(0, 0, def.name, { fontFamily: HAND, fontSize: '17px', fontStyle: 'bold', color: '#c62828', stroke: '#ffffff', strokeThickness: 5, resolution: 2 })
        .setOrigin(0.5);
      overlay.add(this.name);
    }
    this.lastHp = enemy.hp;
    this.lastX = enemy.x;
    this.lastY = enemy.y;
    this.wasHidden = enemy.hidden;
  }

  get depthY(): number {
    return this.enemy.y + FEET;
  }

  /** Sichtbarer Frame (Debug/E2E): während des Trefferblitzes die Silhouette `…/hit`. */
  get frameName(): string {
    return this.hitT > 0 ? this.flash.frame.name : this.body.frame.name;
  }

  /** Angezeigte Breite in px (Debug/E2E). */
  get displayWidth(): number {
    return Math.round(this.body.displayWidth);
  }

  /** Kopfhöhe über dem Fußpunkt (für Effekte über dem Monster). */
  get top(): number {
    return this.enemy.y + FEET - this.h * Math.sqrt(Math.max(1, this.enemy.maxHp / this.enemy.baseMaxHp));
  }

  /** Boss-Phase (SimEvent `bossPhase`): heller Blitz und Aufblähen. */
  phaseFlash(): void {
    this.flashT = 0.5;
    if (!this.ctx.reducedMotion) this.popT = 0.45;
  }

  /** Neu erzeugter Gegner (SimEvent `spawnedMinion`): kurzes Aufploppen. */
  spawnPop(): void {
    if (!this.ctx.reducedMotion) this.popT = 0.3;
  }

  /** Schatten-IT entdeckt (SimEvent `revealed`): Aufblitzen. */
  revealFlash(): void {
    this.flashT = Math.max(this.flashT, 0.25);
  }

  update(dt: number, time: number): void {
    const e = this.enemy;
    const def = ENEMIES[e.type];
    if (e.hp < this.lastHp - 1e-9) this.hitT = 0.09;
    this.lastHp = e.hp;
    this.hitT -= dt;
    this.flashT -= dt;
    if (e.x < this.lastX - 0.01) this.facing = -1;
    else if (e.x > this.lastX + 0.01) this.facing = 1;
    const moved = Math.hypot(e.x - this.lastX, e.y - this.lastY);
    this.lastX = e.x;
    this.lastY = e.y;

    const stalled = !!def.stall && e.actTime > 0;
    const sprinting = !!def.sprint && e.actTime > 0;
    if (e.hidden !== this.wasHidden) {
      if (!e.hidden) this.revealFlash();
      this.wasHidden = e.hidden;
    }

    // Scope Creep wächst sichtbar (bis zur doppelten Max-HP → Faktor √2); Pop bei Phase/Spawn
    const grow = Math.sqrt(Math.max(1, e.maxHp / e.baseMaxHp));
    let pop = 1;
    if (this.popT > 0) {
      this.popT -= dt;
      pop = 1 + 0.22 * Math.sin((Math.max(0, this.popT) / 0.45) * Math.PI);
    }
    const sc = this.baseScale * grow * pop;
    this.root.setPosition(e.x, e.y + FEET);
    this.body.setScale(sc).setFlipX(this.facing < 0);
    this.flash.setScale(sc).setFlipX(this.facing < 0).setFrame(`enemy/${e.type}/hit`);
    // Treffer, Boss-Phase, Panzer-Schimmer: weiße Silhouette (funktioniert auch im Canvas-Renderer)
    const shimmer = def.armor !== undefined && !this.ctx.reducedMotion ? Math.max(0, Math.sin(time * 2.6 + e.id) - 0.82) * 1.6 : 0;
    this.flash.setAlpha(this.hitT > 0 ? 0.85 : this.flashT > 0 ? Math.min(0.9, this.flashT * 2.4) : shimmer);
    this.shadow.setScale(grow);
    // Schatten-IT: halb durchsichtig, solange nicht anvisierbar
    const alpha = e.hidden ? HIDDEN_ALPHA + (this.ctx.reducedMotion ? 0 : Math.sin(time * 3 + e.id) * 0.06) : 1;
    this.body.setAlpha(alpha);
    this.shadow.setAlpha(e.hidden ? 0.4 : 1);
    const frozen = e.frozenTime > 0;
    this.ice.setVisible(frozen);
    if (frozen) this.ice.setAngle(Math.sin(time * 3 + e.id) * 8);
    const paused = frozen || stalled;
    if (this.body.anims.isPlaying === paused && !this.ctx.reducedMotion && this.body.anims.currentAnim) {
      if (paused) this.body.anims.pause();
      else this.body.anims.resume();
    }
    if (this.body.anims.isPlaying) this.body.anims.timeScale = Math.max(0.6, def.speed / 60) * (sprinting ? 2.2 : 1);
    if (!this.ctx.reducedMotion && !frozen) {
      // Sprint: nach vorn gelehnt; Stehen: trotziges Wippen
      const lean = sprinting ? 0.18 * this.facing : 0;
      this.root.rotation = lean + Math.sin(time * (stalled ? 14 : 9) + e.id) * (stalled ? 0.025 : 0.04);
    }

    // Haltschild ploppt beim Stehenbleiben auf
    if (this.stop) {
      if (stalled) this.stopT = Math.min(1, this.stopT + dt * 6);
      else this.stopT = Math.max(0, this.stopT - dt * 5);
      this.stop.setVisible(this.stopT > 0);
      const k = this.ctx.reducedMotion ? (stalled ? 1 : 0) : Phaser.Math.Easing.Back.Out(this.stopT);
      this.stop.setScale((22 / this.stop.width) * k).setY(-this.h * grow - 12);
    }

    const top = e.y + FEET - this.h * grow;
    const g = this.bar;
    g.clear();
    // Sprint-Spur: Speedlines hinter dem Spike
    if (sprinting && !this.ctx.reducedMotion && moved > 0.2) this.trail.push({ x: e.x, y: e.y + FEET - this.h * 0.45, life: 0.25 });
    for (let i = this.trail.length - 1; i >= 0; i--) {
      const p = this.trail[i]!;
      p.life -= dt;
      if (p.life <= 0) this.trail.splice(i, 1);
    }
    for (const p of this.trail) {
      const a = p.life / 0.25;
      g.lineStyle(2.5, 0x4dd0e1, 0.6 * a);
      g.lineBetween(p.x - this.facing * 6, p.y - 6, p.x - this.facing * 18, p.y - 6);
      g.lineBetween(p.x - this.facing * 4, p.y + 4, p.x - this.facing * 14, p.y + 4);
    }
    const boss = this.boss;
    const f = Math.max(0, Math.min(1, e.hp / e.maxHp));
    if (f < 1 || boss) {
      const w = boss ? 64 : 26;
      const y = top - 6;
      g.fillStyle(0x263238, 0.55).fillRoundedRect(e.x - w / 2 - 2, y - 2, w + 4, 7, 3);
      g.fillStyle(0xeceff1, 1).fillRoundedRect(e.x - w / 2, y, w, 3, 1.5);
      g.fillStyle(f > 0.5 ? 0x43a047 : f > 0.25 ? 0xf9a825 : 0xe53935, 1).fillRoundedRect(e.x - w / 2, y, Math.max(2, w * f), 3, 1.5);
      // Boss-Phasen (Hydra): Kerben bei den Phasengrenzen
      for (const at of def.phases?.at ?? []) g.fillStyle(0x263238, 0.8).fillRect(e.x - w / 2 + w * at - 0.75, y - 1, 1.5, 5);
      this.armor?.setPosition(e.x - w / 2 - 8, y + 1).setVisible(true);
    } else this.armor?.setPosition(e.x, top - 6).setVisible(!e.hidden);
    this.armor?.setAlpha(e.hidden ? 0.4 : 1);
    this.slow.setVisible(e.slowTime > 0);
    if (e.slowTime > 0) this.slow.setPosition(e.x + 12, top - 6 + Math.sin(time * 6) * 2);
    if (this.name) {
      const half = this.name.width / 2 + 4;
      this.name.setPosition(Math.min(WIDTH - half, Math.max(half, e.x)), e.y + FEET + 14);
    }
  }

  destroy(): void {
    this.root.destroy();
    this.bar.destroy();
    this.slow.destroy();
    this.armor?.destroy();
    this.name?.destroy();
  }
}
