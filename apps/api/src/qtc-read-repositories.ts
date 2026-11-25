// FIN-1（ADR-0015）：quote-to-cash 财务域 additive 只读仓储——应收的加性筛选分页与详情聚合。
// 写路径（postAr / intakePayment / reconcile …）、legacy list 与 listOperationalPage 留在
// qtc-repositories.ts，PostgresQuoteToCashRepository 继承本类（沿 production-read-repositories.ts
// 先例，做法同制造 / 采购 / 生产读仓储拆分）。
//
// 口径（与 legacy 一致，行为守恒）：
//   · 数据范围：客户记录作用域谓词 recordScopeSql(…, 'c', …)——与 legacy listOperationalPage('ar')
//     同一条谓词、同一偏移；
//   · 行序与键集：ORDER BY b.due_at, b.id；游标 = 末行应收开放项 id，键集 (due_at, id)；
//   · 逾期：未核销余额 > 0 且 due_at < now()——与 legacy state=OVERDUE 同式。
// 加性键均为 camelCase：金额以 numeric(24,6) 的十进制文本给出（::text，不经 JSON 数字转译）；
// legacy 的 to_jsonb 蛇形键原样保留。
import type { Actor, ScopeAnchor } from '@kingturf/domain';
import type { Database, SqlClient } from '@kingturf/database';
import type { DataScope, JsonObject, Page } from '@kingturf/types';
import { permittedDto } from './app-values.ts';
import { recordScopeSql } from './scope-sql.ts';

type Db = SqlClient & Pick<Database, 'transaction'>;
export type FinancialReadContext = Readonly<{
  actor: Actor;
  scopes: readonly DataScope[];
  anchors: readonly ScopeAnchor[];
}>;

// 应收行投影：legacy listOperationalPage('ar') 的 to_jsonb(b)||documentNumber/documentType/
// salesOrderId 三键（同式）+ 加性键（customerName / orderNumber / postedAt / 三个金额文本 /
// overdueDays / agingState）。加性分页与详情根行共用同一片段（G3 白名单登记）；legacy
// listOperationalPage 未改动。
export const AR_ROW_PROJECTION = `to_jsonb(b)||jsonb_build_object('documentNumber',d.document_number,'documentType',d.document_type,'salesOrderId',d.sales_order_id,'customerName',c.name,'orderNumber',o.order_number,'postedAt',d.posted_at,'originalAmount',b.original_amount::text,'appliedAmount',(b.original_amount-b.remaining_amount)::text,'remainingAmount',b.remaining_amount::text,'overdueDays',greatest(0,floor(extract(epoch FROM(now()-b.due_at))/86400))::int,'agingState',CASE WHEN b.remaining_amount=0 THEN 'CLEARED' WHEN b.due_at<now() THEN 'OVERDUE' ELSE 'OPEN' END)`;

// 应收分页只读过滤器。state 的 OPEN / CLEARED / OVERDUE 与 legacy 同义；NOT_DUE 为加性取值
// （未核销余额 > 0 且到期时间不早于当前时刻）。search 为加性关键字（单据号 / 客户名称 /
// 销售订单号，大小写不敏感的字面子串，无通配符语义）。
export type ArListState = 'OPEN' | 'CLEARED' | 'OVERDUE' | 'NOT_DUE';
export type ArPageFilter = Readonly<{
  state?: ArListState;
  search?: string;
  query?: string;
  from?: string;
  to?: string;
  minAmount?: string;
  maxAmount?: string;
  cursor?: string;
  limit?: number;
}>;
export type FinancialRelatedRead = FinancialReadContext &
  Readonly<{ fields: readonly string[] | null }>;
export type ArRelatedRead = Readonly<{
  order: FinancialRelatedRead | null;
  payment: FinancialRelatedRead | null;
}>;
export type ArListRead = Readonly<{
  order: FinancialRelatedRead | null;
  fields: readonly string[] | null;
}>;

export const canReadFinField = (fields: readonly string[] | null, ...names: string[]): boolean =>
  fields === null || names.some((name) => fields.includes(name));
