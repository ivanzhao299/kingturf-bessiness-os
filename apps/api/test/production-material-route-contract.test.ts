// Fixed against a51d848 inline materials; no future material route imported.
import { describe, expect, it, vi } from 'vitest';
import { DomainError, type AuthorizationContext } from '@kingturf/domain';
import type { DataScope, JsonObject, PermissionKey } from '@kingturf/types';
import { buildApp, type ApiDependencies, type ApiRequest } from '../src/app.js';

type Production = NonNullable<ApiDependencies['production']>;
type Grant = NonNullable<ReturnType<AuthorizationContext['permissions']['get']>>;
const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const other = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const correlationId = '33333333-3333-4333-8333-333333333333';
const actor = { companyId: 'material-mock-tenant', employeeId: id };
const nested = { retained: true };
const row: JsonObject = { id, version: 7, name: 'material', secret: 'private', nested };
const keys = [
  'transactionType',
  'itemVersionId',
  'lotId',
  'locationId',
  'quantity',
  'reason',
  'occurredAt',
  'idempotencyKey',
];
const valid = (transactionType: 'ISSUE' | 'RETURN' = 'ISSUE') => ({
  transactionType,
  itemVersionId: id,
  lotId: other,
  locationId: id,
  quantity: '10',
  reason: ' Posted ',
  occurredAt: '2026-10-14T10:20:30+08:00',
  idempotencyKey: ' BODY-KEY ',
});
const path = (orderId = id) => '/api/v1/production-orders/' + orderId + '/materials';
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
    ['production:material', 'production:plan', 'production:report', 'production:close'].map(
      (cap) => [
        cap as PermissionKey,
        { scopes, fields: options.fields === undefined ? null : options.fields },
      ],
    ),
  );
  if (options.denied) permissions.delete('production:material');
  if (!options.noRead)
    permissions.set('production:read', {
      scopes: [],
      fields: options.readFields === undefined ? null : options.readFields,
    });
  const context: AuthorizationContext = {
    actor,
    permissions,
    scopeAnchors: new Map([['production:material', anchors]]),
  };
  const get = vi.spyOn(permissions, 'get');
  const transactMaterial = vi.fn<Production['transactMaterial']>().mockResolvedValue(row);
  const production = { transactMaterial };
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
    transactMaterial,
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
  },
});
const error = (statusCode: number, code: string, message: string) =>
  response(statusCode, { error: { code, message, correlationId } });
const invalid = (message: string) => error(400, 'invalid_request', message);
const denied = error(403, 'forbidden', 'Permission denied');
const fieldDenied = error(403, 'forbidden', 'Field permission denied');
const missing = error(404, 'not_found', 'Route not found');
const inputOf = (f: ReturnType<typeof fixture>, index = 0) =>
  f.transactMaterial.mock.calls[index]?.[1];

