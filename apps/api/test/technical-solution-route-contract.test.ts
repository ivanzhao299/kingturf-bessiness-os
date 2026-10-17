// Fixed expectations on 287f613's inline implementation, before route extraction.
import { describe, expect, it, vi } from 'vitest';
import { DomainError, type AuthorizationContext } from '@kingturf/domain';
import type { PermissionKey } from '@kingturf/types';
import { buildApp, type ApiDependencies } from '../src/app.js';

const id = '11111111-1111-4111-8111-111111111111';
const ctrId = '22222222-2222-4222-8222-222222222222';
const correlationId = '33333333-3333-4333-8333-333333333333';
const actor = { companyId: 'tenant', employeeId: 'actor' };
const anchors = [{ scope: 'TEAM', organizationId: id }] as const;
const result = { id, version: 2, status: 'FINAL', secret: 'private' };
type Grant = NonNullable<ReturnType<AuthorizationContext['permissions']['get']>>;
const grant: Grant = { scopes: ['TEAM'], fields: null };
const createPath = '/api/v1/technical-solutions';
const revisionPath = `${createPath}/${id}/revisions`;
const revisionBody = {
  ctrVersionId: ctrId,
  specification: { fixed: true },
  assumptions: ['z', ' a ', 'z', 'a'],
  final: true,
};
const createBody = { opportunityId: id, code: ' solution!? ', ...revisionBody };
const revisionInput = {
  ctrVersionId: ctrId,
  specification: { fixed: true },
  assumptions: [' a ', 'a', 'z'],
  final: true,
};
const methods = ['createTechnicalSolution', 'createTechnicalSolutionRevision'] as const;
type Operation = {
  path: string;
  method: (typeof methods)[number];
  capability: PermissionKey;
  body: Record<string, unknown>;
  args: readonly unknown[];
};
const operations: readonly Operation[] = [
  {
    path: createPath,
    method: 'createTechnicalSolution',
    capability: 'technical-solution:create',
    body: createBody,
    args: [
      { opportunityId: id, code: 'solution!?', ...revisionInput },
      actor,
      ['TEAM'],
      anchors,
      correlationId,
    ],
  },
  {
    path: revisionPath,
    method: 'createTechnicalSolutionRevision',
    capability: 'technical-solution:update',
    body: revisionBody,
    args: [id, revisionInput, actor, ['TEAM'], anchors, correlationId],
  },
];
function fixture(
  permissions: readonly (readonly [PermissionKey, Grant])[] = [
    ['technical-solution:create', grant],
    ['technical-solution:update', grant],
    ['technical-solution:read', grant],
  ],
  available = true,
) {
  const context: AuthorizationContext = {
    actor,
    permissions: new Map(permissions),
    scopeAnchors: new Map(permissions.map(([capability]) => [capability, anchors])),
  };
  const repository = {
    createTechnicalSolution: vi.fn().mockResolvedValue(result),
    createTechnicalSolutionRevision: vi.fn().mockResolvedValue(result),
    listCommercialView: vi.fn().mockResolvedValue([result]),
    listTechnicalSolutions: vi.fn().mockResolvedValue([result]),
  };
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
    path: string,
    body: unknown,
    options: { method?: string; session?: boolean; key?: string } = {},
  ) =>
    app.dispatch({
      method: options.method ?? 'POST',
      pathname: path,
      body,
      headers: {
        authorization: options.session === false ? '' : 'Bearer fixture',
        'x-correlation-id': correlationId,
        ...(options.key === undefined ? {} : { 'idempotency-key': options.key }),
      },
    });
  return { repository, authenticate, dispatch };
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
const missing = error(404, 'not_found', 'Route not found');
const noCalls = (f: ReturnType<typeof fixture>) => {
  for (const mock of Object.values(f.repository)) expect(mock).not.toHaveBeenCalled();
};

