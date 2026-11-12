import { describe, expect, it } from 'vitest';
import { Effects, MAX_TEXTS } from '../../src/view/render/effects';

describe('schwebende Texte', () => {
  it('fasst gleiche Meldungen in der Nähe zusammen (×N)', () => {
    const fx = new Effects();
    fx.text(100, 100, 'Zerfällt in User Stories!', '#000', 12, 1);
    fx.update(0.5);
    fx.text(130, 110, 'Zerfällt in User Stories!', '#000', 12, 1);
    fx.text(90, 95, 'Zerfällt in User Stories!', '#000', 12, 1);
    expect(fx.texts).toHaveLength(1);
    expect(fx.texts[0]!.count).toBe(3);
    expect(fx.texts[0]!.life).toBe(1);
  });

  it('weit entfernte gleiche Meldungen bleiben getrennt', () => {
    const fx = new Effects();
    fx.text(100, 100, 'Done', '#000');
    fx.text(700, 400, 'Done', '#000');
    expect(fx.texts).toHaveLength(2);
  });

  it('verschiedene Meldungen am selben Ort weichen nach oben aus', () => {
    const fx = new Effects();
    fx.text(200, 200, 'Ab ins Review!', '#000', 13);
    fx.text(205, 200, 'Zurück ins Refinement!', '#000', 12);
    expect(fx.texts[1]!.y).toBeLessThan(fx.texts[0]!.y - 10);
  });

  it(`zeigt höchstens ${MAX_TEXTS} Texte und verwirft zuerst kleine`, () => {
    const fx = new Effects();
    fx.text(480, 60, 'Moral-Bonus +5000', '#000', 24, 2.5);
    for (let i = 0; i < 20; i++) fx.text(40 * i, 300 + (i % 3) * 60, `Kill ${i}`, '#000', 12);
    expect(fx.texts).toHaveLength(MAX_TEXTS);
    expect(fx.texts.some((t) => t.text === 'Moral-Bonus +5000')).toBe(true);
    expect(fx.texts.at(-1)!.text).toBe('Kill 19');
  });
});
