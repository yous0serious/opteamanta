// Hash-Router der Shell (Spec campaigns „Oberfläche“): #/menu, #/campaign[/<id>], #/level/<id>, #/play, #/results,
// #/skills, #/ranks[/<tab>[/<id>]], #/achievements, #/free, #/settings. Browser-Zurück funktioniert (History-Einträge).

export type RouteName = 'menu' | 'campaign' | 'briefing' | 'play' | 'results' | 'skills' | 'ranks' | 'achievements' | 'free' | 'settings';

export interface Route {
  name: RouteName;
  /** Kampagne (`campaign`), Level (`briefing`) oder Ranglisten-Tab (`ranks`). */
  id?: string;
  /** Zweiter Parameter (z. B. Karte/Level bei `ranks`). */
  sub?: string;
}

const NAMES: readonly RouteName[] = ['menu', 'campaign', 'briefing', 'play', 'results', 'skills', 'ranks', 'achievements', 'free', 'settings'];

/** Rücksprung aus dem E-Mail-Login (Supabase: `#access_token=…`, `#error=…`) – nicht anfassen, Supabase liest ihn. */
export function isAuthHash(hash: string): boolean {
  return /^#\/?(access_token|refresh_token|error|error_code)=/.test(hash);
}

export function parseRoute(hash: string): Route | null {
  if (isAuthHash(hash)) return null;
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  const [head, id, sub] = parts;
  if (!head) return null;
  if (head === 'level') return id ? { name: 'briefing', id } : null;
  if (!(NAMES as readonly string[]).includes(head) || head === 'briefing') return null;
  const r: Route = { name: head as RouteName };
  if (id) r.id = id;
  if (sub) r.sub = sub;
  return r;
}

export function formatRoute(r: Route): string {
  const head = r.name === 'briefing' ? 'level' : r.name;
  return `#/${[head, r.id, r.sub].filter((p): p is string => !!p).map(encodeURIComponent).join('/')}`;
}

export const sameRoute = (a: Route, b: Route): boolean => a.name === b.name && a.id === b.id && a.sub === b.sub;

interface HistState {
  bd: number;
}

type Listener = (to: Route, from: Route | null) => void;

/**
 * Router über `history.pushState`. `guard` darf einen Wechsel abfangen (z. B. laufendes Spiel verlassen):
 * Rückgabe false = Route bleibt, der History-Eintrag wird zurückgesetzt.
 */
export class Router {
  current: Route;
  private idx = 0;
  private readonly listeners = new Set<Listener>();
  guard: ((to: Route, from: Route) => boolean) | null = null;
  private readonly onPop: (ev: PopStateEvent) => void;

  constructor(initial: Route) {
    this.current = initial;
    const st = history.state as HistState | null;
    this.idx = typeof st?.bd === 'number' ? st.bd : 0;
    // Login-Rücksprung: URL (Token im Hash) unverändert lassen, nur den Zustand merken
    const keepUrl = isAuthHash(location.hash);
    history.replaceState({ ...(history.state as object | null), bd: this.idx } satisfies HistState, '', keepUrl ? undefined : this.url(initial));
    this.onPop = (ev: PopStateEvent): void => {
      if (isAuthHash(location.hash)) return;
      const to = parseRoute(location.hash) ?? { name: 'menu' };
      const st = ev.state as HistState | null;
      const prevIdx = this.idx;
      if (this.guard && !sameRoute(to, this.current) && !this.guard(to, this.current)) {
        // Zurücknehmen: alten Eintrag wiederherstellen
        history.pushState({ bd: prevIdx } satisfies HistState, '', this.url(this.current));
        this.idx = prevIdx;
        return;
      }
      this.idx = typeof st?.bd === 'number' ? st.bd : 0;
      this.set(to);
    };
    window.addEventListener('popstate', this.onPop);
  }

  dispose(): void {
    window.removeEventListener('popstate', this.onPop);
    this.listeners.clear();
  }

  onChange(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /** Zu einer Route wechseln (neuer History-Eintrag; `replace` ersetzt den aktuellen). `force` umgeht den Guard. */
  go(to: Route, opts: { replace?: boolean; force?: boolean } = {}): void {
    if (sameRoute(to, this.current)) {
      this.emit(to, this.current);
      return;
    }
    if (!opts.force && this.guard && !this.guard(to, this.current)) return;
    if (opts.replace) history.replaceState({ bd: this.idx } satisfies HistState, '', this.url(to));
    else history.pushState({ bd: ++this.idx } satisfies HistState, '', this.url(to));
    this.set(to);
  }

  /** Zurück im Verlauf, sofern es einen Shell-Eintrag gibt; sonst zur `fallback`-Route. */
  back(fallback: Route = { name: 'menu' }): void {
    if (this.idx > 0) history.back();
    else this.go(fallback, { replace: true });
  }

  private set(to: Route): void {
    const from = this.current;
    this.current = to;
    this.emit(to, from);
  }

  private emit(to: Route, from: Route | null): void {
    for (const fn of this.listeners) fn(to, from);
  }

  private url(r: Route): string {
    return `${location.pathname}${location.search}${formatRoute(r)}`;
  }
}
