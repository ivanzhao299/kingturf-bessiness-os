import { expect, test, type Page } from '@playwright/test';
import type { AppRoute } from '../../apps/web/src/shared/navigation';

const login = process.env.KINGTURF_ADMIN_LOGIN ?? 'admin';
const password = process.env.KINGTURF_ADMIN_PASSWORD;

async function openRoute(page: Page, route: AppRoute): Promise<void> {
  const parent = page.locator(`[data-nav-routes~="${route}"]`);
  await expect(parent).toBeAttached();
  if ((await parent.isVisible()) && (await parent.getAttribute('aria-expanded')) !== 'true')
    await parent.click();
  const menu = page.locator(`[data-app-route="${route}"]`);
  await menu.click();
  await expect(menu).toHaveAttribute('aria-current', 'page');
  await expect(
    page
      .locator(
        `.commercial-workspace > [data-route-view~="${route}"][data-commercial-data-state="ready"]`,
      )
      .first(),
  ).toBeVisible();
}

async function openAuthenticatedWorkspace(page: Page): Promise<void> {
  if (!password) throw new Error('KINGTURF_ADMIN_PASSWORD is required');
  await page.goto('/');
  await page.getByPlaceholder('账号').fill(login);
  await page.getByPlaceholder('密码').fill(password);
  const loggedIn = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/v1/auth/login') && response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: '登录', exact: true }).click();
  const response = await loggedIn;
  expect(response.ok()).toBeTruthy();
  await openRoute(page, 'opportunities');
  await expect(page.getByRole('heading', { name: '商机阶段看板' })).toBeVisible();
}

test('shows approved, rejected, and expired credit evidence', async ({ page }, testInfo) => {
  await openAuthenticatedWorkspace(page);
  await openRoute(page, 'credit-review');
  const workbench = page.locator('.credit-workbench');
  await expect(workbench).toBeVisible();
  const seeded = workbench.locator('.qtc-card', { hasText: '申请 ¥950,000' });
  await expect(seeded).toHaveCount(3);
  await expect(seeded.filter({ hasText: '信用已批准' })).toContainText('敞口 ¥0');
  await expect(seeded.filter({ hasText: '信用已拒绝' }).locator('.qtc-metrics')).toHaveText(
    '申请 ¥950,000 · 敞口 ¥0 · 额度 ¥5,000,000',
  );
  await expect(seeded.filter({ hasText: '信用已过期' }).locator('.qtc-metrics')).toHaveText(
    '申请 ¥950,000 · 敞口 ¥0 · 额度 ¥5,000,000',
  );
  await expect(seeded).toContainText(['额度 ¥5,000,000', '额度 ¥5,000,000', '额度 ¥5,000,000']);
  await testInfo.attach('credit-outcomes-desktop', {
    body: await workbench.screenshot(),
    contentType: 'image/png',
  });
});

test('shows the released order, partial AR, payment, and reconciliation evidence', async ({
  page,
}, testInfo) => {
  await openAuthenticatedWorkspace(page);
  await openRoute(page, 'sales-orders');
  const order = page.locator('.order-workbench');
  const ar = page.locator('.ar-workbench');
  const payment = page.locator('.payment-workbench');
  await expect(order.getByText('SO-KT-P1-DEMO', { exact: true })).toBeVisible();
  await expect(order.getByText('¥950,000', { exact: true })).toBeVisible();
  await testInfo.attach('order-desktop', {
    body: await order.screenshot(),
    contentType: 'image/png',
  });
  await openRoute(page, 'receivables');
  await expect(ar.getByText('INV-KT-P1-DEMO', { exact: true })).toBeVisible();
  await expect(ar.getByText('未核销 ¥0', { exact: true })).toBeVisible();
  await testInfo.attach('receivable-desktop', {
    body: await ar.screenshot(),
    contentType: 'image/png',
  });
  await openRoute(page, 'payments');
  const seededPayment = payment
    .locator('.qtc-card')
    .filter({ hasText: /BANK-KT-P1-DEMO(?!-FINAL)/u });
  await expect(seededPayment).toBeVisible();
  await expect(seededPayment.getByText(/待核销 0/)).toBeVisible();
  await expect(payment.getByText(/最近核销 [0-9a-f]{12}/)).toBeVisible();
  await testInfo.attach('payment-reconciliation-desktop', {
    body: await payment.screenshot(),
    contentType: 'image/png',
  });
});

