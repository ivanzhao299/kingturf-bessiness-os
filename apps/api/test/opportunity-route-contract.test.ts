// Fixed inline opportunity expectations at db7976f, before any commercial route extraction.
import { describe, expect, it, vi } from 'vitest';
import { DomainError, type AuthorizationContext } from '@kingturf/domain';
import type { PermissionKey } from '@kingturf/types';
import { buildApp, type ApiDependencies } from '../src/app.js';

const id = '11111111-1111-4111-8111-111111111111';
const otherId = '22222222-2222-4222-8222-222222222222';
const correlationId = '33333333-3333-4333-8333-333333333333';
const actor = { employeeId: 'actor', companyId: 'tenant' };
const anchors = [{ scope: 'TEAM', organizationId: otherId }] as const;
const collectionPath = '/api/v1/opportunities',
  itemPath = `${collectionPath}/${id}`,
  badPath = `${collectionPath}/bad`;
const result = { id, version: 4, name: 'Fixed', value: '10', currency: 'CNY', secret: 'private' };
const methods = [
  'listOpportunities',
  'findOpportunity',
  'createOpportunity',
  'updateOpportunity',
  'transitionOpportunity',
] as const;
type Method = (typeof methods)[number];
type Grant = NonNullable<ReturnType<AuthorizationContext['permissions']['get']>>;
const grant: Grant = { scopes: ['COMPANY'], fields: null };
const defaultPermissions: readonly (readonly [PermissionKey, Grant])[] = [
  ['opportunity:read', grant],
  ['opportunity:create', grant],
  ['opportunity:update', grant],
  ['opportunity:lifecycle', grant],
];
function fixture(permissions = defaultPermissions, available = true) {
  const context: AuthorizationContext = {
    actor,
    permissions: new Map(permissions),
    scopeAnchors: new Map(permissions.map(([key]) => [key, anchors])),
  };
  const repository = Object.fromEntries(
    methods.map((method) => [
      method,
      vi.fn().mockResolvedValue(method === 'listOpportunities' ? [result] : result),
    ]),
  ) as Record<Method, ReturnType<typeof vi.fn>>;
  const authenticate = vi.fn().mockResolvedValue(context);
  const app = buildApp({
    auth: { authenticate } as unknown as ApiDependencies['auth'],
    employees: {} as ApiDependencies['employees'],
    organizations: {} as ApiDependencies['organizations'],
    ...(available
      ? { commercial: repository as unknown as NonNullable<ApiDependencies['commercial']> }
      : {}),
  });
  const dispatch = (
    method: string,
    pathname = collectionPath,
    body: unknown = null,
    session = true,
  ) =>
    app.dispatch({
      method,
      pathname,
      body,
      headers: {
        authorization: session ? 'Bearer fixture' : '',
        'x-correlation-id': correlationId,
      },
    });
  return { context, repository, authenticate, dispatch };
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
const error = (status: number, code: string, message: string) =>
  response(status, { error: { code, message, correlationId } });
const invalid = (message: string) => error(400, 'invalid_request', message);
const denied = error(403, 'forbidden', 'Permission denied');
const fieldDenied = error(403, 'forbidden', 'Field permission denied');
const unavailable = error(503, 'internal_error', 'Commercial dependency unavailable');
const missing = error(404, 'not_found', 'Route not found');
const noCalls = (f: ReturnType<typeof fixture>) => {
  for (const method of methods) expect(f.repository[method]).not.toHaveBeenCalled();
};
const createBody = {
  customerId: null,
  leadId: null,
  name: ' Opportunity ',
  value: '10.500000',
  currency: 'CNY',
  probabilityBasisPoints: 0,
  expectedCloseDate: ' not-a-date ',
};
const createInput = {
  customerId: null,
  leadId: null,
  name: 'Opportunity',
  value: '10.5',
  currency: 'CNY',
  probabilityBasisPoints: 0,
  expectedCloseDate: 'not-a-date',
};
const updateBody = {
  name: ' Changed ',
  value: '12.340000',
  currency: 'USD',
  probabilityBasisPoints: 0,
  expectedCloseDate: ' not-a-date ',
  expectedVersion: 0,
};
const updateInput = {
  name: 'Changed',
  value: '12.34',
  currency: 'USD',
  probabilityBasisPoints: 0,
  expectedCloseDate: 'not-a-date',
};
const lifecycleBody = { status: ' UNRECOGNIZED ', reason: ' reason ', expectedVersion: 0 };

describe('opportunity inline dependency/session/unsupported contracts', () => {
  it.each(['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'])(
    '%s matched paths checks dependency before permission/body/UUID',
    async (method) => {
      const f = fixture([], false);
      for (const path of [collectionPath, itemPath, badPath]) {
        expect(await f.dispatch(method, path, null)).toEqual(unavailable);
        expect(await f.dispatch(method, path, { extra: true })).toEqual(unavailable);
      }
      noCalls(f);
    },
  );
  it.each(['POST', 'PATCH', 'DELETE', 'OPTIONS'])(
    '%s unsupported collection/item combinations still parse objectBody',
    async (method) => {
      const f = fixture([]);
      const paths =
        method === 'POST'
          ? [itemPath]
          : method === 'PATCH'
            ? [collectionPath]
            : [collectionPath, itemPath, badPath];
      for (const path of paths) {
        expect(await f.dispatch(method, path, null)).toEqual(
          invalid('A JSON object body is required'),
        );
        expect(await f.dispatch(method, path, { extra: true })).toEqual(missing);
      }
      noCalls(f);
    },
  );
  it.each([`${collectionPath}/`, `${collectionPath}/NOT-HEX`, `${collectionPath}/${id}/unknown`])(
    'unmatched %s does not check dependency/parse/authorize',
    async (path) => {
      const f = fixture([], false);
      expect(await f.dispatch('POST', path, null)).toEqual(missing);
      noCalls(f);
    },
  );
  it('nested paths remain outside basic opportunity dependency ownership', async () => {
    const f = fixture([], false);
    for (const suffix of ['ctrs', 'technical-solutions'])
      expect(await f.dispatch('GET', `${itemPath}/${suffix}`)).toEqual(missing);
    noCalls(f);
  });
  it.each(['GET', 'POST', 'PATCH', 'DELETE'])(
    '%s without a session returns 401 before dependency/body',
    async (method) => {
      const f = fixture([], false);
      expect(await f.dispatch(method, badPath, null, false)).toEqual(
        error(401, 'authentication_required', 'A valid session is required'),
      );
      expect(f.authenticate).not.toHaveBeenCalled();
      noCalls(f);
    },
  );
});

describe('opportunity inline reads', () => {
  it('lists and finds with exact actor/scopes/anchors, ignores GET body and preserves receiver', async () => {
    const f = fixture();
    expect(await f.dispatch('GET', collectionPath, ['ignored'])).toEqual(
      response(200, { items: [result] }),
    );
    expect(f.repository.listOpportunities).toHaveBeenCalledExactlyOnceWith(
      actor,
      ['COMPANY'],
      anchors,
    );
    expect(f.repository.listOpportunities.mock.contexts).toEqual([f.repository]);
    expect(await f.dispatch('GET', itemPath, { extra: true })).toEqual(response(200, result));
    expect(f.repository.findOpportunity).toHaveBeenCalledExactlyOnceWith(
      id,
      actor,
      ['COMPANY'],
      anchors,
    );
    expect(f.repository.findOpportunity.mock.contexts).toEqual([f.repository]);
    for (const method of [
      'createOpportunity',
      'updateOpportunity',
      'transitionOpportunity',
    ] as const)
      expect(f.repository[method]).not.toHaveBeenCalled();
  });
  it('applies read field projection to list and item', async () => {
    const f = fixture([['opportunity:read', { scopes: ['SELF'], fields: ['name'] }]]);
    expect(await f.dispatch('GET')).toEqual(response(200, { items: [{ id, name: 'Fixed' }] }));
    expect(await f.dispatch('GET', itemPath)).toEqual(response(200, { id, name: 'Fixed' }));
    expect(f.repository.findOpportunity).toHaveBeenCalledExactlyOnceWith(
      id,
      actor,
      ['SELF'],
      anchors,
    );
  });
  it('authorizes before matched invalid UUID and returns not-found item envelope', async () => {
    const f = fixture([]);
    expect(await f.dispatch('GET', badPath)).toEqual(denied);
    noCalls(f);
    const allowed = fixture();
    expect(await allowed.dispatch('GET', badPath)).toEqual(invalid('opportunityId must be a UUID'));
    noCalls(allowed);
    allowed.repository.findOpportunity.mockResolvedValueOnce(null);
    expect(await allowed.dispatch('GET', itemPath)).toEqual(
      error(404, 'not_found', 'Opportunity not found'),
    );
    expect(allowed.repository.findOpportunity).toHaveBeenCalledExactlyOnceWith(
      id,
      actor,
      ['COMPANY'],
      anchors,
    );
  });
  it('rejects empty scope read but requests no read fields', async () => {
    const empty = fixture([['opportunity:read', { scopes: [], fields: null }]]);
    expect(await empty.dispatch('GET')).toEqual(denied);
    noCalls(empty);
    const fields = fixture([['opportunity:read', { scopes: ['COMPANY'], fields: [] }]]);
    expect(await fields.dispatch('GET', itemPath)).toEqual(response(200, { id }));
  });
});

describe('opportunity inline successful writes', () => {
  it('creates with null references, zero probability and string-only close date', async () => {
    const f = fixture();
    expect(await f.dispatch('POST', collectionPath, createBody)).toEqual(response(201, result));
    expect(f.repository.createOpportunity).toHaveBeenCalledExactlyOnceWith(
      createInput,
      actor,
      correlationId,
    );
    expect(f.repository.createOpportunity.mock.contexts).toEqual([f.repository]);
  });
  it('creates with non-null UUID references', async () => {
    const f = fixture();
    await f.dispatch('POST', collectionPath, { ...createBody, customerId: id, leadId: otherId });
    expect(f.repository.createOpportunity).toHaveBeenCalledExactlyOnceWith(
      { ...createInput, customerId: id, leadId: otherId },
      actor,
      correlationId,
    );
  });
  it('updates optional fields before expectedVersion and preserves zero semantics', async () => {
    const f = fixture();
    expect(await f.dispatch('PATCH', itemPath, updateBody)).toEqual(response(200, result));
    expect(f.repository.updateOpportunity).toHaveBeenCalledExactlyOnceWith(
      id,
      updateInput,
      0,
      actor,
      ['COMPANY'],
      anchors,
      correlationId,
    );
    expect(f.repository.updateOpportunity.mock.contexts).toEqual([f.repository]);
    expect(f.repository.transitionOpportunity).not.toHaveBeenCalled();
  });
  it('omits undefined patch fields but still allows a version-only update', async () => {
    const f = fixture([['opportunity:update', { scopes: ['COMPANY'], fields: [] }]]);
    expect(await f.dispatch('PATCH', itemPath, { expectedVersion: 0 })).toEqual(
      response(200, { id, version: 4 }),
    );
    expect(f.repository.updateOpportunity).toHaveBeenCalledExactlyOnceWith(
      id,
      {},
      0,
      actor,
      ['COMPANY'],
      anchors,
      correlationId,
    );
    const undefinedFields = fixture();
    await undefinedFields.dispatch('PATCH', itemPath, {
      name: undefined,
      value: undefined,
      currency: undefined,
      probabilityBasisPoints: undefined,
      expectedCloseDate: undefined,
      expectedVersion: 0,
    });
    expect(undefinedFields.repository.updateOpportunity).toHaveBeenCalledExactlyOnceWith(
      id,
      {},
      0,
      actor,
      ['COMPANY'],
      anchors,
      correlationId,
    );
  });
  it('lifecycle forwards a non-enumerated string and excludes reason/version from field authorization', async () => {
    const f = fixture([['opportunity:lifecycle', { scopes: ['SELF'], fields: ['status'] }]]);
    expect(await f.dispatch('PATCH', itemPath, lifecycleBody)).toEqual(
      response(200, { id, version: 4 }),
    );
    expect(f.repository.transitionOpportunity).toHaveBeenCalledExactlyOnceWith(
      id,
      'UNRECOGNIZED',
      'reason',
      0,
      actor,
      ['SELF'],
      anchors,
      correlationId,
    );
    expect(f.repository.transitionOpportunity.mock.contexts).toEqual([f.repository]);
    expect(f.repository.updateOpportunity).not.toHaveBeenCalled();
  });
  it.each([
    ['POST', collectionPath, createBody, 'opportunity:create'],
    ['PATCH', itemPath, updateBody, 'opportunity:update'],
    ['PATCH', itemPath, lifecycleBody, 'opportunity:lifecycle'],
  ] as const)(
    '%s %s preserves mutation read-grant field filtering',
    async (method, path, body, capability) => {
      const f = fixture([
        [capability, grant],
        ['opportunity:read', { scopes: ['COMPANY'], fields: ['name'] }],
      ]);
      expect(await f.dispatch(method, path, body)).toEqual(
        response(method === 'POST' ? 201 : 200, { id, name: 'Fixed' }),
      );
      const noRead = fixture([[capability, grant]]);
      expect(await noRead.dispatch(method, path, body)).toEqual(
        response(method === 'POST' ? 201 : 200, { id, version: 4 }),
      );
    },
  );
});

describe('opportunity inline write permission and parsing order', () => {
  it.each([
    ['POST', collectionPath, createBody, 'opportunity:create'],
    ['PATCH', badPath, updateBody, 'opportunity:update'],
    ['PATCH', badPath, lifecycleBody, 'opportunity:lifecycle'],
  ] as const)(
    '%s %s preserves body/allow before permission and permission before values/UUID',
    async (method, path, body, capability) => {
      const f = fixture([]);
      expect(await f.dispatch(method, path, null)).toEqual(
        invalid('A JSON object body is required'),
      );
      expect(await f.dispatch(method, path, { ...body, extra: true })).toEqual(
        invalid('Unsupported fields: extra'),
      );
      expect(await f.dispatch(method, path, body)).toEqual(denied);
      noCalls(f);
      const fields = fixture([[capability, { scopes: ['COMPANY'], fields: [] }]]);
      expect(await fields.dispatch(method, path, body)).toEqual(fieldDenied);
      noCalls(fields);
      const empty = fixture([[capability, { scopes: [], fields: null }]]);
      expect(await empty.dispatch(method, path, body)).toEqual(denied);
      noCalls(empty);
    },
  );
  it('uses status !== undefined to select variant and applies its whitelist before permissions', async () => {
    const f = fixture([]);
    expect(await f.dispatch('PATCH', itemPath, { status: undefined, expectedVersion: 0 })).toEqual(
      invalid('Unsupported fields: status'),
    );
    expect(await f.dispatch('PATCH', itemPath, { status: null, name: 'name' })).toEqual(
      invalid('Unsupported fields: name'),
    );
    expect(await f.dispatch('PATCH', itemPath, { reason: 'reason', expectedVersion: 0 })).toEqual(
      invalid('Unsupported fields: reason'),
    );
    noCalls(f);
  });
  it('does not remove an undefined optional field from requested authorization fields', async () => {
    const f = fixture([['opportunity:update', { scopes: ['COMPANY'], fields: [] }]]);
    expect(await f.dispatch('PATCH', itemPath, { name: undefined, expectedVersion: 0 })).toEqual(
      fieldDenied,
    );
    noCalls(f);
  });
  it.each([
    [
      'POST',
      collectionPath,
      { ...createBody, customerId: undefined, leadId: undefined },
      'customerId is required',
    ],
    ['POST', collectionPath, { ...createBody, leadId: undefined }, 'leadId is required'],
    [
      'POST',
      collectionPath,
      { ...createBody, customerId: 'bad', name: '' },
      'customerId must be a UUID',
    ],
    ['POST', collectionPath, { ...createBody, leadId: 'bad', name: '' }, 'leadId must be a UUID'],
    ['POST', collectionPath, { ...createBody, name: '', value: 'bad' }, 'name is required'],
    ['POST', collectionPath, { ...createBody, value: 'bad', currency: 'bad' }, 'Invalid decimal'],
    ['POST', collectionPath, { ...createBody, value: '-1' }, 'value must be non-negative'],
    [
      'POST',
      collectionPath,
      { ...createBody, currency: 'cny', probabilityBasisPoints: -1 },
      'Currency must be ISO 4217 uppercase',
    ],
    [
      'POST',
      collectionPath,
      { ...createBody, probabilityBasisPoints: -1, expectedCloseDate: '' },
      'probabilityBasisPoints must be an integer between 0 and 10000',
    ],
    [
      'POST',
      collectionPath,
      { ...createBody, expectedCloseDate: '' },
      'expectedCloseDate is required',
    ],
    [
      'PATCH',
      badPath,
      { status: null, reason: '', expectedVersion: -1 },
      'opportunityId must be a UUID',
    ],
    ['PATCH', itemPath, { status: null, reason: '', expectedVersion: -1 }, 'status is required'],
    ['PATCH', itemPath, { status: 0, reason: 'reason', expectedVersion: 0 }, 'status is required'],
    [
      'PATCH',
      itemPath,
      { status: 'ACTIVE', reason: '', expectedVersion: -1 },
      'reason is required',
    ],
    [
      'PATCH',
      itemPath,
      { status: 'ACTIVE', reason: 'reason', expectedVersion: -1 },
      'expectedVersion must be a non-negative integer',
    ],
    ['PATCH', badPath, { name: '', expectedVersion: -1 }, 'opportunityId must be a UUID'],
    ['PATCH', itemPath, { name: null, value: 'bad', expectedVersion: -1 }, 'name is required'],
    ['PATCH', itemPath, { value: null, currency: 'bad', expectedVersion: -1 }, 'value is required'],
    ['PATCH', itemPath, { value: 'bad', currency: 'bad', expectedVersion: -1 }, 'Invalid decimal'],
    ['PATCH', itemPath, { value: '-1', expectedVersion: -1 }, 'value must be non-negative'],
    ['PATCH', itemPath, { currency: null, probabilityBasisPoints: -1 }, 'currency is required'],
    [
      'PATCH',
      itemPath,
      { currency: 'cny', probabilityBasisPoints: -1 },
      'Currency must be ISO 4217 uppercase',
    ],
    [
      'PATCH',
      itemPath,
      { probabilityBasisPoints: null, expectedCloseDate: null },
      'probabilityBasisPoints must be an integer between 0 and 10000',
    ],
    [
      'PATCH',
      itemPath,
      { probabilityBasisPoints: 10001, expectedVersion: 0 },
      'probabilityBasisPoints must be an integer between 0 and 10000',
    ],
    [
      'PATCH',
      itemPath,
      { expectedCloseDate: null, expectedVersion: -1 },
      'expectedCloseDate is required',
    ],
  ])('%s %s fixes first error for %j', async (method, path, body, message) => {
    const f = fixture();
    expect(await f.dispatch(method, path, body)).toEqual(invalid(message));
    noCalls(f);
  });
  it.each([undefined, null, -1, 0.5, '0', Number.POSITIVE_INFINITY])(
    'checks expectedVersion %j for both PATCH variants',
    async (expectedVersion) => {
      const f = fixture();
      expect(await f.dispatch('PATCH', itemPath, { expectedVersion })).toEqual(
        invalid('expectedVersion must be a non-negative integer'),
      );
      expect(
        await f.dispatch('PATCH', itemPath, {
          status: 'ACTIVE',
          reason: 'reason',
          expectedVersion,
        }),
      ).toEqual(invalid('expectedVersion must be a non-negative integer'));
      noCalls(f);
    },
  );
});

describe('opportunity inline repository error envelopes', () => {
  it('preserves domain errors and internal redaction for GET and both PATCH variants', async () => {
    const f = fixture();
    for (const [code, status] of [
      ['forbidden', 403],
      ['not_found', 404],
      ['conflict', 409],
      ['invalid_request', 400],
    ] as const) {
      for (const [method, path, body, repo] of [
        ['GET', itemPath, null, 'findOpportunity'],
        ['PATCH', itemPath, updateBody, 'updateOpportunity'],
        ['PATCH', itemPath, lifecycleBody, 'transitionOpportunity'],
      ] as const) {
        f.repository[repo].mockRejectedValueOnce(new DomainError(code, 'fixed failure'));
        expect(await f.dispatch(method, path, body)).toEqual(error(status, code, 'fixed failure'));
      }
    }
    f.repository.createOpportunity.mockRejectedValueOnce(new Error('private fixture failure'));
    expect(await f.dispatch('POST', collectionPath, createBody)).toEqual(
      error(500, 'internal_error', 'Internal server error'),
    );
  });
});
