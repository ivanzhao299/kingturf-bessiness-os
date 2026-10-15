import type { AuthorizationContext } from '@kingturf/domain';
import type { PermissionKey } from '@kingturf/types';
import type { ApiDependencies } from '../app.ts';
import type { authorizeQuery } from '../policy.ts';
import { defineRoute, type RouteDefinition } from './types.ts';

type Repository = Pick<NonNullable<ApiDependencies['commissions']>, 'publishPolicyVersion'>;
type Publish = Repository['publishPolicyVersion'];
type ScopeContext = Readonly<Parameters<Publish>[1]>;
type ValidatedPublish = Readonly<{
  repository: Repository;
  publishPolicyVersion: Publish;
  id: Parameters<Publish>[0];
  scopeContext: ScopeContext;
  correlationId: Parameters<Publish>[2];
}>;
type Context = Readonly<{
  repository: () => Repository;
  authorization: AuthorizationContext;
  authorizeQuery: typeof authorizeQuery;
  correlationId: Parameters<Publish>[2];
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

export function commissionPolicyPublishRoutes(context: Context): readonly RouteDefinition[] {
  return [
    defineRoute({
      method: 'POST',
      match: (pathname) => {
        const match = /^\/api\/v1\/commission-policy-versions\/([0-9a-f-]+)\/publish$/u.exec(
          pathname,
        );
        return match ? { params: match.slice(1) } : null;
      },
      validate: (request, match): ValidatedPublish => {
        const body = context.parsers.objectBody(request.body);
        context.parsers.allow(body, []);
        const grant = context.authorizeQuery(context.authorization, 'commission-policy:manage');
        const repository = context.repository();
        const publishPolicyVersion = repository.publishPolicyVersion;
        const id = context.parsers.uuid(match.params[0], 'commissionPolicyVersionId');
        const scopeContext: ScopeContext = {
          actor: context.authorization.actor,
          scopes: grant.scopes,
          anchors: grant.anchors,
        };
        const correlationId = context.correlationId;
        return { repository, publishPolicyVersion, id, scopeContext, correlationId };
      },
      handler: async (_request, _match, validated) => {
        const result: Awaited<ReturnType<Publish>> = await validated.publishPolicyVersion.call(
          validated.repository,
          validated.id,
          validated.scopeContext,
          validated.correlationId,
        );
        return {
          statusCode: 200,
          body: context.mutationDto(result, context.authorization, 'commission-policy:read'),
        };
      },
    }),
  ];
}
