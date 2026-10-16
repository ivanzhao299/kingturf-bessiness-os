import type { AuthorizationContext } from '@kingturf/domain';
import type { JsonObject } from '@kingturf/types';
import type { ApiDependencies } from '../app.ts';
import type { authorizeQuery } from '../policy.ts';
import { defineRoute, type RouteDefinition } from './types.ts';

type Repository = Pick<NonNullable<ApiDependencies['businessDocuments']>, 'createTranslation'>;
type Method = Repository['createTranslation'];
type Context = Readonly<{
  repository: () => Repository;
  authorization: AuthorizationContext;
  grant: ReturnType<typeof authorizeQuery>;
  correlationId: string;
  parsers: Readonly<{
    objectBody: (value: unknown) => Record<string, unknown>;
    allow: (body: Record<string, unknown>, fields: readonly string[]) => void;
    uuid: (value: unknown, name: string) => string;
    version: (value: unknown) => number;
    jsonObject: (value: unknown, name: string) => JsonObject;
    documentLocale: (value: unknown) => string;
  }>;
}>;
type Validated = Readonly<{ repository: Repository; method: Method; args: Parameters<Method> }>;
export function businessDocumentTranslationRoutes(context: Context): readonly RouteDefinition[] {
  return [
    defineRoute({
      method: 'POST',
      match: (pathname) => {
        const match = /^\/api\/v1\/business-documents\/([0-9a-f-]+)\/translations$/u.exec(pathname);
        return match ? { params: match.slice(1) } : null;
      },
      validate: (request, match): Validated => {
        const b = context.parsers.objectBody(request.body);
        context.parsers.allow(b, ['expectedVersion', 'targetLocale', 'content']);
        const repository = context.repository();
        const method = repository.createTranslation;
        const args: Parameters<Method> = [
          context.parsers.uuid(match.params[0], 'documentId'),
          {
            expectedVersion: context.parsers.version(b.expectedVersion),
            targetLocale: context.parsers.documentLocale(b.targetLocale),
            ...(b.content === undefined
              ? {}
              : { content: context.parsers.jsonObject(b.content, 'content') }),
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
  ];
}
