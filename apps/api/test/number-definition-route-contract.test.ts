// Fixed against 2370e43's inline definition routes; allocation is not this group.
import { describe, expect, it, vi } from 'vitest';
import { DomainError, type AuthorizationContext } from '@kingturf/domain';
import type { PermissionKey } from '@kingturf/types';
import { buildApp, type ApiDependencies, type ApiRequest } from '../src/app.js';

type Numbers = NonNullable<ApiDependencies['numbers']>;
type Grant = NonNullable<ReturnType<AuthorizationContext['permissions']['get']>>;
const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const correlationId = '33333333-3333-4333-8333-333333333333';
const actor = { companyId: 'number-tenant', employeeId: id };
const base = '/api/v1/number-definitions';
const row = { id, version: { version: 7, private: 'raw' }, private: { retained: true } };
const rows = [row];
const routes = [
  { kind: 'list', method: 'GET', capability: 'number:read', pathname: base },
  { kind: 'create', method: 'POST', capability: 'number:create', pathname: base },
  {
    kind: 'publish',
    method: 'POST',
    capability: 'number:update',
    pathname: `${base}/${id}/publish`,
  },
  {
    kind: 'version',
    method: 'POST',
    capability: 'number:update',
    pathname: `${base}/${id}/versions`,
  },
] as const satisfies readonly {
  kind: string;
  method: string;
  capability: PermissionKey;
  pathname: string;
}[];
type Route = (typeof routes)[number];
const input = (kind: string): Record<string, unknown> =>
  kind === 'publish'
    ? { version: 1 }
    : {
        ...(kind === 'create' ? { code: ' NUMBER_1 ' } : {}),
        prefix: ' raw prefix ',
        suffix: ' raw suffix ',
        padding: 4,
        startingValue: 0,
        increment: 1,
        resetPeriod: ' UNKNOWN_RESET ',
      };
