import type { AuthorizationContext } from '@kingturf/domain';
import type { PermissionKey } from '@kingturf/types';
import type { ApiDependencies } from '../app.ts';
import type { authorizeQuery } from '../policy.ts';
import { defineRoute, type RouteDefinition } from './types.ts';

type Repository = Pick<
  NonNullable<ApiDependencies['commissions']>,
  'createPolicy' | 'createPolicyVersion'
>;
type Create = Repository['createPolicy'];
type Version = Repository['createPolicyVersion'];
type CreateInput = Readonly<Parameters<Create>[0]>;
type VersionInput = Readonly<Parameters<Version>[1]>;
type ScopeContext = Readonly<Parameters<Create>[1]>;
type ValidatedCreate = Readonly<{
  repository: Repository;
  createPolicy: Create;
  input: CreateInput;
  scopeContext: ScopeContext;
  correlationId: Parameters<Create>[2];
}>;
type ValidatedVersion = Readonly<{
  repository: Repository;
  createPolicyVersion: Version;
  id: Parameters<Version>[0];
  input: VersionInput;
  scopeContext: ScopeContext;
  correlationId: Parameters<Version>[3];
}>;
type Context = Readonly<{
  repository: () => Repository;
  authorization: AuthorizationContext;
  authorizeQuery: typeof authorizeQuery;
  correlationId: Parameters<Create>[2];
  parsers: Readonly<{
    objectBody: (value: unknown) => Record<string, unknown>;
    allow: (body: Record<string, unknown>, fields: readonly string[]) => void;
    string: (value: unknown, name: string) => string;
    uuid: (value: unknown, name: string) => string;
    integer: (value: unknown, name: string, minimum: number, maximum: number) => number;
    timestamp: (value: unknown, name: string) => string;
    jsonObject: (value: unknown, name: string) => Record<string, never>;
    array: (value: unknown, name: string) => readonly unknown[];
  }>;
  mutationDto: <T extends Record<string, unknown>>(
    value: T,
    authorization: AuthorizationContext,
    readCapability: PermissionKey,
  ) => Partial<T>;
}>;

export function commissionPolicyCreateRoutes(context: Context): readonly RouteDefinition[] {
  return [
    defineRoute({
      method: 'POST',
      match: (pathname) => (pathname === '/api/v1/commission-policies' ? { params: [] } : null),
      validate: (request): ValidatedCreate => {
        const body = context.parsers.objectBody(request.body);
        context.parsers.allow(body, [
          'code',
          'name',
          'applicability',
          'baseRateBasisPoints',
          'minimumMarginBasisPoints',
          'releaseCollectionBasisPoints',
          'effectiveAt',
          'rules',
          'publish',
        ]);
        const grant = context.authorizeQuery(
          context.authorization,
          'commission-policy:manage',
          Object.keys(body),
        );
        const rules = context.parsers
          .array(body.rules, 'rules')
          .map((rule, index) => context.parsers.jsonObject(rule, `rules[${String(index)}]`));
        const repository = context.repository();
        const createPolicy = repository.createPolicy;
        const input: CreateInput = {
          code: context.parsers.string(body.code, 'code'),
          name: context.parsers.string(body.name, 'name'),
          applicability: context.parsers.jsonObject(body.applicability, 'applicability'),
          baseRateBasisPoints: context.parsers.integer(
            body.baseRateBasisPoints,
            'baseRateBasisPoints',
            0,
            10000,
          ),
          minimumMarginBasisPoints: context.parsers.integer(
            body.minimumMarginBasisPoints,
            'minimumMarginBasisPoints',
            -100000,
            10000,
          ),
          releaseCollectionBasisPoints: context.parsers.integer(
            body.releaseCollectionBasisPoints,
            'releaseCollectionBasisPoints',
            0,
            10000,
          ),
          effectiveAt: context.parsers.timestamp(body.effectiveAt, 'effectiveAt'),
          rules,
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
        const result: Awaited<ReturnType<Create>> = await validated.createPolicy.call(
          validated.repository,
          validated.input,
          validated.scopeContext,
          validated.correlationId,
        );
        return {
          statusCode: 201,
          body: context.mutationDto(result, context.authorization, 'commission-policy:read'),
        };
      },
    }),
  ];
}

export function commissionPolicyVersionRoutes(context: Context): readonly RouteDefinition[] {
  return [
    defineRoute({
      method: 'POST',
      match: (pathname) => {
        const match = /^\/api\/v1\/commission-policies\/([0-9a-f-]+)\/versions$/u.exec(pathname);
        return match ? { params: match.slice(1) } : null;
      },
      validate: (request, match): ValidatedVersion => {
        const body = context.parsers.objectBody(request.body);
        context.parsers.allow(body, [
          'baseRateBasisPoints',
          'minimumMarginBasisPoints',
          'releaseCollectionBasisPoints',
          'effectiveAt',
          'rules',
        ]);
        const grant = context.authorizeQuery(
          context.authorization,
          'commission-policy:manage',
          Object.keys(body),
        );
        const repository = context.repository();
        const createPolicyVersion = repository.createPolicyVersion;
        const id = context.parsers.uuid(match.params[0], 'commissionPolicyId');
        const input: VersionInput = {
          baseRateBasisPoints: context.parsers.integer(
            body.baseRateBasisPoints,
            'baseRateBasisPoints',
            0,
            10000,
          ),
          minimumMarginBasisPoints: context.parsers.integer(
            body.minimumMarginBasisPoints,
            'minimumMarginBasisPoints',
            -100000,
            10000,
          ),
          releaseCollectionBasisPoints: context.parsers.integer(
            body.releaseCollectionBasisPoints,
            'releaseCollectionBasisPoints',
            0,
            10000,
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
        return { repository, createPolicyVersion, id, input, scopeContext, correlationId };
      },
      handler: async (_request, _match, validated) => {
        const result: Awaited<ReturnType<Version>> = await validated.createPolicyVersion.call(
          validated.repository,
          validated.id,
          validated.input,
          validated.scopeContext,
          validated.correlationId,
        );
        return {
          statusCode: 201,
          body: context.mutationDto(result, context.authorization, 'commission-policy:read'),
        };
      },
    }),
  ];
}
