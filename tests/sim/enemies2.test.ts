import { describe, expect, it } from 'vitest';
import { ENEMIES, type EnemyType, type SimEvent } from '../../src/sim/index';
import { cellNear, makeGame, place, stepN } from './helpers';

// Erwartungswerte sind Literale aus der Spec season-2.

function sample(w: number, runs: number): { counts: Record<string, number>; total: number } {
  const g = makeGame(2024);
  const counts: Record<string, number> = {};
  let total = 0;
  for (let i = 0; i < runs; i++) {
    g.state.running = false;
    g.state.wave = w - 1;
    g.apply({ type: 'startWave' });
    const q: EnemyType[] = g.state.queue.filter((t) => t !== 'boss');
    for (const t of q) {
      counts[t] = (counts[t] ?? 0) + 1;
      total++;
    }
  }
  return { counts, total };
}

function share(s: ReturnType<typeof sample>, type: string): number {
  return (s.counts[type] ?? 0) / s.total;
}

describe('AC-2 Werte', () => {
  it('Meeting-Einladung: HP 35, Tempo 70, Belohnung 7, Leckschaden 5, Störung 60 px / 1,2 s', () => {
    const e = ENEMIES.meeting;
    expect([e.hp, e.speed, e.reward, e.leakDamage, e.jam, e.jamTime]).toEqual([35, 70, 7, 5, 60, 1.2]);
  });
  it('Hotfix: HP 12, Tempo 150, Belohnung 3, Leckschaden 5, keine Störung', () => {
    const e = ENEMIES.hotfix;
    expect([e.hp, e.speed, e.reward, e.leakDamage]).toEqual([12, 150, 3, 5]);
    expect(e.jam).toBeUndefined();
  });
  it('gespawnte Gegner in Welle 1 haben die Basis-HP', () => {
    const g = makeGame();
    g.state.wave = 1;
    expect(g.spawnEnemy('meeting').hp).toBe(35);
    expect(g.spawnEnemy('hotfix').hp).toBe(12);
  });
  it('Abschuss-Belohnung in Welle 1: Meeting 2 SP (Score 20), Hotfix 1 SP (Score 10)', () => {
    for (const [type, reward] of [['meeting', 2], ['hotfix', 1]] as const) {
      const g = makeGame();
      g.state.wave = 1;
      const e = g.spawnEnemy(type, { dist: 300 });
      e.hp = 0.001;
      place(g, 'dev', ...(Object.values(cellNear(g, 'dev', e, 40, 70)) as [number, number]));
      g.state.money = 0;
      const ev = g.step();
      expect(ev.find((x) => x.type === 'killed')).toMatchObject({ reward });
      expect(g.state.money).toBe(reward);
      expect(g.state.score).toBe(reward * 10);
    }
  });
});

