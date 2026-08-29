import { expect, test } from '@playwright/test';

const matrices = Array.from({ length: 12 }, (_, index) => ({
  id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
  code: `PRESET-${String(index + 1).padStart(2, '0')}`,
  name: `系统预置成本模型 ${String(index + 1)}`,
  currency: 'CNY',
  defaultTaxRate: '0.13',
  isSystemPreset: true,
  factors: Array.from({ length: 13 }, (_, factorIndex) => ({
    factorCode: `FACTOR-${String(factorIndex + 1).padStart(2, '0')}`,
    factorName: `成本因子 ${String(factorIndex + 1)}`,
    category: factorIndex < 8 ? 'DIRECT_MATERIAL' : 'OTHER',
    quantity: '1',
    sourceType: 'MANUAL',
  })),
}));

test('presents compact matrix cards and gives one-click calculation feedback', async ({
  page,
}, testInfo) => {
  let calculated = false;
  let calculationRequests = 0;
  await page.route('**/api/v1/auth/login', (route) =>
    route.fulfill({ status: 200, json: { token: 'cost-matrix-session' } }),
  );
  await page.route('**/api/v1/auth/session', (route) =>
    route.fulfill({
      status: 200,
      json: {
        employeeId: 'employee-cost-analyst',
        companyId: 'company-1',
        displayName: '成本分析员',
        employeeNumber: 'KT-COST-01',
        permissions: ['cost-matrix:read', 'cost-matrix:calculate'],
      },
    }),
  );
  await page.route('**/api/v1/cost-matrices**', async (route) => {
    const request = route.request();
    if (request.method() === 'POST' && request.url().endsWith('/calculate')) {
      calculationRequests += 1;
      await new Promise((resolve) => setTimeout(resolve, 250));
      calculated = true;
      await route.fulfill({
        status: 201,
        json: {
          pricingMode: 'TAX_INCLUSIVE',
          directProductionCost: '18.5',
          reservedExpenseCost: '1.5',
          totalCost: '20',
          calculatedAt: '2026-08-29T09:00:00.000Z',
        },
      });
      return;
    }
    await route.fulfill({
      status: 200,
      json: {
        items: matrices.map((matrix, index) => ({
          ...matrix,
          ...(calculated && index === 0
            ? {
                latestCalculation: {
                  pricingMode: 'TAX_INCLUSIVE',
                  directProductionCost: '18.5',
                  reservedExpenseCost: '1.5',
                  totalCost: '20',
                  calculatedAt: '2026-08-29T09:00:00.000Z',
                },
              }
            : {}),
        })),
      },
    });
  });

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  await page.getByPlaceholder('账号').fill('KT-COST-01');
  await page.getByPlaceholder('密码').fill('not-a-real-secret');
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await expect(page.locator('.app-shell')).toBeVisible();

  const routeLink = page.locator('[data-app-route="costing"]');
  const domainToggle = routeLink.locator('xpath=../../button[contains(@class, "nav-parent")]');
  if (
    (await domainToggle.isVisible()) &&
    (await domainToggle.getAttribute('aria-expanded')) !== 'true'
  )
    await domainToggle.click();
  await routeLink.click();

  await expect(page.locator('.cost-matrix-card')).toHaveCount(12);
  await expect(page.locator('.cost-matrix-search')).toBeVisible();
  await expect(page.locator('.cost-factor-row:visible')).toHaveCount(0);
  const columnCount = await page
    .locator('.cost-matrix-grid')
    .evaluate(
      (element) => getComputedStyle(element).gridTemplateColumns.split(' ').filter(Boolean).length,
    );
  expect(columnCount).toBeGreaterThan(1);

  await page.locator('.cost-matrix-search').fill('PRESET-12');
  await expect(page.locator('.cost-matrix-card:visible')).toHaveCount(1);
  await expect(page.locator('.cost-matrix-count')).toHaveText('显示 1 / 12 个模型');
  await page.locator('.cost-matrix-search').clear();
  await expect(page.locator('.cost-matrix-card:visible')).toHaveCount(12);

  await page.locator('.cost-matrix-details summary').first().click();
  await expect(page.locator('.cost-matrix-card').first().locator('.cost-factor-row')).toHaveCount(
    13,
  );
  await expect(
    page.locator('.cost-matrix-card').first().locator('.cost-factor-row').first(),
  ).toBeVisible();

  const calculate = page
    .locator('.cost-matrix-card')
    .first()
    .getByRole('button', { name: '一键核算含税成本' });
  await calculate.click();
  await expect(page.getByRole('button', { name: '核算中…' }).first()).toBeDisabled();
  await expect(page.getByText('正在核算含税成本，请稍候…').first()).toBeVisible();
  await expect(page.getByText('系统预置成本模型 1核算完成：综合成本 ¥ 20.00')).toBeVisible();
  await expect(page.locator('.cost-matrix-card').first().getByText('¥ 20.00')).toBeVisible();
  expect(calculationRequests).toBe(1);

  await testInfo.attach('cost-matrix-card-grid', {
    body: await page.screenshot({ fullPage: true }),
    contentType: 'image/png',
  });
});
