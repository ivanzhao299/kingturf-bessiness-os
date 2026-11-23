// COM-UX 版本差异（方案 / CTR）白盒行为测试：字段级红绿标记、基准版本选择、变更数列；
// 测试 DOM=零依赖 double（test/fixtures/preact-dom.ts，与 solution/ctr console 同源）。
import { describe, expect, it, vi } from 'vitest';
import { h, render } from 'preact';
import type { ComponentType } from 'preact';
import { installGlobalTestDom, type TestElement } from '../../../test/fixtures/preact-dom';
import { technicalSolutionOpportunityId } from '../ctr-fields';
import { SolutionConsolePage } from './solution-console';
import type { SolutionConsolePorts, SolutionRow } from './solution-ports';
import { CtrConsolePage } from './ctr-console';
import type { CtrConsolePorts, CtrRow } from './ctr-ports';
import {
  countChanges,
  diffFields,
  diffLists,
  previousVersion,
  sortVersions,
} from './solution-console-diff';

const flush = (): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, 0);
  });

const element = (node: unknown): TestElement => {
  if (node === null || node === undefined || (node as { nodeType?: number }).nodeType !== 1)
    throw new Error(`expected element, got ${String(node)}`);
  return node as TestElement;
};

const textValue = (value: unknown, fallback = ''): string =>
  typeof value === 'string' || typeof value === 'number' ? String(value) : fallback;
const displayRequirement = (value: unknown): string =>
  typeof value === 'string' || typeof value === 'number' ? String(value) : '—';
const recordValue = (value: unknown): Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};

// 页面工厂：(ports) => ComponentType（与既有控制台测试同一挂载方式）。
const mountWith = (page: (ports: never) => ComponentType, ports: unknown): TestElement => {
  const host = installGlobalTestDom().document.createElement('div');
  render(h(page(ports as never), {}), host);
  return host;
};
const rowOf = (host: TestElement, id: string): TestElement =>
  element(host.querySelector(`tr[data-row-id="${id}"]`));
const openRow = async (host: TestElement, id: string, testId: string): Promise<void> => {
  element(rowOf(host, id).querySelector(`[data-testid="${testId}"]`)).click();
  await flush();
};
const chooseBaseline = async (host: TestElement, id: string): Promise<void> => {
  const select = element(host.querySelector('[data-testid="kt-diff-baseline"]'));
  select.value = id;
  select.dispatchEvent(new Event('input', { bubbles: true }));
  await flush();
};

const specification = {
  productFamily: 'KingTurf Pro',
  pileHeightMm: 50,
  dtex: 8800,
  warrantyYears: 8,
};
const solution = (overrides: Record<string, unknown>): SolutionRow => ({
  id: 'solution-v1',
  technicalSolutionId: 'solution-1',
  opportunityId: 'op-1',
  code: 'TS-1',
  revision: 1,
  status: 'DRAFT',
  ctrVersionId: 'ctr-v1',
  specification,
  assumptions: ['满足足球场日常训练', '排水坡度 ≥ 0.5%'],
  createdAt: '2026-11-20T08:00:00.000Z',
  ...overrides,
});
const solutions: readonly SolutionRow[] = [
  solution({}),
  solution({
    id: 'solution-v2',
    revision: 2,
    specification: { ...specification, pileHeightMm: 45 },
    assumptions: ['满足足球场日常训练', '夜间照明兼容'],
  }),
  solution({
    id: 'solution-v3',
    revision: 3,
    specification: { ...specification, pileHeightMm: 40, productFamily: 'KingTurf Sport' },
    assumptions: ['满足足球场日常训练', '夜间照明兼容'],
  }),
];

const solutionPorts = (): SolutionConsolePorts => ({
  permissions: new Set(['technical-solution:read']),
  initialSolutions: solutions,
  initialCtrs: [],
  technicalSolutionOpportunityId,
  textValue,
  formValue: (value) =>
    typeof value === 'string' || typeof value === 'number' ? String(value) : '',
  displayRequirement,
  submit: vi.fn().mockResolvedValue(undefined),
  refresh: vi.fn().mockResolvedValue({ solutions, ctrs: [] }),
});

