import type { AuthorizationContext } from '@kingturf/domain';
import type { PermissionKey } from '@kingturf/types';
import type { ApiDependencies } from '../app.ts';
import type { authorizeQuery } from '../policy.ts';
import { defineRoute, type RouteDefinition } from './types.ts';

type Repository = Pick<
  NonNullable<ApiDependencies['procurement']>,
  'issueRfq' | 'issuePurchaseOrder'
>;
type Issue = Repository['issueRfq'] | Repository['issuePurchaseOrder'];
type ScopeContext = Readonly<Parameters<Issue>[1]>;
type ValidatedIssue = Readonly<{
  repository: Repository;
  issue: Issue;
  id: Parameters<Issue>[0];
  scopeContext: ScopeContext;
  correlationId: Parameters<Issue>[2];
}>;
type Context = Readonly<{
  repository: () => Repository;
  authorization: AuthorizationContext;
  authorizeQuery: typeof authorizeQuery;
  correlationId: Parameters<Issue>[2];
  parsers: Readonly<{
    objectBody: (value: unknown) => Record<string, unknown>;
    allow: (body: Record<string, unknown>, fields: readonly string[]) => void;
    uuid: (value: unknown, name: string) => string;
  }>;
  mutationDto: <T extends Record<string, unknown>>(
    value: T,
    authorization: AuthorizationContext,
    readCapability: PermissionKey,
  ) => Partial<T>;
}>;

export function procurementIssueRoutes(context: Context): readonly RouteDefinition[] {
  return [
    defineRoute({
      method: 'POST',
      match: (pathname) => {
        const match = /^\/api\/v1\/(procurement-rfqs|purchase-orders)\/([0-9a-f-]+)\/issue$/u.exec(
          pathname,
        );
        return match ? { params: match.slice(1) } : null;
      },
      validate: (request, match): ValidatedIssue => {
        context.parsers.allow(context.parsers.objectBody(request.body ?? {}), []);
        const grant = context.authorizeQuery(context.authorization, 'procurement:manage');
        const id = context.parsers.uuid(match.params[1], 'documentId');
        const method = match.params[0] === 'procurement-rfqs' ? 'issueRfq' : 'issuePurchaseOrder';
        const repository = context.repository();
        const issue = repository[method];
        const scopeContext: ScopeContext = {
          actor: context.authorization.actor,
          scopes: grant.scopes,
          anchors: grant.anchors,
        };
        const correlationId = context.correlationId;
        return { repository, issue, id, scopeContext, correlationId };
      },
      handler: async (_request, _match, validated) => {
        const result: Awaited<ReturnType<Issue>> = await validated.issue.call(
          validated.repository,
          validated.id,
          validated.scopeContext,
          validated.correlationId,
        );
        return {
          statusCode: 201,
          body: context.mutationDto(result, context.authorization, 'procurement:read'),
        };
      },
    }),
  ];
}
