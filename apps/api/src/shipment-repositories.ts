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
const digest = (value: unknown) => createHash('sha256').update(canonicalize(value)).digest('hex');
const company = (context: Context) => {
  if (!context.scopes.includes('COMPANY') && !context.scopes.includes('GROUP'))
    throw new DomainError('forbidden', 'Shipment operations require company scope');
};

export class PostgresShipmentRepository {
  public constructor(private readonly db: Db) {}

  public async list(context: Context) {
    company(context);
    return (
      await this.db.query<{ item: JsonObject }>(
        `SELECT to_jsonb(r)||jsonb_build_object('state',s.state,'orderNumber',o.order_number,'productionOrderNumber',p.order_number,'lotNumber',l.lot_number,
        'events',coalesce((SELECT jsonb_agg(to_jsonb(e) ORDER BY e.sequence) FROM shipment_release_events e WHERE e.tenant_id=r.tenant_id AND e.release_request_id=r.id),'[]'::jsonb),
        'shipments',coalesce((SELECT jsonb_agg(to_jsonb(sh)||jsonb_build_object('state',ss.state,'events',coalesce((SELECT jsonb_agg(to_jsonb(se) ORDER BY se.sequence) FROM shipment_events se WHERE se.tenant_id=sh.tenant_id AND se.shipment_id=sh.id),'[]'::jsonb)) ORDER BY sh.created_at) FROM shipments sh JOIN shipment_effective_states ss ON ss.tenant_id=sh.tenant_id AND ss.shipment_id=sh.id WHERE sh.tenant_id=r.tenant_id AND sh.release_request_id=r.id),'[]'::jsonb)) item
        FROM shipment_release_requests r JOIN shipment_release_effective_states s ON s.tenant_id=r.tenant_id AND s.release_request_id=r.id
        JOIN sales_orders o ON o.tenant_id=r.tenant_id AND o.id=r.sales_order_id JOIN production_orders p ON p.tenant_id=r.tenant_id AND p.id=r.production_order_id
        JOIN inventory_lots l ON l.tenant_id=r.tenant_id AND l.id=r.finished_lot_id WHERE r.tenant_id=$1 ORDER BY r.created_at DESC`,
        [context.actor.companyId],
      )
    ).rows.map((x) => x.item);
  }

