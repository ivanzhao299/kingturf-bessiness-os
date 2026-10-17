// Fixed against 46b2963's inline GET customer 360; no future route/helper imports.
import { describe, expect, it, vi } from 'vitest';
import { DomainError, type AuthorizationContext, type ScopeAnchor } from '@kingturf/domain';
import type { DataScope, PermissionKey } from '@kingturf/types';
import { buildApp, type ApiDependencies } from '../src/app.js';

type Crm = NonNullable<ApiDependencies['crm']>;
type Grant = NonNullable<ReturnType<AuthorizationContext['permissions']['get']>>;
type View = NonNullable<Awaited<ReturnType<Crm['customer360']>>>;
type FindArgs = Parameters<Crm['findCustomer']>;
type ViewArgs = Parameters<Crm['customer360']>;
const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const correlationId = '33333333-3333-4333-8333-333333333333';
const actor = { companyId: 'tenant', employeeId: id };
const path = `/api/v1/customers/${id}/360`;
const base: Grant = { scopes: ['TEAM'], fields: null };
const viewGrant: Grant = { scopes: ['REGION'], fields: null };
const baseAnchors: readonly ScopeAnchor[] = [{ scope: 'TEAM', organizationId: id }];
const viewAnchors: readonly ScopeAnchor[] = [{ scope: 'REGION', organizationId: 'view-region' }];
const sectionRows = [
  { name: 'ownership', capability: 'customer-ownership:read', scope: 'SELF' },
  { name: 'leads', capability: 'lead:read', scope: 'DEPARTMENT' },
  { name: 'opportunities', capability: 'opportunity:read', scope: 'COMPANY' },
  { name: 'activities', capability: 'customer-activity:read', scope: 'GROUP' },
] as const satisfies readonly { name: string; capability: PermissionKey; scope: DataScope }[];
const projectionRows = [
  { name: 'customer', capability: 'customer:read' },
  { name: 'ownership', capability: 'customer-ownership:read' },
  { name: 'leads', capability: 'lead:read' },
  { name: 'opportunities', capability: 'opportunity:read' },
  { name: 'activities', capability: 'customer-activity:read' },
] as const;
// Deliberately rich record-shaped mock DTOs exercise HTTP field projection only,
// not the real repository's DTO schema or scope filtering.
const raw = {
  customer: { id, name: 'second-query customer', hidden: 'customer secret', version: 7 },
  contacts: [
    { id: 'contact-2', name: 'Second', email: 'two@test.invalid', phone: '222', hidden: 'secret' },
    { id: 'contact-1', name: 'First', email: 'one@test.invalid', phone: '111', hidden: 'secret' },
  ],
  ownership: [
    { id: 'ownership-2', name: 'Second', hidden: 'secret' },
    { id: 'ownership-1', name: 'First', hidden: 'secret' },
  ],
  leads: [
    { id: 'lead-2', name: 'Second', hidden: 'secret' },
    { id: 'lead-1', name: 'First', hidden: 'secret' },
  ],
  opportunities: [
    { id: 'opportunity-2', name: 'Second', hidden: 'secret' },
    { id: 'opportunity-1', name: 'First', hidden: 'secret' },
  ],
  activities: [
    { id: 'activity-2', name: 'Second', hidden: 'secret' },
    { id: 'activity-1', name: 'First', hidden: 'secret' },
  ],
  unavailableSections: ['finance', 'orders'],
};
const mockView = raw as unknown as View;
const readable = { ...raw.customer, name: 'first-query customer' } as unknown as Awaited<
  ReturnType<Crm['findCustomer']>
