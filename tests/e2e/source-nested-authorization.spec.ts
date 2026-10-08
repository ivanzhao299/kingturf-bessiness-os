import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

// Response replay checks UI parity using synthetic data actually returned by the real HTTP/PG suite.
// API enforcement remains independently tested there; this browser runner does not contact production.
const samples = JSON.parse(readFileSync('.test-results/authz-ui-fixtures.json', 'utf8')) as Record<
  string,
  Record<string, unknown>
>;
for (const legal of [false, true]) {
  test(`collection and order evidence reflect independent legal read (${String(legal)})`, async ({
    page,
  }) => {
    const aggregate = samples[legal ? 'authorized' : 'denied'];
    const collectionPayload = samples[legal ? 'authorizedCollections' : 'deniedCollections'];
    if (!aggregate || !collectionPayload)
      throw new Error('Run real HTTP authorization fixture producer first');
    await page.route('**/api/v1/**', (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path.endsWith('/auth/login'))
        return route.fulfill({ json: { token: 'browser-response-replay' } });
      if (path.endsWith('/auth/session'))
        return route.fulfill({ json: samples[legal ? 'authorizedSession' : 'deniedSession'] });
      if (path.endsWith('/collection-cases')) return route.fulfill({ json: collectionPayload });
      if (path.endsWith('/sales-orders'))
        return route.fulfill({ json: { items: [aggregate.order] } });
      if (path.endsWith('/360')) return route.fulfill({ json: aggregate });
      return route.fulfill({ json: { items: [] } });
    });
    await page.goto('/');
    await page.getByPlaceholder('账号').fill('synthetic');
    await page.getByPlaceholder('密码').fill('test-only');
    await page.getByRole('button', { name: '登录', exact: true }).click();
    await expect(page.locator('.app-shell')).toBeVisible();
    await page.evaluate(() => {
      location.hash = 'collections';
    });
    await expect(page.locator('.collection-case-card')).toBeVisible();
    if (legal)
      await expect(page.locator('.collection-case-card')).toContainText('SENSITIVE-PACKAGE');
    else await expect(page.locator('.collection-case-card')).not.toContainText('SENSITIVE-PACKAGE');
    await page.evaluate(() => {
      location.hash = 'order-360';
    });
    await page.getByRole('button', { name: '查看全链路证据' }).click();
    await expect(page.locator('.order-360-detail')).toBeVisible();
    if (legal)
      await expect(page.locator('.order-360-detail')).toContainText('SENSITIVE-LEGAL-REASON');
    else await expect(page.locator('.order-360-detail')).not.toContainText('SENSITIVE-LEGAL');
  });
}
