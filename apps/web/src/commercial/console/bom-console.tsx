// U3-MFG-2（ADR-0014 分域重写）：BOM 管理控制台——原 vanilla「BOM 与替代料」卡片与
// 「创建标准 BOM」表单能力面等价迁移 + UX 升级（治理模块同款主从布局：左产品类型树
// （成品/半成品，按 BOM 产品物料类型计数）/右主表；行级查看与草稿发布；服务端筛选
// 分页；详情抽屉聚合版本历史、组件层级树（折叠/替代料标记）与版本对比三类差异）。
// 默认视图沿用路由加载的全量快照（legacy 列表语义）；状态/关键字/产品类型任一生效时
// 切换为服务端分页（显式 limit + (code,version) keyset cursor）。
import { signal } from '@preact/signals';
import { createBomActions, createBomMutations } from './bom-console-actions';
import type { BomBundle } from './bom-console-actions';
import { DataTable, PageHeader, StatusBadge, type DataTableColumn } from '@kingturf/ui';
import { BomCreateDrawer } from './bom-create';
import { BomDetailDrawer } from './bom-detail';
import type { BomConsolePorts, BomRow } from './bom-ports';
import {
  ALL_PRODUCTS,
  bomLines,
  PRODUCT_LABELS,
  STATUS_FILTERS,
  STATUS_LABELS,
  statusTone,
  type BomProductFilter,
  type BomStatusFilter,
  type BomViewState,
} from './bom-state';

const createBundle = (ports: BomConsolePorts): BomBundle => ({
  snapshot: signal<readonly BomRow[]>([...ports.initialBoms]),
  boms: signal<readonly BomRow[]>([...ports.initialBoms]),
  nextCursor: signal<string | null>(null),
  productFilter: signal<BomProductFilter>(ALL_PRODUCTS),
  statusFilter: signal<BomStatusFilter>('ALL'),
  search: signal(''),
  appliedQuery: signal(''),
  loading: signal(false),
  loadingMore: signal(false),
  loadError: signal(''),
  actionError: signal(''),
  submitError: signal(''),
  selected: signal<BomRow | null>(null),
  detail: signal<BomRow | null>(null),
  detailLoading: signal(false),
  activeForm: signal<'create' | null>(null),
  componentRows: signal<readonly string[]>(['r1']),
  compareVersions: signal<readonly [string, string] | null>(null),
  collapsed: signal<ReadonlySet<string>>(new Set()),
});

const text = (
  state: BomViewState,
  row: BomRow,
  camel: string,
  snake: string,
  fallback = '',
): string => state.ports.recordText(row, camel, snake, fallback);

const columns = (state: BomViewState): readonly DataTableColumn<BomRow>[] => [
  {
    key: 'code',
    header: 'BOM',
    sortable: true,
    field: (row) => text(state, row, 'code', 'code'),
    render: (row) => (
      <span class="mfg-item-cell">
        <strong data-testid="kt-bom-code">{text(state, row, 'code', 'code', '—')}</strong>
        <small class="bom-muted">{text(state, row, 'name', 'name')}</small>
      </span>
    ),
  },
  {
    key: 'product',
    header: '产品',
    sortable: true,
    field: (row) => text(state, row, 'productItemId', 'product_item_id'),
    // 产品 SKU 并入复合文本（不与物料控制台的 SKU 独占元素撞 exact 定位）。
    render: (row) => (
      <span class="bom-muted">{`产品 ${text(state, row, 'productItemId', 'product_item_id', '—')}`}</span>
    ),
  },
  {
    key: 'lines',
    header: '组件数',
    sortable: true,
    field: (row) => bomLines(row).length,
    render: (row) => `${String(bomLines(row).length)} 行`,
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
          data-testid="kt-bom-open"
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
            data-testid="kt-bom-publish"
            disabled={state.loading}
            onClick={() => {
              void state.runPublish(row);
            }}
          >
            发布版本
          </button>
        ) : null}
      </span>
    ),
  },
];

