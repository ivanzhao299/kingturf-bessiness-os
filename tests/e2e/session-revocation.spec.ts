import { expect, test } from '@playwright/test';

// Mock responses here verify browser navigation only. Real auth/DB enforcement is covered by
// apps/api/test/auth-http-postgres.integration.test.ts against two actual HTTP API instances.
for (const status of [401, 403]) {
  test(`a running workspace handles ${String(status)} without confusing expiry and permission denial`, async ({
    page,
  }) => {
    await page.goto('/');
    await page.evaluate(() => {
      sessionStorage.setItem('kingturf.session', 'browser-test-session');
    });
    let denied = false;
    await page.route('**/api/v1/**', (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path.endsWith('/auth/session'))
        return route.fulfill({
          json: {
            employeeId: 'browser-test',
            companyId: 'test-company',
            displayName: '会话验收',
            employeeNumber: 'TEST',
            permissions: ['cost-matrix:read', 'cost-matrix:manage'],
          },
        });
      if (path.endsWith('/cost-matrix-summaries') && denied)
        return route.fulfill({ status, json: { error: { message: 'test denial' } } });
      return route.fulfill({ json: { items: [], total: 0, page: 1, pageSize: 20 } });
    });
    await page.goto('/#/costing');
    await page.reload();
    await expect(page.getByLabel('搜索成本模型')).toBeVisible();
    denied = true;
    await page.getByLabel('搜索成本模型').fill('触发失效会话验证');
    if (status === 401) {
      await expect(page.getByRole('button', { name: '登录', exact: true })).toBeVisible();
      await expect(page.getByText('登录状态已失效，请重新登录')).toBeVisible();
      expect(await page.evaluate(() => sessionStorage.getItem('kingturf.session'))).toBeNull();
      await expect(page.locator('.app-shell')).toHaveCount(0);
    } else {
      await expect(page.getByText('test denial')).toBeVisible();
      await expect(page.locator('.app-shell')).toBeVisible();
      expect(await page.evaluate(() => sessionStorage.getItem('kingturf.session'))).toBe(
        'browser-test-session',
      );
    }
  });
}
