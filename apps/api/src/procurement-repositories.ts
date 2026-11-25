import { createHash } from 'node:crypto';
import { canonicalize, DomainError } from '@kingturf/domain';
import type { JsonObject } from '@kingturf/types';
import { writeFixedVersionOneEvidence as evidence } from './audit-outbox.ts';
import { writeNextVersionEvidence } from './audit-outbox.ts';
import {
  lockCommercialCommand,
  replayCommercialCommandAfterLock,
  retainCommercialCommand,
} from './command-results.ts';
import {
  PostgresProcurementReadRepository,
  company,
  json,
  GOODS_RECEIPT_ITEM_PROJECTION,
  PURCHASE_ORDER_ITEM_PROJECTION,
  RFQ_ITEM_PROJECTION,
  SUPPLIER_ITEM_PROJECTION,
  type Context,
  type Db,
} from './procurement-read-repositories.ts';
import {
  readSupplierQuote,
  readSupplierQuotePage,
  SUPPLIER_QUOTE_LIST_SQL,
  type SupplierQuoteFilter,
} from './supplier-quote-read-repository.ts';

import {
  INVENTORY_LEDGER_LIST_SQL,
  readInventoryBalance,
  readInventoryBalancePage,
  type InventoryLedgerFilter,
} from './inventory-ledger-read-repository.ts';

const hash = (value: unknown) => createHash('sha256').update(canonicalize(value)).digest('hex');

// PROC-5（TD-PROC-002）：供应商状态与合法迁移。三个状态之间，目标状态不同于当前状态即可
// 迁移——ACTIVE → ON_HOLD / INACTIVE，ON_HOLD → ACTIVE / INACTIVE，INACTIVE → ACTIVE /
// ON_HOLD；目标与当前相同的（ACTIVE → ACTIVE 等三条）拒绝。表约束（迁移 0037）只有这三个值。
export type SupplierStatus = 'ACTIVE' | 'ON_HOLD' | 'INACTIVE';
const SUPPLIER_STATUS_TRANSITIONS: Readonly<Record<string, readonly SupplierStatus[]>> = {
  ACTIVE: ['ON_HOLD', 'INACTIVE'],
  ON_HOLD: ['ACTIVE', 'INACTIVE'],
  INACTIVE: ['ACTIVE', 'ON_HOLD'],
};
// 键放宽为 string：库读回的状态列就是 string（表约束保证只会是这三个值之一）。
const SUPPLIER_STATUS_LABELS: Readonly<Record<string, string>> = {
  ACTIVE: '已启用',
  ON_HOLD: '暂停',
  INACTIVE: '已停用',
};
const SUPPLIER_STATUS_EVENT = 'supplier.status-changed';

export type {
  RfqListFilter,
  SupplierPage,
  SupplierPageFilter,
} from './procurement-read-repositories.ts';

export class PostgresProcurementRepository extends PostgresProcurementReadRepository {
  public constructor(db: Db) {
    super(db);
  }

  public async list(
    view: 'suppliers' | 'rfqs' | 'quotes' | 'orders' | 'receipts' | 'locations' | 'inventory',
    context: Context,
  ) {
    company(context);
    const queries = {
      suppliers: `SELECT ${SUPPLIER_ITEM_PROJECTION} item FROM suppliers s WHERE s.tenant_id=$1 ORDER BY s.supplier_number`,
      rfqs: `SELECT ${RFQ_ITEM_PROJECTION} item FROM procurement_rfqs r WHERE r.tenant_id=$1 ORDER BY r.created_at DESC`,
      quotes: SUPPLIER_QUOTE_LIST_SQL,
      orders: `SELECT ${PURCHASE_ORDER_ITEM_PROJECTION} item FROM purchase_orders p JOIN suppliers s ON s.id=p.supplier_id AND s.tenant_id=p.tenant_id WHERE p.tenant_id=$1 ORDER BY p.created_at DESC`,
      receipts: `SELECT ${GOODS_RECEIPT_ITEM_PROJECTION} item FROM goods_receipts g JOIN purchase_orders p ON p.id=g.purchase_order_id AND p.tenant_id=g.tenant_id WHERE g.tenant_id=$1 ORDER BY g.received_at DESC`,
      locations: `SELECT to_jsonb(l) item FROM inventory_locations l WHERE l.tenant_id=$1 ORDER BY l.code`,
      inventory: INVENTORY_LEDGER_LIST_SQL,
    } as const;
    return (
      await this.db.query<{ item: JsonObject }>(queries[view], [context.actor.companyId])
    ).rows.map((row) => row.item);
  }

