import { h, render } from 'preact';
import { act } from 'preact/test-utils';
import { expect, it, vi } from 'vitest';
import { installGlobalTestDom, type TestElement } from '../../../test/fixtures/preact-dom';
import { confirmAction, confirmDialogOf } from '../../../test/fixtures/confirm-dialog';
import { PaymentConsolePage } from './payment-console';
import type { PaymentPorts } from './payment-ports';

const deposit = {
  id: 'payment-1',
  bankReference: 'BANK-001',
  currency: 'CNY',
  originalAmount: '600',
  appliedAmount: '0',
  remainingAmount: '600',
};
const run = { id: 'run-1', status: 'COMPLETED', resultHash: '1234567890abcdef', matchCount: 1 };
const tick = () =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });
const renderPage = async (overrides: Partial<PaymentPorts> = {}) => {
  const ports: PaymentPorts = {
    permissions: new Set([
      'bank-payment:read',
      'bank-payment:intake',
      'reconciliation:read',
      'reconciliation:run',
    ]),
    customers: [{ value: 'customer-1', label: '财务客户' }],
    fetchPage: vi.fn((kind: 'payments' | 'reconciliations') =>
      Promise.resolve({ items: kind === 'payments' ? [deposit] : [run], nextCursor: null }),
    ),
    loadDetail: vi.fn().mockResolvedValue(null),
    submit: vi.fn<PaymentPorts['submit']>().mockResolvedValue(undefined),
    refresh: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
  const host = installGlobalTestDom().document.createElement('div');
  const Page = PaymentConsolePage(ports);
  await act(async () => {
    render(h(Page, {}), host);
    await tick();
  });
  return { host, ports };
};
const get = (host: TestElement, selector: string): TestElement => {
  const result = host.querySelector(selector);
  if (!result) throw new Error(`Missing ${selector}`);
  return result as TestElement;
};
const byId = (host: TestElement, id: string) => get(host, `[data-testid="${id}"]`);
const click = (control: TestElement) =>
  act(async () => {
    control.click();
    await tick();
  });

it('posts the precise legacy intake bytes including trim, noon and raw payload', async () => {
  const { host, ports } = await renderPage();
  await click(byId(host, 'kt-payment-intake'));
  const values = {
    customerId: 'customer-1',
    bankReference: ' BANK-002 ',
    amount: '80.000001',
    currency: 'USD',
    receivedAt: '2026-11-25',
    payer: ' Payer ',
  };
  for (const [name, value] of Object.entries(values)) {
    const control = get(host, `.detail-drawer [name="${name}"]`);
    await act(async () => {
      control.value = value;
      control.dispatchEvent(new Event('input', { bubbles: true }));
      await tick();
    });
  }
  await click(get(host, '.detail-drawer button[type="submit"]'));
  expect(
    vi.mocked(ports.submit).mock.calls.map(([path, payload]) => [path, JSON.stringify(payload)]),
  ).toEqual([
    [
      '/api/v1/bank-payments',
      '{"customerId":"customer-1","currency":"USD","amount":"80.000001","receivedAt":"2026-11-25T12:00:00.000Z","bankReference":"BANK-002","rawPayload":{"payer":"Payer","source":"MANUAL_BANK_RECEIPT"}}',
    ],
  ]);
  expect(host.textContent).toContain('已登记银行收款 BANK-002');
});

it('retains the run hash prefix and sends the legacy reconciliation body only after confirmation', async () => {
  const { host, ports } = await renderPage();
  expect(byId(host, 'kt-payment-run-hash').textContent).toBe('1234567890ab');
  await click(byId(host, 'kt-payment-open'));
  await click(byId(host, 'kt-payment-run'));
  await click(get(host, '.detail-drawer button[type="submit"]'));
  expect(confirmDialogOf(host).textContent).toContain('稳定顺序');
  expect(ports.submit).not.toHaveBeenCalled();
  await confirmAction(host, '确认运行核销', '确认运行核销', { destructive: true });
  await tick();
  expect(
    vi.mocked(ports.submit).mock.calls.map(([path, payload]) => [path, JSON.stringify(payload)]),
  ).toEqual([['/api/v1/reconciliation-runs', '{"paymentId":"payment-1"}']]);
  expect(ports.refresh).toHaveBeenCalledOnce();
  expect(host.textContent).toContain('已完成核销运行 BANK-001');
});

it('keeps write actions and restricted run reads out of a payment reader’s workspace', async () => {
  const { host, ports } = await renderPage({ permissions: new Set(['bank-payment:read']) });
  expect(host.querySelector('[data-testid="kt-payment-intake"]')).toBeNull();
  expect(host.querySelector('[data-testid="kt-payment-runs"]')).toBeNull();
  expect(ports.fetchPage).toHaveBeenCalledOnce();
  await click(byId(host, 'kt-payment-open'));
  expect(host.querySelector('[data-testid="kt-payment-run"]')).toBeNull();
});
