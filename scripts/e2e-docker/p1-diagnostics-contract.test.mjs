import assert from 'node:assert/strict';
import test from 'node:test';
import {
  diagnosticFields,
  diagnosticRequestAllowed,
  safeDiagnostic,
  safeDiagnosticResult,
} from './p1-diagnostics-contract.mjs';
import { validateLocalCommand } from './private-contract.mjs';

const sample = (id) =>
  Object.fromEntries(
    Object.entries(diagnosticFields[id]).map(([key, type]) => [
      key,
      type === 'boolean' ? false : 0,
    ]),
  );

test('only exact fixed boolean and bounded count observations can cross the diagnostic boundary', () => {
  for (const id of Object.keys(diagnosticFields))
    assert.deepEqual(safeDiagnostic(id, sample(id)), sample(id));
  assert.throws(() => safeDiagnostic('FIXED_NON_SECRET_CANARY', {}));
  assert.throws(() => safeDiagnostic(['credit'], sample('credit')));
  const valid = sample('credit');
  assert.throws(() => safeDiagnostic('credit', { ...valid, raw: 'FIXED_NON_SECRET_CANARY' }));
  const missing = { ...valid };
  delete missing.cards;
  assert.throws(() => safeDiagnostic('credit', missing));
  for (const cards of [-1, 1001, 1.5, NaN, Infinity, true, 'FIXED_NON_SECRET_CANARY'])
    assert.throws(() => safeDiagnostic('credit', { ...valid, cards }));
  for (const approvedExposure0 of [null, 0, 'FIXED_NON_SECRET_CANARY', {}])
    assert.throws(() => safeDiagnostic('credit', { ...valid, approvedExposure0 }));
});

test('completion requires observed fixed diagnostics and actual successful browser close, not original P1 cases', () => {
  const observed = Object.keys(diagnosticFields);
  const valid = { exit: 0, complete: true, browserClosed: true, elapsedMs: 1, observed };
  assert.deepEqual(
    safeDiagnosticResult({ ...valid, raw: 'FIXED_NON_SECRET_CANARY' }, observed),
    valid,
  );
  for (const invalid of [
    { exit: 1 },
    { complete: false },
    { browserClosed: false },
    { elapsedMs: -1 },
    { observed: [] },
  ])
    assert.throws(() => safeDiagnosticResult({ ...valid, ...invalid }, observed));
  assert.throws(() => safeDiagnosticResult(valid, []));
  assert.throws(() => safeDiagnosticResult(valid, [...observed, observed[0]]));
  assert.equal(JSON.stringify(safeDiagnosticResult(valid, observed)).includes('CANARY'), false);
});

test('read-only diagnostic requests allow only exact loopback reads and natural browser login', () => {
  const origin = 'http://127.0.0.1:4173';
  assert(diagnosticRequestAllowed(origin + '/api/v1/customers', 'GET'));
  assert(diagnosticRequestAllowed(origin + '/api/v1/auth/login', 'POST'));
  for (const [address, method] of [
    [origin + '/api/v1/customers', 'POST'],
    [origin + '/api/v1/customers', 'DELETE'],
    [origin + '/api/v1/auth/login?unexpected=1', 'POST'],
    ['https://foreign.example.invalid/api/v1/auth/login', 'POST'],
    ['http://127.0.0.1:3000/api/v1/customers', 'GET'],
    ['http://synthetic@127.0.0.1:4173/api/v1/auth/login', 'POST'],
    ['invalid', 'GET'],
  ])
    assert.equal(diagnosticRequestAllowed(address, method), false);
});

test('diagnostic mode is a separately authorized P1-only command, never a runtime or production mode', () => {
  validateLocalCommand('p1', 'fixed-diagnostic', 'diagnostics');
  assert.throws(() => validateLocalCommand('runtime', 'fixed-diagnostic', 'diagnostics'));
  assert.throws(() => validateLocalCommand('production', 'fixed-diagnostic', 'diagnostics'));
});