  public listInventoryBalancePage(context: Context, filter: InventoryLedgerFilter) {
    return readInventoryBalancePage(this.db, context, filter);
  }

  public findInventoryBalance(
    context: Context,
    lotId: string,
    locationId: string,
    readable: Readonly<{ receipts: boolean; production: boolean }>,
  ) {
    return readInventoryBalance(this.db, context, lotId, locationId, readable);
  }

  public listSupplierQuotePage(context: Context, filter: SupplierQuoteFilter) {
    return readSupplierQuotePage(this.db, context, filter);
  }

  public findSupplierQuote(id: string, context: Context) {
    return readSupplierQuote(this.db, id, context);
  }

  // U3-PROC-2（ADR-0015）：RFQ 关闭写路径（additive；主协调 U3-PROC-2 指令明授
  // 「发布/关闭」状态流转）——DRAFT/ISSUED → CANCELLED；PARTIALLY_RECEIVED/RECEIVED
  // 属采购单收货状态机，不开放关闭。证据事件 rfq.closed 与 rfq.created/issued 同构。
  // TD-WF-003（WF-A）：这条 UPDATE 对已签发询价单自 PROC-2 起一直被迁移 0038 的守卫
  // 拒绝（接口 500）；迁移 0076 放宽 guard_rfq_update 后才第一次在真库上成功——已签发
  // 询价单只改 status 即可取消，issued_at 必须保持原值。语句与载荷不变；真库回归见
  // test/rfq-close-postgres.integration.test.ts，守卫拒绝在端点映射为 409。
  public closeRfq(id: string, context: Context, correlationId: string) {
    return this.db.transaction(async (tx) => {
      company(context);
      const row = (
        await tx.query<{ id: string }>(
          `UPDATE procurement_rfqs SET status='CANCELLED' WHERE id=$1 AND tenant_id=$2 AND status IN('DRAFT','ISSUED') RETURNING id`,
          [id, context.actor.companyId],
        )
      ).rows[0];
      if (!row) throw new DomainError('not_found', 'Open RFQ not found');
      const result = json({ id, status: 'CANCELLED' });
      await evidence(tx, 'rfq.closed', 'rfq', id, context, correlationId, result);
      return result;
    });
  }

  // U3-PROC-3（ADR-0015）：采购单取消写路径（additive；主协调 U3-PROC-3 指令
  // 「PUT 审批/发布」状态流转授权的合法迁移之一）——DRAFT/ISSUED → CANCELLED；
  // PARTIALLY_RECEIVED/RECEIVED 已入收货状态机不开放取消；独立审批层缺失登记
  // TD-PROC-003（schema 无 APPROVED 状态值，如需独立审批须迁移另批）。
  public cancelPurchaseOrder(id: string, context: Context, correlationId: string) {
    return this.db.transaction(async (tx) => {
      company(context);
      const row = (
        await tx.query<{ id: string }>(
          `UPDATE purchase_orders SET status='CANCELLED' WHERE id=$1 AND tenant_id=$2 AND status IN('DRAFT','ISSUED') RETURNING id`,
          [id, context.actor.companyId],
        )
      ).rows[0];
      if (!row) throw new DomainError('not_found', 'Open purchase order not found');
      const result = json({ id, status: 'CANCELLED' });
      await evidence(
        tx,
        'purchase-order.cancelled',
        'purchase-order',
        id,
        context,
        correlationId,
        result,
      );
      return result;
    });
  }

  public createSupplier(
    input: {
      supplierNumber: string;
      name: string;
      currency: string;
      paymentTermsDays: number;
      qualityRatingBasisPoints: number | null;
      contact: JsonObject;
    },
    context: Context,
    correlationId: string,
  ) {
    return this.db.transaction(async (tx) => {
      company(context);
      const row = (
        await tx.query<{ id: string }>(
          'INSERT INTO suppliers(tenant_id,supplier_number,name,currency,payment_terms_days,quality_rating_basis_points,contact,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id',
          [
            context.actor.companyId,
            input.supplierNumber,
            input.name,
            input.currency,
            input.paymentTermsDays,
            input.qualityRatingBasisPoints,
            input.contact,
            context.actor.employeeId,
          ],
        )
      ).rows[0];
      if (!row) throw new Error('Supplier insert failed');
      const result = json({ id: row.id, status: 'ACTIVE', ...input });
      await evidence(tx, 'supplier.created', 'supplier', row.id, context, correlationId, result);
      return result;
    });
  }