const requirements = {
  application: '足球场',
  pileHeightMm: 50,
  color: '双色翠绿',
  warrantyYears: 8,
};
const ctr = (overrides: Record<string, unknown>): CtrRow => ({
  id: 'ctr-version-1',
  ctrId: 'ctr-1',
  code: 'CTR-1',
  title: '学校需求',
  version: 1,
  status: 'APPROVED',
  requirements,
  attachments: [],
  ...overrides,
});
const ctrs: readonly CtrRow[] = [
  ctr({}),
  ctr({
    id: 'ctr-version-2',
    version: 2,
    status: 'REJECTED',
    title: '学校需求（修订）',
    requirements: { ...requirements, color: '新版绿' },
  }),
];
const ctrPorts = (): CtrConsolePorts => ({
  permissions: new Set(['ctr:read']),
  initialCtrs: ctrs,
  initialSolutions: [],
  opportunities: [],
  textValue,
  recordValue,
  displayRequirement,
  submit: vi.fn().mockResolvedValue(null),
  uploadAttachment: vi.fn().mockResolvedValue(undefined),
  refresh: vi.fn().mockResolvedValue({ ctrs, solutions: [] }),
});

describe('COM-UX 版本差异（纯函数）', () => {
  it('字段差异：基准缺失不标变更；显示文本不同才标变更', () => {
    const labels = [
      ['pileHeightMm', '草高'],
      ['dtex', '纤度'],
    ] as const;
    const fields = diffFields(
      labels,
      { pileHeightMm: 40, dtex: 8800 },
      { pileHeightMm: 45, dtex: 8800 },
      displayRequirement,
    );
    expect(fields.map((field) => [field.key, field.changed, field.previous])).toEqual([
      ['pileHeightMm', true, '45'],
      ['dtex', false, '8800'],
    ]);
    expect(
      diffFields(labels, { pileHeightMm: 40 }, null, displayRequirement).every((f) => !f.changed),
    ).toBe(true);
  });

  it('列表差异按成员比对；变更数 = 字段变更 + 增删项', () => {
    const list = diffLists(['a', 'b'], ['a', 'c']);
    expect(list).toEqual({ added: ['c'], removed: ['b'] });
    expect(
      countChanges([{ key: 'x', label: 'x', current: '1', previous: '2', changed: true }], [list]),
    ).toBe(3);
    expect(
      countChanges([{ key: 'x', label: 'x', current: '1', previous: '1', changed: false }]),
    ).toBe(0);
  });

  it('上一版本按 id 定位（不依赖对象身份），首个版本为 null', () => {
    const versions = sortVersions(
      [
        { id: 'b', n: 2 },
        { id: 'a', n: 1 },
        { id: 'c', n: 3 },
      ],
      (row) => row.n,
    );
    expect(versions.map((row) => row.id)).toEqual(['a', 'b', 'c']);
    expect(previousVersion(versions, { id: 'c', n: 3 }, (row) => row.id)?.id).toBe('b');
    expect(previousVersion(versions, { id: 'a', n: 1 }, (row) => row.id)).toBeNull();
  });
});

