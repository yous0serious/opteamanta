import { describe, expect, it } from 'vitest';
import {
  CAMPAIGNS, COLS, ENEMIES, ENEMY_ORDER, Game, LEVELS, MAPS, ROWS, THEMES, TOWER_ORDER, campaignById, levelById, levelsOfCampaign, mapById, nextLevel,
  type EnemyType,
} from '../../src/sim/index';
import { playBot } from '../../tools/bot';
import { playStrongBot } from '../../tools/bot-strong';

// Spec campaigns: Level-Daten, Karten und Schaffbarkeit (AC-1).

describe('Kampagnen', () => {
  it('4 Kampagnen à 6 Level in fester Reihenfolge, Level 6 = Boss-Level mit dem Kampagnen-Boss', () => {
    expect(CAMPAIGNS.map((c) => c.id)).toEqual(['team', 'art', 'solution', 'portfolio']);
    expect(CAMPAIGNS.map((c) => c.theme)).toEqual(['open-office', 'big-room', 'server-room', 'boardroom']);
    expect(CAMPAIGNS.map((c) => c.boss)).toEqual(['b-scope', 'b-pi', 'b-hydra', 'b-lbc']);
    expect(LEVELS).toHaveLength(24);
    for (const c of CAMPAIGNS) {
      expect(c.levels).toEqual([1, 2, 3, 4, 5, 6].map((i) => `${c.id}-${i}`));
      expect(levelsOfCampaign(c.id).map((l) => l.id)).toEqual(c.levels);
      const boss = levelById(`${c.id}-6`)!;
      expect(boss.bossWaves).toEqual([{ wave: boss.waves, boss: c.boss }]);
      expect(campaignById(c.id)).toBe(c);
    }
  });
  it('eindeutige Level-IDs, Kampagne/Index passen zur ID', () => {
    expect(new Set(LEVELS.map((l) => l.id)).size).toBe(24);
    for (const l of LEVELS) {
      expect(l.id).toBe(`${l.campaign}-${l.index}`);
      expect(levelById(l.id)).toBe(l);
      expect(l.name.length).toBeGreaterThan(0);
      expect(l.briefing.length).toBeGreaterThan(0);
    }
    expect(levelById('team-7')).toBeUndefined();
    expect(campaignById('nope')).toBeUndefined();
  });
  it('nextLevel folgt der Kampagne und endet nach dem Boss-Level', () => {
    expect(nextLevel('team-1')?.id).toBe('team-2');
    expect(nextLevel('art-5')?.id).toBe('art-6');
    expect(nextLevel('team-6')).toBeNull();
    expect(nextLevel('portfolio-6')).toBeNull();
  });
  it('Karte gehört zum Theme der Kampagne', () => {
    for (const l of LEVELS) {
      const c = campaignById(l.campaign)!;
      expect(mapById(l.mapId)?.theme, l.id).toBe(c.theme);
    }
  });
  it('Rollen: gültig, eindeutig; Team-Kampagne schaltet schrittweise frei', () => {
    for (const l of LEVELS) {
      expect(l.roles.length, l.id).toBeGreaterThan(0);
      expect(new Set(l.roles).size, l.id).toBe(l.roles.length);
      for (const r of l.roles) expect(TOWER_ORDER, l.id).toContain(r);
    }
    const team = levelsOfCampaign('team');
    for (let i = 1; i < team.length; i++) for (const r of team[i - 1]!.roles) expect(team[i]!.roles, team[i]!.id).toContain(r);
    expect(levelById('team-1')!.roles).toEqual(['dualo', 'dev']);
    expect(levelById('team-1')!.tutorial).toBe(true);
  });
  it('Wellen-Pools: lückenlos 1…waves, gültige Gegner mit positiven Gewichten, keine Bosse im Pool', () => {
    for (const l of LEVELS) {
      let next = 1;
      for (const b of l.pool) {
        expect(b.from, l.id).toBe(next);
        expect(b.to, l.id).toBeGreaterThanOrEqual(b.from);
        expect(b.size[0] + b.size[1] * b.from, l.id).toBeGreaterThanOrEqual(1);
        const entries = Object.entries(b.weights) as [EnemyType, number][];
        expect(entries.length, l.id).toBeGreaterThan(0);
        for (const [t, w] of entries) {
          expect(ENEMY_ORDER, l.id).toContain(t);
          expect(ENEMIES[t].boss, `${l.id} ${t}`).toBeUndefined();
          expect(w, `${l.id} ${t}`).toBeGreaterThan(0);
        }
        next = b.to + 1;
      }
      expect(next - 1, l.id).toBe(l.waves);
      for (const bw of l.bossWaves) {
        expect(ENEMIES[bw.boss].boss).toBe(true);
        expect(bw.wave).toBeLessThanOrEqual(l.waves);
      }
    }
  });
  it('Sternschwellen 0 < zwei < drei ≤ 100, Startwerte positiv', () => {
    for (const l of LEVELS) {
      expect(l.stars.two, l.id).toBeGreaterThan(0);
      expect(l.stars.three, l.id).toBeGreaterThan(l.stars.two);
      expect(l.stars.three, l.id).toBeLessThanOrEqual(100);
      expect(l.startMoney, l.id).toBeGreaterThan(0);
      expect(l.waves, l.id).toBeGreaterThanOrEqual(8);
      if (l.mods?.hp !== undefined) expect(l.mods.hp, l.id).toBeGreaterThan(0);
    }
  });
});

