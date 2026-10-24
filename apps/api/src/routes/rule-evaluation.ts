import type { ApiDependencies } from '../app.ts';
import { defineRoute, type RouteDefinition } from './types.ts';

type EvaluateArgs = Parameters<NonNullable<ApiDependencies['rules']>['evaluate']>;
type EvaluationInput = Readonly<{
  id: EvaluateArgs[0];
  input: EvaluateArgs[1];
  key: EvaluateArgs[2];
}>;
type EvaluationContext = Readonly<{
  repository: Pick<NonNullable<ApiDependencies['rules']>, 'evaluate'>;
  actor: EvaluateArgs[3];
  correlationId: EvaluateArgs[4];
  objectBody: (body: unknown) => Record<string, unknown>;
  allow: (body: Record<string, unknown>, fields: readonly string[]) => void;
  uuid: (value: unknown, name: string) => string;
  keyRequired: () => never;
}>;

export function ruleEvaluationRoutes(context: EvaluationContext): readonly RouteDefinition[] {
  return [
    defineRoute({
      method: 'POST',
      match: (pathname) => {
        const match = /^\/api\/v1\/rules\/([0-9a-f-]+)\/evaluate$/u.exec(pathname);
        return match?.[1] ? { params: [match[1]] } : null;
      },
      validate: (request, match): EvaluationInput => {
        const key = request.headers?.['idempotency-key'];
        if (!key) context.keyRequired();
        const b = context.objectBody(request.body);
        context.allow(b, ['input']);
        return {
          id: context.uuid(match.params[0], 'ruleId'),
          input: context.objectBody(b.input) as EvaluateArgs[1],
          key,
        };
      },
      handler: async (_request, _match, input) => ({
        statusCode: 200,
        body: await context.repository.evaluate(
          input.id,
          input.input,
          input.key,
          context.actor,
          context.correlationId,
        ),
      }),
    }),
  ];
}
