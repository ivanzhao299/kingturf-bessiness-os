// Fixed inline expectations on 8b264d0, before evaluation route extraction.
import { describe, expect, it, vi } from 'vitest';
import { DomainError, type AuthorizationContext } from '@kingturf/domain';
import type { PermissionKey } from '@kingturf/types';
import { buildApp, type ApiDependencies } from '../src/app.js';

const id = '11111111-1111-4111-8111-111111111111';
const otherId = '22222222-2222-4222-8222-222222222222';
const correlationId = '33333333-3333-4333-8333-333333333333';
const actor = { companyId: 'tenant', employeeId: 'actor' };
const anchors = [{ scope: 'TEAM', organizationId: id }] as const;
type Grant = NonNullable<ReturnType<AuthorizationContext['permissions']['get']>>;
const grant: Grant = { scopes: ['TEAM'], fields: null };
const key = ' raw key!? ';
const result = { id, version: 2, total: '5', private: 'raw' };
const costPath = '/api/v1/cost-evaluations',
  policyPath = '/api/v1/sales-policy-evaluations';
const line = {
  key: ' line!? ',
  description: ' description ',
  quantity: ' 2.5000 ',
  unit: ' m2!? ',
  unitCost: ' -0.0000 ',
  currency: ' USD ',
  ignored: 'unknown line field',
};
const parsedLine = {
  key: 'line!?',
  description: 'description',
  quantity: { value: '2.5', unit: 'm2!?' },
  unitCost: { amount: '0', currency: 'USD' },
};
const costBody = {
  modelVersionId: id,
  technicalSolutionRevisionId: otherId,
  currency: ' USD ',
  lines: [line],
  context: { fixed: true },
};
const costInput = {
  modelVersionId: id,
  technicalSolutionRevisionId: otherId,
  currency: 'USD',
  lines: [parsedLine],
  context: { fixed: true },
  idempotencyKey: key,
};
const policyBody = { policyVersionId: id, costDecisionId: otherId, context: { fixed: true } };
const policyInput = { ...policyBody, idempotencyKey: key };
const methods = ['evaluateCost', 'evaluatePolicy'] as const;
type Operation = {
  path: string;
  method: (typeof methods)[number];
  capability: PermissionKey;
  read: PermissionKey;
  view: string;
  body: Record<string, unknown>;
  input: Record<string, unknown>;
};
const operations: readonly Operation[] = [
  {
    path: costPath,
    method: 'evaluateCost',
    capability: 'cost:evaluate',
    read: 'cost:read',
    view: 'costs',
    body: costBody,
    input: costInput,
  },
  {
    path: policyPath,
    method: 'evaluatePolicy',
    capability: 'sales-policy:evaluate',
    read: 'sales-policy:read',
    view: 'policies',
    body: policyBody,
    input: policyInput,
  },
];
function fixture(
  permissions: readonly (readonly [PermissionKey, Grant])[] = [
    ['cost:evaluate', grant],
    ['cost:read', grant],
    ['sales-policy:evaluate', grant],
    ['sales-policy:read', grant],
  ],
  available = true,
) {
  const context: AuthorizationContext = {
    actor,
    permissions: new Map(permissions),
    scopeAnchors: new Map(permissions.map(([capability]) => [capability, anchors])),
  };
  const repository = {
    evaluateCost: vi.fn().mockResolvedValue(result),
    evaluatePolicy: vi.fn().mockResolvedValue(result),
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
    body: unknown,
    options: { method?: string; key?: string | undefined; session?: boolean } = {},
  ) =>
    app.dispatch({
      method: options.method ?? 'POST',
      pathname: path,
      body,
      query: { idempotencyKey: 'query-key', context: '{}' },
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

describe('inline commercial evaluation contracts', () => {
  it.each(operations)(
    '$path preserves exact input/receiver/scopes/anchors/correlation/201 and ignores query',
    async (op) => {
      const f = fixture();
      expect(await f.dispatch(op.path, op.body)).toEqual(response(201, result));
      expect(f.repository[op.method]).toHaveBeenCalledExactlyOnceWith(
        op.input,
        actor,
        ['TEAM'],
        anchors,
        correlationId,
      );
      expect(f.repository[op.method].mock.contexts).toEqual([f.repository]);
      for (const method of methods)
        if (method !== op.method) expect(f.repository[method]).not.toHaveBeenCalled();
      expect(f.repository.listCommercialView).not.toHaveBeenCalled();
    },
  );
  it.each(operations)(
    '$path body/allow precede permission and field/scopes precede all values',
    async (op) => {
      const f = fixture([]);
      expect(await f.dispatch(op.path, null)).toEqual(invalid('A JSON object body is required'));
      expect(await f.dispatch(op.path, { ...op.body, unexpected: true })).toEqual(
        invalid('Unsupported fields: unexpected'),
      );
      expect(await f.dispatch(op.path, {})).toEqual(denied);
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
  it.each(operations)(
    '$path uses only its independent read grant for mutation projection',
    async (op) => {
      for (const [read, dto] of [
        [undefined, { id, version: 2 }],
        [{ scopes: ['SELF'], fields: [] }, { id }],
        [
          { scopes: ['SELF'], fields: ['total'] },
          { id, total: '5' },
        ],
        [grant, result],
      ] as const) {
        const f = fixture([[op.capability, grant], ...(read ? [[op.read, read] as const] : [])]);
        expect(await f.dispatch(op.path, op.body)).toEqual(response(201, dto));
      }
      const otherRead = op.read === 'cost:read' ? 'sales-policy:read' : 'cost:read';
      const f = fixture([
        [op.capability, grant],
        [otherRead, grant],
      ]);
      expect(await f.dispatch(op.path, op.body)).toEqual(response(201, { id, version: 2 }));
    },
  );
  it.each([
    [{ ...costBody, modelVersionId: 'bad', lines: null }, 'lines must be an array'],
    [{ ...costBody, modelVersionId: 'bad', lines: [null] }, 'lines[0] must be a JSON object'],
    [{ ...costBody, modelVersionId: 'bad', lines: [line, null] }, 'lines[1] must be a JSON object'],
    [
      { ...costBody, modelVersionId: 'bad', lines: [line, { ...line, key: '' }] },
      'key is required',
    ],
    [
      { ...costBody, modelVersionId: 'bad', technicalSolutionRevisionId: 'bad' },
      'modelVersionId must be a UUID',
    ],
    [
      { ...costBody, technicalSolutionRevisionId: 'bad', currency: 'bad' },
      'technicalSolutionRevisionId must be a UUID',
    ],
    [{ ...costBody, currency: 'usd', context: null }, 'Currency must be ISO 4217 uppercase'],
    [{ ...costBody, context: null }, 'context must be a JSON object'],
  ])('cost parses all lines before top-level values/header %j', async (body, message) => {
    const f = fixture();
    expect(await f.dispatch(costPath, body, { key: undefined })).toEqual(invalid(message));
    noCalls(f);
  });
  it.each([
    [{ key: '', description: '', quantity: '-1' }, 'key is required'],
    [{ description: '', quantity: '-1' }, 'description is required'],
    [{ quantity: '-1', unit: '', unitCost: '-1' }, 'quantity must be non-negative'],
    [{ quantity: '01', unit: '' }, 'Invalid decimal'],
    [{ quantity: 1 }, 'quantity is required'],
    [{ unit: '', unitCost: '-1' }, 'unit is required'],
    [{ unitCost: '-1', currency: 'bad' }, 'unitCost must be non-negative'],
    [{ unitCost: '01' }, 'Invalid decimal'],
    [{ currency: 'usd' }, 'Currency must be ISO 4217 uppercase'],
  ])('cost line retains nested field priority before bad top UUID %j', async (changed, message) => {
    const f = fixture();
    expect(
      await f.dispatch(
        costPath,
        { ...costBody, modelVersionId: 'bad', lines: [{ ...line, ...changed }] },
        { key: undefined },
      ),
    ).toEqual(invalid(message));
    noCalls(f);
  });
  it('cost accepts empty lines and arbitrary unknown line fields without deeper whitelist', async () => {
    const f = fixture();
    expect(await f.dispatch(costPath, { ...costBody, lines: [] })).toEqual(response(201, result));
    expect(f.repository.evaluateCost).toHaveBeenCalledExactlyOnceWith(
      { ...costInput, lines: [] },
      actor,
      ['TEAM'],
      anchors,
      correlationId,
    );
    expect(
      await f.dispatch(costPath, {
        ...costBody,
        lines: [
          { ...line, unrelated: { nested: true } },
          { ...line, key: ' second ', quantity: '0.0000', unitCost: '3.2000' },
        ],
      }),
    ).toEqual(response(201, result));
    expect(f.repository.evaluateCost).toHaveBeenLastCalledWith(
      {
        ...costInput,
        lines: [
          parsedLine,
          {
            ...parsedLine,
            key: 'second',
            quantity: { value: '0', unit: 'm2!?' },
            unitCost: { amount: '3.2', currency: 'USD' },
          },
        ],
      },
      actor,
      ['TEAM'],
      anchors,
      correlationId,
    );
  });
  it.each([
    [
      { ...policyBody, policyVersionId: 'bad', costDecisionId: 'bad', context: null },
      'policyVersionId must be a UUID',
    ],
    [{ ...policyBody, costDecisionId: 'bad', context: null }, 'costDecisionId must be a UUID'],
    [{ ...policyBody, context: null }, 'context must be a JSON object'],
  ])('policy retains UUID/context/header order %j', async (body, message) => {
    const f = fixture();
    expect(await f.dispatch(policyPath, body, { key: undefined })).toEqual(invalid(message));
    noCalls(f);
  });
  it.each(operations)(
    '$path does not default context and rejects every nonobject shape before key',
    async (op) => {
      const f = fixture();
      for (const context of [undefined, null, [], 'object'])
        expect(await f.dispatch(op.path, { ...op.body, context }, { key: undefined })).toEqual(
          invalid('context must be a JSON object'),
        );
      noCalls(f);
      expect(await f.dispatch(op.path, { ...op.body, context: {} })).toEqual(response(201, result));
      expect(f.repository[op.method]).toHaveBeenCalledExactlyOnceWith(
        { ...op.input, context: {} },
        actor,
        ['TEAM'],
        anchors,
        correlationId,
      );
    },
  );
  for (const op of operations) {
    it.each([undefined, '', 'x'.repeat(129)])(
      `${op.path} rejects header %j only after values`,
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
          { ...op.input, idempotencyKey: headerKey },
          actor,
          ['TEAM'],
          anchors,
          correlationId,
        );
      },
    );
  }
  it.each(operations)('$path rejects body idempotency key before permission', async (op) => {
    const f = fixture([]);
    expect(
      await f.dispatch(op.path, { ...op.body, idempotencyKey: 'body-key' }, { key: undefined }),
    ).toEqual(invalid('Unsupported fields: idempotencyKey'));
    noCalls(f);
  });
  it.each(operations)(
    '$path absent repo skips all validators while session remains first',
    async (op) => {
      const f = fixture([], false);
      expect(await f.dispatch(op.path, null, { key: undefined })).toEqual(missing);
      expect(await f.dispatch(op.path, {}, { key: undefined })).toEqual(missing);
      expect(await f.dispatch(op.path, null, { session: false })).toEqual(
        error(401, 'authentication_required', 'A valid session is required'),
      );
      expect(f.authenticate).toHaveBeenCalledTimes(2);
      noCalls(f);
    },
  );
  it.each(operations)(
    '$path same-path GET still reads corresponding view without write validation',
    async (op) => {
      const f = fixture([[op.read, grant]]);
      expect(await f.dispatch(op.path, null, { method: 'GET', key: undefined })).toEqual(
        response(200, { items: [result] }),
      );
      expect(f.repository.listCommercialView).toHaveBeenCalledExactlyOnceWith(
        op.view,
        actor,
        ['TEAM'],
        anchors,
      );
      for (const method of methods) expect(f.repository[method]).not.toHaveBeenCalled();
    },
  );
  it.each(operations)('$path wrong method/path boundaries preserve fallthrough', async (op) => {
    const f = fixture([]);
    for (const method of ['PATCH', 'DELETE', 'OPTIONS'])
      expect(await f.dispatch(op.path, null, { method })).toEqual(missing);
    for (const path of [`${op.path}/`, op.path.toUpperCase(), `${op.path}/unknown`])
      expect(await f.dispatch(path, null)).toEqual(missing);
    noCalls(f);
  });
  it('definitions/calculation/quote paths keep their own validators', async () => {
    const f = fixture([]);
    expect(await f.dispatch('/api/v1/cost-models', null, { method: 'GET' })).toEqual(denied);
    for (const path of [
      `/api/v1/cost-matrices/${id}/calculate`,
      `/api/v1/cost-matrix-calculations/${id}/quote-cost-decision`,
      '/api/v1/quotes',
      `/api/v1/quotes/${id}/revisions`,
    ])
      expect(await f.dispatch(path, null)).toEqual(invalid('A JSON object body is required'));
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
