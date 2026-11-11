import { describe, expect, it } from 'vitest';
import { shareText, type ShareInfo } from '../../src/view/share';

const base: ShareInfo = { daily: null, wave: 7, waves: 30, lives: 0, score: 1200, rank: null, team: null, map: 'Wasserfall', won: false };

describe('shareText (AC-11)', () => {
  it('daily with rank', () => {
    expect(shareText({ ...base, daily: '11.11.', wave: 30, lives: 85, score: 123456, rank: 3 })).toBe(
      'Backlog Defense 3000 · Daily 11.11. · Welle 30/30 · Moral 85 % · Score 123.456 · Rang 3 – https://opteamanta.netlify.app',
    );
  });
  it('free game without rank', () => {
    expect(shareText(base)).toBe('Backlog Defense 3000 · Freies Spiel · Welle 7/30 · Moral 0 % · Score 1.200 – https://opteamanta.netlify.app');
  });
  it('endless', () => {
    expect(shareText({ ...base, wave: 31, waves: null, lives: 12, score: 99 })).toBe(
      'Backlog Defense 3000 · Freies Spiel · Welle 31 (Endlos) · Moral 12 % · Score 99 – https://opteamanta.netlify.app',
    );
  });
  it('negative lives show 0 %', () => {
    expect(shareText({ ...base, lives: -4 })).toContain('Moral 0 %');
  });
});
