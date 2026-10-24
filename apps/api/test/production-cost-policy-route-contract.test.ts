// Fixed against 671635f inline cost policies; no future cost-policy module imported.
import { describe, expect, it, vi } from 'vitest';
import { DomainError, type AuthorizationContext } from '@kingturf/domain';
import type { DataScope, JsonObject, PermissionKey } from '@kingturf/types';
import { buildApp, type ApiDependencies, type ApiRequest } from '../src/app.js';
type Costs = NonNullable<ApiDependencies['productionCosts']>;
type Grant = NonNullable<ReturnType<AuthorizationContext['permissions']['get']>>;
const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const other = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const correlationId = '33333333-3333-4333-8333-333333333333';
const actor = { companyId: 'policy-mock-tenant', employeeId: id };
const nested = { retained: true };
const row: JsonObject = { id, version: 7, name: 'policy', secret: 'private', nested };
const path = '/api/v1/production-cost-policies';
const keys = [
  'version',
  'currency',
  'laborRatePerHour',
  'machineRatePerHour',
  'overheadRatePerMachineHour',
  'effectiveFrom',
  'effectiveTo',
  'sourceReference',
  'materialRates',
];
const rateKeys = ['itemVersionId', 'unitCost', 'sourceReference'];
const decimals = ['laborRatePerHour', 'machineRatePerHour', 'overheadRatePerMachineHour'] as const;
const rate = () => ({ itemVersionId: other, unitCost: ' 5.000000 ', sourceReference: ' RM-1 ' });
const valid = () => ({
  version: 1,
  currency: ' CNY ',
  laborRatePerHour: '60',
  machineRatePerHour: '120',
  overheadRatePerMachineHour: '30',
  effectiveFrom: ' 2026-10-14 ',
  sourceReference: ' POLICY-1 ',
  materialRates: [rate()],
});
const parsed = () => ({
  ...valid(),
  currency: 'CNY',
  effectiveFrom: '2026-10-14',
  sourceReference: 'POLICY-1',
  materialRates: [{ ...rate(), unitCost: '5', sourceReference: 'RM-1' }],
});
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
    ['manufacturing-cost:policy', 'manufacturing-cost:calculate', 'manufacturing-cost:approve'].map(
      (cap) => [
        cap as PermissionKey,
        { scopes, fields: options.fields === undefined ? null : options.fields },
      ],
    ),
  );
  if (options.denied) permissions.delete('manufacturing-cost:policy');
  if (!options.noRead)
    permissions.set('manufacturing-cost:read', {
      scopes: [],
      fields: options.readFields === undefined ? null : options.readFields,
    });
  const context: AuthorizationContext = {
    actor,
    permissions,
    scopeAnchors: new Map([['manufacturing-cost:policy', anchors]]),
  };
  const get = vi.spyOn(permissions, 'get');
  const createPolicy = vi
    .fn<Costs['createPolicy']>()
    .mockResolvedValue(row as unknown as Awaited<ReturnType<Costs['createPolicy']>>);
  const productionCosts = { createPolicy };
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
    createPolicy,
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
const inputOf = (f: ReturnType<typeof fixture>, index = 0) => f.createPolicy.mock.calls[index]?.[0];
const repoResult = (value: JsonObject) =>
  value as unknown as Awaited<ReturnType<Costs['createPolicy']>>;

