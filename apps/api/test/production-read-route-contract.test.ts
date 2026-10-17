// Fixed against d0f06d9 inline reads; no future production route imported.
import { describe, expect, it, vi } from 'vitest';
import { DomainError, type AuthorizationContext } from '@kingturf/domain';
import type { DataScope, JsonObject, PermissionKey } from '@kingturf/types';
import { buildApp, type ApiDependencies, type ApiRequest, type ApiResponse } from '../src/app.js';

type Production = NonNullable<ApiDependencies['production']>;
type Costs = NonNullable<ApiDependencies['productionCosts']>;
type Grant = NonNullable<ReturnType<AuthorizationContext['permissions']['get']>>;
const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const actor = { companyId: 'read-tenant', employeeId: id };
const correlationId = '33333333-3333-4333-8333-333333333333';
const row = { id, version: 7, name: 'visible', secret: 'private', nested: { retained: true } };
const second = { ...row, id: 'second', name: 'second' };
const routes = [
  { kind: 'orders', path: '/api/v1/production-orders', cap: 'production:read', projected: true },
  {
    kind: 'policies',
    path: '/api/v1/production-cost-policies',
    cap: 'manufacturing-cost:read',
    projected: false,
  },
  {
    kind: 'runs',
    path: '/api/v1/production-cost-runs',
    cap: 'manufacturing-cost:read',
    projected: true,
  },
] as const satisfies readonly {
  kind: string;
  path: string;
  cap: PermissionKey;
  projected: boolean;
}[];
type Route = (typeof routes)[number];
function fixture(
  options: {
    fields?: Grant['fields'];
    denied?: PermissionKey;
    available?: boolean;
    productionAvailable?: boolean;
    costsAvailable?: boolean;
    scopes?: readonly DataScope[];
  } = {},
) {
  const fields = options.fields === undefined ? null : options.fields;
  const scopes = options.scopes ?? ['TEAM'];
  const anchors = [{ scope: 'TEAM', organizationId: 'scope-anchor' }] as const;
  const permissions = new Map<PermissionKey, Grant>([
    ['production:read', { scopes, fields }],
    ['manufacturing-cost:read', { scopes, fields }],
  ]);
  if (options.denied) permissions.delete(options.denied);
  const context: AuthorizationContext = {
    actor,
    permissions,
    scopeAnchors: new Map([
      ['production:read', anchors],
      ['manufacturing-cost:read', anchors],
    ]),
  };
  const get = vi.spyOn(permissions, 'get');
  const rows: JsonObject[] = [row, second];
  const production = {
    list: vi.fn<Production['list']>().mockResolvedValue(rows),
    create: vi.fn().mockResolvedValue(row),
  };
  const costs = {
    list: vi.fn<Costs['list']>().mockResolvedValue(rows),
    listPolicies: vi.fn<Costs['listPolicies']>().mockResolvedValue(rows),
    createPolicy: vi.fn().mockResolvedValue(row),
    calculate: vi.fn().mockResolvedValue(row),
  };
  const app = buildApp({
    auth: {
      authenticate: vi.fn().mockResolvedValue(context),
    } as unknown as ApiDependencies['auth'],
    organizations: {} as ApiDependencies['organizations'],
    employees: {} as ApiDependencies['employees'],
    ...(options.available === false || options.productionAvailable === false
      ? {}
      : { production: production as unknown as Production }),
    ...(options.available === false || options.costsAvailable === false
      ? {}
      : { productionCosts: costs as unknown as Costs }),
  });
  const dispatch = (route: Route, options: Partial<ApiRequest> = {}) =>
    app.dispatch({
      method: 'GET',
      pathname: route.path,
      body: null,
      query: { limit: 'bad', cursor: 'not-uuid', version: 'bad', unknown: 'ignored' },
      ...options,
      headers: {
        authorization: 'Bearer fixture',
        'x-correlation-id': correlationId,
        'idempotency-key': 'x'.repeat(201),
        ...options.headers,
      },
    });
  return { production, costs, context, permissions, scopes, anchors, get, rows, dispatch };
}
const readMock = (f: ReturnType<typeof fixture>, route: Route) =>
  route.kind === 'orders'
    ? f.production.list
    : route.kind === 'policies'
      ? f.costs.listPolicies
      : f.costs.list;
const receiver = (f: ReturnType<typeof fixture>, route: Route) =>
  route.kind === 'orders' ? f.production : f.costs;
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
const denied = error(403, 'forbidden', 'Permission denied');
const missing = error(404, 'not_found', 'Route not found');
const noReads = (f: ReturnType<typeof fixture>) => {
  expect(f.production.list).not.toHaveBeenCalled();
  expect(f.costs.list).not.toHaveBeenCalled();
  expect(f.costs.listPolicies).not.toHaveBeenCalled();
};
function items(result: ApiResponse): readonly unknown[] {
  const body = result.body;
  if (typeof body !== 'object' || body === null || !('items' in body) || !Array.isArray(body.items))
    throw new Error('Expected items wrapper');
  return body.items as unknown[];
}

