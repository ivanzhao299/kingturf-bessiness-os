// Fixed against 5323736 inline approve/reject; no future decisions module imported.
import { describe, expect, it, vi } from 'vitest';
import { DomainError, type AuthorizationContext } from '@kingturf/domain';
import type { DataScope, JsonObject, PermissionKey } from '@kingturf/types';
import { buildApp, type ApiDependencies, type ApiRequest } from '../src/app.js';
type Costs = NonNullable<ApiDependencies['productionCosts']>;
type Grant = NonNullable<ReturnType<AuthorizationContext['permissions']['get']>>;
const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const other = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const correlationId = '33333333-3333-4333-8333-333333333333';
const actor = { companyId: 'decision-mock-tenant', employeeId: id };
const nested = { retained: true };
const row: JsonObject = { id, version: 7, name: 'decision', secret: 'private', nested };
const root = '/api/v1/production-cost-runs';
const keys = ['reason', 'evidence', 'idempotencyKey'];
const actions = [
  { action: 'approve', state: 'APPROVED' },
  { action: 'reject', state: 'REJECTED' },
] as const;
const valid = () => ({ reason: ' Reviewed ', evidence: nested, idempotencyKey: ' BODY-KEY ' });
const parsed = () => ({ reason: 'Reviewed', evidence: nested, idempotencyKey: 'BODY-KEY' });
const repoResult = (value: JsonObject) => value as unknown as Awaited<ReturnType<Costs['decide']>>;
function fixture(
  action: string,
  options: {
    available?: boolean;
    denied?: boolean;
    scopes?: readonly DataScope[];
    fields?: Grant['fields'];
    readFields?: Grant['fields'];
    noRead?: boolean;
  } = {},
) {
  const scopes = options.scopes ?? ['TEAM'];
  const anchors = [{ scope: 'TEAM', organizationId: other }] as const;
  const permissions = new Map<PermissionKey, Grant>(
    ['manufacturing-cost:approve', 'manufacturing-cost:calculate', 'manufacturing-cost:policy'].map(
      (cap) => [
        cap as PermissionKey,
        { scopes, fields: options.fields === undefined ? null : options.fields },
      ],
    ),
  );
  if (options.denied) permissions.delete('manufacturing-cost:approve');
  if (!options.noRead)
    permissions.set('manufacturing-cost:read', {
      scopes: [],
      fields: options.readFields === undefined ? null : options.readFields,
    });
  const context: AuthorizationContext = {
    actor,
    permissions,
    scopeAnchors: new Map([['manufacturing-cost:approve', anchors]]),
  };
  const get = vi.spyOn(permissions, 'get');
  const decide = vi.fn<Costs['decide']>().mockResolvedValue(repoResult(row));
  const productionCosts = { decide };
  const authenticate = vi.fn().mockResolvedValue(context);
  const app = buildApp({
    auth: { authenticate } as unknown as ApiDependencies['auth'],
    organizations: {} as ApiDependencies['organizations'],
    employees: {} as ApiDependencies['employees'],
    ...(options.available === false
      ? {}
      : { productionCosts: productionCosts as unknown as Costs }),
  });
  const dispatch = (body: unknown = valid(), request: Partial<ApiRequest> = {}) =>
    app.dispatch({
      method: 'POST',
      pathname: root + '/' + id + '/' + action,
      body,
      ...request,
      headers: {
        authorization: 'Bearer fixture',
        'x-correlation-id': correlationId,
        ...request.headers,
      },
    });
  return {
    decide,
    productionCosts,
    authenticate,
    context,
    permissions,
    get,
    scopes,
    anchors,
    dispatch,
  };
}
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
const invalid = (message: string) => error(400, 'invalid_request', message);
const denied = error(403, 'forbidden', 'Permission denied');
const fieldDenied = error(403, 'forbidden', 'Field permission denied');
const missing = error(404, 'not_found', 'Route not found');
const codeError = 'Code must be 1-64 uppercase letters, digits, underscore, or hyphen';
const inputOf = (f: ReturnType<typeof fixture>, index = 0) => f.decide.mock.calls[index]?.[2];

