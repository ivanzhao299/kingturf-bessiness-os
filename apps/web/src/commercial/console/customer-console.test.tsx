// U3-CRM-2 客户控制台白盒行为测试（Preact 分域重写后的行为面；
// 测试 DOM=零依赖 double（test/fixtures/preact-dom.ts，与其它域控制台同源）。
// CRM-UX 追加：统计卡、时间线分组/图标/内联链接、联系人卡与遮蔽开关、商机漏斗、
// 关联线索、信用概要（可选端口）。既有写路径载荷与权限门断言原样保留。
import { afterEach, describe, expect, it, vi } from 'vitest';
import { h, render } from 'preact';
import type { ComponentType } from 'preact';
import { installGlobalTestDom, type TestElement } from '../../../test/fixtures/preact-dom';
import { CustomerConsolePage } from './customer-console';
import type { CustomerConsolePorts, CustomerRow } from './customer-ports';
import type { CustomerCreditSummary } from '../../crm/crm-ux';

const flush = (): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, 0);
  });

const element = (node: unknown): TestElement => {
  if (node === null || node === undefined || (node as { nodeType?: number }).nodeType !== 1)
    throw new Error(`expected element, got ${String(node)}`);
  return node as TestElement;
};

// 本地时间构造（期望值与机器时区无关）；基准：本地 2026-11-23 10:00。
const NOW = new Date(2026, 10, 23, 10, 0).getTime();
const local = (day: number, hour: number, minute = 0): string =>
  new Date(2026, 10, day, hour, minute).toISOString();

const customer: CustomerRow = {
  id: 'customer-1',
  customerNumber: 'C-2026-001',
  name: '国际学校',
  status: 'PROSPECT',
  ownerId: 'employee-1',
  version: 3,
  createdAt: local(5, 9),
};

const contact = {
  id: 'contact-1',
  name: 'Buyer Zhang',
  title: '采购经理',
  email: 'buyer@example.test',
  phone: '13812345678',
};

const view360 = {
  customer: { id: 'customer-1', customerNumber: 'C-2026-001', status: 'PROSPECT' },
  contacts: [contact],
  activities: [{ id: 'activity-1', type: 'NOTE', summary: '需求沟通', occurredAt: local(22, 16) }],
  opportunities: [
    {
      id: 'op-1',
      name: '球场项目',
      status: 'OPEN',
      value: { amount: '500000', currency: 'CNY' },
    },
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
  createContact: vi.fn().mockResolvedValue(null),
  createActivity: vi.fn().mockResolvedValue(null),
  load360: vi.fn().mockResolvedValue(view360),
  refresh: vi.fn().mockResolvedValue([customer]),
  now: () => NOW,
  ...overrides,
});

const mount = (ports: CustomerConsolePorts): TestElement => {
  const host = installGlobalTestDom().document.createElement('div');
  render(h(CustomerConsolePage(ports) as ComponentType, {}), host);
  return host;
};

