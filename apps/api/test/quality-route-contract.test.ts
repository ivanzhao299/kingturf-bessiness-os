// Fixed old buildApp at 89c3987; opaque HTTP mocks do not prove SQL/state algorithms.
import { describe, expect, it, vi } from 'vitest';
import { DomainError, type AuthorizationContext } from '@kingturf/domain';
import type { DataScope, PermissionKey } from '@kingturf/types';
import { buildApp, type ApiDependencies, type ApiRequest, type ApiResponse } from '../src/app.js';

type Repository = NonNullable<ApiDependencies['quality']>;
type Method =
  | 'list'
  | 'createPlan'
  | 'publishPlan'
  | 'openInspection'
  | 'transitionInspection'
  | 'recordResult'
  | 'dispose';
type Kind = 'list' | 'create' | 'publish' | 'open' | 'transition' | 'result' | 'dispose';
type Row = Readonly<{
  label: string;
  method: Method;
  kind: Kind;
  path: string;
  cap: PermissionKey;
  read: PermissionKey;
  view?: string;
  state?: string;
}>;
type Grant = NonNullable<ReturnType<AuthorizationContext['permissions']['get']>>;
type MutableDependencies = { -readonly [K in keyof ApiDependencies]: ApiDependencies[K] };
type Call = (...args: unknown[]) => Promise<unknown>;
const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const other = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const correlationId = '88888888-8888-4888-8888-888888888888';
const actor = { employeeId: id, companyId: 'quality-old-http-mock' };
const time = '2026-08-01T08:00:00+08:00';
const iso = '2026-08-01T00:00:00.000Z';
const rows: readonly Row[] = [
  ...(
    [
      ['plans', '/api/v1/quality-plans', 'quality-plan:read'],
      ['inspections', '/api/v1/quality-inspections', 'quality:read'],
      ['lots', '/api/v1/lot-traceability', 'traceability:read'],
    ] as const
  ).map(
    ([view, path, cap]): Row => ({
      label: view,
      method: 'list',
      kind: 'list',
      path,
      cap,
      read: cap,
      view,
    }),
  ),
  {
    label: 'create plan',
    method: 'createPlan',
    kind: 'create',
    path: '/api/v1/quality-plans',
    cap: 'quality-plan:manage',
    read: 'quality-plan:read',
  },
  {
    label: 'publish plan',
    method: 'publishPlan',
    kind: 'publish',
    path: '/api/v1/quality-plans/' + id + '/publish',
    cap: 'quality-plan:manage',
    read: 'quality-plan:read',
  },
  {
    label: 'open inspection',
    method: 'openInspection',
    kind: 'open',
    path: '/api/v1/quality-inspections',
    cap: 'quality:inspect',
    read: 'quality:read',
  },
  ...(['sample', 'complete', 'cancel'] as const).map(
    (action): Row => ({
      label: action,
      method: 'transitionInspection',
      kind: 'transition',
      path: '/api/v1/quality-inspections/' + id + '/' + action,
      cap: 'quality:inspect',
      read: 'quality:read',
      state: { sample: 'SAMPLED', complete: 'COMPLETED', cancel: 'CANCELLED' }[action],
    }),
  ),
  {
    label: 'record result',
    method: 'recordResult',
    kind: 'result',
    path: '/api/v1/quality-inspections/' + id + '/results',
    cap: 'quality:inspect',
    read: 'quality:read',
  },
  ...(['release', 'reject'] as const).map(
    (action): Row => ({
      label: action,
      method: 'dispose',
      kind: 'dispose',
      path: '/api/v1/quality-inspections/' + id + '/' + action,
      cap: 'quality:disposition',
      read: 'quality:read',
      state: action === 'release' ? 'RELEASED' : 'REJECTED',
    }),
  ),
];
const lists = rows.filter((r) => r.kind === 'list');
const writes = rows.filter((r) => r.kind !== 'list');
const bodies = writes.filter((r) => r.kind !== 'publish');
const raw = rows.filter((r) => ['publish', 'transition', 'result', 'dispose'].includes(r.kind));
const commands = rows.filter((r) => r.kind === 'transition' || r.kind === 'dispose');
const create = rows.find((r) => r.kind === 'create');
const result = rows.find((r) => r.kind === 'result');
const scopeIndex = (r: Row) =>
  r.kind === 'transition' || r.kind === 'dispose' ? 3 : r.kind === 'result' ? 2 : 1;
const inputIndex = (r: Row) =>
  r.kind === 'transition' || r.kind === 'dispose' ? 2 : r.kind === 'result' ? 1 : 0;
