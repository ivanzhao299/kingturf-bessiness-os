import { DomainError, type AuthorizationContext } from '@kingturf/domain';
import type { PermissionKey } from '@kingturf/types';
import type { ApiDependencies, ApiRequest } from '../app.ts';
import type { authorizeQuery } from '../policy.ts';
import { defineRoute, type RouteDefinition } from './types.ts';
import { riskResultDto } from './risk-result-dto.ts';

type Repository = Pick<NonNullable<ApiDependencies['risks']>, 'transitionTask' | 'canReadResult'>;
type TransitionTask = Repository['transitionTask'];
type Input = Readonly<Parameters<TransitionTask>[1]>;
type Key = Parameters<TransitionTask>[2];
type ScopeContext = Readonly<Parameters<TransitionTask>[3]>;
type ValidatedTask = Readonly<{
  repository: Repository;
  transitionTask: TransitionTask;
  taskId: Parameters<TransitionTask>[0];
  input: Input;
  key: Key;
  scopeContext: ScopeContext;
  correlationId: Parameters<TransitionTask>[4];
}>;
type Context = Readonly<{
  repository: () => Repository;
  authorization: AuthorizationContext;
  authorizeQuery: typeof authorizeQuery;
  idempotency: (request: ApiRequest) => Key;
  correlationId: Parameters<TransitionTask>[4];
  parsers: Readonly<{
    objectBody: (value: unknown) => Record<string, unknown>;
    allow: (body: Record<string, unknown>, fields: readonly string[]) => void;
    string: (value: unknown, name: string) => string;
    jsonObject: (value: unknown, name: string) => Input['evidence'];
  }>;
  mutationDto: <T extends Record<string, unknown>>(
    value: T,
    authorization: AuthorizationContext,
    readCapability: PermissionKey,
  ) => Partial<T>;
}>;

export function riskTaskCommandRoutes(context: Context): readonly RouteDefinition[] {
  return [
    defineRoute({
      method: 'POST',
      match: (pathname) => {
        const match = /^\/api\/v1\/risk-tasks\/([0-9a-f-]+)\/(acknowledge|escalate|close)$/u.exec(
          pathname,
        );
        return match ? { params: match.slice(1) } : null;
      },
      validate: (request, match): ValidatedTask => {
        const body = context.parsers.objectBody(request.body);
        context.parsers.allow(body, ['reason', 'evidence']);
        const grant = context.authorizeQuery(
          context.authorization,
          'risk:manage',
          Object.keys(body),
        );
        const state = (
          { acknowledge: 'ACKNOWLEDGED', escalate: 'ESCALATED', close: 'CLOSED' } as const
        )[match.params[1] as 'acknowledge' | 'escalate' | 'close'];
        const taskId = match.params[0];
        if (!taskId) throw new DomainError('invalid_request', 'riskTaskId is required');
        const repository = context.repository();
        const transitionTask = repository.transitionTask;
        const input: Input = {
          state,
          reason: context.parsers.string(body.reason, 'reason'),
          evidence: context.parsers.jsonObject(body.evidence, 'evidence'),
        };
        const key = context.idempotency(request);
        const scopeContext: ScopeContext = {
          actor: context.authorization.actor,
          scopes: grant.scopes,
          anchors: grant.anchors,
        };
        const correlationId = context.correlationId;
        return { repository, transitionTask, taskId, input, key, scopeContext, correlationId };
      },
      handler: async (_request, _match, validated) => {
        const result: Awaited<ReturnType<TransitionTask>> = await validated.transitionTask.call(
          validated.repository,
          validated.taskId,
          validated.input,
          validated.key,
          validated.scopeContext,
          validated.correlationId,
        );
        return {
          statusCode: 201,
          body: await riskResultDto(
            result,
            'task',
            validated.taskId,
            validated.repository,
            context.authorization,
            validated.scopeContext.actor,
            context.mutationDto,
          ),
        };
      },
    }),
  ];
}
