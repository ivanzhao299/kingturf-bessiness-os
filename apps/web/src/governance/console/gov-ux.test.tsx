// GOV-UX（治理域交互体验优化）白盒行为测试：五项交互升级（角色矩阵/组织架构图/审计时间线/
// 版本对比/概览仪表盘）按「行为重写 + UX 升级」双标签同批编写（第四次人裁授权，见
// console.test.tsx 头注）。测试 DOM=零依赖 double（test/fixtures/preact-dom.ts）。
import { describe, expect, it, vi } from 'vitest';
import { h, render } from 'preact';
import type { ComponentType } from 'preact';
import { installGlobalTestDom, type TestElement } from '../../../test/fixtures/preact-dom';
import { AuditConsolePage } from './audit-page';
import { OrganizationConsolePage } from './organization-page';
import { configConsoleFor } from './config-specs';
import { IdentityConsolePage } from './identity-page';
import { OverviewDashboard, mountGovernanceDashboard } from './overview-dashboard';
import { GovernanceController, type GovernanceView } from '../controller';
import { dashboardMetrics, dashboardModel } from '../dashboard-model';
import { visibleGovernanceSurfaces } from '../surfaces';
import { createGovernanceWorkspace } from '../workspace';
import { sessionFixture } from '../../test-fixtures/session';
import { diffSnapshots, flattenLeaves, pairFromRow } from './version-model';
import { NUMBERING_VERSION_FIELDS, RULE_VERSION_FIELDS } from './config-versions';
import type { ConsolePorts } from './ports';

const flush = (): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, 0);
  });

const element = (node: unknown): TestElement => {
  if (node === null || node === undefined || (node as { nodeType?: number }).nodeType !== 1)
    throw new Error(`expected element, got ${String(node)}`);
  return node as TestElement;
};

// 测试 DOM 的 querySelector 返回 TestNode：统一经 el/q/qa 收窄到 TestElement。
const el = (node: unknown): TestElement | null =>
  node !== null && node !== undefined && (node as { nodeType?: number }).nodeType === 1
    ? (node as TestElement)
    : null;
const q = (root: TestElement, selector: string): TestElement | null =>
  el(root.querySelector(selector));

const BASE_PERMISSIONS = [
  'identity:read',
  'authorization:read',
  'employee:read',
  'organization:read',
  'role:read',
  'permission:read',
  'audit:read',
  'master-data:read',
  'number:read',
  'rule:read',
  'workflow:read',
] as const;

const portsFor = (
  route: ConsolePorts['route'],
  views: Readonly<Record<string, unknown>>,
  extraPermissions: readonly string[] = [],
  overrides: Partial<ConsolePorts> = {},
): ConsolePorts => ({
  route,
  permissions: new Set([...BASE_PERMISSIONS, ...extraPermissions]),
  views: () => [],
  loaded: (path) => path in views,
  viewError: () => undefined,
  initialView: (path) => {
    const value = views[path];
    if (Array.isArray(value)) return { items: value, nextCursor: null };
    if (value && typeof value === 'object')
      return value as { items: readonly unknown[]; nextCursor: string | null };
    return { items: [], nextCursor: null };
  },
  fetchPage: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
  fetchRecord: vi.fn().mockResolvedValue({}),
  submit: vi.fn().mockResolvedValue(undefined),
  ...overrides,
});

const mount = (page: (ports: ConsolePorts) => ComponentType, ports: ConsolePorts): TestElement => {
  const host = installGlobalTestDom().document.createElement('div');
  render(h(page(ports), {}), host);
  return host;
};

const auditEvent = (id: string, occurredAt: string, outcome = 'SUCCESS') => ({
  id,
  occurredAt,
  outcome,
  action: `ACTION_${id}`,
  actorId: 'actor-1',
  targetType: 'session',
  targetId: 'target-1',
  correlationId: 'corr-1',
});

