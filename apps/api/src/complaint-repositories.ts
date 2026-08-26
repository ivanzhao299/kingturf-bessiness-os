import { createHash } from 'node:crypto';
import { canonicalize, DomainError, type Actor, type ScopeAnchor } from '@kingturf/domain';
import type { Database, SqlClient } from '@kingturf/database';
import type { BatchCommandResult, DataScope, JsonObject, Page } from '@kingturf/types';

type Db = SqlClient & Pick<Database, 'transaction'>;
type Context = Readonly<{
  actor: Actor;
  scopes: readonly DataScope[];
  anchors: readonly ScopeAnchor[];
}>;
type Severity = 'LOW' | 'MEDIUM' | 'MAJOR' | 'CRITICAL';
type ComplaintState =
  | 'REPORTED'
  | 'TRIAGED'
  | 'INVESTIGATING'
  | 'NCR_OPEN'
  | 'CAPA_ACTIVE'
  | 'VERIFIED'
  | 'CLOSED'
  | 'REJECTED';
type NcrState = 'OPEN' | 'CONTAINED' | 'ROOT_CAUSE_CONFIRMED' | 'DISPOSITIONED' | 'CLOSED';
type CapaState = 'OPEN' | 'ACTIONS_IN_PROGRESS' | 'READY_FOR_VERIFICATION' | 'VERIFIED' | 'CLOSED';

export type ComplaintListFilter = Readonly<{
  query?: string;
  state?: ComplaintState;
  severity?: Severity;
  assignedTo?: string;
  customerId?: string;
  salesOrderId?: string;
  inventoryLotId?: string;
  createdFrom?: string;
  createdTo?: string;
  overdue?: boolean;
  cursor?: string;
  limit?: number;
}>;

const digest = (value: unknown) => createHash('sha256').update(canonicalize(value)).digest('hex');
const json = (value: unknown) => value as JsonObject;
const scope = (context: Context, alias = 'cu', offset = 2) => {
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

const evidence = async (
  tx: SqlClient,
  action: string,
  targetType: string,
  targetId: string,
  version: number,
  payload: JsonObject,
  context: Context,
  correlationId: string,
) => {
  await tx.query(
    "INSERT INTO audit_events(action,outcome,actor_id,organization_id,target_type,target_id,correlation_id,metadata) VALUES($1,'SUCCESS',$2,$3,$4,$5,$6,$7)",
    [
      action,
      context.actor.employeeId,
      context.actor.companyId,
      targetType,
      targetId,
      correlationId,
      payload,
    ],
  );
  await tx.query(
    'INSERT INTO domain_event_outbox(tenant_id,event_type,event_version,aggregate_type,aggregate_id,aggregate_version,occurred_at,actor_id,correlation_id,payload) VALUES($1,$2,1,$3,$4,$5,now(),$6,$7,$8)',
    [
      context.actor.companyId,
      action,
      targetType,
      targetId,
      version,
      context.actor.employeeId,
      correlationId,
      payload,
    ],
  );
};

const assertReplay = (storedHash: string, payload: unknown) => {
  if (storedHash !== digest(payload))
    throw new DomainError('conflict', 'Idempotency key was already used with different input');
};
const commandLock = (tx: SqlClient, context: Context, namespace: string, key: string) =>
  tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
    `${context.actor.companyId}:${namespace}:${key}`,
  ]);

export class PostgresComplaintRepository {
  public constructor(private readonly db: Db) {}

  public async listSlaPolicies(context: Context): Promise<readonly JsonObject[]> {
    return (
      await this.db.query<{ item: JsonObject }>(
        `SELECT to_jsonb(p) item FROM complaint_sla_policy_versions p
         WHERE p.tenant_id=$1 ORDER BY p.severity,p.effective_at DESC,p.version DESC`,
        [context.actor.companyId],
      )
    ).rows.map((row) => row.item);
  }

  public createSlaPolicy(
    input: {
      policyCode: string;
      version: number;
      severity: Severity;
      responseHours: number;
      containmentHours: number;
      rootCauseHours: number;
      closureHours: number;
      effectiveAt: string;
    },
    context: Context,
    correlationId: string,
  ) {
    return this.db.transaction(async (tx) => {
      await commandLock(
        tx,
        context,
        'complaint-sla-policy',
        `${input.policyCode}:${String(input.version)}:${input.severity}`,
      );
      const canonical = { ...input };
      const canonicalHash = digest(canonical);
      const existing = (
        await tx.query<{ id: string; canonical_hash: string }>(
          'SELECT id,canonical_hash FROM complaint_sla_policy_versions WHERE tenant_id=$1 AND policy_code=$2 AND version=$3 AND severity=$4',
          [context.actor.companyId, input.policyCode, input.version, input.severity],
        )
      ).rows[0];
      if (existing) {
        assertReplay(existing.canonical_hash, canonical);
        return json({ id: existing.id, ...input, replayed: true });
      }
      const row = (
        await tx.query<{ id: string }>(
          `INSERT INTO complaint_sla_policy_versions(tenant_id,policy_code,version,severity,response_hours,containment_hours,root_cause_hours,closure_hours,effective_at,published_at,canonical_hash,created_by)
           VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,now(),$10,$11) RETURNING id`,
          [
            context.actor.companyId,
            input.policyCode,
            input.version,
            input.severity,
            input.responseHours,
            input.containmentHours,
            input.rootCauseHours,
            input.closureHours,
            input.effectiveAt,
            canonicalHash,
            context.actor.employeeId,
          ],
        )
      ).rows[0];
      if (!row) throw new Error('Complaint SLA policy insert failed');
      const result = json({ id: row.id, ...input });
      await evidence(
        tx,
        'complaint-sla-policy.published',
        'complaint-sla-policy',
        row.id,
        input.version,
        result,
        context,
        correlationId,
      );
      return result;
    });
  }

