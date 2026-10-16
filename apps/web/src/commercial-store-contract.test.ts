import { expect, it, vi } from 'vitest';
import { CommercialController } from './bootstrap';
import type { CommercialApi } from './commercial/types';

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
    listOpportunities: vi.fn().mockResolvedValue([]),
    list: vi.fn().mockResolvedValue([]),
    get: vi.fn().mockResolvedValue({}),
    submit: vi.fn().mockResolvedValue({}),
    uploadCtrAttachment: vi.fn().mockResolvedValue({}),
    command: vi.fn().mockResolvedValue({}),
  };
}

it('keeps eager permission filtering, inventory read priority and source invocation order', async () => {
  const calls: string[] = [];
  const api = apiStub();
  api.listOpportunities.mockImplementation(function (this: CommercialApi) {
    expect(this).toBe(api);
    calls.push('opportunities');
    return Promise.resolve([]);
  });
  api.list.mockImplementation(function (this: CommercialApi, path: string) {
    expect(this).toBe(api);
    calls.push(path);
    return Promise.resolve([]);
  });
  const controller = new CommercialController(
    api,
    new Set(['opportunity:read', 'quote:read', 'inventory:read', 'inventory:move']),
  );
  const views = controller.views;
  await controller.load();
  expect(calls).toEqual([
    'opportunities',
    '/api/v1/quotes',
    '/api/v1/inventory-locations',
    '/api/v1/inventory-balances',
  ]);
  expect(controller.views).toBe(views);
  expect(api.get).not.toHaveBeenCalled();
  expect(controller.loading).toBe(false);
  expect(controller.message).toBe('已加载 0 个商机');
});

it('starts lists concurrently, commits their batch after settling, then starts dashboard', async () => {
  const quote = deferred<readonly Record<string, unknown>[]>();
  const contracts = deferred<readonly Record<string, unknown>[]>();
  const api = apiStub();
  api.list.mockImplementation((path: string) =>
    path === '/api/v1/quotes' ? quote.promise : contracts.promise,
  );
  const controller = new CommercialController(
    api,
    new Set(['quote:read', 'contract:read', 'executive-dashboard:read']),
  );
  const loading = controller.load();
  expect(api.list.mock.calls).toEqual([['/api/v1/quotes'], ['/api/v1/contracts']]);
  expect(api.get).not.toHaveBeenCalled();
  quote.resolve([{ id: 'quote' }]);
  await quote.promise;
  expect(controller.views.has('/api/v1/quotes')).toBe(false);
  contracts.resolve([{ id: 'contract' }]);
  await loading;
  expect(controller.views.get('/api/v1/quotes')).toEqual([{ id: 'quote' }]);
  expect(controller.views.get('/api/v1/contracts')).toEqual([{ id: 'contract' }]);
  expect(api.get).toHaveBeenCalledTimes(1);
  const url = new URL(String(api.get.mock.calls[0]?.[0]), 'http://localhost');
  expect(url.pathname).toBe('/api/v1/executive-dashboard');
  expect(url.searchParams.get('currency')).toBe('CNY');
  const year = new Date().getUTCFullYear();
  expect(url.searchParams.get('from')).toBe(`${String(year)}-01-01T00:00:00.000Z`);
  expect(url.searchParams.get('to')).toBe(`${String(year + 1)}-01-01T00:00:00.000Z`);
});

it('keeps ordinary failed rows and dashboard but clears failed opportunities', async () => {
  const api = apiStub();
  api.listOpportunities.mockRejectedValue(new Error('opportunity offline'));
  api.list.mockRejectedValue(new Error('quote offline'));
  api.get.mockRejectedValue(new Error('dashboard offline'));
  const controller = new CommercialController(
    api,
    new Set(['opportunity:read', 'quote:read', 'executive-dashboard:read']),
  );
  const rows = [{ id: 'old-quote' }];
  const dashboard = { old: true };
  controller.opportunities = [{ id: 'old-opportunity' }];
  controller.views.set('/api/v1/quotes', rows);
  controller.dashboard = dashboard;
  await controller.load();
  expect(controller.opportunities).toEqual([]);
  expect(controller.views.get('/api/v1/quotes')).toBe(rows);
  expect(controller.dashboard).toBe(dashboard);
  expect(controller.message).toBe('核心工作台已加载；3 个数据源暂不可用');
  expect(controller.loading).toBe(false);
  api.list.mockResolvedValue([{ id: 'retry' }]);
  await controller.load();
  expect(controller.views.get('/api/v1/quotes')).toEqual([{ id: 'retry' }]);
  expect(api.list).toHaveBeenCalledTimes(2);
});

