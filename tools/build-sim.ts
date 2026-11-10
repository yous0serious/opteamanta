import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { build } from 'esbuild';

// Bündelt src/sim für die Supabase-Edge-Runtime (Deno) – Spec leaderboard-supabase T03, ADR-0004.
// Aufruf: npm run build:sim   (Test tests/sim/bundle.test.ts prüft, dass das Bündel aktuell ist)

export const BUNDLE_PATH = 'supabase/functions/_shared/sim.js';
const SRC = 'src/sim';

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? files(p) : [p];
  }).sort();
}

/** Hash über alle Quelldateien der Simulation (Pfad + Inhalt). */
export function sourceHash(): string {
  const h = createHash('sha256');
  for (const f of files(SRC)) h.update(f.split('\\').join('/')).update('\0').update(readFileSync(f)).update('\0');
  return h.digest('hex').slice(0, 16);
}

export async function bundleSim(): Promise<string> {
  const result = await build({
    entryPoints: [join(SRC, 'index.ts')],
    bundle: true,
    format: 'esm',
    platform: 'neutral',
    target: 'es2022',
    minify: false,
    legalComments: 'none',
    write: false,
    banner: { js: `// GENERIERT von npm run build:sim – nicht von Hand ändern. Quelle: src/sim (sha256 ${sourceHash()})` },
  });
  return result.outputFiles[0]!.text;
}

if (process.argv[1]?.endsWith('build-sim.ts')) {
  const code = await bundleSim();
  writeFileSync(BUNDLE_PATH, code);
  console.log(`${BUNDLE_PATH} geschrieben (${(code.length / 1024).toFixed(1)} KB, Quelle ${sourceHash()})`);
}
