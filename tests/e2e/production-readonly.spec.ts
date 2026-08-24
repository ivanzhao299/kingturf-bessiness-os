import { expect, test, type Page } from '@playwright/test';

const login = process.env.KINGTURF_UAT_LOGIN ?? process.env.KINGTURF_ADMIN_LOGIN;
const password = process.env.KINGTURF_UAT_PASSWORD ?? process.env.KINGTURF_ADMIN_PASSWORD;
const expectedRelease = process.env.KINGTURF_EXPECTED_RELEASE_SHA;

async function authenticate(page: Page): Promise<void> {
  if (!login || !password)
    throw new Error('KINGTURF_UAT_LOGIN and KINGTURF_UAT_PASSWORD are required');
  const response = await page.request.post('/api/v1/auth/login', {
    data: { login, password },
  });
  expect(response.ok()).toBeTruthy();
  const body = (await response.json()) as { token: string };
  await page.addInitScript((token) => {
    globalThis.sessionStorage.setItem('kingturf.session', token);
  }, body.token);
}

test('reports healthy immutable production identity', async ({ request }) => {
  for (const path of ['/health', '/ready']) {
    const response = await request.get(path);
    expect(response.ok(), `${path} must be healthy`).toBeTruthy();
  }
  const response = await request.get('/version');
  expect(response.ok()).toBeTruthy();
  const version = (await response.json()) as {
    sha?: string;
    environment?: string;
    builtAt?: string;
  };
  expect(version.environment).toBe('production');
  expect(version.sha).toMatch(/^[0-9a-f]{7,40}$/u);
  expect(version.builtAt).toBeTruthy();
  if (expectedRelease) expect(version.sha).toBe(expectedRelease);
});

for (const viewport of [
  { name: 'desktop', width: 1440, height: 1000 },
  { name: 'mobile', width: 390, height: 844 },
] as const) {
  test(`opens every permission-visible page without browser errors on ${viewport.name}`, async ({
    page,
  }, testInfo) => {
    const browserErrors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') browserErrors.push(`console: ${message.text()}`);
    });
    page.on('pageerror', (error) => browserErrors.push(`page: ${error.message}`));
    await page.setViewportSize(viewport);
    await authenticate(page);
    await page.goto('/');
    await expect(page.locator('.app-shell')).toBeVisible();

    const routes = await page.locator('[data-app-route]').evaluateAll((items) =>
      items.map((item) => ({
        route: (item as HTMLElement).dataset.appRoute ?? '',
        label: item.textContent?.trim() ?? '',
      })),
    );
    expect(routes.length).toBeGreaterThan(0);
    expect(new Set(routes.map((item) => item.route)).size).toBe(routes.length);

    for (const route of routes) {
      await page.locator(`[data-app-route="${route.route}"]`).click();
      await expect(page).toHaveURL(new RegExp(`#/${route.route}$`, 'u'));
      await expect(page.locator('[data-route-view]:visible').first()).toBeVisible();
    }

    await testInfo.attach(`visible-routes-${viewport.name}`, {
      body: Buffer.from(JSON.stringify(routes, null, 2)),
      contentType: 'application/json',
    });
    await testInfo.attach(`workspace-${viewport.name}`, {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
    expect(browserErrors).toEqual([]);
  });
}
