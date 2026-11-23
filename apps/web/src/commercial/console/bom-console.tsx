// U3-MFG-2（ADR-0014 分域重写）：BOM 管理控制台——原 vanilla「BOM 与替代料」卡片与
// 「创建标准 BOM」表单能力面等价迁移 + UX 升级（治理模块同款主从布局：左产品类型树
// （成品/半成品，按 BOM 产品物料类型计数）/右主表；行级查看与草稿发布；服务端筛选
// 分页；详情抽屉聚合版本历史、组件层级树（折叠/替代料标记）与版本对比三类差异）。
// 默认视图沿用路由加载的全量快照（legacy 列表语义）；状态/关键字/产品类型任一生效时
// 切换为服务端分页（显式 limit + (code,version) keyset cursor）。
import { signal, type Signal } from '@preact/signals';
import { DataTable, PageHeader, StatusBadge, type DataTableColumn } from '@kingturf/ui';
import { BomCreateDrawer } from './bom-create';
import { BomDetailDrawer } from './bom-detail';
import type { BomConsolePorts, BomPageQuery, BomRow } from './bom-ports';
import {
  ALL_PRODUCTS,
  BOM_PAGE_SIZE,
  bomLines,
  PRODUCT_LABELS,
  STATUS_FILTERS,
  STATUS_LABELS,
  statusTone,
  type BomProductFilter,
  type BomStatusFilter,
  type BomViewState,
} from './bom-state';

type BomBundle = Readonly<{
  snapshot: Signal<readonly BomRow[]>;
  boms: Signal<readonly BomRow[]>;
  nextCursor: Signal<string | null>;
  productFilter: Signal<BomProductFilter>;
  statusFilter: Signal<BomStatusFilter>;
  search: Signal<string>;
  appliedQuery: Signal<string>;
  loading: Signal<boolean>;
  loadingMore: Signal<boolean>;
  loadError: Signal<string>;
  actionError: Signal<string>;
  submitError: Signal<string>;
  selected: Signal<BomRow | null>;
  detail: Signal<BomRow | null>;
  detailLoading: Signal<boolean>;
  activeForm: Signal<'create' | null>;
  componentRows: Signal<readonly string[]>;
  compareVersions: Signal<readonly [string, string] | null>;
  collapsed: Signal<ReadonlySet<string>>;
}>;

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

