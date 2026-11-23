// U3-PROC-3 采购单控制台白盒行为测试（Preact 分域重写后的行为面；
// 原 vanilla 采购订单表单/合同文档工作载荷 oracle 逐条等价迁移——创建固定载荷
// （supplierQuoteId null/CNY/issue:true/含税单价行项）、PUT state issue/cancel 载荷、
// 合同文档三态动作载荷（ocr/ocr-review/signature-envelopes）、权限门、状态筛选/
// 检索、行项收货状态与收货记录呈现、上传门、刷新错误面）。
import { afterEach, describe, expect, it, vi } from 'vitest';
import { h, render } from 'preact';
import type { ComponentType } from 'preact';
import { installGlobalTestDom, type TestElement } from '../../../test/fixtures/preact-dom';
import { PurchaseOrderConsolePage } from './po-console';
import type { PurchaseOrderConsolePorts, PurchaseOrderRow } from './po-ports';

const flush = (): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, 0);
  });

const element = (node: unknown): TestElement => {
  if (node === null || node === undefined || (node as { nodeType?: number }).nodeType !== 1)
    throw new Error(`expected element, got ${String(node)}`);
  return node as TestElement;
};

const order: PurchaseOrderRow = {
  id: 'po-1',
  po_number: 'PO-KT-YARN-2026-001',
  status: 'DRAFT',
  currency: 'CNY',
  supplierName: '青岛金特夫草纱战略供应商',
  lines: [
    {
      id: 'line-1',
      sku: 'RM-YARN',
      itemName: '草纱',
      quantity: '5000',
      unit_price: '12.5',
      required_at: '2026-12-10',
      receivedQuantity: 0,
    },
  ],
};

const issuedOrder: PurchaseOrderRow = {
  ...order,
  id: 'po-2',
  po_number: 'PO-KT-YARN-2026-002',
  status: 'ISSUED',
};

const poDetail: PurchaseOrderRow = {
  ...issuedOrder,
  receipts: [
    {
      id: 'gr-1',
      receipt_number: 'GR-KT-YARN-2026-001',
      received_at: '2026-11-08T00:00:00.000Z',
      source_reference: 'delivery-001',
      lines: [
        {
          id: 'grl-1',
          lotNumber: 'LOT-KT-YARN-A',
          locationCode: 'RAW-A01',
          sku: 'RM-YARN',
          quantity: '5000',
        },
      ],
    },
  ],
};

const document: PurchaseOrderRow = {
  id: 'doc-1',
  subject_id: 'po-1',
  attachment_name: '采购合同.pdf',
  state: 'OCR_REVIEW',
  ocr_text: '识别全文',
  ocr_provider: '企业OCR适配器',
  ocr_confidence: 0.95,
  extractedFields: { contractNumber: 'CT-1', supplier: '青岛金特夫', amount: '62500' },
};

const ALL_PERMISSIONS = [
  'procurement:read',
  'procurement:manage',
  'contract-document:manage',
  'contract-ocr:operate',
  'contract-ocr:review',
  'contract-signature:send',
];

const portsFor = (
  orders: readonly PurchaseOrderRow[] = [order],
  extraPermissions: readonly string[] = [],
  overrides: Partial<PurchaseOrderConsolePorts> = {},
): PurchaseOrderConsolePorts => ({
  permissions: new Set(['procurement:read', ...extraPermissions]),
  initialOrders: orders,
  itemVersionChoices: [{ value: 'item-v1', label: 'RM-YARN · 草纱' }],
  supplierChoices: [{ value: 'supplier-1', label: 'SUP-1 · 青岛金特夫草纱战略供应商' }],
  initialDocuments: orders.some((item) => item.id === 'po-1') ? [document] : [],
  recordText: (record, camel, snake, fallback = '') => {
    const value = record[camel] ?? record[snake] ?? fallback;
    return typeof value === 'string' || typeof value === 'number' ? String(value) : fallback;
  },
  textValue: (value, fallback = '') =>
    typeof value === 'string' || typeof value === 'number' ? String(value) : fallback,
  decimalValue: (value) => value.toFixed(2),
  businessStateLabel: (value, fallback = '') =>
    typeof value === 'string' && value.length > 0 ? value : fallback,
  submit: vi.fn().mockResolvedValue(null),
  uploadContractDocument: vi.fn().mockResolvedValue({}),
  loadDetail: vi.fn().mockResolvedValue(null),
  refresh: vi.fn().mockResolvedValue({
    orders,
    documents: orders.some((item) => item.id === 'po-1') ? [document] : [],
  }),
  ...overrides,
});

