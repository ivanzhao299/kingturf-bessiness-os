// U3-PROC-1..3（ADR-0015）：供应链域 additive 只读仓储（自 procurement-repositories
// 拆分——G1 ≤800 行纪律；方法体与投影 SQL 逐字节迁移，行为守恒）。写路径仍留在
// procurement-repositories.ts（PostgresProcurementRepository 继承本类）。
import { DomainError, type Actor, type ScopeAnchor } from '@kingturf/domain';
import type { Database, SqlClient } from '@kingturf/database';
import type { DataScope, JsonObject } from '@kingturf/types';

export type Db = SqlClient & Pick<Database, 'transaction'>;
export type Context = Readonly<{
  actor: Actor;
  scopes: readonly DataScope[];
  anchors: readonly ScopeAnchor[];
}>;
export const company = (context: Context) => {
  if (!context.scopes.includes('COMPANY') && !context.scopes.includes('GROUP'))
    throw new DomainError('forbidden', 'Procurement and inventory require company scope');
};
export const json = (value: unknown) => value as JsonObject;

// U3-PROC-1：供应商行投影（to_jsonb 蛇形键 + qualifications 聚合）——list 与
// additive 分页/单行只读共用同一片段（字节一致，行为守恒）。
export const SUPPLIER_ITEM_PROJECTION = `to_jsonb(s)||jsonb_build_object('qualifications',coalesce((SELECT jsonb_agg(to_jsonb(q)||jsonb_build_object('sku',i.sku,'itemName',i.name,'itemVersion',v.version) ORDER BY q.created_at DESC) FROM supplier_item_qualifications q JOIN manufacturing_item_versions v ON v.id=q.item_version_id AND v.tenant_id=q.tenant_id JOIN manufacturing_items i ON i.id=v.item_id AND i.tenant_id=v.tenant_id WHERE q.supplier_id=s.id AND q.tenant_id=s.tenant_id),'[]'::jsonb))`;

// U3-PROC-1（ADR-0015）：供应商分页只读过滤器——limit 缺省=全量（legacy list 无
// LIMIT，行为守恒）；cursor=supplier_number keyset（(tenant_id,supplier_number)
// 唯一，排序键 ORDER BY s.supplier_number 与 list 一致）；status 筛选枚举同表约束。
export type SupplierPageFilter = Readonly<{
  limit?: number;
  cursor?: string;
  status?: 'ACTIVE' | 'ON_HOLD' | 'INACTIVE';
}>;
export type SupplierPage = Readonly<{ items: readonly JsonObject[]; nextCursor: string | null }>;

// U3-PROC-2：RFQ 行投影（to_jsonb 蛇形键 + lines 聚合）——list 与 additive 只读
// 共用同一片段（字节一致，行为守恒）。
export const RFQ_ITEM_PROJECTION = `to_jsonb(r)||jsonb_build_object('lines',coalesce((SELECT jsonb_agg(to_jsonb(l)||jsonb_build_object('sku',i.sku,'itemName',i.name) ORDER BY l.line_number) FROM procurement_rfq_lines l JOIN manufacturing_item_versions v ON v.id=l.item_version_id AND v.tenant_id=l.tenant_id JOIN manufacturing_items i ON i.id=v.item_id AND i.tenant_id=v.tenant_id WHERE l.rfq_id=r.id AND l.tenant_id=r.tenant_id),'[]'::jsonb))`;

// U3-PROC-2（ADR-0015）：RFQ 列表过滤器——status 枚举同 procurement_document_status；
// legacy 列表无 LIMIT/筛选，全量语义保持（filter 为空时与 list('rfqs') 逐字节一致）。
export type RfqListFilter = Readonly<{
  status?: 'DRAFT' | 'ISSUED' | 'PARTIALLY_RECEIVED' | 'RECEIVED' | 'CANCELLED';
}>;

