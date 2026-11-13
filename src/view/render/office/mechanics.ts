import Phaser from 'phaser';
import { ENEMIES, type Enemy, type SimEvent } from '../../../sim/index';
import { ATLAS } from '../../PreloadScene';
import { HAND } from '../../texts';
import type { MonsterView } from './monster';

// Sichtbare Gegner-Mechaniken der Kampagnen (Spec campaigns „Neue Gegner“): Ketten zwischen Abhängigkeiten,
// Bremsfeld des Vendor Lock-in, Heilradius und Heilimpuls des Enablers, Entdeckung der Schatten-IT, Budget-Kürzung,
// Boss-Phasen und Minion-Spawns. Rein kosmetisch; dauerhafte Zustände liest `update`, Ereignisse kommen über `onSim`.

type ViewOf = (id: number) => MonsterView | undefined;

interface Ring {
  x: number;
  y: number;
  r0: number;
  r1: number;
  t: number;
  life: number;
  color: number;
  width: number;
}

const MAX_FX = 40;

export class Mechanics {
  /** Debug/E2E: Anzahl gezeigter Effekte je Art. */
  readonly counters: Record<string, number> = {};
  private readonly floor: Phaser.GameObjects.Graphics;
  private readonly fx: Phaser.GameObjects.Graphics;
  private readonly rings: Ring[] = [];
  private readonly pops = new Set<number>();
  private readonly sprites: Phaser.GameObjects.GameObject[] = [];

  /**
   * @param under Ebene unter den Figuren (Ketten, Bremsfelder, Heilradius), z. B. `layers.under`.
   * @param over Ebene über den Figuren (Ringe, Symbole, Texte), z. B. `layers.texts`.
   */
  constructor(
    private readonly scene: Phaser.Scene,
    under: Phaser.GameObjects.Container,
    private readonly over: Phaser.GameObjects.Container,
    private readonly reducedMotion: () => boolean,
  ) {
    this.floor = scene.add.graphics();
    this.fx = scene.add.graphics();
    under.add(this.floor);
    over.add(this.fx);
  }

  private count(kind: string): void {
    this.counters[kind] = (this.counters[kind] ?? 0) + 1;
  }

