// D5（ADR-0013）：租户设置仓储——稳定身份 + 追加版本 + 单向发布；
// 键目录白名单与每键 schema 手写校验（零新依赖）；写入同事务审计。
import { DomainError, type Actor } from '@kingturf/domain';
import { TENANT_SETTING_DEFINITIONS, type TenantSettingValue } from '@kingturf/types';
import type { Database, SqlClient } from '@kingturf/database';
import { TransactionalAuditWriter } from './platform-repositories.ts';

const definitionOf = (key: string) => {
  const definition = TENANT_SETTING_DEFINITIONS.find((item) => item.key === key);
  if (!definition) throw new DomainError('not_found', 'Unknown tenant setting key');
  return definition;
};

/** 键白名单 + 手写 schema 校验；返回原值（jsonb 序列化前）。 */
export function validateTenantSettingValue(key: string, value: unknown): TenantSettingValue {
  const definition = definitionOf(key);
  if (definition.valueType === 'integer') {
    if (typeof value !== 'number' || !Number.isSafeInteger(value))
      throw new DomainError('invalid_request', `${key} must be an integer`);
    if (definition.minimum !== undefined && value < definition.minimum)
      throw new DomainError('invalid_request', `${key} must be >= ${String(definition.minimum)}`);
    if (definition.maximum !== undefined && value > definition.maximum)
      throw new DomainError('invalid_request', `${key} must be <= ${String(definition.maximum)}`);
    return value;
  }
  if (typeof value !== 'string')
    throw new DomainError('invalid_request', `${key} must be a string`);
  if (definition.maxLength !== undefined && value.length > definition.maxLength)
    throw new DomainError(
      'invalid_request',
      `${key} must be at most ${String(definition.maxLength)} characters`,
    );
  return value;
}

export type TenantSettingVersionView = Readonly<{
  version: number;
  value: TenantSettingValue;
  status: 'DRAFT' | 'PUBLISHED';
  publishedAt: string | null;
}>;
export type TenantSettingStateView = Readonly<{
  key: string;
  label: string;
  description: string;
  valueType: 'integer' | 'string';
  minimum?: number;
  maximum?: number;
  maxLength?: number;
  default: TenantSettingValue;
  value: TenantSettingValue;
  publishedVersion: number | null;
  draftVersion: number | null;
  history: readonly TenantSettingVersionView[];
}>;

type VersionRow = {
  id?: string;
  version: number;
  value: TenantSettingValue;
  status: 'DRAFT' | 'PUBLISHED';
  published_at: Date | null;
};

export class PostgresTenantSettingsRepository {
  private readonly audit = new TransactionalAuditWriter();
  public constructor(private readonly db: Database) {}

  public async list(tenantId: string): Promise<readonly TenantSettingStateView[]> {
    const rows = (
      await this.db.query<VersionRow & { key: string }>(
        'SELECT key,id,version,value,status,published_at FROM tenant_setting_versions WHERE tenant_id=$1 ORDER BY key,version DESC',
        [tenantId],
      )
    ).rows;
    return TENANT_SETTING_DEFINITIONS.map((definition) => {
      const versions = rows.filter((row) => row.key === definition.key);
      const published = versions.filter((row) => row.status === 'PUBLISHED');
      const current = published[0];
      const draft = versions.find((row) => row.status === 'DRAFT');
      return {
        key: definition.key,
        label: definition.label,
        description: definition.description,
        valueType: definition.valueType,
        ...(definition.minimum !== undefined ? { minimum: definition.minimum } : {}),
        ...(definition.maximum !== undefined ? { maximum: definition.maximum } : {}),
        ...(definition.maxLength !== undefined ? { maxLength: definition.maxLength } : {}),
        default: definition.default,
        value: current ? current.value : definition.default,
        publishedVersion: current ? current.version : null,
        draftVersion: draft ? draft.version : null,
        history: versions.map((row) => ({
          version: row.version,
          value: row.value,
          status: row.status,
          publishedAt: row.published_at?.toISOString() ?? null,
        })),
      };
    });
  }

