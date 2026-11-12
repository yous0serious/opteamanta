import { DT, Game, TILE, type Command, type GameMode, type MapId, type Replay, type SimEvent, type TowerType } from '../sim/index';
import type { DailySession } from '../online/api';

type Listener<T> = (value: T) => void;

/** Debug-Abfragen der Darstellung (nur für E2E/Entwicklung, über window.__bd.debug). */
export interface DebugApi {
  filters: () => string[];
  motion: () => { shake: boolean; hitstop: boolean };
  renderer: () => string;
  pile: () => Array<{ x: number; y: number; type: string }>;
  /** Nur Debug: Zugriff auf die Phaser-Szene. */
  scene?: () => unknown;
  /** Aktuelle Pose je Arbeitsplatz (Spec office-makeover AC-4). */
  poses?: () => Array<{ id: number; type: string; level: number; pose: string }>;
  /** Sichtbare Monster mit aktuellem Frame und Anzeigebreite (Spec office-makeover AC-5). */
  monsters?: () => Array<{ id: number; type: string; frame: string; width: number }>;
  /** Anzahl ausgelöster Effekte je Ereignistyp (Spec office-makeover AC-6). */
  effects?: () => Record<string, number>;
  /** Zustand der Audio-Engine (Spec season-2 AC-10). */
  audio?: () => unknown;
  /** Letztes Teilen-Ergebnis (Spec season-2 AC-11). */
  share?: () => unknown;
  /** Aktive Effektstufe (Spec season-2 AC-9). */
  fxLevel?: () => string;
}

/** Höchstens so viele Ticks pro Frame (schützt vor Endlosschleifen nach Tab-Wechsel). */
const MAX_STEPS_PER_FRAME = 120;
/** Frame-Zeit wird auf 0,1 s begrenzt (Original: 0,05 s pro Update × Tempo). */
const MAX_FRAME_DT = 0.1;
export const REPLAY_STORAGE_KEY = 'bd.lastReplay';

/**
 * Einzige Brücke zwischen DOM-HUD, Phaser-Szene und Simulation.
 * Hält Auswahl und Tempo, übersetzt Eingaben in Kommandos und verteilt Sim-Events.
 */
export class Controller {
  game: Game;
  speed: number;
  selected: TowerType | null = null;
  selectedTowerId: number | null = null;
  /** Touch: Feld, auf dem die gewählte Rolle als Vorschau steht (noch nicht platziert). */
  preview: { cx: number; cy: number } | null = null;
  /** Debug-Abfragen der Darstellung (nur für E2E/Entwicklung, über window.__bd). */
  debug: DebugApi | null = null;
  /** Nur Darstellung: Zeitlupe (Spec season-2 AC-7) – ändert das Echtzeit-Tempo, nicht die Ticks/Ergebnisse. */
  timeScale = 1;
  private acc = 0;
  private stopUntil = 0;
  private readonly simListeners = new Set<Listener<SimEvent>>();
  private readonly changeListeners = new Set<Listener<void>>();
  private readonly restartListeners = new Set<Listener<Game>>();

  constructor(
    opts: { seed: number; mapId?: MapId; speed?: number; mode?: GameMode },
    private readonly nextSeed: () => number,
  ) {
    this.mode = opts.mode ?? 'challenge';
    this.mapId = opts.mapId;
    this.game = new Game({ seed: opts.seed, mapId: opts.mapId, mode: this.mode });
    this.speed = opts.speed ?? 1;
  }

  /** Aktueller Spielmodus; gilt auch für Neustarts. */
  mode: GameMode;
  private readonly mapId: MapId | undefined;

  /** Laufende Daily-Session (Spec leaderboard-supabase); null bei freien Spielen. */
  daily: DailySession | null = null;
  private readonly finishedListeners = new Set<Listener<Game>>();

  /** Wird einmal pro Spiel aufgerufen, sobald es endet (Sieg oder Burnout). */
  onFinished(fn: Listener<Game>): () => void {
    this.finishedListeners.add(fn);
    return () => this.finishedListeners.delete(fn);
  }

