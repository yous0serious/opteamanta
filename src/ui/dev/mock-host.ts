// Mock-GameHost für die Entwicklung (`?shell=mock`): startet das echte Spiel über den Controller (window.__bd im
// Dev-Modus) und meldet Spielende als RunSummary. `window.__shellMock.finish(won, stars)` simuliert ein Ergebnis.
import type { GameHost, RunSummary, RunVerdict } from '../../meta/types';
import { levelInfo } from '../data';
import type { MockMeta } from './mock-meta';

interface DevCtl {
  game: { state: { wave: number; over: boolean; won: boolean; score: number; lives: number; mapId: string; mode: string; kills?: number } };
  daily: unknown;
  startFree(mode?: string): void;
  startLocal?(opts: { levelId?: string | null; mapId?: string; mode?: string; loadout?: Record<string, number> }): void;
  restart(): void;
  onFinished(fn: (g: DevCtl['game']) => void): () => void;
}

const ctl = (): DevCtl | undefined => (window as unknown as { __bd?: DevCtl }).__bd;

export class MockHost implements GameHost {
  private readonly listeners = new Set<(s: RunSummary, v: Promise<RunVerdict>) => void>();
  private current: { levelId: string | null; mapId: string; mode: RunSummary['mode']; daily: boolean } = { levelId: null, mapId: 'waterfall', mode: 'challenge', daily: false };
  private hooked = false;

  constructor(private readonly meta: MockMeta) {
    (window as unknown as { __shellMock: unknown }).__shellMock = {
      finish: (won = true, stars: 0 | 1 | 2 | 3 = 2) => this.finish(won, stars),
      host: this,
    };
  }

  private hook(): void {
    const c = ctl();
    if (!c || this.hooked) return;
    this.hooked = true;
    c.onFinished((g) => {
      const s = g.state;
      this.emit(s.won, s.won ? (s.lives >= 85 ? 3 : s.lives >= 50 ? 2 : 1) : 0, { score: s.score, wave: s.wave, lives: s.lives, kills: s.kills ?? s.wave * 9 });
    });
  }

  async startLevel(levelId: string): Promise<void> {
    await new Promise((r) => setTimeout(r, 150));
    const lv = levelInfo(levelId);
    if (!lv) throw new Error('Unbekanntes Level');
    this.current = { levelId, mapId: lv.mapId, mode: 'level', daily: false };
    this.hook();
    const c = ctl();
    if (c?.startLocal) c.startLocal({ levelId, loadout: await this.meta.loadout() });
    else c?.startFree('challenge');
  }

  async startDaily(): Promise<void> {
    await new Promise((r) => setTimeout(r, 200));
    this.current = { levelId: null, mapId: 'waterfall', mode: 'challenge', daily: true };
    this.hook();
    ctl()?.startFree('challenge');
  }

  async startFree(mapId: string, mode: 'challenge' | 'endless'): Promise<void> {
    this.current = { levelId: null, mapId, mode, daily: false };
    this.hook();
    const c = ctl();
    if (c?.startLocal) c.startLocal({ mapId, mode });
    else c?.startFree(mode);
  }

  quit(): void {
    const c = ctl();
    if (c && c.game.state.wave > 0) c.restart();
  }

  onFinished(fn: (s: RunSummary, v: Promise<RunVerdict>) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /** Ergebnis simulieren (Dev/Screenshots). */
  finish(won: boolean, stars: 0 | 1 | 2 | 3): void {
    const lv = levelInfo(this.current.levelId);
    const waves = lv?.waves ?? (this.current.mode === 'endless' ? null : 30);
    this.emit(won, won ? stars : 0, { score: won ? 24_000 + stars * 3100 : 9_850, wave: won ? (waves ?? 42) : Math.max(3, Math.floor((waves ?? 30) * 0.6)), lives: won ? [20, 45, 70, 92][stars]! : 0, kills: won ? 212 : 117 });
  }

  private emit(won: boolean, stars: 0 | 1 | 2 | 3, r: { score: number; wave: number; lives: number; kills: number }): void {
    const lv = levelInfo(this.current.levelId);
    const summary: RunSummary = {
      levelId: this.current.levelId,
      mapId: this.current.mapId,
      mode: this.current.mode,
      daily: this.current.daily,
      won,
      stars: lv ? stars : 0,
      score: r.score,
      wave: r.wave,
      waves: lv?.waves ?? (this.current.mode === 'endless' ? null : 30),
      kills: r.kills,
      lives: r.lives,
      xpPreview: r.kills + r.wave * 5 + (lv ? stars * 40 : 0) + (won ? 50 : 0),
      ranked: this.meta.online,
    };
    const verdict = this.meta.verify(summary);
    for (const fn of this.listeners) fn(summary, verdict);
  }
}
