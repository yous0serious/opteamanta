// Mock-MetaService für die Entwicklung (`?shell=mock`): realistische Daten, Fortschritt in localStorage.
// Wird von der Integration durch den echten Dienst (src/meta) ersetzt.
import type {
  AchievementView,
  BoardId,
  CampaignProgress,
  MetaService,
  NicknameResult,
  ProfileView,
  RankPeriod,
  RankRow,
  RunSummary,
  RunVerdict,
} from '../../meta/types';
import { achievementProgress, emptyStats, levelForXp, skillPointsForLevel, type AchievementStats } from '../../sim/index';
import { ACHIEVEMENTS, CAMPAIGN_LIST, SKILL_LIST } from '../data';

const KEY = 'bd.mockMeta.v2';

interface State {
  nickname: string;
  xp: number;
  email: string | null;
  levels: Record<string, { stars: 0 | 1 | 2 | 3; score: number }>;
  loadout: Record<string, number>;
  stats: Pick<AchievementStats, 'kills' | 'dailyRuns' | 'bestCombo' | 'flawlessWins' | 'challengeWins' | 'endlessBestWave'>;
}

const DEFAULT: State = {
  nickname: 'Team Kanban',
  xp: 1850,
  email: null,
  levels: {
    'team-1': { stars: 3, score: 18_420 },
    'team-2': { stars: 3, score: 21_050 },
    'team-3': { stars: 2, score: 19_870 },
    'team-4': { stars: 3, score: 26_300 },
    'team-5': { stars: 1, score: 15_200 },
    'team-6': { stars: 2, score: 31_900 },
    'art-1': { stars: 2, score: 24_100 },
    'art-2': { stars: 1, score: 22_480 },
  },
  loadout: { 'team-pair': 2, 'team-dual': 1, 'team-tdd': 1, 'proc-wsjf': 1, 'lead-servant': 1 },
  stats: { kills: 640, dailyRuns: 4, bestCombo: 31, flawlessWins: 0, challengeWins: 1, endlessBestWave: 27 },
};

const NAMES = [
  'Velocity Vikings', 'Sprint-Sorglos', 'Refinement Rebels', 'Kanban Kollektiv', 'Daily Dackel', 'Burndown Brigade', 'Retro Rakete',
  'Story-Point-Piraten', 'Jira Jongleure', 'WIP Wizards', 'Epic Eulen', 'Backlog Biber', 'Scope Schreck', 'Deploy Dachse',
  'Hotfix Helden', 'PI Pinguine', 'Agile Alpakas', 'Lean Luchse', 'Feature Füchse', 'Merge Murmeltiere', 'Pipeline Pumas',
  'Swimlane Schwäne', 'Ticket Tiger', 'Release Robben', 'Akzeptanz Adler', 'Confluence Kraken', 'Daily Delfine', 'Spike Spatzen',
];

function hash(s: string): number {
  let x = 2166136261;
  for (let i = 0; i < s.length; i++) x = Math.imul(x ^ s.charCodeAt(i), 16777619);
  return x >>> 0;
}

export class MockMeta implements MetaService {
  readonly online: boolean;
  private s: State;
  private readonly listeners = new Set<() => void>();

  constructor(online = true) {
    this.online = online;
    let saved: State | null;
    try {
      saved = JSON.parse(localStorage.getItem(KEY) ?? 'null') as State | null;
    } catch {
      saved = null;
    }
    this.s = saved ?? structuredClone(DEFAULT);
  }

