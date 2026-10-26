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
type NotificationPreferenceInput = Readonly<{
  channel: string;
  enabled: boolean;
  expectedVersion: number;
}>;
type NotificationCreateInput = Readonly<{
  input: {
    kind: string;
    title: string;
    message: string;
    recipients: readonly string[];
    subjectType?: string;
    subjectId?: string;
    idempotencyKey: string;
  };
}>;
type AttachmentCreateInput = Readonly<{
  name: string;
  mimeType: string;
  size: number;
  checksum: string;
}>;
type AttachmentUploadInput = Readonly<{ attachmentId: string; bytes: Uint8Array }>;
type AttachmentBindingInput = Readonly<{
  attachmentId: string;
  objectType: string;
  objectId: string;
}>;
type AttachmentDeleteInput = Readonly<{ attachmentId: string; version: number }>;
type BusinessObjectCreateInput = Readonly<{ code: string; name: string; schema: unknown }>;
type BusinessObjectVersionInput = Readonly<{ definitionId: string; schema: unknown }>;
type EventClaimInput = Readonly<{
  consumer: string;
  worker: string;
  limit?: number;
  leaseSeconds?: number;
}>;
type EventDeliveryInput = Readonly<{
  eventId: string;
  action: string;
  consumer: string;
  claimToken: string;
  errorCode?: string;
  maxAttempts?: number;
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

function createFoundationValidators(p: FoundationParsers) {
  const validatePreference = (request: ApiRequest): NotificationPreferenceInput => {
    const body = p.objectBody(request.body);
    p.allow(body, ['channel', 'enabled', 'expectedVersion']);
    if (typeof body.enabled !== 'boolean')
      throw new DomainError('invalid_request', 'enabled must be boolean');
    if (body.expectedVersion === undefined)
      throw new DomainError('invalid_request', 'expectedVersion is required');
    return {
      channel: p.notificationChannel(body.channel),
      enabled: body.enabled,
      expectedVersion: p.expectedVersion(body.expectedVersion),
    };
  };
  const validateNotification = (request: ApiRequest): NotificationCreateInput => {
    const body = p.objectBody(request.body);
    p.allow(body, ['kind', 'title', 'message', 'recipients', 'subjectType', 'subjectId']);
    const key = request.headers?.['idempotency-key'];
    if (!key) throw new DomainError('invalid_request', 'Idempotency-Key header is required');
    return {
      input: {
        kind: p.string(body.kind, 'kind'),
        title: p.string(body.title, 'title'),
        message: p.string(body.message, 'message'),
        recipients: p
          .strings(body.recipients, 'recipients')
          .map((recipient) => p.uuid(recipient, 'recipient')),
        ...(body.subjectType ? { subjectType: p.string(body.subjectType, 'subjectType') } : {}),
        ...(body.subjectId ? { subjectId: p.uuid(body.subjectId, 'subjectId') } : {}),
        idempotencyKey: key,
      },
    };
  };
  const validateAttachmentCreate = (request: ApiRequest): AttachmentCreateInput => {
    const body = p.objectBody(request.body);
    p.allow(body, ['name', 'mimeType', 'size', 'checksum']);
    return {
      name: p.string(body.name, 'name'),
      mimeType: p.string(body.mimeType, 'mimeType'),
      size: p.integer(body.size, 'size', 1, 26_214_400),
      checksum: p.string(body.checksum, 'checksum'),
    };
  };
  const validateAttachmentUpload = (
    request: ApiRequest,
    match: RouteMatch,
  ): AttachmentUploadInput => {
    const body = p.objectBody(request.body);
    p.allow(body, ['contentBase64']);
    return {
      attachmentId: p.uuid(match.params[0], 'attachmentId'),
      bytes: p.attachmentBytes(body.contentBase64),
    };
  };
  const validateAttachmentBinding = (
    request: ApiRequest,
    match: RouteMatch,
  ): AttachmentBindingInput => {
    const body = p.objectBody(request.body);
    p.allow(body, ['objectType', 'objectId']);
    return {
      attachmentId: p.uuid(match.params[0], 'attachmentId'),
      objectType: p.string(body.objectType, 'objectType'),
      objectId: p.uuid(body.objectId, 'objectId'),
    };
  };
  const validateAttachmentDelete = (
    request: ApiRequest,
    match: RouteMatch,
  ): AttachmentDeleteInput => {
    const body = p.objectBody(request.body);
    p.allow(body, ['version']);
    return {
      attachmentId: p.uuid(match.params[0], 'attachmentId'),
      version: p.version(body.version),
    };
  };
  const validateBusinessObjectCreate = (request: ApiRequest): BusinessObjectCreateInput => {
    const body = p.objectBody(request.body);
    p.allow(body, ['code', 'name', 'schema']);
    return {
      code: p.string(body.code, 'code'),
      name: p.string(body.name, 'name'),
      schema: body.schema,
    };
  };
  const validateBusinessObjectVersion = (
    request: ApiRequest,
    match: RouteMatch,
  ): BusinessObjectVersionInput => {
    const body = p.objectBody(request.body);
    p.allow(body, ['schema']);
    return { definitionId: p.uuid(match.params[0], 'definitionId'), schema: body.schema };
  };
  const validateEventClaim = (request: ApiRequest): EventClaimInput => {
    const body = p.objectBody(request.body);
    p.allow(body, ['consumer', 'worker', 'limit', 'leaseSeconds']);
    return {
      consumer: p.string(body.consumer, 'consumer'),
      worker: p.string(body.worker, 'worker'),
      ...(body.limit === undefined ? {} : { limit: p.integer(body.limit, 'limit', 1, 100) }),
      ...(body.leaseSeconds === undefined
        ? {}
        : { leaseSeconds: p.integer(body.leaseSeconds, 'leaseSeconds', 5, 300) }),
    };
  };
  const validateEventDelivery = (request: ApiRequest, match: RouteMatch): EventDeliveryInput => {
    const body = p.objectBody(request.body);
    const action = match.params[1] ?? '';
    p.allow(
      body,
      action === 'complete'
        ? ['consumer', 'claimToken']
        : ['consumer', 'claimToken', 'errorCode', 'maxAttempts'],
    );
    return {
      eventId: p.uuid(match.params[0], 'eventId'),
      action,
      consumer: p.string(body.consumer, 'consumer'),
      claimToken: p.uuid(body.claimToken, 'claimToken'),
      ...(action === 'complete'
        ? {}
        : {
            errorCode: p.string(body.errorCode, 'errorCode'),
            ...(body.maxAttempts === undefined
              ? {}
              : { maxAttempts: p.integer(body.maxAttempts, 'maxAttempts', 2, 100) }),
          }),
    };
  };
  return {
    validatePreference,
    validateNotification,
    validateAttachmentCreate,
    validateAttachmentUpload,
    validateAttachmentBinding,
    validateAttachmentDelete,
    validateBusinessObjectCreate,
    validateBusinessObjectVersion,
    validateEventClaim,
    validateEventDelivery,
  };
}
type Validators = ReturnType<typeof createFoundationValidators>;
function notificationRoutes(
  context: FoundationRouteContext,
  p: FoundationParsers,
  validators: Validators,
): readonly RouteDefinition[] {
  const { validatePreference, validateNotification } = validators;
  return [
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
      validate: validatePreference,
      handler: async (_request, _match, input) => {
        context.authorize('notification:manage');
        const notifications = context.dependencies.notifications;
        if (!notifications) return context.unavailable('Notification repository unavailable');
        return {
          statusCode: 200,
          body: await notifications.setPreference(
            input.channel,
            input.enabled,
            input.expectedVersion,
            context.authorization.actor,
            context.correlationId,
          ),
        };
      },
    }),
    defineRoute({
      method: 'POST',
      match: literal('/api/v1/internal/notifications'),
      validate: validateNotification,
      handler: async (_request, _match, input) => {
        const authorized = context.authorize('notification:manage');
        const notifications = context.dependencies.notifications;
        if (!notifications) return context.unavailable('Notification repository unavailable');
        return {
          statusCode: 201,
          body: await notifications.create(
            input.input,
            context.authorization.actor,
            context.correlationId,
            authorized.scopes,
            authorized.anchors,
          ),
        };
      },
    }),
  ];
}
function attachmentRoutes(
  context: FoundationRouteContext,
  p: FoundationParsers,
  validators: Validators,
): readonly RouteDefinition[] {
  const {
    validateAttachmentCreate,
    validateAttachmentUpload,
    validateAttachmentBinding,
    validateAttachmentDelete,
  } = validators;
  return [
    defineRoute({
      method: 'POST',
      match: literal('/api/v1/attachments'),
      validate: validateAttachmentCreate,
      handler: async (_request, _match, input) => {
        context.authorize('attachment:manage');
        const attachments = context.dependencies.attachments;
        if (!attachments) return context.unavailable('Attachment repository unavailable');
        return {
          statusCode: 201,
          body: await attachments.create(input, context.authorization.actor, context.correlationId),
        };
      },
    }),
    defineRoute({
      method: 'PUT',
      match: pattern(/^\/api\/v1\/attachments\/([0-9a-f-]+)\/content$/u),
      validate: validateAttachmentUpload,
      handler: async (_request, _match, input) => {
        const grant = context.authorize('attachment:manage');
        const attachments = context.dependencies.attachments;
        if (!attachments) return context.unavailable('Attachment repository unavailable');
        return {
          statusCode: 200,
          body: await attachments.upload(
            input.attachmentId,
            input.bytes,
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
      validate: validateAttachmentBinding,
      handler: async (_request, _match, input) => {
        const grant = context.authorize('attachment:manage');
        const attachments = context.dependencies.attachments;
        if (!attachments) return context.unavailable('Attachment repository unavailable');
        await attachments.bind(
          input.attachmentId,
          input.objectType,
          input.objectId,
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
      validate: validateAttachmentBinding,
      handler: async (_request, _match, input) => {
        const grant = context.authorize('attachment:manage');
        const attachments = context.dependencies.attachments;
        if (!attachments) return context.unavailable('Attachment repository unavailable');
        await attachments.unbind(
          input.attachmentId,
          input.objectType,
          input.objectId,
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
      validate: validateAttachmentDelete,
      handler: async (_request, _match, input) => {
        const grant = context.authorize('attachment:manage');
        const attachments = context.dependencies.attachments;
        if (!attachments) return context.unavailable('Attachment repository unavailable');
        await attachments.remove(
          input.attachmentId,
          input.version,
          context.authorization.actor,
          grant.scopes,
          grant.anchors,
          context.correlationId,
        );
        return { statusCode: 204, body: {} };
      },
    }),
  ];
}
function businessObjectRoutes(
  context: FoundationRouteContext,
  p: FoundationParsers,
  validators: Validators,
): readonly RouteDefinition[] {
  const { validateBusinessObjectCreate, validateBusinessObjectVersion } = validators;
  return [
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
      validate: validateBusinessObjectCreate,
      handler: async (_request, _match, input) => {
        context.authorize('business-object:manage');
        const objects = context.dependencies.businessObjects;
        if (!objects) return context.unavailable('Registry unavailable');
        return {
          statusCode: 201,
          body: await objects.create(
            input.code,
            input.name,
            input.schema,
            context.authorization.actor,
            context.correlationId,
          ),
        };
      },
    }),
    defineRoute({
      method: 'POST',
      match: pattern(/^\/api\/v1\/business-objects\/([0-9a-f-]+)\/versions$/u),
      validate: validateBusinessObjectVersion,
      handler: async (_request, _match, input) => {
        context.authorize('business-object:manage');
        const objects = context.dependencies.businessObjects;
        if (!objects) return context.unavailable('Registry unavailable');
        return {
          statusCode: 201,
          body: await objects.addVersion(
            input.definitionId,
            input.schema,
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
  ];
}
function eventRoutes(
  context: FoundationRouteContext,
  validators: Validators,
): readonly RouteDefinition[] {
  const { validateEventClaim, validateEventDelivery } = validators;
  return [
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
      validate: validateEventClaim,
      handler: async (_request, _match, input) => {
        context.authorize('event:operate');
        const events = context.dependencies.events;
        if (!events) return context.unavailable('Event repository unavailable');
        return {
          statusCode: 200,
          body: await events.claim(
            context.authorization.actor,
            input.consumer,
            input.worker,
            input.limit,
            input.leaseSeconds,
          ),
        };
      },
    }),
    defineRoute({
      method: 'POST',
      match: pattern(
        /^\/api\/v1\/operations\/events\/([0-9a-f-]+)\/(complete|retry|dead-letter)$/u,
      ),
      validate: validateEventDelivery,
      handler: async (_request, _match, input) => {
        context.authorize('event:operate');
        const events = context.dependencies.events;
        if (!events) return context.unavailable('Event repository unavailable');
        if (input.action === 'complete')
          await events.complete(
            input.eventId,
            context.authorization.actor,
            input.consumer,
            input.claimToken,
          );
        else
          await events.fail(
            input.eventId,
            context.authorization.actor,
            input.consumer,
            input.claimToken,
            input.errorCode ?? '',
            input.action === 'dead-letter' ? 1 : input.maxAttempts,
          );
        return { statusCode: 204, body: {} };
      },
    }),
  ];
}
export function foundationRoutes(context: FoundationRouteContext): readonly RouteDefinition[] {
  const p = context.parsers;
  const validators = createFoundationValidators(p);
  return [
    ...notificationRoutes(context, p, validators),
    ...attachmentRoutes(context, p, validators),
    ...businessObjectRoutes(context, p, validators),
    ...eventRoutes(context, validators),
  ];
}

export async function dispatchFoundationRoutes(
  routes: readonly RouteDefinition[],
  request: ApiRequest,
): Promise<ApiResponse | null> {
  return dispatchRoutes(routes, request);
}
