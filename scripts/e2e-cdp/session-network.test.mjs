import assert from 'node:assert/strict';
import http from 'node:http';
import test from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { createSessionGateway, sessionOrigin } from './session-network-gateway.mjs';

test('session network exact raw allowlist rejects queries, normalization and unknown writes', () => {
  const gateway = createSessionGateway([], () => {
    /* safe reports ignored in unit test */
  });
  for (const [method, path] of [
    ['POST', '/api/v1/auth/login'],
    ['GET', '/api/v1/auth/session'],
    ['POST', '/api/v1/employees'],
  ]) {
    assert.equal(gateway.allows(sessionOrigin + path, method), true);
    for (const suffix of ['?x=1', '?', '#x', '#', '/'])
      assert.equal(gateway.allows(sessionOrigin + path + suffix, method), false);
  }
  for (const url of [
    'http://127.0.0.1:4174/api/v1/auth/session',
    'http://user@127.0.0.1:4173/api/v1/auth/session',
    sessionOrigin + '/api/v1/x/../auth/session',
    sessionOrigin + '//api/v1/auth/session',
    sessionOrigin + '/api/v1/%61uth/session',
    sessionOrigin + '/api/v1/unknown',
    sessionOrigin + '/api/v1/auth/session?next=/api',
  ])
    assert.equal(gateway.allows(url, 'GET'), false);
  assert.equal(gateway.allows(sessionOrigin + '/api/v1/auth/token-login', 'POST'), false);
  assert.equal(gateway.allows(sessionOrigin + '/api/v1/auth/session', 'DELETE'), false);
  assert.equal(
    gateway.allows(sessionOrigin + '/api/v1/business-documents?route=opportunities', 'GET'),
    true,
  );
  for (const query of [
    'route=customers',
    'route=opportunities&x=1',
    'route=opportunities&route=opportunities',
    'route=%6fpportunities',
  ])
    assert.equal(
      gateway.allows(sessionOrigin + '/api/v1/business-documents?' + query, 'GET'),
      false,
    );
});

test('real gateway barrier holds headers before client Cookie delivery, not only body', async () => {
  const upstream = http.createServer((_, res) =>
    res.writeHead(204, { 'x-s4-transaction-complete': 'yes' }).end(),
  );
  await new Promise((resolve) => upstream.listen(0, '127.0.0.1', resolve));
  const gateway = createSessionGateway(
    [{ origin: `http://127.0.0.1:${upstream.address().port}` }],
    () => {
      /* safe reports ignored in unit test */
    },
  );
  try {
    await gateway.listen();
    const barrier = gateway.arm('POST', '/api/v1/auth/logout');
    let arrived = false;
    const response = fetch(sessionOrigin + '/api/v1/auth/logout', { method: 'POST' }).then(
      (value) => {
        arrived = true;
        return value;
      },
    );
    await barrier.ready;
    assert.equal(barrier.status, 204);
    assert.equal(barrier.noAuthCookie, true);
    await delay(100);
    assert.equal(arrived, false);
    barrier.release();
    assert.equal((await response).status, 204);
    gateway.assertClean();
  } finally {
    await gateway.close();
    upstream.closeAllConnections();
    await new Promise((resolve) => upstream.close(resolve));
  }
});
