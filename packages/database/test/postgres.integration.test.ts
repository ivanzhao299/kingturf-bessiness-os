import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Database, migrate } from '../src/index.js';

const connectionString=process.env.DATABASE_URL;
const database=connectionString?new Database(connectionString):null;
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

  beforeAll(async()=>{
    await migrate(getTestDatabase());
    await getTestDatabase().query("INSERT INTO organizations(id,code,name,organization_type) VALUES($1,'COMPANY-A','Company A','COMPANY'),($2,'COMPANY-B','Company B','COMPANY')",[companyA,companyB]);
    await getTestDatabase().query("INSERT INTO organizations(id,owner_organization_id,code,name,organization_type) VALUES($1,$2,'DEPT-A','Department A','DEPARTMENT'),($3,$4,'DEPT-B','Department B','DEPARTMENT')",[departmentA,companyA,departmentB,companyB]);
    await getTestDatabase().query("INSERT INTO employees(id,company_id,organization_id,employee_number,display_name,normalized_email) VALUES($1,$2,$3,'E-1','Employee','employee@example.test')",[employee,companyA,departmentA]);
  });
  afterAll(async()=>{
    await getTestDatabase().query('DELETE FROM employees WHERE id=$1',[employee]);
    await getTestDatabase().query('DELETE FROM organizations WHERE id=ANY($1::uuid[])',[[departmentA,departmentB,companyA,companyB]]);
    await getTestDatabase().close();
  });

  it('rejects a cross-company parent on INSERT',async()=>{
    await expect(getTestDatabase().query("INSERT INTO organizations(owner_organization_id,parent_id,code,name,organization_type) VALUES($1,$2,'BAD-PARENT','Bad Parent','DEPARTMENT')",[companyA,departmentB])).rejects.toThrow(/parent must share organization ownership/u);
  });
  it('rejects moving an employee organization across companies',async()=>{
    await expect(getTestDatabase().query('UPDATE employees SET organization_id=$1 WHERE id=$2',[departmentB,employee])).rejects.toThrow();
  });
});
