import Phaser from 'phaser';
import { ENEMIES, HEIGHT, TILE, TOWERS, WIDTH, type Game, type SimEvent } from '../sim/index';
import type { SoundEngine } from './audio';
import type { Controller, DebugApi } from './controller';
import type { FxSettings } from './fx';
import { activeFilters, createLayers, type Layers } from './layers';
import { DonePile } from './logic/donePile';
import { Board } from './render/board';
import { dashedCircle, dashedPolyline, hex } from './render/draw';
import { Effects } from './render/effects';
import { EnemyView, TowerView } from './render/entities';
import { PileView } from './render/pile';
import { ABSENT, HAND, INK, JAM, KILL, LEAK, SPRINTS, UPGRADE_TITLES, pick, piLabel } from './texts';

const EMOJI_FONT = 'serif';
/** Caveat läuft kleiner als die alte Systemschrift – Textgrößen aus Spec 1 werden skaliert. */
const HAND_SCALE = 1.3;
/** DONE-Haufen: Spalte DONE unten (Spec visual-overhaul T04). */
const PILE_AREA = { x: 720, y: 470, w: 240, h: 130 };
const PILE_MAX = 60;

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
  private under!: Phaser.GameObjects.Graphics;
  private shotsG!: Phaser.GameObjects.Graphics;
  private particlesG!: Phaser.GameObjects.Graphics;
  private pileView!: PileView;
  private flashRect!: Phaser.GameObjects.Rectangle;
  private overLayer!: Phaser.GameObjects.Container;
  private overStats!: Phaser.GameObjects.Text;
  private hint!: Phaser.GameObjects.Text;

  private readonly fx = new Effects();
  private readonly towers = new Map<number, TowerView>();
  private readonly enemies = new Map<number, EnemyView>();
  private readonly trails = new Map<number, Array<[number, number]>>();
  private readonly pins = new Map<number, Phaser.GameObjects.Text>();
  private readonly floatTexts = new Map<number, Phaser.GameObjects.Text>();
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
    this.layers = createLayers(this, this.settings);
    this.under = this.add.graphics();
    this.shotsG = this.add.graphics();
    this.particlesG = this.add.graphics();
    this.layers.under.add(this.under);
    this.layers.shots.add(this.shotsG);
    this.layers.particles.add(this.particlesG);

    this.flashRect = this.add.rectangle(0, 0, WIDTH, HEIGHT, 0xc62828, 0).setOrigin(0);
    this.buildGameOver();
    this.hint = this.add
      .text(WIDTH / 2, HEIGHT - 28, 'Klick irgendwo oder drück 1–5 → Turm wählen · LEERTASTE → Sprint starten', {
        fontFamily: HAND, fontSize: '26px', fontStyle: 'bold', color: '#1565c0', stroke: '#ffffff', strokeThickness: 5, resolution: 2,
      })
      .setOrigin(0.5);
    this.layers.overlay.add([this.flashRect, this.overLayer, this.hint]);

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
    this.board.destroy();
    this.pileView.clear();
    for (const v of this.towers.values()) v.destroy();
    for (const v of this.enemies.values()) v.destroy();
    for (const t of this.pins.values()) t.destroy();
    for (const t of this.floatTexts.values()) t.destroy();
    this.towers.clear();
    this.enemies.clear();
    this.pins.clear();
    this.floatTexts.clear();
    this.trails.clear();
    this.fx.clear();
    this.buildBoard(game);
  }

  private buildGameOver(): void {
    const bg = this.add.rectangle(0, 0, WIDTH, HEIGHT, 0xfbfbf7, 0.88).setOrigin(0);
    const stamp = this.add.graphics();
    stamp.lineStyle(6, 0xc62828, 1).strokeRect(-210, -55, 420, 110);
    const title = this.add.text(0, 4, 'BURNOUT!', { fontFamily: HAND, fontSize: '84px', fontStyle: 'bold', color: '#c62828', resolution: 2 }).setOrigin(0.5);
    const box = this.add.container(WIDTH / 2, HEIGHT / 2 - 70, [stamp, title]).setRotation(-0.1);
    const style = { fontFamily: HAND, fontSize: '26px', fontStyle: 'bold', color: '#37474f', resolution: 2 };
    const l1 = this.add.text(WIDTH / 2, HEIGHT / 2 + 30, 'Team-Moral: 0%. Das Programm wird in „Phase 2“ umbenannt.', style).setOrigin(0.5);
    this.overStats = this.add.text(WIDTH / 2, HEIGHT / 2 + 64, '', style).setOrigin(0.5);
    const l3 = this.add
      .text(WIDTH / 2, HEIGHT / 2 + 108, '[Leertaste] Neues Programm aufsetzen (gleiche Leute, neuer Projektname)', { ...style, color: '#1565c0' })
      .setOrigin(0.5);
    this.overLayer = this.add.container(0, 0, [bg, box, l1, this.overStats, l3]).setVisible(false);
  }

  // ===================== Sim-Events → Effekte =====================

  private onSim(e: SimEvent): void {
    const fx = this.fx;
    const game = this.ctl.game;
    switch (e.type) {
      case 'placed':
        fx.boom(e.tower.x, e.tower.y, TOWERS[e.tower.type].color, 30, 150);
        fx.bumpShake(4);
        break;
      case 'upgraded':
        fx.boom(e.tower.x, e.tower.y, INK.yellow, 40, 250);
        fx.text(e.tower.x, e.tower.y - 20, UPGRADE_TITLES[e.tower.type][e.tower.level] ?? '', INK.yellow, 16, 1.2);
        break;
      case 'sold':
        fx.boom(e.tower.x, e.tower.y, INK.red, 30);
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
        if (e.boss) fx.text(WIDTH / 2, HEIGHT / 2, '⚠ PIP! Der Business Owner bringt ein MEGA-OBJECTIVE ⚠', INK.red, 28, 3);
        else if (e.pip) fx.text(WIDTH / 2, HEIGHT / 2, 'PIP – Produkt-Inkrement Planning! Objectives & Features im Anflug', INK.pink, 24, 2.5);
        else fx.text(WIDTH / 2, HEIGHT / 2, `${piLabel(e.wave)}: ${SPRINTS[e.wave % SPRINTS.length]}`, INK.pink, 30, 2);
        break;
      case 'killed': {
        const boss = e.enemy.type === 'boss';
        const color = ENEMIES[e.enemy.type].color;
        fx.boom(e.enemy.x, e.enemy.y, color, boss ? 150 : 25, boss ? 400 : 200);
        fx.text(e.enemy.x, e.enemy.y - 10, pick(KILL), INK.neutral, 13, 1);
        this.pileView.land(this.pileView.pile.add(e.enemy.type));
        if (boss) {
          fx.shake = 25;
          fx.flash = 0.5;
          fx.text(WIDTH / 2, HEIGHT / 2 - 40, 'PI-OBJECTIVE ERREICHT! (Business Value: 3 von 10)', INK.green, 30, 2.5);
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
        fx.boom(WIDTH / 2, HEIGHT / 2, INK.red, 400, 600);
        fx.shake = 40;
        break;
      case 'waveCleared':
        fx.text(WIDTH / 2, HEIGHT / 2, `SPRINT-REVIEW BESTANDEN! Kapazität +${e.bonus} SP`, INK.green, 22, 2.5);
        break;
      case 'jammed':
        fx.text(e.enemy.x, e.enemy.y - 24, pick(JAM), INK.grey, 12, 1.2);
        fx.ring(e.enemy.x, e.enemy.y, e.radius, INK.grey);
        break;
      case 'absent':
        fx.text(e.tower.x, e.tower.y - 22, pick(ABSENT), INK.cyan, 12, 1);
        break;
      case 'splash':
        fx.boom(e.x, e.y, INK.yellow, 35, 250);
        fx.bumpShake(6);
        fx.ring(e.x, e.y, e.radius, INK.yellow);
        break;
      case 'hit':
        if (e.enemyId !== null) fx.boom(e.shot.tx, e.shot.ty, TOWERS[e.shot.towerType].color, 5, 100);
        break;
      case 'pushed':
        fx.text(e.enemy.x, e.enemy.y - 18, e.enemy.type === 'boss' ? 'Hmm, nochmal schätzen…' : 'Zurück ins Refinement!', INK.purple, 12, 1);
        break;
      default:
        break;
    }
  }

  // ===================== Frame =====================

  override update(_time: number, delta: number): void {
    const dt = delta / 1000;
    this.time_ += dt;
    this.ctl.advance(dt);
    const s = this.ctl.game.state;

    this.fx.update(s.over ? dt * 0.3 : dt);
    this.board.update(this.time_, dt);
    this.syncEntities(dt);
    this.drawUnder();
    this.drawShots();
    this.drawParticles();
    this.drawTexts();

    const shake = this.settings.reducedMotion ? 0 : this.fx.shake;
    if (shake > 0.5) this.layers.world.setPosition((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    else this.layers.world.setPosition(0, 0);
    this.flashRect.setFillStyle(0xc62828, this.fx.flash * 0.35);

    if (s.over && !this.overLayer.visible) this.overStats.setText(`Geschafft bis: ${piLabel(s.wave)} · Score: ${s.score}`);
    this.overLayer.setVisible(s.over);
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
        v = new TowerView(this, t);
        this.towers.set(t.id, v);
        this.layers.towers.add(v.root);
      }
      v.update(t.targetId !== null ? (enemyPos.get(t.targetId) ?? null) : null);
      if (t.beam) {
        this.sfx.laser();
        const target = t.targetId !== null ? enemyPos.get(t.targetId) : undefined;
        if (target && Math.random() < 0.3) this.fx.boom(target.x, target.y, INK.pink, 1, 80);
      }
    }
    prune(this.towers, seenT);

    const seenE = new Set<number>();
    for (const e of s.enemies) {
      if (e.hp <= 0) continue;
      seenE.add(e.id);
      let v = this.enemies.get(e.id);
      if (!v) {
        v = new EnemyView(this, e, this.layers.enemyUi);
        this.enemies.set(e.id, v);
        this.layers.enemies.add(v.root);
      }
      v.update(dt);
    }
    prune(this.enemies, seenE);
  }

  /** Vorschau, Aura, Auswahl, Strahlen, Boost-Ringe. */
  private drawUnder(): void {
    const game = this.ctl.game;
    const g = this.under;
    g.clear();
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
        g.lineStyle(8 + t.level * 2, 0xd81b60, 0.22).lineBetween(t.x, t.y, target.x, target.y);
        g.lineStyle(2, 0xd81b60, 1);
        dashedPolyline(g, [t, target], 6, 4, -this.time_ * 80);
      }
      if (stats.boosted && !off) g.lineStyle(3, 0xf9a825, 1).strokeCircle(t.x, t.y, 21);
    }
  }

  private drawShots(): void {
    const g = this.shotsG;
    g.clear();
    const seen = new Set<number>();
    for (const s of this.ctl.game.state.shots) {
      seen.add(s.id);
      const color = hex(TOWERS[s.towerType].color);
      const trail = this.trails.get(s.id) ?? [];
      trail.push([s.x, s.y]);
      if (trail.length > 6) trail.shift();
      this.trails.set(s.id, trail);
      if (trail.length > 1) {
        g.lineStyle(2, color, 0.4);
        g.beginPath();
        trail.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
        g.strokePath();
      }
      if (s.towerType === 'ppl') {
        let pin = this.pins.get(s.id);
        if (!pin) {
          pin = this.add.text(0, 0, '📌', { fontFamily: EMOJI_FONT, fontSize: '16px', resolution: 2 }).setOrigin(0.5);
          this.pins.set(s.id, pin);
          this.layers.shots.add(pin);
        }
        pin.setPosition(s.x, s.y);
      } else g.fillStyle(color, 1).fillCircle(s.x, s.y, 4);
    }
    for (const id of [...this.trails.keys()]) if (!seen.has(id)) this.trails.delete(id);
    prune(this.pins, seen);
  }

  private drawParticles(): void {
    const g = this.particlesG;
    g.clear();
    for (const p of this.fx.particles) g.fillStyle(hex(p.color), Math.min(1, p.life * 2)).fillRect(p.x - 3, p.y - 2, 6, 4);
    for (const r of this.fx.rings) {
      g.lineStyle(2, hex(r.color), Math.min(1, r.life * 2));
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
