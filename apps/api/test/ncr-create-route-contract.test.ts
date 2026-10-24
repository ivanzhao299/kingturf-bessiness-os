// Fixed expectations on 4437a32's inline NCR creation route, before extraction.
import { describe, expect, it, vi } from 'vitest';
import { DomainError, type AuthorizationContext } from '@kingturf/domain';
import type { PermissionKey } from '@kingturf/types';
import { buildApp, type ApiDependencies } from '../src/app.js';

const id = '11111111-1111-4111-8111-111111111111';
const correlationId = '33333333-3333-4333-8333-333333333333';
const actor = { companyId: 'tenant', employeeId: 'actor' };
const anchors = [{ scope: 'TEAM', organizationId: id }] as const;
const repositoryContext = { actor, scopes: ['TEAM'], anchors };
type Grant = NonNullable<ReturnType<AuthorizationContext['permissions']['get']>>;
const grant: Grant = { scopes: ['TEAM'], fields: null };
const path = `/api/v1/complaints/${id}/ncrs`;
const body = {
  ncrNumber: ' NCR_2026-1 ',
  defectType: ' custom defect ',
  affectedScope: ' rolls ',
  responsibleOrganizationId: id,
  investigatorId: id,
  quarantinedQuantity: ' 1.230000 ',
  temporaryContainment: ' isolate rolls ',
  complaintExpectedVersion: 3,
  evidence: { original: ['evidence'] },
  idempotencyKey: ' NCR_CREATE_1 ',
};
const input = {
  ncrNumber: 'NCR_2026-1',
  complaintId: id,
  defectType: 'custom defect',
  affectedScope: 'rolls',
  responsibleOrganizationId: id,
  investigatorId: id,
  quarantinedQuantity: '1.23',
  temporaryContainment: 'isolate rolls',
  complaintExpectedVersion: 3,
  evidence: body.evidence,
  idempotencyKey: 'NCR_CREATE_1',
};
const result = { id, version: 4, state: 'OPEN', private: 'raw' };
function fixture(
  permissions: readonly (readonly [PermissionKey, Grant])[] = [
    ['ncr:manage', grant],
    ['ncr:read', grant],
  ],
  available = true,
) {
  const context: AuthorizationContext = {
    actor,
    permissions: new Map(permissions),
    scopeAnchors: new Map(permissions.map(([capability]) => [capability, anchors])),
  };
  const repository = {
    createNcr: vi.fn().mockResolvedValue(result),
    transitionNcr: vi.fn(),
    transitionComplaint: vi.fn(),
    createComplaint: vi.fn(),
    batchTriage: vi.fn(),
    list: vi.fn(),
    getById: vi.fn(),
    listSlaPolicies: vi.fn(),
  };
  const authenticate = vi.fn().mockResolvedValue(context);
  const app = buildApp({
    auth: { authenticate } as unknown as ApiDependencies['auth'],
    employees: {} as ApiDependencies['employees'],
    organizations: {} as ApiDependencies['organizations'],
    ...(available
      ? { complaints: repository as unknown as NonNullable<ApiDependencies['complaints']> }
      : {}),
  });
  const dispatch = (
    value: unknown = body,
    options: { path?: string; method?: string; session?: boolean; key?: string } = {},
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
const noCalls = (f: ReturnType<typeof fixture>) => {
  for (const mock of Object.values(f.repository)) expect(mock).not.toHaveBeenCalled();
};

describe('inline NCR creation route contracts', () => {
  it('preserves exact input normalization/order, receiver/R/C, 201 and ignores query without header', async () => {
    const f = fixture();
    expect(await f.dispatch()).toEqual(response(201, result));
    expect(f.repository.createNcr).toHaveBeenCalledExactlyOnceWith(
      input,
      repositoryContext,
      correlationId,
    );
    expect(f.repository.createNcr.mock.contexts).toEqual([f.repository]);
    expect(
      Object.keys(f.repository.createNcr.mock.calls[0]?.[0] as Record<string, unknown>),
    ).toEqual([
      'ncrNumber',
      'complaintId',
      'defectType',
      'affectedScope',
      'responsibleOrganizationId',
      'investigatorId',
      'quarantinedQuantity',
      'temporaryContainment',
      'complaintExpectedVersion',
      'evidence',
      'idempotencyKey',
    ]);
    for (const [name, mock] of Object.entries(f.repository))
      if (name !== 'createNcr') expect(mock).not.toHaveBeenCalled();
  });
  it.each([null, [], 'bad', false, 0])('body %j precedes allow/auth/number/path', async (value) => {
    const f = fixture([]);
    expect(await f.dispatch(value, { path: '/api/v1/complaints/bad/ncrs' })).toEqual(
      invalid('A JSON object body is required'),
    );
    noCalls(f);
  });
  it('10 allow fields precede manage grants, then fields/scopes precede number/path', async () => {
    const absent = fixture([]);
    const options = { path: '/api/v1/complaints/bad/ncrs' };
    expect(await absent.dispatch({ ...body, ncrNumber: '', z: true, a: true }, options)).toEqual(
      invalid('Unsupported fields: a, z'),
    );
    expect(await absent.dispatch({ ...body, ncrNumber: '' }, options)).toEqual(denied);
    noCalls(absent);
    for (const write of [
      { scopes: ['TEAM'], fields: [] },
      { scopes: [], fields: null },
    ] as const) {
      const f = fixture([['ncr:manage', write]]);
      expect(await f.dispatch({ ...body, ncrNumber: '' }, options)).toEqual(
        write.fields === null ? denied : fieldDenied,
      );
      noCalls(f);
    }
    const finite = fixture([['ncr:manage', { scopes: ['TEAM'], fields: Object.keys(body) }]]);
    expect(await finite.dispatch()).toEqual(response(201, { id, version: 4 }));
  });
  it.each([
    ['', 'ncrNumber is required'],
    ['lower', 'Code must be 1-64 uppercase letters, digits, underscore, or hyphen'],
  ])('ncrNumber %j is parsed before invalid path UUID', async (ncrNumber, message) => {
    const f = fixture();
    expect(
      await f.dispatch(
        { ...body, ncrNumber, defectType: '' },
        { path: '/api/v1/complaints/bad/ncrs' },
      ),
    ).toEqual(invalid(message));
    noCalls(f);
  });
  it('valid number leads to path UUID before defectType and remaining input', async () => {
    const f = fixture();
    expect(
      await f.dispatch(
        { ...body, defectType: '', affectedScope: '' },
        { path: '/api/v1/complaints/bad/ncrs' },
      ),
    ).toEqual(invalid('complaintId must be a UUID'));
    noCalls(f);
  });
  it.each([
    [{ defectType: '', affectedScope: '' }, 'defectType is required'],
    [{ affectedScope: '', responsibleOrganizationId: 'bad' }, 'affectedScope is required'],
    [
      { responsibleOrganizationId: 'bad', investigatorId: 'bad' },
      'responsibleOrganizationId must be a UUID',
    ],
    [{ investigatorId: 'bad', quarantinedQuantity: '-1' }, 'investigatorId must be a UUID'],
    [
      { quarantinedQuantity: '-1', temporaryContainment: '' },
      'quarantinedQuantity must be non-negative',
    ],
    [{ quarantinedQuantity: 'bad', temporaryContainment: '' }, 'Invalid decimal'],
    [{ temporaryContainment: '', complaintExpectedVersion: 0 }, 'temporaryContainment is required'],
    [
      { complaintExpectedVersion: 0, evidence: false },
      'complaintExpectedVersion must be an integer between 1 and 1000000',
    ],
    [{ evidence: false, idempotencyKey: '' }, 'evidence must be a JSON object'],
    [{ idempotencyKey: '' }, 'idempotencyKey is required'],
    [
      { idempotencyKey: 'lower' },
      'Code must be 1-64 uppercase letters, digits, underscore, or hyphen',
    ],
  ])('remaining input first-error priority %j', async (changed, message) => {
    const f = fixture();
    expect(await f.dispatch({ ...body, ...changed })).toEqual(invalid(message));
    noCalls(f);
  });
  it.each([undefined, null, '', false, 0])(
    'responsible org %j omitted, not cleared',
    async (responsibleOrganizationId) => {
      const f = fixture();
      expect(await f.dispatch({ ...body, responsibleOrganizationId })).toEqual(
        response(201, result),
      );
      const expected = Object.fromEntries(
        Object.entries(input).filter(([key]) => key !== 'responsibleOrganizationId'),
      );
      expect(f.repository.createNcr).toHaveBeenCalledExactlyOnceWith(
        expected,
        repositoryContext,
        correlationId,
      );
      expect(f.repository.createNcr.mock.calls[0]?.[0]).not.toHaveProperty(
        'responsibleOrganizationId',
      );
    },
  );
  it.each([true, 1, {}])(
    'responsible org truthy %j validates UUID string',
    async (responsibleOrganizationId) => {
      const f = fixture();
      expect(await f.dispatch({ ...body, responsibleOrganizationId })).toEqual(
        invalid('responsibleOrganizationId is required'),
      );
      noCalls(f);
    },
  );
  it('falsey org body key still requests field grant; absent optional org/evidence does not', async () => {
    const fields = Object.keys(body).filter(
      (key) => key !== 'responsibleOrganizationId' && key !== 'evidence',
    );
    const f = fixture([['ncr:manage', { scopes: ['TEAM'], fields }]]);
    expect(
      await f.dispatch({ ...body, responsibleOrganizationId: null, evidence: undefined }),
    ).toEqual(fieldDenied);
    const value = Object.fromEntries(
      Object.entries(body).filter(
        ([key]) => key !== 'responsibleOrganizationId' && key !== 'evidence',
      ),
    );
    expect(await f.dispatch(value)).toEqual(response(201, { id, version: 4 }));
    const expected = Object.fromEntries(
      Object.entries(input).filter(([key]) => key !== 'responsibleOrganizationId'),
    );
    expect(f.repository.createNcr).toHaveBeenCalledExactlyOnceWith(
      { ...expected, evidence: {} },
      repositoryContext,
      correlationId,
    );
  });
  it.each([undefined, null, false, '', 0])(
    'investigator %j is mandatory, not optional',
    async (investigatorId) => {
      const f = fixture();
      expect(await f.dispatch({ ...body, investigatorId })).toEqual(
        invalid('investigatorId is required'),
      );
      noCalls(f);
    },
  );
  it.each([
    ['0', '0'],
    ['-0.000000', '0'],
    [' 1.230000 ', '1.23'],
    ['999999999999999999.123456', '999999999999999999.123456'],
  ])('quantity %j normalizes → %j', async (quarantinedQuantity, normalized) => {
    const f = fixture();
    expect(await f.dispatch({ ...body, quarantinedQuantity })).toEqual(response(201, result));
    expect(f.repository.createNcr).toHaveBeenCalledExactlyOnceWith(
      { ...input, quarantinedQuantity: normalized },
      repositoryContext,
      correlationId,
    );
  });
  it.each([
    ['-1', 'quarantinedQuantity must be non-negative'],
    ['1e2', 'Invalid decimal'],
    ['01', 'Invalid decimal'],
    ['1.1234567', 'Invalid decimal'],
    [1, 'quarantinedQuantity is required'],
    ['', 'quarantinedQuantity is required'],
  ])('quantity %j rejects original bad input', async (quarantinedQuantity, message) => {
    const f = fixture();
    expect(await f.dispatch({ ...body, quarantinedQuantity })).toEqual(invalid(message));
    noCalls(f);
  });
  it.each([0, '1', 1.5, 1000001, undefined])(
    'version %j keeps original number bounds',
    async (complaintExpectedVersion) => {
      const f = fixture();
      expect(await f.dispatch({ ...body, complaintExpectedVersion })).toEqual(
        invalid('complaintExpectedVersion must be an integer between 1 and 1000000'),
      );
      noCalls(f);
    },
  );
  it.each([1, 1000000])('version boundary %j accepted', async (complaintExpectedVersion) => {
    const f = fixture();
    expect(await f.dispatch({ ...body, complaintExpectedVersion })).toEqual(response(201, result));
    expect(f.repository.createNcr).toHaveBeenCalledExactlyOnceWith(
      { ...input, complaintExpectedVersion },
      repositoryContext,
      correlationId,
    );
  });
  it.each([undefined, null])('evidence %j defaults to {}', async (evidence) => {
    const f = fixture();
    expect(await f.dispatch({ ...body, evidence })).toEqual(response(201, result));
    expect(f.repository.createNcr).toHaveBeenCalledExactlyOnceWith(
      { ...input, evidence: {} },
      repositoryContext,
      correlationId,
    );
  });
  it.each([false, [], '', 0])(
    'evidence %j keeps nonobject error rather than default',
    async (evidence) => {
      const f = fixture();
      expect(await f.dispatch({ ...body, evidence })).toEqual(
        invalid('evidence must be a JSON object'),
      );
      noCalls(f);
    },
  );
  it.each(['ncrNumber', 'idempotencyKey'] as const)(
    '%s stable-code trim/1/64 and bad shape boundary',
    async (field) => {
      const f = fixture();
      for (const value of ['A', 'A'.repeat(64)]) {
        expect(await f.dispatch({ ...body, [field]: ` ${value} ` })).toEqual(response(201, result));
        expect(f.repository.createNcr).toHaveBeenLastCalledWith(
          { ...input, [field]: value },
          repositoryContext,
          correlationId,
        );
      }
      for (const value of ['A'.repeat(65), '1START', 'A!?'])
        expect(await f.dispatch({ ...body, [field]: value })).toEqual(
          invalid('Code must be 1-64 uppercase letters, digits, underscore, or hyphen'),
        );
      expect(f.repository.createNcr).toHaveBeenCalledTimes(2);
    },
  );
  it.each(['', 'x'.repeat(129), 'bad!?'])(
    'header %j ignored and no body-key fallback',
    async (key) => {
      const f = fixture();
      expect(await f.dispatch(body, { key })).toEqual(response(201, result));
      expect(await f.dispatch({ ...body, idempotencyKey: undefined }, { key })).toEqual(
        invalid('idempotencyKey is required'),
      );
      expect(f.repository.createNcr).toHaveBeenCalledOnce();
    },
  );
  it('ncr:read full/finite/empty/missing projection is independent of complaint:read', async () => {
    for (const [read, dto] of [
      [grant, result],
      [
        { scopes: ['TEAM'], fields: ['state'] },
        { id, state: 'OPEN' },
      ],
      [{ scopes: ['TEAM'], fields: [] }, { id }],
      [undefined, { id, version: 4 }],
    ] as const) {
      const permissions: (readonly [PermissionKey, Grant])[] = [
        ['ncr:manage', grant],
        ['complaint:read', grant],
      ];
      if (read) permissions.push(['ncr:read', read]);
      expect(await fixture(permissions).dispatch()).toEqual(response(201, dto));
    }
    const wrong = fixture([
      ['complaint:create', grant],
      ['ncr:read', grant],
    ]);
    expect(await wrong.dispatch()).toEqual(denied);
    noCalls(wrong);
  });
  it('global401 and missing repo404 precede body/allow/auth/number/path', async () => {
    const absent = fixture([], false);
    expect(await absent.dispatch(null, { path: '/api/v1/complaints/bad/ncrs' })).toEqual(missing);
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
  it('old wide regex/case/method boundaries and neighbours are not swallowed', async () => {
    const f = fixture([]);
    for (const pathname of [
      '/api/v1/complaints/not-a-uuid/ncrs',
      '/api/v1/complaints/AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA/ncrs',
      `${path}/`,
      path.toUpperCase(),
      `${path}/unknown`,
    ])
      expect(await f.dispatch(null, { path: pathname })).toEqual(missing);
    for (const method of ['GET', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'])
      expect(await f.dispatch(null, { method })).toEqual(missing);
    expect(await f.dispatch({}, { path: `/api/v1/ncrs/${id}/contain` })).toEqual(denied);
    expect(await f.dispatch({}, { path: `/api/v1/complaints/${id}/triage` })).toEqual(denied);
    expect(await f.dispatch({}, { path: '/api/v1/complaints/batch-triage' })).toEqual(denied);
    expect(await f.dispatch({}, { path: '/api/v1/complaints' })).toEqual(denied);
    expect(await f.dispatch(null, { method: 'GET', path: `/api/v1/complaints/${id}` })).toEqual(
      denied,
    );
    expect(await f.dispatch(null, { method: 'GET', path: '/api/v1/complaints' })).toEqual(denied);
    expect(await f.dispatch({}, { path: '/api/v1/complaint-sla-policies' })).toEqual(denied);
    noCalls(f);
  });
  it('DomainError/internal envelopes retain status/message/correlation', async () => {
    const f = fixture();
    for (const [code, status] of [
      ['forbidden', 403],
      ['not_found', 404],
      ['conflict', 409],
      ['invalid_request', 400],
    ] as const) {
      f.repository.createNcr.mockRejectedValueOnce(new DomainError(code, 'fixed failure'));
      expect(await f.dispatch()).toEqual(error(status, code, 'fixed failure'));
    }
    f.repository.createNcr.mockRejectedValueOnce(new Error('private fixture failure'));
    expect(await f.dispatch()).toEqual(error(500, 'internal_error', 'Internal server error'));
  });
});
