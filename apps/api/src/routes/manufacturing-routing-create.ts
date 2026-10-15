import { DomainError, type AuthorizationContext } from '@kingturf/domain';
import type { PermissionKey } from '@kingturf/types';
import type { ApiDependencies } from '../app.ts';
import type { authorizeQuery } from '../policy.ts';
import { defineRoute, type RouteDefinition } from './types.ts';

type Repository = Pick<NonNullable<ApiDependencies['manufacturing']>, 'createRouting'>;
type CreateRouting = Repository['createRouting'];
type Input = Readonly<Parameters<CreateRouting>[0]>;
type ScopeContext = Readonly<Parameters<CreateRouting>[1]>;
type ValidatedRouting = Readonly<{
  repository: Repository;
  createRouting: CreateRouting;
  input: Input;
  scopeContext: ScopeContext;
  correlationId: Parameters<CreateRouting>[2];
}>;
type Context = Readonly<{
  repository: () => Repository;
  authorization: AuthorizationContext;
  authorizeQuery: typeof authorizeQuery;
  correlationId: Parameters<CreateRouting>[2];
  parsers: Readonly<{
    objectBody: (value: unknown) => Record<string, unknown>;
    allow: (body: Record<string, unknown>, fields: readonly string[]) => void;
    string: (value: unknown, name: string) => string;
    stableCode: (value: string) => string;
    jsonObject: (value: unknown, name: string) => Record<string, never>;
    array: (value: unknown, name: string) => readonly unknown[];
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

export function manufacturingRoutingCreateRoutes(context: Context): readonly RouteDefinition[] {
  return [
    defineRoute({
      method: 'POST',
      match: (pathname) => (pathname === '/api/v1/manufacturing-routings' ? { params: [] } : null),
      validate: (request): ValidatedRouting => {
        const body = context.parsers.objectBody(request.body);
        context.parsers.allow(body, [
          'code',
          'name',
          'productItemId',
          'productItemVersionId',
          'effectiveAt',
          'operations',
          'publish',
        ]);
        const grant = context.authorizeQuery(
          context.authorization,
          'routing:manage',
          Object.keys(body),
        );
        const operations = context.parsers
          .array(body.operations, 'operations')
          .map((value, index) => {
            const operation = context.parsers.jsonObject(value, `operations[${String(index)}]`);
            context.parsers.allow(operation, [
              'operationCode',
              'name',
              'workCenterCode',
              'sequence',
              'setupMinutes',
              'runMinutesPerUnit',
              'instructions',
            ]);
            return {
              operationCode: context.parsers.stableCode(
                context.parsers.string(operation.operationCode, 'operationCode'),
              ),
              name: context.parsers.string(operation.name, 'name'),
              workCenterCode: context.parsers.stableCode(
                context.parsers.string(operation.workCenterCode, 'workCenterCode'),
              ),
              sequence: context.parsers.integer(operation.sequence, 'sequence', 1, 100000),
              setupMinutes: context.parsers.decimal(operation.setupMinutes, 'setupMinutes'),
              runMinutesPerUnit: context.parsers.decimal(
                operation.runMinutesPerUnit,
                'runMinutesPerUnit',
              ),
              instructions: context.parsers.jsonObject(
                Object.hasOwn(operation, 'instructions') ? operation.instructions : {},
                'instructions',
              ),
            };
          });
        if (!operations.length)
          throw new DomainError('invalid_request', 'operations must not be empty');
        const repository = context.repository();
        const createRouting = repository.createRouting;
        const input: Input = {
          code: context.parsers.stableCode(context.parsers.string(body.code, 'code')),
          name: context.parsers.string(body.name, 'name'),
          productItemId: context.parsers.uuid(body.productItemId, 'productItemId'),
          productItemVersionId: context.parsers.uuid(
            body.productItemVersionId,
            'productItemVersionId',
          ),
          effectiveAt: context.parsers.timestamp(body.effectiveAt, 'effectiveAt'),
          operations,
          publish: body.publish === true,
        };
        const scopeContext: ScopeContext = {
          actor: context.authorization.actor,
          scopes: grant.scopes,
          anchors: grant.anchors,
        };
        const correlationId = context.correlationId;
        return { repository, createRouting, input, scopeContext, correlationId };
      },
      handler: async (_request, _match, validated) => {
        const result: Awaited<ReturnType<CreateRouting>> = await validated.createRouting.call(
          validated.repository,
          validated.input,
          validated.scopeContext,
          validated.correlationId,
        );
        return {
          statusCode: 201,
          body: context.mutationDto(result, context.authorization, 'routing:read'),
        };
      },
    }),
  ];
}
