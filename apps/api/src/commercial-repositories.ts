import { createHash } from 'node:crypto';
import {
  DomainError,
  addDecimal,
  assertOpportunityTransition,
  calculateBasisPoints,
  calculateCost,
  canonicalize,
  evaluateCommercialRule,
  multiplyDecimal,
  normalizeDecimal,
  type Actor,
  type ScopeAnchor,
} from '@kingturf/domain';
import type { Database, SqlClient } from '@kingturf/database';
import type {
  CostEngineInput,
  CostRule,
  DataScope,
  JsonObject,
  OpportunityDto,
} from '@kingturf/types';

type Db = SqlClient & Pick<Database, 'transaction'>;
const isoTimestamp = (value: string | Date): string =>
  value instanceof Date ? value.toISOString() : value;
type OpportunityRow = {
  id: string;
  tenant_id: string;
  customer_id: string | null;
  lead_id: string | null;
  name: string;
  status: OpportunityDto['status'];
  owner_id: string;
  owner_organization_id: string;
  value: string;
  currency: string;
  probability_basis_points: number;
  expected_close_date: string;
  version: number;
  created_at: string;
  updated_at: string;
};
const dto = (row: OpportunityRow): OpportunityDto => ({
  id: row.id,
  tenantId: row.tenant_id,
  customerId: row.customer_id,
  leadId: row.lead_id,
  name: row.name,
  status: row.status,
  ownerId: row.owner_id,
  ownerOrganizationId: row.owner_organization_id,
  value: { amount: row.value, currency: row.currency },
  probabilityBasisPoints: row.probability_basis_points,
  expectedCloseDate: row.expected_close_date,
  version: row.version,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});
const scope = (
  scopes: readonly DataScope[],
  anchors: readonly ScopeAnchor[],
  actor: Actor,
  offset: number,
) => {
  const clauses: string[] = [];
  const values: unknown[] = [];
  if (scopes.includes('COMPANY') || scopes.includes('GROUP')) clauses.push('TRUE');
  if (scopes.includes('SELF'))
    clauses.push(`o.owner_id=$${String(offset + values.push(actor.employeeId) - 1)}`);
  for (const anchor of anchors)
    if (anchor.organizationId && scopes.includes(anchor.scope))
      clauses.push(
        `EXISTS(SELECT 1 FROM organization_scope_relationships osr WHERE osr.tenant_id=o.tenant_id AND osr.ancestor_id=$${String(offset + values.push(anchor.organizationId) - 1)} AND osr.descendant_id=o.owner_organization_id AND osr.scope='${anchor.scope}')`,
      );
  return { sql: clauses.length ? `(${clauses.join(' OR ')})` : 'FALSE', values };
};
const evidence = async (
  tx: SqlClient,
  action: string,
  actor: Actor,
  id: string,
  version: number,
  correlationId: string,
  payload: JsonObject,
  aggregateType = 'opportunity',
) => {
  await tx.query(
    "INSERT INTO audit_events(action,outcome,actor_id,organization_id,target_type,target_id,correlation_id,metadata) VALUES($1,'SUCCESS',$2,$3,$4,$5,$6,$7)",
    [action, actor.employeeId, actor.companyId, aggregateType, id, correlationId, payload],
  );
  await tx.query(
    'INSERT INTO domain_event_outbox(tenant_id,event_type,event_version,aggregate_type,aggregate_id,aggregate_version,occurred_at,actor_id,correlation_id,payload) VALUES($1,$2,1,$3,$4,$5,now(),$6,$7,$8)',
    [actor.companyId, action, aggregateType, id, version, actor.employeeId, correlationId, payload],
  );
};

type CommandIdentity = Readonly<{
  type: string;
  subjectId: string;
  actorId: string;
  requestHash: string;
}>;
const commandIdentity = (type: string, subjectId: string, actor: Actor, request: unknown) => ({
  type,
  subjectId,
  actorId: actor.employeeId,
  requestHash: createHash('sha256').update(canonicalize(request)).digest('hex'),
});
const replayCommand = async (
  tx: SqlClient,
  tenantId: string,
  key: string,
  identity: CommandIdentity,
): Promise<JsonObject | null> => {
  await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [`${tenantId}:${key}`]);
  const retained = (
    await tx.query<{
      command_type: string;
      subject_id: string;
      actor_id: string;
      request_hash: string;
      payload: JsonObject;
    }>(
      'SELECT command_type,subject_id,actor_id,request_hash,payload FROM commercial_command_results WHERE tenant_id=$1 AND idempotency_key=$2',
      [tenantId, key],
    )
  ).rows[0];
  if (!retained) return null;
  if (
    retained.command_type !== identity.type ||
    retained.subject_id !== identity.subjectId ||
    retained.actor_id !== identity.actorId ||
    retained.request_hash !== identity.requestHash
  )
    throw new DomainError('conflict', 'Idempotency key is bound to another command');
  return retained.payload;
};
const retainCommand = (
  tx: SqlClient,
  tenantId: string,
  key: string,
  identity: CommandIdentity,
  payload: JsonObject,
) =>
  tx.query(
    'INSERT INTO commercial_command_results(tenant_id,idempotency_key,command_type,subject_id,actor_id,request_hash,payload) VALUES($1,$2,$3,$4,$5,$6,$7)',
    [
      tenantId,
      key,
      identity.type,
      identity.subjectId,
      identity.actorId,
      identity.requestHash,
      payload,
    ],
  );

