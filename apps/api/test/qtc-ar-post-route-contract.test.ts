// Fixed against ec97801 inline AR posting; no future AR module imported.
import { describe, expect, it, vi } from 'vitest';
import { DomainError, type AuthorizationContext } from '@kingturf/domain';
import type { DataScope, JsonObject, PermissionKey } from '@kingturf/types';
import { buildApp, type ApiDependencies, type ApiRequest } from '../src/app.js';
type Qtc = NonNullable<ApiDependencies['quoteToCash']>;
type Method = Qtc['postAr'];
type Grant = NonNullable<ReturnType<AuthorizationContext['permissions']['get']>>;
const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const other = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const correlationId = '33333333-3333-4333-8333-333333333333';
const actor = { companyId: 'qtc-contract-mock', employeeId: id };
const nested = { keep: true };

const path = '/api/v1/ar-open-items';
const keys = [
  'customerId',
  'salesOrderId',
  'documentNumber',
  'documentType',
  'currency',
  'amount',
  'dueAt',
] as const;
const inputKeys = keys.filter((key) => key !== 'documentType');
const uuidKeys = ['customerId', 'salesOrderId'] as const;
const returned: JsonObject = {
  id,
  arDocumentId: other,
  remainingAmount: '3',
  customerId: id,
  salesOrderId: other,
  documentNumber: 'fixture #/AR',
  documentType: 'INVOICE',
  currency: 'USD',
  amount: '3',
  dueAt: '2026-02-28T00:00:00.000Z',
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
    ['ar:post', { scopes, fields: options.writeFields === undefined ? null : options.writeFields }],
  ]);
  if (options.denied) permissions.delete('ar:post');
  if (options.read !== null)
    permissions.set('ar:read', options.read ?? { scopes: ['TEAM'], fields: null });
  const context: AuthorizationContext = {
    actor,
    permissions,
    scopeAnchors: new Map([['ar:post', anchors]]),
  };
  const get = vi.spyOn(permissions, 'get');
  const postAr = vi.fn<Method>().mockResolvedValue(returned);
  const signContract = vi.fn<Qtc['signContract']>().mockResolvedValue({});
  const setCreditLimit = vi.fn<Qtc['setCreditLimit']>().mockResolvedValue({});
  const evaluateCredit = vi.fn<Qtc['evaluateCredit']>().mockResolvedValue({});
  const approveCredit = vi.fn<Qtc['approveCredit']>().mockResolvedValue({});
  const list = vi.fn<Qtc['list']>().mockResolvedValue([]);
  const listOperationalPage = vi
    .fn<Qtc['listOperationalPage']>()
    .mockResolvedValue({ items: [], nextCursor: null });
  const repository = {
    postAr,
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
    salesOrderId: other,
    documentNumber: ' fixture #/AR ',
    documentType: ' INVOICE ',
    currency: 'USD',
    amount: '3.00',
    dueAt: '2026-02-28T08:00:00+08:00',
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
    postAr,
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
describe('old one QTC AR posting POST', () => {
  it('four args/receiver/input keys/ref/fresh scope/201 raw M/no manufactured version', async () => {
    const f = fixture();
    const a = await f.dispatch(),
      b = await f.dispatch();
    expect(a).toEqual(response(201, returned));
    expect(b).toEqual(a);
    expect(a.body).toBe(returned);
    const args = f.postAr.mock.calls[0];
    expect(args).toEqual([
      {
        customerId: id,
        salesOrderId: other,
        documentNumber: 'fixture #/AR',
        documentType: 'INVOICE',
        currency: 'USD',
        amount: '3',
        dueAt: '2026-02-28T00:00:00.000Z',
      },
      ' raw key ',
      { actor, scopes: f.scopes, anchors: f.anchors },
      correlationId,
    ]);
    expect(args).toHaveLength(4);
    expect(f.postAr.mock.contexts[0]).toBe(f.repository);
    expect(Object.keys(args?.[0] ?? {})).toEqual(keys);
    expect(args?.[0]).not.toBe(f.body);
    expect(args?.[0]).not.toBe(f.postAr.mock.calls[1]?.[0]);
    expect(Object.keys(args?.[2] ?? {})).toEqual(['actor', 'scopes', 'anchors']);
    expect(args?.[2].actor).toBe(actor);
    expect(args?.[2].scopes).toBe(f.scopes);
    expect(args?.[2].anchors).toBe(f.anchors);
    expect(args?.[2]).not.toBe(f.postAr.mock.calls[1]?.[2]);
    expect(f.get.mock.calls).toEqual([
      ['ar:post'],
      ['ar:post'],
      ['ar:read'],
      ['ar:post'],
      ['ar:post'],
      ['ar:read'],
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
      expect(f.postAr).not.toHaveBeenCalled();
    },
  );
  it('allow unknown keys sort before method/field getters/key/cap', async () => {
    const f = fixture({ denied: true }),
      getter = vi.fn(() => {
        throw new Error('not reached');
      });
    Object.defineProperty(f.repository, 'postAr', { get: getter });
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
      [undefined, null, '', ' ', 0, false, 1, true, [], () => 'invalid input']
        .filter((value) => !(key === 'salesOrderId' && value === null))
        .map((value) => ({
          value,
        })),
    )('field ' + key + ' $value rejects before key/write cap', async ({ value }) => {
      const f = fixture({ denied: true });
      expect(
        await f.dispatch({
          body: { ...f.body, [key]: value },
          headers: { ...f.headers, 'idempotency-key': '' },
        }),
      ).toEqual(invalid(key + ' is required'));
      expect(f.get).not.toHaveBeenCalled();
      expect(f.postAr).not.toHaveBeenCalled();
    });
    it('missing ' + key + ' error/no implicit optional field', async () => {
      const f = fixture(),
        body = { ...f.body };
      Reflect.deleteProperty(body, key);
      expect(await f.dispatch({ body })).toEqual(invalid(key + ' is required'));
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
      expect(f.postAr.mock.calls[0]?.[0]).toMatchObject({ [key]: value });
    });
  }
  it.each([' number/#?合同 ', '\nnumber\t', 'x'.repeat(4096)])(
    'documentNumber %j ordinary trim string/no stablecode/max',
    async (documentNumber) => {
      const f = fixture();
      expect((await f.dispatch({ body: { ...f.body, documentNumber } })).statusCode).toBe(201);
      expect(f.postAr.mock.calls[0]?.[0].documentNumber).toBe(documentNumber.trim());
    },
  );
  it('actor changing method after capture cannot replace callee', async () => {
    const f = fixture(),
      replacement = vi.fn<Method>().mockResolvedValue({});
    Object.defineProperty(f.context, 'actor', {
      get: () => {
        f.repository.postAr = replacement;
        return actor;
      },
    });
    expect((await f.dispatch()).statusCode).toBe(201);
    expect(f.postAr).toHaveBeenCalledOnce();
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
    expect(f.postAr.mock.calls[0]?.[1]).toBe(key);
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
      expect(f.postAr).not.toHaveBeenCalled();
    },
  );
  it.each([[], ['customerId'], keys.slice(0, 5), ['unrelated']].map((fields) => ({ fields })))(
    'write fields $fields actual keys rejected',
    async ({ fields }) => {
      const f = fixture({ writeFields: fields });
      expect(await f.dispatch()).toEqual(error(403, 'forbidden', 'Field permission denied'));
      expect(f.postAr).not.toHaveBeenCalled();
    },
  );
  it('full grant/body key order different from parser order; nonenum/inherited known fields/unknown symbol', async () => {
    const f = fixture({ writeFields: keys }),
      body = Object.fromEntries(keys.toReversed().map((key) => [key, f.body[key]]));
    expect((await f.dispatch({ body })).statusCode).toBe(201);
    expect(Object.keys(f.postAr.mock.calls[0]?.[0] ?? {})).toEqual(keys);
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
      expect(f.postAr.mock.calls[0]?.[2].scopes).toBe(f.scopes);
      expect(f.postAr.mock.calls[0]?.[2].anchors).toBe(f.anchors);
    },
  );
  it('anchors missing uses fresh[] per request no added refusal', async () => {
    const f = fixture();
    Object.defineProperty(f.context, 'scopeAnchors', { value: undefined });
    await f.dispatch();
    await f.dispatch();
    expect(f.postAr.mock.calls[0]?.[2].anchors).toEqual([]);
    expect(f.postAr.mock.calls[0]?.[2].anchors).not.toBe(f.postAr.mock.calls[1]?.[2].anchors);
  });
  it.each([
    { read: null, label: 'missing' },
    { read: { scopes: [], fields: null }, label: 'raw' },
    { read: { scopes: ['TEAM'], fields: [] }, label: 'id' },
    { read: { scopes: ['TEAM'], fields: ['amount', 'documentType', 'nested'] }, label: 'finite' },
  ] as const)('late M AR read $label independent of write capability', async ({ read, label }) => {
    const f = fixture({ read }),
      result = await f.dispatch();
    expect(result).toEqual(
      response(
        201,
        label === 'raw'
          ? returned
          : label === 'finite'
            ? { id, amount: '3', documentType: 'INVOICE', nested }
            : { id },
      ),
    );
    if (label === 'raw') expect(result.body).toBe(returned);
    else expect(result.body).not.toBe(returned);
    if (label === 'finite') expect((result.body as JsonObject).nested).toBe(nested);
    expect(f.get.mock.calls.at(-1)).toEqual(['ar:read']);
  });
  it('M fallback existing synthetic version only, remainingAmount is not version/no invented id', async () => {
    const f = fixture({ read: null });
    expect(await f.dispatch()).toEqual(response(201, { id }));
    f.postAr.mockResolvedValueOnce({ id, version: 3, remainingAmount: '3' });
    expect(await f.dispatch()).toEqual(response(201, { id, version: 3 }));
    f.postAr.mockResolvedValueOnce({ remainingAmount: '3' });
    expect(await f.dispatch()).toEqual(response(201, {}));
  });
  it.each([null, [], ['amount']].map((fields) => ({ fields })))(
    'await read field change $fields affects M',
    async ({ fields }) => {
      const f = fixture();
      f.postAr.mockImplementationOnce(() => {
        f.permissions.set('ar:read', { scopes: [], fields });
        return Promise.resolve(returned);
      });
      expect(await f.dispatch()).toEqual(
        response(201, fields === null ? returned : fields.length ? { id, amount: '3' } : { id }),
      );
    },
  );
  it('await read deletion vs runtime undefined fields old500-C', async () => {
    const f = fixture();
    f.postAr.mockImplementationOnce(() => {
      f.permissions.delete('ar:read');
      return Promise.resolve(returned);
    });
    expect(await f.dispatch()).toEqual(response(201, { id }));
    const wrong = fixture();
    wrong.postAr.mockImplementationOnce(() => {
      Object.defineProperty(wrong.permissions.get('ar:read'), 'fields', { value: undefined });
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
    f.postAr.mockResolvedValueOnce(row);
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
  it('prior writes/sign/order and neighbor payment parser unchanged', async () => {
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
    expect(await f.dispatch({ pathname: '/api/v1/bank-payments', body: {} })).toEqual(
      invalid('customerId is required'),
    );
    expect(f.postAr).not.toHaveBeenCalled();
  });
  it('all seven GET untouched by POST body/AR O', async () => {
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
    expect(f.postAr).not.toHaveBeenCalled();
  });
  it.each([
    ['not_found', 404],
    ['conflict', 409],
    ['forbidden', 403],
    ['invalid_request', 400],
  ] as const)('repository error %s/%i/C preserved', async (code, status) => {
    const f = fixture();
    f.postAr.mockRejectedValueOnce(new DomainError(code, 'AR rejected'));
    expect(await f.dispatch()).toEqual(error(status, code, 'AR rejected'));
  });
  it.each(['INVOICE', 'CREDIT_NOTE'] as const)(
    'one canonical enum %s trim/cached dt',
    async (type) => {
      const f = fixture();
      const getter = vi.fn(() => {
        Object.defineProperty(f.body, 'documentType', { value: 'OTHER' });
        return ' ' + type + ' ';
      });
      Object.defineProperty(f.body, 'documentType', {
        enumerable: true,
        configurable: true,
        get: getter,
      });
      expect((await f.dispatch()).statusCode).toBe(201);
      expect(getter).toHaveBeenCalledOnce();
      expect(f.postAr.mock.calls[0]?.[0].documentType).toBe(type);
    },
  );
  it.each(['invoice', 'CREDIT', 'DRAFT', 'OTHER'])(
    'unsupported dt %s before root-method/top/key/cap',
    async (documentType) => {
      const f = fixture({ denied: true });
      const root = vi.fn(() => f.repository),
        method = vi.fn(() => f.postAr),
        value = vi.fn(() => {
          throw new Error('not reached');
        });
      Object.defineProperty(f.dependencies, 'quoteToCash', { get: root });
      Object.defineProperty(f.repository, 'postAr', { get: method });
      const body = Object.defineProperty({ ...f.body, documentType }, 'customerId', {
        enumerable: true,
        get: value,
      });
      expect(await f.dispatch({ body, headers: { ...f.headers, 'idempotency-key': '' } })).toEqual(
        invalid('documentType is unsupported'),
      );
      expect(root).toHaveBeenCalledTimes(1);
      expect(method).not.toHaveBeenCalled();
      expect(value).not.toHaveBeenCalled();
      expect(f.get).not.toHaveBeenCalled();
    },
  );
  it('enum string error before all other fields/method', async () => {
    const f = fixture();
    const method = vi.fn(() => f.postAr);
    Object.defineProperty(f.repository, 'postAr', { get: method });
    expect(
      await f.dispatch({
        body: {
          customerId: null,
          salesOrderId: null,
          documentType: null,
          currency: null,
          amount: null,
          dueAt: null,
        },
      }),
    ).toEqual(invalid('documentType is required'));
    expect(method).not.toHaveBeenCalled();
  });
  it('salesOrderId null one read vs nonnull two, no nullish optional', async () => {
    const f = fixture();
    const nullGetter = vi.fn(() => null);
    Object.defineProperty(f.body, 'salesOrderId', {
      enumerable: true,
      configurable: true,
      get: nullGetter,
    });
    expect((await f.dispatch()).statusCode).toBe(201);
    expect(nullGetter).toHaveBeenCalledOnce();
    expect(f.postAr.mock.calls[0]?.[0].salesOrderId).toBeNull();
    const getter = vi.fn(() => other);
    Object.defineProperty(f.body, 'salesOrderId', { enumerable: true, get: getter });
    expect((await f.dispatch()).statusCode).toBe(201);
    expect(getter).toHaveBeenCalledTimes(2);
    expect(f.postAr.mock.calls[1]?.[0].salesOrderId).toBe(other);
  });
  it.each([
    { first: undefined, second: other, expected: other },
    { first: 'bad', second: other, expected: other },
    { first: other, second: id.toUpperCase(), expected: id.toUpperCase() },
    { first: null, second: 'bad', expected: null },
  ])(
    'salesOrderId changing getter $first / $second accepted second-or-null only',
    async ({ first, second, expected }) => {
      const f = fixture();
      let reads = 0;
      Object.defineProperty(f.body, 'salesOrderId', {
        enumerable: true,
        get: () => (reads++ === 0 ? first : second),
      });
      expect((await f.dispatch()).statusCode).toBe(201);
      expect(reads).toBe(first === null ? 1 : 2);
      expect(f.postAr.mock.calls[0]?.[0].salesOrderId).toBe(expected);
    },
  );
  it.each([
    { second: null, message: 'salesOrderId is required' },
    { second: undefined, message: 'salesOrderId is required' },
    { second: 'bad', message: 'salesOrderId must be a UUID' },
    { second: '', message: 'salesOrderId is required' },
  ])(
    'salesOrderId second read $second determines error before rest/key/cap',
    async ({ second, message }) => {
      const f = fixture({ denied: true });
      let reads = 0;
      const getter = vi.fn(() => {
        throw new Error('later field not read');
      });
      const body = Object.defineProperty({ ...f.body }, 'salesOrderId', {
        enumerable: true,
        get: () => (reads++ === 0 ? other : second),
      });
      Object.defineProperty(body, 'documentNumber', { enumerable: true, get: getter });
      expect(await f.dispatch({ body })).toEqual(invalid(message));
      expect(reads).toBe(2);
      expect(getter).not.toHaveBeenCalled();
      expect(f.get).not.toHaveBeenCalled();
    },
  );
  it('nonnull salesOrderId deleting own key makes second read undefined; null deleting key still parses', async () => {
    const f = fixture();
    Object.defineProperty(f.body, 'salesOrderId', {
      enumerable: true,
      configurable: true,
      get: () => {
        Reflect.deleteProperty(f.body, 'salesOrderId');
        return other;
      },
    });
    expect(await f.dispatch()).toEqual(invalid('salesOrderId is required'));
    const g = fixture({ writeFields: keys.filter((k) => k !== 'salesOrderId') });
    Object.defineProperty(g.body, 'salesOrderId', {
      enumerable: true,
      configurable: true,
      get: () => {
        Reflect.deleteProperty(g.body, 'salesOrderId');
        return null;
      },
    });
    expect((await g.dispatch()).statusCode).toBe(201);
    expect(g.postAr.mock.calls[0]?.[0].salesOrderId).toBeNull();
  });
  it('multi-invalid input order after dt/method', async () => {
    const f = fixture();
    for (let i = 0; i < inputKeys.length; i++) {
      const body = { ...f.body };
      for (const key of inputKeys.slice(i)) body[key] = undefined;
      const key = inputKeys[i] ?? 'customerId';
      expect(await f.dispatch({ body })).toEqual(invalid(key + ' is required'));
    }
  });
  it.each([
    { value: '-1', message: 'amount must be non-negative' },
    { value: '01', message: 'Invalid decimal' },
    { value: '1e2', message: 'Invalid decimal' },
    { value: '+1', message: 'Invalid decimal' },
    { value: '.1', message: 'Invalid decimal' },
    { value: '0.0000001', message: 'Invalid decimal' },
    { value: '1000000000000000000', message: 'Invalid decimal' },
  ])('amount $value original D error', async ({ value, message }) => {
    const f = fixture({ denied: true });
    expect(await f.dispatch({ body: { ...f.body, amount: value } })).toEqual(invalid(message));
    expect(f.get).not.toHaveBeenCalled();
  });
  it.each([
    { value: '0', expected: '0' },
    { value: '-0.000000', expected: '0' },
    { value: ' 3.000000 ', expected: '3' },
    { value: '999999999999999999.999999', expected: '999999999999999999.999999' },
  ])(
    'amount $value HTTP nonnegative only not DB positivity guarantee',
    async ({ value, expected }) => {
      const f = fixture();
      expect((await f.dispatch({ body: { ...f.body, amount: value } })).statusCode).toBe(201);
      expect(f.postAr.mock.calls[0]?.[0].amount).toBe(expected);
    },
  );
  it.each(['usd', 'zZz', 'US', 'USDD', '1SD'])('currency %s uppercase-only', async (currency) => {
    const f = fixture();
    expect(await f.dispatch({ body: { ...f.body, currency } })).toEqual(
      invalid('Currency must be ISO 4217 uppercase'),
    );
  });
  it('currency ZZZ trim shape only not DB catalog', async () => {
    const f = fixture();
    expect((await f.dispatch({ body: { ...f.body, currency: ' ZZZ ' } })).statusCode).toBe(201);
    expect(f.postAr.mock.calls[0]?.[0].currency).toBe('ZZZ');
  });
  it.each([
    { value: 'bad', expected: null },
    { value: '2026-02-30', expected: '2026-03-02T00:00:00.000Z' },
    { value: '2020-01-01', expected: '2020-01-01T00:00:00.000Z' },
    { value: '2099-01-01', expected: '2099-01-01T00:00:00.000Z' },
    { value: ' 2026-02-28T08:00:00+08:00 ', expected: '2026-02-28T00:00:00.000Z' },
  ])('dueAt $value oldDate overflow/no temporal rules', async ({ value, expected }) => {
    const f = fixture();
    const r = await f.dispatch({ body: { ...f.body, dueAt: value } });
    if (expected === null) expect(r).toEqual(invalid('dueAt must be a valid timestamp'));
    else {
      expect(r.statusCode).toBe(201);
      expect(f.postAr.mock.calls[0]?.[0].dueAt).toBe(expected);
    }
  });
  it.each(keys)('field %s mutates method; dt beforecapture others after', async (key) => {
    const f = fixture();
    const replacement = vi.fn<Method>().mockResolvedValue(returned);
    const value = f.body[key];
    const getter = vi.fn(() => {
      f.repository.postAr = replacement;
      return value;
    });
    Object.defineProperty(f.body, key, { enumerable: true, get: getter });
    expect((await f.dispatch()).statusCode).toBe(201);
    expect(getter).toHaveBeenCalledTimes(key === 'salesOrderId' ? 2 : 1);
    if (key === 'documentType') {
      expect(replacement).toHaveBeenCalledOnce();
      expect(f.postAr).not.toHaveBeenCalled();
    } else {
      expect(f.postAr).toHaveBeenCalledOnce();
      expect(replacement).not.toHaveBeenCalled();
    }
  });
  it.each(keys)('getter deletes own %s changes late requested topkeys', async (key) => {
    const f = fixture({ writeFields: keys.filter((k) => k !== key) });
    const value = key === 'salesOrderId' ? null : f.body[key];
    const getter = vi.fn(() => {
      Reflect.deleteProperty(f.body, key);
      return value;
    });
    Object.defineProperty(f.body, key, { enumerable: true, configurable: true, get: getter });
    expect((await f.dispatch()).statusCode).toBe(201);
    expect(getter).toHaveBeenCalledOnce();
    expect(f.postAr).toHaveBeenCalledOnce();
  });
  it('dt getter replaces whole root before capture; root getter read twice', async () => {
    const f = fixture();
    const replacement = vi.fn<Method>().mockResolvedValue(returned);
    const repo = { postAr: replacement };
    let selected: unknown = f.repository;
    const root = vi.fn(() => selected);
    Object.defineProperty(f.dependencies, 'quoteToCash', { get: root });
    Object.defineProperty(f.body, 'documentType', {
      enumerable: true,
      get: () => {
        selected = repo;
        return 'INVOICE';
      },
    });
    expect((await f.dispatch()).statusCode).toBe(201);
    expect(root).toHaveBeenCalledTimes(2);
    expect(replacement).toHaveBeenCalledOnce();
    expect(replacement.mock.contexts[0]).toBe(repo);
    expect(f.postAr).not.toHaveBeenCalled();
  });
  it.each(['method', 'customerId', 'actor'] as const)(
    'root replacement at %s cannot replace already captured receiver',
    async (phase) => {
      const f = fixture();
      const replacement = vi.fn<Method>().mockResolvedValue({}),
        repo = { postAr: replacement };
      const swap = () => {
        Reflect.set(f.dependencies, 'quoteToCash', repo);
      };
      if (phase === 'method')
        Object.defineProperty(f.repository, 'postAr', {
          get: () => {
            swap();
            return f.postAr;
          },
        });
      else if (phase === 'actor')
        Object.defineProperty(f.context, 'actor', {
          get: () => {
            swap();
            return actor;
          },
        });
      else
        Object.defineProperty(f.body, 'customerId', {
          enumerable: true,
          get: () => {
            swap();
            return id;
          },
        });
      expect((await f.dispatch()).statusCode).toBe(201);
      expect(f.postAr).toHaveBeenCalledOnce();
      expect(f.postAr.mock.contexts[0]).toBe(f.repository);
      expect(replacement).not.toHaveBeenCalled();
    },
  );
  it('trace header-auth/allow/dt/rootmethod/U/salesOrder double/S/cachedDt/CurDTime/key/livectx/actor/call/lateM', async () => {
    const f = fixture();
    const events: string[] = [];
    const body = new Proxy(f.body, {
      ownKeys: (t) => {
        events.push('keys');
        return Reflect.ownKeys(t);
      },
      get: (t, k, r) => {
        if (typeof k === 'string') events.push(k);
        return Reflect.get(t, k, r) as unknown;
      },
    });
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
    Object.defineProperty(f.repository, 'postAr', {
      get: () => {
        events.push('method');
        return f.postAr;
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
    f.postAr.mockImplementationOnce(() => {
      events.push('call');
      return Promise.resolve(returned);
    });
    expect((await f.dispatch({ body, headers })).statusCode).toBe(201);
    expect(events).toEqual([
      'header',
      'auth',
      'keys',
      'documentType',
      'method',
      'customerId',
      'salesOrderId',
      'salesOrderId',
      'documentNumber',
      'currency',
      'amount',
      'dueAt',
      'keys',
      'ar:post',
      'ar:post',
      'actor',
      'call',
      'ar:read',
    ]);
  });
});
