import { describe, expect, it } from 'vitest';
import { makeGame, place, stepN, stepUntil, tank } from './helpers';

describe('AC-6 Stufenskalierung', () => {
  it('Reichweite, Schaden und Rate je Stufe (dualo)', () => {
    const g = makeGame();
    const t = place(g, 'dualo', 5, 4);
    const range = [100, 110, 120, 130, 140];
    const dmg = [6, 9, 13.5, 20.25, 30.375];
    const rate = [0.35, 0.315, 0.2835, 0.25515, 0.229635];
    for (let l = 1; l <= 5; l++) {
      t.level = l;
      const s = g.towerStats(t);
      expect(s.range).toBeCloseTo(range[l - 1]!, 6);
      expect(s.dmg).toBeCloseTo(dmg[l - 1]!, 6);
      expect(s.rate).toBeCloseTo(rate[l - 1]!, 6);
    }
  });
  it('Stufe 3: Reichweite = Basis x 1.2 (dev 180)', () => {
    const g = makeGame();
    const t = place(g, 'dev', 5, 4);
    t.level = 3;
    const s = g.towerStats(t);
    expect(s.range).toBeCloseTo(180, 6);
    expect(s.dps).toBeCloseTo(101.25, 6);
  });
  it('Stufe 5: dev 227.8125 DPS', () => {
    const g = makeGame();
    const t = place(g, 'dev', 5, 4);
    t.level = 5;
    expect(g.towerStats(t).dps).toBeCloseTo(227.8125, 6);
  });
});

describe('AC-6 Zielwahl und Dauerstrahl', () => {
  it('größte Pfaddistanz gewinnt', () => {
    const g = makeGame();
    place(g, 'dev', 5, 4);
    const back = tank(g, 'obj', 280);
    const front = tank(g, 'obj', 300);
    g.step();
    expect(g.state.towers[0]!.targetId).toBe(front.id);
    expect(front.hp).toBeLessThan(1e9);
    expect(back.hp).toBe(1e9);
  });
  it('Gleichstand: zuerst gespawnter Gegner', () => {
    const g = makeGame();
    place(g, 'dev', 5, 4);
    const a = tank(g, 'obj', 300);
    tank(g, 'obj', 300);
    g.step();
    expect(g.state.towers[0]!.targetId).toBe(a.id);
  });
  it('außerhalb der Reichweite kein Ziel', () => {
    const g = makeGame();
    place(g, 'dev', 5, 4);
    const far = g.spawnEnemy('obj', { dist: 0 });
    g.step();
    expect(g.state.towers[0]!.targetId).toBeNull();
    expect(far.hp).toBeCloseTo(110, 6);
  });
  it('Dauerstrahl trifft jeden Tick dps*DT = 0.75', () => {
    const g = makeGame();
    place(g, 'dev', 5, 4);
    const e = g.spawnEnemy('obj', { dist: 300 });
    g.step();
    expect(e.hp).toBeCloseTo(109.25, 6);
    g.step();
    expect(e.hp).toBeCloseTo(108.5, 6);
    expect(g.state.towers[0]!.beam).toBe(true);
  });
});

describe('AC-6 Projektile', () => {
  it('analyst: Schuss 520 px/s, verfolgt und trifft, Schaden 5, Verlangsamung 1.8 s', () => {
    const g = makeGame();
    place(g, 'analyst', 5, 4);
    const e = g.spawnEnemy('obj', { dist: 300 });
    const fired = stepUntil(g, (ev) => ev.some((x) => x.type === 'fired'));
    const f = fired.events.find((x) => x.type === 'fired');
    expect(f && f.type === 'fired' ? f.shot.speed : 0).toBe(520);
    const hit = stepUntil(g, (ev) => ev.some((x) => x.type === 'hit' && x.enemyId === e.id), 120);
    expect(hit.ticks).toBeLessThan(60);
    expect(e.hp).toBeCloseTo(105, 6);
    expect(e.slowTime).toBeCloseTo(1.8, 6);
    // verlangsamt: halbe Geschwindigkeit (38 px/s * 0.5 * DT)
    const d0 = e.dist;
    g.step();
    expect(e.dist - d0).toBeCloseTo((38 * 0.5) / 60, 6);
  });
  it('analyst Stufe 2: Verlangsamung 2.1 s, Schaden 7.5', () => {
    const g = makeGame();
    const t = place(g, 'analyst', 5, 4);
    t.level = 2;
    const e = g.spawnEnemy('obj', { dist: 300 });
    stepUntil(g, (ev) => ev.some((x) => x.type === 'slowed'), 200);
    expect(e.slowTime).toBeCloseTo(2.1, 6);
    expect(e.hp).toBeCloseTo(102.5, 6);
  });
  it('ppl-Schuss fliegt mit 320 px/s', () => {
    const g = makeGame();
    place(g, 'ppl', 5, 4);
    tank(g, 'boss', 300);
    const { events } = stepUntil(g, (ev) => ev.some((x) => x.type === 'fired'));
    const f = events.find((x) => x.type === 'fired');
    expect(f && f.type === 'fired' ? f.shot.speed : 0).toBe(320);
  });
  it('Projektil trifft nicht, wenn das Ziel schon tot ist (kein Schaden an Dritten)', () => {
    const g = makeGame();
    place(g, 'analyst', 5, 4);
    const e = g.spawnEnemy('obj', { dist: 300 });
    stepUntil(g, (ev) => ev.some((x) => x.type === 'fired'));
    e.hp = 0;
    stepN(g, 60);
    expect(g.state.shots.length).toBe(0);
    expect(g.state.money).toBe(230);
  });
});

