import { expect, it, vi } from 'vitest';
import { CrmController, type CrmApi } from './bootstrap';

it('only commits the latest customer selection when responses arrive out of order', async () => {
  let resolve!: (value: unknown) => void;
  const slow = new Promise((yes) => {
    resolve = yes;
  });
  const api = {
    customer360: vi
      .fn()
      .mockReturnValueOnce(slow)
      .mockResolvedValue({ customer: { id: 'new' } }),
  } as unknown as CrmApi;
  const controller = new CrmController(new Set(['customer:read', 'customer-360:read']), api);
  const first = controller.selectCustomer('old');
  await controller.selectCustomer('new');
  resolve({ customer: { id: 'old' } });
  await first;
  expect(controller.selected?.customer.id).toBe('new');
});

it('ignores obsolete customer failures while surfacing the latest failure', async () => {
  let reject!: (value: Error) => void;
  const slow = new Promise((_yes, no) => {
    reject = no;
  });
  const customer360 = vi
    .fn()
    .mockReturnValueOnce(slow)
    .mockResolvedValue({ customer: { id: 'new' } });
  const controller = new CrmController(new Set(['customer:read', 'customer-360:read']), {
    customer360,
  } as unknown as CrmApi);
  const first = controller.selectCustomer('old');
  await controller.selectCustomer('new');
  reject(new Error('obsolete'));
  await expect(first).resolves.toBeUndefined();
  customer360.mockRejectedValueOnce(new Error('retry required'));
  await expect(controller.selectCustomer('latest')).rejects.toThrow('retry required');
});
