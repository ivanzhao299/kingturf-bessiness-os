// TD-WF-006（写流程真浏览器冒烟发现）：各控制台把接口的英文失败消息原样写进错误位。
// 这里从控制台层面证明：错误写进状态之前都经过了 shared/api-error-message——冒烟里出现的
// 几类英文消息在界面上是中文，模块认不出的仍是原文（不吞信息）。
// 三种接法各取一个控制台作代表：fail()（客户、询价）、messageOf（物料）。
import { afterEach, describe, expect, it, vi } from 'vitest';
import { h, render } from 'preact';
import type { ComponentType } from 'preact';
import { installGlobalTestDom, type TestElement } from '../../../test/fixtures/preact-dom';
import { confirmAction } from '../../../test/fixtures/confirm-dialog';
import { CustomerConsolePage } from './customer-console';
import type { CustomerConsolePorts } from './customer-ports';
import { ItemConsolePage } from './item-console';
import type { ItemConsolePorts, ItemRow } from './item-ports';
import { RfqConsolePage } from './rfq-console';
import type { RfqConsolePorts, RfqRow } from './rfq-ports';

const flush = (): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, 0);
  });

const element = (node: unknown): TestElement => {
  if (node === null || node === undefined || (node as { nodeType?: number }).nodeType !== 1)
    throw new Error(`expected element, got ${String(node)}`);
  return node as TestElement;
};

const byTestId = (host: TestElement, id: string): TestElement =>
  element(host.querySelector(`[data-testid="${id}"]`));

/** 页面上显示出来的错误文字（抽屉顶部的错误位或表单自己的提示区），与写流程冒烟的 visibleError 同口径。
 *  这个文件只管文案；错误显示在哪个位置由 console-form-error.test.tsx 守。 */
const shownError = (host: TestElement): string =>
  host
    .querySelectorAll('.console-error, .form-error, [role="alert"]')
    .map((node) => node.textContent.trim())
    .filter((text) => text !== '')
    .join(' | ');

const textValue = (value: unknown, fallback = ''): string =>
  typeof value === 'string' || typeof value === 'number' ? String(value) : fallback;

const click = async (host: TestElement, id: string): Promise<void> => {
  byTestId(host, id).click();
  await flush();
};

/** 给当前抽屉表单里的一个控件赋值并触发 input（输入框、下拉框同法）。 */
const fill = async (host: TestElement, name: string, value: string): Promise<void> => {
  const drawer = element(host.querySelector('.detail-drawer'));
  const control = drawer
    .querySelectorAll('input,textarea,select')
    .find((item) => (item as TestElement).getAttribute('name') === name);
  if (!control) throw new Error(`missing field ${name}`);
  (control as TestElement).value = value;
  (control as TestElement).dispatchEvent(new Event('input', { bubbles: true }));
  await flush();
};

const submitDrawer = async (host: TestElement): Promise<void> => {
  const drawer = element(host.querySelector('.detail-drawer'));
  element(drawer.querySelector('button[type="submit"]')).click();
  // 第一轮让端口 rejection 落进状态，第二轮让随之而来的渲染落地。
  await flush();
  await flush();
};

const customer = {
  id: 'customer-1',
  customerNumber: 'C-2026-001',
  name: '国际学校',
  status: 'PROSPECT',
  ownerId: 'employee-1',
  version: 3,
  createdAt: new Date(2026, 10, 5, 9).toISOString(),
};

const customerPorts = (overrides: Partial<CustomerConsolePorts> = {}): CustomerConsolePorts => ({
  permissions: new Set(['customer:read', 'customer:update']),
  initialCustomers: [customer],
  opportunities: [],
  textValue,
  submit: vi.fn().mockResolvedValue(null),
  createContact: vi.fn().mockResolvedValue(null),
  createActivity: vi.fn().mockResolvedValue(null),
  load360: vi.fn().mockResolvedValue({
    customer,
    contacts: [],
    activities: [],
    opportunities: [],
    ownership: [],
    leads: [],
    unavailableSections: [],
  }),
  refresh: vi.fn().mockResolvedValue([customer]),
  ...overrides,
});

const item: ItemRow = {
  id: 'item-v1',
  itemId: 'item-root',
  sku: 'FG-KT-PRO-50',
  name: '金特夫 50mm 景观草',
  itemType: 'FINISHED_GOOD',
  baseUnitCode: 'M2',
  version: 1,
  status: 'PUBLISHED',
  specification: { pileHeightMm: 50 },
  effective_at: '2026-01-01T00:00:00.000Z',
  published_at: '2026-01-02T00:00:00.000Z',
};

