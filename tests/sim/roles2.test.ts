import { describe, expect, it } from 'vitest';
import { Game, type Enemy, type SimEvent, type Tower, type TowerType } from '../../src/sim/index';
import { cellNear, place, stepN } from './helpers';

// Alle Erwartungswerte sind Literale aus der Spec season-2 (Abschnitt „Entscheidungen“), keine Sim-Konstanten.

function arena(): Game {
  const g = new Game({ seed: 7, mapId: 'waterfall', mode: 'endless' });
  g.state.money = 1_000_000;
  return g;
}

/** Hält einen Gegner praktisch unverwundbar. */
function hardy(e: Enemy): Enemy {
  e.hp = 1e9;
  e.maxHp = 1e9;
  e.baseMaxHp = 1e9;
  return e;
}

/** Aufwerten; ab Stufe 3 ohne Zweig-Wirkung (Basiswerte der Spec season-2 – Zweige prüft targeting-branches.test). */
function upgrade(g: Game, t: Tower, times: number): void {
  for (let i = 0; i < times; i++) g.apply({ type: 'upgrade', towerId: t.id, branch: 'a' });
  t.branch = null;
}

function placeNear(g: Game, type: TowerType, from: { x: number; y: number }, lo: number, hi: number): Tower {
  const c = cellNear(g, type, from, lo, hi);
  return place(g, type, c.cx, c.cy);
}

/** Tick-Nummern (1-basiert), in denen ein Ereignis des Typs auftrat. */
function ticksOf(events: SimEvent[][], type: SimEvent['type']): number[] {
  const out: number[] = [];
  events.forEach((ev, i) => {
    if (ev.some((e) => e.type === type)) out.push(i + 1);
  });
  return out;
}

describe('AC-1 Kosten und Marker der neuen Rollen', () => {
  it('Kosten rte 140, rta 130, rto 100, board 500', () => {
    const g = arena();
    const costs: [TowerType, number][] = [['rte', 140], ['rta', 130], ['rto', 100], ['board', 500]];
    const cells = [[10, 5], [11, 5], [12, 5], [13, 5]];
    costs.forEach(([type, cost], i) => {
      g.state.money = 1000;
      const t = place(g, type, cells[i]![0]!, cells[i]![1]!);
      expect(g.state.money).toBe(1000 - cost);
      expect(t.spent).toBe(cost);
      expect(t.syncTime).toBe(0);
      expect(t.phase).toBe(0);
    });
  });
  it('Gegner starten mit frozenTime 0', () => {
    expect(arena().spawnEnemy('req').frozenTime).toBe(0);
  });
});

