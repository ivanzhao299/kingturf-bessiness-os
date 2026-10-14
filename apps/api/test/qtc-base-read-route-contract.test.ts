// Fixed against c7833e7 inline qtcReads; no future QTC route module imported.
import { describe, expect, it, vi } from 'vitest';
import { DomainError, type AuthorizationContext } from '@kingturf/domain';
import type { DataScope, JsonObject, PermissionKey } from '@kingturf/types';
import { buildApp, type ApiDependencies, type ApiRequest } from '../src/app.js';
type Qtc = NonNullable<ApiDependencies['quoteToCash']>;
type Grant = NonNullable<ReturnType<AuthorizationContext['permissions']['get']>>;
const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const other = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const correlationId = '33333333-3333-4333-8333-333333333333';
const actor = { companyId: 'qtc-read-mock', employeeId: id };
const nested = { keep: true };
const row: JsonObject = { id, version: 7, name: 'first', secret: 'private', nested };
const second: JsonObject = { id: other, name: 'second', nested };
const reads = [
  { path: '/api/v1/credit-limits', capability: 'credit:read', view: 'limits' },
  { path: '/api/v1/credit-decisions', capability: 'credit:read', view: 'credit' },
  { path: '/api/v1/contracts', capability: 'contract:read', view: 'contracts' },
  { path: '/api/v1/sales-orders', capability: 'sales-order:read', view: 'orders' },
  {
    path: '/api/v1/reconciliation-runs',
    capability: 'reconciliation:read',
    view: 'reconciliation',
  },
] as const;
type Read = (typeof reads)[number];
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
  const permissions = new Map<PermissionKey, Grant>(
    [
      'credit:read',
      'contract:read',
      'sales-order:read',
      'reconciliation:read',
      'ar:read',
      'bank-payment:read',
    ].map((cap) => [
      cap as PermissionKey,
      { scopes, fields: options.fields === undefined ? null : options.fields },
    ]),
  );
  if (options.denied) permissions.delete(read.capability);
  const context: AuthorizationContext = {
    actor,
    permissions,
    scopeAnchors: new Map([[read.capability, anchors]]),
  };
  const get = vi.spyOn(permissions, 'get');
  const items = [row, second];
  const list = vi.fn<Qtc['list']>().mockResolvedValue(items);
  const quoteToCash = { list };
  const authenticate = vi.fn().mockResolvedValue(context);
  const app = buildApp({
    auth: { authenticate } as unknown as ApiDependencies['auth'],
    organizations: {} as ApiDependencies['organizations'],
    employees: {} as ApiDependencies['employees'],
    ...(options.available === false ? {} : { quoteToCash: quoteToCash as unknown as Qtc }),
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
    list,
    quoteToCash,
    items,
    authenticate,
    context,
    permissions,
    get,
    scopes,
    anchors,
    dispatch,
    headers,
  };
}
const response = (statusCode: number, body: unknown) => ({
  statusCode,
  body,
  headers: { 'x-correlation-id': correlationId },
});
const error = (statusCode: number, code: string, message: string) =>
  response(statusCode, { error: { code, message, correlationId } });
const denied = error(403, 'forbidden', 'Permission denied');
const missing = error(404, 'not_found', 'Route not found');
const invalid = (message: string) => error(400, 'invalid_request', message);