test('keeps the P1 evidence usable on a mobile viewport', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openAuthenticatedWorkspace(page);
  // Fixed assertion sites identify the failed page without exporting raw private diagnostics.
  await openRoute(page, 'credit-review');
  await expect(page.locator('.credit-workbench')).toBeVisible();
  await openRoute(page, 'contracts');
  await expect(page.locator('.contract-workbench')).toBeVisible();
  await openRoute(page, 'sales-orders');
  await expect(page.locator('.order-workbench')).toBeVisible();
  await openRoute(page, 'receivables');
  await expect(page.locator('.ar-workbench')).toBeVisible();
  await openRoute(page, 'payments');
  await expect(page.locator('.payment-workbench')).toBeVisible();
  await openRoute(page, 'commissions');
  await expect(page.locator('.commission-workbench')).toBeVisible();
  await openRoute(page, 'order-360');
  await expect(page.locator('.order-360-workbench')).toBeVisible();
  await openRoute(page, 'business-risks');
  await expect(page.locator('.risk-workbench')).toBeVisible();
  await openRoute(page, 'overview');
  await expect(page.locator('.executive-dashboard')).toBeVisible();
  await openRoute(page, 'manufacturing-master');
  await expect(page.locator('.manufacturing-workbench')).toBeVisible();
  await openRoute(page, 'procurement');
  await expect(page.locator('.procurement-workbench')).toBeVisible();
  await openRoute(page, 'material-planning');
  await expect(page.locator('.mrp-workbench')).toBeVisible();
  await openRoute(page, 'production-orders');
  await expect(page.getByTestId('production-workbench')).toBeVisible();
  await expect(page.locator('.commercial-workspace textarea[aria-label$="JSON 请求"]')).toHaveCount(
    0,
  );
  await openRoute(page, 'sales-orders');
  await testInfo.attach('order-to-cash-mobile', {
    body: await page.locator('.order-workbench').screenshot(),
    contentType: 'image/png',
  });
});

test('shows the permission-bounded Order 360 summary and evidence timeline', async ({
  page,
}, testInfo) => {
  await openAuthenticatedWorkspace(page);
  await openRoute(page, 'order-360');
  const workbench = page.locator('.order-360-workbench');
  await expect(workbench).toBeVisible();
  const summary = workbench.locator('.order-360-card', { hasText: 'SO-KT-P1-DEMO' });
  await summary.getByRole('button', { name: '查看全链路证据', exact: true }).click();
  const card = workbench.locator('.order-360-detail .order-360-card', { hasText: 'SO-KT-P1-DEMO' });
  await expect(card).toBeVisible();
  await expect(card.getByText('¥950,000 · 已放行', { exact: true })).toBeVisible();
  await expect(
    card.getByText(/报价 Q-KT-P1-DEMO · 信用 已批准 · 合同 CT-KT-P1-DEMO/u),
  ).toBeVisible();
  await expect(card.getByText('当前未发现活动异常', { exact: true })).toBeVisible();
  await expect(card.getByText(/应收 1 · 回款 2 ·/u)).toBeVisible();
  await expect(card.getByText(/佣金 1 · 风险 1 · 证据 18/u)).toBeVisible();
  await expect(card.locator('.order-360-timeline > li')).toHaveCount(18);
  for (const event of [
    'OPPORTUNITY_CREATED',
    'QUOTE_ISSUED',
    'CREDIT_DECIDED',
    'CONTRACT_SIGNED',
    'ORDER_RELEASED',
    'AR_POSTED',
    'PAYMENT_RECEIVED',
    'COMMISSION_CLAWED_BACK',
    'RISK_EVALUATED',
    'RISK_TASK_CLOSED',
  ])
    await expect(card.getByTitle(`事件编码：${event}`, { exact: true }).first()).toBeVisible();
  await testInfo.attach('order-360-evidence-desktop', {
    body: await workbench.screenshot(),
    contentType: 'image/png',
  });
});

