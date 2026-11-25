import { signal } from '@preact/signals';
import {
  ActionBar,
  ConfirmDialog,
  DataTable,
  EmptyState,
  FormSection,
  StatusBadge,
  type DataTableColumn,
  type FormSectionField,
} from '@kingturf/ui';
import { failureMessage } from '../../shared/api-error-message';
import { ConsoleNotice } from '../../shared/console-notice';
import { FocusAnchor } from '../../shared/focus-anchor';
import { recordOf, textOf, type ConsolePorts } from './ports';
import { OrgChart } from './org-chart';
import {
  buildOrgTree,
  headcountOf,
  orgHeadcountLoading,
  type OrgHeadcount,
  type OrgNode,
} from './org-chart-model';
import { loadPagedSource } from './paged-source';

// UI-M2 组织与员工页：左树（organizations）右表（employees）；选中组织经
// GET /api/v1/employees?organization=<uuid> 服务端过滤（UI-M2 批 1 加性契约）。
// 行级/工具条操作保留 B1 员工流：新建（POST /api/v1/employees）与更新
//（PATCH 带 version 乐观锁，版本未知提示刷新——与 employee-actions 同语义）。
// GOV-UX ②：左侧 TreeSelect 升级为常显组织架构图（展开/收起 + 直属/含下级人数徽章）。
type Row = Readonly<Record<string, unknown>>;

// UI-M2（G5 拆分）：列定义与渲染视图为纯展示职责，独立于状态工厂。
type OrgState = Readonly<{
  organizations: readonly Row[];
  tree: readonly OrgNode[];
  selectedOrg: string | undefined;
  employees: { readonly items: readonly unknown[]; readonly nextCursor: string | null };
  loadingMore: boolean;
  loadError: string;
  action: 'create' | 'update' | null;
  actionError: string;
  notice: string;
  disableConfirm: Readonly<{ settle: (accepted: boolean) => void }> | null;
  updateTarget: Row | null;
  mayCreate: boolean;
  mayUpdate: boolean;
  orgHint: string | undefined;
  headcount: OrgHeadcount;
  collapsed: ReadonlySet<string>;
  collapseNode: (id: string, collapsed: boolean) => void;
  selectOrg: (id: string | undefined) => void;
  openCreate: () => void;
  openUpdate: (row: Row) => void;
  loadMore: () => void;
  createSubmit: (
    path: string,
    payload: Record<string, unknown>,
    method: 'POST' | 'PATCH',
  ) => Promise<void>;
  updateSubmit: (
    path: string,
    payload: Record<string, unknown>,
    method: 'POST' | 'PATCH',
  ) => Promise<void>;
}>;

const orgColumns = (state: OrgState): readonly DataTableColumn<Row>[] => [
  {
    key: 'employeeNumber',
    header: '员工编号',
    sortable: true,
    field: (row) => textOf(row.employeeNumber),
  },
  { key: 'displayName', header: '姓名', sortable: true, field: (row) => textOf(row.displayName) },
  { key: 'email', header: '邮箱', field: (row) => textOf(row.email, '—') },
  {
    key: 'active',
    header: '状态',
    field: (row) => (row.active === true ? 'active' : 'inactive'),
    render: (row) => (
      <StatusBadge tone={row.active === true ? 'success' : 'neutral'}>
        {row.active === true ? '在职' : '停用'}
      </StatusBadge>
    ),
  },
  ...(state.mayUpdate
    ? [
        {
          key: 'actions',
          header: '操作',
          field: () => '更新',
          render: (row: Row) => (
            <>
              <button
                type="button"
                class="secondary compact"
                data-testid="kt-org-update"
                onClick={() => {
                  state.openUpdate(row);
                }}
              >
                更新
              </button>
              <FocusAnchor
                token={String(state.action === 'update' && state.updateTarget?.id === row.id)}
              />
            </>
          ),
        } as DataTableColumn<Row>,
      ]
    : []),
];

