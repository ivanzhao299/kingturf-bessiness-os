// Frozen against 0eccaf6 inline risk HTTP. Opaque mocks do not prove SQL algorithms.
import { describe, expect, it, vi } from 'vitest';
import { DomainError, type AuthorizationContext } from '@kingturf/domain';
import type { DataScope, PermissionKey } from '@kingturf/types';
import { buildApp, type ApiDependencies, type ApiRequest, type ApiResponse } from '../src/app.js';

type Repository = NonNullable<ApiDependencies['risks']>;
type Method =
  | 'listPolicies'
  | 'listEvaluations'
  | 'createPolicy'
  | 'createPolicyVersion'
  | 'publishPolicyVersion'
  | 'evaluate'
  | 'transitionTask';
type Kind = 'list' | 'create' | 'revision' | 'publish' | 'evaluate' | 'task';
type Row = Readonly<{
  label: string;
  kind: Kind;
  method: Method;
  http: string;
  path: string;
  cap: PermissionKey;
  read: PermissionKey;
  state?: string;
}>;
type Grant = NonNullable<ReturnType<AuthorizationContext['permissions']['get']>>;
type MutableDependencies = { -readonly [K in keyof ApiDependencies]: ApiDependencies[K] };
type Call = (...args: unknown[]) => Promise<unknown>;
const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const other = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const correlationId = '66666666-6666-4666-8666-666666666666';
const actor = { employeeId: id, companyId: 'risk-old-http-mock' };
const time = '2026-08-01T08:00:00+08:00';
const iso = '2026-08-01T00:00:00.000Z';
const rows: readonly Row[] = [
  {
    label: 'policy list',
    kind: 'list',
    method: 'listPolicies',
    http: 'GET',
    path: '/api/v1/risk-policies',
    cap: 'risk-policy:read',
    read: 'risk-policy:read',
  },
  {
    label: 'evaluation list',
    kind: 'list',
    method: 'listEvaluations',
    http: 'GET',
    path: '/api/v1/risk-evaluations',
    cap: 'risk:read',
    read: 'risk:read',
  },
  {
    label: 'policy create',
    kind: 'create',
    method: 'createPolicy',
    http: 'POST',
    path: '/api/v1/risk-policies',
    cap: 'risk-policy:manage',
    read: 'risk-policy:read',
  },
  {
    label: 'policy revision',
    kind: 'revision',
    method: 'createPolicyVersion',
    http: 'POST',
    path: '/api/v1/risk-policies/' + id + '/versions',
    cap: 'risk-policy:manage',
    read: 'risk-policy:read',
  },
  {
    label: 'policy publish',
    kind: 'publish',
    method: 'publishPolicyVersion',
    http: 'POST',
    path: '/api/v1/risk-policy-versions/' + id + '/publish',
    cap: 'risk-policy:manage',
    read: 'risk-policy:read',
  },
  {
    label: 'evaluate',
    kind: 'evaluate',
    method: 'evaluate',
    http: 'POST',
    path: '/api/v1/risk-evaluations',
    cap: 'risk:evaluate',
    read: 'risk:read',
  },
  ...(['acknowledge', 'escalate', 'close'] as const).map(
    (action): Row => ({
      label: 'task ' + action,
      kind: 'task',
      method: 'transitionTask',
      http: 'POST',
      path: '/api/v1/risk-tasks/' + id + '/' + action,
      cap: 'risk:manage',
      read: 'risk:read',
      state: { acknowledge: 'ACKNOWLEDGED', escalate: 'ESCALATED', close: 'CLOSED' }[action],
    }),
  ),
];
const writes = rows.filter((r) => r.kind !== 'list');
const lists = rows.filter((r) => r.kind === 'list');
const raw = rows.filter((r) => ['revision', 'publish', 'task'].includes(r.kind));
const policies = rows.filter((r) => r.kind === 'create' || r.kind === 'revision');
const keyed = rows.filter((r) => r.kind === 'evaluate' || r.kind === 'task');
const record = (value: unknown) => value as Record<string, unknown>;
function required<T>(value: T | undefined): T {
  if (value === undefined) throw new Error('missing fixture');
  return value;
}
function property(target: object, key: PropertyKey, get: () => unknown) {
  Object.defineProperty(target, key, { configurable: true, enumerable: true, get });
}
function bodyFor(row: Row): Record<string, unknown> {
  const policy = {
    minimumMarginBasisPoints: -100000,
    overdueGraceDays: 0,
    creditWarningDays: 3650,
    effectiveAt: time,
    rules: [{ nested: { keep: true }, arbitrary: 'opaque' }],
  };
  if (row.kind === 'create')
    return { code: ' policy text / lower ', name: ' Policy ', ...policy, publish: true };
  if (row.kind === 'revision') return policy;
  if (row.kind === 'evaluate')
    return {
      salesOrderId: id,
      policyVersionId: other,
      assigneeEmployeeId: id,
      validUntil: time,
      dueAt: time,
    };
  if (row.kind === 'task') return { reason: ' Reason ', evidence: { nested: { keep: true } } };
  return {};
}
function expectedInput(row: Row, body: Record<string, unknown>): unknown {
  if (row.kind === 'publish') return id;
  if (row.kind === 'task') return { state: row.state, reason: 'Reason', evidence: body.evidence };
  if (row.kind === 'evaluate')
    return {
      salesOrderId: id,
      policyVersionId: other,
      assigneeEmployeeId: id,
      validUntil: iso,
      dueAt: iso,
    };
  return {
    ...(row.kind === 'create' ? { code: 'policy text / lower', name: 'Policy' } : {}),
    minimumMarginBasisPoints: -100000,
    overdueGraceDays: 0,
    creditWarningDays: 3650,
    effectiveAt: iso,
    rules: body.rules,
    ...(row.kind === 'create' ? { publish: true } : {}),
  };
}
const scopeIndex = (r: Row) =>
  r.kind === 'list'
    ? 0
    : r.kind === 'revision' || r.kind === 'evaluate'
      ? 2
      : r.kind === 'task'
        ? 3
        : 1;
