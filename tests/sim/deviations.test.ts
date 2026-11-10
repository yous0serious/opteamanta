import { describe, expect, it } from 'vitest';
import { Game } from '../../src/sim/index';

describe('D-3 Zielwahl überspringt im selben Tick besiegte Gegner', () => {
  it('zweiter Turm zielt auf den lebenden Gegner, nicht auf den gerade besiegten', () => {
    const g = new Game({ seed: 1, mapId: 'waterfall' });
    g.state.money = 10_000;
    // Beide Türme direkt unter dem Pfad (Reihe 2), dev zuerst → handelt im Tick zuerst.
    g.apply({ type: 'place', tower: 'dev', cx: 10, cy: 3 });
    g.apply({ type: 'place', tower: 'analyst', cx: 11, cy: 3 });
    const front = g.spawnEnemy('req', { dist: 460 });
    const back = g.spawnEnemy('req', { dist: 430 });
    front.hp = 0.1; // stirbt am ersten Strahl-Tick (45 DPS · 1/60 = 0,75)
    back.hp = 1000;
    g.step();
    const [dev, analyst] = g.state.towers;
    expect(front.hp).toBeLessThanOrEqual(0);
    expect(dev!.targetId).toBe(front.id);
    expect(analyst!.targetId).toBe(back.id);
  });
});
