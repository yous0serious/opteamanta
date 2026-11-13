import { describe, expect, it } from 'vitest';
import {
  BRANCHES, BRANCH_LEVEL, DT, Game, TARGET_MODES, TARGET_MODE_NAMES, TOWER_ORDER, parseReplay, runReplay, type Branch, type Tower, type TowerType,
} from '../../src/sim/index';
import { cellNear, makeGame, place, stepN } from './helpers';

// Spec campaigns AC-3: Zielmodi und Upgrade-Zweige wirken wie spezifiziert und sind replay-fest.

function rich(): Game {
  const g = makeGame(5);
  g.state.money = 1e6;
  return g;
}

function placeNear(g: Game, type: TowerType, e: { x: number; y: number }, lo: number, hi: number): Tower {
  const c = cellNear(g, type, e, lo, hi);
  return place(g, type, c.cx, c.cy);
}

/** Wertet einen Turm bis Stufe `level` auf, ab Stufe 3 mit Zweig `branch`. */
function raise(g: Game, t: Tower, level: number, branch: Branch): void {
  while (t.level < level) {
    const ev = g.apply(t.level === BRANCH_LEVEL - 1 ? { type: 'upgrade', towerId: t.id, branch } : { type: 'upgrade', towerId: t.id });
    if (!ev.some((e) => e.type === 'upgraded')) throw new Error(JSON.stringify(ev));
  }
}

describe('Zielmodi', () => {
  it('Reihenfolge und Namen', () => {
    expect([...TARGET_MODES]).toEqual(['first', 'last', 'strong', 'near']);
    expect(TARGET_MODE_NAMES).toEqual({ first: 'Vorderster', last: 'Hinterster', strong: 'Stärkster', near: 'Nächster' });
  });
  it('Standard first; Kommando setzt den Modus (Event targetChanged) und wird aufgezeichnet', () => {
    const g = rich();
    const t = place(g, 'dev', 10, 4);
    expect(t.targetMode).toBe('first');
    const ev = g.apply({ type: 'target', towerId: t.id, mode: 'strong' });
    expect(ev).toEqual([{ type: 'targetChanged', tower: t, mode: 'strong' }]);
    expect(t.targetMode).toBe('strong');
    expect(g.toReplay().commands).toContainEqual([0, 'target', t.id, 'strong']);
  });
  it('Unterstützungsrollen und unbekannte Modi: notTargetable; unbekannter Turm: unknownTower (nicht aufgezeichnet)', () => {
    const g = rich();
    const rte = place(g, 'rte', 10, 4);
    const dev = place(g, 'dev', 11, 4);
    const reason = (ev: ReturnType<Game['apply']>) => (ev[0]?.type === 'rejected' ? ev[0].reason : null);
    expect(reason(g.apply({ type: 'target', towerId: rte.id, mode: 'near' }))).toBe('notTargetable');
    expect(reason(g.apply({ type: 'target', towerId: dev.id, mode: 'weakest' as never }))).toBe('notTargetable');
    expect(reason(g.apply({ type: 'target', towerId: 999, mode: 'near' }))).toBe('unknownTower');
    expect(g.toReplay().commands.filter((c) => c[1] === 'target')).toEqual([]);
    expect(rte.targetMode).toBe('first');
  });
  it('wählt Vorderster / Hinterster / Stärkster / Nächster', () => {
    // Weg auf Zeile 2 (y = 100); Entwickler auf (10, 4) = (420, 180), Reichweite 150.
    const pick = (mode: (typeof TARGET_MODES)[number]): number => {
      const g = rich();
      const t = place(g, 'dev', 10, 4);
      const ids = [[400, 100], [440, 200], [470, 900], [520, 300]].map(([dist, hp]) => {
        const e = g.spawnEnemy('req', { dist: dist! });
        e.hp = hp!;
        return e.id;
      });
      g.apply({ type: 'target', towerId: t.id, mode });
      g.step();
      return ids.indexOf(t.targetId!);
    };
    expect(pick('first')).toBe(3);
    expect(pick('last')).toBe(0);
    expect(pick('strong')).toBe(2);
    expect(pick('near')).toBe(1);
  });
  it('Stärkster bei Gleichstand: weiter vorn', () => {
    const g = rich();
    const t = place(g, 'dev', 10, 4);
    const a = g.spawnEnemy('req', { dist: 420 });
    const b = g.spawnEnemy('req', { dist: 460 });
    a.hp = b.hp = 500;
    g.apply({ type: 'target', towerId: t.id, mode: 'strong' });
    g.step();
    expect(t.targetId).toBe(b.id);
  });
  it('Schuss-Rollen nutzen den Modus ebenfalls (Dualo, Hinterster)', () => {
    const g = rich();
    const t = place(g, 'dualo', 10, 3);
    const a = g.spawnEnemy('req', { dist: 410 });
    g.spawnEnemy('req', { dist: 470 });
    g.apply({ type: 'target', towerId: t.id, mode: 'last' });
    const ev = g.step();
    const shot = ev.find((e) => e.type === 'fired');
    if (shot?.type === 'fired') expect(shot.shot.targetId).toBe(a.id);
    else expect(ev.some((e) => e.type === 'absent')).toBe(true);
  });
});

