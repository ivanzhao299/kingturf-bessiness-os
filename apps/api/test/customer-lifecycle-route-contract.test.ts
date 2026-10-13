// Fixed expectations on b18f644's inline customer lifecycle PATCH, before extraction.
import { describe, expect, it, vi } from 'vitest';
import { DomainError, type AuthorizationContext } from '@kingturf/domain';
import type { PermissionKey } from '@kingturf/types';
import { buildApp, type ApiDependencies } from '../src/app.js';

const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const correlationId = '33333333-3333-4333-8333-333333333333';
const actor = { companyId: 'tenant', employeeId: id };
const anchors = [{ scope: 'TEAM', organizationId: id }] as const;
type Grant = NonNullable<ReturnType<AuthorizationContext['permissions']['get']>>;
const grant: Grant = { scopes: ['TEAM'], fields: null };
const path = `/api/v1/customers/${id}`;
const body = { status: ' INACTIVE ', expectedVersion: 3, reason: ' archive reason ' };
const result = { id, version: 4, status: 'REPOSITORY_STATE', private: 'raw' };
function fixture(
  permissions: readonly (readonly [PermissionKey, Grant])[] = [
    ['customer:lifecycle', grant],
    ['customer:read', grant],
    ['customer:create', grant],
  ],
  available = true,
) {
  const context: AuthorizationContext = {
    actor,
    permissions: new Map(permissions),
    scopeAnchors: new Map(permissions.map(([capability]) => [capability, anchors])),
  };
  const repository = {
    transitionCustomer: vi.fn().mockResolvedValue(result),
    listCustomers: vi.fn().mockResolvedValue([result]),
    createCustomer: vi.fn().mockResolvedValue(result),
    findCustomer: vi.fn().mockResolvedValue(result),
    assign: vi.fn(),
    createActivity: vi.fn(),
    createContact: vi.fn(),
    customer360: vi.fn(),
    listLeads: vi.fn(),
    createLead: vi.fn(),
    claimLead: vi.fn(),
    transitionLead: vi.fn(),
  };
  const app = buildApp({
    auth: {
      authenticate: vi.fn().mockResolvedValue(context),
    } as unknown as ApiDependencies['auth'],
    employees: {} as ApiDependencies['employees'],
    organizations: {} as ApiDependencies['organizations'],
    ...(available ? { crm: repository as unknown as NonNullable<ApiDependencies['crm']> } : {}),
  });
  const dispatch = (
    pathname: string,
    value: unknown,
    options: { method?: string; session?: boolean; key?: string } = {},
  ) =>
    app.dispatch({
      method: options.method ?? 'PATCH',
      pathname,
      body: value,
      query: { status: 'ACTIVE', expectedVersion: 'bad', reason: 'query' },
      headers: {
        authorization: options.session === false ? '' : 'Bearer fixture',
        'x-correlation-id': correlationId,
        ...(options.key === undefined ? {} : { 'idempotency-key': options.key }),
      },
    });
  return { repository, dispatch };
}
const response = (statusCode: number, value: unknown) => ({
  statusCode,
  body: value,
  headers: { 'x-correlation-id': correlationId },
});
const error = (status: number, code: string, message: string) =>
  response(status, { error: { code, message, correlationId } });
const invalid = (message: string) => error(400, 'invalid_request', message);
const denied = error(403, 'forbidden', 'Permission denied');
const fieldDenied = error(403, 'forbidden', 'Field permission denied');
const missing = error(404, 'not_found', 'Route not found');
const unavailable = error(503, 'internal_error', 'CRM dependency unavailable');
const noCalls = (f: ReturnType<typeof fixture>) => {
  for (const mock of Object.values(f.repository)) expect(mock).not.toHaveBeenCalled();
};
const expectCall = (
  f: ReturnType<typeof fixture>,
  status = 'INACTIVE',
  version = 3,
  reason = 'archive reason',
) => {
  expect(f.repository.transitionCustomer).toHaveBeenCalledExactlyOnceWith(
    id,
    status,
    version,
    reason,
    actor,
    correlationId,
    ['TEAM'],
    anchors,
  );
  expect(f.repository.transitionCustomer.mock.contexts).toEqual([f.repository]);
  for (const [name, mock] of Object.entries(f.repository))
    if (name !== 'transitionCustomer') expect(mock).not.toHaveBeenCalled();
};

