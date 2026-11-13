import { describe, expect, it } from 'vitest';
import { GAME_VERSION, Game, MAX_REPLAY_TICKS, parseReplay, runReplay, type ReplayV3, type SkillLoadout } from '../../src/sim/index';
import { playStrongBot } from '../../tools/bot-strong';

// Spec campaigns: Replay-Format 3 (Level, Loadout, Zielmodi, Upgrade-Zweige) – AC-3, AC-4.

const LOADOUT: SkillLoadout = { 'team-pair': 2, 'team-tdd': 1, 'lead-servant': 1 };

/** Gescripteter Level-Lauf (ohne Eingriffe in den Zustand) mit Zweig- und Zielmodus-Kommandos. */
function scripted(loadout: SkillLoadout = LOADOUT): Game {
  const g = new Game({ seed: 99, levelId: 'team-3', loadout });
  const s = g.state;
  g.apply({ type: 'place', tower: 'dev', cx: 7, cy: 3 });
  g.apply({ type: 'place', tower: 'dualo', cx: 8, cy: 3 });
  g.apply({ type: 'target', towerId: 2, mode: 'strong' });
  g.apply({ type: 'upgrade', towerId: 1 });
  for (let i = 0; i < 9000 && !s.over; i++) {
    if (!s.running) g.apply({ type: 'startWave' });
    if (i === 300) g.apply({ type: 'target', towerId: 1, mode: 'last' });
    const dev = g.towerById(1)!;
    if (dev.level === 2 && s.money >= g.upgradeCost(dev)!) {
      if (g.apply({ type: 'upgrade', towerId: 1 })[0]?.type !== 'rejected') throw new Error('branchRequired erwartet');
      g.apply({ type: 'upgrade', towerId: 1, branch: 'b' });
    }
    if (i > 600 && s.towers.length === 2 && s.money >= g.towerCost('scrum')) {
      const ev = g.apply({ type: 'place', tower: 'scrum', cx: 7, cy: 1 });
      const placed = ev.find((e) => e.type === 'placed');
      if (placed?.type === 'placed') g.apply({ type: 'target', towerId: placed.tower.id, mode: 'near' });
    }
    g.step();
  }
  return g;
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const clone = (r: ReplayV3): any => JSON.parse(JSON.stringify(r));

describe('Replay v3 im Level-Modus', () => {
  it('Roundtrip: Level, Loadout, Zweige und Zielmodi stehen im Replay und rechnen gleich nach', () => {
    const g = scripted();
    const r = g.toReplay();
    expect(r).toMatchObject({ format: 3, gameVersion: GAME_VERSION, seed: 99, levelId: 'team-3', mapId: 'spaghetti', mode: 'level' });
    expect(r.loadout).toEqual({ 'team-pair': 2, 'team-tdd': 1, 'lead-servant': 1 });
    expect(r.commands).toContainEqual([0, 'target', 2, 'strong']);
    expect(r.commands).toContainEqual([300, 'target', 1, 'last']);
    expect(r.commands.some((c) => c[1] === 'upgrade' && c[2] === 1 && c[3] === 'b')).toBe(true);
    const scrum = g.state.towers.find((t) => t.type === 'scrum')!;
    expect(r.commands.some((c) => c[1] === 'target' && c[2] === scrum.id && c[3] === 'near')).toBe(true);
    expect(g.towerById(1)).toMatchObject({ level: 3, branch: 'b', targetMode: 'last' });
    expect(r.result.kills).toBe(g.state.kills);
    expect(r.result.kills).toBeGreaterThan(0);
    const check = runReplay(parseReplay(JSON.stringify(r)));
    expect(check.matches).toBe(true);
    expect(check.hash).toBe(g.stateHash());
    expect(check).toMatchObject({ kills: r.result.kills, leaks: r.result.leaks, stars: r.result.stars, bestCombo: g.state.bestCombo });
  });
  it('abgelehnte Zweig-Upgrades (branchRequired) werden nicht aufgezeichnet', () => {
    const r = scripted().toReplay();
    const ups = r.commands.filter((c) => c[1] === 'upgrade' && c[2] === 1);
    expect(ups).toHaveLength(2);
    expect(ups[0]).toEqual([0, 'upgrade', 1]);
    expect(ups[1]!.slice(1)).toEqual(['upgrade', 1, 'b']);
  });
  it('anderes Loadout → Abweichung erkannt', () => {
    const r = clone(scripted().toReplay());
    r.loadout = { 'team-pair': 2, 'team-tdd': 1 };
    expect(runReplay(parseReplay(r)).matches).toBe(false);
    const r2 = clone(scripted().toReplay());
    r2.loadout = { 'team-pair': 2, 'team-tdd': 1, 'lead-servant': 1, 'lead-ia': 3 };
    expect(runReplay(parseReplay(r2)).matches).toBe(false);
  });
  it('anderer Zweig → Abweichung erkannt', () => {
    const r = clone(scripted().toReplay());
    const i = r.commands.findIndex((c: unknown[]) => c[1] === 'upgrade' && c[3] === 'b');
    r.commands[i][3] = 'a';
    expect(runReplay(parseReplay(r)).matches).toBe(false);
  });
  it('manipulierte kills/stars/leaks → Abweichung erkannt', () => {
    for (const key of ['kills', 'leaks'] as const) {
      const r = clone(scripted().toReplay());
      r.result[key] += 1;
      expect(runReplay(parseReplay(r)).matches, key).toBe(false);
    }
    const r = clone(scripted().toReplay());
    r.result.stars = 3;
    expect(runReplay(parseReplay(r)).matches).toBe(false);
  });
  it('kompletter Bot-Lauf mit Sieg und Sternen rechnet gleich nach', () => {
    const g = playStrongBot({ seed: 5, levelId: 'team-3', maxWave: 99, loadout: { 'proc-wsjf': 1 } });
    const r = g.toReplay();
    expect(r.result.won).toBe(true);
    expect(r.result.stars).toBeGreaterThanOrEqual(1);
    const check = runReplay(parseReplay(JSON.stringify(r)));
    expect(check.matches).toBe(true);
    expect(check.stars).toBe(g.stars());
  });
});

describe('parseReplay v3', () => {
  const base = (): ReturnType<typeof clone> => clone(scripted().toReplay());
  it('lehnt Format 1 und 2 sowie fremde Versionen ab', () => {
    for (const format of [1, 2]) {
      const r = base();
      r.format = format;
      expect(() => parseReplay(r)).toThrow(/Format/);
    }
    const r = base();
    r.gameVersion = '0.3.0';
    expect(() => parseReplay(r)).toThrow(/Spielversion/);
  });
  it('Level-Modus: Level muss existieren und zur Karte passen; sonst levelId null', () => {
    let r = base();
    r.levelId = 'team-9';
    expect(() => parseReplay(r)).toThrow(/Level/);
    r = base();
    r.mapId = 'matrix';
    expect(() => parseReplay(r)).toThrow(/passt nicht/);
    r = base();
    r.mode = 'challenge';
    expect(() => parseReplay(r)).toThrow(/levelId/);
  });
  it('Loadout wird geprüft (Voraussetzungen, Ränge, unbekannte Skills)', () => {
    for (const [loadout, code] of [[{ 'team-tdd': 1 }, 'requires:team-tdd'], [{ 'team-pair': 5 }, 'rank:team-pair'], [{ x: 1 }, 'unknown:x'], [null, 'invalid']] as const) {
      const r = base();
      r.loadout = loadout;
      expect(() => parseReplay(r)).toThrow(code);
    }
  });
  it('neue Kommandos: Zielmodus und Zweig nur mit gültigen Werten', () => {
    const bad: unknown[][] = [['target', 1, 'weakest'], ['target', 1], ['upgrade', 1, 'c'], ['upgrade', 1, 'a', 'b']];
    for (const rest of bad) {
      const r = base();
      const c = [r.endTick, ...rest];
      r.commands.push(c);
      expect(() => parseReplay(r), JSON.stringify(c)).toThrow(/Kommando \d+: ungültig/);
    }
  });
  it('result braucht kills, stars (0–3) und leaks', () => {
    for (const patch of [{ kills: undefined }, { stars: 4 }, { leaks: -1 }]) {
      const r = base();
      Object.assign(r.result, patch);
      expect(() => parseReplay(r)).toThrow(/result/);
    }
  });
  it('lange Level-Läufe (bis ~80 000 Ticks) liegen unter der Tick-Grenze', () => {
    expect(MAX_REPLAY_TICKS).toBeGreaterThanOrEqual(120_000);
    const r = base();
    r.endTick = 80_000;
    expect(() => parseReplay(r)).not.toThrow();
    r.endTick = MAX_REPLAY_TICKS + 1;
    expect(() => parseReplay(r)).toThrow(/endTick/);
  });
});
