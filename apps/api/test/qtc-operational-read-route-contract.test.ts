// Fixed against 723d913 inline operational GET; no future route module imported.
import { describe, expect, it, vi } from 'vitest';
import { DomainError, type AuthorizationContext } from '@kingturf/domain';
import type { DataScope, JsonObject, PermissionKey } from '@kingturf/types';
import { buildApp, type ApiDependencies, type ApiRequest } from '../src/app.js';
type Qtc = NonNullable<ApiDependencies['quoteToCash']>;
type Method = Qtc['listOperationalPage'];
type Filter = Parameters<Method>[1];
type Grant = NonNullable<ReturnType<AuthorizationContext['permissions']['get']>>;
const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const other = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const correlationId = '33333333-3333-4333-8333-333333333333';
const actor = { companyId: 'qtc-op-mock', employeeId: id };
const nested = { keep: true };
const row: JsonObject = { id, version: 7, name: 'first', secret: 'private', nested };
const second: JsonObject = { id: other, name: 'second', nested };
const reads = [
  { path: '/api/v1/ar-open-items', capability: 'ar:read', view: 'ar' },
  { path: '/api/v1/bank-payments', capability: 'bank-payment:read', view: 'payments' },
] as const;
type Read = (typeof reads)[number];
const queryInput = (query: unknown): NonNullable<ApiRequest['query']> =>
  query as NonNullable<ApiRequest['query']>;
