import { describe, expect, it } from 'vitest';
import { ADJECTIVES, ANIMALS, generateName } from '../../src/online/names';

// Spec office-makeover AC-2: Regel wie DB-Constraint profiles.nickname (Literal, nicht importiert).
const DB_RULE = /^[A-Za-zÄÖÜäöüß0-9_-][A-Za-zÄÖÜäöüß0-9 _-]{1,14}[A-Za-zÄÖÜäöüß0-9_-]$/;

describe('generateName', () => {
  it('jede Kombination (mit längster Zahl) erfüllt die DB-Regel und hat ≤ 16 Zeichen', () => {
    for (const a of ADJECTIVES) {
      for (const t of ANIMALS) {
        const name = `${a} ${t} 9999`;
        expect(name.length, name).toBeLessThanOrEqual(16);
        expect(DB_RULE.test(name), name).toBe(true);
      }
    }
  });

  it('Format „<Adjektiv> <Tier> <NNNN>“ mit führenden Nullen', () => {
    const seq = [0, 0.999, 0.0042];
    let i = 0;
    const name = generateName(() => seq[i++ % seq.length]!);
    expect(name).toBe('Agile Lemur 0042');
  });

  it('erzeugt unterschiedliche Namen', () => {
    const names = new Set(Array.from({ length: 50 }, () => generateName()));
    expect(names.size).toBeGreaterThan(40);
  });
});
