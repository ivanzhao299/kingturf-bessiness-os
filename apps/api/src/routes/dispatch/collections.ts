import { assertStableCode } from '@kingturf/domain';
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
export function* collectionsAttempts(scope: RouteDispatchContext): RouteAttempts {
  const { request, dependencies, context, correlationId } = scope;
  if (dependencies.collections) {
    yield routeReply(
      dispatchRoutes(
        collectionRoutes({
          repository: dependencies.collections,
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
        }),
        request,
      ),
      'truthy',
    );
  }
}
