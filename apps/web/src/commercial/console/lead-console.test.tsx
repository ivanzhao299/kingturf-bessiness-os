// U3-CRM-1 线索控制台白盒行为测试（Preact 分域重写后的行为面；
// 原 lead-records-behavior.test.ts 行为断言逐条等价迁移——创建载荷 oracle、
// 认领原版本对象、权限门、筛选/分页）。
// CRM-UX 追加：公海/私海分栏、线索卡富化（来源图标/负责人头像/最近更新）、
// 抽屉随刷新同步。写路径载荷与权限门断言原样保留。
import { afterEach, describe, expect, it, vi } from 'vitest';
import { h, render } from 'preact';
import type { ComponentType } from 'preact';
import {
  installGlobalTestDom,
  TestEvent,
  type TestElement,
} from '../../../test/fixtures/preact-dom';
import { LeadConsolePage } from './lead-console';
import { noticeOf } from '../../../test/fixtures/console-notice';
import type { LeadConsolePorts, LeadRow } from './lead-ports';

const flush = (): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, 0);
  });

const element = (node: unknown): TestElement => {
  if (node === null || node === undefined || (node as { nodeType?: number }).nodeType !== 1)
    throw new Error(`expected element, got ${String(node)}`);
  return node as TestElement;
};

// 本地时间构造（期望值与机器时区无关）。
const local = (day: number, hour: number, minute = 0): string =>
  new Date(2026, 10, day, hour, minute).toISOString();
const NOW = new Date(2026, 10, 23, 10, 0).getTime();

const poolLead: LeadRow = {
  id: 'lead-1',
  title: '学校运动场改造项目',
  source: '展会',
  status: 'POOL',
  ownerId: null,
  customerId: null,
  version: 1,
  createdAt: '2026-11-20T00:00:00.000Z',
  updatedAt: local(23, 9, 30),
};

const claimedLead: LeadRow = {
  ...poolLead,
  id: 'lead-2',
  title: '网站线索',
  source: '网站',
  status: 'CLAIMED',
  ownerId: 'employee-1',
  updatedAt: local(10, 9),
};

const portsFor = (
  leads: readonly LeadRow[],
  extraPermissions: readonly string[] = [],
  overrides: Partial<LeadConsolePorts> = {},
): LeadConsolePorts => ({
  permissions: new Set(['lead:read', ...extraPermissions]),
  initialLeads: leads,
  poolMode: false,
  employeeChoices: [{ value: 'employee-1', label: '销售一号' }],
  textValue: (value, fallback = '') =>
    typeof value === 'string' || typeof value === 'number' ? String(value) : fallback,
  submit: vi.fn().mockResolvedValue(null),
  refresh: vi.fn().mockResolvedValue(leads),
  now: () => NOW,
  ...overrides,
});

const mount = (ports: LeadConsolePorts): TestElement => {
  const host = installGlobalTestDom().document.createElement('div');
  render(h(LeadConsolePage(ports) as ComponentType, {}), host);
  return host;
};

const titles = (host: TestElement): readonly string[] =>
  host.querySelectorAll('[data-testid="kt-lead-open-title"]').map((node) => node.textContent);

const tab = (host: TestElement, name: 'pool' | 'private'): TestElement =>
  element(host.querySelector(`[data-testid="kt-lead-tab-${name}"]`));

// 公海线索不在默认的私海分栏里：先切到公海并等重渲染再操作。
const openPool = async (host: TestElement): Promise<void> => {
  tab(host, 'pool').click();
  await flush();
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
  ['title', '学校运动场改造项目'],
  ['source', '展会'],
];

afterEach(() => {
  vi.restoreAllMocks();
});

