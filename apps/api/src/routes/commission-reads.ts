import type { AuthorizationContext } from '@kingturf/domain';
import type { PermissionKey } from '@kingturf/types';
import type { ApiDependencies } from '../app.ts';
import type { authorizeQuery } from '../policy.ts';
import { defineRoute, type RouteDefinition } from './types.ts';

type Repository = Pick<NonNullable<ApiDependencies['commissions']>, 'listPolicies' | 'listCases'>;
type Method = keyof Repository;
type List = Repository[Method];
type ScopeContext = Readonly<Parameters<List>[0]>;
type Items = Awaited<ReturnType<List>>;
type ValidatedRead = Readonly<{
  repository: Repository;
  list: List;
  scopeContext: ScopeContext;
}>;
type Context = Readonly<{
  repository: () => Repository;
  authorization: AuthorizationContext;
  authorizeQuery: typeof authorizeQuery;
  permittedDto: <T extends Record<string, unknown>>(
    value: T,
    fields: readonly string[] | null,
  ) => Partial<T>;
}>;
type Read = Readonly<{ path: string; capability: PermissionKey; method: Method }>;
const reads = [
  {
    path: '/api/v1/commission-policies',
    capability: 'commission-policy:read',
    method: 'listPolicies',
  },
  { path: '/api/v1/commissions', capability: 'commission:read', method: 'listCases' },
] as const satisfies readonly Read[];

export function commissionReadRoutes(context: Context): readonly RouteDefinition[] {
  return reads.map((read) =>
    defineRoute({
      method: 'GET',
      match: (pathname) => (pathname === read.path ? { params: [] } : null),
      validate: (): ValidatedRead => {
        const grant = context.authorizeQuery(context.authorization, read.capability);
        const repository = context.repository();
        const list = repository[read.method];
        const scopeContext: ScopeContext = {
          actor: context.authorization.actor,
          scopes: grant.scopes,
          anchors: grant.anchors,
        };
        return { repository, list, scopeContext };
      },
      handler: async (_request, _match, validated) => {
        const items: Items = await validated.list.call(
          validated.repository,
          validated.scopeContext,
        );
        return {
          statusCode: 200,
          body: {
            items: items.map((item) =>
              context.permittedDto(
                item,
                context.authorization.permissions.get(read.capability)?.fields ?? null,
              ),
            ),
          },
        };
      },
    }),
  );
}