export class PostgresCommercialRepository {
  public constructor(private readonly db: Db) {}
  public async listOpportunities(
    actor: Actor,
    scopes: readonly DataScope[],
    anchors: readonly ScopeAnchor[],
  ) {
    const secured = scope(scopes, anchors, actor, 2);
    return (
      await this.db.query<OpportunityRow>(
        `SELECT o.* FROM opportunities o WHERE o.tenant_id=$1 AND o.deleted_at IS NULL AND ${secured.sql} ORDER BY o.updated_at DESC,o.id LIMIT 100`,
        [actor.companyId, ...secured.values],
      )
    ).rows.map(dto);
  }
  public async findOpportunity(
    id: string,
    actor: Actor,
    scopes: readonly DataScope[],
    anchors: readonly ScopeAnchor[],
  ) {
    const secured = scope(scopes, anchors, actor, 3);
    const row = (
      await this.db.query<OpportunityRow>(
        `SELECT o.* FROM opportunities o WHERE o.id=$1 AND o.tenant_id=$2 AND o.deleted_at IS NULL AND ${secured.sql}`,
        [id, actor.companyId, ...secured.values],
      )
    ).rows[0];
    return row ? dto(row) : null;
  }
  public async listCommercialView(
    view: 'ctrs' | 'solutions' | 'costs' | 'policies' | 'quotes',
    actor: Actor,
    scopes: readonly DataScope[],
    anchors: readonly ScopeAnchor[],
  ): Promise<readonly JsonObject[]> {
    const secured = scope(scopes, anchors, actor, 2);
    const definitions = {
      ctrs: `SELECT v.id,c.opportunity_id AS "opportunityId",c.code,v.version,v.status,v.title,v.requirements,v.snapshot_hash AS "snapshotHash",v.submitted_at AS "submittedAt",v.created_at AS "createdAt",
        (SELECT coalesce(jsonb_agg(to_jsonb(a) ORDER BY a.decided_at),'[]'::jsonb) FROM ctr_approvals a WHERE a.tenant_id=v.tenant_id AND a.ctr_version_id=v.id) approvals,
        (SELECT coalesce(jsonb_agg(to_jsonb(l) ORDER BY l.linked_at),'[]'::jsonb) FROM ctr_attachment_links l WHERE l.tenant_id=v.tenant_id AND l.ctr_version_id=v.id) attachments
        FROM ctr_versions v JOIN ctrs c ON c.id=v.ctr_id AND c.tenant_id=v.tenant_id JOIN opportunities o ON o.id=c.opportunity_id AND o.tenant_id=c.tenant_id`,
      solutions:
        'SELECT r.id,s.opportunity_id AS "opportunityId",s.code,r.revision,r.status,r.ctr_version_id AS "ctrVersionId",r.specification,r.assumptions,r.created_at AS "createdAt" FROM technical_solution_revisions r JOIN technical_solutions s ON s.id=r.technical_solution_id AND s.tenant_id=r.tenant_id JOIN opportunities o ON o.id=s.opportunity_id AND o.tenant_id=s.tenant_id',
      costs: `SELECT d.id,s.opportunity_id AS "opportunityId",d.technical_solution_revision_id AS "technicalSolutionRevisionId",d.cost_model_version_id AS "modelVersionId",d.input_hash AS "inputHash",d.canonical_input AS "canonicalInput",d.currency,d.subtotal,d.total,d.trace,d.evaluated_at AS "evaluatedAt",
        (SELECT coalesce(jsonb_agg(to_jsonb(l) ORDER BY l.line_number),'[]'::jsonb) FROM cost_sheet_lines l WHERE l.tenant_id=d.tenant_id AND l.decision_id=d.id) lines
        FROM cost_sheet_decisions d JOIN technical_solution_revisions r ON r.id=d.technical_solution_revision_id AND r.tenant_id=d.tenant_id JOIN technical_solutions s ON s.id=r.technical_solution_id AND s.tenant_id=r.tenant_id JOIN opportunities o ON o.id=s.opportunity_id AND o.tenant_id=s.tenant_id`,
      policies:
        'SELECT e.id,s.opportunity_id AS "opportunityId",e.sales_policy_version_id AS "policyVersionId",e.cost_decision_id AS "costDecisionId",e.input_hash AS "inputHash",e.canonical_input AS "canonicalInput",e.passed,e.approval_required AS "approvalRequired",e.minimum_margin_basis_points AS "minimumMarginBasisPoints",e.maximum_discount_basis_points AS "maximumDiscountBasisPoints",e.reasons,e.trace,e.evaluated_at AS "evaluatedAt" FROM sales_policy_evaluations e JOIN cost_sheet_decisions d ON d.id=e.cost_decision_id AND d.tenant_id=e.tenant_id JOIN technical_solution_revisions r ON r.id=d.technical_solution_revision_id AND r.tenant_id=d.tenant_id JOIN technical_solutions s ON s.id=r.technical_solution_id AND s.tenant_id=r.tenant_id JOIN opportunities o ON o.id=s.opportunity_id AND o.tenant_id=s.tenant_id',
      quotes: `SELECT r.id,q.opportunity_id AS "opportunityId",q.quote_number AS "quoteNumber",r.revision,r.status,r.opportunity_version AS "opportunityVersion",r.opportunity_snapshot_id AS "opportunitySnapshotId",r.ctr_version_id AS "ctrVersionId",r.technical_solution_revision_id AS "technicalSolutionRevisionId",r.cost_decision_id AS "costDecisionId",r.sales_policy_version_id AS "policyVersionId",r.sales_policy_evaluation_id AS "policyEvaluationId",r.currency,r.subtotal,r.discount,r.total,r.cost_total AS "costTotal",r.margin,r.margin_basis_points AS "marginBasisPoints",r.valid_until AS "validUntil",r.issued_at AS "issuedAt",
        (SELECT coalesce(jsonb_agg(to_jsonb(l) ORDER BY l.line_number),'[]'::jsonb) FROM quote_lines l WHERE l.tenant_id=r.tenant_id AND l.quote_revision_id=r.id) lines,
        (SELECT coalesce(jsonb_agg(to_jsonb(a) ORDER BY a.decided_at),'[]'::jsonb) FROM quote_approvals a WHERE a.tenant_id=r.tenant_id AND a.quote_revision_id=r.id) approvals,
        (SELECT s.snapshot_hash FROM quote_issued_snapshots s WHERE s.tenant_id=r.tenant_id AND s.quote_revision_id=r.id) AS "issuedSnapshotHash"
        FROM quote_revisions r JOIN quotes q ON q.id=r.quote_id AND q.tenant_id=r.tenant_id JOIN opportunities o ON o.id=q.opportunity_id AND o.tenant_id=q.tenant_id`,
    } as const;
    return (
      await this.db.query<JsonObject>(
        `${definitions[view]} WHERE o.tenant_id=$1 AND o.deleted_at IS NULL AND ${secured.sql} ORDER BY 1 DESC LIMIT 100`,
        [actor.companyId, ...secured.values],
      )
    ).rows;
  }
  public async createOpportunity(
    input: {
      customerId: string | null;
      leadId: string | null;
      name: string;
      value: string;
      currency: string;
      probabilityBasisPoints: number;
      expectedCloseDate: string;
    },
    actor: Actor,
    correlationId: string,
  ) {
    return this.db.transaction(async (tx) => {
      const organization = (
        await tx.query<{ organization_id: string }>(
          'SELECT organization_id FROM employees WHERE id=$1 AND company_id=$2 AND active',
          [actor.employeeId, actor.companyId],
        )
      ).rows[0];
      if (!organization) throw new DomainError('forbidden', 'Active employee required');
      const row = (
        await tx.query<OpportunityRow>(
          'INSERT INTO opportunities(tenant_id,customer_id,lead_id,name,owner_id,owner_organization_id,value,currency,probability_basis_points,expected_close_date,created_by,updated_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$5,$5) RETURNING *',
          [
            actor.companyId,
            input.customerId,
            input.leadId,
            input.name,
            actor.employeeId,
            organization.organization_id,
            input.value,
            input.currency,
            input.probabilityBasisPoints,
            input.expectedCloseDate,
          ],
        )
      ).rows[0];
      if (!row) throw new DomainError('conflict', 'Opportunity could not be created');
      await evidence(tx, 'opportunity.created', actor, row.id, row.version, correlationId, {
        status: row.status,
      });
      return dto(row);
    });
  }
  public async updateOpportunity(
    id: string,
    patch: {
      name?: string;
      value?: string;
      currency?: string;
      probabilityBasisPoints?: number;
      expectedCloseDate?: string;
    },
    expectedVersion: number,
    actor: Actor,
    scopes: readonly DataScope[],
    anchors: readonly ScopeAnchor[],
    correlationId: string,
  ) {
    return this.db.transaction(async (tx) => {
      const secured = scope(scopes, anchors, actor, 3);
      const current = (
        await tx.query<OpportunityRow>(
          `SELECT o.* FROM opportunities o WHERE o.id=$1 AND o.tenant_id=$2 AND o.deleted_at IS NULL AND ${secured.sql} FOR UPDATE`,
          [id, actor.companyId, ...secured.values],
        )
      ).rows[0];
      if (!current) throw new DomainError('not_found', 'Opportunity not found');
      if (current.version !== expectedVersion)
        throw new DomainError('conflict', 'Opportunity version conflict');
      const row = (
        await tx.query<OpportunityRow>(
          'UPDATE opportunities SET name=COALESCE($3,name),value=COALESCE($4,value),currency=COALESCE($5,currency),probability_basis_points=COALESCE($6,probability_basis_points),expected_close_date=COALESCE($7,expected_close_date),version=version+1,updated_at=now(),updated_by=$8 WHERE id=$1 AND tenant_id=$2 RETURNING *',
          [
            id,
            actor.companyId,
            patch.name ?? null,
            patch.value ?? null,
            patch.currency ?? null,
            patch.probabilityBasisPoints ?? null,
            patch.expectedCloseDate ?? null,
            actor.employeeId,
          ],
        )
      ).rows[0];
      if (!row) throw new DomainError('conflict', 'Opportunity update failed');
      await evidence(tx, 'opportunity.updated', actor, id, row.version, correlationId, {
        version: row.version,
      });
      return dto(row);
    });
  }
  public async transitionOpportunity(
    id: string,
    status: OpportunityDto['status'],
    reason: string,
    expectedVersion: number,
    actor: Actor,
    scopes: readonly DataScope[],
    anchors: readonly ScopeAnchor[],
    correlationId: string,
  ) {
    return this.db.transaction(async (tx) => {
      const secured = scope(scopes, anchors, actor, 3);
      const current = (
        await tx.query<OpportunityRow>(
          `SELECT o.* FROM opportunities o WHERE o.id=$1 AND o.tenant_id=$2 AND o.deleted_at IS NULL AND ${secured.sql} FOR UPDATE`,
          [id, actor.companyId, ...secured.values],
        )
      ).rows[0];
      if (!current) throw new DomainError('not_found', 'Opportunity not found');
      if (current.version !== expectedVersion)
        throw new DomainError('conflict', 'Opportunity version conflict');
      assertOpportunityTransition(current.status, status);
      await tx.query(
        'INSERT INTO opportunity_lifecycle_history(tenant_id,opportunity_id,from_status,to_status,actor_id,reason) VALUES($1,$2,$3,$4,$5,$6)',
        [actor.companyId, id, current.status, status, actor.employeeId, reason],
      );
      const row = (
        await tx.query<OpportunityRow>(
          'UPDATE opportunities SET status=$3,version=version+1,updated_at=now(),updated_by=$4 WHERE id=$1 AND tenant_id=$2 RETURNING *',
          [id, actor.companyId, status, actor.employeeId],
        )
      ).rows[0];
      if (!row) throw new DomainError('conflict', 'Opportunity transition failed');
      await evidence(tx, 'opportunity.transitioned', actor, id, row.version, correlationId, {
        from: current.status,
        to: status,
        reason,
      });
      return dto(row);
    });
  }
  public async submitCtr(
    versionId: string,
    expectedVersion: number,
    idempotencyKey: string,
    actor: Actor,
    scopes: readonly DataScope[],
    anchors: readonly ScopeAnchor[],
    correlationId: string,
  ) {
    return this.db.transaction(async (tx) => {
      const identity = commandIdentity('CTR_SUBMIT', versionId, actor, { expectedVersion });
      const row = (
        await tx.query<{
          id: string;
          ctr_id: string;
          version: number;
          status: string;
          requirements: JsonObject;
          title: string;
          opportunity_id: string;
        }>(
          'SELECT v.*,c.opportunity_id FROM ctr_versions v JOIN ctrs c ON c.id=v.ctr_id AND c.tenant_id=v.tenant_id WHERE v.id=$1 AND v.tenant_id=$2 FOR UPDATE',
          [versionId, actor.companyId],
        )
      ).rows[0];
      if (!row) throw new DomainError('not_found', 'CTR version not found');
      await this.requireOpportunityScope(tx, row.opportunity_id, actor, scopes, anchors);
      const retained = await replayCommand(tx, actor.companyId, idempotencyKey, identity);
      if (retained) return retained;
      if (row.version !== expectedVersion || row.status !== 'DRAFT')
        throw new DomainError('conflict', 'CTR version cannot be submitted');
      const attachments = (
        await tx.query<{ attachment_id: string }>(
          'SELECT attachment_id FROM ctr_attachment_links WHERE tenant_id=$1 AND ctr_version_id=$2 ORDER BY attachment_id',
          [actor.companyId, versionId],
        )
      ).rows.map((item) => item.attachment_id);
      const hash = createHash('sha256')
        .update(canonicalize({ title: row.title, requirements: row.requirements, attachments }))
        .digest('hex');
      const payload = {
        id: row.id,
        ctrId: row.ctr_id,
        version: row.version,
        status: 'SUBMITTED',
        snapshotHash: hash,
      };
      await tx.query(
        "UPDATE ctr_versions SET status='SUBMITTED',snapshot_hash=$3,submitted_at=now() WHERE id=$1 AND tenant_id=$2",
        [versionId, actor.companyId, hash],
      );
      await retainCommand(tx, actor.companyId, idempotencyKey, identity, payload);
      await evidence(
        tx,
        'ctr.submitted',
        actor,
        row.ctr_id,
        row.version,
        correlationId,
        payload,
        'ctr',
      );
      return payload;
    });
  }