const inputIndex = (r: Row) => (r.kind === 'revision' || r.kind === 'task' ? 1 : 0);
function fixture(
  row: Row,
  options: {
    scopes?: readonly DataScope[];
    fields?: Grant['fields'];
    denied?: boolean;
    noRead?: boolean;
    noAnchors?: boolean;
    missing?: boolean;
    unauthenticated?: boolean;
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
  const scopeAnchors = new Map<
    PermissionKey,
    readonly { readonly scope: 'TEAM'; readonly organizationId: string }[]
  >([[row.cap, anchors]]);
  const context: AuthorizationContext = {
    actor,
    permissions,
    ...(options.noAnchors ? {} : { scopeAnchors }),
  };
  const returned = { id, version: 7, name: 'Visible', score: 80, nested: { keep: true } };
  const output = [returned, { ...returned, id: other }];
  const repository = {
    listPolicies: vi.fn<Call>().mockResolvedValue(output),
    listEvaluations: vi.fn<Call>().mockResolvedValue(output),
    createPolicy: vi.fn<Call>().mockResolvedValue(returned),
    createPolicyVersion: vi.fn<Call>().mockResolvedValue(returned),
    publishPolicyVersion: vi.fn<Call>().mockResolvedValue(returned),
    evaluate: vi.fn<Call>().mockResolvedValue(returned),
    transitionTask: vi.fn<Call>().mockResolvedValue(returned),
  };
  const authenticate = vi
    .fn<ApiDependencies['auth']['authenticate']>()
    .mockResolvedValue(options.unauthenticated ? null : context);
  const dependencies: MutableDependencies = {
    auth: { authenticate } as unknown as ApiDependencies['auth'],
    organizations: {} as ApiDependencies['organizations'],
    employees: {} as ApiDependencies['employees'],
    ...(options.missing ? {} : { risks: repository as unknown as Repository }),
  };
  const body = bodyFor(row);
  const headers: Record<string, string | undefined> = {
    authorization: 'Bearer mock-only-risk-session',
    'x-correlation-id': correlationId,
    'idempotency-key': ' old opaque key ',
  };
  const app = buildApp(dependencies);
  const dispatch = (overrides: Partial<ApiRequest> = {}) =>
    app.dispatch({ method: row.http, pathname: row.path, body, headers, ...overrides });
  return {
    scopes,
    anchors,
    scopeAnchors,
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
function error(response: ApiResponse, status: number, code: string, message: string) {
  expect(response.statusCode).toBe(status);
  expect(response.body).toEqual({ error: { code, message, correlationId } });
  expect(response.headers?.['x-correlation-id']).toBe(correlationId);
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}
type Field = Readonly<{
  name: string;
  parser: 'string' | 'integer' | 'uuid' | 'timestamp' | 'array' | 'object';
  min?: number;
  max?: number;
}>;
function fieldsFor(row: Row): readonly Field[] {
  if (row.kind === 'create' || row.kind === 'revision')
    return [
      ...(row.kind === 'create'
        ? [
            { name: 'code', parser: 'string' as const },
            { name: 'name', parser: 'string' as const },
          ]
        : []),
      { name: 'minimumMarginBasisPoints', parser: 'integer', min: -100000, max: 10000 },
      { name: 'overdueGraceDays', parser: 'integer', min: 0, max: 3650 },
      { name: 'creditWarningDays', parser: 'integer', min: 0, max: 3650 },
      { name: 'effectiveAt', parser: 'timestamp' },
      { name: 'rules', parser: 'array' },
    ];
  if (row.kind === 'evaluate')
    return [
      { name: 'salesOrderId', parser: 'uuid' },
      { name: 'policyVersionId', parser: 'uuid' },
      { name: 'assigneeEmployeeId', parser: 'uuid' },
      { name: 'validUntil', parser: 'timestamp' },
      { name: 'dueAt', parser: 'timestamp' },
    ];
  if (row.kind === 'task')
    return [
      { name: 'reason', parser: 'string' },
      { name: 'evidence', parser: 'object' },
    ];
  return [];
}
function invalidCases(f: Field): readonly [unknown, string][] {
  if (f.parser === 'integer')
    return [
      undefined,
      null,
      '',
      '0',
      0.5,
      NaN,
      Infinity,
      Number.MAX_SAFE_INTEGER + 1,
      required(f.min) - 1,
      required(f.max) + 1,
    ].map((v) => [v, `${f.name} must be an integer between ${String(f.min)} and ${String(f.max)}`]);
  if (f.parser === 'array')
    return [undefined, null, {}, '', 1, false].map((v) => [v, `${f.name} must be an array`]);
  if (f.parser === 'object')
    return [undefined, null, [], '', 1, false].map((v) => [v, `${f.name} must be a JSON object`]);
  const missing: readonly [unknown, string][] = [undefined, null, '', '  ', 0, false, {}, []].map(
    (v) => [v, `${f.name} is required`],
  );
  if (f.parser === 'uuid')
    return [
      ...missing,
      ...['a', '----', '00000000-0000-0000-0000-000000000000', id + '/'].map(
        (v): [unknown, string] => [v, `${f.name} must be a UUID`],
      ),
    ];
  if (f.parser === 'timestamp')
    return [
      ...missing,
      ...['not-time', '2026-99-99', '2026-01-01T25:00:00Z'].map((v): [unknown, string] => [
        v,
        `${f.name} must be a valid timestamp`,
      ]),
    ];
  return missing;
}

describe('frozen inline risk HTTP contract at 0eccaf6', () => {
  for (const row of rows)
    describe(row.label, () => {
      it('passes exact arguments, opaque refs, receiver and response status', async () => {
        const f = fixture(row);
        const response = await f.dispatch();
        expect(response.statusCode).toBe(row.kind === 'list' || row.kind === 'publish' ? 200 : 201);
        expect(f.call).toHaveBeenCalledTimes(1);
        expect(f.call.mock.contexts[0]).toBe(f.repository);
        const scope = { actor, scopes: f.scopes, anchors: f.anchors };
        const args =
          row.kind === 'list'
            ? [scope]
            : row.kind === 'revision'
              ? [id, expectedInput(row, f.body), scope, correlationId]
              : row.kind === 'task'
                ? [
                    id,
                    expectedInput(row, f.body),
                    f.headers['idempotency-key'],
                    scope,
                    correlationId,
                  ]
                : row.kind === 'evaluate'
                  ? [expectedInput(row, f.body), f.headers['idempotency-key'], scope, correlationId]
                  : [expectedInput(row, f.body), scope, correlationId];
        expect(f.call.mock.calls[0]).toEqual(args);
        const actualScope = record(required(f.call.mock.calls[0])[scopeIndex(row)]);
        expect(actualScope.actor).toBe(actor);
        expect(actualScope.scopes).toBe(f.scopes);
        expect(actualScope.anchors).toBe(f.anchors);
        if (row.kind === 'list') {
          expect(record(response.body).items).toEqual(f.output);
          expect((record(response.body).items as unknown[])[0]).toBe(f.returned);
        } else expect(response.body).toBe(f.returned);
        expect(response.headers?.['x-correlation-id']).toBe(correlationId);
      });
      it('authenticates before any malformed body', async () => {
        const f = fixture(row, { unauthenticated: true });
        error(
          await f.dispatch({ body: null }),
          401,
          'authentication_required',
          'A valid session is required',
        );
        expect(f.call).not.toHaveBeenCalled();
      });
      it('requires bearer without authenticating', async () => {
        const f = fixture(row);
        error(
          await f.dispatch({ headers: { 'x-correlation-id': correlationId } }),
          401,
          'authentication_required',
          'A valid session is required',
        );
        expect(f.authenticate).not.toHaveBeenCalled();
      });
      it('denies missing capability before parsing fields', async () => {
        const f = fixture(row, { denied: true });
        error(await f.dispatch({ body: {} }), 403, 'forbidden', 'Permission denied');
        expect(f.call).not.toHaveBeenCalled();
      });
      it('denies empty scopes', async () => {
        const f = fixture(row, { scopes: [] });
        error(await f.dispatch(), 403, 'forbidden', 'Permission denied');
        expect(f.call).not.toHaveBeenCalled();
      });
      for (const scopes of [['SELF'], ['TEAM'], ['DEPARTMENT'], ['COMPANY'], ['GROUP']] as const)
        it('forwards scopes without HTTP business restriction ' + scopes[0], async () => {
          const f = fixture(row, { scopes });
          expect((await f.dispatch()).statusCode).toBe(
            row.kind === 'list' || row.kind === 'publish' ? 200 : 201,
          );
          expect(record(required(f.call.mock.calls[0])[scopeIndex(row)]).scopes).toBe(scopes);
        });
      it('uses empty anchor array when absent', async () => {
        const f = fixture(row, { noAnchors: true });
        await f.dispatch();
        expect(record(required(f.call.mock.calls[0])[scopeIndex(row)]).anchors).toEqual([]);
      });
      for (const missing of [undefined, null, false, 0])
        it('missing/falsy root falls through ' + String(missing), async () => {
          const f = fixture(row, { missing: true });
          Object.defineProperty(f.dependencies, 'risks', { value: missing });
          error(await f.dispatch({ body: null }), 404, 'not_found', 'Route not found');
        });
      for (const [code, status] of [
        ['forbidden', 403],
        ['not_found', 404],
        ['conflict', 409],
        ['invalid_request', 400],
      ] as const)
        it('preserves DomainError ' + code, async () => {
          const f = fixture(row);
          f.call.mockRejectedValue(new DomainError(code, 'opaque domain'));
          error(await f.dispatch(), status, code, 'opaque domain');
        });
      it('hides ordinary repository error', async () => {
        const f = fixture(row);
        f.call.mockRejectedValue(new Error('private detail'));
        error(await f.dispatch(), 500, 'internal_error', 'Internal server error');
      });
      it('does not read method before authorization', async () => {
        const f = fixture(row, { denied: true });
        const get = vi.fn(() => {
          throw new Error('method');
        });
        property(f.repository, row.method, get);
        error(await f.dispatch(), 403, 'forbidden', 'Permission denied');
        expect(get).not.toHaveBeenCalled();
      });
      it('resolves second root and method only after Q, calls second receiver', async () => {
        const f = fixture(row);
        const events: string[] = [];
        const second = {
          [row.method]: function (this: object, ...args: unknown[]) {
            expect(this).toBe(second);
            expect(args).toHaveLength(scopeIndex(row) + (row.kind === 'list' ? 1 : 2));
            events.push('call');
            return Promise.resolve(row.kind === 'list' ? f.output : f.returned);
          },
        };
        let rootReads = 0;
        property(f.dependencies, 'risks', () => {
          events.push('root');
          rootReads++;
          return rootReads === 1 ? f.repository : second;
        });
        const get = f.permissions.get.bind(f.permissions);
        property(
          f.permissions,
          'get',
          () =>
            function (this: typeof f.permissions, key: PermissionKey) {
              expect(this).toBe(f.permissions);
              events.push('get:' + key);
              return get.call(this, key);
            },
        );
        expect((await f.dispatch()).statusCode).toBe(
          row.kind === 'list' || row.kind === 'publish' ? 200 : 201,
        );
        expect(rootReads).toBe(2);
        expect(events.indexOf('get:' + row.cap)).toBeGreaterThan(events.indexOf('root'));
        expect(events.lastIndexOf('root')).toBeGreaterThan(events.indexOf('get:' + row.cap));
        expect(events.at(-1)).not.toBe('root');
        expect(f.call).not.toHaveBeenCalled();
      });
      it('keeps method even if actor getter replaces it', async () => {
        const f = fixture(row);
        const replacement = vi.fn<Call>().mockResolvedValue(f.returned);
        property(f.context, 'actor', () => {
          Object.defineProperty(f.repository, row.method, {
            value: replacement,
            configurable: true,
          });
          return actor;
        });
        await f.dispatch();
        expect(f.call).toHaveBeenCalledTimes(1);
        expect(replacement).not.toHaveBeenCalled();
      });
      it('late actor getter failure becomes generic500', async () => {
        const f = fixture(row);
        property(f.context, 'actor', () => {
          throw new Error('actor');
        });
        error(await f.dispatch(), 500, 'internal_error', 'Internal server error');
        expect(f.call).not.toHaveBeenCalled();
      });
      it('late Map.get retains receiver and read capability', async () => {
        const f = fixture(row);
        f.call.mockImplementation(() => {
          const get = f.permissions.get.bind(f.permissions);
          property(
            f.permissions,
            'get',
            () =>
              function (this: typeof f.permissions, cap: PermissionKey) {
                expect(this).toBe(f.permissions);
                expect(cap).toBe(row.read);
                return { ...required(get.call(this, cap)), fields: ['score'] };
              },
          );
          return Promise.resolve(row.kind === 'list' ? f.output : f.returned);
        });
        const response = await f.dispatch();
        const projected = { id, score: 80 };
        expect(
          row.kind === 'list' ? (record(response.body).items as unknown[])[0] : response.body,
        ).toEqual(projected);
      });
      it('reads response permission after unresolved promise', async () => {
        const f = fixture(row);
        const d = deferred<unknown>();
        const entered = deferred<undefined>();
        f.call.mockImplementation(() => {
          entered.resolve(undefined);
          return d.promise;
        });
        const pending = f.dispatch();
        await entered.promise;
        f.permissions.set(row.read, { scopes: [], fields: ['name'] });
        d.resolve(row.kind === 'list' ? f.output : f.returned);
        const response = await pending;
        expect(
          row.kind === 'list' ? (record(response.body).items as unknown[])[0] : response.body,
        ).toEqual({ id, name: 'Visible' });
      });
      it('reads all own entries even when projecting fields', async () => {
        const f = fixture(row);
        property(f.returned, 'hidden', () => {
          throw new Error('own entry');
        });
        f.permissions.set(row.read, { scopes: ['COMPANY'], fields: [] });
        error(await f.dispatch(), 500, 'internal_error', 'Internal server error');
      });
      it('returns unprojected original reference with null fields, no entry enumeration', async () => {
        const f = fixture(row);
        property(f.returned, 'hidden', () => {
          throw new Error('must not read');
        });
        const response = await f.dispatch();
        expect(response.statusCode).toBe(row.kind === 'list' || row.kind === 'publish' ? 200 : 201);
        expect(
          row.kind === 'list' ? (record(response.body).items as unknown[])[0] : response.body,
        ).toBe(f.returned);
      });
      it('body getter exception before inner dispatch remains rejected', async () => {
        const f = fixture(row);
        const request: ApiRequest = { method: row.http, pathname: row.path, headers: f.headers };
        property(request, 'body', () => {
          throw new Error('outer spread');
        });
        await expect(f.app.dispatch(request)).rejects.toThrow('outer spread');
      });
    });
  for (const row of writes)
    describe(row.label + ' writes', () => {
      for (const body of [undefined, null, [], '', false, 0])
        it('object body before Q ' + String(body), async () => {
          const f = fixture(row, { denied: true });
          error(
            await f.dispatch({ body }),
            400,
            'invalid_request',
            'A JSON object body is required',
          );
          expect(f.call).not.toHaveBeenCalled();
        });
      it('unknown own fields sorted before Q and without reading values', async () => {
        const f = fixture(row, { denied: true });
        property(f.body, 'zeta', () => {
          throw new Error('not read');
        });
        f.body.alpha = 0;
        error(await f.dispatch(), 400, 'invalid_request', 'Unsupported fields: alpha, zeta');
      });
      it('inherited unknown and symbols ignored by allow/field authorization', async () => {
        const f = fixture(row);
        Object.setPrototypeOf(f.body, { unknown: 1 });
        Object.defineProperty(f.body, 'hidden', { value: 1 });
        f.body[Symbol('unknown') as unknown as string] = 2;
        expect((await f.dispatch()).statusCode).toBe(row.kind === 'publish' ? 200 : 201);
      });
      it('own allowed fields are requested, publish requests none', async () => {
        const f = fixture(row, { fields: [] });
        if (row.kind === 'publish') expect((await f.dispatch()).statusCode).toBe(200);
        else {
          error(await f.dispatch(), 403, 'forbidden', 'Field permission denied');
          expect(f.call).not.toHaveBeenCalled();
        }
      });
      it('inherited supported fields read although not requested', async () => {
        const f = fixture(row, { fields: [] });
        const body = Object.create(f.body) as Record<string, unknown>;
        expect((await f.dispatch({ body })).statusCode).toBe(row.kind === 'publish' ? 200 : 201);
      });
      for (const fields of [null, [], ['score']] as const)
        it('independent late read fields ' + JSON.stringify(fields), async () => {
          const f = fixture(row);
          f.permissions.set(row.read, { scopes: [], fields });
          const response = await f.dispatch();
          expect(response.body).toEqual(
            fields === null ? f.returned : fields.length ? { id, score: 80 } : { id },
          );
        });
      it('without read grant only id/version', async () => {
        const f = fixture(row, { noRead: true });
        expect((await f.dispatch()).body).toEqual({ id, version: 7 });
      });
      it('no-read null result500 while all-read null remains null', async () => {
        const f = fixture(row, { noRead: true });
        f.call.mockResolvedValue(null);
        error(await f.dispatch(), 500, 'internal_error', 'Internal server error');
        f.permissions.set(row.read, { scopes: [], fields: null });
        expect((await f.dispatch()).body).toBeNull();
      });
      it('array result without read projects own entries id/version only', async () => {
        const f = fixture(row, { noRead: true });
        f.call.mockResolvedValue([]);
        expect((await f.dispatch()).body).toEqual({});
      });
      for (const field of fieldsFor(row)) {
        for (const [index, [value, message]] of invalidCases(field).entries())
          it(field.name + ' invalid #' + String(index), async () => {
            const f = fixture(row);
            f.body[field.name] = value;
            error(await f.dispatch(), 400, 'invalid_request', message);
            expect(f.call).not.toHaveBeenCalled();
          });
        it(field.name + ' getter reads once after method and before actor', async () => {
          const f = fixture(row);
          const events: string[] = [];
          const original = f.body[field.name];
          property(f.repository, row.method, () => {
            events.push('method');
            return f.call;
          });
          property(f.body, field.name, () => {
            events.push('input');
            return original;
          });
          property(f.context, 'actor', () => {
            events.push('actor');
            return actor;
          });
          await f.dispatch();
          expect(events).toEqual(['method', 'input', 'actor']);
        });
        it(field.name + ' throwing method precedes invalid input', async () => {
          const f = fixture(row);
          f.body[field.name] = undefined;
          property(f.repository, row.method, () => {
            throw new Error('method');
          });
          error(await f.dispatch(), 500, 'internal_error', 'Internal server error');
        });
        it(field.name + ' undefined method still evaluates bad input', async () => {
          const f = fixture(row);
          f.body[field.name] = undefined;
          property(f.repository, row.method, () => undefined);
          error(await f.dispatch(), 400, 'invalid_request', required(invalidCases(field)[0])[1]);
        });
        it(field.name + ' input failure precedes actor', async () => {
          const f = fixture(row);
          f.body[field.name] = undefined;
          const get = vi.fn(() => {
            throw new Error('actor');
          });
          property(f.context, 'actor', get);
          error(await f.dispatch(), 400, 'invalid_request', required(invalidCases(field)[0])[1]);
          expect(get).not.toHaveBeenCalled();
        });
        it(field.name + ' input mutating method cannot replace captured receiver', async () => {
          const f = fixture(row);
          const original = f.body[field.name];
          const replacement = vi.fn<Call>().mockResolvedValue(f.returned);
          property(f.body, field.name, () => {
            Object.defineProperty(f.repository, row.method, {
              value: replacement,
              configurable: true,
            });
            f.dependencies.risks = {} as Repository;
            return original;
          });
          await f.dispatch();
          expect(f.call).toHaveBeenCalledTimes(1);
          expect(f.call.mock.contexts[0]).toBe(f.repository);
          expect(replacement).not.toHaveBeenCalled();
        });
        if (field.parser === 'integer')
          for (const value of [required(field.min), required(field.max), -0]) {
            if (value < required(field.min)) continue;
            it(field.name + ' exact integer boundary ' + String(value), async () => {
              const f = fixture(row);
              f.body[field.name] = value;
              await f.dispatch();
              expect(
                Object.is(
                  record(required(f.call.mock.calls[0])[inputIndex(row)])[field.name],
                  value,
                ),
              ).toBe(true);
            });
          }
        if (field.parser === 'uuid')
          it(field.name + ' trims uppercase preserving spelling', async () => {
            const f = fixture(row);
            f.body[field.name] = ' ' + id.toUpperCase() + ' ';
            await f.dispatch();
            expect(record(required(f.call.mock.calls[0])[inputIndex(row)])[field.name]).toBe(
              id.toUpperCase(),
            );
          });
        if (field.parser === 'timestamp')
          for (const [value, expected] of [
            [' 2026-02-30 ', '2026-03-02T00:00:00.000Z'],
            ['2026-08-01', '2026-08-01T00:00:00.000Z'],
          ] as const)
            it(field.name + ' old Date normalization ' + value, async () => {
              const f = fixture(row);
              f.body[field.name] = value;
              await f.dispatch();
              expect(record(required(f.call.mock.calls[0])[inputIndex(row)])[field.name]).toBe(
                expected,
              );
            });
      }
      it('all field getters remain original input order', async () => {
        const f = fixture(row);
        const events: string[] = [];
        const names = [
          ...fieldsFor(row).map((x) => x.name),
          ...(row.kind === 'create' ? ['publish'] : []),
        ];
        for (const name of names) {
          const v = f.body[name];
          property(f.body, name, () => {
            events.push(name);
            return v;
          });
        }
        await f.dispatch();
        expect(events).toEqual(names);
      });
      for (const [i, a] of fieldsFor(row).entries())
        for (const b of fieldsFor(row).slice(i + 1))
          it('first error ' + a.name + ' before ' + b.name, async () => {
            const f = fixture(row);
            f.body[a.name] = undefined;
            property(f.body, b.name, () => {
              throw new Error('later input');
            });
            error(await f.dispatch(), 400, 'invalid_request', required(invalidCases(a)[0])[1]);
          });
    });
  for (const row of lists)
    describe(row.label + ' reads', () => {
      it('does not read late field-grant fields for empty result', async () => {
        const f = fixture(row);
        const grant = required(f.permissions.get(row.cap));
        f.call.mockImplementation(() => {
          property(grant, 'fields', () => {
            throw new Error('no row');
          });
          return Promise.resolve([]);
        });
        expect((await f.dispatch({ body: { arbitrary: true } })).body).toEqual({ items: [] });
      });
      it('field projection is per row and late', async () => {
        const f = fixture(row);
        f.call.mockImplementation(() => {
          let n = 0;
          property(
            f.permissions,
            'get',
            () =>
              function (this: typeof f.permissions, cap: PermissionKey) {
                expect(this).toBe(f.permissions);
                expect(cap).toBe(row.read);
                return { scopes: [], fields: ++n === 1 ? ['name'] : ['score'] };
              },
          );
          return Promise.resolve(f.output);
        });
        expect((await f.dispatch()).body).toEqual({
          items: [
            { id, name: 'Visible' },
            { id: other, score: 80 },
          ],
        });
      });
      it('missing read after repository uses null fields and original row refs', async () => {
        const f = fixture(row);
        f.call.mockImplementation(() => {
          f.permissions.delete(row.read);
          return Promise.resolve(f.output);
        });
        const response = await f.dispatch();
        expect((record(response.body).items as unknown[])[0]).toBe(f.returned);
      });
      it('non-array repository result is500', async () => {
        const f = fixture(row);
        f.call.mockResolvedValue({});
        error(await f.dispatch(), 500, 'internal_error', 'Internal server error');
      });
      it('null row remains null without projection', async () => {
        const f = fixture(row);
        f.call.mockResolvedValue([null]);
        expect((await f.dispatch()).body).toEqual({ items: [null] });
      });
      it('null row with projection is500', async () => {
        const f = fixture(row, { fields: [] });
        f.call.mockResolvedValue([null]);
        error(await f.dispatch(), 500, 'internal_error', 'Internal server error');
      });
    });
  for (const row of policies)
    describe(row.label + ' rules', () => {
      for (const [i, rule] of [undefined, null, [], '', false, 1].entries())
        it('invalid shallow rule #' + String(i), async () => {
          const f = fixture(row);
          f.body.rules = [rule];
          error(await f.dispatch(), 400, 'invalid_request', 'rules[0] must be a JSON object');
          expect(f.call).not.toHaveBeenCalled();
        });
      for (const rules of [[], new Array<unknown>(2), [new Date('2026-01-01')]])
        it(
          'allows empty/holes/Date rule ' + String(rules.length) + ':' + String(0 in rules),
          async () => {
            const f = fixture(row);
            f.body.rules = rules;
            expect((await f.dispatch()).statusCode).toBe(201);
            const actual = record(required(f.call.mock.calls[0])[inputIndex(row)])
              .rules as unknown[];
            expect(actual).not.toBe(rules);
            expect(actual.length).toBe(rules.length);
            expect(0 in actual).toBe(0 in rules);
            if (0 in rules) expect(actual[0]).toBe(rules[0]);
          },
        );
      it('uses inherited numeric index and same nested refs, new outer array', async () => {
        const f = fixture(row);
        const rules = new Array<unknown>(2);
        const rule = { nested: { a: 1 } };
        Object.setPrototypeOf(
          rules,
          Object.assign(Object.create(Array.prototype) as object, { 0: rule }),
        );
        f.body.rules = rules;
        await f.dispatch();
        const actual = record(required(f.call.mock.calls[0])[inputIndex(row)]).rules as unknown[];
        expect(actual).not.toBe(rules);
        expect(Object.hasOwn(actual, '0')).toBe(true);
        expect(actual[0]).toBe(rule);
        expect(1 in actual).toBe(false);
      });
      it('does not walk rule values or own getters', async () => {
        const f = fixture(row);
        const rule = { nested: { keep: true } };
        property(rule, 'unused', () => {
          throw new Error('shallow only');
        });
        f.body.rules = [rule];
        expect((await f.dispatch()).statusCode).toBe(201);
        expect(
          (record(required(f.call.mock.calls[0])[inputIndex(row)]).rules as unknown[])[0],
        ).toBe(rule);
      });
      it('rules map property is read after captured method', async () => {
        const f = fixture(row);
        const events: string[] = [];
        const rules: unknown[] = [{}];
        property(f.repository, row.method, () => {
          events.push('method');
          return f.call;
        });
        property(rules, 'map', () => {
          events.push('map');
          return Array.prototype.map;
        });
        f.body.rules = rules;
        await f.dispatch();
        expect(events).toEqual(['method', 'map']);
      });
      it('native map snapshot length and per-index getter order', async () => {
        const f = fixture(row);
        const events: number[] = [];
        const rules: unknown[] = [{}, {}];
        const first = {};
        const second = {};
        property(rules, '0', () => {
          events.push(0);
          rules.push({});
          return first;
        });
        property(rules, '1', () => {
          events.push(1);
          return second;
        });
        f.body.rules = rules;
        await f.dispatch();
        expect(record(required(f.call.mock.calls[0])[inputIndex(row)]).rules).toEqual([
          first,
          second,
        ]);
        expect(events).toEqual([0, 1]);
      });
      it('second bad rule reports actual index and stops later getter', async () => {
        const f = fixture(row);
        const rules: unknown[] = [{}, null, {}];
        const get = vi.fn(() => {
          throw new Error('later');
        });
        property(rules, '2', get);
        f.body.rules = rules;
        error(await f.dispatch(), 400, 'invalid_request', 'rules[1] must be a JSON object');
        expect(get).not.toHaveBeenCalled();
      });
    });
  const create = required(rows.find((r) => r.kind === 'create'));
  for (const [index, publish] of [undefined, null, false, 0, 1, 'true', {}, []].entries())
    it('publish is strict boolean, not coercion #' + String(index), async () => {
      const f = fixture(create);
      f.body.publish = publish;
      await f.dispatch();
      expect(record(required(f.call.mock.calls[0])[0]).publish).toBe(false);
    });
  for (const row of keyed)
    describe(row.label + ' idempotency', () => {
      for (const key of [undefined, '', 'a'.repeat(129)])
        it('rejects key after valid input ' + String(key?.length), async () => {
          const f = fixture(row);
          f.headers['idempotency-key'] = key;
          error(await f.dispatch(), 400, 'invalid_request', 'Idempotency-Key is required');
          expect(f.call).not.toHaveBeenCalled();
        });
      for (const key of [' ', 'a'.repeat(128), 'key / : unicode 草'])
        it('passes opaque key unchanged ' + String(key.length), async () => {
          const f = fixture(row);
          f.headers['idempotency-key'] = key;
          await f.dispatch();
          expect(required(f.call.mock.calls[0])[row.kind === 'task' ? 2 : 1]).toBe(key);
        });
      it('outer header getter copied once; input before key validation before actor', async () => {
        const f = fixture(row);
        let reads = 0;
        property(f.headers, 'idempotency-key', () => {
          reads++;
          return ' key ';
        });
        const events: string[] = [];
        const last = required(fieldsFor(row).at(-1)).name;
        const v = f.body[last];
        property(f.body, last, () => {
          events.push('input');
          return v;
        });
        property(f.context, 'actor', () => {
          events.push('actor');
          return actor;
        });
        await f.dispatch();
        expect(reads).toBe(1);
        expect(events).toEqual(['input', 'actor']);
      });
      it('bad input wins over missing key and actor getter', async () => {
        const f = fixture(row);
        const first = required(fieldsFor(row)[0]);
        f.body[first.name] = undefined;
        f.headers['idempotency-key'] = undefined;
        const get = vi.fn(() => {
          throw new Error('actor');
        });
        property(f.context, 'actor', get);
        error(await f.dispatch(), 400, 'invalid_request', required(invalidCases(first)[0])[1]);
        expect(get).not.toHaveBeenCalled();
      });
      it('missing key wins over actor getter', async () => {
        const f = fixture(row);
        f.headers['idempotency-key'] = undefined;
        const get = vi.fn(() => {
          throw new Error('actor');
        });
        property(f.context, 'actor', get);
        error(await f.dispatch(), 400, 'invalid_request', 'Idempotency-Key is required');
        expect(get).not.toHaveBeenCalled();
      });
      it('original request headers copied before input mutation', async () => {
        const f = fixture(row);
        const name = required(fieldsFor(row)[0]).name;
        const v = f.body[name];
        property(f.body, name, () => {
          f.headers['idempotency-key'] = ' changed ';
          return v;
        });
        await f.dispatch();
        expect(required(f.call.mock.calls[0])[row.kind === 'task' ? 2 : 1]).toBe(
          ' old opaque key ',
        );
      });
    });
  for (const row of rows) {
    it(row.label + ' root getter throw becomes internal500', async () => {
      const f = fixture(row);
      property(f.dependencies, 'risks', () => {
        throw new Error('root');
      });
      error(await f.dispatch(), 500, 'internal_error', 'Internal server error');
    });
    it(row.label + ' second root getter throw occurs after authorization', async () => {
      const f = fixture(row);
      let n = 0;
      property(f.dependencies, 'risks', () => {
        if (++n === 2) throw new Error('second root');
        return f.repository;
      });
      error(await f.dispatch(), 500, 'internal_error', 'Internal server error');
      expect(n).toBe(2);
    });
    it(row.label + ' Q captures scopes and anchors before method/input effects', async () => {
      const f = fixture(row);
      property(f.repository, row.method, () => {
        f.permissions.set(row.cap, { scopes: ['SELF'], fields: null });
        f.scopeAnchors.set(row.cap, []);
        return f.call;
      });
      await f.dispatch();
      const scope = record(required(f.call.mock.calls[0])[scopeIndex(row)]);
      expect(scope.scopes).toBe(f.scopes);
      expect(scope.anchors).toBe(f.anchors);
    });
    it(row.label + ' normal undefined method with valid input500', async () => {
      const f = fixture(row);
      property(f.repository, row.method, () => undefined);
      error(await f.dispatch(), 500, 'internal_error', 'Internal server error');
    });
    it(row.label + ' method getter DomainError is not hidden as generic500', async () => {
      const f = fixture(row);
      property(f.repository, row.method, () => {
        throw new DomainError('conflict', 'getter conflict');
      });
      error(await f.dispatch(), 409, 'conflict', 'getter conflict');
    });
  }
  for (const row of writes) {
    it(row.label + ' grants exact own keys including optional publish', async () => {
      const f = fixture(row, { fields: Object.keys(bodyFor(row)) });
      expect((await f.dispatch()).statusCode).toBe(row.kind === 'publish' ? 200 : 201);
    });
    it(row.label + ' late read Map getter failure is500 after write', async () => {
      const f = fixture(row);
      f.call.mockImplementation(() => {
        property(f.permissions, 'get', () => {
          throw new Error('late get');
        });
        return Promise.resolve(f.returned);
      });
      error(await f.dispatch(), 500, 'internal_error', 'Internal server error');
      expect(f.call).toHaveBeenCalledTimes(1);
    });
    it(row.label + ' Date body passes objectBody then original missing first field', async () => {
      const f = fixture(row);
      const response = await f.dispatch({ body: new Date('2026-01-01') });
      if (row.kind === 'publish') expect(response.statusCode).toBe(200);
      else
        error(
          response,
          400,
          'invalid_request',
          required(invalidCases(required(fieldsFor(row)[0]))[0])[1],
        );
    });
  }
  for (const row of keyed) {
    it(
      row.label + ' header length getter runs after input before actor; one inner length read',
      async () => {
        const f = fixture(row);
        const events: string[] = [];
        const key = {
          get length() {
            events.push('length');
            return 3;
          },
        };
        f.headers['idempotency-key'] = key as unknown as string;
        const name = required(fieldsFor(row).at(-1)).name;
        const value = f.body[name];
        property(f.body, name, () => {
          events.push('input');
          return value;
        });
        property(f.context, 'actor', () => {
          events.push('actor');
          return actor;
        });
        await f.dispatch();
        expect(events).toEqual(['input', 'length', 'actor']);
        expect(required(f.call.mock.calls[0])[row.kind === 'task' ? 2 : 1]).toBe(key);
      },
    );
    it(
      row.label + ' original headers getter is read three times by wrapper; inner key from third',
      async () => {
        const f = fixture(row);
        let n = 0;
        const request: ApiRequest = { method: row.http, pathname: row.path, body: f.body };
        property(request, 'headers', () => ({
          ...f.headers,
          'idempotency-key': 'read-' + String(++n),
        }));
        const response = await f.app.dispatch(request);
        expect(response.statusCode).toBe(201);
        expect(n).toBe(3);
        expect(required(f.call.mock.calls[0])[row.kind === 'task' ? 2 : 1]).toBe('read-3');
      },
    );
    it(row.label + ' throwing key length wins over actor', async () => {
      const f = fixture(row);
      f.headers['idempotency-key'] = {
        get length() {
          throw new DomainError('conflict', 'key length');
        },
      } as unknown as string;
      const get = vi.fn(() => {
        throw new Error('actor');
      });
      property(f.context, 'actor', get);
      error(await f.dispatch(), 409, 'conflict', 'key length');
      expect(get).not.toHaveBeenCalled();
    });
  }
  for (const row of rows.filter((r) => r.kind === 'task')) {
    it(row.label + ' empty evidence Date accepted at HTTP, no SQL close check', async () => {
      const f = fixture(row);
      const evidence = new Date('2026-01-01');
      f.body.evidence = evidence;
      expect((await f.dispatch()).statusCode).toBe(201);
      expect(record(required(f.call.mock.calls[0])[1]).evidence).toBe(evidence);
    });
    it(row.label + ' empty evidence object accepted at HTTP', async () => {
      const f = fixture(row);
      f.body.evidence = {};
      expect((await f.dispatch()).statusCode).toBe(201);
    });
  }
  for (const row of raw) {
    for (const short of ['a', '-', '----', 'a-0'])
      it(row.label + ' raw short ID passed unchanged ' + short, async () => {
        const f = fixture(row);
        expect((await f.dispatch({ pathname: row.path.replace(id, short) })).statusCode).toBe(
          row.kind === 'publish' ? 200 : 201,
        );
        expect(required(f.call.mock.calls[0])[0]).toBe(short);
      });
    for (const wrong of [id.toUpperCase(), 'g', '%61', '', id + '/', id + '\n'])
      it(row.label + ' raw matcher rejects ' + JSON.stringify(wrong), async () => {
        const f = fixture(row);
        error(
          await f.dispatch({ pathname: row.path.replace(id, wrong) }),
          404,
          'not_found',
          'Route not found',
        );
        expect(f.call).not.toHaveBeenCalled();
      });
  }
  for (const path of [...new Set(rows.map((r) => r.path))]) {
    for (const method of ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']) {
      if (rows.some((r) => r.path === path && r.http === method)) continue;
      it('unsupported method ' + method + ' ' + path, async () => {
        const f = fixture(required(rows[0]));
        error(
          await f.dispatch({ pathname: path, method, body: null }),
          404,
          'not_found',
          'Route not found',
        );
        for (const call of Object.values(f.repository)) expect(call).not.toHaveBeenCalled();
      });
    }
    for (const variant of [
      path + '/',
      path + '?q=1',
      path + '#x',
      path + '\n',
      path.toUpperCase(),
      '/prefix' + path,
      path.replace('/api/v1/', '/api/v2/'),
      path + '/unknown',
    ])
      it('alternate exact/raw path ' + JSON.stringify(variant), async () => {
        const f = fixture(required(rows[0]));
        error(
          await f.dispatch({ pathname: variant, method: 'POST' }),
          404,
          'not_found',
          'Route not found',
        );
      });
  }
  for (const path of [
    '/api/v1/risk-tasks/' + id + '/reopen',
    '/api/v1/quality-plans',
    '/api/v1/sales-orders/' + id + '/360',
  ])
    it('neighbor root unavailable does not consume ' + path, async () => {
      const f = fixture(required(rows[0]));
      error(await f.dispatch({ pathname: path }), 404, 'not_found', 'Route not found');
      for (const call of Object.values(f.repository)) expect(call).not.toHaveBeenCalled();
    });
});
