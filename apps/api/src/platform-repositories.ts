import { createHash } from 'node:crypto';
import type { Database, SqlClient } from '@kingturf/database';
import {
  DomainError,
  evaluateRule,
  sanitizeAuditMetadata,
  validateRuleExpression,
  validateWorkflowSpec,
  type Actor,
  type ScopeAnchor,
  type WorkflowSpec,
} from '@kingturf/domain';
import type {
  AuditEventDto,
  AuditEventFilter,
  JsonObject,
  NumberAllocationDto,
  ResetPeriod,
  RuleEvaluationDto,
  DataScope,
} from '@kingturf/types';

export class TransactionalAuditWriter {
  public async write(
    tx: SqlClient,
    input: Readonly<{
      actor: Actor;
      action: string;
      targetType: string;
      targetId: string;
      correlationId: string;
      metadata?: unknown;
      allowedMetadata?: readonly string[];
    }>,
  ): Promise<void> {
    const metadata = sanitizeAuditMetadata(input.metadata ?? {}, input.allowedMetadata ?? []);
    await tx.query(
      "INSERT INTO audit_events(action,outcome,actor_id,organization_id,target_type,target_id,correlation_id,metadata) VALUES($1,'SUCCESS',$2,$3,$4,$5,$6,$7)",
      [
        input.action,
        input.actor.employeeId,
        input.actor.companyId,
        input.targetType,
        input.targetId,
        input.correlationId,
        metadata,
      ],
    );
  }
}
type AuditRow = {
  id: string;
  occurred_at: Date;
  action: string;
  outcome: 'SUCCESS' | 'FAILURE';
  actor_id: string | null;
  organization_id: string | null;
  target_type: string | null;
  target_id: string | null;
  correlation_id: string;
  metadata: JsonObject;
};
const auditDto = (r: AuditRow): AuditEventDto => ({
  id: r.id,
  occurredAt: r.occurred_at.toISOString(),
  action: r.action,
  outcome: r.outcome,
  actorId: r.actor_id,
  tenantId: r.organization_id,
  targetType: r.target_type,
  targetId: r.target_id,
  correlationId: r.correlation_id,
  metadata: r.metadata,
});
export class PostgresAuditRepository {
  public constructor(private readonly db: Database) {}
  private scopePredicate(
    scopes: readonly DataScope[],
    actorId: string,
    anchors: readonly ScopeAnchor[],
    offset: number,
  ) {
    if (scopes.includes('GROUP') || scopes.includes('COMPANY'))
      return { sql: 'TRUE', values: [] as unknown[] };
    const clauses: string[] = [],
      values: unknown[] = [];
    if (scopes.includes('SELF')) {
      values.push(actorId);
      clauses.push(`a.actor_id=$${String(offset + values.length)}`);
    }
    for (const anchor of anchors) {
      if (!anchor.organizationId || !['TEAM', 'DEPARTMENT', 'REGION'].includes(anchor.scope))
        continue;
      values.push(anchor.organizationId);
      clauses.push(
        `EXISTS(SELECT 1 FROM employees ae JOIN organization_scope_relationships osr ON osr.descendant_id=ae.organization_id WHERE ae.id=a.actor_id AND osr.ancestor_id=$${String(offset + values.length)}${anchor.scope === 'TEAM' ? ' AND osr.depth<=1' : ''})`,
      );
    }
    return { sql: clauses.length ? `(${clauses.join(' OR ')})` : 'FALSE', values };
  }
  public async find(
    id: string,
    tenantId: string,
    scopes: readonly DataScope[],
    actorId: string,
    anchors: readonly ScopeAnchor[],
  ): Promise<AuditEventDto | null> {
    const scope = this.scopePredicate(scopes, actorId, anchors, 2);
    const r = (
      await this.db.query<AuditRow>(
        `SELECT a.* FROM audit_events a WHERE a.id=$1 AND a.organization_id=$2 AND ${scope.sql}`,
        [id, tenantId, ...scope.values],
      )
    ).rows[0];
    return r ? auditDto(r) : null;
  }
  public async list(
    tenantId: string,
    filter: AuditEventFilter,
    scopes: readonly DataScope[],
    actorId: string,
    anchors: readonly ScopeAnchor[],
  ): Promise<Readonly<{ items: readonly AuditEventDto[]; nextCursor: string | null }>> {
    const values: unknown[] = [tenantId];
    const scope = this.scopePredicate(scopes, actorId, anchors, 1);
    values.push(...scope.values);
    const clauses = ['a.organization_id=$1', scope.sql];
    const add = (sql: string, v: unknown): void => {
      values.push(v);
      clauses.push(`${sql}$${String(values.length)}`);
    };
    if (filter.actorId) add('actor_id=', filter.actorId);
    if (filter.action) add('action=', filter.action);
    if (filter.targetType) add('target_type=', filter.targetType);
    if (filter.targetId) add('target_id=', filter.targetId);
    if (filter.correlationId) add('correlation_id=', filter.correlationId);
    if (filter.from) add('occurred_at>=', filter.from);
    if (filter.to) add('occurred_at<', filter.to);
    if (filter.cursor) add('id<', filter.cursor);
    const limit = Math.min(Math.max(filter.limit ?? 50, 1), 100);
    values.push(limit + 1);
    const rows = (
      await this.db.query<AuditRow>(
        `SELECT a.* FROM audit_events a WHERE ${clauses.join(' AND ')} ORDER BY a.occurred_at DESC,a.id DESC LIMIT $${String(values.length)}`,
        values,
      )
    ).rows;
    return {
      items: rows.slice(0, limit).map(auditDto),
      nextCursor: rows.length > limit ? (rows[limit - 1]?.id ?? null) : null,
    };
  }
}

