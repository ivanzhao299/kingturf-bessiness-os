// U3-MFG-4（ADR-0014 分域重写）：工单管理控制台——原 vanilla「生产工单与车间执行」卡片
// 的创建 / 下达 / 开工 / 完工 / 关闭与只读呈现等价迁移 + UX 升级（治理模块同款：顶部状态
// 汇总卡（兼作筛选）/ 主表（状态徽章 + 完工进度条 + 行级下一步动作）/ 详情抽屉（工序
// 进度、物料分配、报工时间线）/ 新建与流转抽屉）。默认视图沿用路由加载的全量快照并按
// legacy 卡片的作业队列排序；状态或关键字生效时切换为服务端分页（工单 id keyset）。
// U3-MFG-5：详情抽屉的「车间执行」区给出工序报工 / 领退料 / 成品卷入库三个入口，表单是与
// 新建、流转同款的抽屉（打开期间详情抽屉不渲染，两个模态抽屉不同时存在）；提交成功后回到
// 详情抽屉并就地更新。
// e2e 契约：工单号独占文本元素（kt-wo-number）；详情证据（物料台账/成品序列/事件）在
// 详情抽屉内，各条目独占一个文本元素。
import { signal } from '@preact/signals';
import {
  DataTable,
  PageHeader,
  StatusBadge,
  SummaryCards,
  type DataTableColumn,
} from '@kingturf/ui';
import {
  ProductionOrderCreateDrawer,
  ProductionOrderTransitionDrawer,
} from './production-order-forms';
import { ProductionOrderExecutionDrawer } from './production-order-execution-forms';
import { ProgressBar, ProductionOrderDetailDrawer } from './production-order-detail';
import type { ProductionOrderConsolePorts, ProductionOrderRow } from './production-order-ports';
import {
  createProductionOrderLoaders,
  createProductionOrderMutations,
  type ProductionOrderBundle,
} from './production-order-actions';
import {
  byLegacyPriority,
  formatQuantity,
  nextActionOf,
  progressOf,
  records,
  STATUS_FILTERS,
  STATUS_LABELS,
  statusTone,
  type ExecutionDraft,
  type ProductionOrderExecution,
  type ProductionOrderForm,
  type ProductionOrderStatusFilter,
  type ProductionOrderViewState,
} from './production-order-state';
import { ConsoleNotice } from './console-notice';
import './commercial-ux.css';

// 车间执行表单（其余表单种类是新建与流转）。
const EXECUTION_FORMS: readonly ProductionOrderExecution[] = ['report', 'material', 'output'];
const executionFormOf = (form: ProductionOrderForm | null): ProductionOrderExecution | null =>
  form !== null && (EXECUTION_FORMS as readonly string[]).includes(form)
    ? (form as ProductionOrderExecution)
    : null;
import './production-order-console.css';

const createBundle = (ports: ProductionOrderConsolePorts): ProductionOrderBundle => ({
  snapshot: signal<readonly ProductionOrderRow[]>([...ports.initialOrders]),
  // 默认视图沿用 legacy 卡片的作业队列排序（进行中 → 已放行 → 已完成 → 草稿 → 已关闭）。
  orders: signal<readonly ProductionOrderRow[]>(
    byLegacyPriority([...ports.initialOrders], (row) => ports.recordText(row, 'state', 'state')),
  ),
  nextCursor: signal<string | null>(null),
  statusFilter: signal<ProductionOrderStatusFilter>('ALL'),
  search: signal(''),
  appliedQuery: signal(''),
  loading: signal(false),
  loadingMore: signal(false),
  loadError: signal(''),
  actionError: signal(''),
  submitError: signal(''),
  notice: signal(''),
  selected: signal<ProductionOrderRow | null>(null),
  detail: signal<ProductionOrderRow | null>(null),
  detailLoading: signal(false),
  activeForm: signal<ProductionOrderForm | null>(null),
  pending: signal<Readonly<{
    row: ProductionOrderRow;
    action: 'release' | 'start' | 'complete' | 'close';
  }> | null>(null),
  execution: signal<ExecutionDraft | null>(null),
});

const text = (
  state: ProductionOrderViewState,
  row: ProductionOrderRow,
  camel: string,
  snake = camel,
  fallback = '',
): string => state.ports.recordText(row, camel, snake, fallback);

