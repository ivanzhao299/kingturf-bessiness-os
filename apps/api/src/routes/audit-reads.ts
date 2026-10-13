import type { AuthorizationContext } from '@kingturf/domain';
import type { ApiDependencies, ApiResponse } from '../app.ts';
import type { AuthorizedQuery } from '../policy.ts';
import { defineRoute, type RouteDefinition } from './types.ts';

type AuditRepository = Pick<NonNullable<ApiDependencies['audit']>, 'list' | 'find'>;
type ListArgs = Parameters<AuditRepository['list']>;
type FindArgs = Parameters<AuditRepository['find']>;
type ListInput = Readonly<{ companyId: ListArgs[0]; filter: ListArgs[1] }>;
type DetailInput = Readonly<{ id: FindArgs[0] }>;
type AuditContext = Readonly<{
  repository: AuditRepository;
  actor: AuthorizationContext['actor'];
  grant: Pick<AuthorizedQuery, 'scopes' | 'anchors'>;
  uuid: (value: unknown, name: string) => string;
  notFound: () => ApiResponse;
}>;
const auditPath = /^\/api\/v1\/audit-events(?:\/([0-9a-f-]+))?$/u;

export function auditReadRoutes(context: AuditContext): readonly RouteDefinition[] {
  return [
    defineRoute({
      method: 'GET',
      match: (pathname) => {
        const match = auditPath.exec(pathname);
        return match && !match[1] ? { params: [] } : null;
      },
      validate: (request): ListInput => {
        const q = request.query ?? {};
        return {
          companyId: context.actor.companyId,
          filter: {
            ...(q.actorId ? { actorId: context.uuid(q.actorId, 'actorId') } : {}),
            ...(q.action ? { action: q.action } : {}),
            ...(q.targetType ? { targetType: q.targetType } : {}),
            ...(q.targetId ? { targetId: context.uuid(q.targetId, 'targetId') } : {}),
            ...(q.correlationId
              ? { correlationId: context.uuid(q.correlationId, 'correlationId') }
              : {}),
            ...(q.from ? { from: q.from } : {}),
            ...(q.to ? { to: q.to } : {}),
            ...(q.cursor ? { cursor: context.uuid(q.cursor, 'cursor') } : {}),
            ...(q.limit ? { limit: Number(q.limit) } : {}),
          },
        };
      },
      handler: async (_request, _match, input) => ({
        statusCode: 200,
        body: await context.repository.list(
          input.companyId,
          input.filter,
          context.grant.scopes,
          context.actor.employeeId,
          context.grant.anchors,
        ),
      }),
    }),
    defineRoute({
      method: 'GET',
      match: (pathname) => {
        const match = auditPath.exec(pathname);
        return match?.[1] ? { params: [match[1]] } : null;
      },
      validate: (_request, match): DetailInput => ({
        id: context.uuid(match.params[0], 'auditEventId'),
      }),
      handler: async (_request, _match, input) => {
        const found = await context.repository.find(
          input.id,
          context.actor.companyId,
          context.grant.scopes,
          context.actor.employeeId,
          context.grant.anchors,
        );
        return found ? { statusCode: 200, body: found } : context.notFound();
      },
    }),
  ];
}
