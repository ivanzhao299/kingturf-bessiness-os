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
    expect(ordered.at(-1)).toBe('0047_atomic_role_segregation_guards.sql');
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
  it('adds atomic company roles with explicit segregation of critical duties', async () => {
    const sql = await readFile(
      join(process.cwd(), 'migrations/0046_atomic_business_role_catalog.sql'),
      'utf8',
    );
    for (const role of [
      'KT_QUOTE_EDITOR',
      'KT_QUOTE_APPROVER',
      'KT_QUOTE_ISSUER',
      'KT_CREDIT_ANALYST',
      'KT_CREDIT_APPROVER',
      'KT_QUALITY_INSPECTOR',
      'KT_QUALITY_MANAGER',
      'KT_IAM_ADMIN',
      'KT_SYSTEM_AUDITOR',
    ])
      expect(sql).toContain(`('${role}'`);
    expect(sql).toContain("('KT_QUOTE_EDITOR','quote:create')");
    expect(sql).not.toContain("('KT_QUOTE_EDITOR','quote:approve')");
    expect(sql).not.toContain("('KT_QUOTE_APPROVER','quote:create')");
    expect(sql).toContain("('KT_CREDIT_ANALYST','credit:evaluate')");
    expect(sql).not.toContain("('KT_CREDIT_ANALYST','credit:approve')");
    expect(sql).toContain("('KT_QUALITY_INSPECTOR','quality:inspect')");
    expect(sql).not.toContain("('KT_QUALITY_INSPECTOR','quality:disposition')");
    expect(sql).toContain("ARRAY['COMPANY']::data_scope[]");
    expect(sql).not.toMatch(
      /KT_(SYSTEM_AUDITOR|EXECUTIVE_VIEWER)'\s*,\s*'[^']+:(manage|create|update|approve|issue|sign|post|pay|move|inspect|disposition)'/u,
    );
  });
  it('enforces critical atomic-role conflicts in PostgreSQL', async () => {
    const sql = await readFile(
      join(process.cwd(), 'migrations/0047_atomic_role_segregation_guards.sql'),
      'utf8',
    );
    expect(sql).toContain('CREATE TABLE atomic_role_conflicts');
    expect(sql).toContain('CREATE TRIGGER employee_role_assignments_segregation');
    expect(sql).toContain('segregation of duties conflict');
    for (const conflict of [
      'KT_QUOTE_APPROVER',
      'KT_CREDIT_ANALYST',
      'KT_CASHIER',
      'KT_QUALITY_INSPECTOR',
    ])
      expect(sql).toContain(conflict);
  });
  it('uses effective quality disposition for planning, inventory, and production', async () => {
    const sql = await readFile(
      join(process.cwd(), 'migrations/0044_quality_inventory_integration.sql'),
      'utf8',
    );
    expect(sql).toContain('inventory_lot_effective_quality');
    expect(sql).toContain('inventory_lot_quality_base_immutable');
    expect(sql).toContain('production issue requires released BOM material');
  });
  it('adds versioned inspection plans, typed results, disposition ledgers, and lot quality state', async () => {
    const sql = await readFile(
      join(process.cwd(), 'migrations/0043_quality_wms_foundation.sql'),
      'utf8',
    );
    for (const table of [
      'quality_inspection_plans',
      'quality_inspection_plan_versions',
      'quality_plan_characteristics',
      'quality_inspections',
      'quality_inspection_events',
      'quality_inspection_results',
      'inventory_lot_quality_events',
    ])
      expect(sql).toContain(`CREATE TABLE ${table}`);
    expect(sql).toContain('inspection completion requires all mandatory results');
    expect(sql).toContain('numeric inspection pass result must match specification limits');
    expect(sql).toContain('failed inspection cannot release lot');
    expect(sql).toContain('quality evidence is immutable');
    expect(sql).toContain("'traceability:read'");
  });
  it('adds immutable production orders, material movements, operation reports, and rolls', async () => {
    const sql = await readFile(
      join(process.cwd(), 'migrations/0041_production_execution_foundation.sql'),
      'utf8',
    );
    for (const table of [
      'production_orders',
      'production_order_operations',
      'production_order_events',
      'production_material_transactions',
      'production_operation_reports',
      'production_rolls',
    ])
      expect(sql).toContain(`CREATE TABLE ${table}`);
    expect(sql).toContain('production order event sequence must be contiguous');
    expect(sql).toContain('production material transaction must match its inventory movement');
    expect(sql).toContain('reported good quantity exceeds planned production quantity');
    expect(sql).toContain('pg_advisory_xact_lock');
    expect(sql).toContain('production execution evidence is immutable');
    expect(sql).toContain("'production:close'");
  });
  it('hardens operation completion and atomically received serialized output', async () => {
    const sql = await readFile(
      join(process.cwd(), 'migrations/0042_production_execution_integrity.sql'),
      'utf8',
    );
    expect(sql).toContain('operation reporting requires an active order');
    expect(sql).toContain('production issue requires released BOM material');
    expect(sql).toContain(
      'production completion requires planned good quantity at every operation',
    );
    expect(sql).toContain('production close requires serialized finished quantity');
    expect(sql).toContain('finished roll must match its inventory receipt');
  });
  it('adds a versioned commission policy and immutable state ledger', async () => {
    const sql = await readFile(
      join(process.cwd(), 'migrations/0031_commission_engine_immutable_ledger.sql'),
      'utf8',
    );
    for (const table of [
      'commission_policies',
      'commission_policy_versions',
      'commission_cases',
      'commission_ledger_entries',
    ])
      expect(sql).toContain(`CREATE TABLE ${table}`);
    for (const state of ['ACCRUED', 'FROZEN', 'RELEASED', 'PAID', 'CLAWED_BACK', 'CANCELLED'])
      expect(sql).toContain(`'${state}'`);
    expect(sql).toContain('commission ledger sequence is not contiguous');
    expect(sql).toContain('commission evidence is immutable');
    expect(sql).toContain("'commission:pay'");
  });
  it('adds immutable versioned risk evaluations and responsibility task events', async () => {
    const sql = await readFile(join(process.cwd(), 'migrations/0033_risk_engine_v1.sql'), 'utf8');
    for (const table of [
      'risk_policies',
      'risk_policy_versions',
      'risk_evaluations',
      'risk_tasks',
      'risk_task_events',
    ])
      expect(sql).toContain(`CREATE TABLE ${table}`);
    for (const state of ['OPEN', 'ACKNOWLEDGED', 'ESCALATED', 'CLOSED'])
      expect(sql).toContain(`'${state}'`);
    expect(sql).toContain('risk task event sequence is not contiguous');
    expect(sql).toContain('risk task closure requires evidence');
    const repair = await readFile(
      join(process.cwd(), 'migrations/0034_risk_governance_repairs.sql'),
      'utf8',
    );
    expect(repair).toContain('risk policy versions only allow DRAFT to PUBLISHED transition');
    expect(repair).toContain('risk_policy_one_published_effective_version');
  });
  it('adds versioned SKU, BOM, substitute, and routing master data', async () => {
    const sql = await readFile(
      join(process.cwd(), 'migrations/0036_manufacturing_master_data.sql'),
      'utf8',
    );
    for (const table of [
      'manufacturing_items',
      'manufacturing_item_versions',
      'manufacturing_boms',
      'manufacturing_bom_versions',
      'manufacturing_bom_lines',
      'manufacturing_bom_substitutes',
      'manufacturing_routings',
      'manufacturing_routing_versions',
      'manufacturing_routing_operations',
    ])
      expect(sql).toContain(`CREATE TABLE ${table}`);
    expect(sql).toContain(
      'BOM publication requires published product, component, and substitute versions',
    );
    expect(sql).toContain(
      'routing publication requires a published product version and operations',
    );
    expect(sql).toContain('manufacturing publication cannot alter version content');
    expect(sql).toContain('published manufacturing child rows are immutable');
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
  it('repairs company scope for production system administrators', async () => {
    const sql = await readFile(
      join(process.cwd(), 'migrations/0045_system_admin_commercial_company_scope.sql'),
      'utf8',
    );
    expect(sql).toContain("ARRAY['SUPER_ADMIN', 'SYSTEM_ADMIN']");
    expect(sql).toContain("array_append(grant_row.data_scopes, 'COMPANY'::data_scope)");
    expect(sql).toContain("'cost-model:manage'");
    expect(sql).toContain("'sales-policy:manage'");
    expect(sql).not.toContain("'cost:evaluate'");
  });
  it('establishes procurement evidence and an append-only lot inventory ledger', async () => {
    const sql = await readFile(
      join(process.cwd(), 'migrations/0037_procurement_inventory_ledger.sql'),
      'utf8',
    );
    for (const invariant of [
      'CREATE TABLE suppliers',
      'CREATE TABLE supplier_item_qualifications',
      'CREATE TABLE procurement_rfqs',
      'CREATE TABLE supplier_quotes',
      'CREATE TABLE purchase_orders',
      'CREATE TABLE goods_receipts',
      'CREATE TABLE inventory_lots',
      'CREATE TABLE inventory_movements',
      'CREATE VIEW inventory_balances',
      'procurement and inventory evidence is immutable',
      'issued purchase order lines are immutable',
      "'inventory:move'",
    ])
      expect(sql).toContain(invariant);
    expect(sql).not.toMatch(/UPDATE inventory_movements|DELETE FROM inventory_movements/iu);
  });
  it('hardens document transitions, receipt pins, and non-negative lot balances', async () => {
    const sql = await readFile(
      join(process.cwd(), 'migrations/0038_procurement_inventory_integrity.sql'),
      'utf8',
    );
    for (const invariant of [
      'issued RFQ lines are immutable',
      'purchase order content is immutable',
      'closed purchase order is immutable',
      'receipt line must match purchase order item, lot, and order',
      'inventory movement item must match lot',
      'inventory movement cannot create negative lot balance',
      'inventory_movements_sequence_unique',
    ])
      expect(sql).toContain(invariant);
  });
  it('adds immutable explainable MRP calculations and approval ledgers', async () => {
    const sql = await readFile(
      join(process.cwd(), 'migrations/0039_mrp_planning_foundation.sql'),
      'utf8',
    );
    for (const invariant of [
      'CREATE TABLE mrp_planning_policies',
      'CREATE TABLE mrp_demand_signals',
      'CREATE TABLE mrp_runs',
      'CREATE TABLE mrp_item_calculations',
      'CREATE TABLE mrp_proposals',
      'CREATE TABLE mrp_proposal_events',
      'computed MRP evidence is immutable',
      'proposal event sequence must be contiguous',
      'frozen proposal approval requires override evidence',
      "'mrp:approve'",
    ])
      expect(sql).toContain(invariant);
  });
  it('hardens MRP policies, demands, runs, and decision run state append-only', async () => {
    const sql = await readFile(
      join(process.cwd(), 'migrations/0040_mrp_integrity_hardening.sql'),
      'utf8',
    );
    for (const invariant of [
      'mrp_planning_policy_immutable',
      'mrp_demand_signal_immutable',
      'mrp_run_delete_forbidden',
      'proposal decisions require a computed active MRP run',
    ])
      expect(sql).toContain(invariant);
  });
});
