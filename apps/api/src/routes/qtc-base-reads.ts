import type { AuthorizationContext } from '@kingturf/domain';
import type { PermissionKey } from '@kingturf/types';
import type { ApiDependencies } from '../app.ts';
import type { authorizeQuery } from '../policy.ts';
import { defineRoute, type RouteDefinition } from './types.ts';

type Qtc = NonNullable<ApiDependencies['quoteToCash']>;
type List = Qtc['list'];
type View = Parameters<List>[0];
type ScopeContext = Readonly<Parameters<List>[1]>;
type ValidatedRead = Readonly<{
  list: List;
  view: View;
  scopeContext: ScopeContext;
}>;
type Context = Readonly<{
  repository: Pick<Qtc, 'list'>;
  authorization: AuthorizationContext;
  authorizeQuery: typeof authorizeQuery;
  permittedDto: <T extends Record<string, unknown>>(
    value: T,
    fields: readonly string[] | null,
  ) => Partial<T>;
}>;
type Read = Readonly<{ path: string; capability: PermissionKey; view: View }>;
const reads = [
  { path: '/api/v1/credit-limits', capability: 'credit:read', view: 'limits' },
  { path: '/api/v1/credit-decisions', capability: 'credit:read', view: 'credit' },
  { path: '/api/v1/contracts', capability: 'contract:read', view: 'contracts' },
  { path: '/api/v1/sales-orders', capability: 'sales-order:read', view: 'orders' },
  {
    path: '/api/v1/reconciliation-runs',
    capability: 'reconciliation:read',
    view: 'reconciliation',
  },
] as const satisfies readonly Read[];

export function qtcBaseReadRoutes(context: Context): readonly RouteDefinition[] {
  return reads.map((read) =>
    defineRoute({
      method: 'GET',
      match: (pathname) => (pathname === read.path ? { params: [] } : null),
      validate: (): ValidatedRead => {
        const grant = context.authorizeQuery(context.authorization, read.capability);
        const list = context.repository.list;
        const view = read.view;
        const scopeContext: ScopeContext = {
          actor: context.authorization.actor,
          scopes: grant.scopes,
          anchors: grant.anchors,
        };
        return { list, view, scopeContext };
      },
      handler: async (_request, _match, validated) => {
        const items = await validated.list.call(
          context.repository,
          validated.view,
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