// U3-PROC-4：收货单行投影（to_jsonb 蛇形键 + poNumber + lines 批次/库位聚合）——
// list 与 additive 只读共用同一片段（字节一致，行为守恒）。
export const GOODS_RECEIPT_ITEM_PROJECTION = `to_jsonb(g)||jsonb_build_object('poNumber',p.po_number,'lines',coalesce((SELECT jsonb_agg(to_jsonb(l)||jsonb_build_object('lotNumber',lot.lot_number,'locationCode',loc.code,'sku',i.sku) ORDER BY l.id) FROM goods_receipt_lines l JOIN inventory_lots lot ON lot.id=l.lot_id AND lot.tenant_id=l.tenant_id JOIN inventory_locations loc ON loc.id=l.location_id AND loc.tenant_id=l.tenant_id JOIN purchase_order_lines pol ON pol.id=l.purchase_order_line_id AND pol.tenant_id=l.tenant_id JOIN manufacturing_item_versions v ON v.id=pol.item_version_id AND v.tenant_id=pol.tenant_id JOIN manufacturing_items i ON i.id=v.item_id AND i.tenant_id=v.tenant_id WHERE l.goods_receipt_id=g.id AND l.tenant_id=g.tenant_id),'[]'::jsonb))`;

// U3-PROC-3：采购单行投影（to_jsonb 蛇形键 + supplierName + lines 含 receivedQuantity
// 聚合）——list 与 additive 只读共用同一片段（字节一致，行为守恒）。
export const PURCHASE_ORDER_ITEM_PROJECTION = `to_jsonb(p)||jsonb_build_object('supplierName',s.name,'lines',coalesce((SELECT jsonb_agg(to_jsonb(l)||jsonb_build_object('sku',i.sku,'itemName',i.name,'receivedQuantity',coalesce((SELECT sum(grl.quantity) FROM goods_receipt_lines grl WHERE grl.purchase_order_line_id=l.id AND grl.tenant_id=l.tenant_id),0)) ORDER BY l.line_number) FROM purchase_order_lines l JOIN manufacturing_item_versions v ON v.id=l.item_version_id AND v.tenant_id=l.tenant_id JOIN manufacturing_items i ON i.id=v.item_id AND i.tenant_id=v.tenant_id WHERE l.purchase_order_id=p.id AND l.tenant_id=p.tenant_id),'[]'::jsonb))`;

export class PostgresProcurementReadRepository {
  public constructor(protected readonly db: Db) {}

  // U3-PROC-1（ADR-0015）：供应商 keyset cursor 分页只读（additive）——投影与排序
  // 键（supplier_number）与 list('suppliers') 一致；无 limit 时全量（nextCursor
  // 恒 null——默认路径与 legacy 逐字节一致），显式 limit 才启用分页窗口。
  public async listSupplierPage(
    context: Context,
    filter: SupplierPageFilter,
  ): Promise<SupplierPage> {
    company(context);
    const values: unknown[] = [context.actor.companyId];
    const add = (value: unknown): string => {
      values.push(value);
      return `$${String(values.length)}`;
    };
    const clauses: string[] = [];
    if (filter.status !== undefined) clauses.push(`s.status=${add(filter.status)}`);
    // (tenant_id,supplier_number) 唯一——键集游标可直接比较文本，无需回表子查询。
    if (filter.cursor !== undefined) clauses.push(`s.supplier_number>${add(filter.cursor)}`);
    let limitClause = '';
    let limit: number | null = null;
    if (filter.limit !== undefined) {
      limit = Math.min(Math.max(filter.limit, 1), 500);
      values.push(limit + 1);
      limitClause = ` LIMIT $${String(values.length)}`;
    }
    const rows = (
      await this.db.query<{ item: JsonObject }>(
        `SELECT ${SUPPLIER_ITEM_PROJECTION} item FROM suppliers s WHERE s.tenant_id=$1${clauses.length > 0 ? ` AND ${clauses.join(' AND ')}` : ''} ORDER BY s.supplier_number${limitClause}`,
        values,
      )
    ).rows;
    const items = (limit === null ? rows : rows.slice(0, limit)).map((row) => row.item);
    const last = limit === null ? null : rows.length > limit ? items[limit - 1] : null;
    return {
      items,
      nextCursor: typeof last?.supplier_number === 'string' ? last.supplier_number : null,
    };
  }

