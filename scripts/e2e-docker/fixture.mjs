import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { spawn, execFileSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { createInterface } from 'node:readline';
import { Database, assertTestDatabaseTarget, migrate } from '../../packages/database/src/index.ts';
import { PasswordHasher } from '../../apps/api/src/security.ts';
import { stopChild } from '../e2e-cdp/session-network-fixture.mjs';
import { createSourceOwnership } from './source-ownership.mjs';

export { stopChild };

export function assertOwnedListener(port, child, group = false) {
  assert(
    Number.isInteger(child?.pid) &&
      child.pid > 0 &&
      child.exitCode === null &&
      child.signalCode === null,
    'owned child must be running',
  );
  const listeners = execFileSync('ss', ['-ltnp', `sport = :${port}`], { encoding: 'utf8' });
  const pids = [...listeners.matchAll(/pid=(\d+)/gu)].map((match) => Number(match[1]));
  assert(pids.length > 0, 'listener ownership unavailable');
  for (const pid of pids) {
    const owner = group
      ? Number(execFileSync('ps', ['-o', 'pgid=', '-p', String(pid)], { encoding: 'utf8' }).trim())
      : pid;
    assert.equal(owner, child.pid, 'foreign listener rejected before credentials');
  }
}

// No .env access. The caller must provide an already guarded local test target.
export async function createFixture(connection) {
  assertTestDatabaseTarget(connection, process.env.NODE_ENV);
  const schema = `runtime_web_${randomUUID().replaceAll('-', '')}`;
  assert.match(schema, /^runtime_web_[a-f0-9]{32}$/u);
  const target = new URL(connection);
  target.searchParams.set('connect_timeout', '5');
  target.searchParams.set('options', '-cstatement_timeout=10000 -clock_timeout=3000');
  const admin = new Database(target.href);
  const children = [];
  let db;
  let created = false;
  let sourceOwner;
  const close = async (
    onSourceCleanup = () => {
      /* Optional fixed cleanup acknowledgement. */
    },
  ) => {
    let failed = false;
    const attempt = async (work) => {
      try {
        await work();
      } catch {
        failed = true;
      }
    };
    for (const child of children.toReversed()) await attempt(() => stopChild(child));
    if (db) await attempt(() => db.close());
    const gone = children.every(
      (child) => child.pid === undefined || child.exitCode !== null || child.signalCode !== null,
    );
    if (!gone) failed = true;
    if (sourceOwner && gone)
      await attempt(async () => {
        await sourceOwner.close();
        onSourceCleanup();
      });
    if (created && gone) {
      await attempt(() => admin.query(`DROP SCHEMA ${schema} CASCADE`));
      await attempt(async () => {
        const remaining = await admin.query(
          'SELECT count(*)::int AS n FROM pg_namespace WHERE nspname=$1',
          [schema],
        );
        assert.equal(remaining.rows[0].n, 0);
      });
    }
    await attempt(() => admin.close());
    if (failed) throw Error('owned fixture cleanup incomplete; inspect retained resources');
  };
  try {
    await admin.query(`CREATE SCHEMA ${schema}`);
    created = true;
    const scoped = new URL(target);
    scoped.searchParams.set(
      'options',
      `-csearch_path=${schema} -cstatement_timeout=10000 -clock_timeout=3000`,
    );
    db = new Database(scoped.href);
    // This marker is created ONLY over the host-guarded connection, before any identity or API writes.
    const marker = randomBytes(32).toString('hex');
    await db.query('CREATE TABLE channel_marker (marker text NOT NULL)');
    await db.query('INSERT INTO channel_marker(marker) VALUES($1)', [marker]);
    const identity = (
      await db.query(
        'SELECT current_database() AS database, current_schema() AS schema, pg_postmaster_start_time()::text AS started, system_identifier::text AS instance FROM pg_control_system()',
      )
    ).rows[0];
    assert.equal(identity.schema, schema);
    const expected = { ...identity, marker };
    const containerTarget = new URL(scoped);
    containerTarget.hostname = '127.0.0.1';
    containerTarget.port = '5432';
    let users;
    const initialize = async (
      signal,
      onMigration = () => {
        /* Optional lifecycle injection. */
      },
      onDatabaseFailure,
    ) => {
      assert.equal(users, undefined, 'fixture initialized once');
      signal.throwIfAborted();
      onMigration();
      await migrate(db);
      signal.throwIfAborted();
      // Match the existing real HTTP fixture: migrate only into owned schema, then expose the
      // already installed pgcrypto functions. Never create/alter the shared extension or data.
      const extension = (
        await db.query(
          'SELECT n.nspname AS namespace FROM pg_extension e JOIN pg_namespace n ON n.oid=e.extnamespace WHERE e.extname=$1',
          ['pgcrypto'],
        )
      ).rows;
      assert.deepEqual(
        extension,
        [{ namespace: 'public' }],
        'existing pgcrypto namespace required',
      );
      const apiTarget = new URL(scoped);
      apiTarget.searchParams.set(
        'options',
        `-csearch_path=${schema},public -cstatement_timeout=10000 -clock_timeout=3000`,
      );
      assertTestDatabaseTarget(apiTarget.href, process.env.NODE_ENV);
      const companyId = randomUUID();
      await db.query(
        "INSERT INTO organizations(id,code,name,organization_type) VALUES($1,$2,'Docker synthetic company','COMPANY')",
        [companyId, randomUUID()],
      );
      const seedUser = async (capabilities) => {
        signal.throwIfAborted();
        const teamId = randomUUID();
        await db.query(
          "INSERT INTO organizations(id,owner_organization_id,parent_id,code,name,organization_type) VALUES($1,$2,$2,$3,'Docker synthetic team','TEAM')",
          [teamId, companyId, randomUUID()],
        );
        const employeeId = randomUUID(),
          roleId = randomUUID(),
          identityId = randomUUID();
        const login = `docker-${randomUUID()}`,
          password = randomBytes(24).toString('base64url');
        const hash = await new PasswordHasher({
          saltBytes: 16,
          keyLength: 32,
          cost: 16384,
          blockSize: 8,
          parallelization: 1,
        }).hash(password);
        await db.query(
          'INSERT INTO employees(id,company_id,organization_id,employee_number,display_name,normalized_email) VALUES($1,$2,$6,$3,$4,$5)',
          [
            employeeId,
            companyId,
            randomUUID(),
            'Docker synthetic user',
            `${employeeId}@example.test`,
            teamId,
          ],
        );
        await db.query('INSERT INTO identities(id,employee_id,login_name) VALUES($1,$2,$3)', [
          identityId,
          employeeId,
          login,
        ]);
        await db.query(
          "INSERT INTO password_credentials(identity_id,algorithm,password_hash) VALUES($1,'scrypt',$2)",
          [identityId, hash],
        );
        await db.query(
          'INSERT INTO organization_memberships(organization_id,employee_id) VALUES($1,$2)',
          [companyId, employeeId],
        );
        await db.query(
          "INSERT INTO roles(id,organization_id,code,name) VALUES($1,$2,$3,'Docker synthetic role')",
          [roleId, companyId, randomUUID()],
        );
        await db.query('INSERT INTO employee_role_assignments(employee_id,role_id) VALUES($1,$2)', [
          employeeId,
          roleId,
        ]);
        await db.query(
          "INSERT INTO role_permission_grants(role_id,permission_id,data_scopes) SELECT $1,id,ARRAY['COMPANY']::data_scope[] FROM permissions WHERE $2::text[] IS NULL OR capability=ANY($2::text[])",
          [roleId, capabilities],
        );
        return { login, password, companyId, employeeId };
      };
      users = {
        admin: await seedUser(null),
        approver: await seedUser(null),
        runtime: await seedUser(['customer:read', 'customer:create']),
      };
      signal.throwIfAborted();
      const child = spawn(
        process.execPath,
        [
          ...(onDatabaseFailure ? ['--import', './scripts/e2e-docker/database-audit.mjs'] : []),
          '--experimental-transform-types',
          'apps/api/src/server.ts',
        ],
        {
          env: {
            ...process.env,
            NODE_ENV: 'test',
            DATABASE_URL: apiTarget.href,
            SESSION_SECRET: randomBytes(32).toString('hex'),
            SESSION_TTL_SECONDS: '3600',
            TOKEN_LOGIN_ENABLED: 'true',
            API_HOST: '127.0.0.1',
            API_PORT: '3000',
            PASSWORD_SALT_BYTES: '16',
            PASSWORD_KEY_LENGTH: '32',
            PASSWORD_SCRYPT_COST: '16384',
            PASSWORD_SCRYPT_BLOCK_SIZE: '8',
            PASSWORD_SCRYPT_PARALLELIZATION: '1',
            ATTACHMENT_STORAGE_ADAPTER: 'local',
            ATTACHMENT_LOCAL_DIRECTORY: `/tmp/${schema}`,
            WEBSITE_LEAD_INGEST_SECRET: '',
          },
          stdio: ['ignore', 'ignore', onDatabaseFailure ? 'pipe' : 'ignore'],
        },
      );
      children.push(child);
      if (onDatabaseFailure) {
        const diagnostics = createInterface({ input: child.stderr, crlfDelay: Infinity });
        diagnostics.on('line', (line) => {
          try {
            const detail = JSON.parse(line);
            if (detail.kind === 'owned-pg-failure') onDatabaseFailure(detail);
          } catch {
            /* Never forward raw API output. */
          }
        });
      }
      let spawnFailed = false;
      child.on('error', () => {
        spawnFailed = true;
      });
      let ready = false;
      for (let attempt = 0; attempt < 250; attempt++) {
        signal.throwIfAborted();
        if (spawnFailed || child.exitCode !== null || child.signalCode !== null)
          throw Error('owned API failed');
        try {
          ready = (await fetch('http://127.0.0.1:3000/ready', { signal: AbortSignal.timeout(500) }))
            .ok;
        } catch {
          /* readiness only */
        }
        if (ready) break;
        await delay(30);
      }
      assert(ready, 'owned API readiness deadline');
      assertOwnedListener(3000, child);
      return users;
    };
    const verifyProbeWrites = async () => {
      const result = await db.query(
        "SELECT count(*) FILTER(WHERE name='Must never be written')::int AS denied,count(*) FILTER(WHERE name='Docker natural Cookie probe')::int AS accepted FROM customers",
      );
      assert.deepEqual(result.rows[0], { denied: 0, accepted: 1 });
    };
    const verifySeedCost = async () => {
      const result = (
        await db.query(
          `SELECT
        (SELECT count(*)::int FROM production_cost_policies WHERE source_reference=$1) policies,
        (SELECT count(*)::int FROM production_cost_policy_material_rates x JOIN production_cost_policies p ON p.id=x.policy_id AND p.tenant_id=x.tenant_id WHERE p.source_reference=$1) rates,
        (SELECT count(*)::int FROM production_cost_runs WHERE run_number=$2) runs,
        (SELECT count(*)::int FROM production_cost_run_events e JOIN production_cost_runs r ON r.id=e.cost_run_id AND r.tenant_id=e.tenant_id WHERE r.run_number=$2) events,
        (SELECT count(*)::int FROM production_cost_run_events e JOIN production_cost_runs r ON r.id=e.cost_run_id AND r.tenant_id=e.tenant_id WHERE r.run_number=$2 AND e.state='APPROVED') approved,
        (SELECT count(*)::int FROM production_cost_run_events e JOIN production_cost_runs r ON r.id=e.cost_run_id AND r.tenant_id=e.tenant_id WHERE r.run_number=$2 AND e.state='CALCULATED') calculated,
        (SELECT bool_and(e.actor_id<>r.created_by) FROM production_cost_run_events e JOIN production_cost_runs r ON r.id=e.cost_run_id AND r.tenant_id=e.tenant_id WHERE r.run_number=$2 AND e.state='APPROVED') separated,
        (SELECT count(*)::int FROM production_orders o JOIN production_order_effective_states s ON s.production_order_id=o.id AND s.tenant_id=o.tenant_id WHERE o.order_number=$3 AND s.state='CLOSED') closed`,
          ['KT-P1-ACTUAL-COST-V1', 'COST-WO-KT-2026-001', 'WO-KT-2026-001'],
        )
      ).rows[0];
      assert.deepEqual(result, {
        policies: 1,
        rates: 2,
        runs: 1,
        events: 2,
        approved: 1,
        calculated: 1,
        separated: true,
        closed: 1,
      });
      return result;
    };
    return {
      expected,
      ownSource: async () => {
        assert.equal(sourceOwner, undefined, 'source owner created once');
        sourceOwner = await createSourceOwnership(admin, expected);
        return sourceOwner.control;
      },
      containerConnection: containerTarget.href,
      initialize,
      verifyProbeWrites,
      verifySeedCost,
      assertApiOwned: () => assertOwnedListener(3000, children[0]),
      close,
    };
  } catch (error) {
    await close();
    throw error;
  }
}
