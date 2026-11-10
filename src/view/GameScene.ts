import Phaser from 'phaser';
import { ENEMIES, HEIGHT, TILE, TOWERS, WIDTH, type Enemy, type Game, type SimEvent } from '../sim/index';
import type { SoundEngine } from './audio';
import type { Controller, DebugApi } from './controller';
import type { FxSettings } from './fx';
import { activeFilters, createLayers, registerFilter, unregisterFilter, type Layers } from './layers';
import { DonePile } from './logic/donePile';
import { ATLAS } from './PreloadScene';
import { WaveBanner } from './render/banner';
import { Board } from './render/board';
import { dashedCircle, dashedPolyline, hex } from './render/draw';
import { Effects } from './render/effects';
import { EnemyView, TowerView, type ViewCtx } from './render/entities';
import { Particles } from './render/particles';
import { PileView } from './render/pile';
import { ABSENT, HAND, INK, JAM, KILL, LEAK, SPRINTS, UPGRADE_TITLES, pick, piLabel } from './texts';

/** Caveat läuft kleiner als die alte Systemschrift – Textgrößen aus Spec 1 werden skaliert. */
const HAND_SCALE = 1.3;
/** DONE-Haufen: Spalte DONE unten (Spec visual-overhaul T04). */
const PILE_AREA = { x: 720, y: 470, w: 240, h: 130 };
const PILE_MAX = 60;
const HITSTOP_MS = 60;

const SHOT_FRAME = { dualo: 'proj/dualo', analyst: 'proj/analyst', scrum: 'proj/scrum', ppl: 'prop/pin', dev: 'proj/dualo' } as const;
const SHOT_SIZE = { dualo: 12, analyst: 17, scrum: 16, ppl: 20, dev: 12 } as const;

/** Entfernt Darstellungen, deren Sim-Objekt nicht mehr existiert. */
function prune<V extends { destroy(): void }>(views: Map<number, V>, seen: ReadonlySet<number>): void {
  for (const [id, v] of views) {
    if (!seen.has(id)) {
      v.destroy();
      views.delete(id);
    }
  }
}

/** Spielfeld: rendert den Sim-Zustand und übersetzt Maus-Eingaben in Controller-Aufrufe. */
export class GameScene extends Phaser.Scene {
  private board!: Board;
  private layers!: Layers;
  private ctx!: ViewCtx;
  private under!: Phaser.GameObjects.Graphics;
  private beams!: Phaser.GameObjects.Graphics;
  private beamLayer!: Phaser.GameObjects.Container;
  private trailsG!: Phaser.GameObjects.Graphics;
  private ringsG!: Phaser.GameObjects.Graphics;
  private parts!: Particles;
  private codeFx!: Phaser.GameObjects.Particles.ParticleEmitter;
  private pileView!: PileView;
  private banner!: WaveBanner;
  private flashRect!: Phaser.GameObjects.Rectangle;
  private overLayer!: Phaser.GameObjects.Container;
  private overStats!: Phaser.GameObjects.Text;
  private victoryLayer!: Phaser.GameObjects.Container;
  private victoryStats!: Phaser.GameObjects.Text;
  private hint!: Phaser.GameObjects.Text;
  private desat: Phaser.Filters.ColorMatrix | null = null;
  private desatT = 0;

  private readonly fx = new Effects();
  private readonly towers = new Map<number, TowerView>();
  private readonly enemies = new Map<number, EnemyView>();
  private readonly trails = new Map<number, Array<[number, number]>>();
  private readonly shots = new Map<number, Phaser.GameObjects.Image>();
  private readonly floatTexts = new Map<number, Phaser.GameObjects.Text>();
  private readonly flights = new Set<Phaser.GameObjects.Image>();
  private mouse = { x: -99, y: -99 };
  private time_ = 0;

  constructor(
    private readonly ctl: Controller,
    private readonly sfx: SoundEngine,
    private readonly settings: FxSettings,
  ) {
    super({ key: 'game' });
  }

