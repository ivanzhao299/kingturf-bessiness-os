// Fixed against 5e5331a's inline runtime; no future route module imported.
import { describe, expect, it, vi } from 'vitest';
import { DomainError, type AuthorizationContext } from '@kingturf/domain';
import type { PermissionKey } from '@kingturf/types';
import { buildApp, type ApiDependencies, type ApiRequest } from '../src/app.js';

type Workflows = NonNullable<ApiDependencies['workflows']>;
type Grant = NonNullable<ReturnType<AuthorizationContext['permissions']['get']>>;
const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const subjectId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const correlationId = '33333333-3333-4333-8333-333333333333';
const actor = { companyId: 'runtime-tenant', employeeId: id };
const row = { id: 'runtime-row', private: { retained: true } };
const rows = [row];
const key = 'runtime-key';
const routes = [
  {
    kind: 'start',
    method: 'POST',
    pathname: `/api/v1/workflows/${id}/instances`,
    capability: 'workflow:start',
  },
  {
    kind: 'list',
    method: 'GET',
    pathname: '/api/v1/workflow-tasks',
    capability: 'workflow:decide',
  },
  {
    kind: 'decide',
    method: 'POST',
    pathname: `/api/v1/workflow-tasks/${id}/decisions`,
    capability: 'workflow:decide',
  },
] as const satisfies readonly {
  kind: string;
  method: string;
  pathname: string;
  capability: PermissionKey;
}[];
type Route = (typeof routes)[number];
const writes = [routes[0], routes[2]] as const;
const input = (route: Route): Record<string, unknown> =>
  route.kind === 'start'
    ? { subjectType: ' generic ', subjectId }
    : { decision: ' approve ', version: 1 };
const badPath = (route: Route) =>
  route.kind === 'start' ? '/api/v1/workflows/a/instances' : '/api/v1/workflow-tasks/a/decisions';
