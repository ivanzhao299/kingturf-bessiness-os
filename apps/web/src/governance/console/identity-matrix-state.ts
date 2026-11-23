import { signal, type Signal } from '@preact/signals';
import {
  buildMatrixModel,
  matrixUsers,
  mergeRoles,
  permissionPlan,
  roleCapabilitiesOf,
  type MatrixModel,
  type RoleCapabilities,
} from './matrix-model';
import { loadPagedSource, type PagedSource } from './paged-source';
import type { ConsolePorts, ConsoleRow } from './ports';

// GOV-UX ① 角色矩阵状态机：把勾选翻译成既有的 /api/v1/assignments 写路径——
// 勾选 = POST（分配，立即提交）；取消勾选 = DELETE（撤销，先内联确认并列出连带权限，
// 保留 B3「撤销需二次确认」语义）。角色/角色授权清单按 cursor 分页读尽；读不到或未读尽
// 一律回传提示并降级为只读，不把不完整清单当完整。
export type MatrixLens = 'role' | 'permission';
export type PendingRevoke = Readonly<{
  employeeId: string;
  userName: string;
  roleId: string;
  roleCode: string;
  collateral: readonly string[];
}>;
export type MatrixState = Readonly<{
  model: () => MatrixModel;
  lens: Signal<MatrixLens>;
  query: Signal<string>;
  focusOnly: Signal<boolean>;
  busy: Signal<ReadonlySet<string>>;
  pending: Signal<PendingRevoke | null>;
  error: Signal<string>;
  hint: Signal<string>;
  toggleRole: (employeeId: string, roleId: string, hasRole: boolean) => void;
  togglePermission: (employeeId: string, capability: string) => void;
  confirmRevoke: () => void;
  cancelRevoke: () => void;
}>;

const ROLES = '/api/v1/roles';
const GRANTS = '/api/v1/grants';
const PERMISSIONS = '/api/v1/permissions';
const ASSIGNMENTS = '/api/v1/assignments';

type Sources = Readonly<{
  roles: readonly ConsoleRow[];
  roleCapabilities: RoleCapabilities | null;
  hint: string;
}>;

const loadRoleCapabilities = async (
  ports: ConsolePorts,
): Promise<Readonly<{ known: RoleCapabilities | null; hint: string }>> => {
  const denied = ports.viewError(GRANTS) ?? ports.viewError(PERMISSIONS);
  if (!ports.loaded(GRANTS) || !ports.loaded(PERMISSIONS))
    return { known: null, hint: '权限点来源不可用（角色授权清单未加载）' };
  if (denied !== undefined) return { known: null, hint: `权限点来源不可用：${denied}` };
  const [grants, permissions] = await Promise.all([
    loadPagedSource(ports.fetchPage, GRANTS, ports.initialView(GRANTS)),
    loadPagedSource(ports.fetchPage, PERMISSIONS, ports.initialView(PERMISSIONS)),
  ]);
  const complete = grants.complete && permissions.complete;
  const known = complete ? roleCapabilitiesOf(grants.rows, permissions.rows) : null;
  return { known, hint: known === null ? '权限点来源不可用：角色授权清单未读尽' : '' };
};

const roleHints = (ports: ConsolePorts, source: PagedSource | null): readonly string[] => {
  const denied = ports.viewError(ROLES);
  if (!ports.loaded(ROLES)) return ['需要 role:read 权限才能读取角色清单'];
  if (denied !== undefined) return [`角色清单读取失败：${denied}`];
  if (source === null) return [];
  return [
    source.error === '' ? '' : `角色清单读取失败：${source.error}`,
    source.complete ? '' : '角色清单未读尽，矩阵仅展示已加载角色',
  ];
};

const loadSources = async (ports: ConsolePorts): Promise<Sources> => {
  const roles = ports.loaded(ROLES)
    ? await loadPagedSource(ports.fetchPage, ROLES, ports.initialView(ROLES))
    : null;
  const granted = await loadRoleCapabilities(ports);
  const hint = [...roleHints(ports, roles), granted.hint].filter(Boolean).join('；');
  return { roles: roles?.rows ?? [], roleCapabilities: granted.known, hint };
};

const cellKey = (employeeId: string, roleId: string): string => `${employeeId}:${roleId}`;

const without = (set: ReadonlySet<string>, key: string): ReadonlySet<string> => {
  const next = new Set(set);
  next.delete(key);
  return next;
};

export const createMatrixState = (
  ports: ConsolePorts,
  profiles: () => readonly ConsoleRow[],
  pageRoles: () => readonly ConsoleRow[],
  refresh: () => Promise<void>,
): MatrixState => {
  const lens = signal<MatrixLens>('role');
  const query = signal('');
  const focusOnly = signal(false);
  const busy = signal<ReadonlySet<string>>(new Set());
  const pending = signal<PendingRevoke | null>(null);
  const error = signal('');
  const hint = signal('');
  const roles = signal<readonly ConsoleRow[]>([]);
  const roleCapabilities = signal<RoleCapabilities | null>(null);
  const model = (): MatrixModel =>
    buildMatrixModel(
      matrixUsers(profiles()),
      mergeRoles(pageRoles(), roles.value),
      roleCapabilities.value,
    );
  void loadSources(ports).then((sources) => {
    roles.value = sources.roles;
    roleCapabilities.value = sources.roleCapabilities;
    hint.value = sources.hint;
  });

  const runAssignment = async (
    method: 'POST' | 'DELETE',
    employeeId: string,
    roleId: string,
  ): Promise<void> => {
    const key = cellKey(employeeId, roleId);
    if (busy.value.has(key)) return;
    busy.value = new Set([...busy.value, key]);
    error.value = '';
    try {
      await ports.submit(ASSIGNMENTS, { employeeId, roleId }, method);
      await refresh();
    } catch (reason) {
      error.value = reason instanceof Error ? reason.message : '角色授权操作失败，请稍后重试';
    } finally {
      busy.value = without(busy.value, key);
    }
  };
  const askRevoke = (employeeId: string, roleId: string, collateral: readonly string[]): void => {
    const current = model();
    const user = current.users.find((item) => item.employeeId === employeeId);
    const role = current.roles.find((item) => item.id === roleId);
    if (user === undefined || role === undefined) return;
    pending.value = {
      employeeId,
      userName: user.name,
      roleId,
      roleCode: role.code,
      collateral: [...collateral].sort(),
    };
  };
  const toggleRole = (employeeId: string, roleId: string, hasRole: boolean): void => {
    if (busy.value.has(cellKey(employeeId, roleId))) return;
    if (hasRole) askRevoke(employeeId, roleId, [...(model().roleCapabilities?.get(roleId) ?? [])]);
    else void runAssignment('POST', employeeId, roleId);
  };
  const togglePermission = (employeeId: string, capability: string): void => {
    const user = model().users.find((item) => item.employeeId === employeeId);
    if (user === undefined) return;
    const plan = permissionPlan(model(), user, capability);
    if (plan.kind === 'blocked') return;
    if (busy.value.has(cellKey(employeeId, plan.roleId))) return;
    if (plan.kind === 'revoke') askRevoke(employeeId, plan.roleId, plan.collateral);
    else void runAssignment('POST', employeeId, plan.roleId);
  };
  return {
    model,
    lens,
    query,
    focusOnly,
    busy,
    pending,
    error,
    hint,
    toggleRole,
    togglePermission,
    confirmRevoke: () => {
      const current = pending.value;
      pending.value = null;
      if (current) void runAssignment('DELETE', current.employeeId, current.roleId);
    },
    cancelRevoke: () => {
      pending.value = null;
    },
  };
};
