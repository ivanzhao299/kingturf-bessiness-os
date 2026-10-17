import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_LOGIN_RATE_LIMIT } from '@kingturf/config';
import { buildApp, type ApiDependencies, type ApiRequest } from '../src/app.js';
import { LoginRateLimiter } from '../src/middleware/login-rate-limit.js';

const correlationId = '10000000-0000-4000-8000-000000000001';
function fixture(options: { pending?: number; proxies?: readonly string[] } = {}) {
  let time = 0;
  const login = vi.fn<(...args: string[]) => Promise<null | { token: string; expiresAt: string }>>(
    () => Promise.resolve(null),
  );
  const limiter = new LoginRateLimiter(
    {
      ...DEFAULT_LOGIN_RATE_LIMIT,
      maxPending: options.pending ?? 64,
      trustedProxies: options.proxies ?? [],
    },
    () => time,
    () => Promise.resolve(),
  );
  const auth = { login };
  const app = buildApp({
    auth,
    loginRateLimiter: limiter,
  } as unknown as ApiDependencies);
  const dispatch = (changes: Partial<ApiRequest> = {}) =>
    app.dispatch({
      method: 'POST',
      pathname: '/api/v1/auth/token-login',
      body: { login: 'account', password: 'synthetic-password' },
      headers: { 'x-correlation-id': correlationId, 'content-type': 'application/json' },
      peerAddress: '198.51.100.1',
      ...changes,
    });
  return {
    dispatch,
    login,
    auth,
    limiter,
    setTime: (value: number) => {
      time = value;
    },
  };
}

