// U3-COM-4 成本矩阵控制台白盒行为测试（Preact 分域重写后的行为面；
// 测试 DOM=零依赖 double（test/fixtures/preact-dom.ts，与前三域控制台同源）。
import { afterEach, describe, expect, it, vi } from 'vitest';
import { h, render } from 'preact';
import type { ComponentType } from 'preact';
import { installGlobalTestDom, type TestElement } from '../../../test/fixtures/preact-dom';
import { CostMatrixConsolePage } from './cost-matrix-console';
import type { CostMatrixConsolePorts, CostMatrixRow } from './cost-matrix-ports';

const flush = (): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, 0);
  });

const element = (node: unknown): TestElement => {
  if (node === null || node === undefined || (node as { nodeType?: number }).nodeType !== 1)
    throw new Error(`expected element, got ${String(node)}`);
  return node as TestElement;
};

const matrixRow: CostMatrixRow = {
  id: 'matrix-1',
  code: 'KT-50-3/8',
  name: '50mm 单丝加密型',
  attention: 'READY_FOR_QUOTE',
  updatedAt: '2026-11-20T00:00:00.000Z',
  isSystemPreset: false,
  factors: [{ id: 'factor-1', factorCode: 'YARN-PE', factorName: 'PE 草丝' }],
};

const fullMatrix = {
  ...matrixRow,
  currency: 'CNY',
  defaultTaxRate: '0.13',
  technicalSolutionRevisionId: 'solution-1',
  calculations: [
    { id: 'calc-1', modelVersionId: 'model-v1', total: '20', calculatedAt: '2026-11-20T01:00:00Z' },
  ],
};

const portsFor = (
  extraPermissions: readonly string[] = [],
  overrides: Partial<CostMatrixConsolePorts> = {},
): CostMatrixConsolePorts => ({
  permissions: new Set(['cost-matrix:read', ...extraPermissions]),
  initialQuery: {
    page: 1,
    pageSize: 20,
    query: '',
    productFamily: '',
    attention: 'ALL',
    sort: 'ATTENTION',
  },
  initialPage: { items: [matrixRow], total: 1, page: 1, pageSize: 20 },
  itemVersions: [{ value: 'item-v1', label: '物料 · 草丝 · 第 1 版' }],
  roleGuidance: () => '成本测算指引',
  textValue: (value, fallback = '') =>
    typeof value === 'string' || typeof value === 'number' ? String(value) : fallback,
  recordValue: (value) =>
    typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {},
  decimalValue: (value) => String(value),
  querySummaries: vi
    .fn()
    .mockResolvedValue({ items: [matrixRow], total: 1, page: 1, pageSize: 20 }),
  loadMatrix: vi.fn().mockResolvedValue(fullMatrix),
  submit: vi.fn().mockResolvedValue({}),
  navigateToQuotes: vi.fn(),
  refresh: vi.fn().mockResolvedValue({ items: [matrixRow], total: 1, page: 1, pageSize: 20 }),
  ...overrides,
});

