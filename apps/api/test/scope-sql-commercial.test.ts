import { describe, expect, it } from 'vitest';
import type { Actor, ScopeAnchor } from '@kingturf/domain';
import type { DataScope } from '@kingturf/types';
import { recordScopeSql } from '../src/scope-sql.js';

const actor: Actor = {
  employeeId: '11111111-1111-4111-8111-111111111111',
  companyId: '22222222-2222-4222-8222-222222222222',
};
const org = '33333333-3333-4333-8333-333333333333';

/**
 * 迁移前实现的逐字快照（原 commercial-repositories.ts 的 scope，批次 1b 迁移时冻结）。
 * 仅作对拍基准：断言 recordScopeSql 在全部输入组合下与其输出完全一致（SQL 字节 + 参数顺序）。
 */
const legacyCommercialScope = (
  scopes: readonly DataScope[],
  anchors: readonly ScopeAnchor[],
  legacyActor: Actor,
  offset: number,
): { sql: string; values: readonly unknown[] } => {
  const clauses: string[] = [];
  const values: unknown[] = [];
  if (scopes.includes('COMPANY') || scopes.includes('GROUP')) clauses.push('TRUE');
  if (scopes.includes('SELF'))
    clauses.push(`o.owner_id=$${String(offset + values.push(legacyActor.employeeId) - 1)}`);
  for (const anchor of anchors)
    if (anchor.organizationId && scopes.includes(anchor.scope))
      clauses.push(
        `EXISTS(SELECT 1 FROM organizations anchor JOIN organization_scope_relationships osr ON osr.ancestor_id=anchor.id AND osr.descendant_id=o.owner_organization_id${anchor.scope === 'TEAM' ? ' AND osr.depth<=1' : ''} WHERE anchor.id=$${String(offset + values.push(anchor.organizationId) - 1)} AND anchor.owner_organization_id=o.tenant_id AND anchor.organization_type='${anchor.scope}' AND anchor.active AND anchor.deleted_at IS NULL)`,
      );
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

describe('recordScopeSql × 迁移前快照对拍（commercial，批次 1b）', () => {
  it('全部 216 组合（9 scope 组 × 6 锚点组 × 4 偏移）SQL 与参数完全一致', () => {
    for (const scopes of scopeCases)
      for (const anchors of anchorCases)
        for (const offset of offsets) {
          const legacy = legacyCommercialScope(scopes, anchors, actor, offset);
          const migrated = recordScopeSql(scopes, anchors, actor, 'o', offset);
          expect(migrated.sql).toBe(legacy.sql);
          expect(migrated.values).toEqual(legacy.values);
        }
  });
});

describe('recordScopeSql 特征化（commercial 语义）', () => {
  it('空 scope 且无锚点 → FALSE、零参数', () => {
    const r = recordScopeSql([], [], actor, 'o', 2);
    expect(r.sql).toBe('FALSE');
    expect(r.values).toEqual([]);
  });

  it('COMPANY / GROUP → (TRUE)、零参数', () => {
    expect(recordScopeSql(['COMPANY'], [], actor, 'o', 2)).toEqual({ sql: '(TRUE)', values: [] });
    expect(recordScopeSql(['GROUP'], [], actor, 'o', 2)).toEqual({ sql: '(TRUE)', values: [] });
  });

  it('SELF → owner_id 等值，参数序号 = offset（偏移正确传递）', () => {
    expect(recordScopeSql(['SELF'], [], actor, 'o', 2)).toEqual({
      sql: `(o.owner_id=$2)`,
      values: [actor.employeeId],
    });
    expect(recordScopeSql(['SELF'], [], actor, 'o', 9)).toEqual({
      sql: `(o.owner_id=$9)`,
      values: [actor.employeeId],
    });
  });

  it('TEAM 锚点：depth<=1 + 租户边界 + 组织类型都在谓词内', () => {
    const r = recordScopeSql(['TEAM'], [{ scope: 'TEAM', organizationId: org }], actor, 'o', 2);
    expect(r.sql).toContain(' AND osr.depth<=1');
    expect(r.sql).toContain('anchor.owner_organization_id=o.tenant_id');
    expect(r.sql).toContain("anchor.organization_type='TEAM'");
    expect(r.values).toEqual([org]);
  });

  it('DEPARTMENT 锚点不带 depth 子句；锚点 scope 未授予或无 organizationId 时不生效', () => {
    const dept = recordScopeSql(
      ['DEPARTMENT'],
      [{ scope: 'DEPARTMENT', organizationId: org }],
      actor,
      'o',
      2,
    );
    expect(dept.sql).not.toContain('osr.depth<=1');
    expect(recordScopeSql([], [{ scope: 'TEAM', organizationId: org }], actor, 'o', 2).sql).toBe(
      'FALSE',
    );
    expect(
      recordScopeSql(['TEAM'], [{ scope: 'TEAM', organizationId: null }], actor, 'o', 2).sql,
    ).toBe('FALSE');
  });

  it('alias 参数化：客户表别名复用同一实现（为 crm/customerScope 族迁移预留）', () => {
    const r = recordScopeSql(['SELF'], [], actor, 'c', 5);
    expect(r.sql).toBe('(c.owner_id=$5)');
  });
});
