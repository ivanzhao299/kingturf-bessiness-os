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
if (process.env.CI && !connectionString) throw new Error('DATABASE_URL is required in CI; PostgreSQL integration tests may not be skipped');

describe.runIf(Boolean(connectionString))('PostgreSQL identity and authorization behavior', () => {
  const schema = `api_auth_${randomUUID().replaceAll('-', '')}`;
  let admin: Database;
  let database: Database;
  let organizations: PostgresOrganizationRepository;
  let employees: PostgresEmployeeRepository;
  let authorization: PostgresAuthorizationRepository;
  let security: PostgresSecurityStore;

  const company = randomUUID();
  const otherCompany = randomUUID();
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
       ($5,$7,$4,'DEEP','Deep team','TEAM'),($6,$7,NULL,'LOOSE','Loose team','TEAM')`,
      [region, department, team, childTeam, deepTeam, looseTeam, company],
    );
    await database.query(
      `INSERT INTO employees(id,company_id,organization_id,employee_number,display_name,normalized_email) VALUES
       ($1,$6,$7,'ACTOR','Actor','actor@example.test'),($2,$6,$8,'CHILD','Child','child@example.test'),
       ($3,$6,$9,'DEEP','Deep','deep@example.test'),($4,$6,$10,'LOOSE','Loose','loose@example.test'),
       ($5,$11,$11,'OTHER','Other','other@example.test')`,
      [actorId, childId, deepId, looseId, otherId, company, team, childTeam, deepTeam, looseTeam, otherCompany],
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
    expect(rows.map(row => row.id).sort()).toEqual([...expected].sort());
    expect(rows.map(row => row.id)).not.toContain(otherId);
  });

  it('fails closed when a typed actor ancestor is missing', async () => {
    expect(await employees.list(company, ['DEPARTMENT'], looseId)).toEqual([]);
    expect(await employees.list(company, ['REGION'], looseId)).toEqual([]);
  });

  it('maintains closure on create/reparent/root moves and rejects multi-level cycles', async () => {
    const createCorrelation = randomUUID();
    const updateCorrelation = randomUUID();
    const created = await organizations.create(
      { ownerOrganizationId: company, parentId: childTeam, code: 'CREATED', name: 'Created', locale: 'zh-CN', currency: 'CNY', active: true },
      actor,
      createCorrelation,
    );
    expect((await database.query<{ depth: number }>('SELECT depth FROM organization_scope_relationships WHERE ancestor_id=$1 AND descendant_id=$2', [region, created.id])).rows[0]?.depth).toBe(4);
    await expect(organizations.update(region, company, { parentId: created.id }, 1, actor, randomUUID())).rejects.toThrow(/organization hierarchy cycle/u);
    const rooted = await organizations.update(created.id, company, { parentId: null }, 1, actor, updateCorrelation);
    expect(rooted.parentId).toBeNull();
    expect((await database.query('SELECT 1 FROM organization_scope_relationships WHERE ancestor_id=$1 AND descendant_id=$2', [region, created.id])).rowCount).toBe(0);
    const audit = await database.query<{ action: string; target_id: string; correlation_id: string }>(
      'SELECT action,target_id,correlation_id FROM audit_events WHERE correlation_id=ANY($1::uuid[]) ORDER BY occurred_at,id',
      [[createCorrelation, updateCorrelation]],
    );
    expect(audit.rows).toEqual([
      { action: 'organization.create', target_id: created.id, correlation_id: createCorrelation },
      { action: 'organization.update', target_id: created.id, correlation_id: updateCorrelation },
    ]);
  });

  it('loads and enforces persisted typed grants without losing TEAM depth', async () => {
    const permission = randomUUID();
    const role = randomUUID();
    const identity = randomUUID();
    const tokenHash = 'a'.repeat(64);
    await database.query("INSERT INTO permissions(id,capability,description) VALUES($1,'employee:read','Read')", [permission]);
    await database.query("INSERT INTO roles(id,organization_id,code,name) VALUES($1,$2,'READER','Reader')", [role, company]);
    await database.query("INSERT INTO role_permission_grants(role_id,permission_id,data_scopes) VALUES($1,$2,ARRAY['SELF']::data_scope[])", [role, permission]);
    await database.query('INSERT INTO employee_role_assignments(employee_id,role_id) VALUES($1,$2)', [actorId, role]);
    await database.query("INSERT INTO data_scope_grants(employee_id,permission_id,scope,scope_organization_id) VALUES($1,$2,'TEAM',$3)", [actorId, permission, team]);
    await database.query("INSERT INTO identities(id,employee_id,login_name) VALUES($1,$2,'actor-login')", [identity, actorId]);
    await database.query('INSERT INTO organization_memberships(organization_id,employee_id) VALUES($1,$2)', [company, actorId]);
    await database.query('INSERT INTO sessions(identity_id,organization_id,token_hash,expires_at) VALUES($1,$2,$3,now()+interval \'1 hour\')', [identity, company, tokenHash]);

    const context = await security.resolveSession(tokenHash, new Date());
    expect(context?.scopeAnchors?.get('employee:read')).toEqual([{ scope: 'TEAM', organizationId: team }]);
    const visible = await employees.list(company, context?.permissions.get('employee:read')?.scopes ?? [], actorId, context?.scopeAnchors?.get('employee:read'));
    expect(visible.map(row => row.id).sort()).toEqual([actorId, childId].sort());
  });

  it('secures tenant-owned grants and assignments and audits every mutation', async () => {
    const correlationId = randomUUID();
    const permission = await authorization.createPermission({ capability: 'employee:update', description: 'Update' }, actor, correlationId);
    const role = await authorization.createRole({ code: 'EDITOR', name: 'Editor' }, actor, correlationId);
    await authorization.grant({ roleId: role.id, permissionId: permission.id, scopes: ['SELF'], fields: ['displayName'] }, actor, correlationId);
    await authorization.assign(childId, role.id, actor, correlationId);
    await expect(authorization.assign(otherId, role.id, actor, correlationId)).rejects.toThrow();
    await authorization.unassign(childId, role.id, actor, correlationId);
    await authorization.revoke(role.id, permission.id, actor, correlationId);

    const audit = await database.query<{ action: string; actor_id: string; organization_id: string; correlation_id: string; occurred_at: Date }>(
      'SELECT action,actor_id,organization_id,correlation_id,occurred_at FROM audit_events WHERE correlation_id=$1 ORDER BY occurred_at,id',
      [correlationId],
    );
    expect(audit.rows.map(row => row.action)).toEqual([
      'authorization.permission.create', 'authorization.role.create', 'authorization.grant',
      'authorization.assign', 'authorization.unassign', 'authorization.revoke',
    ]);
    expect(audit.rows.every(row => row.actor_id === actorId && row.organization_id === company && row.correlation_id === correlationId && row.occurred_at instanceof Date)).toBe(true);
    await expect(database.query("UPDATE audit_events SET outcome='FAILURE' WHERE correlation_id=$1", [correlationId])).rejects.toThrow(/audit events are immutable/u);
    await expect(database.query('DELETE FROM audit_events WHERE correlation_id=$1', [correlationId])).rejects.toThrow(/audit events are immutable/u);
  });

  it('writes organization and employee audits atomically with target and correlation', async () => {
    const correlationId = randomUUID();
    const created = await employees.create(
      { companyId: company, organizationId: team, employeeNumber: `AUD-${randomUUID()}`, displayName: 'Audited', email: `${randomUUID()}@example.test`, active: true },
      actor,
      correlationId,
    );
    await employees.update(created.id, company, { displayName: 'Audited update' }, 1, actor, ['COMPANY'], [], correlationId);
    const audit = await database.query<{ action: string; target_id: string }>('SELECT action,target_id FROM audit_events WHERE correlation_id=$1 ORDER BY occurred_at,id', [correlationId]);
    expect(audit.rows).toEqual([
      { action: 'employee.create', target_id: created.id },
      { action: 'employee.update', target_id: created.id },
    ]);
  });
});
