// U3-PROC-1 供应商控制台白盒行为测试（Preact 分域重写后的行为面；
// 原 vanilla supplier-register 创建/物料准入载荷 oracle 逐条等价迁移——
// 创建固定载荷（CNY/评分×100/contact 对象）、PUT qualification 审核载荷、
// 权限门、状态筛选/检索、报价历史、刷新错误面）。
import { afterEach, describe, expect, it, vi } from 'vitest';
import { h, render } from 'preact';
import { act } from 'preact/test-utils';
import type { ComponentType } from 'preact';
import {
  installGlobalTestDom,
  TestDocument,
  type TestElement,
} from '../../../test/fixtures/preact-dom';
import { SupplierConsolePage } from './supplier-console';
import { noticeOf } from '../../../test/fixtures/console-notice';
import {
  confirmAction,
  confirmDialogOf,
  dismissConfirm,
} from '../../../test/fixtures/confirm-dialog';
import type { SupplierConsolePorts, SupplierRow } from './supplier-ports';

const flush = (): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, 0);
  });

const element = (node: unknown): TestElement => {
  if (node === null || node === undefined || (node as { nodeType?: number }).nodeType !== 1)
    throw new Error(`expected element, got ${String(node)}`);
  return node as TestElement;
};

const supplier: SupplierRow = {
  id: 'supplier-1',
  supplier_number: 'SUP-1',
  name: '草纱供应商',
  status: 'ACTIVE',
  currency: 'CNY',
  payment_terms_days: 30,
  quality_rating_basis_points: 9200,
  contact: { name: '王经理', phone: '13800000000' },
  qualifications: [
    {
      id: 'q-1',
      status: 'APPROVED',
      sku: 'RM-YARN',
      itemName: '草纱',
      itemVersion: 1,
      item_version_id: 'item-v1',
    },
  ],
};

const onHoldSupplier: SupplierRow = {
  ...supplier,
  id: 'supplier-2',
  supplier_number: 'SUP-2',
  name: '背胶供应商',
  status: 'ON_HOLD',
  qualifications: [],
};

const quote: SupplierRow = {
  id: 'quote-1',
  supplier_id: 'supplier-1',
  quote_reference: 'SQ-1',
  received_at: '2026-11-01T00:00:00.000Z',
  valid_until: '2026-12-31',
};

// PROC-UX：固定时钟（2026-11-23 10:00Z）与资质四色/报价历史对比夹具。
const NOW = new Date('2026-11-23T10:00:00.000Z');
const qualification = (
  id: string,
  status: string,
  sku: string,
  itemName: string,
  itemVersionId: string,
): Record<string, unknown> => ({
  id,
  status,
  sku,
  itemName,
  itemVersion: 1,
  item_version_id: itemVersionId,
});
const richSupplier: SupplierRow = {
  ...supplier,
  qualifications: [
    qualification('q-1', 'APPROVED', 'RM-YARN', '草纱', 'item-v1'),
    qualification('q-2', 'CONDITIONAL', 'RM-LATEX', '乳胶', 'item-v2'),
    qualification('q-3', 'REJECTED', 'RM-BACKING', '底布', 'item-v3'),
  ],
};
const itemChoices = [
  'RM-YARN · 草纱',
  'RM-LATEX · 乳胶',
  'RM-BACKING · 底布',
  'RM-GLUE · 胶水',
  'RM-FOIL · 草膜',
];
const pricedQuote = (
  id: string,
  supplierId: string,
  supplierName: string,
  reference: string,
  receivedAt: string,
  validUntil: string,
  line: Record<string, unknown>,
): SupplierRow => ({
  id,
  supplier_id: supplierId,
  supplierName,
  quote_reference: reference,
  received_at: receivedAt,
  valid_until: validUntil,
  lines: [{ id: `${id}-l1`, lineNumber: 1, ...line }],
});
const yarnLine = (unitPrice: string, moq: string, promisedAt: string): Record<string, unknown> => ({
  itemVersionId: 'item-v1',
  unit_price: unitPrice,
  minimum_order_quantity: moq,
  promised_at: promisedAt,
});
// item-v1（草纱）四条报价：本供应商现价 12.5（有效）与历史 13.2（失效）、背胶供应商 11.8（有效最低）、
// 宁波草纱三厂 10.0（失效低价——不参与最优）。
const pricedQuotes: readonly SupplierRow[] = [
  pricedQuote(
    'quote-1',
    'supplier-1',
    '草纱供应商',
    'SQ-1',
    '2026-11-01T00:00:00.000Z',
    '2026-12-31',
    yarnLine('12.500000', '1000.000000', '2026-12-10'),
  ),
  pricedQuote(
    'quote-2',
    'supplier-2',
    '背胶供应商',
    'SQ-2',
    '2026-11-05T00:00:00.000Z',
    '2026-12-31',
    yarnLine('11.800000', '2000', '2026-12-08'),
  ),
  pricedQuote(
    'quote-3',
    'supplier-3',
    '宁波草纱三厂',
    'SQ-3',
    '2026-10-01T00:00:00.000Z',
    '2026-11-01',
    yarnLine('10.000000', '500', '2026-12-01'),
  ),
  pricedQuote(
    'quote-4',
    'supplier-1',
    '草纱供应商',
    'SQ-0',
    '2026-09-01T00:00:00.000Z',
    '2026-10-31',
    yarnLine('13.200000', '1000', '2026-12-01'),
  ),
];

