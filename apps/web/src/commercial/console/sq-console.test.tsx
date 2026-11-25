import { h, render } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, expect, it, vi } from 'vitest';
import { installGlobalTestDom, type TestElement } from '../../../test/fixtures/preact-dom';
import { confirmAction, dismissConfirm } from '../../../test/fixtures/confirm-dialog';
import { SupplierQuoteConsolePage, type SupplierQuotePorts } from './sq-console';

const now = new Date('2026-11-25T16:01:02.003Z');
const expired = {
  id: 'quote-old',
  quote_reference: 'SQ-OLD',
  supplierName: '原供应商',
  supplier_id: 'other',
  received_at: '2026-11-01',
  valid_until: '2026-11-22',
  rfq_id: 'rfq-1',
  rfqNumber: 'RFQ-1',
  lines: [{ id: 'q-line', rfq_line_id: 'line-1', unit_price: 4 }],
};
const fresh = {
  ...expired,
  id: 'quote-new',
  quote_reference: 'SQ-NEW',
  supplierName: '新供应商',
  supplier_id: 'supplier',
  valid_until: '2026-11-30',
};
const rfqs = [
  { id: 'rfq-1', rfq_number: 'RFQ-1', lines: [{ id: 'line-1', sku: 'RM-YARN', line_number: 1 }] },
  {
    id: 'rfq-2',
    rfq_number: 'RFQ-2',
    lines: [{ id: 'line-2', sku: 'RM-BACKING', line_number: 1 }],
  },
];

const ports = () =>
  ({
    permissions: new Set(['procurement:manage']),
    initialQuotes: [expired],
    rfqs: () => rfqs,
    suppliers: () => [{ value: 'supplier', label: '新供应商' }],
    fetchPage: vi.fn().mockResolvedValue({ items: [fresh, expired], nextCursor: null }),
    loadDetail: vi.fn().mockResolvedValue(fresh),
    refresh: vi.fn().mockResolvedValue([fresh, expired]),
    submit: vi.fn().mockResolvedValue({}),
    now: () => now,
  }) satisfies SupplierQuotePorts;

let root: TestElement | undefined;
const mount = (options: SupplierQuotePorts) => {
  root = installGlobalTestDom().document.createElement('div');
  render(h(SupplierQuoteConsolePage(options), {}), root);
  return root;
};
const locate = (host: TestElement, selector: string) => {
  const node = host.querySelector(selector);
  if (!node) throw new Error(`Missing ${selector}`);
  return node as TestElement;
};
const testId = (host: TestElement, id: string) => locate(host, `[data-testid="${id}"]`);
const click = (node: TestElement) =>
  act(() => {
    node.click();
  });
const enter = (host: TestElement, name: string, value: string, event = 'input') =>
  act(() => {
    const field = locate(host, `[name="${name}"]`);
    field.value = value;
    field.dispatchEvent(new Event(event, { bubbles: true }));
  });
const fill = async (host: TestElement) => {
  await click(testId(host, 'kt-sq-create'));
  await enter(host, 'rfqId', 'rfq-1', 'change');
  expect(testId(host, 'kt-sq-form-line').textContent).toContain('RM-YARN');
  await enter(host, 'rfqId', 'rfq-2', 'change');
  expect(testId(host, 'kt-sq-form-line').textContent).not.toContain('RM-YARN');
  await enter(host, 'rfqId', 'rfq-1', 'change');
  await enter(host, 'rfqLineId', 'line-1', 'change');
  for (const [name, value] of Object.entries({
    supplierId: 'supplier',
    quoteReference: '  SQ-NEW  ',
    unitPrice: '12.68',
    promisedAt: '2026-12-01',
    validUntil: '2026-11-30',
  }))
    await enter(host, name, value);
  return locate(locate(host, 'form.form-section'), 'button[type="submit"]');
};

afterEach(() => {
  if (root) render(null, root);
  root = undefined;
});

it('keeps the exact legacy write only after confirmation and refreshes the summary and comparisons', async () => {
  const io = ports();
  const host = mount(io);
  const button = await fill(host);
  await click(button);
  expect(io.submit).not.toHaveBeenCalled();
  await dismissConfirm(host);
  expect(io.submit).not.toHaveBeenCalled();
  await click(button);
  await confirmAction(host, '登记供应商报价', '确认登记', { destructive: true });
  expect(JSON.stringify(io.submit.mock.calls)).toBe(
    JSON.stringify([
      [
        '/api/v1/supplier-quotes',
        {
          rfqId: 'rfq-1',
          supplierId: 'supplier',
          quoteReference: 'SQ-NEW',
          receivedAt: now.toISOString(),
          validUntil: '2026-11-30',
          terms: { currency: 'CNY' },
          lines: [
            {
              rfqLineId: 'line-1',
              unitPrice: '12.68',
              promisedAt: '2026-12-01',
              minimumOrderQuantity: '0',
            },
          ],
        },
      ],
    ]),
  );
  expect(testId(host, 'console-notice').textContent).toBe('已登记供应商报价 SQ-NEW');
  expect(testId(host, 'kt-sq-summary-valid').textContent).toContain('1');
  expect(testId(host, 'kt-sq-summary-expiring').textContent).toContain('1');
  await click(testId(host, 'kt-sq-open'));
  expect(testId(host, 'kt-sq-comparison-q-line').textContent).toContain('SQ-OLD');
  expect(testId(host, 'kt-sq-rfq-link').getAttribute('href')).toBe('#/procurement/rfqs?rfq=rfq-1');
});

it('keeps server rejection in the form and does not pretend the write succeeded', async () => {
  const io = ports();
  io.submit.mockRejectedValueOnce(new Error('报价只能登记给启用的供应商'));
  const host = mount(io);
  await click(await fill(host));
  await confirmAction(host, '登记供应商报价', '确认登记', { destructive: true });
  expect(locate(host, 'form.form-section [role="alert"]').textContent).toBe(
    '报价只能登记给启用的供应商',
  );
  expect(io.refresh).not.toHaveBeenCalled();
  expect(host.querySelector('[data-testid="console-notice"]')?.textContent ?? '').toBe('');
});

it('filters and loads subsequent pages for read-only accounts without write controls', async () => {
  const io = ports();
  io.fetchPage.mockResolvedValueOnce({ items: [expired], nextCursor: 'quote-old' });
  const host = mount({ ...io, permissions: new Set(['procurement:read']) });
  expect(host.querySelector('[data-testid="kt-sq-create"]')).toBeNull();
  await click(testId(host, 'kt-sq-filter-expired'));
  expect(io.fetchPage).toHaveBeenLastCalledWith({
    limit: 20,
    status: 'EXPIRED',
    query: '',
    sort: 'received',
    direction: 'desc',
  });
  const next = await vi.waitFor(() => locate(host, '.data-table-footer button'));
  await click(next);
  expect(io.fetchPage).toHaveBeenLastCalledWith({
    limit: 20,
    status: 'EXPIRED',
    query: '',
    sort: 'received',
    direction: 'desc',
    cursor: 'quote-old',
  });
});
