import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStubRouter } from './fixtures.mjs';
import { withBoundaryParserFixtures } from './boundary-fixtures.mjs';
import { operationsPermissions, operationsRoutes } from './operations-fixtures.mjs';
import { withRegisterTools } from './register-fixtures.mjs';
import {
  governancePermissions,
  governancePaths,
  governanceSurfaces,
  withGovernanceView,
} from './governance-fixtures.mjs';
import {
  documentEditorId,
  documentEditorRoutes,
  withDocumentEditor,
} from './document-editor-fixtures.mjs';

test('lazy fixtures are opt-in and hold only the first mapped solutions response', async () => {
  const originalArguments = [...process.argv];
  const original = createStubRouter({ salesViews: true });
  assert.throws(() => original.hold('solutions'), /invalid synthetic hold/u);
  assert.throws(() => original.lazyQuoteFailure(true), /not enabled/u);
  process.argv.push('--lazy-routes');
  const router = createStubRouter({ salesViews: true });
  try {
    const held = router.hold('solutions');
    const first = router.respond('/api/v1/technical-solutions', 'GET');
    await held.started;
    const second = await router.respond('/api/v1/technical-solutions', 'GET');
    assert.equal(second.value.items[0].code, 'CDP-TS-A');
    held.release();
    const stale = await first;
    assert.equal(stale.value.items[0].code, 'CDP-TS-OLD-LAZY');
    assert.deepEqual(second, await original.respond('/api/v1/technical-solutions', 'GET'));
    await assert.rejects(router.respond('/api/v1/technical-solutions', 'POST'), /unmapped/u);
    await assert.rejects(router.respond('/api/v1/unknown-lazy', 'GET'), /unmapped/u);
  } finally {
    router.releaseAll();
    process.argv.splice(0, process.argv.length, ...originalArguments);
  }
});

test('lazy quote failure is an exact mapped 503 response and restores the original payload', async () => {
  const originalArguments = [...process.argv];
  const original = createStubRouter();
  process.argv.push('--lazy-routes');
  const router = createStubRouter();
  try {
    router.lazyQuoteFailure(true);
    assert.equal((await router.respond('/api/v1/quotes', 'GET')).status, 503);
    assert.deepEqual(
      await router.respond('/api/v1/customers', 'GET'),
      await original.respond('/api/v1/customers', 'GET'),
    );
    router.lazyQuoteFailure(false);
    assert.deepEqual(
      await router.respond('/api/v1/quotes', 'GET'),
      await original.respond('/api/v1/quotes', 'GET'),
    );
    await assert.rejects(router.respond('/api/v1/quotes', 'POST'), /unmapped/u);
  } finally {
    process.argv.splice(0, process.argv.length, ...originalArguments);
  }
});

test('customer 360 fixture includes the server-required unavailable section array', async () => {
  const router = createStubRouter();
  const response = await router.respond('/api/v1/customers/cdp-customer-a/360', 'GET');
  assert.equal(response.status, 200);
  assert.equal(Array.isArray(response.value.unavailableSections), true);
  assert.deepEqual(response.value.unavailableSections, ['orders', 'finance']);
});

test('boundary overlay changes only a mapped quote response and cannot authorize writes or unknown routes', async () => {
  const original = createStubRouter();
  const overlay = withBoundaryParserFixtures(createStubRouter());
  assert.deepEqual(
    await overlay.respond('/api/v1/quotes', 'GET'),
    await original.respond('/api/v1/quotes', 'GET'),
  );
  overlay.boundaryQuoteFailure(true);
  const malformed = await overlay.respond('/api/v1/quotes', 'GET');
  assert.equal(malformed.status, 200);
  assert.deepEqual(malformed.value, { items: 'malformed-synthetic-list' });
  assert.deepEqual(
    await overlay.respond('/api/v1/customers', 'GET'),
    await original.respond('/api/v1/customers', 'GET'),
  );
  await assert.rejects(overlay.respond('/api/v1/quotes', 'POST'), /unmapped/u);
  await assert.rejects(overlay.respond('/api/v1/unknown-boundary', 'GET'), /unmapped/u);
  overlay.boundaryQuoteFailure(false);
  assert.deepEqual(
    await overlay.respond('/api/v1/quotes', 'GET'),
    await original.respond('/api/v1/quotes', 'GET'),
  );
});