describe('AC-1 RTE PI-Sync', () => {
  function rteSetup(level = 1): { g: Game; rte: Tower } {
    const g = arena();
    hardy(g.spawnEnemy('req'));
    g.state.running = true;
    const rte = place(g, 'rte', 10, 5);
    upgrade(g, rte, level - 1);
    return { g, rte };
  }

  it('feuert alle 10 s (600 Ticks), erstmals im ersten Tick', () => {
    const { g } = rteSetup();
    const events: SimEvent[][] = [];
    for (let i = 0; i < 1300; i++) events.push(g.step());
    const ticks = ticksOf(events, 'synced');
    expect(ticks.length).toBe(3);
    expect(ticks[0]).toBe(1);
    expect(ticks[1]! - ticks[0]!).toBeGreaterThanOrEqual(599);
    expect(ticks[1]! - ticks[0]!).toBeLessThanOrEqual(601);
    expect(ticks[2]! - ticks[1]!).toBeGreaterThanOrEqual(599);
    expect(ticks[2]! - ticks[1]!).toBeLessThanOrEqual(601);
  });

  it.each([
    [1, 130, [115, 125], [136, 146]],
    [3, 156, [140, 152], [162, 176]],
  ] as const)('Reichweite Stufe %i = %i px', (level, radius, inside, outside) => {
    const { g, rte } = rteSetup(level);
    const near = placeNear(g, 'rto', rte, inside[0], inside[1]);
    const far = placeNear(g, 'rto', rte, outside[0], outside[1]);
    const ev = g.step();
    const synced = ev.find((e) => e.type === 'synced');
    expect(synced).toBeDefined();
    if (synced?.type !== 'synced') return;
    expect(synced.radius).toBeCloseTo(radius, 9);
    expect(synced.towerIds).toContain(near.id);
    expect(synced.towerIds).not.toContain(far.id);
    expect(synced.towerIds).not.toContain(rte.id);
    expect(near.syncTime).toBeGreaterThan(0);
    expect(far.syncTime).toBe(0);
    expect(rte.syncTime).toBe(0);
  });

  it.each([
    [1, 4],
    [2, 4.5],
    [3, 5],
  ] as const)('Dauer Stufe %i = %f s', (level, seconds) => {
    const { g, rte } = rteSetup(level);
    const mate = placeNear(g, 'rto', rte, 60, 100);
    // Das Teammitglied steht nach dem RTE in der Turmliste und wird im selben Tick schon einmal heruntergezählt.
    g.step();
    expect(mate.syncTime).toBeGreaterThan(seconds - 2 / 60);
    expect(mate.syncTime).toBeLessThanOrEqual(seconds);
    stepN(g, Math.round(seconds * 60) - 5);
    expect(mate.syncTime).toBeGreaterThan(0);
    stepN(g, 10);
    expect(mate.syncTime).toBeLessThanOrEqual(0);
  });

  it('Störung (offTime) endet sofort', () => {
    const { g, rte } = rteSetup();
    const mate = placeNear(g, 'rto', rte, 60, 100);
    const outsider = placeNear(g, 'rto', rte, 150, 190);
    mate.offTime = 2;
    outsider.offTime = 2;
    g.step();
    expect(mate.offTime).toBe(0);
    expect(outsider.offTime).toBeGreaterThan(1.9);
  });

  it('Abklingzeit läuft mit Faktor 1,3 statt 1 ab', () => {
    const { g, rte } = rteSetup();
    const synced = placeNear(g, 'analyst', rte, 60, 100);
    const unsynced = placeNear(g, 'analyst', rte, 200, 260);
    synced.cooldown = 5;
    unsynced.cooldown = 5;
    // Beide Analysten haben (außer dem fernen Gegner) kein Ziel in Reichweite; Gegner steht am Pfadanfang.
    g.step();
    const s1 = synced.cooldown;
    const u1 = unsynced.cooldown;
    g.step();
    expect(s1 - synced.cooldown).toBeCloseTo(1.3 / 60, 9);
    expect(u1 - unsynced.cooldown).toBeCloseTo(1 / 60, 9);
  });

  it('Schussanzahl in 4 s: 8 mit PI-Sync, 6 ohne (Analyst, Rate 0,7 s)', () => {
    const count = (withRte: boolean): number => {
      const g = arena();
      const target = hardy(g.spawnEnemy('req', { dist: 300 }));
      g.state.running = true;
      const analyst = placeNear(g, 'analyst', target, 40, 70);
      if (withRte) placeNear(g, 'rte', analyst, 40, 80);
      let shots = 0;
      for (let i = 0; i < 240; i++) {
        g.placeAt(target, 300);
        shots += g.step().filter((e) => e.type === 'fired').length;
      }
      return shots;
    };
    expect(count(false)).toBe(6);
    expect(count(true)).toBe(8);
  });

  it('Entwickler-Strahl: DPS x 1,3 (45/s -> 58,5/s) während PI-Sync', () => {
    const g = arena();
    const target = g.spawnEnemy('req', { dist: 300 });
    target.hp = 1e6;
    g.state.running = true;
    const dev = placeNear(g, 'dev', target, 50, 80);
    placeNear(g, 'rte', dev, 40, 80);
    g.step(); // Dev läuft vor dem RTE: noch kein Sync
    const before1 = target.hp;
    g.step();
    const plain = before1 - target.hp;
    expect(plain).toBeCloseTo((45 / 60) * 1.3, 6);
    expect(dev.syncTime).toBeGreaterThan(0);
  });

  it('Entwickler-Strahl ohne PI-Sync: 45/s', () => {
    const g = arena();
    const target = g.spawnEnemy('req', { dist: 300 });
    target.hp = 1e6;
    placeNear(g, 'dev', target, 50, 80);
    g.step();
    expect(1e6 - target.hp).toBeCloseTo(45 / 60, 6);
  });

  it('wirkt nicht, solange keine Welle läuft', () => {
    const g = arena();
    hardy(g.spawnEnemy('req'));
    g.state.running = false;
    const rte = place(g, 'rte', 10, 5);
    const mate = placeNear(g, 'rto', rte, 60, 100);
    const events = stepN(g, 700);
    expect(events.some((e) => e.type === 'synced')).toBe(false);
    expect(mate.syncTime).toBe(0);
    expect(rte.cooldown).toBeLessThanOrEqual(0);
  });
});

