// M1a（TD-SEC-012 后继，CP1 复核修复）：保留角色编码 + 目录写入门禁的真实 HTTP+PG 负例链。
// 独立新文件：authorization-http-postgres.integration.test.ts 是 Source 护栏字节冻结基线，不改动。
import { randomBytes, randomUUID } from 'node:crypto';
import { spawn, type ChildProcess } from 'node:child_process';
import { createServer } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { assertTestDatabaseTarget, Database, migrate } from '@kingturf/database';
import { hashSessionToken } from '../src/security.js';

const connection = process.env.DATABASE_URL;
if (!connection)
  throw new Error('DATABASE_URL required; real HTTP permission catalog tests may not be skipped');
assertTestDatabaseTarget(connection, process.env.NODE_ENV);

describe('reserved role codes and the permission catalog maintenance port (M1a)', () => {
  const schema = `perm_catalog_${randomUUID().replaceAll('-', '')}`;
  const company = randomUUID();
  const team = randomUUID();
  const secret = randomBytes(32).toString('hex');
  let admin: Database;
  let db: Database;
  let origin = '';
  let child: ChildProcess | undefined;
  let tenantAdmin: { employeeId: string; roleId: string; token: string };
  const cleanup: (() => Promise<unknown>)[] = [];
  const logs: string[] = [];

  async function user(tenant: string, organization: string) {
    const employeeId = randomUUID();
    const identityId = randomUUID();
    const roleId = randomUUID();
    await db.query(
      'INSERT INTO employees(id,company_id,organization_id,employee_number,display_name,normalized_email) VALUES($1,$2,$3,$1::uuid::text,$1::uuid::text,$4)',
      [employeeId, tenant, organization, `${employeeId}@example.test`],
    );
    await db.query(
      'INSERT INTO identities(id,employee_id,login_name) VALUES($1,$2,$2::uuid::text)',
      [identityId, employeeId],
    );
    await db.query(
      'INSERT INTO organization_memberships(employee_id,organization_id) VALUES($1,$2)',
      [employeeId, tenant],
    );
    await db.query(
      "INSERT INTO roles(id,organization_id,code,name) VALUES($1,$2,$1::uuid::text,'Synthetic catalog role')",
      [roleId, tenant],
    );
    await db.query('INSERT INTO employee_role_assignments(employee_id,role_id) VALUES($1,$2)', [
      employeeId,
      roleId,
    ]);
    const token = randomBytes(32).toString('base64url');
    await db.query(
      "INSERT INTO sessions(identity_id,organization_id,token_hash,expires_at) VALUES($1,$2,$3,now()+interval '1 hour')",
      [identityId, tenant, hashSessionToken(token, secret)],
    );
    return { employeeId, roleId, token };
  }

  async function post(path: string, token: string, body: Record<string, unknown>) {
    return fetch(`${origin}/api/v1${path}`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
        'x-correlation-id': randomUUID(),
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });
  }

  beforeAll(async () => {
    admin = new Database(connection);
    cleanup.push(() => admin.close());
    await admin.query(`CREATE SCHEMA ${schema}`);
    cleanup.push(() => admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`));
    const target = new URL(connection);
    target.searchParams.set('options', `-csearch_path=${schema}`);
    db = new Database(target.toString());
    cleanup.push(() => db.close());
    await migrate(db);
    await db.query(
      "INSERT INTO organizations(id,code,name,organization_type) VALUES($1,'PERM','Perm','COMPANY')",
      [company],
    );
    await db.query(
      "INSERT INTO organizations(id,owner_organization_id,parent_id,code,name,organization_type) VALUES($1,$2,$2,'TEAM','Team','TEAM')",
      [team, company],
    );
    tenantAdmin = await user(company, team);
    // 全量授权的租户管理员（含 role:manage/authorization:manage），但未被指派任何保留角色。
    await db.query(
      "INSERT INTO role_permission_grants(role_id,permission_id,data_scopes) SELECT $1,id,ARRAY['COMPANY']::data_scope[] FROM permissions",
      [tenantAdmin.roleId],
    );
    const socket = createServer();
    await new Promise<void>((resolve) => {
      socket.listen(0, '127.0.0.1', resolve);
    });
    const address = socket.address();
    if (!address || typeof address === 'string') throw new Error('Local API port unavailable');
    await new Promise<void>((resolve, reject) => {
      socket.close((error) => {
        if (error) reject(error);
        else resolve();
      });
    });
    origin = `http://127.0.0.1:${String(address.port)}`;
    child = spawn(process.execPath, ['--experimental-transform-types', 'apps/api/src/server.ts'], {
      cwd: fileURLToPath(new URL('../../../', import.meta.url)),
      env: {
        ...process.env,
        NODE_ENV: 'test',
        DATABASE_URL: target.toString(),
        SESSION_SECRET: secret,
        SESSION_TTL_SECONDS: '3600',
        API_HOST: '127.0.0.1',
        API_PORT: String(address.port),
        PASSWORD_SALT_BYTES: '16',
        PASSWORD_KEY_LENGTH: '32',
        PASSWORD_SCRYPT_COST: '16384',
        PASSWORD_SCRYPT_BLOCK_SIZE: '8',
        PASSWORD_SCRYPT_PARALLELIZATION: '1',
        ATTACHMENT_STORAGE_ADAPTER: 'local',
        ATTACHMENT_LOCAL_DIRECTORY: `/tmp/${schema}`,
        WEBSITE_LEAD_INGEST_SECRET: '',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const logsLocal = logs;
    child.stdout?.on('data', (chunk: Buffer) => {
      logsLocal.push(chunk.toString());
    });
    child.stderr?.on('data', (chunk: Buffer) => {
      logs.push(chunk.toString());
    });
    let ready = false;
    for (let attempt = 0; attempt < 200; attempt++) {
      if (child.exitCode !== null || child.signalCode !== null)
        throw new Error('Isolated permission catalog API exited');
      try {
        ready = (await fetch(`${origin}/ready`, { signal: AbortSignal.timeout(500) })).ok;
      } catch {
        /* startup */
      }
      if (ready) break;
      await delay(20);
    }
    if (!ready) throw new Error('Isolated permission catalog API not ready');
  }, 30_000);

  afterAll(async () => {
    const stoppedChild = child;
    if (stoppedChild?.exitCode === null && stoppedChild.signalCode === null)
      await new Promise<void>((resolve, reject) => {
        const force = setTimeout(() => {
          stoppedChild.kill('SIGKILL');
        }, 3000);
        const deadline = setTimeout(() => {
          reject(new Error('Permission catalog test process cleanup deadline'));
        }, 6000);
        stoppedChild.once('exit', () => {
          clearTimeout(force);
          clearTimeout(deadline);
          resolve();
        });
        stoppedChild.kill('SIGTERM');
      });
    for (const work of cleanup.reverse()) await work();
  });

  it('rejects reserved administrator role codes at the API creation path', async () => {
    for (const code of ['SYSTEM_ADMIN', ' system_admin ']) {
      const response = await post('/roles', tenantAdmin.token, { code, name: 'Self made' });
      expect(response.status).toBe(403);
      const payload = (await response.json()) as { error?: { code?: string } };
      expect(payload.error?.code).toBe('forbidden');
    }
  });

  it('keeps catalog writes assignment-bound even when a reserved role exists out-of-band', async () => {
    // SQL 直建保留编码角色 + 指派第二身份（模拟运维/bootstrap 通道）。
    const maintenance = await user(company, team);
    const reservedRole = randomUUID();
    await db.query(
      "INSERT INTO roles(id,organization_id,code,name) VALUES($1,$2,'SYSTEM_ADMIN','Operations bootstrap')",
      [reservedRole, company],
    );
    await db.query('INSERT INTO employee_role_assignments(employee_id,role_id) VALUES($1,$2)', [
      maintenance.employeeId,
      reservedRole,
    ]);
    // 全量授权但未被指派的租户管理员：目录写入仍被门禁拒绝（保留码仅封创建，门禁绑定指派）。
    const denied = await post('/permissions', tenantAdmin.token, {
      capability: 'tenant-bypass:attempt',
      description: 'Denied',
    });
    expect(denied.status).toBe(403);
    // 被指派的维护身份经维护口放行（种子外补录通道有效）。
    const appended = await post('/permissions', maintenance.token, {
      capability: 'tenant-ops:supplement',
      description: 'Seed supplement',
    });
    expect(appended.status).toBe(201);
  });

  it('does not expose session tokens in actual API logs', () => {
    expect(logs.join('')).not.toContain(tenantAdmin.token);
  });
});
