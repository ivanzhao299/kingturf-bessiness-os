import { randomBytes } from 'node:crypto';
import { expect, test, type APIRequestContext, type Browser } from '@playwright/test';

type RoleAccount = Readonly<{
  name: string;
  login: string;
  password: string;
  allowedRoutes: readonly string[];
  forbiddenRoutes: readonly string[];
  forbiddenActionNames?: readonly string[];
  forbiddenApiProbes?: readonly Readonly<{
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
    path: string;
    data?: Readonly<Record<string, unknown>>;
  }>[];
}>;
type RoleTemplate = Omit<RoleAccount, 'login' | 'password'> & Readonly<{ roleCode: string }>;

const rawAccounts = process.env.KINGTURF_ROLE_UAT_ACCOUNTS_JSON;
const configuredAccounts = rawAccounts ? (JSON.parse(rawAccounts) as readonly RoleAccount[]) : [];
const provisionTemporaryAccounts = process.env.KINGTURF_UAT_PROVISION === 'true';
const templates: readonly RoleTemplate[] = [
  {
    name: '报价编制专员',
    roleCode: 'KT_QUOTE_EDITOR',
    allowedRoutes: ['quotes'],
    forbiddenRoutes: ['production-orders', 'governance'],
  },
  {
    name: '应收会计',
    roleCode: 'KT_AR_ACCOUNTANT',
    allowedRoutes: ['receivables'],
    forbiddenRoutes: ['quality-inspection', 'governance'],
  },
  {
    name: '生产计划员',
    roleCode: 'KT_PRODUCTION_PLANNER',
    allowedRoutes: ['material-planning'],
    forbiddenRoutes: ['quotes', 'governance'],
  },
  {
    name: '质量检验员',
    roleCode: 'KT_QUALITY_INSPECTOR',
    allowedRoutes: ['quality-inspection'],
    forbiddenRoutes: ['receivables', 'governance'],
  },
  {
    name: '库存控制员',
    roleCode: 'KT_INVENTORY_CONTROLLER',
    allowedRoutes: ['procurement'],
    forbiddenRoutes: ['contracts', 'governance'],
  },
  {
    name: '采购专员',
    roleCode: 'KT_PROCUREMENT_BUYER',
    allowedRoutes: ['procurement'],
    forbiddenRoutes: ['receivables', 'governance'],
  },
  {
    name: '物流履约员',
    roleCode: 'KT_LOGISTICS_COORDINATOR',
    allowedRoutes: ['shipments'],
    forbiddenRoutes: ['quotes', 'governance'],
  },
  {
    name: '经营管理驾驶舱查看者',
    roleCode: 'KT_EXECUTIVE_VIEWER',
    // The executive viewer is intentionally cross-domain read-only. It must be able to
    // inspect commercial and manufacturing evidence while remaining outside governance.
    allowedRoutes: ['quotes', 'production-orders', 'quality-inspection'],
    forbiddenRoutes: ['governance'],
    forbiddenActionNames: ['＋ 新建报价', '＋ 新建生产工单'],
  },
  {
    name: '报价审批员',
    roleCode: 'KT_QUOTE_APPROVER',
    allowedRoutes: ['quotes'],
    forbiddenRoutes: ['production-orders', 'governance'],
    forbiddenActionNames: ['＋ 新建报价'],
  },
  {
    name: '系统审计员',
    roleCode: 'KT_SYSTEM_AUDITOR',
    allowedRoutes: ['contracts', 'production-orders', 'quality-inspection', 'governance'],
    forbiddenRoutes: ['customers', 'receivables'],
    forbiddenActionNames: ['＋ 新建生产工单'],
  },
  {
    name: '身份与权限管理员',
    roleCode: 'KT_IAM_ADMIN',
    allowedRoutes: ['governance'],
    forbiddenRoutes: ['quotes', 'production-orders'],
  },
  {
    name: '客诉登记员',
    roleCode: 'KT_COMPLAINT_REGISTRAR',
    allowedRoutes: ['quality-inspection'],
    forbiddenRoutes: ['receivables', 'governance'],
    forbiddenActionNames: ['批量分派', '发布处理时限', '关闭投诉'],
    forbiddenApiProbes: [{ method: 'POST', path: '/api/v1/complaints/batch-triage', data: {} }],
  },
  {
    name: '客诉协调员',
    roleCode: 'KT_COMPLAINT_COORDINATOR',
    allowedRoutes: ['quality-inspection'],
    forbiddenRoutes: ['receivables', 'governance'],
    forbiddenActionNames: ['＋ 登记投诉', '发布处理时限', '关闭投诉'],
    forbiddenApiProbes: [{ method: 'POST', path: '/api/v1/complaints', data: {} }],
  },
  {
    name: '质量调查员',
    roleCode: 'KT_QUALITY_INVESTIGATOR',
    allowedRoutes: ['quality-inspection'],
    forbiddenRoutes: ['receivables', 'governance'],
    forbiddenActionNames: ['＋ 登记投诉', '批量分派', '关闭投诉'],
    forbiddenApiProbes: [{ method: 'POST', path: '/api/v1/complaints/batch-triage', data: {} }],
  },
  {
    name: '质量经理',
    roleCode: 'KT_QUALITY_MANAGER',
    allowedRoutes: ['quality-inspection'],
    forbiddenRoutes: ['receivables', 'governance'],
    forbiddenActionNames: ['＋ 登记投诉', '批量分派'],
    forbiddenApiProbes: [{ method: 'POST', path: '/api/v1/complaints', data: {} }],
  },
  {
    name: '整改措施责任人',
    roleCode: 'KT_CAPA_OWNER',
    allowedRoutes: ['quality-inspection'],
    forbiddenRoutes: ['receivables', 'governance'],
    forbiddenActionNames: ['＋ 登记投诉', '批量分派', '关闭投诉'],
    forbiddenApiProbes: [{ method: 'POST', path: '/api/v1/complaint-sla-policies', data: {} }],
  },
  {
    name: '整改效果验证员',
    roleCode: 'KT_CAPA_VERIFIER',
    allowedRoutes: ['quality-inspection'],
    forbiddenRoutes: ['receivables', 'governance'],
    forbiddenActionNames: ['＋ 登记投诉', '批量分派', '发布处理时限', '关闭投诉'],
    forbiddenApiProbes: [{ method: 'POST', path: '/api/v1/complaint-sla-policies', data: {} }],
  },
];
const bearer = (token: string) => ({ authorization: `Bearer ${token}` });

