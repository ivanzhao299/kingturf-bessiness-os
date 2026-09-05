import { expect, test, type Page } from '@playwright/test';

// Isolated browser fixtures only: no real customer, provider or production writes.
async function openDocument(
  page: Page,
  state = 'APPROVED',
  bound = true,
  canSend = true,
  configure = false,
) {
  const document = {
    id: '11111111-1111-4111-8111-111111111111',
    templateKey: '01-customers',
    title: '发送验收文档',
    route: 'opportunities',
    currentVersion: 1,
    state,
    ...(bound ? { customerId: 'customer-test', customerName: '隔离测试客户' } : {}),
    versions: [
      {
        version: 1,
        content: { html: '<p>受控测试正文</p>', body: '受控测试正文' },
        changeSummary: '初始版本',
      },
    ],
  };
  await page.addInitScript(() =>
    sessionStorage.setItem('kingturf.session', 'document-test-session'),
  );
  await page.route('**/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/auth/session'))
      return route.fulfill({
        json: {
          employeeId: 'document-test',
          companyId: 'test-company',
          displayName: '文档测试',
          employeeNumber: 'TEST',
          permissions: [
            'customer:read',
            'opportunity:read',
            'business-document:read',
            'business-document:manage',
            'business-document:approve',
            ...(canSend ? ['business-document:send'] : []),
            ...(configure ? ['business-document:configure'] : []),
          ],
        },
      });
    if (path.endsWith('/business-documents/reference-data'))
      return route.fulfill({ json: { customers: [], orders: [], employees: [] } });
    if (path.endsWith(`/business-documents/${document.id}`))
      return route.fulfill({ json: document });
    if (path.endsWith('/business-documents')) return route.fulfill({ json: { items: [document] } });
    return route.fulfill({ json: { items: [] } });
  });
  await page.goto('/#opportunities');
  await page.locator('.business-document-open').first().click();
  await expect(page.locator('.business-document-dialog')).toBeVisible();
}
const editor = (page: Page) => page.locator('.business-document-dialog');
const send = (page: Page) => editor(page).getByRole('button', { name: '发送给客户', exact: true });
const ready = {
  items: [
    { connector: 'EMAIL', label: '企业邮箱', status: 'READY' },
    { connector: 'WECHAT', label: '微信', status: 'UNCONFIGURED' },
  ],
};

test('draft sends give immediate, actionable feedback without requests; approval updates in place', async ({
  page,
}) => {
  await openDocument(page, 'DRAFT');
  let connectorReads = 0;
  await page.route('**/api/v1/document-connectors', (route) => {
    connectorReads++;
    return route.fulfill({ json: { items: [] } });
  });
  await send(page).click();
  await expect(page.locator('.document-send-notice')).toContainText('保存当前内容并提交审核');
  expect(connectorReads).toBe(0);
  await page.getByRole('button', { name: '返回文档' }).click();
  await editor(page).getByLabel('文档正文').fill('尚未保存的修改');
  await editor(page).getByLabel('文档审核意见').fill('提交审核');
  await editor(page).getByRole('button', { name: '提交审核', exact: true }).click();
  await expect(editor(page)).toContainText('正文有未保存的修改');
  await editor(page)
    .getByLabel('文档正文')
    .evaluate((node) => {
      node.innerHTML = '<p>受控测试正文</p>';
    });
  await editor(page).getByRole('button', { name: '提交审核', exact: true }).click();
  await expect(editor(page).getByLabel('文档正文')).toHaveAttribute('contenteditable', 'false');
  await send(page).click();
  await expect(page.locator('.document-send-notice')).toContainText('等待审批人');
  await page.getByRole('button', { name: '去审批', exact: true }).click();
  await expect(editor(page).getByLabel('文档审核意见')).toBeFocused();
  await editor(page).getByLabel('文档审核意见').fill('审核通过');
  await editor(page).getByRole('button', { name: '批准并锁版' }).click();
  await expect(editor(page)).toContainText('已批准锁版');
  await send(page).click();
  await expect(page.locator('.document-send-notice')).toContainText('尚未配置可用发送渠道');
  await expect(page.locator('.document-send-notice')).toContainText('您没有发送渠道配置权限');
  await expect(page.getByRole('button', { name: '前往发送配置' })).toHaveCount(0);
  expect(connectorReads).toBe(1);
  await page.screenshot({ path: '.test-results/document-send-unconfigured.png' });
});

