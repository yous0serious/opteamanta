import Phaser from 'phaser';
import { TOWERS, type Branch, type Tower, type TowerType } from '../../../sim/index';
import { ATLAS } from '../../PreloadScene';
import type { ViewCtx } from '../entities';

// Turm als Arbeitsplatz mit Ganzkörperfigur (Spec office-makeover AC-4, ADR-0005).

/** Posen je Rolle (Kenney Toon Characters 1, `char/<rolle>/<pose>`). */
const POSES: Record<TowerType, { idle: string; fire: readonly string[] }> = {
  dualo: { idle: 'idle', fire: ['attack0', 'attack1'] },
  analyst: { idle: 'idle', fire: ['talk', 'show'] },
  dev: { idle: 'interact', fire: ['interact', 'hold'] },
  ppl: { idle: 'think', fire: ['show', 'wide'] },
  scrum: { idle: 'idle', fire: ['kick', 'attack2'] },
  // Saison 2: „fire“ = Fähigkeit/Ereignis der Unterstützungsrolle
  rte: { idle: 'idle', fire: ['wide', 'show'] },
  rta: { idle: 'think', fire: ['show', 'talk'] },
  rto: { idle: 'hold', fire: ['cheer0', 'cheer1'] },
  board: { idle: 'talk', fire: ['wide', 'attack2'] },
};
const CHEER = ['cheer0', 'cheer1'] as const;

/** Gegenstand der Rolle auf dem Tisch. */
const ROLE_ITEM: Record<TowerType, string> = {
  dualo: 'item/cup', analyst: 'item/clipboard', dev: 'item/laptop', ppl: 'item/folder', scrum: 'item/bell',
  rte: 'item/hourglass', rta: 'item/notebook', rto: 'item/wallet', board: 'item/laptop',
};
/** Ausstattung je Stufe (rechts auf dem Tisch). */
const LEVEL_ITEM = ['item/notepad', 'item/notebook', 'item/monitor', 'item/monitor', 'item/monitor'] as const;
/** Zweig-Gadget auf dem Tisch ab Stufe 3 (Spec campaigns, BRANCHES). */
const BRANCH_ITEM: Record<TowerType, Record<Branch, string>> = {
  dualo: { a: 'item/notebook', b: 'item/pot' },
  analyst: { a: 'item/book', b: 'item/monitor' },
  dev: { a: 'item/monitor', b: 'item/headphones' },
  ppl: { a: 'item/folder', b: 'item/badge' },
  scrum: { a: 'item/bell', b: 'item/headphones' },
  rte: { a: 'item/hourglass', b: 'item/notebook' },
  rta: { a: 'item/book', b: 'item/clipboard' },
  rto: { a: 'item/pot', b: 'item/wallet' },
  board: { a: 'item/badge', b: 'item/wallet' },
};
/** Plakettenfarbe je Zweig. */
const BRANCH_COLOR: Record<Branch, number> = { a: 0x1e88e5, b: 0xe5397a };
/** Stufenrahmen: Stufe 4 Silber, Stufe 5 Gold. */
const TIER_FRAME: Partial<Record<number, { color: number; glow: number }>> = {
  4: { color: 0xb0bec5, glow: 0xeceff1 },
  5: { color: 0xf9a825, glow: 0xfff3c4 },
};

const ROLE_COLOR: Record<TowerType, number> = Object.fromEntries(
  Object.values(TOWERS).map((d) => [d.id, Number.parseInt(d.color.slice(1), 16)]),
) as Record<TowerType, number>;

const CHAR_H = 58;
const FEET_Y = 12;
const DESK_W = 42;

export class WorkstationView {
  readonly root: Phaser.GameObjects.Container;
  private readonly char: Phaser.GameObjects.Image;
  private readonly charScale: number;
  private readonly mat: Phaser.GameObjects.Ellipse;
  private readonly levelItem: Phaser.GameObjects.Image;
  private readonly extra: Phaser.GameObjects.Image;
  private readonly zzz: Phaser.GameObjects.Image;
  private readonly lamp: Phaser.GameObjects.Image;
  private readonly lampGlow: Phaser.GameObjects.Image;
  private readonly stars: Phaser.GameObjects.Image[] = [];
  /** Stufenrahmen (Silber/Gold) unter dem Arbeitsplatz. */
  private readonly frame: Phaser.GameObjects.Graphics;
  /** Zweig-Gadget und -Plakette. */
  private readonly gadget: Phaser.GameObjects.Image;
  private readonly branchChip: Phaser.GameObjects.Container;
  private drawnLevel = 0;
  private drawnBranch: Branch | null | undefined = undefined;
  private pose = '';
  private fireT = 0;
  private fireIdx = 0;
  private cheerT = 0;
  private despairT = 0;
  private typeT = 0;
  private popT = 0;
  private appearT = 0.35;
  private readonly phase = Math.random() * Math.PI * 2;
  private facing = 1;

