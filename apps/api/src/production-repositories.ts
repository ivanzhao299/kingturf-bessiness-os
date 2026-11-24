import { createHash } from 'node:crypto';
import { canonicalize, DomainError, type Actor, type ScopeAnchor } from '@kingturf/domain';
import type { Database, SqlClient } from '@kingturf/database';
import type { DataScope, JsonObject } from '@kingturf/types';
import { writeProductionNextVersionEvidence as evidence } from './audit-outbox.ts';
import {
  PostgresProductionReadRepository,
  PRODUCTION_ORDER_PROJECTION,
} from './production-read-repositories.ts';

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
    throw new DomainError('forbidden', 'Production execution requires company scope');
};

// U3-MFG-4：写路径（create/transition/transactMaterial/reportOperation/createOutput）
// 与 legacy list——投影常量与 additive 只读方法（listProductionOrderPage/
// findProductionOrder）见 production-read-repositories.ts，本类继承。
export class PostgresProductionRepository extends PostgresProductionReadRepository {
  public constructor(db: Db) {
    super(db);
  }

  public async list(context: Context) {
    company(context);
    return (
      await this.db.query<{ item: JsonObject }>(
        `SELECT ${PRODUCTION_ORDER_PROJECTION} item
      FROM production_orders o JOIN production_order_effective_states s ON s.tenant_id=o.tenant_id AND s.production_order_id=o.id
      JOIN manufacturing_item_versions v ON v.tenant_id=o.tenant_id AND v.id=o.item_version_id JOIN manufacturing_items i ON i.tenant_id=v.tenant_id AND i.id=v.item_id
      WHERE o.tenant_id=$1 ORDER BY o.created_at DESC`,
        [context.actor.companyId],
      )
    ).rows.map((row) => row.item);
  }

  public create(
    input: {
      orderNumber: string;
      itemVersionId: string;
      routingVersionId: string;
      mrpProposalId?: string;
      plannedQuantity: string;
      plannedStartAt: string;
      plannedDueAt: string;
      sourceReference: string;
    },
    context: Context,
    correlationId: string,
  ) {
    return this.db.transaction(async (tx) => {
      company(context);
      const payload = json(input);
      const order = (
        await tx.query<{ id: string }>(
          `INSERT INTO production_orders(tenant_id,order_number,item_version_id,routing_version_id,mrp_proposal_id,planned_quantity,planned_start_at,planned_due_at,source_reference,created_by,canonical_hash)
        SELECT $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11 WHERE EXISTS(SELECT 1 FROM manufacturing_routing_versions r WHERE r.tenant_id=$1 AND r.id=$4 AND r.product_item_version_id=$3 AND r.status='PUBLISHED') RETURNING id`,
          [
            context.actor.companyId,
            input.orderNumber,
            input.itemVersionId,
            input.routingVersionId,
            input.mrpProposalId ?? null,
            input.plannedQuantity,
            input.plannedStartAt,
            input.plannedDueAt,
            input.sourceReference,
            context.actor.employeeId,
            hash(payload),
          ],
        )
      ).rows[0];
      if (!order)
        throw new DomainError(
          'conflict',
          'Production order requires a published routing for its item version',
        );
      const operations = await tx.query(
        `INSERT INTO production_order_operations(tenant_id,production_order_id,sequence,operation_code,name,work_center,setup_minutes,run_minutes_per_unit,routing_operation_id,canonical_hash)
        SELECT $1,$2::uuid,x.sequence,x.operation_code,x.name,x.work_center_code,x.setup_minutes,x.run_minutes_per_unit,x.id,encode(sha256(convert_to(concat_ws('|',$2::text,x.id::text,x.sequence::text,x.operation_code,x.work_center_code),'UTF8')),'hex')
        FROM manufacturing_routing_operations x WHERE x.tenant_id=$1 AND x.routing_version_id=$3 ORDER BY x.sequence`,
        [context.actor.companyId, order.id, input.routingVersionId],
      );
      if (!operations.rowCount)
        throw new DomainError('conflict', 'Production order requires routing operations');
      await tx.query(
        `INSERT INTO production_order_events(tenant_id,production_order_id,sequence,state,reason,evidence,actor_id,correlation_id,idempotency_key,canonical_hash) VALUES($1,$2,1,'DRAFT','Production order created',$3,$4,$5,$6,$7)`,
        [
          context.actor.companyId,
          order.id,
          payload,
          context.actor.employeeId,
          correlationId,
          `${input.sourceReference}:draft`,
          hash({ ...input, state: 'DRAFT' }),
        ],
      );
      const result = json({
        id: order.id,
        state: 'DRAFT',
        operationCount: operations.rowCount,
        ...input,
      });
      await evidence(tx, 'production-order.created', order.id, context, correlationId, result);
      return result;
    });
  }

