import { routeReply } from './context.ts';
import { assertStableCode } from '@kingturf/domain';
import type { PermissionKey } from '@kingturf/types';
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
import type { ApiDependencies } from '../../app.ts';
import { authorizeQuery } from '../../policy.ts';
import { manufacturingBomCreateRoutes } from '../manufacturing-bom-create.ts';
import { manufacturingItemCreateRoutes } from '../manufacturing-item-create.ts';
import { manufacturingPublishRoutes } from '../manufacturing-publish.ts';
import { manufacturingReadRoutes } from '../manufacturing-reads.ts';
import { manufacturingRoutingCreateRoutes } from '../manufacturing-routing-create.ts';
import { dispatchRoutes } from '../types.ts';
import type { RouteAttempts, RouteDispatchContext } from './context.ts';
export function* manufacturingAttempts(scope: RouteDispatchContext): RouteAttempts {
  const { request, dependencies, context, correlationId } = scope;
  if (dependencies.manufacturing) {
    const manufacturingLists: Readonly<
      Record<string, readonly ['items' | 'boms' | 'routings', PermissionKey] | undefined>
    > = {
      '/api/v1/manufacturing-items': ['items', 'manufacturing-item:read'],
      '/api/v1/manufacturing-boms': ['boms', 'bom:read'],
      '/api/v1/manufacturing-routings': ['routings', 'routing:read'],
    } as const;
    const listDefinition = manufacturingLists[request.pathname];
    if (request.method === 'GET' && listDefinition) {
      const [view, capability] = listDefinition;
      yield routeReply(
        dispatchRoutes(
          manufacturingReadRoutes({
            repository: () =>
              dependencies.manufacturing as Pick<
                NonNullable<ApiDependencies['manufacturing']>,
                'list'
              >,
            view,
            capability,
            authorization: context,
            authorizeQuery,
            permittedDto,
          }),
          request,
        ),
      );
    }
    if (request.method === 'POST' && request.pathname === '/api/v1/manufacturing-items') {
      yield routeReply(
        dispatchRoutes(
          manufacturingItemCreateRoutes({
            repository: () =>
              dependencies.manufacturing as Pick<
                NonNullable<ApiDependencies['manufacturing']>,
                'createItem'
              >,
            authorization: context,
            authorizeQuery,
            correlationId,
            parsers: {
              objectBody,
              allow,
              string,
              stableCode: assertStableCode,
              jsonObject,
              timestamp,
            },
            mutationDto,
          }),
          request,
        ),
      );
    }
    if (request.method === 'POST' && request.pathname === '/api/v1/manufacturing-boms') {
      yield routeReply(
        dispatchRoutes(
          manufacturingBomCreateRoutes({
            repository: () =>
              dependencies.manufacturing as Pick<
                NonNullable<ApiDependencies['manufacturing']>,
                'createBom'
              >,
            authorization: context,
            authorizeQuery,
            correlationId,
            parsers: {
              objectBody,
              allow,
              string,
              stableCode: assertStableCode,
              jsonObject,
              array,
              uuid,
              decimal,
              integer,
              timestamp,
            },
            mutationDto,
          }),
          request,
        ),
      );
    }
    if (request.method === 'POST' && request.pathname === '/api/v1/manufacturing-routings') {
      yield routeReply(
        dispatchRoutes(
          manufacturingRoutingCreateRoutes({
            repository: () =>
              dependencies.manufacturing as Pick<
                NonNullable<ApiDependencies['manufacturing']>,
                'createRouting'
              >,
            authorization: context,
            authorizeQuery,
            correlationId,
            parsers: {
              objectBody,
              allow,
              string,
              stableCode: assertStableCode,
              jsonObject,
              array,
              uuid,
              decimal,
              integer,
              timestamp,
            },
            mutationDto,
          }),
          request,
        ),
      );
    }
    const manufacturingPublish =
      /^\/api\/v1\/manufacturing-(item|bom|routing)-versions\/([0-9a-f-]+)\/publish$/u.exec(
        request.pathname,
      );
    if (request.method === 'POST' && manufacturingPublish) {
      yield routeReply(
        dispatchRoutes(
          manufacturingPublishRoutes({
            repository: () =>
              dependencies.manufacturing as Pick<
                NonNullable<ApiDependencies['manufacturing']>,
                'publish'
              >,
            authorization: context,
            authorizeQuery,
            correlationId,
            parsers: { objectBody, allow, uuid },
            mutationDto,
          }),
          request,
        ),
      );
    }
  }
}
