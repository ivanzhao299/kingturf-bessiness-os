// Frozen against 3528fb4's inline audit list/detail routes, before extraction.
import { describe, expect, it, vi } from 'vitest';
import { DomainError, type AuthorizationContext, type ScopeAnchor } from '@kingturf/domain';
import type { AuditEventDto, DataScope } from '@kingturf/types';
import { buildApp, type ApiDependencies, type ApiRequest } from '../src/app.js';

type Audit = NonNullable<ApiDependencies['audit']>;
type Grant = NonNullable<ReturnType<AuthorizationContext['permissions']['get']>>;
const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const second = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const correlationId = '33333333-3333-4333-8333-333333333333';
const actor = { companyId: 'tenant-a', employeeId: second };
const base = '/api/v1/audit-events';
const found: AuditEventDto = {
  id,
  occurredAt: '2026-10-01T00:00:00.000Z',
  action: 'repository.raw',
  outcome: 'SUCCESS',
  actorId: second,
  tenantId: actor.companyId,
  targetType: 'raw-target',
  targetId: id,
  correlationId,
  metadata: { private: 'not projected', nested: { retained: true } },
};
const listed = { items: [found], nextCursor: second, extra: 'repository-owned' };
function fixture(
  grant: Grant | null = { scopes: ['COMPANY'], fields: null },
  available = true,
  anchors: readonly ScopeAnchor[] = [],
) {
  const permissions: AuthorizationContext['permissions'] = new Map(
    grant ? [['audit:read', grant]] : [],
  );
  const get = vi.spyOn(permissions, 'get');
  const context: AuthorizationContext = {
    actor,
    permissions,
    scopeAnchors: new Map([['audit:read', anchors]]),
  };
  const repository = {
    find: vi.fn<Audit['find']>().mockResolvedValue(found),
    list: vi.fn<Audit['list']>().mockResolvedValue(listed),
  };
  const app = buildApp({
    auth: {
      authenticate: vi.fn().mockResolvedValue(context),
    } as unknown as ApiDependencies['auth'],
    organizations: {} as ApiDependencies['organizations'],
    employees: {} as ApiDependencies['employees'],
    ...(available ? { audit: repository as unknown as Audit } : {}),
  });
  const dispatch = (pathname = base, options: Partial<ApiRequest> = {}) =>
    app.dispatch({
      method: 'GET',
      pathname,
      body: null,
      ...options,
      headers: {
        authorization: 'Bearer fixture',
        'x-correlation-id': correlationId,
        'idempotency-key': 'x'.repeat(201),
        ...options.headers,
      },
    });
  return { repository, dispatch, get };
}
const response = (statusCode: number, body: unknown) => ({
  statusCode,
  body,
  headers: {
    'x-correlation-id': correlationId,
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'SAMEORIGIN',
    'referrer-policy': 'strict-origin-when-cross-origin',

    'content-security-policy-report-only':
      "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'self'",
  },
});
const error = (statusCode: number, code: string, message: string) =>
  response(statusCode, { error: { code, message, correlationId } });
const denied = error(403, 'forbidden', 'Permission denied');
const unavailable = error(503, 'internal_error', 'Audit repository unavailable');
const missing = error(404, 'not_found', 'Route not found');
const noCalls = (f: ReturnType<typeof fixture>) => {
  expect(f.repository.find).not.toHaveBeenCalled();
  expect(f.repository.list).not.toHaveBeenCalled();
};