describe('old production cost policy contract', () => {
  it('three args/receiver/new input-map-rows/context and original refs/key order', async () => {
    const f = fixture();
    const body = valid();
    const first = await f.dispatch(body);
    expect(first).toEqual(response(201, row));
    expect(first.body).toBe(row);
    expect((await f.dispatch(body)).statusCode).toBe(201);
    expect(f.createPolicy.mock.calls[0]).toEqual([
      parsed(),
      { actor, scopes: f.scopes, anchors: f.anchors },
      correlationId,
    ]);
    expect(f.createPolicy.mock.calls[0]).toHaveLength(3);
    expect(f.createPolicy.mock.contexts[0]).toBe(f.productionCosts);
    expect(Object.keys(inputOf(f) ?? {})).toEqual(keys.filter((key) => key !== 'effectiveTo'));
    expect(Object.keys(inputOf(f)?.materialRates[0] ?? {})).toEqual(rateKeys);
    expect(inputOf(f)?.materialRates).not.toBe(body.materialRates);
    expect(inputOf(f)?.materialRates[0]).not.toBe(body.materialRates[0]);
    expect(inputOf(f)).not.toBe(inputOf(f, 1));
    expect(inputOf(f)?.materialRates).not.toBe(inputOf(f, 1)?.materialRates);
    const scope = f.createPolicy.mock.calls[0]?.[1];
    expect(Object.keys(scope ?? {})).toEqual(['actor', 'scopes', 'anchors']);
    expect(scope?.actor).toBe(actor);
    expect(scope?.scopes).toBe(f.scopes);
    expect(scope?.anchors).toBe(f.anchors);
    expect(scope).not.toBe(f.createPolicy.mock.calls[1]?.[1]);
    expect(
      f.get.mock.calls
        .filter(([cap]) => cap !== 'manufacturing-cost:read')
        .every(([cap]) => cap === 'manufacturing-cost:policy'),
    ).toBe(true);
  });
  it.each([null, undefined, [], '', 0, false])('root %j before cap', async (body) => {
    const f = fixture({ denied: true });
    expect(await f.dispatch(null, { body })).toEqual(invalid('A JSON object body is required'));
    expect(f.get).not.toHaveBeenCalled();
  });
  it('unknown top sorted before cap/array/method', async () => {
    const f = fixture({ denied: true });
    const getter = vi.fn(() => {
      throw new Error('not read');
    });
    Object.defineProperty(f.productionCosts, 'createPolicy', { get: getter });
    const body = Object.defineProperty(
      { ...valid(), state: 'OPEN', idempotencyKey: 'KEY', z: null, a: undefined },
      'materialRates',
      { enumerable: true, get: getter },
    );
    expect(await f.dispatch(body)).toEqual(
      invalid('Unsupported fields: a, idempotencyKey, state, z'),
    );
    expect(getter).not.toHaveBeenCalled();
    expect(f.get).not.toHaveBeenCalled();
  });
  it.each([{ denied: true }, { scopes: [] }, { fields: [] }, { fields: ['version'] }])(
    'cap %j before array/method/version',
    async (options) => {
      const f = fixture(options);
      const getter = vi.fn(() => {
        throw new Error('not read');
      });
      Object.defineProperty(f.productionCosts, 'createPolicy', { get: getter });
      const body = Object.defineProperty(valid(), 'materialRates', {
        enumerable: true,
        get: getter,
      });
      expect(await f.dispatch(body)).toEqual(
        options.denied || options.scopes ? denied : fieldDenied,
      );
      expect(getter).not.toHaveBeenCalled();
    },
  );
  it('only top materialRates field requested, no nested capability fields', async () => {
    const f = fixture({ fields: keys.filter((key) => key !== 'effectiveTo') });
    expect((await f.dispatch()).statusCode).toBe(201);
    expect(await f.dispatch({ ...valid(), effectiveTo: undefined })).toEqual(fieldDenied);
  });
  it('inherited and nonenumerable top/row values parser-readable without requested fields', async () => {
    const f = fixture({ fields: [] });
    const body = Object.create(valid()) as Record<string, unknown>;
    body.materialRates = [Object.create(rate()) as Record<string, unknown>];
    Object.defineProperty(body, 'materialRates', { enumerable: false });
    expect((await f.dispatch(body)).statusCode).toBe(201);
    const next = fixture({ fields: [] });
    const own: Record<string, unknown> = {};
    const x: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(rate()))
      Object.defineProperty(x, key, { value, enumerable: false });
    for (const [key, value] of Object.entries(valid()))
      Object.defineProperty(own, key, {
        value: key === 'materialRates' ? [x] : value,
        enumerable: false,
      });
    expect((await next.dispatch(own)).statusCode).toBe(201);
    expect(inputOf(next)).toEqual(inputOf(f));
  });
  it.each([null, undefined, [], { materialRates: [] }])('missing repo skips %j', async (body) => {
    const f = fixture({ available: false, denied: true });
    expect(await f.dispatch(null, { body })).toEqual(missing);
    expect(f.get).not.toHaveBeenCalled();
  });
  it('missing repo no body values/global401 first', async () => {
    const f = fixture({ available: false, denied: true });
    const getter = vi.fn(() => {
      throw new Error('body');
    });
    const body = Object.defineProperty({}, 'materialRates', { enumerable: true, get: getter });
    expect(await f.dispatch(body)).toEqual(missing);
    f.authenticate.mockResolvedValueOnce(null);
    expect(await f.dispatch(body)).toEqual(
      error(401, 'authentication_required', 'A valid session is required'),
    );
    expect(getter).not.toHaveBeenCalled();
  });
  it.each(['GET', 'PATCH', 'PUT', 'DELETE', 'post'])('unsupported method %s', async (method) => {
    const f = fixture({ available: false, denied: true });
    expect(await f.dispatch(null, { method })).toEqual(missing);
    expect(f.get).not.toHaveBeenCalled();
  });
  it.each([path + '/', path + '/a', path + '/extra', path.replace('policies', 'Policies')])(
    'unsupported path %s',
    async (pathname) => {
      const f = fixture({ denied: true });
      expect(await f.dispatch(null, { pathname })).toEqual(missing);
      expect(f.get).not.toHaveBeenCalled();
    },
  );
  it.each([null, undefined, '', 'x', 0, false, {}, []])(
    'array %j first before method/top version',
    async (materialRates) => {
      const f = fixture();
      const method = vi.fn(() => f.createPolicy);
      Object.defineProperty(f.productionCosts, 'createPolicy', { get: method });
      expect(await f.dispatch({ ...valid(), version: 'bad', materialRates })).toEqual(
        invalid('materialRates must be a non-empty array'),
      );
      expect(method).not.toHaveBeenCalled();
    },
  );
  it.each([null, undefined, [], '', 0, false])(
    'row root %j before method/version',
    async (value) => {
      const f = fixture();
      const method = vi.fn(() => f.createPolicy);
      Object.defineProperty(f.productionCosts, 'createPolicy', { get: method });
      expect(await f.dispatch({ ...valid(), version: 'bad', materialRates: [value] })).toEqual(
        invalid('A JSON object body is required'),
      );
      expect(method).not.toHaveBeenCalled();
    },
  );
  it('nested unknown sorted before row values/top input/method', async () => {
    const f = fixture();
    const getter = vi.fn(() => {
      throw new Error('values');
    });
    Object.defineProperty(f.productionCosts, 'createPolicy', { get: getter });
    const x = Object.defineProperty({ ...rate(), z: 1, a: null }, 'itemVersionId', {
      enumerable: true,
      get: getter,
    });
    expect(await f.dispatch({ ...valid(), version: 'bad', materialRates: [x] })).toEqual(
      invalid('Unsupported fields: a, z'),
    );
    expect(getter).not.toHaveBeenCalled();
  });
  it('all rows precede method/top inputs and method precedes version failure', async () => {
    const f = fixture();
    const events: string[] = [];
    const x: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(rate()))
      Object.defineProperty(x, key, {
        enumerable: true,
        get: () => {
          events.push(key);
          return value;
        },
      });
    const method = vi.fn(() => {
      events.push('method');
      return f.createPolicy;
    });
    Object.defineProperty(f.productionCosts, 'createPolicy', { get: method });
    expect(await f.dispatch({ ...valid(), version: 'bad', materialRates: [x, x] })).toEqual(
      invalid('version must be an integer between 1 and 1000000'),
    );
    expect(events).toEqual([...rateKeys, ...rateKeys, 'method']);
    expect(method).toHaveBeenCalledOnce();
  });
  it('row getter method replacement occurs before capture and calls replacement', async () => {
    const f = fixture();
    const replacement = vi.fn<Costs['createPolicy']>().mockResolvedValue(repoResult(row));
    const x = Object.defineProperty(rate(), 'itemVersionId', {
      enumerable: true,
      get: () => {
        f.productionCosts.createPolicy = replacement;
        return other;
      },
    });
    expect(await f.dispatch({ ...valid(), materialRates: [x] })).toEqual(response(201, row));
    expect(f.createPolicy).not.toHaveBeenCalled();
    expect(replacement.mock.calls[0]).toHaveLength(3);
    expect(replacement.mock.contexts[0]).toBe(f.productionCosts);
  });
  it('top getter method replacement occurs after capture and calls old function', async () => {
    const f = fixture();
    const replacement = vi.fn<Costs['createPolicy']>().mockResolvedValue(repoResult(row));
    const body = Object.defineProperty(valid(), 'version', {
      enumerable: true,
      get: () => {
        f.productionCosts.createPolicy = replacement;
        return 1;
      },
    });
    expect(await f.dispatch(body)).toEqual(response(201, row));
    expect(f.createPolicy).toHaveBeenCalledOnce();
    expect(replacement).not.toHaveBeenCalled();
  });
  it.each([
    { value: null, reads: 1 },
    { value: [], reads: 2 },
    { value: [rate()], reads: 3 },
  ])('materialRates getter short circuit $reads reads', async ({ value, reads }) => {
    const f = fixture();
    const getter = vi.fn(() => value);
    const result = await f.dispatch(
      Object.defineProperty(valid(), 'materialRates', { enumerable: true, get: getter }),
    );
    expect(result.statusCode).toBe(reads === 3 ? 201 : 400);
    expect(getter).toHaveBeenCalledTimes(reads);
  });
  it('Array.isArray/length/map may read three different arrays, mapper uses third', async () => {
    const f = fixture();
    const getter = vi
      .fn()
      .mockReturnValueOnce([])
      .mockReturnValueOnce([rate()])
      .mockReturnValueOnce([{ ...rate(), unitCost: '2' }]);
    expect(
      (
        await f.dispatch(
          Object.defineProperty(valid(), 'materialRates', { enumerable: true, get: getter }),
        )
      ).statusCode,
    ).toBe(201);
    expect(getter).toHaveBeenCalledTimes(3);
    expect(inputOf(f)?.materialRates[0]?.unitCost).toBe('2');
  });
  it('map preserves sparse holes and inherited indices, no dense-array check', async () => {
    const f = fixture();
    const holes = new Array<ReturnType<typeof rate>>(2);
    expect((await f.dispatch({ ...valid(), materialRates: holes })).statusCode).toBe(201);
    expect(inputOf(f)?.materialRates).toHaveLength(2);
    expect(Object.hasOwn(inputOf(f)?.materialRates ?? {}, '0')).toBe(false);
    const sparse = new Array<ReturnType<typeof rate>>(3);
    sparse[0] = rate();
    sparse[2] = rate();
    expect((await f.dispatch({ ...valid(), materialRates: sparse })).statusCode).toBe(201);
    expect(Object.keys(inputOf(f, 1)?.materialRates ?? {})).toEqual(['0', '2']);
    const inherited = new Array<ReturnType<typeof rate>>(1);
    Object.setPrototypeOf(
      inherited,
      Object.assign(Object.create(Array.prototype) as object, { 0: rate() }),
    );
    expect((await f.dispatch({ ...valid(), materialRates: inherited })).statusCode).toBe(201);
    expect(inputOf(f, 2)?.materialRates[0]?.unitCost).toBe('5');
  });
  it('duplicates/order/case distinct values and zero costs are only forwarded', async () => {
    const f = fixture();
    const rates = [
      rate(),
      { ...rate(), itemVersionId: other.toUpperCase(), unitCost: '0' },
      rate(),
    ];
    expect((await f.dispatch({ ...valid(), materialRates: rates })).statusCode).toBe(201);
    expect(inputOf(f)?.materialRates.map((x) => x.itemVersionId)).toEqual([
      other,
      other.toUpperCase(),
      other,
    ]);
    expect(inputOf(f)?.materialRates[1]?.unitCost).toBe('0');
  });
  const rowFailures = [
    { key: 'itemVersionId', value: 'bad', message: 'itemVersionId must be a UUID' },
    { key: 'unitCost', value: 'bad', message: 'Invalid decimal' },
    {
      key: 'sourceReference',
      value: 'bad',
      message: 'Code must be 1-64 uppercase letters, digits, underscore, or hyphen',
    },
  ];
  it.each(rowFailures)('row $key before later rows/top fields', async (entry) => {
    const f = fixture();
    const values: Record<string, unknown> = rate();
    const index = rowFailures.indexOf(entry);
    const seen: string[] = [];
    const x: Record<string, unknown> = {};
    for (const later of rowFailures.slice(index)) values[later.key] = later.value;
    for (const key of rateKeys)
      Object.defineProperty(x, key, {
        enumerable: true,
        get: () => {
          seen.push(key);
          return values[key];
        },
      });
    expect(await f.dispatch({ ...valid(), version: 'bad', materialRates: [x, null] })).toEqual(
      invalid(entry.message),
    );
    expect(seen).toEqual(rateKeys.slice(0, index + 1));
  });
  for (const key of rateKeys)
    it.each([undefined, null, '', ' ', 0, false, [], {}])(
      'row string ' + key + ' %j',
      async (value) => {
        expect(
          await fixture().dispatch({ ...valid(), materialRates: [{ ...rate(), [key]: value }] }),
        ).toEqual(invalid(key + ' is required'));
      },
    );
  it.each(['bad', '00000000-0000-0000-0000-000000000000', id.replace('4aaa', '9aaa')])(
    'row UUID %s invalid',
    async (value) => {
      expect(
        await fixture().dispatch({
          ...valid(),
          materialRates: [{ ...rate(), itemVersionId: value }],
        }),
      ).toEqual(invalid('itemVersionId must be a UUID'));
    },
  );
  it('row UUID trim and case preserved', async () => {
    const f = fixture();
    expect(
      (
        await f.dispatch({
          ...valid(),
          materialRates: [{ ...rate(), itemVersionId: ' ' + other.toUpperCase() + ' ' }],
        })
      ).statusCode,
    ).toBe(201);
    expect(inputOf(f)?.materialRates[0]?.itemVersionId).toBe(other.toUpperCase());
  });
  const topFailures = [
    { key: 'version', value: 'bad', message: 'version must be an integer between 1 and 1000000' },
    { key: 'currency', value: 'bad', message: 'Currency must be ISO 4217 uppercase' },
    ...decimals.map((key) => ({ key, value: 'bad', message: 'Invalid decimal' })),
    {
      key: 'effectiveFrom',
      value: 'bad',
      message: 'effectiveFrom must be a valid YYYY-MM-DD date',
    },
    { key: 'effectiveTo', value: null, message: 'effectiveTo is required' },
    {
      key: 'sourceReference',
      value: 'bad',
      message: 'Code must be 1-64 uppercase letters, digits, underscore, or hyphen',
    },
  ];
  it.each(topFailures)('top $key before later values/actor', async (entry) => {
    const f = fixture();
    const values: Record<string, unknown> = valid();
    const index = topFailures.indexOf(entry);
    const seen: string[] = [];
    const body: Record<string, unknown> = {};
    for (const later of topFailures.slice(index)) values[later.key] = later.value;
    for (const [key, value] of Object.entries(values))
      Object.defineProperty(body, key, {
        enumerable: true,
        get: () => {
          if (key !== 'materialRates') seen.push(key);
          return value;
        },
      });
    expect(await f.dispatch(body)).toEqual(invalid(entry.message));
    const expected = topFailures
      .slice(0, index + 1)
      .map((x) => x.key)
      .filter((key) => key !== 'effectiveTo' || Object.hasOwn(values, 'effectiveTo'));
    if (index >= 6 && Object.hasOwn(values, 'effectiveTo')) expected.splice(7, 0, 'effectiveTo');
    expect(seen).toEqual(expected);
  });
  it('full getter order rows then method then top/To twice then actor/call', async () => {
    const f = fixture();
    const events: string[] = [];
    const body: Record<string, unknown> = {};
    const values: Record<string, unknown> = { ...valid(), effectiveTo: '2026-10-15' };
    const x: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(rate()))
      Object.defineProperty(x, key, {
        enumerable: true,
        get: () => {
          events.push('row.' + key);
          return value;
        },
      });
    for (const [key, value] of Object.entries(values))
      Object.defineProperty(body, key, {
        enumerable: true,
        get: () => {
          events.push(key);
          return key === 'materialRates' ? [x] : value;
        },
      });
    Object.defineProperty(f.productionCosts, 'createPolicy', {
      get: () => {
        events.push('method');
        return f.createPolicy;
      },
    });
    Object.defineProperty(f.context, 'actor', {
      get: () => {
        events.push('actor');
        return actor;
      },
    });
    f.createPolicy.mockImplementationOnce(() => {
      events.push('call');
      return Promise.resolve(repoResult(row));
    });
    expect((await f.dispatch(body)).statusCode).toBe(201);
    expect(events).toEqual([
      'materialRates',
      'materialRates',
      'materialRates',
      ...rateKeys.map((key) => 'row.' + key),
      'method',
      ...keys.filter((key) => key !== 'materialRates' && key !== 'effectiveTo').slice(0, 6),
      'effectiveTo',
      'effectiveTo',
      'sourceReference',
      'actor',
      'call',
    ]);
  });
  it.each([1, 1000000])('version %s valid bounds', async (version) => {
    const f = fixture();
    expect((await f.dispatch({ ...valid(), version })).statusCode).toBe(201);
    expect(inputOf(f)?.version).toBe(version);
  });
  it.each([
    undefined,
    null,
    '1',
    '',
    0,
    -0,
    -1,
    1.1,
    1000001,
    Number.MAX_SAFE_INTEGER,
    NaN,
    Infinity,
    false,
  ])('version %j number-only bounds', async (version) => {
    expect(await fixture().dispatch({ ...valid(), version })).toEqual(
      invalid('version must be an integer between 1 and 1000000'),
    );
  });
  for (const key of ['currency', ...decimals, 'effectiveFrom', 'sourceReference'])
    it.each([undefined, null, '', ' ', 0, false, [], {}])(
      'top string ' + key + ' %j',
      async (value) => {
        expect(await fixture().dispatch({ ...valid(), [key]: value })).toEqual(
          invalid(key + ' is required'),
        );
      },
    );
  it.each(['cny', 'CN', 'CNYX', '1NY'])('currency %s invalid syntax', async (currency) => {
    expect(await fixture().dispatch({ ...valid(), currency })).toEqual(
      invalid('Currency must be ISO 4217 uppercase'),
    );
  });
  it.each(['CNY', 'USD', 'ZZZ'])('currency %s no ISO membership check', async (currency) => {
    const f = fixture();
    expect((await f.dispatch({ ...valid(), currency: ' ' + currency + ' ' })).statusCode).toBe(201);
    expect(inputOf(f)?.currency).toBe(currency);
  });
  for (const key of [...decimals, 'unitCost'] as const) {
    const withValue = (value: unknown) =>
      key === 'unitCost'
        ? { ...valid(), materialRates: [{ ...rate(), unitCost: value }] }
        : { ...valid(), [key]: value };
    it.each([
      { value: ' 1.230000 ', expected: '1.23' },
      { value: '1.123456', expected: '1.123456' },
      { value: '0', expected: '0' },
      { value: '-0', expected: '0' },
      { value: '-0.000000', expected: '0' },
    ])('decimal ' + key + ' $value normalization HTTP-only', async ({ value, expected }) => {
      const f = fixture();
      expect((await f.dispatch(withValue(value))).statusCode).toBe(201);
      expect(key === 'unitCost' ? inputOf(f)?.materialRates[0]?.unitCost : inputOf(f)?.[key]).toBe(
        expected,
      );
    });
    it.each(['001', '1.1234567', '1000000000000000000', '+1', '.5', '1e2', 'NaN', 'Infinity'])(
      'decimal ' + key + ' %s invalid',
      async (value) => {
        expect(await fixture().dispatch(withValue(value))).toEqual(invalid('Invalid decimal'));
      },
    );
    it.each(['-1', '-0.000001'])('decimal ' + key + ' %s negative', async (value) => {
      expect(await fixture().dispatch(withValue(value))).toEqual(
        invalid(key + ' must be non-negative'),
      );
    });
  }
  for (const key of ['effectiveFrom', 'effectiveTo'] as const) {
    it.each(['2026-10-14', '2026-02-30', '2026-04-31', '2024-02-29'])(
      'calendar ' + key + ' %s trim original text',
      async (value) => {
        const f = fixture();
        expect((await f.dispatch({ ...valid(), [key]: ' ' + value + ' ' })).statusCode).toBe(201);
        expect(inputOf(f)?.[key]).toBe(value);
      },
    );
    it.each(['bad', '2026-13-01', '2026-01-32', '2026-1-01', '2026-10-14T00:00:00Z'])(
      'calendar ' + key + ' %s invalid',
      async (value) => {
        expect(await fixture().dispatch({ ...valid(), [key]: value })).toEqual(
          invalid(key + ' must be a valid YYYY-MM-DD date'),
        );
      },
    );
  }
  it.each([null, '', ' ', 0, false, [], {}])(
    'effectiveTo %j present not nullable',
    async (effectiveTo) => {
      expect(await fixture().dispatch({ ...valid(), effectiveTo })).toEqual(
        invalid('effectiveTo is required'),
      );
    },
  );
  it('effectiveTo missing/ownundefined omit key; present keeps key order', async () => {
    const f = fixture();
    expect((await f.dispatch()).statusCode).toBe(201);
    expect((await f.dispatch({ ...valid(), effectiveTo: undefined })).statusCode).toBe(201);
    expect(Object.hasOwn(inputOf(f) ?? {}, 'effectiveTo')).toBe(false);
    expect(Object.hasOwn(inputOf(f, 1) ?? {}, 'effectiveTo')).toBe(false);
    expect((await f.dispatch({ ...valid(), effectiveTo: '2026-01-01' })).statusCode).toBe(201);
    expect(Object.keys(inputOf(f, 2) ?? {})).toEqual(keys);
    expect(inputOf(f, 2)?.effectiveTo).toBe('2026-01-01');
  });
  it.each([
    { first: undefined, second: 'bad', reads: 1, status: 201 },
    { first: '2026-10-15', second: '2026-10-16', reads: 2, status: 201 },
    { first: '2026-10-15', second: null, reads: 2, status: 400 },
  ])('effectiveTo getter $reads reads with $status', async ({ first, second, reads, status }) => {
    const f = fixture();
    const getter = vi.fn().mockReturnValueOnce(first).mockReturnValue(second);
    const result = await f.dispatch(
      Object.defineProperty(valid(), 'effectiveTo', { enumerable: true, get: getter }),
    );
    expect(result.statusCode).toBe(status);
    expect(getter).toHaveBeenCalledTimes(reads);
    if (status === 201)
      expect(inputOf(f)?.effectiveTo).toBe(first === undefined ? undefined : second);
    else expect(result).toEqual(invalid('effectiveTo is required'));
  });
  for (const nestedCode of [false, true]) {
    const bodyWith = (sourceReference: unknown) =>
      nestedCode
        ? { ...valid(), materialRates: [{ ...rate(), sourceReference }] }
        : { ...valid(), sourceReference };
    it.each(['a', '1ABC', 'A B', 'A/B', 'A'.repeat(65)])(
      'sourceReference nested=' + String(nestedCode) + ' %s invalid',
      async (value) => {
        expect(await fixture().dispatch(bodyWith(value))).toEqual(
          invalid('Code must be 1-64 uppercase letters, digits, underscore, or hyphen'),
        );
      },
    );
    it.each(['A', 'A_1-B', 'A'.repeat(64)])(
      'sourceReference nested=' + String(nestedCode) + ' %s trims',
      async (value) => {
        const f = fixture();
        expect((await f.dispatch(bodyWith(' ' + value + ' '))).statusCode).toBe(201);
        expect(
          nestedCode ? inputOf(f)?.materialRates[0]?.sourceReference : inputOf(f)?.sourceReference,
        ).toBe(value);
      },
    );
  }
  it.each([undefined, '', 'HEADER', 'x'.repeat(201)])(
    'header %s/query ignored without key',
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
      expect(Object.hasOwn(inputOf(f) ?? {}, 'idempotencyKey')).toBe(false);
      expect(getter).not.toHaveBeenCalled();
    },
  );
  it('same/changed request repeated forward, not PG replay proof', async () => {
    const f = fixture();
    expect((await f.dispatch()).statusCode).toBe(201);
    expect((await f.dispatch()).statusCode).toBe(201);
    expect((await f.dispatch({ ...valid(), version: 2 })).statusCode).toBe(201);
    expect(f.createPolicy.mock.calls).toHaveLength(3);
  });
  it('no independent cost read still write/id-version fallback', async () => {
    expect(await fixture({ noRead: true }).dispatch()).toEqual(response(201, { id, version: 7 }));
  });
  it.each([
    { fields: null, expected: row },
    { fields: [], expected: { id } },
    { fields: ['name'], expected: { id, name: 'policy' } },
    { fields: ['version', 'nested'], expected: { id, version: 7, nested } },
  ])('cost read fields $fields independent', async ({ fields, expected }) => {
    const f = fixture({ fields: keys, readFields: fields });
    const result = await f.dispatch();
    expect(result).toEqual(response(201, expected));
    if (fields === null) expect(result.body).toBe(row);
    else expect(result.body).not.toBe(row);
    if (typeof result.body === 'object' && result.body !== null && 'nested' in result.body)
      expect(result.body.nested).toBe(nested);
  });
  it('late manufacturing-cost read Map/fields replacement/deletion', async () => {
    const f = fixture({ readFields: [] });
    const getter = vi.fn(() => ['name']);
    f.createPolicy.mockImplementationOnce(() => {
      expect(f.get.mock.calls.some(([cap]) => cap === 'manufacturing-cost:read')).toBe(false);
      f.permissions.set('manufacturing-cost:read', {
        scopes: [],
        get fields() {
          return getter();
        },
      });
      return Promise.resolve(repoResult(row));
    });
    expect(await f.dispatch()).toEqual(response(201, { id, name: 'policy' }));
    expect(getter).toHaveBeenCalledOnce();
    const removed = fixture();
    removed.createPolicy.mockImplementationOnce(() => {
      removed.permissions.delete('manufacturing-cost:read');
      return Promise.resolve(repoResult(row));
    });
    expect(await removed.dispatch()).toEqual(response(201, { id, version: 7 }));
  });
  it.each(['SELF', 'TEAM', 'DEPARTMENT', 'REGION', 'COMPANY', 'GROUP'] as const)(
    'HTTP scope %s refs only',
    async (scope) => {
      const f = fixture({ scopes: [scope] });
      expect((await f.dispatch()).statusCode).toBe(201);
      expect(f.createPolicy.mock.calls[0]?.[1].scopes).toBe(f.scopes);
      expect(f.createPolicy.mock.calls[0]?.[1].anchors).toBe(f.anchors);
    },
  );
  it('null result avoids enumeration/finite eagerly reads excluded getter', async () => {
    const getter = vi.fn(() => 'secret');
    const result: JsonObject = {
      id,
      version: 7,
      get secret() {
        return getter();
      },
    };
    const raw = fixture();
    raw.createPolicy.mockResolvedValueOnce(repoResult(result));
    expect((await raw.dispatch()).body).toBe(result);
    expect(getter).not.toHaveBeenCalled();
    const finite = fixture({ readFields: [] });
    finite.createPolicy.mockResolvedValueOnce(repoResult(result));
    expect(await finite.dispatch()).toEqual(response(201, { id }));
    expect(getter).toHaveBeenCalledOnce();
  });
  it('special own keys/order/shallow nested/no fabricatedid', async () => {
    const result: JsonObject = Object.fromEntries<JsonObject[string]>([
      ['toString', 'data'],
      ['__proto__', nested],
      ['constructor', 'data'],
      ['version', 7],
    ]);
    const f = fixture({ readFields: ['version', '__proto__', 'constructor', 'toString'] });
    f.createPolicy.mockResolvedValueOnce(repoResult(result));
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
    f.createPolicy.mockRejectedValueOnce(new DomainError(code, 'original repository error'));
    expect(await f.dispatch()).toEqual(error(status, code, 'original repository error'));
    expect(f.get.mock.calls.some(([cap]) => cap === 'manufacturing-cost:read')).toBe(false);
  });
  it('calculate neighbour retains own capability and policy method not called', async () => {
    const f = fixture();
    expect(await f.dispatch(null, { pathname: '/api/v1/production-cost-runs' })).toEqual(
      invalid('A JSON object body is required'),
    );
    expect(f.createPolicy).not.toHaveBeenCalled();
  });
});
