import type { AuthorizationContext } from '@kingturf/domain';
import type { PermissionKey } from '@kingturf/types';
import type { ApiDependencies } from '../app.ts';
import type { authorizeQuery } from '../policy.ts';
import { defineRoute, type RouteDefinition } from './types.ts';

type Repository = Pick<NonNullable<ApiDependencies['quality']>, 'dispose'>;
type Dispose = Repository['dispose'];
type InspectionId = Parameters<Dispose>[0];
type State = Parameters<Dispose>[1];
type Input = Readonly<Parameters<Dispose>[2]>;
type ScopeContext = Readonly<Parameters<Dispose>[3]>;
type CorrelationId = Parameters<Dispose>[4];
type ValidatedDisposition = Readonly<{
  repository: Repository;
  dispose: Dispose;
  inspectionId: InspectionId;
  state: State;
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
    jsonObject: (value: unknown, name: string) => Input['evidence'];
    stableCode: (value: string) => string;
  }>;
  mutationDto: <T extends Record<string, unknown>>(
    value: T,
    authorization: AuthorizationContext,
    readCapability: PermissionKey,
  ) => Partial<T>;
}>;

export function qualityDispositionRoutes(context: Context): readonly RouteDefinition[] {
  return [
    defineRoute({
      method: 'POST',
      match: (pathname) => {
        const match = /^\/api\/v1\/quality-inspections\/([0-9a-f-]+)\/(release|reject)$/u.exec(
          pathname,
        );
        return match ? { params: match.slice(1) } : null;
      },
      validate: (request, match): ValidatedDisposition => {
        const body = context.parsers.objectBody(request.body);
        context.parsers.allow(body, ['reason', 'evidence', 'idempotencyKey']);
        const grant = context.authorizeQuery(
          context.authorization,
          'quality:disposition',
          Object.keys(body),
        );
        const repository = context.repository();
        const dispose = repository.dispose;
        const inspectionId: InspectionId = context.parsers.uuid(match.params[0], 'inspectionId');
        const state: State = match.params[1] === 'release' ? 'RELEASED' : 'REJECTED';
        const input: Input = {
          reason: context.parsers.string(body.reason, 'reason'),
          evidence: context.parsers.jsonObject(body.evidence ?? {}, 'evidence'),
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
        return { repository, dispose, inspectionId, state, input, scopeContext, correlationId };
      },
      handler: async (_request, _match, validated) => {
        const result: Awaited<ReturnType<Dispose>> = await validated.dispose.call(
          validated.repository,
          validated.inspectionId,
          validated.state,
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
