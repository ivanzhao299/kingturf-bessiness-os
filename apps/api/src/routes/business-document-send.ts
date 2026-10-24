import { DomainError, type AuthorizationContext } from '@kingturf/domain';
import type { ApiDependencies } from '../app.ts';
import type { authorizeQuery } from '../policy.ts';
import { defineRoute, type RouteDefinition } from './types.ts';

type Repository = Pick<NonNullable<ApiDependencies['businessDocuments']>, 'dispatch'>;
type Method = Repository['dispatch'];
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
    boundedString: (value: unknown, name: string, maximum: number) => string;
    documentConnector: (value: unknown, includeTranslation?: boolean) => string;
    normalizeContactEmail: (value: string) => string;
  }>;
}>;
type Validated = Readonly<{ repository: Repository; method: Method; args: Parameters<Method> }>;
export function businessDocumentSendRoutes(context: Context): readonly RouteDefinition[] {
  return [
    defineRoute({
      method: 'POST',
      match: (pathname) => {
        const match = /^\/api\/v1\/business-documents\/([0-9a-f-]+)\/send$/u.exec(pathname);
        return match ? { params: match.slice(1) } : null;
      },
      validate: (request, match): Validated => {
        const key = request.headers?.['idempotency-key'];
        if (!key || key.length < 8 || key.length > 128)
          throw new DomainError(
            'invalid_request',
            'Idempotency-Key header must contain 8 to 128 characters',
          );
        const b = context.parsers.objectBody(request.body);
        context.parsers.allow(b, [
          'expectedVersion',
          'channel',
          'recipientName',
          'recipientAddress',
          'subject',
          'message',
          'translationId',
        ]);
        const channel = context.parsers.documentConnector(b.channel);
        const rawAddress = context.parsers.boundedString(
          b.recipientAddress,
          'recipientAddress',
          320,
        );
        const recipientAddress =
          channel === 'EMAIL' ? context.parsers.normalizeContactEmail(rawAddress) : rawAddress;
        const repository = context.repository();
        const method = repository.dispatch;
        const args: Parameters<Method> = [
          context.parsers.uuid(match.params[0], 'documentId'),
          {
            expectedVersion: context.parsers.version(b.expectedVersion),
            channel,
            recipientName: context.parsers.boundedString(b.recipientName, 'recipientName', 200),
            recipientAddress,
            subject: context.parsers.boundedString(b.subject, 'subject', 200),
            message: context.parsers.boundedString(b.message, 'message', 4000),
            ...(b.translationId
              ? { translationId: context.parsers.uuid(b.translationId, 'translationId') }
              : {}),
            idempotencyKey: key,
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
        return { statusCode: 202, body: result };
      },
    }),
  ];
}
