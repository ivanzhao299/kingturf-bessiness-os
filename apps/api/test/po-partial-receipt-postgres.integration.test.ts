import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { migrationsDirectory } from '@kingturf/database';
import type { JsonObject } from '@kingturf/types';
import { ownedProcurementApp } from './fixtures/owned-procurement-app.js';

// TD-PROC-001（PROC-5）：一张采购单分多笔收货。第一笔之后还有余量时它已是 PARTIALLY_RECEIVED；
// 再收一笔后若仍有余量，状态应当保持 PARTIALLY_RECEIVED。迁移 0038 的守卫
// guard_purchase_order_update 不允许「部分收货 → 部分收货」，这样的 UPDATE 被它拒绝（P0001）。
// 迁移 0077 只放开这一条，规则本身改对了；仓储 receive 不改。
//
// 如实记下改前的真实状态（主协调裁定依据的台账条目写于 2026-10-17）：提交 11983269（2026-10-26）
// 已让 receive 的状态 UPDATE 带上「status IS DISTINCT FROM $1」——状态不变时这条 UPDATE 匹配
// 零行、不触发守卫，所以在这之前的 main 上「收 4 → 再收 2」经接口已经能成功。也就是说 0077 不改变
// 用户可见行为；它让数据库规则与产品语义一致，收货路径的成功不再依赖仓储里「跳过空更新」这一
// 写法（下面的用例把这两件事都钉住）。
const identifier = (item: JsonObject, key = 'id'): string => {
  const value = item[key];
  if (typeof value !== 'string') throw new Error('Fixture identifier missing');
  return value;
};
const migrationSql = (name: string) => readFile(join(migrationsDirectory, name), 'utf8');
// 迁移 0038 里 guard_purchase_order_update 的原始定义（放宽之前的守卫），用来证明旧守卫确实拒绝。
const legacyGuard = async () => {
  const sql = await migrationSql('0038_procurement_inventory_integrity.sql');
  const statement = /CREATE FUNCTION guard_purchase_order_update\(\)[\s\S]*?END \$\$;/u.exec(
    sql,
  )?.[0];
  if (!statement) throw new Error('0038 guard_purchase_order_update definition not found');
  return statement.replace('CREATE FUNCTION', 'CREATE OR REPLACE FUNCTION');
};
const guard0077 = () => migrationSql('0077_po_partial_receipt_transition.sql');
const bodyOf = (response: { body: unknown }): Record<string, unknown> => {
  if (typeof response.body !== 'object' || response.body === null || Array.isArray(response.body))
    throw new Error('Expected a JSON object body');
  return response.body as Record<string, unknown>;
};

type Target = Readonly<{ id: string; lineId: string }>;

