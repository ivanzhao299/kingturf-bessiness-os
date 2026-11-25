import { afterEach, describe, expect, it, vi } from 'vitest';
import { DomainError, type AuthorizationContext } from '@kingturf/domain';
import type { PermissionKey } from '@kingturf/types';
import type { ApiDependencies, ApiRequest, ApiResponse } from '../../src/app.ts';
import {
  allow,
  currency,
  decimal,
  idempotency,
  integer,
  mutationDto,
  objectBody,
  permittedDto,
  string,
  timestamp,
  uuid,
} from '../../src/app-values.ts';
import { authorizeQuery } from '../../src/policy.ts';
import { qtcArPostRoutes } from '../../src/routes/qtc-ar-post.ts';
import { qtcOperationalReadRoutes } from '../../src/routes/qtc-operational-reads.ts';
import { dispatchRoutes } from '../../src/routes/types.ts';
import { dispatchFastifyRouteGroup } from '../../src/routes/fastify/registry.ts';

// FIN-1：ar-open-items Fastify 组契约测试——
//   GET 列表：未带加性参数时与 legacy qtcOperationalReadRoutes('ar') 的响应、仓储方法与实参
//            逐字节一致（同一条链）；带加性参数（state=NOT_DUE / search）时走 additive listArPage；
//   GET 详情：additive 只读（根行 + 销售订单摘要 + 核销分配，两个门控）、404 信封、非 uuid 400；
//   POST：legacy qtcArPostRoutes 同解析链（入参与负例消息逐字一致）；守卫触发器拒绝（P0001）
//        按白名单映射 409 + 中文，未列入的仍 500 并留诊断日志；
//   依赖缺失 503、未认领方法落回 null。
const tenant = '11111111-1111-4111-8111-111111111111';
const itemId = '44444444-4444-4444-8444-444444444444';
const customerId = '55555555-5555-4555-8555-555555555555';
const orderId = '66666666-6666-4666-8666-666666666666';
const paymentId = '77777777-7777-4777-8777-777777777777';
const actor = { companyId: tenant, employeeId: 'e-1' };
const scopeContext = { actor, scopes: ['COMPANY'], anchors: [] };
const correlationId = 'corr-1';

const row = {
  id: itemId,
  tenant_id: tenant,
  ar_document_id: '88888888-8888-4888-8888-888888888888',
  customer_id: customerId,
  currency: 'CNY',
  // to_jsonb(numeric) 为 JSON 数字——与真库输出一致。
  original_amount: 950000,
  due_at: '2099-07-31T23:59:59+00:00',
  created_at: '2026-08-16T12:00:00+00:00',
  remaining_amount: 0,
  documentNumber: 'INV-KT-2026-001',
  documentType: 'INVOICE',
  salesOrderId: orderId,
};
const additiveRow = {
  ...row,
  remaining_amount: 850000.5,
  customerName: '金特夫演示客户',
  orderNumber: 'SO-KT-2026-001',
  postedAt: '2026-08-16T12:00:01+00:00',
  originalAmount: '950000.000000',
  appliedAmount: '99999.500000',
  remainingAmount: '850000.500000',
  overdueDays: 0,
  agingState: 'OPEN',
};
const detail = {
  ...additiveRow,
  order: {
    id: orderId,
    orderNumber: 'SO-KT-2026-001',
    status: 'RELEASED',
    currency: 'CNY',
    total: '950000.000000',
    createdAt: '2026-08-15T08:00:00+00:00',
  },
  allocations: [
    {
      id: 'a-1',
      amount: '99999.500000',
      currency: 'CNY',
      allocationOrder: 1,
      createdAt: '2026-08-16T12:05:00+00:00',
      reconciliationRunId: 'run-1',
      bankPaymentId: paymentId,
      bankReference: 'BANK-KT-001',
      paymentReceivedAt: '2026-08-16T12:00:00+00:00',
    },
  ],
};
const summary = [
  {
    currency: 'CNY',
    openCount: 3,
    outstandingAmount: '850000.500000',
    overdueCount: 1,
    overdueAmount: '950000.000000',
    due7Count: 1,
    due7Amount: '1000.500000',
    due30Count: 2,
    due30Amount: '3000.500000',
  },
];
const posted = {
  id: itemId,
  arDocumentId: row.ar_document_id,
  remainingAmount: '3',
  customerId,
  salesOrderId: orderId,
  documentNumber: 'fixture #/AR',
  documentType: 'INVOICE',
  currency: 'USD',
  amount: '3',
  dueAt: '2026-02-28T00:00:00.000Z',
  nested: { keep: true },
  secret: 'private',
};

