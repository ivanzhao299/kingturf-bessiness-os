// U3-MFG-3（ADR-0014 分域重写）：工艺路线管理控制台——原 vanilla「工艺路线与工序」
// 卡片与「创建标准工艺路线」表单能力面等价迁移 + UX 升级（治理模块同款主从布局：左
// 产品类型树（成品/半成品，productTypeOf 预聚）/右主表；行级查看与草稿发布；服务端
// 筛选分页；详情抽屉顺序步骤视图）。默认视图沿用路由加载的全量快照（legacy 列表
// 语义）；状态/关键字/产品类型任一生效时切换为服务端分页（(code,version) keyset）。
// e2e 契约：路线编码独占文本元素（kt-routing-code）；产品 SKU 并入复合文本；状态
// 徽章 `已发布 · 第 N 版`（种子 1 条 → 与物料 4 + BOM 1 合计恰 6 处）。
import { signal } from '@preact/signals';
import { DataTable, PageHeader, StatusBadge, type DataTableColumn } from '@kingturf/ui';
import { RoutingCreateDrawer } from './routing-create';
import { RoutingDetailDrawer, confirmPublish } from './routing-detail';
import { ConsoleConfirmDialog, createConfirm } from './console-confirm';
import { FocusAnchor } from './focus-anchor';
import type { RoutingConsolePorts, RoutingRow } from './routing-ports';
import {
  ALL_PRODUCTS,
  PRODUCT_LABELS,
  STATUS_FILTERS,
  STATUS_LABELS,
  statusTone,
  type RoutingProductFilter,
  type RoutingStatusFilter,
  type RoutingViewState,
} from './routing-state';
import {
  createRoutingActions,
  createRoutingMutations,
  type RoutingBundle,
} from './routing-console-actions';

const createBundle = (ports: RoutingConsolePorts): RoutingBundle => ({
  snapshot: signal<readonly RoutingRow[]>([...ports.initialRoutings]),
  routings: signal<readonly RoutingRow[]>([...ports.initialRoutings]),
  nextCursor: signal<string | null>(null),
  productFilter: signal<RoutingProductFilter>(ALL_PRODUCTS),
  statusFilter: signal<RoutingStatusFilter>('ALL'),
  search: signal(''),
  appliedQuery: signal(''),
  loading: signal(false),
  loadingMore: signal(false),
  loadError: signal(''),
  actionError: signal(''),
  submitError: signal(''),
  selected: signal<RoutingRow | null>(null),
  detail: signal<RoutingRow | null>(null),
  detailLoading: signal(false),
  activeForm: signal<'create' | null>(null),
  operationRows: signal<readonly string[]>(['o1']),
  confirm: createConfirm(),
});

const text = (
  state: RoutingViewState,
  row: RoutingRow,
  camel: string,
  snake: string,
  fallback = '',
): string => state.ports.recordText(row, camel, snake, fallback);

// TD-WF-010：「产品」列此前直接显示 productItemId——一个 UUID。现在经宿主解析成「SKU · 名称」；
// 解析不到（物料清单读不到、或这个产品不在清单里）才退回显示 id。「产品」前缀保留：产品 SKU 并入
// 复合文本、不独占成元素（e2e 契约）。
const productText = (state: RoutingViewState, row: RoutingRow): string => {
  const id = text(state, row, 'productItemId', 'product_item_id', '—');
  const label = state.ports.productLabelOf(id);
  return `产品 ${label !== '' ? label : id}`;
};

