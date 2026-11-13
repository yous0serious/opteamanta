import { describe, expect, it } from 'vitest';
import { Game, parseReplay, runReplay } from '../../src/sim/index';
import { STANDARD_SCRIPT, runScript } from './helpers';

function recorded(): ReturnType<typeof runScript> {
  const g = runScript(42, STANDARD_SCRIPT, 8000);
  g.apply({ type: 'sell', towerId: g.state.towers[0]!.id });
  return g;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const raw = (): any => JSON.parse(JSON.stringify(recorded().toReplay()));

describe('AC-10 Replay', () => {
  it('Format 3, Roundtrip, runReplay stimmt überein und liefert denselben Hash', () => {
    const g = recorded();
    const r = g.toReplay();
    expect(r.format).toBe(3);
    expect(r.levelId).toBeNull();
    expect(r.loadout).toEqual({});
    expect(r.mode).toBe('challenge');
    expect(r.result.won).toBe(false);
    expect(r.seed).toBe(42);
    expect(r.mapId).toBe('waterfall');
    expect(r.endTick).toBe(8000);
    expect(r.commands.length).toBeGreaterThanOrEqual(5);
    expect(r.commands[0]).toEqual([0, 'place', 'dualo', 5, 4]);
    const check = runReplay(parseReplay(JSON.parse(JSON.stringify(r))));
    expect(check.matches).toBe(true);
    expect(check.hash).toBe(g.stateHash());
    expect(check.tick).toBe(8000);
    expect(check.score).toBe(g.state.score);
    expect(check.wave).toBe(g.state.wave);
    expect(check.lives).toBe(g.state.lives);
  });
  it('manipuliertes result.score -> matches false', () => {
    const r = raw();
    r.result.score += 10;
    expect(runReplay(parseReplay(r)).matches).toBe(false);
  });
  it('manipulierte Moral/Welle -> matches false', () => {
    const r = raw();
    r.result.lives -= 1;
    expect(runReplay(parseReplay(r)).matches).toBe(false);
    const r2 = raw();
    r2.result.wave += 1;
    expect(runReplay(parseReplay(r2)).matches).toBe(false);
  });
  it('unmögliches Kommando (Turm auf Pfad) -> matches false', () => {
    const r = raw();
    r.commands.push([8000, 'place', 'dualo', 5, 2]);
    expect(runReplay(parseReplay(r)).matches).toBe(false);
  });
  it('abgelehnte Kommandos werden nicht aufgezeichnet', () => {
    const g = runScript(1, [], 10);
    g.apply({ type: 'place', tower: 'dualo', cx: 5, cy: 2 });
    expect(g.toReplay().commands).toEqual([]);
  });
});

describe('AC-10 parseReplay', () => {
  it('akzeptiert gültiges Replay', () => {
    expect(() => parseReplay(raw())).not.toThrow();
  });
  it('wirft bei format 1 und 2 mit Meldung', () => {
    const r = raw();
    r.format = 1;
    expect(() => parseReplay(r)).toThrow(/Replay-Format 1/);
    r.format = 2;
    expect(() => parseReplay(r)).toThrow(/Replay-Format 2/);
  });
  it('wirft bei falscher gameVersion', () => {
    const r = raw();
    r.gameVersion = '0.1.0';
    expect(() => parseReplay(r)).toThrow();
  });
  it('wirft bei Turmtyp als Array', () => {
    const r = raw();
    r.commands = [[0, 'place', ['dualo'], 5, 4]];
    expect(() => parseReplay(r)).toThrow();
  });
  it('wirft bei cx = 24 und cy = 15', () => {
    const r = raw();
    r.commands = [[0, 'place', 'dualo', 24, 4]];
    expect(() => parseReplay(r)).toThrow();
    r.commands = [[0, 'place', 'dualo', 5, 15]];
    expect(() => parseReplay(r)).toThrow();
  });
  it('wirft bei 1e300 als Tick', () => {
    const r = raw();
    r.commands = [[1e300, 'startWave']];
    expect(() => parseReplay(r)).toThrow();
  });
  it('wirft bei unbekanntem Modus', () => {
    const r = raw();
    r.mode = 'hardcore';
    expect(() => parseReplay(r)).toThrow();
  });
  it('maxTicks-Option greift', () => {
    expect(() => parseReplay(raw(), { maxTicks: 100 })).toThrow();
    expect(() => parseReplay(raw(), { maxTicks: 8000 })).not.toThrow();
  });
  it('Endlos-Modus im Replay: Roundtrip', () => {
    const g = new Game({ seed: 3, mapId: 'waterfall', mode: 'endless' });
    g.step();
    const r = g.toReplay();
    expect(r.mode).toBe('endless');
    expect(runReplay(parseReplay(JSON.parse(JSON.stringify(r)))).matches).toBe(true);
  });
  it('wirft bei absteigenden Ticks', () => {
    const r = raw();
    r.commands = [[10, 'startWave'], [5, 'startWave']];
    expect(() => parseReplay(r)).toThrow();
  });
  it('wirft bei endTick > 432000, akzeptiert 432000', () => {
    const r = raw();
    r.endTick = 432001;
    expect(() => parseReplay(r)).toThrow();
    r.endTick = 432000;
    expect(() => parseReplay(r)).not.toThrow();
  });
  it('wirft bei Nicht-Objekt, unbekannter Karte und unbekanntem Kommando', () => {
    expect(() => parseReplay(null)).toThrow();
    expect(() => parseReplay(42)).toThrow();
    const r = raw();
    r.mapId = 'nope';
    expect(() => parseReplay(r)).toThrow();
    const c = raw();
    c.commands = [[1, 'cheat', 5]];
    expect(() => parseReplay(c)).toThrow();
  });
});
