// Fixed against 7cc9d42 inline QTC credit writes; no future module imported.
import { describe, expect, it, vi } from 'vitest';
import { DomainError, type AuthorizationContext } from '@kingturf/domain';
import type { DataScope, JsonObject, PermissionKey } from '@kingturf/types';
import { buildApp, type ApiDependencies, type ApiRequest } from '../src/app.js';
type Qtc = NonNullable<ApiDependencies['quoteToCash']>;
type Method = Qtc['setCreditLimit'] | Qtc['evaluateCredit'];
type Grant = NonNullable<ReturnType<AuthorizationContext['permissions']['get']>>;
const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const other = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const correlationId = '33333333-3333-4333-8333-333333333333';
const actor = { companyId: 'qtc-credit-mock', employeeId: id };
const nested = { trace: true };
const resultRow: JsonObject = {
  id,
  version: 3,
  effectiveStatus: 'PENDING_APPROVAL',
  nested,
  secret: 'private',
};
const definitions = [
  {
    path: '/api/v1/credit-limits',
    capability: 'credit:approve',
    method: 'setCreditLimit',
    fields: [
      { key: 'customerId', kind: 'uuid', value: id, expected: id },
      { key: 'currency', kind: 'currency', value: ' CNY ', expected: 'CNY' },
      { key: 'amount', kind: 'decimal', value: ' 12.340000 ', expected: '12.34' },
      {
        key: 'effectiveAt',
        kind: 'timestamp',
        value: '2026-02-30',
        expected: '2026-03-02T00:00:00.000Z',
      },
      {
        key: 'expiresAt',
        kind: 'timestamp',
        value: '2026-01-01',
        expected: '2026-01-01T00:00:00.000Z',
      },
    ],
  },
  {
    path: '/api/v1/credit-decisions',
    capability: 'credit:evaluate',
    method: 'evaluateCredit',
    fields: [
      { key: 'customerId', kind: 'uuid', value: id, expected: id },
      { key: 'quoteRevisionId', kind: 'uuid', value: id, expected: id },
      { key: 'quoteSnapshotId', kind: 'uuid', value: other, expected: other },
      { key: 'creditLimitId', kind: 'uuid', value: id, expected: id },
      {
        key: 'validUntil',
        kind: 'timestamp',
        value: '2026-02-30',
        expected: '2026-03-02T00:00:00.000Z',
      },
    ],
  },
] as const;
type Definition = (typeof definitions)[number];
function fixture(
  route: Definition,
  options: {
    available?: boolean;
    denied?: boolean;
    scopes?: readonly DataScope[];
    writeFields?: Grant['fields'];
    read?: Grant | null;
  } = {},
) {
  const scopes = options.scopes ?? ['TEAM'];
  const anchors = [{ scope: 'TEAM', organizationId: other }] as const;
  const permissions = new Map<PermissionKey, Grant>([
    [
      route.capability,
      { scopes, fields: options.writeFields === undefined ? null : options.writeFields },
    ],
  ]);
  if (options.denied) permissions.delete(route.capability);
  if (options.read !== null)
    permissions.set('credit:read', options.read ?? { scopes: ['TEAM'], fields: null });
  const context: AuthorizationContext = {
    actor,
    permissions,
    scopeAnchors: new Map([[route.capability, anchors]]),
  };
  const get = vi.spyOn(permissions, 'get');
  const method = vi.fn<Method>().mockResolvedValue(resultRow);
  const approveCredit = vi.fn<Qtc['approveCredit']>().mockResolvedValue(resultRow);
  const list = vi.fn<Qtc['list']>().mockResolvedValue([]);
  const listOperationalPage = vi
    .fn<Qtc['listOperationalPage']>()
    .mockResolvedValue({ items: [], nextCursor: null });
  const repository = {
    setCreditLimit: method,
    evaluateCredit: method,
    approveCredit,
    list,
    listOperationalPage,
  };
  const authenticate = vi.fn().mockResolvedValue(context);
  const app = buildApp({
    auth: { authenticate } as unknown as ApiDependencies['auth'],
    organizations: {} as ApiDependencies['organizations'],
    employees: {} as ApiDependencies['employees'],
    ...(options.available === false ? {} : { quoteToCash: repository as unknown as Qtc }),
  });
  const body: Record<string, unknown> = Object.fromEntries(
    route.fields.map((field) => [field.key, field.value]),
  );
  const expected = Object.fromEntries(route.fields.map((field) => [field.key, field.expected]));
  const headers: Record<string, string | undefined> = {
    authorization: 'Bearer fixture',
    'x-correlation-id': correlationId,
    'idempotency-key': ' key untouched ',
  };
  const dispatch = (request: Partial<ApiRequest> = {}) =>
    app.dispatch({
      method: 'POST',
      pathname: route.path,
      body,
      ...request,
      headers: request.headers ?? headers,
    });
  return {
    body,
    expected,
    headers,
    method,
    repository,
    approveCredit,
    list,
    listOperationalPage,
    scopes,
    anchors,
    permissions,
    get,
    context,
    authenticate,
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
const missing = error(404, 'not_found', 'Route not found');
const denied = error(403, 'forbidden', 'Permission denied');
const keyError = invalid('Idempotency-Key is required');
for (const route of definitions)
  describe('old QTC credit POST ' + route.method, () => {
    it('four args/input key order/original receiver/scoped fresh refs/201 M', async () => {
      const f = fixture(route);
      const a = await f.dispatch(),
        b = await f.dispatch();
      expect(a).toEqual(response(201, resultRow));
      expect(b).toEqual(a);
      expect(a.body).toBe(resultRow);
      const call = f.method.mock.calls[0];
      expect(call).toEqual([
        f.expected,
        ' key untouched ',
        { actor, scopes: f.scopes, anchors: f.anchors },
        correlationId,
      ]);
      expect(call).toHaveLength(4);
      expect(f.method.mock.contexts[0]).toBe(f.repository);
      expect(Object.keys(call?.[0] ?? {})).toEqual(route.fields.map((field) => field.key));
      expect(Object.keys(call?.[2] ?? {})).toEqual(['actor', 'scopes', 'anchors']);
      expect(call?.[2].actor).toBe(actor);
      expect(call?.[2].scopes).toBe(f.scopes);
      expect(call?.[2].anchors).toBe(f.anchors);
      expect(call?.[0]).not.toBe(f.body);
      expect(call?.[0]).not.toBe(f.method.mock.calls[1]?.[0]);
      expect(call?.[2]).not.toBe(f.method.mock.calls[1]?.[2]);
      expect(f.get.mock.calls).toEqual([
        [route.capability],
        [route.capability],
        ['credit:read'],
        [route.capability],
        [route.capability],
        ['credit:read'],
      ]);
    });
    it.each([undefined, null, [], '', 0, false, 'json'].map((body) => ({ body })))(
      'root $body rejected before path/cap',
      async ({ body }) => {
        const f = fixture(route, { denied: true });
        for (const pathname of [route.path, '/api/v1/not-a-qtc-command'])
          expect(await f.dispatch({ pathname, body })).toEqual(
            invalid('A JSON object body is required'),
          );
        expect(f.get).not.toHaveBeenCalled();
        expect(f.method).not.toHaveBeenCalled();
      },
    );
    it('allow before method/fields/key/cap and unknown keys sorted', async () => {
      const f = fixture(route, { denied: true });
      const getter = vi.fn(() => {
        throw new Error('not reached');
      });
      Object.defineProperty(f.repository, route.method, { get: getter });
      Object.defineProperty(f.body, 'customerId', { enumerable: true, get: getter });
      expect(await f.dispatch({ body: { ...f.expected, z: 1, a: 2 } })).toEqual(
        invalid('Unsupported fields: a, z'),
      );
      expect(getter).not.toHaveBeenCalled();
      expect(f.get).not.toHaveBeenCalled();
    });
    for (const field of route.fields) {
      it.each([undefined, null, '', ' ', 0, false, 1, true, [], {}].map((value) => ({ value })))(
        'field ' + field.key + ' $value required before denied cap',
        async ({ value }) => {
          const f = fixture(route, { denied: true });
          expect(
            await f.dispatch({
              body: { ...f.body, [field.key]: value },
              headers: { ...f.headers, 'idempotency-key': '' },
            }),
          ).toEqual(invalid(field.key + ' is required'));
          expect(f.method).not.toHaveBeenCalled();
          expect(f.get).not.toHaveBeenCalled();
        },
      );
      it('missing ' + field.key + ' required before later invalids', async () => {
        const f = fixture(route);
        const body = { ...f.body };
        Reflect.deleteProperty(body, field.key);
        expect(await f.dispatch({ body })).toEqual(invalid(field.key + ' is required'));
      });
      const badValues =
        field.kind === 'uuid'
          ? ['bad', '00000000-0000-0000-0000-000000000000']
          : field.kind === 'currency'
            ? ['cny', 'CN', 'CNYY', '1NY']
            : field.kind === 'decimal'
              ? ['bad', '01', '1e2', '0.0000001', '1000000000000000000']
              : ['bad', '2026-13-01'];
      it.each(badValues)('field ' + field.key + ' invalid %s', async (value) => {
        const f = fixture(route, { denied: true });
        const message =
          field.kind === 'uuid'
            ? field.key + ' must be a UUID'
            : field.kind === 'currency'
              ? 'Currency must be ISO 4217 uppercase'
              : field.kind === 'decimal'
                ? 'Invalid decimal'
                : field.key + ' must be a valid timestamp';
        expect(await f.dispatch({ body: { ...f.body, [field.key]: value } })).toEqual(
          invalid(message),
        );
        expect(f.get).not.toHaveBeenCalled();
      });
      if (field.kind === 'uuid')
        it('uppercase/trim ' + field.key + ' preserved', async () => {
          const f = fixture(route),
            value = id.toUpperCase();
          expect(
            (await f.dispatch({ body: { ...f.body, [field.key]: ' ' + value + ' ' } })).statusCode,
          ).toBe(201);
          expect(f.method.mock.calls[0]?.[0]).toMatchObject({ [field.key]: value });
        });
      if (field.kind === 'timestamp')
        it('Date normalization/no new strict date ' + field.key, async () => {
          const f = fixture(route);
          expect(
            (await f.dispatch({ body: { ...f.body, [field.key]: '2026-02-30' } })).statusCode,
          ).toBe(201);
          expect(f.method.mock.calls[0]?.[0]).toMatchObject({
            [field.key]: '2026-03-02T00:00:00.000Z',
          });
        });
    }
    if (route.method === 'setCreditLimit') {
      it.each(['0', '-0.000000', '0.000001', '999999999999999999.999999'])(
        'amount %s old normalization accepted',
        async (amount) => {
          const f = fixture(route);
          expect((await f.dispatch({ body: { ...f.body, amount } })).statusCode).toBe(201);
          expect(f.method.mock.calls[0]?.[0]).toMatchObject({
            amount: amount === '-0.000000' ? '0' : amount,
          });
        },
      );
      it('negative amount rejected before key/cap; unknown uppercase currency accepted by HTTP', async () => {
        const f = fixture(route, { denied: true });
        expect(await f.dispatch({ body: { ...f.body, amount: '-1' } })).toEqual(
          invalid('amount must be non-negative'),
        );
        const ok = fixture(route);
        expect((await ok.dispatch({ body: { ...ok.body, currency: 'ZZZ' } })).statusCode).toBe(201);
      });
      it('effective after expires and normalized overflow forwarded, no HTTP range check', async () => {
        const f = fixture(route);
        expect((await f.dispatch()).statusCode).toBe(201);
        expect(f.method.mock.calls[0]?.[0]).toMatchObject({
          effectiveAt: '2026-03-02T00:00:00.000Z',
          expiresAt: '2026-01-01T00:00:00.000Z',
        });
      });
    }
    it('multiple invalid fields select first parser by configured input order', async () => {
      const f = fixture(route, { denied: true });
      for (let index = 0; index < route.fields.length; index++) {
        const body = { ...f.body };
        for (const field of route.fields.slice(index)) body[field.key] = null;
        expect(await f.dispatch({ body })).toEqual(
          invalid((route.fields[index]?.key ?? '') + ' is required'),
        );
      }
    });
    it.each([undefined, '', 'x'.repeat(129)].map((key) => ({ key })))(
      'key $key invalid after input before cap',
      async ({ key }) => {
        const f = fixture(route, { denied: true });
        const headers = { ...f.headers };
        if (key === undefined) delete headers['idempotency-key'];
        else headers['idempotency-key'] = key;
        expect(await f.dispatch({ headers })).toEqual(keyError);
        expect(f.get).not.toHaveBeenCalled();
        expect(f.method).not.toHaveBeenCalled();
      },
    );
    it.each(['x', 'x'.repeat(128), ' ', ' symbol/key!? '])(
      'key %s untrimmed/no format check',
      async (key) => {
        const f = fixture(route);
        expect(
          (await f.dispatch({ headers: { ...f.headers, 'idempotency-key': key } })).statusCode,
        ).toBe(201);
        expect(f.method.mock.calls[0]?.[1]).toBe(key);
      },
    );
    it('body key not allowed/fallback, invalid body first even if header missing', async () => {
      const f = fixture(route);
      const headers = { ...f.headers };
      delete headers['idempotency-key'];
      expect(await f.dispatch({ body: { ...f.body, idempotencyKey: 'body' }, headers })).toEqual(
        invalid('Unsupported fields: idempotencyKey'),
      );
      expect(await f.dispatch({ headers })).toEqual(keyError);
    });
    it.each([{ denied: true }, { scopes: [] }])(
      'write cap/scopes %j rejected only after valid input/key before actor',
      async (options) => {
        const f = fixture(route, options);
        const actorGetter = vi.fn(() => {
          throw new Error('not reached');
        });
        Object.defineProperty(f.context, 'actor', { get: actorGetter });
        expect(await f.dispatch()).toEqual(denied);
        expect(f.method).not.toHaveBeenCalled();
        expect(actorGetter).not.toHaveBeenCalled();
      },
    );
    it.each([[], ['customerId'], ['unrelated']].map((fields) => ({ fields })))(
      'write fields %j enforce actual own body keys',
      async ({ fields }) => {
        const f = fixture(route, { writeFields: fields });
        expect(await f.dispatch()).toEqual(error(403, 'forbidden', 'Field permission denied'));
        expect(f.method).not.toHaveBeenCalled();
      },
    );
    it('write fields full allow, inherited/nonenumerable values not requested, unknown symbol ignored', async () => {
      const f = fixture(route, { writeFields: route.fields.map((field) => field.key) });
      expect((await f.dispatch()).statusCode).toBe(201);
      const hidden = fixture(route, { writeFields: [] });
      const body: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(hidden.body))
        Object.defineProperty(body, key, { value, enumerable: false });
      body[Symbol('ignored') as unknown as string] = 'ignored';
      expect((await hidden.dispatch({ body })).statusCode).toBe(201);
      expect(hidden.method.mock.calls[0]?.[0]).toEqual(hidden.expected);
      const inherited = fixture(route, { writeFields: [] });
      expect(
        (
          await inherited.dispatch({
            body: Object.create({ ...inherited.body, unknown: 'inherited' }) as Record<
              string,
              unknown
            >,
          })
        ).statusCode,
      ).toBe(201);
    });
    it('ctx requestedFields live Object.keys after input getter mutation, not fixed full keys', async () => {
      const f = fixture(route, { writeFields: route.fields.slice(1).map((field) => field.key) });
      Object.defineProperty(f.body, 'customerId', {
        enumerable: true,
        configurable: true,
        get: () => {
          delete f.body.customerId;
          return id;
        },
      });
      expect((await f.dispatch()).statusCode).toBe(201);
      expect(f.method.mock.calls[0]?.[0]).toEqual(f.expected);
    });
    it('event trace global header→auth→allow keys→method→inputs→ctx keys→cap→actor→call→M', async () => {
      const f = fixture(route),
        events: string[] = [];
      const headers = Object.defineProperty({ ...f.headers }, 'idempotency-key', {
        enumerable: true,
        get: () => {
          events.push('header');
          return 'raw';
        },
      });
      f.authenticate.mockImplementationOnce(() => {
        events.push('authenticate');
        return Promise.resolve(f.context);
      });
      const body = new Proxy(f.body, {
        ownKeys(target) {
          events.push('keys');
          return Reflect.ownKeys(target);
        },
        get(target, key, receiver) {
          if (typeof key === 'string') events.push(key);
          return Reflect.get(target, key, receiver) as unknown;
        },
      });
      Object.defineProperty(f.repository, route.method, {
        get: () => {
          events.push('method');
          return f.method;
        },
      });
      f.get.mockImplementation((cap) => {
        events.push(cap);
        return new Map(f.permissions).get(cap);
      });
      Object.defineProperty(f.context, 'actor', {
        get: () => {
          events.push('actor');
          return actor;
        },
      });
      f.method.mockImplementationOnce(() => {
        events.push('call');
        return Promise.resolve(resultRow);
      });
      expect((await f.dispatch({ body, headers })).statusCode).toBe(201);
      expect(events).toEqual([
        'header',
        'authenticate',
        'keys',
        'method',
        ...route.fields.map((field) => field.key),
        'keys',
        route.capability,
        route.capability,
        'actor',
        'call',
        'credit:read',
      ]);
    });
    it('body getter replaces method/actor getter replaces method but original reference captured', async () => {
      const f = fixture(route);
      const replacement = vi.fn<Method>().mockResolvedValue({});
      Object.defineProperty(f.body, 'customerId', {
        enumerable: true,
        get: () => {
          f.repository[route.method] = replacement;
          return id;
        },
      });
      Object.defineProperty(f.context, 'actor', {
        get: () => {
          f.repository[route.method] = replacement;
          return actor;
        },
      });
      expect((await f.dispatch()).statusCode).toBe(201);
      expect(f.method).toHaveBeenCalledOnce();
      expect(replacement).not.toHaveBeenCalled();
      expect(f.method.mock.contexts[0]).toBe(f.repository);
    });
    it('method getter happens after allow but before first invalid parser; actor not reached', async () => {
      const f = fixture(route),
        events: string[] = [];
      Object.defineProperty(f.repository, route.method, {
        get: () => {
          events.push('method');
          return f.method;
        },
      });
      Object.defineProperty(f.context, 'actor', {
        get: () => {
          events.push('actor');
          return actor;
        },
      });
      expect(await f.dispatch({ body: {} })).toEqual(invalid('customerId is required'));
      expect(events).toEqual(['method']);
    });
    it.each(['SELF', 'TEAM', 'DEPARTMENT', 'REGION', 'COMPANY', 'GROUP'] as const)(
      'scope %s only forwards original refs',
      async (scope) => {
        const f = fixture(route, { scopes: [scope] });
        expect((await f.dispatch()).statusCode).toBe(201);
        expect(f.method.mock.calls[0]?.[2].scopes).toBe(f.scopes);
        expect(f.method.mock.calls[0]?.[2].anchors).toBe(f.anchors);
      },
    );
    it('absent anchors uses fresh [] no new denial', async () => {
      const f = fixture(route);
      Object.defineProperty(f.context, 'scopeAnchors', { value: undefined });
      await f.dispatch();
      await f.dispatch();
      expect(f.method.mock.calls[0]?.[2].anchors).toEqual([]);
      expect(f.method.mock.calls[0]?.[2].anchors).not.toBe(f.method.mock.calls[1]?.[2].anchors);
    });
    it.each([
      { read: null, expected: { id, version: 3 }, raw: false },
      { read: { scopes: [], fields: null }, expected: resultRow, raw: true },
      { read: { scopes: ['TEAM'], fields: [] }, expected: { id }, raw: false },
      {
        read: { scopes: ['TEAM'], fields: ['version', 'nested'] },
        expected: { id, version: 3, nested },
        raw: false,
      },
    ] as const)(
      'independent M read $read without read authorization',
      async ({ read, expected, raw }) => {
        const f = fixture(route, { read });
        const actual = await f.dispatch();
        expect(actual).toEqual(response(201, expected));
        if (raw) expect(actual.body).toBe(resultRow);
        else expect(actual.body).not.toBe(resultRow);
        if (read?.fields?.some((field) => field === 'nested'))
          expect((actual.body as JsonObject).nested).toBe(nested);
        expect(f.method).toHaveBeenCalledOnce();
      },
    );
    it.each([null, [], ['nested']].map((fields) => ({ fields })))(
      'await read grant change fields $fields is observed once after call',
      async ({ fields }) => {
        const f = fixture(route);
        f.method.mockImplementationOnce(() => {
          f.permissions.set('credit:read', { scopes: [], fields });
          return Promise.resolve(resultRow);
        });
        expect(await f.dispatch()).toEqual(
          response(
            201,
            fields === null ? resultRow : fields.length === 0 ? { id } : { id, nested },
          ),
        );
      },
    );
    it('await read deletion uses id/version fallback, no manufactured absent version', async () => {
      const f = fixture(route);
      f.method.mockImplementationOnce(() => {
        f.permissions.delete('credit:read');
        return Promise.resolve({ id, nested });
      });
      expect(await f.dispatch()).toEqual(response(201, { id }));
      const noId = fixture(route, { read: null });
      noId.method.mockResolvedValueOnce({ nested });
      expect(await noId.dispatch()).toEqual(response(201, {}));
    });
    it('M finite eager excluded getter/new shallow/special ownkeys and order', async () => {
      const f = fixture(route, {
        read: { scopes: [], fields: ['nested', '__proto__', 'constructor', 'toString'] },
      });
      const getter = vi.fn(() => 'private');
      const row: JsonObject = { version: 3, nested };
      Object.defineProperty(row, 'secret', { enumerable: true, get: getter });
      for (const key of ['__proto__', 'constructor', 'toString'])
        Object.defineProperty(row, key, { enumerable: true, value: nested });
      f.method.mockResolvedValueOnce(row);
      const actual = await f.dispatch();
      expect(getter).toHaveBeenCalledOnce();
      expect(Object.keys(actual.body as object)).toEqual([
        'nested',
        '__proto__',
        'constructor',
        'toString',
      ]);
      expect((actual.body as JsonObject).nested).toBe(nested);
      expect(actual.body).not.toBe(row);
      expect(Object.getPrototypeOf(actual.body)).toBe(Object.prototype);
    });
    it('runtime undefined read fields is not GET nullish fallback: original500', async () => {
      const f = fixture(route);
      f.method.mockImplementationOnce(() => {
        Object.defineProperty(f.permissions.get('credit:read'), 'fields', { value: undefined });
        return Promise.resolve(resultRow);
      });
      expect(await f.dispatch()).toEqual(error(500, 'internal_error', 'Internal server error'));
      expect(f.method).toHaveBeenCalledOnce();
    });
    it('GET-like query ignored/no headerkey body fallback; internal querygetter never read', async () => {
      const f = fixture(route);
      const getter = vi.fn(() => {
        throw new Error('ignored');
      });
      expect(
        (await f.dispatch({ query: Object.defineProperty({}, 'limit', { get: getter }) }))
          .statusCode,
      ).toBe(201);
      expect(getter).not.toHaveBeenCalled();
    });
    it('missing repository skips shared O/path/cap returns404', async () => {
      const f = fixture(route, { available: false, denied: true });
      expect(await f.dispatch({ body: null })).toEqual(missing);
      expect(f.get).not.toHaveBeenCalled();
    });
    it('global401 before shared O; no bearer does not authenticate', async () => {
      const f = fixture(route);
      expect(
        await f.dispatch({ body: null, headers: { 'x-correlation-id': correlationId } }),
      ).toEqual(error(401, 'authentication_required', 'A valid session is required'));
      expect(f.authenticate).not.toHaveBeenCalled();
    });
    it.each(['PATCH', 'PUT', 'DELETE', 'HEAD', 'post'])(
      'unsupported method %s no O/cap',
      async (method) => {
        const f = fixture(route, { denied: true });
        expect(await f.dispatch({ method, body: null })).toEqual(missing);
        expect(f.get).not.toHaveBeenCalled();
      },
    );
    it.each([
      route.path + '/',
      route.path + '/' + id,
      route.path.toUpperCase(),
      '/api/v1/not-a-qtc-command',
    ])('unsupported POST path %s shared O then404', async (pathname) => {
      const f = fixture(route, { denied: true });
      expect(await f.dispatch({ pathname, body: {} })).toEqual(missing);
      expect(f.get).not.toHaveBeenCalled();
      expect(f.approveCredit).not.toHaveBeenCalled();
    });
    it('neighbor approval path still enum/body validation, no evaluation autoapproval', async () => {
      const f = fixture(route);
      expect(
        await f.dispatch({
          pathname: '/api/v1/credit-decisions/' + id + '/approve',
          body: { decision: 'OTHER', reason: 'fixture' },
        }),
      ).toEqual(invalid('decision is unsupported'));
      expect(f.method).not.toHaveBeenCalled();
      expect(f.approveCredit).not.toHaveBeenCalled();
    });
    it('seven neighboring GET remain independently dispatched, not shared POST O', async () => {
      const f = fixture(route);
      const paths = [
        ['credit-limits', 'credit:read'],
        ['credit-decisions', 'credit:read'],
        ['contracts', 'contract:read'],
        ['sales-orders', 'sales-order:read'],
        ['reconciliation-runs', 'reconciliation:read'],
        ['ar-open-items', 'ar:read'],
        ['bank-payments', 'bank-payment:read'],
      ] as const;
      for (const [path, cap] of paths) {
        f.permissions.set(cap, { scopes: ['TEAM'], fields: null });
        expect(
          (await f.dispatch({ method: 'GET', pathname: '/api/v1/' + path, body: null })).statusCode,
        ).toBe(200);
      }
      expect(f.method).not.toHaveBeenCalled();
      expect(f.list).toHaveBeenCalledTimes(5);
      expect(f.listOperationalPage).toHaveBeenCalledTimes(2);
    });
    it.each([
      ['not_found', 404],
      ['conflict', 409],
      ['forbidden', 403],
      ['invalid_request', 400],
    ] as const)('repository DomainError %s/%i/C preserved', async (code, status) => {
      const f = fixture(route);
      f.method.mockRejectedValueOnce(new DomainError(code, 'ledger rejected'));
      expect(await f.dispatch()).toEqual(error(status, code, 'ledger rejected'));
    });
  });
