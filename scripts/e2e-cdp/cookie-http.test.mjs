import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import net from 'node:net';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  cookieHttpMode,
  cookieHttpReportData,
  allowsCookieHttpRequest,
  createCookieHttpFixture,
} from './cookie-http.mjs';

const origin = 'http://127.0.0.1:4173';
const request = (port, path, method = 'GET', headers = {}) =>
  new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port, path, method, headers }, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () =>
        resolve({ status: res.statusCode, headers: res.headers, raw: res.rawHeaders, body }),
      );
    });
    req.on('error', reject);
    req.setTimeout(2000, () => req.destroy(new Error('test HTTP timeout')));
    req.end(method === 'POST' ? '{}' : undefined);
  });
const rawText = (raw) =>
  raw.reduce(
    (lines, value, index) => (index % 2 ? lines : `${lines}${value}: ${raw[index + 1]}\r\n`),
    'HTTP/1.1 200 OK\r\n',
  );
const login = async (port) => {
  const response = await request(port, '/__cookie-http/login', 'POST', { origin });
  return {
    response,
    cookie: response.headers['set-cookie'].map((line) => line.split(';')[0]).join('; '),
    proof: JSON.parse(response.body).csrfToken,
  };
};

test('Cookie mode is explicitly opt-in and mutually exclusive with both old suites', () => {
  assert.equal(cookieHttpMode([]), false);
  assert.equal(cookieHttpMode(['--cookie-http-preflight']), true);
  for (const other of ['--probes', '--csp-observe'])
    assert.throws(() => cookieHttpMode(['--cookie-http-preflight', other]), /separate opt-in/);
  const marker = 'synthetic-sensitive-marker';
  for (const kind of [
    'launch',
    'listen',
    'http-version',
    'connect-failure',
    'cdp-version',
    'blocked',
    'unrecognized',
  ]) {
    const text = JSON.stringify(
      cookieHttpReportData(kind, {
        error: marker,
        profile: marker,
        flags: [marker],
        listeners: [{ LocalAddress: marker }],
      }),
    );
    assert.equal(text.includes(marker), false);
  }
  assert.deepEqual(cookieHttpReportData('blocked', { error: 'C7: synthetic' }), {
    category: 'secure-cookie-transport-failed-C7',
  });
});

test('actual entry enforces exclusivity before creating Chrome or HTTP resources', () => {
  const entry = fileURLToPath(new URL('./preflight.mjs', import.meta.url));
  for (const other of ['--probes', '--csp-observe']) {
    const result = spawnSync(
      process.execPath,
      [entry, '--cookie-http-preflight', other, '--fault-after-profile'],
      { encoding: 'utf8', timeout: 15000 },
    );
    assert.equal(result.status, 1);
    assert.equal(result.stdout === '', true);
    assert.equal(result.stderr.includes('Cookie HTTP preflight is a separate opt-in suite'), true);
  }
});

test('transport allowlist contains only six exact same-origin method/path pairs', () => {
  for (const [path, method] of [
    ['/', 'GET'],
    ['/cookie-preflight.js', 'GET'],
    ['/favicon.ico', 'GET'],
    ['/__cookie-http/login', 'POST'],
    ['/__cookie-http/session', 'GET'],
    ['/__cookie-http/write', 'POST'],
  ])
    assert.equal(allowsCookieHttpRequest(origin + path, method), true);
});

test('unknown paths, API, cross-origin, query, userinfo and other writes fail closed', () => {
  for (const path of [
    '/api/v1/auth/login',
    '/api',
    '/apix',
    '/__cookie-http/unmapped',
    '/__cookie-http/login/',
  ])
    assert.equal(allowsCookieHttpRequest(origin + path, 'POST'), false);
  for (const url of [
    'http://localhost:4173/',
    'http://127.0.0.1:3000/',
    'https://example.invalid/',
    'http://synthetic@127.0.0.1:4173/',
    origin + '/?x=1',
    origin + '/?',
    origin + '/#fragment',
    'not a URL',
  ])
    assert.equal(allowsCookieHttpRequest(url, 'GET'), false);
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'])
    assert.equal(allowsCookieHttpRequest(origin + '/', method), false);
  assert.equal(allowsCookieHttpRequest(origin + '/__cookie-http/write', 'GET'), false);
});

