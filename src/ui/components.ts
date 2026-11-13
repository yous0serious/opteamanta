// Wiederverwendbare Bausteine der Shell: Screen-Rahmen, Buttons, Profil-Plakette, Ranglisten, Karten-Miniatur.
import type { ProfileView, RankRow } from '../meta/types';
import type { ShellCtx } from './context';
import type { MapInfo } from './data';
import { fmt, h, svg } from './dom';
import { I, starRow, type IconName } from './icons';
import type { Route } from './router';

export function btn(
  label: string,
  opts: { icon?: IconName; cls?: string; onClick?: (ev: MouseEvent) => void; aria?: string; title?: string; disabled?: boolean; id?: string } = {},
): HTMLButtonElement {
  const b = h('button', { type: 'button', class: `sh-btn ${opts.cls ?? ''}`.trim(), 'aria-label': opts.aria, title: opts.title, disabled: opts.disabled, id: opts.id });
  if (opts.icon) b.append(svg(I[opts.icon]));
  if (label) b.append(h('span', { class: 'lbl', text: label }));
  if (opts.onClick) b.addEventListener('click', opts.onClick);
  return b;
}

/** Rahmen eines Unter-Screens: Kopfzeile mit Zurück, Titel und Aktionen; `body` nimmt den Inhalt auf. */
export function screenFrame(
  ctx: ShellCtx,
  o: { title: string; kicker?: string; back?: Route; cls?: string; actions?: Node[] },
): { el: HTMLElement; body: HTMLElement; head: HTMLElement } {
  const back = btn('Zurück', {
    icon: 'back',
    cls: 'sh-back',
    aria: 'Zurück',
    onClick: () => {
      ctx.snd('back');
      ctx.router.back(o.back ?? { name: 'menu' });
    },
  });
  const title = h('h1', { class: 'sh-title', tabindex: '-1' }, o.title);
  const head = h(
    'header',
    { class: 'sh-head' },
    back,
    h('div', { class: 'sh-titles' }, o.kicker ? h('div', { class: 'sh-kicker', text: o.kicker }) : null, title),
    h('div', { class: 'sh-actions' }, ...(o.actions ?? [])),
  );
  const body = h('div', { class: 'sh-body' });
  const el = h('section', { class: `sh-screen ${o.cls ?? ''}`.trim(), 'aria-labelledby': '' }, head, body);
  title.id = `t-${Math.random().toString(36).slice(2, 8)}`;
  el.setAttribute('aria-labelledby', title.id);
  return { el, body, head };
}

export function starsEl(n: number, cls = 'stars'): HTMLElement {
  return h('span', { class: cls, html: starRow(n), role: 'img', 'aria-label': `${n} von 3 Sternen` });
}

/** XP-Balken des Account-Levels. */
export function xpBar(p: ProfileView, cls = 'xpbar'): HTMLElement {
  const pct = p.xpForNext > 0 ? Math.min(100, (p.xpIntoLevel / p.xpForNext) * 100) : 100;
  return h(
    'div',
    { class: cls, role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(p.xpForNext), 'aria-valuenow': String(p.xpIntoLevel), 'aria-label': 'Erfahrung bis zum nächsten Level' },
    h('span', { class: 'fill', style: { width: `${pct}%` } }),
  );
}

/** Level-Abzeichen (Sechseck mit Zahl). */
export function levelBadge(level: number, cls = 'lvl-badge'): HTMLElement {
  return h('span', { class: cls, title: `Account-Level ${level}`, 'aria-label': `Level ${level}` }, h('b', { text: String(level) }));
}

