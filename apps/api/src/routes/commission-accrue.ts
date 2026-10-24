import { DomainError, type AuthorizationContext } from '@kingturf/domain';
import type { PermissionKey } from '@kingturf/types';
import type { ApiDependencies, ApiRequest } from '../app.ts';
import type { authorizeQuery } from '../policy.ts';
import { defineRoute, type RouteDefinition } from './types.ts';

type Repository = Pick<NonNullable<ApiDependencies['commissions']>, 'accrue'>;
type Accrue = Repository['accrue'];
type AccrueInput = Readonly<Parameters<Accrue>[0]>;
type ScopeContext = Readonly<Parameters<Accrue>[2]>;
type ValidatedAccrue = Readonly<{
  repository: Repository;
  accrue: Accrue;
  input: AccrueInput;
  key: Parameters<Accrue>[1];
  scopeContext: ScopeContext;
  correlationId: Parameters<Accrue>[3];
}>;
type Context = Readonly<{
  repository: () => Repository;
  authorization: AuthorizationContext;
  authorizeQuery: typeof authorizeQuery;
  correlationId: Parameters<Accrue>[3];
  parsers: Readonly<{
    objectBody: (value: unknown) => Record<string, unknown>;
    allow: (body: Record<string, unknown>, fields: readonly string[]) => void;
    string: (value: unknown, name: string) => string;
    uuid: (value: unknown, name: string) => string;
    idempotency: (request: ApiRequest) => Parameters<Accrue>[1];
  }>;
  mutationDto: <T extends Record<string, unknown>>(
    value: T,
    authorization: AuthorizationContext,
    readCapability: PermissionKey,
  ) => Partial<T>;
}>;

export function commissionAccrueRoutes(context: Context): readonly RouteDefinition[] {
  return [
    defineRoute({
      method: 'POST',
      match: (pathname) => (pathname === '/api/v1/commissions/accrue' ? { params: [] } : null),
      validate: (request): ValidatedAccrue => {
        const body = context.parsers.objectBody(request.body);
        context.parsers.allow(body, [
          'salesOrderId',
          'beneficiaryEmployeeId',
          'policyVersionId',
          'accountingPeriod',
        ]);
        const grant = context.authorizeQuery(
          context.authorization,
          'commission:accrue',
          Object.keys(body),
        );
        const accountingPeriod = context.parsers.string(body.accountingPeriod, 'accountingPeriod');
        if (!/^[0-9]{4}-(0[1-9]|1[0-2])$/u.test(accountingPeriod))
          throw new DomainError('invalid_request', 'accountingPeriod must use YYYY-MM');
        const repository = context.repository();
        const accrue = repository.accrue;
        const input: AccrueInput = {
          salesOrderId: context.parsers.uuid(body.salesOrderId, 'salesOrderId'),
          beneficiaryEmployeeId: context.parsers.uuid(
            body.beneficiaryEmployeeId,
            'beneficiaryEmployeeId',
          ),
          policyVersionId: context.parsers.uuid(body.policyVersionId, 'policyVersionId'),
          accountingPeriod,
        };
        const key = context.parsers.idempotency(request);
        const scopeContext: ScopeContext = {
          actor: context.authorization.actor,
          scopes: grant.scopes,
          anchors: grant.anchors,
        };
        const correlationId = context.correlationId;
        return { repository, accrue, input, key, scopeContext, correlationId };
      },
      handler: async (_request, _match, validated) => {
        const result: Awaited<ReturnType<Accrue>> = await validated.accrue.call(
          validated.repository,
          validated.input,
          validated.key,
          validated.scopeContext,
          validated.correlationId,
        );
        return {
          statusCode: 201,
          body: context.mutationDto(result, context.authorization, 'commission:read'),
        };
      },
    }),
  ];
}
