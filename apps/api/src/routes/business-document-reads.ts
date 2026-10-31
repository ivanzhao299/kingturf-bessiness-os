import { DomainError, type AuthorizationContext } from '@kingturf/domain';
import type { ApiDependencies } from '../app.ts';
import { permittedDto } from '../app-values.ts';
import type { authorizeQuery } from '../policy.ts';
import { defineRoute, type RouteDefinition } from './types.ts';

const DETAIL_NESTED_COLLECTIONS = [
  'versions',
  'translations',
  'reviewEvents',
  'dispatches',
] as const;

const isPlainRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' &&
  value !== null &&
  !Array.isArray(value) &&
  Object.getPrototypeOf(value) === Object.prototype;

export function projectBusinessDocumentDetail(
  value: Record<string, unknown>,
  fields: readonly string[] | null,
): Record<string, unknown> {
  if (fields === null) return value;
  const directFields = fields.filter((field) => !field.includes('.'));
  const projected = permittedDto(value, directFields) as Record<string, unknown>;
  for (const key of DETAIL_NESTED_COLLECTIONS) {
    const nestedFields = fields
      .filter((field) => field.startsWith(`${key}.`))
      .map((field) => field.slice(key.length + 1));
    const direct = fields.includes(key);
    if (!direct && nestedFields.length === 0) continue;
    const collection = value[key];
    if (!Array.isArray(collection)) continue;
    projected[key] = collection.map((item): unknown => {
      if (isPlainRecord(item)) return permittedDto(item, nestedFields);
      return item as unknown;
    });
  }
  return projected;
}

type Repository = Pick<
  NonNullable<ApiDependencies['businessDocuments']>,
  'listConnectors' | 'activityLog' | 'list' | 'referenceData' | 'get'
>;
type ListConnectorsContext = Readonly<{
  repository: () => Repository;
  authorization: AuthorizationContext;
  canConfigure: boolean;
}>;
type ValidatedListConnectors = Readonly<{
  repository: Repository;
  method: Repository['listConnectors'];
  args: Parameters<Repository['listConnectors']>;
}>;
export function businessDocumentConnectorReadRoutes(
  context: ListConnectorsContext,
): readonly RouteDefinition[] {
  return [
    defineRoute({
      method: 'GET',
      match: (pathname) => (pathname === '/api/v1/document-connectors' ? { params: [] } : null),
      validate: (): ValidatedListConnectors => {
        const repository = context.repository();
        const method = repository.listConnectors;
        const args: Parameters<Repository['listConnectors']> = [
          context.authorization.actor,
          context.canConfigure,
        ];
        return { repository, method, args };
      },
      handler: async (_request, _match, validated) => {
        const result: Awaited<ReturnType<Repository['listConnectors']>> =
          await validated.method.call(validated.repository, ...validated.args);
        return { statusCode: 200, body: { items: result } };
      },
    }),
  ];
}

type ActivityLogContext = Readonly<{
  repository: () => Repository;
  authorization: AuthorizationContext;
  parsers: Readonly<{
    uuid: (value: unknown, name: string) => string;
  }>;
}>;
type ValidatedActivityLog = Readonly<{
  repository: Repository;
  method: Repository['activityLog'];
  args: Parameters<Repository['activityLog']>;
}>;
export function businessDocumentActivityLogReadRoutes(
  context: ActivityLogContext,
): readonly RouteDefinition[] {
  return [
    defineRoute({
      method: 'GET',
      match: (pathname) =>
        pathname === '/api/v1/business-document-activity' ? { params: [] } : null,
      validate: (request): ValidatedActivityLog => {
        const q = request.query ?? {};
        const requestedLimit = q.limit === undefined ? undefined : Number(q.limit);
        if (
          requestedLimit !== undefined &&
          (!Number.isInteger(requestedLimit) || requestedLimit < 1 || requestedLimit > 200)
        )
          throw new DomainError('invalid_request', 'limit must be an integer between 1 and 200');
        const repository = context.repository();
        const method = repository.activityLog;
        const args: Parameters<Repository['activityLog']> = [
          context.authorization.actor,
          {
            ...(q.documentId
              ? { documentId: context.parsers.uuid(q.documentId, 'documentId') }
              : {}),
            ...(q.actorId ? { actorId: context.parsers.uuid(q.actorId, 'actorId') } : {}),
            ...(requestedLimit === undefined ? {} : { limit: requestedLimit }),
          },
        ];
        return { repository, method, args };
      },
      handler: async (_request, _match, validated) => {
        const result: Awaited<ReturnType<Repository['activityLog']>> = await validated.method.call(
          validated.repository,
          ...validated.args,
        );
        return { statusCode: 200, body: { items: result } };
      },
    }),
  ];
}

