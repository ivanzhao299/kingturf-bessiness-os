import { expect, it, vi } from 'vitest';
import { CommercialController } from './bootstrap';
import type { AppRoute } from './shared/navigation';
import type { CommercialApi, CostMatrixPage } from './commercial/types';
import type { CommercialPermission } from './commercial/permissions';
import { readableCommercialSources } from './commercial/store/readable-sources';
import { commercialRoutePlan } from './commercial/store/route-dependencies';
import { attachCommercialReadOwner } from './commercial/store/read-owner';
import { readCommercialRoute } from './commercial/store/route-read';
import { CommercialRouteState } from './commercial/store/route-state';

const path = (name: string) => `/api/v1/${name}`;
const sorted = (names: readonly string[]) => names.map(path).sort();
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (failure: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
function apiStub() {
  return {
    listOpportunities: vi.fn<CommercialApi['listOpportunities']>().mockResolvedValue([]),
    list: vi.fn<CommercialApi['list']>().mockResolvedValue([]),
    get: vi.fn<NonNullable<CommercialApi['get']>>().mockResolvedValue({}),
    submit: vi.fn<CommercialApi['submit']>().mockResolvedValue({}),
    uploadCtrAttachment: vi.fn<CommercialApi['uploadCtrAttachment']>().mockResolvedValue({}),
    command: vi.fn<CommercialApi['command']>().mockResolvedValue({}),
    listCostMatrixSummaries: vi
      .fn<NonNullable<CommercialApi['listCostMatrixSummaries']>>()
      .mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 }),
  };
}
function setup(permissions: readonly CommercialPermission[]) {
  const api = apiStub();
  const controller = new CommercialController(api, new Set(permissions));
  let live = true;
  const owner = attachCommercialReadOwner(controller, () => live);
  const state = new CommercialRouteState(controller, owner);
  return {
    api,
    controller,
    owner,
    state,
    expire: () => {
      live = false;
    },
  };
}
const allPermissions = [
  ...new Set<CommercialPermission>([
    ...readableCommercialSources({ permissions: new Set() }).map(([permission]) => permission),
    'inventory:read',
    'inventory:move',
    'opportunity:read',
    'executive-dashboard:read',
  ]),
];
const matrix: readonly (readonly [AppRoute, readonly string[]])[] = [
  ['opportunities', ['opportunities']],
  ['technical-requirements', ['ctrs', 'opportunities']],
  ['technical-solutions', ['technical-solutions', 'ctrs']],
  [
    'costing',
    [
      'cost-models',
      'cost-matrices',
      'cost-evaluations',
      'technical-solutions',
      'manufacturing-items',
    ],
  ],
  ['sales-policies', ['sales-policies', 'sales-policy-evaluations', 'cost-evaluations']],
  ['quotes', ['quotes', 'ctrs', 'technical-solutions', 'cost-evaluations', 'sales-policies']],
  ['credit-review', ['credit-limits', 'credit-decisions', 'quotes', 'opportunities']],
  ['contracts', ['contracts', 'contract-documents', 'quotes', 'opportunities']],
  ['sales-orders', ['sales-orders', 'quotes', 'credit-decisions', 'contracts', 'opportunities']],
  ['order-360', ['sales-orders', 'risk-policies']],
  ['receivables', ['ar-open-items', 'sales-orders', 'bank-payments', 'collection-cases']],
  ['collections', ['collection-cases', 'ar-open-items']],
  ['payments', ['bank-payments', 'reconciliation-runs']],
  ['commissions', ['commissions', 'commission-policies', 'sales-orders']],
  ['business-risks', ['risk-evaluations', 'risk-policies', 'sales-orders']],
  ['manufacturing-master', ['manufacturing-items', 'manufacturing-boms', 'manufacturing-routings']],
  [
    'procurement',
    [
      'suppliers',
      'procurement-rfqs',
      'supplier-quotes',
      'purchase-orders',
      'goods-receipts',
      'inventory-locations',
      'inventory-balances',
      'manufacturing-items',
      'contract-documents',
    ],
  ],
  ['material-planning', ['mrp-policies', 'mrp-demands', 'mrp-runs', 'manufacturing-items']],
  [
    'production-orders',
    [
      'production-orders',
      'manufacturing-items',
      'manufacturing-routings',
      'inventory-balances',
      'inventory-locations',
      'production-cost-policies',
      'production-cost-runs',
    ],
  ],
  [
    'quality-inspection',
    [
      'quality-plans',
      'quality-inspections',
      'lot-traceability',
      'complaints',
      'complaint-sla-policies',
    ],
  ],
  ['shipments', ['shipment-releases', 'sales-orders', 'production-orders', 'lot-traceability']],
];

