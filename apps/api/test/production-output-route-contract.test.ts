// Fixed against 75ea76f inline finished-rolls; no future output module imported.
import { describe, expect, it, vi } from 'vitest';
import { DomainError, type AuthorizationContext } from '@kingturf/domain';
import type { DataScope, JsonObject, PermissionKey } from '@kingturf/types';
import { buildApp, type ApiDependencies, type ApiRequest } from '../src/app.js';

type Production = NonNullable<ApiDependencies['production']>;
type Grant = NonNullable<ReturnType<AuthorizationContext['permissions']['get']>>;
const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const other = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const correlationId = '33333333-3333-4333-8333-333333333333';
const actor = { companyId: 'output-mock-tenant', employeeId: id };
const nested = { retained: true };
const row: JsonObject = { id, version: 7, name: 'output', secret: 'private', nested };
const keys = [
  'operationReportId',
  'itemVersionId',
  'rollNumber',
  'lotNumber',
  'locationId',
  'quantity',
  'manufacturedAt',
];
const uuids = ['operationReportId', 'itemVersionId', 'locationId'] as const;
const codes = ['rollNumber', 'lotNumber'] as const;
const valid = () => ({
  operationReportId: other,
  itemVersionId: id,
  rollNumber: ' ROLL-1 ',
  lotNumber: ' LOT-1 ',
  locationId: other,
  quantity: '10',
  manufacturedAt: ' 2026-10-14 ',
});
const parsed = () => ({
  ...valid(),
  rollNumber: 'ROLL-1',
  lotNumber: 'LOT-1',
  manufacturedAt: '2026-10-14',
});
const path = (orderId = id) => '/api/v1/production-orders/' + orderId + '/finished-rolls';
function fixture(
  options: {
    available?: boolean;
    denied?: boolean;
    scopes?: readonly DataScope[];
    fields?: Grant['fields'];
    readFields?: Grant['fields'];
    noRead?: boolean;
  } = {},
) {
  const scopes = options.scopes ?? ['TEAM'];
  const anchors = [{ scope: 'TEAM', organizationId: other }] as const;
  const permissions = new Map<PermissionKey, Grant>(
    ['production:report', 'production:plan', 'production:material', 'production:close'].map(
      (cap) => [
        cap as PermissionKey,
        { scopes, fields: options.fields === undefined ? null : options.fields },
      ],
    ),
  );
  if (options.denied) permissions.delete('production:report');
  if (!options.noRead)
    permissions.set('production:read', {
      scopes: [],
      fields: options.readFields === undefined ? null : options.readFields,
    });
  const context: AuthorizationContext = {
    actor,
    permissions,
    scopeAnchors: new Map([['production:report', anchors]]),
  };
  const get = vi.spyOn(permissions, 'get');
  const createOutput = vi.fn<Production['createOutput']>().mockResolvedValue(row);
  const production = { createOutput };
  const authenticate = vi.fn().mockResolvedValue(context);
  const app = buildApp({
    auth: { authenticate } as unknown as ApiDependencies['auth'],
    organizations: {} as ApiDependencies['organizations'],
    employees: {} as ApiDependencies['employees'],
    ...(options.available === false ? {} : { production: production as unknown as Production }),
  });
  const dispatch = (body: unknown = valid(), request: Partial<ApiRequest> = {}) =>
    app.dispatch({
      method: 'POST',
      pathname: path(),
      body,
      ...request,
      headers: {
        authorization: 'Bearer fixture',
        'x-correlation-id': correlationId,
        ...request.headers,
      },
    });
  return {
    createOutput,
    production,
    authenticate,
    context,
    permissions,
    get,
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
  },
});
const error = (statusCode: number, code: string, message: string) =>
  response(statusCode, { error: { code, message, correlationId } });
const invalid = (message: string) => error(400, 'invalid_request', message);
const denied = error(403, 'forbidden', 'Permission denied');
const fieldDenied = error(403, 'forbidden', 'Field permission denied');
const missing = error(404, 'not_found', 'Route not found');
const inputOf = (f: ReturnType<typeof fixture>, index = 0) => f.createOutput.mock.calls[index]?.[1];

