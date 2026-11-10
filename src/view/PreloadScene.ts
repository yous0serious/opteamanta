import Phaser from 'phaser';
import { HEIGHT, WIDTH } from '../sim/index';
import { HAND } from './texts';

export const ATLAS = 'game';

/** Lädt Atlas und Schrift mit Fortschrittsbalken (Spec visual-overhaul AC-11), startet dann die Spielszene. */
export class PreloadScene extends Phaser.Scene {
  constructor() {
    super({ key: 'preload' });
  }

  preload(): void {
    const g = this.add.graphics();
    const label = this.add
      .text(WIDTH / 2, HEIGHT / 2 - 34, 'Lade Backlog… 0 %', { fontFamily: HAND, fontSize: '30px', fontStyle: 'bold', color: '#1565c0', resolution: 2 })
      .setOrigin(0.5);
    const x0 = WIDTH / 2 - 220;
    const draw = (p: number): void => {
      g.clear();
      g.lineStyle(3, 0xc9d0d6, 1).strokeRoundedRect(x0 - 4, HEIGHT / 2 - 10, 448, 28, 8);
      // Marker-Strich: leicht gewellte Linie, die mit dem Fortschritt wächst
      g.lineStyle(14, 0x1565c0, 0.85);
      g.beginPath();
      g.moveTo(x0 + 6, HEIGHT / 2 + 4);
      const end = x0 + 6 + 428 * p;
      for (let x = x0 + 6; x <= end; x += 8) g.lineTo(x, HEIGHT / 2 + 4 + Math.sin(x / 23) * 1.5);
      g.strokePath();
      label.setText(`Lade Backlog… ${Math.round(p * 100)} %`);
    };
    draw(0);
    this.load.on('progress', draw);
    this.load.multiatlas(ATLAS, 'assets/game.json', 'assets/');
  }

  create(): void {
    // Handschrift muss geladen sein, bevor Phaser Texte rastert.
    const fonts = document.fonts ? Promise.all([document.fonts.load('600 20px Caveat'), document.fonts.load('700 20px Caveat')]) : Promise.resolve();
    void fonts.catch(() => undefined).then(() => this.scene.start('game'));
  }
}
