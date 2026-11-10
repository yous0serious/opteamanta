import type Phaser from 'phaser';

type G = Phaser.GameObjects.Graphics;

/** '#rgb' / '#rrggbb' → 0xrrggbb */
export function hex(color: string): number {
  let c = color.replace('#', '');
  if (c.length === 3) c = c.split('').map((ch) => ch + ch).join('');
  return parseInt(c, 16);
}

/** HSL (h in Grad, s/l in %) → 0xrrggbb */
export function hsl(h: number, s: number, l: number): number {
  const S = s / 100;
  const L = l / 100;
  const k = (n: number): number => (n + h / 30) % 12;
  const a = S * Math.min(L, 1 - L);
  const f = (n: number): number => L - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const to = (v: number): number => Math.round(v * 255);
  return (to(f(0)) << 16) | (to(f(8)) << 8) | to(f(4));
}

/** Gestrichelte Linie über eine Punktfolge, Muster läuft über Ecken weiter (wie Canvas setLineDash). */
export function dashedPolyline(g: G, pts: ReadonlyArray<{ x: number; y: number }>, dash: number, gap: number, offset = 0): void {
  const period = dash + gap;
  let phase = ((offset % period) + period) % period;
  g.beginPath();
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!;
    const b = pts[i]!;
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len === 0) continue;
    const ux = (b.x - a.x) / len;
    const uy = (b.y - a.y) / len;
    let pos = 0;
    while (pos < len) {
      const inDash = phase < dash;
      const remain = inDash ? dash - phase : period - phase;
      const seg = Math.min(remain, len - pos);
      if (inDash) {
        g.moveTo(a.x + ux * pos, a.y + uy * pos);
        g.lineTo(a.x + ux * (pos + seg), a.y + uy * (pos + seg));
      }
      pos += seg;
      phase = (phase + seg) % period;
    }
  }
  g.strokePath();
}

export function dashedLine(g: G, x1: number, y1: number, x2: number, y2: number, dash: number, gap: number, offset = 0): void {
  dashedPolyline(g, [{ x: x1, y: y1 }, { x: x2, y: y2 }], dash, gap, offset);
}

export function dashedCircle(g: G, x: number, y: number, r: number, dash: number, gap: number, offset = 0): void {
  if (r <= 0) return;
  const circ = Math.PI * 2 * r;
  const period = dash + gap;
  const start = (((offset % period) + period) % period) - period;
  g.beginPath();
  for (let s = start; s < circ; s += period) {
    const a0 = Math.max(0, s) / r;
    const a1 = Math.min(circ, s + dash) / r;
    if (a1 <= a0) continue;
    g.moveTo(x + Math.cos(a0) * r, y + Math.sin(a0) * r);
    const steps = Math.max(2, Math.ceil((a1 - a0) * r / 4));
    for (let i = 1; i <= steps; i++) {
      const a = a0 + ((a1 - a0) * i) / steps;
      g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    }
  }
  g.strokePath();
}

export function dashedRect(g: G, x: number, y: number, w: number, h: number, dash: number, gap: number): void {
  dashedPolyline(g, [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }, { x, y }], dash, gap);
}