describe('old production read contracts', () => {
  it.each(routes)(
    '$kind one context argument/receiver/ref/order and fresh wrapper',
    async (route) => {
      const f = fixture();
      const first = await f.dispatch(route);
      const next = await f.dispatch(route);
      expect(first).toEqual(response(200, { items: f.rows }));
      expect(first.body).not.toBe(next.body);
      const mock = readMock(f, route);
      expect(mock.mock.calls).toHaveLength(2);
      expect(mock.mock.calls[0]).toEqual([{ actor, scopes: f.scopes, anchors: f.anchors }]);
      const passed = mock.mock.calls[0]?.[0];
      expect(Object.keys(passed ?? {})).toEqual(['actor', 'scopes', 'anchors']);
      expect(passed?.actor).toBe(actor);
      expect(passed?.scopes).toBe(f.scopes);
      expect(passed?.anchors).toBe(f.anchors);
      expect(mock.mock.contexts).toEqual([receiver(f, route), receiver(f, route)]);
      if (route.projected) expect(items(first)).not.toBe(f.rows);
      else expect(items(first)).toBe(f.rows);
      expect(items(first)[0]).toBe(row);
      expect(items(first)[1]).toBe(second);
      expect(f.get.mock.calls.every(([cap]) => cap === route.cap)).toBe(true);
      for (const other of routes)
        if (other.kind !== route.kind) expect(readMock(f, other)).not.toHaveBeenCalled();
    },
  );
  it.each(routes)('$kind missing capability rejects before repository/body', async (route) => {
    const f = fixture({ denied: route.cap });
    expect(await f.dispatch(route, { body: [] })).toEqual(denied);
    noReads(f);
  });
  it.each(routes)('$kind empty scopes reject', async (route) => {
    const f = fixture({ scopes: [] });
    expect(await f.dispatch(route)).toEqual(denied);
    noReads(f);
  });
  for (const route of routes) {
    it('own wrapper missing skips even while the other repository exists', async () => {
      const f = fixture({
        denied: route.cap,
        ...(route.kind === 'orders' ? { productionAvailable: false } : { costsAvailable: false }),
      });
      expect(await f.dispatch(route)).toEqual(missing);
      expect(f.get).not.toHaveBeenCalled();
      noReads(f);
    });
    it('own read works independently of the other repository', async () => {
      const f = fixture(
        route.kind === 'orders' ? { costsAvailable: false } : { productionAvailable: false },
      );
      expect((await f.dispatch(route)).statusCode).toBe(200);
      expect(readMock(f, route)).toHaveBeenCalledTimes(1);
    });
    it.each([true, false])(`${route.kind} missingrepo skips Q0 even denied=%s`, async (deny) => {
      const f = fixture({ available: false, ...(deny ? { denied: route.cap } : {}) });
      const getter = vi.fn(() => {
        throw new Error('Skipped body');
      });
      const body = Object.defineProperty({}, 'limit', { enumerable: true, get: getter });
      expect(await f.dispatch(route, { body })).toEqual(missing);
      expect(getter).not.toHaveBeenCalled();
      expect(f.get).not.toHaveBeenCalled();
      noReads(f);
    });
    it('global401 precedes missingrepo and Q0', async () => {
      const f = fixture({ available: false, denied: route.cap });
      expect(await f.dispatch(route, { headers: { authorization: '' } })).toEqual(
        error(401, 'authentication_required', 'A valid session is required'),
      );
      noReads(f);
    });
    it.each([
      { fields: null },
      { fields: [] },
      { fields: ['name'] },
      { fields: ['secret', 'id', 'name', 'version', 'nested'] },
      { fields: ['absent'] },
      { fields: ['name', 'name', 'id'] },
    ] as const)(
      `${route.kind} fields $fields preserve projection differences`,
      async ({ fields }) => {
        const f = fixture({ fields });
        const result = await f.dispatch(route);
        const actual = items(result);
        if (!route.projected || fields === null) {
          expect(actual).toEqual(f.rows);
          expect(actual[0]).toBe(row);
        } else {
          const selected: readonly string[] = fields;
          const expected = selected.includes('secret')
            ? [row, second]
            : selected.includes('name')
              ? [
                  { id, name: 'visible' },
                  { id: 'second', name: 'second' },
                ]
              : [{ id }, { id: 'second' }];
          expect(actual).toEqual(expected);
          expect(actual[0]).not.toBe(row);
          if (selected.includes('name') && !selected.includes('secret'))
            expect(Object.keys(actual[0] as object)).toEqual(['id', 'name']);
        }
        if (route.projected) expect(actual).not.toBe(f.rows);
        else expect(actual).toBe(f.rows);
      },
    );
    it.each([{ body: null }, { body: false }, { body: [] }, { body: { unknown: 'ignored' } }])(
      `${route.kind} ignores body $body and invalid query/header`,
      async ({ body }) => {
        const f = fixture();
        expect(
          (await f.dispatch(route, { body, headers: { 'idempotency-key': '' } })).statusCode,
        ).toBe(200);
      },
    );
    it('GET never touches body getter', async () => {
      const f = fixture();
      const getter = vi.fn(() => {
        throw new Error('GET body is ignored');
      });
      const body = Object.defineProperty({}, 'version', { enumerable: true, get: getter });
      expect((await f.dispatch(route, { body })).statusCode).toBe(200);
      expect(getter).not.toHaveBeenCalled();
    });
    it('GET never parses query getters', async () => {
      const f = fixture();
      const getter = vi.fn(() => {
        throw new Error('GET query is ignored');
      });
      const query = Object.defineProperty({}, 'cursor', { enumerable: true, get: getter });
      expect((await f.dispatch(route, { query })).statusCode).toBe(200);
      expect(getter).not.toHaveBeenCalled();
    });
    it('empty array stays wrapper and preserves map vs raw array', async () => {
      const f = fixture();
      const empty: JsonObject[] = [];
      readMock(f, route).mockResolvedValue(empty);
      const result = await f.dispatch(route);
      expect(result).toEqual(response(200, { items: [] }));
      if (route.projected) expect(items(result)).not.toBe(empty);
      else expect(items(result)).toBe(empty);
    });
    it('repository DomainError keeps envelope/correlation', async () => {
      const f = fixture();
      readMock(f, route).mockRejectedValue(new DomainError('forbidden', 'Company scope fixture'));
      expect(await f.dispatch(route)).toEqual(error(403, 'forbidden', 'Company scope fixture'));
    });
    it.each(['PATCH', 'DELETE', 'PUT'])(`${route.kind} unsupported %s stays404`, async (method) => {
      const f = fixture({ denied: route.cap });
      expect(await f.dispatch(route, { method, body: null })).toEqual(missing);
      expect(f.get).not.toHaveBeenCalled();
      noReads(f);
    });
    it.each(['trailing', 'upper', 'detail', 'method'])(
      `${route.kind} no collection alias %s`,
      async (variant) => {
        const f = fixture({ denied: route.cap });
        const pathname =
          variant === 'trailing'
            ? `${route.path}/`
            : variant === 'upper'
              ? route.path.toUpperCase()
              : variant === 'detail'
                ? `${route.path}/${id}`
                : route.path;
        expect(
          await f.dispatch(route, { pathname, method: variant === 'method' ? 'get' : 'GET' }),
        ).toEqual(missing);
        expect(f.get).not.toHaveBeenCalled();
        noReads(f);
      },
    );
    it('same-path POST is original write O first, not unsupported GET', async () => {
      const f = fixture({ denied: route.cap });
      expect(await f.dispatch(route, { method: 'POST', body: null })).toEqual(
        error(400, 'invalid_request', 'A JSON object body is required'),
      );
      noReads(f);
    });
  }
  it.each(['SELF', 'TEAM', 'DEPARTMENT', 'REGION', 'COMPANY', 'GROUP'] as const)(
    'scope %s forwarded unchanged (mock only)',
    async (scope) => {
      const f = fixture({ scopes: [scope] });
      for (const route of routes) expect((await f.dispatch(route)).statusCode).toBe(200);
      for (const route of routes)
        expect(readMock(f, route).mock.calls[0]?.[0].scopes).toBe(f.scopes);
    },
  );
  for (const route of [routes[0], routes[2]]) {
    it(`${route.kind} fields changed during await are read per row`, async () => {
      const f = fixture();
      const fields = vi.fn().mockReturnValueOnce([]).mockReturnValueOnce(['name']);
      readMock(f, route).mockImplementation(() => {
        const grant = { scopes: f.scopes, fields: null };
        Object.defineProperty(grant, 'fields', { get: fields });
        f.permissions.set(route.cap, grant);
        return Promise.resolve(f.rows);
      });
      expect(items(await f.dispatch(route))).toEqual([{ id }, { id: 'second', name: 'second' }]);
      expect(fields).toHaveBeenCalledTimes(2);
    });
    it(`${route.kind} grant removed during await falls back to null fields without reauthorization`, async () => {
      const f = fixture({ fields: [] });
      readMock(f, route).mockImplementation(() => {
        f.permissions.delete(route.cap);
        return Promise.resolve(f.rows);
      });
      const result = await f.dispatch(route);
      expect(result.statusCode).toBe(200);
      expect(items(result)[0]).toBe(row);
    });
    it(`${route.kind} projected Object.entries reads even excluded getter`, async () => {
      const f = fixture({ fields: [] });
      const getter = vi.fn(() => 'hidden');
      const value = Object.defineProperty({ id }, 'secret', { enumerable: true, get: getter });
      readMock(f, route).mockResolvedValue([value]);
      expect(items(await f.dispatch(route))).toEqual([{ id }]);
      expect(getter).toHaveBeenCalledTimes(1);
    });
    it(`${route.kind} fields null returns row without reading getter`, async () => {
      const f = fixture();
      const getter = vi.fn(() => {
        throw new Error('No projection enumeration');
      });
      const value = Object.defineProperty({ id }, 'secret', { enumerable: true, get: getter });
      readMock(f, route).mockResolvedValue([value]);
      expect(items(await f.dispatch(route))[0]).toBe(value);
      expect(getter).not.toHaveBeenCalled();
    });
    it(`${route.kind} no implicit id or absent fields are manufactured`, async () => {
      const f = fixture({ fields: ['name', 'absent'] });
      readMock(f, route).mockResolvedValue([{ name: 'no-id', secret: 'hidden' }]);
      expect(items(await f.dispatch(route))).toEqual([{ name: 'no-id' }]);
    });
    it(`${route.kind} special own keys remain safe literal keys`, async () => {
      const f = fixture({ fields: ['__proto__', 'constructor', 'toString'] });
      const value = Object.fromEntries([
        ['id', id],
        ['__proto__', { retained: true }],
        ['constructor', 'own'],
        ['toString', 'own'],
        ['secret', 'hidden'],
      ]) as JsonObject;
      readMock(f, route).mockResolvedValue([value]);
      const projected = items(await f.dispatch(route))[0];
      expect(projected).toEqual(
        Object.fromEntries([
          ['id', id],
          ['__proto__', { retained: true }],
          ['constructor', 'own'],
          ['toString', 'own'],
        ]),
      );
      expect(Object.getPrototypeOf(projected as object)).toBe(Object.prototype);
      expect(Object.keys(projected as object)).toEqual([
        'id',
        '__proto__',
        'constructor',
        'toString',
      ]);
    });
  }
  it('policies ignore post-await fields and do not enumerate excluded row getters', async () => {
    const f = fixture({ fields: [] });
    const getter = vi.fn(() => {
      throw new Error('Policies have no projection');
    });
    const value = Object.defineProperty({ id }, 'secret', { enumerable: true, get: getter });
    const values = [value];
    f.costs.listPolicies.mockImplementation(() => {
      const grant = { scopes: f.scopes, fields: null };
      Object.defineProperty(grant, 'fields', { get: getter });
      f.permissions.set('manufacturing-cost:read', grant);
      return Promise.resolve(values);
    });
    expect(items(await f.dispatch(routes[1]))).toBe(values);
    expect(getter).not.toHaveBeenCalled();
  });
  it.each(routes)(
    '$kind adjacent POST keeps original success/read DTO compatibility',
    async (route) => {
      const f = fixture();
      const capability =
        route.kind === 'orders'
          ? 'production:plan'
          : route.kind === 'policies'
            ? 'manufacturing-cost:policy'
            : 'manufacturing-cost:calculate';
      f.permissions.set(capability, { scopes: f.scopes, fields: null });
      const body =
        route.kind === 'orders'
          ? {
              orderNumber: 'ORDER_1',
              itemVersionId: id,
              routingVersionId: id,
              plannedQuantity: '1',
              plannedStartAt: '2026-10-14',
              plannedDueAt: '2026-10-15',
              sourceReference: 'SOURCE_1',
            }
          : route.kind === 'policies'
            ? {
                version: 1,
                currency: 'USD',
                laborRatePerHour: '1',
                machineRatePerHour: '2',
                overheadRatePerMachineHour: '3',
                effectiveFrom: '2026-10-14',
                sourceReference: 'SOURCE_1',
                materialRates: [{ itemVersionId: id, unitCost: '1', sourceReference: 'RATE_1' }],
              }
            : { productionOrderId: id, policyId: id, runNumber: 'RUN_1', idempotencyKey: 'KEY_1' };
      const result = await f.dispatch(route, { method: 'POST', body });
      expect(result).toEqual(response(201, row));
      expect(result.body).toBe(row);
      noReads(f);
      const write =
        route.kind === 'orders'
          ? f.production.create
          : route.kind === 'policies'
            ? f.costs.createPolicy
            : f.costs.calculate;
      expect(write).toHaveBeenCalledTimes(1);
      expect(write.mock.contexts).toEqual([receiver(f, route)]);
    },
  );
});
