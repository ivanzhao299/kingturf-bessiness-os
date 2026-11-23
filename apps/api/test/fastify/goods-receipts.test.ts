import { afterEach, describe, expect, it, vi } from 'vitest';
import { DomainError, type AuthorizationContext } from '@kingturf/domain';
import type { ApiRequest } from '../../src/api-types.ts';
import type { ApiDependencies } from '../../src/app.ts';
import { dispatchFastifyRouteGroup } from '../../src/routes/fastify/registry.ts';

// U3-PROC-4：goods-receipts Fastify 组契约测试——GET 列表（与 legacy 全量 { items }
// 逐字节一致）、GET 详情（additive 只读：根行+批次行项+关联采购单数量核对，404 信
// 封，非 uuid 400）、POST 创建（legacy 同解析链：lines 逐行六字段/lotNumber 与
// locationCode stableCode/manufacturedAt 与 expiresAt Object.hasOwn 缺键=null/空数组
// 拒绝，消息逐字一致；部分收货/超收守护全在 legacy receive() 同链——收货单不可变无
// 状态流转端点）、DomainError conflict 映射 409 与依赖缺失 503。
const receipt = {
  id: '88888888-8888-4888-8888-888888888888',
  tenant_id: '11111111-1111-4111-8111-111111111111',
  receipt_number: 'GR-KT-YARN-2026-001',
  purchase_order_id: '77777777-7777-4777-8777-777777777777',
  poNumber: 'PO-KT-YARN-2026-001',
  received_at: '2026-11-08T00:00:00.000Z',
  source_reference: 'delivery-001',
  created_at: '2026-11-08T00:00:00.000Z',
  lines: [
    {
      id: 'grl-1',
      purchase_order_line_id: 'line-1',
      lot_id: 'lot-1',
      location_id: 'loc-1',
      quantity: '5000',
      lotNumber: 'LOT-KT-YARN-A',
      locationCode: 'RAW-A01',
      sku: 'RM-YARN',
    },
  ],
};
const receiptDetail = {
  ...receipt,
  poStatus: 'RECEIVED',
  purchaseOrder: {
    id: receipt.purchase_order_id,
    poNumber: receipt.poNumber,
    status: 'RECEIVED',
    lines: [
      {
        id: 'line-1',
        sku: 'RM-YARN',
        itemName: '草纱',
        quantity: '5000',
        receivedQuantity: 5000,
      },
    ],
  },
};

const repositoryCalls: { method: string; args: unknown[] }[] = [];

