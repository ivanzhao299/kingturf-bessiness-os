import { DomainError, type AuthorizationContext } from '@kingturf/domain';
import type { PermissionKey } from '@kingturf/types';
import type { ApiDependencies, ApiRequest } from '../app.ts';
import { defineRoute, type RouteDefinition } from './types.ts';

type Qtc = NonNullable<ApiDependencies['quoteToCash']>;
type CreateOrder = Qtc['createOrder'];
type Input = Readonly<Parameters<CreateOrder>[0]>;
type Line = Readonly<Input['lines'][number]>;
type ScopeContext = Readonly<Parameters<CreateOrder>[2]>;
type Repository = Pick<Qtc, 'createOrder'>;
type ValidatedOrder = Readonly<{
  repository: Repository;
  createOrder: CreateOrder;
  input: Input;
  key: Parameters<CreateOrder>[1];
  scopeContext: ScopeContext;
}>;
type Context = Readonly<{
  repository: () => Repository;
  body: Readonly<Record<string, unknown>>;
  authorization: AuthorizationContext;
  authorizeScope: (capability: PermissionKey) => ScopeContext;
  correlationId: Parameters<CreateOrder>[3];
  mutationDto: <T extends Record<string, unknown>>(
    value: T,
    authorization: AuthorizationContext,
    readCapability: PermissionKey,
  ) => Partial<T>;
  parsers: Readonly<{
    allow: (body: Record<string, unknown>, fields: readonly string[]) => void;
    array: (value: unknown, name: string) => readonly unknown[];
    objectBody: (value: unknown) => Record<string, unknown>;
    string: (value: unknown, name: string) => string;
    decimal: (value: unknown, name: string) => string;
    addDecimal: (left: string, right: string) => string;
    normalizeDecimal: (value: string) => string;
    uuid: (value: unknown, name: string) => string;
    currency: (value: unknown) => string;
    idempotency: (request: ApiRequest) => string;
  }>;
}>;

export function qtcSalesOrderCreateRoutes(context: Context): readonly RouteDefinition[] {
  return [
    defineRoute({
      method: 'POST',
      match: (pathname) => (pathname === '/api/v1/sales-orders' ? { params: [] } : null),
      validate: (request): ValidatedOrder => {
        context.parsers.allow(context.body, [
          'customerId',
          'opportunityId',
          'orderNumber',
          'quoteRevisionId',
          'quoteSnapshotId',
          'creditDecisionId',
          'contractRevisionId',
          'signatureEvidenceId',
          'currency',
          'total',
          'lines',
        ]);
        const lines = context.parsers.array(context.body.lines, 'lines').map((v, i): Line => {
          const l = context.parsers.objectBody(v);
          context.parsers.allow(l, ['description', 'quantity', 'unitPrice', 'total']);
          return {
            description: context.parsers.string(l.description, `lines[${String(i)}].description`),
            quantity: context.parsers.decimal(l.quantity, 'quantity'),
            unitPrice: context.parsers.decimal(l.unitPrice, 'unitPrice'),
            total: context.parsers.decimal(l.total, 'total'),
          };
        });
        if (!lines.length)
          throw new DomainError('invalid_request', 'Sales order requires at least one line');
        const declaredTotal = context.parsers.decimal(context.body.total, 'total');
        const lineTotal = lines.reduce(
          (sum, line) => context.parsers.addDecimal(sum, line.total),
          '0',
        );
        if (context.parsers.normalizeDecimal(declaredTotal) !== lineTotal)
          throw new DomainError('invalid_request', 'Sales order lines must equal order total');
        const repository = context.repository();
        const createOrder = repository.createOrder;
        const input: Input = {
          customerId: context.parsers.uuid(context.body.customerId, 'customerId'),
          opportunityId: context.parsers.uuid(context.body.opportunityId, 'opportunityId'),
          orderNumber: context.parsers.string(context.body.orderNumber, 'orderNumber'),
          quoteRevisionId: context.parsers.uuid(context.body.quoteRevisionId, 'quoteRevisionId'),
          quoteSnapshotId: context.parsers.uuid(context.body.quoteSnapshotId, 'quoteSnapshotId'),
          creditDecisionId: context.parsers.uuid(context.body.creditDecisionId, 'creditDecisionId'),
          contractRevisionId: context.parsers.uuid(
            context.body.contractRevisionId,
            'contractRevisionId',
          ),
          signatureEvidenceId: context.parsers.uuid(
            context.body.signatureEvidenceId,
            'signatureEvidenceId',
          ),
          currency: context.parsers.currency(context.body.currency),
          total: declaredTotal,
          lines,
        };
        const key = context.parsers.idempotency(request);
        const scopeContext = context.authorizeScope('sales-order:create');
        return { repository, createOrder, input, key, scopeContext };
      },
      handler: async (_request, _match, validated) => {
        const result = await validated.createOrder.call(
          validated.repository,
          validated.input,
          validated.key,
          validated.scopeContext,
          context.correlationId,
        );
        return {
          statusCode: 201,
          body: context.mutationDto(result, context.authorization, 'sales-order:read'),
        };
      },
    }),
  ];
}
