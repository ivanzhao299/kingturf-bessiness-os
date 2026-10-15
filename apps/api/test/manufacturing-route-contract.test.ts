// Frozen against e91b078 inline manufacturing HTTP; only old buildApp is imported.
import { describe, expect, it, vi } from 'vitest';
import { DomainError, type AuthorizationContext } from '@kingturf/domain';
import type { DataScope, JsonObject, PermissionKey } from '@kingturf/types';
import { buildApp, type ApiDependencies, type ApiRequest, type ApiResponse } from '../src/app.js';

type Repository = NonNullable<ApiDependencies['manufacturing']>;
type MutableDependencies = { -readonly [K in keyof ApiDependencies]: ApiDependencies[K] };
type Grant = NonNullable<ReturnType<AuthorizationContext['permissions']['get']>>;
type MockCall = (...args: unknown[]) => Promise<unknown>;
type Row = Readonly<{
  label: string;
  kind: 'list' | 'item' | 'bom' | 'routing' | 'publish';
  method: 'list' | 'createItem' | 'createBom' | 'createRouting' | 'publish';
  path: string;
  http: string;
  cap: PermissionKey;
  read: PermissionKey;
  view?: string;
  publishedKind?: string;
}>;
const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const other = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const correlationId = '66666666-6666-4666-8666-666666666666';
const actor = { employeeId: id, companyId: 'manufacturing-old-http-mock' };
const time = '2026-08-01T08:00:00+08:00';
const iso = '2026-08-01T00:00:00.000Z';
const rows: readonly Row[] = [
  ...(['item', 'bom', 'routing'] as const).map(
    (kind): Row => ({
      label: kind + ' list',
      kind: 'list',
      method: 'list',
      http: 'GET',
      path: '/api/v1/manufacturing-' + (kind === 'item' ? 'items' : kind + 's'),
      cap: kind === 'item' ? 'manufacturing-item:read' : `${kind}:read`,
      read: kind === 'item' ? 'manufacturing-item:read' : `${kind}:read`,
      view: kind === 'item' ? 'items' : kind + 's',
    }),
  ),
  ...(['item', 'bom', 'routing'] as const).map(
    (kind): Row => ({
      label: kind + ' create',
      kind,
      http: 'POST',
      method: kind === 'item' ? 'createItem' : kind === 'bom' ? 'createBom' : 'createRouting',
      path: '/api/v1/manufacturing-' + (kind === 'item' ? 'items' : kind + 's'),
      cap: kind === 'item' ? 'manufacturing-item:manage' : `${kind}:manage`,
      read: kind === 'item' ? 'manufacturing-item:read' : `${kind}:read`,
    }),
  ),
  ...(['item', 'bom', 'routing'] as const).map(
    (kind): Row => ({
      label: kind + ' publish',
      kind: 'publish',
      method: 'publish',
      http: 'POST',
      path: '/api/v1/manufacturing-' + kind + '-versions/' + id + '/publish',
      cap: kind === 'item' ? 'manufacturing-item:manage' : `${kind}:manage`,
      read: kind === 'item' ? 'manufacturing-item:read' : `${kind}:read`,
      publishedKind: kind,
    }),
  ),
];
const creates = rows.filter((r) => r.kind !== 'list' && r.kind !== 'publish');
const lists = rows.filter((r) => r.kind === 'list');
const publishes = rows.filter((r) => r.kind === 'publish');
const record = (value: unknown) => value as Record<string, unknown>;
function required<T>(value: T | undefined): T {
  if (value === undefined) throw new Error('missing fixture value');
  return value;
}
function property(target: object, key: PropertyKey, get: () => unknown) {
  Object.defineProperty(target, key, { configurable: true, enumerable: true, get });
}
function bodyFor(row: Row): Record<string, unknown> {
  if (row.kind === 'item')
    return {
      sku: ' SKU_1 ',
      name: ' Item ',
      itemType: ' FINISHED_GOOD ',
      baseUnitCode: ' M2 ',
      specification: { nested: { keep: true } },
      effectiveAt: time,
      publish: true,
    };
  if (row.kind === 'bom')
    return {
      code: ' BOM-1 ',
      name: ' BOM ',
      productItemId: id,
      productItemVersionId: other,
      outputQuantity: ' 1.250000 ',
      effectiveAt: time,
      publish: true,
      lines: [
        {
          componentItemVersionId: id,
          quantity: ' 2.500000 ',
          scrapBasisPoints: 0,
          substitutes: [{ itemVersionId: other, priority: 1, conversionFactor: ' 1.000000 ' }],
        },
      ],
    };
  if (row.kind === 'routing')
    return {
      code: ' RT-1 ',
      name: ' Routing ',
      productItemId: id,
      productItemVersionId: other,
      effectiveAt: time,
      publish: true,
      operations: [
        {
          operationCode: ' OP-1 ',
          name: ' Operation ',
          workCenterCode: ' WC_1 ',
          sequence: 1,
          setupMinutes: ' 0.000000 ',
          runMinutesPerUnit: ' 1.250000 ',
          instructions: { nested: { keep: true } },
        },
      ],
    };
  return {};
}
function fixture(
  row: Row,
  options: {
    scopes?: readonly DataScope[];
    fields?: Grant['fields'];
    denied?: boolean;
    missing?: boolean;
    unauthenticated?: boolean;
    noRead?: boolean;
    noAnchors?: boolean;
  } = {},
) {
  const scopes = options.scopes ?? ['COMPANY'];
  const anchors = [{ scope: 'TEAM', organizationId: id }] as const;
  const permissions = new Map<PermissionKey, Grant>([
    [row.cap, { scopes, fields: options.fields === undefined ? null : options.fields }],
  ]);
  if (row.cap !== row.read && !options.noRead)
    permissions.set(row.read, { scopes: ['COMPANY'], fields: null });
  if (options.denied) permissions.delete(row.cap);
  const context: AuthorizationContext = {
    actor,
    permissions,
    ...(options.noAnchors ? {} : { scopeAnchors: new Map([[row.cap, anchors]]) }),
  };
  const nested = { raw: true };
  const returned: JsonObject = { id, version: 7, name: 'Visible', extra: 'opaque', nested };
  const output = [returned, { ...returned, id: other }];
  const repository = {
    list: vi.fn<MockCall>().mockResolvedValue(output),
    createItem: vi.fn<MockCall>().mockResolvedValue(returned),
    createBom: vi.fn<MockCall>().mockResolvedValue(returned),
    createRouting: vi.fn<MockCall>().mockResolvedValue(returned),
    publish: vi.fn<MockCall>().mockResolvedValue(returned),
  };
  const authenticate = vi
    .fn<ApiDependencies['auth']['authenticate']>()
    .mockResolvedValue(options.unauthenticated ? null : context);
  const dependencies: MutableDependencies = {
    auth: { authenticate } as unknown as ApiDependencies['auth'],
    organizations: {} as ApiDependencies['organizations'],
    employees: {} as ApiDependencies['employees'],
    ...(options.missing ? {} : { manufacturing: repository as unknown as Repository }),
  };
  const body = bodyFor(row);
  const headers = {
    authorization: 'Bearer mock-only-manufacturing-session',
    'x-correlation-id': correlationId,
  };
  const app = buildApp(dependencies);
  const dispatch = (overrides: Partial<ApiRequest> = {}) =>
    app.dispatch({
      method: row.http,
      pathname: row.path,
      body,
      headers,
      ...overrides,
    });
  return {
    scopes,
    anchors,
    permissions,
    context,
    returned,
    output,
    repository,
    authenticate,
    dependencies,
    body,
    headers,
    app,
    dispatch,
    call: repository[row.method],
  };
}
function error(response: ApiResponse, statusCode: number, code: string, message: string) {
  expect(response.statusCode).toBe(statusCode);
  expect(response.body).toEqual({
    error: {
      code,
      message,
      correlationId,
    },
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
function expectedInput(row: Row, body: Record<string, unknown>) {
  if (row.kind === 'item')
    return {
      sku: 'SKU_1',
      name: 'Item',
      itemType: 'FINISHED_GOOD',
      baseUnitCode: 'M2',
      specification: body.specification,
      effectiveAt: iso,
      publish: true,
    };
  if (row.kind === 'bom')
    return {
      code: 'BOM-1',
      name: 'BOM',
      productItemId: id,
      productItemVersionId: other,
      outputQuantity: '1.25',
      effectiveAt: iso,
      publish: true,
      lines: [
        {
          componentItemVersionId: id,
          quantity: '2.5',
          scrapBasisPoints: 0,
          substitutes: [{ itemVersionId: other, priority: 1, conversionFactor: '1' }],
        },
      ],
    };
  return {
    code: 'RT-1',
    name: 'Routing',
    productItemId: id,
    productItemVersionId: other,
    effectiveAt: iso,
    publish: true,
    operations: [
      {
        operationCode: 'OP-1',
        name: 'Operation',
        workCenterCode: 'WC_1',
        sequence: 1,
        setupMinutes: '0',
        runMinutesPerUnit: '1.25',
        instructions: record((body.operations as unknown[])[0]).instructions,
      },
    ],
  };
}
function argumentsFor(row: Row, f: ReturnType<typeof fixture>) {
  const q = { actor, scopes: f.scopes, anchors: f.anchors };
  return row.kind === 'list'
    ? [row.view, q]
    : row.kind === 'publish'
      ? [row.publishedKind, id, q, correlationId]
      : [expectedInput(row, f.body), q, correlationId];
}

describe('e91b078 manufacturing canonical old HTTP contracts (mock scope is not PG permission)', () => {
  for (const row of rows) {
    it(row.label + ' preserves status, exact arguments, receiver and output refs', async () => {
      const f = fixture(row);
      const response = await f.dispatch();
      expect(response.statusCode).toBe(row.kind === 'list' ? 200 : 201);
      expect(f.call.mock.calls).toEqual([argumentsFor(row, f)]);
      expect(f.call.mock.contexts).toEqual([f.repository]);
      const q = record(f.call.mock.calls[0]?.[row.kind === 'publish' ? 2 : 1]);
      expect(q.actor).toBe(actor);
      expect(q.scopes).toBe(f.scopes);
      expect(q.anchors).toBe(f.anchors);
      if (row.kind === 'list') {
        expect(record(response.body).items).not.toBe(f.output);
        expect((record(response.body).items as unknown[])[0]).toBe(f.returned);
      } else expect(response.body).toBe(f.returned);
    });
    for (const scope of ['SELF', 'TEAM', 'DEPARTMENT', 'REGION', 'COMPANY', 'GROUP'] as const)
      it(row.label + ' passes nonempty ' + scope + ' unchanged to mock only', async () => {
        const f = fixture(row, { scopes: [scope] });
        expect((await f.dispatch()).statusCode).toBe(row.kind === 'list' ? 200 : 201);
        const q = record(f.call.mock.calls[0]?.[row.kind === 'publish' ? 2 : 1]);
        expect(q.scopes).toBe(f.scopes);
      });
    it(row.label + ' denies absent primary capability', async () => {
      const f = fixture(row, { denied: true });
      error(await f.dispatch(), 403, 'forbidden', 'Permission denied');
      expect(f.call).not.toHaveBeenCalled();
    });
    it(row.label + ' denies empty scopes', async () => {
      const f = fixture(row, { scopes: [] });
      error(await f.dispatch(), 403, 'forbidden', 'Permission denied');
      expect(f.call).not.toHaveBeenCalled();
    });
    it(row.label + ' has no anchors default and preserves empty array', async () => {
      const f = fixture(row, { noAnchors: true });
      await f.dispatch();
      expect(record(f.call.mock.calls[0]?.[row.kind === 'publish' ? 2 : 1]).anchors).toEqual([]);
    });
    it(row.label + ' keeps global 401 ahead of root getter', async () => {
      const f = fixture(row, { unauthenticated: true });
      property(f.dependencies, 'manufacturing', () => {
        throw new Error('root read');
      });
      error(await f.dispatch(), 401, 'authentication_required', 'A valid session is required');
    });
    it(row.label + ' has no fallback 503 when root missing', async () => {
      const f = fixture(row, { missing: true });
      error(await f.dispatch(), 404, 'not_found', 'Route not found');
    });
    it(row.label + ' missing method becomes 500 only after validation', async () => {
      const f = fixture(row);
      property(f.repository, row.method, () => undefined);
      error(await f.dispatch(), 500, 'internal_error', 'Internal server error');
    });
    it(row.label + ' reads current primary scopes and anchors before late root', async () => {
      const f = fixture(row);
      const events: string[] = [];
      property(required(f.permissions.get(row.cap)), 'scopes', () => {
        events.push('scopes');
        return f.scopes;
      });
      property(required(f.context.scopeAnchors), 'get', () => (cap: PermissionKey) => {
        events.push('anchors:' + cap);
        return f.anchors;
      });
      let roots = 0;
      property(f.dependencies, 'manufacturing', () => {
        events.push('root' + String(++roots));
        return f.repository;
      });
      await f.dispatch();
      expect(events).toEqual(['root1', 'scopes', 'scopes', 'anchors:' + row.cap, 'root2']);
    });
    for (const [code, status] of [
      ['invalid_request', 400],
      ['forbidden', 403],
      ['not_found', 404],
      ['conflict', 409],
    ] as const)
      it(row.label + ' preserves repository ' + code + ' and correlation', async () => {
        const f = fixture(row);
        f.call.mockRejectedValue(new DomainError(code, 'repo old error'));
        error(await f.dispatch(), status, code, 'repo old error');
      });
    it(row.label + ' masks ordinary repository error', async () => {
      const f = fixture(row);
      f.call.mockRejectedValue(new Error('private diagnostic'));
      error(await f.dispatch(), 500, 'internal_error', 'Internal server error');
    });
    it(row.label + ' getter root and method errors are ordinary 500', async () => {
      const f = fixture(row);
      let count = 0;
      property(f.dependencies, 'manufacturing', () => {
        if (++count === 2) throw new Error('late root');
        return f.repository;
      });
      error(await f.dispatch(), 500, 'internal_error', 'Internal server error');
      expect(count).toBe(2);
      expect(f.call).not.toHaveBeenCalled();
    });
    it(
      row.label + ' preserves original receiver and method when getter changes dependency',
      async () => {
        const f = fixture(row);
        const replacement = fixture(row);
        const captured = f.call;
        property(f.repository, row.method, () => {
          f.dependencies.manufacturing = replacement.repository as unknown as Repository;
          return captured;
        });
        expect((await f.dispatch()).statusCode).toBe(row.kind === 'list' ? 200 : 201);
        expect(captured.mock.contexts).toEqual([f.repository]);
        expect(replacement.call).not.toHaveBeenCalled();
      },
    );
    it(row.label + ' resolves second root after authorization can replace it', async () => {
      const f = fixture(row);
      const replacement = fixture(row);
      property(required(f.context.scopeAnchors), 'get', () => () => {
        f.dependencies.manufacturing = replacement.repository as unknown as Repository;
        return f.anchors;
      });
      await f.dispatch();
      expect(f.call).not.toHaveBeenCalled();
      expect(replacement.call).toHaveBeenCalledOnce();
    });
    it(
      row.label + ' actor getter after method capture cannot replace captured receiver',
      async () => {
        const f = fixture(row);
        const replacement = fixture(row);
        property(f.context, 'actor', () => {
          f.dependencies.manufacturing = replacement.repository as unknown as Repository;
          return actor;
        });
        await f.dispatch();
        expect(f.call).toHaveBeenCalledOnce();
        expect(replacement.call).not.toHaveBeenCalled();
      },
    );
    it(
      row.label + ' outer request shallow spread getter still rejects outside HTTP catch',
      async () => {
        const f = fixture(row);
        const cause = new Error('outer getter');
        const request: ApiRequest = {
          method: row.http,
          pathname: row.path,
          headers: f.headers,
          body: f.body,
        };
        property(request, 'query', () => {
          throw cause;
        });
        await expect(f.app.dispatch(request)).rejects.toBe(cause);
        expect(f.call).not.toHaveBeenCalled();
      },
    );
    it(
      row.label + ' ignores query and preserves nested body refs at transport shallow spread',
      async () => {
        const f = fixture(row);
        const query = new Proxy(
          {},
          {
            get() {
              throw new Error('query touched');
            },
          },
        );
        expect((await f.dispatch({ query })).statusCode).toBe(row.kind === 'list' ? 200 : 201);
        if (row.kind === 'item')
          expect(record(f.call.mock.calls[0]?.[0]).specification).toBe(f.body.specification);
        if (row.kind === 'routing')
          expect(
            record((record(f.call.mock.calls[0]?.[0]).operations as unknown[])[0]).instructions,
          ).toBe(record((f.body.operations as unknown[])[0]).instructions);
      },
    );
  }
});

describe('old wide guard, ordinary prototype lookup and raw publish regex boundaries', () => {
  for (const value of [null, false, 0, ''] as const)
    it('falsy root ' + JSON.stringify(value) + ' skips manufacturing without 503', async () => {
      const f = fixture(required(rows[0]));
      property(f.dependencies, 'manufacturing', () => value);
      error(await f.dispatch(), 404, 'not_found', 'Route not found');
    });
  for (const pathname of ['constructor', '__proto__', 'toString', 'hasOwnProperty', 'valueOf'])
    it(
      'GET inherited ordinary-object key ' + pathname + ' fails before authorization',
      async () => {
        const f = fixture(required(rows[0]), { denied: true });
        error(await f.dispatch({ pathname }), 500, 'internal_error', 'Internal server error');
        expect(f.call).not.toHaveBeenCalled();
      },
    );
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'])
    it(method + ' prototype key is not destructured', async () => {
      const f = fixture(required(rows[0]));
      error(
        await f.dispatch({ method, pathname: 'constructor', body: {} }),
        404,
        'not_found',
        'Route not found',
      );
    });
  for (const method of ['GET', 'POST', 'PUT', 'HEAD'])
    it('unsupported ' + method + ' still reads first manufacturing root exactly once', async () => {
      const f = fixture(required(rows[0]));
      let count = 0;
      property(f.dependencies, 'manufacturing', () => {
        count++;
        return f.repository;
      });
      error(
        await f.dispatch({ method, pathname: '/api/v1/manufacturing-items/', body: {} }),
        404,
        'not_found',
        'Route not found',
      );
      expect(count).toBe(1);
    });
  it('foundation health route precedes manufacturing root', async () => {
    const f = fixture(required(rows[0]));
    property(f.dependencies, 'manufacturing', () => {
      throw new Error('root');
    });
    expect((await f.dispatch({ pathname: '/health' })).statusCode).toBe(200);
  });
  it('unknown POST reaches later shared objectBody rather than manufacturing validation', async () => {
    const f = fixture(required(rows[0]));
    f.dependencies.quoteToCash = {} as NonNullable<ApiDependencies['quoteToCash']>;
    error(
      await f.dispatch({ method: 'POST', pathname: '/unmatched', body: null }),
      400,
      'invalid_request',
      'A JSON object body is required',
    );
    expect(f.call).not.toHaveBeenCalled();
  });
  for (const row of publishes) {
    it(row.label + ' lowercase short hex matches then UUID400', async () => {
      const f = fixture(row);
      error(
        await f.dispatch({ pathname: row.path.replace(id, 'ab-1') }),
        400,
        'invalid_request',
        'versionId must be a UUID',
      );
    });
    for (const alter of ['uppercase', 'slash', 'suffix', 'nonhex', 'unknown-kind'])
      it(row.label + ' rejects noncanonical raw path ' + alter, async () => {
        const f = fixture(row);
        const pathname =
          alter === 'uppercase'
            ? row.path.replace(id, id.toUpperCase())
            : alter === 'slash'
              ? row.path + '/'
              : alter === 'suffix'
                ? row.path + '/x'
                : alter === 'nonhex'
                  ? row.path.replace(id, 'xyz')
                  : row.path.replace(
                      'manufacturing-' + String(row.publishedKind),
                      'manufacturing-unknown',
                    );
        error(await f.dispatch({ pathname }), 404, 'not_found', 'Route not found');
        expect(f.call).not.toHaveBeenCalled();
      });
  }
});

describe('old list late field projection, array map and shallow output behavior', () => {
  for (const row of lists) {
    for (const fields of [null, [], ['name'], ['version', 'nested']] as const)
      it(row.label + ' no query fields request, P fields ' + JSON.stringify(fields), async () => {
        const f = fixture(row, { fields });
        const response = await f.dispatch({ body: null });
        expect(response.statusCode).toBe(200);
        const output = record(response.body).items as unknown[];
        if (fields === null) expect(output[0]).toBe(f.returned);
        else
          expect(output[0]).toEqual(
            Object.fromEntries(
              Object.entries(f.returned).filter(
                ([key]) => key === 'id' || fields.includes(key as never),
              ),
            ),
          );
      });
    it(
      row.label + ' fields read once per item after await, with no second authorization',
      async () => {
        const f = fixture(row);
        const wait = deferred<unknown>();
        f.call.mockReturnValue(wait.promise);
        const pending = f.dispatch();
        await vi.waitFor(() => {
          expect(f.call).toHaveBeenCalledOnce();
        });
        f.permissions.delete(row.cap);
        wait.resolve(f.output);
        const response = await pending;
        expect((record(response.body).items as unknown[])[0]).toBe(f.returned);
      },
    );
    it(row.label + ' item getter can change fields for next item', async () => {
      const f = fixture(row, { fields: ['name'] });
      const events: string[] = [];
      property(f.returned, 'name', () => {
        events.push('name');
        f.permissions.set(row.cap, { scopes: [], fields: ['version'] });
        return 'Visible';
      });
      const response = await f.dispatch();
      expect(record(response.body).items).toEqual([
        { id, name: 'Visible' },
        { id: other, version: 7 },
      ]);
      expect(events).toEqual(['name']);
    });
    it(row.label + ' grant fields getter is late for each row', async () => {
      const f = fixture(row);
      const wait = deferred<unknown>();
      f.call.mockReturnValue(wait.promise);
      const pending = f.dispatch();
      await vi.waitFor(() => {
        expect(f.call).toHaveBeenCalledOnce();
      });
      const events: number[] = [];
      property(required(f.permissions.get(row.cap)), 'fields', () => {
        events.push(events.length);
        return events.length === 1 ? ['name'] : [];
      });
      wait.resolve(f.output);
      expect(record((await pending).body).items).toEqual([{ id, name: 'Visible' }, { id: other }]);
      expect(events).toEqual([0, 1]);
    });
    it(row.label + ' map keeps holes and allows empty items without field lookup', async () => {
      const f = fixture(row);
      const output = new Array<JsonObject>(2);
      output[1] = f.returned;
      f.call.mockResolvedValue(output);
      const items = record((await f.dispatch()).body).items as unknown[];
      expect(items).toHaveLength(2);
      expect(Object.hasOwn(items, 0)).toBe(false);
      expect(items[1]).toBe(f.returned);
    });
    for (const value of [null, undefined, {}, 0, 'raw'])
      it(row.label + ' malformed list ' + JSON.stringify(value) + ' remains 500', async () => {
        const f = fixture(row);
        f.call.mockResolvedValue(value);
        error(await f.dispatch(), 500, 'internal_error', 'Internal server error');
      });
    it(
      row.label + ' selected P includes own enumerable special keys, not inherited keys',
      async () => {
        const f = fixture(row, { fields: ['__proto__', 'constructor', 'name'] });
        const item = Object.assign(Object.create({ inherited: true }) as Record<string, unknown>, {
          id,
          name: 'n',
          constructor: 'c',
        });
        Object.defineProperty(item, '__proto__', { enumerable: true, value: { raw: true } });
        f.call.mockResolvedValue([item]);
        const result = required(
          (record((await f.dispatch()).body).items as Record<string, unknown>[])[0],
        );
        expect(Object.keys(result)).toEqual(['id', 'name', 'constructor', '__proto__']);
        expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
        expect(Object.hasOwn(result, 'inherited')).toBe(false);
      },
    );
  }
});

describe('old mutation late M and fields/request authorization', () => {
  for (const row of rows.filter((r) => r.kind !== 'list')) {
    for (const read of ['absent', 'empty-fields', 'name', 'full', 'empty-scopes'] as const)
      it(row.label + ' late response read grant ' + read, async () => {
        const f = fixture(row, { noRead: true });
        if (read !== 'absent')
          f.permissions.set(row.read, {
            scopes: read === 'empty-scopes' ? [] : ['SELF'],
            fields: read === 'empty-fields' ? [] : read === 'name' ? ['name'] : null,
          });
        const response = await f.dispatch();
        expect(response.statusCode).toBe(201);
        expect(response.body).toEqual(
          read === 'absent'
            ? { id, version: 7 }
            : read === 'empty-fields'
              ? { id }
              : read === 'name'
                ? { id, name: 'Visible' }
                : f.returned,
        );
      });
    it(row.label + ' M uses grant changed during await without extra authorize', async () => {
      const f = fixture(row);
      const wait = deferred<unknown>();
      f.call.mockReturnValue(wait.promise);
      const pending = f.dispatch();
      await vi.waitFor(() => {
        expect(f.call).toHaveBeenCalledOnce();
      });
      f.permissions.delete(row.cap);
      f.permissions.set(row.read, { scopes: [], fields: ['nested'] });
      wait.resolve(f.returned);
      const response = await pending;
      expect(response.body).toEqual({ id, nested: f.returned.nested });
      expect(record(response.body).nested).toBe(f.returned.nested);
    });
    it(row.label + ' response null passes through unrestricted M', async () => {
      const f = fixture(row);
      f.call.mockResolvedValue(null);
      expect((await f.dispatch()).body).toBeNull();
    });
    it(row.label + ' response null with narrow fields fails through P', async () => {
      const f = fixture(row, { noRead: true });
      f.call.mockResolvedValue(null);
      error(await f.dispatch(), 500, 'internal_error', 'Internal server error');
    });
    it(row.label + ' plain fields getter failure after repository remains 500', async () => {
      const f = fixture(row);
      property(required(f.permissions.get(row.read)), 'fields', () => {
        throw new Error('response fields');
      });
      error(await f.dispatch(), 500, 'internal_error', 'Internal server error');
      expect(f.call).toHaveBeenCalledOnce();
    });
  }
  for (const row of creates) {
    it(row.label + ' manage own keys checked before value getters', async () => {
      const f = fixture(row, { fields: [] });
      property(
        f.body,
        row.kind === 'item' ? 'itemType' : row.kind === 'bom' ? 'lines' : 'operations',
        () => {
          throw new Error('must not parse before manage');
        },
      );
      error(await f.dispatch(), 403, 'forbidden', 'Field permission denied');
      expect(f.call).not.toHaveBeenCalled();
    });
    it(row.label + ' exact own-key grant permits inherited input fields', async () => {
      const f = fixture(row, { fields: [] });
      const inherited = Object.create(f.body) as Record<string, unknown>;
      expect((await f.dispatch({ body: inherited })).statusCode).toBe(201);
      expect(f.call.mock.calls[0]?.[0]).toEqual(expectedInput(row, f.body));
    });
    for (const value of [undefined, null, false, 0, '', []])
      it(
        row.label + ' objectBody ' + JSON.stringify(value) + ' precedes denied permission',
        async () => {
          const f = fixture(row, { denied: true });
          error(
            await f.dispatch({ body: value }),
            400,
            'invalid_request',
            'A JSON object body is required',
          );
        },
      );
    it(row.label + ' unknown own keys sorted before denied permission', async () => {
      const f = fixture(row, { denied: true });
      f.body.z = true;
      f.body.a = false;
      error(await f.dispatch(), 400, 'invalid_request', 'Unsupported fields: a, z');
    });
    for (const publish of [undefined, null, false, 0, 1, 'true', true])
      it(row.label + ' publish strictly equals true for ' + String(publish), async () => {
        const f = fixture(row);
        f.body.publish = publish;
        expect((await f.dispatch()).statusCode).toBe(201);
        expect(record(f.call.mock.calls[0]?.[0]).publish).toBe(publish === true);
      });
  }
});

describe('old createItem parsing and late capture', () => {
  const row = required(creates[0]);
  for (const itemType of ['RAW_MATERIAL', 'SEMI_FINISHED', 'FINISHED_GOOD', 'PACKAGING'])
    it('accepts only old enum ' + itemType, async () => {
      const f = fixture(row);
      f.body.itemType = ' ' + itemType + ' ';
      await f.dispatch();
      expect(record(f.call.mock.calls[0]?.[0]).itemType).toBe(itemType);
    });
  const invalid: readonly (readonly [string, unknown, string])[] = [
    ['itemType', undefined, 'itemType is required'],
    ['itemType', 'raw_material', 'itemType is unsupported'],
    ['sku', 'bad code', 'Code must be 1-64 uppercase letters, digits, underscore, or hyphen'],
    ['sku', null, 'sku is required'],
    ['name', ' ', 'name is required'],
    ['baseUnitCode', 'm2', 'Code must be 1-64 uppercase letters, digits, underscore, or hyphen'],
    ['specification', [], 'specification must be a JSON object'],
    ['specification', false, 'specification must be a JSON object'],
    ['effectiveAt', 'invalid', 'effectiveAt must be a valid timestamp'],
    ['effectiveAt', undefined, 'effectiveAt is required'],
  ];
  for (const [key, value, message] of invalid)
    it('item first invalid ' + key + ' ' + JSON.stringify(value), async () => {
      const f = fixture(row);
      f.body[key] = value;
      error(await f.dispatch(), 400, 'invalid_request', message);
    });
  for (const value of [null, undefined])
    it('specification nullish defaults empty for ' + JSON.stringify(value), async () => {
      const f = fixture(row);
      f.body.specification = value;
      await f.dispatch();
      expect(record(f.call.mock.calls[0]?.[0]).specification).toEqual({});
    });
  it('itemType read once before second root; remaining input after captured method', async () => {
    const f = fixture(row);
    const events: string[] = [];
    let root = 0;
    property(f.dependencies, 'manufacturing', () => {
      events.push('root' + String(++root));
      return f.repository;
    });
    property(f.repository, 'createItem', () => {
      events.push('method');
      return f.call;
    });
    for (const key of Object.keys(f.body)) {
      const value = f.body[key];
      property(f.body, key, () => {
        events.push(key);
        return value;
      });
    }
    await f.dispatch();
    expect(events).toEqual([
      'root1',
      'itemType',
      'root2',
      'method',
      'sku',
      'name',
      'baseUnitCode',
      'specification',
      'effectiveAt',
      'publish',
    ]);
  });
  it('invalid enum precedes missing method, invalid sku follows capture but precedes call', async () => {
    const f = fixture(row);
    property(f.repository, 'createItem', () => undefined);
    f.body.itemType = 'OTHER';
    error(await f.dispatch(), 400, 'invalid_request', 'itemType is unsupported');
    f.body.itemType = 'PACKAGING';
    f.body.sku = '';
    error(await f.dispatch(), 400, 'invalid_request', 'sku is required');
  });
  it('itemType getter replacement chooses late root, sku getter cannot change captured method', async () => {
    const f = fixture(row);
    const late = fixture(row);
    const unused = vi.fn<MockCall>();
    property(f.body, 'itemType', () => {
      f.dependencies.manufacturing = late.repository as unknown as Repository;
      return 'PACKAGING';
    });
    property(f.body, 'sku', () => {
      late.repository.createItem = unused;
      return 'A';
    });
    await f.dispatch();
    expect(f.call).not.toHaveBeenCalled();
    expect(late.call).toHaveBeenCalledOnce();
    expect(unused).not.toHaveBeenCalled();
  });
});

function nested(f: ReturnType<typeof fixture>, row: Row) {
  return record((f.body[row.kind === 'bom' ? 'lines' : 'operations'] as unknown[])[0]);
}
describe('old BOM/routing nested parsing before capture and top fields', () => {
  for (const row of creates.filter((r) => r.kind !== 'item')) {
    const key = row.kind === 'bom' ? 'lines' : 'operations';
    for (const value of [undefined, null, {}, 'raw', 0])
      it(row.label + ' ' + key + ' must be array before root method', async () => {
        const f = fixture(row);
        f.body[key] = value;
        f.body.code = '';
        property(f.repository, row.method, () => {
          throw new Error('method early');
        });
        error(await f.dispatch(), 400, 'invalid_request', key + ' must be an array');
      });
    it(row.label + ' empty nested array precedes missing method and top code', async () => {
      const f = fixture(row);
      f.body[key] = [];
      f.body.code = '';
      property(f.repository, row.method, () => undefined);
      error(await f.dispatch(), 400, 'invalid_request', key + ' must not be empty');
    });
    for (const value of [null, [], false])
      it(row.label + ' nested row object ' + JSON.stringify(value), async () => {
        const f = fixture(row);
        f.body[key] = [value];
        error(await f.dispatch(), 400, 'invalid_request', key + '[0] must be a JSON object');
      });
    it(row.label + ' nested allow precedes field parsing', async () => {
      const f = fixture(row);
      nested(f, row).z = true;
      nested(f, row).a = true;
      error(await f.dispatch(), 400, 'invalid_request', 'Unsupported fields: a, z');
    });
    it(row.label + ' sparse array holes survive old map and satisfy nonempty length', async () => {
      const f = fixture(row);
      const sparse = new Array<unknown>(2);
      f.body[key] = sparse;
      expect((await f.dispatch()).statusCode).toBe(201);
      const parsed = record(f.call.mock.calls[0]?.[0])[key] as unknown[];
      expect(parsed).toHaveLength(2);
      expect(Object.hasOwn(parsed, 0)).toBe(false);
    });
    it(row.label + ' preparse each nested entry before second root then top fields', async () => {
      const f = fixture(row);
      const events: string[] = [];
      let root = 0;
      const entry = nested(f, row);
      property(f.dependencies, 'manufacturing', () => {
        events.push('root' + String(++root));
        return f.repository;
      });
      property(f.repository, row.method, () => {
        events.push('method');
        return f.call;
      });
      for (const name of Object.keys(entry)) {
        const value = entry[name];
        property(entry, name, () => {
          events.push('nested:' + name);
          return value;
        });
      }
      for (const name of Object.keys(f.body)) {
        const value = f.body[name];
        property(f.body, name, () => {
          events.push(name);
          return value;
        });
      }
      await f.dispatch();
      const expected =
        row.kind === 'bom'
          ? ['componentItemVersionId', 'quantity', 'scrapBasisPoints', 'substitutes']
          : [
              'operationCode',
              'name',
              'workCenterCode',
              'sequence',
              'setupMinutes',
              'runMinutesPerUnit',
              'instructions',
            ];
      const top =
        row.kind === 'bom'
          ? [
              'code',
              'name',
              'productItemId',
              'productItemVersionId',
              'outputQuantity',
              'effectiveAt',
              'publish',
            ]
          : ['code', 'name', 'productItemId', 'productItemVersionId', 'effectiveAt', 'publish'];
      expect(events).toEqual([
        'root1',
        key,
        ...expected.map((n) => 'nested:' + n),
        'root2',
        'method',
        ...top,
      ]);
    });
    it(
      row.label +
        ' nested getter can replace root before capture; top getter cannot replace method',
      async () => {
        const f = fixture(row);
        const late = fixture(row);
        const unused = vi.fn<MockCall>();
        property(nested(f, row), row.kind === 'bom' ? 'quantity' : 'name', () => {
          f.dependencies.manufacturing = late.repository as unknown as Repository;
          return row.kind === 'bom' ? '2' : 'Op';
        });
        property(f.body, 'code', () => {
          late.repository[row.method] = unused;
          return 'A';
        });
        await f.dispatch();
        expect(f.call).not.toHaveBeenCalled();
        expect(late.call).toHaveBeenCalledOnce();
        expect(unused).not.toHaveBeenCalled();
      },
    );
    for (const [name, value, message] of [
      ['code', 'bad code', 'Code must be 1-64 uppercase letters, digits, underscore, or hyphen'],
      ['name', '', 'name is required'],
      ['productItemId', 'bad', 'productItemId must be a UUID'],
      ['productItemVersionId', 'bad', 'productItemVersionId must be a UUID'],
      ['effectiveAt', 'bad', 'effectiveAt must be a valid timestamp'],
    ] as const)
      it(row.label + ' top ' + name + ' validates after nested rows', async () => {
        const f = fixture(row);
        f.body[name] = value;
        error(await f.dispatch(), 400, 'invalid_request', message);
      });
  }
});

describe('old nested defaults, numeric bounds and shallow JSON objects', () => {
  const bom = required(creates[1]),
    routing = required(creates[2]);
  const cases: readonly (readonly ['bom' | 'routing', string, unknown, string])[] = [
    ['bom', 'componentItemVersionId', 'bad', 'lines[0].componentItemVersionId must be a UUID'],
    ['bom', 'quantity', 1, 'lines[0].quantity is required'],
    ['bom', 'quantity', '-1', 'lines[0].quantity must be non-negative'],
    ['bom', 'quantity', '01', 'Invalid decimal'],
    ['bom', 'quantity', '1.1234567', 'Invalid decimal'],
    [
      'bom',
      'scrapBasisPoints',
      -1,
      'lines[0].scrapBasisPoints must be an integer between 0 and 10000',
    ],
    [
      'bom',
      'scrapBasisPoints',
      10001,
      'lines[0].scrapBasisPoints must be an integer between 0 and 10000',
    ],
    [
      'bom',
      'scrapBasisPoints',
      '0',
      'lines[0].scrapBasisPoints must be an integer between 0 and 10000',
    ],
    ['bom', 'substitutes', null, 'lines[0].substitutes must be an array'],
    [
      'routing',
      'operationCode',
      'bad',
      'Code must be 1-64 uppercase letters, digits, underscore, or hyphen',
    ],
    ['routing', 'name', '', 'name is required'],
    [
      'routing',
      'workCenterCode',
      'wc',
      'Code must be 1-64 uppercase letters, digits, underscore, or hyphen',
    ],
    ['routing', 'sequence', 0, 'sequence must be an integer between 1 and 100000'],
    ['routing', 'sequence', 100001, 'sequence must be an integer between 1 and 100000'],
    ['routing', 'sequence', 1.5, 'sequence must be an integer between 1 and 100000'],
    ['routing', 'setupMinutes', '-0.1', 'setupMinutes must be non-negative'],
    ['routing', 'runMinutesPerUnit', 0, 'runMinutesPerUnit is required'],
    ['routing', 'instructions', null, 'instructions must be a JSON object'],
    ['routing', 'instructions', [], 'instructions must be a JSON object'],
  ];
  for (const [kind, key, value, message] of cases)
    it(kind + ' nested invalid ' + key + ' ' + JSON.stringify(value), async () => {
      const row = kind === 'bom' ? bom : routing;
      const f = fixture(row);
      nested(f, row)[key] = value;
      error(await f.dispatch(), 400, 'invalid_request', message);
    });
  const subCases: readonly (readonly [string, unknown, string])[] = [
    ['itemVersionId', 'bad', 'itemVersionId must be a UUID'],
    ['priority', 0, 'priority must be an integer between 1 and 1000'],
    ['priority', 1001, 'priority must be an integer between 1 and 1000'],
    ['priority', '1', 'priority must be an integer between 1 and 1000'],
    ['conversionFactor', '-1', 'conversionFactor must be non-negative'],
    ['conversionFactor', '1e2', 'Invalid decimal'],
    ['extra', true, 'Unsupported fields: extra'],
  ];
  for (const [key, value, message] of subCases)
    it('substitute invalid ' + key + ' ' + JSON.stringify(value), async () => {
      const f = fixture(bom);
      record((nested(f, bom).substitutes as unknown[])[0])[key] = value;
      error(await f.dispatch(), 400, 'invalid_request', message);
    });
  for (const value of [null, [], false])
    it('substitute nonobject ' + JSON.stringify(value), async () => {
      const f = fixture(bom);
      nested(f, bom).substitutes = [value];
      error(
        await f.dispatch(),
        400,
        'invalid_request',
        'lines[0].substitutes[0] must be a JSON object',
      );
    });
  it('inherited scrap/substitutes ignored by hasOwn, unlike component/quantity', async () => {
    const f = fixture(bom);
    const line = Object.create({
      componentItemVersionId: id,
      quantity: '1',
      scrapBasisPoints: 500,
      substitutes: null,
    }) as Record<string, unknown>;
    f.body.lines = [line];
    await f.dispatch();
    expect(record(f.call.mock.calls[0]?.[0]).lines).toEqual([
      { componentItemVersionId: id, quantity: '1', scrapBasisPoints: 0, substitutes: [] },
    ]);
  });
  it('inherited instructions ignored by hasOwn while inherited operation fields visible', async () => {
    const f = fixture(routing);
    const entry = nested(f, routing);
    f.body.operations = [Object.create(entry) as Record<string, unknown>];
    await f.dispatch();
    expect(
      record((record(f.call.mock.calls[0]?.[0]).operations as unknown[])[0]).instructions,
    ).toEqual({});
  });
  it('instructions object preserves prototype/own special key/nested reference', async () => {
    const f = fixture(routing);
    const instructions = Object.create({ inherited: true }) as Record<string, unknown>;
    Object.defineProperty(instructions, '__proto__', { value: { raw: true }, enumerable: true });
    nested(f, routing).instructions = instructions;
    await f.dispatch();
    expect(
      record((record(f.call.mock.calls[0]?.[0]).operations as unknown[])[0]).instructions,
    ).toBe(instructions);
  });
  it('BOM default own absence differs from own undefined', async () => {
    const f = fixture(bom);
    delete nested(f, bom).scrapBasisPoints;
    delete nested(f, bom).substitutes;
    await f.dispatch();
    expect(record((record(f.call.mock.calls[0]?.[0]).lines as unknown[])[0]).scrapBasisPoints).toBe(
      0,
    );
    nested(f, bom).scrapBasisPoints = undefined;
    error(
      await f.dispatch(),
      400,
      'invalid_request',
      'lines[0].scrapBasisPoints must be an integer between 0 and 10000',
    );
  });
  it('outputQuantity zero is normalized and accepted by HTTP mock, not a DB business claim', async () => {
    const f = fixture(bom);
    f.body.outputQuantity = ' -0.000000 ';
    await f.dispatch();
    expect(record(f.call.mock.calls[0]?.[0]).outputQuantity).toBe('0');
  });
  for (const [key, value] of [
    ['scrapBasisPoints', 10000],
    ['scrapBasisPoints', 0],
  ] as const)
    it('BOM integer boundary ' + JSON.stringify(value), async () => {
      const f = fixture(bom);
      nested(f, bom)[key] = value;
      expect((await f.dispatch()).statusCode).toBe(201);
    });
  for (const sequence of [1, 100000])
    it('routing integer boundary ' + String(sequence), async () => {
      const f = fixture(routing);
      nested(f, routing).sequence = sequence;
      expect((await f.dispatch()).statusCode).toBe(201);
    });
  it('sparse substitute map holes are not filled or rejected at HTTP boundary', async () => {
    const f = fixture(bom);
    nested(f, bom).substitutes = new Array<unknown>(2);
    await f.dispatch();
    const substitutes = record((record(f.call.mock.calls[0]?.[0]).lines as unknown[])[0])
      .substitutes as unknown[];
    expect(substitutes).toHaveLength(2);
    expect(Object.hasOwn(substitutes, 0)).toBe(false);
  });
});

describe('old field-key grants, references and capture edge supplements', () => {
  it('BOM substitute fields are read UUID then priority then conversion before next line/capture', async () => {
    const row = required(creates[1]),
      f = fixture(row),
      events: string[] = [];
    const substitute: Record<string, unknown> = {
      itemVersionId: other,
      priority: 1,
      conversionFactor: '1',
    };
    for (const key of Object.keys(substitute)) {
      const value = substitute[key];
      property(substitute, key, () => {
        events.push(key);
        return value;
      });
    }
    const line = nested(f, row);
    line.substitutes = [substitute];
    const lines: unknown[] = [line];
    property(lines, 1, () => {
      events.push('nextLine');
      return null;
    });
    f.body.lines = lines;
    property(f.repository, 'createBom', () => {
      throw new Error('captured too early');
    });
    error(await f.dispatch(), 400, 'invalid_request', 'lines[1] must be a JSON object');
    expect(events).toEqual(['itemVersionId', 'priority', 'conversionFactor', 'nextLine']);
  });
  it('inherited array index is visited by old nested map without mutating global prototype', async () => {
    const row = required(creates[1]),
      f = fixture(row),
      line = nested(f, row);
    const inherited = Object.create(Array.prototype) as Record<string, unknown>;
    Object.defineProperty(inherited, '0', { value: line, configurable: true, enumerable: true });
    const lines = new Array<unknown>(1);
    Object.setPrototypeOf(lines, inherited);
    f.body.lines = lines;
    expect(Object.hasOwn(lines, 0)).toBe(false);
    expect((await f.dispatch()).statusCode).toBe(201);
    const parsed = record(f.call.mock.calls[0]?.[0]).lines as unknown[];
    expect(Object.hasOwn(parsed, 0)).toBe(true);
    expect(record(parsed[0]).componentItemVersionId).toBe(id);
  });
  for (const row of creates) {
    it(row.label + ' requests every own key including publish undefined', async () => {
      const f = fixture(row);
      f.body.publish = undefined;
      f.permissions.set(row.cap, { scopes: f.scopes, fields: Object.keys(f.body) });
      expect((await f.dispatch()).statusCode).toBe(201);
      f.permissions.set(row.cap, {
        scopes: f.scopes,
        fields: Object.keys(f.body).filter((k) => k !== 'publish'),
      });
      error(await f.dispatch(), 403, 'forbidden', 'Field permission denied');
    });
    it(
      row.label + ' unknown inherited and symbol keys remain outside allow/field checks',
      async () => {
        const f = fixture(row);
        Object.setPrototypeOf(f.body, { unexpected: true });
        Object.defineProperty(f.body, Symbol('ignored'), { enumerable: true, value: true });
        f.permissions.set(row.cap, { scopes: f.scopes, fields: Object.keys(f.body) });
        expect((await f.dispatch()).statusCode).toBe(201);
      },
    );
    it(
      row.label + ' input getter DomainError preserves code/message before repository call',
      async () => {
        const f = fixture(row);
        property(f.body, row.kind === 'item' ? 'sku' : 'code', () => {
          throw new DomainError('conflict', 'input getter conflict');
        });
        error(await f.dispatch(), 409, 'conflict', 'input getter conflict');
        expect(f.call).not.toHaveBeenCalled();
      },
    );
    it(
      row.label + ' keeps original Date normalization rather than strict calendar validation',
      async () => {
        const f = fixture(row);
        f.body.effectiveAt = '2026-02-30';
        expect((await f.dispatch()).statusCode).toBe(201);
        expect(record(f.call.mock.calls[0]?.[0]).effectiveAt).toBe('2026-03-02T00:00:00.000Z');
      },
    );
  }
  for (const row of rows) {
    it(
      row.label + ' actor can change after Q0 but cannot rewrite captured scopes/anchors',
      async () => {
        const f = fixture(row);
        const lateActor = { employeeId: other, companyId: 'late-mock-company' };
        property(f.context, 'actor', () => {
          f.permissions.set(row.cap, { scopes: ['GROUP'], fields: null });
          return lateActor;
        });
        await f.dispatch();
        const q = record(f.call.mock.calls[0]?.[row.kind === 'publish' ? 2 : 1]);
        expect(q.actor).toBe(lateActor);
        expect(q.scopes).toBe(f.scopes);
        expect(q.anchors).toBe(f.anchors);
      },
    );
    it(row.label + ' denied Q0 does not read second dependency or method', async () => {
      const f = fixture(row, { denied: true });
      let roots = 0;
      property(f.dependencies, 'manufacturing', () => {
        roots++;
        return f.repository;
      });
      property(f.repository, row.method, () => {
        throw new Error('method should not be reached');
      });
      error(await f.dispatch(), 403, 'forbidden', 'Permission denied');
      expect(roots).toBe(1);
    });
  }
  it('unknown POST without later quoteToCash root remains 404 even with null body', async () => {
    const f = fixture(required(rows[0]));
    error(
      await f.dispatch({ method: 'POST', pathname: '/unmatched', body: null }),
      404,
      'not_found',
      'Route not found',
    );
  });
  it('item specification accepts inherited/special JSON fields and retains object identity', async () => {
    const row = required(creates[0]),
      f = fixture(row);
    const specification = Object.create({ inherited: true }) as Record<string, unknown>;
    Object.defineProperty(specification, '__proto__', { enumerable: true, value: { raw: true } });
    f.body.specification = specification;
    await f.dispatch();
    expect(record(f.call.mock.calls[0]?.[0]).specification).toBe(specification);
  });
  it('BOM parses substitutes before later lines and before top code/root capture', async () => {
    const row = required(creates[1]),
      f = fixture(row);
    const line = nested(f, row);
    line.substitutes = [{ itemVersionId: other, priority: 0, conversionFactor: '1' }];
    f.body.lines = [line, null];
    f.body.code = '';
    property(f.repository, 'createBom', () => {
      throw new Error('capture too early');
    });
    error(
      await f.dispatch(),
      400,
      'invalid_request',
      'priority must be an integer between 1 and 1000',
    );
  });
  it('BOM input rows/arrays are rebuilt while routing instructions stay shallow', async () => {
    const row = required(creates[1]),
      f = fixture(row);
    await f.dispatch();
    const input = record(f.call.mock.calls[0]?.[0]),
      line = nested(f, row);
    const parsed = input.lines as unknown[];
    expect(parsed).not.toBe(f.body.lines);
    expect(parsed[0]).not.toBe(line);
    expect(record(parsed[0]).substitutes).not.toBe(line.substitutes);
  });
});

describe('old publish body-first, no requested fields and four-argument contract', () => {
  for (const row of publishes) {
    for (const value of [undefined, null, {}])
      it(row.label + ' nullish-or-empty body ' + JSON.stringify(value) + ' is valid', async () => {
        const f = fixture(row, { fields: [] });
        expect((await f.dispatch({ body: value })).statusCode).toBe(201);
        expect(f.call.mock.calls[0]).toHaveLength(4);
      });
    for (const value of [false, 0, '', [], { version: 1 }])
      it(
        row.label + ' bad body ' + JSON.stringify(value) + ' precedes denied grant and UUID',
        async () => {
          const f = fixture(row, { denied: true });
          error(
            await f.dispatch({ body: value, pathname: row.path.replace(id, 'ab') }),
            400,
            'invalid_request',
            record(value).version === 1
              ? 'Unsupported fields: version'
              : 'A JSON object body is required',
          );
        },
      );
    it(row.label + ' denied grant precedes malformed UUID and method capture', async () => {
      const f = fixture(row, { denied: true });
      property(f.repository, 'publish', () => {
        throw new Error('method read');
      });
      error(
        await f.dispatch({ pathname: row.path.replace(id, 'ab') }),
        403,
        'forbidden',
        'Permission denied',
      );
    });
    it(
      row.label + ' method getter before UUID before actor and arguments before call',
      async () => {
        const f = fixture(row);
        const events: string[] = [];
        property(f.repository, 'publish', () => {
          events.push('method');
          return undefined;
        });
        property(f.context, 'actor', () => {
          events.push('actor');
          return actor;
        });
        error(
          await f.dispatch({ pathname: row.path.replace(id, 'ab') }),
          400,
          'invalid_request',
          'versionId must be a UUID',
        );
        expect(events).toEqual(['method']);
        error(await f.dispatch(), 500, 'internal_error', 'Internal server error');
        expect(events).toEqual(['method', 'method', 'actor']);
      },
    );
    it(row.label + ' inherited and symbol body keys do not request fields or reject', async () => {
      const f = fixture(row, { fields: [] });
      const body = Object.create({ unexpected: true }) as Record<string, unknown>;
      Object.defineProperty(body, Symbol('ignored'), { enumerable: true, value: true });
      expect((await f.dispatch({ body })).statusCode).toBe(201);
    });
  }
});
