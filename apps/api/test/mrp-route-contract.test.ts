// Frozen against 241e8c5 inline MRP HTTP; no future route module is imported.
import { describe, expect, it, vi } from 'vitest';
import { DomainError, type AuthorizationContext } from '@kingturf/domain';
import type { DataScope, JsonObject, PermissionKey } from '@kingturf/types';
import { buildApp, type ApiDependencies, type ApiRequest, type ApiResponse } from '../src/app.js';

type Repository = NonNullable<ApiDependencies['mrp']>;
type MutableDependencies = { -readonly [K in keyof ApiDependencies]: ApiDependencies[K] };
type Grant = NonNullable<ReturnType<AuthorizationContext['permissions']['get']>>;
type MockCall = (...args: unknown[]) => Promise<unknown>;
type Row = Readonly<{
  label: string;
  kind: 'list' | 'policy' | 'demand' | 'run' | 'proposal';
  method: 'list' | 'createPolicy' | 'createDemand' | 'run' | 'transitionProposal';
  http: string;
  path: string;
  cap: PermissionKey;
  read: PermissionKey;
  view?: string;
  state?: string;
}>;
const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const other = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const correlationId = '66666666-6666-4666-8666-666666666666';
const actor = { employeeId: id, companyId: 'mrp-old-http-mock' };
const time = '2026-08-01T08:00:00+08:00';
const iso = '2026-08-01T00:00:00.000Z';
const rows: readonly Row[] = [
  ...(['policies', 'demands', 'runs'] as const).map(
    (view): Row => ({
      label: view + ' list',
      kind: 'list',
      method: 'list',
      http: 'GET',
      path: '/api/v1/mrp-' + view,
      view,
      cap: view === 'policies' ? 'mrp-policy:read' : 'mrp:read',
      read: view === 'policies' ? 'mrp-policy:read' : 'mrp:read',
    }),
  ),
  {
    label: 'policy create',
    kind: 'policy',
    method: 'createPolicy',
    http: 'POST',
    path: '/api/v1/mrp-policies',
    cap: 'mrp-policy:manage',
    read: 'mrp-policy:read',
  },
  {
    label: 'demand create',
    kind: 'demand',
    method: 'createDemand',
    http: 'POST',
    path: '/api/v1/mrp-demands',
    cap: 'mrp:run',
    read: 'mrp:read',
  },
  {
    label: 'run create',
    kind: 'run',
    method: 'run',
    http: 'POST',
    path: '/api/v1/mrp-runs',
    cap: 'mrp:run',
    read: 'mrp:read',
  },
  ...(['approve', 'reject', 'release', 'cancel'] as const).map(
    (action): Row => ({
      label: 'proposal ' + action,
      kind: 'proposal',
      method: 'transitionProposal',
      http: 'POST',
      path: '/api/v1/mrp-proposals/' + id + '/' + action,
      cap: action === 'release' ? 'mrp:release' : 'mrp:approve',
      read: 'mrp:read',
      state: { approve: 'APPROVED', reject: 'REJECTED', release: 'RELEASED', cancel: 'CANCELLED' }[
        action
      ],
    }),
  ),
];
const lists = rows.filter((r) => r.kind === 'list');
const writes = rows.filter((r) => r.kind !== 'list');
const proposals = rows.filter((r) => r.kind === 'proposal');
const record = (value: unknown) => value as Record<string, unknown>;
function required<T>(value: T | undefined): T {
  if (value === undefined) throw new Error('missing fixture value');
  return value;
}
function property(target: object, key: PropertyKey, get: () => unknown) {
  Object.defineProperty(target, key, { configurable: true, enumerable: true, get });
}
function bodyFor(row: Row): Record<string, unknown> {
  if (row.kind === 'policy')
    return {
      itemVersionId: id,
      safetyStock: ' 1.250000 ',
      minimumOrderQuantity: ' 2.000000 ',
      orderMultiple: ' 0.000000 ',
      leadTimeDays: 0,
      freezeWindowDays: 3650,
      makeOrBuy: ' BUY ',
      effectiveAt: time,
    };
  if (row.kind === 'demand')
    return {
      itemVersionId: id,
      sourceType: ' SALES-FORECAST ',
      sourceId: other,
      requiredAt: ' 2026-08-31 ',
      quantity: ' 5.250000 ',
      priority: 10,
    };
  if (row.kind === 'run') return { runNumber: ' MRP_1 ', asOf: time, horizonEnd: ' 2026-12-31 ' };
  if (row.kind === 'proposal')
    return { reason: ' Planner reason ', evidence: { nested: { keep: true } } };
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
  const returned: JsonObject = {
    id,
    version: 7,
    name: 'Visible',
    extra: 'opaque',
    nested: { keep: true },
  };
  const output = [returned, { ...returned, id: other }];
  const repository = {
    list: vi.fn<MockCall>().mockResolvedValue(output),
    createPolicy: vi.fn<MockCall>().mockResolvedValue(returned),
    createDemand: vi.fn<MockCall>().mockResolvedValue(returned),
    run: vi.fn<MockCall>().mockResolvedValue(returned),
    transitionProposal: vi.fn<MockCall>().mockResolvedValue(returned),
  };
  const authenticate = vi
    .fn<ApiDependencies['auth']['authenticate']>()
    .mockResolvedValue(options.unauthenticated ? null : context);
  const dependencies: MutableDependencies = {
    auth: { authenticate } as unknown as ApiDependencies['auth'],
    organizations: {} as ApiDependencies['organizations'],
    employees: {} as ApiDependencies['employees'],
    ...(options.missing ? {} : { mrp: repository as unknown as Repository }),
  };
  const headers = {
    authorization: 'Bearer mock-only-mrp-session',
    'x-correlation-id': correlationId,
  };
  const body = bodyFor(row);
  const app = buildApp(dependencies);
  const dispatch = (overrides: Partial<ApiRequest> = {}) =>
    app.dispatch({ method: row.http, pathname: row.path, headers, body, ...overrides });
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
    headers,
    body,
    app,
    dispatch,
    call: repository[row.method],
  };
}
function error(response: ApiResponse, status: number, code: string, message: string) {
  expect(response.statusCode).toBe(status);
  expect(response.body).toEqual({ error: { code, message, correlationId } });
  expect(response.headers?.['x-correlation-id']).toBe(correlationId);
}
function expectedInput(row: Row, body: Record<string, unknown>) {
  if (row.kind === 'policy')
    return {
      itemVersionId: id,
      safetyStock: '1.25',
      minimumOrderQuantity: '2',
      orderMultiple: '0',
      leadTimeDays: 0,
      freezeWindowDays: 3650,
      makeOrBuy: 'BUY',
      effectiveAt: iso,
    };
  if (row.kind === 'demand')
    return {
      itemVersionId: id,
      sourceType: 'SALES-FORECAST',
      sourceId: other,
      requiredAt: '2026-08-31',
      quantity: '5.25',
      priority: 10,
    };
  if (row.kind === 'run') return { runNumber: 'MRP_1', asOf: iso, horizonEnd: '2026-12-31' };
  return { reason: 'Planner reason', evidence: body.evidence };
}
const scopeIndex = (row: Row) => (row.kind === 'proposal' ? 3 : 1);
type Field = Readonly<{
  name: string;
  parser:
    | 'uuid'
    | 'decimal'
    | 'integer'
    | 'code'
    | 'timestamp'
    | 'calendar'
    | 'enum'
    | 'string'
    | 'object';
  min?: number;
  max?: number;
}>;
function fieldsFor(row: Row): readonly Field[] {
  if (row.kind === 'policy')
    return [
      { name: 'makeOrBuy', parser: 'enum' },
      { name: 'itemVersionId', parser: 'uuid' },
      ...['safetyStock', 'minimumOrderQuantity', 'orderMultiple'].map(
        (name): Field => ({ name, parser: 'decimal' }),
      ),
      ...['leadTimeDays', 'freezeWindowDays'].map(
        (name): Field => ({ name, parser: 'integer', min: 0, max: 3650 }),
      ),
      { name: 'effectiveAt', parser: 'timestamp' },
    ];
  if (row.kind === 'demand')
    return [
      { name: 'itemVersionId', parser: 'uuid' },
      { name: 'sourceType', parser: 'code' },
      { name: 'sourceId', parser: 'uuid' },
      { name: 'requiredAt', parser: 'calendar' },
      { name: 'quantity', parser: 'decimal' },
      { name: 'priority', parser: 'integer', min: 1, max: 100000 },
    ];
  if (row.kind === 'run')
    return [
      { name: 'runNumber', parser: 'code' },
      { name: 'asOf', parser: 'timestamp' },
      { name: 'horizonEnd', parser: 'calendar' },
    ];
  return [
    { name: 'reason', parser: 'string' },
    { name: 'evidence', parser: 'object' },
  ];
}
const codeMessage = 'Code must be 1-64 uppercase letters, digits, underscore, or hyphen';
function invalidCases(field: Field): readonly (readonly [unknown, string])[] {
  const name = field.name;
  if (field.parser === 'integer')
    return [
      [-1, `${name} must be an integer between ${String(field.min)} and ${String(field.max)}`],
      [0.5, `${name} must be an integer between ${String(field.min)} and ${String(field.max)}`],
      ['1', `${name} must be an integer between ${String(field.min)} and ${String(field.max)}`],
      [
        Number.MAX_SAFE_INTEGER,
        `${name} must be an integer between ${String(field.min)} and ${String(field.max)}`,
      ],
    ];
  if (field.parser === 'object')
    return [
      [[], `${name} must be a JSON object`],
      [false, `${name} must be a JSON object`],
      ['x', `${name} must be a JSON object`],
    ];
  const missing: readonly (readonly [unknown, string])[] = [
    [undefined, `${name} is required`],
    [null, `${name} is required`],
    [' ', `${name} is required`],
    [1, `${name} is required`],
  ];
  if (field.parser === 'string') return missing;
  if (field.parser === 'uuid')
    return [
      ...missing,
      ['abc', `${name} must be a UUID`],
      ['aaaaaaaa-aaaa-0aaa-8aaa-aaaaaaaaaaaa', `${name} must be a UUID`],
      ['aaaaaaaa-aaaa-4aaa-0aaa-aaaaaaaaaaaa', `${name} must be a UUID`],
    ];
  if (field.parser === 'decimal')
    return [
      ...missing,
      ['01', 'Invalid decimal'],
      ['1e3', 'Invalid decimal'],
      ['.5', 'Invalid decimal'],
      ['1.0000001', 'Invalid decimal'],
      ['1000000000000000000', 'Invalid decimal'],
      ['-1', `${name} must be non-negative`],
    ];
  if (field.parser === 'code')
    return [
      ...missing,
      ['lower', codeMessage],
      ['1CODE', codeMessage],
      ['A B', codeMessage],
      ['A'.repeat(65), codeMessage],
    ];
  if (field.parser === 'enum')
    return [...missing, ['buy', 'makeOrBuy is unsupported'], ['OTHER', 'makeOrBuy is unsupported']];
  if (field.parser === 'timestamp')
    return [
      ...missing,
      ['not-time', `${name} must be a valid timestamp`],
      ['2026-13-01', `${name} must be a valid timestamp`],
    ];
  return [
    ...missing,
    ['2026-8-01', `${name} must be a valid YYYY-MM-DD date`],
    ['2026-08-01T00:00:00Z', `${name} must be a valid YYYY-MM-DD date`],
    ['2026-13-01', `${name} must be a valid YYYY-MM-DD date`],
    ['2026-02-32', `${name} must be a valid YYYY-MM-DD date`],
  ];
}
function deferred<T>() {
  let settle: ((value: T) => void) | undefined;
  const promise = new Promise<T>((resolve) => {
    settle = resolve;
  });
  return {
    promise,
    resolve(value: T) {
      required(settle)(value);
    },
  };
}

