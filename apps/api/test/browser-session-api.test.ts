import { describe, it, expect, vi } from 'vitest';
import { createServer, request as httpRequest } from 'node:http';
import type { AddressInfo } from 'node:net';
import { DEFAULT_BROWSER_SESSION } from '@kingturf/config';
import { buildApp } from '../src/app.ts';
import { incomingSessionHeaders, outgoingHttpHeaders } from '../src/http-session-headers.ts';
import {
  browserSessionFixture,
  browserLogin,
  origin,
  sessionName,
  csrfName,
  correlationId,
  body,
  object,
  setCookies,
  cookieHeader,
  authOnly,
} from './fixtures/browser-session.ts';

describe('S4 browser Cookie API versus explicit machine carrier', () => {
  it('preserves two raw Set-Cookie fields and distinct request headers over real Node HTTP', async () => {
    const f = browserSessionFixture();
    const server = createServer((req, res) => {
      void (async () => {
        const chunks: Buffer[] = [];
        for await (const chunk of req) {
          if (!Buffer.isBuffer(chunk)) throw new Error('Unexpected HTTP chunk');
          chunks.push(chunk);
        }
        const response = await f.app.dispatch({
          ...incomingSessionHeaders(req),
          method: req.method ?? 'GET',
          pathname: req.url ?? '/',
          peerAddress: req.socket.remoteAddress,
          body: chunks.length
            ? (JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown)
            : undefined,
        });
        res.writeHead(response.statusCode, outgoingHttpHeaders(response.headers));
        res.end(JSON.stringify(response.body));
      })().catch(() => {
        res.writeHead(500);
        res.end('{}');
      });
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const port = (server.address() as AddressInfo).port;
    const call = (
      path: string,
      method = 'GET',
      headers: Record<string, string> | string[] = {},
      value?: unknown,
    ) =>
      new Promise<{
        status: number;
        headers: import('node:http').IncomingHttpHeaders;
        raw: string[];
        body: Record<string, unknown>;
      }>((resolve, reject) => {
        const req = httpRequest({ hostname: '127.0.0.1', port, path, method, headers }, (res) => {
          let text = '';
          res.on('data', (chunk: Buffer) => {
            text += chunk.toString('utf8');
          });
          res.on('end', () => {
            resolve({
              status: res.statusCode ?? 0,
              headers: res.headers,
              raw: res.rawHeaders,
              body: text ? (JSON.parse(text) as Record<string, unknown>) : {},
            });
          });
        });
        req.on('error', reject);
        req.setTimeout(5000, () => req.destroy(new Error('unit HTTP timeout')));
        req.end(value === undefined ? undefined : JSON.stringify(value));
      });
    try {
      const context = await call('/api/v1/auth/login-context', 'GET', {
        'x-kingturf-session-intent': 'login',
      });
      const initial = (context.headers['set-cookie'] ?? [])
        .map((line) => line.split(';')[0])
        .join('; ');
      const login = await call(
        '/api/v1/auth/login',
        'POST',
        {
          origin,
          cookie: initial,
          'x-kingturf-csrf': context.body.csrfToken as string,
          'content-type': 'application/json',
        },
        body,
      );
      expect(login.status).toBe(200);
      expect(
        login.raw.filter((name, index) => index % 2 === 0 && name.toLowerCase() === 'set-cookie')
          .length,
      ).toBe(2);
      expect(
        (login.headers['set-cookie'] ?? []).every(
          (line) =>
            line.includes('Path=/') &&
            line.includes('Secure; SameSite=Lax') &&
            !line.includes('Domain='),
        ),
      ).toBe(true);
      expect(login.headers['cache-control']).toBe('no-store');
      expect(login.headers['content-security-policy-report-only']).toBeDefined();
      const cookie = (login.headers['set-cookie'] ?? [])
        .map((line) => line.split(';')[0])
        .join('; ');
      for (const [name, status] of [
        ['Origin', 403],
        ['Authorization', 401],
        ['X-Kingturf-Csrf', 403],
        ['X-Kingturf-Session-Generation', 401],
      ] as const) {
        const headers = [
          'Host',
          `127.0.0.1:${String(port)}`,
          'Cookie',
          cookie,
          'Origin',
          origin,
          'X-Kingturf-Csrf',
          login.body.csrfToken as string,
          'X-Kingturf-Session-Generation',
          login.body.generation as string,
          name,
          'duplicate',
        ];
        expect((await call('/api/v1/auth/logout', 'POST', headers)).status).toBe(status);
      }
      const machine = await call(
        '/api/v1/auth/token-login',
        'POST',
        { 'content-type': 'application/json' },
        body,
      );
      expect(machine.status).toBe(200);
      expect(machine.headers['cache-control']).toBe('no-store');
      expect(machine.headers['set-cookie']).toBeUndefined();
      const bearer = `Bearer ${machine.body.token as string}`;
      expect((await call('/api/v1/auth/session', 'GET', { authorization: bearer })).status).toBe(
        200,
      );
      expect(
        (
          await call('/api/v1/auth/session', 'GET', [
            'Host',
            `127.0.0.1:${String(port)}`,
            'Authorization',
            bearer,
            'Authorization',
            bearer,
          ])
        ).status,
      ).toBe(401);
      const loggedOut = await call('/api/v1/auth/logout', 'POST', {
        cookie,
        origin,
        'x-kingturf-csrf': login.body.csrfToken as string,
        'x-kingturf-session-generation': login.body.generation as string,
      });
      expect(loggedOut.status).toBe(204);
      expect(loggedOut.headers['set-cookie']).toBeUndefined();
      const expired = await call('/api/v1/auth/session', 'GET', { cookie });
      expect(expired.status).toBe(401);
      expect(expired.headers['set-cookie']).toBeUndefined();
    } finally {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) reject(error);
          else resolve();
        });
      });
    }
  });
  it('issues login-only context without authentication and browser login hides raw token', async () => {
    const f = browserSessionFixture();
    const login = await browserLogin(f);
    expect(f.store.resolveSession).not.toHaveBeenCalled();
    expect(Object.keys(object(login.response)).sort()).toEqual([
      'csrfToken',
      'expiresAt',
      'generation',
    ]);
    expect(setCookies(login.response).length).toBe(2);
    expect(
      setCookies(login.response).every(
        (line) => line.includes('; Secure; SameSite=Lax') && !line.includes('Domain='),
      ),
    ).toBe(true);
    expect(setCookies(login.response).filter((line) => line.includes('HttpOnly')).length).toBe(1);
    expect(login.response.headers?.['cache-control']).toBe('no-store');
    expect(login.response.headers?.['x-correlation-id']).toBe(correlationId);
  });
  it('validates body before new security checks, but checks security before S2/auth', async () => {
    const f = browserSessionFixture();
    expect(
      (await f.dispatch({ method: 'POST', pathname: '/api/v1/auth/login', body: {} })).statusCode,
    ).toBe(400);
    expect(
      (await f.dispatch({ method: 'POST', pathname: '/api/v1/auth/login', body })).statusCode,
    ).toBe(403);
    expect(f.store.createSession).not.toHaveBeenCalled();
    expect(f.deps.loginRateLimiter.statistics.pending).toBe(0);
    const recovery = await f.dispatch({
      method: 'GET',
      pathname: '/api/v1/auth/session',
      headers: { 'x-kingturf-session-intent': 'restore' },
    });
    expect(recovery.statusCode).toBe(401);
    expect(recovery.headers?.['cache-control']).toBe('no-store');
  });
  it.each([
    undefined,
    '',
    'null',
    'http://localhost:4173',
    'https://127.0.0.1:4173',
    'http://127.0.0.1:4174',
    'http://127.0.0.1:4173.evil.invalid',
    'http:127.0.0.1:4173',
    'http://127.0.0.1:4173/.',
    'http://127.0.0.1:4173/%2e',
    'http://127.0.0.1:4173\\',
    'http://127.0.0.1:4173/',
    'http://user@127.0.0.1:4173',
    origin + ', ' + origin,
  ])('rejects missing/malformed/nonexact Origin before writes (case %#)', async (value) => {
    const f = browserSessionFixture();
    const login = await browserLogin(f);
    const response = await f.dispatch({
      method: 'POST',
      pathname: '/api/v1/auth/logout',
      headers: {
        ...login.headers,
        origin: value,
        host: '127.0.0.1:4173',
        'x-forwarded-host': '127.0.0.1:4173',
      },
    });
    expect(response.statusCode).toBe(403);
    expect(f.store.revokeSession).not.toHaveBeenCalled();
    expect(response.headers?.['set-cookie']).toBeUndefined();
  });
  it('GET exempts Origin/CSRF but not authentication or supplied generation', async () => {
    const f = browserSessionFixture();
    const login = await browserLogin(f);
    expect(
      (
        await f.dispatch({
          method: 'GET',
          pathname: '/api/v1/auth/session',
          headers: { cookie: authOnly(login.cookie) },
        })
      ).statusCode,
    ).toBe(200);
    expect(
      (
        await f.dispatch({
          method: 'GET',
          pathname: '/api/v1/auth/session',
          headers: { cookie: login.cookie, 'x-kingturf-session-generation': 'invalid' },
        })
      ).statusCode,
    ).toBe(401);
    expect((await f.dispatch({ method: 'GET', pathname: '/api/v1/auth/session' })).statusCode).toBe(
      401,
    );
  });
  it('restores only CSRF, repairs a single bad proof, and leaves ordinary reads unchanged', async () => {
    const f = browserSessionFixture();
    const login = await browserLogin(f);
    for (const suffix of ['', `; ${csrfName}=`, `; ${csrfName}=malformed`]) {
      const response = await f.dispatch({
        method: 'GET',
        pathname: '/api/v1/auth/session',
        headers: {
          cookie: authOnly(login.cookie) + suffix,
          'x-kingturf-session-intent': 'restore',
        },
      });
      expect(response.statusCode).toBe(200);
      expect(setCookies(response).length).toBe(1);
      expect(setCookies(response).every((line) => line.startsWith(csrfName + '='))).toBe(true);
      expect(typeof object(response).csrfToken).toBe('string');
    }
    const ordinary = await f.dispatch({
      method: 'GET',
      pathname: '/api/v1/auth/session',
      headers: { cookie: login.cookie },
    });
    expect(ordinary.statusCode).toBe(200);
    expect(object(ordinary).csrfToken).toBeUndefined();
    expect(setCookies(ordinary).length).toBe(0);
    const reuse = await f.dispatch({
      method: 'GET',
      pathname: '/api/v1/auth/session',
      headers: { cookie: login.cookie, 'x-kingturf-session-intent': 'restore' },
    });
    expect(object(reuse).csrfToken === login.csrf).toBe(true);
    expect(setCookies(reuse).length).toBe(0);
  });
  it.each(['', '=bad', '=bad; __Host-kingturf-session=bad'])(
    'rejects bad/empty/duplicate auth Cookie without machine downgrade (case %#)',
    async (suffix) => {
      const f = browserSessionFixture();
      for (const path of ['/api/v1/auth/login-context', '/api/v1/auth/session']) {
        const response = await f.dispatch({
          method: 'GET',
          pathname: path,
          headers: {
            cookie: sessionName + suffix,
            authorization: 'Bearer synthetic',
            'x-kingturf-session-intent': 'login',
          },
        });
        expect(response.statusCode).toBe(401);
        expect(f.store.resolveSession).not.toHaveBeenCalled();
      }
    },
  );
  it('refuses duplicate CSRF, duplicate raw Origin/Authorization/generation/proof headers', async () => {
    const f = browserSessionFixture();
    const login = await browserLogin(f);
    const duplicate = await f.dispatch({
      method: 'GET',
      pathname: '/api/v1/auth/session',
      headers: {
        cookie: login.cookie + `; ${csrfName}=bad`,
        'x-kingturf-session-intent': 'restore',
      },
    });
    expect(duplicate.statusCode).toBe(401);
    for (const [name, expected] of [
      ['origin', 403],
      ['authorization', 401],
      ['x-kingturf-session-generation', 401],
      ['x-kingturf-csrf', 403],
    ] as const) {
      const response = await f.dispatch({
        method: 'POST',
        pathname: '/api/v1/auth/logout',
        headers: login.headers,
        headersDistinct: { [name]: ['one', 'two'] },
      });
      expect(response.statusCode).toBe(expected);
    }
    expect(f.store.revokeSession).not.toHaveBeenCalled();
  });
  it('rejects old-page generation/proof across sessions, including the same employee', async () => {
    const f = browserSessionFixture();
    const a = await browserLogin(f);
    const b = await browserLogin(f, a.cookie);
    const stale = await f.dispatch({
      method: 'POST',
      pathname: '/api/v1/auth/logout',
      headers: { ...a.headers, cookie: b.cookie },
    });
    expect(stale.statusCode).toBe(401);
    const wrongProof = await f.dispatch({
      method: 'POST',
      pathname: '/api/v1/auth/logout',
      headers: { ...b.headers, 'x-kingturf-csrf': a.csrf },
    });
    expect(wrongProof.statusCode).toBe(403);
    const matchingButCrossSession = await f.dispatch({
      method: 'POST',
      pathname: '/api/v1/auth/logout',
      headers: {
        ...b.headers,
        cookie: authOnly(b.cookie) + `; ${csrfName}=${a.csrf}`,
        'x-kingturf-csrf': a.csrf,
      },
    });
    expect(matchingButCrossSession.statusCode).toBe(403);
    expect(f.store.revokeSession).not.toHaveBeenCalled();
  });
  it('bounds UTF-8 Cookie/header sizes and never downgrades malformed carriers', async () => {
    const f = browserSessionFixture();
    const login = await browserLogin(f);
    expect(
      (
        await f.dispatch({
          method: 'GET',
          pathname: '/api/v1/auth/session',
          headers: { cookie: 'analytics=' + 'é'.repeat(4096), authorization: 'Bearer synthetic' },
        })
      ).statusCode,
    ).toBe(401);
    for (const [name, value, status] of [
      ['origin', 'x'.repeat(2049), 403],
      ['x-kingturf-csrf', 'x'.repeat(257), 403],
      ['x-kingturf-session-generation', 'x'.repeat(44), 401],
    ] as const)
      expect(
        (
          await f.dispatch({
            method: 'POST',
            pathname: '/api/v1/auth/logout',
            headers: { ...login.headers, [name]: value },
          })
        ).statusCode,
      ).toBe(status);
    expect(f.store.revokeSession).not.toHaveBeenCalled();
  });
  it('does not trim malformed session values into valid authenticated cookies', async () => {
    const f = browserSessionFixture();
    const login = await browserLogin(f);
    const valid = authOnly(login.cookie);
    for (const cookie of [valid.replace('=', '= '), valid + ' ', valid.replace('=', '="') + '"']) {
      expect(
        (await f.dispatch({ method: 'GET', pathname: '/api/v1/auth/session', headers: { cookie } }))
          .statusCode,
      ).toBe(401);
    }
    expect(f.store.resolveSession).not.toHaveBeenCalled();
  });
  it('enforces CSRF and generation on every unsafe method before unknown business routing', async () => {
    const f = browserSessionFixture();
    const login = await browserLogin(f);
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']) {
      expect(
        (
          await f.dispatch({
            method,
            pathname: '/api/v1/unmapped',
            headers: { cookie: login.cookie, origin },
          })
        ).statusCode,
      ).toBe(401);
      expect(
        (
          await f.dispatch({
            method,
            pathname: '/api/v1/unmapped',
            headers: { ...login.headers, 'x-kingturf-csrf': undefined },
          })
        ).statusCode,
      ).toBe(403);
      expect(
        (await f.dispatch({ method, pathname: '/api/v1/unmapped', headers: login.headers }))
          .statusCode,
      ).toBe(404);
    }
  });
  it('allows reusable valid proof, and logout/expiry/revocation never set auth Cookie', async () => {
    const f = browserSessionFixture();
    const login = await browserLogin(f);
    for (let i = 0; i < 2; i++)
      expect(
        (await f.dispatch({ method: 'POST', pathname: '/api/v1/unmapped', headers: login.headers }))
          .statusCode,
      ).toBe(404);
    const loggedOut = await f.dispatch({
      method: 'POST',
      pathname: '/api/v1/auth/logout',
      headers: login.headers,
    });
    expect(loggedOut.statusCode).toBe(204);
    expect(loggedOut.headers?.['set-cookie']).toBeUndefined();
    expect(
      (
        await f.dispatch({
          method: 'GET',
          pathname: '/api/v1/auth/session',
          headers: { cookie: login.cookie },
        })
      ).statusCode,
    ).toBe(401);
    const expired = await browserLogin(f, login.cookie);
    for (const session of f.sessions.values()) session.expiresAt = new Date(0);
    const response = await f.dispatch({
      method: 'POST',
      pathname: '/api/v1/auth/logout',
      headers: expired.headers,
    });
    expect(response.statusCode).toBe(401);
    expect(response.headers?.['set-cookie']).toBeUndefined();
  });
  it('retains change-password all-target revocation and no Cookie write (model store)', async () => {
    const f = browserSessionFixture();
    const a = await browserLogin(f);
    const b = await browserLogin(f, a.cookie);
    const other = await browserLogin(f, b.cookie, 'other');
    const response = await f.dispatch({
      method: 'PUT',
      pathname: '/api/v1/auth/credential',
      headers: a.headers,
      body: { currentPassword: 'synthetic-current', password: 'synthetic-new-password' },
    });
    expect(response.statusCode).toBe(204);
    expect(response.headers?.['set-cookie']).toBeUndefined();
    for (const login of [a, b])
      expect(
        (
          await f.dispatch({
            method: 'GET',
            pathname: '/api/v1/auth/session',
            headers: { cookie: login.cookie },
          })
        ).statusCode,
      ).toBe(401);
    expect(
      (
        await f.dispatch({
          method: 'GET',
          pathname: '/api/v1/auth/session',
          headers: { cookie: other.cookie },
        })
      ).statusCode,
    ).toBe(200);
  });
  it('shares proof and live session checks across independent app/auth instances', async () => {
    const f = browserSessionFixture();
    const login = await browserLogin(f);
    const other = buildApp({ ...f.deps, auth: f.createAuth() });
    expect(
      (
        await other.dispatch({
          method: 'POST',
          pathname: '/api/v1/unmapped',
          headers: login.headers,
        })
      ).statusCode,
    ).toBe(404);
    f.sessions.clear();
    expect(
      (
        await other.dispatch({
          method: 'GET',
          pathname: '/api/v1/auth/session',
          headers: { cookie: login.cookie },
        })
      ).statusCode,
    ).toBe(401);
  });
  it('repairs bad CSRF at login-context without validating old/revoked identity', async () => {
    const f = browserSessionFixture();
    const login = await browserLogin(f);
    f.sessions.clear();
    const context = await f.dispatch({
      method: 'GET',
      pathname: '/api/v1/auth/login-context',
      headers: {
        cookie: authOnly(login.cookie) + `; ${csrfName}=bad`,
        'x-kingturf-session-intent': 'login',
      },
    });
    expect(context.statusCode).toBe(200);
    expect(setCookies(context).every((line) => line.startsWith(csrfName + '='))).toBe(true);
    await browserLogin(f, authOnly(login.cookie));
  });
  it('restricts token mint and preserves Bearer-only reads without Cookie/proof additions', async () => {
    const f = browserSessionFixture();
    const response = await f.dispatch({
      method: 'POST',
      pathname: '/api/v1/auth/token-login',
      headers: { 'content-type': 'application/json', 'sec-fetch-mode': 'cors' },
      body,
    });
    expect(response.statusCode).toBe(200);
    expect(Object.keys(object(response)).sort()).toEqual(['expiresAt', 'token']);
    expect(response.headers?.['cache-control']).toBe('no-store');
    expect(setCookies(response).length).toBe(0);
    const bearer = { authorization: `Bearer ${object(response).token as string}` };
    const session = await f.dispatch({
      method: 'GET',
      pathname: '/api/v1/auth/session',
      headers: bearer,
    });
    expect(session.statusCode).toBe(200);
    expect(object(session).generation).toBeUndefined();
    expect(object(session).csrfToken).toBeUndefined();
    expect(setCookies(session).length).toBe(0);
    for (const extra of [{ origin }, { 'sec-fetch-site': 'none' }, { cookie: 'analytics=ok' }]) {
      const result = await f.dispatch({
        method: 'POST',
        pathname: '/api/v1/auth/token-login',
        headers: { 'content-type': 'application/json', ...extra },
        body,
      });
      expect(result.statusCode).toBe(extra.cookie ? 401 : 403);
    }
    expect(
      (await f.dispatch({ method: 'POST', pathname: '/api/v1/auth/token-login', body })).statusCode,
    ).toBe(400);
    expect(
      (
        await f.dispatch({
          method: 'POST',
          pathname: '/api/v1/auth/token-login',
          query: { ignored: 'x' },
          headers: { 'content-type': 'application/json' },
          body,
        })
      ).statusCode,
    ).toBe(400);
    const disabled = browserSessionFixture({
      config: { ...DEFAULT_BROWSER_SESSION, tokenLoginEnabled: false },
    });
    expect(
      (
        await disabled.dispatch({
          method: 'POST',
          pathname: '/api/v1/auth/token-login',
          headers: { 'content-type': 'application/json' },
          body,
        })
      ).statusCode,
    ).toBe(403);
  });
  it('browser and machine logins consume the same S2 account/IP failure window', async () => {
    const f = browserSessionFixture();
    const login = vi.spyOn(f.auth, 'login').mockResolvedValue(null);
    const context = await f.dispatch({
      method: 'GET',
      pathname: '/api/v1/auth/login-context',
      headers: { 'x-kingturf-session-intent': 'login' },
    });
    const headers = {
      origin,
      cookie: cookieHeader(context),
      'x-kingturf-csrf': object(context).csrfToken as string,
    };
    for (let i = 0; i < 10; i++) {
      const machine = i % 2 === 0;
      const response = await f.dispatch({
        method: 'POST',
        pathname: machine ? '/api/v1/auth/token-login' : '/api/v1/auth/login',
        headers: machine ? { 'content-type': 'application/json' } : headers,
        body,
      });
      expect(response.statusCode).toBe(401);
    }
    expect(
      (await f.dispatch({ method: 'POST', pathname: '/api/v1/auth/login', headers, body }))
        .statusCode,
    ).toBe(429);
    expect(
      (
        await f.dispatch({
          method: 'POST',
          pathname: '/api/v1/auth/token-login',
          headers: { 'content-type': 'application/json' },
          body,
        })
      ).statusCode,
    ).toBe(429);
    expect(login).toHaveBeenCalledTimes(10);
  });
});
