// Frozen against f7f71f2 inline dashboard HTTP. Only old buildApp is imported.
import { describe, expect, it, vi } from 'vitest';
import { DomainError, type AuthorizationContext } from '@kingturf/domain';
import type { DataScope, JsonObject, PermissionKey } from '@kingturf/types';
import { buildApp, type ApiDependencies, type ApiRequest, type ApiResponse } from '../src/app.js';

type Repository = NonNullable<ApiDependencies['dashboard']>;
type Get = Repository['get'];
type MutableDependencies = { -readonly [K in keyof ApiDependencies]: ApiDependencies[K] };
type Grant = NonNullable<ReturnType<AuthorizationContext['permissions']['get']>>;
const path = '/api/v1/executive-dashboard';
const correlationId = '55555555-5555-4555-8555-555555555555';
const actor = {
  employeeId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  companyId: 'dashboard-old-http-mock',
};
const mappings = [
  ['weightedForecast', 'opportunity:read'],
  ['bookedRevenue', 'sales-order:read'],
  ['grossMargin', 'quote:read'],
  ['cashCollected', 'reconciliation:read'],
  ['openReceivable', 'ar:read'],
  ['overdueReceivable', 'ar:read'],
  ['releasedOrders', 'sales-order:read'],
  ['activeRisks', 'risk:read'],
  ['criticalRisks', 'risk:read'],
  ['commissionAccrued', 'commission:read'],
] as const satisfies readonly (readonly [string, PermissionKey])[];
const sources = [
  'opportunity:read',
  'sales-order:read',
  'quote:read',
  'reconciliation:read',
  'ar:read',
  'risk:read',
  'commission:read',
] as const satisfies readonly PermissionKey[];
const drills = [
  ['orders', 'sales-order:read'],
  ['overdue', 'ar:read'],
  ['risks', 'risk:read'],
] as const;
const validQuery = {
  from: '2026-01-01T00:00:00.000Z',
  to: '2027-01-01T00:00:00.000Z',
  currency: 'CNY',
};
const record = (value: unknown) => value as Record<string, unknown>;
function property(target: object, key: PropertyKey, get: () => unknown) {
  Object.defineProperty(target, key, { configurable: true, enumerable: true, get });
}
function aggregate() {
  const nested = { untouched: true };
  return {
    filters: { rawFilter: nested },
    refreshedAt: 'opaque-repository-refresh',
    metrics: Object.fromEntries(
      mappings.map(([key]) => [key, { value: key, nested, extra: true }]),
    ),
    drilldowns: { orders: [{ nested }], overdue: [{ nested }], risks: [{ nested }] },
    unknownOutput: 'not copied',
  };
}
function fixture(
  options: {
    missing?: boolean;
    unauthenticated?: boolean;
    denied?: boolean;
    scopes?: readonly DataScope[];
    fields?: Grant['fields'];
    sources?: readonly PermissionKey[];
    noAnchors?: boolean;
  } = {},
) {
  const scopes = options.scopes ?? ['TEAM'];
  const anchors = [{ scope: 'TEAM', organizationId: actor.employeeId }] as const;
  const permissions = new Map<PermissionKey, Grant>([
    [
      'executive-dashboard:read',
      { scopes, fields: options.fields === undefined ? null : options.fields },
    ],
  ]);
  for (const cap of options.sources ?? []) permissions.set(cap, { scopes: [], fields: [] });
  if (options.denied) permissions.delete('executive-dashboard:read');
  const context: AuthorizationContext = {
    actor,
    permissions,
    ...(options.noAnchors
      ? {}
      : { scopeAnchors: new Map([['executive-dashboard:read', anchors]]) }),
  };
  const returned = aggregate();
  const get = vi.fn<Get>().mockResolvedValue(returned);
  const repository = { get };
  const authenticate = vi
    .fn<ApiDependencies['auth']['authenticate']>()
    .mockResolvedValue(options.unauthenticated ? null : context);
  const dependencies: MutableDependencies = {
    auth: { authenticate } as unknown as ApiDependencies['auth'],
    organizations: {} as ApiDependencies['organizations'],
    employees: {} as ApiDependencies['employees'],
    ...(options.missing ? {} : { dashboard: repository as unknown as Repository }),
  };
  const headers = {
    authorization: 'Bearer mock-only-dashboard-session',
    'x-correlation-id': correlationId,
  };
  const app = buildApp(dependencies);
  const dispatch = (overrides: Partial<ApiRequest> = {}) =>
    app.dispatch({ method: 'GET', pathname: path, query: validQuery, headers, ...overrides });
  return {
    scopes,
    anchors,
    permissions,
    context,
    returned,
    get,
    repository,
    authenticate,
    dependencies,
    headers,
    app,
    dispatch,
  };
}
function error(response: ApiResponse, statusCode: number, code: string, message?: string) {
  expect(response.statusCode).toBe(statusCode);
  expect(response.body).toMatchObject({
    error: { code, correlationId, ...(message === undefined ? {} : { message }) },
  });
  expect(response.headers?.['x-correlation-id']).toBe(correlationId);
}
function deferred<T>() {
  let settle: ((value: T) => void) | undefined;
  const promise = new Promise<T>((resolve) => {
    settle = resolve;
  });
  return {
    promise,
    resolve(value: T) {
      if (!settle) throw new Error('missing resolver');
      settle(value);
    },
  };
}

