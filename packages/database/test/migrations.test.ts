import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

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
});
