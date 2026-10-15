import { DomainError, type AuthorizationContext } from '@kingturf/domain';
import type { PermissionKey } from '@kingturf/types';
import type { ApiDependencies } from '../app.ts';
import type { authorizeQuery } from '../policy.ts';
import { defineRoute, type RouteDefinition } from './types.ts';

type Repository = Pick<NonNullable<ApiDependencies['procurement']>, 'createSupplierQuote'>;
type CreateSupplierQuote = Repository['createSupplierQuote'];
type Input = Readonly<Parameters<CreateSupplierQuote>[0]>;
type ScopeContext = Readonly<Parameters<CreateSupplierQuote>[1]>;
type ValidatedQuote = Readonly<{
  repository: Repository;
  createSupplierQuote: CreateSupplierQuote;
  input: Input;
  scopeContext: ScopeContext;
  correlationId: Parameters<CreateSupplierQuote>[2];
}>;
type Context = Readonly<{
  repository: () => Repository;
  authorization: AuthorizationContext;
  authorizeQuery: typeof authorizeQuery;
  correlationId: Parameters<CreateSupplierQuote>[2];
  parsers: Readonly<{
    objectBody: (value: unknown) => Record<string, unknown>;
    allow: (body: Record<string, unknown>, fields: readonly string[]) => void;
    array: (value: unknown, name: string) => readonly unknown[];
    jsonObject: (value: unknown, name: string) => Input['terms'];
    uuid: (value: unknown, name: string) => string;
    decimal: (value: unknown, name: string) => string;
    calendarDate: (value: unknown, name: string) => string;
    string: (value: unknown, name: string) => string;
    timestamp: (value: unknown, name: string) => string;
  }>;
  mutationDto: <T extends Record<string, unknown>>(
    value: T,
    authorization: AuthorizationContext,
    readCapability: PermissionKey,
  ) => Partial<T>;
}>;

export function procurementSupplierQuoteCreateRoutes(context: Context): readonly RouteDefinition[] {
  return [
    defineRoute({
      method: 'POST',
      match: (pathname) => (pathname === '/api/v1/supplier-quotes' ? { params: [] } : null),
      validate: (request): ValidatedQuote => {
        const body = context.parsers.objectBody(request.body);
        context.parsers.allow(body, [
          'rfqId',
          'supplierId',
          'quoteReference',
          'receivedAt',
          'validUntil',
          'terms',
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
            'rfqLineId',
            'unitPrice',
            'promisedAt',
            'minimumOrderQuantity',
          ]);
          return {
            rfqLineId: context.parsers.uuid(line.rfqLineId, 'rfqLineId'),
            unitPrice: context.parsers.decimal(line.unitPrice, 'unitPrice'),
            promisedAt: context.parsers.calendarDate(line.promisedAt, 'promisedAt'),
            minimumOrderQuantity: context.parsers.decimal(
              line.minimumOrderQuantity,
              'minimumOrderQuantity',
            ),
          };
        });
        if (!lines.length) throw new DomainError('invalid_request', 'lines must not be empty');
        const repository = context.repository();
        const createSupplierQuote = repository.createSupplierQuote;
        const input: Input = {
          rfqId: context.parsers.uuid(body.rfqId, 'rfqId'),
          supplierId: context.parsers.uuid(body.supplierId, 'supplierId'),
          quoteReference: context.parsers.string(body.quoteReference, 'quoteReference'),
          receivedAt: context.parsers.timestamp(body.receivedAt, 'receivedAt'),
          validUntil: context.parsers.calendarDate(body.validUntil, 'validUntil'),
          terms: context.parsers.jsonObject(body.terms ?? {}, 'terms'),
          lines,
        };
        const scopeContext: ScopeContext = {
          actor: context.authorization.actor,
          scopes: grant.scopes,
          anchors: grant.anchors,
        };
        const correlationId = context.correlationId;
        return { repository, createSupplierQuote, input, scopeContext, correlationId };
      },
      handler: async (_request, _match, validated) => {
        const result: Awaited<ReturnType<CreateSupplierQuote>> =
          await validated.createSupplierQuote.call(
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
