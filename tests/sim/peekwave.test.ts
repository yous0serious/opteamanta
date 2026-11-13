import { describe, expect, it } from 'vitest';
import { ENEMIES, Game, LEVELS, levelById, type EnemyType, type LevelId } from '../../src/sim/index';
import { playStrongBot } from '../../tools/bot-strong';

// Spec campaigns AC-8: Wellenvorschau zeigt die nächste Welle korrekt (gleich der tatsächlichen Welle).

/** Tatsächliche Zusammensetzung von Welle w (Queue direkt nach startWave). */
function actual(g: Game, w: number): EnemyType[] {
  g.state.wave = w - 1;
  g.state.running = false;
  g.apply({ type: 'startWave' });
  return [...g.state.queue];
}

describe('peekWave', () => {
  it('Level: Vorschau jeder Welle = tatsächliche Welle (alle 24 Level, 2 Seeds)', () => {
    for (const l of LEVELS) {
      for (const seed of [1, 987654]) {
        const preview = new Game({ seed, levelId: l.id });
        const peeks = Array.from({ length: l.waves }, (_, i) => preview.peekWave(i + 1));
        const g = new Game({ seed, levelId: l.id });
        for (let w = 1; w <= l.waves; w++) expect(actual(g, w), `${l.id} Welle ${w}`).toEqual(peeks[w - 1]);
      }
    }
  });
  it('Challenge und Endlos: Vorschau = tatsächliche Welle', () => {
    for (const mode of ['challenge', 'endless'] as const) {
      const preview = new Game({ seed: 4242, mapId: 'matrix', mode });
      const g = new Game({ seed: 4242, mapId: 'matrix', mode });
      for (let w = 1; w <= (mode === 'challenge' ? 30 : 40); w++) expect(actual(g, w), `${mode} ${w}`).toEqual(preview.peekWave(w));
    }
  });
  it('ändert weder Zustand noch Zufallsstrom', () => {
    const a = new Game({ seed: 77, levelId: 'art-3' });
    const b = new Game({ seed: 77, levelId: 'art-3' });
    for (let w = 1; w <= 20; w++) a.peekWave(w);
    expect(a.stateHash()).toBe(b.stateHash());
    for (const g of [a, b]) {
      g.apply({ type: 'place', tower: 'dualo', cx: 5, cy: 7 });
      g.apply({ type: 'startWave' });
      for (let i = 0; i < 2000; i++) {
        if (i % 97 === 0 && g === a) a.peekWave(a.state.wave + 1);
        g.step();
      }
    }
    expect(a.stateHash()).toBe(b.stateHash());
  });
  it('während eines echten Laufs: Vorschau vor dem Start = gestartete Welle', () => {
    const peeks = new Map<number, EnemyType[]>();
    const g = playStrongBot({
      seed: 3, levelId: 'solution-2', maxWave: 99,
      onWaveEnd: (game) => peeks.set(game.state.wave + 1, game.peekWave(game.state.wave + 1)),
    });
    const ref = new Game({ seed: 3, levelId: 'solution-2' });
    for (const [w, list] of peeks) if (w <= g.state.wave) expect(actual(ref, w), `Welle ${w}`).toEqual(list);
    expect(peeks.size).toBeGreaterThan(5);
  });
  it('Boss-Wellen enthalten den Boss am Ende; Abhängigkeit zählt als ein Eintrag', () => {
    for (const id of ['team-6', 'art-6', 'solution-6', 'portfolio-6'] as LevelId[]) {
      const l = levelById(id)!;
      const g = new Game({ seed: 5, levelId: id });
      const last = g.peekWave(l.waves);
      expect(last[last.length - 1]).toBe(l.bossWaves[0]!.boss);
      expect(last.filter((t) => ENEMIES[t].boss)).toHaveLength(1);
      expect(g.peekWave(l.waves - 1).some((t) => ENEMIES[t].boss)).toBe(false);
    }
    const art = new Game({ seed: 5, levelId: 'art-1' });
    const w = art.peekWave(8);
    const band = levelById('art-1')!.pool.find((b) => b.from <= 8 && b.to >= 8)!;
    expect(w).toHaveLength(Math.floor(band.size[0] + band.size[1] * 8));
  });
  it('Gegner stammen aus dem Band der Welle', () => {
    const l = levelById('team-4')!;
    const g = new Game({ seed: 11, levelId: l.id });
    for (let w = 1; w <= l.waves; w++) {
      const band = l.pool.find((b) => b.from <= w && b.to >= w)!;
      for (const t of g.peekWave(w)) expect(Object.keys(band.weights), `Welle ${w}`).toContain(t);
    }
  });
  it('ungültige Wellen: leer', () => {
    const g = new Game({ seed: 1, levelId: 'team-1' });
    expect(g.peekWave(0)).toEqual([]);
    expect(g.peekWave(-1)).toEqual([]);
    expect(g.peekWave(1.5)).toEqual([]);
    expect(g.peekWave(9)).toEqual([]);
    expect(new Game({ seed: 1, mapId: 'waterfall', mode: 'challenge' }).peekWave(31)).toEqual([]);
    expect(new Game({ seed: 1, mapId: 'waterfall', mode: 'endless' }).peekWave(31).length).toBeGreaterThan(0);
  });
  it('anderer Seed → andere Wellen; gleicher Seed → gleiche Wellen', () => {
    const a = new Game({ seed: 1, levelId: 'portfolio-5' });
    const b = new Game({ seed: 1, levelId: 'portfolio-5' });
    const c = new Game({ seed: 2, levelId: 'portfolio-5' });
    expect(a.peekWave(10)).toEqual(b.peekWave(10));
    expect(a.peekWave(10)).not.toEqual(c.peekWave(10));
  });
});
