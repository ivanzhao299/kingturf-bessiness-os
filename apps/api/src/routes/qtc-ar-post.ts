import { DomainError, type AuthorizationContext } from '@kingturf/domain';
import type { PermissionKey } from '@kingturf/types';
import type { ApiDependencies, ApiRequest } from '../app.ts';
import { defineRoute, type RouteDefinition } from './types.ts';

type Qtc = NonNullable<ApiDependencies['quoteToCash']>;
type PostAr = Qtc['postAr'];
type Input = Readonly<Parameters<PostAr>[0]>;
type ScopeContext = Readonly<Parameters<PostAr>[2]>;
type Repository = Pick<Qtc, 'postAr'>;
type ValidatedAr = Readonly<{
  repository: Repository;
  postAr: PostAr;
  input: Input;
  key: Parameters<PostAr>[1];
  scopeContext: ScopeContext;
}>;
type Context = Readonly<{
  repository: () => Repository;
  body: Readonly<Record<string, unknown>>;
  authorization: AuthorizationContext;
  authorizeScope: (capability: PermissionKey) => ScopeContext;
  correlationId: Parameters<PostAr>[3];
  mutationDto: <T extends Record<string, unknown>>(
    value: T,
    authorization: AuthorizationContext,
    readCapability: PermissionKey,
  ) => Partial<T>;
  parsers: Readonly<{
    allow: (body: Record<string, unknown>, fields: readonly string[]) => void;
    string: (value: unknown, name: string) => string;
    uuid: (value: unknown, name: string) => string;
    currency: (value: unknown) => string;
    decimal: (value: unknown, name: string) => string;
    timestamp: (value: unknown, name: string) => string;
    idempotency: (request: ApiRequest) => string;
  }>;
}>;

export function qtcArPostRoutes(context: Context): readonly RouteDefinition[] {
  return [
    defineRoute({
      method: 'POST',
      match: (pathname) => (pathname === '/api/v1/ar-open-items' ? { params: [] } : null),
      validate: (request): ValidatedAr => {
        context.parsers.allow(context.body, [
          'customerId',
          'salesOrderId',
          'documentNumber',
          'documentType',
          'currency',
          'amount',
          'dueAt',
        ]);
        const dt = context.parsers.string(context.body.documentType, 'documentType');
        if (!['INVOICE', 'CREDIT_NOTE'].includes(dt))
          throw new DomainError('invalid_request', 'documentType is unsupported');
        const repository = context.repository();
        const postAr = repository.postAr;
        const input: Input = {
          customerId: context.parsers.uuid(context.body.customerId, 'customerId'),
          salesOrderId:
            context.body.salesOrderId === null
              ? null
              : context.parsers.uuid(context.body.salesOrderId, 'salesOrderId'),
          documentNumber: context.parsers.string(context.body.documentNumber, 'documentNumber'),
          documentType: dt as Input['documentType'],
          currency: context.parsers.currency(context.body.currency),
          amount: context.parsers.decimal(context.body.amount, 'amount'),
          dueAt: context.parsers.timestamp(context.body.dueAt, 'dueAt'),
        };
        const key = context.parsers.idempotency(request);
        const scopeContext = context.authorizeScope('ar:post');
        return { repository, postAr, input, key, scopeContext };
      },
      handler: async (_request, _match, validated) => {
        const result = await validated.postAr.call(
          validated.repository,
          validated.input,
          validated.key,
          validated.scopeContext,
          context.correlationId,
        );
        return {
          statusCode: 201,
          body: context.mutationDto(result, context.authorization, 'ar:read'),
        };
      },
    }),
  ];
}
