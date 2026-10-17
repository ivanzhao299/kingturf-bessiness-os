import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  localCases,
  safeLocalCases,
  safeLocalResult,
  validateLocalCommand,
} from './private-contract.mjs';
import PrivateReporter from './private-reporter.mjs';

test('local inventory rejects discovery, production, unsafe labels and unknown faults', () => {
  for (const kind of ['p1', 'runtime']) validateLocalCommand(kind, 'fixed-label');
  for (const kind of ['production', 'all', '../p1', undefined])
    assert.throws(() => validateLocalCommand(kind, 'fixed-label'));
  for (const label of ['../raw', '', 'a/b', 'UPPER', 'x'.repeat(65)])
    assert.throws(() => validateLocalCommand('p1', label));
  assert.throws(() => validateLocalCommand('p1', 'fixed-label', 'raw-export'));
});

test('fixed private inventory matches both original local spec declarations', () => {
  for (const [kind, file] of [
    ['p1', 'p1-demo.spec.ts'],
    ['runtime', 'runtime-local.spec.mjs'],
  ]) {
    const source = readFileSync(new URL(`../../tests/e2e/${file}`, import.meta.url), 'utf8');
    const titles = [...source.matchAll(/\btest\('([^']+)'/gu)].map((match) => match[1]);
    assert.deepEqual(titles, localCases[kind]);
  }
});

test('result boundary re-encodes only bounded scalar fields', () => {
  const value = {
    index: 0,
    status: 'failed',
    durationMs: 1,
    line: 20,
    error: 'FIXED_NON_SECRET_ERROR_CANARY',
    title: 'FIXED_NON_SECRET_TITLE_CANARY',
    attachments: [{ body: 'FIXED_NON_SECRET_ATTACHMENT_CANARY' }],
  };
  assert.deepEqual(safeLocalCases('p1', [value]), [
    { index: 0, status: 'failed', durationMs: 1, line: 20, failureLine: 0 },
  ]);
  assert.throws(() => safeLocalCases('p1', [value, value]));
  for (const invalid of [
    { index: localCases.p1.length },
    { status: 'unknown' },
    { durationMs: -1 },
    { line: 'raw' },
    { failureLine: 'raw' },
    { failureLine: 10_001 },
  ])
    assert.throws(() => safeLocalCases('p1', [{ ...value, ...invalid }]));
});

test('reporter records inventory index without raw errors, titles or attachments', () => {
  const previous = process.env.KINGTURF_PRIVATE_KIND;
  process.env.KINGTURF_PRIVATE_KIND = 'runtime';
  try {
    const writes = [];
    const reporter = new PrivateReporter({}, (_path, data) => {
      writes.push(JSON.parse(data));
    });
    reporter.onTestEnd(
      { title: localCases.runtime[0], location: { line: 13 } },
      {
        status: 'failed',
        duration: 1.4,
        errors: ['FIXED_NON_SECRET_CANARY'],
        error: { location: { file: '/work/tests/e2e/runtime-local.spec.mjs', line: 61 } },
        attachments: [],
      },
    );
    assert.deepEqual(reporter.cases, [
      { index: 0, status: 'failed', durationMs: 1, line: 13, failureLine: 61 },
    ]);
    assert.equal(writes[0].complete, false);
    assert.equal(JSON.stringify(writes).includes('CANARY'), false);
    const foreign = new PrivateReporter({}, () => {
      /* No filesystem writes in the unit test. */
    });
    foreign.onTestEnd(
      { title: localCases.runtime[0], location: { line: 13 } },
      {
        status: 'failed',
        duration: 1,
        error: { location: { file: '/tmp/FIXED_NON_SECRET_CANARY', line: 61 } },
      },
    );
    assert.equal(foreign.cases[0].failureLine, 0);
    reporter.onTestEnd({ title: 'unknown' }, {});
    assert.equal(reporter.invalid, true);
  } finally {
    if (previous === undefined) delete process.env.KINGTURF_PRIVATE_KIND;
    else process.env.KINGTURF_PRIVATE_KIND = previous;
  }
});

test('Playwright options are not mistaken for the reporter filesystem writer', () => {
  const reporter = new PrivateReporter({});
  assert.equal(typeof reporter.writer, 'function');
});

test('zero exit cannot hide missing discovery, completion, cases or failed outcomes', () => {
  const valid = {
    exit: 0,
    elapsedMs: 1,
    discovered: 1,
    complete: true,
    probe: false,
    cases: [{ index: 0, status: 'passed', durationMs: 1, line: 13, failureLine: 0 }],
  };
  assert.deepEqual(safeLocalResult('runtime', valid), valid);
  for (const invalid of [
    { discovered: 0 },
    { complete: false },
    { cases: [] },
    { cases: [{ ...valid.cases[0], status: 'failed' }] },
    { probe: true },
  ])
    assert.throws(() => safeLocalResult('runtime', { ...valid, ...invalid }));
});
