// Fixed on 916cc3e's inline combined lead command branch, before extraction.
import { describe, expect, it, vi } from 'vitest';
import { DomainError, type AuthorizationContext, type ScopeAnchor } from '@kingturf/domain';
import type { DataScope, PermissionKey } from '@kingturf/types';
import { buildApp, type ApiDependencies } from '../src/app.js';

type Crm = NonNullable<ApiDependencies['crm']>;
type AssignArgs = Parameters<Crm['assign']>;
type TransitionArgs = Parameters<Crm['transitionLead']>;
type Grant = NonNullable<ReturnType<AuthorizationContext['permissions']['get']>>;
const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const assigneeId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const correlationId = '33333333-3333-4333-8333-333333333333';
const actor = { companyId: 'tenant', employeeId: id };
const read: Grant = { scopes: ['COMPANY'], fields: null };
const result = { id, version: 6, status: 'REPOSITORY_RESULT', title: 'repo lead', private: 'raw' };
const actions = [
  { action: 'assign', capability: 'lead:assign', scope: 'TEAM' },
  { action: 'reassign', capability: 'lead:reassign', scope: 'DEPARTMENT' },
  { action: 'transition', capability: 'lead:lifecycle', scope: 'SELF' },
  { action: 'release', capability: 'lead-pool:release', scope: 'REGION' },
] as const satisfies readonly { action: string; capability: PermissionKey; scope: DataScope }[];
type Action = (typeof actions)[number];
const path = (action: Action['action']) => `/api/v1/leads/${id}/${action}`;
const body = (action: Action['action']) =>
  action === 'assign' || action === 'reassign'
    ? { assigneeId: ` ${assigneeId} `, expectedVersion: 5, reason: ' why ' }
    : action === 'transition'
      ? { status: ' UNKNOWN_NEW_STATE ', expectedVersion: 5, reason: ' why ' }
      : { expectedVersion: 5, reason: ' why ' };
const grantFor = (row: Action, fields: Grant['fields'] = null): Grant => ({
  scopes: [row.scope],
  fields,
});
const anchorsFor = (row: Action): readonly ScopeAnchor[] => [
  { scope: row.scope, organizationId: row.action },
];
const defaultEntries: readonly (readonly [PermissionKey, Grant])[] = [
  ...actions.map((row) => [row.capability, grantFor(row)] as const),
  ['lead:read', read],
  ['lead-pool:read', read],
];
function fixture(entries = defaultEntries, available = true) {
  const context: AuthorizationContext = {
    actor,
    permissions: new Map(entries),
    scopeAnchors: new Map(actions.map((row) => [row.capability, anchorsFor(row)])),
  };
  const repository = {
    assign: vi.fn<(...args: AssignArgs) => Promise<typeof result>>().mockResolvedValue(result),
    transitionLead: vi
      .fn<(...args: TransitionArgs) => Promise<typeof result>>()
      .mockResolvedValue(result),
    claimLead: vi.fn(),
    listLeads: vi.fn(),
    createLead: vi.fn(),
    listCustomers: vi.fn(),
    createCustomer: vi.fn(),
    findCustomer: vi.fn(),
    customer360: vi.fn(),
    transitionCustomer: vi.fn(),
    createContact: vi.fn(),
    createActivity: vi.fn(),
  };
  const organizations = { list: vi.fn().mockResolvedValue([{ id: 'organization' }]) };
  const app = buildApp({
    auth: {
      authenticate: vi.fn().mockResolvedValue(context),
    } as unknown as ApiDependencies['auth'],
    employees: {} as ApiDependencies['employees'],
    organizations: organizations as unknown as ApiDependencies['organizations'],
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
      query: { status: 'POOL', expectedVersion: 'bad', assigneeId: 'bad', reason: 'query' },
      headers: {
        authorization: options.session === false ? '' : 'Bearer fixture',
        'x-correlation-id': correlationId,
        'idempotency-key': 'x'.repeat(129),
      },
    });
  return { repository, organizations, dispatch };
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
  row: Action,
  version = 5,
  reason = 'why',
  targetAssignee = assigneeId,
  status = 'UNKNOWN_NEW_STATE',
) => {
  if (row.action === 'assign' || row.action === 'reassign') {
    expect(f.repository.assign).toHaveBeenCalledExactlyOnceWith(
      'LEAD',
      id,
      targetAssignee,
      version,
      reason,
      actor,
      correlationId,
      row.action === 'reassign',
      [row.scope],
      anchorsFor(row),
    );
    expect(f.repository.assign.mock.calls[0]).toHaveLength(10);
    expect(f.repository.assign.mock.contexts).toEqual([f.repository]);
    expect(f.repository.transitionLead).not.toHaveBeenCalled();
  } else {
    expect(f.repository.transitionLead).toHaveBeenCalledExactlyOnceWith(
      id,
      row.action === 'release' ? 'POOL' : status,
      version,
      reason,
      actor,
      correlationId,
      [row.scope],
      anchorsFor(row),
      row.action === 'release' ? 'CLAIMED' : undefined,
    );
    expect(f.repository.transitionLead.mock.calls[0]).toHaveLength(9);
    expect(f.repository.transitionLead.mock.contexts).toEqual([f.repository]);
    expect(f.repository.assign).not.toHaveBeenCalled();
  }
  for (const [name, mock] of Object.entries(f.repository))
    if (name !== 'assign' && name !== 'transitionLead') expect(mock).not.toHaveBeenCalled();
};

