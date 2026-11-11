import Phaser from 'phaser';
import { ENEMIES, HEIGHT, TILE, TOWERS, WIDTH, type Enemy, type Game, type SimEvent, type TowerType } from '../sim/index';
import type { SoundEngine } from './audio';
import type { Controller, DebugApi } from './controller';
import type { FxSettings } from './fx';
import { activeFilters, createLayers, registerFilter, unregisterFilter, type Layers } from './layers';
import { DonePile } from './logic/donePile';
import { ATLAS } from './PreloadScene';
import { WaveBanner } from './render/banner';
import { dashedCircle, hex } from './render/draw';
import { Effects } from './render/effects';
import type { ViewCtx } from './render/entities';
import { Decals } from './render/office/decals';
import { Juice } from './render/office/juice';
import { OfficeLife } from './render/office/life';
import { Season2Fx } from './render/office/season2fx';
import { OfficeFloor } from './render/office/floor';
import { MONSTER_W, MonsterView, createMonsterAnims } from './render/office/monster';
import { WorkstationView } from './render/office/workstation';
import { Particles } from './render/particles';
import { PileView } from './render/pile';
import { ABSENT, HAND, INK, JAM, KILL, LEAK, SPRINTS, UPGRADE_TITLES, pick, piLabel } from './texts';

/** Caveat läuft kleiner als die alte Systemschrift – Textgrößen aus Spec 1 werden skaliert. */
const HAND_SCALE = 1.3;
/** DONE-Haufen: Spalte DONE unten (Spec visual-overhaul T04). */
const PILE_AREA = { x: 720, y: 470, w: 240, h: 130 };
const PILE_MAX = 60;
const HITSTOP_MS = 60;

