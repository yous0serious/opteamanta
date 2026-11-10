import { fromReplayCommand } from './commands';
import { MAX_REPLAY_COMMANDS, MAX_REPLAY_TICKS } from './constants';
import { MAPS } from './data/maps';
import { TOWERS } from './data/towers';
import { Game } from './game';
import type { ReplayCommand, ReplayResult, ReplayV1 } from './types';

export interface ReplayCheck extends ReplayResult {
  tick: number;
  hash: string;
  matches: boolean;
}

const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v);

function fail(reason: string): never {
  throw new Error(`Ungültiges Replay: ${reason}`);
}

/** Prüft Struktur und Grenzen eines Replays (nicht das Ergebnis – das macht runReplay). */
export function parseReplay(input: unknown): ReplayV1 {
  const data = typeof input === 'string' ? (JSON.parse(input) as unknown) : input;
  if (!data || typeof data !== 'object') fail('kein Objekt');
  const r = data as Record<string, unknown>;
  if (r.format !== 1) fail(`format ${String(r.format)} wird nicht unterstützt`);
  if (typeof r.gameVersion !== 'string') fail('gameVersion fehlt');
  if (!isInt(r.seed) || r.seed < 0 || r.seed > 0xffffffff) fail('seed muss uint32 sein');
  if (!MAPS.some((m) => m.id === r.mapId)) fail(`unbekannte Karte ${String(r.mapId)}`);
  if (!isInt(r.endTick) || r.endTick < 0 || r.endTick > MAX_REPLAY_TICKS) fail(`endTick außerhalb 0…${MAX_REPLAY_TICKS}`);
  if (!Array.isArray(r.commands)) fail('commands fehlt');
  if (r.commands.length > MAX_REPLAY_COMMANDS) fail(`mehr als ${MAX_REPLAY_COMMANDS} Kommandos`);
  let lastTick = 0;
  for (const [i, c] of r.commands.entries()) {
    if (!Array.isArray(c) || !isInt(c[0]) || c[0] < 0) fail(`Kommando ${i}: Tick fehlt`);
    if (c[0] < lastTick) fail(`Kommando ${i}: Ticks nicht aufsteigend`);
    if (c[0] > (r.endTick as number)) fail(`Kommando ${i}: Tick nach endTick`);
    lastTick = c[0];
    const ok =
      (c[1] === 'place' && c.length === 5 && Object.hasOwn(TOWERS, c[2]) && isInt(c[3]) && isInt(c[4])) ||
      ((c[1] === 'upgrade' || c[1] === 'sell') && c.length === 3 && isInt(c[2])) ||
      (c[1] === 'startWave' && c.length === 2);
    if (!ok) fail(`Kommando ${i}: ungültig`);
  }
  const res = r.result as Record<string, unknown> | undefined;
  if (!res || !isInt(res.score) || !isInt(res.wave) || typeof res.lives !== 'number' || typeof res.over !== 'boolean') {
    fail('result unvollständig');
  }
  return data as ReplayV1;
}

/** Spielt ein Replay headless nach und vergleicht das Ergebnis mit result. */
export function runReplay(r: ReplayV1): ReplayCheck {
  const game = new Game({ seed: r.seed, mapId: r.mapId });
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
    s.over === r.result.over;
  return { score: s.score, wave: s.wave, lives: s.lives, over: s.over, tick: s.tick, hash: game.stateHash(), matches };
}
