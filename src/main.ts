import '@fontsource/caveat/600.css';
import '@fontsource/caveat/700.css';
import './view/style.css';
import Phaser from 'phaser';
import { HEIGHT, WIDTH } from './sim/index';
import { SoundEngine } from './view/audio';
import { Controller } from './view/controller';
import { readFx } from './view/fx';
import { GameScene } from './view/GameScene';
import { Hud } from './view/hud';
import { installKeyboard } from './view/input';
import { randomSeed, readParams } from './view/params';
import { PreloadScene } from './view/PreloadScene';

const params = readParams();
const settings = readFx(params);
const ctl = new Controller({ seed: params.seed ?? randomSeed(), mapId: params.mapId, speed: params.speed }, randomSeed);
const sound = new SoundEngine(ctl);
ctl.onSim((e) => sound.onSim(e));
const hud = new Hud(ctl, sound);
installKeyboard(ctl, sound);

const scene = new GameScene(ctl, sound, settings);
ctl.debug = scene.debugApi();
const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#fbfbf7',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, width: WIDTH, height: HEIGHT },
  scene: [new PreloadScene(), scene],
  banner: false,
});
game.events.on(Phaser.Core.Events.POST_STEP, (_t: number, delta: number) => hud.tick(delta / 1000));
hud.render();

window.addEventListener('beforeunload', () => ctl.saveReplay());

if (import.meta.env.DEV || params.debug) {
  (window as unknown as { __bd: Controller }).__bd = ctl;
}