/** Geschosse als Büro-Gegenstände (Spec office-makeover AC-6). */
const SHOT_FRAME: Partial<Record<TowerType, string>> = { dualo: 'item/cup', analyst: 'item/notepad', scrum: 'item/bell', ppl: 'item/folder', dev: 'item/cup' };
const SHOT_SIZE: Partial<Record<TowerType, number>> = { dualo: 16, analyst: 16, scrum: 16, ppl: 20, dev: 12 };

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
  private board!: OfficeFloor;
  private layers!: Layers;
  private ctx!: ViewCtx;
  private decals!: Decals;
  private s2!: Season2Fx;
  private juice!: Juice;
  private life!: OfficeLife;
  private puffs!: Phaser.GameObjects.Particles.ParticleEmitter;
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
  private readonly towers = new Map<number, WorkstationView>();
  private readonly rtaPose = new Map<number, number>();
  private readonly enemies = new Map<number, MonsterView>();
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
      poses: () => [...this.towers.values()].map((v) => ({ id: v.tower.id, type: v.tower.type, level: v.tower.level, pose: v.currentPose })),
      monsters: () => [...this.enemies.values()].map((v) => ({ id: v.enemy.id, type: v.enemy.type, frame: v.frameName, width: v.displayWidth })),
      effects: () => ({
        ...this.effectCounts,
        ...Object.fromEntries(Object.entries(this.juice.counters).map(([k, v]) => [`juice:${k}`, v])),
        ...Object.fromEntries(Object.entries(this.life.counters).map(([k, v]) => [`life:${k}`, v])),
      }),
    };
  }

  /** Zähler ausgelöster Effekte je Ereignistyp (Debug/E2E). */
  private readonly effectCounts: Record<string, number> = {};

  create(): void {
    const webgl = this.game.renderer.type === Phaser.WEBGL;
    const settings = this.settings;
    // Live-Werte: ein Wechsel der Effektstufe wirkt sofort
    this.ctx = { scene: this, webgl, get filters() { return webgl && settings.level !== 'calm'; }, get reducedMotion() { return settings.reducedMotion; } };
    this.layers = createLayers(this, this.settings);
    createMonsterAnims(this);
    this.decals = new Decals(this, this.layers.decals);
    this.s2 = new Season2Fx(this, this.layers.under, this.layers.texts, this.settings.reducedMotion);
    this.juice = new Juice(this, this.layers.texts, this.ctl, this.settings, (k, v, r) => this.sfx.play(k, v, r));
    this.life = new OfficeLife(this, this.layers.actors, this.layers.texts, this.settings);
    this.under = this.add.graphics();
    this.layers.under.add(this.under);

    // Strahlen in eigener Ebene: additiv „leuchtend“ (auch im Canvas-Renderer), bei WebGL zusätzlich Glow-Filter.
    this.beams = this.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
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

    this.parts = new Particles(this, this.layers.particles, () => this.settings.particleScale);
    this.puffs = this.add.particles(0, 0, ATLAS, {
      frame: ['puff/00', 'puff/06', 'puff/12', 'puff/18'], emitting: false, lifespan: { min: 380, max: 700 },
      speed: { min: 15, max: 70 }, scale: { start: 0.22, end: 0.5 }, alpha: { start: 0.85, end: 0 }, rotate: { min: 0, max: 360 },
      maxParticles: 300,
    });
    this.layers.particles.add(this.puffs);
    this.ringsG = this.add.graphics();
    this.layers.particles.add(this.ringsG);

    this.banner = new WaveBanner(this, this.settings.reducedMotion);
    this.flashRect = this.add.rectangle(0, 0, WIDTH, HEIGHT, 0xc62828, 0).setOrigin(0);
    this.buildGameOver();
    this.hint = this.add
      .text(WIDTH / 2, HEIGHT - 28, 'Klick irgendwo oder drück 1–9 → Teammitglied wählen · LEERTASTE → Sprint starten', {
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
    this.board = new OfficeFloor(this, game, this.settings.reducedMotion);
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
    this.puffs.killAll();
    this.decals.clear();
    this.s2.reset();
    this.juice.reset();
    this.life.reset();
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
    const key = e.type === 'fired' ? `fired:${e.tower.type}` : e.type;
    this.effectCounts[key] = (this.effectCounts[key] ?? 0) + 1;
    switch (e.type) {
      case 'placed':
        parts.burst(e.tower.x, e.tower.y + 10, TOWERS[e.tower.type].color, 18, 150, 'circle');
        this.puffs.explode(Math.max(1, Math.round(4 * this.settings.particleScale)), e.tower.x, e.tower.y + 14);
        fx.bumpShake(3);
        break;
      case 'upgraded':
        parts.burst(e.tower.x, e.tower.y, INK.yellow, 26, 250, 'star');
        this.towers.get(e.tower.id)?.upgrade();
        this.juice.promote(e.tower);
        fx.text(e.tower.x, e.tower.y - 40, UPGRADE_TITLES[e.tower.type][e.tower.level] ?? '', INK.yellow, 16, 1.2);
        break;
      case 'spawned':
        if (ENEMIES[e.enemy.type].boss) this.juice.bossIntro(e.enemy);
        break;
      case 'sold':
        this.puffs.explode(Math.max(1, Math.round(6 * this.settings.particleScale)), e.tower.x, e.tower.y);
        parts.burst(e.tower.x, e.tower.y, INK.red, 14, 200, 'star');
        fx.text(e.tower.x, e.tower.y - 30, 'Wechselt ins Nachbarteam!', INK.red, 14);
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
        const n = Math.max(1, Math.round((boss ? 14 : 5) * this.settings.particleScale));
        this.puffs.explode(n, e.enemy.x, e.enemy.y);
        parts.burst(e.enemy.x, e.enemy.y, color, boss ? 90 : 14, boss ? 400 : 200, 'circle');
        parts.burst(e.enemy.x, e.enemy.y, INK.yellow, boss ? 30 : 4, boss ? 300 : 160, 'star');
        this.decals.splat(e.enemy.x, e.enemy.y, e.enemy.type, MONSTER_W[e.enemy.type] * 1.3);
        this.juice.kill(e.enemy, this.time_);
        if (boss || Math.random() < 0.3) fx.text(e.enemy.x, e.enemy.y - 24, pick(KILL), INK.neutral, 13, 1);
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
        this.puffs.explode(Math.max(1, Math.round(5 * this.settings.particleScale)), e.enemy.x, e.enemy.y);
        parts.burst(e.enemy.x, e.enemy.y, ENEMIES.story.color, 14, 180, 'circle');
        fx.text(e.enemy.x, e.enemy.y + 16, 'Zerfällt in User Stories!', INK.green, 12, 1);
        break;
      case 'leaked': {
        const last = game.path[game.path.length - 1]!;
        fx.shake = 12;
        fx.flash = 0.25;
        this.puffs.explode(Math.max(1, Math.round(6 * this.settings.particleScale)), Math.min(WIDTH - 20, last.x), last.y);
        fx.text(WIDTH - 120, last.y - 20, `${pick(LEAK)} -${e.damage}%`, INK.red, 16, 1.5);
        break;
      }
      case 'gameOver':
        parts.burst(WIDTH / 2, HEIGHT / 2, INK.red, 200, 600, 'circle');
        parts.burst(WIDTH / 2, HEIGHT / 2, INK.grey, 30, 120, 'smoke');
        for (const v of this.towers.values()) v.despair();
        fx.shake = 40;
        if (this.ctx.filters && !this.desat) {
          this.desat = this.cameras.main.filters.internal.addColorMatrix();
          this.desatT = 0;
          registerFilter(this, 'camera', 'ColorMatrix');
        }
        break;
      case 'waveCleared': {
        this.banner.show(`SPRINT-REVIEW BESTANDEN! Kapazität +${e.bonus} SP`, INK.green, 22, 1.6, 0xc8e6c9);
        this.life.print(this.board);
        let i = 0;
        for (const v of this.towers.values()) this.time.delayedCall((i++ % 12) * 40, () => v.cheer(1.1));
        break;
      }
      case 'victory': {
        this.banner.hide();
        for (const v of this.towers.values()) v.cheer(600);
        const colors = [INK.green, INK.yellow, INK.pink, INK.cyan, TOWERS.dev.color, TOWERS.ppl.color];
        for (let i = 0; i < 8; i++) {
          const x = 120 + i * 100;
          parts.burst(x, HEIGHT / 2 - 60 + (i % 2) * 80, colors[i % colors.length]!, 40, 500, i % 2 ? 'star' : 'circle');
        }
        fx.text(WIDTH / 2, 70, `Moral-Bonus +${e.bonus}`, INK.green, 24, 2.5);
        break;
      }
      case 'jammed':
        fx.text(e.enemy.x, e.enemy.y - 34, e.enemy.type === 'meeting' ? 'Kurzer Sync?' : pick(JAM), INK.grey, 12, 1.2);
        fx.ring(e.enemy.x, e.enemy.y, e.radius, INK.grey);
        parts.burst(e.enemy.x, e.enemy.y, INK.grey, 10, 70, 'smoke');
        for (const id of e.towerIds) {
          const t = game.towerById(id);
          if (!t) continue;
          if (e.enemy.type === 'meeting') this.s2.bubble(t.x, t.y - 52, 'Termin!', '#1565c0', 1.2);
          else parts.burst(t.x, t.y - 20, INK.grey, 5, 50, 'smoke');
        }
        break;
      case 'synced':
        this.s2.sync(e.tower, e.radius, e.towerIds.map((id) => game.towerById(id)).filter((t): t is NonNullable<typeof t> => !!t));
        this.towers.get(e.tower.id)?.fire();
        break;
      case 'businessValue':
        this.s2.coins(e.tower, e.amount);
        this.towers.get(e.tower.id)?.fire();
        break;
      case 'freeze':
        this.banner.show('BUDGET-FREEZE! Alles steht still.', '#0277bd', 26, 1.4, 0xe1f5fe);
        this.towers.get(e.tower.id)?.fire();
        parts.burst(e.tower.x, e.tower.y, '#4fc3f7', 30, 300, 'star');
        fx.bumpShake(6);
        break;
      case 'axed':
        this.towers.get(e.tower.id)?.fire();
        fx.text(e.enemy.x, e.enemy.y - 40, 'Projekt eingestampft!', INK.red, 16, 1.4);
        this.s2.shred(e.enemy, () => parts.burst(e.enemy.x, e.enemy.y, INK.neutral, 16, 200, 'dirt'));
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
        fx.ring(e.enemy.x, e.enemy.y, 26, INK.purple);
        parts.burst(e.enemy.x, e.enemy.y, TOWERS.scrum.color, 8, 160, 'spark');
        fx.text(e.enemy.x, e.enemy.y - 30, e.enemy.type === 'boss' ? 'Hmm, nochmal schätzen…' : 'Zurück ins Refinement!', INK.purple, 12, 1);
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
    this.decals.update(dt);
    this.s2.update(dt, this.time_, this.ctl.game);
    this.juice.update(s.enemies, this.time_);
    this.life.update(dt, this.time_, this.ctl.game, this.board, this.towers, this.s2);
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
    const actors = this.layers.actors;

    const seenT = new Set<number>();
    for (const t of s.towers) {
      seenT.add(t.id);
      let v = this.towers.get(t.id);
      if (!v) {
        v = new WorkstationView(this.ctx, t);
        this.towers.set(t.id, v);
        actors.add(v.root);
        this.board.setOccupied(t.cx, t.cy, true);
      }
      v.update(dt, this.time_, t.targetId !== null ? (enemyPos.get(t.targetId) ?? null) : null);
      v.root.setDepth(v.depthY);
      if (t.beam) this.sfx.laser();
      // RTA hat kein eigenes Ereignis: zeigt alle ~1,6 s auf den Bauplan, solange Gegner im Runway sind
      if (t.type === 'rta' && this.time_ - (this.rtaPose.get(t.id) ?? 0) > 1.6) {
        const r = TOWERS.rta.range * (1 + 0.1 * (t.level - 1));
        if (s.enemies.some((e) => (e.x - t.x) ** 2 + (e.y - t.y) ** 2 <= r * r)) {
          this.rtaPose.set(t.id, this.time_);
          v.fire();
        }
      }
    }
    for (const [id, v] of this.towers) {
      if (!seenT.has(id)) {
        this.board.setOccupied(v.tower.cx, v.tower.cy, false);
        v.destroy();
        this.towers.delete(id);
      }
    }

    const seenE = new Set<number>();
    for (const e of s.enemies) {
      if (e.hp <= 0) continue;
      seenE.add(e.id);
      let v = this.enemies.get(e.id);
      if (!v) {
        v = new MonsterView(this.ctx, e, this.layers.enemyUi);
        this.enemies.set(e.id, v);
        actors.add(v.root);
      }
      v.update(dt, this.time_);
      v.root.setDepth(v.depthY);
    }
    prune(this.enemies, seenE);
    // Tiefe: wer weiter unten steht, wird später gezeichnet
    actors.sort('depth');
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
        const pulse = this.settings.reducedMotion ? 0 : Math.sin(this.time_ * 2 + t.id) * 4;
        g.fillStyle(0xffd54f, 0.08).fillCircle(t.x, t.y, aura + pulse);
        g.lineStyle(2, 0xf9a825, 0.4);
        dashedCircle(g, t.x, t.y, aura + pulse, 5, 7, this.time_ * 10);
      }
      if (t.id === this.ctl.selectedTowerId) {
        g.fillStyle(0x1565c0, 0.06).fillCircle(t.x, t.y, stats.range);
        g.lineStyle(2, 0x1565c0, 0.8);
        dashedCircle(g, t.x, t.y, stats.range, 6, 6, this.time_ * 20);
      }
      const target = t.beam && t.targetId !== null ? byId.get(t.targetId) : undefined;
      if (target) {
        this.effectCounts.beam = (this.effectCounts.beam ?? 0) + 1;
        const sx = t.x;
        const sy = t.y - 8;
        const tx = target.x;
        const ty = target.y - 4;
        const flick = this.settings.reducedMotion ? 1 : 0.85 + Math.random() * 0.3;
        b.lineStyle((12 + t.level * 3) * flick, 0xd81b60, 0.18).lineBetween(sx, sy, tx, ty);
        b.lineStyle((5 + t.level) * flick, 0xff4f9a, 0.45).lineBetween(sx, sy, tx, ty);
        b.lineStyle(2, 0xffffff, 0.9).lineBetween(sx, sy, tx, ty);
        b.fillStyle(0xff80ab, 0.5).fillCircle(tx, ty, (8 + t.level * 2) * flick);
        if (Math.random() < 0.3 * this.settings.particleScale) {
          const f = Math.random();
          this.codeFx.explode(1, sx + (tx - sx) * f, sy + (ty - sy) * f);
        }
      }
      if (stats.boosted && !off) {
        g.lineStyle(2.5, 0xffca28, 0.9).strokeEllipse(t.x, t.y + 15, 44, 16);
      }
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
        const size = SHOT_SIZE[s.towerType] ?? 14;
        img = this.add.image(s.x, s.y, ATLAS, SHOT_FRAME[s.towerType] ?? 'item/cup').setDisplaySize(size, size);
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
