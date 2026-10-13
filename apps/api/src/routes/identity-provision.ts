import type { AuthorizationContext } from '@kingturf/domain';
import type { ApiDependencies } from '../app.ts';
import { defineRoute, type RouteDefinition } from './types.ts';

type IdentityProvisionContext = Readonly<{
  auth: ApiDependencies['auth'];
  authorization: AuthorizationContext;
  correlationId: string;
  authorize: () => void;
  parsers: Readonly<{
    objectBody: (body: unknown) => Record<string, unknown>;
    allow: (body: Record<string, unknown>, fields: readonly string[]) => void;
    uuid: (value: unknown, name: string) => string;
    string: (value: unknown, name: string) => string;
  }>;
}>;

export function identityProvisionRoutes(
  context: IdentityProvisionContext,
): readonly RouteDefinition[] {
  const p = context.parsers;
  return [
    defineRoute({
      method: 'PUT',
      match: (pathname) => {
        const match = /^\/api\/v1\/employees\/([0-9a-f-]+)\/identity$/u.exec(pathname);
        return match ? { params: match.slice(1) } : null;
      },
      preflight: () => {
        context.authorize();
        return null;
      },
      validate: (request, match) => {
        const body = p.objectBody(request.body);
        p.allow(body, ['login', 'password']);
        return {
          employeeId: p.uuid(match.params[0], 'employeeId'),
          login: p.string(body.login, 'login'),
          password: p.string(body.password, 'password'),
        };
      },
      handler: async (_request, _match, input) => {
        await context.auth.provisionIdentity(
          context.authorization,
          input.employeeId,
          input.login,
          input.password,
          context.correlationId,
        );
        return { statusCode: 204, body: {} };
      },
    }),
  ];
}
