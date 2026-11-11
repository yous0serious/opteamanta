import Phaser from 'phaser';
import { ENEMIES, HEIGHT, WIDTH, type Enemy, type Tower } from '../../../sim/index';
import type { Controller } from '../../controller';
import type { FxSettings } from '../../fx';
import { ATLAS } from '../../PreloadScene';
import { HAND, UPGRADE_TITLES } from '../../texts';

// Spielgefühl (Spec season-2 AC-7): Combos, fliegende Münzen, Schadenszahlen, Boss-Auftritt, Beförderung.
// Zeitlupe/Zoom nur bei Effektstufe Maximal; Ruhig ohne Combo-Effekte. Ändert nie den Simulationszustand.

const COMBO_WINDOW = 1.5;
const COMBO_TITLES: ReadonlyArray<[number, string]> = [
  [25, 'Combo x{n} – UNAUFHALTSAM!'], [15, 'Combo x{n} – Release Train!'], [10, 'Combo x{n} – Hyper-Velocity!'],
  [6, 'Combo x{n} – Flow!'], [3, 'Combo x{n} – Velocity!'],
];
const MAX_COINS = 24;
const MAX_NUMBERS = 30;

export interface JuiceCounters {
  comboMax: number;
  combos: number;
  slowmo: number;
  coins: number;
  numbers: number;
  bossIntro: number;
  promotions: number;
}

