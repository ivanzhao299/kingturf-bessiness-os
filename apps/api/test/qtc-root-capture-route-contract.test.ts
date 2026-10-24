// Immutable old c7833e7 reports, captured before fixing the 7251b08 regression.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

type Report = Readonly<{ name: string; [key: string]: unknown }>;
type Reports = Readonly<{
  baseline: string;
  regressionStart: string;
  reports: readonly Report[];
}>;
const golden = JSON.parse(
  readFileSync(new URL('./fixtures/qtc-root-capture-baseline.json', import.meta.url), 'utf8'),
) as Reports;
const probe = fileURLToPath(
  new URL('../../../scripts/analysis/qtc-root-capture-probe.mjs', import.meta.url),
);
const cwd = fileURLToPath(new URL('../../../', import.meta.url));
function run(target: 'old' | 'current'): Reports {
  const output = execFileSync(process.execPath, ['--experimental-transform-types', probe, target], {
    cwd,
    encoding: 'utf8',
    maxBuffer: 8 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return JSON.parse(output) as Reports;
}
it('fixed old reference and all twelve canonical entries; no skipped scenarios', () => {
  expect(golden.baseline).toBe('c7833e7');
  expect(golden.regressionStart).toBe('7251b08');
  expect(golden.reports).toHaveLength(166);
  expect(new Set(golden.reports.map((r) => r.name.split(' / ')[0])).size).toBe(12);
});
for (const target of ['old', 'current'] as const) {
  const actual = run(target);
  describe(target + ' QTC root capture against immutable old baseline', () => {
    it('same fixed baseline, scenario names and cardinality', () => {
      expect(actual.baseline).toBe(golden.baseline);
      expect(actual.regressionStart).toBe(golden.regressionStart);
      expect(actual.reports.map((r) => r.name)).toEqual(golden.reports.map((r) => r.name));
    });
    for (const [index, expected] of golden.reports.entries()) {
      it(expected.name, () => {
        expect(actual.reports[index]).toEqual(expected);
      });
    }
  });
}