it.each(matrix)(
  'keeps the complete %s dependency closure, including transitive choices',
  (route, names) => {
    const { controller } = setup(allPermissions);
    expect(commercialRoutePlan(controller, route).paths.sort()).toEqual(sorted(names));
  },
);

it('keeps overview full-domain dependencies and never promotes missing read permissions', () => {
  const { controller } = setup(allPermissions);
  expect(commercialRoutePlan(controller, 'overview').paths).toHaveLength(45);
  expect(commercialRoutePlan(setup(['quote:read']).controller, 'quotes').paths).toEqual([
    path('quotes'),
  ]);
  expect(commercialRoutePlan(controller, 'customers').paths).toEqual([]);
});

it('loads only missing authorized sources and reuses visited/shared snapshots without return GETs', async () => {
  const { controller, api, state } = setup(['ctr:read', 'technical-solution:read', 'quote:read']);
  await state.load('technical-solutions', () => true);
  const ctrs = controller.views.get(path('ctrs'));
  await state.load('quotes', () => true);
  await state.load('technical-solutions', () => true);
  expect(api.list.mock.calls).toEqual([
    [path('ctrs')],
    [path('technical-solutions')],
    [path('quotes')],
  ]);
  expect(controller.views.get(path('ctrs'))).toBe(ctrs);
  expect(api.listOpportunities).not.toHaveBeenCalled();
  expect(api.get).not.toHaveBeenCalled();
});

it('keeps first failure distinct from empty data and requires an explicit retry', async () => {
  const { api, controller, state } = setup(['quote:read']);
  api.list.mockRejectedValueOnce(new Error('offline'));
  expect((await state.load('quotes', () => true)).state).toBe('error');
  expect(controller.views.has(path('quotes'))).toBe(false);
  expect(state.readyRoutes().has('quotes')).toBe(false);
  expect((await state.load('quotes', () => true)).state).toBe('error');
  expect(api.list).toHaveBeenCalledTimes(1);
  expect((await state.load('quotes', () => true, true)).state).toBe('ready');
  expect(controller.views.get(path('quotes'))).toEqual([]);
  expect(api.list).toHaveBeenCalledTimes(2);
});

it('retries only failed dependencies while retaining successful references', async () => {
  const { api, controller, state } = setup(['ctr:read', 'quote:read']);
  const ctrs = [{ id: 'ctr' }];
  api.list.mockImplementation((url) =>
    url === path('quotes') ? Promise.reject(new Error('offline')) : Promise.resolve(ctrs),
  );
  expect((await state.load('quotes', () => true)).state).toBe('error');
  api.list.mockResolvedValue([{ id: 'quote' }]);
  await state.load('quotes', () => true, true);
  expect(controller.views.get(path('ctrs'))).toBe(ctrs);
  expect(api.list.mock.calls).toEqual([[path('ctrs')], [path('quotes')], [path('quotes')]]);
});

it('does not let a late A visit overwrite B shared sources', async () => {
  const { api, controller, owner } = setup(['quote:read', 'contract:read']);
  const slow = deferred<readonly Record<string, unknown>[]>();
  const newer = [{ id: 'newer' }];
  api.list.mockReturnValueOnce(slow.promise).mockResolvedValue(newer);
  let route: AppRoute = 'quotes';
  const first = readCommercialRoute(controller, owner, 'quotes', () => route === 'quotes');
  await vi.waitFor(() => {
    expect(api.list).toHaveBeenCalledTimes(1);
  });
  route = 'contracts';
  expect((await readCommercialRoute(controller, owner, 'contracts', () => true)).state).toBe(
    'ready',
  );
  slow.resolve([{ id: 'obsolete' }]);
  expect((await first).state).toBe('cancelled');
  expect(controller.views.get(path('quotes'))).toBe(newer);
});

it('rejects an older source lease even when both direct callers remain alive', async () => {
  const { api, controller, owner } = setup(['quote:read']);
  const slow = deferred<readonly Record<string, unknown>[]>();
  const newer = [{ id: 'new' }];
  api.list.mockReturnValueOnce(slow.promise).mockResolvedValue(newer);
  const first = readCommercialRoute(controller, owner, 'quotes', () => true);
  await vi.waitFor(() => {
    expect(api.list).toHaveBeenCalledTimes(1);
  });
  await readCommercialRoute(controller, owner, 'quotes', () => true);
  slow.resolve([{ id: 'old' }]);
  expect((await first).state).toBe('stale');
  expect(controller.views.get(path('quotes'))).toBe(newer);
});