const repository = (
  overrides: {
    listGoodsReceipts?: ReturnType<typeof vi.fn>;
    findGoodsReceipt?: ReturnType<typeof vi.fn>;
    receive?: ReturnType<typeof vi.fn>;
  } = {},
) =>
  ({
    listGoodsReceipts:
      overrides.listGoodsReceipts ??
      vi.fn((...args: unknown[]) => {
        repositoryCalls.push({ method: 'listGoodsReceipts', args });
        return Promise.resolve({ items: [receipt], nextCursor: null });
      }),
    findGoodsReceipt:
      overrides.findGoodsReceipt ??
      vi.fn((...args: unknown[]) => {
        repositoryCalls.push({ method: 'findGoodsReceipt', args });
        return Promise.resolve(receiptDetail);
      }),
    receive:
      overrides.receive ??
      vi.fn((...args: unknown[]) => {
        repositoryCalls.push({ method: 'receive', args });
        return Promise.resolve({
          id: receipt.id,
          status: 'RECEIVED',
          canonicalHash: 'b'.repeat(64),
        });
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
  overrides: Partial<ApiRequest> & { pathname?: string; body?: unknown } = {},
): ApiRequest => ({
  method: 'GET',
  pathname: '/api/v1/goods-receipts',
  headers: { 'x-correlation-id': 'corr-1' },
  ...overrides,
});

afterEach(() => {
  repositoryCalls.length = 0;
});

describe('goods-receipts fastify bridge track', () => {
  it('GET 列表：响应与 legacy { items } 逐字节一致（无多余键）；字段裁剪生效', async () => {
    const response = await dispatchFastifyRouteGroup(requestFor(), scopeFor());
    expect(response?.statusCode).toBe(200);
    expect(response?.body).toEqual({ items: [receipt] });
    expect(Object.keys(response?.body ?? {})).toEqual(['items']);
    const cropped = await dispatchFastifyRouteGroup(
      requestFor(),
      scopeFor(repository(), ['receipt_number']),
    );
    expect((cropped?.body as { items: Record<string, unknown>[] }).items[0]).toEqual({
      id: receipt.id,
      receipt_number: receipt.receipt_number,
    });
  });

  it('GET 详情命中返回批次行项+采购单数量核对；未命中 404 信封；非 uuid 400', async () => {
    const found = await dispatchFastifyRouteGroup(
      requestFor({ pathname: `/api/v1/goods-receipts/${receipt.id}` }),
      scopeFor(),
    );
    expect(found?.statusCode).toBe(200);
    expect(found?.body).toEqual(receiptDetail);
    expect(repositoryCalls[0]?.args[0]).toBe(receipt.id);
    const missing = await dispatchFastifyRouteGroup(
      requestFor({ pathname: '/api/v1/goods-receipts/88888888-8888-4888-8888-888888888887' }),
      scopeFor(repository({ findGoodsReceipt: vi.fn().mockResolvedValue(null) })),
    );
    expect(missing?.statusCode).toBe(404);
    expect((missing?.body as { error: { code: string; message: string } }).error).toMatchObject({
      code: 'not_found',
      message: 'Goods receipt not found',
    });
    const malformed = await dispatchFastifyRouteGroup(
      requestFor({ pathname: '/api/v1/goods-receipts/99999999-9999-9999-9999-999999999999' }),
      scopeFor(),
    );
    expect(malformed?.statusCode).toBe(400);
    expect((malformed?.body as { error: { message: string } }).error.message).toBe(
      'receiptId must be a UUID',
    );
  });

  it('POST 创建走 legacy 同解析链（行六字段/stableCode/hasOwn 日期缺键 null）→ 201', async () => {
    const response = await dispatchFastifyRouteGroup(
      requestFor({
        method: 'POST',
        body: {
          receiptNumber: ' GR-KT-YARN-2026-002 ',
          purchaseOrderId: receipt.purchase_order_id,
          receivedAt: '2026-11-20T08:00:00.000Z',
          sourceReference: 'delivery-002',
          lines: [
            {
              purchaseOrderLineId: '99999999-9999-4999-8999-999999999991',
              lotNumber: 'LOT-KT-YARN-B',
              locationCode: 'RAW-A01',
              quantity: '2000',
              expiresAt: null,
            },
          ],
        },
      }),
      scopeFor(),
    );
    expect(response?.statusCode).toBe(201);
    const call = repositoryCalls[0];
    expect(call?.method).toBe('receive');
    expect(call?.args[0]).toEqual({
      receiptNumber: 'GR-KT-YARN-2026-002',
      purchaseOrderId: receipt.purchase_order_id,
      receivedAt: '2026-11-20T08:00:00.000Z',
      sourceReference: 'delivery-002',
      lines: [
        {
          purchaseOrderLineId: '99999999-9999-4999-8999-999999999991',
          lotNumber: 'LOT-KT-YARN-B',
          locationCode: 'RAW-A01',
          quantity: '2000',
          manufacturedAt: null,
          expiresAt: null,
        },
      ],
    });
    expect(call?.args[1]).toEqual({
      actor: { companyId: '11111111-1111-4111-8111-111111111111', employeeId: 'e-1' },
      scopes: ['COMPANY'],
      anchors: [],
    });
    expect(call?.args[2]).toBe('corr-1');
  });

  it('POST 负例沿用 legacy 消息（lines 类型/空数组/行未知字段/lot 与库位编码/日期/超链字段）', async () => {
    const base = {
      receiptNumber: 'GR-KT-YARN-2026-002',
      purchaseOrderId: receipt.purchase_order_id,
      receivedAt: '2026-11-20T08:00:00.000Z',
      sourceReference: 'delivery-002',
      lines: [
        {
          purchaseOrderLineId: '99999999-9999-4999-8999-999999999991',
          lotNumber: 'LOT-KT-YARN-B',
          locationCode: 'RAW-A01',
          quantity: '2000',
        },
      ],
    };
    for (const [body, message] of [
      [{ ...base, unexpected: 1 }, 'Unsupported fields: unexpected'],
      [{ ...base, lines: 'nope' }, 'lines must be an array'],
      [{ ...base, lines: [] }, 'lines must not be empty'],
      [{ ...base, lines: [{ ...base.lines[0], extra: 1 }] }, 'Unsupported fields: extra'],
      [
        { ...base, lines: [{ ...base.lines[0], lotNumber: 'lot-lower' }] },
        'Code must be 1-64 uppercase letters, digits, underscore, or hyphen',
      ],
      [{ ...base, lines: [{ ...base.lines[0], locationCode: '' }] }, 'locationCode is required'],
      [
        { ...base, lines: [{ ...base.lines[0], manufacturedAt: 'soon' }] },
        'manufacturedAt must be a valid YYYY-MM-DD date',
      ],
      [
        { ...base, lines: [{ ...base.lines[0], purchaseOrderLineId: 'line-x' }] },
        'purchaseOrderLineId must be a UUID',
      ],
      [{ ...base, receivedAt: 'now' }, 'receivedAt must be a valid timestamp'],
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

  it('仓储 DomainError 映射 legacy 状态码（超收 conflict→409）；依赖缺失 503', async () => {
    const conflict = await dispatchFastifyRouteGroup(
      requestFor({
        method: 'POST',
        body: {
          receiptNumber: 'GR-KT-YARN-2026-002',
          purchaseOrderId: receipt.purchase_order_id,
          receivedAt: '2026-11-20T08:00:00.000Z',
          sourceReference: 'delivery-002',
          lines: [
            {
              purchaseOrderLineId: '99999999-9999-4999-8999-999999999991',
              lotNumber: 'LOT-KT-YARN-B',
              locationCode: 'RAW-A01',
              quantity: '99999',
            },
          ],
        },
      }),
      scopeFor(
        repository({
          receive: vi
            .fn()
            .mockRejectedValue(
              new DomainError('conflict', 'Receipt quantity exceeds open purchase order quantity'),
            ),
        }),
      ),
    );
    expect(conflict?.statusCode).toBe(409);
    expect((conflict?.body as { error: { code: string; message: string } }).error).toMatchObject({
      code: 'conflict',
      message: 'Receipt quantity exceeds open purchase order quantity',
    });
    const unavailable = await dispatchFastifyRouteGroup(requestFor(), scopeFor(null));
    expect(unavailable?.statusCode).toBe(503);
  });
});
