import { copyFileSync, mkdtempSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  assertMigrationsCurrent,
  assertTestDatabaseTarget,
  Database,
  migrate,
  migrationStatus,
} from '../src/index.js';

const connection = process.env.DATABASE_URL;
if (!connection) throw new Error('DATABASE_URL required; startup gate tests may not be skipped');
assertTestDatabaseTarget(connection, process.env.NODE_ENV);

describe('production startup migration gate', () => {
  const suffix = randomUUID().replaceAll('-', '');
  const schema70 = `startupgate70_${suffix}`;
  const schemaFull = `startupgatefull_${suffix}`;
  const migrations = join(import.meta.dirname, '..', 'migrations');
  let admin: Database, prefixOnly: Database, fullyMigrated: Database;

  beforeAll(async () => {
    admin = new Database(connection);
    await admin.query(`CREATE SCHEMA ${schema70}`);
    await admin.query(`CREATE SCHEMA ${schemaFull}`);
    const url = (extra: string): string => {
      const target = new URL(connection);
      target.searchParams.set('options', `-csearch_path=${extra}`);
      return target.toString();
    };
    const files = readdirSync(migrations)
      .filter((name) => /^\d+.*\.sql$/u.test(name))
      .sort();
    if (files.length !== 72)
      throw new Error(`expected 72 candidate migrations, found ${String(files.length)}`);
    const filtered = mkdtempSync(join(tmpdir(), 'kingturf-startup-gate-'));
    for (const name of files.slice(0, 70))
      copyFileSync(join(migrations, name), join(filtered, name));
    prefixOnly = new Database(url(schema70));
    await migrate(prefixOnly, filtered);
    fullyMigrated = new Database(url(schemaFull));
    await migrate(fullyMigrated, migrations);
  }, 180_000);

  afterAll(async () => {
    await prefixOnly.close();
    await fullyMigrated.close();
    await admin.query(`DROP SCHEMA IF EXISTS ${schema70} CASCADE`);
    await admin.query(`DROP SCHEMA IF EXISTS ${schemaFull} CASCADE`);
    await admin.close();
  });

  it('reports the 70-of-72 prefix as pending, mirroring the verified production registry', async () => {
    const status = await migrationStatus(prefixOnly);
    expect(status.filter((item) => item.state === 'applied')).toHaveLength(70);
    expect(status.filter((item) => item.state === 'pending').map((item) => item.name)).toEqual([
      '0071_inventory_stock_resource_guards.sql',
      '0072_production_return_guards.sql',
    ]);
  });

  it('refuses production startup when the registry is a 70-of-72 prefix', async () => {
    await expect(assertMigrationsCurrent(prefixOnly)).rejects.toThrow(
      /Migration compatibility check failed: 0071_inventory_stock_resource_guards\.sql:pending/,
    );
  });

  it('accepts production startup when the registry is fully migrated', async () => {
    const status = await migrationStatus(fullyMigrated);
    expect(status.every((item) => item.state === 'applied')).toBe(true);
    await expect(assertMigrationsCurrent(fullyMigrated)).resolves.toBeUndefined();
  });
});
