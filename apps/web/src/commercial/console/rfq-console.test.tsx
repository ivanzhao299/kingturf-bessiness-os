// U3-PROC-2 询价控制台白盒行为测试（Preact 分域重写后的行为面；
// 原 vanilla 采购询价表单载荷 oracle 逐条等价迁移——创建固定载荷
// （responseDueAt 拼接/CNY/issue:true/单行项）、PUT state issue/close 载荷、
// 权限门、状态筛选/检索、行项与报价对比呈现、刷新错误面）。
import { afterEach, describe, expect, it, vi } from 'vitest';
import { h, render } from 'preact';
import type { ComponentType } from 'preact';
import { installGlobalTestDom, type TestElement } from '../../../test/fixtures/preact-dom';
import { RfqConsolePage } from './rfq-console';
import type { RfqConsolePorts, RfqRow } from './rfq-ports';

const flush = (): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, 0);
  });

const element = (node: unknown): TestElement => {
  if (node === null || node === undefined || (node as { nodeType?: number }).nodeType !== 1)
    throw new Error(`expected element, got ${String(node)}`);
  return node as TestElement;
};

const rfq: RfqRow = {
  id: 'rfq-1',
  rfq_number: 'RFQ-KT-YARN-2026-001',
  status: 'DRAFT',
  response_due_at: '2026-12-01T23:59:59.000Z',
  currency: 'CNY',
  lines: [
    {
      id: 'line-1',
      sku: 'RM-YARN',
      itemName: '草纱',
      quantity: '6000',
      required_at: '2026-12-15',
    },
  ],
};

const issuedRfq: RfqRow = {
  ...rfq,
  id: 'rfq-2',
  rfq_number: 'RFQ-KT-YARN-2026-002',
  status: 'ISSUED',
};

const rfqDetail: RfqRow = {
  ...rfq,
  quotes: [
    {
      id: 'q-1',
      quote_reference: 'SQ-KT-YARN-2026-001',
      supplierName: '青岛金特夫草纱战略供应商',
      received_at: '2026-11-10T00:00:00.000Z',
      valid_until: '2026-12-31',
      lines: [
        {
          id: 'ql-1',
          lineNumber: 1,
          sku: 'RM-YARN',
          unit_price: '12.5',
          promised_at: '2026-12-10',
          minimum_order_quantity: '1000',
        },
      ],
    },
  ],
};

const portsFor = (
  rfqs: readonly RfqRow[] = [rfq],
  extraPermissions: readonly string[] = [],
  overrides: Partial<RfqConsolePorts> = {},
): RfqConsolePorts => ({
  permissions: new Set(['procurement:read', ...extraPermissions]),
  initialRfqs: rfqs,
  itemVersionChoices: [{ value: 'item-v1', label: 'RM-YARN · 草纱' }],
  recordText: (record, camel, snake, fallback = '') => {
    const value = record[camel] ?? record[snake] ?? fallback;
    return typeof value === 'string' || typeof value === 'number' ? String(value) : fallback;
  },
  textValue: (value, fallback = '') =>
    typeof value === 'string' || typeof value === 'number' ? String(value) : fallback,
  submit: vi.fn().mockResolvedValue(null),
  loadDetail: vi.fn().mockResolvedValue(null),
  refresh: vi.fn().mockResolvedValue(rfqs),
  ...overrides,
});

const mount = (ports: RfqConsolePorts): TestElement => {
  const host = installGlobalTestDom().document.createElement('div');
  render(h(RfqConsolePage(ports) as ComponentType, {}), host);
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
  ['rfqNumber', 'RFQ-KT-YARN-2026-003'],
  ['itemVersionId', 'item-v1'],
  ['quantity', '6000'],
  ['requiredAt', '2026-12-15'],
  ['responseDue', '2026-12-01'],
];

afterEach(() => {
  vi.restoreAllMocks();
});