  public async list(filter: ComplaintListFilter, context: Context): Promise<Page<JsonObject>> {
    const secured = scope(context, 'cu', 2);
    const values: unknown[] = [context.actor.companyId, ...secured.values];
    const where = [`c.tenant_id=$1`, secured.sql];
    const add = (sql: string, value: unknown) => {
      values.push(value);
      where.push(sql.replace('?', `$${String(values.length)}`));
    };
    if (filter.query) {
      values.push(`%${filter.query.trim()}%`);
      const p = `$${String(values.length)}`;
      where.push(
        `(c.complaint_number ILIKE ${p} OR cu.name ILIKE ${p} OR coalesce(o.order_number,'') ILIKE ${p} OR c.description ILIKE ${p})`,
      );
    }
    if (filter.state) add('s.state=?::complaint_state', filter.state);
    if (filter.severity) add('c.severity=?::complaint_severity', filter.severity);
    if (filter.assignedTo) add('s.assigned_to=?::uuid', filter.assignedTo);
    if (filter.customerId) add('c.customer_id=?::uuid', filter.customerId);
    if (filter.salesOrderId) add('c.sales_order_id=?::uuid', filter.salesOrderId);
    if (filter.inventoryLotId) add('c.inventory_lot_id=?::uuid', filter.inventoryLotId);
    if (filter.createdFrom) add('c.created_at>=?::timestamptz', filter.createdFrom);
    if (filter.createdTo) add('c.created_at<=?::timestamptz', filter.createdTo);
    if (filter.overdue === true)
      where.push("s.state NOT IN('CLOSED','REJECTED') AND c.closure_due_at<now()");
    if (filter.overdue === false)
      where.push("(s.state IN('CLOSED','REJECTED') OR c.closure_due_at>=now())");
    if (filter.cursor) {
      values.push(filter.cursor);
      const p = `$${String(values.length)}`;
      where.push(
        `(c.closure_due_at,c.id)>(SELECT x.closure_due_at,x.id FROM customer_complaints x WHERE x.tenant_id=$1 AND x.id=${p}::uuid)`,
      );
    }
    const limit = Math.max(1, Math.min(filter.limit ?? 50, 100));
    values.push(limit + 1);
    const rows = (
      await this.db.query<{ item: JsonObject }>(
        `SELECT to_jsonb(c)||jsonb_build_object(
          'state',s.state,'version',s.sequence,'assignedTo',s.assigned_to,
          'customerName',cu.name,'orderNumber',o.order_number,'lotNumber',l.lot_number,
          'shipmentNumber',sh.shipment_number,'overdue',s.state NOT IN('CLOSED','REJECTED') AND c.closure_due_at<now()
        ) item
        FROM customer_complaints c
        JOIN customer_complaint_effective_states s ON s.tenant_id=c.tenant_id AND s.complaint_id=c.id
        JOIN customers cu ON cu.tenant_id=c.tenant_id AND cu.id=c.customer_id
        LEFT JOIN sales_orders o ON o.tenant_id=c.tenant_id AND o.id=c.sales_order_id
        LEFT JOIN inventory_lots l ON l.tenant_id=c.tenant_id AND l.id=c.inventory_lot_id
        LEFT JOIN shipments sh ON sh.tenant_id=c.tenant_id AND sh.id=c.shipment_id
        WHERE ${where.join(' AND ')} ORDER BY c.closure_due_at,c.id LIMIT $${String(values.length)}`,
        values,
      )
    ).rows;
    const hasMore = rows.length > limit;
    const items = rows.slice(0, limit).map((row) => row.item);
    const last = items.at(-1);
    return {
      items,
      nextCursor: hasMore && last && typeof last.id === 'string' ? last.id : null,
    };
  }

  public async getById(id: string, context: Context): Promise<JsonObject> {
    const secured = scope(context, 'cu', 3);
    const row = (
      await this.db.query<{ item: JsonObject }>(
        `SELECT to_jsonb(c)||jsonb_build_object(
          'state',s.state,'version',s.sequence,'assignedTo',s.assigned_to,'customerName',cu.name,
          'orderNumber',o.order_number,'lotNumber',l.lot_number,'shipmentNumber',sh.shipment_number,
          'events',coalesce((SELECT jsonb_agg(to_jsonb(e) ORDER BY e.sequence) FROM customer_complaint_events e WHERE e.tenant_id=c.tenant_id AND e.complaint_id=c.id),'[]'::jsonb),
          'ncr',coalesce((SELECT to_jsonb(n)||jsonb_build_object('state',ns.state,'version',ns.sequence,'events',coalesce((SELECT jsonb_agg(to_jsonb(ne) ORDER BY ne.sequence) FROM ncr_events ne WHERE ne.tenant_id=n.tenant_id AND ne.ncr_id=n.id),'[]'::jsonb),'capa',coalesce((SELECT to_jsonb(cp)||jsonb_build_object('state',cs.state,'version',cs.sequence,'events',coalesce((SELECT jsonb_agg(ce ORDER BY ce.sequence) FROM capa_events ce WHERE ce.tenant_id=cp.tenant_id AND ce.capa_id=cp.id),'[]'::jsonb),'actions',coalesce((SELECT jsonb_agg(to_jsonb(a)||jsonb_build_object('completion',to_jsonb(ac)) ORDER BY a.due_at,a.id) FROM capa_actions a LEFT JOIN capa_action_completions ac ON ac.tenant_id=a.tenant_id AND ac.capa_action_id=a.id WHERE a.tenant_id=cp.tenant_id AND a.capa_id=cp.id),'[]'::jsonb),'verifications',coalesce((SELECT jsonb_agg(to_jsonb(v) ORDER BY v.verified_at,v.id) FROM capa_verifications v WHERE v.tenant_id=cp.tenant_id AND v.capa_id=cp.id),'[]'::jsonb)) FROM capa_cases cp JOIN capa_effective_states cs ON cs.tenant_id=cp.tenant_id AND cs.capa_id=cp.id WHERE cp.tenant_id=n.tenant_id AND cp.ncr_id=n.id),'null'::jsonb)) FROM nonconformance_reports n JOIN ncr_effective_states ns ON ns.tenant_id=n.tenant_id AND ns.ncr_id=n.id WHERE n.tenant_id=c.tenant_id AND n.complaint_id=c.id),'null'::jsonb)
        ) item
        FROM customer_complaints c
        JOIN customer_complaint_effective_states s ON s.tenant_id=c.tenant_id AND s.complaint_id=c.id
        JOIN customers cu ON cu.tenant_id=c.tenant_id AND cu.id=c.customer_id
        LEFT JOIN sales_orders o ON o.tenant_id=c.tenant_id AND o.id=c.sales_order_id
        LEFT JOIN inventory_lots l ON l.tenant_id=c.tenant_id AND l.id=c.inventory_lot_id
        LEFT JOIN shipments sh ON sh.tenant_id=c.tenant_id AND sh.id=c.shipment_id
        WHERE c.tenant_id=$1 AND c.id=$2 AND ${secured.sql}`,
        [context.actor.companyId, id, ...secured.values],
      )
    ).rows[0];
    if (!row) throw new DomainError('not_found', 'Complaint not found');
    return row.item;
  }

