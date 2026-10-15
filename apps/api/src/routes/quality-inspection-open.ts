import type { AuthorizationContext } from '@kingturf/domain';
import type { PermissionKey } from '@kingturf/types';
import type { ApiDependencies } from '../app.ts';
import type { authorizeQuery } from '../policy.ts';
import { defineRoute, type RouteDefinition } from './types.ts';

type Repository = Pick<NonNullable<ApiDependencies['quality']>, 'openInspection'>;
type OpenInspection = Repository['openInspection'];
type Input = Readonly<Parameters<OpenInspection>[0]>;
type ScopeContext = Readonly<Parameters<OpenInspection>[1]>;
type CorrelationId = Parameters<OpenInspection>[2];
type ValidatedInspection = Readonly<{
  repository: Repository;
  openInspection: OpenInspection;
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
    string: (value: unknown, name: string) => string;
    uuid: (value: unknown, name: string) => string;
    decimal: (value: unknown, name: string, nonnegative?: boolean) => string;
    stableCode: (value: string) => string;
  }>;
  mutationDto: <T extends Record<string, unknown>>(
    value: T,
    authorization: AuthorizationContext,
    readCapability: PermissionKey,
  ) => Partial<T>;
}>;

export function qualityInspectionOpenRoutes(context: Context): readonly RouteDefinition[] {
  return [
    defineRoute({
      method: 'POST',
      match: (pathname) => (pathname === '/api/v1/quality-inspections' ? { params: [] } : null),
      validate: (request): ValidatedInspection => {
        const body = context.parsers.objectBody(request.body);
        context.parsers.allow(body, [
          'inspectionNumber',
          'planVersionId',
          'lotId',
          'sourceType',
          'sourceId',
          'sampleSize',
        ]);
        const grant = context.authorizeQuery(
          context.authorization,
          'quality:inspect',
          Object.keys(body),
        );
        const repository = context.repository();
        const openInspection = repository.openInspection;
        const input: Input = {
          inspectionNumber: context.parsers.stableCode(
            context.parsers.string(body.inspectionNumber, 'inspectionNumber'),
          ),
          planVersionId: context.parsers.uuid(body.planVersionId, 'planVersionId'),
          lotId: context.parsers.uuid(body.lotId, 'lotId'),
          sourceType: context.parsers.stableCode(
            context.parsers.string(body.sourceType, 'sourceType'),
          ),
          sourceId: context.parsers.uuid(body.sourceId, 'sourceId'),
          sampleSize: context.parsers.decimal(body.sampleSize, 'sampleSize'),
        };
        const scopeContext: ScopeContext = {
          actor: context.authorization.actor,
          scopes: grant.scopes,
          anchors: grant.anchors,
        };
        const correlationId = context.correlationId;
        return { repository, openInspection, input, scopeContext, correlationId };
      },
      handler: async (_request, _match, validated) => {
        const result: Awaited<ReturnType<OpenInspection>> = await validated.openInspection.call(
          validated.repository,
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
