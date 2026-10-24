// Fixed inline expectations on 1e8fcad, before cost matrix base extraction.
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
const summaryPath = '/api/v1/cost-matrix-summaries';
const listPath = '/api/v1/cost-matrices';
const detailPath = `${listPath}/${id}`;
const row = { id, version: 2, code: 'Fixed', private: 'uncropped' };
const summary = { items: [row], total: 9, page: 777, pageSize: 888, extra: 'raw' };
const filters = {
  page: 1,
  pageSize: 20,
  query: '',
  productFamily: '',
  attention: 'ALL',
  sort: 'ATTENTION',
};
const createBody = {
  code: ' matrix!? ',
  name: ' Matrix ',
  productItemVersionId: id,
  productSpecification: { fixed: true },
  currency: ' USD ',
  defaultTaxRate: ' 0.1200 ',
};
const createInput = {
  code: 'matrix!?',
  name: 'Matrix',
  productItemVersionId: id,
  productSpecification: { fixed: true },
  currency: 'USD',
  defaultTaxRate: '0.12',
};
const methods = [
  'listCostMatrixSummaries',
  'listCostMatrices',
  'getCostMatrix',
  'createCostMatrix',
] as const;
type Operation = {
  path: string;
  verb: string;
  method: (typeof methods)[number];
  capability: PermissionKey;
  body: unknown;
  args: readonly unknown[];
  status: number;
  result: unknown;
};
const operations: readonly Operation[] = [
  {
    path: summaryPath,
    verb: 'GET',
    method: 'listCostMatrixSummaries',
    capability: 'cost-matrix:read',
    body: null,
    args: [filters, actor, ['TEAM']],
    status: 200,
    result: { ...summary, page: 1, pageSize: 20 },
  },
  {
    path: listPath,
    verb: 'GET',
    method: 'listCostMatrices',
    capability: 'cost-matrix:read',
    body: null,
    args: [actor, ['TEAM']],
    status: 200,
    result: { items: [row] },
  },
  {
    path: detailPath,
    verb: 'GET',
    method: 'getCostMatrix',
    capability: 'cost-matrix:read',
    body: null,
    args: [id, actor, ['TEAM'], false],
    status: 200,
    result: row,
  },
  {
    path: listPath,
    verb: 'POST',
    method: 'createCostMatrix',
    capability: 'cost-matrix:manage',
    body: createBody,
    args: [createInput, actor, ['TEAM'], correlationId],
    status: 201,
    result: row,
  },
];
function fixture(
  permissions: readonly (readonly [PermissionKey, Grant])[] = [
    ['cost-matrix:read', grant],
    ['cost-matrix:manage', grant],
  ],
  available = true,
) {
  const context: AuthorizationContext = {
    actor,
    permissions: new Map(permissions),
    scopeAnchors: new Map(permissions.map(([capability]) => [capability, anchors])),
  };
  const repository = {
    listCostMatrixSummaries: vi.fn().mockResolvedValue(summary),
    listCostMatrices: vi.fn().mockResolvedValue([row]),
    getCostMatrix: vi.fn().mockResolvedValue(row),
    createCostMatrix: vi.fn().mockResolvedValue(row),
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
    method = 'GET',
    body: unknown = null,
    options: {
      query?: Readonly<Record<string, string | undefined>>;
      session?: boolean;
      key?: string;
    } = {},
  ) =>
    app.dispatch({
      method,
      pathname: path,
      body,
      ...(options.query ? { query: options.query } : {}),
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
const pageError = invalid('page must be an integer between 1 and 100000');
const sizeError = invalid('pageSize must be an integer between 5 and 100');

describe('inline cost matrix base contracts', () => {
  it('summary and list ignore malformed GET bodies, and list ignores query filters', async () => {
    const f = fixture();
    expect(await f.dispatch(summaryPath, 'GET', 'not an object')).toEqual(
      response(200, { ...summary, page: 1, pageSize: 20 }),
    );
    expect(await f.dispatch(listPath, 'GET', [], { query: { page: 'bad' } })).toEqual(
      response(200, { items: [row] }),
    );
    expect(f.repository.listCostMatrixSummaries).toHaveBeenCalledExactlyOnceWith(filters, actor, [
      'TEAM',
    ]);
    expect(f.repository.listCostMatrices).toHaveBeenCalledExactlyOnceWith(actor, ['TEAM']);
  });
  it('factor and calculation entry paths still reach their untouched validators', async () => {
    const f = fixture([]);
    for (const [path, method] of [
      [`${listPath}/${id}/factors`, 'POST'],
      [`${listPath}/${id}/factors/${id}`, 'PATCH'],
      [`${listPath}/${id}/calculate`, 'POST'],
      [`/api/v1/cost-matrix-calculations/${id}/quote-cost-decision`, 'POST'],
    ]) {
      expect(await f.dispatch(path ?? '', method, null)).toEqual(
        invalid('A JSON object body is required'),
      );
      expect(await f.dispatch(path ?? '', method, {})).toEqual(denied);
    }
    noCalls(f);
  });
  it.each(operations)(
    '$verb $path preserves precise receiver/args/raw response/status without anchors',
    async (op) => {
      const f = fixture();
      expect(await f.dispatch(op.path, op.verb, op.body)).toEqual(response(op.status, op.result));
      expect(f.repository[op.method]).toHaveBeenCalledExactlyOnceWith(...op.args);
      expect(f.repository[op.method].mock.contexts).toEqual([f.repository]);
      for (const method of methods)
        if (method !== op.method) expect(f.repository[method]).not.toHaveBeenCalled();
    },
  );
  it.each(operations)(
    '$verb $path rejects missing permission/empty scope, preserving field semantics',
    async (op) => {
      for (const permissions of [[], [[op.capability, { scopes: [], fields: null }]]] as const) {
        const f = fixture(permissions);
        expect(await f.dispatch(op.path, op.verb, op.body, { query: { page: 'bad' } })).toEqual(
          denied,
        );
        noCalls(f);
      }
      const f = fixture([[op.capability, { scopes: ['TEAM'], fields: [] }]]);
      expect(await f.dispatch(op.path, op.verb, op.body)).toEqual(
        op.verb === 'GET' ? response(op.status, op.result) : fieldDenied,
      );
      if (op.verb === 'POST') noCalls(f);
    },
  );
  it.each(operations)('$verb $path does not crop raw output using read fields', async (op) => {
    const permissions: readonly (readonly [PermissionKey, Grant])[] = [
      ['cost-matrix:read', { scopes: ['TEAM'], fields: ['code'] }],
      ['cost-matrix:manage', grant],
    ];
    const f = fixture(permissions);
    expect(await f.dispatch(op.path, op.verb, op.body)).toEqual(response(op.status, op.result));
  });
  it.each(operations)(
    '$verb $path skips absent repository before all parsing and permissions',
    async (op) => {
      const f = fixture([], false);
      expect(await f.dispatch(op.path, op.verb, null, { query: { page: 'bad' } })).toEqual(missing);
      expect(await f.dispatch(`${listPath}/bad`, 'GET')).toEqual(missing);
      noCalls(f);
    },
  );
  it.each(operations)('$verb $path requires session before dependency or inputs', async (op) => {
    const f = fixture([], false);
    expect(await f.dispatch(op.path, op.verb, null, { session: false })).toEqual(
      error(401, 'authentication_required', 'A valid session is required'),
    );
    expect(f.authenticate).not.toHaveBeenCalled();
    noCalls(f);
  });
  it.each(operations)('$verb $path preserves unmatched methods/path boundaries', async (op) => {
    const f = fixture([]);
    for (const method of ['PATCH', 'DELETE', 'OPTIONS'])
      expect(await f.dispatch(op.path, method)).toEqual(missing);
    for (const path of [`${op.path}/`, op.path.toUpperCase(), `${op.path}/unknown`])
      expect(await f.dispatch(path, op.verb)).toEqual(missing);
    noCalls(f);
  });
  it.each(operations)('$verb $path keeps domain/internal error envelopes', async (op) => {
    const f = fixture();
    for (const [code, status] of [
      ['forbidden', 403],
      ['not_found', 404],
      ['conflict', 409],
      ['invalid_request', 400],
    ] as const) {
      f.repository[op.method].mockRejectedValueOnce(new DomainError(code, 'fixed failure'));
      expect(await f.dispatch(op.path, op.verb, op.body)).toEqual(
        error(status, code, 'fixed failure'),
      );
    }
    f.repository[op.method].mockRejectedValueOnce(new Error('private fixture failure'));
    expect(await f.dispatch(op.path, op.verb, op.body)).toEqual(
      error(500, 'internal_error', 'Internal server error'),
    );
  });
  it.each(['', ' ', '0', '-1', '1.5', '100001', 'bad', 'Infinity'])(
    'summary rejects page %j before pageSize and filters',
    async (page) => {
      const f = fixture();
      expect(
        await f.dispatch(summaryPath, 'GET', null, {
          query: { page, pageSize: 'bad', attention: 'BAD', sort: 'BAD' },
        }),
      ).toEqual(pageError);
      noCalls(f);
    },
  );
  it.each(['', ' ', '4', '101', '5.5', 'bad'])(
    'summary rejects size %j before filters',
    async (pageSize) => {
      const f = fixture();
      expect(
        await f.dispatch(summaryPath, 'GET', null, {
          query: { pageSize, attention: 'BAD', sort: 'BAD' },
        }),
      ).toEqual(sizeError);
      noCalls(f);
    },
  );
  it.each([
    ['1e2', '5', 100, 5],
    ['1.0', '1e2', 1, 100],
    [' 100000 ', '20.0', 100000, 20],
  ])(
    'summary retains Number conversion for %s/%s',
    async (page, pageSize, parsedPage, parsedSize) => {
      const f = fixture();
      expect(await f.dispatch(summaryPath, 'GET', null, { query: { page, pageSize } })).toEqual(
        response(200, { ...summary, page: parsedPage, pageSize: parsedSize }),
      );
      expect(f.repository.listCostMatrixSummaries).toHaveBeenCalledExactlyOnceWith(
        { ...filters, page: parsedPage, pageSize: parsedSize },
        actor,
        ['TEAM'],
      );
    },
  );
  it('summary validates attention before sort and trims/truncates only q/productFamily', async () => {
    const f = fixture();
    expect(
      await f.dispatch(summaryPath, 'GET', null, { query: { attention: 'BAD', sort: 'BAD' } }),
    ).toEqual(invalid('Invalid cost matrix attention filter'));
    expect(await f.dispatch(summaryPath, 'GET', null, { query: { sort: 'BAD' } })).toEqual(
      invalid('Invalid cost matrix sort'),
    );
    expect(
      await f.dispatch(summaryPath, 'GET', null, { query: { attention: ' ALL ', sort: 'CODE' } }),
    ).toEqual(invalid('Invalid cost matrix attention filter'));
    expect(
      await f.dispatch(summaryPath, 'GET', null, {
        query: {
          q: ` ${'q'.repeat(121)} `,
          productFamily: ` ${'f'.repeat(81)} `,
          attention: 'READY_FOR_QUOTE',
          sort: 'COST_DESC',
        },
      }),
    ).toEqual(response(200, { ...summary, page: 1, pageSize: 20 }));
    expect(f.repository.listCostMatrixSummaries).toHaveBeenCalledExactlyOnceWith(
      {
        ...filters,
        query: 'q'.repeat(120),
        productFamily: 'f'.repeat(80),
        attention: 'READY_FOR_QUOTE',
        sort: 'COST_DESC',
      },
      actor,
      ['TEAM'],
    );
  });
  it.each(['ALL', 'NEEDS_INPUT', 'NEEDS_CALCULATION', 'READY_FOR_QUOTE', 'IN_QUOTE'])(
    'summary accepts attention %s',
    async (attention) => {
      const f = fixture();
      await f.dispatch(summaryPath, 'GET', null, { query: { attention } });
      expect(f.repository.listCostMatrixSummaries).toHaveBeenCalledExactlyOnceWith(
        { ...filters, attention },
        actor,
        ['TEAM'],
      );
    },
  );
  it.each(['ATTENTION', 'CODE', 'UPDATED', 'COST_DESC'])(
    'summary accepts sort %s',
    async (sort) => {
      const f = fixture();
      await f.dispatch(summaryPath, 'GET', null, { query: { sort } });
      expect(f.repository.listCostMatrixSummaries).toHaveBeenCalledExactlyOnceWith(
        { ...filters, sort },
        actor,
        ['TEAM'],
      );
    },
  );
  it('summary/list retain empty results and override repository pagination', async () => {
    const f = fixture();
    f.repository.listCostMatrixSummaries.mockResolvedValueOnce({ ...summary, items: [], total: 0 });
    expect(await f.dispatch(summaryPath)).toEqual(
      response(200, { ...summary, items: [], total: 0, page: 1, pageSize: 20 }),
    );
    f.repository.listCostMatrices.mockResolvedValueOnce([]);
    expect(await f.dispatch(listPath)).toEqual(response(200, { items: [] }));
  });
  it('detail read permission precedes bad UUID and ignores query/body', async () => {
    const deniedFixture = fixture([]);
    expect(await deniedFixture.dispatch(`${listPath}/bad`)).toEqual(denied);
    noCalls(deniedFixture);
    const f = fixture();
    expect(await f.dispatch(`${listPath}/bad`)).toEqual(invalid('modelId must be a UUID'));
    noCalls(f);
    expect(
      await f.dispatch(detailPath, 'GET', { extra: true }, { query: { page: 'bad' } }),
    ).toEqual(response(200, row));
  });
  it.each([
    [undefined, false],
    [{ scopes: ['COMPANY'], fields: [] }, true],
    [{ scopes: ['GROUP'], fields: null }, false],
    [{ scopes: ['SELF'], fields: null }, false],
    [{ scopes: [], fields: null }, false],
  ] as const)(
    'detail reads audit COMPANY flag without separate authorization %j',
    async (audit, visible) => {
      const f = fixture([
        ['cost-matrix:read', grant],
        ...(audit ? [['audit:read', audit] as const] : []),
      ]);
      expect(await f.dispatch(detailPath)).toEqual(response(200, row));
      expect(f.repository.getCostMatrix).toHaveBeenCalledExactlyOnceWith(
        id,
        actor,
        ['TEAM'],
        visible,
      );
    },
  );
  it('create body/allow precede permission and limited fields authorize all present keys', async () => {
    const f = fixture([]);
    expect(await f.dispatch(listPath, 'POST', null)).toEqual(
      invalid('A JSON object body is required'),
    );
    expect(await f.dispatch(listPath, 'POST', { unexpected: true })).toEqual(
      invalid('Unsupported fields: unexpected'),
    );
    expect(await f.dispatch(listPath, 'POST', { ...createBody, code: '' })).toEqual(denied);
    noCalls(f);
    const limited = fixture([
      ['cost-matrix:manage', { scopes: ['TEAM'], fields: Object.keys(createBody) }],
    ]);
    expect(await limited.dispatch(listPath, 'POST', createBody)).toEqual(response(201, row));
    const noItem = fixture([
      [
        'cost-matrix:manage',
        {
          scopes: ['TEAM'],
          fields: Object.keys(createBody).filter((field) => field !== 'productItemVersionId'),
        },
      ],
    ]);
    expect(
      await noItem.dispatch(listPath, 'POST', { ...createBody, productItemVersionId: null }),
    ).toEqual(fieldDenied);
    noCalls(noItem);
  });
  it.each([undefined, null, false, '', 0])(
    'create omits falsey productItemVersionId %j but keeps JSON nullish default',
    async (productItemVersionId) => {
      const f = fixture();
      expect(
        await f.dispatch(listPath, 'POST', {
          ...createBody,
          productItemVersionId,
          productSpecification: null,
        }),
      ).toEqual(response(201, row));
      expect(f.repository.createCostMatrix).toHaveBeenCalledExactlyOnceWith(
        {
          code: 'matrix!?',
          name: 'Matrix',
          productSpecification: {},
          currency: 'USD',
          defaultTaxRate: '0.12',
        },
        actor,
        ['TEAM'],
        correlationId,
      );
    },
  );
  it('create defaults omitted productSpecification and does not require/header-parse idempotency', async () => {
    const f = fixture();
    const body = { ...createBody };
    delete (body as Partial<typeof createBody>).productSpecification;
    expect(await f.dispatch(listPath, 'POST', body, { key: 'x'.repeat(129) })).toEqual(
      response(201, row),
    );
    expect(f.repository.createCostMatrix).toHaveBeenCalledExactlyOnceWith(
      { ...createInput, productSpecification: {} },
      actor,
      ['TEAM'],
      correlationId,
    );
  });
  it.each([
    [{ code: '', name: '', productItemVersionId: 'bad' }, 'code is required'],
    [{ name: '', productItemVersionId: 'bad' }, 'name is required'],
    [
      { productItemVersionId: 'bad', productSpecification: [] },
      'productItemVersionId must be a UUID',
    ],
    [{ productSpecification: [], currency: 'bad' }, 'productSpecification must be a JSON object'],
    [{ currency: 'usd', defaultTaxRate: '-1' }, 'Currency must be ISO 4217 uppercase'],
    [{ defaultTaxRate: '-0.1' }, 'defaultTaxRate must be non-negative'],
    [{ defaultTaxRate: '01' }, 'Invalid decimal'],
    [{ defaultTaxRate: undefined }, 'defaultTaxRate is required'],
  ])('create preserves first value error %j', async (changed, message) => {
    const f = fixture();
    expect(await f.dispatch(listPath, 'POST', { ...createBody, ...changed })).toEqual(
      invalid(message),
    );
    noCalls(f);
  });
  it('create accepts normalized negative zero and uppercase currency without new enums', async () => {
    const f = fixture();
    expect(
      await f.dispatch(listPath, 'POST', {
        ...createBody,
        defaultTaxRate: '-0.0000',
        currency: 'ZZZ',
      }),
    ).toEqual(response(201, row));
    expect(f.repository.createCostMatrix).toHaveBeenCalledExactlyOnceWith(
      { ...createInput, defaultTaxRate: '0', currency: 'ZZZ' },
      actor,
      ['TEAM'],
      correlationId,
    );
  });
});