export class PostgresMasterDataRepository {
  public constructor(
    private readonly db: Database,
    private readonly audit = new TransactionalAuditWriter(),
  ) {}
  public async createCategory(
    input: Readonly<{
      code: string;
      name: string;
      description: string | null;
      effectiveFrom: string;
      effectiveTo: string | null;
    }>,
    actor: Actor,
    correlationId: string,
  ) {
    return this.db.transaction(async (tx) => {
      const identity = (
        await tx.query<{ id: string }>(
          'INSERT INTO master_categories(tenant_id,code,created_by) VALUES($1,$2,$3) RETURNING id',
          [actor.companyId, input.code, actor.employeeId],
        )
      ).rows[0];
      if (!identity) throw new DomainError('conflict', 'Category exists');
      const row = (
        await tx.query(
          'INSERT INTO master_category_versions(tenant_id,category_id,version,name,description,effective_from,effective_to,created_by) VALUES($1,$2,1,$3,$4,$5,$6,$7) RETURNING *',
          [
            actor.companyId,
            identity.id,
            input.name,
            input.description,
            input.effectiveFrom,
            input.effectiveTo,
            actor.employeeId,
          ],
        )
      ).rows[0];
      await this.audit.write(tx, {
        actor,
        action: 'master-data.category.create',
        targetType: 'master-category',
        targetId: identity.id,
        correlationId,
        metadata: { code: input.code, version: 1 },
        allowedMetadata: ['code', 'version'],
      });
      return row;
    });
  }
  public async updateCategory(
    id: string,
    input: Readonly<{
      name: string;
      description: string | null;
      effectiveFrom: string;
      effectiveTo: string | null;
      version: number;
    }>,
    actor: Actor,
    correlationId: string,
  ) {
    return this.db.transaction(async (tx) => {
      const bumped = (
        await tx.query<{ version: number }>(
          'UPDATE master_categories SET version=version+1 WHERE id=$1 AND tenant_id=$2 AND version=$3 AND deleted_at IS NULL RETURNING version',
          [id, actor.companyId, input.version],
        )
      ).rows[0];
      if (!bumped) throw new DomainError('conflict', 'Category version is stale or unavailable');
      const row = (
        await tx.query(
          'INSERT INTO master_category_versions(tenant_id,category_id,version,name,description,effective_from,effective_to,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',
          [
            actor.companyId,
            id,
            bumped.version,
            input.name,
            input.description,
            input.effectiveFrom,
            input.effectiveTo,
            actor.employeeId,
          ],
        )
      ).rows[0];
      await this.audit.write(tx, {
        actor,
        action: 'master-data.category.update',
        targetType: 'master-category',
        targetId: id,
        correlationId,
        metadata: { version: bumped.version },
        allowedMetadata: ['version'],
      });
      return row;
    });
  }
  public async deleteCategory(
    id: string,
    version: number,
    actor: Actor,
    correlationId: string,
  ): Promise<void> {
    await this.db.transaction(async (tx) => {
      const r = await tx.query(
        'UPDATE master_categories SET deleted_at=now(),version=version+1 WHERE id=$1 AND tenant_id=$2 AND version=$3 AND deleted_at IS NULL',
        [id, actor.companyId, version],
      );
      if (r.rowCount !== 1)
        throw new DomainError('conflict', 'Category version is stale or unavailable');
      await this.audit.write(tx, {
        actor,
        action: 'master-data.category.delete',
        targetType: 'master-category',
        targetId: id,
        correlationId,
      });
    });
  }
  public async listCategories(tenantId: string, at = new Date()) {
    return (
      await this.db.query(
        'SELECT c.id,c.code,c.version,c.deleted_at,v.id version_id,v.name,v.description,v.effective_from,v.effective_to FROM master_categories c JOIN LATERAL(SELECT * FROM master_category_versions v WHERE v.category_id=c.id AND v.tenant_id=$1 AND v.effective_from<=$2 AND (v.effective_to IS NULL OR v.effective_to>$2) ORDER BY v.version DESC LIMIT 1)v ON true WHERE c.tenant_id=$1 AND c.deleted_at IS NULL ORDER BY c.code',
        [tenantId, at],
      )
    ).rows;
  }
  public async createEntry(
    input: Readonly<{
      categoryId: string;
      code: string;
      label: string;
      value: JsonObject;
      effectiveFrom: string;
      effectiveTo: string | null;
    }>,
    actor: Actor,
    correlationId: string,
  ) {
    return this.db.transaction(async (tx) => {
      const identity = (
        await tx.query<{ id: string }>(
          'INSERT INTO master_entries(tenant_id,category_id,code,created_by) SELECT $1,id,$3,$4 FROM master_categories WHERE id=$2 AND tenant_id=$1 AND deleted_at IS NULL RETURNING id',
          [actor.companyId, input.categoryId, input.code, actor.employeeId],
        )
      ).rows[0];
      if (!identity) throw new DomainError('not_found', 'Category unavailable');
      const row = (
        await tx.query(
          'INSERT INTO master_entry_versions(tenant_id,entry_id,version,label,value,effective_from,effective_to,created_by) VALUES($1,$2,1,$3,$4,$5,$6,$7) RETURNING *',
          [
            actor.companyId,
            identity.id,
            input.label,
            input.value,
            input.effectiveFrom,
            input.effectiveTo,
            actor.employeeId,
          ],
        )
      ).rows[0];
      await this.audit.write(tx, {
        actor,
        action: 'master-data.entry.create',
        targetType: 'master-entry',
        targetId: identity.id,
        correlationId,
        metadata: { categoryId: input.categoryId, code: input.code },
        allowedMetadata: ['categoryId', 'code'],
      });
      return row;
    });
  }
  public async listEntries(tenantId: string, categoryId: string | null, at = new Date()) {
    return (
      await this.db.query(
        'SELECT e.id,e.category_id,e.code,e.version,v.id version_id,v.label,v.value,v.effective_from,v.effective_to FROM master_entries e JOIN LATERAL(SELECT * FROM master_entry_versions v WHERE v.entry_id=e.id AND v.tenant_id=$1 AND v.effective_from<=$3 AND (v.effective_to IS NULL OR v.effective_to>$3) ORDER BY v.version DESC LIMIT 1)v ON true WHERE e.tenant_id=$1 AND e.deleted_at IS NULL AND ($2::uuid IS NULL OR e.category_id=$2) ORDER BY e.code',
        [tenantId, categoryId, at],
      )
    ).rows;
  }
  public async findEntry(id: string, tenantId: string, at = new Date()) {
    return (
      (
        await this.db.query(
          'SELECT e.id,e.category_id,e.code,e.version,v.id version_id,v.label,v.value,v.effective_from,v.effective_to FROM master_entries e JOIN LATERAL(SELECT * FROM master_entry_versions v WHERE v.entry_id=e.id AND v.tenant_id=$2 AND v.effective_from<=$3 AND (v.effective_to IS NULL OR v.effective_to>$3) ORDER BY v.version DESC LIMIT 1)v ON true WHERE e.id=$1 AND e.tenant_id=$2 AND e.deleted_at IS NULL',
          [id, tenantId, at],
        )
      ).rows[0] ?? null
    );
  }
  public async updateEntry(
    id: string,
    input: Readonly<{
      label: string;
      value: JsonObject;
      effectiveFrom: string;
      effectiveTo: string | null;
      version: number;
    }>,
    actor: Actor,
    correlationId: string,
  ) {
    return this.db.transaction(async (tx) => {
      const bumped = (
        await tx.query<{ version: number }>(
          'UPDATE master_entries SET version=version+1 WHERE id=$1 AND tenant_id=$2 AND version=$3 AND deleted_at IS NULL RETURNING version',
          [id, actor.companyId, input.version],
        )
      ).rows[0];
      if (!bumped) throw new DomainError('conflict', 'Entry version is stale or unavailable');
      const row = (
        await tx.query(
          'INSERT INTO master_entry_versions(tenant_id,entry_id,version,label,value,effective_from,effective_to,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',
          [
            actor.companyId,
            id,
            bumped.version,
            input.label,
            input.value,
            input.effectiveFrom,
            input.effectiveTo,
            actor.employeeId,
          ],
        )
      ).rows[0];
      await this.audit.write(tx, {
        actor,
        action: 'master-data.entry.update',
        targetType: 'master-entry',
        targetId: id,
        correlationId,
        metadata: { version: bumped.version },
        allowedMetadata: ['version'],
      });
      return row;
    });
  }
  public async deleteEntry(
    id: string,
    expectedVersion: number,
    actor: Actor,
    correlationId: string,
  ): Promise<void> {
    await this.db.transaction(async (tx) => {
      const r = await tx.query(
        'UPDATE master_entries SET deleted_at=now(),version=version+1 WHERE id=$1 AND tenant_id=$2 AND version=$3 AND deleted_at IS NULL',
        [id, actor.companyId, expectedVersion],
      );
      if (r.rowCount !== 1)
        throw new DomainError('conflict', 'Entry version is stale or unavailable');
      await this.audit.write(tx, {
        actor,
        action: 'master-data.entry.delete',
        targetType: 'master-entry',
        targetId: id,
        correlationId,
      });
    });
  }
}

