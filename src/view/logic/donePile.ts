// DONE-Haufen: wohin zerknüllte Post-its fliegen (Spec visual-overhaul AC-6). Reine Logik ohne Phaser.

export interface PileBall {
  id: number;
  x: number;
  y: number;
  rot: number;
  color: string;
}

export interface PileArea {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface DonePileOptions {
  max: number;
  area: PileArea;
  /** Liefert true für Positionen, an denen keine Kugel liegen darf (z. B. Pfadzellen). */
  blocked?: (x: number, y: number) => boolean;
  rand?: () => number;
  /** Abstand der Liegeplätze in px. */
  spacing?: number;
}

/** Stapelt von unten nach oben; bei vollem Haufen ersetzt die neue Kugel die älteste. */
export class DonePile {
  private readonly slots: Array<{ x: number; y: number }> = [];
  private readonly list: PileBall[] = [];
  private readonly used = new Map<number, number>(); // ballId → Slot-Index
  private readonly max: number;
  private readonly rand: () => number;
  private nextId = 1;

  constructor(opts: DonePileOptions) {
    this.max = opts.max;
    this.rand = opts.rand ?? Math.random;
    const sp = opts.spacing ?? 14;
    const { x, y, w, h } = opts.area;
    const half = sp / 2;
    // Reihen von unten nach oben; innerhalb einer Reihe zufällige Reihenfolge, versetzte Reihen.
    for (let row = 0; y + h - half - row * (sp * 0.8) >= y + half; row++) {
      const cy = y + h - half - row * (sp * 0.8);
      const offset = row % 2 ? sp / 2 : 0;
      const rowSlots: Array<{ x: number; y: number }> = [];
      for (let cx = x + half + offset; cx <= x + w - half; cx += sp) {
        if (!opts.blocked?.(cx, cy)) rowSlots.push({ x: cx, y: cy });
      }
      for (let i = rowSlots.length - 1; i > 0; i--) {
        const j = Math.floor(this.rand() * (i + 1));
        [rowSlots[i], rowSlots[j]] = [rowSlots[j]!, rowSlots[i]!];
      }
      this.slots.push(...rowSlots);
    }
  }

  get balls(): readonly PileBall[] {
    return this.list;
  }

  get capacity(): number {
    return Math.min(this.max, this.slots.length);
  }

  add(color: string): PileBall {
    let slotIndex: number;
    if (this.list.length >= this.capacity) {
      const oldest = this.list.shift()!;
      slotIndex = this.used.get(oldest.id)!;
      this.used.delete(oldest.id);
    } else {
      slotIndex = this.list.length;
    }
    const slot = this.slots[slotIndex]!;
    const jitter = (): number => (this.rand() - 0.5) * 4;
    const ball: PileBall = { id: this.nextId++, x: slot.x + jitter(), y: slot.y + jitter(), rot: this.rand() * Math.PI * 2, color };
    this.used.set(ball.id, slotIndex);
    this.list.push(ball);
    return ball;
  }

  clear(): void {
    this.list.length = 0;
    this.used.clear();
  }
}
