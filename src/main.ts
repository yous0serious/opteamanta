import '@fontsource/caveat/600.css';
import '@fontsource/caveat/700.css';
import '@fontsource/nunito/400.css';
import '@fontsource/nunito/700.css';
import '@fontsource/nunito/800.css';
import './view/style.css';
import Phaser from 'phaser';
import { HEIGHT, WIDTH } from './sim/index';
import { SoundEngine } from './view/audio';
import { Controller } from './view/controller';
import { readFx } from './view/fx';
import { shareState } from './view/share';
import { GameScene } from './view/GameScene';
import { Hud } from './view/hud';
import { installKeyboard } from './view/input';
import { installMobileChrome, installPointerMode } from './view/touch';
import { randomSeed, readParams } from './view/params';
import { PreloadScene } from './view/PreloadScene';
import { runBench } from './view/bench';
import { createOnline } from './online/api';
import { LeaderboardPanel } from './view/leaderboard';
import { createMeta } from './meta/service';
import { Host } from './meta/host';
import { RunBoard } from './meta/runboard';
import { mountShell } from './ui/index';

const params = readParams();
installPointerMode();
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
// Teilen-Karte: Bild des Spielfelds über Phasers Snapshot (funktioniert in WebGL und Canvas)
const hud = new Hud(ctl, sound, settings, () => snapshot());
installKeyboard(ctl, sound);
installMobileChrome(() => sound.start());

const scene = new GameScene(ctl, sound, settings);
ctl.debug = { ...scene.debugApi(), audio: () => sound.status(), share: () => shareState.last, fxLevel: () => settings.level };
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
// Direktlinks mit Spielparametern (?map=…, ?seed=…, ?bench=1 …) starten wie bisher sofort ins Spiel (alter Daily-Ablauf);
// ohne solche Parameter startet das Hauptmenü (Spec campaigns) mit Meta-Dienst und Host.
const SHELL_PARAMS = new Set(['debug', 'fx', 'shell', 'offline']);
const deepLink = [...new URLSearchParams(location.search).keys()].some((k) => !SHELL_PARAMS.has(k));
const snapshot = (): Promise<CanvasImageSource | null> => new Promise((resolve) => game.renderer.snapshot((img) => resolve(img as HTMLImageElement)));

if (deepLink) {
  void (params.bench ? Promise.resolve(null) : createOnline())
    .catch(() => null)
    .then((online) => new LeaderboardPanel(online, ctl));
} else {
  void bootShell();
}

async function bootShell(): Promise<void> {
  const online = await createOnline().catch(() => null);
  const { meta, error } = await createMeta(online);
  const board = new RunBoard(meta, ctl);
  if (error) board.status('Online-Anmeldung fehlgeschlagen – Fortschritt wird nur lokal gespeichert.', 'err');
  const host = new Host(ctl, meta, { status: (text, kind) => board.status(text, kind) });
  ctl.togglePause(true);
  mountShell(meta, host, sound, {
    snapshot,
    runActive: () => ctl.game.state.wave > 0 && !ctl.over,
    currentRun: () => ctl.game,
    onRoute: (to) => {
      // Außerhalb des Spiels steht die Simulation still; zurück im Spiel läuft sie weiter.
      if (to.name === 'play') ctl.togglePause(false);
      else ctl.togglePause(true);
    },
  });
}

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
