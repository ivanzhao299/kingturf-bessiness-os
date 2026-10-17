import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createStubRouter } from './fixtures.mjs';
import { classifyRequest } from './network-policy.mjs';
import preview from './csp-preview.config.mjs';
import { CONTENT_SECURITY_POLICY } from '../../packages/config/src/csp.ts';
import {
  createCspSendRouter,
  cspCredentials,
  cspDocumentId,
  cspSendFields,
} from './csp-send-fixtures.mjs';

const origin = 'http://127.0.0.1:4173';
test('opt-in preview gives real HTML report-only headers and has no live API proxy', () => {
  assert.deepEqual(preview.preview.headers, {
    'Content-Security-Policy-Report-Only': CONTENT_SECURITY_POLICY,
  });
  assert.equal(preview.preview.proxy, undefined);
  assert.equal(preview.preview.host, '127.0.0.1');
});
test('outer nginx policy/default-off switch and upstream dedup remain explicitly wired', () => {
  const source = readFileSync(
    new URL('../../infra/nginx/erp.kingturf.cn.conf', import.meta.url),
    'utf8',
  );
  assert.ok(source.includes('set $kingturf_csp_enforce off;'));
  assert.ok(source.includes('set $kingturf_csp_policy "' + CONTENT_SECURITY_POLICY + '";'));
  assert.ok(source.includes('set $kingturf_csp_enforced "";'));
  assert.ok(
    source.includes('proxy_hide_header Content-Security-Policy;') &&
      source.includes('proxy_hide_header Content-Security-Policy-Report-Only;'),
  );
  assert.ok(
    source.includes('add_header Content-Security-Policy-Report-Only $kingturf_csp_policy always;'),
  );
  assert.ok(source.includes('add_header Content-Security-Policy $kingturf_csp_enforced always;'));
});
test('public API enforcement key is passed through compose and the actual server option', () => {
  const root = new URL('../../', import.meta.url);
  // Never print configuration contents, even on assertion failure.
  assert.ok(readFileSync(new URL('.env.example', root), 'utf8').includes('\nCSP_ENFORCE=false\n'));
  assert.ok(
    readFileSync(new URL('infra/docker/compose.production.yaml', root), 'utf8').includes(
      'CSP_ENFORCE: ${CSP_ENFORCE:-false}',
    ),
  );
  assert.ok(
    readFileSync(new URL('apps/api/src/server.ts', root), 'utf8').includes(
      'enforceCsp: config.cspEnforce',
    ),
  );
});
const request = (path, method = 'GET', headers = {}, body) => ({
  url: origin + path,
  method,
  headers,
  ...(body === undefined ? {} : { postData: JSON.stringify(body) }),
});
const call = (router, req) => {
  const url = new URL(req.url);
  return router.respond(url.pathname, req.method, url.searchParams, req);
};
async function loggedIn() {
  const router = createCspSendRouter();
  const result = await call(
    router,
    request('/api/v1/auth/login', 'POST', { 'content-type': 'application/json' }, cspCredentials),
  );
  assert.equal(result.status, 200);
  return {
    router,
    headers: {
      authorization: 'Bearer ' + result.value.token,
      'content-type': 'application/json',
      'idempotency-key': randomUUID(),
    },
  };
}
test('original router still rejects every write without opt-in', async () => {
  const router = createStubRouter();
  for (const path of ['/api/v1/auth/login', `/api/v1/business-documents/${cspDocumentId}/send`])
    await assert.rejects(router.respond(path, 'POST'), /synthetic/u);
});
test('new opt-in login requires actual body/header metadata and exact credentials', async () => {
  for (const mutate of [
    (req) => ({ ...req, postData: undefined }),
    (req) => ({ ...req, method: 'GET' }),
    (req) => ({ ...req, postData: '{}' }),
    (req) => ({ ...req, url: req.url + '?extra=1' }),
    (req) => ({ ...req, headers: { 'content-type': 'text/plain' } }),
  ]) {
    const router = createCspSendRouter();
    const req = request(
      '/api/v1/auth/login',
      'POST',
      { 'content-type': 'application/json' },
      cspCredentials,
    );
    await assert.rejects(call(router, mutate(req)), /synthetic/u);
    assert.equal(router.counts().cspLogin, undefined);
  }
});
test('opt-in approved document/READY connector/send exact payload yield synthetic queue receipt', async () => {
  const { router, headers } = await loggedIn();
  const doc = await call(
    router,
    request(`/api/v1/business-documents/${cspDocumentId}`, 'GET', headers),
  );
  assert.equal(doc.value.state, 'APPROVED');
  assert.equal(typeof doc.value.customerId, 'string');
  const connectors = await call(router, request('/api/v1/document-connectors', 'GET', headers));
  assert.equal(connectors.value.items[0].status, 'READY');
  const sent = await call(
    router,
    request(`/api/v1/business-documents/${cspDocumentId}/send`, 'POST', headers, {
      expectedVersion: 1,
      channel: 'EMAIL',
      ...cspSendFields,
    }),
  );
  assert.equal(sent.status, 202);
  assert.equal(sent.value.status, 'QUEUED');
  assert.equal(router.counts().cspSend, 1);
});
for (const [name, mutate] of [
  ['wrong origin', (req) => ({ ...req, url: req.url.replace(origin, 'https://example.invalid') })],
  ['unknown POST', (req) => ({ ...req, url: origin + '/api/v1/unmapped' })],
  ['wrong document', (req) => ({ ...req, url: req.url.replace(cspDocumentId, randomUUID()) })],
  ['wrong method', (req) => ({ ...req, method: 'PUT' })],
  ['extra query', (req) => ({ ...req, url: req.url + '?extra=1' })],
  ['missing body', (req) => ({ ...req, postData: undefined })],
  [
    'extra body field',
    (req) => ({
      ...req,
      postData: JSON.stringify({
        expectedVersion: 1,
        channel: 'EMAIL',
        ...cspSendFields,
        extra: true,
      }),
    }),
  ],
  [
    'wrong version',
    (req) => ({
      ...req,
      postData: JSON.stringify({ expectedVersion: 2, channel: 'EMAIL', ...cspSendFields }),
    }),
  ],
  [
    'missing authorization',
    (req) => ({
      ...req,
      headers: { 'content-type': 'application/json', 'idempotency-key': randomUUID() },
    }),
  ],
  [
    'invalid idempotency',
    (req) => ({ ...req, headers: { ...req.headers, 'idempotency-key': 'invalid' } }),
  ],
])
  test(`opt-in send rejects ${name} without accepting any write`, async () => {
    const { router, headers } = await loggedIn();
    const req = request(`/api/v1/business-documents/${cspDocumentId}/send`, 'POST', headers, {
      expectedVersion: 1,
      channel: 'EMAIL',
      ...cspSendFields,
    });
    await assert.rejects(call(router, mutate(req)), /synthetic/u);
    assert.equal(router.counts().cspSend, undefined);
  });
