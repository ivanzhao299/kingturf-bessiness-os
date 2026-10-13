import type { AuthorizationContext } from '@kingturf/domain';
import type { PermissionKey } from '@kingturf/types';
import type { ApiDependencies } from '../app.ts';
import type { AuthorizedQuery } from '../policy.ts';
import { defineRoute, type RouteDefinition } from './types.ts';

type LifecycleRepository = Pick<NonNullable<ApiDependencies['crm']>, 'transitionCustomer'>;
type LifecycleArgs = Parameters<LifecycleRepository['transitionCustomer']>;
type ValidatedLifecycle = Readonly<{
  grant: AuthorizedQuery;
  id: LifecycleArgs[0];
  status: LifecycleArgs[1];
  expectedVersion: LifecycleArgs[2];
  reason: LifecycleArgs[3];
}>;
type LifecycleContext = Readonly<{
  repository: LifecycleRepository;
  authorization: AuthorizationContext;
  correlationId: string;
  authorize: (capability: PermissionKey, fields: readonly string[]) => AuthorizedQuery;
  mutationDto: (value: Record<string, unknown>) => unknown;
  parsers: Readonly<{
    objectBody: (body: unknown) => Record<string, unknown>;
    allow: (body: Record<string, unknown>, fields: readonly string[]) => void;
    uuid: (value: unknown, name: string) => string;
    string: (value: unknown, name: string) => string;
    expectedVersion: (value: unknown) => number;
  }>;
}>;

export function customerLifecycleRoutes(context: LifecycleContext): readonly RouteDefinition[] {
  const p = context.parsers;
  return [
    defineRoute({
      method: 'PATCH',
      match: (pathname) => {
        const match = /^\/api\/v1\/customers\/([0-9a-f-]+)$/u.exec(pathname);
        return match ? { params: match.slice(1) } : null;
      },
      validate: (request, match): ValidatedLifecycle => {
        const grant = context.authorize('customer:lifecycle', ['status', 'reason']);
        const body = p.objectBody(request.body);
        p.allow(body, ['status', 'reason', 'expectedVersion']);
        return {
          grant,
          id: p.uuid(match.params[0], 'customerId'),
          status: p.string(body.status, 'status') as LifecycleArgs[1],
          expectedVersion: p.expectedVersion(body.expectedVersion),
          reason: p.string(body.reason, 'reason'),
        };
      },
      handler: async (_request, _match, input) => ({
        statusCode: 200,
        body: context.mutationDto(
          await context.repository.transitionCustomer(
            input.id,
            input.status,
            input.expectedVersion,
            input.reason,
            context.authorization.actor,
            context.correlationId,
            input.grant.scopes,
            input.grant.anchors,
          ),
        ),
      }),
    }),
  ];
}
