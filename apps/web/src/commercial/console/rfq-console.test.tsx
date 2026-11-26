// U3-PROC-2 询价控制台白盒行为测试（Preact 分域重写后的行为面；
// 原 vanilla 采购询价表单载荷 oracle 逐条等价迁移——创建固定载荷
// （responseDueAt 拼接/CNY/issue:true/单行项）、PUT state issue/close 载荷、
// 权限门、状态筛选/检索、行项与报价对比呈现、刷新错误面）。
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
      line_number: 1,
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

// PROC-UX：固定时钟（2026-11-23 10:00Z）与截止倒计时/报价对比矩阵夹具。
const NOW = new Date('2026-11-23T10:00:00.000Z');
const issuedAt = (id: string, number: string, dueAt: string): RfqRow => ({
  ...issuedRfq,
  id,
  rfq_number: number,
  response_due_at: dueAt,
});
const dueSoonRfq = issuedAt('rfq-3', 'RFQ-KT-YARN-2026-003', '2026-11-25T23:59:59.000Z');
const closingTodayRfq = issuedAt('rfq-4', 'RFQ-KT-YARN-2026-004', '2026-11-23T23:59:59.000Z');
const overdueRfq = issuedAt('rfq-5', 'RFQ-KT-YARN-2026-005', '2026-11-20T23:59:59.000Z');
const badDueRfq = issuedAt('rfq-6', 'RFQ-KT-YARN-2026-006', 'not-a-date');
const quoteOf = (
  id: string,
  supplierName: string,
  unitPrice: string,
  validUntil: string,
): Record<string, unknown> => ({
  id,
  quote_reference: `SQ-${id}`,
  supplierName,
  received_at: '2026-11-10T00:00:00.000Z',
  valid_until: validUntil,
  lines: [
    {
      id: `ql-${id}`,
      lineNumber: 1,
      sku: 'RM-YARN',
      unit_price: unitPrice,
      promised_at: '2026-12-10',
      minimum_order_quantity: '1000.000000',
    },
  ],
});
const matrixDetail: RfqRow = {
  ...issuedRfq,
  quotes: [
    quoteOf('q-1', '青岛金特夫草纱战略供应商', '12.500000', '2026-12-31'),
    quoteOf('q-2', '江苏草纱二厂', '11.800000', '2026-11-30'),
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
  // PROC-UX：固定时钟（截止倒计时/报价有效期判定的确定性）。
  now: () => NOW,
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
    // TD-WF-014②：发布不可逆，单击先出确认框，确认后才发请求。
    await flush();
    expect(ports.submit).not.toHaveBeenCalled();
    await confirmAction(host, '发布询价', '确认发布');
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
    // TD-WF-014②：关闭是破坏性动作，确认框的初焦落在「取消」（即不执行）上。
    await flush();
    expect(ports.submit).not.toHaveBeenCalled();
    await confirmAction(host, '关闭询价', '确认关闭', { destructive: true });
    expect(ports.submit).toHaveBeenCalledExactlyOnceWith(
      '/api/v1/procurement-rfqs/rfq-2/state',
      { action: 'close' },
      'PUT',
    );
  });

  // TD-WF-014②：确认框里不确认（取消按钮 / Esc）就不发请求，确认框关掉后焦点回到触发按钮。
  it('关闭询价的确认框：不确认就不发请求，焦点回到「关闭询价」', async () => {
    const ports = portsFor([issuedRfq], ['procurement:manage']);
    const host = mount(ports);
    element(host.querySelector('[data-testid="kt-rfq-open"]')).click();
    await flush();
    const trigger = element(host.querySelector('[data-testid="kt-rfq-close"]'));
    trigger.focus();
    trigger.click();
    await flush();
    const dialog = element(host.querySelector('[role="alertdialog"]'));
    expect(dialog.textContent).toContain('关闭询价');
    const buttons = dialog.querySelectorAll('button');
    expect(TestDocument.current.activeElement).toBe(buttons[0]);
    element(buttons[0]).click();
    await flush();
    expect(host.querySelector('[role="alertdialog"]')).toBe(null);
    expect(ports.submit).not.toHaveBeenCalled();
    expect(TestDocument.current.activeElement).toBe(trigger);

    trigger.click();
    await flush();
    element(host.querySelector('[role="alertdialog"]'))
      .querySelectorAll('button')[0]
      ?.dispatchEvent(new TestEvent('keydown', { key: 'Escape' }));
    await flush();
    expect(host.querySelector('[role="alertdialog"]')).toBe(null);
    expect(ports.submit).not.toHaveBeenCalled();
    expect(TestDocument.current.activeElement).toBe(trigger);
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

  it('截止倒计时徽章：仅已签发询价单呈示（剩余/临期/今日/逾期分级色调）', () => {
    const host = mount(
      portsFor([rfq, issuedRfq, dueSoonRfq, closingTodayRfq, overdueRfq, badDueRfq]),
    );
    const rows = host.querySelectorAll('tbody tr');
    const badges = rows.map((row) => row.querySelector('[data-testid="kt-rfq-countdown"]'));
    // 草稿未发出不计时；不可解析的截止时间不呈徽章。
    expect(badges[0]).toBe(null);
    expect(badges[5]).toBe(null);
    expect(badges.slice(1, 5).map((badge) => badge?.textContent)).toEqual([
      '剩 8 天',
      '剩 2 天',
      '今日截止',
      '已逾期 3 天',
    ]);
    expect(
      badges.slice(1, 5).map((badge) => (badge as TestElement).getAttribute('data-tone')),
    ).toEqual(['info', 'warning', 'warning', 'danger']);
    // 截止日期文本守恒（ISO 前 10 位 · 币种）。
    expect(rows[1]?.querySelector('[data-column="due"]')?.textContent).toContain(
      '2026-12-01 · CNY',
    );
  });

  // TD-WF-014⑦：倒计时徽章此前紧贴币种文字，读作「CNY剩 8 天」「CNY已逾期 3 天」。
  it('截止列：币种与倒计时分开显示，不连写成一句', () => {
    const host = mount(portsFor([issuedRfq, closingTodayRfq, overdueRfq]));
    const cells = host
      .querySelectorAll('tbody tr')
      .map((row) => row.querySelector('[data-column="due"]')?.textContent ?? '');
    expect(cells).toEqual([
      '2026-12-01 · CNY · 剩 8 天',
      '2026-11-23 · CNY · 今日截止',
      '2026-11-20 · CNY · 已逾期 3 天',
    ]);
    for (const cell of cells) expect(cell).not.toMatch(/CNY(剩|已逾期|今日)/u);
  });

  it('详情抽屉：已签发询价单呈截止倒计时，草稿不呈', async () => {
    const issuedHost = mount(portsFor([issuedRfq]));
    element(issuedHost.querySelector('[data-testid="kt-rfq-open"]')).click();
    await flush();
    expect(
      element(issuedHost.querySelector('[data-testid="kt-rfq-detail"]')).textContent,
    ).toContain('剩 8 天');
    const draftHost = mount(portsFor([rfq]));
    element(draftHost.querySelector('[data-testid="kt-rfq-open"]')).click();
    await flush();
    expect(draftHost.querySelector('[data-testid="kt-rfq-countdown"]')).toBe(null);
  });

  it('报价对比矩阵：行项×供应商并排，有效报价中单价最低者标记推荐', async () => {
    const host = mount(
      portsFor([issuedRfq], [], { loadDetail: vi.fn().mockResolvedValue(matrixDetail) }),
    );
    element(host.querySelector('[data-testid="kt-rfq-open"]')).click();
    await flush();
    await flush();
    const matrix = element(host.querySelector('[data-testid="kt-rfq-quotes"]'));
    expect(matrix.textContent).toContain('青岛金特夫草纱战略供应商');
    expect(matrix.textContent).toContain('江苏草纱二厂');
    // 行项首列：行号 · 数量 · SKU · 名称（TD-UI-012 把数量提到行号之后，四单元不增不减）。
    expect(matrix.textContent).toContain('行 1 · 数量 6000 · RM-YARN · 草纱');
    const cells = matrix.querySelectorAll('[data-testid="kt-rfq-matrix-cell"]').map(element);
    expect(cells.map((cell) => cell.getAttribute('data-quote'))).toEqual(['q-1', 'q-2']);
    expect(cells.map((cell) => cell.getAttribute('data-recommended'))).toEqual(['false', 'true']);
    expect(cells[0]?.textContent).toContain('单价 12.5');
    expect(cells[0]?.textContent).toContain('MOQ 1000 · 交期 2026-12-10');
    expect(cells[1]?.textContent).toContain('单价 11.8');
    expect(
      matrix.querySelectorAll('.status-badge').filter((badge) => badge.textContent === '推荐'),
    ).toHaveLength(1);
    // 报价单图例（供应商 · 报价单 · 收于 · 有效至）。
    expect(matrix.textContent).toContain(
      '江苏草纱二厂 · SQ-q-2 · 收于 2026-11-10 · 有效至 2026-11-30',
    );
  });

  it('报价对比矩阵：已失效的低价报价不参与推荐并标记；缺行报价呈 —', async () => {
    const detail: RfqRow = {
      ...issuedRfq,
      quotes: [
        quoteOf('q-1', '青岛金特夫草纱战略供应商', '12.500000', '2026-12-31'),
        quoteOf('q-2', '江苏草纱二厂', '11.800000', '2026-11-01'),
        { ...quoteOf('q-3', '宁波背胶厂', '9.900000', '2026-12-31'), lines: [] },
      ],
    };
    const host = mount(
      portsFor([issuedRfq], [], { loadDetail: vi.fn().mockResolvedValue(detail) }),
    );
    element(host.querySelector('[data-testid="kt-rfq-open"]')).click();
    await flush();
    await flush();
    const matrix = element(host.querySelector('[data-testid="kt-rfq-quotes"]'));
    const cells = matrix.querySelectorAll('[data-testid="kt-rfq-matrix-cell"]').map(element);
    expect(cells.map((cell) => cell.getAttribute('data-recommended'))).toEqual([
      'true',
      'false',
      'false',
    ]);
    expect(cells[1]?.textContent).toContain('已失效');
    expect(cells[1]?.textContent).toContain('单价 11.8');
    expect(cells[2]?.textContent).toContain('单价 —');
    expect(cells[2]?.textContent).toContain('MOQ — · 交期 —');
  });

  it('报价对比矩阵：并列最低价同标推荐；全部失效则无推荐', async () => {
    const recommendedOf = async (
      quotes: readonly Record<string, unknown>[],
    ): Promise<(string | null)[]> => {
      const host = mount(
        portsFor([issuedRfq], [], {
          loadDetail: vi.fn().mockResolvedValue({ ...issuedRfq, quotes }),
        }),
      );
      element(host.querySelector('[data-testid="kt-rfq-open"]')).click();
      await flush();
      await flush();
      return element(host.querySelector('[data-testid="kt-rfq-quotes"]'))
        .querySelectorAll('[data-testid="kt-rfq-matrix-cell"]')
        .map((cell) => (cell as TestElement).getAttribute('data-recommended'));
    };
    expect(
      await recommendedOf([
        quoteOf('q-1', '青岛金特夫草纱战略供应商', '12.500000', '2026-12-31'),
        quoteOf('q-2', '江苏草纱二厂', '12.500000', '2026-12-31'),
      ]),
    ).toEqual(['true', 'true']);
    expect(
      await recommendedOf([
        quoteOf('q-1', '青岛金特夫草纱战略供应商', '12.500000', '2026-10-31'),
        quoteOf('q-2', '江苏草纱二厂', '11.800000', '2026-10-31'),
      ]),
    ).toEqual(['false', 'false']);
  });
});

