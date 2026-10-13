// Fixed against 941bc77's inline workflow definitions; runtime is another group.
import { describe, expect, it, vi } from 'vitest';
import { DomainError, type AuthorizationContext } from '@kingturf/domain';
import type { PermissionKey } from '@kingturf/types';
import { buildApp, type ApiDependencies, type ApiRequest } from '../src/app.js';

type Workflows = NonNullable<ApiDependencies['workflows']>;
type Grant = NonNullable<ReturnType<AuthorizationContext['permissions']['get']>>;
const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const correlationId = '33333333-3333-4333-8333-333333333333';
const actor = { companyId: 'workflow-tenant', employeeId: id };
const base = '/api/v1/workflows';
const spec = { arbitrary: { retained: true }, steps: [] };
const row = { id, version: { version: 7 }, private: { retained: true } };
const rows = [row];
const routes = [
  { kind: 'list', method: 'GET', pathname: base, capability: 'workflow:read' },
  { kind: 'create', method: 'POST', pathname: base, capability: 'workflow:create' },
  {
    kind: 'version',
    method: 'POST',
    pathname: `${base}/${id}/versions`,
    capability: 'workflow:update',
  },
  {
    kind: 'publish',
    method: 'POST',
    pathname: `${base}/${id}/publish`,
    capability: 'workflow:update',
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
    : { ...(kind === 'create' ? { code: ' FLOW_1 ' } : {}), spec };
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
    list: vi.fn<Workflows['list']>().mockResolvedValue(rows),
    create: vi.fn<Workflows['create']>().mockResolvedValue(row),
    createVersion: vi.fn<Workflows['createVersion']>().mockResolvedValue(row),
    publish: vi.fn<Workflows['publish']>().mockResolvedValue(row),
    start: vi.fn().mockResolvedValue({ id: 'instance-neighbor' }),
    listTasks: vi.fn().mockResolvedValue([{ id: 'task-neighbor' }]),
    decide: vi.fn().mockResolvedValue({ id: 'decision-neighbor' }),
  };
  const rules = { createVersion: vi.fn().mockResolvedValue({ id: 'rule-neighbor' }) };
  const app = buildApp({
    auth: {
      authenticate: vi.fn().mockResolvedValue(context),
    } as unknown as ApiDependencies['auth'],
    organizations: {} as ApiDependencies['organizations'],
    employees: {} as ApiDependencies['employees'],
    ...(options.available === false ? {} : { workflows: repository as unknown as Workflows }),
    rules: rules as unknown as NonNullable<ApiDependencies['rules']>,
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
  return { repository, rules, permissions, get, dispatch };
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
const unavailable = error(503, 'internal_error', 'Workflow repository unavailable');
const missing = error(404, 'not_found', 'Route not found');
const objectRequired = invalid('A JSON object body is required');
const noCalls = (f: ReturnType<typeof fixture>) => {
  for (const mock of Object.values(f.repository)) expect(mock).not.toHaveBeenCalled();
};
const configs = [routes[1], routes[2]] as const;
const writes = [routes[1], routes[2], routes[3]] as const;
const forwardedSpec = (f: ReturnType<typeof fixture>, route: Route) =>
  route.kind === 'create'
    ? f.repository.create.mock.calls[0]?.[0].spec
    : f.repository.createVersion.mock.calls[0]?.[1];

describe('old workflow definition contracts', () => {
  it.each(routes)('$kind Q0 precedes missingrepo/body/UUID/spec', async (route) => {
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
  it.each(routes)('$kind empty scope denies', async (route) => {
    const f = fixture({ emptyScope: true });
    expect(await f.dispatch(route)).toEqual(denied);
    noCalls(f);
  });
  it.each(routes)('$kind authorized missingrepo precedes input', async (route) => {
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
  it.each(routes)('$kind global401 precedes Q0/repo', async (route) => {
    const f = fixture({ denied: route.capability, available: false });
    expect(await f.dispatch(route, { body: null, headers: { authorization: '' } })).toEqual(
      error(401, 'authentication_required', 'A valid session is required'),
    );
    noCalls(f);
  });
  it.each(routes)('$kind rawresponse/receiver/arity and actor reference', async (route) => {
    const f = fixture();
    const actual = await f.dispatch(route);
    if (route.kind === 'list') {
      expect(actual).toEqual(response(200, { items: rows }));
      expect(f.repository.list).toHaveBeenCalledExactlyOnceWith(actor.companyId);
      expect(f.repository.list.mock.contexts).toEqual([f.repository]);
    } else if (route.kind === 'create') {
      expect(actual).toEqual(response(201, row));
      expect(f.repository.create).toHaveBeenCalledExactlyOnceWith(
        { code: 'FLOW_1', spec },
        actor,
        correlationId,
      );
      expect(f.repository.create.mock.contexts).toEqual([f.repository]);
      expect(f.repository.create.mock.calls[0]?.[1]).toBe(actor);
      expect(Object.keys(f.repository.create.mock.calls[0]?.[0] ?? {})).toEqual(['code', 'spec']);
      expect(forwardedSpec(f, route)).toBe(spec);
    } else if (route.kind === 'version') {
      expect(actual).toEqual(response(201, row));
      expect(f.repository.createVersion).toHaveBeenCalledExactlyOnceWith(
        id,
        spec,
        actor,
        correlationId,
      );
      expect(f.repository.createVersion.mock.contexts).toEqual([f.repository]);
      expect(f.repository.createVersion.mock.calls[0]?.[2]).toBe(actor);
      expect(f.repository.createVersion.mock.calls[0]?.[1]).toBe(spec);
      expect(f.repository.createVersion.mock.calls[0]?.[1]).not.toEqual({ spec });
    } else {
      expect(actual).toEqual(response(200, row));
      expect(f.repository.publish).toHaveBeenCalledExactlyOnceWith(id, 1, actor, correlationId);
      expect(f.repository.publish.mock.contexts).toEqual([f.repository]);
      expect(f.repository.publish.mock.calls[0]?.[2]).toBe(actor);
    }
    if (route.kind !== 'list') expect(actual.body).toBe(row);
    expect(f.get.mock.calls.every(([cap]) => cap === route.capability)).toBe(true);
    expect(f.repository.start).not.toHaveBeenCalled();
    expect(f.repository.listTasks).not.toHaveBeenCalled();
    expect(f.repository.decide).not.toHaveBeenCalled();
  });
  it('GET newwrapper preserves array identity and ignores body/query/header', async () => {
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
  it('GET empty items remains wrapper', async () => {
    const f = fixture();
    f.repository.list.mockResolvedValue([]);
    expect(await f.dispatch(routes[0])).toEqual(response(200, { items: [] }));
  });
  it.each([{ fields: null }, { fields: [] }, { fields: ['unrelated'] }] as const)(
    'Q0 fields $fields do not project',
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
      { value: '' },
      { value: false },
      { value: 1 },
    ])(`${route.kind} root O rejects $value before allow/UUID`, async ({ value }) => {
      const f = fixture();
      expect(await f.dispatch(route, { body: value })).toEqual(objectRequired);
      noCalls(f);
    });
    it(`${route.kind} unknownkeys sort before UUID/code/spec/version`, async () => {
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
    it(`${route.kind} missing/empty header key ignored`, async () => {
      const f = fixture();
      for (const key of [undefined, ''])
        expect((await f.dispatch(route, { headers: { 'idempotency-key': key } })).statusCode).toBe(
          route.kind === 'publish' ? 200 : 201,
        );
    });
  }
  for (const route of configs) {
    describe(route.kind, () => {
      it.each([
        { value: undefined },
        { value: null },
        { value: [] },
        { value: '' },
        { value: 'spec' },
        { value: false },
        { value: 1 },
      ])('nested spec O rejects $value generically', async ({ value }) => {
        const f = fixture();
        expect(await f.dispatch(route, { body: { ...input(route.kind), spec: value } })).toEqual(
          objectRequired,
        );
        noCalls(f);
      });
      it('omitted spec does not default{}', async () => {
        const f = fixture();
        const body = input(route.kind);
        delete body.spec;
        expect(await f.dispatch(route, { body })).toEqual(objectRequired);
        noCalls(f);
      });
      it.each([
        { value: {} },
        { value: spec },
        {
          value: {
            states: 'unchecked',
            steps: [null],
            eligibleRoles: 1,
            deep: { unknown: undefined },
            notFinite: NaN,
          },
        },
      ])('shallow spec $value forwarded by reference (mock only)', async ({ value }) => {
        const f = fixture();
        const actual = await f.dispatch(route, { body: { ...input(route.kind), spec: value } });
        expect(actual).toEqual(response(201, row));
        expect(actual.body).toBe(row);
        expect(forwardedSpec(f, route)).toBe(value);
        if (route.kind === 'create')
          expect(Object.keys(f.repository.create.mock.calls[0]?.[0] ?? {})).toEqual([
            'code',
            'spec',
          ]);
        else expect(f.repository.createVersion.mock.calls[0]?.length).toBe(4);
      });
      it('getter order keeps code before spec only for create', async () => {
        const f = fixture();
        const events: string[] = [];
        const body = {
          get spec() {
            events.push('spec');
            return spec;
          },
        };
        if (route.kind === 'create')
          Object.defineProperty(body, 'code', {
            enumerable: true,
            get() {
              events.push('code');
              return 'FLOW_1';
            },
          });
        expect((await f.dispatch(route, { body })).statusCode).toBe(201);
        expect(events).toEqual([...(route.kind === 'create' ? ['code'] : []), 'spec']);
        expect(forwardedSpec(f, route)).toBe(spec);
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
  ])('code $code precedes nested badspec and getter', async ({ code, message }) => {
    const f = fixture();
    const getter = vi.fn(() => null);
    const body = Object.defineProperty({ code }, 'spec', { enumerable: true, get: getter });
    expect(await f.dispatch(routes[1], { body })).toEqual(invalid(message));
    expect(getter).not.toHaveBeenCalled();
    noCalls(f);
  });
  it('stablecode64 boundary trims only code', async () => {
    const f = fixture();
    await f.dispatch(routes[1], { body: { code: ` ${'A'.repeat(64)} `, spec } });
    expect(f.repository.create.mock.calls[0]?.[0].code).toBe('A'.repeat(64));
  });
  it.each([routes[2], routes[3]])('$kind UUID precedes nested spec/V', async (route) => {
    const f = fixture();
    const getter = vi.fn(() => null);
    const body =
      route.kind === 'publish'
        ? { version: 0 }
        : Object.defineProperty({}, 'spec', { enumerable: true, get: getter });
    expect(
      await f.dispatch(route, {
        pathname: `${base}/a/${route.kind === 'publish' ? 'publish' : 'versions'}`,
        body,
      }),
    ).toEqual(invalid('workflowId must be a UUID'));
    expect(getter).not.toHaveBeenCalled();
    noCalls(f);
  });
  it.each(['code', 'version', 'expectedVersion'])('versions rejects extra %s', async (key) => {
    const f = fixture();
    expect(await f.dispatch(routes[2], { body: { spec, [key]: 1 } })).toEqual(
      invalid(`Unsupported fields: ${key}`),
    );
    noCalls(f);
  });
  it('publish bad UUID precedes version getter', async () => {
    const f = fixture();
    const getter = vi.fn(() => {
      throw new Error('Version must not be read');
    });
    const body = Object.defineProperty({}, 'version', { enumerable: true, get: getter });
    expect(await f.dispatch(routes[3], { pathname: `${base}/a/publish`, body })).toEqual(
      invalid('workflowId must be a UUID'),
    );
    expect(getter).not.toHaveBeenCalled();
    noCalls(f);
  });
  it('publish rejects expectedVersion', async () => {
    const f = fixture();
    expect(await f.dispatch(routes[3], { body: { expectedVersion: 1 } })).toEqual(
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
  ])('body V rejects $value without query fallback', async ({ value }) => {
    const f = fixture();
    expect(
      await f.dispatch(routes[3], { body: { version: value }, query: { version: '1' } }),
    ).toEqual(invalid('version must be a positive integer'));
    noCalls(f);
  });
  it('publish MAX_SAFE reaches mock, not PG boundary proof', async () => {
    const f = fixture();
    expect((await f.dispatch(routes[3], { body: { version: Number.MAX_SAFE_INTEGER } })).body).toBe(
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
    { method: 'POST', pathname: `${base}/versions` },
    { method: 'POST', pathname: `${base}/publish` },
    { method: 'POST', pathname: `${base}/${id.toUpperCase()}/versions` },
    { method: 'POST', pathname: `${base}/${id}/publish/extra` },
    { method: 'POST', pathname: `${base}/not-uuid/versions` },
    { method: 'GET', pathname: `${base}/` },
    { method: 'get', pathname: base },
  ])('unsupported $method $pathname stays404 even missingrepo', async (request) => {
    const f = fixture({ available: false, emptyScope: true });
    expect(await f.dispatch(routes[0], request)).toEqual(missing);
    noCalls(f);
  });
  it.each(routes)('$kind preserves repository DomainError (mock only)', async (route) => {
    const f = fixture();
    const failure = new DomainError('invalid_request', 'Workflow fixture rejected');
    if (route.kind === 'list') f.repository.list.mockRejectedValue(failure);
    else if (route.kind === 'create') f.repository.create.mockRejectedValue(failure);
    else if (route.kind === 'version') f.repository.createVersion.mockRejectedValue(failure);
    else f.repository.publish.mockRejectedValue(failure);
    expect(await f.dispatch(route)).toEqual(invalid('Workflow fixture rejected'));
  });
  it('ruleVersion and workflow runtime stay positive, not definition group', async () => {
    const f = fixture();
    for (const cap of ['rule:update', 'workflow:start', 'workflow:decide'] as const)
      f.permissions.set(cap, { scopes: ['SELF'], fields: null });
    const ast = { arbitrary: true };
    expect(
      await f.dispatch(routes[1], {
        pathname: `/api/v1/rules/${id}/versions`,
        body: { ast, requiredInputs: [] },
      }),
    ).toEqual(response(201, { id: 'rule-neighbor' }));
    expect(f.rules.createVersion).toHaveBeenCalledExactlyOnceWith(
      id,
      { ast, requiredInputs: [] },
      actor,
      correlationId,
    );
    expect(
      await f.dispatch(routes[1], {
        pathname: `${base}/${id}/instances`,
        body: { subjectType: 'generic', subjectId: id },
        headers: { 'idempotency-key': 'neighbor-key' },
      }),
    ).toEqual(response(201, { id: 'instance-neighbor' }));
    expect(f.repository.start).toHaveBeenCalledExactlyOnceWith(
      id,
      'generic',
      id,
      'neighbor-key',
      actor,
      correlationId,
    );
    expect(await f.dispatch(routes[0], { pathname: '/api/v1/workflow-tasks', body: null })).toEqual(
      response(200, [{ id: 'task-neighbor' }]),
    );
    expect(f.repository.listTasks).toHaveBeenCalledExactlyOnceWith(actor);
    expect(
      await f.dispatch(routes[1], {
        pathname: `/api/v1/workflow-tasks/${id}/decisions`,
        body: { decision: 'approve', version: 1 },
        headers: { 'idempotency-key': 'neighbor-key' },
      }),
    ).toEqual(response(200, { id: 'decision-neighbor' }));
    expect(f.repository.decide).toHaveBeenCalledExactlyOnceWith(
      id,
      'approve',
      null,
      'neighbor-key',
      1,
      actor,
      correlationId,
    );
    expect(f.repository.create).not.toHaveBeenCalled();
    expect(f.repository.createVersion).not.toHaveBeenCalled();
    expect(f.repository.publish).not.toHaveBeenCalled();
  });
});
