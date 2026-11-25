import { ConfirmDialog } from '@kingturf/ui';
import {
  permissionPlan,
  scopeModel,
  type MatrixModel,
  type MatrixRole,
  type MatrixUser,
} from './matrix-model';
import type { MatrixLens, PendingRevoke } from './identity-matrix-state';

// GOV-UX ① 用户 360 抽屉内的「角色矩阵」：替代逐个「分配角色/撤销角色」弹窗表单。
// 「按角色」= 用户×角色勾选表（原子写）；「按权限点」= 用户×权限点交叉表（按资源分组，
// 唯一角色来源处可勾选，其余如实只读并给出原因）。首列与表头吸附，便于宽表滚动。
export type MatrixView = Readonly<{
  model: MatrixModel;
  lens: MatrixLens;
  onLens: (lens: MatrixLens) => void;
  query: string;
  onQuery: (value: string) => void;
  focusOnly: boolean;
  onFocusOnly: (value: boolean) => void;
  currentId: string | null;
  mayManage: boolean;
  busy: ReadonlySet<string>;
  pending: PendingRevoke | null;
  onConfirm: () => void;
  onCancel: () => void;
  error: string;
  hint: string;
  onToggleRole: (employeeId: string, roleId: string, hasRole: boolean) => void;
  onTogglePermission: (employeeId: string, capability: string) => void;
}>;

type CellAttrs = Readonly<Record<string, string>>;

const Mark = ({
  on,
  reason,
  attrs,
}: Readonly<{ on: boolean; reason: string; attrs: CellAttrs }>) => (
  <span
    class="gov-matrix-mark"
    data-state={on ? 'on' : 'off'}
    data-testid="kt-matrix-mark"
    title={reason}
    {...attrs}
  >
    {on ? '✓' : '—'}
  </span>
);

const checkbox = (
  checked: boolean,
  label: string,
  title: string,
  disabled: boolean,
  attrs: CellAttrs,
  onClick: () => void,
) => (
  <input
    type="checkbox"
    checked={checked}
    aria-checked={checked ? 'true' : 'false'}
    aria-label={label}
    title={title}
    disabled={disabled}
    data-testid="kt-matrix-cell"
    {...attrs}
    onClick={onClick}
  />
);

const RoleCell = ({
  user,
  role,
  view,
}: Readonly<{ user: MatrixUser; role: MatrixRole; view: MatrixView }>) => {
  const has = user.roles.has(role.id);
  const attrs: CellAttrs = { 'data-employee': user.employeeId, 'data-role': role.id };
  if (!view.mayManage) return <Mark on={has} reason="" attrs={attrs} />;
  const label = `${user.name} · ${role.code}`;
  return checkbox(
    has,
    label,
    has ? '取消勾选将撤销该角色（需确认）' : '勾选将分配该角色',
    view.busy.has(`${user.employeeId}:${role.id}`),
    attrs,
    () => {
      view.onToggleRole(user.employeeId, role.id, has);
    },
  );
};

const PermissionCell = ({
  user,
  capability,
  view,
}: Readonly<{ user: MatrixUser; capability: string; view: MatrixView }>) => {
  const has = user.capabilities.has(capability);
  const plan = permissionPlan(view.model, user, capability);
  const attrs: CellAttrs = { 'data-employee': user.employeeId, 'data-capability': capability };
  if (!view.mayManage || plan.kind === 'blocked')
    return <Mark on={has} reason={plan.kind === 'blocked' ? plan.reason : ''} attrs={attrs} />;
  const title =
    plan.kind === 'assign'
      ? `勾选将分配角色 ${plan.roleCode}`
      : `取消勾选将撤销角色 ${plan.roleCode}（需确认）`;
  return checkbox(
    has,
    `${user.name} · ${capability}`,
    title,
    view.busy.has(`${user.employeeId}:${plan.roleId}`),
    attrs,
    () => {
      view.onTogglePermission(user.employeeId, capability);
    },
  );
};

const EmptyUsers = ({ colSpan }: Readonly<{ colSpan: number }>) => (
  <tr>
    <td class="gov-matrix-empty" colSpan={colSpan}>
      无匹配用户
    </td>
  </tr>
);

