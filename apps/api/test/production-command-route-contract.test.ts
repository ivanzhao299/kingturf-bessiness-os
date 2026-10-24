// Fixed against ce023a6 inline commands; no future command route imported.
import { describe, expect, it, vi } from 'vitest';
import { DomainError, type AuthorizationContext } from '@kingturf/domain';
import type { DataScope, JsonObject, PermissionKey } from '@kingturf/types';
import { buildApp, type ApiDependencies, type ApiRequest } from '../src/app.js';

type Production = NonNullable<ApiDependencies['production']>;
type Grant = NonNullable<ReturnType<AuthorizationContext['permissions']['get']>>;
const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const correlationId = '33333333-3333-4333-8333-333333333333';
const actor = { companyId: 'command-mock-tenant', employeeId: id };
const nested = { reference: true };
const row: JsonObject = { id, version: 7, state: 'RETURNED', secret: 'private', nested };
const routes = [
  { action: 'release', cap: 'production:plan', state: 'RELEASED' },
  { action: 'start', cap: 'production:report', state: 'IN_PROGRESS' },
  { action: 'complete', cap: 'production:close', state: 'COMPLETED' },
  { action: 'close', cap: 'production:close', state: 'CLOSED' },
  { action: 'cancel', cap: 'production:close', state: 'CANCELLED' },
] as const;
type Route = (typeof routes)[number];
const bodyKeys = ['reason', 'evidence', 'idempotencyKey'];
const valid = () => ({ reason: ' Ready ', evidence: nested, idempotencyKey: ' BODY-KEY ' });
const path = (route: Route, orderId: string = id) =>
  '/api/v1/production-orders/' + orderId + '/' + route.action;