type Qtc = NonNullable<ApiDependencies['quoteToCash']>;
type Grant = { scopes: string[]; fields: readonly string[] | null };
const calls: { method: string; args: unknown[] }[] = [];
const tracked = <T>(method: string, result: T) =>
  vi.fn((...args: unknown[]) => {
    calls.push({ method, args });
    return Promise.resolve(result);
  });

const repository = (
  overrides: {
    listOperationalPage?: ReturnType<typeof vi.fn>;
    listArPage?: ReturnType<typeof vi.fn>;
    summarizeAr?: ReturnType<typeof vi.fn>;
    findArOpenItem?: ReturnType<typeof vi.fn>;
    postAr?: ReturnType<typeof vi.fn>;
  } = {},
): Qtc =>
  ({
    list: vi.fn(),
    listOperationalPage:
      overrides.listOperationalPage ??
      tracked('listOperationalPage', { items: [row], nextCursor: null }),
    listArPage:
      overrides.listArPage ?? tracked('listArPage', { items: [additiveRow], nextCursor: null }),
    summarizeAr: overrides.summarizeAr ?? tracked('summarizeAr', summary),
    findArOpenItem: overrides.findArOpenItem ?? tracked('findArOpenItem', detail),
    postAr: overrides.postAr ?? tracked('postAr', posted),
  }) as unknown as Qtc;

// commercial 桩：registry 全组注册要求 commercial 非空（生产装配恒有）。
const dependencyScope = (qtc: Qtc | null, logger?: ApiDependencies['logger']): ApiDependencies =>
  ({ quoteToCash: qtc, commercial: {}, logger }) as unknown as ApiDependencies;

const CAPABILITIES = [
  'ar:read',
  'ar:post',
  'sales-order:read',
  'bank-payment:read',
] as const satisfies readonly PermissionKey[];
const scopeFor = (
  repo: Qtc | null,
  options: Readonly<{
    fields?: readonly string[] | null;
    writeFields?: readonly string[] | null;
    without?: readonly PermissionKey[];
    logger?: ApiDependencies['logger'];
  }> = {},
) => {
  const permissions = new Map<PermissionKey, Grant>(
    CAPABILITIES.map((capability) => [
      capability,
      {
        scopes: ['COMPANY'],
        fields:
          capability === 'ar:read'
            ? (options.fields ?? null)
            : capability === 'ar:post'
              ? (options.writeFields ?? null)
              : null,
      },
    ]),
  );
  for (const capability of options.without ?? []) permissions.delete(capability);
  return {
    authorization: {
      actor,
      permissions,
      scopeAnchors: new Map(),
    } as unknown as AuthorizationContext,
    dependencies: dependencyScope(repo, options.logger),
    correlationId,
  };
};

const requestFor = (
  overrides: Partial<ApiRequest> & { pathname?: string; body?: unknown; query?: unknown } = {},
): ApiRequest => ({
  method: 'GET',
  pathname: '/api/v1/ar-open-items',
  headers: { 'x-correlation-id': correlationId },
  ...overrides,
});
const errorOf = (response: { body: unknown } | null) =>
  (response?.body as { error: { code: string; message: string; correlationId: string } }).error;

// legacy 轨（qtcOperationalReadRoutes / qtcArPostRoutes）在相同授权下的响应与仓储实参。
// 路由模块的 validate 直接抛 DomainError、仓储调用直接拒绝——app.dispatch 的 catch 把
// DomainError 映射为信封；这里按同一映射收口（状态码与 app.ts 相同）。
const legacyReply = async (run: () => Promise<ApiResponse | null>): Promise<ApiResponse> => {
  try {
    const response = await run();
    if (!response) throw new Error('Legacy route did not match');
    return response;
  } catch (cause) {
    if (!(cause instanceof DomainError)) throw cause;
    const statusCode =
      cause.code === 'forbidden'
        ? 403
        : cause.code === 'not_found'
          ? 404
          : cause.code === 'conflict'
            ? 409
            : 400;
    return {
      statusCode,
      body: { error: { code: cause.code, message: cause.message, correlationId } },
    };
  }
};
const legacyRead = (
  repo: Qtc,
  authorization: AuthorizationContext,
  request: ApiRequest,
  fields: readonly string[] | null,
) =>
  legacyReply(() =>
    dispatchRoutes(
      qtcOperationalReadRoutes({
        repository: () => repo,
        authorization,
        authorizeQuery,
        permittedDto: (value) => permittedDto(value, fields),
        parsers: { decimal, integer, uuid, string, timestamp },
      }),
      request,
    ),
  );
