import type { AuthorizationContext } from '@kingturf/domain';
import type { PermissionKey } from '@kingturf/types';
import type { ApiDependencies } from '../app.ts';
import type { AuthorizedQuery } from '../policy.ts';
import { defineRoute, type RouteDefinition } from './types.ts';

type OwnershipRepository = Pick<NonNullable<ApiDependencies['crm']>, 'assign'>;
type AssignArgs = Parameters<OwnershipRepository['assign']>;
type ValidatedOwnership = Readonly<{
  grant: AuthorizedQuery;
  id: AssignArgs[1];
  assigneeId: AssignArgs[2];
  expectedVersion: AssignArgs[3];
  reason: AssignArgs[4];
  reassignment: AssignArgs[7];
}>;
type OwnershipContext = Readonly<{
  repository: OwnershipRepository;
  authorization: AuthorizationContext;
  correlationId: string;
  authorize: (capability: PermissionKey) => AuthorizedQuery;
  mutationDto: (value: Record<string, unknown>) => unknown;
  parsers: Readonly<{
    objectBody: (body: unknown) => Record<string, unknown>;
    allow: (body: Record<string, unknown>, fields: readonly string[]) => void;
    uuid: (value: unknown, name: string) => string;
    expectedVersion: (value: unknown) => number;
    string: (value: unknown, name: string) => string;
  }>;
}>;

export function customerOwnershipRoutes(context: OwnershipContext): readonly RouteDefinition[] {
  const p = context.parsers;
  return [
    defineRoute({
      method: 'POST',
      match: (pathname) => {
        const match = /^\/api\/v1\/customers\/([0-9a-f-]+)\/ownership$/u.exec(pathname);
        return match ? { params: match.slice(1) } : null;
      },
      validate: (request, match): ValidatedOwnership => {
        const capability =
          p.objectBody(request.body).reassignment === true
            ? 'customer-ownership:reassign'
            : 'customer-ownership:assign';
        const grant = context.authorize(capability);
        const body = p.objectBody(request.body);
        p.allow(body, ['assigneeId', 'expectedVersion', 'reason', 'reassignment']);
        return {
          grant,
          id: p.uuid(match.params[0], 'customerId'),
          assigneeId: p.uuid(body.assigneeId, 'assigneeId'),
          expectedVersion: p.expectedVersion(body.expectedVersion),
          reason: p.string(body.reason, 'reason'),
          reassignment: body.reassignment === true,
        };
      },
      handler: async (_request, _match, input) => ({
        statusCode: 200,
        body: context.mutationDto(
          await context.repository.assign(
            'CUSTOMER',
            input.id,
            input.assigneeId,
            input.expectedVersion,
            input.reason,
            context.authorization.actor,
            context.correlationId,
            input.reassignment,
            input.grant.scopes,
            input.grant.anchors,
          ),
        ),
      }),
    }),
  ];
}