const OrgView = (state: OrgState) => {
  const target = state.updateTarget;
  const createFields: readonly FormSectionField[] = [
    {
      name: 'organizationId',
      label: '所属组织',
      type: 'select',
      required: true,
      ...(state.orgHint ? { hint: state.orgHint } : {}),
      options: state.organizations.map((org) => ({
        value: String(org.id),
        label: `${textOf(org.code)} · ${textOf(org.name)}`,
      })),
    },
    { name: 'employeeNumber', label: '员工编号', required: true },
    { name: 'displayName', label: '员工姓名', required: true },
    { name: 'email', label: '登录邮箱', type: 'email', required: true },
  ];
  const updateFields: readonly FormSectionField[] = [
    {
      name: 'displayName',
      label: '显示名称',
      required: true,
      ...(target && typeof target.displayName === 'string' ? { value: target.displayName } : {}),
    },
    {
      name: 'active',
      label: '账号状态',
      type: 'select',
      required: true,
      options: [
        { value: 'true', label: '有效' },
        { value: 'false', label: '停用' },
      ],
    },
  ];
  const rows = state.employees.items.map(recordOf);
  return (
    <div class="console-page console-split" data-testid="kt-org-page">
      <aside class="console-split-tree" data-testid="kt-org-tree">
        <h3>组织架构</h3>
        <OrgChart
          tree={state.tree}
          counts={state.headcount.byOrg}
          total={state.headcount.total}
          selected={state.selectedOrg}
          collapsed={state.collapsed}
          onCollapse={state.collapseNode}
          onSelect={state.selectOrg}
        />
        <p class="console-hint" data-testid="kt-org-count-hint">
          {state.headcount.hint}
        </p>
        <p class="console-hint">
          {state.selectedOrg === undefined
            ? '未选择组织时展示全部有权限的员工'
            : '右侧列表已按选中组织过滤'}
        </p>
      </aside>
      <div class="console-split-main">
        <ConsoleNotice message={state.notice} />
        {state.mayCreate ? (
          <ActionBar label="员工操作">
            <button
              type="button"
              class="secondary"
              data-testid="kt-org-create"
              onClick={state.openCreate}
            >
              新建员工
            </button>
            <FocusAnchor token={String(state.action === 'create')} />
          </ActionBar>
        ) : null}
        {state.organizations.length === 0 ? (
          <EmptyState title="暂无组织" description="需要 organization:read 权限才能构建组织树" />
        ) : (
          <DataTable
            columns={orgColumns(state)}
            rows={rows}
            rowId={(row) => textOf(row.id, textOf(row.employeeNumber, 'row'))}
            caption={
              state.selectedOrg === undefined ? '员工清单（全部）' : '员工清单（按选中组织过滤）'
            }
            pagination={{
              loadedCount: rows.length,
              hasMore: state.employees.nextCursor !== null,
              loading: state.loadingMore,
              onLoadMore: state.loadMore,
            }}
            {...(state.loadError === '' ? {} : { error: state.loadError })}
            emptyTitle="该组织暂无员工"
            emptyDescription="调整组织筛选或先创建员工档案"
          />
        )}
        {state.action === 'create' ? (
          <div data-testid="kt-org-form-create">
            <FormSection
              title="新建员工"
              description="员工必须归属当前公司下的有效组织；账号和角色在后续授权步骤配置。"
              fields={createFields}
              submitLabel="创建员工"
              error={state.actionError}
              onSubmit={(values) =>
                state.createSubmit(
                  '/api/v1/employees',
                  {
                    organizationId: values.organizationId,
                    employeeNumber: values.employeeNumber,
                    displayName: values.displayName,
                    email: values.email,
                  },
                  'POST',
                )
              }
            />
          </div>
        ) : null}
        {state.action === 'update' && target ? (
          <div data-testid="kt-org-form-update">
            <FormSection
              title={`更新员工 · ${textOf(target.employeeNumber, '')}`}
              description="更新显示名称或有效状态；字段权限和数据范围仍由服务器强制执行。"
              fields={updateFields}
              submitLabel="保存员工变更"
              error={state.actionError}
              onSubmit={(values) =>
                state.updateSubmit(
                  `/api/v1/employees/${String(target.id)}`,
                  {
                    displayName: values.displayName,
                    active: values.active === 'true',
                  },
                  'PATCH',
                )
              }
            />
          </div>
        ) : null}
        {state.disableConfirm ? (
          <ConfirmDialog
            title={`停用员工 · ${textOf(target?.displayName)}`}
            message="员工状态将变为停用。"
            confirmLabel="确认停用"
            destructive
            onCancel={() => state.disableConfirm?.settle(false)}
            onConfirm={() => state.disableConfirm?.settle(true)}
          />
        ) : null}
      </div>
    </div>
  );
};