describe('old inline audit read contracts', () => {
  it('returns the exact list object, five parameters and original receiver', async () => {
    const f = fixture();
    const actual = await f.dispatch();
    expect(actual).toEqual(response(200, listed));
    expect(actual.body).toBe(listed);
    expect(f.repository.list).toHaveBeenCalledExactlyOnceWith(
      actor.companyId,
      {},
      ['COMPANY'],
      second,
      [],
    );
    expect(f.repository.list.mock.contexts).toEqual([f.repository]);
    expect(f.repository.find).not.toHaveBeenCalled();
  });
  it('returns the exact detail DTO, five parameters and original receiver', async () => {
    const f = fixture();
    const actual = await f.dispatch(`${base}/${id}`);
    expect(actual).toEqual(response(200, found));
    expect(actual.body).toBe(found);
    expect(f.repository.find).toHaveBeenCalledExactlyOnceWith(
      id,
      actor.companyId,
      ['COMPANY'],
      second,
      [],
    );
    expect(f.repository.find.mock.contexts).toEqual([f.repository]);
    expect(f.repository.list).not.toHaveBeenCalled();
  });
  it('retains an empty repository page and null cursor without wrapping', async () => {
    const f = fixture();
    const empty = { items: [], nextCursor: null };
    f.repository.list.mockResolvedValue(empty);
    expect((await f.dispatch()).body).toBe(empty);
  });
  it('uses the dedicated detail not-found envelope', async () => {
    const f = fixture();
    f.repository.find.mockResolvedValue(null);
    expect(await f.dispatch(`${base}/${id}`)).toEqual(
      error(404, 'not_found', 'Audit event not found'),
    );
    expect(f.repository.find).toHaveBeenCalledTimes(1);
  });
  it.each([{ fields: null }, { fields: [] }, { fields: ['id'] }] as const)(
    'does not request or project fields $fields',
    async ({ fields }) => {
      const f = fixture({ scopes: ['COMPANY'], fields });
      expect((await f.dispatch()).body).toBe(listed);
      expect((await f.dispatch(`${base}/${id}`)).body).toBe(found);
      expect(f.get.mock.calls.every(([capability]) => capability === 'audit:read')).toBe(true);
    },
  );
  it.each(['SELF', 'TEAM', 'DEPARTMENT', 'REGION', 'COMPANY', 'GROUP'] as const)(
    'forwards %s scope and anchors unchanged (mock wiring, not SQL proof)',
    async (scope) => {
      const scopes: readonly DataScope[] = [scope];
      const anchors: readonly ScopeAnchor[] = [{ scope, organizationId: 'anchor' }];
      const f = fixture({ scopes, fields: [] }, true, anchors);
      await f.dispatch();
      await f.dispatch(`${base}/${id}`);
      expect(f.repository.list.mock.calls[0]).toEqual([
        actor.companyId,
        {},
        scopes,
        second,
        anchors,
      ]);
      expect(f.repository.find.mock.calls[0]).toEqual([
        id,
        actor.companyId,
        scopes,
        second,
        anchors,
      ]);
      expect(f.repository.list.mock.calls[0]?.[2]).toBe(scopes);
      expect(f.repository.find.mock.calls[0]?.[4]).toBe(anchors);
    },
  );
  it.each([base, `${base}/${id}`, `${base}/a`])(
    'authorizes before missing repo or bad input at %s',
    async (pathname) => {
      const f = fixture(null, false);
      expect(await f.dispatch(pathname, { query: { actorId: 'bad' } })).toEqual(denied);
      noCalls(f);
    },
  );
  it.each([base, `${base}/${id}`])(
    'denies empty scopes before touching repo at %s',
    async (pathname) => {
      const f = fixture({ scopes: [], fields: null });
      expect(await f.dispatch(pathname)).toEqual(denied);
      noCalls(f);
    },
  );
  it.each([base, `${base}/${id}`, `${base}/a`])(
    'checks repo before list parsing/detail UUID at %s',
    async (pathname) => {
      const f = fixture(undefined, false);
      expect(await f.dispatch(pathname, { query: { actorId: 'bad', cursor: 'bad' } })).toEqual(
        unavailable,
      );
      noCalls(f);
    },
  );
  it('validates raw-matched detail UUID after auth/repo, ignores query', async () => {
    const f = fixture();
    expect(await f.dispatch(`${base}/a`, { query: { actorId: 'bad' } })).toEqual(
      error(400, 'invalid_request', 'auditEventId must be a UUID'),
    );
    noCalls(f);
  });
  it('uses truthy filter insertion order and preserves unvalidated raw values', async () => {
    const f = fixture();
    await f.dispatch(base, {
      query: {
        actorId: ` ${second.toUpperCase()} `,
        action: '  raw action  ',
        targetType: ' unknown ',
        targetId: id,
        correlationId,
        from: 'not a date',
        to: ' raw to ',
        cursor: second,
        limit: '2.5',
        ignored: 'bad',
      },
    });
    const filter = f.repository.list.mock.calls[0]?.[1];
    expect(filter).toEqual({
      actorId: second.toUpperCase(),
      action: '  raw action  ',
      targetType: ' unknown ',
      targetId: id,
      correlationId,
      from: 'not a date',
      to: ' raw to ',
      cursor: second,
      limit: 2.5,
    });
    expect(Object.keys(filter ?? {})).toEqual([
      'actorId',
      'action',
      'targetType',
      'targetId',
      'correlationId',
      'from',
      'to',
      'cursor',
      'limit',
    ]);
  });
  it.each([
    'actorId',
    'action',
    'targetType',
    'targetId',
    'correlationId',
    'from',
    'to',
    'cursor',
    'limit',
  ] as const)('omits empty/undefined %s instead of adding an own property', async (key) => {
    const f = fixture();
    await f.dispatch(base, { query: { [key]: '' } });
    await f.dispatch(base, { query: { [key]: undefined } });
    for (const call of f.repository.list.mock.calls) {
      expect(call[1]).toEqual({});
      expect(Object.hasOwn(call[1], key)).toBe(false);
    }
  });
  it.each(['actorId', 'targetId', 'correlationId', 'cursor'] as const)(
    '%s keeps UUID parse/trim errors',
    async (key) => {
      const f = fixture();
      expect(await f.dispatch(base, { query: { [key]: 'bad' } })).toEqual(
        error(400, 'invalid_request', `${key} must be a UUID`),
      );
      expect(await f.dispatch(base, { query: { [key]: ' ' } })).toEqual(
        error(400, 'invalid_request', `${key} is required`),
      );
      noCalls(f);
    },
  );
  it.each([
    {
      query: { actorId: 'bad', targetId: 'bad', correlationId: 'bad', cursor: 'bad' },
      first: 'actorId',
    },
    { query: { targetId: 'bad', correlationId: 'bad', cursor: 'bad' }, first: 'targetId' },
    { query: { correlationId: 'bad', cursor: 'bad' }, first: 'correlationId' },
    { query: { from: 'bad', to: 'bad', cursor: 'bad', limit: 'bad' }, first: 'cursor' },
  ])('keeps composite first error $first', async ({ query, first }) => {
    const f = fixture();
    expect(await f.dispatch(base, { query })).toEqual(
      error(400, 'invalid_request', `${first} must be a UUID`),
    );
    noCalls(f);
  });
  it.each([
    { raw: '0', value: 0 },
    { raw: ' ', value: 0 },
    { raw: '-2', value: -2 },
    { raw: '2.5', value: 2.5 },
    { raw: '0x10', value: 16 },
    { raw: '1e3', value: 1000 },
    { raw: 'Infinity', value: Infinity },
    { raw: '-Infinity', value: -Infinity },
    { raw: 'NaN', value: NaN },
    { raw: 'null', value: NaN },
    { raw: 'bad', value: NaN },
  ])('forwards Number(limit=$raw) without HTTP bounds', async ({ raw, value }) => {
    const f = fixture();
    expect(await f.dispatch(base, { query: { limit: raw } })).toEqual(response(200, listed));
    const filter = f.repository.list.mock.calls[0]?.[1];
    expect(filter).toEqual({ limit: value });
    expect(Object.hasOwn(filter ?? {}, 'limit')).toBe(true);
  });
  it('treats runtime null query as empty via original nullish fallback', async () => {
    const f = fixture();
    await f.dispatch(base, { query: null as unknown as NonNullable<ApiRequest['query']> });
    expect(f.repository.list.mock.calls[0]?.[1]).toEqual({});
  });
  it.each([base, `${base}/${id}`])(
    'ignores arbitrary body/header/unknown query at %s',
    async (pathname) => {
      const f = fixture();
      const actual = await f.dispatch(pathname, {
        body: ['bad'],
        query: { unknown: 'bad', ...(pathname !== base ? { actorId: 'bad', limit: 'bad' } : {}) },
      });
      expect(actual).toEqual(response(200, pathname === base ? listed : found));
    },
  );
  it.each([
    { pathname: base, method: 'POST' },
    { pathname: base, method: 'PATCH' },
    { pathname: `${base}/${id}`, method: 'DELETE' },
    { pathname: `${base}/${id}`, method: 'get' },
    { pathname: `${base}/`, method: 'GET' },
    { pathname: `${base}//`, method: 'GET' },
    { pathname: `${base}/${id}/extra`, method: 'GET' },
    { pathname: `${base}/${id.toUpperCase()}`, method: 'GET' },
    { pathname: `${base}/not-uuid`, method: 'GET' },
    { pathname: '/api/v1/Audit-events', method: 'GET' },
  ])(
    'keeps unsupported $method $pathname 404 even without grant/repo',
    async ({ pathname, method }) => {
      const f = fixture(null, false);
      expect(await f.dispatch(pathname, { method })).toEqual(missing);
      noCalls(f);
    },
  );
  it.each([base, `${base}/a`, `${base}/extra`])(
    'global session401 precedes path/auth/repo at %s',
    async (pathname) => {
      const f = fixture(null, false);
      expect(await f.dispatch(pathname, { headers: { authorization: '' } })).toEqual(
        error(401, 'authentication_required', 'A valid session is required'),
      );
      noCalls(f);
    },
  );
  it('propagates original repository DomainError without changing envelope', async () => {
    const f = fixture();
    f.repository.find.mockRejectedValue(new DomainError('conflict', 'repository fixture conflict'));
    expect(await f.dispatch(`${base}/${id}`)).toEqual(
      error(409, 'conflict', 'repository fixture conflict'),
    );
  });
});
