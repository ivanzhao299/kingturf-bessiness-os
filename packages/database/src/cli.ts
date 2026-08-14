import { assertTestDatabaseTarget, Database, migrate, migrationStatus } from './index.ts';
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is required');
if (process.argv[2] === 'guard-test-target') {
  const target = new URL(connectionString);
  const databaseName = target.pathname.slice(1);
  assertTestDatabaseTarget(connectionString, process.env.NODE_ENV);
  process.stdout.write(`Verified disposable test database: ${databaseName}\n`);
  process.exit(0);
}
const database = new Database(connectionString);
try {
  if (process.argv[2] === 'migrate') await migrate(database);
  else if (process.argv[2] === 'status')
    console.log(JSON.stringify(await migrationStatus(database), null, 2));
  else throw new Error('Usage: cli.ts <migrate|status>');
} finally {
  await database.close();
}
