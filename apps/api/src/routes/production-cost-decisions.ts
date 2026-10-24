import type { AuthorizationContext } from '@kingturf/domain';
import type { PermissionKey } from '@kingturf/types';
import type { ApiDependencies } from '../app.ts';
import type { authorizeQuery } from '../policy.ts';
import { defineRoute, type RouteDefinition } from './types.ts';

type Costs = NonNullable<ApiDependencies['productionCosts']>;
type Decide = Costs['decide'];
type DecisionInput = Readonly<Parameters<Decide>[2]>;
type ScopeContext = Readonly<Parameters<Decide>[3]>;
type ValidatedDecision = Readonly<{
  decide: Decide;
  id: Parameters<Decide>[0];
  state: Parameters<Decide>[1];
  input: DecisionInput;
  scopeContext: ScopeContext;
}>;
type Context = Readonly<{
  repository: Pick<Costs, 'decide'>;
  authorization: AuthorizationContext;
  authorizeQuery: typeof authorizeQuery;
  correlationId: Parameters<Decide>[4];
  parsers: Readonly<{
    objectBody: (body: unknown) => Record<string, unknown>;
    allow: (body: Record<string, unknown>, fields: readonly string[]) => void;
    uuid: (value: unknown, name: string) => string;
    string: (value: unknown, name: string) => string;
    jsonObject: (value: unknown, name: string) => DecisionInput['evidence'];
    stableCode: (value: string) => string;
  }>;
  mutationDto: <T extends Record<string, unknown>>(
    value: T,
    authorization: AuthorizationContext,
    readCapability: PermissionKey,
  ) => Partial<T>;
}>;
type Decision = Readonly<{
  action: 'approve' | 'reject';
  state: Parameters<Decide>[1];
}>;
const decisions = [
  { action: 'approve', state: 'APPROVED' },
  { action: 'reject', state: 'REJECTED' },
] as const satisfies readonly Decision[];

export function productionCostDecisionRoutes(context: Context): readonly RouteDefinition[] {
  return decisions.map((decision) =>
    defineRoute({
      method: 'POST',
      match: (pathname) => {
        const match = /^\/api\/v1\/production-cost-runs\/([0-9a-f-]+)\/(approve|reject)$/u.exec(
          pathname,
        );
        return match?.[2] === decision.action ? { params: match.slice(1) } : null;
      },
      validate: (request, match): ValidatedDecision => {
        const body = context.parsers.objectBody(request.body);
        context.parsers.allow(body, ['reason', 'evidence', 'idempotencyKey']);
        const grant = context.authorizeQuery(
          context.authorization,
          'manufacturing-cost:approve',
          Object.keys(body),
        );
        const decide = context.repository.decide;
        const id = context.parsers.uuid(match.params[0], 'costRunId');
        const state = decision.state;
        const input: DecisionInput = {
          reason: context.parsers.string(body.reason, 'reason'),
          evidence: context.parsers.jsonObject(body.evidence ?? {}, 'evidence'),
          idempotencyKey: context.parsers.stableCode(
            context.parsers.string(body.idempotencyKey, 'idempotencyKey'),
          ),
        };
        const scopeContext: ScopeContext = {
          actor: context.authorization.actor,
          scopes: grant.scopes,
          anchors: grant.anchors,
        };
        return { decide, id, state, input, scopeContext };
      },
      handler: async (_request, _match, validated) => {
        const result = await validated.decide.call(
          context.repository,
          validated.id,
          validated.state,
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
  );
}
