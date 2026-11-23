import { recordOf, textOf, type ConsoleRow } from './ports';

// GOV-UX ① 角色矩阵模型（纯函数）。
// 语义约束（行为守恒）：后端有效权限点只由「用户→角色」指派推导（直接数据范围不授予
// 能力），API 没有「按用户按权限点」的原子写路径。因此——
//   · 「按角色」视图：用户×角色，勾选 = 现有 POST/DELETE /api/v1/assignments（原子）；
//   · 「按权限点」视图：用户×权限点派生交叉表；仅当某权限点对该用户只有唯一角色来源时
//     才允许直接勾选（等价于勾选/取消那个角色），多来源或来源不可读时如实只读并说明。
export type MatrixUser = Readonly<{
  employeeId: string;
  name: string;
  roles: ReadonlySet<string>;
  roleCodes: readonly string[];
  capabilities: ReadonlySet<string>;
}>;
export type MatrixRole = Readonly<{ id: string; code: string; name: string }>;
export type RoleCapabilities = ReadonlyMap<string, ReadonlySet<string>>;
export type TogglePlan =
  | Readonly<{
      kind: 'assign' | 'revoke';
      roleId: string;
      roleCode: string;
      collateral: readonly string[];
    }>
  | Readonly<{ kind: 'blocked'; reason: string }>;
export type MatrixModel = Readonly<{
  users: readonly MatrixUser[];
  roles: readonly MatrixRole[];
  /** null = 角色授权清单不完整或不可读（权限点视图只读）。 */
  roleCapabilities: RoleCapabilities | null;
  capabilities: readonly string[];
}>;
export type CapabilityGroup = Readonly<{ resource: string; capabilities: readonly string[] }>;
export type MatrixScope = Readonly<{
  users: readonly MatrixUser[];
  roles: readonly MatrixRole[];
  groups: readonly CapabilityGroup[];
}>;

const strings = (value: unknown): readonly string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];

export const roleOf = (row: ConsoleRow): MatrixRole | null =>
  typeof row.id !== 'string' || row.id === ''
    ? null
    : { id: row.id, code: textOf(row.code, row.id), name: textOf(row.name, row.id) };

const userOf = (row: ConsoleRow): MatrixUser => {
  const employeeId = row.employeeId as string;
  const roleRows = (Array.isArray(row.roles) ? row.roles : []).map(recordOf);
  return {
    employeeId,
    name: textOf(row.displayName, textOf(row.employeeNumber, employeeId)),
    roles: new Set(roleRows.map((role) => textOf(role.id)).filter(Boolean)),
    roleCodes: roleRows.map((role) => textOf(role.code)).filter(Boolean),
    capabilities: new Set(strings(row.capabilities)),
  };
};

export const matrixUsers = (profiles: readonly ConsoleRow[]): readonly MatrixUser[] =>
  profiles.filter((row) => typeof row.employeeId === 'string' && row.employeeId !== '').map(userOf);

// 多来源角色并集（按 id 去重、按编码排序——与服务端 roles 列表 code ASC 口径一致）。
export const mergeRoles = (...lists: readonly (readonly ConsoleRow[])[]): readonly MatrixRole[] => {
  const byId = new Map<string, MatrixRole>();
  for (const list of lists)
    for (const row of list) {
      const role = roleOf(row);
      if (role) byId.set(role.id, role);
    }
  return [...byId.values()].sort((left, right) => left.code.localeCompare(right.code));
};

// 角色→权限点：任一授权行引用了未知的权限 id 即视为清单不完整（返回 null），不冒充完整。
export const roleCapabilitiesOf = (
  grants: readonly ConsoleRow[],
  permissions: readonly ConsoleRow[],
): RoleCapabilities | null => {
  const capabilityById = new Map<string, string>();
  for (const permission of permissions) {
    const capability = textOf(permission.capability);
    if (typeof permission.id === 'string' && capability !== '')
      capabilityById.set(permission.id, capability);
  }
  const byRole = new Map<string, Set<string>>();
  for (const grant of grants) {
    const capability = capabilityById.get(textOf(grant.permissionId));
    if (capability === undefined) return null;
    const roleId = textOf(grant.roleId);
    if (roleId === '') continue;
    byRole.set(roleId, new Set([...(byRole.get(roleId) ?? []), capability]));
  }
  return new Map([...byRole].map(([roleId, granted]) => [roleId, new Set(granted)]));
};

