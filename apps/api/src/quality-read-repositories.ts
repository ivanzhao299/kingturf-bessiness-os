import { DomainError, type Actor, type ScopeAnchor } from '@kingturf/domain';
import type { SqlClient } from '@kingturf/database';
import type { DataScope, JsonObject } from '@kingturf/types';

export type QualityReadContext = Readonly<{
  actor: Actor;
  scopes: readonly DataScope[];
  anchors: readonly ScopeAnchor[];
}>;

export const requireQualityCompany = (context: QualityReadContext) => {
  if (!context.scopes.includes('COMPANY') && !context.scopes.includes('GROUP'))
    throw new DomainError('forbidden', 'Quality operations require company scope');
};

const QUALITY_PLANS_SELECT = `SELECT to_jsonb(v)||jsonb_build_object('planId',p.id,'code',p.code,'name',p.name,'inspectionStage',p.inspection_stage,'sku',i.sku,'itemName',i.name,'characteristics',coalesce((SELECT jsonb_agg(to_jsonb(c) ORDER BY c.sequence) FROM quality_plan_characteristics c WHERE c.tenant_id=v.tenant_id AND c.inspection_plan_version_id=v.id),'[]'::jsonb)) item FROM quality_inspection_plan_versions v JOIN quality_inspection_plans p ON p.tenant_id=v.tenant_id AND p.id=v.inspection_plan_id JOIN manufacturing_item_versions iv ON iv.tenant_id=p.tenant_id AND iv.id=p.item_version_id JOIN manufacturing_items i ON i.tenant_id=iv.tenant_id AND i.id=iv.item_id WHERE v.tenant_id=$1`;
const QUALITY_INSPECTIONS_SELECT = `SELECT to_jsonb(q)||jsonb_build_object('state',s.state,'stateSequence',s.sequence,'planCode',p.code,'lotNumber',l.lot_number,'sku',i.sku,'results',coalesce((SELECT jsonb_agg(to_jsonb(r)||jsonb_build_object('characteristicCode',c.code,'characteristicName',c.name,'unitCode',c.unit_code) ORDER BY c.sequence) FROM quality_inspection_results r JOIN quality_plan_characteristics c ON c.tenant_id=r.tenant_id AND c.id=r.characteristic_id WHERE r.tenant_id=q.tenant_id AND r.inspection_id=q.id),'[]'::jsonb),'events',coalesce((SELECT jsonb_agg(to_jsonb(e) ORDER BY e.sequence) FROM quality_inspection_events e WHERE e.tenant_id=q.tenant_id AND e.inspection_id=q.id),'[]'::jsonb)) item FROM quality_inspections q JOIN quality_inspection_effective_states s ON s.tenant_id=q.tenant_id AND s.inspection_id=q.id JOIN quality_inspection_plan_versions v ON v.tenant_id=q.tenant_id AND v.id=q.inspection_plan_version_id JOIN quality_inspection_plans p ON p.tenant_id=v.tenant_id AND p.id=v.inspection_plan_id JOIN inventory_lots l ON l.tenant_id=q.tenant_id AND l.id=q.lot_id JOIN manufacturing_item_versions iv ON iv.tenant_id=l.tenant_id AND iv.id=l.item_version_id JOIN manufacturing_items i ON i.tenant_id=iv.tenant_id AND i.id=iv.item_id WHERE q.tenant_id=$1`;
const QUALITY_LOTS_SELECT = `SELECT jsonb_build_object('lotId',l.id,'lotNumber',l.lot_number,'itemVersionId',l.item_version_id,'sku',i.sku,'itemName',i.name,'qualityStatus',q.quality_status,'inspectionId',q.inspection_id,'reason',q.reason,'evidence',q.evidence,'movements',coalesce((SELECT jsonb_agg(to_jsonb(m) ORDER BY m.sequence) FROM inventory_movements m WHERE m.tenant_id=l.tenant_id AND m.lot_id=l.id),'[]'::jsonb),'usedByOrders',coalesce((SELECT jsonb_agg(jsonb_build_object('orderId',o.id,'orderNumber',o.order_number,'quantity',t.quantity,'transactionType',t.transaction_type) ORDER BY t.occurred_at) FROM production_material_transactions t JOIN production_orders o ON o.tenant_id=t.tenant_id AND o.id=t.production_order_id WHERE t.tenant_id=l.tenant_id AND t.lot_id=l.id),'[]'::jsonb),'producedRolls',coalesce((SELECT jsonb_agg(jsonb_build_object('orderId',o.id,'orderNumber',o.order_number,'rollNumber',r.roll_number,'quantity',r.quantity)) FROM production_rolls r JOIN production_orders o ON o.tenant_id=r.tenant_id AND o.id=r.production_order_id WHERE r.tenant_id=l.tenant_id AND r.lot_id=l.id),'[]'::jsonb),'qualityEvents',coalesce((SELECT jsonb_agg(to_jsonb(e) ORDER BY e.sequence) FROM inventory_lot_quality_events e WHERE e.tenant_id=l.tenant_id AND e.lot_id=l.id),'[]'::jsonb)) item FROM inventory_lots l JOIN inventory_lot_effective_quality q ON q.tenant_id=l.tenant_id AND q.lot_id=l.id JOIN manufacturing_item_versions iv ON iv.tenant_id=l.tenant_id AND iv.id=l.item_version_id JOIN manufacturing_items i ON i.tenant_id=iv.tenant_id AND i.id=iv.item_id WHERE l.tenant_id=$1`;