describe('inline customer lifecycle authorization and ordered parsing', () => {
  it('eight args, receiver, trim, 200 and independent read projection; header/query ignored', async () => {
    const f = fixture();
    expect(await f.dispatch(path, body, { key: 'x'.repeat(129) })).toEqual(response(200, result));
    expectCall(f);
  });
  it.each([
    { permissions: [] },
    { permissions: [['customer:read', grant]] },
    { permissions: [['customer:lifecycle', { scopes: [], fields: null }]] },
  ] as const)(
    'capability/nonempty scope precedes object/allow/UUID: %j',
    async ({ permissions }) => {
      const f = fixture(permissions);
      expect(await f.dispatch(path.replace(id, 'bad'), null)).toEqual(denied);
      expect(await f.dispatch(path, { z: true })).toEqual(denied);
      noCalls(f);
    },
  );
  it.each(['status', 'reason'])(
    'fixed field %s checked even absent, before body/UUID',
    async (field) => {
      const f = fixture([
        [
          'customer:lifecycle',
          {
            scopes: ['TEAM'],
            fields: ['status', 'reason'].filter((candidate) => candidate !== field),
          },
        ],
      ]);
      expect(await f.dispatch(path.replace(id, 'bad'), null)).toEqual(fieldDenied);
      expect(await f.dispatch(path, { ...body, [field]: undefined })).toEqual(fieldDenied);
      noCalls(f);
    },
  );
  it('expectedVersion is allowed but not requested for write authorization; no extra read grant', async () => {
    const f = fixture([['customer:lifecycle', { scopes: ['TEAM'], fields: ['status', 'reason'] }]]);
    expect(await f.dispatch(path, body)).toEqual(response(200, { id, version: 4 }));
    expectCall(f);
  });
  it.each([null, undefined, [], 'body', 1, true])(
    'object validation before UUID: %j',
    async (value) => {
      const f = fixture();
      expect(await f.dispatch(path.replace(id, 'bad'), value)).toEqual(
        invalid('A JSON object body is required'),
      );
      noCalls(f);
    },
  );
  it.each(['id', 'ownerId', 'idempotencyKey', 'z'])(
    'unknown field %s before UUID/status/version',
    async (field) => {
      const f = fixture();
      expect(await f.dispatch(path.replace(id, 'bad'), { [field]: true })).toEqual(
        invalid(`Unsupported fields: ${field}`),
      );
      noCalls(f);
    },
  );
  it('unknown fields retain sorted message', async () => {
    const f = fixture();
    expect(await f.dispatch(path, { z: 1, a: 2 })).toEqual(invalid('Unsupported fields: a, z'));
    noCalls(f);
  });
  it.each([
    [path.replace(id, 'bad'), {}, 'customerId must be a UUID'],
    [path, { status: '', expectedVersion: -1, reason: '' }, 'status is required'],
    [
      path,
      { status: 'ACTIVE', expectedVersion: -1, reason: '' },
      'expectedVersion must be a non-negative integer',
    ],
    [path, { status: 'ACTIVE', expectedVersion: 0, reason: '' }, 'reason is required'],
  ] as const)('ordered first error %s / %j', async (pathname, value, message) => {
    const f = fixture();
    expect(await f.dispatch(pathname, value)).toEqual(invalid(message));
    noCalls(f);
  });
  it.each([undefined, null, false, 1, '', '   '])(
    'status retains string-only rule: %j',
    async (status) => {
      const f = fixture();
      expect(await f.dispatch(path, { ...body, status })).toEqual(invalid('status is required'));
      noCalls(f);
    },
  );
  it.each(['PROSPECT', 'ACTIVE', 'INACTIVE', 'ARCHIVED', 'UNKNOWN_NEW_STATE'])(
    'no HTTP enum/state graph check: %s',
    async (status) => {
      const f = fixture();
      expect(await f.dispatch(path, { ...body, status: ` ${status} ` })).toEqual(
        response(200, result),
      );
      expectCall(f, status);
    },
  );
  it.each([0, Number.MAX_SAFE_INTEGER])(
    'original safe nonnegative integer accepted by mock: %j',
    async (expectedVersion) => {
      const f = fixture();
      expect(await f.dispatch(path, { ...body, expectedVersion })).toEqual(response(200, result));
      expectCall(f, 'INACTIVE', expectedVersion);
    },
  );
  it.each([undefined, null, false, -1, 0.5, '0', Number.MAX_SAFE_INTEGER + 1, NaN, Infinity])(
    'version rejects without coercion: %j',
    async (expectedVersion) => {
      const f = fixture();
      expect(await f.dispatch(path, { ...body, expectedVersion })).toEqual(
        invalid('expectedVersion must be a non-negative integer'),
      );
      noCalls(f);
    },
  );
  it.each([undefined, null, false, 1, '', '   '])(
    'reason string-only after version: %j',
    async (reason) => {
      const f = fixture();
      expect(await f.dispatch(path, { ...body, reason })).toEqual(invalid('reason is required'));
      noCalls(f);
    },
  );
  it.each([{ fields: [] }, { fields: ['status'] }])(
    'response fields follow read grant, not write grant: %j',
    async ({ fields }) => {
      const f = fixture([
        ['customer:lifecycle', grant],
        ['customer:read', { scopes: ['TEAM'], fields }],
      ]);
      expect(await f.dispatch(path, body)).toEqual(
        response(200, { id, ...(fields.length ? { status: result.status } : {}) }),
      );
      expectCall(f);
    },
  );
  it('repository conflict is translated without changing lifecycle semantics', async () => {
    const f = fixture();
    f.repository.transitionCustomer.mockRejectedValue(
      new DomainError('conflict', 'Illegal customer transition: ARCHIVED -> ACTIVE'),
    );
    expect(await f.dispatch(path, body)).toEqual(
      error(409, 'conflict', 'Illegal customer transition: ARCHIVED -> ACTIVE'),
    );
    expectCall(f);
  });
});