  public createComplaint(
    input: {
      complaintNumber: string;
      customerId: string;
      salesOrderId?: string;
      shipmentId?: string;
      inventoryLotId?: string;
      qualityInspectionId?: string;
      slaPolicyVersionId: string;
      channel: 'CUSTOMER_SERVICE' | 'SALES' | 'EMAIL' | 'PHONE' | 'ONSITE' | 'OTHER';
      defectCategory: string;
      severity: Severity;
      occurredAt: string;
      reportedAt: string;
      description: string;
      customerRequest: string;
      assignedTo?: string;
      initialSnapshot: JsonObject;
      idempotencyKey: string;
    },
    context: Context,
    correlationId: string,
  ) {
    return this.db.transaction(async (tx) => {
      await commandLock(tx, context, 'complaint-create', input.idempotencyKey);
      const canonical = { ...input };
      const replay = (
        await tx.query<{ id: string; canonical_hash: string }>(
          'SELECT id,canonical_hash FROM customer_complaints WHERE tenant_id=$1 AND idempotency_key=$2',
          [context.actor.companyId, input.idempotencyKey],
        )
      ).rows[0];
      if (replay) {
        assertReplay(replay.canonical_hash, canonical);
        return { id: replay.id, state: 'REPORTED' as const, replayed: true };
      }
      const secured = scope(context, 'cu', 5);
      const basis = (
        await tx.query<{
          response_hours: number;
          containment_hours: number;
          root_cause_hours: number;
          closure_hours: number;
        }>(
          `SELECT p.response_hours,p.containment_hours,p.root_cause_hours,p.closure_hours
           FROM customers cu JOIN complaint_sla_policy_versions p ON p.tenant_id=cu.tenant_id AND p.id=$2 AND p.severity=$3
           WHERE cu.tenant_id=$1 AND cu.id=$4 AND ${secured.sql}`,
          [
            context.actor.companyId,
            input.slaPolicyVersionId,
            input.severity,
            input.customerId,
            ...secured.values,
          ],
        )
      ).rows[0];
      if (!basis) throw new DomainError('not_found', 'Customer or complaint SLA policy not found');
      const row = (
        await tx.query<{ id: string }>(
          `INSERT INTO customer_complaints(tenant_id,complaint_number,customer_id,sales_order_id,shipment_id,inventory_lot_id,quality_inspection_id,sla_policy_version_id,channel,defect_category,severity,occurred_at,reported_at,description,customer_request,initial_snapshot,assigned_to,response_due_at,containment_due_at,root_cause_due_at,closure_due_at,reported_by,correlation_id,idempotency_key,canonical_hash)
           VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$13::timestamptz+make_interval(hours=>$18),$13::timestamptz+make_interval(hours=>$19),$13::timestamptz+make_interval(hours=>$20),$13::timestamptz+make_interval(hours=>$21),$22,$23,$24,$25) RETURNING id`,
          [
            context.actor.companyId,
            input.complaintNumber,
            input.customerId,
            input.salesOrderId ?? null,
            input.shipmentId ?? null,
            input.inventoryLotId ?? null,
            input.qualityInspectionId ?? null,
            input.slaPolicyVersionId,
            input.channel,
            input.defectCategory,
            input.severity,
            input.occurredAt,
            input.reportedAt,
            input.description,
            input.customerRequest,
            input.initialSnapshot,
            input.assignedTo ?? null,
            basis.response_hours,
            basis.containment_hours,
            basis.root_cause_hours,
            basis.closure_hours,
            context.actor.employeeId,
            correlationId,
            input.idempotencyKey,
            digest(canonical),
          ],
        )
      ).rows[0];
      if (!row) throw new Error('Complaint insert failed');
      await this.insertComplaintEvent(
        tx,
        row.id,
        'REPORTED',
        0,
        '客户投诉已登记',
        input.initialSnapshot,
        input.assignedTo ?? null,
        `${input.idempotencyKey}:reported`,
        context,
        correlationId,
      );
      const result = json({ id: row.id, state: 'REPORTED', severity: input.severity });
      await evidence(
        tx,
        'complaint.created',
        'complaint',
        row.id,
        1,
        result,
        context,
        correlationId,
      );
      return result;
    });
  }

