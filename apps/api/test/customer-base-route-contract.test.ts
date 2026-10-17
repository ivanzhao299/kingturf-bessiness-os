// Fixed HTTP expectations on 3a17d2f's inline customer base routes and broad wrapper.
import { describe, expect, it, vi } from 'vitest';
import { DomainError, type AuthorizationContext } from '@kingturf/domain';
import type { PermissionKey } from '@kingturf/types';
import { buildApp, type ApiDependencies } from '../src/app.js';

const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const correlationId = '33333333-3333-4333-8333-333333333333';
const actor = { companyId: 'tenant', employeeId: 'actor' };
const anchors = [{ scope: 'TEAM', organizationId: id }] as const;
type Grant = NonNullable<ReturnType<AuthorizationContext['permissions']['get']>>;
const grant: Grant = { scopes: ['TEAM'], fields: null };
const result = {
  id,
  version: 4,
  name: 'Customer',
  customerNumber: 'custom#!',
  private: 'raw',
  tags: [' a ', 'a', 'z'],
};
const body = { name: ' Customer ', customerNumber: ' custom#! ', tags: ['z', ' a ', 'a', 'z'] };
const input = { name: 'Customer', customerNumber: 'custom#!', tags: [' a ', 'a', 'z'] };
const base = '/api/v1/customers';
const detail = base + '/' + id;
function fixture(
  permissions: readonly (readonly [PermissionKey, Grant])[] = [
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
    listCustomers: vi.fn().mockResolvedValue([result]),
    findCustomer: vi.fn().mockResolvedValue(result),
    createCustomer: vi.fn().mockResolvedValue(result),
    assign: vi.fn(),
    createActivity: vi.fn(),
    transitionCustomer: vi.fn(),
    customer360: vi.fn(),
    createContact: vi.fn(),
    listLeads: vi.fn(),
    createLead: vi.fn(),
    claimLead: vi.fn(),
    transitionLead: vi.fn(),
  };
  const authenticate = vi.fn().mockResolvedValue(context);
  const app = buildApp({
    auth: { authenticate } as unknown as ApiDependencies['auth'],
    employees: {} as ApiDependencies['employees'],
    organizations: {} as ApiDependencies['organizations'],
    ...(available ? { crm: repository as unknown as NonNullable<ApiDependencies['crm']> } : {}),
  });
  const dispatch = (method: string, pathname: string, value: unknown = null, session = true) =>
    app.dispatch({
      method,
      pathname,
      body: value,
      query: { limit: 'bad', cursor: 'bad', name: 'ignored' },
      headers: {
        authorization: session ? 'Bearer fixture' : '',
        'x-correlation-id': correlationId,
        'idempotency-key': 'bad!'.repeat(40),
      },
    });
  return { repository, authenticate, dispatch };
}
const response = (statusCode: number, value: unknown) => ({
  statusCode,
  body: value,
  headers: {
    'x-correlation-id': correlationId,
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'SAMEORIGIN',
    'referrer-policy': 'strict-origin-when-cross-origin',

    'content-security-policy-report-only':
      "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'self'",
  },
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

describe('customer base read contracts', () => {
  it('list passes original receiver/actor/scopes/anchors, preserves order and literal nextCursor null', async () => {
    const f = fixture();
    const second = { id: correlationId, version: 1, name: 'Second' };
    f.repository.listCustomers.mockResolvedValueOnce([result, second]);
    expect(await f.dispatch('GET', base, { unexpected: true })).toEqual(
      response(200, { items: [result, second], nextCursor: null }),
    );
    expect(f.repository.listCustomers).toHaveBeenCalledExactlyOnceWith(actor, ['TEAM'], anchors);
    expect(f.repository.listCustomers.mock.contexts).toEqual([f.repository]);
    expect(f.repository.findCustomer).not.toHaveBeenCalled();
    expect(f.repository.createCustomer).not.toHaveBeenCalled();
  });
  it('detail passes id/actor/scopes/anchors without correlation or header/body/query parsing', async () => {
    const f = fixture();
    expect(await f.dispatch('GET', detail, false)).toEqual(response(200, result));
    expect(f.repository.findCustomer).toHaveBeenCalledExactlyOnceWith(id, actor, ['TEAM'], anchors);
    expect(f.repository.findCustomer.mock.contexts).toEqual([f.repository]);
    expect(f.repository.listCustomers).not.toHaveBeenCalled();
    expect(f.repository.createCustomer).not.toHaveBeenCalled();
  });
  for (const [read, projected] of [
    [grant, result],
    [
      { scopes: ['TEAM'], fields: ['name'] },
      { id, name: 'Customer' },
    ],
    [{ scopes: ['TEAM'], fields: [] }, { id }],
    [{ scopes: ['TEAM'] } as unknown as Grant, result],
  ] as const) {
    it(`list/detail projection fields ${JSON.stringify(read.fields)} without requesting fields`, async () => {
      const f = fixture([['customer:read', read]]);
      expect(await f.dispatch('GET', base)).toEqual(
        response(200, { items: [projected], nextCursor: null }),
      );
      expect(await f.dispatch('GET', detail)).toEqual(response(200, projected));
      expect(f.repository.listCustomers).toHaveBeenCalledExactlyOnceWith(actor, ['TEAM'], anchors);
      expect(f.repository.findCustomer).toHaveBeenCalledExactlyOnceWith(
        id,
        actor,
        ['TEAM'],
        anchors,
      );
    });
  }
  it('missing read or empty scope denies before detail UUID and ignores body', async () => {
    for (const permissions of [[], [['customer:read', { scopes: [], fields: null }]]] as const) {
      const f = fixture(permissions);
      expect(await f.dispatch('GET', base, null)).toEqual(denied);
      expect(await f.dispatch('GET', base + '/bad', { unsupported: true })).toEqual(denied);
      noCalls(f);
    }
  });
  it.each(['bad', '-', '360', 'deadbeef'])(
    'wide ID %s reaches authorized UUID validation',
    async (value) => {
      const f = fixture();
      expect(await f.dispatch('GET', base + '/' + value)).toEqual(
        invalid('customerId must be a UUID'),
      );
      noCalls(f);
    },
  );
  it('missing customer returns specific correlated404; empty list retains null cursor', async () => {
    const f = fixture();
    f.repository.findCustomer.mockResolvedValueOnce(null);
    expect(await f.dispatch('GET', detail)).toEqual(error(404, 'not_found', 'Customer not found'));
    f.repository.listCustomers.mockResolvedValueOnce([]);
    expect(await f.dispatch('GET', base)).toEqual(response(200, { items: [], nextCursor: null }));
  });
});

describe('customer creation fixed-field authorization and parsing', () => {
  it('input name/number trimmed but tags dedup/sort without trimming; actor/C only, original receiver/201', async () => {
    const f = fixture();
    expect(await f.dispatch('POST', base, body)).toEqual(response(201, result));
    expect(f.repository.createCustomer).toHaveBeenCalledExactlyOnceWith(
      input,
      actor,
      correlationId,
    );
    expect(f.repository.createCustomer.mock.contexts).toEqual([f.repository]);
    expect(f.repository.listCustomers).not.toHaveBeenCalled();
    expect(f.repository.findCustomer).not.toHaveBeenCalled();
  });
  it.each([null, [], false, 0, 'bad', { unknown: true }])(
    'create authorization before body/allow %j',
    async (value) => {
      const f = fixture([]);
      expect(await f.dispatch('POST', base, value)).toEqual(denied);
      noCalls(f);
    },
  );
  it('requests all three fixed fields including absent tags before body, not Object.keys', async () => {
    for (const fields of [
      [],
      ['name', 'customerNumber'],
      ['name', 'tags'],
      ['customerNumber', 'tags'],
    ]) {
      const f = fixture([['customer:create', { scopes: ['TEAM'], fields }]]);
      expect(await f.dispatch('POST', base, null)).toEqual(fieldDenied);
      expect(await f.dispatch('POST', base, { name: 'N', customerNumber: 'C' })).toEqual(
        fieldDenied,
      );
      expect(await f.dispatch('POST', base, { ...body, tags: undefined, unknown: true })).toEqual(
        fieldDenied,
      );
      noCalls(f);
    }
    const f = fixture([
      ['customer:create', { scopes: ['TEAM'], fields: ['name', 'customerNumber', 'tags'] }],
    ]);
    expect(await f.dispatch('POST', base, { name: 'N', customerNumber: 'C' })).toEqual(
      response(201, { id, version: 4 }),
    );
    expect(f.repository.createCustomer).toHaveBeenCalledExactlyOnceWith(
      { name: 'N', customerNumber: 'C', tags: [] },
      actor,
      correlationId,
    );
    const empty = fixture([['customer:create', { scopes: [], fields: null }]]);
    expect(await empty.dispatch('POST', base, null)).toEqual(denied);
    noCalls(empty);
  });
  it.each([null, [], false, 0, 'bad'])(
    'authorized body %j rejected before values',
    async (value) => {
      const f = fixture();
      expect(await f.dispatch('POST', base, value)).toEqual(
        invalid('A JSON object body is required'),
      );
      noCalls(f);
    },
  );
  it('allow unknown/server fields before values only after authorization', async () => {
    const f = fixture();
    expect(
      await f.dispatch('POST', base, { id, ownerId: id, status: 'ACTIVE', z: null, a: undefined }),
    ).toEqual(invalid('Unsupported fields: a, id, ownerId, status, z'));
    noCalls(f);
  });
  it.each([
    [{ name: '', customerNumber: '', tags: null }, 'name is required'],
    [{ customerNumber: '', tags: null }, 'customerNumber is required'],
    [{ tags: null }, 'tags must be an array of non-empty strings'],
  ])('name then customerNumber then tags co-bad priority %j', async (changed, message) => {
    const f = fixture();
    expect(await f.dispatch('POST', base, { ...body, ...changed })).toEqual(invalid(message));
    noCalls(f);
  });
  for (const field of ['name', 'customerNumber']) {
    it.each([undefined, null, false, 0, '', ' '])(
      `${field} %j must be original nonempty string`,
      async (value) => {
        const f = fixture();
        expect(await f.dispatch('POST', base, { ...body, [field]: value })).toEqual(
          invalid(`${field} is required`),
        );
        noCalls(f);
      },
    );
  }
  it('customerNumber is not stable code or length restricted at HTTP boundary', async () => {
    const f = fixture();
    const customerNumber = 'lower case#!' + 'x'.repeat(65);
    expect(await f.dispatch('POST', base, { ...body, customerNumber })).toEqual(
      response(201, result),
    );
    expect(f.repository.createCustomer).toHaveBeenCalledExactlyOnceWith(
      { ...input, customerNumber },
      actor,
      correlationId,
    );
  });
  it('tags absent/undefined alone defaults; [] remains valid', async () => {
    const f = fixture();
    for (const value of [
      { name: 'N', customerNumber: 'C' },
      { name: 'N', customerNumber: 'C', tags: undefined },
      { name: 'N', customerNumber: 'C', tags: [] },
    ]) {
      expect(await f.dispatch('POST', base, value)).toEqual(response(201, result));
      expect(f.repository.createCustomer).toHaveBeenLastCalledWith(
        { name: 'N', customerNumber: 'C', tags: [] },
        actor,
        correlationId,
      );
    }
    expect(f.repository.createCustomer).toHaveBeenCalledTimes(3);
  });
  it.each([null, false, 0, '', {}, [''], [' '], [1]])(
    'tags %j not replaced by default',
    async (tags) => {
      const f = fixture();
      expect(await f.dispatch('POST', base, { ...body, tags })).toEqual(
        invalid('tags must be an array of non-empty strings'),
      );
      noCalls(f);
    },
  );
  it('201 uses independent customer:read full/finite/empty/missing without new read authorization', async () => {
    for (const [read, dto] of [
      [grant, result],
      [
        { scopes: ['TEAM'], fields: ['name'] },
        { id, name: 'Customer' },
      ],
      [{ scopes: ['TEAM'], fields: [] }, { id }],
      [undefined, { id, version: 4 }],
    ] as const) {
      const permissions: (readonly [PermissionKey, Grant])[] = [
        ['customer:create', grant],
        ['customer-360:read', grant],
      ];
      if (read) permissions.push(['customer:read', read]);
      const f = fixture(permissions);
      expect(await f.dispatch('POST', base, body)).toEqual(response(201, dto));
      expect(f.repository.createCustomer).toHaveBeenCalledExactlyOnceWith(
        input,
        actor,
        correlationId,
      );
    }
  });
});

describe('broad customer matcher compatibility (not all CRM write semantics)', () => {
  it.each(['contacts', 'ownership', 'activities'])(
    'no-ID /%s aliases base GET and POST',
    async (nested) => {
      const f = fixture();
      const path = base + '/' + nested;
      expect(await f.dispatch('GET', path, { unrelated: true })).toEqual(
        response(200, { items: [result], nextCursor: null }),
      );
      expect(await f.dispatch('POST', path, body)).toEqual(response(201, result));
      expect(f.repository.listCustomers).toHaveBeenCalledExactlyOnceWith(actor, ['TEAM'], anchors);
      expect(f.repository.createCustomer).toHaveBeenCalledExactlyOnceWith(
        input,
        actor,
        correlationId,
      );
      for (const name of ['createContact', 'assign', 'createActivity', 'customer360'] as const)
        expect(f.repository[name]).not.toHaveBeenCalled();
    },
  );
  it('bare numeric360 is greedy ID, not no-ID list/creation or 360 view', async () => {
    const f = fixture();
    expect(await f.dispatch('GET', base + '/360')).toEqual(invalid('customerId must be a UUID'));
    expect(await f.dispatch('POST', base + '/360', body)).toEqual(missing);
    expect(await f.dispatch('PATCH', base + '/360', null)).toEqual(denied);
    noCalls(f);
  });
  it('numeric360 plus nested reaches corresponding branch authorization, not base', async () => {
    const f = fixture([]);
    expect(await f.dispatch('GET', base + '/360/360')).toEqual(denied);
    for (const nested of ['contacts', 'ownership', 'activities'])
      expect(await f.dispatch('POST', base + '/360/' + nested, {})).toEqual(denied);
    noCalls(f);
  });
  it('missing repo503 precedes method/body/permissions/UUID for every matching customer shape', async () => {
    const f = fixture([], false);
    for (const path of [
      base,
      detail,
      base + '/contacts',
      base + '/ownership',
      base + '/activities',
      base + '/360',
      detail + '/360',
      detail + '/contacts',
      base + '/bad',
    ]) {
      for (const method of ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'])
        expect(await f.dispatch(method, path, null)).toEqual(unavailable);
    }
    noCalls(f);
  });
  it('unsupported matched requests with repo do not preflight body/authorization and fall through', async () => {
    const f = fixture([]);
    for (const method of ['PUT', 'DELETE', 'OPTIONS', 'HEAD'])
      for (const path of [base, detail, detail + '/contacts', base + '/ownership', base + '/360'])
        expect(await f.dispatch(method, path, null)).toEqual(missing);
    for (const path of [base, base + '/contacts', base + '/ownership', base + '/activities'])
      expect(await f.dispatch('PATCH', path, null)).toEqual(missing);
    expect(await f.dispatch('POST', detail, null)).toEqual(missing);
    for (const nested of ['contacts', 'ownership', 'activities'])
      expect(await f.dispatch('GET', detail + '/' + nested, null)).toEqual(missing);
    noCalls(f);
  });
  it('nonmatches remain404 even without CRM; uppercase ID/path, slash, unknown nested do not widen', async () => {
    for (const available of [true, false]) {
      const f = fixture([], available);
      for (const path of [
        base + '/',
        detail + '/',
        base.toUpperCase(),
        base + '/' + id.toUpperCase(),
        base + '/not-a-uuid',
        detail + '/unknown',
        base + '/360/contacts/extra',
      ])
        expect(await f.dispatch('POST', path, null)).toEqual(missing);
      noCalls(f);
    }
  });
  it('global401 before matching repo503, no authenticate without token', async () => {
    const f = fixture([], false);
    expect(await f.dispatch('GET', base, null, false)).toEqual(
      error(401, 'authentication_required', 'A valid session is required'),
    );
    expect(f.authenticate).not.toHaveBeenCalled();
    noCalls(f);
    const rejected = fixture();
    rejected.authenticate.mockResolvedValueOnce(null);
    expect(await rejected.dispatch('POST', base, body)).toEqual(
      error(401, 'authentication_required', 'A valid session is required'),
    );
    noCalls(rejected);
  });
  it('siblings/lead/organization and commercial remain their own branches, no base calls', async () => {
    const f = fixture([]);
    for (const [method, path] of [
      ['POST', detail + '/contacts'],
      ['POST', detail + '/ownership'],
      ['POST', detail + '/activities'],
      ['GET', detail + '/360'],
      ['PATCH', detail],
      ['GET', '/api/v1/leads'],
      ['POST', '/api/v1/leads'],
      ['GET', '/api/v1/organizations'],
    ] as const)
      expect(await f.dispatch(method, path, {})).toEqual(denied);
    expect(await f.dispatch('GET', '/api/v1/quotes')).toEqual(missing);
    noCalls(f);
  });
});

for (const op of [
  { method: 'GET', path: base, repository: 'listCustomers' },
  { method: 'GET', path: detail, repository: 'findCustomer' },
  { method: 'POST', path: base, repository: 'createCustomer' },
] as const) {
  it(`${op.repository} DomainError and internal global envelopes`, async () => {
    const f = fixture();
    for (const [code, status] of [
      ['forbidden', 403],
      ['not_found', 404],
      ['conflict', 409],
      ['invalid_request', 400],
    ] as const) {
      f.repository[op.repository].mockRejectedValueOnce(new DomainError(code, 'fixed failure'));
      expect(await f.dispatch(op.method, op.path, body)).toEqual(
        error(status, code, 'fixed failure'),
      );
    }
    f.repository[op.repository].mockRejectedValueOnce(new Error('private failure'));
    expect(await f.dispatch(op.method, op.path, body)).toEqual(
      error(500, 'internal_error', 'Internal server error'),
    );
  });
}
