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
    throw new DomainError('forbidden', 'Quality operations require company scope');
};
const evidence = async (
  tx: SqlClient,
  type: string,
  id: string,
  context: Context,
  correlationId: string,
  payload: JsonObject,
) => {
  await tx.query(
    "INSERT INTO audit_events(action,outcome,actor_id,organization_id,target_type,target_id,correlation_id,metadata) VALUES($1,'SUCCESS',$2,$3,'quality-inspection',$4,$5,$6)",
    [type, context.actor.employeeId, context.actor.companyId, id, correlationId, payload],
  );
  await tx.query(
    `INSERT INTO domain_event_outbox(tenant_id,event_type,event_version,aggregate_type,aggregate_id,aggregate_version,occurred_at,actor_id,correlation_id,payload)
    SELECT $1,$2,1,'quality-inspection',$3,coalesce(max(aggregate_version),0)+1,now(),$4,$5,$6 FROM domain_event_outbox WHERE tenant_id=$1 AND event_type=$2 AND aggregate_id=$3`,
    [context.actor.companyId, type, id, context.actor.employeeId, correlationId, payload],
  );
};

export class PostgresQualityRepository {
  public constructor(private readonly db: Db) {}

  public async list(view: 'plans' | 'inspections' | 'lots', context: Context) {
    company(context);
    const queries = {
      plans: `SELECT to_jsonb(v)||jsonb_build_object('planId',p.id,'code',p.code,'name',p.name,'inspectionStage',p.inspection_stage,'sku',i.sku,'itemName',i.name,'characteristics',coalesce((SELECT jsonb_agg(to_jsonb(c) ORDER BY c.sequence) FROM quality_plan_characteristics c WHERE c.tenant_id=v.tenant_id AND c.inspection_plan_version_id=v.id),'[]'::jsonb)) item FROM quality_inspection_plan_versions v JOIN quality_inspection_plans p ON p.tenant_id=v.tenant_id AND p.id=v.inspection_plan_id JOIN manufacturing_item_versions iv ON iv.tenant_id=p.tenant_id AND iv.id=p.item_version_id JOIN manufacturing_items i ON i.tenant_id=iv.tenant_id AND i.id=iv.item_id WHERE v.tenant_id=$1 ORDER BY p.code,v.version DESC`,
      inspections: `SELECT to_jsonb(q)||jsonb_build_object('state',s.state,'stateSequence',s.sequence,'planCode',p.code,'lotNumber',l.lot_number,'sku',i.sku,'results',coalesce((SELECT jsonb_agg(to_jsonb(r)||jsonb_build_object('characteristicCode',c.code,'characteristicName',c.name,'unitCode',c.unit_code) ORDER BY c.sequence) FROM quality_inspection_results r JOIN quality_plan_characteristics c ON c.tenant_id=r.tenant_id AND c.id=r.characteristic_id WHERE r.tenant_id=q.tenant_id AND r.inspection_id=q.id),'[]'::jsonb),'events',coalesce((SELECT jsonb_agg(to_jsonb(e) ORDER BY e.sequence) FROM quality_inspection_events e WHERE e.tenant_id=q.tenant_id AND e.inspection_id=q.id),'[]'::jsonb)) item FROM quality_inspections q JOIN quality_inspection_effective_states s ON s.tenant_id=q.tenant_id AND s.inspection_id=q.id JOIN quality_inspection_plan_versions v ON v.tenant_id=q.tenant_id AND v.id=q.inspection_plan_version_id JOIN quality_inspection_plans p ON p.tenant_id=v.tenant_id AND p.id=v.inspection_plan_id JOIN inventory_lots l ON l.tenant_id=q.tenant_id AND l.id=q.lot_id JOIN manufacturing_item_versions iv ON iv.tenant_id=l.tenant_id AND iv.id=l.item_version_id JOIN manufacturing_items i ON i.tenant_id=iv.tenant_id AND i.id=iv.item_id WHERE q.tenant_id=$1 ORDER BY q.opened_at DESC`,
      lots: `SELECT jsonb_build_object('lotId',l.id,'lotNumber',l.lot_number,'itemVersionId',l.item_version_id,'sku',i.sku,'itemName',i.name,'qualityStatus',q.quality_status,'inspectionId',q.inspection_id,'reason',q.reason,'evidence',q.evidence,'movements',coalesce((SELECT jsonb_agg(to_jsonb(m) ORDER BY m.sequence) FROM inventory_movements m WHERE m.tenant_id=l.tenant_id AND m.lot_id=l.id),'[]'::jsonb),'usedByOrders',coalesce((SELECT jsonb_agg(jsonb_build_object('orderId',o.id,'orderNumber',o.order_number,'quantity',t.quantity,'transactionType',t.transaction_type) ORDER BY t.occurred_at) FROM production_material_transactions t JOIN production_orders o ON o.tenant_id=t.tenant_id AND o.id=t.production_order_id WHERE t.tenant_id=l.tenant_id AND t.lot_id=l.id),'[]'::jsonb),'producedRolls',coalesce((SELECT jsonb_agg(jsonb_build_object('orderId',o.id,'orderNumber',o.order_number,'rollNumber',r.roll_number,'quantity',r.quantity)) FROM production_rolls r JOIN production_orders o ON o.tenant_id=r.tenant_id AND o.id=r.production_order_id WHERE r.tenant_id=l.tenant_id AND r.lot_id=l.id),'[]'::jsonb),'qualityEvents',coalesce((SELECT jsonb_agg(to_jsonb(e) ORDER BY e.sequence) FROM inventory_lot_quality_events e WHERE e.tenant_id=l.tenant_id AND e.lot_id=l.id),'[]'::jsonb)) item FROM inventory_lots l JOIN inventory_lot_effective_quality q ON q.tenant_id=l.tenant_id AND q.lot_id=l.id JOIN manufacturing_item_versions iv ON iv.tenant_id=l.tenant_id AND iv.id=l.item_version_id JOIN manufacturing_items i ON i.tenant_id=iv.tenant_id AND i.id=iv.item_id WHERE l.tenant_id=$1 ORDER BY l.created_at DESC`,
    } as const;
    return (
      await this.db.query<{ item: JsonObject }>(queries[view], [context.actor.companyId])
    ).rows.map((row) => row.item);
  }

