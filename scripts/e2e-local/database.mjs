// 专用库生命周期（在宿主机执行）：create / drop / migrate / status。只连两类目标——postgres
// 维护库（仅建库/删库）与专用库本身；库名硬闸见 db-target.mjs。
// 用法：E2E_LOCAL_ADMIN_DATABASE_URL=… node scripts/e2e-local/database.mjs <create|drop|migrate|status> [--database 名称]
import assert from 'node:assert/strict';
import { parseArgs } from 'node:util';
import {
  assertDedicatedName,
  dedicatedDatabaseName,
  dedicatedUrl,
  maintenanceUrl,
} from './db-target.mjs';

const { Database, migrate, migrationStatus } = await import(
  new URL('../../packages/database/src/index.ts', import.meta.url)
);

// 标识符不能参数化：先过库名硬闸（只允许 [a-z0-9_] 且含 test 段、非共享库），再拼入语句。
const identifier = (name) => `"${assertDedicatedName(name)}"`;

export async function createDatabase(name = dedicatedDatabaseName()) {
  const maintenance = new Database(maintenanceUrl());
  try {
    const existing = await maintenance.query('SELECT 1 FROM pg_database WHERE datname = $1', [
      name,
    ]);
    assert.equal(
      existing.rowCount,
      0,
      `database ${name} already exists; drop it first or set E2E_LOCAL_DATABASE to another dedicated name`,
    );
    await maintenance.query(`CREATE DATABASE ${identifier(name)}`);
  } finally {
    await maintenance.close();
  }
  return name;
}

export async function dropDatabase(name) {
  const maintenance = new Database(maintenanceUrl());
  try {
    const existing = await maintenance.query('SELECT 1 FROM pg_database WHERE datname = $1', [
      name,
    ]);
    // 不用 FORCE：仍有连接说明栈没拆干净，应当报错而不是把别人的会话踢掉。
    if (existing.rowCount > 0) await maintenance.query(`DROP DATABASE ${identifier(name)}`);
    return existing.rowCount > 0;
  } finally {
    await maintenance.close();
  }
}

export async function migrateDatabase() {
  const database = new Database(dedicatedUrl());
  try {
    await migrate(database);
  } finally {
    await database.close();
  }
}

export async function databaseStatus() {
  const database = new Database(dedicatedUrl());
  try {
    const status = await migrationStatus(database);
    return {
      database: dedicatedDatabaseName(),
      migrations: status.length,
      applied: status.filter((item) => item.state === 'applied').length,
    };
  } finally {
    await database.close();
  }
}

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: { database: { type: 'string' } },
  });
  const [action] = positionals;
  assert(['create', 'drop', 'migrate', 'status'].includes(action), usage());
  if (values.database) process.env.E2E_LOCAL_DATABASE = assertDedicatedName(values.database);
  if (action === 'create')
    console.log(JSON.stringify({ event: 'database-created', database: await createDatabase() }));
  if (action === 'drop')
    console.log(
      JSON.stringify({
        event: 'database-dropped',
        database: dedicatedDatabaseName(),
        existed: await dropDatabase(dedicatedDatabaseName()),
      }),
    );
  if (action === 'migrate') {
    await migrateDatabase();
    console.log(JSON.stringify({ event: 'database-migrated', ...databaseStatus() }));
  }
  if (action === 'status')
    console.log(JSON.stringify({ event: 'database-status', ...(await databaseStatus()) }));
}

function usage() {
  return 'usage: node scripts/e2e-local/database.mjs <create|drop|migrate|status> [--database name]';
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  main().catch((error) => {
    console.error(`database: ${error.message}`);
    process.exitCode = 1;
  });
}