  public transitionComplaint(
    id: string,
    input: {
      state: Exclude<ComplaintState, 'REPORTED'>;
      expectedVersion: number;
      reason: string;
      evidence: JsonObject;
      assignedTo?: string | null;
      idempotencyKey: string;
    },
    context: Context,
    correlationId: string,
  ) {
    return this.db.transaction(async (tx) => {
      await commandLock(tx, context, `complaint:${id}`, input.idempotencyKey);
      const current = await this.complaintCurrent(tx, id, context);
      const assignedTo = input.assignedTo === undefined ? current.assigned_to : input.assignedTo;
      const payload = { complaintId: id, ...input, assignedTo };
      const replay = await this.eventReplay(
        tx,
        'customer_complaint_events',
        input.idempotencyKey,
        context,
      );
      if (replay) {
        assertReplay(replay.canonical_hash, payload);
        return replay.evidence;
      }
      if (current.sequence !== input.expectedVersion)
        throw new DomainError('conflict', 'Complaint version does not match expectedVersion');
      const allowed: Readonly<Record<ComplaintState, readonly ComplaintState[]>> = {
        REPORTED: ['TRIAGED', 'REJECTED'],
        TRIAGED: ['INVESTIGATING', 'REJECTED'],
        INVESTIGATING: ['NCR_OPEN', 'CLOSED'],
        NCR_OPEN: ['CAPA_ACTIVE'],
        CAPA_ACTIVE: ['VERIFIED'],
        VERIFIED: ['CLOSED'],
        CLOSED: [],
        REJECTED: [],
      };
      if (!allowed[current.state].includes(input.state))
        throw new DomainError(
          'conflict',
          `Complaint cannot transition from ${current.state} to ${input.state}`,
        );
      await this.insertComplaintEvent(
        tx,
        id,
        input.state,
        input.expectedVersion,
        input.reason,
        input.evidence,
        assignedTo,
        input.idempotencyKey,
        context,
        correlationId,
      );
      const result = json({ id, state: input.state, version: input.expectedVersion + 1 });
      await evidence(
        tx,
        `complaint.${input.state.toLowerCase().replace('_', '-')}`,
        'complaint',
        id,
        input.expectedVersion + 1,
        result,
        context,
        correlationId,
      );
      return result;
    });
  }

  public createNcr(
    input: {
      ncrNumber: string;
      complaintId: string;
      defectType: string;
      affectedScope: string;
      responsibleOrganizationId: string;
      investigatorId: string;
      quarantinedQuantity: string;
      temporaryContainment: string;
      complaintExpectedVersion: number;
      evidence: JsonObject;
      idempotencyKey: string;
    },
    context: Context,
    correlationId: string,
  ) {
    return this.db.transaction(async (tx) => {
      await commandLock(tx, context, 'ncr-create', input.idempotencyKey);
      await this.complaintCurrent(tx, input.complaintId, context);
      const canonical = { ...input };
      const replay = (
        await tx.query<{ id: string; canonical_hash: string }>(
          'SELECT id,canonical_hash FROM nonconformance_reports WHERE tenant_id=$1 AND idempotency_key=$2',
          [context.actor.companyId, input.idempotencyKey],
        )
      ).rows[0];
      if (replay) {
        assertReplay(replay.canonical_hash, canonical);
        return json({ id: replay.id, state: 'OPEN', replayed: true });
      }
      const row = (
        await tx.query<{ id: string }>(
          `INSERT INTO nonconformance_reports(tenant_id,ncr_number,complaint_id,defect_type,affected_scope,responsible_organization_id,investigator_id,quarantined_quantity,temporary_containment,created_by,correlation_id,idempotency_key,canonical_hash)
           VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id`,
          [
            context.actor.companyId,
            input.ncrNumber,
            input.complaintId,
            input.defectType,
            input.affectedScope,
            input.responsibleOrganizationId,
            input.investigatorId,
            input.quarantinedQuantity,
            input.temporaryContainment,
            context.actor.employeeId,
            correlationId,
            input.idempotencyKey,
            digest(canonical),
          ],
        )
      ).rows[0];
      if (!row) throw new Error('NCR insert failed');
      await this.insertNcrEvent(
        tx,
        row.id,
        'OPEN',
        0,
        '不合格调查已建立',
        {},
        null,
        null,
        input.evidence,
        `${input.idempotencyKey}:open`,
        context,
        correlationId,
      );
      await this.insertComplaintEvent(
        tx,
        input.complaintId,
        'NCR_OPEN',
        input.complaintExpectedVersion,
        '投诉已进入不合格调查',
        { ncrId: row.id },
        input.investigatorId,
        `${input.idempotencyKey}:complaint`,
        context,
        correlationId,
      );
      const result = json({ id: row.id, complaintId: input.complaintId, state: 'OPEN' });
      await evidence(tx, 'ncr.opened', 'ncr', row.id, 1, result, context, correlationId);
      return result;
    });
  }

  public transitionNcr(
    id: string,
    input: {
      state: Exclude<NcrState, 'OPEN'>;
      expectedVersion: number;
      reason: string;
      rootCauseMethod?: 'FIVE_WHY' | 'FISHBONE' | 'FAULT_TREE' | 'OTHER';
      rootCause?: JsonObject;
      disposition?: 'REWORK' | 'REPAIR' | 'CONCESSION' | 'RETURN' | 'SCRAP' | 'SUPPLIER_CLAIM';
      approvedBy?: string;
      evidence: JsonObject;
      idempotencyKey: string;
    },
    context: Context,
    correlationId: string,
  ) {
    return this.db.transaction(async (tx) => {
      await commandLock(tx, context, `ncr:${id}`, input.idempotencyKey);
      const current = await this.ncrCurrent(tx, id, context);
      const payload = {
        ncrId: id,
        state: input.state,
        expectedVersion: input.expectedVersion,
        reason: input.reason,
        rootCause: input.rootCause ?? {},
        rootCauseMethod: input.rootCauseMethod ?? null,
        disposition: input.disposition ?? null,
        evidence: input.evidence,
        approvedBy: input.approvedBy ?? null,
      };
      const replay = await this.eventReplay(tx, 'ncr_events', input.idempotencyKey, context);
      if (replay) {
        assertReplay(replay.canonical_hash, payload);
        return replay.evidence;
      }
      if (current.sequence !== input.expectedVersion)
        throw new DomainError('conflict', 'NCR version does not match expectedVersion');
      const allowed: Readonly<Record<NcrState, readonly NcrState[]>> = {
        OPEN: ['CONTAINED'],
        CONTAINED: ['ROOT_CAUSE_CONFIRMED'],
        ROOT_CAUSE_CONFIRMED: ['DISPOSITIONED'],
        DISPOSITIONED: ['CLOSED'],
        CLOSED: [],
      };
      if (!allowed[current.state].includes(input.state))
        throw new DomainError(
          'conflict',
          `NCR cannot transition from ${current.state} to ${input.state}`,
        );
      await this.insertNcrEvent(
        tx,
        id,
        input.state,
        input.expectedVersion,
        input.reason,
        input.rootCause ?? {},
        input.rootCauseMethod ?? null,
        input.disposition ?? null,
        input.evidence,
        input.idempotencyKey,
        context,
        correlationId,
        input.approvedBy ?? null,
      );
      const result = json({ id, state: input.state, version: input.expectedVersion + 1 });
      await evidence(
        tx,
        `ncr.${input.state.toLowerCase().replaceAll('_', '-')}`,
        'ncr',
        id,
        input.expectedVersion + 1,
        result,
        context,
        correlationId,
      );
      return result;
    });
  }

