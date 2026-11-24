// COM-UX 信用审查审批流程图白盒行为测试（页面级流程统计/筛选联动 + 抽屉逐步骤；
// 测试 DOM=零依赖 double（test/fixtures/preact-dom.ts，与 credit-console 同源）。
import { describe, expect, it, vi } from 'vitest';
import { h, render } from 'preact';
import type { ComponentType } from 'preact';
import { installGlobalTestDom, type TestElement } from '../../../test/fixtures/preact-dom';
import { CreditConsolePage } from './credit-console';
import type { CreditConsolePorts, CreditRow } from './credit-ports';
import { creditUtilization, decisionSteps } from './credit-console-flow';

const flush = (): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, 0);
  });

const element = (node: unknown): TestElement => {
  if (node === null || node === undefined || (node as { nodeType?: number }).nodeType !== 1)
    throw new Error(`expected element, got ${String(node)}`);
  return node as TestElement;
};

const decision = (overrides: Record<string, unknown> = {}): CreditRow => ({
  id: 'decision-1',
  customer_id: 'customer-1',
  quote_revision_id: 'quote-rev-1',
  effective_status: 'PENDING_APPROVAL',
  requested_amount: '950000.000000',
  currency: 'CNY',
  exposure_amount: '900000.000000',
  credit_limit: '5000000.000000',
  approval_required: true,
  valid_until: '2099-03-31T23:59:59.000Z',
  created_at: '2026-11-18T08:47:04.000Z',
  decided_at: null,
  exposure_snapshot_id: 'exposure-1',
  ...overrides,
});

const approved = decision({
  id: 'decision-approved',
  effective_status: 'APPROVED',
  decided_at: '2026-11-19T01:00:00.000Z',
});
const rejected = decision({
  id: 'decision-rejected',
  effective_status: 'REJECTED',
  decided_at: '2026-11-19T02:00:00.000Z',
});
const expired = decision({
  id: 'decision-expired',
  effective_status: 'EXPIRED',
  valid_until: '2000-01-01T00:00:00.000Z',
});
const pending = decision({ id: 'decision-pending' });

const limits: readonly CreditRow[] = [
  {
    id: 'limit-1',
    customer_id: 'customer-1',
    currency: 'CNY',
    amount: '5000000',
    expires_at: '2099-03-31',
  },
];

const recordText = (record: unknown, camel: string, snake: string, fallback = ''): string => {
  const value =
    (record as Record<string, unknown> | null)?.[camel] ??
    (record as Record<string, unknown> | null)?.[snake];
  return typeof value === 'string' || typeof value === 'number' ? String(value) : fallback;
};

const portsFor = (
  decisions: readonly CreditRow[],
  extraPermissions: readonly string[] = [],
  overrides: Partial<CreditConsolePorts> = {},
): CreditConsolePorts => ({
  permissions: new Set(['credit:read', ...extraPermissions]),
  initialLimits: limits,
  initialDecisions: decisions,
  issuedQuotes: [],
  customers: [{ id: 'customer-1', name: 'Acme Turf' }],
  textValue: (value, fallback = '') =>
    typeof value === 'string' || typeof value === 'number' ? String(value) : fallback,
  recordText,
  displayMoney: (currency, value) => `${String(currency)} ${String(value)}`,
  currencyLabel: (value) => String(value),
  submit: vi.fn().mockResolvedValue({}),
  refresh: vi.fn().mockResolvedValue({ limits, decisions }),
  ...overrides,
});

const mount = (ports: CreditConsolePorts): TestElement => {
  const host = installGlobalTestDom().document.createElement('div');
  render(h(CreditConsolePage(ports) as ComponentType, {}), host);
  return host;
};

const flowNode = (host: TestElement, key: string): TestElement =>
  element(host.querySelector(`[data-testid="kt-credit-flow-${key}"]`));
const rows = (host: TestElement): readonly TestElement[] =>
  host.querySelectorAll('.data-table tbody tr') as TestElement[];
const openRow = async (host: TestElement, index: number): Promise<void> => {
  (host.querySelectorAll('[data-testid="kt-credit-open"]') as TestElement[])[index]?.click();
  await flush();
};

