import type { AuthorizationContext } from '@kingturf/domain';
import type { PermissionKey } from '@kingturf/types';
import type { ApiDependencies, ApiRequest } from '../app.ts';
import { defineRoute, type RouteDefinition } from './types.ts';

type Qtc = NonNullable<ApiDependencies['quoteToCash']>;
type SetCreditLimit = Qtc['setCreditLimit'];
type EvaluateCredit = Qtc['evaluateCredit'];
type LimitInput = Readonly<Parameters<SetCreditLimit>[0]>;
type EvaluationInput = Readonly<Parameters<EvaluateCredit>[0]>;
type ValidatedLimit = Readonly<{
  repository: Pick<Qtc, 'setCreditLimit'>;
  setCreditLimit: SetCreditLimit;
  input: LimitInput;
  key: Parameters<SetCreditLimit>[1];
  scopeContext: Readonly<Parameters<SetCreditLimit>[2]>;
}>;
type ValidatedEvaluation = Readonly<{
  repository: Pick<Qtc, 'evaluateCredit'>;
  evaluateCredit: EvaluateCredit;
  input: EvaluationInput;
  key: Parameters<EvaluateCredit>[1];
  scopeContext: Readonly<Parameters<EvaluateCredit>[2]>;
}>;
type SharedContext = Readonly<{
  body: Readonly<Record<string, unknown>>;
  authorization: AuthorizationContext;
  authorizeScope: (capability: PermissionKey) => Readonly<Parameters<SetCreditLimit>[2]>;
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
    idempotency: (request: ApiRequest) => string;
  }>;
}>;
type LimitContext = SharedContext &
  Readonly<{
    repository: () => Pick<Qtc, 'setCreditLimit'>;
    correlationId: Parameters<SetCreditLimit>[3];
  }>;
type EvaluationContext = SharedContext &
  Readonly<{
    repository: () => Pick<Qtc, 'evaluateCredit'>;
    correlationId: Parameters<EvaluateCredit>[3];
  }>;

export function qtcCreditLimitRoutes(context: LimitContext): readonly RouteDefinition[] {
  return [
    defineRoute({
      method: 'POST',
      match: (pathname) => (pathname === '/api/v1/credit-limits' ? { params: [] } : null),
      validate: (request): ValidatedLimit => {
        context.parsers.allow(context.body, [
          'customerId',
          'currency',
          'amount',
          'effectiveAt',
          'expiresAt',
        ]);
        const repository = context.repository();
        const setCreditLimit = repository.setCreditLimit;
        const input: LimitInput = {
          customerId: context.parsers.uuid(context.body.customerId, 'customerId'),
          currency: context.parsers.currency(context.body.currency),
          amount: context.parsers.decimal(context.body.amount, 'amount'),
          effectiveAt: context.parsers.timestamp(context.body.effectiveAt, 'effectiveAt'),
          expiresAt: context.parsers.timestamp(context.body.expiresAt, 'expiresAt'),
        };
        const key = context.parsers.idempotency(request);
        const scopeContext = context.authorizeScope('credit:approve');
        return { repository, setCreditLimit, input, key, scopeContext };
      },
      handler: async (_request, _match, validated) => {
        const result = await validated.setCreditLimit.call(
          validated.repository,
          validated.input,
          validated.key,
          validated.scopeContext,
          context.correlationId,
        );
        return {
          statusCode: 201,
          body: context.mutationDto(result, context.authorization, 'credit:read'),
        };
      },
    }),
  ];
}

export function qtcCreditEvaluationRoutes(context: EvaluationContext): readonly RouteDefinition[] {
  return [
    defineRoute({
      method: 'POST',
      match: (pathname) => (pathname === '/api/v1/credit-decisions' ? { params: [] } : null),
      validate: (request): ValidatedEvaluation => {
        context.parsers.allow(context.body, [
          'customerId',
          'quoteRevisionId',
          'quoteSnapshotId',
          'creditLimitId',
          'validUntil',
        ]);
        const repository = context.repository();
        const evaluateCredit = repository.evaluateCredit;
        const input: EvaluationInput = {
          customerId: context.parsers.uuid(context.body.customerId, 'customerId'),
          quoteRevisionId: context.parsers.uuid(context.body.quoteRevisionId, 'quoteRevisionId'),
          quoteSnapshotId: context.parsers.uuid(context.body.quoteSnapshotId, 'quoteSnapshotId'),
          creditLimitId: context.parsers.uuid(context.body.creditLimitId, 'creditLimitId'),
          validUntil: context.parsers.timestamp(context.body.validUntil, 'validUntil'),
        };
        const key = context.parsers.idempotency(request);
        const scopeContext = context.authorizeScope('credit:evaluate');
        return { repository, evaluateCredit, input, key, scopeContext };
      },
      handler: async (_request, _match, validated) => {
        const result = await validated.evaluateCredit.call(
          validated.repository,
          validated.input,
          validated.key,
          validated.scopeContext,
          context.correlationId,
        );
        return {
          statusCode: 201,
          body: context.mutationDto(result, context.authorization, 'credit:read'),
        };
      },
    }),
  ];
}
