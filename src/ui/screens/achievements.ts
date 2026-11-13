// Erfolge: Raster mit Fortschritt (Spec campaigns „Erfolge“).
import { atlasIcon } from '../atlas';
import { screenFrame, skeleton } from '../components';
import type { Screen, ShellCtx } from '../context';
import { iconFrame } from '../data';
import { fmt, h, svg } from '../dom';
import { I } from '../icons';

export function achievementsScreen(ctx: ShellCtx): Screen {
  const counter = h('div', { class: 'ach-count' });
  const { el, body } = screenFrame(ctx, { title: 'Erfolge', kicker: 'Abzeichen fürs Lebenslauf-PDF', cls: 'achievements', actions: [counter] });
  body.append(skeleton(6));
  let alive = true;
  void ctx.meta
    .achievements()
    .then((list) => {
      if (!alive) return;
      const got = list.filter((a) => a.unlocked).length;
      counter.replaceChildren(svg(I.medal), h('b', { text: String(got) }), h('span', { text: ` / ${list.length}` }));
      const sorted = [...list].sort((a, b) => Number(b.unlocked) - Number(a.unlocked));
      body.replaceChildren(
        h('div', { class: 'ach-summary card' }, h('div', { class: 'meter big', role: 'progressbar', 'aria-label': 'Erfolge freigeschaltet', 'aria-valuemin': '0', 'aria-valuemax': String(list.length), 'aria-valuenow': String(got) }, h('span', { style: { width: `${(got / Math.max(1, list.length)) * 100}%` } })), h('span', { text: `${got} von ${list.length} freigeschaltet` })),
        h(
          'ul',
          { class: 'ach-grid' },
          ...sorted.map((a) => {
            const [done, of] = a.progress ?? [a.unlocked ? 1 : 0, 1];
            const pct = Math.min(100, (done / Math.max(1, of)) * 100);
            return h(
              'li',
              { class: `ach card${a.unlocked ? ' on' : ''}`, tabindex: '0', 'aria-label': `${a.name}: ${a.description} – ${a.unlocked ? 'freigeschaltet' : `${fmt(done)} von ${fmt(of)}`}` },
              h('span', { class: 'ach-medal' }, atlasIcon([iconFrame(a.icon), `icon/ach-${a.id}`], 40, svg(a.unlocked ? I.trophy : I.medal, 'ach-fallback'))),
              h('div', { class: 'ach-txt' }, h('b', { text: a.name }), h('small', { text: a.description })),
              a.unlocked
                ? h('span', { class: 'ach-done' }, svg(I.check))
                : of > 1
                  ? h('div', { class: 'ach-prog' }, h('div', { class: 'meter' }, h('span', { style: { width: `${pct}%` } })), h('small', { text: `${fmt(done)}/${fmt(of)}` }))
                  : h('span', { class: 'ach-lock' }, svg(I.lock)),
            );
          }),
        ),
      );
    })
    .catch(() => body.replaceChildren(h('p', { class: 'note err', text: 'Erfolge konnten nicht geladen werden.' })));
  return {
    el,
    title: 'Erfolge',
    dispose: () => {
      alive = false;
    },
  };
}