describe('U3-CRM-1 线索控制台', () => {
  it('创建公海线索使用固定载荷并在刷新成功后收起抽屉', async () => {
    const ports = portsFor([], ['lead:create']);
    const host = mount(ports);
    element(host.querySelector('[data-testid="kt-lead-create"]')).click();
    await flush();
    for (const [name, value] of CREATE_FORM) fillField(host, name, value);
    await flush();
    await submitDrawer(host);
    expect(ports.submit).toHaveBeenCalledExactlyOnceWith('/api/v1/leads', {
      title: '学校运动场改造项目',
      source: '展会',
      customerId: null,
      pool: true,
    });
    expect(ports.refresh).toHaveBeenCalledTimes(1);
  });

  it('认领使用原始版本化 POOL 对象并刷新', async () => {
    const ports = portsFor([poolLead], ['lead-pool:claim', 'lead-pool:read']);
    const host = mount(ports);
    await openPool(host);
    element(host.querySelector('[data-testid="kt-lead-open"]')).click();
    await flush();
    element(host.querySelector('[data-testid="kt-lead-claim"]')).click();
    await flush();
    expect(ports.submit).toHaveBeenCalledExactlyOnceWith(
      '/api/v1/leads/lead-1/state',
      { action: 'claim', expectedVersion: 1, lead: poolLead },
      'PUT',
    );
    expect(ports.refresh).toHaveBeenCalledTimes(1);
  });

  it('变更状态经 PUT state（status/reason/expectedVersion）', async () => {
    const ports = portsFor([claimedLead], ['lead:lifecycle']);
    const host = mount(ports);
    element(host.querySelector('[data-testid="kt-lead-open"]')).click();
    await flush();
    element(host.querySelector('[data-testid="kt-lead-transition"]')).click();
    await flush();
    fillField(host, 'status', 'QUALIFIED');
    fillField(host, 'reason', '客户需求明确');
    await flush();
    await submitDrawer(host);
    expect(ports.submit).toHaveBeenCalledExactlyOnceWith(
      '/api/v1/leads/lead-2/state',
      {
        action: 'transition',
        status: 'QUALIFIED',
        expectedVersion: 1,
        reason: '客户需求明确',
        lead: expect.objectContaining({ status: 'CLAIMED' }) as unknown,
      },
      'PUT',
    );
  });

  it('分配/改派/释放权限门与载荷', async () => {
    // POOL 无主 → 分配
    const assignPorts = portsFor([poolLead], ['lead:assign', 'lead-pool:read']);
    const assignHost = mount(assignPorts);
    await openPool(assignHost);
    element(assignHost.querySelector('[data-testid="kt-lead-open"]')).click();
    await flush();
    element(assignHost.querySelector('[data-testid="kt-lead-assign"]')).click();
    await flush();
    fillField(assignHost, 'assigneeId', 'employee-1');
    fillField(assignHost, 'reason', '区域匹配');
    await flush();
    await submitDrawer(assignHost);
    expect(assignPorts.submit).toHaveBeenCalledExactlyOnceWith(
      '/api/v1/leads/lead-1/state',
      {
        action: 'assign',
        assigneeId: 'employee-1',
        expectedVersion: 1,
        reason: '区域匹配',
        lead: poolLead,
      },
      'PUT',
    );
    // 已认领 → 改派 + 释放
    const reassignPorts = portsFor([claimedLead], ['lead:reassign', 'lead-pool:release']);
    const reassignHost = mount(reassignPorts);
    element(reassignHost.querySelector('[data-testid="kt-lead-open"]')).click();
    await flush();
    const reassign = reassignHost.querySelector('[data-testid="kt-lead-assign"]');
    expect(reassign?.textContent).toContain('改派');
    const release = reassignHost.querySelector('[data-testid="kt-lead-release"]');
    expect(release).not.toBeNull();
    element(release).click();
    await flush();
    expect(reassignPorts.submit).not.toHaveBeenCalled();
    element(reassignHost.querySelector('[role="alertdialog"] button.secondary')).click();
    await flush();
    expect(reassignPorts.submit).not.toHaveBeenCalled();
    element(release).click();
    await flush();
    element(reassignHost.querySelector('[role="alertdialog"] button.primary')).click();
    await flush();
    expect(reassignPorts.submit).toHaveBeenCalledExactlyOnceWith(
      '/api/v1/leads/lead-2/state',
      {
        action: 'release',
        expectedVersion: 1,
        reason: '释放至线索公海',
        lead: claimedLead,
      },
      'PUT',
    );
  });

  it('权限不足不出现对应行级操作（权限门保持）', async () => {
    const host = mount(portsFor([poolLead]));
    await openPool(host);
    element(host.querySelector('[data-testid="kt-lead-open"]')).click();
    await flush();
    expect(host.querySelector('[data-testid="kt-lead-claim"]')).toBeNull();
    expect(host.querySelector('[data-testid="kt-lead-transition"]')).toBeNull();
    expect(host.querySelector('[data-testid="kt-lead-assign"]')).toBeNull();
    expect(host.querySelector('[data-testid="kt-lead-release"]')).toBeNull();
  });

  it('状态筛选与编号检索为客户端过滤', async () => {
    const leads = [poolLead, claimedLead];
    const host = mount(portsFor(leads));
    element(host.querySelector('[data-testid="kt-lead-filter-claimed"]')).click();
    await flush();
    expect(host.textContent).toContain('网站线索');
    element(host.querySelector('[data-testid="kt-lead-filter-all"]')).click();
    await flush();
    const search = element(host.querySelector('[data-testid="kt-lead-search"]'));
    search.value = '网站';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    await flush();
    expect(host.textContent).toContain('网站线索');
  });

  it('继续加载按已显示条数递增（25 条先显示 20 条，点击后全部显示）', async () => {
    const leads = Array.from({ length: 25 }, (_, index) => ({
      ...poolLead,
      id: `lead-${String(index)}`,
      title: `线索${String(index)}`,
    }));
    const host = mount(portsFor(leads));
    await openPool(host);
    expect(host.querySelectorAll('[data-testid="kt-lead-open"]')).toHaveLength(20);
    const more = host.querySelectorAll('button').find((node) => node.textContent === '继续加载');
    if (!more) throw new Error('load-more button missing');
    element(more).click();
    await flush();
    expect(host.querySelectorAll('[data-testid="kt-lead-open"]')).toHaveLength(25);
    expect(host.querySelectorAll('button').some((node) => node.textContent === '继续加载')).toBe(
      false,
    );
  });

  it('刷新失败时错误经 DataTable error 面暴露', async () => {
    const ports = portsFor([], [], {
      refresh: vi.fn().mockRejectedValue(new Error('线索加载失败')),
    });
    const host = mount(ports);
    const refresh = host.querySelector('[data-testid="kt-lead-refresh"]');
    if (!refresh) throw new Error('refresh button missing');
    element(refresh).click();
    await flush();
    expect(host.querySelector('.data-table-error')).not.toBeNull();
    expect(host.textContent).toContain('线索加载失败');
  });
});