const portsFor = (
  suppliers: readonly SupplierRow[] = [supplier],
  extraPermissions: readonly string[] = [],
  overrides: Partial<SupplierConsolePorts> = {},
): SupplierConsolePorts => ({
  permissions: new Set(['supplier:read', ...extraPermissions]),
  initialSuppliers: suppliers,
  itemVersionChoices: [{ value: 'item-v1', label: 'RM-YARN · 草纱' }],
  initialQuotes: [quote],
  recordText: (record, camel, snake, fallback = '') => {
    const value = record[camel] ?? record[snake] ?? fallback;
    return typeof value === 'string' || typeof value === 'number' ? String(value) : fallback;
  },
  textValue: (value, fallback = '') =>
    typeof value === 'string' || typeof value === 'number' ? String(value) : fallback,
  submit: vi.fn().mockResolvedValue(null),
  // PROC-UX：固定时钟（报价有效期判定的确定性）。
  now: () => NOW,
  refresh: vi.fn().mockResolvedValue({ suppliers, quotes: [quote] }),
  ...overrides,
});

const mountedHosts = new Set<TestElement>();
const mount = (ports: SupplierConsolePorts): TestElement => {
  const host = installGlobalTestDom().document.createElement('div');
  render(h(SupplierConsolePage(ports) as ComponentType, {}), host);
  mountedHosts.add(host);
  return host;
};

// TD-TEST-035：抽屉初焦是 passive effect——node（无 requestAnimationFrame）下 preact hooks 经
// setTimeout(35ms)+再一拍调度，flush()（setTimeout 0）等不到它。凡依赖「抽屉初焦已完成」的步骤
// （往抽屉里点确认、或对焦点做断言）都必须经 act 同步跑掉该 effect，并断言初焦落位；否则残留的
// 悬挂初焦 effect 链（上一用例未卸载的抽屉，或共享定时器链冲进的本用例挂起 effect）会在断言
// 窗口把焦点抢到关闭按钮（根因与红/绿探针见 docs/evidence/drawer-focus-stability-2026-11-26.md）。
// 所以打开抽屉只有这一条路径。
const openSupplierDrawer = async (host: TestElement): Promise<TestElement> => {
  // 先完成详情抽屉的初焦 effect，再触发抽屉里的确认框。
  await act(() => {
    element(host.querySelector('[data-testid="kt-supplier-open"]')).click();
  });
  const drawer = element(host.querySelector('.detail-drawer'));
  expect(TestDocument.current.activeElement).toBe(element(drawer.querySelector('.drawer-close')));
  return drawer;
};

