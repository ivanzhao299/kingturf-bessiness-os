import { afterEach, describe, expect, it, vi } from 'vitest';
import { DomainError, type AuthorizationContext } from '@kingturf/domain';
import type { ApiRequest } from '../../src/api-types.ts';
import type { ApiDependencies } from '../../src/app.ts';
import { dispatchFastifyRouteGroup } from '../../src/routes/fastify/registry.ts';

// U3-PROC-3：purchase-orders Fastify 组契约测试——GET 列表（无参数与 legacy 全量
// { items } 逐字节一致；status 筛选透传；400 枚举负例）、GET 详情（additive 只读含
// 行项收货状态+关联收货单，404 信封，非 uuid 400）、POST 创建（legacy 同解析链：
// lines 逐行四字段/空数组拒绝/stableCode/supplierQuoteId 可空/issue 布尔，消息逐字
// 一致）、PUT state（issue 分派 legacy issuePurchaseOrder；cancel 走 additive
// cancelPurchaseOrder；未知 action 400、无 procurement:manage 403）、DomainError
// 映射与依赖缺失 503。
const order = {
  id: '77777777-7777-4777-8777-777777777777',
  tenant_id: '11111111-1111-4111-8111-111111111111',
  po_number: 'PO-KT-YARN-2026-001',
  status: 'RECEIVED',
  currency: 'CNY',
  supplierName: '青岛金特夫草纱战略供应商',
  supplier_id: '44444444-4444-4444-8444-444444444444',
  supplier_quote_id: null,
  ordered_at: '2026-11-06T00:00:00.000Z',
  created_at: '2026-11-05T00:00:00.000Z',
  lines: [
    {
      id: 'line-1',
      line_number: 1,
      item_version_id: '66666666-6666-4666-8666-666666666666',
      quantity: '5000',
      unit_price: '12.5',
      required_at: '2026-12-10',
      sku: 'RM-KT-YARN-12000',
      itemName: '草纱',
      receivedQuantity: 5000,
    },
  ],
};
const orderDetail = {
  ...order,
  receipts: [
    {
      id: 'gr-1',
      receipt_number: 'GR-KT-YARN-2026-001',
      received_at: '2026-11-08T00:00:00.000Z',
      source_reference: 'delivery-001',
      lines: [
        {
          id: 'grl-1',
          lotNumber: 'LOT-KT-YARN-20260920-A',
          locationCode: 'RAW-A01',
          sku: 'RM-KT-YARN-12000',
          quantity: '5000',
        },
      ],
    },
  ],
};

const repositoryCalls: { method: string; args: unknown[] }[] = [];

