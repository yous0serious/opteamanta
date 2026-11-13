// Kleine DOM-Helfer für die Shell (keine Abhängigkeiten).

type Child = Node | string | number | null | undefined | false;
type Props = Record<string, unknown>;

/**
 * Element erzeugen. `class`, `text`, `html` (nur statisches SVG/Markup!), `on<Event>`-Handler, `data`-Objekt;
 * `true` setzt ein leeres Attribut, `false`/`null`/`undefined` lässt es weg.
 */
export function h<K extends keyof HTMLElementTagNameMap>(tag: K, props: Props | null = null, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v === false || v === null || v === undefined) continue;
      if (k === 'class') el.className = String(v);
      else if (k === 'text') el.textContent = String(v);
      else if (k === 'html') el.innerHTML = String(v);
      else if (k === 'data') for (const [dk, dv] of Object.entries(v as Record<string, string>)) el.dataset[dk] = dv;
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v as EventListener);
      else el.setAttribute(k, v === true ? '' : String(v));
    }
  }
  append(el, ...children);
  return el;
}

export function append(el: Element, ...children: Child[]): void {
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    el.append(typeof c === 'number' ? String(c) : c);
  }
}

/** Statisches SVG-Markup als Element (nur eigene Konstanten, nie Nutzertext). */
export function svg(markup: string, cls = 'svg-ico'): HTMLElement {
  const s = document.createElement('span');
  s.className = cls;
  s.setAttribute('aria-hidden', 'true');
  s.innerHTML = markup;
  return s;
}

export const fmt = (n: number): string => Math.round(n).toLocaleString('de-DE');

export const reducedMotion = (): boolean => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Zahl hochzählen (requestAnimationFrame); bei reduzierter Bewegung sofort. */
export function countUp(el: HTMLElement, to: number, ms = 900, format: (n: number) => string = fmt, from = 0): Promise<void> {
  if (reducedMotion() || ms <= 0) {
    el.textContent = format(to);
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const t0 = performance.now();
    const step = (t: number): void => {
      const k = Math.min(1, (t - t0) / ms);
      const e = 1 - (1 - k) ** 3;
      el.textContent = format(from + (to - from) * e);
      if (k < 1) requestAnimationFrame(step);
      else resolve();
    };
    requestAnimationFrame(step);
  });
}

export const wait = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, reducedMotion() ? Math.min(ms, 30) : ms));

/** Leere Einträge (null/false/undefined) entfernen – für `replaceChildren(...keep(…))`. */
export function keep(...items: Array<Node | string | null | undefined | false>): Array<Node | string> {
  return items.filter((x): x is Node | string => x !== null && x !== undefined && x !== false);
}
