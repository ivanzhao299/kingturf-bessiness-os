import { assertCurrency, assertStableCode } from '@kingturf/domain';
import {
  allow,
  calendarDate,
  decimal,
  integer,
  jsonObject,
  mutationDto,
  objectBody,
  permittedDto,
  string,
  uuid,
} from '../../app-values.ts';
import { authorizeQuery } from '../../policy.ts';
import { productionCostCalculationRoutes } from '../production-cost-calculation.ts';
import { productionCostDecisionRoutes } from '../production-cost-decisions.ts';
import { productionCostPolicyRoutes } from '../production-cost-policy.ts';
import {
  productionCostPolicyReadRoutes,
  productionCostRunReadRoutes,
} from '../production-reads.ts';
import { dispatchRoutes } from '../types.ts';
import { routeReply, type RouteAttempts, type RouteDispatchContext } from './context.ts';
export function* costsAttempts(scope: RouteDispatchContext): RouteAttempts {
  const { request, dependencies, context, correlationId } = scope;
  if (dependencies.productionCosts) {
    if (request.method === 'GET' && request.pathname === '/api/v1/production-cost-policies') {
      yield routeReply(
        dispatchRoutes(
          productionCostPolicyReadRoutes({
            repository: dependencies.productionCosts,
            authorization: context,
            authorizeQuery,
          }),
          request,
        ),
      );
    }
    if (request.method === 'GET' && request.pathname === '/api/v1/production-cost-runs') {
      yield routeReply(
        dispatchRoutes(
          productionCostRunReadRoutes({
            repository: dependencies.productionCosts,
            authorization: context,
            authorizeQuery,
            permittedDto,
          }),
          request,
        ),
      );
    }
    if (request.method === 'POST' && request.pathname === '/api/v1/production-cost-policies') {
      yield routeReply(
        dispatchRoutes(
          productionCostPolicyRoutes({
            repository: dependencies.productionCosts,
            authorization: context,
            authorizeQuery,
            correlationId,
            parsers: {
              objectBody,
              allow,
              uuid,
              decimal,
              string,
              stableCode: assertStableCode,
              integer,
              currency: assertCurrency,
              calendarDate,
            },
            mutationDto,
          }),
          request,
        ),
      );
    }
    if (request.method === 'POST' && request.pathname === '/api/v1/production-cost-runs') {
      yield routeReply(
        dispatchRoutes(
          productionCostCalculationRoutes({
            repository: dependencies.productionCosts,
            authorization: context,
            authorizeQuery,
            correlationId,
            parsers: { objectBody, allow, uuid, string, stableCode: assertStableCode },
            mutationDto,
          }),
          request,
        ),
      );
    }
    const costDecision = /^\/api\/v1\/production-cost-runs\/([0-9a-f-]+)\/(approve|reject)$/u.exec(
      request.pathname,
    );
    if (request.method === 'POST' && costDecision) {
      yield routeReply(
        dispatchRoutes(
          productionCostDecisionRoutes({
            repository: dependencies.productionCosts,
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
}
