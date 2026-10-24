import { DomainError, type AuthorizationContext } from '@kingturf/domain';
import type { PermissionKey } from '@kingturf/types';
import type { ApiDependencies } from '../app.ts';
import type { authorizeQuery } from '../policy.ts';
import { defineRoute, type RouteDefinition } from './types.ts';

type Repository = Pick<NonNullable<ApiDependencies['manufacturing']>, 'createBom'>;
type CreateBom = Repository['createBom'];
type Input = Readonly<Parameters<CreateBom>[0]>;
type ScopeContext = Readonly<Parameters<CreateBom>[1]>;
type ValidatedBom = Readonly<{
  repository: Repository;
  createBom: CreateBom;
  input: Input;
  scopeContext: ScopeContext;
  correlationId: Parameters<CreateBom>[2];
}>;
type Context = Readonly<{
  repository: () => Repository;
  authorization: AuthorizationContext;
  authorizeQuery: typeof authorizeQuery;
  correlationId: Parameters<CreateBom>[2];
  parsers: Readonly<{
    objectBody: (value: unknown) => Record<string, unknown>;
    allow: (body: Record<string, unknown>, fields: readonly string[]) => void;
    string: (value: unknown, name: string) => string;
    stableCode: (value: string) => string;
    jsonObject: (value: unknown, name: string) => Record<string, unknown>;
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

export function manufacturingBomCreateRoutes(context: Context): readonly RouteDefinition[] {
  return [
    defineRoute({
      method: 'POST',
      match: (pathname) => (pathname === '/api/v1/manufacturing-boms' ? { params: [] } : null),
      validate: (request): ValidatedBom => {
        const body = context.parsers.objectBody(request.body);
        context.parsers.allow(body, [
          'code',
          'name',
          'productItemId',
          'productItemVersionId',
          'outputQuantity',
          'effectiveAt',
          'lines',
          'publish',
        ]);
        const grant = context.authorizeQuery(
          context.authorization,
          'bom:manage',
          Object.keys(body),
        );
        const lines = context.parsers.array(body.lines, 'lines').map((value, index) => {
          const line = context.parsers.jsonObject(value, `lines[${String(index)}]`);
          context.parsers.allow(line, [
            'componentItemVersionId',
            'quantity',
            'scrapBasisPoints',
            'substitutes',
          ]);
          return {
            componentItemVersionId: context.parsers.uuid(
              line.componentItemVersionId,
              `lines[${String(index)}].componentItemVersionId`,
            ),
            quantity: context.parsers.decimal(line.quantity, `lines[${String(index)}].quantity`),
            scrapBasisPoints: context.parsers.integer(
              Object.hasOwn(line, 'scrapBasisPoints') ? line.scrapBasisPoints : 0,
              `lines[${String(index)}].scrapBasisPoints`,
              0,
              10000,
            ),
            substitutes: context.parsers
              .array(
                Object.hasOwn(line, 'substitutes') ? line.substitutes : [],
                `lines[${String(index)}].substitutes`,
              )
              .map((entry, substituteIndex) => {
                const substitute = context.parsers.jsonObject(
                  entry,
                  `lines[${String(index)}].substitutes[${String(substituteIndex)}]`,
                );
                context.parsers.allow(substitute, [
                  'itemVersionId',
                  'priority',
                  'conversionFactor',
                ]);
                return {
                  itemVersionId: context.parsers.uuid(substitute.itemVersionId, 'itemVersionId'),
                  priority: context.parsers.integer(substitute.priority, 'priority', 1, 1000),
                  conversionFactor: context.parsers.decimal(
                    substitute.conversionFactor,
                    'conversionFactor',
                  ),
                };
              }),
          };
        });
        if (!lines.length) throw new DomainError('invalid_request', 'lines must not be empty');
        const repository = context.repository();
        const createBom = repository.createBom;
        const input: Input = {
          code: context.parsers.stableCode(context.parsers.string(body.code, 'code')),
          name: context.parsers.string(body.name, 'name'),
          productItemId: context.parsers.uuid(body.productItemId, 'productItemId'),
          productItemVersionId: context.parsers.uuid(
            body.productItemVersionId,
            'productItemVersionId',
          ),
          outputQuantity: context.parsers.decimal(body.outputQuantity, 'outputQuantity'),
          effectiveAt: context.parsers.timestamp(body.effectiveAt, 'effectiveAt'),
          lines,
          publish: body.publish === true,
        };
        const scopeContext: ScopeContext = {
          actor: context.authorization.actor,
          scopes: grant.scopes,
          anchors: grant.anchors,
        };
        const correlationId = context.correlationId;
        return { repository, createBom, input, scopeContext, correlationId };
      },
      handler: async (_request, _match, validated) => {
        const result: Awaited<ReturnType<CreateBom>> = await validated.createBom.call(
          validated.repository,
          validated.input,
          validated.scopeContext,
          validated.correlationId,
        );
        return {
          statusCode: 201,
          body: context.mutationDto(result, context.authorization, 'bom:read'),
        };
      },
    }),
  ];
}