const mount = (ports: PurchaseOrderConsolePorts): TestElement => {
  const host = installGlobalTestDom().document.createElement('div');
  render(h(PurchaseOrderConsolePage(ports) as ComponentType, {}), host);
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
  ['poNumber', 'PO-KT-YARN-2026-003'],
  ['supplierId', 'supplier-1'],
  ['itemVersionId', 'item-v1'],
  ['quantity', '5000'],
  ['unitPrice', '12.5'],
  ['requiredAt', '2026-12-10'],
];

afterEach(() => {
  vi.restoreAllMocks();
});

describe('U3-PROC-3 采购单控制台', () => {
  it('创建采购订单使用 vanilla 同款固定载荷（supplierQuoteId null/CNY/issue:true/含税单价行项）', async () => {
    const ports = portsFor([], ALL_PERMISSIONS);
    const host = mount(ports);
    element(host.querySelector('[data-testid="kt-po-create"]')).click();
    await flush();
    for (const [name, value] of CREATE_FORM) fillField(host, name, value);
    await flush();
    await submitDrawer(host);
    expect(ports.submit).toHaveBeenCalledExactlyOnceWith('/api/v1/purchase-orders', {
      poNumber: 'PO-KT-YARN-2026-003',
      supplierId: 'supplier-1',
      supplierQuoteId: null,
      currency: 'CNY',
      issue: true,
      lines: [
        {
          itemVersionId: 'item-v1',
          quantity: '5000',
          unitPrice: '12.5',
          requiredAt: '2026-12-10',
        },
      ],
    });
    expect(ports.refresh).toHaveBeenCalledTimes(1);
  });

  it('DRAFT 订单可签发（PUT state issue）并刷新', async () => {
    const ports = portsFor([order], ALL_PERMISSIONS);
    const host = mount(ports);
    element(host.querySelector('[data-testid="kt-po-open"]')).click();
    await flush();
    element(host.querySelector('[data-testid="kt-po-issue"]')).click();
    await flush();
    expect(ports.submit).toHaveBeenCalledExactlyOnceWith(
      '/api/v1/purchase-orders/po-1/state',
      { action: 'issue' },
      'PUT',
    );
    expect(ports.refresh).toHaveBeenCalledTimes(1);
  });

  it('ISSUED 订单仅可取消（PUT state cancel）', async () => {
    const ports = portsFor([issuedOrder], ALL_PERMISSIONS);
    const host = mount(ports);
    element(host.querySelector('[data-testid="kt-po-open"]')).click();
    await flush();
    expect(host.querySelector('[data-testid="kt-po-issue"]')).toBe(null);
    element(host.querySelector('[data-testid="kt-po-cancel"]')).click();
    await flush();
    expect(ports.submit).toHaveBeenCalledExactlyOnceWith(
      '/api/v1/purchase-orders/po-2/state',
      { action: 'cancel' },
      'PUT',
    );
  });

  it('详情抽屉展示行项收货状态与收货记录（loadDetail 详情优先）', async () => {
    const ports = portsFor([issuedOrder], [], { loadDetail: vi.fn().mockResolvedValue(poDetail) });
    const host = mount(ports);
    element(host.querySelector('[data-testid="kt-po-open"]')).click();
    await flush();
    await flush();
    const drawer = element(host.querySelector('.detail-drawer'));
    expect(drawer.textContent).toContain('PO-KT-YARN-2026-002');
    const lines = element(host.querySelector('[data-testid="kt-po-lines"]'));
    expect(lines.textContent).toContain('RM-YARN · 草纱');
    expect(lines.textContent).toContain('单价 12.5');
    const receipts = element(host.querySelector('[data-testid="kt-po-receipts"]'));
    expect(receipts.textContent).toContain('GR-KT-YARN-2026-001');
    expect(receipts.textContent).toContain('LOT-KT-YARN-A');
    expect(receipts.textContent).toContain('RAW-A01');
  });

  it('合同文档工作流：OCR_REVIEW 状态出现复核入口且载荷与 vanilla 逐字段一致', async () => {
    const ports = portsFor([order], ALL_PERMISSIONS);
    const host = mount(ports);
    element(host.querySelector('[data-testid="kt-po-open"]')).click();
    await flush();
    await flush();
    const documents = element(host.querySelector('[data-testid="kt-po-documents"]'));
    expect(documents.textContent).toContain('采购合同.pdf');
    element(host.querySelector('[data-testid="kt-po-doc-review"]')).click();
    await flush();
    fillField(host, 'text', '校正后全文');
    await flush();
    await submitDrawer(host);
    expect(ports.submit).toHaveBeenCalledExactlyOnceWith(
      '/api/v1/contract-documents/doc-1/ocr-review',
      {
        provider: '企业OCR适配器',
        text: '校正后全文',
        fields: { contractNumber: 'CT-1', supplier: '青岛金特夫', amount: '62500' },
        confidence: 0.95,
      },
    );
  });

  it('合同文档门：无 contract-ocr:review 时不出现复核入口；上传按钮受 contract-document:manage 门', async () => {
    const ports = portsFor([order], ['procurement:manage']);
    const host = mount(ports);
    element(host.querySelector('[data-testid="kt-po-open"]')).click();
    await flush();
    expect(host.querySelector('[data-testid="kt-po-doc-review"]')).toBe(null);
    expect(host.querySelector('[data-testid="kt-po-doc-upload"]')).toBe(null);
    const fullPorts = portsFor([order], ALL_PERMISSIONS);
    const fullHost = mount(fullPorts);
    fullHost.querySelectorAll('[data-testid="kt-po-open"]');
    element(fullHost.querySelector('[data-testid="kt-po-open"]')).click();
    await flush();
    expect(fullHost.querySelector('[data-testid="kt-po-doc-upload"]')).not.toBe(null);
    expect(fullPorts.submit).not.toHaveBeenCalled();
  });

  it('状态筛选与检索：ISSUED 过滤 + 编号检索命中', async () => {
    const ports = portsFor([order, issuedOrder]);
    const host = mount(ports);
    expect(host.querySelectorAll('tbody tr')).toHaveLength(2);
    element(host.querySelector('[data-testid="kt-po-filter-issued"]')).click();
    await flush();
    expect(host.textContent).toContain('PO-KT-YARN-2026-002');
    expect(host.textContent).not.toContain('PO-KT-YARN-2026-001');
    const search = element(host.querySelector('[data-testid="kt-po-search"]'));
    search.value = '2026-001';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    element(host.querySelector('[data-testid="kt-po-filter-all"]')).click();
    await flush();
    expect(host.textContent).toContain('PO-KT-YARN-2026-001');
    expect(host.textContent).not.toContain('PO-KT-YARN-2026-002');
  });

  it('刷新失败时错误经 DataTable error 面暴露', async () => {
    const ports = portsFor([order], [], {
      refresh: vi.fn().mockRejectedValue(new Error('采购订单加载失败')),
    });
    const host = mount(ports);
    element(host.querySelector('[data-testid="kt-po-refresh"]')).click();
    await flush();
    await flush();
    expect(host.querySelector('.data-table-error')).not.toBeNull();
    expect(host.textContent).toContain('采购订单加载失败');
  });
});