it('refreshes only explicit paths, retains failed data, reports failure and permits retry', async () => {
  const api = apiStub();
  api.list.mockImplementation((path: string) =>
    path === '/api/v1/contracts'
      ? Promise.reject(new Error('offline'))
      : Promise.resolve([{ id: 'new-quote' }]),
  );
  const controller = new CommercialController(api);
  const old = [{ id: 'old-contract' }];
  controller.views.set('/api/v1/contracts', old);
  await expect(controller.refreshViews(['/api/v1/quotes', '/api/v1/contracts'])).rejects.toThrow(
    '数据已保存，但刷新失败：/api/v1/contracts，请重新进入本页面',
  );
  expect(controller.views.get('/api/v1/contracts')).toBe(old);
  expect(controller.views.get('/api/v1/quotes')).toEqual([{ id: 'new-quote' }]);
  expect(controller.loading).toBe(false);
  api.list.mockResolvedValue([{ id: 'retried-contract' }]);
  await controller.refreshViews(['/api/v1/contracts']);
  expect(controller.views.get('/api/v1/contracts')).toEqual([{ id: 'retried-contract' }]);
  expect(api.listOpportunities).not.toHaveBeenCalled();
});

it('keeps different order evidence requests independent and retries only the failed id', async () => {
  const first = deferred<Record<string, unknown>>();
  const second = deferred<Record<string, unknown>>();
  const api = apiStub();
  api.get.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
  const controller = new CommercialController(api, new Set(['sales-order:read', 'order-360:read']));
  const failed = controller.loadOrder360('a/b');
  const successful = controller.loadOrder360('b');
  const rejection = expect(failed).rejects.toThrow('first offline');
  expect(api.get.mock.calls).toEqual([
    ['/api/v1/sales-orders/a%2Fb/360'],
    ['/api/v1/sales-orders/b/360'],
  ]);
  const aggregate = { id: 'second' };
  second.resolve(aggregate);
  expect(await successful).toBe(aggregate);
  first.reject(new Error('first offline'));
  await rejection;
  expect(controller.order360.get('b')).toBe(aggregate);
  expect(controller.order360.has('a/b')).toBe(false);
  api.get.mockResolvedValue({ id: 'retried' });
  await controller.loadOrder360('a/b');
  expect(api.get).toHaveBeenCalledTimes(3);
});

it('preserves write receiver, response identity and path-specific reload boundaries', async () => {
  const api = apiStub();
  const response = { id: 'saved' };
  const payload = { name: 'test' };
  api.submit.mockImplementation(function (
    this: CommercialApi,
    path: string,
    value: Record<string, unknown>,
    method: 'POST' | 'PATCH' = 'POST',
  ) {
    expect(this).toBe(api);
    expect(value).toBe(payload);
    expect(method).toBe('POST');
    return Promise.resolve({ ...response, path });
  });
  const controller = new CommercialController(api);
  const reload = vi.spyOn(controller, 'load').mockResolvedValue();
  await controller.submit('/api/v1/quotes', payload);
  expect(reload).not.toHaveBeenCalled();
  expect(controller.revisionState).toEqual({ ...response, path: '/api/v1/quotes' });
  api.submit.mockResolvedValue(response);
  await controller.submit('/api/v1/opportunities', payload);
  expect(controller.revisionState).toBe(response);
  expect(reload).toHaveBeenCalledTimes(1);
  expect(controller.loading).toBe(false);
});
