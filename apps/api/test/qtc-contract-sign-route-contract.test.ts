// Fixed against 17a576f inline contract signing; no future signing module imported.
import { describe, expect, it, vi } from 'vitest';
import { DomainError, type AuthorizationContext } from '@kingturf/domain';
import type { DataScope, JsonObject, PermissionKey } from '@kingturf/types';
import { buildApp, type ApiDependencies, type ApiRequest } from '../src/app.js';
type Qtc = NonNullable<ApiDependencies['quoteToCash']>;
type Method = Qtc['signContract'];
type Grant = NonNullable<ReturnType<AuthorizationContext['permissions']['get']>>;
const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const other = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const correlationId = '33333333-3333-4333-8333-333333333333';
const actor = { companyId: 'qtc-contract-mock', employeeId: id };
const nested = { keep: true };
const payload = { nested, paragraphs: ['fixture'], nullable: null };
const path = '/api/v1/contracts/' + id + '/sign';
const keys = ['provider', 'providerReceiptId', 'payload', 'signedAt'] as const;
const returned: JsonObject = {
  id,
  contractRevisionId: other,
  status: 'SIGNED',
  payloadHash: 'mock-payload-hash',
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
      'contract:sign',
      { scopes, fields: options.writeFields === undefined ? null : options.writeFields },
    ],
  ]);
  if (options.denied) permissions.delete('contract:sign');
  if (options.read !== null)
    permissions.set('contract:read', options.read ?? { scopes: ['TEAM'], fields: null });
  const context: AuthorizationContext = {
    actor,
    permissions,
    scopeAnchors: new Map([['contract:sign', anchors]]),
  };
  const get = vi.spyOn(permissions, 'get');
  const signContract = vi.fn<Method>().mockResolvedValue(returned);
  const createContract = vi.fn<Qtc['createContract']>().mockResolvedValue({});
  const setCreditLimit = vi.fn<Qtc['setCreditLimit']>().mockResolvedValue({});
  const evaluateCredit = vi.fn<Qtc['evaluateCredit']>().mockResolvedValue({});
  const approveCredit = vi.fn<Qtc['approveCredit']>().mockResolvedValue({});
  const list = vi.fn<Qtc['list']>().mockResolvedValue([]);
  const listOperationalPage = vi
    .fn<Qtc['listOperationalPage']>()
    .mockResolvedValue({ items: [], nextCursor: null });
  const repository = {
    signContract,
    createContract,
    setCreditLimit,
    evaluateCredit,
    approveCredit,
    list,
    listOperationalPage,
  };
  const authenticate = vi.fn().mockResolvedValue(context);
  const app = buildApp({
    auth: { authenticate } as unknown as ApiDependencies['auth'],
    organizations: {} as ApiDependencies['organizations'],
    employees: {} as ApiDependencies['employees'],
    ...(options.available === false ? {} : { quoteToCash: repository as unknown as Qtc }),
  });
  const body: Record<string, unknown> = {
    provider: ' fixture #/合同 ',
    providerReceiptId: ' receipt/? ',
    payload,
    signedAt: '2026-02-28T08:00:00+08:00',
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
    body,
    headers,
    context,
    permissions,
    get,
    scopes,
    anchors,
    signContract,
    createContract,
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
const missing = error(404, 'not_found', 'Route not found');
const denied = error(403, 'forbidden', 'Permission denied');
describe('old one QTC contract signing POST', () => {
  it('captured method before matched malformed UUID, before every input getter and cap', async () => {
    const f = fixture({ denied: true });
    const method = vi.fn(() => f.signContract);
    const input = vi.fn(() => {
      throw new Error('input must not be read');
    });
    Object.defineProperty(f.repository, 'signContract', { get: method });
    for (const key of keys) Object.defineProperty(f.body, key, { enumerable: true, get: input });
    expect(await f.dispatch({ pathname: '/api/v1/contracts/abc/sign' })).toEqual(
      invalid('contractRevisionId must be a UUID'),
    );
    expect(method).toHaveBeenCalledOnce();
    expect(input).not.toHaveBeenCalled();
    expect(f.get).not.toHaveBeenCalled();
    expect(f.signContract).not.toHaveBeenCalled();
  });
  it('five args/receiver/input keys/ref/fresh scope/201 raw M/no manufactured version', async () => {
    const f = fixture();
    const a = await f.dispatch(),
      b = await f.dispatch();
    expect(a).toEqual(response(201, returned));
    expect(b).toEqual(a);
    expect(a.body).toBe(returned);
    const args = f.signContract.mock.calls[0];
    expect(args).toEqual([
      id,
      {
        provider: 'fixture #/合同',
        providerReceiptId: 'receipt/?',
        payload,
        signedAt: '2026-02-28T00:00:00.000Z',
      },
      ' raw key ',
      { actor, scopes: f.scopes, anchors: f.anchors },
      correlationId,
    ]);
    expect(args).toHaveLength(5);
    expect(f.signContract.mock.contexts[0]).toBe(f.repository);
    expect(Object.keys(args?.[1] ?? {})).toEqual(keys);
    expect(args?.[1].payload).toBe(payload);
    expect(args?.[1].payload.nested).toBe(nested);
    expect(args?.[1]).not.toBe(f.body);
    expect(args?.[1]).not.toBe(f.signContract.mock.calls[1]?.[1]);
    expect(Object.keys(args?.[3] ?? {})).toEqual(['actor', 'scopes', 'anchors']);
    expect(args?.[3].actor).toBe(actor);
    expect(args?.[3].scopes).toBe(f.scopes);
    expect(args?.[3].anchors).toBe(f.anchors);
    expect(args?.[3]).not.toBe(f.signContract.mock.calls[1]?.[3]);
    expect(f.get.mock.calls).toEqual([
      ['contract:sign'],
      ['contract:sign'],
      ['contract:read'],
      ['contract:sign'],
      ['contract:sign'],
      ['contract:read'],
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
      expect(f.signContract).not.toHaveBeenCalled();
    },
  );
  it('allow unknown keys sort before method/field getters/key/cap', async () => {
    const f = fixture({ denied: true }),
      getter = vi.fn(() => {
        throw new Error('not reached');
      });
    Object.defineProperty(f.repository, 'signContract', { get: getter });
    const body = Object.defineProperty({ z: 1, a: 2 }, 'provider', {
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
        invalid(key === 'payload' ? 'payload must be a JSON object' : key + ' is required'),
      );
      expect(f.get).not.toHaveBeenCalled();
      expect(f.signContract).not.toHaveBeenCalled();
    });
    it('missing ' + key + ' error/no payload default', async () => {
      const f = fixture(),
        body = { ...f.body };
      Reflect.deleteProperty(body, key);
      expect(await f.dispatch({ body })).toEqual(
        invalid(key === 'payload' ? 'payload must be a JSON object' : key + ' is required'),
      );
    });
  }
  it.each([' number/#?合同 ', '\nnumber\t', 'x'.repeat(4096)])(
    'provider %j ordinary trim string/no stablecode/max',
    async (provider) => {
      const f = fixture();
      expect((await f.dispatch({ body: { ...f.body, provider } })).statusCode).toBe(201);
      expect(f.signContract.mock.calls[0]?.[1].provider).toBe(provider.trim());
    },
  );
  const cyclic: Record<string, unknown> = {};
  cyclic.self = cyclic;
  it.each([
    { name: 'empty', value: {} },
    { name: 'nested', value: payload },
    { name: 'date', value: new Date('2026-01-01') },
    { name: 'boxed-number', value: Object(7) as object },
    { name: 'null-prototype', value: Object.create(null) as object },
    {
      name: 'nested-nonJSON',
      value: { nested: { fn: () => 'not inspected', big: 1n, missing: undefined } },
    },
    { name: 'cyclic', value: cyclic },
  ])('shallow payload $name accepted/ref only not PG/transport persistence', async ({ value }) => {
    const f = fixture();
    expect((await f.dispatch({ body: { ...f.body, payload: value } })).statusCode).toBe(201);
    expect(f.signContract.mock.calls[0]?.[1].payload).toBe(value);
  });
  it('payload inner getter not read by HTTP/parsers, payload reference and nested untouched', async () => {
    const f = fixture(),
      getter = vi.fn(() => {
        throw new Error('inner must not read');
      });
    const value = Object.defineProperty({ nested }, 'inner', { enumerable: true, get: getter });
    expect((await f.dispatch({ body: { ...f.body, payload: value } })).statusCode).toBe(201);
    expect(getter).not.toHaveBeenCalled();
    expect(f.signContract.mock.calls[0]?.[1].payload === value).toBe(true);
    expect(f.signContract.mock.calls[0]?.[1].payload.nested === nested).toBe(true);
  });
  it('all multi-invalid first errors in original field order; payload error before header', async () => {
    const f = fixture({ denied: true });
    for (let index = 0; index < keys.length; index++) {
      const body = { ...f.body };
      for (const key of keys.slice(index)) body[key] = null;
      const key = keys[index] ?? 'provider';
      expect(await f.dispatch({ body, headers: { ...f.headers, 'idempotency-key': '' } })).toEqual(
        invalid(key === 'payload' ? 'payload must be a JSON object' : key + ' is required'),
      );
    }
  });
  it('method captured after allow before first parser, actor not reached for invalid input', async () => {
    const f = fixture(),
      events: string[] = [];
    Object.defineProperty(f.repository, 'signContract', {
      get: () => {
        events.push('method');
        return f.signContract;
      },
    });
    Object.defineProperty(f.context, 'actor', {
      get: () => {
        events.push('actor');
        return actor;
      },
    });
    expect(await f.dispatch({ body: {} })).toEqual(invalid('provider is required'));
    expect(events).toEqual(['method']);
  });
  it.each(keys)(
    'getter %s mutates method but uses captured reference, value read once',
    async (key) => {
      const f = fixture(),
        replacement = vi.fn<Method>().mockResolvedValue({}),
        value = f.body[key];
      const getter = vi.fn(() => {
        f.repository.signContract = replacement;
        return value;
      });
      Object.defineProperty(f.body, key, { enumerable: true, get: getter });
      expect((await f.dispatch()).statusCode).toBe(201);
      expect(getter).toHaveBeenCalledOnce();
      expect(f.signContract).toHaveBeenCalledOnce();
      expect(replacement).not.toHaveBeenCalled();
      expect(f.signContract.mock.contexts[0]).toBe(f.repository);
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
    expect(f.signContract.mock.calls[0]?.[1]).toMatchObject({
      [key]:
        key === 'provider'
          ? 'fixture #/合同'
          : key === 'providerReceiptId'
            ? 'receipt/?'
            : key === 'signedAt'
              ? '2026-02-28T00:00:00.000Z'
              : value,
    });
  });
  it('trace globalspread/auth→allow keys→method→four fields→ctx keys→permission→actor→call→late M', async () => {
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
    Object.defineProperty(f.repository, 'signContract', {
      get: () => {
        events.push('method');
        return f.signContract;
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
    f.signContract.mockImplementationOnce(() => {
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
      'contract:sign',
      'contract:sign',
      'actor',
      'call',
      'contract:read',
    ]);
  });
  it('actor changing method after capture cannot replace callee', async () => {
    const f = fixture(),
      replacement = vi.fn<Method>().mockResolvedValue({});
    Object.defineProperty(f.context, 'actor', {
      get: () => {
        f.repository.signContract = replacement;
        return actor;
      },
    });
    expect((await f.dispatch()).statusCode).toBe(201);
    expect(f.signContract).toHaveBeenCalledOnce();
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
    expect(f.signContract.mock.calls[0]?.[2]).toBe(key);
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
      expect(f.signContract).not.toHaveBeenCalled();
    },
  );
  it.each([[], ['provider'], keys.slice(0, 3), ['unrelated']].map((fields) => ({ fields })))(
    'write fields $fields actual keys rejected',
    async ({ fields }) => {
      const f = fixture({ writeFields: fields });
      expect(await f.dispatch()).toEqual(error(403, 'forbidden', 'Field permission denied'));
      expect(f.signContract).not.toHaveBeenCalled();
    },
  );
  it('full grant/body key order different from parser order; nonenum/inherited known fields/unknown symbol', async () => {
    const f = fixture({ writeFields: keys }),
      body = Object.fromEntries(keys.toReversed().map((key) => [key, f.body[key]]));
    expect((await f.dispatch({ body })).statusCode).toBe(201);
    expect(Object.keys(f.signContract.mock.calls[0]?.[1] ?? {})).toEqual(keys);
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
      expect(f.signContract.mock.calls[0]?.[3].scopes).toBe(f.scopes);
      expect(f.signContract.mock.calls[0]?.[3].anchors).toBe(f.anchors);
    },
  );
  it('anchors missing uses fresh[] per request no added refusal', async () => {
    const f = fixture();
    Object.defineProperty(f.context, 'scopeAnchors', { value: undefined });
    await f.dispatch();
    await f.dispatch();
    expect(f.signContract.mock.calls[0]?.[3].anchors).toEqual([]);
    expect(f.signContract.mock.calls[0]?.[3].anchors).not.toBe(
      f.signContract.mock.calls[1]?.[3].anchors,
    );
  });
  it.each([
    { read: null, label: 'missing' },
    { read: { scopes: [], fields: null }, label: 'raw' },
    { read: { scopes: ['TEAM'], fields: [] }, label: 'id' },
    { read: { scopes: ['TEAM'], fields: ['payloadHash', 'status', 'nested'] }, label: 'finite' },
  ] as const)(
    'late M contract read $label independent of write capability',
    async ({ read, label }) => {
      const f = fixture({ read }),
        result = await f.dispatch();
      expect(result).toEqual(
        response(
          201,
          label === 'raw'
            ? returned
            : label === 'finite'
              ? { id, payloadHash: 'mock-payload-hash', status: 'SIGNED', nested }
              : { id },
        ),
      );
      if (label === 'raw') expect(result.body).toBe(returned);
      else expect(result.body).not.toBe(returned);
      if (label === 'finite') expect((result.body as JsonObject).nested).toBe(nested);
      expect(f.get.mock.calls.at(-1)).toEqual(['contract:read']);
    },
  );
  it('M fallback existing version only, revision is not version/no invented id', async () => {
    const f = fixture({ read: null });
    expect(await f.dispatch()).toEqual(response(201, { id }));
    f.signContract.mockResolvedValueOnce({ id, version: 3, revision: 1 });
    expect(await f.dispatch()).toEqual(response(201, { id, version: 3 }));
    f.signContract.mockResolvedValueOnce({ revision: 1 });
    expect(await f.dispatch()).toEqual(response(201, {}));
  });
  it.each([null, [], ['payloadHash']].map((fields) => ({ fields })))(
    'await read field change $fields affects M',
    async ({ fields }) => {
      const f = fixture();
      f.signContract.mockImplementationOnce(() => {
        f.permissions.set('contract:read', { scopes: [], fields });
        return Promise.resolve(returned);
      });
      expect(await f.dispatch()).toEqual(
        response(
          201,
          fields === null
            ? returned
            : fields.length
              ? { id, payloadHash: 'mock-payload-hash' }
              : { id },
        ),
      );
    },
  );
  it('await read deletion vs runtime undefined fields old500-C', async () => {
    const f = fixture();
    f.signContract.mockImplementationOnce(() => {
      f.permissions.delete('contract:read');
      return Promise.resolve(returned);
    });
    expect(await f.dispatch()).toEqual(response(201, { id }));
    const wrong = fixture();
    wrong.signContract.mockImplementationOnce(() => {
      Object.defineProperty(wrong.permissions.get('contract:read'), 'fields', { value: undefined });
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
    f.signContract.mockResolvedValueOnce(row);
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
  it('neighbor creation/credit/order first parser untouched', async () => {
    const f = fixture();
    for (const pathname of [
      '/api/v1/contracts',
      '/api/v1/credit-limits',
      '/api/v1/credit-decisions',
    ])
      expect(await f.dispatch({ pathname, body: {} })).toEqual(invalid('customerId is required'));
    expect(await f.dispatch({ pathname: '/api/v1/sales-orders', body: {} })).toEqual(
      invalid('lines must be an array'),
    );
    expect(f.signContract).not.toHaveBeenCalled();
  });
  it('all seven GET untouched by POST body/payload O', async () => {
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
    expect(f.signContract).not.toHaveBeenCalled();
  });
  it.each([
    ['not_found', 404],
    ['conflict', 409],
    ['forbidden', 403],
    ['invalid_request', 400],
  ] as const)('repository error %s/%i/C preserved', async (code, status) => {
    const f = fixture();
    f.signContract.mockRejectedValueOnce(new DomainError(code, 'signing rejected'));
    expect(await f.dispatch()).toEqual(error(status, code, 'signing rejected'));
  });
  it.each([
    'abc',
    '-',
    '00000000-0000-0000-0000-000000000000',
    id.replace('-4aaa-', '-0aaa-'),
    id.replace('-8aaa-', '-7aaa-'),
  ])('matched raw %s path UUID first', async (raw) => {
    const f = fixture({ denied: true });
    expect(
      await f.dispatch({
        pathname: '/api/v1/contracts/' + raw + '/sign',
        body: { provider: null },
      }),
    ).toEqual(invalid('contractRevisionId must be a UUID'));
    expect(f.get).not.toHaveBeenCalled();
    expect(f.signContract).not.toHaveBeenCalled();
  });
  it.each([id.toUpperCase(), '', ' ' + id, id + '%20', id + '/x'])(
    'unmatched raw %j',
    async (raw) => {
      const f = fixture({ denied: true });
      expect(
        await f.dispatch({ pathname: '/api/v1/contracts/' + raw + '/sign', body: {} }),
      ).toEqual(missing);
    },
  );
  it.each(['/', '\n', '\r', '?x=1', '/extra'])('sign suffix %j unmatched', async (suffix) => {
    const f = fixture();
    expect(await f.dispatch({ pathname: path + suffix, body: {} })).toEqual(missing);
  });
  it.each([1, 2, 3, 4, 5, 6, 7, 8])(
    'UUID version %i accepted by original raw then U',
    async (version) => {
      const f = fixture();
      const raw = id.replace('-4aaa-', '-' + String(version) + 'aaa-');
      expect(
        (await f.dispatch({ pathname: '/api/v1/contracts/' + raw + '/sign' })).statusCode,
      ).toBe(201);
      expect(f.signContract.mock.calls[0]?.[0]).toBe(raw);
    },
  );
  it.each(['8', '9', 'a', 'b'])('UUID variant %s accepted', async (variant) => {
    const f = fixture();
    const raw = id.replace('-8aaa-', '-' + variant + 'aaa-');
    expect((await f.dispatch({ pathname: '/api/v1/contracts/' + raw + '/sign' })).statusCode).toBe(
      201,
    );
    expect(f.signContract.mock.calls[0]?.[0]).toBe(raw);
  });
  it('allow before matched invalid UUID/method', async () => {
    const f = fixture();
    const getter = vi.fn(() => {
      throw new Error('not reached');
    });
    Object.defineProperty(f.repository, 'signContract', { get: getter });
    expect(
      await f.dispatch({ pathname: '/api/v1/contracts/abc/sign', body: { z: 1, a: 2 } }),
    ).toEqual(invalid('Unsupported fields: a, z'));
    expect(getter).not.toHaveBeenCalled();
  });
  it.each([
    { value: 'not-a-date', expected: null },
    { value: '2026-02-30', expected: '2026-03-02T00:00:00.000Z' },
    { value: '2020-01-01', expected: '2020-01-01T00:00:00.000Z' },
    { value: '2099-01-01', expected: '2099-01-01T00:00:00.000Z' },
    { value: ' 2026-02-28T08:00:00+08:00 ', expected: '2026-02-28T00:00:00.000Z' },
  ])('original signedAt $value', async ({ value, expected }) => {
    const f = fixture();
    const result = await f.dispatch({ body: { ...f.body, signedAt: value } });
    if (expected === null) expect(result).toEqual(invalid('signedAt must be a valid timestamp'));
    else {
      expect(result.statusCode).toBe(201);
      expect(f.signContract.mock.calls[0]?.[1].signedAt).toBe(expected);
    }
  });
  it.each(['provider', 'providerReceiptId'] as const)(
    'ordinary %s accepts arbitrary trim/no max',
    async (key) => {
      const f = fixture();
      for (const value of [' unknown/#合同 ', 'x'.repeat(4096)]) {
        expect((await f.dispatch({ body: { ...f.body, [key]: value } })).statusCode).toBe(201);
        expect(f.signContract.mock.calls.at(-1)?.[1][key]).toBe(value.trim());
      }
    },
  );
});
