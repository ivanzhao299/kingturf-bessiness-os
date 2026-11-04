import { assertStableCode } from '@kingturf/domain';
import {
  allow,
  array,
  decimal,
  integer,
  jsonObject,
  mutationDto,
  objectBody,
  permittedDto,
  string,
  timestamp,
  uuid,
} from '../../app-values.ts';
import { authorizeQuery } from '../../policy.ts';
import { capaActionRoutes } from '../capa-actions.ts';
import { capaCreateRoutes } from '../capa-create.ts';
import { capaLifecycleRoutes } from '../capa-lifecycle.ts';
import { complaintBatchTriageRoutes } from '../complaint-batch-triage.ts';
import { complaintCreateRoutes } from '../complaint-create.ts';
import { complaintReadRoutes } from '../complaint-reads.ts';
import { complaintSlaRoutes } from '../complaint-sla.ts';
import { complaintTransitionRoutes } from '../complaint-transitions.ts';
import { ncrCreateRoutes } from '../ncr-create.ts';
import { ncrTransitionRoutes } from '../ncr-transitions.ts';
import { dispatchRoutes } from '../types.ts';
import {
  dependencyPresent,
  routeReply,
  type DependencyScope,
  type RouteAttempts,
  type RouteDispatchContext,
} from './context.ts';
function* complaintsPart1(scope: DependencyScope<'complaints'>): RouteAttempts {
  const { request, dependencies, context, correlationId } = scope;
  yield routeReply(
    dispatchRoutes(
      complaintSlaRoutes({
        repository: dependencies.complaints,
        authorization: context,
        correlationId,
        authorize: (capability, fields) => authorizeQuery(context, capability, fields),
        permittedDto,
        mutationDto: (value) => mutationDto(value, context, 'complaint-sla:read'),
        parsers: {
          objectBody,
          allow,
          string,
          stableCode: assertStableCode,
          integer,
          timestamp,
        },
      }),
      request,
    ),
    'truthy',
  );
  yield routeReply(
    dispatchRoutes(
      complaintReadRoutes({
        repository: dependencies.complaints,
        authorization: context,
        authorize: (capability) => authorizeQuery(context, capability),
        permittedDto,
        parsers: { string, uuid, integer, timestamp },
      }),
      request,
    ),
    'truthy',
  );
  yield routeReply(
    dispatchRoutes(
      complaintCreateRoutes({
        repository: dependencies.complaints,
        authorization: context,
        correlationId,
        authorize: (capability, fields) => authorizeQuery(context, capability, fields),
        mutationDto: (value) => mutationDto(value, context, 'complaint:read'),
        parsers: {
          objectBody,
          allow,
          string,
          stableCode: assertStableCode,
          uuid,
          timestamp,
          jsonObject,
        },
      }),
      request,
    ),
    'truthy',
  );
  yield routeReply(
    dispatchRoutes(
      complaintBatchTriageRoutes({
        repository: dependencies.complaints,
        authorization: context,
        correlationId,
        authorize: (capability, fields) => authorizeQuery(context, capability, fields),
        parsers: {
          objectBody,
          allow,
          array,
          uuid,
          integer,
          string,
          stableCode: assertStableCode,
        },
      }),
      request,
    ),
    'truthy',
  );
  yield routeReply(
    dispatchRoutes(
      complaintTransitionRoutes({
        repository: dependencies.complaints,
        authorization: context,
        correlationId,
        authorize: (capability, fields) => authorizeQuery(context, capability, fields),
        mutationDto: (value) => mutationDto(value, context, 'complaint:read'),
        parsers: {
          objectBody,
          allow,
          uuid,
          integer,
          string,
          jsonObject,
          stableCode: assertStableCode,
        },
      }),
      request,
    ),
    'truthy',
  );
  yield routeReply(
    dispatchRoutes(
      ncrCreateRoutes({
        repository: dependencies.complaints,
        authorization: context,
        correlationId,
        authorize: (capability, fields) => authorizeQuery(context, capability, fields),
        mutationDto: (value) => mutationDto(value, context, 'ncr:read'),
        parsers: {
          objectBody,
          allow,
          string,
          stableCode: assertStableCode,
          uuid,
          decimal,
          integer,
          jsonObject,
        },
      }),
      request,
    ),
    'truthy',
  );
  yield routeReply(
    dispatchRoutes(
      ncrTransitionRoutes({
        repository: dependencies.complaints,
        authorization: context,
        correlationId,
        authorize: (capability, fields) => authorizeQuery(context, capability, fields),
        mutationDto: (value) => mutationDto(value, context, 'ncr:read'),
        parsers: {
          objectBody,
          allow,
          string,
          uuid,
          integer,
          jsonObject,
          stableCode: assertStableCode,
        },
      }),
      request,
    ),
    'truthy',
  );
  yield routeReply(
    dispatchRoutes(
      capaCreateRoutes({
        repository: dependencies.complaints,
        authorization: context,
        correlationId,
        authorize: (capability, fields) => authorizeQuery(context, capability, fields),
        mutationDto: (value) => mutationDto(value, context, 'capa:read'),
        parsers: {
          objectBody,
          allow,
          string,
          stableCode: assertStableCode,
          uuid,
          timestamp,
          integer,
          jsonObject,
        },
      }),
      request,
    ),
    'truthy',
  );
  yield routeReply(
    dispatchRoutes(
      capaActionRoutes({
        repository: dependencies.complaints,
        authorization: context,
        correlationId,
        authorize: (capability, fields) => authorizeQuery(context, capability, fields),
        mutationDto: (value) => mutationDto(value, context, 'capa:read'),
        parsers: {
          objectBody,
          allow,
          string,
          stableCode: assertStableCode,
          uuid,
          timestamp,
          integer,
          jsonObject,
        },
      }),
      request,
    ),
    'truthy',
  );
}
function* complaintsPart2(scope: DependencyScope<'complaints'>): RouteAttempts {
  const { request, dependencies, context, correlationId } = scope;
  yield routeReply(
    dispatchRoutes(
      capaLifecycleRoutes({
        repository: dependencies.complaints,
        authorization: context,
        correlationId,
        authorize: (capability, fields) => authorizeQuery(context, capability, fields),
        mutationDto: (value) => mutationDto(value, context, 'capa:read'),
        parsers: {
          objectBody,
          allow,
          string,
          stableCode: assertStableCode,
          uuid,
          timestamp,
          integer,
          jsonObject,
        },
      }),
      request,
    ),
    'truthy',
  );
}
export function* complaintsAttempts(scope: RouteDispatchContext): RouteAttempts {
  if (dependencyPresent(scope, 'complaints')) {
    yield* complaintsPart1(scope);
    yield* complaintsPart2(scope);
  }
}