test('missing customer is explained, with mobile feedback fitting the viewport', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openDocument(page, 'DRAFT', false);
  await send(page).click();
  const notice = page.locator('.document-send-notice');
  await expect(notice).toContainText('尚未绑定客户');
  const box = await notice.boundingBox();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(390);
  await page.getByRole('button', { name: '返回文档' }).click();
  await expect(editor(page)).toBeVisible();
});

test('connector read failure can retry and cancelling a pending read never reopens a dialog', async ({
  page,
}) => {
  await openDocument(page);
  await page.route('**/api/v1/document-connectors', (route) =>
    route.fulfill({ status: 503, json: { error: { message: '测试渠道暂不可用' } } }),
  );
  await send(page).click();
  await expect(page.locator('.document-send-notice')).toContainText('未发送任何文档');
  await page.getByRole('button', { name: '返回文档' }).click();
  await page.route('**/api/v1/document-connectors', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 600));
    await route.fulfill({ json: ready });
  });
  await send(page).click();
  await expect(page.locator('.document-send-notice')).toContainText('正在读取');
  await page.getByRole('button', { name: '返回文档' }).click();
  await expect(send(page)).toBeEnabled();
  await page.waitForTimeout(800);
  await expect(page.getByLabel('收件人姓名')).toHaveCount(0);
  await expect(editor(page)).toBeVisible();
});

test('queue submission retains idempotency on retry, blocks double submit and never claims delivery', async ({
  page,
}) => {
  await openDocument(page);
  await page.route('**/api/v1/document-connectors', (route) => route.fulfill({ json: ready }));
  const keys: string[] = [];
  await page.route('**/api/v1/business-documents/*/send', async (route) => {
    keys.push(route.request().headers()['idempotency-key']);
    await new Promise((resolve) => setTimeout(resolve, 150));
    if (keys.length === 1)
      return route.fulfill({ status: 503, json: { error: { message: '响应丢失，请重试' } } });
    return route.fulfill({ status: 202, json: { id: 'test-dispatch', status: 'QUEUED' } });
  });
  await send(page).click();
  await page.getByLabel('收件人姓名').fill('隔离测试收件人');
  await page.getByLabel('邮箱或平台客户标识').fill('isolated-test@example.invalid');
  await expect(page.getByLabel('发送渠道').locator('option')).toHaveCount(1);
  const submit = page.getByRole('button', { name: '确认进入发送队列' });
  const form = page.locator('.entity-form').filter({ has: page.getByLabel('收件人姓名') });
  await submit.click();
  await form.evaluate((node: HTMLFormElement) => node.requestSubmit());
  await expect(page.getByText('响应丢失，请重试', { exact: true })).toBeVisible();
  expect(keys).toHaveLength(1);
  await submit.click();
  await expect(editor(page)).toContainText('尚未确认送达');
  expect(keys).toHaveLength(2);
  expect(keys[0]).toBeTruthy();
  expect(keys[1]).toBe(keys[0]);
  await expect(editor(page)).not.toContainText('已送达');
  await expect(page.getByPlaceholder('密码')).toHaveCount(0);
});

test('send controls remain hidden without sending permission', async ({ page }) => {
  await openDocument(page, 'APPROVED', true, false);
  await expect(send(page)).toBeHidden();
});

