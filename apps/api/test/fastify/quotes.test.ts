import { afterEach, describe, expect, it, vi } from 'vitest';
import { DomainError, type AuthorizationContext } from '@kingturf/domain';
import type { JsonObject } from '@kingturf/types';
import type { ApiRequest } from '../../src/api-types.ts';
import type { ApiDependencies } from '../../src/app.ts';
import type { QuotePage } from '../../src/routes/fastify/quotes.ts';
import { dispatchFastifyRouteGroup } from '../../src/routes/fastify/registry.ts';

// U3-COM-3：quotes Fastify 组契约测试——GET 列表（cursor 分页/状态筛选/遮蔽/键守恒）、
// GET 详情、POST 创建与 PUT 版本（legacy 同解析链：消息/输入/响应逐字节一致）。
const quoteRow = {
  id: '33333333-3333-4333-8333-333333333333',
  quoteId: '44444444-4444-4444-8444-444444444444',
  opportunityId: '22222222-2222-4222-8222-222222222222',
  // TD-WF-001：报价行带所属商机的客户（信用评估的创建要求 customerId）。下面整行 toEqual，
  // 所以这一键必须原样透传——夹具与真实投影保持一致。
  customerId: '11111111-1111-4111-8111-111111111111',
  quoteNumber: 'Q-2026-001',
  revision: 2,
  status: 'APPROVED',
  opportunityVersion: 3,
  opportunitySnapshotId: null,
  ctrVersionId: '55555555-5555-4555-8555-555555555555',
  technicalSolutionRevisionId: '66666666-6666-4666-8666-666666666666',
  costDecisionId: '77777777-7777-4777-8777-777777777777',
  policyVersionId: '88888888-8888-4888-8888-888888888888',
  policyEvaluationId: '99999999-9999-4999-8999-999999999999',
  currency: 'CNY',
  subtotal: '1000000',
  discount: '0',
  total: '1000000',
  costTotal: '752209',
  margin: '247791',
  marginBasisPoints: 2477,
  validUntil: new Date('2026-12-31T15:59:59.000Z'),
  issuedAt: null,
  lines: [
    {
      description: '人造草坪系统',
      quantity: '8050',
      unitCode: 'M2',
      unitPrice: '108',
      total: '869400',
    },
  ],
  approvals: [],
  issuedSnapshotId: null,
  issuedSnapshotHash: null,
} as unknown as JsonObject;

const repositoryCalls: { method: string; args: unknown[] }[] = [];

const repository = (
  overrides: {
    listQuotePage?: ReturnType<typeof vi.fn>;
    findQuoteRevision?: ReturnType<typeof vi.fn>;
  } = {},
) =>
  ({
    listQuotePage:
      overrides.listQuotePage ??
      vi.fn((...args: unknown[]) => {
        repositoryCalls.push({ method: 'listQuotePage', args });
        // cursor 存在时返回溢出页（供续传断言），否则 null（默认键守恒断言）。
        const filter = args[3] as { cursor?: string };
        return Promise.resolve({
          items: [quoteRow],
          nextCursor: filter.cursor ? '33333333-3333-4333-8333-333333333333' : null,
        } as QuotePage);
      }),
    findQuoteRevision:
      overrides.findQuoteRevision ??
      vi.fn((...args: unknown[]) => {
        repositoryCalls.push({ method: 'findQuoteRevision', args });
        return Promise.resolve(quoteRow);
      }),
    createQuote: vi.fn((...args: unknown[]) => {
      repositoryCalls.push({ method: 'createQuote', args });
      return Promise.resolve({ id: '44444444-4444-4444-8444-444444444444', version: 3 });
    }),
  }) as unknown as NonNullable<ApiDependencies['commercial']>;

const quoteRowId = '33333333-3333-4333-8333-333333333333';

