import { fromReplayCommand } from './commands';
import { COLS, MAX_REPLAY_COMMANDS, MAX_REPLAY_TICKS, MAX_TOWER_ID, ROWS } from './constants';
import { levelById } from './data/campaigns';
import { mapById } from './data/maps';
import { validateLoadout } from './data/skills';
import { TARGET_MODES, TOWERS } from './data/towers';
import { Game } from './game';
import type { BalanceConfig } from './data/balance';
import type { EnemyType, ReplayCommand, ReplayResult, ReplayV3, TargetMode } from './types';
import { GAME_VERSION } from './version';

export interface ReplayCheck extends ReplayResult {
  tick: number;
  hash: string;
  matches: boolean;
  /** Längste Kombo des Laufs (Erfolge). */
  bestCombo: number;
  /** Besiegte Bosstypen (Erfolge). */
  bossesDefeated: EnemyType[];
}

export interface ParseOptions {
  /** Erwartete Spielversion (Standard: aktuelle `GAME_VERSION`). */
  version?: string;
  /** Strengere Tick-Grenze, z. B. je Modus auf dem Server. */
  maxTicks?: number;
}

const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v);
const inRange = (v: unknown, min: number, max: number): v is number => isInt(v) && v >= min && v <= max;

function fail(reason: string): never {
  throw new Error(`Ungültiges Replay: ${reason}`);
}

/** Prüft Struktur, Version und Grenzen eines Replays (nicht das Ergebnis – das macht runReplay). */
export function parseReplay(input: unknown, opts: ParseOptions = {}): ReplayV3 {
  const data = typeof input === 'string' ? (JSON.parse(input) as unknown) : input;
  if (!data || typeof data !== 'object' || Array.isArray(data)) fail('kein Objekt');
  const r = data as Record<string, unknown>;
  if (r.format === 1) fail('Replay-Format 1 (Spielversion 0.1.x) wird nicht mehr unterstützt');
  if (r.format === 2) fail('Replay-Format 2 (Spielversion 0.2.x/0.3.x) wird nicht mehr unterstützt');
  if (r.format !== 3) fail(`format ${String(r.format)} wird nicht unterstützt`);
  const version = opts.version ?? GAME_VERSION;
  if (r.gameVersion !== version) fail(`Spielversion ${String(r.gameVersion)} passt nicht zu ${version}`);
  if (!inRange(r.seed, 0, 0xffffffff)) fail('seed muss uint32 sein');
  if (typeof r.mapId !== 'string' || !mapById(r.mapId as never)) fail(`unbekannte Karte ${String(r.mapId)}`);
  if (r.mode !== 'challenge' && r.mode !== 'endless' && r.mode !== 'level') fail(`unbekannter Modus ${String(r.mode)}`);
  if (r.mode === 'level') {
    const level = typeof r.levelId === 'string' ? levelById(r.levelId) : undefined;
    if (!level) fail(`unbekanntes Level ${String(r.levelId)}`);
    if (level.mapId !== r.mapId) fail(`Karte ${String(r.mapId)} passt nicht zu Level ${level.id}`);
  } else if (r.levelId !== null) {
    fail('levelId muss außerhalb des Level-Modus null sein');
  }
  const loadoutError = validateLoadout(r.loadout, Infinity);
  if (loadoutError) fail(`loadout ungültig (${loadoutError})`);
  const maxTicks = Math.min(opts.maxTicks ?? MAX_REPLAY_TICKS, MAX_REPLAY_TICKS);
  if (!inRange(r.endTick, 0, maxTicks)) fail(`endTick außerhalb 0…${maxTicks}`);
  if (!Array.isArray(r.commands)) fail('commands fehlt');
  if (r.commands.length > MAX_REPLAY_COMMANDS) fail(`mehr als ${MAX_REPLAY_COMMANDS} Kommandos`);
  let lastTick = 0;
  for (const [i, c] of r.commands.entries()) {
    if (!Array.isArray(c) || !inRange(c[0], 0, r.endTick as number)) fail(`Kommando ${i}: Tick fehlt oder außerhalb`);
    if (c[0] < lastTick) fail(`Kommando ${i}: Ticks nicht aufsteigend`);
    lastTick = c[0];
    const ok =
      (c[1] === 'place' && c.length === 5 && typeof c[2] === 'string' && Object.hasOwn(TOWERS, c[2]) &&
        inRange(c[3], 0, COLS - 1) && inRange(c[4], 0, ROWS - 1)) ||
      (c[1] === 'upgrade' && c.length === 3 && inRange(c[2], 1, MAX_TOWER_ID)) ||
      (c[1] === 'upgrade' && c.length === 4 && inRange(c[2], 1, MAX_TOWER_ID) && (c[3] === 'a' || c[3] === 'b')) ||
      (c[1] === 'sell' && c.length === 3 && inRange(c[2], 1, MAX_TOWER_ID)) ||
      (c[1] === 'target' && c.length === 4 && inRange(c[2], 1, MAX_TOWER_ID) && TARGET_MODES.includes(c[3] as TargetMode)) ||
      (c[1] === 'startWave' && c.length === 2);
    if (!ok) fail(`Kommando ${i}: ungültig`);
  }
  const res = r.result as Record<string, unknown> | undefined;
  if (
    !res || typeof res !== 'object' || !isInt(res.score) || !isInt(res.wave) || !isInt(res.lives) ||
    typeof res.over !== 'boolean' || typeof res.won !== 'boolean' || !inRange(res.kills, 0, Number.MAX_SAFE_INTEGER) ||
    !inRange(res.stars, 0, 3) || !inRange(res.leaks, 0, Number.MAX_SAFE_INTEGER)
  ) {
    fail('result unvollständig');
  }
  return data as ReplayV3;
}

/** Spielt ein Replay headless nach (mit Level und Loadout) und vergleicht das Ergebnis. `balance` nur für Tools. */
export function runReplay(r: ReplayV3, opts: { balance?: Readonly<BalanceConfig> } = {}): ReplayCheck {
  const game = new Game({ seed: r.seed, mapId: r.mapId, mode: r.mode, levelId: r.levelId, loadout: r.loadout, balance: opts.balance });
  const cmds: readonly ReplayCommand[] = r.commands;
  let i = 0;
  let rejected = false;
  const applyDue = (tick: number): void => {
    while (i < cmds.length && cmds[i]![0] === tick) {
      const events = game.apply(fromReplayCommand(cmds[i]!));
      if (events.some((e) => e.type === 'rejected')) rejected = true;
      i++;
    }
  };
  for (let t = 0; t < r.endTick && game.state.tick === t; t++) {
    applyDue(t);
    game.step();
  }
  applyDue(game.state.tick);
  if (i < cmds.length) rejected = true;
  const s = game.state;
  const stars = game.stars();
  const res = r.result;
  const matches =
    !rejected &&
    s.tick === r.endTick &&
    s.score === res.score &&
    s.wave === res.wave &&
    s.lives === res.lives &&
    s.over === res.over &&
    s.won === res.won &&
    s.kills === res.kills &&
    stars === res.stars &&
    s.leaks === res.leaks;
  return {
    score: s.score, wave: s.wave, lives: s.lives, over: s.over, won: s.won, kills: s.kills, stars, leaks: s.leaks,
    tick: s.tick, hash: game.stateHash(), matches, bestCombo: s.bestCombo, bossesDefeated: [...s.bossesDefeated],
  };
}
