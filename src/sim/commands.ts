import type { Command, ReplayCommand } from './types';

export function toReplayCommand(tick: number, cmd: Command): ReplayCommand {
  switch (cmd.type) {
    case 'place':
      return [tick, 'place', cmd.tower, cmd.cx, cmd.cy];
    case 'upgrade':
      return [tick, 'upgrade', cmd.towerId];
    case 'sell':
      return [tick, 'sell', cmd.towerId];
    case 'startWave':
      return [tick, 'startWave'];
  }
}

export function fromReplayCommand(rc: ReplayCommand): Command {
  switch (rc[1]) {
    case 'place':
      return { type: 'place', tower: rc[2], cx: rc[3], cy: rc[4] };
    case 'upgrade':
      return { type: 'upgrade', towerId: rc[2] };
    case 'sell':
      return { type: 'sell', towerId: rc[2] };
    case 'startWave':
      return { type: 'startWave' };
  }
}
