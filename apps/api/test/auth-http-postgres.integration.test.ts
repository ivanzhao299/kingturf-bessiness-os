import { randomBytes, randomUUID } from 'node:crypto';
import { spawn, type ChildProcess } from 'node:child_process';
import { createServer } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { assertTestDatabaseTarget, Database, migrate } from '@kingturf/database';
import { PostgresSecurityStore } from '../src/repositories.js';
import { hashSessionToken, PasswordHasher } from '../src/security.js';

const connectionString = process.env.DATABASE_URL;
if (!connectionString)
  throw new Error('DATABASE_URL is required; authentication HTTP tests may not be skipped');
assertTestDatabaseTarget(connectionString, process.env.NODE_ENV);
const options = {
  saltBytes: 16,
  keyLength: 32,
  cost: 16384,
  blockSize: 8,
  parallelization: 1,
} as const;
const oldPassword = 'test-only original password';
const newPassword = 'test-only replacement password';
type User = { employeeId: string; identityId: string; companyId: string; login: string };
type RunningServer = { process: ChildProcess; origin: string; applicationName: string };

async function availablePort(): Promise<number> {
  const socket = createServer();
  await new Promise<void>((resolve) => socket.listen(0, '127.0.0.1', resolve));
  const address = socket.address();
  if (!address || typeof address === 'string') throw new Error('Test port unavailable');
  await new Promise<void>((resolve, reject) => {
    socket.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
  return address.port;
}

describe('real HTTP password security across two API instances and PostgreSQL', () => {
  const schema = `auth_http_${randomUUID().replaceAll('-', '')}`;
  const secret = randomBytes(32).toString('hex');
  const sensitiveValues = [secret, oldPassword, newPassword];
  const servers: RunningServer[] = [];
  const serverLogs: string[] = [];
  const cleanup: (() => Promise<unknown>)[] = [];
  let admin: Database;
  let database: Database;
  let store: PostgresSecurityStore;
  let initialHash: string;

  async function seed(adminRole = false, tenant?: string): Promise<User> {
    const companyId = tenant ?? randomUUID();
    if (!tenant)
      await database.query(
        "INSERT INTO organizations(id,code,name,organization_type) VALUES($1,$2,'HTTP test company','COMPANY')",
        [companyId, randomUUID()],
      );
    const organizationId = randomUUID();
    await database.query(
      "INSERT INTO organizations(id,owner_organization_id,parent_id,code,name,organization_type) VALUES($1,$2,$2,$3,'HTTP test team','TEAM')",
      [organizationId, companyId, randomUUID()],
    );
    const employeeId = randomUUID();
    await database.query(
      'INSERT INTO employees(id,company_id,organization_id,employee_number,display_name,normalized_email) VALUES($1,$2,$3,$4,$4,$5)',
      [employeeId, companyId, organizationId, randomUUID(), `${employeeId}@example.test`],
    );
    const identityId = randomUUID();
    const login = `http-${randomUUID()}`;
    await database.query('INSERT INTO identities(id,employee_id,login_name) VALUES($1,$2,$3)', [
      identityId,
      employeeId,
      login,
    ]);
    await database.query(
      "INSERT INTO password_credentials(identity_id,algorithm,password_hash) VALUES($1,'scrypt',$2)",
      [identityId, initialHash],
    );
    await database.query(
      'INSERT INTO organization_memberships(organization_id,employee_id) VALUES($1,$2)',
      [companyId, employeeId],
    );
    const roleId = randomUUID();
    await database.query(
      "INSERT INTO roles(id,organization_id,code,name) VALUES($1,$2,$3,'HTTP test role')",
      [roleId, companyId, randomUUID()],
    );
    await database.query(
      'INSERT INTO employee_role_assignments(employee_id,role_id) VALUES($1,$2)',
      [employeeId, roleId],
    );
    await database.query(
      "INSERT INTO role_permission_grants(role_id,permission_id,data_scopes) SELECT $1,id,ARRAY['SELF']::data_scope[] FROM permissions WHERE capability='employee:read'",
      [roleId],
    );
    if (adminRole)
      await database.query(
        "INSERT INTO role_permission_grants(role_id,permission_id,data_scopes) SELECT $1,id,ARRAY['COMPANY']::data_scope[] FROM permissions WHERE capability='authorization:manage'",
        [roleId],
      );
    return { employeeId, identityId, companyId, login };
  }

  async function request(
    server: number,
    path: string,
    token = '',
    method = 'GET',
    body?: unknown,
    correlationId = randomUUID(),
  ): Promise<Response> {
    return fetch(`${servers[server]?.origin ?? ''}/api/v1${path}`, {
      method,
      headers: {
        'content-type': 'application/json',
        'x-correlation-id': correlationId,
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(10_000),
    });
  }
  async function login(user: User, password = oldPassword, server = 0): Promise<string> {
    const response = await request(server, '/auth/login', '', 'POST', {
      login: user.login,
      password,
    });
    expect(response.status).toBe(200);
    const result = (await response.json()) as { token: string };
    expect(typeof result.token).toBe('string');
    sensitiveValues.push(result.token, hashSessionToken(result.token, secret));
    return result.token;
  }
  const change = (
    token: string,
    password = newPassword,
    currentPassword = oldPassword,
    server = 0,
    correlationId = randomUUID(),
  ) =>
    request(server, '/auth/credential', token, 'PUT', { currentPassword, password }, correlationId);
  async function auditCount(action: string, targetId: string): Promise<number> {
    const rows = await database.query<{ count: string }>(
      "SELECT count(*) FROM audit_events WHERE action=$1 AND target_id=$2 AND outcome='SUCCESS'",
      [action, targetId],
    );
    return Number(rows.rows[0]?.count);
  }
  async function fault(action: string, targetId: string, work: () => Promise<void>): Promise<void> {
    await database.query('INSERT INTO auth_test_faults(action,target_id) VALUES($1,$2)', [
      action,
      targetId,
    ]);
    try {
      await work();
    } finally {
      await database.query('DELETE FROM auth_test_faults WHERE action=$1 AND target_id=$2', [
        action,
        targetId,
      ]);
    }
  }
  async function pendingLocks(
    count: number,
    queryPrefix = 'SELECT id FROM employees%',
  ): Promise<void> {
    for (let attempt = 0; attempt < 200; attempt++) {
      const rows = await admin.query<{ count: string }>(
        "SELECT count(*) FROM pg_stat_activity WHERE application_name=ANY($1::text[]) AND wait_event_type='Lock' AND query LIKE $2",
        [servers.map((server) => server.applicationName), queryPrefix],
      );
      if (Number(rows.rows[0]?.count) >= count) return;
      await delay(10);
    }
    throw new Error('Expected authentication lock barrier was not reached');
  }
  async function lockedEmployee(
    user: User,
    work: (unlock: () => void) => Promise<void>,
  ): Promise<void> {
    let release!: () => void;
    let acquired!: () => void;
    const released = new Promise<void>((resolve) => {
      release = resolve;
    });
    const ready = new Promise<void>((resolve) => {
      acquired = resolve;
    });
    const holding = database.transaction(async (tx) => {
      await tx.query('SELECT id FROM employees WHERE id=$1 FOR NO KEY UPDATE', [user.employeeId]);
      acquired();
      await released;
    });
    await ready;
    try {
      await work(release);
    } finally {
      release();
      await holding;
    }
  }

  beforeAll(async () => {
    admin = new Database(connectionString);
    cleanup.push(() => admin.close());
    await admin.query(`CREATE SCHEMA ${schema}`);
    cleanup.push(() => admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`));
    const scoped = new URL(connectionString);
    scoped.searchParams.set('options', `-csearch_path=${schema}`);
    database = new Database(scoped.toString());
    cleanup.push(() => database.close());
    store = new PostgresSecurityStore(database);
    await migrate(database);
    initialHash = await new PasswordHasher(options).hash(oldPassword);
    sensitiveValues.push(initialHash);
    // Fault injection lives exclusively in the random test schema, never in migrations.
    await database.query(`CREATE TABLE auth_test_faults(action text,target_id uuid,PRIMARY KEY(action,target_id));
      CREATE FUNCTION fail_auth_test_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
        IF EXISTS(SELECT 1 FROM auth_test_faults WHERE action=NEW.action AND target_id=NEW.target_id) THEN RAISE EXCEPTION 'Injected audit failure'; END IF;
        RETURN NEW; END $$;
      CREATE TRIGGER auth_test_audit BEFORE INSERT ON audit_events FOR EACH ROW EXECUTE FUNCTION fail_auth_test_audit();
      CREATE FUNCTION fail_auth_test_revocation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
        IF NEW.revoked_at IS NOT NULL AND EXISTS(SELECT 1 FROM auth_test_faults WHERE action='session.revoke' AND target_id=NEW.identity_id) THEN RAISE EXCEPTION 'Injected revocation failure'; END IF;
        RETURN NEW; END $$;
      CREATE TRIGGER auth_test_revocation BEFORE UPDATE ON sessions FOR EACH ROW EXECUTE FUNCTION fail_auth_test_revocation();`);
    for (let index = 0; index < 2; index++) {
      const port = await availablePort();
      const applicationName = `${schema}_${String(index)}`;
      const target = new URL(scoped);
      target.searchParams.set('application_name', applicationName);
      const child = spawn(
        process.execPath,
        ['--experimental-transform-types', 'apps/api/src/server.ts'],
        {
          cwd: fileURLToPath(new URL('../../../', import.meta.url)),
          env: {
            ...process.env,
            NODE_ENV: 'test',
            DATABASE_URL: target.toString(),
            SESSION_SECRET: secret,
            SESSION_TTL_SECONDS: '3600',
            API_HOST: '127.0.0.1',
            API_PORT: String(port),
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
        },
      );
      child.stdout.on('data', (chunk: Buffer) => serverLogs.push(chunk.toString()));
      child.stderr.on('data', (chunk: Buffer) => serverLogs.push(chunk.toString()));
      const origin = `http://127.0.0.1:${String(port)}`;
      servers.push({ process: child, origin, applicationName });
      let ready = false;
      for (let attempt = 0; attempt < 300; attempt++) {
        if (child.exitCode !== null || child.signalCode !== null)
          throw new Error('Isolated API process exited before readiness');
        try {
          ready = (await fetch(`${origin}/ready`, { signal: AbortSignal.timeout(500) })).ok;
        } catch {
          /* startup retry */
        }
        if (ready) break;
        await delay(20);
      }
      if (!ready) throw new Error('Isolated API did not become ready');
    }
  }, 30_000);

  afterAll(async () => {
    for (const server of servers) {
      if (server.process.exitCode === null && server.process.signalCode === null) {
        await new Promise<void>((resolve, reject) => {
          const force = setTimeout(() => {
            server.process.kill('SIGKILL');
          }, 3000);
          const deadline = setTimeout(() => {
            reject(new Error('Isolated API cleanup deadline exceeded'));
          }, 6000);
          server.process.once('exit', () => {
            clearTimeout(force);
            clearTimeout(deadline);
            resolve();
          });
          server.process.kill('SIGTERM');
        });
      }
    }
    for (const work of cleanup.reverse()) await work();
  });

  it('changes the password, atomically audits and rejects every old device through real HTTP on both instances', async () => {
    const user = await seed();
    const current = await login(user);
    const otherDevice = await login(user, oldPassword, 1);
    const unrelated = await seed();
    const unrelatedToken = await login(unrelated);
    expect((await request(0, '/auth/session', current)).status).toBe(200);
    expect((await change(current)).status).toBe(204);
    for (const token of [current, otherDevice])
      for (const server of [0, 1])
        expect((await request(server, '/auth/session', token)).status).toBe(401);
    expect(
      (await request(0, '/auth/login', '', 'POST', { login: user.login, password: oldPassword }))
        .status,
    ).toBe(401);
    const fresh = await login(user, newPassword, 1);
    expect((await request(0, '/auth/session', fresh)).status).toBe(200);
    expect((await request(1, '/auth/session', unrelatedToken)).status).toBe(200);
    expect(await auditCount('auth.password_change', user.employeeId)).toBe(1);
    const rows = await database.query<{ count: string }>(
      'SELECT count(*) FROM sessions WHERE identity_id=$1 AND revoked_at IS NULL',
      [user.identityId],
    );
    expect(Number(rows.rows[0]?.count)).toBe(1);
  });

  it('rejects a wrong current password and leaves credentials, original session and audit unchanged', async () => {
    const user = await seed();
    const token = await login(user);
    expect((await change(token, newPassword, 'wrong current password')).status).toBe(403);
    expect((await request(1, '/auth/session', token)).status).toBe(200);
    await login(user);
    expect(await auditCount('auth.password_change', user.employeeId)).toBe(0);
  });

  it('requires currentPassword, enforces password policy, rejects target injection and unauthenticated mutation', async () => {
    const user = await seed();
    const token = await login(user);
    expect(
      (await request(0, '/auth/credential', token, 'PUT', { password: newPassword })).status,
    ).toBe(400);
    expect(
      (
        await request(0, '/auth/credential', token, 'PUT', {
          currentPassword: oldPassword,
          password: newPassword,
          employeeId: randomUUID(),
        })
      ).status,
    ).toBe(400);
    expect((await change(token, 'short')).status).toBe(400);
    expect((await change('')).status).toBe(401);
    expect((await request(0, '/auth/session', token)).status).toBe(200);
    expect(await auditCount('auth.password_change', user.employeeId)).toBe(0);
  });

  it('rolls back password and all revocations when the success audit fails', async () => {
    const user = await seed();
    const token = await login(user);
    const other = await login(user, oldPassword, 1);
    await fault('auth.password_change', user.employeeId, async () => {
      expect((await change(token)).status).toBe(500);
      for (const saved of [token, other])
        expect((await request(1, '/auth/session', saved)).status).toBe(200);
      await login(user);
      expect(
        (await request(0, '/auth/login', '', 'POST', { login: user.login, password: newPassword }))
          .status,
      ).toBe(401);
      expect(await auditCount('auth.password_change', user.employeeId)).toBe(0);
    });
  });

  it('rolls back the password when session revocation fails', async () => {
    const user = await seed();
    const token = await login(user);
    await fault('session.revoke', user.identityId, async () => {
      expect((await change(token)).status).toBe(500);
      expect((await request(1, '/auth/session', token)).status).toBe(200);
      await login(user);
      expect(await auditCount('auth.password_change', user.employeeId)).toBe(0);
    });
  });

  it('resets an employee password with tenant-scoped admin authority and revokes only the target sessions', async () => {
    const actor = await seed(true);
    const target = await seed(false, actor.companyId);
    const adminToken = await login(actor);
    const old = await login(target);
    const other = await login(target, oldPassword, 1);
    expect(
      (
        await request(0, `/employees/${target.employeeId}/identity`, adminToken, 'PUT', {
          login: target.login,
          password: newPassword,
        })
      ).status,
    ).toBe(204);
    for (const token of [old, other])
      expect((await request(1, '/auth/session', token)).status).toBe(401);
    expect((await request(1, '/auth/session', adminToken)).status).toBe(200);
    await login(target, newPassword);
    expect(await auditCount('auth.identity_provision', target.identityId)).toBe(1);
  });

  it('rolls back admin password reset, identity update and revocation if its audit fails', async () => {
    const actor = await seed(true);
    const target = await seed(false, actor.companyId);
    const adminToken = await login(actor);
    const token = await login(target);
    await fault('auth.identity_provision', target.identityId, async () => {
      expect(
        (
          await request(0, `/employees/${target.employeeId}/identity`, adminToken, 'PUT', {
            login: `${target.login}-updated`,
            password: newPassword,
          })
        ).status,
      ).toBe(500);
      expect((await request(1, '/auth/session', token)).status).toBe(200);
      await login(target);
      expect(await auditCount('auth.identity_provision', target.identityId)).toBe(0);
    });
  });

  it('requires admin permission, rejects cross-tenant target IDs and retains SELF data scope', async () => {
    const actor = await seed(true);
    const ordinary = await seed(false, actor.companyId);
    const outsider = await seed();
    const adminToken = await login(actor);
    const ordinaryToken = await login(ordinary);
    const outsiderToken = await login(outsider);
    expect(
      (
        await request(0, `/employees/${actor.employeeId}/identity`, ordinaryToken, 'PUT', {
          login: actor.login,
          password: newPassword,
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await request(0, `/employees/${outsider.employeeId}/identity`, adminToken, 'PUT', {
          login: outsider.login,
          password: newPassword,
        })
      ).status,
    ).toBe(404);
    expect((await request(1, '/auth/session', outsiderToken)).status).toBe(200);
    const response = await request(0, '/employees', ordinaryToken);
    expect(response.status).toBe(200);
    const body = (await response.json()) as { id: string }[];
    expect(body.map((employee) => employee.id)).toEqual([ordinary.employeeId]);
  });

  it('keeps pre-existing opaque token rows compatible until their own identity changes password', async () => {
    const user = await seed();
    const unrelated = await seed();
    const tokens = [randomBytes(32).toString('base64url'), randomBytes(32).toString('base64url')];
    for (const [index, target] of [user, unrelated].entries()) {
      const token = tokens[index] ?? '';
      sensitiveValues.push(token, hashSessionToken(token, secret));
      await database.query(
        "INSERT INTO sessions(identity_id,organization_id,token_hash,expires_at) VALUES($1,$2,$3,now()+interval '1 hour')",
        [target.identityId, target.companyId, hashSessionToken(token, secret)],
      );
      expect((await request(0, '/auth/session', token)).status).toBe(200);
    }
    expect((await change(tokens[0] ?? '')).status).toBe(204);
    expect((await request(1, '/auth/session', tokens[0])).status).toBe(401);
    expect((await request(1, '/auth/session', tokens[1])).status).toBe(200);
  });

  it('has no refresh endpoint and rejects a revoked bearer before routing any attempted refresh', async () => {
    const user = await seed();
    const token = await login(user);
    expect((await change(token)).status).toBe(204);
    expect((await request(1, '/auth/refresh', token, 'POST', {})).status).toBe(401);
    const fresh = await login(user, newPassword);
    expect((await request(1, '/auth/refresh', fresh, 'POST', {})).status).toBe(404);
  });

  it('blocks stale password authentication after reset even when login already verified the old hash', async () => {
    const user = await seed();
    const token = await login(user);
    await lockedEmployee(user, async (unlock) => {
      const reset = change(token);
      await pendingLocks(1);
      const oldLogin = request(1, '/auth/login', '', 'POST', {
        login: user.login,
        password: oldPassword,
      });
      await pendingLocks(2);
      unlock();
      expect((await reset).status).toBe(204);
      expect((await oldLogin).status).toBe(401);
      const failures = await database.query<{ count: string }>(
        "SELECT count(*) FROM audit_events WHERE action='auth.login' AND outcome='FAILURE' AND target_id=$1",
        [user.identityId],
      );
      expect(Number(failures.rows[0]?.count)).toBe(1);
    });
    expect((await request(1, '/auth/session', token)).status).toBe(401);
  });

  it('revokes a session committed by an in-flight login immediately before the password change', async () => {
    const user = await seed();
    const token = await login(user);
    await lockedEmployee(user, async (unlock) => {
      const oldLogin = request(1, '/auth/login', '', 'POST', {
        login: user.login,
        password: oldPassword,
      });
      await pendingLocks(1);
      const reset = change(token);
      await pendingLocks(2);
      unlock();
      const response = await oldLogin;
      expect(response.status).toBe(200);
      const issued = (await response.json()) as { token: string };
      sensitiveValues.push(issued.token);
      expect((await reset).status).toBe(204);
      expect((await request(1, '/auth/session', issued.token)).status).toBe(401);
    });
  });

  it('serializes simultaneous self changes so at most one password and success audit commits', async () => {
    const user = await seed();
    const token = await login(user);
    await lockedEmployee(user, async (unlock) => {
      const first = change(token);
      const second = change(token, 'test-only second password', oldPassword, 1);
      await pendingLocks(2);
      unlock();
      const responses = await Promise.all([first, second]);
      const statuses = responses.map((response) => response.status);
      expect(statuses.filter((status) => status === 204)).toHaveLength(1);
      expect(statuses.filter((status) => status === 409)).toHaveLength(1);
    });
    expect(await auditCount('auth.password_change', user.employeeId)).toBe(1);
    expect((await request(1, '/auth/session', token)).status).toBe(401);
  });

  it('blocks stale login after a concurrent admin reset and revokes admin self-reset sessions', async () => {
    const actor = await seed(true);
    const target = await seed(false, actor.companyId);
    const adminToken = await login(actor);
    await lockedEmployee(target, async (unlock) => {
      const reset = request(0, `/employees/${target.employeeId}/identity`, adminToken, 'PUT', {
        login: target.login,
        password: newPassword,
      });
      await pendingLocks(1);
      const oldLogin = request(1, '/auth/login', '', 'POST', {
        login: target.login,
        password: oldPassword,
      });
      await pendingLocks(2);
      unlock();
      expect((await reset).status).toBe(204);
      expect((await oldLogin).status).toBe(401);
      const failures = await database.query<{ count: string }>(
        "SELECT count(*) FROM audit_events WHERE action='auth.login' AND outcome='FAILURE' AND target_id=$1",
        [target.identityId],
      );
      expect(Number(failures.rows[0]?.count)).toBe(1);
    });
    expect(
      (
        await request(0, `/employees/${actor.employeeId}/identity`, adminToken, 'PUT', {
          login: actor.login,
          password: newPassword,
        })
      ).status,
    ).toBe(204);
    expect((await request(1, '/auth/session', adminToken)).status).toBe(401);
    await login(actor, newPassword);
  });

  it('rejects an in-flight password change if logout commits before the session lock is acquired', async () => {
    const user = await seed();
    const token = await login(user);
    let release!: () => void;
    let acquired!: () => void;
    const released = new Promise<void>((resolve) => {
      release = resolve;
    });
    const ready = new Promise<void>((resolve) => {
      acquired = resolve;
    });
    const logout = database.transaction(async (tx) => {
      await tx.query('UPDATE sessions SET revoked_at=clock_timestamp() WHERE token_hash=$1', [
        hashSessionToken(token, secret),
      ]);
      acquired();
      await released;
    });
    await ready;
    try {
      const reset = change(token);
      await pendingLocks(1, 'SELECT 1 FROM sessions%');
      release();
      await logout;
      expect((await reset).status).toBe(403);
    } finally {
      release();
      await logout;
    }
    expect((await request(1, '/auth/session', token)).status).toBe(401);
    await login(user);
    expect(await auditCount('auth.password_change', user.employeeId)).toBe(0);
  });

  it('rechecks invoking session and tenant inside the mutation transaction', async () => {
    const user = await seed();
    const token = await login(user);
    await store.revokeSession(hashSessionToken(token, secret));
    await expect(
      store.replacePasswordForEmployee({
        employeeId: user.employeeId,
        companyId: user.companyId,
        expectedPasswordHash: initialHash,
        passwordHash: initialHash,
        tokenHash: hashSessionToken(token, secret),
        correlationId: randomUUID(),
      }),
    ).rejects.toMatchObject({ code: 'forbidden' });
    await expect(
      store.replacePasswordForEmployee({
        employeeId: user.employeeId,
        companyId: randomUUID(),
        expectedPasswordHash: initialHash,
        passwordHash: initialHash,
        tokenHash: hashSessionToken(token, secret),
        correlationId: randomUUID(),
      }),
    ).rejects.toMatchObject({ code: 'not_found' });
    expect(await auditCount('auth.password_change', user.employeeId)).toBe(0);
  });

  it('does not grant protected access when the authentication database query is unavailable', async () => {
    const user = await seed();
    const token = await login(user);
    await database.query('ALTER TABLE sessions RENAME TO auth_test_sessions_unavailable');
    try {
      expect((await request(1, '/auth/session', token)).status).toBe(500);
    } finally {
      await database.query('ALTER TABLE auth_test_sessions_unavailable RENAME TO sessions');
    }
    expect((await request(0, '/auth/session', token)).status).toBe(200);
  });

  it('rolls back session issuance if its login success audit cannot commit', async () => {
    const user = await seed();
    await fault('auth.login', user.identityId, async () => {
      expect(
        (await request(0, '/auth/login', '', 'POST', { login: user.login, password: oldPassword }))
          .status,
      ).toBe(500);
      const rows = await database.query<{ count: string }>(
        'SELECT count(*) FROM sessions WHERE identity_id=$1',
        [user.identityId],
      );
      expect(Number(rows.rows[0]?.count)).toBe(0);
      expect(await auditCount('auth.login', user.identityId)).toBe(0);
    });
  });

  it('does not log passwords, password hashes, session secrets or bearer material', () => {
    const logs = serverLogs.join('');
    for (const value of sensitiveValues) expect(logs.includes(value)).toBe(false);
  });
});