  public qualifySupplier(
    supplierId: string,
    input: {
      itemVersionId: string;
      status: string;
      validFrom: string;
      validTo: string | null;
      minimumOrderQuantity: string;
      leadTimeDays: number;
      evidence: JsonObject;
    },
    context: Context,
    correlationId: string,
  ) {
    return this.db.transaction(async (tx) => {
      company(context);
      const row = (
        await tx.query<{ id: string }>(
          `INSERT INTO supplier_item_qualifications(tenant_id,supplier_id,item_version_id,status,valid_from,valid_to,minimum_order_quantity,lead_time_days,evidence,created_by)
           SELECT $1,$2,v.id,$3,$4,$5,$6,$7,$8,$9 FROM manufacturing_item_versions v WHERE v.id=$10 AND v.tenant_id=$1 AND v.status='PUBLISHED' RETURNING id`,
          [
            context.actor.companyId,
            supplierId,
            input.status,
            input.validFrom,
            input.validTo,
            input.minimumOrderQuantity,
            input.leadTimeDays,
            input.evidence,
            context.actor.employeeId,
            input.itemVersionId,
          ],
        )
      ).rows[0];
      if (!row)
        throw new DomainError('conflict', 'Supplier qualification requires a published item');
      const result = json({ id: row.id, supplierId, ...input });
      await evidence(
        tx,
        'supplier.qualified',
        'supplier-qualification',
        row.id,
        context,
        correlationId,
        result,
      );
      return result;
    });
  }

  // PROC-5（TD-PROC-002）：供应商状态写路径（此前 suppliers.status 没有任何写端点）。迁移规则见
  // SUPPLIER_STATUS_TRANSITIONS。幂等与并发语义沿用既有命令写路径（qtc / commercial 的 command）：
  // 事务级咨询锁串行化同一幂等键；同键同命令重放留存的结果、不再执行；同键异命令 409。
  // 供应商行先 FOR UPDATE 再读状态：并发的两次变更按行锁排队，后到的基于最新状态判定。
  // 证据（审计 + outbox）按供应商递增版本——同一供应商可以反复暂停 / 恢复，固定版本 1 会撞
  // outbox 的 (tenant_id, event_type, aggregate_id, aggregate_version) 唯一约束；版本号在行锁
  // 内取 max+1，所以同一供应商的事件版本连续且不重复。
  public setSupplierStatus(
    supplierId: string,
    status: SupplierStatus,
    key: string,
    context: Context,
    correlationId: string,
  ) {
    return this.db.transaction(async (tx) => {
      company(context);
      const identity = {
        type: SUPPLIER_STATUS_EVENT,
        subjectId: supplierId,
        actorId: context.actor.employeeId,
        requestHash: hash({ status }),
      };
      await lockCommercialCommand(tx, context.actor.companyId, key);
      const prior = await replayCommercialCommandAfterLock<JsonObject>(
        tx,
        context.actor.companyId,
        key,
        identity,
      );
      if (prior) return prior;
      const current = (
        await tx.query<{ status: string }>(
          'SELECT status FROM suppliers WHERE id=$1 AND tenant_id=$2 FOR UPDATE',
          [supplierId, context.actor.companyId],
        )
      ).rows[0];
      if (!current) throw new DomainError('not_found', 'Supplier not found');
      if (!SUPPLIER_STATUS_TRANSITIONS[current.status]?.includes(status))
        throw new DomainError(
          'conflict',
          `供应商当前为「${SUPPLIER_STATUS_LABELS[current.status] ?? current.status}」，不能变更为「${SUPPLIER_STATUS_LABELS[status] ?? status}」`,
        );
      await tx.query(
        'UPDATE suppliers SET status=$3,updated_at=now() WHERE id=$1 AND tenant_id=$2',
        [supplierId, context.actor.companyId, status],
      );
      const result = json({ id: supplierId, status });
      await writeNextVersionEvidence(
        tx,
        'supplier',
        SUPPLIER_STATUS_EVENT,
        supplierId,
        context,
        correlationId,
        result,
      );
      await retainCommercialCommand(tx, context.actor.companyId, key, identity, result);
      return result;
    });
  }

