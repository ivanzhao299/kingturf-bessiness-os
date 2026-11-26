// U3-COM-1 商机列表控制台白盒行为测试（Preact 分域重写后的行为面；
// 测试 DOM=零依赖 double（test/fixtures/preact-dom.ts，与 governance console 同源））。
// COM-UX 行为重写注记：默认视图改为管道看板（看板行为见 opportunity-list-pipeline.test），
// 本文件覆盖既有能力面守恒（新建/抽屉推进/权限门/刷新）与列表视图保留。
import { describe, expect, it, vi } from 'vitest';
import { h, render } from 'preact';
import type { ComponentType } from 'preact';
import { installGlobalTestDom, type TestElement } from '../../../test/fixtures/preact-dom';
import { OpportunityListPage } from './opportunity-list';
import type { OpportunityListPorts } from './opportunity-list';
import { isOpportunityOverdue } from './opportunity-list-pipeline';

const flush = (): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, 0);
  });

const element = (node: unknown): TestElement => {
  if (node === null || node === undefined || (node as { nodeType?: number }).nodeType !== 1)
    throw new Error(`expected element, got ${String(node)}`);
  return node as TestElement;
};

const opportunity = (overrides: Record<string, unknown> = {}) => ({
  id: 'op-1',
  name: '国际学校足球场',
  status: 'OPEN',
  value: { amount: '500000.000000', currency: 'CNY' },
  probabilityBasisPoints: 3000,
  expectedCloseDate: '2026-10-01',
  version: 1,
  ...overrides,
});

type PortsOverrides = Partial<OpportunityListPorts>;

const portsFor = (
  opportunities: readonly Record<string, unknown>[],
  extraPermissions: readonly string[] = [],
  overrides: PortsOverrides = {},
): OpportunityListPorts => ({
  permissions: new Set(['opportunity:read', ...extraPermissions]),
  initialOpportunities: opportunities as never,
  customers: [{ id: 'customer-1', name: 'Acme Turf' }],
  today: '2026-10-08',
  displayMoney: (_currency, value) => `¥${String(value)}`,
  pipelineSummary: (items, today = '2026-10-08') => ({
    active: items.filter((item) => !['WON', 'LOST'].includes(item.status ?? 'OPEN')).length,
    overdue: items.filter(
      (item) =>
        Boolean(item.expectedCloseDate) &&
        // TD-COMX-003：与 readiness.opportunityPipelineSummary 同口径，已取消不算逾期。
        !['WON', 'LOST', 'CANCELLED'].includes(item.status ?? 'OPEN') &&
        String(item.expectedCloseDate).slice(0, 10) < today,
    ).length,
    closingSoon: 0,
    customerMissing: items.filter((item) => !item.customerId).length,
  }),
  createOpportunity: vi.fn().mockResolvedValue([]),
  transitionOpportunity: vi.fn().mockResolvedValue([]),
  refresh: vi.fn().mockResolvedValue([]),
  ...overrides,
});

const mount = (ports: OpportunityListPorts): TestElement => {
  const host = installGlobalTestDom().document.createElement('div');
  render(h(OpportunityListPage(ports) as ComponentType, {}), host);
  return host;
};