  constructor(
    private readonly ctx: ViewCtx,
    readonly tower: Tower,
  ) {
    const s = ctx.scene;
    const type = tower.type;
    this.frame = s.add.graphics();
    this.mat = s.add.ellipse(0, FEET_Y + 2, 40, 18, ROLE_COLOR[type], 0.22);
    const shadow = s.add.ellipse(0, FEET_Y + 4, 34, 10, 0x000000, 0.16);
    this.char = s.add.image(0, FEET_Y, ATLAS, `char/${type}/${POSES[type].idle}`).setOrigin(0.5, 1);
    this.charScale = CHAR_H / this.char.height;
    this.char.setScale(this.charScale);
    const desk = s.add.image(0, FEET_Y - 3, ATLAS, 'prop/desk').setOrigin(0.5, 0.5);
    desk.setScale(DESK_W / desk.width);
    const roleItem = s.add.image(-9, FEET_Y - 8, ATLAS, ROLE_ITEM[type]).setOrigin(0.5, 1);
    roleItem.setScale(13 / Math.max(roleItem.width, roleItem.height));
    this.levelItem = s.add.image(10, FEET_Y - 8, ATLAS, LEVEL_ITEM[0]).setOrigin(0.5, 1);
    this.extra = s.add.image(16, FEET_Y - 7, ATLAS, 'item/cup').setOrigin(0.5, 1).setVisible(false);
    this.extra.setScale(8 / this.extra.width);
    this.zzz = s.add.image(14, -42, ATLAS, 'ui/zzz').setDisplaySize(16, 16).setVisible(false);
    this.gadget = s.add.image(-17, FEET_Y - 6, ATLAS, 'item/book').setOrigin(0.5, 1).setVisible(false);
    const chipBg = s.add.circle(0, 0, 6.5, BRANCH_COLOR.a).setStrokeStyle(1.5, 0xffffff);
    const chipText = s.add.text(0, 0.5, 'A', { fontFamily: 'Nunito, sans-serif', fontSize: '10px', fontStyle: 'bold', color: '#ffffff', resolution: 2 }).setOrigin(0.5);
    this.branchChip = s.add.container(19, FEET_Y + 4, [chipBg, chipText]).setVisible(false);
    // Abendlampe (Büroleben ab Welle 20, Spec season-2 AC-8)
    this.lampGlow = s.add.image(-14, FEET_Y - 10, ATLAS, 'prop/glow/ppl').setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(46, 30).setAlpha(0.55).setVisible(false);
    this.lamp = s.add.image(-16, FEET_Y - 6, ATLAS, 'prop/lamp').setOrigin(0.5, 1).setDisplaySize(12, 14).setVisible(false);
    this.root = s.add.container(tower.x, tower.y, [
      this.lampGlow, this.frame, this.mat, shadow, this.char, desk, roleItem, this.levelItem, this.extra, this.gadget, this.lamp, this.zzz, this.branchChip,
    ]);
    if (ctx.reducedMotion) this.appearT = 0;
  }

  /** Sortierschlüssel für die Tiefe (Füße). */
  get depthY(): number {
    return this.tower.y + FEET_Y;
  }

  /** Aktuelle Pose (Debug/E2E). */
  get currentPose(): string {
    return this.pose;
  }

  fire(): void {
    this.fireT = 0.22;
    this.fireIdx = (this.fireIdx + 1) % POSES[this.tower.type].fire.length;
  }

  upgrade(): void {
    this.cheer(0.9);
    if (!this.ctx.reducedMotion) this.popT = 0.3;
  }

  cheer(seconds: number): void {
    this.cheerT = Math.max(this.cheerT, seconds);
    this.despairT = 0;
  }

  /** Schreibtischlampe an/aus (Abend). */
  setLamp(on: boolean): void {
    if (this.lamp.visible === on) return;
    this.lamp.setVisible(on);
    this.lampGlow.setVisible(on);
  }

  /** Burnout: alle lassen die Köpfe hängen (bis zum Neustart). */
  despair(): void {
    this.despairT = 1e9;
    this.cheerT = 0;
  }

  private setPose(p: string): void {
    if (p === this.pose) return;
    this.pose = p;
    this.char.setFrame(`char/${this.tower.type}/${p}`);
  }

