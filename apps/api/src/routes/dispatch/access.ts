import {
  allow,
  authorizeOneOf,
  error,
  objectBody,
  string,
  strings,
  uuid,
} from '../../app-values.ts';
import { authorizeQuery } from '../../policy.ts';
import { auditReadRoutes } from '../audit-reads.ts';
import { dispatchAuthorizationRoutes } from '../authorization.ts';
import { identityAccessRoutes } from '../identity-access.ts';
import { dispatchRoutes } from '../types.ts';
import {
  directReply,
  routeReply,
  type RouteAttempts,
  type RouteDispatchContext,
} from './context.ts';
export function* accessAttempts(scope: RouteDispatchContext): RouteAttempts {
  const { request, dependencies, context, correlationId } = scope;
  yield routeReply(
    dispatchAuthorizationRoutes(
      {
        repository: dependencies.authorization,
        authorization: context,
        correlationId,
        authorizeOneOf: (preferred, fallback) => {
          authorizeOneOf(context, preferred, fallback);
        },
        unavailable: () =>
          error(503, 'internal_error', 'Authorization repository is unavailable', correlationId),
        parsers: { objectBody, allow, uuid, string, strings },
      },
      request,
    ),
    'truthy',
  );
  yield routeReply(
    dispatchRoutes(
      identityAccessRoutes({
        repository: dependencies.authorization,
        authorization: context,
        correlationId,
        authorizeOneOf: (preferred, fallback, fields) => {
          authorizeOneOf(context, preferred, fallback, fields);
        },
        unavailable: (message) => error(503, 'internal_error', message, correlationId),
        parsers: { objectBody, allow, uuid },
      }),
      request,
    ),
    'truthy',
  );
  const auditMatch = /^\/api\/v1\/audit-events(?:\/([0-9a-f-]+))?$/u.exec(request.pathname);
  if (auditMatch && request.method === 'GET') {
    const auditGrant = authorizeQuery(context, 'audit:read');
    if (!dependencies.audit) {
      yield directReply(
        error(503, 'internal_error', 'Audit repository unavailable', correlationId),
      );
      return;
    }
    yield routeReply(
      dispatchRoutes(
        auditReadRoutes({
          repository: dependencies.audit,
          actor: context.actor,
          grant: auditGrant,
          uuid,
          notFound: () => error(404, 'not_found', 'Audit event not found', correlationId),
        }),
        request,
      ),
      'truthy',
    );
  }
}
