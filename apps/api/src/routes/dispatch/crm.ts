import type { PermissionKey } from '@kingturf/types';
import {
  allow,
  error,
  expectedVersion,
  mutationDto,
  objectBody,
  permittedDto,
  string,
  strings,
  timestamp,
  uuid,
} from '../../app-values.ts';
import { authorizeQuery } from '../../policy.ts';
import { customer360Routes } from '../customer-360.ts';
import { customerActivityRoutes } from '../customer-activities.ts';
import { customerCollectionRoutes, customerDetailRoutes } from '../customer-base.ts';
import { customerContactRoutes } from '../customer-contacts.ts';
import { customerLifecycleRoutes } from '../customer-lifecycle.ts';
import { customerOwnershipRoutes } from '../customer-ownership.ts';
import { leadCreateRoutes, leadListRoutes, leadPoolRoutes } from '../lead-base.ts';
import { leadClaimRoutes } from '../lead-claim.ts';
import { leadCommandRoutes } from '../lead-commands.ts';
import { dispatchRoutes } from '../types.ts';
import {
  directReply,
  routeReply,
  type RouteAttempts,
  type RouteDispatchContext,
} from './context.ts';
export function* crmAttempts(scope: RouteDispatchContext): RouteAttempts {
  const { request, dependencies, context, correlationId } = scope;
  const customerMatch =
    /^\/api\/v1\/customers(?:\/([0-9a-f-]+))?(?:\/(contacts|ownership|activities|360))?$/u.exec(
      request.pathname,
    );
  if (customerMatch) {
    if (!dependencies.crm) {
      yield directReply(error(503, 'internal_error', 'CRM dependency unavailable', correlationId));
      return;
    }
    const customerBaseContext = {
      repository: dependencies.crm,
      authorization: context,
      correlationId,
      authorize: (capability: PermissionKey, fields?: readonly string[]) =>
        authorizeQuery(context, capability, fields),
      permittedDto,
      mutationDto: (value: Record<string, unknown>) => mutationDto(value, context, 'customer:read'),
      notFound: () => error(404, 'not_found', 'Customer not found', correlationId),
      parsers: { objectBody, allow, string, strings, uuid },
    } as const;
    yield routeReply(
      dispatchRoutes(customerCollectionRoutes(customerBaseContext), request),
      'truthy',
    );
    yield routeReply(
      dispatchRoutes(
        customerOwnershipRoutes({
          repository: dependencies.crm,
          authorization: context,
          correlationId,
          authorize: (capability) => authorizeQuery(context, capability),
          mutationDto: (value) => mutationDto(value, context, 'customer:read'),
          parsers: { objectBody, allow, uuid, expectedVersion, string },
        }),
        request,
      ),
      'truthy',
    );
    yield routeReply(
      dispatchRoutes(
        customerActivityRoutes({
          repository: dependencies.crm,
          authorization: context,
          correlationId,
          authorize: (capability, fields) => authorizeQuery(context, capability, fields),
          mutationDto: (value) => mutationDto(value, context, 'customer-activity:read'),
          parsers: { objectBody, allow, uuid, string, timestamp },
        }),
        request,
      ),
      'truthy',
    );
    yield routeReply(
      dispatchRoutes(
        customerLifecycleRoutes({
          repository: dependencies.crm,
          authorization: context,
          correlationId,
          authorize: (capability, fields) => authorizeQuery(context, capability, fields),
          mutationDto: (value) => mutationDto(value, context, 'customer:read'),
          parsers: { objectBody, allow, uuid, string, expectedVersion },
        }),
        request,
      ),
      'truthy',
    );
    yield routeReply(
      dispatchRoutes(
        customer360Routes({
          repository: dependencies.crm,
          authorization: context,
          authorize: (capability) => authorizeQuery(context, capability),
          uuid,
          customerNotFound: () => error(404, 'not_found', 'Customer not found', correlationId),
          permittedDto,
        }),
        request,
      ),
      'truthy',
    );
    yield routeReply(
      dispatchRoutes(
        customerContactRoutes({
          repository: dependencies.crm,
          authorization: context,
          correlationId,
          authorize: (capability, fields) => authorizeQuery(context, capability, fields),
          mutationDto: (value) => mutationDto(value, context, 'customer-360:read'),
          parsers: { objectBody, allow, uuid, string },
        }),
        request,
      ),
      'truthy',
    );
    yield routeReply(dispatchRoutes(customerDetailRoutes(customerBaseContext), request), 'truthy');
  }
  if (request.method === 'GET' && request.pathname === '/api/v1/leads') {
    if (!dependencies.crm) {
      yield directReply(error(503, 'internal_error', 'CRM dependency unavailable', correlationId));
      return;
    }
    yield routeReply(
      dispatchRoutes(
        leadListRoutes({
          repository: dependencies.crm,
          authorization: context,
          authorize: (capability) => authorizeQuery(context, capability),
          permittedDto,
        }),
        request,
      ),
      'truthy',
    );
  }
  if (request.method === 'POST' && request.pathname === '/api/v1/leads') {
    if (!dependencies.crm) {
      yield directReply(error(503, 'internal_error', 'CRM dependency unavailable', correlationId));
      return;
    }
    yield routeReply(
      dispatchRoutes(
        leadCreateRoutes({
          repository: dependencies.crm,
          authorization: context,
          correlationId,
          authorize: (capability, fields) => authorizeQuery(context, capability, fields),
          mutationDto: (value) => mutationDto(value, context, 'lead:read'),
          parsers: { objectBody, allow, string, uuid },
        }),
        request,
      ),
      'truthy',
    );
  }
  if (request.method === 'GET' && request.pathname === '/api/v1/leads/pool') {
    if (!dependencies.crm) {
      yield directReply(error(503, 'internal_error', 'CRM dependency unavailable', correlationId));
      return;
    }
    yield routeReply(
      dispatchRoutes(
        leadPoolRoutes({
          repository: dependencies.crm,
          authorization: context,
          authorize: (capability) => authorizeQuery(context, capability),
          permittedDto,
        }),
        request,
      ),
      'truthy',
    );
  }
  const claimMatch = /^\/api\/v1\/leads\/([0-9a-f-]+)\/claim$/u.exec(request.pathname);
  if (request.method === 'POST' && claimMatch) {
    if (!dependencies.crm) {
      yield directReply(error(503, 'internal_error', 'CRM dependency unavailable', correlationId));
      return;
    }
    yield routeReply(
      dispatchRoutes(
        leadClaimRoutes({
          repository: dependencies.crm,
          authorization: context,
          correlationId,
          authorize: (capability) => authorizeQuery(context, capability),
          mutationDto: (value) => mutationDto(value, context, 'lead:read'),
          parsers: { objectBody, allow, uuid, expectedVersion },
        }),
        request,
      ),
      'truthy',
    );
  }
  const leadActionMatch =
    /^\/api\/v1\/leads\/([0-9a-f-]+)\/(transition|assign|reassign|release)$/u.exec(
      request.pathname,
    );
  if (request.method === 'POST' && leadActionMatch) {
    if (!dependencies.crm) {
      yield directReply(error(503, 'internal_error', 'CRM dependency unavailable', correlationId));
      return;
    }
    yield routeReply(
      dispatchRoutes(
        leadCommandRoutes({
          repository: dependencies.crm,
          authorization: context,
          correlationId,
          authorize: (capability, fields) => authorizeQuery(context, capability, fields),
          mutationDto: (value) => mutationDto(value, context, 'lead:read'),
          parsers: { uuid, objectBody, allow, expectedVersion, string },
        }),
        request,
      ),
      'truthy',
    );
  }
}
