import { randomUUID } from 'node:crypto';
import { appendFile, cp, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Database, migrate, migrationsDirectory, migrationStatus } from '../src/index.js';

const connectionString = process.env.DATABASE_URL;
if (!connectionString)
  throw new Error('DATABASE_URL is required; PostgreSQL integration tests may not be skipped');
const schema = `database_integrity_${randomUUID().replaceAll('-', '')}`;
let admin: Database;
let database: Database;
function getTestDatabase(): Database {
  return database;
}

describe('PostgreSQL tenant integrity', () => {
  const companyA = randomUUID();
  const companyB = randomUUID();
  const departmentA = randomUUID();
  const departmentB = randomUUID();
  const employee = randomUUID();
  const region = randomUUID();
  const department = randomUUID();
  const team = randomUUID();
  const childTeam = randomUUID();
  const teamLeaf = randomUUID();
  const scopedEmployee = randomUUID();
  const permission = randomUUID();

  beforeAll(async () => {
    admin = new Database(connectionString);
    await admin.query(`CREATE SCHEMA ${schema}`);
    const scoped = new URL(connectionString);
    scoped.searchParams.set('options', `-csearch_path=${schema}`);
    database = new Database(scoped.toString());
    await migrate(getTestDatabase());
    await getTestDatabase().query(
      "INSERT INTO organizations(id,code,name,organization_type) VALUES($1,'COMPANY-A','Company A','COMPANY'),($2,'COMPANY-B','Company B','COMPANY')",
      [companyA, companyB],
    );
    await getTestDatabase().query(
      "INSERT INTO organizations(id,owner_organization_id,code,name,organization_type) VALUES($1,$2,'DEPT-A','Department A','DEPARTMENT'),($3,$4,'DEPT-B','Department B','DEPARTMENT')",
      [departmentA, companyA, departmentB, companyB],
    );
    await getTestDatabase().query(
      "INSERT INTO employees(id,company_id,organization_id,employee_number,display_name,normalized_email) VALUES($1,$2,$3,'E-1','Employee','employee@example.test')",
      [employee, companyA, departmentA],
    );
    await getTestDatabase().query(
      "INSERT INTO organizations(id,owner_organization_id,parent_id,code,name,organization_type) VALUES($1,$6,NULL,'REGION-A','Region A','REGION'),($2,$6,$1,'DEPARTMENT-A2','Department A2','DEPARTMENT'),($3,$6,$2,'TEAM-A','Team A','TEAM'),($4,$6,$3,'TEAM-A-CHILD','Child Team A','TEAM'),($5,$6,$4,'TEAM-A-LEAF','Leaf Team A','TEAM')",
      [region, department, team, childTeam, teamLeaf, companyA],
    );
    await getTestDatabase().query(
      "INSERT INTO employees(id,company_id,organization_id,employee_number,display_name,normalized_email) VALUES($1,$2,$3,'E-SCOPE','Scoped Employee','scoped@example.test')",
      [scopedEmployee, companyA, teamLeaf],
    );
  });
  afterAll(async () => {
    await getTestDatabase().query('DELETE FROM data_scope_grants WHERE employee_id=$1', [employee]);
    await getTestDatabase().query('DELETE FROM permissions WHERE id=$1', [permission]);
    await getTestDatabase().query('DELETE FROM employees WHERE id=ANY($1::uuid[])', [
      [employee, scopedEmployee],
    ]);
    await getTestDatabase().query(
      'DELETE FROM organization_scope_relationships WHERE ancestor_id=ANY($1::uuid[]) OR descendant_id=ANY($1::uuid[])',
      [
        [
          teamLeaf,
          childTeam,
          team,
          department,
          region,
          departmentA,
          departmentB,
          companyA,
          companyB,
        ],
      ],
    );
    await getTestDatabase().query('DELETE FROM organizations WHERE id=ANY($1::uuid[])', [
      [teamLeaf, childTeam, team, department, region, departmentA, departmentB, companyA, companyB],
    ]);
    await getTestDatabase().close();
    await admin.query(`DROP SCHEMA ${schema} CASCADE`);
    await admin.close();
  });

  it('rejects a cross-company parent on INSERT', async () => {
    await expect(
      getTestDatabase().query(
        "INSERT INTO organizations(owner_organization_id,parent_id,code,name,organization_type) VALUES($1,$2,'BAD-PARENT','Bad Parent','DEPARTMENT')",
        [companyA, departmentB],
      ),
    ).rejects.toThrow(/parent must share organization ownership/u);
  });
  it('rejects moving an employee organization across companies', async () => {
    await expect(
      getTestDatabase().query('UPDATE employees SET organization_id=$1 WHERE id=$2', [
        departmentB,
        employee,
      ]),
    ).rejects.toThrow();
  });
  it('maintains closure through multi-level reparenting and rejects cycles', async () => {
    const initial = await getTestDatabase().query<{ depth: number }>(
      'SELECT depth FROM organization_scope_relationships WHERE ancestor_id=$1 AND descendant_id=$2',
      [region, childTeam],
    );
    expect(initial.rows[0]?.depth).toBe(3);
    await expect(
      getTestDatabase().query('UPDATE organizations SET parent_id=$1 WHERE id=$2', [
        teamLeaf,
        region,
      ]),
    ).rejects.toThrow(/organization hierarchy cycle/u);
    await getTestDatabase().query('UPDATE organizations SET parent_id=NULL WHERE id=$1', [
      department,
    ]);
    expect(
      (
        await getTestDatabase().query(
          'SELECT 1 FROM organization_scope_relationships WHERE ancestor_id=$1 AND descendant_id=$2',
          [region, childTeam],
        )
      ).rowCount,
    ).toBe(0);
    expect(
      (
        await getTestDatabase().query<{ depth: number }>(
          'SELECT depth FROM organization_scope_relationships WHERE ancestor_id=$1 AND descendant_id=$2',
          [department, childTeam],
        )
      ).rows[0]?.depth,
    ).toBe(2);
  });
  it('enforces persisted semantics and anchor rules for every DataScope', async () => {
    await getTestDatabase().query(
      "INSERT INTO permissions(id,capability,description) VALUES($1,'test-scope:read','Exercise scope persistence')",
      [permission],
    );
    const valid: [string, string | null][] = [
      ['SELF', null],
      ['TEAM', team],
      ['DEPARTMENT', department],
      ['REGION', region],
      ['COMPANY', null],
      ['GROUP', null],
    ];
    for (const [scope, anchor] of valid)
      await getTestDatabase().query(
        'INSERT INTO data_scope_grants(employee_id,permission_id,scope,scope_organization_id) VALUES($1,$2,$3::data_scope,$4)',
        [employee, permission, scope, anchor],
      );
    const persisted = await getTestDatabase().query<{
      scope: string;
      scope_organization_id: string | null;
    }>(
      'SELECT scope,scope_organization_id FROM data_scope_grants WHERE employee_id=$1 AND permission_id=$2 ORDER BY scope',
      [employee, permission],
    );
    expect(persisted.rows).toEqual([
      { scope: 'SELF', scope_organization_id: null },
      { scope: 'TEAM', scope_organization_id: team },
      { scope: 'DEPARTMENT', scope_organization_id: department },
      { scope: 'REGION', scope_organization_id: region },
      { scope: 'COMPANY', scope_organization_id: null },
      { scope: 'GROUP', scope_organization_id: null },
    ]);
    const visible = await getTestDatabase().query<{ id: string }>(
      "SELECT e.id FROM employees e JOIN data_scope_grants d ON d.employee_id=$1 AND d.permission_id=$2 AND d.scope='TEAM' JOIN organization_scope_relationships osr ON osr.ancestor_id=d.scope_organization_id AND osr.descendant_id=e.organization_id AND osr.depth<=1 WHERE e.company_id=$3",
      [employee, permission, companyA],
    );
    expect(visible.rows.map((row) => row.id)).not.toContain(scopedEmployee);
    for (const scope of ['TEAM', 'DEPARTMENT', 'REGION'])
      await expect(
        getTestDatabase().query(
          'INSERT INTO data_scope_grants(employee_id,permission_id,scope,scope_organization_id) VALUES($1,$2,$3::data_scope,NULL)',
          [scopedEmployee, permission, scope],
        ),
      ).rejects.toThrow(/requires an organization anchor/u);
    for (const scope of ['SELF', 'COMPANY', 'GROUP'])
      await expect(
        getTestDatabase().query(
          'INSERT INTO data_scope_grants(employee_id,permission_id,scope,scope_organization_id) VALUES($1,$2,$3::data_scope,$4)',
          [scopedEmployee, permission, scope, team],
        ),
      ).rejects.toThrow(/may not specify an organization anchor/u);
    await expect(
      getTestDatabase().query(
        "INSERT INTO data_scope_grants(employee_id,permission_id,scope,scope_organization_id) VALUES($1,$2,'TEAM',$3)",
        [employee, permission, departmentB],
      ),
    ).rejects.toThrow(/scope organization must share tenant ownership/u);
    await expect(
      getTestDatabase().query(
        "INSERT INTO data_scope_grants(employee_id,permission_id,scope,scope_organization_id) VALUES($1,$2,'SELF',NULL)",
        [employee, permission],
      ),
    ).rejects.toThrow(/duplicate key/u);
  });
  it('makes business audit events immutable with correlation and timestamp', async () => {
    const audit = randomUUID();
    const correlation = randomUUID();
    await getTestDatabase().query(
      "INSERT INTO audit_events(id,action,outcome,actor_id,organization_id,target_type,target_id,correlation_id) VALUES($1,'organization.update','SUCCESS',$2,$3,'organization',$4,$5)",
      [audit, employee, companyA, department, correlation],
    );
    const row = await getTestDatabase().query<{ correlation_id: string; occurred_at: Date }>(
      'SELECT correlation_id,occurred_at FROM audit_events WHERE id=$1',
      [audit],
    );
    expect(row.rows[0]?.correlation_id).toBe(correlation);
    expect(row.rows[0]?.occurred_at).toBeInstanceOf(Date);
    await expect(
      getTestDatabase().query("UPDATE audit_events SET outcome='FAILURE' WHERE id=$1", [audit]),
    ).rejects.toThrow(/audit events are immutable/u);
    await expect(
      getTestDatabase().query('DELETE FROM audit_events WHERE id=$1', [audit]),
    ).rejects.toThrow(/audit events are immutable/u);
  });
  it('detects a changed stored migration checksum', async () => {
    const original = (
      await getTestDatabase().query<{ checksum: string }>(
        'SELECT checksum FROM schema_migrations WHERE name=$1',
        ['0001_identity_authorization_foundation.sql'],
      )
    ).rows[0]?.checksum;
    expect(original).toBeTruthy();
    try {
      await getTestDatabase().query(
        "UPDATE schema_migrations SET checksum=repeat('0',64) WHERE name=$1",
        ['0001_identity_authorization_foundation.sql'],
      );
      expect(
        (await migrationStatus(getTestDatabase())).find(
          (item) => item.name === '0001_identity_authorization_foundation.sql',
        )?.state,
      ).toBe('drifted');
    } finally {
      await getTestDatabase().query('UPDATE schema_migrations SET checksum=$2 WHERE name=$1', [
        '0001_identity_authorization_foundation.sql',
        original,
      ]);
    }
  });
  it('rejects modified historical bytes when a legacy checksum is NULL', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'kingturf-migrations-'));
    const name = '0001_identity_authorization_foundation.sql';
    const original = (
      await getTestDatabase().query<{ checksum: string }>(
        'SELECT checksum FROM schema_migrations WHERE name=$1',
        [name],
      )
    ).rows[0]?.checksum;
    expect(original).toBeTruthy();
    try {
      await cp(migrationsDirectory, directory, { recursive: true });
      await appendFile(join(directory, name), '\n-- deliberate historical drift\n', 'utf8');
      await getTestDatabase().query(
        'ALTER TABLE schema_migrations ALTER COLUMN checksum DROP NOT NULL',
      );
      await getTestDatabase().query('UPDATE schema_migrations SET checksum=NULL WHERE name=$1', [
        name,
      ]);
      await expect(migrate(getTestDatabase(), directory)).rejects.toThrow(
        `Migration integrity check failed: ${name}`,
      );
      expect(
        (
          await getTestDatabase().query<{ checksum: string | null }>(
            'SELECT checksum FROM schema_migrations WHERE name=$1',
            [name],
          )
        ).rows[0]?.checksum,
      ).toBeNull();
    } finally {
      await getTestDatabase().query('UPDATE schema_migrations SET checksum=$2 WHERE name=$1', [
        name,
        original,
      ]);
      await getTestDatabase().query(
        'ALTER TABLE schema_migrations ALTER COLUMN checksum SET NOT NULL',
      );
      await rm(directory, { recursive: true, force: true });
    }
  });
});