type ListContext = Readonly<{
  repository: () => Repository;
  authorization: AuthorizationContext;
  grant: ReturnType<typeof authorizeQuery>;
}>;
type ValidatedList = Readonly<{
  repository: Repository;
  method: Repository['list'];
  args: Parameters<Repository['list']>;
}>;
export function businessDocumentListReadRoutes(context: ListContext): readonly RouteDefinition[] {
  return [
    defineRoute({
      method: 'GET',
      match: (pathname) => (pathname === '/api/v1/business-documents' ? { params: [] } : null),
      validate: (request): ValidatedList => {
        const repository = context.repository();
        const method = repository.list;
        const args: Parameters<Repository['list']> = [
          request.query?.route,
          {
            actor: context.authorization.actor,
            scopes: context.grant.scopes,
          },
        ];
        return { repository, method, args };
      },
      handler: async (_request, _match, validated) => {
        const result: Awaited<ReturnType<Repository['list']>> = await validated.method.call(
          validated.repository,
          ...validated.args,
        );
        return { statusCode: 200, body: { items: result } };
      },
    }),
  ];
}

type ReferenceDataContext = Readonly<{
  repository: () => Repository;
  authorization: AuthorizationContext;
  grant: ReturnType<typeof authorizeQuery>;
}>;
type ValidatedReferenceData = Readonly<{
  repository: Repository;
  method: Repository['referenceData'];
  args: Parameters<Repository['referenceData']>;
}>;
export function businessDocumentReferenceReadRoutes(
  context: ReferenceDataContext,
): readonly RouteDefinition[] {
  return [
    defineRoute({
      method: 'GET',
      match: (pathname) =>
        pathname === '/api/v1/business-documents/reference-data' ? { params: [] } : null,
      validate: (): ValidatedReferenceData => {
        const repository = context.repository();
        const method = repository.referenceData;
        const args: Parameters<Repository['referenceData']> = [
          {
            actor: context.authorization.actor,
            scopes: context.grant.scopes,
          },
        ];
        return { repository, method, args };
      },
      handler: async (_request, _match, validated) => {
        const result: Awaited<ReturnType<Repository['referenceData']>> =
          await validated.method.call(validated.repository, ...validated.args);
        return { statusCode: 200, body: result };
      },
    }),
  ];
}

type GetContext = Readonly<{
  repository: () => Repository;
  authorization: AuthorizationContext;
  grant: ReturnType<typeof authorizeQuery>;
  parsers: Readonly<{
    uuid: (value: unknown, name: string) => string;
  }>;
}>;
type ValidatedGet = Readonly<{
  repository: Repository;
  method: Repository['get'];
  args: Parameters<Repository['get']>;
  fields: readonly string[] | null;
}>;
export function businessDocumentDetailReadRoutes(context: GetContext): readonly RouteDefinition[] {
  return [
    defineRoute({
      method: 'GET',
      match: (pathname) => {
        const match = /^\/api\/v1\/business-documents\/([0-9a-f-]+)$/u.exec(pathname);
        return match ? { params: match.slice(1) } : null;
      },
      validate: (_request, match): ValidatedGet => {
        const repository = context.repository();
        const method = repository.get;
        const args: Parameters<Repository['get']> = [
          context.parsers.uuid(match.params[0], 'documentId'),
          {
            actor: context.authorization.actor,
            scopes: context.grant.scopes,
            includeAudit: context.authorization.permissions.has('business-document:audit'),
          },
        ];
        return {
          repository,
          method,
          args,
          fields: context.authorization.permissions.get('business-document:read')?.fields ?? null,
        };
      },
      handler: async (_request, _match, validated) => {
        const result: Awaited<ReturnType<Repository['get']>> = await validated.method.call(
          validated.repository,
          ...validated.args,
        );
        const rawResult: unknown = result;
        if (!isPlainRecord(rawResult)) return { statusCode: 200, body: rawResult };
        return {
          statusCode: 200,
          body: projectBusinessDocumentDetail(rawResult, validated.fields),
        };
      },
    }),
  ];
}
