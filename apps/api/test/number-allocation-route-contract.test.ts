// Fixed against 40c2a01's inline allocate route, before extraction.
import { describe, expect, it, vi } from 'vitest';
import { DomainError, type AuthorizationContext } from '@kingturf/domain';
import type { PermissionKey } from '@kingturf/types';
import { buildApp, type ApiDependencies, type ApiRequest } from '../src/app.js';

type Numbers = NonNullable<ApiDependencies['numbers']>;
type Grant = NonNullable<ReturnType<AuthorizationContext['permissions']['get']>>;
const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const correlationId = '33333333-3333-4333-8333-333333333333';
const nextCorrelation = '44444444-4444-4444-8444-444444444444';
const actor = { companyId: 'allocation-tenant', employeeId: id };
const base = '/api/v1/number-definitions';
const pathname = `${base}/${id}/allocate`;
const row = {
  id: 'issued-fixture',
  definitionVersionId: id,
  period: 'NEVER',
  sequence: 1,
  value: 'N-0001',
  requesterId: id,
  correlationId,
  issuedAt: '2026-10-14T00:00:00.000Z',
  private: { retained: true },
};
function fixture(
  options: {
    denied?: boolean;
    emptyScope?: boolean;
    available?: boolean;
    fields?: Grant['fields'];
  } = {},
) {
  const permissions = new Map<PermissionKey, Grant>([
    ['number:read', { scopes: ['TEAM'], fields: null }],
    ...(options.denied
      ? []
      : [
          [
            'number:allocate',
            {
              scopes: options.emptyScope ? [] : ['TEAM'],
              fields: options.fields === undefined ? null : options.fields,
            },
          ] as [PermissionKey, Grant],
        ]),
  ]);
  const context: AuthorizationContext = {
    actor,
    permissions,
    scopeAnchors: new Map([
      ['number:allocate', [{ scope: 'TEAM', organizationId: 'not-forwarded' }]],
    ]),
  };
  const get = vi.spyOn(permissions, 'get');
  const repository = {
    allocate: vi.fn<Numbers['allocate']>().mockResolvedValue(row),
    list: vi.fn<Numbers['list']>().mockResolvedValue([]),
    createDefinition: vi
      .fn<Numbers['createDefinition']>()
      .mockResolvedValue({ id, version: undefined }),
    publish: vi.fn<Numbers['publish']>().mockResolvedValue({ id: 'publish-neighbor' }),
    createVersion: vi.fn<Numbers['createVersion']>().mockResolvedValue({ id }),
  };
  const rules = { list: vi.fn().mockResolvedValue([{ id: 'rule-neighbor' }]) };
  const app = buildApp({
    auth: {
      authenticate: vi.fn().mockResolvedValue(context),
    } as unknown as ApiDependencies['auth'],
    organizations: {} as ApiDependencies['organizations'],
    employees: {} as ApiDependencies['employees'],
    ...(options.available === false ? {} : { numbers: repository as unknown as Numbers }),
    rules: rules as unknown as NonNullable<ApiDependencies['rules']>,
  });
  const dispatch = (options: Partial<ApiRequest> = {}) =>
    app.dispatch({
      method: 'POST',
      pathname,
      body: { unknown: true, idempotencyKey: 'ignored-body-key' },
      query: { version: 'bad', idempotencyKey: 'ignored-query-key' },
      ...options,
      headers: {
        authorization: 'Bearer fixture',
        'x-correlation-id': correlationId,
        'idempotency-key': 'raw-key',
        ...options.headers,
      },
    });
  return { repository, rules, permissions, get, dispatch };
}
const response = (statusCode: number, body: unknown) => ({
  statusCode,
  body,
  headers: {
    'x-correlation-id': correlationId,
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'SAMEORIGIN',
    'referrer-policy': 'strict-origin-when-cross-origin',
  },
});
const error = (statusCode: number, code: string, message: string) =>
  response(statusCode, {
    error: { code, message, correlationId },
  });
const invalid = (message: string) => error(400, 'invalid_request', message);
const denied = error(403, 'forbidden', 'Permission denied');
const unavailable = error(503, 'internal_error', 'Number repository unavailable');
const missing = error(404, 'not_found', 'Route not found');
const keyRequired = invalid('Idempotency-Key header is required');
const noCalls = (f: ReturnType<typeof fixture>) => {
  for (const mock of Object.values(f.repository)) expect(mock).not.toHaveBeenCalled();
};

