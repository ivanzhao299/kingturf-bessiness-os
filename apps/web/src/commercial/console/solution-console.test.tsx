// U3-COM-2 技术方案控制台白盒行为测试（Preact 分域重写后的行为面；
// 测试 DOM=零依赖 double（test/fixtures/preact-dom.ts，与 opportunity console 同源）。
import { describe, expect, it, vi } from 'vitest';
import { h, render } from 'preact';
import type { ComponentType } from 'preact';
import { installGlobalTestDom, type TestElement } from '../../../test/fixtures/preact-dom';
import { technicalSolutionOpportunityId } from '../ctr-fields';
import { SolutionConsolePage } from './solution-console';
import type { SolutionConsolePorts, SolutionRow } from './solution-ports';

const flush = (): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, 0);
  });

const element = (node: unknown): TestElement => {
  if (node === null || node === undefined || (node as { nodeType?: number }).nodeType !== 1)
    throw new Error(`expected element, got ${String(node)}`);
  return node as TestElement;
};

const solution = (overrides: Record<string, unknown> = {}): SolutionRow => ({
  id: 'solution-v2',
  technicalSolutionId: 'solution-1',
  opportunityId: 'op-1',
  code: 'TS-1',
  revision: 2,
  status: 'DRAFT',
  ctrVersionId: 'ctr-v1',
  specification: { productFamily: 'KingTurf Pro', pileHeightMm: 50 },
  assumptions: ['满足足球场日常训练'],
  createdAt: '2026-11-20T08:00:00.000Z',
  ...overrides,
});

const ctrs = [
  {
    id: 'ctr-v1',
    opportunityId: 'op-1',
    code: 'CTR-1',
    version: 1,
    status: 'APPROVED',
    title: '足球草',
  },
  { id: 'ctr-v2', opportunityId: 'op-2', code: 'CTR-2', version: 1, status: 'DRAFT' },
];

const portsFor = (
  solutions: readonly SolutionRow[],
  extraPermissions: readonly string[] = [],
  overrides: Partial<SolutionConsolePorts> = {},
): SolutionConsolePorts => ({
  permissions: new Set(['technical-solution:read', ...extraPermissions]),
  initialSolutions: solutions,
  initialCtrs: ctrs,
  technicalSolutionOpportunityId,
  textValue: (value, fallback = '') =>
    typeof value === 'string' || typeof value === 'number' ? String(value) : fallback,
  formValue: (value) =>
    typeof value === 'string' || typeof value === 'number' ? String(value) : '',
  displayRequirement: (value) =>
    typeof value === 'string' || typeof value === 'number' ? String(value) : '—',
  submit: vi.fn().mockResolvedValue(undefined),
  refresh: vi.fn().mockResolvedValue({ solutions, ctrs }),
  ...overrides,
});