async function login(request: APIRequestContext, loginName: string, password: string) {
  const response = await request.post('/api/v1/auth/login', {
    data: { login: loginName, password },
  });
  expect(response.ok(), `login failed for ${loginName}`).toBeTruthy();
  return ((await response.json()) as { token: string }).token;
}

async function validateRoleAccount(
  request: APIRequestContext,
  browser: Browser,
  account: RoleAccount,
) {
  const token = await login(request, account.login, account.password);
  try {
    for (const probe of account.forbiddenApiProbes ?? []) {
      const response = await request.fetch(probe.path, {
        method: probe.method,
        headers: bearer(token),
        ...(probe.data ? { data: probe.data } : {}),
      });
      expect(
        response.status(),
        `${account.name} forged ${probe.method} ${probe.path} must be rejected by the server`,
      ).toBe(403);
    }
    for (const viewport of [
      { width: 1440, height: 1000 },
      { width: 390, height: 844 },
    ]) {
      const context = await browser.newContext({ viewport });
      try {
        const page = await context.newPage();
        const browserErrors: string[] = [];
        page.on('pageerror', (error) => browserErrors.push(error.message));
        page.on('console', (message) => {
          if (message.type() === 'error') browserErrors.push(message.text());
        });
        await page.addInitScript(
          (sessionToken) => globalThis.sessionStorage.setItem('kingturf.session', sessionToken),
          token,
        );
        await page.goto('/#/overview');
        await expect(page.locator('.role-home')).toBeVisible();
        for (const route of account.allowedRoutes) {
          await expect(page.locator(`[data-app-route="${route}"]`)).toHaveCount(1);
          await expect(page.locator(`[data-role-task-route="${route}"]`)).toBeVisible();
        }
        for (const route of account.forbiddenRoutes) {
          await expect(page.locator(`[data-app-route="${route}"]`)).toHaveCount(0);
          await expect(page.locator(`[data-role-task-route="${route}"]`)).toHaveCount(0);
        }
        for (const route of account.allowedRoutes) {
          const routeLink = page.locator(`[data-app-route="${route}"]`);
          const domainToggle = routeLink.locator(
            'xpath=../../button[contains(@class, "nav-parent")]',
          );
          if (
            (await domainToggle.isVisible()) &&
            (await domainToggle.getAttribute('aria-expanded')) !== 'true'
          ) {
            await domainToggle.click();
          }
          await routeLink.click();
          await expect(page).toHaveURL(new RegExp(`#/${route}$`, 'u'));
          for (const actionName of account.forbiddenActionNames ?? []) {
            await expect(page.getByRole('button', { name: actionName, exact: true })).toHaveCount(
              0,
            );
          }
          const routePageWidth = await page.evaluate(() => document.documentElement.scrollWidth);
          expect(
            routePageWidth,
            `${account.name} ${route} overflows at ${String(viewport.width)}px`,
          ).toBeLessThanOrEqual(viewport.width);
        }
        for (const route of account.forbiddenRoutes) {
          await page.goto(`/#/${route}`);
          await expect(page).not.toHaveURL(new RegExp(`#/${route}$`, 'u'));
          await expect(page.locator(`[data-app-route="${route}"]`)).toHaveCount(0);
        }
        const pageWidth = await page.evaluate(() => document.documentElement.scrollWidth);
        expect(pageWidth).toBeLessThanOrEqual(viewport.width);
        expect(browserErrors, `${account.name} emitted browser errors`).toEqual([]);
      } finally {
        await context.close();
      }
    }
  } finally {
    const logout = await request.post('/api/v1/auth/logout', { headers: bearer(token) });
    expect(logout.ok()).toBeTruthy();
  }
}