describe('AC-1 RTA Architektur-Runway', () => {
  /** Strahlschaden eines Tick-Treffers (45/60 = 0,75 ohne RTA) auf einen Gegner mit 1000 HP. */
  function beamDelta(type: 'req' | 'debt', rtas: { level: number; dist: [number, number]; off?: boolean }[]): number {
    const g = arena();
    const e = g.spawnEnemy(type, { dist: 300 });
    e.hp = 1000;
    placeNear(g, 'dev', e, 40, 70);
    for (const r of rtas) {
      const rta = placeNear(g, 'rta', e, r.dist[0], r.dist[1]);
      upgrade(g, rta, r.level - 1);
      if (r.off) rta.offTime = 5;
    }
    g.step();
    return 1000 - e.hp;
  }

  it('ohne RTA: Faktor 1 (0,75 je Tick)', () => {
    expect(beamDelta('req', [])).toBeCloseTo(0.75, 6);
  });
  it('Stufe 1: Faktor 1,25', () => {
    expect(beamDelta('req', [{ level: 1, dist: [70, 100] }])).toBeCloseTo(0.75 * 1.25, 6);
  });
  it('Stufe 3: Faktor 1,35', () => {
    expect(beamDelta('req', [{ level: 3, dist: [70, 100] }])).toBeCloseTo(0.75 * 1.35, 6);
  });
  it('Tech Debt: Faktor x 2 (Stufe 1: 2,5; Stufe 3: 2,7)', () => {
    expect(beamDelta('debt', [{ level: 1, dist: [70, 100] }])).toBeCloseTo(0.75 * 2.5, 6);
    expect(beamDelta('debt', [{ level: 3, dist: [70, 100] }])).toBeCloseTo(0.75 * 2.7, 6);
  });
  it('Tech Debt ohne RTA: Faktor 1', () => {
    expect(beamDelta('debt', [])).toBeCloseTo(0.75, 6);
  });
  it('nicht kumulativ: zwei RTA Stufe 1 -> 1,25; Stufe 1 + 3 -> 1,35', () => {
    expect(beamDelta('req', [{ level: 1, dist: [70, 100] }, { level: 1, dist: [70, 100] }])).toBeCloseTo(0.75 * 1.25, 6);
    expect(beamDelta('req', [{ level: 1, dist: [70, 100] }, { level: 3, dist: [70, 100] }])).toBeCloseTo(0.75 * 1.35, 6);
  });
  it('gestörte RTA wirkt nicht', () => {
    expect(beamDelta('req', [{ level: 1, dist: [70, 100], off: true }])).toBeCloseTo(0.75, 6);
    // Eine gestörte, eine intakte: nur die intakte zählt.
    expect(beamDelta('req', [{ level: 3, dist: [70, 100], off: true }, { level: 1, dist: [70, 100] }])).toBeCloseTo(0.75 * 1.25, 6);
  });
  it('Reichweite 110 (Stufe 1): außerhalb Faktor 1; Stufe 3 (132 px) erreicht denselben Abstand', () => {
    expect(beamDelta('req', [{ level: 1, dist: [122, 134] }])).toBeCloseTo(0.75, 6);
    expect(beamDelta('req', [{ level: 3, dist: [118, 130] }])).toBeCloseTo(0.75 * 1.35, 6);
    expect(beamDelta('req', [{ level: 3, dist: [140, 160] }])).toBeCloseTo(0.75, 6);
  });
});