describe('GOV-UX ③ 审计时间线视图', () => {
  it('默认时间线视图：按本地日历日降序分组并带当日条数与失败强调', () => {
    const ports = portsFor('governance/audit', {
      '/api/v1/audit-events': [
        auditEvent('a-1', '2026-11-23T02:03:04Z'),
        auditEvent('a-2', '2026-11-23T01:00:00Z'),
        auditEvent('a-3', '2026-11-20T10:00:00Z', 'FAILURE'),
      ],
    });
    const host = mount(AuditConsolePage, ports);
    expect(q(host, '[data-testid="kt-audit-timeline"]')).not.toBeNull();
    expect(q(host, '[data-testid="kt-audit-view-timeline"]')?.getAttribute('aria-pressed')).toBe(
      'true',
    );
    const days = host.querySelectorAll('[data-testid="kt-audit-day"]');
    expect(days.map((day) => (day as TestElement).getAttribute('data-day'))).toEqual([
      '2026-11-23',
      '2026-11-20',
    ]);
    expect(days[0]?.querySelectorAll('[data-testid="kt-audit-event"]').length).toBe(2);
    expect(days[0]?.textContent).toContain('2 条');
    const failed = el(host.querySelectorAll('[data-testid="kt-audit-event"]')[2]);
    expect(failed?.getAttribute('data-outcome')).toBe('FAILURE');
    expect(failed?.textContent).toContain('失败');
    expect(q(host, '.data-table table')).toBeNull();
  });

  it('可切回表格视图（DataTable）再切回时间线；两种视图共用筛选与导出', async () => {
    const ports = portsFor('governance/audit', {
      '/api/v1/audit-events': [auditEvent('a-1', '2026-11-23T02:03:04Z')],
    });
    const host = mount(AuditConsolePage, ports);
    element(q(host, '[data-testid="kt-audit-view-table"]')).click();
    await flush();
    expect(q(host, '.data-table table')).not.toBeNull();
    expect(q(host, '[data-testid="kt-audit-timeline"]')).toBeNull();
    element(q(host, '[data-testid="kt-audit-view-timeline"]')).click();
    await flush();
    expect(q(host, '[data-testid="kt-audit-timeline"]')).not.toBeNull();
    expect(q(host, '[data-testid="kt-audit-export"]')).not.toBeNull();
  });

  it('导出保留：时间线视图下导出循环仍按 cursor 续拉至耗尽', async () => {
    const ports = portsFor('governance/audit', {
      '/api/v1/audit-events': {
        items: [auditEvent('a-1', '2026-11-23T02:03:04Z')],
        nextCursor: 'c1',
      },
    });
    (ports.fetchPage as ReturnType<typeof vi.fn>).mockImplementation(
      (_p: string, params?: Readonly<Record<string, string | undefined>>) =>
        Promise.resolve(
          params?.cursor === 'c1'
            ? { items: [auditEvent('a-2', '2026-11-22T02:03:04Z')], nextCursor: null }
            : { items: [], nextCursor: null },
        ),
    );
    const host = mount(AuditConsolePage, ports);
    element(q(host, '[data-testid="kt-audit-export"]')).click();
    await flush();
    await flush();
    const calls = (ports.fetchPage as ReturnType<typeof vi.fn>).mock.calls as unknown as readonly [
      string,
      Readonly<Record<string, string | undefined>>?,
    ][];
    expect(calls.map((call) => call[1]?.cursor)).toEqual(['c1']);
  });

  it('时间线视图下应用筛选仍提交服务端参数（query/from）', async () => {
    const ports = portsFor('governance/audit', {
      '/api/v1/audit-events': [auditEvent('a-1', '2026-11-23T02:03:04Z')],
    });
    const host = mount(AuditConsolePage, ports);
    const query = element(q(host, '[data-testid="kt-audit-query"]'));
    query.value = 'login';
    query.dispatchEvent(new Event('input', { bubbles: true }));
    element(q(host, '[data-testid="kt-audit-apply"]')).click();
    await flush();
    expect(ports.fetchPage).toHaveBeenCalledWith('/api/v1/audit-events', { query: 'login' });
  });

  it('时间线继续加载携带 cursor；空结果显示统一空态', async () => {
    const ports = portsFor('governance/audit', {
      '/api/v1/audit-events': {
        items: [auditEvent('a-1', '2026-11-23T02:03:04Z')],
        nextCursor: 'c-1',
      },
    });
    const host = mount(AuditConsolePage, ports);
    element(q(host, '[data-testid="kt-audit-timeline"] .data-table-footer button')).click();
    await flush();
    expect(ports.fetchPage).toHaveBeenCalledWith('/api/v1/audit-events', { cursor: 'c-1' });
    const empty = mount(
      AuditConsolePage,
      portsFor('governance/audit', { '/api/v1/audit-events': [] }),
    );
    expect(empty.querySelector('[data-testid="kt-audit-timeline"]')?.textContent).toContain(
      '无匹配审计事件',
    );
  });
});

const organizations = [
  { id: 'org-1', code: 'HQ', name: '总部', parentId: null },
  { id: 'org-2', code: 'SALES', name: '销售部', parentId: 'org-1' },
  { id: 'org-3', code: 'SALES-EAST', name: '华东销售', parentId: 'org-2' },
];
const employee = (id: string, organizationId: string) => ({
  id,
  employeeNumber: id.toUpperCase(),
  displayName: `员工${id}`,
  email: `${id}@x.co`,
  active: true,
  organizationId,
});
const employees = [
  employee('e-1', 'org-1'),
  employee('e-2', 'org-2'),
  employee('e-3', 'org-2'),
  employee('e-4', 'org-3'),
];

const orgPorts = (overrides: Partial<ConsolePorts> = {}): ConsolePorts =>
  portsFor(
    'governance/organization',
    { '/api/v1/organizations': organizations, '/api/v1/employees': employees },
    [],
    {
      fetchPage: vi
        .fn()
        .mockImplementation((path: string) =>
          Promise.resolve(
            path === '/api/v1/employees'
              ? { items: employees, nextCursor: null }
              : { items: [], nextCursor: null },
          ),
        ),
      ...overrides,
    },
  );

const nodeBadges = (host: TestElement, id: string): readonly (string | null)[] =>
  (
    host
      .querySelector(`[data-testid="kt-org-node"][data-id="${id}"]`)
      ?.querySelector('.org-chart-row')
      ?.querySelectorAll('.org-chart-badge') ?? []
  ).map((node) => node.textContent);

