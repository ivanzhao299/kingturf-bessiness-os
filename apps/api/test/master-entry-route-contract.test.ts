// Fixed against 4b8a0bb's two inline entry route regions, before extraction.
import { describe, expect, it, vi } from 'vitest';
import { DomainError, type AuthorizationContext } from '@kingturf/domain';
import type { PermissionKey } from '@kingturf/types';
import { buildApp, type ApiDependencies, type ApiRequest } from '../src/app.js';

type Master = NonNullable<ApiDependencies['masterData']>;
type Grant = NonNullable<ReturnType<AuthorizationContext['permissions']['get']>>;
const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const categoryId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const correlationId = '33333333-3333-4333-8333-333333333333';
const actor = { companyId: 'entry-tenant', employeeId: id };
const base = '/api/v1/master-data/entries';
const from = '2026-02-01T08:00:00+08:00';
const to = '2026-03-01';
const value = { nested: { retained: true }, items: [1, null], raw: ' untrimmed ' };
const row = { id, version: 7, label: 'raw entry', value, private: 'not projected' };
const rows = [row];
const routes = [
  { kind: 'create', method: 'POST', capability: 'master-data:create', pathname: base },
  { kind: 'list', method: 'GET', capability: 'master-data:read', pathname: base },
  { kind: 'detail', method: 'GET', capability: 'master-data:read', pathname: `${base}/${id}` },
  { kind: 'update', method: 'PATCH', capability: 'master-data:update', pathname: `${base}/${id}` },
  { kind: 'delete', method: 'DELETE', capability: 'master-data:delete', pathname: `${base}/${id}` },
] as const satisfies readonly {
  kind: string;
  method: string;
  capability: PermissionKey;
  pathname: string;
}[];
type Route = (typeof routes)[number];
const input = (kind: string): Record<string, unknown> => ({
  ...(kind === 'create' ? { categoryId: ` ${categoryId.toUpperCase()} `, code: ' COLOR_1 ' } : {}),
  label: ' Label ',
  value,
  effectiveFrom: ` ${from} `,
  effectiveTo: ` ${to} `,
  ...(kind === 'update' ? { version: 1 } : {}),
});
const parsed = (kind: string) => ({
  ...(kind === 'create' ? { categoryId: categoryId.toUpperCase(), code: 'COLOR_1' } : {}),
  label: 'Label',
  value,
  effectiveFrom: from,
  effectiveTo: to,
  ...(kind === 'update' ? { version: 1 } : {}),
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
        [{ scope: 'TEAM', organizationId: 'not-forwarded' }],
      ]),
    ),
  };
  const get = vi.spyOn(permissions, 'get');
  const repository = {
    createEntry: vi.fn<Master['createEntry']>().mockResolvedValue(row),
    listEntries: vi.fn<Master['listEntries']>().mockResolvedValue(rows),
    findEntry: vi.fn<Master['findEntry']>().mockResolvedValue(row),
    updateEntry: vi.fn<Master['updateEntry']>().mockResolvedValue(row),
    deleteEntry: vi.fn<Master['deleteEntry']>().mockResolvedValue(undefined),
    listCategories: vi
      .fn<Master['listCategories']>()
      .mockResolvedValue([{ id: 'category-neighbor' }]),
  };
  const numbers = { list: vi.fn().mockResolvedValue([{ id: 'number-neighbor' }]) };
  const rules = { list: vi.fn().mockResolvedValue([{ id: 'rule-neighbor' }]) };
  const app = buildApp({
    auth: {
      authenticate: vi.fn().mockResolvedValue(context),
    } as unknown as ApiDependencies['auth'],
    organizations: {} as ApiDependencies['organizations'],
    employees: {} as ApiDependencies['employees'],
    ...(options.available === false ? {} : { masterData: repository as unknown as Master }),
    numbers: numbers as unknown as NonNullable<ApiDependencies['numbers']>,
    rules: rules as unknown as NonNullable<ApiDependencies['rules']>,
  });
  const dispatch = (route: Route, options: Partial<ApiRequest> = {}) =>
    app.dispatch({
      method: route.method,
      pathname: route.pathname,
      body: input(route.kind),
      query: { at: from, version: '1' },
      ...options,
      headers: {
        authorization: 'Bearer fixture',
        'x-correlation-id': correlationId,
        'idempotency-key': 'x'.repeat(201),
        ...options.headers,
      },
    });
  return { repository, numbers, rules, permissions, get, dispatch };
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
const writes = [routes[0], routes[3]] as const;
const reads = [routes[1], routes[2]] as const;
const writeInput = (f: ReturnType<typeof fixture>, route: Route) =>
  route.kind === 'create'
    ? f.repository.createEntry.mock.calls[0]?.[0]
    : f.repository.updateEntry.mock.calls[0]?.[1];

