import { randomBytes } from 'node:crypto';
import { expect, test, type APIRequestContext, type Browser } from '@playwright/test';

type RoleAccount = Readonly<{
  name: string;
  login: string;
  password: string;
  allowedRoutes: readonly string[];
  forbiddenRoutes: readonly string[];
}>;
type RoleTemplate = Omit<RoleAccount, 'login' | 'password'> & Readonly<{ roleCode: string }>;

const rawAccounts = process.env.KINGTURF_ROLE_UAT_ACCOUNTS_JSON;
const configuredAccounts = rawAccounts ? (JSON.parse(rawAccounts) as readonly RoleAccount[]) : [];
const provisionTemporaryAccounts = process.env.KINGTURF_UAT_PROVISION === 'true';
const templates: readonly RoleTemplate[] = [
  {
    name: '报价编制专员',
    roleCode: 'KT_QUOTE_EDITOR',
    allowedRoutes: ['sales-workspace', 'cost-quote'],
    forbiddenRoutes: ['planning-production', 'governance'],
  },
  {
    name: '应收会计',
    roleCode: 'KT_AR_ACCOUNTANT',
    allowedRoutes: ['sales-workspace', 'ar-payment'],
    forbiddenRoutes: ['quality-warehouse', 'governance'],
  },
  {
    name: '生产计划员',
    roleCode: 'KT_PRODUCTION_PLANNER',
    allowedRoutes: ['operations-workspace', 'planning-production'],
    forbiddenRoutes: ['cost-quote', 'governance'],
  },
  {
    name: '质量检验员',
    roleCode: 'KT_QUALITY_INSPECTOR',
    allowedRoutes: ['operations-workspace', 'quality-warehouse'],
    forbiddenRoutes: ['ar-payment', 'governance'],
  },
  {
    name: '库存控制员',
    roleCode: 'KT_INVENTORY_CONTROLLER',
    allowedRoutes: ['operations-workspace', 'planning-production'],
    forbiddenRoutes: ['contract-order', 'governance'],
  },
  {
    name: '物流履约员',
    roleCode: 'KT_LOGISTICS_COORDINATOR',
    allowedRoutes: ['operations-workspace', 'delivery-evidence'],
    forbiddenRoutes: ['cost-quote', 'governance'],
  },
  {
    name: '经营驾驶舱查看者',
    roleCode: 'KT_EXECUTIVE_VIEWER',
    allowedRoutes: [],
    forbiddenRoutes: ['cost-quote', 'planning-production', 'governance'],
  },
  {
    name: '身份与权限管理员',
    roleCode: 'KT_IAM_ADMIN',
    allowedRoutes: ['governance'],
    forbiddenRoutes: ['cost-quote', 'planning-production'],
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
    for (const viewport of [
      { width: 1440, height: 1000 },
      { width: 390, height: 844 },
    ]) {
      const context = await browser.newContext({ viewport });
      try {
        const page = await context.newPage();
        await page.addInitScript(
          (sessionToken) => globalThis.sessionStorage.setItem('kingturf.session', sessionToken),
          token,
        );
        await page.goto('/#/overview');
        await expect(page.locator('.role-home')).toBeVisible();
        for (const route of account.allowedRoutes) {
          await expect(page.locator(`[data-app-route="${route}"]`)).toBeVisible();
          await expect(page.locator(`[data-role-task-route="${route}"]`)).toBeVisible();
        }
        for (const route of account.forbiddenRoutes) {
          await expect(page.locator(`[data-app-route="${route}"]`)).toHaveCount(0);
          await expect(page.locator(`[data-role-task-route="${route}"]`)).toHaveCount(0);
        }
        const pageWidth = await page.evaluate(() => document.documentElement.scrollWidth);
        expect(pageWidth).toBeLessThanOrEqual(viewport.width);
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