describe('U3-PROC-2 询价控制台', () => {
  it('创建询价单使用 vanilla 同款固定载荷（responseDueAt 拼接/CNY/issue:true/单行项）', async () => {
    const ports = portsFor([], ['procurement:manage']);
    const host = mount(ports);
    element(host.querySelector('[data-testid="kt-rfq-create"]')).click();
    await flush();
    for (const [name, value] of CREATE_FORM) fillField(host, name, value);
    await flush();
    await submitDrawer(host);
    expect(ports.submit).toHaveBeenCalledExactlyOnceWith('/api/v1/procurement-rfqs', {
      rfqNumber: 'RFQ-KT-YARN-2026-003',
      responseDueAt: '2026-12-01T23:59:59.000Z',
      currency: 'CNY',
      issue: true,
      lines: [
        {
          itemVersionId: 'item-v1',
          quantity: '6000',
          requiredAt: '2026-12-15',
        },
      ],
    });
    expect(ports.refresh).toHaveBeenCalledTimes(1);
  });

  it('DRAFT 询价单可发布（PUT state issue）并在刷新后收起抽屉', async () => {
    const ports = portsFor([rfq], ['procurement:manage']);
    const host = mount(ports);
    element(host.querySelector('[data-testid="kt-rfq-open"]')).click();
    await flush();
    element(host.querySelector('[data-testid="kt-rfq-issue"]')).click();
    await flush();
    expect(ports.submit).toHaveBeenCalledExactlyOnceWith(
      '/api/v1/procurement-rfqs/rfq-1/state',
      { action: 'issue' },
      'PUT',
    );
    expect(ports.refresh).toHaveBeenCalledTimes(1);
  });

  it('ISSUED 询价单仅可关闭（PUT state close）；DRAFT 无关闭外未签发门', async () => {
    const ports = portsFor([issuedRfq], ['procurement:manage']);
    const host = mount(ports);
    element(host.querySelector('[data-testid="kt-rfq-open"]')).click();
    await flush();
    expect(host.querySelector('[data-testid="kt-rfq-issue"]')).toBe(null);
    element(host.querySelector('[data-testid="kt-rfq-close"]')).click();
    await flush();
    expect(ports.submit).toHaveBeenCalledExactlyOnceWith(
      '/api/v1/procurement-rfqs/rfq-2/state',
      { action: 'close' },
      'PUT',
    );
  });

  it('权限门：无 procurement:manage 时不出现新建按钮与发布/关闭入口', async () => {
    const ports = portsFor([rfq]);
    const host = mount(ports);
    expect(host.querySelector('[data-testid="kt-rfq-create"]')).toBe(null);
    element(host.querySelector('[data-testid="kt-rfq-open"]')).click();
    await flush();
    expect(host.querySelector('[data-testid="kt-rfq-issue"]')).toBe(null);
    expect(host.querySelector('[data-testid="kt-rfq-close"]')).toBe(null);
    expect(ports.submit).not.toHaveBeenCalled();
  });

  it('状态筛选与检索：ISSUED 过滤 + 编号检索命中', async () => {
    const ports = portsFor([rfq, issuedRfq]);
    const host = mount(ports);
    expect(host.querySelectorAll('tbody tr')).toHaveLength(2);
    element(host.querySelector('[data-testid="kt-rfq-filter-issued"]')).click();
    await flush();
    expect(host.textContent).toContain('RFQ-KT-YARN-2026-002');
    expect(host.textContent).not.toContain('RFQ-KT-YARN-2026-001');
    const search = element(host.querySelector('[data-testid="kt-rfq-search"]'));
    search.value = '2026-001';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    element(host.querySelector('[data-testid="kt-rfq-filter-all"]')).click();
    await flush();
    expect(host.textContent).toContain('RFQ-KT-YARN-2026-001');
    expect(host.textContent).not.toContain('RFQ-KT-YARN-2026-002');
  });

  it('详情抽屉展示行项与报价对比（loadDetail 详情优先）', async () => {
    const ports = portsFor([rfq], [], { loadDetail: vi.fn().mockResolvedValue(rfqDetail) });
    const host = mount(ports);
    element(host.querySelector('[data-testid="kt-rfq-open"]')).click();
    await flush();
    await flush();
    const drawer = element(host.querySelector('.detail-drawer'));
    expect(drawer.textContent).toContain('RFQ-KT-YARN-2026-001');
    const detail = element(host.querySelector('[data-testid="kt-rfq-detail"]'));
    expect(detail.textContent).toContain('2026-12-01');
    const lines = element(host.querySelector('[data-testid="kt-rfq-lines"]'));
    expect(lines.textContent).toContain('RM-YARN · 草纱');
    expect(lines.textContent).toContain('数量 6000');
    const quotes = element(host.querySelector('[data-testid="kt-rfq-quotes"]'));
    expect(quotes.textContent).toContain('青岛金特夫草纱战略供应商');
    expect(quotes.textContent).toContain('单价 12.5');
    expect(quotes.textContent).toContain('MOQ 1000');
  });

  it('刷新失败时错误经 DataTable error 面暴露', async () => {
    const ports = portsFor([rfq], [], {
      refresh: vi.fn().mockRejectedValue(new Error('询价单加载失败')),
    });
    const host = mount(ports);
    element(host.querySelector('[data-testid="kt-rfq-refresh"]')).click();
    await flush();
    await flush();
    expect(host.querySelector('.data-table-error')).not.toBeNull();
    expect(host.textContent).toContain('询价单加载失败');
  });
});