for (const { action, state } of actions)
  describe('old cost decision ' + action, () => {
    it('five args/receiver/state/fresh input-scope/original references', async () => {
      const f = fixture(action);
      const first = await f.dispatch();
      expect(first).toEqual(response(201, row));
      expect(first.body).toBe(row);
      expect((await f.dispatch()).statusCode).toBe(201);
      expect(f.decide.mock.calls[0]).toEqual([
        id,
        state,
        parsed(),
        { actor, scopes: f.scopes, anchors: f.anchors },
        correlationId,
      ]);
      expect(f.decide.mock.calls[0]).toHaveLength(5);
      expect(f.decide.mock.contexts[0]).toBe(f.productionCosts);
      expect(Object.keys(inputOf(f) ?? {})).toEqual(keys);
      expect(inputOf(f)).not.toBe(inputOf(f, 1));
      const scope = f.decide.mock.calls[0]?.[3];
      expect(Object.keys(scope ?? {})).toEqual(['actor', 'scopes', 'anchors']);
      expect(scope?.actor).toBe(actor);
      expect(scope?.scopes).toBe(f.scopes);
      expect(scope?.anchors).toBe(f.anchors);
      expect(scope).not.toBe(f.decide.mock.calls[1]?.[3]);
      expect(
        f.get.mock.calls
          .filter(([cap]) => cap !== 'manufacturing-cost:read')
          .every(([cap]) => cap === 'manufacturing-cost:approve'),
      ).toBe(true);
    });
    it.each([null, undefined, [], '', 0, false])(
      'root %j before cap and invalid UUID',
      async (body) => {
        const f = fixture(action, { denied: true });
        expect(await f.dispatch(null, { body, pathname: root + '/bad/' + action })).toEqual(
          invalid('A JSON object body is required'),
        );
        expect(f.get).not.toHaveBeenCalled();
        expect(f.decide).not.toHaveBeenCalled();
      },
    );
    it('unknown sorted keys before auth/method/UUID/getters', async () => {
      const f = fixture(action, { denied: true });
      const getter = vi.fn(() => {
        throw new Error('not read');
      });
      Object.defineProperty(f.productionCosts, 'decide', { get: getter });
      const body = Object.defineProperty(
        { ...valid(), version: 1, state: 'OPEN', z: null, a: undefined },
        'reason',
        { enumerable: true, get: getter },
      );
      expect(await f.dispatch(body, { pathname: root + '/bad/' + action })).toEqual(
        invalid('Unsupported fields: a, state, version, z'),
      );
      expect(getter).not.toHaveBeenCalled();
      expect(f.get).not.toHaveBeenCalled();
    });
    it.each([{ denied: true }, { scopes: [] }, { fields: [] }, { fields: ['reason'] }])(
      'auth %j before method/UUID/value',
      async (options) => {
        const f = fixture(action, options);
        const getter = vi.fn(() => {
          throw new Error('not read');
        });
        Object.defineProperty(f.productionCosts, 'decide', { get: getter });
        const body = Object.defineProperty(valid(), 'reason', { enumerable: true, get: getter });
        expect(await f.dispatch(body, { pathname: root + '/bad/' + action })).toEqual(
          options.denied || options.scopes ? denied : fieldDenied,
        );
        expect(getter).not.toHaveBeenCalled();
      },
    );
    it.each([{ fields: null }, { fields: keys }])('legal fields %j', async (options) => {
      expect((await fixture(action, options).dispatch()).statusCode).toBe(201);
    });
    it('ownundefined optional evidence still requested', async () => {
      expect(
        await fixture(action, { fields: ['reason', 'idempotencyKey'] }).dispatch({
          ...valid(),
          evidence: undefined,
        }),
      ).toEqual(fieldDenied);
    });
    it('inherited/nonenumerable body values are read without own requested fields', async () => {
      const inherited = fixture(action, { fields: [] });
      expect(
        (await inherited.dispatch(Object.create(valid()) as Record<string, unknown>)).statusCode,
      ).toBe(201);
      const hidden = fixture(action, { fields: [] });
      const body: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(valid()))
        Object.defineProperty(body, key, { value, enumerable: false });
      expect((await hidden.dispatch(body)).statusCode).toBe(201);
      expect(inputOf(inherited)).toEqual(parsed());
      expect(inputOf(hidden)).toEqual(parsed());
    });
    it.each([null, undefined, [], { reason: 'bad' }])('missing repo skips %j', async (body) => {
      const f = fixture(action, { available: false, denied: true });
      expect(await f.dispatch(null, { body })).toEqual(missing);
      expect(f.get).not.toHaveBeenCalled();
    });
    it('missing repo ignores getter/global401 precedes everything', async () => {
      const f = fixture(action, { available: false, denied: true });
      const getter = vi.fn(() => {
        throw new Error('body');
      });
      const body = Object.defineProperty({}, 'reason', { enumerable: true, get: getter });
      expect(await f.dispatch(body)).toEqual(missing);
      f.authenticate.mockResolvedValueOnce(null);
      expect(await f.dispatch(body)).toEqual(
        error(401, 'authentication_required', 'A valid session is required'),
      );
      expect(getter).not.toHaveBeenCalled();
    });
    it.each(['GET', 'PATCH', 'PUT', 'DELETE', 'post'])('unsupported method %s', async (method) => {
      const f = fixture(action, { denied: true });
      expect(await f.dispatch(null, { method })).toEqual(missing);
      expect(f.get).not.toHaveBeenCalled();
    });
    it.each([
      root + '/' + id + '/',
      root + '/' + id + '/' + action + '/',
      root + '/' + id + '/' + action + '/extra',
      root + '//' + action,
      root + '/' + id.toUpperCase() + '/' + action,
      root + '/' + id + '/' + action.toUpperCase(),
      root + '/' + id + '/decide',
      root + '/not-a-uuid/' + action,
      root.replace('runs', 'Runs') + '/' + id + '/' + action,
    ])('unsupported raw path %s', async (pathname) => {
      const f = fixture(action, { denied: true });
      expect(await f.dispatch(null, { pathname })).toEqual(missing);
      expect(f.get).not.toHaveBeenCalled();
    });
    it.each([
      'bad',
      '-',
      id.replace('4aaa', '9aaa'),
      id.replace('8aaa', '7aaa'),
      '00000000-0000-0000-0000-000000000000',
    ])('raw matches but UUID %s fails before getters', async (value) => {
      const f = fixture(action);
      const method = vi.fn(() => f.decide);
      const getter = vi.fn(() => {
        throw new Error('value');
      });
      Object.defineProperty(f.productionCosts, 'decide', { get: method });
      const body = Object.defineProperty(valid(), 'reason', { enumerable: true, get: getter });
      expect(await f.dispatch(body, { pathname: root + '/' + value + '/' + action })).toEqual(
        invalid('costRunId must be a UUID'),
      );
      expect(method).toHaveBeenCalledOnce();
      expect(getter).not.toHaveBeenCalled();
      expect(f.decide).not.toHaveBeenCalled();
    });
    it('version8 UUID accepted, raw lowercase preserved', async () => {
      const f = fixture(action);
      const value = id.replace('4aaa', '8aaa');
      expect(
        (await f.dispatch(valid(), { pathname: root + '/' + value + '/' + action })).statusCode,
      ).toBe(201);
      expect(f.decide.mock.calls[0]?.[0]).toBe(value);
    });
    it('input getter replacement cannot change already captured method', async () => {
      const f = fixture(action);
      const replacement = vi.fn<Costs['decide']>().mockResolvedValue(repoResult({ id: 'new' }));
      const body = Object.defineProperty(valid(), 'reason', {
        enumerable: true,
        get: () => {
          f.productionCosts.decide = replacement;
          return 'Reviewed';
        },
      });
      expect(await f.dispatch(body)).toEqual(response(201, row));
      expect(f.decide).toHaveBeenCalledOnce();
      expect(f.decide.mock.contexts[0]).toBe(f.productionCosts);
      expect(replacement).not.toHaveBeenCalled();
    });
    it('method then three getters once then actor then call', async () => {
      const f = fixture(action);
      const events: string[] = [];
      const body: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(valid()))
        Object.defineProperty(body, key, {
          enumerable: true,
          get: () => {
            events.push(key);
            return value;
          },
        });
      Object.defineProperty(f.productionCosts, 'decide', {
        get: () => {
          events.push('method');
          return f.decide;
        },
      });
      Object.defineProperty(f.context, 'actor', {
        get: () => {
          events.push('actor');
          return actor;
        },
      });
      f.decide.mockImplementationOnce(() => {
        events.push('call');
        return Promise.resolve(repoResult(row));
      });
      expect((await f.dispatch(body)).statusCode).toBe(201);
      expect(events).toEqual(['method', ...keys, 'actor', 'call']);
    });
    const failures = [
      { key: 'reason', value: ' ', message: 'reason is required' },
      { key: 'evidence', value: [], message: 'evidence must be a JSON object' },
      { key: 'idempotencyKey', value: 'bad', message: codeError },
    ];
    it.each(failures)('$key before later failures/getters/actor', async (entry) => {
      const f = fixture(action);
      const index = failures.indexOf(entry);
      const values: Record<string, unknown> = valid();
      for (const later of failures.slice(index)) values[later.key] = later.value;
      const seen: string[] = [];
      const body: Record<string, unknown> = {};
      for (const key of keys)
        Object.defineProperty(body, key, {
          enumerable: true,
          get: () => {
            seen.push(key);
            return values[key];
          },
        });
      const actorGetter = vi.fn(() => actor);
      Object.defineProperty(f.context, 'actor', { get: actorGetter });
      expect(await f.dispatch(body)).toEqual(invalid(entry.message));
      expect(seen).toEqual(keys.slice(0, index + 1));
      expect(actorGetter).not.toHaveBeenCalled();
      expect(f.decide).not.toHaveBeenCalled();
    });
    for (const key of ['reason', 'idempotencyKey'])
      it.each([undefined, null, '', ' ', 0, false, [], {}])(
        'required string ' + key + ' %j',
        async (value) => {
          expect(await fixture(action).dispatch({ ...valid(), [key]: value })).toEqual(
            invalid(key + ' is required'),
          );
        },
      );
    it('reason trimmed but unbounded/non-code text allowed', async () => {
      const f = fixture(action);
      const value = 'lowercase / 审批 ' + 'x'.repeat(1000);
      expect((await f.dispatch({ ...valid(), reason: ' ' + value + ' ' })).statusCode).toBe(201);
      expect(inputOf(f)?.reason).toBe(value);
    });
    it.each(['a', '1ABC', 'A B', 'A/B', 'A'.repeat(65), 'A'.repeat(128), 'A'.repeat(200)])(
      'body stableCode %s invalid',
      async (value) => {
        expect(await fixture(action).dispatch({ ...valid(), idempotencyKey: value })).toEqual(
          invalid(codeError),
        );
      },
    );
    it.each(['A', 'A_1-B', 'A'.repeat(64)])('body stableCode %s trims', async (value) => {
      const f = fixture(action);
      expect((await f.dispatch({ ...valid(), idempotencyKey: ' ' + value + ' ' })).statusCode).toBe(
        201,
      );
      expect(inputOf(f)?.idempotencyKey).toBe(value);
    });
    it.each([{ value: undefined }, { value: null }])(
      'evidence nullish $value once/new defaults',
      async ({ value }) => {
        const f = fixture(action);
        const getter = vi.fn(() => value);
        const body = Object.defineProperty(valid(), 'evidence', { enumerable: true, get: getter });
        expect((await f.dispatch(body)).statusCode).toBe(201);
        expect((await f.dispatch(body)).statusCode).toBe(201);
        expect(getter).toHaveBeenCalledTimes(2);
        expect(inputOf(f)?.evidence).toEqual({});
        expect(inputOf(f)?.evidence).not.toBe(inputOf(f, 1)?.evidence);
        expect(Object.keys(inputOf(f) ?? {})).toEqual(keys);
      },
    );
    it('omitted evidence default and field set excludes omitted key', async () => {
      const f = fixture(action, { fields: ['reason', 'idempotencyKey'] });
      expect(
        (await f.dispatch({ reason: 'Reviewed', idempotencyKey: 'BODY-KEY' })).statusCode,
      ).toBe(201);
      expect(inputOf(f)?.evidence).toEqual({});
      expect(Object.keys(inputOf(f) ?? {})).toEqual(keys);
    });
    it.each([{ value: [] }, { value: '' }, { value: 0 }, { value: false }])(
      'evidence primitive/array $value rejected',
      async ({ value }) => {
        expect(await fixture(action).dispatch({ ...valid(), evidence: value })).toEqual(
          invalid('evidence must be a JSON object'),
        );
      },
    );
    it('evidence shallow opaque original reference, special own/inherited/nonenum values not traversed', async () => {
      const f = fixture(action);
      const getter = vi.fn(() => {
        throw new Error('no traversal');
      });
      const prototype = { inherited: true };
      const evidence = Object.create(prototype) as Record<string, unknown>;
      for (const key of ['__proto__', 'constructor', 'toString'])
        Object.defineProperty(evidence, key, { value: nested, enumerable: true });
      Object.defineProperty(evidence, 'hidden', { value: nested, enumerable: false });
      Object.defineProperty(evidence, 'extra', { enumerable: true, get: getter });
      expect((await f.dispatch({ ...valid(), evidence })).statusCode).toBe(201);
      expect(inputOf(f)?.evidence).toBe(evidence);
      expect(Object.getPrototypeOf(inputOf(f)?.evidence)).toBe(prototype);
      expect(Object.hasOwn(inputOf(f)?.evidence ?? {}, '__proto__')).toBe(true);
      expect(inputOf(f)?.evidence.__proto__).toBe(nested);
      expect(getter).not.toHaveBeenCalled();
    });
    it.each([undefined, '', 'DIFFERENT', 'x'.repeat(201)])(
      'header %s/query ignored',
      async (key) => {
        const f = fixture(action);
        const getter = vi.fn(() => {
          throw new Error('query');
        });
        expect(
          (
            await f.dispatch(valid(), {
              headers: { 'idempotency-key': key },
              query: Object.defineProperty({}, 'idempotencyKey', { enumerable: true, get: getter }),
            })
          ).statusCode,
        ).toBe(201);
        expect(inputOf(f)?.idempotencyKey).toBe('BODY-KEY');
        expect(getter).not.toHaveBeenCalled();
      },
    );
    it('no header fallback for missing body key', async () => {
      expect(
        await fixture(action).dispatch(
          { ...valid(), idempotencyKey: undefined },
          { headers: { 'idempotency-key': 'HEADER' } },
        ),
      ).toEqual(invalid('idempotencyKey is required'));
    });
    it('same key same/changed body and action each forward, no HTTP replay', async () => {
      const f = fixture(action);
      expect((await f.dispatch()).statusCode).toBe(201);
      expect((await f.dispatch()).statusCode).toBe(201);
      const opposite = action === 'approve' ? 'reject' : 'approve';
      expect(
        (
          await f.dispatch(
            { ...valid(), reason: 'Changed' },
            { pathname: root + '/' + id + '/' + opposite },
          )
        ).statusCode,
      ).toBe(201);
      expect(f.decide.mock.calls).toHaveLength(3);
      expect(f.decide.mock.calls[2]?.[1]).toBe(state === 'APPROVED' ? 'REJECTED' : 'APPROVED');
      expect(inputOf(f, 2)?.idempotencyKey).toBe(inputOf(f)?.idempotencyKey);
      expect(inputOf(f, 2)?.reason).toBe('Changed');
    });
    it.each(['SELF', 'TEAM', 'DEPARTMENT', 'REGION', 'COMPANY', 'GROUP'] as const)(
      'scope %s refs forwarded, no company/creator HTTP check',
      async (scope) => {
        const f = fixture(action, { scopes: [scope] });
        expect((await f.dispatch()).statusCode).toBe(201);
        expect(f.decide.mock.calls[0]?.[3].scopes).toBe(f.scopes);
        expect(f.decide.mock.calls[0]?.[3].anchors).toBe(f.anchors);
      },
    );
    it('no read allows write/id-version fallback', async () => {
      expect(await fixture(action, { noRead: true }).dispatch()).toEqual(
        response(201, { id, version: 7 }),
      );
    });
    it('real repo shaped no version payload not fabricated', async () => {
      const f = fixture(action, { noRead: true });
      f.decide.mockResolvedValueOnce(repoResult({ id, state, ...parsed() }));
      expect(await f.dispatch()).toEqual(response(201, { id }));
    });
    it.each([
      { fields: null, expected: row },
      { fields: [], expected: { id } },
      { fields: ['name'], expected: { id, name: 'decision' } },
      { fields: ['version', 'nested'], expected: { id, version: 7, nested } },
    ])('read $fields independent even empty scope', async ({ fields, expected }) => {
      const f = fixture(action, { fields: keys, readFields: fields });
      const result = await f.dispatch();
      expect(result).toEqual(response(201, expected));
      if (fields === null) expect(result.body).toBe(row);
      else expect(result.body).not.toBe(row);
      if (typeof result.body === 'object' && result.body !== null && 'nested' in result.body)
        expect(result.body.nested).toBe(nested);
    });
    it('late awaitMap read grant replace/delete/fields getter once', async () => {
      const f = fixture(action, { readFields: [] });
      const getter = vi.fn(() => ['name']);
      f.decide.mockImplementationOnce(() => {
        expect(f.get.mock.calls.some(([cap]) => cap === 'manufacturing-cost:read')).toBe(false);
        f.permissions.set('manufacturing-cost:read', {
          scopes: [],
          get fields() {
            return getter();
          },
        });
        return Promise.resolve(repoResult(row));
      });
      expect(await f.dispatch()).toEqual(response(201, { id, name: 'decision' }));
      expect(getter).toHaveBeenCalledOnce();
      const removed = fixture(action);
      removed.decide.mockImplementationOnce(() => {
        removed.permissions.delete('manufacturing-cost:read');
        return Promise.resolve(repoResult(row));
      });
      expect(await removed.dispatch()).toEqual(response(201, { id, version: 7 }));
    });
    it('null projection skips enumeration; finite eagerly reads excluded getter', async () => {
      const getter = vi.fn(() => 'secret');
      const result: JsonObject = {
        id,
        version: 7,
        get secret() {
          return getter();
        },
      };
      const raw = fixture(action);
      raw.decide.mockResolvedValueOnce(repoResult(result));
      expect((await raw.dispatch()).body).toBe(result);
      expect(getter).not.toHaveBeenCalled();
      const finite = fixture(action, { readFields: [] });
      finite.decide.mockResolvedValueOnce(repoResult(result));
      expect(await finite.dispatch()).toEqual(response(201, { id }));
      expect(getter).toHaveBeenCalledOnce();
    });
    it('special own keys/order/nested ref/no fabricated id', async () => {
      const result: JsonObject = Object.fromEntries<JsonObject[string]>([
        ['toString', 'data'],
        ['__proto__', nested],
        ['constructor', 'data'],
        ['version', 7],
      ]);
      const f = fixture(action, {
        readFields: ['version', '__proto__', 'constructor', 'toString'],
      });
      f.decide.mockResolvedValueOnce(repoResult(result));
      const created = await f.dispatch();
      expect(created).toEqual(response(201, result));
      expect(created.body).not.toBe(result);
      expect(Object.keys(created.body as object)).toEqual([
        'toString',
        '__proto__',
        'constructor',
        'version',
      ]);
      expect(Object.hasOwn(created.body as object, 'id')).toBe(false);
      expect(Object.getPrototypeOf(created.body)).toBe(Object.prototype);
      expect((created.body as JsonObject).__proto__).toBe(nested);
    });
    it.each([
      { code: 'conflict', status: 409 },
      { code: 'forbidden', status: 403 },
      { code: 'not_found', status: 404 },
      { code: 'invalid_request', status: 400 },
    ] as const)('repo $code/C/no early read', async ({ code, status }) => {
      const f = fixture(action);
      f.decide.mockRejectedValueOnce(new DomainError(code, 'original repository error'));
      expect(await f.dispatch()).toEqual(error(status, code, 'original repository error'));
      expect(f.get.mock.calls.some(([cap]) => cap === 'manufacturing-cost:read')).toBe(false);
    });
    it('policy/calculation/read/shipment neighbours do not use decide', async () => {
      const f = fixture(action);
      for (const pathname of ['/api/v1/production-cost-policies', root])
        expect(await f.dispatch(null, { pathname })).toEqual(
          invalid('A JSON object body is required'),
        );
      expect(await f.dispatch(null, { pathname: root, method: 'GET' })).toEqual(denied);
      expect(await f.dispatch(null, { pathname: '/api/v1/shipment-releases' })).toEqual(missing);
      expect(f.decide).not.toHaveBeenCalled();
    });
  });
