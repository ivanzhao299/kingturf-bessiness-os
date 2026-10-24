import type { AuthorizationContext } from '@kingturf/domain';
import type { PermissionKey } from '@kingturf/types';
import type { ApiDependencies } from '../app.ts';
import type { authorizeQuery } from '../policy.ts';
import { defineRoute, type RouteDefinition } from './types.ts';

type Production = NonNullable<ApiDependencies['production']>;
type CreateOutput = Production['createOutput'];
type OutputInput = Readonly<Parameters<CreateOutput>[1]>;
type ScopeContext = Readonly<Parameters<CreateOutput>[2]>;
type ValidatedOutput = Readonly<{
  createOutput: CreateOutput;
  id: Parameters<CreateOutput>[0];
  input: OutputInput;
  scopeContext: ScopeContext;
}>;
type Context = Readonly<{
  repository: Pick<Production, 'createOutput'>;
  authorization: AuthorizationContext;
  authorizeQuery: typeof authorizeQuery;
  correlationId: Parameters<CreateOutput>[3];
  parsers: Readonly<{
    objectBody: (body: unknown) => Record<string, unknown>;
    allow: (body: Record<string, unknown>, fields: readonly string[]) => void;
    uuid: (value: unknown, name: string) => string;
    string: (value: unknown, name: string) => string;
    stableCode: (value: string) => string;
    decimal: (value: unknown, name: string) => string;
    calendarDate: (value: unknown, name: string) => string;
  }>;
  mutationDto: <T extends Record<string, unknown>>(
    value: T,
    authorization: AuthorizationContext,
    readCapability: PermissionKey,
  ) => Partial<T>;
}>;

export function productionOutputRoutes(context: Context): readonly RouteDefinition[] {
  return [
    defineRoute({
      method: 'POST',
      match: (pathname) => {
        const match = /^\/api\/v1\/production-orders\/([0-9a-f-]+)\/finished-rolls$/u.exec(
          pathname,
        );
        return match ? { params: match.slice(1) } : null;
      },
      validate: (request, match): ValidatedOutput => {
        const body = context.parsers.objectBody(request.body);
        context.parsers.allow(body, [
          'operationReportId',
          'itemVersionId',
          'rollNumber',
          'lotNumber',
          'locationId',
          'quantity',
          'manufacturedAt',
        ]);
        const grant = context.authorizeQuery(
          context.authorization,
          'production:report',
          Object.keys(body),
        );
        const createOutput = context.repository.createOutput;
        const id = context.parsers.uuid(match.params[0], 'productionOrderId');
        const input: OutputInput = {
          operationReportId: context.parsers.uuid(body.operationReportId, 'operationReportId'),
          itemVersionId: context.parsers.uuid(body.itemVersionId, 'itemVersionId'),
          rollNumber: context.parsers.stableCode(
            context.parsers.string(body.rollNumber, 'rollNumber'),
          ),
          lotNumber: context.parsers.stableCode(
            context.parsers.string(body.lotNumber, 'lotNumber'),
          ),
          locationId: context.parsers.uuid(body.locationId, 'locationId'),
          quantity: context.parsers.decimal(body.quantity, 'quantity'),
          manufacturedAt: context.parsers.calendarDate(body.manufacturedAt, 'manufacturedAt'),
        };
        const scopeContext: ScopeContext = {
          actor: context.authorization.actor,
          scopes: grant.scopes,
          anchors: grant.anchors,
        };
        return { createOutput, id, input, scopeContext };
      },
      handler: async (_request, _match, validated) => {
        const result = await validated.createOutput.call(
          context.repository,
          validated.id,
          validated.input,
          validated.scopeContext,
          context.correlationId,
        );
        return {
          statusCode: 201,
          body: context.mutationDto(result, context.authorization, 'production:read'),
        };
      },
    }),
  ];
}
