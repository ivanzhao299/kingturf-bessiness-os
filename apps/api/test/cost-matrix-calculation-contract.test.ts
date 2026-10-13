// Fixed inline expectations on 5172cef, before extraction of calculation/conversion.
import { describe, expect, it, vi } from 'vitest';
import { DomainError, type AuthorizationContext } from '@kingturf/domain';
import type { PermissionKey } from '@kingturf/types';
import { buildApp, type ApiDependencies } from '../src/app.js';

const id = '11111111-1111-4111-8111-111111111111';
const modelVersionId = '22222222-2222-4222-8222-222222222222';
const correlationId = '33333333-3333-4333-8333-333333333333';
const actor = { companyId: 'tenant', employeeId: 'actor' };
const anchors = [{ scope: 'TEAM', organizationId: id }] as const;
type Grant = NonNullable<ReturnType<AuthorizationContext['permissions']['get']>>;
const grant: Grant = { scopes: ['TEAM'], fields: null };
const key = ' raw key!? ';
const result = { id, version: 2, totalCost: '10', private: 'raw' };
const calculatePath = `/api/v1/cost-matrices/${id}/calculate`;
const quotePath = `/api/v1/cost-matrix-calculations/${id}/quote-cost-decision`;
const quoteBody = { technicalSolutionRevisionId: id, modelVersionId };
const methods = ['calculateCostMatrix', 'createQuoteCostDecisionFromMatrix'] as const;
type Operation = {
  path: string;
  method: (typeof methods)[number];
  capability: PermissionKey;
  body: Record<string, unknown>;
  args: readonly unknown[];
};
const operations: readonly Operation[] = [
  {
    path: calculatePath,
    method: 'calculateCostMatrix',
    capability: 'cost-matrix:calculate',
    body: { pricingMode: ' TAX_INCLUSIVE ' },
    args: [id, 'TAX_INCLUSIVE', key, actor, ['TEAM'], correlationId],
  },
  {
    path: quotePath,
    method: 'createQuoteCostDecisionFromMatrix',
    capability: 'cost:evaluate',
    body: quoteBody,
    args: [id, { ...quoteBody, idempotencyKey: key }, actor, ['TEAM'], anchors, correlationId],
  },
];
function fixture(
  permissions: readonly (readonly [PermissionKey, Grant])[] = [
    ['cost-matrix:calculate', grant],
    ['cost:evaluate', grant],
    ['cost:read', grant],
  ],
  available = true,
) {
  const context: AuthorizationContext = {
    actor,
    permissions: new Map(permissions),
    scopeAnchors: new Map(permissions.map(([capability]) => [capability, anchors])),
  };
  const repository = {
    calculateCostMatrix: vi.fn().mockResolvedValue(result),
    createQuoteCostDecisionFromMatrix: vi.fn().mockResolvedValue(result),
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
    options: { method?: string; key?: string | undefined; session?: boolean } = {},
  ) =>
    app.dispatch({
      method: options.method ?? 'POST',
      pathname: path,
      body,
      query: { pricingMode: 'BAD', idempotencyKey: 'query-key' },
      headers: {
        authorization: options.session === false ? '' : 'Bearer fixture',
        'x-correlation-id': correlationId,
        'idempotency-key': Object.hasOwn(options, 'key') ? options.key : key,
      },
    });
  return { repository, authenticate, dispatch };
}
const response = (statusCode: number, body: unknown) => ({
  statusCode,
  body,
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

describe('inline matrix calculation and quote cost contracts', () => {
  it.each(operations)(
    '$path preserves args/anchors distinction/receiver/status/correlation and ignores query',
    async (op) => {
      const f = fixture();
      expect(await f.dispatch(op.path, op.body)).toEqual(response(201, result));
      expect(f.repository[op.method]).toHaveBeenCalledExactlyOnceWith(...op.args);
      expect(f.repository[op.method].mock.contexts).toEqual([f.repository]);
      for (const method of methods)
        if (method !== op.method) expect(f.repository[method]).not.toHaveBeenCalled();
    },
  );
  it.each(operations)(
    '$path body/allow precede permission, then fields/scopes precede values/header',
    async (op) => {
      const f = fixture([]);
      expect(await f.dispatch(op.path, null, { key: undefined })).toEqual(
        invalid('A JSON object body is required'),
      );
      expect(await f.dispatch(op.path, { ...op.body, unexpected: true })).toEqual(
        invalid('Unsupported fields: unexpected'),
      );
      expect(await f.dispatch(op.path.replace(id, 'bad'), {}, { key: undefined })).toEqual(denied);
      noCalls(f);
      const emptyScopes = fixture([[op.capability, { scopes: [], fields: null }]]);
      expect(await emptyScopes.dispatch(op.path, op.body)).toEqual(denied);
      noCalls(emptyScopes);
      const emptyFields = fixture([[op.capability, { scopes: ['TEAM'], fields: [] }]]);
      expect(await emptyFields.dispatch(op.path, op.body)).toEqual(fieldDenied);
      noCalls(emptyFields);
      const finite = fixture([[op.capability, { scopes: ['TEAM'], fields: Object.keys(op.body) }]]);
      expect((await finite.dispatch(op.path, op.body)).statusCode).toBe(201);
    },
  );
  it('calculate remains raw regardless of cost read grant, quote applies independent read projection', async () => {
    for (const [read, dto] of [
      [undefined, { id, version: 2 }],
      [{ scopes: ['SELF'], fields: [] }, { id }],
      [
        { scopes: ['SELF'], fields: ['totalCost'] },
        { id, totalCost: '10' },
      ],
      [grant, result],
    ] as const) {
      const f = fixture([
        ['cost-matrix:calculate', grant],
        ['cost:evaluate', grant],
        ...(read ? [['cost:read', read] as const] : []),
      ]);
      expect(await f.dispatch(calculatePath, { pricingMode: 'TAX_INCLUSIVE' })).toEqual(
        response(201, result),
      );
      expect(await f.dispatch(quotePath, quoteBody)).toEqual(response(201, dto));
    }
  });
  it.each(['TAX_INCLUSIVE', 'TAX_EXCLUSIVE'])(
    'calculate trims supported pricing mode %s',
    async (pricingMode) => {
      const f = fixture();
      expect(await f.dispatch(calculatePath, { pricingMode: ` ${pricingMode} ` })).toEqual(
        response(201, result),
      );
      expect(f.repository.calculateCostMatrix).toHaveBeenCalledExactlyOnceWith(
        id,
        pricingMode,
        key,
        actor,
        ['TEAM'],
        correlationId,
      );
    },
  );
  it.each([
    [calculatePath.replace(id, 'bad'), { pricingMode: '' }, 'pricingMode is required'],
    [
      calculatePath.replace(id, 'bad'),
      { pricingMode: 'BAD' },
      'pricingMode must be TAX_INCLUSIVE or TAX_EXCLUSIVE',
    ],
    [calculatePath.replace(id, 'bad'), { pricingMode: 'TAX_INCLUSIVE' }, 'modelId must be a UUID'],
    [
      quotePath.replace(id, 'bad'),
      { technicalSolutionRevisionId: 'bad', modelVersionId: 'bad' },
      'calculationId must be a UUID',
    ],
    [
      quotePath,
      { technicalSolutionRevisionId: 'bad', modelVersionId: 'bad' },
      'technicalSolutionRevisionId must be a UUID',
    ],
    [
      quotePath,
      { technicalSolutionRevisionId: id, modelVersionId: 'bad' },
      'modelVersionId must be a UUID',
    ],
  ])(
    '%s preserves first input failure before absent header for %j',
    async (path, body, message) => {
      const f = fixture();
      expect(await f.dispatch(path, body, { key: undefined })).toEqual(invalid(message));
      noCalls(f);
    },
  );
  for (const op of operations) {
    it.each([undefined, '', 'x'.repeat(129)])(
      `${op.path} rejects header %j after inputs`,
      async (headerKey) => {
        const f = fixture();
        expect(await f.dispatch(op.path, op.body, { key: headerKey })).toEqual(
          invalid('Idempotency-Key is required'),
        );
        noCalls(f);
      },
    );
    it.each(['x', 'x'.repeat(128), ' ', '!?', ' raw key '])(
      `${op.path} retains header %j untrimmed`,
      async (headerKey) => {
        const f = fixture();
        expect(await f.dispatch(op.path, op.body, { key: headerKey })).toEqual(
          response(201, result),
        );
        expect(f.repository[op.method]).toHaveBeenCalledExactlyOnceWith(
          ...(op.method === 'calculateCostMatrix'
            ? [id, 'TAX_INCLUSIVE', headerKey, actor, ['TEAM'], correlationId]
            : [
                id,
                { ...quoteBody, idempotencyKey: headerKey },
                actor,
                ['TEAM'],
                anchors,
                correlationId,
              ]),
        );
      },
    );
  }
  it.each(operations)(
    '$path rejects body key instead of accepting it as a header substitute',
    async (op) => {
      const f = fixture([]);
      expect(
        await f.dispatch(op.path, { ...op.body, idempotencyKey: 'body-key' }, { key: undefined }),
      ).toEqual(invalid('Unsupported fields: idempotencyKey'));
      noCalls(f);
    },
  );
  it.each(operations)(
    '$path absent repository skips body/auth/input/header, session still first',
    async (op) => {
      const f = fixture([], false);
      expect(await f.dispatch(op.path, null, { key: undefined })).toEqual(missing);
      expect(await f.dispatch(op.path.replace(id, 'bad'), {}, { key: undefined })).toEqual(missing);
      expect(await f.dispatch(op.path, null, { session: false })).toEqual(
        error(401, 'authentication_required', 'A valid session is required'),
      );
      expect(f.authenticate).toHaveBeenCalledTimes(2);
      noCalls(f);
    },
  );
  it.each(operations)(
    '$path unsupported methods and unmatched paths preserve fallthrough',
    async (op) => {
      const f = fixture([]);
      for (const method of ['GET', 'PATCH', 'DELETE', 'OPTIONS'])
        expect(await f.dispatch(op.path, null, { method })).toEqual(missing);
      for (const path of [`${op.path}/`, op.path.toUpperCase(), `${op.path}/unknown`])
        expect(await f.dispatch(path, null)).toEqual(missing);
      noCalls(f);
    },
  );
  it('base/factor/definition entry points are not swallowed', async () => {
    const f = fixture([]);
    expect(await f.dispatch(`/api/v1/cost-matrices/${id}`, null, { method: 'GET' })).toEqual(
      denied,
    );
    expect(await f.dispatch(`/api/v1/cost-matrices/${id}/factors`, null)).toEqual(
      invalid('A JSON object body is required'),
    );
    expect(
      await f.dispatch(`/api/v1/cost-matrices/${id}/factors/${modelVersionId}`, null, {
        method: 'PATCH',
      }),
    ).toEqual(invalid('A JSON object body is required'));
    expect(await f.dispatch('/api/v1/cost-models', null, { method: 'GET' })).toEqual(denied);
    noCalls(f);
  });
  it.each(operations)('$path preserves repository/global envelopes and correlation', async (op) => {
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
  });
});