// 左侧产品类型树：全部 + 成品/半成品（按 BOM 产品物料类型计数——计数按 BOM 根
// （编码）去重；类型归属经宿主注入的 productTypeOf 解析，未知类型的 BOM 仅计入全部）。
const ProductTree = ({ state }: Readonly<{ state: BomViewState }>) => {
  const countByType = (filter: BomProductFilter): number => {
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
  const entry = (value: BomProductFilter, label: string, count: number) => (
    <li role="none">
      <button
        type="button"
        role="treeitem"
        aria-selected={state.productFilter === value ? 'true' : 'false'}
        class={state.productFilter === value ? 'mfg-tree-item active' : 'mfg-tree-item'}
        data-testid={`kt-bom-product-${value.toLowerCase()}`}
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
    <aside class="console-split-tree" data-testid="kt-bom-product-tree">
      <h3>产品类型</h3>
      <ul role="tree" aria-label="BOM 产品类型" class="mfg-category-tree">
        {entry(ALL_PRODUCTS, '全部 BOM', countByType(ALL_PRODUCTS))}
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
            data-testid={`kt-bom-status-${status.toLowerCase()}`}
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

const SearchBar = ({ state }: Readonly<{ state: BomViewState }>) => (
  <form
    class="console-filters mfg-item-search"
    data-testid="kt-bom-search-form"
    onSubmit={(event) => {
      event.preventDefault();
      state.applySearch();
    }}
  >
    <input
      type="search"
      placeholder="搜索 BOM 编码或名称（回车搜索）"
      data-testid="kt-bom-search"
      value={state.search}
      onInput={(event) => {
        state.setSearch((event.target as { value?: string }).value ?? '');
      }}
    />
    <button type="submit" class="secondary compact" data-testid="kt-bom-search-submit">
      搜索
    </button>
    {state.search !== '' || state.appliedQuery !== '' ? (
      <button
        type="button"
        class="secondary compact"
        data-testid="kt-bom-search-clear"
        onClick={state.clearSearch}
      >
        清除
      </button>
    ) : null}
    {state.appliedQuery !== '' ? (
      <span class="bom-muted" data-testid="kt-bom-search-applied">
        {`关键字：${state.appliedQuery}`}
      </span>
    ) : null}
  </form>
);

const BomView = (state: BomViewState) => (
  <div class="commercial-console-page" data-testid="kt-bom-page">
    <PageHeader
      title="BOM 管理"
      description="按产品类型浏览 BOM 版本；行级发布草稿，详情聚合版本历史、组件层级树与版本对比"
      actions={
        <>
          <button
            type="button"
            class="secondary"
            data-testid="kt-bom-refresh"
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
              data-testid="kt-bom-create"
              onClick={state.openCreate}
            >
              ＋ 新建 BOM
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
          <p class="console-error" role="alert" data-testid="kt-bom-load-error">
            {state.loadError}
          </p>
        ) : null}
        {state.actionError !== '' ? (
          <p class="console-error" role="alert" data-testid="kt-bom-action-error">
            {state.actionError}
          </p>
        ) : null}
        <DataTable
          columns={columns(state)}
          rows={state.boms}
          rowId={(row) => state.ports.textValue(row.id ?? row.code, 'row')}
          caption="BOM 版本主列表（编码、产品、组件数与版本状态）"
          loading={state.loading}
          pagination={{
            loadedCount: state.boms.length,
            hasMore: state.nextCursor !== null,
            loading: state.loadingMore,
            onLoadMore: () => {
              state.loadMore();
            },
          }}
          {...(state.loadError === '' ? {} : { error: state.loadError })}
          emptyTitle={state.filtered ? '没有符合条件的 BOM 版本' : '暂无 BOM 版本'}
          emptyDescription={
            state.filtered ? '调整产品类型、版本状态或关键字后重试' : '新建 BOM 后会出现在这里'
          }
        />
      </div>
    </div>
    {state.selected ? <BomDetailDrawer state={state} /> : null}
    {state.activeForm === 'create' ? <BomCreateDrawer state={state} /> : null}
  </div>
);

export function BomConsolePage(ports: BomConsolePorts) {
  const bundle = createBundle(ports);
  const loaders = createBomActions(ports, bundle);
  const mutations = createBomMutations(ports, bundle, {
    sync: loaders.sync,
    reloadDetail: loaders.reloadDetail,
    actionFailed: loaders.actionFailed,
  });
  const actions = {
    ...loaders,
    ...mutations,
    ...loaders,
    ...createBomMutations(ports, bundle, {
      sync: loaders.sync,
      reloadDetail: loaders.reloadDetail,
      actionFailed: loaders.actionFailed,
    }),
  };
  const mayManage = ports.permissions.has('bom:manage');

  const state = (): BomViewState => ({
    permissions: ports.permissions,
    ports,
    snapshot: bundle.snapshot.value,
    boms: bundle.boms.value,
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
    componentRows: bundle.componentRows.value,
    compareVersions: bundle.compareVersions.value,
    collapsed: bundle.collapsed.value,
    mayManage,
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
    setCompareVersions: (next) => {
      bundle.compareVersions.value = next;
    },
    toggleNode: actions.toggleNode,
    addComponentRow: actions.addComponentRow,
    removeComponentRow: actions.removeComponentRow,
    runCreate: actions.runCreate,
  });

  const Page = () => BomView(state());
  return Page;
}