describe('Karten', () => {
  it('16 eindeutige Karten, jedes Theme mit Name', () => {
    expect(MAPS).toHaveLength(16);
    expect(new Set(MAPS.map((m) => m.id)).size).toBe(16);
    for (const m of MAPS) expect(THEMES[m.theme]?.id).toBe(m.theme);
  });
  it('Wege: Start links außerhalb, Ende rechts außerhalb, achsenparallele Segmente, innen im Spielfeld', () => {
    for (const m of MAPS) {
      const w = m.waypoints;
      expect(w[0]![0], m.id).toBe(-1);
      expect(w[w.length - 1]![0], m.id).toBe(COLS);
      for (let i = 0; i < w.length; i++) {
        const [x, y] = w[i]!;
        expect(Number.isInteger(x) && Number.isInteger(y), m.id).toBe(true);
        expect(y, m.id).toBeGreaterThanOrEqual(0);
        expect(y, m.id).toBeLessThan(ROWS);
        if (i > 0 && i < w.length - 1) {
          expect(x, m.id).toBeGreaterThanOrEqual(0);
          expect(x, m.id).toBeLessThan(COLS);
        }
        if (i > 0) {
          const [px, py] = w[i - 1]!;
          expect((px === x) !== (py === y), `${m.id} Segment ${i}`).toBe(true);
        }
      }
    }
  });
  it('jede Karte lässt genug Bauplätze frei', () => {
    for (const m of MAPS) {
      const g = new Game({ seed: 1, mapId: m.id });
      expect(COLS * ROWS - g.pathCells.size, m.id).toBeGreaterThan(200);
    }
  });
});

describe('Level-Modus', () => {
  it('Game übernimmt Karte, Wellen, Startkapital, Moral und Rollen aus den Level-Daten', () => {
    for (const l of LEVELS) {
      const g = new Game({ seed: 3, levelId: l.id });
      expect(g.state.mode).toBe('level');
      expect(g.state.levelId).toBe(l.id);
      expect(g.state.mapId).toBe(l.mapId);
      expect(g.state.waves).toBe(l.waves);
      expect(g.state.money).toBe(l.startMoney);
      expect(g.state.lives).toBe(l.lives ?? 100);
      expect(g.roles).toEqual(l.roles);
    }
  });
  it('gesperrte Rolle wird mit roleLocked abgelehnt', () => {
    const g = new Game({ seed: 1, levelId: 'team-1' });
    expect(g.canPlace('analyst', 0, 0)).toBe('roleLocked');
    const ev = g.apply({ type: 'place', tower: 'analyst', cx: 0, cy: 0 });
    expect(ev).toEqual([{ type: 'rejected', command: { type: 'place', tower: 'analyst', cx: 0, cy: 0 }, reason: 'roleLocked' }]);
    expect(g.canPlace('dualo', 0, 0)).toBeNull();
  });
  it('unbekanntes Level, Level ohne levelId und falsche Karte werfen', () => {
    expect(() => new Game({ seed: 1, levelId: 'team-9' as never })).toThrow();
    expect(() => new Game({ seed: 1, mode: 'level' })).toThrow();
    expect(() => new Game({ seed: 1, levelId: 'team-1', mapId: 'matrix' })).toThrow();
  });
  it('HP-Multiplikator des Levels wirkt auf gespawnte Gegner', () => {
    const l = levelById('art-2')!;
    const g = new Game({ seed: 1, levelId: l.id });
    g.state.wave = 1;
    expect(g.spawnEnemy('req').hp).toBeCloseTo(30 * l.mods!.hp!, 9);
  });
  it('Tempo-Multiplikator (art-5: × 1,1)', () => {
    const g = new Game({ seed: 1, levelId: 'art-5' });
    const e = g.spawnEnemy('req', { dist: 100 });
    g.step();
    expect(e.dist - 100).toBeCloseTo((60 * 1.1) / 60, 9);
  });
});

describe('AC-1 Schaffbarkeit (Stichprobe)', () => {
  it('Referenz-Bot schafft team-1 bis team-3', () => {
    for (const id of ['team-1', 'team-2', 'team-3'] as const) {
      const g = playBot({ seed: 1, levelId: id, maxWave: 99 });
      expect(g.state.won, id).toBe(true);
      expect(g.stars(), id).toBeGreaterThanOrEqual(1);
    }
  });
  it('starker Bot schafft die Boss-Level team-6 und art-6 (Boss besiegt)', () => {
    for (const id of ['team-6', 'art-6'] as const) {
      const g = playStrongBot({ seed: 1, levelId: id, maxWave: 99 });
      expect(g.state.won, id).toBe(true);
      expect(g.state.bossesDefeated, id).toContain(levelById(id)!.bossWaves[0]!.boss);
    }
  }, 30_000);
});