const columns = (state: RoutingViewState): readonly DataTableColumn<RoutingRow>[] => [
  {
    key: 'code',
    header: '工艺路线',
    sortable: true,
    field: (row) => text(state, row, 'code', 'code'),
    render: (row) => (
      <span class="mfg-item-cell">
        <strong data-testid="kt-routing-code">{text(state, row, 'code', 'code', '—')}</strong>
        <small class="routing-muted">{text(state, row, 'name', 'name')}</small>
      </span>
    ),
  },
  {
    key: 'product',
    header: '产品',
    // 产品 SKU 并入复合文本（不与物料控制台的 SKU 独占元素撞 exact 定位）。排序按显示的文字。
    field: (row) => productText(state, row),
    render: (row) => <span class="routing-muted">{productText(state, row)}</span>,
  },
  {
    key: 'operations',
    header: '工序数',
    sortable: true,
    field: (row) => (Array.isArray(row.operations) ? (row.operations as unknown[]).length : 0),
    render: (row) =>
      `${String(Array.isArray(row.operations) ? (row.operations as unknown[]).length : 0)} 步`,
  },
  {
    key: 'status',
    header: '版本状态',
    sortable: true,
    field: (row) => text(state, row, 'status', 'status'),
    render: (row) => {
      const status = text(state, row, 'status', 'status');
      const label = STATUS_LABELS[status] ?? state.ports.businessStateLabel(status);
      return (
        <StatusBadge tone={statusTone(status)}>
          {`${label} · 第 ${text(state, row, 'version', 'version', '1')} 版`}
        </StatusBadge>
      );
    },
  },
  {
    key: 'effectiveAt',
    header: '生效日期',
    sortable: true,
    field: (row) => text(state, row, 'effectiveAt', 'effective_at'),
    render: (row) => text(state, row, 'effectiveAt', 'effective_at', '—').slice(0, 10),
  },
  {
    key: 'actions',
    header: '操作',
    field: () => '查看',
    render: (row) => (
      <span class="mfg-row-actions">
        <button
          type="button"
          class="secondary compact"
          data-testid="kt-routing-open"
          onClick={() => {
            state.open(row);
          }}
        >
          查看
        </button>
        {state.mayManage && text(state, row, 'status', 'status') === 'DRAFT' ? (
          <button
            type="button"
            class="secondary compact"
            data-testid="kt-routing-publish"
            disabled={state.loading}
            onClick={() => {
              confirmPublish(state, row);
            }}
          >
            发布版本
          </button>
        ) : null}
        {/* TD-WF-014④：行内发布后「发布版本」按钮消失，焦点回到本行的「查看」。 */}
        <FocusAnchor token={text(state, row, 'status', 'status')} />
      </span>
    ),
  },
];

// 左侧产品类型树：全部 + 成品/半成品（计数按路线根（编码）去重；类型归属经宿主
// 注入的 productTypeOf 解析，未知类型的路线仅计入全部）。
const ProductTree = ({ state }: Readonly<{ state: RoutingViewState }>) => {
  const countByType = (filter: RoutingProductFilter): number => {
    const codes = new Set<string>();
    for (const row of state.snapshot) {
      const code = text(state, row, 'code', 'code');
      if (code === '') continue;
      if (
        filter === ALL_PRODUCTS ||
        state.ports.productTypeOf(text(state, row, 'productItemId', 'product_item_id')) === filter
      )
        codes.add(code);
    }
    return codes.size;
  };
  const entry = (value: RoutingProductFilter, label: string, count: number) => (
    <li role="none">
      <button
        type="button"
        role="treeitem"
        aria-selected={state.productFilter === value ? 'true' : 'false'}
        class={state.productFilter === value ? 'mfg-tree-item active' : 'mfg-tree-item'}
        data-testid={`kt-routing-product-${value.toLowerCase()}`}
        onClick={() => {
          state.selectProduct(value);
        }}
      >
        <span>{label}</span>
        <span class="mfg-tree-count">{String(count)}</span>
      </button>
    </li>
  );
  return (
    <aside class="console-split-tree" data-testid="kt-routing-product-tree">
      <h3>产品类型</h3>
      <ul role="tree" aria-label="工艺路线产品类型" class="mfg-category-tree">
        {entry(ALL_PRODUCTS, '全部路线', countByType(ALL_PRODUCTS))}
        {entry(
          'FINISHED_GOOD',
          PRODUCT_LABELS.FINISHED_GOOD ?? '成品',
          countByType('FINISHED_GOOD'),
        )}
        {entry(
          'SEMI_FINISHED',
          PRODUCT_LABELS.SEMI_FINISHED ?? '半成品',
          countByType('SEMI_FINISHED'),
        )}
      </ul>
      <h3>版本状态</h3>
      <div class="console-filters mfg-status-filters" role="group" aria-label="版本状态">
        {STATUS_FILTERS.map((status) => (
          <button
            key={status}
            type="button"
            class={state.statusFilter === status ? 'secondary compact active' : 'secondary compact'}
            data-testid={`kt-routing-status-${status.toLowerCase()}`}
            aria-pressed={state.statusFilter === status ? 'true' : 'false'}
            onClick={() => {
              state.setStatusFilter(status);
            }}
          >
            {status === 'ALL' ? '全部' : STATUS_LABELS[status]}
          </button>
        ))}
      </div>
    </aside>
  );
};

const SearchBar = ({ state }: Readonly<{ state: RoutingViewState }>) => (
  <form
    class="console-filters mfg-item-search"
    data-testid="kt-routing-search-form"
    onSubmit={(event) => {
      event.preventDefault();
      state.applySearch();
    }}
  >
    <input
      type="search"
      placeholder="搜索路线编码或名称（回车搜索）"
      data-testid="kt-routing-search"
      value={state.search}
      onInput={(event) => {
        state.setSearch((event.target as { value?: string }).value ?? '');
      }}
    />
    <button type="submit" class="secondary compact" data-testid="kt-routing-search-submit">
      搜索
    </button>
    {state.search !== '' || state.appliedQuery !== '' ? (
      <button
        type="button"
        class="secondary compact"
        data-testid="kt-routing-search-clear"
        onClick={state.clearSearch}
      >
        清除
      </button>
    ) : null}
  </form>
);

