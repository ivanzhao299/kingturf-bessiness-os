// Fixed HTTP expectations on d17dbc9's inline batch route; replay here is mocked.
import { describe, expect, it, vi } from 'vitest';
import { DomainError, type AuthorizationContext, type ScopeAnchor } from '@kingturf/domain';
import type { PermissionKey } from '@kingturf/types';
import { buildApp, type ApiDependencies } from '../src/app.js';

const id = '11111111-1111-4111-8111-111111111111';
const otherId = '22222222-2222-4222-8222-222222222222';
const correlationId = '33333333-3333-4333-8333-333333333333';
const actor = { companyId: 'tenant', employeeId: 'actor' };
const anchors = [{ scope: 'TEAM', organizationId: id }] as const;
type Grant = NonNullable<ReturnType<AuthorizationContext['permissions']['get']>>;
const grant: Grant = { scopes: ['TEAM'], fields: null };
const path = '/api/v1/complaints/batch-triage';
const row = { id, expectedVersion: 1, assignedTo: otherId, reason: ' assign investigator ' };
const parsedRow = { ...row, reason: 'assign investigator' };
const body = { batchKey: ' BATCH_2026-1 ', items: [row] };
const input = { batchKey: 'BATCH_2026-1', items: [parsedRow] };
const repositoryContext = { actor, scopes: ['TEAM'], anchors };
const rawResult = {
  requested: 3,
  succeeded: 1,
  rejected: 1,
  failed: 1,
  items: [
    { id, status: 'SUCCEEDED' },
    { id: otherId, status: 'REJECTED', code: 'conflict', message: 'stale version' },
    { id: correlationId, status: 'FAILED', code: 'internal_error', message: 'mock failure' },
  ],
  metadata: { mockReplay: true, untouched: ['extra'] },
};
const defaultPermissions: readonly (readonly [PermissionKey, Grant])[] = [
  ['complaint:triage', grant],
  ['complaint:assign', grant],
];
function fixture(
  permissions = defaultPermissions,
  options: {
    available?: boolean;
    anchors?: ReadonlyMap<PermissionKey, readonly ScopeAnchor[]>;
  } = {},
) {
  const context: AuthorizationContext = {
    actor,
    permissions: new Map(permissions),
    scopeAnchors:
      options.anchors ?? new Map(permissions.map(([capability]) => [capability, anchors])),
  };
  const repository = {
    batchTriage: vi.fn().mockResolvedValue(rawResult),
    createComplaint: vi.fn(),
    list: vi.fn(),
    getById: vi.fn(),
    transitionComplaint: vi.fn(),
    listSlaPolicies: vi.fn(),
  };
  const authenticate = vi.fn().mockResolvedValue(context);
  const app = buildApp({
    auth: { authenticate } as unknown as ApiDependencies['auth'],
    employees: {} as ApiDependencies['employees'],
    organizations: {} as ApiDependencies['organizations'],
    ...(options.available === false
      ? {}
      : { complaints: repository as unknown as NonNullable<ApiDependencies['complaints']> }),
  });
  const dispatch = (
    value: unknown = body,
    options: { method?: string; path?: string; key?: string; session?: boolean } = {},
  ) =>
    app.dispatch({
      method: options.method ?? 'POST',
      pathname: options.path ?? path,
      body: value,
      query: { state: 'BAD', limit: 'bad' },
      headers: {
        authorization: options.session === false ? '' : 'Bearer fixture',
        'x-correlation-id': correlationId,
        ...(options.key === undefined ? {} : { 'idempotency-key': options.key }),
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
const fieldDenied = error(403, 'forbidden', 'Field permission denied');
const missing = error(404, 'not_found', 'Route not found');
const noCalls = (f: ReturnType<typeof fixture>) => {
  for (const mock of Object.values(f.repository)) expect(mock).not.toHaveBeenCalled();
};

describe('inline complaint batch triage route contracts', () => {
  it('calls only batch receiver once with normalized input/R/C and returns raw mixed result without read grant', async () => {
    const f = fixture();
    expect(await f.dispatch()).toEqual(response(200, rawResult));
    expect(f.repository.batchTriage).toHaveBeenCalledExactlyOnceWith(
      input,
      repositoryContext,
      correlationId,
    );
    expect(f.repository.batchTriage.mock.contexts).toEqual([f.repository]);
    for (const [name, mock] of Object.entries(f.repository))
      if (name !== 'batchTriage') expect(mock).not.toHaveBeenCalled();
  });
  it('raw result and mock repeated response are not projected by empty read fields', async () => {
    const f = fixture([
      ...defaultPermissions,
      ['complaint:read', { scopes: ['TEAM'], fields: [] }],
    ]);
    expect(await f.dispatch()).toEqual(response(200, rawResult));
    expect(await f.dispatch()).toEqual(response(200, rawResult));
    expect(f.repository.batchTriage).toHaveBeenCalledTimes(2);
    for (const call of f.repository.batchTriage.mock.calls)
      expect(call).toEqual([input, repositoryContext, correlationId]);
  });
  it.each([null, [], false, 0, 'not JSON'])(
    'body %j precedes top allow and permissions',
    async (value) => {
      const f = fixture([]);
      expect(await f.dispatch(value)).toEqual(invalid('A JSON object body is required'));
      noCalls(f);
    },
  );
  it('top unknown keys sorted precede triage and body idempotencyKey is unsupported', async () => {
    const f = fixture([]);
    expect(await f.dispatch({ ...body, z: true, a: true })).toEqual(
      invalid('Unsupported fields: a, z'),
    );
    expect(await f.dispatch({ ...body, idempotencyKey: 'OTHER' })).toEqual(
      invalid('Unsupported fields: idempotencyKey'),
    );
    noCalls(f);
  });
  it('triage authorization precedes assign, then array/length/key; both request only top fields', async () => {
    const emptyFields: Grant = { scopes: ['TEAM'], fields: [] };
    for (const [permissions, expected] of [
      [[], denied],
      [[['complaint:assign', grant]], denied],
      [[['complaint:triage', emptyFields]], fieldDenied],
      [[['complaint:triage', grant]], denied],
      [
        [
          ['complaint:triage', grant],
          ['complaint:assign', emptyFields],
        ],
        fieldDenied,
      ],
      [
        [
          ['complaint:triage', { scopes: [], fields: null }],
          ['complaint:assign', grant],
        ],
        denied,
      ],
      [
        [
          ['complaint:triage', grant],
          ['complaint:assign', { scopes: [], fields: null }],
        ],
        denied,
      ],
    ] as const) {
      const f = fixture(permissions);
      expect(await f.dispatch({ batchKey: '', items: 'bad' })).toEqual(expected);
      noCalls(f);
    }
    const finite: Grant = { scopes: ['TEAM'], fields: ['batchKey', 'items'] };
    const f = fixture([
      ['complaint:triage', finite],
      ['complaint:assign', finite],
    ]);
    expect(await f.dispatch()).toEqual(response(200, rawResult));
  });
  it.each([undefined, null, {}, 'array', false])(
    'items %j is checked after both permissions',
    async (items) => {
      const f = fixture();
      expect(await f.dispatch({ batchKey: '', items })).toEqual(invalid('items must be an array'));
      noCalls(f);
    },
  );
  it.each([0, 51])('length %j fails before row object or key', async (count) => {
    const f = fixture();
    expect(
      await f.dispatch({ batchKey: '', items: Array.from({ length: count }, () => null) }),
    ).toEqual(invalid('items must contain between 1 and 50 rows'));
    noCalls(f);
  });
  it.each([1, 50])(
    'length boundary %j preserves all rows in order in one batch invocation',
    async (count) => {
      const rows = Array.from({ length: count }, (_, index) => ({
        ...row,
        id: `${String(index + 1).padStart(8, '0')}-1111-4111-8111-111111111111`,
      }));
      const expected = rows.map((value) => ({ ...value, reason: 'assign investigator' }));
      const f = fixture();
      expect(await f.dispatch({ ...body, items: rows })).toEqual(response(200, rawResult));
      expect(f.repository.batchTriage).toHaveBeenCalledExactlyOnceWith(
        { batchKey: 'BATCH_2026-1', items: expected },
        repositoryContext,
        correlationId,
      );
    },
  );
  it.each([null, [], 'bad', false])(
    'row object %j uses original unindexed object error',
    async (value) => {
      const f = fixture();
      expect(await f.dispatch({ batchKey: '', items: [row, value] })).toEqual(
        invalid('A JSON object body is required'),
      );
      noCalls(f);
    },
  );
  it('row allow precedes indexed parsers and does not reuse top allow', async () => {
    const f = fixture();
    expect(
      await f.dispatch({ batchKey: '', items: [{ ...row, id: 'bad', z: true, a: true }] }),
    ).toEqual(invalid('Unsupported fields: a, z'));
    expect(await f.dispatch({ ...body, items: [{ ...row, batchKey: 'BAD' }] })).toEqual(
      invalid('Unsupported fields: batchKey'),
    );
    noCalls(f);
  });
  it.each([
    [{ id: 'bad', expectedVersion: 0 }, 'items[1].id must be a UUID'],
    [{ id: undefined, expectedVersion: 0 }, 'items[1].id is required'],
    [
      { expectedVersion: 0, assignedTo: 'bad' },
      'items[1].expectedVersion must be an integer between 1 and 1000000',
    ],
    [{ assignedTo: 'bad', reason: '' }, 'items[1].assignedTo must be a UUID'],
    [{ assignedTo: null, reason: '' }, 'items[1].assignedTo is required'],
    [{ reason: '' }, 'items[1].reason is required'],
  ])('row indexed first-error priority %j', async (changed, message) => {
    const f = fixture();
    expect(
      await f.dispatch({ batchKey: '', items: [row, { ...row, id: otherId, ...changed }] }),
    ).toEqual(invalid(message));
    noCalls(f);
  });
  it.each([0, '1', 1.5, 1000001, undefined])(
    'version %j is not coerced and keeps bounds',
    async (expectedVersion) => {
      const f = fixture();
      expect(await f.dispatch({ ...body, items: [{ ...row, expectedVersion }] })).toEqual(
        invalid('items[0].expectedVersion must be an integer between 1 and 1000000'),
      );
      noCalls(f);
    },
  );
  it.each([1, 1000000])('version boundary %j is accepted', async (expectedVersion) => {
    const f = fixture();
    expect(await f.dispatch({ ...body, items: [{ ...row, expectedVersion }] })).toEqual(
      response(200, rawResult),
    );
    expect(f.repository.batchTriage).toHaveBeenCalledExactlyOnceWith(
      { ...input, items: [{ ...parsedRow, expectedVersion }] },
      repositoryContext,
      correlationId,
    );
  });
  it('parses all rows before duplicates, but first malformed row wins over later row', async () => {
    const f = fixture();
    expect(
      await f.dispatch({ batchKey: '', items: [row, row, { ...row, id: otherId, reason: '' }] }),
    ).toEqual(invalid('items[2].reason is required'));
    expect(await f.dispatch({ batchKey: '', items: [{ ...row, reason: '' }, null] })).toEqual(
      invalid('items[0].reason is required'),
    );
    noCalls(f);
  });
  it('duplicate detection is after trim and before bad batchKey', async () => {
    const f = fixture();
    expect(await f.dispatch({ batchKey: '', items: [row, { ...row, id: ` ${id} ` }] })).toEqual(
      invalid('items must not contain duplicate complaints'),
    );
    noCalls(f);
  });
  it('UUID case is preserved rather than canonicalized for duplicate detection', async () => {
    const lower = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const upper = 'AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA';
    const f = fixture();
    expect(
      await f.dispatch({
        ...body,
        items: [
          { ...row, id: lower },
          { ...row, id: upper },
        ],
      }),
    ).toEqual(response(200, rawResult));
    expect(f.repository.batchTriage).toHaveBeenCalledExactlyOnceWith(
      {
        ...input,
        items: [
          { ...parsedRow, id: lower },
          { ...parsedRow, id: upper },
        ],
      },
      repositoryContext,
      correlationId,
    );
  });
  it('intersection preserves triage scope/anchor order and duplicates, requiring both scope and org match', async () => {
    const triage: Grant = { scopes: ['TEAM', 'COMPANY', 'TEAM', 'SELF'], fields: null };
    const assign: Grant = { scopes: ['SELF', 'TEAM'], fields: null };
    const triageAnchors: readonly ScopeAnchor[] = [
      { scope: 'TEAM', organizationId: id },
      { scope: 'TEAM', organizationId: otherId },
      { scope: 'COMPANY', organizationId: id },
      { scope: 'SELF', organizationId: null },
      { scope: 'TEAM', organizationId: id },
    ];
    const assignAnchors: readonly ScopeAnchor[] = [
      { scope: 'TEAM', organizationId: id },
      { scope: 'SELF', organizationId: null },
      { scope: 'SELF', organizationId: id },
    ];
    const f = fixture(
      [
        ['complaint:triage', triage],
        ['complaint:assign', assign],
      ],
      {
        anchors: new Map<PermissionKey, readonly ScopeAnchor[]>([
          ['complaint:triage', triageAnchors],
          ['complaint:assign', assignAnchors],
        ]),
      },
    );
    expect(await f.dispatch()).toEqual(response(200, rawResult));
    expect(f.repository.batchTriage).toHaveBeenCalledExactlyOnceWith(
      input,
      {
        actor,
        scopes: ['TEAM', 'TEAM', 'SELF'],
        anchors: [triageAnchors[0], triageAnchors[3], triageAnchors[4]],
      },
      correlationId,
    );
  });
  it('nonempty individual grants with empty scope/anchor intersections still invoke repository', async () => {
    const f = fixture(
      [
        ['complaint:triage', grant],
        ['complaint:assign', { scopes: ['COMPANY'], fields: null }],
      ],
      {
        anchors: new Map<PermissionKey, readonly ScopeAnchor[]>([
          ['complaint:triage', anchors],
          ['complaint:assign', [{ scope: 'COMPANY', organizationId: id }]],
        ]),
      },
    );
    expect(await f.dispatch()).toEqual(response(200, rawResult));
    expect(f.repository.batchTriage).toHaveBeenCalledExactlyOnceWith(
      input,
      { actor, scopes: [], anchors: [] },
      correlationId,
    );
  });
  it('anchor intersection is not further filtered by shared scopes; missing anchors stay empty', async () => {
    const f = fixture([
      ['complaint:triage', grant],
      ['complaint:assign', { scopes: ['COMPANY'], fields: null }],
    ]);
    expect(await f.dispatch()).toEqual(response(200, rawResult));
    expect(f.repository.batchTriage).toHaveBeenCalledExactlyOnceWith(
      input,
      { actor, scopes: [], anchors },
      correlationId,
    );
    const empty = fixture(defaultPermissions, { anchors: new Map() });
    expect(await empty.dispatch()).toEqual(response(200, rawResult));
    expect(empty.repository.batchTriage).toHaveBeenCalledExactlyOnceWith(
      input,
      { actor, scopes: ['TEAM'], anchors: [] },
      correlationId,
    );
  });
  it.each([undefined, '', 'lower', '1START', 'A!?', 'A'.repeat(65)])(
    'batchKey %j is required stable code after valid rows',
    async (batchKey) => {
      const f = fixture();
      expect(await f.dispatch({ ...body, batchKey })).toEqual(
        invalid(
          batchKey === undefined || batchKey === ''
            ? 'batchKey is required'
            : 'Code must be 1-64 uppercase letters, digits, underscore, or hyphen',
        ),
      );
      noCalls(f);
    },
  );
  it.each(['A', 'A'.repeat(64)])('batchKey %j boundary accepts trim', async (batchKey) => {
    const f = fixture();
    expect(await f.dispatch({ ...body, batchKey: ` ${batchKey} ` })).toEqual(
      response(200, rawResult),
    );
    expect(f.repository.batchTriage).toHaveBeenCalledExactlyOnceWith(
      { ...input, batchKey },
      repositoryContext,
      correlationId,
    );
  });
  it.each(['', 'x'.repeat(129), 'bad!?'])(
    'header %j ignored, no fallback for missing body batchKey',
    async (key) => {
      const f = fixture();
      expect(await f.dispatch(body, { key })).toEqual(response(200, rawResult));
      expect(await f.dispatch({ ...body, batchKey: undefined }, { key })).toEqual(
        invalid('batchKey is required'),
      );
      expect(f.repository.batchTriage).toHaveBeenCalledOnce();
    },
  );
  it('global401 and absent repository404 precede validators/capabilities', async () => {
    const absent = fixture([], { available: false });
    expect(await absent.dispatch(null)).toEqual(missing);
    expect(await absent.dispatch({ unknown: true })).toEqual(missing);
    expect(await absent.dispatch(null, { session: false })).toEqual(
      error(401, 'authentication_required', 'A valid session is required'),
    );
    expect(absent.authenticate).toHaveBeenCalledTimes(2);
    noCalls(absent);
    const f = fixture();
    expect(await f.dispatch(null, { session: false })).toEqual(
      error(401, 'authentication_required', 'A valid session is required'),
    );
    expect(f.authenticate).not.toHaveBeenCalled();
    noCalls(f);
  });
  it('exact batch match preserves neighbouring create/reads/SLA/transition and unsupported paths/methods', async () => {
    const f = fixture([]);
    for (const method of ['GET', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'])
      expect(await f.dispatch(null, { method })).toEqual(missing);
    for (const pathname of [`${path}/`, path.toUpperCase(), `${path}/unknown`])
      expect(await f.dispatch(null, { path: pathname })).toEqual(missing);
    expect(await f.dispatch({}, { path: '/api/v1/complaints' })).toEqual(denied);
    expect(await f.dispatch(null, { method: 'GET', path: '/api/v1/complaints' })).toEqual(denied);
    expect(await f.dispatch(null, { method: 'GET', path: `/api/v1/complaints/${id}` })).toEqual(
      denied,
    );
    expect(await f.dispatch({}, { path: `/api/v1/complaints/${id}/triage` })).toEqual(denied);
    expect(await f.dispatch({}, { path: '/api/v1/complaint-sla-policies' })).toEqual(denied);
    noCalls(f);
  });
  it('DomainError/internal envelopes keep correlation and messages', async () => {
    const f = fixture();
    for (const [code, status] of [
      ['forbidden', 403],
      ['not_found', 404],
      ['conflict', 409],
      ['invalid_request', 400],
    ] as const) {
      f.repository.batchTriage.mockRejectedValueOnce(new DomainError(code, 'fixed failure'));
      expect(await f.dispatch()).toEqual(error(status, code, 'fixed failure'));
    }
    f.repository.batchTriage.mockRejectedValueOnce(new Error('private fixture failure'));
    expect(await f.dispatch()).toEqual(error(500, 'internal_error', 'Internal server error'));
  });
});