describe('GOV-UX ② 组织架构图', () => {
  it('可视化树渲染层级；人数徽章=直属 + 含下级合计（按分页读尽的可见员工统计）', async () => {
    const host = mount(OrganizationConsolePage, orgPorts());
    expect(q(host, '[role="tree"]')).not.toBeNull();
    await flush();
    expect(nodeBadges(host, 'org-1')).toEqual(['1 人', '含下级 4']);
    expect(nodeBadges(host, 'org-2')).toEqual(['2 人', '含下级 3']);
    expect(nodeBadges(host, 'org-3')).toEqual(['1 人']);
    const nested = q(host, '[data-testid="kt-org-node"][data-id="org-3"]');
    expect(nested?.getAttribute('aria-level')).toBe('3');
    expect(q(host, '[data-testid="kt-org-count-hint"]')?.textContent).toContain('4 名');
  });

  it('另有员工归属未展示组织时如实提示；人数未读尽时徽章提示为下限', async () => {
    const stray = [...employees, employee('e-5', 'org-unknown')];
    const host = mount(
      OrganizationConsolePage,
      portsFor(
        'governance/organization',
        { '/api/v1/organizations': organizations, '/api/v1/employees': stray },
        [],
        {
          fetchPage: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
        },
      ),
    );
    const capped = mount(
      OrganizationConsolePage,
      portsFor(
        'governance/organization',
        {
          '/api/v1/organizations': organizations,
          '/api/v1/employees': { items: employees, nextCursor: 'c0' },
        },
        [],
        { fetchPage: vi.fn().mockResolvedValue({ items: employees, nextCursor: 'always-more' }) },
      ),
    );
    for (let tick = 0; tick < 12; tick += 1) await flush();
    expect(q(host, '[data-testid="kt-org-count-hint"]')?.textContent).toContain(
      '另有 1 名员工归属未展示的组织',
    );
    expect(capped.querySelector('[data-testid="kt-org-count-hint"]')?.textContent).toContain(
      '未读尽',
    );
  });

  it('展开/收起节点；选中节点触发服务端过滤并高亮；「全部组织」清除筛选', async () => {
    const ports = orgPorts();
    const host = mount(OrganizationConsolePage, ports);
    const toggle = element(
      q(host, '[data-testid="kt-org-node"][data-id="org-1"] [data-testid="kt-org-toggle"]'),
    );
    toggle.click();
    await flush();
    expect(q(host, '[data-testid="kt-org-node"][data-id="org-2"]')).toBeNull();
    toggle.click();
    await flush();
    expect(q(host, '[data-testid="kt-org-node"][data-id="org-2"]')).not.toBeNull();
    element(
      q(host, '[data-testid="kt-org-node"][data-id="org-2"] [data-testid="kt-org-select"]'),
    ).click();
    await flush();
    expect(ports.fetchPage).toHaveBeenCalledWith('/api/v1/employees', { organization: 'org-2' });
    expect(
      q(host, '[data-testid="kt-org-node"][data-id="org-2"]')?.getAttribute('aria-selected'),
    ).toBe('true');
    expect(host.textContent).toContain('右侧列表已按选中组织过滤');
    element(q(host, '[data-testid="kt-org-all"]')).click();
    await flush();
    expect(ports.fetchPage).toHaveBeenCalledWith('/api/v1/employees', {});
    expect(
      q(host, '[data-testid="kt-org-node"][data-id="org-2"]')?.getAttribute('aria-selected'),
    ).toBe('false');
  });
});

const numberVersions = [
  {
    version: 1,
    prefix: 'Q',
    suffix: '',
    padding: 4,
    starting_value: 1,
    increment_by: 1,
    reset: 'NEVER',
    status: 'PUBLISHED',
    published_at: '2026-01-01T00:00:00.000Z',
  },
  {
    version: 2,
    prefix: 'QT',
    suffix: '',
    padding: 6,
    starting_value: 100,
    increment_by: 1,
    reset: 'NEVER',
    status: 'DRAFT',
    published_at: null,
  },
];

const cfgMount = (
  route: string,
  views: Readonly<Record<string, unknown>>,
  overrides: Partial<ConsolePorts> = {},
): TestElement => {
  const spec = configConsoleFor(route);
  if (!spec) throw new Error(`spec missing for ${route}`);
  return mount(
    (ports) => spec(ports),
    portsFor(route as ConsolePorts['route'], views, [], overrides),
  );
};

const openFirstRow = async (host: TestElement): Promise<TestElement | null> => {
  element(q(host, '[data-testid="kt-cfg-open"]')).click();
  await flush();
  await flush();
  return q(host, '[data-testid="kt-cfg-version-compare"]');
};

