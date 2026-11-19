import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Database, migrate } from '@kingturf/database';
import { PasswordHasher } from '../src/security.js';
import { PostgresSecurityStore } from '../src/repositories.js';

const connectionString = process.env.DATABASE_URL;
if (!connectionString)
  throw new Error('DATABASE_URL is required; PostgreSQL integration tests may not be skipped');

// A2-F5（空闲超时）：last_seen_at 窗口校验 + 节流写回——真实 PostgreSQL 全流。
describe('PostgreSQL session idle timeout behavior', () => {
  const schema = `api_idle_${randomUUID().replaceAll('-', '')}`;
  let admin: Database;
  let database: Database;
  let security: PostgresSecurityStore;
  const hasher = new PasswordHasher({
    saltBytes: 16,
    keyLength: 32,
    cost: 16_384,
    blockSize: 8,
    parallelization: 1,
  });
  const company = randomUUID();
  const departmentId = randomUUID();
  const employeeId = randomUUID();
  const identityLogin = 'idle-target';
  let passwordHash = '';
  let identityId = '';

  beforeAll(async () => {
    admin = new Database(connectionString);
    await admin.query(`CREATE SCHEMA ${schema}`);
    const scoped = new URL(connectionString);
    scoped.searchParams.set('options', `-csearch_path=${schema}`);
    database = new Database(scoped.toString());
    await migrate(database);
    security = new PostgresSecurityStore(database);
    await database.query(
      "INSERT INTO organizations(id,owner_organization_id,code,name,organization_type) VALUES($1,$1,'ROOT','Root','COMPANY')",
      [company],
    );
    await database.query(
      "INSERT INTO organizations(id,owner_organization_id,parent_id,code,name,organization_type) VALUES($1,$2,$2,'DEPT','Department','DEPARTMENT')",
      [departmentId, company],
    );
    await database.query(
      "INSERT INTO employees(id,company_id,organization_id,employee_number,display_name,normalized_email) VALUES($1,$2,$3,'E-9','Idle Target','idle-target@example.test')",
      [employeeId, company, departmentId],
    );
    await database.query(
      'INSERT INTO organization_memberships(organization_id,employee_id) VALUES($1,$2)',
      [company, employeeId],
    );
    passwordHash = await hasher.hash('correct horse battery staple');
    identityId = await security.provisionIdentity({
      employeeId,
      companyId: company,
      login: identityLogin,
      passwordHash,
      actorId: employeeId,
      correlationId: randomUUID(),
    });
  }, 60_000);

  afterAll(async () => {
    await database.close();
    await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await admin.close();
  });

  const createSession = async (tokenHash: string): Promise<void> => {
    expect(
      await security.createSession({
        identityId,
        employeeId,
        expectedPasswordHash: passwordHash,
        correlationId: randomUUID(),
        organizationId: company,
        tokenHash,
        expiresAt: new Date(Date.now() + 86_400_000),
      }),
    ).toBe(true);
  };

  const lastSeen = async (tokenHash: string): Promise<Date> => {
    const rows = await database.query<{ last_seen_at: Date }>(
      'SELECT last_seen_at FROM sessions WHERE token_hash=$1',
      [tokenHash],
    );
    const row = rows.rows[0];
    if (!row) throw new Error('session row missing');
    return row.last_seen_at;
  };

  it('stops resolving a session whose last_seen_at fell behind the idle cutoff', async () => {
    const tokenHash = 'b'.repeat(64);
    await createSession(tokenHash);
    const now = new Date();
    const fresh = new Date(now.getTime() - 60_000);
    await expect(security.resolveSession(tokenHash, now, fresh)).resolves.toBeTruthy();
    // Push the session beyond the idle window: the same cutoff style now misses.
    await database.query(
      "UPDATE sessions SET last_seen_at=now()-interval '2 hours' WHERE token_hash=$1",
      [tokenHash],
    );
    await expect(security.resolveSession(tokenHash, now, fresh)).resolves.toBeNull();
  });

  it('throttles the last_seen_at write-back to one update per minute', async () => {
    const tokenHash = 'c'.repeat(64);
    await createSession(tokenHash);
    const now = new Date();
    // The idle cutoff stays an hour back: the session is inside the idle window
    // on every resolve, so only the 60-second throttle gates the write-back.
    const fresh = new Date(now.getTime() - 3_600_000);
    const first = await lastSeen(tokenHash);
    // A resolve within the throttle window must not move last_seen_at.
    await expect(security.resolveSession(tokenHash, now, fresh)).resolves.toBeTruthy();
    expect((await lastSeen(tokenHash)).getTime()).toBe(first.getTime());
    // Force the throttle window to elapse and resolve again: last_seen advances.
    await database.query(
      "UPDATE sessions SET last_seen_at=now()-interval '90 seconds' WHERE token_hash=$1",
      [tokenHash],
    );
    const stale = await lastSeen(tokenHash);
    await expect(security.resolveSession(tokenHash, now, fresh)).resolves.toBeTruthy();
    expect((await lastSeen(tokenHash)).getTime()).toBeGreaterThan(stale.getTime());
  });
});