  public createPlan(
    input: {
      code: string;
      name: string;
      itemVersionId: string;
      inspectionStage: 'INCOMING' | 'IN_PROCESS' | 'FINAL';
      samplingMethod: string;
      acceptanceRule: JsonObject;
      effectiveAt: string;
      characteristics: readonly {
        code: string;
        name: string;
        dataType: 'NUMERIC' | 'BOOLEAN' | 'TEXT';
        unitCode?: string;
        lowerLimit?: string;
        upperLimit?: string;
        required: boolean;
        instructions: string;
      }[];
      publish: boolean;
    },
    context: Context,
    correlationId: string,
  ) {
    return this.db.transaction(async (tx) => {
      company(context);
      const payload = json(input);
      const plan = (
        await tx.query<{ id: string }>(
          `INSERT INTO quality_inspection_plans(tenant_id,code,name,item_version_id,inspection_stage,created_by) VALUES($1,$2,$3,$4,$5,$6) RETURNING id`,
          [
            context.actor.companyId,
            input.code,
            input.name,
            input.itemVersionId,
            input.inspectionStage,
            context.actor.employeeId,
          ],
        )
      ).rows[0];
      if (!plan) throw new Error('Quality plan insert failed');
      const version = (
        await tx.query<{ id: string }>(
          `INSERT INTO quality_inspection_plan_versions(tenant_id,inspection_plan_id,version,status,sampling_method,acceptance_rule,effective_at,published_at,canonical_hash,created_by) VALUES($1,$2,1,'DRAFT',$3,$4,$5,NULL,$6,$7) RETURNING id`,
          [
            context.actor.companyId,
            plan.id,
            input.samplingMethod,
            input.acceptanceRule,
            input.effectiveAt,
            hash(payload),
            context.actor.employeeId,
          ],
        )
      ).rows[0];
      if (!version) throw new Error('Quality plan version insert failed');
      for (const [index, item] of input.characteristics.entries())
        await tx.query(
          `INSERT INTO quality_plan_characteristics(tenant_id,inspection_plan_version_id,sequence,code,name,data_type,unit_code,lower_limit,upper_limit,required,instructions) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
          [
            context.actor.companyId,
            version.id,
            index + 1,
            item.code,
            item.name,
            item.dataType,
            item.unitCode ?? null,
            item.lowerLimit ?? null,
            item.upperLimit ?? null,
            item.required,
            item.instructions,
          ],
        );
      if (input.publish)
        await tx.query(
          "UPDATE quality_inspection_plan_versions SET status='PUBLISHED',published_at=now() WHERE tenant_id=$1 AND id=$2",
          [context.actor.companyId, version.id],
        );
      const result = json({
        id: version.id,
        planId: plan.id,
        status: input.publish ? 'PUBLISHED' : 'DRAFT',
        ...input,
      });
      await evidence(tx, 'quality-plan.created', version.id, context, correlationId, result);
      return result;
    });
  }

  public publishPlan(id: string, context: Context, correlationId: string) {
    return this.db.transaction(async (tx) => {
      company(context);
      const row = (
        await tx.query<{ id: string }>(
          "UPDATE quality_inspection_plan_versions SET status='PUBLISHED',published_at=now() WHERE tenant_id=$1 AND id=$2 AND status='DRAFT' RETURNING id",
          [context.actor.companyId, id],
        )
      ).rows[0];
      if (!row) throw new DomainError('not_found', 'Draft quality plan not found');
      const result = json({ id, status: 'PUBLISHED' });
      await evidence(tx, 'quality-plan.published', id, context, correlationId, result);
      return result;
    });
  }

  public openInspection(
    input: {
      inspectionNumber: string;
      planVersionId: string;
      lotId: string;
      sourceType: string;
      sourceId: string;
      sampleSize: string;
    },
    context: Context,
    correlationId: string,
  ) {
    return this.db.transaction(async (tx) => {
      company(context);
      const payload = json(input);
      const row = (
        await tx.query<{ id: string }>(
          `INSERT INTO quality_inspections(tenant_id,inspection_number,inspection_plan_version_id,lot_id,source_type,source_id,sample_size,opened_by,canonical_hash) SELECT $1,$2,$3,$4,$5,$6,$7,$8,$9 WHERE EXISTS(SELECT 1 FROM quality_inspection_plan_versions v JOIN quality_inspection_plans p ON p.tenant_id=v.tenant_id AND p.id=v.inspection_plan_id JOIN inventory_lots l ON l.tenant_id=p.tenant_id AND l.id=$4 AND l.item_version_id=p.item_version_id WHERE v.tenant_id=$1 AND v.id=$3 AND v.status='PUBLISHED') RETURNING id`,
          [
            context.actor.companyId,
            input.inspectionNumber,
            input.planVersionId,
            input.lotId,
            input.sourceType,
            input.sourceId,
            input.sampleSize,
            context.actor.employeeId,
            hash(payload),
          ],
        )
      ).rows[0];
      if (!row)
        throw new DomainError(
          'conflict',
          'Inspection requires published plan matching the lot item',
        );
      await tx.query(
        `INSERT INTO quality_inspection_events(tenant_id,inspection_id,sequence,state,reason,evidence,actor_id,correlation_id,idempotency_key,canonical_hash) VALUES($1,$2,1,'OPEN','Inspection opened',$3,$4,$5,$6,$7)`,
        [
          context.actor.companyId,
          row.id,
          payload,
          context.actor.employeeId,
          correlationId,
          `${input.inspectionNumber}:OPEN`,
          hash({ ...input, state: 'OPEN' }),
        ],
      );
      const existing = (
        await tx.query<{ sequence: number }>(
          'SELECT sequence FROM inventory_lot_quality_events WHERE tenant_id=$1 AND lot_id=$2 ORDER BY sequence DESC LIMIT 1',
          [context.actor.companyId, input.lotId],
        )
      ).rows[0];
      if (!existing)
        await tx.query(
          `INSERT INTO inventory_lot_quality_events(tenant_id,lot_id,inspection_id,sequence,state,reason,evidence,actor_id,correlation_id,idempotency_key,canonical_hash) VALUES($1,$2,$3,1,'QUARANTINE','Inspection opened',$4,$5,$6,$7,$8)`,
          [
            context.actor.companyId,
            input.lotId,
            row.id,
            payload,
            context.actor.employeeId,
            correlationId,
            `${input.inspectionNumber}:QUARANTINE`,
            hash({ ...input, qualityState: 'QUARANTINE' }),
          ],
        );
      const result = json({ id: row.id, state: 'OPEN', ...input });
      await evidence(tx, 'quality-inspection.opened', row.id, context, correlationId, result);
      return result;
    });
  }

  public transitionInspection(
    id: string,
    state: 'SAMPLED' | 'COMPLETED' | 'CANCELLED',
    input: { reason: string; evidence: JsonObject; idempotencyKey: string },
    context: Context,
    correlationId: string,
  ) {
    return this.db.transaction(async (tx) => {
      company(context);
      const current = (
        await tx.query<{ sequence: number }>(
          'SELECT sequence FROM quality_inspection_effective_states WHERE tenant_id=$1 AND inspection_id=$2',
          [context.actor.companyId, id],
        )
      ).rows[0];
      if (!current) throw new DomainError('not_found', 'Inspection not found');
      const payload = json({ id, state, ...input });
      await tx.query(
        `INSERT INTO quality_inspection_events(tenant_id,inspection_id,sequence,state,reason,evidence,actor_id,correlation_id,idempotency_key,canonical_hash) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [
          context.actor.companyId,
          id,
          current.sequence + 1,
          state,
          input.reason,
          input.evidence,
          context.actor.employeeId,
          correlationId,
          input.idempotencyKey,
          hash(payload),
        ],
      );
      await evidence(
        tx,
        `quality-inspection.${state.toLowerCase()}`,
        id,
        context,
        correlationId,
        payload,
      );
      return payload;
    });
  }

