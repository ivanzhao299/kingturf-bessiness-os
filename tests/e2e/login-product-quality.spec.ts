import { expect, test } from '@playwright/test';

const session = {
  employeeId: 'employee-1',
  companyId: 'company-1',
  displayName: '产品验收用户',
  employeeNumber: 'KT-E2E-01',
  permissions: [],
};

test('shows deterministic progress, prevents repeated login and enters the workspace', async ({
  page,
}) => {
  let loginRequests = 0;
  await page.route('**/api/v1/auth/login', async (route) => {
    loginRequests += 1;
    await new Promise((resolve) => setTimeout(resolve, 180));
    await route.fulfill({ status: 200, json: { token: 'test-session' } });
  });
  await page.route('**/api/v1/auth/session', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 180));
    await route.fulfill({ status: 200, json: session });
  });

  await page.goto('/');
  await page.getByPlaceholder('账号').fill('KT-E2E-01');
  await page.getByPlaceholder('密码').fill('not-a-real-secret');
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await expect(page.getByRole('button', { name: '正在登录…' })).toBeDisabled();
  await expect(page.getByText('正在验证账号…')).toBeVisible();
  await page.locator('form').dispatchEvent('submit');
  await expect(page.getByText('正在验证登录状态…')).toBeVisible();
  await expect(page.getByRole('heading', { name: '经营概览', exact: true })).toBeVisible();
  expect(loginRequests).toBe(1);
});

test('keeps one actionable error and safely resets the password after rejection', async ({
  page,
}) => {
  await page.route('**/api/v1/auth/login', async (route) => {
    await route.fulfill({
      status: 401,
      json: { error: { message: 'Invalid credentials', correlationId: 'test-correlation' } },
    });
  });

  await page.goto('/');
  await page.getByPlaceholder('账号').fill('KT-E2E-01');
  await page.getByPlaceholder('密码').fill('incorrect');
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await expect(page.getByText('账号或密码不正确，请重新输入')).toBeVisible();
  await expect(page.getByPlaceholder('密码')).toHaveValue('');
  await expect(page.getByRole('button', { name: '登录', exact: true })).toBeEnabled();
  await expect(page.locator('.login-status')).toHaveCount(1);
});
