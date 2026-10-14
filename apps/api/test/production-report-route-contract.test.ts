// Fixed against bc544f3 inline operation-reports; no future report route imported.
import { describe, expect, it, vi } from 'vitest';
import { DomainError, type AuthorizationContext } from '@kingturf/domain';
import type { DataScope, JsonObject, PermissionKey } from '@kingturf/types';
import { buildApp, type ApiDependencies, type ApiRequest } from '../src/app.js';

type Production = NonNullable<ApiDependencies['production']>;
type Grant = NonNullable<ReturnType<AuthorizationContext['permissions']['get']>>;
const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const other = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const correlationId = '33333333-3333-4333-8333-333333333333';
const actor = { companyId: 'report-mock-tenant', employeeId: id };
const nested = { retained: true };
const row: JsonObject = { id, version: 7, name: 'report', secret: 'private', nested };
const keys = [
  'operationId',
  'goodQuantity',
  'scrapQuantity',
  'laborMinutes',
  'machineMinutes',
  'startedAt',
  'completedAt',
  'notes',
  'idempotencyKey',
];
const decimals = ['goodQuantity', 'scrapQuantity', 'laborMinutes', 'machineMinutes'] as const;
const times = ['startedAt', 'completedAt'] as const;
const valid = () => ({
  operationId: other,
  goodQuantity: '10',
  scrapQuantity: '1',
  laborMinutes: '60',
  machineMinutes: '55',
  startedAt: '2026-10-14T10:20:30+08:00',
  completedAt: '2026-10-14T11:20:30+08:00',
  notes: ' Posted ',
  idempotencyKey: ' BODY-KEY ',
});
const parsed = () => ({
  ...valid(),
  startedAt: '2026-10-14T02:20:30.000Z',
  completedAt: '2026-10-14T03:20:30.000Z',
  notes: 'Posted',
  idempotencyKey: 'BODY-KEY',
});
const path = (orderId = id) => '/api/v1/production-orders/' + orderId + '/operation-reports';
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
  const reportOperation = vi.fn<Production['reportOperation']>().mockResolvedValue(row);
  const production = { reportOperation };
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
    reportOperation,
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
  headers: { 'x-correlation-id': correlationId },
});
const error = (statusCode: number, code: string, message: string) =>
  response(statusCode, { error: { code, message, correlationId } });
const invalid = (message: string) => error(400, 'invalid_request', message);
const denied = error(403, 'forbidden', 'Permission denied');
const fieldDenied = error(403, 'forbidden', 'Field permission denied');
const missing = error(404, 'not_found', 'Route not found');
const inputOf = (f: ReturnType<typeof fixture>, index = 0) =>
  f.reportOperation.mock.calls[index]?.[1];

