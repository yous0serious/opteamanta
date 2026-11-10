import { mkdirSync, writeFileSync } from 'node:fs';
import { runReplay } from '../src/sim/index';
import { playBot } from './bot';

// Misst einen festen Bot-Lauf und die Nachrechenzeit seines Replays (Grundlage für Spec 3).
const SEED = 12345;
const MAX_WAVE = 30;

const t0 = performance.now();
const game = playBot({ seed: SEED, maxWave: MAX_WAVE });
const playMs = performance.now() - t0;

const replay = game.toReplay();
const t1 = performance.now();
const check = runReplay(replay);
const verifyMs = performance.now() - t1;

const s = game.state;
const perK = (verifyMs / s.tick) * 1000;
console.log(
  `seed=${SEED} map=${s.mapId} waves=${s.wave} over=${s.over} ticks=${s.tick} score=${s.score} towers=${s.towers.length} ` +
    `ms=${playMs.toFixed(1)} verify_ms=${verifyMs.toFixed(1)} ms_per_1k_ticks=${perK.toFixed(3)} matches=${check.matches}`,
);

mkdirSync('.tmp', { recursive: true });
writeFileSync('.tmp/bot-replay.json', JSON.stringify(replay));
if (!check.matches) process.exit(1);
