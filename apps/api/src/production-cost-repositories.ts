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
const company = (context: Context) => {
  if (!context.scopes.includes('COMPANY') && !context.scopes.includes('GROUP'))
    throw new DomainError('forbidden', 'Manufacturing cost requires company scope');
};
const money = (value: number) => value.toFixed(6);

export class PostgresProductionCostRepository {
  public constructor(private readonly db: Db) {}

  public async list(context: Context) {
    company(context);
    return (
      await this.db.query<{ item: JsonObject }>(
        `SELECT to_jsonb(r)||jsonb_build_object('state',s.state,'orderNumber',o.order_number,'currency',p.currency,'policyVersion',p.version) item
      FROM production_cost_runs r JOIN production_cost_run_effective_states s ON s.tenant_id=r.tenant_id AND s.cost_run_id=r.id
      JOIN production_orders o ON o.tenant_id=r.tenant_id AND o.id=r.production_order_id JOIN production_cost_policies p ON p.tenant_id=r.tenant_id AND p.id=r.policy_id
      WHERE r.tenant_id=$1 ORDER BY r.created_at DESC`,
        [context.actor.companyId],
      )
    ).rows.map((x) => x.item);
  }
  public async listPolicies(context: Context) {
    company(context);
    return (
      await this.db.query<{ item: JsonObject }>(
        `SELECT to_jsonb(p)||jsonb_build_object('materialRates',coalesce((SELECT jsonb_agg(to_jsonb(r) ORDER BY r.item_version_id) FROM production_cost_policy_material_rates r WHERE r.tenant_id=p.tenant_id AND r.policy_id=p.id),'[]'::jsonb)) item FROM production_cost_policies p WHERE p.tenant_id=$1 ORDER BY p.version DESC`,
        [context.actor.companyId],
      )
    ).rows.map((x) => x.item);
  }

