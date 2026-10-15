import { DomainError, type AuthorizationContext } from '@kingturf/domain';
import type { PermissionKey } from '@kingturf/types';
import type { ApiDependencies } from '../app.ts';
import type { authorizeQuery } from '../policy.ts';
import { defineRoute, type RouteDefinition } from './types.ts';

type Repository = Pick<NonNullable<ApiDependencies['quality']>, 'recordResult'>;
type RecordResult = Repository['recordResult'];
type InspectionId = Parameters<RecordResult>[0];
type Input = Readonly<Parameters<RecordResult>[1]>;
type ScopeContext = Readonly<Parameters<RecordResult>[2]>;
type CorrelationId = Parameters<RecordResult>[3];
type ValidatedResult = Readonly<{
  repository: Repository;
  recordResult: RecordResult;
  inspectionId: InspectionId;
  input: Input;
  scopeContext: ScopeContext;
  correlationId: CorrelationId;
}>;
type Context = Readonly<{
  repository: () => Repository;
  authorization: AuthorizationContext;
  authorizeQuery: typeof authorizeQuery;
  correlationId: CorrelationId;
  parsers: Readonly<{
    objectBody: (value: unknown) => Record<string, unknown>;
    allow: (body: Record<string, unknown>, fields: readonly string[]) => void;
    uuid: (value: unknown, name: string) => string;
    string: (value: unknown, name: string) => string;
    decimal: (value: unknown, name: string, nonnegative?: boolean) => string;
    timestamp: (value: unknown, name: string) => string;
    stableCode: (value: string) => string;
  }>;
  mutationDto: <T extends Record<string, unknown>>(
    value: T,
    authorization: AuthorizationContext,
    readCapability: PermissionKey,
  ) => Partial<T>;
}>;

export function qualityResultRecordRoutes(context: Context): readonly RouteDefinition[] {
  return [
    defineRoute({
      method: 'POST',
      match: (pathname) => {
        const match = /^\/api\/v1\/quality-inspections\/([0-9a-f-]+)\/results$/u.exec(pathname);
        return match ? { params: match.slice(1) } : null;
      },
      validate: (request, match): ValidatedResult => {
        const body = context.parsers.objectBody(request.body);
        context.parsers.allow(body, [
          'characteristicId',
          'measuredNumeric',
          'measuredBoolean',
          'measuredText',
          'passed',
          'notes',
          'occurredAt',
          'idempotencyKey',
        ]);
        if (typeof body.passed !== 'boolean')
          throw new DomainError('invalid_request', 'passed must be boolean');
        if (body.measuredBoolean !== undefined && typeof body.measuredBoolean !== 'boolean')
          throw new DomainError('invalid_request', 'measuredBoolean must be boolean');
        const grant = context.authorizeQuery(
          context.authorization,
          'quality:inspect',
          Object.keys(body),
        );
        const repository = context.repository();
        const recordResult = repository.recordResult;
        const inspectionId: InspectionId = context.parsers.uuid(match.params[0], 'inspectionId');
        const input: Input = {
          characteristicId: context.parsers.uuid(body.characteristicId, 'characteristicId'),
          ...(body.measuredNumeric === undefined
            ? {}
            : {
                measuredNumeric: context.parsers.decimal(
                  body.measuredNumeric,
                  'measuredNumeric',
                  false,
                ),
              }),
          ...(body.measuredBoolean === undefined ? {} : { measuredBoolean: body.measuredBoolean }),
          ...(body.measuredText === undefined
            ? {}
            : { measuredText: context.parsers.string(body.measuredText, 'measuredText') }),
          passed: body.passed,
          notes: context.parsers.string(body.notes ?? '', 'notes'),
          occurredAt: context.parsers.timestamp(body.occurredAt, 'occurredAt'),
          idempotencyKey: context.parsers.stableCode(
            context.parsers.string(body.idempotencyKey, 'idempotencyKey'),
          ),
        };
        const scopeContext: ScopeContext = {
          actor: context.authorization.actor,
          scopes: grant.scopes,
          anchors: grant.anchors,
        };
        const correlationId = context.correlationId;
        return { repository, recordResult, inspectionId, input, scopeContext, correlationId };
      },
      handler: async (_request, _match, validated) => {
        const result: Awaited<ReturnType<RecordResult>> = await validated.recordResult.call(
          validated.repository,
          validated.inspectionId,
          validated.input,
          validated.scopeContext,
          validated.correlationId,
        );
        return {
          statusCode: 201,
          body: context.mutationDto(result, context.authorization, 'quality:read'),
        };
      },
    }),
  ];
}
