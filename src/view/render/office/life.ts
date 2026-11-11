import Phaser from 'phaser';
import { CHALLENGE_WAVES, HEIGHT, ROWS, TILE, WIDTH, type Game } from '../../../sim/index';
import type { FxSettings } from '../../fx';
import { ATLAS } from '../../PreloadScene';
import { CHATTER } from '../../texts';
import type { OfficeFloor } from './floor';
import type { Season2Fx } from './season2fx';
import type { WorkstationView } from './workstation';

// Büroleben (Spec season-2 AC-8): Statisten, Kaffeedampf, Drucker, Sprechblasen, Tageslicht, Lampen ab Welle 20.

const NPCS = ['npc1', 'npc2', 'npc3', 'npc4'] as const;
const LAMPS_FROM_WAVE = 20;

export function createNpcAnims(scene: Phaser.Scene): void {
  for (const n of NPCS) {
    const key = `walk-${n}`;
    if (scene.anims.exists(key)) continue;
    scene.anims.create({ key, frames: [0, 1, 2, 3, 4, 5, 6, 7].map((i) => ({ key: ATLAS, frame: `char/${n}/walk${i}` })), frameRate: 10, repeat: -1 });
  }
}

interface Walker {
  sprite: Phaser.GameObjects.Sprite;
  vx: number;
}

export interface LifeCounters {
  walkers: number;
  steam: number;
  prints: number;
  chatter: number;
}

