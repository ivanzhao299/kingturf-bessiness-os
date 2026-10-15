import type { AuthorizationContext } from '@kingturf/domain';
import type { PermissionKey } from '@kingturf/types';
import type { ApiDependencies } from '../app.ts';
import type { authorizeQuery } from '../policy.ts';
import { defineRoute, type RouteDefinition } from './types.ts';

type Repository = Pick<NonNullable<ApiDependencies['quality']>, 'publishPlan'>;
type PublishPlan = Repository['publishPlan'];
type PlanVersionId = Parameters<PublishPlan>[0];
type ScopeContext = Readonly<Parameters<PublishPlan>[1]>;
type CorrelationId = Parameters<PublishPlan>[2];
type ValidatedPublish = Readonly<{
  repository: Repository;
  publishPlan: PublishPlan;
  planVersionId: PlanVersionId;
  scopeContext: ScopeContext;
  correlationId: CorrelationId;
}>;
type Context = Readonly<{
  repository: () => Repository;
  authorization: AuthorizationContext;
  authorizeQuery: typeof authorizeQuery;
  correlationId: CorrelationId;
  uuid: (value: unknown, name: string) => string;
  mutationDto: <T extends Record<string, unknown>>(
    value: T,
    authorization: AuthorizationContext,
    readCapability: PermissionKey,
  ) => Partial<T>;
}>;

export function qualityPlanPublishRoutes(context: Context): readonly RouteDefinition[] {
  return [
    defineRoute({
      method: 'POST',
      match: (pathname) => {
        const match = /^\/api\/v1\/quality-plans\/([0-9a-f-]+)\/publish$/u.exec(pathname);
        return match ? { params: match.slice(1) } : null;
      },
      validate: (_request, match): ValidatedPublish => {
        const grant = context.authorizeQuery(context.authorization, 'quality-plan:manage');
        const repository = context.repository();
        const publishPlan = repository.publishPlan;
        const planVersionId: PlanVersionId = context.uuid(match.params[0], 'planVersionId');
        const scopeContext: ScopeContext = {
          actor: context.authorization.actor,
          scopes: grant.scopes,
          anchors: grant.anchors,
        };
        const correlationId = context.correlationId;
        return { repository, publishPlan, planVersionId, scopeContext, correlationId };
      },
      handler: async (_request, _match, validated) => {
        const result: Awaited<ReturnType<PublishPlan>> = await validated.publishPlan.call(
          validated.repository,
          validated.planVersionId,
          validated.scopeContext,
          validated.correlationId,
        );
        return {
          statusCode: 201,
          body: context.mutationDto(result, context.authorization, 'quality-plan:read'),
        };
      },
    }),
  ];
}