describe('AC-6 PPL', () => {
  function splashTest(level: number, behind: number, outside: number): { splashR: number; a: number; inside: number; out: number } {
    const g = makeGame();
    g.state.money = 1000;
    const t = place(g, 'ppl', 5, 4);
    t.level = level;
    const a = tank(g, 'boss', 300);
    const inside = tank(g, 'boss', 300 - behind);
    const out = tank(g, 'boss', 300 - outside);
    a.hp = inside.hp = out.hp = 900;
    const { events } = stepUntil(g, (ev) => ev.some((x) => x.type === 'splash'), 400);
    const sp = events.find((x) => x.type === 'splash');
    return { splashR: sp && sp.type === 'splash' ? sp.radius : -1, a: a.hp, inside: inside.hp, out: out.hp };
  }
  it('Stufe 1: Radius 65, 40 Schaden innen, außen nichts', () => {
    const r = splashTest(1, 64, 66);
    expect(r.splashR).toBeCloseTo(65, 6);
    expect(r.a).toBeCloseTo(860, 6);
    expect(r.inside).toBeCloseTo(860, 6);
    expect(r.out).toBeCloseTo(900, 6);
  });
  it('Stufe 3: Radius 78', () => {
    const r = splashTest(3, 77, 79);
    expect(r.splashR).toBeCloseTo(78, 6);
    expect(r.inside).toBeCloseTo(900 - 40 * 2.25, 6);
    expect(r.out).toBeCloseTo(900, 6);
  });
  it('Stufe 5: Radius 91', () => {
    expect(splashTest(5, 90, 92).splashR).toBeCloseTo(91, 6);
  });
  it('Aura x1.25 nur innerhalb 120, nicht stapelbar, PPL selbst nie', () => {
    const g = makeGame();
    g.state.money = 10000;
    const near = place(g, 'dev', 5, 4); // 3 Zellen = 120
    const far = place(g, 'dev', 5, 9); // weit weg
    expect(g.towerStats(near).boosted).toBe(false);
    const ppl = place(g, 'ppl', 8, 4);
    expect(g.towerStats(near).boosted).toBe(true);
    expect(g.towerStats(near).dps).toBeCloseTo(56.25, 6);
    expect(g.towerStats(far).boosted).toBe(false);
    expect(g.towerStats(far).dps).toBeCloseTo(45, 6);
    place(g, 'ppl', 5, 6);
    expect(g.towerStats(near).dps).toBeCloseTo(56.25, 6);
    expect(g.towerStats(ppl).boosted).toBe(false);
    expect(g.towerStats(ppl).dmg).toBeCloseTo(40, 6);
  });
  it('Aura: Abstand 160 außerhalb', () => {
    const g = makeGame();
    g.state.money = 10000;
    const d = place(g, 'dualo', 5, 4);
    place(g, 'ppl', 9, 4);
    expect(g.towerStats(d).boosted).toBe(false);
    expect(g.towerStats(d).dmg).toBeCloseTo(6, 6);
  });
  it('Aura wirkt im Spiel auf Dauerstrahl: 0.9375 pro Tick', () => {
    const g = makeGame();
    g.state.money = 10000;
    place(g, 'dev', 5, 4);
    place(g, 'ppl', 6, 4);
    const e = g.spawnEnemy('boss', { dist: 300 });
    g.step();
    expect(e.hp).toBeCloseTo(2340 - 0.9375, 6);
  });
});

