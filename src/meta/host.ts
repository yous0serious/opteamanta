import { ApiError, reasonText, type RunSession } from '../online/api';
import { CHALLENGE_WAVES, levelById, loadoutPoints, xpForRun, type Game, type MapId, type RunRecord } from '../sim/index';
import type { Controller } from '../view/controller';
import type { Meta } from './service';
import type { GameHost, RunSummary, RunVerdict } from './types';

// Spielablauf (Spec campaigns): startet gewertete Läufe über den Server (Seed + eingefrorenes Skill-Loadout),
// sonst lokale Läufe; reicht nach Spielende ein und meldet Ergebnis + Prüfung an die Shell.

export interface HostEvents {
  /** Status für die Oberfläche (z. B. „Wird geprüft …“, Fehler beim Starten). */
  status?: (text: string, kind: 'info' | 'ok' | 'err') => void;
}

type Finished = (summary: RunSummary, verdict: Promise<RunVerdict>) => void;

const OFFLINE: RunVerdict = { status: 'offline', xpGained: 0, rank: null, levelUp: null, newAchievements: [] };

export function runRecord(game: Game, daily: boolean): RunRecord {
  const s = game.state;
  return {
    levelId: s.levelId,
    mode: s.mode,
    daily,
    won: s.won,
    stars: s.won ? game.stars() : 0,
    wave: s.wave,
    kills: s.kills,
    leaks: s.leaks,
    bestCombo: s.bestCombo,
    bossesDefeated: [...s.bossesDefeated],
    skillPoints: loadoutPoints(s.loadout),
  };
}

export class Host implements GameHost {
  private readonly finished = new Set<Finished>();
  private starting: Promise<void> | null = null;

  constructor(
    private readonly ctl: Controller,
    private readonly meta: Meta,
    private readonly events: HostEvents = {},
  ) {
    ctl.onFinished((game) => this.finish(game));
    // Neustart nach Spielende (Leertaste/großer Button): gleiche Art Lauf erneut
    ctl.restartOverride = () => {
      const s = ctl.session;
      if (!s) return false;
      if (s.kind === 'level' && s.levelId) void this.startLevel(s.levelId);
      else if (s.kind === 'map') void this.startFree(s.mapId, 'challenge');
      else void this.startDaily();
      return true;
    };
  }

  onFinished(fn: Finished): () => void {
    this.finished.add(fn);
    return () => this.finished.delete(fn);
  }

  async startLevel(levelId: string): Promise<void> {
    const level = levelById(levelId);
    if (!level) throw new Error(`Unbekanntes Level ${levelId}`);
    await this.begin(
      () => this.meta.api!.startRun('level', levelId),
      async () => this.ctl.startLocal({ levelId: level.id, loadout: await this.meta.loadout() }),
    );
  }

  async startDaily(): Promise<void> {
    await this.begin(
      () => this.meta.api!.startRun('daily'),
      async () => this.ctl.startLocal({ mode: 'challenge', loadout: await this.meta.loadout() }),
    );
  }

  startFree(mapId: string, mode: 'challenge' | 'endless'): Promise<void> {
    // Challenge 30 auf einer festen Karte zählt online für die Karten-Rangliste; Endlos bleibt lokal.
    if (mode === 'challenge') {
      return this.begin(
        () => this.meta.api!.startRun('map', mapId),
        async () => this.ctl.startLocal({ mapId: mapId as MapId, mode, loadout: await this.meta.loadout() }),
      );
    }
    return this.meta.loadout().then((loadout) => this.ctl.startLocal({ mapId: mapId as MapId, mode, loadout }));
  }

  quit(): void {
    if (this.ctl.game.state.wave > 0 && !this.ctl.over) this.ctl.saveReplay();
    this.ctl.togglePause(true);
  }

  private begin(online: () => Promise<RunSession>, local: () => Promise<void>): Promise<void> {
    // Läuft schon ein Start (Doppelklick, Leertaste), wartet der Aufrufer auf denselben Start
    this.starting ??= this.doBegin(online, local).finally(() => {
      this.starting = null;
    });
    return this.starting;
  }

  private async doBegin(online: () => Promise<RunSession>, local: () => Promise<void>): Promise<void> {
    if (this.meta.online && this.meta.api) {
      try {
        this.ctl.startSession(await online());
        return;
      } catch (err) {
        const why = err instanceof ApiError ? reasonText(err.code) : 'Server nicht erreichbar';
        this.events.status?.(`Gewerteter Start nicht möglich: ${why} – Lauf zählt nicht.`, 'err');
      }
    }
    await local();
  }

  private finish(game: Game): void {
    const s = game.state;
    const session = this.ctl.session;
    const record = runRecord(game, session?.kind === 'daily');
    const levelWaves = s.levelId ? (levelById(s.levelId)?.waves ?? null) : null;
    const summary: RunSummary = {
      levelId: s.levelId,
      mapId: s.mapId,
      mode: s.mode === 'level' ? 'level' : s.mode,
      daily: session?.kind === 'daily',
      won: s.won,
      stars: record.stars as RunSummary['stars'],
      score: s.score,
      wave: s.wave,
      waves: levelWaves ?? (s.mode === 'challenge' ? CHALLENGE_WAVES : null),
      kills: s.kills,
      lives: Math.max(0, s.lives),
      xpPreview: 0,
      ranked: !!session && this.meta.online,
    };
    let verdict: Promise<RunVerdict>;
    if (session && this.meta.api) {
      verdict = this.submit(session, game);
    } else if (!this.meta.online) {
      const out = this.meta.recordLocal(record, s.score);
      verdict = Promise.resolve(out ? { status: 'offline', xpGained: out.xpGained, rank: null, levelUp: out.levelUp, newAchievements: out.newAchievements } : OFFLINE);
    } else {
      // Online, aber ohne Session (Endlos oder Start fehlgeschlagen): zählt nicht
      verdict = Promise.resolve(OFFLINE);
    }
    summary.xpPreview = xpForRun(record, { firstClear: false, won: record.won });
    for (const fn of this.finished) fn(summary, verdict);
  }

  private async submit(session: RunSession, game: Game): Promise<RunVerdict> {
    const api = this.meta.api!;
    try {
      const xpBefore = (await this.meta.profile().catch(() => null))?.xp ?? 0;
      this.events.status?.('Wird eingereicht…', 'info');
      const id = await api.submitRun(session.sessionId, game.toReplay());
      this.events.status?.('Wird geprüft… (der Server spielt deinen Lauf nach)', 'info');
      const verdict = await api.verdict(id, xpBefore);
      if (verdict.status === 'verified') {
        const rank = await api
          .board(session.board, session.kind === 'daily' ? 'day' : 'all')
          .then((rows) => rows.find((r) => r.isMe)?.rank ?? null)
          .catch(() => null);
        this.meta.refresh();
        this.events.status?.(`Geprüft: +${verdict.xpGained} XP${rank ? ` · Rang ${rank}` : ''}`, 'ok');
        return { ...verdict, rank };
      }
      this.events.status?.(verdict.status === 'rejected' ? 'Lauf wurde abgelehnt.' : 'Prüfung dauert länger – XP folgen später.', verdict.status === 'rejected' ? 'err' : 'info');
      return verdict;
    } catch (err) {
      this.events.status?.(`Einreichen fehlgeschlagen: ${err instanceof ApiError ? reasonText(err.code) : 'Server nicht erreichbar'}`, 'err');
      return OFFLINE;
    }
  }
}