describe('241e8c5 ten canonical old MRP HTTP operations (opaque mock, not MRP SQL)', () => {
  for (const row of rows) {
    it(row.label + ' exact status, arguments, fresh scope object, receiver and refs', async () => {
      const f = fixture(row);
      const response = await f.dispatch();
      const q = { actor, scopes: f.scopes, anchors: f.anchors };
      const args =
        row.kind === 'list'
          ? [row.view, q]
          : row.kind === 'proposal'
            ? [id, row.state, expectedInput(row, f.body), q, correlationId]
            : [expectedInput(row, f.body), q, correlationId];
      expect(f.call.mock.calls).toEqual([args]);
      expect(f.call.mock.contexts).toEqual([f.repository]);
      const actual = record(f.call.mock.calls[0]?.[scopeIndex(row)]);
      expect(actual).not.toBe(f.context);
      expect(actual.actor).toBe(actor);
      expect(actual.scopes).toBe(f.scopes);
      expect(actual.anchors).toBe(f.anchors);
      expect(response.statusCode).toBe(row.kind === 'list' ? 200 : 201);
      if (row.kind === 'list') {
        expect(record(response.body).items).not.toBe(f.output);
        expect((record(response.body).items as unknown[])[0]).toBe(f.returned);
      } else expect(response.body).toBe(f.returned);
      if (row.kind === 'proposal')
        expect(record(f.call.mock.calls[0]?.[2]).evidence).toBe(f.body.evidence);
    });
    for (const scope of ['SELF', 'TEAM', 'DEPARTMENT', 'REGION', 'COMPANY', 'GROUP'] as const)
      it(
        row.label + ' forwards nonempty ' + scope + ' to mock, not SQL scope approval',
        async () => {
          const f = fixture(row, { scopes: [scope] });
          expect((await f.dispatch()).statusCode).toBe(row.kind === 'list' ? 200 : 201);
          expect(record(f.call.mock.calls[0]?.[scopeIndex(row)]).scopes).toBe(f.scopes);
        },
      );
    for (const denied of ['missing', 'empty'] as const)
      it(row.label + ' denies ' + denied + ' primary permission before method', async () => {
        const f = fixture(row, denied === 'missing' ? { denied: true } : { scopes: [] });
        property(f.repository, row.method, () => {
          throw new Error('method read');
        });
        error(await f.dispatch(), 403, 'forbidden', 'Permission denied');
        expect(f.call).not.toHaveBeenCalled();
      });
    it(row.label + ' default anchors is empty', async () => {
      const f = fixture(row, { noAnchors: true });
      await f.dispatch();
      expect(record(f.call.mock.calls[0]?.[scopeIndex(row)]).anchors).toEqual([]);
    });
    it(row.label + ' global 401 precedes root read', async () => {
      const f = fixture(row, { unauthenticated: true });
      property(f.dependencies, 'mrp', () => {
        throw new Error('root read');
      });
      error(await f.dispatch(), 401, 'authentication_required', 'A valid session is required');
    });
    it(row.label + ' missing root skips with 404, no new 503', async () => {
      const f = fixture(row, { missing: true });
      error(await f.dispatch(), 404, 'not_found', 'Route not found');
    });
    it(row.label + ' missing method is 500 after validation', async () => {
      const f = fixture(row);
      property(f.repository, row.method, () => undefined);
      error(await f.dispatch(), 500, 'internal_error', 'Internal server error');
    });
    for (const [code, status] of [
      ['invalid_request', 400],
      ['forbidden', 403],
      ['not_found', 404],
      ['conflict', 409],
    ] as const)
      it(row.label + ' maps repository ' + code + ' with original message and C', async () => {
        const f = fixture(row);
        f.call.mockRejectedValue(new DomainError(code, 'old repo error'));
        error(await f.dispatch(), status, code, 'old repo error');
      });
    it(row.label + ' masks ordinary repository errors', async () => {
      const f = fixture(row);
      f.call.mockRejectedValue(new Error('private diagnostic'));
      error(await f.dispatch(), 500, 'internal_error', 'Internal server error');
    });
    it(row.label + ' late root may throw after Q', async () => {
      const f = fixture(row);
      let reads = 0;
      property(f.dependencies, 'mrp', () => {
        if (++reads === 2) throw new Error('root2');
        return f.repository;
      });
      error(await f.dispatch(), 500, 'internal_error', 'Internal server error');
      expect(reads).toBe(2);
      expect(f.call).not.toHaveBeenCalled();
    });
    it(row.label + ' method getter throw is 500', async () => {
      const f = fixture(row);
      property(f.repository, row.method, () => {
        throw new Error('method');
      });
      error(await f.dispatch(), 500, 'internal_error', 'Internal server error');
    });
    it(row.label + ' permission scope/anchors read before second root', async () => {
      const f = fixture(row);
      const events: string[] = [];
      let roots = 0;
      property(required(f.permissions.get(row.cap)), 'scopes', () => {
        events.push('scopes');
        return f.scopes;
      });
      property(required(f.context.scopeAnchors), 'get', () => (cap: PermissionKey) => {
        events.push('anchors:' + cap);
        return f.anchors;
      });
      property(f.dependencies, 'mrp', () => {
        events.push('root' + String(++roots));
        return f.repository;
      });
      await f.dispatch();
      expect(events).toEqual(['root1', 'scopes', 'scopes', 'anchors:' + row.cap, 'root2']);
    });
    it(row.label + ' Q can replace late root', async () => {
      const f = fixture(row),
        replacement = fixture(row);
      property(required(f.context.scopeAnchors), 'get', () => () => {
        f.dependencies.mrp = replacement.repository as unknown as Repository;
        return f.anchors;
      });
      await f.dispatch();
      expect(f.call).not.toHaveBeenCalled();
      expect(replacement.call).toHaveBeenCalledOnce();
    });
    it(row.label + ' method getter replacement cannot change captured receiver', async () => {
      const f = fixture(row),
        replacement = fixture(row);
      const captured = f.call;
      property(f.repository, row.method, () => {
        f.dependencies.mrp = replacement.repository as unknown as Repository;
        return captured;
      });
      await f.dispatch();
      expect(captured.mock.contexts).toEqual([f.repository]);
      expect(replacement.call).not.toHaveBeenCalled();
    });
    it(row.label + ' actor getter replacement follows captured method', async () => {
      const f = fixture(row),
        replacement = fixture(row);
      property(f.context, 'actor', () => {
        f.dependencies.mrp = replacement.repository as unknown as Repository;
        return actor;
      });
      await f.dispatch();
      expect(f.call).toHaveBeenCalledOnce();
      expect(replacement.call).not.toHaveBeenCalled();
    });
    it(row.label + ' ignores nested query contents', async () => {
      const f = fixture(row);
      const query = new Proxy(
        {},
        {
          get() {
            throw new Error('nested query');
          },
        },
      );
      expect((await f.dispatch({ query })).statusCode).toBe(row.kind === 'list' ? 200 : 201);
    });
    it(row.label + ' request outer shallow spread getter rejects outside HTTP catch', async () => {
      const f = fixture(row);
      const cause = new Error('outer getter');
      const request: ApiRequest = {
        method: row.http,
        pathname: row.path,
        body: f.body,
        headers: f.headers,
      };
      property(request, 'query', () => {
        throw cause;
      });
      await expect(f.app.dispatch(request)).rejects.toBe(cause);
      expect(f.call).not.toHaveBeenCalled();
    });
  }
});

