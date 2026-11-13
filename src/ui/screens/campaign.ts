// Kampagnenkarte: NEON-KFZ-Hauptsitz im Querschnitt – 4 Etagen (unten Team, oben Portfolio), Räume = Level,
// Aufzug zeigt den Fortschritt (Spec campaigns „Oberfläche“, AC-6).
import type { CampaignProgress } from '../../meta/types';
import { enemyIcon } from '../atlas';
import { btn, screenFrame, skeleton } from '../components';
import type { Screen, ShellCtx } from '../context';
import { CAMPAIGN_FLOOR, CAMPAIGN_LIST, enemyInfo, levelInfo, levelLabel } from '../data';
import { h, keep, svg } from '../dom';
import { I, starRow } from '../icons';
import type { Route } from '../router';
import { currentCampaign, nextLevel, ordered, starsOf } from '../progress';

export function campaignScreen(ctx: ShellCtx, route: Route): Screen {
  const { el, body } = screenFrame(ctx, { title: 'Kampagne', kicker: 'NEON-KFZ AG · Hauptsitz', cls: 'campaign' });
  body.append(skeleton(6));
  let alive = true;
  let camps: CampaignProgress[] = [];
  let selected = route.id ?? null;

  const building = h('div', { class: 'hq-building', role: 'group', 'aria-label': 'Etagen und Level' });
  const panel = h('aside', { class: 'hq-panel card', 'aria-live': 'polite' });
  const hq = h('div', { class: 'hq' }, building, panel);

  const render = (): void => {
    const list = ordered(camps);
    const cur = currentCampaign(list);
    const curIdx = Math.max(0, list.findIndex((c) => c.campaignId === cur));
    selected ??= cur;
    const next = nextLevel(list);

    const floors = h('div', { class: 'hq-floors' });
    list.forEach((cp, fi) => {
      const info = CAMPAIGN_LIST.find((c) => c.id === cp.campaignId);
      const fl = CAMPAIGN_FLOOR[cp.campaignId] ?? { label: `${fi}. OG`, room: '' };
      const st = starsOf(cp);
      const done = cp.levels.filter((l) => l.bestStars > 0).length;
      const floor = h('div', {
        class: `hq-floor theme-${info?.theme ?? 'open-office'}${cp.unlocked ? '' : ' locked'}${cp.campaignId === selected ? ' selected' : ''}${cp.campaignId === cur ? ' current' : ''}`,
        data: { campaign: cp.campaignId },
      });
      floor.style.setProperty('--done', String(done));
      const label = h(
        'button',
        { type: 'button', class: 'fl-label', 'aria-pressed': String(cp.campaignId === selected), 'aria-label': `${fl.label} – ${info?.name ?? cp.campaignId}${cp.unlocked ? `, ${st.got} von ${st.of} Sternen` : ', gesperrt'}` },
        h('span', { class: 'fl-no', text: fl.label }),
        h('span', { class: 'fl-name', text: fl.room }),
        cp.unlocked ? h('span', { class: 'fl-stars' }, svg(I.star, 'st on'), `${st.got}/${st.of}`) : h('span', { class: 'fl-lock' }, svg(I.lock), 'gesperrt'),
      );
      label.addEventListener('click', () => select(cp.campaignId));
      const rooms = h('div', { class: 'fl-rooms' });
      cp.levels.forEach((lp, li) => {
        const lv = levelInfo(lp.levelId);
        const boss = li === cp.levels.length - 1;
        const locked = !cp.unlocked || !lp.unlocked;
        const isNext = lp.levelId === next && !locked;
        const room = h(
          'button',
          {
            type: 'button',
            class: `room${boss ? ' boss' : ''}${locked ? ' locked' : ''}${lp.bestStars > 0 ? ' done' : ''}${isNext ? ' next' : ''}`,
            'aria-disabled': locked ? 'true' : null,
            'aria-label': `${lv ? `${levelLabel(lv)}: ${lv.name}` : lp.levelId}${boss ? ' (Boss)' : ''}${locked ? ', gesperrt' : `, ${lp.bestStars} von 3 Sternen`}`,
            data: { level: lp.levelId, fi: String(fi), li: String(li) },
          },
          h(
            'span',
            { class: 'door' },
            h('span', { class: 'door-plate', text: `${CAMPAIGN_FLOOR[cp.campaignId]?.label === 'EG' ? '0' : fi}.${String(li + 1).padStart(2, '0')}` }),
            locked ? svg(I.lock, 'door-lock') : boss ? svg(I.boss, 'door-boss') : h('span', { class: 'door-knob' }),
            isNext ? h('span', { class: 'door-here', text: 'Hier weiter' }) : null,
          ),
          h('span', { class: 'room-name', text: lv?.name ?? lp.levelId }),
          h('span', { class: 'stars room-stars', html: starRow(lp.bestStars), 'aria-hidden': 'true' }),
        );
        room.addEventListener('click', () => {
          if (locked) {
            ctx.snd('error');
            ctx.toast(lockReason(list, cp, li), 'info', I.lock);
            return;
          }
          ctx.snd('open');
          ctx.router.go({ name: 'briefing', id: lp.levelId });
        });
        rooms.append(room);
      });
      floor.append(label, h('div', { class: 'fl-hall' }, h('div', { class: 'fl-corridor', 'aria-hidden': 'true' }, h('span', { class: 'fl-progress' })), rooms));
      floors.append(floor);
    });

    const shaft = h(
      'div',
      { class: 'hq-shaft', 'aria-hidden': 'true' },
      h('div', { class: 'cabin' }, h('span', { class: 'cabin-led', text: CAMPAIGN_FLOOR[cur]?.label ?? '' }), svg(I.up, 'cabin-arrow')),
    );
    shaft.style.setProperty('--floors', String(list.length));
    shaft.style.setProperty('--cur', '0');
    building.replaceChildren(
      h('div', { class: 'hq-roof', 'aria-hidden': 'true', html: ROOF }),
      h('div', { class: 'hq-body' }, shaft, floors),
      h('div', { class: 'hq-ground', 'aria-hidden': 'true' }, h('span', { class: 'hq-door-main', text: 'Haupteingang' })),
    );
    // Aufzug fährt von unten zur aktuellen Etage
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        shaft.style.setProperty('--cur', String(curIdx));
        // Aktuelle Etage sichtbar machen (auf kleinen Bildschirmen liegt das Erdgeschoss sonst unterhalb)
        building.querySelector<HTMLElement>('.hq-floor.current')?.scrollIntoView({ block: 'nearest', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      }),
    );
    renderPanel(list);
  };

  const renderPanel = (list: CampaignProgress[]): void => {
    const cp = list.find((c) => c.campaignId === selected) ?? list[0];
    if (!cp) return;
    const info = CAMPAIGN_LIST.find((c) => c.id === cp.campaignId);
    const fl = CAMPAIGN_FLOOR[cp.campaignId];
    const st = starsOf(cp);
    const boss = info ? enemyInfo(info.boss) : null;
    const bossLevel = levelInfo(cp.levels[cp.levels.length - 1]?.levelId);
    const firstOpen = cp.levels.find((l) => l.unlocked && l.bestStars === 0) ?? [...cp.levels].reverse().find((l) => l.unlocked);
    const target = levelInfo(firstOpen?.levelId);
    panel.className = `hq-panel card theme-${info?.theme ?? 'open-office'}${cp.unlocked ? '' : ' locked'}`;
    panel.replaceChildren(...keep(
      h('div', { class: 'pn-kicker', text: `${fl?.label ?? ''} · ${fl?.room ?? ''}` }),
      h('h2', { class: 'pn-title', text: info?.name ?? cp.campaignId }),
      h('p', { class: 'pn-tag', text: info?.tagline ?? '' }),
      h(
        'div',
        { class: 'pn-progress' },
        h('div', { class: 'pn-stars' }, svg(I.star, 'st on'), h('b', { text: `${st.got}` }), h('span', { text: ` / ${st.of} Sterne` })),
        h('div', { class: 'meter', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(st.of), 'aria-valuenow': String(st.got), 'aria-label': 'Sterne dieser Etage' }, h('span', { style: { width: `${(st.got / Math.max(1, st.of)) * 100}%` } })),
      ),
      boss
        ? h(
            'div',
            { class: 'pn-boss' },
            enemyIcon(boss.id, 44, boss.color, boss.name),
            h('div', null, h('small', { text: `Boss${bossLevel ? ` · ${levelLabel(bossLevel)}` : ''}` }), h('b', { text: boss.name })),
          )
        : null,
      cp.unlocked && target
        ? btn(`${target ? `${levelLabel(target)} · ${target.name}` : ''}`, {
            icon: 'play',
            cls: 'primary pn-go',
            aria: `Zum Briefing: ${target.name}`,
            onClick: () => {
              ctx.snd('open');
              ctx.router.go({ name: 'briefing', id: target.id });
            },
          })
        : h('p', { class: 'note lock' }, svg(I.lock), h('span', { text: lockReason(list, cp, 0) })),
    ));
  };

  const select = (id: string): void => {
    if (id === selected) return;
    selected = id;
    ctx.snd('click');
    for (const f of building.querySelectorAll<HTMLElement>('.hq-floor')) {
      const on = f.dataset.campaign === id;
      f.classList.toggle('selected', on);
      f.querySelector('.fl-label')?.setAttribute('aria-pressed', String(on));
    }
    renderPanel(ordered(camps));
    ctx.router.go({ name: 'campaign', id }, { replace: true });
  };

  // Pfeiltasten: links/rechts zwischen Räumen, hoch/runter zwischen Etagen
  building.addEventListener('keydown', (ev) => {
    const cur = (document.activeElement as HTMLElement | null)?.closest<HTMLElement>('.room');
    if (!cur || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(ev.key)) return;
    const fi = Number(cur.dataset.fi);
    const li = Number(cur.dataset.li);
    const nfi = ev.key === 'ArrowUp' ? fi + 1 : ev.key === 'ArrowDown' ? fi - 1 : fi;
    const nli = ev.key === 'ArrowRight' ? li + 1 : ev.key === 'ArrowLeft' ? li - 1 : li;
    const n = building.querySelector<HTMLElement>(`.room[data-fi="${nfi}"][data-li="${nli}"]`);
    if (n) {
      ev.preventDefault();
      n.focus();
    }
  });

  void ctx.meta
    .campaigns()
    .then((c) => {
      if (!alive) return;
      camps = c;
      body.replaceChildren(hq);
      render();
    })
    .catch(() => body.replaceChildren(h('p', { class: 'note err', text: 'Kampagnen konnten nicht geladen werden.' })));

  return {
    el,
    title: 'Kampagne',
    update: (r) => {
      if (r.id && r.id !== selected && camps.length) {
        selected = r.id;
        render();
      }
      return true;
    },
    dispose: () => {
      alive = false;
    },
  };
}

