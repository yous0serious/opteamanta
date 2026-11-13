import { CHALLENGE_WAVES, TOWERS, TOWER_ORDER, type Branch, type GameMode, type TargetMode, type TowerType } from '../sim/index';
import { enemyIcon, upgradeIcons } from '../ui/atlas';
import { branchesFor, enemyInfo, levelInfo, levelLabel, TARGET_MODE_HINTS, TARGET_MODE_NAMES, TARGET_MODES, type LevelInfo } from '../ui/data';
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

const esc = (t: string): string => t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** Erklärung der Effektstufen im Einstellungen-Popup (Spec season-2 AC-9). */
const FX_HINT: Record<FxLevel, string> = {
  max: 'Alles an: Combos, Zeitlupe, Kamerafahrten beim Boss, Wackeln und Partikel.',
  normal: 'Wie Maximal, aber ohne Zeitlupe und Kamerazoom.',
  calm: 'Ohne Wackeln, Combos und Lauf-/Atemanimationen, halbe Partikel.',
};

const DEFAULT_INFO =
  'Rolle wählen (1–9), freien Platz anklicken.<br><span class="muted">[U] Upgrade · [S] Abgeben · [P] Pause</span>';
const DEFAULT_INFO_TOUCH =
  'Rolle antippen, dann Feld antippen und <b>nochmal tippen</b> zum Einsetzen.<br><span class="muted">Arbeitsplatz antippen: Upgrade oder Abgeben</span>';

/** Ersatz-Icons der Zielmodi (Atlas `icon/target-<mode>` ersetzt sie, sobald vorhanden). */
const TARGET_SVG: Record<TargetMode, string> = {
  first: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12h11M11 7l5 5-5 5"/><path d="M20 5v14"/></svg>',
  last: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12H9M13 7l-5 5 5 5"/><path d="M4 5v14"/></svg>',
  strong: '<svg viewBox="0 0 24 24"><path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4 6.7 19.4l1.2-6L3.4 9.3l6-.7z" fill="currentColor"/></svg>',
  near: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3" fill="currentColor"/></svg>',
};

/** Level des laufenden Spiels (Kampagne), sonst undefined. */
export function currentLevel(ctl: Controller): LevelInfo | undefined {
  return levelInfo(ctl.game.state.levelId);
}

