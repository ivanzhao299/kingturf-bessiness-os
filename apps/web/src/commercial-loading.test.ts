import { expect, it, vi } from 'vitest';
import { CommercialController } from './bootstrap';

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (failure: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};
const apiStub = () => ({
  listOpportunities: vi.fn().mockResolvedValue([]),
  list: vi.fn().mockResolvedValue([]),
  get: vi.fn().mockResolvedValue({}),
  submit: vi.fn().mockResolvedValue({}),
  uploadCtrAttachment: vi.fn().mockResolvedValue({}),
  command: vi.fn().mockResolvedValue({}),
});

it('does not preload order evidence on login; coalesces active reads and supports retry and freshness', async () => {
  const api = apiStub();
  api.list.mockResolvedValue(Array.from({ length: 100 }, (_, id) => ({ id: String(id) })));
  const controller = new CommercialController(api, new Set(['sales-order:read', 'order-360:read']));
  await controller.load();
  expect(api.get).not.toHaveBeenCalled();
  const pending = deferred<Record<string, unknown>>();
  api.get.mockReturnValueOnce(pending.promise);
  const first = controller.loadOrder360('0');
  const duplicate = controller.loadOrder360('0');
  expect(api.get).toHaveBeenCalledTimes(1);
  pending.resolve({ timeline: [{ type: 'ORDER_RELEASED' }] });
  expect(await duplicate).toEqual(await first);
  api.get.mockRejectedValueOnce(new Error('网络超时'));
  await expect(controller.loadOrder360('0')).rejects.toThrow('网络超时');
  await controller.loadOrder360('0');
  expect(api.get).toHaveBeenCalledTimes(3);
  await expect(new CommercialController(api).loadOrder360('0')).rejects.toThrow('无权');
  expect(api.get).toHaveBeenCalledTimes(3);
});

it('applies only the latest cost query, combines pending filters, and ignores obsolete failures', async () => {
  const old = deferred<{
    items: Record<string, unknown>[];
    total: number;
    page: number;
    pageSize: number;
  }>();
  const api = {
    ...apiStub(),
    listCostMatrixSummaries: vi
      .fn()
      .mockReturnValueOnce(old.promise)
      .mockResolvedValue({ items: [{ id: 'new' }], total: 1, page: 1, pageSize: 20 }),
  };
  const controller = new CommercialController(api, new Set(['cost-matrix:read']));
  const obsolete = controller.loadCostMatrixPage({ query: '50mm' });
  await controller.loadCostMatrixPage({ productFamily: '运动草' });
  expect(api.listCostMatrixSummaries).toHaveBeenLastCalledWith(
    expect.objectContaining({ query: '50mm', productFamily: '运动草' }),
  );
  old.resolve({ items: [{ id: 'old' }], total: 99, page: 1, pageSize: 20 });
  expect(await obsolete).toBe(false);
  expect(controller.views.get('/api/v1/cost-matrices')).toEqual([{ id: 'new' }]);
  expect(controller.costMatrixTotal).toBe(1);
  const failed = deferred<never>();
  api.listCostMatrixSummaries.mockReturnValueOnce(failed.promise);
  const staleFailure = controller.loadCostMatrixPage({ query: 'old' });
  await controller.loadCostMatrixPage({ query: 'new' });
  failed.reject(new Error('stale error'));
  expect(await staleFailure).toBe(false);
  expect(controller.loading).toBe(false);
  api.listCostMatrixSummaries.mockRejectedValueOnce(new Error('offline'));
  await expect(controller.loadCostMatrixPage({ page: 2 })).rejects.toThrow('offline');
  expect(controller.costMatrixQuery.page).toBe(1);
});

it('does not recommit stale cost rows when a slower workspace refresh completes', async () => {
  const slow = deferred<Record<string, unknown>[]>();
  const api = {
    ...apiStub(),
    listCostMatrixSummaries: vi
      .fn()
      .mockResolvedValueOnce({ items: [{ id: 'old' }], total: 1, page: 1, pageSize: 20 })
      .mockResolvedValue({ items: [{ id: 'new' }], total: 1, page: 1, pageSize: 20 }),
  };
  api.list.mockReturnValueOnce(slow.promise);
  const controller = new CommercialController(api);
  const refresh = controller.refreshViews(['/api/v1/cost-matrices', '/api/v1/quotes']);
  await vi.waitFor(() => {
    expect(controller.views.get('/api/v1/cost-matrices')).toEqual([{ id: 'old' }]);
  });
  await controller.loadCostMatrixPage({ query: 'new' });
  slow.resolve([]);
  await refresh;
  expect(controller.views.get('/api/v1/cost-matrices')).toEqual([{ id: 'new' }]);
});
