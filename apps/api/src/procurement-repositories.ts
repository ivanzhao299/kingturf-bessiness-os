import { createHash } from 'node:crypto';
import { canonicalize, DomainError, type Actor, type ScopeAnchor } from '@kingturf/domain';
import type { Database, SqlClient } from '@kingturf/database';
import type { DataScope, JsonObject } from '@kingturf/types';

type Db = SqlClient & Pick<Database, 'transaction'>;
type Context = Readonly<{
  actor: Actor;
  scopes: readonly DataScope[];
  anchors: readonly ScopeAnchor[];
}>;
const hash = (value: unknown) => createHash('sha256').update(canonicalize(value)).digest('hex');
const json = (value: unknown) => value as JsonObject;
const company = (context: Context) => {
  if (!context.scopes.includes('COMPANY') && !context.scopes.includes('GROUP'))
    throw new DomainError('forbidden', 'Procurement and inventory require company scope');
};
const evidence = async (
  tx: SqlClient,
  eventType: string,
  aggregateType: string,
  aggregateId: string,
  context: Context,
  correlationId: string,
  payload: JsonObject,
) => {
  await tx.query(
    "INSERT INTO audit_events(action,outcome,actor_id,organization_id,target_type,target_id,correlation_id,metadata) VALUES($1,'SUCCESS',$2,$3,$4,$5,$6,$7)",
    [
      eventType,
      context.actor.employeeId,
      context.actor.companyId,
      aggregateType,
      aggregateId,
      correlationId,
      payload,
    ],
  );
  await tx.query(
    'INSERT INTO domain_event_outbox(tenant_id,event_type,event_version,aggregate_type,aggregate_id,aggregate_version,occurred_at,actor_id,correlation_id,payload) VALUES($1,$2,1,$3,$4,1,now(),$5,$6,$7)',
    [
      context.actor.companyId,
      eventType,
      aggregateType,
      aggregateId,
      context.actor.employeeId,
      correlationId,
      payload,
    ],
  );
};

export class PostgresProcurementRepository {
  public constructor(private readonly db: Db) {}