/** Wartet der ausgewählte Arbeitsplatz auf die Zweigwahl (Stufe 2 → 3)? */
export function branchPending(ctl: Controller): boolean {
  const t = ctl.selectedTowerId !== null ? ctl.game.towerById(ctl.selectedTowerId) : undefined;
  return !!t && t.level === 2 && !t.branch && branchesFor(t.type).length === 2;
}

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
      const el = (ev.target as HTMLElement).closest<HTMLElement>('[data-action]');
      const action = el?.dataset.action;
      if (action === 'upgrade') this.ctl.upgradeSelected();
      if (action === 'sell') this.ctl.sellSelected();
      if (action === 'place') this.ctl.placePreview();
      if (action === 'cancel' || action === 'close') this.ctl.clearSelection();
      const towerId = this.ctl.selectedTowerId;
      if (towerId === null) return;
      if (action === 'target') this.ctl.command({ type: 'target', towerId, mode: el!.dataset.mode as TargetMode });
      if (action === 'branch') this.ctl.command({ type: 'upgrade', towerId, branch: el!.dataset.branch as Branch });
    });
    // Pause (Spec campaigns AC-8): Knopf in der Kopfzeile, Taste P, Overlay über dem Spielfeld
    $('pause').addEventListener('click', () => {
      this.sound.start();
      this.ctl.togglePause();
    });
    $('po-resume').addEventListener('click', () => this.ctl.togglePause(false));
    $('po-menu').addEventListener('click', () => document.getElementById('to-menu')?.click());
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
      b.dataset.title = b.title;
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
    const level = currentLevel(this.ctl);
    const total = level ? level.waves : s.mode === 'challenge' ? CHALLENGE_WAVES : null;
    $('wave').textContent = total && s.wave > 0 ? `${piLabel(s.wave)} · Welle ${s.wave}/${total}` : piLabel(s.wave);
    for (const b of document.querySelectorAll<HTMLButtonElement>('#mode button')) {
      b.classList.toggle('active', b.dataset.mode === s.mode);
      b.disabled = (s.wave > 0 && !s.over) || this.ctl.daily !== null || !!level;
    }
    $('score').textContent = String(s.score);
    const mapLabel = level ? `${levelLabel(level)} · ${level.name}` : this.ctl.daily ? `${game.map.name} · Daily` : game.map.name;
    $('map').textContent = mapLabel;
    $('map').title = mapLabel;
    for (const b of this.buttons) {
      const t = b.dataset.t as TowerType;
      b.classList.toggle('sel', t === selected);
      const limit = TOWERS[t].limit;
      const full = limit !== undefined && s.towers.filter((x) => x.type === t).length >= limit;
      // Rollen, die das Level (noch) nicht erlaubt, sind gesperrt (Kampagne 1 schaltet sie schrittweise frei)
      const locked = !!level && level.roles.length > 0 && !level.roles.includes(t);
      b.classList.toggle('full', full);
      b.classList.toggle('locked', locked);
      const cost = game.towerCost(t);
      b.disabled = locked || s.money < cost || full;
      // Preis inkl. Skill-Rabatt (Spec campaigns: Skills wirken auf Kosten)
      const ct = b.querySelector<HTMLElement>('.ct');
      if (ct && ct.lastChild?.textContent !== String(cost)) ct.lastChild!.textContent = String(cost);
      b.title = locked ? `${TOWERS[t].name}: in diesem Level noch nicht verfügbar` : (b.dataset.title ?? '');
    }
    const paused = this.ctl.paused;
    const pause = $<HTMLButtonElement>('pause');
    pause.setAttribute('aria-pressed', String(paused));
    pause.classList.toggle('on', paused);
    pause.title = paused ? 'Weiter (P)' : 'Pause (P)';
    pause.setAttribute('aria-label', paused ? 'Weiter' : 'Pause');
    pause.disabled = s.over;
    $('pause-overlay').hidden = !paused;
    this.renderWavePreview();
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
      const branches = branchesFor(tower.type);
      const branchName = tower.branch ? branches.find((b) => b.key === tower.branch)?.name : undefined;
      const pickBranch = tower.level === 2 && !tower.branch && branches.length === 2 && up !== null;
      const branchPick = pickBranch
        ? `<span class="branch-pick" role="group" aria-label="Stufe 3: Upgrade-Zweig wählen">${branches
            .map(
              (b) =>
                `<button data-action="branch" data-branch="${b.key}" class="branch"${canUp ? '' : ' disabled'} title="${esc(b.description)}"><b>${esc(b.name)}</b><small>${esc(b.description)}</small><span class="bc"><i class="ico ico-coin"></i>${up}</span></button>`,
            )
            .join('')}</span>`
        : '';
      const upBtn = pickBranch ? '' : `<button data-action="upgrade"${touch && !canUp ? ' disabled' : ''}>Upgrade (${up ?? 'max'})${touch ? '' : ' [U]'}</button>`;
      const mode = tower.targetMode;
      const targeting = def.support
        ? ''
        : `<span class="target-seg" role="group" aria-label="Zielmodus"><span class="ts-lbl">Ziel</span>${TARGET_MODES.map(
            (m) =>
              `<button data-action="target" data-mode="${m}" class="${m === mode ? 'active' : ''}" aria-pressed="${m === mode}" aria-label="Ziel: ${TARGET_MODE_NAMES[m]}" title="${TARGET_MODE_NAMES[m]}: ${TARGET_MODE_HINTS[m]}"><span class="ts-ico" data-ico="icon/target-${m}">${TARGET_SVG[m]}</span><span class="ts-txt">${TARGET_MODE_NAMES[m]}</span></button>`,
          ).join('')}</span>`;
      info =
        `<b>${def.name}</b> <span class="muted">Stufe ${tower.level}/5${branchName ? ` · ${esc(branchName)}` : ''}</span><br>${stats}${push}${st.boosted ? '<br><span class="muted">PPL-Boost aktiv (+25 %)</span>' : ''}<br>` +
        targeting +
        branchPick +
        `<span class="acts">${upBtn}` +
        `<button data-action="sell">Abgeben (+${game.sellValue(tower)})${touch ? '' : ' [S]'}</button>` +
        `${touch ? '<button data-action="close" class="x" aria-label="Auswahl schließen">OK</button>' : ''}</span>`;
    } else if (selected) {
      const def = TOWERS[selected];
      if (touch) {
        const p = this.ctl.preview;
        const reason = p ? game.canPlace(selected, p.cx, p.cy) : null;
        const hint = !p ? 'Feld antippen für Vorschau' : reason === null ? 'Nochmal aufs Feld tippen oder:' : reason === 'noMoney' ? 'Zu wenig Kapazität' : 'Hier ist kein Platz frei';
        info =
          `<b>${def.name}</b> <span class="muted">Kosten ${game.towerCost(selected)}</span><br>${p ? '' : `${TOWER_BLURBS[selected]}<br>`}<span class="muted">${hint}</span><br>` +
          `<span class="acts"><button data-action="place" class="go"${p && reason === null ? '' : ' disabled'}>Hier einsetzen</button>` +
          `<button data-action="cancel">Abbrechen</button></span>`;
      } else {
        info = `<b>${def.name}</b> <span class="muted">Kosten ${game.towerCost(selected)}</span><br>${TOWER_BLURBS[selected]}<br><span class="muted">Klick aufs Feld · Rechtsklick/Esc: abbrechen</span>`;
      }
    } else if (touch && this.ctl.preview) {
      info = '<b>Platz vorgemerkt</b><br>Jetzt eine Rolle antippen – Reichweite erscheint, dann einsetzen.<br><span class="acts"><button data-action="cancel">Abbrechen</button></span>';
    }
    if (info !== this.lastInfo) {
      this.lastInfo = info;
      $('info').innerHTML = info;
      upgradeIcons($('info'));
    }
  }

  private waveKey = '';

  /** Wellenvorschau neben dem Start-Button (Spec campaigns AC-8): Gegnertypen der nächsten Welle mit Anzahl. */
  private renderWavePreview(): void {
    const { game } = this.ctl;
    const s = game.state;
    const box = $('wave-preview');
    const n = s.wave + 1;
    const total = currentLevel(this.ctl)?.waves ?? (s.mode === 'challenge' ? CHALLENGE_WAVES : Infinity);
    if (s.over || n > total) {
      box.hidden = true;
      this.waveKey = '';
      return;
    }
    const key = `${s.seed}:${s.mapId}:${n}:${s.running ? 1 : 0}`;
    if (key === this.waveKey) return;
    this.waveKey = key;
    let types: readonly string[];
    try {
      types = game.peekWave(n);
    } catch {
      types = [];
    }
    const counts = new Map<string, number>();
    for (const t of types) counts.set(t, (counts.get(t) ?? 0) + 1);
    box.hidden = counts.size === 0;
    box.querySelector('.wp-lbl')!.textContent = s.running ? `Danach (Welle ${n})` : `Welle ${n}`;
    const list = $('wp-list');
    list.replaceChildren();
    const parts: string[] = [];
    for (const [t, c] of counts) {
      const info = enemyInfo(t);
      const item = document.createElement('span');
      item.className = `wp-item${info.boss ? ' boss' : ''}`;
      item.title = `${c} × ${info.name}`;
      item.append(enemyIcon(t, 20, info.color, info.name));
      const num = document.createElement('b');
      num.textContent = `${c}`;
      item.append(num);
      list.append(item);
      parts.push(`${c} ${info.name}`);
    }
    box.setAttribute('aria-label', `Welle ${n}: ${parts.join(', ')}`);
  }

  /** Ergebnis teilen (Spec season-2 AC-11). */
  private async share(): Promise<void> {
    const { game, daily } = this.ctl;
    const s = game.state;
    const [, m, d] = daily?.dailyDate.split('-') ?? [];
    const level = currentLevel(this.ctl);
    const res = await shareResult(
      {
        daily: daily ? `${d}.${m}.` : null,
        level: level ? `${levelLabel(level)} ${level.name}` : null,
        stars: level ? game.stars() : null,
        wave: s.wave,
        waves: level ? level.waves : s.mode === 'challenge' ? CHALLENGE_WAVES : null,
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
