import { availableParallelism } from 'node:os';
import { isMainThread, parentPort, Worker, workerData } from 'node:worker_threads';
import { BALANCE, CHALLENGE_WAVES, MAPS, runReplay, type BalanceConfig, type GameMode, type MapId, type Replay } from '../src/sim/index';
import { playBot } from './bot';
import { playStrongBot } from './bot-strong';

// Balancing-Messung (Spec balancing-challenge AC-3 bis AC-7).
// npm run balance                       → Kennzahlen für BALANCE (20 Läufe je Gruppe)
// npm run balance -- --balance '{…}'    → Kennzahlen für eine Variante (Teilobjekt, Rest aus BALANCE)
// npm run balance -- --sweep            → Raster über hpGrowth/rewardGrowth/bossHpFactor (12 Läufe je Gruppe)
// npm run balance -- --json             → Ausgabe als JSON

type Bot = 'ref' | 'strong';
interface Job { id: number; bot: Bot; mode: GameMode; seed: number; mapId: MapId; maxWave: number; balance: BalanceConfig; keepReplay: boolean }
interface Result { id: number; wave: number; won: boolean; over: boolean; lives: number; ticks: number; cleanStart: boolean; replay?: Replay }

function runJob(j: Job): Result {
  let cleanStart = true;
  const opts = {
    seed: j.seed, mapId: j.mapId, mode: j.mode, maxWave: j.maxWave, balance: j.balance,
    onWaveEnd: (g: { state: { wave: number; lives: number } }) => {
      if (g.state.wave <= 5 && g.state.lives < 100) cleanStart = false;
    },
  };
  const game = j.bot === 'ref' ? playBot(opts) : playStrongBot(opts);
  const s = game.state;
  return { id: j.id, wave: s.wave, won: s.won, over: s.over, lives: s.lives, ticks: s.tick, cleanStart, replay: j.keepReplay ? game.toReplay() : undefined };
}

if (!isMainThread) {
  parentPort!.on('message', (j: Job) => parentPort!.postMessage(runJob(j)));
}

async function runAll(jobs: Job[]): Promise<Result[]> {
  const size = Math.max(1, Math.min(jobs.length, availableParallelism() - 1));
  const results: Result[] = [];
  let next = 0;
  await Promise.all(
    Array.from({ length: size }, () => new Promise<void>((resolve, reject) => {
      const w = new Worker(new URL(import.meta.url), { workerData: null });
      const feed = (): void => {
        if (next >= jobs.length) {
          void w.terminate().then(() => resolve());
          return;
        }
        w.postMessage(jobs[next++]);
      };
      w.on('message', (r: Result) => {
        results.push(r);
        feed();
      });
      w.on('error', reject);
      feed();
    })),
  );
  void workerData;
  return results.sort((a, b) => a.id - b.id);
}

interface Summary {
  balance: BalanceConfig;
  ref: { median: number; min: number; max: number; winRate: number; cleanStart: number };
  strong: { median: number; min: number; max: number; winRate: number; cleanStart: number; maxTicks: number };
  endless: { median: number; max: number; allOver: boolean };
  verifyMs: number | null;
  ok: Record<string, boolean>;
}

const median = (xs: number[]): number => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor((s.length - 1) / 2)]! : 0;
};

