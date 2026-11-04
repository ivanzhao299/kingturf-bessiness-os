import { currency, timestamp } from '../../app-values.ts';
import type { ApiDependencies } from '../../app.ts';
import { authorizeQuery } from '../../policy.ts';
import { executiveDashboardRoutes } from '../dashboard.ts';
import { dispatchRoutes } from '../types.ts';
import { routeReply, type RouteAttempts, type RouteDispatchContext } from './context.ts';
export function* dashboardAttempts(scope: RouteDispatchContext): RouteAttempts {
  const { request, dependencies, context } = scope;
  if (
    request.method === 'GET' &&
    request.pathname === '/api/v1/executive-dashboard' &&
    dependencies.dashboard
  ) {
    yield routeReply(
      dispatchRoutes(
        executiveDashboardRoutes({
          repository: () =>
            dependencies.dashboard as Pick<NonNullable<ApiDependencies['dashboard']>, 'get'>,
          authorization: context,
          authorizeQuery,
          parsers: { timestamp, currency },
        }),
        request,
      ),
    );
  }
}
