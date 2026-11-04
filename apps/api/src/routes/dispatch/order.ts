import { permittedDto } from '../../app-values.ts';
import type { ApiDependencies } from '../../app.ts';
import { authorizeQuery } from '../../policy.ts';
import { order360Routes } from '../order-360.ts';
import { dispatchRoutes } from '../types.ts';
import { routeReply, type RouteAttempts, type RouteDispatchContext } from './context.ts';
export function* orderAttempts(scope: RouteDispatchContext): RouteAttempts {
  const { request, dependencies, context } = scope;
  const order360Match = /^\/api\/v1\/sales-orders\/([0-9a-f-]+)\/360$/u.exec(request.pathname);
  if (request.method === 'GET' && order360Match && dependencies.order360) {
    yield routeReply(
      dispatchRoutes(
        order360Routes({
          repository: () =>
            dependencies.order360 as Pick<NonNullable<ApiDependencies['order360']>, 'get'>,
          authorization: context,
          authorizeQuery,
          permittedDto,
        }),
        request,
      ),
    );
  }
}
