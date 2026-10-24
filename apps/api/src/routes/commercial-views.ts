import type { AuthorizationContext } from '@kingturf/domain';
import type { PermissionKey } from '@kingturf/types';
import type { ApiDependencies } from '../app.ts';
import type { AuthorizedQuery } from '../policy.ts';
import { defineRoute, type RouteDefinition } from './types.ts';

type ViewRepository = Pick<NonNullable<ApiDependencies['commercial']>, 'listCommercialView'>;
type CommercialView = Parameters<ViewRepository['listCommercialView']>[0];
type ViewContext = Readonly<{
  repository: ViewRepository;
  authorization: AuthorizationContext;
  authorize: (capability: PermissionKey) => AuthorizedQuery;
  permittedDto: (value: Record<string, unknown>, capability: PermissionKey) => unknown;
}>;
const views = [
  ['/api/v1/ctrs', 'ctr:read', 'ctrs'],
  ['/api/v1/technical-solutions', 'technical-solution:read', 'solutions'],
  ['/api/v1/cost-evaluations', 'cost:read', 'costs'],
  ['/api/v1/sales-policy-evaluations', 'sales-policy:read', 'policies'],
  ['/api/v1/quotes', 'quote:read', 'quotes'],
] as const satisfies readonly (readonly [string, PermissionKey, CommercialView])[];

export function commercialViewRoutes(context: ViewContext): readonly RouteDefinition[] {
  return views.map(([path, capability, view]) =>
    defineRoute({
      method: 'GET',
      match: (pathname) => (pathname === path ? { params: [] } : null),
      // Every generated GET validates its own read grant; body/query and field requests are absent.
      validate: () => context.authorize(capability),
      handler: async (_request, _match, grant) => ({
        statusCode: 200,
        body: {
          items: (
            await context.repository.listCommercialView(
              view,
              context.authorization.actor,
              grant.scopes,
              grant.anchors,
            )
          ).map((item) => context.permittedDto(item, capability)),
        },
      }),
    }),
  );
}
