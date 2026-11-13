// Atlas-Frames als DOM-Icons mit Ersatzdarstellung (fehlt ein Frame, bleibt das CSS/SVG-Ersatzbild sichtbar).

interface Frame {
  image: string;
  x: number;
  y: number;
  w: number;
  h: number;
  sw: number;
  sh: number;
}
interface AtlasJson {
  textures: Array<{ image: string; size: { w: number; h: number }; frames: Array<{ filename: string; frame: { x: number; y: number; w: number; h: number } }> }>;
}

let atlas: Promise<Map<string, Frame>> | null = null;

export function loadAtlas(): Promise<Map<string, Frame>> {
  atlas ??= fetch('assets/game.json')
    .then((r) => (r.ok ? (r.json() as Promise<AtlasJson>) : { textures: [] }))
    .then((j) => {
      const m = new Map<string, Frame>();
      for (const t of j.textures) for (const f of t.frames) m.set(f.filename, { image: t.image, ...f.frame, sw: t.size.w, sh: t.size.h });
      return m;
    })
    .catch(() => new Map<string, Frame>());
  return atlas;
}

/**
 * Icon-Element: zeigt den ersten vorhandenen Atlas-Frame aus `frames` (auf `size` px eingepasst), sonst `fallback`.
 * Das Element ist immer `size` × `size` groß – kein Layout-Sprung beim Nachladen.
 */
export function atlasIcon(frames: string[], size: number, fallback: Node | string | null = null, cls = 'ui-ico'): HTMLSpanElement {
  const box = document.createElement('span');
  box.className = cls;
  box.setAttribute('aria-hidden', 'true');
  box.style.width = `${size}px`;
  box.style.height = `${size}px`;
  if (typeof fallback === 'string') box.innerHTML = fallback;
  else if (fallback) box.append(fallback);
  void loadAtlas().then((m) => {
    const name = frames.find((f) => m.has(f));
    if (name) paint(box, m.get(name)!, size);
  });
  return box;
}

function paint(box: HTMLElement, f: Frame, size: number): void {
  const k = size / Math.max(f.w, f.h);
  const spr = document.createElement('span');
  spr.className = 'ui-spr';
  spr.style.width = `${Math.round(f.w * k)}px`;
  spr.style.height = `${Math.round(f.h * k)}px`;
  spr.style.backgroundImage = `url(assets/${f.image})`;
  spr.style.backgroundSize = `${f.sw * k}px ${f.sh * k}px`;
  spr.style.backgroundPosition = `${-f.x * k}px ${-f.y * k}px`;
  box.replaceChildren(spr);
  box.classList.add('has-spr');
}

/**
 * Platzhalter in HTML-Strings (`<span data-ico="icon/…">Ersatz-SVG</span>`) durch Atlas-Frames ersetzen, sofern vorhanden.
 * Größe = gerenderte Breite des Platzhalters (Standard 16 px).
 */
export function upgradeIcons(root: ParentNode): void {
  const els = [...root.querySelectorAll<HTMLElement>('[data-ico]:not(.has-spr)')];
  if (!els.length) return;
  void loadAtlas().then((m) => {
    for (const el of els) {
      const f = m.get(el.dataset.ico!);
      if (f && el.isConnected) paint(el, f, el.getBoundingClientRect().width || 16);
    }
  });
}

/** Gegner-Icon: neues Vorschau-Icon (Agent B) oder erster Lauf-Frame des Monsters, sonst farbiger Punkt mit Kürzel. */
export function enemyIcon(type: string, size: number, color: string, label: string): HTMLSpanElement {
  const dot = document.createElement('span');
  dot.className = 'enemy-dot';
  dot.style.background = color;
  dot.textContent = label.slice(0, 2);
  return atlasIcon([`icon/enemy-${type}`, `enemy/${type}/walk0`, `enemy/${type}/hit`], size, dot, 'ui-ico enemy-ico');
}

/** Rollen-Porträt (Kopf aus dem Atlas). */
export function roleIcon(type: string, size: number, color: string, label: string): HTMLSpanElement {
  const dot = document.createElement('span');
  dot.className = 'enemy-dot';
  dot.style.background = color;
  dot.textContent = label.slice(0, 2);
  return atlasIcon([`head/${type}`], size, dot, 'ui-ico role-ico');
}
