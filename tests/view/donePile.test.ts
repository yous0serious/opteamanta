import { describe, it, expect } from 'vitest';
import { DonePile } from '../../src/view/logic/donePile';

// AC-6: Haufen rechts unten, Obergrenze 60 Kugeln, aelteste wird ersetzt.
const area = { x: 720, y: 470, w: 240, h: 130 };

describe('DonePile (AC-6)', () => {
  it('keeps exactly 60 balls after 61 adds and drops the oldest', () => {
    const pile = new DonePile({ max: 60, area });
    for (let i = 0; i < 61; i++) pile.add('#ffeb3b');
    expect(pile.balls).toHaveLength(60);
    expect(pile.balls.some((b) => b.id === 1)).toBe(false);
    expect(pile.balls.some((b) => b.id === 61)).toBe(true);
  });

  it('keeps all positions inside x 720-960, y 470-600', () => {
    const pile = new DonePile({ max: 60, area });
    for (let i = 0; i < 61; i++) pile.add('#ffeb3b');
    for (const b of pile.balls) {
      expect(b.x).toBeGreaterThanOrEqual(720);
      expect(b.x).toBeLessThanOrEqual(960);
      expect(b.y).toBeGreaterThanOrEqual(470);
      expect(b.y).toBeLessThanOrEqual(600);
    }
  });

  it('never exceeds 60 balls after many adds', () => {
    const pile = new DonePile({ max: 60, area });
    for (let i = 0; i < 200; i++) pile.add('#fff');
    expect(pile.balls).toHaveLength(60);
  });
});