describe('inline four commands common UUID/body/capability order', () => {
  it.each(actions)(
    '$action exact receiver/ten or explicitnine args, own scopeanchors,200; headerquery ignored',
    async (row) => {
      const f = fixture();
      expect(await f.dispatch(path(row.action), body(row.action))).toEqual(response(200, result));
      expectCall(f, row);
    },
  );
  it.each(actions)('$action badUUID before invalidbody and missingcap', async (row) => {
    const f = fixture([]);
    expect(await f.dispatch(path(row.action).replace(id, 'bad'), null)).toEqual(
      invalid('leadId must be a UUID'),
    );
    noCalls(f);
  });
  it.each(actions)('$action validUUID badbody before missingcap', async (row) => {
    for (const value of [null, undefined, [], 'bad', false]) {
      const f = fixture([]);
      expect(await f.dispatch(path(row.action), value)).toEqual(
        invalid('A JSON object body is required'),
      );
      noCalls(f);
    }
  });
  it.each(actions)(
    '$action missing/emptyscope cap before allow; other command capabilities cannot substitute',
    async (row) => {
      for (const mode of ['missing', 'empty'] as const) {
        const entries = defaultEntries.filter(([capability]) => capability !== row.capability);
        const f = fixture(
          mode === 'missing'
            ? entries
            : [...entries, [row.capability, { scopes: [], fields: null }]],
        );
        expect(await f.dispatch(path(row.action), { unknown: true })).toEqual(denied);
        noCalls(f);
      }
    },
  );
  it.each(actions)(
    '$action unknown/server/bodykey before action params after auth',
    async (row) => {
      for (const field of ['id', 'ownerId', 'idempotencyKey', 'reassignment']) {
        const f = fixture();
        expect(await f.dispatch(path(row.action), { [field]: true })).toEqual(
          invalid(`Unsupported fields: ${field}`),
        );
        noCalls(f);
      }
      const sorted = fixture();
      expect(await sorted.dispatch(path(row.action), { z: 1, a: 2 })).toEqual(
        invalid('Unsupported fields: a, z'),
      );
      noCalls(sorted);
    },
  );
  it.each(actions)(
    '$action version0/MAX_SAFE reach mock, no new max/Number conversion',
    async (row) => {
      for (const expectedVersion of [0, Number.MAX_SAFE_INTEGER]) {
        const f = fixture();
        expect(
          await f.dispatch(path(row.action), { ...body(row.action), expectedVersion }),
        ).toEqual(response(200, result));
        expectCall(f, row, expectedVersion);
      }
    },
  );
  it.each(actions)('$action malformed versions before reason', async (row) => {
    for (const expectedVersion of [
      undefined,
      null,
      false,
      -1,
      0.5,
      '0',
      Number.MAX_SAFE_INTEGER + 1,
      NaN,
      Infinity,
    ]) {
      const f = fixture();
      expect(
        await f.dispatch(path(row.action), { ...body(row.action), expectedVersion, reason: '' }),
      ).toEqual(invalid('expectedVersion must be a non-negative integer'));
      noCalls(f);
    }
  });
  it.each(actions)('$action reason nonempty string and trim', async (row) => {
    for (const reason of [undefined, null, false, 0, '', '   ']) {
      const f = fixture();
      expect(await f.dispatch(path(row.action), { ...body(row.action), reason })).toEqual(
        invalid('reason is required'),
      );
      noCalls(f);
    }
    const valid = fixture();
    expect(
      await valid.dispatch(path(row.action), { ...body(row.action), reason: ' new reason ' }),
    ).toEqual(response(200, result));
    expectCall(valid, row, 5, 'new reason');
  });
});