const scopeFor = (
  fields: readonly string[] | null,
  repo: NonNullable<ApiDependencies['commercial']> = repository(),
) => ({
  authorization: {
    actor: { companyId: '11111111-1111-4111-8111-111111111111', employeeId: 'e-1' },
    permissions: new Map([
      ['quote:read', { scopes: ['TENANT'], fields }],
      ['quote:create', { scopes: ['TENANT'], fields }],
      ['quote:update', { scopes: ['TENANT'], fields }],
    ]),
  } as unknown as AuthorizationContext,
  dependencies: { commercial: repo } as unknown as ApiDependencies,
  correlationId: 'corr-1',
});

const requestFor = (
  overrides: Partial<ApiRequest> & {
    pathname?: string;
    body?: unknown;
    query?: Record<string, string>;
  } = {},
): ApiRequest => ({
  method: 'GET',
  pathname: '/api/v1/quotes',
  ...overrides,
});

const quoteBody = {
  quoteNumber: ' Q-2026-009 ',
  opportunityId: '22222222-2222-4222-8222-222222222222',
  ctrVersionId: '55555555-5555-4555-8555-555555555555',
  technicalSolutionRevisionId: '66666666-6666-4666-8666-666666666666',
  costDecisionId: '77777777-7777-4777-8777-777777777777',
  policyVersionId: '88888888-8888-4888-8888-888888888888',
  policyEvaluationId: '99999999-9999-4999-8999-999999999999',
  currency: 'CNY',
  subtotal: '869400.000000',
  discount: '0.000000',
  total: '869400.000000',
  costTotal: '652050.000000',
  margin: '217350.000000',
  marginBasisPoints: 2500,
  validUntil: '2026-12-31T23:59:59.000Z',
  lines: [
    {
      description: '人造草坪系统',
      quantity: '8050',
      unitCode: 'M2',
      unitPrice: '108',
      total: '869400',
    },
  ],
};

afterEach(() => {
  repositoryCalls.length = 0;
});