describe('GOV-UX ④ 版本对比模型', () => {
  it('flattenLeaves：嵌套对象/数组按叶子路径展开，空容器与 null 保留占位，深度封顶', () => {
    expect([...flattenLeaves({ a: 1, b: { c: 'x', d: [true, null] }, e: {}, f: [] })]).toEqual([
      ['a', '1'],
      ['b.c', 'x'],
      ['b.d[0]', 'true'],
      ['b.d[1]', 'null'],
      ['e', '{}'],
      ['f', '[]'],
    ]);
    expect([...flattenLeaves({ a: { b: { c: { d: { e: { f: { g: 1 } } } } } } }).keys()]).toEqual([
      'a.b.c.d.e.f',
    ]);
  });

  it('diffSnapshots：标量与结构化字段的 同/改/增/删 四态', () => {
    const rows = diffSnapshots(
      { label: 'v1', fields: { ast: { op: 'gt', right: 1000 }, required_inputs: ['amount'] } },
      {
        label: 'v2',
        fields: {
          ast: { op: 'gt', right: 5000, note: 'x' },
          required_inputs: ['amount', 'currency'],
        },
      },
      RULE_VERSION_FIELDS,
    );
    expect(rows.map((row) => [row.label, row.state])).toEqual([
      ['规则表达式 · op', 'same'],
      ['规则表达式 · right', 'changed'],
      ['规则表达式 · note', 'added'],
      ['必需输入[0]', 'same'],
      ['必需输入[1]', 'added'],
    ]);
  });

  it('pairFromRow：取行内嵌 versions[] 末两项（按版本号排序）；单版本无上一版；无版本返回 null', () => {
    const pair = pairFromRow(
      { id: 'nd-1', version: 2, versions: [...numberVersions].reverse() },
      NUMBERING_VERSION_FIELDS,
    );
    expect(pair?.current.label).toBe('v2');
    expect(pair?.previous?.label).toBe('v1');
    expect(pair?.current.fields.padding).toBe(6);
    expect(pair?.previous?.fields.padding).toBe(4);
    expect(
      pairFromRow({ versions: [numberVersions[0]] }, NUMBERING_VERSION_FIELDS)?.previous,
    ).toBeNull();
    expect(pairFromRow({ id: 'nd-1' }, NUMBERING_VERSION_FIELDS)).toBeNull();
  });
});

describe('GOV-UX ④ 配置页版本对比', () => {
  it('编号规则：查看行即在抽屉并排对比 v1 → v2，默认仅显示差异，可切换显示全部', async () => {
    const host = cfgMount('governance/numbering', {
      '/api/v1/number-definitions': [
        { id: 'nd-1', code: 'QUOTE_NO', version: 2, versions: numberVersions },
      ],
    });
    const compare = await openFirstRow(host);
    expect(compare?.textContent).toContain('v1');
    expect(compare?.textContent).toContain('v2');
    // 前缀/数字位数/起始值/状态/发布时间 五项变化；后缀/步长/重置周期 三项未变（默认折叠）。
    expect(compare?.querySelectorAll('tr[data-state="changed"]').length).toBe(5);
    expect(compare?.querySelectorAll('tbody tr').length).toBe(5);
    expect(compare?.textContent).toContain('变更 5');
    expect(compare?.textContent).not.toContain('步长');
    element(compare?.querySelector('[data-testid="kt-cfg-version-all"]')).click();
    await flush();
    expect(compare?.querySelectorAll('tbody tr').length).toBe(8);
  });

  it('业务规则：AST/必需输入按叶子路径高亮改与增；首个版本如实提示无可对比上一版本', async () => {
    const host = cfgMount('governance/rules', {
      '/api/v1/rules': [
        {
          id: 'ru-1',
          code: 'CREDIT_HOLD',
          version: 2,
          versions: [
            {
              version: 1,
              ast: { op: 'gt', left: 'amount', right: 1000 },
              required_inputs: ['amount'],
            },
            {
              version: 2,
              ast: { op: 'gt', left: 'amount', right: 5000 },
              required_inputs: ['amount', 'currency'],
            },
          ],
        },
      ],
    });
    const compare = await openFirstRow(host);
    // 差异行两个单元格：上一版本列 → 当前版本列。
    const changedCells = compare?.querySelectorAll('tr[data-state="changed"] td');
    expect(changedCells?.[0]?.textContent).toBe('1000');
    expect(changedCells?.[1]?.textContent).toBe('5000');
    expect(compare?.querySelector('td[data-diff="added"]')?.textContent).toContain('currency');
    expect(compare?.textContent).toContain('规则表达式 · right');
    const first = cfgMount('governance/rules', {
      '/api/v1/rules': [
        {
          id: 'ru-2',
          code: 'A',
          version: 1,
          versions: [{ version: 1, ast: { op: 'gt' }, required_inputs: [] }],
        },
      ],
    });
    expect((await openFirstRow(first))?.textContent).toContain('首个版本');
  });

  it('主数据条目：经 GET /master-data/entries/{id}?at= 取上一生效版本；首版本不发请求；读取失败如实提示', async () => {
    const entry = (version: number) => ({
      id: 'en-1',
      code: 'COLOR-RED',
      label: '红色',
      value: { hex: '#f00' },
      version,
      effective_from: '2026-06-01T00:00:00.000Z',
      effective_to: null,
    });
    const fetchRecord = vi.fn().mockResolvedValue({
      label: '红',
      value: { hex: '#ff0000' },
      effective_from: '2026-01-01T00:00:00.000Z',
    });
    const host = cfgMount(
      'governance/master-data',
      { '/api/v1/master-data/entries': [entry(3)] },
      { fetchRecord },
    );
    const compare = await openFirstRow(host);
    expect(fetchRecord).toHaveBeenCalledExactlyOnceWith('/api/v1/master-data/entries/en-1', {
      at: '2026-05-31T23:59:59.999Z',
    });
    const changedCells = compare?.querySelectorAll('tr[data-state="changed"] td');
    expect(changedCells?.[0]?.textContent).toBe('红');
    expect(changedCells?.[1]?.textContent).toBe('红色');
    expect(compare?.textContent).toContain('#ff0000');
    const first = cfgMount(
      'governance/master-data',
      { '/api/v1/master-data/entries': [entry(1)] },
      { fetchRecord },
    );
    fetchRecord.mockClear();
    expect((await openFirstRow(first))?.textContent).toContain('首个版本');
    expect(fetchRecord).not.toHaveBeenCalled();
    const failing = cfgMount(
      'governance/master-data',
      { '/api/v1/master-data/entries': [entry(2)] },
      { fetchRecord: vi.fn().mockRejectedValue(new Error('网络异常')) },
    );
    const failed = await openFirstRow(failing);
    expect(failed?.querySelector('[role="alert"]')?.textContent).toContain('上一版本读取失败');
  });
});

