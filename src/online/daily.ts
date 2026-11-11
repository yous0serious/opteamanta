import type { Game } from '../sim/index';
import type { Controller } from '../view/controller';
import { shareState } from '../view/share';
import { ApiError, berlinDate, reasonText, type DailySession, type OnlineApi } from './api';
import { generateName } from './names';

/** Abfrage des Prüfstatus: alle 3 s, höchstens 120 s (Spec leaderboard-supabase T07). */
export const POLL_MS = 3000;
export const POLL_MAX_MS = 120_000;

/** Spielart: Daily (Standard online) oder freies Spiel (Challenge/Endlos, ohne Einreichung). */
export type PlayKind = 'daily' | 'free';

export interface DailyUi {
  /** Statuszeile; `action` blendet einen Knopf ein (z. B. erneut einreichen). */
  status(text: string, kind?: 'info' | 'ok' | 'err', action?: { label: string; run: () => void }): void;
  /** Bestenliste neu laden; liefert den eigenen Tagesrang, falls vorhanden. */
  refresh(): Promise<number | null>;
  /** Teamname anzeigen (null = noch unbekannt). */
  showName(name: string | null): void;
  /** Aktive Spielart anzeigen. */
  showKind(kind: PlayKind): void;
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
const errText = (err: unknown): string => (err instanceof ApiError ? reasonText(err.code) : 'Server nicht erreichbar');

/**
 * Daily-Ablauf (Spec office-makeover AC-1/AC-2): Online startet automatisch ein Daily-Lauf, nach Spielende wird
 * automatisch eingereicht, ein Neustart ist ein neuer Daily-Versuch. „Freies Spiel“ schaltet auf lokale Spiele um.
 */
export class DailyFlow {
  kind: PlayKind = 'daily';
  name: string | null = null;
  private starting = false;
  /** Bereits geholte Session, falls das laufende Spiel schon begonnen hatte (startet beim nächsten Neustart). */
  private pending: DailySession | null = null;

  constructor(
    private readonly api: OnlineApi,
    private readonly ctl: Controller,
    private readonly ui: DailyUi,
  ) {
    ctl.onFinished((game) => {
      if (ctl.daily) void this.submit(game);
    });
    ctl.restartOverride = () => {
      if (this.kind !== 'daily') return false;
      const p = this.pending;
      this.pending = null;
      if (p && Date.parse(p.expiresAt) > Date.now() + 60_000) this.begin(p);
      else void this.start();
      return true;
    };
  }

  /** Beim Laden: anmelden, Teamnamen sicherstellen, Daily starten. */
  async boot(): Promise<void> {
    this.ui.showKind(this.kind);
    try {
      await this.api.signIn();
      this.name = await this.api.ensureProfile(() => generateName());
      this.ui.showName(this.name);
    } catch (err) {
      this.kind = 'free';
      this.ui.showKind('free');
      this.ui.status(`Online-Anmeldung fehlgeschlagen: ${errText(err)} – freies Spiel`, 'err');
      return;
    }
    await this.start();
  }

  /** Neuen Daily-Versuch holen und starten (ersetzt ein noch nicht begonnenes Spiel). */
  async start(): Promise<void> {
    if (this.starting) return;
    this.starting = true;
    this.kind = 'daily';
    this.ui.showKind('daily');
    this.ui.status('Daily wird geladen…');
    try {
      const session = await this.api.startDaily();
      const s = this.ctl.game.state;
      if (s.wave > 0 && !s.over) {
        // Spieler hat schon losgelegt: dieses Spiel bleibt frei, die Daily startet nach dem Spielende.
        this.pending = session;
        this.ui.status('Daily bereit – startet nach diesem Spiel.', 'info');
        return;
      }
      this.begin(session);
    } catch (err) {
      this.kind = 'free';
      this.ui.showKind('free');
      if (this.ctl.over) this.ctl.restart();
      this.ui.status(`Daily nicht verfügbar: ${errText(err)} – freies Spiel`, 'err', {
        label: 'Daily erneut versuchen',
        run: () => void this.start(),
      });
    } finally {
      this.starting = false;
    }
  }

  private begin(session: DailySession): void {
    this.ctl.startDaily(session);
    const [, m, d] = session.dailyDate.split('-');
    this.ui.status(`Daily ${d}.${m}. – alle spielen heute dieselbe Karte. Viel Erfolg!`, 'info');
  }

  /** Schalter „Freies Spiel“. */
  playFree(): void {
    this.kind = 'free';
    this.pending = null;
    this.ui.showKind('free');
    this.ctl.startFree();
    this.ui.status('Freies Spiel – Ergebnisse zählen nicht für die Bestenliste.', 'info');
  }

  /** Teamname ändern; liefert das Ergebnis der Prüfung. */
  async rename(name: string): Promise<'ok' | 'taken' | 'invalid'> {
    const res = await this.api.setNickname(name);
    if (res === 'ok') {
      this.name = name;
      this.ui.showName(name);
      void this.ui.refresh();
    }
    return res;
  }

  private async submit(game: Game): Promise<void> {
    const session = this.ctl.daily;
    if (!session) return;
    const replay = game.toReplay();
    const retry = { label: 'Erneut einreichen', run: () => void this.submit(game) };
    try {
      this.ui.status('Wird eingereicht…');
      const id = await this.api.submit(session.sessionId, replay);
      this.ui.status('Wird geprüft… (der Server spielt deinen Lauf nach)');
      const deadline = Date.now() + POLL_MAX_MS;
      while (Date.now() < deadline) {
        await sleep(POLL_MS);
        const st = await this.api.submission(id).catch(() => null);
        if (st?.status === 'verified') {
          const rank = await this.ui.refresh();
          shareState.rank = rank;
          const today = session.dailyDate === berlinDate() ? (rank ? ` · Tagesrang ${rank}` : '') : '';
          this.ui.status(`Geprüft: Score ${st.score ?? replay.result.score}${today}`, 'ok');
          return;
        }
        if (st?.status === 'rejected') {
          this.ui.status(`Abgelehnt: ${st.reason ?? 'unbekannter Grund'}`, 'err');
          return;
        }
      }
      this.ui.status('Prüfung dauert länger – das Ergebnis erscheint später in der Bestenliste.', 'info');
    } catch (err) {
      const final = err instanceof ApiError && err.status >= 400 && err.status < 500 && err.status !== 429;
      this.ui.status(`Einreichen fehlgeschlagen: ${errText(err)}`, 'err', final ? undefined : retry);
    }
  }
}
