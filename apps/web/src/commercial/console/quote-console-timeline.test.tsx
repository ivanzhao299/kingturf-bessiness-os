// COM-UX 报价版本时间线 + 毛利可视化白盒行为测试（Preact 控制台行为面；
// 测试 DOM=零依赖 double（test/fixtures/preact-dom.ts，与 quote-console 同源）。
import { describe, expect, it, vi } from 'vitest';
import { h, render } from 'preact';
import type { ComponentType } from 'preact';
import { installGlobalTestDom, type TestElement } from '../../../test/fixtures/preact-dom';
import { QuoteConsolePage } from './quote-console';
import type { QuoteConsolePorts, QuoteRow, QuoteSnapshot } from './quote-ports';
import {
  DEFAULT_MINIMUM_MARGIN_BASIS_POINTS,
  marginBand,
  marginThresholds,
  policyMinimumMargin,
} from './quote-console-timeline';

const flush = (): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, 0);
  });

const element = (node: unknown): TestElement => {
  if (node === null || node === undefined || (node as { nodeType?: number }).nodeType !== 1)
    throw new Error(`expected element, got ${String(node)}`);
  return node as TestElement;
};

const quote = (overrides: Record<string, unknown> = {}): QuoteRow => ({
  id: 'quote-r2',
  quoteId: 'quote-1',
  quoteNumber: 'Q-2026-001',
  revision: 2,
  status: 'APPROVED',
  policyVersionId: 'policy-1',
  currency: 'CNY',
  subtotal: '1050000',
  discount: '0',
  total: '1050000',
  costTotal: '752209',
  margin: '262500',
  marginBasisPoints: 2500,
  validUntil: '2026-12-31T23:59:59.000Z',
  issuedAt: null,
  approvals: [{ decision: 'APPROVED', decided_at: '2026-11-21T02:00:00.000Z' }],
  lines: [],
  ...overrides,
});

const firstRevision = quote({
  id: 'quote-r1',
  revision: 1,
  status: 'ISSUED',
  total: '1000000',
  margin: '247791',
  marginBasisPoints: 2477,
  issuedAt: '2026-11-20T01:00:00.000Z',
  approvals: [],
});

const POLICY: QuoteRow = {
  id: 'policy-1',
  code: 'SP-1',
  version: 1,
  status: 'PUBLISHED',
  rules: [
    {
      when: {
        op: 'lt',
        left: { op: 'input', path: 'marginBasisPoints' },
        right: { op: 'literal', value: 2500 },
      },
      effect: { passed: false, approvalRequired: true, minimumMarginBasisPoints: 2500 },
      reason: '毛利率低于 25% 红线',
    },
  ],
};

const recordValue = (value: unknown): Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};

const snapshotWith = (
  quotes: readonly QuoteRow[],
  policies: readonly QuoteRow[],
): QuoteSnapshot => ({
  quotes,
  costs: [],
  policies,
  solutions: [],
  ctrs: [],
  preferredCostDecisionId: '',
});

const portsForWith = (
  quotes: readonly QuoteRow[],
  policies: readonly QuoteRow[] = [POLICY],
): QuoteConsolePorts => {
  const snapshot = snapshotWith(quotes, policies);
  return {
    permissions: new Set(['quote:read']),
    initialSnapshot: snapshot,
    textValue: (value, fallback = '') =>
      typeof value === 'string' || typeof value === 'number' ? String(value) : fallback,
    recordValue,
    decimalValue: (value) => String(value),
    printIssuedQuote: vi.fn(),
    submit: vi.fn().mockResolvedValue({}),
    command: vi.fn().mockResolvedValue(undefined),
    clearPreferredCostDecisionId: vi.fn(),
    refresh: vi.fn().mockResolvedValue(snapshot),
  };
};

const mount = (ports: QuoteConsolePorts): TestElement => {
  const host = installGlobalTestDom().document.createElement('div');
  render(h(QuoteConsolePage(ports) as ComponentType, {}), host);
  return host;
};

const rowOf = (host: TestElement, id: string): TestElement =>
  element(host.querySelector(`tr[data-row-id="${id}"]`));

const openRow = async (host: TestElement, id: string): Promise<void> => {
  element(rowOf(host, id).querySelector('[data-testid="kt-quote-open"]')).click();
  await flush();
};

const nodesOf = (host: TestElement): readonly TestElement[] =>
  host.querySelectorAll('[data-testid="kt-quote-version"]') as TestElement[];

const meterOf = (scope: TestElement, selector: string): TestElement | null =>
  scope.querySelector(selector) as TestElement | null;
const bandOf = (row: TestElement): string | null =>
  meterOf(row, '[data-testid="kt-quote-margin"]')?.getAttribute('data-band') ?? null;
const attrOf = (node: TestElement | null, name: string): string | null =>
  node?.getAttribute(name) ?? null;

