// Ergebnis-Screen: Stempel, Sterne, Score/XP-Zähler, Server-Prüfung, Level-Up, Erfolge, Nochmal/Weiter/Menü/Teilen.
import type { RunSummary, RunVerdict } from '../../meta/types';
import { shareResult, shareState } from '../../view/share';
import { btn, levelBadge, xpBar } from '../components';
import type { Screen, ShellCtx } from '../context';
import { campaignInfo, levelInfo, levelLabel, mapInfo } from '../data';
import { countUp, fmt, h, reducedMotion, svg, wait } from '../dom';
import { I } from '../icons';

function headline(s: RunSummary): { kicker: string; title: string } {
  const lv = levelInfo(s.levelId);
  if (lv) return { kicker: `${campaignInfo(lv.campaign)?.name ?? ''} · ${levelLabel(lv)}`, title: lv.name };
  const map = mapInfo(s.mapId)?.name ?? s.mapId;
  if (s.daily) {
    const [, m, d] = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(new Date()).split('-');
    return { kicker: `Daily Challenge · ${d}.${m}.`, title: map };
  }
  return { kicker: s.mode === 'endless' ? 'Freies Spiel · Endlos' : 'Freies Spiel · Challenge 30', title: map };
}

export function resultsScreen(ctx: ShellCtx): Screen {
  const run = ctx.lastRun;
  const el = h('section', { class: 'sh-screen results', 'aria-labelledby': 'res-title' });
  if (!run) {
    queueMicrotask(() => ctx.router.go({ name: 'menu' }, { replace: true }));
    return { el, title: 'Ergebnis' };
  }
  const s = run.summary;
  const lv = levelInfo(s.levelId);
  const { kicker, title } = headline(s);
  let alive = true;

  const stamp = h('div', { class: `stamp ${s.won ? 'won' : 'lost'}`, 'aria-hidden': 'true' }, s.won ? (lv ? 'Level geschafft' : 'Release erfolgreich') : 'Projekt gescheitert');
  const starBox = h(
    'div',
    { class: 'res-stars', role: 'img', 'aria-label': `${s.stars} von 3 Sternen` },
    ...[0, 1, 2].map((i) => h('span', { class: `big-star s${i}`, html: I.star })),
  );
  const score = h('b', { class: 'res-score-val', text: '0' });
  const stats = h(
    'dl',
    { class: 'res-stats' },
    h('div', null, h('dt', null, svg(I.wave), 'Welle'), h('dd', { text: s.waves ? `${s.wave}/${s.waves}` : String(s.wave) })),
    h('div', null, h('dt', null, svg(I.target), 'Erledigt'), h('dd', { text: fmt(s.kills) })),
    h('div', null, h('dt', null, svg(I.heart), 'Moral'), h('dd', { text: `${Math.max(0, s.lives)} %` })),
  );

  const xpVal = h('b', { class: 'xp-val', text: '+0' });
  const xpState = h('span', { class: 'xp-state pending', text: s.ranked ? 'wird geprüft …' : 'nicht gewertet (offline)' });
  const xpBarBox = h('div', { class: 'xp-bar-box' });
  const xp = h('div', { class: 'res-xp', 'aria-live': 'polite' }, svg(I.xp, 'xp-ico'), h('div', { class: 'xp-main' }, h('div', { class: 'xp-line' }, xpVal, h('span', { text: ' XP ' }), xpState), xpBarBox));
  const rank = h('div', { class: 'res-rank', hidden: true });

  const again = btn('Nochmal', {
    icon: 'refresh',
    cls: 'res-again',
    onClick: () => {
      ctx.snd('start');
      void ctx.launch(() =>
        s.levelId ? ctx.host.startLevel(s.levelId) : s.daily ? ctx.host.startDaily() : ctx.host.startFree(s.mapId, s.mode === 'endless' ? 'endless' : 'challenge'),
      );
    },
  });
  const nextId = lv && s.won ? campaignInfo(lv.campaign)?.levels[lv.index] : undefined;
  const next = btn(nextId ? 'Weiter' : lv ? 'Zur Kampagne' : 'Ranglisten', {
    icon: 'next',
    cls: 'primary res-next',
    onClick: () => {
      ctx.snd('open');
      if (nextId) ctx.router.go({ name: 'briefing', id: nextId });
      else if (lv) ctx.router.go({ name: 'campaign', id: lv.campaign });
      else ctx.router.go({ name: 'ranks', id: s.daily ? 'daily' : 'map', sub: s.daily ? undefined : s.mapId });
    },
  });
  const menu = btn('Menü', { icon: 'menu', cls: 'res-menu', onClick: () => ctx.router.go({ name: 'menu' }) });
  const share = btn('Teilen', { icon: 'share', cls: 'res-share', onClick: () => void doShare() });

  const doShare = async (): Promise<void> => {
    const lbl = share.querySelector('.lbl')!;
    const [, m, d] = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(new Date()).split('-');
    const res = await shareResult(
      {
        daily: s.daily ? `${d}.${m}.` : null,
        level: lv ? `${levelLabel(lv)} ${lv.name}` : null,
        stars: lv ? s.stars : null,
        wave: s.wave,
        waves: s.waves,
        lives: s.lives,
        score: s.score,
        rank: run.resolved?.rank ?? null,
        team: shareState.team,
        map: mapInfo(s.mapId)?.name ?? s.mapId,
        won: s.won,
      },
      (await ctx.opts.snapshot?.().catch(() => null)) ?? null,
    );
    lbl.textContent = res.method === 'share' ? 'Geteilt!' : 'Text kopiert';
    setTimeout(() => (lbl.textContent = 'Teilen'), 2500);
  };

  const sheet = h(
    'div',
    { class: `res-sheet card ${s.won ? 'won' : 'lost'}` },
    h('div', { class: 'res-tape', 'aria-hidden': 'true' }),
    h('div', { class: 'res-kicker', text: kicker }),
    h('h1', { id: 'res-title', class: 'res-title', tabindex: '-1' }, h('span', { class: 'sr-only', text: s.won ? 'Gewonnen: ' : 'Verloren: ' }), title),
    stamp,
    lv ? starBox : null,
    h('div', { class: 'res-score' }, h('small', { text: 'Score' }), score),
    stats,
    xp,
    rank,
    h('div', { class: 'res-actions' }, again, next, menu, share),
  );
  el.append(h('div', { class: 'confetti', 'aria-hidden': 'true' }), sheet);

  // Ablauf: Stempel → Sterne → Score → XP (Vorschau) → Server-Urteil
  const play = async (): Promise<void> => {
    const before = await ctx.meta.profile().catch(() => null);
    if (before && alive) xpBarBox.replaceChildren(levelBadge(before.level, 'lvl-badge sm'), xpBar(before));
    await wait(350);
    el.classList.add('stamped');
    for (let i = 0; i < 3 && lv; i++) {
      await wait(260);
      if (!alive) return;
      if (i < s.stars) {
        starBox.children[i]!.classList.add('on');
        ctx.snd('star');
      }
    }
    if (s.won && s.stars === 3 && !reducedMotion()) el.classList.add('party');
    await countUp(score, s.score, 900);
    if (!alive) return;
    ctx.snd('xp');
    await countUp(xpVal, s.xpPreview, 700, (n) => `+${fmt(n)}`);
    const v = await run.verdict.catch((): RunVerdict => ({ status: 'offline', xpGained: 0, rank: null, levelUp: null, newAchievements: [] }));
    run.resolved = v;
    if (!alive) return;
    await applyVerdict(v);
  };

  const applyVerdict = async (v: RunVerdict): Promise<void> => {
    xpState.classList.remove('pending');
    if (v.status === 'verified') {
      xpState.className = 'xp-state ok';
      xpState.replaceChildren(svg(I.check), 'geprüft und gutgeschrieben');
      if (v.xpGained !== s.xpPreview) await countUp(xpVal, v.xpGained, 500, (n) => `+${fmt(n)}`, s.xpPreview);
    } else if (v.status === 'rejected') {
      xpState.className = 'xp-state err';
      xpState.textContent = 'nicht anerkannt';
      xpVal.classList.add('struck');
    } else {
      xpState.className = 'xp-state off';
      xpState.textContent = 'nicht gewertet (offline)';
    }
    const after = await ctx.meta.profile().catch(() => null);
    if (after && alive) xpBarBox.replaceChildren(levelBadge(after.level, 'lvl-badge sm'), xpBar(after));
    if (v.rank) {
      rank.hidden = false;
      rank.replaceChildren(svg(I.podium), h('span', { text: 'Rang ' }), h('b', { text: `#${v.rank}` }), h('span', { class: 'muted', text: lv ? ' in diesem Level' : s.daily ? ' in der Daily' : ' auf dieser Karte' }));
      shareState.rank = v.rank;
    }
    if (v.levelUp) showLevelUp(v.levelUp.from, v.levelUp.to);
    if (v.newAchievements.length) {
      const all = await ctx.meta.achievements().catch(() => []);
      for (const [i, id] of v.newAchievements.entries()) {
        const a = all.find((x) => x.id === id);
        setTimeout(() => {
          ctx.snd('achievement');
          ctx.toast(`Erfolg freigeschaltet: ${a?.name ?? id}`, 'achievement', I.medal);
        }, 600 + i * 900);
      }
    }
  };

  const showLevelUp = (from: number, to: number): void => {
    ctx.snd('levelup');
    const close = btn('Super!', { cls: 'primary', onClick: () => lu.remove() });
    const lu = h(
      'div',
      { class: 'levelup', role: 'dialog', 'aria-modal': 'false', 'aria-label': `Level-Up auf ${to}` },
      h('div', { class: 'lu-rays', 'aria-hidden': 'true' }),
      h(
        'div',
        { class: 'lu-card' },
        h('div', { class: 'lu-kicker', text: 'Level-Up!' }),
        h('div', { class: 'lu-levels' }, levelBadge(from, 'lvl-badge old'), svg(I.next, 'lu-arrow'), levelBadge(to, 'lvl-badge big')),
        h('p', { text: `+${to - from} Skillpunkt${to - from === 1 ? '' : 'e'} – ab in den Skilltree!` }),
        h('div', { class: 'row' }, btn('Skilltree', { icon: 'tree', onClick: () => ctx.router.go({ name: 'skills' }) }), close),
      ),
    );
    sheet.append(lu);
    close.focus();
  };

  void play();
  return {
    el,
    title: s.won ? 'Gewonnen' : 'Verloren',
    focus: (nextId ? next : again) as HTMLElement,
    dispose: () => {
      alive = false;
    },
  };
}
