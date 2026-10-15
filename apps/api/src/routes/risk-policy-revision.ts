import { DomainError, type AuthorizationContext } from '@kingturf/domain';
import type { PermissionKey } from '@kingturf/types';
import type { ApiDependencies } from '../app.ts';
import type { authorizeQuery } from '../policy.ts';
import { defineRoute, type RouteDefinition } from './types.ts';

type Repository = Pick<NonNullable<ApiDependencies['risks']>, 'createPolicyVersion'>;
type CreateRevision = Repository['createPolicyVersion'];
type Input = Readonly<Parameters<CreateRevision>[1]>;
type ScopeContext = Readonly<Parameters<CreateRevision>[2]>;
type ValidatedRevision = Readonly<{
  repository: Repository;
  createPolicyVersion: CreateRevision;
  policyId: Parameters<CreateRevision>[0];
  input: Input;
  scopeContext: ScopeContext;
  correlationId: Parameters<CreateRevision>[3];
}>;
type Context = Readonly<{
  repository: () => Repository;
  authorization: AuthorizationContext;
  authorizeQuery: typeof authorizeQuery;
  correlationId: Parameters<CreateRevision>[3];
  parsers: Readonly<{
    objectBody: (value: unknown) => Record<string, unknown>;
    allow: (body: Record<string, unknown>, fields: readonly string[]) => void;
    integer: (value: unknown, name: string, min: number, max: number) => number;
    timestamp: (value: unknown, name: string) => string;
    array: (value: unknown, name: string) => readonly unknown[];
    jsonObject: (value: unknown, name: string) => Input['rules'][number];
  }>;
  mutationDto: <T extends Record<string, unknown>>(
    value: T,
    authorization: AuthorizationContext,
    readCapability: PermissionKey,
  ) => Partial<T>;
}>;

export function riskPolicyRevisionRoutes(context: Context): readonly RouteDefinition[] {
  return [
    defineRoute({
      method: 'POST',
      match: (pathname) => {
        const match = /^\/api\/v1\/risk-policies\/([0-9a-f-]+)\/versions$/u.exec(pathname);
        return match ? { params: match.slice(1) } : null;
      },
      validate: (request, match): ValidatedRevision => {
        const body = context.parsers.objectBody(request.body);
        context.parsers.allow(body, [
          'minimumMarginBasisPoints',
          'overdueGraceDays',
          'creditWarningDays',
          'effectiveAt',
          'rules',
        ]);
        const policyId = match.params[0];
        if (!policyId) throw new DomainError('invalid_request', 'riskPolicyId is required');
        const grant = context.authorizeQuery(
          context.authorization,
          'risk-policy:manage',
          Object.keys(body),
        );
        const repository = context.repository();
        const createPolicyVersion = repository.createPolicyVersion;
        const input: Input = {
          minimumMarginBasisPoints: context.parsers.integer(
            body.minimumMarginBasisPoints,
            'minimumMarginBasisPoints',
            -100000,
            10000,
          ),
          overdueGraceDays: context.parsers.integer(
            body.overdueGraceDays,
            'overdueGraceDays',
            0,
            3650,
          ),
          creditWarningDays: context.parsers.integer(
            body.creditWarningDays,
            'creditWarningDays',
            0,
            3650,
          ),
          effectiveAt: context.parsers.timestamp(body.effectiveAt, 'effectiveAt'),
          rules: context.parsers
            .array(body.rules, 'rules')
            .map((rule, index) => context.parsers.jsonObject(rule, `rules[${String(index)}]`)),
        };
        const scopeContext: ScopeContext = {
          actor: context.authorization.actor,
          scopes: grant.scopes,
          anchors: grant.anchors,
        };
        const correlationId = context.correlationId;
        return { repository, createPolicyVersion, policyId, input, scopeContext, correlationId };
      },
      handler: async (_request, _match, validated) => {
        const result: Awaited<ReturnType<CreateRevision>> =
          await validated.createPolicyVersion.call(
            validated.repository,
            validated.policyId,
            validated.input,
            validated.scopeContext,
            validated.correlationId,
          );
        return {
          statusCode: 201,
          body: context.mutationDto(result, context.authorization, 'risk-policy:read'),
        };
      },
    }),
  ];
}
