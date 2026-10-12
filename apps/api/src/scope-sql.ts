import type { Actor, ScopeAnchor } from '@kingturf/domain';
import { DATA_SCOPES, type DataScope } from '@kingturf/types';

// 数据范围（DataScope）SQL 谓词的共享实现（批次 1 收敛，TD-DUP-001）。
// 迁移纪律：两族变体自此只在本文件演化——
//   ① 员工域变体（基于 employees 表：e.company_id/e.id/e.organization_id），本文件先行收敛
//   ② 业务记录变体（基于 owner_id/owner_organization_id + 租户校验），批次 1b 逐文件迁入
// 行为守恒：实现自 policy.ts 与 repositories.ts 逐字搬运，SQL 字节不变；语义由
//   apps/api/test/{security,postgres.integration}.test.ts 的 DataScope 用例守护。

/**
 * 员工域简单变体（原 policy.ts dataScopeSql）：按 scope 生成 OR 连接谓词。
 * values 为「具名值」约定（companyId/actorId/actorOrganizationId/…），由调用方解析为实参。
 */
export function dataScopeSql(
  scopes: readonly DataScope[],
  employeeAlias = 'e',
  startParameter = 1,
): Readonly<{ sql: string; values: readonly string[] }> {
  const validScopes = [...new Set(scopes.filter((scope) => DATA_SCOPES.includes(scope)))];
  if (validScopes.length === 0) return { sql: 'FALSE', values: [] };
  // Repositories retain their mandatory company predicate; GROUP only removes narrower filters.
  if (validScopes.includes('GROUP')) return { sql: 'TRUE', values: [] };
  const clauses: string[] = [];
  const values: string[] = [];
  const add = (
    scope: DataScope,
    expression: (parameter: string) => string,
    value: string,
  ): void => {
    if (validScopes.includes(scope)) {
      clauses.push(expression(`$${String(startParameter + values.length)}`));
      values.push(value);
    }
  };
  add('COMPANY', (parameter) => `${employeeAlias}.company_id = ${parameter}`, 'companyId');
  add('SELF', (parameter) => `${employeeAlias}.id = ${parameter}`, 'actorId');
  add(
    'TEAM',
    (parameter) =>
      `EXISTS (SELECT 1 FROM organization_scope_relationships osr WHERE osr.ancestor_id = ${parameter} AND osr.descendant_id = ${employeeAlias}.organization_id AND osr.depth <= 1)`,
    'actorOrganizationId',
  );
  add(
    'DEPARTMENT',
    (parameter) =>
      `EXISTS (SELECT 1 FROM organization_scope_relationships osr WHERE osr.ancestor_id = ${parameter} AND osr.descendant_id = ${employeeAlias}.organization_id)`,
    'actorDepartmentId',
  );
  add(
    'REGION',
    (parameter) =>
      `EXISTS (SELECT 1 FROM organization_scope_relationships osr WHERE osr.ancestor_id = ${parameter} AND osr.descendant_id = ${employeeAlias}.organization_id)`,
    'actorRegionId',
  );
  return { sql: clauses.length === 0 ? 'FALSE' : `(${clauses.join(' OR ')})`, values };
}

/**
 * 员工域完整变体（原 repositories.ts EmployeeRepository.#scoped）：隐式类型锚点（LATERAL
 * 最近类型祖先）+ 显式锚点 + actor 有效性 EXISTS 包裹。SQL 与迁移前逐字一致。
 */
