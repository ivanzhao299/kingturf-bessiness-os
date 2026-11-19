import { allow, authorizeOneOf, objectBody, secret, string, uuid } from '../../app-values.ts';
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
          // A2-F4①（A-F1）：开通端点原子权限——identity:manage 优先，回落 authorization:manage。
          authorizeOneOf(context, 'identity:manage', 'authorization:manage');
        },
        parsers: { objectBody, allow, uuid, string, secret },
      }),
      request,
    ),
    'truthy',
  );
}
