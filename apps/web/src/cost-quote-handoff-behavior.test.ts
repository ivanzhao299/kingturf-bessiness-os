import { afterEach, describe, expect, it, vi } from 'vitest';
import { h, render } from 'preact';
import type { ComponentType } from 'preact';
import { installGlobalTestDom, type TestElement } from '../test/fixtures/preact-dom';
import { CostMatrixConsolePage } from './commercial/console/cost-matrix-console';
import type { CostMatrixConsolePorts, CostMatrixRow } from './commercial/console/cost-matrix-ports';
import type { CostMatrixQuery } from './commercial/types';

// U3-COM-4：报价成本决策 handoff 行为迁移后的等价覆盖——计算→决策提交→
// preferred 成本决策→报价路由切换（原 cost-matrix-detail 的 createCostQuoteButton 语义）。
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
  isSystemPreset: false,
  factors: [{ id: 'factor-1', factorCode: 'YARN-PE', factorName: 'PE 草丝' }],
};

const fullMatrix = {
  ...matrixRow,
  technicalSolutionRevisionId: 'solution-1',
  currency: 'CNY',
  defaultTaxRate: '0.13',
  calculations: [
    { id: 'calc-1', modelVersionId: 'model-v1', total: '8', calculatedAt: '2026-11-20T00:00:00Z' },
  ],
};

const portsFor = (overrides: Partial<CostMatrixConsolePorts> = {}): CostMatrixConsolePorts => ({
  permissions: new Set([
    'cost-matrix:read',
    'cost-matrix:manage',
    'cost-matrix:calculate',
    'cost:evaluate',
    'audit:read',
  ]),
  initialQuery: {
    page: 1,
    pageSize: 20,
    query: '',
    productFamily: '',
    attention: 'ALL',
    sort: 'ATTENTION',
  },
  initialPage: { items: [matrixRow], total: 1, page: 1, pageSize: 20 },
  itemVersions: [],
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
  submit: vi.fn().mockResolvedValue({ costDecisionId: 'decision-1' }),
  navigateToQuotes: vi.fn(),
  refresh: vi.fn().mockResolvedValue({ items: [matrixRow], total: 1, page: 1, pageSize: 20 }),
  ...overrides,
});

const mount = (ports: CostMatrixConsolePorts): TestElement => {
  const host = installGlobalTestDom().document.createElement('div');
  render(h(CostMatrixConsolePage(ports) as ComponentType, {}), host);
  return host;
};

const queryFor = (query: CostMatrixQuery): CostMatrixQuery => query;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('U3-COM-4 报价成本决策 handoff（控制台迁移后）', () => {
  it('计算→决策提交→preferred 决策→切换报价路由（原 detail 按钮语义保持）', async () => {
    const ports = portsFor();
    const host = mount(ports);
    await flush();
    await flush();
    element(host.querySelector('[data-testid="kt-matrix-open"]')).click();
    await flush();
    element(host.querySelector('[data-testid="kt-matrix-quote-decision"]')).click();
    await flush();
    expect(ports.submit).toHaveBeenCalledExactlyOnceWith(
      '/api/v1/cost-matrix-calculations/calc-1/quote-cost-decision',
      { technicalSolutionRevisionId: 'solution-1', modelVersionId: 'model-v1' },
    );
    expect(ports.navigateToQuotes).toHaveBeenCalledTimes(1);
  });

  it('重算动作沿 legacy calculate 端点（pricingMode 载荷）', async () => {
    const ports = portsFor();
    const host = mount(ports);
    await flush();
    await flush();
    element(host.querySelector('[data-testid="kt-matrix-open"]')).click();
    await flush();
    element(host.querySelector('[data-testid="kt-matrix-calculate"]')).click();
    await flush();
    expect(ports.submit).toHaveBeenCalledExactlyOnceWith(
      '/api/v1/cost-matrices/matrix-1/calculate',
      { pricingMode: 'TAX_INCLUSIVE' },
    );
    void queryFor;
  });

  it('因子更新沿 PUT 现代轨', async () => {
    const ports = portsFor();
    const host = mount(ports);
    await flush();
    await flush();
    element(host.querySelector('[data-testid="kt-matrix-open"]')).click();
    await flush();
    element(
      element(host.querySelector('[data-testid="kt-matrix-factor-list"]')).querySelector(
        '[data-testid="kt-matrix-edit-factor"]',
      ),
    ).click();
    await flush();
    const drawer = element(host.querySelector('.detail-drawer'));
    for (const [name, value] of [
      ['factorName', 'PE 草丝 v2'],
      ['quantity', '1'],
      ['unitCode', 'KG'],
      ['manualUnitPriceTaxInclusive', '20'],
      ['taxRate', '0.13'],
      ['priceSourceName', '基准'],
    ] as const) {
      const input = drawer
        .querySelectorAll('input')
        .find((item) => (item as TestElement).getAttribute('name') === name) as
        | TestElement
        | undefined;
      if (input) {
        input.value = value;
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }
    await flush();
    element(drawer.querySelector('button[type="submit"]')).click();
    await flush();
    expect(ports.submit).toHaveBeenCalledExactlyOnceWith(
      '/api/v1/cost-matrices/matrix-1/factors/factor-1',
      expect.objectContaining({ factorName: 'PE 草丝 v2' }),
      'PUT',
    );
  });
});