export class OfficeLife {
  readonly counters: LifeCounters = { walkers: 0, steam: 0, prints: 0, chatter: 0 };
  private readonly walkers: Walker[] = [];
  private nextWalker = 6;
  private nextSteam = 1;
  private nextChat = 4;
  private readonly light: Phaser.GameObjects.Rectangle;
  private readonly morning: Phaser.GameObjects.Rectangle;
  private lampsOn = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly actors: Phaser.GameObjects.Container,
    private readonly top: Phaser.GameObjects.Container,
    private readonly settings: FxSettings,
  ) {
    createNpcAnims(scene);
    // Abendlicht: warmes Multiplizieren (Helligkeit bleibt ≥ 0,70 – AC-8); Morgenlicht: leichtes Aufhellen
    this.light = scene.add.rectangle(0, 0, WIDTH, HEIGHT, 0xffcf9e, 0).setOrigin(0).setBlendMode(Phaser.BlendModes.MULTIPLY);
    this.morning = scene.add.rectangle(0, 0, WIDTH, HEIGHT, 0xfff3c4, 0).setOrigin(0).setBlendMode(Phaser.BlendModes.ADD);
    top.addAt(this.light, 0);
    top.addAt(this.morning, 0);
  }

  /** Tagesfortschritt 0 (Morgen) … 1 (Abend) aus der Welle. */
  static dayProgress(wave: number): number {
    const w = ((Math.max(1, wave) - 1) % CHALLENGE_WAVES) + 1;
    return (w - 1) / (CHALLENGE_WAVES - 1);
  }

  /** Beim Wellenende: Drucker spuckt Papier aus. */
  print(floor: OfficeFloor): void {
    for (const p of floor.decorOf('deco/printer')) {
      this.counters.prints++;
      for (let i = 0; i < 3; i++) {
        const sheet = this.scene.add.image(p.x, p.top + 8, ATLAS, 'item/notepad').setDisplaySize(10, 13).setAlpha(0.95);
        this.top.add(sheet);
        this.scene.tweens.add({
          targets: sheet, y: sheet.y - 30 - i * 8, x: sheet.x + (i - 1) * 14, angle: (i - 1) * 40, alpha: 0, delay: i * 160,
          duration: this.settings.reducedMotion ? 1 : 900, ease: 'Quad.easeOut', onComplete: () => sheet.destroy(),
        });
      }
    }
  }

  update(dt: number, time: number, game: Game, floor: OfficeFloor, views: ReadonlyMap<number, WorkstationView>, s2: Season2Fx): void {
    const s = game.state;
    // Tageslicht
    const p = OfficeLife.dayProgress(s.wave);
    this.morning.setFillStyle(0xfff3c4, Math.max(0, 0.12 * (1 - p * 4)));
    this.light.setFillStyle(0xffcf9e, Math.max(0, (p - 0.55) / 0.45) * 0.55);
    // Lampen ab Welle 20
    const lamps = (((s.wave - 1) % CHALLENGE_WAVES) + 1) >= LAMPS_FROM_WAVE;
    if (lamps !== this.lampsOn) this.lampsOn = lamps;
    for (const v of views.values()) v.setLamp(this.lampsOn);

    // Kaffeedampf
    this.nextSteam -= dt;
    if (this.nextSteam <= 0) {
      this.nextSteam = this.settings.reducedMotion ? 4 : 1.1;
      for (const c of floor.decorOf('deco/coffee')) {
        this.counters.steam++;
        const puff = this.scene.add.image(c.x + 2, c.top + 4, ATLAS, 'puff/06').setDisplaySize(10, 10).setAlpha(0.55);
        this.top.add(puff);
        this.scene.tweens.add({ targets: puff, y: puff.y - 26, displayWidth: 24, displayHeight: 24, alpha: 0, duration: 1600, onComplete: () => puff.destroy() });
      }
    }

    // Statisten (nicht bei Ruhig)
    if (!this.settings.reducedMotion) {
      this.nextWalker -= dt;
      if (this.nextWalker <= 0 && this.walkers.length < 2) {
        this.nextWalker = 10 + Math.random() * 12;
        this.spawnWalker();
      }
    }
    for (let i = this.walkers.length - 1; i >= 0; i--) {
      const w = this.walkers[i]!;
      w.sprite.x += w.vx * dt;
      w.sprite.setDepth(w.sprite.y);
      if (w.sprite.x < -40 || w.sprite.x > WIDTH + 40) {
        w.sprite.destroy();
        this.walkers.splice(i, 1);
      }
    }

    // Sprechblasen: höchstens eine je 4 Arbeitsplätze
    this.nextChat -= dt;
    if (this.nextChat <= 0) {
      this.nextChat = 4 + Math.random() * 4;
      const candidates = s.towers.filter((t) => t.offTime <= 0);
      if (candidates.length && s2.bubbleCount < Math.max(1, Math.floor(candidates.length / 4))) {
        const t = candidates[Math.floor(Math.random() * candidates.length)]!;
        const lines = CHATTER[t.type];
        s2.bubble(t.x, t.y - 52, lines[Math.floor(Math.random() * lines.length)]!, '#37474f', 2.2);
        this.counters.chatter++;
      }
    }
    void time;
  }

  private spawnWalker(): void {
    const n = NPCS[Math.floor(Math.random() * NPCS.length)]!;
    const fromLeft = Math.random() < 0.5;
    const row = 1 + Math.floor(Math.random() * (ROWS - 2));
    const sprite = this.scene.add.sprite(fromLeft ? -30 : WIDTH + 30, row * TILE + TILE - 2, ATLAS, `char/${n}/walk0`).setOrigin(0.5, 1);
    sprite.setScale(46 / sprite.height).setFlipX(!fromLeft).setAlpha(0.95);
    sprite.play(`walk-${n}`);
    this.actors.add(sprite);
    this.walkers.push({ sprite, vx: (fromLeft ? 1 : -1) * (42 + Math.random() * 18) });
    this.counters.walkers++;
  }

  /** Debug/E2E: aktuelle Helligkeitsfaktoren. */
  get lightAlpha(): number {
    return this.light.fillAlpha;
  }

  reset(): void {
    for (const w of this.walkers) w.sprite.destroy();
    this.walkers.length = 0;
    this.nextWalker = 6;
  }
}