const period = (reset: ResetPeriod, now: Date): string => {
  const y = String(now.getUTCFullYear()),
    m = String(now.getUTCMonth() + 1).padStart(2, '0'),
    d = String(now.getUTCDate()).padStart(2, '0');
  return reset === 'NEVER'
    ? 'ALL'
    : reset === 'YEARLY'
      ? y
      : reset === 'MONTHLY'
        ? `${y}-${m}`
        : `${y}-${m}-${d}`;
};
const canonicalJson = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (typeof value === 'object' && value !== null)
    return `{${Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, nested]) => `${JSON.stringify(key)}:${canonicalJson(nested)}`)
      .join(',')}}`;
  return JSON.stringify(value);
};
const hasInputPath = (input: JsonObject, path: string): boolean => {
  let current: unknown = input;
  for (const part of path.split('.')) {
    if (
      typeof current !== 'object' ||
      current === null ||
      Array.isArray(current) ||
      !Object.hasOwn(current, part)
    )
      return false;
    current = (current as Record<string, unknown>)[part];
  }
  return true;
};
export class PostgresNumberRepository {
  public constructor(
    private readonly db: Database,
    private readonly audit = new TransactionalAuditWriter(),
  ) {}
  public async createDefinition(
    input: Readonly<{
      code: string;
      prefix: string;
      suffix: string;
      padding: number;
      startingValue: number;
      increment: number;
      resetPeriod: ResetPeriod;
    }>,
    actor: Actor,
    correlationId: string,
  ) {
    return this.db.transaction(async (tx) => {
      const d = (
        await tx.query<{ id: string }>(
          'INSERT INTO number_definitions(tenant_id,code,created_by) VALUES($1,$2,$3) RETURNING id',
          [actor.companyId, input.code, actor.employeeId],
        )
      ).rows[0];
      if (!d) throw new DomainError('conflict', 'Definition exists');
      const v = (
        await tx.query(
          'INSERT INTO number_definition_versions(tenant_id,definition_id,version,prefix,suffix,padding,starting_value,increment_by,reset,created_by) VALUES($1,$2,1,$3,$4,$5,$6,$7,$8,$9) RETURNING *',
          [
            actor.companyId,
            d.id,
            input.prefix,
            input.suffix,
            input.padding,
            input.startingValue,
            input.increment,
            input.resetPeriod,
            actor.employeeId,
          ],
        )
      ).rows[0];
      await this.audit.write(tx, {
        actor,
        action: 'number.definition.create',
        targetType: 'number-definition',
        targetId: d.id,
        correlationId,
        metadata: { code: input.code },
        allowedMetadata: ['code'],
      });
      return { id: d.id, version: v };
    });
  }
  public async publish(definitionId: string, version: number, actor: Actor, correlationId: string) {
    return this.db.transaction(async (tx) => {
      const row = (
        await tx.query(
          "UPDATE number_definition_versions v SET status='PUBLISHED',published_at=now() FROM number_definitions d WHERE v.definition_id=d.id AND v.tenant_id=d.tenant_id AND d.id=$1 AND d.tenant_id=$2 AND v.version=$3 AND v.status='DRAFT' RETURNING v.*",
          [definitionId, actor.companyId, version],
        )
      ).rows[0];
      if (!row) throw new DomainError('conflict', 'Draft definition version not found');
      await this.audit.write(tx, {
        actor,
        action: 'number.definition.publish',
        targetType: 'number-definition',
        targetId: definitionId,
        correlationId,
        metadata: { version },
        allowedMetadata: ['version'],
      });
      return row;
    });
  }
  public async createVersion(
    definitionId: string,
    input: Readonly<{
      prefix: string;
      suffix: string;
      padding: number;
      startingValue: number;
      increment: number;
      resetPeriod: ResetPeriod;
    }>,
    actor: Actor,
    correlationId: string,
  ) {
    return this.db.transaction(async (tx) => {
      const d = (
        await tx.query<{ version: number }>(
          'UPDATE number_definitions SET version=version+1 WHERE id=$1 AND tenant_id=$2 AND deleted_at IS NULL RETURNING version',
          [definitionId, actor.companyId],
        )
      ).rows[0];
      if (!d) throw new DomainError('not_found', 'Number definition not found');
      const row = (
        await tx.query(
          'INSERT INTO number_definition_versions(tenant_id,definition_id,version,prefix,suffix,padding,starting_value,increment_by,reset,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *',
          [
            actor.companyId,
            definitionId,
            d.version,
            input.prefix,
            input.suffix,
            input.padding,
            input.startingValue,
            input.increment,
            input.resetPeriod,
            actor.employeeId,
          ],
        )
      ).rows[0];
      await this.audit.write(tx, {
        actor,
        action: 'number.definition.version.create',
        targetType: 'number-definition',
        targetId: definitionId,
        correlationId,
        metadata: { version: d.version },
        allowedMetadata: ['version'],
      });
      return row;
    });
  }
  public async allocate(
    definitionId: string,
    idempotencyKey: string,
    actor: Actor,
    correlationId: string,
    now = new Date(),
  ): Promise<NumberAllocationDto> {
    if (!idempotencyKey || idempotencyKey.length > 200)
      throw new DomainError('invalid_request', 'A bounded idempotency key is required');
    return this.db.transaction(async (tx) => {
      const v = (
        await tx.query<{
          id: string;
          prefix: string;
          suffix: string;
          padding: number;
          starting_value: string;
          increment_by: string;
          reset: ResetPeriod;
        }>(
          "SELECT v.id,v.prefix,v.suffix,v.padding,v.starting_value,v.increment_by,v.reset FROM number_definition_versions v JOIN number_definitions d ON d.id=v.definition_id AND d.tenant_id=v.tenant_id WHERE d.id=$1 AND d.tenant_id=$2 AND d.deleted_at IS NULL AND v.status='PUBLISHED' ORDER BY v.version DESC LIMIT 1 FOR UPDATE OF v",
          [definitionId, actor.companyId],
        )
      ).rows[0];
      if (!v) throw new DomainError('not_found', 'Published number definition not found');
      const existing = (
        await tx.query<{
          id: string;
          definition_version_id: string;
          period_key: string;
          sequence_value: string;
          rendered_value: string;
          requester_id: string;
          correlation_id: string;
          issued_at: Date;
        }>(
          'SELECT * FROM issued_numbers WHERE tenant_id=$1 AND definition_version_id=$2 AND idempotency_key=$3',
          [actor.companyId, v.id, idempotencyKey],
        )
      ).rows[0];
      if (existing)
        return {
          id: existing.id,
          definitionVersionId: existing.definition_version_id,
          period: existing.period_key,
          sequence: Number(existing.sequence_value),
          value: existing.rendered_value,
          requesterId: existing.requester_id,
          correlationId: existing.correlation_id,
          issuedAt: existing.issued_at.toISOString(),
        };
      const key = period(v.reset, now);
      const counter = (
        await tx.query<{ sequence_value: string }>(
          `INSERT INTO number_counters(tenant_id,definition_version_id,period_key,next_value) VALUES($1,$2,$3,$4::bigint+$5::bigint) ON CONFLICT(tenant_id,definition_version_id,period_key) DO UPDATE SET next_value=number_counters.next_value+$5::bigint RETURNING next_value-$5::bigint sequence_value`,
          [actor.companyId, v.id, key, v.starting_value, v.increment_by],
        )
      ).rows[0];
      if (!counter) throw new DomainError('conflict', 'Number allocation failed');
      const rendered = `${v.prefix}${counter.sequence_value.padStart(v.padding, '0')}${v.suffix}`;
      const row = (
        await tx.query<{ id: string; issued_at: Date }>(
          'INSERT INTO issued_numbers(tenant_id,definition_version_id,period_key,sequence_value,rendered_value,requester_id,idempotency_key,correlation_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id,issued_at',
          [
            actor.companyId,
            v.id,
            key,
            counter.sequence_value,
            rendered,
            actor.employeeId,
            idempotencyKey,
            correlationId,
          ],
        )
      ).rows[0];
      if (!row) throw new DomainError('conflict', 'Number allocation failed');
      await this.audit.write(tx, {
        actor,
        action: 'number.allocate',
        targetType: 'issued-number',
        targetId: row.id,
        correlationId,
        metadata: {
          definitionVersionId: v.id,
          period: key,
          sequence: Number(counter.sequence_value),
        },
        allowedMetadata: ['definitionVersionId', 'period', 'sequence'],
      });
      return {
        id: row.id,
        definitionVersionId: v.id,
        period: key,
        sequence: Number(counter.sequence_value),
        value: rendered,
        requesterId: actor.employeeId,
        correlationId,
        issuedAt: row.issued_at.toISOString(),
      };
    });
  }
}

