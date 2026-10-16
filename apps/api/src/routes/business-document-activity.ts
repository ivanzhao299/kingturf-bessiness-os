import { DomainError, type AuthorizationContext } from '@kingturf/domain';
import type { ApiDependencies } from '../app.ts';
import type { authorizeQuery } from '../policy.ts';
import { defineRoute, type RouteDefinition } from './types.ts';

type Repository = Pick<NonNullable<ApiDependencies['businessDocuments']>, 'recordClientActivity'>;
type Method = Repository['recordClientActivity'];
type Context = Readonly<{
  repository: () => Repository;
  authorization: AuthorizationContext;
  grant: ReturnType<typeof authorizeQuery>;
  correlationId: string;
  parsers: Readonly<{
    objectBody: (value: unknown) => Record<string, unknown>;
    allow: (body: Record<string, unknown>, fields: readonly string[]) => void;
    string: (value: unknown, name: string) => string;
    uuid: (value: unknown, name: string) => string;
    version: (value: unknown) => number;
  }>;
}>;
type Validated = Readonly<{ repository: Repository; method: Method; args: Parameters<Method> }>;
export function businessDocumentActivityRoutes(context: Context): readonly RouteDefinition[] {
  return [
    defineRoute({
      method: 'POST',
      match: (pathname) => {
        const match = /^\/api\/v1\/business-documents\/([0-9a-f-]+)\/activity$/u.exec(pathname);
        return match ? { params: match.slice(1) } : null;
      },
      validate: (request, match): Validated => {
        const b = context.parsers.objectBody(request.body);
        context.parsers.allow(b, ['action', 'version']);
        const action = context.parsers.string(b.action, 'action');
        if (!['PRINTED', 'DOWNLOADED'].includes(action))
          throw new DomainError('invalid_request', 'document activity is unsupported');
        const repository = context.repository();
        const method = repository.recordClientActivity;
        const args: Parameters<Method> = [
          context.parsers.uuid(match.params[0], 'documentId'),
          action as 'PRINTED' | 'DOWNLOADED',
          context.parsers.version(b.version),
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