describe('U3-COM-1 商机列表控制台', () => {
  it('渲染页头标题；列表视图保留主列表（阶段/金额/赢率/预计成交）', async () => {
    const host = mount(portsFor([opportunity()]));
    expect(host.textContent).toContain('商机阶段看板');
    // COM-UX：默认管道视图承载同一批字段（阶段/金额/赢率/预计成交）。
    expect(host.textContent).toContain('国际学校足球场');
    expect(host.textContent).toContain('初步接洽');
    expect(host.textContent).toContain('¥500000.000000');
    expect(host.textContent).toContain('30%');
    expect(host.querySelector('[data-testid="kt-opportunity-pipeline"]')).not.toBeNull();
    element(host.querySelector('[data-testid="kt-opportunity-view-list"]')).click();
    await flush();
    expect(host.querySelector('.data-table table')).not.toBeNull();
    expect(host.textContent).toContain('商机主列表');
  });

  it('概要度量与逾期标记按端口注入的「今天」口径渲染', () => {
    const host = mount(portsFor([opportunity()]));
    const summary = element(host.querySelector('[data-testid="kt-opportunity-summary"]'));
    expect(summary.textContent).toContain('在途商机');
    expect(summary.textContent).toContain('已逾期');
    expect(host.querySelector('[data-overdue="true"]')).not.toBeNull();
    expect(host.textContent).toContain('成交日期已逾期');
    const today = new Date().toISOString().slice(0, 10);
    expect(isOpportunityOverdue(opportunity({ expectedCloseDate: '1999-01-01' }), today)).toBe(
      true,
    );
    expect(
      isOpportunityOverdue(opportunity({ status: 'WON', expectedCloseDate: '1999-01-01' }), today),
    ).toBe(false);
    expect(isOpportunityOverdue(opportunity({ expectedCloseDate: undefined }), today)).toBe(false);
    // TD-COMX-003：已取消的商机不算逾期（2026-11-26 项目所有者裁定，行为变更）。
    expect(
      isOpportunityOverdue(
        opportunity({ status: 'CANCELLED', expectedCloseDate: '1999-01-01' }),
        today,
      ),
    ).toBe(false);
  });

  it('无 create 权限时不出现新建入口（权限门保持）', () => {
    const host = mount(portsFor([opportunity()]));
    expect(host.querySelector('[data-testid="kt-opportunity-create"]')).toBeNull();
  });

  it('create 流：新建抽屉提交载荷与原表单逐字段同构（% → 基点、none → null）', async () => {
    const ports = portsFor([opportunity()], ['opportunity:create']);
    const host = mount(ports);
    element(host.querySelector('[data-testid="kt-opportunity-create"]')).click();
    await flush();
    const drawer = element(host.querySelector('.detail-drawer'));
    expect(drawer.textContent).toContain('新建商机');
    const selects = drawer.querySelectorAll('select') as TestElement[];
    const customerSelect = element(
      selects.find((item) => item.getAttribute('name') === 'customerId'),
    );
    customerSelect.value = 'none';
    customerSelect.dispatchEvent(new Event('input', { bubbles: true }));
    const currencySelect = element(
      selects.find((item) => item.getAttribute('name') === 'currency'),
    );
    currencySelect.value = 'CNY';
    currencySelect.dispatchEvent(new Event('input', { bubbles: true }));
    const inputs = drawer.querySelectorAll('input') as TestElement[];
    const nameInput = element(inputs.find((item) => item.getAttribute('name') === 'name'));
    nameInput.value = '俱乐部球场';
    nameInput.dispatchEvent(new Event('input', { bubbles: true }));
    const valueInput = element(inputs.find((item) => item.getAttribute('name') === 'value'));
    valueInput.value = '800000';
    valueInput.dispatchEvent(new Event('input', { bubbles: true }));
    const probabilityInput = element(
      inputs.find((item) => item.getAttribute('name') === 'probability'),
    );
    probabilityInput.value = '40';
    probabilityInput.dispatchEvent(new Event('input', { bubbles: true }));
    const dateInput = element(
      inputs.find((item) => item.getAttribute('name') === 'expectedCloseDate'),
    );
    dateInput.value = '2026-11-30';
    dateInput.dispatchEvent(new Event('input', { bubbles: true }));
    await flush();
    element(drawer.querySelector('button[type="submit"]')).click();
    await flush();
    expect(ports.createOpportunity).toHaveBeenCalledExactlyOnceWith({
      customerId: null,
      leadId: null,
      name: '俱乐部球场',
      value: '800000',
      currency: 'CNY',
      probabilityBasisPoints: 4000,
      expectedCloseDate: '2026-11-30',
    });
    expect(host.querySelector('.detail-drawer')).toBeNull();
    expect(host.querySelector('[data-testid="console-notice"]')?.textContent).toBe(
      '已创建商机「俱乐部球场」',
    );
  });

  it('lifecycle 流：查看→推进→提交即 transition（2 步度量，原推进语义保持）', async () => {
    const ports = portsFor([opportunity()], ['opportunity:lifecycle']);
    const host = mount(ports);
    element(host.querySelector('[data-testid="kt-opportunity-open"]')).click();
    await flush();
    const detail = element(host.querySelector('[data-testid="kt-opportunity-detail"]'));
    expect(detail.textContent).toContain('初步接洽');
    const form = element(host.querySelector('[data-testid="kt-opportunity-transition"]'));
    expect(form.textContent).toContain('需求确认');
    const textarea = element(form.querySelector('textarea'));
    textarea.value = '客户确认需求清单';
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    await flush();
    element(form.querySelector('button[type="submit"]')).click();
    await flush();
    expect(ports.transitionOpportunity).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ id: 'op-1', status: 'OPEN' }),
      'QUALIFIED',
      '客户确认需求清单',
    );
  });

  it('推进被拒绝时在触发表单显示中文原因，保留依据和看板', async () => {
    const ports = portsFor([opportunity()], ['opportunity:lifecycle'], {
      transitionOpportunity: vi.fn().mockRejectedValue(new Error('Opportunity version conflict')),
    });
    const host = mount(ports);
    element(host.querySelector('[data-testid="kt-opportunity-open"]')).click();
    await flush();
    const form = element(host.querySelector('[data-testid="kt-opportunity-transition"]'));
    const textarea = element(form.querySelector('textarea'));
    textarea.value = '客户确认需求清单';
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    await flush();
    element(form.querySelector('button[type="submit"]')).click();
    await flush();
    expect(form.querySelector('[role="alert"]')?.textContent).toBe(
      '这条记录已在别处被修改，请刷新后重试',
    );
    expect(textarea.value).toBe('客户确认需求清单');
    expect(host.querySelector('[data-testid="kt-opportunity-pipeline"]')).not.toBeNull();
    expect(host.querySelector('[data-testid="console-notice"]')?.textContent).toBe('');
  });

  it('无 lifecycle 权限时抽屉不出现推进表单（空态替代）', async () => {
    const host = mount(portsFor([opportunity()]));
    element(host.querySelector('[data-testid="kt-opportunity-open"]')).click();
    await flush();
    expect(host.querySelector('[data-testid="kt-opportunity-transition"]')).toBeNull();
    expect(host.textContent).toContain('暂无可用操作');
  });

  it('刷新动作走端口 refresh，失败时错误就地呈现（看板为 alert，列表为 DataTable error 面）', async () => {
    const ports = portsFor([], [], {
      refresh: vi.fn().mockRejectedValue(new Error('商机列表加载失败')),
    });
    const host = mount(ports);
    element(host.querySelector('[data-testid="kt-opportunity-refresh"]')).click();
    await flush();
    expect(ports.refresh).toHaveBeenCalledTimes(1);
    expect(host.querySelector('[role="alert"][data-testid="kt-opportunity-error"]')).not.toBeNull();
    expect(host.textContent).toContain('商机列表加载失败');
    element(host.querySelector('[data-testid="kt-opportunity-view-list"]')).click();
    await flush();
    expect(host.querySelector('.data-table-error')).not.toBeNull();
    expect(host.textContent).toContain('商机列表加载失败');
  });
});
