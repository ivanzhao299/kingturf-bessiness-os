import { DomainError, type AuthorizationContext } from '@kingturf/domain';
import type { PermissionKey } from '@kingturf/types';
import type { ApiDependencies } from '../app.ts';
import type { authorizeQuery } from '../policy.ts';
import { defineRoute, type RouteDefinition } from './types.ts';

type Repository = Pick<NonNullable<ApiDependencies['procurement']>, 'createPurchaseOrder'>;
type CreatePurchaseOrder = Repository['createPurchaseOrder'];
type Input = Readonly<Parameters<CreatePurchaseOrder>[0]>;
type ScopeContext = Readonly<Parameters<CreatePurchaseOrder>[1]>;
type ValidatedOrder = Readonly<{
  repository: Repository;
  createPurchaseOrder: CreatePurchaseOrder;
  input: Input;
  scopeContext: ScopeContext;
  correlationId: Parameters<CreatePurchaseOrder>[2];
}>;
type Context = Readonly<{
  repository: () => Repository;
  authorization: AuthorizationContext;
  authorizeQuery: typeof authorizeQuery;
  correlationId: Parameters<CreatePurchaseOrder>[2];
  parsers: Readonly<{
    objectBody: (value: unknown) => Record<string, unknown>;
    allow: (body: Record<string, unknown>, fields: readonly string[]) => void;
    array: (value: unknown, name: string) => readonly unknown[];
    jsonObject: (value: unknown, name: string) => Record<string, unknown>;
    uuid: (value: unknown, name: string) => string;
    decimal: (value: unknown, name: string) => string;
    calendarDate: (value: unknown, name: string) => string;
    string: (value: unknown, name: string) => string;
    stableCode: (value: string) => string;
    currency: (value: unknown) => string;
  }>;
  mutationDto: <T extends Record<string, unknown>>(
    value: T,
    authorization: AuthorizationContext,
    readCapability: PermissionKey,
  ) => Partial<T>;
}>;

export function procurementPurchaseOrderCreateRoutes(context: Context): readonly RouteDefinition[] {
  return [
    defineRoute({
      method: 'POST',
      match: (pathname) => (pathname === '/api/v1/purchase-orders' ? { params: [] } : null),
      validate: (request): ValidatedOrder => {
        const body = context.parsers.objectBody(request.body);
        context.parsers.allow(body, [
          'poNumber',
          'supplierId',
          'supplierQuoteId',
          'currency',
          'lines',
          'issue',
        ]);
        const grant = context.authorizeQuery(
          context.authorization,
          'procurement:manage',
          Object.keys(body),
        );
        const lines = context.parsers.array(body.lines, 'lines').map((entry, index) => {
          const line = context.parsers.jsonObject(entry, `lines[${String(index)}]`);
          context.parsers.allow(line, ['itemVersionId', 'quantity', 'unitPrice', 'requiredAt']);
          return {
            itemVersionId: context.parsers.uuid(line.itemVersionId, 'itemVersionId'),
            quantity: context.parsers.decimal(line.quantity, 'quantity'),
            unitPrice: context.parsers.decimal(line.unitPrice, 'unitPrice'),
            requiredAt: context.parsers.calendarDate(line.requiredAt, 'requiredAt'),
          };
        });
        if (!lines.length) throw new DomainError('invalid_request', 'lines must not be empty');
        const repository = context.repository();
        const createPurchaseOrder = repository.createPurchaseOrder;
        const input: Input = {
          poNumber: context.parsers.stableCode(context.parsers.string(body.poNumber, 'poNumber')),
          supplierId: context.parsers.uuid(body.supplierId, 'supplierId'),
          supplierQuoteId:
            body.supplierQuoteId === null || body.supplierQuoteId === undefined
              ? null
              : context.parsers.uuid(body.supplierQuoteId, 'supplierQuoteId'),
          currency: context.parsers.currency(body.currency),
          lines,
          issue: body.issue === true,
        };
        const scopeContext: ScopeContext = {
          actor: context.authorization.actor,
          scopes: grant.scopes,
          anchors: grant.anchors,
        };
        const correlationId = context.correlationId;
        return { repository, createPurchaseOrder, input, scopeContext, correlationId };
      },
      handler: async (_request, _match, validated) => {
        const result: Awaited<ReturnType<CreatePurchaseOrder>> =
          await validated.createPurchaseOrder.call(
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