describe('AC-6 Scrum-Rückstoß', () => {
  function pushOnce(type: 'req' | 'boss', level: number): { delta: number; cd: number } {
    const g = makeGame();
    const t = place(g, 'scrum', 5, 4);
    t.level = level;
    const e = g.spawnEnemy(type, { dist: 300 });
    for (let i = 0; i < 600; i++) {
      const before = e.dist;
      const ev = g.step();
      if (ev.some((x) => x.type === 'pushed')) return { delta: e.dist - before, cd: e.pushCooldown };
    }
    throw new Error('kein Rückstoß');
  }
  it('Stufe 1: 70 Pixel (req), abzüglich 1 px Bewegung im selben Tick', () => {
    const r = pushOnce('req', 1);
    expect(r.delta).toBeCloseTo(1 - 70, 6);
    expect(r.cd).toBeCloseTo(1.2, 6);
  });
  it('Stufe 3: 98 Pixel', () => {
    expect(pushOnce('req', 3).delta).toBeCloseTo(1 - 98, 6);
  });
  it('Boss: 10.5 Pixel, Cooldown 4 s', () => {
    const r = pushOnce('boss', 1);
    expect(r.delta).toBeCloseTo(28 / 60 - 10.5, 6);
    expect(r.cd).toBeCloseTo(4, 6);
  });
  it('Boss wird höchstens alle 4 s zurückgeschoben', () => {
    const g = makeGame();
    place(g, 'scrum', 5, 4);
    const boss = tank(g, 'boss', 300);
    const ticks: number[] = [];
    let hits = 0;
    for (let i = 0; i < 1500; i++) {
      g.placeAt(boss, 280);
      for (const ev of g.step()) {
        if (ev.type === 'pushed') ticks.push(i);
        if (ev.type === 'hit') hits++;
      }
    }
    expect(ticks.length).toBeGreaterThanOrEqual(2);
    expect(hits).toBeGreaterThan(ticks.length);
    for (let i = 1; i < ticks.length; i++) expect(ticks[i]! - ticks[i - 1]!).toBeGreaterThanOrEqual(239);
  });
  it('kein Rückstoß, wenn der Gegner den Treffer nicht überlebt', () => {
    const g = makeGame();
    place(g, 'scrum', 5, 4);
    const e = g.spawnEnemy('req', { dist: 300 });
    e.hp = 3;
    const evs = stepN(g, 120);
    expect(evs.some((x) => x.type === 'killed')).toBe(true);
    expect(evs.some((x) => x.type === 'pushed')).toBe(false);
  });
});

describe('AC-6 Dualo-Ausfall', () => {
  it('ca. 8 % der Schussversuche fallen aus, Cooldown 2 s, kein Schuss', () => {
    const g = makeGame(7);
    const t = place(g, 'dualo', 5, 4);
    const e = tank(g, 'boss', 280);
    let absent = 0;
    let fired = 0;
    for (let i = 0; i < 60000; i++) {
      g.placeAt(e, 280);
      const ev = g.step();
      const a = ev.some((x) => x.type === 'absent');
      const f = ev.some((x) => x.type === 'fired');
      if (a) {
        absent++;
        expect(f).toBe(false);
        expect(t.cooldown).toBeCloseTo(2, 6);
      }
      if (f) fired++;
      g.state.shots.length = 0;
    }
    const attempts = absent + fired;
    expect(attempts).toBeGreaterThan(1000);
    expect(Math.abs(absent / attempts - 0.08)).toBeLessThanOrEqual(0.03);
  });
});

describe('AC-6 Tech Debt schaltet Türme ab', () => {
  it('Turm im Abstand <= 75 ist 2 s außer Betrieb, weiter entfernte nicht', () => {
    const g = makeGame();
    g.state.money = 1000;
    const near = place(g, 'analyst', 7, 3);
    const far = place(g, 'analyst', 7, 4);
    const e = tank(g, 'debt', 300);
    let jam = stepUntil(g, (ev) => ev.some((x) => x.type === 'jammed'), 200);
    expect(jam.ticks).toBeGreaterThanOrEqual(60);
    expect(jam.ticks).toBeLessThanOrEqual(61);
    const j = jam.events.find((x) => x.type === 'jammed');
    expect(j && j.type === 'jammed' ? j.towerIds : []).toEqual([near.id]);
    expect(j && j.type === 'jammed' ? j.radius : 0).toBe(75);
    expect(near.offTime).toBeCloseTo(2 - 1 / 60, 6);
    expect(far.offTime).toBe(0);
    // während der Störung kein Schuss des abgeschalteten Turms
    let firedNear = 0;
    let firstFire = -1;
    for (let i = 1; i <= 140; i++) {
      g.placeAt(e, 300);
      for (const ev of g.step()) if (ev.type === 'fired' && ev.tower.id === near.id) {
        firedNear++;
        if (firstFire < 0) firstFire = i;
      }
    }
    expect(firedNear).toBeGreaterThan(0);
    expect(firstFire).toBeGreaterThanOrEqual(115);
    expect(firstFire).toBeLessThanOrEqual(125);
    // nächste Störung 3 s nach der ersten
    g.placeAt(e, 300);
    jam = stepUntil(g, (ev) => ev.some((x) => x.type === 'jammed'), 400);
    expect(140 + jam.ticks).toBeGreaterThanOrEqual(180);
    expect(140 + jam.ticks).toBeLessThanOrEqual(182);
  });
});
