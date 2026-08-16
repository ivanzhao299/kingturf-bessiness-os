import { DomainError, type Actor, type ScopeAnchor } from '@kingturf/domain';
import type { Database, SqlClient } from '@kingturf/database';
import type { DataScope, JsonObject } from '@kingturf/types';

type Db = SqlClient & Pick<Database, 'transaction'>;
type Context = Readonly<{
  actor: Actor;
  scopes: readonly DataScope[];
  anchors: readonly ScopeAnchor[];
}>;

const customerScope = (context: Context, alias = 'c', offset = 3) => {
  const clauses: string[] = [];
  const values: string[] = [];
  if (context.scopes.includes('COMPANY') || context.scopes.includes('GROUP')) clauses.push('TRUE');
  if (context.scopes.includes('SELF')) {
    values.push(context.actor.employeeId);
    clauses.push(`${alias}.owner_id=$${String(offset + values.length - 1)}`);
  }
  for (const anchor of context.anchors)
    if (anchor.organizationId && context.scopes.includes(anchor.scope)) {
      values.push(anchor.organizationId);
      clauses.push(
        `EXISTS(SELECT 1 FROM organization_scope_relationships osr WHERE osr.tenant_id=${alias}.tenant_id AND osr.ancestor_id=$${String(offset + values.length - 1)} AND osr.descendant_id=${alias}.owner_organization_id AND osr.scope='${anchor.scope}')`,
      );
    }
  return { sql: clauses.length ? `(${clauses.join(' OR ')})` : 'FALSE', values };
};

export class PostgresOrder360Repository {
  public constructor(private readonly db: Db) {}