describe('CRM-UX 公海/私海分栏', () => {
  it('默认进入私海；两个分栏各自只显示对应线索并带计数', async () => {
    const host = mount(portsFor([poolLead, claimedLead], ['lead-pool:read']));
    expect(tab(host, 'private').getAttribute('aria-selected')).toBe('true');
    expect(titles(host)).toEqual(['网站线索']);
    expect(tab(host, 'private').textContent).toBe('私海1');
    expect(tab(host, 'pool').textContent).toBe('公海1');
    await openPool(host);
    await flush();
    expect(titles(host)).toEqual(['学校运动场改造项目']);
    expect(tab(host, 'pool').getAttribute('aria-selected')).toBe('true');
    expect(tab(host, 'private').getAttribute('tabIndex')).toBe('-1');
    expect(host.textContent).toContain('线索公海');
  });

  it('仅有 lead:read 但可见数据含公海行时仍提供公海分栏（不丢线索）', async () => {
    const host = mount(portsFor([poolLead, claimedLead]));
    expect(tab(host, 'pool')).toBeDefined();
    await openPool(host);
    expect(titles(host)).toEqual(['学校运动场改造项目']);
  });

  it('仅 lead-pool:read：默认进入公海且不渲染单分栏标签', () => {
    const host = mount(
      portsFor([poolLead], ['lead-pool:read'], {
        permissions: new Set(['lead-pool:read']),
      }),
    );
    expect(host.querySelector('[data-testid="kt-lead-tabs"]')).toBeNull();
    expect(host.querySelector('[data-testid="kt-lead-tab-private"]')).toBeNull();
    expect(titles(host)).toEqual(['学校运动场改造项目']);
  });

  it('公海分栏不显示状态筛选；私海分栏不再出现「公海」筛选', async () => {
    const host = mount(portsFor([poolLead, claimedLead], ['lead-pool:read']));
    expect(host.querySelector('[data-testid="kt-lead-filter-pool"]')).toBeNull();
    expect(host.querySelector('[data-testid="kt-lead-filter-claimed"]')).not.toBeNull();
    await openPool(host);
    await flush();
    expect(host.querySelector('[data-testid="kt-lead-filter-all"]')).toBeNull();
    expect(host.querySelector('[data-testid="kt-lead-search"]')).not.toBeNull();
  });

  it('方向键在分栏间切换（WAI-ARIA tabs）', async () => {
    const host = mount(portsFor([poolLead, claimedLead], ['lead-pool:read']));
    tab(host, 'private').dispatchEvent(new TestEvent('keydown', { key: 'ArrowLeft' }));
    await flush();
    expect(tab(host, 'pool').getAttribute('aria-selected')).toBe('true');
    expect(titles(host)).toEqual(['学校运动场改造项目']);
  });

  it('搜索可按状态文案命中', async () => {
    const host = mount(
      portsFor([claimedLead, { ...claimedLead, id: 'lead-3', status: 'QUALIFIED' }]),
    );
    const search = element(host.querySelector('[data-testid="kt-lead-search"]'));
    search.value = '已认领';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    await flush();
    expect(titles(host)).toEqual(['网站线索']);
  });

  it('分栏空态区分「暂无线索」与「没有匹配」', async () => {
    const host = mount(portsFor([claimedLead], ['lead-pool:read']));
    const search = element(host.querySelector('[data-testid="kt-lead-search"]'));
    search.value = '不存在的线索';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    await flush();
    expect(host.textContent).toContain('没有匹配的线索');
    await openPool(host);
    expect(host.textContent).toContain('公海暂无线索');
    expect(host.textContent).not.toContain('没有匹配的线索');
    search.value = '';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    tab(host, 'private').click();
    await flush();
    expect(titles(host)).toEqual(['网站线索']);
  });
});

