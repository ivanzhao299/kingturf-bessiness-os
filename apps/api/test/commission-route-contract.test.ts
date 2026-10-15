// Frozen against f230b22 inline commission HTTP; no future route module imported.
import { describe, expect, it, vi } from 'vitest';
import { DomainError, type AuthorizationContext } from '@kingturf/domain';
import type { DataScope, JsonObject, PermissionKey } from '@kingturf/types';
import { buildApp, type ApiDependencies, type ApiRequest, type ApiResponse } from '../src/app.js';

type Repository = NonNullable<ApiDependencies['commissions']>;
type MutableDependencies = { -readonly [Key in keyof ApiDependencies]: ApiDependencies[Key] };
type Method =
  | 'listPolicies'
  | 'listCases'
  | 'createPolicy'
  | 'createPolicyVersion'
  | 'publishPolicyVersion'
  | 'accrue'
  | 'transition';
type Grant = NonNullable<ReturnType<AuthorizationContext['permissions']['get']>>;
type MockCall = (...args: unknown[]) => Promise<unknown>;
type Kind = 'read' | 'create' | 'version' | 'publish' | 'accrue' | 'command';
type Row = Readonly<{
  label: string;
  method: Method;
  kind: Kind;
  path: string;
  http: string;
  cap: PermissionKey;
  read: PermissionKey;
  status: number;
  state?: string;
}>;
const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const other = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const correlationId = '33333333-3333-4333-8333-333333333333';
const actor = { employeeId: id, companyId: 'commission-direct-http-mock' };
const nested = { keep: true };
const rule = { when: nested, rate: 200 };
const returned: JsonObject = { id, version: 7, code: 'visible', nested, extra: 'opaque-output' };
const commands = [
  ['freeze', 'FROZEN', 'commission:manage'],
  ['release', 'RELEASED', 'commission:manage'],
  ['pay', 'PAID', 'commission:pay'],
  ['clawback', 'CLAWED_BACK', 'commission:manage'],
  ['cancel', 'CANCELLED', 'commission:manage'],
] as const;
const rows: readonly Row[] = [
  {
    label: 'policy list',
    method: 'listPolicies',
    kind: 'read',
    path: '/api/v1/commission-policies',
    http: 'GET',
    cap: 'commission-policy:read',
    read: 'commission-policy:read',
    status: 200,
  },
  {
    label: 'case list',
    method: 'listCases',
    kind: 'read',
    path: '/api/v1/commissions',
    http: 'GET',
    cap: 'commission:read',
    read: 'commission:read',
    status: 200,
  },
  {
    label: 'policy create',
    method: 'createPolicy',
    kind: 'create',
    path: '/api/v1/commission-policies',
    http: 'POST',
    cap: 'commission-policy:manage',
    read: 'commission-policy:read',
    status: 201,
  },
  {
    label: 'policy version',
    method: 'createPolicyVersion',
    kind: 'version',
    path: `/api/v1/commission-policies/${id}/versions`,
    http: 'POST',
    cap: 'commission-policy:manage',
    read: 'commission-policy:read',
    status: 201,
  },
  {
    label: 'policy publish',
    method: 'publishPolicyVersion',
    kind: 'publish',
    path: `/api/v1/commission-policy-versions/${id}/publish`,
    http: 'POST',
    cap: 'commission-policy:manage',
    read: 'commission-policy:read',
    status: 200,
  },
  {
    label: 'accrue',
    method: 'accrue',
    kind: 'accrue',
    path: '/api/v1/commissions/accrue',
    http: 'POST',
    cap: 'commission:accrue',
    read: 'commission:read',
    status: 201,
  },
  ...commands.map(
    ([action, state, cap]): Row => ({
      label: action,
      method: 'transition',
      kind: 'command',
      path: `/api/v1/commissions/${id}/${action}`,
      http: 'POST',
      cap,
      read: 'commission:read',
      status: 201,
      state,
    }),
  ),
];
const policyKeys = [
  'baseRateBasisPoints',
  'minimumMarginBasisPoints',
  'releaseCollectionBasisPoints',
  'effectiveAt',
  'rules',
] as const;
const keys = (row: Row): readonly string[] =>
  row.kind === 'create'
    ? ['code', 'name', 'applicability', ...policyKeys, 'publish']
    : row.kind === 'version'
      ? policyKeys
      : row.kind === 'accrue'
        ? ['salesOrderId', 'beneficiaryEmployeeId', 'policyVersionId', 'accountingPeriod']
        : row.kind === 'command'
          ? ['reason', 'externalReference']
          : [];
