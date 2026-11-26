import { h, render } from 'preact';
import { act } from 'preact/test-utils';
import { expect, it, vi } from 'vitest';
import { installGlobalTestDom, type TestElement } from '../../../test/fixtures/preact-dom';
import { RequestError } from '../../http-core';
import { recordText, textValue } from '../../shared/business-format';
import { ArConsolePage } from './ar-console';
import type { ArConsolePorts } from './ar-ports';

const invoice = {
  id: 'ar-1',
  documentNumber: 'INV-1',
  documentType: 'INVOICE',
  currency: 'CNY',
  originalAmount: '1000.000000',
  appliedAmount: '600.000000',
  remainingAmount: '400.000000',
  agingState: 'OVERDUE',
  due_at: '2026-01-01T00:00:00Z',
};
const order = { id: 'order-1', customer_id: 'customer-1', status: 'CANCELLED' };

const portsFor = (overrides: Partial<ArConsolePorts> = {}): ArConsolePorts => ({
  permissions: new Set(['ar:read', 'ar:post']),
  recordText,
  textValue: (value, fallback = '') => textValue(value, fallback),
  salesOrderChoices: [{ value: order.id, label: 'SO-001' }],
  orderOf: (id) => (id === order.id ? order : undefined),
  fetchPage: vi.fn().mockResolvedValue({ items: [invoice], nextCursor: null }),
  loadDetail: vi.fn().mockResolvedValue(null),
  submit: vi.fn().mockResolvedValue(null),
  refresh: vi.fn().mockResolvedValue(undefined),
  routeVisible: () => false,
  ...overrides,
});

const find = (host: TestElement, selector: string): TestElement => {
  const element = host.querySelector(selector);
  if (!element) throw new Error(`Missing ${selector}`);
  return element as TestElement;
};
const click = async (element: TestElement): Promise<void> => {
  await act(async () => {
    element.click();
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 0);
    });
  });
};
const byId = (host: TestElement, id: string): TestElement => find(host, `[data-testid="${id}"]`);
const mount = async (ports: ArConsolePorts): Promise<TestElement> => {
  const host = installGlobalTestDom().document.createElement('div');
  const page = ArConsolePage(ports);
  await act(async () => {
    render(h(page, {}), host);
    await Promise.resolve();
  });
  return host;
};
const enter = async (host: TestElement, name: string, value: string): Promise<void> => {
  const input = find(host, `.detail-drawer [name="${name}"]`);
  await act(async () => {
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await Promise.resolve();
  });
};

it('keeps the receivable and applied amounts on the same invoice and loads its detail', async () => {
  const ports = portsFor({
    permissions: new Set(['ar:read']),
    loadDetail: vi.fn().mockResolvedValue({
      ...invoice,
      allocations: [{ id: 'a1', currency: 'CNY', amount: '600.000000', allocationOrder: 1 }],
    }),
  });
  const host = await mount(ports);
  const row = find(host, 'tr[data-row-id="ar-1"]');
  expect(byId(row, 'kt-ar-remaining').textContent).toBe('¥400');
  expect(byId(row, 'kt-ar-applied').textContent).toBe('¥600');
  expect(host.querySelector('[data-testid="kt-ar-create"]')).toBeNull();
  await click(byId(row, 'kt-ar-open'));
  expect(ports.loadDetail).toHaveBeenCalledWith('ar-1');
  expect(byId(host, 'kt-ar-allocation-amount').textContent).toBe('¥600');
});

it('posts the legacy JSON bytes, shows a rejected attempt in the form, then reloads on success', async () => {
  const submit = vi
    .fn<ArConsolePorts['submit']>()
    .mockRejectedValueOnce(new Error('应收单据与销售订单不一致'))
    .mockResolvedValue(null);
  const ports = portsFor({ submit });
  const host = await mount(ports);
  await click(byId(host, 'kt-ar-create'));
  await enter(host, 'salesOrderId', order.id);
  await enter(host, 'documentNumber', ' INV-2 ');
  await enter(host, 'amount', '12.500000');
  await enter(host, 'dueAt', '2026-12-01');
  const button = find(host, '.detail-drawer button[type="submit"]');
  await click(button);
  expect(find(host, '.detail-drawer .form-error').textContent).toBe('应收单据与销售订单不一致');
  expect(ports.refresh).not.toHaveBeenCalled();
  await click(button);
  const legacyBody =
    '{"customerId":"customer-1","salesOrderId":"order-1","documentNumber":"INV-2","documentType":"INVOICE","currency":"CNY","amount":"12.500000","dueAt":"2026-12-01T23:59:59.000Z"}';
  expect(submit.mock.calls.map(([path, body]) => [path, JSON.stringify(body)])).toEqual([
    ['/api/v1/ar-open-items', legacyBody],
    ['/api/v1/ar-open-items', legacyBody],
  ]);
  expect(ports.refresh).toHaveBeenCalledOnce();
  expect(ports.fetchPage).toHaveBeenCalledTimes(2);
  expect(host.querySelector('.detail-drawer')).toBeNull();
  expect(host.textContent).toContain('已过账应收单据 INV-2');
});

