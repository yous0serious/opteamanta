import { berlinDate, type BoardRow, type OnlineApi, type Period, type TickerRow } from '../online/api';
import { DailyFlow, type DailyUi, type PlayKind } from '../online/daily';
import type { Controller } from './controller';
import { askNickname } from './nickname';
import { shareState } from './share';
import { JOKES } from './texts';

/** Aktualisierung von Bestenliste und Ticker (Spec leaderboard-supabase T08). */
export const REFRESH_MS = 60_000;

const $ = <T extends HTMLElement = HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} fehlt im HTML`);
  return el as T;
};

const fmt = (n: number): string => n.toLocaleString('de-DE');

/** Ticker-Text: neue Tagesrekorde vor den Witzen. */
export function tickerText(records: readonly TickerRow[]): string {
  const news = records.map((r) => `+++ NEUER TAGESREKORD: ${r.nickname} mit ${fmt(r.score)} Punkten +++`);
  return [...news, ...JOKES].join('     ');
}

/** Seitenleisten-Block „Bestenliste“ mit Heute/Woche, eigenem Rang, Daily-Button und Statuszeile. */
export class LeaderboardPanel implements DailyUi {
  private period: Period = 'day';
  private lastTicker = '';
  private readonly tickerSince = new Date(Date.now() - 24 * 3600_000).toISOString();

  constructor(
    private readonly api: OnlineApi | null,
    private readonly ctl: Controller,
  ) {
    if (!api) {
      $('lb-list').innerHTML = '';
      this.status('Bestenliste offline');
      $('play-kind').hidden = true;
      $('team-name').hidden = true;
      $('lb-tabs').hidden = true;
      return;
    }
    const flow = new DailyFlow(api, ctl, this);

    for (const b of document.querySelectorAll<HTMLButtonElement>('#lb-tabs button')) {
      b.addEventListener('click', () => {
        this.period = b.dataset.period as Period;
        for (const o of document.querySelectorAll<HTMLButtonElement>('#lb-tabs button')) o.classList.toggle('active', o === b);
        void this.refresh();
      });
    }
    for (const b of document.querySelectorAll<HTMLButtonElement>('#play-kind button')) {
      b.addEventListener('click', () => {
        if (b.dataset.kind === flow.kind) return;
        const s = this.ctl.game.state;
        if (s.wave > 0 && !s.over && !window.confirm('Laufendes Spiel abbrechen?')) return;
        if (b.dataset.kind === 'free') flow.playFree();
        else void flow.start();
      });
    }
    $('team-name').addEventListener('click', () => {
      void askNickname((name) => flow.rename(name), flow.name ?? '');
    });
    // Teamname auch im Einstellungen-Popup ändern
    $('rename').addEventListener('click', () => {
      $<HTMLDialogElement>('settings-dialog').close();
      void askNickname((name) => flow.rename(name), flow.name ?? '');
    });
    this.status('Lade Bestenliste…');
    void this.boot(flow);
  }

  private async boot(flow: DailyFlow): Promise<void> {
    // Anmeldung, Teamname und Daily-Start (Spec office-makeover AC-1/AC-2); Lesen klappt auch ohne Anmeldung.
    await flow.boot();
    await this.refresh();
    await this.pollTicker();
    window.setInterval(() => {
      if (document.hidden) return;
      void this.refresh();
      void this.pollTicker();
    }, REFRESH_MS);
  }

  async refresh(): Promise<number | null> {
    if (!this.api) return null;
    try {
      const rows = await this.api.leaderboard(this.period, berlinDate());
      this.renderRows(rows);
      return rows.find((r) => r.is_me)?.rank ?? null;
    } catch {
      $('lb-list').innerHTML = '<li class="empty">Bestenliste gerade nicht erreichbar</li>';
      return null;
    }
  }

  private renderRows(rows: readonly BoardRow[]): void {
    const list = $('lb-list');
    list.replaceChildren();
    if (!rows.length) {
      const li = document.createElement('li');
      li.className = 'empty';
      li.textContent = this.period === 'day' ? 'Heute noch keine Läufe – sei die/der Erste!' : 'Diese Woche noch keine Läufe';
      list.append(li);
      return;
    }
    let prev = 0;
    for (const r of rows) {
      if (r.rank > prev + 1) {
        const gap = document.createElement('li');
        gap.className = 'gap';
        gap.textContent = '…';
        list.append(gap);
      }
      prev = r.rank;
      const li = document.createElement('li');
      li.className = r.is_me ? 'me' : '';
      li.dataset.rank = String(r.rank);
      const rank = document.createElement('span');
      rank.className = 'rk';
      rank.textContent = `${r.rank}.`;
      const nick = document.createElement('span');
      nick.className = 'nk';
      nick.textContent = r.nickname; // textContent: Nicknames nie als HTML
      const score = document.createElement('span');
      score.className = 'sc';
      score.textContent = fmt(r.score);
      score.title = r.won ? `Sieg · Moral ${r.lives} %` : `bis Welle ${r.wave}`;
      const wave = document.createElement('span');
      wave.className = 'wv';
      wave.textContent = r.won ? 'Sieg' : `W${r.wave}`;
      li.append(rank, nick, score, wave);
      list.append(li);
    }
  }

  private async pollTicker(): Promise<void> {
    if (!this.api) return;
    try {
      const text = tickerText(await this.api.ticker(this.tickerSince));
      if (text !== this.lastTicker) {
        this.lastTicker = text;
        $('tk').textContent = text;
      }
    } catch {
      // Ticker bleibt bei den Witzen.
    }
  }

  // ----- DailyUi -----

  status(text: string, kind: 'info' | 'ok' | 'err' = 'info', action?: { label: string; run: () => void }): void {
    const el = $('lb-status');
    el.className = kind;
    el.textContent = text;
    if (action) {
      const b = document.createElement('button');
      b.id = 'lb-action';
      b.textContent = action.label;
      b.addEventListener('click', () => action.run(), { once: true });
      el.append(document.createElement('br'), b);
    }
  }

  showName(name: string | null): void {
    const el = $('team-name');
    el.hidden = !name;
    el.textContent = name ? `Team: ${name}` : '';
    $('settings-team').hidden = !name;
    shareState.team = name;
  }

  showKind(kind: PlayKind): void {
    for (const b of document.querySelectorAll<HTMLButtonElement>('#play-kind button')) b.classList.toggle('active', b.dataset.kind === kind);
  }
}