export function employeeScopedPredicate(
  scopes: readonly DataScope[],
  actorId: string,
  companyId: string,
  anchors: readonly ScopeAnchor[] = [],
  startParameter = 3,
): { predicate: string; values: readonly unknown[] } {
  const values: unknown[] = [];
  const parameter = (value: string): string => {
    values.push(value);
    return `$${String(startParameter + values.length - 1)}`;
  };
  const clauses: string[] = [];
  if (scopes.includes('GROUP') || scopes.includes('COMPANY')) clauses.push('TRUE');
  if (scopes.includes('SELF')) clauses.push(`e.id=${parameter(actorId)}`);
  for (const typed of ['TEAM', 'DEPARTMENT', 'REGION'] as const) {
    if (scopes.includes(typed)) {
      const actorParameter = parameter(actorId);
      const companyParameter = parameter(companyId);
      const depth = typed === 'TEAM' ? ' AND target_rel.depth<=1' : '';
      clauses.push(
        `EXISTS (SELECT 1 FROM employees scope_actor JOIN organizations actor_org ON actor_org.id=scope_actor.organization_id AND actor_org.owner_organization_id=scope_actor.company_id AND actor_org.active AND actor_org.deleted_at IS NULL JOIN LATERAL (SELECT actor_rel.ancestor_id FROM organization_scope_relationships actor_rel JOIN organizations typed_anchor ON typed_anchor.id=actor_rel.ancestor_id AND typed_anchor.organization_type='${typed}' AND typed_anchor.active AND typed_anchor.deleted_at IS NULL AND typed_anchor.owner_organization_id=scope_actor.company_id WHERE actor_rel.descendant_id=scope_actor.organization_id ORDER BY actor_rel.depth LIMIT 1) nearest ON true JOIN organization_scope_relationships target_rel ON target_rel.ancestor_id=nearest.ancestor_id AND target_rel.descendant_id=e.organization_id${depth} WHERE scope_actor.id=${actorParameter} AND scope_actor.company_id=${companyParameter} AND scope_actor.active AND scope_actor.deleted_at IS NULL)`,
      );
    }
  }
  for (const anchor of anchors) {
    if (anchor.scope === 'SELF' && anchor.organizationId === null) {
      clauses.push(`e.id = $${String(startParameter + values.length)}`);
      values.push(actorId);
    } else if (
      (anchor.scope === 'COMPANY' || anchor.scope === 'GROUP') &&
      anchor.organizationId === null
    ) {
      clauses.push(`e.company_id = $${String(startParameter + values.length)}`);
      values.push(companyId);
    } else if (
      (anchor.scope === 'TEAM' || anchor.scope === 'DEPARTMENT' || anchor.scope === 'REGION') &&
      anchor.organizationId !== null
    ) {
      const parameter = `$${String(startParameter + values.length)}`;
      const depth = anchor.scope === 'TEAM' ? ' AND explicit_osr.depth <= 1' : '';
      clauses.push(
        `EXISTS (SELECT 1 FROM organizations explicit_anchor JOIN organization_scope_relationships explicit_osr ON explicit_osr.ancestor_id=explicit_anchor.id WHERE explicit_anchor.id=${parameter} AND explicit_anchor.owner_organization_id=e.company_id AND explicit_anchor.organization_type='${anchor.scope}' AND explicit_anchor.active AND explicit_anchor.deleted_at IS NULL AND explicit_osr.descendant_id=e.organization_id${depth})`,
      );
      values.push(anchor.organizationId);
    }
  }
  const actorParameter = parameter(actorId);
  const companyParameter = parameter(companyId);
  const actorExists = `EXISTS (SELECT 1 FROM employees authorized_actor JOIN organizations authorized_company ON authorized_company.id=authorized_actor.company_id AND authorized_company.organization_type='COMPANY' AND authorized_company.active AND authorized_company.deleted_at IS NULL JOIN organizations authorized_org ON authorized_org.id=authorized_actor.organization_id AND authorized_org.owner_organization_id=authorized_actor.company_id AND authorized_org.active AND authorized_org.deleted_at IS NULL WHERE authorized_actor.id=${actorParameter} AND authorized_actor.company_id=${companyParameter} AND authorized_actor.active AND authorized_actor.deleted_at IS NULL)`;
  return {
    predicate: clauses.length === 0 ? 'FALSE' : `(${actorExists} AND (${clauses.join(' OR ')}))`,
    values,
  };
}

