// U3-CRM-2 客户控制台白盒行为测试（Preact 分域重写后的行为面；
// 测试 DOM=零依赖 double（test/fixtures/preact-dom.ts，与其它域控制台同源）。
import { afterEach, describe, expect, it, vi } from 'vitest';
import { h, render } from 'preact';
import type { ComponentType } from 'preact';
import { installGlobalTestDom, type TestElement } from '../../../test/fixtures/preact-dom';
import { CustomerConsolePage } from './customer-console';
import type { CustomerConsolePorts, CustomerRow } from './customer-ports';

const flush = (): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, 0);
  });

const element = (node: unknown): TestElement => {
  if (node === null || node === undefined || (node as { nodeType?: number }).nodeType !== 1)
    throw new Error(`expected element, got ${String(node)}`);
  return node as TestElement;
};

const customer: CustomerRow = {
  id: 'customer-1',
  customerNumber: 'C-2026-001',
  name: '国际学校',
  status: 'PROSPECT',
  ownerId: 'employee-1',
  version: 3,
};

const view360 = {
  customer: { id: 'customer-1', customerNumber: 'C-2026-001', status: 'PROSPECT' },
  contacts: [
    {
      id: 'contact-1',
      name: 'Buyer Zhang',
      title: '采购经理',
      email: 'buyer@example.test',
      phone: '138',
    },
  ],
  activities: [
    {
      id: 'activity-1',
      activityType: '拜访',
      subject: '需求沟通',
      occurredAt: '2026-11-20T08:00:00Z',
    },
  ],
  opportunities: [
    { id: 'op-1', name: '球场项目', status: 'OPEN', value: { amount: '500000', currency: 'CNY' } },
  ],
  ownership: [],
  leads: [],
  unavailableSections: [],
};

const portsFor = (
  extraPermissions: readonly string[] = [],
  overrides: Partial<CustomerConsolePorts> = {},
): CustomerConsolePorts => ({
  permissions: new Set(['customer:read', ...extraPermissions]),
  initialCustomers: [customer],
  opportunities: [],
  textValue: (value, fallback = '') =>
    typeof value === 'string' || typeof value === 'number' ? String(value) : fallback,
  submit: vi.fn().mockResolvedValue(null),
  load360: vi.fn().mockResolvedValue(view360),
  refresh: vi.fn().mockResolvedValue([customer]),
  ...overrides,
});

const mount = (ports: CustomerConsolePorts): TestElement => {
  const host = installGlobalTestDom().document.createElement('div');
  render(h(CustomerConsolePage(ports) as ComponentType, {}), host);
  return host;
};

const fillField = (host: TestElement, name: string, value: string): void => {
  const drawer = element(host.querySelector('.detail-drawer'));
  const input = drawer
    .querySelectorAll('input')
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
  ['name', '国际学校'],
  ['customerNumber', 'C-2026-002'],
  ['tags', '教育,优先'],
];

afterEach(() => {
  vi.restoreAllMocks();
});

describe('U3-CRM-2 客户控制台', () => {
  it('渲染页头与主列表（编号/名称/状态/负责人）', () => {
    const host = mount(portsFor());
    expect(host.textContent).toContain('客户管理');
    expect(host.textContent).toContain('国际学校');
    expect(host.textContent).toContain('潜在客户');
    expect(host.querySelector('.data-table table')).not.toBeNull();
  });

  it('打开详情即异步拉取客户 360（联系人/活动/商机关联）', async () => {
    const ports = portsFor();
    const host = mount(ports);
    element(host.querySelector('[data-testid="kt-customer-open"]')).click();
    await flush();
    expect(ports.load360).toHaveBeenCalledTimes(1);
    const detail = element(host.querySelector('[data-testid="kt-customer-360"]'));
    expect(detail.textContent).toContain('Buyer Zhang');
    expect(detail.textContent).toContain('需求沟通');
    expect(detail.textContent).toContain('球场项目');
  });

  it('状态筛选与名称检索为客户端过滤', async () => {
    const leads = [
      customer,
      { ...customer, id: 'customer-2', customerNumber: 'C-2', name: '体育馆', status: 'ACTIVE' },
    ];
    const host = mount(portsFor([], { initialCustomers: leads }));
    element(host.querySelector('[data-testid="kt-customer-filter-active"]')).click();
    await flush();
    expect(host.textContent).toContain('体育馆');
    element(host.querySelector('[data-testid="kt-customer-filter-all"]')).click();
    await flush();
    const search = element(host.querySelector('[data-testid="kt-customer-search"]'));
    search.value = '体育馆';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    await flush();
    expect(host.textContent).toContain('体育馆');
  });

  it('创建客户走 legacy POST（tags 逗号切分为字符串数组）', async () => {
    const ports = portsFor(['customer:create']);
    const host = mount(ports);
    element(host.querySelector('[data-testid="kt-customer-create"]')).click();
    await flush();
    for (const [name, value] of CREATE_FORM) fillField(host, name, value);
    await flush();
    await submitDrawer(host);
    expect(ports.submit).toHaveBeenCalledExactlyOnceWith('/api/v1/customers', {
      name: '国际学校',
      customerNumber: 'C-2026-002',
      tags: ['教育', '优先'],
    });
    expect(ports.refresh).toHaveBeenCalledTimes(1);
  });

  it('无 customer:create 权限不出现新建入口；刷新失败错误面呈现', async () => {
    const host = mount(
      portsFor([], {
        refresh: vi.fn().mockRejectedValue(new Error('客户加载失败')),
      }),
    );
    expect(host.querySelector('[data-testid="kt-customer-create"]')).toBeNull();
    element(host.querySelector('[data-testid="kt-customer-refresh"]')).click();
    await flush();
    expect(host.querySelector('.data-table-error')).not.toBeNull();
    expect(host.textContent).toContain('客户加载失败');
  });
});