  private async requireOpportunityScope(
    tx: SqlClient,
    opportunityId: string,
    actor: Actor,
    scopes: readonly DataScope[],
    anchors: readonly ScopeAnchor[],
  ): Promise<OpportunityRow> {
    const secured = scope(scopes, anchors, actor, 3);
    const row = (
      await tx.query<OpportunityRow>(
        `SELECT o.* FROM opportunities o WHERE o.id=$1 AND o.tenant_id=$2 AND o.deleted_at IS NULL AND ${secured.sql} FOR UPDATE`,
        [opportunityId, actor.companyId, ...secured.values],
      )
    ).rows[0];
    if (!row) throw new DomainError('not_found', 'Commercial subject not found');
    return row;
  }

  public async createCtr(
    input: { opportunityId: string; code: string; title: string; requirements: JsonObject },
    actor: Actor,
    scopes: readonly DataScope[],
    anchors: readonly ScopeAnchor[],
    correlationId: string,
  ) {
    return this.db.transaction(async (tx) => {
      await this.requireOpportunityScope(tx, input.opportunityId, actor, scopes, anchors);
      const root = (
        await tx.query<{ id: string }>(
          'INSERT INTO ctrs(tenant_id,opportunity_id,code,created_by) VALUES($1,$2,$3,$4) RETURNING id',
          [actor.companyId, input.opportunityId, input.code, actor.employeeId],
        )
      ).rows[0];
      if (!root) throw new DomainError('conflict', 'CTR could not be created');
      const result = (
        await tx.query<JsonObject>(
          'INSERT INTO ctr_versions(tenant_id,ctr_id,version,title,requirements,created_by) VALUES($1,$2,1,$3,$4,$5) RETURNING id,ctr_id AS "ctrId",version,status,title,requirements,submitted_at AS "submittedAt",snapshot_hash AS "snapshotHash",created_at AS "createdAt"',
          [actor.companyId, root.id, input.title, input.requirements, actor.employeeId],
        )
      ).rows[0];
      if (!result) throw new DomainError('conflict', 'CTR version could not be created');
      await evidence(tx, 'ctr.created', actor, root.id, 1, correlationId, result, 'ctr');
      return result;
    });
  }

  public async listCtrs(
    opportunityId: string,
    actor: Actor,
    scopes: readonly DataScope[],
    anchors: readonly ScopeAnchor[],
  ) {
    return this.db.transaction(async (tx) => {
      await this.requireOpportunityScope(tx, opportunityId, actor, scopes, anchors);
      return (
        await tx.query<JsonObject>(
          `SELECT v.id,v.ctr_id AS "ctrId",v.version,v.status,v.title,v.requirements,v.submitted_at AS "submittedAt",v.snapshot_hash AS "snapshotHash",v.created_at AS "createdAt",
           (SELECT coalesce(jsonb_agg(to_jsonb(a) ORDER BY a.decided_at),'[]'::jsonb) FROM ctr_approvals a WHERE a.tenant_id=v.tenant_id AND a.ctr_version_id=v.id) approvals,
           (SELECT coalesce(jsonb_agg(to_jsonb(l) ORDER BY l.linked_at),'[]'::jsonb) FROM ctr_attachment_links l WHERE l.tenant_id=v.tenant_id AND l.ctr_version_id=v.id) attachments
           FROM ctr_versions v JOIN ctrs c ON c.id=v.ctr_id AND c.tenant_id=v.tenant_id WHERE v.tenant_id=$1 AND c.opportunity_id=$2 ORDER BY v.version DESC`,
          [actor.companyId, opportunityId],
        )
      ).rows;
    });
  }