test('real owned HTTP emits two raw safe Set-Cookie headers and checks round trips', async () => {
  const fixture = createCookieHttpFixture();
  const port = await fixture.listen(0);
  try {
    const { response, cookie, proof } = await login(port);
    assert.equal(response.status, 200);
    assert.equal(response.headers['cache-control'], 'no-store');
    assert.equal(
      response.raw.filter((header, i) => i % 2 === 0 && header.toLowerCase() === 'set-cookie')
        .length,
      2,
    );
    const values = response.headers['set-cookie'];
    assert.equal(
      values.every(
        (v) =>
          /; Path=\/; Max-Age=300;/.test(v) &&
          /; Secure; SameSite=Lax$/.test(v) &&
          !/Domain=/i.test(v),
      ),
      true,
    );
    assert.equal(values.filter((v) => v.includes('; HttpOnly;')).length, 1);
    fixture.observeResponseHeaders(rawText(response.raw));
    assert.equal((await request(port, '/__cookie-http/session', 'GET', { cookie })).status, 200);
    assert.equal(
      (
        await request(port, '/__cookie-http/write', 'POST', {
          cookie,
          origin,
          'x-kingturf-csrf': proof,
        })
      ).status,
      200,
    );
    assert.deepEqual(fixture.snapshot(), {
      counts: { login: 1, read: 1, write: 1, rejected: 0 },
      checks: { origin: true, cookieReturn: true, csrfHeader: true, twoCookies: true },
    });
  } finally {
    assert.equal(await fixture.close(), true);
  }
});

test('raw header observer rejects folding, missing or Domain-modified Cookie evidence', async () => {
  const fixture = createCookieHttpFixture();
  const port = await fixture.listen(0);
  try {
    const { response } = await login(port);
    const values = response.headers['set-cookie'];
    for (const text of [
      `Set-Cookie: ${values.join(', ')}\r\n`,
      `Set-Cookie: ${values[0]}\r\n`,
      rawText(response.raw).replace('Path=/', 'Domain=127.0.0.1; Path=/'),
    ]) {
      fixture.observeResponseHeaders(text);
      assert.equal(fixture.snapshot().checks.twoCookies, false);
    }
    fixture.observeResponseHeaders(rawText(response.raw));
    assert.equal(fixture.snapshot().checks.twoCookies, true);
  } finally {
    await fixture.close();
  }
});

test('missing Cookie, wrong Origin and missing/wrong proof never increment writes', async () => {
  const fixture = createCookieHttpFixture();
  const port = await fixture.listen(0);
  try {
    assert.equal((await request(port, '/__cookie-http/login', 'POST')).status, 403);
    const { cookie, proof } = await login(port);
    assert.equal((await request(port, '/__cookie-http/session')).status, 401);
    for (const headers of [
      { cookie, origin },
      { cookie, origin, 'x-kingturf-csrf': 'wrong' },
      { cookie, origin: 'http://localhost:4173', 'x-kingturf-csrf': proof },
      { cookie, 'x-kingturf-csrf': proof },
    ])
      assert.equal((await request(port, '/__cookie-http/write', 'POST', headers)).status, 403);
    assert.equal((await request(port, '/api/v1/unmapped', 'POST')).status, 404);
    assert.equal(fixture.snapshot().counts.write, 0);
    assert.equal(fixture.snapshot().counts.rejected, 7);
  } finally {
    await fixture.close();
  }
});

test('independent synthetic listener values are not accepted across instances', async () => {
  const a = createCookieHttpFixture();
  const b = createCookieHttpFixture();
  const pa = await a.listen(0);
  const pb = await b.listen(0);
  try {
    const { cookie, proof } = await login(pa);
    assert.equal(
      (
        await request(pb, '/__cookie-http/write', 'POST', {
          cookie,
          origin,
          'x-kingturf-csrf': proof,
        })
      ).status,
      401,
    );
    assert.equal(b.snapshot().counts.write, 0);
  } finally {
    await a.close();
    await b.close();
  }
});

test('owned cleanup closes an idle active connection and is idempotent', async () => {
  const fixture = createCookieHttpFixture();
  const port = await fixture.listen(0);
  const socket = net.connect(port, '127.0.0.1');
  await new Promise((resolve, reject) => {
    socket.once('connect', resolve);
    socket.once('error', reject);
  });
  const closed = new Promise((resolve) => socket.once('close', resolve));
  assert.equal(await fixture.close(), true);
  await closed;
  assert.equal(await fixture.close(), true);
});

test('failed bind does not close another owned listener', async () => {
  const a = createCookieHttpFixture();
  const b = createCookieHttpFixture();
  const port = await a.listen(0);
  try {
    await assert.rejects(b.listen(port), { code: 'EADDRINUSE' });
    assert.equal(await b.close(), true);
    assert.equal((await request(port, '/')).status, 200);
  } finally {
    await a.close();
  }
});
