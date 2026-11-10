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
import { runBench } from './view/bench';
import { createOnline } from './online/api';
import { LeaderboardPanel } from './view/leaderboard';

const params = readParams();
const settings = readFx(params);
// ?bench=1: festes Szenario (Seed 12345, Karte matrix), siehe src/view/bench.ts
const ctl = new Controller(
  params.bench
    ? { seed: 12345, mapId: 'matrix', speed: 1, mode: 'endless' }
    : { seed: params.seed ?? randomSeed(), mapId: params.mapId, speed: params.speed, mode: params.mode },
  randomSeed,
);
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

// Bestenliste/Daily (Spec leaderboard-supabase): ohne VITE_SUPABASE_* offline, keine Netzwerkaufrufe.
void (params.bench ? Promise.resolve(null) : createOnline())
  .catch(() => null)
  .then((online) => new LeaderboardPanel(online, ctl));

if (params.bench) {
  const waitReady = (): void => {
    if (document.body.dataset.ready !== '1') return;
    game.events.off('step', waitReady);
    runBench(ctl, game, settings, (r) => {
      const line = `fx=${r.fx} renderer=${r.renderer} towers=${r.towers} frames=${r.frames} avg_ms=${r.avgMs} p95_ms=${r.p95Ms}`;
      console.log(`[bench] ${line}`);
      (window as unknown as { __benchResult: unknown }).__benchResult = r;
      const info = document.getElementById('info');
      if (info) info.textContent = `Benchmark: ${line}`;
    });
  };
  game.events.on('step', waitReady);
}

if (import.meta.env.DEV || params.debug) {
  (window as unknown as { __bd: Controller }).__bd = ctl;
}
