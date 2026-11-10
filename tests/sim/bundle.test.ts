import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BUNDLE_PATH, bundleSim } from '../../tools/build-sim';

// AC-8 (Spec leaderboard-supabase): Server und Client rechnen mit derselben Simulation.
describe('Sim-Bündel für die Edge-Runtime', () => {
  it('entspricht dem aktuellen src/sim', async () => {
    const fresh = await bundleSim();
    const committed = readFileSync(BUNDLE_PATH, 'utf8');
    expect(committed === fresh, 'Sim-Bündel veraltet – npm run build:sim ausführen').toBe(true);
  }, 30_000);
});
