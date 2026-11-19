import { signal } from '@preact/signals';
import {
  ActionBar,
  DataTable,
  DetailDrawer,
  EmptyState,
  FormSection,
  StatusBadge,
  type DataTableColumn,
  type FormSectionField,
} from '@kingturf/ui';
import {
  mayManageAssignments,
  mayManageIdentity,
  recordOf,
  textOf,
  type ConsolePorts,
} from './ports';

// UI-M2 身份与授权页：主列表（用户访问档案）+ 行级「查看」开用户 360 抽屉；
// 抽屉内聚合身份状态/角色/能力/数据范围/活跃会话，并提供启停、配置账号、
// 分配/撤销角色四类行级操作（端点与 identity-*-buttons/identity-state 既有流一致）。
// 授权角色度量：列表点行（查看）→ 抽屉内提交 = 2 步。
type ProfileRow = Readonly<Record<string, unknown>>;

export function IdentityConsolePage(ports: ConsolePorts) {
  const initialProfiles = ports.initialView('/api/v1/user-access-profiles');
  const rolesLoaded = ports.loaded('/api/v1/roles');
  const roles = ports.initialView('/api/v1/roles').items.map(recordOf);
  const profiles = signal({ items: initialProfiles.items, nextCursor: initialProfiles.nextCursor });
  const loadingMore = signal(false);
  const loadError = signal('');
  const selectedId = signal<string | null>(null);
  const activeForm = signal<null | 'state' | 'provision' | 'assign' | 'revoke'>(null);
  const rolesHint = rolesLoaded
    ? undefined
    : '需要 role:read 权限才能选择角色（请向权限管理员申请）';

  const identityManage = mayManageIdentity(ports.permissions);
  const assignmentManage = mayManageAssignments(ports.permissions);

  const rows = () => profiles.value.items.map(recordOf);
  const selected = () => rows().find((row) => row.employeeId === selectedId.value) ?? null;

  const refresh = async (): Promise<void> => {
    try {
      const [freshProfiles, freshRoles] = await Promise.all([
        ports.fetchPage('/api/v1/user-access-profiles'),
        ports.fetchPage('/api/v1/roles'),
      ]);
      profiles.value = { items: freshProfiles.items, nextCursor: freshProfiles.nextCursor };
      loadError.value = '';
      for (const item of freshRoles.items) {
        const record = recordOf(item);
        if (typeof record.id === 'string' && !roles.some((role) => role.id === record.id))
          roles.push(record);
      }
    } catch (error) {
      loadError.value = error instanceof Error ? error.message : '用户访问档案加载失败';
    }
  };

  const loadMore = (): void => {
    const cursor = profiles.value.nextCursor;
    if (cursor === null || loadingMore.value) return;
    loadingMore.value = true;
    void ports
      .fetchPage('/api/v1/user-access-profiles', { cursor })
      .then((fetched) => {
        profiles.value = {
          items: [...profiles.value.items, ...fetched.items],
          nextCursor: fetched.nextCursor,
        };
      })
      .catch((error: unknown) => {
        loadError.value = error instanceof Error ? error.message : '继续加载失败';
      })
      .finally(() => {
        loadingMore.value = false;
      });
  };

  const runAction = (
    path: string,
    payload: Record<string, unknown>,
    method: 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  ): Promise<void> =>
    ports.submit(path, payload, method).then(() => {
      activeForm.value = null;
      return refresh();
    });

  const columns: readonly DataTableColumn<ProfileRow>[] = [
    {
      key: 'employee',
      header: '员工',
      sortable: true,
      field: (row) => `${textOf(row.displayName)}（${textOf(row.employeeNumber)}）`,
    },
    { key: 'login', header: '登录名', field: (row) => textOf(row.loginName, '—') },
    {
      key: 'state',
      header: '状态',
      field: (row) =>
        row.identityActive === true ? 'active' : row.identityId ? 'disabled' : 'none',
      render: (row) =>
        row.identityId ? (
          <StatusBadge tone={row.identityActive === true ? 'success' : 'neutral'}>
            {row.identityActive === true ? '在職' : '已停用'}
          </StatusBadge>
        ) : (
          <StatusBadge tone="info">未开通</StatusBadge>
        ),
    },
    {
      key: 'roles',
      header: '角色数',
      sortable: true,
      field: (row) => (Array.isArray(row.roles) ? row.roles.length : 0),
    },
    { key: 'sessions', header: '活跃会话', field: (row) => textOf(row.activeSessionCount, '0') },
    {
      key: 'actions',
      header: '操作',
      field: () => '查看',
      render: (row) => (
        <button
          type="button"
          class="secondary compact"
          data-testid="kt-identity-open"
          onClick={() => {
            selectedId.value = typeof row.employeeId === 'string' ? row.employeeId : null;
            activeForm.value = null;
          }}
        >
          查看
        </button>
      ),
    },
  ];

  const Page = () => {
    const current = selected();
    return (
      <div class="console-page" data-testid="kt-identity-page">
        <DataTable
          columns={columns}
          rows={rows()}
          rowId={(row) => textOf(row.employeeId, textOf(row.employeeNumber, 'row'))}
          caption="用户主列表（按员工聚合身份、角色与授权）"
          pagination={{
            loadedCount: profiles.value.items.length,
            hasMore: profiles.value.nextCursor !== null,
            loading: loadingMore.value,
            onLoadMore: loadMore,
          }}
          {...(loadError.value === '' ? {} : { error: loadError.value })}
          emptyTitle="暂无用户档案"
          emptyDescription="开通身份后用户会出现在这里"
        />
        {current ? (
          <DetailDrawer
            title={`用户 360 · ${textOf(current.displayName, textOf(current.employeeNumber, ''))}`}
            onClose={() => {
              selectedId.value = null;
            }}
            footer={
              <ActionBar label="用户行级操作">
                {identityManage ? (
                  <button
                    type="button"
                    class="secondary"
                    data-testid="kt-identity-action-state"
                    onClick={() => {
                      activeForm.value = 'state';
                    }}
                  >
                    账号启停与下线
                  </button>
                ) : null}
                {identityManage ? (
                  <button
                    type="button"
                    class="secondary"
                    data-testid="kt-identity-action-provision"
                    onClick={() => {
                      activeForm.value = 'provision';
                    }}
                  >
                    配置登录账号
                  </button>
                ) : null}
                {assignmentManage ? (
                  <button
                    type="button"
                    class="secondary"
                    data-testid="kt-identity-action-assign"
                    onClick={() => {
                      activeForm.value = 'assign';
                    }}
                  >
                    分配角色
                  </button>
                ) : null}
                {assignmentManage ? (
                  <button
                    type="button"
                    class="secondary"
                    data-testid="kt-identity-action-revoke"
                    onClick={() => {
                      activeForm.value = 'revoke';
                    }}
                  >
                    撤销角色
                  </button>
                ) : null}
              </ActionBar>
            }
          >
            <IdentitySummary row={current} />
            {activeForm.value === 'state' && typeof current.identityId === 'string' ? (
              <IdentityStateForm row={current} onSubmit={runAction} />
            ) : null}
            {activeForm.value === 'provision' ? (
              <ProvisionForm row={current} onSubmit={runAction} />
            ) : null}
            {activeForm.value === 'assign' ? (
              <AssignRoleForm row={current} roles={roles} hint={rolesHint} onSubmit={runAction} />
            ) : null}
            {activeForm.value === 'revoke' ? (
              <RevokeRoleForm row={current} roles={current.roles} onSubmit={runAction} />
            ) : null}
            {!activeForm.value && Array.isArray(current.roles) && current.roles.length === 0 ? (
              <EmptyState title="该用户暂无角色" description="在抽屉操作中分配角色后即可获得能力" />
            ) : null}
          </DetailDrawer>
        ) : null}
      </div>
    );
  };
  return Page;
}

