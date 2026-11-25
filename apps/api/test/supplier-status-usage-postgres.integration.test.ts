import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { JsonObject } from '@kingturf/types';
import { ownedProcurementApp } from './fixtures/owned-procurement-app.js';

// PROC-5 B.2（TD-PROC-002 查证）：供应商处于 ON_HOLD / INACTIVE 时，后端哪些动作拦、哪些不拦。
// 这里只刻画现状，不代表期望的产品语义（主协调裁定：本批不发明新的业务限制，只查证、如实上报）。
// 结论（真库、完整应用分发）：
//   拦：为该供应商登记报价（POST /api/v1/supplier-quotes）→ 409；
//       为该供应商新建采购订单（POST /api/v1/purchase-orders）→ 409。
//   不拦：供应商被暂停 / 停用之前建好的采购单照常签发、收货、取消；物料准入审核也不看供应商状态。
// 询价单在数据模型上不指向供应商（procurement_rfqs 没有 supplier 列）：「给某供应商下询价」在
// 系统里对应的是「登记该供应商对某张询价单的报价」。
const identifier = (item: JsonObject, key = 'id'): string => {
  const value = item[key];
  if (typeof value !== 'string') throw new Error('Fixture identifier missing');
  return value;
};
const bodyOf = (response: { body: unknown }): Record<string, unknown> => {
  if (typeof response.body !== 'object' || response.body === null || Array.isArray(response.body))
    throw new Error('Expected a JSON object body');
  return response.body as Record<string, unknown>;
};
const errorOf = (response: { body: unknown }): Record<string, unknown> => {
  const error = bodyOf(response).error;
  if (typeof error !== 'object' || error === null || Array.isArray(error))
    throw new Error('Expected an error envelope');
  return error as Record<string, unknown>;
};
const NOT_ACTIVE = ['ON_HOLD', 'INACTIVE'] as const;

