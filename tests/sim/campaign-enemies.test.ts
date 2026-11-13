import { describe, expect, it } from 'vitest';
import { DT, ENEMIES, Game, PAIR_GAP, type Enemy, type EnemyType, type SimEvent } from '../../src/sim/index';
import { cellNear, place, stepN, stepUntil } from './helpers';

// Spec campaigns AC-2: 8 neue Gegner + 4 Bosse (Literalwerte nach Bot-Tuning, Mechaniken laut Tabelle).

function arena(): Game {
  const g = new Game({ seed: 7, mapId: 'waterfall' });
  g.state.money = 100000;
  g.state.wave = 1;
  return g;
}

function placeNear(g: Game, type: Parameters<typeof place>[1], e: { x: number; y: number }, lo: number, hi: number) {
  const c = cellNear(g, type, e, lo, hi);
  return place(g, type, c.cx, c.cy);
}

/** Gegner mit fester HP (über Max-HP, damit nichts geheilt wird und nichts stirbt). */
function spawn(g: Game, type: EnemyType, dist: number, hp = 1000): Enemy {
  const e = g.spawnEnemy(type, { dist });
  e.hp = hp;
  return e;
}

const fields = (t: EnemyType): [number, number, number, number] => {
  const e = ENEMIES[t];
  return [e.hp, e.speed, e.reward, e.leakDamage];
};

describe('AC-2 Literalwerte', () => {
  it('Team: Impediment, Spike', () => {
    expect(fields('impediment')).toEqual([90, 40, 10, 6]);
    expect(ENEMIES.impediment.stall).toEqual({ every: 4, time: 1.2, dmg: 0.6 });
    expect(fields('spike')).toEqual([20, 80, 4, 4]);
    expect(ENEMIES.spike.sprint).toEqual({ every: 3, time: 0.8, factor: 2.2 });
  });
  it('ART: Abhängigkeit, Enabler Story', () => {
    expect(fields('dependency')).toEqual([45, 58, 7, 5]);
    expect(ENEMIES.dependency.pair).toBe(true);
    expect(fields('enabler')).toEqual([50, 52, 9, 5]);
    expect(ENEMIES.enabler.heal).toEqual({ radius: 70, pct: 0.04, every: 1 });
  });
  it('Large Solution: Compliance-Audit, Schatten-IT, Vendor Lock-in', () => {
    expect(fields('compliance')).toEqual([140, 36, 14, 8]);
    expect(ENEMIES.compliance.armor).toBe(0.5);
    expect(fields('shadow-it')).toEqual([40, 75, 9, 5]);
    expect(ENEMIES['shadow-it'].stealth).toBe(true);
    expect(fields('vendor-lock')).toEqual([80, 44, 12, 6]);
    expect(ENEMIES['vendor-lock'].drag).toEqual({ radius: 75, factor: 0.6 });
  });
  it('Portfolio: Epic', () => {
    expect(fields('epic')).toEqual([320, 30, 30, 12]);
    expect(ENEMIES.epic.splitInto).toEqual({ type: 'feat', count: 3 });
  });
  it('Bosse (HP nach Bot-Tuning: b-pi 1200, b-hydra 1100, b-lbc 1700)', () => {
    expect(fields('b-scope')).toEqual([1400, 26, 160, 40]);
    expect([ENEMIES['b-scope'].grow, ENEMIES['b-scope'].minion]).toEqual([0.05, { type: 'story', every: 5 }]);
    expect(fields('b-pi')).toEqual([1200, 24, 180, 40]);
    expect([ENEMIES['b-pi'].jam, ENEMIES['b-pi'].jamTime, ENEMIES['b-pi'].jamEvery]).toEqual([110, 1.5, 6]);
    expect(fields('b-hydra')).toEqual([1100, 24, 200, 40]);
    expect([ENEMIES['b-hydra'].armor, ENEMIES['b-hydra'].phases]).toEqual([0.5, { at: [0.66, 0.33], type: 'dependency', count: 2 }]);
    expect(fields('b-lbc')).toEqual([1700, 22, 250, 40]);
    expect([ENEMIES['b-lbc'].armor, ENEMIES['b-lbc'].budgetCut]).toEqual([0.5, { every: 8, pct: 10 }]);
  });
  it('Kampagne und Boss-Marker', () => {
    const campaign: Record<string, string> = {
      impediment: 'team', spike: 'team', 'b-scope': 'team', dependency: 'art', enabler: 'art', 'b-pi': 'art',
      compliance: 'solution', 'shadow-it': 'solution', 'vendor-lock': 'solution', 'b-hydra': 'solution', epic: 'portfolio', 'b-lbc': 'portfolio',
    };
    for (const [id, c] of Object.entries(campaign)) expect(ENEMIES[id as EnemyType].campaign, id).toBe(c);
    for (const id of ['b-scope', 'b-pi', 'b-hydra', 'b-lbc'] as const) expect(ENEMIES[id].boss).toBe(true);
    for (const id of ['impediment', 'spike', 'dependency', 'enabler', 'compliance', 'shadow-it', 'vendor-lock', 'epic'] as const) {
      expect(ENEMIES[id].boss).toBeUndefined();
    }
  });
});