describe('TD-PROC-001 a purchase order can be received in more than two partial deliveries (real guard trigger)', () => {
  let fixture: Awaited<ReturnType<typeof ownedProcurementApp>> | undefined;
  let token: string;
  let material: JsonObject, supplier: JsonObject, order: Target;
  const state = () => {
    if (!fixture) throw new Error('Owned fixture not initialized');
    return fixture;
  };
  const lineIdOf = async (orderId: string): Promise<string> => {
    const lineId = (
      await state().db.query<{ id: string }>(
        'SELECT id FROM purchase_order_lines WHERE purchase_order_id=$1 ORDER BY line_number LIMIT 1',
        [orderId],
      )
    ).rows[0]?.id;
    if (!lineId) throw new Error('Fixture purchase order line missing');
    return lineId;
  };
  // 一张数量 10 的采购单（供应商已准入该物料）；issue=false 留作草稿。
  const newOrder = async (poNumber: string, issue = true): Promise<Target> => {
    const { repository, context } = state();
    const created = await repository.createPurchaseOrder(
      {
        poNumber,
        supplierId: identifier(supplier),
        supplierQuoteId: null,
        currency: 'CNY',
        issue,
        lines: [
          {
            itemVersionId: identifier(material),
            quantity: '10',
            unitPrice: '2.5',
            requiredAt: '2026-02-01',
          },
        ],
      },
      context,
      randomUUID(),
    );
    const id = identifier(created);
    return { id, lineId: await lineIdOf(id) };
  };
  // 控制台「登记批次收货」表单的同一条请求：POST /api/v1/goods-receipts。
  const receive = (target: Target, receiptNumber: string, quantity: string, as = token) =>
    state().dispatch({
      token: as,
      method: 'POST',
      pathname: '/api/v1/goods-receipts',
      body: {
        receiptNumber,
        purchaseOrderId: target.id,
        receivedAt: '2026-02-01T00:00:00.000Z',
        sourceReference: `DELIVERY-${receiptNumber}`,
        lines: [
          {
            purchaseOrderLineId: target.lineId,
            lotNumber: `LOT-${receiptNumber}`,
            locationCode: 'RECV',
            quantity,
            manufacturedAt: '2026-01-01',
            expiresAt: null,
          },
        ],
      },
    });
  // 一张采购单的收货台账：状态、收货单 / 行 / 批次 / 库存移动条数、累计收货数量与账面库存。
  const ledger = async (orderId: string) => {
    const row = (
      await state().db.query(
        `SELECT p.status,
           (SELECT count(*)::integer FROM goods_receipts g WHERE g.purchase_order_id=p.id) receipts,
           (SELECT count(*)::integer FROM goods_receipt_lines r WHERE r.purchase_order_line_id IN (SELECT l.id FROM purchase_order_lines l WHERE l.purchase_order_id=p.id)) lines,
           (SELECT count(*)::integer FROM inventory_lots i WHERE i.goods_receipt_id IN (SELECT g.id FROM goods_receipts g WHERE g.purchase_order_id=p.id)) lots,
           (SELECT count(*)::integer FROM inventory_movements m WHERE m.source_type='GOODS_RECEIPT_LINE' AND m.source_id IN (SELECT r.id FROM goods_receipt_lines r WHERE r.purchase_order_line_id IN (SELECT l.id FROM purchase_order_lines l WHERE l.purchase_order_id=p.id))) movements,
           (SELECT coalesce(sum(r.quantity),0)::text FROM goods_receipt_lines r WHERE r.purchase_order_line_id IN (SELECT l.id FROM purchase_order_lines l WHERE l.purchase_order_id=p.id)) received,
           (SELECT coalesce(sum(b.quantity),0)::text FROM inventory_balances b JOIN inventory_lots i ON i.id=b.lot_id AND i.tenant_id=b.tenant_id WHERE i.goods_receipt_id IN (SELECT g.id FROM goods_receipts g WHERE g.purchase_order_id=p.id)) stock
         FROM purchase_orders p WHERE p.id=$1`,
        [orderId],
      )
    ).rows[0];
    if (!row) throw new Error('Purchase order row missing');
    return row;
  };
  const postedEvidence = async () =>
    (
      await state().db.query<{ audit: number; outbox: number }>(
        "SELECT (SELECT count(*)::integer FROM audit_events WHERE action='goods-receipt.posted') audit,(SELECT count(*)::integer FROM domain_event_outbox WHERE event_type='goods-receipt.posted') outbox",
      )
    ).rows[0];
  const statusOf = async (orderId: string): Promise<string> => {
    const status = (
      await state().db.query<{ status: string }>('SELECT status FROM purchase_orders WHERE id=$1', [
        orderId,
      ])
    ).rows[0]?.status;
    if (!status) throw new Error('Purchase order row missing');
    return status;
  };

  beforeEach(async () => {
    fixture = await ownedProcurementApp('po_partial_pg');
    const { manufacturing, repository, context } = state();
    token = await state().session(state().employee, 'ALL');
    material = await manufacturing.createItem(
      {
        sku: 'RAW-1',
        name: 'RAW-1',
        itemType: 'RAW_MATERIAL',
        baseUnitCode: 'KG',
        specification: {},
        effectiveAt: '2026-01-01T00:00:00Z',
        publish: true,
      },
      context,
      randomUUID(),
    );
    supplier = await repository.createSupplier(
      {
        supplierNumber: 'SUP-1',
        name: 'Dedicated PG supplier',
        currency: 'CNY',
        paymentTermsDays: 30,
        qualityRatingBasisPoints: 9000,
        contact: {},
      },
      context,
      randomUUID(),
    );
    await repository.qualifySupplier(
      identifier(supplier),
      {
        itemVersionId: identifier(material),
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
    await repository.createLocation(
      { code: 'RECV', name: 'Receiving', locationType: 'RECEIVING' },
      context,
      randomUUID(),
    );
    order = await newOrder('PO-1');
  }, 60_000);
  afterEach(async () => {
    await fixture?.close();
    fixture = undefined;
  });

  it('through the endpoint: issue → receive 4 → receive 2 again → receive the rest; stock, receipts and status follow', async () => {
    const first = await receive(order, 'GR-1', '4');
    expect(first.statusCode).toBe(201);
    expect(bodyOf(first).status).toBe('PARTIALLY_RECEIVED');
    // 第三笔之前的这一步，就是守卫过去拒绝的「部分收货 → 部分收货」。
    const second = await receive(order, 'GR-2', '2');
    expect(second.statusCode).toBe(201);
    expect(bodyOf(second).status).toBe('PARTIALLY_RECEIVED');
    expect(await ledger(order.id)).toEqual({
      status: 'PARTIALLY_RECEIVED',
      receipts: 2,
      lines: 2,
      lots: 2,
      movements: 2,
      received: '6.000000',
      stock: '6.000000',
    });
    const final = await receive(order, 'GR-3', '4');
    expect(final.statusCode).toBe(201);
    expect(bodyOf(final).status).toBe('RECEIVED');
    expect(await ledger(order.id)).toEqual({
      status: 'RECEIVED',
      receipts: 3,
      lines: 3,
      lots: 3,
      movements: 3,
      received: '10.000000',
      stock: '10.000000',
    });
    // 三笔收货各留一对审计 / outbox 证据。
    expect(await postedEvidence()).toEqual({ audit: 3, outbox: 3 });
  });

  it('there is no two- or three-step limit: 3 + 2 + 2 + 1 partial deliveries, then the last 2 closes the order', async () => {
    for (const [index, quantity] of ['3', '2', '2', '1'].entries()) {
      const response = await receive(order, `GR-MULTI-${String(index)}`, quantity);
      expect(response.statusCode).toBe(201);
      expect(bodyOf(response).status).toBe('PARTIALLY_RECEIVED');
      expect((await ledger(order.id)).status).toBe('PARTIALLY_RECEIVED');
    }
    expect(await ledger(order.id)).toMatchObject({
      receipts: 4,
      received: '8.000000',
      stock: '8.000000',
    });
    const closing = await receive(order, 'GR-MULTI-FINAL', '2');
    expect(closing.statusCode).toBe(201);
    expect(bodyOf(closing).status).toBe('RECEIVED');
    expect(await ledger(order.id)).toMatchObject({
      status: 'RECEIVED',
      receipts: 5,
      lots: 5,
      movements: 5,
      received: '10.000000',
      stock: '10.000000',
    });
  });

  it('is really the 0038 rule that stood in the way: re-asserting PARTIALLY_RECEIVED fails under the old function and passes under 0077', async () => {
    const { db } = state();
    await receive(order, 'GR-1', '4');
    expect(await statusOf(order.id)).toBe('PARTIALLY_RECEIVED');
    const before = (
      await db.query<{ row: JsonObject }>(
        'SELECT to_jsonb(p) row FROM purchase_orders p WHERE id=$1',
        [order.id],
      )
    ).rows[0]?.row;
    // 0077 生效：部分收货的采购单可以再被写成部分收货（规则本身放行了）。
    const relaxed = await db.query(
      "UPDATE purchase_orders SET status='PARTIALLY_RECEIVED' WHERE id=$1",
      [order.id],
    );
    expect(relaxed.rowCount).toBe(1);
    expect(
      (
        await db.query<{ row: JsonObject }>(
          'SELECT to_jsonb(p) row FROM purchase_orders p WHERE id=$1',
          [order.id],
        )
      ).rows[0]?.row,
    ).toEqual(before);
    // 换回 0038 的函数：同一条 UPDATE 被拒，正是台账里那条消息。
    await db.query(await legacyGuard());
    await expect(
      db.query("UPDATE purchase_orders SET status='PARTIALLY_RECEIVED' WHERE id=$1", [order.id]),
    ).rejects.toMatchObject({
      code: 'P0001',
      message: 'partially received purchase order has invalid transition',
    });
    expect(await statusOf(order.id)).toBe('PARTIALLY_RECEIVED');
    // 改前状态的如实刻画：旧函数下接口仍能再收一笔，因为仓储对「状态不变」的 UPDATE 匹配零行
    //（11983269 的 status IS DISTINCT FROM $1），守卫根本没被触发。0077 修的是规则本身。
    const underOldGuard = await receive(order, 'GR-2-OLD-GUARD', '2');
    expect(underOldGuard.statusCode).toBe(201);
    expect((await ledger(order.id)).received).toBe('6.000000');
    // 重新应用 0077：规则恢复放行。
    await db.query(await guard0077());
    const again = await db.query(
      "UPDATE purchase_orders SET status='PARTIALLY_RECEIVED' WHERE id=$1",
      [order.id],
    );
    expect(again.rowCount).toBe(1);
    expect((await receive(order, 'GR-3', '4')).statusCode).toBe(201);
    expect(await statusOf(order.id)).toBe('RECEIVED');
  });

  it('a partially received order still cannot go back to draft or issued, and its content stays immutable', async () => {
    const { db } = state();
    await receive(order, 'GR-1', '4');
    for (const [sql, message] of [
      [
        "UPDATE purchase_orders SET status='DRAFT' WHERE id=$1",
        'partially received purchase order has invalid transition',
      ],
      [
        "UPDATE purchase_orders SET status='ISSUED' WHERE id=$1",
        'partially received purchase order has invalid transition',
      ],
      [
        "UPDATE purchase_orders SET status='ISSUED',ordered_at=now() WHERE id=$1",
        'partially received purchase order has invalid transition',
      ],
      [
        "UPDATE purchase_orders SET po_number=po_number||'-X' WHERE id=$1",
        'purchase order content is immutable',
      ],
      [
        "UPDATE purchase_orders SET status='RECEIVED',po_number=po_number||'-X' WHERE id=$1",
        'purchase order content is immutable',
      ],
    ] as const) {
      await expect(db.query(sql, [order.id])).rejects.toMatchObject({ code: 'P0001', message });
      expect(await statusOf(order.id)).toBe('PARTIALLY_RECEIVED');
    }
  });

  it('a partially received order can still move to RECEIVED or CANCELLED (the two targets 0038 already allowed)', async () => {
    const { db } = state();
    const received = await newOrder('PO-TO-RECEIVED');
    const cancelled = await newOrder('PO-TO-CANCELLED');
    for (const [target, receiptNumber] of [
      [received, 'GR-TO-RECEIVED'],
      [cancelled, 'GR-TO-CANCELLED'],
    ] as const) {
      expect((await receive(target, receiptNumber, '4')).statusCode).toBe(201);
      expect(await statusOf(target.id)).toBe('PARTIALLY_RECEIVED');
    }
    expect(
      (await db.query("UPDATE purchase_orders SET status='RECEIVED' WHERE id=$1", [received.id]))
        .rowCount,
    ).toBe(1);
    expect(
      (await db.query("UPDATE purchase_orders SET status='CANCELLED' WHERE id=$1", [cancelled.id]))
        .rowCount,
    ).toBe(1);
    expect(await statusOf(received.id)).toBe('RECEIVED');
    expect(await statusOf(cancelled.id)).toBe('CANCELLED');
  });

  it('over-receiving after a second partial delivery is refused and leaves nothing behind; the exact remainder then closes the order', async () => {
    await receive(order, 'GR-1', '4');
    await receive(order, 'GR-2', '2');
    const before = await ledger(order.id);
    // 余量 4，收到 5：整笔回滚（已插入的收货单 / 批次 / 移动一并撤销）。
    const excess = await receive(order, 'GR-EXCESS', '5');
    expect(excess.statusCode).toBe(409);
    expect(bodyOf(excess).error).toMatchObject({
      code: 'conflict',
      message: 'Receipt quantity exceeds open purchase order quantity',
    });
    expect(await ledger(order.id)).toEqual(before);
    expect(await postedEvidence()).toEqual({ audit: 2, outbox: 2 });
    const closing = await receive(order, 'GR-3', '4');
    expect(closing.statusCode).toBe(201);
    expect((await ledger(order.id)).status).toBe('RECEIVED');
  });

  it('a fully received order is immutable and accepts no further receipt', async () => {
    const { db, repository, context } = state();
    await receive(order, 'GR-1', '10');
    expect(await statusOf(order.id)).toBe('RECEIVED');
    const before = await ledger(order.id);
    const late = await receive(order, 'GR-LATE', '1');
    expect(late.statusCode).toBe(409);
    expect(bodyOf(late).error).toMatchObject({
      code: 'conflict',
      message: 'Receipt requires an open issued purchase order',
    });
    expect(await ledger(order.id)).toEqual(before);
    for (const sql of [
      "UPDATE purchase_orders SET status='RECEIVED' WHERE id=$1",
      "UPDATE purchase_orders SET status='PARTIALLY_RECEIVED' WHERE id=$1",
      "UPDATE purchase_orders SET status='DRAFT' WHERE id=$1",
      "UPDATE purchase_orders SET status='CANCELLED' WHERE id=$1",
    ])
      await expect(db.query(sql, [order.id])).rejects.toMatchObject({
        code: 'P0001',
        message: 'closed purchase order is immutable',
      });
    // 改内容先报「内容不可变」——守卫的第一项检查排在状态检查之前（0038 的顺序）。
    await expect(
      db.query("UPDATE purchase_orders SET po_number=po_number||'-X' WHERE id=$1", [order.id]),
    ).rejects.toMatchObject({ code: 'P0001', message: 'purchase order content is immutable' });
    expect(await statusOf(order.id)).toBe('RECEIVED');
    // 已收货的采购单也不开放取消。
    await expect(
      repository.cancelPurchaseOrder(order.id, context, randomUUID()),
    ).rejects.toMatchObject({ code: 'not_found', message: 'Open purchase order not found' });
  });

  it('a cancelled order is immutable and accepts no receipt', async () => {
    const { db, repository, context } = state();
    // 已签发的采购单可以取消（草稿取消是另一回事，见证据文档 proc5-1，不在本批）。
    const issued = await newOrder('PO-TO-CANCEL', true);
    await repository.cancelPurchaseOrder(issued.id, context, randomUUID());
    expect(await statusOf(issued.id)).toBe('CANCELLED');
    const refused = await receive(issued, 'GR-ON-CANCELLED', '4');
    expect(refused.statusCode).toBe(409);
    expect(bodyOf(refused).error).toMatchObject({
      code: 'conflict',
      message: 'Receipt requires an open issued purchase order',
    });
    // 一笔都没收：coalesce 后的合计是整数 0（文本形态「0」）。
    expect(await ledger(issued.id)).toEqual({
      status: 'CANCELLED',
      receipts: 0,
      lines: 0,
      lots: 0,
      movements: 0,
      received: '0',
      stock: '0',
    });
    for (const sql of [
      "UPDATE purchase_orders SET status='DRAFT',ordered_at=NULL WHERE id=$1",
      "UPDATE purchase_orders SET status='ISSUED' WHERE id=$1",
      "UPDATE purchase_orders SET status='CANCELLED' WHERE id=$1",
    ])
      await expect(db.query(sql, [issued.id])).rejects.toMatchObject({
        code: 'P0001',
        message: 'closed purchase order is immutable',
      });
    expect(await statusOf(issued.id)).toBe('CANCELLED');
    await expect(
      repository.cancelPurchaseOrder(issued.id, context, randomUUID()),
    ).rejects.toMatchObject({ code: 'not_found', message: 'Open purchase order not found' });
    await expect(
      repository.issuePurchaseOrder(issued.id, context, randomUUID()),
    ).rejects.toMatchObject({ code: 'not_found', message: 'Draft purchase-order not found' });
  });

  it('leaves every draft and issued rule exactly as 0038 had it', async () => {
    const { db, repository, context } = state();
    const draft = await newOrder('PO-DRAFT', false);
    for (const [sql, message] of [
      // 草稿只能签发或取消：不能跳到收货状态（带不带 ordered_at 都一样）。
      [
        "UPDATE purchase_orders SET status='PARTIALLY_RECEIVED' WHERE id=$1",
        'draft purchase order can only be issued or cancelled',
      ],
      [
        "UPDATE purchase_orders SET status='PARTIALLY_RECEIVED',ordered_at=now() WHERE id=$1",
        'draft purchase order can only be issued or cancelled',
      ],
      [
        "UPDATE purchase_orders SET status='RECEIVED' WHERE id=$1",
        'draft purchase order can only be issued or cancelled',
      ],
      // 内容同样不可变。
      [
        "UPDATE purchase_orders SET po_number=po_number||'-X' WHERE id=$1",
        'purchase order content is immutable',
      ],
    ] as const) {
      await expect(db.query(sql, [draft.id])).rejects.toMatchObject({ code: 'P0001', message });
      expect(await statusOf(draft.id)).toBe('DRAFT');
    }
    // 签发仍要求 ordered_at 与行项。
    await expect(
      repository.createPurchaseOrder(
        {
          poNumber: 'PO-EMPTY',
          supplierId: identifier(supplier),
          supplierQuoteId: null,
          currency: 'CNY',
          issue: true,
          lines: [],
        },
        context,
        randomUUID(),
      ),
    ).rejects.toMatchObject({
      code: 'P0001',
      message: 'purchase order issue requires timestamp and lines',
    });
    expect(await repository.issuePurchaseOrder(draft.id, context, randomUUID())).toEqual({
      id: draft.id,
      status: 'ISSUED',
    });
    for (const [sql, message] of [
      // 已签发：不能回到草稿，也不能原地重写（第一笔收货之前）。
      [
        "UPDATE purchase_orders SET status='DRAFT' WHERE id=$1",
        'issued purchase order has invalid transition',
      ],
      [
        "UPDATE purchase_orders SET status='ISSUED' WHERE id=$1",
        'issued purchase order has invalid transition',
      ],
    ] as const) {
      await expect(db.query(sql, [draft.id])).rejects.toMatchObject({ code: 'P0001', message });
      expect(await statusOf(draft.id)).toBe('ISSUED');
    }
    // 第一笔部分收货照常把已签发的采购单带入部分收货。
    const first = await receive(draft, 'GR-FROM-DRAFT', '4');
    expect(first.statusCode).toBe(201);
    expect(await statusOf(draft.id)).toBe('PARTIALLY_RECEIVED');
  });

  it('re-applying 0077 twice inside one transaction is a no-op, and no type or trigger is touched', async () => {
    const { db } = state();
    const file = await guard0077();
    // 静态断言只看语句本身：注释里会出现对这些关键字的说明文字。
    const statements = file
      .split('\n')
      .filter((line) => !line.trimStart().startsWith('--'))
      .join('\n')
      .trim();
    expect(statements).toMatch(/^CREATE OR REPLACE FUNCTION guard_purchase_order_update\(\)/u);
    expect(statements).not.toMatch(
      /ALTER\s+TYPE|ADD\s+VALUE|CREATE\s+TYPE|DROP\s|ALTER\s+TABLE|UPDATE\s|DELETE\s|CREATE\s+TRIGGER/iu,
    );
    const definition = async () =>
      (
        await db.query<{ definition: string }>(
          'SELECT pg_get_functiondef($1::regproc) definition',
          ['guard_purchase_order_update'],
        )
      ).rows[0]?.definition;
    const before = await definition();
    // 整个迁移文件原样执行两遍，同一个事务（迁移运行器就是每文件一个事务）。
    await db.transaction(async (tx) => {
      await tx.query(file);
      await tx.query(file);
    });
    expect(await definition()).toBe(before);
    expect(
      (
        await db.query<{ range: string[] }>(
          'SELECT ARRAY(SELECT unnest(enum_range(NULL::procurement_document_status))::text) range',
        )
      ).rows,
    ).toEqual([{ range: ['DRAFT', 'ISSUED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED'] }]);
    // 表上仍只有那一个更新守卫触发器。
    expect(
      (
        await db.query<{ tgname: string }>(
          "SELECT tgname FROM pg_trigger WHERE tgrelid='purchase_orders'::regclass AND NOT tgisinternal ORDER BY tgname",
        )
      ).rows.map((row) => row.tgname),
    ).toEqual(['purchase_order_update_guard']);
    expect((await receive(order, 'GR-1', '4')).statusCode).toBe(201);
    expect((await receive(order, 'GR-2', '2')).statusCode).toBe(201);
    expect(await statusOf(order.id)).toBe('PARTIALLY_RECEIVED');
  });

  it('stays tenant-bounded: another company cannot receive against the order', async () => {
    await receive(order, 'GR-1', '4');
    const before = await ledger(order.id);
    const outsider = await state().session(state().otherEmployee, 'ALL');
    const refused = await receive(order, 'GR-OUTSIDER', '2', outsider);
    expect(refused.statusCode).toBe(409);
    expect(bodyOf(refused).error).toMatchObject({
      code: 'conflict',
      message: 'Receipt requires an open issued purchase order',
    });
    expect(await ledger(order.id)).toEqual(before);
  });
});