describe('inline lifecycle wide wrapper, aliases, neighbors and fallback', () => {
  it('global authentication precedes unavailable CRM', async () => {
    const f = fixture([], false);
    expect(await f.dispatch(path, null, { session: false })).toEqual(
      error(401, 'authentication_required', 'A valid session is required'),
    );
    noCalls(f);
  });
  it.each([
    '/api/v1/customers',
    '/api/v1/customers/contacts',
    '/api/v1/customers/ownership',
    '/api/v1/customers/activities',
    '/api/v1/customers/360',
    `${path}/ownership`,
    `${path}/activities`,
    `${path}/contacts`,
    `${path}/360`,
    path.replace(id, 'bad'),
  ])('matched wrapper without repo gives 503 regardless body/grant: %s', async (pathname) => {
    const f = fixture([], false);
    expect(await f.dispatch(pathname, null)).toEqual(unavailable);
    expect(await f.dispatch(pathname, null, { method: 'DELETE' })).toEqual(unavailable);
    noCalls(f);
  });
  it.each([
    '/api/v1/customers',
    '/api/v1/customers/contacts',
    '/api/v1/customers/ownership',
    '/api/v1/customers/activities',
    `${path}/ownership`,
    `${path}/activities`,
    `${path}/contacts`,
    `${path}/360`,
    `${path}/unknown`,
    `${path}/`,
    '/api/v1/customers/ZZZ',
  ])('not a lifecycle match: %s', async (pathname) => {
    const f = fixture();
    expect(await f.dispatch(pathname, body)).toEqual(missing);
    noCalls(f);
  });
  it('bare numeric 360 remains greedy ID; UUID validation not a stricter matcher', async () => {
    const f = fixture();
    expect(await f.dispatch('/api/v1/customers/360', body)).toEqual(
      invalid('customerId must be a UUID'),
    );
    noCalls(f);
  });
  it.each(['POST', 'DELETE', 'PUT'])('detail %s retains fallback', async (method) => {
    const f = fixture();
    expect(await f.dispatch(path, body, { method })).toEqual(missing);
    noCalls(f);
  });
  it('GET detail and 360, POST contacts/activities/ownership still use neighboring capabilities', async () => {
    for (const [pathname, method] of [
      [path, 'GET'],
      [`${path}/360`, 'GET'],
      [`${path}/contacts`, 'POST'],
      [`${path}/activities`, 'POST'],
      [`${path}/ownership`, 'POST'],
    ] as const) {
      const f = fixture([['customer:lifecycle', grant]]);
      expect(await f.dispatch(pathname, body, { method })).toEqual(denied);
      noCalls(f);
    }
  });
  it.each(['contacts', 'ownership', 'activities'])(
    'no-ID %s GET/POST aliases remain base, never lifecycle',
    async (nested) => {
      const f = fixture();
      expect(await f.dispatch(`/api/v1/customers/${nested}`, null, { method: 'GET' })).toEqual(
        response(200, { items: [result], nextCursor: null }),
      );
      expect(
        await f.dispatch(
          `/api/v1/customers/${nested}`,
          { name: ' N ', customerNumber: ' C ' },
          { method: 'POST' },
        ),
      ).toEqual(response(201, result));
      expect(f.repository.listCustomers).toHaveBeenCalledOnce();
      expect(f.repository.createCustomer).toHaveBeenCalledOnce();
      expect(f.repository.transitionCustomer).not.toHaveBeenCalled();
    },
  );
});