describe('f7f71f2 dashboard existing source-permission contract', () => {
  for (let mask = 0; mask < 128; mask += 1) {
    it(
      'source presence mask ' + String(mask) + ' uses has only, not scopes or fields',
      async () => {
        const selected = sources.filter((_cap, index) => (mask & (1 << index)) !== 0);
        const f = fixture({ sources: selected, fields: [] });
        const permissionGet = vi.spyOn(f.permissions, 'get');
        const response = await f.dispatch();
        expect(response.statusCode).toBe(200);
        const body = record(response.body);
        expect(Object.keys(body)).toEqual(['filters', 'refreshedAt', 'metrics', 'drilldowns']);
        expect(body.filters).toBe(f.returned.filters);
        expect(body.refreshedAt).toBe(f.returned.refreshedAt);
        const metrics = record(body.metrics),
          drilldowns = record(body.drilldowns);
        expect(Object.keys(metrics)).toEqual(
          mappings.filter(([, cap]) => selected.includes(cap)).map(([key]) => key),
        );
        expect(Object.keys(drilldowns)).toEqual(
          drills.filter(([, cap]) => selected.includes(cap)).map(([key]) => key),
        );
        for (const [key, cap] of mappings)
          if (selected.includes(cap)) expect(metrics[key]).toBe(f.returned.metrics[key]);
        for (const [key, cap] of drills)
          if (selected.includes(cap)) expect(drilldowns[key]).toBe(f.returned.drilldowns[key]);
        expect(body.metrics).not.toBe(f.returned.metrics);
        expect(body.drilldowns).not.toBe(f.returned.drilldowns);
        expect(permissionGet.mock.calls.map(([cap]) => cap)).toEqual([
          'executive-dashboard:read',
          'executive-dashboard:read',
        ]);
        expect(f.get).toHaveBeenCalledExactlyOnceWith(validQuery, {
          actor,
          scopes: f.scopes,
          anchors: f.anchors,
        });
        expect(f.get.mock.contexts[0]).toBe(f.repository);
      },
    );
  }

  it('source grant fields/scopes are never read; has(undefined grant) still exposes its source', async () => {
    const f = fixture();
    for (const cap of sources) {
      const grant = {} as Grant;
      property(grant, 'scopes', () => {
        throw new Error('source scopes must not be read');
      });
      property(grant, 'fields', () => {
        throw new Error('source fields must not be read');
      });
      f.permissions.set(cap, grant);
    }
    f.permissions.set('commission:read', undefined as unknown as Grant);
    expect((await f.dispatch()).statusCode).toBe(200);
  });
  it.each([null, [], ['not-a-dashboard-field']] as const)(
    'dashboard fields %j do not trim its output',
    async (fields) => {
      const f = fixture({ fields, sources });
      expect(Object.keys(record(record((await f.dispatch()).body).metrics))).toHaveLength(10);
    },
  );
  it.each(['SELF', 'TEAM', 'DEPARTMENT', 'REGION', 'COMPANY', 'GROUP'] as const)(
    'scope %s is forwarded by identity without an HTTP source-scope precheck',
    async (scope) => {
      const scopes = [scope] as const;
      const f = fixture({ scopes });
      expect((await f.dispatch()).statusCode).toBe(200);
      expect(f.get.mock.calls[0]?.[1].scopes).toBe(scopes);
    },
  );
  it('scope anchors and actor are original refs; each query context is fresh', async () => {
    const f = fixture();
    await f.dispatch();
    await f.dispatch();
    const first = f.get.mock.calls[0]?.[1],
      second = f.get.mock.calls[1]?.[1];
    expect(first).toEqual({ actor, scopes: f.scopes, anchors: f.anchors });
    expect(first?.actor).toBe(actor);
    expect(first?.anchors).toBe(f.anchors);
    expect(first).not.toBe(second);
  });
  it('missing scopeAnchors produces a fresh empty anchors array on every request', async () => {
    const f = fixture({ noAnchors: true });
    await f.dispatch();
    await f.dispatch();
    const first = f.get.mock.calls[0]?.[1],
      second = f.get.mock.calls[1]?.[1];
    expect(first?.anchors).toEqual([]);
    expect(first?.anchors).not.toBe(second?.anchors);
  });
});

