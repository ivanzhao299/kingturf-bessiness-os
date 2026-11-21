// U3-CRM-1 线索控制台白盒行为测试（Preact 分域重写后的行为面；
// 原 lead-records-behavior.test.ts 行为断言逐条等价迁移——创建载荷 oracle、
// 认领原版本对象、权限门、筛选/分页）。
import { afterEach, describe, expect, it, vi } from 'vitest';
import { h, render } from 'preact';
import type { ComponentType } from 'preact';
import { installGlobalTestDom, type TestElement } from '../../../test/fixtures/preact-dom';
import { LeadConsolePage } from './lead-console';
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

const poolLead: LeadRow = {
  id: 'lead-1',
  title: '学校运动场改造项目',
  source: '展会',
  status: 'POOL',
  ownerId: null,
  customerId: null,
  version: 1,
  createdAt: '2026-11-20T00:00:00.000Z',
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
  ...overrides,
});

const mount = (ports: LeadConsolePorts): TestElement => {
  const host = installGlobalTestDom().document.createElement('div');
  render(h(LeadConsolePage(ports) as ComponentType, {}), host);
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
    const ports = portsFor([poolLead], ['lead-pool:claim']);
    const host = mount(ports);
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
    const ports = portsFor(
      [{ ...poolLead, status: 'CLAIMED', ownerId: 'employee-1' }],
      ['lead:lifecycle'],
    );
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
      '/api/v1/leads/lead-1/state',
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
    const assignPorts = portsFor([poolLead], ['lead:assign']);
    const assignHost = mount(assignPorts);
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
    const claimed = { ...poolLead, status: 'CLAIMED', ownerId: 'employee-1' };
    const reassignPorts = portsFor([claimed], ['lead:reassign', 'lead-pool:release']);
    const reassignHost = mount(reassignPorts);
    element(reassignHost.querySelector('[data-testid="kt-lead-open"]')).click();
    await flush();
    const reassign = reassignHost.querySelector('[data-testid="kt-lead-assign"]');
    expect(reassign?.textContent).toContain('改派');
    const release = reassignHost.querySelector('[data-testid="kt-lead-release"]');
    expect(release).not.toBeNull();
    element(release).click();
    await flush();
    expect(reassignPorts.submit).toHaveBeenCalledExactlyOnceWith(
      '/api/v1/leads/lead-1/state',
      { action: 'release', expectedVersion: 1, reason: '释放至线索公海', lead: claimed },
      'PUT',
    );
  });

  it('权限不足不出现对应行级操作（权限门保持）', async () => {
    const host = mount(portsFor([poolLead]));
    element(host.querySelector('[data-testid="kt-lead-open"]')).click();
    await flush();
    expect(host.querySelector('[data-testid="kt-lead-claim"]')).toBeNull();
    expect(host.querySelector('[data-testid="kt-lead-transition"]')).toBeNull();
    expect(host.querySelector('[data-testid="kt-lead-assign"]')).toBeNull();
    expect(host.querySelector('[data-testid="kt-lead-release"]')).toBeNull();
  });

  it('状态筛选与编号检索为客户端过滤', async () => {
    const leads = [
      poolLead,
      { ...poolLead, id: 'lead-2', title: '网站线索', source: '网站', status: 'CLAIMED' },
    ];
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
