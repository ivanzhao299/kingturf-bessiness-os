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
  type RiskEvaluationRepository,
  type RiskTaskRepository,
} from '../../app-values.ts';
import type { ApiDependencies } from '../../app.ts';
import { authorizeQuery } from '../../policy.ts';
import { riskEvaluationCreateRoutes } from '../risk-evaluation-create.ts';
import { riskPolicyCreateRoutes } from '../risk-policy-create.ts';
import { riskPolicyPublishRoutes } from '../risk-policy-publish.ts';
import { riskPolicyRevisionRoutes } from '../risk-policy-revision.ts';
import { riskEvaluationReadRoutes, riskPolicyReadRoutes } from '../risk-reads.ts';
import { riskTaskCommandRoutes } from '../risk-task-commands.ts';
import { dispatchRoutes } from '../types.ts';
import { routeReply, type RouteAttempts, type RouteDispatchContext } from './context.ts';
export function* riskAttempts(scope: RouteDispatchContext): RouteAttempts {
  const { request, dependencies, context, correlationId } = scope;
  if (dependencies.risks) {
    if (request.method === 'GET' && request.pathname === '/api/v1/risk-policies') {
      yield routeReply(
        dispatchRoutes(
          riskPolicyReadRoutes({
            repository: () =>
              dependencies.risks as Pick<NonNullable<ApiDependencies['risks']>, 'listPolicies'>,
            authorization: context,
            authorizeQuery,
            permittedDto,
          }),
          request,
        ),
      );
    }
    if (request.method === 'GET' && request.pathname === '/api/v1/risk-evaluations') {
      yield routeReply(
        dispatchRoutes(
          riskEvaluationReadRoutes({
            repository: () =>
              dependencies.risks as Pick<NonNullable<ApiDependencies['risks']>, 'listEvaluations'>,
            authorization: context,
            authorizeQuery,
            permittedDto,
          }),
          request,
        ),
      );
    }
    if (request.method === 'POST' && request.pathname === '/api/v1/risk-policies') {
      yield routeReply(
        dispatchRoutes(
          riskPolicyCreateRoutes({
            repository: () =>
              dependencies.risks as Pick<NonNullable<ApiDependencies['risks']>, 'createPolicy'>,
            authorization: context,
            authorizeQuery,
            correlationId,
            parsers: { objectBody, allow, string, integer, timestamp, array, jsonObject },
            mutationDto,
          }),
          request,
        ),
      );
    }
    const riskPolicyRevision = /^\/api\/v1\/risk-policies\/([0-9a-f-]+)\/versions$/u.exec(
      request.pathname,
    );
    if (request.method === 'POST' && riskPolicyRevision) {
      yield routeReply(
        dispatchRoutes(
          riskPolicyRevisionRoutes({
            repository: () =>
              dependencies.risks as Pick<
                NonNullable<ApiDependencies['risks']>,
                'createPolicyVersion'
              >,
            authorization: context,
            authorizeQuery,
            correlationId,
            parsers: { objectBody, allow, integer, timestamp, array, jsonObject },
            mutationDto,
          }),
          request,
        ),
      );
    }
    const riskPolicyPublish = /^\/api\/v1\/risk-policy-versions\/([0-9a-f-]+)\/publish$/u.exec(
      request.pathname,
    );
    if (request.method === 'POST' && riskPolicyPublish) {
      yield routeReply(
        dispatchRoutes(
          riskPolicyPublishRoutes({
            repository: () =>
              dependencies.risks as Pick<
                NonNullable<ApiDependencies['risks']>,
                'publishPolicyVersion'
              >,
            authorization: context,
            authorizeQuery,
            correlationId,
            parsers: { objectBody, allow },
            mutationDto,
          }),
          request,
        ),
      );
    }
    if (request.method === 'POST' && request.pathname === '/api/v1/risk-evaluations') {
      yield routeReply(
        dispatchRoutes(
          riskEvaluationCreateRoutes({
            repository: () => dependencies.risks as RiskEvaluationRepository,
            authorization: context,
            authorizeQuery,
            idempotency,
            correlationId,
            parsers: { objectBody, allow, uuid, timestamp },
            mutationDto,
          }),
          request,
        ),
      );
    }
    const riskTaskCommand =
      /^\/api\/v1\/risk-tasks\/([0-9a-f-]+)\/(acknowledge|escalate|close)$/u.exec(request.pathname);
    if (request.method === 'POST' && riskTaskCommand) {
      yield routeReply(
        dispatchRoutes(
          riskTaskCommandRoutes({
            repository: () => dependencies.risks as RiskTaskRepository,
            authorization: context,
            authorizeQuery,
            idempotency,
            correlationId,
            parsers: { objectBody, allow, string, jsonObject },
            mutationDto,
          }),
          request,
        ),
      );
    }
  }
}
