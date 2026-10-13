import { DomainError, type AuthorizationContext } from '@kingturf/domain';
import type { ErrorCode, PermissionKey } from '@kingturf/types';
import type { AuthorizedQuery } from '../policy.ts';
import type { ApiDependencies, ApiRequest, ApiResponse } from '../app.ts';
import { dispatchRoutes, defineRoute, type RouteDefinition, type RouteMatch } from './types.ts';

type FoundationDependencies = Pick<
  ApiDependencies,
  'notifications' | 'attachments' | 'businessObjects' | 'events'
>;
type FoundationParsers = Readonly<{
  objectBody: (body: unknown) => Record<string, unknown>;
  string: (value: unknown, name: string) => string;
  uuid: (value: unknown, name: string) => string;
  version: (value: unknown) => number;
  expectedVersion: (value: unknown) => number;
  integer: (value: unknown, name: string, minimum: number, maximum: number) => number;
  strings: (value: unknown, name: string) => readonly string[];
  notificationChannel: (value: unknown) => string;
  attachmentBytes: (value: unknown) => Uint8Array;
  allow: (body: Record<string, unknown>, fields: readonly string[]) => void;
}>;
export type FoundationRouteContext = Readonly<{
  dependencies: FoundationDependencies;
  authorization: AuthorizationContext;
  correlationId: string;
  authorize: (capability: PermissionKey) => AuthorizedQuery;
  unavailable: (message: string) => ApiResponse;
  error: (statusCode: number, code: ErrorCode, message: string) => ApiResponse;
  parsers: FoundationParsers;
}>;

const literal =
  (pathname: string) =>
  (candidate: string): RouteMatch | null =>
    candidate === pathname ? { params: [] } : null;
const pattern =
  (expression: RegExp) =>
  (candidate: string): RouteMatch | null => {
    const match = expression.exec(candidate);
    return match ? { params: match.slice(1) } : null;
  };

