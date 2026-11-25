import { DomainError } from '@kingturf/domain';
import type { Database, SqlClient } from '@kingturf/database';
import type { JsonObject, Page } from '@kingturf/types';
import {
  companyReadAllowed,
  projectCollectionLegal,
  type SourceReadGrant,
} from './aggregate-authorization.ts';
import { permittedDto } from './app-values.ts';
import {
  canReadFinField,
  type FinancialReadContext,
  type FinancialRelatedRead,
} from './qtc-read-repositories.ts';
import { recordScopeSql } from './scope-sql.ts';

type Db = SqlClient & Pick<Database, 'transaction'>;
export type CollectionReadContext = FinancialReadContext &
  Readonly<{ legalRead?: SourceReadGrant | undefined }>;
export type CollectionFilter = Readonly<{
  limit: number;
  state?: string;
  search?: string;
  cursor?: string;
  fields: readonly string[] | null;
}>;

export const collectionCompany = (context: FinancialReadContext): void => {
  if (!context.scopes.includes('COMPANY') && !context.scopes.includes('GROUP'))
    throw new DomainError('forbidden', 'Collection and legal operations require company scope');
};

// Legacy list and enriched detail share the immutable evidence projection.
export const COLLECTION_EVIDENCE = `to_jsonb(c)||jsonb_build_object(
          'state',s.state,'remainingAmount',b.remaining_amount,'currency',b.currency,
          'documentNumber',d.document_number,'customerName',cu.name,'orderNumber',o.order_number,
          'overdueDays',greatest(0,floor(extract(epoch FROM(now()-b.due_at))/86400)),
          'events',coalesce((SELECT jsonb_agg(to_jsonb(e) ORDER BY e.sequence) FROM collection_case_events e WHERE e.tenant_id=c.tenant_id AND e.collection_case_id=c.id AND ($2::boolean OR e.event_type NOT LIKE 'LEGAL_%')),'[]'::jsonb),
          'followups',coalesce((SELECT jsonb_agg(to_jsonb(f) ORDER BY f.occurred_at,f.id) FROM collection_followups f WHERE f.tenant_id=c.tenant_id AND f.collection_case_id=c.id),'[]'::jsonb),
          'promises',coalesce((SELECT jsonb_agg(to_jsonb(p)||jsonb_build_object('state',ps.state,'events',coalesce((SELECT jsonb_agg(to_jsonb(pe) ORDER BY pe.sequence) FROM collection_promise_events pe WHERE pe.tenant_id=p.tenant_id AND pe.promise_id=p.id),'[]'::jsonb)) ORDER BY p.created_at) FROM collection_promises p JOIN collection_promise_effective_states ps ON ps.tenant_id=p.tenant_id AND ps.promise_id=p.id WHERE p.tenant_id=c.tenant_id AND p.collection_case_id=c.id),'[]'::jsonb),
          'legalHandoffs',coalesce((SELECT jsonb_agg(to_jsonb(h)||jsonb_build_object('state',hs.state,'events',coalesce((SELECT jsonb_agg(to_jsonb(he) ORDER BY he.sequence) FROM legal_handoff_events he WHERE he.tenant_id=h.tenant_id AND he.legal_handoff_id=h.id),'[]'::jsonb),'packages',coalesce((SELECT jsonb_agg(to_jsonb(p) ORDER BY p.version) FROM debt_evidence_packages p WHERE p.tenant_id=h.tenant_id AND p.legal_handoff_id=h.id),'[]'::jsonb)) ORDER BY h.created_at) FROM legal_handoffs h JOIN legal_handoff_effective_states hs ON hs.tenant_id=h.tenant_id AND hs.legal_handoff_id=h.id WHERE h.tenant_id=c.tenant_id AND h.collection_case_id=c.id AND $2::boolean),'[]'::jsonb)
        )`;
export const COLLECTION_FROM = `
        FROM collection_cases c JOIN collection_case_effective_states s ON s.tenant_id=c.tenant_id AND s.collection_case_id=c.id
        JOIN ar_open_item_balances b ON b.tenant_id=c.tenant_id AND b.id=c.ar_open_item_id
        JOIN ar_documents d ON d.tenant_id=b.tenant_id AND d.id=b.ar_document_id
        JOIN customers cu ON cu.tenant_id=b.tenant_id AND cu.id=b.customer_id
        LEFT JOIN sales_orders o ON o.tenant_id=d.tenant_id AND o.id=d.sales_order_id`;

const COLLECTION_CURRENT = `jsonb_build_object(
  'remainingAmount',b.remaining_amount::text,'assignedName',emp.display_name,
  'nextActionAt',f.next_action_at,'followupOverdue',coalesce(f.next_action_at<now() AND s.state NOT IN ('RESOLVED','CLOSED'),false)
)`;
const COLLECTION_CURRENT_JOIN = ` LEFT JOIN employees emp ON emp.company_id=c.tenant_id AND emp.id=c.assigned_to
 LEFT JOIN LATERAL (SELECT next_action_at FROM collection_followups cf WHERE cf.tenant_id=c.tenant_id AND cf.collection_case_id=c.id ORDER BY cf.occurred_at DESC,cf.id DESC LIMIT 1) f ON true`;