  // U3-PROC-1（ADR-0015）：供应商单行只读（additive；list 同投影单行）。
  public async findSupplier(id: string, context: Context): Promise<JsonObject | null> {
    company(context);
    const row = (
      await this.db.query<{ item: JsonObject }>(
        `SELECT ${SUPPLIER_ITEM_PROJECTION} item FROM suppliers s WHERE s.tenant_id=$1 AND s.id=$2`,
        [context.actor.companyId, id],
      )
    ).rows[0];
    return row?.item ?? null;
  }

  // U3-PROC-2（ADR-0015）：RFQ 列表只读（additive）——投影/排序键（created_at DESC）
  // 与 list('rfqs') 一致；filter 为空时 items 与 legacy 全量逐字节一致，status 筛选
  // 参数化；页对象形态（nextCursor 恒 null——legacy 无 LIMIT，无分页窗口）。
  public async listRfqs(
    context: Context,
    filter: RfqListFilter,
  ): Promise<Readonly<{ items: readonly JsonObject[]; nextCursor: null }>> {
    company(context);
    const values: unknown[] = [context.actor.companyId];
    let statusClause = '';
    if (filter.status !== undefined) {
      values.push(filter.status);
      statusClause = ` AND r.status=$2`;
    }
    return {
      items: (
        await this.db.query<{ item: JsonObject }>(
          `SELECT ${RFQ_ITEM_PROJECTION} item FROM procurement_rfqs r WHERE r.tenant_id=$1${statusClause} ORDER BY r.created_at DESC`,
          values,
        )
      ).rows.map((row) => row.item),
      nextCursor: null,
    };
  }

  // U3-PROC-2（ADR-0015）：RFQ 详情只读（additive）——根行（list 同投影字段）+
  // 行项（同 lines 聚合）+ 报价对比（quotes：报价头 + 逐行单价/承诺日/MOQ，
  // 供比价呈现；supplier_quote_lines.unit_price 经 additive 只读暴露）。
  public async findRfq(id: string, context: Context): Promise<JsonObject | null> {
    company(context);
    const row = (
      await this.db.query<{ item: JsonObject }>(
        `SELECT to_jsonb(r)
          ||jsonb_build_object('lines',coalesce((SELECT jsonb_agg(to_jsonb(l)||jsonb_build_object('sku',i.sku,'itemName',i.name) ORDER BY l.line_number) FROM procurement_rfq_lines l JOIN manufacturing_item_versions v ON v.id=l.item_version_id AND v.tenant_id=l.tenant_id JOIN manufacturing_items i ON i.id=v.item_id AND i.tenant_id=v.tenant_id WHERE l.rfq_id=r.id AND l.tenant_id=r.tenant_id),'[]'::jsonb))
          ||jsonb_build_object('quotes',coalesce((SELECT jsonb_agg(to_jsonb(q)||jsonb_build_object('supplierName',s.name,'lines',coalesce((SELECT jsonb_agg(to_jsonb(l)||jsonb_build_object('lineNumber',rl.line_number,'sku',i.sku) ORDER BY l.id) FROM supplier_quote_lines l JOIN procurement_rfq_lines rl ON rl.id=l.rfq_line_id AND rl.tenant_id=l.tenant_id JOIN manufacturing_item_versions v ON v.id=rl.item_version_id AND v.tenant_id=rl.tenant_id JOIN manufacturing_items i ON i.id=v.item_id AND i.tenant_id=v.tenant_id WHERE l.supplier_quote_id=q.id AND l.tenant_id=q.tenant_id),'[]'::jsonb)) ORDER BY q.received_at) FROM supplier_quotes q JOIN suppliers s ON s.id=q.supplier_id AND s.tenant_id=q.tenant_id WHERE q.rfq_id=r.id AND q.tenant_id=r.tenant_id),'[]'::jsonb)) item
        FROM procurement_rfqs r WHERE r.tenant_id=$1 AND r.id=$2`,
        [context.actor.companyId, id],
      )
    ).rows[0];
    return row?.item ?? null;
  }