export function foundationRoutes(context: FoundationRouteContext): readonly RouteDefinition[] {
  const p = context.parsers;
  const routes: RouteDefinition[] = [
    defineRoute({
      method: 'GET',
      match: literal('/api/v1/notifications'),
      validate: null,
      handler: async (request) => {
        context.authorize('notification:read');
        const notifications = context.dependencies.notifications;
        if (!notifications) return context.unavailable('Notification repository unavailable');
        return {
          statusCode: 200,
          body: await notifications.list(
            context.authorization.actor,
            request.query?.unread === 'true',
          ),
        };
      },
    }),
    defineRoute({
      method: 'GET',
      match: literal('/api/v1/notifications/unread-count'),
      validate: null,
      handler: async () => {
        context.authorize('notification:read');
        const notifications = context.dependencies.notifications;
        if (!notifications) return context.unavailable('Notification repository unavailable');
        return {
          statusCode: 200,
          body: { count: await notifications.unread(context.authorization.actor) },
        };
      },
    }),
    defineRoute({
      method: 'GET',
      match: pattern(/^\/api\/v1\/notifications\/([0-9a-f-]+)$/u),
      validate: null,
      handler: async (_request, match) => {
        context.authorize('notification:read');
        const notifications = context.dependencies.notifications;
        if (!notifications) return context.unavailable('Notification repository unavailable');
        const found = await notifications.find(
          p.uuid(match.params[0], 'notificationId'),
          context.authorization.actor,
        );
        return found
          ? { statusCode: 200, body: found }
          : context.error(404, 'not_found', 'Notification not found');
      },
    }),
    defineRoute({
      method: 'PUT',
      match: pattern(/^\/api\/v1\/notifications\/([0-9a-f-]+)\/(read|unread)$/u),
      validate: null,
      handler: async (_request, match) => {
        context.authorize('notification:read');
        const notifications = context.dependencies.notifications;
        if (!notifications) return context.unavailable('Notification repository unavailable');
        await notifications.setRead(
          p.uuid(match.params[0], 'notificationId'),
          match.params[1] === 'read',
          context.authorization.actor,
          context.correlationId,
        );
        return { statusCode: 204, body: {} };
      },
    }),
    defineRoute({
      method: 'GET',
      match: literal('/api/v1/notification-preferences'),
      validate: null,
      handler: async () => {
        context.authorize('notification:read');
        const notifications = context.dependencies.notifications;
        if (!notifications) return context.unavailable('Notification repository unavailable');
        return {
          statusCode: 200,
          body: await notifications.preferences(context.authorization.actor),
        };
      },
    }),
    defineRoute({
      method: 'PUT',
      match: literal('/api/v1/notification-preferences'),
      validate: null,
      handler: async (request) => {
        context.authorize('notification:manage');
        const notifications = context.dependencies.notifications;
        if (!notifications) return context.unavailable('Notification repository unavailable');
        const body = p.objectBody(request.body);
        p.allow(body, ['channel', 'enabled', 'expectedVersion']);
        if (typeof body.enabled !== 'boolean')
          throw new DomainError('invalid_request', 'enabled must be boolean');
        if (body.expectedVersion === undefined)
          throw new DomainError('invalid_request', 'expectedVersion is required');
        return {
          statusCode: 200,
          body: await notifications.setPreference(
            p.notificationChannel(body.channel),
            body.enabled,
            p.expectedVersion(body.expectedVersion),
            context.authorization.actor,
            context.correlationId,
          ),
        };
      },
    }),
    defineRoute({
      method: 'POST',
      match: literal('/api/v1/internal/notifications'),
      validate: null,
      handler: async (request) => {
        const authorized = context.authorize('notification:manage');
        const notifications = context.dependencies.notifications;
        if (!notifications) return context.unavailable('Notification repository unavailable');
        const body = p.objectBody(request.body);
        p.allow(body, ['kind', 'title', 'message', 'recipients', 'subjectType', 'subjectId']);
        const key = request.headers?.['idempotency-key'];
        if (!key) throw new DomainError('invalid_request', 'Idempotency-Key header is required');
        return {
          statusCode: 201,
          body: await notifications.create(
            {
              kind: p.string(body.kind, 'kind'),
              title: p.string(body.title, 'title'),
              message: p.string(body.message, 'message'),
              recipients: p
                .strings(body.recipients, 'recipients')
                .map((recipient) => p.uuid(recipient, 'recipient')),
              ...(body.subjectType
                ? { subjectType: p.string(body.subjectType, 'subjectType') }
                : {}),
              ...(body.subjectId ? { subjectId: p.uuid(body.subjectId, 'subjectId') } : {}),
              idempotencyKey: key,
            },
            context.authorization.actor,
            context.correlationId,
            authorized.scopes,
            authorized.anchors,
          ),
        };
      },
    }),
    defineRoute({
      method: 'POST',
      match: literal('/api/v1/attachments'),
      validate: null,
      handler: async (request) => {
        context.authorize('attachment:manage');
        const attachments = context.dependencies.attachments;
        if (!attachments) return context.unavailable('Attachment repository unavailable');
        const body = p.objectBody(request.body);
        p.allow(body, ['name', 'mimeType', 'size', 'checksum']);
        return {
          statusCode: 201,
          body: await attachments.create(
            {
              name: p.string(body.name, 'name'),
              mimeType: p.string(body.mimeType, 'mimeType'),
              size: p.integer(body.size, 'size', 1, 26_214_400),
              checksum: p.string(body.checksum, 'checksum'),
            },
            context.authorization.actor,
            context.correlationId,
          ),
        };
      },
    }),
    defineRoute({
      method: 'PUT',
      match: pattern(/^\/api\/v1\/attachments\/([0-9a-f-]+)\/content$/u),
      validate: null,
      handler: async (request, match) => {
        const grant = context.authorize('attachment:manage');
        const attachments = context.dependencies.attachments;
        if (!attachments) return context.unavailable('Attachment repository unavailable');
        const body = p.objectBody(request.body);
        p.allow(body, ['contentBase64']);
        return {
          statusCode: 200,
          body: await attachments.upload(
            p.uuid(match.params[0], 'attachmentId'),
            p.attachmentBytes(body.contentBase64),
            context.authorization.actor,
            grant.scopes,
            grant.anchors,
            context.correlationId,
          ),
        };
      },
    }),
    defineRoute({
      method: 'POST',
      match: pattern(/^\/api\/v1\/attachments\/([0-9a-f-]+)\/bindings$/u),
      validate: null,
      handler: async (request, match) => {
        const grant = context.authorize('attachment:manage');
        const attachments = context.dependencies.attachments;
        if (!attachments) return context.unavailable('Attachment repository unavailable');
        const body = p.objectBody(request.body);
        p.allow(body, ['objectType', 'objectId']);
        await attachments.bind(
          p.uuid(match.params[0], 'attachmentId'),
          p.string(body.objectType, 'objectType'),
          p.uuid(body.objectId, 'objectId'),
          context.authorization.actor,
          grant.scopes,
          grant.anchors,
          context.correlationId,
        );
        return { statusCode: 204, body: {} };
      },
    }),
    defineRoute({
      method: 'DELETE',
      match: pattern(/^\/api\/v1\/attachments\/([0-9a-f-]+)\/bindings$/u),
      validate: null,
      handler: async (request, match) => {
        const grant = context.authorize('attachment:manage');
        const attachments = context.dependencies.attachments;
        if (!attachments) return context.unavailable('Attachment repository unavailable');
        const body = p.objectBody(request.body);
        p.allow(body, ['objectType', 'objectId']);
        await attachments.unbind(
          p.uuid(match.params[0], 'attachmentId'),
          p.string(body.objectType, 'objectType'),
          p.uuid(body.objectId, 'objectId'),
          context.authorization.actor,
          grant.scopes,
          grant.anchors,
          context.correlationId,
        );
        return { statusCode: 204, body: {} };
      },
    }),
    defineRoute({
      method: 'GET',
      match: pattern(/^\/api\/v1\/attachments\/([0-9a-f-]+)$/u),
      validate: null,
      handler: async (_request, match) => {
        const grant = context.authorize('attachment:read');
        const attachments = context.dependencies.attachments;
        if (!attachments) return context.unavailable('Attachment repository unavailable');
        const found = await attachments.download(
          p.uuid(match.params[0], 'attachmentId'),
          context.authorization.actor,
          grant.scopes,
          grant.anchors,
        );
        return found
          ? {
              statusCode: 200,
              body: {
                metadata: found.metadata,
                contentBase64: Buffer.from(found.bytes).toString('base64'),
              },
            }
          : context.error(404, 'not_found', 'Attachment not found');
      },
    }),
    defineRoute({
      method: 'DELETE',
      match: pattern(/^\/api\/v1\/attachments\/([0-9a-f-]+)$/u),
      validate: null,
      handler: async (request, match) => {
        const grant = context.authorize('attachment:manage');
        const attachments = context.dependencies.attachments;
        if (!attachments) return context.unavailable('Attachment repository unavailable');
        const body = p.objectBody(request.body);
        p.allow(body, ['version']);
        await attachments.remove(
          p.uuid(match.params[0], 'attachmentId'),
          p.version(body.version),
          context.authorization.actor,
          grant.scopes,
          grant.anchors,
          context.correlationId,
        );
        return { statusCode: 204, body: {} };
      },
    }),
    defineRoute({
      method: 'GET',
      match: literal('/api/v1/business-objects'),
      validate: null,
      handler: async () => {
        context.authorize('business-object:read');
        const objects = context.dependencies.businessObjects;
        if (!objects) return context.unavailable('Registry unavailable');
        return { statusCode: 200, body: await objects.list(context.authorization.actor.companyId) };
      },
    }),
    defineRoute({
      method: 'POST',
      match: literal('/api/v1/business-objects'),
      validate: null,
      handler: async (request) => {
        context.authorize('business-object:manage');
        const objects = context.dependencies.businessObjects;
        if (!objects) return context.unavailable('Registry unavailable');
        const body = p.objectBody(request.body);
        p.allow(body, ['code', 'name', 'schema']);
        return {
          statusCode: 201,
          body: await objects.create(
            p.string(body.code, 'code'),
            p.string(body.name, 'name'),
            body.schema,
            context.authorization.actor,
            context.correlationId,
          ),
        };
      },
    }),
    defineRoute({
      method: 'POST',
      match: pattern(/^\/api\/v1\/business-objects\/([0-9a-f-]+)\/versions$/u),
      validate: null,
      handler: async (request, match) => {
        context.authorize('business-object:manage');
        const objects = context.dependencies.businessObjects;
        if (!objects) return context.unavailable('Registry unavailable');
        const body = p.objectBody(request.body);
        p.allow(body, ['schema']);
        return {
          statusCode: 201,
          body: await objects.addVersion(
            p.uuid(match.params[0], 'definitionId'),
            body.schema,
            context.authorization.actor,
            context.correlationId,
          ),
        };
      },
    }),
    defineRoute({
      method: 'POST',
      match: pattern(/^\/api\/v1\/business-objects\/([0-9a-f-]+)\/versions\/(\d+)\/publish$/u),
      validate: null,
      handler: async (_request, match) => {
        context.authorize('business-object:manage');
        const objects = context.dependencies.businessObjects;
        if (!objects) return context.unavailable('Registry unavailable');
        return {
          statusCode: 200,
          body: await objects.publish(
            p.uuid(match.params[0], 'definitionId'),
            Number(match.params[1]),
            context.authorization.actor,
            context.correlationId,
          ),
        };
      },
    }),
    defineRoute({
      method: 'GET',
      match: pattern(/^\/api\/v1\/business-objects\/([0-9a-f-]+)$/u),
      validate: null,
      handler: async (_request, match) => {
        context.authorize('business-object:read');
        const objects = context.dependencies.businessObjects;
        if (!objects) return context.unavailable('Registry unavailable');
        const found = await objects.find(
          p.uuid(match.params[0], 'definitionId'),
          context.authorization.actor.companyId,
        );
        return found
          ? { statusCode: 200, body: found }
          : context.error(404, 'not_found', 'Business object not found');
      },
    }),
    defineRoute({
      method: 'GET',
      match: literal('/api/v1/operations/events'),
      validate: null,
      handler: async () => {
        context.authorize('event:operate');
        const events = context.dependencies.events;
        if (!events) return context.unavailable('Event repository unavailable');
        return {
          statusCode: 200,
          body: await events.counts(context.authorization.actor.companyId),
        };
      },
    }),
    defineRoute({
      method: 'POST',
      match: literal('/api/v1/operations/events/claims'),
      validate: null,
      handler: async (request) => {
        context.authorize('event:operate');
        const events = context.dependencies.events;
        if (!events) return context.unavailable('Event repository unavailable');
        const body = p.objectBody(request.body);
        p.allow(body, ['consumer', 'worker', 'limit', 'leaseSeconds']);
        return {
          statusCode: 200,
          body: await events.claim(
            context.authorization.actor,
            p.string(body.consumer, 'consumer'),
            p.string(body.worker, 'worker'),
            body.limit === undefined ? undefined : p.integer(body.limit, 'limit', 1, 100),
            body.leaseSeconds === undefined
              ? undefined
              : p.integer(body.leaseSeconds, 'leaseSeconds', 5, 300),
          ),
        };
      },
    }),
    defineRoute({
      method: 'POST',
      match: pattern(
        /^\/api\/v1\/operations\/events\/([0-9a-f-]+)\/(complete|retry|dead-letter)$/u,
      ),
      validate: null,
      handler: async (request, match) => {
        context.authorize('event:operate');
        const events = context.dependencies.events;
        if (!events) return context.unavailable('Event repository unavailable');
        const body = p.objectBody(request.body);
        const action = match.params[1];
        p.allow(
          body,
          action === 'complete'
            ? ['consumer', 'claimToken']
            : ['consumer', 'claimToken', 'errorCode', 'maxAttempts'],
        );
        const eventId = p.uuid(match.params[0], 'eventId');
        const consumer = p.string(body.consumer, 'consumer');
        const claimToken = p.uuid(body.claimToken, 'claimToken');
        if (action === 'complete')
          await events.complete(eventId, context.authorization.actor, consumer, claimToken);
        else
          await events.fail(
            eventId,
            context.authorization.actor,
            consumer,
            claimToken,
            p.string(body.errorCode, 'errorCode'),
            action === 'dead-letter'
              ? 1
              : body.maxAttempts === undefined
                ? undefined
                : p.integer(body.maxAttempts, 'maxAttempts', 2, 100),
          );
        return { statusCode: 204, body: {} };
      },
    }),
  ];
  return routes;
}

export async function dispatchFoundationRoutes(
  routes: readonly RouteDefinition[],
  request: ApiRequest,
): Promise<ApiResponse | null> {
  return dispatchRoutes(routes, request);
}
