import Phaser from 'phaser';
import { COLS, ROWS, TOWER_ORDER, type EnemyType } from '../sim/index';
import type { Controller } from './controller';
import type { FxSettings } from './fx';

// Performance-Szenario (Spec visual-overhaul AC-12): ?bench=1[&fx=low]
// Nur Debug: verändert den Zustand eines lokalen Spiels direkt, nie Replays oder Sim-Regeln.

const WARMUP_MS = 2000;
const MEASURE_MS = 10_000;
const ENEMY_TARGET = 150;
const ENEMY_MIX: EnemyType[] = ['req', 'feat', 'obj'];

export interface BenchResult {
  fx: string;
  towers: number;
  frames: number;
  avgMs: number;
  p95Ms: number;
  renderer: string;
}

export function runBench(ctl: Controller, phaser: Phaser.Game, settings: FxSettings, onDone: (r: BenchResult) => void): void {
  const game = ctl.game;
  const s = game.state;
  s.money = 1e9;
  s.lives = 1e9;
  let i = 0;
  for (let cy = 0; cy < ROWS; cy++) {
    for (let cx = 0; cx < COLS; cx++) {
      // Nächste platzierbare Rolle (Vorstand nur einmal – Limit, Spec season-2)
      let type = TOWER_ORDER[i % TOWER_ORDER.length]!;
      for (let k = 0; k < TOWER_ORDER.length && game.canPlace(type, cx, cy) === 'limit'; k++) type = TOWER_ORDER[++i % TOWER_ORDER.length]!;
      if (game.canPlace(type, cx, cy) !== null) continue;
      const ev = ctl.command({ type: 'place', tower: type, cx, cy });
      const placed = ev.find((e) => e.type === 'placed');
      if (placed?.type === 'placed') {
        ctl.command({ type: 'upgrade', towerId: placed.tower.id });
        ctl.command({ type: 'upgrade', towerId: placed.tower.id });
      }
      i++;
    }
  }
  let n = 0;
  const topUp = (): void => {
    while (s.enemies.length < ENEMY_TARGET) {
      const e = game.spawnEnemy(ENEMY_MIX[n % ENEMY_MIX.length]!, { dist: (n * 37) % Math.floor(game.pathLength - 40) });
      e.hp = e.maxHp = e.baseMaxHp = 1e7;
      n++;
    }
  };
  topUp();

  const frames: number[] = [];
  const t0 = performance.now();
  const onStep = (_t: number, delta: number): void => {
    topUp();
    const now = performance.now() - t0;
    if (now < WARMUP_MS) return;
    if (now < WARMUP_MS + MEASURE_MS) {
      frames.push(delta);
      return;
    }
    phaser.events.off('step', onStep);
    const sorted = [...frames].sort((a, b) => a - b);
    const avg = frames.reduce((a, b) => a + b, 0) / Math.max(1, frames.length);
    const p95 = sorted[Math.floor(sorted.length * 0.95)] ?? 0;
    onDone({
      fx: settings.level,
      towers: s.towers.length,
      frames: frames.length,
      avgMs: Math.round(avg * 100) / 100,
      p95Ms: Math.round(p95 * 100) / 100,
      renderer: phaser.renderer.type === Phaser.WEBGL ? 'webgl' : 'canvas',
    });
  };
  phaser.events.on('step', onStep);
}