// 新建抽屉同样有初焦 effect：act 同步跑掉并断言初焦，不留悬挂定时器。
const openCreateDrawer = async (host: TestElement): Promise<void> => {
  await act(() => {
    element(host.querySelector('[data-testid="kt-supplier-create"]')).click();
  });
  expect(TestDocument.current.activeElement).toBe(
    element(element(host.querySelector('.detail-drawer')).querySelector('.drawer-close')),
  );
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
  ['supplierNumber', 'SUP-KT-YARN-002'],
  ['name', '青岛草纱第二供应商'],
  ['paymentTermsDays', '45'],
  ['qualityRating', '92'],
  ['contactName', '李经理'],
  ['contactPhone', '13900000000'],
];

const QUALIFY_FORM: readonly (readonly [string, string])[] = [
  ['action', 'approve'],
  ['itemVersionId', 'item-v1'],
  ['validFrom', '2026-11-01'],
  ['validTo', '2027-10-31'],
  ['minimumOrderQuantity', '1000'],
  ['leadTimeDays', '14'],
  ['evidenceReference', 'QA-2026-011'],
];

afterEach(() => {
  // 卸载用例挂载的组件树：被卸载组件尚待执行的 effect 随之丢弃，不会把焦点操作
  // 落到下一个用例的测试 DOM 上（open/create 路径已全部经 act 消除悬挂初焦，
  // 这里对其它残余 effect 兜底）。
  for (const host of mountedHosts) render(null, host);
  mountedHosts.clear();
  vi.restoreAllMocks();
});