test('governance overlay supplies exact read surfaces, coherent metrics and the employee array DTO', async () => {
  const original = createStubRouter();
  const overlay = withGovernanceView(createStubRouter());
  const baseline = (await original.respond('/api/v1/auth/session', 'GET')).value;
  const expanded = (await overlay.respond('/api/v1/auth/session', 'GET')).value;
  assert.deepEqual(expanded.permissions, [
    ...new Set([...baseline.permissions, ...governancePermissions]),
  ]);
  assert.deepEqual(
    (await original.respond('/api/v1/auth/session', 'GET')).value.permissions,
    baseline.permissions,
  );
  assert.equal(governanceSurfaces.length, 11);
  assert.equal(new Set(governancePaths).size, 20);
  let records = 0;
  for (const path of governancePaths) {
    const response = await overlay.respond(path, 'GET');
    assert.equal(response.status, 200);
    records += Array.isArray(response.value) ? response.value.length : 1;
    assert.equal(overlay.counts()[`governance:${path}`], 1);
  }
  assert.equal(records, 49);
  assert.equal(overlay.counts().organizations, 1);
  assert.equal(Array.isArray((await overlay.respond('/api/v1/employees', 'GET')).value), true);
  assert.equal(
    (await overlay.respond('/api/v1/notifications/unread-count', 'GET')).value.unreadCount,
    3,
  );
});

test('governance overlay refuses writes, unknown paths and nonempty queries without changing defaults', async () => {
  const original = createStubRouter();
  const overlay = withGovernanceView(createStubRouter());
  await assert.rejects(original.respond('/api/v1/audit-events', 'GET'), /unmapped/u);
  for (const path of governancePaths) {
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE'])
      await assert.rejects(overlay.respond(path, method), /unmapped/u);
    for (const query of ['q=unknown', 'limit=1'])
      await assert.rejects(overlay.respond(path, 'GET', new URLSearchParams(query)), /unmapped/u);
  }
  for (const path of ['/api/v1/roles/unknown', '/api/v1/role', '/api/v1/unmapped-governance'])
    await assert.rejects(overlay.respond(path, 'GET'), /unmapped/u);
  assert.equal(Object.keys(overlay.counts()).length, 0);
});

test('document editor overlay adds one read grant and exact read-only route-bound fixtures', async () => {
  const original = createStubRouter({ salesViews: true });
  const overlay = withDocumentEditor(createStubRouter({ salesViews: true }));
  const baseline = (await original.respond('/api/v1/auth/session', 'GET')).value;
  assert.deepEqual((await overlay.respond('/api/v1/auth/session', 'GET')).value.permissions, [
    ...baseline.permissions,
    'business-document:read',
  ]);
  for (const route of documentEditorRoutes) {
    const result = await overlay.respond(
      '/api/v1/business-documents',
      'GET',
      new URLSearchParams({ route }),
    );
    assert.equal(result.value.items.length, route === 'opportunities' ? 1 : 0);
  }
  const document = (await overlay.respond(`/api/v1/business-documents/${documentEditorId}`, 'GET'))
    .value;
  assert.equal(document.currentVersion, 2);
  assert.deepEqual(
    document.versions.map((version) => version.version),
    [1, 2],
  );
  assert.equal(document.translations[0].status, 'READY');
  assert.equal(overlay.counts().documentDetail, 1);
});

test('document editor overlay refuses writes, wrong IDs, queries and reference-data reads', async () => {
  const overlay = withDocumentEditor(createStubRouter({ salesViews: true }));
  for (const path of [
    '/api/v1/business-documents',
    `/api/v1/business-documents/${documentEditorId}`,
    `/api/v1/business-documents/${documentEditorId}/versions`,
    '/api/v1/business-documents/reference-data',
  ])
    await assert.rejects(overlay.respond(path, 'POST'), /unmapped/u);
  for (const path of [
    `/api/v1/business-documents/${documentEditorId}/versions`,
    '/api/v1/business-documents/reference-data',
    '/api/v1/business-documents/unknown',
  ])
    await assert.rejects(overlay.respond(path, 'GET'), /unmapped/u);
  for (const query of [
    new URLSearchParams(),
    new URLSearchParams({ route: 'unknown' }),
    new URLSearchParams({ route: 'opportunities', extra: '1' }),
  ])
    await assert.rejects(overlay.respond('/api/v1/business-documents', 'GET', query), /unmapped/u);
  await assert.rejects(
    overlay.respond(
      `/api/v1/business-documents/${documentEditorId}`,
      'GET',
      new URLSearchParams({ extra: '1' }),
    ),
    /unmapped/u,
  );
});