export const buildMatrixModel = (
  users: readonly MatrixUser[],
  roles: readonly MatrixRole[],
  roleCapabilities: RoleCapabilities | null,
): MatrixModel => {
  const capabilities = new Set<string>();
  for (const user of users)
    for (const capability of user.capabilities) capabilities.add(capability);
  if (roleCapabilities)
    for (const granted of roleCapabilities.values())
      for (const capability of granted) capabilities.add(capability);
  return { users, roles, roleCapabilities, capabilities: [...capabilities].sort() };
};

const rolesGranting = (model: MatrixModel, capability: string): readonly MatrixRole[] | null =>
  model.roleCapabilities === null
    ? null
    : model.roles.filter((role) => model.roleCapabilities?.get(role.id)?.has(capability) === true);

const codesOf = (roles: readonly MatrixRole[]): string => roles.map((role) => role.code).join('、');

const SOURCE_UNAVAILABLE = '权限点来源不可用（角色授权清单未完整读取），请在「按角色」视图管理';

export const permissionPlan = (
  model: MatrixModel,
  user: MatrixUser,
  capability: string,
): TogglePlan => {
  const sources = rolesGranting(model, capability);
  if (sources === null) return { kind: 'blocked', reason: SOURCE_UNAVAILABLE };
  const held = sources.filter((role) => user.roles.has(role.id));
  if (user.capabilities.has(capability)) {
    const [only, ...others] = held;
    if (others.length > 0)
      return {
        kind: 'blocked',
        reason: `由多个角色授予（${codesOf(held)}），请在「按角色」视图逐一取消勾选`,
      };
    if (only === undefined)
      return { kind: 'blocked', reason: '未在已加载角色中找到授予该权限点的角色' };
    const collateral = [...(model.roleCapabilities?.get(only.id) ?? [])]
      .filter((item) => item !== capability)
      .sort();
    return { kind: 'revoke', roleId: only.id, roleCode: only.code, collateral };
  }
  const candidates = sources.filter((role) => !user.roles.has(role.id));
  const [only, ...others] = candidates;
  if (others.length > 0)
    return {
      kind: 'blocked',
      reason: `可由多个角色授予（${codesOf(candidates)}），请在「按角色」视图勾选`,
    };
  if (only === undefined) return { kind: 'blocked', reason: '没有可分配的角色授予该权限点' };
  return { kind: 'assign', roleId: only.id, roleCode: only.code, collateral: [] };
};

export const groupCapabilities = (capabilities: readonly string[]): readonly CapabilityGroup[] => {
  const groups = new Map<string, string[]>();
  for (const capability of capabilities) {
    const resource = capability.split(':')[0] ?? capability;
    groups.set(resource, [...(groups.get(resource) ?? []), capability]);
  }
  return [...groups].map(([resource, items]) => ({ resource, capabilities: items }));
};

const matches = (needle: string, ...values: readonly string[]): boolean =>
  values.some((value) => value.toLowerCase().includes(needle));

// 搜索：关键词命中角色/权限点时收敛列并把行过滤到命中的用户；未命中任何列时保留全部列，
// 仅按用户（姓名/编号/角色/权限点）过滤行。
export const scopeModel = (
  model: MatrixModel,
  query: string,
  focusId: string | null,
): MatrixScope => {
  const needle = query.trim().toLowerCase();
  const roleHits = model.roles.filter((role) => matches(needle, role.code, role.name));
  const capabilityHits = model.capabilities.filter((capability) => matches(needle, capability));
  const roles = needle !== '' && roleHits.length > 0 ? roleHits : model.roles;
  const capabilityColumns =
    needle !== '' && capabilityHits.length > 0 ? capabilityHits : model.capabilities;
  const narrowed = needle !== '' && (roleHits.length > 0 || capabilityHits.length > 0);
  const users = model.users.filter(
    (user) =>
      (focusId === null || user.employeeId === focusId) &&
      (needle === '' ||
        !narrowed ||
        matches(needle, user.name, ...user.roleCodes, ...user.capabilities)),
  );
  return { users, roles, groups: groupCapabilities(capabilityColumns) };
};
