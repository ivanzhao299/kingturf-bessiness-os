import type { AuthorizationContext } from '@kingturf/domain';
import type { PermissionKey } from '@kingturf/types';
import type { ApiDependencies } from '../app.ts';
import type { authorizeQuery } from '../policy.ts';
import { defineRoute, type RouteDefinition } from './types.ts';

type Production = NonNullable<ApiDependencies['production']>;
type ReportOperation = Production['reportOperation'];
type ReportInput = Readonly<Parameters<ReportOperation>[1]>;
type ScopeContext = Readonly<Parameters<ReportOperation>[2]>;
type ValidatedReport = Readonly<{
  reportOperation: ReportOperation;
  id: Parameters<ReportOperation>[0];
  input: ReportInput;
  scopeContext: ScopeContext;
}>;
type Context = Readonly<{
  repository: Pick<Production, 'reportOperation'>;
  authorization: AuthorizationContext;
  authorizeQuery: typeof authorizeQuery;
  correlationId: Parameters<ReportOperation>[3];
  parsers: Readonly<{
    objectBody: (body: unknown) => Record<string, unknown>;
    allow: (body: Record<string, unknown>, fields: readonly string[]) => void;
    string: (value: unknown, name: string) => string;
    uuid: (value: unknown, name: string) => string;
    decimal: (value: unknown, name: string) => string;
    timestamp: (value: unknown, name: string) => string;
    stableCode: (value: string) => string;
  }>;
  mutationDto: <T extends Record<string, unknown>>(
    value: T,
    authorization: AuthorizationContext,
    readCapability: PermissionKey,
  ) => Partial<T>;
}>;

export function productionReportRoutes(context: Context): readonly RouteDefinition[] {
  return [
    defineRoute({
      method: 'POST',
      match: (pathname) => {
        const match = /^\/api\/v1\/production-orders\/([0-9a-f-]+)\/operation-reports$/u.exec(
          pathname,
        );
        return match ? { params: match.slice(1) } : null;
      },
      validate: (request, match): ValidatedReport => {
        const body = context.parsers.objectBody(request.body);
        context.parsers.allow(body, [
          'operationId',
          'goodQuantity',
          'scrapQuantity',
          'laborMinutes',
          'machineMinutes',
          'startedAt',
          'completedAt',
          'notes',
          'idempotencyKey',
        ]);
        const grant = context.authorizeQuery(
          context.authorization,
          'production:report',
          Object.keys(body),
        );
        const reportOperation = context.repository.reportOperation;
        const id = context.parsers.uuid(match.params[0], 'productionOrderId');
        const input: ReportInput = {
          operationId: context.parsers.uuid(body.operationId, 'operationId'),
          goodQuantity: context.parsers.decimal(body.goodQuantity, 'goodQuantity'),
          scrapQuantity: context.parsers.decimal(body.scrapQuantity, 'scrapQuantity'),
          laborMinutes: context.parsers.decimal(body.laborMinutes, 'laborMinutes'),
          machineMinutes: context.parsers.decimal(body.machineMinutes, 'machineMinutes'),
          startedAt: context.parsers.timestamp(body.startedAt, 'startedAt'),
          completedAt: context.parsers.timestamp(body.completedAt, 'completedAt'),
          notes: context.parsers.string(body.notes ?? '', 'notes'),
          idempotencyKey: context.parsers.stableCode(
            context.parsers.string(body.idempotencyKey, 'idempotencyKey'),
          ),
        };
        const scopeContext: ScopeContext = {
          actor: context.authorization.actor,
          scopes: grant.scopes,
          anchors: grant.anchors,
        };
        return { reportOperation, id, input, scopeContext };
      },
      handler: async (_request, _match, validated) => {
        const result = await validated.reportOperation.call(
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
