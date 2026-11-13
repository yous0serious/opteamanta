// Ranglisten: Tabs Daily · Karten · Level, Auswahl Karte/Level, Zeitraum gesamt/Woche/heute, Top 50, eigener Rang.
import type { BoardId, RankPeriod, RankRow } from '../../meta/types';
import { berlinToday } from '../boards';
import { offlineNote, rankList, screenFrame, segmented, skeleton } from '../components';
import type { Screen, ShellCtx } from '../context';
import { CAMPAIGN_LIST, freeMaps, levelInfo, levelLabel } from '../data';
import { fmt, h, svg } from '../dom';
import { I } from '../icons';
import type { Route } from '../router';

type Tab = 'daily' | 'map' | 'level';
const TABS: ReadonlyArray<readonly [Tab, string]> = [
  ['daily', 'Daily'],
  ['map', 'Karten'],
  ['level', 'Level'],
];
const PERIODS: ReadonlyArray<readonly [RankPeriod, string]> = [
  ['all', 'Gesamt'],
  ['week', 'Woche'],
  ['day', 'Heute'],
];

export function ranksScreen(ctx: ShellCtx, route: Route): Screen {
  const { el, body } = screenFrame(ctx, { title: 'Ranglisten', kicker: 'Wer rettet das Release?', cls: 'ranks' });
  const maps = freeMaps();
  let tab: Tab = (['daily', 'map', 'level'] as const).find((t) => t === route.id) ?? 'daily';
  let mapId = tab === 'map' && route.sub ? route.sub : (maps[0]?.id ?? '');
  let levelId = tab === 'level' && route.sub && levelInfo(route.sub) ? route.sub : (CAMPAIGN_LIST[0]?.levels[0] ?? '');
  let period: RankPeriod = tab === 'daily' ? 'day' : 'all';
  let alive = true;
  let seq = 0;

  const picker = h('div', { class: 'rk-picker' });
  const summary = h('div', { class: 'rk-me', 'aria-live': 'polite' });
  const list = h('div', { class: 'rk-list card', 'aria-live': 'polite' });
  let periodSeg = segmented(PERIODS, period, (p) => {
    period = p;
    void load();
  }, 'Zeitraum', 'sh-seg rk-period');

  const board = (): BoardId => (tab === 'daily' ? `daily:${berlinToday()}` : tab === 'map' ? `map:${mapId}` : `level:${levelId}`);

  const renderPicker = (): void => {
    picker.replaceChildren();
    if (tab === 'map') {
      const box = h('div', { class: 'rk-maps', role: 'radiogroup', 'aria-label': 'Karte' });
      for (const m of maps) {
        const b = h('button', { type: 'button', role: 'radio', 'aria-checked': String(m.id === mapId), class: `rk-chip${m.id === mapId ? ' active' : ''}`, text: m.name });
        b.addEventListener('click', () => {
          mapId = m.id;
          for (const o of box.children) {
            o.classList.toggle('active', o === b);
            o.setAttribute('aria-checked', String(o === b));
          }
          sync();
        });
        box.append(b);
      }
      picker.append(box);
    } else if (tab === 'level') {
      const sel = h('select', { class: 'rk-select', 'aria-label': 'Level wählen', id: 'rk-level' });
      for (const c of CAMPAIGN_LIST) {
        const g = h('optgroup', { label: c.name });
        for (const id of c.levels) {
          const lv = levelInfo(id);
          g.append(h('option', { value: id, selected: id === levelId, text: lv ? `${levelLabel(lv)} · ${lv.name}` : id }));
        }
        sel.append(g);
      }
      sel.addEventListener('change', () => {
        levelId = sel.value;
        sync();
      });
      picker.append(h('label', { class: 'rk-select-wrap' }, svg(I.campaign), sel));
    } else {
      const [, m, d] = berlinToday().split('-');
      picker.append(h('p', { class: 'rk-daily' }, svg(I.calendar), h('span', { text: `Daily vom ${d}.${m}. – alle spielen dieselbe Karte mit demselben Seed.` })));
    }
  };

  const sync = (): void => {
    ctx.router.go({ name: 'ranks', id: tab, sub: tab === 'map' ? mapId : tab === 'level' ? levelId : undefined }, { replace: true });
  };

  const load = async (): Promise<void> => {
    const my = ++seq;
    if (!ctx.meta.online) {
      list.replaceChildren(offlineNote());
      summary.replaceChildren();
      return;
    }
    list.replaceChildren(skeleton(8));
    try {
      const rows = await ctx.meta.leaderboard(board(), period);
      if (my !== seq || !alive) return;
      list.replaceChildren(rankList(rows, { limit: 50, showStars: tab === 'level', empty: 'Noch keine Einträge in diesem Zeitraum.' }));
      renderMe(rows);
      list.querySelector('li.me')?.scrollIntoView({ block: 'nearest' });
    } catch {
      if (my === seq) list.replaceChildren(h('p', { class: 'note err', text: 'Rangliste gerade nicht erreichbar.' }));
    }
  };

  const renderMe = (rows: RankRow[]): void => {
    const me = rows.find((r) => r.isMe);
    summary.replaceChildren(
      me
        ? h('div', { class: 'me-card' }, svg(I.podium), h('span', { text: 'Dein Rang' }), h('b', { text: `#${me.rank}` }), h('span', { class: 'muted', text: `${fmt(me.score)} Punkte` }))
        : h('div', { class: 'me-card none' }, svg(I.user), h('span', { text: 'Du bist hier noch nicht platziert.' })),
    );
  };

  const tabs = segmented(TABS, tab, (t) => {
    tab = t;
    period = t === 'daily' ? 'day' : 'all';
    const fresh = segmented(PERIODS, period, (p) => {
      period = p;
      void load();
    }, 'Zeitraum', 'sh-seg rk-period');
    periodSeg.replaceWith(fresh);
    periodSeg = fresh;
    renderPicker();
    sync();
  }, 'Ranglisten-Art', 'sh-seg rk-tabs');

  body.append(h('div', { class: 'rk-layout' }, h('div', { class: 'rk-controls card' }, tabs, picker, periodSeg, summary), list));
  renderPicker();
  void load();

  return {
    el,
    title: 'Ranglisten',
    dispose: () => {
      alive = false;
    },
    update: (r) => {
      if ((r.id ?? 'daily') !== tab) return false;
      if (tab === 'map' && r.sub) mapId = r.sub;
      if (tab === 'level' && r.sub) levelId = r.sub;
      void load();
      return true;
    },
  };
}
