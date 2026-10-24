import { DomainError, type AuthorizationContext } from '@kingturf/domain';
import type { PermissionKey } from '@kingturf/types';
import type { ApiDependencies } from '../app.ts';
import type { authorizeQuery } from '../policy.ts';
import { defineRoute, type RouteDefinition } from './types.ts';

type Repository = Pick<NonNullable<ApiDependencies['manufacturing']>, 'createItem'>;
type CreateItem = Repository['createItem'];
type Input = Readonly<Parameters<CreateItem>[0]>;
type ScopeContext = Readonly<Parameters<CreateItem>[1]>;
type ValidatedItem = Readonly<{
  repository: Repository;
  createItem: CreateItem;
  input: Input;
  scopeContext: ScopeContext;
  correlationId: Parameters<CreateItem>[2];
}>;
type Context = Readonly<{
  repository: () => Repository;
  authorization: AuthorizationContext;
  authorizeQuery: typeof authorizeQuery;
  correlationId: Parameters<CreateItem>[2];
  parsers: Readonly<{
    objectBody: (value: unknown) => Record<string, unknown>;
    allow: (body: Record<string, unknown>, fields: readonly string[]) => void;
    string: (value: unknown, name: string) => string;
    stableCode: (value: string) => string;
    jsonObject: (value: unknown, name: string) => Input['specification'];
    timestamp: (value: unknown, name: string) => string;
  }>;
  mutationDto: <T extends Record<string, unknown>>(
    value: T,
    authorization: AuthorizationContext,
    readCapability: PermissionKey,
  ) => Partial<T>;
}>;

export function manufacturingItemCreateRoutes(context: Context): readonly RouteDefinition[] {
  return [
    defineRoute({
      method: 'POST',
      match: (pathname) => (pathname === '/api/v1/manufacturing-items' ? { params: [] } : null),
      validate: (request): ValidatedItem => {
        const body = context.parsers.objectBody(request.body);
        context.parsers.allow(body, [
          'sku',
          'name',
          'itemType',
          'baseUnitCode',
          'specification',
          'effectiveAt',
          'publish',
        ]);
        const grant = context.authorizeQuery(
          context.authorization,
          'manufacturing-item:manage',
          Object.keys(body),
        );
        const itemType = context.parsers.string(body.itemType, 'itemType');
        if (!['RAW_MATERIAL', 'SEMI_FINISHED', 'FINISHED_GOOD', 'PACKAGING'].includes(itemType))
          throw new DomainError('invalid_request', 'itemType is unsupported');
        const repository = context.repository();
        const createItem = repository.createItem;
        const input: Input = {
          sku: context.parsers.stableCode(context.parsers.string(body.sku, 'sku')),
          name: context.parsers.string(body.name, 'name'),
          itemType,
          baseUnitCode: context.parsers.stableCode(
            context.parsers.string(body.baseUnitCode, 'baseUnitCode'),
          ),
          specification: context.parsers.jsonObject(body.specification ?? {}, 'specification'),
          effectiveAt: context.parsers.timestamp(body.effectiveAt, 'effectiveAt'),
          publish: body.publish === true,
        };
        const scopeContext: ScopeContext = {
          actor: context.authorization.actor,
          scopes: grant.scopes,
          anchors: grant.anchors,
        };
        const correlationId = context.correlationId;
        return { repository, createItem, input, scopeContext, correlationId };
      },
      handler: async (_request, _match, validated) => {
        const result: Awaited<ReturnType<CreateItem>> = await validated.createItem.call(
          validated.repository,
          validated.input,
          validated.scopeContext,
          validated.correlationId,
        );
        return {
          statusCode: 201,
          body: context.mutationDto(result, context.authorization, 'manufacturing-item:read'),
        };
      },
    }),
  ];
}