const legacyPost = (repo: Qtc, authorization: AuthorizationContext, request: ApiRequest) =>
  legacyReply(async () => {
    // 与 dispatch/qtcpost.ts 同序：先 objectBody，再进入路由组。
    const body = objectBody(request.body);
    return dispatchRoutes(
      qtcArPostRoutes({
        repository: () => repo,
        body,
        authorization,
        // 与 dispatch/qtcpost.ts 的 ctx 同式：写字段清单恒为 Object.keys(body)。
        authorizeScope: (capability) => {
          const grant = authorizeQuery(authorization, capability, Object.keys(body));
          return { actor: authorization.actor, scopes: grant.scopes, anchors: grant.anchors };
        },
        correlationId,
        mutationDto: (value) => mutationDto(value, authorization, 'ar:read'),
        parsers: { allow, string, uuid, currency, decimal, timestamp, idempotency },
      }),
      request,
    );
  });

afterEach(() => {
  calls.length = 0;
});

describe('ar-open-items fastify bridge track', () => {
  it('GET 列表默认（无查询参数）走旧轨同链：listOperationalPage("ar", { limit: 50 }, scope)，响应 { items, nextCursor } 与 legacy 逐字节一致', async () => {
    for (const fields of [null, ['documentNumber', 'remaining_amount']] as const) {
      const authz = scopeFor(repository(), { fields }).authorization;
      const legacyList = tracked('listOperationalPage', { items: [row], nextCursor: null });
      const legacyRepo = repository({ listOperationalPage: legacyList });
      const legacy = await legacyRead(legacyRepo, authz, requestFor(), fields);
      calls.length = 0;
      const bridged = await dispatchFastifyRouteGroup(
        requestFor(),
        scopeFor(repository(), { fields }),
      );
      expect(bridged).toEqual(JSON.parse(JSON.stringify(legacy)));
      expect(Object.keys(bridged?.body ?? {})).toEqual(['items', 'nextCursor']);
      expect(calls).toEqual([
        { method: 'listOperationalPage', args: ['ar', { limit: 50 }, scopeContext] },
      ]);
      expect(legacyList.mock.calls).toEqual([['ar', { limit: 50 }, scopeContext]]);
    }
  });

  // legacy 查询参数的解析语义（取自 qtc-operational-read-route-contract 的字符串取值）：桥轨与
  // legacy 的响应、仓储方法与实参（含键序）逐字节一致。
  const accepted: readonly { query: Record<string, string>; expected: Record<string, unknown> }[] =
    [
      { query: {}, expected: { limit: 50 } },
      { query: { unused: 'ignored' }, expected: { limit: 50 } },
      {
        query: {
          state: '',
          minAmount: '',
          maxAmount: '',
          limit: '',
          cursor: '',
          query: '',
          from: '',
          to: '',
        },
        expected: { limit: 50 },
      },
      { query: { limit: '1' }, expected: { limit: 1 } },
      { query: { limit: '100' }, expected: { limit: 100 } },
      { query: { limit: ' 2 ' }, expected: { limit: 2 } },
      { query: { limit: '1e2' }, expected: { limit: 100 } },
      { query: { limit: '0x10' }, expected: { limit: 16 } },
      { query: { limit: '01' }, expected: { limit: 1 } },
      { query: { limit: '+1' }, expected: { limit: 1 } },
      { query: { limit: '1.0' }, expected: { limit: 1 } },
      { query: { cursor: ` ${itemId.toUpperCase()} ` }, expected: { limit: 50, cursor: itemId } },
      { query: { query: ' search%_ ' }, expected: { limit: 50, query: 'search%_' } },
      {
        query: { from: '2026-02-30', to: '2026-01-01' },
        expected: {
          limit: 50,
          from: '2026-03-02T00:00:00.000Z',
          to: '2026-01-01T00:00:00.000Z',
        },
      },
      {
        query: { minAmount: '-0.000000', maxAmount: '0.000000' },
        expected: { limit: 50, minAmount: '0', maxAmount: '0' },
      },
      {
        query: { minAmount: ' 12.340000 ', maxAmount: '20.000001' },
        expected: { limit: 50, minAmount: '12.34', maxAmount: '20.000001' },
      },
      { query: { state: 'OPEN' }, expected: { limit: 50, state: 'OPEN' } },
      { query: { state: 'CLEARED' }, expected: { limit: 50, state: 'CLEARED' } },
      { query: { state: 'OVERDUE' }, expected: { limit: 50, state: 'OVERDUE' } },
      {
        query: {
          limit: '2',
          cursor: itemId,
          query: ' name ',
          from: '2026-01-01',
          to: '2026-02-01',
          minAmount: '0.00',
          maxAmount: '10.10',
          state: 'OPEN',
        },
        expected: {
          limit: 2,
          cursor: itemId,
          query: 'name',
          from: '2026-01-01T00:00:00.000Z',
          to: '2026-02-01T00:00:00.000Z',
          minAmount: '0',
          maxAmount: '10.1',
          state: 'OPEN',
        },
      },
    ];
  it.each(accepted)(
    'GET legacy 参数 $query：新旧轨响应与仓储实参逐字节一致',
    async ({ query, expected }) => {
      const authz = scopeFor(repository()).authorization;
      const legacyList = tracked('listOperationalPage', { items: [row], nextCursor: null });
      const legacyRepo = repository({ listOperationalPage: legacyList });
      const request = requestFor({ query });
      const legacy = await legacyRead(legacyRepo, authz, request, null);
      calls.length = 0;
      const bridged = await dispatchFastifyRouteGroup(request, scopeFor(repository()));
      expect(bridged).toEqual(JSON.parse(JSON.stringify(legacy)));
      expect(calls).toEqual([
        { method: 'listOperationalPage', args: ['ar', expected, scopeContext] },
      ]);
      expect(Object.keys(calls[0]?.args[1] as object)).toEqual(Object.keys(expected));
      expect(legacyList.mock.calls).toEqual([['ar', expected, scopeContext]]);
    },
  );

  const bad: readonly { query: Record<string, string>; message: string }[] = [
    { query: { state: 'open' }, message: 'state is unsupported' },
    { query: { state: ' OPEN ' }, message: 'state is unsupported' },
    { query: { state: 'OTHER' }, message: 'state is unsupported' },
    { query: { state: '0' }, message: 'state is unsupported' },
    { query: { minAmount: ' ' }, message: 'minAmount is required' },
    { query: { minAmount: '1e2' }, message: 'Invalid decimal' },
    { query: { minAmount: '0.0000001' }, message: 'Invalid decimal' },
    { query: { minAmount: '1000000000000000000' }, message: 'Invalid decimal' },
    { query: { minAmount: 'bad' }, message: 'Invalid decimal' },
    { query: { minAmount: '-1' }, message: 'minAmount must be non-negative' },
    { query: { maxAmount: ' ' }, message: 'maxAmount is required' },
    { query: { maxAmount: '-1' }, message: 'maxAmount must be non-negative' },
    { query: { limit: '0' }, message: 'limit must be an integer between 1 and 100' },
    { query: { limit: '101' }, message: 'limit must be an integer between 1 and 100' },
    { query: { limit: '-1' }, message: 'limit must be an integer between 1 and 100' },
    { query: { limit: '1.5' }, message: 'limit must be an integer between 1 and 100' },
    { query: { limit: ' ' }, message: 'limit must be an integer between 1 and 100' },
    { query: { limit: 'NaN' }, message: 'limit must be an integer between 1 and 100' },
    { query: { limit: 'Infinity' }, message: 'limit must be an integer between 1 and 100' },
    { query: { limit: 'bad' }, message: 'limit must be an integer between 1 and 100' },
    { query: { cursor: ' ' }, message: 'cursor is required' },
    { query: { cursor: 'bad' }, message: 'cursor must be a UUID' },
    { query: { query: ' ' }, message: 'query is required' },
    { query: { from: 'bad' }, message: 'from must be a valid timestamp' },
    { query: { to: 'bad' }, message: 'to must be a valid timestamp' },
    { query: { minAmount: '2', maxAmount: '1' }, message: 'minAmount must not exceed maxAmount' },
    { query: { state: 'bad', minAmount: 'bad', limit: 'bad' }, message: 'state is unsupported' },
    { query: { minAmount: 'bad', maxAmount: 'bad', limit: 'bad' }, message: 'Invalid decimal' },
    { query: { maxAmount: 'bad', limit: 'bad' }, message: 'Invalid decimal' },
    {
      query: { minAmount: '2', maxAmount: '1', limit: 'bad' },
      message: 'minAmount must not exceed maxAmount',
    },
    {
      query: { limit: 'bad', cursor: 'bad', query: ' ', from: 'bad' },
      message: 'limit must be an integer between 1 and 100',
    },
    { query: { cursor: 'bad', query: ' ', from: 'bad' }, message: 'cursor must be a UUID' },
    { query: { query: ' ', from: 'bad', to: 'bad' }, message: 'query is required' },
    { query: { from: 'bad', to: 'bad' }, message: 'from must be a valid timestamp' },
  ];
  it.each(bad)(
    'GET legacy 参数负例 $query → $message（与 legacy 同消息，且不触达仓储）',
    async ({ query, message }) => {
      const authz = scopeFor(repository()).authorization;
      const legacy = await legacyRead(repository(), authz, requestFor({ query }), null);
      calls.length = 0;
      const bridged = await dispatchFastifyRouteGroup(
        requestFor({ query }),
        scopeFor(repository()),
      );
      expect(bridged).toEqual(JSON.parse(JSON.stringify(legacy)));
      expect(bridged?.statusCode).toBe(400);
      expect(errorOf(bridged)).toEqual({ code: 'invalid_request', message, correlationId });
      expect(calls).toEqual([]);
    },
  );

  const relatedRead = { ...scopeContext, fields: null };
  const listRead = { order: relatedRead, fields: null };

  it('GET 加性筛选 state=NOT_DUE 走 listArPage（旧轨方法不被调用）', async () => {
    const response = await dispatchFastifyRouteGroup(
      requestFor({ query: { state: 'NOT_DUE', limit: '3' } }),
      scopeFor(repository()),
    );
    expect(response?.statusCode).toBe(200);
    expect(response?.body).toEqual({ items: [additiveRow], nextCursor: null });
    expect(calls).toEqual([
      { method: 'listArPage', args: [scopeContext, { limit: 3, state: 'NOT_DUE' }, listRead] },
    ]);
  });

  it('GET 加性关键字 search（去首尾空白）走 listArPage；空白 search 不生效、仍走旧轨同链', async () => {
    const searched = await dispatchFastifyRouteGroup(
      requestFor({ query: { search: '  INV-KT  ', state: 'OVERDUE' } }),
      scopeFor(repository()),
    );
    expect(searched?.statusCode).toBe(200);
    expect(calls).toEqual([
      {
        method: 'listArPage',
        args: [scopeContext, { limit: 50, state: 'OVERDUE', search: 'INV-KT' }, listRead],
      },
    ]);
    calls.length = 0;
    const blank = await dispatchFastifyRouteGroup(
      requestFor({ query: { search: '   ', limit: '5' } }),
      scopeFor(repository()),
    );
    expect(blank?.statusCode).toBe(200);
    expect(calls).toEqual([
      { method: 'listOperationalPage', args: ['ar', { limit: 5 }, scopeContext] },
    ]);
  });

  it('GET search 与 legacy 参数叠加时 legacy 参数照旧解析并入参；search 超长 400', async () => {
    const mixed = await dispatchFastifyRouteGroup(
      requestFor({
        query: {
          search: ' demo ',
          state: 'CLEARED',
          limit: '7',
          cursor: itemId,
          query: ' name ',
          from: '2026-01-01',
          to: '2026-02-01',
          minAmount: '1.50',
          maxAmount: '20.000001',
        },
      }),
      scopeFor(repository()),
    );
    expect(mixed?.statusCode).toBe(200);
    expect(calls).toEqual([
      {
        method: 'listArPage',
        args: [
          scopeContext,
          {
            limit: 7,
            cursor: itemId,
            query: 'name',
            from: '2026-01-01T00:00:00.000Z',
            to: '2026-02-01T00:00:00.000Z',
            minAmount: '1.5',
            maxAmount: '20.000001',
            state: 'CLEARED',
            search: 'demo',
          },
          listRead,
        ],
      },
    ]);
    calls.length = 0;
    const tooLong = await dispatchFastifyRouteGroup(
      requestFor({ query: { search: 'x'.repeat(101) } }),
      scopeFor(repository()),
    );
    expect(tooLong?.statusCode).toBe(400);
    expect(errorOf(tooLong).message).toBe('search exceeds 100 characters');
    expect(calls).toEqual([]);
  });

  it('GET summary=1：走 additive 行投影并附带按币种汇总（汇总不随筛选与分页变化）', async () => {
    const response = await dispatchFastifyRouteGroup(
      requestFor({ query: { summary: '1', state: 'OVERDUE', limit: '2' } }),
      scopeFor(repository()),
    );
    expect(response?.statusCode).toBe(200);
    expect(response?.body).toEqual({ items: [additiveRow], nextCursor: null, summary });
    expect(calls).toEqual([
      { method: 'listArPage', args: [scopeContext, { limit: 2, state: 'OVERDUE' }, listRead] },
      { method: 'summarizeAr', args: [scopeContext] },
    ]);
    // 'true' 与 '1' 同义。
    calls.length = 0;
    const truthy = await dispatchFastifyRouteGroup(
      requestFor({ query: { summary: 'true' } }),
      scopeFor(repository()),
    );
    expect(truthy?.body).toEqual({ items: [additiveRow], nextCursor: null, summary });
    expect(calls.map((call) => call.method)).toEqual(['listArPage', 'summarizeAr']);
  });

  it('GET summary 缺省或为空串：不加汇总、仍走旧轨同链；取值不合法 400 且不触达仓储', async () => {
    for (const query of [{}, { summary: '' }]) {
      calls.length = 0;
      const response = await dispatchFastifyRouteGroup(
        requestFor({ query }),
        scopeFor(repository()),
      );
      expect(Object.keys(response?.body ?? {})).toEqual(['items', 'nextCursor']);
      expect(calls.map((call) => call.method)).toEqual(['listOperationalPage']);
    }
    for (const value of ['0', 'false', 'yes', '2']) {
      calls.length = 0;
      const response = await dispatchFastifyRouteGroup(
        requestFor({ query: { summary: value } }),
        scopeFor(repository()),
      );
      expect(response?.statusCode).toBe(400);
      expect(errorOf(response).message).toBe('summary is unsupported');
    }
    expect(calls).toEqual([]);
  });

  it('GET 加性行同样按 ar:read 字段授权裁剪（加性键随顶层 allowlist 一并裁掉）', async () => {
    const response = await dispatchFastifyRouteGroup(
      requestFor({ query: { state: 'NOT_DUE' } }),
      scopeFor(repository(), { fields: ['documentNumber', 'remainingAmount'] }),
    );
    expect(response?.body).toEqual({
      items: [{ id: itemId, documentNumber: 'INV-KT-2026-001', remainingAmount: '850000.500000' }],
      nextCursor: null,
    });
  });

  it('GET 详情：根行 + 销售订单摘要 + 核销分配；404 信封；非 uuid 400', async () => {
    const found = await dispatchFastifyRouteGroup(
      requestFor({ pathname: `/api/v1/ar-open-items/${itemId}` }),
      scopeFor(repository()),
    );
    expect(found?.statusCode).toBe(200);
    expect(found?.body).toEqual(detail);
    expect(calls).toEqual([
      {
        method: 'findArOpenItem',
        args: [itemId, scopeContext, { order: relatedRead, payment: relatedRead }],
      },
    ]);
    const missing = await dispatchFastifyRouteGroup(
      requestFor({ pathname: `/api/v1/ar-open-items/44444444-4444-4444-8444-444444444440` }),
      scopeFor(repository({ findArOpenItem: vi.fn().mockResolvedValue(null) })),
    );
    expect(missing?.statusCode).toBe(404);
    expect(errorOf(missing)).toEqual({
      code: 'not_found',
      message: 'AR open item not found',
      correlationId,
    });
    const malformed = await dispatchFastifyRouteGroup(
      requestFor({ pathname: `/api/v1/ar-open-items/99999999-9999-9999-9999-999999999999` }),
      scopeFor(repository()),
    );
    expect(malformed?.statusCode).toBe(400);
    expect(errorOf(malformed).message).toBe('arOpenItemId must be a UUID');
    expect(calls).toHaveLength(1);
  });

  it('GET 详情门控：无 sales-order:read / bank-payment:read 时 parts 为 false（未授权不查询）', async () => {
    const response = await dispatchFastifyRouteGroup(
      requestFor({ pathname: `/api/v1/ar-open-items/${itemId}` }),
      scopeFor(repository(), { without: ['sales-order:read', 'bank-payment:read'] }),
    );
    expect(response?.statusCode).toBe(200);
    expect(calls).toEqual([
      { method: 'findArOpenItem', args: [itemId, scopeContext, { order: null, payment: null }] },
    ]);
  });

  it('GET 详情字段裁剪：未授权的 order / allocations 键随顶层 allowlist 一并裁掉', async () => {
    const response = await dispatchFastifyRouteGroup(
      requestFor({ pathname: `/api/v1/ar-open-items/${itemId}` }),
      scopeFor(repository(), { fields: ['documentNumber', 'order'] }),
    );
    expect(response?.body).toEqual({
      id: itemId,
      documentNumber: 'INV-KT-2026-001',
      order: detail.order,
    });
  });

  const postBody = {
    customerId,
    salesOrderId: orderId,
    documentNumber: ' fixture #/AR ',
    documentType: ' INVOICE ',
    currency: 'USD',
    amount: '3.00',
    dueAt: '2026-02-28T08:00:00+08:00',
  };
  const postHeaders = { 'x-correlation-id': correlationId, 'idempotency-key': ' raw key ' };

  it('POST 过账：新旧轨响应与仓储实参逐字节一致（trim / uuid / decimal 去尾零 / timestamp；写响应按 ar:read 裁剪）', async () => {
    for (const fields of [null, ['documentNumber', 'remainingAmount']] as const) {
      const authz = scopeFor(repository(), { fields }).authorization;
      const legacyPostMock = tracked('postAr', posted);
      const legacyRepo = repository({ postAr: legacyPostMock });
      const request = requestFor({ method: 'POST', body: postBody, headers: postHeaders });
      const legacy = await legacyPost(legacyRepo, authz, request);
      calls.length = 0;
      const bridged = await dispatchFastifyRouteGroup(request, scopeFor(repository(), { fields }));
      expect(bridged).toEqual(JSON.parse(JSON.stringify(legacy)));
      expect(bridged?.statusCode).toBe(201);
      const expectedCall = [
        {
          customerId,
          salesOrderId: orderId,
          documentNumber: 'fixture #/AR',
          documentType: 'INVOICE',
          currency: 'USD',
          amount: '3',
          dueAt: '2026-02-28T00:00:00.000Z',
        },
        ' raw key ',
        scopeContext,
        correlationId,
      ];
      expect(calls).toEqual([{ method: 'postAr', args: expectedCall }]);
      expect(legacyPostMock.mock.calls).toEqual([expectedCall]);
    }
    // 无读权限时写响应只剩 version 兜底投影（与 legacy mutationDto 同口径）。
    const writeOnly = await dispatchFastifyRouteGroup(
      requestFor({ method: 'POST', body: postBody, headers: postHeaders }),
      scopeFor(repository(), { without: ['ar:read'] }),
    );
    expect(writeOnly?.statusCode).toBe(201);
    expect(writeOnly?.body).toEqual({ id: itemId });
  });

  const badPosts: readonly {
    name: string;
    body: unknown;
    headers?: Record<string, string>;
    message: string;
  }[] = [
    { name: '空对象', body: {}, message: 'documentType is required' },
    { name: '非对象 body', body: null, message: 'A JSON object body is required' },
    { name: '数组 body', body: [], message: 'A JSON object body is required' },
    { name: '未知字段', body: { ...postBody, extra: 1 }, message: 'Unsupported fields: extra' },
    {
      name: 'documentType 不支持',
      body: { ...postBody, documentType: 'DEBIT' },
      message: 'documentType is unsupported',
    },
    {
      name: '缺 customerId',
      body: { ...postBody, customerId: '' },
      message: 'customerId is required',
    },
    {
      name: 'customerId 非 uuid',
      body: { ...postBody, customerId: 'abc' },
      message: 'customerId must be a UUID',
    },
    {
      name: '缺 documentNumber',
      body: { ...postBody, documentNumber: ' ' },
      message: 'documentNumber is required',
    },
    {
      name: 'currency 不合法',
      body: { ...postBody, currency: 'XX' },
      message: 'Currency must be ISO 4217 uppercase',
    },
    { name: 'amount 非数字', body: { ...postBody, amount: 'abc' }, message: 'Invalid decimal' },
    {
      name: 'amount 为负',
      body: { ...postBody, amount: '-1' },
      message: 'amount must be non-negative',
    },
    {
      name: 'dueAt 不合法',
      body: { ...postBody, dueAt: 'bad' },
      message: 'dueAt must be a valid timestamp',
    },
    {
      name: '缺幂等键',
      body: postBody,
      headers: { 'x-correlation-id': correlationId },
      message: 'Idempotency-Key is required',
    },
  ];
  it.each(badPosts)(
    'POST 负例「$name」：新旧轨响应逐字节一致（$message）且不触达仓储',
    async ({ body, headers, message }) => {
      const authz = scopeFor(repository()).authorization;
      const request = requestFor({ method: 'POST', body, headers: headers ?? postHeaders });
      const legacy = await legacyPost(repository(), authz, request);
      calls.length = 0;
      const bridged = await dispatchFastifyRouteGroup(request, scopeFor(repository()));
      expect(bridged).toEqual(JSON.parse(JSON.stringify(legacy)));
      expect(bridged?.statusCode).toBe(400);
      expect(errorOf(bridged).message).toBe(message);
      expect(calls).toEqual([]);
    },
  );

  it('POST 守卫触发器拒绝（P0001，单据与销售订单不一致）映射为 409 + 中文，不回显数据库原文', async () => {
    const rejection = Object.assign(new Error('AR document is inconsistent with its sales order'), {
      code: 'P0001',
    });
    const response = await dispatchFastifyRouteGroup(
      requestFor({ method: 'POST', body: postBody, headers: postHeaders }),
      scopeFor(repository({ postAr: vi.fn().mockRejectedValue(rejection) })),
    );
    expect(response?.statusCode).toBe(409);
    expect(errorOf(response)).toEqual({
      code: 'conflict',
      message: '应收单据与关联销售订单的客户或币种不一致，请核对后重试',
      correlationId,
    });
  });

  it('POST 未列入白名单的数据库拒绝仍是 500（信封不含原始消息）并留诊断日志', async () => {
    const logger = { write: vi.fn() };
    const rejection = Object.assign(new Error('duplicate key value violates unique constraint'), {
      code: '23505',
    });
    const response = await dispatchFastifyRouteGroup(
      requestFor({ method: 'POST', body: postBody, headers: postHeaders }),
      scopeFor(repository({ postAr: vi.fn().mockRejectedValue(rejection) }), { logger }),
    );
    expect(response?.statusCode).toBe(500);
    expect(errorOf(response)).toEqual({
      code: 'internal_error',
      message: 'Internal server error',
      correlationId,
    });
    expect(logger.write).toHaveBeenCalledTimes(1);
    const entry = logger.write.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(entry.event).toBe('http.request.failed');
    expect(entry.statusCode).toBe(500);
    expect(entry.pathname).toBe('/api/v1/ar-open-items');
  });

  it('POST 写字段按 ar:post 字段授权校验（未授权的写键 403，与 legacy 同消息）', async () => {
    const authz = scopeFor(repository(), { writeFields: ['customerId'] }).authorization;
    const request = requestFor({ method: 'POST', body: postBody, headers: postHeaders });
    const legacy = await legacyPost(repository(), authz, request);
    const bridged = await dispatchFastifyRouteGroup(
      request,
      scopeFor(repository(), { writeFields: ['customerId'] }),
    );
    expect(bridged).toEqual(JSON.parse(JSON.stringify(legacy)));
    expect(bridged?.statusCode).toBe(403);
    expect(calls).toEqual([]);
  });

  it('缺读权限 403；缺写权限 403；依赖缺失 503；未认领方法落回 null', async () => {
    const denied = (repositoryOverride: Qtc | null) => ({
      authorization: {
        actor,
        permissions: new Map<PermissionKey, Grant>(),
      } as unknown as AuthorizationContext,
      dependencies: dependencyScope(repositoryOverride),
      correlationId,
    });
    const deniedList = await dispatchFastifyRouteGroup(requestFor(), denied(repository()));
    expect(deniedList?.statusCode).toBe(403);
    expect(errorOf(deniedList).code).toBe('forbidden');
    const deniedDetail = await dispatchFastifyRouteGroup(
      requestFor({ pathname: `/api/v1/ar-open-items/${itemId}` }),
      denied(repository()),
    );
    expect(deniedDetail?.statusCode).toBe(403);
    const deniedPost = await dispatchFastifyRouteGroup(
      requestFor({ method: 'POST', body: postBody, headers: postHeaders }),
      denied(repository()),
    );
    expect(deniedPost?.statusCode).toBe(403);
    for (const request of [
      requestFor(),
      requestFor({ pathname: `/api/v1/ar-open-items/${itemId}` }),
      requestFor({ method: 'POST', body: postBody, headers: postHeaders }),
    ]) {
      const unavailable = await dispatchFastifyRouteGroup(request, scopeFor(null));
      expect(unavailable?.statusCode).toBe(503);
      expect(errorOf(unavailable).code).toBe('internal_error');
    }
    for (const request of [
      requestFor({ method: 'PUT', body: postBody, headers: postHeaders }),
      requestFor({ method: 'DELETE' }),
      requestFor({ method: 'POST', pathname: `/api/v1/ar-open-items/${itemId}` }),
      requestFor({ pathname: '/api/v1/ar-open-items/' }),
    ])
      expect(await dispatchFastifyRouteGroup(request, scopeFor(repository()))).toBeNull();
    expect(calls).toEqual([]);
  });
});