const RoutingView = (state: RoutingViewState) => (
  <div class="commercial-console-page" data-testid="kt-routing-page">
    <PageHeader
      title="工艺路线管理"
      description="按产品类型浏览工艺路线版本；行级发布草稿，详情聚合版本历史与顺序步骤视图"
      actions={
        <>
          <button
            type="button"
            class="secondary"
            data-testid="kt-routing-refresh"
            disabled={state.loading}
            onClick={() => {
              void state.runRefresh();
            }}
          >
            刷新
          </button>
          {state.mayManage ? (
            <button
              type="button"
              class="primary"
              data-testid="kt-routing-create"
              onClick={state.openCreate}
            >
              ＋ 新建工艺路线
            </button>
          ) : null}
        </>
      }
    />
    <div class="console-split mfg-item-split">
      <ProductTree state={state} />
      <div class="console-split-main">
        <SearchBar state={state} />
        {state.loadError !== '' ? (
          <p class="console-error" role="alert" data-testid="kt-routing-load-error">
            {state.loadError}
          </p>
        ) : null}
        {state.actionError !== '' ? (
          <p class="console-error" role="alert" data-testid="kt-routing-action-error">
            {state.actionError}
          </p>
        ) : null}
        <DataTable
          columns={columns(state)}
          rows={state.routings}
          rowId={(row) => state.ports.textValue(row.id ?? row.code, 'row')}
          caption="工艺路线版本主列表（编码、产品、工序数与版本状态）"
          loading={state.loading}
          pagination={{
            loadedCount: state.routings.length,
            hasMore: state.nextCursor !== null,
            loading: state.loadingMore,
            onLoadMore: () => {
              state.loadMore();
            },
          }}
          {...(state.loadError === '' ? {} : { error: state.loadError })}
          emptyTitle={state.filtered ? '没有符合条件的工艺路线版本' : '暂无工艺路线版本'}
          emptyDescription={
            state.filtered ? '调整产品类型、版本状态或关键字后重试' : '新建工艺路线后会出现在这里'
          }
        />
      </div>
    </div>
    {state.selected ? <RoutingDetailDrawer state={state} /> : null}
    {state.activeForm === 'create' ? <RoutingCreateDrawer state={state} /> : null}
    <ConsoleConfirmDialog pending={state.confirm} />
  </div>
);

export function RoutingConsolePage(ports: RoutingConsolePorts) {
  const bundle = createBundle(ports);
  const loaders = createRoutingActions(ports, bundle);
  const mutations = createRoutingMutations(ports, bundle, {
    sync: loaders.sync,
    reloadDetail: loaders.reloadDetail,
    actionFailed: loaders.actionFailed,
  });
  const actions = { ...loaders, ...mutations };
  const mayManage = ports.permissions.has('routing:manage');

  const state = (): RoutingViewState => ({
    permissions: ports.permissions,
    ports,
    snapshot: bundle.snapshot.value,
    routings: bundle.routings.value,
    nextCursor: bundle.nextCursor.value,
    filtered: actions.isFiltered(),
    productFilter: bundle.productFilter.value,
    statusFilter: bundle.statusFilter.value,
    search: bundle.search.value,
    appliedQuery: bundle.appliedQuery.value,
    loading: bundle.loading.value,
    loadingMore: bundle.loadingMore.value,
    loadError: bundle.loadError.value,
    actionError: bundle.actionError.value,
    submitError: bundle.submitError.value,
    selected: bundle.selected.value,
    detail: bundle.detail.value,
    detailLoading: bundle.detailLoading.value,
    activeForm: bundle.activeForm.value,
    operationRows: bundle.operationRows.value,
    mayManage,
    confirm: bundle.confirm,
    selectProduct: (next) => {
      bundle.productFilter.value = next;
      actions.settle();
    },
    setStatusFilter: (next) => {
      bundle.statusFilter.value = next;
      actions.settle();
    },
    setSearch: (next) => {
      bundle.search.value = next;
    },
    applySearch: actions.applySearch,
    clearSearch: actions.clearSearch,
    loadMore: () => {
      void actions.loadMore();
    },
    runRefresh: () => actions.sync(),
    open: actions.open,
    openCreate: actions.openCreate,
    closeForm: actions.closeForm,
    runPublish: actions.runPublish,
    addOperationRow: actions.addOperationRow,
    removeOperationRow: actions.removeOperationRow,
    moveOperationRow: actions.moveOperationRow,
    runCreate: actions.runCreate,
  });

  const Page = () => RoutingView(state());
  return Page;
}
