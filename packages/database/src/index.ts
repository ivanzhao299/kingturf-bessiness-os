import { readFile, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool, type PoolClient, type QueryResultRow } from 'pg';

// The row generic intentionally models the selected projection of a parameterized query.
// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
export type SqlClient = { query<T extends QueryResultRow = QueryResultRow>(text: string, values?: readonly unknown[]): Promise<Readonly<{ rows: T[]; rowCount: number | null }>> };
export type Transaction = SqlClient;

export class Database {
  readonly #pool: Pool;
  public constructor(connectionString: string) { this.#pool = new Pool({ connectionString, max: 10 }); }
  public query<T extends QueryResultRow = QueryResultRow>(text: string, values: readonly unknown[] = []) { return this.#pool.query<T>(text, [...values]); }
  public async transaction<T>(work: (transaction: Transaction) => Promise<T>): Promise<T> {
    const client: PoolClient = await this.#pool.connect();
    try { await client.query('BEGIN'); const value = await work(client); await client.query('COMMIT'); return value; }
    catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  }
  public async close(): Promise<void> { await this.#pool.end(); }
}

export const migrationsDirectory = join(dirname(fileURLToPath(import.meta.url)), '..', 'migrations');
export async function migrationStatus(database: SqlClient): Promise<readonly Readonly<{ name: string; applied: boolean }>[]> {
  await database.query('CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
  const files = (await readdir(migrationsDirectory)).filter((name) => /^\d+.*\.sql$/u.test(name)).sort();
  const applied = await database.query<{ name: string }>('SELECT name FROM schema_migrations');
  const names = new Set(applied.rows.map(({ name }) => name));
  return files.map((name) => ({ name, applied: names.has(name) }));
}
export async function migrate(database: Database): Promise<void> {
  for (const item of await migrationStatus(database)) {
    if (item.applied) continue;
    const sql = await readFile(join(migrationsDirectory, item.name), 'utf8');
    await database.transaction(async (tx) => { await tx.query(sql); await tx.query('INSERT INTO schema_migrations(name) VALUES ($1)', [item.name]); });
  }
}