describe('old production finished-rolls contract', () => {
  it('four args/receiver/fresh seven-key input and ordered scope reference forwarding', async () => {
    const f = fixture();
    const first = await f.dispatch();
    expect(first).toEqual(response(201, row));
    expect(first.body).toBe(row);
    expect((await f.dispatch()).statusCode).toBe(201);
    expect(f.createOutput.mock.calls[0]).toEqual([
      id,
      parsed(),
      { actor, scopes: f.scopes, anchors: f.anchors },
      correlationId,
    ]);
    expect(f.createOutput.mock.calls[0]).toHaveLength(4);
    expect(f.createOutput.mock.contexts[0]).toBe(f.production);
    expect(Object.keys(inputOf(f) ?? {})).toEqual(keys);
    const scope = f.createOutput.mock.calls[0]?.[2];
    expect(Object.keys(scope ?? {})).toEqual(['actor', 'scopes', 'anchors']);
    expect(scope?.actor).toBe(actor);
    expect(scope?.scopes).toBe(f.scopes);
    expect(scope?.anchors).toBe(f.anchors);
    expect(inputOf(f)).not.toBe(inputOf(f, 1));
    expect(scope).not.toBe(f.createOutput.mock.calls[1]?.[2]);
    expect(
      f.get.mock.calls
        .filter(([cap]) => cap !== 'production:read')
        .every(([cap]) => cap === 'production:report'),
    ).toBe(true);
  });
  it.each([null, undefined, [], '', 0, false])('root %j before auth', async (body) => {
    const f = fixture({ denied: true });
    expect(await f.dispatch(null, { body })).toEqual(invalid('A JSON object body is required'));
    expect(f.get).not.toHaveBeenCalled();
    expect(f.createOutput).not.toHaveBeenCalled();
  });
  it('unknown body idempotencyKey/version/state sorted before auth/getters', async () => {
    const f = fixture({ denied: true });
    const getter = vi.fn(() => {
      throw new Error('not read');
    });
    Object.defineProperty(f.production, 'createOutput', { get: getter });
    const body = Object.defineProperty(
      { ...valid(), z: undefined, version: 1, state: 'OPEN', idempotencyKey: 'KEY', a: null },
      'operationReportId',
      { enumerable: true, get: getter },
    );
    expect(await f.dispatch(body)).toEqual(
      invalid('Unsupported fields: a, idempotencyKey, state, version, z'),
    );
    expect(getter).not.toHaveBeenCalled();
    expect(f.get).not.toHaveBeenCalled();
  });
  it.each([{ denied: true }, { scopes: [] }, { fields: [] }, { fields: ['operationReportId'] }])(
    'auth %j before method/UUID/input',
    async (options) => {
      const f = fixture(options);
      const getter = vi.fn(() => {
        throw new Error('not read');
      });
      Object.defineProperty(f.production, 'createOutput', { get: getter });
      const body = Object.defineProperty(valid(), 'operationReportId', {
        enumerable: true,
        get: getter,
      });
      expect(await f.dispatch(body, { pathname: path('a') })).toEqual(
        options.denied || options.scopes ? denied : fieldDenied,
      );
      expect(getter).not.toHaveBeenCalled();
    },
  );
  it.each([{ fields: null }, { fields: keys }])('legal fields %j', async (options) => {
    expect((await fixture(options).dispatch()).statusCode).toBe(201);
  });
  it('own undefined quantity requested before parser', async () => {
    expect(
      await fixture({ fields: keys.filter((key) => key !== 'quantity') }).dispatch({
        ...valid(),
        quantity: undefined,
      }),
    ).toEqual(fieldDenied);
  });
  it('inherited/nonenumerable values readable without own requested fields', async () => {
    const f = fixture({ fields: [] });
    expect((await f.dispatch(Object.create(valid()) as Record<string, unknown>)).statusCode).toBe(
      201,
    );
    const second = fixture({ fields: [] });
    const body: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(valid()))
      Object.defineProperty(body, key, { value, enumerable: false });
    expect((await second.dispatch(body)).statusCode).toBe(201);
    expect(inputOf(f)).toEqual(inputOf(second));
  });
  it.each([null, undefined, [], { operationReportId: 'bad' }])(
    'missing repo skips %j',
    async (body) => {
      const f = fixture({ available: false, denied: true });
      expect(await f.dispatch(null, { body, pathname: path('a') })).toEqual(missing);
      expect(f.get).not.toHaveBeenCalled();
    },
  );
  it('missing repo no body getter; global401 first', async () => {
    const f = fixture({ available: false, denied: true });
    const getter = vi.fn(() => {
      throw new Error('body');
    });
    const body = Object.defineProperty({}, 'operationReportId', { enumerable: true, get: getter });
    expect(await f.dispatch(body)).toEqual(missing);
    f.authenticate.mockResolvedValueOnce(null);
    expect(await f.dispatch(body)).toEqual(
      error(401, 'authentication_required', 'A valid session is required'),
    );
    expect(getter).not.toHaveBeenCalled();
  });
  it.each(['GET', 'PATCH', 'PUT', 'DELETE', 'post'])('method %s unsupported', async (method) => {
    const f = fixture({ denied: true });
    expect(await f.dispatch(null, { method })).toEqual(missing);
    expect(f.get).not.toHaveBeenCalled();
  });
  it.each(['', 'g', id.toUpperCase(), ' ' + id, id + ' ', id + '/extra'])(
    'raw ID %s unsupported',
    async (orderId) => {
      const f = fixture({ denied: true });
      expect(await f.dispatch(null, { pathname: path(orderId) })).toEqual(missing);
      expect(f.get).not.toHaveBeenCalled();
    },
  );
  it.each([
    path() + '/',
    path() + '/extra',
    path().replace('finished-rolls', 'Finished-rolls'),
    path().replace('production-orders', 'Production-orders'),
  ])('path %s unsupported', async (pathname) => {
    const f = fixture({ denied: true });
    expect(await f.dispatch(null, { pathname })).toEqual(missing);
    expect(f.get).not.toHaveBeenCalled();
  });
  it.each(['a', '-', '00000000-0000-0000-0000-000000000000', id.replace('4aaa', '9aaa')])(
    'method captured before raw %s UUID failure/input',
    async (orderId) => {
      const f = fixture();
      const method = vi.fn(() => f.createOutput);
      const getter = vi.fn(() => {
        throw new Error('input');
      });
      Object.defineProperty(f.production, 'createOutput', { get: method });
      const body = Object.defineProperty(valid(), 'operationReportId', {
        enumerable: true,
        get: getter,
      });
      expect(await f.dispatch(body, { pathname: path(orderId) })).toEqual(
        invalid('productionOrderId must be a UUID'),
      );
      expect(method).toHaveBeenCalledOnce();
      expect(getter).not.toHaveBeenCalled();
    },
  );
  it('input getter method replacement still uses captured old receiver function', async () => {
    const f = fixture();
    const replacement = vi.fn<Production['createOutput']>().mockResolvedValue({ id: 'new' });
    const body = Object.defineProperty(valid(), 'operationReportId', {
      enumerable: true,
      get: () => {
        f.production.createOutput = replacement;
        return other;
      },
    });
    expect(await f.dispatch(body)).toEqual(response(201, row));
    expect(replacement).not.toHaveBeenCalled();
    expect(f.createOutput).toHaveBeenCalledOnce();
    expect(f.createOutput.mock.contexts[0]).toBe(f.production);
  });
  it('method, all seven value getters once, actor, then call', async () => {
    const f = fixture();
    const events: string[] = [];
    const values: Record<string, unknown> = valid();
    const body: Record<string, unknown> = {};
    for (const key of keys)
      Object.defineProperty(body, key, {
        enumerable: true,
        get: () => {
          events.push(key);
          return values[key];
        },
      });
    Object.defineProperty(f.production, 'createOutput', {
      get: () => {
        events.push('method');
        return f.createOutput;
      },
    });
    Object.defineProperty(f.context, 'actor', {
      get: () => {
        events.push('actor');
        return actor;
      },
    });
    f.createOutput.mockImplementationOnce(() => {
      events.push('call');
      return Promise.resolve(row);
    });
    expect((await f.dispatch(body)).statusCode).toBe(201);
    expect(events).toEqual(['method', ...keys, 'actor', 'call']);
  });
  const failures = [
    { key: 'operationReportId', value: 'bad', message: 'operationReportId must be a UUID' },
    { key: 'itemVersionId', value: 'bad', message: 'itemVersionId must be a UUID' },
    {
      key: 'rollNumber',
      value: 'bad',
      message: 'Code must be 1-64 uppercase letters, digits, underscore, or hyphen',
    },
    {
      key: 'lotNumber',
      value: 'bad',
      message: 'Code must be 1-64 uppercase letters, digits, underscore, or hyphen',
    },
    { key: 'locationId', value: 'bad', message: 'locationId must be a UUID' },
    { key: 'quantity', value: 'bad', message: 'Invalid decimal' },
    {
      key: 'manufacturedAt',
      value: 'bad',
      message: 'manufacturedAt must be a valid YYYY-MM-DD date',
    },
  ];
  it.each(failures)('$key precedes later failures/getters', async (entry) => {
    const f = fixture();
    const index = failures.indexOf(entry);
    const values: Record<string, unknown> = valid();
    const seen: string[] = [];
    const body: Record<string, unknown> = {};
    for (const later of failures.slice(index)) values[later.key] = later.value;
    for (const key of keys)
      Object.defineProperty(body, key, {
        enumerable: true,
        get: () => {
          seen.push(key);
          return values[key];
        },
      });
    expect(await f.dispatch(body)).toEqual(invalid(entry.message));
    expect(seen).toEqual(keys.slice(0, index + 1));
    expect(f.createOutput).not.toHaveBeenCalled();
  });
  for (const key of keys)
    it.each([undefined, null, '', ' ', 0, false, [], {}])(
      'required string ' + key + ' %j',
      async (value) => {
        expect(await fixture().dispatch({ ...valid(), [key]: value })).toEqual(
          invalid(key + ' is required'),
        );
      },
    );
  for (const key of uuids) {
    it.each(['bad', '00000000-0000-0000-0000-000000000000', id.replace('4aaa', '9aaa')])(
      'UUID ' + key + ' %s',
      async (value) => {
        expect(await fixture().dispatch({ ...valid(), [key]: value })).toEqual(
          invalid(key + ' must be a UUID'),
        );
      },
    );
    it('UUID ' + key + ' trimmed uppercase preserved', async () => {
      const f = fixture();
      expect(
        (await f.dispatch({ ...valid(), [key]: ' ' + id.toUpperCase() + ' ' })).statusCode,
      ).toBe(201);
      expect(inputOf(f)?.[key]).toBe(id.toUpperCase());
    });
  }
  for (const key of codes) {
    it.each(['a', '1ABC', 'A B', 'A/B', 'A'.repeat(65)])(
      'stableCode ' + key + ' %s invalid',
      async (value) => {
        expect(await fixture().dispatch({ ...valid(), [key]: value })).toEqual(
          invalid('Code must be 1-64 uppercase letters, digits, underscore, or hyphen'),
        );
      },
    );
    it.each(['A', 'A_1-B', 'A'.repeat(64)])('stableCode ' + key + ' %s trims', async (value) => {
      const f = fixture();
      expect((await f.dispatch({ ...valid(), [key]: ' ' + value + ' ' })).statusCode).toBe(201);
      expect(inputOf(f)?.[key]).toBe(value);
    });
  }
  it.each([
    { value: ' 1.230000 ', expected: '1.23' },
    { value: '1.123456', expected: '1.123456' },
    { value: '0', expected: '0' },
    { value: '-0', expected: '0' },
    { value: '-0.000000', expected: '0' },
  ])('quantity $value → $expected only HTTP forward', async ({ value, expected }) => {
    const f = fixture();
    expect((await f.dispatch({ ...valid(), quantity: value })).statusCode).toBe(201);
    expect(inputOf(f)?.quantity).toBe(expected);
  });
  it.each(['001', '1.1234567', '1000000000000000000', '+1', '.5', '1e2', 'NaN', 'Infinity'])(
    'quantity %s invalid decimal',
    async (value) => {
      expect(await fixture().dispatch({ ...valid(), quantity: value })).toEqual(
        invalid('Invalid decimal'),
      );
    },
  );
  it.each(['-1', '-0.000001'])('quantity %s negative', async (value) => {
    expect(await fixture().dispatch({ ...valid(), quantity: value })).toEqual(
      invalid('quantity must be non-negative'),
    );
  });
  it.each(['2026-10-14', '2026-02-30', '2026-04-31', '2024-02-29'])(
    'calendar %s returns original trimmed text, not ISO/realPG validity',
    async (value) => {
      const f = fixture();
      expect((await f.dispatch({ ...valid(), manufacturedAt: ' ' + value + ' ' })).statusCode).toBe(
        201,
      );
      expect(inputOf(f)?.manufacturedAt).toBe(value);
    },
  );
  it.each([
    'bad',
    '2026-13-01',
    '2026-01-32',
    '2026-1-01',
    '2026-01-1',
    '2026-10-14T00:00:00Z',
    '2026-10-14+08:00',
    '2026/10/14',
  ])('calendar %s rejects original regex/Date.parse', async (value) => {
    expect(await fixture().dispatch({ ...valid(), manufacturedAt: value })).toEqual(
      invalid('manufacturedAt must be a valid YYYY-MM-DD date'),
    );
  });
  it.each([undefined, '', 'HEADER', 'x'.repeat(201)])(
    'header %s/query ignored without input key',
    async (key) => {
      const f = fixture();
      const getter = vi.fn(() => {
        throw new Error('query');
      });
      expect(
        (
          await f.dispatch(valid(), {
            headers: { 'idempotency-key': key },
            query: Object.defineProperty({}, 'idempotencyKey', { enumerable: true, get: getter }),
          })
        ).statusCode,
      ).toBe(201);
      expect(Object.keys(inputOf(f) ?? {})).toEqual(keys);
      expect(Object.hasOwn(inputOf(f) ?? {}, 'idempotencyKey')).toBe(false);
      expect(getter).not.toHaveBeenCalled();
    },
  );
  it('same/changed request with same header always forwards, not PG replay proof', async () => {
    const f = fixture();
    const request = { headers: { 'idempotency-key': 'HEADER' } };
    expect((await f.dispatch(valid(), request)).statusCode).toBe(201);
    expect((await f.dispatch(valid(), request)).statusCode).toBe(201);
    expect((await f.dispatch({ ...valid(), quantity: '2' }, request)).statusCode).toBe(201);
    expect(f.createOutput.mock.calls).toHaveLength(3);
    expect(inputOf(f, 2)?.quantity).toBe('2');
  });
  it('no independent read permits write and id/version fallback', async () => {
    expect(await fixture({ noRead: true }).dispatch()).toEqual(response(201, { id, version: 7 }));
  });
  it.each([
    { fields: null, expected: row },
    { fields: [], expected: { id } },
    { fields: ['name'], expected: { id, name: 'output' } },
    { fields: ['version', 'nested'], expected: { id, version: 7, nested } },
    { fields: ['id', 'version', 'name', 'secret', 'nested'], expected: row },
  ])('read $fields independent from legal write', async ({ fields, expected }) => {
    const f = fixture({ fields: keys, readFields: fields });
    const result = await f.dispatch();
    expect(result).toEqual(response(201, expected));
    if (fields === null) expect(result.body).toBe(row);
    else expect(result.body).not.toBe(row);
    if (typeof result.body === 'object' && result.body !== null && 'nested' in result.body)
      expect(result.body.nested).toBe(nested);
  });
  it('late Map replace/delete fields read once after await', async () => {
    const f = fixture({ readFields: [] });
    const getter = vi.fn(() => ['name']);
    f.createOutput.mockImplementationOnce(() => {
      expect(f.get.mock.calls.some(([cap]) => cap === 'production:read')).toBe(false);
      f.permissions.set('production:read', {
        scopes: [],
        get fields() {
          return getter();
        },
      });
      return Promise.resolve(row);
    });
    expect(await f.dispatch()).toEqual(response(201, { id, name: 'output' }));
    expect(getter).toHaveBeenCalledOnce();
    const removed = fixture();
    removed.createOutput.mockImplementationOnce(() => {
      removed.permissions.delete('production:read');
      return Promise.resolve(row);
    });
    expect(await removed.dispatch()).toEqual(response(201, { id, version: 7 }));
  });
  it.each(['SELF', 'TEAM', 'DEPARTMENT', 'REGION', 'COMPANY', 'GROUP'] as const)(
    'scope %s only original refs forward',
    async (scope) => {
      const f = fixture({ scopes: [scope] });
      expect((await f.dispatch()).statusCode).toBe(201);
      expect(f.createOutput.mock.calls[0]?.[2].scopes).toBe(f.scopes);
      expect(f.createOutput.mock.calls[0]?.[2].anchors).toBe(f.anchors);
    },
  );
  it('null projection no enumeration/finite eager excluded getter', async () => {
    const getter = vi.fn(() => 'secret');
    const result: JsonObject = {
      id,
      version: 7,
      get secret() {
        return getter();
      },
    };
    const raw = fixture();
    raw.createOutput.mockResolvedValueOnce(result);
    expect((await raw.dispatch()).body).toBe(result);
    expect(getter).not.toHaveBeenCalled();
    const finite = fixture({ readFields: [] });
    finite.createOutput.mockResolvedValueOnce(result);
    expect(await finite.dispatch()).toEqual(response(201, { id }));
    expect(getter).toHaveBeenCalledOnce();
  });
  it('special own keys/order/nestedref/no fabricated id', async () => {
    const result: JsonObject = Object.fromEntries<JsonObject[string]>([
      ['toString', 'data'],
      ['__proto__', nested],
      ['constructor', 'data'],
      ['version', 7],
    ]);
    const f = fixture({ readFields: ['version', '__proto__', 'constructor', 'toString'] });
    f.createOutput.mockResolvedValueOnce(result);
    const created = await f.dispatch();
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
  it.each([
    { code: 'conflict', status: 409 },
    { code: 'forbidden', status: 403 },
    { code: 'not_found', status: 404 },
    { code: 'invalid_request', status: 400 },
  ] as const)('repo $code/C/no early read', async ({ code, status }) => {
    const f = fixture();
    f.createOutput.mockRejectedValueOnce(new DomainError(code, 'original repository error'));
    expect(await f.dispatch()).toEqual(error(status, code, 'original repository error'));
    expect(f.get.mock.calls.some(([cap]) => cap === 'production:read')).toBe(false);
  });
  it('report/material/create/commands neighbours independent', async () => {
    const f = fixture();
    for (const pathname of [
      path().replace('finished-rolls', 'operation-reports'),
      path().replace('finished-rolls', 'materials'),
      '/api/v1/production-orders',
      '/api/v1/production-orders/' + id + '/release',
    ])
      expect(await f.dispatch(null, { pathname })).toEqual(
        invalid('A JSON object body is required'),
      );
    expect(f.createOutput).not.toHaveBeenCalled();
  });
});
