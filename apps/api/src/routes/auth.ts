import type { AuthorizationContext } from '@kingturf/domain';
import type { ApiDependencies } from '../app.ts';
import { defineRoute, type RouteDefinition } from './types.ts';

type AuthRouteContext = Readonly<{
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
    employees: ApiDependencies['employees'];
  }>;

export function loginRoutes(context: AuthRouteContext): readonly RouteDefinition[] {
  const p = context.parsers;
  return [
    defineRoute({
      method: 'POST',
      match: (path) => (path === '/api/v1/auth/login' ? { params: [] } : null),
      validate: (request) => {
        const body = p.objectBody(request.body);
        return {
          login: p.string(body.login, 'login'),
          password: p.string(body.password, 'password'),
        };
      },
      handler: async (_request, _match, input) => {
        const result = await context.auth.login(input.login, input.password, context.correlationId);
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
      handler: async () => {
        const actor = context.authorization.actor;
        const profile = await context.employees.findById(
          actor.employeeId,
          actor.companyId,
          ['SELF'],
          actor.employeeId,
        );
        return {
          statusCode: 200,
          body: {
            employeeId: actor.employeeId,
            companyId: actor.companyId,
            displayName: profile?.displayName ?? null,
            employeeNumber: profile?.employeeNumber ?? null,
            permissions: [...context.authorization.permissions.keys()].sort(),
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