  /** Jeden Frame: dauerhafte Anzeigen zeichnen, ausstehende Spawn-Pops auslösen. */
  update(dt: number, time: number, enemies: readonly Enemy[], view: ViewOf): void {
    const g = this.floor;
    g.clear();
    const byId = new Map<number, Enemy>();
    for (const e of enemies) byId.set(e.id, e);
    const spin = this.reducedMotion() ? 0 : time;
    for (const e of enemies) {
      const def = ENEMIES[e.type];
      if (e.hidden) continue;
      // Vendor Lock-in: Bremsfeld (Rollen im Umkreis feuern langsamer)
      if (def.drag) dashedRing(g, e.x, e.y, def.drag.radius, 0xffa726, 0.55, spin * 0.6, 0.07);
      // Enabler: Heilradius
      if (def.heal) {
        g.fillStyle(0x66bb6a, 0.06).fillCircle(e.x, e.y, def.heal.radius);
        g.lineStyle(1.5, 0x43a047, 0.28).strokeCircle(e.x, e.y, def.heal.radius);
      }
      // Abhängigkeit: Kette zum Partner (einmal je Paar)
      const p = e.partnerId ? byId.get(e.partnerId) : undefined;
      if (p && e.id < p.id) chain(g, e.x, e.y - 8, p.x, p.y - 8, spin);
    }
    for (const id of this.pops) {
      const v = view(id);
      if (v) {
        v.spawnPop();
        this.pops.delete(id);
      } else if (!byId.has(id)) this.pops.delete(id);
    }

    const f = this.fx;
    f.clear();
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i]!;
      r.t += dt;
      if (r.t >= r.life) {
        this.rings.splice(i, 1);
        continue;
      }
      const k = r.t / r.life;
      const ease = 1 - (1 - k) * (1 - k);
      f.lineStyle(r.width * (1 - k * 0.6), r.color, 0.85 * (1 - k)).strokeCircle(r.x, r.y, r.r0 + (r.r1 - r.r0) * ease);
    }
  }

  /** SimEvents der Kampagnen-Gegner (alle anderen werden ignoriert). */
  onSim(e: SimEvent, view: ViewOf): void {
    switch (e.type) {
      case 'stalled':
        this.count('stalled');
        this.puff(e.enemy.x, e.enemy.y + 10, 0.5);
        break;
      case 'sprinted':
        this.count('sprinted');
        this.puff(e.enemy.x, e.enemy.y + 10, 0.4);
        break;
      case 'healed': {
        this.count('healed');
        this.ring(e.enemy.x, e.enemy.y, 8, e.radius, 0x43a047, 0.7, 4);
        for (const id of e.enemyIds) {
          const v = view(id);
          if (v) this.rise('prop/plus', v.enemy.x + (Math.random() - 0.5) * 10, v.top - 4, 14);
        }
        break;
      }
      case 'revealed': {
        this.count('revealed');
        view(e.enemy.id)?.revealFlash();
        this.ring(e.enemy.x, e.enemy.y, 6, 34, 0x5c6bc0, 0.5, 3);
        this.rise('prop/magnifier', e.enemy.x + 14, (view(e.enemy.id)?.top ?? e.enemy.y - 30) - 2, 20);
        break;
      }
      case 'budgetCut': {
        this.count('budgetCut');
        const top = view(e.enemy.id)?.top ?? e.enemy.y - 60;
        this.rise('prop/scissors', e.enemy.x, top - 10, 28);
        if (e.amount > 0) this.floatText(`−${e.amount} SP`, e.enemy.x, top - 30, '#c62828');
        for (let i = 0; i < 5; i++) this.coin(e.enemy.x, top + 6);
        break;
      }
      case 'bossPhase': {
        this.count('bossPhase');
        const v = view(e.enemy.id);
        v?.phaseFlash();
        this.ring(e.enemy.x, e.enemy.y, 20, 120, 0xffffff, 0.6, 8);
        this.ring(e.enemy.x, e.enemy.y, 10, 90, 0x9575cd, 0.75, 5);
        this.floatText(`Phase ${e.phase + 1}!`, e.enemy.x, (v?.top ?? e.enemy.y - 60) - 26, '#6a1b9a');
        break;
      }
      case 'spawnedMinion':
        this.count('spawnedMinion');
        this.puff(e.minion.x, e.minion.y, 0.8);
        this.pops.add(e.minion.id);
        break;
      default:
        break;
    }
  }

  private ring(x: number, y: number, r0: number, r1: number, color: number, life: number, width: number): void {
    if (this.rings.length >= MAX_FX) this.rings.shift();
    this.rings.push({ x, y, r0, r1, t: 0, life: this.reducedMotion() ? life * 0.6 : life, color, width });
  }

  private track<T extends Phaser.GameObjects.GameObject>(obj: T): T {
    this.over.add(obj);
    this.sprites.push(obj);
    if (this.sprites.length > MAX_FX) this.sprites.shift()?.destroy();
    obj.once(Phaser.GameObjects.Events.DESTROY, () => {
      const i = this.sprites.indexOf(obj);
      if (i >= 0) this.sprites.splice(i, 1);
    });
    return obj;
  }

  /** Symbol steigt auf und verblasst. */
  private rise(frame: string, x: number, y: number, size: number): void {
    const img = this.track(this.scene.add.image(x, y, ATLAS, frame));
    img.setScale(size / Math.max(img.width, img.height));
    const s = img.scale;
    if (this.reducedMotion()) {
      this.scene.time.delayedCall(700, () => img.destroy());
      return;
    }
    img.setScale(s * 0.3);
    this.scene.tweens.add({ targets: img, scale: s, duration: 180, ease: 'Back.easeOut' });
    this.scene.tweens.add({ targets: img, y: y - 18, alpha: 0, delay: 350, duration: 600, onComplete: () => img.destroy() });
  }

  private floatText(text: string, x: number, y: number, color: string): void {
    const t = this.track(
      this.scene.add
        .text(x, y, text, { fontFamily: HAND, fontSize: '20px', fontStyle: 'bold', color, stroke: '#ffffff', strokeThickness: 5, resolution: 2 })
        .setOrigin(0.5),
    );
    this.scene.tweens.add({ targets: t, y: y - (this.reducedMotion() ? 0 : 22), alpha: 0, delay: 600, duration: 700, onComplete: () => t.destroy() });
  }

  private coin(x: number, y: number): void {
    const img = this.track(this.scene.add.image(x, y, ATLAS, 'prop/coin').setDisplaySize(12, 12));
    if (this.reducedMotion()) {
      this.scene.time.delayedCall(500, () => img.destroy());
      return;
    }
    const a = Math.random() * Math.PI * 2;
    this.scene.tweens.add({ targets: img, x: x + Math.cos(a) * 34, y: y + Math.sin(a) * 18 + 20, alpha: 0, duration: 650, ease: 'Quad.easeOut', onComplete: () => img.destroy() });
  }

  private puff(x: number, y: number, scale: number): void {
    const img = this.track(this.scene.add.image(x, y, ATLAS, 'puff/06').setScale(scale * 0.4).setAlpha(0.7));
    if (this.reducedMotion()) {
      this.scene.time.delayedCall(300, () => img.destroy());
      return;
    }
    this.scene.tweens.add({ targets: img, scale: scale * 0.75, alpha: 0, duration: 420, onComplete: () => img.destroy() });
  }

  clear(): void {
    this.rings.length = 0;
    this.pops.clear();
    for (const s of [...this.sprites]) s.destroy();
    this.sprites.length = 0;
    this.floor.clear();
    this.fx.clear();
  }

  destroy(): void {
    this.clear();
    this.floor.destroy();
    this.fx.destroy();
  }
}

