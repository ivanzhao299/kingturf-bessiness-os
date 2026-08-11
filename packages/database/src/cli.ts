import { Database, migrate, migrationStatus } from './index.ts';
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is required');
const database = new Database(connectionString);
try {
  if (process.argv[2] === 'migrate') await migrate(database);
  else if (process.argv[2] === 'status')
    console.log(JSON.stringify(await migrationStatus(database), null, 2));
  else throw new Error('Usage: cli.ts <migrate|status>');
} finally {
  await database.close();
}