describe('PROC-5 B.2 what a held or inactive supplier can still be used for (characterization, real PostgreSQL)', () => {
  let fixture: Awaited<ReturnType<typeof ownedProcurementApp>> | undefined;
  let token: string;
  const state = () => {
    if (!fixture) throw new Error('Owned fixture not initialized');
    return fixture;
  };
  const material = async (sku: string): Promise<string> =>
    identifier(
      await state().manufacturing.createItem(
        {
          sku,
          name: sku,
          itemType: 'RAW_MATERIAL',
          baseUnitCode: 'KG',
          specification: {},
          effectiveAt: '2026-01-01T00:00:00Z',
          publish: true,
        },
        state().context,
        randomUUID(),
      ),
    );
  // 一个已启用、已准入该物料的供应商。
  const supplier = async (supplierNumber: string, itemVersionId: string): Promise<string> => {
    const { repository, context } = state();
    const created = await repository.createSupplier(
      {
        supplierNumber,
        name: `Supplier ${supplierNumber}`,
        currency: 'CNY',
        paymentTermsDays: 30,
        qualityRatingBasisPoints: 9000,
        contact: {},
      },
      context,
      randomUUID(),
    );
    await repository.qualifySupplier(
      identifier(created),
      {
        itemVersionId,
        status: 'APPROVED',
        validFrom: '2026-01-01',
        validTo: '2026-12-31',
        minimumOrderQuantity: '1',
        leadTimeDays: 2,
        evidence: { reviewed: true },
      },
      context,
      randomUUID(),
    );
    return identifier(created);
  };
  // 一张已签发、单行数量 10 的询价单；返回它的 id 与行 id。
  const issuedRfq = async (rfqNumber: string, itemVersionId: string) => {
    const { repository, context, db } = state();
    const rfq = await repository.createRfq(
      {
        rfqNumber,
        responseDueAt: '2026-01-10T00:00:00Z',
        currency: 'CNY',
        issue: true,
        lines: [{ itemVersionId, quantity: '10', requiredAt: '2026-02-01' }],
      },
      context,
      randomUUID(),
    );
    const lineId = (
      await db.query<{ id: string }>('SELECT id FROM procurement_rfq_lines WHERE rfq_id=$1', [
        identifier(rfq),
      ])
    ).rows[0]?.id;
    if (!lineId) throw new Error('Fixture RFQ line missing');
    return { rfqId: identifier(rfq), lineId };
  };
  const quoteFor = (
    rfq: { rfqId: string; lineId: string },
    supplierId: string,
    reference: string,
  ) =>
    state().dispatch({
      token,
      method: 'POST',
      pathname: '/api/v1/supplier-quotes',
      body: {
        rfqId: rfq.rfqId,
        supplierId,
        quoteReference: reference,
        receivedAt: '2026-01-09T00:00:00.000Z',
        validUntil: '2026-12-31',
        terms: {},
        lines: [
          {
            rfqLineId: rfq.lineId,
            unitPrice: '2.5',
            promisedAt: '2026-02-01',
            minimumOrderQuantity: '1',
          },
        ],
      },
      key: randomUUID(),
    });
  const orderFor = (supplierId: string, itemVersionId: string, poNumber: string, issue: boolean) =>
    state().dispatch({
      token,
      method: 'POST',
      pathname: '/api/v1/purchase-orders',
      body: {
        poNumber,
        supplierId,
        supplierQuoteId: null,
        currency: 'CNY',
        issue,
        lines: [{ itemVersionId, quantity: '10', unitPrice: '2.5', requiredAt: '2026-02-01' }],
      },
      key: randomUUID(),
    });
  // 状态直接改表：这个刻画不依赖本批新增的端点（刻画的是别的写路径对供应商状态的反应）。
  const setStatus = (supplierId: string, status: string) =>
    state().db.query('UPDATE suppliers SET status=$2 WHERE id=$1', [supplierId, status]);
  const counts = async (supplierId: string) =>
    (
      await state().db.query<{ quotes: number; orders: number }>(
        'SELECT (SELECT count(*)::integer FROM supplier_quotes WHERE supplier_id=$1) quotes,(SELECT count(*)::integer FROM purchase_orders WHERE supplier_id=$1) orders',
        [supplierId],
      )
    ).rows[0];

  beforeEach(async () => {
    fixture = await ownedProcurementApp('supplier_usage_pg');
    token = await state().session(state().employee, 'ALL');
    await state().repository.createLocation(
      { code: 'RECV', name: 'Receiving', locationType: 'RECEIVING' },
      state().context,
      randomUUID(),
    );
  }, 60_000);
  afterEach(async () => {
    await fixture?.close();
    fixture = undefined;
  });

  it('a held or inactive supplier gets neither a new quote nor a new purchase order: both are refused with 409', async () => {
    const itemVersionId = await material('RAW-QUOTE');
    for (const status of NOT_ACTIVE) {
      const supplierId = await supplier(`SUP-${status}`, itemVersionId);
      const rfq = await issuedRfq(`RFQ-${status}`, itemVersionId);
      await setStatus(supplierId, status);
      const quote = await quoteFor(rfq, supplierId, `QUOTE-${status}`);
      expect(quote.statusCode).toBe(409);
      expect(errorOf(quote)).toMatchObject({
        code: 'conflict',
        message: 'Supplier quote requires an issued RFQ and active supplier',
      });
      const order = await orderFor(supplierId, itemVersionId, `PO-${status}`, true);
      expect(order.statusCode).toBe(409);
      expect(errorOf(order)).toMatchObject({
        code: 'conflict',
        message: 'Purchase order requires an active supplier',
      });
      expect(await counts(supplierId)).toEqual({ quotes: 0, orders: 0 });
    }
  });

  it('the same requests succeed while the supplier is active (the refusals above are caused by the status)', async () => {
    const itemVersionId = await material('RAW-ACTIVE');
    const supplierId = await supplier('SUP-ACTIVE', itemVersionId);
    const rfq = await issuedRfq('RFQ-ACTIVE', itemVersionId);
    expect((await quoteFor(rfq, supplierId, 'QUOTE-ACTIVE')).statusCode).toBe(201);
    expect((await orderFor(supplierId, itemVersionId, 'PO-ACTIVE', true)).statusCode).toBe(201);
    expect(await counts(supplierId)).toEqual({ quotes: 1, orders: 1 });
  });

  it('is not blocked: a draft order created earlier can still be issued after the supplier is held or deactivated', async () => {
    const itemVersionId = await material('RAW-ISSUE');
    for (const status of NOT_ACTIVE) {
      const supplierId = await supplier(`SUP-ISSUE-${status}`, itemVersionId);
      const created = await orderFor(supplierId, itemVersionId, `PO-ISSUE-${status}`, false);
      expect(created.statusCode).toBe(201);
      const orderId = bodyOf(created).id;
      if (typeof orderId !== 'string') throw new Error('Purchase order id missing');
      await setStatus(supplierId, status);
      const issued = await state().dispatch({
        token,
        method: 'PUT',
        pathname: `/api/v1/purchase-orders/${orderId}/state`,
        body: { action: 'issue' },
        key: randomUUID(),
      });
      expect(issued.statusCode).toBe(200);
      expect(bodyOf(issued)).toEqual({ id: orderId, status: 'ISSUED' });
    }
  });

  it('is not blocked: an order issued earlier can still be received after the supplier is held or deactivated', async () => {
    const { db } = state();
    const itemVersionId = await material('RAW-RECEIVE');
    for (const status of NOT_ACTIVE) {
      const supplierId = await supplier(`SUP-RECEIVE-${status}`, itemVersionId);
      const created = await orderFor(supplierId, itemVersionId, `PO-RECEIVE-${status}`, true);
      expect(created.statusCode).toBe(201);
      const orderId = bodyOf(created).id;
      if (typeof orderId !== 'string') throw new Error('Purchase order id missing');
      const lineId = (
        await db.query<{ id: string }>(
          'SELECT id FROM purchase_order_lines WHERE purchase_order_id=$1',
          [orderId],
        )
      ).rows[0]?.id;
      if (!lineId) throw new Error('Fixture purchase order line missing');
      await setStatus(supplierId, status);
      // 两笔部分收货（也是 TD-PROC-001 的路径）：4 然后 2，都成功，库存 6。
      for (const [suffix, quantity] of [
        ['A', '4'],
        ['B', '2'],
      ] as const) {
        const received = await state().dispatch({
          token,
          method: 'POST',
          pathname: '/api/v1/goods-receipts',
          body: {
            receiptNumber: `GR-${status}-${suffix}`,
            purchaseOrderId: orderId,
            receivedAt: '2026-02-01T00:00:00.000Z',
            sourceReference: `DELIVERY-${status}-${suffix}`,
            lines: [
              {
                purchaseOrderLineId: lineId,
                lotNumber: `LOT-${status}-${suffix}`,
                locationCode: 'RECV',
                quantity,
                manufacturedAt: '2026-01-01',
                expiresAt: null,
              },
            ],
          },
          key: randomUUID(),
        });
        expect(received.statusCode).toBe(201);
        expect(bodyOf(received).status).toBe('PARTIALLY_RECEIVED');
      }
      const stock = (
        await db.query<{ quantity: string }>(
          'SELECT sum(quantity)::text quantity FROM inventory_balances b JOIN inventory_lots l ON l.id=b.lot_id WHERE l.supplier_id=$1',
          [supplierId],
        )
      ).rows[0]?.quantity;
      expect(stock).toBe('6.000000');
    }
  });

  it('is not blocked: an issued order that has no receipt yet can still be cancelled after the supplier is held or deactivated', async () => {
    const itemVersionId = await material('RAW-CANCEL');
    for (const status of NOT_ACTIVE) {
      const supplierId = await supplier(`SUP-CANCEL-${status}`, itemVersionId);
      const created = await orderFor(supplierId, itemVersionId, `PO-CANCEL-${status}`, true);
      expect(created.statusCode).toBe(201);
      const orderId = bodyOf(created).id;
      if (typeof orderId !== 'string') throw new Error('Purchase order id missing');
      await setStatus(supplierId, status);
      // 取消只对草稿 / 已签发开放（既有规则，与供应商状态无关）。
      const cancelled = await state().dispatch({
        token,
        method: 'PUT',
        pathname: `/api/v1/purchase-orders/${orderId}/state`,
        body: { action: 'cancel' },
        key: randomUUID(),
      });
      expect(cancelled.statusCode).toBe(200);
      expect(bodyOf(cancelled)).toEqual({ id: orderId, status: 'CANCELLED' });
    }
  });

  it('is not blocked: qualification review does not look at the supplier status', async () => {
    const itemVersionId = await material('RAW-QUALIFY');
    const otherItemId = await material('RAW-QUALIFY-OTHER');
    for (const status of NOT_ACTIVE) {
      const supplierId = await supplier(`SUP-QUALIFY-${status}`, itemVersionId);
      await setStatus(supplierId, status);
      const qualified = await state().dispatch({
        token,
        method: 'PUT',
        pathname: `/api/v1/suppliers/${supplierId}/qualification`,
        body: {
          action: 'approve',
          itemVersionId: otherItemId,
          validFrom: '2026-03-01',
          validTo: '2026-12-31',
          minimumOrderQuantity: '1',
          leadTimeDays: 3,
          evidence: { reference: `EV-${status}` },
        },
      });
      expect(qualified.statusCode).toBe(200);
      expect(bodyOf(qualified).status).toBe('APPROVED');
    }
  });
});
