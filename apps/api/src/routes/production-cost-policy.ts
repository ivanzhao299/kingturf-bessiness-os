import { DomainError, type AuthorizationContext } from '@kingturf/domain';
import type { PermissionKey } from '@kingturf/types';
import type { ApiDependencies } from '../app.ts';
import type { authorizeQuery } from '../policy.ts';
import { defineRoute, type RouteDefinition } from './types.ts';

type Costs = NonNullable<ApiDependencies['productionCosts']>;
type CreatePolicy = Costs['createPolicy'];
type PolicyInput = Readonly<Parameters<CreatePolicy>[0]>;
type MaterialRate = Readonly<PolicyInput['materialRates'][number]>;
type ScopeContext = Readonly<Parameters<CreatePolicy>[1]>;
type ValidatedPolicy = Readonly<{
  createPolicy: CreatePolicy;
  input: PolicyInput;
  scopeContext: ScopeContext;
}>;
type Context = Readonly<{
  repository: Pick<Costs, 'createPolicy'>;
  authorization: AuthorizationContext;
  authorizeQuery: typeof authorizeQuery;
  correlationId: Parameters<CreatePolicy>[2];
  parsers: Readonly<{
    objectBody: (body: unknown) => Record<string, unknown>;
    allow: (body: Record<string, unknown>, fields: readonly string[]) => void;
    uuid: (value: unknown, name: string) => string;
    decimal: (value: unknown, name: string) => string;
    string: (value: unknown, name: string) => string;
    stableCode: (value: string) => string;
    integer: (value: unknown, name: string, minimum: number, maximum: number) => number;
    currency: (value: string) => string;
    calendarDate: (value: unknown, name: string) => string;
  }>;
  mutationDto: <T extends Record<string, unknown>>(
    value: T,
    authorization: AuthorizationContext,
    readCapability: PermissionKey,
  ) => Partial<T>;
}>;

export function productionCostPolicyRoutes(context: Context): readonly RouteDefinition[] {
  return [
    defineRoute({
      method: 'POST',
      match: (pathname) =>
        pathname === '/api/v1/production-cost-policies' ? { params: [] } : null,
      validate: (request): ValidatedPolicy => {
        const body = context.parsers.objectBody(request.body);
        context.parsers.allow(body, [
          'version',
          'currency',
          'laborRatePerHour',
          'machineRatePerHour',
          'overheadRatePerMachineHour',
          'effectiveFrom',
          'effectiveTo',
          'sourceReference',
          'materialRates',
        ]);
        const grant = context.authorizeQuery(
          context.authorization,
          'manufacturing-cost:policy',
          Object.keys(body),
        );
        if (!Array.isArray(body.materialRates) || !body.materialRates.length)
          throw new DomainError('invalid_request', 'materialRates must be a non-empty array');
        const materialRates = body.materialRates.map((raw: unknown): MaterialRate => {
          const row = context.parsers.objectBody(raw);
          context.parsers.allow(row, ['itemVersionId', 'unitCost', 'sourceReference']);
          return {
            itemVersionId: context.parsers.uuid(row.itemVersionId, 'itemVersionId'),
            unitCost: context.parsers.decimal(row.unitCost, 'unitCost'),
            sourceReference: context.parsers.stableCode(
              context.parsers.string(row.sourceReference, 'sourceReference'),
            ),
          };
        });
        const createPolicy = context.repository.createPolicy;
        const input: PolicyInput = {
          version: context.parsers.integer(body.version, 'version', 1, 1000000),
          currency: context.parsers.currency(context.parsers.string(body.currency, 'currency')),
          laborRatePerHour: context.parsers.decimal(body.laborRatePerHour, 'laborRatePerHour'),
          machineRatePerHour: context.parsers.decimal(
            body.machineRatePerHour,
            'machineRatePerHour',
          ),
          overheadRatePerMachineHour: context.parsers.decimal(
            body.overheadRatePerMachineHour,
            'overheadRatePerMachineHour',
          ),
          effectiveFrom: context.parsers.calendarDate(body.effectiveFrom, 'effectiveFrom'),
          ...(body.effectiveTo === undefined
            ? {}
            : { effectiveTo: context.parsers.calendarDate(body.effectiveTo, 'effectiveTo') }),
          sourceReference: context.parsers.stableCode(
            context.parsers.string(body.sourceReference, 'sourceReference'),
          ),
          materialRates,
        };
        const scopeContext: ScopeContext = {
          actor: context.authorization.actor,
          scopes: grant.scopes,
          anchors: grant.anchors,
        };
        return { createPolicy, input, scopeContext };
      },
      handler: async (_request, _match, validated) => {
        const result = await validated.createPolicy.call(
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
