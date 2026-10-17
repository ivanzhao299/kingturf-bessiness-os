// Fixed inline contracts at 1f3ea33, before extraction; never derive expectations from migrated routes.
import { describe, expect, it, vi } from 'vitest';
import { DomainError, type AuthorizationContext } from '@kingturf/domain';
import type { PermissionKey } from '@kingturf/types';
import { buildApp, type ApiDependencies } from '../src/app.js';

const id = '11111111-1111-4111-8111-111111111111';
const otherId = '22222222-2222-4222-8222-222222222222';
const correlationId = '33333333-3333-4333-8333-333333333333';
const actor = { employeeId: 'collector', companyId: 'tenant' };
const anchors = [{ scope: 'TEAM', organizationId: otherId }] as const;
const access = { actor, scopes: ['COMPANY'], anchors };
const result = { id, version: 7, state: 'FIXED', secret: 'private', evidence: { proof: 'fixed' } };
const collectionItem = {
  id,
  version: 7,
  case_number: 'COL-1',
  events: [
    { id: 'regular', event_type: 'CONTACT', reason: 'normal' },
    { id: 'legal', event_type: 'LEGAL_ACCEPTED', reason: 'legal', secret: 'private' },
  ],
  legalHandoffs: [
    {
      id: 'handoff',
      state: 'ACCEPTED',
      secret: 'private',
      events: [{ id: 'child', state: 'READY', secret: 'private' }],
      packages: [{ id: 'package', state: 'READY', secret: 'private' }],
    },
  ],
};
const methods = [
  'list',
  'createCase',
  'addFollowup',
  'createPromise',
  'decidePromise',
  'requestLegal',
  'decideLegal',
  'generateEvidencePackage',
  'transitionCase',
] as const;
type Method = (typeof methods)[number];
type Grant = NonNullable<ReturnType<AuthorizationContext['permissions']['get']>>;
const grant: Grant = { scopes: ['COMPANY'], fields: null };
const defaultPermissions: readonly (readonly [PermissionKey, Grant])[] = [
  ['collection:read', grant],
  ['collection:manage', grant],
  ['collection:escalate', grant],
  ['collection:close', grant],
  ['legal-case:read', grant],
  ['legal-case:decide', grant],
  ['debt-evidence:generate', grant],
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
      vi.fn().mockResolvedValue(method === 'list' ? [collectionItem] : result),
    ]),
  ) as Record<Method, ReturnType<typeof vi.fn>>;
  const authenticate = vi.fn().mockResolvedValue(context);
  const app = buildApp({
    auth: { authenticate } as unknown as ApiDependencies['auth'],
    employees: {} as ApiDependencies['employees'],
    organizations: {} as ApiDependencies['organizations'],
    ...(available
      ? { collections: repository as unknown as NonNullable<ApiDependencies['collections']> }
      : {}),
  });
  const dispatch = (method: string, pathname: string, body: unknown = null, session = true) =>
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
const stableError = 'Code must be 1-64 uppercase letters, digits, underscore, or hyphen';
const noCalls = (f: ReturnType<typeof fixture>) => {
  for (const method of methods) expect(f.repository[method]).not.toHaveBeenCalled();
};
const time = '2026-10-01T00:00:00.000Z';
const key = 'KEY-1';
const reasonBody = { reason: ' reason ', idempotencyKey: key };
const reasonInput = { reason: 'reason', evidence: {}, idempotencyKey: key };
const caseBody = {
  caseNumber: ' COL-1 ',
  arOpenItemId: id,
  assignedTo: otherId,
  priority: 'HIGH',
  reason: ' reason ',
  idempotencyKey: key,
};
const followupBody = {
  channel: 'PHONE',
  occurredAt: time,
  contactPerson: ' Buyer ',
  outcome: ' paid ',
  idempotencyKey: key,
};
const promiseBody = {
  promisedAmount: '10.500000',
  currency: 'CNY',
  promisedAt: time,
  dueAt: time,
  debtorContact: ' Buyer ',
  idempotencyKey: key,
};
type Operation = {
  path: string;
  capability: PermissionKey;
  method: Exclude<Method, 'list'>;
  body: Record<string, unknown>;
  args: readonly unknown[];
  legal?: boolean;
};
const operations: readonly Operation[] = [
  {
    path: '/api/v1/collection-cases',
    capability: 'collection:manage',
    method: 'createCase',
    body: caseBody,
    args: [
      {
        caseNumber: 'COL-1',
        arOpenItemId: id,
        assignedTo: otherId,
        priority: 'HIGH',
        reason: 'reason',
        idempotencyKey: key,
      },
      access,
      correlationId,
    ],
  },
  {
    path: `/api/v1/collection-cases/${id}/followups`,
    capability: 'collection:manage',
    method: 'addFollowup',
    body: followupBody,
    args: [
      id,
      {
        channel: 'PHONE',
        occurredAt: time,
        contactPerson: 'Buyer',
        outcome: 'paid',
        evidence: {},
        idempotencyKey: key,
      },
      access,
      correlationId,
    ],
  },
  {
    path: `/api/v1/collection-cases/${id}/promises`,
    capability: 'collection:manage',
    method: 'createPromise',
    body: promiseBody,
    args: [
      id,
      {
        promisedAmount: '10.5',
        currency: 'CNY',
        promisedAt: time,
        dueAt: time,
        debtorContact: 'Buyer',
        evidence: {},
        idempotencyKey: key,
      },
      access,
      correlationId,
    ],
  },
  {
    path: `/api/v1/collection-promises/${id}/fulfill`,
    capability: 'collection:escalate',
    method: 'decidePromise',
    body: reasonBody,
    args: [id, 'FULFILLED', { ...reasonInput, allocationEntryIds: [] }, access, correlationId],
  },
  {
    path: `/api/v1/collection-promises/${id}/break`,
    capability: 'collection:escalate',
    method: 'decidePromise',
    body: reasonBody,
    args: [id, 'BROKEN', { ...reasonInput, allocationEntryIds: [] }, access, correlationId],
  },
  {
    path: `/api/v1/collection-promises/${id}/cancel`,
    capability: 'collection:escalate',
    method: 'decidePromise',
    body: reasonBody,
    args: [id, 'CANCELLED', { ...reasonInput, allocationEntryIds: [] }, access, correlationId],
  },
  {
    path: `/api/v1/collection-cases/${id}/legal-handoffs`,
    capability: 'collection:escalate',
    method: 'requestLegal',
    body: { handoffNumber: 'LEGAL-1', ...reasonBody },
    args: [
      id,
      { handoffNumber: 'LEGAL-1', reason: 'reason', idempotencyKey: key },
      access,
      correlationId,
    ],
    legal: true,
  },
  {
    path: `/api/v1/legal-handoffs/${id}/accept`,
    capability: 'legal-case:decide',
    method: 'decideLegal',
    body: reasonBody,
    args: [id, 'ACCEPTED', reasonInput, access, correlationId],
    legal: true,
  },
  {
    path: `/api/v1/legal-handoffs/${id}/return`,
    capability: 'legal-case:decide',
    method: 'decideLegal',
    body: reasonBody,
    args: [id, 'RETURNED', reasonInput, access, correlationId],
    legal: true,
  },
  {
    path: `/api/v1/legal-handoffs/${id}/evidence-packages`,
    capability: 'debt-evidence:generate',
    method: 'generateEvidencePackage',
    body: { packageNumber: 'PKG-1', idempotencyKey: key },
    args: [id, { packageNumber: 'PKG-1', idempotencyKey: key }, access, correlationId],
    legal: true,
  },
  {
    path: `/api/v1/collection-cases/${id}/resolve`,
    capability: 'collection:close',
    method: 'transitionCase',
    body: reasonBody,
    args: [id, 'RESOLVED', reasonInput, access, correlationId],
  },
  {
    path: `/api/v1/collection-cases/${id}/close`,
    capability: 'collection:close',
    method: 'transitionCase',
    body: reasonBody,
    args: [id, 'CLOSED', reasonInput, access, correlationId],
  },
];