describe('Upgrade-Zweige: Regeln', () => {
  it('jede Rolle hat zwei benannte Zweige; Zweigwahl beim Schritt 2 → 3', () => {
    expect(BRANCH_LEVEL).toBe(3);
    for (const r of TOWER_ORDER) {
      expect(BRANCHES[r].a.id).toBe('a');
      expect(BRANCHES[r].b.id).toBe('b');
      expect(BRANCHES[r].a.name).not.toBe(BRANCHES[r].b.name);
      expect(BRANCHES[r].a.description.length).toBeGreaterThan(0);
    }
    expect([BRANCHES.dev.a.name, BRANCHES.dev.b.name]).toEqual(['Full-Stack', '10x-Dev']);
    expect([BRANCHES.scrum.a.name, BRANCHES.scrum.b.name]).toEqual(['Coach', 'Agile Coach']);
  });
  it('ohne Zweig: branchRequired, nichts bezahlt; mit Zweig: Stufe 3 und Zweig gesetzt', () => {
    const g = rich();
    const t = place(g, 'dev', 10, 4);
    g.apply({ type: 'upgrade', towerId: t.id });
    const money = g.state.money;
    expect(g.apply({ type: 'upgrade', towerId: t.id })[0]).toMatchObject({ type: 'rejected', reason: 'branchRequired' });
    expect(g.apply({ type: 'upgrade', towerId: t.id, branch: 'c' as never })[0]).toMatchObject({ type: 'rejected', reason: 'branchRequired' });
    expect([t.level, t.branch, g.state.money]).toEqual([2, null, money]);
    const ev = g.apply({ type: 'upgrade', towerId: t.id, branch: 'b' });
    expect(ev[0]).toMatchObject({ type: 'upgraded', cost: 192 });
    expect([t.level, t.branch]).toEqual([3, 'b']);
  });
  it('Zweig vor Stufe 2 und nach Stufe 3 wird ignoriert und ohne Zweig aufgezeichnet', () => {
    const g = rich();
    const t = place(g, 'dev', 10, 4);
    g.apply({ type: 'upgrade', towerId: t.id, branch: 'a' });
    expect([t.level, t.branch]).toEqual([2, null]);
    g.apply({ type: 'upgrade', towerId: t.id, branch: 'b' });
    g.apply({ type: 'upgrade', towerId: t.id, branch: 'a' });
    g.apply({ type: 'upgrade', towerId: t.id });
    expect([t.level, t.branch]).toEqual([5, 'b']);
    expect(g.toReplay().commands.filter((c) => c[1] === 'upgrade')).toEqual([
      [0, 'upgrade', t.id], [0, 'upgrade', t.id, 'b'], [0, 'upgrade', t.id], [0, 'upgrade', t.id],
    ]);
  });
  it('replay-fest: Zweige und Zielmodi rechnen gleich nach, anderer Zweig weicht ab', () => {
    const g = makeGame(8);
    g.apply({ type: 'place', tower: 'dev', cx: 5, cy: 4 });
    g.apply({ type: 'target', towerId: 1, mode: 'near' });
    const s = g.state;
    for (let i = 0; i < 12000 && !s.over; i++) {
      if (!s.running) g.apply({ type: 'startWave' });
      const dev = g.towerById(1)!;
      const cost = g.upgradeCost(dev);
      if (cost !== null && s.money >= cost) g.apply(dev.level === 2 ? { type: 'upgrade', towerId: 1, branch: 'a' } : { type: 'upgrade', towerId: 1 });
      g.step();
    }
    expect(g.towerById(1)!.branch).toBe('a');
    const r = g.toReplay();
    expect(runReplay(parseReplay(JSON.stringify(r))).matches).toBe(true);
    const other = JSON.parse(JSON.stringify(r));
    const idx = other.commands.findIndex((c: unknown[]) => c[3] === 'a');
    other.commands[idx][3] = 'b';
    expect(runReplay(parseReplay(other)).matches).toBe(false);
  });
});

