import { randomBytes, randomUUID } from 'node:crypto';
import { spawn, type ChildProcess } from 'node:child_process';
import { createServer } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { assertTestDatabaseTarget, Database, migrate } from '@kingturf/database';

const connection = process.env.DATABASE_URL;
if (!connection)
  throw new Error('DATABASE_URL required; production startup tests may not be skipped');
assertTestDatabaseTarget(connection, process.env.NODE_ENV);

describe('real production-mode HTTP startup without database mutation', () => {
  const schema = `prod_start_${randomUUID().replaceAll('-', '')}`,
    role = `prod_reader_${randomUUID().replaceAll('-', '')}`;
  const password = randomBytes(24).toString('hex'),
    secret = randomBytes(32).toString('hex');
  const children: ChildProcess[] = [];
  let admin: Database, db: Database, url: URL, name: string, hash: string;
  beforeAll(async () => {
    admin = new Database(connection);
    await admin.query(`CREATE SCHEMA ${schema}`);
    url = new URL(connection);
    url.searchParams.set('options', `-csearch_path=${schema}`);
    db = new Database(url.toString());
    await migrate(db);
    const first = (
      await db.query<{ name: string; checksum: string }>(
        'SELECT name,checksum FROM schema_migrations ORDER BY name LIMIT 1',
      )
    ).rows[0];
    if (!first) throw new Error('Registry fixture missing');
    name = first.name;
    hash = first.checksum;
    await admin.query(`CREATE ROLE ${role} LOGIN PASSWORD '${password}'`);
    await admin.query(`ALTER ROLE ${role} SET default_transaction_read_only=on`);
    await admin.query(`GRANT USAGE ON SCHEMA ${schema} TO ${role}`);
    await db.query(`GRANT SELECT ON schema_migrations TO ${role}`);
    url.username = role;
    url.password = password;
  }, 30_000);
  async function launch() {
    const socket = createServer();
    await new Promise<void>((resolve) => socket.listen(0, '127.0.0.1', resolve));
    const address = socket.address();
    if (!address || typeof address === 'string') throw new Error('Test port unavailable');
    await new Promise<void>((resolve, reject) =>
      socket.close((error) => {
        if (error) reject(error);
        else resolve();
      }),
    );
    const logs: string[] = [];
    const child = spawn(
      process.execPath,
      ['--experimental-transform-types', 'apps/api/src/server.ts'],
      {
        cwd: fileURLToPath(new URL('../../../', import.meta.url)),
        env: {
          ...process.env,
          NODE_ENV: 'production',
          DATABASE_URL: url.toString(),
          API_HOST: '127.0.0.1',
          API_PORT: String(address.port),
          SESSION_SECRET: secret,
          SESSION_TTL_SECONDS: '3600',
          PASSWORD_SALT_BYTES: '16',
          PASSWORD_KEY_LENGTH: '32',
          PASSWORD_SCRYPT_COST: '16384',
          PASSWORD_SCRYPT_BLOCK_SIZE: '8',
          PASSWORD_SCRYPT_PARALLELIZATION: '1',
          ATTACHMENT_STORAGE_ADAPTER: 'local',
          ATTACHMENT_LOCAL_DIRECTORY: `/var/lib/kingturf/${schema}`,
          WEBSITE_LEAD_INGEST_SECRET: secret,
          KINGTURF_RELEASE_SHA: '1'.repeat(40),
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );
    children.push(child);
    child.stdout.on('data', (chunk: Buffer) => logs.push(chunk.toString()));
    child.stderr.on('data', (chunk: Buffer) => logs.push(chunk.toString()));
    const origin = `http://127.0.0.1:${String(address.port)}`;
    let ready = false;
    for (let attempt = 0; attempt < 200; attempt++) {
      if (child.exitCode !== null || child.signalCode !== null) break;
      try {
        ready = (await fetch(`${origin}/ready`, { signal: AbortSignal.timeout(200) })).ok;
      } catch {
        /* bounded startup */
      }
      if (ready) break;
      await delay(20);
    }
    expect(logs.join('')).not.toContain(password);
    expect(logs.join('')).not.toContain(secret);
    return { child, origin, ready, logs };
  }
  async function stop(child: ChildProcess) {
    if (child.exitCode !== null || child.signalCode !== null) return;
    await new Promise<void>((resolve, reject) => {
      const force = setTimeout(() => child.kill('SIGKILL'), 2000);
      const deadline = setTimeout(() => {
        reject(new Error('Production startup test process cleanup deadline'));
      }, 5000);
      child.once('exit', () => {
        clearTimeout(force);
        clearTimeout(deadline);
        resolve();
      });
      child.kill('SIGTERM');
    });
  }
  afterAll(async () => {
    for (const child of children) await stop(child);
    await db.close();
    {
      await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
      await admin.query(`DROP OWNED BY ${role}`);
      await admin.query(`DROP ROLE ${role}`);
      await admin.close();
    }
  });
  it('starts with a truly SELECT-only role, serves exact version and still requires authentication', async () => {
    const before = (await db.query('SELECT name,checksum FROM schema_migrations ORDER BY name'))
      .rows;
    const server = await launch();
    try {
      expect(server.ready, server.logs.join('')).toBe(true);
      expect(await (await fetch(`${server.origin}/health`)).json()).toEqual({ status: 'ok' });
      expect(await (await fetch(`${server.origin}/version`)).json()).toMatchObject({
        sha: '1'.repeat(40),
        environment: 'production',
      });
      expect((await fetch(`${server.origin}/api/v1/customers`)).status).toBe(401);
      expect(
        (await db.query('SELECT name,checksum FROM schema_migrations ORDER BY name')).rows,
      ).toEqual(before);
    } finally {
      await stop(server.child);
    }
  });
  it('fails closed before HTTP listening when a migration is pending', async () => {
    await db.query('DELETE FROM schema_migrations WHERE name=$1', [name]);
    try {
      const result = await launch();
      expect(result.ready).toBe(false);
      expect(result.child.exitCode).not.toBeNull();
      expect(result.logs.join('')).toContain(':pending');
    } finally {
      await db.query('INSERT INTO schema_migrations(name,checksum) VALUES($1,$2)', [name, hash]);
    }
  });
  it('fails closed rather than repairing drifted checksums', async () => {
    await db.query("UPDATE schema_migrations SET checksum=repeat('0',64) WHERE name=$1", [name]);
    try {
      const result = await launch();
      expect(result.ready).toBe(false);
      expect(result.logs.join('')).toContain(':drifted');
      expect(
        (await db.query('SELECT checksum FROM schema_migrations WHERE name=$1', [name])).rows[0]
          ?.checksum,
      ).toBe('0'.repeat(64));
    } finally {
      await db.query('UPDATE schema_migrations SET checksum=$2 WHERE name=$1', [name, hash]);
    }
  });
  it('fails before HTTP listening without creating a missing registry', async () => {
    await db.query('ALTER TABLE schema_migrations RENAME TO saved_registry');
    try {
      const result = await launch();
      expect(result.ready).toBe(false);
      expect(
        (await db.query("SELECT to_regclass('schema_migrations') AS registry")).rows[0]?.registry,
      ).toBeNull();
    } finally {
      await db.query('ALTER TABLE saved_registry RENAME TO schema_migrations');
    }
  });
});