describe('old production materials contract', () => {
  it.each(['ISSUE', 'RETURN'] as const)(
    '%s is one path with four args/receiver/ref/key order and fresh input/context',
    async (type) => {
      const f = fixture();
      expect(await f.dispatch(valid(type))).toEqual(response(201, row));
      expect(await f.dispatch(valid(type))).toEqual(response(201, row));
      expect(f.transactMaterial.mock.calls).toHaveLength(2);
      expect(f.transactMaterial.mock.calls[0]).toEqual([
        id,
        {
          ...valid(type),
          reason: 'Posted',
          occurredAt: '2026-10-14T02:20:30.000Z',
          idempotencyKey: 'BODY-KEY',
        },
        { actor, scopes: f.scopes, anchors: f.anchors },
        correlationId,
      ]);
      expect(f.transactMaterial.mock.contexts[0]).toBe(f.production);
      expect(Object.keys(inputOf(f) ?? {})).toEqual(keys);
      const scope = f.transactMaterial.mock.calls[0]?.[2];
      expect(Object.keys(scope ?? {})).toEqual(['actor', 'scopes', 'anchors']);
      expect(scope?.actor).toBe(actor);
      expect(scope?.scopes).toBe(f.scopes);
      expect(scope?.anchors).toBe(f.anchors);
      expect(inputOf(f)).not.toBe(inputOf(f, 1));
      expect(scope).not.toBe(f.transactMaterial.mock.calls[1]?.[2]);
      expect(
        f.get.mock.calls
          .filter(([cap]) => cap !== 'production:read')
          .every(([cap]) => cap === 'production:material'),
      ).toBe(true);
    },
  );
  it.each([null, undefined, [], '', 0, false])(
    'root %j rejects before material capability',
    async (body) => {
      const f = fixture({ denied: true });
      expect(await f.dispatch(null, { body })).toEqual(invalid('A JSON object body is required'));
      expect(f.get).not.toHaveBeenCalled();
      expect(f.transactMaterial).not.toHaveBeenCalled();
    },
  );
  it('unknown own keys sort before cap/type/getters', async () => {
    const f = fixture({ denied: true });
    const getter = vi.fn(() => {
      throw new Error('no values');
    });
    const body = { ...valid(), z: undefined, version: 1, state: 'ISSUE', a: null };
    Object.defineProperty(body, 'transactionType', { enumerable: true, get: getter });
    expect(await f.dispatch(body)).toEqual(invalid('Unsupported fields: a, state, version, z'));
    expect(getter).not.toHaveBeenCalled();
    expect(f.get).not.toHaveBeenCalled();
  });
  it.each([{ denied: true }, { scopes: [] }, { fields: [] }, { fields: ['transactionType'] }])(
    'authorization %j precedes type/UUID/method',
    async (options) => {
      const f = fixture(options);
      const type = vi.fn(() => {
        throw new Error('type before auth');
      });
      const method = vi.fn(() => f.transactMaterial);
      Object.defineProperty(f.production, 'transactMaterial', { get: method });
      const body = Object.defineProperty(valid(), 'transactionType', {
        enumerable: true,
        get: type,
      });
      expect(await f.dispatch(body, { pathname: path('a') })).toEqual(
        options.denied || options.scopes ? denied : fieldDenied,
      );
      expect(type).not.toHaveBeenCalled();
      expect(method).not.toHaveBeenCalled();
    },
  );
  it.each([{ fields: null }, { fields: keys }])(
    'original legal field grants %j',
    async (options) => {
      const f = fixture(options);
      expect((await f.dispatch()).statusCode).toBe(201);
    },
  );
  it('own undefined quantity remains a requested field before its parser', async () => {
    const f = fixture({ fields: keys.filter((key) => key !== 'quantity') });
    expect(await f.dispatch({ ...valid(), quantity: undefined })).toEqual(fieldDenied);
    expect(f.transactMaterial).not.toHaveBeenCalled();
  });
  it('inherited/nonenumerable fields remain parser readable without requested own fields', async () => {
    const f = fixture({ fields: [] });
    const body: Record<string, unknown> = Object.create(valid()) as Record<string, unknown>;
    expect((await f.dispatch(body)).statusCode).toBe(201);
    const next = fixture({ fields: [] });
    const nonEnumerable: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(valid()))
      Object.defineProperty(nonEnumerable, key, { value, enumerable: false });
    expect((await next.dispatch(nonEnumerable)).statusCode).toBe(201);
    expect(inputOf(next)).toEqual(inputOf(f));
  });
  it.each([null, undefined, [], { transactionType: 'BAD' }])(
    'missing repo skips %j before capability/input',
    async (body) => {
      const f = fixture({ available: false, denied: true });
      expect(await f.dispatch(null, { body, pathname: path('a') })).toEqual(missing);
      expect(f.get).not.toHaveBeenCalled();
    },
  );
  it('missing repo ignores body values; global401 still first', async () => {
    const f = fixture({ available: false, denied: true });
    const getter = vi.fn(() => {
      throw new Error('body');
    });
    const body = Object.defineProperty({}, 'transactionType', { enumerable: true, get: getter });
    expect(await f.dispatch(body)).toEqual(missing);
    f.authenticate.mockResolvedValueOnce(null);
    expect(await f.dispatch(body)).toEqual(
      error(401, 'authentication_required', 'A valid session is required'),
    );
    expect(getter).not.toHaveBeenCalled();
  });
  it.each(['GET', 'PATCH', 'PUT', 'DELETE', 'post'])(
    'unsupported method %s remains404',
    async (method) => {
      const f = fixture({ denied: true });
      expect(await f.dispatch(null, { method })).toEqual(missing);
      expect(f.get).not.toHaveBeenCalled();
    },
  );
  it.each(['', 'g', id.toUpperCase(), ' ' + id, id + ' ', id + '/extra'])(
    'raw ID %s is unsupported404',
    async (orderId) => {
      const f = fixture({ denied: true });
      expect(await f.dispatch(null, { pathname: path(orderId) })).toEqual(missing);
      expect(f.get).not.toHaveBeenCalled();
    },
  );
  it.each([
    path() + '/',
    path() + '/extra',
    path().replace('materials', 'Materials'),
    path().replace('production-orders', 'Production-orders'),
  ])('path %s is unsupported404', async (pathname) => {
    const f = fixture({ denied: true });
    expect(await f.dispatch(null, { pathname })).toEqual(missing);
    expect(f.get).not.toHaveBeenCalled();
  });
  it.each([null, undefined, '', ' ', 0, false, [], {}])(
    'type %j requires string before raw matched invalidUUID/method',
    async (value) => {
      const f = fixture();
      const method = vi.fn(() => f.transactMaterial);
      Object.defineProperty(f.production, 'transactMaterial', { get: method });
      expect(
        await f.dispatch({ ...valid(), transactionType: value }, { pathname: path('a') }),
      ).toEqual(invalid('transactionType is required'));
      expect(method).not.toHaveBeenCalled();
    },
  );
  it.each(['issue', 'return', 'BAD', 'ISSUE RETURN'])(
    'type enum %s precedes invalidUUID and method lookup',
    async (value) => {
      const f = fixture();
      const method = vi.fn(() => f.transactMaterial);
      Object.defineProperty(f.production, 'transactMaterial', { get: method });
      expect(
        await f.dispatch({ ...valid(), transactionType: value }, { pathname: path('a') }),
      ).toEqual(invalid('transactionType is unsupported'));
      expect(method).not.toHaveBeenCalled();
    },
  );
  it.each(['ISSUE', 'RETURN'] as const)(
    'type %s trims and reads getter only once for enum and input',
    async (type) => {
      const f = fixture();
      const getter = vi
        .fn()
        .mockReturnValueOnce(' ' + type + ' ')
        .mockReturnValue('BAD');
      const body = Object.defineProperty(valid(), 'transactionType', {
        enumerable: true,
        get: getter,
      });
      expect((await f.dispatch(body)).statusCode).toBe(201);
      expect(getter).toHaveBeenCalledOnce();
      expect(inputOf(f)?.transactionType).toBe(type);
    },
  );
  it.each(['a', '-', '00000000-0000-0000-0000-000000000000', id.replace('4aaa', '9aaa')])(
    'legal type then method lookup then UUID400 for raw %s',
    async (orderId) => {
      const f = fixture();
      const method = vi.fn(() => f.transactMaterial);
      const value = vi.fn(() => {
        throw new Error('UUID before item');
      });
      Object.defineProperty(f.production, 'transactMaterial', { get: method });
      const body = Object.defineProperty(valid(), 'itemVersionId', {
        enumerable: true,
        get: value,
      });
      expect(await f.dispatch(body, { pathname: path(orderId) })).toEqual(
        invalid('productionOrderId must be a UUID'),
      );
      expect(method).toHaveBeenCalledOnce();
      expect(value).not.toHaveBeenCalled();
    },
  );
  it('type getter replacing method happens before capture, so replacement receives four args', async () => {
    const f = fixture();
    const replacement = vi.fn<Production['transactMaterial']>().mockResolvedValue(row);
    const body = Object.defineProperty(valid(), 'transactionType', {
      enumerable: true,
      get: () => {
        f.production.transactMaterial = replacement;
        return 'RETURN';
      },
    });
    expect(await f.dispatch(body)).toEqual(response(201, row));
    expect(f.transactMaterial).not.toHaveBeenCalled();
    expect(replacement.mock.calls[0]?.[1].transactionType).toBe('RETURN');
    expect(replacement.mock.calls[0]).toHaveLength(4);
    expect(replacement.mock.contexts[0]).toBe(f.production);
  });
  it('later input getter replaces method after capture, so original function still runs', async () => {
    const f = fixture();
    const replacement = vi.fn<Production['transactMaterial']>().mockResolvedValue({ id: 'new' });
    const body = Object.defineProperty(valid(), 'itemVersionId', {
      enumerable: true,
      get: () => {
        f.production.transactMaterial = replacement;
        return id;
      },
    });
    expect(await f.dispatch(body)).toEqual(response(201, row));
    expect(f.transactMaterial).toHaveBeenCalledOnce();
    expect(f.transactMaterial.mock.contexts[0]).toBe(f.production);
    expect(replacement).not.toHaveBeenCalled();
  });
  it('getter sequence is type, method, item/lot/location/quantity/reason/time/key, actor then call', async () => {
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
    Object.defineProperty(f.production, 'transactMaterial', {
      get: () => {
        events.push('method');
        return f.transactMaterial;
      },
    });
    Object.defineProperty(f.context, 'actor', {
      get: () => {
        events.push('actor');
        return actor;
      },
    });
    f.transactMaterial.mockImplementationOnce(() => {
      events.push('call');
      return Promise.resolve(row);
    });
    expect((await f.dispatch(body)).statusCode).toBe(201);
    expect(events).toEqual(['transactionType', 'method', ...keys.slice(1), 'actor', 'call']);
  });
  const failures = [
    { key: 'transactionType', value: 'BAD', message: 'transactionType is unsupported' },
    { key: 'itemVersionId', value: 'bad', message: 'itemVersionId must be a UUID' },
    { key: 'lotId', value: 'bad', message: 'lotId must be a UUID' },
    { key: 'locationId', value: 'bad', message: 'locationId must be a UUID' },
    { key: 'quantity', value: 'bad', message: 'Invalid decimal' },
    { key: 'reason', value: null, message: 'reason is required' },
    { key: 'occurredAt', value: 'bad', message: 'occurredAt must be a valid timestamp' },
    { key: 'idempotencyKey', value: null, message: 'idempotencyKey is required' },
  ] as const;
  it.each(failures)('$key precedes all later parser failures/getters', async (entry) => {
    const f = fixture();
    const index = failures.indexOf(entry);
    const values: Record<string, unknown> = { ...valid() };
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
    expect(f.transactMaterial).not.toHaveBeenCalled();
  });
  for (const key of keys.slice(1)) {
    it.each([undefined, null, '', ' ', 0, false, [], {}])(
      'string ' + key + ' rejects %j',
      async (value) => {
        const f = fixture();
        expect(await f.dispatch({ ...valid(), [key]: value })).toEqual(
          invalid(key + ' is required'),
        );
      },
    );
  }
  for (const key of ['itemVersionId', 'lotId', 'locationId'] as const) {
    it.each(['bad', '00000000-0000-0000-0000-000000000000', id.replace('4aaa', '9aaa')])(
      'UUID ' + key + ' rejects %s',
      async (value) => {
        const f = fixture();
        expect(await f.dispatch({ ...valid(), [key]: value })).toEqual(
          invalid(key + ' must be a UUID'),
        );
      },
    );
    it('UUID ' + key + ' accepts trimmed uppercase and preserves case', async () => {
      const f = fixture();
      expect(
        (await f.dispatch({ ...valid(), [key]: ' ' + id.toUpperCase() + ' ' })).statusCode,
      ).toBe(201);
      expect(inputOf(f)?.[key]).toBe(id.toUpperCase());
    });
  }
  it.each([
    { value: ' 1.230000 ', expected: '1.23' },
    { value: '1.123456', expected: '1.123456' },
    { value: '0', expected: '0' },
    { value: '-0', expected: '0' },
    { value: '-0.000000', expected: '0' },
  ])(
    'quantity old normalization $value → $expected, not PG positive constraint proof',
    async ({ value, expected }) => {
      const f = fixture();
      expect((await f.dispatch({ ...valid(), quantity: value })).statusCode).toBe(201);
      expect(inputOf(f)?.quantity).toBe(expected);
    },
  );
  it.each(['001', '1.1234567', '1000000000000000000', '+1', '.5', '1e2', 'NaN', 'Infinity'])(
    'quantity %s invalid decimal',
    async (value) => {
      const f = fixture();
      expect(await f.dispatch({ ...valid(), quantity: value })).toEqual(invalid('Invalid decimal'));
    },
  );
  it.each(['-1', '-0.000001'])('quantity %s nonnegative failure', async (value) => {
    const f = fixture();
    expect(await f.dispatch({ ...valid(), quantity: value })).toEqual(
      invalid('quantity must be non-negative'),
    );
  });
  it.each([
    { value: '2026-10-14T10:20:30+08:00', expected: '2026-10-14T02:20:30.000Z' },
    { value: '2026-10-14', expected: '2026-10-14T00:00:00.000Z' },
    { value: '2026-02-30T00:00:00Z', expected: '2026-03-02T00:00:00.000Z' },
    { value: '2026-10-14T24:00:00Z', expected: '2026-10-15T00:00:00.000Z' },
  ])(
    'timestamp original Date/toISOString surface $value not real PG validity proof',
    async ({ value, expected }) => {
      const f = fixture();
      expect((await f.dispatch({ ...valid(), occurredAt: ' ' + value + ' ' })).statusCode).toBe(
        201,
      );
      expect(inputOf(f)?.occurredAt).toBe(expected);
    },
  );
  it.each(['bad', '2026-13-01', '2026-01-32T00:00:00Z'])(
    'timestamp %s rejects original invalid Date',
    async (value) => {
      const f = fixture();
      expect(await f.dispatch({ ...valid(), occurredAt: value })).toEqual(
        invalid('occurredAt must be a valid timestamp'),
      );
    },
  );
  it.each(['a', '1ABC', 'A B', 'A/B', 'A'.repeat(65)])(
    'body stable key %s invalid',
    async (value) => {
      const f = fixture();
      expect(await f.dispatch({ ...valid(), idempotencyKey: value })).toEqual(
        invalid('Code must be 1-64 uppercase letters, digits, underscore, or hyphen'),
      );
    },
  );
  it.each(['A', 'A_1-B', 'A'.repeat(64)])(
    'body stable key %s trims without header source',
    async (value) => {
      const f = fixture();
      expect((await f.dispatch({ ...valid(), idempotencyKey: ' ' + value + ' ' })).statusCode).toBe(
        201,
      );
      expect(inputOf(f)?.idempotencyKey).toBe(value);
    },
  );
  it.each([undefined, '', 'different', 'x'.repeat(201)])(
    'header %s/query ignored, no idempotency replacement',
    async (key) => {
      const f = fixture();
      const getter = vi.fn(() => {
        throw new Error('ignored query');
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
    },
  );
  it('missing bodykey never falls back to valid header', async () => {
    const f = fixture();
    expect(
      await f.dispatch(
        { ...valid(), idempotencyKey: undefined },
        { headers: { 'idempotency-key': 'HEADER' } },
      ),
    ).toEqual(invalid('idempotencyKey is required'));
  });
  it('collection/create/command/report neighbours remain independent, material mock not called', async () => {
    const f = fixture();
    expect(
      await f.dispatch(null, { method: 'GET', pathname: '/api/v1/production-orders' }),
    ).toEqual(denied);
    for (const pathname of [
      '/api/v1/production-orders',
      '/api/v1/production-orders/' + id + '/release',
      '/api/v1/production-orders/' + id + '/operation-reports',
    ])
      expect(await f.dispatch(null, { pathname })).toEqual(
        invalid('A JSON object body is required'),
      );
    expect(f.transactMaterial).not.toHaveBeenCalled();
  });
  it('no independent read permission still permits material write and id/version fallback', async () => {
    const f = fixture({ noRead: true });
    expect(await f.dispatch()).toEqual(response(201, { id, version: 7 }));
    expect(f.transactMaterial).toHaveBeenCalledOnce();
  });
  it.each([
    { fields: null, expected: row },
    { fields: [], expected: { id } },
    { fields: ['name'], expected: { id, name: 'material' } },
    { fields: ['version', 'nested'], expected: { id, version: 7, nested } },
    { fields: ['id', 'version', 'name', 'secret', 'nested'], expected: row },
  ])(
    'read fields $fields are independent from legal write fields',
    async ({ fields, expected }) => {
      const f = fixture({ fields: keys, readFields: fields });
      const result = await f.dispatch();
      expect(result).toEqual(response(201, expected));
      if (fields === null) expect(result.body).toBe(row);
      else expect(result.body).not.toBe(row);
      if (typeof result.body === 'object' && result.body !== null && 'nested' in result.body)
        expect(result.body.nested).toBe(nested);
    },
  );
  it('late read grant change/delete is used only after awaited write', async () => {
    const f = fixture({ readFields: [] });
    const getter = vi.fn(() => ['name']);
    f.transactMaterial.mockImplementationOnce(() => {
      expect(f.get.mock.calls.some(([cap]) => cap === 'production:read')).toBe(false);
      f.permissions.set('production:read', {
        scopes: [],
        get fields() {
          return getter();
        },
      });
      return Promise.resolve(row);
    });
    expect(await f.dispatch()).toEqual(response(201, { id, name: 'material' }));
    expect(getter).toHaveBeenCalledOnce();
    const removed = fixture();
    removed.transactMaterial.mockImplementationOnce(() => {
      removed.permissions.delete('production:read');
      return Promise.resolve(row);
    });
    expect(await removed.dispatch()).toEqual(response(201, { id, version: 7 }));
  });
  it('same/changed request is always forwarded, not HTTP dedup/real PG replay proof', async () => {
    const f = fixture();
    expect((await f.dispatch()).statusCode).toBe(201);
    expect((await f.dispatch()).statusCode).toBe(201);
    expect((await f.dispatch({ ...valid('RETURN'), quantity: '2' })).statusCode).toBe(201);
    expect(f.transactMaterial.mock.calls).toHaveLength(3);
    expect(inputOf(f)?.idempotencyKey).toBe(inputOf(f, 2)?.idempotencyKey);
    expect(inputOf(f, 2)?.transactionType).toBe('RETURN');
  });
  it.each(['SELF', 'TEAM', 'DEPARTMENT', 'REGION', 'COMPANY', 'GROUP'] as const)(
    'HTTP mock scope %s only proves original references forwarded',
    async (scope) => {
      const f = fixture({ scopes: [scope] });
      expect((await f.dispatch()).statusCode).toBe(201);
      expect(f.transactMaterial.mock.calls[0]?.[2].scopes).toBe(f.scopes);
      expect(f.transactMaterial.mock.calls[0]?.[2].anchors).toBe(f.anchors);
    },
  );
  it('null projection avoids enumeration, finite projection eagerly reads excluded row getter', async () => {
    const getter = vi.fn(() => 'secret');
    const result: JsonObject = {
      id,
      version: 7,
      get secret() {
        return getter();
      },
    };
    const raw = fixture();
    raw.transactMaterial.mockResolvedValueOnce(result);
    const rawResponse = await raw.dispatch();
    expect(rawResponse.body).toBe(result);
    expect(getter).not.toHaveBeenCalled();
    const finite = fixture({ readFields: [] });
    finite.transactMaterial.mockResolvedValueOnce(result);
    expect(await finite.dispatch()).toEqual(response(201, { id }));
    expect(getter).toHaveBeenCalledOnce();
  });
  it('special own keys/key order/nested reference and absentid are not normalized', async () => {
    const result: JsonObject = Object.fromEntries<JsonObject[string]>([
      ['toString', 'data'],
      ['__proto__', nested],
      ['constructor', 'data'],
      ['version', 7],
    ]);
    const f = fixture({ readFields: ['version', '__proto__', 'constructor', 'toString'] });
    f.transactMaterial.mockResolvedValueOnce(result);
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
    'repository DomainError $code retains correlation/no early read',
    async ({ code, status }) => {
      const f = fixture();
      f.transactMaterial.mockRejectedValueOnce(new DomainError(code, 'original repository error'));
      expect(await f.dispatch()).toEqual(error(status, code, 'original repository error'));
      expect(f.get.mock.calls.some(([cap]) => cap === 'production:read')).toBe(false);
    },
  );
});
