import { describe, expect, it } from 'vitest';
import type { Actor, ScopeAnchor } from '@kingturf/domain';
import type { DataScope } from '@kingturf/types';
import { recordScopeSql, type RecordScopeOptions } from '../src/scope-sql.js';

const actor: Actor = {
  employeeId: '11111111-1111-4111-8111-111111111111',
  companyId: '22222222-2222-4222-8222-222222222222',
};
const org = '33333333-3333-4333-8333-333333333333';

const CRM_SCOPE: RecordScopeOptions = { companyShortCircuit: true, anchorGuard: 'typed' };
const CRM_SCOPE_POOL: RecordScopeOptions = {
  companyShortCircuit: true,
  anchorGuard: 'typed',
  includeUnownedPool: true,
};

/**
 * 迁移前实现的逐字快照（原 crm-repositories.ts 的 scope，批次 1b 迁移时冻结）。仅作对拍基准。
 *
 * 迁移后与快照存在两处**纯外观差异**（语义与参数零变化，对拍时归一化）：
 * ① `EXISTS (SELECT` → `EXISTS(SELECT`（关键字后空格）；
 * ② 关联表别名 `scoped` → `osr`（同一子查询内的别名重命名，无语义影响）。
 * 行为语义由 test/crm-postgres.integration.test.ts 的 DataScope 用例守护。
 */
const legacyCrmScope = (
  scopes: readonly DataScope[],
  anchors: readonly ScopeAnchor[],
  legacyActor: Actor,
  alias: string,
  start: number,
  includeUnownedPool = false,
): { sql: string; values: readonly unknown[] } => {
  if (scopes.includes('GROUP') || scopes.includes('COMPANY'))
    return { sql: 'TRUE', values: [] as unknown[] };
  const clauses: string[] = [];
  const values: unknown[] = [];
  const p = (v: unknown) => {
    values.push(v);
    return `$${String(start + values.length - 1)}`;
  };
  if (scopes.includes('SELF')) clauses.push(`${alias}.owner_id=${p(legacyActor.employeeId)}`);
  if (includeUnownedPool && scopes.includes('SELF'))
    clauses.push(`(${alias}.status='POOL' AND ${alias}.owner_id IS NULL)`);
  for (const a of anchors)
    if (a.organizationId && ['TEAM', 'DEPARTMENT', 'REGION'].includes(a.scope)) {
      const anchorId = p(a.organizationId);
      const depth = a.scope === 'TEAM' ? ' AND scoped.depth<=1' : '';
      clauses.push(
        `EXISTS (SELECT 1 FROM organizations anchor JOIN organization_scope_relationships scoped ON scoped.ancestor_id=anchor.id AND scoped.descendant_id=${alias}.owner_organization_id${depth} WHERE anchor.id=${anchorId} AND anchor.owner_organization_id=${alias}.tenant_id AND anchor.organization_type='${a.scope}' AND anchor.active AND anchor.deleted_at IS NULL)`,
      );
    }
  return { sql: clauses.length ? `(${clauses.join(' OR ')})` : 'FALSE', values };
};

/** 仅作用于快照输出：消除上文登记的两处纯外观差异（含别名声明处 scoped ON → osr ON） */
const canonicalLegacySql = (sql: string): string =>
  sql
    .replaceAll('EXISTS (', 'EXISTS(')
    .replaceAll('scoped.', 'osr.')
    .replaceAll(' scoped ON', ' osr ON');

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

describe('recordScopeSql（CRM 选项）× 迁移前快照对拍（批次 1b）', () => {
  it('全部 432 组合（9 scope 组 × 6 锚点组 × 4 偏移 × 含/不含无主池）SQL（归一化后）与参数完全一致', () => {
    for (const scopes of scopeCases)
      for (const anchors of anchorCases)
        for (const offset of offsets)
          for (const pool of [false, true]) {
            const legacy = legacyCrmScope(scopes, anchors, actor, 'c', offset, pool);
            const migrated = recordScopeSql(
              scopes,
              anchors,
              actor,
              'c',
              offset,
              pool ? CRM_SCOPE_POOL : CRM_SCOPE,
            );
            expect(migrated.sql).toBe(canonicalLegacySql(legacy.sql));
            expect(migrated.values).toEqual(legacy.values);
          }
  });

  it('参数与参数顺序零归一化、逐字节一致（SELF + 两个锚点的参数序列）', () => {
    const anchors: readonly ScopeAnchor[] = [
      { scope: 'TEAM', organizationId: org },
      { scope: 'DEPARTMENT', organizationId: '44444444-4444-4444-8444-444444444444' },
    ];
    const legacy = legacyCrmScope(['SELF'], anchors, actor, 'l', 3, true);
    const migrated = recordScopeSql(['SELF'], anchors, actor, 'l', 3, CRM_SCOPE_POOL);
    expect(migrated.values).toEqual(legacy.values);
    expect(migrated.values).toEqual([
      actor.employeeId,
      '33333333-3333-4333-8333-333333333333',
      '44444444-4444-4444-8444-444444444444',
    ]);
    expect(migrated.sql).toContain('l.owner_id=$3');
    expect(migrated.sql).toContain('anchor.id=$4');
    expect(migrated.sql).toContain('anchor.id=$5');
  });
});

describe('recordScopeSql 特征化（CRM 语义）', () => {
  it('GROUP/COMPANY 短路：TRUE 且零参数（即便混入 SELF）', () => {
    expect(recordScopeSql(['GROUP'], [], actor, 'l', 2, CRM_SCOPE)).toEqual({
      sql: 'TRUE',
      values: [],
    });
    expect(recordScopeSql(['COMPANY', 'SELF'], [], actor, 'l', 2, CRM_SCOPE)).toEqual({
      sql: 'TRUE',
      values: [],
    });
  });

  it('includeUnownedPool：SELF 时附带无主池子句（无参数），不影响后续锚点编号', () => {
    const r = recordScopeSql(
      ['SELF'],
      [{ scope: 'TEAM', organizationId: org }],
      actor,
      'l',
      2,
      CRM_SCOPE_POOL,
    );
    expect(r.sql).toContain("(l.status='POOL' AND l.owner_id IS NULL)");
    expect(r.sql).toContain('anchor.id=$3');
  });

  it('锚点守卫 typed：锚点 scope 未在 scopes 中授予仍生成 EXISTS（CRM 原语义）', () => {
    const r = recordScopeSql(
      [],
      [{ scope: 'TEAM', organizationId: org }],
      actor,
      'l',
      2,
      CRM_SCOPE,
    );
    expect(r.sql).toContain('EXISTS(');
    expect(r.values).toEqual([org]);
  });

  it('空 scope 且无锚点 → FALSE；租户边界与组织类型谓词在位', () => {
    expect(recordScopeSql([], [], actor, 'l', 2, CRM_SCOPE)).toEqual({ sql: 'FALSE', values: [] });
    const r = recordScopeSql(
      ['TEAM'],
      [{ scope: 'TEAM', organizationId: org }],
      actor,
      'l',
      2,
      CRM_SCOPE,
    );
    expect(r.sql).toContain('anchor.owner_organization_id=l.tenant_id');
    expect(r.sql).toContain("anchor.organization_type='TEAM'");
    expect(r.sql).toContain(' AND osr.depth<=1');
  });

  it('缺省选项仍为 commercial 语义（选项不影响既有调用方）', () => {
    expect(recordScopeSql(['COMPANY', 'SELF'], [], actor, 'o', 2)).toEqual({
      sql: '(TRUE OR o.owner_id=$2)',
      values: [actor.employeeId],
    });
  });
});