  public createPolicy(
    input: {
      version: number;
      currency: string;
      laborRatePerHour: string;
      machineRatePerHour: string;
      overheadRatePerMachineHour: string;
      effectiveFrom: string;
      effectiveTo?: string;
      sourceReference: string;
      materialRates: readonly {
        itemVersionId: string;
        unitCost: string;
        sourceReference: string;
      }[];
    },
    context: Context,
    correlationId: string,
  ) {
    return this.db.transaction(async (tx) => {
      company(context);
      const policy = (
        await tx.query<{ id: string }>(
          `INSERT INTO production_cost_policies(tenant_id,version,currency,labor_rate_per_hour,machine_rate_per_hour,overhead_rate_per_machine_hour,effective_from,effective_to,source_reference,created_by,canonical_hash)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
          [
            context.actor.companyId,
            input.version,
            input.currency,
            input.laborRatePerHour,
            input.machineRatePerHour,
            input.overheadRatePerMachineHour,
            input.effectiveFrom,
            input.effectiveTo ?? null,
            input.sourceReference,
            context.actor.employeeId,
            hash(input),
          ],
        )
      ).rows[0];
      if (!policy) throw new Error('Cost policy insert failed');
      for (const rate of input.materialRates)
        await tx.query(
          `INSERT INTO production_cost_policy_material_rates(tenant_id,policy_id,item_version_id,unit_cost,source_reference) VALUES($1,$2,$3,$4,$5)`,
          [
            context.actor.companyId,
            policy.id,
            rate.itemVersionId,
            rate.unitCost,
            rate.sourceReference,
          ],
        );
      const result = { id: policy.id, ...input };
      await tx.query(
        "INSERT INTO audit_events(action,outcome,actor_id,organization_id,target_type,target_id,correlation_id,metadata) VALUES('manufacturing-cost.policy-created','SUCCESS',$1,$2,'production-cost-policy',$3,$4,$5)",
        [context.actor.employeeId, context.actor.companyId, policy.id, correlationId, result],
      );
      return result;
    });
  }

  public calculate(
    input: {
      productionOrderId: string;
      policyId: string;
      runNumber: string;
      idempotencyKey: string;
    },
    context: Context,
    correlationId: string,
  ) {
    return this.db.transaction(async (tx) => {
      company(context);
      const material = (
        await tx.query<{
          item_version_id: string;
          sku: string;
          planned_quantity: string;
          actual_quantity: string;
          unit_cost: string;
        }>(
          `WITH chosen_bom AS(
        SELECT b.id FROM manufacturing_bom_versions b JOIN production_orders o ON o.tenant_id=b.tenant_id AND o.item_version_id=b.product_item_version_id
        WHERE o.tenant_id=$1 AND o.id=$2 AND b.status='PUBLISHED' ORDER BY b.published_at DESC LIMIT 1)
        SELECT l.component_item_version_id item_version_id,i.sku,
          trunc(l.quantity*(1+l.scrap_basis_points::numeric/10000)*o.planned_quantity,6)::text planned_quantity,
          coalesce((SELECT trunc(sum(CASE WHEN t.transaction_type='ISSUE' THEN t.quantity ELSE -t.quantity END),6) FROM production_material_transactions t WHERE t.tenant_id=o.tenant_id AND t.production_order_id=o.id AND t.item_version_id=l.component_item_version_id),0)::text actual_quantity,
          r.unit_cost::text FROM chosen_bom c JOIN manufacturing_bom_lines l ON l.bom_version_id=c.id
        JOIN production_orders o ON o.tenant_id=l.tenant_id AND o.id=$2 JOIN production_cost_policy_material_rates r ON r.tenant_id=l.tenant_id AND r.policy_id=$3 AND r.item_version_id=l.component_item_version_id
        JOIN manufacturing_item_versions v ON v.tenant_id=l.tenant_id AND v.id=l.component_item_version_id JOIN manufacturing_items i ON i.tenant_id=v.tenant_id AND i.id=v.item_id`,
          [context.actor.companyId, input.productionOrderId, input.policyId],
        )
      ).rows;
      if (!material.length)
        throw new DomainError(
          'conflict',
          'Cost calculation requires a published BOM and material rates',
        );
      const labor = (
        await tx.query<{
          operation_code: string;
          planned_minutes: string;
          actual_labor_minutes: string;
          actual_machine_minutes: string;
        }>(
          `SELECT op.operation_code,trunc(op.setup_minutes+op.run_minutes_per_unit*o.planned_quantity,6)::text planned_minutes,
        coalesce((SELECT sum(x.labor_minutes) FROM production_operation_reports x WHERE x.tenant_id=op.tenant_id AND x.production_order_operation_id=op.id),0)::text actual_labor_minutes,
        coalesce((SELECT sum(x.machine_minutes) FROM production_operation_reports x WHERE x.tenant_id=op.tenant_id AND x.production_order_operation_id=op.id),0)::text actual_machine_minutes
        FROM production_order_operations op JOIN production_orders o ON o.tenant_id=op.tenant_id AND o.id=op.production_order_id WHERE op.tenant_id=$1 AND op.production_order_id=$2 ORDER BY op.sequence`,
          [context.actor.companyId, input.productionOrderId],
        )
      ).rows;
      const policy = (
        await tx.query<{
          labor_rate_per_hour: string;
          machine_rate_per_hour: string;
          overhead_rate_per_machine_hour: string;
        }>(
          `SELECT labor_rate_per_hour::text,machine_rate_per_hour::text,overhead_rate_per_machine_hour::text FROM production_cost_policies WHERE tenant_id=$1 AND id=$2`,
          [context.actor.companyId, input.policyId],
        )
      ).rows[0];
      if (!policy) throw new DomainError('not_found', 'Manufacturing cost policy not found');
      const plannedMaterial = material.reduce(
          (s, x) => s + Number(x.planned_quantity) * Number(x.unit_cost),
          0,
        ),
        actualMaterial = material.reduce(
          (s, x) => s + Number(x.actual_quantity) * Number(x.unit_cost),
          0,
        );
      const plannedMinutes = labor.reduce((s, x) => s + Number(x.planned_minutes), 0),
        actualLaborMinutes = labor.reduce((s, x) => s + Number(x.actual_labor_minutes), 0),
        actualMachineMinutes = labor.reduce((s, x) => s + Number(x.actual_machine_minutes), 0);
      const plannedLabor = (plannedMinutes / 60) * Number(policy.labor_rate_per_hour),
        actualLabor = (actualLaborMinutes / 60) * Number(policy.labor_rate_per_hour),
        plannedMachine = (plannedMinutes / 60) * Number(policy.machine_rate_per_hour),
        actualMachine = (actualMachineMinutes / 60) * Number(policy.machine_rate_per_hour),
        plannedOverhead = (plannedMinutes / 60) * Number(policy.overhead_rate_per_machine_hour),
        actualOverhead =
          (actualMachineMinutes / 60) * Number(policy.overhead_rate_per_machine_hour);
      const plannedTotal = plannedMaterial + plannedLabor + plannedMachine + plannedOverhead,
        actualTotal = actualMaterial + actualLabor + actualMachine + actualOverhead;
      const trace = {
        formulaVersion: 'KT-L17-V1',
        roundingScale: 6,
        materialValuation: 'FROZEN_POLICY_RATE',
        laborRatePerHour: policy.labor_rate_per_hour,
        machineRatePerHour: policy.machine_rate_per_hour,
        overheadRatePerMachineHour: policy.overhead_rate_per_machine_hour,
      };
      const values = [
        plannedMaterial,
        actualMaterial,
        plannedLabor,
        actualLabor,
        plannedMachine,
        actualMachine,
        plannedOverhead,
        actualOverhead,
        plannedTotal,
        actualTotal,
        actualTotal - plannedTotal,
      ].map(money);
      const row = (
        await tx.query<{ id: string }>(
          `INSERT INTO production_cost_runs(tenant_id,production_order_id,policy_id,run_number,planned_material,actual_material,planned_labor,actual_labor,planned_machine,actual_machine,planned_overhead,actual_overhead,planned_total,actual_total,variance_total,material_snapshot,labor_snapshot,calculation_trace,created_by,correlation_id,idempotency_key,canonical_hash)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22) RETURNING id`,
          [
            context.actor.companyId,
            input.productionOrderId,
            input.policyId,
            input.runNumber,
            ...values,
            JSON.stringify(material),
            JSON.stringify(labor),
            trace,
            context.actor.employeeId,
            correlationId,
            input.idempotencyKey,
            hash({ input, material, labor, trace, values }),
          ],
        )
      ).rows[0];
      if (!row) throw new Error('Cost run insert failed');
      await tx.query(
        `INSERT INTO production_cost_run_events(tenant_id,cost_run_id,sequence,state,reason,evidence,actor_id,correlation_id,idempotency_key,canonical_hash) VALUES($1,$2,1,'CALCULATED','Actual manufacturing cost calculated',$3,$4,$5,$6,$7)`,
        [
          context.actor.companyId,
          row.id,
          trace,
          context.actor.employeeId,
          correlationId,
          `${input.idempotencyKey}:calculated`,
          hash({ id: row.id, trace }),
        ],
      );
      return {
        id: row.id,
        state: 'CALCULATED',
        ...input,
        plannedTotal: values[8],
        actualTotal: values[9],
        varianceTotal: values[10],
        materialSnapshot: material,
        laborSnapshot: labor,
        calculationTrace: trace,
      };
    });
  }

  public decide(
    id: string,
    state: 'APPROVED' | 'REJECTED',
    input: { reason: string; evidence: JsonObject; idempotencyKey: string },
    context: Context,
    correlationId: string,
  ) {
    return this.db.transaction(async (tx) => {
      company(context);
      const current = (
        await tx.query<{ sequence: number }>(
          `SELECT sequence FROM production_cost_run_effective_states WHERE tenant_id=$1 AND cost_run_id=$2`,
          [context.actor.companyId, id],
        )
      ).rows[0];
      if (!current) throw new DomainError('not_found', 'Cost run not found');
      const payload = { id, state, ...input };
      await tx.query(
        `INSERT INTO production_cost_run_events(tenant_id,cost_run_id,sequence,state,reason,evidence,actor_id,correlation_id,idempotency_key,canonical_hash) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
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
      return payload;
    });
  }
}
