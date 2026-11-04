import { allow, objectBody, string, uuid } from '../../app-values.ts';
import { authorizeQuery } from '../../policy.ts';
import { credentialRoutes } from '../auth.ts';
import { identityProvisionRoutes } from '../identity-provision.ts';
import { dispatchRoutes } from '../types.ts';
import {
  routeReply,
  type AuthenticatedRouteDispatchContext,
  type RouteAttempts,
} from './context.ts';
export function* credentialsAttempts(scope: AuthenticatedRouteDispatchContext): RouteAttempts {
  const { request, dependencies, context, correlationId, securedAuthContext } = scope;
  yield routeReply(dispatchRoutes(credentialRoutes(securedAuthContext), request), 'truthy');
  yield routeReply(
    dispatchRoutes(
      identityProvisionRoutes({
        auth: dependencies.auth,
        authorization: context,
        correlationId,
        authorize: () => {
          authorizeQuery(context, 'authorization:manage');
        },
        parsers: { objectBody, allow, uuid, string },
      }),
      request,
    ),
    'truthy',
  );
}
