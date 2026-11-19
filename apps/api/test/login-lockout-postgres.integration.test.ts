import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Database, migrate } from '@kingturf/database';
import {
  DEFAULT_LOGIN_LOCKOUT,
  AuthenticationService,
  PasswordHasher,
  type LoginLockoutConfig,
} from '../src/security.js';
import { PostgresSecurityStore } from '../src/repositories.js';

const connectionString = process.env.DATABASE_URL;
if (!connectionString)
  throw new Error('DATABASE_URL is required; PostgreSQL integration tests may not be skipped');

// A-F2a（A2-F1）：持久登录锁定全流——递增/阈值置位/锁定拒绝+审计/解锁/成功清零。
describe('PostgreSQL persistent login lockout behavior', () => {
  const schema = `api_lockout_${randomUUID().replaceAll('-', '')}`;
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
  const lockout: LoginLockoutConfig = { attempts: 5, windowSeconds: 900 };
  const company = randomUUID();
  const employeeId = randomUUID();
  const identityLogin = 'lockout-target';
  let passwordHash = '';

  beforeAll(async () => {
    admin = new Database(connectionString);
    await admin.query(`CREATE SCHEMA ${schema}`);
    const scoped = new URL(connectionString);
    scoped.searchParams.set('options', `-csearch_path=${schema}`);
    database = new Database(scoped.toString());
    await migrate(database);
    security = new PostgresSecurityStore(database);
    const departmentId = randomUUID();
    await database.query(
      "INSERT INTO organizations(id,owner_organization_id,code,name,organization_type) VALUES($1,$1,'ROOT','Root','COMPANY')",
      [company],
    );
    await database.query(
      "INSERT INTO organizations(id,owner_organization_id,parent_id,code,name,organization_type) VALUES($1,$2,$2,'DEPT','Department','DEPARTMENT')",
      [departmentId, company],
    );
    await database.query(
      "INSERT INTO employees(id,company_id,organization_id,employee_number,display_name,normalized_email) VALUES($1,$2,$3,'E-1','Lockout Target','lockout-target@example.test')",
      [employeeId, company, departmentId],
    );
    await database.query(
      'INSERT INTO organization_memberships(organization_id,employee_id) VALUES($1,$2)',
      [company, employeeId],
    );
    passwordHash = await hasher.hash('correct horse battery staple');
    await security.provisionIdentity({
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

  const lockState = async (): Promise<{ failed_attempts: number; locked_until: Date | null }> => {
    const rows = await database.query<{ failed_attempts: number; locked_until: Date | null }>(
      'SELECT failed_attempts,locked_until FROM identities WHERE login_name=$1',
      [identityLogin],
    );
    const state = rows.rows[0];
    if (!state) throw new Error('lockout target identity missing');
    return state;
  };

  const rateLimitedAudits = async (): Promise<number> => {
    const rows = await database.query<{ count: string }>(
      "SELECT count(*) count FROM audit_events WHERE action='auth.rate_limited' AND outcome='FAILURE'",
    );
    const row = rows.rows[0];
    if (!row) throw new Error('audit count query returned no rows');
    return Number(row.count);
  };

  it('increments failed attempts on wrong passwords without locking below the threshold', async () => {
    for (let attempt = 1; attempt <= DEFAULT_LOGIN_LOCKOUT.attempts - 1; attempt += 1) {
      const credential = await security.findForLogin(identityLogin);
      if (!credential) throw new Error('credential missing');
      expect(credential.failedAttempts).toBe(attempt - 1);
      await security.recordLoginFailure({ identityId: credential.identityId, ...lockout });
    }
    const before = await lockState();
    expect(before.failed_attempts).toBe(4);
    expect(before.locked_until).toBeNull();
  });

  it('locks the account when the threshold is crossed and keeps the window fixed', async () => {
    const credential = await security.findForLogin(identityLogin);
    if (!credential) throw new Error('credential missing');
    await security.recordLoginFailure({ identityId: credential.identityId, ...lockout });
    const locked = await lockState();
    expect(locked.failed_attempts).toBe(5);
    expect(locked.locked_until).not.toBeNull();
    if (!locked.locked_until) throw new Error('lock window missing');
    const lockedAt = locked.locked_until.getTime() - Date.now();
    expect(lockedAt).toBeGreaterThan(890_000);
    expect(lockedAt).toBeLessThanOrEqual(900_000);
  });

  it('keeps recording attempts after the lock while the window stays fixed', async () => {
    const credential = await security.findForLogin(identityLogin);
    if (!credential) throw new Error('credential missing');
    await security.recordLoginFailure({ identityId: credential.identityId, ...lockout });
    const locked = await lockState();
    expect(locked.failed_attempts).toBe(6);
    if (!locked.locked_until) throw new Error('lock window missing');
    const lockedAt = locked.locked_until.getTime() - Date.now();
    expect(lockedAt).toBeGreaterThan(890_000);
  });

  it('audits plain failures as auth.login and lockout hits as auth.rate_limited', async () => {
    // Full pipeline: the real login() path against the real audit repository —
    // plain failures append auth.login rows while the locked window appends the
    // A2-F8 rate-limited failure rows (no sensitive metadata).
    expect(await rateLimitedAudits()).toBe(0);
    const before = await database.query<{ count: string }>(
      "SELECT count(*) count FROM audit_events WHERE action='auth.login' AND outcome='FAILURE'",
    );
    const service = new AuthenticationService(
      security,
      hasher,
      { secret: 'audit-secret', ttlSeconds: 3600 },
      security, // PostgresSecurityStore doubles as the audit sink (server.ts wiring).
      lockout,
    );
    const beyondLock = await lockState();
    expect(beyondLock.locked_until).not.toBeNull();
    await expect(
      service.login(identityLogin, 'correct horse battery staple', randomUUID()),
    ).resolves.toBeNull();
    expect(await rateLimitedAudits()).toBe(1);
    const rows = await database.query<{ metadata: Record<string, unknown> | null }>(
      "SELECT metadata FROM audit_events WHERE action='auth.rate_limited' AND outcome='FAILURE' ORDER BY occurred_at DESC LIMIT 1",
    );
    const latest = rows.rows[0];
    if (!latest) throw new Error('rate_limited audit row missing');
    expect(latest.metadata).toEqual({ reason: 'persistent_lockout' });
    const after = await database.query<{ count: string }>(
      "SELECT count(*) count FROM audit_events WHERE action='auth.login' AND outcome='FAILURE'",
    );
    if (!before.rows[0] || !after.rows[0]) throw new Error('audit count rows missing');
    expect(Number(after.rows[0].count)).toBe(Number(before.rows[0].count));
  });

  it('clears the counters atomically when a login finally succeeds', async () => {
    const credential = await security.findForLogin(identityLogin);
    if (!credential) throw new Error('credential missing');
    expect(credential.lockedUntil).not.toBeNull();
    const created = await security.createSession({
      identityId: credential.identityId,
      employeeId: credential.employeeId,
      expectedPasswordHash: passwordHash,
      correlationId: randomUUID(),
      organizationId: company,
      tokenHash: 'a'.repeat(64),
      expiresAt: new Date(Date.now() + 3_600_000),
    });
    expect(created).toBe(true);
    const cleared = await lockState();
    expect(cleared.failed_attempts).toBe(0);
    expect(cleared.locked_until).toBeNull();
  });
});
