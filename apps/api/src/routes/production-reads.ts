import type { AuthorizationContext } from '@kingturf/domain';
import type { ApiDependencies } from '../app.ts';
import type { authorizeQuery } from '../policy.ts';
import { defineRoute, type RouteDefinition } from './types.ts';

type Production = NonNullable<ApiDependencies['production']>;
type Costs = NonNullable<ApiDependencies['productionCosts']>;
type OrderInput = Readonly<Parameters<Production['list']>[0]>;
type PolicyInput = Readonly<Parameters<Costs['listPolicies']>[0]>;
type RunInput = Readonly<Parameters<Costs['list']>[0]>;
type ReadAuthorization = Readonly<{
  authorization: AuthorizationContext;
  authorizeQuery: typeof authorizeQuery;
}>;
type Projection = Readonly<{
  permittedDto: <T extends Record<string, unknown>>(
    value: T,
    fields: readonly string[] | null,
  ) => Partial<T>;
}>;
type OrderContext = ReadAuthorization &
  Projection &
  Readonly<{ repository: Pick<Production, 'list'> }>;
type PolicyContext = ReadAuthorization & Readonly<{ repository: Pick<Costs, 'listPolicies'> }>;
type RunContext = ReadAuthorization & Projection & Readonly<{ repository: Pick<Costs, 'list'> }>;

export function productionOrderReadRoutes(context: OrderContext): readonly RouteDefinition[] {
  return [
    defineRoute({
      method: 'GET',
      match: (pathname) => (pathname === '/api/v1/production-orders' ? { params: [] } : null),
      validate: (): OrderInput => {
        const grant = context.authorizeQuery(context.authorization, 'production:read');
        return {
          actor: context.authorization.actor,
          scopes: grant.scopes,
          anchors: grant.anchors,
        };
      },
      handler: async (_request, _match, input) => {
        const items = await context.repository.list(input);
        return {
          statusCode: 200,
          body: {
            items: items.map((item) =>
              context.permittedDto(
                item,
                context.authorization.permissions.get('production:read')?.fields ?? null,
              ),
            ),
          },
        };
      },
    }),
  ];
}

export function productionCostPolicyReadRoutes(context: PolicyContext): readonly RouteDefinition[] {
  return [
    defineRoute({
      method: 'GET',
      match: (pathname) =>
        pathname === '/api/v1/production-cost-policies' ? { params: [] } : null,
      validate: (): PolicyInput => {
        const grant = context.authorizeQuery(context.authorization, 'manufacturing-cost:read');
        return {
          actor: context.authorization.actor,
          scopes: grant.scopes,
          anchors: grant.anchors,
        };
      },
      handler: async (_request, _match, input) => {
        const items = await context.repository.listPolicies(input);
        return { statusCode: 200, body: { items } };
      },
    }),
  ];
}

export function productionCostRunReadRoutes(context: RunContext): readonly RouteDefinition[] {
  return [
    defineRoute({
      method: 'GET',
      match: (pathname) => (pathname === '/api/v1/production-cost-runs' ? { params: [] } : null),
      validate: (): RunInput => {
        const grant = context.authorizeQuery(context.authorization, 'manufacturing-cost:read');
        return {
          actor: context.authorization.actor,
          scopes: grant.scopes,
          anchors: grant.anchors,
        };
      },
      handler: async (_request, _match, input) => {
        const items = await context.repository.list(input);
        return {
          statusCode: 200,
          body: {
            items: items.map((item) =>
              context.permittedDto(
                item,
                context.authorization.permissions.get('manufacturing-cost:read')?.fields ?? null,
              ),
            ),
          },
        };
      },
    }),
  ];
}
