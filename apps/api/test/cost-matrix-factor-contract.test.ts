// Fixed inline expectations on c83a181, before factor extraction.
import { describe, expect, it, vi } from 'vitest';
import { DomainError, type AuthorizationContext } from '@kingturf/domain';
import type { PermissionKey } from '@kingturf/types';
import { buildApp, type ApiDependencies } from '../src/app.js';

const id = '11111111-1111-4111-8111-111111111111';
const factorId = '22222222-2222-4222-8222-222222222222';
const correlationId = '33333333-3333-4333-8333-333333333333';
const actor = { companyId: 'tenant', employeeId: 'actor' };
const anchors = [{ scope: 'TEAM', organizationId: id }] as const;
type Grant = NonNullable<ReturnType<AuthorizationContext['permissions']['get']>>;
const grant: Grant = { scopes: ['TEAM'], fields: null };
const base = `/api/v1/cost-matrices/${id}/factors`;
const result = { id: factorId, factorCode: 'FIXED', private: 'raw', version: 2 };
const patchBody = {
  factorName: ' Factor ',
  category: ' category!? ',
  sourceType: ' MANUAL ',
  sourceItemVersionId: id,
  quantity: ' 2.5000 ',
  unitCode: ' kg!? ',
  manualUnitPriceTaxInclusive: ' 3.2000 ',
  taxRate: ' 0.0500 ',
  priceSourceName: ' source ',
  priceSourceReference: ' ref ',
  priceEffectiveAt: ' 2026-10-13 ',
  priceNote: ' note ',
  adjustable: false,
  sortOrder: 7,
};
const patchInput = {
  factorName: 'Factor',
  category: 'category!?',
  sourceType: 'MANUAL',
  sourceItemVersionId: id,
  quantity: '2.5',
  unitCode: 'kg!?',
  manualUnitPriceTaxInclusive: '3.2',
  taxRate: '0.05',
  priceSourceName: 'source',
  priceSourceReference: 'ref',
  priceEffectiveAt: '2026-10-13',
  priceNote: 'note',
  adjustable: false,
  sortOrder: 7,
};
const methods = ['addCostMatrixFactor', 'updateCostMatrixFactor'] as const;
type Operation = {
  path: string;
  verb: string;
  method: (typeof methods)[number];
  body: Record<string, unknown>;
  input: Record<string, unknown>;
  prefix: readonly string[];
  status: number;
};
const operations: readonly Operation[] = [
  {
    path: base,
    verb: 'POST',
    method: 'addCostMatrixFactor',
    body: { factorCode: ' FAC!? ', ...patchBody },
    input: { factorCode: 'FAC!?', ...patchInput },
    prefix: [id],
    status: 201,
  },
  {
    path: `${base}/${factorId}`,
    verb: 'PATCH',
    method: 'updateCostMatrixFactor',
    body: patchBody,
    input: patchInput,
    prefix: [id, factorId],
    status: 200,
  },
];
function fixture(
  permissions: readonly (readonly [PermissionKey, Grant])[] = [
    ['cost-matrix:manage', grant],
    ['cost-matrix:read', { scopes: ['SELF'], fields: [] }],
  ],
  available = true,
) {
  const context: AuthorizationContext = {
    actor,
    permissions: new Map(permissions),
    scopeAnchors: new Map(permissions.map(([capability]) => [capability, anchors])),
  };
  const repository = {
    addCostMatrixFactor: vi.fn().mockResolvedValue(result),
    updateCostMatrixFactor: vi.fn().mockResolvedValue(result),
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
const linkError = invalid(
  'Purchase order and supplier quote sources require a linked purchasing item',
);
const expectedArgs = (op: Operation, input = op.input) => [
  ...op.prefix,
  input,
  actor,
  ['TEAM'],
  correlationId,
];

describe('inline cost matrix factor contracts', () => {
  it.each(operations)(
    '$verb preserves exact normalized input/receiver/raw DTO/status without anchors/header',
    async (op) => {
      const f = fixture();
      expect(await f.dispatch(op)).toEqual(response(op.status, result));
      expect(f.repository[op.method]).toHaveBeenCalledExactlyOnceWith(...expectedArgs(op));
      expect(f.repository[op.method].mock.contexts).toEqual([f.repository]);
      for (const method of methods)
        if (method !== op.method) expect(f.repository[method]).not.toHaveBeenCalled();
    },
  );
  it.each(operations)(
    '$verb body/allow precede permission, while permission precedes source/path/input',
    async (op) => {
      const f = fixture([]);
      expect(await f.dispatch(op, null)).toEqual(invalid('A JSON object body is required'));
      expect(await f.dispatch(op, { ...op.body, unexpected: true })).toEqual(
        invalid('Unsupported fields: unexpected'),
      );
      expect(
        await f.dispatch(
          op,
          { ...op.body, sourceType: 'BAD', factorName: '' },
          { path: op.path.replace(id, 'bad') },
        ),
      ).toEqual(denied);
      noCalls(f);
      const emptyScopes = fixture([['cost-matrix:manage', { scopes: [], fields: null }]]);
      expect(await emptyScopes.dispatch(op)).toEqual(denied);
      noCalls(emptyScopes);
      const emptyFields = fixture([['cost-matrix:manage', { scopes: ['TEAM'], fields: [] }]]);
      expect(await emptyFields.dispatch(op)).toEqual(fieldDenied);
      noCalls(emptyFields);
      const finite = fixture([
        ['cost-matrix:manage', { scopes: ['TEAM'], fields: Object.keys(op.body) }],
      ]);
      expect(await finite.dispatch(op)).toEqual(response(op.status, result));
      const noOptional = fixture([
        [
          'cost-matrix:manage',
          {
            scopes: ['TEAM'],
            fields: Object.keys(op.body).filter((field) => field !== 'sourceItemVersionId'),
          },
        ],
      ]);
      expect(await noOptional.dispatch(op, { ...op.body, sourceItemVersionId: null })).toEqual(
        fieldDenied,
      );
      noCalls(noOptional);
    },
  );
  it('PATCH forbids factorCode before permission and does not become a partial update', async () => {
    const op = operations[1];
    if (!op) throw new Error('fixture operation absent');
    const f = fixture([]);
    expect(await f.dispatch(op, { ...patchBody, factorCode: 'NEW' })).toEqual(
      invalid('Unsupported fields: factorCode'),
    );
    noCalls(f);
    const allowed = fixture();
    expect(await allowed.dispatch(op, { sourceType: 'MANUAL', quantity: '1' })).toEqual(
      invalid('factorName is required'),
    );
    noCalls(allowed);
  });
  for (const op of operations) {
    it.each([
      'MANUAL',
      'PURCHASE_ORDER',
      'SUPPLIER_QUOTE',
      'MARKET_REFERENCE',
      'INTERNAL_BENCHMARK',
    ])(`${op.verb} accepts original source %s`, async (sourceType) => {
      const f = fixture();
      expect(await f.dispatch(op, { ...op.body, sourceType })).toEqual(response(op.status, result));
      expect(f.repository[op.method]).toHaveBeenCalledExactlyOnceWith(
        ...expectedArgs(op, { ...op.input, sourceType }),
      );
    });
    it.each([undefined, '', 'BAD'])(
      `${op.verb} source %j fails before any path UUID or factor value`,
      async (sourceType) => {
        const f = fixture();
        expect(
          await f.dispatch(
            op,
            { ...op.body, sourceType, factorName: '' },
            { path: op.path.replace(id, 'bad') },
          ),
        ).toEqual(
          invalid(sourceType === 'BAD' ? 'sourceType is not supported' : 'sourceType is required'),
        );
        noCalls(f);
      },
    );
    it.each(['PURCHASE_ORDER', 'SUPPLIER_QUOTE'])(
      `${op.verb} purchasing source %s requires a truthy item before path UUID`,
      async (sourceType) => {
        const f = fixture();
        for (const sourceItemVersionId of [undefined, null, '', false, 0])
          expect(
            await f.dispatch(
              op,
              { ...op.body, sourceType, sourceItemVersionId },
              { path: op.path.replace(id, 'bad') },
            ),
          ).toEqual(linkError);
        expect(
          await f.dispatch(
            op,
            { ...op.body, sourceType, sourceItemVersionId: 'bad' },
            { path: op.path.replace(id, 'bad') },
          ),
        ).toEqual(invalid('modelId must be a UUID'));
        expect(
          await f.dispatch(op, { ...op.body, sourceType, sourceItemVersionId: 'bad' }),
        ).toEqual(invalid('sourceItemVersionId must be a UUID'));
        noCalls(f);
      },
    );
    it.each([undefined, null, false, '', 0])(
      `${op.verb} omits all falsey optional values %j`,
      async (value) => {
        const f = fixture();
        const expected = Object.fromEntries(
          Object.entries(op.input).filter(
            ([field]) =>
              ![
                'sourceItemVersionId',
                'priceSourceReference',
                'priceEffectiveAt',
                'priceNote',
              ].includes(field),
          ),
        );
        expect(
          await f.dispatch(op, {
            ...op.body,
            sourceItemVersionId: value,
            priceSourceReference: value,
            priceEffectiveAt: value,
            priceNote: value,
          }),
        ).toEqual(response(op.status, result));
        expect(f.repository[op.method]).toHaveBeenCalledExactlyOnceWith(
          ...expectedArgs(op, expected),
        );
      },
    );
    it.each([false, true, undefined, null, 0, 'false'])(
      `${op.verb} adjustable %j is false only for boolean false`,
      async (adjustable) => {
        const f = fixture();
        expect(await f.dispatch(op, { ...op.body, adjustable })).toEqual(
          response(op.status, result),
        );
        expect(f.repository[op.method]).toHaveBeenCalledExactlyOnceWith(
          ...expectedArgs(op, { ...op.input, adjustable: adjustable !== false }),
        );
      },
    );
    it.each([undefined, null, 0, 10000])(
      `${op.verb} sortOrder %j defaults nullishly or accepts boundary`,
      async (sortOrder) => {
        const f = fixture();
        expect(await f.dispatch(op, { ...op.body, sortOrder })).toEqual(
          response(op.status, result),
        );
        expect(f.repository[op.method]).toHaveBeenCalledExactlyOnceWith(
          ...expectedArgs(op, { ...op.input, sortOrder: sortOrder ?? 0 }),
        );
      },
    );
    it.each(['0', -1, 10001, 0.5])(
      `${op.verb} rejects sortOrder %j without coercion`,
      async (sortOrder) => {
        const f = fixture();
        expect(await f.dispatch(op, { ...op.body, sortOrder })).toEqual(
          invalid('sortOrder must be an integer between 0 and 10000'),
        );
        noCalls(f);
      },
    );
    it.each([
      [{ factorName: '', category: '', sourceItemVersionId: 'bad' }, 'factorName is required'],
      [{ category: '', sourceItemVersionId: 'bad' }, 'category is required'],
      [{ sourceItemVersionId: 'bad', quantity: '' }, 'sourceItemVersionId must be a UUID'],
      [{ quantity: '-1', unitCode: '' }, 'quantity must be non-negative'],
      [{ quantity: '01' }, 'Invalid decimal'],
      [{ quantity: 1 }, 'quantity is required'],
      [{ unitCode: '', manualUnitPriceTaxInclusive: '-1' }, 'unitCode is required'],
      [
        { manualUnitPriceTaxInclusive: '-1', taxRate: '-1' },
        'manualUnitPriceTaxInclusive must be non-negative',
      ],
      [{ taxRate: '-1', priceSourceName: '' }, 'taxRate must be non-negative'],
      [{ priceSourceName: '', priceSourceReference: ' ' }, 'priceSourceName is required'],
      [{ priceSourceReference: ' ', priceEffectiveAt: 'bad' }, 'priceSourceReference is required'],
      [
        { priceEffectiveAt: '2026-13-01', priceNote: ' ' },
        'priceEffectiveAt must be a valid YYYY-MM-DD date',
      ],
      [{ priceEffectiveAt: ' ' }, 'priceEffectiveAt is required'],
      [{ priceNote: ' ', sortOrder: -1 }, 'priceNote is required'],
    ])(`${op.verb} preserves value parsing priority %j`, async (changed, message) => {
      const f = fixture();
      expect(await f.dispatch(op, { ...op.body, ...changed })).toEqual(invalid(message));
      noCalls(f);
    });
    it('retains calendarDate shape/Date.parse normalization behavior for ' + op.verb, async () => {
      const f = fixture();
      expect(
        await f.dispatch(op, {
          ...op.body,
          priceEffectiveAt: '2026-02-30',
          quantity: '-0.0000',
          manualUnitPriceTaxInclusive: '0.0000',
          taxRate: '-0',
        }),
      ).toEqual(response(op.status, result));
      expect(f.repository[op.method]).toHaveBeenCalledExactlyOnceWith(
        ...expectedArgs(op, {
          ...op.input,
          priceEffectiveAt: '2026-02-30',
          quantity: '0',
          manualUnitPriceTaxInclusive: '0',
          taxRate: '0',
        }),
      );
      for (const priceEffectiveAt of ['2026-1-01', '2026-10-13T00:00:00Z'])
        expect(await f.dispatch(op, { ...op.body, priceEffectiveAt })).toEqual(
          invalid('priceEffectiveAt must be a valid YYYY-MM-DD date'),
        );
      expect(f.repository[op.method]).toHaveBeenCalledOnce();
    });
  }
  it('POST model UUID precedes factorCode, and factorCode precedes factorName', async () => {
    const op = operations[0];
    if (!op) throw new Error('fixture operation absent');
    const f = fixture();
    expect(
      await f.dispatch(
        op,
        { ...op.body, factorCode: '', factorName: '' },
        { path: op.path.replace(id, 'bad') },
      ),
    ).toEqual(invalid('modelId must be a UUID'));
    expect(await f.dispatch(op, { ...op.body, factorCode: '', factorName: '' })).toEqual(
      invalid('factorCode is required'),
    );
    noCalls(f);
  });
  it('PATCH model UUID precedes factor UUID, which precedes factorName', async () => {
    const op = operations[1];
    if (!op) throw new Error('fixture operation absent');
    const f = fixture();
    expect(
      await f.dispatch(
        op,
        { ...op.body, factorName: '' },
        { path: `/api/v1/cost-matrices/bad/factors/bad` },
      ),
    ).toEqual(invalid('modelId must be a UUID'));
    expect(await f.dispatch(op, { ...op.body, factorName: '' }, { path: `${base}/bad` })).toEqual(
      invalid('factorId must be a UUID'),
    );
    noCalls(f);
  });
  it.each(operations)(
    '$verb ignores invalid idempotency header, rejects body key and does not crop without read grant',
    async (op) => {
      const f = fixture([['cost-matrix:manage', grant]]);
      expect(await f.dispatch(op, op.body, { key: 'x'.repeat(129) })).toEqual(
        response(op.status, result),
      );
      expect(f.repository[op.method]).toHaveBeenCalledExactlyOnceWith(...expectedArgs(op));
      expect(await f.dispatch(op, { ...op.body, idempotencyKey: 'body-key' })).toEqual(
        invalid('Unsupported fields: idempotencyKey'),
      );
      expect(f.repository[op.method]).toHaveBeenCalledOnce();
    },
  );
  it.each(operations)(
    '$verb absent repository skips body/source/path/permission, and session remains first',
    async (op) => {
      const f = fixture([], false);
      expect(await f.dispatch(op, null, { path: op.path.replace(id, 'bad') })).toEqual(missing);
      expect(await f.dispatch(op, { ...op.body, sourceType: 'BAD' })).toEqual(missing);
      expect(await f.dispatch(op, null, { session: false })).toEqual(
        error(401, 'authentication_required', 'A valid session is required'),
      );
      expect(f.authenticate).toHaveBeenCalledTimes(2);
      noCalls(f);
    },
  );
  it.each(operations)('$verb unsupported methods and path boundaries fall through', async (op) => {
    const f = fixture([]);
    for (const method of ['GET', 'DELETE', 'OPTIONS', op.verb === 'POST' ? 'PATCH' : 'POST'])
      expect(await f.dispatch(op, null, { method })).toEqual(missing);
    for (const path of [`${op.path}/`, op.path.toUpperCase(), `${op.path}/unknown`])
      expect(await f.dispatch(op, null, { path })).toEqual(missing);
    noCalls(f);
  });
  it('base detail/list and calculate routes retain their own permission validators', async () => {
    const op = operations[0];
    if (!op) throw new Error('fixture operation absent');
    const f = fixture([]);
    for (const path of [
      `/api/v1/cost-matrices/${id}`,
      '/api/v1/cost-matrices',
      '/api/v1/cost-matrix-summaries',
    ])
      expect(await f.dispatch(op, null, { path, method: 'GET' })).toEqual(denied);
    expect(await f.dispatch(op, null, { path: `/api/v1/cost-matrices/${id}/calculate` })).toEqual(
      invalid('A JSON object body is required'),
    );
    expect(await f.dispatch(op, {}, { path: `/api/v1/cost-matrices/${id}/calculate` })).toEqual(
      denied,
    );
    noCalls(f);
  });
  it.each(operations)(
    '$verb preserves domain/internal error envelopes and correlation',
    async (op) => {
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
    },
  );
});
