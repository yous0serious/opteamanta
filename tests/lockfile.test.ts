import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Netlify installiert aus dem öffentlichen npm-Registry. Ein lokal konfigurierter Spiegel darf nicht im Lockfile
// landen (sonst hängt `npm install` im Build, und interne Hostnamen gehören nicht ins Repo).
describe('package-lock.json', () => {
  it('löst alle Pakete aus registry.npmjs.org auf', () => {
    const lock = JSON.parse(readFileSync('package-lock.json', 'utf8')) as { packages: Record<string, { resolved?: string }> };
    const foreign = Object.entries(lock.packages)
      .filter(([, p]) => p.resolved && !p.resolved.startsWith('https://registry.npmjs.org/'))
      .map(([name]) => name);
    expect(foreign, 'Lockfile mit fremdem Registry – resolved-URLs auf https://registry.npmjs.org/ umstellen').toEqual([]);
  });
});