describe('D1 S2 application login middleware', () => {
  it('returns original 401 ten times, then 429 with Retry-After, S1 headers and correlation', async () => {
    const f = fixture();
    for (let index = 0; index < 10; index++) expect((await f.dispatch()).statusCode).toBe(401);
    const limited = await f.dispatch();
    expect(limited).toEqual({
      statusCode: 429,
      headers: {
        'cache-control': 'no-store',
        'retry-after': '900',
        'x-correlation-id': correlationId,
        'x-content-type-options': 'nosniff',
        'x-frame-options': 'SAMEORIGIN',
        'referrer-policy': 'strict-origin-when-cross-origin',

        'content-security-policy-report-only':
          "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'self'",
      },
      body: {
        error: {
          code: 'invalid_request',
          message: 'Too many failed login attempts. Try again later.',
          correlationId,
        },
      },
    });
    expect(f.login).toHaveBeenCalledTimes(10);
    f.setTime(900_000);
    expect((await f.dispatch()).statusCode).toBe(401);
  });
  it('does not alter the original object and field error priority even for a blocked account', async () => {
    const f = fixture();
    for (let index = 0; index < 10; index++) await f.dispatch();
    const expected = [
      [null, 'A JSON object body is required'],
      [{}, 'login is required'],
      [{ login: 'account' }, 'password is required'],
    ] as const;
    for (const [body, message] of expected) {
      const result = await f.dispatch({ body });
      expect(result.statusCode).toBe(400);
      expect(result.body).toEqual({ error: { code: 'invalid_request', message, correlationId } });
    }
    expect(f.login).toHaveBeenCalledTimes(10);
    const missing = await buildApp().dispatch({
      method: 'POST',
      pathname: '/api/v1/auth/login',
      body: null,
    });
    expect(missing.statusCode).toBe(503);
    expect(missing.body).toMatchObject({
      error: { message: 'Application dependencies are unavailable' },
    });
  });
  it('preserves login receiver, trimmed inputs, successful body and exceptions without counting', async () => {
    const f = fixture();
    const result = { token: 'synthetic-success', expiresAt: '2030-01-01' };
    f.login.mockResolvedValue(result);
    const success = await f.dispatch({
      body: { login: ' Account ', password: ' synthetic-password ', extra: true },
    });
    expect(success.statusCode).toBe(200);
    expect(success.body).toBe(result);
    expect(f.login).toHaveBeenCalledExactlyOnceWith('Account', 'synthetic-password', correlationId);
    expect(f.login.mock.contexts[0]).toBe(f.auth);
    f.login.mockRejectedValue(new Error('synthetic internal error'));
    for (let index = 0; index < 11; index++) {
      const response = await f.dispatch();
      expect(response.statusCode).toBe(500);
      expect(response.headers).toMatchObject({
        'x-correlation-id': correlationId,
        'x-content-type-options': 'nosniff',
        'x-frame-options': 'SAMEORIGIN',
        'referrer-policy': 'strict-origin-when-cross-origin',

        'content-security-policy-report-only':
          "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'self'",
      });
      expect(response.body).toEqual({
        error: { code: 'internal_error', message: 'Internal server error', correlationId },
      });
    }
    f.login.mockResolvedValue(null);
    for (let index = 0; index < 10; index++) expect((await f.dispatch()).statusCode).toBe(401);
    expect((await f.dispatch()).statusCode).toBe(429);
  });
  it('does not let forged forwarding bypass a peer bucket and only accepts configured chains', async () => {
    const direct = fixture();
    for (let index = 0; index < 10; index++)
      await direct.dispatch({
        body: { login: 'a' + String(index), password: 'synthetic-password' },
        forwardedFor: ['203.0.113.' + String(index)],
      });
    expect((await direct.dispatch({ forwardedFor: ['203.0.113.99'] })).statusCode).toBe(429);
    const trusted = fixture({ proxies: ['192.0.2.1'] });
    expect(
      (await trusted.dispatch({ peerAddress: '192.0.2.1', forwardedFor: ['198.51.100.1'] }))
        .statusCode,
    ).toBe(401);
    const invalid = await trusted.dispatch({
      peerAddress: '192.0.2.1',
      forwardedFor: ['not-an-ip'],
    });
    expect(invalid.statusCode).toBe(503);
    expect(invalid.headers?.['retry-after']).toBe('1');
    expect(trusted.login).toHaveBeenCalledOnce();
  });
  it('bounds pending work using 503 instead of pretending that in-flight success is failure', async () => {
    const f = fixture({ pending: 1 });
    let finish: (value: null) => void = () => undefined;
    f.login.mockImplementationOnce(
      () =>
        new Promise<null>((resolve) => {
          finish = resolve;
        }),
    );
    const first = f.dispatch();
    for (let index = 0; index < 20; index++) await Promise.resolve();
    const rejected = await f.dispatch();
    expect(rejected.statusCode).toBe(503);
    expect(rejected.headers).toMatchObject({
      'x-correlation-id': correlationId,
      'x-content-type-options': 'nosniff',
      'x-frame-options': 'SAMEORIGIN',
      'referrer-policy': 'strict-origin-when-cross-origin',

      'content-security-policy-report-only':
        "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'self'",
    });
    expect(rejected.headers?.['retry-after']).toBe('1');
    expect(f.login).toHaveBeenCalledOnce();
    finish(null);
    expect((await first).statusCode).toBe(401);
    expect((await f.dispatch()).statusCode).toBe(401);
  });
  it('wires only socket peer and distinct forwarding values through transport', () => {
    const source = readFileSync(new URL('../src/server.ts', import.meta.url), 'utf8');
    expect(source).toContain('peerAddress: request.socket.remoteAddress');
    expect(source).toContain("forwardedFor: request.headersDistinct['x-forwarded-for']");
    expect(source).not.toContain("peerAddress: request.headers['x-real-ip']");
  });
  it('documents and forwards every S2 config key without relying on env-file magic', () => {
    const example = readFileSync(new URL('../../../.env.example', import.meta.url), 'utf8');
    const compose = readFileSync(
      new URL('../../../infra/docker/compose.production.yaml', import.meta.url),
      'utf8',
    );
    for (const suffix of [
      'ENABLED',
      'FAILURES',
      'WINDOW_SECONDS',
      'BASE_DELAY_MS',
      'MAX_DELAY_MS',
      'MAX_BUCKETS',
      'MAX_PENDING',
      'TRUSTED_PROXIES',
    ]) {
      const key = 'LOGIN_RATE_LIMIT_' + suffix;
      expect(example.includes(key + '=')).toBe(true);
      expect(compose.includes(key + ': ${' + key + ':-')).toBe(true);
    }
  });
});
