import assert from 'node:assert/strict';
import test from 'node:test';
import { singaporeDate, validateCoverageExemptions } from './coverage-exemptions.mjs';

const path = 'apps/web/src/fixed.ts';
const source = '// coverage-exempt(owned test boundary, until-2026-10-17)\nexport const item = 1;';
const record = {
  debt: 'TD-TEST-001',
  path,
  line: 1,
  reason: 'owned test boundary',
  until: '2026-10-17',
  approval: 'fixed human R7 reference',
};
const ledger = (entry = record, status = '已豁免') =>
  `| TD-TEST-001 | fixture debt | ${status} |\n<!-- coverage-exempt ${JSON.stringify(entry)} -->`;
const sources = (text = source) => [{ path, source: text }];
const today = new Date('2026-10-17T12:00:00Z');

test('coverage exemptions are bidirectional exact metadata, not coverage denominator exclusions', () => {
  assert.deepEqual(validateCoverageExemptions(sources(), ledger(), today), {
    active: 1,
    date: '2026-10-17',
  });
  assert.throws(() => validateCoverageExemptions(sources(), '', today), /missing its ledger/u);
  assert.throws(() => validateCoverageExemptions([], ledger(), today), /mismatch/u);
  assert.throws(
    () => validateCoverageExemptions(sources(), ledger(record, '待处理'), today),
    /已豁免/u,
  );
  assert.throws(
    () => validateCoverageExemptions([], '| TD-TEST-001 | fixture | 已豁免 |', today),
    /missing source/u,
  );
  for (const change of [
    { reason: 'different' },
    { until: '2026-10-18' },
    { line: 2 },
    { path: '../outside.ts' },
    { approval: '' },
  ])
    assert.throws(() =>
      validateCoverageExemptions(sources(), ledger({ ...record, ...change }), today),
    );
});

test('expiry starts on the next Singapore calendar day, including the UTC boundary', () => {
  assert.equal(singaporeDate(new Date('2026-10-17T15:59:59Z')), '2026-10-17');
  validateCoverageExemptions(sources(), ledger(), new Date('2026-10-17T15:59:59Z'));
  assert.throws(
    () => validateCoverageExemptions(sources(), ledger(), new Date('2026-10-17T16:00:00Z')),
    /expired/u,
  );
});

test('real TS comments count but string, template and regexp contents never create exemptions', () => {
  for (const text of [
    'export const text = "// coverage-exempt(fake, until-2026-10-17)";',
    'export const text = `\n// coverage-exempt(fake, until-2026-10-17)\n`;',
    'export const text = `prefix ${1} suffix\n// coverage-exempt(fake, until-2026-10-17)\n`;',
    'export const regex = /coverage-exempt/;',
  ])
    assert.equal(validateCoverageExemptions(sources(text), '', today).active, 0);
  const nested =
    'export function item() {\n// coverage-exempt(owned test boundary, until-2026-10-17)\nreturn 1;\n}';
  assert.equal(
    validateCoverageExemptions(sources(nested), ledger({ ...record, line: 2 }), today).active,
    1,
  );
  const tail = 'export const item = 1;\n// coverage-exempt(owned test boundary, until-2026-10-17)';
  assert.equal(
    validateCoverageExemptions(sources(tail), ledger({ ...record, line: 2 }), today).active,
    1,
  );
});

test('malformed, duplicate and impossible-date exemptions fail closed', () => {
  for (const text of [
    '// coverage-exempt(, until-2026-10-17)',
    '// coverage-exempt(reason)',
    '// coverage-exempt(reason, until-2026-02-30)',
    '// coverage-exempt(reason, until-2026-13-01)',
  ])
    assert.throws(() => validateCoverageExemptions(sources(text), '', today));
  assert.throws(
    () => validateCoverageExemptions(sources(), ledger() + '\n' + ledger(), today),
    /duplicate/u,
  );
  assert.throws(() => validateCoverageExemptions([], '<!-- coverage-exempt broken -->', today));
  assert.throws(
    () => validateCoverageExemptions(sources('export const = ;'), '', today),
    /invalid source/u,
  );
});
