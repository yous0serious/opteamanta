import { fromReplayCommand } from './commands';
import { COLS, MAX_REPLAY_COMMANDS, MAX_REPLAY_TICKS, MAX_TOWER_ID, ROWS } from './constants';
import { MAPS } from './data/maps';
import { TOWERS } from './data/towers';
import { Game } from './game';
import type { ReplayCommand, ReplayResult, ReplayV2 } from './types';
import { GAME_VERSION } from './version';

export interface ReplayCheck extends ReplayResult {
  tick: number;
  hash: string;
  matches: boolean;
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
export function parseReplay(input: unknown, opts: ParseOptions = {}): ReplayV2 {
  const data = typeof input === 'string' ? (JSON.parse(input) as unknown) : input;
  if (!data || typeof data !== 'object' || Array.isArray(data)) fail('kein Objekt');
  const r = data as Record<string, unknown>;
  if (r.format === 1) fail('Replay-Format 1 (Spielversion 0.1.x) wird nicht mehr unterstützt');
  if (r.format !== 2) fail(`format ${String(r.format)} wird nicht unterstützt`);
  const version = opts.version ?? GAME_VERSION;
  if (r.gameVersion !== version) fail(`Spielversion ${String(r.gameVersion)} passt nicht zu ${version}`);
  if (!inRange(r.seed, 0, 0xffffffff)) fail('seed muss uint32 sein');
  if (typeof r.mapId !== 'string' || !MAPS.some((m) => m.id === r.mapId)) fail(`unbekannte Karte ${String(r.mapId)}`);
  if (r.mode !== 'challenge' && r.mode !== 'endless') fail(`unbekannter Modus ${String(r.mode)}`);
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
      ((c[1] === 'upgrade' || c[1] === 'sell') && c.length === 3 && inRange(c[2], 1, MAX_TOWER_ID)) ||
      (c[1] === 'startWave' && c.length === 2);
    if (!ok) fail(`Kommando ${i}: ungültig`);
  }
  const res = r.result as Record<string, unknown> | undefined;
  if (
    !res || typeof res !== 'object' || !isInt(res.score) || !isInt(res.wave) || !isInt(res.lives) ||
    typeof res.over !== 'boolean' || typeof res.won !== 'boolean'
  ) {
    fail('result unvollständig');
  }
  return data as ReplayV2;
}

/** Spielt ein Replay headless nach und vergleicht das Ergebnis mit result. */
export function runReplay(r: ReplayV2): ReplayCheck {
  const game = new Game({ seed: r.seed, mapId: r.mapId, mode: r.mode });
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
  const matches =
    !rejected &&
    s.tick === r.endTick &&
    s.score === r.result.score &&
    s.wave === r.result.wave &&
    s.lives === r.result.lives &&
    s.over === r.result.over &&
    s.won === r.result.won;
  return { score: s.score, wave: s.wave, lives: s.lives, over: s.over, won: s.won, tick: s.tick, hash: game.stateHash(), matches };
}