// TD-WF-008（写流程冒烟 WS-P2-05）：关闭询价后列表行已是「已取消」，开着的抽屉却仍是「已签发」。
describe('U3-PROC-2 询价控制台：详情抽屉随写操作刷新', () => {
  it('关闭询价后，开着的抽屉显示「已取消」，发布 / 关闭按钮都不在了', async () => {
    const cancelled: RfqRow = { ...issuedRfq, status: 'CANCELLED' };
    const loadDetail = vi
      .fn()
      .mockResolvedValueOnce({ ...issuedRfq, quotes: [] })
      .mockResolvedValue({ ...cancelled, quotes: [] });
    const ports = portsFor([issuedRfq], ['procurement:manage'], {
      refresh: vi.fn().mockResolvedValue([cancelled]),
      loadDetail,
    });
    const host = mount(ports);
    element(host.querySelector('[data-testid="kt-rfq-open"]')).click();
    await flush();
    await flush();
    const badgeOf = (): string =>
      element(host.querySelector('[data-testid="kt-rfq-detail"] .status-badge')).textContent.trim();
    expect(badgeOf()).toBe('已签发');
    element(host.querySelector('[data-testid="kt-rfq-close"]')).click();
    await confirmAction(host, '关闭询价', '确认关闭', { destructive: true });
    await flush();
    await flush();
    expect(host.querySelector('[data-testid="kt-rfq-detail"]')).not.toBeNull();
    expect(badgeOf()).toBe('已取消');
    expect(host.querySelector('[data-testid="kt-rfq-close"]')).toBeNull();
    expect(host.querySelector('[data-testid="kt-rfq-issue"]')).toBeNull();
    expect(loadDetail).toHaveBeenCalledTimes(2);
  });
});
