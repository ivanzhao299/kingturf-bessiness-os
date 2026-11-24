// COM-UX 商机管道视图白盒行为测试（看板分列/列汇总/按钮与拖拽切换阶段；
// 测试 DOM=零依赖 double（test/fixtures/preact-dom.ts，与 opportunity-list 同源）。
import { describe, expect, it, vi } from 'vitest';
import { h, render } from 'preact';
import type { ComponentType } from 'preact';
import {
  installGlobalTestDom,
  TestDocument,
  TestEvent,
  type TestElement,
} from '../../../test/fixtures/preact-dom';
import { OpportunityListPage } from './opportunity-list';
import type { OpportunityListPorts } from './opportunity-list';
import { columnKeyOf, dropTarget, stageTargets, sumDecimals } from './opportunity-list-pipeline';

const flush = (): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, 0);
  });

// 焦点类断言前等待 Preact 的 after-paint 副作用（非浏览器环境下约 35–70ms 后执行）。
const settle = (): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, 120);
  });

const element = (node: unknown): TestElement => {
  if (node === null || node === undefined || (node as { nodeType?: number }).nodeType !== 1)
    throw new Error(`expected element, got ${String(node)}`);
  return node as TestElement;
};

const opportunity = (overrides: Record<string, unknown> = {}) => ({
  id: 'op-1',
  customerId: 'customer-1',
  name: '国际学校足球场',
  status: 'OPEN',
  value: { amount: '500000.000000', currency: 'CNY' },
  probabilityBasisPoints: 3000,
  expectedCloseDate: '2026-12-01',
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
  displayMoney: (currency, value) => `${String(currency)} ${String(value)}`,
  pipelineSummary: (items, today = '2026-10-08') => ({
    active: items.filter((item) => !['WON', 'LOST'].includes(item.status ?? 'OPEN')).length,
    overdue: items.filter(
      (item) =>
        Boolean(item.expectedCloseDate) &&
        !['WON', 'LOST'].includes(item.status ?? 'OPEN') &&
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

const card = (host: TestElement, id: string): TestElement =>
  element(host.querySelector(`[data-testid="kt-opportunity-card"][data-opportunity-id="${id}"]`));
const column = (host: TestElement, key: string): TestElement =>
  element(host.querySelector(`[data-testid="kt-opportunity-column"][data-stage="${key}"]`));
const moveForm = (host: TestElement): TestElement | null =>
  host.querySelector('[data-testid="kt-opportunity-move"]') as TestElement | null;

type DragEventDouble = TestEvent & {
  dataTransfer: { setData: ReturnType<typeof vi.fn>; effectAllowed: string };
};
const dragEvent = (type: string): DragEventDouble => {
  const event = new TestEvent(type) as DragEventDouble;
  event.dataTransfer = { setData: vi.fn(), effectAllowed: 'uninitialized' };
  return event;
};

const submitReason = async (host: TestElement, reason: string): Promise<void> => {
  const textarea = element(moveForm(host)?.querySelector('textarea'));
  textarea.value = reason;
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
  await flush();
  element(moveForm(host)?.querySelector('button[type="submit"]')).click();
  await flush();
};

describe('COM-UX 商机管道视图', () => {
  it('金额汇总按十进制精确求和（无浮点误差，非法金额不计入）', () => {
    expect(sumDecimals(['0.1', '0.2'])).toBe('0.3');
    expect(sumDecimals(['500000.000000', '800000.000000'])).toBe('1300000.000000');
    expect(sumDecimals(['12.5', '3'])).toBe('15.5');
    expect(sumDecimals([])).toBe('');
    expect(sumDecimals(['金额受限', '1.5'])).toBe('1.5');
  });

  it('阶段流转目标镜像域规则：只能推进到下一阶段或关闭为输单/取消，终态无目标', () => {
    expect(stageTargets('OPEN')).toEqual(['QUALIFIED', 'LOST', 'CANCELLED']);
    expect(stageTargets('PROPOSAL')).toEqual(['WON', 'LOST', 'CANCELLED']);
    expect(stageTargets('WON')).toEqual([]);
    expect(stageTargets('LOST')).toEqual([]);
    expect(stageTargets(undefined)).toEqual([]);
    expect(columnKeyOf('CANCELLED')).toBe('CLOSED');
    expect(columnKeyOf('PROPOSAL')).toBe('PROPOSAL');
    // 已关闭列的落点 = 输单（主出口）；赢单列不接受 OPEN 商机。
    expect(dropTarget('OPEN', 'CLOSED')).toBe('LOST');
    expect(dropTarget('OPEN', 'WON')).toBeNull();
    expect(dropTarget('PROPOSAL', 'WON')).toBe('WON');
  });

  it('按阶段分列渲染卡片；列头显示数量与分币种金额汇总，受限金额单独提示', () => {
    const host = mount(
      portsFor([
        opportunity(),
        opportunity({ id: 'op-2', name: '海外球场', value: { amount: '30000', currency: 'USD' } }),
        opportunity({
          id: 'op-3',
          name: '俱乐部球场',
          status: 'QUALIFIED',
          value: null,
        }),
        opportunity({ id: 'op-4', name: '学校翻新', status: 'WON' }),
        opportunity({ id: 'op-5', name: '市政项目', status: 'LOST' }),
        opportunity({ id: 'op-6', name: '幼儿园', status: 'CANCELLED' }),
      ]),
    );
    const board = element(host.querySelector('[data-testid="kt-opportunity-pipeline"]'));
    expect(board.querySelectorAll('[data-testid="kt-opportunity-column"]')).toHaveLength(5);
    expect(column(host, 'OPEN').textContent).toContain('初步接洽');
    expect(column(host, 'OPEN').getAttribute('data-count')).toBe('2');
    expect(column(host, 'OPEN').textContent).toContain('CNY 500000.000000 · USD 30000');
    expect(column(host, 'QUALIFIED').getAttribute('data-count')).toBe('1');
    expect(column(host, 'QUALIFIED').textContent).toContain('金额受限');
    expect(column(host, 'WON').getAttribute('data-count')).toBe('1');
    expect(column(host, 'CLOSED').getAttribute('data-count')).toBe('2');
    expect(card(host, 'op-5').textContent).toContain('输单');
    expect(card(host, 'op-6').textContent).toContain('已取消');
    // 卡片呈现客户、金额、赢率与预计成交。
    const first = card(host, 'op-1');
    expect(first.textContent).toContain('国际学校足球场');
    expect(first.textContent).toContain('Acme Turf');
    expect(first.textContent).toContain('CNY 500000.000000');
    expect(first.textContent).toContain('30%');
    expect(first.textContent).toContain('2026-12-01');
    // 列表视图未渲染（看板为默认视图）。
    expect(host.querySelector('.data-table table')).toBeNull();
  });

  it('看板/列表视图切换：列表保留原 DataTable 主列表（可排序表格能力不丢失）', async () => {
    const host = mount(portsFor([opportunity()]));
    element(host.querySelector('[data-testid="kt-opportunity-view-list"]')).click();
    await flush();
    expect(host.querySelector('.data-table table')).not.toBeNull();
    expect(host.querySelector('[data-testid="kt-opportunity-pipeline"]')).toBeNull();
    element(host.querySelector('[data-testid="kt-opportunity-view-pipeline"]')).click();
    await flush();
    expect(host.querySelector('[data-testid="kt-opportunity-pipeline"]')).not.toBeNull();
  });

  it('按钮切换阶段：只给出合法目标，填写依据后经原 transition 端口提交', async () => {
    const ports = portsFor([opportunity()], ['opportunity:lifecycle']);
    const host = mount(ports);
    const first = card(host, 'op-1');
    const advance = element(first.querySelector('[data-testid="kt-opportunity-advance"]'));
    expect(advance.textContent).toContain('需求确认');
    expect(first.querySelector('[data-testid="kt-opportunity-lose"]')).not.toBeNull();
    expect(first.querySelector('[data-testid="kt-opportunity-cancel"]')).not.toBeNull();
    advance.click();
    await flush();
    // 移动确认卡出现在目标列顶部。
    const form = element(moveForm(host));
    expect(column(host, 'QUALIFIED').contains(form)).toBe(true);
    expect(form.textContent).toContain('初步接洽');
    expect(form.textContent).toContain('需求确认');
    expect(ports.transitionOpportunity).not.toHaveBeenCalled();
    await submitReason(host, '客户确认需求清单');
    expect(ports.transitionOpportunity).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ id: 'op-1', status: 'OPEN' }),
      'QUALIFIED',
      '客户确认需求清单',
    );
    expect(moveForm(host)).toBeNull();
  });

  it('依据为空时不提交并就地提示；取消则清空待移动状态且不调用端口', async () => {
    const ports = portsFor([opportunity()], ['opportunity:lifecycle']);
    const host = mount(ports);
    element(card(host, 'op-1').querySelector('[data-testid="kt-opportunity-lose"]')).click();
    await flush();
    await submitReason(host, '   ');
    expect(ports.transitionOpportunity).not.toHaveBeenCalled();
    expect(element(moveForm(host)).textContent).toContain('请填写移动依据');
    element(moveForm(host)?.querySelector('[data-testid="kt-opportunity-move-cancel"]')).click();
    await flush();
    expect(moveForm(host)).toBeNull();
    expect(ports.transitionOpportunity).not.toHaveBeenCalled();
  });

  it('推进失败时保留依据表单与已输入内容，错误就地呈现（输入不丢失）', async () => {
    const ports = portsFor([opportunity()], ['opportunity:lifecycle'], {
      transitionOpportunity: vi.fn().mockRejectedValue(new Error('Opportunity version conflict')),
    });
    const host = mount(ports);
    element(card(host, 'op-1').querySelector('[data-testid="kt-opportunity-advance"]')).click();
    await flush();
    await submitReason(host, '客户确认需求清单');
    const form = element(moveForm(host));
    // TD-WF-006：接口的这条英文消息经 api-error-message 转成中文后再呈现，原文不再直接显示。
    expect(form.textContent).toContain('这条记录已在别处被修改，请刷新后重试');
    expect(form.textContent).not.toContain('Opportunity version conflict');
    expect(element(form.querySelector('textarea')).value).toBe('客户确认需求清单');
  });

  it('拖拽：仅把手可拖动；拖到合法列弹出移动确认，拖到非法列不触发', async () => {
    const ports = portsFor([opportunity()], ['opportunity:lifecycle']);
    const host = mount(ports);
    // 未按住把手：拖动被阻止（正文选区不误触发拖拽）。
    const unarmed = dragEvent('dragstart');
    card(host, 'op-1').dispatchEvent(unarmed);
    expect(unarmed.defaultPrevented).toBe(true);
    element(card(host, 'op-1').querySelector('[data-testid="kt-opportunity-grip"]')).dispatchEvent(
      new TestEvent('mousedown'),
    );
    const start = dragEvent('dragstart');
    card(host, 'op-1').dispatchEvent(start);
    expect(start.defaultPrevented).toBe(false);
    expect(start.dataTransfer.setData).toHaveBeenCalledWith('text/plain', 'op-1');
    // 非法目标（OPEN → 赢单）：不接受放置。
    const overWon = new TestEvent('dragover');
    column(host, 'WON').dispatchEvent(overWon);
    expect(overWon.defaultPrevented).toBe(false);
    const dropWon = new TestEvent('drop');
    column(host, 'WON').dispatchEvent(dropWon);
    await flush();
    expect(moveForm(host)).toBeNull();
    // 合法目标（OPEN → 需求确认）：高亮并弹出移动确认。
    const overQualified = new TestEvent('dragover');
    column(host, 'QUALIFIED').dispatchEvent(overQualified);
    expect(overQualified.defaultPrevented).toBe(true);
    await flush();
    expect(column(host, 'QUALIFIED').getAttribute('data-over')).toBe('true');
    const dropQualified = new TestEvent('drop');
    column(host, 'QUALIFIED').dispatchEvent(dropQualified);
    await flush();
    expect(moveForm(host)).not.toBeNull();
    await submitReason(host, '客户确认需求清单');
    expect(ports.transitionOpportunity).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ id: 'op-1' }),
      'QUALIFIED',
      '客户确认需求清单',
    );
  });

  it('无 lifecycle 权限：卡片无切换阶段按钮与拖拽把手，拖动被阻止（权限门保持）', () => {
    const host = mount(portsFor([opportunity()]));
    const first = card(host, 'op-1');
    expect(first.querySelector('[data-testid="kt-opportunity-advance"]')).toBeNull();
    expect(first.querySelector('[data-testid="kt-opportunity-grip"]')).toBeNull();
    const start = dragEvent('dragstart');
    first.dispatchEvent(start);
    expect(start.defaultPrevented).toBe(true);
    expect(moveForm(host)).toBeNull();
  });

  it('终态商机（赢单/输单/取消）不提供阶段切换', () => {
    const host = mount(
      portsFor(
        [
          opportunity({ id: 'won', status: 'WON' }),
          opportunity({ id: 'lost', status: 'LOST' }),
          opportunity({ id: 'cancelled', status: 'CANCELLED' }),
        ],
        ['opportunity:lifecycle'],
      ),
    );
    for (const id of ['won', 'lost', 'cancelled'])
      expect(card(host, id).querySelector('[data-testid="kt-opportunity-advance"]')).toBeNull();
  });

  it('移动成功后公告结果并把焦点移到新列中的卡片（键盘用户不丢失位置）', async () => {
    const moved = opportunity({ status: 'QUALIFIED', version: 2 });
    const ports = portsFor([opportunity()], ['opportunity:lifecycle'], {
      transitionOpportunity: vi.fn().mockResolvedValue([moved]),
    });
    const host = mount(ports);
    element(card(host, 'op-1').querySelector('[data-testid="kt-opportunity-advance"]')).click();
    await flush();
    await submitReason(host, '客户确认需求清单');
    await settle();
    expect(moveForm(host)).toBeNull();
    expect(column(host, 'QUALIFIED').getAttribute('data-count')).toBe('1');
    expect(column(host, 'OPEN').getAttribute('data-count')).toBe('0');
    const notice = element(host.querySelector('[data-testid="kt-opportunity-notice"]'));
    expect(notice.getAttribute('role')).toBe('status');
    expect(notice.textContent).toContain('国际学校足球场');
    expect(notice.textContent).toContain('需求确认');
    const active = TestDocument.current.activeElement as TestElement | null;
    expect(active?.getAttribute('data-testid')).toBe('kt-opportunity-open');
    expect(active?.textContent).toContain('国际学校足球场');
  });

  it('空看板显示带新建入口的空态（权限门保持）', () => {
    const withPermission = mount(portsFor([], ['opportunity:create']));
    expect(withPermission.textContent).toContain('暂无商机');
    expect(
      withPermission.querySelector('[data-testid="kt-opportunity-create-empty"]'),
    ).not.toBeNull();
    const without = mount(portsFor([]));
    expect(without.querySelector('[data-testid="kt-opportunity-create-empty"]')).toBeNull();
  });
});