function bodyFor(row: Row): Record<string, unknown> {
  const policy = {
    baseRateBasisPoints: 200,
    minimumMarginBasisPoints: -50,
    releaseCollectionBasisPoints: 6000,
    effectiveAt: '2026-08-01T08:00:00+08:00',
    rules: [rule],
  };
  if (row.kind === 'create')
    return {
      code: ' free-code # ',
      name: ' Policy ',
      applicability: nested,
      ...policy,
      publish: true,
    };
  if (row.kind === 'version') return policy;
  if (row.kind === 'accrue')
    return {
      salesOrderId: id,
      beneficiaryEmployeeId: other,
      policyVersionId: id,
      accountingPeriod: ' 2026-08 ',
    };
  if (row.kind === 'command') return { reason: ' Reason ', externalReference: ' external # ' };
  return {};
}
function expectedInput(row: Row) {
  const policy = {
    baseRateBasisPoints: 200,
    minimumMarginBasisPoints: -50,
    releaseCollectionBasisPoints: 6000,
    effectiveAt: '2026-08-01T00:00:00.000Z',
    rules: [rule],
  };
  if (row.kind === 'create')
    return { code: 'free-code #', name: 'Policy', applicability: nested, ...policy, publish: true };
  if (row.kind === 'version') return policy;
  if (row.kind === 'accrue')
    return {
      salesOrderId: id,
      beneficiaryEmployeeId: other,
      policyVersionId: id,
      accountingPeriod: '2026-08',
    };
  return { state: row.state, reason: 'Reason', externalReference: 'external #' };
}
function fixture(
  row: Row,
  options: {
    missing?: boolean;
    denied?: boolean;
    scopes?: readonly DataScope[];
    fields?: Grant['fields'];
    read?: Grant | null;
    noAnchors?: boolean;
  } = {},
) {
  const scopes = options.scopes ?? ['TEAM'];
  const anchors = [{ scope: 'TEAM', organizationId: other }] as const;
  const permissions = new Map<PermissionKey, Grant>([
    [row.cap, { scopes, fields: options.fields === undefined ? null : options.fields }],
  ]);
  if (row.kind !== 'read' && options.read !== null)
    permissions.set(row.read, options.read ?? { scopes: ['TEAM'], fields: null });
  if (options.denied) permissions.delete(row.cap);
  const context: AuthorizationContext = {
    actor,
    permissions,
    ...(options.noAnchors ? {} : { scopeAnchors: new Map([[row.cap, anchors]]) }),
  };
  const get = vi.spyOn(permissions, 'get');
  const methods = {
    listPolicies: vi.fn<MockCall>().mockResolvedValue([returned, returned]),
    listCases: vi.fn<MockCall>().mockResolvedValue([returned, returned]),
    createPolicy: vi.fn<MockCall>().mockResolvedValue(returned),
    createPolicyVersion: vi.fn<MockCall>().mockResolvedValue(returned),
    publishPolicyVersion: vi.fn<MockCall>().mockResolvedValue(returned),
    accrue: vi.fn<MockCall>().mockResolvedValue(returned),
    transition: vi.fn<MockCall>().mockResolvedValue(returned),
  };
  const repository = { ...methods };
  const authenticate = vi.fn<ApiDependencies['auth']['authenticate']>().mockResolvedValue(context);
  const dependencies: MutableDependencies = {
    auth: { authenticate } as unknown as ApiDependencies['auth'],
    organizations: {} as ApiDependencies['organizations'],
    employees: {} as ApiDependencies['employees'],
    ...(options.missing ? {} : { commissions: repository as unknown as Repository }),
  };
  const body = bodyFor(row);
  const headers: Record<string, string | undefined> = {
    authorization: 'Bearer mock-only-session',
    'x-correlation-id': correlationId,
    'idempotency-key': ' raw # key ',
  };
  const app = buildApp(dependencies);
  const dispatch = (overrides: Partial<ApiRequest> = {}) =>
    app.dispatch({ method: row.http, pathname: row.path, body, headers, ...overrides });
  return {
    row,
    scopes,
    anchors,
    context,
    permissions,
    get,
    methods,
    repository,
    dependencies,
    authenticate,
    body,
    headers,
    app,
    dispatch,
  };
}
type Fixture = ReturnType<typeof fixture>;
const onlyCall = (f: Fixture): readonly unknown[] => {
  expect(f.methods[f.row.method]).toHaveBeenCalledTimes(1);
  const args = f.methods[f.row.method].mock.calls[0];
  expect(args).toBeDefined();
  return args ?? [];
};
function expectError(response: ApiResponse, status: number, message?: string) {
  const codes: Readonly<Record<number, string>> = {
    400: 'invalid_request',
    401: 'authentication_required',
    403: 'forbidden',
    404: 'not_found',
    409: 'conflict',
    500: 'internal_error',
    503: 'internal_error',
  };
  expect(response.statusCode).toBe(status);
  expect(response.headers?.['x-correlation-id']).toBe(correlationId);
  expect(response.body).toMatchObject({
    error: { code: codes[status], correlationId, ...(message ? { message } : {}) },
  });
}
const named = (method: Method) => {
  const row = rows.find((candidate) => candidate.method === method);
  if (!row) throw Error('missing static commission row');
  return row;
};

