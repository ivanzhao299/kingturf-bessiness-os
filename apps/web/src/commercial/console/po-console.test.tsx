// U3-PROC-3 采购单控制台白盒行为测试（Preact 分域重写后的行为面；
// 原 vanilla 采购订单表单/合同文档工作载荷 oracle 逐条等价迁移——创建固定载荷
// （supplierQuoteId null/CNY/issue:true/含税单价行项）、PUT state issue/cancel 载荷、
// 合同文档三态动作载荷（ocr/ocr-review/signature-envelopes）、权限门、状态筛选/
// 检索、行项收货状态与收货记录呈现、上传门、刷新错误面）。
import { afterEach, describe, expect, it, vi } from 'vitest';
import { h, render } from 'preact';
import type { ComponentType } from 'preact';
import {
  installGlobalTestDom,
  TestDocument,
  TestEvent,
  type TestElement,
} from '../../../test/fixtures/preact-dom';
import { confirmAction } from '../../../test/fixtures/confirm-dialog';
import { PurchaseOrderConsolePage } from './po-console';
import { noticeOf } from '../../../test/fixtures/console-notice';
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

// PROC-UX：收货进度/状态流转夹具——部分收货（行 2000/5000 + 1000/1000 → 整单 3000/6000）。
const partialOrder: PurchaseOrderRow = {
  ...issuedOrder,
  id: 'po-3',
  po_number: 'PO-KT-YARN-2026-003',
  status: 'PARTIALLY_RECEIVED',
  lines: [
    {
      id: 'line-1',
      sku: 'RM-YARN',
      itemName: '草纱',
      quantity: '5000',
      unit_price: '12.5',
      required_at: '2026-12-10',
      receivedQuantity: 2000,
    },
    {
      id: 'line-2',
      sku: 'RM-LATEX',
      itemName: '乳胶',
      quantity: '1000',
      unit_price: '9',
      required_at: '2026-12-10',
      receivedQuantity: 1000,
    },
  ],
};
const cancelledOrder: PurchaseOrderRow = {
  ...order,
  id: 'po-4',
  po_number: 'PO-KT-YARN-2026-004',
  status: 'CANCELLED',
};
// 整单一次收齐：行项已收 = 订购、PO 态 RECEIVED（部分收货节点被跳过）。
const receivedDetail: PurchaseOrderRow = {
  ...poDetail,
  status: 'RECEIVED',
  lines: [
    {
      id: 'line-1',
      sku: 'RM-YARN',
      itemName: '草纱',
      quantity: '5000',
      unit_price: '12.5',
      required_at: '2026-12-10',
      receivedQuantity: 5000,
    },
  ],
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

// PROC-UX：详情打开与状态流转位态读取助手。
const FLOW_STEPS = ['DRAFT', 'ISSUED', 'PARTIALLY_RECEIVED', 'RECEIVED'] as const;
const openDetail = async (ports: PurchaseOrderConsolePorts): Promise<TestElement> => {
  const host = mount(ports);
  element(host.querySelector('[data-testid="kt-po-open"]')).click();
  await flush();
  await flush();
  return host;
};
const flowStatesOf = (host: TestElement): readonly (string | null)[] => {
  const flow = element(host.querySelector('[data-testid="kt-po-flow"]'));
  return FLOW_STEPS.map((step) =>
    element(flow.querySelector(`[data-step="${step}"]`)).getAttribute('data-state'),
  );
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
    // TD-WF-014②：签发不可逆，单击先出确认框，确认后才发请求。
    await flush();
    expect(ports.submit).not.toHaveBeenCalled();
    await confirmAction(host, '签发采购订单', '确认签发');
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
    // TD-WF-014②：取消是破坏性动作，确认框的初焦落在「取消」（即不执行）上。
    await flush();
    expect(ports.submit).not.toHaveBeenCalled();
    await confirmAction(host, '取消采购订单', '确认取消', { destructive: true });
    expect(ports.submit).toHaveBeenCalledExactlyOnceWith(
      '/api/v1/purchase-orders/po-2/state',
      { action: 'cancel' },
      'PUT',
    );
  });

  // TD-WF-008（写流程冒烟 WS-P2-05）：取消订单后列表刷新了，开着的抽屉却还是「已签发」、
  // 「取消订单」按钮也还在——再点一次就是 404。
  it('取消订单后，开着的详情抽屉跟上刷新：「已取消」且不再有「取消订单」按钮，详情重读一次', async () => {
    const loadDetail = vi
      .fn()
      .mockResolvedValueOnce(poDetail)
      .mockResolvedValue({ ...poDetail, status: 'CANCELLED' });
    const ports = portsFor([issuedOrder], ALL_PERMISSIONS, {
      refresh: vi
        .fn()
        .mockResolvedValue({ orders: [{ ...issuedOrder, status: 'CANCELLED' }], documents: [] }),
      loadDetail,
    });
    const host = mount(ports);
    element(host.querySelector('[data-testid="kt-po-open"]')).click();
    await flush();
    await flush();
    const badgeOf = (): string =>
      element(host.querySelector('[data-testid="kt-po-detail"] .status-badge')).textContent.trim();
    expect(badgeOf()).toBe('已签发');
    element(host.querySelector('[data-testid="kt-po-cancel"]')).click();
    await confirmAction(host, '取消采购订单', '确认取消', { destructive: true });
    await flush();
    await flush();
    expect(ports.submit).toHaveBeenCalledTimes(1);
    // 抽屉还开着，内容是刷新后的：状态徽章、按钮都跟着变。
    expect(host.querySelector('[data-testid="kt-po-detail"]')).not.toBeNull();
    expect(badgeOf()).toBe('已取消');
    expect(host.querySelector('[data-testid="kt-po-cancel"]')).toBeNull();
    expect(host.querySelector('[data-testid="kt-po-issue"]')).toBeNull();
    // 打开时读一次，写操作后重读一次。
    expect(loadDetail).toHaveBeenCalledTimes(2);
    expect(loadDetail).toHaveBeenLastCalledWith('po-2');
  });

  it('写操作后记录已不在列表里：抽屉关闭，不停留在过期对象上', async () => {
    const loadDetail = vi.fn().mockResolvedValue(poDetail);
    const ports = portsFor([issuedOrder], ALL_PERMISSIONS, {
      refresh: vi.fn().mockResolvedValue({ orders: [], documents: [] }),
      loadDetail,
    });
    const host = mount(ports);
    element(host.querySelector('[data-testid="kt-po-open"]')).click();
    await flush();
    await flush();
    element(host.querySelector('[data-testid="kt-po-cancel"]')).click();
    await confirmAction(host, '取消采购订单', '确认取消', { destructive: true });
    await flush();
    await flush();
    expect(host.querySelector('.detail-drawer')).toBeNull();
  });

  // 迟到的详情响应：期间抽屉已关掉、或已换成另一条——不替换。
  it('迟到的详情不会把关掉的抽屉重新打开，也不会把抽屉换成别的记录', async () => {
    let resolveFirst: (detail: PurchaseOrderRow) => void = () => undefined;
    const loadDetail = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<PurchaseOrderRow>((resolve) => {
            resolveFirst = resolve;
          }),
      )
      .mockResolvedValue({ ...poDetail, ...cancelledOrder });
    const ports = portsFor([issuedOrder, cancelledOrder], ALL_PERMISSIONS, { loadDetail });
    const host = mount(ports);
    const open = (index: number): void => {
      element(host.querySelectorAll('[data-testid="kt-po-open"]')[index] ?? null).click();
    };
    open(0);
    await flush();
    open(1);
    await flush();
    await flush();
    // 第二条的详情已到；第一条的详情此刻才到。
    expect(
      element(host.querySelector('[data-testid="kt-po-detail"] .status-badge')).textContent.trim(),
    ).toBe('已取消');
    resolveFirst(poDetail);
    await flush();
    expect(
      element(host.querySelector('[data-testid="kt-po-detail"] .status-badge')).textContent.trim(),
    ).toBe('已取消');
    element(element(host.querySelector('.detail-drawer')).querySelector('.drawer-close')).click();
    await flush();
    expect(host.querySelector('.detail-drawer')).toBeNull();
  });

  // TD-WF-014②：确认框里点「取消」或按 Esc 都不执行动作，焦点回到触发按钮，抽屉不受影响。
  it('签发的确认框：不确认就不发请求（取消按钮 / Esc），确认框关掉后焦点回到「签发订单」', async () => {
    const ports = portsFor([order], ALL_PERMISSIONS);
    const host = mount(ports);
    element(host.querySelector('[data-testid="kt-po-open"]')).click();
    await flush();
    const trigger = element(host.querySelector('[data-testid="kt-po-issue"]'));
    trigger.focus();
    trigger.click();
    await flush();
    const dialog = element(host.querySelector('[role="alertdialog"]'));
    expect(dialog.textContent).toContain('签发采购订单');
    expect(dialog.textContent).toContain('PO-KT-YARN-2026-001');
    const buttons = dialog.querySelectorAll('button');
    // 初焦进入确认框（缺省在确认按钮上）。
    expect(TestDocument.current.activeElement).toBe(buttons[1]);
    element(buttons[0]).click();
    await flush();
    expect(host.querySelector('[role="alertdialog"]')).toBe(null);
    expect(ports.submit).not.toHaveBeenCalled();
    expect(TestDocument.current.activeElement).toBe(trigger);
    expect(host.querySelector('[data-testid="kt-po-detail"]')).not.toBeNull();

    trigger.click();
    await flush();
    const reopened = element(host.querySelector('[role="alertdialog"]'));
    reopened
      .querySelectorAll('button')[1]
      ?.dispatchEvent(new TestEvent('keydown', { key: 'Escape' }));
    await flush();
    expect(host.querySelector('[role="alertdialog"]')).toBe(null);
    expect(ports.submit).not.toHaveBeenCalled();
    expect(TestDocument.current.activeElement).toBe(trigger);
    expect(host.querySelector('[data-testid="kt-po-detail"]')).not.toBeNull();
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

  it('列表收货进度列：草稿显示未签发；其余按 Σ已收/Σ订购 呈百分比进度条', () => {
    const ports = portsFor([order, partialOrder, cancelledOrder]);
    const host = mount(ports);
    const cells = host.querySelectorAll('[data-testid="kt-po-progress-cell"]').map(element);
    // 草稿（未签发）无进度单元；部分收货 3000/6000；已取消仍呈已收比例（0%）。
    expect(cells).toHaveLength(2);
    expect(cells[0]?.textContent).toBe('50%');
    expect(cells[0]?.getAttribute('data-percent')).toBe('50');
    expect(cells[1]?.getAttribute('data-percent')).toBe('0');
    const partialRow = host.querySelectorAll('tbody tr')[1];
    const bar = element(partialRow?.querySelector('[role="progressbar"]'));
    expect(bar.getAttribute('aria-valuenow')).toBe('50');
    expect(bar.getAttribute('aria-valuemin')).toBe('0');
    expect(bar.getAttribute('aria-valuemax')).toBe('100');
    expect(bar.getAttribute('aria-label')).toBe('PO-KT-YARN-2026-003收货进度');
    const row = host.querySelectorAll('tbody tr')[0];
    expect(element(row?.querySelector('[data-column="progress"]')).textContent).toBe('未签发');
    expect(row?.querySelector('[role="progressbar"]')).toBe(null);
  });

  it('详情抽屉状态流转图：整单一次收齐（RECEIVED）时部分收货节点为 skipped', async () => {
    const host = await openDetail(
      portsFor([issuedOrder], [], { loadDetail: vi.fn().mockResolvedValue(receivedDetail) }),
    );
    const flow = element(host.querySelector('[data-testid="kt-po-flow"]'));
    expect(flow.getAttribute('data-status')).toBe('RECEIVED');
    expect(flow.textContent).toContain('当前：已收货');
    expect(flowStatesOf(host)).toEqual(['done', 'done', 'skipped', 'current']);
    expect(element(flow.querySelector('[data-step="RECEIVED"]')).getAttribute('aria-current')).toBe(
      'step',
    );
    for (const step of ['草稿', '已签发', '部分收货', '已收货'])
      expect(flow.textContent).toContain(step);
    const progress = element(host.querySelector('[data-testid="kt-po-progress"]'));
    expect(
      element(progress.querySelector('[data-testid="kt-po-progress-total"]')).getAttribute(
        'data-percent',
      ),
    ).toBe('100');
    expect(progress.textContent).toContain('已收 5000.00 / 5000.00（100%）');
  });

  it('详情抽屉：部分收货——流转至部分收货节点，整单与逐行进度条各自计量', async () => {
    const host = await openDetail(
      portsFor([partialOrder], [], { loadDetail: vi.fn().mockResolvedValue(partialOrder) }),
    );
    const flow = element(host.querySelector('[data-testid="kt-po-flow"]'));
    expect(flowStatesOf(host)).toEqual(['done', 'done', 'current', 'upcoming']);
    // 已到达节点的连接线为已流转色，未到达为待流转。
    expect(flow.querySelectorAll('[data-connector="reached"]')).toHaveLength(2);
    expect(flow.querySelectorAll('[data-connector="pending"]')).toHaveLength(1);
    const progress = element(host.querySelector('[data-testid="kt-po-progress"]'));
    expect(progress.textContent).toContain('整单');
    expect(progress.textContent).toContain('已收 3000.00 / 6000.00（50%）');
    expect(progress.textContent).toContain('RM-YARN');
    expect(progress.textContent).toContain('已收 2000.00 / 5000.00（40%）');
    expect(progress.textContent).toContain('已收 1000.00 / 1000.00（100%）');
    expect(progress.querySelectorAll('[role="progressbar"]')).toHaveLength(3);
  });

  it('详情抽屉：已取消订单流转图全部未到达；草稿订单进度区显示未签发', async () => {
    const cancelledHost = await openDetail(
      portsFor([cancelledOrder], [], {
        loadDetail: vi.fn().mockResolvedValue(cancelledOrder),
      }),
    );
    const cancelledFlow = element(cancelledHost.querySelector('[data-testid="kt-po-flow"]'));
    expect(cancelledFlow.getAttribute('data-status')).toBe('CANCELLED');
    expect(cancelledFlow.textContent).toContain('当前：已取消');
    expect(cancelledFlow.querySelectorAll('[data-state="upcoming"]')).toHaveLength(4);
    expect(cancelledFlow.querySelectorAll('[data-connector="reached"]')).toHaveLength(0);
    const draftHost = await openDetail(
      portsFor([order], [], { loadDetail: vi.fn().mockResolvedValue(order) }),
    );
    expect(flowStatesOf(draftHost)).toEqual(['current', 'upcoming', 'upcoming', 'upcoming']);
    const draftProgress = element(draftHost.querySelector('[data-testid="kt-po-progress"]'));
    expect(draftProgress.textContent).toContain('未签发，暂无收货');
    expect(draftProgress.querySelector('[role="progressbar"]')).toBe(null);
  });
});

describe('U3-PROC-3 采购单控制台：写成功后的提示（TD-WF-014①）', () => {
  it('取消订单成功：提示在开着的详情抽屉底部', async () => {
    const ports = portsFor([issuedOrder], ALL_PERMISSIONS, {
      refresh: vi.fn().mockResolvedValue({
        orders: [{ ...issuedOrder, status: 'CANCELLED' }],
        documents: [],
      }),
    });
    const host = mount(ports);
    element(host.querySelector('[data-testid="kt-po-open"]')).click();
    await flush();
    element(host.querySelector('[data-testid="kt-po-cancel"]')).click();
    await confirmAction(host, '取消采购订单', '确认取消', { destructive: true });
    await flush();
    await flush();
    expect(noticeOf(host)).toEqual({
      text: '已取消采购订单 PO-KT-YARN-2026-002',
      inDrawer: true,
    });
  });
});