const columns = (
  state: ProductionOrderViewState,
): readonly DataTableColumn<ProductionOrderRow>[] => [
  {
    key: 'orderNumber',
    header: '工单号',
    sortable: true,
    field: (row) => text(state, row, 'orderNumber', 'order_number'),
    render: (row) => (
      <span class="po-cell">
        <strong data-testid="kt-wo-number">
          {text(state, row, 'orderNumber', 'order_number', '—')}
        </strong>
        <small class="po-muted">{text(state, row, 'sourceReference', 'source_reference')}</small>
      </span>
    ),
  },
  {
    key: 'product',
    header: '产品',
    field: (row) => text(state, row, 'sku', 'sku'),
    render: (row) => (
      <span class="po-cell">
        <strong>{text(state, row, 'sku', 'sku', '—')}</strong>
        <small class="po-muted">{text(state, row, 'itemName', 'itemName')}</small>
      </span>
    ),
  },
  {
    key: 'planned',
    header: '计划数量',
    sortable: true,
    align: 'right',
    field: (row) => progressOf(row).planned,
    render: (row) => formatQuantity(row.planned_quantity),
  },
  {
    key: 'progress',
    header: '完工进度',
    sortable: true,
    field: (row) => progressOf(row).ratio,
    render: (row) => {
      const progress = progressOf(row);
      return (
        <span class="po-progress" data-testid="kt-wo-progress">
          <span class="po-progress-text">
            {`${formatQuantity(progress.completed)} / ${formatQuantity(progress.planned)}`}
          </span>
          <ProgressBar ratio={progress.ratio} label="工单完工进度" />
        </span>
      );
    },
  },
  {
    key: 'state',
    header: '状态',
    sortable: true,
    field: (row) => text(state, row, 'state', 'state'),
    render: (row) => {
      const status = text(state, row, 'state', 'state');
      return (
        <StatusBadge tone={statusTone(status)}>
          {STATUS_LABELS[status] ?? state.ports.businessStateLabel(status)}
        </StatusBadge>
      );
    },
  },
  {
    key: 'due',
    header: '交期',
    sortable: true,
    field: (row) => text(state, row, 'plannedDueAt', 'planned_due_at'),
    render: (row) => text(state, row, 'plannedDueAt', 'planned_due_at', '—').slice(0, 10),
  },
  {
    key: 'actions',
    header: '操作',
    field: () => '查看',
    render: (row) => {
      const next = nextActionOf(text(state, row, 'state', 'state'));
      return (
        <span class="po-row-actions">
          <button
            type="button"
            class="secondary compact"
            data-testid="kt-wo-open"
            onClick={() => {
              state.open(row);
            }}
          >
            查看
          </button>
          {next && state.permissions.has(next.capability) ? (
            <button
              type="button"
              class="secondary compact"
              data-testid="kt-wo-next-action"
              disabled={state.loading}
              onClick={() => {
                state.openTransition(row, next.action);
              }}
            >
              {next.label}
            </button>
          ) : null}
        </span>
      );
    },
  },
];

// 汇总卡的状态提示语（卡片兼作筛选：点选即按状态过滤，再点一次回到全部）。
const STATUS_HINTS: Readonly<Record<string, string>> = {
  DRAFT: '待下达',
  RELEASED: '待开工',
  IN_PROGRESS: '车间执行中',
  COMPLETED: '待关闭',
  CLOSED: '已闭环',
  CANCELLED: '不再执行',
};

const WorkOrderSummary = ({ state }: Readonly<{ state: ProductionOrderViewState }>) => {
  const countOf = (status: string): number =>
    state.snapshot.filter((row) => text(state, row, 'state', 'state') === status).length;
  const reported = state.snapshot.reduce((sum, row) => sum + records(row.reports).length, 0);
  const rolled = state.snapshot.reduce((sum, row) => sum + records(row.rolls).length, 0);
  return (
    <div>
      <SummaryCards
        label="工单状态汇总"
        testId="kt-wo-summary"
        itemTestId={(id) => `kt-wo-status-${id.toLowerCase()}`}
        items={STATUS_FILTERS.filter((status) => status !== 'ALL').map((status) => ({
          id: status,
          label: STATUS_LABELS[status] ?? status,
          value: String(countOf(status)),
          hint: STATUS_HINTS[status] ?? '',
          tone: statusTone(status),
          active: state.statusFilter === status,
          onSelect: () => {
            state.setStatusFilter(state.statusFilter === status ? 'ALL' : status);
          },
        }))}
      />
      <p class="console-hint" data-testid="kt-wo-summary-total">
        {`共 ${String(state.snapshot.length)} 张工单 · 累计报工 ${String(reported)} 条 · 成品卷 ${String(rolled)} 卷`}
      </p>
    </div>
  );
};

const SearchBar = ({ state }: Readonly<{ state: ProductionOrderViewState }>) => (
  <form
    class="console-filters po-search"
    data-testid="kt-wo-search-form"
    onSubmit={(event) => {
      event.preventDefault();
      state.applySearch();
    }}
  >
    <input
      type="search"
      placeholder="搜索工单号、产品 SKU 或名称（回车搜索）"
      data-testid="kt-wo-search"
      value={state.search}
      onInput={(event) => {
        state.setSearch((event.target as { value?: string }).value ?? '');
      }}
    />
    <button type="submit" class="secondary compact" data-testid="kt-wo-search-submit">
      搜索
    </button>
    {state.search !== '' || state.appliedQuery !== '' ? (
      <button
        type="button"
        class="secondary compact"
        data-testid="kt-wo-search-clear"
        onClick={state.clearSearch}
      >
        清除
      </button>
    ) : null}
  </form>
);