describe('PostgreSQL 0004 upgrade compatibility', () => {
  it('reconciles historical unanchored duplicates before enforcing uniqueness', async () => {
    const upgradeSchema = `database_upgrade_${randomUUID().replaceAll('-', '')}`;
    const directory = await mkdtemp(join(tmpdir(), 'kingturf-upgrade-migrations-'));
    const upgradeAdmin = new Database(connectionString);
    let upgradeDatabase: Database | undefined;
    try {
      for (const name of [
        '0001_identity_authorization_foundation.sql',
        '0002_tenant_integrity.sql',
        '0003_identity_authorization_hardening.sql',
      ])
        await cp(join(migrationsDirectory, name), join(directory, name));

      await upgradeAdmin.query(`CREATE SCHEMA ${upgradeSchema}`);
      const scoped = new URL(connectionString);
      scoped.searchParams.set('options', `-csearch_path=${upgradeSchema}`);
      upgradeDatabase = new Database(scoped.toString());
      await migrate(upgradeDatabase, directory);

      const company = '10000000-0000-4000-8000-000000000001';
      const employee = '20000000-0000-4000-8000-000000000001';
      const permission = '30000000-0000-4000-8000-000000000001';
      const earliestId = '40000000-0000-4000-8000-000000000003';
      const canonicalId = '40000000-0000-4000-8000-000000000001';
      const laterId = '40000000-0000-4000-8000-000000000002';
      await upgradeDatabase.query(
        "INSERT INTO organizations(id,owner_organization_id,code,name,organization_type) VALUES($1,$1,'UPGRADE','Upgrade','COMPANY')",
        [company],
      );
      await upgradeDatabase.query(
        "INSERT INTO employees(id,company_id,organization_id,employee_number,display_name,normalized_email) VALUES($1,$2,$2,'UP-1','Upgrade Employee','upgrade@example.test')",
        [employee, company],
      );
      await upgradeDatabase.query(
        "INSERT INTO permissions(id,capability,description) VALUES($1,'employee:read','Read')",
        [permission],
      );
      await upgradeDatabase.query(
        `INSERT INTO data_scope_grants(id,employee_id,permission_id,scope,scope_organization_id,created_at) VALUES
         ($1,$4,$5,'SELF',NULL,'2025-01-01T00:00:00Z'),
         ($2,$4,$5,'SELF',NULL,'2025-01-01T00:00:00Z'),
         ($3,$4,$5,'SELF',NULL,'2025-01-02T00:00:00Z')`,
        [earliestId, canonicalId, laterId, employee, permission],
      );

      await cp(
        join(migrationsDirectory, '0004_authorization_integrity_completion.sql'),
        join(directory, '0004_authorization_integrity_completion.sql'),
      );
      await migrate(upgradeDatabase, directory);

      const remaining = await upgradeDatabase.query<{ id: string }>(
        "SELECT id FROM data_scope_grants WHERE employee_id=$1 AND permission_id=$2 AND scope='SELF'",
        [employee, permission],
      );
      expect(remaining.rows).toEqual([{ id: canonicalId }]);
      expect(
        (
          await upgradeDatabase.query<{ name: string }>(
            'SELECT name FROM schema_migrations WHERE name=$1',
            ['0004_authorization_integrity_completion.sql'],
          )
        ).rows,
      ).toEqual([{ name: '0004_authorization_integrity_completion.sql' }]);
      await expect(
        upgradeDatabase.query(
          "INSERT INTO data_scope_grants(employee_id,permission_id,scope,scope_organization_id) VALUES($1,$2,'SELF',NULL)",
          [employee, permission],
        ),
      ).rejects.toThrow(/duplicate key/u);
    } finally {
      try {
        await upgradeDatabase?.close();
      } finally {
        try {
          await upgradeAdmin.query(`DROP SCHEMA IF EXISTS ${upgradeSchema} CASCADE`);
        } finally {
          try {
            await upgradeAdmin.close();
          } finally {
            await rm(directory, { recursive: true, force: true });
          }
        }
      }
    }
  });
});
