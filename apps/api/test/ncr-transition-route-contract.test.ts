// Fixed expectations on 00884e1's inline NCR transitions, before extraction.
import { describe, expect, it, vi } from 'vitest';
import { DomainError, type AuthorizationContext } from '@kingturf/domain';
import type { PermissionKey } from '@kingturf/types';
import { buildApp, type ApiDependencies } from '../src/app.js';

const id = '11111111-1111-4111-8111-111111111111';
const correlationId = '33333333-3333-4333-8333-333333333333';
const actor = { companyId: 'tenant', employeeId: 'server-actor' };
const anchors = [{ scope: 'TEAM', organizationId: id }] as const;
const repositoryContext = { actor, scopes: ['TEAM'], anchors };
type Grant = NonNullable<ReturnType<AuthorizationContext['permissions']['get']>>;
const grant: Grant = { scopes: ['TEAM'], fields: null };
const base = '/api/v1/ncrs';
const body = {
  expectedVersion: 2,
  reason: ' fixed reason ',
  rootCauseMethod: ' FIVE_WHY ',
  rootCause: { cause: 'setup' },
  disposition: ' REWORK ',
  evidence: { original: ['evidence'] },
  idempotencyKey: ' NCR_TRANSITION_1 ',
};
const capabilities = ['ncr:manage', 'ncr:disposition', 'ncr:close'] as const;
// Independent old-route oracle, not imported from the implementation.
const operations = [
  { action: 'contain', capability: 'ncr:manage', state: 'CONTAINED', approval: {} },
  { action: 'root-cause', capability: 'ncr:manage', state: 'ROOT_CAUSE_CONFIRMED', approval: {} },
  {
    action: 'disposition',
    capability: 'ncr:disposition',
    state: 'DISPOSITIONED',
    approval: { approvedBy: 'server-actor' },
  },
  { action: 'close', capability: 'ncr:close', state: 'CLOSED', approval: {} },
] as const;
function fixture(
  permissions: readonly (readonly [PermissionKey, Grant])[] = [
    ['ncr:manage', grant],
    ['ncr:disposition', grant],
    ['ncr:close', grant],
    ['ncr:read', grant],
  ],
  available = true,
) {
  const context: AuthorizationContext = {
    actor,
    permissions: new Map(permissions),
    scopeAnchors: new Map(permissions.map(([capability]) => [capability, anchors])),
  };
  const result = { id, version: 3, state: 'repo-state', private: 'raw' };
  const repository = {
    transitionNcr: vi.fn().mockResolvedValue(result),
    createNcr: vi.fn(),
    createCapa: vi.fn(),
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
    action: string,
    value: unknown = body,
    options: { path?: string; method?: string; session?: boolean; key?: string } = {},
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
  return { repository, authenticate, dispatch, result };
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

for (const op of operations) {
  const normalized = {
    state: op.state,
    expectedVersion: 2,
    reason: 'fixed reason',
    rootCauseMethod: 'FIVE_WHY',
    rootCause: body.rootCause,
    disposition: 'REWORK',
    ...op.approval,
    evidence: body.evidence,
    idempotencyKey: 'NCR_TRANSITION_1',
  };
  describe(`inline NCR ${op.action} contracts`, () => {
    it(`maps ${op.capability}/${op.state}, server approval only when disposition, receiver/R/C and 201`, async () => {
      const f = fixture();
      expect(await f.dispatch(op.action)).toEqual(response(201, f.result));
      expect(f.repository.transitionNcr).toHaveBeenCalledExactlyOnceWith(
        id,
        normalized,
        repositoryContext,
        correlationId,
      );
      expect(f.repository.transitionNcr.mock.contexts).toEqual([f.repository]);
      if (op.action !== 'disposition')
        expect(f.repository.transitionNcr.mock.calls[0]?.[1]).not.toHaveProperty('approvedBy');
      for (const [name, mock] of Object.entries(f.repository))
        if (name !== 'transitionNcr') expect(mock).not.toHaveBeenCalled();
    });
    it('other capabilities cannot substitute; 7 fields shared across every action', async () => {
      const other = fixture(
        capabilities
          .filter((capability) => capability !== op.capability)
          .map((capability) => [capability, grant] as const),
      );
      expect(await other.dispatch(op.action)).toEqual(denied);
      noCalls(other);
      const finite = fixture([[op.capability, { scopes: ['TEAM'], fields: Object.keys(body) }]]);
      expect(await finite.dispatch(op.action)).toEqual(response(201, { id, version: 3 }));
    });
    it('body→7 allow→fields/scopes authorization precede optional strings and UUID', async () => {
      const f = fixture([]);
      const options = { path: `${base}/bad/${op.action}` };
      expect(await f.dispatch(op.action, null, options)).toEqual(
        invalid('A JSON object body is required'),
      );
      expect(await f.dispatch(op.action, { ...body, z: true, a: true }, options)).toEqual(
        invalid('Unsupported fields: a, z'),
      );
      expect(await f.dispatch(op.action, { ...body, rootCauseMethod: 'BAD' }, options)).toEqual(
        denied,
      );
      expect(await f.dispatch(op.action, {}, options)).toEqual(denied);
      noCalls(f);
      for (const write of [
        { scopes: ['TEAM'], fields: [] },
        { scopes: [], fields: null },
      ] as const) {
        const constrained = fixture([[op.capability, write]]);
        expect(
          await constrained.dispatch(op.action, { ...body, rootCauseMethod: 'BAD' }, options),
        ).toEqual(write.fields === null ? denied : fieldDenied);
        noCalls(constrained);
      }
      expect(await fixture().dispatch(op.action, { ...body, approvedBy: 'client' })).toEqual(
        invalid('Unsupported fields: approvedBy'),
      );
      const empty = fixture([[op.capability, grant]]);
      expect(await empty.dispatch(op.action, {})).toEqual(
        invalid('expectedVersion must be an integer between 1 and 1000000'),
      );
      noCalls(empty);
    });
    it.each([
      [{ rootCauseMethod: true, disposition: 'BAD' }, 'rootCauseMethod is required'],
      [{ rootCauseMethod: 'BAD', disposition: ' ' }, 'disposition is required'],
      [{ rootCauseMethod: 'BAD', disposition: true }, 'disposition is required'],
      [{ rootCauseMethod: 'BAD', disposition: 'BAD' }, 'rootCauseMethod is unsupported'],
      [{ rootCauseMethod: 'five_why', disposition: 'REWORK' }, 'rootCauseMethod is unsupported'],
      [{ rootCauseMethod: 'FIVE_WHY', disposition: 'rework' }, 'disposition is unsupported'],
    ])('dual strings precede dual enums and invalid UUID %j', async (changed, message) => {
      const f = fixture();
      expect(
        await f.dispatch(
          op.action,
          { ...body, ...changed, expectedVersion: 0 },
          { path: `${base}/bad/${op.action}` },
        ),
      ).toEqual(invalid(message));
      noCalls(f);
    });
    it.each(['FIVE_WHY', 'FISHBONE', 'FAULT_TREE', 'OTHER'])(
      'method %s trims and is accepted for this action',
      async (rootCauseMethod) => {
        const f = fixture();
        expect(
          await f.dispatch(op.action, { ...body, rootCauseMethod: ` ${rootCauseMethod} ` }),
        ).toEqual(response(201, f.result));
        expect(f.repository.transitionNcr).toHaveBeenCalledExactlyOnceWith(
          id,
          { ...normalized, rootCauseMethod },
          repositoryContext,
          correlationId,
        );
      },
    );
    it.each(['REWORK', 'REPAIR', 'CONCESSION', 'RETURN', 'SCRAP', 'SUPPLIER_CLAIM'])(
      'disposition %s trims and is accepted for this action',
      async (disposition) => {
        const f = fixture();
        expect(await f.dispatch(op.action, { ...body, disposition: ` ${disposition} ` })).toEqual(
          response(201, f.result),
        );
        expect(f.repository.transitionNcr).toHaveBeenCalledExactlyOnceWith(
          id,
          { ...normalized, disposition },
          repositoryContext,
          correlationId,
        );
      },
    );
    for (const field of ['rootCauseMethod', 'disposition', 'rootCause'] as const) {
      it.each([undefined, null, '', false, 0])(
        `${field} %j is truthy-optional and omitted`,
        async (value) => {
          const f = fixture();
          expect(await f.dispatch(op.action, { ...body, [field]: value })).toEqual(
            response(201, f.result),
          );
          const expected = Object.fromEntries(
            Object.entries(normalized).filter(([key]) => key !== field),
          );
          expect(f.repository.transitionNcr).toHaveBeenCalledExactlyOnceWith(
            id,
            expected,
            repositoryContext,
            correlationId,
          );
          expect(f.repository.transitionNcr.mock.calls[0]?.[1]).not.toHaveProperty(field);
        },
      );
      it(`${field} falsey key still participates in field authorization`, async () => {
        const f = fixture([
          [
            op.capability,
            { scopes: ['TEAM'], fields: Object.keys(body).filter((key) => key !== field) },
          ],
        ]);
        expect(await f.dispatch(op.action, { ...body, [field]: null })).toEqual(fieldDenied);
        noCalls(f);
      });
    }
    it('absent optional fields have no extra action-specific mandatory checks', async () => {
      const f = fixture([
        [
          op.capability,
          { scopes: ['TEAM'], fields: ['expectedVersion', 'reason', 'idempotencyKey'] },
        ],
      ]);
      expect(
        await f.dispatch(op.action, {
          expectedVersion: 2,
          reason: ' fixed reason ',
          idempotencyKey: ' NCR_TRANSITION_1 ',
        }),
      ).toEqual(response(201, { id, version: 3 }));
      expect(f.repository.transitionNcr).toHaveBeenCalledExactlyOnceWith(
        id,
        {
          state: op.state,
          expectedVersion: 2,
          reason: 'fixed reason',
          ...op.approval,
          evidence: {},
          idempotencyKey: 'NCR_TRANSITION_1',
        },
        repositoryContext,
        correlationId,
      );
    });
    it('valid strings/enums lead to UUID before all remaining values', async () => {
      const f = fixture();
      expect(
        await f.dispatch(
          op.action,
          { ...body, expectedVersion: 0, reason: '' },
          { path: `${base}/bad/${op.action}` },
        ),
      ).toEqual(invalid('ncrId must be a UUID'));
      noCalls(f);
    });
    it.each([
      [
        { expectedVersion: 0, reason: '', rootCause: [] },
        'expectedVersion must be an integer between 1 and 1000000',
      ],
      [{ reason: '', rootCause: [], evidence: false }, 'reason is required'],
      [{ rootCause: [], evidence: false, idempotencyKey: '' }, 'rootCause must be a JSON object'],
      [{ evidence: false, idempotencyKey: '' }, 'evidence must be a JSON object'],
      [{ idempotencyKey: '' }, 'idempotencyKey is required'],
      [
        { idempotencyKey: 'lower' },
        'Code must be 1-64 uppercase letters, digits, underscore, or hyphen',
      ],
    ])('remaining input first-error priority %j', async (changed, message) => {
      const f = fixture();
      expect(await f.dispatch(op.action, { ...body, ...changed })).toEqual(invalid(message));
      noCalls(f);
    });
    it.each([0, '1', 1.5, 1000001, undefined])(
      'version %j retains body number bounds',
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
        response(201, f.result),
      );
      expect(f.repository.transitionNcr).toHaveBeenCalledExactlyOnceWith(
        id,
        { ...normalized, expectedVersion },
        repositoryContext,
        correlationId,
      );
    });
    it.each([[], true, 1, 'bad'])(
      'truthy rootCause %j fails original JSON shape',
      async (rootCause) => {
        const f = fixture();
        expect(await f.dispatch(op.action, { ...body, rootCause })).toEqual(
          invalid('rootCause must be a JSON object'),
        );
        noCalls(f);
      },
    );
    it.each([undefined, null])('evidence %j defaults to {}', async (evidence) => {
      const f = fixture();
      expect(await f.dispatch(op.action, { ...body, evidence })).toEqual(response(201, f.result));
      expect(f.repository.transitionNcr).toHaveBeenCalledExactlyOnceWith(
        id,
        { ...normalized, evidence: {} },
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
    it('body key keeps trim/1/64 and original format', async () => {
      const f = fixture();
      for (const idempotencyKey of ['A', 'A'.repeat(64)]) {
        expect(
          await f.dispatch(op.action, { ...body, idempotencyKey: ` ${idempotencyKey} ` }),
        ).toEqual(response(201, f.result));
        expect(f.repository.transitionNcr).toHaveBeenLastCalledWith(
          id,
          { ...normalized, idempotencyKey },
          repositoryContext,
          correlationId,
        );
      }
      for (const idempotencyKey of ['A'.repeat(65), '1START', 'A!?'])
        expect(await f.dispatch(op.action, { ...body, idempotencyKey })).toEqual(
          invalid('Code must be 1-64 uppercase letters, digits, underscore, or hyphen'),
        );
      expect(f.repository.transitionNcr).toHaveBeenCalledTimes(2);
    });
    it('header is ignored and never fallback for body key', async () => {
      const f = fixture();
      for (const key of ['', 'x'.repeat(129), 'bad!?']) {
        expect(await f.dispatch(op.action, body, { key })).toEqual(response(201, f.result));
        expect(
          await f.dispatch(op.action, { ...body, idempotencyKey: undefined }, { key }),
        ).toEqual(invalid('idempotencyKey is required'));
      }
      expect(f.repository.transitionNcr).toHaveBeenCalledTimes(3);
    });
    it('201 ncr:read full/finite/empty/missing projection never uses complaint:read', async () => {
      for (const [read, dto] of [
        [grant, { id, version: 3, state: 'repo-state', private: 'raw' }],
        [
          { scopes: ['TEAM'], fields: ['state'] },
          { id, state: 'repo-state' },
        ],
        [{ scopes: ['TEAM'], fields: [] }, { id }],
        [undefined, { id, version: 3 }],
      ] as const) {
        const permissions: (readonly [PermissionKey, Grant])[] = [
          [op.capability, grant],
          ['complaint:read', grant],
        ];
        if (read) permissions.push(['ncr:read', read]);
        expect(await fixture(permissions).dispatch(op.action)).toEqual(response(201, dto));
      }
    });
    it('global401 and missing repo404 precede any validator', async () => {
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
    it('wide regex/case/method and neighbouring NCR create/CAPA routes are not swallowed', async () => {
      const f = fixture([]);
      for (const pathname of [
        `${base}/not-a-uuid/${op.action}`,
        `${base}/AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA/${op.action}`,
        `${base}/${id}/${op.action.toUpperCase()}`,
        `${base}/${id}/${op.action}/`,
        `${base}/${id}/${op.action}/extra`,
      ])
        expect(await f.dispatch(op.action, null, { path: pathname })).toEqual(missing);
      for (const method of ['GET', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'])
        expect(await f.dispatch(op.action, null, { method })).toEqual(missing);
      expect(await f.dispatch(op.action, {}, { path: `/api/v1/complaints/${id}/ncrs` })).toEqual(
        denied,
      );
      expect(await f.dispatch(op.action, {}, { path: `${base}/${id}/capas` })).toEqual(denied);
      expect(await f.dispatch(op.action, {}, { path: `/api/v1/complaints/${id}/triage` })).toEqual(
        denied,
      );
      expect(await f.dispatch(op.action, {}, { path: '/api/v1/complaints/batch-triage' })).toEqual(
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
        f.repository.transitionNcr.mockRejectedValueOnce(new DomainError(code, 'fixed failure'));
        expect(await f.dispatch(op.action)).toEqual(error(status, code, 'fixed failure'));
      }
      f.repository.transitionNcr.mockRejectedValueOnce(new Error('private fixture failure'));
      expect(await f.dispatch(op.action)).toEqual(
        error(500, 'internal_error', 'Internal server error'),
      );
    });
  });
}
