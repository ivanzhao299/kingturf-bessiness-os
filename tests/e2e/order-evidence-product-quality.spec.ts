import { expect, test } from '@playwright/test';

test('opens order evidence on demand with keyboard, retry and full-width mobile detail', async ({
  page,
}, testInfo) => {
  let evidenceRequests = 0;
  await page.route('**/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/auth/login'))
      return route.fulfill({ json: { token: 'test-order-session' } });
    if (path.endsWith('/auth/session'))
      return route.fulfill({
        json: {
          employeeId: 'order-reviewer',
          companyId: 'test-company',
          displayName: '履约核对员',
          employeeNumber: 'KT-ORDER-TEST',
          permissions: ['sales-order:read', 'order-360:read'],
        },
      });
    if (path.endsWith('/sales-orders'))
      return route.fulfill({
        json: {
          items: [
            {
              id: 'order-1',
              orderNumber: 'SO-AUDIT-001',
              currency: 'CNY',
              total: '12000',
              status: 'RELEASED',
            },
          ],
        },
      });
    if (path.endsWith('/sales-orders/order-1/360')) {
      evidenceRequests += 1;
      await new Promise((resolve) => setTimeout(resolve, 200));
      if (evidenceRequests === 1)
        return route.fulfill({
          status: 503,
          json: { error: { message: '证据服务暂时不可用，请重试' } },
        });
      return route.fulfill({
        json: {
          order: {
            id: 'order-1',
            orderNumber: 'SO-AUDIT-001',
            currency: 'CNY',
            total: '12000',
            status: 'RELEASED',
          },
          contract: { contractNumber: 'CONTRACT-AUDIT-001' },
          timeline: [
            { type: 'ORDER_RELEASED', occurredAt: '2026-09-05T10:00:00Z', label: '订单已释放' },
          ],
        },
      });
    }
    return route.fulfill({ json: { items: [] } });
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  await page.getByPlaceholder('账号').fill('KT-ORDER-TEST');
  await page.getByPlaceholder('密码').fill('test-only-not-a-real-password');
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await expect(page.locator('.app-shell')).toBeVisible();
  expect(evidenceRequests).toBe(0);
  await page.evaluate(() => {
    location.hash = 'order-360';
  });
  const open = page.getByRole('button', { name: '查看全链路证据' });
  await open.focus();
  await open.press('Enter');
  await expect(open).toBeDisabled();
  await expect(page.locator('.record-detail-drawer')).toHaveCount(0);
  await page.getByRole('button', { name: '重试加载订单证据' }).click();
  await expect(page.locator('.order-360-detail')).toBeVisible();
  await expect(page.locator('.order-360-detail')).toContainText('CONTRACT-AUDIT-001');
  expect(evidenceRequests).toBe(2);
  await page.getByRole('button', { name: '收起全链路证据' }).click();
  await expect(page.locator('.order-360-detail')).toBeHidden();
  await page.getByRole('button', { name: '查看全链路证据' }).click();
  await expect(page.locator('.order-360-detail')).toBeVisible();
  expect(evidenceRequests).toBe(3);
  const advanced = page.locator('.order-360-workbench .workspace-list-advanced');
  await expect(advanced).not.toHaveAttribute('open');
  await advanced.locator('summary').click();
  await advanced.getByLabel(/字段显示范围/).selectOption('key');
  await expect(page.locator('.order-360-detail')).toBeVisible();
  await advanced.locator('summary').click();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('.app-shell')).toHaveClass(/mobile/);
  await expect(page.locator('.order-360-detail')).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  expect(overflow).toBe(false);
  await page.locator('.order-360-detail').scrollIntoViewIfNeeded();
  await testInfo.attach('order-evidence-mobile', {
    body: await page.screenshot(),
    contentType: 'image/png',
  });
});