  /** Debug-Abfragen für E2E-Tests (window.__bd.debug). */
  debugApi(): DebugApi {
    return {
      filters: () => activeFilters(this),
      motion: () => ({ shake: !this.settings.reducedMotion, hitstop: !this.settings.reducedMotion }),
      renderer: () => (this.game.renderer.type === Phaser.WEBGL ? 'webgl' : 'canvas'),
      pile: () => this.pileView.pile.balls.map((b) => ({ x: Math.round(b.x), y: Math.round(b.y), type: b.color })),
      scene: () => this,
    };
  }

  create(): void {
    const webgl = this.game.renderer.type === Phaser.WEBGL;
    this.ctx = { scene: this, webgl, filters: webgl && this.settings.level === 'high', reducedMotion: this.settings.reducedMotion };
    this.layers = createLayers(this, this.settings);
    this.under = this.add.graphics();
    this.layers.under.add(this.under);

    // Strahlen in eigener Ebene, damit ein einziger Glow-Filter alle Strahlen erfasst.
    this.beams = this.add.graphics();
    this.beamLayer = this.add.container(0, 0, [this.beams]);
    this.trailsG = this.add.graphics();
    this.layers.shots.add([this.trailsG, this.beamLayer]);
    if (this.ctx.filters) {
      this.beamLayer.enableFilters();
      this.beamLayer.filters?.internal.addGlow(0xd81b60, 4, 0, 1);
      registerFilter(this, 'beams', 'Glow');
    }
    this.codeFx = this.add.particles(0, 0, ATLAS, {
      frame: 'proj/code/dev', emitting: false, lifespan: { min: 300, max: 600 }, speed: { min: 10, max: 50 },
      scale: { start: 0.55, end: 0.1 }, alpha: { start: 1, end: 0 }, rotate: { min: -25, max: 25 }, maxParticles: 200,
    });
    this.layers.shots.add(this.codeFx);

    this.parts = new Particles(this, this.layers.particles, this.settings.particleScale);
    this.ringsG = this.add.graphics();
    this.layers.particles.add(this.ringsG);

    this.banner = new WaveBanner(this, this.settings.reducedMotion);
    this.flashRect = this.add.rectangle(0, 0, WIDTH, HEIGHT, 0xc62828, 0).setOrigin(0);
    this.buildGameOver();
    this.hint = this.add
      .text(WIDTH / 2, HEIGHT - 28, 'Klick irgendwo oder drück 1–5 → Turm wählen · LEERTASTE → Sprint starten', {
        fontFamily: HAND, fontSize: '26px', fontStyle: 'bold', color: '#1565c0', stroke: '#ffffff', strokeThickness: 5, resolution: 2,
      })
      .setOrigin(0.5);
    this.layers.overlay.add([this.banner.root, this.flashRect, this.overLayer, this.victoryLayer, this.hint]);

    this.buildBoard(this.ctl.game);
    this.ctl.onSim((e) => this.onSim(e));
    this.ctl.onRestart((g) => this.reset(g));

    this.input.mouse?.disableContextMenu();
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      this.mouse = { x: p.x, y: p.y };
    });
    this.input.on('gameout', () => {
      this.mouse = { x: -99, y: -99 };
    });
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.sfx.start();
      this.mouse = { x: p.x, y: p.y };
      if (p.rightButtonDown()) {
        this.ctl.clearSelection();
        return;
      }
      if (this.ctl.clickBoard(p.x, p.y) === 'selectedTower') this.sfx.select();
    });
    // Signal für Tests/Automatisierung: Spielszene ist bereit und nimmt Eingaben an.
    document.body.dataset.ready = '1';
  }

  private buildBoard(game: Game): void {
    this.board = new Board(this, game, this.settings.reducedMotion);
    this.layers.board.add(this.board.root);
    const pile = new DonePile({
      max: PILE_MAX,
      area: PILE_AREA,
      blocked: (x, y) => game.pathCells.has(`${Math.floor(x / TILE)},${Math.floor(y / TILE)}`),
    });
    this.pileView = new PileView(this, this.layers.pile, pile);
  }

  private reset(game: Game): void {
    this.tweens.killAll();
    for (const img of this.flights) img.destroy();
    this.flights.clear();
    this.board.destroy();
    this.pileView.clear();
    for (const v of this.towers.values()) v.destroy();
    for (const v of this.enemies.values()) v.destroy();
    for (const t of this.shots.values()) t.destroy();
    for (const t of this.floatTexts.values()) t.destroy();
    this.towers.clear();
    this.enemies.clear();
    this.shots.clear();
    this.floatTexts.clear();
    this.trails.clear();
    this.fx.clear();
    this.parts.clear();
    this.banner.hide();
    if (this.desat) {
      this.cameras.main.filters.internal.remove(this.desat);
      unregisterFilter(this, 'camera', 'ColorMatrix');
      this.desat = null;
    }
    this.buildBoard(game);
  }

  private buildGameOver(): void {
    const bg = this.add.rectangle(0, 0, WIDTH, HEIGHT, 0xfbfbf7, 0.82).setOrigin(0);
    const stamp = this.add.graphics();
    stamp.lineStyle(7, 0xc62828, 1).strokeRect(-210, -55, 420, 110);
    const title = this.add.text(0, 4, 'BURNOUT!', { fontFamily: HAND, fontSize: '84px', fontStyle: 'bold', color: '#c62828', resolution: 2 }).setOrigin(0.5);
    const box = this.add.container(WIDTH / 2, HEIGHT / 2 - 70, [stamp, title]).setRotation(-0.1);
    const style = { fontFamily: HAND, fontSize: '26px', fontStyle: 'bold', color: '#37474f', resolution: 2 };
    const l1 = this.add.text(WIDTH / 2, HEIGHT / 2 + 30, 'Team-Moral: 0%. Das Programm wird in „Phase 2“ umbenannt.', style).setOrigin(0.5);
    this.overStats = this.add.text(WIDTH / 2, HEIGHT / 2 + 64, '', style).setOrigin(0.5);
    const l3 = this.add
      .text(WIDTH / 2, HEIGHT / 2 + 108, '[Leertaste] Neues Programm aufsetzen (gleiche Leute, neuer Projektname)', { ...style, color: '#1565c0' })
      .setOrigin(0.5);
    this.overLayer = this.add.container(0, 0, [bg, box, l1, this.overStats, l3]).setVisible(false);

    // Sieg (Spec balancing-challenge AC-9)
    const vbg = this.add.rectangle(0, 0, WIDTH, HEIGHT, 0xfbfbf7, 0.78).setOrigin(0);
    const vstamp = this.add.graphics();
    const vtitle = this.add
      .text(0, 4, 'RELEASE ERFOLGREICH!', { fontFamily: HAND, fontSize: '72px', fontStyle: 'bold', color: '#2e7d32', resolution: 2 })
      .setOrigin(0.5);
    const vw = vtitle.width + 60;
    vstamp.lineStyle(7, 0x2e7d32, 1).strokeRect(-vw / 2, -55, vw, 110);
    const vbox = this.add.container(WIDTH / 2, HEIGHT / 2 - 80, [vstamp, vtitle]).setRotation(-0.06);
    const v1 = this.add.text(WIDTH / 2, HEIGHT / 2 + 20, '30 Wellen überstanden. Der Fachbereich ist sprachlos (zum ersten Mal).', style).setOrigin(0.5);
    this.victoryStats = this.add.text(WIDTH / 2, HEIGHT / 2 + 58, '', { ...style, fontSize: '30px', color: '#1b5e20' }).setOrigin(0.5);
    const v3 = this.add
      .text(WIDTH / 2, HEIGHT / 2 + 108, '[Leertaste] Nächstes Programm · Replay rechts herunterladen', { ...style, color: '#1565c0' })
      .setOrigin(0.5);
    this.victoryLayer = this.add.container(0, 0, [vbg, vbox, v1, this.victoryStats, v3]).setVisible(false);
  }

  // ===================== Sim-Events → Effekte =====================

  private onSim(e: SimEvent): void {
    const fx = this.fx;
    const parts = this.parts;
    const game = this.ctl.game;
    switch (e.type) {
      case 'placed':
        parts.burst(e.tower.x, e.tower.y, TOWERS[e.tower.type].color, 24, 150, 'circle');
        fx.bumpShake(4);
        break;
      case 'upgraded':
        parts.burst(e.tower.x, e.tower.y, INK.yellow, 26, 250, 'star');
        this.towers.get(e.tower.id)?.upgrade();
        fx.text(e.tower.x, e.tower.y - 20, UPGRADE_TITLES[e.tower.type][e.tower.level] ?? '', INK.yellow, 16, 1.2);
        break;
      case 'sold':
        parts.burst(e.tower.x, e.tower.y, INK.red, 24, 200, 'dirt');
        fx.text(e.tower.x, e.tower.y, 'Wechselt ins Nachbarteam!', INK.red, 14);
        break;
      case 'rejected': {
        const c = e.command;
        if (c.type === 'place') {
          fx.text(this.mouse.x, this.mouse.y, e.reason === 'noMoney' ? 'Keine Kapazität mehr!' : 'Da sitzt schon wer!', INK.red, 14);
        } else if (c.type === 'upgrade') {
          const t = game.towerById(c.towerId);
          if (t && e.reason === 'maxLevel') fx.text(t.x, t.y - 20, 'Höher geht nur ins Management', INK.yellow, 13);
          if (t && e.reason === 'noMoney') fx.text(t.x, t.y - 20, 'Kein Budget!', INK.red, 13);
        }
        break;
      }
      case 'waveStarted':
        this.board.startMarker();
        if (e.boss) this.banner.show('PIP! Der Business Owner bringt ein MEGA-OBJECTIVE!', INK.red, 28, 2.2, 0xffcdd2);
        else if (e.pip) this.banner.show('PIP – Produkt-Inkrement Planning! Objectives & Features im Anflug', INK.pink, 24, 1.8);
        else this.banner.show(`${piLabel(e.wave)}: ${SPRINTS[e.wave % SPRINTS.length]}`, INK.pink, 30, 1.2);
        break;
      case 'fired':
        this.towers.get(e.tower.id)?.fire();
        break;
      case 'killed': {
        const boss = e.enemy.type === 'boss';
        const color = ENEMIES[e.enemy.type].color;
        parts.burst(e.enemy.x, e.enemy.y, color, boss ? 120 : 18, boss ? 400 : 200, 'circle');
        parts.burst(e.enemy.x, e.enemy.y, color, boss ? 40 : 6, boss ? 300 : 160, 'dirt');
        fx.text(e.enemy.x, e.enemy.y - 10, pick(KILL), INK.neutral, 13, 1);
        this.flyToPile(e.enemy);
        if (boss) {
          fx.shake = 25;
          fx.flash = 0.5;
          if (!this.settings.reducedMotion) this.ctl.hitstop(HITSTOP_MS);
          this.banner.show('PI-OBJECTIVE ERREICHT! (Business Value: 3 von 10)', INK.green, 30, 2, 0xc8e6c9);
        } else fx.bumpShake(3);
        break;
      }
      case 'split':
        fx.text(e.enemy.x, e.enemy.y + 16, 'Zerfällt in User Stories!', INK.green, 12, 1);
        break;
      case 'leaked': {
        const last = game.path[game.path.length - 1]!;
        fx.shake = 12;
        fx.flash = 0.25;
        fx.text(WIDTH - 120, last.y - 20, `${pick(LEAK)} -${e.damage}%`, INK.red, 16, 1.5);
        break;
      }
      case 'gameOver':
        parts.burst(WIDTH / 2, HEIGHT / 2, INK.red, 200, 600, 'circle');
        parts.burst(WIDTH / 2, HEIGHT / 2, INK.grey, 30, 120, 'smoke');
        fx.shake = 40;
        if (this.ctx.filters && !this.desat) {
          this.desat = this.cameras.main.filters.internal.addColorMatrix();
          this.desatT = 0;
          registerFilter(this, 'camera', 'ColorMatrix');
        }
        break;
      case 'waveCleared':
        this.banner.show(`SPRINT-REVIEW BESTANDEN! Kapazität +${e.bonus} SP`, INK.green, 22, 1.6, 0xc8e6c9);
        break;
      case 'victory': {
        this.banner.hide();
        const colors = [INK.green, INK.yellow, INK.pink, INK.cyan, TOWERS.dev.color, TOWERS.ppl.color];
        for (let i = 0; i < 8; i++) {
          const x = 120 + i * 100;
          parts.burst(x, HEIGHT / 2 - 60 + (i % 2) * 80, colors[i % colors.length]!, 40, 500, i % 2 ? 'star' : 'circle');
        }
        fx.text(WIDTH / 2, 70, `Moral-Bonus +${e.bonus}`, INK.green, 24, 2.5);
        break;
      }
      case 'jammed':
        fx.text(e.enemy.x, e.enemy.y - 24, pick(JAM), INK.grey, 12, 1.2);
        fx.ring(e.enemy.x, e.enemy.y, e.radius, INK.grey);
        parts.burst(e.enemy.x, e.enemy.y, INK.grey, 8, 60, 'smoke');
        break;
      case 'absent':
        fx.text(e.tower.x, e.tower.y - 22, pick(ABSENT), INK.cyan, 12, 1);
        break;
      case 'splash':
        parts.burst(e.x, e.y, INK.yellow, 26, 250, 'spark');
        parts.burst(e.x, e.y, INK.grey, 6, 70, 'smoke');
        fx.bumpShake(6);
        fx.ring(e.x, e.y, e.radius, INK.yellow);
        break;
      case 'hit':
        if (e.enemyId !== null) parts.burst(e.shot.tx, e.shot.ty, TOWERS[e.shot.towerType].color, 4, 100, 'spark');
        break;
      case 'pushed':
        fx.text(e.enemy.x, e.enemy.y - 18, e.enemy.type === 'boss' ? 'Hmm, nochmal schätzen…' : 'Zurück ins Refinement!', INK.purple, 12, 1);
        break;
      default:
        break;
    }
  }

  /** Kill: Post-it zerknüllen und im Bogen in den DONE-Haufen werfen (Spec visual-overhaul AC-6). */
  private flyToPile(enemy: Enemy): void {
    const ball = this.pileView.pile.add(enemy.type);
    if (this.settings.reducedMotion) {
      this.pileView.land(ball);
      return;
    }
    const boss = enemy.type === 'boss';
    const size = boss ? 54 : 30;
    const img = this.add.image(enemy.x, enemy.y, ATLAS, boss ? `prop/postit-curl/${enemy.type}` : `prop/postit/${enemy.type}`).setDisplaySize(size, size);
    this.layers.particles.add(img);
    this.flights.add(img);
    this.tweens.add({
      targets: img,
      scaleX: img.scaleX * 0.55,
      scaleY: img.scaleY * 0.45,
      angle: 120,
      duration: 150,
      ease: 'Quad.easeIn',
      onComplete: () => {
        img.setFrame(`prop/paperball/${enemy.type}`).setDisplaySize(16, 16);
        const sx = img.x;
        const sy = img.y;
        const cx = (sx + ball.x) / 2;
        const cy = Math.min(sy, ball.y) - 80;
        this.tweens.addCounter({
          from: 0,
          to: 1,
          duration: 600,
          ease: 'Sine.easeInOut',
          onUpdate: (tw) => {
            const t = tw.getValue() ?? 0;
            const u = 1 - t;
            img.x = u * u * sx + 2 * u * t * cx + t * t * ball.x;
            img.y = u * u * sy + 2 * u * t * cy + t * t * ball.y;
            img.rotation += 0.25;
          },
          onComplete: () => {
            this.flights.delete(img);
            img.destroy();
            this.pileView.land(ball);
          },
        });
      },
    });
  }

  // ===================== Frame =====================

  override update(_time: number, delta: number): void {
    const dt = delta / 1000;
    this.time_ += dt;
    this.ctl.advance(dt);
    const s = this.ctl.game.state;

    this.fx.update(s.over ? dt * 0.3 : dt);
    this.board.update(this.time_, dt);
    this.banner.update(dt);
    this.syncEntities(dt);
    this.drawUnder();
    this.drawShots();
    this.drawRings();
    this.drawTexts();

    const shake = this.settings.reducedMotion ? 0 : this.fx.shake;
    if (shake > 0.5) this.layers.world.setPosition((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    else this.layers.world.setPosition(0, 0);
    this.flashRect.setFillStyle(0xc62828, this.fx.flash * 0.35);
    if (this.desat && this.desatT < 1) {
      this.desatT = Math.min(1, this.desatT + dt / 0.6);
      this.desat.colorMatrix.grayscale(0.85 * this.desatT);
    }

    if (s.over && !s.won && !this.overLayer.visible) this.overStats.setText(`Geschafft bis: ${piLabel(s.wave)} · Score: ${s.score}`);
    if (s.won && !this.victoryLayer.visible) {
      this.victoryStats.setText(`Score: ${s.score}  ·  Moral: ${s.lives} %  ·  Moral-Bonus: +${s.lives * 100}`);
    }
    this.overLayer.setVisible(s.over && !s.won);
    this.victoryLayer.setVisible(s.won);
    this.hint.setVisible(!this.sfx.started && !s.over);
  }

  private syncEntities(dt: number): void {
    const s = this.ctl.game.state;
    const enemyPos = new Map(s.enemies.map((e) => [e.id, e] as const));

    const seenT = new Set<number>();
    for (const t of s.towers) {
      seenT.add(t.id);
      let v = this.towers.get(t.id);
      if (!v) {
        v = new TowerView(this.ctx, t);
        this.towers.set(t.id, v);
        this.layers.towers.add(v.root);
      }
      v.update(dt, this.time_, t.targetId !== null ? (enemyPos.get(t.targetId) ?? null) : null);
      if (t.beam) this.sfx.laser();
    }
    prune(this.towers, seenT);

    const seenE = new Set<number>();
    for (const e of s.enemies) {
      if (e.hp <= 0) continue;
      seenE.add(e.id);
      let v = this.enemies.get(e.id);
      if (!v) {
        v = new EnemyView(this.ctx, e, this.layers.enemyUi);
        this.enemies.set(e.id, v);
        this.layers.enemies.add(v.root);
      }
      v.update(dt, this.time_);
    }
    prune(this.enemies, seenE);
  }

  /** Vorschau, Aura, Auswahl, Boost-Ringe; Entwickler-Strahlen in der Glow-Ebene. */
  private drawUnder(): void {
    const game = this.ctl.game;
    const g = this.under;
    const b = this.beams;
    g.clear();
    b.clear();
    const sel = this.ctl.selected;
    if (sel && this.mouse.x >= 0 && !game.state.over) {
      const cx = Math.floor(this.mouse.x / TILE);
      const cy = Math.floor(this.mouse.y / TILE);
      const ok = game.canPlace(sel, cx, cy) === null;
      const c = ok ? 0x43a047 : 0xc62828;
      g.fillStyle(c, 0.18).fillRect(cx * TILE, cy * TILE, TILE, TILE);
      g.lineStyle(2, c, 1);
      dashedCircle(g, cx * TILE + TILE / 2, cy * TILE + TILE / 2, TOWERS[sel].range, 6, 6);
    }
    const byId = new Map(game.state.enemies.map((e) => [e.id, e] as const));
    for (const t of game.state.towers) {
      const stats = game.towerStats(t);
      const off = t.offTime > 0;
      if (t.type === 'ppl') {
        const aura = TOWERS.ppl.aura!;
        g.fillStyle(0xf9a825, 0.06).fillCircle(t.x, t.y, aura);
        g.lineStyle(1.5, 0xf9a825, 0.55);
        dashedCircle(g, t.x, t.y, aura, 4, 6);
      }
      if (t.id === this.ctl.selectedTowerId) {
        g.lineStyle(1.5, 0x37474f, 1);
        dashedCircle(g, t.x, t.y, stats.range, 6, 6, this.time_ * 20);
      }
      const target = t.beam && t.targetId !== null ? byId.get(t.targetId) : undefined;
      if (target) {
        b.lineStyle(6 + t.level * 2, 0xd81b60, 0.25).lineBetween(t.x, t.y, target.x, target.y);
        b.lineStyle(2.5, 0xd81b60, 1);
        dashedPolyline(b, [t, target], 6, 4, -this.time_ * 80);
        if (Math.random() < 0.25 * this.settings.particleScale) {
          const f = Math.random();
          this.codeFx.explode(1, t.x + (target.x - t.x) * f, t.y + (target.y - t.y) * f);
        }
      }
      if (stats.boosted && !off) g.lineStyle(3, 0xf9a825, 1).strokeCircle(t.x, t.y, 22);
    }
  }

  /** Projektile als Sprites mit Marker-Spur (Spec visual-overhaul AC-7). */
  private drawShots(): void {
    const g = this.trailsG;
    g.clear();
    const seen = new Set<number>();
    for (const s of this.ctl.game.state.shots) {
      seen.add(s.id);
      const color = hex(TOWERS[s.towerType].color);
      const trail = this.trails.get(s.id) ?? [];
      trail.push([s.x, s.y]);
      if (trail.length > 7) trail.shift();
      this.trails.set(s.id, trail);
      if (trail.length > 1) {
        g.lineStyle(3, color, 0.3);
        g.beginPath();
        trail.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
        g.strokePath();
      }
      let img = this.shots.get(s.id);
      if (!img) {
        const size = SHOT_SIZE[s.towerType];
        img = this.add.image(s.x, s.y, ATLAS, SHOT_FRAME[s.towerType]).setDisplaySize(size, size);
        this.shots.set(s.id, img);
        this.layers.shots.add(img);
      }
      img.setPosition(s.x, s.y);
      const prev = trail[trail.length - 2];
      if (s.towerType === 'scrum') img.rotation -= 0.35;
      else if (s.towerType === 'dualo') img.rotation += 0.3;
      else if (s.towerType === 'ppl' && prev) img.rotation = Math.atan2(s.y - prev[1], s.x - prev[0]) - Math.PI / 4;
    }
    for (const id of [...this.trails.keys()]) if (!seen.has(id)) this.trails.delete(id);
    prune(this.shots, seen);
  }

  private drawRings(): void {
    const g = this.ringsG;
    g.clear();
    for (const r of this.fx.rings) {
      g.lineStyle(2.5, hex(r.color), Math.min(1, r.life * 2));
      dashedCircle(g, r.x, r.y, r.r, 5, 5);
    }
  }

  private drawTexts(): void {
    const seen = new Set<number>();
    for (const t of this.fx.texts) {
      seen.add(t.id);
      let obj = this.floatTexts.get(t.id);
      if (!obj) {
        obj = this.add
          .text(0, 0, t.text, {
            fontFamily: HAND, fontSize: `${Math.round(t.size * HAND_SCALE)}px`, fontStyle: 'bold', color: t.color,
            stroke: '#ffffff', strokeThickness: 5, resolution: 2,
          })
          .setOrigin(0.5);
        this.floatTexts.set(t.id, obj);
        this.layers.texts.add(obj);
      }
      const half = obj.width / 2;
      obj.setPosition(Math.min(WIDTH - 10 - half, Math.max(10 + half, t.x)), t.y);
      obj.setAlpha(Math.min(1, (t.life / t.maxLife) * 2));
    }
    prune(this.floatTexts, seen);
  }
}