function fixture(
  options: {
    denied?: PermissionKey;
    available?: boolean;
    emptyScope?: boolean;
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
    start: vi.fn<Workflows['start']>().mockResolvedValue(row),
    listTasks: vi.fn<Workflows['listTasks']>().mockResolvedValue(rows),
    decide: vi.fn<Workflows['decide']>().mockResolvedValue(row),
    list: vi.fn<Workflows['list']>().mockResolvedValue(rows),
    create: vi.fn<Workflows['create']>().mockResolvedValue({ ...row, version: undefined }),
    createVersion: vi.fn<Workflows['createVersion']>().mockResolvedValue(row),
    publish: vi.fn<Workflows['publish']>().mockResolvedValue(row),
  };
  const app = buildApp({
    auth: {
      authenticate: vi.fn().mockResolvedValue(context),
    } as unknown as ApiDependencies['auth'],
    organizations: {} as ApiDependencies['organizations'],
    employees: {} as ApiDependencies['employees'],
    ...(options.available === false ? {} : { workflows: repository as unknown as Workflows }),
  });
  const dispatch = (route: Route, options: Partial<ApiRequest> = {}) =>
    app.dispatch({
      method: route.method,
      pathname: route.pathname,
      body: input(route),
      query: { version: 'bad', 'idempotency-key': 'query-key' },
      ...options,
      headers: {
        authorization: 'Bearer fixture',
        'x-correlation-id': correlationId,
        'idempotency-key': key,
        ...options.headers,
      },
    });
  return { repository, permissions, get, dispatch };
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
const keyRequired = invalid('Idempotency-Key header is required');
const objectRequired = invalid('A JSON object body is required');
const noCalls = (f: ReturnType<typeof fixture>) => {
  for (const mock of Object.values(f.repository)) expect(mock).not.toHaveBeenCalled();
};
const keyArg = (f: ReturnType<typeof fixture>, route: Route) =>
  route.kind === 'start'
    ? f.repository.start.mock.calls[0]?.[3]
    : f.repository.decide.mock.calls[0]?.[3];

describe('old workflow runtime contracts', () => {
  it.each(routes)('$kind Q0 precedes missingrepo/key/body', async (route) => {
    const f = fixture({ denied: route.capability, available: false });
    expect(await f.dispatch(route, { body: null, headers: { 'idempotency-key': '' } })).toEqual(
      denied,
    );
    noCalls(f);
  });
  it.each(routes)('$kind empty scopes deny', async (route) => {
    const f = fixture({ emptyScope: true });
    expect(await f.dispatch(route)).toEqual(denied);
    noCalls(f);
  });
  it.each(routes)('$kind authorized missingrepo precedes key/body/getter', async (route) => {
    const f = fixture({ available: false });
    const getter = vi.fn(() => {
      throw new Error('Body must not be read');
    });
    const body = Object.defineProperty({}, route.kind === 'start' ? 'subjectType' : 'decision', {
      enumerable: true,
      get: getter,
    });
    expect(await f.dispatch(route, { body, headers: { 'idempotency-key': '' } })).toEqual(
      unavailable,
    );
    expect(getter).not.toHaveBeenCalled();
    noCalls(f);
  });
  it.each(routes)('$kind global401 precedes Q0/repo/key', async (route) => {
    const f = fixture({ denied: route.capability, available: false });
    expect(
      await f.dispatch(route, {
        body: null,
        headers: { authorization: '', 'idempotency-key': '' },
      }),
    ).toEqual(error(401, 'authentication_required', 'A valid session is required'));
    noCalls(f);
  });
  it.each(routes)('$kind raw DTO/receiver/arity/actor and Q0 fields', async (route) => {
    const f = fixture();
    const actual = await f.dispatch(route);
    expect(actual).toEqual(
      response(route.kind === 'start' ? 201 : 200, route.kind === 'list' ? rows : row),
    );
    expect(actual.body).toBe(route.kind === 'list' ? rows : row);
    if (route.kind === 'start') {
      expect(f.repository.start).toHaveBeenCalledExactlyOnceWith(
        id,
        'generic',
        subjectId,
        key,
        actor,
        correlationId,
      );
      expect(f.repository.start.mock.contexts).toEqual([f.repository]);
      expect(f.repository.start.mock.calls[0]?.[4]).toBe(actor);
    } else if (route.kind === 'list') {
      expect(f.repository.listTasks).toHaveBeenCalledExactlyOnceWith(actor);
      expect(f.repository.listTasks.mock.contexts).toEqual([f.repository]);
      expect(f.repository.listTasks.mock.calls[0]?.[0]).toBe(actor);
    } else {
      expect(f.repository.decide).toHaveBeenCalledExactlyOnceWith(
        id,
        'approve',
        null,
        key,
        1,
        actor,
        correlationId,
      );
      expect(f.repository.decide.mock.contexts).toEqual([f.repository]);
      expect(f.repository.decide.mock.calls[0]?.[5]).toBe(actor);
    }
    expect(f.get.mock.calls.every(([cap]) => cap === route.capability)).toBe(true);
    expect(f.repository.list).not.toHaveBeenCalled();
    expect(f.repository.create).not.toHaveBeenCalled();
    expect(f.repository.createVersion).not.toHaveBeenCalled();
    expect(f.repository.publish).not.toHaveBeenCalled();
  });
  it.each([{ fields: null }, { fields: [] }, { fields: ['unrelated'] }] as const)(
    'fields $fields never project or authorize body keys',
    async ({ fields }) => {
      const f = fixture({ fields });
      for (const route of routes)
        expect((await f.dispatch(route)).body).toBe(route.kind === 'list' ? rows : row);
    },
  );
  it('task list uses decide not workflow read/start/update', async () => {
    const f = fixture({ denied: 'workflow:decide' });
    for (const cap of ['workflow:read', 'workflow:start', 'workflow:update'] as const)
      f.permissions.set(cap, { scopes: ['SELF'], fields: null });
    expect(await f.dispatch(routes[1])).toEqual(denied);
    noCalls(f);
  });
  it('task list ignores body/query/all key headers and preserves array even empty', async () => {
    const f = fixture();
    const getter = vi.fn(() => {
      throw new Error('List must not read body');
    });
    const body = Object.defineProperty({}, 'decision', { enumerable: true, get: getter });
    expect(
      (
        await f.dispatch(routes[1], {
          body,
          headers: { 'idempotency-key': '' },
          query: { version: '1' },
        })
      ).body,
    ).toBe(rows);
    expect(getter).not.toHaveBeenCalled();
    const empty: typeof rows = [];
    f.repository.listTasks.mockResolvedValue(empty);
    expect(
      (await f.dispatch(routes[1], { body: null, headers: { 'idempotency-key': undefined } })).body,
    ).toBe(empty);
  });
  for (const route of writes) {
    it.each([{ value: undefined }, { value: '' }])(
      `${route.kind} missing/empty key wins root/UUID and no source fallback`,
      async ({ value }) => {
        const f = fixture();
        expect(
          await f.dispatch(route, {
            pathname: badPath(route),
            body: null,
            headers: { 'idempotency-key': value, 'Idempotency-Key': 'case-key' },
            query: { 'idempotency-key': 'query-key' },
          }),
        ).toEqual(keyRequired);
        noCalls(f);
      },
    );
    it(`${route.kind} missing key precedes root getter`, async () => {
      const f = fixture();
      const getter = vi.fn(() => {
        throw new Error('Key must win');
      });
      const body = Object.defineProperty({}, route.kind === 'start' ? 'subjectType' : 'decision', {
        enumerable: true,
        get: getter,
      });
      expect(await f.dispatch(route, { body, headers: { 'idempotency-key': undefined } })).toEqual(
        keyRequired,
      );
      expect(getter).not.toHaveBeenCalled();
      noCalls(f);
    });
    it.each([' ', '!@#$%', 'x'.repeat(200), 'x'.repeat(201)])(
      `${route.kind} truthy key %s is raw HTTP forward only`,
      async (value) => {
        const f = fixture();
        expect((await f.dispatch(route, { headers: { 'idempotency-key': value } })).body).toBe(row);
        expect(keyArg(f, route)).toBe(value);
      },
    );
    it(`${route.kind} long key does not preempt bad UUID`, async () => {
      const f = fixture();
      expect(
        await f.dispatch(route, {
          pathname: badPath(route),
          headers: { 'idempotency-key': 'x'.repeat(201) },
        }),
      ).toEqual(invalid(`${route.kind === 'start' ? 'workflowId' : 'taskId'} must be a UUID`));
      noCalls(f);
    });
    it.each([
      { value: undefined },
      { value: null },
      { value: [] },
      { value: '' },
      { value: false },
      { value: 1 },
    ])(`${route.kind} root O rejects $value before UUID`, async ({ value }) => {
      const f = fixture();
      expect(await f.dispatch(route, { pathname: badPath(route), body: value })).toEqual(
        objectRequired,
      );
      noCalls(f);
    });
    it(`${route.kind} unknown keys sort before UUID and getters`, async () => {
      const f = fixture();
      const getter = vi.fn(() => {
        throw new Error('allow must win');
      });
      const body = Object.defineProperty(
        { z: 1, a: 1 },
        route.kind === 'start' ? 'subjectType' : 'decision',
        { enumerable: true, get: getter },
      );
      expect(await f.dispatch(route, { pathname: badPath(route), body })).toEqual(
        invalid('Unsupported fields: a, z'),
      );
      expect(getter).not.toHaveBeenCalled();
      noCalls(f);
    });
    it.each(['idempotencyKey', 'key', 'expectedVersion'])(
      `${route.kind} body key %s is not an input source`,
      async (field) => {
        const f = fixture();
        expect(await f.dispatch(route, { body: { ...input(route), [field]: 'body-key' } })).toEqual(
          invalid(`Unsupported fields: ${field}`),
        );
        noCalls(f);
      },
    );
    it(`${route.kind} absent header does not use allowed-looking body key`, async () => {
      const f = fixture();
      expect(
        await f.dispatch(route, {
          body: { ...input(route), idempotencyKey: 'body-key' },
          headers: { 'idempotency-key': undefined },
        }),
      ).toEqual(keyRequired);
      noCalls(f);
    });
    it(`${route.kind} raw matching bad UUID wins body getters`, async () => {
      const f = fixture();
      const getter = vi.fn(() => {
        throw new Error('UUID must win');
      });
      const body = Object.defineProperty({}, route.kind === 'start' ? 'subjectType' : 'decision', {
        enumerable: true,
        get: getter,
      });
      expect(await f.dispatch(route, { pathname: badPath(route), body })).toEqual(
        invalid(`${route.kind === 'start' ? 'workflowId' : 'taskId'} must be a UUID`),
      );
      expect(getter).not.toHaveBeenCalled();
      noCalls(f);
    });
    it(`${route.kind} same key calls each time with distinct input, not PG replay proof`, async () => {
      const f = fixture();
      await f.dispatch(route);
      await f.dispatch(route);
      await f.dispatch(route, {
        body:
          route.kind === 'start'
            ? { subjectType: 'changed', subjectId: id }
            : { decision: 'changed', comment: 'different', version: 2 },
      });
      if (route.kind === 'start') {
        expect(f.repository.start.mock.calls).toEqual([
          [id, 'generic', subjectId, key, actor, correlationId],
          [id, 'generic', subjectId, key, actor, correlationId],
          [id, 'changed', id, key, actor, correlationId],
        ]);
      } else
        expect(f.repository.decide.mock.calls).toEqual([
          [id, 'approve', null, key, 1, actor, correlationId],
          [id, 'approve', null, key, 1, actor, correlationId],
          [id, 'changed', 'different', key, 2, actor, correlationId],
        ]);
    });
  }
  it.each([
    { value: undefined },
    { value: null },
    { value: '' },
    { value: ' ' },
    { value: 1 },
    { value: false },
  ])('start type $value precedes subjectId getter', async ({ value }) => {
    const f = fixture();
    const getter = vi.fn(() => {
      throw new Error('Type must win');
    });
    const body = Object.defineProperty({ subjectType: value }, 'subjectId', {
      enumerable: true,
      get: getter,
    });
    expect(await f.dispatch(routes[0], { body })).toEqual(invalid('subjectType is required'));
    expect(getter).not.toHaveBeenCalled();
    noCalls(f);
  });
  it.each([
    { value: undefined, message: 'subjectId is required' },
    { value: null, message: 'subjectId is required' },
    { value: '', message: 'subjectId is required' },
    { value: ' ', message: 'subjectId is required' },
    { value: 1, message: 'subjectId is required' },
    { value: 'a', message: 'subjectId must be a UUID' },
  ])('start subjectId $value keeps UUID rules', async ({ value, message }) => {
    const f = fixture();
    expect(
      await f.dispatch(routes[0], { body: { subjectType: 'anything', subjectId: value } }),
    ).toEqual(invalid(message));
    noCalls(f);
  });
  it('start strings trim and uppercase subject UUID is preserved, no type enum', async () => {
    const f = fixture();
    await f.dispatch(routes[0], {
      body: { subjectType: ' Unregistered Type ', subjectId: ` ${subjectId.toUpperCase()} ` },
    });
    expect(f.repository.start).toHaveBeenCalledExactlyOnceWith(
      id,
      'Unregistered Type',
      subjectId.toUpperCase(),
      key,
      actor,
      correlationId,
    );
  });
  it('start getter order reads type then subject once each', async () => {
    const f = fixture();
    const events: string[] = [];
    await f.dispatch(routes[0], {
      body: {
        get subjectType() {
          events.push('type');
          return 'generic';
        },
        get subjectId() {
          events.push('subject');
          return subjectId;
        },
      },
    });
    expect(events).toEqual(['type', 'subject']);
  });
  it.each([
    { value: undefined },
    { value: null },
    { value: '' },
    { value: ' ' },
    { value: 1 },
    { value: false },
  ])('decision $value precedes comment/version getters', async ({ value }) => {
    const f = fixture();
    const getter = vi.fn(() => {
      throw new Error('Decision must win');
    });
    const body = Object.defineProperties(
      { decision: value },
      { comment: { enumerable: true, get: getter }, version: { enumerable: true, get: getter } },
    );
    expect(await f.dispatch(routes[2], { body })).toEqual(invalid('decision is required'));
    expect(getter).not.toHaveBeenCalled();
    noCalls(f);
  });
  it('decision accepts arbitrary trimmed string, no HTTP enum/state check', async () => {
    const f = fixture();
    await f.dispatch(routes[2], { body: { decision: ' UNREGISTERED ', version: 1 } });
    expect(f.repository.decide).toHaveBeenCalledExactlyOnceWith(
      id,
      'UNREGISTERED',
      null,
      key,
      1,
      actor,
      correlationId,
    );
  });
  it.each([
    { body: { decision: 'approve', version: 1 } },
    { body: { decision: 'approve', comment: undefined, version: 1 } },
    { body: { decision: 'approve', comment: null, version: 1 } },
  ])('comment nullish $body becomes null', async ({ body }) => {
    const f = fixture();
    await f.dispatch(routes[2], { body });
    expect(f.repository.decide).toHaveBeenCalledExactlyOnceWith(
      id,
      'approve',
      null,
      key,
      1,
      actor,
      correlationId,
    );
  });
  it.each([
    { value: '' },
    { value: ' ' },
    { value: 1 },
    { value: false },
    { value: [] },
    { value: {} },
  ])('comment $value string failure precedes version getter', async ({ value }) => {
    const f = fixture();
    const getter = vi.fn(() => {
      throw new Error('Comment must win');
    });
    const body = Object.defineProperty({ decision: 'approve', comment: value }, 'version', {
      enumerable: true,
      get: getter,
    });
    expect(await f.dispatch(routes[2], { body })).toEqual(invalid('comment is required'));
    expect(getter).not.toHaveBeenCalled();
    noCalls(f);
  });
  it('nonnull comment getter is read twice before version, second value is forwarded', async () => {
    const f = fixture();
    const events: string[] = [];
    let reads = 0;
    const body = {
      get decision() {
        events.push('decision');
        return 'approve';
      },
      get comment() {
        reads++;
        events.push(`comment${String(reads)}`);
        return reads === 1 ? 'first' : ' second ';
      },
      get version() {
        events.push('version');
        return 1;
      },
    };
    await f.dispatch(routes[2], { body });
    expect(events).toEqual(['decision', 'comment1', 'comment2', 'version']);
    expect(f.repository.decide).toHaveBeenCalledExactlyOnceWith(
      id,
      'approve',
      'second',
      key,
      1,
      actor,
      correlationId,
    );
  });
  it.each([{ value: undefined }, { value: null }])(
    'nullish comment getter $value is read only once',
    async ({ value }) => {
      const f = fixture();
      const getter = vi.fn(() => value);
      const body = Object.defineProperty({ decision: 'approve', version: 1 }, 'comment', {
        enumerable: true,
        get: getter,
      });
      await f.dispatch(routes[2], { body });
      expect(getter).toHaveBeenCalledTimes(1);
      expect(f.repository.decide.mock.calls[0]?.[2]).toBeNull();
    },
  );
  it('second comment getter becoming null rejects before version getter', async () => {
    const f = fixture();
    const comment = vi.fn().mockReturnValueOnce('first').mockReturnValueOnce(null);
    const version = vi.fn(() => {
      throw new Error('Second comment read must win');
    });
    const body = Object.defineProperties(
      { decision: 'approve' },
      { comment: { enumerable: true, get: comment }, version: { enumerable: true, get: version } },
    );
    expect(await f.dispatch(routes[2], { body })).toEqual(invalid('comment is required'));
    expect(comment).toHaveBeenCalledTimes(2);
    expect(version).not.toHaveBeenCalled();
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
  ])('decision body V rejects $value, no query fallback', async ({ value }) => {
    const f = fixture();
    expect(
      await f.dispatch(routes[2], {
        body: { decision: 'approve', comment: ' valid ', version: value },
        query: { version: '1' },
      }),
    ).toEqual(invalid('version must be a positive integer'));
    noCalls(f);
  });
  it('decision MAX_SAFE forwards to mock, not PG proof', async () => {
    const f = fixture();
    await f.dispatch(routes[2], {
      body: { decision: 'approve', version: Number.MAX_SAFE_INTEGER },
    });
    expect(f.repository.decide).toHaveBeenCalledExactlyOnceWith(
      id,
      'approve',
      null,
      key,
      Number.MAX_SAFE_INTEGER,
      actor,
      correlationId,
    );
  });
  it.each([
    { method: 'GET', pathname: routes[0].pathname },
    { method: 'POST', pathname: routes[1].pathname },
    { method: 'GET', pathname: routes[2].pathname },
    { method: 'POST', pathname: '/api/v1/workflows/instances' },
    { method: 'POST', pathname: '/api/v1/workflow-tasks/decisions' },
    { method: 'POST', pathname: `/api/v1/workflows/${id.toUpperCase()}/instances` },
    { method: 'POST', pathname: `/api/v1/workflow-tasks/${id.toUpperCase()}/decisions` },
    { method: 'POST', pathname: '/api/v1/workflows/not-uuid/instances' },
    { method: 'POST', pathname: '/api/v1/workflow-tasks/not-uuid/decisions' },
    { method: 'POST', pathname: `${routes[0].pathname}/extra` },
    { method: 'POST', pathname: `${routes[2].pathname}/extra` },
    { method: 'GET', pathname: `${routes[1].pathname}/` },
    { method: 'get', pathname: routes[1].pathname },
  ])('unsupported $method $pathname stays404 even missingrepo', async (request) => {
    const f = fixture({ available: false, emptyScope: true });
    expect(
      await f.dispatch(routes[1], { ...request, body: null, headers: { 'idempotency-key': '' } }),
    ).toEqual(missing);
    noCalls(f);
  });
  it.each(routes)(
    '$kind repository DomainError/correlation preserved (mock only)',
    async (route) => {
      const f = fixture();
      const failure = new DomainError('conflict', 'Runtime fixture conflict');
      if (route.kind === 'start') f.repository.start.mockRejectedValue(failure);
      else if (route.kind === 'list') f.repository.listTasks.mockRejectedValue(failure);
      else f.repository.decide.mockRejectedValue(failure);
      expect(await f.dispatch(route)).toEqual(error(409, 'conflict', 'Runtime fixture conflict'));
    },
  );
  it('adjacent definition publish stays positive, not runtime scope', async () => {
    const f = fixture();
    f.permissions.set('workflow:update', { scopes: ['SELF'], fields: null });
    expect(
      await f.dispatch(routes[0], {
        pathname: `/api/v1/workflows/${id}/publish`,
        body: { version: 1 },
        headers: { 'idempotency-key': '' },
      }),
    ).toEqual(response(200, row));
    expect(f.repository.publish).toHaveBeenCalledExactlyOnceWith(id, 1, actor, correlationId);
    expect(f.repository.start).not.toHaveBeenCalled();
    expect(f.repository.listTasks).not.toHaveBeenCalled();
    expect(f.repository.decide).not.toHaveBeenCalled();
  });
});
