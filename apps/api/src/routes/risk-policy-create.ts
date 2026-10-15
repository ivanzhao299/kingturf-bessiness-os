import type { AuthorizationContext } from '@kingturf/domain';
import type { PermissionKey } from '@kingturf/types';
import type { ApiDependencies } from '../app.ts';
import type { authorizeQuery } from '../policy.ts';
import { defineRoute, type RouteDefinition } from './types.ts';

type Repository = Pick<NonNullable<ApiDependencies['risks']>, 'createPolicy'>;
type CreatePolicy = Repository['createPolicy'];
type Input = Readonly<Parameters<CreatePolicy>[0]>;
type ScopeContext = Readonly<Parameters<CreatePolicy>[1]>;
type ValidatedPolicy = Readonly<{
  repository: Repository;
  createPolicy: CreatePolicy;
  input: Input;
  scopeContext: ScopeContext;
  correlationId: Parameters<CreatePolicy>[2];
}>;
type Context = Readonly<{
  repository: () => Repository;
  authorization: AuthorizationContext;
  authorizeQuery: typeof authorizeQuery;
  correlationId: Parameters<CreatePolicy>[2];
  parsers: Readonly<{
    objectBody: (value: unknown) => Record<string, unknown>;
    allow: (body: Record<string, unknown>, fields: readonly string[]) => void;
    string: (value: unknown, name: string) => string;
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

export function riskPolicyCreateRoutes(context: Context): readonly RouteDefinition[] {
  return [
    defineRoute({
      method: 'POST',
      match: (pathname) => (pathname === '/api/v1/risk-policies' ? { params: [] } : null),
      validate: (request): ValidatedPolicy => {
        const body = context.parsers.objectBody(request.body);
        context.parsers.allow(body, [
          'code',
          'name',
          'minimumMarginBasisPoints',
          'overdueGraceDays',
          'creditWarningDays',
          'effectiveAt',
          'rules',
          'publish',
        ]);
        const grant = context.authorizeQuery(
          context.authorization,
          'risk-policy:manage',
          Object.keys(body),
        );
        const repository = context.repository();
        const createPolicy = repository.createPolicy;
        const input: Input = {
          code: context.parsers.string(body.code, 'code'),
          name: context.parsers.string(body.name, 'name'),
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
          publish: body.publish === true,
        };
        const scopeContext: ScopeContext = {
          actor: context.authorization.actor,
          scopes: grant.scopes,
          anchors: grant.anchors,
        };
        const correlationId = context.correlationId;
        return { repository, createPolicy, input, scopeContext, correlationId };
      },
      handler: async (_request, _match, validated) => {
        const result: Awaited<ReturnType<CreatePolicy>> = await validated.createPolicy.call(
          validated.repository,
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