describe('AC-2 Meeting-Störung', () => {
  function jamSetup(): { g: ReturnType<typeof makeGame>; tick: () => SimEvent[]; near: ReturnType<typeof place>; far: ReturnType<typeof place> } {
    const g = makeGame();
    g.state.money = 1e6;
    const e = g.spawnEnemy('meeting', { dist: 300 });
    e.hp = 1e9;
    const near = place(g, 'rto', ...(Object.values(cellNear(g, 'rto', e, 25, 45)) as [number, number]));
    const far = place(g, 'rto', ...(Object.values(cellNear(g, 'rto', e, 75, 95)) as [number, number]));
    return {
      g,
      near,
      far,
      tick: () => {
        g.placeAt(e, 300);
        return g.step();
      },
    };
  }

  it('erste Störung nach 1 s, Radius 60: nur der nahe Arbeitsplatz fällt aus', () => {
    const { g, tick, near, far } = jamSetup();
    let first = 0;
    let jam: SimEvent | undefined;
    for (let i = 1; i <= 80 && !jam; i++) {
      jam = tick().find((x) => x.type === 'jammed');
      first = i;
    }
    expect(first).toBeGreaterThanOrEqual(60);
    expect(first).toBeLessThanOrEqual(61);
    expect(jam).toMatchObject({ type: 'jammed', radius: 60, towerIds: [near.id] });
    expect(near.offTime).toBeGreaterThan(1.1);
    expect(near.offTime).toBeLessThanOrEqual(1.2);
    expect(far.offTime).toBe(0);
    expect(g.state.tick).toBe(first);
  });

  it('Dauer 1,2 s (72 Ticks), danach wieder frei; nächste Störung 3 s (180 Ticks) später', () => {
    const { tick, near } = jamSetup();
    const jamTicks: number[] = [];
    let offStart = 0;
    let offEnd = 0;
    for (let i = 1; i <= 450; i++) {
      const ev = tick();
      if (ev.some((x) => x.type === 'jammed')) jamTicks.push(i);
      if (near.offTime > 0 && !offStart) offStart = i;
      if (offStart && !offEnd && near.offTime <= 0) offEnd = i;
    }
    expect(jamTicks.length).toBe(3);
    expect(jamTicks[1]! - jamTicks[0]!).toBeGreaterThanOrEqual(179);
    expect(jamTicks[1]! - jamTicks[0]!).toBeLessThanOrEqual(181);
    expect(jamTicks[2]! - jamTicks[1]!).toBeGreaterThanOrEqual(179);
    expect(jamTicks[2]! - jamTicks[1]!).toBeLessThanOrEqual(181);
    expect(offEnd - offStart).toBeGreaterThanOrEqual(71);
    expect(offEnd - offStart).toBeLessThanOrEqual(73);
  });

  it('Tech Debt (2 s) bleibt unverändert länger als Meeting (1,2 s)', () => {
    expect(ENEMIES.debt.jamTime).toBeUndefined();
    expect(ENEMIES.debt.jam).toBe(75);
    const g = makeGame();
    g.state.money = 1e6;
    const e = g.spawnEnemy('debt', { dist: 300 });
    e.hp = 1e9;
    const t = place(g, 'rto', ...(Object.values(cellNear(g, 'rto', e, 25, 45)) as [number, number]));
    for (let i = 0; i < 61; i++) {
      g.placeAt(e, 300);
      g.step();
    }
    expect(t.offTime).toBeGreaterThan(1.9);
  });

  it('Meeting ohne Arbeitsplatz im Umkreis erzeugt kein jammed-Ereignis', () => {
    const g = makeGame();
    const e = g.spawnEnemy('meeting', { dist: 300 });
    e.hp = 1e9;
    expect(stepN(g, 70).some((x) => x.type === 'jammed')).toBe(false);
  });
});

describe('AC-2 Auftreten ab Welle (2000+ Ziehungen, +-3 Prozentpunkte)', () => {
  it('Welle 2: weder hotfix noch meeting', () => {
    const s = sample(2, 170);
    expect(s.counts.hotfix ?? 0).toBe(0);
    expect(s.counts.meeting ?? 0).toBe(0);
  });
  it('Welle 3: hotfix 18 %, req 20 %, kein meeting, kein debt', () => {
    const s = sample(3, 150);
    expect(s.total).toBeGreaterThanOrEqual(2000);
    expect(Math.abs(share(s, 'hotfix') - 0.18)).toBeLessThanOrEqual(0.03);
    expect(Math.abs(share(s, 'req') - 0.2)).toBeLessThanOrEqual(0.03);
    expect(s.counts.meeting ?? 0).toBe(0);
    expect(s.counts.debt ?? 0).toBe(0);
  });
  it('Welle 4: hotfix 8 %, meeting 6 %, debt 10 %, req 14 %', () => {
    const s = sample(4, 130);
    expect(s.total).toBeGreaterThanOrEqual(2000);
    expect(Math.abs(share(s, 'hotfix') - 0.08)).toBeLessThanOrEqual(0.03);
    expect(Math.abs(share(s, 'meeting') - 0.06)).toBeLessThanOrEqual(0.03);
    expect(Math.abs(share(s, 'debt') - 0.1)).toBeLessThanOrEqual(0.03);
    expect(Math.abs(share(s, 'req') - 0.14)).toBeLessThanOrEqual(0.03);
  });
  it('PIP-Wellen enthalten weder hotfix noch meeting', () => {
    const s = sample(11, 80);
    expect(s.counts.hotfix ?? 0).toBe(0);
    expect(s.counts.meeting ?? 0).toBe(0);
  });
});
