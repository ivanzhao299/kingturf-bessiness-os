// U3-COM-3 报价控制台白盒行为测试（Preact 分域重写后的行为面；
// 测试 DOM=零依赖 double（test/fixtures/preact-dom.ts，与 opportunity/solution 同源）。
import { describe, expect, it, vi } from 'vitest';
import { h, render } from 'preact';
import type { ComponentType } from 'preact';
import { installGlobalTestDom, type TestElement } from '../../../test/fixtures/preact-dom';
import { QuoteConsolePage } from './quote-console';
import type { QuoteConsolePorts, QuoteSnapshot } from './quote-ports';

const flush = (): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, 0);
  });

const element = (node: unknown): TestElement => {
  if (node === null || node === undefined || (node as { nodeType?: number }).nodeType !== 1)
    throw new Error(`expected element, got ${String(node)}`);
  return node as TestElement;
};

const quote = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: 'quote-r2',
  quoteId: 'quote-1',
  opportunityId: 'op-1',
  quoteNumber: 'Q-2026-001',
  revision: 2,
  status: 'APPROVED',
  ctrVersionId: 'ctr-v1-aaaa',
  technicalSolutionRevisionId: 'solution-1-aa',
  costDecisionId: 'cost-1-aaaa',
  policyVersionId: 'policy-1-aa',
  currency: 'CNY',
  subtotal: '1000000',
  discount: '0',
  total: '1000000',
  costTotal: '752209',
  margin: '247791',
  marginBasisPoints: 2477,
  validUntil: '2026-12-31T23:59:59.000Z',
  issuedAt: null,
  lines: [
    {
      description: '人造草坪系统',
      quantity: '8050',
      unit_code: 'M2',
      unit_price: '108',
      total: '869400',
    },
  ],
  ...overrides,
});

const snapshot = (): QuoteSnapshot => ({
  quotes: [
    quote(),
    quote({ id: 'quote-r1', revision: 1, status: 'ISSUED', issuedAt: '2026-11-20T01:00:00.000Z' }),
  ],
  costs: [
    {
      id: 'cost-1',
      opportunityId: 'op-1',
      technicalSolutionRevisionId: 'solution-1',
      currency: 'CNY',
      total: '652050',
    },
  ],
  policies: [{ id: 'policy-1', code: 'SP-1', version: 1, status: 'PUBLISHED' }],
  solutions: [{ id: 'solution-1', ctrVersionId: 'ctr-v1' }],
  ctrs: [{ id: 'ctr-v1', opportunityId: 'op-1', code: 'CTR-1', version: 1, status: 'APPROVED' }],
  preferredCostDecisionId: '',
});

const portsFor = (
  extraPermissions: readonly string[] = [],
  overrides: Partial<QuoteConsolePorts> = {},
): QuoteConsolePorts => ({
  permissions: new Set(['quote:read', ...extraPermissions]),
  initialSnapshot: snapshot(),
  textValue: (value, fallback = '') =>
    typeof value === 'string' || typeof value === 'number' ? String(value) : fallback,
  recordValue: (value) =>
    typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {},
  decimalValue: (value) => String(Math.round((value + Number.EPSILON) * 1_000_000) / 1_000_000),
  printIssuedQuote: vi.fn(),
  submit: vi.fn().mockResolvedValue({ id: 'evaluation-1', passed: true }),
  command: vi.fn().mockResolvedValue(undefined),
  clearPreferredCostDecisionId: vi.fn(),
  refresh: vi.fn().mockResolvedValue(snapshot()),
  ...overrides,
});

