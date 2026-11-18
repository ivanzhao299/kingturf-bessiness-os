// D5（ADR-0013）：真实 PostgreSQL——迁移 0074 两表+触发器、键白名单/schema、
// 单向发布与指针推进、幂等重放、同事务审计、默认回落。
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Database, migrate } from '@kingturf/database';
import {
  PostgresTenantSettingsRepository,
  validateTenantSettingValue,
} from '../src/tenant-settings-repositories.js';
import { DomainError } from '@kingturf/domain';

const connection = process.env.DATABASE_URL;
if (!connection) throw new Error('DATABASE_URL required; tenant settings tests may not be skipped');

describe('tenant settings on real PostgreSQL (D5)', () => {
  const schema = `tenant_settings_${randomUUID().replaceAll('-', '')}`;
  let admin: Database;
  let db: Database;
  let repository: PostgresTenantSettingsRepository;
  const company = randomUUID();
  const actor = { employeeId: randomUUID(), companyId: company } as const;

  beforeAll(async () => {
    admin = new Database(connection);
    await admin.query(`CREATE SCHEMA ${schema}`);
    const scoped = new URL(connection);
    scoped.searchParams.set('options', `-csearch_path=${schema}`);
    db = new Database(scoped.toString());
    await migrate(db);
    await db.query(
      "INSERT INTO organizations(id,owner_organization_id,code,name,organization_type) VALUES($1,$1,'TS','TenantSettings','COMPANY')",
      [company],
    );
    await db.query(
      'INSERT INTO employees(id,company_id,organization_id,employee_number,display_name,normalized_email) VALUES($1,$2,$2,$3,$3,$4)',
      [actor.employeeId, company, 'TS-ACTOR', `${actor.employeeId}@example.test`],
    );
    repository = new PostgresTenantSettingsRepository(db);
  });
  afterAll(async () => {
    await db.close();
    await admin.query(`DROP SCHEMA ${schema} CASCADE`);
    await admin.close();
  });

  it('validates the whitelist and per-key schemas', () => {
    expect(validateTenantSettingValue('security.password.minLength', 12)).toBe(12);
    expect(validateTenantSettingValue('ux.loginNoticeText', '系统维护公告')).toBe('系统维护公告');
    for (const [key, value] of [
      ['security.password.minLength', 7],
      ['security.password.minLength', 129],
      ['security.password.minLength', '12'],
      ['security.password.historyCount', 25],
      ['security.password.historyCount', -1],
      ['ux.loginNoticeText', 'x'.repeat(501)],
      ['ux.loginNoticeText', 12],
      ['not.registered', 1],
    ] as const)
      expect(() => validateTenantSettingValue(key, value)).toThrow(DomainError);
  });

  it('drafts, publishes, advances the pointer and audits in the same transactions', async () => {
    const before = await db.query<{ count: string }>(
      'SELECT count(*)::text count FROM audit_events WHERE organization_id=$1',
      [company],
    );
    const draft = await repository.put({
      tenantId: company,
      key: 'security.password.minLength',
      value: 16,
      idempotencyKey: 'ts-idem-1',
      actor,
      correlationId: randomUUID(),
    });
    expect(draft).toMatchObject({ version: 1, value: 16, status: 'DRAFT' });
    const published = await repository.publish({
      tenantId: company,
      key: 'security.password.minLength',
      idempotencyKey: 'ts-pub-1',
      actor,
      correlationId: randomUUID(),
    });
    expect(published).toMatchObject({ version: 1, value: 16, status: 'PUBLISHED' });
    const pointer = await db.query<{ current: string | null }>(
      'SELECT current_version_id::text current FROM tenant_settings WHERE tenant_id=$1 AND key=$2',
      [company, 'security.password.minLength'],
    );
    expect(pointer.rows[0]?.current).toBeTruthy();
    const audit = await db.query<{ action: string }>(
      'SELECT action FROM audit_events WHERE organization_id=$1 ORDER BY occurred_at,id',
      [company],
    );
    expect(audit.rows.map((row) => row.action)).toEqual([
      'tenant-setting.update',
      'tenant-setting.publish',
    ]);
    const after = await db.query<{ count: string }>(
      'SELECT count(*)::text count FROM audit_events WHERE organization_id=$1',
      [company],
    );
    expect(Number(after.rows[0]?.count)).toBe(Number(before.rows[0]?.count) + 2);
  });

  it('replays idempotent writes and publish without duplicate versions', async () => {
    const first = await repository.put({
      tenantId: company,
      key: 'ux.loginNoticeText',
      value: '首次公告',
      idempotencyKey: 'ts-idem-notice',
      actor,
      correlationId: randomUUID(),
    });
    const replay = await repository.put({
      tenantId: company,
      key: 'ux.loginNoticeText',
      value: '首次公告',
      idempotencyKey: 'ts-idem-notice',
      actor,
      correlationId: randomUUID(),
    });
    expect(replay).toEqual(first);
    const publishFirst = await repository.publish({
      tenantId: company,
      key: 'ux.loginNoticeText',
      idempotencyKey: 'ts-pub-notice',
      actor,
      correlationId: randomUUID(),
    });
    const publishReplay = await repository.publish({
      tenantId: company,
      key: 'ux.loginNoticeText',
      idempotencyKey: 'ts-pub-notice',
      actor,
      correlationId: randomUUID(),
    });
    expect(publishReplay).toEqual(publishFirst);
    const versions = await db.query<{ count: string }>(
      "SELECT count(*)::text count FROM tenant_setting_versions WHERE tenant_id=$1 AND key='ux.loginNoticeText'",
      [company],
    );
    expect(Number(versions.rows[0]?.count)).toBe(1);
    await expect(
      repository.publish({
        tenantId: company,
        key: 'ux.loginNoticeText',
        idempotencyKey: 'ts-pub-other',
        actor,
        correlationId: randomUUID(),
      }),
    ).rejects.toThrow(/already published/u);
  });

  it('enforces append-only versions and immutable published rows at the database level', async () => {
    await repository.put({
      tenantId: company,
      key: 'security.password.historyCount',
      value: 3,
      idempotencyKey: 'ts-idem-hist',
      actor,
      correlationId: randomUUID(),
    });
    await expect(
      db.query(
        "UPDATE tenant_setting_versions SET value='5'::jsonb WHERE tenant_id=$1 AND key='security.password.historyCount'",
        [company],
      ),
    ).rejects.toThrow(/append-only/u);
    await repository.publish({
      tenantId: company,
      key: 'security.password.historyCount',
      idempotencyKey: 'ts-pub-hist',
      actor,
      correlationId: randomUUID(),
    });
    await expect(
      db.query(
        "UPDATE tenant_setting_versions SET value='9'::jsonb WHERE tenant_id=$1 AND key='security.password.historyCount' AND status='PUBLISHED'",
        [company],
      ),
    ).rejects.toThrow(/immutable/u);
    await expect(
      db.query(
        "DELETE FROM tenant_setting_versions WHERE tenant_id=$1 AND key='security.password.historyCount' AND status='PUBLISHED'",
        [company],
      ),
    ).rejects.toThrow(/immutable/u);
  });

  it('falls back to code defaults for unset keys and reports drafts in the catalog', async () => {
    const items = await repository.list(company);
    const lengths = items.find((item) => item.key === 'security.password.minLength');
    expect(lengths?.value).toBe(16);
    expect(lengths?.publishedVersion).toBe(1);
    expect(lengths?.history).toHaveLength(1);
    const banner = items.find((item) => item.key === 'ux.loginNoticeText');
    expect(banner?.value).toBe('首次公告');
    const counts = items.find((item) => item.key === 'security.password.historyCount');
    expect(counts?.value).toBe(3);
    await repository.put({
      tenantId: company,
      key: 'security.password.minLength',
      value: 20,
      idempotencyKey: 'ts-idem-draft2',
      actor,
      correlationId: randomUUID(),
    });
    const updated = (await repository.list(company)).find(
      (item) => item.key === 'security.password.minLength',
    );
    expect(updated?.value).toBe(16);
    expect(updated?.draftVersion).toBe(2);
    expect(updated?.publishedVersion).toBe(1);
  });

  it('isolates tenants', async () => {
    const other = randomUUID();
    await db.query(
      "INSERT INTO organizations(id,owner_organization_id,code,name,organization_type) VALUES($1,$1,'OTHER','Other','COMPANY')",
      [other],
    );
    const items = await repository.list(other);
    expect(items.find((item) => item.key === 'security.password.minLength')?.value).toBe(12);
  });
});