describe('AC-2 Impediment', () => {
  it('bleibt alle 4 s für 1,2 s stehen (Event stalled) und läuft danach weiter', () => {
    const g = arena();
    const e = spawn(g, 'impediment', 200);
    const { events, ticks } = stepUntil(g, (ev) => ev.some((x) => x.type === 'stalled'));
    expect(ticks).toBeGreaterThanOrEqual(239);
    expect(ticks).toBeLessThanOrEqual(241);
    expect(events.find((x) => x.type === 'stalled')).toMatchObject({ duration: 1.2 });
    const at = e.dist;
    stepN(g, 70);
    expect(e.dist).toBe(at);
    stepN(g, 5);
    expect(e.dist).toBeGreaterThan(at);
    const next = stepUntil(g, (ev) => ev.some((x) => x.type === 'stalled'));
    expect(next.ticks + 75).toBeGreaterThanOrEqual(239 + 72);
    expect(next.ticks + 75).toBeLessThanOrEqual(241 + 74);
  });
  it('Tempo 40 px/s, während des Stehens −40 % Schaden', () => {
    const g = arena();
    const e = spawn(g, 'impediment', 200);
    const dev = placeNear(g, 'dev', e, 40, 70);
    let hp = e.hp;
    let d = e.dist;
    g.step();
    expect(e.dist - d).toBeCloseTo(40 * DT, 9);
    expect(hp - e.hp).toBeCloseTo(0.75, 6);
    g.apply({ type: 'sell', towerId: dev.id });
    stepUntil(g, (ev) => ev.some((x) => x.type === 'stalled'));
    placeNear(g, 'dev', e, 40, 70);
    hp = e.hp;
    d = e.dist;
    g.step();
    expect(e.dist).toBe(d);
    expect(hp - e.hp).toBeCloseTo(0.75 * 0.6, 6);
  });
});

describe('AC-2 Spike', () => {
  it('alle 3 s 0,8 s Sprint mit Tempo × 2,2', () => {
    const g = arena();
    const e = spawn(g, 'spike', 100);
    let d = e.dist;
    g.step();
    expect(e.dist - d).toBeCloseTo(80 * DT, 9);
    const { events, ticks } = stepUntil(g, (ev) => ev.some((x) => x.type === 'sprinted'));
    expect(ticks + 1).toBeGreaterThanOrEqual(179);
    expect(ticks + 1).toBeLessThanOrEqual(181);
    expect(events.find((x) => x.type === 'sprinted')).toMatchObject({ duration: 0.8 });
    d = e.dist;
    g.step();
    expect(e.dist - d).toBeCloseTo(80 * 2.2 * DT, 9);
    stepN(g, 50);
    d = e.dist;
    g.step();
    expect(e.dist - d).toBeCloseTo(80 * DT, 9);
  });
});

