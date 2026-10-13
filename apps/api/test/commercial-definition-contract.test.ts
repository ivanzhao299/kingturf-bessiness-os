// Fixed inline expectations on bf399c1, before definition route extraction.
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
const result = { id, version: 2, rules: ['raw'], private: 'uncropped' };
const rules = [null, 5, { arbitrary: true }, 'text'];
const policyBody = { code: ' DEF!? ', name: ' Definition ', rules, publish: true };
const costBody = { ...policyBody, currency: ' USD ' };
const policyVersionBody = { rules, publish: true };
const costVersionBody = { currency: ' USD ', ...policyVersionBody };
const methods = ['listDefinitions', 'createDefinition', 'createDefinitionVersion'] as const;
type Operation = {
  path: string;
  verb: string;
  kind: 'cost' | 'policy';
  method: (typeof methods)[number];
  capability: PermissionKey;
  body: Record<string, unknown> | null;
  input?: Record<string, unknown>;
  args: readonly unknown[];
  status: number;
  output: unknown;
};
const operations: readonly Operation[] = [
  {
    path: '/api/v1/cost-models',
    verb: 'GET',
    kind: 'cost',
    method: 'listDefinitions',
    capability: 'cost-model:read',
    body: null,
    args: ['cost', actor, ['TEAM']],
    status: 200,
    output: { items: [result] },
  },
  {
    path: '/api/v1/sales-policies',
    verb: 'GET',
    kind: 'policy',
    method: 'listDefinitions',
    capability: 'sales-policy:read',
    body: null,
    args: ['policy', actor, ['TEAM']],
    status: 200,
    output: { items: [result] },
  },
  {
    path: '/api/v1/cost-models',
    verb: 'POST',
    kind: 'cost',
    method: 'createDefinition',
    capability: 'cost-model:manage',
    body: costBody,
    input: { code: 'DEF!?', name: 'Definition', currency: 'USD', rules, publish: true },
    args: [
      'cost',
      { code: 'DEF!?', name: 'Definition', currency: 'USD', rules, publish: true },
      actor,
      ['TEAM'],
      correlationId,
    ],
    status: 201,
    output: result,
  },
  {
    path: '/api/v1/sales-policies',
    verb: 'POST',
    kind: 'policy',
    method: 'createDefinition',
    capability: 'sales-policy:manage',
    body: policyBody,
    input: { code: 'DEF!?', name: 'Definition', rules, publish: true },
    args: [
      'policy',
      { code: 'DEF!?', name: 'Definition', rules, publish: true },
      actor,
      ['TEAM'],
      correlationId,
    ],
    status: 201,
    output: result,
  },
  {
    path: `/api/v1/cost-models/${id}/versions`,
    verb: 'POST',
    kind: 'cost',
    method: 'createDefinitionVersion',
    capability: 'cost-model:manage',
    body: costVersionBody,
    input: { currency: 'USD', rules, publish: true },
    args: ['cost', id, { currency: 'USD', rules, publish: true }, actor, ['TEAM'], correlationId],
    status: 201,
    output: result,
  },
  {
    path: `/api/v1/sales-policies/${id}/versions`,
    verb: 'POST',
    kind: 'policy',
    method: 'createDefinitionVersion',
    capability: 'sales-policy:manage',
    body: policyVersionBody,
    input: { rules, publish: true },
    args: ['policy', id, { rules, publish: true }, actor, ['TEAM'], correlationId],
    status: 201,
    output: result,
  },
];
const writes = operations.filter((op) => op.verb === 'POST');
const reads = operations.filter((op) => op.verb === 'GET');
function fixture(
  permissions: readonly (readonly [PermissionKey, Grant])[] = [
    ['cost-model:read', grant],
    ['sales-policy:read', grant],
    ['cost-model:manage', grant],
    ['sales-policy:manage', grant],
  ],
  available = true,
) {
  const context: AuthorizationContext = {
    actor,
    permissions: new Map(permissions),
    scopeAnchors: new Map(permissions.map(([capability]) => [capability, anchors])),
  };
  const repository = {
    listDefinitions: vi.fn().mockResolvedValue([result]),
    createDefinition: vi.fn().mockResolvedValue(result),
    createDefinitionVersion: vi.fn().mockResolvedValue(result),
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
    op: Operation,
    body: unknown = op.body,
    options: { path?: string; method?: string; session?: boolean; key?: string } = {},
  ) =>
    app.dispatch({
      method: options.method ?? op.verb,
      pathname: options.path ?? op.path,
      body,
      query: { rules: 'bad', publish: 'true', currency: 'bad' },
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
const writeArgs = (op: Operation, input: Record<string, unknown>) =>
  op.method === 'createDefinitionVersion'
    ? [op.kind, id, input, actor, ['TEAM'], correlationId]
    : [op.kind, input, actor, ['TEAM'], correlationId];

describe('inline commercial definition contracts', () => {
  it.each(operations)(
    '$verb $path preserves kind/capability mapping, exact receiver/args and raw response',
    async (op) => {
      const f = fixture([[op.capability, grant]]);
      expect(await f.dispatch(op)).toEqual(response(op.status, op.output));
      expect(f.repository[op.method]).toHaveBeenCalledExactlyOnceWith(...op.args);
      expect(f.repository[op.method].mock.contexts).toEqual([f.repository]);
      for (const method of methods)
        if (method !== op.method) expect(f.repository[method]).not.toHaveBeenCalled();
    },
  );
  it.each(operations)(
    '$verb $path denies missing or empty scopes; read fields do not crop raw data',
    async (op) => {
      for (const permissions of [[], [[op.capability, { scopes: [], fields: null }]]] as const) {
        const f = fixture(permissions);
        expect(await f.dispatch(op)).toEqual(denied);
        noCalls(f);
      }
      const f = fixture([[op.capability, { scopes: ['TEAM'], fields: [] }]]);
      expect(await f.dispatch(op)).toEqual(
        op.verb === 'GET' ? response(op.status, op.output) : fieldDenied,
      );
      if (op.verb === 'POST') noCalls(f);
    },
  );
  it.each(reads)(
    '$path ignores malformed GET body/query/header and retains empty items',
    async (op) => {
      const f = fixture([[op.capability, { scopes: ['TEAM'], fields: ['id'] }]]);
      expect(await f.dispatch(op, 'not an object', { key: 'x'.repeat(129) })).toEqual(
        response(200, { items: [result] }),
      );
      expect(f.repository.listDefinitions).toHaveBeenCalledExactlyOnceWith(...op.args);
      f.repository.listDefinitions.mockResolvedValueOnce([]);
      expect(await f.dispatch(op, [])).toEqual(response(200, { items: [] }));
    },
  );
  it.each(writes)(
    '$path body/allow precede permission and fields precede all values',
    async (op) => {
      const f = fixture([]);
      expect(await f.dispatch(op, null)).toEqual(invalid('A JSON object body is required'));
      expect(await f.dispatch(op, { ...op.body, unexpected: true })).toEqual(
        invalid('Unsupported fields: unexpected'),
      );
      expect(await f.dispatch(op, {}, { path: op.path.replace(id, 'bad') })).toEqual(denied);
      noCalls(f);
      const finite = fixture([
        [op.capability, { scopes: ['TEAM'], fields: Object.keys(op.body ?? {}) }],
      ]);
      expect(await finite.dispatch(op)).toEqual(response(201, result));
      const noPublish = fixture([
        [
          op.capability,
          {
            scopes: ['TEAM'],
            fields: Object.keys(op.body ?? {}).filter((field) => field !== 'publish'),
          },
        ],
      ]);
      expect(await noPublish.dispatch(op, { ...op.body, publish: undefined })).toEqual(fieldDenied);
      const withoutPublish = { ...op.body };
      delete withoutPublish.publish;
      expect(await noPublish.dispatch(op, withoutPublish)).toEqual(response(201, result));
      expect(noPublish.repository[op.method]).toHaveBeenCalledOnce();
    },
  );
  for (const op of writes) {
    it.each([true, false, undefined, null, 1, 'true'])(
      `${op.path} retains strict publish %j`,
      async (publish) => {
        const f = fixture();
        expect(await f.dispatch(op, { ...op.body, publish })).toEqual(response(201, result));
        expect(f.repository[op.method]).toHaveBeenCalledExactlyOnceWith(
          ...writeArgs(op, { ...op.input, publish: publish === true }),
        );
      },
    );
    it('rules is only an array boundary and header is ignored for ' + op.path, async () => {
      const f = fixture();
      expect(await f.dispatch(op, { ...op.body, rules: [] }, { key: 'x'.repeat(129) })).toEqual(
        response(201, result),
      );
      expect(f.repository[op.method]).toHaveBeenCalledExactlyOnceWith(
        ...writeArgs(op, { ...op.input, rules: [] }),
      );
      for (const rules of [undefined, null, {}, 'array'])
        expect(await f.dispatch(op, { ...op.body, rules })).toEqual(
          invalid('rules must be an array'),
        );
      expect(f.repository[op.method]).toHaveBeenCalledOnce();
    });
    it('body idempotency key is rejected for ' + op.path, async () => {
      const f = fixture([]);
      expect(await f.dispatch(op, { ...op.body, idempotencyKey: 'body' })).toEqual(
        invalid('Unsupported fields: idempotencyKey'),
      );
      noCalls(f);
    });
  }
  it.each(writes.filter((op) => op.kind === 'policy'))(
    '$path rejects currency even before permissions',
    async (op) => {
      const f = fixture([]);
      expect(await f.dispatch(op, { ...op.body, currency: 'USD' })).toEqual(
        invalid('Unsupported fields: currency'),
      );
      noCalls(f);
    },
  );
  it.each(writes.filter((op) => op.method === 'createDefinitionVersion'))(
    '$path rejects version code/name; path UUID precedes currency/rules',
    async (op) => {
      const f = fixture([]);
      expect(await f.dispatch(op, { ...op.body, code: 'NEW', name: 'NEW' })).toEqual(
        invalid('Unsupported fields: code, name'),
      );
      noCalls(f);
      const allowed = fixture();
      expect(
        await allowed.dispatch(
          op,
          op.kind === 'cost' ? { currency: '', rules: null } : { rules: null },
          { path: op.path.replace(id, 'bad') },
        ),
      ).toEqual(invalid('definitionId must be a UUID'));
      noCalls(allowed);
    },
  );
  it.each([
    [
      '/api/v1/cost-models',
      { ...costBody, code: '', name: '', currency: '', rules: null },
      'code is required',
    ],
    [
      '/api/v1/sales-policies',
      { ...policyBody, code: '', name: '', rules: null },
      'code is required',
    ],
    [
      '/api/v1/cost-models',
      { ...costBody, name: '', currency: '', rules: null },
      'name is required',
    ],
    ['/api/v1/sales-policies', { ...policyBody, name: '', rules: null }, 'name is required'],
    [
      '/api/v1/cost-models',
      { ...costBody, currency: 'usd', rules: null },
      'Currency must be ISO 4217 uppercase',
    ],
    [
      `/api/v1/cost-models/${id}/versions`,
      { ...costVersionBody, currency: 'usd', rules: null },
      'Currency must be ISO 4217 uppercase',
    ],
  ])('%s preserves value error order for %j', async (path, body, message) => {
    const op = operations[2];
    if (!op) throw new Error('fixture absent');
    const f = fixture();
    expect(await f.dispatch(op, body, { path })).toEqual(invalid(message));
    noCalls(f);
  });
  it.each(operations)(
    '$verb $path absent repo skips body/permissions/UUID, session stays first',
    async (op) => {
      const f = fixture([], false);
      expect(await f.dispatch(op, null, { path: op.path.replace(id, 'bad') })).toEqual(missing);
      expect(await f.dispatch(op, null, { session: false })).toEqual(
        error(401, 'authentication_required', 'A valid session is required'),
      );
      expect(f.authenticate).toHaveBeenCalledOnce();
      noCalls(f);
    },
  );
  it.each(operations)('$verb $path preserves wrong method/path boundaries', async (op) => {
    const f = fixture([]);
    for (const method of ['PATCH', 'DELETE', 'OPTIONS'])
      expect(await f.dispatch(op, null, { method })).toEqual(missing);
    for (const path of [`${op.path}/`, op.path.toUpperCase(), `${op.path}/unknown`])
      expect(await f.dispatch(op, null, { path })).toEqual(missing);
    if (op.method === 'createDefinitionVersion')
      expect(await f.dispatch(op, null, { method: 'GET' })).toEqual(missing);
    noCalls(f);
  });
  it('calculation and evaluation entry paths retain separate validators', async () => {
    const op = operations[2];
    if (!op) throw new Error('fixture absent');
    const f = fixture([]);
    for (const path of [
      `/api/v1/cost-matrices/${id}/calculate`,
      `/api/v1/cost-matrix-calculations/${id}/quote-cost-decision`,
      '/api/v1/cost-evaluations',
      '/api/v1/sales-policy-evaluations',
    ])
      expect(await f.dispatch(op, null, { path })).toEqual(
        invalid('A JSON object body is required'),
      );
    noCalls(f);
  });
  it.each(operations)('$verb $path keeps domain/internal envelopes and correlation', async (op) => {
    const f = fixture();
    for (const [code, status] of [
      ['forbidden', 403],
      ['not_found', 404],
      ['conflict', 409],
      ['invalid_request', 400],
    ] as const) {
      f.repository[op.method].mockRejectedValueOnce(new DomainError(code, 'fixed failure'));
      expect(await f.dispatch(op)).toEqual(error(status, code, 'fixed failure'));
    }
    f.repository[op.method].mockRejectedValueOnce(new Error('private fixture failure'));
    expect(await f.dispatch(op)).toEqual(error(500, 'internal_error', 'Internal server error'));
  });
});
