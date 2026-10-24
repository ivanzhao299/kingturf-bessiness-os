import type { AuthorizationContext } from '@kingturf/domain';
import type { PermissionKey } from '@kingturf/types';
import type { ApiDependencies } from '../app.ts';
import type { authorizeQuery } from '../policy.ts';
import { defineRoute, type RouteDefinition } from './types.ts';

type Repository = Pick<NonNullable<ApiDependencies['quality']>, 'transitionInspection'>;
type TransitionInspection = Repository['transitionInspection'];
type InspectionId = Parameters<TransitionInspection>[0];
type State = Parameters<TransitionInspection>[1];
type Input = Readonly<Parameters<TransitionInspection>[2]>;
type ScopeContext = Readonly<Parameters<TransitionInspection>[3]>;
type CorrelationId = Parameters<TransitionInspection>[4];
type ValidatedTransition = Readonly<{
  repository: Repository;
  transitionInspection: TransitionInspection;
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

export function qualityInspectionTransitionRoutes(context: Context): readonly RouteDefinition[] {
  return [
    defineRoute({
      method: 'POST',
      match: (path) => {
        const match =
          /^\/api\/v1\/quality-inspections\/([0-9a-f-]+)\/(sample|complete|cancel)$/u.exec(path);
        return match ? { params: match.slice(1) } : null;
      },
      validate: (request, match): ValidatedTransition => {
        const body = context.parsers.objectBody(request.body);
        context.parsers.allow(body, ['reason', 'evidence', 'idempotencyKey']);
        const grant = context.authorizeQuery(
          context.authorization,
          'quality:inspect',
          Object.keys(body),
        );
        const states = {
          sample: 'SAMPLED',
          complete: 'COMPLETED',
          cancel: 'CANCELLED',
        } as const;
        const action = match.params[1] as keyof typeof states;
        const repository = context.repository();
        const transitionInspection = repository.transitionInspection;
        const inspectionId: InspectionId = context.parsers.uuid(match.params[0], 'inspectionId');
        const state: State = states[action];
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
        return {
          repository,
          transitionInspection,
          inspectionId,
          state,
          input,
          scopeContext,
          correlationId,
        };
      },
      handler: async (_request, _match, validated) => {
        const result: Awaited<ReturnType<TransitionInspection>> =
          await validated.transitionInspection.call(
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
