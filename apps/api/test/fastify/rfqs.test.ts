import { afterEach, describe, expect, it, vi } from 'vitest';
import { DomainError, type AuthorizationContext } from '@kingturf/domain';
import type { ApiRequest } from '../../src/api-types.ts';
import type { ApiDependencies } from '../../src/app.ts';
import { dispatchFastifyRouteGroup } from '../../src/routes/fastify/registry.ts';

// U3-PROC-2：procurement-rfqs Fastify 组契约测试——GET 列表（无参数与 legacy 全量
// { items } 逐字节一致；status 筛选透传；400 枚举负例）、GET 详情（additive 只读含
// 行项+报价对比，404 信封，非 uuid 400）、POST 创建（legacy 同解析链：lines 逐行
// 解析/空数组拒绝/stableCode/timestamp/currency/issue 布尔，消息逐字一致）、PUT
// state（issue 分派 legacy issueRfq；close 走 additive closeRfq；未知 action 400、
// 非 uuid 400、无 procurement:manage 403）、DomainError 映射与依赖缺失 503。
const rfq = {
  id: '55555555-5555-4555-8555-555555555555',
  tenant_id: '11111111-1111-4111-8111-111111111111',
  rfq_number: 'RFQ-KT-YARN-2026-001',
  status: 'ISSUED',
  response_due_at: '2026-11-30T23:59:59.000Z',
  currency: 'CNY',
  issued_at: '2026-11-05T00:00:00.000Z',
  created_at: '2026-11-01T00:00:00.000Z',
  lines: [
    {
      id: 'line-1',
      line_number: 1,
      item_version_id: '66666666-6666-4666-8666-666666666666',
      quantity: '6000',
      required_at: '2026-12-15',
      sku: 'RM-KT-YARN-12000',
      itemName: '草纱',
    },
  ],
};
const rfqDetail = {
  ...rfq,
  quotes: [
    {
      id: 'q-1',
      quote_reference: 'SQ-KT-YARN-2026-001',
      supplierName: '青岛金特夫草纱战略供应商',
      received_at: '2026-11-10T00:00:00.000Z',
      valid_until: '2026-12-31',
      lines: [
        {
          id: 'ql-1',
          lineNumber: 1,
          sku: 'RM-KT-YARN-12000',
          unit_price: '12.5',
          promised_at: '2026-12-10',
          minimum_order_quantity: '1000',
        },
      ],
    },
  ],
};

const repositoryCalls: { method: string; args: unknown[] }[] = [];

const repository = (
  overrides: {
    listRfqs?: ReturnType<typeof vi.fn>;
    findRfq?: ReturnType<typeof vi.fn>;
    createRfq?: ReturnType<typeof vi.fn>;
    issueRfq?: ReturnType<typeof vi.fn>;
    closeRfq?: ReturnType<typeof vi.fn>;
  } = {},
) =>
  ({
    listRfqs:
      overrides.listRfqs ??
      vi.fn((...args: unknown[]) => {
        repositoryCalls.push({ method: 'listRfqs', args });
        return Promise.resolve({ items: [rfq], nextCursor: null });
      }),
    findRfq:
      overrides.findRfq ??
      vi.fn((...args: unknown[]) => {
        repositoryCalls.push({ method: 'findRfq', args });
        return Promise.resolve(rfqDetail);
      }),
    createRfq:
      overrides.createRfq ??
      vi.fn((...args: unknown[]) => {
        repositoryCalls.push({ method: 'createRfq', args });
        return Promise.resolve({ id: rfq.id, status: 'ISSUED', issue: true });
      }),
    issueRfq:
      overrides.issueRfq ??
      vi.fn((...args: unknown[]) => {
        repositoryCalls.push({ method: 'issueRfq', args });
        return Promise.resolve({ id: rfq.id, status: 'ISSUED' });
      }),
    closeRfq:
      overrides.closeRfq ??
      vi.fn((...args: unknown[]) => {
        repositoryCalls.push({ method: 'closeRfq', args });
        return Promise.resolve({ id: rfq.id, status: 'CANCELLED' });
      }),
  }) as unknown as NonNullable<ApiDependencies['procurement']>;

