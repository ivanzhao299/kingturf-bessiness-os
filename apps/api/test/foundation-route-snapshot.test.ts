import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { DomainError } from '@kingturf/domain';
import { buildApp, type ApiDependencies } from '../src/app.js';

const actor = { employeeId: randomUUID(), companyId: randomUUID() };
const notificationId = randomUUID();
const attachmentId = randomUUID();
const definitionId = randomUUID();
const eventId = randomUUID();
const token = randomUUID();
const permissions = new Map([
  ['notification:read', { scopes: ['COMPANY'], fields: null }],
  ['notification:manage', { scopes: ['COMPANY'], fields: null }],
  ['attachment:read', { scopes: ['COMPANY'], fields: null }],
  ['attachment:manage', { scopes: ['COMPANY'], fields: null }],
  ['business-object:read', { scopes: ['COMPANY'], fields: null }],
  ['business-object:manage', { scopes: ['COMPANY'], fields: null }],
  ['event:operate', { scopes: ['COMPANY'], fields: null }],
]);
const auth = {
  authenticate: vi.fn(() => Promise.resolve({ actor, permissions })),
  login: vi.fn(),
  logout: vi.fn(),
};
const base = {
  auth: auth as unknown as ApiDependencies['auth'],
  organizations: {} as ApiDependencies['organizations'],
  employees: {} as ApiDependencies['employees'],
};

