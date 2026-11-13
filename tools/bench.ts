import { mkdirSync, writeFileSync } from 'node:fs';
import { runReplay, type LevelId } from '../src/sim/index';
import { playStrongBot } from './bot-strong';

// Misst feste Läufe des starken Bots und die Nachrechenzeit ihrer Replays
// (Spec balancing-challenge AC-7: ≤ 1,0 s, Reserve für das 2-s-CPU-Limit der Supabase Edge Functions).
// Challenge (30 Wellen) und ein langes Kampagnen-Level (Spec campaigns, bis ~80 000 Ticks).
const SEED = 12345;
const LEVEL: LevelId = 'solution-5';

function bench(label: string, opts: Parameters<typeof playStrongBot>[0]): boolean {
  const t0 = performance.now();
  const game = playStrongBot(opts);
  const playMs = performance.now() - t0;

  const replay = game.toReplay();
  const t1 = performance.now();
  const check = runReplay(replay);
  const verifyMs = performance.now() - t1;

  const s = game.state;
  const perK = (verifyMs / s.tick) * 1000;
  console.log(
    `${label}: seed=${s.seed} map=${s.mapId} mode=${s.mode} level=${s.levelId ?? '-'} waves=${s.wave} won=${s.won} stars=${game.stars()} ` +
      `lives=${s.lives} kills=${s.kills} leaks=${s.leaks} ticks=${s.tick} score=${s.score} towers=${s.towers.length} ` +
      `ms=${playMs.toFixed(1)} verify_ms=${verifyMs.toFixed(1)} ms_per_1k_ticks=${perK.toFixed(3)} hash=${check.hash} matches=${check.matches}`,
  );
  mkdirSync('.tmp', { recursive: true });
  writeFileSync(`.tmp/bot-replay${s.levelId ? `-${s.levelId}` : ''}.json`, JSON.stringify(replay));
  return check.matches;
}

const ok = [
  bench('challenge', { seed: SEED, maxWave: 30, mode: 'challenge' }),
  bench('level', { seed: SEED, maxWave: 99, levelId: LEVEL }),
].every(Boolean);
if (!ok) process.exit(1);
