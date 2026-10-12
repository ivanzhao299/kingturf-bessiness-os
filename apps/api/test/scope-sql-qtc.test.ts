import { describe, expect, it } from 'vitest';
import type { Actor, ScopeAnchor } from '@kingturf/domain';
import type { DataScope } from '@kingturf/types';
import { recordScopeSql } from '../src/scope-sql.js';

const actor: Actor = {
  employeeId: '11111111-1111-4111-4111-111111111111',
  companyId: '22222222-2222-4222-8222-222222222222',
};
const org = '33333333-3333-4333-8333-333333333333';

/**
 * 迁移前实现的逐字快照（原 qtc-repositories.ts 的 scope(context, alias, offset)，批次 1b 迁移时冻结）。
 * 仅作对拍基准。qtc 变体与 recordScopeSql 缺省路径**文本一致**（osr 别名、EXISTS( 无空格、
 * granted 锚点守卫、GROUP/COMPANY 并入 OR 子句而非短路），因此对拍**零归一化**：
 * SQL 与参数逐字节比较，任何差异都是迁移缺陷。
 */
const legacyQtcScope = (
  context: Readonly<{
    actor: Actor;
    scopes: readonly DataScope[];
    anchors: readonly ScopeAnchor[];
  }>,
  alias = 'c',
  offset = 2,
): { sql: string; values: readonly string[] } => {
  const clauses: string[] = [];
  const values: string[] = [];
  if (context.scopes.includes('COMPANY') || context.scopes.includes('GROUP')) clauses.push('TRUE');
  if (context.scopes.includes('SELF'))
    clauses.push(
      `${alias}.owner_id=$${String(offset + values.push(context.actor.employeeId) - 1)}`,
    );
  for (const anchor of context.anchors)
    if (anchor.organizationId && context.scopes.includes(anchor.scope)) {
      values.push(anchor.organizationId);
      clauses.push(
        `EXISTS(SELECT 1 FROM organizations anchor JOIN organization_scope_relationships osr ON osr.ancestor_id=anchor.id AND osr.descendant_id=${alias}.owner_organization_id${anchor.scope === 'TEAM' ? ' AND osr.depth<=1' : ''} WHERE anchor.id=$${String(offset + values.length - 1)} AND anchor.owner_organization_id=${alias}.tenant_id AND anchor.organization_type='${anchor.scope}' AND anchor.active AND anchor.deleted_at IS NULL)`,
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
const offsets = [1, 2, 3, 9];

describe('recordScopeSql（qtc 用法）× 迁移前快照对拍（批次 1b，零归一化）', () => {
  it('全部 432 组合（9 scope 组 × 6 锚点组 × 4 偏移 × 2 别名）SQL 与参数逐字节一致', () => {
    for (const scopes of scopeCases)
      for (const anchors of anchorCases)
        for (const offset of offsets)
          for (const alias of ['c', 'l']) {
            const context = { actor, scopes, anchors };
            const legacy = legacyQtcScope(context, alias, offset);
            const migrated = recordScopeSql(scopes, anchors, actor, alias, offset);
            expect(migrated.sql).toBe(legacy.sql);
            expect(migrated.values).toEqual(legacy.values);
          }
  });
});

describe('recordScopeSql 特征化（qtc 语义 = 共享实现缺省路径）', () => {
  it('GROUP/COMPANY 并入 OR 子句而非短路（与 CRM 语义相反，qtc 原样）', () => {
    expect(recordScopeSql(['COMPANY', 'SELF'], [], actor, 'c', 2)).toEqual({
      sql: '(TRUE OR c.owner_id=$2)',
      values: [actor.employeeId],
    });
  });

  it('锚点守卫为 granted：锚点 scope 未授予时不生成 EXISTS', () => {
    const r = recordScopeSql([], [{ scope: 'TEAM', organizationId: org }], actor, 'c', 2);
    expect(r.sql).toBe('FALSE');
    expect(r.values).toEqual([]);
  });

  it('requireCustomer 形态（offset=3）：SELF 编号 $3，锚点依次递增；未授予锚点被过滤；租户边界在位', () => {
    const r = recordScopeSql(
      ['SELF', 'TEAM', 'DEPARTMENT'],
      [
        { scope: 'TEAM', organizationId: org },
        { scope: 'DEPARTMENT', organizationId: '44444444-4444-4444-8444-444444444444' },
      ],
      actor,
      'c',
      3,
    );
    expect(r.sql).toContain('c.owner_id=$3');
    expect(r.sql).toContain('anchor.id=$4');
    expect(r.sql).toContain('anchor.id=$5');
    expect(r.sql).toContain('anchor.owner_organization_id=c.tenant_id');
    expect(r.sql).toContain(' AND osr.depth<=1');
    const filtered = recordScopeSql(
      ['SELF', 'TEAM'],
      [
        { scope: 'TEAM', organizationId: org },
        { scope: 'DEPARTMENT', organizationId: '44444444-4444-4444-8444-444444444444' },
      ],
      actor,
      'c',
      3,
    );
    expect(filtered.sql).not.toContain('anchor.id=$5');
    expect(filtered.values).toEqual([actor.employeeId, org]);
  });

  it('空 scope 无锚点 → FALSE 零参数', () => {
    expect(recordScopeSql([], [], actor, 'c', 2)).toEqual({ sql: 'FALSE', values: [] });
  });
});
