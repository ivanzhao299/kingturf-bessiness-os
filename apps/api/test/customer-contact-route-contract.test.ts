// Frozen expectations on c62777a's inline customer contact POST, before extraction.
import { describe, expect, it, vi } from 'vitest';
import { DomainError, type AuthorizationContext } from '@kingturf/domain';
import type { PermissionKey } from '@kingturf/types';
import { buildApp, type ApiDependencies } from '../src/app.js';

type Crm = NonNullable<ApiDependencies['crm']>;
type ContactArgs = Parameters<Crm['createContact']>;
type Grant = NonNullable<ReturnType<AuthorizationContext['permissions']['get']>>;
const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const correlationId = '33333333-3333-4333-8333-333333333333';
const actor = { companyId: 'tenant', employeeId: id };
const anchors = [{ scope: 'TEAM', organizationId: id }] as const;
const grant: Grant = { scopes: ['TEAM'], fields: null };
const path = `/api/v1/customers/${id}/contacts`;
const body = {
  name: ' Buyer ',
  title: '  Sales Manager  ',
  email: ' Buyer@Example.TEST ',
  phone: ' +86 (138)-0013.8000 ',
  primary: true,
};
const input: ContactArgs[1] = {
  name: 'Buyer',
  title: '  Sales Manager  ',
  email: 'buyer@example.test',
  phone: '+8613800138000',
  primary: true,
};
const result = {
  id: 'contact-id',
  customerId: id,
  name: 'repository result',
  version: 1,
  email: 'private@example.test',
  private: 'raw',
};
function fixture(
  permissions: readonly (readonly [PermissionKey, Grant])[] = [
    ['customer:update', grant],
    ['customer-360:read', grant],
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
    createContact: vi
      .fn<(...args: ContactArgs) => Promise<typeof result>>()
      .mockResolvedValue(result),
    listCustomers: vi.fn().mockResolvedValue([result]),
    createCustomer: vi.fn().mockResolvedValue(result),
    findCustomer: vi.fn(),
    customer360: vi.fn(),
    transitionCustomer: vi.fn(),
    assign: vi.fn(),
    createActivity: vi.fn(),
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
    ...(available ? { crm: repository as unknown as Crm } : {}),
  });
  const dispatch = (
    pathname: string,
    value: unknown,
    options: { method?: string; session?: boolean } = {},
  ) =>
    app.dispatch({
      method: options.method ?? 'POST',
      pathname,
      body: value,
      query: { name: 'query', email: 'bad', phone: 'bad', primary: 'true' },
      headers: {
        authorization: options.session === false ? '' : 'Bearer fixture',
        'x-correlation-id': correlationId,
        'idempotency-key': 'x'.repeat(129),
      },
    });
  return { repository, dispatch };
}
const response = (statusCode: number, value: unknown) => ({
  statusCode,
  body: value,
  headers: {
    'x-correlation-id': correlationId,
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'SAMEORIGIN',
    'referrer-policy': 'strict-origin-when-cross-origin',
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
const expectCall = (f: ReturnType<typeof fixture>, expected: ContactArgs[1] = input) => {
  expect(f.repository.createContact).toHaveBeenCalledExactlyOnceWith(
    id,
    expected,
    actor,
    correlationId,
    ['TEAM'],
    anchors,
  );
  expect(f.repository.createContact.mock.contexts).toEqual([f.repository]);
  expect(f.repository.createContact.mock.calls[0]).toHaveLength(6);
  for (const [name, mock] of Object.entries(f.repository))
    if (name !== 'createContact') expect(mock).not.toHaveBeenCalled();
};

describe('inline contact fixed capability and identity precheck sequence', () => {
  it('six args/receiver/A/C/scopes/anchors, normalized identities, untrimmed title, 201; header/query ignored', async () => {
    const f = fixture();
    expect(await f.dispatch(path, body)).toEqual(response(201, result));
    expectCall(f);
  });
  it.each([
    { permissions: [] },
    { permissions: [['customer:create', grant]] },
    { permissions: [['customer:update', { scopes: [], fields: null }]] },
  ] as const)(
    'missing/wrong/empty capability before object/UUID: $permissions',
    async ({ permissions }) => {
      const f = fixture(permissions);
      expect(await f.dispatch(path.replace(id, 'bad'), null)).toEqual(denied);
      noCalls(f);
    },
  );
  it.each([{ fields: [] }, { fields: ['name'] }, { fields: ['contacts.email', 'contacts.phone'] }])(
    'fixed contacts field is mandatory before object: $fields',
    async ({ fields }) => {
      const f = fixture([['customer:update', { scopes: ['TEAM'], fields }]]);
      expect(await f.dispatch(path.replace(id, 'bad'), null)).toEqual(fieldDenied);
      expect(await f.dispatch(path, {})).toEqual(fieldDenied);
      noCalls(f);
    },
  );
  it('only contacts write field permits all five input fields; no additional read authorization', async () => {
    const f = fixture([['customer:update', { scopes: ['TEAM'], fields: ['contacts'] }]]);
    expect(await f.dispatch(path, body)).toEqual(response(201, { id: result.id, version: 1 }));
    expectCall(f);
  });
  it.each([
    { value: null },
    { value: undefined },
    { value: [] },
    { value: 'bad' },
    { value: true },
  ])('object error precedes identity/path: $value', async ({ value }) => {
    const f = fixture();
    expect(await f.dispatch(path.replace(id, 'bad'), value)).toEqual(
      invalid('A JSON object body is required'),
    );
    noCalls(f);
  });
  it.each(['id', 'customerId', 'version', 'ownerId', 'idempotencyKey', 'contacts'])(
    'unknown/server field %s precedes identity/path',
    async (field) => {
      const f = fixture();
      expect(
        await f.dispatch(path.replace(id, 'bad'), { ...body, email: false, [field]: true }),
      ).toEqual(invalid(`Unsupported fields: ${field}`));
      noCalls(f);
    },
  );
  it('unknown field message retains sorted order', async () => {
    const f = fixture();
    expect(await f.dispatch(path, { z: 1, a: 2 })).toEqual(invalid('Unsupported fields: a, z'));
    noCalls(f);
  });
  it.each([
    { value: { email: false, phone: 42 }, message: 'email must be a string' },
    { value: { email: 'bad-email', phone: 42 }, message: 'phone must be a string' },
    { value: { email: 'bad-email', phone: 'bad-phone' }, message: 'Contact email is malformed' },
    {
      value: { email: 'buyer@example.test', phone: 'bad-phone' },
      message: 'Contact phone is malformed',
    },
    { value: { email: null, phone: null }, message: 'Contact email or phone is required' },
    { value: {}, message: 'Contact email or phone is required' },
  ])('prechecks before both path UUID/name: $value', async ({ value, message }) => {
    const f = fixture();
    expect(await f.dispatch(path.replace(id, 'bad'), { ...value, name: '' })).toEqual(
      invalid(message),
    );
    noCalls(f);
  });
  it.each([{ value: false }, { value: 0 }, { value: 1 }, { value: [] }, { value: {} }])(
    'email bad type $value not defaulted/null even if phone valid',
    async ({ value }) => {
      const f = fixture();
      expect(await f.dispatch(path, { ...body, email: value })).toEqual(
        invalid('email must be a string'),
      );
      noCalls(f);
    },
  );
  it.each([{ value: false }, { value: 0 }, { value: 1 }, { value: [] }, { value: {} }])(
    'phone bad type $value checked before email format',
    async ({ value }) => {
      const f = fixture();
      expect(await f.dispatch(path, { ...body, email: 'bad-email', phone: value })).toEqual(
        invalid('phone must be a string'),
      );
      noCalls(f);
    },
  );
  it.each(['', '   ', 'missing-at.example.test', 'buyer@example', 'a@@b.test', 'a b@c.test'])(
    'email retains domain malformed error: %j',
    async (email) => {
      const f = fixture();
      expect(await f.dispatch(path, { ...body, email })).toEqual(
        invalid('Contact email is malformed'),
      );
      noCalls(f);
    },
  );
  it.each(['', '   ', '---', '+12', 'call 1234567', '1234567890123456', '++1234567'])(
    'phone retains domain malformed error: %j',
    async (phone) => {
      const f = fixture();
      expect(await f.dispatch(path, { ...body, phone })).toEqual(
        invalid('Contact phone is malformed'),
      );
      noCalls(f);
    },
  );
  it.each([
    { email: null, phone: undefined },
    { email: undefined, phone: null },
    { email: undefined, phone: undefined },
  ])('both nullish identities rejected: $email/$phone', async (identity) => {
    const f = fixture();
    expect(await f.dispatch(path, { ...body, ...identity })).toEqual(
      invalid('Contact email or phone is required'),
    );
    noCalls(f);
  });
  it.each([{ email: null }, { email: undefined }])(
    'phone-only accepts nullish email: $email',
    async ({ email }) => {
      const f = fixture();
      expect(await f.dispatch(path, { ...body, email })).toEqual(response(201, result));
      expectCall(f, { ...input, email: null });
    },
  );
  it.each([{ phone: null }, { phone: undefined }])(
    'email-only accepts nullish phone: $phone',
    async ({ phone }) => {
      const f = fixture();
      expect(await f.dispatch(path, { ...body, phone })).toEqual(response(201, result));
      expectCall(f, { ...input, phone: null });
    },
  );
  it.each([
    { phone: '1234567', normalized: '1234567' },
    { phone: '+123456789012345', normalized: '+123456789012345' },
    { phone: ' (202) 555-0100 ', normalized: '2025550100' },
  ])('original phone normalization/bounds $phone', async ({ phone, normalized }) => {
    const f = fixture();
    expect(await f.dispatch(path, { ...body, phone })).toEqual(response(201, result));
    expectCall(f, { ...input, phone: normalized });
  });
  it('valid identity prechecks then UUID, then name', async () => {
    const f = fixture();
    expect(await f.dispatch(path.replace(id, 'bad'), { ...body, name: '' })).toEqual(
      invalid('customerId must be a UUID'),
    );
    expect(await f.dispatch(path, { ...body, name: '' })).toEqual(invalid('name is required'));
    noCalls(f);
  });
  it.each([{ name: undefined }, { name: null }, { name: false }, { name: 1 }, { name: '   ' }])(
    'name stays nonempty string/trim: $name',
    async ({ name }) => {
      const f = fixture();
      expect(await f.dispatch(path, { ...body, name })).toEqual(invalid('name is required'));
      noCalls(f);
    },
  );
  it.each([{ title: '' }, { title: '  ' }, { title: ' Manager ' }])(
    'string title is original untrimmed value $title',
    async ({ title }) => {
      const f = fixture();
      expect(await f.dispatch(path, { ...body, title })).toEqual(response(201, result));
      expectCall(f, { ...input, title });
    },
  );
  it.each([
    { title: undefined },
    { title: null },
    { title: false },
    { title: 0 },
    { title: [] },
    { title: {} },
  ])('nonstring title becomes null: $title', async ({ title }) => {
    const f = fixture();
    expect(await f.dispatch(path, { ...body, title })).toEqual(response(201, result));
    expectCall(f, { ...input, title: null });
  });
  it.each([
    { primary: undefined },
    { primary: null },
    { primary: false },
    { primary: 0 },
    { primary: 1 },
    { primary: 'true' },
    { primary: [] },
    { primary: {} },
  ])('primary $primary is not boolean true', async ({ primary }) => {
    const f = fixture();
    expect(await f.dispatch(path, { ...body, primary })).toEqual(response(201, result));
    expectCall(f, { ...input, primary: false });
  });
});

describe('inline contact mutation DTO and repository envelopes', () => {
  it.each([
    { fields: null, projected: result },
    { fields: [], projected: { id: result.id } },
    { fields: ['name'], projected: { id: result.id, name: result.name } },
  ])('independent360 read fields $fields, not customer read', async ({ fields, projected }) => {
    const f = fixture([
      ['customer:update', grant],
      ['customer-360:read', { ...grant, fields }],
      ['customer:read', { ...grant, fields: ['email'] }],
    ]);
    expect(await f.dispatch(path, body)).toEqual(response(201, projected));
    expectCall(f);
  });
  it('customer/activity read cannot substitute absent360-read; version fallback', async () => {
    const f = fixture([
      ['customer:update', grant],
      ['customer:read', grant],
      ['customer-activity:read', grant],
    ]);
    expect(await f.dispatch(path, body)).toEqual(response(201, { id: result.id, version: 1 }));
    expectCall(f);
  });
  it.each([
    {
      thrown: new DomainError('conflict', 'Contact duplicate'),
      projected: error(409, 'conflict', 'Contact duplicate'),
    },
    {
      thrown: new Error('private error'),
      projected: error(500, 'internal_error', 'Internal server error'),
    },
  ])('repository error translates original envelope', async ({ thrown, projected }) => {
    const f = fixture();
    f.repository.createContact.mockRejectedValue(thrown);
    expect(await f.dispatch(path, body)).toEqual(projected);
    expectCall(f);
  });
});

describe('inline contact method/wide-wrapper/alias and neighbor boundaries', () => {
  it('global401 precedes missing repo and authorization', async () => {
    const f = fixture([], false);
    expect(await f.dispatch(path, null, { session: false })).toEqual(
      error(401, 'authentication_required', 'A valid session is required'),
    );
    noCalls(f);
  });
  it.each([
    path,
    path.replace(id, 'bad'),
    '/api/v1/customers/360/contacts',
    '/api/v1/customers/contacts',
    '/api/v1/customers/360',
    `/api/v1/customers/${id}/360`,
  ])('matched %s missing repo503 even unsupported methods/body', async (pathname) => {
    const f = fixture([], false);
    for (const method of ['POST', 'GET', 'PATCH', 'DELETE'])
      expect(await f.dispatch(pathname, null, { method })).toEqual(unavailable);
    noCalls(f);
  });
  it.each(['GET', 'PATCH', 'PUT', 'DELETE'])(
    'unsupported contact %s falls through without input check',
    async (method) => {
      const f = fixture([]);
      expect(await f.dispatch(path, null, { method })).toEqual(missing);
      noCalls(f);
    },
  );
  it.each([
    `${path}/`,
    `${path}/extra`,
    path.replace(id, id.toUpperCase()),
    path.replace(id, 'not-a-uuid'),
    path.replace('/contacts', '/unknown'),
  ])('unmatched %s remains404 even missing repo', async (pathname) => {
    const f = fixture([], false);
    expect(await f.dispatch(pathname, null)).toEqual(missing);
    noCalls(f);
  });
  it.each(['bad', '-', 'deadbeef', '360'])(
    'raw ID %s matches; identity precheck before UUID',
    async (bad) => {
      const f = fixture();
      expect(await f.dispatch(path.replace(id, bad), { ...body, email: 'bad-email' })).toEqual(
        invalid('Contact email is malformed'),
      );
      expect(await f.dispatch(path.replace(id, bad), body)).toEqual(
        invalid('customerId must be a UUID'),
      );
      noCalls(f);
    },
  );
  it('bare numeric360 POST is fallback, not contact and not view', async () => {
    const f = fixture();
    expect(await f.dispatch('/api/v1/customers/360', body)).toEqual(missing);
    noCalls(f);
  });
  it('neighbor360/detail/lifecycle/activity/ownership use their own capability', async () => {
    for (const [pathname, method] of [
      [`/api/v1/customers/${id}/360`, 'GET'],
      [`/api/v1/customers/${id}`, 'GET'],
      [`/api/v1/customers/${id}`, 'PATCH'],
      [`/api/v1/customers/${id}/activities`, 'POST'],
      [`/api/v1/customers/${id}/ownership`, 'POST'],
    ] as const) {
      const f = fixture([['customer:update', grant]]);
      expect(await f.dispatch(pathname, body, { method })).toEqual(denied);
      noCalls(f);
    }
  });
  it.each(['contacts', 'ownership', 'activities'])(
    'no-ID %s GET/POST remains base alias, not createContact',
    async (nested) => {
      const f = fixture();
      expect(await f.dispatch(`/api/v1/customers/${nested}`, null, { method: 'GET' })).toEqual(
        response(200, { items: [result], nextCursor: null }),
      );
      expect(
        await f.dispatch(`/api/v1/customers/${nested}`, { name: 'N', customerNumber: 'C' }),
      ).toEqual(response(201, result));
      expect(f.repository.listCustomers).toHaveBeenCalledOnce();
      expect(f.repository.createCustomer).toHaveBeenCalledOnce();
      expect(f.repository.createContact).not.toHaveBeenCalled();
    },
  );
});
