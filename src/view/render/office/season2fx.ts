import Phaser from 'phaser';
import { TILE, TOWERS, type Enemy, type Game, type Tower } from '../../../sim/index';
import { ATLAS } from '../../PreloadScene';
import { HAND } from '../../texts';

// Effekte der Saison-2-Rollen (Spec season-2 AC-5/AC-6): Architektur-Runway, PI-Sync, Business Value, Schredder,
// Sprechblasen. Alles ohne WebGL-Filter (additive Grafiken, vorgefärbte Frames), damit auch der Canvas-Renderer passt.

interface Bubble {
  root: Phaser.GameObjects.Container;
  life: number;
  max: number;
  follow?: { x: number; y: number };
}

export class Season2Fx {
  private readonly runways = new Map<number, { root: Phaser.GameObjects.Container; level: number }>();
  private readonly bubbles: Bubble[] = [];
  private readonly glow: Phaser.GameObjects.Graphics;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly under: Phaser.GameObjects.Container,
    private readonly top: Phaser.GameObjects.Container,
    private readonly reducedMotion: boolean,
  ) {
    this.glow = scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
    under.add(this.glow);
  }

  /** Sprechblase über einem Punkt (Arbeitsplatz-Kopf), höchstens ~1,5 s. */
  bubble(x: number, y: number, text: string, color = '#37474f', seconds = 1.4, follow?: { x: number; y: number }): void {
    const s = this.scene;
    const label = s.add.text(0, -4, text, { fontFamily: HAND, fontSize: '19px', fontStyle: 'bold', color, resolution: 2 }).setOrigin(0.5);
    const w = Math.max(56, label.width + 22);
    const bg = s.add.image(0, 0, ATLAS, 'prop/bubble').setDisplaySize(w, 34);
    const root = s.add.container(x, y, [bg, label]).setScale(this.reducedMotion ? 1 : 0.2);
    this.top.add(root);
    if (!this.reducedMotion) s.tweens.add({ targets: root, scale: 1, duration: 180, ease: 'Back.easeOut' });
    this.bubbles.push({ root, life: seconds, max: seconds, follow });
  }

  /** PI-Sync: Welle vom RTE aus. */
  sync(rte: Tower, radius: number, towers: Tower[]): void {
    const s = this.scene;
    const ring = s.add.image(rte.x, rte.y, ATLAS, 'prop/glow/rte').setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.9);
    ring.setDisplaySize(40, 40);
    this.top.add(ring);
    s.tweens.add({ targets: ring, displayWidth: radius * 2.2, displayHeight: radius * 2.2, alpha: 0, duration: this.reducedMotion ? 1 : 650, ease: 'Cubic.easeOut', onComplete: () => ring.destroy() });
    this.bubble(rte.x, rte.y - 52, 'PI-Sync!', '#00796b', 1.2);
    for (const t of towers) {
      const g = s.add.image(t.x, t.y + 10, ATLAS, 'prop/glow/rte').setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(10, 10);
      this.top.add(g);
      s.tweens.add({ targets: g, displayWidth: 60, displayHeight: 30, alpha: 0, duration: 600, delay: 120, onComplete: () => g.destroy() });
    }
  }

  /** Business Value: Münzen steigen vom RTO auf. */
  coins(t: Tower, amount: number): void {
    const s = this.scene;
    const n = this.reducedMotion ? 2 : 6;
    for (let i = 0; i < n; i++) {
      const c = s.add.image(t.x + (Math.random() - 0.5) * 20, t.y - 10, ATLAS, 'prop/coin').setDisplaySize(14, 14);
      this.top.add(c);
      s.tweens.add({
        targets: c, y: c.y - 40 - Math.random() * 25, x: c.x + (Math.random() - 0.5) * 30, alpha: 0, angle: 360,
        duration: 900, delay: i * 60, ease: 'Quad.easeOut', onComplete: () => c.destroy(),
      });
    }
    this.bubble(t.x, t.y - 52, `+${amount} SP`, '#2e7d32', 1.3);
  }

  /** „Projekt eingestampft“: Schredder erscheint, Ticket verschwindet darin. */
  shred(e: Enemy, onDone: () => void): void {
    const s = this.scene;
    const sh = s.add.image(e.x, e.y + 14, ATLAS, 'prop/shredder').setOrigin(0.5, 1).setDisplaySize(44, 52).setAlpha(0);
    this.top.add(sh);
    const paper = s.add.image(e.x, e.y - 30, ATLAS, `enemy/${e.type}/walk0`).setDisplaySize(30, 36);
    this.top.add(paper);
    s.tweens.add({ targets: sh, alpha: 1, duration: 120 });
    s.tweens.add({
      targets: paper, y: e.y - 16, scaleY: 0.05, duration: this.reducedMotion ? 1 : 520, ease: 'Quad.easeIn',
      onComplete: () => {
        paper.destroy();
        onDone();
        s.tweens.add({ targets: sh, alpha: 0, delay: 400, duration: 300, onComplete: () => sh.destroy() });
      },
    });
  }

  update(dt: number, time: number, game: Game): void {
    // Architektur-Runway: Bauplan-Raster auf Laufband-Feldern in Reichweite jedes RTA
    const seen = new Set<number>();
    for (const t of game.state.towers) {
      if (t.type !== 'rta') continue;
      seen.add(t.id);
      let r = this.runways.get(t.id);
      if (!r || r.level !== t.level) {
        r?.root.destroy();
        const range = TOWERS.rta.range * (1 + 0.1 * (t.level - 1));
        const imgs: Phaser.GameObjects.Image[] = [];
        for (const key of game.pathCells) {
          const [cx, cy] = key.split(',').map(Number) as [number, number];
          const x = cx * TILE + TILE / 2;
          const y = cy * TILE + TILE / 2;
          if ((x - t.x) ** 2 + (y - t.y) ** 2 > range * range) continue;
          imgs.push(this.scene.add.image(x, y, ATLAS, 'prop/blueprint').setDisplaySize(TILE, TILE));
        }
        const root = this.scene.add.container(0, 0, imgs);
        this.under.addAt(root, 0);
        r = { root, level: t.level };
        this.runways.set(t.id, r);
      }
      const pulse = this.reducedMotion ? 0 : Math.sin(time * 2 + t.id) * 0.1;
      r.root.setAlpha(t.offTime > 0 ? 0.25 : 0.75 + pulse);
    }
    for (const [id, r] of this.runways) {
      if (!seen.has(id)) {
        r.root.destroy();
        this.runways.delete(id);
      }
    }
    // PI-Sync-Leuchten unter geboosteten Teammitgliedern
    const g = this.glow;
    g.clear();
    for (const t of game.state.towers) {
      if (t.syncTime <= 0) continue;
      const a = Math.min(1, t.syncTime) * (0.35 + (this.reducedMotion ? 0 : 0.1 * Math.sin(time * 8 + t.id)));
      g.fillStyle(0x26a69a, a).fillEllipse(t.x, t.y + 14, 46, 18);
    }
    // Sprechblasen
    for (let i = this.bubbles.length - 1; i >= 0; i--) {
      const b = this.bubbles[i]!;
      b.life -= dt;
      if (b.follow) b.root.setPosition(b.follow.x, b.follow.y - 52);
      if (b.life <= 0) {
        b.root.destroy();
        this.bubbles.splice(i, 1);
      } else if (b.life < 0.25) b.root.setAlpha(b.life / 0.25);
      else if (!this.reducedMotion) b.root.y += Math.sin(time * 4 + i) * 0.05;
    }
  }

  /** Anzahl sichtbarer Sprechblasen (Büroleben begrenzt die Dichte). */
  get bubbleCount(): number {
    return this.bubbles.length;
  }

  reset(): void {
    for (const r of this.runways.values()) r.root.destroy();
    this.runways.clear();
    for (const b of this.bubbles) b.root.destroy();
    this.bubbles.length = 0;
    this.glow.clear();
  }
}