  public createRfq(
    input: {
      rfqNumber: string;
      responseDueAt: string;
      currency: string;
      lines: { itemVersionId: string; quantity: string; requiredAt: string }[];
      issue: boolean;
    },
    context: Context,
    correlationId: string,
  ) {
    return this.db.transaction(async (tx) => {
      company(context);
      const root = (
        await tx.query<{ id: string }>(
          'INSERT INTO procurement_rfqs(tenant_id,rfq_number,response_due_at,currency,created_by) VALUES($1,$2,$3,$4,$5) RETURNING id',
          [
            context.actor.companyId,
            input.rfqNumber,
            input.responseDueAt,
            input.currency,
            context.actor.employeeId,
          ],
        )
      ).rows[0];
      if (!root) throw new Error('RFQ insert failed');
      for (const [index, line] of input.lines.entries())
        await tx.query(
          `INSERT INTO procurement_rfq_lines(tenant_id,rfq_id,line_number,item_version_id,quantity,required_at)
           SELECT $1,$2,$3,v.id,$4,$5 FROM manufacturing_item_versions v WHERE v.id=$6 AND v.tenant_id=$1 AND v.status='PUBLISHED'`,
          [
            context.actor.companyId,
            root.id,
            index + 1,
            line.quantity,
            line.requiredAt,
            line.itemVersionId,
          ],
        );
      if (input.issue)
        await tx.query(
          "UPDATE procurement_rfqs SET status='ISSUED',issued_at=now() WHERE id=$1 AND tenant_id=$2",
          [root.id, context.actor.companyId],
        );
      const result = json({ id: root.id, status: input.issue ? 'ISSUED' : 'DRAFT', ...input });
      await evidence(tx, 'rfq.created', 'rfq', root.id, context, correlationId, result);
      return result;
    });
  }

  public issueRfq(id: string, context: Context, correlationId: string) {
    return this.transition(id, 'rfq', context, correlationId);
  }

  public createSupplierQuote(
    input: {
      rfqId: string;
      supplierId: string;
      quoteReference: string;
      receivedAt: string;
      validUntil: string;
      terms: JsonObject;
      lines: {
        rfqLineId: string;
        unitPrice: string;
        promisedAt: string;
        minimumOrderQuantity: string;
      }[];
    },
    context: Context,
    correlationId: string,
  ) {
    return this.db.transaction(async (tx) => {
      company(context);
      const content = { ...input };
      const row = (
        await tx.query<{ id: string }>(
          `INSERT INTO supplier_quotes(tenant_id,rfq_id,supplier_id,quote_reference,received_at,valid_until,terms,canonical_hash,created_by)
           SELECT $1,r.id,s.id,$4,$5,$6,$7,$8,$9 FROM procurement_rfqs r JOIN suppliers s ON s.id=$3 AND s.tenant_id=r.tenant_id
           WHERE r.id=$2 AND r.tenant_id=$1 AND r.status='ISSUED' AND s.status='ACTIVE' RETURNING id`,
          [
            context.actor.companyId,
            input.rfqId,
            input.supplierId,
            input.quoteReference,
            input.receivedAt,
            input.validUntil,
            input.terms,
            hash(content),
            context.actor.employeeId,
          ],
        )
      ).rows[0];
      if (!row)
        throw new DomainError(
          'conflict',
          'Supplier quote requires an issued RFQ and active supplier',
        );
      for (const line of input.lines) {
        const inserted = await tx.query(
          `INSERT INTO supplier_quote_lines(tenant_id,supplier_quote_id,rfq_line_id,unit_price,promised_at,minimum_order_quantity)
           SELECT $1,$2,l.id,$4,$5,$6 FROM procurement_rfq_lines l JOIN supplier_item_qualifications q ON q.item_version_id=l.item_version_id AND q.tenant_id=l.tenant_id
           WHERE l.id=$3 AND l.rfq_id=$7 AND l.tenant_id=$1 AND q.supplier_id=$8 AND q.status IN('APPROVED','CONDITIONAL')
             AND q.valid_from<=$5::date AND (q.valid_to IS NULL OR q.valid_to>=$5::date) RETURNING id`,
          [
            context.actor.companyId,
            row.id,
            line.rfqLineId,
            line.unitPrice,
            line.promisedAt,
            line.minimumOrderQuantity,
            input.rfqId,
            input.supplierId,
          ],
        );
        if (!inserted.rowCount)
          throw new DomainError('conflict', 'Quoted item requires a valid supplier qualification');
      }
      const result = json({ id: row.id, canonicalHash: hash(content), ...input });
      await evidence(
        tx,
        'supplier-quote.received',
        'supplier-quote',
        row.id,
        context,
        correlationId,
        result,
      );
      return result;
    });
  }