const profileOf = (
  employeeId: string,
  displayName: string,
  roles: readonly { id: string; code: string; name: string }[],
  capabilities: readonly string[],
) => ({
  employeeId,
  employeeNumber: employeeId.toUpperCase(),
  displayName,
  loginName: employeeId,
  identityId: `i-${employeeId}`,
  identityActive: true,
  employeeActive: true,
  activeSessionCount: 1,
  roles,
  capabilities,
  directScopes: [],
});
const matrixProfiles = [
  profileOf(
    'e-1',
    '王小明',
    [{ id: 'r-1', code: 'KT_SALES', name: '销售' }],
    ['customer:read', 'quote:read'],
  ),
  profileOf(
    'e-2',
    '李四',
    [{ id: 'r-2', code: 'KT_OPS', name: '运营' }],
    ['customer:read', 'order:read'],
  ),
  profileOf('e-3', '张三', [], []),
];
const matrixRoles = [
  { id: 'r-1', code: 'KT_SALES', name: '销售' },
  { id: 'r-2', code: 'KT_OPS', name: '运营' },
  { id: 'r-3', code: 'KT_FINANCE', name: '财务' },
];
const matrixPermissions = [
  { id: 'p-1', capability: 'customer:read' },
  { id: 'p-2', capability: 'quote:read' },
  { id: 'p-3', capability: 'order:read' },
  { id: 'p-4', capability: 'finance:read' },
];
const matrixGrants = [
  { roleId: 'r-1', permissionId: 'p-1' },
  { roleId: 'r-1', permissionId: 'p-2' },
  { roleId: 'r-2', permissionId: 'p-1' },
  { roleId: 'r-2', permissionId: 'p-3' },
  { roleId: 'r-3', permissionId: 'p-4' },
];
const matrixViews = {
  '/api/v1/user-access-profiles': matrixProfiles,
  '/api/v1/roles': matrixRoles,
  '/api/v1/permissions': matrixPermissions,
  '/api/v1/grants': matrixGrants,
};
const matrixPorts = (overrides: Partial<ConsolePorts> = {}): ConsolePorts =>
  portsFor('governance/identity', matrixViews, ['role-assignment:manage'], overrides);

const openMatrix = async (
  overrides: Partial<ConsolePorts> = {},
): Promise<Readonly<{ host: TestElement; ports: ConsolePorts }>> => {
  const ports = matrixPorts(overrides);
  const host = mount(IdentityConsolePage, ports);
  element(q(host, '[data-testid="kt-identity-open"]')).click();
  await flush();
  return { host, ports };
};
const cell = (host: TestElement, attrs: Readonly<Record<string, string>>): TestElement | null => {
  const selector = Object.entries(attrs)
    .map(([name, value]) => `[${name}="${value}"]`)
    .join('');
  return q(host, `[data-testid="kt-matrix-cell"]${selector}`);
};
const mark = (host: TestElement, attrs: Readonly<Record<string, string>>): TestElement | null => {
  const selector = Object.entries(attrs)
    .map(([name, value]) => `[${name}="${value}"]`)
    .join('');
  return q(host, `[data-testid="kt-matrix-mark"]${selector}`);
};

