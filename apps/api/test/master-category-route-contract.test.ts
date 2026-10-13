// Fixed against ca404d3's inline category routes, before any extraction.
import { describe, expect, it, vi } from 'vitest';
import { DomainError, type AuthorizationContext } from '@kingturf/domain';
import type { PermissionKey } from '@kingturf/types';
import { buildApp, type ApiDependencies, type ApiRequest } from '../src/app.js';

type Master = NonNullable<ApiDependencies['masterData']>;
type Grant = NonNullable<ReturnType<AuthorizationContext['permissions']['get']>>;
const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const correlationId = '33333333-3333-4333-8333-333333333333';
const actor = { companyId: 'category-tenant', employeeId: id };
const base = '/api/v1/master-data/categories';
const from = '2026-02-01T08:00:00+08:00';
const to = '2026-03-01';
const row = { id, version: 8, name: 'raw row', deleted_at: null, private: { retained: true } };
const rows = [row];
const routes = [
  { method: 'GET', capability: 'master-data:read', pathname: base },
  { method: 'POST', capability: 'master-data:create', pathname: base },
  { method: 'PATCH', capability: 'master-data:update', pathname: `${base}/${id}` },
  { method: 'DELETE', capability: 'master-data:delete', pathname: `${base}/${id}` },
] as const satisfies readonly { method: string; capability: PermissionKey; pathname: string }[];
type Route = (typeof routes)[number];
const input = (method: string): Record<string, unknown> => ({
  ...(method === 'POST' ? { code: ' COLOR_1 ' } : {}),
  name: ' Color ',
  description: ' raw description ',
  effectiveFrom: ` ${from} `,
  effectiveTo: ` ${to} `,
  ...(method === 'PATCH' ? { version: 1 } : {}),
});
const parsed = (method: string) => ({
  ...(method === 'POST' ? { code: 'COLOR_1' } : {}),
  name: 'Color',
  description: 'raw description',
  effectiveFrom: from,
  effectiveTo: to,
  ...(method === 'PATCH' ? { version: 1 } : {}),
});
function fixture(
  options: {
    denied?: PermissionKey;
    available?: boolean;
    fields?: Grant['fields'];
    emptyScope?: boolean;
  } = {},
) {
  const permissions = new Map<PermissionKey, Grant>(
    routes
      .filter((route) => route.capability !== options.denied)
      .map((route) => [
        route.capability,
        {
          scopes: options.emptyScope ? [] : ['TEAM'],
          fields: options.fields === undefined ? null : options.fields,
        },
      ]),
  );
  const context: AuthorizationContext = {
    actor,
    permissions,
    scopeAnchors: new Map(
      routes.map((route) => [
        route.capability,
        [{ scope: 'TEAM', organizationId: 'anchor-not-forwarded' }],
      ]),
    ),
  };
  const get = vi.spyOn(context.permissions, 'get');
  const repository = {
    listCategories: vi.fn<Master['listCategories']>().mockResolvedValue(rows),
    createCategory: vi.fn<Master['createCategory']>().mockResolvedValue(row),
    updateCategory: vi.fn<Master['updateCategory']>().mockResolvedValue(row),
    deleteCategory: vi.fn<Master['deleteCategory']>().mockResolvedValue(undefined),
    listEntries: vi.fn<Master['listEntries']>().mockResolvedValue([{ id: 'entry-neighbor' }]),
  };
  const audit = {
    list: vi.fn().mockResolvedValue({ items: [{ id: 'audit-neighbor' }], nextCursor: null }),
  };
  const app = buildApp({
    auth: {
      authenticate: vi.fn().mockResolvedValue(context),
    } as unknown as ApiDependencies['auth'],
    organizations: {} as ApiDependencies['organizations'],
    employees: {} as ApiDependencies['employees'],
    ...(options.available === false ? {} : { masterData: repository as unknown as Master }),
    audit: audit as unknown as NonNullable<ApiDependencies['audit']>,
  });
  const dispatch = (route: Route, options: Partial<ApiRequest> = {}) =>
    app.dispatch({
      method: route.method,
      pathname: route.pathname,
      body: input(route.method),
      query: { version: '1' },
      ...options,
      headers: {
        authorization: 'Bearer fixture',
        'x-correlation-id': correlationId,
        'idempotency-key': 'x'.repeat(201),
        ...options.headers,
      },
    });
  return { repository, audit, get, permissions, dispatch };
}
const response = (statusCode: number, body: unknown) => ({
  statusCode,
  body,
  headers: { 'x-correlation-id': correlationId },
});
const error = (statusCode: number, code: string, message: string) =>
  response(statusCode, { error: { code, message, correlationId } });
