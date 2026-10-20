import assert from 'node:assert/strict';
import test from 'node:test';
import {
  diagnosticFields,
  diagnosticRequestAllowed,
  safeDiagnostic,
  safeDiagnosticResult,
} from './p1-diagnostics-contract.mjs';
import { validateLocalCommand } from './private-contract.mjs';
import { fixedMrp6000Matches, fixedMrpInputMatches } from './mrp-input-diagnostics.mjs';

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

test('MRP diagnostics expose only fixed bounded counts and original condition booleans', () => {
  const valid = {
    proposalCards: 6,
    frozenCards: 3,
    releasedLabels: 6,
    longRangeYarnCards: 1,
    quantity10000Matches: true,
    grossDemand10300Matches: true,
    safetyStock500Matches: true,
    rounded10000Matches: true,
    frozenExplanationNotes: 3,
  };
  assert.deepEqual(safeDiagnostic('mrp', valid), valid);
  assert.throws(() => safeDiagnostic('mrp', { ...valid, raw: 'FIXED_NON_SECRET_CANARY' }));
  const missing = { ...valid };
  delete missing.proposalCards;
  assert.throws(() => safeDiagnostic('mrp', missing));
  for (const proposalCards of [-1, 1001, 1.5, 'FIXED_NON_SECRET_CANARY'])
    assert.throws(() => safeDiagnostic('mrp', { ...valid, proposalCards }));
  assert.throws(() => safeDiagnostic('mrp', { ...valid, quantity10000Matches: 'true' }));
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

test('fixed MRP snapshot inputs query only boolean observations after a read-only transaction barrier', async () => {
  const values = {
    runInputMatches: true,
    demandInputMatches: true,
    calculationInventoryInputMatches: true,
    scheduledReceiptsInputMatches: true,
  };
  const calls = [];
  const client = {
    query: (sql, parameters) => {
      calls.push({ sql, parameters });
      return Promise.resolve({ rows: [values] });
    },
  };
  assert.deepEqual(await fixedMrpInputMatches(client, 'fixed-synthetic-company'), values);
  assert.equal(calls[0].sql, 'SET TRANSACTION READ ONLY');
  assert.deepEqual(calls[1].parameters, ['fixed-synthetic-company']);
  assert.match(calls[1].sql, /mrp_item_calculations/u);
  for (const field of [
    'gross_demand',
    'safety_stock',
    'minimumOrderQuantity',
    'orderMultiple',
    'leadTimeDays',
    'freezeWindowDays',
  ])
    assert(calls[1].sql.includes(field), field);
  assert.equal(calls[1].sql.includes('planned_quantity'), false);
  assert.equal(calls[1].sql.includes('inventory_balances'), false);
  assert.equal(calls[1].sql.includes('fixed-synthetic-company'), false);
  for (const rows of [
    [],
    [{ ...values, raw: 'FIXED_NON_SECRET_CANARY' }],
    [{ ...values, runInputMatches: 'true' }],
  ]) {
    await assert.rejects(() =>
      fixedMrpInputMatches({ query: () => Promise.resolve({ rows }) }, 'fixed-synthetic-company'),
    );
  }
  const valid = {
    ...values,
    quantity6000Matches: true,
    rounded6000Matches: true,
    releasedLabelsInsideCards: 5,
    releasedLabelsOutsideCards: 1,
  };
  assert.deepEqual(safeDiagnostic('mrpInputs', valid), valid);
  assert.throws(() => safeDiagnostic('mrpInputs', { ...valid, quantity: 6000 }));
  assert.throws(() => safeDiagnostic('mrpInputs', { ...valid, releasedLabelsOutsideCards: -1 }));
  assert.throws(() => safeDiagnostic('mrpInputs', { ...valid, quantity6000Matches: '6000' }));
});

test('fixed 6000 observation matches exact numeric paragraph containers, not whole-card concatenation or larger numbers', () => {
  assert.deepEqual(
    fixedMrp6000Matches('建议 6000.000000 · fixed-date', '固定公式；按批量取整为 6000.000000'),
    { quantity6000Matches: true, rounded6000Matches: true },
  );
  for (const number of ['60000', '6000.5', '10000', '60001'])
    assert.deepEqual(
      fixedMrp6000Matches(`建议 ${number} · fixed-date`, `固定公式；按批量取整为 ${number}`),
      { quantity6000Matches: false, rounded6000Matches: false },
    );
  assert.equal(fixedMrp6000Matches(null, null).rounded6000Matches, false);
  assert.equal(fixedMrp6000Matches('', '按批量取整为 6000下一步').rounded6000Matches, false);
});

test('diagnostic mode is a separately authorized P1-only command, never a runtime or production mode', () => {
  validateLocalCommand('p1', 'fixed-diagnostic', 'diagnostics');
  assert.throws(() => validateLocalCommand('runtime', 'fixed-diagnostic', 'diagnostics'));
  assert.throws(() => validateLocalCommand('production', 'fixed-diagnostic', 'diagnostics'));
});