test('admin goes directly to configuration, saves without reloading, and returns with unsaved document intact', async ({
  page,
}) => {
  await openDocument(page, 'DRAFT', true, true, true);
  const connector = {
    connector: 'EMAIL',
    label: '企业邮箱',
    status: 'UNCONFIGURED',
    provider: 'TEST_ONLY',
    displayName: '测试企业邮箱',
    version: 0,
  };
  await page.route('**/api/v1/document-connectors', (route) =>
    route.fulfill({ json: { items: [connector] } }),
  );
  let saves = 0;
  await page.route('**/api/v1/document-connectors/EMAIL', (route) => {
    expect(route.request().method()).toBe('PUT');
    expect(route.request().postDataJSON().expectedVersion).toBe(0);
    saves++;
    connector.displayName = '已更新测试名称';
    connector.version = 1;
    return route.fulfill({ json: connector });
  });
  let navigations = 0;
  page.on('framenavigated', (frame) => {
    if (frame === page.mainFrame()) navigations++;
  });
  await editor(page).getByLabel('文档正文').fill('保留的未保存修改');
  await editor(page).getByLabel('本版修改说明').fill('尚未保存的说明');
  await send(page).click();
  await page.getByRole('button', { name: '去保存 / 提交审核' }).click();
  await expect(editor(page).getByLabel('本版修改说明')).toBeFocused();
  await send(page).click();
  await page.getByRole('button', { name: '发送渠道配置', exact: true }).click();
  const settings = page.locator('.document-send-settings');
  await expect(settings).toBeVisible();
  await settings.getByRole('button', { name: '配置', exact: true }).click();
  await page.getByLabel('内部显示名称').fill('已更新测试名称');
  await page.getByRole('button', { name: '保存连接器配置' }).click();
  await expect(settings).toContainText('配置已保存');
  expect(saves).toBe(1);
  await settings.getByRole('button', { name: '返回文档' }).click();
  await expect(editor(page).getByLabel('文档正文')).toHaveText('保留的未保存修改');
  await expect(editor(page).getByLabel('本版修改说明')).toHaveValue('尚未保存的说明');
  expect(navigations).toBe(0);
});

test('approved document navigates to settings from unconfigured feedback and settings read errors can retry on mobile', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openDocument(page, 'APPROVED', true, true, true);
  let reads = 0;
  let currentStatus = 'UNCONFIGURED';
  await page.route('**/api/v1/document-connectors', (route) => {
    reads++;
    if (reads === 2)
      return route.fulfill({ status: 503, json: { error: { message: '配置网络暂不可用' } } });
    return route.fulfill({
      json: {
        items: [
          {
            connector: 'EMAIL',
            label: '企业邮箱',
            status: currentStatus,
            provider: 'TEST_ONLY',
            displayName: '企业邮箱',
            version: 0,
          },
        ],
      },
    });
  });
  await page.route('**/api/v1/document-connectors/EMAIL', (route) => {
    currentStatus = 'READY';
    return route.fulfill({ json: { status: currentStatus } });
  });
  await send(page).click();
  await page.getByRole('button', { name: '前往发送配置' }).click();
  const settings = page.locator('.document-send-settings');
  await expect(settings).toContainText('配置网络暂不可用');
  await settings.getByRole('button', { name: '重试加载配置' }).click();
  await expect(settings.getByRole('button', { name: '配置', exact: true })).toBeVisible();
  const box = await settings.boundingBox();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(390);
  await page.screenshot({ path: '.test-results/document-settings-mobile.png' });
  await settings.getByRole('button', { name: '配置', exact: true }).click();
  await page.getByRole('combobox', { name: /^状态/ }).selectOption('READY');
  await page.getByLabel('安全密钥引用').fill('KINGTURF_CONNECTOR_EMAIL_TEST');
  await page.getByRole('button', { name: '保存连接器配置' }).click();
  await expect(settings).toContainText('配置已保存');
  await settings.getByRole('button', { name: '返回文档' }).click();
  await expect(send(page)).toBeFocused();
  await send(page).click();
  await expect(page.getByLabel('收件人姓名')).toBeVisible();
});
