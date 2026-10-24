import type { AuthorizationContext } from '@kingturf/domain';
import type { PermissionKey } from '@kingturf/types';
import type { ApiDependencies } from '../app.ts';
import type { authorizeQuery } from '../policy.ts';
import { defineRoute, type RouteDefinition } from './types.ts';

type Repository = Pick<NonNullable<ApiDependencies['manufacturing']>, 'publish'>;
type Publish = Repository['publish'];
type Kind = Parameters<Publish>[0];
type ScopeContext = Readonly<Parameters<Publish>[2]>;
type ValidatedPublish = Readonly<{
  repository: Repository;
  publish: Publish;
  kind: Kind;
  versionId: Parameters<Publish>[1];
  scopeContext: ScopeContext;
  correlationId: Parameters<Publish>[3];
}>;
type Context = Readonly<{
  repository: () => Repository;
  authorization: AuthorizationContext;
  authorizeQuery: typeof authorizeQuery;
  correlationId: Parameters<Publish>[3];
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

export function manufacturingPublishRoutes(context: Context): readonly RouteDefinition[] {
  return [
    defineRoute({
      method: 'POST',
      match: (pathname) => {
        const match =
          /^\/api\/v1\/manufacturing-(item|bom|routing)-versions\/([0-9a-f-]+)\/publish$/u.exec(
            pathname,
          );
        return match ? { params: match.slice(1) } : null;
      },
      validate: (request, match): ValidatedPublish => {
        context.parsers.allow(context.parsers.objectBody(request.body ?? {}), []);
        const kind = match.params[0] as Kind;
        const capability =
          `${kind === 'item' ? 'manufacturing-item' : kind}:manage` as PermissionKey;
        const grant = context.authorizeQuery(context.authorization, capability);
        const repository = context.repository();
        const publish = repository.publish;
        const versionId = context.parsers.uuid(match.params[1], 'versionId');
        const scopeContext: ScopeContext = {
          actor: context.authorization.actor,
          scopes: grant.scopes,
          anchors: grant.anchors,
        };
        const correlationId = context.correlationId;
        return { repository, publish, kind, versionId, scopeContext, correlationId };
      },
      handler: async (_request, _match, validated) => {
        const result: Awaited<ReturnType<Publish>> = await validated.publish.call(
          validated.repository,
          validated.kind,
          validated.versionId,
          validated.scopeContext,
          validated.correlationId,
        );
        const readCapability =
          `${validated.kind === 'item' ? 'manufacturing-item' : validated.kind}:read` as PermissionKey;
        return {
          statusCode: 201,
          body: context.mutationDto(result, context.authorization, readCapability),
        };
      },
    }),
  ];
}