describe('AC-2 Abhängigkeit', () => {
  it('spawnt als gekoppeltes Paar im Abstand PAIR_GAP', () => {
    const g = arena();
    g.state.wave = 0;
    g.apply({ type: 'startWave' });
    g.state.queue = ['dependency'];
    const ev = g.step();
    const spawned = ev.filter((x): x is Extract<SimEvent, { type: 'spawned' }> => x.type === 'spawned').map((x) => x.enemy);
    expect(spawned.map((x) => x.type)).toEqual(['dependency', 'dependency']);
    const [a, b] = spawned as [Enemy, Enemy];
    expect(a.partnerId).toBe(b.id);
    expect(b.partnerId).toBe(a.id);
    expect(a.dist - b.dist).toBeCloseTo(PAIR_GAP, 9);
  });
  it('Schaden wird 50/50 geteilt, solange beide leben; danach voller Schaden', () => {
    const g = arena();
    g.state.wave = 0;
    g.apply({ type: 'startWave' });
    g.state.queue = ['dependency'];
    g.step();
    const [a, b] = g.state.enemies as [Enemy, Enemy];
    a.hp = 1000;
    b.hp = 1000;
    stepN(g, 200);
    placeNear(g, 'dev', a, 40, 70);
    g.step();
    expect(1000 - a.hp).toBeCloseTo(0.375, 6);
    expect(1000 - b.hp).toBeCloseTo(0.375, 6);
    b.hp = 0;
    g.step();
    const hp = a.hp;
    g.step();
    expect(hp - a.hp).toBeCloseTo(0.75, 6);
  });
});

describe('AC-2 Enabler Story', () => {
  it('heilt andere Gegner im Umkreis 70 px um 4 % Max-HP pro Sekunde, nicht sich selbst, keine Bosse', () => {
    const g = arena();
    const en = g.spawnEnemy('enabler', { dist: 300 });
    en.hp = en.maxHp / 2;
    const near = g.spawnEnemy('req', { dist: 330 });
    near.hp = near.maxHp / 2;
    const boss = g.spawnEnemy('boss', { dist: 320 });
    boss.hp = boss.maxHp / 2;
    const far = g.spawnEnemy('req', { dist: 450 });
    far.hp = far.maxHp / 2;
    const { events, ticks } = stepUntil(g, (ev) => ev.some((x) => x.type === 'healed'));
    expect(ticks).toBeGreaterThanOrEqual(59);
    expect(ticks).toBeLessThanOrEqual(61);
    const h = events.find((x) => x.type === 'healed')!;
    expect(h).toMatchObject({ enemyIds: [near.id], radius: 70 });
    expect(h.type === 'healed' && h.amount).toBeCloseTo(near.maxHp * 0.04, 9);
    expect(near.hp).toBeCloseTo(near.maxHp * 0.54, 9);
    expect(en.hp).toBeCloseTo(en.maxHp / 2, 9);
    expect(boss.hp).toBeCloseTo(boss.maxHp / 2, 9);
    expect(far.hp).toBeCloseTo(far.maxHp / 2, 9);
  });
  it('heilt höchstens bis Max-HP', () => {
    const g = arena();
    g.spawnEnemy('enabler', { dist: 300 });
    const o = g.spawnEnemy('req', { dist: 310 });
    o.hp = o.maxHp - 0.1;
    const { events } = stepUntil(g, (ev) => ev.some((x) => x.type === 'healed'));
    expect(o.hp).toBe(o.maxHp);
    const h = events.find((x) => x.type === 'healed')!;
    expect(h.type === 'healed' && h.amount).toBeCloseTo(0.1, 9);
  });
});

describe('AC-2 Compliance-Audit', () => {
  it('Panzer: −50 % Schaden, außer im RTA-Runway (dort Runway-Faktor ohne Panzer)', () => {
    const g = arena();
    const e = spawn(g, 'compliance', 300);
    placeNear(g, 'dev', e, 40, 70);
    g.step();
    expect(1000 - e.hp).toBeCloseTo(0.375, 6);
    placeNear(g, 'rta', e, 70, 100);
    const hp = e.hp;
    g.step();
    expect(hp - e.hp).toBeCloseTo(0.75 * 1.25, 6);
  });
});

