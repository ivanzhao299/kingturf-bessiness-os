import type { AuthorizationContext } from '@kingturf/domain';
import type { PermissionKey } from '@kingturf/types';
import type { ApiDependencies, ApiRequest } from '../app.ts';
import { defineRoute, type RouteDefinition } from './types.ts';

type Qtc = NonNullable<ApiDependencies['quoteToCash']>;
type Reconcile = Qtc['reconcile'];
type Input = Readonly<Parameters<Reconcile>[0]>;
type ScopeContext = Readonly<Parameters<Reconcile>[2]>;
type Repository = Pick<Qtc, 'reconcile'>;
type ValidatedRun = Readonly<{
  repository: Repository;
  reconcile: Reconcile;
  input: Input;
  key: Parameters<Reconcile>[1];
  scopeContext: ScopeContext;
}>;
type Context = Readonly<{
  repository: () => Repository;
  body: Readonly<Record<string, unknown>>;
  authorization: AuthorizationContext;
  authorizeScope: (capability: PermissionKey) => ScopeContext;
  correlationId: Parameters<Reconcile>[3];
  mutationDto: <T extends Record<string, unknown>>(
    value: T,
    authorization: AuthorizationContext,
    readCapability: PermissionKey,
  ) => Partial<T>;
  parsers: Readonly<{
    allow: (body: Record<string, unknown>, fields: readonly string[]) => void;
    uuid: (value: unknown, name: string) => string;
    idempotency: (request: ApiRequest) => string;
  }>;
}>;

export function qtcReconciliationRunRoutes(context: Context): readonly RouteDefinition[] {
  return [
    defineRoute({
      method: 'POST',
      match: (pathname) => (pathname === '/api/v1/reconciliation-runs' ? { params: [] } : null),
      validate: (request): ValidatedRun => {
        context.parsers.allow(context.body, ['paymentId']);
        const repository = context.repository();
        const reconcile = repository.reconcile;
        const input: Input = {
          paymentId: context.parsers.uuid(context.body.paymentId, 'paymentId'),
        };
        const key = context.parsers.idempotency(request);
        const scopeContext = context.authorizeScope('reconciliation:run');
        return { repository, reconcile, input, key, scopeContext };
      },
      handler: async (_request, _match, validated) => {
        const result = await validated.reconcile.call(
          validated.repository,
          validated.input,
          validated.key,
          validated.scopeContext,
          context.correlationId,
        );
        return {
          statusCode: 201,
          body: context.mutationDto(result, context.authorization, 'reconciliation:read'),
        };
      },
    }),
  ];
}
