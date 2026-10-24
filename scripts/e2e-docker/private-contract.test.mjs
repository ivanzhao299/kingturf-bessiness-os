import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  localCases,
  privateSpecFile,
  safeLocalCases,
  safeLocalResult,
  validateLocalCommand,
} from './private-contract.mjs';
import PrivateReporter from './private-reporter.mjs';

test('local inventory rejects discovery, production, unsafe labels and unknown faults', () => {
  for (const kind of Object.keys(localCases)) validateLocalCommand(kind, 'fixed-label');
  for (const kind of ['production', 'all', '../p1', undefined])
    assert.throws(() => validateLocalCommand(kind, 'fixed-label'));
  for (const label of ['../raw', '', 'a/b', 'UPPER', 'x'.repeat(65)])
    assert.throws(() => validateLocalCommand('p1', label));
  assert.throws(() => validateLocalCommand('p1', 'fixed-label', 'raw-export'));
});

test('fixed private inventory matches original literal local spec declarations', () => {
  for (const [kind, file] of [
    ['p1', 'p1-demo.spec.ts'],
    ['runtime', 'runtime-local.spec.mjs'],
    ['cost', 'cost-matrix-product-quality.spec.ts'],
    ['document', 'document-send-product-quality.spec.ts'],
    ['login', 'login-product-quality.spec.ts'],
    ['order', 'order-evidence-product-quality.spec.ts'],
    ['workspace', 'workspace-route-isolation.spec.ts'],
  ]) {
    const source = readFileSync(new URL(`../../tests/e2e/${file}`, import.meta.url), 'utf8');
    const titles = [...source.matchAll(/\btest\('([^']+)'/gu)].map((match) => match[1]);
    assert.deepEqual(titles, localCases[kind]);
    assert.equal(privateSpecFile(kind), file);
  }
});

test('fixed revocation/startup inventory expands only their original bounded parameter lists', () => {
  const revoke = readFileSync(
    new URL('../../tests/e2e/session-revocation.spec.ts', import.meta.url),
    'utf8',
  );
  assert(revoke.includes('for (const status of [401, 403])'));
  assert(
    revoke.includes(
      'test(`a running workspace handles ${String(status)} without confusing expiry and permission denial`',
    ),
  );
  assert.deepEqual(
    localCases.revocation,
    [401, 403].map(
      (status) =>
        `a running workspace handles ${status} without confusing expiry and permission denial`,
    ),
  );
  assert.equal([...revoke.matchAll(/^\s*test\(/gmu)].length, 1);
  const startup = readFileSync(
    new URL('../../tests/e2e/startup-delivery.spec.ts', import.meta.url),
    'utf8',
  );
  const literals = [...startup.matchAll(/\btest\('([^']+)'/gu)].map((match) => match[1]);
  assert.equal(literals.length, 3);
  assert(startup.includes("for (const extension of ['js', 'css'])"));
  assert(
    startup.includes(
      'test(`a failed business ${extension} retains the session and can recover through explicit page refresh`',
    ),
  );
  assert.equal([...startup.matchAll(/^\s*test\(/gmu)].length, 4);
  assert.deepEqual(localCases.startup, [
    literals[0],
    literals[1],
    ...['js', 'css'].map(
      (extension) =>
        `a failed business ${extension} retains the session and can recover through explicit page refresh`,
    ),
    literals[2],
  ]);
});

test('every added fixed A file requires all original cases and never grants C or discovery entry', () => {
  for (const kind of ['document', 'login', 'order', 'workspace', 'revocation', 'startup']) {
    const cases = localCases[kind].map((_, index) => ({
      index,
      status: 'passed',
      durationMs: 1,
      line: index + 1,
    }));
    const result = {
      exit: 0,
      elapsedMs: 1,
      discovered: cases.length,
      complete: true,
      probe: false,
      cases,
    };
    assert.equal(safeLocalResult(kind, result).cases.length, cases.length);
    assert.throws(() => safeLocalResult(kind, { ...result, cases: cases.slice(0, -1) }));
    assert.throws(() => safeLocalResult(kind, { ...result, complete: false }));
  }
  for (const kind of ['production-readonly', 'production-role-uat', 'all'])
    assert.throws(() => privateSpecFile(kind));
});

test('cost private completion cannot omit either original case or enter production', () => {
  assert.equal(privateSpecFile('cost'), 'cost-matrix-product-quality.spec.ts');
  for (const kind of ['production-readonly', 'production-role-uat', 'all', '../cost'])
    assert.throws(() => privateSpecFile(kind));
  const cases = localCases.cost.map((_, index) => ({
    index,
    status: 'passed',
    durationMs: 1,
    line: index + 1,
  }));
  const result = { exit: 0, elapsedMs: 1, discovered: 2, complete: true, probe: false, cases };
  assert.equal(safeLocalResult('cost', result).cases.length, 2);
  assert.throws(() => safeLocalResult('cost', { ...result, cases: cases.slice(0, 1) }));
  assert.throws(() => safeLocalResult('cost', { ...result, discovered: 1 }));
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
    { index: 0, status: 'failed', durationMs: 1, line: 20, failureLine: 0, phase: 'none' },
  ]);
  assert.throws(() => safeLocalCases('p1', [value, value]));
  for (const invalid of [
    { index: localCases.p1.length },
    { status: 'unknown' },
    { durationMs: -1 },
    { line: 'raw' },
    { failureLine: 'raw' },
    { failureLine: 10_001 },
    { phase: 'FIXED_NON_SECRET_PHASE_CANARY' },
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
      { index: 0, status: 'failed', durationMs: 1, line: 13, failureLine: 61, phase: 'none' },
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
    cases: [{ index: 0, status: 'passed', durationMs: 1, line: 13, failureLine: 0, phase: 'none' }],
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

test('P1 DOM diagnostics accept only fixed phases and never raw annotation text', () => {
  const previous = process.env.KINGTURF_PRIVATE_KIND;
  process.env.KINGTURF_PRIVATE_KIND = 'p1';
  try {
    for (const [description, expected] of [
      ['overview-board-hidden', 'overview-board-hidden'],
      ['FIXED_NON_SECRET_ANNOTATION_CANARY', 'none'],
    ]) {
      const reporter = new PrivateReporter({}, () => {
        /* No filesystem writes in the unit test. */
      });
      reporter.onTestEnd(
        {
          title: localCases.p1[0],
          location: { line: 21 },
          annotations: [{ type: 'private-p1-dom', description }],
        },
        { status: 'failed', duration: 1 },
      );
      assert.equal(reporter.cases[0].phase, expected);
      assert.equal(JSON.stringify(reporter.cases).includes('CANARY'), false);
    }
  } finally {
    if (previous === undefined) delete process.env.KINGTURF_PRIVATE_KIND;
    else process.env.KINGTURF_PRIVATE_KIND = previous;
  }
});
