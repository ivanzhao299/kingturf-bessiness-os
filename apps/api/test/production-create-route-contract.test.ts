// Frozen old inline POST against 3dd496a; no future create route imported.
import { describe, expect, it, vi } from 'vitest';
import { DomainError, type AuthorizationContext } from '@kingturf/domain';
import type { DataScope, JsonObject, PermissionKey } from '@kingturf/types';
import { buildApp, type ApiDependencies, type ApiRequest } from '../src/app.js';

type Production = NonNullable<ApiDependencies['production']>;
type Grant = NonNullable<ReturnType<AuthorizationContext['permissions']['get']>>;
const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const other = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const correlationId = '33333333-3333-4333-8333-333333333333';
const actor = { companyId: 'mock-tenant', employeeId: id };
const path = '/api/v1/production-orders';
const required = [
  'orderNumber',
  'itemVersionId',
  'routingVersionId',
  'plannedQuantity',
  'plannedStartAt',
  'plannedDueAt',
  'sourceReference',
] as const;
const fields = [
  'orderNumber',
  'itemVersionId',
  'routingVersionId',
  'mrpProposalId',
  'plannedQuantity',
  'plannedStartAt',
  'plannedDueAt',
  'sourceReference',
] as const;
const valid = () => ({
  orderNumber: 'WO-1',
  itemVersionId: id,
  routingVersionId: other,
  plannedQuantity: '10',
  plannedStartAt: '2026-10-14',
  plannedDueAt: '2026-10-16',
  sourceReference: 'SOURCE-1',
});
const nested = { retained: true };
const row: JsonObject = { id, version: 7, state: 'DRAFT', secret: 'hidden', nested };
function fixture(
  options: {
    available?: boolean;
    denied?: boolean;
    scopes?: readonly DataScope[];
    writeFields?: Grant['fields'];
    readFields?: Grant['fields'];
    noRead?: boolean;
  } = {},
) {
  const scopes = options.scopes ?? ['TEAM'];
  const anchors = [{ scope: 'TEAM', organizationId: other }] as const;
  const permissions = new Map<PermissionKey, Grant>([
    [
      'production:plan',
      { scopes, fields: options.writeFields === undefined ? null : options.writeFields },
    ],
  ]);
  if (!options.noRead)
    permissions.set('production:read', {
      scopes: [],
      fields: options.readFields === undefined ? null : options.readFields,
    });
  if (options.denied) permissions.delete('production:plan');
  const context: AuthorizationContext = {
    actor,
    permissions,
    scopeAnchors: new Map([['production:plan', anchors]]),
  };
  const get = vi.spyOn(permissions, 'get');
  const create = vi.fn<Production['create']>().mockResolvedValue(row);
  const production = { create, list: vi.fn<Production['list']>().mockResolvedValue([row]) };
  const authenticate = vi.fn().mockResolvedValue(context);
  const app = buildApp({
    auth: { authenticate } as unknown as ApiDependencies['auth'],
    organizations: {} as ApiDependencies['organizations'],
    employees: {} as ApiDependencies['employees'],
    ...(options.available === false ? {} : { production: production as unknown as Production }),
  });
  const dispatch = (body: unknown = valid(), options: Partial<ApiRequest> = {}) => {
    const request = {
      method: 'POST',
      pathname: path,
      body,
      headers: {
        authorization: 'Bearer fixture',
        'x-correlation-id': correlationId,
        ...options.headers,
      },
    };
    Object.defineProperties(request, Object.getOwnPropertyDescriptors(options));
    Object.defineProperty(request, 'headers', {
      value: {
        authorization: 'Bearer fixture',
        'x-correlation-id': correlationId,
        ...options.headers,
      },
    });
    return app.dispatch(request);
  };
  return { create, production, permissions, context, scopes, anchors, get, authenticate, dispatch };
}
const response = (statusCode: number, body: unknown) => ({
  statusCode,
  body,
  headers: {
    'x-correlation-id': correlationId,
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'SAMEORIGIN',
    'referrer-policy': 'strict-origin-when-cross-origin',

    'content-security-policy-report-only':
      "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'self'",
  },
});
const error = (statusCode: number, code: string, message: string) =>
  response(statusCode, { error: { code, message, correlationId } });
