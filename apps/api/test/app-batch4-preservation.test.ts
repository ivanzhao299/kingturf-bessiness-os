import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

type Run = { baseline: string; results: { name: string; [key: string]: unknown }[] };
const root = fileURLToPath(new URL('../../../', import.meta.url));
const probe = fileURLToPath(
  new URL('../../../scripts/analysis/app-preservation-probe.mjs', import.meta.url),
);
const run = (mode: string) =>
  JSON.parse(
    execFileSync(process.execPath, ['--experimental-transform-types', probe, mode], {
      cwd: root,
      encoding: 'utf8',
      maxBuffer: 32 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    }),
  ) as Run;
const baseline = run('baseline');
const current = run('current');
describe('Batch4 app extraction against fixed f3 complete request traces', () => {
  it('retains the frozen baseline and every scenario', () => {
    expect(current.baseline).toBe('f3f0c42aa8493f594076c03d3270f0c21de7ba78');
    expect(current.results.map((r) => r.name)).toEqual(baseline.results.map((r) => r.name));
    expect(current.results).toHaveLength(310);
  });
  for (const [index, row] of baseline.results.entries())
    it(row.name, () => {
      expect(current.results[index]).toEqual(row);
    });
});
