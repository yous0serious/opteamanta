import { TOWER_ORDER } from '../sim/index';
import type { SoundEngine } from './audio';
import type { Controller } from './controller';

/** Tastatur (Original Zeilen 199–202). */
export function installKeyboard(ctl: Controller, sound: SoundEngine): void {
  window.addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    // Offene Dialoge (Einstellungen, Teamname) fangen die Tastatur ab
    if (document.querySelector('dialog[open]')) return;
    const k = e.key.toLowerCase();
    if (k.length === 1 && k >= '1' && k <= '9' && TOWER_ORDER[Number(k) - 1]) {
      sound.start();
      ctl.selectType(TOWER_ORDER[Number(k) - 1]!, false);
    } else if (k === ' ') {
      e.preventDefault();
      sound.start();
      ctl.startOrRestart();
    } else if (k === 'u') ctl.upgradeSelected();
    else if (k === 's') ctl.sellSelected();
    else if (k === 'escape') ctl.clearSelection();
  });
}