const RoleTable = ({ view }: Readonly<{ view: MatrixView }>) => {
  const scoped = scopeModel(view.model, view.query, view.focusOnly ? view.currentId : null);
  return (
    <table class="gov-matrix" data-testid="kt-matrix-role">
      <thead>
        <tr>
          <th class="gov-matrix-sticky" scope="col">
            用户
          </th>
          {scoped.roles.map((role) => (
            <th key={role.id} scope="col" title={`${role.code} · ${role.name}`}>
              {role.code}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {scoped.users.length === 0 ? <EmptyUsers colSpan={scoped.roles.length + 1} /> : null}
        {scoped.users.map((user) => (
          <tr
            key={user.employeeId}
            class={user.employeeId === view.currentId ? 'is-current' : undefined}
          >
            <th class="gov-matrix-sticky" scope="row">
              {user.name}
            </th>
            {scoped.roles.map((role) => (
              <td key={role.id}>
                <RoleCell user={user} role={role} view={view} />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
};

const actionOf = (capability: string): string => capability.slice(capability.indexOf(':') + 1);

const PermissionTable = ({ view }: Readonly<{ view: MatrixView }>) => {
  const scoped = scopeModel(view.model, view.query, view.focusOnly ? view.currentId : null);
  const groups = scoped.groups;
  const width = groups.reduce((sum, group) => sum + group.capabilities.length, 0);
  return (
    <table class="gov-matrix" data-testid="kt-matrix-permission">
      <thead>
        <tr>
          <th class="gov-matrix-sticky" scope="col" rowSpan={2}>
            用户
          </th>
          {groups.map((group) => (
            <th
              key={group.resource}
              class="gov-matrix-group"
              scope="colgroup"
              colSpan={group.capabilities.length}
            >
              {group.resource}
            </th>
          ))}
        </tr>
        <tr>
          {groups.flatMap((group) =>
            group.capabilities.map((capability) => (
              <th key={capability} scope="col" title={capability}>
                {actionOf(capability)}
              </th>
            )),
          )}
        </tr>
      </thead>
      <tbody>
        {scoped.users.length === 0 ? <EmptyUsers colSpan={width + 1} /> : null}
        {scoped.users.map((user) => (
          <tr
            key={user.employeeId}
            class={user.employeeId === view.currentId ? 'is-current' : undefined}
          >
            <th class="gov-matrix-sticky" scope="row">
              {user.name}
            </th>
            {groups.flatMap((group) =>
              group.capabilities.map((capability) => (
                <td key={capability}>
                  <PermissionCell user={user} capability={capability} view={view} />
                </td>
              )),
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
};

const RevokeConfirm = ({
  pending,
  onConfirm,
  onCancel,
}: Readonly<{ pending: PendingRevoke; onConfirm: () => void; onCancel: () => void }>) => (
  <ConfirmDialog
    title={`撤销 ${pending.userName} 的角色 ${pending.roleCode}`}
    message={
      pending.collateral.length > 0
        ? `撤销后立即生效。将同时失去该角色授予的其它权限：${pending.collateral.join('、')}`
        : '撤销后立即生效。'
    }
    confirmLabel="确认撤销"
    destructive
    onConfirm={onConfirm}
    onCancel={onCancel}
  />
);

export const IdentityMatrix = (view: MatrixView) => (
  <section class="gov-matrix-block" data-testid="kt-identity-matrix">
    <div class="gov-matrix-bar">
      <h3>角色矩阵</h3>
      <div class="console-view-switch" role="group" aria-label="矩阵视图">
        <button
          type="button"
          aria-pressed={view.lens === 'role' ? 'true' : 'false'}
          data-testid="kt-matrix-lens-role"
          onClick={() => {
            view.onLens('role');
          }}
        >
          按角色
        </button>
        <button
          type="button"
          aria-pressed={view.lens === 'permission' ? 'true' : 'false'}
          data-testid="kt-matrix-lens-permission"
          onClick={() => {
            view.onLens('permission');
          }}
        >
          按权限点
        </button>
      </div>
      <input
        type="search"
        aria-label="搜索矩阵"
        placeholder="搜索用户、角色或权限点"
        data-testid="kt-matrix-query"
        value={view.query}
        onInput={(event: Event) => {
          view.onQuery((event.target as unknown as { value: string }).value);
        }}
      />
      <label class="gov-matrix-focus">
        <input
          type="checkbox"
          data-testid="kt-matrix-focus"
          checked={view.focusOnly}
          onClick={() => {
            view.onFocusOnly(!view.focusOnly);
          }}
        />
        仅看当前用户
      </label>
    </div>
    {view.hint !== '' ? (
      <p class="console-hint" data-testid="kt-matrix-hint">
        {view.hint}
      </p>
    ) : null}
    {view.error !== '' ? (
      <p
        class="console-error"
        role="alert"
        tabIndex={-1}
        data-testid="kt-matrix-error"
        ref={(node) => node?.focus()}
      >
        {view.error}
      </p>
    ) : null}
    {view.pending ? (
      <RevokeConfirm pending={view.pending} onConfirm={view.onConfirm} onCancel={view.onCancel} />
    ) : null}
    <div class="gov-matrix-scroll">
      {view.lens === 'role' ? <RoleTable view={view} /> : <PermissionTable view={view} />}
    </div>
    <p class="console-hint">
      勾选即分配角色，取消勾选即撤销角色（撤销需确认）；职责冲突由服务器校验。
    </p>
  </section>
);
