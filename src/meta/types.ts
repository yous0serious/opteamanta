// Verträge zwischen Oberfläche (src/ui), Meta-Dienst (src/meta) und Spiel (src/view) – Spec campaigns.
// IDs sind hier bewusst `string`, damit die Shell unabhängig von den Sim-Unions gebaut werden kann;
// gültige Werte liefern `CAMPAIGNS`/`LEVELS`/`SKILLS` aus `src/sim/data/*`.

export type RankPeriod = 'all' | 'week' | 'day';
/** `daily:<YYYY-MM-DD>` | `level:<LevelId>` | `map:<MapId>` */
export type BoardId = `daily:${string}` | `level:${string}` | `map:${string}`;
export type NicknameResult = 'ok' | 'taken' | 'invalid';

export interface RankRow {
  rank: number;
  nickname: string;
  score: number;
  wave: number;
  stars: number | null;
  won: boolean;
  isMe: boolean;
}

export interface ProfileView {
  nickname: string | null;
  xp: number;
  /** Account-Level 1–50. */
  level: number;
  xpIntoLevel: number;
  xpForNext: number;
  skillPoints: number;
  spentPoints: number;
  /** true = Fortschritt liegt im Konto (gewertet); false = offline/lokal. */
  ranked: boolean;
  /** Konto per E-Mail gesichert. */
  email: string | null;
}

export interface LevelProgress {
  levelId: string;
  unlocked: boolean;
  bestStars: 0 | 1 | 2 | 3;
  bestScore: number | null;
}

export interface CampaignProgress {
  campaignId: string;
  unlocked: boolean;
  levels: LevelProgress[];
}

export interface AchievementView {
  id: string;
  name: string;
  description: string;
  /** Atlas-/Icon-Name (`icon/<name>`). */
  icon: string;
  unlocked: boolean;
  progress: [done: number, of: number] | null;
}

/** Ergebnis eines Laufs für den Ergebnis-Screen. */
export interface RunSummary {
  levelId: string | null;
  mapId: string;
  mode: 'level' | 'challenge' | 'endless';
  daily: boolean;
  won: boolean;
  stars: 0 | 1 | 2 | 3;
  score: number;
  wave: number;
  waves: number | null;
  kills: number;
  lives: number;
  /** XP-Vorschau (Client); gutgeschrieben wird nach Server-Prüfung. */
  xpPreview: number;
  ranked: boolean;
}

/** Ergebnis der Server-Prüfung (kommt asynchron nach dem Lauf). */
export interface RunVerdict {
  status: 'verified' | 'rejected' | 'offline';
  xpGained: number;
  rank: number | null;
  levelUp: { from: number; to: number } | null;
  newAchievements: string[];
}

/** Progression, Ranglisten, Konto – online (Supabase) oder offline (localStorage). */
export interface MetaService {
  readonly online: boolean;
  profile(): Promise<ProfileView>;
  campaigns(): Promise<CampaignProgress[]>;
  loadout(): Promise<Record<string, number>>;
  setSkill(skillId: string, rank: number): Promise<'ok' | 'no_points' | 'locked' | 'error'>;
  respec(): Promise<'ok' | 'error'>;
  leaderboard(board: BoardId, period: RankPeriod): Promise<RankRow[]>;
  achievements(): Promise<AchievementView[]>;
  rename(nickname: string): Promise<NicknameResult>;
  secureAccount(email: string): Promise<'sent' | 'error'>;
  /** Benachrichtigung bei Änderungen (XP, Skills, Fortschritt). */
  onChange(fn: () => void): () => void;
}

/** Startet/beendet Läufe; implementiert von der Integration (src/main.ts), genutzt von der Shell. */
export interface GameHost {
  startLevel(levelId: string): Promise<void>;
  startDaily(): Promise<void>;
  startFree(mapId: string, mode: 'challenge' | 'endless'): Promise<void>;
  /** Laufendes Spiel verlassen (Shell zeigt danach das Menü). */
  quit(): void;
  /** Wird nach jedem Spielende aufgerufen; `verdict` löst sich nach der Server-Prüfung auf. */
  onFinished(fn: (summary: RunSummary, verdict: Promise<RunVerdict>) => void): () => void;
}
