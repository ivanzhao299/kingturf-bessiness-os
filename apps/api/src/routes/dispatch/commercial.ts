import {
  allow,
  array,
  calendarDate,
  costFactorSourceType,
  currency,
  decimal,
  error,
  expectedVersion,
  idempotency,
  integer,
  jsonObject,
  mutationDto,
  objectBody,
  permittedDto,
  requireCostFactorItemSource,
  string,
  strings,
  timestamp,
  uuid,
  version,
} from '../../app-values.ts';
import { authorizeQuery } from '../../policy.ts';
import { commercialDefinitionRoutes } from '../commercial-definitions.ts';
import { commercialEvaluationRoutes } from '../commercial-evaluations.ts';
import { commercialNestedReadRoutes } from '../commercial-nested-reads.ts';
import { commercialViewRoutes } from '../commercial-views.ts';
import { costMatrixBaseRoutes } from '../cost-matrix-base.ts';
import { costMatrixCalculationRoutes } from '../cost-matrix-calculations.ts';
import { costMatrixFactorRoutes } from '../cost-matrix-factors.ts';
import { ctrRoutes } from '../ctr.ts';
import { dispatchOpportunityRoutes } from '../opportunities.ts';
import { quoteCommandRoutes } from '../quote-commands.ts';
import { quoteWriteRoutes } from '../quote-writes.ts';
import { technicalSolutionRoutes } from '../technical-solutions.ts';
import { dispatchRoutes } from '../types.ts';
import { routeReply, type RouteAttempts, type RouteDispatchContext } from './context.ts';
function* commercialPart1(scope: RouteDispatchContext): RouteAttempts {
  const { request, dependencies, context, correlationId } = scope;
  yield routeReply(
    dispatchOpportunityRoutes(
      {
        repository: dependencies.commercial,
        authorization: context,
        correlationId,
        authorize: (capability, fields) => authorizeQuery(context, capability, fields),
        unavailable: () =>
          error(503, 'internal_error', 'Commercial dependency unavailable', correlationId),
        notFound: () => error(404, 'not_found', 'Opportunity not found', correlationId),
        permittedDto: (value) =>
          permittedDto(value, context.permissions.get('opportunity:read')?.fields ?? null),
        mutationDto: (value) => mutationDto(value, context, 'opportunity:read'),
        parsers: {
          objectBody,
          allow,
          string,
          uuid,
          decimal,
          currency,
          integer,
          expectedVersion,
        },
      },
      request,
    ),
    'truthy',
  );
  if (dependencies.commercial) {
    yield routeReply(
      dispatchRoutes(
        commercialNestedReadRoutes({
          repository: dependencies.commercial,
          authorization: context,
          authorize: (capability) => authorizeQuery(context, capability),
          permittedDto: (value, capability) =>
            permittedDto(value, context.permissions.get(capability)?.fields ?? null),
          uuid,
        }),
        request,
      ),
      'truthy',
    );
  }
  if (dependencies.commercial) {
    yield routeReply(
      dispatchRoutes(
        commercialViewRoutes({
          repository: dependencies.commercial,
          authorization: context,
          authorize: (capability) => authorizeQuery(context, capability),
          permittedDto: (value, capability) =>
            permittedDto(value, context.permissions.get(capability)?.fields ?? null),
        }),
        request,
      ),
      'truthy',
    );
  }
  if (dependencies.commercial) {
    yield routeReply(
      dispatchRoutes(
        ctrRoutes({
          repository: dependencies.commercial,
          authorization: context,
          correlationId,
          authorize: (capability, fields) => authorizeQuery(context, capability, fields),
          mutationDto: (value) => mutationDto(value, context, 'ctr:read'),
          parsers: { objectBody, allow, uuid, string, jsonObject, version, idempotency },
        }),
        request,
      ),
      'truthy',
    );
  }
  if (dependencies.commercial) {
    yield routeReply(
      dispatchRoutes(
        technicalSolutionRoutes({
          repository: dependencies.commercial,
          authorization: context,
          correlationId,
          authorize: (capability, fields) => authorizeQuery(context, capability, fields),
          mutationDto: (value) => mutationDto(value, context, 'technical-solution:read'),
          parsers: { objectBody, allow, uuid, string, jsonObject, strings },
        }),
        request,
      ),
      'truthy',
    );
  }
  if (dependencies.commercial) {
    yield routeReply(
      dispatchRoutes(
        costMatrixBaseRoutes({
          repository: dependencies.commercial,
          authorization: context,
          correlationId,
          authorize: (capability, fields) => authorizeQuery(context, capability, fields),
          parsers: { objectBody, allow, uuid, string, jsonObject, integer, currency, decimal },
        }),
        request,
      ),
      'truthy',
    );
  }
  if (dependencies.commercial) {
    yield routeReply(
      dispatchRoutes(
        costMatrixFactorRoutes({
          repository: dependencies.commercial,
          authorization: context,
          correlationId,
          authorize: (capability, fields) => authorizeQuery(context, capability, fields),
          parsers: {
            objectBody,
            allow,
            uuid,
            string,
            decimal,
            calendarDate,
            integer,
            costFactorSourceType,
            requireCostFactorItemSource,
          },
        }),
        request,
      ),
      'truthy',
    );
  }
  if (dependencies.commercial) {
    yield routeReply(
      dispatchRoutes(
        costMatrixCalculationRoutes({
          repository: dependencies.commercial,
          authorization: context,
          correlationId,
          authorize: (capability, fields) => authorizeQuery(context, capability, fields),
          mutationDto: (value) => mutationDto(value, context, 'cost:read'),
          parsers: { objectBody, allow, uuid, string, idempotency },
        }),
        request,
      ),
      'truthy',
    );
  }
  if (dependencies.commercial) {
    yield routeReply(
      dispatchRoutes(
        commercialDefinitionRoutes({
          repository: dependencies.commercial,
          authorization: context,
          correlationId,
          authorize: (capability, fields) => authorizeQuery(context, capability, fields),
          parsers: { objectBody, allow, uuid, string, currency, array },
        }),
        request,
      ),
      'truthy',
    );
  }
  if (dependencies.commercial) {
    yield routeReply(
      dispatchRoutes(
        commercialEvaluationRoutes({
          repository: dependencies.commercial,
          authorization: context,
          correlationId,
          authorize: (capability, fields) => authorizeQuery(context, capability, fields),
          mutationDto: (value, capability) => mutationDto(value, context, capability),
          parsers: {
            objectBody,
            allow,
            uuid,
            string,
            decimal,
            currency,
            array,
            jsonObject,
            idempotency,
          },
        }),
        request,
      ),
      'truthy',
    );
  }
}
function* commercialPart2(scope: RouteDispatchContext): RouteAttempts {
  const { request, dependencies, context, correlationId } = scope;
  if (dependencies.commercial) {
    yield routeReply(
      dispatchRoutes(
        quoteWriteRoutes({
          repository: dependencies.commercial,
          authorization: context,
          correlationId,
          authorize: (capability, fields) => authorizeQuery(context, capability, fields),
          mutationDto: (value) => mutationDto(value, context, 'quote:read'),
          parsers: {
            objectBody,
            allow,
            uuid,
            string,
            decimal,
            currency,
            integer,
            timestamp,
            array,
            jsonObject,
          },
        }),
        request,
      ),
      'truthy',
    );
  }
  if (dependencies.commercial) {
    yield routeReply(
      dispatchRoutes(
        quoteCommandRoutes({
          repository: dependencies.commercial,
          authorization: context,
          correlationId,
          authorize: (capability) => authorizeQuery(context, capability),
          mutationDto: (value) => mutationDto(value, context, 'quote:read'),
          parsers: { objectBody, allow, uuid, string, idempotency },
        }),
        request,
      ),
      'truthy',
    );
  }
}
export function* commercialAttempts(scope: RouteDispatchContext): RouteAttempts {
  yield* commercialPart1(scope);
  yield* commercialPart2(scope);
}