  public async createCtrVersion(
    ctrId: string,
    input: { title: string; requirements: JsonObject },
    actor: Actor,
    scopes: readonly DataScope[],
    anchors: readonly ScopeAnchor[],
    correlationId: string,
  ) {
    return this.db.transaction(async (tx) => {
      const root = (
        await tx.query<{ opportunity_id: string }>(
          'SELECT opportunity_id FROM ctrs WHERE id=$1 AND tenant_id=$2 FOR UPDATE',
          [ctrId, actor.companyId],
        )
      ).rows[0];
      if (!root) throw new DomainError('not_found', 'CTR not found');
      await this.requireOpportunityScope(tx, root.opportunity_id, actor, scopes, anchors);
      const result = (
        await tx.query<JsonObject>(
          'INSERT INTO ctr_versions(tenant_id,ctr_id,version,title,requirements,created_by) SELECT $1,$2,coalesce(max(version),0)+1,$3,$4,$5 FROM ctr_versions WHERE tenant_id=$1 AND ctr_id=$2 RETURNING id,ctr_id AS "ctrId",version,status,title,requirements,submitted_at AS "submittedAt",snapshot_hash AS "snapshotHash",created_at AS "createdAt"',
          [actor.companyId, ctrId, input.title, input.requirements, actor.employeeId],
        )
      ).rows[0];
      if (!result) throw new DomainError('conflict', 'CTR version could not be created');
      await evidence(
        tx,
        'ctr.version-created',
        actor,
        ctrId,
        Number(result.version),
        correlationId,
        result,
        'ctr',
      );
      return result;
    });
  }

  public async linkCtrAttachment(
    versionId: string,
    attachmentId: string,
    actor: Actor,
    scopes: readonly DataScope[],
    anchors: readonly ScopeAnchor[],
    correlationId: string,
  ) {
    return this.db.transaction(async (tx) => {
      const subject = (
        await tx.query<{ ctr_id: string; opportunity_id: string; version: number; status: string }>(
          'SELECT v.ctr_id,c.opportunity_id,v.version,v.status FROM ctr_versions v JOIN ctrs c ON c.id=v.ctr_id AND c.tenant_id=v.tenant_id WHERE v.id=$1 AND v.tenant_id=$2 FOR UPDATE OF v',
          [versionId, actor.companyId],
        )
      ).rows[0];
      if (!subject) throw new DomainError('not_found', 'CTR version not found');
      await this.requireOpportunityScope(tx, subject.opportunity_id, actor, scopes, anchors);
      if (subject.status !== 'DRAFT')
        throw new DomainError('conflict', 'Submitted CTR attachment set is immutable');
      const result = (
        await tx.query<JsonObject>(
          'INSERT INTO ctr_attachment_links(tenant_id,ctr_version_id,attachment_id,linked_by) VALUES($1,$2,$3,$4) RETURNING id,ctr_version_id AS "ctrVersionId",attachment_id AS "attachmentId",linked_by AS "linkedBy",linked_at AS "linkedAt"',
          [actor.companyId, versionId, attachmentId, actor.employeeId],
        )
      ).rows[0];
      if (!result) throw new DomainError('conflict', 'CTR attachment could not be linked');
      await evidence(
        tx,
        'ctr.attachment-linked',
        actor,
        subject.ctr_id,
        subject.version,
        correlationId,
        result,
        'ctr',
      );
      return result;
    });
  }

  public async approveCtr(
    versionId: string,
    decision: 'APPROVED' | 'REJECTED',
    reason: string,
    idempotencyKey: string,
    actor: Actor,
    scopes: readonly DataScope[],
    anchors: readonly ScopeAnchor[],
    correlationId: string,
  ) {
    return this.db.transaction(async (tx) => {
      const identity = commandIdentity('CTR_APPROVE', versionId, actor, { decision, reason });
      const row = (
        await tx.query<{ ctr_id: string; opportunity_id: string; version: number }>(
          "SELECT v.ctr_id,c.opportunity_id,v.version FROM ctr_versions v JOIN ctrs c ON c.id=v.ctr_id AND c.tenant_id=v.tenant_id WHERE v.id=$1 AND v.tenant_id=$2 AND v.status='SUBMITTED' FOR UPDATE",
          [versionId, actor.companyId],
        )
      ).rows[0];
      if (!row) throw new DomainError('not_found', 'CTR version not found');
      await this.requireOpportunityScope(tx, row.opportunity_id, actor, scopes, anchors);
      const retained = await replayCommand(tx, actor.companyId, idempotencyKey, identity);
      if (retained) return retained;
      await tx.query(
        'INSERT INTO ctr_approvals(tenant_id,ctr_version_id,decision,approver_id,reason,idempotency_key) VALUES($1,$2,$3,$4,$5,$6)',
        [actor.companyId, versionId, decision, actor.employeeId, reason, idempotencyKey],
      );
      await tx.query('UPDATE ctr_versions SET status=$3 WHERE id=$1 AND tenant_id=$2', [
        versionId,
        actor.companyId,
        decision,
      ]);
      const result = { id: versionId, ctrId: row.ctr_id, version: row.version, status: decision };
      await retainCommand(tx, actor.companyId, idempotencyKey, identity, result);
      await evidence(
        tx,
        'ctr.decided',
        actor,
        row.ctr_id,
        row.version,
        correlationId,
        result,
        'ctr',
      );
      return result;
    });
  }

  public async createTechnicalSolution(
    input: {
      opportunityId: string;
      code: string;
      ctrVersionId: string;
      specification: JsonObject;
      assumptions: readonly string[];
      final: boolean;
    },
    actor: Actor,
    scopes: readonly DataScope[],
    anchors: readonly ScopeAnchor[],
    correlationId: string,
  ) {
    return this.db.transaction(async (tx) => {
      await this.requireOpportunityScope(tx, input.opportunityId, actor, scopes, anchors);
      const root = (
        await tx.query<{ id: string }>(
          'INSERT INTO technical_solutions(tenant_id,opportunity_id,code,created_by) VALUES($1,$2,$3,$4) RETURNING id',
          [actor.companyId, input.opportunityId, input.code, actor.employeeId],
        )
      ).rows[0];
      if (!root) throw new DomainError('conflict', 'Solution could not be created');
      const result = (
        await tx.query<JsonObject>(
          'INSERT INTO technical_solution_revisions(tenant_id,technical_solution_id,revision,status,ctr_version_id,specification,assumptions,created_by) VALUES($1,$2,1,$3,$4,$5,$6,$7) RETURNING id,technical_solution_id AS "technicalSolutionId",revision,status,ctr_version_id AS "ctrVersionId",specification,assumptions,created_at AS "createdAt"',
          [
            actor.companyId,
            root.id,
            input.final ? 'FINAL' : 'DRAFT',
            input.ctrVersionId,
            input.specification,
            JSON.stringify(input.assumptions),
            actor.employeeId,
          ],
        )
      ).rows[0];
      if (!result) throw new DomainError('conflict', 'Solution revision could not be created');
      await evidence(
        tx,
        'technical-solution.created',
        actor,
        root.id,
        1,
        correlationId,
        result,
        'technical-solution',
      );
      return result;
    });
  }