const record = (value: unknown) => value as Record<string, unknown>;
function required<T>(value: T | undefined): T {
  if (value === undefined) throw new Error('missing fixture');
  return value;
}
function property(target: object, key: PropertyKey, get: () => unknown) {
  Object.defineProperty(target, key, { configurable: true, enumerable: true, get });
}
function characteristic() {
  return {
    code: ' SIZE ',
    name: ' Size ',
    dataType: 'NUMERIC',
    unitCode: ' arbitrary unit ',
    lowerLimit: '-1.200000',
    upperLimit: '2.500000',
    required: false,
    instructions: ' Measure ',
  };
}
function bodyFor(r: Row): Record<string, unknown> {
  if (r.kind === 'create')
    return {
      code: ' PLAN_1 ',
      name: ' Plan ',
      itemVersionId: id,
      inspectionStage: 'FINAL',
      samplingMethod: ' arbitrary sampling ',
      acceptanceRule: { opaque: { nested: true } },
      effectiveAt: time,
      characteristics: [characteristic()],
      publish: false,
    };
  if (r.kind === 'open')
    return {
      inspectionNumber: ' INSPECT_1 ',
      planVersionId: id,
      lotId: other,
      sourceType: ' CUSTOM_SOURCE ',
      sourceId: id,
      sampleSize: '0.000000',
    };
  if (r.kind === 'result')
    return {
      characteristicId: other,
      measuredNumeric: '-1.250000',
      measuredBoolean: false,
      measuredText: ' Text ',
      passed: true,
      notes: ' Note ',
      occurredAt: time,
      idempotencyKey: ' BODY_KEY ',
    };
  if (r.kind === 'transition' || r.kind === 'dispose')
    return {
      reason: ' Reason ',
      evidence: { nested: { opaque: true } },
      idempotencyKey: ' BODY_KEY ',
    };
  return {};
}
function expectedInput(r: Row, body: Record<string, unknown>): unknown {
  if (r.kind === 'list') return r.view;
  if (r.kind === 'publish') return id;
  if (r.kind === 'create')
    return {
      code: 'PLAN_1',
      name: 'Plan',
      itemVersionId: id,
      inspectionStage: 'FINAL',
      samplingMethod: 'arbitrary sampling',
      acceptanceRule: body.acceptanceRule,
      effectiveAt: iso,
      characteristics: [
        {
          code: 'SIZE',
          name: 'Size',
          dataType: 'NUMERIC',
          unitCode: 'arbitrary unit',
          lowerLimit: '-1.2',
          upperLimit: '2.5',
          required: false,
          instructions: 'Measure',
        },
      ],
      publish: false,
    };
  if (r.kind === 'open')
    return {
      inspectionNumber: 'INSPECT_1',
      planVersionId: id,
      lotId: other,
      sourceType: 'CUSTOM_SOURCE',
      sourceId: id,
      sampleSize: '0',
    };
  if (r.kind === 'result')
    return {
      characteristicId: other,
      measuredNumeric: '-1.25',
      measuredBoolean: false,
      measuredText: 'Text',
      passed: true,
      notes: 'Note',
      occurredAt: iso,
      idempotencyKey: 'BODY_KEY',
    };
  return { reason: 'Reason', evidence: body.evidence, idempotencyKey: 'BODY_KEY' };
}
function fixture(r: Row) {
  const scopes: readonly DataScope[] = ['TEAM'];
  const anchors = [{ scope: 'TEAM', organizationId: id }] as const;
  const permissions = new Map<PermissionKey, Grant>([[r.cap, { scopes, fields: null }]]);
  if (r.read !== r.cap) permissions.set(r.read, { scopes: [], fields: null });
  const scopeAnchors = new Map([[r.cap, anchors]]);
  const context: AuthorizationContext = { actor, permissions, scopeAnchors };
  const nested = { opaque: true };
  const returned = { id, version: 7, name: 'Visible', nested, hidden: 'opaque hash' };
  const output = [returned, { ...returned, id: other }];
  const repository = {
    list: vi.fn<Call>().mockResolvedValue(output),
    createPlan: vi.fn<Call>().mockResolvedValue(returned),
    publishPlan: vi.fn<Call>().mockResolvedValue(returned),
    openInspection: vi.fn<Call>().mockResolvedValue(returned),
    transitionInspection: vi.fn<Call>().mockResolvedValue(returned),
    recordResult: vi.fn<Call>().mockResolvedValue(returned),
    dispose: vi.fn<Call>().mockResolvedValue(returned),
  };
  const authenticate = vi.fn<ApiDependencies['auth']['authenticate']>().mockResolvedValue(context);
  const dependencies: MutableDependencies = {
    auth: { authenticate } as unknown as ApiDependencies['auth'],
    organizations: {} as ApiDependencies['organizations'],
    employees: {} as ApiDependencies['employees'],
    quality: repository as unknown as Repository,
  };
  const body = bodyFor(r);
  const headers = {
    authorization: 'Bearer mock-only-quality-session',
    'x-correlation-id': correlationId,
    'idempotency-key': 'ignored lower / header key',
  };
  const app = buildApp(dependencies);
  const dispatch = (overrides: Partial<ApiRequest> = {}) =>
    app.dispatch({
      method: r.kind === 'list' ? 'GET' : 'POST',
      pathname: r.path,
      body,
      headers,
      ...overrides,
    });
  return {
    context,
    permissions,
    scopeAnchors,
    scopes,
    anchors,
    nested,
    returned,
    output,
    repository,
    call: repository[r.method],
    authenticate,
    dependencies,
    body,
    headers,
    app,
    dispatch,
  };
}
function error(response: ApiResponse, status: number, code: string, message: string) {
  expect(response.statusCode).toBe(status);
  expect(response.body).toEqual({ error: { code, message, correlationId } });
  expect(response.headers?.['x-correlation-id']).toBe(correlationId);
}
function invalid(response: ApiResponse, message?: string) {
  expect(response.statusCode).toBe(400);
  expect(record(record(response.body).error).code).toBe('invalid_request');
  if (message !== undefined) expect(record(record(response.body).error).message).toBe(message);
}
function input(f: ReturnType<typeof fixture>, r: Row) {
  return record(required(f.call.mock.calls[0])[inputIndex(r)]);
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

describe('fixed old quality routing/authorization and call boundaries', () => {
  for (const r of rows)
    it(r.label + ' broad root is read even for unrelated method/path before domain Q', async () => {
      const f = fixture(r);
      f.permissions.clear();
      const root = vi.fn(() => {
        throw new DomainError('conflict', 'broad root');
      });
      property(f.dependencies, 'quality', root);
      error(
        await f.dispatch({ method: 'TRACE', pathname: '/api/v1/unrelated-quality' }),
        409,
        'conflict',
        'broad root',
      );
      expect(root).toHaveBeenCalledTimes(1);
    });
  for (const r of raw)
    it(r.label + ' GET does not claim a raw POST path', async () => {
      const f = fixture(r);
      error(await f.dispatch({ method: 'GET' }), 404, 'not_found', 'Route not found');
      expect(f.call).not.toHaveBeenCalled();
    });
  for (const kind of ['create', 'open'] as const)
    it(kind + ' shares exact pathname with GET without sharing method/body parser', async () => {
      const r = required(rows.find((r) => r.kind === kind)),
        f = fixture(r);
      f.permissions.set(r.read, { scopes: f.scopes, fields: null });
      expect((await f.dispatch({ method: 'GET', body: null })).statusCode).toBe(200);
      expect(f.repository.list).toHaveBeenCalledWith(kind === 'create' ? 'plans' : 'inspections', {
        actor,
        scopes: f.scopes,
        anchors: [],
      });
      expect(f.call).not.toHaveBeenCalled();
      const read = required(lists.find((read) => read.path === r.path)),
        g = fixture(read);
      g.permissions.set(r.cap, { scopes: g.scopes, fields: null });
      expect((await g.dispatch({ method: 'POST', body: bodyFor(r) })).statusCode).toBe(201);
      expect(g.repository[r.method]).toHaveBeenCalledTimes(1);
      expect(g.repository.list).not.toHaveBeenCalled();
    });
  for (const r of rows) {
    it(r.label + ' exact receiver, arity, normalized input and scope-anchor refs', async () => {
      const f = fixture(r);
      f.call.mockImplementation(function (this: unknown, ...args) {
        expect(this).toBe(f.repository);
        expect(args).toHaveLength(
          r.kind === 'list'
            ? 2
            : r.kind === 'transition' || r.kind === 'dispose'
              ? 5
              : r.kind === 'result'
                ? 4
                : 3,
        );
        return Promise.resolve(r.kind === 'list' ? f.output : f.returned);
      });
      const response = await f.dispatch();
      expect(response.statusCode).toBe(r.kind === 'list' ? 200 : 201);
      expect(f.call).toHaveBeenCalledTimes(1);
      const args = required(f.call.mock.calls[0]);
      expect(args[inputIndex(r)]).toEqual(expectedInput(r, f.body));
      const scope = record(args[scopeIndex(r)]);
      expect(scope.actor).toBe(actor);
      expect(scope.scopes).toBe(f.scopes);
      expect(scope.anchors).toBe(f.anchors);
      expect(Object.keys(scope)).toEqual(['actor', 'scopes', 'anchors']);
      if (r.kind === 'transition' || r.kind === 'dispose') {
        expect(args[0]).toBe(id);
        expect(args[1]).toBe(r.state);
        expect(input(f, r).evidence).toBe(f.body.evidence);
      }
      if (r.kind === 'create') expect(input(f, r).acceptanceRule).toBe(f.body.acceptanceRule);
      if (r.kind !== 'list') expect(args.at(-1)).toBe(correlationId);
      for (const [method, call] of Object.entries(f.repository))
        if (method !== r.method) expect(call).not.toHaveBeenCalled();
    });
    for (const scopes of [
      [],
      ['SELF'],
      ['TEAM'],
      ['DEPARTMENT'],
      ['REGION'],
      ['COMPANY'],
      ['GROUP'],
    ] as const)
      it(r.label + ' HTTP scope only nonempty ' + JSON.stringify(scopes), async () => {
        const f = fixture(r);
        f.permissions.set(r.cap, { scopes, fields: null });
        const response = await f.dispatch();
        if (scopes.length === 0) error(response, 403, 'forbidden', 'Permission denied');
        else {
          expect(response.statusCode).toBe(r.kind === 'list' ? 200 : 201);
          expect(record(required(f.call.mock.calls[0])[scopeIndex(r)]).scopes).toBe(scopes);
        }
      });
    it(r.label + ' missing permission and global authentication precede repository', async () => {
      const f = fixture(r);
      f.permissions.delete(r.cap);
      error(await f.dispatch(), 403, 'forbidden', 'Permission denied');
      expect(f.call).not.toHaveBeenCalled();
      f.authenticate.mockResolvedValue(null);
      error(await f.dispatch(), 401, 'authentication_required', 'A valid session is required');
      error(
        await f.dispatch({ headers: { 'x-correlation-id': correlationId } }),
        401,
        'authentication_required',
        'A valid session is required',
      );
    });
    it(r.label + ' absent anchors fresh empty array', async () => {
      const f = fixture(r);
      f.scopeAnchors.clear();
      expect((await f.dispatch()).statusCode).toBe(r.kind === 'list' ? 200 : 201);
      expect(record(required(f.call.mock.calls[0])[scopeIndex(r)]).anchors).toEqual([]);
    });
    for (const missing of [undefined, null, false, 0])
      it(r.label + ' missing broad root ' + JSON.stringify(missing), async () => {
        const f = fixture(r);
        const root = vi.fn(() => missing);
        property(f.dependencies, 'quality', root);
        error(await f.dispatch(), 404, 'not_found', 'Route not found');
        expect(root).toHaveBeenCalledTimes(1);
        expect(f.call).not.toHaveBeenCalled();
      });
    for (const method of ['PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS', 'get', 'post', 'TRACE'])
      it(r.label + ' unsupported method still reads broad root ' + method, async () => {
        const f = fixture(r);
        const root = vi.fn(() => f.repository);
        property(f.dependencies, 'quality', root);
        error(await f.dispatch({ method }), 404, 'not_found', 'Route not found');
        expect(root).toHaveBeenCalledTimes(1);
        expect(f.call).not.toHaveBeenCalled();
      });
    for (const [name, pathname] of [
      ['slash', r.path + '/'],
      ['query', r.path + '?x=1'],
      ['hash', r.path + '#x'],
      ['upper', r.path.toUpperCase()],
      ['extra', r.path + '/extra'],
      ['version', r.path.replace('/v1/', '/v2/')],
      ['prefix', '/prefix' + r.path],
    ] as const)
      it(r.label + ' unmatched ' + name, async () => {
        const f = fixture(r);
        error(await f.dispatch({ pathname }), 404, 'not_found', 'Route not found');
        expect(f.call).not.toHaveBeenCalled();
      });
    for (const part of ['scopes', 'fields', 'anchors'] as const)
      it(r.label + ' Q getter error precedes late method ' + part, async () => {
        const f = fixture(r);
        const fail = () => {
          throw new DomainError('conflict', part);
        };
        if (part === 'anchors') vi.spyOn(f.scopeAnchors, 'get').mockImplementation(fail);
        else property(required(f.permissions.get(r.cap)), part, fail);
        const method = vi.fn(() => {
          throw new Error('too early');
        });
        property(f.repository, r.method, method);
        error(await f.dispatch(), 409, 'conflict', part);
        expect(method).not.toHaveBeenCalled();
      });
    it(r.label + ' late second root/method captured before actor swaps dependency', async () => {
      const f = fixture(r);
      const replacement = { ...f.repository };
      const log: string[] = [];
      let roots = 0;
      property(f.dependencies, 'quality', () => {
        roots++;
        log.push('root' + String(roots));
        return roots === 1 ? {} : replacement;
      });
      property(replacement, r.method, () => {
        log.push('method');
        return f.call;
      });
      property(f.context, 'actor', () => {
        log.push('actor');
        Object.defineProperty(f.dependencies, 'quality', { configurable: true, value: {} });
        return actor;
      });
      f.call.mockImplementation(function (this: unknown) {
        expect(this).toBe(replacement);
        return Promise.resolve(r.kind === 'list' ? f.output : f.returned);
      });
      expect((await f.dispatch()).statusCode).toBe(r.kind === 'list' ? 200 : 201);
      expect(log).toEqual(['root1', 'root2', 'method', 'actor']);
    });
    for (const code of ['forbidden', 'not_found', 'conflict', 'invalid_request'] as const)
      it(r.label + ' repository DomainError ' + code, async () => {
        const f = fixture(r);
        f.call.mockRejectedValue(new DomainError(code, 'opaque'));
        error(
          await f.dispatch(),
          { forbidden: 403, not_found: 404, conflict: 409, invalid_request: 400 }[code],
          code,
          'opaque',
        );
      });
    it(r.label + ' repository ordinary rejection and outer spread error', async () => {
      const f = fixture(r);
      f.call.mockRejectedValue(new Error('hidden'));
      error(await f.dispatch(), 500, 'internal_error', 'Internal server error');
      const request: ApiRequest = { method: 'GET', pathname: r.path, headers: f.headers };
      property(request, 'body', () => {
        throw new DomainError('conflict', 'spread');
      });
      await expect(f.app.dispatch(request)).rejects.toThrow('spread');
    });
  }
  for (const pathname of ['__proto__', 'constructor', 'toString', 'valueOf', 'hasOwnProperty'])
    for (const method of ['GET', 'POST'])
      it('ordinary lookup inherited truthiness ' + pathname + '/' + method, async () => {
        const f = fixture(required(lists[0]));
        const response = await f.dispatch({ pathname, method });
        if (method === 'GET') error(response, 500, 'internal_error', 'Internal server error');
        else error(response, 404, 'not_found', 'Route not found');
        expect(f.call).not.toHaveBeenCalled();
      });
  for (const r of raw)
    for (const bad of ['a', '-', '--', 'dead-beef'])
      it(r.label + ' raw lowerhex matches but UUID fails ' + bad, async () => {
        const f = fixture(r);
        invalid(
          await f.dispatch({ pathname: r.path.replace(id, bad) }),
          (r.kind === 'publish' ? 'planVersionId' : 'inspectionId') + ' must be a UUID',
        );
        expect(f.call).not.toHaveBeenCalled();
      });
  for (const r of raw)
    for (const bad of ['', id.toUpperCase(), 'g', '%61', 'a_b', 'a.b'])
      it(r.label + ' raw regex rejects ' + JSON.stringify(bad), async () => {
        const f = fixture(r);
        error(
          await f.dispatch({ pathname: r.path.replace(id, bad) }),
          404,
          'not_found',
          'Route not found',
        );
        expect(f.call).not.toHaveBeenCalled();
      });
});

type Field = Readonly<{
  name: string;
  parser:
    | 'stable'
    | 'string'
    | 'uuid'
    | 'timestamp'
    | 'decimal'
    | 'object'
    | 'array'
    | 'stage'
    | 'boolean';
  optional?: boolean;
  nonnegative?: boolean;
}>;
function fieldsFor(r: Row): readonly Field[] {
  if (r.kind === 'create')
    return [
      { name: 'code', parser: 'stable' },
      { name: 'name', parser: 'string' },
      { name: 'itemVersionId', parser: 'uuid' },
      { name: 'inspectionStage', parser: 'stage' },
      { name: 'samplingMethod', parser: 'string' },
      { name: 'acceptanceRule', parser: 'object' },
      { name: 'effectiveAt', parser: 'timestamp' },
      { name: 'characteristics', parser: 'array' },
      { name: 'publish', parser: 'boolean' },
    ];
  if (r.kind === 'open')
    return [
      { name: 'inspectionNumber', parser: 'stable' },
      { name: 'planVersionId', parser: 'uuid' },
      { name: 'lotId', parser: 'uuid' },
      { name: 'sourceType', parser: 'stable' },
      { name: 'sourceId', parser: 'uuid' },
      { name: 'sampleSize', parser: 'decimal', nonnegative: true },
    ];
  if (r.kind === 'result')
    return [
      { name: 'characteristicId', parser: 'uuid' },
      { name: 'measuredNumeric', parser: 'decimal', optional: true },
      { name: 'measuredBoolean', parser: 'boolean', optional: true },
      { name: 'measuredText', parser: 'string', optional: true },
      { name: 'passed', parser: 'boolean' },
      { name: 'notes', parser: 'string' },
      { name: 'occurredAt', parser: 'timestamp' },
      { name: 'idempotencyKey', parser: 'stable' },
    ];
  return [
    { name: 'reason', parser: 'string' },
    { name: 'evidence', parser: 'object', optional: true },
    { name: 'idempotencyKey', parser: 'stable' },
  ];
}
function badValues(field: Field): readonly unknown[] {
  const common = [null, 0, false, [], {}];
  if (field.parser === 'boolean') return [undefined, null, 0, 1, 'true', {}, []];
  if (field.parser === 'object') return [undefined, 0, false, '', []];
  if (field.parser === 'array') return [undefined, null, 0, false, '', {}];
  if (field.parser === 'stage') return [undefined, '', 'final', 'FINAL_X', ...common];
  if (field.parser === 'uuid')
    return [
      undefined,
      '',
      'a',
      id.slice(0, -1),
      id.replace('4aaa', '0aaa'),
      id.replace('8aaa', '7aaa'),
      ...common,
    ];
  if (field.parser === 'decimal')
    return [
      undefined,
      '',
      'NaN',
      '1e2',
      '+1',
      '01',
      '1.0000001',
      '9999999999999999999',
      ...(field.nonnegative ? ['-1'] : []),
      ...common,
    ];
  if (field.parser === 'timestamp') return [undefined, '', 'not-time', ...common];
  if (field.parser === 'stable')
    return [undefined, '', 'lower', 'A B', '1A', 'A'.repeat(65), ...common];
  return [undefined, '', '   ', ...common];
}
describe('fixed old quality body/parsers and first-error ordering', () => {
  for (const r of bodies)
    it(r.label + ' method is captured before input getter replaces root', async () => {
      const f = fixture(r),
        key =
          r.kind === 'create'
            ? 'code'
            : r.kind === 'open'
              ? 'inspectionNumber'
              : r.kind === 'result'
                ? 'characteristicId'
                : 'reason';
      const v = f.body[key];
      const other = {
        ...f.repository,
        [r.method]: vi.fn<Call>().mockRejectedValue(new Error('replacement')),
      };
      property(f.body, key, () => {
        f.dependencies.quality = other as unknown as Repository;
        return v;
      });
      expect((await f.dispatch()).statusCode).toBe(201);
      expect(f.call).toHaveBeenCalledTimes(1);
      expect(other[r.method]).not.toHaveBeenCalled();
    });
  for (const r of bodies)
    for (const field of fieldsFor(r).filter((f) => f.parser === 'stable'))
      it(r.label + '/' + field.name + '/64 stable uppercase boundary', async () => {
        const f = fixture(r);
        f.body[field.name] = 'A'.repeat(64);
        expect((await f.dispatch()).statusCode).toBe(201);
        expect(input(f, r)[field.name]).toBe('A'.repeat(64));
      });
  for (const r of bodies)
    for (const field of fieldsFor(r).filter((f) => f.parser === 'timestamp'))
      for (const [value, expected] of [
        ['2026-08-01', '2026-08-01T00:00:00.000Z'],
        ['2026-08-01T01:00:00Z', '2026-08-01T01:00:00.000Z'],
      ] as const)
        it(r.label + '/' + field.name + '/old Date normalization ' + value, async () => {
          const f = fixture(r);
          f.body[field.name] = value;
          expect((await f.dispatch()).statusCode).toBe(201);
          expect(input(f, r)[field.name]).toBe(expected);
        });
  for (const value of [{}, new Date(0)])
    it(
      'plan acceptanceRule is shallow and does not invent semantic requirements ' +
        JSON.stringify(value),
      async () => {
        const r = required(create),
          f = fixture(r);
        f.body.acceptanceRule = value;
        expect((await f.dispatch()).statusCode).toBe(201);
        expect(input(f, r).acceptanceRule).toBe(value);
      },
    );
  for (const r of bodies) {
    for (const value of [undefined, null, [], 17, 'text', false])
      it(r.label + ' O before Q ' + JSON.stringify(value), async () => {
        const f = fixture(r);
        f.permissions.delete(r.cap);
        error(
          await f.dispatch({ body: value }),
          400,
          'invalid_request',
          'A JSON object body is required',
        );
      });
    it(r.label + ' allow sorted own unknown keys before Q', async () => {
      const f = fixture(r);
      f.permissions.delete(r.cap);
      f.body.z = 1;
      f.body.a = 2;
      invalid(await f.dispatch(), 'Unsupported fields: a, z');
    });
    it(
      r.label + ' ownkeys requested field grants; prototype/symbol do not widen requested fields',
      async () => {
        const f = fixture(r);
        f.permissions.set(r.cap, { scopes: f.scopes, fields: [] });
        error(await f.dispatch(), 403, 'forbidden', 'Field permission denied');
        f.permissions.set(r.cap, { scopes: f.scopes, fields: Object.keys(f.body) });
        const inherited = Object.create({ ...f.body, unknown: true }) as Record<string, unknown>;
        inherited[Symbol('ignored') as unknown as string] = true;
        expect((await f.dispatch({ body: inherited })).statusCode).toBe(201);
        expect(f.call).toHaveBeenCalledTimes(1);
      },
    );
    for (const field of fieldsFor(r)) {
      badValues(field).forEach((value, index) => {
        if (field.optional && value === undefined) return;
        if (field.name === 'evidence' && value === null) return;
        it(r.label + '/' + field.name + '/invalid ' + String(index), async () => {
          const f = fixture(r);
          f.body[field.name] = value;
          invalid(await f.dispatch());
          expect(f.call).not.toHaveBeenCalled();
        });
      });
      if (field.parser === 'uuid')
        for (const value of [id.toUpperCase(), ' ' + id + ' '])
          it(r.label + '/' + field.name + '/UUID case trim ' + value, async () => {
            const f = fixture(r);
            f.body[field.name] = value;
            expect((await f.dispatch()).statusCode).toBe(201);
            expect(input(f, r)[field.name]).toBe(value.trim());
          });
      if (field.parser === 'decimal')
        for (const [value, expected] of [
          ['0', '0'],
          ['-0.000000', '0'],
          ['1.200000', '1.2'],
          [' 2.500000 ', '2.5'],
          ['999999999999999999', '999999999999999999'],
          ...(!field.nonnegative ? [['-1.250000', '-1.25']] : []),
        ] as const)
          it(r.label + '/' + field.name + '/decimal ' + value, async () => {
            const f = fixture(r);
            f.body[field.name] = value;
            expect((await f.dispatch()).statusCode).toBe(201);
            expect(input(f, r)[field.name]).toBe(expected);
          });
    }
    it(
      r.label + ' late method getter precedes input, undefined method does not preempt bad input',
      async () => {
        const f = fixture(r);
        const badField =
          r.kind === 'create'
            ? 'code'
            : r.kind === 'open'
              ? 'inspectionNumber'
              : r.kind === 'result'
                ? 'characteristicId'
                : 'reason';
        f.body[badField] = undefined;
        property(f.repository, r.method, () => {
          throw new DomainError('conflict', 'method');
        });
        error(await f.dispatch(), 409, 'conflict', 'method');
        property(f.repository, r.method, () => undefined);
        invalid(await f.dispatch());
        f.body[badField] = bodyFor(r)[badField];
        error(await f.dispatch(), 500, 'internal_error', 'Internal server error');
      },
    );
    it(r.label + ' ordinary unknown getters are not read by allow or ownkeys Q', async () => {
      const f = fixture(r);
      property(f.body, 'z', () => {
        throw new Error('not read');
      });
      invalid(await f.dispatch(), 'Unsupported fields: z');
    });
  }
  for (const r of raw)
    it(
      r.label + ' active method getter before path UUID but undefined method evaluates path first',
      async () => {
        const f = fixture(r);
        property(f.repository, r.method, () => {
          throw new DomainError('conflict', 'method');
        });
        error(await f.dispatch({ pathname: r.path.replace(id, 'a') }), 409, 'conflict', 'method');
        property(f.repository, r.method, () => undefined);
        invalid(await f.dispatch({ pathname: r.path.replace(id, 'a') }));
      },
    );
  for (const value of [undefined, null, [], {}, false, 17, 'ignored', new Date(0)])
    it('publish ignores body rather than O/allow ' + JSON.stringify(value), async () => {
      const r = required(rows.find((r) => r.kind === 'publish'));
      const f = fixture(r);
      f.permissions.set(r.cap, { scopes: f.scopes, fields: [] });
      expect((await f.dispatch({ body: value })).statusCode).toBe(201);
    });
  for (const r of commands)
    for (const value of [undefined, null, {}, new Date(0)])
      it(r.label + ' evidence nullish default/shallow ' + JSON.stringify(value), async () => {
        const f = fixture(r);
        f.body.evidence = value;
        expect((await f.dispatch()).statusCode).toBe(201);
        const evidence = input(f, r).evidence;
        if (value === null || value === undefined) expect(evidence).toEqual({});
        else expect(evidence).toBe(value);
      });
  for (const r of writes.filter((r) => r.kind !== 'publish'))
    it(r.label + ' body idempotency key is independent of header', async () => {
      const f = fixture(r);
      expect(
        (
          await f.dispatch({
            headers: { authorization: f.headers.authorization, 'x-correlation-id': correlationId },
          })
        ).statusCode,
      ).toBe(201);
      if (r.kind === 'result' || r.kind === 'transition' || r.kind === 'dispose')
        expect(input(f, r).idempotencyKey).toBe('BODY_KEY');
    });
  for (const value of [undefined, null, '', '   '])
    it('result notes nullish empty still rejected ' + JSON.stringify(value), async () => {
      const r = required(result),
        f = fixture(r);
      f.body.notes = value;
      invalid(await f.dispatch(), 'notes is required');
    });
  for (const field of ['passed', 'measuredBoolean'])
    it('result ' + field + ' invalid before missing Q, passed before measuredBoolean', async () => {
      const r = required(result),
        f = fixture(r);
      f.permissions.delete(r.cap);
      f.body[field] = 'bad';
      invalid(await f.dispatch(), field + ' must be boolean');
      if (field === 'passed') {
        property(f.body, 'measuredBoolean', () => {
          throw new Error('later');
        });
        invalid(await f.dispatch(), 'passed must be boolean');
      }
    });
  for (const field of ['inspectionStage', 'characteristics', 'publish'])
    it('plan ' + field + ' stays after Q but before late method', async () => {
      const r = required(create),
        f = fixture(r);
      f.body[field] = undefined;
      property(f.repository, r.method, () => {
        throw new Error('method later');
      });
      invalid(await f.dispatch());
      f.permissions.delete(r.cap);
      error(await f.dispatch(), 403, 'forbidden', 'Permission denied');
    });
  for (const stage of ['INCOMING', 'IN_PROCESS', 'FINAL'])
    it('plan stage ' + stage, async () => {
      const r = required(create),
        f = fixture(r);
      f.body.inspectionStage = stage;
      expect((await f.dispatch()).statusCode).toBe(201);
      expect(input(f, r).inspectionStage).toBe(stage);
    });
  for (const publish of [true, false])
    it('plan required publish boolean ' + String(publish), async () => {
      const r = required(create),
        f = fixture(r);
      f.body.publish = publish;
      expect((await f.dispatch()).statusCode).toBe(201);
      expect(input(f, r).publish).toBe(publish);
    });
});

describe('fixed old quality characteristic map and observable getter reads', () => {
  it('undefined characteristic optionals read once; stage/dataType stay cached once', async () => {
    const r = required(create),
      f = fixture(r),
      item: Record<string, unknown> = characteristic(),
      counts = { unitCode: 0, lowerLimit: 0, upperLimit: 0, stage: 0, dataType: 0 };
    for (const key of ['unitCode', 'lowerLimit', 'upperLimit'] as const)
      property(item, key, () => {
        counts[key]++;
        return undefined;
      });
    property(item, 'dataType', () => {
      counts.dataType++;
      return 'TEXT';
    });
    property(f.body, 'inspectionStage', () => {
      counts.stage++;
      return 'INCOMING';
    });
    f.body.characteristics = [item];
    expect((await f.dispatch()).statusCode).toBe(201);
    expect(counts).toEqual({ unitCode: 1, lowerLimit: 1, upperLimit: 1, stage: 1, dataType: 1 });
    const actual = record((input(f, r).characteristics as unknown[])[0]);
    for (const key of ['unitCode', 'lowerLimit', 'upperLimit'])
      expect(actual).not.toHaveProperty(key);
  });
  it('plan characteristic getter swaps root before method capture', async () => {
    const r = required(create),
      f = fixture(r),
      replacement = { ...f.repository, createPlan: vi.fn<Call>().mockResolvedValue(f.returned) },
      item: Record<string, unknown> = characteristic();
    property(item, 'instructions', () => {
      f.dependencies.quality = replacement as unknown as Repository;
      return 'Measure';
    });
    f.body.characteristics = [item];
    expect((await f.dispatch()).statusCode).toBe(201);
    expect(replacement.createPlan).toHaveBeenCalledTimes(1);
    expect(f.call).not.toHaveBeenCalled();
  });
  it('result undefined optional values are omitted, measuredBoolean inspected twice total', async () => {
    const r = required(result),
      f = fixture(r),
      counts = { measuredNumeric: 0, measuredBoolean: 0, measuredText: 0 };
    for (const key of ['measuredNumeric', 'measuredBoolean', 'measuredText'] as const)
      property(f.body, key, () => {
        counts[key]++;
        return undefined;
      });
    f.body.passed = false;
    expect((await f.dispatch()).statusCode).toBe(201);
    expect(counts).toEqual({ measuredNumeric: 1, measuredBoolean: 2, measuredText: 1 });
    for (const key of Object.keys(counts)) expect(input(f, r)).not.toHaveProperty(key);
    expect(input(f, r).passed).toBe(false);
  });
  const rowFields: readonly Field[] = [
    { name: 'code', parser: 'stable' },
    { name: 'name', parser: 'string' },
    { name: 'unitCode', parser: 'string', optional: true },
    { name: 'lowerLimit', parser: 'decimal', optional: true },
    { name: 'upperLimit', parser: 'decimal', optional: true },
    { name: 'required', parser: 'boolean' },
    { name: 'instructions', parser: 'string' },
  ];
  for (const field of rowFields)
    badValues(field).forEach((value, index) => {
      if (field.optional && value === undefined) return;
      it('characteristic ' + field.name + '/invalid ' + String(index), async () => {
        const r = required(create),
          f = fixture(r),
          item: Record<string, unknown> = characteristic();
        item[field.name] = value;
        f.body.characteristics = [item];
        invalid(await f.dispatch());
      });
    });
  for (const dataType of ['NUMERIC', 'BOOLEAN', 'TEXT', 'NUMERIC_X', 'numeric', null, undefined])
    it('characteristic dataType ' + JSON.stringify(dataType), async () => {
      const r = required(create),
        f = fixture(r),
        item: Record<string, unknown> = characteristic();
      item.dataType = dataType;
      f.body.characteristics = [item];
      const response = await f.dispatch();
      if (typeof dataType === 'string' && ['NUMERIC', 'BOOLEAN', 'TEXT'].includes(dataType)) {
        expect(response.statusCode).toBe(201);
        expect(record((input(f, r).characteristics as unknown[])[0]).dataType).toBe(dataType);
      } else invalid(response);
    });
  for (const value of [null, undefined, 17, [], false])
    it('characteristic O ' + JSON.stringify(value), async () => {
      const r = required(create),
        f = fixture(r);
      f.body.characteristics = [value];
      invalid(await f.dispatch(), 'A JSON object body is required');
    });
  it('characteristic allow/enum/required happen before code and before repository', async () => {
    const r = required(create),
      f = fixture(r),
      item: Record<string, unknown> = characteristic();
    f.body.characteristics = [item];
    property(item, 'code', () => {
      throw new Error('code later');
    });
    item.unknown = 1;
    invalid(await f.dispatch(), 'Unsupported fields: unknown');
    delete item.unknown;
    item.dataType = 'BAD';
    invalid(await f.dispatch(), 'characteristic dataType is unsupported');
    item.dataType = 'TEXT';
    item.required = undefined;
    invalid(await f.dispatch(), 'characteristic required must be boolean');
  });
  it('empty characteristics accepted; native map preserves holes and inherited index, returns fresh row', async () => {
    const r = required(create),
      f = fixture(r);
    f.body.characteristics = [];
    expect((await f.dispatch()).statusCode).toBe(201);
    expect(input(f, r).characteristics).toEqual([]);
    f.call.mockClear();
    const values = new Array<unknown>(3),
      inherited = characteristic(),
      own = characteristic(),
      proto = Object.create(Array.prototype) as object;
    Object.defineProperty(proto, '1', { value: inherited });
    Object.setPrototypeOf(values, proto);
    values[2] = own;
    f.body.characteristics = values;
    expect((await f.dispatch()).statusCode).toBe(201);
    const output = input(f, r).characteristics as unknown[];
    expect(output).toHaveLength(3);
    expect(0 in output).toBe(false);
    expect(output[1]).toEqual(
      record(expectedInput(r, f.body)).characteristics instanceof Array
        ? (record(expectedInput(r, f.body)).characteristics as unknown[])[0]
        : undefined,
    );
    expect(output[2]).not.toBe(own);
  });
  it('map is completed before late method and top fields; required/publish read twice, optionals twice', async () => {
    const r = required(create),
      f = fixture(r),
      item: Record<string, unknown> = characteristic(),
      log: string[] = [];
    f.body.characteristics = [item];
    for (const key of [
      'dataType',
      'required',
      'code',
      'name',
      'unitCode',
      'lowerLimit',
      'upperLimit',
      'instructions',
    ]) {
      const v = item[key];
      property(item, key, () => {
        log.push(key);
        return v;
      });
    }
    property(f.body, 'publish', () => {
      log.push('publish');
      return false;
    });
    property(f.body, 'code', () => {
      log.push('topcode');
      return 'PLAN';
    });
    property(f.repository, 'createPlan', () => {
      log.push('method');
      return f.call;
    });
    expect((await f.dispatch()).statusCode).toBe(201);
    expect(log).toEqual([
      'dataType',
      'required',
      'code',
      'name',
      'unitCode',
      'unitCode',
      'lowerLimit',
      'lowerLimit',
      'upperLimit',
      'upperLimit',
      'required',
      'instructions',
      'publish',
      'method',
      'topcode',
      'publish',
    ]);
  });
  it('required/publish second reads are raw observable values, not cached booleans', async () => {
    const r = required(create),
      f = fixture(r),
      item: Record<string, unknown> = characteristic();
    f.body.characteristics = [item];
    let a = 0,
      b = 0;
    property(item, 'required', () => (++a === 1 ? false : 'opaque second'));
    property(f.body, 'publish', () => (++b === 1 ? true : 'opaque publish'));
    expect((await f.dispatch()).statusCode).toBe(201);
    expect(record((input(f, r).characteristics as unknown[])[0]).required).toBe('opaque second');
    expect(input(f, r).publish).toBe('opaque publish');
  });
  it('map retains native length snapshot and skips deleted future index', async () => {
    const r = required(create),
      f = fixture(r),
      items: unknown[] = [characteristic(), characteristic()];
    const first = required(items[0]);
    property(items, '0', () => {
      items.push(characteristic());
      Reflect.deleteProperty(items, '1');
      return first;
    });
    f.body.characteristics = items;
    expect((await f.dispatch()).statusCode).toBe(201);
    const actual = input(f, r).characteristics as unknown[];
    expect(actual).toHaveLength(2);
    expect(1 in actual).toBe(false);
  });
  it('result passed/measuredBoolean checks and optionals repeat raw getters in original order', async () => {
    const r = required(result),
      f = fixture(r),
      log: string[] = [];
    for (const key of [
      'passed',
      'measuredBoolean',
      'characteristicId',
      'measuredNumeric',
      'measuredText',
      'notes',
      'occurredAt',
      'idempotencyKey',
    ]) {
      const v = f.body[key];
      property(f.body, key, () => {
        log.push(key);
        return v;
      });
    }
    property(f.repository, 'recordResult', () => {
      log.push('method');
      return f.call;
    });
    expect((await f.dispatch()).statusCode).toBe(201);
    expect(log).toEqual([
      'passed',
      'measuredBoolean',
      'measuredBoolean',
      'method',
      'characteristicId',
      'measuredNumeric',
      'measuredNumeric',
      'measuredBoolean',
      'measuredBoolean',
      'measuredText',
      'measuredText',
      'passed',
      'notes',
      'occurredAt',
      'idempotencyKey',
    ]);
  });
  it('result second passed and fourth measuredBoolean reads are not recast/rechecked', async () => {
    const r = required(result),
      f = fixture(r);
    let passed = 0,
      measured = 0;
    property(f.body, 'passed', () => (++passed === 1 ? true : 'opaque passed'));
    property(f.body, 'measuredBoolean', () => (++measured < 4 ? false : 'opaque measured'));
    expect((await f.dispatch()).statusCode).toBe(201);
    expect(input(f, r).passed).toBe('opaque passed');
    expect(input(f, r).measuredBoolean).toBe('opaque measured');
  });
  for (const r of bodies)
    it(r.label + ' own body field getters evaluate in original input order', async () => {
      const f = fixture(r),
        field =
          r.kind === 'create'
            ? 'code'
            : r.kind === 'open'
              ? 'inspectionNumber'
              : r.kind === 'result'
                ? 'characteristicId'
                : 'reason';
      property(f.body, field, () => {
        throw new DomainError('conflict', 'body getter');
      });
      error(await f.dispatch(), 409, 'conflict', 'body getter');
      expect(f.call).not.toHaveBeenCalled();
    });
});

describe('fixed old quality late response projection/refs/error contracts', () => {
  for (const r of rows) {
    for (const fields of [null, [], ['name'], ['nested'], ['unknown']] as const)
      it(r.label + ' fields ' + JSON.stringify(fields), async () => {
        const f = fixture(r);
        f.call.mockImplementation(() => {
          f.permissions.set(r.read, { scopes: [], fields });
          return Promise.resolve(r.kind === 'list' ? f.output : f.returned);
        });
        const response = await f.dispatch();
        expect(response.statusCode).toBe(r.kind === 'list' ? 200 : 201);
        const actual =
          r.kind === 'list' ? (record(response.body).items as unknown[]) : [response.body];
        const expected =
          fields === null
            ? f.returned
            : {
                id,
                ...(fields.some((k) => k === 'name') ? { name: 'Visible' } : {}),
                ...(fields.some((k) => k === 'nested') ? { nested: f.nested } : {}),
              };
        expect(actual[0]).toEqual(expected);
        if (fields === null) expect(actual[0]).toBe(f.returned);
        if (fields?.some((k) => k === 'nested')) expect(record(actual[0]).nested).toBe(f.nested);
      });
    it(
      r.label + ' missing late read is list-null allow vs mutation id/version fallback',
      async () => {
        const f = fixture(r);
        f.call.mockImplementation(() => {
          f.permissions.delete(r.read);
          return Promise.resolve(r.kind === 'list' ? f.output : f.returned);
        });
        const response = await f.dispatch();
        if (r.kind === 'list')
          expect((record(response.body).items as unknown[])[0]).toBe(f.returned);
        else expect(response.body).toEqual({ id, version: 7 });
      },
    );
    it(r.label + ' await barrier re-reads response fields after captured scope refs', async () => {
      const f = fixture(r),
        pending = deferred<unknown>(),
        entered = deferred<undefined>();
      f.call.mockImplementation(() => {
        entered.resolve(undefined);
        return pending.promise;
      });
      const request = f.dispatch();
      await entered.promise;
      f.permissions.set(r.read, { scopes: [], fields: [] });
      pending.resolve(r.kind === 'list' ? f.output : f.returned);
      const response = await request;
      expect(
        r.kind === 'list' ? (record(response.body).items as unknown[])[0] : response.body,
      ).toEqual({ id });
      expect(record(required(f.call.mock.calls[0])[scopeIndex(r)]).scopes).toBe(f.scopes);
    });
    it(r.label + ' late Map.get receiver and error after repository', async () => {
      const f = fixture(r),
        original = f.permissions.get.bind(f.permissions);
      f.call.mockImplementation(() => {
        vi.spyOn(f.permissions, 'get').mockImplementation(function (this: unknown, cap) {
          expect(this).toBe(f.permissions);
          if (cap === r.read) throw new DomainError('conflict', 'late read');
          return original(cap);
        });
        return Promise.resolve(r.kind === 'list' ? f.output : f.returned);
      });
      error(await f.dispatch(), 409, 'conflict', 'late read');
      expect(f.call).toHaveBeenCalledTimes(1);
    });
    it(r.label + ' excluded own getter is eager, hidden/prototype fields not copied', async () => {
      const f = fixture(r),
        item = Object.create({ inherited: true }) as Record<string, unknown>;
      item.id = id;
      item.nested = f.nested;
      Object.defineProperty(item, 'hidden', { value: true });
      const getter = vi.fn(() => f.nested);
      property(item, 'excluded', getter);
      f.call.mockImplementation(() => {
        f.permissions.set(r.read, { scopes: [], fields: ['nested'] });
        return Promise.resolve(r.kind === 'list' ? [item] : item);
      });
      const response = await f.dispatch();
      expect(
        r.kind === 'list' ? (record(response.body).items as unknown[])[0] : response.body,
      ).toEqual({ id, nested: f.nested });
      expect(getter).toHaveBeenCalledTimes(1);
      property(item, 'excluded', () => {
        throw new DomainError('conflict', 'own getter');
      });
      f.permissions.set(r.read, { scopes: f.scopes, fields: ['nested'] });
      error(await f.dispatch(), 409, 'conflict', 'own getter');
    });
    for (const value of [null, undefined, 17])
      it(r.label + ' opaque response with null fields ' + JSON.stringify(value), async () => {
        const f = fixture(r);
        f.call.mockResolvedValue(r.kind === 'list' ? [value] : value);
        const response = await f.dispatch();
        expect(response.statusCode).toBe(r.kind === 'list' ? 200 : 201);
        expect(
          r.kind === 'list' ? (record(response.body).items as unknown[])[0] : response.body,
        ).toBe(value);
      });
  }
  for (const r of lists) {
    it(
      r.label + ' each row reads latest fields, map holes/inherited values preserved',
      async () => {
        const f = fixture(r),
          items = new Array<unknown>(3),
          proto = Object.create(Array.prototype) as object;
        Object.defineProperty(proto, '1', { value: f.returned });
        Object.setPrototypeOf(items, proto);
        items[2] = f.returned;
        let reads = 0;
        f.call.mockImplementation(() => {
          property(required(f.permissions.get(r.read)), 'fields', () =>
            ++reads === 1 ? [] : ['nested'],
          );
          return Promise.resolve(items);
        });
        const response = await f.dispatch(),
          actual = record(response.body).items as unknown[];
        expect(actual).toHaveLength(3);
        expect(0 in actual).toBe(false);
        expect(actual[1]).toEqual({ id });
        expect(actual[2]).toEqual({ id, nested: f.nested });
        expect(reads).toBe(2);
      },
    );
    it(
      r.label + ' empty list never reads response fields; malformed list uses native error',
      async () => {
        const f = fixture(r);
        f.call.mockImplementation(() => {
          property(required(f.permissions.get(r.read)), 'fields', () => {
            throw new Error('empty should skip');
          });
          return Promise.resolve([]);
        });
        expect(record((await f.dispatch()).body).items).toEqual([]);
        f.permissions.set(r.read, { scopes: f.scopes, fields: null });
        f.call.mockResolvedValue({ notArray: true });
        error(await f.dispatch(), 500, 'internal_error', 'Internal server error');
      },
    );
  }
});