  /** Daily-Lauf mit Server-Seed starten (Challenge-Modus; die Karte folgt aus dem Seed). */
  startDaily(session: DailySession): void {
    const game = new Game({ seed: session.seed, mode: 'challenge' });
    if (game.state.mapId !== session.mapId) throw new Error(`Karte passt nicht zum Seed: ${session.mapId}`);
    if (this.game.state.wave > 0) this.saveReplay();
    this.daily = session;
    this.mode = 'challenge';
    this.replaceGame(game);
  }

  /** Moduswechsel nur vor dem ersten Sprint (nicht in der Daily): neues Spiel mit demselben Seed. */
  setMode(mode: GameMode): void {
    if (mode === this.mode || this.game.state.wave > 0 || this.daily) return;
    this.mode = mode;
    this.game = new Game({ seed: this.game.state.seed, mapId: this.mapId ?? this.game.state.mapId, mode });
    this.acc = 0;
    this.selected = null;
    this.selectedTowerId = null;
    this.preview = null;
    for (const fn of this.restartListeners) fn(this.game);
    this.changed();
  }

  get over(): boolean {
    return this.game.state.over;
  }

  onSim(fn: Listener<SimEvent>): () => void {
    this.simListeners.add(fn);
    return () => this.simListeners.delete(fn);
  }

  onChange(fn: Listener<void>): () => void {
    this.changeListeners.add(fn);
    return () => this.changeListeners.delete(fn);
  }

  onRestart(fn: Listener<Game>): () => void {
    this.restartListeners.add(fn);
    return () => this.restartListeners.delete(fn);
  }

  command(cmd: Command): SimEvent[] {
    const events = this.game.apply(cmd);
    this.dispatch(events);
    this.changed();
    return events;
  }

  /** Fixed-Step: reale Zeit × Tempo in Ticks à DT umrechnen. */
  advance(realDtSec: number): void {
    if (this.over) return;
    // Hitstop: Darstellung „friert“ kurz ein; die Simulation pausiert nur in Echtzeit, Ticks bleiben gleich.
    if (performance.now() < this.stopUntil) return;
    this.acc += Math.min(realDtSec, MAX_FRAME_DT) * this.speed * this.timeScale;
    let steps = 0;
    while (this.acc >= DT && steps < MAX_STEPS_PER_FRAME) {
      this.acc -= DT;
      steps++;
      this.dispatch(this.game.step());
      if (this.over) {
        this.acc = 0;
        this.saveReplay();
        for (const fn of this.finishedListeners) fn(this.game);
        break;
      }
    }
    if (steps === MAX_STEPS_PER_FRAME) this.acc = 0;
  }

  // ----- Spieleraktionen -----

  /** Button: umschalten; Taste 1–9: immer auswählen (wie Original). */
  selectType(type: TowerType | null, toggle = true): void {
    this.selected = toggle && this.selected === type ? null : type;
    this.selectedTowerId = null;
    // Rollenwechsel behält das vorgemerkte Feld (Touch: erst Platz, dann Rolle vergleichen)
    if (!this.selected) this.preview = null;
    this.changed();
  }

  clearSelection(): void {
    this.selected = null;
    this.selectedTowerId = null;
    this.preview = null;
    this.changed();
  }

  /** Klick aufs Spielfeld in Pixelkoordinaten (Original Zeile 185–192). Rückgabe: Turm ausgewählt? */
  clickBoard(x: number, y: number): 'selectedTower' | 'placed' | 'rejected' | 'cleared' | 'ignored' {
    if (this.over) return 'ignored';
    const cx = Math.floor(x / TILE);
    const cy = Math.floor(y / TILE);
    this.preview = null;
    const tower = this.game.state.towers.find((t) => t.cx === cx && t.cy === cy);
    if (tower) {
      this.selectedTowerId = tower.id;
      this.selected = null;
      this.changed();
      return 'selectedTower';
    }
    if (this.selected) {
      const events = this.command({ type: 'place', tower: this.selected, cx, cy });
      return events.some((e) => e.type === 'rejected') ? 'rejected' : 'placed';
    }
    this.clearSelection();
    return 'cleared';
  }