describe('old production operation-reports contract', () => {
  it('four exact args/receiver/ordered fresh input and scope references', async () => {
    const f = fixture();
    const first = await f.dispatch();
    expect(first).toEqual(response(201, row));
    expect(first.body).toBe(row);
    expect((await f.dispatch()).statusCode).toBe(201);
    expect(f.reportOperation.mock.calls[0]).toEqual([
      id,
      parsed(),
      { actor, scopes: f.scopes, anchors: f.anchors },
      correlationId,
    ]);
    expect(f.reportOperation.mock.calls[0]).toHaveLength(4);
    expect(f.reportOperation.mock.contexts[0]).toBe(f.production);
    expect(Object.keys(inputOf(f) ?? {})).toEqual(keys);
    const scope = f.reportOperation.mock.calls[0]?.[2];
    expect(Object.keys(scope ?? {})).toEqual(['actor', 'scopes', 'anchors']);
    expect(scope?.actor).toBe(actor);
    expect(scope?.scopes).toBe(f.scopes);
    expect(scope?.anchors).toBe(f.anchors);
    expect(inputOf(f)).not.toBe(inputOf(f, 1));
    expect(scope).not.toBe(f.reportOperation.mock.calls[1]?.[2]);
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
    expect(f.reportOperation).not.toHaveBeenCalled();
  });
  it('unknown own keys sorted before auth/value/method', async () => {
    const f = fixture({ denied: true });
    const getter = vi.fn(() => {
      throw new Error('not read');
    });
    Object.defineProperty(f.production, 'reportOperation', { get: getter });
    const body = Object.defineProperty(
      { ...valid(), z: undefined, version: 1, state: 'OPEN', a: null },
      'operationId',
      { enumerable: true, get: getter },
    );
    expect(await f.dispatch(body)).toEqual(invalid('Unsupported fields: a, state, version, z'));
    expect(getter).not.toHaveBeenCalled();
    expect(f.get).not.toHaveBeenCalled();
  });
  it.each([{ denied: true }, { scopes: [] }, { fields: [] }, { fields: ['operationId'] }])(
    'authorization %j before method/UUID/input',
    async (options) => {
      const f = fixture(options);
      const getter = vi.fn(() => {
        throw new Error('not read');
      });
      Object.defineProperty(f.production, 'reportOperation', { get: getter });
      const body = Object.defineProperty(valid(), 'operationId', { enumerable: true, get: getter });
      expect(await f.dispatch(body, { pathname: path('a') })).toEqual(
        options.denied || options.scopes ? denied : fieldDenied,
      );
      expect(getter).not.toHaveBeenCalled();
    },
  );
  it.each([{ fields: null }, { fields: keys }])('full grant %j', async (options) => {
    expect((await fixture(options).dispatch()).statusCode).toBe(201);
  });
  it('own undefined notes requested before nullish parser; absent notes still required', async () => {
    const f = fixture({ fields: keys.filter((key) => key !== 'notes') });
    expect(await f.dispatch({ ...valid(), notes: undefined })).toEqual(fieldDenied);
    const absent: Record<string, unknown> = valid();
    delete absent.notes;
    expect(await f.dispatch(absent)).toEqual(invalid('notes is required'));
  });
  it('inherited and nonenumerable values parser-readable with empty requested fields', async () => {
    const f = fixture({ fields: [] });
    const body = Object.create(valid()) as Record<string, unknown>;
    expect((await f.dispatch(body)).statusCode).toBe(201);
    const second = fixture({ fields: [] });
    const own: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(valid()))
      Object.defineProperty(own, key, { value, enumerable: false });
    expect((await second.dispatch(own)).statusCode).toBe(201);
    expect(inputOf(f)).toEqual(inputOf(second));
  });
  it.each([null, undefined, [], { operationId: 'bad' }])('missing repo skips %j', async (body) => {
    const f = fixture({ available: false, denied: true });
    expect(await f.dispatch(null, { body, pathname: path('a') })).toEqual(missing);
    expect(f.get).not.toHaveBeenCalled();
  });
  it('missing repo ignores body getters; global401 first', async () => {
    const f = fixture({ available: false, denied: true });
    const getter = vi.fn(() => {
      throw new Error('body');
    });
    const body = Object.defineProperty({}, 'operationId', { enumerable: true, get: getter });
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
    path().replace('operation-reports', 'Operation-reports'),
    path().replace('production-orders', 'Production-orders'),
  ])('path %s unsupported', async (pathname) => {
    const f = fixture({ denied: true });
    expect(await f.dispatch(null, { pathname })).toEqual(missing);
    expect(f.get).not.toHaveBeenCalled();
  });
  it.each(['a', '-', '00000000-0000-0000-0000-000000000000', id.replace('4aaa', '9aaa')])(
    'method captured before raw %s UUID failure and input',
    async (orderId) => {
      const f = fixture();
      const method = vi.fn(() => f.reportOperation);
      const getter = vi.fn(() => {
        throw new Error('input');
      });
      Object.defineProperty(f.production, 'reportOperation', { get: method });
      const body = Object.defineProperty(valid(), 'operationId', { enumerable: true, get: getter });
      expect(await f.dispatch(body, { pathname: path(orderId) })).toEqual(
        invalid('productionOrderId must be a UUID'),
      );
      expect(method).toHaveBeenCalledOnce();
      expect(getter).not.toHaveBeenCalled();
    },
  );
  it('input getter replacing method still invokes original captured method', async () => {
    const f = fixture();
    const replacement = vi.fn<Production['reportOperation']>().mockResolvedValue({ id: 'new' });
    const body = Object.defineProperty(valid(), 'operationId', {
      enumerable: true,
      get: () => {
        f.production.reportOperation = replacement;
        return other;
      },
    });
    expect(await f.dispatch(body)).toEqual(response(201, row));
    expect(replacement).not.toHaveBeenCalled();
    expect(f.reportOperation).toHaveBeenCalledOnce();
    expect(f.reportOperation.mock.contexts[0]).toBe(f.production);
  });
  it('all getter sequence method/input nine keys/actor/call, notes read once', async () => {
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
    Object.defineProperty(f.production, 'reportOperation', {
      get: () => {
        events.push('method');
        return f.reportOperation;
      },
    });
    Object.defineProperty(f.context, 'actor', {
      get: () => {
        events.push('actor');
        return actor;
      },
    });
    f.reportOperation.mockImplementationOnce(() => {
      events.push('call');
      return Promise.resolve(row);
    });
    expect((await f.dispatch(body)).statusCode).toBe(201);
    expect(events).toEqual(['method', ...keys, 'actor', 'call']);
  });
  const failures = [
    { key: 'operationId', value: 'bad', message: 'operationId must be a UUID' },
    ...decimals.map((key) => ({ key, value: 'bad', message: 'Invalid decimal' })),
    ...times.map((key) => ({ key, value: 'bad', message: key + ' must be a valid timestamp' })),
    { key: 'notes', value: null, message: 'notes is required' },
    { key: 'idempotencyKey', value: null, message: 'idempotencyKey is required' },
  ];
  it.each(failures)('$key before later failures/getters', async (entry) => {
    const f = fixture();
    const index = failures.indexOf(entry);
    const values: Record<string, unknown> = valid();
    for (const later of failures.slice(index)) values[later.key] = later.value;
    const seen: string[] = [];
    const body: Record<string, unknown> = {};
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
    expect(f.reportOperation).not.toHaveBeenCalled();
  });
  for (const key of keys) {
    it.each([undefined, null, '', ' ', 0, false, [], {}])(
      'required string ' + key + ' %j',
      async (value) => {
        expect(await fixture().dispatch({ ...valid(), [key]: value })).toEqual(
          invalid(key + ' is required'),
        );
      },
    );
  }
  it.each(['bad', '00000000-0000-0000-0000-000000000000', id.replace('4aaa', '9aaa')])(
    'operation UUID %s',
    async (value) => {
      expect(await fixture().dispatch({ ...valid(), operationId: value })).toEqual(
        invalid('operationId must be a UUID'),
      );
    },
  );
  it('body operation UUID trimmed uppercase preserved', async () => {
    const f = fixture();
    expect(
      (await f.dispatch({ ...valid(), operationId: ' ' + other.toUpperCase() + ' ' })).statusCode,
    ).toBe(201);
    expect(inputOf(f)?.operationId).toBe(other.toUpperCase());
  });
  for (const key of decimals) {
    it.each([
      { value: ' 1.230000 ', expected: '1.23' },
      { value: '1.123456', expected: '1.123456' },
      { value: '0', expected: '0' },
      { value: '-0', expected: '0' },
      { value: '-0.000000', expected: '0' },
    ])('decimal ' + key + ' $value → $expected HTTP-only', async ({ value, expected }) => {
      const f = fixture();
      expect((await f.dispatch({ ...valid(), [key]: value })).statusCode).toBe(201);
      expect(inputOf(f)?.[key]).toBe(expected);
    });
    it.each(['001', '1.1234567', '1000000000000000000', '+1', '.5', '1e2', 'NaN', 'Infinity'])(
      'decimal ' + key + ' %s invalid',
      async (value) => {
        expect(await fixture().dispatch({ ...valid(), [key]: value })).toEqual(
          invalid('Invalid decimal'),
        );
      },
    );
    it.each(['-1', '-0.000001'])('decimal ' + key + ' %s negative', async (value) => {
      expect(await fixture().dispatch({ ...valid(), [key]: value })).toEqual(
        invalid(key + ' must be non-negative'),
      );
    });
  }
  for (const key of times) {
    it.each([
      { value: '2026-10-14T10:20:30+08:00', expected: '2026-10-14T02:20:30.000Z' },
      { value: '2026-10-14', expected: '2026-10-14T00:00:00.000Z' },
      { value: '2026-02-30T00:00:00Z', expected: '2026-03-02T00:00:00.000Z' },
      { value: '2026-10-14T24:00:00Z', expected: '2026-10-15T00:00:00.000Z' },
    ])('time ' + key + ' $value original Date surface', async ({ value, expected }) => {
      const f = fixture();
      expect((await f.dispatch({ ...valid(), [key]: ' ' + value + ' ' })).statusCode).toBe(201);
      expect(inputOf(f)?.[key]).toBe(expected);
    });
    it.each(['bad', '2026-13-01', '2026-01-32T00:00:00Z'])(
      'time ' + key + ' %s invalid',
      async (value) => {
        expect(await fixture().dispatch({ ...valid(), [key]: value })).toEqual(
          invalid(key + ' must be a valid timestamp'),
        );
      },
    );
  }
  it('zero, scrap greater than good, time reversed and work relations only forwarded', async () => {
    const f = fixture();
    const body = {
      ...valid(),
      goodQuantity: '0',
      scrapQuantity: '999',
      laborMinutes: '0',
      machineMinutes: '9999',
      startedAt: valid().completedAt,
      completedAt: valid().startedAt,
    };
    expect((await f.dispatch(body)).statusCode).toBe(201);
    expect(inputOf(f)).toEqual({
      ...parsed(),
      goodQuantity: '0',
      scrapQuantity: '999',
      laborMinutes: '0',
      machineMinutes: '9999',
      startedAt: parsed().completedAt,
      completedAt: parsed().startedAt,
    });
  });
  it.each([undefined, null, '', ' ', 0, false, [], {}])(
    'notes getter %j read once and rejected, no optional empty default',
    async (value) => {
      const getter = vi.fn().mockReturnValueOnce(value).mockReturnValue('valid');
      const body = Object.defineProperty(valid(), 'notes', { enumerable: true, get: getter });
      expect(await fixture().dispatch(body)).toEqual(invalid('notes is required'));
      expect(getter).toHaveBeenCalledOnce();
    },
  );
  it('notes getter trimmed once and key follows it', async () => {
    const f = fixture();
    const getter = vi.fn().mockReturnValueOnce(' Trimmed ').mockReturnValue(null);
    const body = Object.defineProperty(valid(), 'notes', { enumerable: true, get: getter });
    expect((await f.dispatch(body)).statusCode).toBe(201);
    expect(inputOf(f)?.notes).toBe('Trimmed');
    expect(getter).toHaveBeenCalledOnce();
  });
  it.each(['a', '1ABC', 'A B', 'A/B', 'A'.repeat(65)])('body key %s invalid', async (value) => {
    expect(await fixture().dispatch({ ...valid(), idempotencyKey: value })).toEqual(
      invalid('Code must be 1-64 uppercase letters, digits, underscore, or hyphen'),
    );
  });
  it.each(['A', 'A_1-B', 'A'.repeat(64)])('body key %s trims', async (value) => {
    const f = fixture();
    expect((await f.dispatch({ ...valid(), idempotencyKey: ' ' + value + ' ' })).statusCode).toBe(
      201,
    );
    expect(inputOf(f)?.idempotencyKey).toBe(value);
  });
  it.each([undefined, '', 'different', 'x'.repeat(201)])('header %s/query ignored', async (key) => {
    const f = fixture();
    const getter = vi.fn(() => {
      throw new Error('query');
    });
    expect(
      (
        await f.dispatch(valid(), {
          headers: { 'idempotency-key': key },
          query: Object.defineProperty({}, 'limit', { enumerable: true, get: getter }),
        })
      ).statusCode,
    ).toBe(201);
    expect(inputOf(f)?.idempotencyKey).toBe('BODY-KEY');
    expect(getter).not.toHaveBeenCalled();
  });
  it('valid header not a fallback for missing body key', async () => {
    expect(
      await fixture().dispatch(
        { ...valid(), idempotencyKey: undefined },
        { headers: { 'idempotency-key': 'HEADER' } },
      ),
    ).toEqual(invalid('idempotencyKey is required'));
  });
  it('no read permission still legal write, id/version fallback', async () => {
    const f = fixture({ noRead: true });
    expect(await f.dispatch()).toEqual(response(201, { id, version: 7 }));
  });
  it.each([
    { fields: null, expected: row },
    { fields: [], expected: { id } },
    { fields: ['name'], expected: { id, name: 'report' } },
    { fields: ['version', 'nested'], expected: { id, version: 7, nested } },
    { fields: ['id', 'version', 'name', 'secret', 'nested'], expected: row },
  ])('read $fields separate from write', async ({ fields, expected }) => {
    const f = fixture({ fields: keys, readFields: fields });
    const result = await f.dispatch();
    expect(result).toEqual(response(201, expected));
    if (fields === null) expect(result.body).toBe(row);
    else expect(result.body).not.toBe(row);
    if (typeof result.body === 'object' && result.body !== null && 'nested' in result.body)
      expect(result.body.nested).toBe(nested);
  });
  it('awaited write before read Map replacement/delete/fields single read', async () => {
    const f = fixture({ readFields: [] });
    const getter = vi.fn(() => ['name']);
    f.reportOperation.mockImplementationOnce(() => {
      expect(f.get.mock.calls.some(([cap]) => cap === 'production:read')).toBe(false);
      f.permissions.set('production:read', {
        scopes: [],
        get fields() {
          return getter();
        },
      });
      return Promise.resolve(row);
    });
    expect(await f.dispatch()).toEqual(response(201, { id, name: 'report' }));
    expect(getter).toHaveBeenCalledOnce();
    const removed = fixture();
    removed.reportOperation.mockImplementationOnce(() => {
      removed.permissions.delete('production:read');
      return Promise.resolve(row);
    });
    expect(await removed.dispatch()).toEqual(response(201, { id, version: 7 }));
  });
  it('same key and changed body forwarded every time not PG replay proof', async () => {
    const f = fixture();
    expect((await f.dispatch()).statusCode).toBe(201);
    expect((await f.dispatch()).statusCode).toBe(201);
    expect((await f.dispatch({ ...valid(), goodQuantity: '2' })).statusCode).toBe(201);
    expect(f.reportOperation.mock.calls).toHaveLength(3);
    expect(inputOf(f, 2)?.goodQuantity).toBe('2');
    expect(inputOf(f, 2)?.idempotencyKey).toBe(inputOf(f)?.idempotencyKey);
  });
  it.each(['SELF', 'TEAM', 'DEPARTMENT', 'REGION', 'COMPANY', 'GROUP'] as const)(
    'HTTP scope %s refs only forward proof',
    async (scope) => {
      const f = fixture({ scopes: [scope] });
      expect((await f.dispatch()).statusCode).toBe(201);
      expect(f.reportOperation.mock.calls[0]?.[2].scopes).toBe(f.scopes);
      expect(f.reportOperation.mock.calls[0]?.[2].anchors).toBe(f.anchors);
    },
  );
  it('null result projection avoids enumeration while finite eagerly reads excluded keys', async () => {
    const getter = vi.fn(() => 'secret');
    const result: JsonObject = {
      id,
      version: 7,
      get secret() {
        return getter();
      },
    };
    const raw = fixture();
    raw.reportOperation.mockResolvedValueOnce(result);
    expect((await raw.dispatch()).body).toBe(result);
    expect(getter).not.toHaveBeenCalled();
    const finite = fixture({ readFields: [] });
    finite.reportOperation.mockResolvedValueOnce(result);
    expect(await finite.dispatch()).toEqual(response(201, { id }));
    expect(getter).toHaveBeenCalledOnce();
  });
  it('special own keys/order/shallow refs/no fabricated id', async () => {
    const result: JsonObject = Object.fromEntries<JsonObject[string]>([
      ['toString', 'data'],
      ['__proto__', nested],
      ['constructor', 'data'],
      ['version', 7],
    ]);
    const f = fixture({ readFields: ['version', '__proto__', 'constructor', 'toString'] });
    f.reportOperation.mockResolvedValueOnce(result);
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
  ] as const)(
    'repo DomainError $code and correlation unchanged/no early read',
    async ({ code, status }) => {
      const f = fixture();
      f.reportOperation.mockRejectedValueOnce(new DomainError(code, 'original repository error'));
      expect(await f.dispatch()).toEqual(error(status, code, 'original repository error'));
      expect(f.get.mock.calls.some(([cap]) => cap === 'production:read')).toBe(false);
    },
  );
  it('neighbour material/output/create/commands remain independent', async () => {
    const f = fixture();
    for (const pathname of [
      path().replace('operation-reports', 'materials'),
      path().replace('operation-reports', 'finished-rolls'),
      '/api/v1/production-orders',
      '/api/v1/production-orders/' + id + '/release',
    ])
      expect(await f.dispatch(null, { pathname })).toEqual(
        invalid('A JSON object body is required'),
      );
    expect(f.reportOperation).not.toHaveBeenCalled();
  });
});