describe('AC-1 RTO Business Value', () => {
  /** Schließt Welle 3 ab und liefert Geldzuwachs, Wellenbonus und die Events. */
  function clear(levels: number[]): { gain: number; bonus: number; events: SimEvent[] } {
    const g = arena();
    levels.forEach((level, i) => {
      const t = place(g, 'rto', 10 + i, 5);
      upgrade(g, t, level - 1);
    });
    g.state.money = 1000;
    g.state.wave = 3;
    g.state.running = true;
    const events = g.step();
    const cleared = events.find((e) => e.type === 'waveCleared');
    if (cleared?.type !== 'waveCleared') throw new Error('Welle nicht beendet');
    return { gain: g.state.money - 1000, bonus: cleared.bonus, events };
  }

  it('Stufe 1: +15 SP nach dem Wellenbonus, Event businessValue', () => {
    const { gain, bonus, events } = clear([1]);
    expect(gain - bonus).toBe(15);
    const types = events.map((e) => e.type);
    expect(types.indexOf('businessValue')).toBeGreaterThan(types.indexOf('waveCleared'));
    expect(events.find((e) => e.type === 'businessValue')).toMatchObject({ type: 'businessValue', amount: 15 });
  });
  it('Stufe 3: +35 SP', () => {
    const { gain, bonus, events } = clear([3]);
    expect(gain - bonus).toBe(35);
    expect(events.find((e) => e.type === 'businessValue')).toMatchObject({ amount: 35 });
  });
  it('Stufe 2: +25 SP', () => {
    expect(clear([2]).gain - clear([2]).bonus).toBe(25);
  });
  it('mehrere RTO addieren sich (Stufe 1 + Stufe 3 = 50), je ein Event', () => {
    const { gain, bonus, events } = clear([1, 3]);
    expect(gain - bonus).toBe(50);
    expect(events.filter((e) => e.type === 'businessValue').length).toBe(2);
  });
  it('ohne RTO kein Event', () => {
    const { gain, bonus, events } = clear([]);
    expect(gain).toBe(bonus);
    expect(events.some((e) => e.type === 'businessValue')).toBe(false);
  });
});

