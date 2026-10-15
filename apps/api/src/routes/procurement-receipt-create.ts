import { DomainError, type AuthorizationContext } from '@kingturf/domain';
import type { PermissionKey } from '@kingturf/types';
import type { ApiDependencies } from '../app.ts';
import type { authorizeQuery } from '../policy.ts';
import { defineRoute, type RouteDefinition } from './types.ts';

type Repository = Pick<NonNullable<ApiDependencies['procurement']>, 'receive'>;
type Receive = Repository['receive'];
type Input = Readonly<Parameters<Receive>[0]>;
type ScopeContext = Readonly<Parameters<Receive>[1]>;
type ValidatedReceipt = Readonly<{
  repository: Repository;
  receive: Receive;
  input: Input;
  scopeContext: ScopeContext;
  correlationId: Parameters<Receive>[2];
}>;
type Context = Readonly<{
  repository: () => Repository;
  authorization: AuthorizationContext;
  authorizeQuery: typeof authorizeQuery;
  correlationId: Parameters<Receive>[2];
  parsers: Readonly<{
    objectBody: (value: unknown) => Record<string, unknown>;
    allow: (body: Record<string, unknown>, fields: readonly string[]) => void;
    array: (value: unknown, name: string) => readonly unknown[];
    jsonObject: (value: unknown, name: string) => Record<string, unknown>;
    uuid: (value: unknown, name: string) => string;
    string: (value: unknown, name: string) => string;
    stableCode: (value: string) => string;
    decimal: (value: unknown, name: string) => string;
    optionalCalendarDate: (value: unknown, name: string) => string | null;
    timestamp: (value: unknown, name: string) => string;
  }>;
  mutationDto: <T extends Record<string, unknown>>(
    value: T,
    authorization: AuthorizationContext,
    readCapability: PermissionKey,
  ) => Partial<T>;
}>;

export function procurementReceiptCreateRoutes(context: Context): readonly RouteDefinition[] {
  return [
    defineRoute({
      method: 'POST',
      match: (pathname) => (pathname === '/api/v1/goods-receipts' ? { params: [] } : null),
      validate: (request): ValidatedReceipt => {
        const body = context.parsers.objectBody(request.body);
        context.parsers.allow(body, [
          'receiptNumber',
          'purchaseOrderId',
          'receivedAt',
          'sourceReference',
          'lines',
        ]);
        const grant = context.authorizeQuery(
          context.authorization,
          'procurement:manage',
          Object.keys(body),
        );
        const lines = context.parsers.array(body.lines, 'lines').map((entry, index) => {
          const line = context.parsers.jsonObject(entry, `lines[${String(index)}]`);
          context.parsers.allow(line, [
            'purchaseOrderLineId',
            'lotNumber',
            'locationCode',
            'quantity',
            'manufacturedAt',
            'expiresAt',
          ]);
          return {
            purchaseOrderLineId: context.parsers.uuid(
              line.purchaseOrderLineId,
              'purchaseOrderLineId',
            ),
            lotNumber: context.parsers.stableCode(
              context.parsers.string(line.lotNumber, 'lotNumber'),
            ),
            locationCode: context.parsers.stableCode(
              context.parsers.string(line.locationCode, 'locationCode'),
            ),
            quantity: context.parsers.decimal(line.quantity, 'quantity'),
            manufacturedAt: context.parsers.optionalCalendarDate(
              Object.hasOwn(line, 'manufacturedAt') ? line.manufacturedAt : null,
              'manufacturedAt',
            ),
            expiresAt: context.parsers.optionalCalendarDate(
              Object.hasOwn(line, 'expiresAt') ? line.expiresAt : null,
              'expiresAt',
            ),
          };
        });
        if (!lines.length) throw new DomainError('invalid_request', 'lines must not be empty');
        const repository = context.repository();
        const receive = repository.receive;
        const input: Input = {
          receiptNumber: context.parsers.stableCode(
            context.parsers.string(body.receiptNumber, 'receiptNumber'),
          ),
          purchaseOrderId: context.parsers.uuid(body.purchaseOrderId, 'purchaseOrderId'),
          receivedAt: context.parsers.timestamp(body.receivedAt, 'receivedAt'),
          sourceReference: context.parsers.string(body.sourceReference, 'sourceReference'),
          lines,
        };
        const scopeContext: ScopeContext = {
          actor: context.authorization.actor,
          scopes: grant.scopes,
          anchors: grant.anchors,
        };
        const correlationId = context.correlationId;
        return { repository, receive, input, scopeContext, correlationId };
      },
      handler: async (_request, _match, validated) => {
        const result: Awaited<ReturnType<Receive>> = await validated.receive.call(
          validated.repository,
          validated.input,
          validated.scopeContext,
          validated.correlationId,
        );
        return {
          statusCode: 201,
          body: context.mutationDto(result, context.authorization, 'procurement:read'),
        };
      },
    }),
  ];
}
