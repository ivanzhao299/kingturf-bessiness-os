import { type Actor, type ScopeAnchor } from '@kingturf/domain';
import type { Database, SqlClient } from '@kingturf/database';
import type { DataScope, JsonObject } from '@kingturf/types';

type Db = SqlClient & Pick<Database, 'transaction'>;
type Context = Readonly<{
  actor: Actor;
  scopes: readonly DataScope[];
  anchors: readonly ScopeAnchor[];
}>;
const customerScope = (context: Context, alias: string, offset = 5) => {
  const clauses: string[] = [],
    values: string[] = [];
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

export class PostgresDashboardRepository {
  public constructor(private readonly db: Db) {}
  public async get(
    input: { from: string; to: string; currency: string },
    context: Context,
  ): Promise<JsonObject> {
    const secured = customerScope(context, 'c');
    const row = (
      await this.db.query<{ item: JsonObject }>(
        `WITH
      visible_orders AS(SELECT o.*,qr.margin FROM sales_orders o JOIN customers c ON c.id=o.customer_id AND c.tenant_id=o.tenant_id JOIN quote_revisions qr ON qr.id=o.quote_revision_id AND qr.tenant_id=o.tenant_id WHERE o.tenant_id=$1 AND o.currency=$4 AND o.created_at>=$2 AND o.created_at<$3 AND ${secured.sql}),
      visible_opportunities AS(SELECT op.* FROM opportunities op JOIN customers c ON c.id=op.customer_id AND c.tenant_id=op.tenant_id WHERE op.tenant_id=$1 AND op.currency=$4 AND op.created_at>=$2 AND op.created_at<$3 AND ${secured.sql}),
      visible_ar AS(SELECT b.*,d.sales_order_id,d.document_number FROM ar_open_item_balances b JOIN ar_documents d ON d.id=b.ar_document_id AND d.tenant_id=b.tenant_id JOIN customers c ON c.id=b.customer_id AND c.tenant_id=b.tenant_id WHERE b.tenant_id=$1 AND b.currency=$4 AND d.posted_at<$3 AND ${secured.sql}),
      visible_allocations AS(SELECT a.* FROM allocation_entries a JOIN ar_open_items oi ON oi.id=a.ar_open_item_id AND oi.tenant_id=a.tenant_id JOIN customers c ON c.id=oi.customer_id AND c.tenant_id=oi.tenant_id WHERE a.tenant_id=$1 AND a.currency=$4 AND a.created_at>=$2 AND a.created_at<$3 AND ${secured.sql}),
      visible_risks AS(SELECT re.*,rt.id task_id,rt.effective_state,rt.assignee_employee_id FROM risk_evaluations re JOIN sales_orders o ON o.id=re.sales_order_id AND o.tenant_id=re.tenant_id JOIN customers c ON c.id=o.customer_id AND c.tenant_id=o.tenant_id LEFT JOIN effective_risk_tasks rt ON rt.risk_evaluation_id=re.id AND rt.tenant_id=re.tenant_id WHERE re.tenant_id=$1 AND re.created_at<$3 AND ${secured.sql})
      SELECT jsonb_build_object(
        'filters',jsonb_build_object('from',$2::timestamptz,'to',$3::timestamptz,'currency',$4),
        'refreshedAt',now(),
        'metrics',jsonb_build_object(
          'weightedForecast',jsonb_build_object('value',coalesce((SELECT sum(value*probability_basis_points/10000) FROM visible_opportunities WHERE status NOT IN('WON','LOST')),0),'unit',$4,'basis','expected close pipeline × probability','source','opportunities'),
          'bookedRevenue',jsonb_build_object('value',coalesce((SELECT sum(total) FROM visible_orders),0),'unit',$4,'basis','released order date','source','sales_orders'),
          'grossMargin',jsonb_build_object('value',coalesce((SELECT sum(margin) FROM visible_orders),0),'unit',$4,'basis','pinned issued quote margin','source','quote_revisions'),
          'cashCollected',jsonb_build_object('value',coalesce((SELECT sum(amount) FROM visible_allocations),0),'unit',$4,'basis','allocation posting date','source','allocation_entries'),
          'openReceivable',jsonb_build_object('value',coalesce((SELECT sum(remaining_amount) FROM visible_ar),0),'unit',$4,'basis','as-of open-item balance','source','ar_open_item_balances'),
          'overdueReceivable',jsonb_build_object('value',coalesce((SELECT sum(remaining_amount) FROM visible_ar WHERE due_at<now()),0),'unit',$4,'basis','due date before refresh time','source','ar_open_item_balances'),
          'releasedOrders',jsonb_build_object('value',(SELECT count(*) FROM visible_orders),'unit','orders','basis','released order date','source','sales_orders'),
          'activeRisks',jsonb_build_object('value',(SELECT count(*) FROM visible_risks WHERE effective_state IS NULL OR effective_state<>'CLOSED'),'unit','cases','basis','latest responsibility-task state','source','risk_evaluations'),
          'criticalRisks',jsonb_build_object('value',(SELECT count(*) FROM visible_risks WHERE severity='CRITICAL' AND (effective_state IS NULL OR effective_state<>'CLOSED')),'unit','cases','basis','latest responsibility-task state','source','risk_evaluations'),
          'commissionAccrued',jsonb_build_object('value',coalesce((SELECT sum(cc.commission_amount) FROM effective_commission_cases cc JOIN visible_orders o ON o.id=cc.sales_order_id),0),'unit',$4,'basis','order date and pinned policy','source','commission_cases')
        ),
        'drilldowns',jsonb_build_object(
          'orders',coalesce((SELECT jsonb_agg(x ORDER BY (x->>'total')::numeric DESC) FROM(SELECT jsonb_build_object('id',id,'orderNumber',order_number,'total',total,'margin',margin,'status',status) x FROM visible_orders LIMIT 20)s),'[]'::jsonb),
          'overdue',coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'documentNumber',document_number,'remaining',remaining_amount,'dueAt',due_at) ORDER BY due_at) FROM visible_ar WHERE remaining_amount>0 AND due_at<now()),'[]'::jsonb),
          'risks',coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'salesOrderId',sales_order_id,'severity',severity,'score',score,'taskId',task_id,'state',effective_state,'assigneeEmployeeId',assignee_employee_id) ORDER BY score DESC,created_at DESC) FROM visible_risks),'[]'::jsonb)
        )
      ) item`,
        [context.actor.companyId, input.from, input.to, input.currency, ...secured.values],
      )
    ).rows[0];
    return (
      row?.item ?? {
        filters: input,
        refreshedAt: new Date().toISOString(),
        metrics: {},
        drilldowns: {},
      }
    );
  }
}
