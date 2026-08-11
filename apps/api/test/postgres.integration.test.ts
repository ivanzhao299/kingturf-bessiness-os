import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Database, migrate } from '@kingturf/database';
import type { DataScope } from '@kingturf/types';
import {
  PostgresAuthorizationRepository,
  PostgresEmployeeRepository,
  PostgresOrganizationRepository,
  PostgresSecurityStore,
} from '../src/repositories.js';

const connectionString = process.env.DATABASE_URL;
if (!connectionString)
  throw new Error('DATABASE_URL is required; PostgreSQL integration tests may not be skipped');

describe('PostgreSQL identity and authorization behavior', () => {
  const schema = `api_auth_${randomUUID().replaceAll('-', '')}`;
  let admin: Database;
  let database: Database;
  let organizations: PostgresOrganizationRepository;
  let employees: PostgresEmployeeRepository;
  let authorization: PostgresAuthorizationRepository;
  let security: PostgresSecurityStore;

  const company = randomUUID();
  const otherCompany = randomUUID();
  const otherOrganization = randomUUID();
  const region = randomUUID();
  const department = randomUUID();
  const team = randomUUID();
  const childTeam = randomUUID();
  const deepTeam = randomUUID();
  const looseTeam = randomUUID();
  const actorId = randomUUID();
  const childId = randomUUID();
  const deepId = randomUUID();
  const looseId = randomUUID();
  const otherId = randomUUID();
  const actor = { employeeId: actorId, companyId: company } as const;

  beforeAll(async () => {
    if (!connectionString) throw new Error('DATABASE_URL is required');
    admin = new Database(connectionString);
    await admin.query(`CREATE SCHEMA ${schema}`);
    const scoped = new URL(connectionString);
    scoped.searchParams.set('options', `-csearch_path=${schema}`);
    database = new Database(scoped.toString());
    await migrate(database);
    organizations = new PostgresOrganizationRepository(database);
    employees = new PostgresEmployeeRepository(database);
    authorization = new PostgresAuthorizationRepository(database);
    security = new PostgresSecurityStore(database);

    await database.query(
      "INSERT INTO organizations(id,code,name,organization_type) VALUES($1,'ROOT','Root','COMPANY'),($2,'OTHER','Other','COMPANY')",
      [company, otherCompany],
    );
    await database.query(
      `INSERT INTO organizations(id,owner_organization_id,parent_id,code,name,organization_type) VALUES
       ($1,$7,$7,'REGION','Region','REGION'),($2,$7,$1,'DEPT','Department','DEPARTMENT'),
       ($3,$7,$2,'TEAM','Team','TEAM'),($4,$7,$3,'CHILD','Child team','TEAM'),
       ($5,$7,$4,'DEEP','Deep team','TEAM'),($6,$7,NULL,'LOOSE','Loose team','TEAM'),
       ($8,$9,NULL,'OTHER-DEPT','Other department','DEPARTMENT')`,
      [
        region,
        department,
        team,
        childTeam,
        deepTeam,
        looseTeam,
        company,
        otherOrganization,
        otherCompany,
      ],
    );
    await database.query(
      `INSERT INTO employees(id,company_id,organization_id,employee_number,display_name,normalized_email) VALUES
       ($1,$6,$7,'ACTOR','Actor','actor@example.test'),($2,$6,$8,'CHILD','Child','child@example.test'),
       ($3,$6,$9,'DEEP','Deep','deep@example.test'),($4,$6,$10,'LOOSE','Loose','loose@example.test'),
       ($5,$11,$12,'OTHER','Other','other@example.test')`,
      [
        actorId,
        childId,
        deepId,
        looseId,
        otherId,
        company,
        team,
        childTeam,
        deepTeam,
        looseTeam,
        otherCompany,
        otherOrganization,
      ],
    );
  });

  afterAll(async () => {
    await database.close();
    await admin.query(`DROP SCHEMA ${schema} CASCADE`);
    await admin.close();
  });

  it.each<[DataScope, readonly string[]]>([
    ['SELF', [actorId]],
    ['TEAM', [actorId, childId]],
    ['DEPARTMENT', [actorId, childId, deepId]],
    ['REGION', [actorId, childId, deepId]],
    ['COMPANY', [actorId, childId, deepId, looseId]],
    ['GROUP', [actorId, childId, deepId, looseId]],
  ])('enforces %s scope with tenant boundaries', async (scope, expected) => {
    const rows = await employees.list(company, [scope], actorId);
    expect(rows.map((row) => row.id).sort()).toEqual([...expected].sort());
    expect(rows.map((row) => row.id)).not.toContain(otherId);
  });

  it('fails closed when a typed actor ancestor is missing', async () => {
    expect(await employees.list(company, ['DEPARTMENT'], looseId)).toEqual([]);
    expect(await employees.list(company, ['REGION'], looseId)).toEqual([]);
  });

  it('maintains closure on create/reparent/root moves and rejects multi-level cycles', async () => {
    const createCorrelation = randomUUID();
    const updateCorrelation = randomUUID();
    const created = await organizations.create(
      {
        ownerOrganizationId: company,
        parentId: childTeam,
        code: 'CREATED',
        name: 'Created',
        locale: 'zh-CN',
        currency: 'CNY',
        active: true,
      },
      actor,
      createCorrelation,
    );
    expect(
      (
        await database.query<{ depth: number }>(
          'SELECT depth FROM organization_scope_relationships WHERE ancestor_id=$1 AND descendant_id=$2',
          [region, created.id],
        )
      ).rows[0]?.depth,
    ).toBe(4);
    await expect(
      organizations.update(region, company, { parentId: created.id }, 1, actor, randomUUID()),
    ).rejects.toThrow(/organization hierarchy cycle/u);
    const rooted = await organizations.update(
      created.id,
      company,
      { parentId: null },
      1,
      actor,
      updateCorrelation,
    );
    expect(rooted.parentId).toBeNull();
    expect(
      (
        await database.query(
          'SELECT 1 FROM organization_scope_relationships WHERE ancestor_id=$1 AND descendant_id=$2',
          [region, created.id],
        )
      ).rowCount,
    ).toBe(0);
    const audit = await database.query<{
      action: string;
      target_id: string;
      correlation_id: string;
    }>(
      'SELECT action,target_id,correlation_id FROM audit_events WHERE correlation_id=ANY($1::uuid[]) ORDER BY occurred_at,id',
      [[createCorrelation, updateCorrelation]],
    );
    expect(audit.rows).toEqual([
      { action: 'organization.create', target_id: created.id, correlation_id: createCorrelation },
      { action: 'organization.update', target_id: created.id, correlation_id: updateCorrelation },
    ]);
  });

  it('rejects cross-tenant organization updates without mutation or audit', async () => {
    const correlationId = randomUUID();
    const before = (
      await database.query<{ name: string; version: number }>(
        'SELECT name,version FROM organizations WHERE id=$1',
        [otherOrganization],
      )
    ).rows[0];
    if (!before) throw new Error('Expected company-B organization fixture');
    expect(before).toEqual({ name: 'Other department', version: 1 });

    await expect(
      organizations.update(
        otherOrganization,
        otherCompany,
        { name: 'Company A adversarial update', parentId: null, active: false },
        before.version,
        actor,
        correlationId,
      ),
    ).rejects.toMatchObject({ code: 'forbidden' });

    expect(
      (
        await database.query<{ name: string; version: number }>(
          'SELECT name,version FROM organizations WHERE id=$1',
          [otherOrganization],
        )
      ).rows[0],
    ).toEqual(before);
    expect(
      (await database.query('SELECT 1 FROM audit_events WHERE correlation_id=$1', [correlationId]))
        .rowCount,
    ).toBe(0);
  });

  it('loads and enforces persisted grants for all six DataScopes', async () => {
    const permission = randomUUID();
    const role = randomUUID();
    const identity = randomUUID();
    const tokenHash = 'a'.repeat(64);
    await database.query(
      "INSERT INTO permissions(id,capability,description) VALUES($1,'employee:read','Read')",
      [permission],
    );
    await database.query(
      "INSERT INTO roles(id,organization_id,code,name) VALUES($1,$2,'READER','Reader')",
      [role, company],
    );
    await database.query(
      "INSERT INTO role_permission_grants(role_id,permission_id,data_scopes) VALUES($1,$2,ARRAY['SELF']::data_scope[])",
      [role, permission],
    );
    await database.query(
      'INSERT INTO employee_role_assignments(employee_id,role_id) VALUES($1,$2)',
      [actorId, role],
    );
    await database.query(
      "INSERT INTO identities(id,employee_id,login_name) VALUES($1,$2,'actor-login')",
      [identity, actorId],
    );
    await database.query(
      'INSERT INTO organization_memberships(organization_id,employee_id) VALUES($1,$2)',
      [company, actorId],
    );
    await database.query(
      "INSERT INTO sessions(identity_id,organization_id,token_hash,expires_at) VALUES($1,$2,$3,now()+interval '1 hour')",
      [identity, company, tokenHash],
    );

    const cases: readonly [DataScope, string | null, readonly string[]][] = [
      ['SELF', null, [actorId]],
      ['TEAM', team, [actorId, childId]],
      ['DEPARTMENT', department, [actorId, childId, deepId]],
      ['REGION', region, [actorId, childId, deepId]],
      ['COMPANY', null, [actorId, childId, deepId, looseId]],
      ['GROUP', null, [actorId, childId, deepId, looseId]],
    ];
    for (const [scope, organizationId, expected] of cases) {
      const direct = await authorization.grantScope(
        { employeeId: actorId, permissionId: permission, scope, organizationId },
        actor,
        randomUUID(),
      );
      const context = await security.resolveSession(tokenHash, new Date());
      expect(context?.scopeAnchors?.get('employee:read')).toEqual([{ scope, organizationId }]);
      const visible = await employees.list(
        company,
        context?.permissions.get('employee:read')?.scopes ?? [],
        actorId,
        context?.scopeAnchors?.get('employee:read'),
      );
      expect(visible.map((row) => row.id).sort()).toEqual([...expected].sort());
      expect(visible.map((row) => row.id)).not.toContain(otherId);
      await authorization.revokeScope(direct.id, actor, randomUUID());
    }
    for (const scope of ['TEAM', 'DEPARTMENT', 'REGION'] as const)
      await expect(
        authorization.grantScope(
          { employeeId: actorId, permissionId: permission, scope, organizationId: null },
          actor,
          randomUUID(),
        ),
      ).rejects.toThrow(/requires an organization anchor/u);
    for (const scope of ['SELF', 'COMPANY', 'GROUP'] as const)
      await expect(
        authorization.grantScope(
          { employeeId: actorId, permissionId: permission, scope, organizationId: team },
          actor,
          randomUUID(),
        ),
      ).rejects.toThrow(/may not specify an organization anchor/u);
    expect(
      await employees.list(company, [], actorId, [
        { scope: 'TEAM', organizationId: otherOrganization },
      ]),
    ).toEqual([]);
    expect(
      await employees.list(company, [], actorId, [{ scope: 'DEPARTMENT', organizationId: team }]),
    ).toEqual([]);
  });

  it('secures tenant-owned grants and assignments and audits every mutation', async () => {
    const correlationId = randomUUID();
    const permission = await authorization.createPermission(
      { capability: 'employee:update', description: 'Update' },
      actor,
      correlationId,
    );
    const role = await authorization.createRole(
      { code: 'EDITOR', name: 'Editor' },
      actor,
      correlationId,
    );
    await authorization.grant(
      { roleId: role.id, permissionId: permission.id, scopes: ['SELF'], fields: ['displayName'] },
      actor,
      correlationId,
    );
    await authorization.assign(childId, role.id, actor, correlationId);
    await expect(authorization.assign(otherId, role.id, actor, correlationId)).rejects.toThrow();
    await authorization.unassign(childId, role.id, actor, correlationId);
    await authorization.revoke(role.id, permission.id, actor, correlationId);

    const audit = await database.query<{
      action: string;
      actor_id: string;
      organization_id: string;
      correlation_id: string;
      occurred_at: Date;
    }>(
      'SELECT action,actor_id,organization_id,correlation_id,occurred_at FROM audit_events WHERE correlation_id=$1 ORDER BY occurred_at,id',
      [correlationId],
    );
    expect(audit.rows.map((row) => row.action)).toEqual([
      'authorization.permission.create',
      'authorization.role.create',
      'authorization.grant',
      'authorization.assign',
      'authorization.unassign',
      'authorization.revoke',
    ]);
    expect(
      audit.rows.every(
        (row) =>
          row.actor_id === actorId &&
          row.organization_id === company &&
          row.correlation_id === correlationId &&
          row.occurred_at instanceof Date,
      ),
    ).toBe(true);
    await expect(
      database.query("UPDATE audit_events SET outcome='FAILURE' WHERE correlation_id=$1", [
        correlationId,
      ]),
    ).rejects.toThrow(/audit events are immutable/u);
    await expect(
      database.query('DELETE FROM audit_events WHERE correlation_id=$1', [correlationId]),
    ).rejects.toThrow(/audit events are immutable/u);
  });

  it('writes organization and employee audits atomically with target and correlation', async () => {
    const correlationId = randomUUID();
    const created = await employees.create(
      {
        companyId: company,
        organizationId: team,
        employeeNumber: `AUD-${randomUUID()}`,
        displayName: 'Audited',
        email: `${randomUUID()}@example.test`,
        active: true,
      },
      actor,
      correlationId,
    );
    await employees.update(
      created.id,
      company,
      { displayName: 'Audited update' },
      1,
      actor,
      ['COMPANY'],
      [],
      correlationId,
    );
    const audit = await database.query<{ action: string; target_id: string }>(
      'SELECT action,target_id FROM audit_events WHERE correlation_id=$1 ORDER BY occurred_at,id',
      [correlationId],
    );
    expect(audit.rows).toEqual([
      { action: 'employee.create', target_id: created.id },
      { action: 'employee.update', target_id: created.id },
    ]);
  });

  it('administers direct scope grants transactionally within the tenant', async () => {
    const correlationId = randomUUID();
    const permission = await authorization.createPermission(
      { capability: 'employee:create', description: 'Create' },
      actor,
      correlationId,
    );
    const direct = await authorization.grantScope(
      { employeeId: actorId, permissionId: permission.id, scope: 'TEAM', organizationId: team },
      actor,
      correlationId,
    );
    expect((await authorization.listScopeGrants(company)).map((row) => row.id)).toContain(
      direct.id,
    );
    await expect(
      authorization.grantScope(
        { employeeId: otherId, permissionId: permission.id, scope: 'SELF', organizationId: null },
        actor,
        correlationId,
      ),
    ).rejects.toThrow();
    await authorization.revokeScope(direct.id, actor, correlationId);
    expect(
      (await database.query('SELECT 1 FROM data_scope_grants WHERE id=$1', [direct.id])).rowCount,
    ).toBe(0);
    expect(
      (
        await database.query<{ action: string }>(
          'SELECT action FROM audit_events WHERE correlation_id=$1 ORDER BY occurred_at,id',
          [correlationId],
        )
      ).rows.map((row) => row.action),
    ).toEqual([
      'authorization.permission.create',
      'authorization.scope-grant.create',
      'authorization.scope-grant.revoke',
    ]);
  });

  it('rolls back grants, assignments, and direct grants when auditing fails', async () => {
    const setupCorrelation = randomUUID();
    const permission = await authorization.createPermission(
      { capability: 'organization:admin', description: 'Admin' },
      actor,
      setupCorrelation,
    );
    const emptyRole = await authorization.createRole(
      { code: `EMPTY-${randomUUID()}`, name: 'Empty' },
      actor,
      setupCorrelation,
    );
    const populatedRole = await authorization.createRole(
      { code: `POPULATED-${randomUUID()}`, name: 'Populated' },
      actor,
      setupCorrelation,
    );
    await authorization.grant(
      { roleId: populatedRole.id, permissionId: permission.id, scopes: ['SELF'], fields: null },
      actor,
      setupCorrelation,
    );
    await authorization.assign(childId, populatedRole.id, actor, setupCorrelation);
    const existingDirect = await authorization.grantScope(
      {
        employeeId: actorId,
        permissionId: permission.id,
        scope: 'DEPARTMENT',
        organizationId: department,
      },
      actor,
      setupCorrelation,
    );
    await database.query(
      "CREATE FUNCTION fail_test_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'deliberate audit failure'; END $$",
    );
    await database.query(
      'CREATE TRIGGER fail_test_audit BEFORE INSERT ON audit_events FOR EACH ROW EXECUTE FUNCTION fail_test_audit()',
    );
    try {
      await expect(
        authorization.grant(
          { roleId: emptyRole.id, permissionId: permission.id, scopes: ['COMPANY'], fields: null },
          actor,
          randomUUID(),
        ),
      ).rejects.toThrow(/deliberate audit failure/u);
      expect(
        (
          await database.query(
            'SELECT 1 FROM role_permission_grants WHERE role_id=$1 AND permission_id=$2',
            [emptyRole.id, permission.id],
          )
        ).rowCount,
      ).toBe(0);
      await expect(
        authorization.revoke(populatedRole.id, permission.id, actor, randomUUID()),
      ).rejects.toThrow(/deliberate audit failure/u);
      expect(
        (
          await database.query(
            'SELECT 1 FROM role_permission_grants WHERE role_id=$1 AND permission_id=$2',
            [populatedRole.id, permission.id],
          )
        ).rowCount,
      ).toBe(1);
      await expect(
        authorization.assign(looseId, emptyRole.id, actor, randomUUID()),
      ).rejects.toThrow(/deliberate audit failure/u);
      expect(
        (
          await database.query(
            'SELECT 1 FROM employee_role_assignments WHERE employee_id=$1 AND role_id=$2',
            [looseId, emptyRole.id],
          )
        ).rowCount,
      ).toBe(0);
      await expect(
        authorization.unassign(childId, populatedRole.id, actor, randomUUID()),
      ).rejects.toThrow(/deliberate audit failure/u);
      expect(
        (
          await database.query(
            'SELECT 1 FROM employee_role_assignments WHERE employee_id=$1 AND role_id=$2',
            [childId, populatedRole.id],
          )
        ).rowCount,
      ).toBe(1);
      await expect(
        authorization.grantScope(
          { employeeId: actorId, permissionId: permission.id, scope: 'TEAM', organizationId: team },
          actor,
          randomUUID(),
        ),
      ).rejects.toThrow(/deliberate audit failure/u);
      expect(
        (
          await database.query(
            "SELECT 1 FROM data_scope_grants WHERE employee_id=$1 AND permission_id=$2 AND scope='TEAM'",
            [actorId, permission.id],
          )
        ).rowCount,
      ).toBe(0);
      await expect(
        authorization.revokeScope(existingDirect.id, actor, randomUUID()),
      ).rejects.toThrow(/deliberate audit failure/u);
      expect(
        (await database.query('SELECT 1 FROM data_scope_grants WHERE id=$1', [existingDirect.id]))
          .rowCount,
      ).toBe(1);
    } finally {
      await database.query('DROP TRIGGER fail_test_audit ON audit_events');
      await database.query('DROP FUNCTION fail_test_audit()');
    }
  });
});
