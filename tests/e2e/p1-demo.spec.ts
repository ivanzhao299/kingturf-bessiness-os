import { expect, test, type Page } from '@playwright/test';

const login = process.env.KINGTURF_ADMIN_LOGIN ?? 'admin';
const password = process.env.KINGTURF_ADMIN_PASSWORD;

async function openAuthenticatedWorkspace(page: Page): Promise<void> {
  if (!password) throw new Error('KINGTURF_ADMIN_PASSWORD is required');
  const response = await page.request.post('/api/v1/auth/login', {
    data: { login, password },
  });
  expect(response.ok()).toBeTruthy();
  const { token } = (await response.json()) as { token: string };
  await page.addInitScript((sessionToken) => {
    globalThis.sessionStorage.setItem('kingturf.session', sessionToken);
  }, token);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '商机阶段看板' })).toBeVisible();
}

test('shows approved, rejected, and expired credit evidence', async ({ page }, testInfo) => {
  await openAuthenticatedWorkspace(page);
  const workbench = page.locator('.credit-workbench');
  await expect(workbench).toBeVisible();
  const seeded = workbench.locator('.qtc-card', { hasText: '申请 950000' });
  await expect(seeded).toHaveCount(3);
  await expect(seeded.filter({ hasText: '信用已批准' })).toContainText('敞口 0');
  await expect(seeded.filter({ hasText: '信用已拒绝' })).toContainText('敞口 450000');
  await expect(seeded.filter({ hasText: '信用已过期' })).toContainText('敞口 450000');
  await expect(seeded).toContainText(['额度 5000000', '额度 5000000', '额度 5000000']);
  await testInfo.attach('credit-outcomes-desktop', {
    body: await workbench.screenshot(),
    contentType: 'image/png',
  });
});

test('shows the released order, partial AR, payment, and reconciliation evidence', async ({
  page,
}, testInfo) => {
  await openAuthenticatedWorkspace(page);
  const order = page.locator('.order-workbench');
  const ar = page.locator('.ar-workbench');
  const payment = page.locator('.payment-workbench');
  await expect(order.getByText('SO-KT-P1-DEMO', { exact: true })).toBeVisible();
  await expect(order.getByText('CNY 950000', { exact: true })).toBeVisible();
  await expect(ar.getByText('INV-KT-P1-DEMO', { exact: true })).toBeVisible();
  await expect(ar.getByText('未核销 CNY 0', { exact: true })).toBeVisible();
  const seededPayment = payment
    .locator('.qtc-card')
    .filter({ hasText: /BANK-KT-P1-DEMO(?!-FINAL)/u });
  await expect(seededPayment).toBeVisible();
  await expect(seededPayment.getByText(/待核销 0/)).toBeVisible();
  await expect(payment.getByText(/最近核销 [0-9a-f]{12}/)).toBeVisible();
  for (const [name, locator] of [
    ['order', order],
    ['receivable', ar],
    ['payment-reconciliation', payment],
  ] as const)
    await testInfo.attach(`${name}-desktop`, {
      body: await locator.screenshot(),
      contentType: 'image/png',
    });
});

test('keeps the P1 evidence usable on a mobile viewport', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openAuthenticatedWorkspace(page);
  for (const selector of [
    '.credit-workbench',
    '.contract-workbench',
    '.order-workbench',
    '.ar-workbench',
    '.payment-workbench',
    '.commission-workbench',
  ])
    await expect(page.locator(selector)).toBeVisible();
  await expect(page.locator('.commercial-workspace textarea[aria-label$="JSON 请求"]')).toHaveCount(
    0,
  );
  await testInfo.attach('order-to-cash-mobile', {
    body: await page.locator('.order-workbench').screenshot(),
    contentType: 'image/png',
  });
});

test('shows commission economics and the immutable control ledger', async ({ page }, testInfo) => {
  await openAuthenticatedWorkspace(page);
  const workbench = page.locator('.commission-workbench');
  await expect(workbench).toBeVisible();
  await expect(
    workbench.locator('.version-pin').filter({ hasText: 'COM-KT-P1-2026 V1' }).first(),
  ).toBeVisible();
  const card = workbench.locator('.commission-card', { hasText: 'SO-KT-P1-DEMO' });
  await expect(card.getByText('CNY 28500', { exact: true })).toBeVisible();
  await expect(card.getByText('已追回', { exact: true })).toBeVisible();
  await expect(card.getByText(/1 · 已计提/)).toBeVisible();
  await expect(card.getByText(/2 · 已冻结/)).toBeVisible();
  await expect(card.getByText(/3 · 已释放/)).toBeVisible();
  await expect(card.getByText(/4 · 已支付/)).toBeVisible();
  await expect(card.getByText(/5 · 已追回/)).toBeVisible();
  await testInfo.attach('commission-ledger-desktop', {
    body: await workbench.screenshot(),
    contentType: 'image/png',
  });
});
