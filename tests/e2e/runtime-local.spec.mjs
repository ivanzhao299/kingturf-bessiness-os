import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { assertTestDatabaseTarget, Database } from '../../packages/database/dist/index.js';

// Explicit opt-in, real local HTTP only. No routes/mocked authentication or default credentials.
const connection = process.env.KINGTURF_RUNTIME_DATABASE_URL;
if (!connection || process.env.KINGTURF_RUNTIME_ACCEPTANCE !== '1')
  throw new Error('Runtime acceptance requires explicitly provisioned isolated test resources');
assertTestDatabaseTarget(connection, process.env.NODE_ENV);
if (!new URL(connection).searchParams.get('options')?.includes('search_path=runtime_web_'))
  throw new Error('Runtime acceptance requires an owned runtime_web schema');

test('real browser proxy login creates a customer with persistence, audit and denied access', async ({
  page,
}) => {
  const login = process.env.KINGTURF_TEST_LOGIN;
  const password = process.env.KINGTURF_TEST_PASSWORD;
  const company = process.env.KINGTURF_TEST_COMPANY;
  if (!login || !password || !company) throw new Error('Synthetic local identity is required');
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('response', (response) => {
    if (response.status() >= 500) errors.push(`Unexpected HTTP ${response.status()}`);
  });
  await page.goto('/');
  await page.getByPlaceholder('账号').fill(login);
  await page.getByPlaceholder('密码').fill(password);
  const loggedIn = page.waitForResponse((response) =>
    response.url().endsWith('/api/v1/auth/login'),
  );
  await page.getByRole('button', { name: '登录', exact: true }).click();
  expect((await loggedIn).status()).toBe(200);
  await expect(page.locator('.app-shell')).toBeVisible();
  await page.getByRole('button', { name: '＋ 新建客户', exact: true }).click();
  await expect(page.locator('dialog.form-dialog')).toBeVisible();
  expect(errors).toEqual([]);
  const name = `Synthetic runtime customer ${randomUUID()}`;
  await page.getByLabel(/^客户名称/u).fill(name);
  await page.getByLabel(/^客户编号/u).fill(`LOCAL-${randomUUID()}`);
  const created = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/v1/customers') && response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: '创建客户', exact: true }).click();
  expect((await created).status()).toBe(201);
  await page.evaluate(() => {
    globalThis.location.hash = 'customers';
  });
  await expect(page.getByText(name, { exact: true }).first()).toBeVisible();
  const denied = await page.evaluate(async () => {
    const token = globalThis.sessionStorage.getItem('kingturf.session') ?? '';
    const result = await fetch('/api/v1/ar-open-items', {
      headers: { authorization: `Bearer ${token}` },
    });
    return { status: result.status, payload: await result.json() };
  });
  expect(denied.status).toBe(403);
  expect(denied.payload).not.toHaveProperty('items');
  expect((await page.request.get('/api/v1/customers')).status()).toBe(401);
  const db = new Database(connection);
  try {
    const saved = await db.query('SELECT id,tenant_id,status FROM customers WHERE name=$1', [name]);
    expect(saved.rows).toHaveLength(1);
    expect(saved.rows[0]).toMatchObject({ tenant_id: company, status: 'PROSPECT' });
    const audit = await db.query(
      "SELECT outcome FROM audit_events WHERE action='customer.created' AND target_id=$1",
      [saved.rows[0]?.id],
    );
    expect(audit.rows).toEqual([{ outcome: 'SUCCESS' }]);
    const authAudit = await db.query(
      "SELECT count(*)::int AS count FROM audit_events WHERE action='auth.login' AND outcome='SUCCESS'",
    );
    expect(authAudit.rows[0]?.count).toBeGreaterThan(0);
  } finally {
    await db.close();
  }
  expect(errors).toEqual([]);
});
