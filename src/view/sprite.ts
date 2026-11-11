// Atlas-Frames als DOM-Sprites (Porträts in der Oberfläche, Spec office-makeover AC-7).
interface AtlasFrame {
  filename: string;
  frame: { x: number; y: number; w: number; h: number };
}
interface AtlasJson {
  textures: Array<{ image: string; size: { w: number; h: number }; frames: AtlasFrame[] }>;
}

let atlas: Promise<Map<string, { image: string; x: number; y: number; w: number; h: number; sw: number; sh: number }>> | null = null;

function loadAtlas(): typeof atlas {
  atlas ??= fetch('assets/game.json')
    .then((r) => r.json() as Promise<AtlasJson>)
    .then((j) => {
      const m = new Map<string, { image: string; x: number; y: number; w: number; h: number; sw: number; sh: number }>();
      for (const t of j.textures) for (const f of t.frames) m.set(f.filename, { image: t.image, ...f.frame, sw: t.size.w, sh: t.size.h });
      return m;
    });
  return atlas;
}

/** Setzt einen Atlas-Frame als Hintergrund von `el`, skaliert auf höchstens `size` px (Seitenverhältnis bleibt). */
export function applySprite(el: HTMLElement, frame: string, size: number): void {
  void loadAtlas()!.then((m) => {
    const f = m.get(frame);
    if (!f) return;
    const k = size / Math.max(f.w, f.h);
    el.style.width = `${Math.round(f.w * k)}px`;
    el.style.height = `${Math.round(f.h * k)}px`;
    el.style.backgroundImage = `url(assets/${f.image})`;
    el.style.backgroundSize = `${f.sw * k}px ${f.sh * k}px`;
    el.style.backgroundPosition = `${-f.x * k}px ${-f.y * k}px`;
  });
}
