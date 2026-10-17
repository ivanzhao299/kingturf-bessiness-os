// Fixed against a18a121 inline cost calculation; no future calculation module imported.
import { describe, expect, it, vi } from 'vitest';
import { DomainError, type AuthorizationContext } from '@kingturf/domain';
import type { DataScope, JsonObject, PermissionKey } from '@kingturf/types';
import { buildApp, type ApiDependencies, type ApiRequest } from '../src/app.js';
type Costs = NonNullable<ApiDependencies['productionCosts']>;
type Grant = NonNullable<ReturnType<AuthorizationContext['permissions']['get']>>;
const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const other = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const correlationId = '33333333-3333-4333-8333-333333333333';
const actor = { companyId: 'calculation-mock-tenant', employeeId: id };
const nested = { retained: true };
const row: JsonObject = { id, version: 7, name: 'calculation', secret: 'private', nested };
const path = '/api/v1/production-cost-runs';
const keys = ['productionOrderId', 'policyId', 'runNumber', 'idempotencyKey'];
const uuids = ['productionOrderId', 'policyId'] as const;
const codes = ['runNumber', 'idempotencyKey'] as const;
const valid = () => ({
  productionOrderId: id,
  policyId: other,
  runNumber: ' RUN-1 ',
  idempotencyKey: ' BODY-KEY ',
});
const parsed = () => ({ ...valid(), runNumber: 'RUN-1', idempotencyKey: 'BODY-KEY' });
const repoResult = (value: JsonObject) =>
  value as unknown as Awaited<ReturnType<Costs['calculate']>>;
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
    ['manufacturing-cost:calculate', 'manufacturing-cost:policy', 'manufacturing-cost:approve'].map(
      (cap) => [
        cap as PermissionKey,
        { scopes, fields: options.fields === undefined ? null : options.fields },
      ],
    ),
  );
  if (options.denied) permissions.delete('manufacturing-cost:calculate');
  if (!options.noRead)
    permissions.set('manufacturing-cost:read', {
      scopes: [],
      fields: options.readFields === undefined ? null : options.readFields,
    });
  const context: AuthorizationContext = {
    actor,
    permissions,
    scopeAnchors: new Map([['manufacturing-cost:calculate', anchors]]),
  };
  const get = vi.spyOn(permissions, 'get');
  const calculate = vi.fn<Costs['calculate']>().mockResolvedValue(repoResult(row));
  const productionCosts = { calculate };
  const authenticate = vi.fn().mockResolvedValue(context);
  const app = buildApp({
    auth: { authenticate } as unknown as ApiDependencies['auth'],
    organizations: {} as ApiDependencies['organizations'],
    employees: {} as ApiDependencies['employees'],
    ...(options.available === false
      ? {}
      : { productionCosts: productionCosts as unknown as Costs }),
  });
  const dispatch = (body: unknown = valid(), request: Partial<ApiRequest> = {}) =>
    app.dispatch({
      method: 'POST',
      pathname: path,
      body,
      ...request,
      headers: {
        authorization: 'Bearer fixture',
        'x-correlation-id': correlationId,
        ...request.headers,
      },
    });
  return {
    calculate,
    productionCosts,
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
const inputOf = (f: ReturnType<typeof fixture>, index = 0) => f.calculate.mock.calls[index]?.[0];

describe('old production cost calculation contract', () => {
  it('three args/receiver/four ordered keys/fresh input-scope/original references', async () => {
    const f = fixture();
    const first = await f.dispatch();
    expect(first).toEqual(response(201, row));
    expect(first.body).toBe(row);
    expect((await f.dispatch()).statusCode).toBe(201);
    expect(f.calculate.mock.calls[0]).toEqual([
      parsed(),
      { actor, scopes: f.scopes, anchors: f.anchors },
      correlationId,
    ]);
    expect(f.calculate.mock.calls[0]).toHaveLength(3);
    expect(f.calculate.mock.contexts[0]).toBe(f.productionCosts);
    expect(Object.keys(inputOf(f) ?? {})).toEqual(keys);
    expect(inputOf(f)).not.toBe(inputOf(f, 1));
    const scope = f.calculate.mock.calls[0]?.[1];
    expect(Object.keys(scope ?? {})).toEqual(['actor', 'scopes', 'anchors']);
    expect(scope?.actor).toBe(actor);
    expect(scope?.scopes).toBe(f.scopes);
    expect(scope?.anchors).toBe(f.anchors);
    expect(scope).not.toBe(f.calculate.mock.calls[1]?.[1]);
    expect(
      f.get.mock.calls
        .filter(([cap]) => cap !== 'manufacturing-cost:read')
        .every(([cap]) => cap === 'manufacturing-cost:calculate'),
    ).toBe(true);
  });
  it.each([null, undefined, [], '', 0, false])('root %j before cap', async (body) => {
    const f = fixture({ denied: true });
    expect(await f.dispatch(null, { body })).toEqual(invalid('A JSON object body is required'));
    expect(f.get).not.toHaveBeenCalled();
  });
  it('unknown sorted before cap/method/values', async () => {
    const f = fixture({ denied: true });
    const getter = vi.fn(() => {
      throw new Error('not read');
    });
    Object.defineProperty(f.productionCosts, 'calculate', { get: getter });
    const body = Object.defineProperty(
      { ...valid(), version: 1, state: 'OPEN', z: null, a: undefined },
      'productionOrderId',
      { enumerable: true, get: getter },
    );
    expect(await f.dispatch(body)).toEqual(invalid('Unsupported fields: a, state, version, z'));
    expect(getter).not.toHaveBeenCalled();
    expect(f.get).not.toHaveBeenCalled();
  });
  it.each([{ denied: true }, { scopes: [] }, { fields: [] }, { fields: ['productionOrderId'] }])(
    'auth %j before method/values',
    async (options) => {
      const f = fixture(options);
      const getter = vi.fn(() => {
        throw new Error('not read');
      });
      Object.defineProperty(f.productionCosts, 'calculate', { get: getter });
      const body = Object.defineProperty(valid(), 'productionOrderId', {
        enumerable: true,
        get: getter,
      });
      expect(await f.dispatch(body)).toEqual(
        options.denied || options.scopes ? denied : fieldDenied,
      );
      expect(getter).not.toHaveBeenCalled();
    },
  );
  it.each([{ fields: null }, { fields: keys }])('legal fields %j', async (options) => {
    expect((await fixture(options).dispatch()).statusCode).toBe(201);
  });
  it('ownundefined body key still requested before parser', async () => {
    expect(
      await fixture({ fields: keys.filter((key) => key !== 'idempotencyKey') }).dispatch({
        ...valid(),
        idempotencyKey: undefined,
      }),
    ).toEqual(fieldDenied);
  });
  it('inherited and nonenumerable values parser-readable without requested own fields', async () => {
    const f = fixture({ fields: [] });
    expect((await f.dispatch(Object.create(valid()) as Record<string, unknown>)).statusCode).toBe(
      201,
    );
    const next = fixture({ fields: [] });
    const body: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(valid()))
      Object.defineProperty(body, key, { value, enumerable: false });
    expect((await next.dispatch(body)).statusCode).toBe(201);
    expect(inputOf(next)).toEqual(inputOf(f));
  });
  it.each([null, undefined, [], { productionOrderId: 'bad' }])(
    'missing repo skips %j',
    async (body) => {
      const f = fixture({ available: false, denied: true });
      expect(await f.dispatch(null, { body })).toEqual(missing);
      expect(f.get).not.toHaveBeenCalled();
    },
  );
  it('missing repo ignores values/global401 first', async () => {
    const f = fixture({ available: false, denied: true });
    const getter = vi.fn(() => {
      throw new Error('body');
    });
    const body = Object.defineProperty({}, 'productionOrderId', { enumerable: true, get: getter });
    expect(await f.dispatch(body)).toEqual(missing);
    f.authenticate.mockResolvedValueOnce(null);
    expect(await f.dispatch(body)).toEqual(
      error(401, 'authentication_required', 'A valid session is required'),
    );
    expect(getter).not.toHaveBeenCalled();
  });
  it.each(['PATCH', 'PUT', 'DELETE', 'post'])('method %s unsupported', async (method) => {
    const f = fixture({ denied: true });
    expect(await f.dispatch(null, { method })).toEqual(missing);
    expect(f.get).not.toHaveBeenCalled();
  });
  it('samepath GET is distinct read route, not unsupported or calculate capability', async () => {
    const f = fixture({ denied: true });
    expect(await f.dispatch(null, { method: 'GET' })).toEqual(denied);
    expect(f.get.mock.calls.every(([cap]) => cap === 'manufacturing-cost:read')).toBe(true);
    expect(f.calculate).not.toHaveBeenCalled();
  });
  it.each([path + '/', path + '/a', path + '/extra', path.replace('runs', 'Runs')])(
    'path %s unsupported',
    async (pathname) => {
      const f = fixture({ denied: true });
      expect(await f.dispatch(null, { pathname })).toEqual(missing);
      expect(f.get).not.toHaveBeenCalled();
    },
  );
  it('method lookup precedes first input UUID failure', async () => {
    const f = fixture();
    const method = vi.fn(() => f.calculate);
    Object.defineProperty(f.productionCosts, 'calculate', { get: method });
    expect(await f.dispatch({ ...valid(), productionOrderId: 'bad' })).toEqual(
      invalid('productionOrderId must be a UUID'),
    );
    expect(method).toHaveBeenCalledOnce();
  });
  it('input getter method replacement still invokes original captured function', async () => {
    const f = fixture();
    const replacement = vi.fn<Costs['calculate']>().mockResolvedValue(repoResult({ id: 'new' }));
    const body = Object.defineProperty(valid(), 'productionOrderId', {
      enumerable: true,
      get: () => {
        f.productionCosts.calculate = replacement;
        return id;
      },
    });
    expect(await f.dispatch(body)).toEqual(response(201, row));
    expect(f.calculate).toHaveBeenCalledOnce();
    expect(f.calculate.mock.contexts[0]).toBe(f.productionCosts);
    expect(replacement).not.toHaveBeenCalled();
  });
  it('method then all four getters once then actor then call', async () => {
    const f = fixture();
    const events: string[] = [];
    const body: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(valid()))
      Object.defineProperty(body, key, {
        enumerable: true,
        get: () => {
          events.push(key);
          return value;
        },
      });
    Object.defineProperty(f.productionCosts, 'calculate', {
      get: () => {
        events.push('method');
        return f.calculate;
      },
    });
    Object.defineProperty(f.context, 'actor', {
      get: () => {
        events.push('actor');
        return actor;
      },
    });
    f.calculate.mockImplementationOnce(() => {
      events.push('call');
      return Promise.resolve(repoResult(row));
    });
    expect((await f.dispatch(body)).statusCode).toBe(201);
    expect(events).toEqual(['method', ...keys, 'actor', 'call']);
  });
  const failures = [
    { key: 'productionOrderId', value: 'bad', message: 'productionOrderId must be a UUID' },
    { key: 'policyId', value: 'bad', message: 'policyId must be a UUID' },
    {
      key: 'runNumber',
      value: 'bad',
      message: 'Code must be 1-64 uppercase letters, digits, underscore, or hyphen',
    },
    {
      key: 'idempotencyKey',
      value: 'bad',
      message: 'Code must be 1-64 uppercase letters, digits, underscore, or hyphen',
    },
  ];
  it.each(failures)('$key precedes later failures/getters', async (entry) => {
    const f = fixture();
    const index = failures.indexOf(entry);
    const values: Record<string, unknown> = valid();
    const body: Record<string, unknown> = {};
    const seen: string[] = [];
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
    expect(f.calculate).not.toHaveBeenCalled();
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
    it.each([
      'bad',
      '00000000-0000-0000-0000-000000000000',
      id.replace('4aaa', '9aaa'),
      id.replace('8aaa', '7aaa'),
    ])('UUID ' + key + ' %s invalid', async (value) => {
      expect(await fixture().dispatch({ ...valid(), [key]: value })).toEqual(
        invalid(key + ' must be a UUID'),
      );
    });
    it('UUID ' + key + ' trim uppercase retained', async () => {
      const f = fixture();
      expect(
        (await f.dispatch({ ...valid(), [key]: ' ' + other.toUpperCase() + ' ' })).statusCode,
      ).toBe(201);
      expect(inputOf(f)?.[key]).toBe(other.toUpperCase());
    });
  }
  for (const key of codes) {
    it.each(['a', '1ABC', 'A B', 'A/B', 'A'.repeat(65), 'A'.repeat(128), 'A'.repeat(200)])(
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
  it.each([undefined, '', 'DIFFERENT', 'x'.repeat(201)])(
    'header %s/query ignored; body key only',
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
      expect(inputOf(f)?.idempotencyKey).toBe('BODY-KEY');
      expect(getter).not.toHaveBeenCalled();
    },
  );
  it('no valid header fallback for missing body key', async () => {
    expect(
      await fixture().dispatch(
        { ...valid(), idempotencyKey: undefined },
        { headers: { 'idempotency-key': 'HEADER' } },
      ),
    ).toEqual(invalid('idempotencyKey is required'));
  });
  it('same key/same and changed body each forwarded, not PG replay proof', async () => {
    const f = fixture();
    expect((await f.dispatch()).statusCode).toBe(201);
    expect((await f.dispatch()).statusCode).toBe(201);
    expect((await f.dispatch({ ...valid(), policyId: id })).statusCode).toBe(201);
    expect(f.calculate.mock.calls).toHaveLength(3);
    expect(inputOf(f, 2)?.idempotencyKey).toBe(inputOf(f)?.idempotencyKey);
    expect(inputOf(f, 2)?.policyId).toBe(id);
  });
  it.each(['SELF', 'TEAM', 'DEPARTMENT', 'REGION', 'COMPANY', 'GROUP'] as const)(
    'scope %s only original refs forward',
    async (scope) => {
      const f = fixture({ scopes: [scope] });
      expect((await f.dispatch()).statusCode).toBe(201);
      expect(f.calculate.mock.calls[0]?.[1].scopes).toBe(f.scopes);
      expect(f.calculate.mock.calls[0]?.[1].anchors).toBe(f.anchors);
    },
  );
  it('no costread write permitted/id-version fallback', async () => {
    expect(await fixture({ noRead: true }).dispatch()).toEqual(response(201, { id, version: 7 }));
  });
  it('real-repo-shaped versionless result does not fabricate version on fallback', async () => {
    const f = fixture({ noRead: true });
    f.calculate.mockResolvedValueOnce(
      repoResult({ id, state: 'CALCULATED', plannedTotal: '88.500000', actualTotal: '237.500000' }),
    );
    expect(await f.dispatch()).toEqual(response(201, { id }));
  });
  it.each([
    { fields: null, expected: row },
    { fields: [], expected: { id } },
    { fields: ['name'], expected: { id, name: 'calculation' } },
    { fields: ['version', 'nested'], expected: { id, version: 7, nested } },
  ])('read $fields independent', async ({ fields, expected }) => {
    const f = fixture({ fields: keys, readFields: fields });
    const result = await f.dispatch();
    expect(result).toEqual(response(201, expected));
    if (fields === null) expect(result.body).toBe(row);
    else expect(result.body).not.toBe(row);
    if (typeof result.body === 'object' && result.body !== null && 'nested' in result.body)
      expect(result.body.nested).toBe(nested);
  });
  it('awaitMap read grant change/delete/fields getter once', async () => {
    const f = fixture({ readFields: [] });
    const getter = vi.fn(() => ['name']);
    f.calculate.mockImplementationOnce(() => {
      expect(f.get.mock.calls.some(([cap]) => cap === 'manufacturing-cost:read')).toBe(false);
      f.permissions.set('manufacturing-cost:read', {
        scopes: [],
        get fields() {
          return getter();
        },
      });
      return Promise.resolve(repoResult(row));
    });
    expect(await f.dispatch()).toEqual(response(201, { id, name: 'calculation' }));
    expect(getter).toHaveBeenCalledOnce();
    const removed = fixture();
    removed.calculate.mockImplementationOnce(() => {
      removed.permissions.delete('manufacturing-cost:read');
      return Promise.resolve(repoResult(row));
    });
    expect(await removed.dispatch()).toEqual(response(201, { id, version: 7 }));
  });
  it('null projection no enumeration; finite eager excluded getter', async () => {
    const getter = vi.fn(() => 'secret');
    const result: JsonObject = {
      id,
      version: 7,
      get secret() {
        return getter();
      },
    };
    const raw = fixture();
    raw.calculate.mockResolvedValueOnce(repoResult(result));
    expect((await raw.dispatch()).body).toBe(result);
    expect(getter).not.toHaveBeenCalled();
    const finite = fixture({ readFields: [] });
    finite.calculate.mockResolvedValueOnce(repoResult(result));
    expect(await finite.dispatch()).toEqual(response(201, { id }));
    expect(getter).toHaveBeenCalledOnce();
  });
  it('special own keys/order/nestedref/no fabricatedid', async () => {
    const result: JsonObject = Object.fromEntries<JsonObject[string]>([
      ['toString', 'data'],
      ['__proto__', nested],
      ['constructor', 'data'],
      ['version', 7],
    ]);
    const f = fixture({ readFields: ['version', '__proto__', 'constructor', 'toString'] });
    f.calculate.mockResolvedValueOnce(repoResult(result));
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
    f.calculate.mockRejectedValueOnce(new DomainError(code, 'original repository error'));
    expect(await f.dispatch()).toEqual(error(status, code, 'original repository error'));
    expect(f.get.mock.calls.some(([cap]) => cap === 'manufacturing-cost:read')).toBe(false);
  });
  it('policy/approve/reject neighbours independent', async () => {
    const f = fixture();
    for (const pathname of [
      '/api/v1/production-cost-policies',
      path + '/' + id + '/approve',
      path + '/' + id + '/reject',
    ])
      expect(await f.dispatch(null, { pathname })).toEqual(
        invalid('A JSON object body is required'),
      );
    expect(f.calculate).not.toHaveBeenCalled();
  });
});
