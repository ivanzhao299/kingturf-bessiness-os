import { decimal, integer, permittedDto, string, timestamp, uuid } from '../../app-values.ts';
import type { ApiDependencies } from '../../app.ts';
import { authorizeQuery } from '../../policy.ts';
import { qtcBaseReadRoutes } from '../qtc-base-reads.ts';
import { qtcOperationalReadRoutes } from '../qtc-operational-reads.ts';
import { dispatchRoutes } from '../types.ts';
import { routeReply, type RouteAttempts, type RouteDispatchContext } from './context.ts';
export function* qtcreadsAttempts(scope: RouteDispatchContext): RouteAttempts {
  const { request, dependencies, context } = scope;
  const qtcReads = new Map<
    string,
    readonly [
      `${string}:${string}`,
      'limits' | 'credit' | 'contracts' | 'orders' | 'ar' | 'payments' | 'reconciliation',
    ]
  >([
    ['/api/v1/credit-limits', ['credit:read', 'limits']],
    ['/api/v1/credit-decisions', ['credit:read', 'credit']],
    ['/api/v1/contracts', ['contract:read', 'contracts']],
    ['/api/v1/sales-orders', ['sales-order:read', 'orders']],
    ['/api/v1/ar-open-items', ['ar:read', 'ar']],
    ['/api/v1/bank-payments', ['bank-payment:read', 'payments']],
    ['/api/v1/reconciliation-runs', ['reconciliation:read', 'reconciliation']],
  ]);
  const qtcRead = qtcReads.get(request.pathname);
  if (request.method === 'GET' && qtcRead && dependencies.quoteToCash) {
    if (qtcRead[1] === 'ar' || qtcRead[1] === 'payments') {
      yield routeReply(
        dispatchRoutes(
          qtcOperationalReadRoutes({
            repository: () =>
              dependencies.quoteToCash as Pick<
                NonNullable<ApiDependencies['quoteToCash']>,
                'listOperationalPage'
              >,
            authorization: context,
            authorizeQuery,
            permittedDto,
            parsers: { decimal, integer, uuid, string, timestamp },
          }),
          request,
        ),
      );
    }
    yield routeReply(
      dispatchRoutes(
        qtcBaseReadRoutes({
          repository: () =>
            dependencies.quoteToCash as Pick<NonNullable<ApiDependencies['quoteToCash']>, 'list'>,
          authorization: context,
          authorizeQuery,
          permittedDto,
        }),
        request,
      ),
    );
  }
}
