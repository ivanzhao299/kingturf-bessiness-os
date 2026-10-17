import { expect, test } from '@playwright/test';
import { seedSyntheticCookies, sessionResponse } from './fixtures/browser-session';

// Mock responses here verify browser navigation only. Real auth/DB enforcement is covered by
// apps/api/test/auth-http-postgres.integration.test.ts against two actual HTTP API instances.
for (const status of [401, 403]) {
  test(`a running workspace handles ${String(status)} without confusing expiry and permission denial`, async ({
    page,
  }) => {
    await seedSyntheticCookies(page);
    let denied = false;
    let revoked = false;
    let deniedRequests = 0;
    const restoreStatuses: number[] = [];
    page.on('response', (response) => {
      if (new URL(response.url()).pathname === '/api/v1/auth/session') {
        restoreStatuses.push(response.status());
      }
    });
    const cookieValues = async () =>
      JSON.stringify(
        (await page.context().cookies())
          .map((cookie) => [cookie.name, cookie.value])
          .sort(([a], [b]) => (a ?? '').localeCompare(b ?? '')),
      );
    await page.route('**/api/v1/**', (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path.endsWith('/auth/session')) {
        const hasCookie = (route.request().headers().cookie ?? '')
          .split(';')
          .some((part) => part.trim() === '__Host-kingturf-session=synthetic-browser-fixture-only');
        const restoreStatus = revoked || !hasCookie ? 401 : 200;
        return route.fulfill({
          status: restoreStatus,
          json:
            restoreStatus === 200
              ? sessionResponse({
                  employeeId: 'browser-test',
                  companyId: 'test-company',
                  displayName: '会话验收',
                  employeeNumber: 'TEST',
                  permissions: ['cost-matrix:read', 'cost-matrix:manage'],
                })
              : { error: { message: 'Synthetic session unavailable' } },
        });
      }
      if (path.endsWith('/cost-matrix-summaries') && denied) {
        deniedRequests += 1;
        if (status === 401) revoked = true;
        return route.fulfill({ status, json: { error: { message: 'test denial' } } });
      }
      return route.fulfill({ json: { items: [], total: 0, page: 1, pageSize: 20 } });
    });
    await page.goto('/#/costing');
    await page.reload();
    await expect(page.getByLabel('搜索成本模型')).toBeVisible();
    const beforeDenial = await cookieValues();
    denied = true;
    await page.getByLabel('搜索成本模型').fill('触发失效会话验证');
    if (status === 401) {
      await expect(page.getByRole('button', { name: '登录', exact: true })).toBeVisible();
      await expect(page.getByText('登录状态已失效，请重新登录')).toBeVisible();
      await expect(page.locator('.app-shell')).toHaveCount(0);
    } else {
      await expect(page.getByText('test denial')).toBeVisible();
      await expect(page.locator('.app-shell')).toBeVisible();
      expect((await cookieValues()) === beforeDenial).toBe(true);
    }
    expect(deniedRequests).toBeGreaterThan(0);
    const restoresBeforeReload = restoreStatuses.length;
    await page.reload();
    if (status === 401) {
      await expect(page.getByRole('button', { name: '登录', exact: true })).toBeVisible();
      await expect(page.locator('.app-shell')).toHaveCount(0);
    } else await expect(page.locator('.app-shell')).toBeVisible();
    expect(restoreStatuses.slice(restoresBeforeReload)).toEqual([status === 401 ? 401 : 200]);
  });
}