for (const read of reads)
  describe('old QTC base GET ' + read.view, () => {
    it('one cap/no requested fields/two args/original receiver/ctx refs and key order', async () => {
      const f = fixture(read);
      const result = await f.dispatch();
      expect(result).toEqual(response(200, { items: f.items }));
      expect(f.list.mock.calls[0]).toEqual([
        read.view,
        { actor, scopes: f.scopes, anchors: f.anchors },
      ]);
      expect(f.list.mock.calls[0]).toHaveLength(2);
      expect(f.list.mock.contexts[0]).toBe(f.quoteToCash);
      const scope = f.list.mock.calls[0]?.[1];
      expect(Object.keys(scope ?? {})).toEqual(['actor', 'scopes', 'anchors']);
      expect(scope?.actor).toBe(actor);
      expect(scope?.scopes).toBe(f.scopes);
      expect(scope?.anchors).toBe(f.anchors);
      expect(f.get.mock.calls.every(([cap]) => cap === read.capability)).toBe(true);
      expect(f.get).toHaveBeenCalledTimes(4);
      expect(Object.keys(result.body as object)).toEqual(['items']);
    });
    it('new wrapper/items arrays per request, raw row refs/order retained, ctx fresh', async () => {
      const f = fixture(read);
      const a = await f.dispatch(),
        b = await f.dispatch();
      expect(a.body).not.toBe(b.body);
      const firstItems = (a.body as { items: JsonObject[] }).items;
      const secondItems = (b.body as { items: JsonObject[] }).items;
      expect(firstItems).not.toBe(f.items);
      expect(firstItems).not.toBe(secondItems);
      expect(firstItems[0]).toBe(row);
      expect(firstItems[1]).toBe(second);
      expect(f.list.mock.calls[0]?.[1]).not.toBe(f.list.mock.calls[1]?.[1]);
    });
    it.each(['SELF', 'TEAM', 'DEPARTMENT', 'REGION', 'COMPANY', 'GROUP'] as const)(
      'scope %s only forwards refs, not PG matrix',
      async (scope) => {
        const f = fixture(read, { scopes: [scope] });
        expect((await f.dispatch()).statusCode).toBe(200);
        expect(f.list.mock.calls[0]?.[1].scopes).toBe(f.scopes);
        expect(f.list.mock.calls[0]?.[1].anchors).toBe(f.anchors);
      },
    );
    it.each([{ denied: true }, { scopes: [] }])(
      'denied %j before method/actor',
      async (options) => {
        const f = fixture(read, options);
        const getter = vi.fn(() => {
          throw new Error('not reached');
        });
        Object.defineProperty(f.quoteToCash, 'list', { get: getter });
        Object.defineProperty(f.context, 'actor', { get: getter });
        expect(await f.dispatch({ body: null, query: { limit: 'invalid' } })).toEqual(denied);
        expect(getter).not.toHaveBeenCalled();
      },
    );
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
        fields: ['version', 'nested'],
        expected: [
          { id, version: 7, nested },
          { id: other, nested },
        ],
      },
    ])(
      'fields $fields accepted with empty requested fields/late P',
      async ({ fields, expected }) => {
        const f = fixture(read, { fields });
        const result = await f.dispatch();
        expect(result).toEqual(response(200, { items: expected }));
        const resultItems = (result.body as { items: JsonObject[] }).items;
        if (fields === null) expect(resultItems[0]).toBe(row);
        else expect(resultItems[0]).not.toBe(row);
        if (fields?.some((field) => field === 'nested'))
          expect(resultItems[0]?.nested).toBe(nested);
      },
    );
    it.each(
      [undefined, null, [], '', 0, false, { arbitrary: 'ignored' }].map((body) => ({ body })),
    )('body $body ignored, unlike shared POST', async ({ body }) => {
      const f = fixture(read);
      expect(await f.dispatch({ body })).toEqual(response(200, { items: f.items }));
    });
    it('body/query getters not read; global header spread reads key once before route', async () => {
      const f = fixture(read);
      const getter = vi.fn(() => {
        throw new Error('ignored');
      });
      const body = Object.defineProperty({}, 'idempotencyKey', { enumerable: true, get: getter });
      const query = Object.defineProperty({}, 'limit', { enumerable: true, get: getter });
      const headerGetter = vi.fn(() => {
        expect(f.get).not.toHaveBeenCalled();
        expect(f.list).not.toHaveBeenCalled();
        return 'IGNORED';
      });
      const headers = Object.defineProperty({ ...f.headers }, 'idempotency-key', {
        enumerable: true,
        get: headerGetter,
      });
      expect((await f.dispatch({ body, query, headers })).statusCode).toBe(200);
      expect(getter).not.toHaveBeenCalled();
      expect(headerGetter).toHaveBeenCalledOnce();
    });
    it.each([undefined, '', 'DIFFERENT', 'x'.repeat(201)])('header %s ignored', async (key) => {
      const f = fixture(read);
      expect(
        (
          await f.dispatch({
            headers: { ...f.headers, 'idempotency-key': key },
            query: {
              state: 'INVALID',
              minAmount: 'bad',
              maxAmount: 'bad',
              limit: 'bad',
              cursor: 'bad',
              query: ' ',
              from: 'bad',
              to: 'bad',
            },
          })
        ).statusCode,
      ).toBe(200);
      expect(f.list.mock.calls[0]?.[0]).toBe(read.view);
    });
    it('absent repo skips authorization/body/query to final404; global401 first', async () => {
      const f = fixture(read, { available: false, denied: true });
      const getter = vi.fn(() => {
        throw new Error('ignored');
      });
      expect(
        await f.dispatch({
          body: null,
          query: Object.defineProperty({}, 'state', { get: getter }),
        }),
      ).toEqual(missing);
      expect(f.get).not.toHaveBeenCalled();
      f.authenticate.mockResolvedValueOnce(null);
      expect(await f.dispatch()).toEqual(
        error(401, 'authentication_required', 'A valid session is required'),
      );
      expect(getter).not.toHaveBeenCalled();
    });
    it('no bearer global401 even with repo', async () => {
      const f = fixture(read);
      expect(await f.dispatch({ headers: { 'x-correlation-id': correlationId } })).toEqual(
        error(401, 'authentication_required', 'A valid session is required'),
      );
      expect(f.list).not.toHaveBeenCalled();
      expect(f.get).not.toHaveBeenCalled();
    });
    it('absent scopeAnchors uses fresh empty grant anchors, not a new HTTP denial', async () => {
      const f = fixture(read);
      Object.defineProperty(f.context, 'scopeAnchors', { value: undefined });
      expect((await f.dispatch()).statusCode).toBe(200);
      expect((await f.dispatch()).statusCode).toBe(200);
      expect(f.list.mock.calls[0]?.[1].anchors).toEqual([]);
      expect(f.list.mock.calls[0]?.[1].anchors).not.toBe(f.list.mock.calls[1]?.[1].anchors);
    });
    it.each(['PATCH', 'PUT', 'DELETE', 'HEAD', 'get'])(
      'unsupported method %s skips GET/POST',
      async (method) => {
        const f = fixture(read, { denied: true });
        expect(await f.dispatch({ method, body: null })).toEqual(missing);
        expect(f.get).not.toHaveBeenCalled();
      },
    );
    it.each([
      read.path + '/',
      read.path + '/' + id,
      read.path + '/extra',
      read.path.replace('/api/v1/', '/api/V1/'),
      read.path.toUpperCase(),
    ])('unsupported exact path %s', async (pathname) => {
      const f = fixture(read, { denied: true });
      expect(await f.dispatch({ pathname, body: null })).toEqual(missing);
      expect(f.get).not.toHaveBeenCalled();
    });
    it('POST samepath and unknownpath still share outer O before route authorization', async () => {
      const f = fixture(read, { denied: true });
      for (const pathname of [read.path, '/api/v1/not-a-qtc-command'])
        expect(await f.dispatch({ method: 'POST', pathname, body: null })).toEqual(
          invalid('A JSON object body is required'),
        );
      expect(f.get).not.toHaveBeenCalled();
      expect(f.list).not.toHaveBeenCalled();
      expect(
        await f.dispatch({ method: 'POST', pathname: '/api/v1/not-a-qtc-command', body: {} }),
      ).toEqual(missing);
    });
    it('method captured after auth and before actor; late fields not captured pre-await', async () => {
      const f = fixture(read);
      const events: string[] = [];
      const fields = vi.fn(() => {
        events.push('late fields');
        return null;
      });
      Object.defineProperty(f.quoteToCash, 'list', {
        get: () => {
          events.push('method');
          expect(f.get).toHaveBeenCalledTimes(2);
          return f.list;
        },
      });
      Object.defineProperty(f.context, 'actor', {
        get: () => {
          events.push('actor');
          return actor;
        },
      });
      f.list.mockImplementationOnce(() => {
        events.push('call');
        f.permissions.set(read.capability, {
          scopes: [],
          get fields() {
            return fields();
          },
        });
        return Promise.resolve(f.items);
      });
      expect((await f.dispatch()).statusCode).toBe(200);
      expect(events).toEqual(['method', 'actor', 'call', 'late fields', 'late fields']);
      expect(fields).toHaveBeenCalledTimes(2);
    });
    it('actor getter replacing list cannot change captured method', async () => {
      const f = fixture(read);
      const replacement = vi.fn<Qtc['list']>().mockResolvedValue([]);
      Object.defineProperty(f.context, 'actor', {
        get: () => {
          f.quoteToCash.list = replacement;
          return actor;
        },
      });
      expect(await f.dispatch()).toEqual(response(200, { items: f.items }));
      expect(f.list).toHaveBeenCalledOnce();
      expect(replacement).not.toHaveBeenCalled();
      expect(f.list.mock.contexts[0]).toBe(f.quoteToCash);
    });
    it('await Map deletion falls back to null/raw rows, not deny or id-version fallback', async () => {
      const f = fixture(read, { fields: [] });
      f.list.mockImplementationOnce(() => {
        f.permissions.delete(read.capability);
        return Promise.resolve(f.items);
      });
      const result = await f.dispatch();
      expect(result).toEqual(response(200, { items: f.items }));
      expect((result.body as { items: JsonObject[] }).items[0]).toBe(row);
    });
    it.each([{ fields: undefined }, { fields: null }])(
      'await fields nullish $fields falls back raw',
      async ({ fields }) => {
        const f = fixture(read, { fields: [] });
        f.list.mockImplementationOnce(() => {
          f.permissions.set(read.capability, { scopes: [], fields } as unknown as Grant);
          return Promise.resolve(f.items);
        });
        const result = await f.dispatch();
        expect((result.body as { items: JsonObject[] }).items[0]).toBe(row);
      },
    );
    it('each row re-reads await fields; new rows/P preserves order and nested ref', async () => {
      const f = fixture(read);
      const getter = vi
        .fn<() => Grant['fields']>()
        .mockReturnValueOnce(['name'])
        .mockReturnValueOnce(['nested']);
      f.list.mockImplementationOnce(() => {
        f.permissions.set(read.capability, {
          scopes: [],
          get fields() {
            return getter();
          },
        });
        return Promise.resolve(f.items);
      });
      const result = await f.dispatch();
      expect(result).toEqual(
        response(200, {
          items: [
            { id, name: 'first' },
            { id: other, nested },
          ],
        }),
      );
      expect(getter).toHaveBeenCalledTimes(2);
      expect((result.body as { items: JsonObject[] }).items[1]?.nested).toBe(nested);
    });
    it('empty array still new wrapper/new array; no row permission lookup', async () => {
      const f = fixture(read);
      const items: JsonObject[] = [];
      const getter = vi.fn(() => null);
      f.list.mockImplementationOnce(() => {
        f.permissions.set(read.capability, {
          scopes: [],
          get fields() {
            return getter();
          },
        });
        return Promise.resolve(items);
      });
      const result = await f.dispatch();
      expect(result).toEqual(response(200, { items: [] }));
      expect((result.body as { items: JsonObject[] }).items).not.toBe(items);
      expect(getter).not.toHaveBeenCalled();
      expect(f.get).toHaveBeenCalledTimes(2);
    });
    it('finite projection eagerly enumerates excluded getter, null projection does not', async () => {
      const getter = vi.fn(() => 'secret');
      const item: JsonObject = {
        id,
        get secret() {
          return getter();
        },
      };
      const raw = fixture(read);
      raw.list.mockResolvedValueOnce([item]);
      expect((await raw.dispatch()).body).toEqual({ items: [item] });
      expect(getter).not.toHaveBeenCalled();
      const finite = fixture(read, { fields: [] });
      finite.list.mockResolvedValueOnce([item]);
      expect(await finite.dispatch()).toEqual(response(200, { items: [{ id }] }));
      expect(getter).toHaveBeenCalledOnce();
    });
    it('special own keys order/row nestedref/no fabricated id', async () => {
      const item: JsonObject = Object.fromEntries<JsonObject[string]>([
        ['toString', 'data'],
        ['__proto__', nested],
        ['constructor', 'data'],
        ['version', 7],
      ]);
      const f = fixture(read, { fields: ['version', '__proto__', 'constructor', 'toString'] });
      f.list.mockResolvedValueOnce([item]);
      const result = await f.dispatch();
      const projected = (result.body as { items: JsonObject[] }).items[0];
      expect(projected).toEqual(item);
      expect(projected).not.toBe(item);
      expect(Object.keys(projected ?? {})).toEqual([
        'toString',
        '__proto__',
        'constructor',
        'version',
      ]);
      expect(Object.hasOwn(projected ?? {}, 'id')).toBe(false);
      expect(Object.getPrototypeOf(projected)).toBe(Object.prototype);
      expect(projected?.__proto__).toBe(nested);
    });
    it.each([
      { code: 'conflict', status: 409 },
      { code: 'forbidden', status: 403 },
      { code: 'not_found', status: 404 },
      { code: 'invalid_request', status: 400 },
    ] as const)('repo $code keeps C and does not project on error', async ({ code, status }) => {
      const f = fixture(read);
      f.list.mockRejectedValueOnce(new DomainError(code, 'original repository error'));
      expect(await f.dispatch()).toEqual(error(status, code, 'original repository error'));
      expect(f.get).toHaveBeenCalledTimes(2);
    });
    it('operational siblings and foreign domain routes are not basic list', async () => {
      const f = fixture(read);
      for (const pathname of ['/api/v1/ar-open-items', '/api/v1/bank-payments'])
        expect(await f.dispatch({ pathname, query: { state: 'INVALID' } })).toEqual(
          invalid('state is unsupported'),
        );
      for (const pathname of ['/api/v1/contract-documents', '/api/v1/commissions'])
        expect(await f.dispatch({ pathname })).toEqual(missing);
      expect(f.list).not.toHaveBeenCalled();
    });
  });
