// Ranglisten-Kasten (Hauptmenü-Vorschau, Briefing) – lädt `meta.leaderboard` mit Tabs.
import type { BoardId, RankPeriod } from '../meta/types';
import { offlineNote, rankList, segmented, skeleton } from './components';
import type { ShellCtx } from './context';
import { h } from './dom';

/** Heutiges Datum in Berlin (`YYYY-MM-DD`) – Daily-Boards. */
export function berlinToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(new Date());
}

export interface BoardTab {
  key: string;
  label: string;
  board: BoardId;
  period: RankPeriod;
  empty?: string;
  stars?: boolean;
}

/** Kasten mit Tabs und Top-N-Liste. `onMore` blendet „Alle anzeigen“ ein. */
export function boardBox(ctx: ShellCtx, o: { tabs: BoardTab[]; limit: number; title?: string; onMore?: (tab: BoardTab) => void; cls?: string }): HTMLElement {
  let active = o.tabs[0]!;
  const list = h('div', { class: 'bb-list', 'aria-live': 'polite' });
  const box = h('section', { class: `card bb ${o.cls ?? ''}`.trim(), 'aria-label': o.title ?? 'Rangliste' });
  const head = h('div', { class: 'bb-head' }, o.title ? h('h2', { text: o.title }) : null);
  if (o.tabs.length > 1) head.append(segmented(o.tabs.map((t) => [t.key, t.label] as const), active.key, (k) => {
    active = o.tabs.find((t) => t.key === k)!;
    void load();
  }, 'Rangliste wählen'));
  box.append(head, list);
  if (o.onMore) {
    const more = h('button', { type: 'button', class: 'bb-more', text: 'Alle Ranglisten' });
    more.addEventListener('click', () => o.onMore!(active));
    box.append(more);
  }
  let seq = 0;
  const load = async (): Promise<void> => {
    const my = ++seq;
    if (!ctx.meta.online) {
      list.replaceChildren(offlineNote());
      return;
    }
    list.replaceChildren(skeleton(Math.min(o.limit, 5)));
    try {
      const rows = await ctx.meta.leaderboard(active.board, active.period);
      if (my !== seq) return;
      list.replaceChildren(rankList(rows, { limit: o.limit, empty: active.empty, showStars: active.stars }));
    } catch {
      if (my === seq) list.replaceChildren(h('p', { class: 'note err', text: 'Rangliste gerade nicht erreichbar.' }));
    }
  };
  void load();
  return box;
}