const scopeFor = (
  repo: NonNullable<ApiDependencies['procurement']> | null = repository(),
  readFields: readonly string[] | null = null,
) => ({
  authorization: {
    actor: { companyId: '11111111-1111-4111-8111-111111111111', employeeId: 'e-1' },
    permissions: new Map([
      ['procurement:read', { scopes: ['COMPANY'], fields: readFields }],
      ['procurement:manage', { scopes: ['COMPANY'], fields: null }],
    ]),
  } as unknown as AuthorizationContext,
  // commercial 桩：registry 全组注册要求 commercial 非空（生产装配恒有）。
  dependencies: {
    procurement: repo,
    commercial: repository(),
  } as unknown as ApiDependencies,
  correlationId: 'corr-1',
});

const requestFor = (
  overrides: Partial<ApiRequest> & { pathname?: string; body?: unknown; query?: unknown } = {},
): ApiRequest => ({
  method: 'GET',
  pathname: '/api/v1/procurement-rfqs',
  headers: { 'x-correlation-id': 'corr-1' },
  ...overrides,
});

afterEach(() => {
  repositoryCalls.length = 0;
});

describe('procurement-rfqs fastify bridge track', () => {
  it('GET 列表默认全量：过滤对象为空且响应与 legacy { items } 逐字节一致（无多余键）', async () => {
    const response = await dispatchFastifyRouteGroup(requestFor(), scopeFor());
    expect(response?.statusCode).toBe(200);
    expect(response?.body).toEqual({ items: [rfq] });
    expect(Object.keys(response?.body ?? {})).toEqual(['items']);
    expect(repositoryCalls[0]?.args[1]).toEqual({});
  });

  it('GET 列表 status 筛选透传；非法枚举 400', async () => {
    const response = await dispatchFastifyRouteGroup(
      requestFor({ query: { status: 'ISSUED' } }),
      scopeFor(),
    );
    expect(response?.statusCode).toBe(200);
    expect(repositoryCalls[0]?.args[1]).toEqual({ status: 'ISSUED' });
    const invalid = await dispatchFastifyRouteGroup(
      requestFor({ query: { status: 'BOGUS' } }),
      scopeFor(),
    );
    expect(invalid?.statusCode).toBe(400);
    expect((invalid?.body as { error: { code: string } }).error.code).toBe('invalid_request');
  });

  it('GET 列表字段裁剪（procurement:read allowlist）裁掉未授权键', async () => {
    const response = await dispatchFastifyRouteGroup(
      requestFor(),
      scopeFor(repository(), ['rfq_number']),
    );
    const items = (response?.body as { items: Record<string, unknown>[] }).items;
    expect(items[0]).toEqual({ id: rfq.id, rfq_number: rfq.rfq_number });
  });

  it('GET 详情命中返回行项+报价对比；未命中映射 not_found 信封；非 uuid 参数 400', async () => {
    const found = await dispatchFastifyRouteGroup(
      requestFor({ pathname: `/api/v1/procurement-rfqs/${rfq.id}` }),
      scopeFor(),
    );
    expect(found?.statusCode).toBe(200);
    expect(found?.body).toEqual(rfqDetail);
    expect(repositoryCalls[0]?.args[0]).toBe(rfq.id);
    const missing = await dispatchFastifyRouteGroup(
      requestFor({ pathname: '/api/v1/procurement-rfqs/55555555-5555-4555-8555-555555555554' }),
      scopeFor(repository({ findRfq: vi.fn().mockResolvedValue(null) })),
    );
    expect(missing?.statusCode).toBe(404);
    expect((missing?.body as { error: { code: string; message: string } }).error).toMatchObject({
      code: 'not_found',
      message: 'RFQ not found',
    });
    const malformed = await dispatchFastifyRouteGroup(
      requestFor({ pathname: '/api/v1/procurement-rfqs/99999999-9999-9999-9999-999999999999' }),
      scopeFor(),
    );
    expect(malformed?.statusCode).toBe(400);
    expect((malformed?.body as { error: { message: string } }).error.message).toBe(
      'rfqId must be a UUID',
    );
  });

  it('POST 创建走 legacy 同解析链（lines 逐行解析/stableCode/timestamp/currency/issue）→ 201', async () => {
    const response = await dispatchFastifyRouteGroup(
      requestFor({
        method: 'POST',
        body: {
          rfqNumber: ' RFQ-KT-YARN-2026-002 ',
          responseDueAt: '2026-12-01T23:59:59.000Z',
          currency: 'CNY',
          issue: true,
          lines: [
            {
              itemVersionId: '66666666-6666-4666-8666-666666666666',
              quantity: '6000',
              requiredAt: '2026-12-15',
            },
          ],
        },
      }),
      scopeFor(),
    );
    expect(response?.statusCode).toBe(201);
    const call = repositoryCalls[0];
    expect(call?.method).toBe('createRfq');
    expect(call?.args[0]).toEqual({
      rfqNumber: 'RFQ-KT-YARN-2026-002',
      responseDueAt: '2026-12-01T23:59:59.000Z',
      currency: 'CNY',
      lines: [
        {
          itemVersionId: '66666666-6666-4666-8666-666666666666',
          quantity: '6000',
          requiredAt: '2026-12-15',
        },
      ],
      issue: true,
    });
    expect(call?.args[1]).toEqual({
      actor: { companyId: '11111111-1111-4111-8111-111111111111', employeeId: 'e-1' },
      scopes: ['COMPANY'],
      anchors: [],
    });
    expect(call?.args[2]).toBe('corr-1');
  });

  it('POST 负例沿用 legacy 消息（lines 类型/空数组/行未知字段/行标量/编号/截止/币种）', async () => {
    const base = {
      rfqNumber: 'RFQ-KT-YARN-2026-002',
      responseDueAt: '2026-12-01T23:59:59.000Z',
      currency: 'CNY',
      lines: [
        {
          itemVersionId: '66666666-6666-4666-8666-666666666666',
          quantity: '6000',
          requiredAt: '2026-12-15',
        },
      ],
    };
    for (const [body, message] of [
      [{ ...base, unexpected: 1 }, 'Unsupported fields: unexpected'],
      [{ ...base, lines: 'nope' }, 'lines must be an array'],
      [{ ...base, lines: [] }, 'lines must not be empty'],
      [
        {
          ...base,
          lines: [
            {
              itemVersionId: '66666666-6666-4666-8666-666666666666',
              quantity: '6000',
              requiredAt: '2026-12-15',
              extra: 1,
            },
          ],
        },
        'Unsupported fields: extra',
      ],
      [
        { ...base, lines: [{ itemVersionId: 'bad', quantity: '6000', requiredAt: '2026-12-15' }] },
        'itemVersionId must be a UUID',
      ],
      [
        {
          ...base,
          lines: [
            {
              itemVersionId: '66666666-6666-4666-8666-666666666666',
              quantity: '6000',
              requiredAt: 'not-a-date',
            },
          ],
        },
        'requiredAt must be a valid YYYY-MM-DD date',
      ],
      [
        { ...base, rfqNumber: 'rfq-lower' },
        'Code must be 1-64 uppercase letters, digits, underscore, or hyphen',
      ],
      [{ ...base, responseDueAt: 'not-a-timestamp' }, 'responseDueAt must be a valid timestamp'],
      [{ ...base, currency: 'cny' }, 'Currency must be ISO 4217 uppercase'],
    ] as const) {
      const response = await dispatchFastifyRouteGroup(
        requestFor({ method: 'POST', body }),
        scopeFor(),
      );
      expect(response?.statusCode).toBe(400);
      expect((response?.body as { error: { message: string } }).error.message).toBe(message);
    }
    expect(repositoryCalls).toHaveLength(0);
  });

  it('PUT state：issue 分派 legacy issueRfq 同链 → 200', async () => {
    const response = await dispatchFastifyRouteGroup(
      requestFor({
        method: 'PUT',
        pathname: `/api/v1/procurement-rfqs/${rfq.id}/state`,
        body: { action: 'issue' },
      }),
      scopeFor(),
    );
    expect(response?.statusCode).toBe(200);
    expect(response?.body).toEqual({ id: rfq.id, status: 'ISSUED' });
    const call = repositoryCalls[0];
    expect(call?.method).toBe('issueRfq');
    expect(call?.args[0]).toBe(rfq.id);
    expect(call?.args[1]).toEqual({
      actor: { companyId: '11111111-1111-4111-8111-111111111111', employeeId: 'e-1' },
      scopes: ['COMPANY'],
      anchors: [],
    });
    expect(call?.args[2]).toBe('corr-1');
  });

  it('PUT state：close 分派 additive closeRfq（DRAFT/ISSUED → CANCELLED）→ 200', async () => {
    const response = await dispatchFastifyRouteGroup(
      requestFor({
        method: 'PUT',
        pathname: `/api/v1/procurement-rfqs/${rfq.id}/state`,
        body: { action: 'close' },
      }),
      scopeFor(),
    );
    expect(response?.statusCode).toBe(200);
    expect(response?.body).toEqual({ id: rfq.id, status: 'CANCELLED' });
    const call = repositoryCalls[0];
    expect(call?.method).toBe('closeRfq');
    expect(call?.args[0]).toBe(rfq.id);
  });

  it('PUT state 负例：未知 action 400、无 procurement:manage 403', async () => {
    const unknownAction = await dispatchFastifyRouteGroup(
      requestFor({
        method: 'PUT',
        pathname: `/api/v1/procurement-rfqs/${rfq.id}/state`,
        body: { action: 'pause' },
      }),
      scopeFor(),
    );
    expect(unknownAction?.statusCode).toBe(400);
    expect((unknownAction?.body as { error: { message: string } }).error.message).toBe(
      'action must be issue or close',
    );
    const denied = {
      authorization: {
        actor: { companyId: '11111111-1111-4111-8111-111111111111', employeeId: 'e-1' },
        permissions: new Map([['procurement:read', { scopes: ['COMPANY'], fields: null }]]),
      } as unknown as AuthorizationContext,
      dependencies: {
        procurement: repository(),
        commercial: repository(),
      } as unknown as ApiDependencies,
      correlationId: 'corr-1',
    };
    const forbidden = await dispatchFastifyRouteGroup(
      requestFor({
        method: 'PUT',
        pathname: `/api/v1/procurement-rfqs/${rfq.id}/state`,
        body: { action: 'issue' },
      }),
      denied,
    );
    expect(forbidden?.statusCode).toBe(403);
    expect((forbidden?.body as { error: { code: string } }).error.code).toBe('forbidden');
  });

  it('仓储 DomainError 映射 legacy 状态码；依赖缺失 503', async () => {
    const conflict = await dispatchFastifyRouteGroup(
      requestFor({
        method: 'PUT',
        pathname: `/api/v1/procurement-rfqs/${rfq.id}/state`,
        body: { action: 'issue' },
      }),
      scopeFor(
        repository({
          issueRfq: vi.fn().mockRejectedValue(new DomainError('not_found', 'Draft rfq not found')),
        }),
      ),
    );
    expect(conflict?.statusCode).toBe(404);
    expect((conflict?.body as { error: { code: string } }).error.code).toBe('not_found');
    const unavailable = await dispatchFastifyRouteGroup(requestFor(), scopeFor(null));
    expect(unavailable?.statusCode).toBe(503);
  });
});