export class PostgresRuleRepository {
  public constructor(
    private readonly db: Database,
    private readonly audit = new TransactionalAuditWriter(),
  ) {}
  public async create(
    input: Readonly<{ code: string; ast: unknown; requiredInputs: readonly string[] }>,
    actor: Actor,
    correlationId: string,
  ) {
    const ast = validateRuleExpression(input.ast);
    return this.db.transaction(async (tx) => {
      const d = (
        await tx.query<{ id: string }>(
          'INSERT INTO rule_definitions(tenant_id,code,created_by) VALUES($1,$2,$3) RETURNING id',
          [actor.companyId, input.code, actor.employeeId],
        )
      ).rows[0];
      if (!d) throw new DomainError('conflict', 'Rule exists');
      const row = (
        await tx.query(
          'INSERT INTO rule_definition_versions(tenant_id,definition_id,version,ast,required_inputs,created_by) VALUES($1,$2,1,$3,$4,$5) RETURNING *',
          [actor.companyId, d.id, ast, input.requiredInputs, actor.employeeId],
        )
      ).rows[0];
      await this.audit.write(tx, {
        actor,
        action: 'rule.definition.create',
        targetType: 'rule-definition',
        targetId: d.id,
        correlationId,
        metadata: { code: input.code },
        allowedMetadata: ['code'],
      });
      return { id: d.id, version: row };
    });
  }
  public async publish(definitionId: string, version: number, actor: Actor, correlationId: string) {
    return this.db.transaction(async (tx) => {
      const row = (
        await tx.query(
          "UPDATE rule_definition_versions v SET status='PUBLISHED',published_at=now() FROM rule_definitions d WHERE v.definition_id=d.id AND d.id=$1 AND d.tenant_id=$2 AND v.version=$3 AND v.status='DRAFT' RETURNING v.*",
          [definitionId, actor.companyId, version],
        )
      ).rows[0];
      if (!row) throw new DomainError('conflict', 'Draft rule version not found');
      await this.audit.write(tx, {
        actor,
        action: 'rule.definition.publish',
        targetType: 'rule-definition',
        targetId: definitionId,
        correlationId,
        metadata: { version },
        allowedMetadata: ['version'],
      });
      return row;
    });
  }
  public async createVersion(
    definitionId: string,
    input: Readonly<{ ast: unknown; requiredInputs: readonly string[] }>,
    actor: Actor,
    correlationId: string,
  ) {
    const ast = validateRuleExpression(input.ast);
    return this.db.transaction(async (tx) => {
      const d = (
        await tx.query<{ version: number }>(
          'UPDATE rule_definitions SET version=version+1 WHERE id=$1 AND tenant_id=$2 AND deleted_at IS NULL RETURNING version',
          [definitionId, actor.companyId],
        )
      ).rows[0];
      if (!d) throw new DomainError('not_found', 'Rule definition not found');
      const row = (
        await tx.query(
          'INSERT INTO rule_definition_versions(tenant_id,definition_id,version,ast,required_inputs,created_by) VALUES($1,$2,$3,$4,$5,$6) RETURNING *',
          [actor.companyId, definitionId, d.version, ast, input.requiredInputs, actor.employeeId],
        )
      ).rows[0];
      await this.audit.write(tx, {
        actor,
        action: 'rule.definition.version.create',
        targetType: 'rule-definition',
        targetId: definitionId,
        correlationId,
        metadata: { version: d.version },
        allowedMetadata: ['version'],
      });
      return row;
    });
  }
  public async evaluate(
    definitionId: string,
    input: JsonObject,
    idempotencyKey: string,
    actor: Actor,
    correlationId: string,
  ): Promise<RuleEvaluationDto> {
    return this.db.transaction(async (tx) => {
      const version = (
        await tx.query<{ id: string; ast: unknown; required_inputs: string[] }>(
          "SELECT v.id,v.ast,v.required_inputs FROM rule_definition_versions v JOIN rule_definitions d ON d.id=v.definition_id AND d.tenant_id=v.tenant_id WHERE d.id=$1 AND d.tenant_id=$2 AND d.deleted_at IS NULL AND v.status='PUBLISHED' ORDER BY v.version DESC LIMIT 1",
          [definitionId, actor.companyId],
        )
      ).rows[0];
      if (!version) throw new DomainError('not_found', 'Published rule not found');
      await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
        `rule:${actor.companyId}:${version.id}:${idempotencyKey}`,
      ]);
      const existing = (
        await tx.query<{
          id: string;
          rule_version_id: string;
          input_hash: string;
          decision: boolean;
          trace: readonly JsonObject[];
          evaluated_at: Date;
          correlation_id: string;
        }>(
          'SELECT id,rule_version_id,input_hash,decision,trace,evaluated_at,correlation_id FROM rule_evaluations WHERE tenant_id=$1 AND rule_version_id=$2 AND idempotency_key=$3',
          [actor.companyId, version.id, idempotencyKey],
        )
      ).rows[0];
      if (existing)
        return {
          id: existing.id,
          ruleVersionId: existing.rule_version_id,
          inputHash: existing.input_hash,
          decision: existing.decision,
          trace: existing.trace,
          evaluatedAt: existing.evaluated_at.toISOString(),
          correlationId: existing.correlation_id,
        };
      const normalized = canonicalJson(input);
      const hash = createHash('sha256').update(normalized).digest('hex');
      const result = version.required_inputs.every((path) => hasInputPath(input, path))
        ? evaluateRule(validateRuleExpression(version.ast), input)
        : { decision: false, trace: [{ op: 'default-deny', result: false }] };
      const row = (
        await tx.query<{ id: string; evaluated_at: Date }>(
          'INSERT INTO rule_evaluations(tenant_id,rule_version_id,input,input_hash,decision,trace,actor_id,idempotency_key,correlation_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id,evaluated_at',
          [
            actor.companyId,
            version.id,
            JSON.stringify(input),
            hash,
            result.decision,
            JSON.stringify(result.trace),
            actor.employeeId,
            idempotencyKey,
            correlationId,
          ],
        )
      ).rows[0];
      if (!row) throw new DomainError('conflict', 'Rule evaluation failed');
      await this.audit.write(tx, {
        actor,
        action: 'rule.evaluate',
        targetType: 'rule-evaluation',
        targetId: row.id,
        correlationId,
        metadata: { ruleVersionId: version.id, inputHash: hash, decision: result.decision },
        allowedMetadata: ['ruleVersionId', 'inputHash', 'decision'],
      });
      return {
        id: row.id,
        ruleVersionId: version.id,
        inputHash: hash,
        decision: result.decision,
        trace: result.trace,
        evaluatedAt: row.evaluated_at.toISOString(),
        correlationId,
      };
    });
  }
}