describe('foundation route migration snapshot', () => {
  it('preserves successful status and dispatch contracts for all foundation methods', async () => {
    const notifications = {
      list: vi.fn(() => Promise.resolve([])),
      unread: vi.fn(() => Promise.resolve(0)),
      find: vi.fn(() => Promise.resolve({ id: notificationId })),
      setRead: vi.fn(() => Promise.resolve()),
      preferences: vi.fn(() => Promise.resolve([])),
      setPreference: vi.fn(() => Promise.resolve({ channel: 'IN_APP', enabled: true, version: 1 })),
      create: vi.fn(() => Promise.resolve({ id: notificationId })),
    };
    const attachments = {
      create: vi.fn(() => Promise.resolve({ id: attachmentId })),
      upload: vi.fn(() => Promise.resolve({ id: attachmentId })),
      bind: vi.fn(() => Promise.resolve()),
      unbind: vi.fn(() => Promise.resolve()),
      download: vi.fn(() =>
        Promise.resolve({ metadata: { id: attachmentId }, bytes: new Uint8Array([1]) }),
      ),
      remove: vi.fn(() => Promise.resolve()),
    };
    const businessObjects = {
      list: vi.fn(() => Promise.resolve([])),
      create: vi.fn(() => Promise.resolve({ id: definitionId })),
      addVersion: vi.fn(() => Promise.resolve({ id: definitionId })),
      publish: vi.fn(() => Promise.resolve({ id: definitionId })),
      find: vi.fn(() => Promise.resolve({ id: definitionId })),
    };
    const events = {
      counts: vi.fn(() => Promise.resolve({ PENDING: 0 })),
      claim: vi.fn(() => Promise.resolve([])),
      complete: vi.fn(() => Promise.resolve()),
      fail: vi.fn(() => Promise.resolve()),
    };
    const app = buildApp({
      ...base,
      notifications: notifications as unknown as NonNullable<ApiDependencies['notifications']>,
      attachments: attachments as unknown as NonNullable<ApiDependencies['attachments']>,
      businessObjects: businessObjects as unknown as NonNullable<
        ApiDependencies['businessObjects']
      >,
      events: events as unknown as NonNullable<ApiDependencies['events']>,
    });
    const requests = [
      { method: 'GET', pathname: '/api/v1/notifications', query: { unread: 'true' } },
      { method: 'GET', pathname: '/api/v1/notifications/unread-count' },
      { method: 'GET', pathname: `/api/v1/notifications/${notificationId}` },
      { method: 'PUT', pathname: `/api/v1/notifications/${notificationId}/read`, body: {} },
      { method: 'GET', pathname: '/api/v1/notification-preferences' },
      {
        method: 'PUT',
        pathname: '/api/v1/notification-preferences',
        body: { channel: 'IN_APP', enabled: true, expectedVersion: 0 },
      },
      {
        method: 'POST',
        pathname: '/api/v1/internal/notifications',
        headers: { 'idempotency-key': 'snapshot-key' },
        body: { kind: 'x', title: 'x', message: 'x', recipients: [actor.employeeId] },
      },
      {
        method: 'POST',
        pathname: '/api/v1/attachments',
        body: { name: 'x', mimeType: 'text/plain', size: 1, checksum: 'x' },
      },
      {
        method: 'PUT',
        pathname: `/api/v1/attachments/${attachmentId}/content`,
        body: { contentBase64: 'WA==' },
      },
      {
        method: 'POST',
        pathname: `/api/v1/attachments/${attachmentId}/bindings`,
        body: { objectType: 'employee', objectId: actor.employeeId },
      },
      {
        method: 'DELETE',
        pathname: `/api/v1/attachments/${attachmentId}/bindings`,
        body: { objectType: 'employee', objectId: actor.employeeId },
      },
      { method: 'GET', pathname: `/api/v1/attachments/${attachmentId}` },
      { method: 'DELETE', pathname: `/api/v1/attachments/${attachmentId}`, body: { version: 1 } },
      { method: 'GET', pathname: '/api/v1/business-objects' },
      {
        method: 'POST',
        pathname: '/api/v1/business-objects',
        body: { code: 'X', name: 'X', schema: { fields: [] } },
      },
      {
        method: 'POST',
        pathname: `/api/v1/business-objects/${definitionId}/versions`,
        body: { schema: { fields: [] } },
      },
      {
        method: 'POST',
        pathname: `/api/v1/business-objects/${definitionId}/versions/1/publish`,
        body: {},
      },
      { method: 'GET', pathname: `/api/v1/business-objects/${definitionId}` },
      { method: 'GET', pathname: '/api/v1/operations/events' },
      {
        method: 'POST',
        pathname: '/api/v1/operations/events/claims',
        body: { consumer: 'c', worker: 'w' },
      },
      {
        method: 'POST',
        pathname: `/api/v1/operations/events/${eventId}/complete`,
        body: { consumer: 'c', claimToken: token },
      },
    ];
    for (const request of requests) {
      const response = await app.dispatch({
        ...request,
        headers: { authorization: 'Bearer token', ...request.headers },
      });
      expect(response.statusCode, `${request.method} ${request.pathname}`).toBeGreaterThanOrEqual(
        200,
      );
      expect(response.statusCode, `${request.method} ${request.pathname}`).toBeLessThan(300);
      expect(response.headers?.['x-correlation-id']).toMatch(UUID_PATTERN);
    }
    expect(notifications.list).toHaveBeenCalledWith(actor, true);
    expect(events.complete).toHaveBeenCalledWith(eventId, actor, 'c', token);
  });

  it('preserves 401/403/validation/404/409/500 envelopes and correlation id', async () => {
    const correlationId = randomUUID();
    const unauthenticated = buildApp({
      ...base,
      auth: {
        ...auth,
        authenticate: vi.fn(() => Promise.resolve(null)),
      } as unknown as ApiDependencies['auth'],
    });
    const unauthorized = await unauthenticated.dispatch({
      method: 'GET',
      pathname: '/api/v1/notifications',
      headers: { 'x-correlation-id': correlationId },
    });
    expect(unauthorized.statusCode).toBe(401);
    expect(unauthorized.headers?.['x-correlation-id']).toBe(correlationId);

    const forbidden = buildApp({
      ...base,
      auth: {
        ...auth,
        authenticate: vi.fn(() => Promise.resolve({ actor, permissions: new Map() })),
      } as unknown as ApiDependencies['auth'],
    });
    expect(
      (
        await forbidden.dispatch({
          method: 'GET',
          pathname: '/api/v1/notifications',
          headers: { authorization: 'Bearer token' },
        })
      ).statusCode,
    ).toBe(403);

    const notifications = {
      find: vi.fn(() => Promise.resolve(null)),
      setPreference: vi.fn(() => Promise.reject(new DomainError('conflict', 'stale'))),
    };
    const app = buildApp({
      ...base,
      notifications: notifications as unknown as NonNullable<ApiDependencies['notifications']>,
    });
    expect(
      (
        await app.dispatch({
          method: 'POST',
          pathname: '/api/v1/internal/notifications',
          headers: { authorization: 'Bearer token' },
          body: {},
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (
        await app.dispatch({
          method: 'GET',
          pathname: `/api/v1/notifications/${notificationId}`,
          headers: { authorization: 'Bearer token' },
        })
      ).statusCode,
    ).toBe(404);
    expect(
      (
        await app.dispatch({
          method: 'PUT',
          pathname: '/api/v1/notification-preferences',
          headers: { authorization: 'Bearer token' },
          body: { channel: 'IN_APP', enabled: true, expectedVersion: 0 },
        })
      ).statusCode,
    ).toBe(409);
    const failed = buildApp({
      ...base,
      notifications: {
        create: vi.fn(() => Promise.reject(new Error('boom'))),
      } as unknown as NonNullable<ApiDependencies['notifications']>,
    });
    expect(
      (
        await failed.dispatch({
          method: 'POST',
          pathname: '/api/v1/internal/notifications',
          headers: { authorization: 'Bearer token', 'idempotency-key': 'x' },
          body: { kind: 'x', title: 'x', message: 'x', recipients: [actor.employeeId] },
        })
      ).statusCode,
    ).toBe(500);
    const invalidRequests = [
      {
        method: 'PUT',
        pathname: '/api/v1/notification-preferences',
        body: { channel: 'WEBHOOK', enabled: true, expectedVersion: 0 },
      },
      { method: 'POST', pathname: '/api/v1/internal/notifications', body: { kind: 'x' } },
      {
        method: 'POST',
        pathname: '/api/v1/attachments',
        body: { name: 'x', mimeType: 'x', size: 0, checksum: 'x' },
      },
      {
        method: 'PUT',
        pathname: `/api/v1/attachments/${attachmentId}/content`,
        body: { contentBase64: '%%%' },
      },
      {
        method: 'POST',
        pathname: `/api/v1/attachments/${attachmentId}/bindings`,
        body: { objectType: 'employee', objectId: 'bad' },
      },
      {
        method: 'DELETE',
        pathname: `/api/v1/attachments/${attachmentId}/bindings`,
        body: { objectType: 'employee', objectId: 'bad' },
      },
      { method: 'DELETE', pathname: `/api/v1/attachments/${attachmentId}`, body: { version: 0 } },
      { method: 'POST', pathname: '/api/v1/business-objects', body: { code: 'X' } },
      {
        method: 'POST',
        pathname: `/api/v1/business-objects/${definitionId}/versions`,
        body: { unexpected: true },
      },
      {
        method: 'POST',
        pathname: '/api/v1/operations/events/claims',
        body: { consumer: 'c', worker: 'w', limit: 0 },
      },
      {
        method: 'POST',
        pathname: `/api/v1/operations/events/${eventId}/complete`,
        body: { consumer: 'c', claimToken: 'bad' },
      },
    ];
    for (const request of invalidRequests) {
      const response = await app.dispatch({
        ...request,
        headers: { authorization: 'Bearer token', 'idempotency-key': 'invalid-key' },
      });
      expect(response.statusCode, `${request.method} ${request.pathname}`).toBe(400);
      expect(response.body).toMatchObject({ error: { code: 'invalid_request' } });
      expect(
        (response.body as { error: { message: string } }).error.message.length,
      ).toBeGreaterThan(0);
    }
  });
});

const UUID_PATTERN = /^[0-9a-f-]{36}$/u;
