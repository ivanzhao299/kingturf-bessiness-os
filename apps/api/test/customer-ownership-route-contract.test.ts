// Fixed expectations on 4696721's inline customer ownership route, before extraction.
import { describe, expect, it, vi } from 'vitest';
import { DomainError, type AuthorizationContext, type ScopeAnchor } from '@kingturf/domain';
import type { PermissionKey } from '@kingturf/types';
import { buildApp, type ApiDependencies } from '../src/app.js';

const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const assigneeId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const correlationId = '33333333-3333-4333-8333-333333333333';
const actor = { companyId: 'tenant', employeeId: id };
const assignAnchors = [{ scope: 'TEAM', organizationId: id }] as const;
const reassignAnchors = [{ scope: 'REGION', organizationId: assigneeId }] as const;
type Grant = NonNullable<ReturnType<AuthorizationContext['permissions']['get']>>;
const assignGrant: Grant = { scopes: ['TEAM'], fields: null };
const reassignGrant: Grant = { scopes: ['REGION', 'TEAM'], fields: null };
const path = `/api/v1/customers/${id}/ownership`;
const body = { assigneeId, expectedVersion: 3, reason: ' territory change ' };
const result = { id, version: 4, ownerId: assigneeId, private: 'raw' };
const modes = [
  {
    name: 'assign',
    capability: 'customer-ownership:assign',
    other: 'customer-ownership:reassign',
    reassignment: false,
    scopes: ['TEAM'],
    anchors: assignAnchors,
    body,
  },
  {
    name: 'reassign',
    capability: 'customer-ownership:reassign',
    other: 'customer-ownership:assign',
    reassignment: true,
    scopes: ['REGION', 'TEAM'],
    anchors: reassignAnchors,
    body: { ...body, reassignment: true },
  },
] as const;
function fixture(
  permissions: readonly (readonly [PermissionKey, Grant])[] = [
    ['customer-ownership:assign', assignGrant],
    ['customer-ownership:reassign', reassignGrant],
    ['customer:read', assignGrant],
    ['customer:create', assignGrant],
  ],
  available = true,
) {
  const context: AuthorizationContext = {
    actor,
    permissions: new Map(permissions),
    scopeAnchors: new Map<PermissionKey, readonly ScopeAnchor[]>(
      permissions.map(([capability]) => [
        capability,
        capability === 'customer-ownership:reassign' ? reassignAnchors : assignAnchors,
      ]),
    ),
  };
  const repository = {
    assign: vi.fn().mockResolvedValue(result),
    listCustomers: vi.fn().mockResolvedValue([result]),
    createCustomer: vi.fn().mockResolvedValue(result),
    findCustomer: vi.fn().mockResolvedValue(result),
    createActivity: vi.fn(),
    transitionCustomer: vi.fn(),
    createContact: vi.fn(),
    customer360: vi.fn(),
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
  const dispatch = (pathname: string, value: unknown, method = 'POST', session = true) =>
    app.dispatch({
      method,
      pathname,
      body: value,
      query: { reassignment: 'true', reason: 'ignored', expectedVersion: 'bad' },
      headers: {
        authorization: session ? 'Bearer fixture' : '',
        'x-correlation-id': correlationId,
        'idempotency-key': 'invalid!'.repeat(30),
      },
    });
  return { repository, authenticate, dispatch };
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
const missing = error(404, 'not_found', 'Route not found');
const unavailable = error(503, 'internal_error', 'CRM dependency unavailable');
const noCalls = (f: ReturnType<typeof fixture>) => {
  for (const mock of Object.values(f.repository)) expect(mock).not.toHaveBeenCalled();
};

for (const mode of modes) {
  describe(`inline ownership ${mode.name}`, () => {
    it('selects its grant and passes all ten args, original receiver, 200, trimmed reason, ignored header/query', async () => {
      const f = fixture();
      expect(await f.dispatch(path, mode.body)).toEqual(response(200, result));
      expect(f.repository.assign).toHaveBeenCalledExactlyOnceWith(
        'CUSTOMER',
        id,
        assigneeId,
        3,
        'territory change',
        actor,
        correlationId,
        mode.reassignment,
        mode.scopes,
        mode.anchors,
      );
      expect(f.repository.assign.mock.contexts).toEqual([f.repository]);
      for (const [name, mock] of Object.entries(f.repository))
        if (name !== 'assign') expect(mock).not.toHaveBeenCalled();
    });
    it('other mode capability cannot substitute, before unknown fields/path', async () => {
      const f = fixture([
        [mode.other, assignGrant],
        ['customer:read', assignGrant],
      ]);
      expect(await f.dispatch(path.replace(id, 'bad'), { ...mode.body, z: true })).toEqual(denied);
      noCalls(f);
    });
    it('no fields requested: empty and unrelated finite fields pass; empty scopes deny', async () => {
      for (const fields of [[], ['unrelated']]) {
        const f = fixture([[mode.capability, { scopes: mode.scopes, fields }]]);
        expect(await f.dispatch(path, mode.body)).toEqual(response(200, { id, version: 4 }));
        expect(f.repository.assign).toHaveBeenCalledExactlyOnceWith(
          'CUSTOMER',
          id,
          assigneeId,
          3,
          'territory change',
          actor,
          correlationId,
          mode.reassignment,
          mode.scopes,
          mode.anchors,
        );
      }
      const empty = fixture([[mode.capability, { scopes: [], fields: null }]]);
      expect(await empty.dispatch(path.replace(id, 'bad'), { ...mode.body, z: true })).toEqual(
        denied,
      );
      noCalls(empty);
    });
    it('allow sorted unknown/server/body-key fields after capability, before UUID/value validation', async () => {
      const f = fixture();
      expect(
        await f.dispatch(path.replace(id, 'bad'), {
          ...mode.body,
          state: 'ACTIVE',
          idempotencyKey: 'A',
          assignedBy: id,
          z: null,
        }),
      ).toEqual(invalid('Unsupported fields: assignedBy, idempotencyKey, state, z'));
      noCalls(f);
    });
    it.each([
      [
        path.replace(id, 'bad'),
        { assigneeId: 'bad', expectedVersion: -1, reason: '' },
        'customerId must be a UUID',
      ],
      [path, { assigneeId: 'bad', expectedVersion: -1, reason: '' }, 'assigneeId must be a UUID'],
      [path, { expectedVersion: -1, reason: '' }, 'expectedVersion must be a non-negative integer'],
      [path, { reason: '' }, 'reason is required'],
    ])(
      'customer then assignee then EV then reason first-error %s',
      async (pathname, changed, message) => {
        const f = fixture();
        expect(await f.dispatch(pathname, { ...mode.body, ...changed })).toEqual(invalid(message));
        noCalls(f);
      },
    );
    it.each([0, Number.MAX_SAFE_INTEGER])(
      'EV %j passes without complaint bounds or coercion',
      async (version) => {
        const f = fixture();
        expect(await f.dispatch(path, { ...mode.body, expectedVersion: version })).toEqual(
          response(200, result),
        );
        expect(f.repository.assign).toHaveBeenCalledExactlyOnceWith(
          'CUSTOMER',
          id,
          assigneeId,
          version,
          'territory change',
          actor,
          correlationId,
          mode.reassignment,
          mode.scopes,
          mode.anchors,
        );
      },
    );
    it.each([undefined, null, false, -1, 1.5, '0', Number.MAX_SAFE_INTEGER + 1, NaN, Infinity])(
      'EV %j rejects original number/safe/nonnegative contract',
      async (version) => {
        const f = fixture();
        expect(await f.dispatch(path, { ...mode.body, expectedVersion: version })).toEqual(
          invalid('expectedVersion must be a non-negative integer'),
        );
        noCalls(f);
      },
    );
    it.each([undefined, null, false, 0, '', ' '])('reason %j is required', async (reason) => {
      const f = fixture();
      expect(await f.dispatch(path, { ...mode.body, reason })).toEqual(
        invalid('reason is required'),
      );
      noCalls(f);
    });
    it('independent customer:read null/finite/empty/missing projection without new read check', async () => {
      for (const [read, dto] of [
        [assignGrant, result],
        [
          { scopes: ['TEAM'], fields: ['ownerId'] },
          { id, ownerId: assigneeId },
        ],
        [{ scopes: ['TEAM'], fields: [] }, { id }],
        [undefined, { id, version: 4 }],
      ] as const) {
        const permissions: (readonly [PermissionKey, Grant])[] = [
          [mode.capability, { scopes: mode.scopes, fields: null }],
          ['customer-360:read', assignGrant],
        ];
        if (read) permissions.push(['customer:read', read]);
        const f = fixture(permissions);
        expect(await f.dispatch(path, mode.body)).toEqual(response(200, dto));
        expect(f.repository.assign).toHaveBeenCalledOnce();
      }
    });
    it('DomainError/internal global status/message/correlation envelopes', async () => {
      const f = fixture();
      for (const [code, status] of [
        ['forbidden', 403],
        ['not_found', 404],
        ['conflict', 409],
        ['invalid_request', 400],
      ] as const) {
        f.repository.assign.mockRejectedValueOnce(new DomainError(code, 'fixed failure'));
        expect(await f.dispatch(path, mode.body)).toEqual(error(status, code, 'fixed failure'));
      }
      f.repository.assign.mockRejectedValueOnce(new Error('private failure'));
      expect(await f.dispatch(path, mode.body)).toEqual(
        error(500, 'internal_error', 'Internal server error'),
      );
    });
  });
}

describe('ownership shared compatibility', () => {
  it.each([null, [], false, 0, 'bad'])(
    'body %j first even without permission/with bad path',
    async (value) => {
      for (const permissions of [[], [['customer-ownership:assign', assignGrant]]] as const) {
        const f = fixture(permissions);
        expect(await f.dispatch(path.replace(id, 'bad'), value)).toEqual(
          invalid('A JSON object body is required'),
        );
        noCalls(f);
      }
    },
  );
  it.each([undefined, null, false, 0, 1, '', 'true', 'false', {}, []])(
    'only boolean true reassigns; %j stays assign',
    async (reassignment) => {
      const f = fixture([['customer-ownership:assign', { scopes: ['TEAM'], fields: [] }]]);
      expect(await f.dispatch(path, { ...body, reassignment })).toEqual(
        response(200, { id, version: 4 }),
      );
      expect(f.repository.assign).toHaveBeenCalledExactlyOnceWith(
        'CUSTOMER',
        id,
        assigneeId,
        3,
        'territory change',
        actor,
        correlationId,
        false,
        ['TEAM'],
        assignAnchors,
      );
    },
  );
  it('true selects reassign even with empty fields; no early HTTP separation-of-duties check (mock only)', async () => {
    const f = fixture([
      ['customer-ownership:reassign', { scopes: ['REGION', 'TEAM'], fields: [] }],
    ]);
    expect(await f.dispatch(path, { ...body, assigneeId: id, reassignment: true })).toEqual(
      response(200, { id, version: 4 }),
    );
    expect(f.repository.assign).toHaveBeenCalledExactlyOnceWith(
      'CUSTOMER',
      id,
      id,
      3,
      'territory change',
      actor,
      correlationId,
      true,
      ['REGION', 'TEAM'],
      reassignAnchors,
    );
  });
  it('empty object selects assign grant before missing values; unknown fields after capability', async () => {
    const absent = fixture([]);
    expect(await absent.dispatch(path.replace(id, 'bad'), {})).toEqual(denied);
    noCalls(absent);
    const authorized = fixture();
    expect(await authorized.dispatch(path, {})).toEqual(invalid('assigneeId is required'));
    noCalls(authorized);
  });
  it.each(['bad', '-', '360', 'deadbeef'])(
    'wide raw customer ID %s validates at original stage',
    async (value) => {
      const f = fixture();
      expect(await f.dispatch(path.replace(id, value), body)).toEqual(
        invalid('customerId must be a UUID'),
      );
      noCalls(f);
    },
  );
  it('no-ID ownership remains base GET/POST alias, never assign', async () => {
    const f = fixture();
    expect(await f.dispatch('/api/v1/customers/ownership', null, 'GET')).toEqual(
      response(200, { items: [result], nextCursor: null }),
    );
    expect(
      await f.dispatch('/api/v1/customers/ownership', { name: 'N', customerNumber: 'C' }),
    ).toEqual(response(201, result));
    expect(f.repository.listCustomers).toHaveBeenCalledExactlyOnceWith(
      actor,
      ['TEAM'],
      assignAnchors,
    );
    expect(f.repository.createCustomer).toHaveBeenCalledExactlyOnceWith(
      { name: 'N', customerNumber: 'C', tags: [] },
      actor,
      correlationId,
    );
    expect(f.repository.assign).not.toHaveBeenCalled();
  });
  it('global401 before wrapper503 and no authentication without token', async () => {
    const f = fixture([], false);
    expect(await f.dispatch(path, null, 'POST', false)).toEqual(
      error(401, 'authentication_required', 'A valid session is required'),
    );
    expect(f.authenticate).not.toHaveBeenCalled();
    noCalls(f);
  });
  it('wrapper missing repo503 before body/cap/method/UUID for all matching ownership shapes', async () => {
    const f = fixture([], false);
    for (const pathname of [path, path.replace(id, '360'), '/api/v1/customers/ownership'])
      for (const method of ['POST', 'GET', 'PATCH', 'DELETE', 'OPTIONS'])
        expect(await f.dispatch(pathname, null, method)).toEqual(unavailable);
    noCalls(f);
  });
  it('unsupported methods fall through with repo; nonmatches404 even without repo', async () => {
    const f = fixture([]);
    for (const method of ['GET', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'])
      expect(await f.dispatch(path, null, method)).toEqual(missing);
    noCalls(f);
    for (const available of [true, false]) {
      const other = fixture([], available);
      for (const pathname of [
        path.replace(id, id.toUpperCase()),
        path.replace(id, 'not-a-uuid'),
        path.toUpperCase(),
        path + '/',
        path + '/extra',
        path.replace('ownership', 'unknown'),
      ])
        expect(await other.dispatch(pathname, null)).toEqual(missing);
      noCalls(other);
    }
  });
  it('activities/lifecycle/360/lead/organization keep their own authorization and do not assign', async () => {
    const f = fixture([]);
    for (const [method, pathname] of [
      ['POST', `/api/v1/customers/${id}/activities`],
      ['PATCH', `/api/v1/customers/${id}`],
      ['GET', `/api/v1/customers/${id}/360`],
      ['GET', '/api/v1/leads'],
      ['GET', '/api/v1/organizations'],
    ] as const)
      expect(await f.dispatch(pathname, {}, method)).toEqual(denied);
    noCalls(f);
  });
});