test('same exact payload binds the first random idempotency key; replacement key rejects', async () => {
  const { router, headers } = await loggedIn();
  const req = request(`/api/v1/business-documents/${cspDocumentId}/send`, 'POST', headers, {
    expectedVersion: 1,
    channel: 'EMAIL',
    ...cspSendFields,
  });
  await call(router, req);
  await assert.rejects(
    call(router, { ...req, headers: { ...headers, 'idempotency-key': randomUUID() } }),
    /synthetic/u,
  );
  assert.equal(router.counts().cspSend, 1);
});
test('UUID-shaped keys with invalid version or variant cannot pass the synthetic send gate', async () => {
  const { router, headers } = await loggedIn();
  for (const key of [
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-4000-0000-000000000000',
  ]) {
    const req = request(
      `/api/v1/business-documents/${cspDocumentId}/send`,
      'POST',
      { ...headers, 'idempotency-key': key },
      { expectedVersion: 1, channel: 'EMAIL', ...cspSendFields },
    );
    await assert.rejects(call(router, req), /synthetic/u);
  }
  assert.equal(router.counts().cspSend, undefined);
});
test('network hard gate rejects external origins/writes before static continuation', () => {
  assert.equal(classifyRequest('https://example.invalid/api/v1/auth/login', 'POST'), 'blocked');
  assert.equal(classifyRequest(origin + '/assets/synthetic.js', 'POST'), 'blocked');
  assert.equal(classifyRequest(origin + '/api/v1/unmapped', 'POST'), 'api');
});
test('preflight opt-in installs collector before first navigation and passes actual request metadata', () => {
  const source = readFileSync(new URL('./preflight.mjs', import.meta.url), 'utf8');
  assert.ok(
    source.indexOf('await cspObserver.install(') <
      source.indexOf("const navigation = await cdp('Page.navigate'"),
  );
  assert.ok(source.includes('...(cspMode ? [msg.params.request] : [])'));
  const probes = readFileSync(new URL('./csp-send-probes.mjs', import.meta.url), 'utf8');
  assert.ok(!probes.includes('syntheticSessionInit') && !probes.includes('sessionStorage.setItem'));
  assert.ok(probes.includes('await page.fill(\'input[name="password"]\''));
});