const openFirst = async (host: TestElement): Promise<void> => {
  element(host.querySelector('[data-testid="kt-customer-open"]')).click();
  await flush();
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

const fillSelect = (host: TestElement, name: string, value: string): void => {
  const drawer = element(host.querySelector('.detail-drawer'));
  const select = drawer
    .querySelectorAll('select')
    .find((item) => (item as TestElement).getAttribute('name') === name) as TestElement | undefined;
  if (!select) throw new Error(`missing select ${name}`);
  select.value = value;
  select.dispatchEvent(new Event('input', { bubbles: true }));
};

const submitDrawer = async (host: TestElement): Promise<void> => {
  element(
    element(host.querySelector('.detail-drawer')).querySelector('button[type="submit"]'),
  ).click();
  await flush();
};

const meterLevel = (host: TestElement): string =>
  (host.querySelector('.crm-meter') as TestElement | null)?.getAttribute('data-level') ?? '';

const section = (host: TestElement, testId: string): TestElement =>
  element(host.querySelector(`[data-testid="${testId}"]`));

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
    await openFirst(host);
    expect(ports.load360).toHaveBeenCalledTimes(1);
    const detail = section(host, 'kt-customer-360');
    expect(detail.textContent).toContain('Buyer Zhang');
    expect(detail.textContent).toContain('需求沟通');
    expect(detail.textContent).toContain('球场项目');
  });

  it('状态筛选与名称检索为客户端过滤', async () => {
    const rows = [
      customer,
      { ...customer, id: 'customer-2', customerNumber: 'C-2', name: '体育馆', status: 'ACTIVE' },
    ];
    const host = mount(portsFor([], { initialCustomers: rows }));
    element(host.querySelector('[data-testid="kt-customer-filter-active"]')).click();
    await flush();
    expect(host.textContent).toContain('体育馆');
    element(host.querySelector('[data-testid="kt-customer-filter-active"]')); // 已选筛选带按下态
    expect(
      element(host.querySelector('[data-testid="kt-customer-filter-active"]')).getAttribute(
        'aria-pressed',
      ),
    ).toBe('true');
    element(host.querySelector('[data-testid="kt-customer-filter-all"]')).click();
    await flush();
    const search = element(host.querySelector('[data-testid="kt-customer-search"]'));
    search.value = '体育馆';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    await flush();
    expect(host.textContent).toContain('体育馆');
  });

  it('筛选无结果时给出「没有匹配」而非「暂无客户」', async () => {
    const host = mount(portsFor());
    const search = element(host.querySelector('[data-testid="kt-customer-search"]'));
    search.value = '不存在的客户';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    await flush();
    expect(host.textContent).toContain('没有匹配的客户');
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

describe('U3-CRM-4 活动时间线增强', () => {
  it('创建入口经权限门呈现；提交走桥轨端口（五字段载荷）并刷新 360、收起表单', async () => {
    const ports = portsFor(['customer-activity:create']);
    const host = mount(ports);
    expect(host.querySelector('[data-testid="kt-customer-add-activity"]')).toBeNull();
    await openFirst(host);
    element(host.querySelector('[data-testid="kt-customer-add-activity"]')).click();
    await flush();
    fillSelect(host, 'activityType', '拜访');
    fillField(host, 'summary', '周例会跟进');
    await flush();
    await submitDrawer(host);
    expect(ports.createActivity).toHaveBeenCalledExactlyOnceWith('customer-1', {
      leadId: null,
      type: '拜访',
      occurredAt: expect.any(String) as string,
      summary: '周例会跟进',
      details: {},
    });
    expect(ports.load360).toHaveBeenCalledTimes(2);
    expect(
      element(host.querySelector('[data-testid="kt-customer-add-activity"]')).textContent,
    ).toBe('添加活动');
    expect(host.querySelector('button[type="submit"]')).toBeNull();
  });

  it('无 customer-activity:create 权限不出现活动创建入口', async () => {
    const host = mount(portsFor());
    await openFirst(host);
    expect(host.querySelector('[data-testid="kt-customer-add-activity"]')).toBeNull();
  });

  it('时间线类型筛选：多类型时呈现下拉，选择后仅保留匹配活动', async () => {
    const activities = [
      { id: 'a-1', type: 'NOTE', summary: '电话记录', occurredAt: local(22, 8) },
      { id: 'a-2', type: 'MEETING', summary: '现场拜访', occurredAt: local(19, 8) },
    ];
    const host = mount(
      portsFor([], {
        load360: vi.fn().mockResolvedValue({ ...view360, activities }),
      }),
    );
    await openFirst(host);
    const filter = section(host, 'kt-customer-activity-type-filter') as unknown as {
      value: string;
      dispatchEvent: (event: Event) => boolean;
    };
    expect(host.textContent).toContain('电话记录');
    expect(host.textContent).toContain('现场拜访');
    filter.value = 'NOTE';
    filter.dispatchEvent(new Event('change', { bubbles: true }));
    await flush();
    expect(host.textContent).toContain('电话记录');
    expect(host.textContent).not.toContain('现场拜访');
  });
});

describe('CRM-UX 客户统计卡', () => {
  const row = (id: string, status: string, createdAt: string): CustomerRow => ({
    ...customer,
    id,
    status,
    createdAt,
  });
  const lastMonth = new Date(2026, 9, 30, 9).toISOString();

  it('总数/活跃/新增本月基于已加载全集；高价值卡仅在宿主给出口径时呈现', () => {
    const rows = [
      row('a', 'ACTIVE', local(5, 9)),
      row('b', 'PROSPECT', lastMonth),
      row('c', 'ACTIVE', local(1, 9)),
    ];
    const host = mount(portsFor([], { initialCustomers: rows }));
    const stats = section(host, 'kt-customer-stats');
    expect(stats.textContent).toContain('客户总数3');
    expect(stats.textContent).toContain('活跃客户2占可见客户 67%');
    expect(stats.textContent).toContain('新增本月2');
    expect(host.querySelector('[data-testid="kt-customer-stat-high-value"]')).toBeNull();

    const valued = mount(
      portsFor([], {
        initialCustomers: rows,
        highValue: {
          label: '高价值客户',
          hint: '示例口径',
          count: (customers) => customers.filter((item) => item.status === 'ACTIVE').length,
        },
      }),
    );
    expect(section(valued, 'kt-customer-stat-high-value').textContent).toBe('高价值客户2示例口径');
  });

  it('统计不随筛选变化；列表触顶时总数显示 100+', async () => {
    const rows = [row('a', 'ACTIVE', local(5, 9)), row('b', 'PROSPECT', lastMonth)];
    const host = mount(portsFor([], { initialCustomers: rows }));
    element(host.querySelector('[data-testid="kt-customer-filter-active"]')).click();
    await flush();
    expect(section(host, 'kt-customer-stat-total').textContent).toContain('2');
    const capped = mount(
      portsFor([], {
        initialCustomers: Array.from({ length: 100 }, (_, index) =>
          row(`c-${String(index)}`, 'ACTIVE', local(2, 9)),
        ),
      }),
    );
    expect(section(capped, 'kt-customer-stat-total').textContent).toContain('100+');
  });
});

describe('CRM-UX 活动时间线', () => {
  const activities = [
    { id: 'a-1', type: '电话', summary: '电话回访', occurredAt: local(23, 8, 30) },
    { id: 'a-2', type: 'MEETING', summary: '昨日拜访', occurredAt: local(22, 16) },
    { id: 'a-3', type: '邮件', summary: '昨日邮件', occurredAt: local(22, 9) },
    { id: 'a-4', type: '展会', summary: '上周展会', occurredAt: local(18, 10) },
  ];
  const mountTimeline = async (overrides: Partial<CustomerConsolePorts> = {}) => {
    const host = mount(
      portsFor(['lead:read', 'opportunity:read'], {
        load360: vi.fn().mockResolvedValue({ ...view360, activities }),
        ...overrides,
      }),
    );
    await openFirst(host);
    return host;
  };

  it('按本地自然日分组（今天/昨天/带星期的日期），保持发生时间倒序', async () => {
    const host = await mountTimeline();
    const days = host.querySelectorAll('.crm-timeline-date').map((node) => node.textContent);
    expect(days).toEqual(['今天', '昨天', '2026年11月18日 周三']);
    expect(
      host.querySelectorAll('[data-testid="kt-customer-activity"]').map((node) => node.textContent),
    ).toEqual([
      '电话08:30电话回访',
      'MEETING16:00昨日拜访',
      '邮件09:00昨日邮件',
      '展会10:00上周展会',
    ]);
  });

  it('每条活动带类型图标键', async () => {
    const host = await mountTimeline();
    expect(
      host
        .querySelectorAll('[data-testid="kt-customer-activity"]')
        .map((node) => (node as TestElement).getAttribute('data-icon')),
    ).toEqual(['call', 'visit', 'mail', 'expo']);
  });

  it('关联线索/商机以内联链接呈现，点击定位并高亮对应卡片', async () => {
    const host = await mountTimeline({
      load360: vi.fn().mockResolvedValue({
        ...view360,
        activities: [
          {
            id: 'a-1',
            type: '拜访',
            summary: '现场沟通',
            occurredAt: local(22, 16),
            leadId: 'lead-1',
          },
        ],
        leads: [
          {
            id: 'lead-1',
            title: '学校运动场改造项目',
            status: 'CLAIMED',
            source: '展会',
            updatedAt: local(20, 9),
          },
        ],
        opportunities: [
          {
            id: 'op-1',
            name: '球场项目',
            status: 'PROPOSAL',
            leadId: 'lead-1',
            value: { amount: '500000', currency: 'CNY' },
          },
        ],
      }),
    });
    const links = host.querySelectorAll('[data-testid="kt-customer-activity-link"]');
    expect(links.map((node) => node.textContent)).toEqual(['球场项目', '学校运动场改造项目']);
    element(links[1]).click();
    await flush();
    const leadCard = element(host.querySelector('[data-testid="kt-customer-lead"]'));
    expect(leadCard.getAttribute('data-highlighted')).toBe('true');
    expect(leadCard.getAttribute('id')).toBe('kt-customer-lead-lead-1');
    expect(leadCard.textContent).toContain('已认领');
    element(links[0]).click();
    await flush();
    const opportunityCard = element(host.querySelector('[data-testid="kt-customer-opportunity"]'));
    expect(opportunityCard.getAttribute('data-highlighted')).toBe('true');
    expect(leadCard.getAttribute('data-highlighted')).toBe('false');
    expect(opportunityCard.textContent).toContain('方案报价');
  });

  it('无 lead:read 时不渲染关联线索分区与事实条线索计数', async () => {
    const host = mount(
      portsFor([], {
        load360: vi.fn().mockResolvedValue({ ...view360, activities }),
      }),
    );
    await openFirst(host);
    expect(host.querySelector('[data-testid="kt-customer-leads"]')).toBeNull();
    expect(section(host, 'kt-customer-facts').textContent).not.toContain('线索');
  });
});

describe('CRM-UX 联系人卡片', () => {
  it('默认遮蔽邮箱与电话；开关显示后明文呈现，再次点击恢复遮蔽', async () => {
    const host = mount(portsFor());
    await openFirst(host);
    const email = section(host, 'kt-customer-contact-email');
    const phone = section(host, 'kt-customer-contact-phone');
    expect(email.textContent).toBe('b***@example.test');
    expect(phone.textContent).toBe('138****5678');
    expect(section(host, 'kt-customer-360').textContent).not.toContain('buyer@example.test');
    const toggle = section(host, 'kt-customer-contact-visibility');
    expect(toggle.getAttribute('aria-pressed')).toBe('false');
    expect(toggle.textContent).toContain('显示联系方式');
    toggle.click();
    await flush();
    expect(section(host, 'kt-customer-contact-email').textContent).toBe('buyer@example.test');
    expect(section(host, 'kt-customer-contact-phone').textContent).toBe('13812345678');
    expect(section(host, 'kt-customer-contact-visibility').getAttribute('aria-pressed')).toBe(
      'true',
    );
    section(host, 'kt-customer-contact-visibility').click();
    await flush();
    expect(section(host, 'kt-customer-contact-email').textContent).toBe('b***@example.test');
  });

  it('关闭后重新打开恢复遮蔽；卡片呈现职务与主联系人标记', async () => {
    const ports = portsFor();
    const host = mount(ports);
    await openFirst(host);
    section(host, 'kt-customer-contact-visibility').click();
    await flush();
    expect(section(host, 'kt-customer-contact-email').textContent).toBe('buyer@example.test');
    element(host.querySelector('.drawer-close')).click();
    await flush();
    await openFirst(host);
    expect(section(host, 'kt-customer-contact-email').textContent).toBe('b***@example.test');
    const card = section(host, 'kt-customer-contact');
    expect(card.textContent).toContain('采购经理');
    expect(card.getAttribute('data-primary')).toBe('false');
  });

  it('服务端按权限折叠联系方式时提示受限，且不出现遮蔽开关', async () => {
    const host = mount(
      portsFor([], {
        load360: vi.fn().mockResolvedValue({
          ...view360,
          contacts: [{ id: 'contact-2', name: '受限联系人', title: null, primary: true }],
        }),
      }),
    );
    await openFirst(host);
    const card = section(host, 'kt-customer-contact');
    expect(card.textContent).toContain('联系方式受限或未提供');
    expect(card.textContent).toContain('主联系人');
    expect(card.getAttribute('data-primary')).toBe('true');
    expect(host.querySelector('[data-testid="kt-customer-contact-visibility"]')).toBeNull();
  });
});

describe('CRM-UX 商机漏斗与关联卡', () => {
  const opportunities = [
    { id: 'o-1', name: '项目甲', status: 'OPEN', value: { amount: '500000', currency: 'CNY' } },
    { id: 'o-2', name: '项目乙', status: 'OPEN', value: { amount: '300000', currency: 'CNY' } },
    {
      id: 'o-3',
      name: '项目丙',
      status: 'QUALIFIED',
      value: { amount: '200000', currency: 'CNY' },
    },
    { id: 'o-4', name: '项目丁', status: 'WON', value: { amount: '900000', currency: 'CNY' } },
    { id: 'o-5', name: '项目戊', status: 'LOST', value: { amount: '100000', currency: 'CNY' } },
  ];

  it('按阶段计数与金额，条宽相对最大阶段；已关闭商机单列', async () => {
    const host = mount(
      portsFor(['opportunity:read'], {
        load360: vi.fn().mockResolvedValue({ ...view360, opportunities }),
      }),
    );
    await openFirst(host);
    const stages = host.querySelectorAll('[data-testid="kt-customer-funnel-stage"]');
    expect(stages.map((node) => (node as TestElement).getAttribute('data-stage'))).toEqual([
      'OPEN',
      'QUALIFIED',
      'PROPOSAL',
      'WON',
    ]);
    expect(stages.map((node) => /^[^0-9]+\d/u.exec(node.textContent)?.[0])).toEqual([
      '初步接洽2',
      '需求确认1',
      '方案报价0',
      '赢单1',
    ]);
    expect(section(host, 'kt-customer-funnel').textContent).toContain('已关闭：输单 1');
    expect(section(host, 'kt-customer-funnel').textContent).toContain('¥800,000');
    const widths = stages.map((node) => {
      const bar = node.querySelector('.crm-funnel-bar') as TestElement | null;
      return (bar?.style as unknown as { width?: string } | undefined)?.width;
    });
    expect(widths).toEqual(['100%', '50%', '0%', '50%']);
  });

  it('无在途商机时给出空态；无 opportunity:read 时不渲染漏斗', async () => {
    const empty = mount(
      portsFor(['opportunity:read'], {
        load360: vi.fn().mockResolvedValue({ ...view360, opportunities: [] }),
      }),
    );
    await openFirst(empty);
    expect(section(empty, 'kt-customer-funnel').textContent).toContain('暂无在途商机');
    const denied = mount(portsFor());
    await openFirst(denied);
    expect(denied.querySelector('[data-testid="kt-customer-funnel"]')).toBeNull();
  });
});

describe('CRM-UX 信用概要（可选端口）', () => {
  const summary: CustomerCreditSummary = {
    limit: { currency: 'CNY', amount: 1_000_000 },
    exposure: { currency: 'CNY', amount: 750_000 },
    decision: { status: 'APPROVED', decidedAt: local(20, 9) },
  };

  it('宿主未提供数据通道时不渲染', async () => {
    const host = mount(portsFor());
    await openFirst(host);
    expect(host.querySelector('[data-testid="kt-customer-credit"]')).toBeNull();
  });

  it('经端口加载：额度/敞口/使用率进度条 + 最近决定', async () => {
    const loadCredit = vi.fn().mockResolvedValue(summary);
    const host = mount(portsFor([], { loadCredit }));
    await openFirst(host);
    await flush();
    expect(loadCredit).toHaveBeenCalledExactlyOnceWith('customer-1');
    const credit = section(host, 'kt-customer-credit');
    expect(section(host, 'kt-customer-credit-limit').textContent).toContain('1,000,000');
    expect(section(host, 'kt-customer-credit-exposure').textContent).toContain('750,000');
    expect(section(host, 'kt-customer-credit-usage').textContent).toBe('额度使用率 75%');
    expect(credit.textContent).toContain('信用已批准');
    expect(meterLevel(credit)).toBe('warning');
    expect(credit.textContent).not.toContain('暂无信用记录');
  });

  it('端口返回空、失败时分别呈现空态 / 不渲染', async () => {
    const none = mount(portsFor([], { loadCredit: vi.fn().mockResolvedValue(null) }));
    await openFirst(none);
    await flush();
    expect(section(none, 'kt-customer-credit').textContent).toContain('暂无信用记录');
    const failed = mount(portsFor([], { loadCredit: vi.fn().mockRejectedValue(new Error('x')) }));
    await openFirst(failed);
    await flush();
    expect(failed.querySelector('[data-testid="kt-customer-credit"]')).toBeNull();
  });

  it('360 响应内嵌 credit 分区时优先于端口', async () => {
    const loadCredit = vi.fn().mockResolvedValue(null);
    const host = mount(
      portsFor([], {
        loadCredit,
        load360: vi.fn().mockResolvedValue({
          ...view360,
          credit: { ...summary, exposure: { currency: 'CNY', amount: 950_000 } },
        }),
      }),
    );
    await openFirst(host);
    await flush();
    expect(loadCredit).not.toHaveBeenCalled();
    expect(section(host, 'kt-customer-credit-usage').textContent).toBe('额度使用率 95%');
    expect(meterLevel(section(host, 'kt-customer-credit'))).toBe('danger');
  });
});

describe('CRM-UX 抽屉操作区', () => {
  it('操作区置顶：打开抽屉即可添加联系人，提交走端口并刷新 360', async () => {
    const ports = portsFor(['customer:update']);
    const host = mount(ports);
    await openFirst(host);
    element(host.querySelector('[data-testid="kt-customer-add-contact"]')).click();
    await flush();
    fillField(host, 'name', '李采购');
    fillField(host, 'title', '总监');
    fillField(host, 'email', 'li@example.test');
    fillSelect(host, 'primary', 'false');
    await flush();
    await submitDrawer(host);
    expect(ports.createContact).toHaveBeenCalledExactlyOnceWith('customer-1', {
      name: '李采购',
      title: '总监',
      email: 'li@example.test',
      phone: null,
      primary: false,
    });
    expect(ports.load360).toHaveBeenCalledTimes(2);
    expect(host.querySelector('button[type="submit"]')).toBeNull();
  });

  it('联系人与活动表单互斥，切换时另一表单收起', async () => {
    const host = mount(portsFor(['customer:update', 'customer-activity:create']));
    await openFirst(host);
    element(host.querySelector('[data-testid="kt-customer-add-contact"]')).click();
    await flush();
    expect(host.querySelectorAll('.detail-drawer form')).toHaveLength(1);
    element(host.querySelector('[data-testid="kt-customer-add-activity"]')).click();
    await flush();
    expect(host.querySelectorAll('.detail-drawer form')).toHaveLength(1);
    expect(element(host.querySelector('.detail-drawer form')).textContent).toContain('添加活动');
  });

  it('切换客户时先清空上一份 360，不闪现上一客户的数据', async () => {
    const rows = [customer, { ...customer, id: 'customer-2', name: '第二客户' }];
    let release: (value: unknown) => void = () => undefined;
    const pending = new Promise((resolve) => {
      release = resolve;
    });
    const load360 = vi.fn().mockResolvedValueOnce(view360).mockReturnValueOnce(pending);
    const host = mount(portsFor([], { initialCustomers: rows, load360 }));
    await openFirst(host);
    expect(section(host, 'kt-customer-360').textContent).toContain('Buyer Zhang');
    const second = host.querySelectorAll('[data-testid="kt-customer-open"]')[1];
    element(second).click();
    await flush();
    expect(host.querySelector('[data-testid="kt-customer-360"]')).toBeNull();
    expect(host.textContent).toContain('客户 360 加载中');
    release({ ...view360, contacts: [] });
    await flush();
    expect(section(host, 'kt-customer-360').textContent).not.toContain('Buyer Zhang');
  });
});
// 回归（TD-WF-004 的调用侧，WF-B 接入时发现）：添加联系人 / 添加活动两个表单此前把 Promise
// 用 void 丢掉，FormSection 拿不到它——提交期间既不置灰也不拦重入。
describe('客户行内表单与防重复提交（FormSection 要拿到 onSubmit 的 Promise）', () => {
  const submitButtonOf = (host: TestElement): TestElement =>
    element(element(host.querySelector('.detail-drawer')).querySelector('button[type="submit"]'));

  it.each([
    [
      'customer:update',
      'kt-customer-add-contact',
      'createContact',
      '添加联系人',
      (host: TestElement) => {
        fillField(host, 'name', '张工');
        fillField(host, 'email', 'zhang@example.test');
        fillSelect(host, 'primary', 'false');
      },
    ],
    [
      'customer-activity:create',
      'kt-customer-add-activity',
      'createActivity',
      '添加活动',
      (host: TestElement) => {
        fillSelect(host, 'activityType', '电话');
        fillField(host, 'summary', '电话回访');
      },
    ],
  ] as const)(
    '$3：保存未返回前再次点击提交只提交一次；失败后可重试',
    async (permission, openTestid, portName, _label, fill) => {
      let fail: (reason: Error) => void = () => undefined;
      const port = vi.fn(
        () =>
          new Promise<null>((_resolve, reject) => {
            fail = reject;
          }),
      );
      const host = mount(portsFor([permission], { [portName]: port }));
      await openFirst(host);
      element(host.querySelector(`[data-testid="${openTestid}"]`)).click();
      await flush();
      fill(host);
      await flush();
      const submit = submitButtonOf(host);
      // 双击：两次点击之间不让出事件循环（重渲染尚未发生，disabled 还没来得及生效）。
      submit.click();
      submit.click();
      await flush();
      expect(port).toHaveBeenCalledTimes(1);
      expect(submit.disabled).toBe(true);
      fail(new Error('网络错误'));
      await flush();
      await flush();
      // 失败后表单留在原处，按钮恢复可点，可以再试。
      expect(submit.disabled).toBe(false);
      submit.click();
      await flush();
      expect(port).toHaveBeenCalledTimes(2);
    },
  );
});
