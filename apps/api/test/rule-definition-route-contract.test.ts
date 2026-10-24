// Fixed against 84dc0b4's inline rule definitions; evaluate is a separate group.
import { describe, expect, it, vi } from 'vitest';
import { DomainError, type AuthorizationContext } from '@kingturf/domain';
import type { PermissionKey } from '@kingturf/types';
import { buildApp, type ApiDependencies, type ApiRequest } from '../src/app.js';

type Rules = NonNullable<ApiDependencies['rules']>;
type Grant = NonNullable<ReturnType<AuthorizationContext['permissions']['get']>>;
const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const correlationId = '33333333-3333-4333-8333-333333333333';
const actor = { companyId: 'rule-tenant', employeeId: id };
const base = '/api/v1/rules';
const ast = { arbitrary: { retained: true } };
const row = { id, version: { version: 7 }, private: { retained: true } };
const rows = [row];
const routes = [
  { kind: 'list', method: 'GET', pathname: base, capability: 'rule:read' },
  { kind: 'create', method: 'POST', pathname: base, capability: 'rule:create' },
  { kind: 'publish', method: 'POST', pathname: `${base}/${id}/publish`, capability: 'rule:update' },
  {
    kind: 'version',
    method: 'POST',
    pathname: `${base}/${id}/versions`,
    capability: 'rule:update',
  },
] as const satisfies readonly {
  kind: string;
  method: string;
  pathname: string;
  capability: PermissionKey;
}[];
type Route = (typeof routes)[number];
const input = (kind: string): Record<string, unknown> =>
  kind === 'publish'
    ? { version: 1 }
    : {
        ...(kind === 'create' ? { code: ' RULE_1 ' } : {}),
        ast,
        requiredInputs: ['x', ' x ', 'B', 'x', 'a'],
      };
