import { describe, expect, it } from 'vitest';
import type { Actor, ScopeAnchor } from '@kingturf/domain';
import type { DataScope } from '@kingturf/types';
import { employeeScopedPredicate, type EmployeeScopeOptions } from '../src/scope-sql.js';

const actor: Actor = {
  employeeId: '11111111-1111-4111-8111-111111111111',
  companyId: '22222222-2222-4222-8222-222222222222',
};
const org = '33333333-3333-4333-8333-333333333333';

const NOTIFICATION_SCOPE: EmployeeScopeOptions = { actorOrganizationValidation: 'skip' };

/**
 * 迁移前实现的逐字快照（原 foundation-repositories.ts PostgresNotificationRepository
 * 的 recipientScope，批次 1b 迁移时冻结）。仅作对拍基准。
 *
 * foundation 变体与 repositories 员工域变体（employeeScopedPredicate 缺省路径）的
 * **真实语义差异**（迁移原样保留，登记 TD-SEC-007）：
 * ① 隐式类型锚点 EXISTS 不 JOIN actor_org（不校验 actor 自身组织的有效性/归属）；
 * ② actorExists 不 JOIN authorized_org（不校验 actor 组织属于其公司且有效）。
 * 显式锚点子句另有纯排布差异（descendant_id+depth 在 ON 而非 WHERE、等值无空格）。
 * 共享实现以 actorOrganizationValidation='skip' 复现 foundation 原文——对拍零归一化。
 */
const legacyFoundationScope = (
  scopes: readonly DataScope[],
  legacyActor: Actor,
  anchors: readonly ScopeAnchor[],
  startParameter: number,
): Readonly<{ predicate: string; values: readonly string[] }> => {
  const values: string[] = [];
  const parameter = (value: string): string => {
    values.push(value);
    return `$${String(startParameter + values.length - 1)}`;
  };
  const clauses: string[] = [];
  if (scopes.includes('GROUP') || scopes.includes('COMPANY')) clauses.push('TRUE');
  if (scopes.includes('SELF')) clauses.push(`e.id=${parameter(legacyActor.employeeId)}`);
  for (const scope of ['TEAM', 'DEPARTMENT', 'REGION'] as const) {
    if (!scopes.includes(scope)) continue;
    const actorId = parameter(legacyActor.employeeId);
    const companyId = parameter(legacyActor.companyId);
    const depth = scope === 'TEAM' ? ' AND target_rel.depth<=1' : '';
    clauses.push(
      `EXISTS (SELECT 1 FROM employees scope_actor JOIN LATERAL (SELECT actor_rel.ancestor_id FROM organization_scope_relationships actor_rel JOIN organizations typed_anchor ON typed_anchor.id=actor_rel.ancestor_id AND typed_anchor.organization_type='${scope}' AND typed_anchor.owner_organization_id=scope_actor.company_id AND typed_anchor.active AND typed_anchor.deleted_at IS NULL WHERE actor_rel.descendant_id=scope_actor.organization_id ORDER BY actor_rel.depth LIMIT 1) nearest ON true JOIN organization_scope_relationships target_rel ON target_rel.ancestor_id=nearest.ancestor_id AND target_rel.descendant_id=e.organization_id${depth} WHERE scope_actor.id=${actorId} AND scope_actor.company_id=${companyId} AND scope_actor.active AND scope_actor.deleted_at IS NULL)`,
    );
  }
  for (const anchor of anchors) {
    if (anchor.scope === 'SELF' && anchor.organizationId === null)
      clauses.push(`e.id=${parameter(legacyActor.employeeId)}`);
    else if (
      (anchor.scope === 'COMPANY' || anchor.scope === 'GROUP') &&
      anchor.organizationId === null
    )
      clauses.push(`e.company_id=${parameter(legacyActor.companyId)}`);
    else if (
      (anchor.scope === 'TEAM' || anchor.scope === 'DEPARTMENT' || anchor.scope === 'REGION') &&
      anchor.organizationId !== null
    ) {
      const anchorId = parameter(anchor.organizationId);
      const depth = anchor.scope === 'TEAM' ? ' AND explicit_osr.depth<=1' : '';
      clauses.push(
        `EXISTS (SELECT 1 FROM organizations explicit_anchor JOIN organization_scope_relationships explicit_osr ON explicit_osr.ancestor_id=explicit_anchor.id AND explicit_osr.descendant_id=e.organization_id${depth} WHERE explicit_anchor.id=${anchorId} AND explicit_anchor.owner_organization_id=e.company_id AND explicit_anchor.organization_type='${anchor.scope}' AND explicit_anchor.active AND explicit_anchor.deleted_at IS NULL)`,
      );
    }
  }
  const actorId = parameter(legacyActor.employeeId);
  const companyId = parameter(legacyActor.companyId);
  const actorExists = `EXISTS (SELECT 1 FROM employees authorized_actor JOIN organizations authorized_company ON authorized_company.id=authorized_actor.company_id AND authorized_company.organization_type='COMPANY' AND authorized_company.active AND authorized_company.deleted_at IS NULL WHERE authorized_actor.id=${actorId} AND authorized_actor.company_id=${companyId} AND authorized_actor.active AND authorized_actor.deleted_at IS NULL)`;
  return {
    predicate: clauses.length ? `(${actorExists} AND (${clauses.join(' OR ')}))` : 'FALSE',
    values,
  };
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
  [{ scope: 'SELF', organizationId: null }],
  [{ scope: 'COMPANY', organizationId: null }],
  [
    { scope: 'TEAM', organizationId: org },
    { scope: 'DEPARTMENT', organizationId: '44444444-4444-4444-8444-444444444444' },
    { scope: 'SELF', organizationId: null },
  ],
];
const offsets = [1, 2, 3, 9];