describe('AC-1 Vorstand', () => {
  function boardSetup(level = 1): { g: Game; board: Tower } {
    const g = arena();
    g.state.running = true;
    g.state.wave = 1;
    const board = place(g, 'board', 10, 5);
    upgrade(g, board, level - 1);
    return { g, board };
  }

  it('Limit: zweiter Vorstand wird mit Grund limit abgelehnt; nach Verkauf wieder möglich', () => {
    const g = arena();
    const first = place(g, 'board', 10, 5);
    const money = g.state.money;
    const ev = g.apply({ type: 'place', tower: 'board', cx: 11, cy: 5 });
    expect(ev).toEqual([expect.objectContaining({ type: 'rejected', reason: 'limit' })]);
    expect(g.canPlace('board', 12, 5)).toBe('limit');
    expect(g.state.money).toBe(money);
    expect(g.state.towers.filter((t) => t.type === 'board').length).toBe(1);
    g.apply({ type: 'sell', towerId: first.id });
    expect(g.canPlace('board', 11, 5)).toBeNull();
  });

  it('wirkt nicht ohne laufende Welle und nicht ohne Gegner', () => {
    const { g, board } = boardSetup();
    g.state.running = false;
    hardy(g.spawnEnemy('req'));
    expect(stepN(g, 30).some((e) => e.type === 'freeze')).toBe(false);
    expect(board.phase).toBe(0);
    const g2 = boardSetup();
    g2.g.state.enemies.length = 0;
    g2.g.state.queue = ['req'];
    g2.g.state.spawnTimer = 5;
    expect(stepN(g2.g, 30).some((e) => e.type === 'freeze')).toBe(false);
    expect(g2.board.phase).toBe(0);
  });

  it('Budget-Freeze: alle Gegner 2 s, Boss 1 s; Event freeze listet alle', () => {
    const { g, board } = boardSetup();
    const a = hardy(g.spawnEnemy('req', { dist: 100 }));
    const boss = hardy(g.spawnEnemy('boss', { dist: 100 }));
    const ev = g.step();
    const freeze = ev.find((e) => e.type === 'freeze');
    expect(freeze).toMatchObject({ type: 'freeze', enemyIds: [a.id, boss.id] });
    expect(a.frozenTime).toBeCloseTo(2, 9);
    expect(boss.frozenTime).toBeCloseTo(1, 9);
    expect(board.phase).toBe(1);
    expect(board.cooldown).toBeCloseTo(20, 9);
  });

  it('eingefrorene Gegner bewegen sich nicht, wachsen nicht und stören nicht; danach weiter', () => {
    const { g } = boardSetup();
    const walker = hardy(g.spawnEnemy('req', { dist: 100 }));
    const boss = hardy(g.spawnEnemy('boss', { dist: 100 }));
    const debt = hardy(g.spawnEnemy('debt', { dist: 100 }));
    const creep = g.spawnEnemy('creep', { dist: 100 });
    const victim = placeNear(g, 'rto', debt, 20, 50);
    g.step();
    const w0 = { x: walker.x, y: walker.y, d: walker.dist };
    const b0 = { x: boss.x, y: boss.y };
    const jam0 = debt.jamCooldown;
    const maxHp0 = creep.maxHp;
    const jams: SimEvent[] = [];
    for (let i = 0; i < 50; i++) {
      jams.push(...g.step().filter((e) => e.type === 'jammed'));
      expect(walker.dist).toBe(w0.d);
      expect(boss.x).toBe(b0.x);
    }
    expect(walker.x).toBe(w0.x);
    expect(boss.y).toBe(b0.y);
    expect(debt.jamCooldown).toBe(jam0);
    expect(creep.maxHp).toBe(maxHp0);
    expect(victim.offTime).toBe(0);
    expect(jams.length).toBe(0);
    // Boss taut nach 1 s auf (61 Ticks), der normale Gegner erst nach 2 s (121 Ticks).
    stepN(g, 20);
    expect(boss.dist).toBeGreaterThan(100);
    expect(walker.dist).toBe(w0.d);
    stepN(g, 60);
    expect(walker.dist).toBeGreaterThan(w0.d);
  });

  it('frozenTime sinkt um DT je Tick', () => {
    const { g } = boardSetup();
    const e = hardy(g.spawnEnemy('req', { dist: 100 }));
    g.step();
    const f1 = e.frozenTime;
    g.step();
    expect(f1 - e.frozenTime).toBeCloseTo(1 / 60, 9);
  });

  it('Fähigkeiten wechseln: Freeze, Eingestampft, Freeze; Abstand 20 s', () => {
    const { g } = boardSetup();
    const tanks = [hardy(g.spawnEnemy('req')), hardy(g.spawnEnemy('req')), hardy(g.spawnEnemy('req'))];
    const events: SimEvent[][] = [];
    for (let i = 0; i < 2450; i++) {
      for (const e of g.state.enemies) g.placeAt(e, 10);
      events.push(g.step());
    }
    const kinds: { tick: number; type: string }[] = [];
    events.forEach((ev, i) => {
      for (const e of ev) if (e.type === 'freeze' || e.type === 'axed') kinds.push({ tick: i + 1, type: e.type });
    });
    expect(kinds.map((k) => k.type)).toEqual(['freeze', 'axed', 'freeze']);
    expect(kinds[0]!.tick).toBe(1);
    expect(kinds[1]!.tick - kinds[0]!.tick).toBeGreaterThanOrEqual(1199);
    expect(kinds[1]!.tick - kinds[0]!.tick).toBeLessThanOrEqual(1201);
    expect(kinds[2]!.tick - kinds[1]!.tick).toBeGreaterThanOrEqual(1199);
    expect(kinds[2]!.tick - kinds[1]!.tick).toBeLessThanOrEqual(1201);
    expect(g.state.enemies.map((e) => e.id)).toEqual([tanks[1]!.id, tanks[2]!.id]);
  });

  it.each([
    [1, 20],
    [3, 18],
    [5, 16],
  ] as const)('Intervall Stufe %i = %i s', (level, seconds) => {
    const { g, board } = boardSetup(level);
    hardy(g.spawnEnemy('req'));
    g.step();
    expect(board.cooldown).toBeCloseTo(seconds, 9);
  });

  function axeSetup(hps: { type: 'req' | 'feat' | 'boss'; hp: number }[]): { g: Game; board: Tower; enemies: Enemy[] } {
    const { g, board } = boardSetup();
    const enemies = hps.map((h) => {
      const e = g.spawnEnemy(h.type, { dist: 100 });
      e.hp = h.hp;
      return e;
    });
    g.step(); // Phase 0: Freeze
    board.cooldown = 0;
    return { g, board, enemies };
  }

  it('Projekt eingestampft: Nicht-Boss mit den meisten HP, Boss wird ignoriert', () => {
    const { g, board, enemies } = axeSetup([
      { type: 'req', hp: 50 },
      { type: 'req', hp: 90 },
      { type: 'boss', hp: 5000 },
      { type: 'req', hp: 70 },
    ]);
    const ev = g.step();
    const axed = ev.find((e) => e.type === 'axed');
    expect(axed).toMatchObject({ type: 'axed', enemy: { id: enemies[1]!.id } });
    expect(enemies[1]!.hp).toBe(0);
    expect(g.state.enemies.map((e) => e.id)).toEqual([enemies[0]!.id, enemies[2]!.id, enemies[3]!.id]);
    expect(board.phase).toBe(2);
    expect(board.cooldown).toBeCloseTo(20, 9);
  });

  it('Gleichstand: zuerst gespawnt (kleinere ID)', () => {
    const { g, enemies } = axeSetup([
      { type: 'req', hp: 50 },
      { type: 'req', hp: 90 },
      { type: 'req', hp: 90 },
    ]);
    const ev = g.step();
    expect(ev.find((e) => e.type === 'axed')).toMatchObject({ enemy: { id: enemies[1]!.id } });
    expect(enemies[1]!.id).toBeLessThan(enemies[2]!.id);
  });

  it('Belohnung und Score wie bei einem Abschuss; axed vor killed', () => {
    const { g, enemies } = axeSetup([{ type: 'req', hp: 30 }, { type: 'boss', hp: 5000 }]);
    const money = g.state.money;
    const score = g.state.score;
    const ev = g.step();
    const types = ev.map((e) => e.type);
    expect(types.indexOf('axed')).toBeGreaterThanOrEqual(0);
    expect(types.indexOf('killed')).toBeGreaterThan(types.indexOf('axed'));
    // Anforderung in Welle 1: round(6 * 0,25) = 2 SP, Score +20
    expect(ev.find((e) => e.type === 'killed')).toMatchObject({ reward: 2, enemy: { id: enemies[0]!.id } });
    expect(g.state.money - money).toBe(2);
    expect(g.state.score - score).toBe(20);
  });

  it('Feature wird eingestampft und spaltet sich weiterhin in zwei Stories', () => {
    const { g } = axeSetup([{ type: 'feat', hp: 70 }, { type: 'boss', hp: 5000 }]);
    const ev = g.step();
    expect(ev.some((e) => e.type === 'split')).toBe(true);
    expect(g.state.enemies.filter((e) => e.type === 'story').length).toBe(2);
    // Feature: round(15 * 0,25) = 4 SP
    expect(ev.find((e) => e.type === 'killed')).toMatchObject({ reward: 4 });
  });

  it('nur Boss lebt: Freeze wirkt, Eingestampft tut nichts', () => {
    const { g, board } = axeSetup([{ type: 'boss', hp: 5000 }]);
    const ev = g.step();
    expect(ev.some((e) => e.type === 'axed')).toBe(false);
    expect(g.state.enemies.length).toBe(1);
    expect(board.phase).toBe(2); // Phase zählt auch ohne Ziel weiter
  });
});
