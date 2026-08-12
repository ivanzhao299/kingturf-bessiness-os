import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool, type PoolClient, type QueryResultRow } from 'pg';

export type SqlClient = {
  // The row generic intentionally models the selected projection of a parameterized query.
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
  query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: readonly unknown[],
  ): Promise<Readonly<{ rows: T[]; rowCount: number | null }>>;
};
export type Transaction = SqlClient;

export function assertTestDatabaseTarget(
  connectionString: string,
  nodeEnvironment: string | undefined,
): void {
  const target = new URL(connectionString);
  const databaseName = target.pathname.slice(1);
  const localHost = ['localhost', '127.0.0.1', '::1'].includes(target.hostname);
  if (nodeEnvironment !== 'test' || !localHost || !/(?:^|[_-])test(?:$|[_-])/u.test(databaseName))
    throw new Error(
      'Refusing CI database target: require NODE_ENV=test, a loopback host, and a database name containing a test segment',
    );
}

export class Database {
  readonly #pool: Pool;
  public constructor(connectionString: string) {
    this.#pool = new Pool({ connectionString, max: 10 });
  }
  public query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    values: readonly unknown[] = [],
  ) {
    return this.#pool.query<T>(text, [...values]);
  }
  public async transaction<T>(work: (transaction: Transaction) => Promise<T>): Promise<T> {
    const client: PoolClient = await this.#pool.connect();
    try {
      await client.query('BEGIN');
      const value = await work(client);
      await client.query('COMMIT');
      return value;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  public async close(): Promise<void> {
    await this.#pool.end();
  }
}

export const migrationsDirectory = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'migrations',
);
export type MigrationState = 'pending' | 'applied' | 'drifted';
export type MigrationStatus = Readonly<{
  name: string;
  checksum: string | null;
  storedChecksum: string | null;
  state: MigrationState;
}>;
const checksum = (contents: string): string =>
  createHash('sha256').update(contents, 'utf8').digest('hex');
// Digests shipped with the first checksum-aware release. They are intentionally
// code constants: deriving a missing legacy checksum from today's file would
// silently bless a modified historical migration.
const legacyChecksums: Readonly<Record<string, string>> = {
  '0001_identity_authorization_foundation.sql':
    'c53c5cf749da1135ca7bed9ecaa91f74f461dd6e252d11c2eca0a5a02aa694ee',
  '0002_tenant_integrity.sql': '918c043b124b539fc702582f166daff6552feee0594be2e08484eea8e1e05538',
  '0003_identity_authorization_hardening.sql':
    'f47063fa8acd913682abc8d11d0bc6440ec9e377e6df20fe57883746345ea71d',
};
async function migrationFiles(
  directory = migrationsDirectory,
): Promise<Map<string, Readonly<{ sql: string; checksum: string }>>> {
  const names = (await readdir(directory)).filter((name) => /^\d+.*\.sql$/u.test(name)).sort();
  return new Map(
    await Promise.all(
      names.map(async (name) => {
        const sql = await readFile(join(directory, name), 'utf8');
        return [name, { sql, checksum: checksum(sql) }] as const;
      }),
    ),
  );
}
export async function migrationStatus(
  database: SqlClient,
  directory = migrationsDirectory,
): Promise<readonly MigrationStatus[]> {
  await database.query(
    'CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())',
  );
  await database.query('ALTER TABLE schema_migrations ADD COLUMN IF NOT EXISTS checksum char(64)');
  const files = await migrationFiles(directory);
  const applied = await database.query<{ name: string; checksum: string | null }>(
    'SELECT name,checksum FROM schema_migrations ORDER BY name',
  );
  const rows: MigrationStatus[] = [];
  for (const row of applied.rows) {
    const file = files.get(row.name);
    rows.push({
      name: row.name,
      checksum: file?.checksum ?? null,
      storedChecksum: row.checksum,
      state: !file || !row.checksum || row.checksum !== file.checksum ? 'drifted' : 'applied',
    });
    files.delete(row.name);
  }
  for (const [name, file] of files)
    rows.push({ name, checksum: file.checksum, storedChecksum: null, state: 'pending' });
  return rows.sort((a, b) => a.name.localeCompare(b.name));
}
export async function migrate(database: Database, directory = migrationsDirectory): Promise<void> {
  let status = await migrationStatus(database, directory);
  // One-time upgrade of pre-checksum databases, using release-pinned digests.
  const legacy = status.filter(
    (item) => item.state === 'drifted' && item.checksum !== null && item.storedChecksum === null,
  );
  if (legacy.length)
    await database.transaction(async (tx) => {
      for (const item of legacy) {
        const trusted = legacyChecksums[item.name];
        if (!trusted || trusted !== item.checksum)
          throw new Error(`Migration integrity check failed: ${item.name}`);
        await tx.query(
          'UPDATE schema_migrations SET checksum=$2 WHERE name=$1 AND checksum IS NULL',
          [item.name, trusted],
        );
      }
    });
  status = await migrationStatus(database, directory);
  const drifted = status.filter((item) => item.state === 'drifted');
  if (drifted.length)
    throw new Error(
      `Migration integrity check failed: ${drifted.map((item) => item.name).join(', ')}`,
    );
  const files = await migrationFiles(directory);
  for (const item of status) {
    if (item.state === 'applied') continue;
    const file = files.get(item.name);
    if (!file) throw new Error(`Migration file missing: ${item.name}`);
    await database.transaction(async (tx) => {
      await tx.query(file.sql);
      await tx.query('INSERT INTO schema_migrations(name,checksum) VALUES ($1,$2)', [
        item.name,
        file.checksum,
      ]);
    });
  }
  await database.query('ALTER TABLE schema_migrations ALTER COLUMN checksum SET NOT NULL');
}
