// Level-Briefing: Karte, Gegner-Vorschau, Rollen, Sternziele, Bestwert, Mini-Rangliste, Start (Spec campaigns).
import { START_LIVES } from '../../sim/index';
import { enemyIcon, roleIcon } from '../atlas';
import { boardBox } from '../boards';
import { btn, mapMini, screenFrame, starsEl } from '../components';
import type { Screen, ShellCtx } from '../context';
import { ALL_ROLES, campaignInfo, CAMPAIGN_FLOOR, enemyInfo, levelEnemies, levelInfo, levelLabel, mapInfo, towerInfo } from '../data';
import { fmt, h, svg } from '../dom';
import { I, starRow } from '../icons';
import { levelProgress } from '../progress';
import type { Route } from '../router';

const pct = (f: number): string => `${f > 1 ? '+' : '−'}${Math.round(Math.abs(f - 1) * 100)} %`;

export function briefingScreen(ctx: ShellCtx, route: Route): Screen {
  const lv = levelInfo(route.id);
  const camp = campaignInfo(lv?.campaign);
  const { el, body } = screenFrame(ctx, {
    title: lv?.name ?? 'Unbekanntes Level',
    kicker: lv ? `${CAMPAIGN_FLOOR[lv.campaign]?.label ?? ''} · ${camp?.name ?? ''} · ${levelLabel(lv)}` : '',
    back: lv ? { name: 'campaign', id: lv.campaign } : { name: 'campaign' },
    cls: `briefing theme-${camp?.theme ?? 'open-office'}`,
  });
  if (!lv) {
    body.append(h('p', { class: 'note err', text: 'Dieses Level gibt es nicht.' }));
    return { el, title: 'Briefing' };
  }
  const map = mapInfo(lv.mapId);
  const enemies = levelEnemies(lv);
  const bossWave = lv.bossWaves[0];

  const chips = h(
    'div',
    { class: 'bf-chips' },
    h('span', { class: 'chip' }, svg(I.wave), h('b', { text: String(lv.waves) }), ' Wellen'),
    h('span', { class: 'chip' }, svg(I.coin), h('b', { text: fmt(lv.startMoney) }), ' SP Start'),
    h('span', { class: 'chip' }, svg(I.heart), h('b', { text: String(lv.lives ?? START_LIVES) }), ' % Moral'),
    lv.mods?.speed && lv.mods.speed !== 1 ? h('span', { class: 'chip mod', text: `Tempo ${pct(lv.mods.speed)}` }) : null,
    lv.mods?.reward && lv.mods.reward !== 1 ? h('span', { class: 'chip mod', text: `Belohnung ${pct(lv.mods.reward)}` }) : null,
    lv.tutorial ? h('span', { class: 'chip tut' }, svg(I.info), 'Mit Tutorial') : null,
  );

  const mapCard = h(
    'figure',
    { class: 'bf-map card' },
    mapMini(map, map?.theme ?? camp?.theme ?? null),
    h('figcaption', null, svg(I.campaign), h('span', { text: map?.name ?? lv.mapId })),
  );

  const foes = h(
    'section',
    { class: 'bf-foes card', 'aria-label': 'Gegner in diesem Level' },
    h('h2', { text: 'Was auf dich zukommt' }),
    h(
      'ul',
      { class: 'foe-list' },
      ...enemies.map((e) => {
        const info = enemyInfo(e.id);
        return h(
          'li',
          { class: e.boss ? 'boss' : '', title: info.name },
          enemyIcon(e.id, 40, info.color, info.name),
          h('span', { class: 'foe-name', text: info.name }),
          e.boss && bossWave ? h('span', { class: 'foe-tag', text: `Boss · Welle ${bossWave.wave}` }) : null,
        );
      }),
    ),
  );

  const roles = h(
    'section',
    { class: 'bf-roles', 'aria-label': 'Verfügbare Rollen' },
    h('h3', { text: 'Dein Team' }),
    h(
      'ul',
      { class: 'role-list' },
      ...(ALL_ROLES.length ? ALL_ROLES : lv.roles).map((r) => {
        const t = towerInfo(r);
        const ok = lv.roles.includes(r);
        return h('li', { class: ok ? '' : 'locked', title: ok ? t.name : `${t.name} – in diesem Level nicht verfügbar` }, roleIcon(r, 34, t.color, t.name), ok ? null : svg(I.lock, 'role-lock'), h('span', { class: 'sr-only', text: ok ? t.name : `${t.name} (gesperrt)` }));
      }),
    ),
  );

  const goals = h(
    'section',
    { class: 'bf-goals', 'aria-label': 'Sternziele' },
    h('h3', { text: 'Sternziele' }),
    h(
      'ol',
      { class: 'goal-list' },
      h('li', null, h('span', { class: 'stars', html: starRow(1) }), h('span', { text: 'Alle Wellen überstehen' })),
      h('li', null, h('span', { class: 'stars', html: starRow(2) }), h('span', { text: `Mit mindestens ${lv.stars.two} % Moral` })),
      h('li', null, h('span', { class: 'stars', html: starRow(3) }), h('span', { text: `Mit mindestens ${lv.stars.three} % Moral` })),
    ),
  );

  const best = h('div', { class: 'bf-best' });
  const start = btn('Sprint starten', {
    icon: 'play',
    cls: 'primary big bf-start',
    id: 'briefing-start',
    onClick: () => {
      ctx.snd('start');
      void ctx.launch(() => ctx.host.startLevel(lv.id));
    },
  });

  const note = h('div', { class: 'bf-note' }, h('div', { class: 'pin', 'aria-hidden': 'true' }), h('p', { text: lv.briefing }));
  const side = h(
    'div',
    { class: 'bf-side card' },
    note,
    h('div', { class: 'bf-split' }, goals, best),
    roles,
    h('div', { class: 'bf-cta' }, start),
  );
  const board = boardBox(ctx, {
    title: 'Bestenliste',
    tabs: [{ key: 'level', label: 'Level', board: `level:${lv.id}`, period: 'all', stars: true, empty: 'Noch keine Läufe – hol dir Platz 1!' }],
    limit: 5,
    cls: 'bf-board',
    onMore: () => ctx.router.go({ name: 'ranks', id: 'level', sub: lv.id }),
  });
  body.append(h('div', { class: 'bf-grid' }, h('div', { class: 'bf-left' }, mapCard, chips, foes), side, board));

  let alive = true;
  void ctx.meta
    .campaigns()
    .then((camps) => {
      if (!alive) return;
      const p = levelProgress(camps, lv.id);
      if (p && !p.unlocked) {
        start.disabled = true;
        start.querySelector('.lbl')!.textContent = 'Noch gesperrt';
      }
      best.replaceChildren(
        h('h3', { text: 'Dein Bestwert' }),
        p && p.bestScore !== null
          ? h('div', { class: 'best-val' }, starsEl(p.bestStars), h('b', { text: fmt(p.bestScore) }), h('small', { text: 'Punkte' }))
          : h('p', { class: 'muted', text: 'Noch nicht gespielt.' }),
      );
    })
    .catch(() => undefined);
  return {
    el,
    title: `${levelLabel(lv)} · ${lv.name}`,
    focus: start,
    dispose: () => {
      alive = false;
    },
  };
}