  // U3-PROC-3（ADR-0015）：采购单列表只读（additive）——投影/排序键（created_at DESC）
  // 与 list('orders') 一致；filter 为空时 items 与 legacy 全量逐字节一致，status 筛选
  // 参数化；页对象形态（nextCursor 恒 null——legacy 无 LIMIT，无分页窗口）。
  public async listPurchaseOrders(
    context: Context,
    filter: RfqListFilter,
  ): Promise<Readonly<{ items: readonly JsonObject[]; nextCursor: null }>> {
    company(context);
    const values: unknown[] = [context.actor.companyId];
    let statusClause = '';
    if (filter.status !== undefined) {
      values.push(filter.status);
      statusClause = ` AND p.status=$2`;
    }
    return {
      items: (
        await this.db.query<{ item: JsonObject }>(
          `SELECT ${PURCHASE_ORDER_ITEM_PROJECTION} item FROM purchase_orders p JOIN suppliers s ON s.id=p.supplier_id AND s.tenant_id=p.tenant_id WHERE p.tenant_id=$1${statusClause} ORDER BY p.created_at DESC`,
          values,
        )
      ).rows.map((row) => row.item),
      nextCursor: null,
    };
  }

  // U3-PROC-3（ADR-0015）：采购单详情只读（additive）——根行（list 同投影字段）+
  // 行项（含 receivedQuantity 收货状态）+ 关联收货单（收货进度：批次/库位/数量）。
  public async findPurchaseOrder(id: string, context: Context): Promise<JsonObject | null> {
    company(context);
    const row = (
      await this.db.query<{ item: JsonObject }>(
        `SELECT to_jsonb(p)
          ||jsonb_build_object('supplierName',s.name,'lines',coalesce((SELECT jsonb_agg(to_jsonb(l)||jsonb_build_object('sku',i.sku,'itemName',i.name,'receivedQuantity',coalesce((SELECT sum(grl.quantity) FROM goods_receipt_lines grl WHERE grl.purchase_order_line_id=l.id AND grl.tenant_id=l.tenant_id),0)) ORDER BY l.line_number) FROM purchase_order_lines l JOIN manufacturing_item_versions v ON v.id=l.item_version_id AND v.tenant_id=l.tenant_id JOIN manufacturing_items i ON i.id=v.item_id AND i.tenant_id=v.tenant_id WHERE l.purchase_order_id=p.id AND l.tenant_id=p.tenant_id),'[]'::jsonb))
          ||jsonb_build_object('receipts',coalesce((SELECT jsonb_agg(to_jsonb(g)||jsonb_build_object('lines',coalesce((SELECT jsonb_agg(to_jsonb(l)||jsonb_build_object('lotNumber',lot.lot_number,'locationCode',loc.code,'sku',i.sku) ORDER BY l.id) FROM goods_receipt_lines l JOIN inventory_lots lot ON lot.id=l.lot_id AND lot.tenant_id=l.tenant_id JOIN inventory_locations loc ON loc.id=l.location_id AND loc.tenant_id=l.tenant_id JOIN purchase_order_lines pol ON pol.id=l.purchase_order_line_id AND pol.tenant_id=l.tenant_id JOIN manufacturing_item_versions v ON v.id=pol.item_version_id AND v.tenant_id=pol.tenant_id JOIN manufacturing_items i ON i.id=v.item_id AND i.tenant_id=v.tenant_id WHERE l.goods_receipt_id=g.id AND l.tenant_id=g.tenant_id),'[]'::jsonb)) ORDER BY g.received_at) FROM goods_receipts g WHERE g.purchase_order_id=p.id AND g.tenant_id=p.tenant_id),'[]'::jsonb)) item
        FROM purchase_orders p JOIN suppliers s ON s.id=p.supplier_id AND s.tenant_id=p.tenant_id WHERE p.tenant_id=$1 AND p.id=$2`,
        [context.actor.companyId, id],
      )
    ).rows[0];
    return row?.item ?? null;
  }