  public request(
    input: {
      requestNumber: string;
      salesOrderId: string;
      productionOrderId: string;
      finishedLotId: string;
      requestedQuantity: string;
      requiredPaymentAmount: string;
      reason: string;
      idempotencyKey: string;
    },
    context: Context,
    correlationId: string,
  ) {
    return this.db.transaction(async (tx) => {
      company(context);
      const gate = (
        await tx.query<{
          contract_ok: boolean;
          credit_ok: boolean;
          payment_ok: boolean;
          overdue_ok: boolean;
          order_link_ok: boolean;
          quality_ok: boolean;
          production_ok: boolean;
          cost_ok: boolean;
          available_quantity: string;
        }>(
          `SELECT
          EXISTS(SELECT 1 FROM sales_orders o JOIN contract_signature_evidence e ON e.tenant_id=o.tenant_id AND e.id=o.signature_evidence_id WHERE o.tenant_id=$1 AND o.id=$2 AND o.status='RELEASED') contract_ok,
          EXISTS(SELECT 1 FROM sales_orders o JOIN effective_credit_decisions c ON c.tenant_id=o.tenant_id AND c.id=o.credit_decision_id WHERE o.tenant_id=$1 AND o.id=$2 AND c.effective_status='APPROVED' AND c.valid_until>now()) credit_ok,
          coalesce((SELECT sum(a.amount) FROM ar_documents d JOIN ar_open_items i ON i.tenant_id=d.tenant_id AND i.ar_document_id=d.id JOIN allocation_entries a ON a.tenant_id=i.tenant_id AND a.ar_open_item_id=i.id WHERE d.tenant_id=$1 AND d.sales_order_id=$2),0)>=$5::numeric payment_ok,
          NOT EXISTS(SELECT 1 FROM ar_documents d JOIN ar_open_item_balances b ON b.tenant_id=d.tenant_id AND b.ar_document_id=d.id WHERE d.tenant_id=$1 AND d.sales_order_id=$2 AND b.due_at<now() AND b.remaining_amount>0) overdue_ok,
          EXISTS(SELECT 1 FROM production_orders p JOIN mrp_proposals mp ON mp.tenant_id=p.tenant_id AND mp.id=p.mrp_proposal_id JOIN mrp_demand_snapshots d ON d.tenant_id=mp.tenant_id AND d.mrp_run_id=mp.mrp_run_id AND d.item_version_id=p.item_version_id WHERE p.tenant_id=$1 AND p.id=$3 AND d.source_type IN('SALES_ORDER','SALES-ORDER') AND d.source_id=$2) order_link_ok,
          EXISTS(SELECT 1 FROM inventory_lot_effective_quality q WHERE q.tenant_id=$1 AND q.lot_id=$4 AND q.quality_status='RELEASED') quality_ok,
          EXISTS(SELECT 1 FROM production_orders p JOIN production_order_effective_states s ON s.tenant_id=p.tenant_id AND s.production_order_id=p.id JOIN production_rolls r ON r.tenant_id=p.tenant_id AND r.production_order_id=p.id AND r.lot_id=$4 WHERE p.tenant_id=$1 AND p.id=$3 AND s.state IN('COMPLETED','CLOSED')) production_ok,
          EXISTS(SELECT 1 FROM production_cost_runs c JOIN production_cost_run_effective_states s ON s.tenant_id=c.tenant_id AND s.cost_run_id=c.id WHERE c.tenant_id=$1 AND c.production_order_id=$3 AND s.state='APPROVED') cost_ok,
          coalesce((SELECT sum(b.quantity) FROM inventory_balances b WHERE b.tenant_id=$1 AND b.lot_id=$4),0)::text available_quantity`,
          [
            context.actor.companyId,
            input.salesOrderId,
            input.productionOrderId,
            input.finishedLotId,
            input.requiredPaymentAmount,
          ],
        )
      ).rows[0];
      if (!gate) throw new DomainError('not_found', 'Shipment dependencies not found');
      const quantityOk = Number(gate.available_quantity) >= Number(input.requestedQuantity);
      const failures = Object.entries({
        contract: gate.contract_ok,
        credit: gate.credit_ok,
        payment: gate.payment_ok,
        overdue: gate.overdue_ok,
        orderLink: gate.order_link_ok,
        quality: gate.quality_ok,
        production: gate.production_ok,
        cost: gate.cost_ok,
        inventory: quantityOk,
      })
        .filter(([, ok]) => !ok)
        .map(([name]) => name);
      const snapshot = {
        ...gate,
        quantityOk,
        failures,
        evaluatedAt: new Date().toISOString(),
        formulaVersion: 'KT-L18-V1',
      };
      const row = (
        await tx.query<{ id: string }>(
          `INSERT INTO shipment_release_requests(tenant_id,request_number,sales_order_id,production_order_id,finished_lot_id,requested_quantity,required_payment_amount,gate_snapshot,gate_hash,created_by,correlation_id,idempotency_key)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
          [
            context.actor.companyId,
            input.requestNumber,
            input.salesOrderId,
            input.productionOrderId,
            input.finishedLotId,
            input.requestedQuantity,
            input.requiredPaymentAmount,
            snapshot,
            digest(snapshot),
            context.actor.employeeId,
            correlationId,
            input.idempotencyKey,
          ],
        )
      ).rows[0];
      if (!row) throw new Error('Shipment release request insert failed');
      const state = failures.length ? 'EXCEPTION_PENDING' : 'READY';
      const event = {
        releaseRequestId: row.id,
        sequence: 1,
        state,
        reason: input.reason,
        evidence: { failures },
      };
      await tx.query(
        `INSERT INTO shipment_release_events(tenant_id,release_request_id,sequence,state,reason,evidence,actor_id,correlation_id,idempotency_key,canonical_hash) VALUES($1,$2,1,$3,$4,$5,$6,$7,$8,$9)`,
        [
          context.actor.companyId,
          row.id,
          state,
          input.reason,
          { failures },
          context.actor.employeeId,
          correlationId,
          `${input.idempotencyKey}:event`,
          digest(event),
        ],
      );
      await tx.query(
        "INSERT INTO audit_events(action,outcome,actor_id,organization_id,target_type,target_id,correlation_id,metadata) VALUES('shipment.release-requested','SUCCESS',$1,$2,'shipment-release',$3,$4,$5)",
        [context.actor.employeeId, context.actor.companyId, row.id, correlationId, snapshot],
      );
      return { id: row.id, state, gateSnapshot: snapshot };
    });
  }

  public transition(
    releaseRequestId: string,
    state: 'APPROVED' | 'REJECTED' | 'RELEASED',
    input: { reason: string; evidence: JsonObject; idempotencyKey: string },
    context: Context,
    correlationId: string,
  ) {
    return this.db.transaction(async (tx) => {
      company(context);
      const current = (
        await tx.query<{ sequence: number }>(
          'SELECT sequence FROM shipment_release_effective_states WHERE tenant_id=$1 AND release_request_id=$2',
          [context.actor.companyId, releaseRequestId],
        )
      ).rows[0];
      if (!current) throw new DomainError('not_found', 'Shipment release request not found');
      const event = {
        releaseRequestId,
        sequence: current.sequence + 1,
        state,
        reason: input.reason,
        evidence: input.evidence,
      };
      await tx.query(
        `INSERT INTO shipment_release_events(tenant_id,release_request_id,sequence,state,reason,evidence,actor_id,correlation_id,idempotency_key,canonical_hash) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [
          context.actor.companyId,
          releaseRequestId,
          event.sequence,
          state,
          input.reason,
          input.evidence,
          context.actor.employeeId,
          correlationId,
          input.idempotencyKey,
          digest(event),
        ],
      );
      return event;
    });
  }

  public dispatch(
    releaseRequestId: string,
    input: {
      shipmentNumber: string;
      carrierName: string;
      trackingNumber: string;
      dispatchedAt: string;
      location: string;
      evidence: JsonObject;
      idempotencyKey: string;
    },
    context: Context,
    correlationId: string,
  ) {
    return this.db.transaction(async (tx) => {
      company(context);
      const payload = { releaseRequestId, ...input };
      const row = (
        await tx.query<{ id: string }>(
          `INSERT INTO shipments(tenant_id,shipment_number,release_request_id,carrier_name,tracking_number,dispatched_at,actor_id,correlation_id,idempotency_key,canonical_hash) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
          [
            context.actor.companyId,
            input.shipmentNumber,
            releaseRequestId,
            input.carrierName,
            input.trackingNumber,
            input.dispatchedAt,
            context.actor.employeeId,
            correlationId,
            input.idempotencyKey,
            digest(payload),
          ],
        )
      ).rows[0];
      if (!row) throw new Error('Shipment insert failed');
      const event = {
        shipmentId: row.id,
        sequence: 1,
        state: 'DISPATCHED',
        occurredAt: input.dispatchedAt,
        location: input.location,
        evidence: input.evidence,
      };
      await tx.query(
        `INSERT INTO shipment_events(tenant_id,shipment_id,sequence,state,occurred_at,location,evidence,actor_id,correlation_id,idempotency_key,canonical_hash) VALUES($1,$2,1,'DISPATCHED',$3,$4,$5,$6,$7,$8,$9)`,
        [
          context.actor.companyId,
          row.id,
          input.dispatchedAt,
          input.location,
          input.evidence,
          context.actor.employeeId,
          correlationId,
          `${input.idempotencyKey}:event`,
          digest(event),
        ],
      );
      return { id: row.id, ...event };
    });
  }

  public track(
    shipmentId: string,
    state: 'IN_TRANSIT' | 'DELIVERED',
    input: { occurredAt: string; location: string; evidence: JsonObject; idempotencyKey: string },
    context: Context,
    correlationId: string,
  ) {
    return this.db.transaction(async (tx) => {
      company(context);
      const current = (
        await tx.query<{ sequence: number }>(
          'SELECT sequence FROM shipment_effective_states WHERE tenant_id=$1 AND shipment_id=$2',
          [context.actor.companyId, shipmentId],
        )
      ).rows[0];
      if (!current) throw new DomainError('not_found', 'Shipment not found');
      const event = {
        shipmentId,
        sequence: current.sequence + 1,
        state,
        occurredAt: input.occurredAt,
        location: input.location,
        evidence: input.evidence,
      };
      await tx.query(
        `INSERT INTO shipment_events(tenant_id,shipment_id,sequence,state,occurred_at,location,evidence,actor_id,correlation_id,idempotency_key,canonical_hash) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [
          context.actor.companyId,
          shipmentId,
          event.sequence,
          state,
          input.occurredAt,
          input.location,
          input.evidence,
          context.actor.employeeId,
          correlationId,
          input.idempotencyKey,
          digest(event),
        ],
      );
      return event;
    });
  }
}
