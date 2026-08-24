import { expect, test } from '@playwright/test';

type RoleAccount = Readonly<{
  name: string;
  login: string;
  password: string;
  allowedRoutes: readonly string[];
  forbiddenRoutes: readonly string[];
}>;

const rawAccounts = process.env.KINGTURF_ROLE_UAT_ACCOUNTS_JSON;
const accounts = rawAccounts ? (JSON.parse(rawAccounts) as readonly RoleAccount[]) : [];

test.describe('production representative-role browser UAT', () => {
  test('each configured role sees only authorized workspaces at desktop and mobile', async ({
    browser,
    request,
  }) => {
    test.skip(accounts.length === 0, 'KINGTURF_ROLE_UAT_ACCOUNTS_JSON is not configured');
    for (const account of accounts) {
      const response = await request.post('/api/v1/auth/login', {
        data: { login: account.login, password: account.password },
      });
      expect(response.ok()).toBeTruthy();
      const { token } = (await response.json()) as { token: string };

      for (const viewport of [
        { width: 1440, height: 1000 },
        { width: 390, height: 844 },
      ]) {
        const context = await browser.newContext({ viewport });
        const page = await context.newPage();
        await page.addInitScript((sessionToken) => {
          globalThis.sessionStorage.setItem('kingturf.session', sessionToken);
        }, token);
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
        await context.close();
      }
      const logout = await request.post('/api/v1/auth/logout', {
        headers: { authorization: `Bearer ${token}` },
      });
      expect(logout.ok()).toBeTruthy();
    }
  });
});