describe.each(rows)('f230b22 commission $label', (row) => {
  it('original method/receiver/arg positions/fresh scope/raw result or mapped list', async () => {
    const f = fixture(row);
    const response = await f.dispatch();
    expect(response.statusCode).toBe(row.status);
    const args = onlyCall(f);
    const scope = { actor, scopes: f.scopes, anchors: f.anchors };
    if (row.kind === 'read') {
      expect(args).toEqual([scope]);
      expect(response.body).toEqual({ items: [returned, returned] });
      expect((response.body as { items: unknown[] }).items[0]).toBe(returned);
      const rawItems: unknown = await f.methods[row.method].mock.results[0]?.value;
      expect((response.body as { items: unknown[] }).items).not.toBe(rawItems);
    } else {
      const input = expectedInput(row);
      const expected =
        row.kind === 'create'
          ? [input, scope, correlationId]
          : row.kind === 'version'
            ? [id, input, scope, correlationId]
            : row.kind === 'publish'
              ? [id, scope, correlationId]
              : row.kind === 'accrue'
                ? [input, ' raw # key ', scope, correlationId]
                : [id, input, ' raw # key ', scope, correlationId];
      expect(args).toEqual(expected);
      expect(response.body).toBe(returned);
    }
    const scopeIndex = row.kind === 'read' ? 0 : args.length - 2;
    const passedScope = args[scopeIndex] as typeof scope;
    expect(passedScope).not.toBe(f.context);
    expect(Object.keys(passedScope)).toEqual(['actor', 'scopes', 'anchors']);
    expect(passedScope.actor).toBe(actor);
    expect(passedScope.scopes).toBe(f.scopes);
    expect(passedScope.anchors).toBe(f.anchors);
    expect(f.methods[row.method].mock.contexts[0]).toBe(f.repository);
    for (const [name, mock] of Object.entries(f.methods))
      if (name !== row.method) expect(mock).not.toHaveBeenCalled();
  });
  it('missing capability403 before valid input', async () => {
    const f = fixture(row, { denied: true });
    expectError(await f.dispatch(), 403, 'Permission denied');
    expect(f.methods[row.method]).not.toHaveBeenCalled();
  });
  it('empty scopes403', async () => {
    const f = fixture(row, { scopes: [] });
    expectError(await f.dispatch(), 403, 'Permission denied');
  });
  it('global401 precedes body and root', async () => {
    const f = fixture(row);
    expectError(
      await f.dispatch({ headers: { 'x-correlation-id': correlationId }, body: null }),
      401,
    );
    expect(f.authenticate).not.toHaveBeenCalled();
    expect(f.methods[row.method]).not.toHaveBeenCalled();
  });
  it('missing repo404 skips all commission validation', async () => {
    const f = fixture(row, { missing: true });
    expectError(await f.dispatch({ body: null }), 404);
    expect(f.methods[row.method]).not.toHaveBeenCalled();
  });
  it('old guard plus one late root read, not a pre-cached root', async () => {
    const f = fixture(row);
    let reads = 0;
    Object.defineProperty(f.dependencies, 'commissions', {
      get() {
        reads++;
        return f.repository;
      },
    });
    await f.dispatch();
    expect(reads).toBe(2);
  });
  it('second root disappearance remains500', async () => {
    const f = fixture(row);
    let reads = 0;
    Object.defineProperty(f.dependencies, 'commissions', {
      get() {
        reads++;
        return reads === 1 ? f.repository : undefined;
      },
    });
    expectError(await f.dispatch(), 500);
    expect(reads).toBe(2);
    expect(f.methods[row.method]).not.toHaveBeenCalled();
  });
  it.each([1, 2])('root getter error on read %s retains500-C', async (throwAt) => {
    const f = fixture(row);
    let reads = 0;
    Object.defineProperty(f.dependencies, 'commissions', {
      get() {
        reads++;
        if (reads === throwAt) throw Error('root-accessor-only');
        return f.repository;
      },
    });
    expectError(await f.dispatch(), 500);
    expect(reads).toBe(throwAt);
    expect(f.methods[row.method]).not.toHaveBeenCalled();
  });
  it('authorization changes root after guard: second root/method and receiver win', async () => {
    const f = fixture(row);
    const replacement = vi
      .fn<MockCall>()
      .mockResolvedValue(row.kind === 'read' ? [returned] : returned);
    const second = { ...f.repository, [row.method]: replacement };
    f.get.mockImplementation((cap) => {
      if (cap === row.cap) f.dependencies.commissions = second as unknown as Repository;
      return Map.prototype.get.call(f.permissions, cap) as Grant | undefined;
    });
    expect((await f.dispatch()).statusCode).toBe(row.status);
    expect(f.methods[row.method]).not.toHaveBeenCalled();
    expect(replacement).toHaveBeenCalledTimes(1);
    expect(replacement.mock.contexts[0]).toBe(second);
  });
  it('actor getter changes method only after capture: captured receiver/method retained', async () => {
    const f = fixture(row);
    const replacement = vi.fn<MockCall>();
    Object.defineProperty(f.context, 'actor', {
      get() {
        f.repository[row.method] = replacement;
        return actor;
      },
    });
    expect((await f.dispatch()).statusCode).toBe(row.status);
    expect(f.methods[row.method]).toHaveBeenCalledTimes(1);
    expect(replacement).not.toHaveBeenCalled();
    expect(f.methods[row.method].mock.contexts[0]).toBe(f.repository);
  });
  it('method getter replaces whole root but retains the old receiver', async () => {
    const f = fixture(row);
    const second = { ...f.repository };
    Object.defineProperty(f.repository, row.method, {
      get() {
        f.dependencies.commissions = second as unknown as Repository;
        return f.methods[row.method];
      },
    });
    expect((await f.dispatch()).statusCode).toBe(row.status);
    expect(f.methods[row.method].mock.contexts[0]).toBe(f.repository);
  });
  it.each([
    ['forbidden', 403],
    ['invalid_request', 400],
    ['conflict', 409],
    ['not_found', 404],
  ] as const)('DomainError %s preserves status/C', async (code, status) => {
    const f = fixture(row);
    f.methods[row.method].mockRejectedValue(new DomainError(code, 'fixture-domain'));
    expectError(await f.dispatch(), status, 'fixture-domain');
  });
  it('ordinary error500-C', async () => {
    const f = fixture(row);
    f.methods[row.method].mockRejectedValue(Error('mock-repo-error'));
    expectError(await f.dispatch(), 500);
  });
  it('query internal values are not parsed', async () => {
    const f = fixture(row);
    const query = {};
    Object.defineProperty(query, 'limit', {
      get() {
        throw Error('not a commission query');
      },
    });
    expect((await f.dispatch({ query })).statusCode).toBe(row.status);
  });
  it('wrong method and trailing slash remain404', async () => {
    const f = fixture(row);
    expectError(await f.dispatch({ method: 'DELETE', body: null }), 404);
    expectError(await f.dispatch({ pathname: row.path + '/', body: null }), 404);
    expect(f.methods[row.method]).not.toHaveBeenCalled();
  });
  it('wide domain guard still reads root once for each unsupported request', async () => {
    const f = fixture(row);
    let reads = 0;
    Object.defineProperty(f.dependencies, 'commissions', {
      get() {
        reads++;
        return f.repository;
      },
    });
    expectError(await f.dispatch({ method: 'DELETE', body: null }), 404);
    expect(reads).toBe(1);
    expectError(await f.dispatch({ pathname: row.path + '/', body: null }), 404);
    expect(reads).toBe(2);
    expect(f.methods[row.method]).not.toHaveBeenCalled();
  });
  it('unsupported request with wide guard getter error remains500', async () => {
    const f = fixture(row);
    Object.defineProperty(f.dependencies, 'commissions', {
      get() {
        throw Error('unsupported-wide-guard');
      },
    });
    expectError(await f.dispatch({ method: 'DELETE', body: null }), 500);
  });
  it('missing scopeAnchors yields a fresh empty anchors array', async () => {
    const f = fixture(row, { noAnchors: true });
    await f.dispatch();
    const args = onlyCall(f);
    const scope = args[row.kind === 'read' ? 0 : args.length - 2] as { anchors: unknown[] };
    expect(scope.anchors).toEqual([]);
    await f.dispatch();
    const nextArgs = f.methods[row.method].mock.calls[1] ?? [];
    const nextScope = nextArgs[row.kind === 'read' ? 0 : nextArgs.length - 2] as typeof scope;
    expect(nextScope).not.toBe(scope);
    expect(nextScope.anchors).toEqual([]);
    expect(nextScope.anchors).not.toBe(scope.anchors);
  });
  it('global body/header shallow spread occurs before commission guard; no internal clone', async () => {
    const f = fixture(row);
    const events: string[] = [];
    Object.defineProperty(f.headers, 'idempotency-key', {
      enumerable: true,
      get() {
        events.push('header');
        return ' raw # key ';
      },
    });
    Object.defineProperty(f.dependencies, 'commissions', {
      get() {
        events.push('root');
        return f.repository;
      },
    });
    const response = await f.app.dispatch({
      method: row.http,
      pathname: row.path,
      headers: f.headers,
      get body() {
        events.push('body');
        return f.body;
      },
    });
    expect(response.statusCode).toBe(row.status);
    expect(events.slice(0, 2)).toEqual(['body', 'header']);
    expect(events.filter((event) => event === 'body')).toHaveLength(1);
    expect(events.filter((event) => event === 'header')).toHaveLength(1);
    expect(events.filter((event) => event === 'root')).toHaveLength(2);
  });
});

