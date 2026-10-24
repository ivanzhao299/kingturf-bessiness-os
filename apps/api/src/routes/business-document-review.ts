import type { AuthorizationContext } from '@kingturf/domain';
import type { ApiDependencies } from '../app.ts';
import type { authorizeQuery } from '../policy.ts';
import { defineRoute, type RouteDefinition } from './types.ts';

type Repository = Pick<NonNullable<ApiDependencies['businessDocuments']>, 'transition'>;
type Method = Repository['transition'];
type Context = Readonly<{
  repository: () => Repository;
  authorization: AuthorizationContext;
  grant: ReturnType<typeof authorizeQuery>;
  correlationId: string;
  action: Parameters<Method>[1]['action'];
  parsers: Readonly<{
    objectBody: (value: unknown) => Record<string, unknown>;
    allow: (body: Record<string, unknown>, fields: readonly string[]) => void;
    string: (value: unknown, name: string) => string;
    uuid: (value: unknown, name: string) => string;
    version: (value: unknown) => number;
  }>;
}>;
type Validated = Readonly<{ repository: Repository; method: Method; args: Parameters<Method> }>;
export function businessDocumentReviewRoutes(context: Context): readonly RouteDefinition[] {
  return (['submit', 'approve', 'reject'] as const).map((operation) =>
    defineRoute({
      method: 'POST',
      match: (pathname) => {
        const match =
          /^\/api\/v1\/business-documents\/([0-9a-f-]+)\/(submit|approve|reject)$/u.exec(pathname);
        return match?.[2] === operation ? { params: match.slice(1) } : null;
      },
      validate: (request, match): Validated => {
        const b = context.parsers.objectBody(request.body);
        context.parsers.allow(b, ['expectedVersion', 'reason']);
        const repository = context.repository();
        const method = repository.transition;
        const args: Parameters<Method> = [
          context.parsers.uuid(match.params[0], 'documentId'),
          {
            expectedVersion: context.parsers.version(b.expectedVersion),
            action: context.action,
            reason: context.parsers.string(b.reason, 'reason'),
          },
          { actor: context.authorization.actor, scopes: context.grant.scopes },
          context.correlationId,
        ];
        return { repository, method, args };
      },
      handler: async (_request, _match, validated) => {
        const result: Awaited<ReturnType<Method>> = await validated.method.call(
          validated.repository,
          ...validated.args,
        );
        return { statusCode: 201, body: result };
      },
    }),
  );
}
