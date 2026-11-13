// Freies Spiel: Kartenwahl (alle Karten) + Modus Challenge 30 / Endlos.
import { btn, mapMini, screenFrame, segmented } from '../components';
import type { Screen, ShellCtx } from '../context';
import { freeMaps, themeName } from '../data';
import { h } from '../dom';

const MODE_KEY = 'bd.freeMode';

export function freeScreen(ctx: ShellCtx): Screen {
  const maps = freeMaps();
  let mode: 'challenge' | 'endless' = 'challenge';
  try {
    if (localStorage.getItem(MODE_KEY) === 'endless') mode = 'endless';
  } catch {
    // Speicher gesperrt
  }
  const { el, body } = screenFrame(ctx, { title: 'Freies Spiel', kicker: 'Zählt in der Karten-Rangliste (Challenge 30)', cls: 'free' });
  const hint = h('p', { class: 'fr-hint' });
  const setHint = (): void => {
    hint.textContent = mode === 'challenge' ? '30 Wellen, dann „Release erfolgreich“ mit Moral-Bonus. Bestwert je Karte kommt in die Rangliste.' : 'Bis zum Burnout – wie weit kommt dein Team? Nur zum Spaß, ohne Rangliste.';
  };
  setHint();
  const modes = segmented(
    [
      ['challenge', 'Challenge 30'],
      ['endless', 'Endlos'],
    ] as const,
    mode,
    (m) => {
      mode = m;
      setHint();
      try {
        localStorage.setItem(MODE_KEY, m);
      } catch {
        // nur für diese Sitzung
      }
    },
    'Spielmodus',
    'sh-seg fr-modes',
  );
  const grid = h('ul', { class: 'fr-grid' });
  for (const m of maps) {
    const card = h(
      'button',
      { type: 'button', class: 'fr-map card', data: { map: m.id }, 'aria-label': `${m.name} spielen` },
      mapMini(m, m.theme),
      h('span', { class: 'fr-name' }, h('b', { text: m.name }), h('small', { text: themeName(m.theme) })),
    );
    card.addEventListener('click', () => {
      ctx.snd('start');
      void ctx.launch(() => ctx.host.startFree(m.id, mode));
    });
    grid.append(h('li', null, card));
  }
  const random = btn('Zufällige Karte', {
    icon: 'dice',
    cls: 'fr-random',
    onClick: () => {
      const m = maps[Math.floor(Math.random() * maps.length)];
      if (m) void ctx.launch(() => ctx.host.startFree(m.id, mode));
    },
  });
  body.append(h('div', { class: 'fr-top card' }, modes, hint, random), grid);
  return { el, title: 'Freies Spiel' };
}
