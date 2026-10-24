// Fixed on 7f1bea5's three inline exact lead base/pool branches, before extraction.
import { describe, expect, it, vi } from 'vitest';
import { DomainError, type AuthorizationContext, type ScopeAnchor } from '@kingturf/domain';
import type { PermissionKey } from '@kingturf/types';
import { buildApp, type ApiDependencies } from '../src/app.js';

type Crm = NonNullable<ApiDependencies['crm']>;
type Grant = NonNullable<ReturnType<AuthorizationContext['permissions']['get']>>;
type ListArgs = Parameters<Crm['listLeads']>;
type CreateArgs = Parameters<Crm['createLead']>;
const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const correlationId = '33333333-3333-4333-8333-333333333333';
const actor = { companyId: 'tenant', employeeId: id };
const read: Grant = { scopes: ['TEAM'], fields: null };
const poolRead: Grant = { scopes: ['SELF'], fields: null };
const write: Grant = { scopes: ['DEPARTMENT'], fields: null };
const readAnchors: readonly ScopeAnchor[] = [{ scope: 'TEAM', organizationId: id }];
const poolAnchors: readonly ScopeAnchor[] = [{ scope: 'SELF', organizationId: null }];
const writeAnchors: readonly ScopeAnchor[] = [{ scope: 'DEPARTMENT', organizationId: id }];
const listRows = [
  { id: 'lead-2', title: 'Second', source: 'two', private: 'secret' },
  { id: 'lead-1', title: 'First', source: 'one', private: 'secret' },
];
const created = {
  id: 'created',
  version: 3,
  title: 'repo title',
  source: 'repo source',
  private: 'secret',
};
const body = {
  title: ' New prospect ',
  source: ' NEW_SOURCE!? ',
  customerId: ` ${id} `,
  pool: true,
};
const input: CreateArgs[0] = {
  title: 'New prospect',
  source: 'NEW_SOURCE!?',
  customerId: id,
  pool: true,
};
const listRoutes = [
  {
    path: '/api/v1/leads',
    capability: 'lead:read',
    grant: read,
    anchors: readAnchors,
    pool: false,
  },
  {
    path: '/api/v1/leads/pool',
    capability: 'lead-pool:read',
    grant: poolRead,
    anchors: poolAnchors,
    pool: true,
  },
] as const;
const createPath = '/api/v1/leads';
function fixture(
  entries: readonly (readonly [PermissionKey, Grant])[] = [
    ['lead:read', read],
    ['lead-pool:read', poolRead],
    ['lead:create', write],
  ],
  available = true,
) {
  const permissions = new Map(entries);
  const context: AuthorizationContext = {
    actor,
    permissions,
    scopeAnchors: new Map<PermissionKey, readonly ScopeAnchor[]>([
      ['lead:read', readAnchors],
      ['lead-pool:read', poolAnchors],
      ['lead:create', writeAnchors],
    ]),
  };
  const events: string[] = [];
  const originalGet = permissions.get.bind(permissions);
  const get = vi.spyOn(permissions, 'get').mockImplementation((capability) => {
    events.push(`get:${capability}`);
    return originalGet(capability);
  });
  const repository = {
    listLeads: vi.fn<(...args: ListArgs) => Promise<typeof listRows>>().mockImplementation(() => {
      events.push('list');
      return Promise.resolve(listRows);
    }),
    createLead: vi
      .fn<(...args: CreateArgs) => Promise<typeof created>>()
      .mockResolvedValue(created),
    findCustomer: vi.fn(),
    customer360: vi.fn(),
    listCustomers: vi.fn(),
    createCustomer: vi.fn(),
    transitionCustomer: vi.fn(),
    createContact: vi.fn(),
    assign: vi.fn(),
    createActivity: vi.fn(),
    claimLead: vi.fn(),
    transitionLead: vi.fn(),
  };
  const app = buildApp({
    auth: {
      authenticate: vi.fn().mockResolvedValue(context),
    } as unknown as ApiDependencies['auth'],
    employees: {} as ApiDependencies['employees'],
    organizations: {} as ApiDependencies['organizations'],
    ...(available ? { crm: repository as unknown as Crm } : {}),
  });
  const dispatch = (
    pathname: string,
    value: unknown,
    options: { method?: string; session?: boolean } = {},
  ) =>
    app.dispatch({
      method: options.method ?? 'GET',
      pathname,
      body: value,
      query: {
        fields: 'private',
        pool: 'true',
        customerId: 'bad',
        title: 'query',
        source: 'query',
        limit: 'bad',
        cursor: 'bad',
      },
      headers: {
        authorization: options.session === false ? '' : 'Bearer fixture',
        'x-correlation-id': correlationId,
        'idempotency-key': 'x'.repeat(129),
      },
    });
  return { repository, permissions, get, events, dispatch };
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
const expectList = (f: ReturnType<typeof fixture>, route: (typeof listRoutes)[number]) => {
  if (route.pool)
    expect(f.repository.listLeads).toHaveBeenCalledExactlyOnceWith(
      actor,
      route.grant.scopes,
      route.anchors,
      true,
    );
  else
    expect(f.repository.listLeads).toHaveBeenCalledExactlyOnceWith(
      actor,
      route.grant.scopes,
      route.anchors,
    );
  expect(f.repository.listLeads.mock.calls[0]).toHaveLength(route.pool ? 4 : 3);
  expect(f.repository.listLeads.mock.contexts).toEqual([f.repository]);
  for (const [name, mock] of Object.entries(f.repository))
    if (name !== 'listLeads') expect(mock).not.toHaveBeenCalled();
};
const expectCreate = (f: ReturnType<typeof fixture>, expected: CreateArgs[0] = input) => {
  expect(f.repository.createLead).toHaveBeenCalledExactlyOnceWith(
    expected,
    actor,
    correlationId,
    write.scopes,
    writeAnchors,
  );
  expect(f.repository.createLead.mock.calls[0]).toHaveLength(5);
  expect(f.repository.createLead.mock.contexts).toEqual([f.repository]);
  for (const [name, mock] of Object.entries(f.repository))
    if (name !== 'createLead') expect(mock).not.toHaveBeenCalled();
};

describe('inline lead lists: distinct capabilities, call arity and pre-await fields', () => {
  it.each(listRoutes)(
    '$path exact args, order/nullcursor, distinct read scopes/anchors and no fields request',
    async (route) => {
      const f = fixture();
      expect(await f.dispatch(route.path, { unsupported: true })).toEqual(
        response(200, { items: listRows, nextCursor: null }),
      );
      expectList(f, route);
      expect(f.events).toEqual([
        `get:${route.capability}`,
        `get:${route.capability}`,
        `get:${route.capability}`,
        'list',
      ]);
    },
  );
  it.each(listRoutes)(
    '$path missing/empty scopes rejects, other read cap cannot substitute',
    async (route) => {
      for (const mode of ['missing', 'empty'] as const) {
        const f = fixture();
        if (mode === 'missing') f.permissions.delete(route.capability);
        else f.permissions.set(route.capability, { scopes: [], fields: null });
        expect(await f.dispatch(route.path, null)).toEqual(denied);
        noCalls(f);
      }
    },
  );
  it.each(listRoutes)(
    '$path uses own null/undefined/empty/finite fields, not other read fields',
    async (route) => {
      for (const fields of [null, undefined, [], ['title']] as const) {
        const f = fixture();
        for (const other of listRoutes)
          f.permissions.set(other.capability, { ...other.grant, fields: ['source'] });
        f.permissions.set(route.capability, { ...route.grant, fields } as unknown as Grant);
        const items =
          fields === null || fields === undefined
            ? listRows
            : [
                { id: 'lead-2', ...(fields.length ? { title: 'Second' } : {}) },
                { id: 'lead-1', ...(fields.length ? { title: 'First' } : {}) },
              ];
        expect(await f.dispatch(route.path, [])).toEqual(
          response(200, { items, nextCursor: null }),
        );
        expectList(f, route);
      }
    },
  );
  it.each(listRoutes)(
    '$path captures fields before list await, without copying permissions or rereading fields after',
    async (route) => {
      const f = fixture();
      f.permissions.set(route.capability, { ...route.grant, fields: ['title'] });
      f.repository.listLeads.mockImplementation(async () => {
        await Promise.resolve();
        f.permissions.set(route.capability, { ...route.grant, fields: ['source'] });
        return listRows;
      });
      expect(await f.dispatch(route.path, null)).toEqual(
        response(200, {
          items: [
            { id: 'lead-2', title: 'Second' },
            { id: 'lead-1', title: 'First' },
          ],
          nextCursor: null,
        }),
      );
      expectList(f, route);
      // Controlled process-local hook freezes HTTP read timing, not production dynamic permissions.
    },
  );
  it.each(listRoutes)(
    '$path empty repository still returns200 empty list/nullcursor',
    async (route) => {
      const f = fixture();
      f.repository.listLeads.mockResolvedValue([]);
      expect(await f.dispatch(route.path, 'bad body')).toEqual(
        response(200, { items: [], nextCursor: null }),
      );
      expectList(f, route);
    },
  );
  it.each(listRoutes)(
    '$path GET ignores null/array/scalar bodies and malformed header/query',
    async (route) => {
      for (const value of [null, [], 'bad', false]) {
        const f = fixture();
        expect(await f.dispatch(route.path, value)).toEqual(
          response(200, { items: listRows, nextCursor: null }),
        );
        expectList(f, route);
      }
    },
  );
  it.each(listRoutes)('$path domain/internal error envelopes', async (route) => {
    for (const thrown of [
      new DomainError('conflict', 'repository conflict'),
      new Error('private error'),
    ]) {
      const f = fixture();
      f.repository.listLeads.mockRejectedValue(thrown);
      expect(await f.dispatch(route.path, null)).toEqual(
        thrown instanceof DomainError
          ? error(409, 'conflict', 'repository conflict')
          : error(500, 'internal_error', 'Internal server error'),
      );
      expectList(f, route);
    }
  });
});

describe('inline lead create fixed four fields and ordered input', () => {
  it('five args/receiver, trimmed title/plain source, customer UUID, strictpool,201; no key/query check', async () => {
    const f = fixture();
    expect(await f.dispatch(createPath, body, { method: 'POST' })).toEqual(response(201, created));
    expectCreate(f);
  });
  it.each([
    { entries: [] },
    { entries: [['lead:read', read]] },
    { entries: [['lead:create', { scopes: [], fields: null }]] },
  ] as const)('capability and scopes before object/allow: $entries', async ({ entries }) => {
    const f = fixture(entries);
    expect(await f.dispatch(createPath, null, { method: 'POST' })).toEqual(denied);
    noCalls(f);
  });
  it.each(['title', 'source', 'customerId', 'pool'])(
    'fixed field %s requested even absent/defaultable, before object',
    async (field) => {
      const f = fixture([
        [
          'lead:create',
          {
            ...write,
            fields: ['title', 'source', 'customerId', 'pool'].filter(
              (candidate) => candidate !== field,
            ),
          },
        ],
      ]);
      expect(await f.dispatch(createPath, null, { method: 'POST' })).toEqual(fieldDenied);
      expect(await f.dispatch(createPath, { title: 'T', source: 'S' }, { method: 'POST' })).toEqual(
        fieldDenied,
      );
      noCalls(f);
    },
  );
  it('all four write fields permit optional defaults, no extra read grant', async () => {
    const f = fixture([
      ['lead:create', { ...write, fields: ['title', 'source', 'customerId', 'pool'] }],
    ]);
    expect(
      await f.dispatch(createPath, { title: ' T ', source: ' S ' }, { method: 'POST' }),
    ).toEqual(response(201, { id: created.id, version: 3 }));
    expectCreate(f, { title: 'T', source: 'S', customerId: null, pool: false });
  });
  it.each([
    { value: null },
    { value: undefined },
    { value: [] },
    { value: 'bad' },
    { value: false },
  ])('object first: $value', async ({ value }) => {
    const f = fixture();
    expect(await f.dispatch(createPath, value, { method: 'POST' })).toEqual(
      invalid('A JSON object body is required'),
    );
    noCalls(f);
  });
  it.each(['id', 'status', 'ownerId', 'version', 'idempotencyKey'])(
    'unknown/server field %s before title/source/UUID',
    async (field) => {
      const f = fixture();
      expect(await f.dispatch(createPath, { [field]: true }, { method: 'POST' })).toEqual(
        invalid(`Unsupported fields: ${field}`),
      );
      noCalls(f);
    },
  );
  it('unknown keys sorted and title/source/UUID first-error order', async () => {
    const f = fixture();
    expect(await f.dispatch(createPath, { z: 1, a: 2 }, { method: 'POST' })).toEqual(
      invalid('Unsupported fields: a, z'),
    );
    expect(
      await f.dispatch(
        createPath,
        { title: '', source: '', customerId: 'bad' },
        { method: 'POST' },
      ),
    ).toEqual(invalid('title is required'));
    expect(
      await f.dispatch(
        createPath,
        { title: 'T', source: '', customerId: 'bad' },
        { method: 'POST' },
      ),
    ).toEqual(invalid('source is required'));
    expect(
      await f.dispatch(
        createPath,
        { title: 'T', source: 'S', customerId: 'bad' },
        { method: 'POST' },
      ),
    ).toEqual(invalid('customerId must be a UUID'));
    noCalls(f);
  });
  it.each([
    { value: undefined },
    { value: null },
    { value: false },
    { value: 0 },
    { value: '' },
    { value: '   ' },
  ])('title/source each string-only: $value', async ({ value }) => {
    for (const field of ['title', 'source']) {
      const f = fixture();
      expect(await f.dispatch(createPath, { ...body, [field]: value }, { method: 'POST' })).toEqual(
        invalid(`${field} is required`),
      );
      noCalls(f);
    }
  });
  it.each([{ customerId: null }, { customerId: undefined }])(
    'customerId only nullish defaults null: $customerId',
    async ({ customerId }) => {
      const f = fixture();
      expect(await f.dispatch(createPath, { ...body, customerId }, { method: 'POST' })).toEqual(
        response(201, created),
      );
      expectCreate(f, { ...input, customerId: null });
    },
  );
  it.each([
    { customerId: '', message: 'customerId is required' },
    { customerId: false, message: 'customerId is required' },
    { customerId: 0, message: 'customerId is required' },
    { customerId: [], message: 'customerId is required' },
    { customerId: {}, message: 'customerId is required' },
    { customerId: 'bad', message: 'customerId must be a UUID' },
  ])(
    'other falsey/types reach original UUID parser: $customerId',
    async ({ customerId, message }) => {
      const f = fixture();
      expect(await f.dispatch(createPath, { ...body, customerId }, { method: 'POST' })).toEqual(
        invalid(message),
      );
      noCalls(f);
    },
  );
  it.each([
    { pool: undefined },
    { pool: null },
    { pool: false },
    { pool: 0 },
    { pool: 1 },
    { pool: 'true' },
    { pool: [] },
    { pool: {} },
  ])('pool $pool not strict true, no HTTP type restriction', async ({ pool }) => {
    const f = fixture();
    expect(await f.dispatch(createPath, { ...body, pool }, { method: 'POST' })).toEqual(
      response(201, created),
    );
    expectCreate(f, { ...input, pool: false });
  });
  it.each([
    { fields: null, projected: created },
    { fields: [], projected: { id: created.id } },
    { fields: ['title'], projected: { id: created.id, title: created.title } },
  ])('201 independent lead read fields $fields, not pool read', async ({ fields, projected }) => {
    const f = fixture([
      ['lead:create', write],
      ['lead:read', { ...read, fields }],
      ['lead-pool:read', poolRead],
    ]);
    expect(await f.dispatch(createPath, body, { method: 'POST' })).toEqual(
      response(201, projected),
    );
    expectCreate(f);
  });
  it('pool read cannot substitute absent lead-read, version fallback', async () => {
    const f = fixture([
      ['lead:create', write],
      ['lead-pool:read', poolRead],
    ]);
    expect(await f.dispatch(createPath, body, { method: 'POST' })).toEqual(
      response(201, { id: created.id, version: 3 }),
    );
    expectCreate(f);
  });
  it('create domain/internal error envelopes preserve correlation', async () => {
    for (const thrown of [
      new DomainError('conflict', 'repository conflict'),
      new Error('private error'),
    ]) {
      const f = fixture();
      f.repository.createLead.mockRejectedValue(thrown);
      expect(await f.dispatch(createPath, body, { method: 'POST' })).toEqual(
        thrown instanceof DomainError
          ? error(409, 'conflict', 'repository conflict')
          : error(500, 'internal_error', 'Internal server error'),
      );
      expectCreate(f);
    }
  });
});

describe('inline lead three exact supports vs missing repo/fallback/neighbors', () => {
  it.each([
    { path: createPath, method: 'GET' },
    { path: createPath, method: 'POST' },
    { path: '/api/v1/leads/pool', method: 'GET' },
  ])('$method $path global401 then missing-repo503 then auth/input', async ({ path, method }) => {
    const f = fixture([], false);
    expect(await f.dispatch(path, null, { method, session: false })).toEqual(
      error(401, 'authentication_required', 'A valid session is required'),
    );
    expect(await f.dispatch(path, null, { method })).toEqual(unavailable);
    expect(f.get).not.toHaveBeenCalled();
    noCalls(f);
  });
  it.each([
    { path: createPath, method: 'PATCH' },
    { path: createPath, method: 'DELETE' },
    { path: '/api/v1/leads/pool', method: 'POST' },
    { path: '/api/v1/leads/pool', method: 'PATCH' },
    { path: `/api/v1/leads/${id}`, method: 'GET' },
    { path: '/api/v1/leads/claim', method: 'POST' },
    { path: '/api/v1/leads/assign', method: 'POST' },
    { path: `/api/v1/leads/${id}/unknown`, method: 'POST' },
    { path: `/api/v1/leads/${id}/claim`, method: 'GET' },
    { path: `/api/v1/leads/${id}/transition`, method: 'GET' },
    { path: '/api/v1/leads/', method: 'GET' },
    { path: '/api/v1/leads/pool/', method: 'GET' },
    { path: '/api/v1/Leads', method: 'GET' },
  ])(
    'unsupported $method $path remains404 even absentCRM; no auth/body',
    async ({ path, method }) => {
      for (const available of [true, false]) {
        const f = fixture([], available);
        expect(await f.dispatch(path, null, { method })).toEqual(missing);
        expect(f.get).not.toHaveBeenCalled();
        noCalls(f);
      }
    },
  );
  it.each([
    { path: `/api/v1/leads/${id}/claim`, method: 'POST' },
    { path: `/api/v1/leads/${id}/transition`, method: 'POST' },
    { path: '/api/v1/customers', method: 'GET' },
  ])('neighbor $method $path keeps own auth/CRM503, not base route', async ({ path, method }) => {
    for (const available of [true, false]) {
      const f = fixture([], available);
      expect(await f.dispatch(path, {}, { method })).toEqual(available ? denied : unavailable);
      noCalls(f);
    }
  });
  it('organization neighbor remains its own403 regardless CRM', async () => {
    for (const available of [true, false]) {
      const f = fixture([], available);
      expect(await f.dispatch('/api/v1/organizations', null)).toEqual(denied);
      noCalls(f);
    }
  });
});