describe.each(rows.filter((row) => row.kind !== 'read'))('commission write $label', (row) => {
  it.each([undefined, null, [], true, 2, 'text'].map((body) => ({ body })))(
    'root object400 before authorization ($body)',
    async ({ body }) => {
      const f = fixture(row, { denied: true });
      expectError(await f.dispatch({ body }), 400, 'A JSON object body is required');
    },
  );
  it('sorted unknown fields400 before grant, without reading their values', async () => {
    const f = fixture(row, { denied: true });
    const body = { ...f.body, zebra: undefined, alpha: undefined };
    Object.defineProperty(body, 'zebra', {
      enumerable: true,
      get() {
        throw Error('allow must not read unknown value');
      },
    });
    expectError(await f.dispatch({ body }), 400, 'Unsupported fields: alpha, zebra');
  });
  if (row.kind !== 'publish') {
    it('requested own undefined field still requires field grant', async () => {
      const f = fixture(row, { fields: [] });
      const firstKey = keys(row)[0];
      if (firstKey === undefined) throw Error('missing static field fixture');
      f.body[firstKey] = undefined;
      expectError(await f.dispatch(), 403, 'Field permission denied');
    });
    it('unknown-field-free bad values follow field permission denial', async () => {
      const f = fixture(row, { fields: [] });
      const body = Object.fromEntries(keys(row).map((key) => [key, null]));
      expectError(await f.dispatch({ body }), 403, 'Field permission denied');
    });
  }
  it('independent missing read grant gives only id/version', async () => {
    const f = fixture(row, { read: null });
    const result = await f.dispatch();
    expect(result.statusCode).toBe(row.status);
    expect(result.body).toEqual({ id, version: 7 });
  });
  it('finite read fields include id but not implicit version', async () => {
    const f = fixture(row, { read: { scopes: [], fields: ['nested'] } });
    const result = await f.dispatch();
    expect(result.statusCode).toBe(row.status);
    expect(result.body).toEqual({ id, nested });
    expect((result.body as { nested: unknown }).nested).toBe(nested);
  });
  it('await-late read grant may disappear before projection', async () => {
    const f = fixture(row);
    f.methods[row.method].mockImplementation(() => {
      f.permissions.delete(row.read);
      return Promise.resolve(returned);
    });
    expect((await f.dispatch()).body).toEqual({ id, version: 7 });
  });
  it('await-late read fields and null fields are not pre-cached', async () => {
    const f = fixture(row, { read: { scopes: [], fields: [] } });
    f.methods[row.method].mockImplementation(() => {
      f.permissions.set(row.read, { scopes: [], fields: null });
      return Promise.resolve(returned);
    });
    expect((await f.dispatch()).body).toBe(returned);
  });
  it('projection is eager for finite fields but shallow for nested and special keys', async () => {
    const f = fixture(row, {
      read: { scopes: [], fields: ['nested', '__proto__', 'constructor', 'toString'] },
    });
    let hiddenReads = 0;
    const output = Object.fromEntries<unknown>([
      ['id', id],
      ['version', 9],
      ['nested', nested],
      ['__proto__', nested],
      ['constructor', 'own-constructor'],
      ['toString', 'own-toString'],
    ]);
    Object.defineProperty(output, 'hidden', {
      enumerable: true,
      get() {
        hiddenReads++;
        return 'not-visible';
      },
    });
    f.methods[row.method].mockResolvedValue(output);
    const result = await f.dispatch();
    expect(result.body).toEqual(
      Object.fromEntries([
        ['id', id],
        ['nested', nested],
        ['__proto__', nested],
        ['constructor', 'own-constructor'],
        ['toString', 'own-toString'],
      ]),
    );
    expect(hiddenReads).toBe(1);
    expect((result.body as { nested: unknown }).nested).toBe(nested);
  });
  it('does not fabricate id/version', async () => {
    const f = fixture(row, { read: null });
    f.methods[row.method].mockResolvedValue({ nested });
    expect((await f.dispatch()).body).toEqual({});
  });
});