describe('GOV-UX ① 用户 360 抽屉角色矩阵（按角色）', () => {
  it('抽屉内呈现 用户×角色 交叉表；已有角色为勾选态，当前用户行高亮', async () => {
    const { host } = await openMatrix();
    const matrix = q(host, '[data-testid="kt-identity-matrix"]');
    expect(matrix).not.toBeNull();
    // 角色列按编码排序（与服务端 roles 列表 code ASC 口径一致）。
    const headers = matrix?.querySelectorAll('thead th');
    expect(headers?.map((node) => node.textContent)).toEqual([
      '用户',
      'KT_FINANCE',
      'KT_OPS',
      'KT_SALES',
    ]);
    expect(
      cell(host, { 'data-employee': 'e-1', 'data-role': 'r-1' })?.getAttribute('aria-checked'),
    ).toBe('true');
    expect(
      cell(host, { 'data-employee': 'e-1', 'data-role': 'r-2' })?.getAttribute('aria-checked'),
    ).toBe('false');
    expect(q(host, 'tr.is-current')?.textContent).toContain('王小明');
  });

  it('勾选即分配（1 步，替代「分配角色」弹窗）：POST /api/v1/assignments 后刷新档案', async () => {
    // 刷新后服务端仍返回该用户 → 抽屉保持打开（启停/配置账号行级操作仍在）。
    const { host, ports } = await openMatrix({
      fetchPage: vi
        .fn()
        .mockImplementation((path: string) =>
          Promise.resolve(
            path === '/api/v1/user-access-profiles'
              ? { items: matrixProfiles, nextCursor: null }
              : { items: [], nextCursor: null },
          ),
        ),
    });
    cell(host, { 'data-employee': 'e-1', 'data-role': 'r-2' })?.click();
    await flush();
    expect(ports.submit).toHaveBeenCalledExactlyOnceWith(
      '/api/v1/assignments',
      { employeeId: 'e-1', roleId: 'r-2' },
      'POST',
    );
    expect(ports.fetchPage).toHaveBeenCalledWith('/api/v1/user-access-profiles');
    expect(q(host, '[data-testid="kt-identity-action-assign"]')).toBeNull();
    expect(q(host, '[data-testid="kt-identity-action-revoke"]')).toBeNull();
    expect(q(host, '[data-testid="kt-identity-summary"]')).not.toBeNull();
    expect(q(host, '[data-testid="kt-identity-matrix"]')).not.toBeNull();
  });

  it('取消勾选不直接撤销：内联确认列出连带失去的权限，确认后 DELETE，取消则不发请求', async () => {
    const { host, ports } = await openMatrix();
    cell(host, { 'data-employee': 'e-1', 'data-role': 'r-1' })?.click();
    await flush();
    expect(ports.submit).not.toHaveBeenCalled();
    const confirm = q(host, '[data-testid="kt-matrix-confirm"]');
    expect(confirm?.textContent).toContain('KT_SALES');
    expect(confirm?.textContent).toContain('quote:read');
    element(q(host, '[data-testid="kt-matrix-confirm-cancel"]')).click();
    await flush();
    expect(q(host, '[data-testid="kt-matrix-confirm"]')).toBeNull();
    expect(ports.submit).not.toHaveBeenCalled();
    cell(host, { 'data-employee': 'e-1', 'data-role': 'r-1' })?.click();
    await flush();
    element(q(host, '[data-testid="kt-matrix-confirm-ok"]')).click();
    await flush();
    expect(ports.submit).toHaveBeenCalledExactlyOnceWith(
      '/api/v1/assignments',
      { employeeId: 'e-1', roleId: 'r-1' },
      'DELETE',
    );
  });

  it('职责冲突（SoD）被服务端拒绝时如实提示并保持勾选态', async () => {
    const { host } = await openMatrix({
      submit: vi
        .fn()
        .mockRejectedValue(new Error('Role assignment violates segregation of duties')),
    });
    cell(host, { 'data-employee': 'e-3', 'data-role': 'r-2' })?.click();
    await flush();
    expect(q(host, '[data-testid="kt-matrix-error"]')?.textContent).toContain(
      'segregation of duties',
    );
    expect(
      cell(host, { 'data-employee': 'e-3', 'data-role': 'r-2' })?.getAttribute('aria-checked'),
    ).toBe('false');
  });

  it('无角色指派权限时矩阵只读（勾选框不出现，不发起写请求）', async () => {
    const ports = portsFor('governance/identity', matrixViews);
    const host = mount(IdentityConsolePage, ports);
    element(q(host, '[data-testid="kt-identity-open"]')).click();
    await flush();
    expect(cell(host, { 'data-employee': 'e-1', 'data-role': 'r-2' })).toBeNull();
    expect(
      mark(host, { 'data-employee': 'e-1', 'data-role': 'r-1' })?.getAttribute('data-state'),
    ).toBe('on');
    expect(ports.submit).not.toHaveBeenCalled();
  });

  it('搜索按角色编码过滤列，「仅看当前用户」把行收敛到抽屉用户', async () => {
    const { host } = await openMatrix();
    const query = element(q(host, '[data-testid="kt-matrix-query"]'));
    query.value = 'FIN';
    query.dispatchEvent(new Event('input', { bubbles: true }));
    await flush();
    const headers = host.querySelectorAll('[data-testid="kt-matrix-role"] thead th');
    expect(headers.map((node) => node.textContent)).toEqual(['用户', 'KT_FINANCE']);
    expect(q(host, '[data-testid="kt-matrix-role"]')?.textContent).toContain('无匹配用户');
    query.value = '';
    query.dispatchEvent(new Event('input', { bubbles: true }));
    await flush();
    expect(host.querySelectorAll('[data-testid="kt-matrix-role"] tbody tr').length).toBe(3);
    element(q(host, '[data-testid="kt-matrix-focus"]')).click();
    await flush();
    const focused = host.querySelectorAll('[data-testid="kt-matrix-role"] tbody tr');
    expect(focused.length).toBe(1);
    expect(focused[0]?.textContent).toContain('王小明');
  });
});