  public createPurchaseOrder(
    input: {
      poNumber: string;
      supplierId: string;
      supplierQuoteId: string | null;
      currency: string;
      lines: { itemVersionId: string; quantity: string; unitPrice: string; requiredAt: string }[];
      issue: boolean;
    },
    context: Context,
    correlationId: string,
  ) {
    return this.db.transaction(async (tx) => {
      company(context);
      const content = { ...input };
      const row = (
        await tx.query<{ id: string }>(
          `INSERT INTO purchase_orders(tenant_id,po_number,supplier_id,supplier_quote_id,currency,canonical_hash,created_by)
           SELECT $1,$2,s.id,$4,$5,$6,$7
           FROM suppliers s
           LEFT JOIN supplier_quotes q
             ON q.id=$4::uuid
            AND q.tenant_id=$1
            AND q.supplier_id=s.id
            AND EXISTS(
              SELECT 1 FROM procurement_rfqs r
              WHERE r.id=q.rfq_id AND r.tenant_id=q.tenant_id AND r.status='ISSUED'
            )
           WHERE s.id=$3 AND s.tenant_id=$1 AND s.status='ACTIVE'
             AND ($4::uuid IS NULL OR q.id IS NOT NULL)
           RETURNING id`,
          [
            context.actor.companyId,
            input.poNumber,
            input.supplierId,
            input.supplierQuoteId,
            input.currency,
            hash(content),
            context.actor.employeeId,
          ],
        )
      ).rows[0];
      if (!row)
        throw new DomainError(
          'conflict',
          input.supplierQuoteId
            ? 'Purchase order requires an active supplier and valid supplier quote'
            : 'Purchase order requires an active supplier',
        );
      for (const [index, line] of input.lines.entries()) {
        const inserted = await tx.query(
          `INSERT INTO purchase_order_lines(tenant_id,purchase_order_id,line_number,item_version_id,quantity,unit_price,required_at)
           SELECT $1,$2,$3,v.id,$4,$5,$6 FROM manufacturing_item_versions v JOIN supplier_item_qualifications q ON q.item_version_id=v.id AND q.tenant_id=v.tenant_id
           WHERE v.id=$7 AND v.tenant_id=$1 AND v.status='PUBLISHED' AND q.supplier_id=$8 AND q.status IN('APPROVED','CONDITIONAL')
             AND q.valid_from<=$6::date AND (q.valid_to IS NULL OR q.valid_to>=$6::date) RETURNING id`,
          [
            context.actor.companyId,
            row.id,
            index + 1,
            line.quantity,
            line.unitPrice,
            line.requiredAt,
            line.itemVersionId,
            input.supplierId,
          ],
        );
        if (!inserted.rowCount)
          throw new DomainError(
            'conflict',
            'Purchase item requires a valid supplier qualification',
          );
      }
      if (input.issue)
        await tx.query(
          "UPDATE purchase_orders SET status='ISSUED',ordered_at=now() WHERE id=$1 AND tenant_id=$2",
          [row.id, context.actor.companyId],
        );
      const result = json({
        id: row.id,
        status: input.issue ? 'ISSUED' : 'DRAFT',
        canonicalHash: hash(content),
        ...input,
      });
      await evidence(
        tx,
        'purchase-order.created',
        'purchase-order',
        row.id,
        context,
        correlationId,
        result,
      );
      return result;
    });
  }

  public issuePurchaseOrder(id: string, context: Context, correlationId: string) {
    return this.transition(id, 'purchase-order', context, correlationId);
  }

  private transition(
    id: string,
    kind: 'rfq' | 'purchase-order',
    context: Context,
    correlationId: string,
  ) {
    return this.db.transaction(async (tx) => {
      company(context);
      const table = kind === 'rfq' ? 'procurement_rfqs' : 'purchase_orders';
      const time = kind === 'rfq' ? 'issued_at' : 'ordered_at';
      const row = (
        await tx.query<{ id: string }>(
          `UPDATE ${table} SET status='ISSUED',${time}=now() WHERE id=$1 AND tenant_id=$2 AND status='DRAFT' RETURNING id`,
          [id, context.actor.companyId],
        )
      ).rows[0];
      if (!row) throw new DomainError('not_found', `Draft ${kind} not found`);
      const result = json({ id, status: 'ISSUED' });
      await evidence(tx, `${kind}.issued`, kind, id, context, correlationId, result);
      return result;
    });
  }

