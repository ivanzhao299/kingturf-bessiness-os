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
import type {
  ActivityDto,
  ContactDto,
  Customer360Dto,
  CustomerDto,
  DataScope,
  JsonObject,
  LeadDto,
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
const scope = (
  scopes: readonly DataScope[],
  anchors: readonly ScopeAnchor[],
  actor: Actor,
  alias: string,
  start: number,
  includeUnownedPool = false,
) => {
  if (scopes.includes('GROUP') || scopes.includes('COMPANY'))
    return { sql: 'TRUE', values: [] as unknown[] };
  const clauses: string[] = [];
  const values: unknown[] = [];
  const p = (v: unknown) => {
    values.push(v);
    return `$${String(start + values.length - 1)}`;
  };
  if (scopes.includes('SELF')) clauses.push(`${alias}.owner_id=${p(actor.employeeId)}`);
  if (includeUnownedPool && scopes.includes('SELF'))
    clauses.push(`(${alias}.status='POOL' AND ${alias}.owner_id IS NULL)`);
  for (const a of anchors)
    if (a.organizationId && ['TEAM', 'DEPARTMENT', 'REGION'].includes(a.scope)) {
      const anchorId = p(a.organizationId);
      const depth = a.scope === 'TEAM' ? ' AND scoped.depth<=1' : '';
      clauses.push(
        `EXISTS (SELECT 1 FROM organizations anchor JOIN organization_scope_relationships scoped ON scoped.ancestor_id=anchor.id AND scoped.descendant_id=${alias}.owner_organization_id${depth} WHERE anchor.id=${anchorId} AND anchor.owner_organization_id=${alias}.tenant_id AND anchor.organization_type='${a.scope}' AND anchor.active AND anchor.deleted_at IS NULL)`,
      );
    }
  return { sql: clauses.length ? `(${clauses.join(' OR ')})` : 'FALSE', values };
};
async function auditEvent(
  tx: SqlClient,
  action: string,
  actor: Actor,
  type: string,
  id: string,
  correlationId: string,
  version: number,
  payload: Record<string, unknown>,
  eventAggregate: Readonly<{ type: string; id: string; version: number }> = {
    type,
    id,
    version,
  },
) {
  await tx.query(
    "INSERT INTO audit_events(action,outcome,actor_id,organization_id,target_type,target_id,correlation_id,metadata) VALUES($1,'SUCCESS',$2,$3,$4,$5,$6,$7)",
    [action, actor.employeeId, actor.companyId, type, id, correlationId, payload],
  );
  await tx.query(
    'INSERT INTO domain_event_outbox(tenant_id,event_type,event_version,aggregate_type,aggregate_id,aggregate_version,occurred_at,actor_id,correlation_id,payload) VALUES($1,$2,1,$3,$4,$5,now(),$6,$7,$8)',
    [
      actor.companyId,
      action,
      eventAggregate.type,
      eventAggregate.id,
      eventAggregate.version,
      actor.employeeId,
      correlationId,
      payload,
    ],
  );
}
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
    const authorized = scope(scopes, anchors, actor, alias, 3, includeUnownedPool);
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
    const s = scope(scopes, anchors, actor, 'c', 2);
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
    const s = scope(scopes, anchors, actor, 'c', 3);
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
    const authorized = scope(scopes, anchors, actor, 'l', 2, pool);
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
      ? scope(sections.leads.scopes, sections.leads.anchors, actor, 'l', 3)
      : null;
    const [contacts, ownership, leads, activities] = await Promise.all([
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
