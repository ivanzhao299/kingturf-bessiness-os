// COM-UX 成本矩阵因子对比白盒行为测试（多选模型 → 同因子取价来源并排 + 最优值标记；
// 测试 DOM=零依赖 double（test/fixtures/preact-dom.ts，与 cost-matrix-console 同源）。
import { describe, expect, it, vi } from 'vitest';
import { h, render } from 'preact';
import type { ComponentType } from 'preact';
import { installGlobalTestDom, type TestElement } from '../../../test/fixtures/preact-dom';
import { CostMatrixConsolePage } from './cost-matrix-console';
import type { CostMatrixConsolePorts, CostMatrixRow } from './cost-matrix-ports';
import {
  MAX_COMPARE_MODELS,
  buildComparison,
  type CompareModel,
} from './cost-matrix-console-compare';

const flush = (): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, 0);
  });

const element = (node: unknown): TestElement => {
  if (node === null || node === undefined || (node as { nodeType?: number }).nodeType !== 1)
    throw new Error(`expected element, got ${String(node)}`);
  return node as TestElement;
};

const row = (
  id: string,
  code: string,
): CostMatrixRow & Readonly<{ id: string; code: string; name: string }> => ({
  id,
  code,
  name: `${code} 模型`,
  attention: 'READY_FOR_QUOTE',
  updatedAt: '2026-11-20T00:00:00.000Z',
  isSystemPreset: false,
});

const factor = (overrides: Record<string, unknown>): CostMatrixRow => ({
  id: `factor-${String(overrides.factorCode)}`,
  factorCode: 'YARN',
  factorName: 'PE 草丝',
  category: 'DIRECT_MATERIAL',
  sourceType: 'MANUAL',
  unitCode: 'KG',
  quantity: '4.5',
  manualUnitPriceTaxInclusive: '8.6',
  priceSourceName: '人工录入',
  priceEffectiveAt: '2026-09-01',
  ...overrides,
});

// 模型详情夹具：loadMatrix 的返回形状（因子数组带类型，便于直接喂给 buildComparison）。
type Detail = CostMatrixRow &
  Readonly<{ code: string; name: string; factors: readonly CostMatrixRow[] }>;
const details: Readonly<Record<string, Detail>> = {
  m1: {
    ...row('m1', 'KT-50'),
    currency: 'CNY',
    factors: [
      factor({ sourceType: 'SUPPLIER_QUOTE', priceSourceName: '青岛金特夫草纱' }),
      factor({
        factorCode: 'LABOR',
        factorName: '直接人工',
        unitCode: 'HOUR',
        quantity: '0.075',
        manualUnitPriceTaxInclusive: '40.37',
        sourceType: 'MARKET_REFERENCE',
      }),
    ],
    calculations: [],
  },
  m2: {
    ...row('m2', 'KT-40'),
    currency: 'CNY',
    factors: [
      factor({ manualUnitPriceTaxInclusive: '8.2', quantity: '4.2', sourceType: 'PURCHASE_ORDER' }),
      factor({
        factorCode: 'LABOR',
        factorName: '直接人工',
        unitCode: 'HOUR',
        quantity: '0.075',
        manualUnitPriceTaxInclusive: '41',
        sourceType: 'MARKET_REFERENCE',
      }),
    ],
    calculations: [],
  },
  m3: {
    ...row('m3', 'KT-35'),
    currency: 'CNY',
    factors: [
      factor({ unitCode: 'M2', manualUnitPriceTaxInclusive: '9.9', quantity: '1' }),
      factor({ factorCode: 'BACKING', factorName: '底布', unitCode: 'M2', quantity: '1' }),
    ],
    calculations: [],
  },
};

const textValue = (value: unknown, fallback = ''): string =>
  typeof value === 'string' || typeof value === 'number' ? String(value) : fallback;
const recordValue = (value: unknown): Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};

