import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  safeSourcePreparation,
  sourceProducerPassed,
  validateSourceFixture,
} from './source-preparation.mjs';
import { localCases, privateSpecFile, safeLocalResult } from './private-contract.mjs';

const sample = () =>
  Object.fromEntries(
    ['denied', 'authorized', 'masked'].flatMap((mode) => [
      [mode, { order: { order_number: 'AUTH-ORDER' } }],
      [
        `${mode}Session`,
        {
          companyId: 'fixed-company',
          employeeId: 'fixed-employee',
          displayName: 'Synthetic actor',
          employeeNumber: null,
          permissions: ['order-360:read'],
        },
      ],
      [`${mode}Collections`, { items: [] }],
    ]),
  );

test('source fixture validation requires exact nine synthetic roots and forbids authentication fields', () => {
  assert.equal(validateSourceFixture(sample()), true);
  for (const key of [
    'token',
    'csrfToken',
    'csrfProof',
    'password',
    'secret',
    'cookie',
    'authorization',
    'generation',
  ]) {
    const value = sample();
    value.denied.nested = { [key]: 'FIXED_NON_SECRET_CANARY' };
    assert.throws(() => validateSourceFixture(value));
  }
  const extra = sample();
  extra.raw = 'FIXED_NON_SECRET_CANARY';
  assert.throws(() => validateSourceFixture(extra));
  const missing = sample();
  delete missing.maskedCollections;
  assert.throws(() => validateSourceFixture(missing));
  const session = sample();
  session.authorizedSession.csrfToken = 'FIXED_NON_SECRET_CANARY';
  assert.throws(() => validateSourceFixture(session));
});

test('only real full 19-case producer success can validate its exact private result file', () => {
  const value = {
    success: true,
    numTotalTests: 19,
    numPassedTests: 19,
    numFailedTests: 0,
    numPendingTests: 0,
    numTodoTests: 0,
    testResults: [
      {
        name: '/work/apps/api/test/authorization-http-postgres.integration.test.ts',
        assertionResults: Array.from({ length: 19 }, () => ({ status: 'passed' })),
      },
    ],
  };
  assert.equal(sourceProducerPassed(value), true);
  for (const changes of [
    { success: false },
    { numPassedTests: 18 },
    { numTotalTests: 20 },
    { numPendingTests: 1 },
    { numTodoTests: 1 },
    { numFailedTests: 1 },
    { testResults: [] },
    { testResults: [{ ...value.testResults[0], name: '/tmp/foreign.test.ts' }] },
    {
      testResults: [
        {
          ...value.testResults[0],
          assertionResults: Array.from({ length: 19 }, () => ({ status: 'skipped' })),
        },
      ],
    },
  ])
    assert.equal(sourceProducerPassed({ ...value, ...changes }), false);
  assert.equal(sourceProducerPassed(undefined), false);
});

test('private source preparation exports only fixed scalar flags, never raw failures or fixture values', () => {
  const value = {
    exit: 0,
    signal: null,
    elapsedMs: 1,
    producerPassed: true,
    fixtureValidated: true,
    ownershipVerified: true,
    stage: 'complete',
  };
  assert.deepEqual(safeSourcePreparation({ ...value, raw: 'FIXED_NON_SECRET_CANARY' }), value);
  for (const changes of [
    { exit: 'raw' },
    { exit: -1 },
    { signal: 'raw' },
    { elapsedMs: -1 },
    { ownershipVerified: 'true' },
  ])
    assert.throws(() => safeSourcePreparation({ ...value, ...changes }));
});

test('fixed source inventory preserves original three modes and requires all UI cases', () => {
  const source = readFileSync(
    new URL('../../tests/e2e/source-nested-authorization.spec.ts', import.meta.url),
    'utf8',
  );
  assert(source.includes("for (const mode of ['denied', 'authorized', 'masked'] as const)"));
  assert(
    source.includes(
      'test(`collection and order evidence reflect independent legal read (${mode})`',
    ),
  );
  assert.deepEqual(
    localCases.source,
    ['denied', 'authorized', 'masked'].map(
      (mode) => `collection and order evidence reflect independent legal read (${mode})`,
    ),
  );
  assert.equal(privateSpecFile('source'), 'source-nested-authorization.spec.ts');
  const cases = localCases.source.map((_, index) => ({
    index,
    status: 'passed',
    durationMs: 1,
    line: index + 1,
  }));
  const result = { exit: 0, elapsedMs: 1, discovered: 3, complete: true, probe: false, cases };
  assert.equal(safeLocalResult('source', result).cases.length, 3);
  assert.throws(() => safeLocalResult('source', { ...result, cases: cases.slice(0, 2) }));
});
