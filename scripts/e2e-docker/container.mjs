import assert from 'node:assert/strict';
import { createInterface } from 'node:readline';
import { chromium } from '@playwright/test';
import { Database, assertTestDatabaseTarget } from '../../packages/database/dist/index.js';
import { startForwards } from './forward.mjs';
import { runPreviewSpec } from './spec-runner.mjs';

const report = (event, details = {}) => console.log(JSON.stringify({ event, ...details }));
const inputLines = createInterface({ input: process.stdin, crlfDelay: Infinity });
const input = inputLines[Symbol.asyncIterator]();
const cancellation = new AbortController();
const receive = async () => {
  const value = await input.next();
  cancellation.signal.throwIfAborted();
  assert(!value.done, 'private control input closed');
  return JSON.parse(value.value);
};
let relay, browser, database;
let phase = 'setup';
const aborted = new Promise((_, reject) => {
  for (const signal of ['SIGTERM', 'SIGINT'])
    process.once(signal, () => {
      const error = Error('owned container interrupted');
      cancellation.abort(error);
      inputLines.close();
      reject(error);
    });
});
void aborted.catch(() => {
  /* The original promise is raced below. */
});
async function work() {
  const control = await receive();
  relay = await startForwards(control.gateway);
  cancellation.signal.throwIfAborted();
  const pending = verifyAndProbe(control);
  try {
    await Promise.race([pending, relay.failure, aborted]);
  } catch (error) {
    cancellation.abort(error);
    inputLines.close();
    if (browser)
      await browser.close().catch(() => {
        /* Drain owns the final status. */
      });
    await pending.catch(() => {
      /* Do not tear down before in-flight launch/query drains. */
    });
    throw error;
  }
}
async function verifyAndProbe(control) {
  phase = 'pg-read-only-identity';
  assertTestDatabaseTarget(control.connection, 'test');
  database = new Database(control.connection);
  try {
    await database.transaction(async (client) => {
      await client.query('SET TRANSACTION READ ONLY');
      const actual = (
        await client.query(
          'SELECT current_database() AS database,current_schema() AS schema,pg_postmaster_start_time()::text AS started,system_identifier::text AS instance FROM pg_control_system()',
        )
      ).rows[0];
      const marker = (await client.query('SELECT marker FROM channel_marker')).rows[0]?.marker;
      assert.deepEqual({ ...actual, marker }, control.expected, 'host/container identity mismatch');
    });
  } finally {
    await database.close();
    database = null;
  }
  cancellation.signal.throwIfAborted();
  report('pg-verified', {
    readOnly: true,
    sameDatabase: true,
    sameSchema: true,
    sameInstance: true,
    sameHostMarker: true,
  });
  const command = await receive();
  if (command.action === 'verified-only') return;
  if (command.action === 'spec') {
    phase = 'playwright-spec';
    const result = await runPreviewSpec(command, cancellation.signal);
    report('spec-result', result);
    assert.equal(result.exit, 0, 'individual preview spec failed');
    return;
  }
  assert.equal(command.action, 'preflight');
  phase = 'natural-browser-cookie-origin';
  const launching = chromium.launch({ channel: 'chrome', headless: true });
  if (command.fault === 'browser-launch-sigterm')
    setImmediate(() => process.kill(process.pid, 'SIGTERM'));
  browser = await launching;
  cancellation.signal.throwIfAborted();
  const context = await browser.newContext();
  cancellation.signal.throwIfAborted();
  const page = await context.newPage();
  cancellation.signal.throwIfAborted();
  const origins = [];
  page.on('request', (request) => {
    if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/v1/auth/login')
      origins.push(request.allHeaders().then((headers) => headers.origin));
  });
  const response = await page.goto('http://127.0.0.1:4173/', { waitUntil: 'domcontentloaded' });
  cancellation.signal.throwIfAborted();
  assert.equal(response.status(), 200);
  await page.getByPlaceholder('账号').fill(command.user.login);
  cancellation.signal.throwIfAborted();
  await page.getByPlaceholder('密码').fill(command.user.password);
  cancellation.signal.throwIfAborted();
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await page.locator('.app-shell').waitFor();
  cancellation.signal.throwIfAborted();
  phase = 'natural-cookie-attributes';
  const cookies = await context.cookies();
  const auth = cookies.find((cookie) => cookie.name === '__Host-kingturf-session');
  const csrf = cookies.find((cookie) => cookie.name === '__Host-kingturf-csrf');
  assert(auth?.secure && auth.httpOnly && auth.sameSite === 'Lax' && auth.path === '/');
  assert(csrf?.secure && !csrf.httpOnly && csrf.sameSite === 'Lax' && csrf.path === '/');
  assert.equal(await page.evaluate(() => globalThis.isSecureContext), true);
  phase = 'natural-login-origin';
  assert.deepEqual(await Promise.all(origins), ['http://127.0.0.1:4173']);
  const proof = await page.evaluate(async () => {
    const response = await fetch('/api/v1/auth/session', {
      headers: { 'x-kingturf-session-intent': 'restore' },
    });
    if (!response.ok) throw Error('natural restore rejected');
    const restored = await response.json();
    return { csrfToken: restored.csrfToken, generation: restored.generation };
  });
  cancellation.signal.throwIfAborted();
  const restoredCookies = await context.cookies();
  cancellation.signal.throwIfAborted();
  assert.equal(
    restoredCookies.find((item) => item.name === '__Host-kingturf-csrf')?.value,
    proof.csrfToken,
  );
  const cookie = restoredCookies.map((item) => `${item.name}=${item.value}`).join('; ');
  phase = 'missing-null-foreign-origin';
  for (const origin of [undefined, 'null', 'https://foreign.example.invalid']) {
    cancellation.signal.throwIfAborted();
    const denied = await fetch('http://127.0.0.1:4173/api/v1/customers', {
      method: 'POST',
      headers: {
        cookie,
        'content-type': 'application/json',
        'x-kingturf-csrf': proof.csrfToken,
        'x-kingturf-session-generation': proof.generation,
        ...(origin === undefined ? {} : { origin }),
      },
      body: JSON.stringify({ name: 'Must never be written', customerNumber: 'DENIED-DOCKER' }),
      signal: AbortSignal.any([cancellation.signal, AbortSignal.timeout(5000)]),
    });
    cancellation.signal.throwIfAborted();
    assert.equal(denied.status, 403, 'Origin negative must reject');
  }
  phase = 'natural-signed-write';
  cancellation.signal.throwIfAborted();
  const accepted = await page.evaluate(async (snapshot) => {
    const result = await fetch('/api/v1/customers', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-kingturf-csrf': snapshot.csrfToken,
        'x-kingturf-session-generation': snapshot.generation,
      },
      body: JSON.stringify({
        name: 'Docker natural Cookie probe',
        customerNumber: crypto.randomUUID(),
      }),
    });
    return result.status;
  }, proof);
  cancellation.signal.throwIfAborted();
  assert.equal(accepted, 201, 'natural same-origin signed write');
  report('natural-cookie-origin', {
    chrome: browser.version(),
    secureContext: true,
    authHttpOnlySecureLax: true,
    csrfSecureLax: true,
    loginOriginExact: true,
    missingNullForeignOrigin403: 3,
    naturalWrite201: true,
  });
  await context.close();
  await browser.close();
  browser = null;
}
try {
  await work();
  report('container-complete');
} catch {
  report('container-failed', { phase });
  process.exitCode = 1;
} finally {
  if (browser)
    await browser.close().catch(() => {
      process.exitCode = 1;
    });
  if (database)
    await database.close().catch(() => {
      process.exitCode = 1;
    });
  if (relay)
    await relay.close().catch(() => {
      process.exitCode = 1;
    });
  await input.return?.();
  process.stdin.destroy();
}