describe('AC-2 Schatten-IT', () => {
  it('nicht anvisierbar ohne Business Analyst/RTA in Reichweite', () => {
    const g = arena();
    const e = spawn(g, 'shadow-it', 300);
    const dev = placeNear(g, 'dev', e, 40, 70);
    stepN(g, 5);
    expect(e.hp).toBe(1000);
    expect(e.hidden).toBe(true);
    expect(dev.targetId).toBeNull();
  });
  it('Business Analyst in Reichweite deckt auf (Event revealed), dann wird sie getroffen', () => {
    const g = arena();
    const e = spawn(g, 'shadow-it', 300);
    placeNear(g, 'dev', e, 40, 70);
    placeNear(g, 'analyst', e, 40, 80);
    const ev = g.step();
    expect(ev.filter((x) => x.type === 'revealed').map((x) => x.type === 'revealed' && x.enemy.id)).toEqual([e.id]);
    expect(e.hidden).toBe(false);
    expect(e.hp).toBeLessThan(1000);
    expect(g.step().some((x) => x.type === 'revealed')).toBe(false);
  });
  it('RTA deckt ebenfalls auf, andere Rollen nicht', () => {
    for (const [role, seen] of [['rta', true], ['scrum', false], ['rte', false]] as const) {
      const g = arena();
      const e = spawn(g, 'shadow-it', 300);
      placeNear(g, role, e, 40, 80);
      g.step();
      expect(e.hidden, role).toBe(!seen);
    }
  });
});

describe('AC-2 Vendor Lock-in', () => {
  it('Rollen im Umkreis 75 px arbeiten 40 % langsamer', () => {
    const g = arena();
    const e = spawn(g, 'vendor-lock', 300);
    const near = placeNear(g, 'dualo', e, 30, 60);
    const far = placeNear(g, 'dualo', e, 120, 200);
    near.cooldown = 10;
    far.cooldown = 10;
    g.step();
    expect(near.cooldown).toBeCloseTo(10 - 0.6 * DT, 9);
    expect(far.cooldown).toBeCloseTo(10 - DT, 9);
  });
  it('Entwickler-Strahl im Umkreis: DPS × 0,6', () => {
    const g = arena();
    const e = spawn(g, 'vendor-lock', 300);
    placeNear(g, 'dev', e, 30, 60);
    g.step();
    expect(1000 - e.hp).toBeCloseTo(0.75 * 0.6, 6);
  });
});

describe('AC-2 Epic', () => {
  it('zerfällt beim Erledigen in 3 Features an seiner Position', () => {
    const g = arena();
    const e = g.spawnEnemy('epic', { dist: 300 });
    e.hp = 0.01;
    placeNear(g, 'dev', e, 40, 70);
    const ev = g.step();
    expect(ev.some((x) => x.type === 'killed' && x.enemy.id === e.id)).toBe(true);
    expect(ev.some((x) => x.type === 'split' && x.enemy.id === e.id)).toBe(true);
    const feats = g.state.enemies.filter((x) => x.type === 'feat');
    expect(feats).toHaveLength(3);
    for (const f of feats) expect(f.dist).toBeCloseTo(e.dist, 6);
  });
});

describe('AC-2 Boss Sprint-Scope-Explosion', () => {
  it('wächst bis 2× Max-HP und spawnt alle 5 s eine User Story an seiner Position', () => {
    const g = arena();
    const b = g.spawnEnemy('b-scope', { dist: 100 });
    const base = b.maxHp;
    const { events, ticks } = stepUntil(g, (ev) => ev.some((x) => x.type === 'spawnedMinion'));
    expect(ticks).toBeGreaterThanOrEqual(299);
    expect(ticks).toBeLessThanOrEqual(301);
    const m = events.find((x) => x.type === 'spawnedMinion')!;
    expect(m.type === 'spawnedMinion' && m.minion.type).toBe('story');
    expect(m.type === 'spawnedMinion' && m.enemy.id).toBe(b.id);
    expect(b.maxHp).toBeGreaterThan(base * 1.2);
    stepN(g, 1200);
    expect(b.maxHp).toBeCloseTo(base * 2, 6);
  });
});

