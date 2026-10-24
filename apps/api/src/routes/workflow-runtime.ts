import type { ApiDependencies } from '../app.ts';
import { defineRoute, type RouteDefinition, type RouteMatch } from './types.ts';

type Workflows = NonNullable<ApiDependencies['workflows']>;
type StartArgs = Parameters<Workflows['start']>;
type ListArgs = Parameters<Workflows['listTasks']>;
type DecisionArgs = Parameters<Workflows['decide']>;
type StartInput = Readonly<{
  definitionId: StartArgs[0];
  subjectType: StartArgs[1];
  subjectId: StartArgs[2];
  key: StartArgs[3];
}>;
type ListInput = Readonly<{ actor: ListArgs[0] }>;
type DecisionInput = Readonly<{
  taskId: DecisionArgs[0];
  decision: DecisionArgs[1];
  comment: DecisionArgs[2];
  key: DecisionArgs[3];
  version: DecisionArgs[4];
}>;
type WriteParsers = Readonly<{
  objectBody: (body: unknown) => Record<string, unknown>;
  allow: (body: Record<string, unknown>, fields: readonly string[]) => void;
  uuid: (value: unknown, name: string) => string;
  string: (value: unknown, name: string) => string;
}>;
type StartContext = Readonly<{
  repository: Pick<Workflows, 'start'>;
  actor: StartArgs[4];
  correlationId: StartArgs[5];
  parsers: WriteParsers;
  missingKey: () => never;
}>;
type ListContext = Readonly<{
  repository: Pick<Workflows, 'listTasks'>;
  actor: ListArgs[0];
}>;
type DecisionContext = Readonly<{
  repository: Pick<Workflows, 'decide'>;
  actor: DecisionArgs[5];
  correlationId: DecisionArgs[6];
  parsers: WriteParsers & Readonly<{ version: (value: unknown) => number }>;
  missingKey: () => never;
}>;

function matchStart(pathname: string): RouteMatch | null {
  const match = /^\/api\/v1\/workflows\/([0-9a-f-]+)\/instances$/u.exec(pathname);
  return match?.[1] ? { params: [match[1]] } : null;
}

function matchDecision(pathname: string): RouteMatch | null {
  const match = /^\/api\/v1\/workflow-tasks\/([0-9a-f-]+)\/decisions$/u.exec(pathname);
  return match?.[1] ? { params: [match[1]] } : null;
}

export function workflowRuntimeStartRoutes(context: StartContext): readonly RouteDefinition[] {
  return [
    defineRoute({
      method: 'POST',
      match: matchStart,
      validate: (request, match): StartInput => {
        const key = request.headers?.['idempotency-key'];
        if (!key) context.missingKey();
        const p = context.parsers;
        const b = p.objectBody(request.body);
        p.allow(b, ['subjectType', 'subjectId']);
        return {
          definitionId: p.uuid(match.params[0], 'workflowId'),
          subjectType: p.string(b.subjectType, 'subjectType'),
          subjectId: p.uuid(b.subjectId, 'subjectId'),
          key,
        };
      },
      handler: async (_request, _match, input) => ({
        statusCode: 201,
        body: await context.repository.start(
          input.definitionId,
          input.subjectType,
          input.subjectId,
          input.key,
          context.actor,
          context.correlationId,
        ),
      }),
    }),
  ];
}

export function workflowRuntimeTaskListRoutes(context: ListContext): readonly RouteDefinition[] {
  return [
    defineRoute({
      method: 'GET',
      match: (pathname) => (pathname === '/api/v1/workflow-tasks' ? { params: [] } : null),
      validate: (): ListInput => ({ actor: context.actor }),
      handler: async (_request, _match, input) => ({
        statusCode: 200,
        body: await context.repository.listTasks(input.actor),
      }),
    }),
  ];
}

export function workflowRuntimeDecisionRoutes(
  context: DecisionContext,
): readonly RouteDefinition[] {
  return [
    defineRoute({
      method: 'POST',
      match: matchDecision,
      validate: (request, match): DecisionInput => {
        const key = request.headers?.['idempotency-key'];
        if (!key) context.missingKey();
        const p = context.parsers;
        const b = p.objectBody(request.body);
        p.allow(b, ['decision', 'comment', 'version']);
        return {
          taskId: p.uuid(match.params[0], 'taskId'),
          decision: p.string(b.decision, 'decision'),
          comment: b.comment == null ? null : p.string(b.comment, 'comment'),
          key,
          version: p.version(b.version),
        };
      },
      handler: async (_request, _match, input) => ({
        statusCode: 200,
        body: await context.repository.decide(
          input.taskId,
          input.decision,
          input.comment,
          input.key,
          input.version,
          context.actor,
          context.correlationId,
        ),
      }),
    }),
  ];
}
