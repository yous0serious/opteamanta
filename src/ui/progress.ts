import type { CampaignProgress, LevelProgress } from '../meta/types';
import { CAMPAIGN_LIST } from './data';

/** Nächstes sinnvolles Level: erstes freigeschaltetes ohne Stern, sonst das zuletzt freigeschaltete. */
export function nextLevel(camps: readonly CampaignProgress[]): string | null {
  let lastUnlocked: string | null = null;
  for (const c of ordered(camps)) {
    if (!c.unlocked) continue;
    for (const l of c.levels) {
      if (!l.unlocked) continue;
      if (l.bestStars === 0) return l.levelId;
      lastUnlocked = l.levelId;
    }
  }
  return lastUnlocked;
}

/** Kampagnen in Katalog-Reihenfolge. */
export function ordered(camps: readonly CampaignProgress[]): CampaignProgress[] {
  const idx = (id: string): number => {
    const i = CAMPAIGN_LIST.findIndex((c) => c.id === id);
    return i < 0 ? 99 : i;
  };
  return [...camps].sort((a, b) => idx(a.campaignId) - idx(b.campaignId));
}

export function levelProgress(camps: readonly CampaignProgress[], levelId: string): LevelProgress | undefined {
  for (const c of camps) for (const l of c.levels) if (l.levelId === levelId) return l;
  return undefined;
}

export function starsOf(c: CampaignProgress): { got: number; of: number } {
  return { got: c.levels.reduce((s, l) => s + l.bestStars, 0), of: c.levels.length * 3 };
}

/** Höchste freigeschaltete Kampagne (Etage, auf der der Aufzug steht). */
export function currentCampaign(camps: readonly CampaignProgress[]): string {
  const list = ordered(camps).filter((c) => c.unlocked);
  return list[list.length - 1]?.campaignId ?? CAMPAIGN_LIST[0]?.id ?? 'team';
}