const portsFor = (overrides: Partial<CostMatrixConsolePorts> = {}): CostMatrixConsolePorts => ({
  permissions: new Set(['cost-matrix:read']),
  initialQuery: {
    page: 1,
    pageSize: 20,
    query: '',
    productFamily: '',
    attention: 'ALL',
    sort: 'ATTENTION',
  },
  initialPage: {
    items: [row('m1', 'KT-50'), row('m2', 'KT-40'), row('m3', 'KT-35')],
    total: 3,
    page: 1,
    pageSize: 20,
  },
  itemVersions: [],
  roleGuidance: () => '',
  textValue,
  recordValue,
  decimalValue: (value) => String(value),
  querySummaries: vi.fn(),
  loadMatrix: vi.fn().mockImplementation((id: string) => Promise.resolve(details[id] ?? null)),
  submit: vi.fn(),
  navigateToQuotes: vi.fn(),
  refresh: vi.fn(),
  ...overrides,
});

const mount = (ports: CostMatrixConsolePorts): TestElement => {
  const host = installGlobalTestDom().document.createElement('div');
  render(h(CostMatrixConsolePage(ports) as ComponentType, {}), host);
  return host;
};

const selectRow = async (host: TestElement, id: string): Promise<void> => {
  element(host.querySelector(`tr[data-row-id="${id}"] [data-select-cell="true"] input`)).click();
  await flush();
};

const model = (id: string, factors: readonly CostMatrixRow[], error = ''): CompareModel => ({
  id,
  code: details[id]?.code ?? id,
  name: details[id]?.name ?? '',
  currency: 'CNY',
  factors,
  error,
});

const portsFace = { textValue, recordValue };