describe('collection inline supported write contracts', () => {
  it.each(operations)(
    '$path preserves exact inputs, access, DTO, receiver and single call',
    async (op) => {
      const f = fixture();
      expect(await f.dispatch('POST', op.path, op.body)).toEqual(response(201, result));
      expect(f.repository[op.method]).toHaveBeenCalledExactlyOnceWith(...op.args);
      expect(f.repository[op.method].mock.contexts).toEqual([f.repository]);
      for (const method of methods)
        if (method !== op.method) expect(f.repository[method]).not.toHaveBeenCalled();
    },
  );
  it.each(operations)(
    '$path preserves body/allow before authorization and permission before input values',
    async (op) => {
      const f = fixture([]);
      expect(await f.dispatch('POST', op.path, null)).toEqual(
        invalid('A JSON object body is required'),
      );
      expect(await f.dispatch('POST', op.path, { extra: true })).toEqual(
        invalid('Unsupported fields: extra'),
      );
      expect(await f.dispatch('POST', op.path, {})).toEqual(denied);
      noCalls(f);
      const field = fixture([[op.capability, { scopes: ['COMPANY'], fields: [] }]]);
      expect(await field.dispatch('POST', op.path, op.body)).toEqual(fieldDenied);
      noCalls(field);
      const empty = fixture([[op.capability, { scopes: [], fields: null }]]);
      expect(await empty.dispatch('POST', op.path, op.body)).toEqual(denied);
      noCalls(empty);
    },
  );
  it.each(operations)('$path preserves read-grant mutation filtering', async (op) => {
    const f = fixture([[op.capability, grant]]);
    expect(await f.dispatch('POST', op.path, op.body)).toEqual(response(201, { id, version: 7 }));
    const readCapability = op.legal ? 'legal-case:read' : 'collection:read';
    const limited = fixture([
      [op.capability, grant],
      [readCapability, { scopes: ['COMPANY'], fields: ['state'] }],
    ]);
    expect(await limited.dispatch('POST', op.path, op.body)).toEqual(
      response(201, { id, state: 'FIXED' }),
    );
  });
  it('does not widen legal write responses for SELF-only legal read or collection read alone', async () => {
    for (const op of operations.filter((entry) => entry.legal)) {
      const f = fixture([
        [op.capability, grant],
        ['collection:read', grant],
        ['legal-case:read', { scopes: ['SELF'], fields: null }],
      ]);
      expect(await f.dispatch('POST', op.path, op.body)).toEqual(response(201, { id, version: 7 }));
    }
  });
  it('preserves ordinary mutationDto behavior for an existing empty-scope read grant', async () => {
    const f = fixture([
      ['collection:manage', grant],
      ['collection:read', { scopes: [], fields: null }],
    ]);
    expect(await f.dispatch('POST', '/api/v1/collection-cases', caseBody)).toEqual(
      response(201, result),
    );
  });
});

