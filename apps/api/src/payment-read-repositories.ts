import type { JsonObject, OperationalListFilter, Page } from '@kingturf/types';
import {
  canReadFinField,
  PostgresQuoteToCashReadRepository,
  type FinancialReadContext,
  type FinancialRelatedRead,
} from './qtc-read-repositories.ts';
import { recordScopeSql } from './scope-sql.ts';

export type PaymentPageFilter = OperationalListFilter & Readonly<{ search?: string }>;
export type ReconciliationPageFilter = Readonly<{
  limit: number;
  cursor?: string;
  state?: string;
  search?: string;
}>;

type Row = { id: string; item: JsonObject };
const PAYMENT_PROJECTION = `to_jsonb(p)||jsonb_build_object('customerName',c.name,'bankReference',p.bank_reference,'receivedAt',p.received_at,'registeredAt',a.created_at,'originalAmount',p.amount::text,'appliedAmount',(p.amount-p.remaining_amount)::text,'remainingAmount',p.remaining_amount::text)`;
const PAYMENT_FROM = ` FROM bank_payment_balances p JOIN customers c ON c.id=p.customer_id AND c.tenant_id=p.tenant_id LEFT JOIN commercial_command_results a ON a.tenant_id=p.tenant_id AND a.idempotency_key=p.idempotency_key AND a.command_type='BANK_PAYMENT_INTAKE' AND a.payload->>'id'=p.id::text`;
const RUN_PROJECTION = `to_jsonb(r)||jsonb_build_object('createdAt',r.created_at,'resultHash',r.result_hash,'matchCount',jsonb_array_length(r.calculation_trace->'allocations'))`;
const RUN_FROM = ` FROM reconciliation_runs r JOIN bank_payments p ON p.id=(r.input->>'paymentId')::uuid AND p.tenant_id=r.tenant_id JOIN customers c ON c.id=p.customer_id AND c.tenant_id=p.tenant_id`;

const pageOf = (rows: readonly Row[], limit: number): Page<JsonObject> => ({
  items: rows.slice(0, limit).map(({ item }) => item),
  nextCursor: rows.length > limit ? (rows[limit - 1]?.id ?? null) : null,
});

export class PostgresPaymentReadRepository extends PostgresQuoteToCashReadRepository {
  public async listPaymentPage(
    read: FinancialRelatedRead,
    filter: PaymentPageFilter,
  ): Promise<Page<JsonObject>> {
    const secured = recordScopeSql(read.scopes, read.anchors, read.actor, 'c', 13);
    const limit = filter.limit ?? 50;
    const rows = await this.db.query<Row>(
      `SELECT p.id,${PAYMENT_PROJECTION} AS item${PAYMENT_FROM}
       WHERE p.tenant_id=$1 AND ${secured.sql}
         AND ($2::text IS NULL OR strpos(lower(concat_ws(' ',CASE WHEN $3::boolean THEN p.bank_reference END,CASE WHEN $4::boolean THEN c.name END)),$2)>0)
         AND ($5::text IS NULL OR p.bank_reference ILIKE $5 OR c.name ILIKE $5)
         AND ($6::text IS NULL OR ($6='OPEN' AND p.remaining_amount>0) OR ($6='CLEARED' AND p.remaining_amount=0))
         AND ($7::timestamptz IS NULL OR p.received_at >= $7)
         AND ($8::timestamptz IS NULL OR p.received_at <= $8)
         AND ($9::numeric IS NULL OR p.remaining_amount >= $9)
         AND ($10::numeric IS NULL OR p.remaining_amount <= $10)
         AND ($11::uuid IS NULL OR (p.received_at,p.id)>(SELECT x.received_at,x.id FROM bank_payment_balances x WHERE x.tenant_id=$1 AND x.id=$11))
       ORDER BY p.received_at,p.id LIMIT $12`,
      [
        read.actor.companyId,
        filter.search?.toLowerCase() ?? null,
        canReadFinField(read.fields, 'bankReference', 'bank_reference'),
        canReadFinField(read.fields, 'customerName'),
        filter.query === undefined ? null : `%${filter.query}%`,
        filter.state ?? null,
        filter.from ?? null,
        filter.to ?? null,
        filter.minAmount ?? null,
        filter.maxAmount ?? null,
        filter.cursor ?? null,
        limit + 1,
        ...secured.values,
      ],
    );
    return pageOf(rows.rows, limit);
  }

  public async summarizePayments(context: FinancialReadContext): Promise<readonly JsonObject[]> {
    const secured = recordScopeSql(context.scopes, context.anchors, context.actor, 'c', 2);
    const result = await this.db.query<JsonObject>(
      `SELECT p.currency::text currency, count(*)::int "paymentCount",
         sum(p.amount)::text "receivedAmount", sum(p.amount-p.remaining_amount)::text "appliedAmount",
         sum(p.remaining_amount)::text "remainingAmount"
       FROM bank_payment_balances p JOIN customers c ON c.id=p.customer_id AND c.tenant_id=p.tenant_id
       WHERE p.tenant_id=$1 AND ${secured.sql} GROUP BY p.currency ORDER BY p.currency`,
      [context.actor.companyId, ...secured.values],
    );
    return result.rows;
  }