// 应收汇总（按币种，互不相加；金额为不限整数位数的十进制文本，由 SQL 精确聚合）。口径：
//   未核销余额 = 未核销余额 > 0 的应收单的余额合计；已逾期 = 其中到期时间早于当前时刻；
//   7 天 / 30 天内到期 = 未逾期且到期时间落在当前时刻起 N 天之内（30 天含 7 天）。
export type ArCurrencySummary = Readonly<{
  currency: string;
  openCount: number;
  outstandingAmount: string;
  overdueCount: number;
  overdueAmount: string;
  due7Count: number;
  due7Amount: string;
  due30Count: number;
  due30Amount: string;
}>;

const PAGE_LIMIT_MAX = 100;
const AR_JOINS = ` FROM ar_open_item_balances b JOIN ar_documents d ON d.id=b.ar_document_id AND d.tenant_id=b.tenant_id JOIN customers c ON c.id=b.customer_id AND c.tenant_id=b.tenant_id`;

export class PostgresQuoteToCashReadRepository {
  public constructor(protected readonly db: Db) {}

  // 应收加性分页：legacy listOperationalPage('ar') 的同一组过滤子句（query / from / to /
  // minAmount / maxAmount / 三种 state / 键集游标，逐字同式）+ 加性 state=NOT_DUE 与 search。
  // 过滤值、关键字、游标、limit 全部 values.push 参数化。
  public async listArPage(
    context: FinancialReadContext,
    filter: ArPageFilter,
    read: ArListRead = { order: null, fields: null },
  ): Promise<Page<JsonObject>> {
    const secured = recordScopeSql(context.scopes, context.anchors, context.actor, 'c', 2);
    const order =
      read.order && canReadFinField(read.order.fields, 'order_number') ? read.order : null;
    // The AR document guard binds the sales order to the same customer as the AR open item.
    const orderScope = order
      ? recordScopeSql(order.scopes, order.anchors, order.actor, 'c', 2 + secured.values.length)
      : { sql: 'FALSE', values: [] };
    const values: unknown[] = [context.actor.companyId, ...secured.values, ...orderScope.values];
    const add = (value: unknown): string => {
      values.push(value);
      return `$${String(values.length)}`;
    };
    const clauses = ['b.tenant_id=$1', secured.sql];
    if (filter.search) {
      const parameter = add(filter.search.toLowerCase());
      clauses.push(
        `strpos(lower(concat_ws(' ',CASE WHEN ${add(canReadFinField(read.fields, 'documentNumber'))} THEN d.document_number END,CASE WHEN ${add(canReadFinField(read.fields, 'customerName'))} THEN c.name END,CASE WHEN ${add(canReadFinField(read.fields, 'orderNumber'))} THEN o.order_number END)),${parameter})>0`,
      );
    }
    if (filter.query) {
      const parameter = add(`%${filter.query}%`);
      clauses.push(`(d.document_number ILIKE ${parameter} OR c.name ILIKE ${parameter})`);
    }
    if (filter.from) clauses.push(`b.due_at>=${add(filter.from)}::timestamptz`);
    if (filter.to) clauses.push(`b.due_at<=${add(filter.to)}::timestamptz`);
    if (filter.minAmount) clauses.push(`b.remaining_amount>=${add(filter.minAmount)}::numeric`);
    if (filter.maxAmount) clauses.push(`b.remaining_amount<=${add(filter.maxAmount)}::numeric`);
    if (filter.state === 'OPEN' || filter.state === 'NOT_DUE') clauses.push('b.remaining_amount>0');
    if (filter.state === 'CLEARED') clauses.push('b.remaining_amount=0');
    if (filter.state === 'OVERDUE') clauses.push('b.remaining_amount>0 AND b.due_at<now()');
    if (filter.state === 'NOT_DUE') clauses.push('b.due_at>=now()');
    if (filter.cursor) {
      const parameter = add(filter.cursor);
      clauses.push(
        `(b.due_at,b.id)>(SELECT x.due_at,x.id FROM ar_open_item_balances x WHERE x.tenant_id=$1 AND x.id=${parameter}::uuid)`,
      );
    }
    const limit = Math.min(Math.max(filter.limit ?? 50, 1), PAGE_LIMIT_MAX);
    values.push(limit + 1);
    const select = `SELECT b.id,${AR_ROW_PROJECTION} AS item${AR_JOINS} LEFT JOIN sales_orders o ON o.tenant_id=d.tenant_id AND o.id=d.sales_order_id AND ${orderScope.sql} WHERE ${clauses.join(' AND ')} ORDER BY b.due_at,b.id LIMIT $${String(values.length)}`;
    const rows = await this.db.query<{ id: string; item: JsonObject }>(select, values);
    return {
      items: rows.rows.slice(0, limit).map((row) => row.item),
      nextCursor: rows.rows.length > limit ? (rows.rows[limit - 1]?.id ?? null) : null,
    };
  }