const invalid = (message: string) => error(400, 'invalid_request', message);
const denied = error(403, 'forbidden', 'Permission denied');
const unavailable = error(503, 'internal_error', 'Master-data repository unavailable');
const missing = error(404, 'not_found', 'Route not found');
const noCalls = (f: ReturnType<typeof fixture>) => {
  for (const mock of Object.values(f.repository)) expect(mock).not.toHaveBeenCalled();
};
const writes = [routes[1], routes[2]] as const;

describe('old master category contracts', () => {
  it.each(routes)(
    '$method uses its Q0 grant before missing repo and malformed input',
    async (route) => {
      const f = fixture({ denied: route.capability, available: false });
      expect(
        await f.dispatch(route, {
          body: null,
          query: { at: 'bad', version: 'bad' },
          pathname: route.method === 'PATCH' || route.method === 'DELETE' ? `${base}/a` : base,
        }),
      ).toEqual(denied);
      noCalls(f);
    },
  );
  it.each(routes)('$method denies empty scopes without accessing repository', async (route) => {
    const f = fixture({ emptyScope: true });
    expect(await f.dispatch(route)).toEqual(denied);
    noCalls(f);
  });
  it.each(routes)('$method checks missing repo before parsing', async (route) => {
    const f = fixture({ available: false });
    expect(
      await f.dispatch(route, {
        body: null,
        query: { at: 'bad', version: 'bad' },
        pathname: route.method === 'PATCH' || route.method === 'DELETE' ? `${base}/a` : base,
      }),
    ).toEqual(unavailable);
    noCalls(f);
  });
  it.each(routes)('$method global401 precedes grant/repo/inputs', async (route) => {
    const f = fixture({ denied: route.capability, available: false });
    expect(await f.dispatch(route, { body: null, headers: { authorization: '' } })).toEqual(
      error(401, 'authentication_required', 'A valid session is required'),
    );
    noCalls(f);
  });
  it.each(routes)(
    '$method preserves receiver, arity and raw return without scope forwarding',
    async (route) => {
      const f = fixture();
      const result = await f.dispatch(route, { query: { at: from, version: '1', unknown: 'bad' } });
      if (route.method === 'GET') {
        expect(result).toEqual(response(200, rows));
        expect(result.body).toBe(rows);
        expect(f.repository.listCategories).toHaveBeenCalledExactlyOnceWith(
          actor.companyId,
          new Date(from),
        );
        expect(f.repository.listCategories.mock.contexts).toEqual([f.repository]);
      } else if (route.method === 'POST') {
        expect(result).toEqual(response(201, row));
        expect(result.body).toBe(row);
        expect(f.repository.createCategory).toHaveBeenCalledExactlyOnceWith(
          parsed('POST'),
          actor,
          correlationId,
        );
        expect(f.repository.createCategory.mock.contexts).toEqual([f.repository]);
        expect(f.repository.createCategory.mock.calls[0]?.[1]).toBe(actor);
      } else if (route.method === 'PATCH') {
        expect(result).toEqual(response(200, row));
        expect(result.body).toBe(row);
        expect(f.repository.updateCategory).toHaveBeenCalledExactlyOnceWith(
          id,
          parsed('PATCH'),
          actor,
          correlationId,
        );
        expect(f.repository.updateCategory.mock.contexts).toEqual([f.repository]);
        expect(f.repository.updateCategory.mock.calls[0]?.[2]).toBe(actor);
      } else {
        expect(result).toEqual(response(204, {}));
        expect(f.repository.deleteCategory).toHaveBeenCalledExactlyOnceWith(
          id,
          1,
          actor,
          correlationId,
        );
        expect(f.repository.deleteCategory.mock.contexts).toEqual([f.repository]);
        expect(f.repository.deleteCategory.mock.calls[0]?.[2]).toBe(actor);
      }
      expect(f.get.mock.calls.every(([capability]) => capability === route.capability)).toBe(true);
    },
  );
  it.each([{ fields: null }, { fields: [] }, { fields: ['not-a-body-field'] }] as const)(
    'all methods use no fields request/projection with $fields',
    async ({ fields }) => {
      const f = fixture({ fields });
      for (const route of routes) {
        const actual = await f.dispatch(route);
        expect(actual.statusCode).toBe(
          route.method === 'POST' ? 201 : route.method === 'DELETE' ? 204 : 200,
        );
        if (route.method !== 'DELETE')
          expect(actual.body).toBe(route.method === 'GET' ? rows : row);
      }
    },
  );
  it('authorizes before reading query.at getters', async () => {
    const f = fixture({ denied: 'master-data:read' });
    const at = vi.fn(() => 'bad');
    expect(
      await f.dispatch(routes[0], {
        query: {
          get at() {
            return at();
          },
        },
      }),
    ).toEqual(denied);
    expect(at).not.toHaveBeenCalled();
    noCalls(f);
  });
  it.each([{ query: {} }, { query: { at: '' } }])(
    'GET defaults to a current Date for $query',
    async ({ query }) => {
      vi.useFakeTimers({ toFake: ['Date'] });
      try {
        vi.setSystemTime(new Date('2026-10-14T03:00:00Z'));
        const f = fixture();
        await f.dispatch(routes[0], { query, body: ['ignored'] });
        expect(f.repository.listCategories).toHaveBeenCalledExactlyOnceWith(
          actor.companyId,
          new Date('2026-10-14T03:00:00Z'),
        );
        expect(f.repository.listCategories.mock.calls[0]?.[1]).toBeInstanceOf(Date);
      } finally {
        vi.useRealTimers();
      }
    },
  );
  it.each([
    { at: from, iso: '2026-02-01T00:00:00.000Z' },
    { at: '2026-02-01', iso: '2026-02-01T00:00:00.000Z' },
    { at: '2026-02-30', iso: '2026-03-02T00:00:00.000Z' },
  ])('GET parses Date rather than forwarding/normalizing $at to a string', async ({ at, iso }) => {
    const f = fixture();
    await f.dispatch(routes[0], { query: { at }, body: null });
    const actual = f.repository.listCategories.mock.calls[0]?.[1];
    expect(actual).toBeInstanceOf(Date);
    expect(actual?.toISOString()).toBe(iso);
  });
  it.each([' ', 'bad'])('GET retains timestamp error for truthy %j', async (at) => {
    const f = fixture();
    expect(await f.dispatch(routes[0], { query: { at } })).toEqual(
      invalid('at must be an ISO timestamp'),
    );
    noCalls(f);
  });
  it('GET retains an empty returned array without wrapping', async () => {
    const f = fixture();
    const empty: typeof rows = [];
    f.repository.listCategories.mockResolvedValue(empty);
    expect((await f.dispatch(routes[0])).body).toBe(empty);
  });
  for (const route of writes) {
    describe(route.method, () => {
      it('omitted description/effectiveTo still become own null input keys', async () => {
        const f = fixture();
        const body = input(route.method);
        delete body.description;
        delete body.effectiveTo;
        await f.dispatch(route, { body });
        const actual =
          route.method === 'POST'
            ? f.repository.createCategory.mock.calls[0]?.[0]
            : f.repository.updateCategory.mock.calls[0]?.[1];
        expect(actual).toEqual({ ...parsed(route.method), description: null, effectiveTo: null });
        expect(Object.hasOwn(actual ?? {}, 'description')).toBe(true);
        expect(Object.hasOwn(actual ?? {}, 'effectiveTo')).toBe(true);
      });
      it.each([{ value: null }, { value: undefined }, { value: [] }, { value: 'body' }])(
        'rejects nonobject $value before fields/range',
        async ({ value }) => {
          const f = fixture();
          expect(await f.dispatch(route, { body: value })).toEqual(
            invalid('A JSON object body is required'),
          );
          noCalls(f);
        },
      );
      it('sorts unknown fields before range/code/UUID/name', async () => {
        const f = fixture();
        expect(
          await f.dispatch(route, {
            body: { z: 1, a: 2 },
            pathname: route.method === 'PATCH' ? `${base}/a` : base,
          }),
        ).toEqual(invalid('Unsupported fields: a, z'));
        noCalls(f);
      });
      it.each([
        { patch: { effectiveFrom: undefined }, message: 'effectiveFrom is required' },
        { patch: { effectiveFrom: ' ' }, message: 'effectiveFrom is required' },
        { patch: { effectiveFrom: 'bad' }, message: 'Effective dates must be ISO timestamps' },
        { patch: { effectiveTo: 1 }, message: 'effectiveTo is required' },
        { patch: { effectiveTo: ' ' }, message: 'effectiveTo is required' },
        { patch: { effectiveTo: 'bad' }, message: 'Effective dates must be ISO timestamps' },
        { patch: { effectiveTo: from }, message: 'effectiveTo must be after effectiveFrom' },
        {
          patch: { effectiveTo: '2026-02-01T00:00:00Z' },
          message: 'effectiveTo must be after effectiveFrom',
        },
        {
          patch: { effectiveTo: '2026-01-01' },
          message: 'effectiveTo must be after effectiveFrom',
        },
      ])('range validates first: $message', async ({ patch, message }) => {
        const f = fixture();
        expect(
          await f.dispatch(route, {
            body: {
              ...input(route.method),
              ...patch,
              name: '',
              ...(route.method === 'POST' ? { code: '' } : { version: 0 }),
            },
            pathname: route.method === 'PATCH' ? `${base}/a` : base,
          }),
        ).toEqual(invalid(message));
        noCalls(f);
      });
      it('checks effectiveTo string before parsing bad effectiveFrom', async () => {
        const f = fixture();
        expect(
          await f.dispatch(route, {
            body: { ...input(route.method), effectiveFrom: 'bad', effectiveTo: false },
          }),
        ).toEqual(invalid('effectiveTo is required'));
        noCalls(f);
      });
      it.each([{ value: null }, { value: undefined }])(
        'makes description and effectiveTo explicitly null for $value',
        async ({ value }) => {
          const f = fixture();
          await f.dispatch(route, {
            body: { ...input(route.method), description: value, effectiveTo: value },
          });
          const actual =
            route.method === 'POST'
              ? f.repository.createCategory.mock.calls[0]?.[0]
              : f.repository.updateCategory.mock.calls[0]?.[1];
          expect(actual).toEqual({ ...parsed(route.method), description: null, effectiveTo: null });
          expect(Object.hasOwn(actual ?? {}, 'description')).toBe(true);
          expect(Object.hasOwn(actual ?? {}, 'effectiveTo')).toBe(true);
        },
      );
      it.each([
        { value: '' },
        { value: ' ' },
        { value: 0 },
        { value: false },
        { value: {} },
        { value: [] },
      ])('rejects description $value before PATCH version', async ({ value }) => {
        const f = fixture();
        expect(
          await f.dispatch(route, {
            body: {
              ...input(route.method),
              description: value,
              ...(route.method === 'PATCH' ? { version: 0 } : {}),
            },
          }),
        ).toEqual(invalid('description is required'));
        noCalls(f);
      });
      it('checks name before description/version', async () => {
        const f = fixture();
        expect(
          await f.dispatch(route, {
            body: {
              ...input(route.method),
              name: ' ',
              description: false,
              ...(route.method === 'PATCH' ? { version: 0 } : {}),
            },
          }),
        ).toEqual(invalid('name is required'));
        noCalls(f);
      });
      it('retains date-only and overflow range strings (mock forward, not PG proof)', async () => {
        const f = fixture();
        await f.dispatch(route, {
          body: { ...input(route.method), effectiveFrom: ' 2026-02-30 ', effectiveTo: null },
        });
        const actual =
          route.method === 'POST'
            ? f.repository.createCategory.mock.calls[0]?.[0]
            : f.repository.updateCategory.mock.calls[0]?.[1];
        expect(actual).toEqual({
          ...parsed(route.method),
          effectiveFrom: '2026-02-30',
          effectiveTo: null,
        });
      });
    });
  }
  it.each([
    { code: '', message: 'code is required' },
    { code: ' ', message: 'code is required' },
    {
      code: 'lower',
      message: 'Code must be 1-64 uppercase letters, digits, underscore, or hyphen',
    },
    {
      code: '1COLOR',
      message: 'Code must be 1-64 uppercase letters, digits, underscore, or hyphen',
    },
    {
      code: 'A'.repeat(65),
      message: 'Code must be 1-64 uppercase letters, digits, underscore, or hyphen',
    },
  ])('POST code before name: $code', async ({ code, message }) => {
    const f = fixture();
    expect(await f.dispatch(routes[1], { body: { ...input('POST'), code, name: '' } })).toEqual(
      invalid(message),
    );
    noCalls(f);
  });
  it('POST accepts the 64-character stable code boundary', async () => {
    const f = fixture();
    await f.dispatch(routes[1], { body: { ...input('POST'), code: 'A'.repeat(64) } });
    expect(f.repository.createCategory.mock.calls[0]?.[0].code).toBe('A'.repeat(64));
  });
  it('PATCH path UUID follows range but precedes name/version', async () => {
    const f = fixture();
    expect(
      await f.dispatch(routes[2], {
        pathname: `${base}/a`,
        body: { ...input('PATCH'), name: '', version: 0 },
      }),
    ).toEqual(invalid('categoryId must be a UUID'));
    noCalls(f);
  });
  it.each([{ key: 'code' }, { key: 'expectedVersion' }])(
    'PATCH rejects extra $key, not a partial update',
    async ({ key }) => {
      const f = fixture();
      expect(await f.dispatch(routes[2], { body: { ...input('PATCH'), [key]: 1 } })).toEqual(
        invalid(`Unsupported fields: ${key}`),
      );
      noCalls(f);
    },
  );
  it('PATCH {} still requires a full effective range', async () => {
    const f = fixture();
    expect(await f.dispatch(routes[2], { body: {} })).toEqual(invalid('effectiveFrom is required'));
    noCalls(f);
  });
  it.each([
    { value: undefined },
    { value: null },
    { value: '1' },
    { value: 0 },
    { value: -1 },
    { value: 1.5 },
    { value: NaN },
    { value: Infinity },
    { value: Number.MAX_SAFE_INTEGER + 1 },
  ])('PATCH body version number-only rejects $value', async ({ value }) => {
    const f = fixture();
    expect(await f.dispatch(routes[2], { body: { ...input('PATCH'), version: value } })).toEqual(
      invalid('version must be a positive integer'),
    );
    noCalls(f);
  });
  it('PATCH forwards MAX_SAFE version to mock without proving a real DB version', async () => {
    const f = fixture();
    await f.dispatch(routes[2], { body: { ...input('PATCH'), version: Number.MAX_SAFE_INTEGER } });
    expect(f.repository.updateCategory.mock.calls[0]?.[1].version).toBe(Number.MAX_SAFE_INTEGER);
  });
  it.each([
    { query: {} },
    { query: { version: '' } },
    { query: { version: ' ' } },
    { query: { version: '0' } },
    { query: { version: 'null' } },
    { query: { version: '-1' } },
    { query: { version: '1.5' } },
    { query: { version: 'Infinity' } },
    { query: { version: 'NaN' } },
    { query: { version: '9007199254740992' } },
  ])('DELETE applies Number then positive version to $query', async ({ query }) => {
    const f = fixture();
    expect(await f.dispatch(routes[3], { query, body: { version: 1 } })).toEqual(
      invalid('version must be a positive integer'),
    );
    noCalls(f);
  });
  it.each([
    { raw: '1', value: 1 },
    { raw: ' 1 ', value: 1 },
    { raw: '0x10', value: 16 },
    { raw: '1e3', value: 1000 },
    { raw: '9007199254740991', value: Number.MAX_SAFE_INTEGER },
  ])('DELETE accepts original numeric conversion $raw', async ({ raw, value }) => {
    const f = fixture();
    expect(await f.dispatch(routes[3], { query: { version: raw }, body: null })).toEqual(
      response(204, {}),
    );
    expect(f.repository.deleteCategory).toHaveBeenCalledExactlyOnceWith(
      id,
      value,
      actor,
      correlationId,
    );
  });
  it('DELETE UUID precedes version and ignores invalid body', async () => {
    const f = fixture();
    expect(
      await f.dispatch(routes[3], {
        pathname: `${base}/a`,
        query: { version: 'bad' },
        body: ['bad'],
      }),
    ).toEqual(invalid('categoryId must be a UUID'));
    noCalls(f);
  });
  it.each([{ query: null }, { query: { version: null } }])(
    'DELETE retains nullish query conversion for $query',
    async ({ query }) => {
      const f = fixture();
      expect(
        await f.dispatch(routes[3], {
          query: query as unknown as NonNullable<ApiRequest['query']>,
        }),
      ).toEqual(invalid('version must be a positive integer'));
      noCalls(f);
    },
  );
  it('DELETE awaits repository completion before returning204', async () => {
    const f = fixture();
    let finish: (() => void) | undefined;
    f.repository.deleteCategory.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const pending = f.dispatch(routes[3]);
    await vi.waitFor(() => {
      expect(f.repository.deleteCategory).toHaveBeenCalledTimes(1);
    });
    let complete = false;
    void pending.then(() => {
      complete = true;
    });
    await Promise.resolve();
    expect(complete).toBe(false);
    finish?.();
    expect(await pending).toEqual(response(204, {}));
  });
  it.each([
    { method: 'GET', pathname: `${base}/${id}` },
    { method: 'DELETE', pathname: base },
    { method: 'POST', pathname: `${base}/${id}` },
    { method: 'PATCH', pathname: base },
    { method: 'GET', pathname: `${base}/` },
    { method: 'PATCH', pathname: `${base}/${id}/extra` },
    { method: 'PATCH', pathname: `${base}/${id.toUpperCase()}` },
    { method: 'DELETE', pathname: `${base}/not-uuid` },
    { method: 'GET', pathname: '/api/v1/master-data/Categories' },
    { method: 'get', pathname: base },
  ])(
    'unsupported $method $pathname remains404 without grants/repo',
    async ({ method, pathname }) => {
      const f = fixture({ emptyScope: true, available: false });
      expect(await f.dispatch(routes[0], { method, pathname })).toEqual(missing);
      noCalls(f);
    },
  );
  it.each(routes)('$method propagates repository DomainError unchanged', async (route) => {
    const f = fixture();
    const failure = new DomainError('conflict', 'category fixture conflict');
    if (route.method === 'GET') f.repository.listCategories.mockRejectedValue(failure);
    else if (route.method === 'POST') f.repository.createCategory.mockRejectedValue(failure);
    else if (route.method === 'PATCH') f.repository.updateCategory.mockRejectedValue(failure);
    else f.repository.deleteCategory.mockRejectedValue(failure);
    expect(await f.dispatch(route)).toEqual(error(409, 'conflict', 'category fixture conflict'));
  });
  it('keeps positive neighboring audit and entries GETs available', async () => {
    const f = fixture();
    f.permissions.set('audit:read', { scopes: ['SELF'], fields: null });
    expect(await f.dispatch(routes[0], { pathname: '/api/v1/audit-events' })).toEqual(
      response(200, { items: [{ id: 'audit-neighbor' }], nextCursor: null }),
    );
    expect(
      await f.dispatch(routes[0], { pathname: '/api/v1/master-data/entries', query: { at: from } }),
    ).toEqual(response(200, [{ id: 'entry-neighbor' }]));
    expect(f.audit.list).toHaveBeenCalledTimes(1);
    expect(f.repository.listEntries).toHaveBeenCalledExactlyOnceWith(
      actor.companyId,
      null,
      new Date(from),
    );
    expect(f.repository.listCategories).not.toHaveBeenCalled();
  });
});
