// U3-PROC-4 收货控制台白盒行为测试（Preact 分域重写后的行为面；
// 原 vanilla「登记批次收货」表单载荷 oracle 逐条等价迁移——receivedAt 当前时刻/
// expiresAt null/订单行拆分、权限门、检索、批次行项与数量核对呈现、刷新错误面；
// 部分收货/超收守护全在后端 legacy receive() 同链，前端不重复实现）。
// PROC-UX：批次追踪时间线（收货→质检→入库）呈现——loadTraceSources 事实面组合：
// 三节点齐全/三面全不可见/仅库存状态/进行中与拒收/未开检与读取失败降级。
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

// PROC-UX：批次追踪事实面（loadTraceSources → quality-inspections/lot-traceability/
// inventory-balances 视图行）夹具。详情行项含 lot_id 供批次匹配。
const tracedDetail: GoodsReceiptRow = {
  ...grDetail,
  lines: [{ ...(receipt.lines as Record<string, unknown>[])[0], lot_id: 'lot-1' }],
};
const inspectionSource: Record<string, unknown> = {
  id: 'qi-1',
  lot_id: 'lot-1',
  inspection_number: 'QI-KT-YARN-2026-001',
  state: 'DISPOSITIONED',
  events: [
    {
      sequence: 1,
      state: 'OPEN',
      actor_id: 'e-inspector',
      created_at: '2026-11-09T01:00:00.000Z',
      evidence: {},
    },
    {
      sequence: 2,
      state: 'DISPOSITIONED',
      actor_id: 'e-qm',
      created_at: '2026-11-10T02:00:00.000Z',
      reason: 'Incoming inspection passed',
      evidence: { state: 'RELEASED' },
    },
  ],
  results: [{ passed: true }, { passed: true }, { passed: false }],
};
const lotSource: Record<string, unknown> = {
  lotId: 'lot-1',
  lotNumber: 'LOT-KT-YARN-A',
  qualityStatus: 'RELEASED',
  qualityEvents: [
    {
      sequence: 1,
      state: 'QUARANTINE',
      actor_id: 'e-inspector',
      created_at: '2026-11-09T01:00:00.000Z',
      reason: 'Inspection opened',
    },
    {
      sequence: 2,
      state: 'RELEASED',
      actor_id: 'e-qm',
      created_at: '2026-11-10T02:00:00.000Z',
      reason: 'Incoming inspection passed',
    },
  ],
};
const fullSources = {
  inspections: [inspectionSource],
  lots: [lotSource],
  balances: null,
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
  // PROC-UX：事实面缺省（undefined）= 时间线端口未接线；用例按需覆盖。
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
    // 事实面未接线/未返回时不渲染时间线。
    expect(host.querySelector('[data-testid="kt-gr-trace"]')).toBe(null);
  });

  it('批次追踪时间线：三节点齐全（状态/时间/结果，loadTraceSources 事实面组合）', async () => {
    const ports = portsFor([receipt], [], {
      loadDetail: vi.fn().mockResolvedValue(tracedDetail),
      loadTraceSources: vi.fn().mockResolvedValue(fullSources),
    });
    const host = mount(ports);
    element(host.querySelector('[data-testid="kt-gr-open"]')).click();
    await flush();
    await flush();
    // Web 端无员工目录视图：操作人以「—」呈现（显示名解析属服务端方案 TD-PROC-006）。
    const trace = element(host.querySelector('[data-testid="kt-gr-trace"]'));
    expect(trace.textContent).toContain('批次 LOT-KT-YARN-A');
    expect(trace.textContent).toContain('RM-YARN · 实收 5000 @ RAW-A01');
    expect(trace.textContent).not.toContain('收货员张三');
    const lot = element(host.querySelector('[data-testid="kt-gr-trace-lot"]'));
    expect(lot.getAttribute('data-access')).toBe('full');
    const receiptNode = element(host.querySelector('[data-testid="kt-gr-trace-receipt"]'));
    expect(receiptNode.getAttribute('data-state')).toBe('DONE');
    expect(receiptNode.textContent).toContain('已完成');
    expect(receiptNode.textContent).toContain('实收 5000 @ RAW-A01 · 送货单 delivery-001');
    expect(receiptNode.textContent).toContain('操作人 —');
    // 时间：本地时区「YYYY-MM-DD HH:mm」呈现 + datetime 保留原始 ISO（时区无关断言）。
    expect(element(receiptNode.querySelector('time')).getAttribute('datetime')).toBe(
      '2026-11-08T00:00:00.000Z',
    );
    expect(element(receiptNode.querySelector('time')).textContent).toMatch(
      /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/u,
    );
    const inspection = element(host.querySelector('[data-testid="kt-gr-trace-inspection"]'));
    expect(inspection.textContent).toContain('已完成');
    expect(inspection.textContent).toContain('QI-KT-YARN-2026-001 · 合格 2/3 项');
    expect(element(inspection.querySelector('time')).getAttribute('datetime')).toBe(
      '2026-11-10T02:00:00.000Z',
    );
    const stockIn = element(host.querySelector('[data-testid="kt-gr-trace-stock-in"]'));
    expect(stockIn.getAttribute('data-state')).toBe('DONE');
    expect(stockIn.textContent).toContain('已放行入库');
  });

  it('批次追踪时间线：三事实面全部不可见（403）时质检与入库节点呈无查看权限（收货节点保留）', async () => {
    const host = mount(
      portsFor([receipt], [], {
        loadDetail: vi.fn().mockResolvedValue(tracedDetail),
        loadTraceSources: vi.fn().mockResolvedValue({
          inspections: null,
          lots: null,
          balances: null,
        }),
      }),
    );
    element(host.querySelector('[data-testid="kt-gr-open"]')).click();
    await flush();
    await flush();
    expect(
      element(host.querySelector('[data-testid="kt-gr-trace-lot"]')).getAttribute('data-access'),
    ).toBe('receipt');
    for (const testid of ['kt-gr-trace-inspection', 'kt-gr-trace-stock-in']) {
      const node = element(host.querySelector(`[data-testid="${testid}"]`));
      expect(node.getAttribute('data-state')).toBe('UNAVAILABLE');
      expect(node.textContent).toContain('无查看权限');
      expect(node.textContent).toContain('需质检查看权限');
      expect(node.querySelector('time')).toBe(null);
    }
    expect(
      element(host.querySelector('[data-testid="kt-gr-trace-receipt"]')).textContent,
    ).toContain('已完成');
  });

  it('批次追踪时间线：仅库存可见时按状态呈现并提示时间/操作人不可见', async () => {
    const host = mount(
      portsFor([receipt], [], {
        loadDetail: vi.fn().mockResolvedValue(tracedDetail),
        loadTraceSources: vi.fn().mockResolvedValue({
          inspections: null,
          lots: null,
          balances: [{ lotId: 'lot-1', qualityStatus: 'QUARANTINE' }],
        }),
      }),
    );
    element(host.querySelector('[data-testid="kt-gr-open"]')).click();
    await flush();
    await flush();
    expect(
      element(host.querySelector('[data-testid="kt-gr-trace-lot"]')).getAttribute('data-access'),
    ).toBe('status');
    const inspection = element(host.querySelector('[data-testid="kt-gr-trace-inspection"]'));
    expect(inspection.getAttribute('data-state')).toBe('PENDING');
    expect(inspection.textContent).toContain('进行中');
    expect(inspection.textContent).toContain('时间与操作人需质检查看权限');
    const stockIn = element(host.querySelector('[data-testid="kt-gr-trace-stock-in"]'));
    expect(stockIn.textContent).toContain('待放行');
    expect(stockIn.textContent).toContain('待质检放行后入库');
  });

  it('批次追踪时间线：检验进行中与拒收批次（进行中/已拒收 + 原因 + danger 徽章）', async () => {
    const host = mount(
      portsFor([receipt], [], {
        loadDetail: vi.fn().mockResolvedValue(tracedDetail),
        loadTraceSources: vi.fn().mockResolvedValue({
          inspections: [
            {
              ...inspectionSource,
              state: 'SAMPLED',
              events: (inspectionSource.events as Record<string, unknown>[]).slice(0, 1),
              results: [],
            },
          ],
          lots: [
            {
              ...lotSource,
              qualityStatus: 'REJECTED',
              qualityEvents: [
                (lotSource.qualityEvents as Record<string, unknown>[])[0],
                {
                  sequence: 2,
                  state: 'REJECTED',
                  actor_id: 'e-qm',
                  created_at: '2026-11-12T02:00:00.000Z',
                  reason: 'Tensile strength below limit',
                },
              ],
            },
          ],
          balances: null,
        }),
      }),
    );
    element(host.querySelector('[data-testid="kt-gr-open"]')).click();
    await flush();
    await flush();
    const inspection = element(host.querySelector('[data-testid="kt-gr-trace-inspection"]'));
    expect(inspection.getAttribute('data-state')).toBe('PENDING');
    expect(inspection.textContent).toContain('QI-KT-YARN-2026-001 · 已抽样');
    const stockIn = element(host.querySelector('[data-testid="kt-gr-trace-stock-in"]'));
    expect(stockIn.getAttribute('data-state')).toBe('REJECTED');
    expect(stockIn.textContent).toContain('已拒收');
    expect(stockIn.textContent).toContain('拒收不入库 · Tensile strength below limit');
    // REJECTED 以语义红呈现（danger 徽章；components.css 缺规则时的 token 内联回退）。
    const badge = element(stockIn.querySelector('.status-badge'));
    expect(badge.getAttribute('data-tone')).toBe('danger');
  });

  it('批次追踪时间线：未开检批次（NONE）与事实面读取失败降级（时间线不渲染）', async () => {
    const noneHost = mount(
      portsFor([receipt], [], {
        loadDetail: vi.fn().mockResolvedValue(tracedDetail),
        loadTraceSources: vi.fn().mockResolvedValue({
          inspections: [],
          lots: [{ ...lotSource, qualityStatus: 'QUARANTINE', qualityEvents: [] }],
          balances: null,
        }),
      }),
    );
    element(noneHost.querySelector('[data-testid="kt-gr-open"]')).click();
    await flush();
    await flush();
    const inspection = element(noneHost.querySelector('[data-testid="kt-gr-trace-inspection"]'));
    expect(inspection.textContent).toContain('未开检');
    expect(inspection.textContent).toContain('尚无检验单');
    // 读取拒绝 → sources null → 时间线整段不渲染（不拖垮收货详情）。
    const failedHost = mount(
      portsFor([receipt], [], {
        loadDetail: vi.fn().mockResolvedValue(tracedDetail),
        loadTraceSources: vi.fn().mockRejectedValue(new Error('sources unavailable')),
      }),
    );
    element(failedHost.querySelector('[data-testid="kt-gr-open"]')).click();
    await flush();
    await flush();
    expect(failedHost.querySelector('[data-testid="kt-gr-trace"]')).toBe(null);
    expect(failedHost.querySelector('[data-testid="kt-gr-detail"]')).not.toBeNull();
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
