import type { AuthorizationContext } from '@kingturf/domain';
import type { PermissionKey } from '@kingturf/types';
import type { ApiDependencies, ApiRequest } from '../app.ts';
import type { authorizeQuery } from '../policy.ts';
import { defineRoute, type RouteDefinition } from './types.ts';

type Repository = Pick<NonNullable<ApiDependencies['risks']>, 'evaluate'>;
type Evaluate = Repository['evaluate'];
type Input = Readonly<Parameters<Evaluate>[0]>;
type Key = Parameters<Evaluate>[1];
type ScopeContext = Readonly<Parameters<Evaluate>[2]>;
type ValidatedEvaluation = Readonly<{
  repository: Repository;
  evaluate: Evaluate;
  input: Input;
  key: Key;
  scopeContext: ScopeContext;
  correlationId: Parameters<Evaluate>[3];
}>;
type Context = Readonly<{
  repository: () => Repository;
  authorization: AuthorizationContext;
  authorizeQuery: typeof authorizeQuery;
  idempotency: (request: ApiRequest) => Key;
  correlationId: Parameters<Evaluate>[3];
  parsers: Readonly<{
    objectBody: (value: unknown) => Record<string, unknown>;
    allow: (body: Record<string, unknown>, fields: readonly string[]) => void;
    uuid: (value: unknown, name: string) => string;
    timestamp: (value: unknown, name: string) => string;
  }>;
  mutationDto: <T extends Record<string, unknown>>(
    value: T,
    authorization: AuthorizationContext,
    readCapability: PermissionKey,
  ) => Partial<T>;
}>;

export function riskEvaluationCreateRoutes(context: Context): readonly RouteDefinition[] {
  return [
    defineRoute({
      method: 'POST',
      match: (pathname) => (pathname === '/api/v1/risk-evaluations' ? { params: [] } : null),
      validate: (request): ValidatedEvaluation => {
        const body = context.parsers.objectBody(request.body);
        context.parsers.allow(body, [
          'salesOrderId',
          'policyVersionId',
          'assigneeEmployeeId',
          'validUntil',
          'dueAt',
        ]);
        const grant = context.authorizeQuery(
          context.authorization,
          'risk:evaluate',
          Object.keys(body),
        );
        const repository = context.repository();
        const evaluate = repository.evaluate;
        const input: Input = {
          salesOrderId: context.parsers.uuid(body.salesOrderId, 'salesOrderId'),
          policyVersionId: context.parsers.uuid(body.policyVersionId, 'policyVersionId'),
          assigneeEmployeeId: context.parsers.uuid(body.assigneeEmployeeId, 'assigneeEmployeeId'),
          validUntil: context.parsers.timestamp(body.validUntil, 'validUntil'),
          dueAt: context.parsers.timestamp(body.dueAt, 'dueAt'),
        };
        const key = context.idempotency(request);
        const scopeContext: ScopeContext = {
          actor: context.authorization.actor,
          scopes: grant.scopes,
          anchors: grant.anchors,
        };
        const correlationId = context.correlationId;
        return { repository, evaluate, input, key, scopeContext, correlationId };
      },
      handler: async (_request, _match, validated) => {
        const result: Awaited<ReturnType<Evaluate>> = await validated.evaluate.call(
          validated.repository,
          validated.input,
          validated.key,
          validated.scopeContext,
          validated.correlationId,
        );
        return {
          statusCode: 201,
          body: context.mutationDto(result, context.authorization, 'risk:read'),
        };
      },
    }),
  ];
}
