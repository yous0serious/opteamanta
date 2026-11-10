// Kosmetische Effekte (Ringe, schwebende Texte, Wackeln, Blitz). Partikel laufen über render/particles.ts.
// Liegt bewusst in src/view: darf Math.random nutzen und beeinflusst die Simulation nie.

export interface Ring { x: number; y: number; r: number; maxR: number; life: number; color: string }
export interface FloatText { id: number; x: number; y: number; text: string; color: string; size: number; life: number; maxLife: number }

export class Effects {
  rings: Ring[] = [];
  texts: FloatText[] = [];
  shake = 0;
  flash = 0;
  private nextTextId = 1;

  ring(x: number, y: number, maxR: number, color: string): void {
    this.rings.push({ x, y, r: 0, maxR, life: 0.4, color });
  }

  text(x: number, y: number, text: string, color: string, size = 16, life = 1): void {
    this.texts.push({ id: this.nextTextId++, x, y, text, color, size, life, maxLife: life });
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