const COLLECTION_PRIORITY = `CASE c.priority WHEN 'CRITICAL' THEN 1 WHEN 'HIGH' THEN 2 WHEN 'MEDIUM' THEN 3 ELSE 4 END`;

type Row = { id: string; item: JsonObject };

export class PostgresCollectionReadRepository {
  public constructor(protected readonly db: Db) {}

  public async listCollectionPage(
    context: CollectionReadContext,
    filter: CollectionFilter,
  ): Promise<Page<JsonObject>> {
    collectionCompany(context);
    const rows = await this.db.query<Row>(
      `SELECT c.id,to_jsonb(c)||jsonb_build_object('state',s.state,'currency',b.currency,'documentNumber',d.document_number,'customerName',cu.name,'overdueDays',greatest(0,floor(extract(epoch FROM(now()-b.due_at))/86400)))||${COLLECTION_CURRENT} item
       ${COLLECTION_FROM}${COLLECTION_CURRENT_JOIN}
       LEFT JOIN collection_cases anchor ON anchor.tenant_id=$1 AND anchor.id=$4
       WHERE c.tenant_id=$1 AND ($2::text IS NULL OR s.state::text=$2)
         AND ($3::text IS NULL OR strpos(lower(concat_ws(' ',CASE WHEN $6::boolean THEN c.case_number END,CASE WHEN $7::boolean THEN cu.name END,CASE WHEN $8::boolean THEN d.document_number END)),$3)>0)
         AND ($4::uuid IS NULL OR (${COLLECTION_PRIORITY},b.due_at,c.opened_at,c.id)>
         (CASE anchor.priority WHEN 'CRITICAL' THEN 1 WHEN 'HIGH' THEN 2 WHEN 'MEDIUM' THEN 3 ELSE 4 END,anchor.due_at,anchor.opened_at,anchor.id))
       ORDER BY ${COLLECTION_PRIORITY},b.due_at,c.opened_at,c.id LIMIT $5`,
      [
        context.actor.companyId,
        filter.state ?? null,
        filter.search?.toLowerCase() ?? null,
        filter.cursor ?? null,
        filter.limit + 1,
        canReadFinField(filter.fields, 'case_number'),
        canReadFinField(filter.fields, 'customerName'),
        canReadFinField(filter.fields, 'documentNumber'),
      ],
    );
    return {
      items: rows.rows.slice(0, filter.limit).map(({ item }) => item),
      nextCursor:
        rows.rows.length > filter.limit ? (rows.rows[filter.limit - 1]?.id ?? null) : null,
    };
  }

  public async summarizeCollections(
    context: CollectionReadContext,
  ): Promise<readonly JsonObject[]> {
    collectionCompany(context);
    const rows = await this.db.query<JsonObject>(
      `SELECT b.currency::text currency,
         count(*) FILTER (WHERE s.state NOT IN ('RESOLVED','CLOSED'))::int "activeCount",
         coalesce(sum(b.remaining_amount) FILTER (WHERE s.state NOT IN ('RESOLVED','CLOSED')),0.000000)::text "activeBalance",
         count(*) FILTER (WHERE s.state NOT IN ('RESOLVED','CLOSED') AND f.next_action_at<now())::int "followupOverdueCount"
       ${COLLECTION_FROM}${COLLECTION_CURRENT_JOIN}
       WHERE c.tenant_id=$1 GROUP BY b.currency ORDER BY b.currency`,
      [context.actor.companyId],
    );
    return rows.rows;
  }

  public async findCollection(
    id: string,
    context: CollectionReadContext,
    ar: FinancialRelatedRead | null,
  ): Promise<JsonObject | null> {
    collectionCompany(context);
    const detail = await this.db.query<Row & { arId: string }>(
      `SELECT c.id,c.ar_open_item_id "arId",${COLLECTION_EVIDENCE}||${COLLECTION_CURRENT} item
       ${COLLECTION_FROM}${COLLECTION_CURRENT_JOIN} WHERE c.tenant_id=$1 AND c.id=$3`,
      [context.actor.companyId, companyReadAllowed(context.legalRead), id],
    );
    const row = detail.rows[0];
    if (!row) return null;
    const receivable = ar ? await this.collectionReceivable(row.arId, ar) : null;
    return {
      ...(projectCollectionLegal(row.item, context.legalRead) as JsonObject),
      ...(receivable === null ? {} : { receivable }),
    };
  }

  private async collectionReceivable(
    id: string,
    context: FinancialRelatedRead,
  ): Promise<JsonObject | null> {
    const secured = recordScopeSql(context.scopes, context.anchors, context.actor, 'c', 3);
    const result = await this.db.query<Row>(
      `SELECT b.id,jsonb_build_object('id',b.id,'documentNumber',d.document_number,'currency',b.currency,'due_at',b.due_at,
         'original_amount',b.original_amount::text,'remaining_amount',b.remaining_amount::text) item
       FROM ar_open_item_balances b JOIN ar_documents d ON d.tenant_id=b.tenant_id AND d.id=b.ar_document_id
       JOIN customers c ON c.tenant_id=b.tenant_id AND c.id=b.customer_id
       WHERE b.tenant_id=$1 AND b.id=$2 AND ${secured.sql}`,
      [context.actor.companyId, id, ...secured.values],
    );
    const row = result.rows[0]?.item;
    return row ? (permittedDto(row, context.fields) as JsonObject) : null;
  }
}
