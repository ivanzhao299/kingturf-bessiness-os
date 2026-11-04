import { assertStableCode } from '@kingturf/domain';
import type { PermissionKey } from '@kingturf/types';
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
  timestamp,
  uuid,
} from '../../app-values.ts';
import type { ApiDependencies } from '../../app.ts';
import { authorizeQuery } from '../../policy.ts';
import { mrpDemandCreateRoutes } from '../mrp-demand-create.ts';
import { mrpPolicyCreateRoutes } from '../mrp-policy-create.ts';
import { mrpProposalCommandRoutes } from '../mrp-proposal-commands.ts';
import { mrpReadRoutes } from '../mrp-reads.ts';
import { mrpRunCreateRoutes } from '../mrp-run-create.ts';
import { dispatchRoutes } from '../types.ts';
import { routeReply, type RouteAttempts, type RouteDispatchContext } from './context.ts';
export function* mrpAttempts(scope: RouteDispatchContext): RouteAttempts {
  const { request, dependencies, context, correlationId } = scope;
  if (dependencies.mrp) {
    const mrpLists: Readonly<
      Record<string, readonly ['policies' | 'demands' | 'runs', PermissionKey] | undefined>
    > = {
      '/api/v1/mrp-policies': ['policies', 'mrp-policy:read'],
      '/api/v1/mrp-demands': ['demands', 'mrp:read'],
      '/api/v1/mrp-runs': ['runs', 'mrp:read'],
    };
    const listDefinition = mrpLists[request.pathname];
    if (request.method === 'GET' && listDefinition) {
      const [view, capability] = listDefinition;
      yield routeReply(
        dispatchRoutes(
          mrpReadRoutes({
            repository: () => dependencies.mrp as Pick<NonNullable<ApiDependencies['mrp']>, 'list'>,
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
    if (request.method === 'POST' && request.pathname === '/api/v1/mrp-policies') {
      yield routeReply(
        dispatchRoutes(
          mrpPolicyCreateRoutes({
            repository: () =>
              dependencies.mrp as Pick<NonNullable<ApiDependencies['mrp']>, 'createPolicy'>,
            authorization: context,
            authorizeQuery,
            correlationId,
            parsers: { objectBody, allow, string, uuid, decimal, integer, timestamp },
            mutationDto,
          }),
          request,
        ),
      );
    }
    if (request.method === 'POST' && request.pathname === '/api/v1/mrp-demands') {
      yield routeReply(
        dispatchRoutes(
          mrpDemandCreateRoutes({
            repository: () =>
              dependencies.mrp as Pick<NonNullable<ApiDependencies['mrp']>, 'createDemand'>,
            authorization: context,
            authorizeQuery,
            correlationId,
            parsers: {
              objectBody,
              allow,
              string,
              stableCode: assertStableCode,
              uuid,
              calendarDate,
              decimal,
              integer,
            },
            mutationDto,
          }),
          request,
        ),
      );
    }
    if (request.method === 'POST' && request.pathname === '/api/v1/mrp-runs') {
      yield routeReply(
        dispatchRoutes(
          mrpRunCreateRoutes({
            repository: () => dependencies.mrp as Pick<NonNullable<ApiDependencies['mrp']>, 'run'>,
            authorization: context,
            authorizeQuery,
            correlationId,
            parsers: {
              objectBody,
              allow,
              string,
              stableCode: assertStableCode,
              timestamp,
              calendarDate,
            },
            mutationDto,
          }),
          request,
        ),
      );
    }
    const proposalCommand =
      /^\/api\/v1\/mrp-proposals\/([0-9a-f-]+)\/(approve|reject|release|cancel)$/u.exec(
        request.pathname,
      );
    if (request.method === 'POST' && proposalCommand) {
      yield routeReply(
        dispatchRoutes(
          mrpProposalCommandRoutes({
            repository: () =>
              dependencies.mrp as Pick<NonNullable<ApiDependencies['mrp']>, 'transitionProposal'>,
            authorization: context,
            authorizeQuery,
            correlationId,
            parsers: { objectBody, allow, uuid, string, jsonObject },
            mutationDto,
          }),
          request,
        ),
      );
    }
  }
}
