import { describe, expect, it } from 'vitest';
import {
  Game, SKILLS, SKILL_BRANCHES, TOWERS, emptyModifiers, loadoutPoints, modifiersFor, normalizeLoadout, sameLoadout, skillById, validateLoadout,
  type SkillLoadout,
} from '../../src/sim/index';
import { cellNear, place } from './helpers';

// Spec campaigns: Skilltree mit 3 Ästen à 8 Knoten + Kapstein; Effekte als Modifiers (AC-4).

describe('Skilltree-Daten', () => {
  it('3 Äste à 8 Knoten (Ränge 1–3) + Kapstein (Rang 1, Reihe 5)', () => {
    expect(SKILL_BRANCHES.map((b) => b.id)).toEqual(['team', 'process', 'leadership']);
    expect(SKILLS).toHaveLength(27);
    expect(new Set(SKILLS.map((s) => s.id)).size).toBe(27);
    expect(new Set(SKILLS.map((s) => s.icon)).size).toBe(27);
    for (const b of SKILL_BRANCHES) {
      const nodes = SKILLS.filter((s) => s.branch === b.id);
      expect(nodes.filter((s) => !s.capstone)).toHaveLength(8);
      const caps = nodes.filter((s) => s.capstone);
      expect(caps).toHaveLength(1);
      expect([caps[0]!.tier, caps[0]!.maxRank]).toEqual([5, 1]);
      for (const s of nodes.filter((n) => !n.capstone)) {
        expect(s.maxRank, s.id).toBe(3);
        expect(s.tier, s.id).toBeGreaterThanOrEqual(1);
        expect(s.tier, s.id).toBeLessThanOrEqual(4);
      }
    }
  });
  it('Voraussetzungen liegen im selben Ast eine Reihe höher; Reihe 1 ohne Voraussetzung', () => {
    for (const s of SKILLS) {
      if (s.tier === 1) expect(s.requires, s.id).toEqual([]);
      for (const r of s.requires) {
        const req = skillById(r)!;
        expect(req.branch, s.id).toBe(s.branch);
        expect(req.tier, s.id).toBe(s.tier - 1);
      }
      expect(s.effects.length, s.id).toBeGreaterThan(0);
    }
  });
});

describe('modifiersFor', () => {
  it('leeres Loadout = keine Wirkung', () => {
    expect(modifiersFor({})).toEqual(emptyModifiers());
  });
  it('Effekt × Rang, Rollen-Effekte nur für die genannten Rollen', () => {
    const m = modifiersFor({ 'team-pair': 2, 'team-dual': 3, 'proc-wsjf': 1, 'proc-lbc': 3 });
    expect(m.role.dev.damage).toBe(10);
    expect(m.role.dualo).toEqual({ cost: -15, damage: 15, range: 0, rate: 0 });
    expect(m.role.analyst).toEqual({ cost: 0, damage: 0, range: 0, rate: 0 });
    expect(m.killReward).toBe(4);
    expect(m.startMoney).toBe(75);
  });
  it('Summen über mehrere Skills (Belohnung, Wellenbonus, Kapsteine)', () => {
    const m = modifiersFor({ 'proc-wsjf': 3, 'proc-rod': 2, 'proc-kanban': 1, 'proc-cap': 1, 'lead-cap': 1, 'lead-servant': 2 });
    expect(m.killReward).toBe(12 + 6);
    expect(m.waveBonus).toBe(5 + 6 + 10);
    expect(m.startMoney).toBe(100);
    expect(m.startLives).toBe(10 + 10);
    expect(m.leakDamage).toBe(-15);
    expect(m.abilityCooldown).toBe(-15);
  });
  it('Ränge werden auf 0…maxRank begrenzt, unbekannte IDs ignoriert', () => {
    expect(modifiersFor({ 'team-pair': 9 }).role.dev.damage).toBe(15);
    expect(modifiersFor({ 'team-pair': -2 }).role.dev.damage).toBe(0);
    expect(modifiersFor({ nope: 3 } as SkillLoadout)).toEqual(emptyModifiers());
  });
});

describe('validateLoadout', () => {
  it('gültig: null', () => {
    expect(validateLoadout({}, 0)).toBeNull();
    expect(validateLoadout({ 'team-pair': 3, 'team-tdd': 1 }, 4)).toBeNull();
    expect(validateLoadout({ 'team-pair': 0 }, 0)).toBeNull();
  });
  it('Fehlercodes', () => {
    expect(validateLoadout(null, 5)).toBe('invalid');
    expect(validateLoadout([], 5)).toBe('invalid');
    expect(validateLoadout('x', 5)).toBe('invalid');
    expect(validateLoadout({ nope: 1 }, 5)).toBe('unknown:nope');
    expect(validateLoadout({ 'team-pair': 4 }, 5)).toBe('rank:team-pair');
    expect(validateLoadout({ 'team-cap': 2 }, 5)).toBe('rank:team-cap');
    expect(validateLoadout({ 'team-pair': 1.5 }, 5)).toBe('rank:team-pair');
    expect(validateLoadout({ 'team-pair': '1' }, 5)).toBe('rank:team-pair');
    expect(validateLoadout({ 'team-tdd': 1 }, 5)).toBe('requires:team-tdd');
    expect(validateLoadout({ 'team-pair': 0, 'team-tdd': 1 }, 5)).toBe('requires:team-tdd');
    expect(validateLoadout({ 'team-cap': 1, 'team-mob': 1 }, 5)).toBe('requires:team-cap');
    expect(validateLoadout({ 'team-pair': 3, 'team-dual': 3 }, 5)).toBe('points');
  });
  it('voller Ast inkl. Kapstein braucht 25 Punkte', () => {
    const all: SkillLoadout = {};
    for (const s of SKILLS.filter((x) => x.branch === 'team')) all[s.id] = s.maxRank;
    expect(loadoutPoints(all)).toBe(25);
    expect(validateLoadout(all, 25)).toBeNull();
    expect(validateLoadout(all, 24)).toBe('points');
  });
});

