import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { migrationsDirectory } from '@kingturf/database';
import { ownedProcurementApp } from './fixtures/owned-procurement-app.js';

// TD-PROC-015（PG2）：取消草稿采购单在真库上的回归。
// 迁移 0037 建表时的检查 purchase_orders_check 要求「非草稿就必须有 ordered_at」；取消命令只改
// 状态，草稿取消于是撞上这条检查（23514 → 接口 500，单据仍是草稿）。迁移 0080 只放宽这一条：
// 允许「已取消且从未签发」的行（ordered_at 为空），其余组合仍按原规则拒绝。取消命令不改——
// 不给草稿补一个不真实的签发时间。端点把守卫 / 检查的拒绝映射成 409 + 中文提示。
// 走完整的应用分发（buildApp + 真实仓储 + 真实会话），数据库真的执行每一条语句。
const identifier = (item: Readonly<Record<string, unknown>>, key = 'id'): string => {
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
type Fixture = Awaited<ReturnType<typeof ownedProcurementApp>>;
const migrationSql = (name: string) => readFile(join(migrationsDirectory, name), 'utf8');
const migration0080 = () => migrationSql('0080_po_draft_cancel.sql');
// 0037 建表语句里的原检查（放宽之前）：非草稿 ⟺ 有签发时间。
const LEGACY_CHECK = "CHECK((status='DRAFT')=(ordered_at IS NULL))";
const restoreLegacyCheck = (db: Fixture['db']) =>
  db.query(
    `ALTER TABLE purchase_orders DROP CONSTRAINT purchase_orders_check;
     ALTER TABLE purchase_orders ADD CONSTRAINT purchase_orders_check ${LEGACY_CHECK}`,
  );
// 检查的真值表：十种「状态 × 有无签发时间」各试一次。更新守卫触发器先停用，量到的只是检查本身。
const STATUSES = ['DRAFT', 'ISSUED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED'] as const;
// 逐格串行：每格一条 UPDATE、各自成事务；被拒绝的那条整体回滚，行保持上一格的结果，
// 而每条 UPDATE 都同时写 status 与 ordered_at，所以 verdict 只取决于检查本身。
const verdictsOf = async (db: Fixture['db'], id: string): Promise<Record<string, boolean>> => {
  const table: Record<string, boolean> = {};
  for (const status of STATUSES)
    for (const orderedAt of [null, 'now()'] as const) {
      const key = `${status}|${orderedAt === null ? 'null' : 'set'}`;
      try {
        await db.transaction((tx) =>
          tx.query(
            `UPDATE purchase_orders SET status=$2::procurement_document_status,ordered_at=${orderedAt ?? 'NULL'} WHERE id=$1`,
            [id, status],
          ),
        );
        table[key] = true;
      } catch {
        table[key] = false;
      }
    }
  return table;
};
const withGuardDisabled = async <T>(db: Fixture['db'], work: () => Promise<T>): Promise<T> => {
  await db.query('ALTER TABLE purchase_orders DISABLE TRIGGER purchase_order_update_guard');
  try {
    return await work();
  } finally {
    await db.query('ALTER TABLE purchase_orders ENABLE TRIGGER purchase_order_update_guard');
  }
};
const RELAXED_TABLE: Readonly<Record<string, boolean>> = {
  'DRAFT|null': true,
  'DRAFT|set': false,
  'ISSUED|null': false,
  'ISSUED|set': true,
  'PARTIALLY_RECEIVED|null': false,
  'PARTIALLY_RECEIVED|set': true,
  'RECEIVED|null': false,
  'RECEIVED|set': true,
  'CANCELLED|null': true,
  'CANCELLED|set': true,
};
const LEGACY_TABLE: Readonly<Record<string, boolean>> = {
  ...RELAXED_TABLE,
  'CANCELLED|null': false,
};

describe('TD-PROC-015 cancelling a draft purchase order against real PostgreSQL', () => {
  let fixture: Fixture | undefined;
  let token: string;
  let supplierId: string, itemVersionId: string;
  let draft: string, issued: string;
  const state = () => {
    if (!fixture) throw new Error('Owned fixture not initialized');
    return fixture;
  };
  const createOrder = async (poNumber: string, issue: boolean): Promise<string> => {
    const response = await state().dispatch({
      token,
      method: 'POST',
      pathname: '/api/v1/purchase-orders',
      body: {
        poNumber,
        supplierId,
        supplierQuoteId: null,
        currency: 'CNY',
        lines: [{ itemVersionId, quantity: '10', unitPrice: '2.5', requiredAt: '2026-12-01' }],
        issue,
      },
    });
    expect(response.statusCode).toBe(201);
    return identifier(bodyOf(response));
  };
  const stateAction = (id: string, action: 'issue' | 'cancel', bearer = token) =>
    state().dispatch({
      token: bearer,
      method: 'PUT',
      pathname: `/api/v1/purchase-orders/${id}/state`,
      body: { action },
    });
  const rowOf = async (id: string) => {
    const row = (
      await state().db.query<{ status: string; ordered_at: Date | null }>(
        'SELECT status,ordered_at FROM purchase_orders WHERE id=$1',
        [id],
      )
    ).rows[0];
    if (!row) throw new Error('Purchase order row missing');
    return row;
  };
  // 取消证据：审计行数，以及 outbox 行（载荷与版本）。
  const cancelEvidence = async (id: string) =>
    (
      await state().db.query<{ audit: number; outbox: unknown[] }>(
        `SELECT
           (SELECT count(*)::integer FROM audit_events WHERE target_id=$1 AND action='purchase-order.cancelled') audit,
           (SELECT coalesce(jsonb_agg(jsonb_build_object('payload',o.payload,'version',o.aggregate_version) ORDER BY o.aggregate_version),'[]') FROM domain_event_outbox o WHERE o.aggregate_id=$1 AND o.event_type='purchase-order.cancelled') outbox`,
        [id],
      )
    ).rows[0];

  beforeEach(async () => {
    fixture = await ownedProcurementApp('po_draft_cancel_pg');
    token = await state().session(state().employee, 'ALL');
    itemVersionId = identifier(
      await state().manufacturing.createItem(
        {
          sku: 'RAW-1',
          name: 'RAW-1',
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
    const { repository, context } = state();
    const supplier = await repository.createSupplier(
      {
        supplierNumber: 'SUP-1',
        name: 'Supplier SUP-1',
        currency: 'CNY',
        paymentTermsDays: 30,
        qualityRatingBasisPoints: null,
        contact: {},
      },
      context,
      randomUUID(),
    );
    supplierId = identifier(supplier);
    await repository.qualifySupplier(
      supplierId,
      {
        itemVersionId,
        status: 'APPROVED',
        validFrom: '2026-01-01',
        validTo: null,
        minimumOrderQuantity: '0',
        leadTimeDays: 2,
        evidence: {},
      },
      context,
      randomUUID(),
    );
    draft = await createOrder('PO-DRAFT', false);
    issued = await createOrder('PO-ISSUED', true);
  }, 60_000);
  afterEach(async () => {
    await fixture?.close();
    fixture = undefined;
  });

  it('cancels a draft: 200 + CANCELLED, ordered_at stays null, exactly one piece of evidence', async () => {
    const response = await stateAction(draft, 'cancel');
    const row = await rowOf(draft);
    const evidence = await cancelEvidence(draft);
    // 响应、单据状态与证据放进同一次断言：改前 / 改后是同一条断言，输出可直接对照。
    expect({
      statusCode: response.statusCode,
      body: response.statusCode === 200 ? bodyOf(response) : errorOf(response),
      status: row.status,
      orderedAt: row.ordered_at,
      audit: evidence?.audit,
      outbox: evidence?.outbox,
    }).toEqual({
      statusCode: 200,
      body: { id: draft, status: 'CANCELLED' },
      status: 'CANCELLED',
      orderedAt: null,
      audit: 1,
      outbox: [{ payload: { id: draft, status: 'CANCELLED' }, version: 1 }],
    });
    // 已取消是终态：再取消一次不命中任何行（404），不新增证据。
    const again = await stateAction(draft, 'cancel');
    expect(again.statusCode).toBe(404);
    expect(errorOf(again).code).toBe('not_found');
    expect(await rowOf(draft)).toEqual({ status: 'CANCELLED', ordered_at: null });
    expect((await cancelEvidence(draft))?.audit).toBe(1);
  });

  it('keeps cancelling an issued order exactly as it was: 200, ordered_at unchanged', async () => {
    const before = await rowOf(issued);
    expect(before.status).toBe('ISSUED');
    expect(before.ordered_at).not.toBeNull();
    const response = await stateAction(issued, 'cancel');
    expect(response.statusCode).toBe(200);
    expect(bodyOf(response)).toEqual({ id: issued, status: 'CANCELLED' });
    const after = await rowOf(issued);
    expect(after.status).toBe('CANCELLED');
    expect(after.ordered_at).toEqual(before.ordered_at);
    expect(await cancelEvidence(issued)).toMatchObject({ audit: 1 });
  });

  it('leaves the other statuses alone: partially received, received, unknown and foreign orders answer 404 and stay as they are', async () => {
    const { repository, context } = state();
    const otherToken = await state().session(state().otherEmployee, 'ALL');
    await repository.createLocation(
      { code: 'RECEIVING-1', name: 'Receiving', locationType: 'RECEIVING' },
      context,
      randomUUID(),
    );
    const receive = async (poNumber: string, quantity: string) => {
      const id = await createOrder(poNumber, true);
      const line = (
        await state().db.query<{ id: string }>(
          'SELECT id FROM purchase_order_lines WHERE purchase_order_id=$1',
          [id],
        )
      ).rows[0];
      if (!line) throw new Error('Purchase order line missing');
      await repository.receive(
        {
          receiptNumber: `GR-${poNumber}`,
          purchaseOrderId: id,
          receivedAt: '2026-11-20T00:00:00Z',
          sourceReference: `DELIVERY-${poNumber}`,
          lines: [
            {
              purchaseOrderLineId: line.id,
              lotNumber: `LOT-${poNumber}`,
              locationCode: 'RECEIVING-1',
              quantity,
              manufacturedAt: null,
              expiresAt: null,
            },
          ],
        },
        context,
        randomUUID(),
      );
      return rowOf(id);
    };
    const partial = await receive('PO-PARTIAL', '4');
    const received = await receive('PO-RECEIVED', '10');
    expect(partial.status).toBe('PARTIALLY_RECEIVED');
    expect(received.status).toBe('RECEIVED');
    const ordered = (
      await state().db.query<{ id: string; po_number: string; status: string }>(
        "SELECT id,po_number,status FROM purchase_orders WHERE po_number IN('PO-PARTIAL','PO-RECEIVED') ORDER BY po_number",
      )
    ).rows;
    expect(ordered.map((row) => row.status)).toEqual(['PARTIALLY_RECEIVED', 'RECEIVED']);
    const attempts = [
      ...ordered.map((row) => [row.id, row.status] as const),
      [randomUUID(), 'unknown'] as const,
      [draft, 'foreign'] as const,
    ];
    for (const [id, label] of attempts) {
      const response = await stateAction(id, 'cancel', label === 'foreign' ? otherToken : token);
      expect({ label, statusCode: response.statusCode, code: errorOf(response).code }).toEqual({
        label,
        statusCode: 404,
        code: 'not_found',
      });
    }
    const after = (
      await state().db.query<{ po_number: string; status: string }>(
        "SELECT po_number,status FROM purchase_orders WHERE po_number IN('PO-PARTIAL','PO-RECEIVED','PO-DRAFT') ORDER BY po_number",
      )
    ).rows;
    expect(after).toEqual([
      { po_number: 'PO-DRAFT', status: 'DRAFT' },
      { po_number: 'PO-PARTIAL', status: 'PARTIALLY_RECEIVED' },
      { po_number: 'PO-RECEIVED', status: 'RECEIVED' },
    ]);
    // 全程没有任何一张单据产生取消证据。
    expect(
      (
        await state().db.query<{ count: number }>(
          "SELECT count(*)::integer count FROM audit_events WHERE action='purchase-order.cancelled'",
        )
      ).rows[0]?.count,
    ).toBe(0);
  });

  it('is really the 0037 check that stood in the way: under the old constraint the endpoint answers 409 and changes nothing; 0080 lifts exactly that', async () => {
    const { db } = state();
    await restoreLegacyCheck(db);
    const blocked = await stateAction(draft, 'cancel');
    const blockedRow = await rowOf(draft);
    const blockedError = errorOf(blocked);
    expect({
      statusCode: blocked.statusCode,
      code: blockedError.code,
      message: blockedError.message,
      status: blockedRow.status,
      orderedAt: blockedRow.ordered_at,
      audit: (await cancelEvidence(draft))?.audit,
    }).toEqual({
      statusCode: 409,
      code: 'conflict',
      message: '采购单尚未签发，当前数据库规则不允许取消未签发的采购单',
      status: 'DRAFT',
      orderedAt: null,
      audit: 0,
    });
    await db.query(await migration0080());
    const lifted = await stateAction(draft, 'cancel');
    expect(lifted.statusCode).toBe(200);
    expect(bodyOf(lifted)).toEqual({ id: draft, status: 'CANCELLED' });
    expect(await rowOf(draft)).toEqual({ status: 'CANCELLED', ordered_at: null });
  });

  it('0080 relaxes exactly one combination of the truth table and nothing else', async () => {
    const { db } = state();
    const reset = () =>
      db.query("UPDATE purchase_orders SET status='DRAFT',ordered_at=NULL WHERE id=$1", [draft]);
    const current = await withGuardDisabled(db, async () => {
      const table = await verdictsOf(db, draft);
      await reset();
      return table;
    });
    expect(current).toEqual(RELAXED_TABLE);
    await restoreLegacyCheck(db);
    const legacy = await withGuardDisabled(db, async () => {
      const table = await verdictsOf(db, draft);
      await reset();
      return table;
    });
    expect(legacy).toEqual(LEGACY_TABLE);
    await db.query(await migration0080());
    const lifted = await withGuardDisabled(db, async () => {
      const table = await verdictsOf(db, draft);
      await reset();
      return table;
    });
    expect(lifted).toEqual(RELAXED_TABLE);
    // 十格里恰好一格不同：已取消 + 从未签发。
    expect(
      Object.keys(RELAXED_TABLE).filter((key) => RELAXED_TABLE[key] !== LEGACY_TABLE[key]),
    ).toEqual(['CANCELLED|null']);
  });

  it('re-applying 0080 twice inside one transaction is a no-op; the definition is the old check plus one clause; columns, type and triggers are untouched', async () => {
    const { db } = state();
    const file = await migration0080();
    const statements = file
      .split('\n')
      .filter((line) => !line.trimStart().startsWith('--'))
      .join('\n')
      .trim();
    // 只动这一条检查：不改类型、不加列、不写数据、不动触发器。
    expect(statements).toMatch(
      /^ALTER TABLE purchase_orders DROP CONSTRAINT purchase_orders_check;/u,
    );
    expect(statements).toContain(
      `ALTER TABLE purchase_orders ADD CONSTRAINT purchase_orders_check CHECK((status='DRAFT')=(ordered_at IS NULL) OR (status='CANCELLED' AND ordered_at IS NULL));`,
    );
    expect(statements).not.toMatch(
      /ALTER\s+TYPE|ADD\s+VALUE|CREATE\s+TYPE|ADD\s+COLUMN|DROP\s+COLUMN|UPDATE\s|DELETE\s|INSERT\s|TRIGGER/iu,
    );
    const definition = async () =>
      (
        await db.query<{ definition: string }>(
          "SELECT pg_get_constraintdef(oid) definition FROM pg_constraint WHERE conname='purchase_orders_check' AND conrelid='purchase_orders'::regclass",
        )
      ).rows;
    const columns = async () =>
      (
        await db.query<{ name: string; type: string; nullable: string }>(
          "SELECT attname name,format_type(atttypid,atttypmod) type,attnotnull::text nullable FROM pg_attribute WHERE attrelid='purchase_orders'::regclass AND attnum>0 AND NOT attisdropped ORDER BY attnum",
        )
      ).rows;
    const triggers = async () =>
      (
        await db.query<{ tgname: string }>(
          "SELECT tgname FROM pg_trigger WHERE tgrelid='purchase_orders'::regclass AND NOT tgisinternal ORDER BY tgname",
        )
      ).rows.map((row) => row.tgname);
    const before = {
      definition: await definition(),
      columns: await columns(),
      triggers: await triggers(),
    };
    expect(before.definition).toEqual([
      {
        definition:
          "CHECK ((((status = 'DRAFT'::procurement_document_status) = (ordered_at IS NULL)) OR ((status = 'CANCELLED'::procurement_document_status) AND (ordered_at IS NULL))))",
      },
    ]);
    // 迁移运行器是每文件一个事务；整份文件在同一事务里原样执行两遍。
    await db.transaction(async (tx) => {
      await tx.query(file);
      await tx.query(file);
    });
    expect(await definition()).toEqual(before.definition);
    expect(await columns()).toEqual(before.columns);
    expect(await triggers()).toEqual(before.triggers);
    expect(await triggers()).toEqual(['purchase_order_update_guard']);
  });

  it('the update guard is untouched: a draft can still only be issued or cancelled, and content stays immutable', async () => {
    const { db } = state();
    for (const [sql, message] of [
      [
        "UPDATE purchase_orders SET status='RECEIVED' WHERE id=$1",
        'draft purchase order can only be issued or cancelled',
      ],
      [
        "UPDATE purchase_orders SET po_number=po_number||'-X' WHERE id=$1",
        'purchase order content is immutable',
      ],
      [
        "UPDATE purchase_orders SET status='ISSUED',ordered_at=now(),currency='USD' WHERE id=$1",
        'purchase order content is immutable',
      ],
    ] as const) {
      await expect(db.query(sql, [draft])).rejects.toMatchObject({ code: 'P0001', message });
      expect(await rowOf(draft)).toEqual({ status: 'DRAFT', ordered_at: null });
    }
    // 草稿签发照常：签发时间由签发动作写入，不是取消动作。
    const response = await stateAction(draft, 'issue');
    expect(response.statusCode).toBe(200);
    expect(bodyOf(response)).toEqual({ id: draft, status: 'ISSUED' });
    expect((await rowOf(draft)).status).toBe('ISSUED');
    expect((await rowOf(draft)).ordered_at).not.toBeNull();
  });
});