/** Profil-Plakette: Teamname, Level, XP, Skillpunkte, „Konto sichern“. */
export function profilePlaque(ctx: ShellCtx, p: ProfileView, onSecure: () => void, onRename: () => void): HTMLElement {
  const free = Math.max(0, p.skillPoints - p.spentPoints);
  const name = h('button', { type: 'button', class: 'pp-name', title: 'Teamnamen ändern', 'aria-label': `Teamname ${p.nickname ?? 'unbenannt'} – ändern`, onclick: onRename }, p.nickname ?? 'Team ohne Namen');
  const plaque = h(
    'div',
    { class: 'plaque' },
    levelBadge(p.level),
    h(
      'div',
      { class: 'pp-main' },
      name,
      h('div', { class: 'pp-xp' }, xpBar(p), h('span', { class: 'pp-xpnum', text: `${fmt(p.xpIntoLevel)} / ${fmt(p.xpForNext)} XP` })),
      h(
        'div',
        { class: 'pp-tags' },
        free > 0
          ? h('button', { type: 'button', class: 'pp-points', onclick: () => ctx.router.go({ name: 'skills' }), title: 'Zum Skilltree' }, svg(I.tree), `${free} Skillpunkt${free === 1 ? '' : 'e'} frei`)
          : null,
        p.ranked ? null : h('span', { class: 'pp-offline', title: 'Fortschritt nur auf diesem Gerät' }, svg(I.cloudOff), 'Offline – nicht gewertet'),
        p.ranked && !p.email ? h('button', { type: 'button', class: 'pp-secure', onclick: onSecure, title: 'Konto sichern oder mit gesichertem Konto anmelden' }, svg(I.shield), 'Konto sichern / Anmelden') : null,
        p.email ? h('span', { class: 'pp-secured', title: p.email }, svg(I.shield), 'Gesichert') : null,
      ),
    ),
  );
  return plaque;
}

/** Ranglisten-Zeilen (Top N, eigener Rang hervorgehoben, Lücke als „…“). */
export function rankList(rows: readonly RankRow[], o: { empty?: string; showStars?: boolean; limit?: number } = {}): HTMLElement {
  const ol = h('ol', { class: 'ranklist' });
  if (!rows.length) {
    ol.append(h('li', { class: 'empty', text: o.empty ?? 'Noch keine Einträge – sei die/der Erste!' }));
    return ol;
  }
  let prev = 0;
  const limit = o.limit ?? 50;
  const top = rows.filter((r) => r.rank <= limit || r.isMe);
  for (const r of top) {
    if (r.rank > prev + 1 && prev > 0) ol.append(h('li', { class: 'gap', 'aria-hidden': 'true', text: '…' }));
    prev = r.rank;
    const li = h(
      'li',
      { class: `${r.isMe ? 'me' : ''} ${r.rank <= 3 ? `top top${r.rank}` : ''}`.trim(), data: { rank: String(r.rank) } },
      h('span', { class: 'rk' }, r.rank <= 3 ? svg(I.crown, 'rk-crown') : null, h('span', { text: String(r.rank) })),
      h('span', { class: 'nk', text: r.nickname }),
      o.showStars && r.stars !== null ? h('span', { class: 'rs', html: starRow(r.stars), 'aria-label': `${r.stars} Sterne` }) : null,
      h('span', { class: 'sc', text: fmt(r.score) }),
      h('span', { class: 'wv', text: r.won ? 'Sieg' : `W${r.wave}` }),
    );
    if (r.isMe) li.setAttribute('aria-current', 'true');
    ol.append(li);
  }
  return ol;
}

const THEMES: Record<string, { bg: string; grid: string; path: string; edge: string; deco: string }> = {
  'open-office': { bg: '#f3e6cf', grid: '#e6d3b1', path: '#fffdf7', edge: '#c8a978', deco: '#8bc34a' },
  'big-room': { bg: '#dbe5f3', grid: '#c9d6ea', path: '#ffffff', edge: '#8fa6c8', deco: '#ef5350' },
  'server-room': { bg: '#eaf1f5', grid: '#d5e2ea', path: '#f7fbff', edge: '#7fb3d9', deco: '#29b6f6' },
  boardroom: { bg: '#ece8e1', grid: '#ddd6ca', path: '#fffaf0', edge: '#bfa66f', deco: '#26a69a' },
};

