import {
  DomainError,
  assertCustomerTransition,
  assertLeadTransition,
  assertSeparationOfDuties,
  normalizeContactEmail,
  normalizeContactPhone,
  normalizeCustomerIdentity,
  type Actor,
  type ScopeAnchor,
} from '@kingturf/domain';
import type { Database, SqlClient } from '@kingturf/database';
import { recordScopeSql, type RecordScopeOptions } from './scope-sql.ts';
import { writeCrmAuditEvent as auditEvent } from './audit-outbox.ts';
import type {
  ActivityDto,
  ContactDto,
  Customer360Dto,
  CustomerDto,
  DataScope,
  JsonObject,
  LeadDto,
  OpportunityDto,
} from '@kingturf/types';

type Db = SqlClient & Pick<Database, 'transaction'>;
type CustomerRow = {
  id: string;
  tenant_id: string;
  customer_number: string;
  name: string;
  normalized_name: string;
  status: CustomerDto['status'];
  owner_id: string | null;
  owner_organization_id: string | null;
  tags: string[];
  version: number;
  created_at: string;
  updated_at: string;
};
type LeadRow = {
  id: string;
  tenant_id: string;
  customer_id: string | null;
  title: string;
  source: string;
  status: LeadDto['status'];
  owner_id: string | null;
  owner_organization_id: string | null;
  version: number;
  created_at: string;
  updated_at: string;
};
type ActivityRow = {
  id: string;
  customer_id: string;
  lead_id: string | null;
  activity_type: string;
  occurred_at: string;
  actor_id: string;
  summary: string;
  details: JsonObject;
  idempotency_key: string;
};
type ContactRow = {
  id: string;
  customer_id: string;
  name: string;
  title: string | null;
  normalized_email: string | null;
  normalized_phone: string | null;
  is_primary: boolean;
  version: number;
  created_at: string;
};
type OwnershipRow = {
  id: string;
  customer_id: string;
  owner_id: string;
  organization_id: string;
  assigned_by: string;
  reason: string;
  started_at: string;
  ended_at: string | null;
};
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
const required = <T>(value: T | undefined, message: string): T => {
  if (!value) throw new DomainError('conflict', message);
  return value;
};
const timestamp = (value: string | Date): string =>
  value instanceof Date ? value.toISOString() : value;
const canonicalJson = (value: unknown): string =>
  value !== null && typeof value === 'object'
    ? Array.isArray(value)
      ? `[${value.map(canonicalJson).join(',')}]`
      : `{${Object.entries(value)
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([key, child]) => `${JSON.stringify(key)}:${canonicalJson(child)}`)
          .join(',')}}`
    : JSON.stringify(value);