describe('dashboard old short-circuit guard and input/capture contract', () => {
  it.each([
    ['POST', path],
    ['PUT', path],
    ['DELETE', path],
    ['PATCH', path],
    ['HEAD', path],
    ['OPTIONS', path],
    ['get', path],
    ['GET', path + '/'],
    ['GET', path + '/extra'],
    ['GET', '/api/v1/quality-inspections'],
    ['GET', '/api/v1/risk-policies'],
  ])('%s %s is unsupported without reading dashboard root', async (method, pathname) => {
    const f = fixture();
    const root = vi.fn(() => {
      throw new Error('unsupported must skip root');
    });
    property(f.dependencies, 'dashboard', root);
    error(await f.dispatch({ method, pathname }), 404, 'not_found');
    expect(root).not.toHaveBeenCalled();
    expect(f.get).not.toHaveBeenCalled();
  });
  it.each([undefined, null, false, 0, ''])(
    'matching missing/falsy root %j is404, not503',
    async (value) => {
      const f = fixture();
      const root = vi.fn(() => value);
      property(f.dependencies, 'dashboard', root);
      error(await f.dispatch({ query: {} }), 404, 'not_found');
      expect(root).toHaveBeenCalledTimes(1);
      expect(f.get).not.toHaveBeenCalled();
    },
  );
  it.each([true, false])('global401 before root/query for missing session=%s', async (missing) => {
    const f = fixture({ unauthenticated: !missing });
    const root = vi.fn(() => {
      throw new Error('root must not be read');
    });
    property(f.dependencies, 'dashboard', root);
    const query = {};
    property(query, 'from', () => {
      throw new Error('query not read');
    });
    error(
      await f.dispatch({
        query,
        ...(missing ? { headers: { ...f.headers, authorization: undefined } } : {}),
      }),
      401,
      'authentication_required',
    );
    expect(root).not.toHaveBeenCalled();
  });
  it.each([{ denied: true }, { scopes: [] }])(
    'primary missing/empty grant403 before query %j',
    async (options) => {
      const f = fixture(options);
      const from = vi.fn(() => {
        throw new Error('query not read');
      });
      const query = {};
      property(query, 'from', from);
      error(await f.dispatch({ query }), 403, 'forbidden', 'Permission denied');
      expect(from).not.toHaveBeenCalled();
      expect(f.get).not.toHaveBeenCalled();
    },
  );
  it('first root error wins over denied primary grant', async () => {
    const f = fixture({ denied: true });
    property(f.dependencies, 'dashboard', () => {
      throw new Error('guard');
    });
    error(await f.dispatch(), 500, 'internal_error');
  });
  it('matching valid request reads root exactly twice and captures its method receiver', async () => {
    const f = fixture(),
      root = vi.fn(() => f.repository);
    property(f.dependencies, 'dashboard', root);
    await f.dispatch();
    expect(root).toHaveBeenCalledTimes(2);
    expect(f.get.mock.contexts[0]).toBe(f.repository);
    expect(f.get.mock.calls[0]).toHaveLength(2);
  });
  it.each([null, undefined])(
    'second root disappears as %j before invalid currency',
    async (value) => {
      const f = fixture();
      let reads = 0;
      property(f.dependencies, 'dashboard', () => (++reads === 1 ? f.repository : value));
      error(await f.dispatch({ query: { ...validQuery, currency: 'bad' } }), 500, 'internal_error');
      expect(reads).toBe(2);
      expect(f.get).not.toHaveBeenCalled();
    },
  );
  it('get getter error occurs before currency and actor', async () => {
    const f = fixture(),
      currency = vi.fn(() => 'CNY'),
      actorRead = vi.fn(() => actor);
    const query = { ...validQuery };
    property(query, 'currency', currency);
    property(f.context, 'actor', actorRead);
    property(f.repository, 'get', () => {
      throw new Error('get getter');
    });
    error(await f.dispatch({ query }), 500, 'internal_error');
    expect(currency).not.toHaveBeenCalled();
    expect(actorRead).not.toHaveBeenCalled();
  });
  it('from getter replacement before capture uses the replacement root/method/receiver', async () => {
    const f = fixture(),
      next = { get: vi.fn<Get>().mockResolvedValue(f.returned) };
    const query = { ...validQuery };
    property(query, 'from', () => {
      f.dependencies.dashboard = next as unknown as Repository;
      return validQuery.from;
    });
    expect((await f.dispatch({ query })).statusCode).toBe(200);
    expect(f.get).not.toHaveBeenCalled();
    expect(next.get.mock.contexts[0]).toBe(next);
  });
  it('to getter replacement before capture uses replacement root', async () => {
    const f = fixture(),
      next = { get: vi.fn<Get>().mockResolvedValue(f.returned) };
    const query = { ...validQuery };
    property(query, 'to', () => {
      f.dependencies.dashboard = next as unknown as Repository;
      return validQuery.to;
    });
    await f.dispatch({ query });
    expect(next.get).toHaveBeenCalledTimes(1);
    expect(f.get).not.toHaveBeenCalled();
  });
  it('currency getter root and method mutation is after capture and before actor', async () => {
    const f = fixture(),
      replacement = vi.fn<Get>().mockResolvedValue(f.returned),
      events: string[] = [];
    const query = { ...validQuery };
    property(query, 'currency', () => {
      events.push('currency');
      f.repository.get = replacement;
      delete f.dependencies.dashboard;
      return 'CNY';
    });
    property(f.context, 'actor', () => {
      events.push('actor');
      return actor;
    });
    expect((await f.dispatch({ query })).statusCode).toBe(200);
    expect(events).toEqual(['currency', 'actor']);
    expect(f.get).toHaveBeenCalledTimes(1);
    expect(f.get.mock.contexts[0]).toBe(f.repository);
    expect(replacement).not.toHaveBeenCalled();
  });
  it('get getter changes root but keeps old receiver; actor getter changes method after capture', async () => {
    const f = fixture(),
      replacement = vi.fn<Get>().mockResolvedValue(f.returned);
    property(f.repository, 'get', () => {
      delete f.dependencies.dashboard;
      return f.get;
    });
    property(f.context, 'actor', () => {
      Object.defineProperty(f.repository, 'get', { value: replacement });
      return actor;
    });
    expect((await f.dispatch()).statusCode).toBe(200);
    expect(f.get.mock.contexts[0]).toBe(f.repository);
    expect(replacement).not.toHaveBeenCalled();
  });

  const invalid = [undefined, null, false, true, 0, {}, [], '', '   ', 'not-a-date', '2026-99-01'];
  for (const field of ['from', 'to'] as const)
    for (const value of invalid) {
      it(
        field + ' invalid ' + JSON.stringify(value) + ' rejects before second root/currency',
        async () => {
          const f = fixture(),
            root = vi.fn(() => f.repository),
            currency = vi.fn(() => 'CNY');
          property(f.dependencies, 'dashboard', root);
          const query: Record<string, unknown> = { ...validQuery, [field]: value };
          property(query, 'currency', currency);
          error(
            await f.dispatch({ query: query as NonNullable<ApiRequest['query']> }),
            400,
            'invalid_request',
            typeof value === 'string' && value.trim()
              ? field + ' must be a valid timestamp'
              : field + ' is required',
          );
          expect(root).toHaveBeenCalledTimes(1);
          expect(currency).not.toHaveBeenCalled();
          expect(f.get).not.toHaveBeenCalled();
        },
      );
    }
  it.each([
    ['2026-01-01', '2026-01-01'],
    ['2027-01-01', '2026-01-01'],
    ['2026-01-01T08:00:00+08:00', '2026-01-01T00:00:00Z'],
  ])('range %s / %s compares normalized milliseconds before capture', async (from, to) => {
    const f = fixture(),
      root = vi.fn(() => f.repository);
    property(f.dependencies, 'dashboard', root);
    error(
      await f.dispatch({ query: { from, to, currency: 'bad' } }),
      400,
      'invalid_request',
      'from must be before to',
    );
    expect(root).toHaveBeenCalledTimes(1);
    expect(f.get).not.toHaveBeenCalled();
  });
  it.each([
    [
      ' 2026-01-01T08:00:00+08:00 ',
      '2026-01-02',
      '2026-01-01T00:00:00.000Z',
      '2026-01-02T00:00:00.000Z',
    ],
    ['2026-02-30', '2026-04-01', '2026-03-02T00:00:00.000Z', '2026-04-01T00:00:00.000Z'],
    ['0000-01-01', '9999-12-31', '0000-01-01T00:00:00.000Z', '9999-12-31T00:00:00.000Z'],
  ])(
    'old Date normalization %s / %s, without a new calendar/window rule',
    async (from, to, expectedFrom, expectedTo) => {
      const f = fixture();
      expect((await f.dispatch({ query: { from, to, currency: ' CNY ' } })).statusCode).toBe(200);
      expect(f.get.mock.calls[0]?.[0]).toEqual({
        from: expectedFrom,
        to: expectedTo,
        currency: 'CNY',
      });
    },
  );
  it.each([undefined, null, false, true, 0, {}, [], '', ' ', 'cny', 'CnY', 'US', 'CNY1', 'CN Y'])(
    'invalid currency %j is after method capture and before actor',
    async (value) => {
      const f = fixture(),
        root = vi.fn(() => f.repository),
        actorRead = vi.fn(() => actor);
      property(f.dependencies, 'dashboard', root);
      property(f.context, 'actor', actorRead);
      error(
        await f.dispatch({
          query: { ...validQuery, currency: value } as unknown as NonNullable<ApiRequest['query']>,
        }),
        400,
        'invalid_request',
        typeof value === 'string' && value.trim()
          ? 'Currency must be ISO 4217 uppercase'
          : 'currency is required',
      );
      expect(root).toHaveBeenCalledTimes(2);
      expect(actorRead).not.toHaveBeenCalled();
      expect(f.get).not.toHaveBeenCalled();
    },
  );
  it.each(['CNY', 'USD', 'EUR', 'ZZZ', 'AAA', ' JPY '])(
    'old uppercase three-letter currency %s',
    async (currency) => {
      const f = fixture();
      expect((await f.dispatch({ query: { ...validQuery, currency } })).statusCode).toBe(200);
      expect(f.get.mock.calls[0]?.[0].currency).toBe(currency.trim());
    },
  );
  it('input getters are from/to/currency once, method after comparison and before currency', async () => {
    const f = fixture(),
      events: string[] = [],
      query = {};
    for (const key of ['from', 'to', 'currency'] as const)
      property(query, key, () => {
        events.push(key);
        return validQuery[key];
      });
    let reads = 0;
    property(f.dependencies, 'dashboard', () => {
      events.push('root' + String(++reads));
      return f.repository;
    });
    property(f.repository, 'get', () => {
      events.push('method');
      return f.get;
    });
    property(f.context, 'actor', () => {
      events.push('actor');
      return actor;
    });
    await f.dispatch({ query });
    expect(events).toEqual(['root1', 'from', 'to', 'root2', 'method', 'currency', 'actor']);
  });
  it('query/body unknown nested values are ignored and are not cloned or whitelisted', async () => {
    const f = fixture(),
      query = { ...validQuery },
      body = {};
    property(query, 'unexpected', () => {
      throw new Error('unknown query read');
    });
    property(body, 'unexpected', () => {
      throw new Error('body must not be parsed');
    });
    expect((await f.dispatch({ query, body })).statusCode).toBe(200);
    expect(f.get.mock.calls[0]).toHaveLength(2);
  });
  it('top-level request shallow spread occurs before auth, with raw inner body/query refs', async () => {
    const f = fixture(),
      events: string[] = [],
      body = {};
    property(body, 'nested', () => {
      throw new Error('nested read');
    });
    const request: ApiRequest = { method: 'GET', pathname: path, headers: f.headers };
    property(request, 'body', () => {
      events.push('body');
      return body;
    });
    property(request, 'query', () => {
      events.push('query');
      return validQuery;
    });
    f.authenticate.mockImplementation(() => {
      events.push('auth');
      return Promise.resolve(f.context);
    });
    expect((await f.app.dispatch(request)).statusCode).toBe(200);
    expect(events).toEqual(['body', 'query', 'auth']);
  });
  it('outer spread getter errors reject before inner HTTP catch and before auth', async () => {
    const f = fixture(),
      failure = new Error('outer getter'),
      request: ApiRequest = { method: 'GET', pathname: path, headers: f.headers };
    property(request, 'body', () => {
      throw failure;
    });
    await expect(f.app.dispatch(request)).rejects.toBe(failure);
    expect(f.authenticate).not.toHaveBeenCalled();
  });
  it.each([undefined, null, [], 'text', 0])('GET body %j is not parsed', async (body) => {
    const f = fixture();
    expect((await f.dispatch({ body })).statusCode).toBe(200);
  });
  it.each([undefined, null, []])(
    'later QTC shared POST O may reject unsupported dashboard body %j',
    async (body) => {
      const f = fixture();
      f.dependencies.quoteToCash = {} as NonNullable<ApiDependencies['quoteToCash']>;
      const root = vi.fn(() => {
        throw new Error('dashboard skipped');
      });
      property(f.dependencies, 'dashboard', root);
      error(
        await f.dispatch({ method: 'POST', body }),
        400,
        'invalid_request',
        'A JSON object body is required',
      );
      expect(root).not.toHaveBeenCalled();
    },
  );
});

