import { describe, expect, it } from 'vitest';
import { employeeScopedPredicate } from '../src/scope-sql.js';

const actorId = '11111111-1111-4111-8111-111111111111';
const companyId = '22222222-2222-4222-8222-222222222222';
const anchorOrg = '33333333-3333-4333-8333-333333333333';

describe('employeeScopedPredicate（批次 1a 收敛后的员工域完整变体）', () => {
  it('空 scope 直接 FALSE（保留原实现随附的 2 个未引用参数，行为守恒）', () => {
    const r = employeeScopedPredicate([], actorId, companyId);
    expect(r.predicate).toBe('FALSE');
    expect(r.values).toEqual([actorId, companyId]);
  });

  it('GROUP 放行但仍包裹 actor 有效性检查', () => {
    const r = employeeScopedPredicate(['GROUP'], actorId, companyId);
    expect(r.predicate.startsWith('(EXISTS (SELECT 1 FROM employees authorized_actor')).toBe(true);
    expect(r.predicate.endsWith(' AND (TRUE))')).toBe(true);
    expect(r.values).toEqual([actorId, companyId]);
  });

  it('SELF 命中 e.id 且参数序号从 startParameter 起', () => {
    const r = employeeScopedPredicate(['SELF'], actorId, companyId, [], 3);
    expect(r.predicate).toContain('e.id=$3');
    expect(r.predicate).toContain('authorized_actor.id=$4');
    expect(r.values).toEqual([actorId, actorId, companyId]);
    const offset = employeeScopedPredicate(['SELF'], actorId, companyId, [], 9);
    expect(offset.predicate).toContain('e.id=$9');
  });

  it('TEAM 隐式锚点带 depth<=1，DEPARTMENT 不带', () => {
    const team = employeeScopedPredicate(['TEAM'], actorId, companyId);
    expect(team.predicate).toContain("typed_anchor.organization_type='TEAM'");
    expect(team.predicate).toContain('target_rel.depth<=1');
    const dept = employeeScopedPredicate(['DEPARTMENT'], actorId, companyId);
    expect(dept.predicate).toContain("typed_anchor.organization_type='DEPARTMENT'");
    expect(dept.predicate).not.toContain('target_rel.depth<=1');
  });

  it('显式锚点：TEAM 带 organizationId 生成 explicit_anchor 存在性子句', () => {
    const r = employeeScopedPredicate([], actorId, companyId, [
      { scope: 'TEAM', organizationId: anchorOrg },
    ]);
    expect(r.predicate).toContain('organizations explicit_anchor');
    expect(r.predicate).toContain('explicit_osr.depth <= 1');
    expect(r.values).toContain(anchorOrg);
  });

  it('显式锚点：SELF/COMPANY 空 organizationId 走等值子句', () => {
    const r = employeeScopedPredicate([], actorId, companyId, [
      { scope: 'SELF', organizationId: null },
      { scope: 'COMPANY', organizationId: null },
    ]);
    expect(r.predicate).toContain('e.id = $3');
    expect(r.predicate).toContain('e.company_id = $4');
    expect(r.values).toEqual([actorId, companyId, actorId, companyId]);
  });
});