  public async listReconciliationPage(
    context: FinancialReadContext,
    filter: ReconciliationPageFilter,
  ): Promise<Page<JsonObject>> {
    const secured = recordScopeSql(context.scopes, context.anchors, context.actor, 'c', 6);
    const rows = await this.db.query<Row>(
      `SELECT r.id,${RUN_PROJECTION} AS item${RUN_FROM}
       LEFT JOIN reconciliation_runs anchor ON anchor.tenant_id=$1 AND anchor.id=$4
       WHERE r.tenant_id=$1 AND ${secured.sql}
         AND ($2::text IS NULL OR r.status::text=$2)
         AND ($3::text IS NULL OR strpos(lower(r.result_hash),$3)>0)
         AND ($4::uuid IS NULL OR r.created_at<anchor.created_at OR (r.created_at=anchor.created_at AND r.id>anchor.id))
       ORDER BY r.created_at DESC,r.id LIMIT $5`,
      [
        context.actor.companyId,
        filter.state ?? null,
        filter.search?.toLowerCase() ?? null,
        filter.cursor ?? null,
        filter.limit + 1,
        ...secured.values,
      ],
    );
    return pageOf(rows.rows, filter.limit);
  }

  public async findPayment(
    id: string,
    context: FinancialReadContext,
    ar: FinancialRelatedRead | null,
  ): Promise<JsonObject | null> {
    const secured = recordScopeSql(context.scopes, context.anchors, context.actor, 'c', 3);
    const root = (
      await this.db.query<Row>(
        `SELECT p.id,${PAYMENT_PROJECTION} AS item${PAYMENT_FROM} WHERE p.tenant_id=$1 AND p.id=$2 AND ${secured.sql}`,
        [context.actor.companyId, id, ...secured.values],
      )
    ).rows[0]?.item;
    if (!root) return null;
    return { ...root, allocations: await this.paymentAllocations(context, id, null, ar) };
  }

  public async findReconciliation(
    id: string,
    context: FinancialReadContext,
    ar: FinancialRelatedRead | null,
    payment: FinancialRelatedRead | null,
  ): Promise<JsonObject | null> {
    const secured = recordScopeSql(context.scopes, context.anchors, context.actor, 'c', 3);
    const root = (
      await this.db.query<Row & { paymentId: string }>(
        `SELECT r.id,p.id AS "paymentId",${RUN_PROJECTION}||jsonb_build_object('algorithm',r.calculation_trace->>'algorithm','remainingAfterRun',a.payload->>'remainingAmount') AS item${RUN_FROM}
       LEFT JOIN commercial_command_results a ON a.tenant_id=r.tenant_id AND a.idempotency_key=r.idempotency_key AND a.command_type='RECONCILIATION_RUN' AND a.payload->>'id'=r.id::text
       WHERE r.tenant_id=$1 AND r.id=$2 AND ${secured.sql}`,
        [context.actor.companyId, id, ...secured.values],
      )
    ).rows[0];
    if (!root) return null;
    const [allocations, bankReference] = await Promise.all([
      this.paymentAllocations(context, root.paymentId, id, ar),
      payment ? this.paymentReference(root.paymentId, payment) : Promise.resolve(null),
    ]);
    return { ...root.item, allocations, ...(bankReference === null ? {} : { bankReference }) };
  }

  private async paymentReference(id: string, read: FinancialRelatedRead): Promise<string | null> {
    if (!canReadFinField(read.fields, 'bank_reference', 'bankReference')) return null;
    const secured = recordScopeSql(read.scopes, read.anchors, read.actor, 'c', 3);
    const result = await this.db.query<{ bank_reference: string }>(
      `SELECT p.bank_reference FROM bank_payments p JOIN customers c ON c.tenant_id=p.tenant_id AND c.id=p.customer_id
       WHERE p.tenant_id=$1 AND p.id=$2 AND ${secured.sql}`,
      [read.actor.companyId, id, ...secured.values],
    );
    return result.rows[0]?.bank_reference ?? null;
  }

  private async paymentAllocations(
    context: FinancialReadContext,
    paymentId: string,
    runId: string | null,
    ar: FinancialRelatedRead | null,
  ): Promise<readonly JsonObject[]> {
    const secured = ar
      ? recordScopeSql(ar.scopes, ar.anchors, ar.actor, 'c', 6)
      : { sql: 'FALSE', values: [] };
    const rows = await this.db.query<{ item: JsonObject }>(
      `SELECT jsonb_build_object('id',a.id,'openItemId',a.ar_open_item_id,'runId',a.reconciliation_run_id,
         'amount',a.amount::text,'currency',a.currency,'allocationOrder',a.allocation_order,'createdAt',a.created_at)
         || jsonb_strip_nulls(jsonb_build_object('documentNumber',CASE WHEN $4::boolean THEN d.document_number END,
         'receivableRemaining',CASE WHEN $5::boolean THEN b.remaining_amount::text END)) item
       FROM allocation_entries a
       LEFT JOIN (ar_open_item_balances b JOIN customers c ON c.tenant_id=b.tenant_id AND c.id=b.customer_id
         JOIN ar_documents d ON d.tenant_id=b.tenant_id AND d.id=b.ar_document_id)
         ON b.tenant_id=a.tenant_id AND b.id=a.ar_open_item_id AND ${secured.sql}
       WHERE a.tenant_id=$1 AND a.bank_payment_id=$2 AND ($3::uuid IS NULL OR a.reconciliation_run_id=$3)
       ORDER BY a.created_at,a.allocation_order,a.id`,
      [
        context.actor.companyId,
        paymentId,
        runId,
        ar !== null && canReadFinField(ar.fields, 'documentNumber'),
        ar !== null && canReadFinField(ar.fields, 'remaining_amount', 'remainingAmount'),
        ...secured.values,
      ],
    );
    return rows.rows.map(({ item }) => item);
  }
}
