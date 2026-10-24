import type { AuthorizationContext } from '@kingturf/domain';
import type { PermissionKey } from '@kingturf/types';
import type { ApiDependencies } from '../app.ts';
import type { authorizeQuery } from '../policy.ts';
import { defineRoute, type RouteDefinition } from './types.ts';

type Production = NonNullable<ApiDependencies['production']>;
type Create = Production['create'];
type CreateInput = Readonly<Parameters<Create>[0]>;
type ScopeContext = Readonly<Parameters<Create>[1]>;
type ValidatedCreate = Readonly<{
  create: Create;
  input: CreateInput;
  scopeContext: ScopeContext;
}>;
type Context = Readonly<{
  repository: Pick<Production, 'create'>;
  authorization: AuthorizationContext;
  authorizeQuery: typeof authorizeQuery;
  correlationId: Parameters<Create>[2];
  parsers: Readonly<{
    objectBody: (body: unknown) => Record<string, unknown>;
    allow: (body: Record<string, unknown>, fields: readonly string[]) => void;
    string: (value: unknown, name: string) => string;
    stableCode: (value: string) => string;
    uuid: (value: unknown, name: string) => string;
    decimal: (value: unknown, name: string) => string;
    calendarDate: (value: unknown, name: string) => string;
  }>;
  mutationDto: <T extends Record<string, unknown>>(
    value: T,
    authorization: AuthorizationContext,
    readCapability: PermissionKey,
  ) => Partial<T>;
}>;

export function productionOrderCreateRoutes(context: Context): readonly RouteDefinition[] {
  return [
    defineRoute({
      method: 'POST',
      match: (pathname) => (pathname === '/api/v1/production-orders' ? { params: [] } : null),
      validate: (request): ValidatedCreate => {
        const body = context.parsers.objectBody(request.body);
        context.parsers.allow(body, [
          'orderNumber',
          'itemVersionId',
          'routingVersionId',
          'mrpProposalId',
          'plannedQuantity',
          'plannedStartAt',
          'plannedDueAt',
          'sourceReference',
        ]);
        const grant = context.authorizeQuery(
          context.authorization,
          'production:plan',
          Object.keys(body),
        );
        const create = context.repository.create;
        const input: CreateInput = {
          orderNumber: context.parsers.stableCode(
            context.parsers.string(body.orderNumber, 'orderNumber'),
          ),
          itemVersionId: context.parsers.uuid(body.itemVersionId, 'itemVersionId'),
          routingVersionId: context.parsers.uuid(body.routingVersionId, 'routingVersionId'),
          ...(body.mrpProposalId === undefined
            ? {}
            : { mrpProposalId: context.parsers.uuid(body.mrpProposalId, 'mrpProposalId') }),
          plannedQuantity: context.parsers.decimal(body.plannedQuantity, 'plannedQuantity'),
          plannedStartAt: context.parsers.calendarDate(body.plannedStartAt, 'plannedStartAt'),
          plannedDueAt: context.parsers.calendarDate(body.plannedDueAt, 'plannedDueAt'),
          sourceReference: context.parsers.stableCode(
            context.parsers.string(body.sourceReference, 'sourceReference'),
          ),
        };
        const scopeContext: ScopeContext = {
          actor: context.authorization.actor,
          scopes: grant.scopes,
          anchors: grant.anchors,
        };
        return { create, input, scopeContext };
      },
      handler: async (_request, _match, validated) => {
        const result = await validated.create.call(
          context.repository,
          validated.input,
          validated.scopeContext,
          context.correlationId,
        );
        return {
          statusCode: 201,
          body: context.mutationDto(result, context.authorization, 'production:read'),
        };
      },
    }),
  ];
}
