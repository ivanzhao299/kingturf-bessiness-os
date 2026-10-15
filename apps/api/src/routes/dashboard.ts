import { DomainError, type AuthorizationContext } from '@kingturf/domain';
import type { PermissionKey } from '@kingturf/types';
import type { ApiDependencies } from '../app.ts';
import type { authorizeQuery } from '../policy.ts';
import { defineRoute, type RouteDefinition } from './types.ts';

type Repository = Pick<NonNullable<ApiDependencies['dashboard']>, 'get'>;
type Get = Repository['get'];
type Input = Readonly<Parameters<Get>[0]>;
type ScopeContext = Readonly<Parameters<Get>[1]>;
type Aggregate = Awaited<ReturnType<Get>>;
type ValidatedDashboard = Readonly<{
  repository: Repository;
  get: Get;
  input: Input;
  scopeContext: ScopeContext;
}>;
type Context = Readonly<{
  repository: () => Repository;
  authorization: AuthorizationContext;
  authorizeQuery: typeof authorizeQuery;
  parsers: Readonly<{
    timestamp: (value: unknown, name: string) => string;
    currency: (value: unknown) => string;
  }>;
}>;

export function executiveDashboardRoutes(context: Context): readonly RouteDefinition[] {
  return [
    defineRoute({
      method: 'GET',
      match: (pathname) => (pathname === '/api/v1/executive-dashboard' ? { params: [] } : null),
      validate: (request): ValidatedDashboard => {
        const grant = context.authorizeQuery(context.authorization, 'executive-dashboard:read');
        const from = context.parsers.timestamp(request.query?.from, 'from');
        const to = context.parsers.timestamp(request.query?.to, 'to');
        if (new Date(from).getTime() >= new Date(to).getTime())
          throw new DomainError('invalid_request', 'from must be before to');
        const repository = context.repository();
        const get = repository.get;
        const input: Input = {
          from,
          to,
          currency: context.parsers.currency(request.query?.currency),
        };
        const scopeContext: ScopeContext = {
          actor: context.authorization.actor,
          scopes: grant.scopes,
          anchors: grant.anchors,
        };
        return { repository, get, input, scopeContext };
      },
      handler: async (_request, _match, validated) => {
        const result: Aggregate = await validated.get.call(
          validated.repository,
          validated.input,
          validated.scopeContext,
        );
        const aggregate = result as Record<string, unknown>;
        const metrics = aggregate.metrics as Record<string, unknown>;
        const metricCapabilities = {
          weightedForecast: 'opportunity:read',
          bookedRevenue: 'sales-order:read',
          grossMargin: 'quote:read',
          cashCollected: 'reconciliation:read',
          openReceivable: 'ar:read',
          overdueReceivable: 'ar:read',
          releasedOrders: 'sales-order:read',
          activeRisks: 'risk:read',
          criticalRisks: 'risk:read',
          commissionAccrued: 'commission:read',
        } as const satisfies Record<string, PermissionKey>;
        const visibleMetrics = Object.fromEntries(
          Object.entries(metricCapabilities)
            .filter(([, capability]) => context.authorization.permissions.has(capability))
            .map(([key]) => [key, metrics[key]]),
        );
        const drilldowns = aggregate.drilldowns as Record<string, unknown>;
        return {
          statusCode: 200,
          body: {
            filters: aggregate.filters,
            refreshedAt: aggregate.refreshedAt,
            metrics: visibleMetrics,
            drilldowns: {
              ...(context.authorization.permissions.has('sales-order:read')
                ? { orders: drilldowns.orders }
                : {}),
              ...(context.authorization.permissions.has('ar:read')
                ? { overdue: drilldowns.overdue }
                : {}),
              ...(context.authorization.permissions.has('risk:read')
                ? { risks: drilldowns.risks }
                : {}),
            },
          },
        };
      },
    }),
  ];
}
