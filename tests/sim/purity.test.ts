import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? files(p) : p.endsWith('.ts') ? [p] : [];
  });
}

function stripComments(code: string): string {
  return code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
}

const FORBIDDEN: Array<[string, RegExp]> = [
  ['Math.random', /\bMath\s*\.\s*random\b/],
  ['Math.hypot', /\bMath\s*\.\s*hypot\b/],
  ['Math.pow', /\bMath\s*\.\s*pow\b/],
  ['Math.sin', /\bMath\s*\.\s*sin\b/],
  ['Math.cos', /\bMath\s*\.\s*cos\b/],
  ['Math.tan', /\bMath\s*\.\s*tan\b/],
  ['Math.atan2', /\bMath\s*\.\s*atan2\b/],
  ['Math.exp', /\bMath\s*\.\s*exp\b/],
  ['Math.log', /\bMath\s*\.\s*log\b/],
  ['**', /\*\*/],
  ['Date', /\bDate\b/],
  ['performance', /\bperformance\b/],
  ['import phaser', /(from|import)\s*\(?\s*['"]phaser/],
  ['DOM window', /\bwindow\b/],
  ['DOM document', /\bdocument\b/],
  ['DOM navigator', /\bnavigator\b/],
  ['DOM localStorage', /\blocalStorage\b/],
  ['DOM HTMLElement', /\bHTML\w*Element\b/],
];

describe('AC-9 Reinheit von src/sim', () => {
  const list = files('src/sim');
  it('es gibt Dateien', () => {
    expect(list.length).toBeGreaterThanOrEqual(10);
  });
  it.each(FORBIDDEN)('keine Verwendung von %s', (_name, re) => {
    const offenders = list.filter((f) => re.test(stripComments(readFileSync(f, 'utf8'))));
    expect(offenders).toEqual([]);
  });
});

describe('AC-9 ESLint-Regel schlägt an', () => {
  const probes: Array<[string, string]> = [
    ['Math.random()', 'export const a = Math.random();\n'],
    ['Math.hypot(1,2)', 'export const a = Math.hypot(1, 2);\n'],
    ['2 ** 3', 'export const a = 2 ** 3;\n'],
    ['Date.now()', 'export const a = Date.now();\n'],
    ["import 'phaser'", "import 'phaser';\nexport const a = 1;\n"],
  ];
  const eslint = new ESLint({ cwd: process.cwd() });
  it.each(probes)(
    '%s ist in src/sim ein Fehler',
    async (_n, code) => {
      const [res] = await eslint.lintText(code, { filePath: 'src/sim/__probe__.ts' });
      expect(res!.messages.filter((m) => m.severity === 2).length).toBeGreaterThanOrEqual(1);
    },
    30000,
  );
  it(
    'sauberer Code ist fehlerfrei',
    async () => {
      const [res] = await eslint.lintText('export const a = Math.sqrt(4) + 1;\n', { filePath: 'src/sim/__probe__.ts' });
      expect(res!.messages.filter((m) => m.severity === 2)).toEqual([]);
    },
    30000,
  );
});
