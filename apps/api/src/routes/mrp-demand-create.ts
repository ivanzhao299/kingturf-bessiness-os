import type { AuthorizationContext } from '@kingturf/domain';
import type { PermissionKey } from '@kingturf/types';
import type { ApiDependencies } from '../app.ts';
import type { authorizeQuery } from '../policy.ts';
import { defineRoute, type RouteDefinition } from './types.ts';

type Repository = Pick<NonNullable<ApiDependencies['mrp']>, 'createDemand'>;
type CreateDemand = Repository['createDemand'];
type Input = Readonly<Parameters<CreateDemand>[0]>;
type ScopeContext = Readonly<Parameters<CreateDemand>[1]>;
type ValidatedDemand = Readonly<{
  repository: Repository;
  createDemand: CreateDemand;
  input: Input;
  scopeContext: ScopeContext;
  correlationId: Parameters<CreateDemand>[2];
}>;
type Context = Readonly<{
  repository: () => Repository;
  authorization: AuthorizationContext;
  authorizeQuery: typeof authorizeQuery;
  correlationId: Parameters<CreateDemand>[2];
  parsers: Readonly<{
    objectBody: (value: unknown) => Record<string, unknown>;
    allow: (body: Record<string, unknown>, fields: readonly string[]) => void;
    string: (value: unknown, name: string) => string;
    stableCode: (value: string) => string;
    uuid: (value: unknown, name: string) => string;
    calendarDate: (value: unknown, name: string) => string;
    decimal: (value: unknown, name: string) => string;
    integer: (value: unknown, name: string, minimum: number, maximum: number) => number;
  }>;
  mutationDto: <T extends Record<string, unknown>>(
    value: T,
    authorization: AuthorizationContext,
    readCapability: PermissionKey,
  ) => Partial<T>;
}>;

export function mrpDemandCreateRoutes(context: Context): readonly RouteDefinition[] {
  return [
    defineRoute({
      method: 'POST',
      match: (pathname) => (pathname === '/api/v1/mrp-demands' ? { params: [] } : null),
      validate: (request): ValidatedDemand => {
        const body = context.parsers.objectBody(request.body);
        context.parsers.allow(body, [
          'itemVersionId',
          'sourceType',
          'sourceId',
          'requiredAt',
          'quantity',
          'priority',
        ]);
        const grant = context.authorizeQuery(context.authorization, 'mrp:run', Object.keys(body));
        const repository = context.repository();
        const createDemand = repository.createDemand;
        const input: Input = {
          itemVersionId: context.parsers.uuid(body.itemVersionId, 'itemVersionId'),
          sourceType: context.parsers.stableCode(
            context.parsers.string(body.sourceType, 'sourceType'),
          ),
          sourceId: context.parsers.uuid(body.sourceId, 'sourceId'),
          requiredAt: context.parsers.calendarDate(body.requiredAt, 'requiredAt'),
          quantity: context.parsers.decimal(body.quantity, 'quantity'),
          priority: context.parsers.integer(body.priority ?? 100, 'priority', 1, 100000),
        };
        const scopeContext: ScopeContext = {
          actor: context.authorization.actor,
          scopes: grant.scopes,
          anchors: grant.anchors,
        };
        const correlationId = context.correlationId;
        return { repository, createDemand, input, scopeContext, correlationId };
      },
      handler: async (_request, _match, validated) => {
        const result: Awaited<ReturnType<CreateDemand>> = await validated.createDemand.call(
          validated.repository,
          validated.input,
          validated.scopeContext,
          validated.correlationId,
        );
        return {
          statusCode: 201,
          body: context.mutationDto(result, context.authorization, 'mrp:read'),
        };
      },
    }),
  ];
}
