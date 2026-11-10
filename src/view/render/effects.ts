// Kosmetische Effekte (Papierschnipsel, Ringe, schwebende Texte, Wackeln, Blitz).
// Liegt bewusst in src/view: darf Math.random nutzen und beeinflusst die Simulation nie.

export interface Particle { x: number; y: number; vx: number; vy: number; life: number; color: string }
export interface Ring { x: number; y: number; r: number; maxR: number; life: number; color: string }
export interface FloatText { id: number; x: number; y: number; text: string; color: string; size: number; life: number; maxLife: number }

const MAX_PARTICLES = 900;

export class Effects {
  particles: Particle[] = [];
  rings: Ring[] = [];
  texts: FloatText[] = [];
  shake = 0;
  flash = 0;
  private nextTextId = 1;

  boom(x: number, y: number, color: string, n = 20, power = 200): void {
    for (let i = 0; i < n && this.particles.length < MAX_PARTICLES; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = Math.random() * power;
      this.particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.4 + Math.random() * 0.6, color });
    }
  }

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
    const damp = Math.pow(0.94, dt * 60);
    for (const p of this.particles) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= damp;
      p.vy *= damp;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
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
    this.particles = [];
    this.rings = [];
    this.texts = [];
    this.shake = 0;
    this.flash = 0;
  }
}
