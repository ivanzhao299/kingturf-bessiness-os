import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Database, migrate, migrationStatus } from '../src/index.js';

const connectionString=process.env.DATABASE_URL;
const database=connectionString?new Database(connectionString):null;
if(process.env.CI&&database===null)throw new Error('DATABASE_URL is required in CI; PostgreSQL integration tests may not be skipped');
function getTestDatabase():Database {
  if (database===null) throw new Error('DATABASE_URL is required for PostgreSQL integration tests');
  return database;
}

describe.runIf(database!==null)('PostgreSQL tenant integrity',()=>{
  const companyA=randomUUID();
  const companyB=randomUUID();
  const departmentA=randomUUID();
  const departmentB=randomUUID();
  const employee=randomUUID();
  const region=randomUUID();
  const department=randomUUID();
  const team=randomUUID();
  const childTeam=randomUUID();
  const teamLeaf=randomUUID();
  const scopedEmployee=randomUUID();
  const permission=randomUUID();

  beforeAll(async()=>{
    await migrate(getTestDatabase());
    await getTestDatabase().query("INSERT INTO organizations(id,code,name,organization_type) VALUES($1,'COMPANY-A','Company A','COMPANY'),($2,'COMPANY-B','Company B','COMPANY')",[companyA,companyB]);
    await getTestDatabase().query("INSERT INTO organizations(id,owner_organization_id,code,name,organization_type) VALUES($1,$2,'DEPT-A','Department A','DEPARTMENT'),($3,$4,'DEPT-B','Department B','DEPARTMENT')",[departmentA,companyA,departmentB,companyB]);
    await getTestDatabase().query("INSERT INTO employees(id,company_id,organization_id,employee_number,display_name,normalized_email) VALUES($1,$2,$3,'E-1','Employee','employee@example.test')",[employee,companyA,departmentA]);
    await getTestDatabase().query("INSERT INTO organizations(id,owner_organization_id,parent_id,code,name,organization_type) VALUES($1,$6,NULL,'REGION-A','Region A','REGION'),($2,$6,$1,'DEPARTMENT-A2','Department A2','DEPARTMENT'),($3,$6,$2,'TEAM-A','Team A','TEAM'),($4,$6,$3,'TEAM-A-CHILD','Child Team A','TEAM'),($5,$6,$4,'TEAM-A-LEAF','Leaf Team A','TEAM')",[region,department,team,childTeam,teamLeaf,companyA]);
    await getTestDatabase().query("INSERT INTO employees(id,company_id,organization_id,employee_number,display_name,normalized_email) VALUES($1,$2,$3,'E-SCOPE','Scoped Employee','scoped@example.test')",[scopedEmployee,companyA,teamLeaf]);
  });
  afterAll(async()=>{
    await getTestDatabase().query('DELETE FROM data_scope_grants WHERE employee_id=$1',[employee]);
    await getTestDatabase().query('DELETE FROM permissions WHERE id=$1',[permission]);
    await getTestDatabase().query('DELETE FROM employees WHERE id=ANY($1::uuid[])',[[employee,scopedEmployee]]);
    await getTestDatabase().query('DELETE FROM organization_scope_relationships WHERE ancestor_id=ANY($1::uuid[]) OR descendant_id=ANY($1::uuid[])',[[teamLeaf,childTeam,team,department,region,departmentA,departmentB,companyA,companyB]]);
    await getTestDatabase().query('DELETE FROM organizations WHERE id=ANY($1::uuid[])',[[teamLeaf,childTeam,team,department,region,departmentA,departmentB,companyA,companyB]]);
    await getTestDatabase().close();
  });

  it('rejects a cross-company parent on INSERT',async()=>{
    await expect(getTestDatabase().query("INSERT INTO organizations(owner_organization_id,parent_id,code,name,organization_type) VALUES($1,$2,'BAD-PARENT','Bad Parent','DEPARTMENT')",[companyA,departmentB])).rejects.toThrow(/parent must share organization ownership/u);
  });
  it('rejects moving an employee organization across companies',async()=>{
    await expect(getTestDatabase().query('UPDATE employees SET organization_id=$1 WHERE id=$2',[departmentB,employee])).rejects.toThrow();
  });
  it('maintains closure through multi-level reparenting and rejects cycles',async()=>{
    const initial=await getTestDatabase().query<{depth:number}>('SELECT depth FROM organization_scope_relationships WHERE ancestor_id=$1 AND descendant_id=$2',[region,childTeam]);
    expect(initial.rows[0]?.depth).toBe(3);
    await expect(getTestDatabase().query('UPDATE organizations SET parent_id=$1 WHERE id=$2',[teamLeaf,region])).rejects.toThrow(/organization hierarchy cycle/u);
    await getTestDatabase().query('UPDATE organizations SET parent_id=NULL WHERE id=$1',[department]);
    expect((await getTestDatabase().query('SELECT 1 FROM organization_scope_relationships WHERE ancestor_id=$1 AND descendant_id=$2',[region,childTeam])).rowCount).toBe(0);
    expect((await getTestDatabase().query<{depth:number}>('SELECT depth FROM organization_scope_relationships WHERE ancestor_id=$1 AND descendant_id=$2',[department,childTeam])).rows[0]?.depth).toBe(2);
  });
  it('enforces typed persisted scope anchors, TEAM depth, and tenant ownership',async()=>{
    await getTestDatabase().query("INSERT INTO permissions(id,capability,description) VALUES($1,'employee:read','Read employees')",[permission]);
    await getTestDatabase().query("INSERT INTO data_scope_grants(employee_id,permission_id,scope,scope_organization_id) VALUES($1,$2,'TEAM',$3)",[employee,permission,team]);
    const visible=await getTestDatabase().query<{id:string}>("SELECT e.id FROM employees e JOIN data_scope_grants d ON d.employee_id=$1 AND d.permission_id=$2 JOIN organization_scope_relationships osr ON osr.ancestor_id=d.scope_organization_id AND osr.descendant_id=e.organization_id AND (d.scope<>'TEAM' OR osr.depth<=1) WHERE e.company_id=$3",[employee,permission,companyA]);
    expect(visible.rows.map(row=>row.id)).not.toContain(scopedEmployee);
    await expect(getTestDatabase().query("INSERT INTO data_scope_grants(employee_id,permission_id,scope,scope_organization_id) VALUES($1,$2,'TEAM',$3)",[employee,permission,departmentB])).rejects.toThrow(/scope organization must share tenant ownership/u);
  });
  it('makes business audit events immutable with correlation and timestamp',async()=>{
    const audit=randomUUID();const correlation=randomUUID();
    await getTestDatabase().query("INSERT INTO audit_events(id,action,outcome,actor_id,organization_id,target_type,target_id,correlation_id) VALUES($1,'organization.update','SUCCESS',$2,$3,'organization',$4,$5)",[audit,employee,companyA,department,correlation]);
    const row=await getTestDatabase().query<{correlation_id:string;occurred_at:Date}>('SELECT correlation_id,occurred_at FROM audit_events WHERE id=$1',[audit]);
    expect(row.rows[0]?.correlation_id).toBe(correlation);expect(row.rows[0]?.occurred_at).toBeInstanceOf(Date);
    await expect(getTestDatabase().query("UPDATE audit_events SET outcome='FAILURE' WHERE id=$1",[audit])).rejects.toThrow(/audit events are immutable/u);
    await expect(getTestDatabase().query('DELETE FROM audit_events WHERE id=$1',[audit])).rejects.toThrow(/audit events are immutable/u);
  });
  it('detects a changed stored migration checksum',async()=>{
    const original=(await getTestDatabase().query<{checksum:string}>('SELECT checksum FROM schema_migrations WHERE name=$1',['0001_identity_authorization_foundation.sql'])).rows[0]?.checksum;
    expect(original).toBeTruthy();
    try{await getTestDatabase().query("UPDATE schema_migrations SET checksum=repeat('0',64) WHERE name=$1",['0001_identity_authorization_foundation.sql']);expect((await migrationStatus(getTestDatabase())).find(item=>item.name==='0001_identity_authorization_foundation.sql')?.state).toBe('drifted');}
    finally{await getTestDatabase().query('UPDATE schema_migrations SET checksum=$2 WHERE name=$1',['0001_identity_authorization_foundation.sql',original]);}
  });
});
