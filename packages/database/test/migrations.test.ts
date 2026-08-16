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
  it('adds E11-E17 only after 0025 with immutable exact-pin ledgers', async () => {
    const files = (await import('node:fs/promises')).readdir(join(process.cwd(), 'migrations'));
    const ordered = (await files).filter((name) => name.endsWith('.sql')).sort();
    expect(ordered.at(-1)).toBe('0030_qtc_order_trigger_alias_repair.sql');
    const sql = await readFile(
      join(process.cwd(), 'migrations/0026_quote_to_cash_immutable_ledger.sql'),
      'utf8',
    );
    for (const table of [
      'credit_limits',
      'credit_exposure_snapshots',
      'credit_decisions',
      'credit_approvals',
      'contract_revisions',
      'contract_signature_evidence',
      'sales_orders',
      'ar_documents',
      'ar_open_items',
      'bank_payments',
      'reconciliation_runs',
      'allocation_entries',
    ])
      expect(sql).toContain(`CREATE TABLE ${table}`);
    expect(sql).toContain('order commercial graph is stale, unapproved, unsigned, or inconsistent');
    expect(sql).toContain('credit_decision_requires_evidence');
    expect(sql).toContain('effective_credit_decisions');
    expect(sql).toContain('allocation exceeds remaining balance');
    expect(sql).toContain('CREATE VIEW ar_open_item_balances');
    expect(sql).toContain('protect_commercial_frozen_row');
    expect(sql).not.toMatch(/ALTER TABLE (quote_revisions|quote_issued_snapshots)/u);
    const repair = await readFile(
      join(process.cwd(), 'migrations/0027_quote_to_cash_governance_repairs.sql'),
      'utf8',
    );
    expect(repair).toContain('credit approval requires a current pending decision');
    expect(repair).toContain(
      'contract revision is inconsistent with its customer opportunity quote',
    );
    expect(repair).toContain('AR document is inconsistent with its sales order');
    expect(repair).toContain('sales order lines must exactly equal the pinned order total');
    const triggerRepair = await readFile(
      join(process.cwd(), 'migrations/0030_qtc_order_trigger_alias_repair.sql'),
      'utf8',
    );
    expect(triggerRepair).toContain('JOIN quotes quote_root');
    expect(triggerRepair).toContain("IF TG_TABLE_NAME='sales_orders' THEN");
    expect(triggerRepair).not.toContain('JOIN quotes q ON');
  });
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
  it('adds tenant-safe CRM customer, lead, assignment, audit, and timeline foundations', async () => {
    const sql = await readFile(
      join(process.cwd(), 'migrations/0017_crm_customer_lead_foundation.sql'),
      'utf8',
    );
    for (const table of [
      'customers',
      'customer_contacts',
      'customer_lifecycle_history',
      'customer_ownership_history',
      'leads',
      'lead_transitions',
      'crm_assignments',
      'customer_activities',
      'crm_command_results',
    ])
      expect(sql).toContain(`CREATE TABLE ${table}`);
    expect(sql).toContain('customer assignment tenant boundary violation');
    expect(sql).toContain('crm assignment history is immutable');
    expect(sql).toContain('customer ownership may only be ended once');
    expect(sql).toContain('customer_email_identity_unique');
    expect(sql).toContain('customer_phone_identity_unique');
    const correction = await readFile(
      join(process.cwd(), 'migrations/0018_customer_ownership_reassign_permission.sql'),
      'utf8',
    );
    expect(correction).toContain("'customer-ownership:reassign'");
    const contactIntegrity = await readFile(
      join(process.cwd(), 'migrations/0019_crm_contact_identity_integrity.sql'),
      'utf8',
    );
    expect(contactIntegrity).toContain('customer_contact_email_identity_valid');
    expect(contactIntegrity).toContain('customer_contact_phone_identity_valid');
  });
  it('adds the immutable commercial revision graph without executable rules', async () => {
    const sql = await readFile(
      join(process.cwd(), 'migrations/0021_commercial_sales_to_cash.sql'),
      'utf8',
    );
    for (const table of [
      'opportunities',
      'opportunity_lifecycle_history',
      'ctrs',
      'ctr_versions',
      'ctr_approvals',
      'ctr_attachment_links',
      'technical_solutions',
      'technical_solution_revisions',
      'cost_model_versions',
      'cost_sheet_decisions',
      'cost_sheet_lines',
      'sales_policy_versions',
      'sales_policy_evaluations',
      'quotes',
      'quote_revisions',
      'quote_lines',
      'quote_approvals',
      'quote_issued_snapshots',
      'commercial_command_results',
    ])
      expect(sql).toContain(`CREATE TABLE ${table}`);
    expect(sql).toContain('submitted CTR version is immutable');
    expect(sql).toContain('issued quote revision is immutable');
    expect(sql).toContain('FOREIGN KEY(cost_decision_id,tenant_id)');
    expect(sql).not.toMatch(/\beval\s*\(|\bFunction\s*\(|dynamic\s+import/iu);
  });
  it('completes commercial snapshot and child immutability in an append-only migration', async () => {
    const sql = await readFile(
      join(process.cwd(), 'migrations/0022_commercial_integrity_completion.sql'),
      'utf8',
    );
    for (const invariant of [
      'CREATE TABLE opportunity_snapshots',
      'quote_revision_opportunity_snapshot_fk',
      'published commercial definition is immutable',
      'CTR approval requires submitted version',
      'issued quote children are immutable',
      'quote_opportunity_snapshot_guard',
    ])
      expect(sql).toContain(invariant);
    expect(sql).not.toMatch(/\beval\s*\(|\bFunction\s*\(/u);
  });
  it('binds commercial retries and closes exact-pin and quote mutation gaps append-only', async () => {
    const sql = await readFile(
      join(process.cwd(), 'migrations/0023_commercial_review_hardening.sql'),
      'utf8',
    );
    for (const invariant of [
      'request_hash char(64)',
      'commercial_command_actor_fk',
      'technical solution CTR must belong to the same opportunity',
      'cost decision requires final solution revision',
      'quote cost decision must pin quoted solution',
      'quote revisions cannot be deleted',
      'quote revision pins and commercial values are immutable',
    ])
      expect(sql).toContain(invariant);
    expect(sql).not.toMatch(/\beval\s*\(|\bFunction\s*\(/u);
  });
  it('freezes CTR attachment membership at submission append-only', async () => {
    const sql = await readFile(
      join(process.cwd(), 'migrations/0024_ctr_attachment_snapshot_freeze.sql'),
      'utf8',
    );
    expect(sql).toContain('ctr_attachment_links_insert_guard');
    expect(sql).toContain("v.status='DRAFT'");
  });
  it('completes the platform permission catalog and extends super-admin grants', async () => {
    const sql = await readFile(
      join(process.cwd(), 'migrations/0028_platform_permission_catalog.sql'),
      'utf8',
    );
    for (const capability of [
      'organization:read',
      'employee:read',
      'authorization:manage',
      'audit:read',
      'master-data:read',
      'number:allocate',
      'rule:evaluate',
      'workflow:decide',
    ])
      expect(sql).toContain(`'${capability}'`);
    expect(sql).toContain("roles.code='SUPER_ADMIN'");
    expect(sql).toContain("ARRAY['GROUP']::data_scope[]");
    expect(sql).toContain('ON CONFLICT(role_id,permission_id) DO NOTHING');
  });
  it('adds company scope only to governed commercial catalogs for super administrators', async () => {
    const sql = await readFile(
      join(process.cwd(), 'migrations/0029_commercial_definition_company_scope.sql'),
      'utf8',
    );
    expect(sql).toContain("array_append(grant_row.data_scopes,'COMPANY'::data_scope)");
    expect(sql).toContain("roles.code='SUPER_ADMIN'");
    expect(sql).toContain("'cost-model:manage'");
    expect(sql).toContain("'sales-policy:manage'");
    expect(sql).not.toContain("'cost:evaluate'");
  });
});
