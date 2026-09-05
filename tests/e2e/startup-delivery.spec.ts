import { expect, test } from '@playwright/test';

const session = {
  employeeId: 'startup-test',
  companyId: 'test-company',
  displayName: '启动验收',
  employeeNumber: 'TEST',
  permissions: [],
};
const workspaceAsset = /\/assets\/bootstrap-[^/]+\.(js|css)$/;

test('cold login does not download business JS or CSS, including on a slow connection', async ({
  page,
  context,
}) => {
  const businessRequests: string[] = [];
  page.on('request', (request) => {
    if (workspaceAsset.test(request.url())) businessRequests.push(request.url());
  });
  const cdp = await context.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 150,
    downloadThroughput: 32_000,
    uploadThroughput: 32_000,
  });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('button', { name: '登录', exact: true })).toBeVisible();
  await page.getByRole('textbox', { name: '账号' }).fill('TEST');
  await expect(page.getByRole('textbox', { name: '账号' })).toHaveValue('TEST');
  expect(businessRequests).toEqual([]);
  await page.screenshot({ path: '.test-results/startup-slow-login.png', fullPage: true });
  await cdp.detach();
});

test('shows download progress and waits for business assets only after validating the session', async ({
  page,
}) => {
  let sessionValidated = false;
  await page.addInitScript(() =>
    sessionStorage.setItem('kingturf.session', 'startup-test-session'),
  );
  await page.route('**/api/v1/auth/session', async (route) => {
    sessionValidated = true;
    await route.fulfill({ json: session });
  });
  await page.route(workspaceAsset, async (route) => {
    expect(sessionValidated).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 800));
    await route.continue();
  });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.getByText('登录成功，正在下载业务工作台…')).toBeVisible();
  await expect(page.getByRole('heading', { name: '经营概览', exact: true })).toBeVisible();
  await expect(page.getByPlaceholder('密码')).toHaveCount(0);
});

for (const extension of ['js', 'css']) {
  test(`a failed business ${extension} retains the session and can recover through explicit page refresh`, async ({
    page,
  }) => {
    await page.addInitScript(() =>
      sessionStorage.setItem('kingturf.session', 'startup-test-session'),
    );
    await page.route('**/api/v1/auth/session', (route) => route.fulfill({ json: session }));
    const asset = new RegExp(`/assets/bootstrap-[^/]+\\.${extension}$`);
    await page.route(asset, (route) => route.abort('failed'));
    await page.goto('/');
    await expect(page.getByRole('heading', { name: '加载遇到问题' })).toBeVisible();
    expect(await page.evaluate(() => sessionStorage.getItem('kingturf.session'))).toBe(
      'startup-test-session',
    );
    await page.unroute(asset);
    await page.getByRole('button', { name: '刷新页面获取最新版本' }).click();
    await expect(page.getByRole('heading', { name: '经营概览', exact: true })).toBeVisible();
  });
}

test('a transient session failure is retryable, while only an explicit 401 returns to login', async ({
  page,
}) => {
  await page.addInitScript(() =>
    sessionStorage.setItem('kingturf.session', 'startup-test-session'),
  );
  let status = 503;
  const businessRequests: string[] = [];
  page.on('request', (request) => {
    if (workspaceAsset.test(request.url())) businessRequests.push(request.url());
  });
  await page.route('**/api/v1/auth/session', (route) =>
    route.fulfill({ status, json: { error: { message: 'test failure' } } }),
  );
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '加载遇到问题' })).toBeVisible();
  expect(await page.evaluate(() => sessionStorage.getItem('kingturf.session'))).toBe(
    'startup-test-session',
  );
  status = 401;
  await page.getByRole('button', { name: '重新加载工作台' }).click();
  await expect(page.getByText('登录状态已失效，请重新登录')).toBeVisible();
  expect(await page.evaluate(() => sessionStorage.getItem('kingturf.session'))).toBeNull();
  expect(businessRequests).toEqual([]);
});
