import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { writeFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';

// AC-2: jede Datei unter public/assets/ muss in CREDITS.md stehen.
function runCheck(): number {
  try {
    execFileSync('npm', ['run', '--silent', 'check:assets'], { cwd: process.cwd(), stdio: 'pipe' });
    return 0;
  } catch (e) {
    return (e as { status?: number }).status ?? 1;
  }
}

describe('asset credits (AC-2)', () => {
  it('check:assets passes for the current assets', () => {
    expect(runCheck()).toBe(0);
  });

  it('check:assets fails when an uncredited file is present', () => {
    const dummy = join(process.cwd(), 'public/assets/__dummy-uncredited.png');
    writeFileSync(dummy, 'x');
    try {
      expect(runCheck()).not.toBe(0);
    } finally {
      unlinkSync(dummy);
    }
  });
});
