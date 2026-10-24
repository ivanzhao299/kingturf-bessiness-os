import type { AuthorizationContext } from '@kingturf/domain';
import type { PermissionKey } from '@kingturf/types';
import type { ApiDependencies } from '../app.ts';
import type { authorizeQuery } from '../policy.ts';
import { defineRoute, type RouteDefinition } from './types.ts';

type Repository = Pick<NonNullable<ApiDependencies['procurement']>, 'list'>;
type List = Repository['list'];
type View = Parameters<List>[0];
type ScopeContext = Readonly<Parameters<List>[1]>;
type Items = Awaited<ReturnType<List>>;
type ValidatedRead = Readonly<{
  repository: Repository;
  list: List;
  view: View;
  scopeContext: ScopeContext;
}>;
type Context = Readonly<{
  repository: () => Repository;
  view: View;
  capability: PermissionKey;
  authorization: AuthorizationContext;
  authorizeQuery: typeof authorizeQuery;
  permittedDto: <T extends Record<string, unknown>>(
    value: T,
    fields: readonly string[] | null,
  ) => Partial<T>;
}>;

export function procurementReadRoutes(context: Context): readonly RouteDefinition[] {
  return [
    defineRoute({
      method: 'GET',
      match: (pathname) =>
        /^\/api\/v1\/(suppliers|procurement-rfqs|supplier-quotes|purchase-orders|goods-receipts|inventory-locations|inventory-balances)$/u.test(
          pathname,
        )
          ? { params: [] }
          : null,
      validate: (): ValidatedRead => {
        const grant = context.authorizeQuery(context.authorization, context.capability);
        const repository = context.repository();
        const list = repository.list;
        const view = context.view;
        const scopeContext: ScopeContext = {
          actor: context.authorization.actor,
          scopes: grant.scopes,
          anchors: grant.anchors,
        };
        return { repository, list, view, scopeContext };
      },
      handler: async (_request, _match, validated) => {
        const items: Items = await validated.list.call(
          validated.repository,
          validated.view,
          validated.scopeContext,
        );
        return {
          statusCode: 200,
          body: {
            items: items.map((item) =>
              context.permittedDto(
                item,
                context.authorization.permissions.get(context.capability)?.fields ?? null,
              ),
            ),
          },
        };
      },
    }),
  ];
}
