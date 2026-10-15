import { DomainError, type AuthorizationContext } from '@kingturf/domain';
import type { PermissionKey } from '@kingturf/types';
import type { ApiDependencies } from '../app.ts';
import type { authorizeQuery } from '../policy.ts';
import { defineRoute, type RouteDefinition } from './types.ts';

type Repository = Pick<NonNullable<ApiDependencies['mrp']>, 'createPolicy'>;
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
    uuid: (value: unknown, name: string) => string;
    decimal: (value: unknown, name: string) => string;
    integer: (value: unknown, name: string, minimum: number, maximum: number) => number;
    timestamp: (value: unknown, name: string) => string;
  }>;
  mutationDto: <T extends Record<string, unknown>>(
    value: T,
    authorization: AuthorizationContext,
    readCapability: PermissionKey,
  ) => Partial<T>;
}>;

export function mrpPolicyCreateRoutes(context: Context): readonly RouteDefinition[] {
  return [
    defineRoute({
      method: 'POST',
      match: (pathname) => (pathname === '/api/v1/mrp-policies' ? { params: [] } : null),
      validate: (request): ValidatedPolicy => {
        const body = context.parsers.objectBody(request.body);
        context.parsers.allow(body, [
          'itemVersionId',
          'safetyStock',
          'minimumOrderQuantity',
          'orderMultiple',
          'leadTimeDays',
          'freezeWindowDays',
          'makeOrBuy',
          'effectiveAt',
        ]);
        const grant = context.authorizeQuery(
          context.authorization,
          'mrp-policy:manage',
          Object.keys(body),
        );
        const makeOrBuy = context.parsers.string(body.makeOrBuy, 'makeOrBuy');
        if (!['MAKE', 'BUY'].includes(makeOrBuy))
          throw new DomainError('invalid_request', 'makeOrBuy is unsupported');
        const repository = context.repository();
        const createPolicy = repository.createPolicy;
        const input: Input = {
          itemVersionId: context.parsers.uuid(body.itemVersionId, 'itemVersionId'),
          safetyStock: context.parsers.decimal(body.safetyStock, 'safetyStock'),
          minimumOrderQuantity: context.parsers.decimal(
            body.minimumOrderQuantity,
            'minimumOrderQuantity',
          ),
          orderMultiple: context.parsers.decimal(body.orderMultiple, 'orderMultiple'),
          leadTimeDays: context.parsers.integer(body.leadTimeDays, 'leadTimeDays', 0, 3650),
          freezeWindowDays: context.parsers.integer(
            body.freezeWindowDays,
            'freezeWindowDays',
            0,
            3650,
          ),
          makeOrBuy: makeOrBuy as 'MAKE' | 'BUY',
          effectiveAt: context.parsers.timestamp(body.effectiveAt, 'effectiveAt'),
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
          body: context.mutationDto(result, context.authorization, 'mrp-policy:read'),
        };
      },
    }),
  ];
}