describe('U3-PROC-1 供应商控制台', () => {
  it('创建供应商使用 vanilla 同款固定载荷（CNY/评分×100/contact 对象）并在刷新后收起抽屉', async () => {
    const ports = portsFor([], ['supplier:manage']);
    const host = mount(ports);
    await openCreateDrawer(host);
    for (const [name, value] of CREATE_FORM) fillField(host, name, value);
    await flush();
    await submitDrawer(host);
    expect(ports.submit).toHaveBeenCalledExactlyOnceWith('/api/v1/suppliers', {
      supplierNumber: 'SUP-KT-YARN-002',
      name: '青岛草纱第二供应商',
      currency: 'CNY',
      paymentTermsDays: 45,
      qualityRatingBasisPoints: 9200,
      contact: { name: '李经理', phone: '13900000000' },
    });
    expect(ports.refresh).toHaveBeenCalledTimes(1);
  });

  it('物料准入审核：approve 走 PUT qualification 统一动作端点并保留 evidence 结构', async () => {
    const ports = portsFor([supplier], ['supplier:manage']);
    const host = mount(ports);
    await openSupplierDrawer(host);
    element(host.querySelector('[data-testid="kt-supplier-qualify"]')).click();
    await flush();
    for (const [name, value] of QUALIFY_FORM) fillField(host, name, value);
    await flush();
    await submitDrawer(host);
    expect(ports.submit).toHaveBeenCalledExactlyOnceWith(
      '/api/v1/suppliers/supplier-1/qualification',
      {
        action: 'approve',
        itemVersionId: 'item-v1',
        validFrom: '2026-11-01',
        validTo: '2027-10-31',
        minimumOrderQuantity: '1000',
        leadTimeDays: 14,
        evidence: { reference: 'QA-2026-011' },
      },
      'PUT',
    );
    expect(ports.refresh).toHaveBeenCalledTimes(1);
  });

  it('驳回（reject）经同一端点映射 action=reject', async () => {
    const ports = portsFor([supplier], ['supplier:manage']);
    const host = mount(ports);
    await openSupplierDrawer(host);
    element(host.querySelector('[data-testid="kt-supplier-qualify"]')).click();
    await flush();
    fillField(host, 'action', 'reject');
    fillField(host, 'itemVersionId', 'item-v1');
    fillField(host, 'validFrom', '2026-11-01');
    fillField(host, 'validTo', '2027-10-31');
    fillField(host, 'minimumOrderQuantity', '0');
    fillField(host, 'leadTimeDays', '7');
    fillField(host, 'evidenceReference', 'QA-2026-012');
    await flush();
    await submitDrawer(host);
    expect(ports.submit).toHaveBeenCalledExactlyOnceWith(
      '/api/v1/suppliers/supplier-1/qualification',
      expect.objectContaining({ action: 'reject', evidence: { reference: 'QA-2026-012' } }),
      'PUT',
    );
  });

  it('权限门：无 supplier:manage 时不出现新建按钮与审核入口', async () => {
    const ports = portsFor([supplier]);
    const host = mount(ports);
    expect(host.querySelector('[data-testid="kt-supplier-create"]')).toBe(null);
    await openSupplierDrawer(host);
    expect(host.querySelector('[data-testid="kt-supplier-qualify"]')).toBe(null);
    expect(ports.submit).not.toHaveBeenCalled();
    expect(host.querySelector('[data-testid="kt-supplier-state-row-pause"]')).toBeNull();
    expect(host.querySelector('[data-testid="kt-supplier-state-drawer-pause"]')).toBeNull();
  });

  it('状态筛选与检索：ON_HOLD 过滤 + 编号检索命中', async () => {
    const ports = portsFor([supplier, onHoldSupplier]);
    const host = mount(ports);
    expect(host.querySelectorAll('tbody tr')).toHaveLength(2);
    element(host.querySelector('[data-testid="kt-supplier-filter-on_hold"]')).click();
    await flush();
    expect(host.textContent).toContain('SUP-2');
    expect(host.textContent).not.toContain('SUP-1');
    const search = element(host.querySelector('[data-testid="kt-supplier-search"]'));
    search.value = 'SUP-1';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    element(host.querySelector('[data-testid="kt-supplier-filter-all"]')).click();
    await flush();
    expect(host.textContent).toContain('SUP-1');
    expect(host.textContent).not.toContain('SUP-2');
  });

  // TD-WF-014③：ON_HOLD 此前没有中文标签，筛选按钮与状态徽章直接显示枚举原文。
  it('状态标签：ON_HOLD 显示「暂停」，筛选按钮与状态徽章都不出现枚举原文', () => {
    const host = mount(portsFor([supplier, onHoldSupplier]));
    // 测试 DOM 的选择器引擎不支持 ^=，这里按属性前缀在 JS 侧筛。
    const labels = host
      .querySelectorAll('[data-testid]')
      .map((node) => element(node))
      .filter((node) => (node.getAttribute('data-testid') ?? '').startsWith('kt-supplier-filter-'))
      .map((node) => node.textContent.trim());
    expect(labels).toEqual(['全部 2', '已启用 1', '暂停 1', '已停用 0']);
    expect(labels.join(' ')).not.toMatch(/[A-Z_]{2,}/u);
    // 状态列是第 2 列（物料准入列的资质徽章也是 .status-badge，不在此列）。
    const badges = host
      .querySelectorAll('tbody tr')
      .map((row) => row.querySelectorAll('td')[1]?.querySelector('.status-badge'))
      .map((node) => node?.textContent.trim());
    expect(badges).toEqual(['已启用', '暂停']);
  });

  it('行内暂停先确认，取消时不发送，确认后刷新列表和状态筛选计数', async () => {
    const ports = portsFor([supplier], ['supplier:manage'], {
      refresh: vi
        .fn()
        .mockResolvedValue({ suppliers: [{ ...supplier, status: 'ON_HOLD' }], quotes: [quote] }),
    });
    const host = mount(ports);
    const pause = element(host.querySelector('[data-testid="kt-supplier-state-row-pause"]'));
    pause.click();
    await flush();
    expect(confirmDialogOf(host).textContent).toContain('不能登记新报价或新建采购订单');
    expect(ports.submit).not.toHaveBeenCalled();
    await dismissConfirm(host);
    expect(ports.submit).not.toHaveBeenCalled();
    expect(ports.refresh).not.toHaveBeenCalled();
    pause.click();
    await confirmAction(host, '暂停供应商', '确认暂停', { destructive: true });
    expect(ports.submit).toHaveBeenCalledExactlyOnceWith(
      '/api/v1/suppliers/supplier-1/state',
      { status: 'ON_HOLD' },
      'PUT',
    );
    expect(ports.refresh).toHaveBeenCalledExactlyOnceWith('suppliers');
    expect(noticeOf(host)).toEqual({ text: '已暂停供应商 SUP-1', inDrawer: false });
    expect(
      element(host.querySelector('[data-testid="kt-supplier-state-count-on_hold"]')).textContent,
    ).toBe('1');
    expect(
      element(host.querySelector('[data-testid="kt-supplier-state-count-active"]')).textContent,
    ).toBe('0');
    element(host.querySelector('[data-testid="kt-supplier-filter-on_hold"]')).click();
    await flush();
    expect(host.querySelectorAll('tbody tr')).toHaveLength(1);
    expect(host.querySelector('[data-testid="kt-supplier-state-row-restore"]')).not.toBeNull();
  });

  it('抽屉内停用和恢复先确认，状态徽章与成功提示在原抽屉里更新', async () => {
    const ports = portsFor([onHoldSupplier], ['supplier:manage'], {
      refresh: vi
        .fn()
        .mockResolvedValueOnce({
          suppliers: [{ ...onHoldSupplier, status: 'INACTIVE' }],
          quotes: [],
        })
        .mockResolvedValueOnce({
          suppliers: [{ ...onHoldSupplier, status: 'ACTIVE' }],
          quotes: [],
        }),
    });
    const host = mount(ports);
    const drawer = await openSupplierDrawer(host);
    element(drawer.querySelector('[data-testid="kt-supplier-state-drawer-deactivate"]')).click();
    expect(ports.submit).not.toHaveBeenCalled();
    await confirmAction(host, '停用供应商', '确认停用', { destructive: true });
    expect(drawer.querySelector('.status-badge')?.textContent).toBe('已停用');
    expect(noticeOf(host)).toEqual({ text: '已停用供应商 SUP-2', inDrawer: true });
    element(drawer.querySelector('[data-testid="kt-supplier-state-drawer-restore"]')).click();
    await confirmAction(host, '恢复供应商', '确认恢复');
    expect(ports.submit).toHaveBeenNthCalledWith(
      1,
      '/api/v1/suppliers/supplier-2/state',
      { status: 'INACTIVE' },
      'PUT',
    );
    expect(ports.submit).toHaveBeenNthCalledWith(
      2,
      '/api/v1/suppliers/supplier-2/state',
      { status: 'ACTIVE' },
      'PUT',
    );
    expect(drawer.querySelector('.status-badge')?.textContent).toBe('已启用');
    expect(noticeOf(host)).toEqual({ text: '已恢复供应商 SUP-2', inDrawer: true });
  });

  it('状态写入成功但供应商重读失败时保留新状态与筛选计数，并说明刷新失败', async () => {
    const ports = portsFor([supplier], ['supplier:manage'], {
      refresh: vi.fn().mockRejectedValue(new Error('读取供应商失败，请刷新重试')),
    });
    const host = mount(ports);
    const drawer = await openSupplierDrawer(host);
    element(drawer.querySelector('[data-testid="kt-supplier-state-drawer-pause"]')).click();
    await confirmAction(host, '暂停供应商', '确认暂停', { destructive: true });
    expect(ports.submit).toHaveBeenCalledExactlyOnceWith(
      '/api/v1/suppliers/supplier-1/state',
      { status: 'ON_HOLD' },
      'PUT',
    );
    expect(ports.refresh).toHaveBeenCalledExactlyOnceWith('suppliers');
    expect(drawer.querySelector('.status-badge')?.textContent).toBe('暂停');
    expect(drawer.querySelector('[role="alert"]')?.textContent).toBe('读取供应商失败，请刷新重试');
    expect(noticeOf(host)).toEqual({ text: '已暂停供应商 SUP-1', inDrawer: true });
    expect(host.querySelector('[data-testid="kt-supplier-state-count-active"]')?.textContent).toBe(
      '0',
    );
    expect(host.querySelector('[data-testid="kt-supplier-state-count-on_hold"]')?.textContent).toBe(
      '1',
    );
  });

  it('详情抽屉展示资质记录与按 supplierId 过滤的报价历史', async () => {
    const ports = portsFor([supplier]);
    const host = mount(ports);
    await openSupplierDrawer(host);
    const detail = element(host.querySelector('[data-testid="kt-supplier-detail"]'));
    expect(detail.textContent).toContain('SUP-1');
    expect(detail.textContent).toContain('王经理');
    expect(detail.textContent).toContain('92 / 100');
    const qualifications = element(
      host.querySelector('[data-testid="kt-supplier-qualifications"]'),
    );
    expect(qualifications.textContent).toContain('RM-YARN · 草纱');
    const quotes = element(host.querySelector('[data-testid="kt-supplier-quotes"]'));
    expect(quotes.textContent).toContain('SQ-1');
    expect(quotes.textContent).toContain('2026-12-31');
  });

  it('资质状态四色徽章：列表列与抽屉按 已批准/有条件批准/已驳回/待准入 呈非零计数', async () => {
    const ports = portsFor([richSupplier, onHoldSupplier], [], {
      itemVersionChoices: itemChoices.map((label, index) => ({
        value: `item-v${String(index + 1)}`,
        label,
      })),
    });
    const host = mount(ports);
    const cells = host
      .querySelectorAll('[data-testid="kt-supplier-qualifications-cell"]')
      .map(element);
    expect(cells).toHaveLength(2);
    // 四色徽章固定顺序、仅呈非零计数；REJECTED 以语义红区别于 PENDING 的灰。
    expect(cells[0]?.textContent).toBe('已批准 1有条件批准 1已驳回 1待准入 2');
    expect(cells[0]?.getAttribute('data-pending')).toBe('2');
    expect(
      cells[0]
        ?.querySelectorAll('.status-badge')
        .map((badge) => (badge as TestElement).getAttribute('data-tone')),
    ).toEqual(['success', 'info', 'danger', 'neutral']);
    // 无准入记录的供应商仅呈待准入（= 已发布物料数）。
    expect(cells[1]?.textContent).toBe(`待准入 ${String(itemChoices.length)}`);
    await openSupplierDrawer(host);
    const badges = element(host.querySelector('[data-testid="kt-supplier-qualification-badges"]'));
    expect(badges.textContent).toBe('已批准 1有条件批准 1已驳回 1待准入 2');
    const pending = element(host.querySelector('[data-testid="kt-supplier-pending"]'));
    expect(pending.textContent).toContain('待准入物料 2 项');
    expect(pending.textContent).toContain('RM-GLUE · 胶水');
    expect(pending.textContent).toContain('RM-FOIL · 草膜');
    // 报价无可比行时不呈对比区。
    expect(host.querySelector('[data-testid="kt-supplier-compare"]')).toBe(null);
  });

  it('资质状态徽章：无已发布物料且无记录时呈 —；已驳回记录以语义红呈现', async () => {
    const bareHost = mount(
      portsFor([{ ...onHoldSupplier, qualifications: [] }], [], { itemVersionChoices: [] }),
    );
    expect(
      element(bareHost.querySelector('[data-testid="kt-supplier-qualifications-cell"]'))
        .textContent,
    ).toBe('—');
    const rejectedHost = mount(
      portsFor([
        {
          ...supplier,
          qualifications: [qualification('q-9', 'REJECTED', 'RM-YARN', '草纱', 'item-v1')],
        },
      ]),
    );
    const cell = element(
      rejectedHost.querySelector('[data-testid="kt-supplier-qualifications-cell"]'),
    );
    expect(cell.textContent).toBe('已驳回 1');
    expect(element(cell.querySelector('.status-badge')).getAttribute('data-tone')).toBe('danger');
    await openSupplierDrawer(rejectedHost);
    const record = element(
      rejectedHost.querySelector('[data-testid="kt-supplier-qualifications"]'),
    );
    expect(record.textContent).toContain('RM-YARN · 草纱');
    expect(element(record.querySelector('.status-badge')).getAttribute('data-tone')).toBe('danger');
  });

  it('资质状态徽章：待准入物料超过 8 项时截断并提示未列出数', async () => {
    const many = Array.from({ length: 10 }, (_, index) => ({
      value: `item-v${String(index + 1)}`,
      label: `RM-${String(index + 1)} · 物料${String(index + 1)}`,
    }));
    const host = mount(portsFor([onHoldSupplier], [], { itemVersionChoices: many }));
    await openSupplierDrawer(host);
    const pending = element(host.querySelector('[data-testid="kt-supplier-pending"]'));
    expect(pending.textContent).toContain('待准入物料 10 项');
    expect(pending.querySelectorAll('li')).toHaveLength(8);
    expect(pending.textContent).toContain('另有 2 项未列出');
  });

  it('报价历史对比：同一物料多供应商单价并排，有效最低价高亮最优，本供应商与失效报价标记', async () => {
    const ports = portsFor([supplier], [], {
      itemVersionChoices: [{ value: 'item-v1', label: 'RM-YARN · 草纱' }],
      initialQuotes: pricedQuotes,
    });
    const host = mount(ports);
    await openSupplierDrawer(host);
    const compare = element(host.querySelector('[data-testid="kt-supplier-compare"]'));
    expect(compare.querySelectorAll('[data-testid="kt-supplier-compare-item"]')).toHaveLength(1);
    expect(compare.textContent).toContain('RM-YARN · 草纱');
    expect(compare.textContent).toContain('单价（CNY）');
    const prices = compare
      .querySelectorAll('[data-testid="kt-supplier-compare-price"]')
      .map(element);
    // 有效报价按单价升序在前；已失效报价按收价时间降序在后，不参与最优。
    expect(prices.map((price) => price.textContent)).toEqual(['11.8最优', '12.5', '10', '13.2']);
    expect(prices.map((price) => price.getAttribute('data-best'))).toEqual([
      'true',
      'false',
      'false',
      'false',
    ]);
    expect(compare.textContent).toContain('SQ-2 · 2026-11-05 · 2026-12-31');
    expect(compare.textContent).toContain('MOQ 1000 · 2026-12-10');
    expect(compare.textContent).toContain('MOQ 2000 · 2026-12-08');
    const badgesOf = (label: string): number =>
      compare.querySelectorAll('.status-badge').filter((badge) => badge.textContent === label)
        .length;
    expect(badgesOf('本供应商')).toBe(2);
    expect(badgesOf('已失效')).toBe(2);
    expect(badgesOf('最优')).toBe(1);
    // 报价历史列表守恒（仍按 supplierId 过滤）。
    const history = element(host.querySelector('[data-testid="kt-supplier-quotes"]'));
    expect(history.textContent).toContain('SQ-1');
    expect(history.textContent).toContain('SQ-0');
    expect(history.textContent).not.toContain('SQ-2');
  });

  it('报价历史对比：并列有效最低价同标最优；物料超过 6 项时截断提示', async () => {
    const tie = [
      pricedQuote(
        'quote-1',
        'supplier-1',
        '草纱供应商',
        'SQ-1',
        '2026-11-01T00:00:00.000Z',
        '2026-12-31',
        yarnLine('12.500000', '1000', '2026-12-10'),
      ),
      pricedQuote(
        'quote-2',
        'supplier-2',
        '背胶供应商',
        'SQ-2',
        '2026-11-05T00:00:00.000Z',
        '2026-12-31',
        yarnLine('12.500000', '1000', '2026-12-09'),
      ),
    ];
    const openCompare = async (overrides: Partial<SupplierConsolePorts>): Promise<TestElement> => {
      const host = mount(portsFor([supplier], [], overrides));
      await openSupplierDrawer(host);
      return host;
    };
    const tieHost = await openCompare({
      itemVersionChoices: [{ value: 'item-v1', label: 'RM-YARN · 草纱' }],
      initialQuotes: tie,
    });
    expect(
      tieHost
        .querySelectorAll('[data-testid="kt-supplier-compare-price"]')
        .map((price) => (price as TestElement).getAttribute('data-best')),
    ).toEqual(['true', 'true']);
    const many = Array.from({ length: 8 }, (_, index) => ({
      value: `item-v${String(index + 1)}`,
      label: `RM-${String(index + 1)} · 物料${String(index + 1)}`,
    }));
    const manyHost = await openCompare({
      itemVersionChoices: many,
      initialQuotes: many.map((choice, index) =>
        pricedQuote(
          `quote-m${String(index)}`,
          'supplier-1',
          '草纱供应商',
          `SQ-M${String(index)}`,
          '2026-11-01T00:00:00.000Z',
          '2026-12-31',
          { ...yarnLine('12.5', '1000', '2026-12-10'), itemVersionId: choice.value },
        ),
      ),
    });
    const compare = element(manyHost.querySelector('[data-testid="kt-supplier-compare"]'));
    expect(compare.querySelectorAll('[data-testid="kt-supplier-compare-item"]')).toHaveLength(6);
    expect(compare.textContent).toContain('另有 2 项物料未列出');
  });

  it('刷新失败时错误经 DataTable error 面暴露', async () => {
    const ports = portsFor([supplier], [], {
      refresh: vi.fn().mockRejectedValue(new Error('供应商加载失败')),
    });
    const host = mount(ports);
    element(host.querySelector('[data-testid="kt-supplier-refresh"]')).click();
    await flush();
    await flush();
    expect(host.querySelector('.data-table-error')).not.toBeNull();
    expect(host.textContent).toContain('供应商加载失败');
  });
});