const invalid = (message: string) => error(400, 'invalid_request', message);
const denied = error(403, 'forbidden', 'Permission denied');
const fieldDenied = error(403, 'forbidden', 'Field permission denied');
const missing = error(404, 'not_found', 'Route not found');
const stableError = 'Code must be 1-64 uppercase letters, digits, underscore, or hyphen';
const keyInput = (f: ReturnType<typeof fixture>) => f.create.mock.calls[0]?.[0];

describe('old production create contract', () => {
  it('creates with fresh input/context, original references, receiver and exactly three arguments', async () => {
    const f = fixture();
    expect(await f.dispatch()).toEqual(response(201, row));
    expect(await f.dispatch()).toEqual(response(201, row));
    expect(f.create.mock.calls).toHaveLength(2);
    expect(f.create.mock.calls[0]).toEqual([
      valid(),
      { actor, scopes: f.scopes, anchors: f.anchors },
      correlationId,
    ]);
    expect(f.create.mock.contexts[0]).toBe(f.production);
    const [input, scope] = f.create.mock.calls[0] ?? [];
    expect(Object.keys(input ?? {})).toEqual(required);
    expect(Object.keys(scope ?? {})).toEqual(['actor', 'scopes', 'anchors']);
    expect(scope?.actor).toBe(actor);
    expect(scope?.scopes).toBe(f.scopes);
    expect(scope?.anchors).toBe(f.anchors);
    expect(input).not.toBe(f.create.mock.calls[1]?.[0]);
    expect(scope).not.toBe(f.create.mock.calls[1]?.[1]);
    expect(f.production.list).not.toHaveBeenCalled();
  });

  it.each([null, undefined, [], '', 0, true])(
    'root %j is rejected before missing plan',
    async (body) => {
      const f = fixture({ denied: true });
      const request = { method: 'POST', pathname: path, body };
      expect(await f.dispatch(null, request)).toEqual(invalid('A JSON object body is required'));
      expect(f.get).not.toHaveBeenCalled();
      expect(f.create).not.toHaveBeenCalled();
    },
  );
  it('allow sorts unknown own fields before plan or any body value getter', async () => {
    const f = fixture({ denied: true });
    const body = { ...valid(), z: undefined, a: null, version: 1, idempotencyKey: 'BODY' };
    const getter = vi.fn(() => {
      throw new Error('must not read');
    });
    Object.defineProperty(body, 'orderNumber', { enumerable: true, get: getter });
    expect(await f.dispatch(body)).toEqual(
      invalid('Unsupported fields: a, idempotencyKey, version, z'),
    );
    expect(getter).not.toHaveBeenCalled();
    expect(f.get).not.toHaveBeenCalled();
    expect(f.create).not.toHaveBeenCalled();
  });
  it.each([null, undefined, [], { extra: true }, valid()])(
    'missing repository skips %j before plan/body',
    async (body) => {
      const f = fixture({ available: false, denied: true });
      expect(await f.dispatch(null, { body })).toEqual(missing);
      expect(f.get).not.toHaveBeenCalled();
      expect(f.create).not.toHaveBeenCalled();
    },
  );
  it('missing repository never reads body getter; 401 still precedes wrapper', async () => {
    const f = fixture({ available: false, denied: true });
    const getter = vi.fn(() => {
      throw new Error('body accessed');
    });
    const request = {
      body: Object.defineProperty({}, 'orderNumber', { enumerable: true, get: getter }),
    };
    expect(await f.dispatch(null, request)).toEqual(missing);
    expect(getter).not.toHaveBeenCalled();
    f.authenticate.mockResolvedValueOnce(null);
    expect(await f.dispatch(null, request)).toEqual(
      error(401, 'authentication_required', 'A valid session is required'),
    );
    expect(getter).not.toHaveBeenCalled();
  });
  it.each([
    { method: 'PATCH', pathname: path },
    { method: 'PUT', pathname: path },
    { method: 'DELETE', pathname: path },
    { method: 'post', pathname: path },
    { method: 'POST', pathname: path + '/' },
    { method: 'POST', pathname: path + '/' + id },
    { method: 'POST', pathname: '/api/v1/Production-orders' },
    { method: 'POST', pathname: '/api/v1/production-order' },
  ])('unsupported $method $pathname skips parser and capability', async (request) => {
    const f = fixture({ denied: true });
    const getter = vi.fn(() => {
      throw new Error('body accessed');
    });
    expect(
      await f.dispatch(
        Object.defineProperty({}, 'orderNumber', { enumerable: true, get: getter }),
        request,
      ),
    ).toEqual(missing);
    expect(getter).not.toHaveBeenCalled();
    expect(f.get).not.toHaveBeenCalled();
    expect(f.create).not.toHaveBeenCalled();
  });
  it('same path GET remains independent read neighbour', async () => {
    const f = fixture({ denied: true, readFields: null });
    expect(await f.dispatch(null, { method: 'GET' })).toEqual(denied);
    f.permissions.set('production:read', { scopes: ['COMPANY'], fields: null });
    expect(await f.dispatch(null, { method: 'GET' })).toEqual(response(200, { items: [row] }));
    expect(f.create).not.toHaveBeenCalled();
  });
  it.each([
    { denied: true },
    { scopes: [] },
    { writeFields: [] },
    { writeFields: ['orderNumber'] },
  ])('field/scope authorization precedes all parser getters %j', async (options) => {
    const f = fixture(options);
    const getter = vi.fn(() => {
      throw new Error('value before auth');
    });
    const body = valid();
    Object.defineProperty(body, 'orderNumber', { enumerable: true, get: getter });
    expect(await f.dispatch(body)).toEqual(options.denied || options.scopes ? denied : fieldDenied);
    expect(getter).not.toHaveBeenCalled();
    expect(f.create).not.toHaveBeenCalled();
  });
  it.each([{ writeFields: null }, { writeFields: required }, { writeFields: fields }])(
    'legal write field set %j',
    async (options) => {
      const f = fixture(options);
      expect(await f.dispatch()).toEqual(response(201, row));
    },
  );
  it.each(['SELF', 'TEAM', 'DEPARTMENT', 'REGION', 'COMPANY', 'GROUP'] as const)(
    'HTTP only forwards %s scope, not PG scope proof',
    async (scope) => {
      const f = fixture({ scopes: [scope] });
      expect((await f.dispatch()).statusCode).toBe(201);
      expect(f.create.mock.calls[0]?.[1].scopes).toBe(f.scopes);
      expect(f.create.mock.calls[0]?.[1].anchors).toBe(f.anchors);
    },
  );
  it('own undefined mrp key participates in field authorization but is omitted from input', async () => {
    const body = { ...valid(), mrpProposalId: undefined };
    const f = fixture({ writeFields: required });
    expect(await f.dispatch(body)).toEqual(fieldDenied);
    expect(f.create).not.toHaveBeenCalled();
    const allowed = fixture({ writeFields: fields });
    expect((await allowed.dispatch(body)).statusCode).toBe(201);
    expect(Object.keys(keyInput(allowed) ?? {})).toEqual(required);
    expect(Object.hasOwn(keyInput(allowed) ?? {}, 'mrpProposalId')).toBe(false);
  });
  it('optional mrp exists at exact input position and UUID case is preserved', async () => {
    const f = fixture();
    const mrp = id.toUpperCase();
    expect((await f.dispatch({ ...valid(), mrpProposalId: ' ' + mrp + ' ' })).statusCode).toBe(201);
    expect(Object.keys(keyInput(f) ?? {})).toEqual(fields);
    expect(keyInput(f)?.mrpProposalId).toBe(mrp);
  });
  it('non-enumerable/inherited recognized fields remain parser-readable but are not requested fields', async () => {
    const f = fixture({ writeFields: [] });
    const body: Record<string, unknown> = Object.create(valid()) as Record<string, unknown>;
    expect((await f.dispatch(body)).statusCode).toBe(201);
    expect(keyInput(f)).toEqual(valid());
    const next = fixture({ writeFields: [] });
    const nonEnumerable = Object.fromEntries([]);
    for (const [key, value] of Object.entries(valid()))
      Object.defineProperty(nonEnumerable, key, { value, enumerable: false });
    expect((await next.dispatch(nonEnumerable)).statusCode).toBe(201);
    expect(keyInput(next)).toEqual(valid());
  });
  it('body key insertion order drives requested field checks, not the allow list order', async () => {
    const f = fixture();
    const includes = vi.fn((key: string) => key !== 'sourceReference');
    const permitted: string[] = [];
    permitted.includes = includes;
    f.permissions.set('production:plan', { scopes: f.scopes, fields: permitted });
    const body = Object.assign({ sourceReference: 'SOURCE-1' }, valid());
    expect(await f.dispatch(body)).toEqual(fieldDenied);
    expect(includes.mock.calls).toEqual([['sourceReference']]);
  });

  const parserFailures = [
    { key: 'orderNumber', value: null, message: 'orderNumber is required' },
    { key: 'itemVersionId', value: 'bad', message: 'itemVersionId must be a UUID' },
    { key: 'routingVersionId', value: 'bad', message: 'routingVersionId must be a UUID' },
    { key: 'mrpProposalId', value: 'bad', message: 'mrpProposalId must be a UUID' },
    { key: 'plannedQuantity', value: 'bad', message: 'Invalid decimal' },
    {
      key: 'plannedStartAt',
      value: 'bad',
      message: 'plannedStartAt must be a valid YYYY-MM-DD date',
    },
    { key: 'plannedDueAt', value: 'bad', message: 'plannedDueAt must be a valid YYYY-MM-DD date' },
    { key: 'sourceReference', value: null, message: 'sourceReference is required' },
  ] as const;
  it.each(parserFailures)(
    '$key is the first failure among itself and all later invalid fields',
    async (entry) => {
      const index = parserFailures.indexOf(entry);
      const body: Record<string, unknown> = { ...valid(), mrpProposalId: id };
      for (const later of parserFailures.slice(index)) body[later.key] = later.value;
      const reads: string[] = [];
      for (const key of fields) {
        const value = body[key];
        Object.defineProperty(body, key, {
          enumerable: true,
          get: () => {
            reads.push(key);
            return value;
          },
        });
      }
      const f = fixture();
      expect(await f.dispatch(body)).toEqual(invalid(entry.message));
      const expected: string[] = [];
      for (const key of fields.slice(0, index + 1)) {
        expected.push(key);
        if (key === 'mrpProposalId' && index >= 3) expected.push(key);
      }
      expect(reads).toEqual(expected);
      expect(f.create).not.toHaveBeenCalled();
    },
  );
  for (const key of required) {
    it.each([undefined, null, '', ' ', 0, false, [], {}])(
      'requires string ' + key + ' = %j',
      async (value) => {
        const f = fixture();
        expect(await f.dispatch({ ...valid(), [key]: value })).toEqual(
          invalid(key + ' is required'),
        );
        expect(f.create).not.toHaveBeenCalled();
      },
    );
  }
  for (const key of ['orderNumber', 'sourceReference'] as const) {
    it.each(['a', '1ABC', 'A B', 'A/B', 'A'.repeat(65)])(
      'stable ' + key + ' rejects %s',
      async (value) => {
        const f = fixture();
        expect(await f.dispatch({ ...valid(), [key]: value })).toEqual(invalid(stableError));
      },
    );
    it.each(['A', 'A_1-B', 'A'.repeat(64)])(
      'stable ' + key + ' accepts trimmed %s',
      async (value) => {
        const f = fixture();
        expect((await f.dispatch({ ...valid(), [key]: ' ' + value + ' ' })).statusCode).toBe(201);
        expect(keyInput(f)?.[key]).toBe(value);
      },
    );
  }
  for (const key of ['itemVersionId', 'routingVersionId', 'mrpProposalId'] as const) {
    it.each(['bad', '00000000-0000-0000-0000-000000000000', id.replace('4aaa', '9aaa')])(
      'UUID ' + key + ' rejects %s',
      async (value) => {
        const f = fixture();
        expect(await f.dispatch({ ...valid(), [key]: value })).toEqual(
          invalid(key + ' must be a UUID'),
        );
      },
    );
    it('UUID ' + key + ' accepts trimmed uppercase without lowering', async () => {
      const f = fixture();
      expect(
        (await f.dispatch({ ...valid(), [key]: ' ' + id.toUpperCase() + ' ' })).statusCode,
      ).toBe(201);
      expect(keyInput(f)?.[key]).toBe(id.toUpperCase());
    });
  }
  it.each([null, '', ' ', 0, false, [], {}])(
    'nonundefined optional mrp %j requires string',
    async (value) => {
      const f = fixture();
      expect(await f.dispatch({ ...valid(), mrpProposalId: value })).toEqual(
        invalid('mrpProposalId is required'),
      );
    },
  );
  it.each([
    { value: ' 1.230000 ', normalized: '1.23' },
    { value: '1.123456', normalized: '1.123456' },
    { value: '-0', normalized: '0' },
    { value: '-0.000000', normalized: '0' },
    { value: '0', normalized: '0' },
    { value: '1.000000', normalized: '1' },
  ])('decimal preserves old normalization $value → $normalized', async ({ value, normalized }) => {
    const f = fixture();
    expect((await f.dispatch({ ...valid(), plannedQuantity: value })).statusCode).toBe(201);
    expect(keyInput(f)?.plannedQuantity).toBe(normalized);
  });
  it.each([
    '+1',
    '1e2',
    '.5',
    '1.',
    'NaN',
    'Infinity',
    '1,000',
    '001.23',
    '1.123456789',
    '-0.0000009',
    '1000000000000000000',
  ])('decimal rejects %s', async (value) => {
    const f = fixture();
    expect(await f.dispatch({ ...valid(), plannedQuantity: value })).toEqual(
      invalid('Invalid decimal'),
    );
  });
  it.each(['-1', '-0.000001'])('nonnegative rejects normalized %s', async (value) => {
    const f = fixture();
    expect(await f.dispatch({ ...valid(), plannedQuantity: value })).toEqual(
      invalid('plannedQuantity must be non-negative'),
    );
  });
  for (const key of ['plannedStartAt', 'plannedDueAt'] as const) {
    it.each(['2026-1-01', '2026-13-01', '2026-01-32', '2026-10-14T00:00:00Z'])(
      'date ' + key + ' rejects %s',
      async (value) => {
        const f = fixture();
        expect(await f.dispatch({ ...valid(), [key]: value })).toEqual(
          invalid(key + ' must be a valid YYYY-MM-DD date'),
        );
      },
    );
    it.each(['2026-02-30', '2026-02-29', '2026-04-31', '0000-01-01'])(
      'date ' + key + ' old accepted surface %s, not PG validity',
      async (value) => {
        const f = fixture();
        expect((await f.dispatch({ ...valid(), [key]: ' ' + value + ' ' })).statusCode).toBe(201);
        expect(keyInput(f)?.[key]).toBe(value);
      },
    );
  }
  it('does not impose planned start <= due order', async () => {
    const f = fixture();
    expect(
      (await f.dispatch({ ...valid(), plannedStartAt: '2026-12-01', plannedDueAt: '2026-01-01' }))
        .statusCode,
    ).toBe(201);
  });
  it.each([
    { first: undefined, next: id, calls: 1, expected: undefined, message: null },
    { first: id, next: other, calls: 2, expected: other, message: null },
    {
      first: id,
      next: undefined,
      calls: 2,
      expected: undefined,
      message: 'mrpProposalId is required',
    },
    {
      first: id,
      next: 'bad',
      calls: 2,
      expected: undefined,
      message: 'mrpProposalId must be a UUID',
    },
    { first: null, next: id, calls: 2, expected: id, message: null },
  ])(
    'optional mrp double getter first=$first next=$next',
    async ({ first, next, calls, expected, message }) => {
      const f = fixture();
      const getter = vi.fn().mockReturnValueOnce(first).mockReturnValueOnce(next);
      const body = valid();
      Object.defineProperty(body, 'mrpProposalId', { enumerable: true, get: getter });
      const result = await f.dispatch(body);
      expect(getter).toHaveBeenCalledTimes(calls);
      if (message) {
        expect(result).toEqual(invalid(message));
        expect(f.create).not.toHaveBeenCalled();
      } else {
        expect(result.statusCode).toBe(201);
        expect(keyInput(f)?.mrpProposalId).toBe(expected);
        expect(Object.hasOwn(keyInput(f) ?? {}, 'mrpProposalId')).toBe(first !== undefined);
      }
    },
  );
  it('all input getters run in original order, mrp twice, before scope context/receiver call', async () => {
    const f = fixture();
    const reads: string[] = [];
    Object.defineProperty(f.context, 'actor', {
      get: () => {
        reads.push('actor');
        return actor;
      },
    });
    const body: Record<string, unknown> = { ...valid(), mrpProposalId: id };
    for (const key of fields) {
      const value = body[key];
      Object.defineProperty(body, key, {
        enumerable: true,
        get: () => {
          reads.push(key);
          return value;
        },
      });
    }
    f.create.mockImplementationOnce(() => {
      reads.push('create');
      return Promise.resolve(row);
    });
    expect((await f.dispatch(body)).statusCode).toBe(201);
    expect(reads).toEqual([
      'orderNumber',
      'itemVersionId',
      'routingVersionId',
      'mrpProposalId',
      'mrpProposalId',
      'plannedQuantity',
      'plannedStartAt',
      'plannedDueAt',
      'sourceReference',
      'actor',
      'create',
    ]);
  });
  it('query and idempotency header are not parsed or substituted for source', async () => {
    const f = fixture();
    const getter = vi.fn(() => {
      throw new Error('ignored query accessed');
    });
    expect(
      (
        await f.dispatch(valid(), {
          query: Object.defineProperty({}, 'limit', { enumerable: true, get: getter }),
          headers: { 'idempotency-key': 'x'.repeat(1000) },
        })
      ).statusCode,
    ).toBe(201);
    expect(keyInput(f)?.sourceReference).toBe('SOURCE-1');
    expect(getter).not.toHaveBeenCalled();
  });

  it('resolves create method before input getters and retains original receiver despite replacement', async () => {
    const f = fixture();
    const events: string[] = [];
    const replacement = vi.fn<Production['create']>().mockResolvedValue({ id: other });
    Object.defineProperty(f.production, 'create', {
      configurable: true,
      get: () => {
        events.push('method');
        return f.create;
      },
    });
    const body = valid();
    Object.defineProperty(body, 'orderNumber', {
      enumerable: true,
      get: () => {
        events.push('input');
        Object.defineProperty(f.production, 'create', { value: replacement });
        return 'WO-1';
      },
    });
    expect(await f.dispatch(body)).toEqual(response(201, row));
    expect(events).toEqual(['method', 'input']);
    expect(f.create).toHaveBeenCalledOnce();
    expect(f.create.mock.contexts[0]).toBe(f.production);
    expect(replacement).not.toHaveBeenCalled();
  });

  it('legal plan without read permission still creates with id/version fallback', async () => {
    const f = fixture({ noRead: true });
    expect(await f.dispatch()).toEqual(response(201, { id, version: 7 }));
    expect(f.create).toHaveBeenCalledOnce();
  });
  it('missing sourceReference never falls back to idempotency header', async () => {
    const f = fixture();
    expect(
      await f.dispatch(
        { ...valid(), sourceReference: undefined },
        { headers: { 'idempotency-key': 'HEADER-KEY' } },
      ),
    ).toEqual(invalid('sourceReference is required'));
    expect(f.create).not.toHaveBeenCalled();
  });
  it.each([
    { readFields: null, expected: row },
    { readFields: [], expected: { id } },
    { readFields: ['state'], expected: { id, state: 'DRAFT' } },
    { readFields: ['version', 'nested'], expected: { id, version: 7, nested } },
    { readFields: ['id', 'version', 'state', 'secret', 'nested'], expected: row },
    { readFields: ['state', 'state', 'absent'], expected: { id, state: 'DRAFT' } },
  ])(
    'independent read projection $readFields does not change write fields',
    async ({ readFields, expected }) => {
      const f = fixture({ writeFields: required, readFields });
      const result = await f.dispatch();
      expect(result).toEqual(response(201, expected));
      if (readFields === null) expect(result.body).toBe(row);
      else expect(result.body).not.toBe(row);
      expect(keyInput(f)).toEqual(valid());
      if (typeof result.body === 'object' && result.body !== null && 'nested' in result.body)
        expect(result.body.nested).toBe(nested);
    },
  );
  it('looks up independent read only after awaited create, and honors replacement/removed grant', async () => {
    const f = fixture({ readFields: [] });
    const readField = vi.fn(() => ['state']);
    f.create.mockImplementationOnce(() => {
      expect(f.get.mock.calls.filter(([cap]) => cap === 'production:read')).toHaveLength(0);
      f.permissions.set('production:read', {
        scopes: [],
        get fields() {
          return readField();
        },
      });
      return Promise.resolve(row);
    });
    expect(await f.dispatch()).toEqual(response(201, { id, state: 'DRAFT' }));
    expect(readField).toHaveBeenCalledOnce();
    const removed = fixture({ readFields: null });
    removed.create.mockImplementationOnce(() => {
      removed.permissions.delete('production:read');
      return Promise.resolve(row);
    });
    expect(await removed.dispatch()).toEqual(response(201, { id, version: 7 }));
  });
  it('null read fields never enumerate row getter; finite projection eagerly reads even excluded values', async () => {
    const getter = vi.fn(() => 'secret');
    const result: JsonObject = {
      id,
      version: 7,
      get secret() {
        return getter();
      },
    };
    const f = fixture({ readFields: null });
    f.create.mockResolvedValueOnce(result);
    const raw = await f.dispatch();
    expect(raw.statusCode).toBe(201);
    expect(raw.body).toBe(result);
    expect(getter).not.toHaveBeenCalled();
    const finite = fixture({ readFields: [] });
    finite.create.mockResolvedValueOnce(result);
    expect(await finite.dispatch()).toEqual(response(201, { id }));
    expect(getter).toHaveBeenCalledOnce();
  });
  it('projection preserves own key order, nested reference and special data keys, never fabricates id', async () => {
    const result: JsonObject = Object.fromEntries<JsonObject[string]>([
      ['toString', 'string-data'],
      ['__proto__', nested],
      ['constructor', 'constructor-data'],
      ['version', 7],
    ]);
    const f = fixture({ readFields: ['version', '__proto__', 'constructor', 'toString'] });
    f.create.mockResolvedValueOnce(result);
    const created = await f.dispatch();
    expect(created).toEqual(response(201, result));
    expect(created.body).not.toBe(result);
    expect(Object.keys(created.body as object)).toEqual([
      'toString',
      '__proto__',
      'constructor',
      'version',
    ]);
    expect(Object.getPrototypeOf(created.body)).toBe(Object.prototype);
    expect(Object.hasOwn(created.body as object, 'id')).toBe(false);
    expect((created.body as JsonObject).__proto__).toBe(nested);
  });
  it.each([
    { code: 'conflict', status: 409 },
    { code: 'forbidden', status: 403 },
    { code: 'not_found', status: 404 },
    { code: 'invalid_request', status: 400 },
  ] as const)(
    'repository DomainError $code keeps correlation and no early read',
    async ({ code, status }) => {
      const f = fixture();
      f.create.mockRejectedValueOnce(new DomainError(code, 'original repository error'));
      expect(await f.dispatch()).toEqual(error(status, code, 'original repository error'));
      expect(f.get.mock.calls.some(([cap]) => cap === 'production:read')).toBe(false);
    },
  );
});
