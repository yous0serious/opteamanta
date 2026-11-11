import { CHALLENGE_WAVES, TOWERS, TOWER_ORDER, type GameMode, type TowerType } from '../sim/index';
import type { SoundEngine } from './audio';
import type { Controller } from './controller';
import { applySprite } from './sprite';
import { JOKES, TOWER_BLURBS, piLabel } from './texts';

const $ = <T extends HTMLElement = HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} fehlt im HTML`);
  return el as T;
};

const DEFAULT_INFO =
  'Wähle ein Teammitglied (1–5) und klick auf einen freien Platz.<br><span class="muted">Klick auf einen Arbeitsplatz: Details · [U] Upgrade · [S] Abgeben · [Leertaste] nächster Sprint</span>';

/** DOM-Seitenleiste (Original Zeilen 45–60, ui() Zeilen 204–214). */
export class Hud {
  private readonly buttons: HTMLButtonElement[];
  private lastInfo = '';
  private dirty = true;
  private sinceRender = 0;

  constructor(
    private readonly ctl: Controller,
    private readonly sound: SoundEngine,
  ) {
    this.buildTowerButtons();
    this.buttons = [...document.querySelectorAll<HTMLButtonElement>('.tw')];
    $('tk').textContent = JOKES.join('     ');

    for (const b of this.buttons) {
      b.addEventListener('click', () => {
        this.sound.start();
        this.ctl.selectType(b.dataset.t as TowerType);
      });
    }
    $('big').addEventListener('click', () => {
      this.sound.start();
      this.ctl.startOrRestart();
    });
    $('spd').addEventListener('click', () => this.ctl.cycleSpeed());
    $('mute').addEventListener('click', () => {
      this.sound.toggleMute();
      this.markDirty();
    });
    $('replay').addEventListener('click', () => this.downloadReplay());
    for (const b of document.querySelectorAll<HTMLButtonElement>('#mode button')) {
      b.addEventListener('click', () => this.ctl.setMode(b.dataset.mode as GameMode));
    }
    $('info').addEventListener('click', (ev) => {
      const action = (ev.target as HTMLElement).closest<HTMLElement>('[data-action]')?.dataset.action;
      if (action === 'upgrade') this.ctl.upgradeSelected();
      if (action === 'sell') this.ctl.sellSelected();
    });
    // Buttons sollen die Leertaste nicht „klicken“ (sonst doppelte Aktion).
    for (const b of document.querySelectorAll('button')) b.addEventListener('keydown', (ev) => ev.key === ' ' && ev.preventDefault());

    this.ctl.onChange(() => this.markDirty());
  }

  markDirty(): void {
    this.dirty = true;
  }

  /** Pro Frame aufrufen: rendert bei Änderungen, sonst spätestens alle 0,2 s. */
  tick(dt: number): void {
    this.sinceRender += dt;
    if (!this.dirty && this.sinceRender < 0.2) return;
    this.dirty = false;
    this.sinceRender = 0;
    this.render();
  }

  private buildTowerButtons(): void {
    const box = $('towers');
    TOWER_ORDER.forEach((type, i) => {
      const def = TOWERS[type];
      const b = document.createElement('button');
      b.className = 'tw';
      b.dataset.t = type;
      b.title = TOWER_BLURBS[type];
      b.innerHTML = `<span class="pt"><span class="spr"></span></span><span class="nm">${def.name}</span><span class="ct"><i class="ico ico-coin"></i>${def.cost}</span><span class="key">${i + 1}</span>`;
      applySprite(b.querySelector<HTMLElement>('.spr')!, `head/${type}`, 32);
      box.append(b);
    });
  }

  render(): void {
    const { game, selected, selectedTowerId, speed } = this.ctl;
    const s = game.state;
    $('money').textContent = String(s.money);
    const lives = Math.max(0, s.lives);
    $('lives').textContent = String(lives);
    $('lives-bar').style.width = `${Math.min(100, lives)}%`;
    const challenge = s.mode === 'challenge';
    $('wave').textContent = challenge && s.wave > 0 ? `${piLabel(s.wave)} · Welle ${s.wave}/${CHALLENGE_WAVES}` : piLabel(s.wave);
    for (const b of document.querySelectorAll<HTMLButtonElement>('#mode button')) {
      b.classList.toggle('active', b.dataset.mode === s.mode);
      b.disabled = (s.wave > 0 && !s.over) || this.ctl.daily !== null;
    }
    $('score').textContent = String(s.score);
    $('map').textContent = this.ctl.daily ? `${game.map.name} · Daily` : game.map.name;
    for (const b of this.buttons) {
      const t = b.dataset.t as TowerType;
      b.classList.toggle('sel', t === selected);
      b.disabled = s.money < TOWERS[t].cost;
    }
    $('spd').textContent = `Tempo x${speed}`;
    $('mute').textContent = this.sound.muted ? 'Ton aus' : 'Ton an';
    const big = $('big');
    big.textContent = s.won
      ? 'NEUES PROGRAMM'
      : s.over
        ? 'PROJEKT NEU AUFSETZEN'
        : s.running
          ? `${piLabel(s.wave)} läuft…`
          : `${piLabel(s.wave + 1)} STARTEN`;
    big.classList.toggle('running', s.running && !s.over);
    big.classList.toggle('over', s.over && !s.won);
    big.classList.toggle('won', s.won);
    $('replay').hidden = !s.over;

    let info = DEFAULT_INFO;
    const tower = selectedTowerId !== null ? game.towerById(selectedTowerId) : undefined;
    if (tower) {
      const def = TOWERS[tower.type];
      const st = game.towerStats(tower);
      const up = game.upgradeCost(tower);
      const push = tower.type === 'scrum' ? ` · Rückstoß ${Math.floor(def.push! * (1 + 0.2 * (tower.level - 1)))}` : '';
      info =
        `<b>${def.name}</b> <span class="muted">Stufe ${tower.level}/5</span><br>Reichweite ${Math.floor(st.range)} · ` +
        `${st.dps ? `DPS ${Math.floor(st.dps)}` : `Schaden ${Math.floor(st.dmg)}`}${push}${st.boosted ? '<br><span class="muted">PPL-Boost aktiv (+25 %)</span>' : ''}<br>` +
        `<button data-action="upgrade">Upgrade (${up ?? 'max'}) [U]</button>` +
        `<button data-action="sell">Abgeben (+${game.sellValue(tower)}) [S]</button>`;
    } else if (selected) {
      const def = TOWERS[selected];
      info = `<b>${def.name}</b> <span class="muted">Kosten ${def.cost}</span><br>${TOWER_BLURBS[selected]}<br><span class="muted">Klick aufs Feld · Rechtsklick/Esc: abbrechen</span>`;
    }
    if (info !== this.lastInfo) {
      this.lastInfo = info;
      $('info').innerHTML = info;
    }
  }

  private downloadReplay(): void {
    const replay = this.ctl.lastReplay();
    const blob = new Blob([JSON.stringify(replay, null, 1)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `backlog-defense-replay-${replay.seed}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
}