  public createCapa(
    input: {
      capaNumber: string;
      ncrId: string;
      ownerId: string;
      targetAt: string;
      riskLevel: Severity;
      rootCauseSnapshot: JsonObject;
      complaintExpectedVersion: number;
      evidence: JsonObject;
      idempotencyKey: string;
    },
    context: Context,
    correlationId: string,
  ) {
    return this.db.transaction(async (tx) => {
      await commandLock(tx, context, 'capa-create', input.idempotencyKey);
      const ncr = await this.ncrCurrent(tx, input.ncrId, context);
      if (ncr.state !== 'DISPOSITIONED')
        throw new DomainError('conflict', 'CAPA requires an approved NCR disposition');
      const canonical = { ...input };
      const replay = (
        await tx.query<{ id: string; canonical_hash: string }>(
          'SELECT id,canonical_hash FROM capa_cases WHERE tenant_id=$1 AND idempotency_key=$2',
          [context.actor.companyId, input.idempotencyKey],
        )
      ).rows[0];
      if (replay) {
        assertReplay(replay.canonical_hash, canonical);
        return json({ id: replay.id, state: 'OPEN', replayed: true });
      }
      const row = (
        await tx.query<{ id: string }>(
          `INSERT INTO capa_cases(tenant_id,capa_number,ncr_id,owner_id,target_at,risk_level,root_cause_snapshot,created_by,correlation_id,idempotency_key,canonical_hash) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
          [
            context.actor.companyId,
            input.capaNumber,
            input.ncrId,
            input.ownerId,
            input.targetAt,
            input.riskLevel,
            input.rootCauseSnapshot,
            context.actor.employeeId,
            correlationId,
            input.idempotencyKey,
            digest(canonical),
          ],
        )
      ).rows[0];
      if (!row) throw new Error('CAPA insert failed');
      await this.insertCapaEvent(
        tx,
        row.id,
        'OPEN',
        0,
        '整改措施计划已建立',
        input.evidence,
        `${input.idempotencyKey}:open`,
        context,
        correlationId,
      );
      await this.insertComplaintEvent(
        tx,
        ncr.complaint_id,
        'CAPA_ACTIVE',
        input.complaintExpectedVersion,
        '投诉已进入整改措施阶段',
        { capaId: row.id },
        input.ownerId,
        `${input.idempotencyKey}:complaint`,
        context,
        correlationId,
      );
      const result = json({ id: row.id, ncrId: input.ncrId, state: 'OPEN' });
      await evidence(tx, 'capa.created', 'capa', row.id, 1, result, context, correlationId);
      return result;
    });
  }

  public addCapaAction(
    capaId: string,
    input: {
      actionType: 'CORRECTIVE' | 'PREVENTIVE';
      description: string;
      ownerId: string;
      dueAt: string;
      expectedVersion: number;
      idempotencyKey: string;
    },
    context: Context,
    correlationId: string,
  ) {
    return this.db.transaction(async (tx) => {
      await commandLock(tx, context, `capa:${capaId}:action`, input.idempotencyKey);
      const current = await this.capaCurrent(tx, capaId, context);
      if (!['OPEN', 'ACTIONS_IN_PROGRESS'].includes(current.state))
        throw new DomainError('conflict', 'CAPA state does not allow new actions');
      if (current.sequence !== input.expectedVersion)
        throw new DomainError('conflict', 'CAPA version conflict');
      const canonical = { capaId, ...input };
      const replay = (
        await tx.query<{ id: string; canonical_hash: string }>(
          'SELECT id,canonical_hash FROM capa_actions WHERE tenant_id=$1 AND idempotency_key=$2',
          [context.actor.companyId, input.idempotencyKey],
        )
      ).rows[0];
      if (replay) {
        assertReplay(replay.canonical_hash, canonical);
        return json({ id: replay.id, capaId, replayed: true });
      }
      const row = (
        await tx.query<{ id: string }>(
          `INSERT INTO capa_actions(tenant_id,capa_id,action_type,description,owner_id,due_at,created_by,correlation_id,idempotency_key,canonical_hash) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
          [
            context.actor.companyId,
            capaId,
            input.actionType,
            input.description,
            input.ownerId,
            input.dueAt,
            context.actor.employeeId,
            correlationId,
            input.idempotencyKey,
            digest(canonical),
          ],
        )
      ).rows[0];
      if (!row) throw new Error('CAPA action insert failed');
      if (current.state === 'OPEN')
        await this.insertCapaEvent(
          tx,
          capaId,
          'ACTIONS_IN_PROGRESS',
          input.expectedVersion,
          '整改措施开始执行',
          { actionId: row.id },
          `${input.idempotencyKey}:capa`,
          context,
          correlationId,
        );
      const result = json({ id: row.id, capaId, state: 'OPEN' });
      await evidence(
        tx,
        'capa.action-created',
        'capa-action',
        row.id,
        current.sequence + (current.state === 'OPEN' ? 1 : 0),
        result,
        context,
        correlationId,
      );
      return result;
    });
  }

