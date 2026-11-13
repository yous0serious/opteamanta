import { availableParallelism } from 'node:os';
import { isMainThread, parentPort, Worker, workerData } from 'node:worker_threads';
import { BALANCE, CHALLENGE_WAVES, FREE_MAPS, LEVELS, runReplay, type BalanceConfig, type GameMode, type LevelId, type MapId, type Replay } from '../src/sim/index';
import { playBot } from './bot';
import { playStrongBot } from './bot-strong';

// Balancing-Messung (Spec balancing-challenge AC-3 bis AC-7).
// npm run balance                       → Kennzahlen für BALANCE (20 Läufe je Gruppe)
// npm run balance -- --balance '{…}'    → Kennzahlen für eine Variante (Teilobjekt, Rest aus BALANCE)
// npm run balance -- --sweep            → Raster über hpGrowth/rewardGrowth/bossHpFactor (12 Läufe je Gruppe)
// npm run balance -- --json             → Ausgabe als JSON
// npm run balance -- --levels [n]       → alle 24 Kampagnen-Level mit starkem und Referenz-Bot (n Seeds, Standard 10)
// npm run balance -- --levels n team-1  → nur die genannten Level

type Bot = 'ref' | 'strong';
interface Job { id: number; bot: Bot; mode: GameMode; seed: number; mapId?: MapId; levelId?: LevelId; maxWave: number; balance: BalanceConfig; keepReplay: boolean }
interface Result { id: number; wave: number; won: boolean; over: boolean; lives: number; ticks: number; stars: number; cleanStart: boolean; roles: string[]; replay?: Replay }

function runJob(j: Job): Result {
  let cleanStart = true;
  const opts = {
    seed: j.seed, mapId: j.mapId, levelId: j.levelId, mode: j.mode, maxWave: j.maxWave, balance: j.balance,
    onWaveEnd: (g: { state: { wave: number; lives: number } }) => {
      if (g.state.wave <= 5 && g.state.lives < 100) cleanStart = false;
    },
  };
  const game = j.bot === 'ref' ? playBot(opts) : playStrongBot(opts);
  const s = game.state;
  return { id: j.id, wave: s.wave, won: s.won, over: s.over, lives: s.lives, ticks: s.tick, stars: game.stars(), cleanStart, roles: [...new Set(s.towers.map((t) => t.type))].sort(), replay: j.keepReplay ? game.toReplay() : undefined };
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
  roles: { ref: Record<string, number>; strong: Record<string, number> };
  ok: Record<string, boolean>;
}

const median = (xs: number[]): number => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor((s.length - 1) / 2)]! : 0;
};

async function evaluate(balance: BalanceConfig, seeds: number[], withVerify: boolean): Promise<Summary> {
  const jobs: Job[] = [];
  let id = 0;
  for (const seed of seeds) for (const m of FREE_MAPS) {
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
  // Saison 2 (Spec season-2 AC-4): Anteil der Läufe, in denen die Rolle am Ende im Team ist
  const share = (rs: Result[], role: string): number => rs.filter((r) => r.roles.includes(role)).length / rs.length;
  const refRuns = pick('ref', 'challenge');
  const roles = {
    ref: Object.fromEntries(['rte', 'rta', 'rto'].map((k) => [k, share(refRuns, k)])),
    strong: Object.fromEntries(['rte', 'rta', 'rto', 'board'].map((k) => [k, share(strongRuns, k)])),
  };
  const ok = {
    'AC-3 median 18–25': ref.median >= 18 && ref.median <= 25,
    'AC-3 ref wins ≤10%': ref.winRate <= 0.1,
    'AC-4 strong wins ≥50%': strong.winRate >= 0.5,
    'AC-5 clean start ≥90%': ref.cleanStart >= 0.9,
    'AC-6 endless ends ≤45': endless.allOver && endless.max <= 45,
    ...(verifyMs !== null ? { 'AC-7 verify ≤1000ms': verifyMs <= 1000 } : {}),
    'S2 ref nutzt RTE/RTA/RTO': Object.values(roles.ref).every((v) => v >= 0.5),
    'S2 strong nutzt alle neuen': Object.values(roles.strong).every((v) => v >= 0.5),
  };
  return { balance, ref, strong, endless, verifyMs, roles, ok };
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
  console.log(`  roles ref ${JSON.stringify(s.roles.ref)} strong ${JSON.stringify(s.roles.strong)}`);
  console.log(`  ${Object.entries(s.ok).map(([k, v]) => `${v ? '✓' : '✗'} ${k}`).join(' | ')}`);
}

/** Kampagnen-Level (Spec campaigns AC-1): starker Bot ≥ 80 % Siege je Level, Referenz-Bot schafft team-1 … team-3. */
async function evaluateLevels(seeds: number[], only: string[], json: boolean): Promise<boolean> {
  const levels = LEVELS.filter((l) => !only.length || only.includes(l.id));
  const jobs: Job[] = [];
  let id = 0;
  for (const l of levels) for (const seed of seeds) for (const bot of ['strong', 'ref'] as const) {
    jobs.push({ id: id++, bot, mode: 'level', seed, levelId: l.id, maxWave: l.waves, balance: { ...BALANCE }, keepReplay: false });
  }
  const res = await runAll(jobs);
  const pct = (x: number): string => `${Math.round(x * 100)}%`.padStart(4);
  const rows = levels.map((l) => {
    const pick = (bot: Bot): Result[] => res.filter((r) => jobs[r.id]!.levelId === l.id && jobs[r.id]!.bot === bot);
    const strong = pick('strong');
    const ref = pick('ref');
    const stars = [0, 1, 2, 3].map((n) => strong.filter((r) => r.stars === n).length);
    const win = strong.filter((r) => r.won).length / strong.length;
    const refWin = ref.filter((r) => r.won).length / ref.length;
    const minLives = Math.min(...strong.filter((r) => r.won).map((r) => r.lives));
    const lost = strong.filter((r) => !r.won).map((r) => r.wave);
    const needRef = ['team-1', 'team-2', 'team-3'].includes(l.id);
    const ok = win >= 0.8 && (!needRef || refWin >= 0.8);
    return { level: l.id, waves: l.waves, win, stars, refWin, minLives, lost, ok, maxTicks: Math.max(...strong.map((r) => r.ticks)) };
  });
  if (json) console.log(JSON.stringify(rows));
  else {
    console.log(`level        waves strong  ★0/★1/★2/★3   ref   minLives lostAt   maxTicks`);
    for (const r of rows) {
      console.log(
        `${r.ok ? '✓' : '✗'} ${r.level.padEnd(12)} ${String(r.waves).padStart(3)}  ${pct(r.win)}   ${r.stars.map((n) => String(n).padStart(2)).join('/')}  ${pct(r.refWin)}   ${String(r.minLives === Infinity ? '-' : r.minLives).padStart(4)}   ${r.lost.join(',').padEnd(8)} ${r.maxTicks}`,
      );
    }
    console.log(`${rows.filter((r) => r.ok).length}/${rows.length} Level im Ziel (stark ≥ 80 %, Referenz team-1…3 ≥ 80 %)`);
  }
  return rows.every((r) => r.ok);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const json = args.includes('--json');
  const li = args.indexOf('--levels');
  if (li >= 0) {
    const n = Number(args[li + 1]);
    const count = Number.isInteger(n) && n > 0 ? n : 10;
    const only = args.slice(li + 1).filter((a) => /^[a-z]+-\d$/.test(a));
    const ok = await evaluateLevels(Array.from({ length: count }, (_, i) => i + 1), only, json);
    if (!ok) process.exitCode = 1;
    return;
  }
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
