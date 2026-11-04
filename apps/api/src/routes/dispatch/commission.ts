import {
  allow,
  array,
  idempotency,
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
import { commissionAccrueRoutes } from '../commission-accrue.ts';
import { commissionCommandRoutes } from '../commission-commands.ts';
import { commissionPolicyPublishRoutes } from '../commission-policy-publish.ts';
import {
  commissionPolicyCreateRoutes,
  commissionPolicyVersionRoutes,
} from '../commission-policy-writes.ts';
import { commissionReadRoutes } from '../commission-reads.ts';
import { dispatchRoutes } from '../types.ts';
import { routeReply, type RouteAttempts, type RouteDispatchContext } from './context.ts';
export function* commissionAttempts(scope: RouteDispatchContext): RouteAttempts {
  const { request, dependencies, context, correlationId } = scope;
  if (dependencies.commissions) {
    if (request.method === 'GET' && request.pathname === '/api/v1/commission-policies') {
      yield routeReply(
        dispatchRoutes(
          commissionReadRoutes({
            repository: () =>
              dependencies.commissions as Pick<
                NonNullable<ApiDependencies['commissions']>,
                'listPolicies' | 'listCases'
              >,
            authorization: context,
            authorizeQuery,
            permittedDto,
          }),
          request,
        ),
      );
    }
    if (request.method === 'GET' && request.pathname === '/api/v1/commissions') {
      yield routeReply(
        dispatchRoutes(
          commissionReadRoutes({
            repository: () =>
              dependencies.commissions as Pick<
                NonNullable<ApiDependencies['commissions']>,
                'listPolicies' | 'listCases'
              >,
            authorization: context,
            authorizeQuery,
            permittedDto,
          }),
          request,
        ),
      );
    }
    if (request.method === 'POST' && request.pathname === '/api/v1/commission-policies') {
      yield routeReply(
        dispatchRoutes(
          commissionPolicyCreateRoutes({
            repository: () =>
              dependencies.commissions as Pick<
                NonNullable<ApiDependencies['commissions']>,
                'createPolicy' | 'createPolicyVersion'
              >,
            authorization: context,
            authorizeQuery,
            correlationId,
            parsers: { objectBody, allow, string, uuid, integer, timestamp, jsonObject, array },
            mutationDto,
          }),
          request,
        ),
      );
    }
    const commissionPolicyRevision =
      /^\/api\/v1\/commission-policies\/([0-9a-f-]+)\/versions$/u.exec(request.pathname);
    if (request.method === 'POST' && commissionPolicyRevision) {
      yield routeReply(
        dispatchRoutes(
          commissionPolicyVersionRoutes({
            repository: () =>
              dependencies.commissions as Pick<
                NonNullable<ApiDependencies['commissions']>,
                'createPolicy' | 'createPolicyVersion'
              >,
            authorization: context,
            authorizeQuery,
            correlationId,
            parsers: { objectBody, allow, string, uuid, integer, timestamp, jsonObject, array },
            mutationDto,
          }),
          request,
        ),
      );
    }
    const commissionPolicyPublish =
      /^\/api\/v1\/commission-policy-versions\/([0-9a-f-]+)\/publish$/u.exec(request.pathname);
    if (request.method === 'POST' && commissionPolicyPublish) {
      yield routeReply(
        dispatchRoutes(
          commissionPolicyPublishRoutes({
            repository: () =>
              dependencies.commissions as Pick<
                NonNullable<ApiDependencies['commissions']>,
                'publishPolicyVersion'
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
    if (request.method === 'POST' && request.pathname === '/api/v1/commissions/accrue') {
      yield routeReply(
        dispatchRoutes(
          commissionAccrueRoutes({
            repository: () =>
              dependencies.commissions as Pick<
                NonNullable<ApiDependencies['commissions']>,
                'accrue'
              >,
            authorization: context,
            authorizeQuery,
            correlationId,
            parsers: { objectBody, allow, string, uuid, idempotency },
            mutationDto,
          }),
          request,
        ),
      );
    }
    const commissionCommand =
      /^\/api\/v1\/commissions\/([0-9a-f-]+)\/(freeze|release|pay|clawback|cancel)$/u.exec(
        request.pathname,
      );
    if (request.method === 'POST' && commissionCommand) {
      yield routeReply(
        dispatchRoutes(
          commissionCommandRoutes({
            repository: () =>
              dependencies.commissions as Pick<
                NonNullable<ApiDependencies['commissions']>,
                'transition'
              >,
            authorization: context,
            authorizeQuery,
            correlationId,
            parsers: { objectBody, allow, uuid, string, idempotency },
            mutationDto,
          }),
          request,
        ),
      );
    }
  }
}
