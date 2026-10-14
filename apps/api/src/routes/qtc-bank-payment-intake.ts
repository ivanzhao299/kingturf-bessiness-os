import type { AuthorizationContext } from '@kingturf/domain';
import type { PermissionKey } from '@kingturf/types';
import type { ApiDependencies, ApiRequest } from '../app.ts';
import { defineRoute, type RouteDefinition } from './types.ts';

type Qtc = NonNullable<ApiDependencies['quoteToCash']>;
type IntakePayment = Qtc['intakePayment'];
type Input = Readonly<Parameters<IntakePayment>[0]>;
type ScopeContext = Readonly<Parameters<IntakePayment>[2]>;
type Repository = Pick<Qtc, 'intakePayment'>;
type ValidatedPayment = Readonly<{
  repository: Repository;
  intakePayment: IntakePayment;
  input: Input;
  key: Parameters<IntakePayment>[1];
  scopeContext: ScopeContext;
}>;
type Context = Readonly<{
  repository: () => Repository;
  body: Readonly<Record<string, unknown>>;
  authorization: AuthorizationContext;
  authorizeScope: (capability: PermissionKey) => ScopeContext;
  correlationId: Parameters<IntakePayment>[3];
  mutationDto: <T extends Record<string, unknown>>(
    value: T,
    authorization: AuthorizationContext,
    readCapability: PermissionKey,
  ) => Partial<T>;
  parsers: Readonly<{
    allow: (body: Record<string, unknown>, fields: readonly string[]) => void;
    uuid: (value: unknown, name: string) => string;
    currency: (value: unknown) => string;
    decimal: (value: unknown, name: string) => string;
    timestamp: (value: unknown, name: string) => string;
    string: (value: unknown, name: string) => string;
    jsonObject: (value: unknown, name: string) => Input['rawPayload'];
    idempotency: (request: ApiRequest) => string;
  }>;
}>;

export function qtcBankPaymentIntakeRoutes(context: Context): readonly RouteDefinition[] {
  return [
    defineRoute({
      method: 'POST',
      match: (pathname) => (pathname === '/api/v1/bank-payments' ? { params: [] } : null),
      validate: (request): ValidatedPayment => {
        context.parsers.allow(context.body, [
          'customerId',
          'currency',
          'amount',
          'receivedAt',
          'bankReference',
          'rawPayload',
        ]);
        const repository = context.repository();
        const intakePayment = repository.intakePayment;
        const input: Input = {
          customerId: context.parsers.uuid(context.body.customerId, 'customerId'),
          currency: context.parsers.currency(context.body.currency),
          amount: context.parsers.decimal(context.body.amount, 'amount'),
          receivedAt: context.parsers.timestamp(context.body.receivedAt, 'receivedAt'),
          bankReference: context.parsers.string(context.body.bankReference, 'bankReference'),
          rawPayload: context.parsers.jsonObject(context.body.rawPayload, 'rawPayload'),
        };
        const key = context.parsers.idempotency(request);
        const scopeContext = context.authorizeScope('bank-payment:intake');
        return { repository, intakePayment, input, key, scopeContext };
      },
      handler: async (_request, _match, validated) => {
        const result = await validated.intakePayment.call(
          validated.repository,
          validated.input,
          validated.key,
          validated.scopeContext,
          context.correlationId,
        );
        return {
          statusCode: 201,
          body: context.mutationDto(result, context.authorization, 'bank-payment:read'),
        };
      },
    }),
  ];
}