describe('old number allocation contracts', () => {
  it.each([
    { denied: true, available: true },
    { denied: true, available: false },
    { emptyScope: true, available: true },
    { emptyScope: true, available: false },
  ])('Q0 precedes dependency/key/UUID for %j', async (options) => {
    const f = fixture(options);
    expect(
      await f.dispatch({ pathname: `${base}/a/allocate`, headers: { 'idempotency-key': '' } }),
    ).toEqual(denied);
    noCalls(f);
  });
  it('read grant alone is insufficient', async () => {
    const f = fixture({ denied: true });
    expect(await f.dispatch()).toEqual(denied);
    noCalls(f);
  });
  it.each([{ key: undefined }, { key: '' }, { key: 'x'.repeat(201) }])(
    'authorized missing repo precedes key $key and bad UUID',
    async ({ key }) => {
      const f = fixture({ available: false });
      expect(
        await f.dispatch({ pathname: `${base}/a/allocate`, headers: { 'idempotency-key': key } }),
      ).toEqual(unavailable);
      noCalls(f);
    },
  );
  it('global401 precedes permission/repo/key/UUID', async () => {
    const f = fixture({ denied: true, available: false });
    expect(
      await f.dispatch({
        pathname: `${base}/a/allocate`,
        headers: { authorization: '', 'idempotency-key': '' },
      }),
    ).toEqual(error(401, 'authentication_required', 'A valid session is required'));
    noCalls(f);
  });
  it.each([{ fields: null }, { fields: [] }, { fields: ['unrelated-field'] }] as const)(
    'Q0 $fields does not project or forward scopes/anchors',
    async ({ fields }) => {
      const f = fixture({ fields });
      const actual = await f.dispatch();
      expect(actual).toEqual(response(201, row));
      expect(actual.body).toBe(row);
      expect(f.repository.allocate).toHaveBeenCalledExactlyOnceWith(
        id,
        'raw-key',
        actor,
        correlationId,
      );
      expect(f.repository.allocate.mock.contexts).toEqual([f.repository]);
      expect(f.repository.allocate.mock.calls[0]?.length).toBe(4);
      expect(f.repository.allocate.mock.calls[0]?.[2]).toBe(actor);
      expect(f.get.mock.calls.every(([capability]) => capability === 'number:allocate')).toBe(true);
      expect(f.repository.list).not.toHaveBeenCalled();
      expect(f.repository.publish).not.toHaveBeenCalled();
    },
  );
  it('allocate needs no number:read grant', async () => {
    const f = fixture();
    f.permissions.delete('number:read');
    expect((await f.dispatch()).body).toBe(row);
  });
  it.each([undefined, ''])('missing/empty key %j precedes bad UUID', async (key) => {
    const f = fixture();
    expect(
      await f.dispatch({ pathname: `${base}/a/allocate`, headers: { 'idempotency-key': key } }),
    ).toEqual(keyRequired);
    noCalls(f);
  });
  it.each([undefined, ''])('body/query cannot replace header %j', async (key) => {
    const f = fixture();
    expect(await f.dispatch({ headers: { 'idempotency-key': key } })).toEqual(keyRequired);
    noCalls(f);
  });
  it('capitalized header name is not a fallback in buildApp input protocol', async () => {
    const f = fixture();
    expect(
      await f.dispatch({
        headers: { 'idempotency-key': undefined, 'Idempotency-Key': 'capitalized' },
      }),
    ).toEqual(keyRequired);
    noCalls(f);
  });
  it.each([1, 128, 129, 200, 201, 1024])(
    'raw key length %i reaches mock, not PG validity proof',
    async (length) => {
      const f = fixture();
      const key = 'x'.repeat(length);
      const actual = await f.dispatch({ headers: { 'idempotency-key': key } });
      expect(actual).toEqual(response(201, row));
      expect(actual.body).toBe(row);
      expect(f.repository.allocate).toHaveBeenCalledExactlyOnceWith(id, key, actor, correlationId);
    },
  );
  it.each([' ', '  ', ' raw key ', '!@#$%^&*()[]{}:/?=中文'])(
    'nonempty key %j is not trimmed or format checked',
    async (key) => {
      const f = fixture();
      expect((await f.dispatch({ headers: { 'idempotency-key': key } })).body).toBe(row);
      expect(f.repository.allocate).toHaveBeenCalledExactlyOnceWith(id, key, actor, correlationId);
    },
  );
  it.each(['a', '---', 'aaaaaaaa-aaaa-0aaa-8aaa-aaaaaaaaaaaa'])(
    'raw match %s with nonempty long key reaches UUID before repo',
    async (rawId) => {
      const f = fixture();
      expect(
        await f.dispatch({
          pathname: `${base}/${rawId}/allocate`,
          headers: { 'idempotency-key': 'x'.repeat(201) },
        }),
      ).toEqual(invalid('definitionId must be a UUID'));
      noCalls(f);
    },
  );
  it.each([
    { value: undefined },
    { value: null },
    { value: false },
    { value: 1 },
    { value: '' },
    { value: 'body' },
    { value: [] },
    { value: { version: 'bad', idempotencyKey: '', unknown: true } },
  ])('body $value is ignored without object/allow', async ({ value }) => {
    const f = fixture();
    expect((await f.dispatch({ body: value })).body).toBe(row);
    expect(f.repository.allocate).toHaveBeenCalledExactlyOnceWith(
      id,
      'raw-key',
      actor,
      correlationId,
    );
  });
  it('body getters and unknown query/header are ignored', async () => {
    const f = fixture();
    const getter = vi.fn(() => {
      throw new Error('Body must not be read');
    });
    const body = Object.defineProperty({}, 'idempotencyKey', { enumerable: true, get: getter });
    expect(
      (
        await f.dispatch({
          body,
          query: { id: 'a', at: 'bad', version: 'NaN', now: 'bad' },
          headers: { unknown: 'extra' },
        })
      ).body,
    ).toBe(row);
    expect(getter).not.toHaveBeenCalled();
    expect(f.repository.allocate).toHaveBeenCalledExactlyOnceWith(
      id,
      'raw-key',
      actor,
      correlationId,
    );
  });
  it.each([
    { method: 'GET', pathname },
    { method: 'PATCH', pathname },
    { method: 'DELETE', pathname },
    { method: 'post', pathname },
    { method: 'POST', pathname: `${base}/allocate` },
    { method: 'POST', pathname: `${base}//allocate` },
    { method: 'POST', pathname: `${base}/${id.toUpperCase()}/allocate` },
    { method: 'POST', pathname: `${pathname}/extra` },
    { method: 'POST', pathname: `${pathname}/` },
    { method: 'POST', pathname: `${base}/not-uuid/allocate` },
    { method: 'POST', pathname: `${base}/ ${id} /allocate` },
  ])('unsupported $method $pathname stays404 with missingrepo', async (request) => {
    const f = fixture({ available: false, emptyScope: true });
    expect(await f.dispatch({ ...request, headers: { 'idempotency-key': '' } })).toEqual(missing);
    noCalls(f);
  });
  it('same HTTP key forwards twice; mock identity is not real replay proof', async () => {
    const f = fixture();
    const first = await f.dispatch();
    const second = await f.dispatch({ headers: { 'x-correlation-id': nextCorrelation } });
    expect(first.body).toBe(row);
    expect(second.body).toBe(row);
    expect(f.repository.allocate.mock.calls).toEqual([
      [id, 'raw-key', actor, correlationId],
      [id, 'raw-key', actor, nextCorrelation],
    ]);
    expect(f.repository.allocate.mock.contexts).toEqual([f.repository, f.repository]);
  });
  it.each([
    { code: 'invalid_request', status: 400, message: 'A bounded idempotency key is required' },
    { code: 'not_found', status: 404, message: 'Published number definition not found' },
    { code: 'conflict', status: 409, message: 'Number allocation failed' },
  ] as const)(
    'repository $code passes through (mock error, not PG proof)',
    async ({ code, status, message }) => {
      const f = fixture();
      f.repository.allocate.mockRejectedValue(new DomainError(code, message));
      expect(await f.dispatch()).toEqual(error(status, code, message));
      expect(f.repository.allocate).toHaveBeenCalledExactlyOnceWith(
        id,
        'raw-key',
        actor,
        correlationId,
      );
    },
  );
  it('keeps publish and rules positive, not in allocate group', async () => {
    const f = fixture();
    f.permissions.set('number:update', { scopes: ['SELF'], fields: null });
    f.permissions.set('rule:read', { scopes: ['SELF'], fields: null });
    expect(
      await f.dispatch({
        pathname: `${base}/${id}/publish`,
        body: { version: 1 },
        headers: { 'idempotency-key': '' },
      }),
    ).toEqual(response(200, { id: 'publish-neighbor' }));
    expect(f.repository.publish).toHaveBeenCalledExactlyOnceWith(id, 1, actor, correlationId);
    expect(await f.dispatch({ method: 'GET', pathname: '/api/v1/rules', body: null })).toEqual(
      response(200, { items: [{ id: 'rule-neighbor' }] }),
    );
    expect(f.rules.list).toHaveBeenCalledExactlyOnceWith(actor.companyId);
    expect(f.repository.allocate).not.toHaveBeenCalled();
  });
});
