import { expect, vi } from 'vitest';
import { randomBytes } from 'node:crypto';
import {
  DEFAULT_BROWSER_SESSION,
  DEFAULT_LOGIN_RATE_LIMIT,
  type BrowserSessionConfig,
} from '@kingturf/config';
import type { AuthorizationContext } from '@kingturf/domain';
import {
  buildApp,
  type ApiDependencies,
  type ApiRequest,
  type ApiResponse,
} from '../../src/app.ts';
import {
  AuthenticationService,
  type CredentialStore,
  type PasswordHasher,
} from '../../src/security.ts';
import { LoginRateLimiter } from '../../src/middleware/login-rate-limit.ts';

export const origin = 'http://127.0.0.1:4173';
export const sessionName = '__Host-kingturf-session';
export const csrfName = '__Host-kingturf-csrf';
export const correlationId = '11111111-1111-4111-8111-111111111111';
export const body = { login: 'unit', password: 'synthetic-password' };
export const object = (response: ApiResponse) => response.body as Record<string, unknown>;
export const setCookies = (response: ApiResponse): readonly string[] => {
  const value = response.headers?.['set-cookie'];
  return value === undefined || typeof value === 'string' ? [] : value;
};
export const cookieHeader = (response: ApiResponse) =>
  setCookies(response)
    .map((line) => line.split(';')[0])
    .join('; ');
export const authOnly = (cookie: string) =>
  cookie
    .split('; ')
    .filter((part) => part.startsWith(sessionName + '='))
    .join('; ');

export function browserSessionFixture(
  options: { config?: BrowserSessionConfig; limiter?: LoginRateLimiter } = {},
) {
  const sessions = new Map<string, { employeeId: string; expiresAt: Date }>();
  const context = (employeeId: string): AuthorizationContext => ({
    actor: { employeeId, companyId: 'company' },
    permissions: new Map(),
  });
  const store = {
    findForLogin: vi.fn((login: string) =>
      Promise.resolve({
        identityId: login,
        employeeId: login,
        companyId: 'company',
        passwordHash: 'synthetic-hash',
        identityActive: true,
        employeeActive: true,
        memberActive: true,
      }),
    ),
    createSession: vi.fn((input: Parameters<CredentialStore['createSession']>[0]) => {
      sessions.set(input.tokenHash, { employeeId: input.employeeId, expiresAt: input.expiresAt });
      return Promise.resolve(true);
    }),
    resolveSession: vi.fn((hash: string, now: Date) => {
      const found = sessions.get(hash);
      return Promise.resolve(found && found.expiresAt > now ? context(found.employeeId) : null);
    }),
    revokeSession: vi.fn((hash: string) => Promise.resolve(sessions.delete(hash))),
    findPasswordForEmployee: vi.fn(() => Promise.resolve('synthetic-hash')),
    replacePasswordForEmployee: vi.fn(
      (input: Parameters<CredentialStore['replacePasswordForEmployee']>[0]) => {
        for (const [key, value] of sessions)
          if (value.employeeId === input.employeeId) sessions.delete(key);
        return Promise.resolve();
      },
    ),
    provisionIdentity: vi.fn(() => Promise.resolve('synthetic-identity')),
  } satisfies CredentialStore;
  // Crypto/password correctness belongs to security.test/PG; here only credentials are stubbed.
  const hasher = {
    hash: vi.fn(() => Promise.resolve('synthetic-hash')),
    verify: vi.fn(() => Promise.resolve(true)),
  } as unknown as PasswordHasher;
  const secret = randomBytes(32).toString('base64url');
  const createAuth = () =>
    new AuthenticationService(
      store,
      hasher,
      { secret, ttlSeconds: 3600 },
      { record: vi.fn(() => Promise.resolve()) },
    );
  const auth = createAuth();
  const config = options.config ?? DEFAULT_BROWSER_SESSION;
  const limiter =
    options.limiter ??
    new LoginRateLimiter({ ...DEFAULT_LOGIN_RATE_LIMIT, baseDelayMs: 0, maxDelayMs: 0 });
  const deps = {
    auth,
    employees: {
      findById: vi.fn(() => Promise.resolve({ displayName: 'Unit', employeeNumber: 'U' })),
    } as unknown as ApiDependencies['employees'],
    organizations: {} as ApiDependencies['organizations'],
    loginRateLimiter: limiter,
  };
  const app = buildApp(deps, { browserSession: config });
  const dispatch = (request: ApiRequest) =>
    app.dispatch({
      ...request,
      peerAddress: '127.0.0.1',
      headers: { 'x-correlation-id': correlationId, ...request.headers },
    });
  return { sessions, store, auth, deps, config, createAuth, app, dispatch };
}
type Fixture = ReturnType<typeof browserSessionFixture>;
export async function browserLogin(f: Fixture, oldCookie = '', login = 'unit') {
  const context = await f.dispatch({
    method: 'GET',
    pathname: '/api/v1/auth/login-context',
    headers: { 'x-kingturf-session-intent': 'login', ...(oldCookie ? { cookie: oldCookie } : {}) },
  });
  expect(context.statusCode).toBe(200);
  const loginProof = object(context).csrfToken as string;
  const response = await f.dispatch({
    method: 'POST',
    pathname: '/api/v1/auth/login',
    headers: {
      origin,
      cookie: [authOnly(oldCookie), cookieHeader(context)].filter(Boolean).join('; '),
      'x-kingturf-csrf': loginProof,
    },
    body: { ...body, login },
  });
  expect(response.statusCode).toBe(200);
  const csrf = object(response).csrfToken as string;
  const generation = object(response).generation as string;
  const cookie = cookieHeader(response);
  return {
    response,
    csrf,
    generation,
    cookie,
    headers: {
      origin,
      cookie,
      'x-kingturf-csrf': csrf,
      'x-kingturf-session-generation': generation,
    },
  };
}
