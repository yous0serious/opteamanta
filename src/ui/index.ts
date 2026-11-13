// Shell-UI (Spec campaigns „Oberfläche“): Hauptmenü, Kampagne, Briefing, Ergebnis, Skilltree, Ranglisten, Erfolge.
// Einstieg für die Integration: `mountShell(meta, host, sound, opts)` aus src/main.ts.
import './shell.css';
import type { GameHost, MetaService, RunSummary, RunVerdict } from '../meta/types';
import type { EngineUiSound, LastRun, Screen, ScreenFactory, ShellCtx, ShellOptions, UiSound, UiSoundName } from './context';
import { confirmDialog } from './dialogs';
import { h, reducedMotion, svg } from './dom';
import { I } from './icons';
import { parseRoute, Router, type Route, type RouteName } from './router';
import { achievementsScreen } from './screens/achievements';
import { briefingScreen } from './screens/briefing';
import { campaignScreen } from './screens/campaign';
import { freeScreen } from './screens/free';
import { menuScreen } from './screens/menu';
import { ranksScreen } from './screens/ranks';
import { resultsScreen } from './screens/results';
import { skillsScreen } from './screens/skills';

export type { ShellOptions, UiSound, UiSoundName } from './context';
export type { Route, RouteName } from './router';

export interface ShellHandle {
  router: Router;
  go(route: Route | RouteName, opts?: { replace?: boolean }): void;
  /** Ergebnis-Screen direkt zeigen (normalerweise über `host.onFinished`). */
  showResults(summary: RunSummary, verdict: Promise<RunVerdict>): void;
  /** Ist gerade ein Shell-Screen (nicht das Spiel) sichtbar? */
  readonly open: boolean;
  /** Shell entfernen (Listener, has-shell-Klasse); danach ist das Spiel wieder allein. */
  unmount(): void;
}

/** `?shell=mock` (nur Entwicklung): Shell mit Mock-Diensten; echte `mountShell`-Aufrufe werden dann ignoriert. */
export const SHELL_MOCK = import.meta.env.DEV && new URLSearchParams(location.search).get('shell') === 'mock';

const SCREENS: Record<Exclude<RouteName, 'play' | 'settings'>, ScreenFactory> = {
  menu: menuScreen,
  campaign: campaignScreen,
  briefing: briefingScreen,
  results: resultsScreen,
  skills: skillsScreen,
  ranks: ranksScreen,
  achievements: achievementsScreen,
  free: freeScreen,
};

/** Spielseite (Kopf, Spielfeld, Seitenleiste, Ticker) – bei offener Shell `inert`. */
const GAME_PARTS = ['top', 'wrap', 'ticker', 'rotate-tip'];
const BASE_TITLE = 'BACKLOG DEFENSE 3000';

const SOUND_MAP: Record<UiSoundName, EngineUiSound> = {
  click: 'click',
  hover: 'hover',
  open: 'open',
  back: 'back',
  star: 'star',
  xp: 'xp-tick',
  levelup: 'levelup',
  unlock: 'levelup',
  error: 'back',
  achievement: 'star',
  start: 'open',
};

let mounted: ShellHandle | null = null;