describe('old master entry route contracts', () => {
  it.each(routes)('$kind Q0 precedes missing repo and malformed inputs', async (route) => {
    const f = fixture({ denied: route.capability, available: false });
    expect(
      await f.dispatch(route, {
        body: null,
        query: { categoryId: 'bad', at: 'bad', version: 'bad' },
        pathname: ['detail', 'update', 'delete'].includes(route.kind) ? `${base}/a` : base,
      }),
    ).toEqual(denied);
    noCalls(f);
  });
  it.each(routes)('$kind denies empty scopes before repository access', async (route) => {
    const f = fixture({ emptyScope: true });
    expect(await f.dispatch(route)).toEqual(denied);
    noCalls(f);
  });
  it.each(routes)('$kind missing repo precedes all body/query/path parsing', async (route) => {
    const f = fixture({ available: false });
    expect(
      await f.dispatch(route, {
        body: null,
        query: { categoryId: 'bad', at: 'bad', version: 'bad' },
        pathname: ['detail', 'update', 'delete'].includes(route.kind) ? `${base}/a` : base,
      }),
    ).toEqual(unavailable);
    noCalls(f);
  });
  it.each(routes)('$kind global401 precedes path/grant/repository', async (route) => {
    const f = fixture({ denied: route.capability, available: false });
    expect(await f.dispatch(route, { body: null, headers: { authorization: '' } })).toEqual(
      error(401, 'authentication_required', 'A valid session is required'),
    );
    noCalls(f);
  });
  it.each(routes)(
    '$kind preserves receiver, original arguments and raw response',
    async (route) => {
      const f = fixture();
      const actual = await f.dispatch(route);
      if (route.kind === 'create') {
        expect(actual).toEqual(response(201, row));
        expect(f.repository.createEntry).toHaveBeenCalledExactlyOnceWith(
          parsed('create'),
          actor,
          correlationId,
        );
        expect(f.repository.createEntry.mock.contexts).toEqual([f.repository]);
        expect(f.repository.createEntry.mock.calls[0]?.[0].value).toBe(value);
        expect(f.repository.createEntry.mock.calls[0]?.[1]).toBe(actor);
        expect(Object.keys(f.repository.createEntry.mock.calls[0]?.[0] ?? {})).toEqual([
          'categoryId',
          'code',
          'label',
          'value',
          'effectiveFrom',
          'effectiveTo',
        ]);
      } else if (route.kind === 'list') {
        expect(actual).toEqual(response(200, rows));
        expect(f.repository.listEntries).toHaveBeenCalledExactlyOnceWith(
          actor.companyId,
          null,
          new Date(from),
        );
        expect(f.repository.listEntries.mock.contexts).toEqual([f.repository]);
      } else if (route.kind === 'detail') {
        expect(actual).toEqual(response(200, row));
        expect(f.repository.findEntry).toHaveBeenCalledExactlyOnceWith(
          id,
          actor.companyId,
          new Date(from),
        );
        expect(f.repository.findEntry.mock.contexts).toEqual([f.repository]);
      } else if (route.kind === 'update') {
        expect(actual).toEqual(response(200, row));
        expect(f.repository.updateEntry).toHaveBeenCalledExactlyOnceWith(
          id,
          parsed('update'),
          actor,
          correlationId,
        );
        expect(f.repository.updateEntry.mock.contexts).toEqual([f.repository]);
        expect(f.repository.updateEntry.mock.calls[0]?.[1].value).toBe(value);
        expect(f.repository.updateEntry.mock.calls[0]?.[2]).toBe(actor);
        expect(Object.keys(f.repository.updateEntry.mock.calls[0]?.[1] ?? {})).toEqual([
          'label',
          'value',
          'effectiveFrom',
          'effectiveTo',
          'version',
        ]);
      } else {
        expect(actual).toEqual(response(204, {}));
        expect(f.repository.deleteEntry).toHaveBeenCalledExactlyOnceWith(
          id,
          1,
          actor,
          correlationId,
        );
        expect(f.repository.deleteEntry.mock.contexts).toEqual([f.repository]);
        expect(f.repository.deleteEntry.mock.calls[0]?.[2]).toBe(actor);
      }
      if (route.kind !== 'delete') expect(actual.body).toBe(route.kind === 'list' ? rows : row);
      expect(f.get.mock.calls.every(([capability]) => capability === route.capability)).toBe(true);
    },
  );
  it.each([{ fields: null }, { fields: [] }, { fields: ['unrelated-field'] }] as const)(
    'all five use no fields request/projection with $fields',
    async ({ fields }) => {
      const f = fixture({ fields });
      for (const route of routes) {
        const actual = await f.dispatch(route);
        expect(actual.statusCode).toBe(
          route.kind === 'create' ? 201 : route.kind === 'delete' ? 204 : 200,
        );
        if (route.kind !== 'delete') expect(actual.body).toBe(route.kind === 'list' ? rows : row);
      }
    },
  );
  it('detail null has its own not-found envelope', async () => {
    const f = fixture();
    f.repository.findEntry.mockResolvedValue(null);
    expect(await f.dispatch(routes[2])).toEqual(
      error(404, 'not_found', 'Master-data entry not found'),
    );
    expect(f.repository.findEntry).toHaveBeenCalledTimes(1);
  });
  it('list retains empty array without wrapping', async () => {
    const f = fixture();
    const empty: typeof rows = [];
    f.repository.listEntries.mockResolvedValue(empty);
    expect((await f.dispatch(routes[1])).body).toBe(empty);
  });
  it.each([{ raw: '' }, { raw: undefined }, { raw: null }])(
    'list category $raw maps to null',
    async ({ raw }) => {
      const f = fixture();
      await f.dispatch(routes[1], {
        query: { categoryId: raw, at: from } as unknown as NonNullable<ApiRequest['query']>,
      });
      expect(f.repository.listEntries).toHaveBeenCalledExactlyOnceWith(
        actor.companyId,
        null,
        new Date(from),
      );
    },
  );
  it('list trims category UUID without lowercasing it', async () => {
    const f = fixture();
    await f.dispatch(routes[1], {
      query: { categoryId: ` ${categoryId.toUpperCase()} `, at: from },
    });
    expect(f.repository.listEntries).toHaveBeenCalledExactlyOnceWith(
      actor.companyId,
      categoryId.toUpperCase(),
      new Date(from),
    );
  });
  it.each([
    { raw: 'bad', message: 'categoryId must be a UUID' },
    { raw: ' ', message: 'categoryId is required' },
  ])('list bad category $raw precedes bad at', async ({ raw, message }) => {
    const f = fixture();
    expect(await f.dispatch(routes[1], { query: { categoryId: raw, at: 'bad' } })).toEqual(
      invalid(message),
    );
    noCalls(f);
  });
  it('detail path UUID precedes bad at and ignores categoryId query', async () => {
    const f = fixture();
    expect(
      await f.dispatch(routes[2], {
        pathname: `${base}/a`,
        query: { at: 'bad', categoryId: 'bad' },
      }),
    ).toEqual(invalid('entryId must be a UUID'));
    noCalls(f);
  });
  it('detail ignores a bad category filter when at is valid', async () => {
    const f = fixture();
    expect(await f.dispatch(routes[2], { query: { categoryId: 'bad', at: from } })).toEqual(
      response(200, row),
    );
  });
  for (const route of reads) {
    describe(route.kind, () => {
      it.each([{ query: {} }, { query: { at: '' } }])(
        'defaults to a current Date for $query',
        async ({ query }) => {
          vi.useFakeTimers({ toFake: ['Date'] });
          try {
            vi.setSystemTime(new Date('2026-10-14T03:00:00Z'));
            const f = fixture();
            await f.dispatch(route, { query, body: ['ignored'] });
            const args =
              route.kind === 'list'
                ? f.repository.listEntries.mock.calls[0]
                : f.repository.findEntry.mock.calls[0];
            expect(args?.[2]).toBeInstanceOf(Date);
            expect(args?.[2]?.toISOString()).toBe('2026-10-14T03:00:00.000Z');
          } finally {
            vi.useRealTimers();
          }
        },
      );
      it.each([
        { at: from, iso: '2026-02-01T00:00:00.000Z' },
        { at: '2026-02-01', iso: '2026-02-01T00:00:00.000Z' },
        { at: '2026-02-30', iso: '2026-03-02T00:00:00.000Z' },
      ])('keeps original Date.parse acceptance for $at', async ({ at, iso }) => {
        const f = fixture();
        await f.dispatch(route, { query: { at } });
        const args =
          route.kind === 'list'
            ? f.repository.listEntries.mock.calls[0]
            : f.repository.findEntry.mock.calls[0];
        expect(args?.[2]).toBeInstanceOf(Date);
        expect(args?.[2]?.toISOString()).toBe(iso);
      });
      it.each([' ', 'bad'])('keeps truthy at error %j', async (at) => {
        const f = fixture();
        expect(await f.dispatch(route, { query: { at } })).toEqual(
          invalid('at must be an ISO timestamp'),
        );
        noCalls(f);
      });
      it('authorizes before reading input query getters', async () => {
        const f = fixture({ denied: 'master-data:read' });
        const at = vi.fn(() => 'bad');
        expect(
          await f.dispatch(route, {
            query: {
              get at() {
                return at();
              },
            },
          }),
        ).toEqual(denied);
        expect(at).not.toHaveBeenCalled();
      });
      it('ignores body/header and unknown query', async () => {
        const f = fixture();
        expect(
          await f.dispatch(route, {
            body: false,
            query: { at: from, unknown: 'bad', version: 'bad' },
          }),
        ).toEqual(response(200, route.kind === 'list' ? rows : row));
      });
    });
  }
  for (const route of writes) {
    describe(route.kind, () => {
      it.each([{ value: null }, { value: undefined }, { value: [] }, { value: 'body' }])(
        'O rejects root $value before fields/range',
        async ({ value }) => {
          const f = fixture();
          expect(await f.dispatch(route, { body: value })).toEqual(
            invalid('A JSON object body is required'),
          );
          noCalls(f);
        },
      );
      it('unknown fields sort and precede range/UUID/code/label', async () => {
        const f = fixture();
        expect(
          await f.dispatch(route, {
            body: { z: 1, a: 2 },
            pathname: route.kind === 'update' ? `${base}/a` : base,
          }),
        ).toEqual(invalid('Unsupported fields: a, z'));
        noCalls(f);
      });
      it.each([
        { patch: { effectiveFrom: undefined }, message: 'effectiveFrom is required' },
        { patch: { effectiveFrom: ' ' }, message: 'effectiveFrom is required' },
        { patch: { effectiveFrom: 'bad' }, message: 'Effective dates must be ISO timestamps' },
        { patch: { effectiveTo: false }, message: 'effectiveTo is required' },
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
      ])('range precedes all remaining bad inputs: $message', async ({ patch, message }) => {
        const f = fixture();
        expect(
          await f.dispatch(route, {
            body: {
              ...input(route.kind),
              ...patch,
              label: '',
              value: null,
              ...(route.kind === 'create' ? { categoryId: 'bad', code: '' } : { version: 0 }),
            },
            pathname: route.kind === 'update' ? `${base}/a` : base,
          }),
        ).toEqual(invalid(message));
        noCalls(f);
      });
      it('effectiveTo string precedes invalid effectiveFrom date parse', async () => {
        const f = fixture();
        expect(
          await f.dispatch(route, {
            body: { ...input(route.kind), effectiveFrom: 'bad', effectiveTo: 0 },
          }),
        ).toEqual(invalid('effectiveTo is required'));
        noCalls(f);
      });
      it.each([{ to: null }, { to: undefined }])(
        'nullish to=$to becomes an own null key',
        async ({ to }) => {
          const f = fixture();
          await f.dispatch(route, { body: { ...input(route.kind), effectiveTo: to } });
          const actual = writeInput(f, route);
          expect(actual).toEqual({ ...parsed(route.kind), effectiveTo: null });
          expect(Object.hasOwn(actual ?? {}, 'effectiveTo')).toBe(true);
        },
      );
      it('omitted to becomes null and range strings are not normalized', async () => {
        const f = fixture();
        const body = input(route.kind);
        delete body.effectiveTo;
        await f.dispatch(route, { body });
        expect(writeInput(f, route)).toEqual({ ...parsed(route.kind), effectiveTo: null });
      });
      it('preserves overflow date string to mock, not a PG success claim', async () => {
        const f = fixture();
        await f.dispatch(route, {
          body: { ...input(route.kind), effectiveFrom: ' 2026-02-30 ', effectiveTo: null },
        });
        expect(writeInput(f, route)?.effectiveFrom).toBe('2026-02-30');
      });
      it.each([{ label: '' }, { label: ' ' }, { label: false }, { label: null }])(
        'label $label precedes value/version',
        async ({ label }) => {
          const f = fixture();
          expect(
            await f.dispatch(route, {
              body: {
                ...input(route.kind),
                label,
                value: null,
                ...(route.kind === 'update' ? { version: 0 } : {}),
              },
            }),
          ).toEqual(invalid('label is required'));
          noCalls(f);
        },
      );
      it.each([
        { value: null },
        { value: undefined },
        { value: [] },
        { value: false },
        { value: 'json' },
      ])('value shallow O rejects $value before PATCH version', async ({ value }) => {
        const f = fixture();
        expect(
          await f.dispatch(route, {
            body: {
              ...input(route.kind),
              value,
              ...(route.kind === 'update' ? { version: 0 } : {}),
            },
          }),
        ).toEqual(invalid('A JSON object body is required'));
        noCalls(f);
      });
      it.each([{ value: {} }, { value: { nested: null, raw: ' untrimmed ', array: [1, false] } }])(
        'value object/reference is unchanged for $value',
        async ({ value }) => {
          const f = fixture();
          await f.dispatch(route, { body: { ...input(route.kind), value } });
          expect(writeInput(f, route)?.value).toBe(value);
        },
      );
      it('ignores bogus write query without replacing body inputs', async () => {
        const f = fixture();
        expect(
          (
            await f.dispatch(route, {
              query: { categoryId: 'bad', at: 'bad', version: 'bad', unknown: 'bad' },
            })
          ).statusCode,
        ).toBe(route.kind === 'create' ? 201 : 200);
      });
    });
  }
  it.each([
    { value: 'bad', message: 'categoryId must be a UUID' },
    { value: '', message: 'categoryId is required' },
    { value: null, message: 'categoryId is required' },
  ])('POST categoryUUID $value precedes code/label/value', async ({ value, message }) => {
    const f = fixture();
    expect(
      await f.dispatch(routes[0], {
        body: { ...input('create'), categoryId: value, code: '', label: '', value: null },
      }),
    ).toEqual(invalid(message));
    noCalls(f);
  });
  it.each([
    { code: '', message: 'code is required' },
    {
      code: 'lower',
      message: 'Code must be 1-64 uppercase letters, digits, underscore, or hyphen',
    },
    {
      code: 'A'.repeat(65),
      message: 'Code must be 1-64 uppercase letters, digits, underscore, or hyphen',
    },
  ])('POST code $code precedes label/value', async ({ code, message }) => {
    const f = fixture();
    expect(
      await f.dispatch(routes[0], { body: { ...input('create'), code, label: '', value: null } }),
    ).toEqual(invalid(message));
    noCalls(f);
  });
  it('POST accepts64 code boundary', async () => {
    const f = fixture();
    await f.dispatch(routes[0], { body: { ...input('create'), code: 'A'.repeat(64) } });
    expect(f.repository.createEntry.mock.calls[0]?.[0].code).toBe('A'.repeat(64));
  });
  it('PATCH path UUID precedes label/value/version after valid range', async () => {
    const f = fixture();
    expect(
      await f.dispatch(routes[3], {
        pathname: `${base}/a`,
        body: { ...input('update'), label: '', value: null, version: 0 },
      }),
    ).toEqual(invalid('entryId must be a UUID'));
    noCalls(f);
  });
  it.each(['categoryId', 'code', 'expectedVersion'])(
    'PATCH rejects %s instead of expanding/partial update',
    async (key) => {
      const f = fixture();
      expect(await f.dispatch(routes[3], { body: { ...input('update'), [key]: 1 } })).toEqual(
        invalid(`Unsupported fields: ${key}`),
      );
      noCalls(f);
    },
  );
  it('PATCH empty body requires a full range', async () => {
    const f = fixture();
    expect(await f.dispatch(routes[3], { body: {} })).toEqual(invalid('effectiveFrom is required'));
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
  ])('PATCH body version rejects $value without Number conversion', async ({ value }) => {
    const f = fixture();
    expect(await f.dispatch(routes[3], { body: { ...input('update'), version: value } })).toEqual(
      invalid('version must be a positive integer'),
    );
    noCalls(f);
  });
  it('PATCH forwards MAX_SAFE to mock only', async () => {
    const f = fixture();
    await f.dispatch(routes[3], { body: { ...input('update'), version: Number.MAX_SAFE_INTEGER } });
    expect(f.repository.updateEntry.mock.calls[0]?.[1].version).toBe(Number.MAX_SAFE_INTEGER);
  });
  it.each([
    { query: {} },
    { query: { version: '' } },
    { query: { version: ' ' } },
    { query: { version: '0' } },
    { query: { version: '-1' } },
    { query: { version: '1.5' } },
    { query: { version: 'NaN' } },
    { query: { version: 'Infinity' } },
    { query: { version: '9007199254740992' } },
    { query: null },
    { query: { version: null } },
  ])('DELETE Number query $query retains version rejection', async ({ query }) => {
    const f = fixture();
    expect(
      await f.dispatch(routes[4], {
        query: query as unknown as NonNullable<ApiRequest['query']>,
        body: { version: 1 },
      }),
    ).toEqual(invalid('version must be a positive integer'));
    noCalls(f);
  });
  it.each([
    { raw: '1', version: 1 },
    { raw: ' 1 ', version: 1 },
    { raw: '0x10', version: 16 },
    { raw: '1e3', version: 1000 },
    { raw: '9007199254740991', version: Number.MAX_SAFE_INTEGER },
  ])('DELETE converts $raw and ignores body/header/other query', async ({ raw, version }) => {
    const f = fixture();
    expect(
      await f.dispatch(routes[4], {
        query: { version: raw, at: 'bad', categoryId: 'bad' },
        body: ['ignored'],
      }),
    ).toEqual(response(204, {}));
    expect(f.repository.deleteEntry).toHaveBeenCalledExactlyOnceWith(
      id,
      version,
      actor,
      correlationId,
    );
  });
  it('DELETE UUID precedes Number/version', async () => {
    const f = fixture();
    expect(
      await f.dispatch(routes[4], { pathname: `${base}/a`, query: { version: 'bad' }, body: null }),
    ).toEqual(invalid('entryId must be a UUID'));
    noCalls(f);
  });
  it('DELETE waits for repository before204', async () => {
    const f = fixture();
    let finish: (() => void) | undefined;
    f.repository.deleteEntry.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const pending = f.dispatch(routes[4]);
    await vi.waitFor(() => {
      expect(f.repository.deleteEntry).toHaveBeenCalledTimes(1);
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
    { method: 'DELETE', pathname: base },
    { method: 'PATCH', pathname: base },
    { method: 'POST', pathname: `${base}/${id}` },
    { method: 'GET', pathname: `${base}/` },
    { method: 'GET', pathname: `${base}/${id.toUpperCase()}` },
    { method: 'PATCH', pathname: `${base}/${id}/extra` },
    { method: 'DELETE', pathname: `${base}/not-uuid` },
    { method: 'GET', pathname: '/api/v1/master-data/Entries' },
    { method: 'get', pathname: base },
  ])('unsupported $method $pathname remains404 even missingrepo', async ({ method, pathname }) => {
    const f = fixture({ emptyScope: true, available: false });
    expect(await f.dispatch(routes[1], { method, pathname })).toEqual(missing);
    noCalls(f);
  });
  it.each(routes)('$kind propagates repository DomainError', async (route) => {
    const f = fixture();
    const failure = new DomainError('conflict', 'entry fixture conflict');
    if (route.kind === 'create') f.repository.createEntry.mockRejectedValue(failure);
    else if (route.kind === 'list') f.repository.listEntries.mockRejectedValue(failure);
    else if (route.kind === 'detail') f.repository.findEntry.mockRejectedValue(failure);
    else if (route.kind === 'update') f.repository.updateEntry.mockRejectedValue(failure);
    else f.repository.deleteEntry.mockRejectedValue(failure);
    expect(await f.dispatch(route)).toEqual(error(409, 'conflict', 'entry fixture conflict'));
  });
  it('keeps neighboring categories/numbers/rules GETs positive, not in entries', async () => {
    const f = fixture();
    f.permissions.set('number:read', { scopes: ['SELF'], fields: null });
    f.permissions.set('rule:read', { scopes: ['SELF'], fields: null });
    expect(await f.dispatch(routes[1], { pathname: '/api/v1/master-data/categories' })).toEqual(
      response(200, [{ id: 'category-neighbor' }]),
    );
    expect(await f.dispatch(routes[1], { pathname: '/api/v1/number-definitions' })).toEqual(
      response(200, { items: [{ id: 'number-neighbor' }] }),
    );
    expect(await f.dispatch(routes[1], { pathname: '/api/v1/rules' })).toEqual(
      response(200, { items: [{ id: 'rule-neighbor' }] }),
    );
    expect(f.repository.listCategories).toHaveBeenCalledExactlyOnceWith(
      actor.companyId,
      new Date(from),
    );
    expect(f.numbers.list).toHaveBeenCalledExactlyOnceWith(actor.companyId);
    expect(f.rules.list).toHaveBeenCalledExactlyOnceWith(actor.companyId);
    expect(f.repository.listEntries).not.toHaveBeenCalled();
  });
});