  public completeCapaAction(
    actionId: string,
    input: {
      completedAt: string;
      evidence: JsonObject;
      expectedCapaVersion: number;
      idempotencyKey: string;
    },
    context: Context,
    correlationId: string,
  ) {
    return this.db.transaction(async (tx) => {
      await commandLock(tx, context, `capa-action:${actionId}`, input.idempotencyKey);
      const action = await this.actionCurrent(tx, actionId, context);
      if (action.owner_id !== context.actor.employeeId)
        throw new DomainError('forbidden', 'Only the CAPA action owner may complete the action');
      if (action.capa_state !== 'ACTIONS_IN_PROGRESS')
        throw new DomainError('conflict', 'CAPA action cannot be completed in the current state');
      if (action.capa_sequence !== input.expectedCapaVersion)
        throw new DomainError('conflict', 'CAPA version conflict');
      const canonical = { actionId, ...input };
      const replay = (
        await tx.query<{ id: string; canonical_hash: string }>(
          'SELECT id,canonical_hash FROM capa_action_completions WHERE tenant_id=$1 AND idempotency_key=$2',
          [context.actor.companyId, input.idempotencyKey],
        )
      ).rows[0];
      if (replay) {
        assertReplay(replay.canonical_hash, canonical);
        return json({ id: replay.id, actionId, replayed: true });
      }
      const row = (
        await tx.query<{ id: string }>(
          `INSERT INTO capa_action_completions(tenant_id,capa_action_id,completed_by,completed_at,evidence,correlation_id,idempotency_key,canonical_hash) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
          [
            context.actor.companyId,
            actionId,
            context.actor.employeeId,
            input.completedAt,
            input.evidence,
            correlationId,
            input.idempotencyKey,
            digest(canonical),
          ],
        )
      ).rows[0];
      if (!row) throw new Error('CAPA action completion insert failed');
      const remaining = (
        await tx.query<{ count: string }>(
          'SELECT count(*)::text count FROM capa_actions a LEFT JOIN capa_action_completions c ON c.tenant_id=a.tenant_id AND c.capa_action_id=a.id WHERE a.tenant_id=$1 AND a.capa_id=$2 AND c.id IS NULL',
          [context.actor.companyId, action.capa_id],
        )
      ).rows[0]?.count;
      if (remaining === '0')
        await this.insertCapaEvent(
          tx,
          action.capa_id,
          'READY_FOR_VERIFICATION',
          input.expectedCapaVersion,
          '全部整改措施已完成，等待独立验证',
          { lastActionId: actionId },
          `${input.idempotencyKey}:ready`,
          context,
          correlationId,
        );
      const result = json({
        id: row.id,
        actionId,
        capaId: action.capa_id,
        readyForVerification: remaining === '0',
      });
      await evidence(
        tx,
        'capa.action-completed',
        'capa-action',
        actionId,
        input.expectedCapaVersion + (remaining === '0' ? 1 : 0),
        result,
        context,
        correlationId,
      );
      return result;
    });
  }

  public verifyCapa(
    capaId: string,
    input: {
      verifiedAt: string;
      standard: string;
      sampleScope: string;
      observationUntil: string;
      result: 'PASSED' | 'FAILED';
      evidence: JsonObject;
      expectedVersion: number;
      complaintExpectedVersion: number;
      idempotencyKey: string;
    },
    context: Context,
    correlationId: string,
  ) {
    return this.db.transaction(async (tx) => {
      await commandLock(tx, context, `capa:${capaId}:verify`, input.idempotencyKey);
      const current = await this.capaCurrent(tx, capaId, context);
      if (current.state !== 'READY_FOR_VERIFICATION')
        throw new DomainError('conflict', 'CAPA is not ready for verification');
      if (current.sequence !== input.expectedVersion)
        throw new DomainError('conflict', 'CAPA version conflict');
      const canonical = { capaId, ...input };
      const replay = (
        await tx.query<{ id: string; canonical_hash: string }>(
          'SELECT id,canonical_hash FROM capa_verifications WHERE tenant_id=$1 AND idempotency_key=$2',
          [context.actor.companyId, input.idempotencyKey],
        )
      ).rows[0];
      if (replay) {
        assertReplay(replay.canonical_hash, canonical);
        return json({ id: replay.id, capaId, replayed: true });
      }
      const complaint = (
        await tx.query<{ complaint_id: string }>(
          `SELECT n.complaint_id FROM capa_cases c JOIN nonconformance_reports n ON n.tenant_id=c.tenant_id AND n.id=c.ncr_id JOIN customer_complaints cc ON cc.tenant_id=n.tenant_id AND cc.id=n.complaint_id JOIN customers cu ON cu.tenant_id=cc.tenant_id AND cu.id=cc.customer_id WHERE c.tenant_id=$1 AND c.id=$2 AND ${scope(context, 'cu', 3).sql}`,
          [context.actor.companyId, capaId, ...scope(context, 'cu', 3).values],
        )
      ).rows[0];
      if (!complaint) throw new DomainError('not_found', 'CAPA not found');
      const row = (
        await tx.query<{ id: string }>(
          `INSERT INTO capa_verifications(tenant_id,capa_id,verifier_id,verified_at,standard,sample_scope,observation_until,result,evidence,correlation_id,idempotency_key,canonical_hash) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
          [
            context.actor.companyId,
            capaId,
            context.actor.employeeId,
            input.verifiedAt,
            input.standard,
            input.sampleScope,
            input.observationUntil,
            input.result,
            input.evidence,
            correlationId,
            input.idempotencyKey,
            digest(canonical),
          ],
        )
      ).rows[0];
      if (!row) throw new Error('CAPA verification insert failed');
      const next: CapaState = input.result === 'PASSED' ? 'VERIFIED' : 'ACTIONS_IN_PROGRESS';
      await this.insertCapaEvent(
        tx,
        capaId,
        next,
        input.expectedVersion,
        input.result === 'PASSED' ? '整改效果验证通过' : '整改效果验证未通过',
        input.evidence,
        `${input.idempotencyKey}:capa`,
        context,
        correlationId,
      );
      if (input.result === 'PASSED')
        await this.insertComplaintEvent(
          tx,
          complaint.complaint_id,
          'VERIFIED',
          input.complaintExpectedVersion,
          '整改措施效果验证通过',
          { capaId, verificationId: row.id },
          current.owner_id,
          `${input.idempotencyKey}:complaint`,
          context,
          correlationId,
        );
      const result = json({ id: row.id, capaId, state: next, result: input.result });
      await evidence(
        tx,
        'capa.verified',
        'capa',
        capaId,
        input.expectedVersion + 1,
        result,
        context,
        correlationId,
      );
      return result;
    });
  }

