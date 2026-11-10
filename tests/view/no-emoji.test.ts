import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

// AC-3: keine Emojis im Spielfeld-Rendering (Canvas). Ausnahmen:
// - texts.ts: Original-Witztexte (Ticker im DOM),
// - hud.ts: DOM-Seitenleiste – dort rendert die Systemschrift Emojis normal (Ruling R-8, Spec visual-overhaul).
const ROOT = join(process.cwd(), 'src/view');
const ALLOWED = new Set(['texts.ts', 'hud.ts']);

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

describe('no emoji in src/view (AC-3)', () => {
  it('has no emoji characters and no .emoji access', () => {
    const findings: string[] = [];
    for (const file of walk(ROOT).filter((f) => /\.(ts|tsx|js)$/.test(f))) {
      const rel = relative(ROOT, file);
      if (ALLOWED.has(rel)) continue;
      readFileSync(file, 'utf8')
        .split('\n')
        .forEach((line, i) => {
          if (/\p{Extended_Pictographic}/u.test(line) || /\.emoji\b/.test(line)) {
            findings.push(`src/view/${rel}:${i + 1}: ${line.trim()}`);
          }
        });
    }
    expect(findings).toEqual([]);
  });
});
