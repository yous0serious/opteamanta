import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

// Prüft public/assets gegen CREDITS.md (Spec visual-overhaul AC-2). Exit 1 bei Verstoß.
const DIR = 'public/assets';
const MAX_BYTES = 3 * 1024 * 1024;
const LICENSES = ['CC0', 'OFL-1.1', 'eigenes Werk'];

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

const credits = readFileSync(join(DIR, 'CREDITS.md'), 'utf8');
const rows = credits.split('\n').filter((l) => l.startsWith('| `'));
const errors: string[] = [];
let total = 0;

for (const file of walk(DIR)) {
  const rel = relative(DIR, file).split('\\').join('/');
  if (rel === 'CREDITS.md') continue;
  total += statSync(file).size;
  const row = rows.find((r) => r.startsWith(`| \`${rel}\``));
  if (!row) errors.push(`${rel}: fehlt in CREDITS.md`);
  else if (!LICENSES.some((l) => row.includes(l))) errors.push(`${rel}: keine zulässige Lizenz (${LICENSES.join(', ')})`);
}
if (total > MAX_BYTES) errors.push(`Grafik-Assets ${(total / 1024 / 1024).toFixed(2)} MB > 3 MB`);

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log(`check:assets ok – ${rows.length} Einträge, ${(total / 1024).toFixed(0)} KB`);