  public async createTechnicalSolutionRevision(
    technicalSolutionId: string,
    input: {
      ctrVersionId: string;
      specification: JsonObject;
      assumptions: readonly string[];
      final: boolean;
    },
    actor: Actor,
    scopes: readonly DataScope[],
    anchors: readonly ScopeAnchor[],
    correlationId: string,
  ) {
    return this.db.transaction(async (tx) => {
      const root = (
        await tx.query<{ opportunity_id: string }>(
          'SELECT opportunity_id FROM technical_solutions WHERE id=$1 AND tenant_id=$2 AND deleted_at IS NULL FOR UPDATE',
          [technicalSolutionId, actor.companyId],
        )
      ).rows[0];
      if (!root) throw new DomainError('not_found', 'Technical solution not found');
      await this.requireOpportunityScope(tx, root.opportunity_id, actor, scopes, anchors);
      const result = (
        await tx.query<JsonObject>(
          'INSERT INTO technical_solution_revisions(tenant_id,technical_solution_id,revision,status,ctr_version_id,specification,assumptions,created_by) SELECT $1,$2,coalesce(max(revision),0)+1,$3,$4,$5,$6,$7 FROM technical_solution_revisions WHERE tenant_id=$1 AND technical_solution_id=$2 RETURNING id,technical_solution_id AS "technicalSolutionId",revision,status,ctr_version_id AS "ctrVersionId",specification,assumptions,created_at AS "createdAt"',
          [
            actor.companyId,
            technicalSolutionId,
            input.final ? 'FINAL' : 'DRAFT',
            input.ctrVersionId,
            input.specification,
            JSON.stringify(input.assumptions),
            actor.employeeId,
          ],
        )
      ).rows[0];
      if (!result) throw new DomainError('conflict', 'Solution revision could not be created');
      await evidence(
        tx,
        'technical-solution.revision-created',
        actor,
        technicalSolutionId,
        Number(result.revision),
        correlationId,
        result,
        'technical-solution',
      );
      return result;
    });
  }

  public async createDefinition(
    kind: 'cost' | 'policy',
    input: {
      code: string;
      name: string;
      currency?: string;
      rules: readonly unknown[];
      publish: boolean;
    },
    actor: Actor,
    scopes: readonly DataScope[],
    correlationId: string,
  ) {
    return this.db.transaction(async (tx) => {
      if (!scopes.includes('COMPANY'))
        throw new DomainError('forbidden', 'Commercial definitions require company scope');
      const employee = (
        await tx.query<{ active: boolean }>(
          'SELECT active FROM employees WHERE id=$1 AND company_id=$2 FOR UPDATE',
          [actor.employeeId, actor.companyId],
        )
      ).rows[0];
      if (!employee?.active) throw new DomainError('forbidden', 'Active employee required');
      const rootTable = kind === 'cost' ? 'cost_models' : 'sales_policies',
        versionTable = kind === 'cost' ? 'cost_model_versions' : 'sales_policy_versions',
        fk = kind === 'cost' ? 'cost_model_id' : 'sales_policy_id';
      const root = (
        await tx.query<{ id: string }>(
          `INSERT INTO ${rootTable}(tenant_id,code,name,created_by) VALUES($1,$2,$3,$4) RETURNING id`,
          [actor.companyId, input.code, input.name, actor.employeeId],
        )
      ).rows[0];
      if (!root) throw new DomainError('conflict', 'Definition could not be created');
      const status = input.publish ? 'PUBLISHED' : 'DRAFT';
      const columns =
        kind === 'cost'
          ? `tenant_id,${fk},version,status,currency,rules,published_at,created_by`
          : `tenant_id,${fk},version,status,rules,published_at,created_by`;
      const params =
        kind === 'cost'
          ? [
              actor.companyId,
              root.id,
              status,
              input.currency,
              JSON.stringify(input.rules),
              actor.employeeId,
            ]
          : [actor.companyId, root.id, status, JSON.stringify(input.rules), actor.employeeId];
      const values =
        kind === 'cost'
          ? "$1,$2,1,$3::definition_status,$4,$5,CASE WHEN $3::text='PUBLISHED' THEN now() END,$6"
          : "$1,$2,1,$3::definition_status,$4,CASE WHEN $3::text='PUBLISHED' THEN now() END,$5";
      const result = (
        await tx.query<JsonObject>(
          `INSERT INTO ${versionTable}(${columns}) VALUES(${values}) RETURNING id,version,status,rules,published_at AS "publishedAt"`,
          params,
        )
      ).rows[0];
      if (!result) throw new DomainError('conflict', 'Version could not be created');
      await evidence(
        tx,
        `${kind}.definition.created`,
        actor,
        root.id,
        1,
        correlationId,
        result,
        kind === 'cost' ? 'cost-model' : 'sales-policy',
      );
      return result;
    });
  }

  public async createDefinitionVersion(
    kind: 'cost' | 'policy',
    definitionId: string,
    input: { currency?: string; rules: readonly unknown[]; publish: boolean },
    actor: Actor,
    scopes: readonly DataScope[],
    correlationId: string,
  ) {
    return this.db.transaction(async (tx) => {
      if (!scopes.includes('COMPANY'))
        throw new DomainError('forbidden', 'Commercial definitions require company scope');
      const rootTable = kind === 'cost' ? 'cost_models' : 'sales_policies',
        versionTable = kind === 'cost' ? 'cost_model_versions' : 'sales_policy_versions',
        fk = kind === 'cost' ? 'cost_model_id' : 'sales_policy_id';
      const root = (
        await tx.query<{ id: string }>(
          `SELECT id FROM ${rootTable} WHERE id=$1 AND tenant_id=$2 AND deleted_at IS NULL FOR UPDATE`,
          [definitionId, actor.companyId],
        )
      ).rows[0];
      if (!root) throw new DomainError('not_found', 'Definition not found');
      const employee = (
        await tx.query<{ active: boolean }>(
          'SELECT active FROM employees WHERE id=$1 AND company_id=$2',
          [actor.employeeId, actor.companyId],
        )
      ).rows[0];
      if (!employee?.active) throw new DomainError('forbidden', 'Active employee required');
      const status = input.publish ? 'PUBLISHED' : 'DRAFT';
      const sql =
        kind === 'cost'
          ? `INSERT INTO ${versionTable}(tenant_id,${fk},version,status,currency,rules,published_at,created_by) SELECT $1,$2,coalesce(max(version),0)+1,$3::definition_status,$4,$5,CASE WHEN $3::text='PUBLISHED' THEN now() END,$6 FROM ${versionTable} WHERE tenant_id=$1 AND ${fk}=$2 RETURNING id,version,status,currency,rules,published_at AS "publishedAt"`
          : `INSERT INTO ${versionTable}(tenant_id,${fk},version,status,rules,published_at,created_by) SELECT $1,$2,coalesce(max(version),0)+1,$3::definition_status,$4,CASE WHEN $3::text='PUBLISHED' THEN now() END,$5 FROM ${versionTable} WHERE tenant_id=$1 AND ${fk}=$2 RETURNING id,version,status,rules,published_at AS "publishedAt"`;
      const params =
        kind === 'cost'
          ? [
              actor.companyId,
              definitionId,
              status,
              input.currency,
              JSON.stringify(input.rules),
              actor.employeeId,
            ]
          : [actor.companyId, definitionId, status, JSON.stringify(input.rules), actor.employeeId];
      const result = (await tx.query<JsonObject>(sql, params)).rows[0];
      if (!result) throw new DomainError('conflict', 'Definition version could not be created');
      await evidence(
        tx,
        `${kind}.definition.version-created`,
        actor,
        definitionId,
        Number(result.version),
        correlationId,
        result,
        kind === 'cost' ? 'cost-model' : 'sales-policy',
      );
      return result;
    });
  }