const ProductionOrderView = (state: ProductionOrderViewState) => (
  <div class="commercial-console-page" data-testid="kt-wo-page">
    <PageHeader
      title="工单管理"
      description="按状态跟踪生产工单；行级下达、开工、完工与关闭，详情聚合工序进度、物料分配与报工记录"
      actions={
        <>
          <button
            type="button"
            class="secondary"
            data-testid="kt-wo-refresh"
            disabled={state.loading}
            onClick={() => {
              void state.runRefresh();
            }}
          >
            刷新
          </button>
          {state.mayCreate ? (
            <button
              type="button"
              class="primary"
              data-testid="kt-wo-create"
              onClick={state.openCreate}
            >
              ＋ 新建生产工单
            </button>
          ) : null}
        </>
      }
    />
    {state.selected === null ? <ConsoleNotice message={state.notice} /> : null}
    <WorkOrderSummary state={state} />
    <SearchBar state={state} />
    {state.loadError !== '' ? (
      <p class="console-error" role="alert" data-testid="kt-wo-load-error">
        {state.loadError}
      </p>
    ) : null}
    {state.actionError !== '' ? (
      <p class="console-error" role="alert" data-testid="kt-wo-action-error">
        {state.actionError}
      </p>
    ) : null}
    <DataTable
      columns={columns(state)}
      rows={state.orders}
      rowId={(row) => state.ports.textValue(row.id ?? row.order_number, 'row')}
      caption="生产工单主列表（工单号、产品、计划数量、完工进度、状态与交期）"
      loading={state.loading}
      pagination={{
        loadedCount: state.orders.length,
        hasMore: state.nextCursor !== null,
        loading: state.loadingMore,
        onLoadMore: () => {
          state.loadMore();
        },
      }}
      {...(state.loadError === '' ? {} : { error: state.loadError })}
      emptyTitle={state.filtered ? '没有符合条件的生产工单' : '暂无生产工单'}
      emptyDescription={
        state.filtered ? '调整状态汇总或关键字后重试' : '新建生产工单后会出现在这里'
      }
    />
    {/* 任一表单抽屉打开期间详情抽屉不渲染：两个模态抽屉不同时存在。 */}
    {state.selected && state.activeForm === null ? (
      <ProductionOrderDetailDrawer state={state} />
    ) : null}
    {state.activeForm === 'create' ? <ProductionOrderCreateDrawer state={state} /> : null}
    {state.activeForm === 'transition' ? <ProductionOrderTransitionDrawer state={state} /> : null}
    {executionFormOf(state.activeForm) !== null ? (
      <ProductionOrderExecutionDrawer state={state} />
    ) : null}
  </div>
);

export function ProductionOrderConsolePage(ports: ProductionOrderConsolePorts) {
  const bundle = createBundle(ports);
  const loaders = createProductionOrderLoaders(ports, bundle);
  const mutations = createProductionOrderMutations(ports, bundle, {
    sync: loaders.sync,
    reloadDetail: loaders.reloadDetail,
    actionFailed: loaders.actionFailed,
  });
  const actions = { ...loaders, ...mutations };
  ports.onRelatedRecord?.((id) => {
    const order = bundle.snapshot.peek().find((row) => row.id === id);
    if (order) actions.open(order);
    else
      void ports
        .loadDetail(id)
        .then((detail) => {
          if (detail) actions.open(detail);
        })
        .catch((error: unknown) => {
          loaders.actionFailed(error, '工单加载失败');
        });
  });
  const mayCreate = ports.permissions.has('production:plan');

  const state = (): ProductionOrderViewState => ({
    permissions: ports.permissions,
    ports,
    snapshot: bundle.snapshot.value,
    orders: bundle.orders.value,
    nextCursor: bundle.nextCursor.value,
    filtered: actions.isFiltered(),
    statusFilter: bundle.statusFilter.value,
    search: bundle.search.value,
    appliedQuery: bundle.appliedQuery.value,
    loading: bundle.loading.value,
    loadingMore: bundle.loadingMore.value,
    loadError: bundle.loadError.value,
    actionError: bundle.actionError.value,
    submitError: bundle.submitError.value,
    notice: bundle.notice.value,
    selected: bundle.selected.value,
    detail: bundle.detail.value,
    detailLoading: bundle.detailLoading.value,
    activeForm: bundle.activeForm.value,
    pending: bundle.pending.value,
    mayCreate,
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
    openTransition: actions.openTransition,
    closeForm: actions.closeForm,
    runTransition: actions.runTransition,
    runCreate: actions.runCreate,
    execution: bundle.execution.value,
    openExecution: actions.openExecution,
    runExecution: actions.runExecution,
  });

  const Page = () => ProductionOrderView(state());
  return Page;
}