it('waits for an existing public load and adopts its shared values without another read', async () => {
  const { api, controller, state } = setup(['quote:read']);
  const pending = deferred<readonly Record<string, unknown>[]>();
  api.list.mockReturnValueOnce(pending.promise);
  const loading = controller.load();
  const route = state.load('quotes', () => true);
  await Promise.resolve();
  expect(api.list).toHaveBeenCalledTimes(1);
  const rows = [{ id: 'public' }];
  pending.resolve(rows);
  await loading;
  expect((await route).state).toBe('ready');
  expect(controller.views.get(path('quotes'))).toBe(rows);
  expect(api.list).toHaveBeenCalledTimes(1);
});

it('discards in-flight lazy data when an explicit refresh starts and adopts the public result', async () => {
  const { api, controller, state } = setup(['quote:read']);
  const slow = deferred<readonly Record<string, unknown>[]>();
  const rows = [{ id: 'public-new' }];
  api.list.mockReturnValueOnce(slow.promise).mockResolvedValue(rows);
  const loading = state.load('quotes', () => true);
  await vi.waitFor(() => {
    expect(api.list).toHaveBeenCalledTimes(1);
  });
  await controller.refreshViews([path('quotes')]);
  slow.resolve([{ id: 'lazy-old' }]);
  expect((await loading).state).toBe('ready');
  expect(controller.views.get(path('quotes'))).toBe(rows);
  expect(api.list).toHaveBeenCalledTimes(2);
  await state.load('quotes', () => true);
  expect(api.list).toHaveBeenCalledTimes(2);
});

it.each(['dispose', 'session'] as const)(
  'cancels staging after %s without committing an empty snapshot',
  async (kind) => {
    const { api, controller, owner, state, expire } = setup(['quote:read']);
    const slow = deferred<readonly Record<string, unknown>[]>();
    api.list.mockReturnValueOnce(slow.promise);
    const loading = state.load('quotes', () => true);
    await vi.waitFor(() => {
      expect(api.list).toHaveBeenCalledTimes(1);
    });
    if (kind === 'dispose') owner.dispose();
    else expire();
    slow.resolve([{ id: 'old-session' }]);
    expect((await loading).state).toBe('cancelled');
    expect(controller.views.has(path('quotes'))).toBe(false);
  },
);

it('guards real cost state against a public read invalidating the lazy wave', async () => {
  const { api, controller, owner } = setup(['cost-matrix:read']);
  const slow = deferred<CostMatrixPage>();
  api.listCostMatrixSummaries.mockReturnValueOnce(slow.promise);
  const query = controller.costMatrixQuery;
  const loading = readCommercialRoute(controller, owner, 'costing', () => true);
  await vi.waitFor(() => {
    expect(api.listCostMatrixSummaries).toHaveBeenCalledTimes(1);
  });
  await controller.refreshViews([path('quotes')]);
  slow.resolve({ items: [{ id: 'obsolete-cost' }], total: 9, page: 1, pageSize: 20 });
  expect((await loading).state).toBe('stale');
  expect(controller.views.has(path('cost-matrices'))).toBe(false);
  expect(controller.costMatrixQuery).toBe(query);
  expect(controller.costMatrixTotal).toBe(0);
});

it.each(['lazy-first', 'public-first'] as const)(
  'does not cancel a newer public cost request (%s)',
  async (order) => {
    const { api, controller, state } = setup(['cost-matrix:read']);
    const old = deferred<CostMatrixPage>();
    const fresh = deferred<CostMatrixPage>();
    api.listCostMatrixSummaries.mockReturnValueOnce(old.promise).mockReturnValueOnce(fresh.promise);
    const loading = state.load('costing', () => true);
    await vi.waitFor(() => {
      expect(api.listCostMatrixSummaries).toHaveBeenCalledTimes(1);
    });
    const publicRead = controller.loadCostMatrixPage({ query: 'public-query' });
    const oldPage = { items: [{ id: 'old' }], total: 9, page: 1, pageSize: 20 };
    const newRows = [{ id: 'public' }];
    const newPage = { items: newRows, total: 1, page: 1, pageSize: 20 };
    if (order === 'public-first') {
      fresh.resolve(newPage);
      expect(await publicRead).toBe(true);
    }
    old.resolve(oldPage);
    expect(api.listCostMatrixSummaries).toHaveBeenCalledTimes(2);
    if (order === 'lazy-first') {
      fresh.resolve(newPage);
      expect(await publicRead).toBe(true);
    }
    expect((await loading).state).toBe('ready');
    expect(api.listCostMatrixSummaries).toHaveBeenCalledTimes(2);
    expect(controller.views.get(path('cost-matrices'))).toBe(newRows);
    expect(controller.costMatrixQuery.query).toBe('public-query');
    expect(controller.costMatrixTotal).toBe(1);
    expect(controller.loading).toBe(false);
  },
);