describe('inline assignment vs transition/release permission and input differences', () => {
  it.each(actions.slice(0, 2))(
    '$action has no field requests and assigneeUUID before version/reason',
    async (row) => {
      for (const fields of [[], ['unrelated']]) {
        const f = fixture([[row.capability, grantFor(row, fields)]]);
        expect(await f.dispatch(path(row.action), body(row.action))).toEqual(
          response(200, { id, version: 6 }),
        );
        expectCall(f, row);
      }
      const invalidAssignee = fixture();
      expect(
        await invalidAssignee.dispatch(path(row.action), {
          assigneeId: 'bad',
          expectedVersion: -1,
          reason: '',
        }),
      ).toEqual(invalid('assigneeId must be a UUID'));
      noCalls(invalidAssignee);
    },
  );
  it.each(actions.slice(0, 2))(
    '$action absent/false assignee remains original UUID string error, self-assign only mock evidence',
    async (row) => {
      for (const assignee of [undefined, null, false, 0, '', [], {}]) {
        const f = fixture();
        expect(
          await f.dispatch(path(row.action), { ...body(row.action), assigneeId: assignee }),
        ).toEqual(invalid('assigneeId is required'));
        noCalls(f);
      }
      const self = fixture();
      expect(
        await self.dispatch(path(row.action), { ...body(row.action), assigneeId: id }),
      ).toEqual(response(200, result));
      expectCall(self, row, 5, 'why', id);
    },
  );
  it.each(actions.slice(2))(
    '$action fixed status/reason field permissions even when body omits them',
    async (row) => {
      for (const fields of [[], ['status'], ['reason']]) {
        const f = fixture([[row.capability, grantFor(row, fields)]]);
        expect(await f.dispatch(path(row.action), { unknown: true })).toEqual(fieldDenied);
        expect(await f.dispatch(path(row.action), {})).toEqual(fieldDenied);
        noCalls(f);
      }
      const f = fixture([[row.capability, grantFor(row, ['status', 'reason'])]]);
      expect(await f.dispatch(path(row.action), body(row.action))).toEqual(
        response(200, { id, version: 6 }),
      );
      expectCall(f, row);
    },
  );
  it('transition plain nonempty status before version/reason, no HTTP enum', async () => {
    const row = actions[2];
    for (const status of [undefined, null, false, 0, '', '   ']) {
      const f = fixture();
      expect(
        await f.dispatch(path('transition'), { status, expectedVersion: -1, reason: '' }),
      ).toEqual(invalid('status is required'));
      noCalls(f);
    }
    for (const status of [
      'NEW',
      'POOL',
      'CLAIMED',
      'QUALIFIED',
      'CONVERTED',
      'UNKNOWN_NEW_STATE',
    ]) {
      const f = fixture();
      expect(
        await f.dispatch(path('transition'), {
          status: ` ${status} `,
          expectedVersion: 5,
          reason: ' why ',
        }),
      ).toEqual(response(200, result));
      expectCall(f, row, 5, 'why', assigneeId, status);
    }
  });
  it('release requires status field grant but body status rejected after grant, then EV/reason; fixedPOOL/fromCLAIMED', async () => {
    const deniedFields = fixture([['lead-pool:release', grantFor(actions[3], ['reason'])]]);
    expect(
      await deniedFields.dispatch(path('release'), { expectedVersion: 5, reason: ' why ' }),
    ).toEqual(fieldDenied);
    noCalls(deniedFields);
    const f = fixture();
    expect(
      await f.dispatch(path('release'), { status: 'POOL', expectedVersion: -1, reason: '' }),
    ).toEqual(invalid('Unsupported fields: status'));
    expect(await f.dispatch(path('release'), {})).toEqual(
      invalid('expectedVersion must be a non-negative integer'),
    );
    noCalls(f);
  });
});

