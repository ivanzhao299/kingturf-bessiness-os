import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { DomainError } from '@kingturf/domain';
import { buildApp, type ApiDependencies } from '../src/app.js';

const actor = { employeeId: randomUUID(), companyId: randomUUID() };
const attachmentAnchor = randomUUID();
const notificationAnchor = randomUUID();
const auth = {
  authenticate: vi.fn(() =>
    Promise.resolve({
      actor,
      permissions: new Map([
        ['event:operate', { scopes: ['COMPANY'], fields: null }],
        ['attachment:manage', { scopes: ['SELF'], fields: null }],
        ['notification:manage', { scopes: ['COMPANY'], fields: null }],
        ['business-object:manage', { scopes: ['COMPANY'], fields: null }],
      ]),
      scopeAnchors: new Map([
        ['attachment:manage', [{ scope: 'TEAM', organizationId: attachmentAnchor }]],
        ['notification:manage', [{ scope: 'TEAM', organizationId: notificationAnchor }]],
      ]),
    }),
  ),
  login: vi.fn(),
  logout: vi.fn(),
};
const base = {
  auth,
  organizations: {} as ApiDependencies['organizations'],
  employees: {} as ApiDependencies['employees'],
} as unknown as ApiDependencies;

describe('foundation secured API and telemetry', () => {
  it.each([
    ['GET', '/api/v1/notifications'],
    ['POST', '/api/v1/attachments'],
    ['GET', '/api/v1/operations/events'],
    ['GET', '/api/v1/business-objects'],
  ])('rejects unauthenticated E12-E15 access: %s %s', async (method, pathname) => {
    const authenticate = vi.fn(() => Promise.resolve(null));
    const response = await buildApp({
      ...base,
      auth: { ...auth, authenticate } as unknown as ApiDependencies['auth'],
    }).dispatch({ method, pathname, headers: {}, body: {} });
    expect(response.statusCode).toBe(401);
  });

  it('secures notification creation and binds tenant actor/idempotency context', async () => {
    const create = vi.fn((...arguments_: unknown[]) => {
      void arguments_;
      return Promise.resolve({ id: randomUUID() });
    });
    const response = await buildApp({
      ...base,
      notifications: { create } as unknown as NonNullable<ApiDependencies['notifications']>,
    }).dispatch({
      method: 'POST',
      pathname: '/api/v1/internal/notifications',
      headers: { authorization: 'Bearer token', 'idempotency-key': 'safe-key' },
      body: { kind: 'generic', title: 'Title', message: 'Message', recipients: [randomUUID()] },
    });
    expect(response.statusCode).toBe(201);
    expect(create.mock.calls[0]?.[1]).toEqual(actor);
    expect(create.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({ idempotencyKey: 'safe-key' }),
    );
    expect(create.mock.calls[0]?.[3]).toEqual(['COMPANY']);
    expect(create.mock.calls[0]?.[4]).toEqual([
      { scope: 'TEAM', organizationId: notificationAnchor },
    ]);
  });

  it('rejects invalid notification UUIDs, channels, and omitted preference versions', async () => {
    const create = vi.fn();
    const setPreference = vi.fn();
    const app = buildApp({
      ...base,
      notifications: { create, setPreference } as unknown as NonNullable<
        ApiDependencies['notifications']
      >,
    });
    const invalidRecipient = await app.dispatch({
      method: 'POST',
      pathname: '/api/v1/internal/notifications',
      headers: { authorization: 'Bearer token', 'idempotency-key': 'safe-key' },
      body: { kind: 'generic', title: 'Title', message: 'Message', recipients: ['not-a-uuid'] },
    });
    const invalidChannel = await app.dispatch({
      method: 'PUT',
      pathname: '/api/v1/notification-preferences',
      headers: { authorization: 'Bearer token' },
      body: { channel: 'WEBHOOK', enabled: true, expectedVersion: 0 },
    });
    const omittedVersion = await app.dispatch({
      method: 'PUT',
      pathname: '/api/v1/notification-preferences',
      headers: { authorization: 'Bearer token' },
      body: { channel: 'IN_APP', enabled: true },
    });
    expect(invalidRecipient.statusCode).toBe(400);
    expect(invalidChannel.statusCode).toBe(400);
    expect(omittedVersion.statusCode).toBe(400);
    expect(create).not.toHaveBeenCalled();
    expect(setPreference).not.toHaveBeenCalled();
  });

  it('passes the explicit notification preference expected version and surfaces stale writes', async () => {
    const setPreference = vi
      .fn()
      .mockResolvedValueOnce({ channel: 'IN_APP', enabled: true, version: 1 })
      .mockRejectedValueOnce(new DomainError('conflict', 'Preference version conflict'));
    const app = buildApp({
      ...base,
      notifications: { setPreference } as unknown as NonNullable<ApiDependencies['notifications']>,
    });
    const request = (expectedVersion: number) =>
      app.dispatch({
        method: 'PUT',
        pathname: '/api/v1/notification-preferences',
        headers: { authorization: 'Bearer token' },
        body: { channel: 'IN_APP', enabled: true, expectedVersion },
      });
    expect((await request(0)).statusCode).toBe(200);
    expect(setPreference.mock.calls[0]?.[2]).toBe(0);
    expect((await request(0)).statusCode).toBe(409);
  });

  it('returns forbidden when notification recipients fail the AuthorizedQuery DataScope', async () => {
    const create = vi.fn(
      (_input: unknown, _actor: unknown, _correlationId: unknown, scopes: readonly string[]) => {
        expect(scopes).toEqual(['SELF']);
        return Promise.reject(
          new DomainError(
            'forbidden',
            'One or more notification recipients are outside the granted data scope',
          ),
        );
      },
    );
    const restrictedAuth = {
      ...auth,
      authenticate: vi.fn(() =>
        Promise.resolve({
          actor,
          permissions: new Map([['notification:manage', { scopes: ['SELF'], fields: null }]]),
        }),
      ),
    };
    const response = await buildApp({
      ...base,
      auth: restrictedAuth as unknown as ApiDependencies['auth'],
      notifications: { create } as unknown as NonNullable<ApiDependencies['notifications']>,
    }).dispatch({
      method: 'POST',
      pathname: '/api/v1/internal/notifications',
      headers: { authorization: 'Bearer token', 'idempotency-key': 'restricted-key' },
      body: { kind: 'generic', title: 'Title', message: 'Message', recipients: [randomUUID()] },
    });
    expect(response.statusCode).toBe(403);
    expect(create).toHaveBeenCalledOnce();
  });

  it('returns a conflict envelope for notification idempotency-key payload reuse', async () => {
    const create = vi.fn(() =>
      Promise.reject(
        new DomainError(
          'conflict',
          'Idempotency key was already used for a different notification',
        ),
      ),
    );
    const response = await buildApp({
      ...base,
      notifications: { create } as unknown as NonNullable<ApiDependencies['notifications']>,
    }).dispatch({
      method: 'POST',
      pathname: '/api/v1/internal/notifications',
      headers: { authorization: 'Bearer token', 'idempotency-key': 'reused-key' },
      body: { kind: 'generic', title: 'Changed', message: 'Message', recipients: [randomUUID()] },
    });
    expect(response.statusCode).toBe(409);
    expect(response.body).toMatchObject({
      error: { code: 'conflict' },
    });
  });

  it('returns the advanced business-object definition revision from mutations', async () => {
    const definitionId = randomUUID();
    const afterAdd = { id: definitionId, version: 2, versions: [{ version: 1 }, { version: 2 }] };
    const afterPublish = {
      id: definitionId,
      version: 3,
      versions: [{ version: 1, status: 'PUBLISHED' }, { version: 2 }],
    };
    const addVersion = vi.fn(() => Promise.resolve(afterAdd));
    const publish = vi.fn(() => Promise.resolve(afterPublish));
    const app = buildApp({
      ...base,
      businessObjects: { addVersion, publish } as unknown as NonNullable<
        ApiDependencies['businessObjects']
      >,
    });
    const added = await app.dispatch({
      method: 'POST',
      pathname: `/api/v1/business-objects/${definitionId}/versions`,
      headers: { authorization: 'Bearer token' },
      body: { schema: { fields: [] } },
    });
    const published = await app.dispatch({
      method: 'POST',
      pathname: `/api/v1/business-objects/${definitionId}/versions/1/publish`,
      headers: { authorization: 'Bearer token' },
      body: {},
    });
    expect(added).toMatchObject({ statusCode: 201, body: afterAdd });
    expect(published).toMatchObject({ statusCode: 200, body: afterPublish });
  });

  it('passes attachment DataScope to object authorization and validates registry input', async () => {
    const bind = vi.fn((...arguments_: unknown[]) => {
      void arguments_;
      return Promise.resolve();
    });
    const attachmentId = randomUUID(),
      objectId = randomUUID();
    const bound = await buildApp({
      ...base,
      attachments: { bind } as unknown as NonNullable<ApiDependencies['attachments']>,
    }).dispatch({
      method: 'POST',
      pathname: `/api/v1/attachments/${attachmentId}/bindings`,
      headers: { authorization: 'Bearer token' },
      body: { objectType: 'employee', objectId },
    });
    expect(bound.statusCode).toBe(204);
    expect(bind.mock.calls[0]?.[4]).toEqual(['SELF']);
    expect(bind.mock.calls[0]?.[5]).toEqual([{ scope: 'TEAM', organizationId: attachmentAnchor }]);
    expect(bind.mock.calls[0]?.slice(1, 3)).toEqual(['employee', objectId]);

    const rejectedBind = vi.fn(() =>
      Promise.reject(new DomainError('not_found', 'Bindable object not found')),
    );
    const unknown = await buildApp({
      ...base,
      attachments: { bind: rejectedBind } as unknown as NonNullable<ApiDependencies['attachments']>,
    }).dispatch({
      method: 'POST',
      pathname: `/api/v1/attachments/${attachmentId}/bindings`,
      headers: { authorization: 'Bearer token' },
      body: { objectType: 'unknown_type', objectId },
    });
    expect(unknown).toMatchObject({ statusCode: 404, body: { error: { code: 'not_found' } } });

    const create = vi.fn((...arguments_: unknown[]) => {
      void arguments_;
      return Promise.resolve({ id: randomUUID() });
    });
    const registry = await buildApp({
      ...base,
      businessObjects: { create } as unknown as NonNullable<ApiDependencies['businessObjects']>,
    }).dispatch({
      method: 'POST',
      pathname: '/api/v1/business-objects',
      headers: { authorization: 'Bearer token' },
      body: { code: 'GENERIC', name: 'Generic', schema: { fields: [] } },
    });
    expect(registry.statusCode).toBe(201);
    expect(create.mock.calls[0]?.[3]).toEqual(actor);
  });

  it('tenant-qualifies event metrics', async () => {
    const counts = vi.fn(() => Promise.resolve({ PENDING: 2 }));
    const response = await buildApp({
      ...base,
      events: { counts } as unknown as NonNullable<ApiDependencies['events']>,
    }).dispatch({
      method: 'GET',
      pathname: '/api/v1/operations/events',
      headers: { authorization: 'Bearer token' },
    });
    expect(response.statusCode).toBe(200);
    expect(counts).toHaveBeenCalledWith(actor.companyId);
  });

  it('secures and tenant-qualifies event claim, completion, retry, and dead-letter operations', async () => {
    const eventId = randomUUID(),
      claimToken = randomUUID();
    const claim = vi.fn(() => Promise.resolve([]));
    const complete = vi.fn(() => Promise.resolve());
    const fail = vi.fn(() => Promise.resolve());
    const app = buildApp({
      ...base,
      events: { claim, complete, fail } as unknown as NonNullable<ApiDependencies['events']>,
    });
    expect(
      (
        await app.dispatch({
          method: 'POST',
          pathname: '/api/v1/operations/events/claims',
          headers: { authorization: 'Bearer token' },
          body: { consumer: 'projection', worker: 'worker-1', limit: 10, leaseSeconds: 30 },
        })
      ).statusCode,
    ).toBe(200);
    expect(claim).toHaveBeenCalledWith(actor, 'projection', 'worker-1', 10, 30);
    for (const action of ['complete', 'retry', 'dead-letter'] as const) {
      const response = await app.dispatch({
        method: 'POST',
        pathname: `/api/v1/operations/events/${eventId}/${action}`,
        headers: { authorization: 'Bearer token' },
        body: {
          consumer: 'projection',
          claimToken,
          ...(action === 'complete' ? {} : { errorCode: 'handler_failed', maxAttempts: 5 }),
        },
      });
      expect(response.statusCode).toBe(204);
    }
    expect(complete).toHaveBeenCalledWith(eventId, actor, 'projection', claimToken);
    expect(fail).toHaveBeenNthCalledWith(
      1,
      eventId,
      actor,
      'projection',
      claimToken,
      'handler_failed',
      5,
    );
    expect(fail).toHaveBeenNthCalledWith(
      2,
      eventId,
      actor,
      'projection',
      claimToken,
      'handler_failed',
      1,
    );
  });

  it('centralizes oversized request correlation, telemetry, and safe logging', () => {
    const count = vi.fn(),
      timing = vi.fn(),
      write = vi.fn();
    const incoming = randomUUID();
    const response = buildApp({
      ...base,
      telemetry: { count, timing },
      logger: { write },
    }).rejectOversized(incoming);
    expect(response.statusCode).toBe(413);
    expect(response.headers?.['x-correlation-id']).toBe(incoming);
    expect((response.body as { error: { correlationId: string } }).error.correlationId).toBe(
      incoming,
    );
    expect(count).toHaveBeenCalledWith(
      'http_requests_total',
      1,
      expect.objectContaining({ status: '413' }),
    );
    expect(timing).toHaveBeenCalled();
    expect(write).toHaveBeenCalledWith(expect.objectContaining({ correlationId: incoming }));
  });

  it('rejects oversized and non-canonical base64 before repository upload', async () => {
    const upload = vi.fn();
    const app = buildApp({
      ...base,
      attachments: { upload } as unknown as NonNullable<ApiDependencies['attachments']>,
    });
    const call = (contentBase64: string) =>
      app.dispatch({
        method: 'PUT',
        pathname: `/api/v1/attachments/${randomUUID()}/content`,
        headers: { authorization: 'Bearer token' },
        body: { contentBase64 },
      });
    expect((await call('%%%%')).statusCode).toBe(400);
    expect((await call('A'.repeat(34_952_537))).statusCode).toBe(400);
    expect(upload).not.toHaveBeenCalled();
  });

  it('emits bounded labels and structured correlation logs without payload leakage', async () => {
    const count = vi.fn(),
      timing = vi.fn(),
      write = vi.fn();
    const secret = 'do-not-log-this';
    const response = await buildApp({
      ...base,
      auth: {
        ...auth,
        login: vi.fn(() => Promise.reject(new Error(secret))),
      } as unknown as ApiDependencies['auth'],
      telemetry: { count, timing },
      logger: { write },
    }).dispatch({
      method: 'POST',
      pathname: '/api/v1/auth/login',
      headers: { 'x-correlation-id': randomUUID() },
      body: { login: 'user', password: secret },
    });
    expect(count).toHaveBeenCalledWith(
      'http_requests_total',
      1,
      expect.objectContaining({ route: 'api' }),
    );
    expect(timing).toHaveBeenCalled();
    expect(write).toHaveBeenCalled();
    expect(JSON.stringify([count.mock.calls, timing.mock.calls, write.mock.calls])).not.toContain(
      secret,
    );
    expect(response.statusCode).toBe(500);
    expect(JSON.stringify(response.body)).not.toContain(secret);
    expect(response.headers?.['x-correlation-id']).toMatch(/^[0-9a-f-]{36}$/u);
  });
});
