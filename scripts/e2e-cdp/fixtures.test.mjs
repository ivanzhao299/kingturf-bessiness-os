import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStubRouter } from './fixtures.mjs';

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
