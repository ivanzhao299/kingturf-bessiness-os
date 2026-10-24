import { describe, expect, it } from 'vitest';
import type { ScopeAnchor } from '@kingturf/domain';
import type { DataScope } from '@kingturf/types';
import { auditScopePredicate } from '../src/scope-sql.js';

const actorId = '11111111-1111-4111-8111-111111111111';
const org = '33333333-3333-4333-8333-333333333333';

/**
 * 迁移前实现的逐字快照（原 platform-repositories.ts PostgresAuditRepository.scopePredicate，
 * 批次 1b 迁移时冻结）。仅作对拍基准。
 *
 * platform 变体是**审计可见性谓词**（第四形态）：作用对象为 audit_events 行（别名固定 a），
 * 按 GROUP/COMPANY=租户组织内有效 actor、SELF=事件 actor 即本人、TEAM/DEPARTMENT/REGION=
 * 显式锚点组织内的事件 actor 属锚点谱系（TEAM 含 depth<=1）判定；与 recordScopeSql 家族
 * （按记录 owner 判权）谓词目标不同，故在 scope-sql.ts 独立导出而非选项。
 * 锚点 organizationId 为 null 时仍作为参数压入（值可为 null）——原语义原样保留。
 */
const legacyPlatformScope = (
  scopes: readonly DataScope[],
  legacyActorId: string,
  anchors: readonly ScopeAnchor[],
  offset: number,
): { sql: string; values: readonly unknown[] } => {
  const granted = new Set(scopes);
  const clauses: string[] = [],
    values: unknown[] = [];
  if (granted.has('GROUP') || granted.has('COMPANY')) {
    values.push(legacyActorId);
    clauses.push(
      `EXISTS(SELECT 1 FROM employees scope_actor WHERE scope_actor.id=$${String(offset + values.length)} AND scope_actor.company_id=a.organization_id AND scope_actor.active AND scope_actor.deleted_at IS NULL)`,
    );
  }
  if (granted.has('SELF')) {
    values.push(legacyActorId);
    clauses.push(
      `EXISTS(SELECT 1 FROM employees scope_actor WHERE scope_actor.id=$${String(offset + values.length)} AND scope_actor.company_id=a.organization_id AND scope_actor.active AND scope_actor.deleted_at IS NULL AND a.actor_id=scope_actor.id)`,
    );
  }
  for (const typed of ['TEAM', 'DEPARTMENT', 'REGION'] as const) {
    if (!granted.has(typed)) continue;
    const explicitAnchors = anchors.filter((anchor) => anchor.scope === typed);
    for (const anchor of explicitAnchors) {
      values.push(legacyActorId);
      const actorParameter = `$${String(offset + values.length)}`;
      values.push(anchor.organizationId);
      clauses.push(
        `EXISTS(SELECT 1 FROM organizations explicit_anchor JOIN employees scope_actor ON scope_actor.id=${actorParameter} AND scope_actor.company_id=explicit_anchor.owner_organization_id AND scope_actor.active AND scope_actor.deleted_at IS NULL JOIN organization_scope_relationships osr ON osr.ancestor_id=explicit_anchor.id JOIN employees ae ON ae.id=a.actor_id AND ae.company_id=explicit_anchor.owner_organization_id AND ae.active AND ae.deleted_at IS NULL WHERE explicit_anchor.id=$${String(offset + values.length)} AND explicit_anchor.owner_organization_id=a.organization_id AND explicit_anchor.organization_type='${typed}' AND explicit_anchor.active AND explicit_anchor.deleted_at IS NULL AND osr.descendant_id=ae.organization_id${typed === 'TEAM' ? ' AND osr.depth<=1' : ''})`,
      );
    }
  }
  return { sql: clauses.length ? `(${clauses.join(' OR ')})` : 'FALSE', values };
};

const scopeCases: readonly (readonly DataScope[])[] = [
  [],
  ['SELF'],
  ['COMPANY'],
  ['GROUP'],
  ['TEAM'],
  ['DEPARTMENT'],
  ['REGION'],
  ['SELF', 'TEAM'],
  ['COMPANY', 'SELF'],
];
const anchorCases: readonly (readonly ScopeAnchor[])[] = [
  [],
  [{ scope: 'TEAM', organizationId: org }],
  [{ scope: 'DEPARTMENT', organizationId: org }],
  [{ scope: 'REGION', organizationId: org }],
  [{ scope: 'TEAM', organizationId: null }],
  [{ scope: 'SELF', organizationId: org }],
];
const offsets = [1, 2, 3, 9];

describe('auditScopePredicate × 迁移前快照对拍（批次 1b，零归一化）', () => {
  it('全部 216 组合（9 scope 组 × 6 锚点组 × 4 偏移）SQL 与参数逐字节一致', () => {
    for (const scopes of scopeCases)
      for (const anchors of anchorCases)
        for (const offset of offsets) {
          const legacy = legacyPlatformScope(scopes, actorId, anchors, offset);
          const migrated = auditScopePredicate(scopes, actorId, anchors, offset);
          expect(migrated.sql).toBe(legacy.sql);
          expect(migrated.values).toEqual(legacy.values);
        }
  });
});

describe('auditScopePredicate 特征化（platform 审计可见性语义）', () => {
  it('GROUP/COMPANY：租户组织内有效 actor 的 EXISTS（并入 OR，非短路）', () => {
    const r = auditScopePredicate(['COMPANY'], actorId, [], 2);
    expect(r.sql).toBe(
      `(EXISTS(SELECT 1 FROM employees scope_actor WHERE scope_actor.id=$3 AND scope_actor.company_id=a.organization_id AND scope_actor.active AND scope_actor.deleted_at IS NULL))`,
    );
    expect(r.values).toEqual([actorId]);
  });

  it('SELF 额外要求 a.actor_id=scope_actor.id', () => {
    const r = auditScopePredicate(['SELF'], actorId, [], 1);
    expect(r.sql).toContain('AND a.actor_id=scope_actor.id');
    expect(r.values).toEqual([actorId]);
  });

  it('类型锚点：须类型已授予且锚点存在；TEAM 带 depth<=1；事件 actor（ae）与本人（scope_actor）都须属锚点组织', () => {
    const r = auditScopePredicate(['TEAM'], actorId, [{ scope: 'TEAM', organizationId: org }], 2);
    expect(r.sql).toContain("explicit_anchor.organization_type='TEAM'");
    expect(r.sql).toContain(' AND osr.depth<=1');
    expect(r.sql).toContain('ae.id=a.actor_id');
    expect(r.sql).toContain('osr.descendant_id=ae.organization_id');
    expect(r.values).toEqual([actorId, org]);
  });

  it('类型已授予但无对应锚点 → 该类型不产生子句；空 scope → FALSE 零参数', () => {
    expect(auditScopePredicate(['TEAM'], actorId, [], 2)).toEqual({ sql: 'FALSE', values: [] });
    expect(auditScopePredicate([], actorId, [{ scope: 'TEAM', organizationId: org }], 2)).toEqual({
      sql: 'FALSE',
      values: [],
    });
  });

  it('锚点 organizationId 为 null 时仍压入参数（原语义，值可为 null）', () => {
    const r = auditScopePredicate(['TEAM'], actorId, [{ scope: 'TEAM', organizationId: null }], 2);
    expect(r.values).toEqual([actorId, null]);
    expect(r.sql).not.toBe('FALSE');
  });
});