// TD-WF-008（写流程冒烟 WS-P2-05）：准入审核后列表里该供应商已是「已批准 1」，开着的抽屉却仍写
// 「尚无物料准入记录」。
describe('U3-PROC-1 供应商控制台：详情抽屉随写操作刷新', () => {
  it('物料准入审核后，开着的抽屉显示刚批准的资质记录', async () => {
    const bare: SupplierRow = { ...supplier, qualifications: [] };
    const qualified: SupplierRow = {
      ...supplier,
      qualifications: [qualification('q-9', 'APPROVED', 'RM-YARN', '草纱', 'item-v1')],
    };
    const ports = portsFor([bare], ['supplier:manage'], {
      refresh: vi.fn().mockResolvedValue({ suppliers: [qualified], quotes: [quote] }),
    });
    const host = mount(ports);
    await openSupplierDrawer(host);
    const drawerText = (): string => element(host.querySelector('.detail-drawer')).textContent;
    expect(drawerText()).toContain('尚无物料准入记录');
    element(host.querySelector('[data-testid="kt-supplier-qualify"]')).click();
    await flush();
    for (const [name, value] of QUALIFY_FORM) fillField(host, name, value);
    await flush();
    await submitDrawer(host);
    expect(ports.submit).toHaveBeenCalledTimes(1);
    // 抽屉还开着，资质记录已是刷新后的。
    expect(host.querySelector('.detail-drawer')).not.toBeNull();
    expect(drawerText()).not.toContain('尚无物料准入记录');
    expect(drawerText()).toContain('已批准');
    expect(
      host.querySelector('[data-testid="kt-supplier-qualifications"]')?.textContent ?? '',
    ).toContain('RM-YARN');
    // 行内表单已收起，操作区回来了。
    expect(host.querySelector('[data-testid="kt-supplier-qualify"]')).not.toBeNull();
  });
});

