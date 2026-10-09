import { randomBytes, randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  assertMigrationsCurrent,
  assertTestDatabaseTarget,
  Database,
  migrate,
  migrationStatus,
} from '../src/index.js';

const connection = process.env.DATABASE_URL;
if (!connection)
  throw new Error('DATABASE_URL required; read-only compatibility tests may not be skipped');
assertTestDatabaseTarget(connection, process.env.NODE_ENV);

describe('read-only production migration compatibility', () => {
  const schema = `readonly_schema_${randomUUID().replaceAll('-', '')}`;
  const role = `readonly_role_${randomUUID().replaceAll('-', '')}`;
  const password = randomBytes(24).toString('hex');
  let admin: Database, db: Database, reader: Database;
  let knownName: string, knownHash: string;
  beforeAll(async () => {
    admin = new Database(connection);
    await admin.query(`CREATE SCHEMA ${schema}`);
    const url = new URL(connection);
    url.searchParams.set('options', `-csearch_path=${schema}`);
    db = new Database(url.toString());
    await migrate(db);
    const first = (
      await db.query<{ name: string; checksum: string }>(
        'SELECT name,checksum FROM schema_migrations ORDER BY name LIMIT 1',
      )
    ).rows[0];
    if (!first) throw new Error('Migrated fixture registry missing');
    knownName = first.name;
    knownHash = first.checksum;
    await admin.query(`CREATE ROLE ${role} LOGIN PASSWORD '${password}'`);
    await admin.query(`ALTER ROLE ${role} SET default_transaction_read_only=on`);
    await admin.query(`GRANT USAGE ON SCHEMA ${schema} TO ${role}`);
    await db.query(`GRANT SELECT ON schema_migrations TO ${role}`);
    url.username = role;
    url.password = password;
    reader = new Database(url.toString());
  }, 30_000);
  afterAll(async () => {
    await reader.close();
    await db.close();
    {
      await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
      await admin.query(`DROP OWNED BY ${role}`);
      await admin.query(`DROP ROLE ${role}`);
      await admin.close();
    }
  });
  it('accepts all 70 checksums using a SELECT-only role with read-only transactions', async () => {
    expect(
      (await reader.query<{ transaction_read_only: string }>('SHOW transaction_read_only')).rows[0]
        ?.transaction_read_only,
    ).toBe('on');
    await assertMigrationsCurrent(reader);
    const status = await migrationStatus(reader);
    expect(status).toHaveLength(70);
    expect(status.every((item) => item.state === 'applied')).toBe(true);
    await expect(
      reader.query('CREATE TABLE forbidden_readonly_write(id integer)'),
    ).rejects.toThrow();
  });
  it('rejects pending migrations without re-inserting the missing registry row', async () => {
    await db.query('DELETE FROM schema_migrations WHERE name=$1', [knownName]);
    try {
      await expect(assertMigrationsCurrent(reader)).rejects.toThrow(/pending/u);
      expect(
        (await db.query('SELECT name FROM schema_migrations WHERE name=$1', [knownName])).rows,
      ).toEqual([]);
    } finally {
      await db.query('INSERT INTO schema_migrations(name,checksum) VALUES($1,$2)', [
        knownName,
        knownHash,
      ]);
    }
  });
  it('rejects drift without repairing a changed checksum', async () => {
    await db.query("UPDATE schema_migrations SET checksum=repeat('0',64) WHERE name=$1", [
      knownName,
    ]);
    try {
      await expect(assertMigrationsCurrent(reader)).rejects.toThrow(/drifted/u);
      expect(
        (
          await db.query<{ checksum: string }>(
            'SELECT checksum FROM schema_migrations WHERE name=$1',
            [knownName],
          )
        ).rows[0]?.checksum,
      ).toBe('0'.repeat(64));
    } finally {
      await db.query('UPDATE schema_migrations SET checksum=$2 WHERE name=$1', [
        knownName,
        knownHash,
      ]);
    }
  });
  it('rejects unknown future migrations rather than treating an old application as compatible', async () => {
    await db.query(
      "INSERT INTO schema_migrations(name,checksum) VALUES('9999_future.sql',repeat('1',64))",
    );
    try {
      await expect(assertMigrationsCurrent(reader)).rejects.toThrow(/9999_future.sql:drifted/u);
    } finally {
      await db.query("DELETE FROM schema_migrations WHERE name='9999_future.sql'");
    }
  });
  it('rejects legacy null checksums without automatic backfill', async () => {
    await db.query('ALTER TABLE schema_migrations ALTER COLUMN checksum DROP NOT NULL');
    await db.query('UPDATE schema_migrations SET checksum=NULL WHERE name=$1', [knownName]);
    try {
      await expect(assertMigrationsCurrent(reader)).rejects.toThrow(/drifted/u);
      expect(
        (await db.query('SELECT checksum FROM schema_migrations WHERE name=$1', [knownName]))
          .rows[0]?.checksum,
      ).toBeNull();
    } finally {
      await db.query('UPDATE schema_migrations SET checksum=$2 WHERE name=$1', [
        knownName,
        knownHash,
      ]);
      await db.query('ALTER TABLE schema_migrations ALTER COLUMN checksum SET NOT NULL');
    }
  });
  it('does not create a missing registry', async () => {
    await db.query('ALTER TABLE schema_migrations RENAME TO saved_registry');
    try {
      await expect(migrationStatus(reader)).rejects.toThrow(/schema_migrations/u);
      expect(
        (await db.query("SELECT to_regclass('schema_migrations') AS registry")).rows[0]?.registry,
      ).toBeNull();
    } finally {
      await db.query('ALTER TABLE saved_registry RENAME TO schema_migrations');
    }
  });
  it('does not add a missing checksum column', async () => {
    await db.query('ALTER TABLE schema_migrations RENAME COLUMN checksum TO saved_checksum');
    try {
      await expect(migrationStatus(reader)).rejects.toThrow(/checksum/u);
      expect(
        (
          await db.query(
            "SELECT column_name FROM information_schema.columns WHERE table_schema=$1 AND table_name='schema_migrations' AND column_name='checksum'",
            [schema],
          )
        ).rows,
      ).toEqual([]);
    } finally {
      await db.query('ALTER TABLE schema_migrations RENAME COLUMN saved_checksum TO checksum');
    }
  });
});