  public transition(
    id: string,
    state: 'RELEASED' | 'IN_PROGRESS' | 'COMPLETED' | 'CLOSED' | 'CANCELLED',
    input: { reason: string; evidence: JsonObject; idempotencyKey: string },
    context: Context,
    correlationId: string,
  ) {
    return this.db.transaction(async (tx) => {
      company(context);
      const current = (
        await tx.query<{ sequence: number }>(
          `SELECT sequence FROM production_order_effective_states WHERE tenant_id=$1 AND production_order_id=$2`,
          [context.actor.companyId, id],
        )
      ).rows[0];
      if (!current) throw new DomainError('not_found', 'Production order not found');
      const payload = json({ id, state, sequence: current.sequence + 1, ...input });
      await tx.query(
        `INSERT INTO production_order_events(tenant_id,production_order_id,sequence,state,reason,evidence,actor_id,correlation_id,idempotency_key,canonical_hash) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
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
        `production-order.${state.toLowerCase()}`,
        id,
        context,
        correlationId,
        payload,
      );
      return payload;
    });
  }

  // TD-MFG-010（MFG-5）：领料前置校验——批次物料必须属于工单 BOM。判定与迁移 0072 触发器
  // validate_production_execution_entry 里的 bom_component 同一口径（工单成品版本的任一已发布
  // BOM 版本，其行组件含该物料版本）；此前只有触发器把关，抛出的 P0001 到接口是 500，现在回
  // 带业务提示的 409。只接管触发器因 BOM 原因拒绝的这一种情形，其余一律维持原有路径：
  // - 退料由触发器按累计领用量把关（BOM 改版后退回此前领出的旧组件仍是合法写入）；
  // - 工单在本租户内不存在、跨租户、或尚未放行 / 已完成时不做判断——触发器先查工单状态，
  //   那些情形的主因提示仍由触发器给出；
  // - 判定结果形状意外时不拦，数据库触发器是权威，会再次把关。
  // 全部参数化，不拼接输入。
  private async assertIssueComponent(
    tx: SqlClient,
    orderId: string,
    itemVersionId: string,
    companyId: string,
  ): Promise<void> {
    const state = (
      await tx.query<{ active: boolean | null; component: boolean | null }>(
        `SELECT EXISTS(SELECT 1 FROM production_orders o JOIN production_order_effective_states s ON s.tenant_id=o.tenant_id AND s.production_order_id=o.id WHERE o.tenant_id=$1 AND o.id=$2 AND s.state IN('RELEASED','IN_PROGRESS')) active,
        EXISTS(SELECT 1 FROM production_orders o
        JOIN manufacturing_bom_versions b ON b.tenant_id=o.tenant_id AND b.product_item_version_id=o.item_version_id AND b.status='PUBLISHED'
        JOIN manufacturing_bom_lines l ON l.tenant_id=b.tenant_id AND l.bom_version_id=b.id
        WHERE o.tenant_id=$1 AND o.id=$2 AND l.component_item_version_id=$3) component`,
        [companyId, orderId, itemVersionId],
      )
    ).rows[0];
    if (state?.active === true && state.component === false)
      throw new DomainError('conflict', '该批次物料不属于工单 BOM');
  }

  public transactMaterial(
    id: string,
    input: {
      transactionType: 'ISSUE' | 'RETURN';
      itemVersionId: string;
      lotId: string;
      locationId: string;
      quantity: string;
      reason: string;
      occurredAt: string;
      idempotencyKey: string;
    },
    context: Context,
    correlationId: string,
  ) {
    return this.db.transaction(async (tx) => {
      company(context);
      if (input.transactionType === 'ISSUE')
        await this.assertIssueComponent(tx, id, input.itemVersionId, context.actor.companyId);
      const movementType = input.transactionType;
      const delta = input.transactionType === 'ISSUE' ? `-${input.quantity}` : input.quantity;
      const movement = (
        await tx.query<{ id: string }>(
          `INSERT INTO inventory_movements(tenant_id,movement_type,item_version_id,lot_id,location_id,quantity_delta,occurred_at,source_type,source_id,canonical_hash,actor_id,correlation_id) VALUES($1,$2,$3,$4,$5,$6,$7,'PRODUCTION_ORDER',$8,$9,$10,$11) RETURNING id`,
          [
            context.actor.companyId,
            movementType,
            input.itemVersionId,
            input.lotId,
            input.locationId,
            delta,
            input.occurredAt,
            id,
            hash({ id, ...input }),
            context.actor.employeeId,
            correlationId,
          ],
        )
      ).rows[0];
      if (!movement) throw new Error('Inventory movement insert failed');
      const row = (
        await tx.query<{ id: string }>(
          `INSERT INTO production_material_transactions(tenant_id,production_order_id,transaction_type,item_version_id,lot_id,location_id,quantity,inventory_movement_id,reason,actor_id,correlation_id,idempotency_key,occurred_at,canonical_hash) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING id`,
          [
            context.actor.companyId,
            id,
            input.transactionType,
            input.itemVersionId,
            input.lotId,
            input.locationId,
            input.quantity,
            movement.id,
            input.reason,
            context.actor.employeeId,
            correlationId,
            input.idempotencyKey,
            input.occurredAt,
            hash(input),
          ],
        )
      ).rows[0];
      if (!row) throw new Error('Material transaction insert failed');
      const result = json({
        id: row.id,
        productionOrderId: id,
        inventoryMovementId: movement.id,
        ...input,
      });
      await evidence(tx, 'production-order.material-posted', id, context, correlationId, result);
      return result;
    });
  }

  public reportOperation(
    id: string,
    input: {
      operationId: string;
      goodQuantity: string;
      scrapQuantity: string;
      laborMinutes: string;
      machineMinutes: string;
      startedAt: string;
      completedAt: string;
      notes: string;
      idempotencyKey: string;
    },
    context: Context,
    correlationId: string,
  ) {
    return this.db.transaction(async (tx) => {
      company(context);
      const row = (
        await tx.query<{ id: string }>(
          `INSERT INTO production_operation_reports(tenant_id,production_order_id,production_order_operation_id,good_quantity,scrap_quantity,labor_minutes,machine_minutes,started_at,completed_at,operator_id,notes,idempotency_key,correlation_id,canonical_hash) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING id`,
          [
            context.actor.companyId,
            id,
            input.operationId,
            input.goodQuantity,
            input.scrapQuantity,
            input.laborMinutes,
            input.machineMinutes,
            input.startedAt,
            input.completedAt,
            context.actor.employeeId,
            input.notes,
            input.idempotencyKey,
            correlationId,
            hash(input),
          ],
        )
      ).rows[0];
      if (!row) throw new Error('Operation report insert failed');
      const result = json({ id: row.id, productionOrderId: id, ...input });
      await evidence(tx, 'production-order.operation-reported', id, context, correlationId, result);
      return result;
    });
  }

  public createOutput(
    id: string,
    input: {
      operationReportId: string;
      itemVersionId: string;
      rollNumber: string;
      lotNumber: string;
      locationId: string;
      quantity: string;
      manufacturedAt: string;
    },
    context: Context,
    correlationId: string,
  ) {
    return this.db.transaction(async (tx) => {
      company(context);
      const rollId = (await tx.query<{ id: string }>('SELECT gen_random_uuid() id')).rows[0]?.id;
      if (!rollId) throw new Error('Finished roll identifier generation failed');
      const lot = (
        await tx.query<{ id: string }>(
          `INSERT INTO inventory_lots(tenant_id,lot_number,item_version_id,manufactured_at,quality_status)
           VALUES($1,$2,$3,$4,'QUARANTINE') RETURNING id`,
          [context.actor.companyId, input.lotNumber, input.itemVersionId, input.manufacturedAt],
        )
      ).rows[0];
      if (!lot) throw new Error('Finished lot insert failed');
      const movement = (
        await tx.query<{ id: string }>(
          `INSERT INTO inventory_movements(tenant_id,movement_type,item_version_id,lot_id,location_id,quantity_delta,occurred_at,source_type,source_id,canonical_hash,actor_id,correlation_id)
           VALUES($1,'ADJUSTMENT_IN',$2,$3,$4,$5,now(),'PRODUCTION_ROLL',$6,$7,$8,$9) RETURNING id`,
          [
            context.actor.companyId,
            input.itemVersionId,
            lot.id,
            input.locationId,
            input.quantity,
            rollId,
            hash({ id, rollId, ...input }),
            context.actor.employeeId,
            correlationId,
          ],
        )
      ).rows[0];
      if (!movement) throw new Error('Finished inventory receipt failed');
      await tx.query(
        `INSERT INTO production_rolls(id,tenant_id,roll_number,production_order_id,operation_report_id,item_version_id,lot_id,quantity,inventory_movement_id,canonical_hash)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [
          rollId,
          context.actor.companyId,
          input.rollNumber,
          id,
          input.operationReportId,
          input.itemVersionId,
          lot.id,
          input.quantity,
          movement.id,
          hash({ id, rollId, lotId: lot.id, movementId: movement.id, ...input }),
        ],
      );
      const result = json({
        id: rollId,
        productionOrderId: id,
        lotId: lot.id,
        inventoryMovementId: movement.id,
        qualityStatus: 'QUARANTINE',
        ...input,
      });
      await evidence(tx, 'production-order.output-received', id, context, correlationId, result);
      return result;
    });
  }
}