  // 应收汇总（additive 只读）：数据范围与列表同一条客户记录作用域谓词；与筛选、分页无关。
  public async summarizeAr(context: FinancialReadContext): Promise<readonly ArCurrencySummary[]> {
    const secured = recordScopeSql(context.scopes, context.anchors, context.actor, 'c', 2);
    // 整条语句是静态 SQL：除作用域谓词片段外不做任何拼接（G3）。
    return (
      await this.db.query<ArCurrencySummary>(
        `SELECT b.currency::text currency,
      count(*) FILTER (WHERE b.remaining_amount>0)::int "openCount",
      coalesce(sum(b.remaining_amount) FILTER (WHERE b.remaining_amount>0),0.000000)::text "outstandingAmount",
      count(*) FILTER (WHERE b.remaining_amount>0 AND b.due_at<now())::int "overdueCount",
      coalesce(sum(b.remaining_amount) FILTER (WHERE b.remaining_amount>0 AND b.due_at<now()),0.000000)::text "overdueAmount",
      count(*) FILTER (WHERE b.remaining_amount>0 AND b.due_at>=now() AND b.due_at<now()+interval '7 days')::int "due7Count",
      coalesce(sum(b.remaining_amount) FILTER (WHERE b.remaining_amount>0 AND b.due_at>=now() AND b.due_at<now()+interval '7 days'),0.000000)::text "due7Amount",
      count(*) FILTER (WHERE b.remaining_amount>0 AND b.due_at>=now() AND b.due_at<now()+interval '30 days')::int "due30Count",
      coalesce(sum(b.remaining_amount) FILTER (WHERE b.remaining_amount>0 AND b.due_at>=now() AND b.due_at<now()+interval '30 days'),0.000000)::text "due30Amount"
      FROM ar_open_item_balances b JOIN ar_documents d ON d.id=b.ar_document_id AND d.tenant_id=b.tenant_id JOIN customers c ON c.id=b.customer_id AND c.tenant_id=b.tenant_id
      WHERE b.tenant_id=$1 AND ${secured.sql} GROUP BY b.currency ORDER BY b.currency`,
        [context.actor.companyId, ...secured.values],
      )
    ).rows;
  }

  // 应收详情（additive 只读）：根行（同投影）+ 关联销售订单摘要 + 核销分配记录。
  // 不存在或不在数据范围内返回 null。
  public async findArOpenItem(
    arOpenItemId: string,
    context: FinancialReadContext,
    parts: ArRelatedRead = { order: null, payment: null },
  ): Promise<JsonObject | null> {
    const secured = recordScopeSql(context.scopes, context.anchors, context.actor, 'c', 3);
    const key: unknown[] = [context.actor.companyId, arOpenItemId];
    const order =
      parts.order && canReadFinField(parts.order.fields, 'order_number') ? parts.order : null;
    const orderScope = order
      ? recordScopeSql(order.scopes, order.anchors, order.actor, 'c', 3 + secured.values.length)
      : { sql: 'FALSE', values: [] };
    const root = (
      await this.db.query<{ item: JsonObject }>(
        `SELECT ${AR_ROW_PROJECTION} AS item${AR_JOINS} LEFT JOIN sales_orders o ON o.tenant_id=d.tenant_id AND o.id=d.sales_order_id AND ${orderScope.sql} WHERE b.tenant_id=$1 AND b.id=$2 AND ${secured.sql}`,
        [...key, ...secured.values, ...orderScope.values],
      )
    ).rows[0]?.item;
    if (!root) return null;
    const salesOrderId = root.salesOrderId;
    const [orderSummary, allocations] = await Promise.all([
      parts.order && typeof salesOrderId === 'string'
        ? this.arOrderSummary(salesOrderId, parts.order)
        : Promise.resolve(null),
      this.arAllocations(key, parts.payment),
    ]);
    return {
      ...root,
      ...(orderSummary === null ? {} : { order: orderSummary }),
      allocations,
    };
  }