const QUALITY_READS = {
  plans: {
    list: `${QUALITY_PLANS_SELECT} ORDER BY p.code,v.version DESC`,
    detail: `${QUALITY_PLANS_SELECT} AND v.id=$2`,
    page: `${QUALITY_PLANS_SELECT}
      AND ($2::text IS NULL OR v.status::text=$2)
      AND ($3::text IS NULL OR strpos(lower(concat_ws(' ',p.code,p.name,i.sku,i.name)),lower($3))>0)
      AND ($4::uuid IS NULL OR (p.code,-v.version,v.id) > (
      SELECT p2.code,-v2.version,v2.id FROM quality_inspection_plan_versions v2
      JOIN quality_inspection_plans p2 ON p2.tenant_id=v2.tenant_id AND p2.id=v2.inspection_plan_id
      WHERE v2.tenant_id=$1 AND v2.id=$4::uuid))
      ORDER BY p.code,-v.version,v.id LIMIT $5`,
  },
  inspections: {
    list: `${QUALITY_INSPECTIONS_SELECT} ORDER BY q.opened_at DESC`,
    detail: `${QUALITY_INSPECTIONS_SELECT} AND q.id=$2`,
    page: `${QUALITY_INSPECTIONS_SELECT}
      AND ($2::text IS NULL OR s.state::text=$2)
      AND ($3::text IS NULL OR strpos(lower(concat_ws(' ',q.inspection_number,p.code,l.lot_number,i.sku)),lower($3))>0)
      AND ($4::uuid IS NULL OR (q.opened_at,q.id) < (SELECT q2.opened_at,q2.id FROM quality_inspections q2
      WHERE q2.tenant_id=$1 AND q2.id=$4::uuid))
      ORDER BY q.opened_at DESC,q.id DESC LIMIT $5`,
  },
  lots: {
    list: `${QUALITY_LOTS_SELECT} ORDER BY l.created_at DESC`,
    detail: `${QUALITY_LOTS_SELECT} AND l.id=$2`,
    page: `${QUALITY_LOTS_SELECT}
      AND ($2::text IS NULL OR q.quality_status::text=$2)
      AND ($3::text IS NULL OR strpos(lower(concat_ws(' ',l.lot_number,i.sku,i.name)),lower($3))>0)
      AND ($4::uuid IS NULL OR (l.created_at,l.id) < (SELECT l2.created_at,l2.id FROM inventory_lots l2
      WHERE l2.tenant_id=$1 AND l2.id=$4::uuid))
      ORDER BY l.created_at DESC,l.id DESC LIMIT $5`,
  },
} as const;

export type QualityView = keyof typeof QUALITY_READS;
export type QualityPageFilter = Readonly<{
  limit: number;
  state?: string;
  query?: string;
  cursor?: string;
}>;

export class PostgresQualityReadRepository {
  public constructor(private readonly readDb: SqlClient) {}

  public async list(view: QualityView, context: QualityReadContext): Promise<JsonObject[]> {
    requireQualityCompany(context);
    const { rows } = await this.readDb.query<{ item: JsonObject }>(QUALITY_READS[view].list, [
      context.actor.companyId,
    ]);
    return rows.map(({ item }) => item);
  }

  public async listQualityPage(
    view: QualityView,
    filter: QualityPageFilter,
    context: QualityReadContext,
  ) {
    requireQualityCompany(context);
    const { rows } = await this.readDb.query<{ item: JsonObject }>(QUALITY_READS[view].page, [
      context.actor.companyId,
      filter.state ?? null,
      filter.query ?? null,
      filter.cursor ?? null,
      filter.limit + 1,
    ]);
    const page = rows.slice(0, filter.limit);
    const last = page.at(-1)?.item;
    const cursor = last?.id ?? last?.lotId;
    return {
      items: page.map(({ item }) => item),
      nextCursor: rows.length > filter.limit && typeof cursor === 'string' ? cursor : null,
    };
  }

  public async findQualityRow(view: QualityView, id: string, context: QualityReadContext) {
    requireQualityCompany(context);
    const { rows } = await this.readDb.query<{ item: JsonObject }>(QUALITY_READS[view].detail, [
      context.actor.companyId,
      id,
    ]);
    return rows[0]?.item ?? null;
  }

  public async qualityCounts(view: 'inspections' | 'lots', context: QualityReadContext) {
    requireQualityCompany(context);
    if (view === 'lots') return this.quarantineCount(context.actor.companyId);
    const { rows } = await this.readDb.query<{ open: string; sampled: string; completed: string }>(
      `SELECT count(*) FILTER (WHERE state='OPEN')::text AS open,
         count(*) FILTER (WHERE state='SAMPLED')::text AS sampled,
         count(*) FILTER (WHERE state='COMPLETED')::text AS completed
       FROM quality_inspection_effective_states WHERE tenant_id=$1`,
      [context.actor.companyId],
    );
    return rows[0] ?? { open: '0', sampled: '0', completed: '0' };
  }
  private async quarantineCount(companyId: string) {
    const { rows } = await this.readDb.query<{ quarantine: string }>(
      "SELECT count(*)::text AS quarantine FROM inventory_lot_effective_quality WHERE tenant_id=$1 AND quality_status='QUARANTINE'",
      [companyId],
    );
    return { quarantine: rows[0]?.quarantine ?? '0' };
  }
}
