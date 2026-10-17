import type { AuthorizationContext } from '@kingturf/domain';
import { DomainError } from '@kingturf/domain';
import type { BrowserSessionConfig } from '@kingturf/config';
import type { ApiDependencies, ApiRequest, ApiResponse } from '../app.ts';
import {
  formatSessionCookie,
  hasCookieHeader,
  parseSessionCarrier,
  requireMachineContext,
  requireProofPair,
  requireTrustedOrigin,
  sessionHeader,
  SessionRequestError,
  type SessionCarrier,
} from '../middleware/session-carrier.ts';
import type { LoginRateLimiter } from '../middleware/login-rate-limit.ts';
import { defineRoute, type RouteDefinition } from './types.ts';

type AuthRouteContext = Readonly<{
  loginRateLimiter: LoginRateLimiter;
  browserSession: BrowserSessionConfig;
  auth: ApiDependencies['auth'];
  correlationId: string;
  parsers: Readonly<{
    objectBody: (body: unknown) => Record<string, unknown>;
    string: (value: unknown, name: string) => string;
    allow: (body: Record<string, unknown>, fields: readonly string[]) => void;
  }>;
}>;
type SecuredAuthContext = AuthRouteContext &
  Readonly<{
    authorization: AuthorizationContext;
    token: string;
    carrier: SessionCarrier;
    employees: ApiDependencies['employees'];
  }>;

async function authenticateLogin(
  context: AuthRouteContext,
  request: ApiRequest,
  input: Readonly<{ login: string; password: string }>,
  browser: boolean,
): Promise<ApiResponse> {
  const carrier = parseSessionCarrier(request, context.browserSession);
  if (browser) {
    if (carrier.kind === 'bearer')
      throw new SessionRequestError(401, 'Browser login cannot accept Authorization');
    requireTrustedOrigin(request, context.browserSession);
    if (!context.auth.verifyLoginProof(carrier.token, requireProofPair(request, carrier.csrf)))
      throw new SessionRequestError(403, 'A valid login CSRF proof is required');
  } else {
    if (hasCookieHeader(request) || carrier.kind !== 'none')
      throw new SessionRequestError(401, 'Token login requires no Cookie or Authorization');
    requireMachineContext(request);
    if (!context.browserSession.tokenLoginEnabled)
      throw new SessionRequestError(403, 'Token login is disabled');
    if (
      request.hasQuery ||
      Object.keys(request.query ?? {}).length !== 0 ||
      !/^application\/json(?:\s*;\s*charset=utf-8)?$/iu.test(
        sessionHeader(request, 'content-type') ?? '',
      )
    )
      throw new DomainError('invalid_request', 'Token login requires JSON without query');
  }
  const decision = await context.loginRateLimiter.attempt(
    input.login,
    request.peerAddress,
    request.forwardedFor,
    () => context.auth.login(input.login, input.password, context.correlationId),
  );
  if (decision.kind !== 'authenticated') {
    const limited = decision.kind === 'limited';
    return {
      statusCode: limited ? 429 : 503,
      headers: { 'retry-after': limited ? String(decision.retryAfter) : '1' },
      body: {
        error: {
          code: limited ? 'invalid_request' : 'internal_error',
          message: limited
            ? 'Too many failed login attempts. Try again later.'
            : 'Login temporarily unavailable',
          correlationId: context.correlationId,
        },
      },
    };
  }
  const result = decision.value;
  if (browser && result) {
    const age = Math.min(
      context.browserSession.maxAgeSeconds,
      Math.floor((Date.parse(result.expiresAt) - Date.now()) / 1000),
    );
    if (!Number.isFinite(age) || age <= 0)
      throw new SessionRequestError(401, 'Login session expired');
    const csrfToken = context.auth.issueCsrfProof(result.token);
    return {
      statusCode: 200,
      headers: {
        'set-cookie': [
          formatSessionCookie(context.browserSession, false, result.token, age),
          formatSessionCookie(context.browserSession, true, csrfToken, age),
        ],
      },
      body: {
        expiresAt: result.expiresAt,
        generation: context.auth.sessionGeneration(result.token),
        csrfToken,
      },
    };
  }
  return result
    ? { statusCode: 200, body: result }
    : {
        statusCode: 401,
        body: {
          error: {
            code: 'authentication_required',
            message: 'Invalid credentials',
            correlationId: context.correlationId,
          },
        },
      };
}

