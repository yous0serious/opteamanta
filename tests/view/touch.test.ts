import { describe, expect, it } from 'vitest';
import { TILE } from '../../src/sim/index';
import { Controller } from '../../src/view/controller';

const px = (c: number): number => c * TILE + TILE / 2;

function freeCell(ctl: Controller): [number, number] {
  for (let cy = 1; cy < 15; cy++) for (let cx = 1; cx < 24; cx++) if (ctl.game.canPlace('dualo', cx, cy) === null) return [cx, cy];
  throw new Error('kein freies Feld');
}

describe('Touch: Tippen zeigt Vorschau, zweites Tippen setzt ein', () => {
  it('erstes Tippen platziert nicht, zweites auf dasselbe Feld schon', () => {
    const ctl = new Controller({ seed: 7, mapId: 'waterfall' }, () => 1);
    const [cx, cy] = freeCell(ctl);
    ctl.selectType('dualo');
    expect(ctl.tapBoard(px(cx), px(cy))).toBe('preview');
    expect(ctl.game.state.towers).toHaveLength(0);
    expect(ctl.preview).toEqual({ cx, cy });
    expect(ctl.tapBoard(px(cx) + 5, px(cy) - 5)).toBe('placed');
    expect(ctl.game.state.towers).toHaveLength(1);
    expect(ctl.preview).toBeNull();
  });

  it('Tippen auf ein anderes Feld verschiebt die Vorschau', () => {
    const ctl = new Controller({ seed: 7, mapId: 'waterfall' }, () => 1);
    const [cx, cy] = freeCell(ctl);
    ctl.selectType('dualo');
    ctl.tapBoard(px(cx), px(cy));
    expect(ctl.tapBoard(px(cx + 1), px(cy))).toBe('preview');
    expect(ctl.preview).toEqual({ cx: cx + 1, cy });
    expect(ctl.game.state.towers).toHaveLength(0);
  });

  it('erst Feld vormerken, dann Rolle wählen und per Button einsetzen', () => {
    const ctl = new Controller({ seed: 7, mapId: 'waterfall' }, () => 1);
    const [cx, cy] = freeCell(ctl);
    expect(ctl.tapBoard(px(cx), px(cy))).toBe('preview');
    ctl.selectType('analyst');
    expect(ctl.preview).toEqual({ cx, cy });
    expect(ctl.placePreview()).toBe('placed');
    expect(ctl.game.state.towers[0]!.type).toBe('analyst');
  });

  it('Tippen auf einen Arbeitsplatz wählt ihn direkt aus; Abbrechen leert die Vorschau', () => {
    const ctl = new Controller({ seed: 7, mapId: 'waterfall' }, () => 1);
    const [cx, cy] = freeCell(ctl);
    ctl.command({ type: 'place', tower: 'dualo', cx, cy });
    expect(ctl.tapBoard(px(cx), px(cy))).toBe('selectedTower');
    expect(ctl.selectedTowerId).toBe(ctl.game.state.towers[0]!.id);
    ctl.tapBoard(px(cx + 1), px(cy));
    ctl.clearSelection();
    expect(ctl.preview).toBeNull();
  });

  it('Maus-Klick platziert weiterhin sofort', () => {
    const ctl = new Controller({ seed: 7, mapId: 'waterfall' }, () => 1);
    const [cx, cy] = freeCell(ctl);
    ctl.selectType('dualo');
    expect(ctl.clickBoard(px(cx), px(cy))).toBe('placed');
  });
});