describe('employeeScopedPredicate（skip 选项）× 迁移前快照对拍（批次 1b，零归一化）', () => {
  it('全部 288 组合（9 scope 组 × 8 锚点组 × 4 偏移）谓词与参数逐字节一致', () => {
    for (const scopes of scopeCases)
      for (const anchors of anchorCases)
        for (const offset of offsets) {
          const legacy = legacyFoundationScope(scopes, actor, anchors, offset);
          const migrated = employeeScopedPredicate(
            scopes,
            actor.employeeId,
            actor.companyId,
            anchors,
            offset,
            NOTIFICATION_SCOPE,
          );
          expect(migrated.predicate).toBe(legacy.predicate);
          expect(migrated.values).toEqual(legacy.values);
        }
  });
});

describe('employeeScopedPredicate 特征化（foundation 通知收件人语义）', () => {
  it('skip 变体：隐式类型锚点无 actor_org JOIN、actorExists 无 authorized_org JOIN（TD-SEC-007）', () => {
    const r = employeeScopedPredicate(
      ['TEAM'],
      actor.employeeId,
      actor.companyId,
      [],
      3,
      NOTIFICATION_SCOPE,
    );
    expect(r.predicate).not.toContain('JOIN organizations actor_org');
    expect(r.predicate).not.toContain('JOIN organizations authorized_org');
    const full = employeeScopedPredicate(['TEAM'], actor.employeeId, actor.companyId, [], 3);
    expect(full.predicate).toContain('JOIN organizations actor_org');
    expect(full.predicate).toContain('JOIN organizations authorized_org');
  });

  it('skip 变体显式锚点：descendant_id+depth 位于 ON 子句、TEAM 带 depth、租户边界在位', () => {
    const r = employeeScopedPredicate(
      [],
      actor.employeeId,
      actor.companyId,
      [{ scope: 'TEAM', organizationId: org }],
      3,
      NOTIFICATION_SCOPE,
    );
    expect(r.predicate).toContain(
      'AND explicit_osr.descendant_id=e.organization_id AND explicit_osr.depth<=1',
    );
    expect(r.predicate).toContain('explicit_anchor.owner_organization_id=e.company_id');
    expect(r.predicate).toContain("explicit_anchor.organization_type='TEAM'");
  });

  it('多锚点参数编号连续（SELF 锚点→$3，TEAM→$4，DEPARTMENT→$5）', () => {
    const r = employeeScopedPredicate(
      [],
      actor.employeeId,
      actor.companyId,
      [
        { scope: 'SELF', organizationId: null },
        { scope: 'TEAM', organizationId: org },
        { scope: 'DEPARTMENT', organizationId: '44444444-4444-4444-8444-444444444444' },
      ],
      3,
      NOTIFICATION_SCOPE,
    );
    expect(r.predicate).toContain('e.id=$3');
    expect(r.predicate).toContain('explicit_anchor.id=$4');
    expect(r.predicate).toContain('explicit_anchor.id=$5');
    expect(r.values).toEqual([
      actor.employeeId,
      org,
      '44444444-4444-4444-8444-444444444444',
      actor.employeeId,
      actor.companyId,
    ]);
  });

  it('空 scope → FALSE 且保留原实现的 2 个未引用尾部参数（行为守恒）', () => {
    const r = employeeScopedPredicate(
      [],
      actor.employeeId,
      actor.companyId,
      [],
      3,
      NOTIFICATION_SCOPE,
    );
    expect(r.predicate).toBe('FALSE');
    expect(r.values).toEqual([actor.employeeId, actor.companyId]);
  });
});