>;
function fixture(available = true) {
  const permissions = new Map<PermissionKey, Grant>([
    ['customer:read', base],
    ['customer-360:read', viewGrant],
  ]);
  const scopeAnchors = new Map<PermissionKey, readonly ScopeAnchor[]>([
    ['customer:read', baseAnchors],
    ['customer-360:read', viewAnchors],
  ]);
  const context: AuthorizationContext = { actor, permissions, scopeAnchors };
  const events: string[] = [];
  const originalGet = permissions.get.bind(permissions);
  const originalHas = permissions.has.bind(permissions);
  const get = vi.spyOn(permissions, 'get').mockImplementation((capability) => {
    events.push(`get:${capability}`);
    return originalGet(capability);
  });
  const has = vi.spyOn(permissions, 'has').mockImplementation((capability) => {
    events.push(`has:${capability}`);
    return originalHas(capability);
  });
  const findCustomer = vi
    .fn<(...args: FindArgs) => ReturnType<Crm['findCustomer']>>()
    .mockImplementation(() => {
      events.push('find');
      return Promise.resolve(readable);
    });
  const customer360 = vi
    .fn<(...args: ViewArgs) => ReturnType<Crm['customer360']>>()
    .mockImplementation(() => {
      events.push('view');
      return Promise.resolve(mockView);
    });
  const repository = {
    findCustomer,
    customer360,
    listCustomers: vi.fn().mockResolvedValue([raw.customer]),
    createCustomer: vi.fn().mockResolvedValue(raw.customer),
    transitionCustomer: vi.fn(),
    createContact: vi.fn(),
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
    pathname = path,
    options: { method?: string; session?: boolean; body?: unknown } = {},
  ) =>
    app.dispatch({
      method: options.method ?? 'GET',
      pathname,
      body: options.body,
      query: { fields: 'hidden', customerId: 'bad', limit: 'bad' },
      headers: {
        authorization: options.session === false ? '' : 'Bearer fixture',
        'x-correlation-id': correlationId,
        'idempotency-key': 'x'.repeat(129),
      },
    });
  const section = (row: (typeof sectionRows)[number], fields: Grant['fields'] = null) => {
    const anchors: readonly ScopeAnchor[] = [{ scope: row.scope, organizationId: row.name }];
    permissions.set(row.capability, { scopes: [row.scope], fields });
    scopeAnchors.set(row.capability, anchors);
    return { scopes: [row.scope], anchors };
  };
  return { repository, permissions, scopeAnchors, events, get, has, dispatch, section };
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
const error = (status: number, code: string, message: string) =>
  response(status, { error: { code, message, correlationId } });
const denied = error(403, 'forbidden', 'Permission denied');
const notFound = error(404, 'not_found', 'Customer not found');
const missing = error(404, 'not_found', 'Route not found');
const unavailable = error(503, 'internal_error', 'CRM dependency unavailable');
const invalidId = error(400, 'invalid_request', 'customerId must be a UUID');
const noCalls = (f: ReturnType<typeof fixture>) => {
  for (const mock of Object.values(f.repository)) expect(mock).not.toHaveBeenCalled();
};
const expectQueries = (
  f: ReturnType<typeof fixture>,
  sensitive: ViewArgs[4] = { email: true, phone: true },
  sections: ViewArgs[5] = {},
) => {
  expect(f.repository.findCustomer).toHaveBeenCalledExactlyOnceWith(
    id,
    actor,
    base.scopes,
    baseAnchors,
  );
  expect(f.repository.customer360).toHaveBeenCalledExactlyOnceWith(
    id,
    actor,
    viewGrant.scopes,
    viewAnchors,
    sensitive,
    sections,
  );
  expect(f.repository.findCustomer.mock.contexts).toEqual([f.repository]);
  expect(f.repository.customer360.mock.contexts).toEqual([f.repository]);
  expect(f.repository.findCustomer.mock.invocationCallOrder[0]).toBeLessThan(
    f.repository.customer360.mock.invocationCallOrder[0] ?? 0,
  );
  for (const [name, mock] of Object.entries(f.repository))
    if (name !== 'findCustomer' && name !== 'customer360') expect(mock).not.toHaveBeenCalled();
};

describe('inline customer 360 ordered authorization and two reads', () => {
  it('two top grants precede UUID/find, four has checks follow visibility, six args without correlation', async () => {
    const f = fixture();
    expect(await f.dispatch()).toEqual(response(200, raw));
    expectQueries(f);
    expect(f.events.slice(0, 8)).toEqual([
      'get:customer:read',
      'get:customer:read',
      'get:customer-360:read',
      'get:customer-360:read',
      'find',
      'get:customer-360:read',
      'has:customer-ownership:read',
      'has:lead:read',
    ]);
    expect(f.has.mock.calls.map(([capability]) => capability)).toEqual(
      sectionRows.map((row) => row.capability),
    );
    expect(f.repository.customer360.mock.calls[0]).toHaveLength(6);
    expect(f.repository.findCustomer.mock.calls[0]).toHaveLength(4);
  });
  it.each([{ cap: 'customer:read' }, { cap: 'customer-360:read' }] as const)(
    'missing/empty $cap before invalid UUID/body',
    async ({ cap }) => {
      for (const mode of ['missing', 'empty'] as const) {
        const f = fixture();
        if (mode === 'missing') f.permissions.delete(cap);
        else f.permissions.set(cap, { scopes: [], fields: null });
        expect(await f.dispatch(path.replace(id, 'bad'), { body: [] })).toEqual(denied);
        noCalls(f);
        expect(f.has).not.toHaveBeenCalled();
      }
    },
  );
  it('base read fails first when both top grants are bad', async () => {
    const f = fixture();
    f.permissions.clear();
    expect(await f.dispatch(path.replace(id, 'bad'))).toEqual(denied);
    expect(f.get.mock.calls).toEqual([['customer:read']]);
    noCalls(f);
  });
  it('top authorization requests no fields; finite empty grants still permit lookup', async () => {
    const f = fixture();
    f.permissions.set('customer:read', { ...base, fields: [] });
    f.permissions.set('customer-360:read', { ...viewGrant, fields: [] });
    expect((await f.dispatch()).statusCode).toBe(200);
    expectQueries(f, { email: false, phone: false });
  });
  it.each(['bad', '-', 'deadbeef', '360'])(
    'raw hex-like ID %s authorized then UUID rejected',
    async (bad) => {
      const f = fixture();
      expect(await f.dispatch(path.replace(id, bad))).toEqual(invalidId);
      expect(f.get.mock.calls.map(([capability]) => capability)).toEqual([
        'customer:read',
        'customer:read',
        'customer-360:read',
        'customer-360:read',
      ]);
      noCalls(f);
    },
  );
  it('first null gives specific404 before existing empty section or second query', async () => {
    const f = fixture();
    for (const row of sectionRows) f.permissions.set(row.capability, { scopes: [], fields: null });
    f.repository.findCustomer.mockResolvedValue(null);
    expect(await f.dispatch()).toEqual(notFound);
    expect(f.repository.findCustomer).toHaveBeenCalledExactlyOnceWith(
      id,
      actor,
      base.scopes,
      baseAnchors,
    );
    expect(f.repository.customer360).not.toHaveBeenCalled();
    expect(f.has).not.toHaveBeenCalled();
    expect(
      f.get.mock.calls.filter(([capability]) => capability === 'customer-360:read'),
    ).toHaveLength(2);
  });
  it('all four sections carry their independent scope/anchor, insertion order unchanged', async () => {
    const f = fixture();
    const sections = {
      ownership: f.section(sectionRows[0]),
      leads: f.section(sectionRows[1]),
      opportunities: f.section(sectionRows[2]),
      activities: f.section(sectionRows[3]),
    };
    expect(await f.dispatch()).toEqual(response(200, raw));
    expectQueries(f, { email: true, phone: true }, sections);
    expect(Object.keys(f.repository.customer360.mock.calls[0]?.[5] ?? {})).toEqual([
      'ownership',
      'leads',
      'opportunities',
      'activities',
    ]);
  });
  it.each(sectionRows)(
    '$name absent skips authorization; present alone uses its grant',
    async (row) => {
      const f = fixture();
      const section = f.section(row, []);
      expect((await f.dispatch()).statusCode).toBe(200);
      expectQueries(f, { email: true, phone: true }, { [row.name]: section });
      for (const other of sectionRows)
        if (other.capability !== row.capability)
          expect(
            f.events.slice(0, f.events.indexOf('view')).includes(`get:${other.capability}`),
          ).toBe(false);
    },
  );
  it.each(sectionRows)(
    'empty $name scope after find stops later sections and second query',
    async (row) => {
      const f = fixture();
      for (const candidate of sectionRows)
        f.permissions.set(candidate.capability, {
          scopes: candidate === row ? [] : [candidate.scope],
          fields: null,
        });
      expect(await f.dispatch()).toEqual(denied);
      expect(f.repository.findCustomer).toHaveBeenCalledOnce();
      expect(f.repository.customer360).not.toHaveBeenCalled();
      const index = sectionRows.indexOf(row);
      expect(f.has.mock.calls.map(([capability]) => capability)).toEqual(
        sectionRows.slice(0, index + 1).map((candidate) => candidate.capability),
      );
    },
  );
  it.each(sectionRows.slice(0, 3))('several empty scopes stop at first $name', async (row) => {
    const f = fixture();
    const index = sectionRows.indexOf(row);
    for (const candidate of sectionRows.slice(index))
      f.permissions.set(candidate.capability, { scopes: [], fields: null });
    expect(await f.dispatch()).toEqual(denied);
    expect(f.has.mock.calls.map(([capability]) => capability)).toEqual(
      sectionRows.slice(0, index + 1).map((candidate) => candidate.capability),
    );
    expect(f.repository.findCustomer).toHaveBeenCalledOnce();
    expect(f.repository.customer360).not.toHaveBeenCalled();
  });
  it('second null remains specific404; first result does not substitute', async () => {
    const f = fixture();
    f.repository.customer360.mockResolvedValue(null);
    expect(await f.dispatch()).toEqual(notFound);
    expectQueries(f);
  });
  it.each([{ stage: 'find' }, { stage: 'view' }] as const)(
    'DomainError and unexpected error at $stage retain envelope',
    async ({ stage }) => {
      for (const thrown of [
        new DomainError('conflict', 'repository conflict'),
        new Error('private internal detail'),
      ]) {
        const f = fixture();
        (stage === 'find' ? f.repository.findCustomer : f.repository.customer360).mockRejectedValue(
          thrown,
        );
        expect(await f.dispatch()).toEqual(
          thrown instanceof DomainError
            ? error(409, 'conflict', 'repository conflict')
            : error(500, 'internal_error', 'Internal server error'),
        );
        if (stage === 'find') {
          expect(f.has).not.toHaveBeenCalled();
          expect(f.repository.customer360).not.toHaveBeenCalled();
        }
      }
    },
  );
});

describe('inline customer 360 sensitivity and independent field intersections', () => {
  it.each([
    { fields: null, email: true, phone: true },
    { fields: undefined, email: false, phone: false },
    { fields: [], email: false, phone: false },
    { fields: ['contacts.email'], email: true, phone: false },
    { fields: ['contacts.phone'], email: false, phone: true },
    { fields: ['contacts.phone', 'contacts.email'], email: true, phone: true },
    { fields: ['contacts.email.extra', 'email', 'phone'], email: false, phone: false },
  ])('exact sensitive fields $fields (undefined is not all)', async ({ fields, email, phone }) => {
    const f = fixture();
    f.permissions.set('customer-360:read', { ...viewGrant, fields } as unknown as Grant);
    expect((await f.dispatch()).statusCode).toBe(200);
    expectQueries(f, { email, phone });
  });
  it.each(projectionRows)(
    '$name: null view uses finite section, empty section is not null',
    async (row) => {
      for (const fields of [['name'], []] as const) {
        const f = fixture();
        f.permissions.set(row.capability, { scopes: ['TEAM'], fields });
        const r = await f.dispatch();
        expect(r.statusCode).toBe(200);
        const expected =
          row.name === 'customer'
            ? { id, ...(fields.length ? { name: raw.customer.name } : {}) }
            : raw[row.name].map((item) => ({
                id: item.id,
                ...(fields.length ? { name: item.name } : {}),
              }));
        expect((r.body as Record<string, unknown>)[row.name]).toEqual(expected);
      }
    },
  );
  it.each(projectionRows)(
    '$name: finite view uses null/missing fields or intersection; two conflicts',
    async (row) => {
      for (const fields of [null, undefined, ['name'], ['hidden'], []] as const) {
        const f = fixture();
        f.permissions.set('customer-360:read', {
          ...viewGrant,
          fields: [`${row.name}.name`, `${row.name}x.hidden`, 'unknown.hidden'],
        });
        f.permissions.set(row.capability, { scopes: ['TEAM'], fields } as unknown as Grant);
        const r = await f.dispatch();
        const showName = fields === null || fields === undefined || fields[0] === 'name';
        const expected =
          row.name === 'customer'
            ? { id, ...(showName ? { name: raw.customer.name } : {}) }
            : raw[row.name].map((item) => ({
                id: item.id,
                ...(showName ? { name: item.name } : {}),
              }));
        expect((r.body as Record<string, unknown>)[row.name]).toEqual(expected);
        expect(r.statusCode).toBe(200);
      }
    },
  );
  it.each(projectionRows)(
    '$name: empty/missing view fields yields only id even with unrestricted section',
    async (row) => {
      for (const fields of [[], undefined] as const) {
        const f = fixture();
        f.permissions.set('customer-360:read', { ...viewGrant, fields } as unknown as Grant);
        const r = await f.dispatch();
        expect((r.body as Record<string, unknown>)[row.name]).toEqual(
          row.name === 'customer' ? { id } : raw[row.name].map((item) => ({ id: item.id })),
        );
      }
    },
  );
  it('missing section capabilities do not HTTP-filter artificial repo records; contacts need no cap', async () => {
    const f = fixture();
    f.permissions.set('customer:read', { ...base, fields: ['name'] });
    f.permissions.set('customer-360:read', {
      ...viewGrant,
      fields: [
        'customer.name',
        'contacts.email',
        'ownership.name',
        'leads.name',
        'opportunities.name',
        'activities.name',
        'unknown.hidden',
        'customerx.hidden',
      ],
    });
    expect(await f.dispatch()).toEqual(
      response(200, {
        customer: { id, name: raw.customer.name },
        contacts: [
          { id: 'contact-2', email: 'two@test.invalid' },
          { id: 'contact-1', email: 'one@test.invalid' },
        ],
        ownership: [
          { id: 'ownership-2', name: 'Second' },
          { id: 'ownership-1', name: 'First' },
        ],
        leads: [
          { id: 'lead-2', name: 'Second' },
          { id: 'lead-1', name: 'First' },
        ],
        opportunities: [
          { id: 'opportunity-2', name: 'Second' },
          { id: 'opportunity-1', name: 'First' },
        ],
        activities: [
          { id: 'activity-2', name: 'Second' },
          { id: 'activity-1', name: 'First' },
        ],
        unavailableSections: raw.unavailableSections,
      }),
    );
    expectQueries(f, { email: true, phone: false });
  });
  it('captures view fields after first await but retains them across second await; section fields read after second await', async () => {
    const f = fixture();
    f.permissions.set('customer:read', { ...base, fields: ['hidden'] });
    f.permissions.set('customer-360:read', {
      ...viewGrant,
      fields: ['contacts.phone', 'customer.hidden'],
    });
    for (const row of sectionRows) f.section(row, ['name']);
    f.repository.findCustomer.mockImplementation(async () => {
      await Promise.resolve();
      f.permissions.set('customer-360:read', {
        ...viewGrant,
        fields: [
          'contacts.email',
          'customer.name',
          'ownership.hidden',
          'leads.hidden',
          'opportunities.hidden',
          'activities.hidden',
        ],
      });
      return readable;
    });
    f.repository.customer360.mockImplementation(async () => {
      await Promise.resolve();
      f.permissions.set('customer-360:read', {
        ...viewGrant,
        fields: ['contacts.phone', 'customer.hidden'],
      });
      f.permissions.set('customer:read', { ...base, fields: ['name'] });
      for (const row of sectionRows)
        f.permissions.set(row.capability, { scopes: [row.scope], fields: ['hidden'] });
      return mockView;
    });
    expect(await f.dispatch()).toEqual(
      response(200, {
        customer: { id, name: raw.customer.name },
        contacts: [
          { id: 'contact-2', email: 'two@test.invalid' },
          { id: 'contact-1', email: 'one@test.invalid' },
        ],
        ownership: [
          { id: 'ownership-2', hidden: 'secret' },
          { id: 'ownership-1', hidden: 'secret' },
        ],
        leads: [
          { id: 'lead-2', hidden: 'secret' },
          { id: 'lead-1', hidden: 'secret' },
        ],
        opportunities: [
          { id: 'opportunity-2', hidden: 'secret' },
          { id: 'opportunity-1', hidden: 'secret' },
        ],
        activities: [
          { id: 'activity-2', hidden: 'secret' },
          { id: 'activity-1', hidden: 'secret' },
        ],
        unavailableSections: raw.unavailableSections,
      }),
    );
    expect(f.repository.customer360.mock.calls[0]?.[4]).toEqual({ email: true, phone: false });
    // This controlled process-local mutation freezes read timing, not production permissions behavior.
  });
});

describe('inline customer 360 method/wide-wrapper/neighbor boundaries', () => {
  it('global401 before missing CRM', async () => {
    const f = fixture(false);
    expect(await f.dispatch(path, { session: false })).toEqual(
      error(401, 'authentication_required', 'A valid session is required'),
    );
    noCalls(f);
    expect(f.get).not.toHaveBeenCalled();
  });
  it.each([
    path,
    path.replace(id, 'bad'),
    '/api/v1/customers/360/360',
    '/api/v1/customers/360',
    '/api/v1/customers/contacts',
    `${path.slice(0, -4)}/contacts`,
  ])(
    'matched wrapper %s without repo is503 for supported/unsupported methods',
    async (pathname) => {
      const f = fixture(false);
      for (const method of ['GET', 'POST', 'DELETE'])
        expect(await f.dispatch(pathname, { method })).toEqual(unavailable);
      noCalls(f);
      expect(f.get).not.toHaveBeenCalled();
    },
  );
  it.each(['POST', 'PATCH', 'PUT', 'DELETE'])(
    'unsupported 360 %s falls through without grant/body validation',
    async (method) => {
      const f = fixture();
      f.permissions.clear();
      expect(await f.dispatch(path, { method })).toEqual(missing);
      noCalls(f);
      expect(f.get).not.toHaveBeenCalled();
    },
  );
  it.each([
    `${path}/`,
    `${path}/extra`,
    path.replace(id, id.toUpperCase()),
    path.replace(id, 'not-a-uuid'),
    path.replace('/360', '/unknown'),
  ])('unmatched %s does not invent503', async (pathname) => {
    const f = fixture(false);
    expect(await f.dispatch(pathname)).toEqual(missing);
    noCalls(f);
  });
  it('bare numeric360 is detail, not360 view, and neighbor contacts uses its own capability', async () => {
    const f = fixture();
    f.permissions.delete('customer-360:read');
    expect(await f.dispatch('/api/v1/customers/360')).toEqual(invalidId);
    expect(await f.dispatch(`/api/v1/customers/${id}/contacts`, { method: 'POST' })).toEqual(
      denied,
    );
    expect(await f.dispatch(`/api/v1/customers/${id}/contacts`)).toEqual(missing);
    expect(f.repository.customer360).not.toHaveBeenCalled();
    expect(f.get.mock.calls.some(([capability]) => capability === 'customer-360:read')).toBe(false);
    noCalls(f);
  });
  it.each(['contacts', 'ownership', 'activities'])(
    'no-ID $0 aliases remain base GET/POST',
    async (nested) => {
      const f = fixture();
      f.permissions.delete('customer-360:read');
      f.permissions.set('customer:create', { scopes: ['TEAM'], fields: null });
      expect(await f.dispatch(`/api/v1/customers/${nested}`)).toEqual(
        response(200, { items: [raw.customer], nextCursor: null }),
      );
      expect(
        await f.dispatch(`/api/v1/customers/${nested}`, {
          method: 'POST',
          body: { name: 'N', customerNumber: 'C' },
        }),
      ).toEqual(response(201, raw.customer));
      expect(f.repository.customer360).not.toHaveBeenCalled();
      expect(f.repository.findCustomer).not.toHaveBeenCalled();
    },
  );
  it.each([{ body: null }, { body: [] }, { body: 'bad' }, { body: { unsupported: true } }])(
    'GET body $body/header/query ignored',
    async ({ body }) => {
      const f = fixture();
      expect(await f.dispatch(path, { body })).toEqual(response(200, raw));
      expectQueries(f);
    },
  );
});