export function OrganizationConsolePage(ports: ConsolePorts) {
  const organizations = ports.initialView('/api/v1/organizations').items.map(recordOf);
  const employees = signal(ports.initialView('/api/v1/employees'));
  const selectedOrg = signal<string | undefined>(undefined);
  const loadingMore = signal(false);
  const loadError = signal('');
  const action = signal<null | 'create' | 'update'>(null);
  const actionError = signal('');
  const notice = signal('');
  const disableConfirm = signal<OrgState['disableConfirm']>(null);
  const updateTarget = signal<Row | null>(null);
  const collapsed = signal<ReadonlySet<string>>(new Set());
  const headcount = signal<OrgHeadcount>(orgHeadcountLoading());
  const tree = buildOrgTree(organizations);
  const mayCreate = ports.permissions.has('employee:create');
  const mayUpdate = ports.permissions.has('employee:update');
  const orgHint = organizations.length
    ? undefined
    : '需要 organization:read 权限才能选择组织（请向权限管理员申请）';

  // GOV-UX ②：人数徽章按 cursor 分页读尽可见员工后统计（首屏已拉的第一页直接复用）。
  let countRequest = 0;
  const refreshHeadcount = async (firstPage: typeof employees.value): Promise<void> => {
    const request = ++countRequest;
    const source = await loadPagedSource(ports.fetchPage, '/api/v1/employees', firstPage);
    if (request === countRequest) headcount.value = headcountOf(tree, source);
  };
  void refreshHeadcount(employees.value);
  const collapseNode = (id: string, next: boolean): void => {
    const current = new Set(collapsed.value);
    if (next) current.add(id);
    else current.delete(id);
    collapsed.value = current;
  };

  let listRequest = 0;
  const fetchByOrg = async (organization: string | undefined): Promise<void> => {
    selectedOrg.value = organization;
    const request = ++listRequest;
    try {
      const fetched = await ports.fetchPage(
        '/api/v1/employees',
        organization ? { organization } : {},
      );
      if (request !== listRequest) return;
      employees.value = fetched;
      loadError.value = '';
    } catch (error) {
      if (request === listRequest) loadError.value = failureMessage(error, '员工清单加载失败');
    }
  };

  const loadMore = (): void => {
    const cursor = employees.value.nextCursor;
    if (cursor === null || loadingMore.value) return;
    loadingMore.value = true;
    void ports
      .fetchPage('/api/v1/employees', {
        ...(selectedOrg.value ? { organization: selectedOrg.value } : {}),
        cursor,
      })
      .then((fetched) => {
        employees.value = {
          items: [...employees.value.items, ...fetched.items],
          nextCursor: fetched.nextCursor,
        };
      })
      .finally(() => {
        loadingMore.value = false;
      });
  };

  const runEmployeeAction = async (
    path: string,
    payload: Record<string, unknown>,
    method: 'POST' | 'PATCH',
  ): Promise<void> => {
    const current = action.value;
    const target = updateTarget.value;
    actionError.value = '';
    try {
      await ports.submit(path, payload, method);
    } catch (error) {
      if (action.value === current && updateTarget.value === target)
        actionError.value = failureMessage(error, '员工资料保存失败');
      return;
    }
    if (action.value === current && updateTarget.value === target) action.value = null;
    const name = textOf(payload.displayName);
    notice.value = method === 'POST' ? `已创建员工「${name}」` : `已更新员工「${name}」`;
    const organization = selectedOrg.value;
    await fetchByOrg(organization);
    try {
      const firstPage =
        organization === undefined && loadError.value === '' && selectedOrg.value === undefined
          ? employees.value
          : await ports.fetchPage('/api/v1/employees');
      await refreshHeadcount(firstPage);
    } catch (error) {
      loadError.value = failureMessage(error, '员工人数刷新失败');
    }
  };

  const updateSubmit = async (
    path: string,
    payload: Record<string, unknown>,
    method: 'POST' | 'PATCH',
  ): Promise<void> => {
    const version = updateTarget.value?.version;
    if (typeof version !== 'number') {
      actionError.value = '记录版本未知，请刷新后重试';
      return;
    }
    if (payload.active === false && updateTarget.value?.active !== false) {
      const accepted = await new Promise<boolean>((settle) => {
        disableConfirm.value = { settle };
      });
      disableConfirm.value = null;
      if (!accepted) return;
    }
    await runEmployeeAction(path, { ...payload, version }, method);
  };

  const Page = () =>
    OrgView({
      organizations,
      tree,
      selectedOrg: selectedOrg.value,
      employees: employees.value,
      loadingMore: loadingMore.value,
      loadError: loadError.value,
      action: action.value,
      actionError: actionError.value,
      notice: notice.value,
      disableConfirm: disableConfirm.value,
      updateTarget: updateTarget.value,
      mayCreate,
      mayUpdate,
      orgHint,
      headcount: headcount.value,
      collapsed: collapsed.value,
      collapseNode,
      selectOrg: (id) => {
        void fetchByOrg(id);
      },
      openCreate: () => {
        updateTarget.value = null;
        action.value = 'create';
        actionError.value = '';
        notice.value = '';
      },
      openUpdate: (row) => {
        updateTarget.value = row;
        action.value = 'update';
        actionError.value = '';
        notice.value = '';
      },
      loadMore,
      createSubmit: (path, payload, method) => runEmployeeAction(path, payload, method),
      updateSubmit,
    });
  return Page;
}