export class Juice {
  readonly counters: JuiceCounters = { comboMax: 0, combos: 0, slowmo: 0, coins: 0, numbers: 0, bossIntro: 0, promotions: 0 };
  private combo = 0;
  private lastKill = -99;
  private comboText: Phaser.GameObjects.Text | null = null;
  private coinsInFlight = 0;
  private numbersAlive = 0;
  private readonly dmgAcc = new Map<number, { dmg: number; t: number; e: Enemy }>();
  private readonly lastHp = new Map<number, number>();
  private slowUntil = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly layer: Phaser.GameObjects.Container,
    private readonly ctl: Controller,
    private readonly settings: FxSettings,
    private readonly playSfx: (key: string, volume?: number, rate?: number) => void,
  ) {}

  /** Erledigung: Combo zählen, Münzen fliegen lassen. */
  kill(e: Enemy, time: number): void {
    if (time - this.lastKill > COMBO_WINDOW) this.combo = 0;
    this.lastKill = time;
    this.combo++;
    this.counters.comboMax = Math.max(this.counters.comboMax, this.combo);
    if (!this.settings.reducedMotion && this.combo >= 3) this.showCombo(e.x, e.y);
    if (this.combo === 10 && this.settings.cinematic) this.slowmo(0.6, 0.35);
    if (!this.settings.reducedMotion) this.flyCoin(e.x, e.y - 10, ENEMIES[e.type].boss ? 6 : 1);
    this.dmgAcc.delete(e.id);
    this.lastHp.delete(e.id);
  }

  private showCombo(x: number, y: number): void {
    const n = this.combo;
    const title = (COMBO_TITLES.find(([min]) => n >= min)?.[1] ?? 'Combo x{n}').replace('{n}', String(n));
    this.counters.combos++;
    this.playSfx('combo', 0.5, 0.9 + Math.min(1.2, n * 0.04));
    const big = n >= 10;
    if (!this.comboText) {
      this.comboText = this.scene.add
        .text(0, 0, '', { fontFamily: HAND, fontSize: '34px', fontStyle: 'bold', color: '#ff6f00', stroke: '#ffffff', strokeThickness: 7, resolution: 2 })
        .setOrigin(0.5);
      this.layer.add(this.comboText);
    }
    const t = this.comboText;
    t.setText(title).setColor(big ? '#d81b60' : '#ff6f00').setFontSize(big ? 42 : 32);
    t.setPosition(Math.min(WIDTH - t.width / 2 - 8, Math.max(t.width / 2 + 8, x)), Math.max(60, y - 70)).setAlpha(1).setScale(1.5).setAngle(-4);
    this.scene.tweens.killTweensOf(t);
    this.scene.tweens.add({ targets: t, scale: 1, angle: 0, duration: 220, ease: 'Back.easeOut' });
    this.scene.tweens.add({ targets: t, alpha: 0, y: t.y - 24, delay: 900, duration: 500 });
  }

  /** Zeitlupe (nur Maximal): Echtzeit-Tempo kurz absenken. */
  slowmo(seconds: number, scale: number): void {
    if (!this.settings.cinematic) return;
    this.counters.slowmo++;
    this.ctl.timeScale = scale;
    this.slowUntil = performance.now() + seconds * 1000;
  }

  private flyCoin(x: number, y: number, count: number): void {
    for (let i = 0; i < count && this.coinsInFlight < MAX_COINS; i++) {
      this.coinsInFlight++;
      this.counters.coins++;
      const c = this.scene.add.image(x, y, ATLAS, 'prop/coin').setDisplaySize(15, 15);
      this.layer.add(c);
      const cx = x + (Math.random() - 0.5) * 40;
      const cy = y - 30 - Math.random() * 30;
      this.scene.tweens.add({
        targets: c, x: cx, y: cy, duration: 220, ease: 'Quad.easeOut',
        onComplete: () => {
          this.scene.tweens.add({
            targets: c, x: 30, y: -10, displayWidth: 9, displayHeight: 9, duration: 520 + i * 40, ease: 'Cubic.easeIn',
            onComplete: () => {
              c.destroy();
              this.coinsInFlight--;
              this.bumpMoney();
              this.playSfx('coin', 0.25, 1 + Math.random() * 0.3);
            },
          });
        },
      });
    }
  }

  /** Kapazitätsanzeige in der Kopfleiste hüpfen lassen. */
  private bumpMoney(): void {
    const chip = document.getElementById('money')?.closest('.chip');
    if (!chip) return;
    chip.classList.remove('bump');
    void (chip as HTMLElement).offsetWidth;
    chip.classList.add('bump');
  }

  /** Pro Frame: Schaden je Gegner bündeln und als Zahl zeigen (alle 0,3 s). */
  update(enemies: readonly Enemy[], time: number): void {
    if (this.slowUntil && performance.now() > this.slowUntil) {
      this.slowUntil = 0;
      this.ctl.timeScale = 1;
    }
    if (this.settings.reducedMotion) return;
    for (const e of enemies) {
      const prev = this.lastHp.get(e.id);
      this.lastHp.set(e.id, e.hp);
      if (prev === undefined || e.hp >= prev) continue;
      const acc = this.dmgAcc.get(e.id) ?? { dmg: 0, t: time, e };
      acc.dmg += prev - e.hp;
      acc.e = e;
      this.dmgAcc.set(e.id, acc);
    }
    for (const [id, acc] of this.dmgAcc) {
      if (time - acc.t < 0.3) continue;
      this.dmgAcc.delete(id);
      if (acc.dmg < 1 || this.numbersAlive >= MAX_NUMBERS) continue;
      this.number(acc.e.x, acc.e.y - 30, acc.dmg, acc.dmg >= acc.e.maxHp * 0.2);
    }
  }

  private number(x: number, y: number, dmg: number, big: boolean): void {
    this.numbersAlive++;
    this.counters.numbers++;
    const t = this.scene.add
      .text(x + (Math.random() - 0.5) * 14, y, String(Math.round(dmg)), {
        fontFamily: HAND, fontSize: big ? '24px' : '17px', fontStyle: 'bold', color: big ? '#ffb300' : '#ffffff', stroke: '#37474f', strokeThickness: 4, resolution: 2,
      })
      .setOrigin(0.5);
    this.layer.add(t);
    this.scene.tweens.add({
      targets: t, y: y - 26, alpha: 0, duration: 700, ease: 'Quad.easeOut',
      onComplete: () => {
        t.destroy();
        this.numbersAlive--;
      },
    });
  }

  /** Boss betritt die Bühne: Namenskarte; bei Maximal mit Kamerazoom und Zeitlupe. */
  bossIntro(e: Enemy): void {
    this.counters.bossIntro++;
    const s = this.scene;
    const cam = s.cameras.main;
    if (this.settings.cinematic) {
      this.slowmo(1.4, 0.3);
      cam.pan(Math.min(WIDTH - WIDTH / 2.6, Math.max(WIDTH / 2.6, e.x)), Math.min(HEIGHT - HEIGHT / 2.6, Math.max(HEIGHT / 2.6, e.y)), 400, 'Sine.easeOut');
      cam.zoomTo(1.3, 400, 'Sine.easeOut');
      s.time.delayedCall(1300, () => {
        cam.pan(WIDTH / 2, HEIGHT / 2, 450, 'Sine.easeInOut');
        cam.zoomTo(1, 450, 'Sine.easeInOut');
      });
    }
    const card = s.add.container(WIDTH / 2, HEIGHT * 0.72);
    const bg = s.add.rectangle(0, 0, 560, 74, 0x263238, 0.92).setStrokeStyle(4, 0xe53935);
    const t1 = s.add.text(0, -14, 'BOSS BETRITT DAS BÜRO', { fontFamily: HAND, fontSize: '22px', fontStyle: 'bold', color: '#ff8a80', resolution: 2 }).setOrigin(0.5);
    const t2 = s.add.text(0, 14, ENEMIES[e.type].name, { fontFamily: HAND, fontSize: '28px', fontStyle: 'bold', color: '#ffffff', resolution: 2 }).setOrigin(0.5);
    card.add([bg, t1, t2]).setScrollFactor(0).setAlpha(0).setScale(0.8);
    this.layer.add(card);
    s.tweens.add({ targets: card, alpha: 1, scale: 1, duration: 260, ease: 'Back.easeOut' });
    s.tweens.add({ targets: card, alpha: 0, delay: 1700, duration: 400, onComplete: () => card.destroy() });
  }

  /** Beförderung: Lichtsäule + Titel. */
  promote(t: Tower): void {
    this.counters.promotions++;
    const s = this.scene;
    const key = `prop/glow/${t.type}`;
    const pillar = s.add.image(t.x, t.y + 12, ATLAS, key).setOrigin(0.5, 1).setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(30, 10).setAlpha(0.95);
    this.layer.add(pillar);
    s.tweens.add({ targets: pillar, displayHeight: this.settings.reducedMotion ? 60 : 160, duration: 220, ease: 'Quad.easeOut' });
    s.tweens.add({ targets: pillar, alpha: 0, displayWidth: 6, delay: 350, duration: 500, onComplete: () => pillar.destroy() });
    if (t.level === 5) {
      const title = UPGRADE_TITLES[t.type][5] ?? 'BEFÖRDERT!';
      const txt = s.add.text(t.x, t.y - 70, `BEFÖRDERT: ${title}`, { fontFamily: HAND, fontSize: '22px', fontStyle: 'bold', color: '#f9a825', stroke: '#ffffff', strokeThickness: 6, resolution: 2 }).setOrigin(0.5);
      txt.setX(Math.min(WIDTH - txt.width / 2 - 6, Math.max(txt.width / 2 + 6, t.x)));
      this.layer.add(txt);
      s.tweens.add({ targets: txt, y: txt.y - 20, alpha: 0, delay: 1000, duration: 600, onComplete: () => txt.destroy() });
    }
  }

  reset(): void {
    this.combo = 0;
    this.dmgAcc.clear();
    this.lastHp.clear();
    this.ctl.timeScale = 1;
    this.slowUntil = 0;
    this.scene.cameras.main.setZoom(1).centerOn(WIDTH / 2, HEIGHT / 2);
  }
}
