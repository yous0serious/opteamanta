import type { OnlineApi } from '../online/api';
import { generateName } from '../online/names';
import { emptyStats, skillById, skillPointsForLevel, levelForXp, validateLoadout, type AchievementStats, type RunRecord } from '../sim/index';
import { achievementViews, applyLocalRun, campaignProgress, emptyLocal, nextPlayable, profileView, type LocalProgress, type LocalRunOutcome } from './progress';
import type { AchievementView, BoardId, CampaignProgress, MetaService, NicknameResult, ProfileView, RankPeriod, RankRow } from './types';

// Meta-Dienst (Spec campaigns): Profil, Fortschritt, Skills, Ranglisten, Erfolge.
// Online liegt alles im Konto (Supabase, serverseitig geprüft); offline in localStorage („nicht gewertet“).

export const LOCAL_KEY = 'bd.progress';
const NICK_RE = /^[A-Za-zÄÖÜäöüß0-9_-][A-Za-zÄÖÜäöüß0-9 _-]{1,14}[A-Za-zÄÖÜäöüß0-9_-]$/;

/** Erweiterung für den Spielablauf (GameHost): Freischaltungen, aktueller Skill-Stand, lokale Wertung. */
export interface Meta extends MetaService {
  /** Beste Sterne je Level (für Freischaltungen und „Weiterspielen“). */
  bestStars(): Promise<Record<string, number>>;
  /** Nächstes spielbares Level. */
  continueLevel(): Promise<string | null>;
  /** Nur offline: Lauf lokal werten. */
  recordLocal(run: RunRecord, score: number): LocalRunOutcome | null;
  /** Zwischengespeicherte Daten verwerfen (z. B. nach einer Server-Prüfung) und Abonnenten benachrichtigen. */
  refresh(): void;
  readonly api: OnlineApi | null;
}

abstract class Base {
  private readonly listeners = new Set<() => void>();

  onChange(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  protected emit(): void {
    for (const fn of this.listeners) fn();
  }
}

// ===================== Offline =====================

function load(): LocalProgress {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<LocalProgress>;
      if (p.version === 1) return { ...emptyLocal(), ...p, stats: { ...emptyLocal().stats, ...p.stats } } as LocalProgress;
    }
  } catch {
    // beschädigt oder gesperrt – neu beginnen
  }
  return emptyLocal();
}

export class OfflineMeta extends Base implements Meta {
  readonly online = false;
  readonly api = null;
  private p: LocalProgress = load();

  private save(): void {
    try {
      localStorage.setItem(LOCAL_KEY, JSON.stringify(this.p));
    } catch {
      // nur für diese Sitzung
    }
    this.emit();
  }

  async profile(): Promise<ProfileView> {
    return profileView({ nickname: this.p.nickname, xp: this.p.xp, loadout: this.p.loadout, ranked: false, email: null });
  }

  async campaigns(): Promise<CampaignProgress[]> {
    return campaignProgress(this.p.best, this.p.scores);
  }

  async bestStars(): Promise<Record<string, number>> {
    return { ...this.p.best };
  }

  async continueLevel(): Promise<string | null> {
    return nextPlayable(this.p.best);
  }

  async loadout(): Promise<Record<string, number>> {
    return { ...this.p.loadout };
  }

  async setSkill(skillId: string, rank: number): Promise<'ok' | 'no_points' | 'locked' | 'error'> {
    if (!skillById(skillId)) return 'error';
    const next = { ...this.p.loadout };
    if (rank <= 0) delete next[skillId];
    else next[skillId] = rank;
    const err = validateLoadout(next, skillPointsForLevel(levelForXp(this.p.xp).level));
    if (err === 'points') return 'no_points';
    if (err?.startsWith('requires:')) return 'locked';
    // Abwählen darf Voraussetzungen anderer Skills nicht brechen
    if (err) return 'error';
    this.p = { ...this.p, loadout: next };
    this.save();
    return 'ok';
  }

  async respec(): Promise<'ok' | 'error'> {
    this.p = { ...this.p, loadout: {} };
    this.save();
    return 'ok';
  }

  async leaderboard(_board: BoardId, _period: RankPeriod): Promise<RankRow[]> {
    return [];
  }

  async achievements(): Promise<AchievementView[]> {
    return achievementViews(this.p.stats, new Set(this.p.unlocked));
  }

  async rename(nickname: string): Promise<NicknameResult> {
    const n = nickname.trim();
    if (!NICK_RE.test(n)) return 'invalid';
    this.p = { ...this.p, nickname: n };
    this.save();
    return 'ok';
  }

  async secureAccount(_email: string): Promise<'sent' | 'error'> {
    return 'error';
  }

