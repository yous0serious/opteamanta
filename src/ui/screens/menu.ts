// Hauptmenü: Logo, Weiterspielen, Kacheln, Profil-Plakette, Ranglisten-Vorschau (Spec campaigns „Oberfläche“).
import { askNickname } from '../../view/nickname';
import { berlinToday, boardBox, type BoardTab } from '../boards';
import { btn, profilePlaque, skeleton, starsEl } from '../components';
import type { Screen, ShellCtx } from '../context';
import { campaignInfo, freeMaps, levelInfo, levelLabel } from '../data';
import { secureDialog } from '../dialogs';
import { h, svg } from '../dom';
import { I, type IconName } from '../icons';
import { levelProgress, nextLevel } from '../progress';

interface Tile {
  key: string;
  label: string;
  sub: string;
  icon: IconName;
  run: () => void;
  badge?: HTMLElement | null;
  disabled?: boolean;
}

export function menuScreen(ctx: ShellCtx): Screen {
  const el = h('section', { class: 'sh-screen menu', 'aria-labelledby': 'menu-logo' });
  const logo = h(
    'div',
    { class: 'menu-brand' },
    h('h1', { id: 'menu-logo', class: 'logo', tabindex: '-1' }, h('span', { class: 'l1', text: 'Backlog Defense' }), ' ', h('span', { class: 'l2', text: '3000' })),
    h('div', { class: 'edition' }, h('span', { text: 'SAFe Edition' })),
    h('p', { class: 'menu-claim', text: 'NEON-KFZ AG · Stell dein Team auf, bevor der Backlog in die Deadline rauscht.' }),
  );

  const cont = h('div', { class: 'menu-continue' }, skeleton(1));
  const badgePoints = h('span', { class: 'tile-badge', hidden: true });
  const badgeAch = h('span', { class: 'tile-badge soft', hidden: true });

  const tiles: Tile[] = [
    { key: 'campaign', label: 'Kampagne', sub: '4 Etagen · 24 Level', icon: 'building', run: () => ctx.router.go({ name: 'campaign' }) },
    {
      key: 'daily',
      label: 'Daily Challenge',
      sub: ctx.meta.online ? 'Heute für alle dieselbe Karte' : 'Nur online verfügbar',
      icon: 'calendar',
      disabled: !ctx.meta.online,
      run: () => void ctx.launch(() => ctx.host.startDaily()),
    },
    { key: 'free', label: 'Freies Spiel', sub: 'Challenge 30 oder Endlos', icon: 'dice', run: () => ctx.router.go({ name: 'free' }) },
    { key: 'skills', label: 'Skilltree', sub: 'Team · Prozess · Führung', icon: 'tree', run: () => ctx.router.go({ name: 'skills' }), badge: badgePoints },
    { key: 'ranks', label: 'Ranglisten', sub: 'Daily · Karten · Level', icon: 'podium', run: () => ctx.router.go({ name: 'ranks' }) },
    { key: 'achievements', label: 'Erfolge', sub: 'Abzeichen sammeln', icon: 'medal', run: () => ctx.router.go({ name: 'achievements' }), badge: badgeAch },
  ];
  const grid = h('nav', { class: 'menu-tiles', 'aria-label': 'Hauptmenü' });
  for (const t of tiles) {
    const b = h(
      'button',
      { type: 'button', class: `tile tile-${t.key}`, disabled: t.disabled, data: { tile: t.key } },
      h('span', { class: 'tile-ico' }, svg(I[t.icon])),
      h('span', { class: 'tile-txt' }, h('b', { text: t.label }), h('small', { text: t.sub })),
      t.badge ?? null,
    );
    b.addEventListener('click', () => {
      ctx.snd('click');
      t.run();
    });
    grid.append(b);
  }
  const settings = btn('Einstellungen', { icon: 'gear', cls: 'menu-settings', onClick: () => ctx.openSettings() });

  const plaqueBox = h('div', { class: 'menu-plaque' }, skeleton(2));

  // Ranglisten-Vorschau: Daily heute (Top 5), Karte der Daily-Woche, nächstes Level
  const maps = freeMaps();
  const boardHost = h('div', { class: 'menu-board' });

  const left = h('div', { class: 'menu-main' }, logo, cont, grid, settings);
  const right = h('aside', { class: 'menu-side' }, plaqueBox, boardHost);
  el.append(h('div', { class: 'menu-deco', 'aria-hidden': 'true', html: SKYLINE }), left, right);

  let alive = true;
  const load = async (): Promise<void> => {
    const [profile, camps, achs] = await Promise.all([
      ctx.meta.profile(),
      ctx.meta.campaigns(),
      ctx.meta.achievements().catch(() => []),
    ]);
    if (!alive) return;
    plaqueBox.replaceChildren(
      profilePlaque(
        ctx,
        profile,
        () => void secureDialog(ctx).then(() => void load()),
        () => void askNickname((n) => ctx.meta.rename(n), profile.nickname ?? ''),
      ),
    );
    const free = Math.max(0, profile.skillPoints - profile.spentPoints);
    badgePoints.hidden = free === 0;
    badgePoints.textContent = String(free);
    badgePoints.setAttribute('aria-label', `${free} Skillpunkte frei`);
    const got = achs.filter((a) => a.unlocked).length;
    badgeAch.hidden = !achs.length;
    badgeAch.textContent = `${got}/${achs.length}`;

    const nextId = nextLevel(camps);
    const lvl = levelInfo(nextId);
    if (lvl) {
      const prog = levelProgress(camps, lvl.id);
      const camp = campaignInfo(lvl.campaign);
      const b = h(
        'button',
        { type: 'button', class: 'continue', id: 'menu-continue' },
        h('span', { class: 'cont-play' }, svg(I.play)),
        h('span', { class: 'cont-txt' }, h('small', { text: prog && prog.bestStars > 0 ? 'Nochmal spielen' : 'Weiterspielen' }), h('b', { text: `${levelLabel(lvl)} · ${lvl.name}` }), h('span', { class: 'cont-camp', text: camp?.name ?? '' })),
        prog ? starsEl(prog.bestStars, 'stars cont-stars') : null,
      );
      b.addEventListener('click', () => {
        ctx.snd('open');
        ctx.router.go({ name: 'briefing', id: lvl.id });
      });
      cont.replaceChildren(b);
    } else cont.replaceChildren();

    const tabs: BoardTab[] = [{ key: 'daily', label: 'Daily', board: `daily:${berlinToday()}`, period: 'day', empty: 'Heute noch keine Läufe – sei die/der Erste!' }];
    if (maps[0]) tabs.push({ key: 'map', label: 'Karten', board: `map:${maps[0].id}`, period: 'all', empty: 'Noch keine Challenge-Läufe auf dieser Karte.' });
    if (lvl) tabs.push({ key: 'level', label: 'Level', board: `level:${lvl.id}`, period: 'all', stars: true, empty: 'Noch keine Läufe in diesem Level.' });
    boardHost.replaceChildren(
      boardBox(ctx, {
        title: 'Ranglisten',
        tabs,
        limit: 5,
        cls: 'menu-lb',
        onMore: (t) => ctx.router.go({ name: 'ranks', id: t.key === 'map' ? 'map' : t.key === 'level' ? 'level' : 'daily', sub: t.board.split(':')[1] }),
      }),
    );
  };
  void load().catch(() => {
    plaqueBox.replaceChildren(h('p', { class: 'note err', text: 'Profil konnte nicht geladen werden.' }));
  });
  const off = ctx.meta.onChange(() => void load().catch(() => undefined));
  return {
    el,
    title: 'Hauptmenü',
    dispose: () => {
      alive = false;
      off();
    },
  };
}