const parsed = (kind: string) => ({
  ...(kind === 'create' ? { code: 'NUMBER_1' } : {}),
  prefix: ' raw prefix ',
  suffix: ' raw suffix ',
  padding: 4,
  startingValue: 0,
  increment: 1,
  resetPeriod: 'UNKNOWN_RESET',
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
    list: vi.fn<Numbers['list']>().mockResolvedValue(rows),
    createDefinition: vi.fn<Numbers['createDefinition']>().mockResolvedValue(row),
    publish: vi.fn<Numbers['publish']>().mockResolvedValue(row),
    createVersion: vi.fn<Numbers['createVersion']>().mockResolvedValue(row),
    allocate: vi.fn().mockResolvedValue({ id: 'allocation-neighbor' }),
  };
  const rules = { list: vi.fn().mockResolvedValue([{ id: 'rule-neighbor' }]) };
  const entries = { listEntries: vi.fn().mockResolvedValue([{ id: 'entry-neighbor' }]) };
  const app = buildApp({
    auth: {
      authenticate: vi.fn().mockResolvedValue(context),
    } as unknown as ApiDependencies['auth'],
    organizations: {} as ApiDependencies['organizations'],
    employees: {} as ApiDependencies['employees'],
    ...(options.available === false ? {} : { numbers: repository as unknown as Numbers }),
    rules: rules as unknown as NonNullable<ApiDependencies['rules']>,
    masterData: entries as unknown as NonNullable<ApiDependencies['masterData']>,
  });
  const dispatch = (route: Route, options: Partial<ApiRequest> = {}) =>
    app.dispatch({
      method: route.method,
      pathname: route.pathname,
      body: input(route.kind),
      query: { version: 'bad', resetPeriod: 'query', unknown: 'bad' },
      ...options,
      headers: {
        authorization: 'Bearer fixture',
        'x-correlation-id': correlationId,
        'idempotency-key': 'x'.repeat(201),
        ...options.headers,
      },
    });
  return { repository, rules, entries, permissions, get, dispatch };
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
  response(statusCode, { error: { code, message, correlationId } });
const invalid = (message: string) => error(400, 'invalid_request', message);
const denied = error(403, 'forbidden', 'Permission denied');
const unavailable = error(503, 'internal_error', 'Number repository unavailable');
const missing = error(404, 'not_found', 'Route not found');
const noCalls = (f: ReturnType<typeof fixture>) => {
  for (const mock of Object.values(f.repository)) expect(mock).not.toHaveBeenCalled();
};
const configs = [routes[1], routes[3]] as const;
const writes = [routes[1], routes[2], routes[3]] as const;
const configInput = (f: ReturnType<typeof fixture>, route: Route) =>
  route.kind === 'create'
    ? f.repository.createDefinition.mock.calls[0]?.[0]
    : f.repository.createVersion.mock.calls[0]?.[1];
const bounds = [
  { key: 'padding', min: 1, max: 32 },
  { key: 'startingValue', min: 0, max: Number.MAX_SAFE_INTEGER },
  { key: 'increment', min: 1, max: Number.MAX_SAFE_INTEGER },
] as const;

describe('old number definition contracts', () => {
  it.each(routes)('$kind Q0 precedes missing repo/body/UUID', async (route) => {
    const f = fixture({ denied: route.capability, available: false });
    expect(
      await f.dispatch(route, {
        body: null,
        pathname:
          route.kind === 'publish' || route.kind === 'version'
            ? `${base}/a/${route.kind === 'publish' ? 'publish' : 'versions'}`
            : base,
      }),
    ).toEqual(denied);
    noCalls(f);
  });
  it.each(routes)('$kind denies empty scope', async (route) => {
    const f = fixture({ emptyScope: true });
    expect(await f.dispatch(route)).toEqual(denied);
    noCalls(f);
  });
  it.each(routes)('$kind missing repo precedes inputs', async (route) => {
    const f = fixture({ available: false });
    expect(
      await f.dispatch(route, {
        body: null,
        pathname:
          route.kind === 'publish' || route.kind === 'version'
            ? `${base}/a/${route.kind === 'publish' ? 'publish' : 'versions'}`
            : base,
      }),
    ).toEqual(unavailable);
    noCalls(f);
  });
  it.each(routes)('$kind global401 precedes grant/repo', async (route) => {
    const f = fixture({ denied: route.capability, available: false });
    expect(await f.dispatch(route, { body: null, headers: { authorization: '' } })).toEqual(
      error(401, 'authentication_required', 'A valid session is required'),
    );
    noCalls(f);
  });
  it.each(routes)('$kind keeps receiver/arity/raw response and no scopes', async (route) => {
    const f = fixture();
    const actual = await f.dispatch(route);
    if (route.kind === 'list') {
      expect(actual).toEqual(response(200, { items: rows }));
      expect(f.repository.list).toHaveBeenCalledExactlyOnceWith(actor.companyId);
      expect(f.repository.list.mock.contexts).toEqual([f.repository]);
    } else if (route.kind === 'create') {
      expect(actual).toEqual(response(201, row));
      expect(f.repository.createDefinition).toHaveBeenCalledExactlyOnceWith(
        parsed('create'),
        actor,
        correlationId,
      );
      expect(f.repository.createDefinition.mock.contexts).toEqual([f.repository]);
      expect(f.repository.createDefinition.mock.calls[0]?.[1]).toBe(actor);
      expect(Object.keys(configInput(f, route) ?? {})).toEqual([
        'code',
        'prefix',
        'suffix',
        'padding',
        'startingValue',
        'increment',
        'resetPeriod',
      ]);
    } else if (route.kind === 'publish') {
      expect(actual).toEqual(response(200, row));
      expect(f.repository.publish).toHaveBeenCalledExactlyOnceWith(id, 1, actor, correlationId);
      expect(f.repository.publish.mock.contexts).toEqual([f.repository]);
      expect(f.repository.publish.mock.calls[0]?.[2]).toBe(actor);
    } else {
      expect(actual).toEqual(response(201, row));
      expect(f.repository.createVersion).toHaveBeenCalledExactlyOnceWith(
        id,
        parsed('version'),
        actor,
        correlationId,
      );
      expect(f.repository.createVersion.mock.contexts).toEqual([f.repository]);
      expect(f.repository.createVersion.mock.calls[0]?.[2]).toBe(actor);
      expect(Object.keys(configInput(f, route) ?? {})).toEqual([
        'prefix',
        'suffix',
        'padding',
        'startingValue',
        'increment',
        'resetPeriod',
      ]);
    }
    if (route.kind !== 'list') expect(actual.body).toBe(row);
    expect(f.get.mock.calls.every(([capability]) => capability === route.capability)).toBe(true);
    expect(f.repository.allocate).not.toHaveBeenCalled();
  });
  it('GET creates an items wrapper, preserves array identity, and ignores body/query/header', async () => {
    const f = fixture();
    const first = await f.dispatch(routes[0], { body: false });
    const second = await f.dispatch(routes[0], { body: null });
    expect(first.body).toEqual({ items: rows });
    expect(first.body).not.toBe(rows);
    expect(first.body).not.toBe(second.body);
    expect(first.body).toHaveProperty('items', rows);
    if (
      typeof first.body !== 'object' ||
      first.body === null ||
      Array.isArray(first.body) ||
      !('items' in first.body)
    )
      throw new Error('Expected list wrapper');
    expect(first.body.items).toBe(rows);
  });
  it('GET preserves an empty array inside items', async () => {
    const f = fixture();
    const empty: typeof rows = [];
    f.repository.list.mockResolvedValue(empty);
    expect(await f.dispatch(routes[0])).toEqual(response(200, { items: empty }));
  });
  it.each([{ fields: null }, { fields: [] }, { fields: ['unrelated-field'] }] as const)(
    'all four use Q0/no projection for $fields',
    async ({ fields }) => {
      const f = fixture({ fields });
      for (const route of routes) {
        const actual = await f.dispatch(route);
        expect(actual.statusCode).toBe(
          route.kind === 'create' || route.kind === 'version' ? 201 : 200,
        );
        if (route.kind === 'list') {
          const body = actual.body;
          if (typeof body !== 'object' || body === null || !('items' in body))
            throw new Error('Expected list wrapper');
          expect(body.items).toBe(rows);
        } else expect(actual.body).toBe(row);
      }
    },
  );
  for (const route of writes) {
    describe(route.kind, () => {
      it.each([{ value: null }, { value: undefined }, { value: [] }, { value: 'body' }])(
        'O rejects $value before allow/UUID/fields',
        async ({ value }) => {
          const f = fixture();
          expect(await f.dispatch(route, { body: value })).toEqual(
            invalid('A JSON object body is required'),
          );
          noCalls(f);
        },
      );
      it('unknown fields sort before UUID/numeric parsing', async () => {
        const f = fixture();
        expect(
          await f.dispatch(route, {
            body: { z: 1, a: 2 },
            pathname:
              route.kind === 'create'
                ? base
                : `${base}/a/${route.kind === 'publish' ? 'publish' : 'versions'}`,
          }),
        ).toEqual(invalid('Unsupported fields: a, z'));
        noCalls(f);
      });
    });
  }
  for (const route of configs) {
    describe(route.kind, () => {
      for (const key of ['prefix', 'suffix'] as const) {
        it.each([
          { value: undefined },
          { value: null },
          { value: false },
          { value: 1 },
          { value: {} },
          { value: [] },
        ])(`${key} nonstring $value defaults to an own empty string`, async ({ value }) => {
          const f = fixture();
          await f.dispatch(route, { body: { ...input(route.kind), [key]: value } });
          expect(configInput(f, route)).toEqual({ ...parsed(route.kind), [key]: '' });
          expect(Object.hasOwn(configInput(f, route) ?? {}, key)).toBe(true);
        });
      }
      it('omitted prefix/suffix become explicit empty strings', async () => {
        const f = fixture();
        const body = input(route.kind);
        delete body.prefix;
        delete body.suffix;
        await f.dispatch(route, { body });
        expect(configInput(f, route)).toEqual({ ...parsed(route.kind), prefix: '', suffix: '' });
      });
      it.each(['', ' ', ' raw '])('prefix/suffix string %j is not trimmed', async (raw) => {
        const f = fixture();
        await f.dispatch(route, { body: { ...input(route.kind), prefix: raw, suffix: raw } });
        expect(configInput(f, route)).toEqual({ ...parsed(route.kind), prefix: raw, suffix: raw });
      });
      for (const field of bounds) {
        it.each([
          { value: undefined },
          { value: null },
          { value: '1' },
          { value: false },
          { value: {} },
          { value: [] },
          { value: NaN },
          { value: Infinity },
          { value: -Infinity },
          { value: 1.5 },
          { value: Number.MAX_SAFE_INTEGER + 1 },
        ])(`${field.key} rejects $value`, async ({ value }) => {
          const f = fixture();
          expect(
            await f.dispatch(route, { body: { ...input(route.kind), [field.key]: value } }),
          ).toEqual(
            invalid(
              `${field.key} must be an integer between ${String(field.min)} and ${String(field.max)}`,
            ),
          );
          noCalls(f);
        });
        it('rejects values below/above ' + field.key + ' bounds', async () => {
          const f = fixture();
          for (const value of [field.min - 1, field.max + 1])
            expect(
              await f.dispatch(route, { body: { ...input(route.kind), [field.key]: value } }),
            ).toEqual(
              invalid(
                `${field.key} must be an integer between ${String(field.min)} and ${String(field.max)}`,
              ),
            );
          noCalls(f);
        });
        it('forwards ' + field.key + ' minimum/maximum to mock, not PG proof', async () => {
          const f = fixture();
          for (const value of [field.min, field.max])
            expect(
              (await f.dispatch(route, { body: { ...input(route.kind), [field.key]: value } }))
                .statusCode,
            ).toBe(201);
          const calls =
            route.kind === 'create'
              ? f.repository.createDefinition.mock.calls.map(([input]) => input)
              : f.repository.createVersion.mock.calls.map(([, input]) => input);
          expect(calls.map((input) => input[field.key])).toEqual([field.min, field.max]);
        });
      }
      it('preserves startingValue negative zero but rejects it for padding/increment', async () => {
        const f = fixture();
        expect(
          (await f.dispatch(route, { body: { ...input(route.kind), startingValue: -0 } }))
            .statusCode,
        ).toBe(201);
        expect(Object.is(configInput(f, route)?.startingValue, -0)).toBe(true);
        for (const key of ['padding', 'increment'] as const)
          expect(await f.dispatch(route, { body: { ...input(route.kind), [key]: -0 } })).toEqual(
            invalid(
              `${key} must be an integer between 1 and ${key === 'padding' ? '32' : String(Number.MAX_SAFE_INTEGER)}`,
            ),
          );
      });
      it.each([
        { value: undefined },
        { value: null },
        { value: '' },
        { value: ' ' },
        { value: false },
      ])('resetPeriod string rejects $value without enum rules', async ({ value }) => {
        const f = fixture();
        expect(
          await f.dispatch(route, { body: { ...input(route.kind), resetPeriod: value } }),
        ).toEqual(invalid('resetPeriod is required'));
        noCalls(f);
      });
      it.each([' unknown_reset ', ' yearly '])(
        'resetPeriod %j is only string-trimmed (mock forward)',
        async (raw) => {
          const f = fixture();
          await f.dispatch(route, { body: { ...input(route.kind), resetPeriod: raw } });
          expect(configInput(f, route)?.resetPeriod).toBe(raw.trim());
        },
      );
      it.each([
        {
          patch: { padding: 0, startingValue: -1, increment: 0, resetPeriod: '' },
          message: 'padding must be an integer between 1 and 32',
        },
        {
          patch: { startingValue: -1, increment: 0, resetPeriod: '' },
          message: `startingValue must be an integer between 0 and ${String(Number.MAX_SAFE_INTEGER)}`,
        },
        {
          patch: { increment: 0, resetPeriod: '' },
          message: `increment must be an integer between 1 and ${String(Number.MAX_SAFE_INTEGER)}`,
        },
      ])('keeps composite first numeric error $message', async ({ patch, message }) => {
        const f = fixture();
        expect(await f.dispatch(route, { body: { ...input(route.kind), ...patch } })).toEqual(
          invalid(message),
        );
        noCalls(f);
      });
      it('preserves property getter evaluation order and double string reads', async () => {
        const f = fixture();
        const events: string[] = [];
        const body = {
          ...(route.kind === 'create'
            ? {
                get code() {
                  events.push('code');
                  return 'N';
                },
              }
            : {}),
          get prefix() {
            events.push('prefix');
            return ' p ';
          },
          get suffix() {
            events.push('suffix');
            return ' s ';
          },
          get padding() {
            events.push('padding');
            return 4;
          },
          get startingValue() {
            events.push('startingValue');
            return 0;
          },
          get increment() {
            events.push('increment');
            return 1;
          },
          get resetPeriod() {
            events.push('resetPeriod');
            return 'NEVER';
          },
        };
        // Object spread would evaluate the code getter early, so add it without reading.
        if (route.kind === 'create')
          Object.defineProperty(body, 'code', {
            enumerable: true,
            get() {
              events.push('code');
              return 'N';
            },
          });
        events.length = 0;
        await f.dispatch(route, { body });
        expect(events).toEqual([
          ...(route.kind === 'create' ? ['code'] : []),
          'prefix',
          'prefix',
          'suffix',
          'suffix',
          'padding',
          'startingValue',
          'increment',
          'resetPeriod',
        ]);
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
      code: 'A'.repeat(65),
      message: 'Code must be 1-64 uppercase letters, digits, underscore, or hyphen',
    },
  ])('create code $code precedes bad padding', async ({ code, message }) => {
    const f = fixture();
    expect(await f.dispatch(routes[1], { body: { ...input('create'), code, padding: 0 } })).toEqual(
      invalid(message),
    );
    noCalls(f);
  });
  it('create accepts64 code boundary', async () => {
    const f = fixture();
    await f.dispatch(routes[1], { body: { ...input('create'), code: 'A'.repeat(64) } });
    expect(f.repository.createDefinition.mock.calls[0]?.[0].code).toBe('A'.repeat(64));
  });
  it.each([routes[2], routes[3]])(
    '$kind UUID precedes all remaining bad fields after allow',
    async (route) => {
      const f = fixture();
      expect(
        await f.dispatch(route, {
          pathname: `${base}/a/${route.kind === 'publish' ? 'publish' : 'versions'}`,
          body:
            route.kind === 'publish'
              ? { version: 0 }
              : { ...input('version'), padding: 0, resetPeriod: '' },
        }),
      ).toEqual(invalid('definitionId must be a UUID'));
      noCalls(f);
    },
  );
  it.each(['code', 'version'])('versions rejects extra %s', async (key) => {
    const f = fixture();
    expect(await f.dispatch(routes[3], { body: { ...input('version'), [key]: 1 } })).toEqual(
      invalid(`Unsupported fields: ${key}`),
    );
    noCalls(f);
  });
  it('publish rejects expectedVersion instead of accepting a new version model', async () => {
    const f = fixture();
    expect(await f.dispatch(routes[2], { body: { expectedVersion: 1 } })).toEqual(
      invalid('Unsupported fields: expectedVersion'),
    );
    noCalls(f);
  });
  it.each([
    { value: undefined },
    { value: null },
    { value: '1' },
    { value: 0 },
    { value: -0 },
    { value: -1 },
    { value: 1.5 },
    { value: NaN },
    { value: Infinity },
    { value: Number.MAX_SAFE_INTEGER + 1 },
  ])('publish positive numeric version rejects $value', async ({ value }) => {
    const f = fixture();
    expect(
      await f.dispatch(routes[2], { body: { version: value }, query: { version: '1' } }),
    ).toEqual(invalid('version must be a positive integer'));
    noCalls(f);
  });
  it('publish forwards MAX_SAFE version to mock only', async () => {
    const f = fixture();
    await f.dispatch(routes[2], { body: { version: Number.MAX_SAFE_INTEGER } });
    expect(f.repository.publish).toHaveBeenCalledExactlyOnceWith(
      id,
      Number.MAX_SAFE_INTEGER,
      actor,
      correlationId,
    );
  });
  it.each([
    { method: 'GET', pathname: `${base}/${id}` },
    { method: 'PATCH', pathname: `${base}/${id}` },
    { method: 'DELETE', pathname: base },
    { method: 'POST', pathname: `${base}/publish` },
    { method: 'POST', pathname: `${base}/versions` },
    { method: 'POST', pathname: `${base}/${id.toUpperCase()}/publish` },
    { method: 'POST', pathname: `${base}/${id}/versions/extra` },
    { method: 'GET', pathname: `${base}/` },
    { method: 'POST', pathname: `${base}/not-uuid/publish` },
    { method: 'get', pathname: base },
  ])('unsupported $method $pathname remains404 even missingrepo', async ({ method, pathname }) => {
    const f = fixture({ emptyScope: true, available: false });
    expect(await f.dispatch(routes[0], { method, pathname })).toEqual(missing);
    noCalls(f);
  });
  it.each(routes)('$kind keeps repository DomainError', async (route) => {
    const f = fixture();
    const failure = new DomainError('conflict', 'number fixture conflict');
    if (route.kind === 'list') f.repository.list.mockRejectedValue(failure);
    else if (route.kind === 'create') f.repository.createDefinition.mockRejectedValue(failure);
    else if (route.kind === 'publish') f.repository.publish.mockRejectedValue(failure);
    else f.repository.createVersion.mockRejectedValue(failure);
    expect(await f.dispatch(route)).toEqual(error(409, 'conflict', 'number fixture conflict'));
  });
  it('keeps allocate and rules/entries positive without folding them into definitions', async () => {
    const f = fixture();
    f.permissions.set('number:allocate', { scopes: ['SELF'], fields: null });
    f.permissions.set('rule:read', { scopes: ['SELF'], fields: null });
    f.permissions.set('master-data:read', { scopes: ['SELF'], fields: null });
    expect(
      await f.dispatch(routes[1], {
        pathname: `${base}/${id}/allocate`,
        body: null,
        headers: { 'idempotency-key': 'neighbor-key' },
      }),
    ).toEqual(response(201, { id: 'allocation-neighbor' }));
    expect(f.repository.allocate).toHaveBeenCalledExactlyOnceWith(
      id,
      'neighbor-key',
      actor,
      correlationId,
    );
    expect(await f.dispatch(routes[0], { pathname: '/api/v1/rules' })).toEqual(
      response(200, { items: [{ id: 'rule-neighbor' }] }),
    );
    expect(
      await f.dispatch(routes[0], {
        pathname: '/api/v1/master-data/entries',
        query: { at: '2026-01-01' },
      }),
    ).toEqual(response(200, [{ id: 'entry-neighbor' }]));
    expect(f.rules.list).toHaveBeenCalledExactlyOnceWith(actor.companyId);
    expect(f.entries.listEntries).toHaveBeenCalledExactlyOnceWith(
      actor.companyId,
      null,
      new Date('2026-01-01'),
    );
    expect(f.repository.createDefinition).not.toHaveBeenCalled();
    expect(f.repository.createVersion).not.toHaveBeenCalled();
  });
});
