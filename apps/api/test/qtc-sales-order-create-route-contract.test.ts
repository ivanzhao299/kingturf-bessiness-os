// Fixed against cb27579 inline sales-order creation; no future order module imported.
import { describe, expect, it, vi } from 'vitest';
import { DomainError, type AuthorizationContext } from '@kingturf/domain';
import type { DataScope, JsonObject, PermissionKey } from '@kingturf/types';
import { buildApp, type ApiDependencies, type ApiRequest } from '../src/app.js';
type Qtc = NonNullable<ApiDependencies['quoteToCash']>;
type Method = Qtc['createOrder'];
type Grant = NonNullable<ReturnType<AuthorizationContext['permissions']['get']>>;
const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const other = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const correlationId = '33333333-3333-4333-8333-333333333333';
const actor = { companyId: 'qtc-contract-mock', employeeId: id };
const nested = { keep: true };
const rawLine = {
  description: ' turf /草坪 ',
  quantity: '1.00',
  unitPrice: '2.000',
  total: '3.00',
};
const rawLines = [rawLine];
const parsedLine = { description: 'turf /草坪', quantity: '1', unitPrice: '2', total: '3' };
const path = '/api/v1/sales-orders';
const keys = [
  'customerId',
  'opportunityId',
  'orderNumber',
  'quoteRevisionId',
  'quoteSnapshotId',
  'creditDecisionId',
  'contractRevisionId',
  'signatureEvidenceId',
  'currency',
  'total',
  'lines',
] as const;
const uuidKeys = [
  'customerId',
  'opportunityId',
  'quoteRevisionId',
  'quoteSnapshotId',
  'creditDecisionId',
  'contractRevisionId',
  'signatureEvidenceId',
] as const;
const inputKeys = keys.filter((key) => key !== 'total' && key !== 'lines');
const lineKeys = ['description', 'quantity', 'unitPrice', 'total'] as const;
const returned: JsonObject = {
  id,
  status: 'RELEASED',
  total: '3',
  lines: [parsedLine],
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
      'sales-order:create',
      { scopes, fields: options.writeFields === undefined ? null : options.writeFields },
    ],
  ]);
  if (options.denied) permissions.delete('sales-order:create');
  if (options.read !== null)
    permissions.set('sales-order:read', options.read ?? { scopes: ['TEAM'], fields: null });
  const context: AuthorizationContext = {
    actor,
    permissions,
    scopeAnchors: new Map([['sales-order:create', anchors]]),
  };
  const get = vi.spyOn(permissions, 'get');
  const createOrder = vi.fn<Method>().mockResolvedValue(returned);
  const signContract = vi.fn<Qtc['signContract']>().mockResolvedValue({});
  const setCreditLimit = vi.fn<Qtc['setCreditLimit']>().mockResolvedValue({});
  const evaluateCredit = vi.fn<Qtc['evaluateCredit']>().mockResolvedValue({});
  const approveCredit = vi.fn<Qtc['approveCredit']>().mockResolvedValue({});
  const list = vi.fn<Qtc['list']>().mockResolvedValue([]);
  const listOperationalPage = vi
    .fn<Qtc['listOperationalPage']>()
    .mockResolvedValue({ items: [], nextCursor: null });
  const repository = {
    createOrder,
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
    orderNumber: ' fixture #/订单 ',
    quoteRevisionId: id,
    quoteSnapshotId: other,
    creditDecisionId: id,
    contractRevisionId: other,
    signatureEvidenceId: id,
    currency: 'USD',
    total: '3.00',
    lines: rawLines,
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
    createOrder,
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
const missing = error(404, 'not_found', 'Route not found');
const denied = error(403, 'forbidden', 'Permission denied');
describe('old one QTC sales-order create POST', () => {
  it.each([undefined, null, [], '', 0, false, true, 'json'].map((body) => ({ body })))(
    'root $body before pathname/cap',
    async ({ body }) => {
      const f = fixture({ denied: true });
      for (const pathname of [path, '/api/v1/not-a-qtc-command'])
        expect(await f.dispatch({ body, pathname })).toEqual(
          invalid('A JSON object body is required'),
        );
      expect(f.get).not.toHaveBeenCalled();
      expect(f.createOrder).not.toHaveBeenCalled();
    },
  );
  it('allow unknown keys sort before method/field getters/key/cap', async () => {
    const f = fixture({ denied: true }),
      getter = vi.fn(() => {
        throw new Error('not reached');
      });
    Object.defineProperty(f.repository, 'createOrder', { get: getter });
    const body = Object.defineProperty({ z: 1, a: 2 }, 'customerId', {
      enumerable: true,
      get: getter,
    });
    expect(await f.dispatch({ body })).toEqual(invalid('Unsupported fields: a, z'));
    expect(getter).not.toHaveBeenCalled();
    expect(f.get).not.toHaveBeenCalled();
  });

  it('four args receiver/new input-lines-rows/Q refs/201/no fabricated version', async () => {
    const f = fixture();
    const a = await f.dispatch();
    await f.dispatch();
    expect(a).toEqual(response(201, returned));
    expect(a.body).toBe(returned);
    const args = f.createOrder.mock.calls[0];
    expect(args).toEqual([
      {
        customerId: id,
        opportunityId: other,
        orderNumber: 'fixture #/订单',
        quoteRevisionId: id,
        quoteSnapshotId: other,
        creditDecisionId: id,
        contractRevisionId: other,
        signatureEvidenceId: id,
        currency: 'USD',
        total: '3',
        lines: [parsedLine],
      },
      ' raw key ',
      { actor, scopes: f.scopes, anchors: f.anchors },
      correlationId,
    ]);
    expect(args).toHaveLength(4);
    expect(f.createOrder.mock.contexts[0]).toBe(f.repository);
    expect(Object.keys(args?.[0] ?? {})).toEqual(keys);
    expect(Object.keys(args?.[0].lines[0] ?? {})).toEqual(lineKeys);
    expect(args?.[0]).not.toBe(f.body);
    expect(args?.[0].lines).not.toBe(rawLines);
    expect(args?.[0].lines[0]).not.toBe(rawLine);
    expect(args?.[0].lines).not.toBe(f.createOrder.mock.calls[1]?.[0].lines);
    expect(args?.[2]).not.toBe(f.createOrder.mock.calls[1]?.[2]);
    expect(args?.[2].actor).toBe(actor);
    expect(args?.[2].scopes).toBe(f.scopes);
    expect(args?.[2].anchors).toBe(f.anchors);
    expect(f.get.mock.calls).toEqual([
      ['sales-order:create'],
      ['sales-order:create'],
      ['sales-order:read'],
      ['sales-order:create'],
      ['sales-order:create'],
      ['sales-order:read'],
    ]);
    expect(Object.hasOwn(a.body as object, 'version')).toBe(false);
  });
  for (const key of inputKeys) {
    it.each([undefined, null, '', ' ', 0, false, 1, true, [], {}].map((value) => ({ value })))(
      'top ' + key + ' $value required after lines before key/cap',
      async ({ value }) => {
        const f = fixture({ denied: true });
        expect(
          await f.dispatch({
            body: { ...f.body, [key]: value },
            headers: { ...f.headers, 'idempotency-key': '' },
          }),
        ).toEqual(invalid(key + ' is required'));
        expect(f.get).not.toHaveBeenCalled();
        expect(f.createOrder).not.toHaveBeenCalled();
      },
    );
    it('missing top ' + key, async () => {
      const f = fixture();
      const body = { ...f.body };
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
    ])('bad UUID ' + key + ' %s', async (value) => {
      const f = fixture();
      expect(await f.dispatch({ body: { ...f.body, [key]: value } })).toEqual(
        invalid(key + ' must be a UUID'),
      );
    });
    it('UUID ' + key + ' trim uppercase', async () => {
      const f = fixture();
      expect(
        (await f.dispatch({ body: { ...f.body, [key]: ' ' + id.toUpperCase() + ' ' } })).statusCode,
      ).toBe(201);
      expect(f.createOrder.mock.calls[0]?.[0]).toMatchObject({ [key]: id.toUpperCase() });
    });
  }
  it.each([' number/#订单 ', 'x'.repeat(4096)])(
    'orderNumber %j ordinary trim no max',
    async (orderNumber) => {
      const f = fixture();
      expect((await f.dispatch({ body: { ...f.body, orderNumber } })).statusCode).toBe(201);
      expect(f.createOrder.mock.calls[0]?.[0].orderNumber).toBe(orderNumber.trim());
    },
  );
  it.each([
    { value: 'USD', expected: 'USD' },
    { value: ' ZZZ ', expected: 'ZZZ' },
  ])('currency $value trim uppercase only HTTP not PG ISO catalog', async ({ value, expected }) => {
    const f = fixture();
    expect((await f.dispatch({ body: { ...f.body, currency: value } })).statusCode).toBe(201);
    expect(f.createOrder.mock.calls[0]?.[0].currency).toBe(expected);
  });
  it.each(['US', 'USDD', '1SD', 'USD/EUR', 'usd', 'zZz'])('bad currency %s', async (currency) => {
    const f = fixture();
    expect(await f.dispatch({ body: { ...f.body, currency } })).toEqual(
      invalid('Currency must be ISO 4217 uppercase'),
    );
  });
  it.each([undefined, null, '', 0, false, true, {}, () => []].map((lines) => ({ lines })))(
    'nonarray lines $lines before method/top/key/cap',
    async ({ lines }) => {
      const f = fixture({ denied: true });
      const method = vi.fn(() => f.createOrder);
      Object.defineProperty(f.repository, 'createOrder', { get: method });
      expect(
        await f.dispatch({ body: { ...f.body, customerId: null, total: null, lines } }),
      ).toEqual(invalid('lines must be an array'));
      expect(method).not.toHaveBeenCalled();
      expect(f.get).not.toHaveBeenCalled();
    },
  );
  it('missing and empty lines before parenttotal/method', async () => {
    const f = fixture();
    const method = vi.fn(() => f.createOrder);
    Object.defineProperty(f.repository, 'createOrder', { get: method });
    const body = { ...f.body };
    Reflect.deleteProperty(body, 'lines');
    expect(await f.dispatch({ body })).toEqual(invalid('lines must be an array'));
    expect(await f.dispatch({ body: { ...f.body, total: null, lines: [] } })).toEqual(
      invalid('Sales order requires at least one line'),
    );
    expect(method).not.toHaveBeenCalled();
  });
  it.each([undefined, null, [], 0, false, true, 'line', () => undefined].map((row) => ({ row })))(
    'line root $row before parenttotal/method',
    async ({ row }) => {
      const f = fixture();
      const method = vi.fn(() => f.createOrder);
      Object.defineProperty(f.repository, 'createOrder', { get: method });
      expect(await f.dispatch({ body: { ...f.body, total: null, lines: [row] } })).toEqual(
        invalid('A JSON object body is required'),
      );
      expect(method).not.toHaveBeenCalled();
    },
  );
  it('line allow unknown sorted before row values and later rows', async () => {
    const f = fixture();
    const getter = vi.fn(() => {
      throw new Error('not read');
    });
    const row = Object.defineProperty({ z: 1, a: 2 }, 'description', {
      enumerable: true,
      get: getter,
    });
    expect(await f.dispatch({ body: { ...f.body, lines: [row, null], total: null } })).toEqual(
      invalid('Unsupported fields: a, z'),
    );
    expect(getter).not.toHaveBeenCalled();
  });
  for (const key of lineKeys) {
    it.each([undefined, null, '', ' ', 0, false, 1, true, [], {}].map((value) => ({ value })))(
      'line ' + key + ' $value before parenttotal/method/cap',
      async ({ value }) => {
        const f = fixture({ denied: true });
        const method = vi.fn(() => f.createOrder);
        Object.defineProperty(f.repository, 'createOrder', { get: method });
        expect(
          await f.dispatch({
            body: {
              ...f.body,
              total: null,
              customerId: null,
              lines: [{ ...rawLine, [key]: value }],
            },
          }),
        ).toEqual(
          invalid(
            key === 'description' ? 'lines[0].description is required' : key + ' is required',
          ),
        );
        expect(method).not.toHaveBeenCalled();
        expect(f.get).not.toHaveBeenCalled();
      },
    );
    it('missing line ' + key, async () => {
      const f = fixture();
      const row = { ...rawLine };
      Reflect.deleteProperty(row, key);
      expect(await f.dispatch({ body: { ...f.body, lines: [row] } })).toEqual(
        invalid(key === 'description' ? 'lines[0].description is required' : key + ' is required'),
      );
    });
  }
  for (const key of ['quantity', 'unitPrice', 'total', 'parentTotal'] as const) {
    it.each([
      { value: '-1', message: ' must be non-negative' },
      { value: '01', message: 'Invalid decimal' },
      { value: '1e2', message: 'Invalid decimal' },
      { value: '+1', message: 'Invalid decimal' },
      { value: '.1', message: 'Invalid decimal' },
      { value: '1.', message: 'Invalid decimal' },
      { value: '0.0000001', message: 'Invalid decimal' },
      { value: '1000000000000000000', message: 'Invalid decimal' },
    ])('decimal ' + key + ' $value', async ({ value, message }) => {
      const f = fixture();
      const name = key === 'parentTotal' ? 'total' : key;
      const body =
        key === 'parentTotal'
          ? { ...f.body, total: value }
          : { ...f.body, lines: [{ ...rawLine, [key]: value }] };
      expect(await f.dispatch({ body })).toEqual(
        invalid(message === 'Invalid decimal' ? message : name + message),
      );
    });
  }
  it.each([undefined, null, '', ' ', 0, false, true, [], {}].map((total) => ({ total })))(
    'parent total $total required after all lines before method',
    async ({ total }) => {
      const f = fixture();
      const method = vi.fn(() => f.createOrder);
      Object.defineProperty(f.repository, 'createOrder', { get: method });
      expect(await f.dispatch({ body: { ...f.body, total } })).toEqual(
        invalid('total is required'),
      );
      expect(method).not.toHaveBeenCalled();
    },
  );
  it('mismatch before method/topUUID/key/cap and all lines parsed before parenttotal', async () => {
    const f = fixture({ denied: true });
    const method = vi.fn(() => f.createOrder);
    Object.defineProperty(f.repository, 'createOrder', { get: method });
    expect(
      await f.dispatch({
        body: { ...f.body, total: '4', customerId: null },
        headers: { ...f.headers, 'idempotency-key': '' },
      }),
    ).toEqual(invalid('Sales order lines must equal order total'));
    expect(
      await f.dispatch({
        body: { ...f.body, total: null, lines: [rawLine, { ...rawLine, description: null }] },
      }),
    ).toEqual(invalid('lines[1].description is required'));
    expect(method).not.toHaveBeenCalled();
    expect(f.get).not.toHaveBeenCalled();
  });
  it('multi-invalid row fields fixed S/D/D/D first error', async () => {
    const f = fixture();
    for (let i = 0; i < lineKeys.length; i++) {
      const row: Record<string, unknown> = { ...rawLine };
      for (const key of lineKeys.slice(i)) row[key] = null;
      const key = lineKeys[i] ?? 'description';
      expect(await f.dispatch({ body: { ...f.body, lines: [row] } })).toEqual(
        invalid(key === 'description' ? 'lines[0].description is required' : key + ' is required'),
      );
    }
  });
  it('multi-invalid top follows cached lines/total then U/U/S/U/U/U/U/U/currency', async () => {
    const f = fixture();
    for (let i = 0; i < inputKeys.length; i++) {
      const body = { ...f.body };
      for (const key of inputKeys.slice(i)) body[key] = null;
      const key = inputKeys[i] ?? 'customerId';
      expect(await f.dispatch({ body })).toEqual(invalid(key + ' is required'));
    }
  });
  it.each([
    { totals: ['0.1', '0.2'], total: '0.300000', expected: '0.3' },
    {
      totals: ['9007199254740993.000001', '0.000002'],
      total: '9007199254740993.000003',
      expected: '9007199254740993.000003',
    },
    { totals: ['-0.000000'], total: '-0', expected: '0' },
  ])(
    'exact BigInt sum $total and negative-zero/no positivity-product HTTP rule',
    async ({ totals, total, expected }) => {
      const f = fixture();
      const lines = totals.map((t) => ({
        description: ' line ',
        quantity: '0',
        unitPrice: '0',
        total: t,
      }));
      expect((await f.dispatch({ body: { ...f.body, total, lines } })).statusCode).toBe(201);
      expect(f.createOrder.mock.calls[0]?.[0].total).toBe(expected);
      expect(f.createOrder.mock.calls[0]?.[0].lines).toEqual(
        totals.map((t) => ({
          description: 'line',
          quantity: '0',
          unitPrice: '0',
          total: t.startsWith('-') ? '0' : t,
        })),
      );
    },
  );
  it('large near-equal totals are not rounded with Number', async () => {
    const f = fixture();
    expect(
      await f.dispatch({
        body: {
          ...f.body,
          total: '9007199254740993.000002',
          lines: [{ ...rawLine, total: '9007199254740993.000001' }],
        },
      }),
    ).toEqual(invalid('Sales order lines must equal order total'));
  });
  it('sparse array holes preserved by map/reduce; only mock not transport/PG', async () => {
    const f = fixture();
    const lines = Array<Parameters<Method>[0]['lines'][number]>(2);
    expect((await f.dispatch({ body: { ...f.body, total: '0', lines } })).statusCode).toBe(201);
    const parsed = f.createOrder.mock.calls[0]?.[0].lines;
    expect(parsed?.length).toBe(2);
    expect(Object.keys(parsed ?? [])).toEqual([]);
  });
  it('inherited numeric array index mapped in original order', async () => {
    const f = fixture();
    const lines: unknown[] = [];
    lines.length = 1;
    Object.setPrototypeOf(
      lines,
      Object.assign(Object.create(Array.prototype) as object, { 0: rawLine }),
    );
    expect((await f.dispatch({ body: { ...f.body, lines } })).statusCode).toBe(201);
    expect(f.createOrder.mock.calls[0]?.[0].lines).toEqual([parsedLine]);
  });
  for (const key of ['lines', 'total'] as const) {
    it('preparse ' + key + ' replaces method before capture; getter once', async () => {
      const f = fixture();
      const replacement = vi.fn<Method>().mockResolvedValue(returned);
      const value = f.body[key];
      const getter = vi.fn(() => {
        f.repository.createOrder = replacement;
        return value;
      });
      Object.defineProperty(f.body, key, { enumerable: true, get: getter });
      expect((await f.dispatch()).statusCode).toBe(201);
      expect(getter).toHaveBeenCalledOnce();
      expect(f.createOrder).not.toHaveBeenCalled();
      expect(replacement).toHaveBeenCalledOnce();
      expect(replacement.mock.contexts[0]).toBe(f.repository);
    });
  }
  it.each(lineKeys)('line getter %s changes method before capture', async (key) => {
    const f = fixture();
    const replacement = vi.fn<Method>().mockResolvedValue(returned);
    const getter = vi.fn(() => {
      f.repository.createOrder = replacement;
      return rawLine[key];
    });
    const row = Object.defineProperty({ ...rawLine }, key, { enumerable: true, get: getter });
    expect((await f.dispatch({ body: { ...f.body, lines: [row] } })).statusCode).toBe(201);
    expect(getter).toHaveBeenCalledOnce();
    expect(replacement).toHaveBeenCalledOnce();
    expect(f.createOrder).not.toHaveBeenCalled();
  });
  it.each(inputKeys)('top getter %s changes method after capture', async (key) => {
    const f = fixture();
    const replacement = vi.fn<Method>().mockResolvedValue({});
    const value = f.body[key];
    const getter = vi.fn(() => {
      f.repository.createOrder = replacement;
      return value;
    });
    Object.defineProperty(f.body, key, { enumerable: true, get: getter });
    expect((await f.dispatch()).statusCode).toBe(201);
    expect(getter).toHaveBeenCalledOnce();
    expect(f.createOrder).toHaveBeenCalledOnce();
    expect(replacement).not.toHaveBeenCalled();
  });
  it.each(keys)('body getter deletes own %s late ctx requests remaining topkeys', async (key) => {
    const f = fixture({ writeFields: keys.filter((k) => k !== key) });
    const value = f.body[key];
    const getter = vi.fn(() => {
      Reflect.deleteProperty(f.body, key);
      return value;
    });
    Object.defineProperty(f.body, key, { enumerable: true, configurable: true, get: getter });
    expect((await f.dispatch()).statusCode).toBe(201);
    expect(getter).toHaveBeenCalledOnce();
    expect(f.createOrder).toHaveBeenCalledOnce();
  });
  it('row fields are not authorized top fields and actor cannot replace captured method', async () => {
    const f = fixture({ writeFields: keys });
    const replacement = vi.fn<Method>().mockResolvedValue({});
    Object.defineProperty(f.context, 'actor', {
      get: () => {
        f.repository.createOrder = replacement;
        return actor;
      },
    });
    expect((await f.dispatch()).statusCode).toBe(201);
    expect(f.createOrder).toHaveBeenCalledOnce();
    expect(replacement).not.toHaveBeenCalled();
  });
  it('trace globalspread-auth/topallow/lines-rowallow-values/parenttotal/method/topfields/livectx/call/lateM', async () => {
    const f = fixture();
    const events: string[] = [];
    const row = new Proxy(
      { ...rawLine },
      {
        ownKeys: (t) => {
          events.push('rowkeys');
          return Reflect.ownKeys(t);
        },
        get: (t, k, r) => {
          if (typeof k === 'string') events.push('row:' + k);
          return Reflect.get(t, k, r) as unknown;
        },
      },
    );
    const body = new Proxy(
      { ...f.body, lines: [row] },
      {
        ownKeys: (t) => {
          events.push('topkeys');
          return Reflect.ownKeys(t);
        },
        get: (t, k, r) => {
          if (typeof k === 'string') events.push(k);
          return Reflect.get(t, k, r) as unknown;
        },
      },
    );
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
    Object.defineProperty(f.repository, 'createOrder', {
      get: () => {
        events.push('method');
        return f.createOrder;
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
    f.createOrder.mockImplementationOnce(() => {
      events.push('call');
      return Promise.resolve(returned);
    });
    expect((await f.dispatch({ body, headers })).statusCode).toBe(201);
    expect(events).toEqual([
      'header',
      'auth',
      'topkeys',
      'lines',
      'rowkeys',
      ...lineKeys.map((k) => 'row:' + k),
      'total',
      'method',
      ...inputKeys,
      'topkeys',
      'sales-order:create',
      'sales-order:create',
      'actor',
      'call',
      'sales-order:read',
    ]);
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
    expect(f.createOrder.mock.calls[0]?.[1]).toBe(key);
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
      expect(f.createOrder).not.toHaveBeenCalled();
    },
  );
  it.each([[], ['customerId'], keys.slice(0, 5), ['unrelated']].map((fields) => ({ fields })))(
    'write fields $fields actual keys rejected',
    async ({ fields }) => {
      const f = fixture({ writeFields: fields });
      expect(await f.dispatch()).toEqual(error(403, 'forbidden', 'Field permission denied'));
      expect(f.createOrder).not.toHaveBeenCalled();
    },
  );
  it('full grant/body key order different from parser order; nonenum/inherited known fields/unknown symbol', async () => {
    const f = fixture({ writeFields: keys }),
      body = Object.fromEntries(keys.toReversed().map((key) => [key, f.body[key]]));
    expect((await f.dispatch({ body })).statusCode).toBe(201);
    expect(Object.keys(f.createOrder.mock.calls[0]?.[0] ?? {})).toEqual(keys);
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
      expect(f.createOrder.mock.calls[0]?.[2].scopes).toBe(f.scopes);
      expect(f.createOrder.mock.calls[0]?.[2].anchors).toBe(f.anchors);
    },
  );
  it('anchors missing uses fresh[] per request no added refusal', async () => {
    const f = fixture();
    Object.defineProperty(f.context, 'scopeAnchors', { value: undefined });
    await f.dispatch();
    await f.dispatch();
    expect(f.createOrder.mock.calls[0]?.[2].anchors).toEqual([]);
    expect(f.createOrder.mock.calls[0]?.[2].anchors).not.toBe(
      f.createOrder.mock.calls[1]?.[2].anchors,
    );
  });
  it.each([
    { read: null, label: 'missing' },
    { read: { scopes: [], fields: null }, label: 'raw' },
    { read: { scopes: ['TEAM'], fields: [] }, label: 'id' },
    { read: { scopes: ['TEAM'], fields: ['total', 'status', 'nested'] }, label: 'finite' },
  ] as const)(
    'late M sales-order read $label independent of write capability',
    async ({ read, label }) => {
      const f = fixture({ read }),
        result = await f.dispatch();
      expect(result).toEqual(
        response(
          201,
          label === 'raw'
            ? returned
            : label === 'finite'
              ? { id, total: '3', status: 'RELEASED', nested }
              : { id },
        ),
      );
      if (label === 'raw') expect(result.body).toBe(returned);
      else expect(result.body).not.toBe(returned);
      if (label === 'finite') expect((result.body as JsonObject).nested).toBe(nested);
      expect(f.get.mock.calls.at(-1)).toEqual(['sales-order:read']);
    },
  );
  it('M fallback existing synthetic version only, RELEASED is not version/no invented id', async () => {
    const f = fixture({ read: null });
    expect(await f.dispatch()).toEqual(response(201, { id }));
    f.createOrder.mockResolvedValueOnce({ id, version: 3, status: 'RELEASED' });
    expect(await f.dispatch()).toEqual(response(201, { id, version: 3 }));
    f.createOrder.mockResolvedValueOnce({ status: 'RELEASED' });
    expect(await f.dispatch()).toEqual(response(201, {}));
  });
  it.each([null, [], ['total']].map((fields) => ({ fields })))(
    'await read field change $fields affects M',
    async ({ fields }) => {
      const f = fixture();
      f.createOrder.mockImplementationOnce(() => {
        f.permissions.set('sales-order:read', { scopes: [], fields });
        return Promise.resolve(returned);
      });
      expect(await f.dispatch()).toEqual(
        response(201, fields === null ? returned : fields.length ? { id, total: '3' } : { id }),
      );
    },
  );
  it('await read deletion vs runtime undefined fields old500-C', async () => {
    const f = fixture();
    f.createOrder.mockImplementationOnce(() => {
      f.permissions.delete('sales-order:read');
      return Promise.resolve(returned);
    });
    expect(await f.dispatch()).toEqual(response(201, { id }));
    const wrong = fixture();
    wrong.createOrder.mockImplementationOnce(() => {
      Object.defineProperty(wrong.permissions.get('sales-order:read'), 'fields', {
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
    f.createOrder.mockResolvedValueOnce(row);
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
  it('neighbor prior writes/signing and AR enum untouched', async () => {
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
    expect(
      await f.dispatch({ pathname: '/api/v1/ar-open-items', body: { documentType: 'OTHER' } }),
    ).toEqual(invalid('documentType is unsupported'));
    expect(f.createOrder).not.toHaveBeenCalled();
  });
  it('all seven GET untouched by POST body/lines O', async () => {
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
    expect(f.createOrder).not.toHaveBeenCalled();
  });
  it.each([
    ['not_found', 404],
    ['conflict', 409],
    ['forbidden', 403],
    ['invalid_request', 400],
  ] as const)('repository error %s/%i/C preserved', async (code, status) => {
    const f = fixture();
    f.createOrder.mockRejectedValueOnce(new DomainError(code, 'order rejected'));
    expect(await f.dispatch()).toEqual(error(status, code, 'order rejected'));
  });
});
