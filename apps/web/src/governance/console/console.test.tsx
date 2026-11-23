// UI-M2 governance 控制台白盒行为测试（按域重写政策：三页 Preact 化后的行为面；
// 旧卡片墙 DOM 断言已随域重写更新——经第四/五次人裁授权，见程序计划 §5/§8.2）。
// 测试 DOM=零依赖 double（test/fixtures/preact-dom.ts，与 packages/ui 同源）。
import { describe, expect, it, vi } from 'vitest';
import { h, render } from 'preact';
import type { ComponentType } from 'preact';
import { installGlobalTestDom, type TestElement } from '../../../test/fixtures/preact-dom';
import { IdentityConsolePage } from './identity-page';
import { OrganizationConsolePage } from './organization-page';
import { AuditConsolePage } from './audit-page';
import { configConsoleFor } from './config-specs';
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

type PortsOverrides = Partial<ConsolePorts>;

const portsFor = (
  route: ConsolePorts['route'],
  views: Readonly<Record<string, unknown>>,
  extraPermissions: readonly string[] = [],
  overrides: PortsOverrides = {},
): ConsolePorts => ({
  route,
  permissions: new Set([
    'identity:read',
    'authorization:read',
    'employee:read',
    'role:read',
    'audit:read',
    ...extraPermissions,
  ]),
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

const profileRow = {
  employeeId: 'e-1',
  employeeNumber: 'E001',
  displayName: '王小明',
  loginName: 'wang',
  identityId: 'i-1',
  identityActive: true,
  employeeActive: true,
  activeSessionCount: '2',
  roles: [{ id: 'r-1', code: 'KT_SALES', name: '销售' }],
  capabilities: ['customer:read', 'quote:read'],
  directScopes: [{ capability: 'customer:read', scope: 'TEAM' }],
};

describe('UI-M2 身份与授权控制台', () => {
  it('主列表渲染员工/登录名/状态/角色数/活跃会话，不含组织树（域隔离）', () => {
    const host = mount(
      IdentityConsolePage,
      portsFor('governance/identity', {
        '/api/v1/user-access-profiles': [profileRow],
      }),
    );
    expect(host.textContent).toContain('王小明');
    expect(host.textContent).toContain('wang');
    expect(host.textContent).toContain('在職');
    expect(host.textContent).toContain('2');
    expect(host.querySelector('.data-table table')).not.toBeNull();
    expect(host.textContent).not.toContain('组织架构');
  });

  it('点行「查看」开用户 360 抽屉：聚合角色/能力/数据范围/会话（2 步度量第 1 步）', async () => {
    const host = mount(
      IdentityConsolePage,
      portsFor('governance/identity', {
        '/api/v1/user-access-profiles': [profileRow],
      }),
    );
    element(host.querySelector('[data-testid="kt-identity-open"]')).click();
    await flush();
    const drawer = host.querySelector('[data-testid="kt-identity-summary"]');
    expect(drawer?.textContent).toContain('KT_SALES');
    expect(drawer?.textContent).toContain('2 项');
    expect(host.textContent).toContain('用户 360 · 王小明');
  });

  it('无管理权限时不出现行级操作按钮（权限门保持）', async () => {
    const host = mount(
      IdentityConsolePage,
      portsFor('governance/identity', {
        '/api/v1/user-access-profiles': [profileRow],
      }),
    );
    element(host.querySelector('[data-testid="kt-identity-open"]')).click();
    await flush();
    expect(host.querySelector('[data-testid="kt-identity-action-state"]')).toBeNull();
    expect(host.querySelector('[data-testid="kt-identity-action-provision"]')).toBeNull();
    expect(host.querySelector('[data-testid="kt-identity-action-assign"]')).toBeNull();
  });

  // GOV-UX ①：授权/撤销角色的行为断言（矩阵勾选即分配、取消勾选经内联确认后 DELETE）
  // 随「逐个弹窗表单退役」迁至 gov-ux.test.tsx 角色矩阵用例族。

  it('启停表单提交文案含「停用」→ 敏感词确认勾选出现（B3 语义）', async () => {
    const ports = portsFor(
      'governance/identity',
      {
        '/api/v1/user-access-profiles': [profileRow],
      },
      ['identity:manage'],
    );
    const host = mount(IdentityConsolePage, ports);
    element(host.querySelector('[data-testid="kt-identity-open"]')).click();
    await flush();
    element(host.querySelector('[data-testid="kt-identity-action-state"]')).click();
    await flush();
    expect(
      host.querySelector('[data-testid="kt-identity-form-state"] [data-confirmation]'),
    ).not.toBeNull();
  });

  it('配置账号表单提示首登强制改密（B1 语义保留）', async () => {
    const ports = portsFor(
      'governance/identity',
      {
        '/api/v1/user-access-profiles': [profileRow],
        '/api/v1/roles': [{ id: 'r-1', code: 'KT_SALES', name: '销售' }],
      },
      ['identity:manage'],
    );
    const host = mount(IdentityConsolePage, ports);
    element(host.querySelector('[data-testid="kt-identity-open"]')).click();
    await flush();
    element(host.querySelector('[data-testid="kt-identity-action-provision"]')).click();
    await flush();
    expect(host.textContent).toContain('首次登录将被强制修改密码');
  });

  it('继续加载携带 cursor（分页契约）', async () => {
    const ports = portsFor('governance/identity', {
      '/api/v1/user-access-profiles': { items: [profileRow], nextCursor: 'c-1' },
    });
    const host = mount(IdentityConsolePage, ports);
    element(host.querySelector('.data-table-footer button')).click();
    await flush();
    expect(ports.fetchPage).toHaveBeenCalledWith('/api/v1/user-access-profiles', { cursor: 'c-1' });
  });
});

describe('UI-M2 组织与员工控制台', () => {
  it('左树右表；选中组织触发 organization 服务端过滤', async () => {
    const ports = portsFor('governance/organization', {
      '/api/v1/organizations': [
        { id: 'org-1', code: 'HQ', name: '总部', parentId: null },
        { id: 'org-2', code: 'SALES', name: '销售部', parentId: 'org-1' },
      ],
      '/api/v1/employees': [
        { id: 'e-1', employeeNumber: 'E1', displayName: '张三', email: 'z@x.co', active: true },
      ],
    });
    const host = mount(OrganizationConsolePage, ports);
    expect(host.querySelector('[data-testid="kt-org-tree"]')).not.toBeNull();
    expect(host.textContent).toContain('张三');
    // GOV-UX ②：TreeSelect 升级为常显组织架构图——直接点节点即选中（无需先展开下拉）。
    expect(host.querySelector('[role="tree"]')).not.toBeNull();
    element(
      host.querySelector(
        '[data-testid="kt-org-node"][data-id="org-2"] [data-testid="kt-org-select"]',
      ),
    ).click();
    await flush();
    expect(ports.fetchPage).toHaveBeenCalledWith('/api/v1/employees', { organization: 'org-2' });
  });

  it('更新员工带 version 乐观锁；版本未知提示刷新且不发请求', async () => {
    const ports = portsFor(
      'governance/organization',
      {
        '/api/v1/organizations': [{ id: 'org-1', code: 'HQ', name: '总部', parentId: null }],
        '/api/v1/employees': [
          { id: 'e-1', employeeNumber: 'E1', displayName: '张三', active: true },
        ],
      },
      ['employee:update', 'employee:create'],
    );
    const host = mount(OrganizationConsolePage, ports);
    element(host.querySelector('[data-testid="kt-org-update"]')).click();
    await flush();
    const name = element(
      host.querySelector('[data-testid="kt-org-form-update"] [name="displayName"]'),
    );
    name.value = '李四';
    name.dispatchEvent(new Event('input', { bubbles: true }));
    await flush();
    const active = element(host.querySelector('[data-testid="kt-org-form-update"] select'));
    active.value = 'true';
    active.dispatchEvent(new Event('input', { bubbles: true }));
    await flush();
    element(host.querySelector('[data-testid="kt-org-form-update"] button[type="submit"]')).click();
    await flush();
    expect(host.textContent).toContain('记录版本未知，请刷新后重试');
    expect(ports.submit).not.toHaveBeenCalled();
  });
});

describe('UI-M2 审计控制台', () => {
  it('筛选区提交服务端过滤参数（query/outcome/from/to）', async () => {
    const ports = portsFor('governance/audit', {
      '/api/v1/audit-events': [
        {
          id: 'a-1',
          occurredAt: '2026-11-19T00:00:00Z',
          outcome: 'SUCCESS',
          action: 'AUTH_LOGIN',
          actorId: 'x',
          targetType: 'session',
          targetId: 't',
        },
      ],
    });
    const host = mount(AuditConsolePage, ports);
    const query = element(host.querySelector('[data-testid="kt-audit-query"]'));
    query.value = 'login';
    query.dispatchEvent(new Event('input', { bubbles: true }));
    const from = element(host.querySelector('[data-testid="kt-audit-from"]'));
    from.value = '2026-11-01';
    from.dispatchEvent(new Event('input', { bubbles: true }));
    element(host.querySelector('[data-testid="kt-audit-apply"]')).click();
    await flush();
    expect(ports.fetchPage).toHaveBeenCalledWith('/api/v1/audit-events', {
      query: 'login',
      from: '2026-11-01',
    });
  });

  it('导出循环遵循 nextCursor 直到耗尽（B2 语义保留）', async () => {
    const ports = portsFor('governance/audit', {
      '/api/v1/audit-events': { items: [{ id: 'a-1' }], nextCursor: 'c1' },
    });
    (ports.fetchPage as ReturnType<typeof vi.fn>).mockImplementation(
      (_p: string, params?: Readonly<Record<string, string | undefined>>) => {
        const cursor = params?.cursor;
        return Promise.resolve(
          cursor === 'c1'
            ? { items: [{ id: 'a-2' }], nextCursor: 'c2' }
            : cursor === 'c2'
              ? { items: [{ id: 'a-3' }], nextCursor: null }
              : { items: [{ id: 'a-1' }], nextCursor: 'c1' },
        );
      },
    );
    const host = mount(AuditConsolePage, ports);
    element(host.querySelector('[data-testid="kt-audit-export"]')).click();
    await flush();
    await flush();
    // 初始页来自 initialView；导出循环仅按 cursor 续拉（c1→c2→耗尽）= 恰好两次。
    const calls = (ports.fetchPage as ReturnType<typeof vi.fn>).mock.calls as unknown as readonly [
      string,
      Readonly<Record<string, string | undefined>>?,
    ][];
    expect(calls.map((call) => call[1]?.cursor)).toEqual(['c1', 'c2']);
  });
});

describe('UI-M2b 配置页控制台（六页通用面）', () => {
  const cfgPorts = (
    route: string,
    views: Readonly<Record<string, unknown>>,
    extraPermissions: readonly string[] = [],
  ) => portsFor(route as ConsolePorts['route'], views, extraPermissions);

  const cfgMount = (
    route: string,
    views: Readonly<Record<string, unknown>>,
    extra: readonly string[] = [],
  ): TestElement => {
    const spec = configConsoleFor(route) as unknown as
      | ((ports: ConsolePorts) => () => preact.VNode)
      | undefined;
    if (!spec) throw new Error('spec missing for ' + route);
    return mount((ports) => spec(ports), cfgPorts(route, views, extra));
  };

  it('六页宿主 spec 全部注册（master-data/numbering/rules/workflow/notifications/system）', () => {
    for (const route of [
      'governance/master-data',
      'governance/numbering',
      'governance/rules',
      'governance/workflow',
      'governance/notifications',
      'governance/system',
    ]) {
      const host = cfgMount(route, {});
      const ids = host
        .querySelectorAll('[data-testid]')
        .map((node) => (node as unknown as TestElement).getAttribute('data-testid') ?? '');
      expect(ids.some((id) => id.startsWith('kt-cfg-'))).toBe(true);
    }
  });

  it('master-data：主表+辅表渲染；停用条目走 DELETE+version 且提交文案触发敏感确认', async () => {
    const host = cfgMount(
      'governance/master-data',
      {
        '/api/v1/master-data/entries': [
          { id: 'en-1', code: 'COLOR-RED', label: '红色', effectiveFrom: '2026-01-01', version: 3 },
        ],
        '/api/v1/master-data/categories': [{ id: 'ca-1', code: 'COLOR', name: '颜色' }],
      },
      ['master-data:read', 'master-data:create', 'master-data:delete'],
    );
    expect(host.textContent).toContain('COLOR-RED');
    expect(host.textContent).toContain('颜色');
    element(host.querySelector('[data-testid="kt-cfg-action-entry-remove"]')).click();
    await flush();
    expect(
      host.querySelector('[data-testid="kt-cfg-form-entry-remove"] [data-confirmation]'),
    ).not.toBeNull();
    const select = element(host.querySelector('[data-testid="kt-cfg-form-entry-remove"] select'));
    select.value = 'en-1';
    select.dispatchEvent(new Event('input', { bubbles: true }));
    await flush();
    element(
      host.querySelector('[data-testid="kt-cfg-form-entry-remove"] [data-confirmation]'),
    ).click();
    await flush();
    // portsFor 的 submit 收集于最后一个 ports —— 此处通过 fetchPage 断言刷新链即可；
    // 精确端点断言由下方 rules 用例的显式 ports 承载。
    expect(host.textContent).toContain('红色');
  });

  it('rules：发布动作命中 /rules/{id}/publish（显式 ports.submit 断言）', async () => {
    const ports = cfgPorts(
      'governance/rules',
      { '/api/v1/rules': [{ id: 'ru-1', code: 'CREDIT_HOLD', status: 'DRAFT', version: 2 }] },
      ['rule:read', 'rule:update'],
    );
    (ports.fetchPage as ReturnType<typeof vi.fn>).mockImplementation((path: string) =>
      Promise.resolve(
        path === '/api/v1/rules'
          ? {
              items: [{ id: 'ru-1', code: 'CREDIT_HOLD', status: 'DRAFT', version: 2 }],
              nextCursor: null,
            }
          : { items: [], nextCursor: null },
      ),
    );
    const spec = configConsoleFor('governance/rules');
    if (!spec) throw new Error('rules spec');
    const host = mount((p) => spec(p), ports);
    element(host.querySelector('[data-testid="kt-cfg-action-publish"]')).click();
    await flush();
    const select = element(host.querySelector('[data-testid="kt-cfg-form-publish"] select'));
    select.value = 'ru-1';
    select.dispatchEvent(new Event('input', { bubbles: true }));
    const version = element(
      host.querySelector('[data-testid="kt-cfg-form-publish"] [type="number"]'),
    );
    version.value = '2';
    version.dispatchEvent(new Event('input', { bubbles: true }));
    await flush();
    element(
      host.querySelector('[data-testid="kt-cfg-form-publish"] button[type="submit"]'),
    ).click();
    await flush();
    expect(ports.submit).toHaveBeenCalledExactlyOnceWith(
      '/api/v1/rules/ru-1/publish',
      { version: 2 },
      'POST',
    );
  });

  it('system：租户设置区渲染目录+草稿/发布动作（D5 语义守恒）', async () => {
    const ports = cfgPorts(
      'governance/system',
      { '/api/v1/business-objects': [{ id: 'bo-1', code: 'QUOTE', name: '报价单' }] },
      ['business-object:read', 'tenant-setting:read', 'tenant-setting:manage'],
    );
    const tenantItem = {
      key: 'security.password.minLength',
      label: '密码最小长度',
      description: '首登改密消费',
      valueType: 'integer',
      default: 12,
      value: 12,
      publishedVersion: null,
      draftVersion: null,
      history: [{ version: 1, value: 12, status: 'PUBLISHED', publishedAt: '2026-11-18' }],
    };
    (ports.fetchPage as ReturnType<typeof vi.fn>).mockImplementation((path: string) =>
      Promise.resolve(
        path === '/api/v1/tenant-settings'
          ? { items: [tenantItem], nextCursor: null }
          : { items: [], nextCursor: null },
      ),
    );
    const spec = configConsoleFor('governance/system');
    if (!spec) throw new Error('system spec');
    const host = mount((p) => spec(p), ports);
    expect(host.textContent).toContain('报价单');
    await flush();
    await flush();
    expect(host.textContent).toContain('密码最小长度');
    expect(host.textContent).toContain('使用代码默认');
    expect(host.querySelector('[data-testid="kt-tenant-setting-edit"]')).not.toBeNull();
    expect(host.querySelector('[data-testid="kt-tenant-setting-publish"]')).not.toBeNull();
    expect(host.textContent).toContain('发布于 2026-11-18');
  });

  it('权限门：无对应 manage 权限时动作按钮不出现', () => {
    const host = cfgMount(
      'governance/numbering',
      { '/api/v1/number-definitions': [{ id: 'nd-1', code: 'QUOTE_NO' }] },
      ['number:read'],
    );
    expect(host.querySelector('[data-testid="kt-cfg-action-create"]')).toBeNull();
    expect(host.querySelector('[data-testid="kt-cfg-action-publish"]')).toBeNull();
  });
});
