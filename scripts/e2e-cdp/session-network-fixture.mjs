// Opt-in real API/PG fixture. Never reads .env; caller supplies a guarded test target.
import assert from 'node:assert/strict';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import net from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { Database, assertTestDatabaseTarget, migrate } from '../../packages/database/src/index.ts';
import { PasswordHasher } from '../../apps/api/src/security.ts';

export async function stopChild(child) {
  if (child.pid === undefined || child.exitCode !== null || child.signalCode !== null) return;
  const exited = new Promise((resolve) => child.once('exit', resolve));
  child.kill('SIGTERM');
  const force = setTimeout(() => child.kill('SIGKILL'), 3000);
  let deadline;
  try {
    await Promise.race([
      exited,
      new Promise((_, reject) => {
        deadline = setTimeout(() => reject(new Error('owned child cleanup deadline')), 6000);
      }),
    ]);
  } finally {
    clearTimeout(force);
    clearTimeout(deadline);
  }
}

async function availablePort() {
  const socket = net.createServer();
  await new Promise((resolve, reject) => {
    socket.once('error', reject);
    socket.listen(0, '127.0.0.1', resolve);
  });
  const port = socket.address().port;
  await new Promise((resolve) => socket.close(resolve));
  return port;
}

export async function createRealSessionFixture(connectionString, report) {
  assertTestDatabaseTarget(connectionString, process.env.NODE_ENV);
  const schema = `s4_network_${randomUUID().replaceAll('-', '')}`;
  assert.match(schema, /^s4_network_[a-f0-9]{32}$/);
  const boundedTarget = new URL(connectionString);
  boundedTarget.searchParams.set('connect_timeout', '5');
  boundedTarget.searchParams.set('options', '-cstatement_timeout=5000 -clock_timeout=3000');
  const admin = new Database(boundedTarget.href);
  const servers = [];
  let database;
  let created = false;
  const password = randomBytes(24).toString('base64url');
  const replacement = randomBytes(24).toString('base64url');
  const secret = randomBytes(32).toString('hex');
  const close = async () => {
    let failed = false;
    const attempt = async (work) => {
      try {
        await work();
      } catch {
        failed = true;
      }
    };
    for (const server of servers) await attempt(() => stopChild(server.child));
    const childrenGone = servers.every(
      ({ child }) =>
        child.pid === undefined || child.exitCode !== null || child.signalCode !== null,
    );
    if (database) await attempt(() => database.close());
    if (created && childrenGone) await attempt(() => admin.query(`DROP SCHEMA ${schema} CASCADE`));
    if (!childrenGone) failed = true;
    await attempt(async () => {
      const rows = await admin.query('SELECT count(*) FROM pg_namespace WHERE nspname=$1', [
        schema,
      ]);
      assert.equal(Number(rows.rows[0].count), 0);
    });
    await attempt(() => admin.close());
    if (failed) {
      report('real-api-cleanup-failed', { requiresInspection: true });
      throw new Error('owned PG cleanup failed');
    }
    report('real-api-cleanup', { apiCount: servers.length, schemaGone: true, childrenGone: true });
  };
  try {
    await admin.query(`CREATE SCHEMA ${schema}`);
    created = true;
    const scoped = new URL(boundedTarget);
    scoped.searchParams.set(
      'options',
      `-csearch_path=${schema} -cstatement_timeout=5000 -clock_timeout=3000`,
    );
    database = new Database(scoped.href);
    await migrate(database);
    const initialHash = await new PasswordHasher({
      saltBytes: 16,
      keyLength: 32,
      cost: 16384,
      blockSize: 8,
      parallelization: 1,
    }).hash(password);
    const seed = async (label, tenant) => {
      const companyId = tenant ?? randomUUID();
      if (!tenant)
        await database.query(
          "INSERT INTO organizations(id,code,name,organization_type) VALUES($1,$2,'S4 synthetic company','COMPANY')",
          [companyId, randomUUID()],
        );
      const organizationId = randomUUID();
      await database.query(
        "INSERT INTO organizations(id,owner_organization_id,parent_id,code,name,organization_type) VALUES($1,$2,$2,$3,'S4 synthetic team','TEAM')",
        [organizationId, companyId, randomUUID()],
      );
      const employeeId = randomUUID();
      await database.query(
        'INSERT INTO employees(id,company_id,organization_id,employee_number,display_name,normalized_email) VALUES($1,$2,$3,$4,$5,$6)',
        [
          employeeId,
          companyId,
          organizationId,
          randomUUID(),
          `S4 ${label}`,
          `${employeeId}@example.test`,
        ],
      );
      const identityId = randomUUID();
      const login = `s4-${randomUUID()}`;
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
        "INSERT INTO roles(id,organization_id,code,name) VALUES($1,$2,$3,'S4 synthetic role')",
        [roleId, companyId, randomUUID()],
      );
      await database.query(
        'INSERT INTO employee_role_assignments(employee_id,role_id) VALUES($1,$2)',
        [employeeId, roleId],
      );
      await database.query(
        "INSERT INTO role_permission_grants(role_id,permission_id,data_scopes) SELECT $1,id,ARRAY['COMPANY']::data_scope[] FROM permissions WHERE capability=ANY($2::text[])",
        [
          roleId,
          [
            'employee:read',
            'employee:create',
            'opportunity:read',
            'business-document:read',
            'business-document:manage',
            'business-document:translate',
            'business-document:send',
            'business-document:configure',
          ],
        ],
      );
      return { employeeId, identityId, companyId, organizationId, login, password };
    };
    const a = await seed('A');
    const b = await seed('B', a.companyId);
    const documentId = randomUUID();
    const content = {
      body: 'S4 synthetic document body',
      html: '<p>S4 synthetic document body</p>',
    };
    await database.query(
      "INSERT INTO business_documents(id,tenant_id,template_key,title,route,state,current_version,created_by) VALUES($1,$2,'01-opportunities','S4 isolated document','opportunities','DRAFT',1,$3)",
      [documentId, b.companyId, b.employeeId],
    );
    await database.query(
      "INSERT INTO business_document_versions(tenant_id,document_id,version,content,change_summary,canonical_hash,created_by) VALUES($1,$2,1,$3::jsonb,'S4 synthetic seed',$4,$5)",
      [
        b.companyId,
        documentId,
        JSON.stringify(content),
        createHash('sha256').update(JSON.stringify(content)).digest('hex'),
        b.employeeId,
      ],
    );
    for (let index = 0; index < 2; index++) {
      const port = await availablePort();
      const child = spawn(
        process.argv.includes('--fault-api-spawn')
          ? '/__kingturf_s4_missing_executable__'
          : process.execPath,
        ['--experimental-transform-types', 'apps/api/src/server.ts'],
        {
          cwd: fileURLToPath(new URL('../../', import.meta.url)),
          env: {
            ...process.env,
            NODE_ENV: 'test',
            DATABASE_URL: scoped.href,
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
          stdio: 'ignore',
        },
      );
      let spawnFailed = false;
      child.on('error', () => {
        spawnFailed = true;
      });
      const origin = `http://127.0.0.1:${port}`;
      servers.push({ child, origin });
      let ready = false;
      for (let attempt = 0; attempt < 300; attempt++) {
        if (spawnFailed || child.exitCode !== null || child.signalCode !== null)
          throw new Error('owned API startup failed');
        try {
          ready = (await fetch(`${origin}/ready`, { signal: AbortSignal.timeout(500) })).ok;
        } catch {
          /* bounded readiness */
        }
        if (ready) break;
        await delay(20);
      }
      assert.equal(ready, true, 'owned API ready');
    }
    const employeeCount = async () =>
      Number((await database.query('SELECT count(*) FROM employees')).rows[0].count);
    const revokedCount = async (user) =>
      Number(
        (
          await database.query(
            'SELECT count(*) FROM sessions WHERE identity_id=$1 AND revoked_at IS NOT NULL',
            [user.identityId],
          )
        ).rows[0].count,
      );
    const expire = async (user) =>
      database.query(
        "UPDATE sessions SET expires_at=now()-interval '1 second' WHERE identity_id=$1",
        [user.identityId],
      );
    report('real-api-ready', {
      apiCount: 2,
      guardedTestTarget: true,
      isolatedSchema: true,
      syntheticUsers: 2,
    });
    return { servers, a, b, documentId, replacement, employeeCount, revokedCount, expire, close };
  } catch (error) {
    await close();
    throw error;
  }
}
