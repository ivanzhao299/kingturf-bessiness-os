import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { assertTestDatabaseTarget } from '../src/index.js';

describe('CI database target safety', () => {
  it('accepts only explicit loopback test databases', () => {
    expect(() => {
      assertTestDatabaseTarget('postgresql://user:pass@localhost:5432/kingturf_test', 'test');
    }).not.toThrow();
    expect(() => {
      assertTestDatabaseTarget('postgresql://user:pass@db.example.com/kingturf_test', 'test');
    }).toThrow(/Refusing CI database target/u);
    expect(() => {
      assertTestDatabaseTarget('postgresql://user:pass@localhost/kingturf', 'test');
    }).toThrow(/Refusing CI database target/u);
    expect(() => {
      assertTestDatabaseTarget('postgresql://user:pass@localhost/kingturf_test', 'production');
    }).toThrow(/Refusing CI database target/u);
  });
});

describe('identity and authorization migration', () => {
  it('contains every foundational boundary and no later-engine tables', async () => {
    const sql = await readFile(
      join(process.cwd(), 'migrations/0001_identity_authorization_foundation.sql'),
      'utf8',
    );
    for (const table of [
      'organizations',
      'employees',
      'identities',
      'sessions',
      'roles',
      'permissions',
      'data_scope_grants',
      'audit_events',
    ]) {
      expect(sql).toContain(`CREATE TABLE ${table}`);
    }
    expect(sql).toContain("'SELF','TEAM','DEPARTMENT','REGION','COMPANY','GROUP'");
    expect(sql).not.toMatch(/CREATE TABLE (sales|manufacturing|orders)/u);
  });
  it('adds insert-time hierarchy and employee tenant constraints', async () => {
    const sql = await readFile(join(process.cwd(), 'migrations/0002_tenant_integrity.sql'), 'utf8');
    expect(sql).toContain('BEFORE INSERT OR UPDATE ON organizations');
    expect(sql).toContain('FOREIGN KEY (organization_id, company_id)');
    expect(sql).toContain('REFERENCES organizations(id, owner_organization_id)');
  });
  it('hardens closure, checksums, tenant grants, and immutable audit events append-only', async () => {
    const sql = await readFile(
      join(process.cwd(), 'migrations/0003_identity_authorization_hardening.sql'),
      'utf8',
    );
    expect(sql).toContain('maintain_organization_scope_relationships');
    expect(sql).toContain('organization hierarchy cycle');
    expect(sql).toContain('scope organization must share tenant ownership');
    expect(sql).toContain('audit events are immutable');
    expect(sql).toContain('checksum char(64)');
  });
  it('completes closure rebuilding and active typed scope validation append-only', async () => {
    const sql = await readFile(
      join(process.cwd(), 'migrations/0004_authorization_integrity_completion.sql'),
      'utf8',
    );
    expect(sql).toContain('DELETE FROM organization_scope_relationships');
    expect(sql).toContain('organization hierarchy cycle');
    expect(sql).toContain('scope organization type does not match scope');
    expect(sql).toContain('scope organization must be active');
    expect(sql).toContain('data_scope_grants_unanchored_unique');
    expect(sql).toContain('WHERE scope_organization_id IS NULL');
    expect(sql).toContain('PARTITION BY employee_id, permission_id, scope');
    expect(sql).toContain('ORDER BY created_at, id');
    expect(sql).toContain('ranked.duplicate_rank > 1');
    expect(sql.indexOf('ranked.duplicate_rank > 1')).toBeLessThan(
      sql.indexOf('CREATE UNIQUE INDEX data_scope_grants_unanchored_unique'),
    );
    expect(sql).toContain('reject_audit_event_mutation');
  });
  it('adds immutable tenant-scoped platform engines append-only', async () => {
    const sql = await readFile(
      join(process.cwd(), 'migrations/0005_business_platform_foundations.sql'),
      'utf8',
    );
    for (const table of [
      'master_categories',
      'master_entry_versions',
      'number_counters',
      'issued_numbers',
      'workflow_instances',
      'workflow_decisions',
      'rule_definition_versions',
      'rule_evaluations',
    ])
      expect(sql).toContain(`CREATE TABLE ${table}`);
    expect(sql).toContain('reject_immutable_row_mutation');
    expect(sql).toContain('UNIQUE(tenant_id,rendered_value)');
    expect(sql).not.toMatch(/\b(eval|Function|dynamic import)\s*\(/u);
  });
  it('hardens workflow integrity and published delete protection append-only', async () => {
    const sql = await readFile(
      join(process.cwd(), 'migrations/0006_platform_engine_integrity.sql'),
      'utf8',
    );
    expect(sql).toContain('protect_number_published_delete');
    expect(sql).toContain('protect_workflow_published_delete');
    expect(sql).toContain('protect_rule_published_delete');
    expect(sql).toContain('workflow separation of duties violation');
    expect(sql).toContain('workflow tenant boundary violation');
    expect(sql).toContain('CREATE INDEX workflow_task_queue_idx');
  });
  it('adds E12-E15 tenant-safe append-only foundations', async () => {
    const directory = join(process.cwd(), 'migrations');
    const eventSql = await readFile(
      join(directory, '0007_event_notification_foundations.sql'),
      'utf8',
    );
    expect(eventSql).toContain('domain_event_claim_idx');
    expect(eventSql).toContain('domain_event_outbox');
    expect(eventSql).toContain('notification_recipients');
    const attachmentSql = await readFile(join(directory, '0008_attachment_foundation.sql'), 'utf8');
    expect(attachmentSql).toContain('opaque_key');
    expect(attachmentSql).not.toContain('bytea');
    const registrySql = await readFile(
      join(directory, '0009_business_object_registry.sql'),
      'utf8',
    );
    expect(registrySql).toContain('protect_business_object_published');
    expect(registrySql).not.toMatch(/sales|manufacturing/iu);
    const guards = await readFile(join(directory, '0010_foundation_tenant_guards.sql'), 'utf8');
    expect(guards).toContain('FOREIGN KEY(actor_id,tenant_id)');
    const hardening = await readFile(
      join(directory, '0011_foundation_review_hardening.sql'),
      'utf8',
    );
    expect(hardening).toContain("ALTER TYPE attachment_state ADD VALUE 'UPLOADING'");
    expect(hardening).toContain('event_consumer_deliveries');
    expect(hardening).toContain('consumer_name');
    const lifecycleEnum = await readFile(
      join(directory, '0012_foundation_operational_safety.sql'),
      'utf8',
    );
    expect(lifecycleEnum).toContain("ALTER TYPE attachment_state ADD VALUE 'DELETE_PENDING'");
    const operationalSafety = await readFile(
      join(directory, '0013_foundation_operational_safety_columns.sql'),
      'utf8',
    );
    expect(operationalSafety).toContain('upload_lease_until');
    expect(operationalSafety).toContain('actual_storage_key');
    expect(operationalSafety).toContain('attachments_delete_retry_idx');
    expect(operationalSafety).not.toContain('bytea');
    const eventFencing = await readFile(join(directory, '0014_event_claim_fencing.sql'), 'utf8');
    expect(eventFencing).toContain('claim_token uuid');
    expect(eventFencing).toContain('event_consumer_delivery_claim_consistent');
    const relationshipImmutability = await readFile(
      join(directory, '0015_published_relationship_immutability.sql'),
      'utf8',
    );
    expect(relationshipImmutability).toContain('business_object_relationships_published_immutable');
    expect(relationshipImmutability).toContain("status = 'PUBLISHED'");
    const reviewerHardening = await readFile(
      join(directory, '0016_notification_idempotency_and_registry_revision.sql'),
      'utf8',
    );
    expect(reviewerHardening).toContain('normalized_recipients');
    expect(reviewerHardening).toContain('semantic_payload');
    expect(reviewerHardening).toContain('ALTER COLUMN normalized_recipients SET NOT NULL');
  });
});