describe.each(rows.filter((row) => row.kind === 'read'))('commission GET $label', (row) => {
  it('ignores body internals and asks no fields for authorization', async () => {
    const f = fixture(row, { fields: [] });
    const body = {};
    Object.defineProperty(body, 'rules', {
      get() {
        throw Error('GET ignores body');
      },
    });
    const result = await f.dispatch({ body });
    expect(result.statusCode).toBe(200);
    expect(result.body).toEqual({ items: [{ id }, { id }] });
  });
  it('late fields are read separately per row, not once per response', async () => {
    const f = fixture(row);
    const grant = {
      scopes: ['TEAM'] as const,
      get fields(): readonly string[] | null {
        return null;
      },
    };
    let reads = 0;
    Object.defineProperty(grant, 'fields', {
      get() {
        reads++;
        return reads === 2 ? ['nested'] : null;
      },
    });
    f.methods[row.method].mockImplementation(() => {
      f.permissions.set(row.read, grant);
      return Promise.resolve([returned, returned]);
    });
    const result = await f.dispatch();
    expect(reads).toBe(2);
    expect(result.body).toEqual({ items: [returned, { id, nested }] });
  });
  it('Map deletion during await returns raw refs via nullish fields fallback', async () => {
    const f = fixture(row);
    f.methods[row.method].mockImplementation(() => {
      f.permissions.delete(row.read);
      return Promise.resolve([returned]);
    });
    const result = await f.dispatch();
    expect((result.body as { items: unknown[] }).items[0]).toBe(returned);
  });
  it('empty result makes no post-await permission lookup', async () => {
    const f = fixture(row);
    let postReads = 0;
    f.methods[row.method].mockImplementation(() => {
      f.get.mockImplementation(() => {
        postReads++;
        throw Error('no rows');
      });
      return Promise.resolve([]);
    });
    expect((await f.dispatch()).body).toEqual({ items: [] });
    expect(postReads).toBe(0);
  });
});