describe('CRM-UX 线索卡', () => {
  const cell = (host: TestElement, row: number, testId: string): TestElement =>
    element(
      host.querySelectorAll('tbody tr')[row]?.querySelector(`[data-testid="${testId}"]`) ?? null,
    );

  it('卡片呈现来源图标键、负责人头像与姓名；标题可打开详情', async () => {
    const host = mount(portsFor([claimedLead]));
    expect(cell(host, 0, 'kt-lead-source').getAttribute('data-icon')).toBe('website');
    expect(cell(host, 0, 'kt-lead-source').textContent).toBe('网站线索网站');
    const owner = cell(host, 0, 'kt-lead-owner');
    expect(owner.getAttribute('data-tone')).toBe('named');
    expect(owner.textContent).toBe('销销售一号');
    cell(host, 0, 'kt-lead-open-title').click();
    await flush();
    expect(host.querySelector('[data-testid="kt-lead-detail"]')).not.toBeNull();
  });

  it('无负责人：公海显示待认领、其余显示未分配；未知负责人回落编号前 8 位', async () => {
    const host = mount(
      portsFor(
        [
          { ...claimedLead, id: 'lead-4', status: 'NEW', ownerId: null },
          { ...claimedLead, id: 'lead-5', ownerId: '7f3a9c2e-1b2b-4c3d-9e10-111213141516' },
        ],
        ['lead-pool:read'],
      ),
    );
    expect(cell(host, 0, 'kt-lead-owner').getAttribute('data-tone')).toBe('empty');
    expect(cell(host, 0, 'kt-lead-owner').textContent).toBe('未分配');
    expect(cell(host, 1, 'kt-lead-owner').getAttribute('data-tone')).toBe('named');
    expect(cell(host, 1, 'kt-lead-owner').textContent).toBe('7f3a9c2e');
    const poolHost = mount(portsFor([poolLead], ['lead-pool:read']));
    await openPool(poolHost);
    expect(cell(poolHost, 0, 'kt-lead-owner').textContent).toBe('待认领');
  });

  it('最近更新为相对时间并带绝对时间；超过 7 天标为滞留', () => {
    const freshLead: LeadRow = { ...claimedLead, id: 'lead-6', updatedAt: local(23, 9, 30) };
    const host = mount(portsFor([freshLead, claimedLead]));
    const fresh = cell(host, 0, 'kt-lead-updated');
    expect(fresh.textContent).toBe('30 分钟前');
    expect(fresh.getAttribute('data-stale')).toBe('false');
    expect(fresh.getAttribute('title')).toContain('更新');
    expect(fresh.getAttribute('datetime')).toBe(freshLead.updatedAt);
    const stale = cell(host, 1, 'kt-lead-updated');
    expect(stale.textContent).toBe('13 天前');
    expect(stale.getAttribute('data-stale')).toBe('true');
  });

  it('来源为空或未命中图标表时回落通用图标且不报错', () => {
    const host = mount(
      portsFor([
        { ...claimedLead, source: '' },
        { ...claimedLead, source: '陌拜' },
      ]),
    );
    expect(cell(host, 0, 'kt-lead-source').getAttribute('data-icon')).toBe('other');
    expect(cell(host, 1, 'kt-lead-source').getAttribute('data-icon')).toBe('outreach');
  });
});

