import { expect, test } from '@playwright/test';

const matrices = Array.from({ length: 36 }, (_, index) => ({
  id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
  code: `PRESET-${String(index + 1).padStart(2, '0')}`,
  name: `系统预置成本模型 ${String(index + 1)}`,
  currency: 'CNY',
  defaultTaxRate: '0.13',
  isSystemPreset: true,
  productFamily: index < 18 ? '运动草' : '景观草',
  factors: Array.from({ length: 13 }, (_, factorIndex) => ({
    id: `10000000-0000-4000-8000-${String(index * 20 + factorIndex + 1).padStart(12, '0')}`,
    factorCode: `FACTOR-${String(factorIndex + 1).padStart(2, '0')}`,
    factorName: `成本因子 ${String(factorIndex + 1)}`,
    category: factorIndex < 8 ? 'DIRECT_MATERIAL' : 'OTHER',
    quantity: '1',
    unitCode: 'KG',
    sourceType: 'MANUAL',
    manualUnitPriceTaxInclusive: '8.60',
    priceSourceName: '测试价格基准',
    priceEffectiveAt: '2026-08-28',
    adjustable: true,
  })),
}));

test('presents a paginated matrix ledger and a full-width on-demand model workspace', async ({
  page,
}, testInfo) => {
  let calculated = false;
  let addedFactor = false;
  let updatedFactor = false;
  let calculationRequests = 0;
  const currentMatrix = (index: number) => ({
    ...matrices[index],
    factors:
      addedFactor && index === 0
        ? [
            ...(matrices[index]?.factors ?? []),
            {
              id: '20000000-0000-4000-8000-000000000001',
              factorCode: 'TEST-FACTOR',
              factorName: '新增测试因子',
              category: 'OTHER',
              quantity: '1',
              unitCode: 'EA',
              sourceType: 'INTERNAL_BENCHMARK',
              manualUnitPriceTaxInclusive: updatedFactor ? '3.50' : '2.50',
              priceSourceName: updatedFactor ? '更新后企业基准' : '测试企业基准',
              priceEffectiveAt: '2026-08-29',
              adjustable: true,
            },
          ]
        : (matrices[index]?.factors ?? []),
    calculations:
      calculated && index === 0
        ? [
            {
              id: 'calculation-1',
              pricingMode: 'TAX_INCLUSIVE',
              directProductionCost: '18.5',
              reservedExpenseCost: '1.5',
              totalCost: '20',
              calculatedAt: '2026-08-29T09:00:00.000Z',
            },
          ]
        : [],
    ...(calculated && index === 0
      ? {
          latestCalculation: {
            id: 'calculation-1',
            pricingMode: 'TAX_INCLUSIVE',
            directProductionCost: '18.5',
            reservedExpenseCost: '1.5',
            totalCost: '20',
            calculatedAt: '2026-08-29T09:00:00.000Z',
          },
        }
      : {}),
    auditTrail: [],
  });
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
        permissions: ['cost-matrix:read', 'cost-matrix:manage', 'cost-matrix:calculate'],
      },
    }),
  );
  await page.route('**/api/v1/cost-matrix-summaries**', async (route) => {
    const url = new URL(route.request().url());
    const query = (url.searchParams.get('q') ?? '').toLocaleLowerCase('zh-CN');
    const productFamily = url.searchParams.get('productFamily') ?? '';
    const pageNumber = Number(url.searchParams.get('page') ?? 1);
    const pageSize = Number(url.searchParams.get('pageSize') ?? 20);
    const filtered = matrices
      .map((matrix, index) => ({
        id: matrix.id,
        code: matrix.code,
        name: matrix.name,
        currency: matrix.currency,
        defaultTaxRate: matrix.defaultTaxRate,
        isSystemPreset: matrix.isSystemPreset,
        productFamily: matrix.productFamily,
        factorCount: currentMatrix(index).factors.length,
        missingPriceCount: 0,
        missingSourceCount: 0,
        needsRecalculation: !calculated && index === 0,
        latestCalculation: currentMatrix(index).latestCalculation,
        updatedAt: '2026-08-29T09:00:00.000Z',
      }))
      .filter((matrix) =>
        `${matrix.code} ${matrix.name}`.toLocaleLowerCase('zh-CN').includes(query),
      )
      .filter((matrix) => !productFamily || matrix.productFamily === productFamily);
    const items = filtered.slice((pageNumber - 1) * pageSize, pageNumber * pageSize);
    await route.fulfill({
      status: 200,
      json: { items, total: filtered.length, page: pageNumber, pageSize },
    });
  });
  await page.route('**/api/v1/cost-matrices**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
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
    if (request.method() === 'POST' && request.url().endsWith('/factors')) {
      addedFactor = true;
      await route.fulfill({
        status: 201,
        json: { id: '20000000-0000-4000-8000-000000000001', factorCode: 'TEST-FACTOR' },
      });
      return;
    }
    if (request.method() === 'PATCH' && request.url().includes('/factors/')) {
      updatedFactor = true;
      await route.fulfill({
        status: 200,
        json: {
          id: '20000000-0000-4000-8000-000000000001',
          factorCode: 'TEST-FACTOR',
        },
      });
      return;
    }
    if (request.method() === 'GET') {
      const matrixIndex = matrices.findIndex((matrix) => url.pathname.endsWith(`/${matrix.id}`));
      if (matrixIndex >= 0) {
        await route.fulfill({ status: 200, json: currentMatrix(matrixIndex) });
        return;
      }
    }
    await route.fulfill({
      status: 200,
      json: { items: matrices.map((_, index) => currentMatrix(index)) },
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

  await expect(page.locator('.cost-matrix-ledger-row:not(.header)')).toHaveCount(20);
  await expect(page.locator('.cost-matrix-search')).toBeVisible();
  await expect(page.locator('.cost-factor-ledger-row:visible')).toHaveCount(0);
  await expect(page.getByText('第 1 / 2 页 · 共 36 个模型')).toBeVisible();
  await page.getByRole('button', { name: '下一页' }).click();
  await expect(page.locator('.cost-matrix-ledger-row:not(.header)')).toHaveCount(16);
  await expect(page.getByText('第 2 / 2 页 · 共 36 个模型')).toBeVisible();
  await page.getByRole('button', { name: '上一页' }).click();
  await expect(page.locator('.cost-matrix-ledger-row:not(.header)')).toHaveCount(20);

  await page.locator('.cost-matrix-search').fill('PRESET-32');
  await expect(page.locator('.cost-matrix-ledger-row:not(.header)')).toHaveCount(1);
  await page.locator('.cost-matrix-search').clear();
  await expect(page.locator('.cost-matrix-ledger-row:not(.header)')).toHaveCount(20);
  await page.getByLabel('筛选成本模型产品族').fill('景观草');
  await expect(page.getByText('第 1 / 1 页 · 共 18 个模型')).toBeVisible();
  await page.getByLabel('筛选成本模型产品族').clear();
  await expect(page.getByText('第 1 / 2 页 · 共 36 个模型')).toBeVisible();

  await page.getByRole('button', { name: '查看模型' }).first().click();
  await expect(page.getByRole('heading', { name: '系统预置成本模型 1' })).toBeVisible();
  await expect(page.locator('.cost-factor-ledger-row:not(.header)')).toHaveCount(13);
  await expect(page.locator('.cost-matrix-detail-summary')).toBeVisible();

  await page.getByRole('button', { name: '添加成本因子' }).click();
  const factorDialog = page.locator('.cost-factor-dialog');
  await expect(factorDialog).toHaveCSS('width', '840px');
  await factorDialog.locator('[name="factorCode"]').fill('TEST-FACTOR');
  await factorDialog.locator('[name="factorName"]').fill('新增测试因子');
  await factorDialog.locator('[name="category"]').selectOption('OTHER');
  await factorDialog.locator('[name="sourceType"]').selectOption('INTERNAL_BENCHMARK');
  await factorDialog.locator('[name="quantity"]').fill('1');
  await factorDialog.locator('[name="unitCode"]').selectOption('EA');
  await factorDialog.locator('[name="manualUnitPriceTaxInclusive"]').fill('2.50');
  await factorDialog.locator('[name="priceSourceName"]').fill('测试企业基准');
  await factorDialog.locator('[name="priceEffectiveAt"]').fill('2026-08-29');
  await factorDialog.getByRole('button', { name: '保存因子' }).click();
  await expect(page.getByText('新增测试因子已添加并显示')).toBeVisible();
  await expect(page.getByText('新增测试因子', { exact: true })).toBeVisible();
  await expect(page.getByText('企业计划成本基准', { exact: true }).last()).toBeVisible();

  await page.getByRole('button', { name: '编辑新增测试因子' }).click();
  const editDialog = page.locator('.cost-factor-dialog');
  await editDialog.locator('[name="manualUnitPriceTaxInclusive"]').fill('3.50');
  await editDialog.locator('[name="priceSourceName"]').fill('更新后企业基准');
  await editDialog.getByRole('button', { name: '保存因子' }).click();
  await expect(page.getByText('新增测试因子已更新')).toBeVisible();
  await expect(page.getByText('¥ 3.5000', { exact: true }).first()).toBeVisible();

  const calculate = page.getByRole('button', { name: '重新核算含税成本' });
  await calculate.click();
  await expect(page.getByRole('button', { name: '核算中…' }).first()).toBeDisabled();
  await expect(page.getByText('正在核算含税成本，请稍候…').first()).toBeVisible();
  await expect(page.getByText('系统预置成本模型 1核算完成：综合成本 ¥ 20.00')).toBeVisible();
  await expect(page.locator('.cost-matrix-detail-summary').getByText('¥ 20.00')).toBeVisible();
  expect(calculationRequests).toBe(1);

  await page.setViewportSize({ width: 800, height: 900 });
  await expect(page.locator('.app-shell')).toHaveClass(/tablet/);
  await expect(page.locator('.commercial-workspace')).toHaveClass(/tablet/);
  await expect(page.locator('.cost-matrix-detail-summary')).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('.app-shell')).toHaveClass(/mobile/);
  await expect(page.locator('.commercial-workspace')).toHaveClass(/mobile/);
  await page.getByRole('button', { name: '添加成本因子' }).click();
  const mobileDialog = page.locator('.cost-factor-dialog');
  await expect(mobileDialog).toBeVisible();
  const mobileDialogBox = await mobileDialog.boundingBox();
  expect(mobileDialogBox?.width).toBeGreaterThanOrEqual(340);
  expect(mobileDialogBox?.width).toBeLessThanOrEqual(390);
  await mobileDialog.getByRole('button', { name: '取消' }).click();

  await testInfo.attach('cost-matrix-ledger-detail', {
    body: await page.screenshot({ fullPage: true }),
    contentType: 'image/png',
  });
});