const parsed = (kind: string) => ({
  ...(kind === 'create' ? { code: 'RULE_1' } : {}),
  ast,
  requiredInputs: [' x ', 'B', 'a', 'x'],
});
function fixture(
  options: {
    denied?: PermissionKey;
    emptyScope?: boolean;
    available?: boolean;
    fields?: Grant['fields'];
  } = {},
) {
  const permissions = new Map<PermissionKey, Grant>(
    routes
      .filter((r) => r.capability !== options.denied)
      .map((r) => [
        r.capability,
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
      routes.map((r) => [r.capability, [{ scope: 'TEAM', organizationId: 'not-forwarded' }]]),
    ),
  };
  const get = vi.spyOn(permissions, 'get');
  const repository = {
    list: vi.fn<Rules['list']>().mockResolvedValue(rows),
    create: vi.fn<Rules['create']>().mockResolvedValue(row),
    publish: vi.fn<Rules['publish']>().mockResolvedValue(row),
    createVersion: vi.fn<Rules['createVersion']>().mockResolvedValue(row),
    evaluate: vi.fn().mockResolvedValue({ id: 'evaluate-neighbor' }),
  };
  const entries = { listEntries: vi.fn().mockResolvedValue([{ id: 'entry-neighbor' }]) };
  const numbers = { createVersion: vi.fn().mockResolvedValue({ id: 'number-neighbor' }) };
  const workflows = { list: vi.fn().mockResolvedValue([{ id: 'workflow-neighbor' }]) };
  const app = buildApp({
    auth: {
      authenticate: vi.fn().mockResolvedValue(context),
    } as unknown as ApiDependencies['auth'],
    organizations: {} as ApiDependencies['organizations'],
    employees: {} as ApiDependencies['employees'],
    ...(options.available === false ? {} : { rules: repository as unknown as Rules }),
    masterData: entries as unknown as NonNullable<ApiDependencies['masterData']>,
    numbers: numbers as unknown as NonNullable<ApiDependencies['numbers']>,
    workflows: workflows as unknown as NonNullable<ApiDependencies['workflows']>,
  });
  const dispatch = (route: Route, options: Partial<ApiRequest> = {}) =>
    app.dispatch({
      method: route.method,
      pathname: route.pathname,
      body: input(route.kind),
      query: { version: 'bad', unknown: 'ignored' },
      ...options,
      headers: {
        authorization: 'Bearer fixture',
        'x-correlation-id': correlationId,
        'idempotency-key': 'x'.repeat(201),
        ...options.headers,
      },
    });
  return { repository, entries, numbers, workflows, permissions, get, dispatch };
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
const invalid = (message: string) => error(400, 'invalid_request', message);
const denied = error(403, 'forbidden', 'Permission denied');
const unavailable = error(503, 'internal_error', 'Rule repository unavailable');
const missing = error(404, 'not_found', 'Route not found');
const noCalls = (f: ReturnType<typeof fixture>) => {
  for (const mock of Object.values(f.repository)) expect(mock).not.toHaveBeenCalled();
};
const configs = [routes[1], routes[3]] as const;
const writes = [routes[1], routes[2], routes[3]] as const;
const configInput = (f: ReturnType<typeof fixture>, route: Route) =>
  route.kind === 'create'
    ? f.repository.create.mock.calls[0]?.[0]
    : f.repository.createVersion.mock.calls[0]?.[1];

describe('old rule definition contracts', () => {
  it.each(routes)('$kind Q0 precedes missingrepo/body/UUID', async (route) => {
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
  it.each(routes)('$kind empty scope is denied', async (route) => {
    const f = fixture({ emptyScope: true });
    expect(await f.dispatch(route)).toEqual(denied);
    noCalls(f);
  });
  it.each(routes)('$kind authorized missingrepo precedes inputs', async (route) => {
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
  it.each(routes)('$kind global401 precedes Q0/repo/input', async (route) => {
    const f = fixture({ denied: route.capability, available: false });
    expect(await f.dispatch(route, { body: null, headers: { authorization: '' } })).toEqual(
      error(401, 'authentication_required', 'A valid session is required'),
    );
    noCalls(f);
  });
  it.each(routes)('$kind preserves receiver/arity/rawresponse', async (route) => {
    const f = fixture();
    const actual = await f.dispatch(route);
    if (route.kind === 'list') {
      expect(actual).toEqual(response(200, { items: rows }));
      expect(f.repository.list).toHaveBeenCalledExactlyOnceWith(actor.companyId);
      expect(f.repository.list.mock.contexts).toEqual([f.repository]);
    } else if (route.kind === 'create') {
      expect(actual).toEqual(response(201, row));
      expect(f.repository.create).toHaveBeenCalledExactlyOnceWith(
        parsed('create'),
        actor,
        correlationId,
      );
      expect(f.repository.create.mock.contexts).toEqual([f.repository]);
      expect(f.repository.create.mock.calls[0]?.[1]).toBe(actor);
      expect(Object.keys(configInput(f, route) ?? {})).toEqual(['code', 'ast', 'requiredInputs']);
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
      expect(Object.keys(configInput(f, route) ?? {})).toEqual(['ast', 'requiredInputs']);
    }
    if (route.kind !== 'list') expect(actual.body).toBe(row);
    expect(f.get.mock.calls.every(([cap]) => cap === route.capability)).toBe(true);
    expect(f.repository.evaluate).not.toHaveBeenCalled();
  });
  it('GET creates new wrapper but preserves items array, ignores query/body/header', async () => {
    const f = fixture();
    const first = await f.dispatch(routes[0], { body: false });
    const second = await f.dispatch(routes[0], { body: null });
    expect(first).toEqual(response(200, { items: rows }));
    expect(first.body).not.toBe(rows);
    expect(first.body).not.toBe(second.body);
    if (typeof first.body !== 'object' || first.body === null || !('items' in first.body))
      throw new Error('Expected wrapper');
    expect(first.body.items).toBe(rows);
  });
  it('GET empty list stays items[]', async () => {
    const f = fixture();
    f.repository.list.mockResolvedValue([]);
    expect(await f.dispatch(routes[0])).toEqual(response(200, { items: [] }));
  });
  it.each([{ fields: null }, { fields: [] }, { fields: ['unrelated'] }] as const)(
    'Q0 fields $fields never project',
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
            throw new Error('Expected wrapper');
          expect(body.items).toBe(rows);
        } else expect(actual.body).toBe(row);
      }
    },
  );
  for (const route of writes) {
    it.each([
      { value: undefined },
      { value: null },
      { value: [] },
      { value: 'body' },
      { value: false },
    ])(`${route.kind} O rejects $value before allow/UUID`, async ({ value }) => {
      const f = fixture();
      expect(await f.dispatch(route, { body: value })).toEqual(
        invalid('A JSON object body is required'),
      );
      noCalls(f);
    });
    it(`${route.kind} sorted unknown fields precede UUID/code/strings`, async () => {
      const f = fixture();
      expect(
        await f.dispatch(route, {
          body: { z: 1, a: 1 },
          pathname:
            route.kind === 'create'
              ? base
              : `${base}/a/${route.kind === 'publish' ? 'publish' : 'versions'}`,
        }),
      ).toEqual(invalid('Unsupported fields: a, z'));
      noCalls(f);
    });
  }
  for (const route of configs) {
    describe(route.kind, () => {
      it.each([
        { value: undefined },
        { value: null },
        { value: false },
        { value: 1 },
        { value: '' },
        { value: 'unknown-ast' },
        { value: [] },
        { value: ast },
      ])('ast $value forwarded raw (mock only)', async ({ value }) => {
        const f = fixture();
        const actual = await f.dispatch(route, { body: { ...input(route.kind), ast: value } });
        expect(actual).toEqual(response(201, row));
        expect(configInput(f, route)?.ast).toBe(value);
        expect(Object.hasOwn(configInput(f, route) ?? {}, 'ast')).toBe(true);
      });
      it('omitted ast becomes own undefined, not HTTP required', async () => {
        const f = fixture();
        const body = input(route.kind);
        delete body.ast;
        expect((await f.dispatch(route, { body })).statusCode).toBe(201);
        expect(configInput(f, route)?.ast).toBeUndefined();
        expect(Object.hasOwn(configInput(f, route) ?? {}, 'ast')).toBe(true);
      });
      it.each([{ value: undefined }, { value: null }, { value: [] }])(
        'requiredInputs $value becomes empty[]',
        async ({ value }) => {
          const f = fixture();
          await f.dispatch(route, { body: { ...input(route.kind), requiredInputs: value } });
          expect(configInput(f, route)?.requiredInputs).toEqual([]);
          expect(Object.hasOwn(configInput(f, route) ?? {}, 'requiredInputs')).toBe(true);
        },
      );
      it('omitted requiredInputs becomes own[]', async () => {
        const f = fixture();
        const body = input(route.kind);
        delete body.requiredInputs;
        await f.dispatch(route, { body });
        expect(configInput(f, route)?.requiredInputs).toEqual([]);
      });
      it.each([
        { value: '' },
        { value: 'x' },
        { value: false },
        { value: 1 },
        { value: {} },
        { value: [''] },
        { value: [' '] },
        { value: [null] },
        { value: [undefined] },
        { value: [1] },
        { value: ['ok', ' '] },
      ])('requiredInputs rejects $value', async ({ value }) => {
        const f = fixture();
        expect(
          await f.dispatch(route, { body: { ...input(route.kind), requiredInputs: value } }),
        ).toEqual(invalid('requiredInputs must be an array of non-empty strings'));
        noCalls(f);
      });
      it.each([
        { value: ['x', ' x ', 'x', 'X', 'a', 'B'], expected: [' x ', 'B', 'X', 'a', 'x'] },
        { value: ['z', 'a', 'z'], expected: ['a', 'z'] },
        { value: ['a\n', 'a', ' a'], expected: [' a', 'a', 'a\n'] },
      ])('exact-string Set/sort without trim $value', async ({ value, expected }) => {
        const f = fixture();
        const copy = [...value];
        await f.dispatch(route, { body: { ...input(route.kind), requiredInputs: value } });
        expect(configInput(f, route)?.requiredInputs).toEqual(expected);
        expect(configInput(f, route)?.requiredInputs).not.toBe(value);
        expect(value).toEqual(copy);
      });
      it('reads ast then requiredInputs exactly once (code first only create)', async () => {
        const f = fixture();
        const events: string[] = [];
        const body = {
          get ast() {
            events.push('ast');
            return ast;
          },
          get requiredInputs() {
            events.push('requiredInputs');
            return [' x ', 'x'];
          },
        };
        if (route.kind === 'create')
          Object.defineProperty(body, 'code', {
            enumerable: true,
            get() {
              events.push('code');
              return 'RULE_1';
            },
          });
        await f.dispatch(route, { body });
        expect(events).toEqual([
          ...(route.kind === 'create' ? ['code'] : []),
          'ast',
          'requiredInputs',
        ]);
      });
    });
  }
  it.each([
    { code: undefined, message: 'code is required' },
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
  ])('create code $code precedes bad strings and ast read', async ({ code, message }) => {
    const f = fixture();
    const getter = vi.fn(() => ast);
    const body = Object.defineProperty({ code, requiredInputs: 1 }, 'ast', {
      enumerable: true,
      get: getter,
    });
    expect(await f.dispatch(routes[1], { body })).toEqual(invalid(message));
    expect(getter).not.toHaveBeenCalled();
    noCalls(f);
  });
  it('create stablecode boundary64 trims code only', async () => {
    const f = fixture();
    await f.dispatch(routes[1], { body: { ...input('create'), code: ` ${'A'.repeat(64)} ` } });
    expect(f.repository.create.mock.calls[0]?.[0].code).toBe('A'.repeat(64));
  });
  it.each([routes[2], routes[3]])('$kind UUID precedes remaining values/getters', async (route) => {
    const f = fixture();
    const getter = vi.fn(() => ast);
    const body =
      route.kind === 'publish'
        ? { version: 0 }
        : Object.defineProperty({ requiredInputs: 1 }, 'ast', { enumerable: true, get: getter });
    expect(
      await f.dispatch(route, {
        pathname: `${base}/a/${route.kind === 'publish' ? 'publish' : 'versions'}`,
        body,
      }),
    ).toEqual(invalid('ruleId must be a UUID'));
    expect(getter).not.toHaveBeenCalled();
    noCalls(f);
  });
  it.each(['code', 'version'])('versions rejects extra %s', async (key) => {
    const f = fixture();
    expect(await f.dispatch(routes[3], { body: { ...input('version'), [key]: 1 } })).toEqual(
      invalid(`Unsupported fields: ${key}`),
    );
    noCalls(f);
  });
  it('publish rejects expectedVersion', async () => {
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
  ])('publish version rejects $value without query fallback', async ({ value }) => {
    const f = fixture();
    expect(
      await f.dispatch(routes[2], { body: { version: value }, query: { version: '1' } }),
    ).toEqual(invalid('version must be a positive integer'));
    noCalls(f);
  });
  it('publish MAX_SAFE reaches mock only', async () => {
    const f = fixture();
    expect((await f.dispatch(routes[2], { body: { version: Number.MAX_SAFE_INTEGER } })).body).toBe(
      row,
    );
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
    { method: 'POST', pathname: `${base}/not-uuid/publish` },
    { method: 'GET', pathname: `${base}/` },
    { method: 'get', pathname: base },
  ])('unsupported $method $pathname stays404 even missingrepo', async (request) => {
    const f = fixture({ available: false, emptyScope: true });
    expect(await f.dispatch(routes[0], request)).toEqual(missing);
    noCalls(f);
  });
  it.each(routes)('$kind preserves repository DomainError', async (route) => {
    const f = fixture();
    const failure = new DomainError('invalid_request', 'Rule expression fixture rejected');
    if (route.kind === 'list') f.repository.list.mockRejectedValue(failure);
    else if (route.kind === 'create') f.repository.create.mockRejectedValue(failure);
    else if (route.kind === 'publish') f.repository.publish.mockRejectedValue(failure);
    else f.repository.createVersion.mockRejectedValue(failure);
    expect(await f.dispatch(route)).toEqual(invalid('Rule expression fixture rejected'));
  });
  it('evaluate/entries/numberVersion/workflows stay positive, not definitions', async () => {
    const f = fixture();
    for (const cap of [
      'rule:evaluate',
      'master-data:read',
      'number:update',
      'workflow:read',
    ] as const)
      f.permissions.set(cap, { scopes: ['SELF'], fields: null });
    const evaluationInput = { flag: true };
    expect(
      await f.dispatch(routes[1], {
        pathname: `${base}/${id}/evaluate`,
        body: { input: evaluationInput },
        headers: { 'idempotency-key': 'neighbor-key' },
      }),
    ).toEqual(response(200, { id: 'evaluate-neighbor' }));
    expect(f.repository.evaluate).toHaveBeenCalledExactlyOnceWith(
      id,
      evaluationInput,
      'neighbor-key',
      actor,
      correlationId,
    );
    expect(
      await f.dispatch(routes[0], {
        pathname: '/api/v1/master-data/entries',
        query: { at: '2026-01-01' },
      }),
    ).toEqual(response(200, [{ id: 'entry-neighbor' }]));
    expect(f.entries.listEntries).toHaveBeenCalledExactlyOnceWith(
      actor.companyId,
      null,
      new Date('2026-01-01'),
    );
    expect(
      await f.dispatch(routes[1], {
        pathname: `/api/v1/number-definitions/${id}/versions`,
        body: {
          prefix: '',
          suffix: '',
          padding: 1,
          startingValue: 0,
          increment: 1,
          resetPeriod: 'NEVER',
        },
      }),
    ).toEqual(response(201, { id: 'number-neighbor' }));
    expect(f.numbers.createVersion).toHaveBeenCalledExactlyOnceWith(
      id,
      { prefix: '', suffix: '', padding: 1, startingValue: 0, increment: 1, resetPeriod: 'NEVER' },
      actor,
      correlationId,
    );
    expect(await f.dispatch(routes[0], { pathname: '/api/v1/workflows' })).toEqual(
      response(200, { items: [{ id: 'workflow-neighbor' }] }),
    );
    expect(f.workflows.list).toHaveBeenCalledExactlyOnceWith(actor.companyId);
    expect(f.repository.create).not.toHaveBeenCalled();
    expect(f.repository.createVersion).not.toHaveBeenCalled();
    expect(f.repository.publish).not.toHaveBeenCalled();
  });
});
