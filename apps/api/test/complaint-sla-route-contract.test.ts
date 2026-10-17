// Fixed expectations on 14b841c's inline SLA routes; no extraction in this step.
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
const path = '/api/v1/complaint-sla-policies';
const result = { id, version: 2, policyCode: 'SLA_2026-1', private: 'raw' };
const body = {
  policyCode: ' SLA_2026-1 ',
  version: 2,
  severity: ' MAJOR ',
  responseHours: 1,
  containmentHours: 2,
  rootCauseHours: 4,
  closureHours: 8,
  effectiveAt: ' 2026-10-13T01:00:00+08:00 ',
};
const input = {
  policyCode: 'SLA_2026-1',
  version: 2,
  severity: 'MAJOR',
  responseHours: 1,
  containmentHours: 2,
  rootCauseHours: 4,
  closureHours: 8,
  effectiveAt: '2026-10-12T17:00:00.000Z',
};
function fixture(
  permissions: readonly (readonly [PermissionKey, Grant])[] = [
    ['complaint-sla:read', grant],
    ['complaint-sla:manage', grant],
  ],
  available = true,
) {
  const context: AuthorizationContext = {
    actor,
    permissions: new Map(permissions),
    scopeAnchors: new Map(permissions.map(([capability]) => [capability, anchors])),
  };
  const repository = {
    listSlaPolicies: vi.fn().mockResolvedValue([result]),
    createSlaPolicy: vi.fn().mockResolvedValue(result),
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
    method: string,
    value: unknown = body,
    options: { path?: string; session?: boolean; key?: string } = {},
  ) =>
    app.dispatch({
      method,
      pathname: options.path ?? path,
      body: value,
      query: { severity: 'BAD', limit: 'bad' },
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
const hours = ['responseHours', 'containmentHours', 'rootCauseHours', 'closureHours'] as const;

describe('inline complaint SLA route contracts', () => {
  it('GET ignores malformed body/query/header and preserves receiver/context/200 projection', async () => {
    const f = fixture();
    expect(await f.dispatch('GET', 'not JSON', { key: 'x'.repeat(129) })).toEqual(
      response(200, { items: [result] }),
    );
    expect(f.repository.listSlaPolicies).toHaveBeenCalledExactlyOnceWith(repositoryContext);
    expect(f.repository.listSlaPolicies.mock.contexts).toEqual([f.repository]);
    expect(f.repository.createSlaPolicy).not.toHaveBeenCalled();
  });
  it('POST preserves exact normalized input/context/receiver/correlation/201 without header', async () => {
    const f = fixture();
    expect(await f.dispatch('POST')).toEqual(response(201, result));
    expect(f.repository.createSlaPolicy).toHaveBeenCalledExactlyOnceWith(
      input,
      repositoryContext,
      correlationId,
    );
    expect(f.repository.createSlaPolicy.mock.contexts).toEqual([f.repository]);
    expect(f.repository.listSlaPolicies).not.toHaveBeenCalled();
  });
  it.each(['GET', 'POST'])(
    '%s preserves limited/empty/full read field projection independently',
    async (method) => {
      for (const [read, dto] of [
        [
          { scopes: ['TEAM'], fields: ['policyCode'] },
          { id, policyCode: 'SLA_2026-1' },
        ],
        [{ scopes: ['TEAM'], fields: [] }, { id }],
        [grant, result],
      ] as const) {
        const f = fixture([
          ['complaint-sla:manage', grant],
          ['complaint-sla:read', read],
        ]);
        expect(await f.dispatch(method)).toEqual(
          response(method === 'GET' ? 200 : 201, method === 'GET' ? { items: [dto] } : dto),
        );
      }
    },
  );
  it('POST write-only projection is id/version, GET needs its own read capability', async () => {
    const f = fixture([['complaint-sla:manage', grant]]);
    expect(await f.dispatch('POST')).toEqual(response(201, { id, version: 2 }));
    expect(await f.dispatch('GET', null)).toEqual(denied);
    expect(f.repository.listSlaPolicies).not.toHaveBeenCalled();
  });
  it('GET retains empty list and read grant has no field-request checks', async () => {
    const f = fixture([['complaint-sla:read', { scopes: ['TEAM'], fields: [] }]]);
    f.repository.listSlaPolicies.mockResolvedValueOnce([]);
    expect(await f.dispatch('GET', null)).toEqual(response(200, { items: [] }));
    expect(await f.dispatch('GET', [])).toEqual(response(200, { items: [{ id }] }));
  });
  it('POST body/8-field allow precede permission, field/scopes precede severity and all values', async () => {
    const f = fixture([]);
    expect(await f.dispatch('POST', null)).toEqual(invalid('A JSON object body is required'));
    expect(await f.dispatch('POST', { ...body, unexpected: true })).toEqual(
      invalid('Unsupported fields: unexpected'),
    );
    expect(await f.dispatch('POST', { ...body, severity: 'BAD', responseHours: 0 })).toEqual(
      denied,
    );
    noCalls(f);
    const emptyFields = fixture([['complaint-sla:manage', { scopes: ['TEAM'], fields: [] }]]);
    expect(await emptyFields.dispatch('POST')).toEqual(fieldDenied);
    noCalls(emptyFields);
    const finite = fixture([
      ['complaint-sla:manage', { scopes: ['TEAM'], fields: Object.keys(body) }],
    ]);
    expect(await finite.dispatch('POST')).toEqual(response(201, { id, version: 2 }));
  });
  it.each(['GET', 'POST'])('%s rejects missing capability and empty scopes', async (method) => {
    const capability = method === 'GET' ? 'complaint-sla:read' : 'complaint-sla:manage';
    const absent = fixture([]);
    expect(await absent.dispatch(method)).toEqual(denied);
    noCalls(absent);
    const empty = fixture([[capability, { scopes: [], fields: null }]]);
    expect(await empty.dispatch(method)).toEqual(denied);
    noCalls(empty);
  });
  it.each(['LOW', 'MEDIUM', 'MAJOR', 'CRITICAL'])(
    'POST trims and accepts severity %s',
    async (severity) => {
      const f = fixture();
      expect(await f.dispatch('POST', { ...body, severity: ` ${severity} ` })).toEqual(
        response(201, result),
      );
      expect(f.repository.createSlaPolicy).toHaveBeenCalledExactlyOnceWith(
        { ...input, severity },
        repositoryContext,
        correlationId,
      );
    },
  );
  it.each([undefined, '', 'major', 'BAD'])(
    'severity %j fails before hours/code/version/time',
    async (severity) => {
      const f = fixture();
      expect(
        await f.dispatch('POST', {
          ...body,
          severity,
          responseHours: 0,
          policyCode: '',
          version: 0,
          effectiveAt: 'bad',
        }),
      ).toEqual(
        invalid(
          severity === undefined || severity === ''
            ? 'severity is required'
            : 'severity is unsupported',
        ),
      );
      noCalls(f);
    },
  );
  it.each([
    [
      { responseHours: 0, containmentHours: 0, policyCode: '' },
      'responseHours must be an integer between 1 and 8760',
    ],
    [
      { containmentHours: 0, rootCauseHours: 0, policyCode: '' },
      'containmentHours must be an integer between 1 and 8760',
    ],
    [
      { rootCauseHours: 0, closureHours: 0, policyCode: '' },
      'rootCauseHours must be an integer between 1 and 8760',
    ],
    [{ closureHours: 0, policyCode: '' }, 'closureHours must be an integer between 1 and 8760'],
    [
      { responseHours: 8, containmentHours: 2, policyCode: '', version: 0 },
      'SLA hours must progress from response through closure',
    ],
    [
      { containmentHours: 8, rootCauseHours: 4, policyCode: '' },
      'SLA hours must progress from response through closure',
    ],
    [
      { rootCauseHours: 10, closureHours: 8, policyCode: '' },
      'SLA hours must progress from response through closure',
    ],
    [
      { responseHours: 8, containmentHours: 2, closureHours: 0 },
      'closureHours must be an integer between 1 and 8760',
    ],
    [{ policyCode: '', version: 0, effectiveAt: 'bad' }, 'policyCode is required'],
    [
      { policyCode: 'invalid', version: 0, effectiveAt: 'bad' },
      'Code must be 1-64 uppercase letters, digits, underscore, or hyphen',
    ],
    [{ version: 0, effectiveAt: 'bad' }, 'version must be an integer between 1 and 10000'],
    [{ effectiveAt: '' }, 'effectiveAt is required'],
    [{ effectiveAt: 'bad' }, 'effectiveAt must be a valid timestamp'],
  ])('POST preserves first parsing error for %j', async (changed, message) => {
    const f = fixture();
    expect(await f.dispatch('POST', { ...body, ...changed })).toEqual(invalid(message));
    noCalls(f);
  });
  for (const field of hours) {
    it.each(['1', 0, 8761, 1.5])(`${field} rejects %j without Number conversion`, async (value) => {
      const f = fixture();
      expect(await f.dispatch('POST', { ...body, [field]: value })).toEqual(
        invalid(`${field} must be an integer between 1 and 8760`),
      );
      noCalls(f);
    });
  }
  it.each([1, 8760])('equal hours boundary %j is nondecreasing and accepted', async (value) => {
    const f = fixture();
    const changed = {
      responseHours: value,
      containmentHours: value,
      rootCauseHours: value,
      closureHours: value,
    };
    expect(await f.dispatch('POST', { ...body, ...changed })).toEqual(response(201, result));
    expect(f.repository.createSlaPolicy).toHaveBeenCalledExactlyOnceWith(
      { ...input, ...changed },
      repositoryContext,
      correlationId,
    );
  });
  it.each([1, 10000])('version boundary %j is accepted', async (version) => {
    const f = fixture();
    expect(await f.dispatch('POST', { ...body, version })).toEqual(response(201, result));
    expect(f.repository.createSlaPolicy).toHaveBeenCalledExactlyOnceWith(
      { ...input, version },
      repositoryContext,
      correlationId,
    );
  });
  it.each(['1', 10001, 1.5])(
    'version %j is not coerced or allowed out of range',
    async (version) => {
      const f = fixture();
      expect(await f.dispatch('POST', { ...body, version })).toEqual(
        invalid('version must be an integer between 1 and 10000'),
      );
      noCalls(f);
    },
  );
  it('stable code keeps trim/uppercase shape and 64-character boundary, timestamp keeps broad Date parsing', async () => {
    const f = fixture();
    const policyCode = 'A'.repeat(64);
    expect(
      await f.dispatch('POST', {
        ...body,
        policyCode: ` ${policyCode} `,
        effectiveAt: ' 2026-10-13 ',
      }),
    ).toEqual(response(201, result));
    expect(f.repository.createSlaPolicy).toHaveBeenCalledExactlyOnceWith(
      { ...input, policyCode, effectiveAt: '2026-10-13T00:00:00.000Z' },
      repositoryContext,
      correlationId,
    );
    for (const policyCode of ['A'.repeat(65), '1START', 'A!?'])
      expect(await f.dispatch('POST', { ...body, policyCode })).toEqual(
        invalid('Code must be 1-64 uppercase letters, digits, underscore, or hyphen'),
      );
    expect(f.repository.createSlaPolicy).toHaveBeenCalledOnce();
  });
  it.each(['GET', 'POST'])(
    '%s ignores invalid idempotency header; POST rejects unknown body key',
    async (method) => {
      const f = fixture();
      expect(await f.dispatch(method, body, { key: 'x'.repeat(129) })).toEqual(
        response(method === 'GET' ? 200 : 201, method === 'GET' ? { items: [result] } : result),
      );
      if (method === 'POST') {
        expect(await f.dispatch(method, { ...body, idempotencyKey: 'BODY' })).toEqual(
          invalid('Unsupported fields: idempotencyKey'),
        );
        expect(f.repository.createSlaPolicy).toHaveBeenCalledOnce();
      }
    },
  );
  it.each(['GET', 'POST'])(
    '%s absent complaint repo skips validators and session remains first',
    async (method) => {
      const f = fixture([], false);
      expect(await f.dispatch(method, null)).toEqual(missing);
      expect(await f.dispatch(method, { severity: 'BAD' })).toEqual(missing);
      expect(await f.dispatch(method, null, { session: false })).toEqual(
        error(401, 'authentication_required', 'A valid session is required'),
      );
      expect(f.authenticate).toHaveBeenCalledTimes(2);
      noCalls(f);
    },
  );
  it('unsupported methods/paths and neighbouring complaint list/create retain their old validators', async () => {
    const f = fixture([]);
    for (const method of ['PATCH', 'DELETE', 'OPTIONS'])
      expect(await f.dispatch(method, null)).toEqual(missing);
    for (const pathname of [`${path}/`, path.toUpperCase(), `${path}/unknown`])
      expect(await f.dispatch('POST', null, { path: pathname })).toEqual(missing);
    expect(await f.dispatch('GET', null, { path: '/api/v1/complaints' })).toEqual(denied);
    expect(await f.dispatch('POST', null, { path: '/api/v1/complaints' })).toEqual(
      invalid('A JSON object body is required'),
    );
    noCalls(f);
  });
  it.each(['GET', 'POST'])(
    '%s preserves domain/internal envelopes and correlation',
    async (method) => {
      const f = fixture();
      const mock = method === 'GET' ? f.repository.listSlaPolicies : f.repository.createSlaPolicy;
      for (const [code, status] of [
        ['forbidden', 403],
        ['not_found', 404],
        ['conflict', 409],
        ['invalid_request', 400],
      ] as const) {
        mock.mockRejectedValueOnce(new DomainError(code, 'fixed failure'));
        expect(await f.dispatch(method)).toEqual(error(status, code, 'fixed failure'));
      }
      mock.mockRejectedValueOnce(new Error('private fixture failure'));
      expect(await f.dispatch(method)).toEqual(
        error(500, 'internal_error', 'Internal server error'),
      );
    },
  );
});
