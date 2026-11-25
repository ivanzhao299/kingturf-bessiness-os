import { randomBytes, randomUUID } from 'node:crypto';
import { Database } from '@kingturf/database';
import type { ApiResponse } from '../../src/api-types.ts';
import { buildApp } from '../../src/app.js';
import { PostgresCommercialRepository } from '../../src/commercial-repositories.js';
import { PostgresManufacturingRepository } from '../../src/manufacturing-repositories.js';
import { PostgresProcurementRepository } from '../../src/procurement-repositories.js';
import {
  PostgresAuthorizationRepository,
  PostgresEmployeeRepository,
  PostgresOrganizationRepository,
  PostgresSecurityStore,
} from '../../src/repositories.js';
import { AuthenticationService, hashSessionToken, PasswordHasher } from '../../src/security.js';
import { ownedPostgres } from './owned-postgres.js';

/** Real application dispatch + real PG for the procurement endpoints; no HTTP server or browser. */
export async function ownedProcurementApp(prefix: string) {
  const owned = await ownedPostgres(prefix);
  let database: Database | undefined;
  const close = async () => {
    const failures: unknown[] = [];
    try {
      await database?.close();
    } catch (error) {
      failures.push(error);
    }
    try {
      await owned.close();
    } catch (error) {
      failures.push(error);
    }
    if (failures.length) throw new AggregateError(failures, 'Procurement fixture cleanup failed');
  };
  try {
    const connection = process.env.DATABASE_URL;
    if (!connection) throw new Error('DATABASE_URL required');
    const target = new URL(connection);
    // 与 owned-commercial-graph 同一做法：迁移先在独占 schema 里跑完，应用连接再带上 public，
    // 应用查询才看得见扩展函数。
    target.searchParams.set('options', `-csearch_path=${owned.schema},public`);
    database = new Database(target.href);
    const appDatabase = database;
    const active = await appDatabase.query<{ schema: string }>('SELECT current_schema() schema');
    if (active.rows[0]?.schema !== owned.schema) throw new Error('Procurement schema mismatch');
    const sessionSecret = randomBytes(32).toString('hex');
    const store = new PostgresSecurityStore(appDatabase);
    const app = buildApp({
      auth: new AuthenticationService(
        store,
        new PasswordHasher({
          saltBytes: 16,
          keyLength: 32,
          cost: 16384,
          blockSize: 8,
          parallelization: 1,
        }),
        { secret: sessionSecret, ttlSeconds: 3600, idleSeconds: 3600 },
        store,
      ),
      organizations: new PostgresOrganizationRepository(appDatabase),
      employees: new PostgresEmployeeRepository(appDatabase),
      authorization: new PostgresAuthorizationRepository(appDatabase),
      // registry 全组注册要求 commercial 非空（生产装配恒有）。
      commercial: new PostgresCommercialRepository(appDatabase),
      procurement: new PostgresProcurementRepository(appDatabase),
    });
    // 同一家公司（夹具主公司）里再建一名员工，给「权限不足」的会话用。
    const addEmployee = async (): Promise<string> => {
      const employee = randomUUID();
      await appDatabase.query(
        "INSERT INTO employees(id,company_id,organization_id,employee_number,display_name,normalized_email) VALUES($1,$2,$3,$4,'Synthetic procurement employee',$5)",
        [employee, owned.company, owned.team, `EMP-${randomUUID()}`, `${randomUUID()}@owned.test`],
      );
      return employee;
    };
    // 每名员工只有一个身份（identities.employee_id 唯一）：一个员工只开一条会话。角色的权限
    // 恰为 capabilities（'ALL' = 全部权限，数据范围 COMPANY）。令牌只存在于调用方的闭包，
    // 不进入任何断言输出。
    const session = async (
      employee: string,
      capabilities: readonly string[] | 'ALL',
    ): Promise<string> => {
      const company = (
        await appDatabase.query<{ company_id: string }>(
          'SELECT company_id FROM employees WHERE id=$1',
          [employee],
        )
      ).rows[0]?.company_id;
      if (!company) throw new Error('Synthetic procurement employee missing');
      const identity = randomUUID();
      const role = randomUUID();
      const token = randomBytes(32).toString('base64url');
      try {
        await appDatabase.query(
          'INSERT INTO identities(id,employee_id,login_name) VALUES($1,$2,$2::uuid::text)',
          [identity, employee],
        );
        await appDatabase.query(
          'INSERT INTO organization_memberships(employee_id,organization_id) VALUES($1,$2)',
          [employee, company],
        );
        await appDatabase.query(
          "INSERT INTO roles(id,organization_id,code,name) VALUES($1,$2,$1::uuid::text,'Synthetic procurement fixture role')",
          [role, company],
        );
        await appDatabase.query(
          'INSERT INTO employee_role_assignments(employee_id,role_id) VALUES($1,$2)',
          [employee, role],
        );
        if (capabilities === 'ALL')
          await appDatabase.query(
            "INSERT INTO role_permission_grants(role_id,permission_id,data_scopes) SELECT $1,id,ARRAY['COMPANY']::data_scope[] FROM permissions",
            [role],
          );
        else
          await appDatabase.query(
            "INSERT INTO role_permission_grants(role_id,permission_id,data_scopes) SELECT $1,id,ARRAY['COMPANY']::data_scope[] FROM permissions WHERE capability=ANY($2::text[])",
            [role, [...capabilities]],
          );
        await appDatabase.query(
          "INSERT INTO sessions(identity_id,organization_id,token_hash,expires_at) VALUES($1,$2,$3,now()+interval '1 hour')",
          [identity, company, hashSessionToken(token, sessionSecret)],
        );
      } catch {
        // 不把 PG 认证行细节或生成的值带进测试诊断。
        throw new Error('Synthetic procurement identity initialization failed');
      }
      return token;
    };
    const dispatch = (
      request: Readonly<{
        token: string;
        method: 'GET' | 'POST' | 'PUT';
        pathname: string;
        body?: Record<string, unknown>;
        key?: string;
      }>,
    ): Promise<ApiResponse> =>
      app.dispatch({
        method: request.method,
        pathname: request.pathname,
        headers: {
          authorization: `Bearer ${request.token}`,
          'content-type': 'application/json',
          'x-correlation-id': randomUUID(),
          ...(request.key === undefined ? {} : { 'idempotency-key': request.key }),
        },
        ...(request.body === undefined ? {} : { body: request.body }),
      });
    return {
      db: appDatabase,
      schema: owned.schema,
      context: owned.context,
      otherContext: owned.otherContext,
      company: owned.company,
      otherCompany: owned.otherCompany,
      employee: owned.employee,
      otherEmployee: owned.otherEmployee,
      session,
      addEmployee,
      dispatch,
      repository: new PostgresProcurementRepository(appDatabase),
      manufacturing: new PostgresManufacturingRepository(appDatabase),
      close,
    };
  } catch (error) {
    try {
      await close();
    } catch (cleanupError) {
      throw new AggregateError([error, cleanupError], 'Procurement fixture setup failed');
    }
    throw error;
  }
}
