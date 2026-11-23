// U3-PROC-4 收货控制台白盒行为测试（Preact 分域重写后的行为面；
// 原 vanilla「登记批次收货」表单载荷 oracle 逐条等价迁移——receivedAt 当前时刻/
// expiresAt null/订单行拆分、权限门、检索、批次行项与数量核对呈现、刷新错误面；
// 部分收货/超收守护全在后端 legacy receive() 同链，前端不重复实现）。
import { afterEach, describe, expect, it, vi } from 'vitest';
import { h, render } from 'preact';
import type { ComponentType } from 'preact';
import { installGlobalTestDom, type TestElement } from '../../../test/fixtures/preact-dom';
import { GoodsReceiptConsolePage } from './gr-console';
import type { GoodsReceiptConsolePorts, GoodsReceiptRow } from './gr-ports';

const flush = (): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, 0);
  });

const element = (node: unknown): TestElement => {
  if (node === null || node === undefined || (node as { nodeType?: number }).nodeType !== 1)
    throw new Error(`expected element, got ${String(node)}`);
  return node as TestElement;
};

const receipt: GoodsReceiptRow = {
  id: 'gr-1',
  receipt_number: 'GR-KT-YARN-2026-001',
  purchase_order_id: 'po-1',
  poNumber: 'PO-KT-YARN-2026-001',
  received_at: '2026-11-08T00:00:00.000Z',
  source_reference: 'delivery-001',
  lines: [
    {
      id: 'grl-1',
      sku: 'RM-YARN',
      lotNumber: 'LOT-KT-YARN-A',
      locationCode: 'RAW-A01',
      quantity: '5000',
    },
  ],
};

const grDetail: GoodsReceiptRow = {
  ...receipt,
  poStatus: 'RECEIVED',
  purchaseOrder: {
    id: 'po-1',
    poNumber: 'PO-KT-YARN-2026-001',
    status: 'RECEIVED',
    lines: [{ id: 'line-1', sku: 'RM-YARN', quantity: '5000', receivedQuantity: 5000 }],
  },
};

const portsFor = (
  receipts: readonly GoodsReceiptRow[] = [receipt],
  extraPermissions: readonly string[] = [],
  overrides: Partial<GoodsReceiptConsolePorts> = {},
): GoodsReceiptConsolePorts => ({
  permissions: new Set(['procurement:read', ...extraPermissions]),
  initialReceipts: receipts,
  openOrderLineChoices: [
    { value: 'po-1|line-1', label: 'PO-KT-YARN-2026-001 · RM-YARN · 未收 5000.00' },
  ],
  locationChoices: [{ value: 'RAW-A01', label: 'RAW-A01 · 原料一区' }],
  recordText: (record, camel, snake, fallback = '') => {
    const value = record[camel] ?? record[snake] ?? fallback;
    return typeof value === 'string' || typeof value === 'number' ? String(value) : fallback;
  },
  textValue: (value, fallback = '') =>
    typeof value === 'string' || typeof value === 'number' ? String(value) : fallback,
  decimalValue: (value) => value.toFixed(2),
  submit: vi.fn().mockResolvedValue(null),
  loadDetail: vi.fn().mockResolvedValue(null),
  refresh: vi.fn().mockResolvedValue(receipts),
  ...overrides,
});

const mount = (ports: GoodsReceiptConsolePorts): TestElement => {
  const host = installGlobalTestDom().document.createElement('div');
  render(h(GoodsReceiptConsolePage(ports) as ComponentType, {}), host);
  return host;
};

const fillField = (host: TestElement, name: string, value: string): void => {
  const drawer = element(host.querySelector('.detail-drawer'));
  const select = drawer
    .querySelectorAll('select')
    .find((item) => (item as TestElement).getAttribute('name') === name) as TestElement | undefined;
  if (select) {
    select.value = value;
    select.dispatchEvent(new Event('input', { bubbles: true }));
    return;
  }
  const input = drawer
    .querySelectorAll('input,textarea')
    .find((item) => (item as TestElement).getAttribute('name') === name) as TestElement | undefined;
  if (!input) throw new Error(`missing field ${name}`);
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
};

const submitDrawer = async (host: TestElement): Promise<void> => {
  element(
    element(host.querySelector('.detail-drawer')).querySelector('button[type="submit"]'),
  ).click();
  await flush();
};