export function loginRoutes(context: AuthRouteContext): readonly RouteDefinition[] {
  const p = context.parsers;
  const routes = ['/api/v1/auth/login', '/api/v1/auth/token-login'].map((pathname) =>
    defineRoute({
      method: 'POST',
      match: (path) => (path === pathname ? { params: [] } : null),
      validate: (request) => {
        const body = p.objectBody(request.body);
        return {
          login: p.string(body.login, 'login'),
          password: p.string(body.password, 'password'),
        };
      },
      handler: (request, _match, input) =>
        authenticateLogin(context, request, input, pathname === '/api/v1/auth/login'),
    }),
  );
  return [
    ...routes,
    defineRoute({
      method: 'GET',
      match: (path) => (path === '/api/v1/auth/login-context' ? { params: [] } : null),
      validate: null,
      handler: (request) => {
        const carrier = parseSessionCarrier(request, context.browserSession);
        if (carrier.kind === 'bearer')
          throw new SessionRequestError(401, 'Login context cannot accept Authorization');
        if (sessionHeader(request, 'x-kingturf-session-intent') !== 'login')
          throw new SessionRequestError(403, 'Login intent is required');
        const csrfToken = context.auth.issueLoginProof(carrier.token);
        return {
          statusCode: 200,
          headers: {
            'set-cookie': [
              formatSessionCookie(
                context.browserSession,
                true,
                csrfToken,
                Math.min(300, context.browserSession.maxAgeSeconds),
              ),
            ],
          },
          body: { csrfToken },
        };
      },
    }),
  ];
}

export function sessionRoutes(context: SecuredAuthContext): readonly RouteDefinition[] {
  return [
    defineRoute({
      method: 'POST',
      match: (path) => (path === '/api/v1/auth/logout' ? { params: [] } : null),
      validate: null, // The original logout ignores the request body.
      handler: async () => {
        await context.auth.logout(context.token, context.authorization, context.correlationId);
        return { statusCode: 204, body: {} };
      },
    }),
    defineRoute({
      method: 'GET',
      match: (path) => (path === '/api/v1/auth/session' ? { params: [] } : null),
      validate: null, // Bodyless query; fixed SELF scope is not caller-supplied.
      handler: async (request) => {
        const actor = context.authorization.actor;
        const profile = await context.employees.findById(
          actor.employeeId,
          actor.companyId,
          ['SELF'],
          actor.employeeId,
        );
        const cookie = context.carrier.kind === 'cookie';
        const intent = cookie ? sessionHeader(request, 'x-kingturf-session-intent') : undefined;
        if (intent !== undefined && intent !== 'restore')
          throw new SessionRequestError(403, 'Invalid session intent');
        const previous = context.carrier.csrf;
        const reuse =
          previous !== undefined && context.auth.verifyCsrfProof(context.token, previous);
        const csrfToken =
          cookie && intent === 'restore'
            ? reuse
              ? previous
              : context.auth.issueCsrfProof(context.token)
            : undefined;
        return {
          statusCode: 200,
          ...(csrfToken !== undefined && !reuse
            ? {
                headers: {
                  'set-cookie': [formatSessionCookie(context.browserSession, true, csrfToken)],
                },
              }
            : {}),
          body: {
            employeeId: actor.employeeId,
            companyId: actor.companyId,
            displayName: profile?.displayName ?? null,
            employeeNumber: profile?.employeeNumber ?? null,
            permissions: [...context.authorization.permissions.keys()].sort(),
            ...(cookie ? { generation: context.auth.sessionGeneration(context.token) } : {}),
            ...(csrfToken !== undefined ? { csrfToken } : {}),
          },
        };
      },
    }),
  ];
}

export function credentialRoutes(context: SecuredAuthContext): readonly RouteDefinition[] {
  const p = context.parsers;
  return [
    defineRoute({
      method: 'PUT',
      match: (path) => (path === '/api/v1/auth/credential' ? { params: [] } : null),
      validate: (request) => {
        const body = p.objectBody(request.body);
        p.allow(body, ['currentPassword', 'password']);
        return {
          currentPassword: p.string(body.currentPassword, 'currentPassword'),
          password: p.string(body.password, 'password'),
        };
      },
      handler: async (_request, _match, input) => {
        await context.auth.changePassword(
          context.authorization,
          input.currentPassword,
          input.password,
          context.token,
          context.correlationId,
        );
        return { statusCode: 204, body: {} };
      },
    }),
  ];
}