/**
 * 业务记录域变体：owner_id/owner_organization_id 基础 + 锚点 EXISTS（TEAM 含 depth<=1）
 * + 租户校验（alias.tenant_id）。alias 为表别名（commercial 'o' / crm 'c'|'l'|'op'）。
 * 域间差异以显式选项 RecordScopeOptions 表达（见其注释）；缺省行为与 commercial 原
 * 实现逐字一致（SQL 字节不变，由 scope-sql-commercial.test.ts 的快照对拍守护）。
 */
export type RecordScopeOptions = Readonly<{
  /** CRM：SELF 时附带无主池子句 (alias.status='POOL' AND alias.owner_id IS NULL) */
  includeUnownedPool?: boolean;
  /** CRM：GROUP/COMPANY 直接短路返回 TRUE；缺省并入 OR 子句（commercial） */
  companyShortCircuit?: boolean;
  /** CRM='typed'：按 TEAM/DEPARTMENT/REGION 类型清单放行锚点（不依赖 scopes）；缺省 'granted'=锚点 scope 须已授予 */
  anchorGuard?: 'granted' | 'typed';
  /**
   * complaint='relationshipOnly'：锚点谓词只查 organization_scope_relationships 单表
   * （osr.tenant_id 租户校验 + osr.scope=anchor.scope；无 organizations JOIN、无组织
   * active/deleted 与 organization_type 校验、TEAM 无 depth 限制）。
   * 缺省 'organizationJoin'：JOIN organizations 并校验类型/租户/有效性 + TEAM depth<=1。
   * 两形态为**真实语义差异**（complaint 原样保留，见台账 TD-SEC-006）。
   */
  anchorPredicate?: 'organizationJoin' | 'relationshipOnly';
}>;

export function recordScopeSql(
  scopes: readonly DataScope[],
  anchors: readonly ScopeAnchor[],
  actor: Actor,
  alias: string,
  offset: number,
  options: RecordScopeOptions = {},
): { sql: string; values: readonly unknown[] } {
  const {
    includeUnownedPool = false,
    companyShortCircuit = false,
    anchorGuard = 'granted',
    anchorPredicate = 'organizationJoin',
  } = options;
  if (companyShortCircuit && (scopes.includes('GROUP') || scopes.includes('COMPANY')))
    return { sql: 'TRUE', values: [] };
  const clauses: string[] = [];
  const values: unknown[] = [];
  if (!companyShortCircuit && (scopes.includes('COMPANY') || scopes.includes('GROUP')))
    clauses.push('TRUE');
  if (scopes.includes('SELF'))
    clauses.push(`${alias}.owner_id=$${String(offset + values.push(actor.employeeId) - 1)}`);
  if (includeUnownedPool && scopes.includes('SELF'))
    clauses.push(`(${alias}.status='POOL' AND ${alias}.owner_id IS NULL)`);
  for (const anchor of anchors) {
    const anchorAllowed =
      anchor.organizationId &&
      (anchorGuard === 'typed'
        ? ['TEAM', 'DEPARTMENT', 'REGION'].includes(anchor.scope)
        : scopes.includes(anchor.scope));
    if (!anchorAllowed) continue;
    clauses.push(
      anchorPredicate === 'relationshipOnly'
        ? `EXISTS(SELECT 1 FROM organization_scope_relationships osr WHERE osr.tenant_id=${alias}.tenant_id AND osr.ancestor_id=$${String(offset + values.push(anchor.organizationId) - 1)} AND osr.descendant_id=${alias}.owner_organization_id AND osr.scope='${anchor.scope}')`
        : `EXISTS(SELECT 1 FROM organizations anchor JOIN organization_scope_relationships osr ON osr.ancestor_id=anchor.id AND osr.descendant_id=${alias}.owner_organization_id${anchor.scope === 'TEAM' ? ' AND osr.depth<=1' : ''} WHERE anchor.id=$${String(offset + values.push(anchor.organizationId) - 1)} AND anchor.owner_organization_id=${alias}.tenant_id AND anchor.organization_type='${anchor.scope}' AND anchor.active AND anchor.deleted_at IS NULL)`,
    );
  }
  return { sql: clauses.length ? `(${clauses.join(' OR ')})` : 'FALSE', values };
}