const mount = (ports: SolutionConsolePorts): TestElement => {
  const host = installGlobalTestDom().document.createElement('div');
  render(h(SolutionConsolePage(ports) as ComponentType, {}), host);
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

const FULL_FORM: readonly (readonly [string, string])[] = [
  ['ctrVersionId', 'ctr-v1'],
  ['productFamily', 'KingTurf Pro'],
  ['pileHeightMm', '50'],
  ['dtex', '8800'],
  ['yarnMaterial', '聚乙烯单丝 + 曲丝'],
  ['gauge', '3/4 英寸'],
  ['stitchRate', '10500'],
  ['backing', 'SBR + 网格布'],
  ['rollWidthMeters', '4'],
  ['drainageRate', '60'],
  ['infill', '石英砂'],
  ['warrantyYears', '8'],
  ['assumptions', '满足足球场日常训练\n排水坡度 ≥ 0.5%'],
];

describe('U3-COM-2 技术方案控制台', () => {
  it('渲染页头与主列表（方案·版本/状态/技术需求版本/创建时间）', () => {
    const host = mount(portsFor([solution()]));
    expect(host.textContent).toContain('技术方案');
    expect(host.textContent).toContain('TS-1 · 第 2 版');
    expect(host.textContent).toContain('草稿');
    expect(host.querySelector('.data-table table')).not.toBeNull();
  });

  it('状态筛选与编号检索为客户端过滤', async () => {
    const host = mount(
      portsFor([solution(), solution({ id: 's3', code: 'TS-2', status: 'FINAL', revision: 1 })]),
    );
    element(host.querySelector('[data-testid="kt-solution-filter-final"]')).click();
    await flush();
    expect(host.textContent).toContain('TS-2 · 第 1 版');
    expect(host.textContent).not.toContain('TS-1 · 第 2 版');
    element(host.querySelector('[data-testid="kt-solution-filter-all"]')).click();
    await flush();
    const search = element(host.querySelector('[data-testid="kt-solution-search"]'));
    search.value = 'TS-1';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    await flush();
    expect(host.textContent).toContain('TS-1 · 第 2 版');
    expect(host.textContent).not.toContain('TS-2 · 第 1 版');
  });

  it('客户端分页：超出窗口时出现「继续加载」并按需展开', async () => {
    const many = Array.from({ length: 25 }, (_, index) =>
      solution({ id: `s-${String(index)}`, code: `TS-${String(index)}` }),
    );
    const host = mount(portsFor(many));
    expect(host.textContent).toContain('已加载 20 条记录');
    element(element(host.querySelector('.data-table-footer')).querySelector('button')).click();
    await flush();
    expect(host.textContent).toContain('TS-24');
  });

  it('无 create 权限或无已批准 CTR 时不出现新建入口（权限门保持）', () => {
    const host = mount(portsFor([solution()]));
    expect(host.querySelector('[data-testid="kt-solution-create"]')).toBeNull();
    const noApprovedCtr = mount(
      portsFor([solution()], ['technical-solution:create'], {
        initialCtrs: [{ id: 'ctr-v2', code: 'CTR-2', status: 'DRAFT' }],
      }),
    );
    expect(noApprovedCtr.querySelector('[data-testid="kt-solution-create"]')).toBeNull();
  });

  it('编辑流：查看→编辑→提交即 PUT /:technicalSolutionId（final=false）', async () => {
    const ports = portsFor([solution()], ['technical-solution:update']);
    const host = mount(ports);
    element(host.querySelector('[data-testid="kt-solution-open"]')).click();
    await flush();
    expect(element(host.querySelector('[data-testid="kt-solution-detail"]')).textContent).toContain(
      'KingTurf Pro',
    );
    element(host.querySelector('[data-testid="kt-solution-edit"]')).click();
    await flush();
    for (const [name, value] of FULL_FORM) fillField(host, name, value);
    await flush();
    element(
      element(host.querySelector('.detail-drawer')).querySelector('button[type="submit"]'),
    ).click();
    await flush();
    expect(ports.submit).toHaveBeenCalledExactlyOnceWith(
      '/api/v1/technical-solutions/solution-1',
      {
        ctrVersionId: 'ctr-v1',
        specification: {
          productFamily: 'KingTurf Pro',
          pileHeightMm: 50,
          dtex: 8800,
          yarnMaterial: '聚乙烯单丝 + 曲丝',
          gauge: '3/4 英寸',
          stitchRate: 10500,
          backing: 'SBR + 网格布',
          rollWidthMeters: 4,
          drainageRate: 60,
          infill: '石英砂',
          warrantyYears: 8,
        },
        assumptions: ['满足足球场日常训练', '排水坡度 ≥ 0.5%'],
        final: false,
      },
      'PUT',
    );
  });

  it('定稿流：查看→定稿发布→提交 final=true', async () => {
    const ports = portsFor([solution()], ['technical-solution:update']);
    const host = mount(ports);
    element(host.querySelector('[data-testid="kt-solution-open"]')).click();
    await flush();
    element(host.querySelector('[data-testid="kt-solution-publish"]')).click();
    await flush();
    for (const [name, value] of FULL_FORM) fillField(host, name, value);
    await flush();
    element(
      element(host.querySelector('.detail-drawer')).querySelector('button[type="submit"]'),
    ).click();
    await flush();
    expect(ports.submit).toHaveBeenCalledExactlyOnceWith(
      '/api/v1/technical-solutions/solution-1',
      expect.objectContaining({ final: true, ctrVersionId: 'ctr-v1' }),
      'PUT',
    );
  });

  it('新建流：create 抽屉提交 POST，opportunityId 由已批准 CTR 推导', async () => {
    const ports = portsFor([], ['technical-solution:create']);
    const host = mount(ports);
    element(host.querySelector('[data-testid="kt-solution-create"]')).click();
    await flush();
    for (const [name, value] of [
      ['code', 'TS-2026-002'],
      ...FULL_FORM,
      ['state', 'DRAFT'],
    ] as readonly (readonly [string, string])[])
      fillField(host, name, value);
    await flush();
    element(
      element(host.querySelector('.detail-drawer')).querySelector('button[type="submit"]'),
    ).click();
    await flush();
    expect(ports.submit).toHaveBeenCalledExactlyOnceWith(
      '/api/v1/technical-solutions',
      expect.objectContaining({
        opportunityId: 'op-1',
        code: 'TS-2026-002',
        ctrVersionId: 'ctr-v1',
        final: false,
        specification: expect.objectContaining({
          productFamily: 'KingTurf Pro',
          pileHeightMm: 50,
        }) as Record<string, unknown>,
        assumptions: ['满足足球场日常训练', '排水坡度 ≥ 0.5%'],
      }),
      'POST',
    );
  });

  it('无 update 权限时抽屉不出现行级操作（空态替代）', async () => {
    const host = mount(portsFor([solution()]));
    element(host.querySelector('[data-testid="kt-solution-open"]')).click();
    await flush();
    expect(host.querySelector('[data-testid="kt-solution-edit"]')).toBeNull();
    expect(host.querySelector('[data-testid="kt-solution-publish"]')).toBeNull();
  });

  it('刷新失败时错误经 DataTable error 面暴露', async () => {
    const ports = portsFor([], [], {
      refresh: vi.fn().mockRejectedValue(new Error('技术方案加载失败')),
    });
    const host = mount(ports);
    element(host.querySelector('[data-testid="kt-solution-refresh"]')).click();
    await flush();
    expect(host.querySelector('.data-table-error')).not.toBeNull();
    expect(host.textContent).toContain('技术方案加载失败');
  });
});