describe('collection inline GET legal projection contracts', () => {
  it('without legal grant filters legal events/handoffs before collection field projection', async () => {
    const f = fixture([['collection:read', grant]]);
    expect(await f.dispatch('GET', '/api/v1/collection-cases', ['ignored'])).toEqual(
      response(200, {
        items: [
          {
            id,
            version: 7,
            case_number: 'COL-1',
            events: [{ id: 'regular', event_type: 'CONTACT', reason: 'normal' }],
          },
        ],
      }),
    );
    expect(f.repository.list).toHaveBeenCalledExactlyOnceWith({ ...access, legalRead: undefined });
  });
  it('passes independent authorized legal grant and preserves full projection', async () => {
    const f = fixture();
    expect(await f.dispatch('GET', '/api/v1/collection-cases')).toEqual(
      response(200, { items: [collectionItem] }),
    );
    expect(f.repository.list).toHaveBeenCalledExactlyOnceWith({
      ...access,
      legalRead: { context: f.context, scopes: ['COMPANY'], anchors, fields: null },
    });
  });
  it('applies nested legal field filtering before collection whitelist', async () => {
    const f = fixture([
      ['collection:read', { scopes: ['COMPANY'], fields: ['events', 'legalHandoffs'] }],
      ['legal-case:read', { scopes: ['COMPANY'], fields: ['state', 'events', 'packages'] }],
    ]);
    expect(await f.dispatch('GET', '/api/v1/collection-cases')).toEqual(
      response(200, {
        items: [
          {
            id,
            events: [{ id: 'regular', event_type: 'CONTACT', reason: 'normal' }, { id: 'legal' }],
            legalHandoffs: [
              {
                id: 'handoff',
                state: 'ACCEPTED',
                events: [{ id: 'child', state: 'READY' }],
                packages: [{ id: 'package', state: 'READY' }],
              },
            ],
          },
        ],
      }),
    );
  });
  it('SELF legal scope authorizes but does not expose company legal information', async () => {
    const f = fixture([
      ['collection:read', grant],
      ['legal-case:read', { scopes: ['SELF'], fields: null }],
    ]);
    expect(await f.dispatch('GET', '/api/v1/collection-cases')).toEqual(
      response(200, {
        items: [
          {
            id,
            version: 7,
            case_number: 'COL-1',
            events: [{ id: 'regular', event_type: 'CONTACT', reason: 'normal' }],
          },
        ],
      }),
    );
  });
  it('rejects an existing empty-scope legal grant instead of silently degrading', async () => {
    const f = fixture([
      ['collection:read', grant],
      ['legal-case:read', { scopes: [], fields: null }],
    ]);
    expect(await f.dispatch('GET', '/api/v1/collection-cases')).toEqual(denied);
    noCalls(f);
  });
  it('rejects absent collection read before any query', async () => {
    const f = fixture([['legal-case:read', grant]]);
    expect(await f.dispatch('GET', '/api/v1/collection-cases')).toEqual(denied);
    noCalls(f);
  });
});