  private save(): void {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.s));
    } catch {
      // nur im Speicher
    }
    for (const fn of this.listeners) fn();
  }

  private delay<T>(v: T, ms = 120): Promise<T> {
    return new Promise((r) => setTimeout(() => r(v), ms));
  }

  private levelOf(xp: number): { level: number; into: number; need: number } {
    return levelForXp(xp);
  }

  profile(): Promise<ProfileView> {
    const l = this.levelOf(this.s.xp);
    const spent = Object.values(this.s.loadout).reduce((a, b) => a + b, 0);
    return this.delay({
      nickname: this.s.nickname,
      xp: this.s.xp,
      level: l.level,
      xpIntoLevel: l.into,
      xpForNext: l.need,
      skillPoints: skillPointsForLevel(l.level),
      spentPoints: spent,
      ranked: this.online,
      email: this.s.email,
    });
  }

  campaigns(): Promise<CampaignProgress[]> {
    let prevBossDone = true;
    const out = CAMPAIGN_LIST.map((c) => {
      const unlocked = prevBossDone;
      let prevStars = 1;
      const levels = c.levels.map((id) => {
        const r = this.s.levels[id];
        const lu = unlocked && prevStars > 0;
        prevStars = r?.stars ?? 0;
        return { levelId: id, unlocked: lu, bestStars: r?.stars ?? 0, bestScore: r?.score ?? null };
      });
      prevBossDone = (levels[levels.length - 1]?.bestStars ?? 0) > 0;
      return { campaignId: c.id, unlocked, levels };
    });
    return this.delay(out);
  }

  loadout(): Promise<Record<string, number>> {
    return this.delay({ ...this.s.loadout }, 60);
  }

  async setSkill(skillId: string, rank: number): Promise<'ok' | 'no_points' | 'locked' | 'error'> {
    const skill = SKILL_LIST.find((s) => s.id === skillId);
    if (!skill || rank < 0 || rank > skill.maxRank) return 'error';
    const p = await this.profile();
    const cur = this.s.loadout[skillId] ?? 0;
    if (rank > cur && p.skillPoints - p.spentPoints < rank - cur) return 'no_points';
    if (rank > 0 && skill.requires.some((r) => (this.s.loadout[r] ?? 0) === 0)) return 'locked';
    if (rank === 0 && SKILL_LIST.some((s) => s.requires.includes(skillId) && (this.s.loadout[s.id] ?? 0) > 0)) return 'locked';
    if (rank === 0) delete this.s.loadout[skillId];
    else this.s.loadout[skillId] = rank;
    this.save();
    return 'ok';
  }

  respec(): Promise<'ok' | 'error'> {
    this.s.loadout = {};
    this.save();
    return this.delay('ok');
  }

  leaderboard(board: BoardId, period: RankPeriod): Promise<RankRow[]> {
    if (!this.online) return Promise.reject(new Error('offline'));
    const seed = hash(`${board}|${period}`);
    const count = board.startsWith('level:') && board.endsWith('-6') ? 18 : 50;
    const level = board.startsWith('level:');
    const rows: RankRow[] = [];
    let score = 60_000 + (seed % 20_000);
    const meAt = 3 + (seed % 14);
    for (let i = 1; i <= count; i++) {
      score -= 300 + ((seed >> i % 13) % 900);
      const me = i === meAt;
      rows.push({
        rank: i,
        nickname: me ? this.s.nickname : NAMES[(seed + i * 11) % NAMES.length]! + (i > NAMES.length ? ` ${Math.ceil(i / NAMES.length) + 1}` : ''),
        score: Math.max(1200, score),
        wave: level ? 18 : Math.max(5, 30 - Math.floor(i / 3)),
        stars: level ? (i < 8 ? 3 : i < 20 ? 2 : 1) : null,
        won: i < 22,
        isMe: me,
      });
    }
    return this.delay(rows, 260);
  }

  private fullStats(): AchievementStats {
    const levelStars: AchievementStats['levelStars'] = {};
    for (const [id, r] of Object.entries(this.s.levels)) (levelStars as Record<string, number>)[id] = r.stars;
    const bosses = CAMPAIGN_LIST.filter((c) => (this.s.levels[c.levels[c.levels.length - 1]!]?.stars ?? 0) > 0).map((c) => c.boss);
    const spent = Object.values(this.s.loadout).reduce((a, b) => a + b, 0);
    return { ...emptyStats(), ...this.s.stats, levelStars, bossesDefeated: bosses, maxSkillPoints: spent, accountLevel: this.levelOf(this.s.xp).level };
  }

  achievements(): Promise<AchievementView[]> {
    const prog = new Map(achievementProgress(this.fullStats()).map((p) => [p.id, p]));
    return this.delay(
      ACHIEVEMENTS.map((a) => {
        const p = prog.get(a.id);
        const [done, of] = p?.progress ?? [0, 1];
        return { id: a.id, name: a.name, description: a.description, icon: a.icon, unlocked: p?.unlocked ?? false, progress: of > 1 ? ([Math.min(done, of), of] as [number, number]) : null };
      }),
    );
  }

  async rename(nickname: string): Promise<NicknameResult> {
    await this.delay(null, 300);
    if (NAMES.includes(nickname)) return 'taken';
    this.s.nickname = nickname;
    this.save();
    return 'ok';
  }

  async secureAccount(email: string, _password: string): Promise<'ok' | 'invalid' | 'taken' | 'weak' | 'error'> {
    await this.delay(null, 500);
    this.s.email = email;
    this.save();
    return 'ok';
  }

  async login(_email: string, _password: string): Promise<'ok' | 'wrong' | 'error'> {
    await this.delay(null, 500);
    return 'wrong';
  }

  onChange(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /** Mock der Server-Prüfung: XP gutschreiben, Fortschritt speichern, Erfolge prüfen. */
  verify(s: RunSummary, ms = 2200): Promise<RunVerdict> {
    return new Promise((resolve) => {
      setTimeout(() => {
        if (!this.online) return resolve({ status: 'offline', xpGained: 0, rank: null, levelUp: null, newAchievements: [] });
        const from = this.levelOf(this.s.xp).level;
        const before = new Set(achievementProgress(this.fullStats()).filter((p) => p.unlocked).map((p) => p.id));
        if (s.levelId) {
          const prev = this.s.levels[s.levelId];
          if (s.won && (!prev || s.stars > prev.stars || s.score > prev.score)) {
            this.s.levels[s.levelId] = { stars: Math.max(prev?.stars ?? 0, s.stars) as 0 | 1 | 2 | 3, score: Math.max(prev?.score ?? 0, s.score) };
          }
        }
        if (s.won && s.lives >= 100) this.s.stats.flawlessWins++;
        if (s.daily) this.s.stats.dailyRuns++;
        if (s.mode === 'challenge' && s.won && !s.levelId) this.s.stats.challengeWins++;
        this.s.stats.kills += s.kills;
        this.s.xp += s.xpPreview;
        const to = this.levelOf(this.s.xp).level;
        const newAch = achievementProgress(this.fullStats()).filter((p) => p.unlocked && !before.has(p.id)).map((p) => p.id);
        this.save();
        resolve({ status: 'verified', xpGained: s.xpPreview, rank: 4 + (hash(s.mapId) % 20), levelUp: to > from ? { from, to } : null, newAchievements: newAch });
      }, ms);
    });
  }
}