describe('GOV-UX ① 用户 360 抽屉角色矩阵（按权限点）', () => {
  it('用户×权限点交叉表按资源分组；唯一角色来源处可直接勾选授予', async () => {
    const { host, ports } = await openMatrix();
    element(q(host, '[data-testid="kt-matrix-lens-permission"]')).click();
    await flush();
    const groups = host.querySelectorAll('[data-testid="kt-matrix-permission"] .gov-matrix-group');
    expect(groups.map((node) => node.textContent)).toEqual([
      'customer',
      'finance',
      'order',
      'quote',
    ]);
    // 王小明 缺 order:read；仅 KT_OPS 授予 → 可直接勾选（= 分配 KT_OPS）。
    const grantable = cell(host, { 'data-employee': 'e-1', 'data-capability': 'order:read' });
    expect(grantable?.getAttribute('aria-checked')).toBe('false');
    grantable?.click();
    await flush();
    expect(ports.submit).toHaveBeenCalledExactlyOnceWith(
      '/api/v1/assignments',
      { employeeId: 'e-1', roleId: 'r-2' },
      'POST',
    );
  });

  it('多角色来源处如实只读并说明原因；撤销仍走内联确认并列出连带权限', async () => {
    const { host, ports } = await openMatrix();
    element(q(host, '[data-testid="kt-matrix-lens-permission"]')).click();
    await flush();
    const shared = mark(host, { 'data-employee': 'e-3', 'data-capability': 'customer:read' });
    expect(shared?.getAttribute('title')).toContain('KT_OPS');
    shared?.click();
    await flush();
    expect(ports.submit).not.toHaveBeenCalled();
    cell(host, { 'data-employee': 'e-1', 'data-capability': 'customer:read' })?.click();
    await flush();
    expect(q(host, '[data-testid="kt-matrix-confirm"]')?.textContent).toContain('quote:read');
    element(q(host, '[data-testid="kt-matrix-confirm-ok"]')).click();
    await flush();
    expect(ports.submit).toHaveBeenCalledExactlyOnceWith(
      '/api/v1/assignments',
      { employeeId: 'e-1', roleId: 'r-1' },
      'DELETE',
    );
  });

  it('角色授权清单读不到时权限点视图降级为只读交叉表并提示；按角色视图仍可管理', async () => {
    const { host, ports } = await openMatrix({
      viewError: (path) => (path === '/api/v1/grants' ? '需要 role:read 权限' : undefined),
      loaded: (path) => path !== '/api/v1/grants',
    });
    element(q(host, '[data-testid="kt-matrix-lens-permission"]')).click();
    await flush();
    expect(q(host, '[data-testid="kt-matrix-hint"]')?.textContent).toContain('权限点来源不可用');
    expect(cell(host, { 'data-employee': 'e-1', 'data-capability': 'order:read' })).toBeNull();
    expect(
      mark(host, { 'data-employee': 'e-1', 'data-capability': 'quote:read' })?.getAttribute(
        'data-state',
      ),
    ).toBe('on');
    element(q(host, '[data-testid="kt-matrix-lens-role"]')).click();
    await flush();
    cell(host, { 'data-employee': 'e-1', 'data-role': 'r-3' })?.click();
    await flush();
    expect(ports.submit).toHaveBeenCalledWith(
      '/api/v1/assignments',
      { employeeId: 'e-1', roleId: 'r-3' },
      'POST',
    );
  });
});

const dashboardViews = (): readonly GovernanceView[] => [
  { path: '/api/v1/audit-events', value: null, error: '403 Forbidden' },
  { path: '/api/v1/workflow-tasks', value: [{ state: 'OPEN' }, { state: 'COMPLETED' }] },
  { path: '/api/v1/notifications/unread-count', value: { unreadCount: 3 } },
];

