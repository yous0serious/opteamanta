import type { GameHost, MetaService, RunSummary, RunVerdict } from '../meta/types';
import type { Route, RouteName, Router } from './router';

/** Semantische UI-Klänge der Shell; `index.ts` bildet sie auf die Klänge der SoundEngine ab. */
export type UiSoundName = 'click' | 'hover' | 'open' | 'back' | 'star' | 'xp' | 'levelup' | 'unlock' | 'error' | 'achievement' | 'start';
/** Klänge der SoundEngine (Agent B: `SoundEngine.ui(name)`). */
export type EngineUiSound = 'click' | 'hover' | 'open' | 'back' | 'star' | 'levelup' | 'xp-tick';

export interface UiSound {
  start(): void;
  ui?(name: EngineUiSound): void;
}

export interface ShellOptions {
  /** Startroute (z. B. `'play'` bei Deep Links `?map=…&seed=…`); sonst aus dem Hash, sonst Hauptmenü. */
  initialRoute?: Route | RouteName;
  /** Einstellungen öffnen (Standard: vorhandenen `#settings-dialog` über `#open-settings`). */
  openSettings?: () => void;
  /** Bild des Spielfelds für die Teilen-Karte. */
  snapshot?: () => Promise<CanvasImageSource | null>;
  /** Läuft gerade ein begonnenes, nicht beendetes Spiel? (Verlassen fragt dann nach.) */
  runActive?: () => boolean;
  /** Identität des aktuellen Spiels; ändert sie sich nach Spielende, entfällt der Sprung zum Ergebnis. */
  currentRun?: () => unknown;
  /** Verzögerung zwischen Spielende und Ergebnis-Screen (ms, Standard 1400). */
  resultsDelayMs?: number;
  /** Wird bei jedem Routenwechsel aufgerufen (z. B. Musik, Pause). */
  onRoute?: (to: Route, from: Route | null) => void;
}

export interface LastRun {
  summary: RunSummary;
  verdict: Promise<RunVerdict>;
  /** Aufgelöstes Urteil (sobald da). */
  resolved: RunVerdict | null;
}

export interface ShellCtx {
  meta: MetaService;
  host: GameHost;
  sound: UiSound;
  router: Router;
  opts: ShellOptions;
  lastRun: LastRun | null;
  snd(name: UiSoundName): void;
  toast(text: string, kind?: 'info' | 'ok' | 'err' | 'achievement', icon?: string): void;
  confirm(title: string, text: string, ok: string, cancel?: string): Promise<boolean>;
  openSettings(): void;
  /** Spiel starten und auf `#/play` wechseln (Fehler → Toast). */
  launch(start: () => Promise<void> | void): Promise<void>;
}

export interface Screen {
  el: HTMLElement;
  /** Dokumenttitel-Zusatz. */
  title: string;
  /** Element, das nach dem Wechsel den Fokus bekommt (Standard: Überschrift). */
  focus?: HTMLElement;
  /** Wechsel innerhalb desselben Screens (z. B. Tab per `replace`); true = Screen bleibt, kein Neuaufbau. */
  update?(route: Route): boolean;
  dispose?(): void;
}

export type ScreenFactory = (ctx: ShellCtx, route: Route) => Screen;