export class PostgresWorkflowRepository {
  public constructor(
    private readonly db: Database,
    private readonly audit = new TransactionalAuditWriter(),
  ) {}
  public async create(
    input: Readonly<{ code: string; spec: WorkflowSpec }>,
    actor: Actor,
    correlationId: string,
  ) {
    const spec = validateWorkflowSpec(input.spec);
    return this.db.transaction(async (tx) => {
      const d = (
        await tx.query<{ id: string }>(
          'INSERT INTO workflow_definitions(tenant_id,code,created_by) VALUES($1,$2,$3) RETURNING id',
          [actor.companyId, input.code, actor.employeeId],
        )
      ).rows[0];
      if (!d) throw new DomainError('conflict', 'Workflow exists');
      const row = (
        await tx.query(
          'INSERT INTO workflow_definition_versions(tenant_id,definition_id,version,spec,created_by) VALUES($1,$2,1,$3,$4) RETURNING *',
          [actor.companyId, d.id, spec, actor.employeeId],
        )
      ).rows[0];
      await this.audit.write(tx, {
        actor,
        action: 'workflow.definition.create',
        targetType: 'workflow-definition',
        targetId: d.id,
        correlationId,
        metadata: { code: input.code },
        allowedMetadata: ['code'],
      });
      return { id: d.id, version: row };
    });
  }
  public async createVersion(
    id: string,
    specInput: WorkflowSpec,
    actor: Actor,
    correlationId: string,
  ) {
    const spec = validateWorkflowSpec(specInput);
    return this.db.transaction(async (tx) => {
      const d = (
        await tx.query<{ version: number }>(
          'UPDATE workflow_definitions SET version=version+1 WHERE id=$1 AND tenant_id=$2 AND deleted_at IS NULL RETURNING version',
          [id, actor.companyId],
        )
      ).rows[0];
      if (!d) throw new DomainError('not_found', 'Workflow definition not found');
      const row = (
        await tx.query(
          'INSERT INTO workflow_definition_versions(tenant_id,definition_id,version,spec,created_by) VALUES($1,$2,$3,$4,$5) RETURNING *',
          [actor.companyId, id, d.version, spec, actor.employeeId],
        )
      ).rows[0];
      await this.audit.write(tx, {
        actor,
        action: 'workflow.definition.version.create',
        targetType: 'workflow-definition',
        targetId: id,
        correlationId,
        metadata: { version: d.version },
        allowedMetadata: ['version'],
      });
      return row;
    });
  }
  public async publish(id: string, expectedVersion: number, actor: Actor, correlationId: string) {
    return this.db.transaction(async (tx) => {
      const draft = (
        await tx.query<{ spec: WorkflowSpec }>(
          "SELECT v.spec FROM workflow_definition_versions v JOIN workflow_definitions d ON d.id=v.definition_id AND d.tenant_id=v.tenant_id WHERE d.id=$1 AND d.tenant_id=$2 AND v.version=$3 AND v.status='DRAFT' FOR UPDATE OF v",
          [id, actor.companyId, expectedVersion],
        )
      ).rows[0];
      if (!draft) throw new DomainError('conflict', 'Draft workflow version not found');
      const eligibleActors = [...new Set(draft.spec.steps.flatMap((step) => step.eligibleActors))];
      if (eligibleActors.length) {
        const found = await tx.query(
          'SELECT id FROM employees WHERE company_id=$1 AND active AND deleted_at IS NULL AND id=ANY($2::uuid[])',
          [actor.companyId, eligibleActors],
        );
        if (found.rowCount !== eligibleActors.length)
          throw new DomainError('invalid_request', 'Workflow contains an unavailable actor');
      }
      const eligibleRoles = [...new Set(draft.spec.steps.flatMap((step) => step.eligibleRoles))];
      if (eligibleRoles.length) {
        const found = await tx.query(
          'SELECT code FROM roles WHERE organization_id=$1 AND deleted_at IS NULL AND code=ANY($2::text[])',
          [actor.companyId, eligibleRoles],
        );
        if (found.rowCount !== eligibleRoles.length)
          throw new DomainError('invalid_request', 'Workflow contains an unavailable role');
      }
      const row = (
        await tx.query(
          "UPDATE workflow_definition_versions v SET status='PUBLISHED',published_at=now() FROM workflow_definitions d WHERE v.definition_id=d.id AND d.id=$1 AND d.tenant_id=$2 AND v.version=$3 AND v.status='DRAFT' RETURNING v.*",
          [id, actor.companyId, expectedVersion],
        )
      ).rows[0];
      if (!row) throw new DomainError('conflict', 'Draft workflow version not found');
      await this.audit.write(tx, {
        actor,
        action: 'workflow.definition.publish',
        targetType: 'workflow-definition',
        targetId: id,
        correlationId,
        metadata: { version: expectedVersion },
        allowedMetadata: ['version'],
      });
      return row;
    });
  }
  public async start(
    definitionId: string,
    subjectType: string,
    subjectId: string,
    idempotencyKey: string,
    actor: Actor,
    correlationId: string,
  ) {
    return this.db.transaction(async (tx) => {
      const v = (
        await tx.query<{ id: string; spec: WorkflowSpec }>(
          "SELECT v.id,v.spec FROM workflow_definition_versions v JOIN workflow_definitions d ON d.id=v.definition_id AND d.tenant_id=v.tenant_id WHERE d.id=$1 AND d.tenant_id=$2 AND d.deleted_at IS NULL AND v.status='PUBLISHED' ORDER BY v.version DESC LIMIT 1",
          [definitionId, actor.companyId],
        )
      ).rows[0];
      if (!v) throw new DomainError('not_found', 'Published workflow not found');
      await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
        `workflow-start:${actor.companyId}:${v.id}:${idempotencyKey}`,
      ]);
      const previous = (
        await tx.query(
          'SELECT * FROM workflow_instances WHERE tenant_id=$1 AND definition_version_id=$2 AND idempotency_key=$3',
          [actor.companyId, v.id, idempotencyKey],
        )
      ).rows[0];
      if (previous) return previous;
      const instance = (
        await tx.query<{ id: string }>(
          'INSERT INTO workflow_instances(tenant_id,definition_version_id,state,requester_id,subject_type,subject_id,idempotency_key,correlation_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',
          [
            actor.companyId,
            v.id,
            v.spec.initialState,
            actor.employeeId,
            subjectType,
            subjectId,
            idempotencyKey,
            correlationId,
          ],
        )
      ).rows[0];
      if (!instance) throw new DomainError('conflict', 'Workflow start failed');
      const step = v.spec.steps[0];
      if (!step) throw new DomainError('invalid_request', 'Workflow requires a step');
      const assignee = step.eligibleActors[0];
      const role = step.eligibleRoles[0];
      await tx.query(
        "INSERT INTO workflow_tasks(tenant_id,instance_id,step_key,status,assigned_actor_id,assigned_role_code) VALUES($1,$2,$3,'OPEN',$4,$5)",
        [actor.companyId, instance.id, step.key, assignee ?? null, assignee ? null : role],
      );
      await tx.query(
        "INSERT INTO workflow_transitions(tenant_id,instance_id,from_state,to_state,actor_id,reason,correlation_id) VALUES($1,$2,NULL,$3,$4,'started',$5)",
        [actor.companyId, instance.id, v.spec.initialState, actor.employeeId, correlationId],
      );
      await this.audit.write(tx, {
        actor,
        action: 'workflow.instance.start',
        targetType: 'workflow-instance',
        targetId: instance.id,
        correlationId,
        metadata: { definitionVersionId: v.id },
        allowedMetadata: ['definitionVersionId'],
      });
      return instance;
    });
  }
  public async listTasks(actor: Actor) {
    return (
      await this.db.query(
        "SELECT t.* FROM workflow_tasks t WHERE t.tenant_id=$1 AND t.status IN('OPEN','CLAIMED') AND (t.assigned_actor_id=$2 OR (t.assigned_role_code IS NOT NULL AND EXISTS(SELECT 1 FROM employee_role_assignments era JOIN roles r ON r.id=era.role_id WHERE era.employee_id=$2 AND r.organization_id=$1 AND r.code=t.assigned_role_code AND r.deleted_at IS NULL))) ORDER BY t.created_at",
        [actor.companyId, actor.employeeId],
      )
    ).rows;
  }
  public async decide(
    taskId: string,
    decision: string,
    comment: string | null,
    idempotencyKey: string,
    expectedVersion: number,
    actor: Actor,
    correlationId: string,
  ) {
    return this.db.transaction(async (tx) => {
      await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
        `workflow-decision:${actor.companyId}:${taskId}:${idempotencyKey}`,
      ]);
      const prior = (
        await tx.query(
          'SELECT d.* FROM workflow_decisions d JOIN workflow_tasks t ON t.id=d.task_id AND t.tenant_id=d.tenant_id WHERE d.tenant_id=$1 AND d.task_id=$2 AND d.idempotency_key=$3 AND d.actor_id=$4 AND d.decision=$5 AND d.comment IS NOT DISTINCT FROM $6 AND (t.assigned_actor_id=$4 OR (t.assigned_role_code IS NOT NULL AND EXISTS(SELECT 1 FROM employee_role_assignments era JOIN roles r ON r.id=era.role_id WHERE era.employee_id=$4 AND r.organization_id=$1 AND r.code=t.assigned_role_code AND r.deleted_at IS NULL)))',
          [actor.companyId, taskId, idempotencyKey, actor.employeeId, decision, comment],
        )
      ).rows[0];
      if (prior) return prior;
      const task = (
        await tx.query<{ instance_id: string; step_key: string }>(
          "UPDATE workflow_tasks t SET status='DECIDED',version=version+1,claimed_by=$3 WHERE t.id=$1 AND t.tenant_id=$2 AND t.version=$4 AND t.status IN('OPEN','CLAIMED') AND (t.assigned_actor_id=$3 OR (t.assigned_role_code IS NOT NULL AND EXISTS(SELECT 1 FROM employee_role_assignments era JOIN roles r ON r.id=era.role_id WHERE era.employee_id=$3 AND r.organization_id=$2 AND r.code=t.assigned_role_code AND r.deleted_at IS NULL))) RETURNING instance_id,step_key",
          [taskId, actor.companyId, actor.employeeId, expectedVersion],
        )
      ).rows[0];
      if (!task) throw new DomainError('conflict', 'Task is stale, unavailable, or not assigned');
      const state = (
        await tx.query<{ state: string; spec: WorkflowSpec }>(
          'SELECT i.state,v.spec FROM workflow_instances i JOIN workflow_definition_versions v ON v.id=i.definition_version_id AND v.tenant_id=i.tenant_id WHERE i.id=$1 AND i.tenant_id=$2 FOR UPDATE OF i',
          [task.instance_id, actor.companyId],
        )
      ).rows[0];
      if (!state) throw new DomainError('not_found', 'Workflow instance not found');
      const transition = state.spec.transitions.find(
        (t) => t.from === state.state && t.decision === decision,
      );
      if (!transition)
        throw new DomainError('invalid_request', 'Decision is not valid for current state');
      const row = (
        await tx.query(
          'INSERT INTO workflow_decisions(tenant_id,task_id,actor_id,decision,comment,idempotency_key,correlation_id) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *',
          [
            actor.companyId,
            taskId,
            actor.employeeId,
            decision,
            comment,
            idempotencyKey,
            correlationId,
          ],
        )
      ).rows[0];
      await tx.query(
        'UPDATE workflow_instances SET state=$3,version=version+1,completed_at=CASE WHEN $3=ANY($4::text[]) THEN now() ELSE completed_at END WHERE id=$1 AND tenant_id=$2',
        [task.instance_id, actor.companyId, transition.to, state.spec.terminalStates],
      );
      if (!state.spec.terminalStates.includes(transition.to)) {
        const currentIndex = state.spec.steps.findIndex((step) => step.key === task.step_key);
        const nextStep = state.spec.steps[currentIndex + 1];
        if (!nextStep)
          throw new DomainError(
            'invalid_request',
            'A non-terminal transition requires a subsequent workflow step',
          );
        const assignedActor = nextStep.eligibleActors[0];
        await tx.query(
          "INSERT INTO workflow_tasks(tenant_id,instance_id,step_key,status,assigned_actor_id,assigned_role_code) VALUES($1,$2,$3,'OPEN',$4,$5)",
          [
            actor.companyId,
            task.instance_id,
            nextStep.key,
            assignedActor ?? null,
            assignedActor ? null : nextStep.eligibleRoles[0],
          ],
        );
      }
      await tx.query(
        'INSERT INTO workflow_transitions(tenant_id,instance_id,from_state,to_state,actor_id,reason,correlation_id) VALUES($1,$2,$3,$4,$5,$6,$7)',
        [
          actor.companyId,
          task.instance_id,
          state.state,
          transition.to,
          actor.employeeId,
          decision,
          correlationId,
        ],
      );
      await this.audit.write(tx, {
        actor,
        action: 'workflow.task.decide',
        targetType: 'workflow-task',
        targetId: taskId,
        correlationId,
        metadata: { decision, toState: transition.to },
        allowedMetadata: ['decision', 'toState'],
      });
      return row;
    });
  }
}