describe('GOV-UX ⑤ 概览仪表盘', () => {
  it('dashboardModel：四项指标口径与原标题逐项一致；异常清单按子页可见性给出钻取去向', () => {
    const visible = visibleGovernanceSurfaces(
      new Set(['audit:read', 'workflow:read', 'notification:read']),
    );
    const model = dashboardModel(dashboardViews(), visible);
    expect(dashboardMetrics(model)).toEqual([
      { label: '治理模块', value: '3' },
      { label: '业务记录', value: '3' },
      { label: '待审批任务', value: '1' },
      { label: '未读 / 异常', value: '3 / 1' },
    ]);
    expect(model.alerts.map((alert) => [alert.id, alert.links.map((link) => link.route)])).toEqual([
      ['failed', ['governance/audit']],
      ['pending', ['governance/workflow']],
      ['unread', ['governance/notifications']],
    ]);
    // 子页对当前账号不可见时不给出去向（不产生无权限路由链接）。
    const partial = dashboardModel(
      dashboardViews(),
      visibleGovernanceSurfaces(new Set(['audit:read'])),
    );
    expect(partial.alerts.map((alert) => alert.id)).toEqual(['failed']);
    expect(dashboardModel([], visible).alerts).toEqual([]);
  });

  it('模块卡片带原生钻取锚点指向对应子页；数据源读取异常的卡片出现醒目异常徽章', () => {
    installGlobalTestDom();
    const controller = new GovernanceController(
      new Set(['audit:read', 'workflow:read', 'master-data:read', 'authorization:read']),
      sessionFixture(),
    );
    controller.views = dashboardViews();
    const workspace = createGovernanceWorkspace({
      replaceRouteView: () => undefined,
    })(controller) as unknown as TestElement;
    expect(workspace.getAttribute('data-route-view')).toBe('governance');
    // 异常卡片按既有优先级排最前（audit → workflow → identity → master-data）。
    const links = workspace.querySelectorAll('a.gov-card-link');
    expect(links.map((link) => (link as TestElement).getAttribute('href'))).toEqual([
      '#/governance/audit',
      '#/governance/workflow',
      '#/governance/identity',
      '#/governance/master-data',
    ]);
    expect(el(links[0])?.getAttribute('aria-label')).toBe('进入审计中心');
    const anomalies = workspace.querySelectorAll('[data-testid="kt-gov-card-anomaly"]');
    expect(anomalies.map((node) => node.textContent)).toEqual(['1 个异常']);
    // vanilla 指标基线保持（同源模型）：四项指标文本不变。
    const strongs = workspace.querySelectorAll('.governance-metrics strong');
    expect(strongs.map((node) => node.textContent)).toEqual(['4', '3', '1', '3 / 1']);
    expect(workspace.textContent).toContain('下一步：');
  });

  it('Preact 仪表盘：异常提示条可点击跳到对应子页；指标卡四项口径与顺序不变，可钻取的为链接', () => {
    const ports = portsFor('governance', {}, [], {
      views: () => dashboardViews(),
      permissions: new Set(['audit:read', 'workflow:read', 'notification:read']),
    });
    const host = mount((p) => OverviewDashboard(p), ports);
    const alerts = q(host, '[data-testid="kt-gov-alerts"]');
    expect(alerts?.textContent).toContain('1 个数据源读取异常');
    expect(alerts?.textContent).toContain('1 个待审批任务');
    expect(alerts?.textContent).toContain('3 条未读通知');
    expect(
      host
        .querySelectorAll('[data-testid="kt-gov-alert-link"]')
        .map((node) => (node as TestElement).getAttribute('href')),
    ).toEqual(['#/governance/audit', '#/governance/workflow', '#/governance/notifications']);
    const kpis = host.querySelectorAll('[data-testid="kt-gov-kpi"]');
    expect(kpis.map((node) => node.querySelector('strong')?.textContent)).toEqual([
      '3',
      '3',
      '1',
      '3 / 1',
    ]);
    expect(kpis.map((node) => (node as TestElement).getAttribute('href'))).toEqual([
      null,
      null,
      '#/governance/workflow',
      '#/governance/notifications',
    ]);
    expect(el(kpis[2])?.getAttribute('data-tone')).toBe('warning');
    expect(el(kpis[3])?.getAttribute('data-tone')).toBe('danger');
  });

  it('无异常时提示条为运行正常；子页不可见时指标卡不渲染为链接', () => {
    const ports = portsFor('governance', {}, [], {
      views: () => dashboardViews().slice(1),
      permissions: new Set(['audit:read']),
    });
    const host = mount((p) => OverviewDashboard(p), ports);
    expect(q(host, '[data-testid="kt-gov-alerts"]')?.textContent).toContain('运行正常');
    const kpis = host.querySelectorAll('[data-testid="kt-gov-kpi"]');
    expect(kpis.map((node) => (node as TestElement).getAttribute('href'))).toEqual([
      null,
      null,
      null,
      null,
    ]);
    expect(el(kpis[2])?.getAttribute('data-tone')).toBe('warning');
    expect(el(kpis[3])?.getAttribute('data-tone')).toBe('warning');
  });

  it('mountGovernanceDashboard 以组件化仪表盘替换宿主内既有 vanilla 指标；未接入文档的宿主不升级', async () => {
    const document = installGlobalTestDom().document;
    const controller = new GovernanceController(new Set(['audit:read']), sessionFixture());
    const host = document.createElement('section');
    const legacy = document.createElement('article');
    legacy.setAttribute('data-legacy', 'vanilla-metric');
    host.append(legacy);
    mountGovernanceDashboard(host as unknown as HTMLElement, controller);
    expect(q(host, '[data-legacy="vanilla-metric"]')).toBeNull();
    expect(host.querySelectorAll('[data-testid="kt-gov-kpi"]').length).toBe(4);
    expect(q(host, '[data-testid="kt-gov-alerts"]')).not.toBeNull();
    const workspace = createGovernanceWorkspace({
      replaceRouteView: () => undefined,
    })(controller) as unknown as TestElement;
    await flush();
    expect(workspace.querySelector('.governance-metrics article')).not.toBeNull();
  });
});