const CREATE_FORM: readonly (readonly [string, string])[] = [
  ['orderLine', 'po-1|line-1'],
  ['receiptNumber', 'GR-KT-YARN-2026-002'],
  ['sourceReference', 'delivery-002'],
  ['lotNumber', 'LOT-KT-YARN-B'],
  ['locationCode', 'RAW-A01'],
  ['quantity', '2000'],
  ['manufacturedAt', '2026-11-15'],
];

afterEach(() => {
  vi.restoreAllMocks();
});

describe('U3-PROC-4 收货控制台', () => {
  it('登记收货使用 vanilla 同款固定载荷（receivedAt 当前时刻/expiresAt null/订单行拆分）', async () => {
    const ports = portsFor([], ['procurement:manage']);
    const host = mount(ports);
    element(host.querySelector('[data-testid="kt-gr-create"]')).click();
    await flush();
    for (const [name, value] of CREATE_FORM) fillField(host, name, value);
    await flush();
    await submitDrawer(host);
    const call = vi.mocked(ports.submit).mock.calls[0];
    expect(call?.[0]).toBe('/api/v1/goods-receipts');
    expect(call?.[1]).toEqual({
      receiptNumber: 'GR-KT-YARN-2026-002',
      purchaseOrderId: 'po-1',
      receivedAt: call?.[1].receivedAt,
      sourceReference: 'delivery-002',
      lines: [
        {
          purchaseOrderLineId: 'line-1',
          lotNumber: 'LOT-KT-YARN-B',
          locationCode: 'RAW-A01',
          quantity: '2000',
          manufacturedAt: '2026-11-15',
          expiresAt: null,
        },
      ],
    });
    expect(typeof call?.[1].receivedAt).toBe('string');
    expect(isNaN(Date.parse(call?.[1].receivedAt as string))).toBe(false);
    expect(ports.refresh).toHaveBeenCalledTimes(1);
  });

  it('权限门：无 procurement:manage 时不出现登记按钮', () => {
    const ports = portsFor([receipt]);
    const host = mount(ports);
    expect(host.querySelector('[data-testid="kt-gr-create"]')).toBe(null);
    expect(ports.submit).not.toHaveBeenCalled();
  });

  it('检索：收货单号命中', async () => {
    const second = {
      ...receipt,
      id: 'gr-2',
      receipt_number: 'GR-KT-YARN-2026-002',
      poNumber: 'PO-KT-YARN-2026-002',
    };
    const ports = portsFor([receipt, second]);
    const host = mount(ports);
    expect(host.querySelectorAll('tbody tr')).toHaveLength(2);
    const search = element(host.querySelector('[data-testid="kt-gr-search"]'));
    search.value = '2026-001';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    await flush();
    expect(host.textContent).toContain('GR-KT-YARN-2026-001');
    expect(host.textContent).not.toContain('GR-KT-YARN-2026-002');
  });

  it('详情抽屉展示批次行项与数量核对（loadDetail 详情优先）', async () => {
    const ports = portsFor([receipt], [], { loadDetail: vi.fn().mockResolvedValue(grDetail) });
    const host = mount(ports);
    element(host.querySelector('[data-testid="kt-gr-open"]')).click();
    await flush();
    await flush();
    const drawer = element(host.querySelector('.detail-drawer'));
    expect(drawer.textContent).toContain('GR-KT-YARN-2026-001');
    const lines = element(host.querySelector('[data-testid="kt-gr-lines"]'));
    expect(lines.textContent).toContain('LOT-KT-YARN-A');
    expect(lines.textContent).toContain('RAW-A01');
    expect(lines.textContent).toContain('实收 5000');
    const check = element(host.querySelector('[data-testid="kt-gr-quantity-check"]'));
    expect(check.textContent).toContain('PO-KT-YARN-2026-001');
    expect(check.textContent).toContain('订购 5000');
    expect(check.textContent).toContain('已收 5000');
  });

  it('刷新失败时错误经 DataTable error 面暴露', async () => {
    const ports = portsFor([receipt], [], {
      refresh: vi.fn().mockRejectedValue(new Error('收货单加载失败')),
    });
    const host = mount(ports);
    element(host.querySelector('[data-testid="kt-gr-refresh"]')).click();
    await flush();
    await flush();
    expect(host.querySelector('.data-table-error')).not.toBeNull();
    expect(host.textContent).toContain('收货单加载失败');
  });
});