  public recordResult(
    id: string,
    input: {
      characteristicId: string;
      measuredNumeric?: string;
      measuredBoolean?: boolean;
      measuredText?: string;
      passed: boolean;
      notes: string;
      occurredAt: string;
      idempotencyKey: string;
    },
    context: Context,
    correlationId: string,
  ) {
    return this.db.transaction(async (tx) => {
      company(context);
      const payload = json(input);
      const row = (
        await tx.query<{ id: string }>(
          `INSERT INTO quality_inspection_results(tenant_id,inspection_id,characteristic_id,measured_numeric,measured_boolean,measured_text,passed,notes,inspector_id,occurred_at,idempotency_key,canonical_hash) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
          [
            context.actor.companyId,
            id,
            input.characteristicId,
            input.measuredNumeric ?? null,
            input.measuredBoolean ?? null,
            input.measuredText ?? null,
            input.passed,
            input.notes,
            context.actor.employeeId,
            input.occurredAt,
            input.idempotencyKey,
            hash(payload),
          ],
        )
      ).rows[0];
      if (!row) throw new Error('Inspection result insert failed');
      const result = json({ id: row.id, inspectionId: id, ...input });
      await evidence(tx, 'quality-inspection.result-recorded', id, context, correlationId, result);
      return result;
    });
  }

  public dispose(
    id: string,
    state: 'RELEASED' | 'REJECTED',
    input: { reason: string; evidence: JsonObject; idempotencyKey: string },
    context: Context,
    correlationId: string,
  ) {
    return this.db.transaction(async (tx) => {
      company(context);
      const inspection = (
        await tx.query<{ lot_id: string; sequence: number }>(
          `SELECT q.lot_id,s.sequence FROM quality_inspections q JOIN quality_inspection_effective_states s ON s.tenant_id=q.tenant_id AND s.inspection_id=q.id WHERE q.tenant_id=$1 AND q.id=$2 FOR UPDATE OF q`,
          [context.actor.companyId, id],
        )
      ).rows[0];
      if (!inspection) throw new DomainError('not_found', 'Inspection not found');
      const lotSequence =
        (
          await tx.query<{ sequence: number }>(
            'SELECT sequence FROM inventory_lot_quality_events WHERE tenant_id=$1 AND lot_id=$2 ORDER BY sequence DESC LIMIT 1',
            [context.actor.companyId, inspection.lot_id],
          )
        ).rows[0]?.sequence ?? 0;
      const payload = json({ id, state, ...input });
      await tx.query(
        `INSERT INTO inventory_lot_quality_events(tenant_id,lot_id,inspection_id,sequence,state,reason,evidence,actor_id,correlation_id,idempotency_key,canonical_hash) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [
          context.actor.companyId,
          inspection.lot_id,
          id,
          lotSequence + 1,
          state,
          input.reason,
          input.evidence,
          context.actor.employeeId,
          correlationId,
          input.idempotencyKey,
          hash(payload),
        ],
      );
      await tx.query(
        `INSERT INTO quality_inspection_events(tenant_id,inspection_id,sequence,state,reason,evidence,actor_id,correlation_id,idempotency_key,canonical_hash) VALUES($1,$2,$3,'DISPOSITIONED',$4,$5,$6,$7,$8,$9)`,
        [
          context.actor.companyId,
          id,
          inspection.sequence + 1,
          input.reason,
          input.evidence,
          context.actor.employeeId,
          correlationId,
          `${input.idempotencyKey}:INSPECTION`,
          hash({ ...payload, inspectionState: 'DISPOSITIONED' }),
        ],
      );
      await evidence(
        tx,
        `quality-inspection.${state.toLowerCase()}`,
        id,
        context,
        correlationId,
        payload,
      );
      return payload;
    });
  }
}