  public async evaluateCost(
    input: CostEngineInput & { technicalSolutionRevisionId: string; idempotencyKey: string },
    actor: Actor,
    scopes: readonly DataScope[],
    anchors: readonly ScopeAnchor[],
    correlationId: string,
  ) {
    return this.db.transaction(async (tx) => {
      const identity = commandIdentity('COST_EVALUATE', input.technicalSolutionRevisionId, actor, {
        modelVersionId: input.modelVersionId,
        technicalSolutionRevisionId: input.technicalSolutionRevisionId,
        currency: input.currency,
        lines: input.lines,
        context: input.context,
      });
      const solution = (
        await tx.query<{ opportunity_id: string }>(
          "SELECT s.opportunity_id FROM technical_solution_revisions r JOIN technical_solutions s ON s.id=r.technical_solution_id AND s.tenant_id=r.tenant_id WHERE r.id=$1 AND r.tenant_id=$2 AND r.status='FINAL' FOR UPDATE OF r",
          [input.technicalSolutionRevisionId, actor.companyId],
        )
      ).rows[0];
      if (!solution) throw new DomainError('not_found', 'Final technical solution not found');
      await this.requireOpportunityScope(tx, solution.opportunity_id, actor, scopes, anchors);
      const retained = await replayCommand(tx, actor.companyId, input.idempotencyKey, identity);
      if (retained) return retained;
      const model = (
        await tx.query<{ rules: CostRule[]; currency: string }>(
          "SELECT rules,currency FROM cost_model_versions WHERE id=$1 AND tenant_id=$2 AND status='PUBLISHED'",
          [input.modelVersionId, actor.companyId],
        )
      ).rows[0];
      if (!model) throw new DomainError('not_found', 'Published cost model not found');
      if (model.currency !== input.currency)
        throw new DomainError('invalid_request', 'Cost model currency does not match input');
      const engineInput: CostEngineInput = {
        modelVersionId: input.modelVersionId,
        currency: input.currency,
        lines: input.lines,
        context: input.context,
      };
      const calculated = calculateCost(engineInput, model.rules);
      const hash = createHash('sha256').update(canonicalize(engineInput)).digest('hex');
      const decision = (
        await tx.query<{ id: string; evaluated_at: string }>(
          'INSERT INTO cost_sheet_decisions(tenant_id,cost_model_version_id,technical_solution_revision_id,input_hash,canonical_input,currency,subtotal,total,trace,evaluated_by,idempotency_key) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id,evaluated_at',
          [
            actor.companyId,
            input.modelVersionId,
            input.technicalSolutionRevisionId,
            hash,
            engineInput,
            input.currency,
            calculated.subtotal,
            calculated.total,
            JSON.stringify(calculated.trace),
            actor.employeeId,
            input.idempotencyKey,
          ],
        )
      ).rows[0];
      if (!decision) throw new DomainError('conflict', 'Cost decision failed');
      for (const [i, line] of input.lines.entries())
        await tx.query(
          'INSERT INTO cost_sheet_lines(tenant_id,decision_id,line_number,description,quantity,unit_code,unit_cost,total,applied_rule_versions) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',
          [
            actor.companyId,
            decision.id,
            i + 1,
            line.description,
            line.quantity.value,
            line.quantity.unit,
            line.unitCost.amount,
            calculated.lines[i]?.total.amount ?? '0',
            JSON.stringify(calculated.trace),
          ],
        );
      const result = {
        ...calculated,
        id: decision.id,
        inputHash: hash,
        evaluatedAt: isoTimestamp(decision.evaluated_at),
      };
      await retainCommand(tx, actor.companyId, input.idempotencyKey, identity, result);
      await evidence(
        tx,
        'cost.evaluated',
        actor,
        decision.id,
        1,
        correlationId,
        result,
        'cost-decision',
      );
      return result;
    });
  }

  public async evaluatePolicy(
    input: {
      policyVersionId: string;
      costDecisionId: string;
      context: JsonObject;
      idempotencyKey: string;
    },
    actor: Actor,
    scopes: readonly DataScope[],
    anchors: readonly ScopeAnchor[],
    correlationId: string,
  ) {
    return this.db.transaction(async (tx) => {
      const identity = commandIdentity('POLICY_EVALUATE', input.costDecisionId, actor, {
        policyVersionId: input.policyVersionId,
        costDecisionId: input.costDecisionId,
        context: input.context,
      });
      const costSubject = (
        await tx.query<{ opportunity_id: string; canonical_input: JsonObject }>(
          'SELECT s.opportunity_id,d.canonical_input FROM cost_sheet_decisions d JOIN technical_solution_revisions r ON r.id=d.technical_solution_revision_id AND r.tenant_id=d.tenant_id JOIN technical_solutions s ON s.id=r.technical_solution_id AND s.tenant_id=r.tenant_id WHERE d.id=$1 AND d.tenant_id=$2 FOR UPDATE OF d',
          [input.costDecisionId, actor.companyId],
        )
      ).rows[0];
      if (!costSubject) throw new DomainError('not_found', 'Cost decision not found');
      await this.requireOpportunityScope(tx, costSubject.opportunity_id, actor, scopes, anchors);
      const retained = await replayCommand(tx, actor.companyId, input.idempotencyKey, identity);
      if (retained) return retained;
      const proposedEconomics = Object.fromEntries(
        ['marginBasisPoints', 'discountBasisPoints'].map((key) => [key, input.context[key]]),
      );
      if (
        !Number.isSafeInteger(proposedEconomics.marginBasisPoints) ||
        !Number.isSafeInteger(proposedEconomics.discountBasisPoints)
      )
        throw new DomainError(
          'invalid_request',
          'Policy evaluation requires integer margin and discount basis points',
        );
      const pinnedContext = costSubject.canonical_input.context,
        pinnedObject: Record<string, JsonObject[string]> = {};
      if (
        typeof pinnedContext === 'object' &&
        pinnedContext !== null &&
        !Array.isArray(pinnedContext)
      )
        for (const [key, value] of Object.entries(pinnedContext))
          if (key !== 'marginBasisPoints' && key !== 'discountBasisPoints')
            pinnedObject[key] = value;
      const context: JsonObject = {
        ...pinnedObject,
        ...proposedEconomics,
      } as JsonObject;
      const version = (
        await tx.query<{
          rules: {
            when: never;
            effect: {
              passed?: boolean;
              approvalRequired?: boolean;
              minimumMarginBasisPoints?: number;
              maximumDiscountBasisPoints?: number;
            };
            reason: string;
          }[];
        }>(
          "SELECT rules FROM sales_policy_versions WHERE id=$1 AND tenant_id=$2 AND status='PUBLISHED'",
          [input.policyVersionId, actor.companyId],
        )
      ).rows[0];
      if (!version) throw new DomainError('not_found', 'Published sales policy not found');
      let passed = true,
        approvalRequired = false,
        min: number | null = null,
        max: number | null = null;
      const reasons: string[] = [],
        trace: JsonObject[] = [];
      for (const [index, rule] of version.rules.entries()) {
        const matched = Boolean(evaluateCommercialRule(rule.when, context));
        if (matched) {
          passed = rule.effect.passed ?? passed;
          approvalRequired = rule.effect.approvalRequired ?? approvalRequired;
          min = rule.effect.minimumMarginBasisPoints ?? min;
          max = rule.effect.maximumDiscountBasisPoints ?? max;
          reasons.push(rule.reason);
        }
        trace.push({ rule: index, matched, reason: rule.reason });
      }
      const hash = createHash('sha256').update(canonicalize(context)).digest('hex');
      const row = (
        await tx.query<{ id: string; evaluated_at: string }>(
          'INSERT INTO sales_policy_evaluations(tenant_id,sales_policy_version_id,cost_decision_id,input_hash,canonical_input,passed,approval_required,minimum_margin_basis_points,maximum_discount_basis_points,reasons,trace,evaluated_by,idempotency_key) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id,evaluated_at',
          [
            actor.companyId,
            input.policyVersionId,
            input.costDecisionId,
            hash,
            context,
            passed,
            approvalRequired,
            min,
            max,
            JSON.stringify(reasons),
            JSON.stringify(trace),
            actor.employeeId,
            input.idempotencyKey,
          ],
        )
      ).rows[0];
      if (!row) throw new DomainError('conflict', 'Policy evaluation failed');
      const result = {
        id: row.id,
        policyVersionId: input.policyVersionId,
        inputHash: hash,
        passed,
        approvalRequired,
        minimumMarginBasisPoints: min,
        maximumDiscountBasisPoints: max,
        reasons,
        trace,
        evaluatedAt: isoTimestamp(row.evaluated_at),
      };
      await retainCommand(tx, actor.companyId, input.idempotencyKey, identity, result);
      await evidence(
        tx,
        'sales-policy.evaluated',
        actor,
        row.id,
        1,
        correlationId,
        result,
        'sales-policy-evaluation',
      );
      return result;
    });
  }

