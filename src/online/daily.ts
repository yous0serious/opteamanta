import type { Game } from '../sim/index';
import type { Controller } from '../view/controller';
import { ApiError, berlinDate, reasonText, type OnlineApi } from './api';

/** Abfrage des Prüfstatus: alle 3 s, höchstens 120 s (Spec leaderboard-supabase T07). */
export const POLL_MS = 3000;
export const POLL_MAX_MS = 120_000;

export interface DailyUi {
  /** Statuszeile; `action` blendet einen Knopf ein (z. B. erneut einreichen). */
  status(text: string, kind?: 'info' | 'ok' | 'err', action?: { label: string; run: () => void }): void;
  askNickname(): Promise<string | null>;
  /** Bestenliste neu laden; liefert den eigenen Tagesrang, falls vorhanden. */
  refresh(): Promise<number | null>;
  busy(on: boolean): void;
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
const errText = (err: unknown): string => (err instanceof ApiError ? reasonText(err.code) : 'Server nicht erreichbar');

/** Ablauf der Daily Challenge: Server-Lauf holen, nach Spielende einreichen und Prüfung verfolgen. */
export class DailyFlow {
  constructor(
    private readonly api: OnlineApi,
    private readonly ctl: Controller,
    private readonly ui: DailyUi,
  ) {
    ctl.onFinished((game) => {
      if (ctl.daily) void this.submit(game);
    });
  }

  async start(): Promise<void> {
    this.ui.busy(true);
    this.ui.status('⏳ Daily wird geladen…');
    try {
      const session = await this.api.startDaily();
      this.ctl.startDaily(session);
      const [, m, d] = session.dailyDate.split('-');
      this.ui.status(`📅 Daily ${d}.${m}. – alle spielen heute dieselbe Karte. Viel Erfolg!`, 'info');
    } catch (err) {
      this.ui.status(`⚠️ Daily nicht verfügbar: ${errText(err)}`, 'err');
    } finally {
      this.ui.busy(false);
    }
  }

  private async submit(game: Game): Promise<void> {
    const session = this.ctl.daily;
    if (!session) return;
    const replay = game.toReplay();
    const retry = { label: '📤 Einreichen', run: () => void this.submit(game) };
    try {
      if (!(await this.api.nickname())) {
        const name = await this.ui.askNickname();
        if (!name) {
          this.ui.status('Nicht eingereicht – ohne Teamnamen keine Bestenliste.', 'info', retry);
          return;
        }
      }
      this.ui.status('📤 Wird eingereicht…');
      const id = await this.api.submit(session.sessionId, replay);
      this.ui.status('⏳ Wird geprüft… (der Server spielt deinen Lauf nach)');
      const deadline = Date.now() + POLL_MAX_MS;
      while (Date.now() < deadline) {
        await sleep(POLL_MS);
        const st = await this.api.submission(id).catch(() => null);
        if (st?.status === 'verified') {
          const rank = await this.ui.refresh();
          const today = session.dailyDate === berlinDate() ? (rank ? ` · Tagesrang ${rank}` : '') : '';
          this.ui.status(`✅ Geprüft: Score ${st.score ?? replay.result.score}${today}`, 'ok');
          return;
        }
        if (st?.status === 'rejected') {
          this.ui.status(`❌ Abgelehnt: ${st.reason ?? 'unbekannter Grund'}`, 'err');
          return;
        }
      }
      this.ui.status('⏳ Prüfung dauert länger – das Ergebnis erscheint später in der Bestenliste.', 'info');
    } catch (err) {
      const final = err instanceof ApiError && err.status >= 400 && err.status < 500 && err.status !== 429;
      this.ui.status(`⚠️ Einreichen fehlgeschlagen: ${errText(err)}`, 'err', final ? undefined : retry);
    }
  }
}