it.each(['public-first', 'idle-queued'] as const)(
  'does not make an earlier public cost query stale when lazy is cancelled (%s)',
  async (order) => {
    const { api, controller, state } = setup(['cost-matrix:read']);
    const publicPage = deferred<CostMatrixPage>();
    api.listCostMatrixSummaries.mockReturnValueOnce(publicPage.promise);
    let current = true;
    let lazy: ReturnType<CommercialRouteState['load']>;
    let publicRead: Promise<boolean>;
    if (order === 'public-first') {
      publicRead = controller.loadCostMatrixPage({ query: 'public-first' });
      lazy = state.load('costing', () => current);
    } else {
      lazy = state.load('costing', () => current);
      publicRead = controller.loadCostMatrixPage({ query: 'public-first' });
    }
    for (let turn = 0; turn < 10; turn += 1) await Promise.resolve();
    current = false;
    const rows = [{ id: 'public-first' }];
    publicPage.resolve({ items: rows, total: 7, page: 1, pageSize: 20 });
    expect(await publicRead).toBe(true);
    expect((await lazy).state).toBe('cancelled');
    expect(api.listCostMatrixSummaries).toHaveBeenCalledTimes(1);
    expect(controller.views.get(path('cost-matrices'))).toBe(rows);
    expect(controller.costMatrixQuery.query).toBe('public-first');
    expect(controller.costMatrixTotal).toBe(7);
    expect(controller.loading).toBe(false);
  },
);

it.each([false, true])(
  'preserves original public/public cost latest-wins (owner=%s)',
  async (attached) => {
    const api = apiStub();
    const controller = new CommercialController(api, new Set(['cost-matrix:read']));
    if (attached) attachCommercialReadOwner(controller, () => true);
    const slow = deferred<CostMatrixPage>();
    const rows = [{ id: 'latest-public' }];
    api.listCostMatrixSummaries
      .mockReturnValueOnce(slow.promise)
      .mockResolvedValueOnce({ items: rows, total: 2, page: 1, pageSize: 20 });
    const first = controller.loadCostMatrixPage({ query: 'old-public' });
    expect(await controller.loadCostMatrixPage({ query: 'latest-public' })).toBe(true);
    slow.resolve({ items: [{ id: 'obsolete' }], total: 99, page: 1, pageSize: 20 });
    expect(await first).toBe(false);
    expect(controller.views.get(path('cost-matrices'))).toBe(rows);
    expect(controller.costMatrixQuery.query).toBe('latest-public');
    expect(controller.costMatrixTotal).toBe(2);
  },
);

it('does not infer opportunity or dashboard success merely from public load finishing', async () => {
  const { api, controller, state } = setup([
    'opportunity:read',
    'executive-dashboard:read',
    'quote:read',
  ]);
  api.listOpportunities.mockRejectedValueOnce(new Error('opportunity offline'));
  api.list.mockRejectedValueOnce(new Error('quote offline'));
  api.get.mockRejectedValueOnce(new Error('dashboard offline'));
  await controller.load();
  expect(state.readyRoutes().has('opportunities')).toBe(false);
  expect(state.readyRoutes().has('quotes')).toBe(false);
  expect(state.readyRoutes().has('overview')).toBe(false);
});

it.each(['load', 'refresh'] as const)(
  'does not infer cost readiness from a rejected acceptance (%s)',
  async (operation) => {
    const { controller, state } = setup(['cost-matrix:read']);
    vi.spyOn(controller, 'loadCostMatrixPage').mockResolvedValue(false);
    if (operation === 'load') await controller.load();
    else await controller.refreshViews([path('cost-matrices')]);
    expect(controller.views.has(path('cost-matrices'))).toBe(false);
    expect(state.readyRoutes().has('costing')).toBe(false);
  },
);

it.each([true, false])('releases the public barrier even when loading=%s throws', async (value) => {
  const { controller, owner } = setup(['quote:read']);
  let loading = false;
  Object.defineProperty(controller, 'loading', {
    get: () => loading,
    set: (next: boolean) => {
      if (next === value) throw new Error('loading setter');
      loading = next;
    },
  });
  await expect(controller.load()).rejects.toThrow('loading setter');
  expect(owner.isIdle()).toBe(true);
  await owner.waitUntilIdle();
});
