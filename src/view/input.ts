import { TOWER_ORDER } from '../sim/index';
import type { SoundEngine } from './audio';
import type { Controller } from './controller';
import { branchPending, currentLevel } from './hud';

/** Tastatur (Original Zeilen 199–202; P = Pause, Spec campaigns AC-8). */
export function installKeyboard(ctl: Controller, sound: SoundEngine): void {
  window.addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
    // Offene Dialoge (Einstellungen, Teamname) und Shell-Screens (Menü, Kampagne …) fangen die Tastatur ab
    if (document.querySelector('dialog[open]') || document.documentElement.classList.contains('shell-open')) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if (k.length === 1 && k >= '1' && k <= '9' && TOWER_ORDER[Number(k) - 1]) {
      const type = TOWER_ORDER[Number(k) - 1]!;
      const roles = currentLevel(ctl)?.roles;
      if (roles?.length && !roles.includes(type)) return;
      sound.start();
      ctl.selectType(type, false);
    } else if (k === ' ') {
      e.preventDefault();
      sound.start();
      ctl.startOrRestart();
    } else if (k === 'u') {
      // Stufe 2 → 3 verlangt die Zweigwahl: Fokus auf die Zweig-Karten statt blindem Upgrade
      if (branchPending(ctl)) {
        const pick = document.querySelector<HTMLElement>('#info .branch-pick');
        pick?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
        pick?.classList.remove('flash');
        requestAnimationFrame(() => pick?.classList.add('flash'));
      } else ctl.upgradeSelected();
    } else if (k === 's') ctl.sellSelected();
    else if (k === 'p') {
      sound.start();
      ctl.togglePause();
    } else if (k === 'escape') {
      if (ctl.paused && ctl.selected === null && ctl.selectedTowerId === null) ctl.togglePause(false);
      else ctl.clearSelection();
    }
  });
}
