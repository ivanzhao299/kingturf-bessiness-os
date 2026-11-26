import { h, render } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, expect, it, vi } from 'vitest';
import {
  installGlobalTestDom,
  isTestElement,
  type TestElement,
} from '../../../test/fixtures/preact-dom';
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
    suppliers: () => [{ value: 'supplier', label: '新供应商', status: 'ACTIVE' }],
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
// TD-PROC-021：供应商由候选控件（一组单选钮）选择；候选行按 data-supplier-id 定位。
const supplierRow = (host: TestElement, supplierId: string) =>
  locate(host, `[data-testid="kt-sq-supplier-choice"][data-supplier-id="${supplierId}"]`);
const supplierRadio = (host: TestElement, supplierId: string) =>
  locate(supplierRow(host, supplierId), 'input[type="radio"]');
const change = (node: TestElement) =>
  act(() => {
    node.checked = true;
    node.dispatchEvent(new Event('change', { bubbles: true }));
  });
const fill = async (host: TestElement) => {
  await click(testId(host, 'kt-sq-create'));
  await enter(host, 'rfqId', 'rfq-1', 'change');
  expect(testId(host, 'kt-sq-form-line').textContent).toContain('RM-YARN');
  await enter(host, 'rfqId', 'rfq-2', 'change');
  expect(testId(host, 'kt-sq-form-line').textContent).not.toContain('RM-YARN');
  await enter(host, 'rfqId', 'rfq-1', 'change');
  await enter(host, 'rfqLineId', 'line-1', 'change');
  await change(supplierRadio(host, 'supplier'));
  for (const [name, value] of Object.entries({
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

// TD-PROC-021：候选清单沿用旧版（全部可读供应商）。暂停 / 已停用的照常列出并带状态徽章（文案沿用
// 供应商控制台：已启用 / 暂停 / 已停用），但不可被选中；因已有值而处于选中时，提交前在表单里拦下。
const candidates = (host: TestElement) =>
  host.querySelectorAll('[data-testid="kt-sq-supplier-choice"]').filter(isTestElement);
const candidateStatus = (host: TestElement) =>
  candidates(host).map((row) => [row.getAttribute('data-status'), row.textContent] as const);

it('TD-PROC-021 lists suspended and inactive suppliers with their status badge and keeps them unselectable', async () => {
  const io = ports();
  io.suppliers = () => [
    { value: 'active', label: '启用供应商', status: 'ACTIVE' },
    { value: 'held', label: '暂停供应商', status: 'ON_HOLD' },
    { value: 'inactive', label: '停用供应商', status: 'INACTIVE' },
  ];
  const host = mount(io);
  await click(testId(host, 'kt-sq-create'));
  // 三家都在候选里，各带自己的状态文案；表单里不再有供应商下拉字段。
  expect(candidateStatus(host)).toEqual([
    ['ACTIVE', '启用供应商已启用'],
    ['ON_HOLD', '暂停供应商暂停'],
    ['INACTIVE', '停用供应商已停用'],
  ]);
  expect(host.querySelector('form.form-section select[name="supplierId"]')).toBe(null);
  const active = supplierRadio(host, 'active');
  const held = supplierRadio(host, 'held');
  const inactive = supplierRadio(host, 'inactive');
  expect([active.disabled, held.disabled, inactive.disabled]).toEqual([false, true, true]);
  const selected = () => candidates(host).map((row) => row.getAttribute('data-selected'));
  expect(selected()).toEqual(['false', 'false', 'false']);
  // 点击被禁用的候选不改变选择（禁用的控件不派发点击）。
  await click(held);
  await click(inactive);
  expect(selected()).toEqual(['false', 'false', 'false']);
  // 测试替身不模拟「禁用的单选钮不会触发 change」：这里故意只派发事件、不改动 checked，
  // 组件照样不把它选上——禁选不依赖控件本身。
  await act(() => {
    held.dispatchEvent(new Event('change', { bubbles: true }));
    inactive.dispatchEvent(new Event('change', { bubbles: true }));
  });
  expect(selected()).toEqual(['false', 'false', 'false']);
  await change(active);
  expect(active.checked).toBe(true);
  expect(selected()).toEqual(['true', 'false', 'false']);
});

it('TD-PROC-021 blocks the submit inside the form when the selected supplier is no longer active', async () => {
  for (const [status, label] of [
    ['ON_HOLD', '暂停'],
    ['INACTIVE', '已停用'],
  ] as const) {
    // 逐个状态各挂载一次；每轮结束即卸载，下一轮不受上一轮的抽屉影响。
    if (root) render(null, root);
    root = installGlobalTestDom().document.createElement('div');
    const host = root;
    let current = 'ACTIVE';
    const io = ports();
    io.suppliers = () => [{ value: 'supplier', label: '新供应商', status: current }];
    render(h(SupplierQuoteConsolePage(io), {}), host);
    await click(testId(host, 'kt-sq-create'));
    await change(supplierRadio(host, 'supplier'));
    expect(supplierRadio(host, 'supplier').disabled).toBe(false);
    // 选定之后这家供应商被暂停 / 停用；候选按最新状态呈现，它仍是选中态，但已不可再选。
    current = status;
    await enter(host, 'rfqId', 'rfq-1', 'change');
    expect(supplierRow(host, 'supplier').getAttribute('data-status')).toBe(status);
    expect(supplierRow(host, 'supplier').getAttribute('data-selected')).toBe('true');
    expect(supplierRadio(host, 'supplier').disabled).toBe(true);
    await enter(host, 'rfqLineId', 'line-1', 'change');
    for (const [name, value] of Object.entries({
      quoteReference: 'SQ-NEW',
      unitPrice: '12.68',
      promisedAt: '2026-12-01',
      validUntil: '2026-11-30',
    }))
      await enter(host, name, value);
    await click(locate(locate(host, 'form.form-section'), 'button[type="submit"]'));
    // 不出确认框、不发请求、不显示成功提示；原因写在表单自己的提示区。
    expect(host.querySelector('[role="alertdialog"]')).toBe(null);
    expect(io.submit).not.toHaveBeenCalled();
    expect(io.refresh).not.toHaveBeenCalled();
    expect(locate(host, 'form.form-section [role="alert"]').textContent).toBe(
      `供应商「新供应商」当前为「${label}」，不能登记报价`,
    );
    expect(host.querySelector('[data-testid="console-notice"]')?.textContent ?? '').toBe('');
  }
});

it('TD-PROC-021 asks for a supplier when none is selected and sends nothing', async () => {
  const io = ports();
  const host = mount(io);
  await click(testId(host, 'kt-sq-create'));
  await enter(host, 'rfqId', 'rfq-1', 'change');
  await enter(host, 'rfqLineId', 'line-1', 'change');
  for (const [name, value] of Object.entries({
    quoteReference: 'SQ-NEW',
    unitPrice: '12.68',
    promisedAt: '2026-12-01',
    validUntil: '2026-11-30',
  }))
    await enter(host, name, value);
  await click(locate(locate(host, 'form.form-section'), 'button[type="submit"]'));
  expect(host.querySelector('[role="alertdialog"]')).toBe(null);
  expect(io.submit).not.toHaveBeenCalled();
  expect(locate(host, 'form.form-section [role="alert"]').textContent).toBe('请选择供应商');
});