export function mountShell(meta: MetaService, host: GameHost, sound: UiSound, opts: ShellOptions = {}, _mock = false): ShellHandle {
  if (mounted) return mounted;
  if (SHELL_MOCK && !_mock) {
    // Mock-Modus: Aufrufe der echten Integration landen bei der Mock-Shell (montiert über src/ui/dev/entry.ts)
    return {
      get router() {
        return mounted!.router;
      },
      go: (r, o) => mounted?.go(r, o),
      showResults: (s, v) => mounted?.showResults(s, v),
      unmount: () => mounted?.unmount(),
      get open() {
        return mounted?.open ?? true;
      },
    };
  }
  const root = document.getElementById('shell') ?? document.body.appendChild(h('div', { id: 'shell' }));
  document.documentElement.classList.add('has-shell');
  root.hidden = false;
  const stage = h('div', { class: 'sh-stage' });
  const toasts = h('div', { class: 'sh-toasts', role: 'status', 'aria-live': 'polite' });
  root.replaceChildren(stage, toasts);

  const initial = typeof opts.initialRoute === 'string' ? { name: opts.initialRoute } : opts.initialRoute;
  let start: Route = initial ?? parseRoute(location.hash) ?? { name: 'menu' };
  // Ohne laufendes Spiel/Ergebnis führen #/play und #/results ins Menü
  if (!initial && (start.name === 'play' || start.name === 'results')) start = { name: 'menu' };
  const router = new Router(start);

  const ctx: ShellCtx = {
    meta,
    host,
    sound,
    router,
    opts,
    lastRun: null,
    snd: (name) => {
      try {
        if (name !== 'hover') sound.start();
        sound.ui?.(SOUND_MAP[name]);
      } catch {
        // Ton ist optional
      }
    },
    toast: (text, kind = 'info', icon) => {
      const t = h('div', { class: `sh-toast ${kind}` }, svg(icon ?? (kind === 'err' ? I.info : kind === 'ok' ? I.check : I.info)), h('span', { text }));
      toasts.append(t);
      setTimeout(() => t.classList.add('out'), 3600);
      setTimeout(() => t.remove(), 4000);
    },
    confirm: confirmDialog,
    openSettings: () => {
      ctx.snd('open');
      if (opts.openSettings) return opts.openSettings();
      const gear = document.getElementById('open-settings');
      if (gear) gear.click();
      else document.querySelector<HTMLDialogElement>('#settings-dialog')?.showModal();
    },
    launch: async (startRun) => {
      try {
        await startRun();
        router.go({ name: 'play' }, { force: true });
      } catch (err) {
        ctx.snd('error');
        ctx.toast(err instanceof Error && err.message ? `Start fehlgeschlagen: ${err.message}` : 'Start fehlgeschlagen.', 'err');
      }
    },
  };

  let screen: Screen | null = null;
  let screenRoute: Route | null = null;

  const setOpen = (open: boolean): void => {
    document.documentElement.classList.toggle('shell-open', open);
    root.hidden = !open;
    for (const id of GAME_PARTS) {
      const el = document.getElementById(id);
      if (el) el.inert = open;
    }
  };

  const show = (to: Route, from: Route | null): void => {
    document.documentElement.dataset.route = to.name;
    opts.onRoute?.(to, from);
    if (to.name === 'settings') {
      router.go({ name: 'menu' }, { replace: true });
      ctx.openSettings();
      return;
    }
    if (to.name === 'play') {
      disposeScreen();
      setOpen(false);
      document.title = BASE_TITLE;
      // Fokus zurück ins Spiel (Tastatur 1–9, Leertaste)
      (document.activeElement as HTMLElement | null)?.blur?.();
      return;
    }
    if (from?.name === 'play' && to.name !== 'results') host.quit();
    setOpen(true);
    if (screen && screenRoute?.name === to.name && screen.update?.(to)) {
      screenRoute = to;
      return;
    }
    const next = SCREENS[to.name](ctx, to);
    const old = screen;
    old?.dispose?.();
    screen = next;
    screenRoute = to;
    document.title = `${next.title} · ${BASE_TITLE}`;
    const prevEls = [...stage.children].filter((e): e is HTMLElement => e instanceof HTMLElement && !e.classList.contains('leave'));
    next.el.classList.add('enter');
    stage.append(next.el);
    stage.scrollTop = 0;
    root.scrollTop = 0;
    for (const oldEl of prevEls) {
      if (reducedMotion()) oldEl.remove();
      else {
        oldEl.classList.add('leave');
        oldEl.inert = true;
        setTimeout(() => oldEl.remove(), 220);
      }
    }
    requestAnimationFrame(() => {
      next.el.classList.remove('enter');
      const f = next.focus ?? next.el.querySelector<HTMLElement>('h1[tabindex]');
      f?.focus({ preventScroll: true });
    });
  };

  const disposeScreen = (): void => {
    screen?.dispose?.();
    screen = null;
    screenRoute = null;
    for (const el of [...stage.children]) el.remove();
  };

  // Laufendes Spiel verlassen: nachfragen
  router.guard = (to, from) => {
    if (from.name !== 'play' || to.name === 'play' || to.name === 'results' || !opts.runActive?.()) return true;
    void confirmDialog('Lauf verlassen?', 'Der aktuelle Lauf wird abgebrochen und nicht gewertet.', 'Verlassen', 'Weiterspielen').then((ok) => {
      if (!ok) return;
      router.go(to, { force: true });
    });
    return false;
  };

  router.onChange(show);

  host.onFinished((summary, verdict) => {
    const run: LastRun = { summary, verdict, resolved: null };
    ctx.lastRun = run;
    const token = opts.currentRun?.();
    void verdict.then((v) => (run.resolved = v)).catch(() => undefined);
    setTimeout(() => {
      // Wurde inzwischen ein neuer Lauf gestartet (Leertaste/„Nochmal“), bleibt das Spiel stehen
      if (opts.currentRun && opts.currentRun() !== token) return;
      if (router.current.name === 'play' && ctx.lastRun === run) router.go({ name: 'results' }, { replace: true, force: true });
    }, opts.resultsDelayMs ?? 1400);
  });

  // Kopfzeile im Spiel: „Menü“-Knopf
  const toMenu = (): void => {
    ctx.snd('back');
    router.go({ name: 'menu' });
  };
  document.getElementById('to-menu')?.addEventListener('click', toMenu);

  // Esc auf Shell-Screens: zurück (nicht bei offenen Dialogen)
  const onKey = (ev: KeyboardEvent): void => {
    if (ev.key !== 'Escape' || router.current.name === 'play' || router.current.name === 'menu') return;
    if (document.querySelector('dialog[open]') || document.querySelector('.levelup')) return;
    if (ev.target instanceof HTMLSelectElement) return;
    ev.preventDefault();
    ctx.snd('back');
    router.back(router.current.name === 'briefing' ? { name: 'campaign' } : { name: 'menu' });
  };
  window.addEventListener('keydown', onKey);

  // Hover-Klang (nur Maus) beim Wechsel auf einen anderen Knopf
  let hovered: Element | null = null;
  root.addEventListener('pointerover', (ev) => {
    if (ev.pointerType !== 'mouse') return;
    const b = (ev.target as Element).closest('button:not(:disabled), a[href]');
    if (b === hovered) return;
    hovered = b;
    if (b) ctx.snd('hover');
  });

  show(start, null);

  mounted = {
    router,
    unmount: () => {
      disposeScreen();
      setOpen(false);
      root.hidden = true;
      root.replaceChildren();
      window.removeEventListener('keydown', onKey);
      document.getElementById('to-menu')?.removeEventListener('click', toMenu);
      router.dispose();
      document.documentElement.classList.remove('has-shell', 'shell-open');
      delete document.documentElement.dataset.route;
      mounted = null;
    },
    go: (r, o) => router.go(typeof r === 'string' ? { name: r } : r, { ...o, force: true }),
    showResults: (summary, verdict) => {
      ctx.lastRun = { summary, verdict, resolved: null };
      router.go({ name: 'results' }, { force: true });
    },
    get open() {
      return router.current.name !== 'play';
    },
  };
  return mounted;
}