  recordLocal(run: RunRecord, score: number): LocalRunOutcome {
    const out = applyLocalRun(this.p, run, score);
    this.p = out.progress;
    this.save();
    return out;
  }

  refresh(): void {
    this.p = load();
    this.emit();
  }
}

// ===================== Online =====================

/** Erfolge, deren Fortschritt sich aus den Online-Daten (Sterne, Account-Level) ableiten lässt. */
const DERIVABLE = /^(first-pi|team-done|art-done|solution-done|portfolio-done|three-team|three-portfolio|all-stars|level-25)$/;

export class OnlineMeta extends Base implements Meta {
  readonly online = true;
  private cache: Promise<Awaited<ReturnType<OnlineApi['progress']>>> | null = null;
  private accountCache: Promise<Awaited<ReturnType<OnlineApi['account']>>> | null = null;

  constructor(readonly api: OnlineApi) {
    super();
  }

  /** Anmelden und Teamnamen sicherstellen (beim Start). */
  async boot(): Promise<string> {
    await this.api.signIn();
    return this.api.ensureProfile(() => generateName());
  }

  private progress(): Promise<Awaited<ReturnType<OnlineApi['progress']>>> {
    this.cache ??= this.api.progress().catch((err: unknown) => {
      this.cache = null;
      throw err;
    });
    return this.cache;
  }

  refresh(): void {
    this.cache = null;
    this.accountCache = null;
    this.emit();
  }

  async profile(): Promise<ProfileView> {
    this.accountCache ??= this.api.account().catch(() => null);
    const [p, acc] = await Promise.all([this.progress(), this.accountCache]);
    return profileView({ nickname: p.nickname, xp: p.xp, loadout: p.skills, ranked: true, email: acc?.email ?? null });
  }

  async bestStars(): Promise<Record<string, number>> {
    const p = await this.progress();
    return Object.fromEntries(p.levels.map((l) => [l.levelId, l.bestStars]));
  }

  async campaigns(): Promise<CampaignProgress[]> {
    const p = await this.progress();
    return campaignProgress(
      Object.fromEntries(p.levels.map((l) => [l.levelId, l.bestStars])),
      Object.fromEntries(p.levels.map((l) => [l.levelId, l.bestScore])),
    );
  }

  async continueLevel(): Promise<string | null> {
    return nextPlayable(await this.bestStars());
  }

  async loadout(): Promise<Record<string, number>> {
    return { ...(await this.progress()).skills };
  }

  async setSkill(skillId: string, rank: number): Promise<'ok' | 'no_points' | 'locked' | 'error'> {
    const res = await this.api.allocateSkill(skillId, rank).catch(() => ({ result: 'error' as const, loadout: null }));
    if (res.result === 'ok') this.refresh();
    return res.result;
  }

  async respec(): Promise<'ok' | 'error'> {
    const res = await this.api.respec().catch(() => 'error' as const);
    if (res === 'ok') this.refresh();
    return res;
  }

  leaderboard(board: BoardId, period: RankPeriod): Promise<RankRow[]> {
    return this.api.board(board, period);
  }

  async achievements(): Promise<AchievementView[]> {
    const p = await this.progress();
    const stats = { ...emptyStatsFrom(p.levels), accountLevel: levelForXp(p.xp).level };
    return achievementViews(stats, new Set(p.achievements.map((a) => a.id))).map((a) => (a.unlocked || DERIVABLE.test(a.id) ? a : { ...a, progress: null }));
  }

  async rename(nickname: string): Promise<NicknameResult> {
    const res = await this.api.setNickname(nickname.trim()).catch(() => 'invalid' as const);
    if (res === 'ok') this.refresh();
    return res;
  }

  async secureAccount(email: string): Promise<'sent' | 'error'> {
    const res = await this.api.secureAccount(email).catch(() => 'error' as const);
    return res === 'sent' ? 'sent' : 'error';
  }

  recordLocal(): null {
    return null;
  }
}

function emptyStatsFrom(levels: ReadonlyArray<{ levelId: string; bestStars: number }>): AchievementStats {
  return { ...emptyStats(), levelStars: Object.fromEntries(levels.map((l) => [l.levelId, l.bestStars])) };
}

/** Online, wenn Supabase konfiguriert ist und die Anmeldung klappt; sonst offline. */
export async function createMeta(api: OnlineApi | null): Promise<{ meta: Meta; nickname: string | null; error: unknown }> {
  if (!api) return { meta: new OfflineMeta(), nickname: null, error: null };
  const meta = new OnlineMeta(api);
  try {
    return { meta, nickname: await meta.boot(), error: null };
  } catch (error) {
    return { meta: new OfflineMeta(), nickname: null, error };
  }
}