describe('COM-UX 成本矩阵因子对比', () => {
  it('同因子同单位内取最低含税单价为最优；按因子+单位分行，行序取首次出现', () => {
    const comparison = buildComparison(
      [model('m1', details.m1?.factors ?? []), model('m2', details.m2?.factors ?? [])],
      portsFace,
    );
    expect(comparison.rows.map((item) => [item.code, item.unit])).toEqual([
      ['YARN', 'KG'],
      ['LABOR', 'HOUR'],
    ]);
    expect(comparison.rows[0]?.cells.map((cell) => cell?.price ?? null)).toEqual([8.6, 8.2]);
    expect(comparison.rows[0]?.best).toBe(1);
    expect(comparison.rows[1]?.best).toBe(0);
    // 两模型因子集一致时合计可比：最低合计标记。
    expect(comparison.totals).toEqual([4.5 * 8.6 + 0.075 * 40.37, 4.2 * 8.2 + 0.075 * 41]);
    expect(comparison.bestTotal).toBe(1);
  });

  it('单位不同分行不比价；仅一个取价、未录价（≤0）或缺失不标记最优；因子集不同则合计不可比', () => {
    const comparison = buildComparison(
      [
        model('m1', details.m1?.factors ?? []),
        model('m2', details.m2?.factors ?? []),
        model('m3', details.m3?.factors ?? []),
      ],
      portsFace,
    );
    expect(comparison.rows.map((item) => [item.code, item.unit])).toEqual([
      ['YARN', 'KG'],
      ['LABOR', 'HOUR'],
      ['YARN', 'M2'],
      ['BACKING', 'M2'],
    ]);
    const yarnKg = comparison.rows[0];
    expect(yarnKg?.best).toBe(1);
    expect(yarnKg?.cells[2]).toBeNull();
    expect(comparison.rows[2]?.best).toBeNull();
    expect(comparison.rows[3]?.best).toBeNull();
    expect(comparison.bestTotal).toBeNull();
    const unpriced = buildComparison(
      [
        model('a', [factor({ manualUnitPriceTaxInclusive: '0' })]),
        model('b', [factor({ manualUnitPriceTaxInclusive: '8.1' })]),
      ],
      portsFace,
    );
    expect(unpriced.rows[0]?.cells[0]?.price).toBeNull();
    expect(unpriced.rows[0]?.best).toBeNull();
  });

  it('详情加载失败的模型在对应列以空单元格参与，不产生最优标记', () => {
    const comparison = buildComparison(
      [model('m1', details.m1?.factors ?? []), model('m2', [], '加载失败')],
      portsFace,
    );
    expect(comparison.rows[0]?.best).toBeNull();
    expect(comparison.rows[0]?.cells[1]).toBeNull();
  });

  it('勾选两个及以上模型出现对比栏；对比经 loadMatrix 加载详情并渲染对比表与最优标记', async () => {
    const ports = portsFor();
    const host = mount(ports);
    expect(host.querySelector('[data-testid="kt-matrix-compare-open"]')).toBeNull();
    await selectRow(host, 'm1');
    expect(element(host.querySelector('[role="toolbar"]')).textContent).toContain('已选 1 项');
    expect(element(host.querySelector('[data-testid="kt-matrix-compare-open"]')).disabled).toBe(
      true,
    );
    await selectRow(host, 'm2');
    expect(element(host.querySelector('[data-testid="kt-matrix-compare-open"]')).disabled).toBe(
      false,
    );
    element(host.querySelector('[data-testid="kt-matrix-compare-open"]')).click();
    await flush();
    expect(ports.loadMatrix).toHaveBeenCalledTimes(2);
    expect(ports.loadMatrix).toHaveBeenCalledWith('m1');
    expect(ports.loadMatrix).toHaveBeenCalledWith('m2');
    const panel = element(host.querySelector('[data-testid="kt-matrix-compare"]'));
    expect(panel.textContent).toContain('KT-50');
    expect(panel.textContent).toContain('KT-40');
    expect(panel.textContent).toContain('青岛金特夫草纱');
    expect(panel.textContent).toContain('供应商报价');
    const yarnRow = element(panel.querySelector('tbody tr[data-factor="YARN|KG"]'));
    const bestCell = element(yarnRow.querySelector('td[data-best="true"]'));
    expect(bestCell.textContent).toContain('8.2');
    expect(bestCell.textContent).toContain('最优');
    expect(yarnRow.querySelectorAll('td[data-best="true"]')).toHaveLength(1);
    // 表格有标题与表头作用域（图表/表格的文字结构）。
    expect(panel.querySelector('caption')).not.toBeNull();
    expect(panel.querySelectorAll('thead th[scope="col"]').length).toBeGreaterThan(1);
    // 关闭对比后面板移除，选择保留可再次对比。
    element(host.querySelector('[data-testid="kt-matrix-compare-close"]')).click();
    await flush();
    expect(host.querySelector('[data-testid="kt-matrix-compare"]')).toBeNull();
  });

  it('最多同时对比 4 个模型：超出部分不进入选择并提示上限', async () => {
    const ports = portsFor({
      initialPage: {
        items: ['m1', 'm2', 'm3', 'm4', 'm5'].map((id, index) => row(id, `KT-${String(index)}`)),
        total: 5,
        page: 1,
        pageSize: 20,
      },
    });
    const host = mount(ports);
    for (const id of ['m1', 'm2', 'm3', 'm4', 'm5']) await selectRow(host, id);
    expect(MAX_COMPARE_MODELS).toBe(4);
    expect(element(host.querySelector('[role="toolbar"]')).textContent).toContain('已选 4 项');
    expect(host.textContent).toContain('最多同时对比 4 个模型');
    expect(
      element(host.querySelector('tr[data-row-id="m5"] [data-select-cell="true"] input')).checked,
    ).toBe(false);
  });

  it('某模型详情加载失败时在对应列就地提示原因，其余列照常对比', async () => {
    const ports = portsFor({
      loadMatrix: vi
        .fn()
        .mockImplementation((id: string) =>
          id === 'm2'
            ? Promise.reject(new Error('Cost specification model not found'))
            : Promise.resolve(details[id] ?? null),
        ),
    });
    const host = mount(ports);
    await selectRow(host, 'm1');
    await selectRow(host, 'm2');
    element(host.querySelector('[data-testid="kt-matrix-compare-open"]')).click();
    await flush();
    const failed = element(host.querySelector('[data-testid="kt-matrix-compare-column-m2"]'));
    expect(failed.textContent).toContain('Cost specification model not found');
    expect(host.querySelectorAll('td[data-best="true"]')).toHaveLength(0);
  });

  it('所选模型均无因子时对比表给出空态说明', async () => {
    const ports = portsFor({
      loadMatrix: vi
        .fn()
        .mockResolvedValue({ ...row('m1', 'KT-50'), currency: 'CNY', factors: [] }),
    });
    const host = mount(ports);
    await selectRow(host, 'm1');
    await selectRow(host, 'm2');
    element(host.querySelector('[data-testid="kt-matrix-compare-open"]')).click();
    await flush();
    expect(element(host.querySelector('[data-testid="kt-matrix-compare"]')).textContent).toContain(
      '所选模型暂无因子',
    );
  });
});