test('shows commission economics and the immutable control ledger', async ({ page }, testInfo) => {
  await openAuthenticatedWorkspace(page);
  await openRoute(page, 'commissions');
  const workbench = page.locator('.commission-workbench');
  await expect(workbench).toBeVisible();
  await expect(
    workbench.locator('.version-pin').filter({ hasText: 'COM-KT-P1-2026 第 1 版' }).first(),
  ).toBeVisible();
  const card = workbench.locator('.commission-card', { hasText: 'SO-KT-P1-DEMO' });
  await expect(card.getByText('¥28,500', { exact: true })).toBeVisible();
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

test('shows explainable risk findings and the closed responsibility trail', async ({
  page,
}, testInfo) => {
  await openAuthenticatedWorkspace(page);
  await openRoute(page, 'business-risks');
  const workbench = page.locator('.risk-workbench');
  await expect(workbench).toBeVisible();
  const card = workbench.locator('.risk-card', { hasText: 'SO-KT-P1-DEMO' });
  await expect(card.getByText('高风险 · 45 分', { exact: true })).toBeVisible();
  await expect(card.getByText('已关闭', { exact: true })).toBeVisible();
  await expect(card.getByText(/毛利率低于政策门槛：实际 2410 \/ 门槛 2500/u)).toBeVisible();
  for (const [state, label] of [
    ['OPEN', '待处理'],
    ['ACKNOWLEDGED', '已确认'],
    ['ESCALATED', '已升级'],
    ['CLOSED', '已关闭'],
  ] as const)
    await expect(
      card.getByText(new RegExp(`· ${label} ·`, 'u')),
      `risk state ${state}`,
    ).toBeVisible();
  await testInfo.attach('risk-task-evidence-desktop', {
    body: await workbench.screenshot(),
    contentType: 'image/png',
  });
});

test('shows server-calculated executive KPIs with source and responsibility drilldowns', async ({
  page,
}, testInfo) => {
  await openAuthenticatedWorkspace(page);
  await openRoute(page, 'overview');
  const dashboard = page.locator('.executive-dashboard');
  await expect(dashboard).toBeVisible();
  await expect(dashboard.getByRole('heading', { name: '管理驾驶舱' })).toBeVisible();
  await expect(dashboard.locator('.metric-bookedRevenue')).toContainText('CNY 2058608');
  await expect(dashboard.locator('.metric-grossMargin')).toContainText('CNY 585399');
  await expect(dashboard.locator('.metric-cashCollected')).toContainText('CNY 1550000');
  await expect(dashboard.locator('.metric-openReceivable')).toContainText('CNY 508608');
  await expect(dashboard.locator('.metric-activeRisks')).toContainText('cases 0');
  await expect(
    dashboard.locator('.metric-bookedRevenue').getByText(/来源 sales_orders/u),
  ).toBeVisible();
  await expect(dashboard.getByText(/SO-KT-P1-DEMO/u)).toBeVisible();
  await expect(dashboard.getByText(/高 \/ 45 分 · 已关闭/u)).toBeVisible();
  await testInfo.attach('executive-dashboard-desktop', {
    body: await dashboard.screenshot(),
    contentType: 'image/png',
  });
});

test('shows published manufacturing versions, BOM substitute evidence, and ordered operations', async ({
  page,
}, testInfo) => {
  await openAuthenticatedWorkspace(page);
  await openRoute(page, 'manufacturing-master');
  const workbench = page.locator('.manufacturing-workbench');
  await expect(workbench).toBeVisible();
  await expect(workbench.getByText('FG-KT-PRO-50', { exact: true })).toBeVisible();
  await expect(workbench.getByText('BOM-KT-PRO-50', { exact: true })).toBeVisible();
  await expect(workbench.getByText('RT-KT-PRO-50', { exact: true })).toBeVisible();
  await expect(workbench.getByText('已发布 · 第 1 版')).toHaveCount(6);
  await expect(workbench.getByText('发布版本')).toHaveCount(0);
  await testInfo.attach('manufacturing-master-data-desktop', {
    body: await workbench.screenshot(),
    contentType: 'image/png',
  });
});

test('shows supplier qualification, received purchase order, receipt, and derived lot balance', async ({
  page,
}, testInfo) => {
  await openAuthenticatedWorkspace(page);
  await openRoute(page, 'procurement');
  const workbench = page.locator('.procurement-workbench');
  await expect(workbench).toBeVisible();
  await expect(workbench.getByText(/SUP-KT-YARN-001 · 青岛金特夫草纱战略供应商/u)).toBeVisible();
  await expect(workbench.getByText(/RFQ-KT-YARN-2026-001 · 已签发/u)).toBeVisible();
  await expect(workbench.getByText(/报价 SQ-KT-YARN-2026-001/u)).toBeVisible();
  await expect(workbench.getByText(/PO-KT-YARN-2026-001 · 已收货/u)).toBeVisible();
  await expect(workbench.getByText(/收货 GR-KT-YARN-2026-001/u)).toBeVisible();
  await expect(workbench.getByText(/批次 LOT-KT-YARN-20260920-A/u)).toBeVisible();
  await expect(workbench.getByText(/RAW-A01 · 结存 3704.5/u)).toBeVisible();
  await testInfo.attach('procurement-inventory-desktop', {
    body: await workbench.screenshot(),
    contentType: 'image/png',
  });
});

test('shows recursive MRP explanations, frozen overrides, and released proposal ledgers', async ({
  page,
}, testInfo) => {
  await openAuthenticatedWorkspace(page);
  await openRoute(page, 'material-planning');
  const workbench = page.locator('.mrp-workbench');
  await expect(workbench).toBeVisible();
  await expect(workbench.getByText(/MRP-KT-2026-001 · 已计算/u)).toBeVisible();
  await expect(workbench.locator('.mrp-proposal-card')).toHaveCount(6);
  await expect(workbench.locator('.mrp-proposal-card.frozen')).toHaveCount(3);
  await expect(workbench.getByText('已放行', { exact: true })).toHaveCount(6);
  const longRangeYarn = workbench
    .locator('.mrp-proposal-card', { hasText: 'RM-KT-YARN-12000' })
    .filter({ hasText: '2026-11-15' });
  await expect(longRangeYarn).toContainText('建议 10000');
  await expect(longRangeYarn).toContainText('毛需求 10300');
  await expect(longRangeYarn).toContainText('安全库存 500');
  await expect(longRangeYarn).toContainText('按批量取整为 10000');
  await expect(workbench.getByText(/冻结窗口内：批准必须提供覆盖审批证据/u)).toHaveCount(3);
  await testInfo.attach('mrp-explainable-planning-desktop', {
    body: await workbench.screenshot(),
    contentType: 'image/png',
  });
});

test('shows closed production execution with routing, material, reports, and serialized output', async ({
  page,
}, testInfo) => {
  await openAuthenticatedWorkspace(page);
  await openRoute(page, 'production-orders');
  const workbench = page.getByTestId('production-workbench');
  await expect(workbench).toBeVisible();
  await expect(workbench.getByText(/WO-KT-2026-001 · FG-KT-PRO-50/u)).toBeVisible();
  await expect(workbench.locator('.production-operation.done')).toHaveCount(3);
  await expect(workbench.getByText(/领料 1287.5/u)).toBeVisible();
  await expect(workbench.getByText(/领料 10/u)).toBeVisible();
  await expect(workbench.getByText(/退料 2/u)).toBeVisible();
  await expect(workbench.getByText(/ROLL-KT-2026-001 · 1000.*待检隔离/u)).toBeVisible();
  await expect(workbench.getByText(/草稿 → 已放行 → 进行中 → 已完成 → 已关闭/u)).toBeVisible();
  await testInfo.attach('production-execution-desktop', {
    body: await workbench.screenshot(),
    contentType: 'image/png',
  });
});