const mount = (ports: QuoteConsolePorts): TestElement => {
  const host = installGlobalTestDom().document.createElement('div');
  render(h(QuoteConsolePage(ports) as ComponentType, {}), host);
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

const CREATE_FORM: readonly (readonly [string, string])[] = [
  ['quoteNumber', 'Q-2026-009'],
  ['costDecisionId', 'cost-1'],
  ['policyVersionId', 'policy-1'],
  ['turfQuantity', '8050'],
  ['turfPrice', '108'],
  ['installationQuantity', '8050'],
  ['installationPrice', '28'],
  ['serviceQuantity', '1'],
  ['servicePrice', '60000'],
  ['discountPercent', '0'],
  ['validUntil', '2026-12-31'],
];

describe('U3-COM-3 报价控制台', () => {
  it('渲染页头与主列表（报价·版本/状态/总额/毛利/有效期）', () => {
    const host = mount(portsFor());
    expect(host.textContent).toContain('销售报价');
    expect(host.textContent).toContain('Q-2026-001 · 第 2 版');
    expect(host.textContent).toContain('已批准');
    expect(host.textContent).toContain('毛利');
    expect(host.querySelector('.data-table table')).not.toBeNull();
  });

  it('状态筛选与编号检索为客户端过滤', async () => {
    const host = mount(portsFor());
    element(host.querySelector('[data-testid="kt-quote-filter-issued"]')).click();
    await flush();
    expect(host.textContent).toContain('Q-2026-001 · 第 1 版');
    element(host.querySelector('[data-testid="kt-quote-filter-all"]')).click();
    await flush();
    const search = element(host.querySelector('[data-testid="kt-quote-search"]'));
    search.value = 'Q-2026-001';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    await flush();
    expect(host.textContent).toContain('第 1 版');
  });

  it('抽屉聚合报价详情（毛利/行项/引用钉/版本历史）', async () => {
    const host = mount(portsFor());
    element(host.querySelector('[data-testid="kt-quote-open"]')).click();
    await flush();
    const detail = element(host.querySelector('[data-testid="kt-quote-detail"]'));
    expect(detail.textContent).toContain('毛利');
    expect(detail.textContent).toContain('247791（24.77%）');
    expect(detail.textContent).toContain('人造草坪系统');
    expect(detail.textContent).toContain('技术需求 ctr-v1-a');
    const history = element(host.querySelector('[data-testid="kt-quote-history"]'));
    expect(history.textContent).toContain('第 1 版');
    expect(history.textContent).toContain('第 2 版');
  });

  it('新建流：政策预校验后 POST /api/v1/quotes（载荷与 vanilla 同构）', async () => {
    const ports = portsFor(['quote:create']);
    const host = mount(ports);
    element(host.querySelector('[data-testid="kt-quote-create"]')).click();
    await flush();
    for (const [name, value] of CREATE_FORM) fillField(host, name, value);
    await flush();
    element(
      element(host.querySelector('.detail-drawer')).querySelector('button[type="submit"]'),
    ).click();
    await flush();
    expect(ports.submit).toHaveBeenCalledTimes(2);
    expect(ports.submit).toHaveBeenNthCalledWith(1, '/api/v1/sales-policy-evaluations', {
      policyVersionId: 'policy-1',
      costDecisionId: 'cost-1',
      context: {
        marginBasisPoints: expect.any(Number) as number,
        discountBasisPoints: expect.any(Number) as number,
      },
    });
    expect(ports.submit).toHaveBeenNthCalledWith(
      2,
      '/api/v1/quotes',
      expect.objectContaining({
        quoteNumber: 'Q-2026-009',
        opportunityId: 'op-1',
        ctrVersionId: 'ctr-v1',
        technicalSolutionRevisionId: 'solution-1',
        policyEvaluationId: 'evaluation-1',
        subtotal: '1154800',
        lines: expect.any(Array) as unknown[],
      }),
    );
    expect(ports.clearPreferredCostDecisionId).toHaveBeenCalledTimes(1);
  });

  it('政策未通过时错误就地呈现且不创建报价', async () => {
    const ports = portsFor(['quote:create'], {
      submit: vi.fn().mockResolvedValueOnce({
        id: 'evaluation-1',
        passed: false,
        reasons: ['毛利率低于 20% 红线'],
      }),
    });
    const host = mount(ports);
    element(host.querySelector('[data-testid="kt-quote-create"]')).click();
    await flush();
    for (const [name, value] of CREATE_FORM) fillField(host, name, value);
    await flush();
    element(
      element(host.querySelector('.detail-drawer')).querySelector('button[type="submit"]'),
    ).click();
    await flush();
    expect(host.textContent).toContain('销售政策未通过：毛利率低于 20% 红线');
    expect(ports.submit).toHaveBeenCalledTimes(1);
  });

  it('批准流：DRAFT + quote:approve → command(approve)，reason 进入证据链', async () => {
    const ports = portsFor(['quote:approve'], {
      initialSnapshot: {
        ...snapshot(),
        quotes: [quote({ status: 'DRAFT' })],
      },
    });
    const host = mount(ports);
    element(host.querySelector('[data-testid="kt-quote-open"]')).click();
    await flush();
    element(host.querySelector('[data-testid="kt-quote-approve"]')).click();
    await flush();
    fillField(host, 'reason', '报价口径已复核');
    await flush();
    element(
      element(host.querySelector('.detail-drawer')).querySelector('button[type="submit"]'),
    ).click();
    await flush();
    expect(ports.command).toHaveBeenCalledExactlyOnceWith('quote-r2', 'approve', {
      decision: 'APPROVED',
      reason: '报价口径已复核',
    });
  });

  it('签发流：APPROVED + quote:issue → command(issue)', async () => {
    const ports = portsFor(['quote:issue']);
    const host = mount(ports);
    element(host.querySelector('[data-testid="kt-quote-open"]')).click();
    await flush();
    element(host.querySelector('[data-testid="kt-quote-issue"]')).click();
    await flush();
    element(
      element(host.querySelector('.detail-drawer')).querySelector('button[type="submit"]'),
    ).click();
    await flush();
    expect(ports.command).toHaveBeenCalledExactlyOnceWith('quote-r2', 'issue', undefined);
  });

  it('签发后提供打印动作（vanilla printIssuedQuote 直通）', async () => {
    const ports = portsFor([], {
      initialSnapshot: { ...snapshot(), quotes: [quote({ status: 'ISSUED' })] },
    });
    const host = mount(ports);
    element(host.querySelector('[data-testid="kt-quote-open"]')).click();
    await flush();
    element(host.querySelector('[data-testid="kt-quote-print"]')).click();
    await flush();
    expect(ports.printIssuedQuote).toHaveBeenCalledTimes(1);
  });

  it('修订流：ISSUED + quote:update → PUT /api/v1/quotes/:quoteId', async () => {
    const ports = portsFor(['quote:update'], {
      initialSnapshot: { ...snapshot(), quotes: [quote({ status: 'ISSUED' })] },
    });
    const host = mount(ports);
    element(host.querySelector('[data-testid="kt-quote-open"]')).click();
    await flush();
    element(host.querySelector('[data-testid="kt-quote-revise"]')).click();
    await flush();
    fillField(host, 'discountPercent', '10');
    fillField(host, 'validUntil', '2027-01-31');
    await flush();
    element(
      element(host.querySelector('.detail-drawer')).querySelector('button[type="submit"]'),
    ).click();
    await flush();
    expect(ports.submit).toHaveBeenNthCalledWith(
      2,
      '/api/v1/quotes/quote-1',
      expect.objectContaining({ policyEvaluationId: 'evaluation-1', total: '782460' }),
      'PUT',
    );
  });

  it('无权限时行级操作不出现（权限门保持）', async () => {
    const host = mount(portsFor());
    element(host.querySelector('[data-testid="kt-quote-open"]')).click();
    await flush();
    expect(host.querySelector('[data-testid="kt-quote-revise"]')).toBeNull();
    expect(host.querySelector('[data-testid="kt-quote-approve"]')).toBeNull();
    expect(host.querySelector('[data-testid="kt-quote-issue"]')).toBeNull();
    expect(host.querySelector('[data-testid="kt-quote-print"]')).toBeNull();
  });
});