/** Gestrichelter Kreis mit Drehung (Bremsfeld). */
function dashedRing(g: Phaser.GameObjects.Graphics, x: number, y: number, r: number, color: number, alpha: number, rot: number, fill: number): void {
  g.fillStyle(color, fill).fillCircle(x, y, r);
  g.lineStyle(2, color, alpha);
  const n = 18;
  for (let i = 0; i < n; i++) {
    const a0 = rot + (i / n) * Math.PI * 2;
    const a1 = a0 + (Math.PI / n) * 1.1;
    g.beginPath();
    g.arc(x, y, r, a0, a1);
    g.strokePath();
  }
}

/** Kette zwischen zwei Punkten (leicht durchhängend, Glieder abwechselnd quer). */
function chain(g: Phaser.GameObjects.Graphics, x1: number, y1: number, x2: number, y2: number, time: number): void {
  const len = Math.hypot(x2 - x1, y2 - y1);
  if (len < 4 || len > 220) return;
  const sag = Math.min(12, len * 0.15) + Math.sin(time * 3) * 1.5;
  const links = Math.max(2, Math.floor(len / 7));
  for (let i = 0; i <= links; i++) {
    const t = i / links;
    const x = x1 + (x2 - x1) * t;
    const y = y1 + (y2 - y1) * t + Math.sin(t * Math.PI) * sag;
    const flat = i % 2 === 0;
    g.lineStyle(2, 0x616e78, 0.95);
    g.strokeEllipse(x, y, flat ? 7 : 3.5, flat ? 4 : 6);
    g.lineStyle(1, 0xcfd8dc, 0.9);
    g.strokeEllipse(x, y - 0.5, flat ? 4.5 : 2, flat ? 2 : 4);
  }
}