  update(dt: number, time: number, target: { x: number; y: number } | null): void {
    const t = this.tower;
    const off = t.offTime > 0;
    this.fireT -= dt;
    this.cheerT -= dt;
    this.typeT += dt;

    // Pose wählen: Ausfall > Jubel > Angriff/Strahl > Ruhe
    let pose = POSES[t.type].idle;
    if (off || this.despairT > 0) pose = 'hurt';
    else if (this.cheerT > 0) pose = CHEER[Math.floor(this.cheerT * 6) % 2]!;
    else if (t.beam) pose = Math.floor(this.typeT * 8) % 2 ? 'interact' : 'hold';
    else if (this.fireT > 0) pose = POSES[t.type].fire[this.fireIdx]!;
    this.setPose(pose);
    this.zzz.setVisible(off);
    this.char.setAlpha(off ? 0.75 : 1);

    if (target && !off) this.facing = target.x < t.x - 2 ? -1 : target.x > t.x + 2 ? 1 : this.facing;
    this.char.setFlipX(this.facing < 0);

    // Erscheinen (Drop-in von oben), Upgrade-Pop, Atmen
    let k = 1;
    let drop = 0;
    if (this.appearT > 0) {
      this.appearT -= dt;
      const p = 1 - Math.max(0, this.appearT) / 0.35;
      drop = -70 * (1 - Phaser.Math.Easing.Bounce.Out(p));
      k = 0.85 + 0.15 * p;
    }
    this.char.y = FEET_Y + drop;
    if (this.popT > 0) {
      this.popT -= dt;
      k *= 1 + 0.25 * Math.sin((Math.max(0, this.popT) / 0.3) * Math.PI);
    }
    const breathe = this.ctx.reducedMotion ? 0 : Math.sin(time * 2.2 + this.phase) * 0.02;
    this.char.setScale(this.charScale * k * (1 - breathe * 0.5), this.charScale * k * (1 + breathe));
    if (!this.ctx.reducedMotion && off) this.zzz.y = -42 + Math.sin(time * 3) * 2;

    if (t.level !== this.drawnLevel) {
      this.drawnLevel = t.level;
      this.levelItem.setFrame(LEVEL_ITEM[t.level - 1] ?? LEVEL_ITEM[0]);
      this.levelItem.setScale(13 / Math.max(this.levelItem.width, this.levelItem.height));
      this.extra.setVisible(t.level >= 4);
      for (const st of this.stars) st.destroy();
      this.stars.length = 0;
      for (let i = 0; i < t.level; i++) {
        const star = this.ctx.scene.add.image((i - (t.level - 1) / 2) * 7, FEET_Y + 9, ATLAS, 'ui/star').setDisplaySize(8, 8);
        this.stars.push(star);
        this.root.add(star);
      }
      this.mat.setFillStyle(ROLE_COLOR[t.type], 0.18 + t.level * 0.04);
      this.drawFrame(t.level);
    }
    const branch = (t as { branch?: Branch | null }).branch ?? null;
    if (branch !== this.drawnBranch) {
      this.drawnBranch = branch;
      this.gadget.setVisible(!!branch);
      this.branchChip.setVisible(!!branch);
      if (branch) {
        this.gadget.setFrame(BRANCH_ITEM[t.type]?.[branch] ?? 'item/book');
        this.gadget.setScale(12 / Math.max(this.gadget.width, this.gadget.height));
        const [bg, label] = this.branchChip.list as [Phaser.GameObjects.Arc, Phaser.GameObjects.Text];
        bg.setFillStyle(BRANCH_COLOR[branch]);
        label.setText(branch.toUpperCase());
      }
    }
  }

  /** Stufe 4–5: Silber- bzw. Goldrahmen um den Arbeitsplatz. */
  private drawFrame(level: number): void {
    const g = this.frame;
    g.clear();
    const tier = TIER_FRAME[level];
    if (!tier) return;
    g.fillStyle(tier.glow, 0.55).fillEllipse(0, FEET_Y + 2, 52, 24);
    g.lineStyle(2.5, tier.color, 1).strokeEllipse(0, FEET_Y + 2, 48, 21);
    g.lineStyle(1, 0xffffff, 0.9).strokeEllipse(0, FEET_Y + 1, 42, 17);
  }

  /** Zweig des Turms (Debug/E2E). */
  get branch(): Branch | null {
    return this.drawnBranch ?? null;
  }

  destroy(): void {
    this.root.destroy();
  }
}