  public async createQuote(
    input: {
      quoteId?: string;
      quoteNumber: string;
      opportunityId: string;
      ctrVersionId: string;
      technicalSolutionRevisionId: string;
      costDecisionId: string;
      policyVersionId: string;
      policyEvaluationId: string;
      currency: string;
      subtotal: string;
      discount: string;
      total: string;
      costTotal: string;
      margin: string;
      marginBasisPoints: number;
      validUntil: string;
      lines: readonly {
        description: string;
        quantity: string;
        unitCode: string;
        unitPrice: string;
        total: string;
      }[];
    },
    actor: Actor,
    scopes: readonly DataScope[],
    anchors: readonly ScopeAnchor[],
    correlationId: string,
  ) {
    return this.db.transaction(async (tx) => {
      let serverSubtotal = '0';
      for (const line of input.lines) {
        const serverLineTotal = multiplyDecimal(line.quantity, line.unitPrice);
        if (serverLineTotal !== line.total)
          throw new DomainError('invalid_request', 'Quote line total is inconsistent');
        serverSubtotal = addDecimal(serverSubtotal, serverLineTotal);
      }
      const costPin = (
        await tx.query<{
          total: string;
          currency: string;
          technical_solution_revision_id: string;
        }>(
          'SELECT total,currency,technical_solution_revision_id FROM cost_sheet_decisions WHERE id=$1 AND tenant_id=$2',
          [input.costDecisionId, actor.companyId],
        )
      ).rows[0];
      if (
        costPin?.currency !== input.currency ||
        costPin.technical_solution_revision_id !== input.technicalSolutionRevisionId
      )
        throw new DomainError('invalid_request', 'Quote cost decision or currency is inconsistent');
      const serverTotal = addDecimal(serverSubtotal, `-${input.discount}`);
      const serverMargin = addDecimal(serverTotal, `-${costPin.total}`);
      const serverMarginBasisPoints = calculateBasisPoints(serverMargin, serverTotal);
      const serverDiscountBasisPoints = calculateBasisPoints(input.discount, serverSubtotal);
      if (
        normalizeDecimal(input.subtotal) !== serverSubtotal ||
        normalizeDecimal(input.total) !== serverTotal ||
        normalizeDecimal(input.costTotal) !== normalizeDecimal(costPin.total) ||
        normalizeDecimal(input.margin) !== serverMargin ||
        input.marginBasisPoints !== serverMarginBasisPoints
      )
        throw new DomainError('invalid_request', 'Quote totals or margin are inconsistent');
      const policyEvaluation = (
        await tx.query<{
          sales_policy_version_id: string;
          cost_decision_id: string;
          canonical_input: JsonObject;
          passed: boolean;
          minimum_margin_basis_points: number | null;
          maximum_discount_basis_points: number | null;
        }>(
          'SELECT sales_policy_version_id,cost_decision_id,canonical_input,passed,minimum_margin_basis_points,maximum_discount_basis_points FROM sales_policy_evaluations WHERE id=$1 AND tenant_id=$2',
          [input.policyEvaluationId, actor.companyId],
        )
      ).rows[0];
      if (!policyEvaluation)
        throw new DomainError('invalid_request', 'Policy evaluation was not found');
      if (
        policyEvaluation.sales_policy_version_id !== input.policyVersionId ||
        policyEvaluation.cost_decision_id !== input.costDecisionId ||
        policyEvaluation.canonical_input.marginBasisPoints !== serverMarginBasisPoints ||
        policyEvaluation.canonical_input.discountBasisPoints !== serverDiscountBasisPoints ||
        !policyEvaluation.passed ||
        (policyEvaluation.minimum_margin_basis_points !== null &&
          serverMarginBasisPoints < policyEvaluation.minimum_margin_basis_points) ||
        (policyEvaluation.maximum_discount_basis_points !== null &&
          serverDiscountBasisPoints > policyEvaluation.maximum_discount_basis_points)
      )
        throw new DomainError(
          'invalid_request',
          'Policy evaluation does not match the actual quote economics',
        );
      const opportunity = await this.requireOpportunityScope(
        tx,
        input.opportunityId,
        actor,
        scopes,
        anchors,
      );
      const graphOpportunity = (
        await tx.query<{ opportunity_id: string }>(
          'SELECT s.opportunity_id FROM technical_solution_revisions r JOIN technical_solutions s ON s.id=r.technical_solution_id AND s.tenant_id=r.tenant_id WHERE r.id=$1 AND r.tenant_id=$2',
          [input.technicalSolutionRevisionId, actor.companyId],
        )
      ).rows[0];
      if (graphOpportunity?.opportunity_id !== input.opportunityId)
        throw new DomainError(
          'invalid_request',
          'Quote graph must belong to the quoted opportunity',
        );
      const snapshot = {
        id: opportunity.id,
        customerId: opportunity.customer_id,
        leadId: opportunity.lead_id,
        name: opportunity.name,
        status: opportunity.status,
        value: opportunity.value,
        currency: opportunity.currency,
        probabilityBasisPoints: opportunity.probability_basis_points,
        expectedCloseDate: opportunity.expected_close_date,
        version: opportunity.version,
      };
      const hash = createHash('sha256').update(canonicalize(snapshot)).digest('hex');
      const pinned = (
        await tx.query<{ id: string }>(
          'WITH inserted AS (INSERT INTO opportunity_snapshots(tenant_id,opportunity_id,version,snapshot,snapshot_hash,captured_by) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(tenant_id,opportunity_id,version) DO NOTHING RETURNING id) SELECT id FROM inserted UNION ALL SELECT id FROM opportunity_snapshots WHERE tenant_id=$1 AND opportunity_id=$2 AND version=$3 LIMIT 1',
          [
            actor.companyId,
            input.opportunityId,
            opportunity.version,
            snapshot,
            hash,
            actor.employeeId,
          ],
        )
      ).rows[0];
      if (!pinned) throw new DomainError('conflict', 'Opportunity snapshot failed');
      const quote = input.quoteId
        ? (
            await tx.query<{ id: string }>(
              'SELECT id FROM quotes WHERE id=$1 AND tenant_id=$2 AND opportunity_id=$3 AND deleted_at IS NULL FOR UPDATE',
              [input.quoteId, actor.companyId, input.opportunityId],
            )
          ).rows[0]
        : (
            await tx.query<{ id: string }>(
              'INSERT INTO quotes(tenant_id,quote_number,opportunity_id,created_by) VALUES($1,$2,$3,$4) RETURNING id',
              [actor.companyId, input.quoteNumber, input.opportunityId, actor.employeeId],
            )
          ).rows[0];
      if (!quote) throw new DomainError('conflict', 'Quote could not be created');
      const revision = (
        await tx.query<JsonObject>(
          'INSERT INTO quote_revisions(tenant_id,quote_id,revision,opportunity_version,opportunity_snapshot_id,ctr_version_id,technical_solution_revision_id,cost_decision_id,sales_policy_version_id,sales_policy_evaluation_id,currency,subtotal,discount,total,cost_total,margin,margin_basis_points,valid_until,created_by) SELECT $1,$2,coalesce(max(revision),0)+1,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18 FROM quote_revisions WHERE tenant_id=$1 AND quote_id=$2 RETURNING id,quote_id AS "quoteId",revision,status,opportunity_version AS "opportunityVersion",opportunity_snapshot_id AS "opportunitySnapshotId",ctr_version_id AS "ctrVersionId",technical_solution_revision_id AS "technicalSolutionRevisionId",cost_decision_id AS "costDecisionId",sales_policy_version_id AS "policyVersionId",sales_policy_evaluation_id AS "policyEvaluationId",currency,subtotal,discount,total,cost_total AS "costTotal",margin,margin_basis_points AS "marginBasisPoints",valid_until AS "validUntil",issued_at AS "issuedAt",created_at AS "createdAt"',
          [
            actor.companyId,
            quote.id,
            opportunity.version,
            pinned.id,
            input.ctrVersionId,
            input.technicalSolutionRevisionId,
            input.costDecisionId,
            input.policyVersionId,
            input.policyEvaluationId,
            input.currency,
            serverSubtotal,
            input.discount,
            serverTotal,
            costPin.total,
            serverMargin,
            serverMarginBasisPoints,
            input.validUntil,
            actor.employeeId,
          ],
        )
      ).rows[0];
      if (!revision) throw new DomainError('conflict', 'Quote revision could not be created');
      for (const [i, line] of input.lines.entries())
        await tx.query(
          'INSERT INTO quote_lines(tenant_id,quote_revision_id,line_number,description,quantity,unit_code,unit_price,total) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
          [
            actor.companyId,
            revision.id,
            i + 1,
            line.description,
            line.quantity,
            line.unitCode,
            line.unitPrice,
            line.total,
          ],
        );
      await evidence(
        tx,
        input.quoteId ? 'quote.revision-created' : 'quote.created',
        actor,
        quote.id,
        Number(revision.revision),
        correlationId,
        revision,
        'quote',
      );
      return revision;
    });
  }

