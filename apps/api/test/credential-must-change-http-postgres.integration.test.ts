// A1（TD-SEC-011）：真实 HTTP+PG 全流——provision 置位 → 登录 MUST_CHANGE → 业务 403 →
// 改密清位+全会话撤销 → 重登 OK → 存量账号 OK 回归；token-login 产出的会话同门。
import { randomBytes, randomUUID } from 'node:crypto';
import { spawn, type ChildProcess } from 'node:child_process';
import { createServer } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { assertTestDatabaseTarget, Database, migrate } from '@kingturf/database';
import { hashSessionToken, PasswordHasher } from '../src/security.js';

const connection = process.env.DATABASE_URL;
if (!connection) throw new Error('DATABASE_URL required; must-change tests may not be skipped');
assertTestDatabaseTarget(connection, process.env.NODE_ENV);

describe('credential must-change gate on real HTTP and PostgreSQL (A1)', () => {
  const schema = `must_change_${randomUUID().replaceAll('-', '')}`;
  const company = randomUUID();
  const team = randomUUID();
  const secret = randomBytes(32).toString('hex');
  let admin: Database;
  let db: Database;
  let origin = '';
  let child: ChildProcess | undefined;
  let legacyToken = '';
  const cleanup: (() => Promise<unknown>)[] = [];
  const logs: string[] = [];

  async function sqlUser(loginName: string, password: string, grantAll: boolean) {
    const employeeId = randomUUID();
    const identityId = randomUUID();
    const roleId = randomUUID();
    await db.query(
      'INSERT INTO employees(id,company_id,organization_id,employee_number,display_name,normalized_email) VALUES($1,$2,$3,$4,$4,$5)',
      [employeeId, company, team, loginName, `${employeeId}@example.test`],
    );
    await db.query('INSERT INTO identities(id,employee_id,login_name) VALUES($1,$2,$3)', [
      identityId,
      employeeId,
      loginName,
    ]);
    const hasher = new PasswordHasher({
      saltBytes: 16,
      keyLength: 32,
      cost: 16384,
      blockSize: 8,
      parallelization: 1,
    });
    await db.query(
      "INSERT INTO password_credentials(identity_id,algorithm,password_hash) VALUES($1,'scrypt',$2)",
      [identityId, await hasher.hash(password)],
    );
    await db.query(
      'INSERT INTO organization_memberships(organization_id,employee_id) VALUES($1,$2)',
      [company, employeeId],
    );
    await db.query(
      "INSERT INTO roles(id,organization_id,code,name) VALUES($1,$2,$1::uuid::text,'Synthetic')",
      [roleId, company],
    );
    await db.query('INSERT INTO employee_role_assignments(employee_id,role_id) VALUES($1,$2)', [
      employeeId,
      roleId,
    ]);
    if (grantAll)
      await db.query(
        "INSERT INTO role_permission_grants(role_id,permission_id,field_allowlist,data_scopes) SELECT $1,id,NULL,ARRAY['COMPANY']::data_scope[] FROM permissions",
        [roleId],
      );
    else
      await db.query(
        "INSERT INTO role_permission_grants(role_id,permission_id,field_allowlist,data_scopes) SELECT $1,id,NULL,ARRAY['SELF']::data_scope[] FROM permissions WHERE capability='role:read'",
        [roleId],
      );
    return employeeId;
  }

  async function tokenLogin(loginName: string, password: string): Promise<string> {
    const response = await fetch(`${origin}/api/v1/auth/token-login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-correlation-id': randomUUID() },
      body: JSON.stringify({ login: loginName, password }),
      signal: AbortSignal.timeout(10_000),
    });
    const payload = (await response.json()) as { token?: string };
    if (!response.ok || !payload.token)
      throw new Error(`token-login failed: ${String(response.status)}`);
    return payload.token;
  }

  async function call(
    token: string,
    method: string,
    path: string,
    body?: Record<string, unknown>,
  ): Promise<Response> {
    return fetch(`${origin}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        'x-correlation-id': randomUUID(),
        ...(body ? { 'content-type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
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
      "INSERT INTO organizations(id,code,name,organization_type) VALUES($1,'MC','MustChange','COMPANY')",
      [company],
    );
    await db.query(
      "INSERT INTO organizations(id,owner_organization_id,parent_id,code,name,organization_type) VALUES($1,$2,$2,'TEAM','Team','TEAM')",
      [team, company],
    );
    // 存量管理员（迁移默认 must_change_password=false）。
    await sqlUser('legacy.admin', 'Legacy-Admin-Pass-2026', true);
    // 待开通目标员工（无身份），由治理面 provision；预置仅 role:read 的角色用于业务探针。
    const target2 = randomUUID();
    await db.query(
      'INSERT INTO employees(id,company_id,organization_id,employee_number,display_name,normalized_email) VALUES($1,$2,$3,$4,$4,$5)',
      [target2, company, team, 'TARGET', `${target2}@example.test`],
    );
    const probeRole = randomUUID();
    await db.query(
      "INSERT INTO roles(id,organization_id,code,name) VALUES($1,$2,'KT_MC_PROBE','Must-change probe')",
      [probeRole, company],
    );
    await db.query(
      "INSERT INTO role_permission_grants(role_id,permission_id,field_allowlist,data_scopes) SELECT $1,id,NULL,ARRAY['SELF']::data_scope[] FROM permissions WHERE capability='role:read'",
      [probeRole],
    );
    await db.query('INSERT INTO employee_role_assignments(employee_id,role_id) VALUES($1,$2)', [
      target2,
      probeRole,
    ]);
    const socket = createServer();
    await new Promise<void>((resolve) => {
      socket.listen(0, '127.0.0.1', resolve);
    });
    const address = socket.address();
    if (!address || typeof address === 'string') throw new Error('Local API port unavailable');
    await new Promise<void>((resolve, reject) => {
      socket.close((failure) => {
        if (failure) reject(failure);
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
    const sink = logs;
    child.stdout?.on('data', (chunk: Buffer) => {
      sink.push(chunk.toString());
    });
    child.stderr?.on('data', (chunk: Buffer) => {
      sink.push(chunk.toString());
    });
    let ready = false;
    for (let attempt = 0; attempt < 200; attempt++) {
      if (child.exitCode !== null || child.signalCode !== null)
        throw new Error('Isolated must-change API exited');
      try {
        ready = (await fetch(`${origin}/ready`, { signal: AbortSignal.timeout(500) })).ok;
      } catch {
        /* startup */
      }
      if (ready) break;
      await delay(20);
    }
    if (!ready) throw new Error('Isolated must-change API not ready');
    legacyToken = await tokenLogin('legacy.admin', 'Legacy-Admin-Pass-2026');
  }, 30_000);

  afterAll(async () => {
    const stoppedChild = child;
    if (stoppedChild?.exitCode === null && stoppedChild.signalCode === null)
      await new Promise<void>((resolve, reject) => {
        const force = setTimeout(() => {
          stoppedChild.kill('SIGKILL');
        }, 3000);
        const deadline = setTimeout(() => {
          reject(new Error('Must-change test process cleanup deadline'));
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

  it('provisioned accounts start MUST_CHANGE: business 403, change clears, sessions revoked, relogin OK', async () => {
    // 管理员经治理面开通目标员工（真实 provision 路径置位）。
    const employees = await db.query<{ id: string; employee_number: string }>(
      "SELECT id,employee_number FROM employees WHERE employee_number='TARGET'",
    );
    const targetEmployee = employees.rows[0]?.id;
    if (!targetEmployee) throw new Error('target employee missing');
    const provisioned = await call(
      legacyToken,
      'PUT',
      `/api/v1/employees/${targetEmployee}/identity`,
      { login: 'fresh.user', password: 'Fresh-Temp-Pass-2026' },
    );
    expect(provisioned.status).toBe(204);
    const flag = await db.query<{ must_change_password: boolean }>(
      "SELECT must_change_password FROM password_credentials pc JOIN identities i ON i.id=pc.identity_id WHERE i.login_name='fresh.user'",
    );
    expect(flag.rows[0]?.must_change_password).toBe(true);

    // 登录（机器 token-login）→ 会话 MUST_CHANGE，业务 403 credential_must_change。
    const token = await tokenLogin('fresh.user', 'Fresh-Temp-Pass-2026');
    const session = await call(token, 'GET', '/api/v1/auth/session');
    expect(session.status).toBe(200);
    expect(((await session.json()) as Record<string, unknown>).credentialState).toBe('MUST_CHANGE');
    const blocked = await call(token, 'GET', '/api/v1/roles');
    expect(blocked.status).toBe(403);
    expect(((await blocked.json()) as { error: { code: string } }).error.code).toBe(
      'credential_must_change',
    );

    // 自助改密放行并清位；旧会话（含当前）全部撤销。
    const changed = await call(token, 'PUT', '/api/v1/auth/credential', {
      currentPassword: 'Fresh-Temp-Pass-2026',
      password: 'Fresh-Owned-Pass-2026',
    });
    expect(changed.status).toBe(204);
    const cleared = await db.query<{ must_change_password: boolean }>(
      "SELECT must_change_password FROM password_credentials pc JOIN identities i ON i.id=pc.identity_id WHERE i.login_name='fresh.user'",
    );
    expect(cleared.rows[0]?.must_change_password).toBe(false);
    expect((await call(token, 'GET', '/api/v1/auth/session')).status).toBe(401);

    // 重新登录 → OK，业务放行。
    const fresh = await tokenLogin('fresh.user', 'Fresh-Owned-Pass-2026');
    const okSession = await call(fresh, 'GET', '/api/v1/auth/session');
    expect(((await okSession.json()) as Record<string, unknown>).credentialState).toBe('OK');
    expect((await call(fresh, 'GET', '/api/v1/roles')).status).toBe(200);
  });

  it('keeps legacy accounts unrestricted (migration backfill false)', async () => {
    const session = await call(legacyToken, 'GET', '/api/v1/auth/session');
    expect(session.status).toBe(200);
    expect(((await session.json()) as Record<string, unknown>).credentialState).toBe('OK');
    expect((await call(legacyToken, 'GET', '/api/v1/roles')).status).toBe(200);
  });

  it('never leaks session tokens in API logs', () => {
    const raw = logs.join('');
    for (const value of [legacyToken]) expect(raw.includes(value)).toBe(false);
    expect(raw.includes(hashSessionToken(legacyToken, secret))).toBe(false);
  });
});
