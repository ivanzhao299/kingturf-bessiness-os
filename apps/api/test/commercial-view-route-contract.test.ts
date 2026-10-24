// Fixed expectations for the inline five-read Map and same-path POST fallthrough at c284ace.
import { describe, expect, it, vi } from 'vitest';
import { DomainError, type AuthorizationContext } from '@kingturf/domain';
import type { PermissionKey } from '@kingturf/types';
import { buildApp, type ApiDependencies } from '../src/app.js';

const id = '11111111-1111-4111-8111-111111111111';
const correlationId = '22222222-2222-4222-8222-222222222222';
const actor = { companyId: 'tenant', employeeId: 'actor' };
const anchors = [{ scope: 'TEAM', organizationId: id }] as const;
const key = 'fixture-key';
const postResult = { id, version: 3, secret: 'private' };
type Grant = NonNullable<ReturnType<AuthorizationContext['permissions']['get']>>;
const grant: Grant = { scopes: ['TEAM'], fields: null };
const ctrInput = { opportunityId: id, code: 'CTR-1', title: 'Fixed', requirements: {} };
const solutionInput = {
  opportunityId: id,
  code: 'SOL-1',
  ctrVersionId: id,
  specification: {},
  assumptions: [],
  final: false,
};
const costBody = {
  modelVersionId: id,
  technicalSolutionRevisionId: id,
  currency: 'CNY',
  lines: [],
  context: {},
};
const policyBody = { policyVersionId: id, costDecisionId: id, context: {} };
const quoteInput = {
  quoteNumber: 'Q-1',
  opportunityId: id,
  ctrVersionId: id,
  technicalSolutionRevisionId: id,
  costDecisionId: id,
  policyVersionId: id,
  policyEvaluationId: id,
  currency: 'CNY',
  subtotal: '1',
  discount: '0',
  total: '1',
  costTotal: '1',
  margin: '0',
  marginBasisPoints: 0,
  validUntil: '2026-10-01T00:00:00.000Z',
  lines: [],
};
const cases = [
  {
    path: '/api/v1/ctrs',
    capability: 'ctr:read',
    view: 'ctrs',
    writer: 'createCtr',
    writeCapability: 'ctr:create',
    body: ctrInput,
    input: ctrInput,
  },
  {
    path: '/api/v1/technical-solutions',
    capability: 'technical-solution:read',
    view: 'solutions',
    writer: 'createTechnicalSolution',
    writeCapability: 'technical-solution:create',
    body: solutionInput,
    input: solutionInput,
  },
  {
    path: '/api/v1/cost-evaluations',
    capability: 'cost:read',
    view: 'costs',
    writer: 'evaluateCost',
    writeCapability: 'cost:evaluate',
    body: costBody,
    input: { ...costBody, idempotencyKey: key },
  },
  {
    path: '/api/v1/sales-policy-evaluations',
    capability: 'sales-policy:read',
    view: 'policies',
    writer: 'evaluatePolicy',
    writeCapability: 'sales-policy:evaluate',
    body: policyBody,
    input: { ...policyBody, idempotencyKey: key },
  },
  {
    path: '/api/v1/quotes',
    capability: 'quote:read',
    view: 'quotes',
    writer: 'createQuote',
    writeCapability: 'quote:create',
    body: quoteInput,
    input: quoteInput,
  },
] as const;
const writerNames = [
  'createCtr',
  'createTechnicalSolution',
  'evaluateCost',
  'evaluatePolicy',
  'createQuote',
] as const;
function fixture(
  permissions: readonly (readonly [PermissionKey, Grant])[] = cases.map((c) => [
    c.capability,
    grant,
  ]),
  available = true,
) {
  const context: AuthorizationContext = {
    actor,
    permissions: new Map(permissions),
    scopeAnchors: new Map(permissions.map(([capability]) => [capability, anchors])),
  };
  const repository = {
    listCommercialView: vi
      .fn()
      .mockImplementation((view: string) =>
        Promise.resolve([
          { id: `fixed-${view}`, title: 'Fixed', secret: 'private', nested: { fixed: true } },
        ]),
      ),
    createCtr: vi.fn().mockResolvedValue(postResult),
    createTechnicalSolution: vi.fn().mockResolvedValue(postResult),
    evaluateCost: vi.fn().mockResolvedValue(postResult),
    evaluatePolicy: vi.fn().mockResolvedValue(postResult),
    createQuote: vi.fn().mockResolvedValue(postResult),
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
  const dispatch = (path: string, method = 'GET', body: unknown = null, session = true) =>
    app.dispatch({
      method,
      pathname: path,
      body,
      query: { page: 'invalid', pageSize: 'invalid', fields: 'secret' },
      headers: {
        authorization: session ? 'Bearer fixture' : '',
        'x-correlation-id': correlationId,
        'idempotency-key': key,
      },
    });
  return { repository, context, authenticate, dispatch };
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
const denied = error(403, 'forbidden', 'Permission denied');
const missing = error(404, 'not_found', 'Route not found');
const noWrites = (f: ReturnType<typeof fixture>) => {
  for (const name of writerNames) expect(f.repository[name]).not.toHaveBeenCalled();
};
const noCalls = (f: ReturnType<typeof fixture>) => {
  expect(f.repository.listCommercialView).not.toHaveBeenCalled();
  noWrites(f);
};

describe.each(cases)('inline commercial read $path contracts', (c) => {
  it('preserves exact view mapping, actor/scopes/anchors, receiver, items and a single call', async () => {
    const f = fixture([[c.capability, grant]]);
    expect(await f.dispatch(c.path)).toEqual(
      response(200, {
        items: [
          { id: `fixed-${c.view}`, title: 'Fixed', secret: 'private', nested: { fixed: true } },
        ],
      }),
    );
    expect(f.repository.listCommercialView).toHaveBeenCalledExactlyOnceWith(
      c.view,
      actor,
      ['TEAM'],
      anchors,
    );
    expect(f.repository.listCommercialView.mock.contexts).toEqual([f.repository]);
    noWrites(f);
  });
  it('requires its own capability rather than any other read or general authorization', async () => {
    const f = fixture([
      ...cases
        .filter((other) => other.capability !== c.capability)
        .map((other) => [other.capability, grant] as const),
      ['authorization:read', grant],
      ['opportunity:read', grant],
    ]);
    expect(await f.dispatch(c.path)).toEqual(denied);
    noCalls(f);
  });
  it('rejects empty scope but allows field restrictions without asking for fields', async () => {
    const emptyScope = fixture([[c.capability, { scopes: [], fields: null }]]);
    expect(await emptyScope.dispatch(c.path)).toEqual(denied);
    noCalls(emptyScope);
    const limited = fixture([[c.capability, { scopes: ['SELF'], fields: ['title'] }]]);
    expect(await limited.dispatch(c.path)).toEqual(
      response(200, { items: [{ id: `fixed-${c.view}`, title: 'Fixed' }] }),
    );
    expect(limited.repository.listCommercialView).toHaveBeenCalledExactlyOnceWith(
      c.view,
      actor,
      ['SELF'],
      anchors,
    );
    const emptyFields = fixture([[c.capability, { scopes: ['TEAM'], fields: [] }]]);
    expect(await emptyFields.dispatch(c.path)).toEqual(
      response(200, { items: [{ id: `fixed-${c.view}` }] }),
    );
  });
  it('ignores GET body and malformed query values', async () => {
    for (const body of [null, 'invalid', [], { extra: true }]) {
      const f = fixture();
      expect((await f.dispatch(c.path, 'GET', body)).statusCode).toBe(200);
      expect(f.repository.listCommercialView).toHaveBeenCalledExactlyOnceWith(
        c.view,
        actor,
        ['TEAM'],
        anchors,
      );
      noWrites(f);
    }
  });
  it('with missing repository skips read permission/body/query checks to 404', async () => {
    const f = fixture([], false);
    for (const body of [null, 'invalid', { extra: true }])
      expect(await f.dispatch(c.path, 'GET', body)).toEqual(missing);
    noCalls(f);
  });
  it('requires global session before GET or same-path POST even with missing repository', async () => {
    const f = fixture([], false);
    for (const method of ['GET', 'POST'])
      expect(await f.dispatch(c.path, method, null, false)).toEqual(
        error(401, 'authentication_required', 'A valid session is required'),
      );
    expect(f.authenticate).not.toHaveBeenCalled();
    noCalls(f);
  });
  it('keeps trailing/case/extra path and unsupported methods outside the read', async () => {
    const f = fixture([]);
    for (const path of [`${c.path}/`, c.path.toUpperCase(), `${c.path}/unknown`])
      expect(await f.dispatch(path)).toEqual(missing);
    for (const method of ['PATCH', 'DELETE', 'OPTIONS'])
      expect(await f.dispatch(c.path, method, null)).toEqual(missing);
    noCalls(f);
  });
  it('preserves empty items and repository error envelopes', async () => {
    const f = fixture();
    f.repository.listCommercialView.mockResolvedValueOnce([]);
    expect(await f.dispatch(c.path)).toEqual(response(200, { items: [] }));
    for (const [code, status] of [
      ['forbidden', 403],
      ['not_found', 404],
      ['conflict', 409],
      ['invalid_request', 400],
    ] as const) {
      f.repository.listCommercialView.mockRejectedValueOnce(new DomainError(code, 'fixed failure'));
      expect(await f.dispatch(c.path)).toEqual(error(status, code, 'fixed failure'));
    }
    f.repository.listCommercialView.mockRejectedValueOnce(new Error('private fixture failure'));
    expect(await f.dispatch(c.path)).toEqual(error(500, 'internal_error', 'Internal server error'));
    noWrites(f);
  });
  it('same-path POST keeps old body/allow/write-permission priority, not read authorization', async () => {
    const f = fixture([]);
    expect(await f.dispatch(c.path, 'POST', null)).toEqual(
      error(400, 'invalid_request', 'A JSON object body is required'),
    );
    expect(await f.dispatch(c.path, 'POST', { extra: true })).toEqual(
      error(400, 'invalid_request', 'Unsupported fields: extra'),
    );
    expect(await f.dispatch(c.path, 'POST', {})).toEqual(denied);
    noCalls(f);
  });
  it('same-path POST succeeds with only its write capability and never calls the read view', async () => {
    const f = fixture([[c.writeCapability, grant]]);
    expect(await f.dispatch(c.path, 'POST', c.body)).toEqual(response(201, { id, version: 3 }));
    expect(f.repository[c.writer]).toHaveBeenCalledExactlyOnceWith(
      c.input,
      actor,
      ['TEAM'],
      anchors,
      correlationId,
    );
    expect(f.repository[c.writer].mock.contexts).toEqual([f.repository]);
    expect(f.repository.listCommercialView).not.toHaveBeenCalled();
    for (const name of writerNames)
      if (name !== c.writer) expect(f.repository[name]).not.toHaveBeenCalled();
  });
  it('same-path POST with no repository falls through to 404 without parsing', async () => {
    const f = fixture([], false);
    expect(await f.dispatch(c.path, 'POST', null)).toEqual(missing);
    noCalls(f);
  });
});
