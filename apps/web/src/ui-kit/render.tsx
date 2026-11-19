import { render } from 'preact';
import { signal } from '@preact/signals';
import {
  ActionBar,
  DataTable,
  DetailDrawer,
  EmptyState,
  FormSection,
  PageHeader,
  StatusBadge,
  TreeSelect,
  type DataTableColumn,
  type FormSectionField,
  type TreeSelectNode,
} from '@kingturf/ui';
import '@kingturf/ui/tokens.css';

type DemoRow = Readonly<{ id: string; user: string; org: string; quota: number; state: string }>;

const demoRows: readonly DemoRow[] = [
  { id: 'u-002', user: '王小明', org: '国际销售组', quota: 40, state: 'active' },
  { id: 'u-001', user: '陈建国', org: '运营部', quota: 25, state: 'active' },
  { id: 'u-003', user: '林淑芬', org: '供应链组', quota: 10, state: 'disabled' },
];

const demoColumns: readonly DataTableColumn<DemoRow>[] = [
  { key: 'user', header: '用户', sortable: true, field: (row) => row.user },
  { key: 'org', header: '所属组织', field: (row) => row.org },
  { key: 'quota', header: '配额', sortable: true, field: (row) => row.quota },
  {
    key: 'state',
    header: '状态',
    field: (row) => row.state,
    render: (row) => (
      <StatusBadge tone={row.state === 'active' ? 'success' : 'neutral'}>
        {row.state === 'active' ? '在職' : '停用'}
      </StatusBadge>
    ),
  },
];

const orgTree: readonly TreeSelectNode[] = [
  {
    id: 'hq',
    label: '金特夫总部',
    children: [
      { id: 'sales', label: '销售部', children: [{ id: 'sales-intl', label: '国际销售组' }] },
      { id: 'ops', label: '运营部', children: [] },
    ],
  },
];

const formFields: readonly FormSectionField[] = [
  { name: 'displayName', label: '姓名', required: true, maxLength: 40, hint: '演示必填约束' },
  { name: 'loginEmail', label: '登录邮箱', type: 'email', required: true },
  { name: 'quota', label: '配额', type: 'number', min: 1, max: 100 },
];

const BadgeRow = () => (
  <div class="ui-kit-row">
    <StatusBadge tone="success">在職</StatusBadge>
    <StatusBadge tone="info">草稿</StatusBadge>
    <StatusBadge tone="warning">待复核</StatusBadge>
    <StatusBadge tone="danger">已停用</StatusBadge>
    <StatusBadge>未标记</StatusBadge>
  </div>
);

// 演示页单例状态提升到模块级：组件内新建 signal 会随重渲染重建并丢失订阅。
const drawerOpen = signal(false);

const DrawerDemo = () => {
  const OpenButton = () => (
    <button
      type="button"
      class="secondary"
      onClick={() => {
        drawerOpen.value = true;
      }}
    >
      打开详情抽屉
    </button>
  );
  return (
    <div class="ui-kit-row">
      <OpenButton />
      {drawerOpen.value ? (
        <DetailDrawer
          title="用户详情（演示）"
          onClose={() => {
            drawerOpen.value = false;
          }}
          footer={
            <button type="button" class="primary">
              保存授权（演示）
            </button>
          }
        >
          <p>抽屉聚合 profile / 角色 / 授权的演示占位（U2 身份页将按此范式实装）。</p>
        </DetailDrawer>
      ) : null}
    </div>
  );
};

const selectedRows = signal(new Set<string>());

const TableDemo = () => {
  const Table = () => (
    <DataTable
      columns={demoColumns}
      rows={demoRows}
      rowId={(row) => row.id}
      caption="用户主列表（演示）"
      selection={{
        selected: selectedRows.value,
        onChange: (next) => {
          selectedRows.value = new Set(next);
        },
      }}
      bulkActions={
        <button type="button" class="secondary">
          批量停用（演示）
        </button>
      }
      pagination={{
        loadedCount: demoRows.length,
        hasMore: false,
        loading: false,
        onLoadMore: () => undefined,
      }}
    />
  );
  return <Table />;
};

const UiKitDemo = () => (
  <div class="ui-kit-demo">
    <PageHeader
      eyebrow="UI 基座（ADR-0014）"
      title="组件原语演示"
      description="U1 全部原语的视觉验收载体；仅持 authorization:read 可见。"
      actions={
        <button type="button" class="secondary" disabled>
          演示页无业务操作
        </button>
      }
    />
    <section class="ui-kit-section">
      <h2>StatusBadge</h2>
      <BadgeRow />
    </section>
    <section class="ui-kit-section">
      <h2>ActionBar</h2>
      <ActionBar label="批量操作（演示）" count={2}>
        <button type="button" class="secondary">
          批量停用
        </button>
        <button type="button" class="secondary">
          批量导出
        </button>
      </ActionBar>
    </section>
    <section class="ui-kit-section">
      <h2>TreeSelect（组织树）</h2>
      <TreeSelect label="所属组织" tree={orgTree} />
    </section>
    <section class="ui-kit-section">
      <h2>FormSection</h2>
      <FormSection
        title="开通身份（演示）"
        description="兼容既有表单校验语义：必填/长度/邮箱/数值区间与敏感词确认。"
        fields={formFields}
        submitLabel="开通"
        onSubmit={() => undefined}
      />
    </section>
    <section class="ui-kit-section">
      <h2>DataTable</h2>
      <TableDemo />
    </section>
    <section class="ui-kit-section">
      <h2>DetailDrawer</h2>
      <DrawerDemo />
    </section>
    <section class="ui-kit-section">
      <h2>EmptyState</h2>
      <EmptyState title="暂无数据（演示）" description="空态呈现载体。" />
    </section>
  </div>
);

export const mountUiKitDemo = (host: HTMLElement): void => {
  render(<UiKitDemo />, host);
};