describe('ordinary lookup, wide guard, adjacent branches and raw proposal matcher', () => {
  for (const root of [null, false, 0, ''] as const)
    it('falsy root skips ' + JSON.stringify(root), async () => {
      const f = fixture(required(rows[0]));
      property(f.dependencies, 'mrp', () => root);
      error(await f.dispatch(), 404, 'not_found', 'Route not found');
    });
  for (const pathname of ['constructor', '__proto__', 'toString', 'hasOwnProperty', 'valueOf'])
    it('inherited GET ' + pathname + ' remains 500 before permission', async () => {
      const f = fixture(required(rows[0]), { denied: true });
      error(await f.dispatch({ pathname }), 500, 'internal_error', 'Internal server error');
    });
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'])
    it(method + ' inherited key is not destructured', async () => {
      const f = fixture(required(rows[0]));
      error(
        await f.dispatch({ method, pathname: 'constructor' }),
        404,
        'not_found',
        'Route not found',
      );
    });
  for (const method of ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'])
    it(method + ' unsupported path reads first root exactly once', async () => {
      const f = fixture(required(rows[0]));
      let roots = 0;
      property(f.dependencies, 'mrp', () => {
        roots++;
        return f.repository;
      });
      error(
        await f.dispatch({ method, pathname: '/api/v1/mrp-policies/' }),
        404,
        'not_found',
        'Route not found',
      );
      expect(roots).toBe(1);
    });
  it('health precedes root', async () => {
    const f = fixture(required(rows[0]));
    property(f.dependencies, 'mrp', () => {
      throw new Error('root');
    });
    expect((await f.dispatch({ pathname: '/health' })).statusCode).toBe(200);
  });
  it('procurement supported GET wins before mrp', async () => {
    const f = fixture(required(rows[0]));
    const list = vi.fn<MockCall>().mockResolvedValue([]);
    f.dependencies.procurement = { list } as unknown as NonNullable<ApiDependencies['procurement']>;
    f.permissions.set('supplier:read', { scopes: ['COMPANY'], fields: null });
    property(f.dependencies, 'mrp', () => {
      throw new Error('mrp touched');
    });
    expect((await f.dispatch({ pathname: '/api/v1/suppliers' })).statusCode).toBe(200);
    expect(list).toHaveBeenCalledOnce();
  });
  it('production follows skipped mrp and receives matching GET', async () => {
    const f = fixture(required(rows[0]));
    const list = vi.fn<MockCall>().mockResolvedValue([]);
    f.dependencies.production = { list } as unknown as NonNullable<ApiDependencies['production']>;
    f.permissions.set('production:read', { scopes: ['COMPANY'], fields: null });
    expect((await f.dispatch({ pathname: '/api/v1/production-orders' })).statusCode).toBe(200);
    expect(list).toHaveBeenCalledOnce();
    expect(f.call).not.toHaveBeenCalled();
  });
  for (const enabled of [false, true])
    it('unknown POST null reaches shared QTC body iff dependency ' + String(enabled), async () => {
      const f = fixture(required(rows[0]));
      if (enabled) f.dependencies.quoteToCash = {} as NonNullable<ApiDependencies['quoteToCash']>;
      error(
        await f.dispatch({ method: 'POST', pathname: '/unmatched', body: null }),
        enabled ? 400 : 404,
        enabled ? 'invalid_request' : 'not_found',
        enabled ? 'A JSON object body is required' : 'Route not found',
      );
    });
  for (const row of proposals) {
    it(row.label + ' short lowercase hex matches before UUID validation', async () => {
      const f = fixture(row);
      error(
        await f.dispatch({ pathname: row.path.replace(id, 'ab-1') }),
        400,
        'invalid_request',
        'proposalId must be a UUID',
      );
    });
    for (const alter of ['uppercase', 'nonhex', 'slash', 'suffix', 'action', 'newline', 'CR', 'LS'])
      it(row.label + ' raw rejects ' + alter, async () => {
        const f = fixture(row);
        const pathname =
          alter === 'uppercase'
            ? row.path.replace(id, id.toUpperCase())
            : alter === 'nonhex'
              ? row.path.replace(id, 'xyz')
              : alter === 'slash'
                ? row.path + '/'
                : alter === 'suffix'
                  ? row.path + '/x'
                  : alter === 'action'
                    ? row.path.replace(/[^/]+$/u, 'unknown')
                    : row.path + (alter === 'newline' ? '\n' : alter === 'CR' ? '\r' : '\u2028');
        error(await f.dispatch({ pathname }), 404, 'not_found', 'Route not found');
        expect(f.call).not.toHaveBeenCalled();
      });
    for (const method of ['GET', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'])
      it(row.label + ' raw unsupported ' + method, async () => {
        const f = fixture(row);
        error(await f.dispatch({ method, body: null }), 404, 'not_found', 'Route not found');
      });
    it(row.label + ' only exact action capability authorizes', async () => {
      const f = fixture(row, { denied: true });
      f.permissions.set(row.cap === 'mrp:release' ? 'mrp:approve' : 'mrp:release', {
        scopes: ['GROUP'],
        fields: null,
      });
      error(await f.dispatch(), 403, 'forbidden', 'Permission denied');
    });
  }
});

describe('late old list P and mutation M, opaque output shapes and shallow references', () => {
  for (const row of lists) {
    for (const fields of [null, [], ['name'], ['nested', 'version']] as const)
      it(row.label + ' Q0 ignores body and projects ' + JSON.stringify(fields), async () => {
        const f = fixture(row, { fields });
        const response = await f.dispatch({ body: null });
        expect(response.statusCode).toBe(200);
        const actual = (record(response.body).items as unknown[])[0];
        if (fields === null) expect(actual).toBe(f.returned);
        else
          expect(actual).toEqual(
            Object.fromEntries(
              Object.entries(f.returned).filter(
                ([key]) => key === 'id' || (fields as readonly string[]).includes(key),
              ),
            ),
          );
      });
    it(
      row.label + ' no second authorization after await; missing grant means fields null',
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
        expect((record((await pending).body).items as unknown[])[0]).toBe(f.returned);
      },
    );
    it(row.label + ' reads current fields per mapped row after await', async () => {
      const f = fixture(row);
      let reads = 0;
      f.call.mockImplementation(() => {
        property(required(f.permissions.get(row.cap)), 'fields', () =>
          ++reads === 1 ? ['name'] : ['version'],
        );
        return Promise.resolve(f.output);
      });
      expect((await f.dispatch()).body).toEqual({
        items: [
          { id, name: 'Visible' },
          { id: other, version: 7 },
        ],
      });
      expect(reads).toBe(2);
    });
    it(row.label + ' native map keeps sparse output holes', async () => {
      const f = fixture(row);
      const sparse = new Array<unknown>(3);
      sparse[2] = f.returned;
      f.call.mockResolvedValue(sparse);
      const items = record((await f.dispatch()).body).items as unknown[];
      expect(items).toHaveLength(3);
      expect(0 in items).toBe(false);
      expect(items[2]).toBe(f.returned);
    });
    for (const value of [null, {}, 1, 'opaque'])
      it(row.label + ' malformed list ' + JSON.stringify(value) + ' becomes 500', async () => {
        const f = fixture(row);
        f.call.mockResolvedValue(value);
        error(await f.dispatch(), 500, 'internal_error', 'Internal server error');
      });
    it(row.label + ' late filtered null row fails, raw null fields preserves it', async () => {
      const f = fixture(row);
      f.call.mockResolvedValue([null]);
      expect((await f.dispatch()).body).toEqual({ items: [null] });
      f.permissions.set(row.cap, { scopes: ['COMPANY'], fields: [] });
      error(await f.dispatch(), 500, 'internal_error', 'Internal server error');
    });
  }
  for (const row of writes) {
    for (const fields of [null, [], ['name'], ['version', 'nested']] as const)
      it(row.label + ' independent read fields ' + JSON.stringify(fields), async () => {
        const f = fixture(row);
        f.permissions.set(row.read, { scopes: [], fields });
        const response = await f.dispatch();
        expect(response.statusCode).toBe(201);
        if (fields === null) expect(response.body).toBe(f.returned);
        else
          expect(response.body).toEqual(
            Object.fromEntries(
              Object.entries(f.returned).filter(
                ([key]) => key === 'id' || (fields as readonly string[]).includes(key),
              ),
            ),
          );
      });
    it(row.label + ' missing read only id/version, no read Q', async () => {
      const f = fixture(row, { noRead: true });
      expect((await f.dispatch()).body).toEqual({ id, version: 7 });
    });
    it(row.label + ' awaits before read Map and fields', async () => {
      const f = fixture(row);
      const wait = deferred<unknown>();
      f.call.mockReturnValue(wait.promise);
      const pending = f.dispatch();
      await vi.waitFor(() => {
        expect(f.call).toHaveBeenCalledOnce();
      });
      f.permissions.set(row.read, { scopes: [], fields: ['nested'] });
      wait.resolve(f.returned);
      const body = record((await pending).body);
      expect(body).toEqual({ id, nested: f.returned.nested });
      expect(body.nested).toBe(f.returned.nested);
    });
    it(row.label + ' removed read grant after await keeps id/version', async () => {
      const f = fixture(row);
      f.call.mockImplementation(() => {
        f.permissions.delete(row.read);
        return Promise.resolve(f.returned);
      });
      expect((await f.dispatch()).body).toEqual({ id, version: 7 });
    });
    for (const value of [null, undefined, 9, 'opaque', [], { raw: true }])
      it(row.label + ' fields null preserves raw ' + JSON.stringify(value), async () => {
        const f = fixture(row);
        f.call.mockResolvedValue(value);
        expect((await f.dispatch()).body).toBe(value);
      });
    it(row.label + ' filtered null becomes 500 only after mutation succeeds', async () => {
      const f = fixture(row, { noRead: true });
      f.call.mockResolvedValue(null);
      error(await f.dispatch(), 500, 'internal_error', 'Internal server error');
      expect(f.call).toHaveBeenCalledOnce();
    });
    it(
      row.label + ' filtered own keys include dangerous labels without prototype mutation',
      async () => {
        const f = fixture(row);
        const nested = { keep: true };
        const output = Object.create({ inherited: 'hidden' }) as Record<string, unknown>;
        Object.defineProperty(output, '__proto__', { enumerable: true, value: nested });
        Object.assign(output, { id, version: 2, name: 'own', [Symbol('hidden')]: 'symbol' });
        f.permissions.set(row.read, { scopes: [], fields: ['__proto__', 'inherited', 'name'] });
        f.call.mockResolvedValue(output);
        const body = record((await f.dispatch()).body);
        expect(Object.keys(body)).toEqual(['__proto__', 'id', 'name']);
        expect(Object.getPrototypeOf(body)).toBe(Object.prototype);
        expect(Object.getOwnPropertyDescriptor(body, '__proto__')?.value).toBe(nested);
      },
    );
  }
});

describe('body, allowlist and authorization first error before payload parsing', () => {
  for (const row of writes) {
    for (const body of [undefined, null, [], false, 0, 'body'])
      it(row.label + ' O rejects ' + JSON.stringify(body) + ' before denied Q', async () => {
        const f = fixture(row, { denied: true });
        error(await f.dispatch({ body }), 400, 'invalid_request', 'A JSON object body is required');
        expect(f.call).not.toHaveBeenCalled();
      });
    it(row.label + ' unsupported own keys sorted before denied Q', async () => {
      const f = fixture(row, { denied: true });
      error(
        await f.dispatch({ body: { ...f.body, zzz: 1, aaa: 2 } }),
        400,
        'invalid_request',
        'Unsupported fields: aaa, zzz',
      );
    });
    it(row.label + ' allowed undefined own field is requested by Q', async () => {
      const f = fixture(row, { fields: [] });
      f.body[required(Object.keys(f.body)[0])] = undefined;
      error(await f.dispatch(), 403, 'forbidden', 'Field permission denied');
    });
    it(
      row.label + ' inherited and symbol unknown fields ignored, body fields inherited',
      async () => {
        const f = fixture(row);
        const body = Object.create({ ...f.body, unexpected: true }) as Record<string, unknown>;
        Object.defineProperty(body, Symbol('ignored'), { enumerable: true, value: true });
        expect((await f.dispatch({ body })).statusCode).toBe(201);
        expect(f.call).toHaveBeenCalledOnce();
      },
    );
    it(row.label + ' authorization denied precedes required field error', async () => {
      const f = fixture(row, { denied: true });
      error(await f.dispatch({ body: {} }), 403, 'forbidden', 'Permission denied');
    });
    it(row.label + ' own keys Q precedes any body value getter', async () => {
      const f = fixture(row, { denied: true });
      const field = required(Object.keys(f.body)[0]);
      property(f.body, field, () => {
        throw new Error('value');
      });
      error(await f.dispatch(), 403, 'forbidden', 'Permission denied');
    });
    it(row.label + ' property getter error inside catch becomes 500', async () => {
      const f = fixture(row);
      property(f.body, required(Object.keys(f.body)[0]), () => {
        throw new Error('input');
      });
      error(await f.dispatch(), 500, 'internal_error', 'Internal server error');
      expect(f.call).not.toHaveBeenCalled();
    });
  }
});

describe('original parser acceptance, first errors, method capture and defaults', () => {
  for (const row of writes) {
    for (const field of fieldsFor(row)) {
      for (const [index, [value, message]] of invalidCases(field).entries())
        it(
          row.label +
            ' invalid ' +
            field.name +
            ' case ' +
            String(index) +
            ' preserves exact message',
          async () => {
            const f = fixture(row);
            f.body[field.name] = value;
            error(await f.dispatch(), 400, 'invalid_request', message);
            expect(f.call).not.toHaveBeenCalled();
          },
        );
      it(
        row.label + ' bad ' + field.name + ' wins actor getter and missing method invocation',
        async () => {
          const f = fixture(row);
          const [value, message] = required(invalidCases(field)[0]);
          f.body[field.name] = value;
          property(f.repository, row.method, () => undefined);
          property(f.context, 'actor', () => {
            throw new Error('actor');
          });
          error(await f.dispatch(), 400, 'invalid_request', message);
        },
      );
    }
    const fields = fieldsFor(row);
    for (let index = 0; index < fields.length - 1; index++) {
      const first = required(fields[index]),
        next = required(fields[index + 1]);
      it(row.label + ' ' + first.name + ' error precedes ' + next.name, async () => {
        const f = fixture(row);
        const [value, message] = required(invalidCases(first)[0]);
        f.body[first.name] = value;
        property(f.body, next.name, () => {
          throw new Error('later ' + next.name);
        });
        error(await f.dispatch(), 400, 'invalid_request', message);
      });
    }
    it(row.label + ' valid property read order relative to method and actor', async () => {
      const f = fixture(row);
      const events: string[] = [];
      let roots = 0;
      const captured = f.call;
      for (const field of fields) {
        const value = f.body[field.name];
        property(f.body, field.name, () => {
          events.push(field.name);
          return value;
        });
      }
      property(f.dependencies, 'mrp', () => {
        events.push('root' + String(++roots));
        return f.repository;
      });
      property(f.repository, row.method, () => {
        events.push('method');
        return captured;
      });
      property(f.context, 'actor', () => {
        events.push('actor');
        return actor;
      });
      await f.dispatch();
      const names = fields.map((field) => field.name);
      expect(events).toEqual(
        row.kind === 'policy'
          ? ['root1', 'makeOrBuy', 'root2', 'method', ...names.slice(1), 'actor']
          : ['root1', 'root2', 'method', ...names, 'actor'],
      );
    });
    it(
      row.label + ' non-preparsed input getter cannot replace captured method or receiver',
      async () => {
        const f = fixture(row),
          replacement = fixture(row);
        const field = required(fields.find((field) => field.name !== 'makeOrBuy'));
        const value = f.body[field.name];
        property(f.body, field.name, () => {
          f.dependencies.mrp = replacement.repository as unknown as Repository;
          return value;
        });
        await f.dispatch();
        expect(f.call.mock.contexts).toEqual([f.repository]);
        expect(replacement.call).not.toHaveBeenCalled();
      },
    );
    it(
      row.label + ' method getter wins malformed top input except cached policy enum',
      async () => {
        const f = fixture(row);
        const field = required(fields.find((field) => field.name !== 'makeOrBuy'));
        f.body[field.name] = required(invalidCases(field)[0])[0];
        property(f.repository, row.method, () => {
          throw new Error('method before input');
        });
        error(await f.dispatch(), 500, 'internal_error', 'Internal server error');
      },
    );
  }
  const policy = required(rows.find((row) => row.kind === 'policy'));
  it('policy makeOrBuy parsed exactly once before late root/method', async () => {
    const f = fixture(policy),
      replacement = fixture(policy);
    let reads = 0;
    property(f.body, 'makeOrBuy', () => {
      reads++;
      f.dependencies.mrp = replacement.repository as unknown as Repository;
      return reads === 1 ? ' MAKE ' : 'bad';
    });
    await f.dispatch();
    expect(reads).toBe(1);
    expect(f.call).not.toHaveBeenCalled();
    expect(record(replacement.call.mock.calls[0]?.[0]).makeOrBuy).toBe('MAKE');
  });
  it('invalid policy enum precedes late method getter', async () => {
    const f = fixture(policy);
    f.body.makeOrBuy = 'other';
    property(f.repository, 'createPolicy', () => {
      throw new Error('method');
    });
    error(await f.dispatch(), 400, 'invalid_request', 'makeOrBuy is unsupported');
  });
  for (const name of ['leadTimeDays', 'freezeWindowDays']) {
    for (const value of [0, 3650])
      it('policy ' + name + ' bound ' + String(value), async () => {
        const f = fixture(policy);
        f.body[name] = value;
        expect((await f.dispatch()).statusCode).toBe(201);
        expect(record(f.call.mock.calls[0]?.[0])[name]).toBe(value);
      });
    for (const value of [undefined, null, false, 3651, Number.NaN, Number.POSITIVE_INFINITY])
      it('policy ' + name + ' invalid ' + String(value), async () => {
        const f = fixture(policy);
        f.body[name] = value;
        error(
          await f.dispatch(),
          400,
          'invalid_request',
          name + ' must be an integer between 0 and 3650',
        );
      });
  }
  for (const row of writes.filter((row) => ['policy', 'demand'].includes(row.kind)))
    for (const field of fieldsFor(row).filter((field) => field.parser === 'decimal'))
      for (const [value, normalized] of [
        ['0', '0'],
        ['-0.000000', '0'],
        ['999999999999999999.999999', '999999999999999999.999999'],
        [' 1.230000 ', '1.23'],
      ] as const)
        it(row.label + ' ' + field.name + ' old decimal ' + value, async () => {
          const f = fixture(row);
          f.body[field.name] = value;
          expect((await f.dispatch()).statusCode).toBe(201);
          expect(record(f.call.mock.calls[0]?.[0])[field.name]).toBe(normalized);
        });
  const demand = required(rows.find((row) => row.kind === 'demand'));
  for (const value of [undefined, null, 1, 100000])
    it('demand priority nullish/bounds ' + String(value), async () => {
      const f = fixture(demand);
      f.body.priority = value;
      expect((await f.dispatch()).statusCode).toBe(201);
      expect(record(f.call.mock.calls[0]?.[0]).priority).toBe(value ?? 100);
    });
  it('demand missing priority defaults100', async () => {
    const f = fixture(demand);
    delete f.body.priority;
    await f.dispatch();
    expect(record(f.call.mock.calls[0]?.[0]).priority).toBe(100);
  });
  for (const value of [0, 100001, false, '', Number.NaN, Number.POSITIVE_INFINITY])
    it('demand priority non-nullish invalid ' + String(value), async () => {
      const f = fixture(demand);
      f.body.priority = value;
      error(
        await f.dispatch(),
        400,
        'invalid_request',
        'priority must be an integer between 1 and 100000',
      );
    });
  it('inherited priority getter is read and not treated as missing', async () => {
    const f = fixture(demand);
    delete f.body.priority;
    let reads = 0;
    const prototype = {};
    property(prototype, 'priority', () => {
      reads++;
      return 23;
    });
    Object.setPrototypeOf(f.body, prototype);
    await f.dispatch();
    expect(record(f.call.mock.calls[0]?.[0]).priority).toBe(23);
    expect(reads).toBe(1);
  });
  for (const row of writes.filter((row) => row.kind === 'demand' || row.kind === 'run')) {
    const field = required(fieldsFor(row).find((field) => field.parser === 'code'));
    for (const value of ['A', 'A'.repeat(64), ' CODE_1-X '])
      it(row.label + ' stable code accepts ' + String(value.length) + ' chars', async () => {
        const f = fixture(row);
        f.body[field.name] = value;
        expect((await f.dispatch()).statusCode).toBe(201);
        expect(record(f.call.mock.calls[0]?.[0])[field.name]).toBe(value.trim());
      });
  }
  for (const row of writes.filter((row) => row.kind === 'policy' || row.kind === 'run')) {
    const field = required(fieldsFor(row).find((field) => field.parser === 'timestamp'));
    for (const [value, normalized] of [
      ['2026-08-01', iso],
      ['2026-02-30', '2026-03-02T00:00:00.000Z'],
      [' 2026-08-01T08:00:00+08:00 ', iso],
    ] as const)
      it(row.label + ' timestamp native Date acceptance ' + value, async () => {
        const f = fixture(row);
        f.body[field.name] = value;
        expect((await f.dispatch()).statusCode).toBe(201);
        expect(record(f.call.mock.calls[0]?.[0])[field.name]).toBe(normalized);
      });
  }
  for (const row of writes.filter((row) => row.kind === 'demand' || row.kind === 'run')) {
    const field = required(fieldsFor(row).find((field) => field.parser === 'calendar'));
    for (const value of ['2026-02-30', '2026-04-31', ' 2026-08-01 ', '0000-01-01'])
      it(row.label + ' calendar keeps old string ' + value, async () => {
        const f = fixture(row);
        f.body[field.name] = value;
        expect((await f.dispatch()).statusCode).toBe(201);
        expect(record(f.call.mock.calls[0]?.[0])[field.name]).toBe(value.trim());
      });
  }
  it('run has no HTTP horizon-after-asOf/max-window or idempotency check', async () => {
    const row = required(rows.find((row) => row.kind === 'run')),
      f = fixture(row);
    f.body.horizonEnd = '0000-01-01';
    expect((await f.dispatch()).statusCode).toBe(201);
    expect(record(f.call.mock.calls[0]?.[0]).horizonEnd).toBe('0000-01-01');
  });
  for (const row of proposals) {
    it(row.label + ' short raw id body error beats permission/UUID', async () => {
      const f = fixture(row, { denied: true });
      error(
        await f.dispatch({ pathname: row.path.replace(id, 'a'), body: null }),
        400,
        'invalid_request',
        'A JSON object body is required',
      );
    });
    it(row.label + ' short raw id denied Q before UUID', async () => {
      const f = fixture(row, { denied: true });
      error(
        await f.dispatch({ pathname: row.path.replace(id, 'a') }),
        403,
        'forbidden',
        'Permission denied',
      );
    });
    it(row.label + ' UUID before reason/evidence/actor and missing method invoke', async () => {
      const f = fixture(row);
      f.body.reason = null;
      f.body.evidence = [];
      property(f.repository, row.method, () => undefined);
      property(f.context, 'actor', () => {
        throw new Error('actor');
      });
      error(
        await f.dispatch({ pathname: row.path.replace(id, 'a') }),
        400,
        'invalid_request',
        'proposalId must be a UUID',
      );
    });
    it(row.label + ' method getter before UUID', async () => {
      const f = fixture(row);
      property(f.repository, row.method, () => {
        throw new Error('method');
      });
      error(
        await f.dispatch({ pathname: row.path.replace(id, 'a') }),
        500,
        'internal_error',
        'Internal server error',
      );
    });
    for (const value of [undefined, null])
      it(row.label + ' evidence nullish creates fresh default ' + String(value), async () => {
        const f = fixture(row);
        f.body.evidence = value;
        await f.dispatch();
        await f.dispatch();
        const first = record(f.call.mock.calls[0]?.[2]).evidence,
          second = record(f.call.mock.calls[1]?.[2]).evidence;
        expect(first).toEqual({});
        expect(second).toEqual({});
        expect(first).not.toBe(second);
      });
    for (const value of [{}, Object.create(null) as object, new Date(0)])
      it(
        row.label + ' evidence shallow object ' + Object.prototype.toString.call(value),
        async () => {
          const f = fixture(row);
          f.body.evidence = value;
          expect((await f.dispatch()).statusCode).toBe(201);
          expect(record(f.call.mock.calls[0]?.[2]).evidence).toBe(value);
        },
      );
    it(row.label + ' nested evidence is opaque and reason only trimmed', async () => {
      const f = fixture(row);
      const nested = new Proxy(
        {},
        {
          get() {
            throw new Error('nested touched');
          },
        },
      );
      const evidence = { nested };
      f.body.evidence = evidence;
      f.body.reason = '  <raw reason>  ';
      await f.dispatch();
      expect(record(f.call.mock.calls[0]?.[2])).toEqual({ reason: '<raw reason>', evidence });
      expect(record(f.call.mock.calls[0]?.[2]).evidence).toBe(evidence);
    });
  }
});

describe('late Map method lookup, raw list rows and helper identity boundaries', () => {
  for (const row of rows) {
    it(
      row.label + ' looks up current Map.get with Map receiver only after repository await',
      async () => {
        const f = fixture(row),
          wait = deferred<unknown>();
        f.call.mockReturnValue(wait.promise);
        const pending = f.dispatch();
        await vi.waitFor(() => {
          expect(f.call).toHaveBeenCalledOnce();
        });
        const get = vi.fn(function (this: typeof f.permissions, cap: PermissionKey) {
          expect(this).toBe(f.permissions);
          expect(cap).toBe(row.read);
          return { scopes: [], fields: ['nested'] };
        });
        property(f.permissions, 'get', () => get);
        wait.resolve(row.kind === 'list' ? f.output : f.returned);
        const response = await pending;
        expect(response.statusCode).toBe(row.kind === 'list' ? 200 : 201);
        expect(get).toHaveBeenCalledTimes(row.kind === 'list' ? 2 : 1);
        const body =
          row.kind === 'list'
            ? record((record(response.body).items as unknown[])[0])
            : record(response.body);
        expect(body.nested).toBe(f.returned.nested);
        expect(Object.keys(body)).toEqual(['id', 'nested']);
      },
    );
    it(row.label + ' late fields getter failure is caught after repository success', async () => {
      const f = fixture(row);
      f.call.mockImplementation(() => {
        f.permissions.set(row.read, { scopes: [], fields: null });
        property(required(f.permissions.get(row.read)), 'fields', () => {
          throw new Error('fields');
        });
        return Promise.resolve(row.kind === 'list' ? f.output : f.returned);
      });
      error(await f.dispatch(), 500, 'internal_error', 'Internal server error');
      expect(f.call).toHaveBeenCalledOnce();
    });
  }
  for (const row of writes.filter((row) => row.kind === 'policy' || row.kind === 'demand'))
    for (const field of fieldsFor(row).filter((field) => field.parser === 'uuid'))
      it(row.label + ' ' + field.name + ' UUID helper trims but preserves uppercase', async () => {
        const f = fixture(row);
        const value = ' ' + other.toUpperCase() + ' ';
        f.body[field.name] = value;
        expect((await f.dispatch()).statusCode).toBe(201);
        expect(record(f.call.mock.calls[0]?.[0])[field.name]).toBe(value.trim());
      });
  for (const row of lists) {
    it(
      row.label + ' null fields preserve malformed primitive/array/object refs as opaque rows',
      async () => {
        const f = fixture(row);
        const array: unknown[] = [];
        const object = { raw: true };
        const values = [undefined, 1, 'raw', array, object];
        f.call.mockResolvedValue(values);
        const output = record((await f.dispatch()).body).items as unknown[];
        expect(output).toEqual(values);
        expect(output[3]).toBe(array);
        expect(output[4]).toBe(object);
      },
    );
    it(
      row.label + ' native map includes local inherited array index without prototype mutation',
      async () => {
        const f = fixture(row);
        const output = new Array<unknown>(2);
        const prototype = Object.create(Array.prototype) as object;
        Object.defineProperty(prototype, '0', { value: f.returned });
        Object.setPrototypeOf(output, prototype);
        f.call.mockResolvedValue(output);
        const items = record((await f.dispatch()).body).items as unknown[];
        expect(items[0]).toBe(f.returned);
        expect(Object.hasOwn(items, 0)).toBe(true);
        expect(1 in items).toBe(false);
      },
    );
    it(
      row.label + ' filter uses own enumerable entries, special keys and shallow nested values',
      async () => {
        const f = fixture(row);
        const output = Object.create({ inherited: 'hidden' }) as Record<string, unknown>;
        Object.assign(output, { id, nested: f.returned.nested });
        Object.defineProperty(output, '__proto__', { enumerable: true, value: 'own-label' });
        Object.defineProperty(output, 'hidden', { value: 'non-enumerable' });
        f.permissions.set(row.cap, {
          scopes: ['COMPANY'],
          fields: ['nested', '__proto__', 'inherited', 'hidden'],
        });
        f.call.mockResolvedValue([output]);
        const result = record((record((await f.dispatch()).body).items as unknown[])[0]);
        expect(Object.keys(result)).toEqual(['id', 'nested', '__proto__']);
        expect(result.nested).toBe(f.returned.nested);
        expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
      },
    );
  }
});
