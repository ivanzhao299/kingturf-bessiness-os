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
const hashSnapshot = (value: unknown) =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex');
const json = (value: unknown) => value as JsonObject;
const company = (context: Context) => {
  if (!context.scopes.includes('COMPANY') && !context.scopes.includes('GROUP'))
    throw new DomainError('forbidden', 'MRP planning requires company scope');
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

export class PostgresMrpRepository {
  public constructor(private readonly db: Db) {}

  public async list(view: 'policies' | 'demands' | 'runs', context: Context) {
    company(context);
    const queries = {
      policies: `SELECT to_jsonb(p)||jsonb_build_object('sku',i.sku,'itemName',i.name,'itemVersion',v.version) item
        FROM mrp_planning_policies p JOIN manufacturing_item_versions v ON v.id=p.item_version_id AND v.tenant_id=p.tenant_id
        JOIN manufacturing_items i ON i.id=v.item_id AND i.tenant_id=v.tenant_id WHERE p.tenant_id=$1 ORDER BY i.sku,p.effective_at DESC`,
      demands: `SELECT to_jsonb(d)||jsonb_build_object('sku',i.sku,'itemName',i.name,'itemVersion',v.version) item
        FROM mrp_demand_signals d JOIN manufacturing_item_versions v ON v.id=d.item_version_id AND v.tenant_id=d.tenant_id
        JOIN manufacturing_items i ON i.id=v.item_id AND i.tenant_id=v.tenant_id WHERE d.tenant_id=$1 ORDER BY d.required_at,d.priority,i.sku`,
      runs: `SELECT to_jsonb(r)||jsonb_build_object(
        'calculations',coalesce((SELECT jsonb_agg(to_jsonb(c)||jsonb_build_object('sku',i.sku,'itemName',i.name) ORDER BY c.required_at,i.sku)
          FROM mrp_item_calculations c JOIN manufacturing_item_versions v ON v.id=c.item_version_id AND v.tenant_id=c.tenant_id
          JOIN manufacturing_items i ON i.id=v.item_id AND i.tenant_id=v.tenant_id WHERE c.mrp_run_id=r.id AND c.tenant_id=r.tenant_id),'[]'::jsonb),
        'proposals',coalesce((SELECT jsonb_agg(to_jsonb(p)||jsonb_build_object('sku',i.sku,'itemName',i.name,'effectiveState',s.state,'events',
          coalesce((SELECT jsonb_agg(to_jsonb(e) ORDER BY e.sequence) FROM mrp_proposal_events e WHERE e.proposal_id=p.id AND e.tenant_id=p.tenant_id),'[]'::jsonb)) ORDER BY p.due_at,i.sku)
          FROM mrp_proposals p JOIN manufacturing_item_versions v ON v.id=p.item_version_id AND v.tenant_id=p.tenant_id
          JOIN manufacturing_items i ON i.id=v.item_id AND i.tenant_id=v.tenant_id JOIN mrp_proposal_effective_states s ON s.proposal_id=p.id AND s.tenant_id=p.tenant_id
          WHERE p.mrp_run_id=r.id AND p.tenant_id=r.tenant_id),'[]'::jsonb)) item
        FROM mrp_runs r WHERE r.tenant_id=$1 ORDER BY r.created_at DESC`,
    } as const;
    return (
      await this.db.query<{ item: JsonObject }>(queries[view], [context.actor.companyId])
    ).rows.map((row) => row.item);
  }

  public createPolicy(
    input: {
      itemVersionId: string;
      safetyStock: string;
      minimumOrderQuantity: string;
      orderMultiple: string;
      leadTimeDays: number;
      freezeWindowDays: number;
      makeOrBuy: 'MAKE' | 'BUY';
      effectiveAt: string;
    },
    context: Context,
    correlationId: string,
  ) {
    return this.db.transaction(async (tx) => {
      company(context);
      const row = (
        await tx.query<{ id: string }>(
          `INSERT INTO mrp_planning_policies(tenant_id,item_version_id,safety_stock,minimum_order_quantity,order_multiple,lead_time_days,freeze_window_days,make_or_buy,effective_at,created_by,canonical_hash)
           SELECT $1,v.id,$3,$4,$5,$6,$7,$8,$9,$10,$11 FROM manufacturing_item_versions v WHERE v.id=$2 AND v.tenant_id=$1 AND v.status='PUBLISHED' RETURNING id`,
          [
            context.actor.companyId,
            input.itemVersionId,
            input.safetyStock,
            input.minimumOrderQuantity,
            input.orderMultiple,
            input.leadTimeDays,
            input.freezeWindowDays,
            input.makeOrBuy,
            input.effectiveAt,
            context.actor.employeeId,
            hash(input),
          ],
        )
      ).rows[0];
      if (!row) throw new DomainError('conflict', 'MRP policy requires a published item version');
      const result = json({ id: row.id, canonicalHash: hash(input), ...input });
      await evidence(
        tx,
        'mrp-policy.created',
        'mrp-policy',
        row.id,
        context,
        correlationId,
        result,
      );
      return result;
    });
  }

  public createDemand(
    input: {
      itemVersionId: string;
      sourceType: string;
      sourceId: string;
      requiredAt: string;
      quantity: string;
      priority: number;
    },
    context: Context,
    correlationId: string,
  ) {
    return this.db.transaction(async (tx) => {
      company(context);
      const row = (
        await tx.query<{ id: string }>(
          `INSERT INTO mrp_demand_signals(tenant_id,item_version_id,source_type,source_id,required_at,quantity,priority,created_by,canonical_hash)
           SELECT $1,v.id,$3,$4,$5,$6,$7,$8,$9 FROM manufacturing_item_versions v WHERE v.id=$2 AND v.tenant_id=$1 AND v.status='PUBLISHED' RETURNING id`,
          [
            context.actor.companyId,
            input.itemVersionId,
            input.sourceType,
            input.sourceId,
            input.requiredAt,
            input.quantity,
            input.priority,
            context.actor.employeeId,
            hash(input),
          ],
        )
      ).rows[0];
      if (!row) throw new DomainError('conflict', 'MRP demand requires a published item version');
      const result = json({ id: row.id, canonicalHash: hash(input), ...input });
      await evidence(
        tx,
        'mrp-demand.created',
        'mrp-demand',
        row.id,
        context,
        correlationId,
        result,
      );
      return result;
    });
  }

  public run(
    input: { runNumber: string; asOf: string; horizonEnd: string },
    context: Context,
    correlationId: string,
  ) {
    return this.db.transaction(async (tx) => {
      company(context);
      const inputs = (
        await tx.query<{ snapshot: JsonObject }>(
          `SELECT jsonb_build_object(
            'demands',coalesce((SELECT jsonb_agg(to_jsonb(d) ORDER BY d.required_at,d.priority,d.id) FROM mrp_demand_signals d WHERE d.tenant_id=$1 AND d.required_at BETWEEN $2::date AND $3::date),'[]'::jsonb),
            'policies',coalesce((SELECT jsonb_agg(to_jsonb(p) ORDER BY p.item_version_id,p.effective_at,p.id) FROM mrp_planning_policies p WHERE p.tenant_id=$1 AND p.effective_at<=$2),'[]'::jsonb),
            'boms',coalesce((SELECT jsonb_agg(to_jsonb(v)||jsonb_build_object('lines',(SELECT jsonb_agg(to_jsonb(l) ORDER BY l.line_number) FROM manufacturing_bom_lines l WHERE l.bom_version_id=v.id AND l.tenant_id=v.tenant_id)) ORDER BY v.bom_id,v.version) FROM manufacturing_bom_versions v WHERE v.tenant_id=$1 AND v.status='PUBLISHED' AND v.effective_at<=$2),'[]'::jsonb),
            'inventory',coalesce((SELECT jsonb_agg(to_jsonb(b) ORDER BY b.item_version_id,b.lot_id,b.location_id) FROM inventory_balances b JOIN inventory_lot_effective_quality l ON l.lot_id=b.lot_id AND l.tenant_id=b.tenant_id WHERE b.tenant_id=$1 AND l.quality_status='RELEASED'),'[]'::jsonb),
            'purchaseOrders',coalesce((SELECT jsonb_agg(to_jsonb(l)||jsonb_build_object('status',p.status) ORDER BY p.po_number,l.line_number) FROM purchase_order_lines l JOIN purchase_orders p ON p.id=l.purchase_order_id AND p.tenant_id=l.tenant_id WHERE l.tenant_id=$1 AND p.status IN('ISSUED','PARTIALLY_RECEIVED')),'[]'::jsonb)) snapshot`,
          [context.actor.companyId, input.asOf, input.horizonEnd],
        )
      ).rows[0]?.snapshot;
      if (!inputs) throw new Error('MRP input snapshot failed');
      const freezeDays = await tx.query<{ days: number }>(
        'SELECT coalesce(max(freeze_window_days),0)::integer days FROM mrp_planning_policies WHERE tenant_id=$1 AND effective_at<=$2',
        [context.actor.companyId, input.asOf],
      );
      const run = (
        await tx.query<{ id: string; freeze_until: string }>(
          `INSERT INTO mrp_runs(tenant_id,run_number,as_of,horizon_end,freeze_until,input_hash,created_by)
           VALUES($1,$2,$3::timestamptz,$4::date,$3::timestamptz::date+$5::integer,$6,$7) RETURNING id,freeze_until::text`,
          [
            context.actor.companyId,
            input.runNumber,
            input.asOf,
            input.horizonEnd,
            freezeDays.rows[0]?.days ?? 0,
            hashSnapshot(inputs),
            context.actor.employeeId,
          ],
        )
      ).rows[0];
      if (!run) throw new Error('MRP run insert failed');
      await tx.query(
        `INSERT INTO mrp_demand_snapshots(tenant_id,mrp_run_id,demand_signal_id,item_version_id,required_at,quantity,source_type,source_id,canonical_hash)
         SELECT $1,$2,d.id,d.item_version_id,d.required_at,d.quantity,d.source_type,d.source_id,d.canonical_hash
         FROM mrp_demand_signals d WHERE d.tenant_id=$1 AND d.required_at BETWEEN $3::date AND $4::date`,
        [context.actor.companyId, run.id, input.asOf, input.horizonEnd],
      );
      const invalidBom = await tx.query(
        `WITH RECURSIVE graph(item_version_id,path,depth,cycle) AS (
          SELECT d.item_version_id,ARRAY[d.item_version_id],0,false FROM mrp_demand_snapshots d WHERE d.tenant_id=$1 AND d.mrp_run_id=$2
          UNION ALL
          SELECT l.component_item_version_id,g.path||l.component_item_version_id,g.depth+1,l.component_item_version_id=ANY(g.path)
          FROM graph g JOIN LATERAL(SELECT v.id FROM manufacturing_bom_versions v WHERE v.tenant_id=$1 AND v.product_item_version_id=g.item_version_id AND v.status='PUBLISHED' AND v.effective_at<=$3 ORDER BY v.effective_at DESC,v.version DESC LIMIT 1)b ON true
          JOIN manufacturing_bom_lines l ON l.bom_version_id=b.id AND l.tenant_id=$1 WHERE NOT g.cycle AND g.depth<21
        ) SELECT 1 FROM graph g WHERE g.cycle OR (g.depth=21 AND EXISTS(SELECT 1 FROM manufacturing_bom_versions v JOIN manufacturing_bom_lines l ON l.bom_version_id=v.id AND l.tenant_id=v.tenant_id WHERE v.tenant_id=$1 AND v.product_item_version_id=g.item_version_id AND v.status='PUBLISHED')) LIMIT 1`,
        [context.actor.companyId, run.id, input.asOf],
      );
      if (invalidBom.rowCount)
        throw new DomainError('conflict', 'MRP rejected a cyclic or excessively deep BOM graph');
      const calculations = await tx.query<{ id: string }>(
        `WITH RECURSIVE exploded(item_version_id,required_at,quantity,path,depth) AS (
          SELECT d.item_version_id,d.required_at,d.quantity,ARRAY[d.item_version_id],0 FROM mrp_demand_snapshots d WHERE d.tenant_id=$1 AND d.mrp_run_id=$2
          UNION ALL
          SELECT l.component_item_version_id,e.required_at,(e.quantity*l.quantity*(1+l.scrap_basis_points::numeric/10000))::numeric(24,6),e.path||l.component_item_version_id,e.depth+1
          FROM exploded e JOIN LATERAL(SELECT v.id FROM manufacturing_bom_versions v WHERE v.tenant_id=$1 AND v.product_item_version_id=e.item_version_id AND v.status='PUBLISHED' AND v.effective_at<=$3 ORDER BY v.effective_at DESC,v.version DESC LIMIT 1)b ON true
          JOIN manufacturing_bom_lines l ON l.bom_version_id=b.id AND l.tenant_id=$1 WHERE e.depth<20 AND NOT l.component_item_version_id=ANY(e.path)
        ), gross AS (
          SELECT item_version_id,required_at,sum(quantity)::numeric(24,6) gross_demand FROM exploded GROUP BY item_version_id,required_at
        ), facts AS (
          SELECT g.*,coalesce(p.safety_stock,0) safety_stock,coalesce(p.minimum_order_quantity,0) minimum_order_quantity,
            coalesce(p.order_multiple,1) order_multiple,coalesce(p.lead_time_days,0) lead_time_days,coalesce(p.freeze_window_days,0) freeze_window_days,
            coalesce(p.make_or_buy,CASE WHEN i.item_type IN('FINISHED_GOOD','SEMI_FINISHED') THEN 'MAKE' ELSE 'BUY' END) make_or_buy,p.id policy_id,
            coalesce((SELECT sum(b.quantity) FROM inventory_balances b JOIN inventory_lot_effective_quality lot ON lot.lot_id=b.lot_id AND lot.tenant_id=b.tenant_id WHERE b.tenant_id=$1 AND b.item_version_id=g.item_version_id AND lot.quality_status='RELEASED'),0)::numeric(24,6) on_hand,
            coalesce((SELECT sum(pol.quantity-coalesce((SELECT sum(grl.quantity) FROM goods_receipt_lines grl WHERE grl.purchase_order_line_id=pol.id AND grl.tenant_id=pol.tenant_id),0)) FROM purchase_order_lines pol JOIN purchase_orders po ON po.id=pol.purchase_order_id AND po.tenant_id=pol.tenant_id WHERE pol.tenant_id=$1 AND pol.item_version_id=g.item_version_id AND po.status IN('ISSUED','PARTIALLY_RECEIVED') AND pol.required_at<=g.required_at),0)::numeric(24,6) scheduled_receipts
          FROM gross g JOIN manufacturing_item_versions v ON v.id=g.item_version_id AND v.tenant_id=$1 JOIN manufacturing_items i ON i.id=v.item_id AND i.tenant_id=v.tenant_id
          LEFT JOIN LATERAL(SELECT x.* FROM mrp_planning_policies x WHERE x.tenant_id=$1 AND x.item_version_id=g.item_version_id AND x.effective_at<=$3 ORDER BY x.effective_at DESC LIMIT 1)p ON true
        ), cumulative AS (
          SELECT f.*,sum(gross_demand) OVER(PARTITION BY item_version_id ORDER BY required_at) cumulative_gross,
            max(scheduled_receipts) OVER(PARTITION BY item_version_id ORDER BY required_at) cumulative_receipts FROM facts f
        ), rounded AS (
          SELECT c.*,greatest(0,cumulative_gross+safety_stock-on_hand-cumulative_receipts) cumulative_net,
            CASE WHEN cumulative_gross+safety_stock-on_hand-cumulative_receipts>0 THEN greatest(minimum_order_quantity,ceil((cumulative_gross+safety_stock-on_hand-cumulative_receipts)/order_multiple)*order_multiple) ELSE 0 END cumulative_plan FROM cumulative c
        ), bucketed AS (
          SELECT r.*,greatest(0,cumulative_net-coalesce(lag(cumulative_plan) OVER(PARTITION BY item_version_id ORDER BY required_at),0)) net_requirement,
            greatest(0,cumulative_plan-coalesce(lag(cumulative_plan) OVER(PARTITION BY item_version_id ORDER BY required_at),0)) planned_quantity FROM rounded r
        )
        INSERT INTO mrp_item_calculations(tenant_id,mrp_run_id,item_version_id,required_at,gross_demand,on_hand,scheduled_receipts,safety_stock,net_requirement,planned_quantity,make_or_buy,policy_id,trace,canonical_hash)
        SELECT $1,$2,item_version_id,required_at,gross_demand,on_hand,scheduled_receipts,safety_stock,net_requirement,planned_quantity,make_or_buy,policy_id,
          jsonb_build_object('formula','max(0,cumulativeGross+safetyStock-onHand-scheduledReceipts-priorPlan)','cumulativeGross',cumulative_gross,'cumulativeScheduledReceipts',cumulative_receipts,'minimumOrderQuantity',minimum_order_quantity,'orderMultiple',order_multiple,'leadTimeDays',lead_time_days,'freezeWindowDays',freeze_window_days),
          encode(sha256(convert_to(concat_ws('|',$2::text,item_version_id::text,required_at::text,gross_demand::text,on_hand::text,scheduled_receipts::text,safety_stock::text,net_requirement::text,planned_quantity::text,make_or_buy),'UTF8')),'hex')
        FROM bucketed RETURNING id`,
        [context.actor.companyId, run.id, input.asOf],
      );
      if (!calculations.rowCount)
        throw new DomainError('conflict', 'MRP horizon contains no demand to calculate');
      const proposals = await tx.query<{ id: string }>(
        `INSERT INTO mrp_proposals(tenant_id,mrp_run_id,calculation_id,proposal_type,item_version_id,quantity,start_at,due_at,frozen,explanation,canonical_hash)
         SELECT c.tenant_id,c.mrp_run_id,c.id,CASE c.make_or_buy WHEN 'BUY' THEN 'PURCHASE'::mrp_proposal_type ELSE 'PRODUCTION'::mrp_proposal_type END,c.item_version_id,c.planned_quantity,
           c.required_at-coalesce((c.trace->>'leadTimeDays')::integer,0),c.required_at,(c.required_at-coalesce((c.trace->>'leadTimeDays')::integer,0))<=$3::date,
           c.trace||jsonb_build_object('grossDemand',c.gross_demand,'onHand',c.on_hand,'scheduledReceipts',c.scheduled_receipts,'safetyStock',c.safety_stock,'netRequirement',c.net_requirement,'plannedQuantity',c.planned_quantity,'freezeUntil',$3::date),
           encode(sha256(convert_to(concat_ws('|',c.id::text,c.planned_quantity::text,c.required_at::text,c.make_or_buy),'UTF8')),'hex')
         FROM mrp_item_calculations c WHERE c.tenant_id=$1 AND c.mrp_run_id=$2 AND c.planned_quantity>0 RETURNING id`,
        [context.actor.companyId, run.id, run.freeze_until],
      );
      await tx.query(
        `INSERT INTO mrp_proposal_events(tenant_id,proposal_id,sequence,state,reason,evidence,actor_id,correlation_id,canonical_hash)
         SELECT $1,p.id,1,'PROPOSED','Deterministic MRP calculation',p.explanation,$3,$4,
           encode(sha256(convert_to(concat_ws('|',p.id::text,'1','PROPOSED',p.canonical_hash),'UTF8')),'hex')
         FROM mrp_proposals p WHERE p.tenant_id=$1 AND p.mrp_run_id=$2`,
        [context.actor.companyId, run.id, context.actor.employeeId, correlationId],
      );
      await tx.query(
        "UPDATE mrp_runs SET status='COMPUTED',computed_at=now() WHERE id=$1 AND tenant_id=$2",
        [run.id, context.actor.companyId],
      );
      const result = json({
        id: run.id,
        status: 'COMPUTED',
        freezeUntil: run.freeze_until,
        inputHash: hashSnapshot(inputs),
        calculationCount: calculations.rowCount,
        proposalCount: proposals.rowCount,
        ...input,
      });
      await evidence(tx, 'mrp.computed', 'mrp-run', run.id, context, correlationId, result);
      return result;
    });
  }

  public transitionProposal(
    id: string,
    state: 'APPROVED' | 'REJECTED' | 'RELEASED' | 'CANCELLED',
    input: { reason: string; evidence: JsonObject },
    context: Context,
    correlationId: string,
  ) {
    return this.db.transaction(async (tx) => {
      company(context);
      const current = (
        await tx.query<{ sequence: number; state: string; frozen: boolean }>(
          `SELECT s.sequence,s.state,p.frozen FROM mrp_proposals p JOIN mrp_proposal_effective_states s ON s.proposal_id=p.id AND s.tenant_id=p.tenant_id
           WHERE p.id=$1 AND p.tenant_id=$2 FOR UPDATE OF p`,
          [id, context.actor.companyId],
        )
      ).rows[0];
      if (!current) throw new DomainError('not_found', 'MRP proposal not found');
      const payload = json({ id, state, sequence: current.sequence + 1, ...input });
      const row = (
        await tx.query<{ id: string }>(
          `INSERT INTO mrp_proposal_events(tenant_id,proposal_id,sequence,state,reason,evidence,actor_id,correlation_id,canonical_hash)
           VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
          [
            context.actor.companyId,
            id,
            current.sequence + 1,
            state,
            input.reason,
            input.evidence,
            context.actor.employeeId,
            correlationId,
            hash(payload),
          ],
        )
      ).rows[0];
      if (!row) throw new Error('MRP proposal event insert failed');
      await evidence(
        tx,
        `mrp-proposal.${state.toLowerCase()}`,
        'mrp-proposal',
        id,
        context,
        correlationId,
        payload,
      );
      return payload;
    });
  }
}
