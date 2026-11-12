// Kosmetische Effekte (Ringe, schwebende Texte, Wackeln, Blitz). Partikel laufen über render/particles.ts.
// Liegt bewusst in src/view: darf Math.random nutzen und beeinflusst die Simulation nie.

export interface Ring { x: number; y: number; r: number; maxR: number; life: number; color: string }
export interface FloatText { id: number; x: number; y: number; text: string; color: string; size: number; life: number; maxLife: number; count: number }

/** Höchstens so viele schwebende Texte gleichzeitig – mehr wird unlesbar (Wellen mit vielen Splits/Kills). */
export const MAX_TEXTS = 9;
/** Gleicher Text in diesem Umkreis wird zusammengefasst („×3“) statt neu gestapelt. */
const MERGE_RADIUS = 140;
const LINE = 20;

/** Grobe Textbreite in Spielfeld-Pixeln (Handschrift, fett). */
const approxWidth = (t: FloatText): number => t.text.length * t.size * 0.55 + 16;

function overlaps(a: FloatText, x: number, y: number, w: number): boolean {
  return Math.abs(a.x - x) * 2 < approxWidth(a) + w && Math.abs(a.y - y) < LINE;
}

export class Effects {
  rings: Ring[] = [];
  texts: FloatText[] = [];
  shake = 0;
  flash = 0;
  private nextTextId = 1;

  ring(x: number, y: number, maxR: number, color: string): void {
    this.rings.push({ x, y, r: 0, maxR, life: 0.4, color });
  }

  /**
   * Schwebender Text. Gleiche Meldungen in der Nähe werden zusammengefasst, andere weichen nach oben aus,
   * und bei zu vielen verschwindet zuerst die älteste kleine Meldung.
   */
  text(x: number, y: number, text: string, color: string, size = 16, life = 1): void {
    const same = this.texts.find((t) => t.text === text && Math.abs(t.x - x) < MERGE_RADIUS && Math.abs(t.y - y) < MERGE_RADIUS);
    if (same) {
      same.count++;
      same.life = same.maxLife;
      return;
    }
    const t: FloatText = { id: this.nextTextId++, x, y, text, color, size, life, maxLife: life, count: 1 };
    const w = approxWidth(t);
    for (let i = 0; i < 4 && this.texts.some((o) => overlaps(o, t.x, t.y, w)); i++) t.y -= LINE;
    this.texts.push(t);
    while (this.texts.length > MAX_TEXTS) {
      let drop = 0;
      for (let i = 1; i < this.texts.length - 1; i++) {
        const a = this.texts[i]!;
        const b = this.texts[drop]!;
        if (a.size < b.size || (a.size === b.size && a.life < b.life)) drop = i;
      }
      this.texts.splice(drop, 1);
    }
  }

  bumpShake(value: number): void {
    this.shake = Math.max(this.shake, value);
  }

  update(dt: number): void {
    for (const r of this.rings) {
      r.life -= dt;
      r.r += (r.maxR - r.r) * Math.min(1, dt * 12);
    }
    this.rings = this.rings.filter((r) => r.life > 0);
    for (const t of this.texts) {
      t.life -= dt;
      t.y -= dt * 25;
    }
    this.texts = this.texts.filter((t) => t.life > 0);
    this.shake *= Math.pow(0.88, dt * 60);
    this.flash = Math.max(0, this.flash - dt);
  }

  clear(): void {
    this.rings = [];
    this.texts = [];
    this.shake = 0;
    this.flash = 0;
  }
}