  public closeCapa(
    id: string,
    input: {
      expectedVersion: number;
      reason: string;
      evidence: JsonObject;
      idempotencyKey: string;
    },
    context: Context,
    correlationId: string,
  ) {
    return this.db.transaction(async (tx) => {
      await commandLock(tx, context, `capa:${id}`, input.idempotencyKey);
      const current = await this.capaCurrent(tx, id, context);
      const payload = {
        capaId: id,
        state: 'CLOSED',
        expectedVersion: input.expectedVersion,
        reason: input.reason,
        evidence: input.evidence,
      };
      const replay = (
        await tx.query<{ canonical_hash: string }>(
          'SELECT canonical_hash FROM capa_events WHERE tenant_id=$1 AND idempotency_key=$2',
          [context.actor.companyId, input.idempotencyKey],
        )
      ).rows[0];
      if (replay) {
        assertReplay(replay.canonical_hash, payload);
        return json({ id, state: 'CLOSED', version: input.expectedVersion + 1 });
      }
      if (current.sequence !== input.expectedVersion)
        throw new DomainError('conflict', 'CAPA version does not match expectedVersion');
      await this.insertCapaEvent(
        tx,
        id,
        'CLOSED',
        input.expectedVersion,
        input.reason,
        input.evidence,
        input.idempotencyKey,
        context,
        correlationId,
      );
      const result = json({ id, state: 'CLOSED', version: input.expectedVersion + 1 });
      await evidence(
        tx,
        'capa.closed',
        'capa',
        id,
        input.expectedVersion + 1,
        result,
        context,
        correlationId,
      );
      return result;
    });
  }

  public async batchTriage(
    input: {
      batchKey: string;
      items: readonly {
        id: string;
        expectedVersion: number;
        assignedTo: string;
        reason: string;
      }[];
    },
    context: Context,
    correlationId: string,
  ): Promise<BatchCommandResult> {
    const canonical = { batchKey: input.batchKey, items: input.items };
    const requestHash = digest(canonical);
    const replay = (
      await this.db.query<{ request_hash: string; result: BatchCommandResult }>(
        'SELECT request_hash,result FROM complaint_batch_commands WHERE tenant_id=$1 AND batch_key=$2',
        [context.actor.companyId, input.batchKey],
      )
    ).rows[0];
    if (replay) {
      if (replay.request_hash !== requestHash)
        throw new DomainError('conflict', 'Batch key was already used with different input');
      return replay.result;
    }
    const results: BatchCommandResult['items'][number][] = [];
    for (const item of input.items) {
      try {
        await this.transitionComplaint(
          item.id,
          {
            state: 'TRIAGED',
            expectedVersion: item.expectedVersion,
            reason: item.reason,
            evidence: { batchKey: input.batchKey },
            assignedTo: item.assignedTo,
            idempotencyKey: `${input.batchKey}:${item.id}:triage`,
          },
          context,
          correlationId,
        );
        results.push({ id: item.id, status: 'SUCCEEDED' });
      } catch (error) {
        if (error instanceof DomainError) {
          results.push({
            id: item.id,
            status: 'REJECTED',
            code: error.code,
            message: error.message,
          });
        } else {
          results.push({
            id: item.id,
            status: 'FAILED',
            code: 'internal_error',
            message: error instanceof Error ? error.message : 'Unknown batch item failure',
          });
        }
      }
    }
    const result: BatchCommandResult = {
      requested: results.length,
      succeeded: results.filter((item) => item.status === 'SUCCEEDED').length,
      rejected: results.filter((item) => item.status === 'REJECTED').length,
      failed: results.filter((item) => item.status === 'FAILED').length,
      items: results,
    };
    const first = input.items[0];
    if (first) {
      const stored = await this.db.transaction(async (tx) => {
        await commandLock(tx, context, 'complaint-batch-triage', input.batchKey);
        const existing = (
          await tx.query<{ request_hash: string; result: BatchCommandResult }>(
            'SELECT request_hash,result FROM complaint_batch_commands WHERE tenant_id=$1 AND batch_key=$2',
            [context.actor.companyId, input.batchKey],
          )
        ).rows[0];
        if (existing) {
          if (existing.request_hash !== requestHash)
            throw new DomainError('conflict', 'Batch key was already used with different input');
          return existing.result;
        }
        await tx.query(
          'INSERT INTO complaint_batch_commands(tenant_id,batch_key,request_hash,result,actor_id,correlation_id) VALUES($1,$2,$3,$4,$5,$6)',
          [
            context.actor.companyId,
            input.batchKey,
            requestHash,
            result,
            context.actor.employeeId,
            correlationId,
          ],
        );
        await evidence(
          tx,
          'complaint.batch-triaged',
          'complaint',
          first.id,
          first.expectedVersion + 1,
          json({
            batchKey: input.batchKey,
            requested: result.requested,
            succeeded: result.succeeded,
            rejected: result.rejected,
            failed: result.failed,
          }),
          context,
          correlationId,
        );
        return result;
      });
      return stored;
    }
    return result;
  }