describe('dashboard late aggregate, getters and errors remain unvalidated old behavior', () => {
  it('all ten has decisions precede selected metric reads, then outer drilldowns/filters/refreshedAt and three drill decisions', async () => {
    const f = fixture({ sources }),
      events: string[] = [];
    const metrics = f.returned.metrics,
      drillObject = f.returned.drilldowns,
      filters = f.returned.filters;
    for (const [key] of mappings) {
      const value = metrics[key];
      property(metrics, key, () => {
        events.push('metric:' + key);
        return value;
      });
    }
    for (const [key] of drills) {
      const value = drillObject[key];
      property(drillObject, key, () => {
        events.push('drill:' + key);
        return value;
      });
    }
    property(f.returned, 'metrics', () => {
      events.push('metrics');
      return metrics;
    });
    property(f.returned, 'drilldowns', () => {
      events.push('drilldowns');
      return drillObject;
    });
    property(f.returned, 'filters', () => {
      events.push('filters');
      return filters;
    });
    property(f.returned, 'refreshedAt', () => {
      events.push('refreshedAt');
      return 'refresh';
    });
    const has = f.permissions.has.bind(f.permissions);
    vi.spyOn(f.permissions, 'has').mockImplementation((cap) => {
      events.push('has:' + cap);
      return has(cap);
    });
    expect((await f.dispatch()).statusCode).toBe(200);
    expect(events).toEqual([
      'metrics',
      ...mappings.map(([, cap]) => 'has:' + cap),
      ...mappings.map(([key]) => 'metric:' + key),
      'drilldowns',
      'filters',
      'refreshedAt',
      'has:sales-order:read',
      'drill:orders',
      'has:ar:read',
      'drill:overdue',
      'has:risk:read',
      'drill:risks',
    ]);
  });
  it('all filtering completes before metric getters change the Map; later drill decisions see those changes', async () => {
    const f = fixture({ sources: ['opportunity:read', 'sales-order:read'] });
    const weighted = f.returned.metrics.weightedForecast;
    property(f.returned.metrics, 'weightedForecast', () => {
      f.permissions.delete('sales-order:read');
      f.permissions.set('risk:read', { scopes: [], fields: [] });
      return weighted;
    });
    const response = await f.dispatch(),
      body = record(response.body);
    expect(Object.keys(record(body.metrics))).toEqual([
      'weightedForecast',
      'bookedRevenue',
      'releasedOrders',
    ]);
    expect(body.drilldowns).toEqual({ risks: f.returned.drilldowns.risks });
  });
  it('duplicated source capabilities are tested independently in metric-key order, not snapshotted per capability', async () => {
    const f = fixture({ sources: ['sales-order:read'] }),
      has = f.permissions.has.bind(f.permissions);
    vi.spyOn(f.permissions, 'has').mockImplementation((cap) => {
      const result = has(cap);
      if (cap === 'sales-order:read') f.permissions.delete(cap);
      return result;
    });
    const body = record((await f.dispatch()).body);
    expect(Object.keys(record(body.metrics))).toEqual(['bookedRevenue']);
    expect(body.drilldowns).toEqual({});
  });
  it('metrics/drilldowns/filters/refreshedAt and each drill getter can change rights at their original distinct moments', async () => {
    const f = fixture(),
      metrics = f.returned.metrics,
      drillObject = f.returned.drilldowns,
      filters = f.returned.filters;
    property(f.returned, 'metrics', () => {
      for (const cap of sources) f.permissions.set(cap, { scopes: [], fields: [] });
      return metrics;
    });
    const weighted = metrics.weightedForecast;
    property(metrics, 'weightedForecast', () => {
      for (const cap of sources) f.permissions.delete(cap);
      return weighted;
    });
    property(f.returned, 'drilldowns', () => {
      for (const [, cap] of drills) f.permissions.set(cap, { scopes: [], fields: [] });
      return drillObject;
    });
    property(f.returned, 'filters', () => {
      f.permissions.delete('ar:read');
      return filters;
    });
    property(f.returned, 'refreshedAt', () => {
      f.permissions.delete('risk:read');
      return 'opaque';
    });
    const orders = drillObject.orders;
    property(drillObject, 'orders', () => {
      f.permissions.set('ar:read', { scopes: [], fields: [] });
      f.permissions.set('risk:read', { scopes: [], fields: [] });
      return orders;
    });
    const body = record((await f.dispatch()).body);
    expect(Object.keys(record(body.metrics))).toHaveLength(10);
    expect(Object.keys(record(body.drilldowns))).toEqual(['orders', 'overdue', 'risks']);
    expect(body.filters).toBe(filters);
    expect(body.refreshedAt).toBe('opaque');
  });
  it('the cached outer drilldowns object is read before filters changes aggregate.drilldowns', async () => {
    const f = fixture({ sources: ['sales-order:read'] }),
      old = f.returned.drilldowns,
      filters = f.returned.filters;
    property(f.returned, 'filters', () => {
      f.returned.drilldowns = { orders: [], overdue: [], risks: [] };
      return filters;
    });
    expect(record(record((await f.dispatch()).body).drilldowns).orders).toBe(old.orders);
  });
  it('context.permissions can be replaced by the metric getter before filtering, not cached at authorize time', async () => {
    const f = fixture(),
      replacement = new Map<PermissionKey, Grant>([
        ['commission:read', { scopes: [], fields: [] }],
      ]);
    const metrics = f.returned.metrics;
    property(f.returned, 'metrics', () => {
      Object.defineProperty(f.context, 'permissions', { value: replacement });
      return metrics;
    });
    expect(Object.keys(record(record((await f.dispatch()).body).metrics))).toEqual([
      'commissionAccrued',
    ]);
  });
  it('await completes before output permission lookups and does not reauthorize primary grant', async () => {
    const f = fixture({ sources }),
      entered = deferred<undefined>(),
      reply = deferred<JsonObject>();
    f.get.mockImplementation(() => {
      entered.resolve(undefined);
      return reply.promise;
    });
    const pending = f.dispatch();
    await entered.promise;
    for (const cap of sources) f.permissions.delete(cap);
    f.permissions.delete('executive-dashboard:read');
    f.permissions.set('ar:read', { scopes: [], fields: [] });
    reply.resolve(f.returned);
    const response = await pending,
      body = record(response.body);
    expect(response.statusCode).toBe(200);
    expect(Object.keys(record(body.metrics))).toEqual(['openReceivable', 'overdueReceivable']);
    expect(body.drilldowns).toEqual({ overdue: f.returned.drilldowns.overdue });
  });
  it('authorization grant field getter can replace root before input parsing and second capture', async () => {
    const f = fixture(),
      next = { get: vi.fn<Get>().mockResolvedValue(f.returned) };
    const grant = f.permissions.get('executive-dashboard:read');
    if (!grant) throw new Error('missing fixture grant');
    property(grant, 'fields', () => {
      f.dependencies.dashboard = next as unknown as Repository;
      return null;
    });
    expect((await f.dispatch()).statusCode).toBe(200);
    expect(next.get.mock.contexts[0]).toBe(next);
    expect(f.get).not.toHaveBeenCalled();
  });
  it('a disappearing second grant get yields old scopes fallback instead of a new authorization', async () => {
    const f = fixture(),
      original = f.permissions.get.bind(f.permissions);
    let gets = 0;
    vi.spyOn(f.permissions, 'get').mockImplementation((cap) =>
      cap === 'executive-dashboard:read' && ++gets === 2 ? undefined : original(cap),
    );
    expect((await f.dispatch()).statusCode).toBe(200);
    expect(f.get.mock.calls[0]?.[1].scopes).toEqual([]);
  });
  it('get method getter can mutate currency before that argument is parsed', async () => {
    const f = fixture(),
      query = { ...validQuery };
    property(f.repository, 'get', () => {
      query.currency = 'USD';
      return f.get;
    });
    expect((await f.dispatch({ query })).statusCode).toBe(200);
    expect(f.get.mock.calls[0]?.[0].currency).toBe('USD');
  });
  it('actor reads after currency but uses grant and anchor refs captured earlier', async () => {
    const f = fixture(),
      replacement = [{ scope: 'COMPANY', organizationId: null }] as const;
    property(f.context, 'actor', () => {
      f.permissions.set('executive-dashboard:read', { scopes: ['GROUP'], fields: [] });
      Object.defineProperty(f.context, 'scopeAnchors', {
        value: new Map([['executive-dashboard:read', replacement]]),
      });
      return actor;
    });
    await f.dispatch();
    expect(f.get.mock.calls[0]?.[1].scopes).toBe(f.scopes);
    expect(f.get.mock.calls[0]?.[1].anchors).toBe(f.anchors);
  });

  it.each([undefined, null])(
    'nullish aggregate %j fails500 even with no source capabilities',
    async (value) => {
      const f = fixture();
      f.get.mockResolvedValue(value as unknown as JsonObject);
      error(await f.dispatch(), 500, 'internal_error');
      expect(f.get).toHaveBeenCalledTimes(1);
    },
  );
  it.each([false, 0, 'raw', [], {}, { metrics: null, drilldowns: null }])(
    'cast is not aggregate validation: %j can return200 when no source value is read',
    async (value) => {
      const f = fixture();
      f.get.mockResolvedValue(value as JsonObject);
      const response = await f.dispatch();
      expect(response.statusCode).toBe(200);
      expect(response.body).toEqual({
        filters: undefined,
        refreshedAt: undefined,
        metrics: {},
        drilldowns: {},
      });
    },
  );
  it.each([undefined, null])(
    'nullish metrics %j fails only when a metric was selected',
    async (value) => {
      const f = fixture({ sources: ['opportunity:read'] });
      property(f.returned, 'metrics', () => value);
      error(await f.dispatch(), 500, 'internal_error');
    },
  );
  it.each([false, 0, 'raw', [], {}])(
    'non-null primitive/empty metrics %j creates selected own undefined key',
    async (value) => {
      const f = fixture({ sources: ['opportunity:read'] });
      property(f.returned, 'metrics', () => value);
      const response = await f.dispatch(),
        metrics = record(record(response.body).metrics);
      expect(response.statusCode).toBe(200);
      expect(Object.keys(metrics)).toEqual(['weightedForecast']);
      expect(metrics.weightedForecast).toBeUndefined();
    },
  );
  it.each([undefined, null])(
    'nullish drilldowns %j fails on a permitted drill only',
    async (value) => {
      const f = fixture({ sources: ['sales-order:read'] });
      property(f.returned, 'drilldowns', () => value);
      error(await f.dispatch(), 500, 'internal_error');
    },
  );
  it.each([false, 0, 'raw', [], {}])(
    'non-null primitive/empty drilldowns %j is not schema validated',
    async (value) => {
      const f = fixture({ sources: ['sales-order:read'] });
      property(f.returned, 'drilldowns', () => value);
      const response = await f.dispatch(),
        drilldowns = record(record(response.body).drilldowns);
      expect(response.statusCode).toBe(200);
      expect(Object.keys(drilldowns)).toEqual(['orders']);
      expect(drilldowns.orders).toBeUndefined();
    },
  );
  it.each([undefined, null, false, 0, 'raw', [], {}])(
    'metric value %j is passed verbatim with no DTO/schema',
    async (value) => {
      const f = fixture({ sources: ['opportunity:read'] });
      record(f.returned.metrics).weightedForecast = value;
      const response = await f.dispatch();
      expect(response.statusCode).toBe(200);
      expect(record(record(response.body).metrics).weightedForecast).toBe(value);
    },
  );
  it('metric/drill/filter nested values and special own keys retain raw refs without eager value reads', async () => {
    const f = fixture({ sources: ['opportunity:read', 'sales-order:read'] }),
      nested = {};
    const row = Object.fromEntries([
      ['__proto__', nested],
      ['constructor', nested],
      ['prototype', nested],
      ['extra', nested],
    ]);
    property(row, 'value', () => {
      throw new Error('nested metric should not be enumerated');
    });
    record(f.returned.metrics).weightedForecast = row;
    record(f.returned.drilldowns).orders = row;
    property(f.returned, 'filters', () => row);
    const body = record((await f.dispatch()).body);
    expect(body.filters).toBe(row);
    expect(record(body.metrics).weightedForecast).toBe(row);
    expect(record(body.drilldowns).orders).toBe(row);
    expect(Object.hasOwn(row, '__proto__')).toBe(true);
    expect(Object.getPrototypeOf(row)).toBe(Object.prototype);
  });
  it('unmapped metrics, unselected metrics and drill internal getters are not read', async () => {
    const f = fixture();
    for (const [key] of mappings)
      property(f.returned.metrics, key, () => {
        throw new Error('unselected metric');
      });
    for (const [key] of drills)
      property(f.returned.drilldowns, key, () => {
        throw new Error('unselected drill');
      });
    property(f.returned.metrics, 'unknown', () => {
      throw new Error('unmapped metric');
    });
    expect((await f.dispatch()).statusCode).toBe(200);
  });
  for (const [key, cap] of mappings)
    it('selected throwing metric ' + key + ' preserves500-C', async () => {
      const f = fixture({ sources: [cap] });
      property(f.returned.metrics, key, () => {
        throw new Error(key);
      });
      error(await f.dispatch(), 500, 'internal_error');
    });
  for (const [key, cap] of drills)
    it('selected throwing drill ' + key + ' preserves500-C', async () => {
      const f = fixture({ sources: [cap] });
      property(f.returned.drilldowns, key, () => {
        throw new Error(key);
      });
      error(await f.dispatch(), 500, 'internal_error');
    });
  it.each(['metrics', 'drilldowns', 'filters', 'refreshedAt'] as const)(
    'aggregate %s getter exception remains500-C',
    async (key) => {
      const f = fixture();
      property(f.returned, key, () => {
        throw new Error(key);
      });
      error(await f.dispatch(), 500, 'internal_error');
      expect(f.get).toHaveBeenCalledTimes(1);
    },
  );
  it('source has throwing after await remains500 rather than reauthorizing or hiding error', async () => {
    const f = fixture();
    vi.spyOn(f.permissions, 'has').mockImplementation(() => {
      throw new Error('has');
    });
    error(await f.dispatch(), 500, 'internal_error');
    expect(f.get).toHaveBeenCalledTimes(1);
  });
  it.each(['from', 'to', 'currency'] as const)(
    'query %s getter exceptions stay500-C',
    async (key) => {
      const f = fixture(),
        query = { ...validQuery };
      property(query, key, () => {
        throw new Error(key);
      });
      error(await f.dispatch({ query }), 500, 'internal_error');
      expect(f.get).not.toHaveBeenCalled();
    },
  );
  it('missing get method still evaluates bad currency before call failure', async () => {
    const f = fixture();
    f.dependencies.dashboard = {} as Repository;
    error(
      await f.dispatch({ query: { ...validQuery, currency: 'bad' } }),
      400,
      'invalid_request',
      'Currency must be ISO 4217 uppercase',
    );
  });
  it('missing get method with valid input fails500 after actor evaluation', async () => {
    const f = fixture(),
      read = vi.fn(() => actor);
    property(f.context, 'actor', read);
    f.dependencies.dashboard = {} as Repository;
    error(await f.dispatch(), 500, 'internal_error');
    expect(read).toHaveBeenCalledTimes(1);
  });
  for (const [cause, status, code] of [
    [new DomainError('forbidden', 'frozen'), 403, 'forbidden'],
    [new DomainError('invalid_request', 'frozen'), 400, 'invalid_request'],
    [new DomainError('not_found', 'frozen'), 404, 'not_found'],
    [new DomainError('conflict', 'frozen'), 409, 'conflict'],
    [new Error('ordinary'), 500, 'internal_error'],
  ] as const)
    it('repository error ' + code + ' keeps wrapper status/C', async () => {
      const f = fixture();
      f.get.mockRejectedValue(cause);
      error(await f.dispatch(), status, code);
      expect(f.get).toHaveBeenCalledTimes(1);
    });
});
describe('dashboard final old-query and inherited-value edge audit', () => {
  it('missing query uses old from-required error rather than defaults', async () => {
    const f = fixture();
    error(
      await f.app.dispatch({ method: 'GET', pathname: path, headers: f.headers }),
      400,
      'invalid_request',
      'from is required',
    );
  });
  it.each([null, false, 0, 'ignored', []])(
    'query shape %j is not subject to an object whitelist',
    async (query) => {
      const f = fixture();
      error(
        await f.dispatch({ query: query as unknown as NonNullable<ApiRequest['query']> }),
        400,
        'invalid_request',
        'from is required',
      );
      expect(f.get).not.toHaveBeenCalled();
    },
  );
  it('inherited query values remain visible without cloning/own-key filtering', async () => {
    const f = fixture(),
      query: unknown = Object.create(validQuery);
    expect(
      (await f.dispatch({ query: query as NonNullable<ApiRequest['query']> })).statusCode,
    ).toBe(200);
    expect(f.get.mock.calls[0]?.[0]).toEqual(validQuery);
  });
  it('inherited permitted metric and drill values retain refs as own projected entries', async () => {
    const f = fixture({ sources: ['opportunity:read', 'sales-order:read'] }),
      value = { nested: {} },
      orders = [value];
    const metrics: unknown = Object.create({
      weightedForecast: value,
      bookedRevenue: value,
      releasedOrders: value,
    });
    const drilldowns: unknown = Object.create({ orders });
    property(f.returned, 'metrics', () => metrics);
    property(f.returned, 'drilldowns', () => drilldowns);
    const body = record((await f.dispatch()).body);
    expect(Object.keys(record(body.metrics))).toEqual([
      'weightedForecast',
      'bookedRevenue',
      'releasedOrders',
    ]);
    expect(record(body.metrics).weightedForecast).toBe(value);
    expect(record(body.drilldowns).orders).toBe(orders);
  });
  it('bad from wins over a throwing to getter', async () => {
    const f = fixture(),
      query = { ...validQuery, from: 'not-a-date' },
      to = vi.fn(() => {
        throw new Error('later to');
      });
    property(query, 'to', to);
    error(await f.dispatch({ query }), 400, 'invalid_request', 'from must be a valid timestamp');
    expect(to).not.toHaveBeenCalled();
  });
  it('bad to wins over a throwing currency getter', async () => {
    const f = fixture(),
      query = { ...validQuery, to: '' },
      currency = vi.fn(() => {
        throw new Error('later currency');
      });
    property(query, 'currency', currency);
    error(await f.dispatch({ query }), 400, 'invalid_request', 'to is required');
    expect(currency).not.toHaveBeenCalled();
  });
  it('primary grant fields getter error is not skipped just because Q0 has no requested fields', async () => {
    const f = fixture(),
      grant = f.permissions.get('executive-dashboard:read');
    if (!grant) throw new Error('missing fixture grant');
    property(grant, 'fields', () => {
      throw new Error('primary fields');
    });
    error(await f.dispatch(), 500, 'internal_error');
    expect(f.get).not.toHaveBeenCalled();
  });
  it('scope-anchor lookup error precedes from parsing and second root capture', async () => {
    const f = fixture(),
      query = { ...validQuery },
      from = vi.fn(() => validQuery.from);
    property(query, 'from', from);
    property(f.context, 'scopeAnchors', () => {
      throw new Error('anchors');
    });
    error(await f.dispatch({ query }), 500, 'internal_error');
    expect(from).not.toHaveBeenCalled();
    expect(f.get).not.toHaveBeenCalled();
  });
});
