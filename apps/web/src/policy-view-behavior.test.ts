import { afterEach, describe, expect, it, vi } from 'vitest';
import { h, render } from 'preact';
import type { ComponentType } from 'preact';
import { installGlobalTestDom, type TestElement } from '../test/fixtures/preact-dom';
import { noticeOf } from '../test/fixtures/console-notice';
import { PolicyConsolePage } from './commercial/console/policy-console';
import type { PolicyConsolePorts, PolicyRow } from './commercial/console/policy-ports';

// U3-COM-6：销售政策控制台真实回调契约（原 policy-view 行为面等价迁移——
// 规则构造独立 oracle、版本门、评估门、判定卡片渲染；错误经提交错误面呈现）。
const flush = (): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, 0);
  });

const element = (node: unknown): TestElement => {
  if (node === null || node === undefined || (node as { nodeType?: number }).nodeType !== 1)
    throw new Error(`expected element, got ${String(node)}`);
  return node as TestElement;
};

const published: PolicyRow = {
  id: 'policy-v2',
  definitionId: 'definition-1',
  code: 'SP-1',
  name: '标准销售政策',
  version: 2,
  status: 'PUBLISHED',
  publishedAt: '2026-11-20T00:00:00Z',
  rules: [
    {
      when: {
        op: 'lt',
        left: { op: 'input', path: 'marginBasisPoints' },
        right: { op: 'literal', value: 2055 },
      },
      effect: { passed: false, approvalRequired: true, minimumMarginBasisPoints: 2055 },
      reason: '毛利率低于 20.55% 红线',
    },
    {
      when: {
        op: 'gt',
        left: { op: 'input', path: 'discountBasisPoints' },
        right: { op: 'literal', value: 1026 },
      },
      effect: { approvalRequired: true, maximumDiscountBasisPoints: 1026 },
      reason: '折扣超过 10.256% 上限',
    },
  ],
};

// Independently spelled rules oracle (matches the vanilla production mapper output).
const rules = [
  {
    when: {
      op: 'lt',
      left: { op: 'input', path: 'marginBasisPoints' },
      right: { op: 'literal', value: 2055 },
    },
    effect: { passed: false, approvalRequired: true, minimumMarginBasisPoints: 2055 },
    reason: '毛利率低于 20.55% 红线',
  },
  {
    when: {
      op: 'gt',
      left: { op: 'input', path: 'discountBasisPoints' },
      right: { op: 'literal', value: 1026 },
    },
    effect: { approvalRequired: true, maximumDiscountBasisPoints: 1026 },
    reason: '折扣超过 10.256% 上限',
  },
  { publish: true },
];

const portsFor = (
  permissions: readonly string[],
  views: Readonly<Record<string, readonly Record<string, unknown>[]>>,
  overrides: Partial<PolicyConsolePorts> = {},
): PolicyConsolePorts => ({
  permissions: new Set(['sales-policy:read', ...permissions]),
  initialPolicies: views['/api/v1/sales-policies'] ?? [],
  initialCosts: views['/api/v1/cost-evaluations'] ?? [],
  initialEvaluations: views['/api/v1/sales-policy-evaluations'] ?? [],
  textValue: (value, fallback = '') =>
    typeof value === 'string' || typeof value === 'number' ? String(value) : fallback,
  recordValue: (value) =>
    typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {},
  submit: vi.fn().mockResolvedValue(null),
  refresh: vi.fn().mockResolvedValue({
    policies: views['/api/v1/sales-policies'] ?? [],
    costs: views['/api/v1/cost-evaluations'] ?? [],
    evaluations: views['/api/v1/sales-policy-evaluations'] ?? [],
  }),
  ...overrides,
});

const mount = (ports: PolicyConsolePorts): TestElement => {
  const host = installGlobalTestDom().document.createElement('div');
  render(h(PolicyConsolePage(ports) as ComponentType, {}), host);
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
  ['code', 'SP-NEW'],
  ['name', '新政策'],
  ['minimumMargin', '20.55'],
  ['maximumDiscount', '10.256'],
];