describe('COM-UX 信用审批流程图', () => {
  it('流程图按阶段统计数量；点选审批环节或结论节点即应用对应状态筛选（与筛选条联动）', async () => {
    const host = mount(portsFor([approved, rejected, expired, pending]));
    const flow = element(host.querySelector('[data-testid="kt-credit-flow"]'));
    for (const label of ['发起评估', '信用评估', '信用审批', '批准', '拒绝', '过期'])
      expect(flow.textContent).toContain(label);
    expect(flowNode(host, 'submit').getAttribute('data-count')).toBe('4');
    expect(flowNode(host, 'review').getAttribute('data-count')).toBe('1');
    expect(flowNode(host, 'approved').getAttribute('data-count')).toBe('1');
    expect(flowNode(host, 'rejected').getAttribute('data-count')).toBe('1');
    expect(flowNode(host, 'expired').getAttribute('data-count')).toBe('1');
    expect(flow.textContent).toContain('需人工审批 4 笔');
    expect(rows(host)).toHaveLength(4);
    flowNode(host, 'approved').click();
    await flush();
    expect(rows(host)).toHaveLength(1);
    expect(rows(host)[0]?.textContent).toContain('信用已批准');
    expect(flowNode(host, 'approved').getAttribute('aria-pressed')).toBe('true');
    // 发起/评估是说明环节（不可点选），只有审批环节与结论节点是筛选按钮。
    expect(flowNode(host, 'submit').tagName).toBe('div');
    expect(flowNode(host, 'review').tagName).toBe('button');
    expect(flowNode(host, 'approved').tagName).toBe('button');
    flowNode(host, 'review').click();
    await flush();
    expect(rows(host)[0]?.textContent).toContain('等待信用审批');
    element(host.querySelector('[data-testid="kt-credit-filter-all"]')).click();
    await flush();
    expect(rows(host)).toHaveLength(4);
    expect(flowNode(host, 'review').getAttribute('aria-pressed')).toBe('false');
  });

  it('待审批决定：提交/评估环节已完成并带时间戳，审批为当前环节且就地提供批准/拒绝', async () => {
    const host = mount(portsFor([pending], ['credit:approve']));
    await openRow(host, 0);
    const steps = element(host.querySelector('[data-testid="kt-credit-flow-detail"]'));
    expect(steps.textContent).toContain('提交于 2026-11-18');
    expect(steps.textContent).toContain('信用评估');
    expect(steps.textContent).toContain('等待审批');
    expect(steps.textContent).toContain('2099-03-31');
    expect(element(steps.querySelector('[data-step="review"]')).getAttribute('data-state')).toBe(
      'current',
    );
    expect(element(steps.querySelector('[data-step="submit"]')).getAttribute('data-state')).toBe(
      'done',
    );
    const actions = element(steps.querySelector('[data-testid="kt-credit-actions"]'));
    expect(actions.querySelector('[data-testid="kt-credit-approve"]')).not.toBeNull();
    expect(actions.querySelector('[data-testid="kt-credit-reject"]')).not.toBeNull();
  });

  it('已批准/已拒绝/已过期决定显示审批结论与时间', () => {
    const ports = portsFor([approved]);
    expect(decisionSteps(approved, ports)[2]?.detail).toBe('已批准 · 2026-11-19');
    expect(decisionSteps(rejected, ports)[2]?.detail).toBe('已拒绝 · 2026-11-19');
    expect(decisionSteps(expired, ports)[2]?.detail).toBe('已过期 · 有效期至 2000-01-01');
    expect(decisionSteps(pending, ports)[2]?.state).toBe('current');
    expect(decisionSteps(approved, ports)[2]?.state).toBe('done');
  });

  it('额度占用率 = 敞口 / 额度；超出额度如实标注（不引入政策阈值）', () => {
    const ports = portsFor([]);
    expect(creditUtilization(pending, ports)).toEqual({
      exposure: 900000,
      limit: 5000000,
      ratio: 18,
      overLimit: false,
    });
    expect(
      creditUtilization(decision({ exposure_amount: '6000000', credit_limit: '5000000' }), ports)
        .overLimit,
    ).toBe(true);
    expect(creditUtilization(decision({ credit_limit: '0' }), ports).ratio).toBeNull();
  });

  it('无 approve 权限时待审批环节不出现审批按钮（权限门保持）', async () => {
    const host = mount(portsFor([pending]));
    await openRow(host, 0);
    expect(host.querySelector('[data-testid="kt-credit-approve"]')).toBeNull();
    expect(host.querySelector('[data-testid="kt-credit-reject"]')).toBeNull();
    expect(host.textContent).toContain('等待审批');
  });

  it('批准流：在审批环节选择批准并填写理由后经 PUT state 提交并刷新', async () => {
    const ports = portsFor([pending], ['credit:approve']);
    const host = mount(ports);
    await openRow(host, 0);
    element(host.querySelector('[data-testid="kt-credit-approve"]')).click();
    await flush();
    const form = element(host.querySelector('.form-section'));
    const textarea = element(form.querySelector('textarea'));
    textarea.value = '额度充足，予以批准';
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    await flush();
    element(form.querySelector('button[type="submit"]')).click();
    await flush();
    expect(ports.submit).toHaveBeenCalledExactlyOnceWith(
      '/api/v1/credit-decisions/decision-pending/state',
      { decision: 'APPROVED', reason: '额度充足，予以批准' },
      'PUT',
    );
    expect(ports.refresh).toHaveBeenCalled();
  });

  // 回归（TD-WF-001，写流程真浏览器冒烟发现）：评估表单要求已签发报价行带 customerId，而报价列表
  // 投影此前不带客户字段——「执行信用评估」拿不到客户，请求发不出去，错误只写进不渲染的位置。
  // 服务端已在报价行补上 customerId；这里钉住控制台一侧：取到客户并以正确的载荷提交。
  it('发起评估流：选已签发报价、额度与有效期后经 POST credit-decisions 提交，载荷带报价所属客户', async () => {
    const submit = vi.fn().mockResolvedValue({});
    const ports = portsFor([], ['credit:evaluate'], {
      issuedQuotes: [
        {
          id: 'quote-rev-issued',
          quoteNumber: 'Q-2026-007',
          revision: 3,
          status: 'ISSUED',
          currency: 'CNY',
          total: '950000',
          customerId: 'customer-1',
          issuedSnapshotId: 'snapshot-1',
        },
      ],
      submit,
    });
    const host = mount(ports);
    element(host.querySelector('[data-testid="kt-credit-evaluate"]')).click();
    await flush();
    const form = element(host.querySelector('.form-section'));
    // 测试 DOM 没有 select 的选项联动（与其它控制台测试同法）：直接赋值并派发 input 事件。
    // 选项本身在渲染时由已签发报价与额度生成，这里顺带钉住两者各给出一项。
    // 两个下拉各由一条已签发报价与一条额度生成选项。
    const options = form.querySelectorAll('option') as TestElement[];
    expect(options).toHaveLength(2);
    const selects = form.querySelectorAll('select') as TestElement[];
    expect(selects.map((item) => item.getAttribute('name'))).toEqual([
      'quoteRevisionId',
      'creditLimitId',
    ]);
    const pick = (select: TestElement | undefined, value: string): void => {
      if (!select) throw new Error(`select for ${value} not found`);
      select.value = value;
      select.dispatchEvent(new Event('input', { bubbles: true }));
    };
    pick(selects[0], 'quote-rev-issued');
    pick(selects[1], 'limit-1');
    const date = element(form.querySelector('input[type="date"]'));
    date.value = '2027-03-31';
    date.dispatchEvent(new Event('input', { bubbles: true }));
    await flush();
    element(form.querySelector('button[type="submit"]')).click();
    await flush();
    expect(submit).toHaveBeenCalledExactlyOnceWith('/api/v1/credit-decisions', {
      customerId: 'customer-1',
      quoteRevisionId: 'quote-rev-issued',
      quoteSnapshotId: 'snapshot-1',
      creditLimitId: 'limit-1',
      validUntil: '2027-03-31T23:59:59.000Z',
    });
    expect(ports.refresh).toHaveBeenCalled();
    expect(host.textContent).not.toContain('报价未关联有效客户');
  });
});