describe('CRM-UX 抽屉随刷新同步', () => {
  it('认领后抽屉同步为最新行：状态已认领、认领按钮消失，线索离开公海列表', async () => {
    const claimed: LeadRow = { ...poolLead, status: 'CLAIMED', ownerId: 'employee-1', version: 2 };
    const ports = portsFor([poolLead], ['lead-pool:claim', 'lead-pool:read'], {
      refresh: vi.fn().mockResolvedValue([claimed]),
    });
    const host = mount(ports);
    await openPool(host);
    element(host.querySelector('[data-testid="kt-lead-open"]')).click();
    await flush();
    expect(element(host.querySelector('[data-testid="kt-lead-claim"]'))).not.toBeNull();
    element(host.querySelector('[data-testid="kt-lead-claim"]')).click();
    await flush();
    const detail = element(host.querySelector('[data-testid="kt-lead-detail"]'));
    expect(detail.textContent).toContain('已认领');
    expect(detail.textContent).toContain('销售一号');
    expect(host.querySelector('[data-testid="kt-lead-claim"]')).toBeNull();
    expect(titles(host)).toEqual([]);
  });

  it('刷新后记录已不在可见范围（释放后无公海权限）则关闭抽屉', async () => {
    const ports = portsFor([claimedLead], ['lead-pool:release'], {
      refresh: vi.fn().mockResolvedValue([]),
    });
    const host = mount(ports);
    element(host.querySelector('[data-testid="kt-lead-open"]')).click();
    await flush();
    element(host.querySelector('[data-testid="kt-lead-release"]')).click();
    await flush();
    element(host.querySelector('[role="alertdialog"] button.primary')).click();
    await flush();
    expect(host.querySelector('[data-testid="kt-lead-detail"]')).toBeNull();
  });

  it('新建线索后切到公海分栏让结果可见', async () => {
    const created: LeadRow = { ...poolLead, id: 'lead-9', title: '新线索' };
    const ports = portsFor([], ['lead:create', 'lead-pool:read'], {
      refresh: vi.fn().mockResolvedValue([created]),
    });
    const host = mount(ports);
    element(host.querySelector('[data-testid="kt-lead-create"]')).click();
    await flush();
    for (const [name, value] of CREATE_FORM) fillField(host, name, value);
    await flush();
    await submitDrawer(host);
    expect(tab(host, 'pool').getAttribute('aria-selected')).toBe('true');
    expect(titles(host)).toEqual(['新线索']);
  });
});

describe('CRM-UX 入口一致性', () => {
  it('标题入口与「查看」入口打开同一条线索的详情', async () => {
    const host = mount(portsFor([claimedLead, poolLead]));
    element(host.querySelector('[data-testid="kt-lead-open-title"]')).click();
    await flush();
    expect(element(host.querySelector('.detail-drawer h2')).textContent).toBe(
      '线索详情 · 网站线索',
    );
    element(host.querySelector('.drawer-close')).click();
    await flush();
    expect(host.querySelector('[data-testid="kt-lead-detail"]')).toBeNull();
    element(host.querySelector('[data-testid="kt-lead-open"]')).click();
    await flush();
    expect(element(host.querySelector('.detail-drawer h2')).textContent).toBe(
      '线索详情 · 网站线索',
    );
  });
});

describe('CRM-2 线索控制台：写成功后的提示（TD-WF-014①）', () => {
  it('认领成功：提示在开着的详情抽屉底部', async () => {
    const claimed: LeadRow = { ...poolLead, status: 'CLAIMED', ownerId: 'employee-1', version: 2 };
    const ports = portsFor([poolLead], ['lead-pool:claim', 'lead-pool:read'], {
      refresh: vi.fn().mockResolvedValue([claimed]),
    });
    const host = mount(ports);
    await openPool(host);
    element(host.querySelector('[data-testid="kt-lead-open"]')).click();
    await flush();
    element(host.querySelector('[data-testid="kt-lead-claim"]')).click();
    await flush();
    await flush();
    expect(noticeOf(host)).toEqual({ text: '已认领线索', inDrawer: true });
  });
});