describe('commission parser boundaries and old evaluation sequence', () => {
  const create = named('createPolicy');
  const version = named('createPolicyVersion');
  const accrue = named('accrue');
  it.each([create, version])(
    '$label preserves map holes without densifying sparse rules',
    async (row) => {
      const f = fixture(row);
      f.body.rules = new Array<unknown>(2);
      expect((await f.dispatch()).statusCode).toBe(201);
      const input = onlyCall(f)[row.kind === 'create' ? 0 : 1] as { rules: unknown[] };
      expect(input.rules).toHaveLength(2);
      expect(0 in input.rules).toBe(false);
      expect(1 in input.rules).toBe(false);
    },
  );
  it.each([create, version])(
    '$label maps inherited array indices while retaining raw rule refs',
    async (row) => {
      const f = fixture(row);
      const rules = new Array<unknown>(2);
      const prototype = Object.create(Array.prototype) as object;
      Object.defineProperty(prototype, '0', { value: rule });
      Object.setPrototypeOf(rules, prototype);
      f.body.rules = rules;
      expect((await f.dispatch()).statusCode).toBe(201);
      const input = onlyCall(f)[row.kind === 'create' ? 0 : 1] as { rules: unknown[] };
      expect(input.rules).not.toBe(rules);
      expect(Object.hasOwn(input.rules, '0')).toBe(true);
      expect(input.rules[0]).toBe(rule);
      expect(1 in input.rules).toBe(false);
    },
  );
  it('accrue captures method after valid period but before bad first UUID and missing key', async () => {
    const f = fixture(accrue);
    f.body.salesOrderId = 'bad';
    delete f.headers['idempotency-key'];
    let reads = 0;
    Object.defineProperty(f.repository, 'accrue', {
      get() {
        reads++;
        return f.methods.accrue;
      },
    });
    expectError(await f.dispatch(), 400, 'salesOrderId must be a UUID');
    expect(reads).toBe(1);
    expect(f.methods.accrue).not.toHaveBeenCalled();
  });
  it.each([create, version])(
    '$label maps rules to a new array, keeping each raw shallow object',
    async (row) => {
      const f = fixture(row);
      await f.dispatch();
      const input = onlyCall(f)[row.kind === 'create' ? 0 : 1] as {
        rules: unknown[];
        applicability?: unknown;
      };
      expect(input.rules).not.toBe(f.body.rules);
      expect(input.rules[0]).toBe(rule);
      if (row.kind === 'create') expect(input.applicability).toBe(nested);
    },
  );
  it.each([create, version])(
    '$label accepts empty/sparse rules without deep schema checks',
    async (row) => {
      for (const rules of [
        [],
        Array.from({ length: 2 }, () => ({ nested })),
        new Array<unknown>(2),
      ]) {
        const f = fixture(row);
        f.body.rules = rules;
        expect((await f.dispatch()).statusCode).toBe(201);
      }
    },
  );
  it.each([create, version])(
    '$label permits inherited/nonenumerable fields under the old own-key allowlist',
    async (row) => {
      const f = fixture(row);
      const body = Object.create(f.body) as Record<string, unknown>;
      Object.defineProperty(body, 'baseRateBasisPoints', { value: 200 });
      expect((await f.dispatch({ body })).statusCode).toBe(201);
    },
  );
  it.each([create, version])('$label rules root must be array', async (row) => {
    for (const rules of [null, undefined, {}, 'x']) {
      const f = fixture(row);
      f.body.rules = rules;
      expectError(await f.dispatch(), 400, 'rules must be an array');
    }
  });
  it.each([create, version])(
    '$label each rule must be shallow object, preserving index label',
    async (row) => {
      for (const invalid of [null, [], true, 2, 'x']) {
        const f = fixture(row);
        f.body.rules = [rule, invalid];
        expectError(await f.dispatch(), 400, 'rules[1] must be a JSON object');
      }
    },
  );
  it('create rules validation precedes code and method capture', async () => {
    const f = fixture(create);
    f.body.rules = [null];
    f.body.code = null;
    let reads = 0;
    Object.defineProperty(f.repository, 'createPolicy', {
      get() {
        reads++;
        throw Error('method too early');
      },
    });
    expectError(await f.dispatch(), 400, 'rules[0] must be a JSON object');
    expect(reads).toBe(0);
  });
  it('create rules getter changes whole root before method capture', async () => {
    const f = fixture(create);
    const replacement = vi.fn<MockCall>().mockResolvedValue(returned);
    const second = { ...f.repository, createPolicy: replacement };
    Object.defineProperty(f.body, 'rules', {
      enumerable: true,
      get() {
        f.dependencies.commissions = second as unknown as Repository;
        return [rule];
      },
    });
    expect((await f.dispatch()).statusCode).toBe(201);
    expect(f.methods.createPolicy).not.toHaveBeenCalled();
    expect(replacement.mock.contexts[0]).toBe(second);
  });
  it('version rules getter changes whole root only after method capture', async () => {
    const f = fixture(version);
    const second = {
      ...f.repository,
      createPolicyVersion: vi.fn<MockCall>().mockResolvedValue(returned),
    };
    Object.defineProperty(f.body, 'rules', {
      enumerable: true,
      get() {
        f.dependencies.commissions = second as unknown as Repository;
        return [rule];
      },
    });
    expect((await f.dispatch()).statusCode).toBe(201);
    expect(f.methods.createPolicyVersion.mock.contexts[0]).toBe(f.repository);
    expect(second.createPolicyVersion).not.toHaveBeenCalled();
  });
  it('create method getter cannot retroactively replace pre-parsed rules', async () => {
    const f = fixture(create);
    Object.defineProperty(f.repository, 'createPolicy', {
      get() {
        f.body.rules = null;
        return f.methods.createPolicy;
      },
    });
    expect((await f.dispatch()).statusCode).toBe(201);
    expect((onlyCall(f)[0] as { rules: unknown[] }).rules).toEqual([rule]);
  });
  it('version method getter can replace rules before input evaluation', async () => {
    const f = fixture(version);
    Object.defineProperty(f.repository, 'createPolicyVersion', {
      get() {
        f.body.rules = null;
        return f.methods.createPolicyVersion;
      },
    });
    expectError(await f.dispatch(), 400, 'rules must be an array');
  });
  it('version captures method before UUID, and UUID precedes rates/rules', async () => {
    const f = fixture(version);
    let reads = 0;
    Object.defineProperty(f.repository, 'createPolicyVersion', {
      get() {
        reads++;
        return f.methods.createPolicyVersion;
      },
    });
    f.body.baseRateBasisPoints = null;
    f.body.rules = null;
    expectError(
      await f.dispatch({ pathname: '/api/v1/commission-policies/a/versions' }),
      400,
      'commissionPolicyId must be a UUID',
    );
    expect(reads).toBe(1);
  });
  it.each([
    'baseRateBasisPoints',
    'minimumMarginBasisPoints',
    'releaseCollectionBasisPoints',
  ] as const)('%s preserves inclusive integer bounds and -0', async (field) => {
    const minimum = field === 'minimumMarginBasisPoints' ? -100000 : 0;
    for (const row of [create, version])
      for (const value of [minimum, 10000, -0]) {
        const f = fixture(row);
        f.body[field] = value;
        expect((await f.dispatch()).statusCode).toBe(201);
        const input = onlyCall(f)[row.kind === 'create' ? 0 : 1] as Record<string, unknown>;
        expect(Object.is(input[field], value)).toBe(true);
      }
  });
  it.each([
    'baseRateBasisPoints',
    'minimumMarginBasisPoints',
    'releaseCollectionBasisPoints',
  ] as const)(
    '%s rejects non-numbers/fractions/outside bounds before later input',
    async (field) => {
      const minimum = field === 'minimumMarginBasisPoints' ? -100000 : 0;
      for (const row of [create, version])
        for (const value of [minimum - 1, 10001, 0.1, NaN, Infinity, '200', null, undefined]) {
          const f = fixture(row);
          f.body[field] = value;
          expectError(
            await f.dispatch(),
            400,
            `${field} must be an integer between ${String(minimum)} and 10000`,
          );
        }
    },
  );
  it.each(['2026-02-30', '2026-08-01', '2026-08-01T24:00:00Z', ' 2026-08-01T08:00:00+08:00 '])(
    'time %s follows old Date normalization',
    async (value) => {
      for (const row of [create, version]) {
        const f = fixture(row);
        f.body.effectiveAt = value;
        expect((await f.dispatch()).statusCode).toBe(201);
        expect(
          (onlyCall(f)[row.kind === 'create' ? 0 : 1] as { effectiveAt: string }).effectiveAt,
        ).toBe(new Date(value.trim()).toISOString());
      }
    },
  );
  it.each([null, undefined, '', 'not-a-date', 1])(
    'invalid timestamp %s remains400',
    async (value) => {
      const f = fixture(version);
      f.body.effectiveAt = value;
      expectError(await f.dispatch(), 400);
    },
  );
  it.each([true, false, undefined, null, 1, 'true', {}, []].map((value) => ({ value })))(
    'publish flag $value is strict true, not truthiness',
    async ({ value }) => {
      const f = fixture(create);
      f.body.publish = value;
      expect((await f.dispatch()).statusCode).toBe(201);
      expect((onlyCall(f)[0] as { publish: boolean }).publish).toBe(value === true);
    },
  );
  it.each(['code', 'name'] as const)(
    'create %s uses string trim without stable-code/max-length rules',
    async (field) => {
      const f = fixture(create);
      f.body[field] = ' arbitrary lower # ' + 'x'.repeat(300);
      expect((await f.dispatch()).statusCode).toBe(201);
      expect((onlyCall(f)[0] as Record<string, unknown>)[field]).toBe(
        (f.body[field] as string).trim(),
      );
    },
  );
  it('applicability is required shallow object, not defaulted', async () => {
    for (const value of [undefined, null, [], 'x']) {
      const f = fixture(create);
      f.body.applicability = value;
      expectError(await f.dispatch(), 400, 'applicability must be a JSON object');
    }
  });
  it('publish allow[] precedes manage, and method precedes UUID', async () => {
    const row = named('publishPolicyVersion');
    const denied = fixture(row, { denied: true });
    expectError(
      await denied.dispatch({ body: { version: 1 } }),
      400,
      'Unsupported fields: version',
    );
    const f = fixture(row, { fields: [] });
    let reads = 0;
    Object.defineProperty(f.repository, 'publishPolicyVersion', {
      get() {
        reads++;
        return f.methods.publishPolicyVersion;
      },
    });
    expectError(
      await f.dispatch({ pathname: '/api/v1/commission-policy-versions/a/publish' }),
      400,
      'commissionPolicyVersionId must be a UUID',
    );
    expect(reads).toBe(1);
  });
  it.each(['2026-00', '2026-13', '26-08', '2026-8', '2026-08-01'])(
    'accrue period %s rejects before UUID, key or method',
    async (value) => {
      const f = fixture(accrue);
      f.body.accountingPeriod = value;
      f.body.salesOrderId = null;
      delete f.headers['idempotency-key'];
      let reads = 0;
      Object.defineProperty(f.repository, 'accrue', {
        get() {
          reads++;
          return f.methods.accrue;
        },
      });
      expectError(await f.dispatch(), 400, 'accountingPeriod must use YYYY-MM');
      expect(reads).toBe(0);
    },
  );
  it.each(['0000-01', '9999-12', ' 2026-08 '])(
    'accrue period %s is not given a business-year bound',
    async (value) => {
      const f = fixture(accrue);
      f.body.accountingPeriod = value;
      expect((await f.dispatch()).statusCode).toBe(201);
      expect((onlyCall(f)[0] as { accountingPeriod: string }).accountingPeriod).toBe(value.trim());
    },
  );
  it.each(['salesOrderId', 'beneficiaryEmployeeId', 'policyVersionId'] as const)(
    'accrue %s UUID validation follows period but precedes key',
    async (field) => {
      const f = fixture(accrue);
      f.body[field] = 'bad';
      delete f.headers['idempotency-key'];
      expectError(await f.dispatch(), 400, `${field} must be a UUID`);
    },
  );
  it('accrue period getter changes root before capture but is read once', async () => {
    const f = fixture(accrue);
    let reads = 0;
    const method = vi.fn<MockCall>().mockResolvedValue(returned);
    const second = { ...f.repository, accrue: method };
    Object.defineProperty(f.body, 'accountingPeriod', {
      enumerable: true,
      get() {
        reads++;
        f.dependencies.commissions = second as unknown as Repository;
        return ' 2026-08 ';
      },
    });
    expect((await f.dispatch()).statusCode).toBe(201);
    expect(reads).toBe(1);
    expect(method.mock.contexts[0]).toBe(second);
  });
});