test('register overlay preserves default fixtures and grants while adding twelve unique local rows', async () => {
  const original = createStubRouter();
  const overlay = withRegisterTools(createStubRouter());
  assert.equal((await original.respond('/api/v1/quotes', 'GET')).value.items.length, 0);
  const rows = (await overlay.respond('/api/v1/quotes', 'GET')).value.items;
  assert.equal(rows.length, 12);
  assert.equal(new Set(rows.map((row) => row.id)).size, 12);
  assert.equal(new Set(rows.map((row) => row.total)).size, 12);
  assert.deepEqual(
    (await overlay.respond('/api/v1/auth/session', 'GET')).value,
    (await original.respond('/api/v1/auth/session', 'GET')).value,
  );
  assert.equal(overlay.counts().quotes, 1);
});

test('register overlay delegates unknown/write rejection and binds an exact unpaged quote GET', async () => {
  const overlay = withRegisterTools(createStubRouter({ pricingViews: true }));
  const original = createStubRouter({ pricingViews: true });
  await assert.rejects(overlay.respond('/api/v1/quotes', 'POST'), /unmapped/u);
  await assert.rejects(overlay.respond('/api/v1/unknown', 'GET'), /unmapped/u);
  await assert.rejects(
    overlay.respond('/api/v1/quotes', 'GET', new URLSearchParams({ page: '2' })),
    /unmapped/u,
  );
  assert.deepEqual(
    (await overlay.respond('/api/v1/quotes', 'GET')).value.items[0],
    (await original.respond('/api/v1/quotes', 'GET')).value.items[0],
  );
});

test('dashboard opt-in binds its actual yearly query, one read grant and nonempty drilldowns', async () => {
  const original = createStubRouter();
  const dashboard = createStubRouter({ dashboardView: true });
  const year = new Date().getUTCFullYear();
  const query = new URLSearchParams({
    from: `${String(year)}-01-01T00:00:00.000Z`,
    to: `${String(year + 1)}-01-01T00:00:00.000Z`,
    currency: 'CNY',
  });
  const path = '/api/v1/executive-dashboard';
  await assert.rejects(original.respond(path, 'GET', query), /unmapped synthetic API request/u);
  await assert.rejects(dashboard.respond(path, 'POST', query), /unmapped synthetic API request/u);
  for (const wrong of [
    new URLSearchParams(),
    new URLSearchParams({ ...Object.fromEntries(query), currency: 'USD' }),
    new URLSearchParams([...query, ['extra', '1']]),
  ])
    await assert.rejects(dashboard.respond(path, 'GET', wrong), /unmapped synthetic API request/u);
  const result = await dashboard.respond(path, 'GET', query);
  assert.equal(result.value.drilldowns.orders.length, 1);
  assert.equal(result.value.drilldowns.risks.length, 1);
  const baseline = (await original.respond('/api/v1/auth/session', 'GET')).value;
  assert.deepEqual(
    (await dashboard.respond('/api/v1/auth/session', 'GET')).value.permissions.slice(
      baseline.permissions.length,
    ),
    ['executive-dashboard:read'],
  );
});

test('operations opt-in binds seventeen exact read routes and twelve read permissions only', async () => {
  const original = createStubRouter();
  const operations = createStubRouter({ operationsViews: true });
  assert.equal(operationsRoutes.length, 17);
  assert.equal(operationsPermissions.length, 12);
  assert.equal(
    operationsPermissions.every((permission) => permission.endsWith(':read')),
    true,
  );
  for (const [path] of operationsRoutes) {
    const query = new URLSearchParams(path.endsWith('/complaints') ? 'limit=100' : '');
    await assert.rejects(original.respond(path, 'GET', query), /unmapped synthetic API request/u);
    await assert.rejects(
      operations.respond(path, 'POST', query),
      /unmapped synthetic API request/u,
    );
    const response = await operations.respond(path, 'GET', query);
    assert.equal(response.value.items.length, 1);
    assert.equal(response.value.nextCursor, null);
    await assert.rejects(
      operations.respond(path, 'GET', new URLSearchParams('unknown=1')),
      /unmapped synthetic API request/u,
    );
  }
  for (const query of ['', 'limit=99', 'limit=100&cursor=unexpected', 'limit=100&unknown=1'])
    await assert.rejects(
      operations.respond('/api/v1/complaints', 'GET', new URLSearchParams(query)),
      /unmapped synthetic API request/u,
    );
  const baseline = (await original.respond('/api/v1/auth/session', 'GET')).value;
  const expanded = (await operations.respond('/api/v1/auth/session', 'GET')).value;
  assert.deepEqual(expanded.permissions.slice(baseline.permissions.length), operationsPermissions);
  const run = await operations.respond('/api/v1/mrp-runs', 'GET');
  assert.equal(run.value.items[0].proposals.length, 1);
  const plans = await operations.respond('/api/v1/quality-plans', 'GET');
  assert.equal(plans.value.items[0].inspectionStage, 'FINAL');
  await assert.rejects(
    operations.respond('/api/v1/ncrs/unmapped', 'GET'),
    /unmapped synthetic API request/u,
  );
});