const mount = (ports: CostMatrixConsolePorts): TestElement => {
  const host = installGlobalTestDom().document.createElement('div');
  render(h(CostMatrixConsolePage(ports) as ComponentType, {}), host);
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

// Preact 的 useEffect 在本测试环境里要等约 35 毫秒之后才执行，而测试 DOM 的 focus() 记到「最近安装的文档」
// 上：上一个用例遗留的 effect 会改写下一个用例的焦点。每个用例结束时把这个窗口等过去（同 ctr-view-behavior）。
afterEach(async () => {
  vi.restoreAllMocks();
  await new Promise((resolve) => setTimeout(resolve, 60));
});

describe('U3-COM-4 成本矩阵控制台', () => {
  it('渲染台账页头/度量/主列表（含角色指引）', () => {
    const host = mount(portsFor());
    expect(host.textContent).toContain('规格成本模型台账');
    expect(host.textContent).toContain('成本测算指引');
    expect(host.textContent).toContain('KT-50-3/8 · 50mm 单丝加密型');
    expect(host.textContent).toContain('可报价');
    expect(host.querySelector('.data-table table')).not.toBeNull();
  });

  it('摘要查询透传分页/筛选参数并翻页', async () => {
    const ports = portsFor([], {
      initialPage: { items: [matrixRow], total: 25, page: 1, pageSize: 20 },
      querySummaries: vi
        .fn()
        .mockResolvedValue({ items: [matrixRow], total: 25, page: 2, pageSize: 20 }),
    });
    const host = mount(ports);
    element(host.querySelector('[data-testid="kt-matrix-next"]')).click();
    await flush();
    expect(ports.querySummaries).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ page: 2 }),
    );
  });

  it('详情抽屉打开时经 api.get 加载完整矩阵（因子/核算历史）', async () => {
    const ports = portsFor();
    const host = mount(ports);
    element(host.querySelector('[data-testid="kt-matrix-open"]')).click();
    await flush();
    expect(ports.loadMatrix).toHaveBeenCalledWith('matrix-1');
    const detail = element(host.querySelector('[data-testid="kt-matrix-detail"]'));
    expect(detail.textContent).toContain('YARN-PE');
    expect(detail.textContent).toContain('含税成本');
    expect(detail.textContent).toContain('核算历史');
  });

  it('创建矩阵走 POST /api/v1/cost-matrices（bridge 轨）', async () => {
    const ports = portsFor(['cost-matrix:manage']);
    const host = mount(ports);
    element(host.querySelector('[data-testid="kt-matrix-create"]')).click();
    await flush();
    fillField(host, 'code', 'KT-60');
    fillField(host, 'name', '60mm 景观');
    fillField(host, 'currency', 'CNY');
    fillField(host, 'defaultTaxRate', '0.13');
    await flush();
    element(
      element(host.querySelector('.detail-drawer')).querySelector('button[type="submit"]'),
    ).click();
    await flush();
    expect(ports.submit).toHaveBeenCalledExactlyOnceWith(
      '/api/v1/cost-matrices',
      expect.objectContaining({ code: 'KT-60', name: '60mm 景观', currency: 'CNY' }),
    );
  });

  it('添加因子走 legacy POST /factors（旧轨语义保持）', async () => {
    const ports = portsFor(['cost-matrix:manage']);
    const host = mount(ports);
    element(host.querySelector('[data-testid="kt-matrix-open"]')).click();
    await flush();
    element(host.querySelector('[data-testid="kt-matrix-add-factor"]')).click();
    await flush();
    for (const [name, value] of [
      ['factorCode', 'BACKING'],
      ['factorName', '底布'],
      ['category', 'DIRECT_MATERIAL'],
      ['sourceType', 'MANUAL'],
      ['quantity', '1'],
      ['unitCode', 'M2'],
      ['manualUnitPriceTaxInclusive', '10'],
      ['taxRate', '0.13'],
      ['priceSourceName', '基准'],
    ] as const)
      fillField(host, name, value);
    await flush();
    element(
      element(host.querySelector('.detail-drawer')).querySelector('button[type="submit"]'),
    ).click();
    await flush();
    expect(ports.submit).toHaveBeenCalledExactlyOnceWith(
      '/api/v1/cost-matrices/matrix-1/factors',
      expect.objectContaining({ factorCode: 'BACKING', factorName: '底布' }),
    );
  });

  it('重算走 legacy calculate 端点并刷新详情；失败就地呈现', async () => {
    const ports = portsFor(['cost-matrix:calculate']);
    const host = mount(ports);
    element(host.querySelector('[data-testid="kt-matrix-open"]')).click();
    await flush();
    element(host.querySelector('[data-testid="kt-matrix-calculate"]')).click();
    await flush();
    expect(ports.submit).toHaveBeenCalledExactlyOnceWith(
      '/api/v1/cost-matrices/matrix-1/calculate',
      { pricingMode: 'TAX_INCLUSIVE' },
    );
    const failing = portsFor(['cost-matrix:calculate'], {
      submit: vi.fn().mockRejectedValue(new Error('价格来源暂不可用')),
    });
    const failingHost = mount(failing);
    element(failingHost.querySelector('[data-testid="kt-matrix-open"]')).click();
    await flush();
    element(failingHost.querySelector('[data-testid="kt-matrix-calculate-exclusive"]')).click();
    await flush();
    expect(
      element(failingHost.querySelector('[data-testid="kt-matrix-submit-error"]')).textContent,
    ).toBe('价格来源暂不可用');
  });

  it('系统预置矩阵不提供因子操作（治理门保持）', async () => {
    const ports = portsFor(['cost-matrix:manage'], {
      initialPage: {
        items: [{ ...matrixRow, isSystemPreset: true }],
        total: 1,
        page: 1,
        pageSize: 20,
      },
      loadMatrix: vi.fn().mockResolvedValue({ ...fullMatrix, isSystemPreset: true }),
    });
    const host = mount(ports);
    element(host.querySelector('[data-testid="kt-matrix-open"]')).click();
    await flush();
    expect(host.querySelector('[data-testid="kt-matrix-add-factor"]')).toBeNull();
    expect(host.querySelector('[data-testid="kt-matrix-factor-list"]')).toBeNull();
  });

  // WFD-2（本批盘点发现）：抽屉里的详情与页面上的列表各自读取。添加 / 更新因子、重算之后此前只重读了
  // 抽屉里的详情，列表（状态、因子数、「本页待重新核算」计数）仍是写入之前的。
  describe('写操作之后列表跟着重查（WFD-2）', () => {
    const pending: CostMatrixRow = {
      ...matrixRow,
      attention: 'NEEDS_CALCULATION',
      needsRecalculation: true,
    };
    const recalculated: CostMatrixRow = {
      ...matrixRow,
      attention: 'READY_FOR_QUOTE',
      needsRecalculation: false,
      factors: [
        { id: 'factor-1', factorCode: 'YARN-PE', factorName: 'PE 草丝' },
        { id: 'factor-2', factorCode: 'BACKING', factorName: '底布' },
      ],
    };
    const portsForPending = (permissions: readonly string[]) =>
      portsFor(permissions, {
        initialPage: { items: [pending], total: 1, page: 1, pageSize: 20 },
        querySummaries: vi
          .fn()
          .mockResolvedValue({ items: [recalculated], total: 1, page: 1, pageSize: 20 }),
      });
    // editing=true 对应「更新因子」表单（没有「因子编号」字段）。
    const fillFactor = async (host: TestElement, { editing = false } = {}): Promise<void> => {
      for (const [name, value] of [
        ['factorCode', 'BACKING'],
        ['factorName', '底布'],
        ['category', 'DIRECT_MATERIAL'],
        ['sourceType', 'MANUAL'],
        ['quantity', '1'],
        ['unitCode', 'M2'],
        ['manualUnitPriceTaxInclusive', '10'],
        ['taxRate', '0.13'],
        ['priceSourceName', '基准'],
      ] as const) {
        if (editing && name === 'factorCode') continue;
        fillField(host, name, value);
      }
      await flush();
    };

    it('重算之后按当前查询条件重查列表：「本页待重新核算」从 1 变 0，那一行的状态变为「可报价」', async () => {
      const ports = portsForPending(['cost-matrix:calculate']);
      const host = mount(ports);
      expect(
        element(host.querySelector('[data-testid="kt-matrix-summary"]')).textContent,
      ).toContain('1');
      element(host.querySelector('[data-testid="kt-matrix-open"]')).click();
      await flush();
      element(host.querySelector('[data-testid="kt-matrix-calculate"]')).click();
      await flush();
      await flush();
      expect(ports.querySummaries).toHaveBeenCalledExactlyOnceWith(ports.initialQuery);
      expect(
        element(host.querySelector('[data-testid="kt-matrix-summary"]')).textContent,
      ).toContain('0');
      expect(host.querySelector('.data-table')?.textContent).toContain('可报价');
      // 抽屉仍然开着。
      expect(host.querySelector('[data-testid="kt-matrix-detail"]')).not.toBeNull();
    });

    it('添加因子之后列表里那一行的因子数变为 2', async () => {
      const ports = portsForPending(['cost-matrix:manage']);
      const host = mount(ports);
      element(host.querySelector('[data-testid="kt-matrix-open"]')).click();
      await flush();
      element(host.querySelector('[data-testid="kt-matrix-add-factor"]')).click();
      await flush();
      await fillFactor(host);
      element(
        element(host.querySelector('.detail-drawer')).querySelector('button[type="submit"]'),
      ).click();
      await flush();
      await flush();
      expect(ports.querySummaries).toHaveBeenCalledExactlyOnceWith(ports.initialQuery);
      const row = element(host.querySelector('.data-table tbody tr'));
      expect(row.textContent).toContain('2');
    });

    it('更新因子之后同样重查列表', async () => {
      const ports = portsForPending(['cost-matrix:manage']);
      const host = mount(ports);
      element(host.querySelector('[data-testid="kt-matrix-open"]')).click();
      await flush();
      element(host.querySelector('[data-testid="kt-matrix-edit-factor"]')).click();
      await flush();
      await fillFactor(host, { editing: true });
      element(
        element(host.querySelector('.detail-drawer')).querySelector('button[type="submit"]'),
      ).click();
      await flush();
      await flush();
      expect(ports.submit).toHaveBeenCalledTimes(1);
      expect(ports.querySummaries).toHaveBeenCalledExactlyOnceWith(ports.initialQuery);
    });
  });
});