function fixture(
  options: {
    available?: boolean;
    denied?: PermissionKey;
    scopes?: readonly DataScope[];
    fields?: Grant['fields'];
    readFields?: Grant['fields'];
    noRead?: boolean;
  } = {},
) {
  const scopes = options.scopes ?? ['TEAM'];
  const anchors = [{ scope: 'TEAM', organizationId: id }] as const;
  const permissions = new Map<PermissionKey, Grant>(
    ['production:plan', 'production:report', 'production:close'].map((cap) => [
      cap as PermissionKey,
      { scopes, fields: options.fields === undefined ? null : options.fields },
    ]),
  );
  if (options.denied) permissions.delete(options.denied);
  if (!options.noRead)
    permissions.set('production:read', {
      scopes: [],
      fields: options.readFields === undefined ? null : options.readFields,
    });
  const context: AuthorizationContext = {
    actor,
    permissions,
    scopeAnchors: new Map(routes.map((route) => [route.cap, anchors])),
  };
  const get = vi.spyOn(permissions, 'get');
  const transition = vi.fn<Production['transition']>().mockResolvedValue(row);
  const production = { transition };
  const authenticate = vi.fn().mockResolvedValue(context);
  const app = buildApp({
    auth: { authenticate } as unknown as ApiDependencies['auth'],
    organizations: {} as ApiDependencies['organizations'],
    employees: {} as ApiDependencies['employees'],
    ...(options.available === false ? {} : { production: production as unknown as Production }),
  });
  const dispatch = (route: Route, body: unknown = valid(), request: Partial<ApiRequest> = {}) =>
    app.dispatch({
      method: 'POST',
      pathname: path(route),
      body,
      ...request,
      headers: {
        authorization: 'Bearer fixture',
        'x-correlation-id': correlationId,
        ...request.headers,
      },
    });
  return {
    transition,
    production,
    context,
    permissions,
    get,
    authenticate,
    scopes,
    anchors,
    dispatch,
  };
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
const fieldDenied = error(403, 'forbidden', 'Field permission denied');
const missing = error(404, 'not_found', 'Route not found');
const inputOf = (f: ReturnType<typeof fixture>, index = 0) => f.transition.mock.calls[index]?.[2];

describe('old production five-command contracts', () => {
  for (const route of routes) {
    it(
      route.action +
        ' maps exact capability/state and forwards five args with original receiver/references',
      async () => {
        const f = fixture();
        const first = await f.dispatch(route);
        expect(first).toEqual(response(201, row));
        expect(first.body).toBe(row);
        expect(await f.dispatch(route)).toEqual(response(201, row));
        expect(f.transition.mock.calls).toHaveLength(2);
        expect(f.transition.mock.calls[0]).toEqual([
          id,
          route.state,
          { reason: 'Ready', evidence: nested, idempotencyKey: 'BODY-KEY' },
          { actor, scopes: f.scopes, anchors: f.anchors },
          correlationId,
        ]);
        expect(f.transition.mock.contexts[0]).toBe(f.production);
        const input = inputOf(f);
        const scope = f.transition.mock.calls[0]?.[3];
        expect(Object.keys(input ?? {})).toEqual(bodyKeys);
        expect(input?.evidence).toBe(nested);
        expect(Object.keys(scope ?? {})).toEqual(['actor', 'scopes', 'anchors']);
        expect(scope?.actor).toBe(actor);
        expect(scope?.scopes).toBe(f.scopes);
        expect(scope?.anchors).toBe(f.anchors);
        expect(input).not.toBe(inputOf(f, 1));
        expect(scope).not.toBe(f.transition.mock.calls[1]?.[3]);
        expect(
          f.get.mock.calls
            .filter(([cap]) => cap !== 'production:read')
            .every(([cap]) => cap === route.cap),
        ).toBe(true);
      },
    );
    it(route.action + ' missing mapped cap cannot use other write capabilities', async () => {
      const f = fixture({ denied: route.cap });
      expect(await f.dispatch(route, valid(), { pathname: path(route, 'a') })).toEqual(denied);
      expect(f.transition).not.toHaveBeenCalled();
    });
    it.each([{ scopes: [] }, { fields: [] }, { fields: ['reason', 'idempotencyKey'] }])(
      route.action + ' scope/field denial before UUID or value getters %j',
      async (options) => {
        const f = fixture(options);
        const getter = vi.fn(() => {
          throw new Error('value before authorization');
        });
        const body = Object.defineProperty(valid(), 'reason', { enumerable: true, get: getter });
        expect(await f.dispatch(route, body, { pathname: path(route, 'a') })).toEqual(
          options.scopes ? denied : fieldDenied,
        );
        expect(getter).not.toHaveBeenCalled();
        expect(f.transition).not.toHaveBeenCalled();
      },
    );
    it.each([{ fields: null }, { fields: bodyKeys }])(
      route.action + ' accepts original write field grant %j',
      async (options) => {
        const f = fixture(options);
        expect((await f.dispatch(route)).statusCode).toBe(201);
      },
    );
    it.each([null, undefined, [], '', 0, false])(
      route.action + ' root %j rejects before capability',
      async (body) => {
        const f = fixture({ denied: route.cap });
        expect(await f.dispatch(route, null, { body })).toEqual(
          invalid('A JSON object body is required'),
        );
        expect(f.get).not.toHaveBeenCalled();
        expect(f.transition).not.toHaveBeenCalled();
      },
    );
    it(
      route.action + ' unknown sorted own keys precede capability and do not read values',
      async () => {
        const f = fixture({ denied: route.cap });
        const getter = vi.fn(() => {
          throw new Error('read unknown body');
        });
        const body = {
          ...valid(),
          z: undefined,
          version: 0,
          state: route.state,
          key: 'NO',
          a: null,
        };
        Object.defineProperty(body, 'reason', { enumerable: true, get: getter });
        expect(await f.dispatch(route, body)).toEqual(
          invalid('Unsupported fields: a, key, state, version, z'),
        );
        expect(getter).not.toHaveBeenCalled();
        expect(f.get).not.toHaveBeenCalled();
      },
    );
    it.each([null, undefined, [], { state: 'BAD' }])(
      route.action + ' absent repository skips body %j even missing mapped cap',
      async (body) => {
        const f = fixture({ available: false, denied: route.cap });
        expect(await f.dispatch(route, null, { body, pathname: path(route, 'a') })).toEqual(
          missing,
        );
        expect(f.get).not.toHaveBeenCalled();
        expect(f.transition).not.toHaveBeenCalled();
      },
    );
    it(
      route.action + ' absent repository never reads body values; global401 precedes skip404',
      async () => {
        const f = fixture({ available: false, denied: route.cap });
        const getter = vi.fn(() => {
          throw new Error('ignored body');
        });
        const body = Object.defineProperty({}, 'reason', { enumerable: true, get: getter });
        expect(await f.dispatch(route, body)).toEqual(missing);
        f.authenticate.mockResolvedValueOnce(null);
        expect(await f.dispatch(route, body)).toEqual(
          error(401, 'authentication_required', 'A valid session is required'),
        );
        expect(getter).not.toHaveBeenCalled();
      },
    );
    it.each(['GET', 'PATCH', 'PUT', 'DELETE', 'post'])(
      route.action + ' unsupported method %s is404',
      async (method) => {
        const f = fixture({ denied: route.cap });
        expect(await f.dispatch(route, null, { method })).toEqual(missing);
        expect(f.get).not.toHaveBeenCalled();
      },
    );
    it.each(['', 'G', id.toUpperCase(), ' ' + id, id + ' ', id + '/extra'])(
      route.action + ' raw ID %s fails match, not UUID parser',
      async (orderId) => {
        const f = fixture({ denied: route.cap });
        expect(await f.dispatch(route, null, { pathname: path(route, orderId) })).toEqual(missing);
        expect(f.get).not.toHaveBeenCalled();
      },
    );
    it.each(['a', '-', '00000000-0000-0000-0000-000000000000', id.replace('4aaa', '9aaa')])(
      route.action + ' raw ID %s matches then UUID400 before any body values',
      async (orderId) => {
        const f = fixture();
        const getter = vi.fn(() => {
          throw new Error('UUID first');
        });
        const body = Object.defineProperty(valid(), 'reason', { enumerable: true, get: getter });
        const method = vi.fn(() => f.transition);
        Object.defineProperty(f.production, 'transition', { get: method });
        expect(await f.dispatch(route, body, { pathname: path(route, orderId) })).toEqual(
          invalid('productionOrderId must be a UUID'),
        );
        expect(method).toHaveBeenCalledOnce();
        expect(getter).not.toHaveBeenCalled();
        expect(f.transition).not.toHaveBeenCalled();
      },
    );
    it(route.action + ' raw action/path variants and extra segments stay404', async () => {
      const f = fixture({ denied: route.cap });
      for (const pathname of [
        path(route) + '/',
        path(route) + '/extra',
        path(route).replace(route.action, route.action.toUpperCase()),
        path(route).replace('production-orders', 'Production-orders'),
        '/api/v1/production-orders/' + id + '/unknown',
      ])
        expect(await f.dispatch(route, null, { pathname })).toEqual(missing);
      expect(f.get).not.toHaveBeenCalled();
    });
    it(
      route.action + ' own undefined evidence requests field but defaults to fresh input object',
      async () => {
        const body = { reason: 'Ready', evidence: undefined, idempotencyKey: 'BODY-KEY' };
        const f = fixture({ fields: ['reason', 'idempotencyKey'] });
        expect(await f.dispatch(route, body)).toEqual(fieldDenied);
        const allowed = fixture({ fields: bodyKeys });
        expect((await allowed.dispatch(route, body)).statusCode).toBe(201);
        expect(Object.keys(inputOf(allowed) ?? {})).toEqual(bodyKeys);
        expect(inputOf(allowed)?.evidence).toEqual({});
      },
    );
    it.each([{ omitted: true }, { value: undefined }, { value: null }])(
      route.action + ' nullish/absent evidence %j creates a fresh object each invocation',
      async (entry) => {
        const f = fixture();
        const body = {
          reason: 'Ready',
          idempotencyKey: 'BODY-KEY',
          ...('value' in entry ? { evidence: entry.value } : {}),
        };
        expect((await f.dispatch(route, body)).statusCode).toBe(201);
        expect((await f.dispatch(route, body)).statusCode).toBe(201);
        expect(inputOf(f)?.evidence).toEqual({});
        expect(inputOf(f)?.evidence).not.toBe(inputOf(f, 1)?.evidence);
        expect(Object.keys(inputOf(f) ?? {})).toEqual(bodyKeys);
      },
    );
    it.each([false, true, 0, '', 'value', []])(
      route.action + ' nonobject evidence %j is400',
      async (value) => {
        const f = fixture();
        expect(await f.dispatch(route, { ...valid(), evidence: value })).toEqual(
          invalid('evidence must be a JSON object'),
        );
      },
    );
    it(
      route.action +
        ' evidence validation is shallow, retains object and does not read nested getters',
      async () => {
        const f = fixture();
        const getter = vi.fn(() => {
          throw new Error('deep getter');
        });
        const evidence = Object.defineProperty(
          { nested: [undefined, { secret: 'ref' }] },
          'extra',
          { enumerable: true, get: getter },
        );
        expect((await f.dispatch(route, { ...valid(), evidence })).statusCode).toBe(201);
        expect(inputOf(f)?.evidence).toBe(evidence);
        expect(getter).not.toHaveBeenCalled();
      },
    );
    it.each([undefined, null, '', ' ', 0, false, [], {}])(
      route.action + ' reason %j rejects before evidence/key',
      async (value) => {
        const f = fixture();
        const getter = vi.fn(() => {
          throw new Error('reason first');
        });
        const body = Object.defineProperty({ ...valid(), reason: value }, 'evidence', {
          enumerable: true,
          get: getter,
        });
        expect(await f.dispatch(route, body)).toEqual(invalid('reason is required'));
        expect(getter).not.toHaveBeenCalled();
      },
    );
    it(route.action + ' evidence error precedes key error', async () => {
      const f = fixture();
      expect(
        await f.dispatch(route, { reason: 'Ready', evidence: [], idempotencyKey: null }),
      ).toEqual(invalid('evidence must be a JSON object'));
    });
    it.each([undefined, null, '', ' ', 0, false, [], {}])(
      route.action + ' body key %j never falls back to header',
      async (value) => {
        const f = fixture();
        expect(
          await f.dispatch(
            route,
            { ...valid(), idempotencyKey: value },
            { headers: { 'idempotency-key': 'HEADER-KEY' } },
          ),
        ).toEqual(invalid('idempotencyKey is required'));
      },
    );
    it.each(['a', '1ABC', 'A/B', 'A B', 'A'.repeat(65)])(
      route.action + ' stable body key rejects %s',
      async (value) => {
        const f = fixture();
        expect(await f.dispatch(route, { ...valid(), idempotencyKey: value })).toEqual(
          invalid('Code must be 1-64 uppercase letters, digits, underscore, or hyphen'),
        );
      },
    );
    it.each(['A', 'A_1-B', 'A'.repeat(64)])(
      route.action + ' stable body key %s and reason trim retain old rules',
      async (value) => {
        const f = fixture();
        expect(
          (await f.dispatch(route, { ...valid(), idempotencyKey: ' ' + value + ' ' })).statusCode,
        ).toBe(201);
        expect(inputOf(f)?.idempotencyKey).toBe(value);
        expect(inputOf(f)?.reason).toBe('Ready');
      },
    );
    it.each([undefined, '', 'different', 'x'.repeat(201)])(
      route.action + ' header key %s/query values are ignored',
      async (headerKey) => {
        const f = fixture();
        const getter = vi.fn(() => {
          throw new Error('query value');
        });
        const request = {
          headers: { 'idempotency-key': headerKey },
          query: Object.defineProperty({}, 'version', { enumerable: true, get: getter }),
        };
        expect((await f.dispatch(route, valid(), request)).statusCode).toBe(201);
        expect(inputOf(f)?.idempotencyKey).toBe('BODY-KEY');
        expect(getter).not.toHaveBeenCalled();
      },
    );
    it(
      route.action +
        ' method capture precedes reason/evidence/key/actor, evidence getter is read once',
      async () => {
        const f = fixture();
        const events: string[] = [];
        Object.defineProperty(f.production, 'transition', {
          get: () => {
            events.push('method');
            return f.transition;
          },
        });
        Object.defineProperty(f.context, 'actor', {
          get: () => {
            events.push('actor');
            return actor;
          },
        });
        const values: Record<string, unknown> = {
          reason: ' Ready ',
          evidence: nested,
          idempotencyKey: ' BODY-KEY ',
        };
        const body: Record<string, unknown> = {};
        for (const key of bodyKeys)
          Object.defineProperty(body, key, {
            enumerable: true,
            get: () => {
              events.push(key);
              return values[key];
            },
          });
        f.transition.mockImplementationOnce(() => {
          events.push('transition');
          return Promise.resolve(row);
        });
        expect((await f.dispatch(route, body)).statusCode).toBe(201);
        expect(events).toEqual([
          'method',
          'reason',
          'evidence',
          'idempotencyKey',
          'actor',
          'transition',
        ]);
      },
    );
    it(
      route.action +
        ' captured method still runs on original receiver after body getter replaces it',
      async () => {
        const f = fixture();
        const replacement = vi
          .fn<Production['transition']>()
          .mockResolvedValue({ id: 'replacement' });
        const body = Object.defineProperty(valid(), 'reason', {
          enumerable: true,
          get: () => {
            f.production.transition = replacement;
            return 'Ready';
          },
        });
        expect(await f.dispatch(route, body)).toEqual(response(201, row));
        expect(f.transition).toHaveBeenCalledOnce();
        expect(f.transition.mock.contexts[0]).toBe(f.production);
        expect(replacement).not.toHaveBeenCalled();
      },
    );
    it(
      route.action + ' no read capability still executes write with id/version fallback',
      async () => {
        const f = fixture({ noRead: true });
        expect(await f.dispatch(route)).toEqual(response(201, { id, version: 7 }));
        expect(f.transition).toHaveBeenCalledOnce();
      },
    );
    it.each([
      { fields: null, expected: row },
      { fields: [], expected: { id } },
      { fields: ['state'], expected: { id, state: 'RETURNED' } },
      { fields: ['nested', 'version'], expected: { id, version: 7, nested } },
      { fields: ['id', 'version', 'state', 'secret', 'nested'], expected: row },
    ])(
      route.action + ' response uses independent read fields $fields after write',
      async ({ fields, expected }) => {
        const f = fixture({ fields: bodyKeys, readFields: fields });
        const result = await f.dispatch(route);
        expect(result).toEqual(response(201, expected));
        if (fields === null) expect(result.body).toBe(row);
        else expect(result.body).not.toBe(row);
      },
    );
    it(
      route.action + ' read grant replacement/deletion during await is honored with no early read',
      async () => {
        const f = fixture({ readFields: [] });
        const read = vi.fn(() => ['state']);
        f.transition.mockImplementationOnce(() => {
          expect(f.get.mock.calls.some(([cap]) => cap === 'production:read')).toBe(false);
          f.permissions.set('production:read', {
            scopes: [],
            get fields() {
              return read();
            },
          });
          return Promise.resolve(row);
        });
        expect(await f.dispatch(route)).toEqual(response(201, { id, state: 'RETURNED' }));
        expect(read).toHaveBeenCalledOnce();
        const removed = fixture({ readFields: null });
        removed.transition.mockImplementationOnce(() => {
          removed.permissions.delete('production:read');
          return Promise.resolve(row);
        });
        expect(await removed.dispatch(route)).toEqual(response(201, { id, version: 7 }));
      },
    );
    it(
      route.action +
        ' repeated same/changed body forwards each time, not HTTP dedup or real replay proof',
      async () => {
        const f = fixture();
        expect((await f.dispatch(route)).statusCode).toBe(201);
        expect((await f.dispatch(route)).statusCode).toBe(201);
        expect((await f.dispatch(route, { ...valid(), reason: 'Different' })).statusCode).toBe(201);
        expect(f.transition.mock.calls).toHaveLength(3);
        expect(inputOf(f)?.idempotencyKey).toBe(inputOf(f, 2)?.idempotencyKey);
        expect(inputOf(f, 2)?.reason).toBe('Different');
      },
    );
    it.each(['SELF', 'TEAM', 'DEPARTMENT', 'REGION', 'COMPANY', 'GROUP'] as const)(
      route.action + ' scope %s forwards only HTTP mock refs',
      async (scope) => {
        const f = fixture({ scopes: [scope] });
        expect((await f.dispatch(route)).statusCode).toBe(201);
        expect(f.transition.mock.calls[0]?.[3].scopes).toBe(f.scopes);
        expect(f.transition.mock.calls[0]?.[3].anchors).toBe(f.anchors);
      },
    );
    it.each([
      { code: 'conflict', status: 409 },
      { code: 'forbidden', status: 403 },
      { code: 'not_found', status: 404 },
      { code: 'invalid_request', status: 400 },
    ] as const)(route.action + ' DomainError $code keeps correlation', async ({ code, status }) => {
      const f = fixture();
      f.transition.mockRejectedValueOnce(new DomainError(code, 'original repository error'));
      expect(await f.dispatch(route)).toEqual(error(status, code, 'original repository error'));
      expect(f.get.mock.calls.some(([cap]) => cap === 'production:read')).toBe(false);
    });
  }
  it('collection neighbours remain GET/create routes, not commands', async () => {
    const f = fixture();
    expect(
      await f.dispatch(routes[0], null, { method: 'GET', pathname: '/api/v1/production-orders' }),
    ).toEqual(denied);
    expect(await f.dispatch(routes[0], null, { pathname: '/api/v1/production-orders' })).toEqual(
      invalid('A JSON object body is required'),
    );
    expect(f.transition).not.toHaveBeenCalled();
  });
  it('inherited/nonenumerable recognized fields are read but not field authorization requests', async () => {
    const f = fixture({ fields: [] });
    const body: Record<string, unknown> = Object.create(valid()) as Record<string, unknown>;
    expect((await f.dispatch(routes[0], body)).statusCode).toBe(201);
    expect(inputOf(f)?.evidence).toBe(nested);
  });
  it('response finite projection eagerly reads excluded getters, while null does not', async () => {
    const getter = vi.fn(() => 'secret');
    const result: JsonObject = {
      id,
      version: 7,
      get secret() {
        return getter();
      },
    };
    const raw = fixture({ readFields: null });
    raw.transition.mockResolvedValueOnce(result);
    const rawResponse = await raw.dispatch(routes[0]);
    expect(rawResponse.body).toBe(result);
    expect(getter).not.toHaveBeenCalled();
    const finite = fixture({ readFields: [] });
    finite.transition.mockResolvedValueOnce(result);
    expect(await finite.dispatch(routes[0])).toEqual(response(201, { id }));
    expect(getter).toHaveBeenCalledOnce();
  });
  it('special response own keys preserve original order/nested identity without fabricating id', async () => {
    const result: JsonObject = Object.fromEntries<JsonObject[string]>([
      ['toString', 'data'],
      ['__proto__', nested],
      ['constructor', 'data'],
      ['version', 7],
    ]);
    const f = fixture({ readFields: ['version', '__proto__', 'constructor', 'toString'] });
    f.transition.mockResolvedValueOnce(result);
    const created = await f.dispatch(routes[0]);
    expect(created).toEqual(response(201, result));
    expect(created.body).not.toBe(result);
    expect(Object.keys(created.body as object)).toEqual([
      'toString',
      '__proto__',
      'constructor',
      'version',
    ]);
    expect(Object.hasOwn(created.body as object, 'id')).toBe(false);
    expect(Object.getPrototypeOf(created.body)).toBe(Object.prototype);
    expect((created.body as JsonObject).__proto__).toBe(nested);
  });
});