// Preact 的 useEffect 在本测试环境里要等约 35 毫秒之后才执行，而测试 DOM 的 focus() 记到「最近安装的文档」
// 上：上一个用例遗留的 effect 会改写下一个用例的焦点。每个用例结束时把这个窗口等过去（同 ctr-view-behavior）。
afterEach(async () => {
  vi.restoreAllMocks();
  await new Promise((resolve) => setTimeout(resolve, 60));
});

describe('sales policy console real callback contracts (U3-COM-6)', () => {
  it('creates published fixed rules with independent basis-point rounding oracle', async () => {
    const ports = portsFor(['sales-policy:manage'], {});
    const host = mount(ports);
    element(host.querySelector('[data-testid="kt-policy-create"]')).click();
    await flush();
    const drawer = element(host.querySelector('.detail-drawer'));
    const minimum = drawer
      .querySelectorAll('input')
      .find((item) => (item as TestElement).getAttribute('name') === 'minimumMargin') as
      | TestElement
      | undefined;
    expect(minimum?.value).toBe('20');
    const maximum = drawer
      .querySelectorAll('input')
      .find((item) => (item as TestElement).getAttribute('name') === 'maximumDiscount') as
      | TestElement
      | undefined;
    expect(maximum?.value).toBe('10');
    for (const [name, value] of CREATE_FORM) fillField(host, name, value);
    await flush();
    await submitDrawer(host);
    expect(ports.submit).toHaveBeenCalledExactlyOnceWith('/api/v1/sales-policies', {
      code: 'SP-NEW',
      name: '新政策',
      rules: [rules[0], rules[1]],
      publish: true,
    });
    expect(ports.refresh).toHaveBeenCalledTimes(1);
  });

  it.each([true, false])(
    'revises only latest definition version with latest-first=%s via PUT',
    async (latestFirst) => {
      const old = { ...published, id: 'policy-v1', version: 1 };
      const policies = latestFirst ? [published, old] : [old, published];
      const ports = portsFor(['sales-policy:manage'], { '/api/v1/sales-policies': policies });
      const host = mount(ports);
      const openButtons = host.querySelectorAll('[data-testid="kt-policy-open"]');
      element(openButtons[latestFirst ? 0 : 1]).click();
      await flush();
      const newVersion = host.querySelector('[data-testid="kt-policy-new-version"]');
      expect(newVersion).not.toBeNull();
      element(newVersion).click();
      await flush();
      fillField(host, 'minimumMargin', '20.55');
      fillField(host, 'maximumDiscount', '10.256');
      await flush();
      await submitDrawer(host);
      expect(ports.submit).toHaveBeenCalledExactlyOnceWith(
        '/api/v1/sales-policies/definition-1/versions',
        { rules: [rules[0], rules[1]], publish: true },
        'PUT',
      );
    },
  );

  it.each([
    [[], [published], [{ id: 'cost-1' }]],
    [['sales-policy:evaluate'], [{ ...published, status: 'DRAFT' }], [{ id: 'cost-1' }]],
    [['sales-policy:evaluate'], [published], []],
  ] as const)(
    'gates evaluations with permission/published policy/cost availability (%j)',
    (permissions, policies, costs) => {
      const host = mount(
        portsFor([...permissions], {
          '/api/v1/sales-policies': policies,
          '/api/v1/cost-evaluations': costs,
        }),
      );
      expect(host.textContent).toContain('暂无销售政策评估结果。');
      expect(host.querySelector('[data-testid="kt-policy-create"]') ?? null).toBeNull();
    },
  );

  it('evaluates pinned published policy and cost with fixed basis points and renders decisions', async () => {
    const ports = portsFor(['sales-policy:evaluate'], {
      '/api/v1/sales-policies': [{ ...published, id: 'draft-policy', status: 'DRAFT' }, published],
      '/api/v1/cost-evaluations': [{ id: 'cost-123456789', currency: 'CNY', total: '125.50' }],
      '/api/v1/sales-policy-evaluations': [
        {
          passed: true,
          approvalRequired: false,
          policyVersionId: 'policy-v2-long',
          costDecisionId: 'cost-123456789',
          reasons: ['固定理由'],
          minimumMarginBasisPoints: 2055,
          maximumDiscountBasisPoints: 1026,
          inputHash: 'hash-fixed',
        },
        { passed: false, approvalRequired: true, reasons: null },
      ],
    });
    const host = mount(ports);
    const form = element(
      host
        .querySelectorAll('form')
        .find((candidate) => (candidate as TestElement).textContent.includes('执行政策评估')),
    );
    const selects = form.querySelectorAll('select');
    const policySelect = element(selects[0]);
    policySelect.value = 'policy-v2';
    policySelect.dispatchEvent(new Event('input', { bubbles: true }));
    const costSelect = element(selects[1]);
    costSelect.value = 'cost-123456789';
    costSelect.dispatchEvent(new Event('input', { bubbles: true }));
    for (const [name, value] of [
      ['margin', '30.125'],
      ['discount', '2.255'],
    ] as const) {
      const input = form
        .querySelectorAll('input')
        .find((item) => (item as TestElement).getAttribute('name') === name) as
        | TestElement
        | undefined;
      if (!input) throw new Error(`missing field ${name}`);
      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
    await flush();
    element(form.querySelector('button[type="submit"]')).click();
    await flush();
    expect(ports.submit).toHaveBeenCalledExactlyOnceWith('/api/v1/sales-policy-evaluations', {
      policyVersionId: 'policy-v2',
      costDecisionId: 'cost-123456789',
      context: { marginBasisPoints: 3013, discountBasisPoints: 226 },
    });
    expect(host.textContent).toContain('政策通过');
    expect(host.textContent).toContain('政策未通过');
    expect(host.textContent).toContain('无需额外审批');
    expect(host.textContent).toContain('需要人工审批');
    expect(host.textContent).toContain('最低毛利率 20.55% · 最大折扣 10.26%');
    expect(host.textContent).toContain('固定理由');
    expect(host.textContent).toContain('hash-fixed');
  });

  // WFD 补齐（TD-WF-014① 在本控制台的缺口；页面级评估表单的失败呈现，原 WFB-2）。
  describe('写反馈：状态行与评估表单里的失败原因（WFD）', () => {
    const evaluateForm = (host: TestElement): TestElement =>
      element(
        host
          .querySelectorAll('form')
          .find((candidate) => (candidate as TestElement).textContent.includes('执行政策评估')),
      );
    const fillEvaluate = async (host: TestElement): Promise<TestElement> => {
      const form = evaluateForm(host);
      const selects = form.querySelectorAll('select');
      const policySelect = element(selects[0]);
      policySelect.value = 'policy-v2';
      policySelect.dispatchEvent(new Event('input', { bubbles: true }));
      const costSelect = element(selects[1]);
      costSelect.value = 'cost-123456789';
      costSelect.dispatchEvent(new Event('input', { bubbles: true }));
      await flush();
      return form;
    };
    const views = {
      '/api/v1/sales-policies': [published],
      '/api/v1/cost-evaluations': [{ id: 'cost-123456789', currency: 'CNY', total: '125.50' }],
    };

    it('发布政策（新建表单）成功：状态行在页头下方', async () => {
      const ports = portsFor(['sales-policy:manage'], {});
      const host = mount(ports);
      element(host.querySelector('[data-testid="kt-policy-create"]')).click();
      await flush();
      for (const [name, value] of CREATE_FORM) fillField(host, name, value);
      await flush();
      await submitDrawer(host);
      await flush();
      await flush();
      expect(noticeOf(host)).toEqual({ text: '已发布销售政策 SP-NEW', inDrawer: false });
    });

    it('发布新版本（抽屉里的行内表单）成功：状态行在抽屉底部；打开下一条记录时清空', async () => {
      const other: PolicyRow = {
        ...published,
        id: 'policy-x',
        definitionId: 'definition-2',
        code: 'SP-2',
      };
      const ports = portsFor(
        ['sales-policy:manage'],
        { '/api/v1/sales-policies': [published, other] },
        {
          refresh: vi.fn().mockResolvedValue({
            policies: [
              { ...published, id: 'policy-v3', version: 3 },
              { ...published, id: 'policy-v2', version: 2, status: 'RETIRED' },
              other,
            ],
            costs: [],
            evaluations: [],
          }),
        },
      );
      const host = mount(ports);
      element(host.querySelectorAll('[data-testid="kt-policy-open"]')[0]).click();
      await flush();
      element(host.querySelector('[data-testid="kt-policy-new-version"]')).click();
      await flush();
      fillField(host, 'minimumMargin', '20.55');
      fillField(host, 'maximumDiscount', '10.256');
      await flush();
      await submitDrawer(host);
      await flush();
      await flush();
      expect(noticeOf(host)).toEqual({ text: '已为销售政策 SP-1 发布新版本', inDrawer: true });
      // 抽屉仍开着，显示的是最新一版，不再提供「新建政策版本」以外的旧入口；关掉再开另一条时提示清空。
      element(host.querySelector('.detail-drawer .drawer-close')).click();
      await flush();
      element(host.querySelectorAll('[data-testid="kt-policy-open"]')[1]).click();
      await flush();
      expect(noticeOf(host).text).toBe('');
    });

    it('执行政策评估成功：状态行在页头下方', async () => {
      const ports = portsFor(['sales-policy:evaluate'], views);
      const host = mount(ports);
      const form = await fillEvaluate(host);
      element(form.querySelector('button[type="submit"]')).click();
      await flush();
      await flush();
      expect(ports.submit).toHaveBeenCalledTimes(1);
      expect(noticeOf(host)).toEqual({ text: '已完成一次政策评估', inDrawer: false });
      expect(evaluateForm(host).querySelector('[role="alert"]')?.textContent).toBe('');
    });

    it('执行政策评估失败：原因（中文）在评估表单自己的提示区，不在页面顶部与表格的错误面', async () => {
      const ports = portsFor(['sales-policy:evaluate'], views, {
        submit: vi.fn().mockRejectedValue(new Error('Internal server error')),
      });
      const host = mount(ports);
      const form = await fillEvaluate(host);
      const scroll = vi.fn();
      Object.defineProperty(form.querySelector('[role="alert"]'), 'scrollIntoView', {
        value: scroll,
        configurable: true,
      });
      element(form.querySelector('button[type="submit"]')).click();
      await flush();
      await flush();
      expect(ports.submit).toHaveBeenCalledTimes(1);
      // 此前这条错误走 loadError：显示在页面顶部的错误位与表格错误面，评估表单在页面底部，两处都看不到。
      expect(host.querySelectorAll('.console-error')).toHaveLength(0);
      expect(host.querySelectorAll('.data-table-error')).toHaveLength(0);
      expect(element(form.querySelector('[role="alert"]')).textContent).toBe(
        '服务器处理请求时出错，请稍后重试',
      );
      // 提示出现时滚进可视区（TD-WF-012）。
      expect(scroll).toHaveBeenCalled();
      expect(noticeOf(host).text).toBe('');
      // 再评估成功：提示消失，换成状态行。
      vi.mocked(ports.submit).mockResolvedValue({ passed: true });
      element(form.querySelector('button[type="submit"]')).click();
      await flush();
      await flush();
      expect(element(evaluateForm(host).querySelector('[role="alert"]')).textContent).toBe('');
      expect(noticeOf(host)).toEqual({ text: '已完成一次政策评估', inDrawer: false });
    });
  });
});
