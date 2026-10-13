import type { PermissionKey } from '@kingturf/types';
import type { ApiDependencies, ApiRequest, ApiResponse } from '../app.ts';
import type { AuthorizedQuery } from '../policy.ts';
import type { AuthorizationContext } from '@kingturf/domain';
import { defineRoute, dispatchRoutes, type RouteDefinition } from './types.ts';

type OpportunityRepository = Pick<
  NonNullable<ApiDependencies['commercial']>,
  | 'listOpportunities'
  | 'findOpportunity'
  | 'createOpportunity'
  | 'updateOpportunity'
  | 'transitionOpportunity'
>;
type OpportunityContext = Readonly<{
  repository: OpportunityRepository | undefined;
  authorization: AuthorizationContext;
  correlationId: string;
  authorize: (capability: PermissionKey, fields?: readonly string[]) => AuthorizedQuery;
  unavailable: () => ApiResponse;
  notFound: () => ApiResponse;
  permittedDto: (value: Record<string, unknown>) => unknown;
  mutationDto: (value: Record<string, unknown>) => unknown;
  parsers: Readonly<{
    objectBody: (body: unknown) => Record<string, unknown>;
    allow: (body: Record<string, unknown>, fields: readonly string[]) => void;
    string: (value: unknown, name: string) => string;
    uuid: (value: unknown, name: string) => string;
    decimal: (value: unknown, name: string) => string;
    currency: (value: unknown) => string;
    integer: (value: unknown, name: string, minimum: number, maximum: number) => number;
    expectedVersion: (value: unknown) => number;
  }>;
}>;
type PatchInput = Readonly<{
  opportunityId: string;
  grant: AuthorizedQuery;
  expectedVersion: number;
}> &
  (
    | Readonly<{ kind: 'update'; patch: Parameters<OpportunityRepository['updateOpportunity']>[1] }>
    | Readonly<{
        kind: 'lifecycle';
        status: Parameters<OpportunityRepository['transitionOpportunity']>[1];
        reason: string;
      }>
  );
const collectionMatch = (pathname: string) =>
  pathname === '/api/v1/opportunities' ? { params: [] } : null;
const itemMatch = (pathname: string) => {
  const match = /^\/api\/v1\/opportunities\/([0-9a-f-]+)$/u.exec(pathname);
  return match ? { params: match.slice(1) } : null;
};

function readRoutes(
  context: OpportunityContext,
  repository: OpportunityRepository,
): readonly RouteDefinition[] {
  return [
    defineRoute({
      method: 'GET',
      match: collectionMatch,
      // Body is deliberately ignored; validation produces the original authorized read grant.
      validate: () => context.authorize('opportunity:read'),
      handler: async (_request, _match, grant) => ({
        statusCode: 200,
        body: {
          items: (
            await repository.listOpportunities(
              context.authorization.actor,
              grant.scopes,
              grant.anchors,
            )
          ).map((item) => context.permittedDto(item)),
        },
      }),
    }),
    defineRoute({
      method: 'GET',
      match: itemMatch,
      validate: (_request, match) => {
        const grant = context.authorize('opportunity:read');
        return { grant, opportunityId: context.parsers.uuid(match.params[0], 'opportunityId') };
      },
      handler: async (_request, _match, input) => {
        const item = await repository.findOpportunity(
          input.opportunityId,
          context.authorization.actor,
          input.grant.scopes,
          input.grant.anchors,
        );
        return item ? { statusCode: 200, body: context.permittedDto(item) } : context.notFound();
      },
    }),
  ];
}