  public receive(
    input: {
      receiptNumber: string;
      purchaseOrderId: string;
      receivedAt: string;
      sourceReference: string;
      lines: {
        purchaseOrderLineId: string;
        lotNumber: string;
        locationCode: string;
        quantity: string;
        manufacturedAt: string | null;
        expiresAt: string | null;
      }[];
    },
    context: Context,
    correlationId: string,
  ) {
    return this.db.transaction(async (tx) => {
      company(context);
      const locked = await tx.query(
        "SELECT id FROM purchase_orders WHERE id=$1 AND tenant_id=$2 AND status IN('ISSUED','PARTIALLY_RECEIVED') FOR UPDATE",
        [input.purchaseOrderId, context.actor.companyId],
      );
      if (!locked.rowCount)
        throw new DomainError('conflict', 'Receipt requires an open issued purchase order');
      const contentHash = hash(input);
      const receipt = (
        await tx.query<{ id: string; supplier_id: string }>(
          `INSERT INTO goods_receipts(tenant_id,receipt_number,purchase_order_id,received_at,source_reference,created_by,canonical_hash)
           SELECT $1,$2,p.id,$4,$5,$6,$7 FROM purchase_orders p WHERE p.id=$3 AND p.tenant_id=$1 AND p.status IN('ISSUED','PARTIALLY_RECEIVED') RETURNING id,(SELECT supplier_id FROM purchase_orders WHERE id=$3 AND tenant_id=$1) supplier_id`,
          [
            context.actor.companyId,
            input.receiptNumber,
            input.purchaseOrderId,
            input.receivedAt,
            input.sourceReference,
            context.actor.employeeId,
            contentHash,
          ],
        )
      ).rows[0];
      if (!receipt)
        throw new DomainError('conflict', 'Receipt requires an open issued purchase order');
      for (const line of input.lines) {
        const poLine = (
          await tx.query<{ item_version_id: string; within_remaining: boolean }>(
            `SELECT l.item_version_id,($4::numeric<=l.quantity-coalesce((SELECT sum(r.quantity) FROM goods_receipt_lines r WHERE r.purchase_order_line_id=l.id AND r.tenant_id=l.tenant_id),0)) within_remaining
             FROM purchase_order_lines l WHERE l.id=$1 AND l.purchase_order_id=$2 AND l.tenant_id=$3 FOR UPDATE`,
            [
              line.purchaseOrderLineId,
              input.purchaseOrderId,
              context.actor.companyId,
              line.quantity,
            ],
          )
        ).rows[0];
        if (!poLine?.within_remaining)
          throw new DomainError(
            'conflict',
            'Receipt quantity exceeds open purchase order quantity',
          );
        const location = (
          await tx.query<{ id: string }>(
            'SELECT id FROM inventory_locations WHERE tenant_id=$1 AND code=$2 AND active=true',
            [context.actor.companyId, line.locationCode],
          )
        ).rows[0];
        if (!location) throw new DomainError('not_found', 'Active inventory location not found');
        const lot = (
          await tx.query<{ id: string }>(
            `INSERT INTO inventory_lots(tenant_id,lot_number,item_version_id,supplier_id,goods_receipt_id,manufactured_at,expires_at)
             VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
            [
              context.actor.companyId,
              line.lotNumber,
              poLine.item_version_id,
              receipt.supplier_id,
              receipt.id,
              line.manufacturedAt,
              line.expiresAt,
            ],
          )
        ).rows[0];
        if (!lot) throw new Error('Inventory lot insert failed');
        const receiptLine = (
          await tx.query<{ id: string }>(
            'INSERT INTO goods_receipt_lines(tenant_id,goods_receipt_id,purchase_order_line_id,lot_id,location_id,quantity) VALUES($1,$2,$3,$4,$5,$6) RETURNING id',
            [
              context.actor.companyId,
              receipt.id,
              line.purchaseOrderLineId,
              lot.id,
              location.id,
              line.quantity,
            ],
          )
        ).rows[0];
        if (!receiptLine) throw new Error('Receipt line insert failed');
        await tx.query(
          `INSERT INTO inventory_movements(tenant_id,movement_type,item_version_id,lot_id,location_id,quantity_delta,occurred_at,source_type,source_id,canonical_hash,actor_id,correlation_id)
           VALUES($1,'RECEIPT',$2,$3,$4,$5,$6,'GOODS_RECEIPT_LINE',$7,$8,$9,$10)`,
          [
            context.actor.companyId,
            poLine.item_version_id,
            lot.id,
            location.id,
            line.quantity,
            input.receivedAt,
            receiptLine.id,
            hash({ receiptId: receipt.id, receiptLineId: receiptLine.id, ...line }),
            context.actor.employeeId,
            correlationId,
          ],
        );
      }
      const open = await tx.query(
        `SELECT 1 FROM purchase_order_lines l WHERE l.purchase_order_id=$1 AND l.tenant_id=$2
         AND l.quantity>coalesce((SELECT sum(r.quantity) FROM goods_receipt_lines r WHERE r.purchase_order_line_id=l.id AND r.tenant_id=l.tenant_id),0) LIMIT 1`,
        [input.purchaseOrderId, context.actor.companyId],
      );
      await tx.query(
        'UPDATE purchase_orders SET status=$1 WHERE id=$2 AND tenant_id=$3 AND status IS DISTINCT FROM $1',
        [
          open.rowCount ? 'PARTIALLY_RECEIVED' : 'RECEIVED',
          input.purchaseOrderId,
          context.actor.companyId,
        ],
      );
      const result = json({
        id: receipt.id,
        status: open.rowCount ? 'PARTIALLY_RECEIVED' : 'RECEIVED',
        canonicalHash: contentHash,
        ...input,
      });
      await evidence(
        tx,
        'goods-receipt.posted',
        'goods-receipt',
        receipt.id,
        context,
        correlationId,
        result,
      );
      return result;
    });
  }

  public move(
    input: {
      movementType:
        | 'ISSUE'
        | 'RETURN'
        | 'TRANSFER_IN'
        | 'TRANSFER_OUT'
        | 'ADJUSTMENT_IN'
        | 'ADJUSTMENT_OUT';
      itemVersionId: string;
      lotId: string;
      locationId: string;
      quantity: string;
      occurredAt: string;
      sourceType: string;
      sourceId: string;
    },
    context: Context,
    correlationId: string,
  ) {
    return this.db.transaction(async (tx) => {
      company(context);
      const positive = ['RETURN', 'TRANSFER_IN', 'ADJUSTMENT_IN'].includes(input.movementType);
      const delta = positive ? input.quantity : `-${input.quantity}`;
      const content = { ...input, quantityDelta: delta };
      const row = (
        await tx.query<{ id: string; sequence: string }>(
          `INSERT INTO inventory_movements(tenant_id,movement_type,item_version_id,lot_id,location_id,quantity_delta,occurred_at,source_type,source_id,canonical_hash,actor_id,correlation_id)
           VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id,sequence::text`,
          [
            context.actor.companyId,
            input.movementType,
            input.itemVersionId,
            input.lotId,
            input.locationId,
            delta,
            input.occurredAt,
            input.sourceType,
            input.sourceId,
            hash(content),
            context.actor.employeeId,
            correlationId,
          ],
        )
      ).rows[0];
      if (!row) throw new Error('Inventory movement insert failed');
      const result = json({
        id: row.id,
        sequence: row.sequence,
        canonicalHash: hash(content),
        ...content,
      });
      await evidence(
        tx,
        'inventory.moved',
        'inventory-movement',
        row.id,
        context,
        correlationId,
        result,
      );
      return result;
    });
  }

  public createLocation(
    input: { code: string; name: string; locationType: string },
    context: Context,
    correlationId: string,
  ) {
    return this.db.transaction(async (tx) => {
      company(context);
      const row = (
        await tx.query<{ id: string }>(
          'INSERT INTO inventory_locations(tenant_id,code,name,location_type) VALUES($1,$2,$3,$4) RETURNING id',
          [context.actor.companyId, input.code, input.name, input.locationType],
        )
      ).rows[0];
      if (!row) throw new Error('Inventory location insert failed');
      const result = json({ id: row.id, active: true, ...input });
      await evidence(
        tx,
        'inventory-location.created',
        'inventory-location',
        row.id,
        context,
        correlationId,
        result,
      );
      return result;
    });
  }
}
