// U3-COM-3 报价控制台白盒行为测试（Preact 分域重写后的行为面；
// 测试 DOM=零依赖 double（test/fixtures/preact-dom.ts，与 opportunity/solution 同源）。
import { describe, expect, it, vi } from 'vitest';
import { h, render } from 'preact';
import type { ComponentType } from 'preact';
import {
  installGlobalTestDom,
  TestDocument,
  TestEvent,
  type TestElement,
} from '../../../test/fixtures/preact-dom';
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

const active = (): TestElement | null => TestDocument.current.activeElement as TestElement | null;

// DetailDrawer 的初焦在「绘制之后」才落到关闭按钮。下面的焦点用例先等它到位再开始；断言本身是同步的
// （FocusAnchor 在提交阶段把焦点带回抽屉），不与那个 effect 赛跑。
const eventually = async (condition: () => boolean, what: string): Promise<void> => {
  const deadline = Date.now() + 5000;
  while (!condition()) {
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${what}`);
    await new Promise((resolve) => {
      setTimeout(resolve, 10);
    });
  }
};

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
    // COM-UX：版本历史由水平版本时间线承载（时间线行为见 quote-console-timeline.test）。
    const history = element(host.querySelector('[data-testid="kt-quote-timeline"]'));
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
// 回归（TD-WF-004 的调用侧，WF-B 接入时发现）：批准 / 签发两个表单此前把 runCommand 的 Promise
// 用 void 丢掉，FormSection 拿不到它——提交期间既不置灰也不拦重入，双击会发出两次不可逆的命令。
describe('报价行内表单与防重复提交（FormSection 要拿到 onSubmit 的 Promise）', () => {
  const submitButtonOf = (host: TestElement): TestElement =>
    element(element(host.querySelector('.detail-drawer')).querySelector('button[type="submit"]'));

  it.each([
    ['quote:approve', 'kt-quote-approve', 'DRAFT', 'approve'],
    ['quote:issue', 'kt-quote-issue', 'APPROVED', 'issue'],
  ] as const)(
    '「%s」：请求未返回前再次点击提交，只发出一次 command；失败后可重试',
    async (permission, openTestid, status, action) => {
      // 每次调用都挂起，由测试决定是失败还是成功。
      let fail: (reason: Error) => void = () => undefined;
      const command = vi.fn(
        () =>
          new Promise<void>((_resolve, reject) => {
            fail = reject;
          }),
      );
      const ports = portsFor([permission], {
        command,
        initialSnapshot: { ...snapshot(), quotes: [quote({ status })] },
      });
      const host = mount(ports);
      element(host.querySelector('[data-testid="kt-quote-open"]')).click();
      await flush();
      element(host.querySelector(`[data-testid="${openTestid}"]`)).click();
      await flush();
      if (action === 'approve') {
        fillField(host, 'reason', '报价口径已复核');
        await flush();
      }
      const submit = submitButtonOf(host);
      // 双击：两次点击之间不让出事件循环（重渲染尚未发生，disabled 还没来得及生效）。
      submit.click();
      submit.click();
      await flush();
      expect(command).toHaveBeenCalledTimes(1);
      expect(submit.disabled).toBe(true);
      fail(new Error('网络错误'));
      await flush();
      await flush();
      // 失败后表单留在原处，按钮恢复可点，可以再试。
      expect(submit.disabled).toBe(false);
      submit.click();
      await flush();
      expect(command).toHaveBeenCalledTimes(2);
    },
  );

  // TD-WF-014④（写流程冒烟 WS-P3-04）：点「创建报价修订」后这个按钮被行内表单替换，键盘焦点原先掉到
  // 页面主体，Esc 到不了抽屉。现在焦点进入表单，Esc 照旧关闭抽屉。
  it('打开行内表单后焦点进入表单首个字段，Esc 仍能关闭抽屉', async () => {
    const host = mount(portsFor(['quote:update']));
    element(host.querySelectorAll('[data-testid="kt-quote-open"]')[1] ?? null).click();
    await flush();
    const closeButton = element(host.querySelector('.detail-drawer .drawer-close'));
    await eventually(() => active() === closeButton, 'the drawer initial focus');
    const revise = element(host.querySelector('[data-testid="kt-quote-revise"]'));
    revise.focus();
    revise.click();
    await flush();
    const field = element(host.querySelector('.detail-drawer form.form-section input'));
    expect(host.querySelector('[data-testid="kt-quote-revise"]')).toBeNull();
    expect(active()).toBe(field);
    field.dispatchEvent(new TestEvent('keydown', { key: 'Escape' }));
    await flush();
    expect(host.querySelector('.detail-drawer')).toBeNull();
  });
});
