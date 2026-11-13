import {
  ACHIEVEMENTS,
  CAMPAIGNS,
  LEVELS,
  achievementProgress,
  addRunToStats,
  emptyStats,
  levelForXp,
  loadoutPoints,
  skillPointsForLevel,
  xpForRun,
  type AchievementStats,
  type RunRecord,
} from '../sim/index';
import type { AchievementView, CampaignProgress, LevelProgress, ProfileView } from './types';

// Reine Fortschrittslogik (Spec campaigns): Freischaltung, Profil-Ansicht, lokaler Fortschritt im Offline-Betrieb.
// Freischaltregel identisch zu supabase/functions/_shared/logic.ts (levelUnlocked).

export type Stars = 0 | 1 | 2 | 3;
export type BestStars = Readonly<Record<string, number>>;

/** Level n+1 nach ≥ 1 Stern in Level n; erstes Level einer Kampagne nach dem letzten Level der vorigen. */
export function levelUnlocked(levelId: string, best: BestStars): boolean {
  for (const [ci, c] of CAMPAIGNS.entries()) {
    const li = c.levels.indexOf(levelId as never);
    if (li < 0) continue;
    if (li > 0) return (best[c.levels[li - 1]!] ?? 0) >= 1;
    if (ci === 0) return true;
    const prev = CAMPAIGNS[ci - 1]!.levels;
    return prev.length > 0 && (best[prev[prev.length - 1]!] ?? 0) >= 1;
  }
  return false;
}

export function campaignProgress(best: BestStars, scores: Readonly<Record<string, number | null>> = {}): CampaignProgress[] {
  return CAMPAIGNS.map((c) => {
    const levels: LevelProgress[] = c.levels.map((id) => ({
      levelId: id,
      unlocked: levelUnlocked(id, best),
      bestStars: Math.max(0, Math.min(3, best[id] ?? 0)) as Stars,
      bestScore: scores[id] ?? null,
    }));
    return { campaignId: c.id, unlocked: levels[0]?.unlocked ?? false, levels };
  });
}

/** Nächstes spielbares Level (für „Weiterspielen“): erstes freigeschaltetes ohne Stern, sonst das letzte freigeschaltete. */
export function nextPlayable(best: BestStars): string | null {
  let last: string | null = null;
  for (const l of LEVELS) {
    if (!levelUnlocked(l.id, best)) continue;
    if ((best[l.id] ?? 0) < 1) return l.id;
    last = l.id;
  }
  return last;
}

export function profileView(o: { nickname: string | null; xp: number; loadout: Readonly<Record<string, number>>; ranked: boolean; email: string | null }): ProfileView {
  const lv = levelForXp(o.xp);
  return {
    nickname: o.nickname,
    xp: o.xp,
    level: lv.level,
    xpIntoLevel: lv.into,
    xpForNext: lv.need,
    skillPoints: skillPointsForLevel(lv.level),
    spentPoints: loadoutPoints(o.loadout),
    ranked: o.ranked,
    email: o.email,
  };
}

export function achievementViews(stats: AchievementStats, unlocked: ReadonlySet<string> = new Set()): AchievementView[] {
  const prog = new Map(achievementProgress(stats).map((p) => [p.id, p] as const));
  return ACHIEVEMENTS.map((a) => {
    const p = prog.get(a.id);
    return {
      id: a.id,
      name: a.name,
      description: a.description,
      icon: a.icon,
      unlocked: unlocked.has(a.id) || (p?.unlocked ?? false),
      progress: p ? p.progress : null,
    };
  });
}

/** Lokal gespeicherter Fortschritt (offline, „nicht gewertet“). */
export interface LocalProgress {
  version: 1;
  nickname: string | null;
  xp: number;
  best: Record<string, number>;
  scores: Record<string, number>;
  loadout: Record<string, number>;
  stats: AchievementStats;
  unlocked: string[];
}

export function emptyLocal(): LocalProgress {
  return { version: 1, nickname: null, xp: 0, best: {}, scores: {}, loadout: {}, stats: emptyStats(), unlocked: [] };
}

/** Ergebnis eines lokal gewerteten Laufs (gleiche Regeln wie der Server, nur ohne Prüfung). */
export interface LocalRunOutcome {
  progress: LocalProgress;
  xpGained: number;
  levelUp: { from: number; to: number } | null;
  newAchievements: string[];
}

export function applyLocalRun(p: LocalProgress, run: RunRecord, score: number): LocalRunOutcome {
  const firstClear = run.won && run.levelId !== null && (p.best[run.levelId] ?? 0) < 1;
  const xpGained = xpForRun(run, { firstClear, won: run.won });
  const from = levelForXp(p.xp).level;
  const xp = p.xp + xpGained;
  const to = levelForXp(xp).level;
  const best = { ...p.best };
  const scores = { ...p.scores };
  if (run.levelId && run.won) {
    best[run.levelId] = Math.max(best[run.levelId] ?? 0, run.stars);
    scores[run.levelId] = Math.max(scores[run.levelId] ?? 0, score);
  }
  const stats = { ...addRunToStats(p.stats, run), accountLevel: to };
  const have = new Set(p.unlocked);
  const newAchievements = achievementProgress(stats).filter((a) => a.unlocked && !have.has(a.id)).map((a) => a.id);
  return {
    progress: { ...p, xp, best, scores, stats, unlocked: [...p.unlocked, ...newAchievements] },
    xpGained,
    levelUp: to > from ? { from, to } : null,
    newAchievements,
  };
}
