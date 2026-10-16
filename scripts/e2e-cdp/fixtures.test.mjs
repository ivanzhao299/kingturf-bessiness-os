import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStubRouter } from './fixtures.mjs';

test('credit/contract opt-in binds only the three reachable read routes and nonempty cards', async () => {
  const original = createStubRouter();
  const agreements = createStubRouter({ creditContractViews: true });
  for (const path of ['/api/v1/credit-limits', '/api/v1/credit-decisions', '/api/v1/contracts']) {
    await assert.rejects(original.respond(path, 'GET'), /unmapped synthetic API request/u);
    await assert.rejects(agreements.respond(path, 'POST'), /unmapped synthetic API request/u);
    assert.equal((await agreements.respond(path, 'GET')).status, 200);
  }
  assert.equal(
    (await agreements.respond('/api/v1/credit-decisions', 'GET')).value.items[0].effectiveStatus,
    'APPROVED',
  );
  const contract = (await agreements.respond('/api/v1/contracts', 'GET')).value.items[0];
  assert.equal(contract.effectiveStatus, 'DRAFT');
  const baseline = (await original.respond('/api/v1/auth/session', 'GET')).value;
  const session = (await agreements.respond('/api/v1/auth/session', 'GET')).value;
  assert.deepEqual(session.permissions.slice(baseline.permissions.length), [
    'credit:read',
    'contract:read',
  ]);
  const combined = createStubRouter({
    salesViews: true,
    pricingViews: true,
    creditContractViews: true,
  });
  assert.equal((await combined.respond('/api/v1/ctrs', 'GET')).value.items[0].code, 'CDP-CTR-A');
  assert.equal(
    (await combined.respond('/api/v1/quotes', 'GET')).value.items[0].quoteNumber,
    'CDP-Q-A',
  );
  await assert.rejects(
    agreements.respond('/api/v1/contract-documents', 'GET'),
    /unmapped synthetic API request/u,
  );
  await assert.rejects(
    agreements.respond('/api/v1/contract-documents/unmapped', 'GET'),
    /unmapped synthetic API request/u,
  );
});

test('pricing opt-in keeps the default empty ledger and adds only policy GET routes', async () => {
  const original = createStubRouter();
  const pricing = createStubRouter({ pricingViews: true });
  for (const path of ['/api/v1/sales-policies', '/api/v1/sales-policy-evaluations']) {
    await assert.rejects(original.respond(path, 'GET'), /unmapped synthetic API request/u);
    await assert.rejects(pricing.respond(path, 'POST'), /unmapped synthetic API request/u);
    assert.equal((await pricing.respond(path, 'GET')).status, 200);
  }
  assert.equal((await original.respond('/api/v1/cost-matrix-summaries', 'GET')).value.total, 0);
  assert.equal((await original.respond('/api/v1/quotes', 'GET')).value.items.length, 0);
  const matrix = (await pricing.respond('/api/v1/cost-matrix-summaries', 'GET')).value;
  assert.equal(matrix.total, 1);
  assert.equal(matrix.items[0].name, 'CDP规格模型甲');
  assert.equal(
    (await pricing.respond('/api/v1/quotes', 'GET')).value.items[0].quoteNumber,
    'CDP-Q-A',
  );
  assert.equal(
    (await pricing.respond('/api/v1/sales-policies', 'GET')).value.items[0].status,
    'PUBLISHED',
  );
  const baseline = (await original.respond('/api/v1/auth/session', 'GET')).value;
  const expanded = (await pricing.respond('/api/v1/auth/session', 'GET')).value;
  assert.deepEqual(expanded.permissions.slice(baseline.permissions.length), ['sales-policy:read']);
  await assert.rejects(
    pricing.respond('/api/v1/sales-policies/unknown', 'GET'),
    /unmapped synthetic API request/u,
  );
});

test('cost hold binds the exact search request, not initial cost fetch or its fulfillment', async () => {
  const router = createStubRouter();
  const hold = router.hold('cost', 'synthetic-search');
  let completed = false;
  void hold.fulfilled.then(() => {
    completed = true;
  });
  const initial = await router.respond('/api/v1/cost-matrix-summaries', 'GET');
  assert.equal(initial.completion, null);
  router.didFulfill(initial.completion);
  await Promise.resolve();
  assert.equal(completed, false);
  const search = router.respond(
    '/api/v1/cost-matrix-summaries',
    'GET',
    new URLSearchParams({ q: 'synthetic-search' }),
  );
  await hold.started;
  hold.release();
  const result = await search;
  assert.equal(result.completion, 'cost');
  router.didFulfill(result.completion);
  await hold.fulfilled;
  assert.equal(completed, true);
});

test('CDP API fixtures are exact GET routes and fail closed for unknown paths and mutations', async () => {
  const router = createStubRouter();
  for (const [path, method] of [
    ['/api/v1/unmapped', 'GET'],
    ['/api/v1/customers', 'POST'],
    ['/api', 'GET'],
  ])
    await assert.rejects(router.respond(path, method), /unmapped synthetic API request/);
  assert.equal((await router.respond('/api/v1/customers', 'GET')).status, 200);
});

test('CDP holds must be explicitly released; detail failure is local synthetic data', async () => {
  const router = createStubRouter();
  const hold = router.hold('detail');
  let settled = false;
  const response = router.respond('/api/v1/customers/cdp-customer-a/360', 'GET').then((value) => {
    settled = true;
    return value;
  });
  await hold.started;
  assert.equal(settled, false);
  hold.release();
  assert.equal((await response).status, 200);
  let fulfilled = false;
  void hold.fulfilled.then(() => {
    fulfilled = true;
  });
  await Promise.resolve();
  assert.equal(fulfilled, false, 'releasing data is not Fetch fulfillment completion');
  router.didFulfill('detail');
  await hold.fulfilled;
  assert.equal(fulfilled, true);
  router.detailFailure(true);
  assert.equal((await router.respond('/api/v1/customers/cdp-customer-a/360', 'GET')).status, 503);
});

test('sales views opt-in adds only three exact GET routes and nonempty synthetic records', async () => {
  const original = createStubRouter();
  const sales = createStubRouter({ salesViews: true });
  for (const path of ['/api/v1/opportunities', '/api/v1/ctrs', '/api/v1/technical-solutions']) {
    await assert.rejects(original.respond(path, 'GET'), /unmapped synthetic API request/u);
    await assert.rejects(sales.respond(path, 'POST'), /unmapped synthetic API request/u);
    const response = await sales.respond(path, 'GET');
    assert.equal(response.status, 200);
    assert.equal(response.value.items.length, 1);
    assert.equal(response.value.nextCursor, null);
  }
  assert.equal((await sales.respond('/api/v1/opportunities', 'GET')).value.items[0].status, 'OPEN');
  assert.equal((await sales.respond('/api/v1/ctrs', 'GET')).value.items[0].status, 'APPROVED');
  assert.equal(
    (await sales.respond('/api/v1/technical-solutions', 'GET')).value.items[0].status,
    'FINAL',
  );
  await assert.rejects(
    sales.respond('/api/v1/technical-solutions/unknown', 'GET'),
    /unmapped synthetic API request/u,
  );
  const originalSession = (await original.respond('/api/v1/auth/session', 'GET')).value;
  const expandedSession = (await sales.respond('/api/v1/auth/session', 'GET')).value;
  assert.equal(originalSession.permissions.includes('opportunity:read'), false);
  assert.deepEqual(expandedSession.permissions.slice(originalSession.permissions.length), [
    'opportunity:read',
    'ctr:read',
    'technical-solution:read',
  ]);
});
