// Fixed inline expectations on 05046d2, before quote creation/revision extraction.
import { describe, expect, it, vi } from 'vitest';
import { DomainError, type AuthorizationContext } from '@kingturf/domain';
import type { PermissionKey } from '@kingturf/types';
import { buildApp, type ApiDependencies } from '../src/app.js';

const id = '11111111-1111-4111-8111-111111111111';
const correlationId = '33333333-3333-4333-8333-333333333333';
const actor = { companyId: 'tenant', employeeId: 'actor' };
const anchors = [{ scope: 'TEAM', organizationId: id }] as const;
type Grant = NonNullable<ReturnType<AuthorizationContext['permissions']['get']>>;
const grant: Grant = { scopes: ['TEAM'], fields: null };
const result = { id, version: 2, total: '8', private: 'raw' };
const createPath = '/api/v1/quotes',
  revisionPath = `${createPath}/${id}/revisions`;
const line = {
  description: ' Grass ',
  quantity: ' 2.5000 ',
  unitCode: ' m2!? ',
  unitPrice: ' 3.2000 ',
  total: ' 8.0000 ',
  ignored: { arbitrary: true },
};
const parsedLine = {
  description: 'Grass',
  quantity: '2.5',
  unitCode: 'm2!?',
  unitPrice: '3.2',
  total: '8',
};
const body = {
  quoteNumber: ' Q!? ',
  opportunityId: id,
  ctrVersionId: id,
  technicalSolutionRevisionId: id,
  costDecisionId: id,
  policyVersionId: id,
  policyEvaluationId: id,
  currency: ' USD ',
  subtotal: ' 8.0000 ',
  discount: ' -0.0000 ',
  total: ' 8.0000 ',
  costTotal: ' 10.0000 ',
  margin: ' -2.0000 ',
  marginBasisPoints: -2500,
  validUntil: ' 2026-10-13T01:00:00+08:00 ',
  lines: [line],
};
const input = {
  quoteNumber: 'Q!?',
  opportunityId: id,
  ctrVersionId: id,
  technicalSolutionRevisionId: id,
  costDecisionId: id,
  policyVersionId: id,
  policyEvaluationId: id,
  currency: 'USD',
  subtotal: '8',
  discount: '0',
  total: '8',
  costTotal: '10',
  margin: '-2',
  marginBasisPoints: -2500,
  validUntil: '2026-10-12T17:00:00.000Z',
  lines: [parsedLine],
};
type Operation = { path: string; capability: PermissionKey; input: Record<string, unknown> };
const operations: readonly Operation[] = [
  { path: createPath, capability: 'quote:create', input },
  { path: revisionPath, capability: 'quote:update', input: { quoteId: id, ...input } },
];
function fixture(
  permissions: readonly (readonly [PermissionKey, Grant])[] = [
    ['quote:create', grant],
    ['quote:update', grant],
    ['quote:read', grant],
  ],
  available = true,
) {
  const context: AuthorizationContext = {
    actor,
    permissions: new Map(permissions),
    scopeAnchors: new Map(permissions.map(([capability]) => [capability, anchors])),
  };
  const repository = {
    createQuote: vi.fn().mockResolvedValue(result),
    listCommercialView: vi.fn().mockResolvedValue([result]),
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
    value: unknown = body,
    options: { method?: string; session?: boolean; key?: string } = {},
  ) =>
    app.dispatch({
      method: options.method ?? 'POST',
      pathname: path,
      body: value,
      query: { quoteId: 'bad', lines: 'bad' },
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

describe('inline quote creation and full revision contracts', () => {
  it.each(operations)(
    '$path preserves createQuote receiver/exact input/anchors/correlation/201 and ignores query/header',
    async (op) => {
      const f = fixture();
      expect(await f.dispatch(op.path)).toEqual(response(201, result));
      expect(f.repository.createQuote).toHaveBeenCalledExactlyOnceWith(
        op.input,
        actor,
        ['TEAM'],
        anchors,
        correlationId,
      );
      expect(f.repository.createQuote.mock.contexts).toEqual([f.repository]);
      expect(f.repository.listCommercialView).not.toHaveBeenCalled();
    },
  );
  it.each(operations)(
    '$path body/allow precede authorization, then field/scope grants precede lines/UUID',
    async (op) => {
      const f = fixture([]);
      expect(await f.dispatch(op.path, null)).toEqual(invalid('A JSON object body is required'));
      expect(await f.dispatch(op.path, { ...body, quoteId: id })).toEqual(
        invalid('Unsupported fields: quoteId'),
      );
      expect(await f.dispatch(op.path, { ...body, unknown: true })).toEqual(
        invalid('Unsupported fields: unknown'),
      );
      expect(await f.dispatch(op.path.replace(id, 'bad'), { ...body, lines: null })).toEqual(
        denied,
      );
      noCalls(f);
      const emptyScopes = fixture([[op.capability, { scopes: [], fields: null }]]);
      expect(await emptyScopes.dispatch(op.path)).toEqual(denied);
      noCalls(emptyScopes);
      const emptyFields = fixture([[op.capability, { scopes: ['TEAM'], fields: [] }]]);
      expect(await emptyFields.dispatch(op.path)).toEqual(fieldDenied);
      noCalls(emptyFields);
      const finite = fixture([[op.capability, { scopes: ['TEAM'], fields: Object.keys(body) }]]);
      expect((await finite.dispatch(op.path)).statusCode).toBe(201);
    },
  );
  it.each(operations)(
    '$path preserves independent quote read absent/empty/limited/full projections',
    async (op) => {
      for (const [read, dto] of [
        [undefined, { id, version: 2 }],
        [{ scopes: ['SELF'], fields: [] }, { id }],
        [
          { scopes: ['SELF'], fields: ['total'] },
          { id, total: '8' },
        ],
        [grant, result],
      ] as const) {
        const f = fixture([
          [op.capability, grant],
          ...(read ? [['quote:read', read] as const] : []),
        ]);
        expect(await f.dispatch(op.path)).toEqual(response(201, dto));
      }
      const f = fixture([
        [op.capability, grant],
        ['cost:read', grant],
      ]);
      expect(await f.dispatch(op.path)).toEqual(response(201, { id, version: 2 }));
    },
  );
  it.each(operations)(
    '$path all lines parse before revision UUID/quoteNumber and top UUIDs',
    async (op) => {
      const f = fixture();
      const path = op.path.replace(id, 'bad');
      for (const [lines, message] of [
        [null, 'lines must be an array'],
        [[null], 'lines[0] must be a JSON object'],
        [[line, null], 'lines[1] must be a JSON object'],
        [[line, { ...line, description: '' }], 'description is required'],
      ] as const)
        expect(
          await f.dispatch(path, { ...body, lines, quoteNumber: '', opportunityId: 'bad' }),
        ).toEqual(invalid(message));
      noCalls(f);
    },
  );
  for (const op of operations) {
    it.each([
      [{ description: '', quantity: '-1' }, 'description is required'],
      [{ quantity: '-1', unitCode: '' }, 'quantity must be non-negative'],
      [{ quantity: '01' }, 'Invalid decimal'],
      [{ quantity: 1 }, 'quantity is required'],
      [{ unitCode: '', unitPrice: '-1' }, 'unitCode is required'],
      [{ unitPrice: '-1', total: '-1' }, 'unitPrice must be non-negative'],
      [{ total: '-1' }, 'total must be non-negative'],
    ])(`${op.path} retains line field order %j`, async (changed, message) => {
      const f = fixture();
      expect(
        await f.dispatch(op.path.replace(id, 'bad'), {
          ...body,
          lines: [{ ...line, ...changed }],
          quoteNumber: '',
        }),
      ).toEqual(invalid(message));
      noCalls(f);
    });
    it.each([-100000, 10000])(
      `${op.path} accepts integer margin boundary %j`,
      async (marginBasisPoints) => {
        const f = fixture();
        expect(await f.dispatch(op.path, { ...body, marginBasisPoints })).toEqual(
          response(201, result),
        );
        expect(f.repository.createQuote).toHaveBeenCalledExactlyOnceWith(
          { ...op.input, marginBasisPoints },
          actor,
          ['TEAM'],
          anchors,
          correlationId,
        );
      },
    );
    it.each(['0', -100001, 10001, 0.5])(
      `${op.path} rejects marginBasisPoints %j without Number conversion before timestamp`,
      async (marginBasisPoints) => {
        const f = fixture();
        expect(
          await f.dispatch(op.path, { ...body, marginBasisPoints, validUntil: 'bad' }),
        ).toEqual(invalid('marginBasisPoints must be an integer between -100000 and 10000'));
        noCalls(f);
      },
    );
    it('retains empty lines/unknown line fields and signed margin for ' + op.path, async () => {
      const f = fixture();
      expect(await f.dispatch(op.path, { ...body, lines: [], margin: '-0.0000' })).toEqual(
        response(201, result),
      );
      expect(f.repository.createQuote).toHaveBeenCalledExactlyOnceWith(
        { ...op.input, lines: [], margin: '0' },
        actor,
        ['TEAM'],
        anchors,
        correlationId,
      );
      expect(
        await f.dispatch(op.path, { ...body, lines: [{ ...line, extra: 'ignored' }] }),
      ).toEqual(response(201, result));
      expect(f.repository.createQuote).toHaveBeenLastCalledWith(
        op.input,
        actor,
        ['TEAM'],
        anchors,
        correlationId,
      );
    });
    it('ignores invalid idempotency header but rejects body key for ' + op.path, async () => {
      const f = fixture();
      expect(await f.dispatch(op.path, body, { key: 'x'.repeat(129) })).toEqual(
        response(201, result),
      );
      expect(f.repository.createQuote).toHaveBeenCalledExactlyOnceWith(
        op.input,
        actor,
        ['TEAM'],
        anchors,
        correlationId,
      );
      expect(await f.dispatch(op.path, { ...body, idempotencyKey: 'body-key' })).toEqual(
        invalid('Unsupported fields: idempotencyKey'),
      );
      expect(f.repository.createQuote).toHaveBeenCalledOnce();
    });
  }
  it('revision remains full input and quoteId is parsed after lines before quoteNumber', async () => {
    const f = fixture();
    expect(await f.dispatch(`${createPath}/bad/revisions`, { ...body, quoteNumber: '' })).toEqual(
      invalid('quoteId must be a UUID'),
    );
    expect(await f.dispatch(revisionPath, { lines: [] })).toEqual(
      invalid('quoteNumber is required'),
    );
    noCalls(f);
  });
  it.each([
    [{ quoteNumber: '', opportunityId: 'bad' }, 'quoteNumber is required'],
    [{ opportunityId: 'bad', ctrVersionId: 'bad' }, 'opportunityId must be a UUID'],
    [{ ctrVersionId: 'bad', technicalSolutionRevisionId: 'bad' }, 'ctrVersionId must be a UUID'],
    [
      { technicalSolutionRevisionId: 'bad', costDecisionId: 'bad' },
      'technicalSolutionRevisionId must be a UUID',
    ],
    [{ costDecisionId: 'bad', policyVersionId: 'bad' }, 'costDecisionId must be a UUID'],
    [{ policyVersionId: 'bad', policyEvaluationId: 'bad' }, 'policyVersionId must be a UUID'],
    [{ policyEvaluationId: 'bad', currency: 'usd' }, 'policyEvaluationId must be a UUID'],
    [{ currency: 'usd', subtotal: '-1' }, 'Currency must be ISO 4217 uppercase'],
    [{ subtotal: '-1', discount: '-1' }, 'subtotal must be non-negative'],
    [{ discount: '-1', total: '-1' }, 'discount must be non-negative'],
    [{ total: '-1', costTotal: '-1' }, 'total must be non-negative'],
    [{ costTotal: '-1', margin: 'bad' }, 'costTotal must be non-negative'],
    [{ margin: 'bad', marginBasisPoints: -100001 }, 'Invalid decimal'],
    [{ validUntil: 'bad' }, 'validUntil must be a valid timestamp'],
    [{ validUntil: '' }, 'validUntil is required'],
  ])('preserves top-level first failure %j on both paths', async (changed, message) => {
    const f = fixture();
    for (const op of operations)
      expect(await f.dispatch(op.path, { ...body, ...changed })).toEqual(invalid(message));
    noCalls(f);
  });
  it('timestamp preserves broad Date parsing and ISO normalization without new format restriction', async () => {
    const f = fixture();
    expect(await f.dispatch(createPath, { ...body, validUntil: ' 2026-10-13 ' })).toEqual(
      response(201, result),
    );
    expect(f.repository.createQuote).toHaveBeenCalledExactlyOnceWith(
      { ...input, validUntil: '2026-10-13T00:00:00.000Z' },
      actor,
      ['TEAM'],
      anchors,
      correlationId,
    );
  });
  it.each(operations)(
    '$path absent repository skips all validators; session still first',
    async (op) => {
      const f = fixture([], false);
      expect(await f.dispatch(op.path.replace(id, 'bad'), null)).toEqual(missing);
      expect(await f.dispatch(op.path, null, { session: false })).toEqual(
        error(401, 'authentication_required', 'A valid session is required'),
      );
      expect(f.authenticate).toHaveBeenCalledOnce();
      noCalls(f);
    },
  );
  it.each(operations)('$path preserves unsupported methods/path boundaries', async (op) => {
    const f = fixture([]);
    for (const method of ['PATCH', 'DELETE', 'OPTIONS'])
      expect(await f.dispatch(op.path, null, { method })).toEqual(missing);
    for (const path of [`${op.path}/`, op.path.toUpperCase(), `${op.path}/unknown`])
      expect(await f.dispatch(path, null)).toEqual(missing);
    if (op.path === revisionPath)
      expect(await f.dispatch(op.path, null, { method: 'GET' })).toEqual(missing);
    noCalls(f);
  });
  it('GET quotes remains view read; approve/issue preserve UUID-before-body priority and CRM matcher', async () => {
    const f = fixture([['quote:read', grant]]);
    expect(await f.dispatch(createPath, null, { method: 'GET' })).toEqual(
      response(200, { items: [result] }),
    );
    expect(f.repository.listCommercialView).toHaveBeenCalledExactlyOnceWith(
      'quotes',
      actor,
      ['TEAM'],
      anchors,
    );
    for (const command of ['approve', 'issue']) {
      expect(await f.dispatch(`/api/v1/quote-revisions/bad/${command}`, null)).toEqual(
        invalid('quoteRevisionId must be a UUID'),
      );
      expect(await f.dispatch(`/api/v1/quote-revisions/${id}/${command}`, null)).toEqual(
        invalid('A JSON object body is required'),
      );
      expect(await f.dispatch(`/api/v1/quote-revisions/${id}/${command}`, {})).toEqual(denied);
    }
    expect(await f.dispatch('/api/v1/customers', null, { method: 'GET' })).toEqual(
      error(503, 'internal_error', 'CRM dependency unavailable'),
    );
    expect(f.repository.createQuote).not.toHaveBeenCalled();
  });
  it.each(operations)('$path preserves repository/global envelopes and correlation', async (op) => {
    const f = fixture();
    for (const [code, status] of [
      ['forbidden', 403],
      ['not_found', 404],
      ['conflict', 409],
      ['invalid_request', 400],
    ] as const) {
      f.repository.createQuote.mockRejectedValueOnce(new DomainError(code, 'fixed failure'));
      expect(await f.dispatch(op.path)).toEqual(error(status, code, 'fixed failure'));
    }
    f.repository.createQuote.mockRejectedValueOnce(new Error('private fixture failure'));
    expect(await f.dispatch(op.path)).toEqual(
      error(500, 'internal_error', 'Internal server error'),
    );
  });
});
