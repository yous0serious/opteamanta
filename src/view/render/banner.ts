import Phaser from 'phaser';
import { HEIGHT, WIDTH } from '../../sim/index';
import { HAND } from '../texts';

const DRAW = 0.5;
const HOLD = 1.2;
const FADE = 0.35;

/**
 * Wellen-Banner: ein Textmarker streicht hinter den Text, dann blendet er aus (Spec visual-overhaul AC-9).
 * Bei reduzierter Bewegung: sofort vollständig sichtbar, ohne Bewegung.
 */
export class WaveBanner {
  readonly root: Phaser.GameObjects.Container;
  private readonly text: Phaser.GameObjects.Text;
  private readonly marker: Phaser.GameObjects.Graphics;
  private t = -1;
  private hold = HOLD;
  private markerColor = 0xfff176;

  constructor(
    scene: Phaser.Scene,
    private readonly reducedMotion: boolean,
  ) {
    this.marker = scene.add.graphics();
    this.text = scene.add
      .text(0, 0, '', { fontFamily: HAND, fontSize: '40px', fontStyle: 'bold', color: '#ad1457', stroke: '#ffffff', strokeThickness: 6, resolution: 2 })
      .setOrigin(0.5);
    this.root = scene.add.container(WIDTH / 2, HEIGHT / 2, [this.marker, this.text]).setVisible(false).setRotation(-0.02);
  }

  show(text: string, color: string, size = 40, hold = HOLD, marker = 0xfff176): void {
    this.text.setText(text).setColor(color).setFontSize(Math.round(size * 1.3));
    const maxW = WIDTH - 80;
    this.text.setScale(this.text.width > maxW ? maxW / this.text.width : 1);
    this.markerColor = marker;
    this.hold = hold;
    this.t = this.reducedMotion ? DRAW : 0;
    this.root.setVisible(true).setAlpha(1);
  }

  get visible(): boolean {
    return this.t >= 0;
  }

  update(dt: number): void {
    if (this.t < 0) return;
    this.t += dt;
    const w = this.text.displayWidth + 30;
    const h = this.text.displayHeight * 0.62;
    const p = Math.min(1, this.t / DRAW);
    this.marker.clear();
    this.marker.fillStyle(this.markerColor, 0.7);
    // Textmarker: leicht schräg, wächst von links nach rechts
    const x0 = -w / 2;
    const x1 = x0 + w * Phaser.Math.Easing.Cubic.Out(p);
    this.marker.beginPath();
    this.marker.moveTo(x0, -h / 2 + 4);
    this.marker.lineTo(x1, -h / 2);
    this.marker.lineTo(x1, h / 2 + 2);
    this.marker.lineTo(x0, h / 2 + 6);
    this.marker.closePath();
    this.marker.fillPath();
    this.text.setAlpha(this.reducedMotion ? 1 : Math.min(1, p * 1.5));
    const end = DRAW + this.hold;
    if (this.t > end) this.root.setAlpha(Math.max(0, 1 - (this.t - end) / FADE));
    if (this.t > end + FADE) {
      this.t = -1;
      this.root.setVisible(false);
    }
  }

  hide(): void {
    this.t = -1;
    this.root.setVisible(false);
  }
}
