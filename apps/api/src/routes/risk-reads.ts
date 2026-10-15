import type { AuthorizationContext } from '@kingturf/domain';
import type { PermissionKey } from '@kingturf/types';
import type { ApiDependencies } from '../app.ts';
import type { authorizeQuery } from '../policy.ts';
import { defineRoute, type RouteDefinition } from './types.ts';

type PolicyRepository = Pick<NonNullable<ApiDependencies['risks']>, 'listPolicies'>;
type ListPolicies = PolicyRepository['listPolicies'];
type PolicyScope = Readonly<Parameters<ListPolicies>[0]>;
type PolicyItems = Awaited<ReturnType<ListPolicies>>;
type ValidatedPolicyRead = Readonly<{
  repository: PolicyRepository;
  listPolicies: ListPolicies;
  scopeContext: PolicyScope;
}>;
type EvaluationRepository = Pick<NonNullable<ApiDependencies['risks']>, 'listEvaluations'>;
type ListEvaluations = EvaluationRepository['listEvaluations'];
type EvaluationScope = Readonly<Parameters<ListEvaluations>[0]>;
type EvaluationItems = Awaited<ReturnType<ListEvaluations>>;
type ValidatedEvaluationRead = Readonly<{
  repository: EvaluationRepository;
  listEvaluations: ListEvaluations;
  scopeContext: EvaluationScope;
}>;
type ReadContext = Readonly<{
  authorization: AuthorizationContext;
  authorizeQuery: typeof authorizeQuery;
  permittedDto: <T extends Record<string, unknown>>(
    value: T,
    fields: readonly string[] | null,
  ) => Partial<T>;
}>;
type PolicyContext = ReadContext & Readonly<{ repository: () => PolicyRepository }>;
type EvaluationContext = ReadContext & Readonly<{ repository: () => EvaluationRepository }>;
const POLICY_READ = 'risk-policy:read' satisfies PermissionKey;
const EVALUATION_READ = 'risk:read' satisfies PermissionKey;

export function riskPolicyReadRoutes(context: PolicyContext): readonly RouteDefinition[] {
  return [
    defineRoute({
      method: 'GET',
      match: (pathname) => (pathname === '/api/v1/risk-policies' ? { params: [] } : null),
      validate: (): ValidatedPolicyRead => {
        const grant = context.authorizeQuery(context.authorization, POLICY_READ);
        const repository = context.repository();
        const listPolicies = repository.listPolicies;
        const scopeContext: PolicyScope = {
          actor: context.authorization.actor,
          scopes: grant.scopes,
          anchors: grant.anchors,
        };
        return { repository, listPolicies, scopeContext };
      },
      handler: async (_request, _match, validated) => {
        const items: PolicyItems = await validated.listPolicies.call(
          validated.repository,
          validated.scopeContext,
        );
        return {
          statusCode: 200,
          body: {
            items: items.map((item) =>
              context.permittedDto(
                item,
                context.authorization.permissions.get(POLICY_READ)?.fields ?? null,
              ),
            ),
          },
        };
      },
    }),
  ];
}

export function riskEvaluationReadRoutes(context: EvaluationContext): readonly RouteDefinition[] {
  return [
    defineRoute({
      method: 'GET',
      match: (pathname) => (pathname === '/api/v1/risk-evaluations' ? { params: [] } : null),
      validate: (): ValidatedEvaluationRead => {
        const grant = context.authorizeQuery(context.authorization, EVALUATION_READ);
        const repository = context.repository();
        const listEvaluations = repository.listEvaluations;
        const scopeContext: EvaluationScope = {
          actor: context.authorization.actor,
          scopes: grant.scopes,
          anchors: grant.anchors,
        };
        return { repository, listEvaluations, scopeContext };
      },
      handler: async (_request, _match, validated) => {
        const items: EvaluationItems = await validated.listEvaluations.call(
          validated.repository,
          validated.scopeContext,
        );
        return {
          statusCode: 200,
          body: {
            items: items.map((item) =>
              context.permittedDto(
                item,
                context.authorization.permissions.get(EVALUATION_READ)?.fields ?? null,
              ),
            ),
          },
        };
      },
    }),
  ];
}