describe('technical solution inline write contracts', () => {
  it.each(operations)(
    '$path preserves exact args, receiver, status/DTO and no idempotency requirement',
    async (op) => {
      const f = fixture();
      expect(await f.dispatch(op.path, op.body)).toEqual(response(201, result));
      expect(f.repository[op.method]).toHaveBeenCalledExactlyOnceWith(...op.args);
      expect(f.repository[op.method].mock.contexts).toEqual([f.repository]);
      for (const method of methods)
        if (method !== op.method) expect(f.repository[method]).not.toHaveBeenCalled();
      expect(f.repository.listCommercialView).not.toHaveBeenCalled();
      expect(f.repository.listTechnicalSolutions).not.toHaveBeenCalled();
    },
  );
  it.each(operations)('$path ignores even an invalid idempotency header', async (op) => {
    const f = fixture();
    expect(await f.dispatch(op.path, op.body, { key: 'x'.repeat(129) })).toEqual(
      response(201, result),
    );
    expect(f.repository[op.method]).toHaveBeenCalledExactlyOnceWith(...op.args);
  });
  it.each(operations)('$path retains absent/limited/empty read DTO projection', async (op) => {
    for (const [read, dto] of [
      [undefined, { id, version: 2 }],
      [
        { scopes: ['SELF'], fields: ['status'] },
        { id, status: 'FINAL' },
      ],
      [{ scopes: ['TEAM'], fields: [] }, { id }],
    ] as const) {
      const f = fixture([
        [op.capability, grant],
        ...(read ? [['technical-solution:read', read] as const] : []),
      ]);
      expect(await f.dispatch(op.path, op.body)).toEqual(response(201, dto));
    }
  });
  it.each(operations)(
    '$path parses body/whitelist before permission and permission before values',
    async (op) => {
      const f = fixture([]);
      expect(await f.dispatch(op.path, null)).toEqual(invalid('A JSON object body is required'));
      expect(await f.dispatch(op.path, { ...op.body, unexpected: true })).toEqual(
        invalid('Unsupported fields: unexpected'),
      );
      expect(await f.dispatch(op.path, { ...op.body, ctrVersionId: 'bad' })).toEqual(denied);
      noCalls(f);
      const empty = fixture([[op.capability, { scopes: [], fields: null }]]);
      expect(await empty.dispatch(op.path, op.body)).toEqual(denied);
      noCalls(empty);
    },
  );
  it.each(operations)(
    '$path honors limited fields, rejects empty grants and counts undefined final as a field',
    async (op) => {
      const allowed = fixture([
        [op.capability, { scopes: ['TEAM'], fields: Object.keys(op.body) }],
      ]);
      expect((await allowed.dispatch(op.path, op.body)).statusCode).toBe(201);
      const empty = fixture([[op.capability, { scopes: ['TEAM'], fields: [] }]]);
      expect(await empty.dispatch(op.path, op.body)).toEqual(fieldDenied);
      noCalls(empty);
      const noFinal = fixture([
        [
          op.capability,
          { scopes: ['TEAM'], fields: Object.keys(op.body).filter((field) => field !== 'final') },
        ],
      ]);
      expect(await noFinal.dispatch(op.path, { ...op.body, final: undefined })).toEqual(
        fieldDenied,
      );
      const withoutFinal = { ...op.body };
      delete withoutFinal.final;
      expect((await noFinal.dispatch(op.path, withoutFinal)).statusCode).toBe(201);
      expect(noFinal.repository[op.method]).toHaveBeenCalledOnce();
    },
  );
  it('revision authorizes before path UUID, while whitelist still precedes authorization', async () => {
    const f = fixture([]);
    const path = `${createPath}/bad/revisions`;
    expect(await f.dispatch(path, revisionBody)).toEqual(denied);
    expect(await f.dispatch(path, { unexpected: true })).toEqual(
      invalid('Unsupported fields: unexpected'),
    );
    noCalls(f);
  });
  it.each([
    [
      createPath,
      { ...createBody, opportunityId: 'bad', code: '', ctrVersionId: 'bad' },
      'opportunityId must be a UUID',
    ],
    [createPath, { ...createBody, code: '', ctrVersionId: 'bad' }, 'code is required'],
    [
      `${createPath}/bad/revisions`,
      { ...revisionBody, ctrVersionId: 'bad', specification: null },
      'technicalSolutionId must be a UUID',
    ],
    [
      createPath,
      { ...createBody, ctrVersionId: 'bad', specification: null },
      'ctrVersionId must be a UUID',
    ],
    [
      revisionPath,
      { ...revisionBody, ctrVersionId: 'bad', specification: null },
      'ctrVersionId must be a UUID',
    ],
    [
      createPath,
      { ...createBody, specification: null, assumptions: null },
      'specification must be a JSON object',
    ],
    [
      revisionPath,
      { ...revisionBody, specification: null, assumptions: null },
      'specification must be a JSON object',
    ],
  ])('%s preserves first value failure for %j', async (path, body, message) => {
    const f = fixture();
    expect(await f.dispatch(path, body)).toEqual(invalid(message));
    noCalls(f);
  });
  it.each(operations)(
    '$path does not default missing specification or assumptions and rejects invalid shapes',
    async (op) => {
      const f = fixture();
      for (const specification of [undefined, null, [], 'json', 1]) {
        expect(await f.dispatch(op.path, { ...op.body, specification })).toEqual(
          invalid('specification must be a JSON object'),
        );
      }
      for (const assumptions of [undefined, null, 'text', [' '], [1]]) {
        expect(await f.dispatch(op.path, { ...op.body, assumptions })).toEqual(
          invalid('assumptions must be an array of non-empty strings'),
        );
      }
      noCalls(f);
    },
  );
  for (const op of operations) {
    it.each([true, false, undefined, null, 1, 'true'])(
      `${op.path} retains strict final for %j without coercion or rejection`,
      async (final) => {
        const f = fixture();
        expect(await f.dispatch(op.path, { ...op.body, final })).toEqual(response(201, result));
        const expectedInput = {
          ...(op.method === 'createTechnicalSolution'
            ? { opportunityId: id, code: 'solution!?' }
            : {}),
          ...revisionInput,
          final: final === true,
        };
        expect(f.repository[op.method]).toHaveBeenCalledExactlyOnceWith(
          ...(op.method === 'createTechnicalSolution'
            ? [expectedInput, actor, ['TEAM'], anchors, correlationId]
            : [id, expectedInput, actor, ['TEAM'], anchors, correlationId]),
        );
      },
    );
  }
  it.each(operations)(
    '$path accepts empty JSON/assumptions but rejects a body idempotency key',
    async (op) => {
      const f = fixture();
      expect(await f.dispatch(op.path, { ...op.body, specification: {}, assumptions: [] })).toEqual(
        response(201, result),
      );
      expect(f.repository[op.method]).toHaveBeenCalledOnce();
      expect(await f.dispatch(op.path, { ...op.body, idempotencyKey: 'body-key' })).toEqual(
        invalid('Unsupported fields: idempotencyKey'),
      );
      expect(f.repository[op.method]).toHaveBeenCalledOnce();
    },
  );
  it.each(operations)('$path skips absent repository before body/permission/UUID', async (op) => {
    const f = fixture([], false);
    expect(await f.dispatch(op.path, null)).toEqual(missing);
    expect(await f.dispatch(op.path, { ...op.body, ctrVersionId: 'bad' })).toEqual(missing);
    expect(await f.dispatch(`${createPath}/bad/revisions`, null)).toEqual(missing);
    noCalls(f);
  });
  it.each(operations)('$path requires global session before inputs/dependency', async (op) => {
    const f = fixture([], false);
    expect(await f.dispatch(op.path, null, { session: false })).toEqual(
      error(401, 'authentication_required', 'A valid session is required'),
    );
    expect(f.authenticate).not.toHaveBeenCalled();
    noCalls(f);
  });
  it.each(operations)('$path keeps unsupported method/path boundaries', async (op) => {
    const f = fixture([]);
    for (const method of ['PATCH', 'DELETE', 'OPTIONS'])
      expect(await f.dispatch(op.path, null, { method })).toEqual(missing);
    for (const path of [`${op.path}/`, op.path.toUpperCase(), `${op.path}/unknown`])
      expect(await f.dispatch(path, null)).toEqual(missing);
    if (op.path === revisionPath)
      expect(await f.dispatch(op.path, null, { method: 'GET' })).toEqual(missing);
    noCalls(f);
  });
  it('view and nested GET retain read-only permissions and ignore write inputs', async () => {
    const f = fixture([['technical-solution:read', grant]]);
    expect(await f.dispatch(createPath, null, { method: 'GET' })).toEqual(
      response(200, { items: [result] }),
    );
    expect(f.repository.listCommercialView).toHaveBeenCalledExactlyOnceWith(
      'solutions',
      actor,
      ['TEAM'],
      anchors,
    );
    expect(
      await f.dispatch(`/api/v1/opportunities/${id}/technical-solutions`, null, { method: 'GET' }),
    ).toEqual(response(200, { items: [result] }));
    expect(f.repository.listTechnicalSolutions).toHaveBeenCalledExactlyOnceWith(
      id,
      actor,
      ['TEAM'],
      anchors,
    );
    for (const method of methods) expect(f.repository[method]).not.toHaveBeenCalled();
  });
  it.each(operations)(
    '$path preserves repository domain/internal envelopes and correlation',
    async (op) => {
      const f = fixture();
      for (const [code, status] of [
        ['forbidden', 403],
        ['not_found', 404],
        ['conflict', 409],
        ['invalid_request', 400],
      ] as const) {
        f.repository[op.method].mockRejectedValueOnce(new DomainError(code, 'fixed failure'));
        expect(await f.dispatch(op.path, op.body)).toEqual(error(status, code, 'fixed failure'));
      }
      f.repository[op.method].mockRejectedValueOnce(new Error('private fixture failure'));
      expect(await f.dispatch(op.path, op.body)).toEqual(
        error(500, 'internal_error', 'Internal server error'),
      );
    },
  );
});
