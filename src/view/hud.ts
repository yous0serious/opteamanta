import { CHALLENGE_WAVES, TOWERS, TOWER_ORDER, type GameMode, type TowerType } from '../sim/index';
import type { SoundEngine } from './audio';
import type { Controller } from './controller';
import { setFxLevel, type FxLevel, type FxSettings } from './fx';
import { shareResult, shareState } from './share';
import { applySprite } from './sprite';
import { JOKES, TOWER_BLURBS, piLabel } from './texts';
import { onPointerModeChange, pointerMode } from './touch';

const $ = <T extends HTMLElement = HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} fehlt im HTML`);
  return el as T;
};

/** Erklärung der Effektstufen im Einstellungen-Popup (Spec season-2 AC-9). */
const FX_HINT: Record<FxLevel, string> = {
  max: 'Alles an: Combos, Zeitlupe, Kamerafahrten beim Boss, Wackeln und Partikel.',
  normal: 'Wie Maximal, aber ohne Zeitlupe und Kamerazoom.',
  calm: 'Ohne Wackeln, Combos und Lauf-/Atemanimationen, halbe Partikel.',
};

const DEFAULT_INFO =
  'Rolle wählen (1–9), freien Platz anklicken.<br><span class="muted">Arbeitsplatz: [U] Upgrade · [S] Abgeben</span>';
const DEFAULT_INFO_TOUCH =
  'Rolle antippen, dann Feld antippen und <b>nochmal tippen</b> zum Einsetzen.<br><span class="muted">Arbeitsplatz antippen: Upgrade oder Abgeben</span>';

/** Kurznamen für die Turmkarten (einzeilig; voller Name im Tooltip und in der Infobox). */
const CARD_NAME: Partial<Record<TowerType, string>> = { analyst: 'Analyst' };

/** Wirkung der Unterstützungsrollen je Stufe für die Infobox (Werte wie in Spec season-2). */
function supportInfo(type: TowerType, level: number): string {
  const l = level - 1;
  switch (type) {
    case 'rte':
      return `PI-Sync alle 10 s · ${(4 + 0.5 * l).toFixed(1).replace('.', ',')} s lang +30 % · Reichweite ${Math.floor(TOWERS.rte.range * (1 + 0.1 * l))}`;
    case 'rta':
      return `Runway: +${Math.round((0.25 + 0.05 * l) * 100)} % Schaden (Tech Debt doppelt) · Reichweite ${Math.floor(TOWERS.rta.range * (1 + 0.1 * l))}`;
    case 'rto':
      return `Business Value: +${15 + 10 * l} SP je Sprint-Ende`;
    case 'board':
      return `Fähigkeit alle ${20 - l} s: Budget-Freeze bzw. Projekt eingestampft`;
    default:
      return '';
  }
}

/** DOM-Seitenleiste (Original Zeilen 45–60, ui() Zeilen 204–214). */
export class Hud {
  private readonly buttons: HTMLButtonElement[];
  private lastInfo = '';
  private dirty = true;
  private sinceRender = 0;

  constructor(
    private readonly ctl: Controller,
    private readonly sound: SoundEngine,
    private readonly fx: FxSettings,
    /** Bild des Spielfelds für die Teilen-Karte (Phaser-Snapshot). */
    private readonly snapshot: () => Promise<CanvasImageSource | null> = async () => null,
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
    $('share').addEventListener('click', () => void this.share());
    // Einstellungen-Popup (Spec season-2 AC-9/AC-10)
    const dialog = $<HTMLDialogElement>('settings-dialog');
    $('open-settings').addEventListener('click', () => {
      this.sound.start();
      this.markDirty();
      this.render();
      dialog.showModal();
    });
    $('mute-check').addEventListener('change', () => {
      if ($<HTMLInputElement>('mute-check').checked !== this.sound.muted) this.sound.toggleMute();
      this.markDirty();
    });
    for (const b of document.querySelectorAll<HTMLButtonElement>('#speed-set button')) {
      b.addEventListener('click', () => this.ctl.setSpeed(Number(b.dataset.speed)));
    }
    // Einstellungen: Effektstufe und Lautstärken (Spec season-2 AC-9/AC-10)
    for (const b of document.querySelectorAll<HTMLButtonElement>('#fx-level button')) {
      b.addEventListener('click', () => {
        setFxLevel(this.fx, b.dataset.fx as FxLevel);
        this.markDirty();
      });
    }
    const music = $<HTMLInputElement>('vol-music');
    const sfx = $<HTMLInputElement>('vol-sfx');
    music.value = String(Math.round(this.sound.settings.music * 100));
    sfx.value = String(Math.round(this.sound.settings.sfx * 100));
    music.addEventListener('input', () => {
      this.sound.start();
      this.sound.setMusicVolume(Number(music.value) / 100);
    });
    sfx.addEventListener('input', () => {
      this.sound.start();
      this.sound.setSfxVolume(Number(sfx.value) / 100);
      this.sound.play('coin', 0.6);
    });
    for (const b of document.querySelectorAll<HTMLButtonElement>('#mode button')) {
      b.addEventListener('click', () => this.ctl.setMode(b.dataset.mode as GameMode));
    }
    $('info').addEventListener('click', (ev) => {
      const action = (ev.target as HTMLElement).closest<HTMLElement>('[data-action]')?.dataset.action;
      if (action === 'upgrade') this.ctl.upgradeSelected();
      if (action === 'sell') this.ctl.sellSelected();
      if (action === 'place') this.ctl.placePreview();
      if (action === 'cancel' || action === 'close') this.ctl.clearSelection();
    });
    onPointerModeChange(() => this.markDirty());
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
      b.title = `${TOWERS[type].name}: ${TOWER_BLURBS[type]}`;
      b.innerHTML = `<span class="pt"><span class="spr"></span></span><span class="nm">${CARD_NAME[def.id] ?? def.name}</span><span class="ct"><i class="ico ico-coin"></i>${def.cost}</span><span class="key">${i + 1}</span>${def.limit ? `<span class="lim">max. ${def.limit}</span>` : ''}`;
      applySprite(b.querySelector<HTMLElement>('.spr')!, `head/${type}`, 32);
      box.append(b);
    });
  }

  render(): void {
    const { game, selected, selectedTowerId, speed } = this.ctl;
    const s = game.state;
    const touch = pointerMode.touch;
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
      const limit = TOWERS[t].limit;
      const full = limit !== undefined && s.towers.filter((x) => x.type === t).length >= limit;
      b.classList.toggle('full', full);
      b.disabled = s.money < TOWERS[t].cost || full;
    }
    $('spd').textContent = `x${speed}`;
    $('mute').textContent = this.sound.muted ? 'Stumm' : 'Ton';
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
    $('share').hidden = !s.over;
    for (const b of document.querySelectorAll<HTMLButtonElement>('#fx-level button')) b.classList.toggle('active', b.dataset.fx === this.fx.level);
    for (const b of document.querySelectorAll<HTMLButtonElement>('#speed-set button')) b.classList.toggle('active', Number(b.dataset.speed) === speed);
    $<HTMLInputElement>('mute-check').checked = this.sound.muted;
    $('fx-hint').textContent = FX_HINT[this.fx.level];

    let info = touch ? DEFAULT_INFO_TOUCH : DEFAULT_INFO;
    const tower = selectedTowerId !== null ? game.towerById(selectedTowerId) : undefined;
    if (tower) {
      const def = TOWERS[tower.type];
      const st = game.towerStats(tower);
      const up = game.upgradeCost(tower);
      const stats = def.support
        ? supportInfo(tower.type, tower.level)
        : `Reichweite ${Math.floor(st.range)} · ${st.dps ? `DPS ${Math.floor(st.dps)}` : `Schaden ${Math.floor(st.dmg)}`}`;
      const push = tower.type === 'scrum' ? ` · Rückstoß ${Math.floor(def.push! * (1 + 0.2 * (tower.level - 1)))}` : '';
      const canUp = up !== null && s.money >= up;
      info =
        `<b>${def.name}</b> <span class="muted">Stufe ${tower.level}/5</span><br>${stats}${push}${st.boosted ? '<br><span class="muted">PPL-Boost aktiv (+25 %)</span>' : ''}<br>` +
        `<span class="acts"><button data-action="upgrade"${touch && !canUp ? ' disabled' : ''}>Upgrade (${up ?? 'max'})${touch ? '' : ' [U]'}</button>` +
        `<button data-action="sell">Abgeben (+${game.sellValue(tower)})${touch ? '' : ' [S]'}</button>` +
        `${touch ? '<button data-action="close" class="x" aria-label="Auswahl schließen">OK</button>' : ''}</span>`;
    } else if (selected) {
      const def = TOWERS[selected];
      if (touch) {
        const p = this.ctl.preview;
        const reason = p ? game.canPlace(selected, p.cx, p.cy) : null;
        const hint = !p ? 'Feld antippen für Vorschau' : reason === null ? 'Nochmal aufs Feld tippen oder:' : reason === 'noMoney' ? 'Zu wenig Kapazität' : 'Hier ist kein Platz frei';
        info =
          `<b>${def.name}</b> <span class="muted">Kosten ${def.cost}</span><br>${p ? '' : `${TOWER_BLURBS[selected]}<br>`}<span class="muted">${hint}</span><br>` +
          `<span class="acts"><button data-action="place" class="go"${p && reason === null ? '' : ' disabled'}>Hier einsetzen</button>` +
          `<button data-action="cancel">Abbrechen</button></span>`;
      } else {
        info = `<b>${def.name}</b> <span class="muted">Kosten ${def.cost}</span><br>${TOWER_BLURBS[selected]}<br><span class="muted">Klick aufs Feld · Rechtsklick/Esc: abbrechen</span>`;
      }
    } else if (touch && this.ctl.preview) {
      info = '<b>Platz vorgemerkt</b><br>Jetzt eine Rolle antippen – Reichweite erscheint, dann einsetzen.<br><span class="acts"><button data-action="cancel">Abbrechen</button></span>';
    }
    if (info !== this.lastInfo) {
      this.lastInfo = info;
      $('info').innerHTML = info;
    }
  }

  /** Ergebnis teilen (Spec season-2 AC-11). */
  private async share(): Promise<void> {
    const { game, daily } = this.ctl;
    const s = game.state;
    const [, m, d] = daily?.dailyDate.split('-') ?? [];
    const res = await shareResult(
      {
        daily: daily ? `${d}.${m}.` : null,
        wave: s.wave,
        waves: s.mode === 'challenge' ? CHALLENGE_WAVES : null,
        lives: s.lives,
        score: s.score,
        rank: daily ? shareState.rank : null,
        team: shareState.team,
        map: game.map.name,
        won: s.won,
      },
      await this.snapshot(),
    );
    const btn = $('share');
    btn.textContent = res.method === 'share' ? 'Geteilt!' : 'Text kopiert, Bild gespeichert';
    setTimeout(() => (btn.textContent = 'Teilen'), 2500);
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