function writeRoutes(
  context: OpportunityContext,
  repository: OpportunityRepository,
  body: Record<string, unknown>,
): readonly RouteDefinition[] {
  const p = context.parsers;
  return [
    defineRoute({
      method: 'POST',
      match: collectionMatch,
      validate: () => {
        p.allow(body, [
          'customerId',
          'leadId',
          'name',
          'value',
          'currency',
          'probabilityBasisPoints',
          'expectedCloseDate',
        ]);
        context.authorize('opportunity:create', Object.keys(body));
        return {
          customerId: body.customerId === null ? null : p.uuid(body.customerId, 'customerId'),
          leadId: body.leadId === null ? null : p.uuid(body.leadId, 'leadId'),
          name: p.string(body.name, 'name'),
          value: p.decimal(body.value, 'value'),
          currency: p.currency(body.currency),
          probabilityBasisPoints: p.integer(
            body.probabilityBasisPoints,
            'probabilityBasisPoints',
            0,
            10000,
          ),
          expectedCloseDate: p.string(body.expectedCloseDate, 'expectedCloseDate'),
        };
      },
      handler: async (_request, _match, input) => ({
        statusCode: 201,
        body: context.mutationDto(
          await repository.createOpportunity(
            input,
            context.authorization.actor,
            context.correlationId,
          ),
        ),
      }),
    }),
    defineRoute({
      method: 'PATCH',
      match: itemMatch,
      validate: (_request, match): PatchInput => {
        const transition = body.status !== undefined;
        p.allow(
          body,
          transition
            ? ['status', 'reason', 'expectedVersion']
            : [
                'name',
                'value',
                'currency',
                'probabilityBasisPoints',
                'expectedCloseDate',
                'expectedVersion',
              ],
        );
        const capability = transition ? 'opportunity:lifecycle' : 'opportunity:update';
        const grant = context.authorize(
          capability,
          Object.keys(body).filter((key) => key !== 'expectedVersion' && key !== 'reason'),
        );
        const opportunityId = p.uuid(match.params[0], 'opportunityId');
        if (transition)
          return {
            kind: 'lifecycle',
            grant,
            opportunityId,
            // Preserve string-only validation here; the repository owns lifecycle transition rules.
            status: p.string(body.status, 'status') as Parameters<
              OpportunityRepository['transitionOpportunity']
            >[1],
            reason: p.string(body.reason, 'reason'),
            expectedVersion: p.expectedVersion(body.expectedVersion),
          };
        return {
          kind: 'update',
          grant,
          opportunityId,
          patch: {
            ...(body.name === undefined ? {} : { name: p.string(body.name, 'name') }),
            ...(body.value === undefined ? {} : { value: p.decimal(body.value, 'value') }),
            ...(body.currency === undefined ? {} : { currency: p.currency(body.currency) }),
            ...(body.probabilityBasisPoints === undefined
              ? {}
              : {
                  probabilityBasisPoints: p.integer(
                    body.probabilityBasisPoints,
                    'probabilityBasisPoints',
                    0,
                    10000,
                  ),
                }),
            ...(body.expectedCloseDate === undefined
              ? {}
              : { expectedCloseDate: p.string(body.expectedCloseDate, 'expectedCloseDate') }),
          },
          expectedVersion: p.expectedVersion(body.expectedVersion),
        };
      },
      handler: async (_request, _match, input) => {
        const result =
          input.kind === 'lifecycle'
            ? await repository.transitionOpportunity(
                input.opportunityId,
                input.status,
                input.reason,
                input.expectedVersion,
                context.authorization.actor,
                input.grant.scopes,
                input.grant.anchors,
                context.correlationId,
              )
            : await repository.updateOpportunity(
                input.opportunityId,
                input.patch,
                input.expectedVersion,
                context.authorization.actor,
                input.grant.scopes,
                input.grant.anchors,
                context.correlationId,
              );
        return { statusCode: 200, body: context.mutationDto(result) };
      },
    }),
  ];
}

export async function dispatchOpportunityRoutes(
  context: OpportunityContext,
  request: ApiRequest,
): Promise<ApiResponse | null> {
  // The broad matcher also owns dependency/body checks for unsupported method/item combinations.
  const match = /^\/api\/v1\/opportunities(?:\/([0-9a-f-]+))?$/u.exec(request.pathname);
  if (!match) return null;
  const repository = context.repository;
  if (!repository) return context.unavailable();
  const body = request.method === 'GET' ? {} : context.parsers.objectBody(request.body);
  const routes = [...readRoutes(context, repository), ...writeRoutes(context, repository, body)];
  // A null result resumes app's original later branches; no successful legacy fallback remains.
  return dispatchRoutes(routes, request);
}