const repository = (
  overrides: {
    listPurchaseOrders?: ReturnType<typeof vi.fn>;
    findPurchaseOrder?: ReturnType<typeof vi.fn>;
    createPurchaseOrder?: ReturnType<typeof vi.fn>;
    issuePurchaseOrder?: ReturnType<typeof vi.fn>;
    cancelPurchaseOrder?: ReturnType<typeof vi.fn>;
  } = {},
) =>
  ({
    listPurchaseOrders:
      overrides.listPurchaseOrders ??
      vi.fn((...args: unknown[]) => {
        repositoryCalls.push({ method: 'listPurchaseOrders', args });
        return Promise.resolve({ items: [order], nextCursor: null });
      }),
    findPurchaseOrder:
      overrides.findPurchaseOrder ??
      vi.fn((...args: unknown[]) => {
        repositoryCalls.push({ method: 'findPurchaseOrder', args });
        return Promise.resolve(orderDetail);
      }),
    createPurchaseOrder:
      overrides.createPurchaseOrder ??
      vi.fn((...args: unknown[]) => {
        repositoryCalls.push({ method: 'createPurchaseOrder', args });
        return Promise.resolve({ id: order.id, canonicalHash: 'a'.repeat(64), issue: true });
      }),
    issuePurchaseOrder:
      overrides.issuePurchaseOrder ??
      vi.fn((...args: unknown[]) => {
        repositoryCalls.push({ method: 'issuePurchaseOrder', args });
        return Promise.resolve({ id: order.id, status: 'ISSUED' });
      }),
    cancelPurchaseOrder:
      overrides.cancelPurchaseOrder ??
      vi.fn((...args: unknown[]) => {
        repositoryCalls.push({ method: 'cancelPurchaseOrder', args });
        return Promise.resolve({ id: order.id, status: 'CANCELLED' });
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
  pathname: '/api/v1/purchase-orders',
  headers: { 'x-correlation-id': 'corr-1' },
  ...overrides,
});

afterEach(() => {
  repositoryCalls.length = 0;
});

describe('purchase-orders fastify bridge track', () => {
  it('GET 列表默认全量：过滤对象为空且响应与 legacy { items } 逐字节一致（无多余键）', async () => {
    const response = await dispatchFastifyRouteGroup(requestFor(), scopeFor());
    expect(response?.statusCode).toBe(200);
    expect(response?.body).toEqual({ items: [order] });
    expect(Object.keys(response?.body ?? {})).toEqual(['items']);
    expect(repositoryCalls[0]?.args[1]).toEqual({});
  });

  it('GET 列表 status 筛选透传；非法枚举 400；字段裁剪生效', async () => {
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
    const cropped = await dispatchFastifyRouteGroup(
      requestFor(),
      scopeFor(repository(), ['po_number']),
    );
    expect((cropped?.body as { items: Record<string, unknown>[] }).items[0]).toEqual({
      id: order.id,
      po_number: order.po_number,
    });
  });

  it('GET 详情命中返回行项收货状态+收货单；未命中 404 信封；非 uuid 400', async () => {
    const found = await dispatchFastifyRouteGroup(
      requestFor({ pathname: `/api/v1/purchase-orders/${order.id}` }),
      scopeFor(),
    );
    expect(found?.statusCode).toBe(200);
    expect(found?.body).toEqual(orderDetail);
    expect(repositoryCalls[0]?.args[0]).toBe(order.id);
    const missing = await dispatchFastifyRouteGroup(
      requestFor({ pathname: '/api/v1/purchase-orders/77777777-7777-4777-8777-777777777776' }),
      scopeFor(repository({ findPurchaseOrder: vi.fn().mockResolvedValue(null) })),
    );
    expect(missing?.statusCode).toBe(404);
    expect((missing?.body as { error: { code: string; message: string } }).error).toMatchObject({
      code: 'not_found',
      message: 'Purchase order not found',
    });
    const malformed = await dispatchFastifyRouteGroup(
      requestFor({ pathname: '/api/v1/purchase-orders/99999999-9999-9999-9999-999999999999' }),
      scopeFor(),
    );
    expect(malformed?.statusCode).toBe(400);
    expect((malformed?.body as { error: { message: string } }).error.message).toBe(
      'orderId must be a UUID',
    );
  });

  it('POST 创建走 legacy 同解析链（行四字段/supplierQuoteId 可空/issue）→ 201', async () => {
    const response = await dispatchFastifyRouteGroup(
      requestFor({
        method: 'POST',
        body: {
          poNumber: ' PO-KT-YARN-2026-002 ',
          supplierId: '44444444-4444-4444-8444-444444444444',
          supplierQuoteId: null,
          currency: 'CNY',
          issue: true,
          lines: [
            {
              itemVersionId: '66666666-6666-4666-8666-666666666666',
              quantity: '5000',
              unitPrice: '12.5',
              requiredAt: '2026-12-10',
            },
          ],
        },
      }),
      scopeFor(),
    );
    expect(response?.statusCode).toBe(201);
    const call = repositoryCalls[0];
    expect(call?.method).toBe('createPurchaseOrder');
    expect(call?.args[0]).toEqual({
      poNumber: 'PO-KT-YARN-2026-002',
      supplierId: '44444444-4444-4444-8444-444444444444',
      supplierQuoteId: null,
      currency: 'CNY',
      lines: [
        {
          itemVersionId: '66666666-6666-4666-8666-666666666666',
          quantity: '5000',
          unitPrice: '12.5',
          requiredAt: '2026-12-10',
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

  it('POST 负例沿用 legacy 消息（lines 类型/空数组/行未知字段/行标量/编号/供应商标识）', async () => {
    const base = {
      poNumber: 'PO-KT-YARN-2026-002',
      supplierId: '44444444-4444-4444-8444-444444444444',
      supplierQuoteId: null,
      currency: 'CNY',
      lines: [
        {
          itemVersionId: '66666666-6666-4666-8666-666666666666',
          quantity: '5000',
          unitPrice: '12.5',
          requiredAt: '2026-12-10',
        },
      ],
    };
    for (const [body, message] of [
      [{ ...base, unexpected: 1 }, 'Unsupported fields: unexpected'],
      [{ ...base, lines: 'nope' }, 'lines must be an array'],
      [{ ...base, lines: [] }, 'lines must not be empty'],
      [{ ...base, lines: [{ ...base.lines[0], extra: 1 }] }, 'Unsupported fields: extra'],
      [{ ...base, lines: [{ ...base.lines[0], unitPrice: 'free' }] }, 'Invalid decimal'],
      [
        { ...base, lines: [{ ...base.lines[0], unitPrice: '-1' }] },
        'unitPrice must be non-negative',
      ],
      [
        { ...base, lines: [{ ...base.lines[0], requiredAt: 'soon' }] },
        'requiredAt must be a valid YYYY-MM-DD date',
      ],
      [
        { ...base, poNumber: 'po-lower' },
        'Code must be 1-64 uppercase letters, digits, underscore, or hyphen',
      ],
      [{ ...base, supplierId: 'supplier-1' }, 'supplierId must be a UUID'],
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

  it('PUT state：issue 分派 legacy issuePurchaseOrder 同链 → 200', async () => {
    const response = await dispatchFastifyRouteGroup(
      requestFor({
        method: 'PUT',
        pathname: `/api/v1/purchase-orders/${order.id}/state`,
        body: { action: 'issue' },
      }),
      scopeFor(),
    );
    expect(response?.statusCode).toBe(200);
    expect(response?.body).toEqual({ id: order.id, status: 'ISSUED' });
    const call = repositoryCalls[0];
    expect(call?.method).toBe('issuePurchaseOrder');
    expect(call?.args[0]).toBe(order.id);
    expect(call?.args[1]).toEqual({
      actor: { companyId: '11111111-1111-4111-8111-111111111111', employeeId: 'e-1' },
      scopes: ['COMPANY'],
      anchors: [],
    });
    expect(call?.args[2]).toBe('corr-1');
  });

  it('PUT state：cancel 分派 additive cancelPurchaseOrder → 200', async () => {
    const response = await dispatchFastifyRouteGroup(
      requestFor({
        method: 'PUT',
        pathname: `/api/v1/purchase-orders/${order.id}/state`,
        body: { action: 'cancel' },
      }),
      scopeFor(),
    );
    expect(response?.statusCode).toBe(200);
    expect(response?.body).toEqual({ id: order.id, status: 'CANCELLED' });
    const call = repositoryCalls[0];
    expect(call?.method).toBe('cancelPurchaseOrder');
    expect(call?.args[0]).toBe(order.id);
  });

  it('TD-PROC-015 maps only known state guards and purchase_orders_check to Chinese 409', async () => {
    for (const failure of [
      { code: 'P0001', message: 'closed purchase order is immutable' },
      { code: '23514', constraint: 'purchase_orders_check', message: 'private database values' },
    ]) {
      const response = await dispatchFastifyRouteGroup(
        requestFor({
          method: 'PUT',
          pathname: `/api/v1/purchase-orders/${order.id}/state`,
          body: { action: 'cancel' },
        }),
        scopeFor(repository({ cancelPurchaseOrder: vi.fn().mockRejectedValue(failure) })),
      );
      expect(response?.statusCode).toBe(409);
      expect(JSON.stringify(response?.body)).not.toContain(failure.message);
      expect((response?.body as { error: { message: string } }).error.message).toMatch(/采购/u);
    }
    for (const failure of [
      { code: 'P0001', message: 'unknown guard' },
      { code: '23514', constraint: 'another_check' },
      { code: '23505', constraint: 'purchase_orders_check' },
    ]) {
      const response = await dispatchFastifyRouteGroup(
        requestFor({
          method: 'PUT',
          pathname: `/api/v1/purchase-orders/${order.id}/state`,
          body: { action: 'cancel' },
        }),
        scopeFor(repository({ cancelPurchaseOrder: vi.fn().mockRejectedValue(failure) })),
      );
      expect(response?.statusCode).toBe(500);
    }
    const read = await dispatchFastifyRouteGroup(
      requestFor(),
      scopeFor(
        repository({
          listPurchaseOrders: vi
            .fn()
            .mockRejectedValue({ code: '23514', constraint: 'purchase_orders_check' }),
        }),
      ),
    );
    expect(read?.statusCode).toBe(500);
  });

  // TD-API-004：未预期异常此前被错误处理器直接丢弃（5xx 无任何可诊断记录）。
  it('未预期异常：500 internal_error 信封不含细节，异常本身记入 http.request.failed', async () => {
    const write = vi.fn();
    const base = scopeFor();
    const response = await dispatchFastifyRouteGroup(requestFor({ query: { status: 'ISSUED' } }), {
      ...base,
      dependencies: {
        ...(base.dependencies as object),
        procurement: repository({
          listPurchaseOrders: vi.fn().mockRejectedValue(new Error('relation is gone')),
        }),
        logger: { write },
      } as unknown as ApiDependencies,
      correlationId: 'corr-7',
    });
    expect(response?.statusCode).toBe(500);
    expect(response?.body).toEqual({
      error: { code: 'internal_error', message: 'Internal server error', correlationId: 'corr-7' },
    });
    expect(write).toHaveBeenCalledTimes(1);
    // 异常消息不进日志（可能回显请求数据）。
    expect(JSON.stringify(write.mock.calls)).not.toContain('relation is gone');
    expect(write.mock.calls[0]?.[0]).toMatchObject({
      level: 'error',
      event: 'http.request.failed',
      correlationId: 'corr-7',
      statusCode: 500,
      method: 'GET',
      // 查询串不进日志路径。
      pathname: '/api/v1/purchase-orders',
      error: { name: 'Error' },
    });
  });

  it('PUT state 负例：未知 action 400、无 procurement:manage 403', async () => {
    const unknownAction = await dispatchFastifyRouteGroup(
      requestFor({
        method: 'PUT',
        pathname: `/api/v1/purchase-orders/${order.id}/state`,
        body: { action: 'approve' },
      }),
      scopeFor(),
    );
    expect(unknownAction?.statusCode).toBe(400);
    expect((unknownAction?.body as { error: { message: string } }).error.message).toBe(
      'action must be issue or cancel',
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
        pathname: `/api/v1/purchase-orders/${order.id}/state`,
        body: { action: 'issue' },
      }),
      denied,
    );
    expect(forbidden?.statusCode).toBe(403);
    expect((forbidden?.body as { error: { code: string } }).error.code).toBe('forbidden');
  });

  it('仓储 DomainError 映射 legacy 状态码；依赖缺失 503', async () => {
    const notFound = await dispatchFastifyRouteGroup(
      requestFor({
        method: 'PUT',
        pathname: `/api/v1/purchase-orders/${order.id}/state`,
        body: { action: 'issue' },
      }),
      scopeFor(
        repository({
          issuePurchaseOrder: vi
            .fn()
            .mockRejectedValue(new DomainError('not_found', 'Draft purchase-order not found')),
        }),
      ),
    );
    expect(notFound?.statusCode).toBe(404);
    expect((notFound?.body as { error: { code: string } }).error.code).toBe('not_found');
    const unavailable = await dispatchFastifyRouteGroup(requestFor(), scopeFor(null));
    expect(unavailable?.statusCode).toBe(503);
  });
});
