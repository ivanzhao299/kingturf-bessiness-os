import { describe, expect, it } from 'vitest';
import type { Actor, ScopeAnchor } from '@kingturf/domain';
import type { DataScope } from '@kingturf/types';
import { recordScopeSql, type RecordScopeOptions } from '../src/scope-sql.js';

const actor: Actor = {
  employeeId: '11111111-1111-4111-8111-111111111111',
  companyId: '22222222-2222-4222-8222-222222222222',
};
const org = '33333333-3333-4333-8333-333333333333';

const COMPLAINT_SCOPE: RecordScopeOptions = { anchorPredicate: 'relationshipOnly' };

/**
 * 迁移前实现的逐字快照（原 complaint-repositories.ts 的 scope(context, alias='cu', offset=2)，
 * 批次 1b 迁移时冻结）。仅作对拍基准。
 *
 * complaint 的锚点谓词与其他域**真实语义不同**（迁移时原样保留，登记 TD-SEC-006）：
 * 只查 organization_scope_relationships 单表——无 organizations JOIN、无组织
 * active/deleted 与 organization_type 校验、TEAM 无 depth<=1 限制；租户校验在
 * osr.tenant_id 上、类型匹配用 osr.scope 列。共享实现以显式选项
 * anchorPredicate='relationshipOnly' 表达该形态，对拍零归一化。
 */
const legacyComplaintScope = (
  context: Readonly<{
    actor: Actor;
    scopes: readonly DataScope[];
    anchors: readonly ScopeAnchor[];
  }>,
  alias = 'cu',
  offset = 2,
): { sql: string; values: readonly string[] } => {
  const clauses: string[] = [];
  const values: string[] = [];
  if (context.scopes.includes('COMPANY') || context.scopes.includes('GROUP')) clauses.push('TRUE');
  if (context.scopes.includes('SELF')) {
    values.push(context.actor.employeeId);
    clauses.push(`${alias}.owner_id=$${String(offset + values.length - 1)}`);
  }
  for (const anchor of context.anchors)
    if (anchor.organizationId && context.scopes.includes(anchor.scope)) {
      values.push(anchor.organizationId);
      clauses.push(
        `EXISTS(SELECT 1 FROM organization_scope_relationships osr WHERE osr.tenant_id=${alias}.tenant_id AND osr.ancestor_id=$${String(offset + values.length - 1)} AND osr.descendant_id=${alias}.owner_organization_id AND osr.scope='${anchor.scope}')`,
      );
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
const offsets = [1, 2, 3, 5];

describe('recordScopeSql（complaint）保留非锚点快照并验证SEC008修复边界', () => {
  it('432组合保留参数/非锚点SQL，锚点使用真实组织列（SEC008）', () => {
    for (const scopes of scopeCases)
      for (const anchors of anchorCases)
        for (const offset of offsets)
          for (const alias of ['cu', 'c']) {
            const context = { actor, scopes, anchors };
            const legacy = legacyComplaintScope(context, alias, offset);
            const migrated = recordScopeSql(scopes, anchors, actor, alias, offset, COMPLAINT_SCOPE);
            if (!legacy.sql.includes('osr.tenant_id')) expect(migrated.sql).toBe(legacy.sql);
            else {
              expect(migrated.sql).not.toContain('osr.tenant_id');
              expect(migrated.sql).not.toContain('osr.scope=');
              expect(migrated.sql).toContain(
                'anchor.owner_organization_id=' + alias + '.tenant_id',
              );
              expect(migrated.sql).toContain('anchor.active AND anchor.deleted_at IS NULL');
              expect(migrated.sql).not.toContain('osr.depth');
            }
            expect(migrated.values).toEqual(legacy.values);
          }
  });
});

describe('recordScopeSql 特征化（complaint 语义 = relationshipOnly 锚点谓词）', () => {
  it('锚点校验真实组织类型/租户/有效性，保留无 depth 兼容边界', () => {
    const r = recordScopeSql(
      ['TEAM'],
      [{ scope: 'TEAM', organizationId: org }],
      actor,
      'cu',
      2,
      COMPLAINT_SCOPE,
    );
    expect(r.sql).toContain('FROM organizations anchor JOIN organization_scope_relationships osr');
    expect(r.sql).not.toContain('JOIN organizations');
    expect(r.sql).not.toContain('depth');
    expect(r.sql).toContain('anchor.active AND anchor.deleted_at IS NULL');
    expect(r.sql).toContain("organization_type='TEAM'");
    expect(r.sql).toContain('anchor.owner_organization_id=cu.tenant_id');
    expect(r.sql).not.toContain('osr.scope=');
    expect(r.sql).toContain('anchor.id=$2');
  });

  it('TEAM 与 DEPARTMENT 生成相同形态（无 depth 区分）——与 organizationJoin 形态的语义差异（TD-SEC-006）', () => {
    const team = recordScopeSql(
      ['TEAM'],
      [{ scope: 'TEAM', organizationId: org }],
      actor,
      'cu',
      2,
      COMPLAINT_SCOPE,
    );
    const dept = recordScopeSql(
      ['DEPARTMENT'],
      [{ scope: 'DEPARTMENT', organizationId: org }],
      actor,
      'cu',
      2,
      COMPLAINT_SCOPE,
    );
    expect(team.sql.replace("anchor.organization_type='TEAM'", 'X')).toBe(
      dept.sql.replace("anchor.organization_type='DEPARTMENT'", 'X'),
    );

    const joined = recordScopeSql(
      ['TEAM'],
      [{ scope: 'TEAM', organizationId: org }],
      actor,
      'cu',
      2,
    );
    expect(joined.sql).toContain(' AND osr.depth<=1');
    expect(joined.sql).toContain("organization_type='TEAM'");
  });

  it('granted 守卫与 GROUP/COMPANY 并入 OR（非短路），SELF 编号从 offset 起', () => {
    expect(
      recordScopeSql([], [{ scope: 'TEAM', organizationId: org }], actor, 'cu', 2, COMPLAINT_SCOPE),
    ).toEqual({
      sql: 'FALSE',
      values: [],
    });
    expect(recordScopeSql(['COMPANY', 'SELF'], [], actor, 'cu', 5, COMPLAINT_SCOPE)).toEqual({
      sql: '(TRUE OR cu.owner_id=$5)',
      values: [actor.employeeId],
    });
  });

  it('空 scope 无锚点 → FALSE 零参数', () => {
    expect(recordScopeSql([], [], actor, 'cu', 2, COMPLAINT_SCOPE)).toEqual({
      sql: 'FALSE',
      values: [],
    });
  });
});