describe.each(rows.filter((row) => row.kind === 'command'))('commission state $label', (row) => {
  it('target state/capability remains operation-specific', async () => {
    const f = fixture(row);
    await f.dispatch();
    expect((onlyCall(f)[1] as { state: string }).state).toBe(row.state);
    const otherCap = row.cap === 'commission:pay' ? 'commission:manage' : 'commission:pay';
    const denied = fixture(row, { denied: true });
    denied.permissions.set(otherCap, { scopes: ['COMPANY'], fields: null });
    expectError(await denied.dispatch(), 403, 'Permission denied');
  });
  it.each([
    [null, 1, null],
    [undefined, 2, null],
    [' reference ', 3, 'reference'],
  ] as const)(
    'externalReference %s keeps old getter count %s',
    async (value, expectedReads, expectedValue) => {
      const f = fixture(row);
      let reads = 0;
      Object.defineProperty(f.body, 'externalReference', {
        enumerable: true,
        get() {
          reads++;
          return value;
        },
      });
      expect((await f.dispatch()).statusCode).toBe(201);
      expect(reads).toBe(expectedReads);
      expect((onlyCall(f)[1] as { externalReference: unknown }).externalReference).toBe(
        expectedValue,
      );
    },
  );
  it('externalReference dynamic third value is parsed, not first', async () => {
    const f = fixture(row);
    let reads = 0;
    Object.defineProperty(f.body, 'externalReference', {
      enumerable: true,
      get() {
        reads++;
        return reads === 3 ? ' third ' : ' first ';
      },
    });
    expect((await f.dispatch()).statusCode).toBe(201);
    expect(reads).toBe(3);
    expect((onlyCall(f)[1] as { externalReference: unknown }).externalReference).toBe('third');
  });
  it('path UUID precedes reason/key after method capture', async () => {
    const f = fixture(row);
    f.body.reason = null;
    delete f.headers['idempotency-key'];
    let reads = 0;
    Object.defineProperty(f.repository, 'transition', {
      get() {
        reads++;
        return f.methods.transition;
      },
    });
    expectError(
      await f.dispatch({ pathname: row.path.replace(id, 'a') }),
      400,
      'commissionId must be a UUID',
    );
    expect(reads).toBe(1);
  });
  it('HTTP does not require payment/clawback evidence or reason length', async () => {
    const f = fixture(row);
    f.body.externalReference = null;
    f.body.reason = 'x'.repeat(1000);
    expect((await f.dispatch()).statusCode).toBe(201);
  });
  it('bad externalReference is before key but after reason', async () => {
    const f = fixture(row);
    f.body.externalReference = '';
    delete f.headers['idempotency-key'];
    expectError(await f.dispatch(), 400, 'externalReference is required');
    f.body.reason = '';
    expectError(await f.dispatch(), 400, 'reason is required');
  });
});

