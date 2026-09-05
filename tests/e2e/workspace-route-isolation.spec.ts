import { expect, test, type Page } from '@playwright/test';

async function prepare(page: Page) {
  await page.addInitScript(() =>
    sessionStorage.setItem('kingturf.session', 'isolated-routing-session'),
  );
  await page.route('**/api/v1/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/auth/session'))
      return route.fulfill({
        json: {
          employeeId: 'routing-admin',
          companyId: 'test-company',
          displayName: '隔离导航管理员',
          permissions: [
            'customer:read',
            'customer-360:read',
            'cost-matrix:read',
            'cost-matrix:manage',
            'quote:read',
            'organization:read',
          ],
        },
      });
    if (path.endsWith('/cost-matrix-summaries'))
      return route.fulfill({ json: { items: [], total: 0, page: 1, pageSize: 20 } });
    if (path.endsWith('/customers'))
      return route.fulfill({
        json: {
          items: [
            { id: 'customer-a', name: '客户甲', customerNumber: 'A', status: 'ACTIVE' },
            { id: 'customer-b', name: '客户乙', customerNumber: 'B', status: 'ACTIVE' },
          ],
        },
      });
    return route.fulfill({ json: { items: [] } });
  });
  await page.goto('/#customers');
  await expect(page.locator('.app-shell')).toBeVisible();
}

async function expectOnlyRoute(page: Page, route: string) {
  await expect(page.locator(`[data-app-route="${route}"]`)).toHaveAttribute('aria-current', 'page');
  const leaked = await page.locator('[data-route-view]').evaluateAll(
    (nodes, active) =>
      nodes
        .filter(
          (node) => !((node as HTMLElement).dataset.routeView ?? '').split(/\s+/).includes(active),
        )
        .filter((node) => node.getClientRects().length > 0)
        .map((node) => (node as HTMLElement).dataset.routeView),
    route,
  );
  expect(leaked).toEqual([]);
  await expect(page.locator(`[data-app-route="${route}"]`)).toHaveAttribute('aria-current', 'page');
}

test('CRM filtering preserves complete role navigation, workspace identity and route handlers', async ({
  page,
}) => {
  await prepare(page);
  const routes = await page
    .locator('[data-app-route]')
    .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-app-route')));
  await page
    .locator('.commercial-workspace')
    .evaluate((node) => node.setAttribute('data-preserved', 'yes'));
  await page.getByPlaceholder('搜索客户名称或编号').fill('客户甲');
  expect(
    await page
      .locator('[data-app-route]')
      .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-app-route'))),
  ).toEqual(routes);
  await expect(page.locator('.commercial-workspace')).toHaveAttribute('data-preserved', 'yes');
  await expect(page.locator('.utility-bar')).toContainText('隔离导航管理员');
  await page.evaluate(() => {
    location.hash = '/costing';
  });
  await expect(page.getByLabel('搜索成本模型')).toBeVisible();
  await expectOnlyRoute(page, 'costing');
  await page.evaluate(() => {
    location.hash = '/customers';
  });
  await expectOnlyRoute(page, 'customers');
  await expect(page.getByPlaceholder('搜索客户名称或编号')).toHaveValue('客户甲');
});

test('late cost results never appear on the quote page, even for a single paint', async ({
  page,
}) => {
  await prepare(page);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let requested!: () => void;
  const requestStarted = new Promise<void>((resolve) => {
    requested = resolve;
  });
  await page.route('**/api/v1/cost-matrix-summaries**', async (route) => {
    requested();
    await gate;
    await route.fulfill({ json: { items: [], total: 0, page: 1, pageSize: 20 } });
  });
  await page.evaluate(() => {
    location.hash = '/costing';
  });
  await page.getByLabel('搜索成本模型').fill('慢请求');
  await requestStarted;
  await page.evaluate(() => {
    location.hash = '/quotes';
  });
  await expectOnlyRoute(page, 'quotes');
  await page.evaluate(() => {
    const probe = { running: true, leaks: [] as string[] };
    Object.assign(window, { routeProbe: probe });
    const tick = () => {
      for (const node of document.querySelectorAll<HTMLElement>('[data-route-view]')) {
        if (
          !(node.dataset.routeView ?? '').split(/\s+/).includes('quotes') &&
          node.getClientRects().length
        )
          probe.leaks.push(node.dataset.routeView ?? '');
      }
      if (probe.running) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  release();
  await expect(page.locator('.cost-matrix-search')).toHaveValue('慢请求');
  await page.waitForTimeout(350);
  expect(
    await page.evaluate(() => {
      const probe = (window as unknown as { routeProbe: { running: boolean; leaks: string[] } })
        .routeProbe;
      probe.running = false;
      return probe.leaks;
    }),
  ).toEqual([]);
  await expectOnlyRoute(page, 'quotes');
});

test('late customer detail response cannot replace the cost page or shrink its navigation', async ({
  page,
}) => {
  await prepare(page);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/api/v1/customers/customer-a/360', async (route) => {
    await gate;
    await route.fulfill({
      json: {
        customer: { id: 'customer-a', name: '客户甲', customerNumber: 'A', status: 'ACTIVE' },
        contacts: [],
        ownership: [],
        activities: [],
        leads: [],
        opportunities: [],
      },
    });
  });
  await page.locator('.customer-row').first().click();
  await page.evaluate(() => {
    location.hash = '/costing';
  });
  await expect(page.getByLabel('搜索成本模型')).toBeVisible();
  release();
  await expect(page.locator('.crm-records .detail h2')).toHaveText('客户甲');
  await expect(page.getByLabel('搜索成本模型')).toBeVisible();
  await expectOnlyRoute(page, 'costing');
});

test('customer detail failures remain actionable without losing the role menu', async ({
  page,
}) => {
  await prepare(page);
  await page.route('**/api/v1/customers/customer-a/360', (route) =>
    route.fulfill({ status: 503, json: { error: { message: '服务暂不可用，请重试' } } }),
  );
  await page.locator('.customer-row').first().click();
  await expect(page.locator('.crm-records [role="alert"]')).toBeVisible();
  await expect(page.locator('[data-app-route="costing"]')).toBeAttached();
  await expectOnlyRoute(page, 'customers');
});