/** Dekorative Skyline mit NEON-KFZ-Hochhaus hinter dem Menü. */
const SKYLINE = `<svg viewBox="0 0 1600 360" preserveAspectRatio="xMidYMax slice">
<g fill="#e6dccb">
<rect x="0" y="210" width="90" height="150"/><rect x="100" y="170" width="70" height="190"/><rect x="180" y="240" width="110" height="120"/>
<rect x="1180" y="190" width="80" height="170"/><rect x="1270" y="230" width="120" height="130"/><rect x="1400" y="160" width="70" height="200"/><rect x="1480" y="220" width="120" height="140"/>
</g>
<g fill="#ddd1bc">
<rect x="300" y="250" width="80" height="110"/><rect x="1100" y="250" width="70" height="110"/>
</g>
<g>
<rect x="1010" y="40" width="160" height="320" rx="6" fill="#d6ece9"/>
<rect x="1010" y="40" width="160" height="22" rx="6" fill="#26a69a"/>
<text x="1090" y="56" font-family="Nunito, Arial" font-weight="800" font-size="13" text-anchor="middle" fill="#fff">NEON-KFZ AG</text>
${Array.from({ length: 9 }, (_, r) => Array.from({ length: 4 }, (_, c) => `<rect x="${1024 + c * 36}" y="${76 + r * 30}" width="24" height="18" rx="2" fill="${(r + c) % 3 === 0 ? '#fff7d6' : '#bfe0dc'}"/>`).join('')).join('')}
</g>
</svg>`;