describe('inline lead command independent projections and error envelopes', () => {
  it.each(actions)(
    '$action independent leadread full/finite/empty/missing, not poolread',
    async (row) => {
      for (const mode of ['full', 'finite', 'empty', 'missing'] as const) {
        const fields = mode === 'full' ? null : mode === 'finite' ? ['status'] : [];
        const entries: readonly (readonly [PermissionKey, Grant])[] = [
          [row.capability, grantFor(row)],
          ['lead-pool:read', read],
          ...(mode === 'missing' ? [] : [['lead:read', { ...read, fields }] as const]),
        ];
        const f = fixture(entries);
        const projected =
          mode === 'full'
            ? result
            : mode === 'finite'
              ? { id, status: result.status }
              : mode === 'missing'
                ? { id, version: 6 }
                : { id };
        expect(await f.dispatch(path(row.action), body(row.action))).toEqual(
          response(200, projected),
        );
        expectCall(f, row);
      }
    },
  );
  it.each(actions)(
    '$action repository DomainError/internal keeps correlation envelope',
    async (row) => {
      for (const thrown of [
        new DomainError('conflict', 'repository conflict'),
        new Error('private error'),
      ]) {
        const f = fixture();
        if (row.action === 'assign' || row.action === 'reassign')
          f.repository.assign.mockRejectedValue(thrown);
        else f.repository.transitionLead.mockRejectedValue(thrown);
        expect(await f.dispatch(path(row.action), body(row.action))).toEqual(
          thrown instanceof DomainError
            ? error(409, 'conflict', 'repository conflict')
            : error(500, 'internal_error', 'Internal server error'),
        );
        expectCall(f, row);
      }
    },
  );
});

describe('inline combined matcher/POST503/unsupported and organization boundary', () => {
  it.each(actions)(
    '$action global401, matched missingrepo503 before UUID/body/cap',
    async (row) => {
      const f = fixture([], false);
      expect(
        await f.dispatch(path(row.action).replace(id, 'bad'), null, { session: false }),
      ).toEqual(error(401, 'authentication_required', 'A valid session is required'));
      expect(await f.dispatch(path(row.action).replace(id, 'bad'), null)).toEqual(unavailable);
      noCalls(f);
    },
  );
  it.each(actions)('$action nonPOST404 even absentCRM/no body validation', async (row) => {
    for (const method of ['GET', 'PATCH', 'PUT', 'DELETE'])
      for (const available of [true, false]) {
        const f = fixture([], available);
        expect(await f.dispatch(path(row.action), null, { method })).toEqual(missing);
        noCalls(f);
      }
  });
  it.each(actions)(
    '$action wide hex IDs pass matcher before UUID; uppercase/slash/noid reject beforeCRM',
    async (row) => {
      for (const raw of ['bad', '-', 'deadbeef', '360']) {
        const f = fixture([]);
        expect(await f.dispatch(path(row.action).replace(id, raw), null)).toEqual(
          invalid('leadId must be a UUID'),
        );
        noCalls(f);
      }
      for (const pathname of [
        path(row.action).replace(id, id.toUpperCase()),
        `${path(row.action)}/`,
        `${path(row.action)}/extra`,
        `/api/v1/leads/${row.action}`,
      ]) {
        const f = fixture([], false);
        expect(await f.dispatch(pathname, null)).toEqual(missing);
        noCalls(f);
      }
    },
  );
  it.each([`/api/v1/leads/${id}`, `/api/v1/leads/${id}/unknown`, '/api/v1/leads/pool'])(
    'unsupported POST %s404 even absentCRM',
    async (pathname) => {
      const f = fixture([], false);
      expect(await f.dispatch(pathname, null)).toEqual(missing);
      noCalls(f);
    },
  );
  it.each([
    { pathname: '/api/v1/leads', method: 'GET' },
    { pathname: '/api/v1/leads', method: 'POST' },
    { pathname: '/api/v1/leads/pool', method: 'GET' },
    { pathname: `/api/v1/leads/${id}/claim`, method: 'POST' },
    { pathname: '/api/v1/customers', method: 'GET' },
  ])('neighbor $method $pathname uses own cap/CRM guard', async ({ pathname, method }) => {
    for (const available of [true, false]) {
      const f = fixture(
        [...actions.map((row) => [row.capability, grantFor(row)] as const)],
        available,
      );
      expect(await f.dispatch(pathname, {}, { method })).toEqual(available ? denied : unavailable);
      noCalls(f);
    }
  });
  it('organization matcher must remain: authorized GET reaches original organization repository withoutCRM', async () => {
    const f = fixture([['organization:read', read]], false);
    expect(await f.dispatch('/api/v1/organizations', null, { method: 'GET' })).toEqual(
      response(200, [{ id: 'organization' }]),
    );
    expect(f.organizations.list).toHaveBeenCalledExactlyOnceWith(actor.companyId);
    noCalls(f);
  });
});
