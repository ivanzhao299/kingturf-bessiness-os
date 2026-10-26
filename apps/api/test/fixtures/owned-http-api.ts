import { randomBytes, randomUUID } from 'node:crypto';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import type { DataScope } from '@kingturf/types';
import { assertTestDatabaseTarget } from '@kingturf/database';
import { PasswordHasher } from '../../src/security.js';
import type { ownedCommercialGraph } from './owned-commercial-graph.js';

type Graph = Awaited<ReturnType<typeof ownedCommercialGraph>>;
const hasher = new PasswordHasher({
  saltBytes: 16,
  keyLength: 32,
  cost: 16384,
  blockSize: 8,
  parallelization: 1,
});
async function stop(child: ChildProcess | undefined) {
  if (child?.exitCode !== null || child.signalCode !== null) return;
  const stopped = new Promise<void>((resolve) =>
    child.once('exit', () => {
      resolve();
    }),
  );
  child.kill('SIGTERM');
  const force = setTimeout(() => child.kill('SIGKILL'), 3000);
  try {
    await stopped;
  } finally {
    clearTimeout(force);
  }
}
async function account(fixture: Graph, employeeId: string, companyId: string) {
  const roleId = randomUUID(),
    login = `sec010-${randomUUID()}`,
    password = randomBytes(24).toString('base64url');
  try {
    const identity = (
      await fixture.db.query<{ id: string }>(
        'INSERT INTO identities(id,employee_id,login_name) VALUES($1,$2,$3) ON CONFLICT(employee_id) DO UPDATE SET login_name=EXCLUDED.login_name RETURNING id',
        [randomUUID(), employeeId, login],
      )
    ).rows[0];
    if (!identity) throw new Error('Synthetic identity missing');
    await fixture.db.query(
      "INSERT INTO password_credentials(identity_id,algorithm,password_hash) VALUES($1,'scrypt',$2)",
      [identity.id, await hasher.hash(password)],
    );
    await fixture.db.query(
      'INSERT INTO organization_memberships(employee_id,organization_id) VALUES($1,$2) ON CONFLICT DO NOTHING',
      [employeeId, companyId],
    );
    await fixture.db.query(
      "INSERT INTO roles(id,organization_id,code,name) VALUES($1,$2,$1::uuid::text,'Synthetic SEC010 role')",
      [roleId, companyId],
    );
    await fixture.db.query(
      'INSERT INTO employee_role_assignments(employee_id,role_id) VALUES($1,$2)',
      [employeeId, roleId],
    );
  } catch {
    throw new Error('Owned synthetic HTTP identity setup failed');
  }
  return { employeeId, roleId, login, password };
}
/** Local server only. Authentication material stays inside request closures, never fixture output. */
export async function ownedHttpApi(fixture: Graph) {
  const connection = process.env.DATABASE_URL;
  if (!connection) throw new Error('DATABASE_URL required');
  assertTestDatabaseTarget(connection, process.env.NODE_ENV);
  const target = new URL(connection);
  target.searchParams.set('options', `-csearch_path=${fixture.schema},public`);
  target.searchParams.set('application_name', `sec010_${randomUUID().replaceAll('-', '')}`);
  let child: ChildProcess | undefined, directory: string | undefined;
  const close = async () => {
    try {
      await stop(child);
    } finally {
      if (directory) await rm(directory, { recursive: true, force: false });
    }
  };
  try {
    const socket = createServer();
    await new Promise<void>((resolve) => socket.listen(0, '127.0.0.1', resolve));
    const address = socket.address();
    if (!address || typeof address === 'string') throw new Error('Owned HTTP port missing');
    await new Promise<void>((resolve, reject) =>
      socket.close((error) => {
        if (error) reject(error);
        else resolve();
      }),
    );
    const origin = `http://127.0.0.1:${String(address.port)}`;
    directory = await mkdtemp(join(tmpdir(), 'kt-sec010-http-'));
    child = spawn(process.execPath, ['--experimental-transform-types', 'apps/api/src/server.ts'], {
      cwd: fileURLToPath(new URL('../../../../', import.meta.url)),
      env: {
        ...process.env,
        NODE_ENV: 'test',
        DATABASE_URL: target.href,
        SESSION_SECRET: randomBytes(32).toString('hex'),
        SESSION_TTL_SECONDS: '3600',
        API_HOST: '127.0.0.1',
        API_PORT: String(address.port),
        TOKEN_LOGIN_ENABLED: 'true',
        PASSWORD_SALT_BYTES: '16',
        PASSWORD_KEY_LENGTH: '32',
        PASSWORD_SCRYPT_COST: '16384',
        PASSWORD_SCRYPT_BLOCK_SIZE: '8',
        PASSWORD_SCRYPT_PARALLELIZATION: '1',
        ATTACHMENT_STORAGE_ADAPTER: 'local',
        ATTACHMENT_LOCAL_DIRECTORY: directory,
        WEBSITE_LEAD_INGEST_SECRET: '',
      },
      stdio: 'ignore',
    });
    let ready = false;
    for (let attempt = 0; attempt < 200; attempt++) {
      if (child.exitCode !== null || child.signalCode !== null)
        throw new Error('Owned SEC010 API exited');
      try {
        ready = (await fetch(`${origin}/ready`, { signal: AbortSignal.timeout(500) })).ok;
      } catch {
        /* Bounded local readiness poll. */
      }
      if (ready) break;
      await delay(20);
    }
    if (!ready) throw new Error('Owned SEC010 readiness failed');
    async function user(employeeId: string, companyId: string) {
      const identity = await account(fixture, employeeId, companyId);
      const response = await fetch(`${origin}/api/v1/auth/token-login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ login: identity.login, password: identity.password }),
        signal: AbortSignal.timeout(10000),
      });
      if (response.status !== 200) throw new Error('Synthetic HTTP login failed');
      const result = (await response.json()) as { token?: unknown };
      if (typeof result.token !== 'string') throw new Error('Synthetic HTTP token missing');
      const token = result.token;
      return {
        async grant(capabilities: readonly string[], scopes: readonly DataScope[]) {
          await fixture.db.query(
            'DELETE FROM data_scope_grants WHERE employee_id=$1 AND permission_id IN(SELECT id FROM permissions WHERE capability=ANY($2::text[]))',
            [employeeId, capabilities],
          );
          await fixture.db.query(
            'DELETE FROM role_permission_grants WHERE role_id IN(SELECT role_id FROM employee_role_assignments WHERE employee_id=$1) AND permission_id IN(SELECT id FROM permissions WHERE capability=ANY($2::text[]))',
            [employeeId, capabilities],
          );
          if (scopes.length)
            await fixture.db.query(
              'INSERT INTO role_permission_grants(role_id,permission_id,data_scopes) SELECT $1,id,$2::data_scope[] FROM permissions WHERE capability=ANY($3::text[])',
              [identity.roleId, scopes, capabilities],
            );
        },
        request(path: string, method = 'GET', body?: unknown, key?: string) {
          return fetch(origin + path, {
            method,
            headers: {
              authorization: `Bearer ${token}`,
              'content-type': 'application/json',
              'x-correlation-id': randomUUID(),
              ...(key ? { 'idempotency-key': key } : {}),
            },
            ...(body === undefined ? {} : { body: JSON.stringify(body) }),
            signal: AbortSignal.timeout(10000),
          });
        },
      };
    }
    return { user, close };
  } catch (error) {
    await close();
    throw error;
  }
}
