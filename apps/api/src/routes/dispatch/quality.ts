import { assertStableCode } from '@kingturf/domain';
import type { PermissionKey } from '@kingturf/types';
import {
  allow,
  array,
  decimal,
  jsonObject,
  mutationDto,
  objectBody,
  permittedDto,
  string,
  timestamp,
  uuid,
} from '../../app-values.ts';
import type { ApiDependencies } from '../../app.ts';
import { authorizeQuery } from '../../policy.ts';
import { qualityDispositionRoutes } from '../quality-disposition.ts';
import { qualityInspectionOpenRoutes } from '../quality-inspection-open.ts';
import { qualityInspectionTransitionRoutes } from '../quality-inspection-transitions.ts';
import { qualityPlanCreateRoutes } from '../quality-plan-create.ts';
import { qualityPlanPublishRoutes } from '../quality-plan-publish.ts';
import {
  lotTraceabilityReadRoutes,
  qualityInspectionReadRoutes,
  qualityPlanReadRoutes,
} from '../quality-reads.ts';
import { qualityResultRecordRoutes } from '../quality-result-record.ts';
import { dispatchRoutes } from '../types.ts';
import {
  dependencyPresent,
  routeReply,
  type RouteAttempts,
  type RouteDispatchContext,
} from './context.ts';
function* qualityPart1(scope: RouteDispatchContext): RouteAttempts {
  const { request, dependencies, context, correlationId } = scope;
  const qualityLists: Readonly<
    Record<string, readonly ['plans' | 'inspections' | 'lots', PermissionKey] | undefined>
  > = {
    '/api/v1/quality-plans': ['plans', 'quality-plan:read'],
    '/api/v1/quality-inspections': ['inspections', 'quality:read'],
    '/api/v1/lot-traceability': ['lots', 'traceability:read'],
  };
  const qualityList = qualityLists[request.pathname];
  if (request.method === 'GET' && qualityList) {
    const [view, capability] = qualityList;
    const readContext = {
      repository: () =>
        dependencies.quality as Pick<NonNullable<ApiDependencies['quality']>, 'list'>,
      authorization: context,
      authorizeQuery,
      view,
      capability,
      permittedDto,
    };
    yield routeReply(
      dispatchRoutes(
        [
          ...qualityPlanReadRoutes(readContext),
          ...qualityInspectionReadRoutes(readContext),
          ...lotTraceabilityReadRoutes(readContext),
        ],
        request,
      ),
    );
  }
  if (request.method === 'POST' && request.pathname === '/api/v1/quality-plans') {
    yield routeReply(
      dispatchRoutes(
        qualityPlanCreateRoutes({
          repository: () =>
            dependencies.quality as Pick<NonNullable<ApiDependencies['quality']>, 'createPlan'>,
          authorization: context,
          authorizeQuery,
          correlationId,
          parsers: {
            objectBody,
            allow,
            string,
            uuid,
            decimal,
            timestamp,
            array,
            jsonObject,
            stableCode: assertStableCode,
          },
          mutationDto,
        }),
        request,
      ),
    );
  }
  const planPublish = /^\/api\/v1\/quality-plans\/([0-9a-f-]+)\/publish$/u.exec(request.pathname);
  if (request.method === 'POST' && planPublish) {
    yield routeReply(
      dispatchRoutes(
        qualityPlanPublishRoutes({
          repository: () =>
            dependencies.quality as Pick<NonNullable<ApiDependencies['quality']>, 'publishPlan'>,
          authorization: context,
          authorizeQuery,
          correlationId,
          uuid,
          mutationDto,
        }),
        request,
      ),
    );
  }
  if (request.method === 'POST' && request.pathname === '/api/v1/quality-inspections') {
    yield routeReply(
      dispatchRoutes(
        qualityInspectionOpenRoutes({
          repository: () =>
            dependencies.quality as Pick<NonNullable<ApiDependencies['quality']>, 'openInspection'>,
          authorization: context,
          authorizeQuery,
          correlationId,
          parsers: {
            objectBody,
            allow,
            string,
            uuid,
            decimal,
            stableCode: assertStableCode,
          },
          mutationDto,
        }),
        request,
      ),
    );
  }
  const inspectionCommand =
    /^\/api\/v1\/quality-inspections\/([0-9a-f-]+)\/(sample|complete|cancel)$/u.exec(
      request.pathname,
    );
  if (request.method === 'POST' && inspectionCommand) {
    yield routeReply(
      dispatchRoutes(
        qualityInspectionTransitionRoutes({
          repository: () =>
            dependencies.quality as Pick<
              NonNullable<ApiDependencies['quality']>,
              'transitionInspection'
            >,
          authorization: context,
          authorizeQuery,
          correlationId,
          parsers: {
            objectBody,
            allow,
            uuid,
            string,
            jsonObject,
            stableCode: assertStableCode,
          },
          mutationDto,
        }),
        request,
      ),
    );
  }
  const resultCommand = /^\/api\/v1\/quality-inspections\/([0-9a-f-]+)\/results$/u.exec(
    request.pathname,
  );
  if (request.method === 'POST' && resultCommand) {
    yield routeReply(
      dispatchRoutes(
        qualityResultRecordRoutes({
          repository: () =>
            dependencies.quality as Pick<NonNullable<ApiDependencies['quality']>, 'recordResult'>,
          authorization: context,
          authorizeQuery,
          correlationId,
          parsers: {
            objectBody,
            allow,
            uuid,
            string,
            decimal,
            timestamp,
            stableCode: assertStableCode,
          },
          mutationDto,
        }),
        request,
      ),
    );
  }
}
function* qualityPart2(scope: RouteDispatchContext): RouteAttempts {
  const { request, dependencies, context, correlationId } = scope;
  const dispositionCommand =
    /^\/api\/v1\/quality-inspections\/([0-9a-f-]+)\/(release|reject)$/u.exec(request.pathname);
  if (request.method === 'POST' && dispositionCommand) {
    yield routeReply(
      dispatchRoutes(
        qualityDispositionRoutes({
          repository: () =>
            dependencies.quality as Pick<NonNullable<ApiDependencies['quality']>, 'dispose'>,
          authorization: context,
          authorizeQuery,
          correlationId,
          parsers: {
            objectBody,
            allow,
            uuid,
            string,
            jsonObject,
            stableCode: assertStableCode,
          },
          mutationDto,
        }),
        request,
      ),
    );
  }
}
export function* qualityAttempts(scope: RouteDispatchContext): RouteAttempts {
  if (dependencyPresent(scope, 'quality')) {
    yield* qualityPart1(scope);
    yield* qualityPart2(scope);
  }
}
