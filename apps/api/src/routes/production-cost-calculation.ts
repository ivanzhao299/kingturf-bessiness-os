import type { AuthorizationContext } from '@kingturf/domain';
import type { PermissionKey } from '@kingturf/types';
import type { ApiDependencies } from '../app.ts';
import type { authorizeQuery } from '../policy.ts';
import { defineRoute, type RouteDefinition } from './types.ts';

type Costs = NonNullable<ApiDependencies['productionCosts']>;
type Calculate = Costs['calculate'];
type CalculationInput = Readonly<Parameters<Calculate>[0]>;
type ScopeContext = Readonly<Parameters<Calculate>[1]>;
type ValidatedCalculation = Readonly<{
  calculate: Calculate;
  input: CalculationInput;
  scopeContext: ScopeContext;
}>;
type Context = Readonly<{
  repository: Pick<Costs, 'calculate'>;
  authorization: AuthorizationContext;
  authorizeQuery: typeof authorizeQuery;
  correlationId: Parameters<Calculate>[2];
  parsers: Readonly<{
    objectBody: (body: unknown) => Record<string, unknown>;
    allow: (body: Record<string, unknown>, fields: readonly string[]) => void;
    uuid: (value: unknown, name: string) => string;
    string: (value: unknown, name: string) => string;
    stableCode: (value: string) => string;
  }>;
  mutationDto: <T extends Record<string, unknown>>(
    value: T,
    authorization: AuthorizationContext,
    readCapability: PermissionKey,
  ) => Partial<T>;
}>;

export function productionCostCalculationRoutes(context: Context): readonly RouteDefinition[] {
  return [
    defineRoute({
      method: 'POST',
      match: (pathname) => (pathname === '/api/v1/production-cost-runs' ? { params: [] } : null),
      validate: (request): ValidatedCalculation => {
        const body = context.parsers.objectBody(request.body);
        context.parsers.allow(body, [
          'productionOrderId',
          'policyId',
          'runNumber',
          'idempotencyKey',
        ]);
        const grant = context.authorizeQuery(
          context.authorization,
          'manufacturing-cost:calculate',
          Object.keys(body),
        );
        const calculate = context.repository.calculate;
        const input: CalculationInput = {
          productionOrderId: context.parsers.uuid(body.productionOrderId, 'productionOrderId'),
          policyId: context.parsers.uuid(body.policyId, 'policyId'),
          runNumber: context.parsers.stableCode(
            context.parsers.string(body.runNumber, 'runNumber'),
          ),
          idempotencyKey: context.parsers.stableCode(
            context.parsers.string(body.idempotencyKey, 'idempotencyKey'),
          ),
        };
        const scopeContext: ScopeContext = {
          actor: context.authorization.actor,
          scopes: grant.scopes,
          anchors: grant.anchors,
        };
        return { calculate, input, scopeContext };
      },
      handler: async (_request, _match, validated) => {
        const result = await validated.calculate.call(
          context.repository,
          validated.input,
          validated.scopeContext,
          context.correlationId,
        );
        return {
          statusCode: 201,
          body: context.mutationDto(result, context.authorization, 'manufacturing-cost:read'),
        };
      },
    }),
  ];
}
