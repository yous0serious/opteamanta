import { CHALLENGE_WAVES, TOWERS, TOWER_ORDER, type GameMode, type TowerType } from '../sim/index';
import type { SoundEngine } from './audio';
import type { Controller } from './controller';
import { JOKES, TOWER_BLURBS, piLabel } from './texts';

const $ = <T extends HTMLElement = HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} fehlt im HTML`);
  return el as T;
};

const DEFAULT_INFO =
  'Wähle einen Turm (1–5) und klick auf das Spielfeld.<br>Klick auf einen Turm zum Auswählen.<br>[U] Upgrade · [S] Verkaufen<br>[Leertaste] nächster Sprint';

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
    const anchor = $('info');
    TOWER_ORDER.forEach((type, i) => {
      const def = TOWERS[type];
      const b = document.createElement('button');
      b.className = 'tw';
      b.dataset.t = type;
      b.innerHTML = `<b>[${i + 1}] ${def.emoji} ${def.name} – ${def.cost}</b><small>${TOWER_BLURBS[type]}</small>`;
      anchor.before(b);
    });
  }

  render(): void {
    const { game, selected, selectedTowerId, speed } = this.ctl;
    const s = game.state;
    $('money').textContent = String(s.money);
    $('lives').textContent = String(Math.max(0, s.lives));
    const challenge = s.mode === 'challenge';
    $('wave').textContent = challenge && s.wave > 0 ? `${piLabel(s.wave)} · Welle ${s.wave}/${CHALLENGE_WAVES}` : piLabel(s.wave);
    for (const b of document.querySelectorAll<HTMLButtonElement>('#mode button')) {
      b.classList.toggle('active', b.dataset.mode === s.mode);
      b.disabled = s.wave > 0 && !s.over;
    }
    $('score').textContent = String(s.score);
    $('map').textContent = game.map.name;
    for (const b of this.buttons) {
      const t = b.dataset.t as TowerType;
      b.classList.toggle('sel', t === selected);
      b.disabled = s.money < TOWERS[t].cost;
    }
    $('spd').textContent = `⏩ x${speed}`;
    $('mute').textContent = this.sound.muted ? '🔇 Stumm' : '🔊 Sound';
    $('big').textContent = s.won
      ? '↻ NEUES PROGRAMM'
      : s.over
        ? '↻ PROJEKT NEU AUFSETZEN'
        : s.running
          ? `⏳ ${piLabel(s.wave)} läuft…`
          : `▶ ${piLabel(s.wave + 1)} STARTEN`;
    $('replay').hidden = !s.over;

    let info = DEFAULT_INFO;
    const tower = selectedTowerId !== null ? game.towerById(selectedTowerId) : undefined;
    if (tower) {
      const def = TOWERS[tower.type];
      const st = game.towerStats(tower);
      const up = game.upgradeCost(tower);
      const push = tower.type === 'scrum' ? `<br>Rückstoß: ${Math.floor(def.push! * (1 + 0.2 * (tower.level - 1)))}` : '';
      info =
        `<b>${def.emoji} ${def.name}</b> – Stufe ${tower.level}/5<br>Reichweite: ${Math.floor(st.range)}<br>` +
        `${st.dps ? `DPS: ${Math.floor(st.dps)}` : `Schaden: ${Math.floor(st.dmg)}`}${push}${st.boosted ? '<br>🧭 PPL-Boost aktiv (+25%)' : ''}<br><br>` +
        `<button data-action="upgrade">⬆ Upgrade (${up ?? 'max'}) [U]</button> ` +
        `<button data-action="sell">👋 Abgeben (+${game.sellValue(tower)}) [S]</button>`;
    } else if (selected) {
      const def = TOWERS[selected];
      info = `<b>${def.emoji} ${def.name}</b><br>Kosten: ${def.cost}<br>Klick aufs Feld zum Platzieren.<br>Rechtsklick/ESC: abbrechen`;
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
