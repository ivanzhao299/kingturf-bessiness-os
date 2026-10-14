// Fixed against ba5d8a8 inline contract creation; no future create module imported.
import { describe, expect, it, vi } from 'vitest';
import { DomainError, type AuthorizationContext } from '@kingturf/domain';
import type { DataScope, JsonObject, PermissionKey } from '@kingturf/types';
import { buildApp, type ApiDependencies, type ApiRequest } from '../src/app.js';
type Qtc = NonNullable<ApiDependencies['quoteToCash']>;
type Method = Qtc['createContract'];
type Grant = NonNullable<ReturnType<AuthorizationContext['permissions']['get']>>;
const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const other = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const correlationId = '33333333-3333-4333-8333-333333333333';
const actor = { companyId: 'qtc-contract-mock', employeeId: id };
const nested = { keep: true };
const content = { nested, paragraphs: ['fixture'], nullable: null };
const path = '/api/v1/contracts';
const keys = [
  'customerId',
  'opportunityId',
  'contractNumber',
  'quoteRevisionId',
  'quoteSnapshotId',
  'content',
] as const;
const uuidKeys = ['customerId', 'opportunityId', 'quoteRevisionId', 'quoteSnapshotId'] as const;
const returned: JsonObject = {
  id,
  contractId: other,
  revision: 1,
  status: 'DRAFT',
  contentHash: 'mock-content-hash',
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
      'contract:revise',
      { scopes, fields: options.writeFields === undefined ? null : options.writeFields },
    ],
  ]);
  if (options.denied) permissions.delete('contract:revise');
  if (options.read !== null)
    permissions.set('contract:read', options.read ?? { scopes: ['TEAM'], fields: null });
  const context: AuthorizationContext = {
    actor,
    permissions,
    scopeAnchors: new Map([['contract:revise', anchors]]),
  };
  const get = vi.spyOn(permissions, 'get');
  const createContract = vi.fn<Method>().mockResolvedValue(returned);
  const signContract = vi.fn<Qtc['signContract']>().mockResolvedValue({});
  const setCreditLimit = vi.fn<Qtc['setCreditLimit']>().mockResolvedValue({});
  const evaluateCredit = vi.fn<Qtc['evaluateCredit']>().mockResolvedValue({});
  const approveCredit = vi.fn<Qtc['approveCredit']>().mockResolvedValue({});
  const list = vi.fn<Qtc['list']>().mockResolvedValue([]);
  const listOperationalPage = vi
    .fn<Qtc['listOperationalPage']>()
    .mockResolvedValue({ items: [], nextCursor: null });
  const repository = {
    createContract,
    signContract,
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
    customerId: id,
    opportunityId: other,
    contractNumber: ' fixture #/合同 ',
    quoteRevisionId: id,
    quoteSnapshotId: other,
    content,
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
    createContract,
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
describe('old one QTC contract create POST', () => {
  it('four args/receiver/input keys/ref/fresh scope/201 raw M/no manufactured version', async () => {
    const f = fixture();
    const a = await f.dispatch(),
      b = await f.dispatch();
    expect(a).toEqual(response(201, returned));
    expect(b).toEqual(a);
    expect(a.body).toBe(returned);
    const args = f.createContract.mock.calls[0];
    expect(args).toEqual([
      {
        customerId: id,
        opportunityId: other,
        contractNumber: 'fixture #/合同',
        quoteRevisionId: id,
        quoteSnapshotId: other,
        content,
      },
      ' raw key ',
      { actor, scopes: f.scopes, anchors: f.anchors },
      correlationId,
    ]);
    expect(args).toHaveLength(4);
    expect(f.createContract.mock.contexts[0]).toBe(f.repository);
    expect(Object.keys(args?.[0] ?? {})).toEqual(keys);
    expect(args?.[0].content).toBe(content);
    expect(args?.[0].content.nested).toBe(nested);
    expect(args?.[0]).not.toBe(f.body);
    expect(args?.[0]).not.toBe(f.createContract.mock.calls[1]?.[0]);
    expect(Object.keys(args?.[2] ?? {})).toEqual(['actor', 'scopes', 'anchors']);
    expect(args?.[2].actor).toBe(actor);
    expect(args?.[2].scopes).toBe(f.scopes);
    expect(args?.[2].anchors).toBe(f.anchors);
    expect(args?.[2]).not.toBe(f.createContract.mock.calls[1]?.[2]);
    expect(f.get.mock.calls).toEqual([
      ['contract:revise'],
      ['contract:revise'],
      ['contract:read'],
      ['contract:revise'],
      ['contract:revise'],
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
      expect(f.createContract).not.toHaveBeenCalled();
    },
  );
  it('allow unknown keys sort before method/field getters/key/cap', async () => {
    const f = fixture({ denied: true }),
      getter = vi.fn(() => {
        throw new Error('not reached');
      });
    Object.defineProperty(f.repository, 'createContract', { get: getter });
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
        invalid(key === 'content' ? 'content must be a JSON object' : key + ' is required'),
      );
      expect(f.get).not.toHaveBeenCalled();
      expect(f.createContract).not.toHaveBeenCalled();
    });
    it('missing ' + key + ' error/no content default', async () => {
      const f = fixture(),
        body = { ...f.body };
      Reflect.deleteProperty(body, key);
      expect(await f.dispatch({ body })).toEqual(
        invalid(key === 'content' ? 'content must be a JSON object' : key + ' is required'),
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
      expect(f.createContract.mock.calls[0]?.[0]).toMatchObject({ [key]: value });
    });
  }
  it.each([' number/#?合同 ', '\nnumber\t', 'x'.repeat(4096)])(
    'contractNumber %j ordinary trim string/no stablecode/max',
    async (contractNumber) => {
      const f = fixture();
      expect((await f.dispatch({ body: { ...f.body, contractNumber } })).statusCode).toBe(201);
      expect(f.createContract.mock.calls[0]?.[0].contractNumber).toBe(contractNumber.trim());
    },
  );
  const cyclic: Record<string, unknown> = {};
  cyclic.self = cyclic;
  it.each([
    { name: 'empty', value: {} },
    { name: 'nested', value: content },
    { name: 'date', value: new Date('2026-01-01') },
    { name: 'boxed-number', value: Object(7) as object },
    { name: 'null-prototype', value: Object.create(null) as object },
    {
      name: 'nested-nonJSON',
      value: { nested: { fn: () => 'not inspected', big: 1n, missing: undefined } },
    },
    { name: 'cyclic', value: cyclic },
  ])('shallow content $name accepted/ref only not PG/transport persistence', async ({ value }) => {
    const f = fixture();
    expect((await f.dispatch({ body: { ...f.body, content: value } })).statusCode).toBe(201);
    expect(f.createContract.mock.calls[0]?.[0].content).toBe(value);
  });
  it('content inner getter not read by HTTP/parsers, content reference and nested untouched', async () => {
    const f = fixture(),
      getter = vi.fn(() => {
        throw new Error('inner must not read');
      });
    const value = Object.defineProperty({ nested }, 'inner', { enumerable: true, get: getter });
    expect((await f.dispatch({ body: { ...f.body, content: value } })).statusCode).toBe(201);
    expect(getter).not.toHaveBeenCalled();
    expect(f.createContract.mock.calls[0]?.[0].content === value).toBe(true);
    expect(f.createContract.mock.calls[0]?.[0].content.nested === nested).toBe(true);
  });
  it('all multi-invalid first errors in original field order; content error before header', async () => {
    const f = fixture({ denied: true });
    for (let index = 0; index < keys.length; index++) {
      const body = { ...f.body };
      for (const key of keys.slice(index)) body[key] = null;
      const key = keys[index] ?? 'customerId';
      expect(await f.dispatch({ body, headers: { ...f.headers, 'idempotency-key': '' } })).toEqual(
        invalid(key === 'content' ? 'content must be a JSON object' : key + ' is required'),
      );
    }
  });
  it('method captured after allow before first parser, actor not reached for invalid input', async () => {
    const f = fixture(),
      events: string[] = [];
    Object.defineProperty(f.repository, 'createContract', {
      get: () => {
        events.push('method');
        return f.createContract;
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
        f.repository.createContract = replacement;
        return value;
      });
      Object.defineProperty(f.body, key, { enumerable: true, get: getter });
      expect((await f.dispatch()).statusCode).toBe(201);
      expect(getter).toHaveBeenCalledOnce();
      expect(f.createContract).toHaveBeenCalledOnce();
      expect(replacement).not.toHaveBeenCalled();
      expect(f.createContract.mock.contexts[0]).toBe(f.repository);
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
    expect(f.createContract.mock.calls[0]?.[0]).toMatchObject({
      [key]: key === 'contractNumber' ? 'fixture #/合同' : value,
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
    Object.defineProperty(f.repository, 'createContract', {
      get: () => {
        events.push('method');
        return f.createContract;
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
    f.createContract.mockImplementationOnce(() => {
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
      'contract:revise',
      'contract:revise',
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
        f.repository.createContract = replacement;
        return actor;
      },
    });
    expect((await f.dispatch()).statusCode).toBe(201);
    expect(f.createContract).toHaveBeenCalledOnce();
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
    expect(f.createContract.mock.calls[0]?.[1]).toBe(key);
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
      expect(f.createContract).not.toHaveBeenCalled();
    },
  );
  it.each([[], ['customerId'], keys.slice(0, 5), ['unrelated']].map((fields) => ({ fields })))(
    'write fields $fields actual keys rejected',
    async ({ fields }) => {
      const f = fixture({ writeFields: fields });
      expect(await f.dispatch()).toEqual(error(403, 'forbidden', 'Field permission denied'));
      expect(f.createContract).not.toHaveBeenCalled();
    },
  );
  it('full grant/body key order different from parser order; nonenum/inherited known fields/unknown symbol', async () => {
    const f = fixture({ writeFields: keys }),
      body = Object.fromEntries(keys.toReversed().map((key) => [key, f.body[key]]));
    expect((await f.dispatch({ body })).statusCode).toBe(201);
    expect(Object.keys(f.createContract.mock.calls[0]?.[0] ?? {})).toEqual(keys);
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
      expect(f.createContract.mock.calls[0]?.[2].scopes).toBe(f.scopes);
      expect(f.createContract.mock.calls[0]?.[2].anchors).toBe(f.anchors);
    },
  );
  it('anchors missing uses fresh[] per request no added refusal', async () => {
    const f = fixture();
    Object.defineProperty(f.context, 'scopeAnchors', { value: undefined });
    await f.dispatch();
    await f.dispatch();
    expect(f.createContract.mock.calls[0]?.[2].anchors).toEqual([]);
    expect(f.createContract.mock.calls[0]?.[2].anchors).not.toBe(
      f.createContract.mock.calls[1]?.[2].anchors,
    );
  });
  it.each([
    { read: null, label: 'missing' },
    { read: { scopes: [], fields: null }, label: 'raw' },
    { read: { scopes: ['TEAM'], fields: [] }, label: 'id' },
    { read: { scopes: ['TEAM'], fields: ['revision', 'status', 'nested'] }, label: 'finite' },
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
              ? { id, revision: 1, status: 'DRAFT', nested }
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
    f.createContract.mockResolvedValueOnce({ id, version: 3, revision: 1 });
    expect(await f.dispatch()).toEqual(response(201, { id, version: 3 }));
    f.createContract.mockResolvedValueOnce({ revision: 1 });
    expect(await f.dispatch()).toEqual(response(201, {}));
  });
  it.each([null, [], ['revision']].map((fields) => ({ fields })))(
    'await read field change $fields affects M',
    async ({ fields }) => {
      const f = fixture();
      f.createContract.mockImplementationOnce(() => {
        f.permissions.set('contract:read', { scopes: [], fields });
        return Promise.resolve(returned);
      });
      expect(await f.dispatch()).toEqual(
        response(201, fields === null ? returned : fields.length ? { id, revision: 1 } : { id }),
      );
    },
  );
  it('await read deletion vs runtime undefined fields old500-C', async () => {
    const f = fixture();
    f.createContract.mockImplementationOnce(() => {
      f.permissions.delete('contract:read');
      return Promise.resolve(returned);
    });
    expect(await f.dispatch()).toEqual(response(201, { id }));
    const wrong = fixture();
    wrong.createContract.mockImplementationOnce(() => {
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
    f.createContract.mockResolvedValueOnce(row);
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
  it('neighbor sign parser separate and exactrawid, preceding credit writes unchanged', async () => {
    const f = fixture();
    expect(await f.dispatch({ pathname: path + '/' + id + '/sign', body: {} })).toEqual(
      invalid('provider is required'),
    );
    expect(await f.dispatch({ pathname: path + '/abc/sign', body: {} })).toEqual(
      invalid('contractRevisionId must be a UUID'),
    );
    for (const pathname of ['/api/v1/credit-limits', '/api/v1/credit-decisions'])
      expect(await f.dispatch({ pathname, body: {} })).toEqual(invalid('customerId is required'));
    expect(
      await f.dispatch({
        pathname: '/api/v1/credit-decisions/' + id + '/approve',
        body: { decision: 'OTHER', reason: 'fixture' },
      }),
    ).toEqual(invalid('decision is unsupported'));
    expect(f.createContract).not.toHaveBeenCalled();
    expect(f.signContract).not.toHaveBeenCalled();
    expect(f.approveCredit).not.toHaveBeenCalled();
  });
  it('all seven GET untouched by POST body/content O', async () => {
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
    expect(f.createContract).not.toHaveBeenCalled();
  });
  it.each([
    ['not_found', 404],
    ['conflict', 409],
    ['forbidden', 403],
    ['invalid_request', 400],
  ] as const)('repository error %s/%i/C preserved', async (code, status) => {
    const f = fixture();
    f.createContract.mockRejectedValueOnce(new DomainError(code, 'contract rejected'));
    expect(await f.dispatch()).toEqual(error(status, code, 'contract rejected'));
  });
});