  public async approveQuote(
    revisionId: string,
    decision: 'APPROVED' | 'REJECTED',
    reason: string,
    idempotencyKey: string,
    actor: Actor,
    scopes: readonly DataScope[],
    anchors: readonly ScopeAnchor[],
    correlationId: string,
  ) {
    return this.db.transaction(async (tx) => {
      const identity = commandIdentity('QUOTE_APPROVE', revisionId, actor, { decision, reason });
      const row = (
        await tx.query<{
          quote_id: string;
          revision: number;
          opportunity_id: string;
          status: string;
        }>(
          'SELECT r.quote_id,r.revision,q.opportunity_id,r.status FROM quote_revisions r JOIN quotes q ON q.id=r.quote_id AND q.tenant_id=r.tenant_id WHERE r.id=$1 AND r.tenant_id=$2 FOR UPDATE OF r',
          [revisionId, actor.companyId],
        )
      ).rows[0];
      if (!row) throw new DomainError('not_found', 'Quote revision not found');
      await this.requireOpportunityScope(tx, row.opportunity_id, actor, scopes, anchors);
      const retained = await replayCommand(tx, actor.companyId, idempotencyKey, identity);
      if (retained) return retained;
      if (!['DRAFT', 'PENDING_APPROVAL'].includes(row.status))
        throw new DomainError('conflict', 'Quote revision cannot be approved');
      await tx.query(
        'INSERT INTO quote_approvals(tenant_id,quote_revision_id,decision,approver_id,reason,idempotency_key) VALUES($1,$2,$3,$4,$5,$6)',
        [actor.companyId, revisionId, decision, actor.employeeId, reason, idempotencyKey],
      );
      await tx.query('UPDATE quote_revisions SET status=$3 WHERE id=$1 AND tenant_id=$2', [
        revisionId,
        actor.companyId,
        decision,
      ]);
      const result = {
        id: revisionId,
        quoteId: row.quote_id,
        revision: row.revision,
        status: decision,
      };
      await retainCommand(tx, actor.companyId, idempotencyKey, identity, result);
      await evidence(
        tx,
        'quote.decided',
        actor,
        row.quote_id,
        row.revision,
        correlationId,
        result,
        'quote',
      );
      return result;
    });
  }

  public async issueQuote(
    revisionId: string,
    idempotencyKey: string,
    actor: Actor,
    scopes: readonly DataScope[],
    anchors: readonly ScopeAnchor[],
    correlationId: string,
  ) {
    return this.db.transaction(async (tx) => {
      const identity = commandIdentity('QUOTE_ISSUE', revisionId, actor, {});
      const row = (
        await tx.query<{
          quote_id: string;
          revision: number;
          opportunity_id: string;
          status: string;
        }>(
          'SELECT r.quote_id,r.revision,q.opportunity_id,r.status FROM quote_revisions r JOIN quotes q ON q.id=r.quote_id AND q.tenant_id=r.tenant_id WHERE r.id=$1 AND r.tenant_id=$2 FOR UPDATE OF r',
          [revisionId, actor.companyId],
        )
      ).rows[0];
      if (!row) throw new DomainError('not_found', 'Issuable quote revision not found');
      await this.requireOpportunityScope(tx, row.opportunity_id, actor, scopes, anchors);
      const retained = await replayCommand(tx, actor.companyId, idempotencyKey, identity);
      if (retained) return retained;
      if (!['DRAFT', 'APPROVED'].includes(row.status))
        throw new DomainError('conflict', 'Quote revision cannot be issued');
      await tx.query(
        "UPDATE quote_revisions SET status='ISSUED',issued_at=now() WHERE id=$1 AND tenant_id=$2",
        [revisionId, actor.companyId],
      );
      const snapshot = (
        await tx.query<{ snapshot: JsonObject }>(
          "SELECT to_jsonb(r) || jsonb_build_object('lines',(SELECT coalesce(jsonb_agg(to_jsonb(l) ORDER BY l.line_number),'[]'::jsonb) FROM quote_lines l WHERE l.tenant_id=r.tenant_id AND l.quote_revision_id=r.id),'approvals',(SELECT coalesce(jsonb_agg(to_jsonb(a) ORDER BY a.decided_at),'[]'::jsonb) FROM quote_approvals a WHERE a.tenant_id=r.tenant_id AND a.quote_revision_id=r.id)) AS snapshot FROM quote_revisions r WHERE r.id=$1 AND r.tenant_id=$2",
          [revisionId, actor.companyId],
        )
      ).rows[0]?.snapshot;
      if (!snapshot) throw new DomainError('conflict', 'Quote snapshot failed');
      const hash = createHash('sha256').update(canonicalize(snapshot)).digest('hex');
      await tx.query(
        'INSERT INTO quote_issued_snapshots(tenant_id,quote_revision_id,snapshot,snapshot_hash,issued_by,idempotency_key) VALUES($1,$2,$3,$4,$5,$6)',
        [actor.companyId, revisionId, snapshot, hash, actor.employeeId, idempotencyKey],
      );
      const result = {
        id: revisionId,
        quoteId: row.quote_id,
        revision: row.revision,
        status: 'ISSUED',
        snapshotHash: hash,
      };
      await retainCommand(tx, actor.companyId, idempotencyKey, identity, result);
      await evidence(
        tx,
        'quote.issued',
        actor,
        row.quote_id,
        row.revision,
        correlationId,
        result,
        'quote',
      );
      return result;
    });
  }
}