describe('collection inline parsing precedence', () => {
  const followup = `/api/v1/collection-cases/${id}/followups`,
    promise = `/api/v1/collection-cases/${id}/promises`,
    decision = `/api/v1/collection-promises/${id}/fulfill`;
  it.each([
    [
      '/api/v1/collection-cases',
      { ...caseBody, priority: 'BAD', caseNumber: 'bad' },
      'priority is unsupported',
    ],
    [
      '/api/v1/collection-cases',
      { ...caseBody, caseNumber: 'bad', arOpenItemId: 'bad' },
      stableError,
    ],
    [
      '/api/v1/collection-cases',
      { ...caseBody, arOpenItemId: 'bad', assignedTo: 'bad' },
      'arOpenItemId must be a UUID',
    ],
    [
      '/api/v1/collection-cases',
      { ...caseBody, assignedTo: 'bad', reason: '' },
      'assignedTo must be a UUID',
    ],
    [
      '/api/v1/collection-cases/bad/followups',
      { ...followupBody, channel: 'BAD' },
      'channel is unsupported',
    ],
    [
      '/api/v1/collection-cases/bad/followups',
      { ...followupBody, occurredAt: 'bad' },
      'collectionCaseId must be a UUID',
    ],
    [followup, { ...followupBody, occurredAt: 'bad' }, 'occurredAt must be a valid timestamp'],
    [followup, { ...followupBody, nextActionAt: 'bad' }, 'nextActionAt must be a valid timestamp'],
    [followup, { ...followupBody, evidence: [] }, 'evidence must be a JSON object'],
    [promise, { ...promiseBody, promisedAmount: 'bad', currency: 'bad' }, 'Invalid decimal'],
    [promise, { ...promiseBody, promisedAmount: '-1' }, 'promisedAmount must be non-negative'],
    [promise, { ...promiseBody, currency: 'cny' }, 'Currency must be ISO 4217 uppercase'],
    [
      promise,
      { ...promiseBody, promisedAt: 'bad', dueAt: 'bad' },
      'promisedAt must be a valid timestamp',
    ],
    [promise, { ...promiseBody, dueAt: 'bad' }, 'dueAt must be a valid timestamp'],
    [promise, { ...promiseBody, evidence: 'bad' }, 'evidence must be a JSON object'],
    [decision, { ...reasonBody, allocationEntryIds: ['bad'] }, 'allocationEntryId must be a UUID'],
    [
      decision,
      { ...reasonBody, allocationEntryIds: 'bad' },
      'allocationEntryIds must be an array of non-empty strings',
    ],
    [decision, { ...reasonBody, reason: '', allocationEntryIds: ['bad'] }, 'reason is required'],
    [
      `/api/v1/collection-cases/bad/legal-handoffs`,
      { handoffNumber: 'bad', ...reasonBody },
      'collectionCaseId must be a UUID',
    ],
    [
      `/api/v1/collection-cases/${id}/legal-handoffs`,
      { handoffNumber: 'bad', ...reasonBody },
      stableError,
    ],
    [
      `/api/v1/legal-handoffs/${id}/evidence-packages`,
      { packageNumber: 'bad', idempotencyKey: key },
      stableError,
    ],
  ])('%s preserves first failure for %j', async (path, body, message) => {
    const f = fixture();
    expect(await f.dispatch('POST', path, body)).toEqual(invalid(message));
    noCalls(f);
  });
  it.each(operations)('$path validates idempotencyKey without calling repository', async (op) => {
    const f = fixture();
    expect(await f.dispatch('POST', op.path, { ...op.body, idempotencyKey: 'bad' })).toEqual(
      invalid(stableError),
    );
    expect(await f.dispatch('POST', op.path, { ...op.body, idempotencyKey: undefined })).toEqual(
      invalid('idempotencyKey is required'),
    );
    noCalls(f);
  });
  it('preserves nextActionAt truthiness, timestamp normalization and null evidence default', async () => {
    for (const nextActionAt of [null, false, 0, '']) {
      const f = fixture();
      expect(
        (
          await f.dispatch('POST', followup, {
            ...followupBody,
            occurredAt: '2026-10-01T08:00:00+08:00',
            nextActionAt,
            evidence: null,
          })
        ).statusCode,
      ).toBe(201);
      expect(f.repository.addFollowup).toHaveBeenCalledExactlyOnceWith(
        id,
        {
          channel: 'PHONE',
          occurredAt: time,
          contactPerson: 'Buyer',
          outcome: 'paid',
          evidence: {},
          idempotencyKey: key,
        },
        access,
        correlationId,
      );
    }
    const f = fixture();
    await f.dispatch('POST', followup, {
      ...followupBody,
      nextActionAt: time,
      evidence: { reference: 'fixed' },
    });
    expect(f.repository.addFollowup).toHaveBeenCalledExactlyOnceWith(
      id,
      {
        channel: 'PHONE',
        occurredAt: time,
        contactPerson: 'Buyer',
        outcome: 'paid',
        nextActionAt: time,
        evidence: { reference: 'fixed' },
        idempotencyKey: key,
      },
      access,
      correlationId,
    );
  });
  it('preserves sorted/deduplicated allocation IDs and explicit evidence', async () => {
    const f = fixture();
    await f.dispatch('POST', decision, {
      ...reasonBody,
      allocationEntryIds: [otherId, id, otherId],
      evidence: { reference: 'fixed' },
    });
    expect(f.repository.decidePromise).toHaveBeenCalledExactlyOnceWith(
      id,
      'FULFILLED',
      { ...reasonInput, allocationEntryIds: [id, otherId], evidence: { reference: 'fixed' } },
      access,
      correlationId,
    );
  });
});