const customer = (r: CustomerRow): CustomerDto => ({
  id: r.id,
  tenantId: r.tenant_id,
  customerNumber: r.customer_number,
  name: r.name,
  normalizedName: r.normalized_name,
  status: r.status,
  ownerId: r.owner_id,
  ownerOrganizationId: r.owner_organization_id,
  tags: r.tags,
  version: r.version,
  createdAt: timestamp(r.created_at),
  updatedAt: timestamp(r.updated_at),
});
const lead = (r: LeadRow): LeadDto => ({
  id: r.id,
  tenantId: r.tenant_id,
  customerId: r.customer_id,
  title: r.title,
  source: r.source,
  status: r.status,
  ownerId: r.owner_id,
  ownerOrganizationId: r.owner_organization_id,
  version: r.version,
  createdAt: timestamp(r.created_at),
  updatedAt: timestamp(r.updated_at),
});
const opportunity = (r: OpportunityRow): OpportunityDto => ({
  id: r.id,
  tenantId: r.tenant_id,
  customerId: r.customer_id,
  leadId: r.lead_id,
  name: r.name,
  status: r.status,
  ownerId: r.owner_id,
  ownerOrganizationId: r.owner_organization_id,
  value: { amount: r.value, currency: r.currency },
  probabilityBasisPoints: r.probability_basis_points,
  expectedCloseDate: r.expected_close_date,
  version: r.version,
  createdAt: timestamp(r.created_at),
  updatedAt: timestamp(r.updated_at),
});
// 数据范围谓词已收敛至 scope-sql.ts 的 recordScopeSql（批次 1b，TD-DUP-001）。
// CRM 语义差异以显式选项表达：GROUP/COMPANY 短路、锚点按类型清单放行、SELF 可附无主池子句。
// 与迁移前的两处纯外观差异（EXISTS 后空格、关联别名 scoped→osr）不影响语义，见 scope-sql-crm.test.ts 对拍说明。
const CRM_SCOPE: RecordScopeOptions = { companyShortCircuit: true, anchorGuard: 'typed' };
const CRM_SCOPE_POOL: RecordScopeOptions = {
  companyShortCircuit: true,
  anchorGuard: 'typed',
  includeUnownedPool: true,
};
export class PostgresCrmRepository {
  public constructor(private readonly db: Db) {}
  private async requireScopedSubject(
    tx: SqlClient,
    table: 'customers' | 'leads',
    id: string,
    actor: Actor,
    scopes: readonly DataScope[],
    anchors: readonly ScopeAnchor[],
    includeUnownedPool = false,
  ): Promise<CustomerRow | LeadRow> {
    const alias = table === 'customers' ? 'c' : 'l';
    const authorized = recordScopeSql(
      scopes,
      anchors,
      actor,
      alias,
      3,
      includeUnownedPool ? CRM_SCOPE_POOL : CRM_SCOPE,
    );
    const row = (
      await tx.query<CustomerRow | LeadRow>(
        `SELECT ${alias}.* FROM ${table} ${alias} WHERE ${alias}.id=$1 AND ${alias}.tenant_id=$2 AND ${alias}.deleted_at IS NULL AND ${authorized.sql} FOR UPDATE`,
        [id, actor.companyId, ...authorized.values],
      )
    ).rows[0];
    if (!row)
      throw new DomainError(
        'not_found',
        `${table === 'customers' ? 'Customer' : 'Lead'} not found`,
      );
    return row;
  }
  public async listCustomers(
    actor: Actor,
    scopes: readonly DataScope[],
    anchors: readonly ScopeAnchor[],
  ) {
    const s = recordScopeSql(scopes, anchors, actor, 'c', 2, CRM_SCOPE);
    return (
      await this.db.query<CustomerRow>(
        `SELECT c.* FROM customers c WHERE c.tenant_id=$1 AND c.deleted_at IS NULL AND ${s.sql} ORDER BY c.updated_at DESC,c.id LIMIT 100`,
        [actor.companyId, ...s.values],
      )
    ).rows.map(customer);
  }
  public async findCustomer(
    id: string,
    actor: Actor,
    scopes: readonly DataScope[],
    anchors: readonly ScopeAnchor[],
  ) {
    const s = recordScopeSql(scopes, anchors, actor, 'c', 3, CRM_SCOPE);
    const r = (
      await this.db.query<CustomerRow>(
        `SELECT c.* FROM customers c WHERE c.id=$1 AND c.tenant_id=$2 AND c.deleted_at IS NULL AND ${s.sql}`,
        [id, actor.companyId, ...s.values],
      )
    ).rows[0];
    return r ? customer(r) : null;
  }
  public async createCustomer(
    input: { name: string; customerNumber: string; tags: readonly string[] },
    actor: Actor,
    correlationId: string,
  ) {
    return this.db.transaction(async (tx) => {
      const r = (
        await tx.query<CustomerRow>(
          'INSERT INTO customers(tenant_id,customer_number,name,normalized_name,tags,created_by,updated_by) VALUES($1,$2,$3,$4,$5,$6,$6) RETURNING *',
          [
            actor.companyId,
            input.customerNumber,
            input.name,
            normalizeCustomerIdentity(input.name),
            input.tags,
            actor.employeeId,
          ],
        )
      ).rows[0];
      if (!r) throw new DomainError('conflict', 'Customer could not be created');
      await auditEvent(tx, 'customer.created', actor, 'customer', r.id, correlationId, r.version, {
        customerNumber: r.customer_number,
      });
      return customer(r);
    });
  }
  public async transitionCustomer(
    id: string,
    to: CustomerDto['status'],
    expectedVersion: number,
    reason: string,
    actor: Actor,
    correlationId: string,
    scopes: readonly DataScope[],
    anchors: readonly ScopeAnchor[],
  ) {
    return this.db.transaction(async (tx) => {
      const locked = (await this.requireScopedSubject(
        tx,
        'customers',
        id,
        actor,
        scopes,
        anchors,
      )) as CustomerRow;
      assertCustomerTransition(locked.status, to);
      if (locked.version !== expectedVersion)
        throw new DomainError('conflict', 'Customer version is stale');
      const row = required(
        (
          await tx.query<CustomerRow>(
            'UPDATE customers SET status=$3,version=version+1,updated_at=now(),updated_by=$4 WHERE id=$1 AND tenant_id=$2 RETURNING *',
            [id, actor.companyId, to, actor.employeeId],
          )
        ).rows[0],
        'Customer update failed',
      );
      await tx.query(
        'INSERT INTO customer_lifecycle_history(tenant_id,customer_id,from_status,to_status,actor_id,reason) VALUES($1,$2,$3,$4,$5,$6)',
        [actor.companyId, id, locked.status, to, actor.employeeId, reason],
      );
      await auditEvent(
        tx,
        'customer.lifecycle-changed',
        actor,
        'customer',
        id,
        correlationId,
        row.version,
        { from: locked.status, to, reason },
      );
      return customer(row);
    });
  }
  public async createContact(
    customerId: string,
    input: {
      name: string;
      title: string | null;
      email: string | null;
      phone: string | null;
      primary: boolean;
    },
    actor: Actor,
    correlationId: string,
    scopes: readonly DataScope[],
    anchors: readonly ScopeAnchor[],
  ) {
    return this.db.transaction(async (tx) => {
      await this.requireScopedSubject(tx, 'customers', customerId, actor, scopes, anchors);
      const email = input.email === null ? null : normalizeContactEmail(input.email);
      const phone = input.phone === null ? null : normalizeContactPhone(input.phone);
      if (email === null && phone === null)
        throw new DomainError('invalid_request', 'Contact email or phone is required');
      const r = (
        await tx.query<{
          id: string;
          customer_id: string;
          name: string;
          title: string | null;
          normalized_email: string | null;
          normalized_phone: string | null;
          is_primary: boolean;
          version: number;
          created_at: string;
        }>(
          'INSERT INTO customer_contacts(tenant_id,customer_id,name,title,normalized_email,normalized_phone,is_primary,created_by,updated_by) SELECT $1,$2,$3,$4,$5,$6,$7,$8,$8 WHERE EXISTS(SELECT 1 FROM customers WHERE id=$2 AND tenant_id=$1 AND deleted_at IS NULL) RETURNING *',
          [
            actor.companyId,
            customerId,
            input.name,
            input.title,
            email,
            phone,
            input.primary,
            actor.employeeId,
          ],
        )
      ).rows[0];
      if (!r) throw new DomainError('not_found', 'Customer not found');
      await auditEvent(
        tx,
        'customer.contact-created',
        actor,
        'customer',
        customerId,
        correlationId,
        1,
        { contactId: r.id },
        { type: 'customer-contact', id: r.id, version: r.version },
      );
      return {
        id: r.id,
        customerId: r.customer_id,
        name: r.name,
        title: r.title,
        email: r.normalized_email,
        phone: r.normalized_phone,
        primary: r.is_primary,
        version: r.version,
        createdAt: r.created_at,
      } satisfies ContactDto;
    });
  }
  public async listLeads(
    actor: Actor,
    scopes: readonly DataScope[],
    anchors: readonly ScopeAnchor[],
    pool = false,
  ) {
    const authorized = recordScopeSql(
      scopes,
      anchors,
      actor,
      'l',
      2,
      pool ? CRM_SCOPE_POOL : CRM_SCOPE,
    );
    const predicate = pool ? `(l.status='POOL' AND ${authorized.sql})` : authorized.sql;
    return (
      await this.db.query<LeadRow>(
        `SELECT l.* FROM leads l WHERE l.tenant_id=$1 AND l.deleted_at IS NULL AND ${predicate} ORDER BY l.created_at,l.id LIMIT 100`,
        [actor.companyId, ...authorized.values],
      )
    ).rows.map(lead);
  }
  public async createLead(
    input: { title: string; source: string; customerId: string | null; pool: boolean },
    actor: Actor,
    correlationId: string,
    scopes: readonly DataScope[],
    anchors: readonly ScopeAnchor[],
  ) {
    return this.db.transaction(async (tx) => {
      if (input.customerId)
        await this.requireScopedSubject(tx, 'customers', input.customerId, actor, scopes, anchors);
      const row = (
        await tx.query<LeadRow>(
          'INSERT INTO leads(tenant_id,customer_id,title,source,status,owner_organization_id,created_by,updated_by) SELECT $1,$2,$3,$4,$5,(SELECT organization_id FROM employees WHERE id=$6 AND company_id=$1),$6,$6 RETURNING *',
          [
            actor.companyId,
            input.customerId,
            input.title,
            input.source,
            input.pool ? 'POOL' : 'NEW',
            actor.employeeId,
          ],
        )
      ).rows[0];
      if (!row) throw new DomainError('not_found', 'Customer not found');
      await auditEvent(tx, 'lead.created', actor, 'lead', row.id, correlationId, row.version, {
        source: row.source,
        status: row.status,
      });
      return lead(row);
    });
  }
  public async claimLead(
    id: string,
    expectedVersion: number,
    actor: Actor,
    correlationId: string,
    idempotencyKey: string,
    scopes: readonly DataScope[],
    anchors: readonly ScopeAnchor[],
  ) {
    return this.db.transaction(async (tx) => {
      const requestFingerprint = canonicalJson({
        leadId: id,
        expectedVersion,
        claimantId: actor.employeeId,
      });
      await tx.query('SELECT pg_advisory_xact_lock(hashtext($1),hashtext($2))', [
        actor.companyId,
        idempotencyKey,
      ]);
      const locked = (await this.requireScopedSubject(
        tx,
        'leads',
        id,
        actor,
        scopes,
        anchors,
        true,
      )) as LeadRow;
      const prior = (
        await tx.query<{
          command_type: string;
          subject_id: string;
          payload: { lead: LeadDto };
          request_fingerprint: string;
        }>(
          'SELECT command_type,subject_id,payload,request_fingerprint FROM crm_command_results WHERE tenant_id=$1 AND idempotency_key=$2',
          [actor.companyId, idempotencyKey],
        )
      ).rows[0];
      if (prior) {
        if (
          prior.command_type !== 'LEAD_CLAIM' ||
          prior.subject_id !== id ||
          prior.request_fingerprint !== requestFingerprint
        )
          throw new DomainError('conflict', 'Idempotency-Key was used for a different command');
        return prior.payload.lead;
      }
      if (locked.status !== 'POOL')
        throw new DomainError('conflict', `Illegal lead transition: ${locked.status} -> CLAIMED`);
      assertLeadTransition(locked.status, 'CLAIMED');
      if (locked.version !== expectedVersion)
        throw new DomainError('conflict', 'Lead version is stale');
      const r = required(
        (
          await tx.query<LeadRow>(
            "UPDATE leads SET status='CLAIMED',owner_id=$3,owner_organization_id=(SELECT organization_id FROM employees WHERE id=$3 AND company_id=$2),version=version+1,updated_at=now(),updated_by=$3 WHERE id=$1 AND tenant_id=$2 RETURNING *",
            [id, actor.companyId, actor.employeeId],
          )
        ).rows[0],
        'Lead claim failed',
      );
      await tx.query(
        "INSERT INTO crm_assignments(tenant_id,subject_type,subject_id,assignee_id,organization_id,assigned_by,reason) VALUES($1,'LEAD',$2,$3,$4,$3,'Pool claim')",
        [actor.companyId, id, actor.employeeId, r.owner_organization_id],
      );
      await tx.query(
        "INSERT INTO lead_transitions(tenant_id,lead_id,from_status,to_status,actor_id,reason) VALUES($1,$2,$3,'CLAIMED',$4,'Pool claim')",
        [actor.companyId, id, locked.status, actor.employeeId],
      );
      await auditEvent(tx, 'lead.claimed', actor, 'lead', id, correlationId, r.version, {
        from: locked.status,
        to: 'CLAIMED',
      });
      const dto = lead(r);
      await tx.query(
        "INSERT INTO crm_command_results(tenant_id,idempotency_key,command_type,subject_id,payload,request_fingerprint) VALUES($1,$2,'LEAD_CLAIM',$3,$4,$5)",
        [actor.companyId, idempotencyKey, id, { lead: dto }, requestFingerprint],
      );
      return dto;
    });
  }
  public async transitionLead(
    id: string,
    to: LeadDto['status'],
    expectedVersion: number,
    reason: string,
    actor: Actor,
    correlationId: string,
    scopes: readonly DataScope[],
    anchors: readonly ScopeAnchor[],
    requiredFrom?: LeadDto['status'],
  ) {
    return this.db.transaction(async (tx) => {
      const locked = (await this.requireScopedSubject(
        tx,
        'leads',
        id,
        actor,
        scopes,
        anchors,
      )) as LeadRow;
      if (requiredFrom !== undefined && locked.status !== requiredFrom)
        throw new DomainError('conflict', `Lead must be ${requiredFrom} for this transition`);
      assertLeadTransition(locked.status, to);
      if (locked.version !== expectedVersion)
        throw new DomainError('conflict', 'Lead version is stale');
      const clearOwner = to === 'POOL';
      if (clearOwner)
        await tx.query(
          "UPDATE crm_assignments SET ended_at=now(),version=version+1 WHERE tenant_id=$1 AND subject_type='LEAD' AND subject_id=$2 AND ended_at IS NULL",
          [actor.companyId, id],
        );
      const row = required(
        (
          await tx.query<LeadRow>(
            'UPDATE leads SET status=$3,owner_id=CASE WHEN $4 THEN NULL ELSE owner_id END,owner_organization_id=CASE WHEN $4 THEN NULL ELSE owner_organization_id END,version=version+1,updated_at=now(),updated_by=$5 WHERE id=$1 AND tenant_id=$2 RETURNING *',
            [id, actor.companyId, to, clearOwner, actor.employeeId],
          )
        ).rows[0],
        'Lead update failed',
      );
      await tx.query(
        'INSERT INTO lead_transitions(tenant_id,lead_id,from_status,to_status,actor_id,reason) VALUES($1,$2,$3,$4,$5,$6)',
        [actor.companyId, id, locked.status, to, actor.employeeId, reason],
      );
      await auditEvent(
        tx,
        'lead.lifecycle-changed',
        actor,
        'lead',
        id,
        correlationId,
        row.version,
        { from: locked.status, to, reason },
      );
      return lead(row);
    });
  }
  public async assign(
    subjectType: 'CUSTOMER' | 'LEAD',
    subjectId: string,
    assigneeId: string,
    expectedVersion: number,
    reason: string,
    actor: Actor,
    correlationId: string,
    reassignment: boolean,
    scopes: readonly DataScope[],
    anchors: readonly ScopeAnchor[],
  ) {
    assertSeparationOfDuties(actor.employeeId, assigneeId, reassignment);
    return this.db.transaction(async (tx) => {
      const table = subjectType === 'CUSTOMER' ? 'customers' : 'leads';
      const locked = await this.requireScopedSubject(tx, table, subjectId, actor, scopes, anchors);
      if (locked.version !== expectedVersion)
        throw new DomainError('conflict', 'Subject version is stale');
      const assignee = (
        await tx.query<{ organization_id: string }>(
          'SELECT organization_id FROM employees WHERE id=$1 AND company_id=$2 AND active',
          [assigneeId, actor.companyId],
        )
      ).rows[0];
      if (!assignee) throw new DomainError('not_found', 'Assignee not found');
      const active = (
        await tx.query<{ id: string }>(
          'SELECT id FROM crm_assignments WHERE tenant_id=$1 AND subject_type=$2 AND subject_id=$3 AND ended_at IS NULL FOR UPDATE',
          [actor.companyId, subjectType, subjectId],
        )
      ).rows[0];
      if (reassignment !== Boolean(active))
        throw new DomainError(
          'conflict',
          reassignment ? 'No active assignment to reassign' : 'Subject is already assigned',
        );
      if (active)
        await tx.query(
          'UPDATE crm_assignments SET ended_at=now(),version=version+1 WHERE id=$1 AND tenant_id=$2',
          [active.id, actor.companyId],
        );
      await tx.query(
        'INSERT INTO crm_assignments(tenant_id,subject_type,subject_id,assignee_id,organization_id,assigned_by,reason) VALUES($1,$2,$3,$4,$5,$6,$7)',
        [
          actor.companyId,
          subjectType,
          subjectId,
          assigneeId,
          assignee.organization_id,
          actor.employeeId,
          reason,
        ],
      );
      if (subjectType === 'CUSTOMER') {
        await tx.query(
          'UPDATE customer_ownership_history SET ended_at=now() WHERE tenant_id=$1 AND customer_id=$2 AND ended_at IS NULL',
          [actor.companyId, subjectId],
        );
        await tx.query(
          'INSERT INTO customer_ownership_history(tenant_id,customer_id,owner_id,organization_id,assigned_by,reason) VALUES($1,$2,$3,$4,$5,$6)',
          [
            actor.companyId,
            subjectId,
            assigneeId,
            assignee.organization_id,
            actor.employeeId,
            reason,
          ],
        );
      }
      const poolAssignment = subjectType === 'LEAD' && (locked as LeadRow).status === 'POOL';
      if (poolAssignment) {
        assertLeadTransition((locked as LeadRow).status, 'CLAIMED');
        await tx.query(
          "INSERT INTO lead_transitions(tenant_id,lead_id,from_status,to_status,actor_id,reason) VALUES($1,$2,'POOL','CLAIMED',$3,$4)",
          [actor.companyId, subjectId, actor.employeeId, reason],
        );
      }
      const updated = required(
        (
          await tx.query<CustomerRow | LeadRow>(
            `UPDATE ${table} SET owner_id=$3,owner_organization_id=$4${poolAssignment ? ",status='CLAIMED'" : ''},version=version+1,updated_at=now(),updated_by=$5 WHERE id=$1 AND tenant_id=$2 RETURNING *`,
            [subjectId, actor.companyId, assigneeId, assignee.organization_id, actor.employeeId],
          )
        ).rows[0],
        'Assignment update failed',
      );
      await auditEvent(
        tx,
        reassignment ? 'crm.reassigned' : 'crm.assigned',
        actor,
        subjectType.toLowerCase(),
        subjectId,
        correlationId,
        updated.version,
        { assigneeId, reason, ...(poolAssignment ? { from: 'POOL', to: 'CLAIMED' } : {}) },
      );
      return subjectType === 'CUSTOMER'
        ? customer(updated as CustomerRow)
        : lead(updated as LeadRow);
    });
  }
  public async createActivity(
    customerId: string,
    input: {
      leadId: string | null;
      type: string;
      occurredAt: string;
      summary: string;
      details: JsonObject;
    },
    actor: Actor,
    correlationId: string,
    idempotencyKey: string,
    scopes: readonly DataScope[],
    anchors: readonly ScopeAnchor[],
  ) {
    return this.db.transaction(async (tx) => {
      await tx.query('SELECT pg_advisory_xact_lock(hashtext($1),hashtext($2))', [
        actor.companyId,
        idempotencyKey,
      ]);
      const prior = (
        await tx.query<ActivityRow>(
          'SELECT * FROM customer_activities WHERE tenant_id=$1 AND idempotency_key=$2',
          [actor.companyId, idempotencyKey],
        )
      ).rows[0];
      if (prior) {
        await this.requireScopedSubject(tx, 'customers', customerId, actor, scopes, anchors);
        const requested = canonicalJson({
          customerId,
          leadId: input.leadId,
          type: input.type,
          occurredAt: new Date(input.occurredAt).toISOString(),
          summary: input.summary,
          details: input.details,
        });
        const existing = canonicalJson({
          customerId: prior.customer_id,
          leadId: prior.lead_id,
          type: prior.activity_type,
          occurredAt: new Date(prior.occurred_at).toISOString(),
          summary: prior.summary,
          details: prior.details,
        });
        if (requested !== existing)
          throw new DomainError('conflict', 'Idempotency-Key was used for a different activity');
        return {
          id: prior.id,
          customerId: prior.customer_id,
          leadId: prior.lead_id,
          type: prior.activity_type,
          occurredAt: prior.occurred_at,
          actorId: prior.actor_id,
          summary: prior.summary,
          details: prior.details,
        } satisfies ActivityDto;
      }
      await this.requireScopedSubject(tx, 'customers', customerId, actor, scopes, anchors);
      const row = (
        await tx.query<ActivityRow>(
          'INSERT INTO customer_activities(tenant_id,customer_id,lead_id,activity_type,occurred_at,actor_id,summary,details,idempotency_key) SELECT $1,$2,$3,$4,$5,$6,$7,$8,$9 WHERE EXISTS(SELECT 1 FROM customers WHERE id=$2 AND tenant_id=$1 AND deleted_at IS NULL) AND ($3::uuid IS NULL OR EXISTS(SELECT 1 FROM leads WHERE id=$3 AND customer_id=$2 AND tenant_id=$1)) RETURNING *',
          [
            actor.companyId,
            customerId,
            input.leadId,
            input.type,
            input.occurredAt,
            actor.employeeId,
            input.summary,
            input.details,
            idempotencyKey,
          ],
        )
      ).rows[0];
      if (!row) throw new DomainError('not_found', 'Customer or related lead not found');
      await auditEvent(
        tx,
        'customer.activity-created',
        actor,
        'customer',
        customerId,
        correlationId,
        1,
        { activityId: row.id, type: row.activity_type },
        { type: 'customer-activity', id: row.id, version: 1 },
      );
      return {
        id: row.id,
        customerId: row.customer_id,
        leadId: row.lead_id,
        type: row.activity_type,
        occurredAt: row.occurred_at,
        actorId: row.actor_id,
        summary: row.summary,
        details: row.details,
      } satisfies ActivityDto;
    });
  }
  public async customer360(
    id: string,
    actor: Actor,
    scopes: readonly DataScope[],
    anchors: readonly ScopeAnchor[],
    sensitive: Readonly<{ email: boolean; phone: boolean }>,
    sections: Readonly<{
      ownership?: Readonly<{ scopes: readonly DataScope[]; anchors: readonly ScopeAnchor[] }>;
      leads?: Readonly<{ scopes: readonly DataScope[]; anchors: readonly ScopeAnchor[] }>;
      opportunities?: Readonly<{ scopes: readonly DataScope[]; anchors: readonly ScopeAnchor[] }>;
      activities?: Readonly<{ scopes: readonly DataScope[]; anchors: readonly ScopeAnchor[] }>;
    }> = {},
  ): Promise<Customer360Dto | null> {
    const c = await this.findCustomer(id, actor, scopes, anchors);
    if (!c) return null;
    const ownershipVisible = sections.ownership
      ? await this.findCustomer(id, actor, sections.ownership.scopes, sections.ownership.anchors)
      : null;
    const activityVisible = sections.activities
      ? await this.findCustomer(id, actor, sections.activities.scopes, sections.activities.anchors)
      : null;
    const leadScope = sections.leads
      ? recordScopeSql(sections.leads.scopes, sections.leads.anchors, actor, 'l', 3, CRM_SCOPE)
      : null;
    const opportunityScope = sections.opportunities
      ? recordScopeSql(
          sections.opportunities.scopes,
          sections.opportunities.anchors,
          actor,
          'op',
          3,
          CRM_SCOPE,
        )
      : null;
    const [contacts, ownership, leads, opportunities, activities] = await Promise.all([
      this.db.query<ContactRow>(
        'SELECT * FROM customer_contacts WHERE tenant_id=$1 AND customer_id=$2 AND deleted_at IS NULL ORDER BY is_primary DESC,created_at',
        [actor.companyId, id],
      ),
      ownershipVisible
        ? this.db.query<OwnershipRow>(
            'SELECT * FROM customer_ownership_history WHERE tenant_id=$1 AND customer_id=$2 ORDER BY started_at DESC',
            [actor.companyId, id],
          )
        : Promise.resolve({ rows: [] as OwnershipRow[] }),
      leadScope
        ? this.db.query<LeadRow>(
            `SELECT l.* FROM leads l WHERE l.tenant_id=$1 AND l.customer_id=$2 AND l.deleted_at IS NULL AND ${leadScope.sql} ORDER BY l.created_at DESC`,
            [actor.companyId, id, ...leadScope.values],
          )
        : Promise.resolve({ rows: [] as LeadRow[] }),
      opportunityScope
        ? this.db.query<OpportunityRow>(
            `SELECT op.* FROM opportunities op WHERE op.tenant_id=$1 AND op.customer_id=$2 AND op.deleted_at IS NULL AND ${opportunityScope.sql} ORDER BY op.updated_at DESC,op.id`,
            [actor.companyId, id, ...opportunityScope.values],
          )
        : Promise.resolve({ rows: [] as OpportunityRow[] }),
      activityVisible
        ? this.db.query<ActivityRow>(
            'SELECT * FROM customer_activities WHERE tenant_id=$1 AND customer_id=$2 ORDER BY occurred_at DESC,id LIMIT 100',
            [actor.companyId, id],
          )
        : Promise.resolve({ rows: [] as ActivityRow[] }),
    ]);
    return {
      customer: c,
      contacts: contacts.rows.map((r) => ({
        id: r.id,
        customerId: r.customer_id,
        name: r.name,
        title: r.title,
        ...(sensitive.email ? { email: r.normalized_email } : {}),
        ...(sensitive.phone ? { phone: r.normalized_phone } : {}),
        primary: r.is_primary,
        version: r.version,
        createdAt: r.created_at,
      })),
      ownership: ownership.rows.map((r) => ({
        id: r.id,
        customerId: r.customer_id,
        ownerId: r.owner_id,
        organizationId: r.organization_id,
        assignedBy: r.assigned_by,
        reason: r.reason,
        startedAt: r.started_at,
        endedAt: r.ended_at,
      })),
      leads: leads.rows.map(lead),
      opportunities: opportunities.rows.map(opportunity),
      activities: activities.rows.map(
        (r) =>
          ({
            id: r.id,
            customerId: r.customer_id,
            leadId: r.lead_id,
            type: r.activity_type,
            occurredAt: r.occurred_at,
            actorId: r.actor_id,
            summary: r.summary,
            details: r.details,
          }) satisfies ActivityDto,
      ),
      unavailableSections: ['orders', 'finance'],
    };
  }
}