  private async arOrderSummary(id: string, read: FinancialRelatedRead): Promise<JsonObject | null> {
    const secured = recordScopeSql(read.scopes, read.anchors, read.actor, 'c', 3);
    const row = (
      await this.db.query<{ item: JsonObject }>(
        `SELECT jsonb_build_object('id',o.id,'order_number',o.order_number,'status',o.status,'currency',o.currency,'total',o.total::text,'created_at',o.created_at) item FROM sales_orders o JOIN customers c ON c.id=o.customer_id AND c.tenant_id=o.tenant_id WHERE o.tenant_id=$1 AND o.id=$2 AND ${secured.sql}`,
        [read.actor.companyId, id, ...secured.values],
      )
    ).rows[0]?.item;
    if (!row) return null;
    const visible = permittedDto(row, read.fields);
    const { order_number: orderNumber, created_at: createdAt, ...rest } = visible;
    return {
      ...rest,
      ...(orderNumber === undefined ? {} : { orderNumber }),
      ...(createdAt === undefined ? {} : { createdAt }),
    };
  }

  // A customer-scoped LEFT JOIN keeps allocation rows even when payment fields are out of scope.
  private async arAllocations(
    key: readonly unknown[],
    read: FinancialRelatedRead | null,
  ): Promise<readonly JsonObject[]> {
    const secured = read ? recordScopeSql(read.scopes, read.anchors, read.actor, 'c', 3) : null;
    const result = secured
      ? await this.db.query<{ item: JsonObject }>(
          `SELECT jsonb_build_object('id',a.id,'amount',a.amount::text,'currency',a.currency,'allocationOrder',a.allocation_order,'createdAt',a.created_at,'reconciliationRunId',a.reconciliation_run_id,'bankPaymentId',a.bank_payment_id,'bank_reference',p.bank_reference,'received_at',p.received_at) item FROM allocation_entries a LEFT JOIN (bank_payments p JOIN customers c ON c.tenant_id=p.tenant_id AND c.id=p.customer_id) ON p.tenant_id=a.tenant_id AND p.id=a.bank_payment_id AND ${secured.sql} WHERE a.tenant_id=$1 AND a.ar_open_item_id=$2 ORDER BY a.allocation_order,a.created_at,a.id`,
          [...key, ...secured.values],
        )
      : await this.db.query<{ item: JsonObject }>(
          `SELECT jsonb_build_object('id',a.id,'amount',a.amount::text,'currency',a.currency,'allocationOrder',a.allocation_order,'createdAt',a.created_at,'reconciliationRunId',a.reconciliation_run_id,'bankPaymentId',a.bank_payment_id) item FROM allocation_entries a WHERE a.tenant_id=$1 AND a.ar_open_item_id=$2 ORDER BY a.allocation_order,a.created_at,a.id`,
          key,
        );
    return result.rows.map(({ item: { bank_reference, received_at, ...item } }) => ({
      ...item,
      ...(typeof bank_reference === 'string' &&
      read &&
      canReadFinField(read.fields, 'bank_reference')
        ? { bankReference: bank_reference }
        : {}),
      ...(typeof received_at === 'string' && read && canReadFinField(read.fields, 'received_at')
        ? { paymentReceivedAt: received_at }
        : {}),
    }));
  }
}