describe('collection inline additional projection and UUID precedence contracts', () => {
  it.each(operations.filter((op) => op.path.includes(id)))(
    '$path preserves body/field permission before invalid matched UUID',
    async (op) => {
      const path = op.path.replace(id, 'bad');
      const f = fixture([[op.capability, { scopes: ['COMPANY'], fields: [] }]]);
      expect(await f.dispatch('POST', path, null)).toEqual(
        invalid('A JSON object body is required'),
      );
      expect(await f.dispatch('POST', path, { extra: true })).toEqual(
        invalid('Unsupported fields: extra'),
      );
      expect(await f.dispatch('POST', path, op.body)).toEqual(fieldDenied);
      noCalls(f);
      const allowed = fixture();
      const fieldName =
        op.method === 'decidePromise'
          ? 'promiseId'
          : op.method === 'decideLegal' || op.method === 'generateEvidencePackage'
            ? 'legalHandoffId'
            : 'collectionCaseId';
      expect(await allowed.dispatch('POST', path, op.body)).toEqual(
        invalid(`${fieldName} must be a UUID`),
      );
      noCalls(allowed);
    },
  );
  it.each(
    operations.filter((op) =>
      ['addFollowup', 'createPromise', 'decidePromise', 'decideLegal', 'transitionCase'].includes(
        op.method,
      ),
    ),
  )('$path rejects non-object evidence', async (op) => {
    const f = fixture();
    expect(await f.dispatch('POST', op.path, { ...op.body, evidence: [] })).toEqual(
      invalid('evidence must be a JSON object'),
    );
    noCalls(f);
  });
  it('legal visibility cannot bypass the outer collection whitelist', async () => {
    const f = fixture([
      ['collection:read', { scopes: ['COMPANY'], fields: ['case_number'] }],
      ['legal-case:read', grant],
    ]);
    expect(await f.dispatch('GET', '/api/v1/collection-cases')).toEqual(
      response(200, { items: [{ id, case_number: 'COL-1' }] }),
    );
  });
  it('an existing empty-scope legal read still redacts legal write responses', async () => {
    for (const op of operations.filter((entry) => entry.legal)) {
      const f = fixture([
        [op.capability, grant],
        ['legal-case:read', { scopes: [], fields: null }],
      ]);
      expect(await f.dispatch('POST', op.path, op.body)).toEqual(response(201, { id, version: 7 }));
    }
  });
});