  /**
   * Touch: Das erste Tippen auf ein Feld zeigt nur die Vorschau (Reichweite, frei/belegt), das zweite Tippen auf dasselbe
   * Feld platziert. Ein Finger verdeckt die Kachel – ohne Bestätigung landen Teammitglieder sonst auf dem falschen Feld.
   */
  tapBoard(x: number, y: number): 'selectedTower' | 'placed' | 'rejected' | 'cleared' | 'ignored' | 'preview' {
    if (this.over) return 'ignored';
    const cx = Math.floor(x / TILE);
    const cy = Math.floor(y / TILE);
    const hasTower = this.game.state.towers.some((t) => t.cx === cx && t.cy === cy);
    const same = this.preview?.cx === cx && this.preview.cy === cy;
    // Ohne gewählte Rolle: Feld vormerken, die Rolle folgt aus der Leiste (zweites Tippen hebt die Markierung auf)
    if (!this.selected && !hasTower) {
      this.preview = same ? null : { cx, cy };
      this.selectedTowerId = null;
      this.changed();
      return same ? 'cleared' : 'preview';
    }
    if (this.selected && !hasTower && !same) {
      this.preview = { cx, cy };
      this.changed();
      return 'preview';
    }
    return this.clickBoard(x, y);
  }

  /** Touch-Vorschau bestätigen (Button „Hier einsetzen“). */
  placePreview(): 'placed' | 'rejected' | 'ignored' {
    if (!this.preview || !this.selected || this.over) return 'ignored';
    const r = this.clickBoard(this.preview.cx * TILE + TILE / 2, this.preview.cy * TILE + TILE / 2);
    return r === 'placed' || r === 'rejected' ? r : 'ignored';
  }

  upgradeSelected(): void {
    if (this.selectedTowerId !== null) this.command({ type: 'upgrade', towerId: this.selectedTowerId });
  }

  sellSelected(): void {
    if (this.selectedTowerId === null) return;
    this.command({ type: 'sell', towerId: this.selectedTowerId });
    this.selectedTowerId = null;
    this.changed();
  }

  /** Leertaste/großer Button nach Spielende: neues Spiel (Daily-Ablauf kann übernehmen, z. B. neuer Daily-Versuch). */
  startOrRestart(): void {
    if (this.over) {
      if (this.restartOverride?.()) return;
      this.restart();
    } else if (!this.game.state.running) this.command({ type: 'startWave' });
  }

  /** Optional: übernimmt den Neustart nach Spielende (true = erledigt). */
  restartOverride: (() => boolean) | null = null;

  cycleSpeed(): void {
    this.speed = this.speed === 1 ? 2 : this.speed === 2 ? 3 : 1;
    this.changed();
  }

  /** Tempo direkt setzen (Einstellungen-Popup); nur 1–3 wie über den Button. */
  setSpeed(n: number): void {
    if (![1, 2, 3].includes(n)) return;
    this.speed = n;
    this.changed();
  }

  /** Kurzer Hitstop (Spec visual-overhaul AC-9): pausiert das Vorrücken der Simulation für `ms` Echtzeit. */
  hitstop(ms: number): void {
    this.stopUntil = performance.now() + ms;
  }

  /** Neues freies Spiel (verlässt eine Daily-Session). */
  restart(): void {
    this.saveReplay();
    this.daily = null;
    this.replaceGame(new Game({ seed: this.nextSeed(), mode: this.mode }));
  }

  /** Freies Spiel im gewünschten Modus starten (Schalter „Freies Spiel“). */
  startFree(mode: GameMode = this.mode): void {
    this.mode = mode;
    this.restart();
  }

  private replaceGame(game: Game): void {
    this.game = game;
    this.acc = 0;
    this.selected = null;
    this.selectedTowerId = null;
    this.preview = null;
    for (const fn of this.restartListeners) fn(this.game);
    this.changed();
  }

  lastReplay(): Replay {
    return this.game.toReplay();
  }

  saveReplay(): void {
    try {
      localStorage.setItem(REPLAY_STORAGE_KEY, JSON.stringify(this.game.toReplay()));
    } catch {
      // Speicher voll oder gesperrt – Replay bleibt über den Download-Button erreichbar.
    }
  }

  private dispatch(events: SimEvent[]): void {
    if (!events.length) return;
    for (const e of events) {
      if (e.type === 'sold' && e.tower.id === this.selectedTowerId) this.selectedTowerId = null;
      for (const fn of this.simListeners) fn(e);
    }
    if (events.some((e) => e.type !== 'fired' && e.type !== 'hit')) this.changed();
  }

  private changed(): void {
    for (const fn of this.changeListeners) fn();
  }
}