const itemPorts = (overrides: Partial<ItemConsolePorts> = {}): ItemConsolePorts => ({
  permissions: new Set(['manufacturing-item:read', 'manufacturing-item:manage']),
  initialItems: [item],
  recordText: (record, camel, snake, fallback = '') =>
    textValue(record[camel] ?? record[snake], fallback),
  textValue,
  businessStateLabel: (value) => String(value),
  fetchPage: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
  loadDetail: vi.fn().mockResolvedValue(null),
  submit: vi.fn().mockResolvedValue(null),
  refresh: vi.fn().mockResolvedValue([item]),
  ...overrides,
});

const issuedRfq: RfqRow = {
  id: 'rfq-2',
  rfq_number: 'RFQ-KT-YARN-2026-002',
  status: 'ISSUED',
  response_due_at: '2026-12-01T23:59:59.000Z',
  currency: 'CNY',
  lines: [],
};

const rfqPorts = (overrides: Partial<RfqConsolePorts> = {}): RfqConsolePorts => ({
  permissions: new Set(['procurement:read', 'procurement:manage']),
  initialRfqs: [issuedRfq],
  itemVersionChoices: [{ value: 'item-v1', label: 'RM-YARN · 草纱' }],
  recordText: (record, camel, snake, fallback = '') =>
    textValue(record[camel] ?? record[snake], fallback),
  textValue,
  submit: vi.fn().mockResolvedValue(null),
  loadDetail: vi.fn().mockResolvedValue(null),
  now: () => new Date('2026-11-23T10:00:00.000Z'),
  refresh: vi.fn().mockResolvedValue([issuedRfq]),
  ...overrides,
});

// .tsx 里泛型箭头函数要写成 <Ports,>（否则被当成 JSX 标签）。
const mount = <Ports,>(factory: (ports: Ports) => ComponentType, ports: Ports): TestElement => {
  const host = installGlobalTestDom().document.createElement('div');
  render(h(factory(ports), {}), host);
  return host;
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('控制台错误文案（TD-WF-006：接口英文消息写进状态之前转成中文）', () => {
  it('客户 · 添加联系人只填姓名：「Contact email or phone is required」显示为中文', async () => {
    const ports = customerPorts({
      createContact: vi.fn().mockRejectedValue(new Error('Contact email or phone is required')),
    });
    const host = mount(CustomerConsolePage, ports);
    await click(host, 'kt-customer-open');
    await click(host, 'kt-customer-add-contact');
    await fill(host, 'name', '张工');
    await fill(host, 'primary', 'false');
    await submitDrawer(host);
    expect(ports.createContact).toHaveBeenCalledTimes(1);
    expect(shownError(host)).toBe('联系人的邮箱和电话至少填一项');
    expect(host.textContent).not.toContain('Contact email or phone is required');
  });

  it('客户 · 模块认不出的接口消息仍是原文（不吞信息）', async () => {
    const ports = customerPorts({
      createContact: vi.fn().mockRejectedValue(new Error('Contact phone is malformed')),
    });
    const host = mount(CustomerConsolePage, ports);
    await click(host, 'kt-customer-open');
    await click(host, 'kt-customer-add-contact');
    await fill(host, 'name', '张工');
    await fill(host, 'primary', 'false');
    await fill(host, 'phone', 'not-a-phone');
    await submitDrawer(host);
    expect(shownError(host)).toBe('Contact phone is malformed');
  });

  it('物料 · SKU 填小写：「Code must be 1-64 …」显示为中文', async () => {
    const ports = itemPorts({
      submit: vi
        .fn()
        .mockRejectedValue(
          new Error('Code must be 1-64 uppercase letters, digits, underscore, or hyphen'),
        ),
    });
    const host = mount(ItemConsolePage, ports);
    await click(host, 'kt-item-create');
    await fill(host, 'sku', 'rm-e2e-lower');
    await fill(host, 'name', '小写 SKU 物料');
    await submitDrawer(host);
    expect(ports.submit).toHaveBeenCalledTimes(1);
    expect(shownError(host)).toBe('编码必须是 1 到 64 位大写字母、数字、下划线或连字符');
    expect(host.textContent).not.toContain('Code must be 1-64');
  });

  it('询价 · 关闭已签发询价失败（500）：「Internal server error」显示为中文', async () => {
    const ports = rfqPorts({
      submit: vi.fn().mockRejectedValue(new Error('Internal server error')),
    });
    const host = mount(RfqConsolePage, ports);
    await click(host, 'kt-rfq-open');
    await click(host, 'kt-rfq-close');
    // TD-WF-014②：关闭询价先出确认框（破坏性动作：初焦在「取消」上），确认后才发请求。
    expect(ports.submit).not.toHaveBeenCalled();
    await confirmAction(host, '关闭询价', '确认关闭', { destructive: true });
    await flush();
    expect(ports.submit).toHaveBeenCalledTimes(1);
    expect(shownError(host)).toBe('服务器处理请求时出错，请稍后重试');
    expect(host.textContent).not.toContain('Internal server error');
  });
});