describe('AC-2 Boss Big-Room-Chaos', () => {
  it('Meeting-Störung im Umkreis 110 px für 1,5 s, alle 6 s (erstmals nach 1 s)', () => {
    const g = arena();
    const b = spawn(g, 'b-pi', 300, 1e6);
    const near = placeNear(g, 'scrum', b, 80, 105);
    const far = placeNear(g, 'scrum', b, 130, 200);
    const first = stepUntil(g, (ev) => ev.some((x) => x.type === 'jammed'));
    expect(first.ticks).toBeGreaterThanOrEqual(59);
    expect(first.ticks).toBeLessThanOrEqual(61);
    expect(first.events.find((x) => x.type === 'jammed')).toMatchObject({ towerIds: [near.id], radius: 110 });
    expect(near.offTime).toBeCloseTo(1.5 - DT, 9);
    expect(far.offTime).toBe(0);
    expect(b.jamCooldown).toBeCloseTo(6, 9);
  });
});

describe('AC-2 Boss Integrations-Hydra', () => {
  it('gepanzert wie Compliance', () => {
    const g = arena();
    const b = spawn(g, 'b-hydra', 300, 1e6);
    placeNear(g, 'dev', b, 40, 70);
    g.step();
    expect(1e6 - b.hp).toBeCloseTo(0.375, 4);
  });
  it('bei 66 % und 33 % HP: neue Phase und 2 Abhängigkeiten (ein Paar) an ihrer Position', () => {
    const g = arena();
    const b = g.spawnEnemy('b-hydra', { dist: 300 });
    placeNear(g, 'dev', b, 40, 70);
    b.hp = b.maxHp * 0.66 + 0.1;
    let ev = g.step();
    expect(ev.filter((x) => x.type === 'bossPhase').map((x) => x.type === 'bossPhase' && x.phase)).toEqual([1]);
    let minions = ev.filter((x) => x.type === 'spawnedMinion').map((x) => (x.type === 'spawnedMinion' ? x.minion : null)!);
    expect(minions.map((m) => m.type)).toEqual(['dependency', 'dependency']);
    expect(minions[0]!.partnerId).toBe(minions[1]!.id);
    for (const m of minions) m.hp = 0;
    b.hp = b.maxHp * 0.33 + 0.1;
    ev = g.step();
    expect(ev.filter((x) => x.type === 'bossPhase').map((x) => x.type === 'bossPhase' && x.phase)).toEqual([2]);
    minions = ev.filter((x) => x.type === 'spawnedMinion').map((x) => (x.type === 'spawnedMinion' ? x.minion : null)!);
    expect(minions).toHaveLength(2);
    b.hp = b.maxHp * 0.1;
    expect(g.step().some((x) => x.type === 'bossPhase')).toBe(false);
  });
  it('beide Schwellen in einem Treffer: beide Phasen, 4 Abhängigkeiten', () => {
    const g = arena();
    const b = g.spawnEnemy('b-hydra', { dist: 300 });
    placeNear(g, 'dev', b, 40, 70);
    b.hp = b.maxHp * 0.2;
    const ev = g.step();
    expect(ev.filter((x) => x.type === 'bossPhase')).toHaveLength(2);
    expect(ev.filter((x) => x.type === 'spawnedMinion')).toHaveLength(4);
    expect(b.phase).toBe(2);
  });
});

describe('AC-2 Boss Lean Business Case Q4', () => {
  it('alle 8 s Budget-Kürzung um 10 % der aktuellen Kapazität (abgerundet), gepanzert', () => {
    const g = arena();
    const b = spawn(g, 'b-lbc', 100, 1e6);
    g.state.money = 1009;
    const { events, ticks } = stepUntil(g, (ev) => ev.some((x) => x.type === 'budgetCut'), 600);
    expect(ticks).toBeGreaterThanOrEqual(479);
    expect(ticks).toBeLessThanOrEqual(481);
    expect(events.find((x) => x.type === 'budgetCut')).toMatchObject({ amount: 100 });
    expect(g.state.money).toBe(909);
    g.state.money = 5;
    stepUntil(g, (ev) => ev.some((x) => x.type === 'budgetCut'), 600);
    expect(g.state.money).toBe(5);
    expect(ENEMIES[b.type].armor).toBe(0.5);
  });
});
