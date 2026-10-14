// Fixed against bd8e2e1 inline bank-payment intake; no future intake module imported.
import { describe, expect, it, vi } from 'vitest';
import { DomainError, type AuthorizationContext } from '@kingturf/domain';
import type { DataScope, JsonObject, PermissionKey } from '@kingturf/types';
import { buildApp, type ApiDependencies, type ApiRequest } from '../src/app.js';
type Qtc = NonNullable<ApiDependencies['quoteToCash']>;
type Method = Qtc['intakePayment'];
type Grant = NonNullable<ReturnType<AuthorizationContext['permissions']['get']>>;
const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const other = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const correlationId = '33333333-3333-4333-8333-333333333333';
const actor = { companyId: 'qtc-contract-mock', employeeId: id };
const nested = { keep: true };
const rawPayload = { nested, paragraphs: ['fixture'], nullable: null };
const path = '/api/v1/bank-payments';
const keys = [
  'customerId',
  'currency',
  'amount',
  'receivedAt',
  'bankReference',
  'rawPayload',
] as const;
const uuidKeys = ['customerId'] as const;
const returned: JsonObject = {
  id,
  remainingAmount: '3',
  rawPayloadHash: 'mock-payload-hash',
  customerId: id,
  currency: 'USD',
  amount: '3',
  receivedAt: '2026-02-28T00:00:00.000Z',
  bankReference: 'fixture #/银行',
  rawPayload,
  nested,
  secret: 'private',
};
function fixture(
  options: {
    available?: boolean;
    denied?: boolean;
    scopes?: readonly DataScope[];
    writeFields?: Grant['fields'];
    read?: Grant | null;
  } = {},
) {
  const scopes = options.scopes ?? ['TEAM'];
  const anchors = [{ scope: 'TEAM', organizationId: other }] as const;
  const permissions = new Map<PermissionKey, Grant>([
    [
      'bank-payment:intake',
      { scopes, fields: options.writeFields === undefined ? null : options.writeFields },
    ],
  ]);
  if (options.denied) permissions.delete('bank-payment:intake');
  if (options.read !== null)
    permissions.set('bank-payment:read', options.read ?? { scopes: ['TEAM'], fields: null });
  const context: AuthorizationContext = {
    actor,
    permissions,
    scopeAnchors: new Map([['bank-payment:intake', anchors]]),
  };
  const get = vi.spyOn(permissions, 'get');
  const intakePayment = vi.fn<Method>().mockResolvedValue(returned);
  const signContract = vi.fn<Qtc['signContract']>().mockResolvedValue({});
  const setCreditLimit = vi.fn<Qtc['setCreditLimit']>().mockResolvedValue({});
  const evaluateCredit = vi.fn<Qtc['evaluateCredit']>().mockResolvedValue({});
  const approveCredit = vi.fn<Qtc['approveCredit']>().mockResolvedValue({});
  const list = vi.fn<Qtc['list']>().mockResolvedValue([]);
  const listOperationalPage = vi
    .fn<Qtc['listOperationalPage']>()
    .mockResolvedValue({ items: [], nextCursor: null });
  const repository = {
    intakePayment,
    signContract,
    setCreditLimit,
    evaluateCredit,
    approveCredit,
    list,
    listOperationalPage,
  };
  const authenticate = vi.fn().mockResolvedValue(context);
  const dependencies = {
    auth: { authenticate } as unknown as ApiDependencies['auth'],
    organizations: {} as ApiDependencies['organizations'],
    employees: {} as ApiDependencies['employees'],
    ...(options.available === false ? {} : { quoteToCash: repository as unknown as Qtc }),
  };
  const app = buildApp(dependencies);
  const body: Record<string, unknown> = {
    customerId: id,
    currency: 'USD',
    amount: '3.00',
    receivedAt: '2026-02-28T08:00:00+08:00',
    bankReference: ' fixture #/银行 ',
    rawPayload,
  };
  const headers: Record<string, string | undefined> = {
    authorization: 'Bearer fixture',
    'x-correlation-id': correlationId,
    'idempotency-key': ' raw key ',
  };
  const dispatch = (request: Partial<ApiRequest> = {}) =>
    app.dispatch({
      method: 'POST',
      pathname: path,
      body,
      ...request,
      headers: request.headers ?? headers,
    });
  return {
    dependencies,
    body,
    headers,
    context,
    permissions,
    get,
    scopes,
    anchors,
    intakePayment,
    signContract,
    setCreditLimit,
    evaluateCredit,
    approveCredit,
    list,
    listOperationalPage,
    repository,
    authenticate,
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
const missing = error(404, 'not_found', 'Route not found');
const denied = error(403, 'forbidden', 'Permission denied');
describe('old one QTC bank-payment intake POST', () => {
  it('four args/receiver/input keys/ref/fresh scope/201 raw M/no manufactured version', async () => {
    const f = fixture();
    const a = await f.dispatch(),
      b = await f.dispatch();
    expect(a).toEqual(response(201, returned));
    expect(b).toEqual(a);
    expect(a.body).toBe(returned);
    const args = f.intakePayment.mock.calls[0];
    expect(args).toEqual([
      {
        customerId: id,
        currency: 'USD',
        amount: '3',
        receivedAt: '2026-02-28T00:00:00.000Z',
        bankReference: 'fixture #/银行',
        rawPayload,
      },
      ' raw key ',
      { actor, scopes: f.scopes, anchors: f.anchors },
      correlationId,
    ]);
    expect(args).toHaveLength(4);
    expect(f.intakePayment.mock.contexts[0]).toBe(f.repository);
    expect(Object.keys(args?.[0] ?? {})).toEqual(keys);
    expect(args?.[0].rawPayload).toBe(rawPayload);
    expect(args?.[0].rawPayload.nested).toBe(nested);
    expect(args?.[0]).not.toBe(f.body);
    expect(args?.[0]).not.toBe(f.intakePayment.mock.calls[1]?.[0]);
    expect(Object.keys(args?.[2] ?? {})).toEqual(['actor', 'scopes', 'anchors']);
    expect(args?.[2].actor).toBe(actor);
    expect(args?.[2].scopes).toBe(f.scopes);
    expect(args?.[2].anchors).toBe(f.anchors);
    expect(args?.[2]).not.toBe(f.intakePayment.mock.calls[1]?.[2]);
    expect(f.get.mock.calls).toEqual([
      ['bank-payment:intake'],
      ['bank-payment:intake'],
      ['bank-payment:read'],
      ['bank-payment:intake'],
      ['bank-payment:intake'],
      ['bank-payment:read'],
    ]);
    expect(Object.hasOwn(a.body as object, 'version')).toBe(false);
  });
  it.each([undefined, null, [], '', 0, false, true, 'json'].map((body) => ({ body })))(
    'root $body before pathname/cap',
    async ({ body }) => {
      const f = fixture({ denied: true });
      for (const pathname of [path, '/api/v1/not-a-qtc-command'])
        expect(await f.dispatch({ body, pathname })).toEqual(
          invalid('A JSON object body is required'),
        );
      expect(f.get).not.toHaveBeenCalled();
      expect(f.intakePayment).not.toHaveBeenCalled();
    },
  );
  it('allow unknown keys sort before method/field getters/key/cap', async () => {
    const f = fixture({ denied: true }),
      getter = vi.fn(() => {
        throw new Error('not reached');
      });
    Object.defineProperty(f.repository, 'intakePayment', { get: getter });
    const body = Object.defineProperty({ z: 1, a: 2 }, 'customerId', {
      enumerable: true,
      get: getter,
    });
    expect(await f.dispatch({ body })).toEqual(invalid('Unsupported fields: a, z'));
    expect(getter).not.toHaveBeenCalled();
    expect(f.get).not.toHaveBeenCalled();
  });
  for (const key of keys) {
    it.each(
      [undefined, null, '', ' ', 0, false, 1, true, [], () => 'invalid input'].map((value) => ({
        value,
      })),
    )('field ' + key + ' $value rejects before key/write cap', async ({ value }) => {
      const f = fixture({ denied: true });
      expect(
        await f.dispatch({
          body: { ...f.body, [key]: value },
          headers: { ...f.headers, 'idempotency-key': '' },
        }),
      ).toEqual(
        invalid(key === 'rawPayload' ? 'rawPayload must be a JSON object' : key + ' is required'),
      );
      expect(f.get).not.toHaveBeenCalled();
      expect(f.intakePayment).not.toHaveBeenCalled();
    });
    it('missing ' + key + ' error/no rawPayload default', async () => {
      const f = fixture(),
        body = { ...f.body };
      Reflect.deleteProperty(body, key);
      expect(await f.dispatch({ body })).toEqual(
        invalid(key === 'rawPayload' ? 'rawPayload must be a JSON object' : key + ' is required'),
      );
    });
  }
  for (const key of uuidKeys) {
    it.each([
      'bad',
      '00000000-0000-0000-0000-000000000000',
      id.replace('-4aaa-', '-0aaa-'),
      id.replace('-8aaa-', '-7aaa-'),
    ])('UUID ' + key + ' malformed %s', async (value) => {
      const f = fixture({ denied: true });
      expect(await f.dispatch({ body: { ...f.body, [key]: value } })).toEqual(
        invalid(key + ' must be a UUID'),
      );
      expect(f.get).not.toHaveBeenCalled();
    });
    it('UUID ' + key + ' trim/uppercase preserved', async () => {
      const f = fixture(),
        value = id.toUpperCase();
      expect((await f.dispatch({ body: { ...f.body, [key]: ' ' + value + ' ' } })).statusCode).toBe(
        201,
      );
      expect(f.intakePayment.mock.calls[0]?.[0]).toMatchObject({ [key]: value });
    });
  }
  it.each([' number/#?合同 ', '\nnumber\t', 'x'.repeat(4096)])(
    'bankReference %j ordinary trim string/no stablecode/max',
    async (bankReference) => {
      const f = fixture();
      expect((await f.dispatch({ body: { ...f.body, bankReference } })).statusCode).toBe(201);
      expect(f.intakePayment.mock.calls[0]?.[0].bankReference).toBe(bankReference.trim());
    },
  );
  const cyclic: Record<string, unknown> = {};
  cyclic.self = cyclic;
  it.each([
    { name: 'empty', value: {} },
    { name: 'nested', value: rawPayload },
    { name: 'date', value: new Date('2026-01-01') },
    { name: 'boxed-number', value: Object(7) as object },
    { name: 'null-prototype', value: Object.create(null) as object },
    {
      name: 'nested-nonJSON',
      value: { nested: { fn: () => 'not inspected', big: 1n, missing: undefined } },
    },
    { name: 'cyclic', value: cyclic },
  ])(
    'shallow rawPayload $name accepted/ref only not PG/transport persistence',
    async ({ value }) => {
      const f = fixture();
      expect((await f.dispatch({ body: { ...f.body, rawPayload: value } })).statusCode).toBe(201);
      expect(f.intakePayment.mock.calls[0]?.[0].rawPayload).toBe(value);
    },
  );
  it('rawPayload inner getter not read by HTTP/parsers, rawPayload reference and nested untouched', async () => {
    const f = fixture(),
      getter = vi.fn(() => {
        throw new Error('inner must not read');
      });
    const value = Object.defineProperty({ nested }, 'inner', { enumerable: true, get: getter });
    expect((await f.dispatch({ body: { ...f.body, rawPayload: value } })).statusCode).toBe(201);
    expect(getter).not.toHaveBeenCalled();
    expect(f.intakePayment.mock.calls[0]?.[0].rawPayload === value).toBe(true);
    expect(f.intakePayment.mock.calls[0]?.[0].rawPayload.nested === nested).toBe(true);
  });
  it('all multi-invalid first errors in original field order; rawPayload error before header', async () => {
    const f = fixture({ denied: true });
    for (let index = 0; index < keys.length; index++) {
      const body = { ...f.body };
      for (const key of keys.slice(index)) body[key] = null;
      const key = keys[index] ?? 'customerId';
      expect(await f.dispatch({ body, headers: { ...f.headers, 'idempotency-key': '' } })).toEqual(
        invalid(key === 'rawPayload' ? 'rawPayload must be a JSON object' : key + ' is required'),
      );
    }
  });
  it('method captured after allow before first parser, actor not reached for invalid input', async () => {
    const f = fixture(),
      events: string[] = [];
    Object.defineProperty(f.repository, 'intakePayment', {
      get: () => {
        events.push('method');
        return f.intakePayment;
      },
    });
    Object.defineProperty(f.context, 'actor', {
      get: () => {
        events.push('actor');
        return actor;
      },
    });
    expect(await f.dispatch({ body: {} })).toEqual(invalid('customerId is required'));
    expect(events).toEqual(['method']);
  });
  it.each(keys)(
    'getter %s mutates method but uses captured reference, value read once',
    async (key) => {
      const f = fixture(),
        replacement = vi.fn<Method>().mockResolvedValue({}),
        value = f.body[key];
      const getter = vi.fn(() => {
        f.repository.intakePayment = replacement;
        return value;
      });
      Object.defineProperty(f.body, key, { enumerable: true, get: getter });
      expect((await f.dispatch()).statusCode).toBe(201);
      expect(getter).toHaveBeenCalledOnce();
      expect(f.intakePayment).toHaveBeenCalledOnce();
      expect(replacement).not.toHaveBeenCalled();
      expect(f.intakePayment.mock.contexts[0]).toBe(f.repository);
    },
  );
  it.each(keys)('getter deletes own %s so ctx requests actual remaining fields', async (key) => {
    const f = fixture({ writeFields: keys.filter((field) => field !== key) }),
      value = f.body[key];
    const getter = vi.fn(() => {
      Reflect.deleteProperty(f.body, key);
      return value;
    });
    Object.defineProperty(f.body, key, { enumerable: true, configurable: true, get: getter });
    expect((await f.dispatch()).statusCode).toBe(201);
    expect(getter).toHaveBeenCalledOnce();
    expect(f.intakePayment.mock.calls[0]?.[0]).toMatchObject({
      [key]:
        key === 'bankReference'
          ? 'fixture #/银行'
          : key === 'amount'
            ? '3'
            : key === 'receivedAt'
              ? '2026-02-28T00:00:00.000Z'
              : value,
    });
  });
  it('trace globalspread/auth→allow keys→method→six fields→ctx keys→permission→actor→call→late M', async () => {
    const f = fixture(),
      events: string[] = [];
    const headers = Object.defineProperty({ ...f.headers }, 'idempotency-key', {
      enumerable: true,
      get: () => {
        events.push('header');
        return 'raw';
      },
    });
    f.authenticate.mockImplementationOnce(() => {
      events.push('auth');
      return Promise.resolve(f.context);
    });
    const body = new Proxy(f.body, {
      ownKeys(target) {
        events.push('keys');
        return Reflect.ownKeys(target);
      },
      get(target, key, receiver) {
        if (typeof key === 'string') events.push(key);
        return Reflect.get(target, key, receiver) as unknown;
      },
    });
    Object.defineProperty(f.repository, 'intakePayment', {
      get: () => {
        events.push('method');
        return f.intakePayment;
      },
    });
    f.get.mockImplementation((cap) => {
      events.push(cap);
      return new Map(f.permissions).get(cap);
    });
    Object.defineProperty(f.context, 'actor', {
      get: () => {
        events.push('actor');
        return actor;
      },
    });
    f.intakePayment.mockImplementationOnce(() => {
      events.push('call');
      return Promise.resolve(returned);
    });
    expect((await f.dispatch({ body, headers })).statusCode).toBe(201);
    expect(events).toEqual([
      'header',
      'auth',
      'keys',
      'method',
      ...keys,
      'keys',
      'bank-payment:intake',
      'bank-payment:intake',
      'actor',
      'call',
      'bank-payment:read',
    ]);
  });
  it('actor changing method after capture cannot replace callee', async () => {
    const f = fixture(),
      replacement = vi.fn<Method>().mockResolvedValue({});
    Object.defineProperty(f.context, 'actor', {
      get: () => {
        f.repository.intakePayment = replacement;
        return actor;
      },
    });
    expect((await f.dispatch()).statusCode).toBe(201);
    expect(f.intakePayment).toHaveBeenCalledOnce();
    expect(replacement).not.toHaveBeenCalled();
  });
  it.each([undefined, '', 'x'.repeat(129)].map((key) => ({ key })))(
    'header key $key fails after input before cap',
    async ({ key }) => {
      const f = fixture({ denied: true }),
        headers = { ...f.headers };
      if (key === undefined) delete headers['idempotency-key'];
      else headers['idempotency-key'] = key;
      expect(await f.dispatch({ headers })).toEqual(invalid('Idempotency-Key is required'));
      expect(f.get).not.toHaveBeenCalled();
    },
  );
  it.each(['x', 'x'.repeat(128), ' ', ' raw/key!? '])('key %j original value', async (key) => {
    const f = fixture();
    expect(
      (await f.dispatch({ headers: { ...f.headers, 'idempotency-key': key } })).statusCode,
    ).toBe(201);
    expect(f.intakePayment.mock.calls[0]?.[1]).toBe(key);
  });
  it('body key unknown not fallback, query inner values not parsed', async () => {
    const f = fixture(),
      headers = { ...f.headers };
    delete headers['idempotency-key'];
    expect(await f.dispatch({ body: { ...f.body, idempotencyKey: 'body' }, headers })).toEqual(
      invalid('Unsupported fields: idempotencyKey'),
    );
    const getter = vi.fn(() => {
      throw new Error('ignored');
    });
    expect(
      (await f.dispatch({ query: Object.defineProperty({}, 'limit', { get: getter }) })).statusCode,
    ).toBe(201);
    expect(getter).not.toHaveBeenCalled();
  });
  it.each([{ denied: true }, { scopes: [] }])(
    'write cap/scopes %j before actor but after fields/key',
    async (options) => {
      const f = fixture(options),
        getter = vi.fn(() => {
          throw new Error('not reached');
        });
      Object.defineProperty(f.context, 'actor', { get: getter });
      expect(await f.dispatch()).toEqual(denied);
      expect(getter).not.toHaveBeenCalled();
      expect(f.intakePayment).not.toHaveBeenCalled();
    },
  );
  it.each([[], ['customerId'], keys.slice(0, 5), ['unrelated']].map((fields) => ({ fields })))(
    'write fields $fields actual keys rejected',
    async ({ fields }) => {
      const f = fixture({ writeFields: fields });
      expect(await f.dispatch()).toEqual(error(403, 'forbidden', 'Field permission denied'));
      expect(f.intakePayment).not.toHaveBeenCalled();
    },
  );
  it('full grant/body key order different from parser order; nonenum/inherited known fields/unknown symbol', async () => {
    const f = fixture({ writeFields: keys }),
      body = Object.fromEntries(keys.toReversed().map((key) => [key, f.body[key]]));
    expect((await f.dispatch({ body })).statusCode).toBe(201);
    expect(Object.keys(f.intakePayment.mock.calls[0]?.[0] ?? {})).toEqual(keys);
    const hidden = fixture({ writeFields: [] }),
      nonenum = {};
    for (const [key, value] of Object.entries(hidden.body))
      Object.defineProperty(nonenum, key, { value });
    Object.defineProperty(nonenum, Symbol('unknown'), { value: 'ignored', enumerable: true });
    expect((await hidden.dispatch({ body: nonenum })).statusCode).toBe(201);
    expect(
      (
        await hidden.dispatch({
          body: Object.create({ ...hidden.body, unknown: 'inherited' }) as Record<string, unknown>,
        })
      ).statusCode,
    ).toBe(201);
  });
  it.each(['SELF', 'TEAM', 'DEPARTMENT', 'REGION', 'COMPANY', 'GROUP'] as const)(
    'scope %s forwards refs only not PG matrix',
    async (scope) => {
      const f = fixture({ scopes: [scope] });
      expect((await f.dispatch()).statusCode).toBe(201);
      expect(f.intakePayment.mock.calls[0]?.[2].scopes).toBe(f.scopes);
      expect(f.intakePayment.mock.calls[0]?.[2].anchors).toBe(f.anchors);
    },
  );
  it('anchors missing uses fresh[] per request no added refusal', async () => {
    const f = fixture();
    Object.defineProperty(f.context, 'scopeAnchors', { value: undefined });
    await f.dispatch();
    await f.dispatch();
    expect(f.intakePayment.mock.calls[0]?.[2].anchors).toEqual([]);
    expect(f.intakePayment.mock.calls[0]?.[2].anchors).not.toBe(
      f.intakePayment.mock.calls[1]?.[2].anchors,
    );
  });
  it.each([
    { read: null, label: 'missing' },
    { read: { scopes: [], fields: null }, label: 'raw' },
    { read: { scopes: ['TEAM'], fields: [] }, label: 'id' },
    { read: { scopes: ['TEAM'], fields: ['amount', 'rawPayloadHash', 'nested'] }, label: 'finite' },
  ] as const)(
    'late M payment read $label independent of write capability',
    async ({ read, label }) => {
      const f = fixture({ read }),
        result = await f.dispatch();
      expect(result).toEqual(
        response(
          201,
          label === 'raw'
            ? returned
            : label === 'finite'
              ? { id, amount: '3', rawPayloadHash: 'mock-payload-hash', nested }
              : { id },
        ),
      );
      if (label === 'raw') expect(result.body).toBe(returned);
      else expect(result.body).not.toBe(returned);
      if (label === 'finite') expect((result.body as JsonObject).nested).toBe(nested);
      expect(f.get.mock.calls.at(-1)).toEqual(['bank-payment:read']);
    },
  );
  it('M fallback existing synthetic version only, remainingAmount is not version/no invented id', async () => {
    const f = fixture({ read: null });
    expect(await f.dispatch()).toEqual(response(201, { id }));
    f.intakePayment.mockResolvedValueOnce({ id, version: 3, remainingAmount: '3' });
    expect(await f.dispatch()).toEqual(response(201, { id, version: 3 }));
    f.intakePayment.mockResolvedValueOnce({ remainingAmount: '3' });
    expect(await f.dispatch()).toEqual(response(201, {}));
  });
  it.each([null, [], ['amount']].map((fields) => ({ fields })))(
    'await read field change $fields affects M',
    async ({ fields }) => {
      const f = fixture();
      f.intakePayment.mockImplementationOnce(() => {
        f.permissions.set('bank-payment:read', { scopes: [], fields });
        return Promise.resolve(returned);
      });
      expect(await f.dispatch()).toEqual(
        response(201, fields === null ? returned : fields.length ? { id, amount: '3' } : { id }),
      );
    },
  );
  it('await read deletion vs runtime undefined fields old500-C', async () => {
    const f = fixture();
    f.intakePayment.mockImplementationOnce(() => {
      f.permissions.delete('bank-payment:read');
      return Promise.resolve(returned);
    });
    expect(await f.dispatch()).toEqual(response(201, { id }));
    const wrong = fixture();
    wrong.intakePayment.mockImplementationOnce(() => {
      Object.defineProperty(wrong.permissions.get('bank-payment:read'), 'fields', {
        value: undefined,
      });
      return Promise.resolve(returned);
    });
    expect(await wrong.dispatch()).toEqual(error(500, 'internal_error', 'Internal server error'));
  });
  it('finite M eager excluded getter/specialown/nestedrefs/order shallow no fabricated id', async () => {
    const f = fixture({
        read: { scopes: [], fields: ['nested', '__proto__', 'constructor', 'toString'] },
      }),
      getter = vi.fn(() => 'private'),
      row: JsonObject = { nested };
    Object.defineProperty(row, 'secret', { enumerable: true, get: getter });
    for (const key of ['__proto__', 'constructor', 'toString'])
      Object.defineProperty(row, key, { enumerable: true, value: nested });
    f.intakePayment.mockResolvedValueOnce(row);
    const result = await f.dispatch();
    expect(getter).toHaveBeenCalledOnce();
    expect(Object.keys(result.body as object)).toEqual([
      'nested',
      '__proto__',
      'constructor',
      'toString',
    ]);
    expect((result.body as JsonObject).nested).toBe(nested);
    expect(result.body).not.toBe(row);
    expect(Object.getPrototypeOf(result.body)).toBe(Object.prototype);
  });
  it('missingrepo skips sharedO404; global401 before O', async () => {
    const f = fixture({ available: false, denied: true });
    expect(await f.dispatch({ body: null })).toEqual(missing);
    expect(f.get).not.toHaveBeenCalled();
    const authenticated = fixture();
    expect(
      await authenticated.dispatch({ body: null, headers: { 'x-correlation-id': correlationId } }),
    ).toEqual(error(401, 'authentication_required', 'A valid session is required'));
    expect(authenticated.authenticate).not.toHaveBeenCalled();
  });
  it.each(['PATCH', 'PUT', 'DELETE', 'HEAD', 'post'])(
    'unsupported method %s skips O/cap',
    async (method) => {
      const f = fixture({ denied: true });
      expect(await f.dispatch({ method, body: null })).toEqual(missing);
      expect(f.get).not.toHaveBeenCalled();
    },
  );
  it.each([
    path + '/',
    path + '/' + id,
    path + '/extra',
    path.toUpperCase(),
    '/api/v1/not-a-qtc-command',
  ])('unsupported POST path %s legal root404/invalidroot400', async (pathname) => {
    const f = fixture({ denied: true });
    expect(await f.dispatch({ pathname, body: {} })).toEqual(missing);
    expect(await f.dispatch({ pathname, body: null })).toEqual(
      invalid('A JSON object body is required'),
    );
    expect(f.get).not.toHaveBeenCalled();
  });
  it('previous writes-sign-order-AR and next reconciliation parser unchanged', async () => {
    const f = fixture();
    for (const pathname of [
      '/api/v1/contracts',
      '/api/v1/credit-limits',
      '/api/v1/credit-decisions',
    ])
      expect(await f.dispatch({ pathname, body: {} })).toEqual(invalid('customerId is required'));
    expect(await f.dispatch({ pathname: '/api/v1/contracts/' + id + '/sign', body: {} })).toEqual(
      invalid('provider is required'),
    );
    expect(await f.dispatch({ pathname: '/api/v1/sales-orders', body: {} })).toEqual(
      invalid('lines must be an array'),
    );
    expect(
      await f.dispatch({ pathname: '/api/v1/ar-open-items', body: { documentType: 'OTHER' } }),
    ).toEqual(invalid('documentType is unsupported'));
    expect(await f.dispatch({ pathname: '/api/v1/reconciliation-runs', body: {} })).toEqual(
      invalid('paymentId is required'),
    );
    expect(f.intakePayment).not.toHaveBeenCalled();
  });
  it('all seven GET untouched by POST body/rawPayload O', async () => {
    const f = fixture();
    for (const [pathname, cap] of [
      ['credit-limits', 'credit:read'],
      ['credit-decisions', 'credit:read'],
      ['contracts', 'contract:read'],
      ['sales-orders', 'sales-order:read'],
      ['reconciliation-runs', 'reconciliation:read'],
      ['ar-open-items', 'ar:read'],
      ['bank-payments', 'bank-payment:read'],
    ] as const) {
      f.permissions.set(cap, { scopes: ['TEAM'], fields: null });
      expect(
        (await f.dispatch({ method: 'GET', pathname: '/api/v1/' + pathname, body: null }))
          .statusCode,
      ).toBe(200);
    }
    expect(f.list).toHaveBeenCalledTimes(5);
    expect(f.listOperationalPage).toHaveBeenCalledTimes(2);
    expect(f.intakePayment).not.toHaveBeenCalled();
  });
  it.each([
    ['not_found', 404],
    ['conflict', 409],
    ['forbidden', 403],
    ['invalid_request', 400],
  ] as const)('repository error %s/%i/C preserved', async (code, status) => {
    const f = fixture();
    f.intakePayment.mockRejectedValueOnce(new DomainError(code, 'payment rejected'));
    expect(await f.dispatch()).toEqual(error(status, code, 'payment rejected'));
  });
  it.each(['usd', 'zZz', 'US', 'USDD', '1SD'])('currency %s uppercase-only', async (currency) => {
    const f = fixture();
    expect(await f.dispatch({ body: { ...f.body, currency } })).toEqual(
      invalid('Currency must be ISO 4217 uppercase'),
    );
  });
  it('currency ZZZ trim shape only not PG catalog', async () => {
    const f = fixture();
    expect((await f.dispatch({ body: { ...f.body, currency: ' ZZZ ' } })).statusCode).toBe(201);
    expect(f.intakePayment.mock.calls[0]?.[0].currency).toBe('ZZZ');
  });
  it.each([
    { value: '-1', message: 'amount must be non-negative' },
    { value: '01', message: 'Invalid decimal' },
    { value: '1e2', message: 'Invalid decimal' },
    { value: '+1', message: 'Invalid decimal' },
    { value: '.1', message: 'Invalid decimal' },
    { value: '0.0000001', message: 'Invalid decimal' },
    { value: '1000000000000000000', message: 'Invalid decimal' },
  ])('amount $value original D', async ({ value, message }) => {
    const f = fixture({ denied: true });
    expect(await f.dispatch({ body: { ...f.body, amount: value } })).toEqual(invalid(message));
    expect(f.get).not.toHaveBeenCalled();
  });
  it.each([
    { value: '0', expected: '0' },
    { value: '-0.000000', expected: '0' },
    { value: ' 3.000000 ', expected: '3' },
    { value: '999999999999999999.999999', expected: '999999999999999999.999999' },
  ])('amount $value HTTP nonnegative only not PG positivity', async ({ value, expected }) => {
    const f = fixture();
    expect((await f.dispatch({ body: { ...f.body, amount: value } })).statusCode).toBe(201);
    expect(f.intakePayment.mock.calls[0]?.[0].amount).toBe(expected);
  });
  it.each([
    { value: 'bad', expected: null },
    { value: '2026-02-30', expected: '2026-03-02T00:00:00.000Z' },
    { value: '2020-01-01', expected: '2020-01-01T00:00:00.000Z' },
    { value: '2099-01-01', expected: '2099-01-01T00:00:00.000Z' },
    { value: ' 2026-02-28T08:00:00+08:00 ', expected: '2026-02-28T00:00:00.000Z' },
  ])('receivedAt $value oldDate/no temporal rule', async ({ value, expected }) => {
    const f = fixture();
    const r = await f.dispatch({ body: { ...f.body, receivedAt: value } });
    if (expected === null) expect(r).toEqual(invalid('receivedAt must be a valid timestamp'));
    else {
      expect(r.statusCode).toBe(201);
      expect(f.intakePayment.mock.calls[0]?.[0].receivedAt).toBe(expected);
    }
  });
  it('allow ownKeys replaces whole root before method capture and root getter twice', async () => {
    const f = fixture();
    const replacement = vi.fn<Method>().mockResolvedValue(returned),
      repo = { intakePayment: replacement };
    let selected: unknown = f.repository;
    const root = vi.fn(() => selected);
    Object.defineProperty(f.dependencies, 'quoteToCash', { get: root });
    const body = new Proxy(f.body, {
      ownKeys: (t) => {
        selected = repo;
        return Reflect.ownKeys(t);
      },
    });
    expect((await f.dispatch({ body })).statusCode).toBe(201);
    expect(root).toHaveBeenCalledTimes(2);
    expect(replacement).toHaveBeenCalledOnce();
    expect(replacement.mock.contexts[0]).toBe(repo);
    expect(f.intakePayment).not.toHaveBeenCalled();
  });
  it('allow unknown errors prevent second root/method read', async () => {
    const f = fixture();
    const root = vi.fn(() => f.repository),
      method = vi.fn(() => f.intakePayment);
    Object.defineProperty(f.dependencies, 'quoteToCash', { get: root });
    Object.defineProperty(f.repository, 'intakePayment', { get: method });
    expect(await f.dispatch({ body: { unknown: 1 } })).toEqual(
      invalid('Unsupported fields: unknown'),
    );
    expect(root).toHaveBeenCalledTimes(1);
    expect(method).not.toHaveBeenCalled();
    expect(f.get).not.toHaveBeenCalled();
  });
  it.each(['method', ...keys, 'actor'] as const)(
    'root replacement at %s preserves captured receiver',
    async (phase) => {
      const f = fixture();
      const replacement = vi.fn<Method>().mockResolvedValue({}),
        repo = { intakePayment: replacement };
      const swap = () => {
        Reflect.set(f.dependencies, 'quoteToCash', repo);
      };
      if (phase === 'method')
        Object.defineProperty(f.repository, 'intakePayment', {
          get: () => {
            swap();
            return f.intakePayment;
          },
        });
      else if (phase === 'actor')
        Object.defineProperty(f.context, 'actor', {
          get: () => {
            swap();
            return actor;
          },
        });
      else {
        const value = f.body[phase];
        Object.defineProperty(f.body, phase, {
          enumerable: true,
          get: () => {
            swap();
            return value;
          },
        });
      }
      expect((await f.dispatch()).statusCode).toBe(201);
      expect(f.intakePayment).toHaveBeenCalledOnce();
      expect(f.intakePayment.mock.contexts[0]).toBe(f.repository);
      expect(replacement).not.toHaveBeenCalled();
    },
  );
});
