// Fixed expectations on 6777e69's inline complaint transitions, before extraction.
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
const base = '/api/v1/complaints';
const body = {
  expectedVersion: 3,
  reason: ' fixed reason ',
  evidence: { original: ['evidence'] },
  assignedTo: id,
  idempotencyKey: ' TRANSITION_1 ',
};
const values = {
  expectedVersion: 3,
  reason: 'fixed reason',
  evidence: body.evidence,
  assignedTo: id,
  idempotencyKey: 'TRANSITION_1',
};
const result = { id, version: 4, state: 'repo-state', private: 'raw' };
// Independent old-route oracle, not generated from a route module.
const operations = [
  { action: 'triage', capability: 'complaint:triage', state: 'TRIAGED', other: 'complaint:close' },
  {
    action: 'investigate',
    capability: 'complaint:triage',
    state: 'INVESTIGATING',
    other: 'complaint:close',
  },
  { action: 'reject', capability: 'complaint:triage', state: 'REJECTED', other: 'complaint:close' },
  { action: 'close', capability: 'complaint:close', state: 'CLOSED', other: 'complaint:triage' },
] as const;
function fixture(
  permissions: readonly (readonly [PermissionKey, Grant])[] = [
    ['complaint:triage', grant],
    ['complaint:close', grant],
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
    transitionComplaint: vi.fn().mockResolvedValue(result),
    createComplaint: vi.fn(),
    batchTriage: vi.fn(),
    createNcr: vi.fn(),
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
    action: string,
    value: unknown = body,
    options: { method?: string; path?: string; session?: boolean; key?: string } = {},
  ) =>
    app.dispatch({
      method: options.method ?? 'POST',
      pathname: options.path ?? `${base}/${id}/${action}`,
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

for (const op of operations) {
  describe(`inline complaint ${op.action} contracts`, () => {
    it(`maps ${op.capability}/${op.state}, receiver/id/input/R/C and 201, ignoring query/header`, async () => {
      const f = fixture();
      expect(await f.dispatch(op.action)).toEqual(response(201, result));
      expect(f.repository.transitionComplaint).toHaveBeenCalledExactlyOnceWith(
        id,
        { state: op.state, ...values },
        repositoryContext,
        correlationId,
      );
      expect(f.repository.transitionComplaint.mock.contexts).toEqual([f.repository]);
      for (const [name, mock] of Object.entries(f.repository))
        if (name !== 'transitionComplaint') expect(mock).not.toHaveBeenCalled();
    });
    it('rejects other action capability and does not add complaint:assign for assignedTo', async () => {
      const other = fixture([[op.other, grant]]);
      expect(await other.dispatch(op.action)).toEqual(denied);
      noCalls(other);
      const f = fixture([[op.capability, grant]]);
      expect(await f.dispatch(op.action)).toEqual(response(201, { id, version: 4 }));
    });
    it('body→allow5→field/scopes auth precedes path UUID', async () => {
      const f = fixture([]);
      const options = { path: `${base}/bad/${op.action}` };
      expect(await f.dispatch(op.action, null, options)).toEqual(
        invalid('A JSON object body is required'),
      );
      expect(await f.dispatch(op.action, { ...body, z: true, a: true }, options)).toEqual(
        invalid('Unsupported fields: a, z'),
      );
      expect(await f.dispatch(op.action, body, options)).toEqual(denied);
      noCalls(f);
      for (const write of [
        { scopes: ['TEAM'], fields: [] },
        { scopes: [], fields: null },
      ] as const) {
        const constrained = fixture([[op.capability, write]]);
        expect(await constrained.dispatch(op.action, body, options)).toEqual(
          write.fields === null ? denied : fieldDenied,
        );
        noCalls(constrained);
      }
      const finite = fixture([[op.capability, { scopes: ['TEAM'], fields: Object.keys(body) }]]);
      expect(await finite.dispatch(op.action)).toEqual(response(201, { id, version: 4 }));
      const noAssigned = fixture([
        [
          op.capability,
          { scopes: ['TEAM'], fields: Object.keys(body).filter((key) => key !== 'assignedTo') },
        ],
      ]);
      expect(await noAssigned.dispatch(op.action, { ...body, assignedTo: null })).toEqual(
        fieldDenied,
      );
      noCalls(noAssigned);
    });
    it('authorized UUID error precedes all input values', async () => {
      const f = fixture();
      expect(
        await f.dispatch(
          op.action,
          { ...body, expectedVersion: 0, reason: '' },
          { path: `${base}/bad/${op.action}` },
        ),
      ).toEqual(invalid('complaintId must be a UUID'));
      noCalls(f);
    });
    it.each([
      [
        { expectedVersion: 0, reason: '', evidence: false },
        'expectedVersion must be an integer between 1 and 1000000',
      ],
      [{ reason: '', evidence: false, assignedTo: 'bad' }, 'reason is required'],
      [
        { evidence: false, assignedTo: 'bad', idempotencyKey: '' },
        'evidence must be a JSON object',
      ],
      [{ assignedTo: 'bad', idempotencyKey: '' }, 'assignedTo must be a UUID'],
      [{ idempotencyKey: '' }, 'idempotencyKey is required'],
      [
        { idempotencyKey: 'lower' },
        'Code must be 1-64 uppercase letters, digits, underscore, or hyphen',
      ],
    ])('input first-error priority %j', async (changed, message) => {
      const f = fixture();
      expect(await f.dispatch(op.action, { ...body, ...changed })).toEqual(invalid(message));
      noCalls(f);
    });
    it.each([0, '1', 1.5, 1000001, undefined])(
      'version %j keeps body number bounds',
      async (expectedVersion) => {
        const f = fixture();
        expect(await f.dispatch(op.action, { ...body, expectedVersion })).toEqual(
          invalid('expectedVersion must be an integer between 1 and 1000000'),
        );
        noCalls(f);
      },
    );
    it.each([1, 1000000])('version boundary %j accepted', async (expectedVersion) => {
      const f = fixture();
      expect(await f.dispatch(op.action, { ...body, expectedVersion })).toEqual(
        response(201, result),
      );
      expect(f.repository.transitionComplaint).toHaveBeenCalledExactlyOnceWith(
        id,
        { state: op.state, ...values, expectedVersion },
        repositoryContext,
        correlationId,
      );
    });
    it.each([undefined, null])('evidence %j defaults to {}', async (evidence) => {
      const f = fixture();
      expect(await f.dispatch(op.action, { ...body, evidence })).toEqual(response(201, result));
      expect(f.repository.transitionComplaint).toHaveBeenCalledExactlyOnceWith(
        id,
        { state: op.state, ...values, evidence: {} },
        repositoryContext,
        correlationId,
      );
    });
    it.each([false, [], '', 0])('evidence %j does not use nullish default', async (evidence) => {
      const f = fixture();
      expect(await f.dispatch(op.action, { ...body, evidence })).toEqual(
        invalid('evidence must be a JSON object'),
      );
      noCalls(f);
    });
    it.each([undefined, null, '', false, 0])(
      'assignedTo %j is omitted not null-cleared',
      async (assignedTo) => {
        const f = fixture();
        expect(await f.dispatch(op.action, { ...body, assignedTo })).toEqual(response(201, result));
        expect(f.repository.transitionComplaint).toHaveBeenCalledExactlyOnceWith(
          id,
          {
            state: op.state,
            expectedVersion: 3,
            reason: 'fixed reason',
            evidence: body.evidence,
            idempotencyKey: 'TRANSITION_1',
          },
          repositoryContext,
          correlationId,
        );
        expect(f.repository.transitionComplaint.mock.calls[0]?.[1]).not.toHaveProperty(
          'assignedTo',
        );
      },
    );
    it.each([true, 1, {}])('truthy assignedTo %j validates UUID string', async (assignedTo) => {
      const f = fixture();
      expect(await f.dispatch(op.action, { ...body, assignedTo })).toEqual(
        invalid('assignedTo is required'),
      );
      noCalls(f);
    });
    it('absent optional fields stay omitted and default evidence without requesting those fields', async () => {
      const f = fixture([
        [
          op.capability,
          { scopes: ['TEAM'], fields: ['expectedVersion', 'reason', 'idempotencyKey'] },
        ],
      ]);
      expect(
        await f.dispatch(op.action, {
          expectedVersion: 3,
          reason: ' fixed reason ',
          idempotencyKey: ' TRANSITION_1 ',
        }),
      ).toEqual(response(201, { id, version: 4 }));
      expect(f.repository.transitionComplaint).toHaveBeenCalledExactlyOnceWith(
        id,
        {
          state: op.state,
          expectedVersion: 3,
          reason: 'fixed reason',
          evidence: {},
          idempotencyKey: 'TRANSITION_1',
        },
        repositoryContext,
        correlationId,
      );
    });
    it('body stable key boundary/trim and invalid shape keep old behavior', async () => {
      const f = fixture();
      for (const idempotencyKey of ['A', 'A'.repeat(64)]) {
        expect(
          await f.dispatch(op.action, { ...body, idempotencyKey: ` ${idempotencyKey} ` }),
        ).toEqual(response(201, result));
        expect(f.repository.transitionComplaint).toHaveBeenLastCalledWith(
          id,
          { state: op.state, ...values, idempotencyKey },
          repositoryContext,
          correlationId,
        );
      }
      for (const idempotencyKey of ['A'.repeat(65), '1START', 'A!?'])
        expect(await f.dispatch(op.action, { ...body, idempotencyKey })).toEqual(
          invalid('Code must be 1-64 uppercase letters, digits, underscore, or hyphen'),
        );
      expect(f.repository.transitionComplaint).toHaveBeenCalledTimes(2);
    });
    it('headers do not participate or substitute body key', async () => {
      const f = fixture();
      for (const key of ['', 'x'.repeat(129), 'bad!?']) {
        expect(await f.dispatch(op.action, body, { key })).toEqual(response(201, result));
        expect(
          await f.dispatch(op.action, { ...body, idempotencyKey: undefined }, { key }),
        ).toEqual(invalid('idempotencyKey is required'));
      }
      expect(f.repository.transitionComplaint).toHaveBeenCalledTimes(3);
    });
    it('independent read full/finite/empty/missing projections keep 201', async () => {
      for (const [read, dto] of [
        [grant, result],
        [
          { scopes: ['TEAM'], fields: ['state'] },
          { id, state: 'repo-state' },
        ],
        [{ scopes: ['TEAM'], fields: [] }, { id }],
        [undefined, { id, version: 4 }],
      ] as const) {
        const permissions: (readonly [PermissionKey, Grant])[] = [[op.capability, grant]];
        if (read) permissions.push(['complaint:read', read]);
        expect(await fixture(permissions).dispatch(op.action)).toEqual(response(201, dto));
      }
    });
    it('session/missing repo precede any body/auth/UUID validation', async () => {
      const options = { path: `${base}/bad/${op.action}` };
      const absent = fixture([], false);
      expect(await absent.dispatch(op.action, null, options)).toEqual(missing);
      expect(await absent.dispatch(op.action, { unknown: true }, options)).toEqual(missing);
      expect(await absent.dispatch(op.action, null, { ...options, session: false })).toEqual(
        error(401, 'authentication_required', 'A valid session is required'),
      );
      expect(absent.authenticate).toHaveBeenCalledTimes(2);
      noCalls(absent);
      const f = fixture();
      expect(await f.dispatch(op.action, null, { session: false })).toEqual(
        error(401, 'authentication_required', 'A valid session is required'),
      );
      expect(f.authenticate).not.toHaveBeenCalled();
      noCalls(f);
    });
    it('regex/method boundaries and neighbours are not swallowed', async () => {
      const f = fixture([]);
      for (const pathname of [
        `${base}/not-a-uuid/${op.action}`,
        `${base}/AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA/${op.action}`,
        `${base}/${id}/${op.action.toUpperCase()}`,
        `${base}/${id}/${op.action}/`,
        `${base}/${id}/${op.action}/unknown`,
      ])
        expect(await f.dispatch(op.action, null, { path: pathname })).toEqual(missing);
      for (const method of ['GET', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'])
        expect(await f.dispatch(op.action, null, { method })).toEqual(missing);
      expect(await f.dispatch(op.action, {}, { path: `${base}/${id}/ncrs` })).toEqual(denied);
      expect(await f.dispatch(op.action, {}, { path: `${base}/batch-triage` })).toEqual(denied);
      expect(await f.dispatch(op.action, {}, { path: base })).toEqual(denied);
      expect(await f.dispatch(op.action, null, { method: 'GET', path: `${base}/${id}` })).toEqual(
        denied,
      );
      expect(await f.dispatch(op.action, null, { method: 'GET', path: base })).toEqual(denied);
      expect(await f.dispatch(op.action, {}, { path: '/api/v1/complaint-sla-policies' })).toEqual(
        denied,
      );
      noCalls(f);
    });
    it('DomainError/internal envelopes preserve global status/message/correlation', async () => {
      const f = fixture();
      for (const [code, status] of [
        ['forbidden', 403],
        ['not_found', 404],
        ['conflict', 409],
        ['invalid_request', 400],
      ] as const) {
        f.repository.transitionComplaint.mockRejectedValueOnce(
          new DomainError(code, 'fixed failure'),
        );
        expect(await f.dispatch(op.action)).toEqual(error(status, code, 'fixed failure'));
      }
      f.repository.transitionComplaint.mockRejectedValueOnce(new Error('private fixture failure'));
      expect(await f.dispatch(op.action)).toEqual(
        error(500, 'internal_error', 'Internal server error'),
      );
    });
  });
}