// TD-FIN-003：服务端的超额开票拒绝（409 + 中文）经既有错误通道逐字显示在表单提示区，抽屉保持
// 打开、不触发写后刷新。表单本身不显示已开票 / 剩余可开票金额，数字只来自这句服务端提示。
it('shows the server invoice-cap rejection verbatim and keeps the form open without reloading', async () => {
  const rejection =
    '累计开票金额超过订单金额，已拒绝过账：订单金额 CNY 950000，已开票 950000，本次 12.34，合计 950012.34';
  const submit = vi
    .fn<ArConsolePorts['submit']>()
    .mockRejectedValue(new RequestError(rejection, 409, '9e6b2c9c-3f7e-4b8f-9d2f-6a3f2f8c1a11'));
  const ports = portsFor({ submit });
  const host = await mount(ports);
  await click(byId(host, 'kt-ar-create'));
  await enter(host, 'salesOrderId', order.id);
  await enter(host, 'documentNumber', 'INV-CAP-2');
  await enter(host, 'amount', '12.34');
  await enter(host, 'dueAt', '2026-12-01');
  await click(find(host, '.detail-drawer button[type="submit"]'));
  expect(find(host, '.detail-drawer .form-error').textContent).toBe(rejection);
  expect(host.textContent).not.toContain('已过账应收单据');
  expect(ports.refresh).not.toHaveBeenCalled();
  expect(ports.fetchPage).toHaveBeenCalledTimes(1);
  expect(submit.mock.calls.map(([path, body]) => [path, JSON.stringify(body)])).toEqual([
    [
      '/api/v1/ar-open-items',
      '{"customerId":"customer-1","salesOrderId":"order-1","documentNumber":"INV-CAP-2","documentType":"INVOICE","currency":"CNY","amount":"12.34","dueAt":"2026-12-01T23:59:59.000Z"}',
    ],
  ]);
  expect(host.querySelector('.detail-drawer')).not.toBeNull();
});

it('filters and follows a cursor while formatting and sorting ledger amounts exactly', async () => {
  const fetchPage = vi
    .fn()
    .mockResolvedValueOnce({ items: [invoice], nextCursor: null })
    .mockResolvedValueOnce({
      items: [{ ...invoice, remainingAmount: '9007199254740993.000002' }],
      nextCursor: 'cursor-1',
    })
    .mockResolvedValueOnce({
      items: [{ ...invoice, id: 'ar-2', remainingAmount: '9007199254740993.000001' }],
      nextCursor: null,
    });
  const host = await mount(portsFor({ fetchPage }));
  await click(byId(host, 'kt-ar-filter-overdue'));
  expect(fetchPage).toHaveBeenLastCalledWith({ state: 'OVERDUE', summary: true, limit: 50 });
  const more = host.querySelectorAll('button').find((button) => button.textContent === '继续加载');
  if (!more) throw new Error('Missing pagination button');
  await click(more as TestElement);
  expect(fetchPage).toHaveBeenLastCalledWith({
    state: 'OVERDUE',
    summary: true,
    limit: 50,
    cursor: 'cursor-1',
  });
  await click(find(host, '[data-sort-key="remaining"] button'));
  expect(
    host.querySelectorAll('[data-testid="kt-ar-remaining"]').map((node) => node.textContent),
  ).toEqual(['¥9,007,199,254,740,993.000001', '¥9,007,199,254,740,993.000002']);
});

it('reloads a mounted AR list when a sibling ledger console writes', async () => {
  let refresh: (() => Promise<void>) | undefined;
  const fetchPage = vi
    .fn()
    .mockResolvedValueOnce({ items: [invoice], nextCursor: null })
    .mockResolvedValueOnce({
      items: [{ ...invoice, remainingAmount: '90.000000' }],
      nextCursor: null,
    });
  const host = await mount(
    portsFor({
      fetchPage,
      ledgerUpdates: {
        subscribe: (reload) => {
          refresh = reload;
          return vi.fn();
        },
        publish: vi.fn(),
      },
    }),
  );
  expect(byId(host, 'kt-ar-remaining').textContent).toBe('¥400');
  if (!refresh) throw new Error('Missing ledger listener');
  await refresh();
  await vi.waitFor(() => {
    expect(byId(host, 'kt-ar-remaining').textContent).toBe('¥90');
  });
});
