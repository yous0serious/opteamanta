import { mkdirSync, writeFileSync } from 'node:fs';
import { runReplay } from '../src/sim/index';
import { playStrongBot } from './bot-strong';

// Misst einen festen Lauf des starken Bots im Challenge-Modus und die Nachrechenzeit seines Replays
// (Spec balancing-challenge AC-7: ≤ 1,0 s, Reserve für das 2-s-CPU-Limit der Supabase Edge Functions).
const SEED = 12345;

const t0 = performance.now();
const game = playStrongBot({ seed: SEED, maxWave: 30, mode: 'challenge' });
const playMs = performance.now() - t0;

const replay = game.toReplay();
const t1 = performance.now();
const check = runReplay(replay);
const verifyMs = performance.now() - t1;

const s = game.state;
const perK = (verifyMs / s.tick) * 1000;
console.log(
  `seed=${SEED} map=${s.mapId} mode=${s.mode} waves=${s.wave} won=${s.won} lives=${s.lives} ticks=${s.tick} score=${s.score} ` +
    `towers=${s.towers.length} ms=${playMs.toFixed(1)} verify_ms=${verifyMs.toFixed(1)} ms_per_1k_ticks=${perK.toFixed(3)} ` +
    `hash=${check.hash} matches=${check.matches}`,
);

mkdirSync('.tmp', { recursive: true });
writeFileSync('.tmp/bot-replay.json', JSON.stringify(replay));
if (!check.matches) process.exit(1);