const IdentitySummary = ({ row }: Readonly<{ row: ProfileRow }>) => (
  <div class="console-summary" data-testid="kt-identity-summary">
    <p>
      <span class="console-label">登录名</span> {textOf(row.loginName, '—')}
      <span class="console-label">员工状态</span>
      <StatusBadge tone={row.employeeActive === true ? 'success' : 'neutral'}>
        {row.employeeActive === true ? '在職' : '离职'}
      </StatusBadge>
    </p>
    <p>
      <span class="console-label">活跃会话</span> {textOf(row.activeSessionCount, '0')}
      <span class="console-label">能力</span>
      {Array.isArray(row.capabilities) ? String(row.capabilities.length) : '0'} 项
      <span class="console-label">数据范围</span>
      {Array.isArray(row.directScopes) ? String(row.directScopes.length) : '0'} 项
    </p>
    <div class="console-chips" data-testid="kt-identity-roles">
      {(Array.isArray(row.roles) ? row.roles : []).map((role) => {
        const record = recordOf(role);
        return (
          <span class="console-chip" data-testid="kt-identity-role-chip">
            <StatusBadge tone="info">{textOf(record.code)}</StatusBadge> {textOf(record.name)}
          </span>
        );
      })}
    </div>
  </div>
);

type ActionSubmit = (
  path: string,
  payload: Record<string, unknown>,
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE',
) => Promise<void>;