describe('Upgrade-Zweige: Wirkung', () => {
  it('Entwickler: Full-Stack +25 % Reichweite, 10x-Dev +40 % DPS', () => {
    const g = rich();
    const a = place(g, 'dev', 10, 4);
    const b = place(g, 'dev', 12, 4);
    raise(g, a, 3, 'a');
    raise(g, b, 3, 'b');
    expect(g.towerStats(a).range).toBeCloseTo(150 * 1.2 * 1.25, 9);
    expect(g.towerStats(a).dps).toBeCloseTo(45 * 2.25, 9);
    expect(g.towerStats(b).range).toBeCloseTo(150 * 1.2, 9);
    expect(g.towerStats(b).dps).toBeCloseTo(45 * 2.25 * 1.4, 9);
  });
  it('Dualo/Analyst/PPL: Faktoren auf die Stufenwerte', () => {
    const g = rich();
    const d = place(g, 'dualo', 5, 4);
    raise(g, d, 4, 'b');
    expect(g.towerStats(d).rate).toBeCloseTo(0.35 * 0.729 * 0.7, 9);
    expect(g.towerStats(d).range).toBeCloseTo(100 * 1.3 * 0.9, 9);
    const an = place(g, 'analyst', 5, 9);
    raise(g, an, 3, 'b');
    expect(g.towerStats(an).dmg).toBeCloseTo(5 * 2.25 * 2.2, 9);
    expect(g.towerStats(an).range).toBeCloseTo(105 * 1.2 * 1.1, 9);
    const p = place(g, 'ppl', 15, 9);
    raise(g, p, 3, 'a');
    expect(g.towerStats(p).dmg).toBeCloseTo(40 * 2.25 * 1.1, 9);
  });
  it('Werkstudent:in fällt nie aus, Hackathon-Held schon', () => {
    const count = (branch: Branch): number => {
      const g = rich();
      const t = place(g, 'dualo', 10, 3);
      raise(g, t, 3, branch);
      const e = g.spawnEnemy('req', { dist: 440 });
      let absent = 0;
      for (let i = 0; i < 6000; i++) {
        e.hp = 1e6;
        g.placeAt(e, 440);
        absent += g.step().filter((x) => x.type === 'absent').length;
      }
      return absent;
    };
    expect(count('a')).toBe(0);
    expect(count('b')).toBeGreaterThan(0);
  });
  it('Requirements Engineer: Verlangsamung × 1,6', () => {
    const g = rich();
    const t = place(g, 'analyst', 10, 3);
    raise(g, t, 3, 'a');
    const e = g.spawnEnemy('req', { dist: 440 });
    e.hp = 1e6;
    for (let i = 0; i < 300; i++) {
      const ev = g.step();
      if (ev.some((x) => x.type === 'slowed' && x.enemy.id === e.id)) {
        expect(e.slowTime).toBeCloseTo((1.5 + 0.3 * 3) * 1.6, 9);
        return;
      }
    }
    throw new Error('kein Treffer');
  });
  it('Product Owner: Teamboost × 1,4 im vergrößerten Aura-Radius', () => {
    const g = rich();
    const dev = place(g, 'dev', 10, 4);
    const ppl = placeNear(g, 'ppl', dev, 125, 145);
    expect(g.towerStats(dev).boosted).toBe(false);
    raise(g, ppl, 3, 'b');
    expect(g.towerStats(dev).boosted).toBe(true);
    expect(g.towerStats(dev).dps).toBeCloseTo(45 * 1.4, 9);
  });
  it('Agile Coach: Treffer verlangsamen Gegner im Umkreis 80 px für 1,2 s', () => {
    const g = rich();
    const t = place(g, 'scrum', 10, 3);
    raise(g, t, 3, 'b');
    const target = g.spawnEnemy('req', { dist: 460 });
    const near = g.spawnEnemy('req', { dist: 400 });
    const far = g.spawnEnemy('req', { dist: 300 });
    for (const e of [target, near, far]) e.hp = 1e6;
    for (let i = 0; i < 300; i++) {
      const ev = g.step();
      if (ev.some((x) => x.type === 'hit' && x.enemyId === target.id)) {
        expect(near.slowTime).toBeCloseTo(1.2, 9);
        expect(far.slowTime).toBeLessThanOrEqual(0);
        return;
      }
    }
    throw new Error('kein Treffer');
  });
  it('Enterprise-Architekt: Runway +15 Prozentpunkte', () => {
    const g = rich();
    const e = g.spawnEnemy('req', { dist: 300 });
    e.hp = 1000;
    placeNear(g, 'dev', e, 40, 70);
    const rta = placeNear(g, 'rta', e, 70, 100);
    raise(g, rta, 3, 'a');
    g.step();
    expect(1000 - e.hp).toBeCloseTo(0.75 * (1.25 + 0.1 + 0.15), 6);
  });
  it('RTO: Value Stream × 1,5, Budget-Hüter 4 % Zinsen (max. 60 SP)', () => {
    const value = (branch: Branch, money: number): number => {
      const g = rich();
      const t = place(g, 'rto', 0, 0);
      raise(g, t, 3, branch);
      g.state.money = money;
      g.apply({ type: 'startWave' });
      g.state.queue = [];
      const ev = g.step();
      const bv = ev.find((x) => x.type === 'businessValue');
      return bv?.type === 'businessValue' ? bv.amount : -1;
    };
    expect(value('a', 0)).toBe(Math.round(35 * 1.5));
    expect(value('b', 500)).toBe(35 + Math.floor(((500 + 45) * 4) / 100));
    expect(value('b', 100000)).toBe(35 + 60);
  });
  it('RTE Taktgeber: PI-Sync alle 7,5 s; Vorstand CFO-Fokus: Intervall × 0,8', () => {
    const g = rich();
    const rte = place(g, 'rte', 10, 4);
    raise(g, rte, 3, 'a');
    const board = place(g, 'board', 0, 0);
    raise(g, board, 3, 'b');
    g.apply({ type: 'startWave' });
    g.spawnEnemy('req', { dist: 100 }).hp = 1e6;
    g.step();
    expect(rte.cooldown).toBeCloseTo(10 * 0.75, 9);
    expect(board.cooldown).toBeCloseTo((20 - 2) * 0.8, 9);
    stepN(g, 1);
    expect(rte.cooldown).toBeCloseTo(10 * 0.75 - DT, 9);
  });
});