  public async list(
    view: 'suppliers' | 'rfqs' | 'quotes' | 'orders' | 'receipts' | 'locations' | 'inventory',
    context: Context,
  ) {
    company(context);
    const queries = {
      suppliers: `SELECT to_jsonb(s)||jsonb_build_object('qualifications',coalesce((SELECT jsonb_agg(to_jsonb(q)||jsonb_build_object('sku',i.sku,'itemName',i.name,'itemVersion',v.version) ORDER BY q.created_at DESC) FROM supplier_item_qualifications q JOIN manufacturing_item_versions v ON v.id=q.item_version_id AND v.tenant_id=q.tenant_id JOIN manufacturing_items i ON i.id=v.item_id AND i.tenant_id=v.tenant_id WHERE q.supplier_id=s.id AND q.tenant_id=s.tenant_id),'[]'::jsonb)) item FROM suppliers s WHERE s.tenant_id=$1 ORDER BY s.supplier_number`,
      rfqs: `SELECT to_jsonb(r)||jsonb_build_object('lines',coalesce((SELECT jsonb_agg(to_jsonb(l)||jsonb_build_object('sku',i.sku,'itemName',i.name) ORDER BY l.line_number) FROM procurement_rfq_lines l JOIN manufacturing_item_versions v ON v.id=l.item_version_id AND v.tenant_id=l.tenant_id JOIN manufacturing_items i ON i.id=v.item_id AND i.tenant_id=v.tenant_id WHERE l.rfq_id=r.id AND l.tenant_id=r.tenant_id),'[]'::jsonb)) item FROM procurement_rfqs r WHERE r.tenant_id=$1 ORDER BY r.created_at DESC`,
      quotes: `SELECT to_jsonb(q)||jsonb_build_object('supplierName',s.name,'rfqNumber',r.rfq_number,'lines',coalesce((SELECT jsonb_agg(to_jsonb(l)||jsonb_build_object('lineNumber',rl.line_number,'itemVersionId',rl.item_version_id) ORDER BY rl.line_number) FROM supplier_quote_lines l JOIN procurement_rfq_lines rl ON rl.id=l.rfq_line_id AND rl.tenant_id=l.tenant_id WHERE l.supplier_quote_id=q.id AND l.tenant_id=q.tenant_id),'[]'::jsonb)) item FROM supplier_quotes q JOIN suppliers s ON s.id=q.supplier_id AND s.tenant_id=q.tenant_id JOIN procurement_rfqs r ON r.id=q.rfq_id AND r.tenant_id=q.tenant_id WHERE q.tenant_id=$1 ORDER BY q.received_at DESC`,
      orders: `SELECT to_jsonb(p)||jsonb_build_object('supplierName',s.name,'lines',coalesce((SELECT jsonb_agg(to_jsonb(l)||jsonb_build_object('sku',i.sku,'itemName',i.name,'receivedQuantity',coalesce((SELECT sum(grl.quantity) FROM goods_receipt_lines grl WHERE grl.purchase_order_line_id=l.id AND grl.tenant_id=l.tenant_id),0)) ORDER BY l.line_number) FROM purchase_order_lines l JOIN manufacturing_item_versions v ON v.id=l.item_version_id AND v.tenant_id=l.tenant_id JOIN manufacturing_items i ON i.id=v.item_id AND i.tenant_id=v.tenant_id WHERE l.purchase_order_id=p.id AND l.tenant_id=p.tenant_id),'[]'::jsonb)) item FROM purchase_orders p JOIN suppliers s ON s.id=p.supplier_id AND s.tenant_id=p.tenant_id WHERE p.tenant_id=$1 ORDER BY p.created_at DESC`,
      receipts: `SELECT to_jsonb(g)||jsonb_build_object('poNumber',p.po_number,'lines',coalesce((SELECT jsonb_agg(to_jsonb(l)||jsonb_build_object('lotNumber',lot.lot_number,'locationCode',loc.code,'sku',i.sku) ORDER BY l.id) FROM goods_receipt_lines l JOIN inventory_lots lot ON lot.id=l.lot_id AND lot.tenant_id=l.tenant_id JOIN inventory_locations loc ON loc.id=l.location_id AND loc.tenant_id=l.tenant_id JOIN purchase_order_lines pol ON pol.id=l.purchase_order_line_id AND pol.tenant_id=l.tenant_id JOIN manufacturing_item_versions v ON v.id=pol.item_version_id AND v.tenant_id=pol.tenant_id JOIN manufacturing_items i ON i.id=v.item_id AND i.tenant_id=v.tenant_id WHERE l.goods_receipt_id=g.id AND l.tenant_id=g.tenant_id),'[]'::jsonb)) item FROM goods_receipts g JOIN purchase_orders p ON p.id=g.purchase_order_id AND p.tenant_id=g.tenant_id WHERE g.tenant_id=$1 ORDER BY g.received_at DESC`,
      locations: `SELECT to_jsonb(l) item FROM inventory_locations l WHERE l.tenant_id=$1 ORDER BY l.code`,
      inventory: `SELECT jsonb_build_object('itemVersionId',b.item_version_id,'lotId',b.lot_id,'locationId',b.location_id,'quantity',b.quantity,'lastMovementAt',b.last_movement_at,'sku',i.sku,'itemName',i.name,'lotNumber',lot.lot_number,'qualityStatus',quality.quality_status,'locationCode',loc.code,'movements',coalesce((SELECT jsonb_agg(to_jsonb(m) ORDER BY m.sequence) FROM inventory_movements m WHERE m.tenant_id=b.tenant_id AND m.lot_id=b.lot_id AND m.location_id=b.location_id),'[]'::jsonb)) item FROM inventory_balances b JOIN manufacturing_item_versions v ON v.id=b.item_version_id AND v.tenant_id=b.tenant_id JOIN manufacturing_items i ON i.id=v.item_id AND i.tenant_id=v.tenant_id JOIN inventory_lots lot ON lot.id=b.lot_id AND lot.tenant_id=b.tenant_id JOIN inventory_lot_effective_quality quality ON quality.lot_id=lot.id AND quality.tenant_id=lot.tenant_id JOIN inventory_locations loc ON loc.id=b.location_id AND loc.tenant_id=b.tenant_id WHERE b.tenant_id=$1 ORDER BY i.sku,lot.lot_number,loc.code`,
    } as const;
    return (
      await this.db.query<{ item: JsonObject }>(queries[view], [context.actor.companyId])
    ).rows.map((row) => row.item);
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
           SELECT $1,$2,s.id,$4,$5,$6,$7 FROM suppliers s WHERE s.id=$3 AND s.tenant_id=$1 AND s.status='ACTIVE' RETURNING id`,
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
      if (!row) throw new DomainError('conflict', 'Purchase order requires an active supplier');
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
          await tx.query<{ item_version_id: string; remaining: string }>(
            `SELECT l.item_version_id,(l.quantity-coalesce((SELECT sum(r.quantity) FROM goods_receipt_lines r WHERE r.purchase_order_line_id=l.id AND r.tenant_id=l.tenant_id),0))::text remaining
             FROM purchase_order_lines l WHERE l.id=$1 AND l.purchase_order_id=$2 AND l.tenant_id=$3 FOR UPDATE`,
            [line.purchaseOrderLineId, input.purchaseOrderId, context.actor.companyId],
          )
        ).rows[0];
        if (!poLine || Number(line.quantity) > Number(poLine.remaining))
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
      await tx.query('UPDATE purchase_orders SET status=$1 WHERE id=$2 AND tenant_id=$3', [
        open.rowCount ? 'PARTIALLY_RECEIVED' : 'RECEIVED',
        input.purchaseOrderId,
        context.actor.companyId,
      ]);
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