function lockReason(list: CampaignProgress[], cp: CampaignProgress, li: number): string {
  if (!cp.unlocked) {
    const i = list.indexOf(cp);
    const prev = list[i - 1];
    const prevInfo = CAMPAIGN_LIST.find((c) => c.id === prev?.campaignId);
    const boss = prevInfo ? enemyInfo(prevInfo.boss).name : 'den Boss';
    return `Gesperrt – besiege zuerst ${boss} (${CAMPAIGN_FLOOR[prev?.campaignId ?? '']?.label ?? 'Etage darunter'}).`;
  }
  const prev = levelInfo(cp.levels[li - 1]?.levelId);
  return prev ? `Gesperrt – hol zuerst mindestens einen Stern in ${levelLabel(prev)}.` : 'Noch gesperrt.';
}

/** Dach mit Firmenschild, Antenne und Skyline. */
const ROOF = `<svg viewBox="0 0 800 90" preserveAspectRatio="xMidYMax meet">
<g fill="#cfd8dc" opacity=".55"><rect x="10" y="38" width="60" height="52"/><rect x="80" y="20" width="40" height="70"/><rect x="680" y="28" width="50" height="62"/><rect x="738" y="46" width="56" height="44"/></g>
<rect x="150" y="62" width="500" height="28" rx="4" fill="#37474f"/>
<rect x="300" y="24" width="200" height="40" rx="8" fill="#fff" stroke="#26a69a" stroke-width="4"/>
<text x="400" y="51" text-anchor="middle" font-family="Nunito, Arial" font-weight="800" font-size="20" fill="#00796b">NEON-KFZ AG</text>
<path d="M600 62V14" stroke="#607d8b" stroke-width="4"/><circle cx="600" cy="12" r="6" fill="#e53935"/>
<rect x="190" y="48" width="70" height="14" rx="3" fill="#90a4ae"/><rect x="530" y="50" width="50" height="12" rx="3" fill="#90a4ae"/>
</svg>`;
