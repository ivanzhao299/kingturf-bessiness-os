import { randomUUID } from 'node:crypto';
import { assertTestDatabaseTarget, Database, migrate } from '@kingturf/database';

/** Real local PG only; connection strings are never explicit fixture results or diagnostics. */
export async function ownedPostgres(prefix: string, migrationDirectory?: string) {
  if (!/^[a-z][a-z_]{0,29}$/u.test(prefix)) throw new Error('Invalid owned schema prefix');
  const connection = process.env.DATABASE_URL;
  if (!connection) throw new Error('DATABASE_URL required; PostgreSQL tests must not be skipped');
  try {
    assertTestDatabaseTarget(connection, process.env.NODE_ENV);
  } catch {
    throw new Error('Owned fixture requires NODE_ENV=test and a valid loopback test database');
  }
  const schema = `${prefix}_${randomUUID().replaceAll('-', '')}`;
  const admin = new Database(connection);
  const cleanup: (() => Promise<unknown>)[] = [() => admin.close()];
  const close = async () => {
    const failures: unknown[] = [];
    for (const action of cleanup.splice(0).reverse()) {
      try {
        await action();
      } catch (error) {
        failures.push(error);
      }
    }
    if (failures.length) throw new AggregateError(failures, 'Owned PostgreSQL cleanup failed');
  };
  try {
    await admin.query(`CREATE SCHEMA ${schema}`);
    cleanup.push(() => admin.query(`DROP SCHEMA ${schema} CASCADE`));
    const target = new URL(connection);
    target.searchParams.set('options', `-csearch_path=${schema}`);
    const db = new Database(target.toString());
    cleanup.push(() => db.close());
    const active = await db.query<{ schema: string }>('SELECT current_schema() AS schema');
    if (active.rows[0]?.schema !== schema) throw new Error('Owned schema search path mismatch');
    await migrate(db, migrationDirectory);
    const company = randomUUID(),
      otherCompany = randomUUID();
    const team = randomUUID(),
      otherTeam = randomUUID();
    const employee = randomUUID(),
      otherEmployee = randomUUID();
    await db.query(
      "INSERT INTO organizations(id,code,name,organization_type) VALUES($1,'OWN-A','Owned A','COMPANY'),($2,'OWN-B','Owned B','COMPANY')",
      [company, otherCompany],
    );
    await db.query(
      "INSERT INTO organizations(id,owner_organization_id,code,name,organization_type) VALUES($1,$2,'TEAM-A','Team A','TEAM'),($3,$4,'TEAM-B','Team B','TEAM')",
      [team, company, otherTeam, otherCompany],
    );
    await db.query(
      "INSERT INTO employees(id,company_id,organization_id,employee_number,display_name,normalized_email) VALUES($1,$2,$3,'OWN-A','Owned A','a@owned.test'),($4,$5,$6,'OWN-B','Owned B','b@owned.test')",
      [employee, company, team, otherEmployee, otherCompany, otherTeam],
    );
    return {
      db,
      schema,
      company,
      otherCompany,
      team,
      otherTeam,
      employee,
      otherEmployee,
      close,
      context: {
        actor: { companyId: company, employeeId: employee },
        scopes: ['COMPANY'] as const,
        anchors: [],
      },
      otherContext: {
        actor: { companyId: otherCompany, employeeId: otherEmployee },
        scopes: ['COMPANY'] as const,
        anchors: [],
      },
    };
  } catch (error) {
    try {
      await close();
    } catch (cleanupError) {
      throw new AggregateError([error, cleanupError], 'Owned PostgreSQL setup and cleanup failed');
    }
    throw error;
  }
}