describe('COM-UX 报价毛利可视化', () => {
  it('毛利分带：低于政策红线为红，红线与预警线之间为黄，达到预警线为绿', () => {
    const thresholds = marginThresholds(2500);
    expect(thresholds).toEqual({ minimum: 2500, watch: 3000, fromPolicy: true });
    expect(marginBand(2477, thresholds)).toBe('below');
    expect(marginBand(2500, thresholds)).toBe('watch');
    expect(marginBand(2999, thresholds)).toBe('watch');
    expect(marginBand(3000, thresholds)).toBe('healthy');
  });

  it('红线阈值取自报价绑定的政策版本；不可解析时回退默认红线并如实标注', () => {
    expect(policyMinimumMargin(quote(), [POLICY])).toBe(2500);
    expect(policyMinimumMargin(quote({ policyVersionId: 'retired' }), [POLICY])).toBeNull();
    const fallback = marginThresholds(null);
    expect(fallback.minimum).toBe(DEFAULT_MINIMUM_MARGIN_BASIS_POINTS);
    expect(fallback.fromPolicy).toBe(false);
  });

  it('列表毛利列附带迷你毛利率条，按政策红线分带（原金额文案保持，图表有文字替代）', () => {
    const host = mount(portsForWith([firstRevision, quote()]));
    expect(rowOf(host, 'quote-r1').textContent).toContain('247791（24.77%）');
    expect(bandOf(rowOf(host, 'quote-r1'))).toBe('below');
    expect(bandOf(rowOf(host, 'quote-r2'))).toBe('watch');
    const meter = meterOf(rowOf(host, 'quote-r1'), '[data-testid="kt-quote-margin"]');
    expect(attrOf(meter, 'role')).toBe('img');
    expect(attrOf(meter, 'aria-label')).toBe('毛利率 24.77%，低于红线（红线 25%）');
  });

  it('毛利不可见（字段受限）时不给出分带结论，显示「—」而非误判 0%', () => {
    const masked = quote({
      id: 'quote-r3',
      revision: 3,
      marginBasisPoints: undefined,
      margin: undefined,
    });
    const row = rowOf(mount(portsForWith([masked])), 'quote-r3');
    expect(bandOf(row)).toBe('unknown');
    expect(row.textContent).toContain('—（—）');
    expect(attrOf(meterOf(row, '[data-testid="kt-quote-margin"]'), 'aria-label')).toBe(
      '毛利率不可见',
    );
  });
});

describe('COM-UX 报价版本时间线', () => {
  it('抽屉内按版本水平排列：状态/日期/毛利与较上一版差额，当前版本高亮', async () => {
    const host = mount(portsForWith([firstRevision, quote()]));
    await openRow(host, 'quote-r2');
    const nodes = nodesOf(host);
    expect(nodes).toHaveLength(2);
    expect(nodes[0]?.textContent).toContain('第 1 版');
    expect(nodes[0]?.textContent).toContain('已签发');
    expect(nodes[0]?.textContent).toContain('签发 2026-11-20');
    expect(nodes[0]?.textContent).toContain('247791（24.77%）');
    expect(nodes[0]?.textContent).toContain('首版');
    expect(nodes[1]?.textContent).toContain('第 2 版');
    expect(nodes[1]?.textContent).toContain('已批准');
    expect(nodes[1]?.textContent).toContain('审批 2026-11-21');
    expect(nodes[1]?.textContent).toContain('总额 +5.0%');
    expect(nodes[1]?.textContent).toContain('毛利率 +0.23pp');
    expect(nodes[1]?.getAttribute('aria-current')).toBe('true');
    expect(nodes[0]?.getAttribute('aria-current')).toBe('false');
    expect(nodes[1]?.textContent).toContain('当前查看');
    // 原毛利文案契约保持。
    expect(element(host.querySelector('[data-testid="kt-quote-detail"]')).textContent).toContain(
      '262500（25%）',
    );
  });

  it('点击时间线节点切换查看的版本（无需回列表重新打开）', async () => {
    const host = mount(portsForWith([firstRevision, quote()]));
    await openRow(host, 'quote-r2');
    nodesOf(host)[0]?.click();
    await flush();
    expect(element(host.querySelector('.drawer-header')).textContent).toContain('第 1 版');
    expect(element(host.querySelector('[data-testid="kt-quote-detail"]')).textContent).toContain(
      '247791（24.77%）',
    );
    expect(
      element(
        host.querySelector('[data-testid="kt-quote-margin-detail"] [role="img"]'),
      ).getAttribute('aria-label'),
    ).toBe('毛利率 24.77%，低于红线（红线 25%）');
  });

  it('详情毛利仪表条标注红线与预警线并给出文字结论；默认红线如实标注', async () => {
    const host = mount(portsForWith([firstRevision, quote()]));
    await openRow(host, 'quote-r2');
    const meter = element(host.querySelector('[data-testid="kt-quote-margin-detail"]'));
    expect(meter.textContent).toContain('25%');
    expect(meter.textContent).toContain('贴近红线');
    expect(meter.textContent).toContain('红线 25% · 预警 30%');

    const fallbackHost = mount(portsForWith([quote()], []));
    await openRow(fallbackHost, 'quote-r2');
    const fallback = element(fallbackHost.querySelector('[data-testid="kt-quote-margin-detail"]'));
    expect(fallback.textContent).toContain('毛利健康');
    expect(fallback.textContent).toContain('红线 20%（默认） · 预警 25%');
  });

  it('仅一个版本时时间线显示单节点且不出现差额', async () => {
    const single = mount(portsForWith([quote()]));
    await openRow(single, 'quote-r2');
    expect(nodesOf(single)).toHaveLength(1);
    expect(single.textContent).toContain('首版');
    expect(single.textContent).not.toContain('总额 +');
  });
});
