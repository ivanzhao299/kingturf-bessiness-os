import { assertStableCode, type AuthorizationContext } from '@kingturf/domain';
import type { ApiDependencies } from '../../app.ts';
import { projectCollectionLegal } from '../../aggregate-authorization.ts';
import {
  allow,
  currency,
  decimal,
  jsonObject,
  legalMutationDto,
  mutationDto,
  objectBody,
  permittedDto,
  string,
  strings,
  timestamp,
  uuid,
} from '../../app-values.ts';
import { authorizeQuery } from '../../policy.ts';
import { collectionRoutes } from '../collection.ts';
import { dispatchRoutes } from '../types.ts';
import { routeReply, type RouteAttempts, type RouteDispatchContext } from './context.ts';
export function configuredCollectionRoutes(
  repository: NonNullable<ApiDependencies['collections']>,
  context: AuthorizationContext,
  correlationId: string,
) {
  return collectionRoutes({
    repository,
    authorization: context,
    correlationId,
    authorize: (capability, fields) => authorizeQuery(context, capability, fields),
    projectLegal: projectCollectionLegal,
    permittedDto,
    mutationDto: (value) => mutationDto(value, context, 'collection:read'),
    legalMutationDto: (value) => legalMutationDto(value, context),
    parsers: {
      objectBody,
      allow,
      string,
      uuid,
      timestamp,
      decimal,
      currency,
      strings,
      jsonObject,
      stableCode: assertStableCode,
    },
  });
}

export function* collectionsAttempts(scope: RouteDispatchContext): RouteAttempts {
  const { request, dependencies, context, correlationId } = scope;
  if (dependencies.collections) {
    yield routeReply(
      dispatchRoutes(
        configuredCollectionRoutes(dependencies.collections, context, correlationId),
        request,
      ),
      'truthy',
    );
  }
}
