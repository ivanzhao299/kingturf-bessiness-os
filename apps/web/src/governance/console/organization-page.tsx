import { signal } from '@preact/signals';
import {
  ActionBar,
  DataTable,
  EmptyState,
  FormSection,
  StatusBadge,
  TreeSelect,
  type DataTableColumn,
  type FormSectionField,
} from '@kingturf/ui';
import { recordOf, textOf, type ConsolePorts } from './ports';

// UI-M2 组织与员工页：左树（organizations）右表（employees）；选中组织经
// GET /api/v1/employees?organization=<uuid> 服务端过滤（UI-M2 批 1 加性契约）。
// 行级/工具条操作保留 B1 员工流：新建（POST /api/v1/employees）与更新
//（PATCH 带 version 乐观锁，版本未知提示刷新——与 employee-actions 同语义）。
type Row = Readonly<Record<string, unknown>>;

type OrgNode = Readonly<{ id: string; label: string; children?: readonly OrgNode[] }>;

const buildTree = (rows: readonly Row[], parentId: string | null = null): readonly OrgNode[] =>
  rows
    .filter((row) => {
      const parent = row.parentId;
      return parentId === null
        ? parent === null || parent === undefined || parent === ''
        : parent === parentId;
    })
    .map((row) => ({
      id: String(row.id),
      label: textOf(row.name, textOf(row.code, '未命名组织')),
      children: buildTree(rows, String(row.id)),
    }));

export function OrganizationConsolePage(ports: ConsolePorts) {
  const organizations = ports.initialView('/api/v1/organizations').items.map(recordOf);
  const employees = signal(ports.initialView('/api/v1/employees'));
  const selectedOrg = signal<string | undefined>(undefined);
  const loadingMore = signal(false);
  const loadError = signal('');
  const action = signal<null | 'create' | 'update'>(null);
  const actionError = signal('');
  const updateTarget = signal<Row | null>(null);
  const tree = buildTree(organizations);
  const mayCreate = ports.permissions.has('employee:create');
  const mayUpdate = ports.permissions.has('employee:update');
  const orgHint = organizations.length
    ? undefined
    : '需要 organization:read 权限才能选择组织（请向权限管理员申请）';

  const fetchByOrg = (organization: string | undefined): void => {
    selectedOrg.value = organization;
    void ports
      .fetchPage('/api/v1/employees', organization ? { organization } : {})
      .then((fetched) => {
        employees.value = fetched;
        loadError.value = '';
      })
      .catch((error: unknown) => {
        loadError.value = error instanceof Error ? error.message : '员工清单加载失败';
      });
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

  const runEmployeeAction = (
    path: string,
    payload: Record<string, unknown>,
    method: 'POST' | 'PATCH',
  ): Promise<void> =>
    ports.submit(path, payload, method).then(() => {
      action.value = null;
      return ports
        .fetchPage(
          '/api/v1/employees',
          selectedOrg.value ? { organization: selectedOrg.value } : {},
        )
        .then((fetched) => {
          employees.value = fetched;
        });
    });

  const columns: readonly DataTableColumn<Row>[] = [
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
          {row.active === true ? '在職' : '停用'}
        </StatusBadge>
      ),
    },
    ...(mayUpdate
      ? [
          {
            key: 'actions',
            header: '操作',
            field: () => '更新',
            render: (row: Row) => (
              <button
                type="button"
                class="secondary compact"
                data-testid="kt-org-update"
                onClick={() => {
                  updateTarget.value = row;
                  action.value = 'update';
                  actionError.value = '';
                }}
              >
                更新
              </button>
            ),
          } as DataTableColumn<Row>,
        ]
      : []),
  ];

  const createFields: readonly FormSectionField[] = [
    {
      name: 'organizationId',
      label: '所属组织',
      type: 'select',
      required: true,
      ...(orgHint ? { hint: orgHint } : {}),
      options: organizations.map((org) => ({
        value: String(org.id),
        label: `${textOf(org.code)} · ${textOf(org.name)}`,
      })),
    },
    { name: 'employeeNumber', label: '员工编号', required: true },
    { name: 'displayName', label: '员工姓名', required: true },
    { name: 'email', label: '登录邮箱', type: 'email', required: true },
  ];

  const Page = () => {
    const rows = employees.value.items.map(recordOf);
    const target = updateTarget.value;
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

    return (
      <div class="console-page console-split" data-testid="kt-org-page">
        <aside class="console-split-tree" data-testid="kt-org-tree">
          <h3>组织架构</h3>
          <TreeSelect
            label="所属组织"
            tree={tree}
            {...(selectedOrg.value ? { value: selectedOrg.value } : {})}
            onSelect={(id) => {
              fetchByOrg(id);
            }}
          />
          <p class="console-hint">
            {selectedOrg.value === undefined
              ? '未选择组织时展示全部有权限的员工'
              : '右侧列表已按选中组织过滤'}
          </p>
        </aside>
        <div class="console-split-main">
          {mayCreate ? (
            <ActionBar label="员工操作">
              <button
                type="button"
                class="secondary"
                data-testid="kt-org-create"
                onClick={() => {
                  action.value = 'create';
                  actionError.value = '';
                }}
              >
                新建员工
              </button>
            </ActionBar>
          ) : null}
          {organizations.length === 0 ? (
            <EmptyState title="暂无组织" description="需要 organization:read 权限才能构建组织树" />
          ) : (
            <DataTable
              columns={columns}
              rows={rows}
              rowId={(row) => textOf(row.id, textOf(row.employeeNumber, 'row'))}
              caption={
                selectedOrg.value === undefined ? '员工清单（全部）' : '员工清单（按选中组织过滤）'
              }
              pagination={{
                loadedCount: rows.length,
                hasMore: employees.value.nextCursor !== null,
                loading: loadingMore.value,
                onLoadMore: loadMore,
              }}
              {...(loadError.value === '' ? {} : { error: loadError.value })}
              emptyTitle="该组织暂无员工"
              emptyDescription="调整组织筛选或先创建员工档案"
            />
          )}
          {action.value === 'create' ? (
            <div data-testid="kt-org-form-create">
              <FormSection
                title="新建员工"
                description="员工必须归属当前公司下的有效组织；账号和角色在后续授权步骤配置。"
                fields={createFields}
                submitLabel="创建员工"
                onSubmit={(values) =>
                  runEmployeeAction(
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
          {action.value === 'update' && target ? (
            <div data-testid="kt-org-form-update">
              <FormSection
                title={`更新员工 · ${textOf(target.employeeNumber, '')}`}
                description="更新显示名称或有效状态；字段权限和数据范围仍由服务器强制执行。"
                fields={updateFields}
                submitLabel="保存员工变更"
                onSubmit={(values) => {
                  const version = updateTarget.value?.version;
                  if (typeof version !== 'number') {
                    actionError.value = '记录版本未知，请刷新后重试';
                    return Promise.resolve();
                  }
                  return runEmployeeAction(
                    `/api/v1/employees/${String(updateTarget.value?.id)}`,
                    { displayName: values.displayName, active: values.active === 'true', version },
                    'PATCH',
                  );
                }}
              />
              {actionError.value !== '' ? (
                <p class="console-error" role="alert" data-testid="kt-org-form-error">
                  {actionError.value}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    );
  };
  return Page;
}