const IdentityStateForm = ({
  row,
  onSubmit,
}: Readonly<{ row: ProfileRow; onSubmit: ActionSubmit }>) => {
  const fields: readonly FormSectionField[] = [
    {
      name: 'active',
      label: '账号状态',
      type: 'select',
      required: true,
      options: [
        { value: 'true', label: '启用' },
        { value: 'false', label: '停用并强制下线' },
      ],
    },
    {
      name: 'revokeSessions',
      label: '强制撤销活动会话',
      type: 'select',
      required: true,
      options: [
        { value: 'true', label: '是' },
        { value: 'false', label: '否' },
      ],
    },
  ];
  return (
    <div data-testid="kt-identity-form-state">
      <FormSection
        title="账号启停与会话管理"
        description="停用账号会立即撤销全部活动会话；启用账号不会恢复旧会话。"
        fields={fields}
        submitLabel="停用或启用账号"
        onSubmit={(values) =>
          onSubmit(
            `/api/v1/identities/${String(row.identityId)}/state`,
            {
              active: values.active === 'true',
              revokeSessions: values.revokeSessions === 'true',
            },
            'PATCH',
          )
        }
      />
    </div>
  );
};

const ProvisionForm = ({
  row,
  onSubmit,
}: Readonly<{ row: ProfileRow; onSubmit: ActionSubmit }>) => {
  const fields: readonly FormSectionField[] = [
    { name: 'login', label: '登录名', required: true, minLength: 3, maxLength: 120 },
    {
      name: 'password',
      label: '临时密码',
      type: 'password',
      required: true,
      minLength: 12,
      hint: '至少 12 位；账号首次登录将被强制修改密码（M6 语义）。',
    },
  ];
  return (
    <div data-testid="kt-identity-form-provision">
      <FormSection
        title="配置登录账号"
        description="登录名必须唯一；密码只在本次提交中发送，不会在页面回显。"
        fields={fields}
        submitLabel="开通登录账号"
        onSubmit={(values) =>
          onSubmit(
            `/api/v1/employees/${String(row.employeeId)}/identity`,
            { login: values.login, password: values.password },
            'PUT',
          )
        }
      />
    </div>
  );
};

const AssignRoleForm = ({
  row,
  roles,
  hint,
  onSubmit,
}: Readonly<{
  row: ProfileRow;
  roles: readonly ProfileRow[];
  hint: string | undefined;
  onSubmit: ActionSubmit;
}>) => {
  const fields: readonly FormSectionField[] = [
    {
      name: 'roleId',
      label: '角色',
      type: 'select',
      required: true,
      ...(hint ? { hint } : {}),
      options: roles.map((role) => ({
        value: String(role.id),
        label: `${textOf(role.code)} · ${textOf(role.name)}`,
      })),
    },
  ];
  return (
    <div data-testid="kt-identity-form-assign">
      <FormSection
        title="分配角色"
        description="分配后立即生效；职责冲突（SoD）由服务端原子校验拒绝。"
        fields={fields}
        submitLabel="分配角色"
        onSubmit={(values) =>
          onSubmit(
            '/api/v1/assignments',
            { employeeId: row.employeeId, roleId: values.roleId },
            'POST',
          )
        }
      />
    </div>
  );
};

const RevokeRoleForm = ({
  row,
  roles,
  onSubmit,
}: Readonly<{ row: ProfileRow; roles: unknown; onSubmit: ActionSubmit }>) => {
  const current = (Array.isArray(roles) ? roles : []).map(recordOf);
  const fields: readonly FormSectionField[] = [
    {
      name: 'roleId',
      label: '角色',
      type: 'select',
      required: true,
      ...(current.length === 0 ? { hint: '该用户当前没有可撤销的角色' } : {}),
      options: current.map((role) => ({
        value: String(role.id),
        label: `${textOf(role.code)} · ${textOf(role.name)}`,
      })),
    },
  ];
  return (
    <div data-testid="kt-identity-form-revoke">
      <FormSection
        title="撤销角色"
        description="撤销后员工会立即失去该角色能力；当前会话仍由服务器逐次校验有效状态。"
        fields={fields}
        submitLabel="撤销角色"
        onSubmit={(values) =>
          onSubmit(
            '/api/v1/assignments',
            { employeeId: row.employeeId, roleId: values.roleId },
            'DELETE',
          )
        }
      />
    </div>
  );
};