  // U3-PROC-4（ADR-0015）：收货单列表只读（additive）——投影/排序键（received_at DESC）
  // 与 list('receipts') 一致，页对象形态（收货单不可变事实，无筛选/分页窗口）。
  public async listGoodsReceipts(
    context: Context,
  ): Promise<Readonly<{ items: readonly JsonObject[]; nextCursor: null }>> {
    company(context);
    return {
      items: (
        await this.db.query<{ item: JsonObject }>(
          `SELECT ${GOODS_RECEIPT_ITEM_PROJECTION} item FROM goods_receipts g JOIN purchase_orders p ON p.id=g.purchase_order_id AND p.tenant_id=g.tenant_id WHERE g.tenant_id=$1 ORDER BY g.received_at DESC`,
          [context.actor.companyId],
        )
      ).rows.map((row) => row.item),
      nextCursor: null,
    };
  }

  // U3-PROC-4（ADR-0015）：收货单详情只读（additive）——根行（list 同投影字段）+
  // 批次行项（lot/location/sku/quantity）+ 关联采购单数量核对（poNumber/status/
  // 行项 quantity vs receivedQuantity）。
  public async findGoodsReceipt(id: string, context: Context): Promise<JsonObject | null> {
    company(context);
    const row = (
      await this.db.query<{ item: JsonObject }>(
        `SELECT to_jsonb(g)
          ||jsonb_build_object('poNumber',p.po_number,'poStatus',p.status,'lines',coalesce((SELECT jsonb_agg(to_jsonb(l)||jsonb_build_object('lotNumber',lot.lot_number,'locationCode',loc.code,'sku',i.sku) ORDER BY l.id) FROM goods_receipt_lines l JOIN inventory_lots lot ON lot.id=l.lot_id AND lot.tenant_id=l.tenant_id JOIN inventory_locations loc ON loc.id=l.location_id AND loc.tenant_id=l.tenant_id JOIN purchase_order_lines pol ON pol.id=l.purchase_order_line_id AND pol.tenant_id=l.tenant_id JOIN manufacturing_item_versions v ON v.id=pol.item_version_id AND v.tenant_id=pol.tenant_id JOIN manufacturing_items i ON i.id=v.item_id AND i.tenant_id=v.tenant_id WHERE l.goods_receipt_id=g.id AND l.tenant_id=g.tenant_id),'[]'::jsonb))
          ||jsonb_build_object('purchaseOrder',jsonb_build_object('id',p.id,'poNumber',p.po_number,'status',p.status,'lines',coalesce((SELECT jsonb_agg(to_jsonb(pol)||jsonb_build_object('sku',i.sku,'itemName',i.name,'quantity',pol.quantity,'receivedQuantity',coalesce((SELECT sum(grl.quantity) FROM goods_receipt_lines grl WHERE grl.purchase_order_line_id=pol.id AND grl.tenant_id=pol.tenant_id),0)) ORDER BY pol.line_number) FROM purchase_order_lines pol JOIN manufacturing_item_versions v ON v.id=pol.item_version_id AND v.tenant_id=pol.tenant_id JOIN manufacturing_items i ON i.id=v.item_id AND i.tenant_id=v.tenant_id WHERE pol.purchase_order_id=p.id AND pol.tenant_id=p.tenant_id),'[]'::jsonb))) item
        FROM goods_receipts g JOIN purchase_orders p ON p.id=g.purchase_order_id AND p.tenant_id=g.tenant_id WHERE g.tenant_id=$1 AND g.id=$2`,
        [context.actor.companyId, id],
      )
    ).rows[0];
    return row?.item ?? null;
  }
}