describe('Loadout-Hilfen', () => {
  it('normalizeLoadout: nur Ränge ≥ 1, Schlüssel in SKILLS-Reihenfolge', () => {
    const n = normalizeLoadout({ 'lead-ia': 1, 'team-pair': 2, 'proc-wsjf': 0 });
    expect(n).toEqual({ 'team-pair': 2, 'lead-ia': 1 });
    expect(Object.keys(n)).toEqual(['team-pair', 'lead-ia']);
  });
  it('sameLoadout: 0 und fehlend sind gleichwertig', () => {
    expect(sameLoadout({ 'team-pair': 1, 'proc-wsjf': 0 }, { 'team-pair': 1 })).toBe(true);
    expect(sameLoadout({ 'team-pair': 1 }, { 'team-pair': 2 })).toBe(false);
    expect(sameLoadout({}, { 'lead-ia': 1 })).toBe(false);
  });
});

describe('AC-4 Wirkung im Spiel', () => {
  it('Startkapazität und Moral', () => {
    const g = new Game({ seed: 1, mapId: 'waterfall', loadout: { 'proc-wsjf': 1, 'proc-lbc': 2, 'lead-servant': 3 } });
    expect(g.state.money).toBe(300 + 50);
    expect(g.state.lives).toBe(100 + 15);
    const lvl = new Game({ seed: 1, levelId: 'team-1', loadout: { 'lead-servant': 1 } });
    expect(lvl.state.lives).toBe(105);
  });
  it('Turmkosten (gerundet) und Upgrade-Kosten', () => {
    const g = new Game({ seed: 1, mapId: 'waterfall', loadout: { 'team-dual': 3, 'proc-kanban': 1, 'proc-ci': 3 } });
    expect(g.towerCost('dualo')).toBe(26);
    expect(g.towerCost('dev')).toBe(TOWERS.dev.cost);
    g.state.money = 10000;
    const t = place(g, 'dualo', 5, 4);
    expect(g.state.money).toBe(10000 - 26);
    expect(g.upgradeCost(t)).toBe(Math.round(26 * 0.8 * 1 * 0.88));
  });
  it('Schaden und Reichweite der Rolle', () => {
    const g = new Game({ seed: 1, mapId: 'waterfall', loadout: { 'team-pair': 3, 'team-tdd': 2 } });
    g.state.money = 1000;
    const c = cellNear(g, 'dev', { x: 300, y: 100 }, 40, 80);
    const t = place(g, 'dev', c.cx, c.cy);
    const s = g.towerStats(t);
    expect(s.dps).toBeCloseTo(45 * 1.15, 9);
    expect(s.range).toBeCloseTo(150 * 1.08, 9);
  });
  it('Wellenbonus', () => {
    const g = new Game({ seed: 1, mapId: 'waterfall', loadout: { 'proc-kanban': 2 } });
    g.apply({ type: 'startWave' });
    g.state.queue = [];
    const ev = g.step();
    expect(ev.find((e) => e.type === 'waveCleared')).toMatchObject({ wave: 1, bonus: 45 + 10 });
  });
  it('Leckschaden −6 % je Rang (gerundet)', () => {
    const g = new Game({ seed: 1, mapId: 'waterfall', loadout: { 'lead-ia': 3 } });
    const e = g.spawnEnemy('boss', { dist: g.pathLength - 0.1 });
    const ev = g.step();
    expect(ev.find((x) => x.type === 'leaked' && x.enemy.id === e.id)).toMatchObject({ damage: Math.round(40 * 0.82) });
    expect(g.state.lives).toBe(100 - 33);
  });
  it('ungültiges Loadout wirft (Punkte zählen dort nicht)', () => {
    expect(() => new Game({ seed: 1, loadout: { 'team-tdd': 1 } })).toThrow(/requires:team-tdd/);
    expect(() => new Game({ seed: 1, loadout: { nope: 1 } as SkillLoadout })).toThrow(/unknown:nope/);
    expect(new Game({ seed: 1, loadout: { 'team-pair': 0 } }).state.loadout).toEqual({});
  });
});