describe('collection inline availability/session/unsupported/envelope contracts', () => {
  it.each(operations)(
    '$path with no repository skips body and authorization to 404',
    async (op) => {
      const f = fixture([], false);
      expect(await f.dispatch('POST', op.path, null)).toEqual(
        error(404, 'not_found', 'Route not found'),
      );
      noCalls(f);
    },
  );
  it('GET with no repository skips authorization to 404', async () => {
    const f = fixture([], false);
    expect(await f.dispatch('GET', '/api/v1/collection-cases', null)).toEqual(
      error(404, 'not_found', 'Route not found'),
    );
    noCalls(f);
  });
  it.each(operations)('$path requires session before parsing', async (op) => {
    const f = fixture();
    expect(await f.dispatch('POST', op.path, null, false)).toEqual(
      error(401, 'authentication_required', 'A valid session is required'),
    );
    expect(f.authenticate).not.toHaveBeenCalled();
    noCalls(f);
  });
  it('GET requires a session', async () => {
    const f = fixture();
    expect(await f.dispatch('GET', '/api/v1/collection-cases', null, false)).toEqual(
      error(401, 'authentication_required', 'A valid session is required'),
    );
    noCalls(f);
  });
  it.each(operations)('$path wrong method does not parse/authorize/call', async (op) => {
    const f = fixture([]);
    expect(await f.dispatch('PATCH', op.path, null)).toEqual(
      error(404, 'not_found', 'Route not found'),
    );
    noCalls(f);
  });
  it.each([
    '/api/v1/collection-cases/not-hex/followups',
    '/api/v1/collection-promises/bad/unknown',
    '/api/v1/legal-handoffs/bad/unknown',
    '/api/v1/collection-cases/bad/unknown',
    '/api/v1/collection-cases/',
  ])('unsupported path %s does not parse/authorize/call', async (path) => {
    const f = fixture([]);
    expect(await f.dispatch('POST', path, null)).toEqual(
      error(404, 'not_found', 'Route not found'),
    );
    noCalls(f);
  });
  it('preserves domain/unexpected envelopes on GET and a mutation', async () => {
    const f = fixture();
    for (const [code, status] of [
      ['forbidden', 403],
      ['not_found', 404],
      ['conflict', 409],
      ['invalid_request', 400],
    ] as const) {
      f.repository.list.mockRejectedValueOnce(new DomainError(code, 'fixed failure'));
      expect(await f.dispatch('GET', '/api/v1/collection-cases')).toEqual(
        error(status, code, 'fixed failure'),
      );
      f.repository.createCase.mockRejectedValueOnce(new DomainError(code, 'fixed failure'));
      expect(await f.dispatch('POST', '/api/v1/collection-cases', caseBody)).toEqual(
        error(status, code, 'fixed failure'),
      );
    }
    f.repository.createCase.mockRejectedValueOnce(new Error('private fixture failure'));
    expect(await f.dispatch('POST', '/api/v1/collection-cases', caseBody)).toEqual(
      error(500, 'internal_error', 'Internal server error'),
    );
  });
});
