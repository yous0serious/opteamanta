// Skilltree: 3 Äste (Team, Prozess, Führung) als Knoten-Graph mit Voraussetzungs-Linien (SVG), Ränge, Respec.
import type { ProfileView } from '../../meta/types';
import { atlasIcon } from '../atlas';
import { btn, offlineNote, screenFrame, segmented, skeleton } from '../components';
import type { Screen, ShellCtx } from '../context';
import { iconFrame, SKILL_BRANCHES, SKILL_LIST, type SkillBranch, type SkillInfo } from '../data';
import { confirmDialog } from '../dialogs';
import { h, keep, svg } from '../dom';
import { I } from '../icons';

const BRANCH_GLYPH: Record<SkillBranch, string> = { team: I.user, process: I.refresh, leadership: I.crown };

export function skillsScreen(ctx: ShellCtx): Screen {
  const points = h('div', { class: 'sk-points', 'aria-live': 'polite' });
  const respec = btn('Respec', { icon: 'refresh', cls: 'sk-respec', title: 'Alle Punkte zurücksetzen (kostenlos)' });
  const { el, body } = screenFrame(ctx, { title: 'Skilltree', kicker: 'Weiterbildung · Account-Level', cls: 'skills', actions: [points, respec] });
  body.append(skeleton(6));
  let alive = true;
  let profile: ProfileView | null = null;
  let loadout: Record<string, number> = {};
  let selected: string | null = null;
  let branch: SkillBranch = 'team';
  let busy = false;

  const tree = h('div', { class: 'sk-tree', data: { branch } });
  const detail = h('aside', { class: 'sk-detail card', 'aria-live': 'polite' });
  const tabs = segmented(SKILL_BRANCHES.map((b) => [b.id, b.name] as const), branch, (b) => {
    branch = b;
    tree.dataset.branch = b;
    requestAnimationFrame(drawLines);
  }, 'Ast wählen', 'sh-seg sk-tabs');
  const nodes = new Map<string, HTMLButtonElement>();
  const svgs: SVGSVGElement[] = [];

  const free = (): number => (profile ? Math.max(0, profile.skillPoints - profile.spentPoints) : 0);
  const rank = (id: string): number => loadout[id] ?? 0;
  const reqMet = (s: SkillInfo): boolean => s.requires.every((r) => rank(r) > 0);
  const dependents = (id: string): SkillInfo[] => SKILL_LIST.filter((s) => s.requires.includes(id) && rank(s.id) > 0);

  const build = (): void => {
    tree.replaceChildren();
    for (const b of SKILL_BRANCHES) {
      const skills = SKILL_LIST.filter((s) => s.branch === b.id);
      const tiers = [...new Set(skills.map((s) => s.tier))].sort((a, z) => a - z);
      const lines = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      lines.setAttribute('class', 'sk-lines');
      lines.setAttribute('aria-hidden', 'true');
      svgs.push(lines);
      const col = h(
        'section',
        { class: `sk-branch br-${b.id}`, data: { branch: b.id }, 'aria-label': `Ast ${b.name}` },
        h('header', { class: 'sk-bhead' }, svg(BRANCH_GLYPH[b.id], 'sk-bglyph'), h('div', null, h('h2', { text: b.name }), h('small', { text: b.tagline }))),
      );
      const grid = h('div', { class: 'sk-grid' });
      grid.append(lines);
      for (const t of tiers) {
        const row = h('div', { class: 'sk-tier' });
        for (const s of skills.filter((x) => x.tier === t).sort((a, z) => a.col - z.col)) {
          const n = h(
            'button',
            { type: 'button', class: `sk-node${s.capstone ? ' cap' : ''}`, data: { skill: s.id } },
            h('span', { class: 'sk-orb' }, atlasIcon([iconFrame(s.icon)], s.capstone ? 40 : 30, svg(BRANCH_GLYPH[s.branch], 'sk-fallback'))),
            h('span', { class: 'sk-pips', 'aria-hidden': 'true' }, ...Array.from({ length: s.maxRank }, () => h('i'))),
            h('span', { class: 'sk-name', text: s.name }),
          );
          n.addEventListener('click', () => {
            ctx.snd('click');
            select(s.id);
          });
          nodes.set(s.id, n);
          row.append(n);
        }
        grid.append(row);
      }
      col.append(grid);
      tree.append(col);
    }
  };

  const refreshNodes = (): void => {
    for (const s of SKILL_LIST) {
      const n = nodes.get(s.id);
      if (!n) continue;
      const r = rank(s.id);
      const locked = !reqMet(s);
      n.classList.toggle('locked', locked);
      n.classList.toggle('owned', r > 0);
      n.classList.toggle('max', r >= s.maxRank);
      n.classList.toggle('can', !locked && r < s.maxRank && free() > 0);
      n.classList.toggle('sel', s.id === selected);
      n.setAttribute('aria-pressed', String(s.id === selected));
      n.setAttribute('aria-label', `${s.name}${s.capstone ? ' (Kapstein)' : ''}, Rang ${r} von ${s.maxRank}${locked ? ', Voraussetzung fehlt' : ''}`);
      [...n.querySelectorAll('.sk-pips i')].forEach((p, i) => p.classList.toggle('on', i < r));
    }
    const f = free();
    points.replaceChildren(h('span', { class: `pts${f > 0 ? ' has' : ''}` }, h('b', { text: String(f) })), h('span', { class: 'pts-lbl', text: ` Punkt${f === 1 ? '' : 'e'} frei` }));
    points.title = `${f} Skillpunkt${f === 1 ? '' : 'e'} frei`;
    respec.disabled = !Object.values(loadout).some((v) => v > 0) || busy;
    drawLines();
  };

  const drawLines = (): void => {
    for (const lines of svgs) {
      const grid = lines.parentElement;
      if (!grid || !grid.offsetParent) continue;
      const gb = grid.getBoundingClientRect();
      lines.setAttribute('viewBox', `0 0 ${gb.width} ${gb.height}`);
      lines.setAttribute('width', String(gb.width));
      lines.setAttribute('height', String(gb.height));
      let out = '';
      for (const s of SKILL_LIST) {
        const to = nodes.get(s.id);
        if (!to || !grid.contains(to)) continue;
        for (const r of s.requires) {
          const from = nodes.get(r);
          if (!from || !grid.contains(from)) continue;
          const a = from.querySelector('.sk-orb')!.getBoundingClientRect();
          const b = to.querySelector('.sk-orb')!.getBoundingClientRect();
          const x1 = a.left + a.width / 2 - gb.left;
          const y1 = from.getBoundingClientRect().bottom - gb.top;
          const x2 = b.left + b.width / 2 - gb.left;
          const y2 = b.top - gb.top;
          const my = (y1 + y2) / 2;
          const on = rank(r) > 0;
          out += `<path class="${on ? 'on' : ''}${on && rank(s.id) > 0 ? ' full' : ''}" d="M${x1} ${y1 - 1} C${x1} ${my} ${x2} ${my} ${x2} ${y2 - 2}"/>`;
        }
      }
      lines.innerHTML = out;
    }
  };

  const select = (id: string): void => {
    selected = id;
    refreshNodes();
    renderDetail();
  };

  const renderDetail = (): void => {
    const s = SKILL_LIST.find((x) => x.id === selected);
    if (!s) {
      detail.replaceChildren(...keep(
        h('div', { class: 'sk-empty' }, svg(I.tree, 'sk-empty-ico'), h('h2', { text: 'Wähle einen Skill' }), h('p', { text: 'Pro Account-Level gibt es einen Skillpunkt. Skills wirken in allen Spielarten und zählen in den Ranglisten. Respec ist kostenlos.' })),
        profile && !profile.ranked ? offlineNote('Offline: Skills gelten lokal, Läufe werden nicht gewertet.') : null,
      ));
      return;
    }
    const r = rank(s.id);
    const locked = !reqMet(s);
    const missing = s.requires.filter((q) => rank(q) === 0).map((q) => SKILL_LIST.find((x) => x.id === q)?.name ?? q);
    const deps = dependents(s.id);
    const minus = btn('', { icon: 'minus', cls: 'sk-minus', aria: `${s.name}: Rang senken`, disabled: busy || r === 0 || (r === 1 && deps.length > 0) });
    const plus = btn('', { icon: 'plus', cls: 'primary sk-plus', aria: `${s.name}: Rang erhöhen`, disabled: busy || locked || r >= s.maxRank || free() === 0 });
    minus.addEventListener('click', () => void change(s, r - 1));
    plus.addEventListener('click', () => void change(s, r + 1));
    const branchName = SKILL_BRANCHES.find((b) => b.id === s.branch)?.name ?? '';
    detail.replaceChildren(...keep(
      h(
        'div',
        { class: 'sk-dhead' },
        h('span', { class: `sk-orb big br-${s.branch}` }, atlasIcon([iconFrame(s.icon)], 40, svg(BRANCH_GLYPH[s.branch], 'sk-fallback'))),
        h('div', null, h('small', { text: `${branchName}${s.capstone ? ' · Kapstein' : ''}` }), h('h2', { text: s.name })),
        btn('', {
          icon: 'close',
          cls: 'sk-close',
          aria: 'Auswahl schließen',
          onClick: () => {
            const node = nodes.get(s.id);
            selected = null;
            refreshNodes();
            renderDetail();
            node?.focus({ preventScroll: true });
          },
        }),
      ),
      h('p', { class: 'sk-desc', text: s.description }),
      s.rankTexts.length
        ? h(
            'ol',
            { class: 'sk-effects', 'aria-label': 'Wirkung je Rang' },
            ...s.rankTexts.map((e, i) => h('li', { class: i < r ? 'on' : i === r ? 'next' : '' }, h('span', { class: 'rk', text: `Rang ${i + 1}` }), h('span', { text: e }))),
          )
        : null,
      locked ? h('p', { class: 'note lock' }, svg(I.lock), h('span', { text: `Voraussetzung: ${missing.join(' und ')}` })) : null,
      r === 1 && deps.length ? h('p', { class: 'note', text: `Wird gebraucht von: ${deps.map((d) => d.name).join(', ')}` }) : null,
      h('div', { class: 'sk-stepper' }, minus, h('div', { class: 'sk-rank', 'aria-live': 'polite' }, h('b', { text: String(r) }), h('span', { text: ` / ${s.maxRank}` })), plus),
    ));
  };

  const change = async (s: SkillInfo, to: number): Promise<void> => {
    if (busy) return;
    busy = true;
    renderDetail();
    try {
      const res = await ctx.meta.setSkill(s.id, to);
      if (res === 'ok') {
        ctx.snd(to > rank(s.id) ? 'unlock' : 'back');
        await reload();
      } else {
        ctx.snd('error');
        ctx.toast(res === 'no_points' ? 'Keine Skillpunkte frei.' : res === 'locked' ? 'Voraussetzung fehlt.' : 'Speichern fehlgeschlagen.', 'err');
      }
    } catch {
      ctx.toast('Speichern fehlgeschlagen.', 'err');
    } finally {
      busy = false;
      if (alive) {
        refreshNodes();
        renderDetail();
      }
    }
  };

  respec.addEventListener('click', () => {
    void confirmDialog('Respec', 'Alle Skillpunkte zurücksetzen? Das ist kostenlos, du kannst sie sofort neu verteilen.', 'Zurücksetzen').then(async (ok) => {
      if (!ok) return;
      const r = await ctx.meta.respec().catch(() => 'error' as const);
      if (r === 'ok') {
        ctx.toast('Alle Punkte zurückgesetzt.', 'ok', I.refresh);
        await reload();
      } else ctx.toast('Respec fehlgeschlagen.', 'err');
    });
  });

  const reload = async (): Promise<void> => {
    const [p, l] = await Promise.all([ctx.meta.profile(), ctx.meta.loadout()]);
    if (!alive) return;
    profile = p;
    loadout = { ...l };
    refreshNodes();
    renderDetail();
  };

  void Promise.all([ctx.meta.profile(), ctx.meta.loadout()])
    .then(([p, l]) => {
      if (!alive) return;
      profile = p;
      loadout = { ...l };
      build();
      body.replaceChildren(
        h('div', { class: 'sk-top' }, tabs, p.ranked ? null : offlineNote('Offline: Skills gelten lokal, Läufe werden nicht gewertet.')),
        h('div', { class: 'sk-layout' }, tree, detail),
      );
      refreshNodes();
      renderDetail();
      requestAnimationFrame(drawLines);
    })
    .catch(() => body.replaceChildren(h('p', { class: 'note err', text: 'Skilltree konnte nicht geladen werden.' })));

  const ro = new ResizeObserver(() => drawLines());
  ro.observe(tree);
  // Pfeiltasten im Baum: hoch/runter/links/rechts zum nächsten Knoten in der Richtung
  tree.addEventListener('keydown', (ev) => {
    const cur = (document.activeElement as HTMLElement | null)?.closest<HTMLElement>('.sk-node');
    if (!cur || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(ev.key)) return;
    const a = cur.getBoundingClientRect();
    let best: HTMLElement | null = null;
    let bestD = Infinity;
    for (const n of nodes.values()) {
      if (n === cur || !n.offsetParent) continue;
      const b = n.getBoundingClientRect();
      const dx = b.left + b.width / 2 - (a.left + a.width / 2);
      const dy = b.top + b.height / 2 - (a.top + a.height / 2);
      const ok = ev.key === 'ArrowRight' ? dx > 4 : ev.key === 'ArrowLeft' ? dx < -4 : ev.key === 'ArrowDown' ? dy > 4 : dy < -4;
      if (!ok) continue;
      const horiz = ev.key === 'ArrowRight' || ev.key === 'ArrowLeft';
      const d = horiz ? Math.abs(dx) + Math.abs(dy) * 3 : Math.abs(dy) + Math.abs(dx) * 3;
      if (d < bestD) {
        bestD = d;
        best = n;
      }
    }
    if (best) {
      ev.preventDefault();
      best.focus();
    }
  });

  return {
    el,
    title: 'Skilltree',
    dispose: () => {
      alive = false;
      ro.disconnect();
    },
  };
}