test('hands an approved matrix cost directly into a preselected sales quote', async ({ page }) => {
  const matrixId = '00000000-0000-4000-8000-000000000001';
  const calculationId = '00000000-0000-4000-8000-000000000002';
  const decisionId = '00000000-0000-4000-8000-000000000003';
  const solutionId = '00000000-0000-4000-8000-000000000004';
  const modelVersionId = '00000000-0000-4000-8000-000000000005';
  const policyVersionId = '00000000-0000-4000-8000-000000000006';
  let linkedToQuote = false;

  await page.route('**/api/v1/auth/login', (route) =>
    route.fulfill({ status: 200, json: { token: 'cost-to-quote-session' } }),
  );
  await page.route('**/api/v1/auth/session', (route) =>
    route.fulfill({
      status: 200,
      json: {
        employeeId: 'employee-commercial-admin',
        companyId: 'company-1',
        displayName: '商务管理员',
        employeeNumber: 'KT-COMMERCIAL-01',
        permissions: [
          'cost-matrix:read',
          'cost-matrix:calculate',
          'cost-model:read',
          'cost:read',
          'cost:evaluate',
          'technical-solution:read',
          'ctr:read',
          'sales-policy:read',
          'quote:read',
          'quote:create',
        ],
      },
    }),
  );
  await page.route('**/api/v1/cost-matrix-calculations/*/quote-cost-decision', async (route) => {
    linkedToQuote = true;
    await route.fulfill({
      status: 201,
      json: {
        id: decisionId,
        costDecisionId: decisionId,
        technicalSolutionRevisionId: solutionId,
        opportunityId: 'opportunity-1',
        currency: 'CNY',
        total: '20',
      },
    });
  });
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.startsWith('/api/v1/auth/') || url.pathname.includes('/quote-cost-decision')) {
      await route.fallback();
      return;
    }
    const matrixDetail = {
      id: matrixId,
      code: 'PRESET-01',
      name: '景观草报价模型',
      currency: 'CNY',
      defaultTaxRate: '0.13',
      factors: [],
      calculations: [
        {
          id: calculationId,
          pricingMode: 'TAX_INCLUSIVE',
          directProductionCost: '18',
          reservedExpenseCost: '2',
          totalCost: '20',
          ...(linkedToQuote ? { costDecisionId: decisionId } : {}),
        },
      ],
      latestCalculation: {
        id: calculationId,
        pricingMode: 'TAX_INCLUSIVE',
        directProductionCost: '18',
        reservedExpenseCost: '2',
        totalCost: '20',
        ...(linkedToQuote ? { costDecisionId: decisionId } : {}),
      },
      auditTrail: [],
    };
    if (url.pathname === '/api/v1/cost-matrix-summaries') {
      await route.fulfill({
        status: 200,
        json: {
          items: [
            {
              ...matrixDetail,
              factors: undefined,
              calculations: undefined,
              auditTrail: undefined,
              factorCount: 0,
              missingPriceCount: 0,
              missingSourceCount: 0,
              needsRecalculation: false,
            },
          ],
          total: 1,
          page: 1,
          pageSize: 20,
        },
      });
      return;
    }
    if (url.pathname === `/api/v1/cost-matrices/${matrixId}`) {
      await route.fulfill({ status: 200, json: matrixDetail });
      return;
    }
    const itemsByPath: Record<string, unknown[]> = {
      '/api/v1/cost-matrices': [
        {
          id: matrixId,
          code: 'PRESET-01',
          name: '景观草报价模型',
          currency: 'CNY',
          defaultTaxRate: '0.13',
          factors: [],
          latestCalculation: {
            id: calculationId,
            pricingMode: 'TAX_INCLUSIVE',
            directProductionCost: '18',
            reservedExpenseCost: '2',
            totalCost: '20',
            ...(linkedToQuote ? { costDecisionId: decisionId } : {}),
          },
        },
      ],
      '/api/v1/cost-models': [
        {
          id: modelVersionId,
          code: 'COST-RULE',
          name: '企业成本规则',
          version: 1,
          status: 'PUBLISHED',
          currency: 'CNY',
        },
      ],
      '/api/v1/cost-evaluations': linkedToQuote
        ? [
            {
              id: decisionId,
              technicalSolutionRevisionId: solutionId,
              opportunityId: 'opportunity-1',
              currency: 'CNY',
              subtotal: '20',
              total: '20',
            },
          ]
        : [],
      '/api/v1/technical-solutions': [
        {
          id: solutionId,
          code: 'SOLUTION-01',
          revision: 1,
          status: 'FINAL',
          ctrVersionId: 'ctr-version-1',
          opportunityId: 'opportunity-1',
        },
      ],
      '/api/v1/ctrs': [{ id: 'ctr-version-1', status: 'APPROVED', opportunityId: 'opportunity-1' }],
      '/api/v1/sales-policies': [
        {
          id: policyVersionId,
          code: 'POLICY-01',
          version: 1,
          status: 'PUBLISHED',
        },
      ],
      '/api/v1/quotes': [],
    };
    await route.fulfill({ status: 200, json: { items: itemsByPath[url.pathname] ?? [] } });
  });

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  await page.getByPlaceholder('账号').fill('KT-COMMERCIAL-01');
  await page.getByPlaceholder('密码').fill('not-a-real-secret');
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await page.evaluate(() => {
    globalThis.location.hash = '#/costing';
  });
  await expect(page).toHaveURL(/#\/costing$/u);

  await page.getByRole('button', { name: '查看模型' }).click();
  await expect(page.getByRole('heading', { name: '景观草报价模型' })).toBeVisible();
  await page.getByRole('button', { name: '冻结并用于报价' }).click();
  const handoff = page.locator('.form-dialog');
  await expect(
    handoff.getByRole('heading', { name: '生成报价成本 · 景观草报价模型' }),
  ).toBeVisible();
  await handoff.getByRole('button', { name: '冻结并进入报价' }).click();

  await expect(page).toHaveURL(/#\/quotes$/u);
  const quoteDialog = page.locator('.form-dialog');
  await expect(quoteDialog.getByRole('heading', { name: '新建销售报价' })).toBeVisible();
  await expect(quoteDialog.locator('[name="costDecisionId"]')).toHaveValue(decisionId);
  await expect(page.getByText('景观草报价模型已形成报价成本快照，正在进入销售报价')).toBeVisible();
});
