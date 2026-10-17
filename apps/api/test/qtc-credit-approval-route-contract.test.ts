// Fixed against 42e2785 inline creditApproval; no future approval module imported.
import { describe, expect, it, vi } from 'vitest';
import { DomainError, type AuthorizationContext } from '@kingturf/domain';
import type { DataScope, JsonObject, PermissionKey } from '@kingturf/types';
import { buildApp, type ApiDependencies, type ApiRequest } from '../src/app.js';
type Qtc = NonNullable<ApiDependencies['quoteToCash']>;
type Method = Qtc['approveCredit'];
type Grant = NonNullable<ReturnType<AuthorizationContext['permissions']['get']>>;
const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const other = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const correlationId = '33333333-3333-4333-8333-333333333333';
const actor = { companyId: 'qtc-approval-mock', employeeId: id };
const nested = { keep: true };
const path = (raw = id) => '/api/v1/credit-decisions/' + raw + '/approve';
function fixture(
  decision: Parameters<Method>[1],
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
      'credit:approve',
      { scopes, fields: options.writeFields === undefined ? null : options.writeFields },
    ],
  ]);
  if (options.denied) permissions.delete('credit:approve');
  if (options.read !== null)
    permissions.set('credit:read', options.read ?? { scopes: ['TEAM'], fields: null });
  const context: AuthorizationContext = {
    actor,
    permissions,
    scopeAnchors: new Map([['credit:approve', anchors]]),
  };
  const get = vi.spyOn(permissions, 'get');
  const returned: JsonObject = { id, effectiveStatus: decision, nested, secret: 'private' };
  const approveCredit = vi.fn<Method>().mockResolvedValue(returned);
  const setCreditLimit = vi.fn<Qtc['setCreditLimit']>().mockResolvedValue({});
  const evaluateCredit = vi.fn<Qtc['evaluateCredit']>().mockResolvedValue({});
  const createContract = vi.fn<Qtc['createContract']>().mockResolvedValue({});
  const list = vi.fn<Qtc['list']>().mockResolvedValue([]);
  const listOperationalPage = vi
    .fn<Qtc['listOperationalPage']>()
    .mockResolvedValue({ items: [], nextCursor: null });
  const repository = {
    approveCredit,
    setCreditLimit,
    evaluateCredit,
    createContract,
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
  const body: Record<string, unknown> = { decision, reason: ' fixture reason ' };
  const headers: Record<string, string | undefined> = {
    authorization: 'Bearer fixture',
    'x-correlation-id': correlationId,
    'idempotency-key': ' raw key ',
  };
  const dispatch = (request: Partial<ApiRequest> = {}) =>
    app.dispatch({
      method: 'POST',
      pathname: path(),
      body,
      ...request,
      headers: request.headers ?? headers,
    });
  return {
    returned,
    approveCredit,
    setCreditLimit,
    evaluateCredit,
    createContract,
    list,
    listOperationalPage,
    repository,
    body,
    headers,
    context,
    permissions,
    get,
    scopes,
    anchors,
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
const denied = error(403, 'forbidden', 'Permission denied');
const missing = error(404, 'not_found', 'Route not found');
const invalidId = invalid('creditDecisionId must be a UUID');
for (const decision of ['APPROVED', 'REJECTED'] as const)
  describe('old one QTC approval POST parameter ' + decision, () => {
    it('one canonical/six args/cached decision/receiver/200 fresh scope refs without fabricated version', async () => {
      const f = fixture(decision);
      expect(await f.dispatch()).toEqual(response(200, f.returned));
      expect(await f.dispatch()).toEqual(response(200, f.returned));
      expect(f.approveCredit.mock.calls[0]).toEqual([
        id,
        decision,
        'fixture reason',
        ' raw key ',
        { actor, scopes: f.scopes, anchors: f.anchors },
        correlationId,
      ]);
      expect(f.approveCredit.mock.calls[0]).toHaveLength(6);
      expect(f.approveCredit.mock.contexts[0]).toBe(f.repository);
      const scope = f.approveCredit.mock.calls[0]?.[4];
      expect(Object.keys(scope ?? {})).toEqual(['actor', 'scopes', 'anchors']);
      expect(scope?.actor).toBe(actor);
      expect(scope?.scopes).toBe(f.scopes);
      expect(scope?.anchors).toBe(f.anchors);
      expect(scope).not.toBe(f.approveCredit.mock.calls[1]?.[4]);
      expect(f.get.mock.calls).toEqual([
        ['credit:approve'],
        ['credit:approve'],
        ['credit:read'],
        ['credit:approve'],
        ['credit:approve'],
        ['credit:read'],
      ]);
      expect(Object.keys(f.returned)).toEqual(['id', 'effectiveStatus', 'nested', 'secret']);
    });
    it.each([undefined, null, [], '', 0, false, true, 'json'].map((body) => ({ body })))(
      'root $body before any matching or permissions',
      async ({ body }) => {
        const f = fixture(decision, { denied: true });
        for (const pathname of [path(), '/api/v1/not-a-qtc-command', path('abc')])
          expect(await f.dispatch({ pathname, body })).toEqual(
            invalid('A JSON object body is required'),
          );
        expect(f.get).not.toHaveBeenCalled();
        expect(f.approveCredit).not.toHaveBeenCalled();
      },
    );
    it('unknown fields sorted/allow before enum/method/UUID/key/cap', async () => {
      const f = fixture(decision, { denied: true });
      const getter = vi.fn(() => {
        throw new Error('not reached');
      });
      Object.defineProperty(f.repository, 'approveCredit', { get: getter });
      const body = Object.defineProperty({ decision: null, reason: null, z: 1, a: 2 }, 'decision', {
        enumerable: true,
        get: getter,
      });
      expect(await f.dispatch({ pathname: path('abc'), body })).toEqual(
        invalid('Unsupported fields: a, z'),
      );
      expect(getter).not.toHaveBeenCalled();
      expect(f.get).not.toHaveBeenCalled();
    });
    it.each([undefined, null, '', ' ', 0, false, 1, true, [], {}].map((value) => ({ value })))(
      'decision $value required first',
      async ({ value }) => {
        const f = fixture(decision, { denied: true });
        const getter = vi.fn(() => {
          throw new Error('not reached');
        });
        Object.defineProperty(f.repository, 'approveCredit', { get: getter });
        expect(
          await f.dispatch({
            pathname: path('abc'),
            body: { decision: value, reason: null },
            headers: { ...f.headers, 'idempotency-key': '' },
          }),
        ).toEqual(invalid('decision is required'));
        expect(getter).not.toHaveBeenCalled();
        expect(f.get).not.toHaveBeenCalled();
      },
    );
    it.each(['approved', 'rejected', 'Approved', 'Rejected', 'OTHER', 'APPROVE', 'REJECT', '0'])(
      'decision enum %s before malformed id and method',
      async (value) => {
        const f = fixture(decision, { denied: true });
        const getter = vi.fn(() => {
          throw new Error('not reached');
        });
        Object.defineProperty(f.repository, 'approveCredit', { get: getter });
        expect(
          await f.dispatch({ pathname: path('abc'), body: { decision: value, reason: null } }),
        ).toEqual(invalid('decision is unsupported'));
        expect(getter).not.toHaveBeenCalled();
      },
    );
    it.each([' ' + decision + ' ', '\t' + decision + '\n'])(
      'decision trim %j cached/accepted',
      async (value) => {
        const f = fixture(decision);
        expect((await f.dispatch({ body: { ...f.body, decision: value } })).statusCode).toBe(200);
        expect(f.approveCredit.mock.calls[0]?.[1]).toBe(decision);
      },
    );
    it.each([
      'abc',
      '-',
      'a',
      'aaaaaaaa',
      '00000000-0000-0000-0000-000000000000',
      id.replace('-4aaa-', '-0aaa-'),
      id.replace('-4aaa-', '-9aaa-'),
      id.replace('-8aaa-', '-7aaa-'),
      id + '-',
    ])('raw matched malformed id %s method captured before UUID', async (raw) => {
      const f = fixture(decision, { denied: true }),
        events: string[] = [];
      Object.defineProperty(f.repository, 'approveCredit', {
        get: () => {
          events.push('method');
          return f.approveCredit;
        },
      });
      Object.defineProperty(f.body, 'reason', {
        get: () => {
          events.push('reason');
          return null;
        },
      });
      expect(await f.dispatch({ pathname: path(raw) })).toEqual(invalidId);
      expect(events).toEqual(['method']);
      expect(f.get).not.toHaveBeenCalled();
    });
    it.each(['1', '2', '3', '4', '5', '6', '7', '8'])(
      'UUID version %s allowed by old helper/rawregex',
      async (version) => {
        const f = fixture(decision),
          raw = id.replace('-4aaa-', '-' + version + 'aaa-');
        expect((await f.dispatch({ pathname: path(raw) })).statusCode).toBe(200);
        expect(f.approveCredit.mock.calls[0]?.[0]).toBe(raw);
      },
    );
    it.each(['8', '9', 'a', 'b'])('UUID variant %s allowed raw lowercase', async (variant) => {
      const f = fixture(decision),
        raw = id.replace('-8aaa-', '-' + variant + 'aaa-');
      expect((await f.dispatch({ pathname: path(raw) })).statusCode).toBe(200);
      expect(f.approveCredit.mock.calls[0]?.[0]).toBe(raw);
    });
    it.each([
      path(''),
      path(id.toUpperCase()),
      path(' ' + id),
      path(id + ' '),
      path(id + '%20'),
      path(id + '/extra'),
      path() + '/',
      path() + '/extra',
      path() + '\n',
      path() + '\r',
      path() + '?x=1',
      path().replace('/approve', '/APPROVE'),
      path().replace('/approve', '/reject'),
      path().replace('/api/v1/', '/api/V1/'),
      '/api/v1/credit-decisions/' + id,
    ])('raw unmatched path %j valid root skips values/cap', async (pathname) => {
      const f = fixture(decision, { denied: true });
      const getter = vi.fn(() => {
        throw new Error('not reached');
      });
      const body = Object.defineProperty({}, 'decision', { enumerable: true, get: getter });
      expect(await f.dispatch({ pathname, body })).toEqual(missing);
      expect(getter).not.toHaveBeenCalled();
      expect(f.get).not.toHaveBeenCalled();
    });
    it.each([undefined, null, '', ' ', 0, false, 1, true, [], {}].map((value) => ({ value })))(
      'reason $value required after valid id before key/cap',
      async ({ value }) => {
        const f = fixture(decision, { denied: true });
        expect(
          await f.dispatch({
            body: { decision, reason: value },
            headers: { ...f.headers, 'idempotency-key': '' },
          }),
        ).toEqual(invalid('reason is required'));
        expect(f.get).not.toHaveBeenCalled();
        expect(f.approveCredit).not.toHaveBeenCalled();
      },
    );
    it.each([' reason ', '\nreason\t', 'x'.repeat(1024)])(
      'reason %j trim/no new maximum',
      async (reason) => {
        const f = fixture(decision);
        expect((await f.dispatch({ body: { decision, reason } })).statusCode).toBe(200);
        expect(f.approveCredit.mock.calls[0]?.[2]).toBe(reason.trim());
      },
    );
    it('missing reason/error order vs malformed path and decision', async () => {
      const f = fixture(decision);
      expect(await f.dispatch({ body: { decision } })).toEqual(invalid('reason is required'));
      expect(await f.dispatch({ body: { reason: 'fixture' } })).toEqual(
        invalid('decision is required'),
      );
      expect(await f.dispatch({ pathname: path('abc'), body: {} })).toEqual(
        invalid('decision is required'),
      );
      expect(await f.dispatch({ pathname: path('abc'), body: { decision } })).toEqual(invalidId);
    });
    it.each([undefined, '', 'x'.repeat(129)].map((key) => ({ key })))(
      'key $key invalid before write cap',
      async ({ key }) => {
        const f = fixture(decision, { denied: true }),
          headers = { ...f.headers };
        if (key === undefined) delete headers['idempotency-key'];
        else headers['idempotency-key'] = key;
        expect(await f.dispatch({ headers })).toEqual(invalid('Idempotency-Key is required'));
        expect(f.get).not.toHaveBeenCalled();
      },
    );
    it.each(['x', 'x'.repeat(128), ' ', ' raw/key!? '])(
      'key %j untouched/no format check',
      async (key) => {
        const f = fixture(decision);
        expect(
          (await f.dispatch({ headers: { ...f.headers, 'idempotency-key': key } })).statusCode,
        ).toBe(200);
        expect(f.approveCredit.mock.calls[0]?.[3]).toBe(key);
      },
    );
    it('body key unsupported not fallback, before missing decision/header', async () => {
      const f = fixture(decision),
        headers = { ...f.headers };
      delete headers['idempotency-key'];
      expect(await f.dispatch({ body: { idempotencyKey: 'body' }, headers })).toEqual(
        invalid('Unsupported fields: idempotencyKey'),
      );
      expect(await f.dispatch({ headers })).toEqual(invalid('Idempotency-Key is required'));
    });
    it.each([{ denied: true }, { scopes: [] }])(
      'writecap %j denied before actor but after enum/id/reason/key',
      async (options) => {
        const f = fixture(decision, options);
        const getter = vi.fn(() => {
          throw new Error('not reached');
        });
        Object.defineProperty(f.context, 'actor', { get: getter });
        expect(await f.dispatch()).toEqual(denied);
        expect(getter).not.toHaveBeenCalled();
        expect(f.approveCredit).not.toHaveBeenCalled();
      },
    );
    it.each([[], ['decision'], ['reason'], ['unrelated']].map((fields) => ({ fields })))(
      'write fields $fields deny actual own keys',
      async ({ fields }) => {
        const f = fixture(decision, { writeFields: fields });
        expect(await f.dispatch()).toEqual(error(403, 'forbidden', 'Field permission denied'));
        expect(f.approveCredit).not.toHaveBeenCalled();
      },
    );
    it('full body fields permission accepted/no fixed unrelated requested field', async () => {
      const f = fixture(decision, { writeFields: ['decision', 'reason'] });
      expect((await f.dispatch()).statusCode).toBe(200);
    });
    it.each(['decision', 'reason'])(
      'getter deletes %s affecting late live Object.keys; parsed value retained',
      async (key) => {
        const fields = key === 'decision' ? ['reason'] : ['decision'];
        const f = fixture(decision, { writeFields: fields });
        const getter = vi.fn(() => {
          Reflect.deleteProperty(f.body, key);
          return key === 'decision' ? decision : 'reason';
        });
        Object.defineProperty(f.body, key, {
          enumerable: true,
          configurable: true,
          get: getter,
        });
        expect((await f.dispatch()).statusCode).toBe(200);
        expect(f.approveCredit.mock.calls[0]?.[1]).toBe(decision);
        expect(f.approveCredit.mock.calls[0]?.[2]).toBe(
          key === 'reason' ? 'reason' : 'fixture reason',
        );
        expect(getter).toHaveBeenCalledOnce();
      },
    );
    it('nonenumerable/prototype known fields parsed with fields[]; symbols ignored', async () => {
      const f = fixture(decision, { writeFields: [] }),
        body = {};
      for (const [key, value] of Object.entries(f.body))
        Object.defineProperty(body, key, { value });
      Object.defineProperty(body, Symbol('unknown'), { value: 'ignored', enumerable: true });
      expect((await f.dispatch({ body })).statusCode).toBe(200);
      expect(
        (
          await f.dispatch({
            body: Object.create({ ...f.body, unknown: 'inherited' }) as Record<string, unknown>,
          })
        ).statusCode,
      ).toBe(200);
    });
    it('trace header before authenticate/O, allow→decision once→method→reason→ctx keys→actor→call→late M', async () => {
      const f = fixture(decision),
        events: string[] = [];
      const headers = Object.defineProperty({ ...f.headers }, 'idempotency-key', {
        enumerable: true,
        get: () => {
          events.push('header');
          return 'raw';
        },
      });
      f.authenticate.mockImplementationOnce(() => {
        events.push('auth');
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
      Object.defineProperty(f.repository, 'approveCredit', {
        get: () => {
          events.push('method');
          return f.approveCredit;
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
      f.approveCredit.mockImplementationOnce(() => {
        events.push('call');
        return Promise.resolve(f.returned);
      });
      expect((await f.dispatch({ body, headers })).statusCode).toBe(200);
      expect(events).toEqual([
        'header',
        'auth',
        'keys',
        'decision',
        'method',
        'reason',
        'keys',
        'credit:approve',
        'credit:approve',
        'actor',
        'call',
        'credit:read',
      ]);
    });
    it('decision getter changes method before capture; reason/actor cannot change captured method; decision one read', async () => {
      const f = fixture(decision);
      const selected = vi.fn<Method>().mockResolvedValue(f.returned),
        later = vi.fn<Method>().mockResolvedValue({});
      const decisionGetter = vi.fn(() => {
        f.repository.approveCredit = selected;
        return decision;
      });
      Object.defineProperty(f.body, 'decision', { enumerable: true, get: decisionGetter });
      Object.defineProperty(f.body, 'reason', {
        enumerable: true,
        get: () => {
          f.repository.approveCredit = later;
          return 'reason';
        },
      });
      Object.defineProperty(f.context, 'actor', {
        get: () => {
          f.repository.approveCredit = later;
          return actor;
        },
      });
      expect((await f.dispatch()).statusCode).toBe(200);
      expect(decisionGetter).toHaveBeenCalledOnce();
      expect(selected).toHaveBeenCalledOnce();
      expect(selected.mock.contexts[0]).toBe(f.repository);
      expect(selected.mock.calls[0]).toHaveLength(6);
      expect(f.approveCredit).not.toHaveBeenCalled();
      expect(later).not.toHaveBeenCalled();
    });
    it.each(['SELF', 'TEAM', 'DEPARTMENT', 'REGION', 'COMPANY', 'GROUP'] as const)(
      'scope %s only forwarded refs not PG matrix',
      async (scope) => {
        const f = fixture(decision, { scopes: [scope] });
        expect((await f.dispatch()).statusCode).toBe(200);
        expect(f.approveCredit.mock.calls[0]?.[4].scopes).toBe(f.scopes);
        expect(f.approveCredit.mock.calls[0]?.[4].anchors).toBe(f.anchors);
      },
    );
    it('missing anchors uses new [] each request, no new denial', async () => {
      const f = fixture(decision);
      Object.defineProperty(f.context, 'scopeAnchors', { value: undefined });
      await f.dispatch();
      await f.dispatch();
      expect(f.approveCredit.mock.calls[0]?.[4].anchors).toEqual([]);
      expect(f.approveCredit.mock.calls[0]?.[4].anchors).not.toBe(
        f.approveCredit.mock.calls[1]?.[4].anchors,
      );
    });
    it.each([
      { read: null, fields: 'missing' },
      { read: { scopes: [], fields: null }, fields: 'raw' },
      { read: { scopes: ['TEAM'], fields: [] }, fields: 'id' },
      { read: { scopes: ['TEAM'], fields: ['effectiveStatus', 'nested'] }, fields: 'finite' },
    ] as const)(
      'M independent read $fields, scopes not read-authorized',
      async ({ read, fields }) => {
        const f = fixture(decision, { read }),
          result = await f.dispatch();
        expect(result).toEqual(
          response(
            200,
            fields === 'raw'
              ? f.returned
              : fields === 'finite'
                ? { id, effectiveStatus: decision, nested }
                : { id },
          ),
        );
        if (fields === 'raw') expect(result.body).toBe(f.returned);
        else expect(result.body).not.toBe(f.returned);
        if (fields === 'finite') expect((result.body as JsonObject).nested).toBe(nested);
      },
    );
    it('missing read retains existing version only; missing actual id/version not fabricated', async () => {
      const f = fixture(decision, { read: null });
      f.approveCredit.mockResolvedValueOnce({ id, version: 7, nested });
      expect(await f.dispatch()).toEqual(response(200, { id, version: 7 }));
      f.approveCredit.mockResolvedValueOnce({ nested });
      expect(await f.dispatch()).toEqual(response(200, {}));
    });
    it.each([null, [], ['effectiveStatus']].map((fields) => ({ fields })))(
      'await changed read fields $fields used late',
      async ({ fields }) => {
        const f = fixture(decision);
        f.approveCredit.mockImplementationOnce(() => {
          f.permissions.set('credit:read', { scopes: [], fields });
          return Promise.resolve(f.returned);
        });
        expect(await f.dispatch()).toEqual(
          response(
            200,
            fields === null
              ? f.returned
              : fields.length
                ? { id, effectiveStatus: decision }
                : { id },
          ),
        );
      },
    );
    it('await read deletion/id fallback vs runtime undefined fields old500', async () => {
      const f = fixture(decision);
      f.approveCredit.mockImplementationOnce(() => {
        f.permissions.delete('credit:read');
        return Promise.resolve(f.returned);
      });
      expect(await f.dispatch()).toEqual(response(200, { id }));
      const wrong = fixture(decision);
      wrong.approveCredit.mockImplementationOnce(() => {
        Object.defineProperty(wrong.permissions.get('credit:read'), 'fields', { value: undefined });
        return Promise.resolve(wrong.returned);
      });
      expect(await wrong.dispatch()).toEqual(error(500, 'internal_error', 'Internal server error'));
    });
    it('finite M eager getter/special ownkeys/key order/shallow refs/no version', async () => {
      const f = fixture(decision, {
        read: { scopes: [], fields: ['nested', '__proto__', 'constructor', 'toString'] },
      });
      const getter = vi.fn(() => 'private'),
        row: JsonObject = { nested };
      Object.defineProperty(row, 'secret', { enumerable: true, get: getter });
      for (const key of ['__proto__', 'constructor', 'toString'])
        Object.defineProperty(row, key, { enumerable: true, value: nested });
      f.approveCredit.mockResolvedValueOnce(row);
      const result = await f.dispatch();
      expect(getter).toHaveBeenCalledOnce();
      expect(Object.keys(result.body as object)).toEqual([
        'nested',
        '__proto__',
        'constructor',
        'toString',
      ]);
      expect((result.body as JsonObject).nested).toBe(nested);
      expect(result.body).not.toBe(row);
      expect(Object.getPrototypeOf(result.body)).toBe(Object.prototype);
    });
    it('query internal getters ignored; missingrepo skips O and values; no bearer401 before O', async () => {
      const f = fixture(decision),
        getter = vi.fn(() => {
          throw new Error('ignored');
        });
      expect(
        (await f.dispatch({ query: Object.defineProperty({}, 'limit', { get: getter }) }))
          .statusCode,
      ).toBe(200);
      expect(getter).not.toHaveBeenCalled();
      const absent = fixture(decision, { available: false, denied: true });
      expect(await absent.dispatch({ body: null })).toEqual(missing);
      expect(absent.get).not.toHaveBeenCalled();
      expect(
        await f.dispatch({ body: null, headers: { 'x-correlation-id': correlationId } }),
      ).toEqual(error(401, 'authentication_required', 'A valid session is required'));
      expect(f.authenticate).toHaveBeenCalledOnce();
    });
    it.each(['GET', 'PATCH', 'PUT', 'DELETE', 'HEAD', 'post'])(
      'unsupported method %s skips O and cap',
      async (method) => {
        const f = fixture(decision, { denied: true });
        expect(await f.dispatch({ method, body: null })).toEqual(missing);
        expect(f.get).not.toHaveBeenCalled();
      },
    );
    it('neighbor credit POST and contract parsing unchanged, no approval call', async () => {
      const f = fixture(decision);
      for (const pathname of [
        '/api/v1/credit-limits',
        '/api/v1/credit-decisions',
        '/api/v1/contracts',
      ])
        expect(await f.dispatch({ pathname, body: {} })).toEqual(invalid('customerId is required'));
      expect(f.approveCredit).not.toHaveBeenCalled();
      expect(f.setCreditLimit).not.toHaveBeenCalled();
      expect(f.evaluateCredit).not.toHaveBeenCalled();
      expect(f.createContract).not.toHaveBeenCalled();
    });
    it('seven GET unaffected by shared POST O', async () => {
      const f = fixture(decision);
      for (const [pathname, cap] of [
        ['credit-limits', 'credit:read'],
        ['credit-decisions', 'credit:read'],
        ['contracts', 'contract:read'],
        ['sales-orders', 'sales-order:read'],
        ['reconciliation-runs', 'reconciliation:read'],
        ['ar-open-items', 'ar:read'],
        ['bank-payments', 'bank-payment:read'],
      ] as const) {
        f.permissions.set(cap, { scopes: ['TEAM'], fields: null });
        expect(
          (await f.dispatch({ method: 'GET', pathname: '/api/v1/' + pathname, body: null }))
            .statusCode,
        ).toBe(200);
      }
      expect(f.list).toHaveBeenCalledTimes(5);
      expect(f.listOperationalPage).toHaveBeenCalledTimes(2);
      expect(f.approveCredit).not.toHaveBeenCalled();
    });
    it.each([
      ['not_found', 404],
      ['conflict', 409],
      ['forbidden', 403],
      ['invalid_request', 400],
    ] as const)('repository error %s/%i/C', async (code, status) => {
      const f = fixture(decision);
      f.approveCredit.mockRejectedValueOnce(new DomainError(code, 'approval rejected'));
      expect(await f.dispatch()).toEqual(error(status, code, 'approval rejected'));
    });
  });