describe('quotes fastify bridge track', () => {
  it('GET 列表默认请求键守恒（无 nextCursor 键）且默认 limit=100', async () => {
    const response = await dispatchFastifyRouteGroup(requestFor(), scopeFor(null));
    expect(response?.statusCode).toBe(200);
    const body = response?.body as { items: JsonObject[]; nextCursor?: unknown };
    expect(Object.keys(body)).toEqual(['items']);
    expect(body.items).toEqual([JSON.parse(JSON.stringify(quoteRow))]);
    expect(repositoryCalls[0]?.method).toBe('listQuotePage');
    expect(repositoryCalls[0]?.args[3]).toEqual({ limit: 100 });
  });

  it('GET 列表透传分页/状态筛选并在页溢出时返回 nextCursor', async () => {
    const response = await dispatchFastifyRouteGroup(
      requestFor({
        query: { limit: '10', cursor: '33333333-3333-4333-8333-333333333333', status: 'APPROVED' },
      }),
      scopeFor(null),
    );
    expect((response?.body as { nextCursor?: string }).nextCursor).toBe(
      '33333333-3333-4333-8333-333333333333',
    );
    expect(repositoryCalls[0]?.args[3]).toEqual({
      limit: 10,
      cursor: '33333333-3333-4333-8333-333333333333',
      status: 'APPROVED',
    });
  });

  it('GET 列表负例（limit/cursor/status）映射 legacy 400 信封且不触仓储', async () => {
    for (const query of [
      { limit: '0' },
      { limit: '101' },
      { cursor: 'nope' },
      { status: 'UNKNOWN' },
    ]) {
      const response = await dispatchFastifyRouteGroup(requestFor({ query }), scopeFor(null));
      expect(response?.statusCode).toBe(400);
      expect(
        (response?.body as { error: { code: string; correlationId: string } }).error,
      ).toMatchObject({
        code: 'invalid_request',
        correlationId: 'corr-1',
      });
    }
    expect(repositoryCalls).toHaveLength(0);
  });

  it('GET 详情命中返回归一化行；未命中映射 not_found 信封', async () => {
    const found = await dispatchFastifyRouteGroup(
      requestFor({ pathname: `/api/v1/quotes/${quoteRowId}` }),
      scopeFor(null),
    );
    expect(found?.statusCode).toBe(200);
    expect(found?.body).toEqual(JSON.parse(JSON.stringify(quoteRow)));
    const missing = await dispatchFastifyRouteGroup(
      requestFor({ pathname: `/api/v1/quotes/${quoteRowId}` }),
      scopeFor(null, repository({ findQuoteRevision: vi.fn().mockResolvedValue(null) })),
    );
    expect(missing?.statusCode).toBe(404);
    expect((missing?.body as { error: { code: string; message: string } }).error).toMatchObject({
      code: 'not_found',
      message: 'Quote revision not found',
    });
  });

  it('POST 创建走 legacy 同款解析链：输入归一化（trim/decimal）、201、遮蔽响应', async () => {
    const response = await dispatchFastifyRouteGroup(
      requestFor({ method: 'POST', body: quoteBody }),
      scopeFor(null),
    );
    expect(response?.statusCode).toBe(201);
    expect(response?.body).toEqual({ id: '44444444-4444-4444-8444-444444444444', version: 3 });
    const call = repositoryCalls[0];
    expect(call?.method).toBe('createQuote');
    expect(call?.args[0]).toEqual({
      ...quoteBody,
      quoteNumber: 'Q-2026-009',
      subtotal: '869400',
      discount: '0',
      total: '869400',
      costTotal: '652050',
      margin: '217350',
    });
    expect(call?.args[4]).toBe('corr-1');
  });

  it('POST 负例沿用 legacy 契约消息（对象体/未知字段/uuid/基点范围）', async () => {
    for (const [body, message] of [
      [null, 'A JSON object body is required'],
      [{ ...quoteBody, unknown: true }, 'Unsupported fields: unknown'],
      [{ ...quoteBody, opportunityId: 'bad' }, 'opportunityId must be a UUID'],
      [
        { ...quoteBody, marginBasisPoints: 20000 },
        'marginBasisPoints must be an integer between -100000 and 10000',
      ],
    ] as const) {
      const response = await dispatchFastifyRouteGroup(
        requestFor({ method: 'POST', body }),
        scopeFor(null),
      );
      expect(response?.statusCode).toBe(400);
      expect((response?.body as { error: { code: string; message: string } }).error).toMatchObject({
        code: 'invalid_request',
        message,
      });
    }
    expect(repositoryCalls).toHaveLength(0);
  });

  it('PUT 版本经 createQuote（quoteId 注入）返回 200；坏 uuid 沿用 legacy 消息', async () => {
    const ok = await dispatchFastifyRouteGroup(
      requestFor({
        method: 'PUT',
        pathname: '/api/v1/quotes/44444444-4444-4444-8444-444444444444',
        body: quoteBody,
      }),
      scopeFor(null),
    );
    expect(ok?.statusCode).toBe(200);
    expect(ok?.body).toEqual({ id: '44444444-4444-4444-8444-444444444444', version: 3 });
    expect(repositoryCalls[0]?.args[0]).toMatchObject({
      quoteId: '44444444-4444-4444-8444-444444444444',
      quoteNumber: 'Q-2026-009',
    });
    const bad = await dispatchFastifyRouteGroup(
      requestFor({ method: 'PUT', pathname: '/api/v1/quotes/bad', body: quoteBody }),
      scopeFor(null),
    );
    expect(bad?.statusCode).toBe(400);
    expect((bad?.body as { error: { message: string } }).error.message).toBe(
      'quoteId must be a UUID',
    );
  });

  it('仓储 DomainError 映射 legacy 状态码', async () => {
    const response = await dispatchFastifyRouteGroup(
      requestFor(),
      scopeFor(
        null,
        repository({
          listQuotePage: vi
            .fn()
            .mockRejectedValue(new DomainError('forbidden', 'Permission denied')),
        }),
      ),
    );
    expect(response?.statusCode).toBe(403);
    expect((response?.body as { error: { code: string } }).error.code).toBe('forbidden');
  });
});