describe('COM-UX 技术方案版本差异', () => {
  it('字段级红绿标记：变更字段同时给出当前值与上一版值，未变更字段原样', async () => {
    const host = mountWith(SolutionConsolePage, solutionPorts());
    await openRow(host, 'solution-v3', 'kt-solution-open');
    const spec = element(host.querySelector('[data-testid="kt-solution-spec"]'));
    const changed = element(spec.querySelector('[data-field="pileHeightMm"]'));
    expect(changed.getAttribute('data-changed')).toBe('true');
    expect(element(changed.querySelector('.com-diff-new')).textContent).toBe('40');
    expect(element(changed.querySelector('.com-diff-old')).textContent).toBe('45');
    expect(element(changed.querySelector('dd')).textContent).toBe('40（上一版：45）');
    expect(element(spec.querySelector('[data-field="dtex"]')).getAttribute('data-changed')).toBe(
      'false',
    );
    expect(spec.querySelector('[data-field="dtex"] .com-diff-old')).toBeNull();
    expect(element(host.querySelector('[data-testid="kt-diff-summary"]')).textContent).toContain(
      '较第 2 版变更 2 项',
    );
  });

  it('工程假设按成员标出新增与移除', async () => {
    const host = mountWith(SolutionConsolePage, solutionPorts());
    await openRow(host, 'solution-v2', 'kt-solution-open');
    const items = element(host.querySelector('[data-testid="kt-solution-assumptions"]'));
    expect(items.querySelector('li[data-change="added"]')?.textContent).toBe('夜间照明兼容');
    expect(items.querySelector('li[data-change="removed"]')?.textContent).toBe('排水坡度 ≥ 0.5%');
    expect(items.querySelector('li[data-change="same"]')?.textContent).toBe('满足足球场日常训练');
  });

  it('可改选更早版本作为基准并重新比对；首个版本不出现基准选择', async () => {
    const host = mountWith(SolutionConsolePage, solutionPorts());
    await openRow(host, 'solution-v3', 'kt-solution-open');
    await chooseBaseline(host, 'solution-v1');
    expect(element(host.querySelector('[data-testid="kt-diff-summary"]')).textContent).toContain(
      '较第 1 版变更 4 项',
    );
    const family = element(
      host.querySelector('[data-testid="kt-solution-spec"] [data-field="productFamily"]'),
    );
    expect(family.getAttribute('data-changed')).toBe('true');
    expect(element(family.querySelector('.com-diff-old')).textContent).toBe('KingTurf Pro');

    const first = mountWith(SolutionConsolePage, solutionPorts());
    await openRow(first, 'solution-v1', 'kt-solution-open');
    expect(first.querySelector('[data-testid="kt-diff-baseline"]')).toBeNull();
    expect(element(first.querySelector('[data-testid="kt-diff-summary"]')).textContent).toContain(
      '首个版本',
    );
  });

  it('列表新增「较上一版」列：变更数 / 首个版本', () => {
    const host = mountWith(SolutionConsolePage, solutionPorts());
    expect(rowOf(host, 'solution-v1').textContent).toContain('首个版本');
    expect(rowOf(host, 'solution-v2').textContent).toContain('3 项变更');
    expect(rowOf(host, 'solution-v3').textContent).toContain('2 项变更');
  });
});

describe('COM-UX 技术需求单版本差异', () => {
  it('需求字段与标题均参与比对；保留「当前值（上一版：旧值）」文案契约并加红绿标记', async () => {
    const host = mountWith(CtrConsolePage, ctrPorts());
    await openRow(host, 'ctr-version-2', 'kt-ctr-open');
    expect(host.textContent).toContain('新版绿（上一版：双色翠绿）');
    const spec = element(host.querySelector('[data-testid="kt-ctr-spec"]'));
    const color = element(spec.querySelector('[data-field="color"]'));
    expect(color.getAttribute('data-changed')).toBe('true');
    expect(element(color.querySelector('.com-diff-new')).textContent).toBe('新版绿');
    expect(element(color.querySelector('.com-diff-old')).textContent).toBe('双色翠绿');
    expect(element(spec.querySelector('[data-field="title"]')).getAttribute('data-changed')).toBe(
      'true',
    );
    expect(
      element(spec.querySelector('[data-field="application"]')).getAttribute('data-changed'),
    ).toBe('false');
    expect(element(host.querySelector('[data-testid="kt-diff-summary"]')).textContent).toContain(
      '较第 1 版变更 2 项',
    );
  });

  it('列表「较上一版」列与首个版本空态', async () => {
    const host = mountWith(CtrConsolePage, ctrPorts());
    expect(rowOf(host, 'ctr-version-1').textContent).toContain('首个版本');
    expect(rowOf(host, 'ctr-version-2').textContent).toContain('2 项变更');
    await openRow(host, 'ctr-version-1', 'kt-ctr-open');
    expect(host.querySelector('[data-testid="kt-diff-baseline"]')).toBeNull();
    expect(host.textContent).not.toContain('（上一版：');
  });
});
