// Frozen against f1a6bf5 inline order-360 HTTP, not a SQL/PG algorithm oracle.
import { describe, expect, it, vi } from 'vitest';
import { DomainError, type AuthorizationContext } from '@kingturf/domain';
import type { DataScope, PermissionKey } from '@kingturf/types';
import { buildApp, type ApiDependencies, type ApiRequest, type ApiResponse } from '../src/app.js';

type Grant = NonNullable<ReturnType<AuthorizationContext['permissions']['get']>>;
type Repository = NonNullable<ApiDependencies['order360']>;
type MutableDependencies = { -readonly [K in keyof ApiDependencies]: ApiDependencies[K] };
type Call = (...args: unknown[]) => Promise<unknown>;
const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const path = '/api/v1/sales-orders/' + id + '/360';
const correlationId = '77777777-7777-4777-8777-777777777777';
const actor = { employeeId: id, companyId: 'order360-old-http-mock' };
// Independent fixed old-source table: do not derive expectations from production helpers.
const sections = [
  ['customer', 'customer:read'],
  ['opportunity', 'opportunity:read'],
  ['technical', 'technical-solution:read'],
  ['cost', 'cost:read'],
  ['policy', 'sales-policy:read'],
  ['quote', 'quote:read'],
  ['credit', 'credit:read'],
  ['contract', 'contract:read'],
  ['receivables', 'ar:read'],
  ['payments', 'bank-payment:read'],
  ['reconciliations', 'reconciliation:read'],
  ['commissions', 'commission:read'],
  ['risks', 'risk:read'],
  ['shipments', 'shipment:read'],
  ['collections', 'collection:read'],
  ['legal', 'legal-case:read'],
] as const satisfies readonly (readonly [string, PermissionKey])[];
const entry = 'order-360:read';
const order = 'sales-order:read';
const caps: readonly PermissionKey[] = [entry, order, ...sections.map(([, cap]) => cap)];
const record = (value: unknown) => value as Record<string, unknown>;
function required<T>(value: T | undefined): T {
  if (value === undefined) throw new Error('missing fixture');
  return value;
}
function property(target: object, key: PropertyKey, get: () => unknown) {
  Object.defineProperty(target, key, { configurable: true, enumerable: true, get });
}
function fixture(sourceCaps: readonly PermissionKey[] = []) {
  const permissions = new Map<PermissionKey, Grant>();
  const scopeAnchors = new Map<
    PermissionKey,
    readonly { scope: 'TEAM'; organizationId: string }[]
  >();
  for (const cap of [entry, order, ...sourceCaps] as const) {
    permissions.set(cap, { scopes: ['TEAM'], fields: null });
    scopeAnchors.set(cap, [{ scope: 'TEAM', organizationId: id }]);
  }
  const context: AuthorizationContext = { actor, permissions, scopeAnchors };
  const nested = { opaque: true };
  const output: Record<string, unknown> = {
    ...Object.fromEntries(sections.map(([name]) => [name, null])),
    order: { id, name: 'Order', nested, canonical_hash: 'mock-opaque-hash' },
    anomalies: [{ opaqueAnomaly: nested }],
    timeline: [],
    unlisted: { nested },
  };
  const get = vi.fn<Call>().mockResolvedValue(output);
  const repository = { get };
  const authenticate = vi.fn<ApiDependencies['auth']['authenticate']>().mockResolvedValue(context);
  const dependencies: MutableDependencies = {
    auth: { authenticate } as unknown as ApiDependencies['auth'],
    organizations: {} as ApiDependencies['organizations'],
    employees: {} as ApiDependencies['employees'],
    order360: repository as unknown as Repository,
  };
  const headers = {
    authorization: 'Bearer mock-only-order360-session',
    'x-correlation-id': correlationId,
  };
  const app = buildApp(dependencies);
  const dispatch = (overrides: Partial<ApiRequest> = {}) =>
    app.dispatch({ method: 'GET', pathname: path, headers, ...overrides });
  const grant = (
    cap: PermissionKey,
    fields: Grant['fields'],
    scopes: readonly DataScope[] = ['TEAM'],
  ) => {
    permissions.set(cap, { scopes, fields });
  };
  return {
    permissions,
    scopeAnchors,
    context,
    nested,
    output,
    get,
    repository,
    authenticate,
    dependencies,
    headers,
    app,
    dispatch,
    grant,
  };
}
function error(response: ApiResponse, status: number, code: string, message: string) {
  expect(response.statusCode).toBe(status);
  expect(response.body).toEqual({ error: { code, message, correlationId } });
  expect(response.headers?.['x-correlation-id']).toBe(correlationId);
}
function scope(f: ReturnType<typeof fixture>) {
  return record(required(f.get.mock.calls[0])[1]);
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

describe('fixed old order-360 entry and authorization', () => {
  for (const value of [undefined, null, [], {}, 17, 'opaque', new Date(0)])
    it(
      'GET ignores body/query values after the existing outer spread: ' + JSON.stringify(value),
      async () => {
        const f = fixture();
        expect(
          (
            await f.dispatch({
              body: value,
              query: { unknown: 'ignored', from: 'bad', salesOrderId: 'bad' },
              headers: { ...f.headers, 'idempotency-key': '' },
            })
          ).statusCode,
        ).toBe(200);
        expect(f.get.mock.calls[0]).toHaveLength(2);
      },
    );
  it('guard reads a missing root once; active branch reads the root twice', async () => {
    const f = fixture();
    const root = vi.fn(() => undefined as unknown);
    property(f.dependencies, 'order360', root);
    error(await f.dispatch(), 404, 'not_found', 'Route not found');
    expect(root).toHaveBeenCalledTimes(1);
    root.mockClear().mockReturnValue(f.repository);
    expect((await f.dispatch()).statusCode).toBe(200);
    expect(root).toHaveBeenCalledTimes(2);
  });
  it('neighbour customer-360 retains its own missing-CRM 503 before any order360 root read', async () => {
    const f = fixture();
    const root = vi.fn(() => {
      throw new Error('order360 root');
    });
    property(f.dependencies, 'order360', root);
    error(
      await f.dispatch({ pathname: '/api/v1/customers/' + id + '/360' }),
      503,
      'internal_error',
      'CRM dependency unavailable',
    );
    expect(root).not.toHaveBeenCalled();
    expect(f.get).not.toHaveBeenCalled();
  });
  for (const cap of caps)
    for (const part of ['scopes', 'fields', 'anchors'] as const)
      it('authorization getter first-error before late method ' + cap + '/' + part, async () => {
        const f = fixture(sections.map(([, c]) => c));
        const fail = () => {
          throw new DomainError('conflict', cap + '/' + part);
        };
        if (part === 'anchors') {
          const old = f.scopeAnchors.get.bind(f.scopeAnchors);
          vi.spyOn(f.scopeAnchors, 'get').mockImplementation((key) =>
            key === cap ? fail() : old(key),
          );
        } else property(required(f.permissions.get(cap)), part, fail);
        const method = vi.fn(() => {
          throw new Error('method must be later');
        });
        property(f.repository, 'get', method);
        error(await f.dispatch(), 409, 'conflict', cap + '/' + part);
        expect(method).not.toHaveBeenCalled();
        expect(f.get).not.toHaveBeenCalled();
      });
  for (const [name, cap] of sections)
    it('source extra third Map.get snapshots its own fields after Q ' + name, async () => {
      const f = fixture([cap]);
      const original = f.permissions.get.bind(f.permissions);
      let reads = 0;
      const before = ['before'];
      const after = ['after'];
      vi.spyOn(f.permissions, 'get').mockImplementation((key) => {
        if (key !== cap) return original(key);
        reads++;
        if (reads === 3) return { scopes: [], fields: before };
        if (reads === 4) return { scopes: [], fields: after };
        return original(key);
      });
      f.output[name] = { id, before: 1, after: f.nested };
      const r = await f.dispatch();
      expect(r.statusCode).toBe(200);
      expect(record(record(scope(f).sources)[name]).fields).toBe(before);
      expect(record(record(scope(f).sources)[name]).scopes).toBe(original(cap)?.scopes);
      expect(reads).toBe(4);
      if (name === 'legal') expect(r.body).not.toHaveProperty(name);
      else expect(record(r.body)[name]).toEqual({ id, after: f.nested });
    });
  it('source has error precedes late method and absent source Q is not attempted', async () => {
    const f = fixture();
    const old = f.permissions.get.bind(f.permissions);
    let called = false;
    vi.spyOn(f.permissions, 'get').mockImplementation((cap) => {
      if (!called && cap === 'customer:read') throw new Error('absent source Q');
      return old(cap);
    });
    f.get.mockImplementation(() => {
      called = true;
      return Promise.resolve(f.output);
    });
    expect((await f.dispatch()).statusCode).toBe(200);
    f.get.mockClear();
    vi.spyOn(f.permissions, 'has').mockImplementation(() => {
      throw new DomainError('conflict', 'has');
    });
    error(await f.dispatch(), 409, 'conflict', 'has');
    expect(f.get).not.toHaveBeenCalled();
  });
  it('keeps receiver, exactly two arguments, source order, references and opaque output', async () => {
    const f = fixture(sections.map(([, cap]) => cap));
    f.get.mockImplementation(function (this: unknown, ...args) {
      expect(this).toBe(f.repository);
      expect(args).toHaveLength(2);
      expect(args[0]).toBe(id);
      return Promise.resolve(f.output);
    });
    const r = await f.dispatch();
    expect(r.statusCode).toBe(200);
    expect(f.get).toHaveBeenCalledTimes(1);
    const c = scope(f);
    expect(c.actor).toBe(actor);
    expect(c.scopes).toBe(f.permissions.get(order)?.scopes);
    expect(c.anchors).toBe(f.scopeAnchors.get(order));
    expect(Object.keys(c)).toEqual(['actor', 'scopes', 'anchors', 'sources', 'entry']);
    const sources = record(c.sources);
    expect(Object.keys(sources)).toEqual(sections.map(([name]) => name));
    for (const [name, cap] of sections) {
      expect(record(sources[name]).scopes).toBe(f.permissions.get(cap)?.scopes);
      expect(record(sources[name]).anchors).toBe(f.scopeAnchors.get(cap));
      expect(record(sources[name]).fields).toBeNull();
    }
    expect(record(c.entry).scopes).toBe(f.permissions.get(entry)?.scopes);
    expect(record(c.entry).anchors).toBe(f.scopeAnchors.get(entry));
    expect(record(r.body).order).toBe(f.output.order);
    expect(record(r.body).anomalies).toBe(f.output.anomalies);
    expect(r.body).not.toHaveProperty('legal');
    expect(r.body).not.toHaveProperty('unlisted');
  });
  for (const raw of ['a', '-', '--', '0', 'dead-beef', 'a--f', id])
    it('passes raw lowercase hex/hyphen without UUID validation: ' + raw, async () => {
      const f = fixture();
      expect(
        (await f.dispatch({ pathname: '/api/v1/sales-orders/' + raw + '/360' })).statusCode,
      ).toBe(200);
      expect(f.get.mock.calls[0]?.[0]).toBe(raw);
    });
  const rejected = [
    path + '/',
    path + '?x=1',
    path + '#x',
    path + '/extra',
    path.toUpperCase(),
    path.replace('/360', '/0360'),
    path.replace('/360', '/360x'),
    path.replace(id, ''),
    path.replace(id, 'A'),
    path.replace(id, 'g'),
    path.replace(id, '%61'),
    path.replace(id, 'a_b'),
    path.replace(id, 'a.b'),
    path.replace(id, 'a/b'),
    path.replace(id, ' a'),
    path.replace(id, 'é'),
    path.replace('/sales-orders/', '/sales-order/'),
    path.replace('/v1/', '/v2/'),
    '/api/v1/sales-orders',
    '/api/v1/sales-orders/' + id,
    '/api/v1/sales-orders/' + id + '/release',
    '/api/v1/customer/' + id + '/360',
  ];
  for (const pathname of rejected)
    it('rejects alternate/neighbour path before root: ' + pathname, async () => {
      const f = fixture();
      const root = vi.fn(() => {
        throw new Error('root must not be read');
      });
      property(f.dependencies, 'order360', root);
      error(await f.dispatch({ pathname }), 404, 'not_found', 'Route not found');
      expect(root).not.toHaveBeenCalled();
      expect(f.get).not.toHaveBeenCalled();
    });
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS', 'get', 'TRACE'])
    it('short circuits root for method ' + method, async () => {
      const f = fixture();
      const root = vi.fn(() => {
        throw new Error('unused root');
      });
      property(f.dependencies, 'order360', root);
      error(await f.dispatch({ method }), 404, 'not_found', 'Route not found');
      expect(root).not.toHaveBeenCalled();
    });
  for (const root of [undefined, null, false, 0])
    it('falsy root falls through without entry Q: ' + String(root), async () => {
      const f = fixture();
      f.permissions.clear();
      property(f.dependencies, 'order360', () => root);
      error(await f.dispatch(), 404, 'not_found', 'Route not found');
    });
  it('global 401 precedes root/permissions', async () => {
    const f = fixture();
    property(f.dependencies, 'order360', () => {
      throw new Error('root');
    });
    f.authenticate.mockResolvedValue(null);
    error(await f.dispatch(), 401, 'authentication_required', 'A valid session is required');
    error(
      await f.dispatch({ headers: { 'x-correlation-id': correlationId } }),
      401,
      'authentication_required',
      'A valid session is required',
    );
    expect(f.authenticate).toHaveBeenCalledTimes(1);
  });
  for (const cap of caps)
    for (const denial of ['missing', 'empty'] as const)
      it(cap + ' authorization: ' + denial, async () => {
        const f = fixture(sections.map(([, c]) => c));
        if (denial === 'missing') f.permissions.delete(cap);
        else f.grant(cap, [], []);
        const r = await f.dispatch();
        if (denial === 'missing' && cap !== entry && cap !== order) {
          expect(r.statusCode).toBe(200);
          const name = required(sections.find(([, c]) => c === cap))[0];
          expect(record(scope(f).sources)).not.toHaveProperty(name);
          expect(r.body).not.toHaveProperty(name);
        } else {
          error(r, 403, 'forbidden', 'Permission denied');
          expect(f.get).not.toHaveBeenCalled();
        }
      });
  for (const cap of caps)
    for (const fields of [null, [], ['unused']] as const)
      it(cap + ' Q has no requested fields: ' + JSON.stringify(fields), async () => {
        const f = fixture(sections.map(([, c]) => c));
        f.grant(cap, fields);
        expect((await f.dispatch()).statusCode).toBe(200);
        expect(f.get).toHaveBeenCalledTimes(1);
      });
  it('entry denial precedes order and source reads; order precedes source', async () => {
    const f = fixture(['customer:read']);
    f.permissions.delete(entry);
    property(required(f.permissions.get(order)), 'scopes', () => {
      throw new Error('order');
    });
    error(await f.dispatch(), 403, 'forbidden', 'Permission denied');
    f.grant(entry, null);
    error(await f.dispatch(), 500, 'internal_error', 'Internal server error');
    f.permissions.delete(order);
    property(required(f.permissions.get('customer:read')), 'scopes', () => {
      throw new Error('source');
    });
    error(await f.dispatch(), 403, 'forbidden', 'Permission denied');
  });
  it('has then three get reads per present source in fixed order before method; no Q after await', async () => {
    const f = fixture(sections.map(([, c]) => c));
    const log: string[] = [];
    const oldHas = f.permissions.has.bind(f.permissions);
    const oldGet = f.permissions.get.bind(f.permissions);
    vi.spyOn(f.permissions, 'has').mockImplementation((cap) => {
      log.push('has:' + cap);
      return oldHas(cap);
    });
    vi.spyOn(f.permissions, 'get').mockImplementation((cap) => {
      log.push('get:' + cap);
      return oldGet(cap);
    });
    property(f.repository, 'get', () => {
      expect(log).toEqual([
        'get:' + entry,
        'get:' + entry,
        'get:' + order,
        'get:' + order,
        ...sections.flatMap(([, cap]) => ['has:' + cap, 'get:' + cap, 'get:' + cap, 'get:' + cap]),
      ]);
      log.push('method');
      return f.get;
    });
    f.get.mockImplementation(() => {
      expect(log.at(-1)).toBe('get:' + entry);
      return Promise.resolve(f.output);
    });
    expect((await f.dispatch()).statusCode).toBe(200);
    expect(log.slice(log.indexOf('method') + 1)).toEqual([
      'get:' + entry,
      'get:' + order,
      ...sections.map(([, cap]) => 'get:' + cap),
      'get:' + entry,
    ]);
  });
  it('has false skips Q but second late Map.get may add a projected section', async () => {
    const f = fixture(['quote:read']);
    vi.spyOn(f.permissions, 'has').mockReturnValue(false);
    f.output.quote = { id, nested: f.nested };
    expect(record((await f.dispatch()).body).quote).toBe(f.output.quote);
    expect(scope(f).sources).toEqual({});
  });
  it('missing anchors become fresh empty arrays without scope restrictions', async () => {
    const f = fixture(['quote:read']);
    f.scopeAnchors.clear();
    for (const cap of [entry, order, 'quote:read'] as const) f.grant(cap, null, ['SELF']);
    expect((await f.dispatch()).statusCode).toBe(200);
    const c = scope(f);
    expect(c.anchors).toEqual([]);
    expect(record(c.entry).anchors).toEqual([]);
    expect(record(record(c.sources).quote).anchors).toEqual([]);
    expect(c.anchors).not.toBe(record(c.entry).anchors);
  });
  it('captures second root and method before actor; actor mutation cannot change receiver', async () => {
    const f = fixture();
    const replacement = { get: vi.fn<Call>().mockResolvedValue(f.output) };
    let roots = 0;
    const log: string[] = [];
    property(f.dependencies, 'order360', () => {
      roots++;
      log.push('root' + String(roots));
      return roots === 1 ? {} : replacement;
    });
    property(replacement, 'get', () => {
      log.push('method');
      return f.get;
    });
    property(f.context, 'actor', () => {
      log.push('actor');
      Object.defineProperty(f.dependencies, 'order360', { configurable: true, value: {} });
      return actor;
    });
    f.get.mockImplementation(function (this: unknown) {
      expect(this).toBe(replacement);
      return Promise.resolve(f.output);
    });
    expect((await f.dispatch()).statusCode).toBe(200);
    expect(log).toEqual(['root1', 'root2', 'method', 'actor']);
  });
  for (const stage of ['root1', 'root2', 'method', 'actor', 'entry-fields'] as const)
    for (const domain of [false, true])
      it('preserves capture/argument error at ' + stage + '/' + String(domain), async () => {
        const f = fixture();
        const fail = () => {
          throw domain
            ? new DomainError('conflict', 'opaque failure')
            : new Error('opaque failure');
        };
        if (stage.startsWith('root')) {
          let count = 0;
          property(f.dependencies, 'order360', () => {
            count++;
            return count === (stage === 'root1' ? 1 : 2) ? fail() : f.repository;
          });
        } else if (stage === 'method') property(f.repository, 'get', fail);
        else if (stage === 'actor') property(f.context, 'actor', fail);
        else {
          property(f.repository, 'get', () => {
            property(required(f.permissions.get(entry)), 'fields', fail);
            return f.get;
          });
        }
        error(
          await f.dispatch(),
          domain ? 409 : 500,
          domain ? 'conflict' : 'internal_error',
          domain ? 'opaque failure' : 'Internal server error',
        );
        expect(f.get).not.toHaveBeenCalled();
      });
  it('undefined method still evaluates actor and entry fields before invocation error', async () => {
    const f = fixture();
    const log: string[] = [];
    property(f.repository, 'get', () => {
      log.push('method');
      return undefined;
    });
    property(f.context, 'actor', () => {
      log.push('actor');
      return actor;
    });
    const g = required(f.permissions.get(entry));
    property(g, 'fields', () => {
      log.push('fields');
      return null;
    });
    error(await f.dispatch(), 500, 'internal_error', 'Internal server error');
    expect(log).toEqual(['fields', 'method', 'actor', 'fields']);
  });
  for (const code of ['forbidden', 'not_found', 'conflict', 'invalid_request'] as const)
    it('maps repository DomainError ' + code, async () => {
      const f = fixture();
      f.get.mockRejectedValue(new DomainError(code, 'old opaque error'));
      error(
        await f.dispatch(),
        { forbidden: 403, not_found: 404, conflict: 409, invalid_request: 400 }[code],
        code,
        'old opaque error',
      );
    });
  it('maps ordinary repository rejection to 500', async () => {
    const f = fixture();
    f.get.mockRejectedValue(new Error('not exposed'));
    error(await f.dispatch(), 500, 'internal_error', 'Internal server error');
  });
  it('outer request spread getter rejection remains outside internal DomainError catch', async () => {
    const f = fixture();
    const input: ApiRequest = { method: 'GET', pathname: path, headers: f.headers };
    property(input, 'body', () => {
      throw new DomainError('conflict', 'spread');
    });
    await expect(f.app.dispatch(input)).rejects.toThrow('spread');
    expect(f.authenticate).not.toHaveBeenCalled();
  });
});

describe('fixed old order-360 aggregate projection', () => {
  it('array items each read the original late grant fields after item getters, without caching', async () => {
    const f = fixture(['quote:read']);
    const log: string[] = [];
    const items = [
      { id: 'first', first: f.nested },
      { id: 'second', second: f.nested },
    ];
    f.output.quote = items;
    f.get.mockImplementation(() => {
      let count = 0;
      property(required(f.permissions.get('quote:read')), 'fields', () => {
        count++;
        log.push('fields' + String(count));
        return count === 1 ? ['first'] : ['second'];
      });
      return Promise.resolve(f.output);
    });
    const r = await f.dispatch();
    expect(r.statusCode).toBe(200);
    expect(record(r.body).quote).toEqual(items);
    expect(log).toEqual(['fields1', 'fields2']);
  });
  it('section value getter runs before fields; a skipped legal value getter never runs', async () => {
    const f = fixture(['quote:read', 'legal-case:read']);
    property(f.output, 'legal', () => {
      throw new Error('legal section not copied');
    });
    property(f.output, 'quote', () => {
      property(required(f.permissions.get('quote:read')), 'fields', () => ['nested']);
      return { id, nested: f.nested, hidden: true };
    });
    expect(record((await f.dispatch()).body).quote).toEqual({ id, nested: f.nested });
  });
  for (const [name, cap] of sections)
    for (const shape of ['object', 'array', 'null', 'undefined'] as const)
      for (const fields of [null, [], ['name', 'nested']] as const)
        it(name + '/' + shape + '/' + JSON.stringify(fields), async () => {
          const f = fixture([cap]);
          f.grant(cap, fields);
          const item = { id, name: 'visible', nested: f.nested, hidden: 'excluded' };
          const value =
            shape === 'object'
              ? item
              : shape === 'array'
                ? [item]
                : shape === 'null'
                  ? null
                  : undefined;
          f.output[name] = value;
          const r = await f.dispatch();
          if (name === 'legal') {
            expect(r.statusCode).toBe(200);
            expect(r.body).not.toHaveProperty(name);
          } else if (shape === 'undefined' && fields !== null)
            error(r, 500, 'internal_error', 'Internal server error');
          else {
            expect(r.statusCode).toBe(200);
            const result = record(r.body)[name];
            if (shape === 'null' || shape === 'undefined') expect(result).toBe(value);
            else {
              const actual = shape === 'array' ? (result as unknown[])[0] : result;
              const expected =
                fields === null
                  ? item
                  : fields.length === 0
                    ? { id }
                    : { id, name: 'visible', nested: f.nested };
              expect(actual).toEqual(expected);
              if (fields === null && !(name === 'collections' && shape === 'array'))
                expect(actual).toBe(item);
              if (fields !== null && fields.length > 0)
                expect(record(actual).nested).toBe(f.nested);
            }
          }
        });
  it('uses source fields snapshot but late order/section/entry fields after await', async () => {
    const f = fixture(['quote:read']);
    const beforeFields = ['before'];
    f.grant('quote:read', beforeFields);
    const pending = deferred<unknown>();
    const entered = deferred<undefined>();
    f.output.quote = { id, before: 'old', after: f.nested };
    f.get.mockImplementation(() => {
      entered.resolve(undefined);
      return pending.promise;
    });
    const request = f.dispatch();
    await entered.promise;
    const source = record(record(scope(f).sources).quote);
    expect(source.fields).toBe(beforeFields);
    f.grant(order, []);
    f.grant('quote:read', ['after']);
    f.grant(entry, ['quote', 'order']);
    pending.resolve(f.output);
    const r = await request;
    expect(r.body).toEqual({ order: { id }, quote: { id, after: f.nested } });
    expect(source.fields).toBe(beforeFields);
    expect(record(scope(f).entry).fields).toBeNull();
    expect(record(record(r.body).quote).after).toBe(f.nested);
  });
  it('late absent sales-order/entry Map grants default fields null, without reauthorization', async () => {
    const f = fixture(['quote:read']);
    f.get.mockImplementation(() => {
      f.permissions.delete(order);
      f.permissions.delete(entry);
      return Promise.resolve(f.output);
    });
    const r = await f.dispatch();
    expect(r.statusCode).toBe(200);
    expect(record(r.body).order).toBe(f.output.order);
    expect(record(r.body).anomalies).toBe(f.output.anomalies);
  });
  it('late source added without scope checks, removed source skipped before aggregate getter', async () => {
    const f = fixture(['quote:read']);
    property(f.output, 'quote', () => {
      throw new Error('skipped');
    });
    f.output.customer = { id, hidden: f.nested };
    f.get.mockImplementation(() => {
      f.permissions.delete('quote:read');
      f.grant('customer:read', null, []);
      return Promise.resolve(f.output);
    });
    const r = await f.dispatch();
    expect(r.statusCode).toBe(200);
    expect(r.body).not.toHaveProperty('quote');
    expect(record(r.body).customer).toBe(f.output.customer);
    expect(scope(f).sources).not.toHaveProperty('customer');
  });
  it('order/anomalies then fixed section reads then timeline then last entry fields', async () => {
    const f = fixture(sections.map(([, cap]) => cap));
    const log: string[] = [];
    f.get.mockImplementation(() => {
      for (const name of ['order', 'anomalies', ...sections.map(([n]) => n), 'timeline']) {
        const value = f.output[name];
        property(f.output, name, () => {
          log.push(name);
          return value;
        });
      }
      const g = required(f.permissions.get(entry));
      property(g, 'fields', () => {
        log.push('last-entry-fields');
        return null;
      });
      return Promise.resolve(f.output);
    });
    expect((await f.dispatch()).statusCode).toBe(200);
    expect(log).toEqual([
      'order',
      'anomalies',
      ...sections.filter(([n]) => n !== 'legal').map(([n]) => n),
      'timeline',
      'last-entry-fields',
    ]);
  });
  it('section Array.map preserves holes, inherited numeric items, order and shallow refs', async () => {
    const f = fixture(['quote:read']);
    f.grant('quote:read', ['nested']);
    const items = new Array<unknown>(3);
    const inherited = { id: 'inherited', nested: f.nested };
    const own = { id, nested: f.nested };
    const proto = Object.create(Array.prototype) as object;
    Object.defineProperty(proto, '1', { value: inherited });
    Object.setPrototypeOf(items, proto);
    items[2] = own;
    f.output.quote = items;
    const values = record((await f.dispatch()).body).quote as unknown[];
    expect(values).toHaveLength(3);
    expect(0 in values).toBe(false);
    expect(values[1]).toEqual(inherited);
    expect(record(values[2]).nested).toBe(f.nested);
  });
  for (const slot of ['order', 'timeline', 'customer'] as const)
    for (const value of [null, undefined, 17])
      it('opaque malformed ' + slot + '/' + String(value), async () => {
        const f = fixture(['customer:read']);
        f.output[slot] = value;
        if (slot === 'timeline')
          error(await f.dispatch(), 500, 'internal_error', 'Internal server error');
        else {
          const r = await f.dispatch();
          expect(r.statusCode).toBe(200);
          expect(record(r.body)[slot]).toBe(value);
        }
      });
  it('own enumerable excluded getter is still evaluated by P; nonenumerable/prototype not copied', async () => {
    const f = fixture(['quote:read']);
    f.grant('quote:read', []);
    const item = Object.create({ inherited: 9 }) as Record<string, unknown>;
    item.id = id;
    Object.defineProperty(item, 'hidden', { value: 9 });
    const getter = vi.fn(() => f.nested);
    property(item, 'excluded', getter);
    f.output.quote = item;
    expect(record((await f.dispatch()).body).quote).toEqual({ id });
    expect(getter).toHaveBeenCalledTimes(1);
    property(item, 'excluded', () => {
      throw new DomainError('conflict', 'projection getter');
    });
    error(await f.dispatch(), 409, 'conflict', 'projection getter');
  });
  for (const fields of [null, [], ['order'], ['timeline'], ['anomalies'], ['unknown']] as const)
    it('last entry fields ' + JSON.stringify(fields), async () => {
      const f = fixture();
      f.get.mockImplementation(() => {
        f.grant(entry, fields);
        return Promise.resolve(f.output);
      });
      const r = await f.dispatch();
      expect(r.statusCode).toBe(200);
      const full = { order: f.output.order, anomalies: f.output.anomalies, timeline: [] };
      expect(r.body).toEqual(
        fields === null
          ? full
          : Object.fromEntries(
              Object.entries(full).filter(([key]) => fields.some((field) => field === key)),
            ),
      );
    });
});

const timelineRows = [
  ['QUOTE_ISSUED', 'quote:read', false, ['quoteNumber', 'quote_number']],
  ['QUOTE_OTHER', 'quote:read', false, ['reason']],
  ['CREDIT_DECIDED', 'credit:read', false, ['effectiveStatus', 'effective_status']],
  ['CONTRACT_SIGNED', 'contract:read', false, ['contractNumber', 'contract_number']],
  ['AR_POSTED', 'ar:read', false, ['documentNumber', 'document_number']],
  ['PAYMENT_RECEIVED', 'bank-payment:read', false, ['bank_reference', 'bankReference']],
  ['COMMISSION_ACCRUED', 'commission:read', true, ['reason']],
  ['RISK_EVALUATED', 'risk:read', false, ['severity', 'score']],
  ['RISK_TASK_CLOSED', 'risk:read', true, ['reason']],
  ['RISK_OTHER', 'risk:read', false, ['reason']],
  ['SHIPMENT_RELEASE_APPROVED', 'shipment:read', true, ['reason']],
  ['SHIPMENT_DELIVERED', 'shipment:read', true, ['tracking_number']],
  ['COLLECTION_FOLLOWUP', 'collection:read', true, ['outcome']],
  ['COLLECTION_OPENED', 'collection:read', true, ['reason']],
  ['COLLECTION_LEGAL_REQUESTED', 'legal-case:read', true, ['reason']],
  ['LEGAL_HANDOFF_ACCEPTED', 'legal-case:read', true, ['reason']],
  ['DEBT_EVIDENCE_GENERATED', 'legal-case:read', true, ['package_number']],
  ['OPPORTUNITY_CREATED', 'opportunity:read', false, ['name']],
  ['ORDER_RELEASED', 'sales-order:read', false, ['order_number', 'orderNumber']],
] as const satisfies readonly (readonly [string, PermissionKey, boolean, readonly string[]])[];
describe('fixed old order-360 timeline and independent legal projection', () => {
  it('collection event state checks read fields in original order and build a fresh late grant', async () => {
    const f = fixture(['collection:read']);
    const event = { type: 'COLLECTION_OPENED', subjectId: id, label: f.nested };
    f.output.timeline = [event];
    let fieldsReads = 0;
    let scopesReads = 0;
    f.get.mockImplementation(() => {
      const g = required(f.permissions.get('collection:read'));
      property(g, 'fields', () => {
        fieldsReads++;
        return ['state', 'reason'];
      });
      property(g, 'scopes', () => {
        scopesReads++;
        return [];
      });
      return Promise.resolve(f.output);
    });
    expect(record((await f.dispatch()).body).timeline).toEqual([event]);
    expect(fieldsReads).toBe(4);
    expect(scopesReads).toBe(1);
  });
  it('projected event reads string type a third time in Object.entries; null-fields fast path avoids it', async () => {
    const f = fixture(['quote:read']);
    const event = { subjectId: id, label: f.nested };
    const type = vi.fn(() => 'QUOTE_ISSUED');
    property(event, 'type', type);
    f.output.timeline = [event];
    f.grant('quote:read', []);
    expect(record((await f.dispatch()).body).timeline).toEqual([
      { type: 'QUOTE_ISSUED', subjectId: id },
    ]);
    expect(type).toHaveBeenCalledTimes(3);
    type.mockClear();
    f.grant('quote:read', null);
    const result = record((await f.dispatch()).body).timeline as unknown[];
    expect(result[0]).toBe(event);
    expect(type).toHaveBeenCalledTimes(2);
  });
  for (const [type, cap, state, labels] of timelineRows) {
    const choices: readonly (readonly string[] | null)[] = [
      null,
      [],
      ['state'],
      ['event_type'],
      ['reason'],
      ['state', 'reason'],
      ['state', 'event_type', ...labels],
      ...labels.map((label) => [label]),
      ['state', 'label', 'occurredAt'],
      ['severity'],
      ['score'],
      ['severity', 'score'],
    ];
    choices.forEach((fields, index) => {
      it(type + ' fields case ' + String(index), async () => {
        const f = fixture([cap, 'collection:read', 'legal-case:read']);
        f.grant(cap, fields);
        const event = {
          id,
          type,
          subjectId: 'opaque subject',
          label: f.nested,
          occurredAt: 'opaque time',
          hidden: true,
        };
        f.output.timeline = [event];
        const r = await f.dispatch();
        expect(r.statusCode).toBe(200);
        const timeline = record(r.body).timeline as unknown[];
        const stateAllowed =
          fields === null ||
          !state ||
          fields.includes('state') ||
          (type.startsWith('COLLECTION_') && fields.includes('event_type'));
        if (!stateAllowed) expect(timeline).toEqual([]);
        else if (fields === null) expect(timeline[0]).toBe(event);
        else {
          const labelAllowed =
            type === 'RISK_EVALUATED'
              ? fields.includes('severity') && fields.includes('score')
              : labels.some((name) => fields.includes(name));
          expect(timeline).toEqual([
            { id, type, subjectId: 'opaque subject', ...(labelAllowed ? { label: f.nested } : {}) },
          ]);
          expect(record(timeline[0])).not.toHaveProperty('occurredAt');
          if (labelAllowed) expect(record(timeline[0]).label).toBe(f.nested);
        }
      });
    });
    it(type + ' missing late capability is filtered', async () => {
      const f = fixture([cap, 'collection:read']);
      f.output.timeline = [{ type, subjectId: id }];
      f.get.mockImplementation(() => {
        f.permissions.delete(cap);
        return Promise.resolve(f.output);
      });
      expect(record((await f.dispatch()).body).timeline).toEqual([]);
    });
  }
  for (const type of [
    'UNKNOWN',
    'ORDER_RELEASED_X',
    'quote_issued',
    '',
    'LEGAL_X',
    'DEBT_X',
    17,
    null,
    undefined,
  ])
    it('unknown/nonstring type filtered ' + String(type), async () => {
      const f = fixture(sections.map(([, cap]) => cap));
      f.output.timeline = [{ type }];
      expect(record((await f.dispatch()).body).timeline).toEqual([]);
    });
  for (const [type, nestedField] of [
    ['COLLECTION_LEGAL_X', 'events'],
    ['LEGAL_HANDOFF_X', 'legalHandoffs'],
    ['DEBT_EVIDENCE_X', 'legalHandoffs'],
  ] as const)
    for (const fields of [null, [], ['events'], ['legalHandoffs']] as const)
      it(type + ' captured collection nested gate ' + JSON.stringify(fields), async () => {
        const f = fixture(['collection:read', 'legal-case:read']);
        f.grant('collection:read', fields);
        const event = { type, subjectId: id, label: f.nested };
        f.output.timeline = [event];
        f.get.mockImplementation(() => {
          f.grant('collection:read', fields === null ? [] : null);
          return Promise.resolve(f.output);
        });
        const r = await f.dispatch();
        expect(r.statusCode).toBe(200);
        expect(record(r.body).timeline).toEqual(
          fields === null || fields.some((field) => field === nestedField) ? [event] : [],
        );
      });
  it('legal nested timeline requires captured collection source even with unrestricted legal read', async () => {
    const f = fixture(['legal-case:read']);
    f.output.timeline = [
      { type: 'COLLECTION_LEGAL_X' },
      { type: 'LEGAL_HANDOFF_X' },
      { type: 'DEBT_EVIDENCE_X' },
    ];
    expect(record((await f.dispatch()).body).timeline).toEqual([]);
  });
  for (const legalScope of [[], ['SELF'], ['TEAM'], ['COMPANY'], ['GROUP']] as const)
    for (const legalFields of [null, [], ['state', 'events', 'packages']] as const)
      it(
        'collection shared legal helper captured scope/fields ' +
          JSON.stringify([legalScope, legalFields]),
        async () => {
          const f = fixture(['collection:read', 'legal-case:read']);
          // A present empty grant is denied at Q; remove it before source-building instead.
          if (legalScope.length === 0) f.permissions.delete('legal-case:read');
          else f.grant('legal-case:read', legalFields, legalScope);
          const plain = { id: 'plain', event_type: 'FOLLOWUP', nested: f.nested };
          const legal = { id: 'legal', event_type: 'LEGAL_ACCEPTED', state: 'X', hidden: f.nested };
          const child = { id: 'child', state: 'Y', hidden: f.nested };
          const handoff = {
            id: 'handoff',
            state: 'Z',
            packages: [child],
            events: [child],
            hidden: f.nested,
          };
          const item = { id, events: [plain, legal], legalHandoffs: [handoff], nested: f.nested };
          f.output.collections = [item];
          f.get.mockImplementation(() => {
            f.grant('legal-case:read', null, ['COMPANY']);
            return Promise.resolve(f.output);
          });
          const r = await f.dispatch();
          expect(r.statusCode).toBe(200);
          const result = record((record(r.body).collections as unknown[])[0]);
          expect(result).not.toBe(item);
          expect(result.nested).toBe(f.nested);
          const allowed = legalScope.some((s) => s === 'COMPANY' || s === 'GROUP');
          const events = result.events as unknown[];
          expect(events[0]).toBe(plain);
          if (!allowed) {
            expect(events).toEqual([plain]);
            expect(result).not.toHaveProperty('legalHandoffs');
          } else if (legalFields === null) {
            expect(events[1]).toBe(legal);
            expect((result.legalHandoffs as unknown[])[0]).toBe(handoff);
          } else if (legalFields.length === 0) {
            expect(events[1]).toEqual({ id: 'legal' });
            expect(result.legalHandoffs).toEqual([{ id: 'handoff' }]);
          } else {
            expect(events[1]).toEqual({ id: 'legal', state: 'X' });
            expect(result.legalHandoffs).toEqual([
              {
                id: 'handoff',
                state: 'Z',
                packages: [{ id: 'child', state: 'Y' }],
                events: [{ id: 'child', state: 'Y' }],
              },
            ]);
          }
          expect(r.body).not.toHaveProperty('legal');
        },
      );
  it('event.type getter is read twice for strings, once for nonstrings', async () => {
    const f = fixture(['quote:read']);
    const event = { subjectId: id };
    let reads = 0;
    property(event, 'type', () => {
      reads++;
      return reads === 1 ? 'QUOTE_ISSUED' : 'UNKNOWN';
    });
    f.output.timeline = [event];
    expect(record((await f.dispatch()).body).timeline).toEqual([]);
    expect(reads).toBe(2);
    reads = 0;
    property(event, 'type', () => {
      reads++;
      return 17;
    });
    expect(record((await f.dispatch()).body).timeline).toEqual([]);
    expect(reads).toBe(1);
  });
  it('timeline flatMap skips holes and flattens exactly one callback array, retaining order/ref', async () => {
    const f = fixture(['quote:read']);
    const event = { type: 'QUOTE_ISSUED', nested: f.nested };
    const timeline = new Array<unknown>(3);
    timeline[1] = { type: 'UNKNOWN' };
    timeline[2] = event;
    f.output.timeline = timeline;
    const result = record((await f.dispatch()).body).timeline as unknown[];
    expect(result).toEqual([event]);
    expect(result[0]).toBe(event);
  });
  for (const stage of ['type', 'fields', 'excluded-event'] as const)
    for (const domain of [false, true])
      it('timeline projection error ' + stage + '/' + String(domain), async () => {
        const f = fixture(['quote:read']);
        const event = { type: 'QUOTE_ISSUED', subjectId: id };
        const fail = () => {
          throw domain
            ? new DomainError('not_found', 'timeline opaque')
            : new Error('timeline opaque');
        };
        f.output.timeline = [event];
        f.get.mockImplementation(() => {
          if (stage === 'type') property(event, 'type', fail);
          else if (stage === 'fields')
            property(required(f.permissions.get('quote:read')), 'fields', fail);
          else {
            f.grant('quote:read', []);
            property(event, 'excluded', fail);
          }
          return Promise.resolve(f.output);
        });
        error(
          await f.dispatch(),
          domain ? 404 : 500,
          domain ? 'not_found' : 'internal_error',
          domain ? 'timeline opaque' : 'Internal server error',
        );
      });
});
