import { DomainError, type AuthorizationContext } from '@kingturf/domain';
import type { PermissionKey } from '@kingturf/types';
import type { ApiDependencies } from '../app.ts';
import type { authorizeQuery } from '../policy.ts';
import { defineRoute, type RouteDefinition } from './types.ts';

type Repository = Pick<NonNullable<ApiDependencies['procurement']>, 'move'>;
type Move = Repository['move'];
type Input = Readonly<Parameters<Move>[0]>;
type ScopeContext = Readonly<Parameters<Move>[1]>;
type ValidatedMovement = Readonly<{
  repository: Repository;
  move: Move;
  input: Input;
  scopeContext: ScopeContext;
  correlationId: Parameters<Move>[2];
}>;
type Context = Readonly<{
  repository: () => Repository;
  authorization: AuthorizationContext;
  authorizeQuery: typeof authorizeQuery;
  correlationId: Parameters<Move>[2];
  parsers: Readonly<{
    objectBody: (value: unknown) => Record<string, unknown>;
    allow: (body: Record<string, unknown>, fields: readonly string[]) => void;
    string: (value: unknown, name: string) => string;
    uuid: (value: unknown, name: string) => string;
    decimal: (value: unknown, name: string) => string;
    timestamp: (value: unknown, name: string) => string;
    stableCode: (value: string) => string;
  }>;
  mutationDto: <T extends Record<string, unknown>>(
    value: T,
    authorization: AuthorizationContext,
    readCapability: PermissionKey,
  ) => Partial<T>;
}>;

export function procurementMovementCreateRoutes(context: Context): readonly RouteDefinition[] {
  return [
    defineRoute({
      method: 'POST',
      match: (pathname) => (pathname === '/api/v1/inventory-movements' ? { params: [] } : null),
      validate: (request): ValidatedMovement => {
        const body = context.parsers.objectBody(request.body);
        context.parsers.allow(body, [
          'movementType',
          'itemVersionId',
          'lotId',
          'locationId',
          'quantity',
          'occurredAt',
          'sourceType',
          'sourceId',
        ]);
        const grant = context.authorizeQuery(
          context.authorization,
          'inventory:move',
          Object.keys(body),
        );
        const movementType = context.parsers.string(body.movementType, 'movementType');
        if (
          ![
            'ISSUE',
            'RETURN',
            'TRANSFER_IN',
            'TRANSFER_OUT',
            'ADJUSTMENT_IN',
            'ADJUSTMENT_OUT',
          ].includes(movementType)
        )
          throw new DomainError('invalid_request', 'movementType is unsupported');
        const repository = context.repository();
        const move = repository.move;
        const input: Input = {
          movementType: movementType as Input['movementType'],
          itemVersionId: context.parsers.uuid(body.itemVersionId, 'itemVersionId'),
          lotId: context.parsers.uuid(body.lotId, 'lotId'),
          locationId: context.parsers.uuid(body.locationId, 'locationId'),
          quantity: context.parsers.decimal(body.quantity, 'quantity'),
          occurredAt: context.parsers.timestamp(body.occurredAt, 'occurredAt'),
          sourceType: context.parsers.stableCode(
            context.parsers.string(body.sourceType, 'sourceType'),
          ),
          sourceId: context.parsers.uuid(body.sourceId, 'sourceId'),
        };
        const scopeContext: ScopeContext = {
          actor: context.authorization.actor,
          scopes: grant.scopes,
          anchors: grant.anchors,
        };
        const correlationId = context.correlationId;
        return { repository, move, input, scopeContext, correlationId };
      },
      handler: async (_request, _match, validated) => {
        const result: Awaited<ReturnType<Move>> = await validated.move.call(
          validated.repository,
          validated.input,
          validated.scopeContext,
          validated.correlationId,
        );
        return {
          statusCode: 201,
          body: context.mutationDto(result, context.authorization, 'inventory:read'),
        };
      },
    }),
  ];
}