/** Karten-Miniatur (SVG aus den Wegpunkten, 24 × 15 Zellen). */
export function mapMini(map: MapInfo | undefined, theme: string | null, cls = 'mapmini'): HTMLElement {
  const t = THEMES[theme ?? ''] ?? THEMES['open-office']!;
  const pts = (map?.waypoints ?? []).map(([x, y]) => `${x * 40 + 20},${y * 40 + 20}`).join(' ');
  const first = map?.waypoints[0];
  const last = map?.waypoints[map.waypoints.length - 1];
  const start = first ? [Math.max(20, first[0] * 40 + 20), first[1] * 40 + 20] : [0, 0];
  const end = last ? [Math.min(940, last[0] * 40 + 20), last[1] * 40 + 20] : [0, 0];
  const id = Math.random().toString(36).slice(2, 7);
  const markup = `<svg viewBox="0 0 960 600" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Kartenverlauf ${map?.name ?? ''}">
  <defs><pattern id="g${id}" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" fill="none" stroke="${t.grid}" stroke-width="2"/></pattern>
  <clipPath id="c${id}"><rect width="960" height="600" rx="28"/></clipPath></defs>
  <g clip-path="url(#c${id})">
  <rect width="960" height="600" fill="${t.bg}"/><rect width="960" height="600" fill="url(#g${id})"/>
  ${[[120, 520], [840, 90], [880, 520], [70, 90], [470, 300]].map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="${i % 2 ? 14 : 20}" fill="${t.deco}" opacity=".35"/>`).join('')}
  ${pts ? `<polyline points="${pts}" fill="none" stroke="${t.edge}" stroke-width="44" stroke-linejoin="round" stroke-linecap="square"/>
  <polyline points="${pts}" fill="none" stroke="${t.path}" stroke-width="34" stroke-linejoin="round" stroke-linecap="square"/>
  <polyline points="${pts}" fill="none" stroke="${t.edge}" stroke-width="4" stroke-dasharray="14 16" stroke-linejoin="round" opacity=".7"/>
  <circle cx="${start[0]}" cy="${start[1]}" r="22" fill="#26a69a" stroke="#fff" stroke-width="6"/><path d="M${start[0]! - 7} ${start[1]! - 9}l14 9-14 9z" fill="#fff"/>
  <circle cx="${end[0]}" cy="${end[1]}" r="22" fill="#e53935" stroke="#fff" stroke-width="6"/><path d="M${end[0]! - 6} ${end[1]! - 11}v22M${end[0]! - 5} ${end[1]! - 10}h13l-4 5 4 5h-13" fill="#fff" stroke="#fff" stroke-width="3" stroke-linejoin="round"/>` : ''}
  </g></svg>`;
  return h('div', { class: cls, html: markup });
}

/** Segment-Umschalter (Tabs). `onPick` erhält den Wert. */
export function segmented<T extends string>(
  items: ReadonlyArray<readonly [value: T, label: string]>,
  active: T,
  onPick: (v: T) => void,
  aria: string,
  cls = 'sh-seg',
): HTMLElement {
  const box = h('div', { class: cls, role: 'tablist', 'aria-label': aria });
  const btns = items.map(([v, label]) => {
    const b = h('button', { type: 'button', role: 'tab', 'aria-selected': String(v === active), class: v === active ? 'active' : '', data: { v } }, label);
    b.addEventListener('click', () => {
      for (const o of btns) {
        o.classList.toggle('active', o === b);
        o.setAttribute('aria-selected', String(o === b));
      }
      onPick(v);
    });
    return b;
  });
  // Pfeiltasten wechseln zwischen den Tabs
  box.addEventListener('keydown', (ev) => {
    if (ev.key !== 'ArrowRight' && ev.key !== 'ArrowLeft') return;
    const i = btns.indexOf(document.activeElement as HTMLButtonElement);
    if (i < 0) return;
    ev.preventDefault();
    const n = btns[(i + (ev.key === 'ArrowRight' ? 1 : btns.length - 1)) % btns.length]!;
    n.focus();
    n.click();
  });
  box.append(...btns);
  return box;
}

/** Lade-Skelett für Listen. */
export function skeleton(rows = 5): HTMLElement {
  return h('div', { class: 'skel', 'aria-busy': 'true', 'aria-label': 'Lädt' }, ...Array.from({ length: rows }, () => h('span')));
}

/** Hinweis „Ranglisten offline“. */
export function offlineNote(text = 'Ranglisten sind offline – ohne Verbindung zählt nur dein lokaler Fortschritt.'): HTMLElement {
  return h('p', { class: 'note offline' }, svg(I.cloudOff), h('span', { text }));
}