function fixture(
  read: Read,
  options: {
    available?: boolean;
    denied?: boolean;
    scopes?: readonly DataScope[];
    fields?: Grant['fields'];
  } = {},
) {
  const scopes = options.scopes ?? ['TEAM'];
  const anchors = [{ scope: 'TEAM', organizationId: other }] as const;
  const permissions = new Map<PermissionKey, Grant>([
    [read.capability, { scopes, fields: options.fields === undefined ? null : options.fields }],
  ]);
  if (options.denied) permissions.delete(read.capability);
  const context: AuthorizationContext = {
    actor,
    permissions,
    scopeAnchors: new Map([[read.capability, anchors]]),
  };
  const get = vi.spyOn(permissions, 'get');
  const items = [row, second];
  const page = { items, nextCursor: other };
  const listOperationalPage = vi.fn<Method>().mockResolvedValue(page);
  const list = vi.fn<Qtc['list']>().mockResolvedValue(items);
  const repository = { listOperationalPage, list };
  const authenticate = vi.fn().mockResolvedValue(context);
  const app = buildApp({
    auth: { authenticate } as unknown as ApiDependencies['auth'],
    organizations: {} as ApiDependencies['organizations'],
    employees: {} as ApiDependencies['employees'],
    ...(options.available === false ? {} : { quoteToCash: repository as unknown as Qtc }),
  });
  const headers = { authorization: 'Bearer fixture', 'x-correlation-id': correlationId };
  const dispatch = (request: Partial<ApiRequest> = {}) =>
    app.dispatch({
      method: 'GET',
      pathname: read.path,
      ...request,
      headers: request.headers ?? headers,
    });
  return {
    scopes,
    anchors,
    permissions,
    context,
    get,
    items,
    page,
    listOperationalPage,
    list,
    repository,
    authenticate,
    headers,
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
const missing = error(404, 'not_found', 'Route not found');
const integerError = 'limit must be an integer between 1 and 100';
const accepted: readonly { query: unknown; expected: Filter }[] = [
  { query: undefined, expected: { limit: 50 } },
  { query: null, expected: { limit: 50 } },
  { query: {}, expected: { limit: 50 } },
  { query: { unused: 'ignored' }, expected: { limit: 50 } },
  ...['state', 'minAmount', 'maxAmount', 'limit', 'cursor', 'query', 'from', 'to'].flatMap((key) =>
    ['', undefined, null, false, 0].map((value) => ({
      query: { [key]: value },
      expected: { limit: 50 },
    })),
  ),
  ...['1', '100', ' 2 ', '1e2', '0x10', '01', '+1', '1.0'].map((value, index) => ({
    query: { limit: value },
    expected: { limit: [1, 100, 2, 100, 16, 1, 1, 1][index] ?? 50 },
  })),
  { query: { limit: true }, expected: { limit: 1 } },
  {
    query: { cursor: ' ' + id.toUpperCase() + ' ' },
    expected: { limit: 50, cursor: id.toUpperCase() },
  },
  { query: { query: ' search%_ ' }, expected: { limit: 50, query: 'search%_' } },
  {
    query: { from: '2026-02-30', to: '2026-01-01' },
    expected: { limit: 50, from: '2026-03-02T00:00:00.000Z', to: '2026-01-01T00:00:00.000Z' },
  },
  {
    query: { minAmount: '-0.000000', maxAmount: '0.000000' },
    expected: { limit: 50, minAmount: '0', maxAmount: '0' },
  },
  {
    query: { minAmount: ' 12.340000 ', maxAmount: '20.000001' },
    expected: { limit: 50, minAmount: '12.34', maxAmount: '20.000001' },
  },
  {
    query: { minAmount: '9007199254740993', maxAmount: '9007199254740992' },
    expected: { limit: 50, minAmount: '9007199254740993', maxAmount: '9007199254740992' },
  },
  ...(['OPEN', 'CLEARED', 'OVERDUE'] as const).map((state) => ({
    query: { state },
    expected: { limit: 50, state },
  })),
];
const bad: readonly { query: unknown; message: string }[] = [
  ...['open', ' OPEN ', 'OTHER', '0', 1, true, [], {}].map((state) => ({
    query: { state },
    message: 'state is unsupported',
  })),
  ...['minAmount', 'maxAmount'].flatMap((key) => [
    ...[' ', 1, true, [], {}].map((value) => ({
      query: { [key]: value },
      message: key + ' is required',
    })),
    ...['1e2', '01', '0.0000001', '1000000000000000000', 'bad'].map((value) => ({
      query: { [key]: value },
      message: 'Invalid decimal',
    })),
    { query: { [key]: '-1' }, message: key + ' must be non-negative' },
  ]),
  ...['0', '101', '-1', '1.5', ' ', 'NaN', 'Infinity', 'bad', {}].map((limit) => ({
    query: { limit },
    message: integerError,
  })),
  ...['cursor', 'query', 'from', 'to'].flatMap((key) =>
    [' ', 1, true, [], {}].map((value) => ({
      query: { [key]: value },
      message: key + ' is required',
    })),
  ),
  { query: { cursor: 'bad' }, message: 'cursor must be a UUID' },
  { query: { from: 'bad' }, message: 'from must be a valid timestamp' },
  { query: { to: 'bad' }, message: 'to must be a valid timestamp' },
  { query: { minAmount: '2', maxAmount: '1' }, message: 'minAmount must not exceed maxAmount' },
  { query: { state: 'bad', minAmount: 'bad', limit: 'bad' }, message: 'state is unsupported' },
  { query: { minAmount: 'bad', maxAmount: 'bad', limit: 'bad' }, message: 'Invalid decimal' },
  { query: { maxAmount: 'bad', limit: 'bad' }, message: 'Invalid decimal' },
  {
    query: { minAmount: '2', maxAmount: '1', limit: 'bad' },
    message: 'minAmount must not exceed maxAmount',
  },
  { query: { limit: 'bad', cursor: 'bad', query: ' ', from: 'bad' }, message: integerError },
  { query: { cursor: 'bad', query: ' ', from: 'bad' }, message: 'cursor must be a UUID' },
  { query: { query: ' ', from: 'bad', to: 'bad' }, message: 'query is required' },
  { query: { from: 'bad', to: 'bad' }, message: 'from must be a valid timestamp' },
];
for (const read of reads)
  describe('old QTC operational GET ' + read.view, () => {
    it('three arguments/receiver/cap/no requestfields/fresh refs and key order', async () => {
      const f = fixture(read);
      const query = {
        limit: '2',
        cursor: id,
        query: ' name ',
        from: '2026-01-01',
        to: '2026-02-01',
        minAmount: '0.00',
        maxAmount: '10.10',
        state: 'OPEN',
      };
      const a = await f.dispatch({ query }),
        b = await f.dispatch({ query });
      expect(a).toEqual(response(200, { items: f.items, nextCursor: other }));
      expect(b).toEqual(a);
      const args = f.listOperationalPage.mock.calls[0];
      expect(args).toEqual([
        read.view,
        {
          limit: 2,
          cursor: id,
          query: 'name',
          from: '2026-01-01T00:00:00.000Z',
          to: '2026-02-01T00:00:00.000Z',
          minAmount: '0',
          maxAmount: '10.1',
          state: 'OPEN',
        },
        { actor, scopes: f.scopes, anchors: f.anchors },
      ]);
      expect(args).toHaveLength(3);
      expect(f.listOperationalPage.mock.contexts[0]).toBe(f.repository);
      expect(Object.keys(args?.[1] ?? {})).toEqual([
        'limit',
        'cursor',
        'query',
        'from',
        'to',
        'minAmount',
        'maxAmount',
        'state',
      ]);
      expect(Object.keys(args?.[2] ?? {})).toEqual(['actor', 'scopes', 'anchors']);
      expect(args?.[2].actor).toBe(actor);
      expect(args?.[2].scopes).toBe(f.scopes);
      expect(args?.[2].anchors).toBe(f.anchors);
      expect(args?.[1]).not.toBe(f.listOperationalPage.mock.calls[1]?.[1]);
      expect(args?.[2]).not.toBe(f.listOperationalPage.mock.calls[1]?.[2]);
      expect(a.body).not.toBe(b.body);
      expect((a.body as typeof f.page).items).not.toBe(f.items);
      expect((a.body as typeof f.page).items[0]).toBe(row);
      expect(Object.keys(a.body as object)).toEqual(['items', 'nextCursor']);
      expect(f.get.mock.calls.every(([cap]) => cap === read.capability)).toBe(true);
      expect(f.get).toHaveBeenCalledTimes(8);
      expect(f.list).not.toHaveBeenCalled();
    });
    it.each(accepted)(
      'accept raw query $query unchanged parser semantics',
      async ({ query, expected }) => {
        const f = fixture(read);
        expect(await f.dispatch({ query: queryInput(query) })).toEqual(response(200, f.page));
        expect(f.listOperationalPage.mock.calls[0]?.[1]).toEqual(expected);
        expect(Object.keys(f.listOperationalPage.mock.calls[0]?.[1] ?? {})).toEqual(
          Object.keys(expected),
        );
      },
    );
    it.each(bad)('reject first error $message for $query', async ({ query, message }) => {
      const f = fixture(read);
      expect(await f.dispatch({ query: queryInput(query) })).toEqual(invalid(message));
      expect(f.listOperationalPage).not.toHaveBeenCalled();
    });
    it.each(['SELF', 'TEAM', 'DEPARTMENT', 'REGION', 'COMPANY', 'GROUP'] as const)(
      'scope %s forwards refs only',
      async (scope) => {
        const f = fixture(read, { scopes: [scope] });
        expect((await f.dispatch()).statusCode).toBe(200);
        expect(f.listOperationalPage.mock.calls[0]?.[2].scopes).toBe(f.scopes);
        expect(f.listOperationalPage.mock.calls[0]?.[2].anchors).toBe(f.anchors);
      },
    );
    it.each([{ denied: true }, { scopes: [] }])(
      'authorization before any query value/method/actor %j',
      async (options) => {
        const f = fixture(read, options);
        const getter = vi.fn(() => {
          throw new Error('not reached');
        });
        const query = Object.defineProperty({}, 'state', { get: getter });
        Object.defineProperty(f.repository, 'listOperationalPage', { get: getter });
        Object.defineProperty(f.context, 'actor', { get: getter });
        expect(await f.dispatch({ query, body: null })).toEqual(denied);
        expect(getter).not.toHaveBeenCalled();
      },
    );
    it('preparse failures before method and filter; valid preparse before captured method', async () => {
      const f = fixture(read);
      const getter = vi.fn(() => {
        throw new Error('not reached');
      });
      Object.defineProperty(f.repository, 'listOperationalPage', { get: getter });
      for (const entry of bad.filter(({ query }) =>
        Object.keys(query as object).some((key) =>
          ['state', 'minAmount', 'maxAmount'].includes(key),
        ),
      )) {
        expect(await f.dispatch({ query: queryInput(entry.query) })).toEqual(
          invalid(entry.message),
        );
      }
      expect(getter).not.toHaveBeenCalled();
    });
    it('getter trace Q0/preparse/method/filter/actor/call; state once others twice', async () => {
      const f = fixture(read);
      const events: string[] = [];
      f.get.mockImplementation((cap) => {
        events.push('permission');
        return new Map(f.permissions).get(cap);
      });
      const values = {
        state: 'OPEN',
        minAmount: '1.00',
        maxAmount: '2.00',
        limit: '2',
        cursor: id,
        query: ' name ',
        from: '2026-01-01',
        to: '2026-02-01',
      };
      const query = Object.fromEntries(Object.entries(values).map(([key, value]) => [key, value]));
      for (const [key, value] of Object.entries(values))
        Object.defineProperty(query, key, {
          get: () => {
            events.push(key);
            return value;
          },
        });
      Object.defineProperty(f.repository, 'listOperationalPage', {
        get: () => {
          events.push('method');
          return f.listOperationalPage;
        },
      });
      Object.defineProperty(f.context, 'actor', {
        get: () => {
          events.push('actor');
          return actor;
        },
      });
      f.listOperationalPage.mockImplementationOnce(() => {
        events.push('call');
        return Promise.resolve({ items: [], nextCursor: null });
      });
      expect(await f.dispatch({ query })).toEqual(response(200, { items: [], nextCursor: null }));
      expect(events).toEqual([
        'permission',
        'permission',
        'state',
        'minAmount',
        'minAmount',
        'maxAmount',
        'maxAmount',
        'method',
        'limit',
        'limit',
        'cursor',
        'cursor',
        'query',
        'query',
        'from',
        'from',
        'to',
        'to',
        'actor',
        'call',
      ]);
    });
    it('second getter value used; state cache stays first; method captured before filter and actor mutation', async () => {
      const f = fixture(read);
      const replacement = vi.fn<Method>().mockResolvedValue({ items: [], nextCursor: null });
      const values = {
        minAmount: ['1', '0.00'],
        maxAmount: ['10', '5.0'],
        limit: ['1', '2'],
        cursor: [other, id],
        query: ['first', ' second '],
        from: ['first', '2026-01-01'],
        to: ['first', '2026-02-01'],
      };
      const query: Record<string, string | undefined> = {};
      for (const [key, [first, secondValue]] of Object.entries(values)) {
        let count = 0;
        Object.defineProperty(query, key, {
          get: () => {
            if (key === 'limit') f.repository.listOperationalPage = replacement;
            return count++ === 0 ? first : secondValue;
          },
        });
      }
      const state = vi.fn(() => 'OPEN');
      Object.defineProperty(query, 'state', { get: state });
      Object.defineProperty(f.context, 'actor', {
        get: () => {
          f.repository.listOperationalPage = replacement;
          return actor;
        },
      });
      expect((await f.dispatch({ query })).statusCode).toBe(200);
      expect(f.listOperationalPage.mock.calls[0]?.[1]).toEqual({
        limit: 2,
        cursor: id,
        query: 'second',
        from: '2026-01-01T00:00:00.000Z',
        to: '2026-02-01T00:00:00.000Z',
        minAmount: '0',
        maxAmount: '5',
        state: 'OPEN',
      });
      expect(state).toHaveBeenCalledOnce();
      expect(f.listOperationalPage).toHaveBeenCalledOnce();
      expect(replacement).not.toHaveBeenCalled();
    });
    it.each(['state', 'minAmount', 'maxAmount', 'limit', 'cursor', 'query', 'from', 'to'])(
      'falsy getter %s read once and omitted/defaulted',
      async (key) => {
        const f = fixture(read);
        const getter = vi.fn(() => '');
        expect(
          (await f.dispatch({ query: Object.defineProperty({}, key, { get: getter }) })).statusCode,
        ).toBe(200);
        expect(f.listOperationalPage.mock.calls[0]?.[1]).toEqual({ limit: 50 });
        expect(getter).toHaveBeenCalledOnce();
      },
    );
    it('preparse mutation selects new method, unlike filter/actor mutation after capture', async () => {
      const f = fixture(read);
      const replacement = vi.fn<Method>().mockResolvedValue(f.page);
      const query = Object.defineProperty({}, 'minAmount', {
        get: () => {
          f.repository.listOperationalPage = replacement;
          return '0';
        },
      });
      expect((await f.dispatch({ query })).statusCode).toBe(200);
      expect(f.listOperationalPage).not.toHaveBeenCalled();
      expect(replacement).toHaveBeenCalledOnce();
      expect(replacement.mock.contexts[0]).toBe(f.repository);
      expect(replacement.mock.calls[0]).toHaveLength(3);
    });
    it('filter failure occurs after method capture but before actor', async () => {
      const f = fixture(read),
        events: string[] = [];
      Object.defineProperty(f.repository, 'listOperationalPage', {
        get: () => {
          events.push('method');
          return f.listOperationalPage;
        },
      });
      Object.defineProperty(f.context, 'actor', {
        get: () => {
          events.push('actor');
          return actor;
        },
      });
      expect(await f.dispatch({ query: { limit: 'bad' } })).toEqual(invalid(integerError));
      expect(events).toEqual(['method']);
      expect(f.listOperationalPage).not.toHaveBeenCalled();
    });
    it.each([
      { fields: null, expected: [row, second] },
      { fields: [], expected: [{ id }, { id: other }] },
      {
        fields: ['name'],
        expected: [
          { id, name: 'first' },
          { id: other, name: 'second' },
        ],
      },
      {
        fields: ['nested'],
        expected: [
          { id, nested },
          { id: other, nested },
        ],
      },
    ])('late projection $fields/new shallow or raw refs', async ({ fields, expected }) => {
      const f = fixture(read, { fields });
      const result = await f.dispatch();
      expect(result).toEqual(response(200, { items: expected, nextCursor: other }));
      const items = (result.body as typeof f.page).items;
      expect(items[0]).not.toBeUndefined();
      if (fields === null) expect(items[0]).toBe(row);
      else expect(items[0]).not.toBe(row);
      if (fields?.some((field) => field === 'nested')) expect(items[0]?.nested).toBe(nested);
    });
    it.each([undefined, null, []].map((fields) => ({ fields })))(
      'fields changed after await to $fields',
      async ({ fields }) => {
        const f = fixture(read);
        f.listOperationalPage.mockImplementationOnce(() => {
          Object.defineProperty(f.permissions.get(read.capability), 'fields', { value: fields });
          return Promise.resolve(f.page);
        });
        expect(await f.dispatch()).toEqual(
          response(200, {
            items: fields == null ? f.items : [{ id }, { id: other }],
            nextCursor: other,
          }),
        );
      },
    );
    it('grant deleted after await returns rawrows and preserves nextCursor not reauthorize', async () => {
      const f = fixture(read, { fields: [] });
      f.listOperationalPage.mockImplementationOnce(() => {
        f.permissions.delete(read.capability);
        return Promise.resolve(f.page);
      });
      const result = await f.dispatch();
      expect(result).toEqual(response(200, f.page));
      expect((result.body as typeof f.page).items[0]).toBe(row);
    });
    it('page.items before row projection before nextCursor; new grants read each row', async () => {
      const f = fixture(read),
        events: string[] = [];
      const first = {
        id,
        get name() {
          events.push('row');
          f.permissions.set(read.capability, { scopes: [], fields: [] });
          return 'first';
        },
      };
      f.listOperationalPage.mockImplementationOnce(() => {
        f.permissions.set(read.capability, {
          scopes: [],
          get fields() {
            events.push('fields');
            return ['name'];
          },
        });
        return Promise.resolve({
          get items() {
            events.push('items');
            return [first, second];
          },
          get nextCursor() {
            events.push('cursor');
            return other;
          },
        });
      });
      expect(await f.dispatch()).toEqual(
        response(200, { items: [{ id, name: 'first' }, { id: other }], nextCursor: other }),
      );
      expect(events).toEqual(['items', 'fields', 'row', 'cursor']);
    });
    it('finite projection eager excluded getter/shallow special own keys/order/no fabricated id', async () => {
      const f = fixture(read, { fields: ['nested', '__proto__', 'constructor', 'toString'] });
      const getter = vi.fn(() => 'private');
      const item: JsonObject = { version: 9, nested };
      Object.defineProperty(item, 'secret', { enumerable: true, get: getter });
      for (const key of ['__proto__', 'constructor', 'toString'])
        Object.defineProperty(item, key, { enumerable: true, value: nested });
      f.listOperationalPage.mockResolvedValueOnce({ items: [item], nextCursor: null });
      const result = await f.dispatch(),
        projected = (result.body as { items: JsonObject[] }).items[0];
      expect(getter).toHaveBeenCalledOnce();
      expect(Object.keys(projected ?? {})).toEqual([
        'nested',
        '__proto__',
        'constructor',
        'toString',
      ]);
      expect(projected?.nested).toBe(nested);
      expect(projected).not.toBe(item);
      expect(Object.getPrototypeOf(projected)).toBe(Object.prototype);
    });
    it.each(
      [null, undefined, '', 0, false, { untouched: true }].map((nextCursor) => ({ nextCursor })),
    )('nextCursor raw value $nextCursor even empty page', async ({ nextCursor }) => {
      const f = fixture(read);
      f.listOperationalPage.mockResolvedValueOnce({ items: [], nextCursor: nextCursor as null });
      const result = await f.dispatch();
      expect(result).toEqual(response(200, { items: [], nextCursor }));
      expect(f.get).toHaveBeenCalledTimes(2);
      expect(Object.keys(result.body as object)).toEqual(['items', 'nextCursor']);
    });
    it('row projection DomainError occurs before nextCursor getter', async () => {
      const f = fixture(read, { fields: [] });
      const next = vi.fn(() => other);
      const item: JsonObject = Object.defineProperty({}, 'secret', {
        enumerable: true,
        get: () => {
          throw new DomainError('forbidden', 'projection failed');
        },
      });
      f.listOperationalPage.mockResolvedValueOnce({
        items: [item],
        get nextCursor() {
          return next();
        },
      });
      expect(await f.dispatch()).toEqual(error(403, 'forbidden', 'projection failed'));
      expect(next).not.toHaveBeenCalled();
    });
    it('empty page skips late grant lookup and fields; nextCursor throwing DomainError after map', async () => {
      const f = fixture(read);
      const getter = vi.fn(() => {
        throw new DomainError('conflict', 'cursor failed');
      });
      f.listOperationalPage.mockResolvedValueOnce({
        items: [],
        get nextCursor(): null {
          return getter();
        },
      });
      expect(await f.dispatch()).toEqual(error(409, 'conflict', 'cursor failed'));
      expect(f.get).toHaveBeenCalledTimes(2);
      expect(getter).toHaveBeenCalledOnce();
    });
    it.each(
      [undefined, null, [], '', 0, false, { idempotencyKey: 'body ignored' }].map((body) => ({
        body,
      })),
    )('GET body $body ignored', async ({ body }) => {
      const f = fixture(read);
      expect(await f.dispatch({ body })).toEqual(response(200, f.page));
    });
    it('global header spread once before Q0; no key-value parser or body inner getter', async () => {
      const f = fixture(read);
      const headerGetter = vi.fn(() => {
        expect(f.get).not.toHaveBeenCalled();
        return '';
      });
      const bodyGetter = vi.fn(() => {
        throw new Error('ignored');
      });
      const headers = Object.defineProperty({ ...f.headers }, 'idempotency-key', {
        enumerable: true,
        get: headerGetter,
      });
      const body = Object.defineProperty({}, 'idempotencyKey', {
        enumerable: true,
        get: bodyGetter,
      });
      expect((await f.dispatch({ headers, body })).statusCode).toBe(200);
      expect(headerGetter).toHaveBeenCalledOnce();
      expect(bodyGetter).not.toHaveBeenCalled();
    });
    it('absent anchors creates new empty fallback, no new HTTP denial', async () => {
      const f = fixture(read);
      Object.defineProperty(f.context, 'scopeAnchors', { value: undefined });
      await f.dispatch();
      await f.dispatch();
      expect(f.listOperationalPage.mock.calls[0]?.[2].anchors).toEqual([]);
      expect(f.listOperationalPage.mock.calls[0]?.[2].anchors).not.toBe(
        f.listOperationalPage.mock.calls[1]?.[2].anchors,
      );
    });
    it('missing repository skips authorization/query and returns404', async () => {
      const f = fixture(read, { available: false, denied: true });
      const getter = vi.fn(() => {
        throw new Error('ignored');
      });
      expect(
        await f.dispatch({ query: Object.defineProperty({}, 'state', { get: getter }) }),
      ).toEqual(missing);
      expect(getter).not.toHaveBeenCalled();
      expect(f.get).not.toHaveBeenCalled();
    });
    it('global authentication401 precedes query regardless missing repo', async () => {
      const f = fixture(read, { available: false });
      const getter = vi.fn(() => {
        throw new Error('ignored');
      });
      expect(
        await f.dispatch({
          headers: { 'x-correlation-id': correlationId },
          query: Object.defineProperty({}, 'state', { get: getter }),
        }),
      ).toEqual(error(401, 'authentication_required', 'A valid session is required'));
      expect(f.authenticate).not.toHaveBeenCalled();
      expect(getter).not.toHaveBeenCalled();
    });
    it.each(['PATCH', 'PUT', 'DELETE', 'HEAD', 'get'])('unsupported method %s', async (method) => {
      const f = fixture(read, { denied: true });
      const getter = vi.fn(() => {
        throw new Error('ignored');
      });
      expect(
        await f.dispatch({
          method,
          body: null,
          query: Object.defineProperty({}, 'state', { get: getter }),
        }),
      ).toEqual(missing);
      expect(getter).not.toHaveBeenCalled();
      expect(f.get).not.toHaveBeenCalled();
    });
    it.each([read.path + '/', read.path + '/' + id, read.path + '/extra', read.path.toUpperCase()])(
      'unsupported exact path %s',
      async (pathname) => {
        const f = fixture(read, { denied: true });
        const getter = vi.fn(() => {
          throw new Error('ignored');
        });
        expect(
          await f.dispatch({
            pathname,
            query: Object.defineProperty({}, 'state', { get: getter }),
          }),
        ).toEqual(missing);
        expect(getter).not.toHaveBeenCalled();
        expect(f.get).not.toHaveBeenCalled();
      },
    );
    it('shared POST O compatibility before path/cap and valid unknown404', async () => {
      const f = fixture(read, { denied: true });
      for (const pathname of [read.path, '/api/v1/not-a-qtc-command'])
        expect(await f.dispatch({ method: 'POST', pathname, body: null })).toEqual(
          invalid('A JSON object body is required'),
        );
      expect(
        await f.dispatch({ method: 'POST', pathname: '/api/v1/not-a-qtc-command', body: {} }),
      ).toEqual(missing);
      expect(f.get).not.toHaveBeenCalled();
    });
    it('five neighboring base views keep existing list dispatcher', async () => {
      const f = fixture(read);
      for (const [pathname, capability, view] of [
        ['/api/v1/credit-limits', 'credit:read', 'limits'],
        ['/api/v1/credit-decisions', 'credit:read', 'credit'],
        ['/api/v1/contracts', 'contract:read', 'contracts'],
        ['/api/v1/sales-orders', 'sales-order:read', 'orders'],
        ['/api/v1/reconciliation-runs', 'reconciliation:read', 'reconciliation'],
      ] as const) {
        f.permissions.set(capability, { scopes: ['TEAM'], fields: null });
        expect((await f.dispatch({ pathname, query: { state: 'bad' } })).statusCode).toBe(200);
        expect(f.list.mock.calls.at(-1)?.[0]).toBe(view);
      }
      expect(f.listOperationalPage).not.toHaveBeenCalled();
    });
    it('repository DomainError preserves code/message/correlation', async () => {
      const f = fixture(read);
      f.listOperationalPage.mockRejectedValueOnce(new DomainError('not_found', 'ledger absent'));
      expect(await f.dispatch()).toEqual(error(404, 'not_found', 'ledger absent'));
    });
  });