// TD-WF-014①（写流程冒烟 WS-P3-01）：写操作此前没有任何成功提示。
describe('U3-PROC-1 供应商控制台：写成功后的提示', () => {
  it('新建成功：页头下方出现「已创建供应商 …」，不在抽屉里', async () => {
    const ports = portsFor([], ['supplier:manage']);
    const host = mount(ports);
    await openCreateDrawer(host);
    expect(noticeOf(host).text).toBe('');
    for (const [name, value] of CREATE_FORM) fillField(host, name, value);
    await flush();
    await submitDrawer(host);
    expect(host.querySelector('.detail-drawer')).toBeNull();
    expect(noticeOf(host)).toEqual({ text: '已创建供应商 SUP-KT-YARN-002', inDrawer: false });
  });

  it('准入审核成功：提示在开着的详情抽屉底部；打开另一条记录时清空', async () => {
    const ports = portsFor([supplier], ['supplier:manage']);
    const host = mount(ports);
    await openSupplierDrawer(host);
    element(host.querySelector('[data-testid="kt-supplier-qualify"]')).click();
    await flush();
    for (const [name, value] of QUALIFY_FORM) fillField(host, name, value);
    await flush();
    await submitDrawer(host);
    expect(noticeOf(host)).toEqual({ text: '已提交物料准入审核：批准', inDrawer: true });
    element(element(host.querySelector('.detail-drawer')).querySelector('.drawer-close')).click();
    await flush();
    await openSupplierDrawer(host);
    expect(noticeOf(host).text).toBe('');
  });
});
