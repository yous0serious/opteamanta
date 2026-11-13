import { reasonText, ApiError } from '../online/api';
import type { Controller } from '../view/controller';
import type { Meta } from './service';
import type { RankRow } from './types';

// Seitenleiste „Bestenliste“ im Spiel, wenn die Shell aktiv ist (Spec campaigns): zeigt die Rangliste des laufenden
// Laufs (Daily, Level oder Karte) und Statusmeldungen des Hosts. Ersetzt im Shell-Modus den alten Daily-Ablauf.

const $ = (id: string): HTMLElement | null => document.getElementById(id);
const fmt = (n: number): string => n.toLocaleString('de-DE');

export class RunBoard {
  private key: string | null = null;

  constructor(
    private readonly meta: Meta,
    private readonly ctl: Controller,
  ) {
    for (const id of ['play-kind', 'lb-tabs', 'team-name']) {
      const el = $(id);
      if (el) el.hidden = true;
    }
    ctl.onRestart(() => void this.refresh());
    meta.onChange(() => void this.refresh(true));
    void this.refresh();
  }

  status(text: string, kind: 'info' | 'ok' | 'err' = 'info'): void {
    const el = $('lb-status');
    if (!el) return;
    el.className = kind;
    el.textContent = text;
  }

  async refresh(force = false): Promise<void> {
    const s = this.ctl.session;
    const key = s ? s.board : '';
    if (key === this.key && !force) return;
    this.key = key;
    const list = $('lb-list');
    if (!list) return;
    list.replaceChildren();
    if (!s || !this.meta.online) {
      this.status(this.meta.online ? 'Dieser Lauf zählt nicht für die Rangliste.' : 'Offline – Fortschritt wird nur lokal gespeichert.');
      return;
    }
    this.status(s.kind === 'daily' ? 'Daily – heute für alle dieselbe Karte' : s.kind === 'level' ? 'Level-Rangliste' : 'Karten-Rangliste (Challenge 30)');
    try {
      render(list, (await this.meta.leaderboard(s.board, s.kind === 'daily' ? 'day' : 'all')).slice(0, 10));
    } catch (err) {
      this.status(`Rangliste nicht erreichbar${err instanceof ApiError ? `: ${reasonText(err.code)}` : ''}`, 'err');
    }
  }
}

function render(list: HTMLElement, rows: readonly RankRow[]): void {
  if (!rows.length) {
    const li = document.createElement('li');
    li.className = 'empty';
    li.textContent = 'Noch keine Läufe – sei die/der Erste!';
    list.append(li);
    return;
  }
  for (const r of rows) {
    const li = document.createElement('li');
    li.className = r.isMe ? 'me' : '';
    li.dataset.rank = String(r.rank);
    const cells: Array<[string, string]> = [
      ['rk', `${r.rank}.`],
      ['nk', r.nickname],
      ['sc', fmt(r.score)],
      ['wv', r.won ? (r.stars ? `${r.stars} St.` : 'Sieg') : `W${r.wave}`],
    ];
    for (const [cls, text] of cells) {
      const span = document.createElement('span');
      span.className = cls;
      span.textContent = text;
      li.append(span);
    }
    list.append(li);
  }
}