  public async get(id: string, context: Context): Promise<JsonObject> {
    const secured = customerScope(context);
    const row = (
      await this.db.query<{ item: JsonObject }>(
        `SELECT jsonb_build_object(
          'order',to_jsonb(o)||jsonb_build_object('lines',(SELECT coalesce(jsonb_agg(to_jsonb(l) ORDER BY l.line_number),'[]'::jsonb) FROM sales_order_lines l WHERE l.tenant_id=o.tenant_id AND l.sales_order_id=o.id)),
          'customer',to_jsonb(c),
          'opportunity',to_jsonb(op),
          'quote',to_jsonb(qr)||jsonb_build_object('quoteNumber',q.quote_number,'snapshot',to_jsonb(qs)),
          'technical',to_jsonb(tsr)||jsonb_build_object('code',ts.code),
          'cost',to_jsonb(cd),
          'policy',to_jsonb(pe),
          'credit',to_jsonb(cr)||jsonb_build_object('effectiveStatus',cr.effective_status),
          'contract',to_jsonb(ctrev)||jsonb_build_object('contractNumber',ct.contract_number,'signature',to_jsonb(sig)),
          'receivables',coalesce((SELECT jsonb_agg(to_jsonb(b)||jsonb_build_object('documentNumber',d.document_number,'postedAt',d.posted_at) ORDER BY d.posted_at,b.id) FROM ar_open_item_balances b JOIN ar_documents d ON d.id=b.ar_document_id AND d.tenant_id=b.tenant_id WHERE b.tenant_id=o.tenant_id AND d.sales_order_id=o.id),'[]'::jsonb),
          'payments',coalesce((SELECT jsonb_agg(DISTINCT to_jsonb(pb)) FROM allocation_entries a JOIN ar_open_items oi ON oi.id=a.ar_open_item_id AND oi.tenant_id=a.tenant_id JOIN ar_documents d ON d.id=oi.ar_document_id AND d.tenant_id=oi.tenant_id JOIN bank_payment_balances pb ON pb.id=a.bank_payment_id AND pb.tenant_id=a.tenant_id WHERE a.tenant_id=o.tenant_id AND d.sales_order_id=o.id),'[]'::jsonb),
          'reconciliations',coalesce((SELECT jsonb_agg(DISTINCT to_jsonb(rr)) FROM allocation_entries a JOIN ar_open_items oi ON oi.id=a.ar_open_item_id AND oi.tenant_id=a.tenant_id JOIN ar_documents d ON d.id=oi.ar_document_id AND d.tenant_id=oi.tenant_id JOIN reconciliation_runs rr ON rr.id=a.reconciliation_run_id AND rr.tenant_id=a.tenant_id WHERE a.tenant_id=o.tenant_id AND d.sales_order_id=o.id),'[]'::jsonb),
          'commissions',coalesce((SELECT jsonb_agg(to_jsonb(cc)||jsonb_build_object('ledger',(SELECT coalesce(jsonb_agg(to_jsonb(le) ORDER BY le.sequence),'[]'::jsonb) FROM commission_ledger_entries le WHERE le.tenant_id=cc.tenant_id AND le.commission_case_id=cc.id)) ORDER BY cc.created_at) FROM effective_commission_cases cc WHERE cc.tenant_id=o.tenant_id AND cc.sales_order_id=o.id),'[]'::jsonb),
          'anomalies',jsonb_build_array(
            jsonb_build_object('code','LOW_MARGIN','active',qr.margin_basis_points<2000,'severity','HIGH','message','报价毛利率低于 20%'),
            jsonb_build_object('code','OPEN_AR','active',EXISTS(SELECT 1 FROM ar_open_item_balances ab JOIN ar_documents ad ON ad.id=ab.ar_document_id AND ad.tenant_id=ab.tenant_id WHERE ab.tenant_id=o.tenant_id AND ad.sales_order_id=o.id AND ab.remaining_amount>0),'severity','MEDIUM','message','订单仍有未核销应收'),
            jsonb_build_object('code','CREDIT_EXPIRED','active',cr.valid_until<=now(),'severity','HIGH','message','订单引用的信用决定已过有效期')
          )
        ) AS item
        FROM sales_orders o
        JOIN customers c ON c.id=o.customer_id AND c.tenant_id=o.tenant_id
        JOIN opportunities op ON op.id=o.opportunity_id AND op.tenant_id=o.tenant_id
        JOIN quote_revisions qr ON qr.id=o.quote_revision_id AND qr.tenant_id=o.tenant_id
        JOIN quotes q ON q.id=qr.quote_id AND q.tenant_id=qr.tenant_id
        JOIN quote_issued_snapshots qs ON qs.id=o.quote_snapshot_id AND qs.tenant_id=o.tenant_id
        JOIN technical_solution_revisions tsr ON tsr.id=qr.technical_solution_revision_id AND tsr.tenant_id=o.tenant_id
        JOIN technical_solutions ts ON ts.id=tsr.technical_solution_id AND ts.tenant_id=o.tenant_id
        JOIN cost_sheet_decisions cd ON cd.id=qr.cost_decision_id AND cd.tenant_id=o.tenant_id
        JOIN sales_policy_evaluations pe ON pe.id=qr.sales_policy_evaluation_id AND pe.tenant_id=o.tenant_id
        JOIN effective_credit_decisions cr ON cr.id=o.credit_decision_id AND cr.tenant_id=o.tenant_id
        JOIN contract_revisions ctrev ON ctrev.id=o.contract_revision_id AND ctrev.tenant_id=o.tenant_id
        JOIN contracts ct ON ct.id=ctrev.contract_id AND ct.tenant_id=o.tenant_id
        JOIN contract_signature_evidence sig ON sig.id=o.signature_evidence_id AND sig.tenant_id=o.tenant_id
        WHERE o.id=$1 AND o.tenant_id=$2 AND c.deleted_at IS NULL AND ${secured.sql}`,
        [id, context.actor.companyId, ...secured.values],
      )
    ).rows[0];
    if (!row) throw new DomainError('not_found', 'Sales order not found');
    const timeline = (
      await this.db.query<{ item: JsonObject }>(
        `WITH target AS(SELECT o.* FROM sales_orders o JOIN customers c ON c.id=o.customer_id AND c.tenant_id=o.tenant_id WHERE o.id=$1 AND o.tenant_id=$2 AND ${secured.sql}), events AS(
          SELECT op.created_at occurred_at,'OPPORTUNITY_CREATED' event_type,op.id subject_id,op.name label FROM target o JOIN opportunities op ON op.id=o.opportunity_id AND op.tenant_id=o.tenant_id
          UNION ALL SELECT qr.issued_at,'QUOTE_ISSUED',qr.id,q.quote_number FROM target o JOIN quote_revisions qr ON qr.id=o.quote_revision_id AND qr.tenant_id=o.tenant_id JOIN quotes q ON q.id=qr.quote_id AND q.tenant_id=qr.tenant_id
          UNION ALL SELECT coalesce(cd.decided_at,cd.created_at),'CREDIT_DECIDED',cd.id,cd.effective_status::text FROM target o JOIN effective_credit_decisions cd ON cd.id=o.credit_decision_id AND cd.tenant_id=o.tenant_id
          UNION ALL SELECT sig.signed_at,'CONTRACT_SIGNED',sig.id,ct.contract_number FROM target o JOIN contract_revisions cr ON cr.id=o.contract_revision_id AND cr.tenant_id=o.tenant_id JOIN contracts ct ON ct.id=cr.contract_id AND ct.tenant_id=cr.tenant_id JOIN contract_signature_evidence sig ON sig.id=o.signature_evidence_id AND sig.tenant_id=o.tenant_id
          UNION ALL SELECT o.created_at,'ORDER_RELEASED',o.id,o.order_number FROM target o
          UNION ALL SELECT d.posted_at,'AR_POSTED',d.id,d.document_number FROM target o JOIN ar_documents d ON d.sales_order_id=o.id AND d.tenant_id=o.tenant_id
          UNION ALL SELECT p.received_at,'PAYMENT_RECEIVED',p.id,p.bank_reference FROM target o JOIN ar_documents d ON d.sales_order_id=o.id AND d.tenant_id=o.tenant_id JOIN ar_open_items oi ON oi.ar_document_id=d.id AND oi.tenant_id=d.tenant_id JOIN allocation_entries a ON a.ar_open_item_id=oi.id AND a.tenant_id=oi.tenant_id JOIN bank_payments p ON p.id=a.bank_payment_id AND p.tenant_id=a.tenant_id
          UNION ALL SELECT le.occurred_at,'COMMISSION_'||le.state::text,le.id,le.reason FROM target o JOIN commission_cases cc ON cc.sales_order_id=o.id AND cc.tenant_id=o.tenant_id JOIN commission_ledger_entries le ON le.commission_case_id=cc.id AND le.tenant_id=cc.tenant_id
        ) SELECT jsonb_build_object('occurredAt',occurred_at,'type',event_type,'subjectId',subject_id,'label',label) item FROM events ORDER BY occurred_at,event_type,subject_id`,
        [id, context.actor.companyId, ...secured.values],
      )
    ).rows.map((entry) => entry.item);
    return { ...row.item, timeline };
  }
}
