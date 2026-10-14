import { DomainError, type AuthorizationContext } from '@kingturf/domain';
import type { PermissionKey } from '@kingturf/types';
import type { ApiDependencies } from '../app.ts';
import type { authorizeQuery } from '../policy.ts';
import { defineRoute, type RouteDefinition } from './types.ts';

type Production = NonNullable<ApiDependencies['production']>;
type TransactMaterial = Production['transactMaterial'];
type MaterialInput = Readonly<Parameters<TransactMaterial>[1]>;
type ScopeContext = Readonly<Parameters<TransactMaterial>[2]>;
type ValidatedMaterial = Readonly<{
  transactMaterial: TransactMaterial;
  id: Parameters<TransactMaterial>[0];
  input: MaterialInput;
  scopeContext: ScopeContext;
}>;
type Context = Readonly<{
  repository: Pick<Production, 'transactMaterial'>;
  authorization: AuthorizationContext;
  authorizeQuery: typeof authorizeQuery;
  correlationId: Parameters<TransactMaterial>[3];
  parsers: Readonly<{
    objectBody: (body: unknown) => Record<string, unknown>;
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

export function productionMaterialRoutes(context: Context): readonly RouteDefinition[] {
  return [
    defineRoute({
      method: 'POST',
      match: (pathname) => {
        const match = /^\/api\/v1\/production-orders\/([0-9a-f-]+)\/materials$/u.exec(pathname);
        return match ? { params: match.slice(1) } : null;
      },
      validate: (request, match): ValidatedMaterial => {
        const body = context.parsers.objectBody(request.body);
        context.parsers.allow(body, [
          'transactionType',
          'itemVersionId',
          'lotId',
          'locationId',
          'quantity',
          'reason',
          'occurredAt',
          'idempotencyKey',
        ]);
        const grant = context.authorizeQuery(
          context.authorization,
          'production:material',
          Object.keys(body),
        );
        const transactionType = context.parsers.string(body.transactionType, 'transactionType');
        if (!['ISSUE', 'RETURN'].includes(transactionType))
          throw new DomainError('invalid_request', 'transactionType is unsupported');
        const transactMaterial = context.repository.transactMaterial;
        const id = context.parsers.uuid(match.params[0], 'productionOrderId');
        const input: MaterialInput = {
          transactionType: transactionType as MaterialInput['transactionType'],
          itemVersionId: context.parsers.uuid(body.itemVersionId, 'itemVersionId'),
          lotId: context.parsers.uuid(body.lotId, 'lotId'),
          locationId: context.parsers.uuid(body.locationId, 'locationId'),
          quantity: context.parsers.decimal(body.quantity, 'quantity'),
          reason: context.parsers.string(body.reason, 'reason'),
          occurredAt: context.parsers.timestamp(body.occurredAt, 'occurredAt'),
          idempotencyKey: context.parsers.stableCode(
            context.parsers.string(body.idempotencyKey, 'idempotencyKey'),
          ),
        };
        const scopeContext: ScopeContext = {
          actor: context.authorization.actor,
          scopes: grant.scopes,
          anchors: grant.anchors,
        };
        return { transactMaterial, id, input, scopeContext };
      },
      handler: async (_request, _match, validated) => {
        const result = await validated.transactMaterial.call(
          context.repository,
          validated.id,
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