test.describe('production representative-role browser UAT', () => {
  test.setTimeout(360_000);

  test('each configured role sees only authorized workspaces at desktop and mobile', async ({
    browser,
    request,
  }) => {
    test.skip(
      configuredAccounts.length === 0 && !provisionTemporaryAccounts,
      'configure existing UAT accounts or explicitly enable temporary provisioning',
    );
    for (const account of configuredAccounts) await validateRoleAccount(request, browser, account);
    if (!provisionTemporaryAccounts) return;

    const adminLogin = process.env.KINGTURF_ADMIN_LOGIN;
    const adminPassword = process.env.KINGTURF_ADMIN_PASSWORD;
    expect(adminLogin, 'KINGTURF_ADMIN_LOGIN is required').toBeTruthy();
    expect(adminPassword, 'KINGTURF_ADMIN_PASSWORD is required').toBeTruthy();
    const adminToken = await login(request, adminLogin ?? '', adminPassword ?? '');
    try {
      const organizationsResponse = await request.get('/api/v1/organizations', {
        headers: bearer(adminToken),
      });
      expect(organizationsResponse.ok()).toBeTruthy();
      const organizations = (await organizationsResponse.json()) as readonly {
        id: string;
        active?: boolean;
      }[];
      const organizationId = organizations.find((item) => item.active !== false)?.id;
      expect(organizationId, 'an active organization is required').toBeTruthy();
      const rolesResponse = await request.get('/api/v1/roles', { headers: bearer(adminToken) });
      expect(rolesResponse.ok()).toBeTruthy();
      const roles = (await rolesResponse.json()) as readonly { id: string; code: string }[];

      for (const [index, template] of templates.entries()) {
        const roleId = roles.find((role) => role.code === template.roleCode)?.id;
        expect(roleId, `role ${template.roleCode} must exist`).toBeTruthy();
        const suffix = `${Date.now().toString(36)}-${String(index + 1)}`;
        const loginName = `kt-uat-${suffix}`;
        const password = `Kt-UAT-${randomBytes(18).toString('base64url')}`;
        const createResponse = await request.post('/api/v1/employees', {
          headers: bearer(adminToken),
          data: {
            organizationId,
            employeeNumber: `KT-UAT-${suffix.toUpperCase()}`,
            displayName: `UAT-${template.name}`,
            email: `${loginName}@uat.kingturf.invalid`,
          },
        });
        expect(createResponse.ok()).toBeTruthy();
        const employee = (await createResponse.json()) as { id: string; version: number };
        try {
          const identityResponse = await request.put(`/api/v1/employees/${employee.id}/identity`, {
            headers: bearer(adminToken),
            data: { login: loginName, password },
          });
          expect(identityResponse.ok()).toBeTruthy();
          const assignResponse = await request.post('/api/v1/assignments', {
            headers: bearer(adminToken),
            data: { employeeId: employee.id, roleId },
          });
          expect(assignResponse.ok()).toBeTruthy();
          await validateRoleAccount(request, browser, { ...template, login: loginName, password });
        } finally {
          if (roleId) {
            const unassign = await request.delete('/api/v1/assignments', {
              headers: bearer(adminToken),
              data: { employeeId: employee.id, roleId },
            });
            expect(unassign.ok()).toBeTruthy();
          }
          const deactivate = await request.patch(`/api/v1/employees/${employee.id}`, {
            headers: bearer(adminToken),
            data: { active: false, version: employee.version },
          });
          expect(deactivate.ok()).toBeTruthy();
        }
      }
    } finally {
      const logout = await request.post('/api/v1/auth/logout', { headers: bearer(adminToken) });
      expect(logout.ok()).toBeTruthy();
    }
  });
});
