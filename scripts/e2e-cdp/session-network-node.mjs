import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { sessionOrigin } from './session-network-gateway.mjs';

// Manual Cookie carrier is explicitly Node-instrumented, never natural Chrome evidence.
export async function runNodeOriginMatrix(fixture, check) {
  const call = (path, method = 'GET', headers = {}, body) =>
    fetch(sessionOrigin + '/api/v1' + path, {
      method,
      headers: { 'content-type': 'application/json', ...headers },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(10000),
    });
  const context = await call('/auth/login-context', 'GET', {
    'x-kingturf-session-intent': 'login',
  });
  assert.equal(context.status, 200);
  const proof = (await context.json()).csrfToken;
  const login = await call(
    '/auth/login',
    'POST',
    {
      origin: sessionOrigin,
      cookie: context.headers
        .getSetCookie()
        .map((line) => line.split(';')[0])
        .join('; '),
      'x-kingturf-csrf': proof,
    },
    { login: fixture.a.login, password: fixture.a.password },
  );
  assert.equal(login.status, 200);
  assert.equal(login.headers.get('cache-control'), 'no-store');
  const lines = login.headers.getSetCookie();
  assert.equal(lines.length, 2);
  assert.ok(
    lines.every(
      (line) =>
        /; Path=\/; /u.test(line) &&
        /; Secure; SameSite=Lax/u.test(line) &&
        !/Domain=/iu.test(line),
    ),
  );
  assert.ok(
    lines.find((line) => line.startsWith('__Host-kingturf-session=')).includes('; HttpOnly;'),
  );
  const value = await login.json();
  assert.equal('token' in value, false);
  const headers = {
    cookie: lines.map((line) => line.split(';')[0]).join('; '),
    'x-kingturf-csrf': value.csrfToken,
    'x-kingturf-session-generation': value.generation,
  };
  const body = {
    organizationId: fixture.a.organizationId,
    employeeNumber: randomUUID(),
    displayName: 'S4 Node synthetic',
    email: `${randomUUID()}@example.test`,
  };
  for (const [label, origin] of [
    ['missing', undefined],
    ['null', 'null'],
    ['foreign', 'http://127.0.0.1:4174'],
  ]) {
    await check(`Node-instrumented-Origin-${label}-zero-write`, async () => {
      const before = await fixture.employeeCount();
      const response = await call(
        '/employees',
        'POST',
        { ...headers, ...(origin === undefined ? {} : { origin }) },
        body,
      );
      assert.equal(response.status, 403);
      assert.equal(response.headers.getSetCookie().length, 0);
      assert.equal(await fixture.employeeCount(), before);
    });
  }
  await check('Node-GET-Origin-and-CSRF-exempt-not-auth-exempt', async () => {
    assert.equal((await call('/employees', 'GET', { cookie: headers.cookie })).status, 200);
    assert.equal((await call('/employees', 'GET')).status, 401);
  });
}