  /** 写 DRAFT（幂等重放返回既存快照，不重复追加）。 */
  public async put(
    input: Readonly<{
      tenantId: string;
      key: string;
      value: unknown;
      idempotencyKey: string;
      actor: Actor;
      correlationId: string;
    }>,
  ): Promise<TenantSettingVersionView> {
    const value = validateTenantSettingValue(input.key, input.value);
    definitionOf(input.key);
    return this.db.transaction(async (tx) => {
      const replay = (
        await tx.query<VersionRow>(
          'SELECT version,value,status,published_at FROM tenant_setting_versions WHERE tenant_id=$1 AND key=$2 AND idempotency_key=$3',
          [input.tenantId, input.key, input.idempotencyKey],
        )
      ).rows[0];
      if (replay)
        return {
          version: replay.version,
          value: replay.value,
          status: replay.status,
          publishedAt: replay.published_at?.toISOString() ?? null,
        };
      const next = (
        await tx.query<{ version: number }>(
          'SELECT coalesce(max(version),0)+1 version FROM tenant_setting_versions WHERE tenant_id=$1 AND key=$2',
          [input.tenantId, input.key],
        )
      ).rows[0]?.version;
      if (!next) throw new DomainError('conflict', 'Tenant setting version could not be allocated');
      const inserted = (
        await tx.query<VersionRow>(
          "INSERT INTO tenant_setting_versions(tenant_id,key,version,value,status,idempotency_key,created_by) VALUES($1,$2,$3,$4,'DRAFT',$5,$6) RETURNING id,version,value,status,published_at",
          [
            input.tenantId,
            input.key,
            next,
            JSON.stringify(value),
            input.idempotencyKey,
            input.actor.employeeId,
          ],
        )
      ).rows[0];
      if (!inserted?.id)
        throw new DomainError('conflict', 'Tenant setting draft could not be written');
      await this.audit.write(tx, {
        actor: input.actor,
        action: 'tenant-setting.update',
        targetType: 'tenant-setting',
        targetId: inserted.id,
        correlationId: input.correlationId,
        metadata: { key: input.key, version: next },
        allowedMetadata: ['key', 'version'],
      });
      return {
        version: inserted.version,
        value: inserted.value,
        status: inserted.status,
        publishedAt: null,
      };
    });
  }

  /** 单向发布：最新 DRAFT→PUBLISHED 并推进稳定身份指针；重放返回已发布快照。 */
  public async publish(
    input: Readonly<{
      tenantId: string;
      key: string;
      idempotencyKey: string;
      actor: Actor;
      correlationId: string;
    }>,
  ): Promise<TenantSettingVersionView> {
    definitionOf(input.key);
    return this.db.transaction(async (tx) => {
      const latest = (
        await tx.query<VersionRow & { id: string; publish_idempotency_key: string | null }>(
          'SELECT id,version,value,status,published_at,publish_idempotency_key FROM tenant_setting_versions WHERE tenant_id=$1 AND key=$2 ORDER BY version DESC LIMIT 1',
          [input.tenantId, input.key],
        )
      ).rows[0];
      if (!latest) throw new DomainError('not_found', 'Tenant setting has no versions');
      if (latest.status === 'PUBLISHED') {
        if (latest.publish_idempotency_key === input.idempotencyKey)
          return {
            version: latest.version,
            value: latest.value,
            status: latest.status,
            publishedAt: latest.published_at?.toISOString() ?? null,
          };
        throw new DomainError('conflict', 'Latest tenant setting version is already published');
      }
      await tx.query(
        "UPDATE tenant_setting_versions SET status='PUBLISHED',published_at=now(),publish_idempotency_key=$3 WHERE id=$1 AND tenant_id=$2",
        [latest.id, input.tenantId, input.idempotencyKey],
      );
      const stored = (
        await tx.query<VersionRow>(
          'SELECT version,value,status,published_at FROM tenant_setting_versions WHERE id=$1 AND tenant_id=$2',
          [latest.id, input.tenantId],
        )
      ).rows[0];
      if (!stored)
        throw new DomainError('conflict', 'Published tenant setting could not be read back');
      await tx.query(
        `INSERT INTO tenant_settings(tenant_id,key,current_version_id) VALUES($1,$2,$3)
         ON CONFLICT(tenant_id,key) DO UPDATE SET current_version_id=EXCLUDED.current_version_id,updated_at=now()`,
        [input.tenantId, input.key, latest.id],
      );
      await this.audit.write(tx, {
        actor: input.actor,
        action: 'tenant-setting.publish',
        targetType: 'tenant-setting',
        targetId: latest.id,
        correlationId: input.correlationId,
        metadata: { key: input.key, version: latest.version },
        allowedMetadata: ['key', 'version'],
      });
      return {
        version: stored.version,
        value: stored.value,
        status: 'PUBLISHED',
        publishedAt: stored.published_at?.toISOString() ?? null,
      };
    });
  }
}

// 与 platform-repositories 共享的导出（供路由侧类型引用保持单一来源）。
export type { SqlClient };