async function evaluate(balance: BalanceConfig, seeds: number[], withVerify: boolean): Promise<Summary> {
  const jobs: Job[] = [];
  let id = 0;
  for (const seed of seeds) for (const m of MAPS) {
    jobs.push({ id: id++, bot: 'ref', mode: 'challenge', seed, mapId: m.id, maxWave: CHALLENGE_WAVES, balance, keepReplay: false });
    jobs.push({ id: id++, bot: 'strong', mode: 'challenge', seed, mapId: m.id, maxWave: CHALLENGE_WAVES, balance, keepReplay: withVerify });
    jobs.push({ id: id++, bot: 'strong', mode: 'endless', seed, mapId: m.id, maxWave: 60, balance, keepReplay: false });
  }
  const res = await runAll(jobs);
  const pick = (bot: Bot, mode: GameMode): Result[] => res.filter((r) => jobs[r.id]!.bot === bot && jobs[r.id]!.mode === mode);
  const stats = (rs: Result[]) => {
    const waves = rs.map((r) => r.wave);
    return {
      median: median(waves), min: Math.min(...waves), max: Math.max(...waves),
      winRate: rs.filter((r) => r.won).length / rs.length, cleanStart: rs.filter((r) => r.cleanStart).length / rs.length,
    };
  };
  const ref = stats(pick('ref', 'challenge'));
  const strongRuns = pick('strong', 'challenge');
  const strong = { ...stats(strongRuns), maxTicks: Math.max(...strongRuns.map((r) => r.ticks)) };
  const endRuns = pick('strong', 'endless');
  const endless = { median: median(endRuns.map((r) => r.wave)), max: Math.max(...endRuns.map((r) => r.wave)), allOver: endRuns.every((r) => r.over) };
  let verifyMs: number | null = null;
  if (withVerify) {
    const longest = strongRuns.reduce((a, b) => (b.ticks > a.ticks ? b : a));
    const t0 = performance.now();
    const check = runReplay(longest.replay!, { balance });
    verifyMs = Math.round(performance.now() - t0);
    if (!check.matches) throw new Error('Replay des längsten Laufs stimmt nicht');
  }
  const ok = {
    'AC-3 median 18–25': ref.median >= 18 && ref.median <= 25,
    'AC-3 ref wins ≤10%': ref.winRate <= 0.1,
    'AC-4 strong wins ≥50%': strong.winRate >= 0.5,
    'AC-5 clean start ≥90%': ref.cleanStart >= 0.9,
    'AC-6 endless ends ≤45': endless.allOver && endless.max <= 45,
    ...(verifyMs !== null ? { 'AC-7 verify ≤1000ms': verifyMs <= 1000 } : {}),
  };
  return { balance, ref, strong, endless, verifyMs, ok };
}

function print(s: Summary, json: boolean): void {
  if (json) {
    console.log(JSON.stringify(s));
    return;
  }
  const pct = (x: number): string => `${Math.round(x * 100)}%`;
  console.log(`balance ${JSON.stringify(s.balance)}`);
  console.log(`  ref    challenge: median=${s.ref.median} min=${s.ref.min} max=${s.ref.max} wins=${pct(s.ref.winRate)} cleanStart=${pct(s.ref.cleanStart)}`);
  console.log(`  strong challenge: median=${s.strong.median} min=${s.strong.min} max=${s.strong.max} wins=${pct(s.strong.winRate)} maxTicks=${s.strong.maxTicks}`);
  console.log(`  strong endless  : median=${s.endless.median} max=${s.endless.max} allOver=${s.endless.allOver}`);
  if (s.verifyMs !== null) console.log(`  verify longest strong challenge: ${s.verifyMs} ms`);
  console.log(`  ${Object.entries(s.ok).map(([k, v]) => `${v ? '✓' : '✗'} ${k}`).join(' | ')}`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const json = args.includes('--json');
  const bi = args.indexOf('--balance');
  if (args.includes('--sweep')) {
    // Raster als JSON, z. B. --sweep '{"hpGrowth":[1.08,1.1],"rewardFactor":[0.6,0.8]}' (fehlende Felder aus BALANCE)
    const si = args.indexOf('--sweep');
    const spec = JSON.parse(args[si + 1]?.startsWith('{') ? args[si + 1]! : '{"hpGrowth":[1.1,1.15,1.2]}') as Record<string, number[]>;
    let grid: BalanceConfig[] = [{ ...BALANCE }];
    for (const [key, values] of Object.entries(spec)) grid = grid.flatMap((b) => values.map((v) => ({ ...b, [key]: v })));
    for (const b of grid) print(await evaluate(b, [1, 2, 3], false), json);
    return;
  }
  const balance: BalanceConfig = bi >= 0 ? { ...BALANCE, ...(JSON.parse(args[bi + 1] ?? '{}') as Partial<BalanceConfig>) } : { ...BALANCE };
  print(await evaluate(balance, [1, 2, 3, 4, 5], true), json);
}

if (isMainThread) await main();