  private async complaintCurrent(tx: SqlClient, id: string, context: Context) {
    const secured = scope(context, 'cu', 3);
    const row = (
      await tx.query<{ state: ComplaintState; sequence: number; assigned_to: string | null }>(
        `SELECT s.state,s.sequence,s.assigned_to FROM customer_complaints c JOIN customer_complaint_effective_states s ON s.tenant_id=c.tenant_id AND s.complaint_id=c.id JOIN customers cu ON cu.tenant_id=c.tenant_id AND cu.id=c.customer_id WHERE c.tenant_id=$1 AND c.id=$2 AND ${secured.sql}`,
        [context.actor.companyId, id, ...secured.values],
      )
    ).rows[0];
    if (!row) throw new DomainError('not_found', 'Complaint not found');
    return row;
  }
  private async ncrCurrent(tx: SqlClient, id: string, context: Context) {
    const secured = scope(context, 'cu', 3);
    const row = (
      await tx.query<{ state: NcrState; sequence: number; complaint_id: string }>(
        `SELECT s.state,s.sequence,n.complaint_id FROM nonconformance_reports n JOIN ncr_effective_states s ON s.tenant_id=n.tenant_id AND s.ncr_id=n.id JOIN customer_complaints c ON c.tenant_id=n.tenant_id AND c.id=n.complaint_id JOIN customers cu ON cu.tenant_id=c.tenant_id AND cu.id=c.customer_id WHERE n.tenant_id=$1 AND n.id=$2 AND ${secured.sql}`,
        [context.actor.companyId, id, ...secured.values],
      )
    ).rows[0];
    if (!row) throw new DomainError('not_found', 'NCR not found');
    return row;
  }
  private async capaCurrent(tx: SqlClient, id: string, context: Context) {
    const secured = scope(context, 'cu', 3);
    const row = (
      await tx.query<{ state: CapaState; sequence: number; owner_id: string }>(
        `SELECT s.state,s.sequence,cp.owner_id FROM capa_cases cp JOIN capa_effective_states s ON s.tenant_id=cp.tenant_id AND s.capa_id=cp.id JOIN nonconformance_reports n ON n.tenant_id=cp.tenant_id AND n.id=cp.ncr_id JOIN customer_complaints c ON c.tenant_id=n.tenant_id AND c.id=n.complaint_id JOIN customers cu ON cu.tenant_id=c.tenant_id AND cu.id=c.customer_id WHERE cp.tenant_id=$1 AND cp.id=$2 AND ${secured.sql}`,
        [context.actor.companyId, id, ...secured.values],
      )
    ).rows[0];
    if (!row) throw new DomainError('not_found', 'CAPA not found');
    return row;
  }
  private async actionCurrent(tx: SqlClient, id: string, context: Context) {
    const secured = scope(context, 'cu', 3);
    const row = (
      await tx.query<{
        capa_id: string;
        owner_id: string;
        capa_state: CapaState;
        capa_sequence: number;
      }>(
        `SELECT a.capa_id,a.owner_id,s.state capa_state,s.sequence capa_sequence FROM capa_actions a JOIN capa_cases cp ON cp.tenant_id=a.tenant_id AND cp.id=a.capa_id JOIN capa_effective_states s ON s.tenant_id=cp.tenant_id AND s.capa_id=cp.id JOIN nonconformance_reports n ON n.tenant_id=cp.tenant_id AND n.id=cp.ncr_id JOIN customer_complaints c ON c.tenant_id=n.tenant_id AND c.id=n.complaint_id JOIN customers cu ON cu.tenant_id=c.tenant_id AND cu.id=c.customer_id WHERE a.tenant_id=$1 AND a.id=$2 AND ${secured.sql}`,
        [context.actor.companyId, id, ...secured.values],
      )
    ).rows[0];
    if (!row) throw new DomainError('not_found', 'CAPA action not found');
    return row;
  }
  private async eventReplay(
    tx: SqlClient,
    table: 'customer_complaint_events' | 'ncr_events',
    key: string,
    context: Context,
  ) {
    return (
      await tx.query<{ canonical_hash: string; evidence: JsonObject }>(
        `SELECT canonical_hash,evidence FROM ${table} WHERE tenant_id=$1 AND idempotency_key=$2`,
        [context.actor.companyId, key],
      )
    ).rows[0];
  }

  private async insertComplaintEvent(
    tx: SqlClient,
    id: string,
    state: ComplaintState,
    expectedVersion: number,
    reason: string,
    eventEvidence: JsonObject,
    assignedTo: string | null,
    key: string,
    context: Context,
    correlationId: string,
  ) {
    const payload = {
      complaintId: id,
      state,
      expectedVersion,
      reason,
      evidence: eventEvidence,
      assignedTo,
    };
    await tx.query(
      `INSERT INTO customer_complaint_events(tenant_id,complaint_id,sequence,state,reason,evidence,assigned_to,actor_id,expected_version,correlation_id,idempotency_key,canonical_hash) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [
        context.actor.companyId,
        id,
        expectedVersion + 1,
        state,
        reason,
        eventEvidence,
        assignedTo,
        context.actor.employeeId,
        expectedVersion,
        correlationId,
        key,
        digest(payload),
      ],
    );
  }
  private async insertNcrEvent(
    tx: SqlClient,
    id: string,
    state: NcrState,
    expectedVersion: number,
    reason: string,
    rootCause: JsonObject,
    method: 'FIVE_WHY' | 'FISHBONE' | 'FAULT_TREE' | 'OTHER' | null,
    disposition: 'REWORK' | 'REPAIR' | 'CONCESSION' | 'RETURN' | 'SCRAP' | 'SUPPLIER_CLAIM' | null,
    eventEvidence: JsonObject,
    key: string,
    context: Context,
    correlationId: string,
    approvedBy: string | null = null,
  ) {
    const payload = {
      ncrId: id,
      state,
      expectedVersion,
      reason,
      rootCause,
      rootCauseMethod: method,
      disposition,
      evidence: eventEvidence,
      approvedBy,
    };
    await tx.query(
      `INSERT INTO ncr_events(tenant_id,ncr_id,sequence,state,reason,root_cause_method,root_cause,disposition,evidence,actor_id,approved_by,expected_version,correlation_id,idempotency_key,canonical_hash) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
      [
        context.actor.companyId,
        id,
        expectedVersion + 1,
        state,
        reason,
        method,
        rootCause,
        disposition,
        eventEvidence,
        context.actor.employeeId,
        approvedBy,
        expectedVersion,
        correlationId,
        key,
        digest(payload),
      ],
    );
  }
  private async insertCapaEvent(
    tx: SqlClient,
    id: string,
    state: CapaState,
    expectedVersion: number,
    reason: string,
    eventEvidence: JsonObject,
    key: string,
    context: Context,
    correlationId: string,
  ) {
    const payload = { capaId: id, state, expectedVersion, reason, evidence: eventEvidence };
    await tx.query(
      `INSERT INTO capa_events(tenant_id,capa_id,sequence,state,reason,evidence,actor_id,expected_version,correlation_id,idempotency_key,canonical_hash) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [
        context.actor.companyId,
        id,
        expectedVersion + 1,
        state,
        reason,
        eventEvidence,
        context.actor.employeeId,
        expectedVersion,
        correlationId,
        key,
        digest(payload),
      ],
    );
  }
}
