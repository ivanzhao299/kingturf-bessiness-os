import { DomainError, type AuthorizationContext } from '@kingturf/domain';
import type { JsonObject } from '@kingturf/types';
import type { ApiDependencies } from '../app.ts';
import { defineRoute, type RouteDefinition } from './types.ts';

type Repository = Pick<NonNullable<ApiDependencies['businessDocuments']>, 'configureConnector'>;
type Method = Repository['configureConnector'];
type Context = Readonly<{
  repository: () => Repository;
  authorization: AuthorizationContext;
  correlationId: string;
  parsers: Readonly<{
    objectBody: (value: unknown) => Record<string, unknown>;
    allow: (body: Record<string, unknown>, fields: readonly string[]) => void;
    string: (value: unknown, name: string) => string;
    expectedVersion: (value: unknown) => number;
    boundedString: (value: unknown, name: string, maximum: number) => string;
    connectorSecretReference: (value: unknown) => string | null;
    connectorProvider: (value: unknown) => string;
    safeConnectorConfiguration: (value: unknown) => JsonObject;
    documentConnector: (value: unknown, includeTranslation?: boolean) => string;
  }>;
}>;
type Validated = Readonly<{ repository: Repository; method: Method; args: Parameters<Method> }>;
export function businessDocumentConnectorRoutes(context: Context): readonly RouteDefinition[] {
  return [
    defineRoute({
      method: 'PUT',
      match: (pathname) => {
        const match = /^\/api\/v1\/document-connectors\/([A-Z_]+)$/u.exec(pathname);
        return match ? { params: match.slice(1) } : null;
      },
      validate: (request, match): Validated => {
        const b = context.parsers.objectBody(request.body);
        context.parsers.allow(b, [
          'provider',
          'displayName',
          'senderIdentity',
          'secretReference',
          'configuration',
          'status',
          'expectedVersion',
        ]);
        const status = context.parsers.string(b.status, 'status');
        if (!['UNCONFIGURED', 'READY', 'DISABLED'].includes(status))
          throw new DomainError('invalid_request', 'connector status is unsupported');
        const nullableText = (value: unknown, name: string): string | null =>
          value === undefined || value === null || value === ''
            ? null
            : context.parsers.string(value, name);
        const secretReference = context.parsers.connectorSecretReference(b.secretReference);
        const senderIdentity = nullableText(b.senderIdentity, 'senderIdentity');
        if (senderIdentity !== null && (senderIdentity.length < 2 || senderIdentity.length > 200))
          throw new DomainError(
            'invalid_request',
            'senderIdentity must contain 2 to 200 characters',
          );
        if (status === 'READY' && secretReference === null)
          throw new DomainError(
            'invalid_request',
            'A managed secret reference is required before a connector can be enabled',
          );
        const repository = context.repository();
        const method = repository.configureConnector;
        const args: Parameters<Method> = [
          context.parsers.documentConnector(match.params[0], true),
          {
            provider: context.parsers.connectorProvider(b.provider),
            displayName: context.parsers.boundedString(b.displayName, 'displayName', 100),
            senderIdentity,
            secretReference,
            configuration: context.parsers.safeConnectorConfiguration(b.configuration),
            status: status as 'UNCONFIGURED' | 'READY' | 'DISABLED',
            expectedVersion: context.parsers.expectedVersion(b.expectedVersion),
          },
          context.authorization.actor,
          context.correlationId,
        ];
        return { repository, method, args };
      },
      handler: async (_request, _match, validated) => {
        const result: Awaited<ReturnType<Method>> = await validated.method.call(
          validated.repository,
          ...validated.args,
        );
        return { statusCode: 200, body: result };
      },
    }),
  ];
}