// 数据装载与行级动作闭包（页面 signal 束的最小面）。请求序号守卫丢弃过期响应。
function createBomActions(ports: BomConsolePorts, bundle: BomBundle) {
  let requestSequence = 0;
  let detailSequence = 0;
  let rowSequence = 0;
  const isFiltered = (): boolean =>
    bundle.productFilter.value !== ALL_PRODUCTS ||
    bundle.statusFilter.value !== 'ALL' ||
    bundle.appliedQuery.value !== '';
  const pageQuery = (cursor?: string): BomPageQuery => ({
    ...(bundle.productFilter.value === ALL_PRODUCTS
      ? {}
      : { productType: bundle.productFilter.value }),
    ...(bundle.statusFilter.value === 'ALL' ? {} : { status: bundle.statusFilter.value }),
    ...(bundle.appliedQuery.value === '' ? {} : { query: bundle.appliedQuery.value }),
    limit: BOM_PAGE_SIZE,
    ...(cursor ? { cursor } : {}),
  });
  const messageOf = (error: unknown, fallback: string): string =>
    error instanceof Error ? error.message : fallback;
  const loadFailed = (error: unknown, fallback: string): void => {
    bundle.loadError.value = messageOf(error, fallback);
  };
  const actionFailed = (error: unknown, fallback: string): void => {
    if (bundle.selected.value !== null || bundle.activeForm.value !== null)
      bundle.submitError.value = messageOf(error, fallback);
    else bundle.actionError.value = messageOf(error, fallback);
  };
  const showAll = (): void => {
    requestSequence += 1;
    bundle.actionError.value = '';
    bundle.boms.value = bundle.snapshot.value;
    bundle.nextCursor.value = null;
    bundle.loadError.value = '';
    bundle.loading.value = false;
  };
  const reload = async (): Promise<void> => {
    const sequence = ++requestSequence;
    bundle.loading.value = true;
    try {
      const page = await ports.fetchPage(pageQuery());
      if (sequence !== requestSequence) return;
      bundle.boms.value = page.items;
      bundle.nextCursor.value = page.nextCursor;
      bundle.loadError.value = '';
    } catch (error: unknown) {
      if (sequence === requestSequence) loadFailed(error, 'BOM 加载失败');
    } finally {
      if (sequence === requestSequence) bundle.loading.value = false;
    }
  };
  const loadMore = async (): Promise<void> => {
    const cursor = bundle.nextCursor.value;
    if (cursor === null || bundle.loadingMore.value) return;
    const sequence = requestSequence;
    bundle.loadingMore.value = true;
    try {
      const page = await ports.fetchPage(pageQuery(cursor));
      if (sequence !== requestSequence) return;
      bundle.boms.value = [...bundle.boms.value, ...page.items];
      bundle.nextCursor.value = page.nextCursor;
      bundle.loadError.value = '';
    } catch (error: unknown) {
      if (sequence === requestSequence) loadFailed(error, '继续加载失败');
    } finally {
      bundle.loadingMore.value = false;
    }
  };
  const sync = async (): Promise<void> => {
    bundle.loading.value = true;
    try {
      bundle.snapshot.value = await ports.refresh();
      if (isFiltered()) await reload();
      else showAll();
    } catch (error: unknown) {
      loadFailed(error, 'BOM 刷新失败');
      bundle.loading.value = false;
    }
  };
  const reloadDetail = async (): Promise<void> => {
    const row = bundle.selected.value;
    const bomId = row ? ports.textValue(row.bomId ?? row.id, '') : '';
    if (!row || bomId === '') return;
    const sequence = ++detailSequence;
    bundle.detailLoading.value = true;
    bundle.compareVersions.value = null;
    bundle.collapsed.value = new Set();
    try {
      const detail = await ports.loadDetail(bomId);
      if (sequence === detailSequence && detail) bundle.detail.value = detail;
    } catch {
      // 详情读取失败静默回退列表行数据。
    } finally {
      if (sequence === detailSequence) bundle.detailLoading.value = false;
    }
  };
  const closeForm = (): void => {
    bundle.activeForm.value = null;
    bundle.submitError.value = '';
    bundle.componentRows.value = ['r1'];
  };
  const settle = (): void => {
    if (isFiltered()) void reload();
    else showAll();
  };

  // 草稿发布走现代化统一动作端点 PUT /:id/publish（分派 legacy publish('bom') 同链）。
  const runPublish = async (row: BomRow): Promise<void> => {
    bundle.submitError.value = '';
    bundle.actionError.value = '';
    try {
      await ports.submit(
        `/api/v1/manufacturing-boms/${ports.textValue(row.id ?? row.bom_id, '')}/publish`,
        {},
        'PUT',
      );
      await sync();
      const opened = bundle.selected.value;
      if (opened) {
        const openedId = ports.textValue(opened.bomId ?? opened.id, '');
        bundle.selected.value =
          bundle.snapshot.value.find(
            (candidate) => ports.textValue(candidate.bomId ?? candidate.id, '') === openedId,
          ) ?? opened;
        bundle.detail.value = null;
        await reloadDetail();
      }
    } catch (error: unknown) {
      actionFailed(error, '版本发布失败');
    }
  };

  // 创建载荷与原 vanilla「创建标准 BOM」表单逐字节一致（productItemId 取所选版本行
  // 的 itemId、outputQuantity '1'、publish 恒 false；首行字段裸名与 legacy 对齐，
  // 追加行带前缀；替代料 priority 1 / conversionFactor '1'）。
  const runCreate = async (values: Readonly<Record<string, string>>): Promise<void> => {
    bundle.submitError.value = '';
    bundle.actionError.value = '';
    const choiceOf = (versionId: string): string =>
      ports.itemVersionChoices.find((choice) => choice.value === versionId)?.itemId ?? '';
    const field = (row: string, name: string): string =>
      values[row === 'r1' ? name : `${row}:${name}`] ?? '';
    try {
      await ports.submit('/api/v1/manufacturing-boms', {
        code: values.code ?? '',
        name: values.name ?? '',
        productItemId: choiceOf(values.product ?? ''),
        productItemVersionId: values.product ?? '',
        outputQuantity: '1',
        effectiveAt: `${values.effectiveAt ?? ''}T00:00:00.000Z`,
        lines: bundle.componentRows.value.map((row) => {
          const substitute = field(row, 'substitute');
          return {
            componentItemVersionId: field(row, 'component'),
            quantity: field(row, 'quantity'),
            scrapBasisPoints: Number(field(row, 'scrap') || '0'),
            substitutes: substitute
              ? [{ itemVersionId: substitute, priority: 1, conversionFactor: '1' }]
              : [],
          };
        }),
        publish: false,
      });
    } catch (error: unknown) {
      actionFailed(error, 'BOM 创建失败');
      return;
    }
    closeForm();
    await sync();
  };

  return {
    isFiltered,
    sync,
    settle,
    loadMore,
    closeForm,
    runPublish,
    runCreate,
    open: (row: BomRow | null): void => {
      bundle.selected.value = row;
      bundle.activeForm.value = null;
      bundle.submitError.value = '';
      bundle.detail.value = null;
      if (row === null) detailSequence += 1;
      void reloadDetail();
    },
    openCreate: (): void => {
      bundle.activeForm.value = 'create';
      bundle.submitError.value = '';
    },
    toggleNode: (bomVersionId: string): void => {
      const next = new Set(bundle.collapsed.value);
      if (next.has(bomVersionId)) next.delete(bomVersionId);
      else next.add(bomVersionId);
      bundle.collapsed.value = next;
    },
    addComponentRow: (): void => {
      rowSequence += 1;
      bundle.componentRows.value = [...bundle.componentRows.value, `r${String(rowSequence + 1)}`];
    },
    removeComponentRow: (rowId: string): void => {
      bundle.componentRows.value = bundle.componentRows.value.filter((row) => row !== rowId);
    },
    applySearch: (): void => {
      bundle.appliedQuery.value = bundle.search.value.trim();
      settle();
    },
    clearSearch: (): void => {
      bundle.search.value = '';
      bundle.appliedQuery.value = '';
      settle();
    },
  };
}

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
  const actions = createBomActions(ports, bundle);
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