test('finance/risk opt-in binds eight read routes, exact pagination and no writes', async () => {
  const original = createStubRouter();
  const finance = createStubRouter({ financeRiskViews: true });
  const routes = [
    '/api/v1/ar-open-items',
    '/api/v1/collection-cases',
    '/api/v1/bank-payments',
    '/api/v1/reconciliation-runs',
    '/api/v1/commission-policies',
    '/api/v1/commissions',
    '/api/v1/risk-policies',
    '/api/v1/risk-evaluations',
  ];
  for (const path of routes) {
    const query = new URLSearchParams(
      ['/api/v1/ar-open-items', '/api/v1/bank-payments'].includes(path) ? 'limit=100' : '',
    );
    await assert.rejects(original.respond(path, 'GET', query), /unmapped synthetic API request/u);
    await assert.rejects(finance.respond(path, 'POST', query), /unmapped synthetic API request/u);
    const result = await finance.respond(path, 'GET', query);
    assert.equal(result.status, 200);
    assert.equal(result.value.items.length, 1);
    assert.equal(result.value.nextCursor, null);
  }
  for (const query of ['', 'limit=99', 'limit=100&cursor=unexpected', 'limit=100&unknown=1'])
    await assert.rejects(
      finance.respond('/api/v1/ar-open-items', 'GET', new URLSearchParams(query)),
      /unmapped synthetic API request/u,
    );
  const baseline = (await original.respond('/api/v1/auth/session', 'GET')).value;
  assert.deepEqual(
    (await finance.respond('/api/v1/auth/session', 'GET')).value.permissions.slice(
      baseline.permissions.length,
    ),
    [
      'ar:read',
      'collection:read',
      'bank-payment:read',
      'reconciliation:read',
      'commission-policy:read',
      'commission:read',
      'risk-policy:read',
      'risk:read',
    ],
  );
  await assert.rejects(
    finance.respond('/api/v1/risk-tasks/unmapped', 'GET'),
    /unmapped synthetic API request/u,
  );
});

test('fulfillment opt-in adds only exact read routes and immutable synthetic evidence', async () => {
  const original = createStubRouter();
  const fulfillment = createStubRouter({ fulfillmentViews: true });
  const routes = [
    '/api/v1/sales-orders',
    '/api/v1/sales-orders/cdp-order-a/360',
    '/api/v1/production-orders',
    '/api/v1/production-cost-policies',
    '/api/v1/production-cost-runs',
    '/api/v1/shipment-releases',
  ];
  for (const path of routes) {
    await assert.rejects(original.respond(path, 'GET'), /unmapped synthetic API request/u);
    await assert.rejects(fulfillment.respond(path, 'POST'), /unmapped synthetic API request/u);
    assert.equal((await fulfillment.respond(path, 'GET')).status, 200);
  }
  const baseline = (await original.respond('/api/v1/auth/session', 'GET')).value;
  const session = (await fulfillment.respond('/api/v1/auth/session', 'GET')).value;
  assert.deepEqual(session.permissions.slice(baseline.permissions.length), [
    'sales-order:read',
    'order-360:read',
    'production:read',
    'manufacturing-cost:read',
    'shipment:read',
  ]);
  assert.equal(
    (await fulfillment.respond('/api/v1/production-orders', 'GET')).value.items[0].state,
    'DRAFT',
  );
  assert.equal(
    (await fulfillment.respond('/api/v1/sales-orders/cdp-order-a/360', 'GET')).value.timeline
      .length,
    1,
  );
  await assert.rejects(
    fulfillment.respond('/api/v1/sales-orders/unknown/360', 'GET'),
    /unmapped synthetic API request/u,
  );
  const combined = createStubRouter({
    salesViews: true,
    pricingViews: true,
    creditContractViews: true,
    fulfillmentViews: true,
  });
  assert.equal(
    (await combined.respond('/api/v1/contracts', 'GET')).value.items[0].contractNumber,
    'CDP-C-A',
  );
});

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
