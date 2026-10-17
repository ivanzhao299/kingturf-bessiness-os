// Fixed expectations on fa47d48's inline POST /complaints, before extraction.
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
const path = '/api/v1/complaints';
const result = { id, version: 2, state: 'REPORTED', private: 'raw' };
const body = {
  complaintNumber: ' CMP_2026-1 ',
  customerId: id,
  salesOrderId: id,
  shipmentId: id,
  inventoryLotId: id,
  qualityInspectionId: id,
  slaPolicyVersionId: id,
  channel: ' EMAIL ',
  defectCategory: ' backing ',
  severity: ' MAJOR ',
  occurredAt: ' 2026-10-14 ',
  reportedAt: '2026-10-13T01:00:00+08:00',
  description: ' delamination ',
  customerRequest: ' replace ',
  assignedTo: id,
  initialSnapshot: { nested: { evidence: ['original'] } },
  idempotencyKey: ' CREATE_2026-1 ',
};
const input = {
  complaintNumber: 'CMP_2026-1',
  customerId: id,
  salesOrderId: id,
  shipmentId: id,
  inventoryLotId: id,
  qualityInspectionId: id,
  slaPolicyVersionId: id,
  channel: 'EMAIL',
  defectCategory: 'backing',
  severity: 'MAJOR',
  occurredAt: '2026-10-14T00:00:00.000Z',
  reportedAt: '2026-10-12T17:00:00.000Z',
  description: 'delamination',
  customerRequest: 'replace',
  assignedTo: id,
  initialSnapshot: body.initialSnapshot,
  idempotencyKey: 'CREATE_2026-1',
};
const optionalFields = [
  'salesOrderId',
  'shipmentId',
  'inventoryLotId',
  'qualityInspectionId',
  'assignedTo',
] as const;
function fixture(
  permissions: readonly (readonly [PermissionKey, Grant])[] = [
    ['complaint:create', grant],
    ['complaint:read', grant],
  ],
  available = true,
) {
  const context: AuthorizationContext = {
    actor,
    permissions: new Map(permissions),
    scopeAnchors: new Map(permissions.map(([capability]) => [capability, anchors])),
  };
  const repository = {
    createComplaint: vi.fn().mockResolvedValue(result),
    list: vi.fn(),
    getById: vi.fn(),
    batchTriage: vi.fn(),
    transitionComplaint: vi.fn(),
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
    options: { method?: string; path?: string; session?: boolean; key?: string } = {},
  ) =>
    app.dispatch({
      method: options.method ?? 'POST',
      pathname: options.path ?? path,
      body: value,
      query: { severity: 'BAD', state: 'BAD', limit: 'bad' },
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

describe('inline complaint creation route contracts', () => {
  it('preserves exact normalized 17-field input, receiver/R/correlation, 201 and ignores query/no header', async () => {
    const f = fixture();
    expect(await f.dispatch()).toEqual(response(201, result));
    expect(f.repository.createComplaint).toHaveBeenCalledExactlyOnceWith(
      input,
      repositoryContext,
      correlationId,
    );
    expect(f.repository.createComplaint.mock.contexts).toEqual([f.repository]);
    expect(
      Object.keys(f.repository.createComplaint.mock.calls[0]?.[0] as Record<string, unknown>),
    ).toEqual([
      'complaintNumber',
      'customerId',
      'salesOrderId',
      'shipmentId',
      'inventoryLotId',
      'qualityInspectionId',
      'slaPolicyVersionId',
      'channel',
      'defectCategory',
      'severity',
      'occurredAt',
      'reportedAt',
      'description',
      'customerRequest',
      'assignedTo',
      'initialSnapshot',
      'idempotencyKey',
    ]);
    for (const [name, mock] of Object.entries(f.repository))
      if (name !== 'createComplaint') expect(mock).not.toHaveBeenCalled();
  });
  it.each([null, [], 'not JSON', false, 0])(
    'object body %j precedes permissions',
    async (value) => {
      const f = fixture([]);
      expect(await f.dispatch(value)).toEqual(invalid('A JSON object body is required'));
      noCalls(f);
    },
  );
  it('17-field allow precedes authorization, sorted extras and create/field/scopes precede parsing', async () => {
    const absent = fixture([]);
    expect(await absent.dispatch({ ...body, z: true, a: true, channel: '' })).toEqual(
      invalid('Unsupported fields: a, z'),
    );
    expect(await absent.dispatch({ ...body, channel: '', severity: '' })).toEqual(denied);
    noCalls(absent);
    for (const write of [
      { scopes: ['TEAM'], fields: [] },
      { scopes: [], fields: null },
    ] as const) {
      const f = fixture([['complaint:create', write]]);
      expect(await f.dispatch({ ...body, channel: '' })).toEqual(
        write.fields === null ? denied : fieldDenied,
      );
      noCalls(f);
    }
    const finite = fixture([['complaint:create', { scopes: ['TEAM'], fields: Object.keys(body) }]]);
    expect(await finite.dispatch()).toEqual(response(201, { id, version: 2 }));
  });
  for (const field of optionalFields) {
    it.each([undefined, null, '', false, 0])(
      `${field} %j is omitted, not converted to null`,
      async (value) => {
        const f = fixture();
        expect(await f.dispatch({ ...body, [field]: value })).toEqual(response(201, result));
        const expected = Object.fromEntries(Object.entries(input).filter(([key]) => key !== field));
        expect(f.repository.createComplaint).toHaveBeenCalledExactlyOnceWith(
          expected,
          repositoryContext,
          correlationId,
        );
        expect(f.repository.createComplaint.mock.calls[0]?.[0]).not.toHaveProperty(field);
      },
    );
    it.each(['bad', true, 1, {}])(
      `${field} truthy %j undergoes original UUID parsing`,
      async (value) => {
        const f = fixture();
        expect(await f.dispatch({ ...body, [field]: value })).toEqual(
          invalid(typeof value === 'string' ? `${field} must be a UUID` : `${field} is required`),
        );
        noCalls(f);
      },
    );
    it(`${field} falsey body key still participates in field authorization`, async () => {
      const f = fixture([
        [
          'complaint:create',
          { scopes: ['TEAM'], fields: Object.keys(body).filter((key) => key !== field) },
        ],
      ]);
      expect(await f.dispatch({ ...body, [field]: null })).toEqual(fieldDenied);
      noCalls(f);
    });
  }
  it('absent optional keys remain absent and do not request their field grants', async () => {
    const value = Object.fromEntries(
      Object.entries(body).filter(([key]) => !optionalFields.some((field) => field === key)),
    );
    const expected = Object.fromEntries(
      Object.entries(input).filter(([key]) => !optionalFields.some((field) => field === key)),
    );
    const f = fixture([['complaint:create', { scopes: ['TEAM'], fields: Object.keys(value) }]]);
    expect(await f.dispatch(value)).toEqual(response(201, { id, version: 2 }));
    expect(f.repository.createComplaint).toHaveBeenCalledExactlyOnceWith(
      expected,
      repositoryContext,
      correlationId,
    );
  });
  it.each(['CUSTOMER_SERVICE', 'SALES', 'EMAIL', 'PHONE', 'ONSITE', 'OTHER'])(
    'channel %s accepts trimmed enum',
    async (channel) => {
      const f = fixture();
      expect(await f.dispatch({ ...body, channel: ` ${channel} ` })).toEqual(response(201, result));
      expect(f.repository.createComplaint).toHaveBeenCalledExactlyOnceWith(
        { ...input, channel },
        repositoryContext,
        correlationId,
      );
    },
  );
  it.each(['LOW', 'MEDIUM', 'MAJOR', 'CRITICAL'])(
    'severity %s accepts trimmed enum',
    async (severity) => {
      const f = fixture();
      expect(await f.dispatch({ ...body, severity: ` ${severity} ` })).toEqual(
        response(201, result),
      );
      expect(f.repository.createComplaint).toHaveBeenCalledExactlyOnceWith(
        { ...input, severity },
        repositoryContext,
        correlationId,
      );
    },
  );
  it.each([
    [{ channel: '', severity: '' }, 'channel is required'],
    [{ channel: 'BAD', severity: '' }, 'severity is required'],
    [{ channel: 'BAD', severity: null }, 'severity is required'],
    [{ channel: 'BAD', severity: 'BAD', complaintNumber: '' }, 'channel is unsupported'],
    [{ channel: 'email', severity: 'MAJOR' }, 'channel is unsupported'],
    [{ severity: 'major', complaintNumber: '' }, 'severity is unsupported'],
    [{ severity: 'BAD', customerId: 'bad' }, 'severity is unsupported'],
    [{ complaintNumber: '', customerId: 'bad' }, 'complaintNumber is required'],
    [
      { complaintNumber: 'lower', customerId: 'bad' },
      'Code must be 1-64 uppercase letters, digits, underscore, or hyphen',
    ],
    [{ customerId: 'bad', salesOrderId: 'bad' }, 'customerId must be a UUID'],
    [{ salesOrderId: 'bad', shipmentId: 'bad' }, 'salesOrderId must be a UUID'],
    [{ shipmentId: 'bad', inventoryLotId: 'bad' }, 'shipmentId must be a UUID'],
    [{ inventoryLotId: 'bad', qualityInspectionId: 'bad' }, 'inventoryLotId must be a UUID'],
    [
      { qualityInspectionId: 'bad', slaPolicyVersionId: 'bad' },
      'qualityInspectionId must be a UUID',
    ],
    [{ slaPolicyVersionId: 'bad', defectCategory: '' }, 'slaPolicyVersionId must be a UUID'],
    [{ defectCategory: '', occurredAt: 'bad' }, 'defectCategory is required'],
    [{ occurredAt: 'bad', reportedAt: 'bad' }, 'occurredAt must be a valid timestamp'],
    [{ reportedAt: 'bad', description: '' }, 'reportedAt must be a valid timestamp'],
    [{ description: '', customerRequest: '' }, 'description is required'],
    [{ customerRequest: '', assignedTo: 'bad' }, 'customerRequest is required'],
    [{ assignedTo: 'bad', initialSnapshot: null }, 'assignedTo must be a UUID'],
    [{ initialSnapshot: null, idempotencyKey: '' }, 'initialSnapshot must be a JSON object'],
    [{ idempotencyKey: '' }, 'idempotencyKey is required'],
    [
      { idempotencyKey: 'lower' },
      'Code must be 1-64 uppercase letters, digits, underscore, or hyphen',
    ],
  ])('first-error priority %j', async (changed, message) => {
    const f = fixture();
    expect(await f.dispatch({ ...body, ...changed })).toEqual(invalid(message));
    noCalls(f);
  });
  it.each([undefined, null, [], 'string', false, 0])(
    'initialSnapshot %j is required JSON, not default {}',
    async (initialSnapshot) => {
      const f = fixture();
      expect(await f.dispatch({ ...body, initialSnapshot })).toEqual(
        invalid('initialSnapshot must be a JSON object'),
      );
      noCalls(f);
    },
  );
  it('empty snapshot is valid and broad timestamps/date order are preserved without length checks', async () => {
    const f = fixture();
    expect(
      await f.dispatch({ ...body, initialSnapshot: {}, description: 'x'.repeat(10000) }),
    ).toEqual(response(201, result));
    expect(f.repository.createComplaint).toHaveBeenCalledExactlyOnceWith(
      { ...input, initialSnapshot: {}, description: 'x'.repeat(10000) },
      repositoryContext,
      correlationId,
    );
  });
  it.each(['complaintNumber', 'idempotencyKey'] as const)(
    '%s stable-code 1/64 accepted and bad shape/65 rejected',
    async (field) => {
      const f = fixture();
      for (const value of ['A', 'A'.repeat(64)]) {
        expect(await f.dispatch({ ...body, [field]: ` ${value} ` })).toEqual(response(201, result));
        expect(f.repository.createComplaint).toHaveBeenLastCalledWith(
          { ...input, [field]: value },
          repositoryContext,
          correlationId,
        );
      }
      for (const value of ['A'.repeat(65), '1START', 'A!?'])
        expect(await f.dispatch({ ...body, [field]: value })).toEqual(
          invalid('Code must be 1-64 uppercase letters, digits, underscore, or hyphen'),
        );
      expect(f.repository.createComplaint).toHaveBeenCalledTimes(2);
    },
  );
  it.each(['', 'x'.repeat(129), 'bad!?'])(
    'header %j is ignored and never fallback for body key',
    async (key) => {
      const f = fixture();
      expect(await f.dispatch(body, { key })).toEqual(response(201, result));
      expect(await f.dispatch({ ...body, idempotencyKey: undefined }, { key })).toEqual(
        invalid('idempotencyKey is required'),
      );
      expect(f.repository.createComplaint).toHaveBeenCalledOnce();
    },
  );
  it('independent read full/finite/empty/absent projections preserve original id/version policy', async () => {
    for (const [read, dto] of [
      [grant, result],
      [
        { scopes: ['TEAM'], fields: ['state'] },
        { id, state: 'REPORTED' },
      ],
      [{ scopes: ['TEAM'], fields: [] }, { id }],
      [undefined, { id, version: 2 }],
    ] as const) {
      const permissions: (readonly [PermissionKey, Grant])[] = [['complaint:create', grant]];
      if (read) permissions.push(['complaint:read', read]);
      const f = fixture(permissions);
      expect(await f.dispatch()).toEqual(response(201, dto));
    }
  });
  it('global401/absent repository404 precede body/allow/auth and preserve correlation', async () => {
    const absent = fixture([], false);
    expect(await absent.dispatch(null)).toEqual(missing);
    expect(await absent.dispatch({ unexpected: true })).toEqual(missing);
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
  it('exact matcher does not swallow other methods/paths/SLA/reads/batch/commands', async () => {
    const f = fixture([]);
    for (const method of ['PATCH', 'DELETE', 'OPTIONS', 'HEAD'])
      expect(await f.dispatch(null, { method })).toEqual(missing);
    for (const pathname of [`${path}/`, path.toUpperCase(), `${path}/unknown`, `${path}/${id}`])
      expect(await f.dispatch(null, { path: pathname })).toEqual(missing);
    expect(await f.dispatch(null, { method: 'GET' })).toEqual(denied);
    expect(await f.dispatch(null, { method: 'GET', path: `${path}/${id}` })).toEqual(denied);
    expect(await f.dispatch(null, { path: '/api/v1/complaint-sla-policies' })).toEqual(
      invalid('A JSON object body is required'),
    );
    expect(await f.dispatch({}, { path: `${path}/batch-triage` })).toEqual(denied);
    expect(await f.dispatch({}, { path: `${path}/${id}/triage` })).toEqual(denied);
    noCalls(f);
  });
  it('DomainError/internal envelopes preserve status/message and correlation', async () => {
    const f = fixture();
    for (const [code, status] of [
      ['forbidden', 403],
      ['not_found', 404],
      ['conflict', 409],
      ['invalid_request', 400],
    ] as const) {
      f.repository.createComplaint.mockRejectedValueOnce(new DomainError(code, 'fixed failure'));
      expect(await f.dispatch()).toEqual(error(status, code, 'fixed failure'));
    }
    f.repository.createComplaint.mockRejectedValueOnce(new Error('private fixture failure'));
    expect(await f.dispatch()).toEqual(error(500, 'internal_error', 'Internal server error'));
  });
});