describe.each(rows.filter((row) => row.kind === 'accrue' || row.kind === 'command'))(
  'commission key $label',
  (row) => {
    it.each([undefined, '', 'x'.repeat(129)])(
      'missing/empty/129 key is400 with no body fallback',
      async (key) => {
        const f = fixture(row);
        f.headers['idempotency-key'] = key;
        expectError(await f.dispatch(), 400, 'Idempotency-Key is required');
        expect(f.methods[row.method]).not.toHaveBeenCalled();
      },
    );
    it.each([' ', ' raw # key ', 'x'.repeat(128)])(
      'valid raw key length %s is not trimmed',
      async (key) => {
        const f = fixture(row);
        f.headers['idempotency-key'] = key;
        expect((await f.dispatch()).statusCode).toBe(201);
        expect(onlyCall(f)[row.kind === 'accrue' ? 1 : 2]).toBe(key);
      },
    );
    it('body key is unknown, uppercase header is not a fallback', async () => {
      const f = fixture(row);
      f.body.idempotencyKey = 'body-key';
      expectError(await f.dispatch(), 400, 'Unsupported fields: idempotencyKey');
      delete f.body.idempotencyKey;
      delete f.headers['idempotency-key'];
      f.headers['Idempotency-Key'] = 'uppercase-only';
      expectError(await f.dispatch(), 400, 'Idempotency-Key is required');
    });
  },
);

describe('commission global and raw-path boundaries', () => {
  it('missing overall dependencies503 is before session or body parsing', async () => {
    expectError(
      await buildApp().dispatch({
        method: 'POST',
        pathname: '/api/v1/commissions/accrue',
        body: null,
        headers: { 'x-correlation-id': correlationId },
      }),
      503,
    );
  });
  it.each([
    '/api/v1/commissions/a/unknown',
    '/api/v1/commissions/a/pay/extra',
    '/api/v1/commissions/A/pay',
    '/api/v1/commission-policies/A/versions',
    '/api/v1/commission-policy-versions/A/publish',
    '/api/v1/commissions/accrue/',
  ])('unsupported %s does not inspect body or require commission grant', async (pathname) => {
    const f = fixture(named('accrue'), { denied: true });
    expectError(await f.dispatch({ pathname, body: null }), 404);
  });
  it('uppercase/trim UUID value accepted for body but uppercase raw path is not broadened', async () => {
    const f = fixture(named('accrue'));
    f.body.salesOrderId = ' ' + id.toUpperCase() + ' ';
    expect((await f.dispatch()).statusCode).toBe(201);
    expect((onlyCall(f)[0] as { salesOrderId: string }).salesOrderId).toBe(id.toUpperCase());
  });
  it('GET ignores body and idempotency value although global shallow header getter is evaluated', async () => {
    const f = fixture(named('listPolicies'));
    f.headers['idempotency-key'] = 'x'.repeat(500);
    expect((await f.dispatch({ body: null })).statusCode).toBe(200);
  });
  it('policy writes ignore header idempotency without adding body key support', async () => {
    for (const method of ['createPolicy', 'createPolicyVersion', 'publishPolicyVersion'] as const) {
      const f = fixture(named(method));
      delete f.headers['idempotency-key'];
      expect((await f.dispatch()).statusCode).toBe(f.row.status);
    }
  });
  it('global header getter errors escape inner500 wrapping', async () => {
    const f = fixture(named('accrue'));
    Object.defineProperty(f.headers, 'other', {
      enumerable: true,
      get() {
        throw Error('global-spread-only');
      },
    });
    await expect(f.dispatch()).rejects.toThrow('global-spread-only');
  });
  it('correlation normalization is shared by method, response and DomainError', async () => {
    const f = fixture(named('accrue'));
    f.headers['x-correlation-id'] = 'invalid-direct-mock';
    f.methods.accrue.mockRejectedValue(new DomainError('conflict', 'late-conflict'));
    const response = await f.dispatch();
    const actual = response.headers?.['x-correlation-id'];
    expect(actual).toMatch(/^[0-9a-f-]{36}$/u);
    expect(actual).not.toBe('invalid-direct-mock');
    expect(response.body).toEqual({
      error: { code: 'conflict', message: 'late-conflict', correlationId: actual },
    });
    expect(onlyCall(f).at(-1)).toBe(actual);
  });
  it('QTC shared POST objectBody remains an upstream boundary when QTC is installed', async () => {
    const f = fixture(named('accrue'), { denied: true });
    f.dependencies.quoteToCash = {} as NonNullable<ApiDependencies['quoteToCash']>;
    expectError(await f.dispatch({ body: null }), 400, 'A JSON object body is required');
  });
});
