// U3-MFG-1（ADR-0014 分域重写）：物料管理控制台——原 vanilla「物料与规格版本」卡片与
// 「创建物料版本」表单能力面等价迁移 + UX 升级（治理模块同款主从布局：左分类树 /
// 右主表；行级查看与草稿发布；服务端筛选分页；详情抽屉聚合版本历史与关联对象）。
// 默认视图沿用路由加载的全量快照（legacy 列表语义）；分类/状态/关键字任一生效时
// 切换为服务端分页（显式 limit + (sku,version) keyset cursor）。
import { signal, type Signal } from '@preact/signals';
import { DataTable, PageHeader, StatusBadge, type DataTableColumn } from '@kingturf/ui';
import { ItemCreateDrawer } from './item-create';
import { SpecChips, ItemDetailDrawer } from './item-detail';
import type { ItemConsolePorts, ItemPageQuery, ItemRow } from './item-ports';
import {
  ALL_CATEGORIES,
  CATEGORY_LABELS,
  ITEM_CATEGORIES,
  ITEM_PAGE_SIZE,
  STATUS_FILTERS,
  STATUS_LABELS,
  categoryLabel,
  countAllItems,
  countByCategory,
  specificationOf,
  specEntries,
  statusTone,
  type ItemCategory,
  type ItemCategoryFilter,
  type ItemStatusFilter,
  type ItemViewState,
  type SpecRowDraft,
} from './item-state';
import { failureMessage } from '../../shared/api-error-message';

type ItemBundle = Readonly<{
  // 全量快照（默认视图行与分类计数来源）。
  snapshot: Signal<readonly ItemRow[]>;
  // 当前展示行（筛选态为服务端分页行）。
  items: Signal<readonly ItemRow[]>;
  nextCursor: Signal<string | null>;
  category: Signal<ItemCategoryFilter>;
  statusFilter: Signal<ItemStatusFilter>;
  search: Signal<string>;
  appliedQuery: Signal<string>;
  loading: Signal<boolean>;
  loadingMore: Signal<boolean>;
  loadError: Signal<string>;
  // 列表上下文（抽屉/表单未打开）的动作错误——独立于装载错误，不隐藏列表。
  actionError: Signal<string>;
  submitError: Signal<string>;
  selected: Signal<ItemRow | null>;
  detail: Signal<ItemRow | null>;
  detailLoading: Signal<boolean>;
  activeForm: Signal<'create' | null>;
  createType: Signal<ItemCategory>;
  specRows: Signal<readonly SpecRowDraft[]>;
}>;

const createBundle = (ports: ItemConsolePorts): ItemBundle => ({
  snapshot: signal<readonly ItemRow[]>([...ports.initialItems]),
  items: signal<readonly ItemRow[]>([...ports.initialItems]),
  nextCursor: signal<string | null>(null),
  category: signal<ItemCategoryFilter>(ALL_CATEGORIES),
  statusFilter: signal<ItemStatusFilter>('ALL'),
  search: signal(''),
  appliedQuery: signal(''),
  loading: signal(false),
  loadingMore: signal(false),
  loadError: signal(''),
  actionError: signal(''),
  submitError: signal(''),
  selected: signal<ItemRow | null>(null),
  detail: signal<ItemRow | null>(null),
  detailLoading: signal(false),
  activeForm: signal<'create' | null>(null),
  createType: signal<ItemCategory>('RAW_MATERIAL'),
  specRows: signal<readonly SpecRowDraft[]>([]),
});

// 数据装载与行级动作闭包（页面 signal 束的最小面）。请求序号守卫丢弃过期响应。
function createItemActions(ports: ItemConsolePorts, bundle: ItemBundle) {
  let requestSequence = 0;
  let detailSequence = 0;
  let specSequence = 0;
  const isFiltered = (): boolean =>
    bundle.category.value !== ALL_CATEGORIES ||
    bundle.statusFilter.value !== 'ALL' ||
    bundle.appliedQuery.value !== '';
  const pageQuery = (cursor?: string): ItemPageQuery => ({
    ...(bundle.category.value === ALL_CATEGORIES ? {} : { itemType: bundle.category.value }),
    ...(bundle.statusFilter.value === 'ALL' ? {} : { status: bundle.statusFilter.value }),
    ...(bundle.appliedQuery.value === '' ? {} : { query: bundle.appliedQuery.value }),
    limit: ITEM_PAGE_SIZE,
    ...(cursor ? { cursor } : {}),
  });
  // 失败文案统一经 failureMessage：接口的常见英文消息转成中文，其余原样（TD-WF-006）。
  const messageOf = failureMessage;
  // 装载失败：DataTable 错态（空/错/载三态）。
  const loadFailed = (error: unknown, fallback: string): void => {
    bundle.loadError.value = messageOf(error, fallback);
  };
  // 动作失败：抽屉/表单内呈现在其中；列表行级动作呈现为独立告警，不隐藏列表。
  const actionFailed = (error: unknown, fallback: string): void => {
    if (bundle.selected.value !== null || bundle.activeForm.value !== null)
      bundle.submitError.value = messageOf(error, fallback);
    else bundle.actionError.value = messageOf(error, fallback);
  };
  // 非筛选态：沿用全量快照，并使在途的筛选请求过期。
  const showAll = (): void => {
    requestSequence += 1;
    bundle.actionError.value = '';
    bundle.items.value = bundle.snapshot.value;
    bundle.nextCursor.value = null;
    bundle.loadError.value = '';
    bundle.loading.value = false;
  };
  // 筛选态首页（服务端分页）。
  const reload = async (): Promise<void> => {
    const sequence = ++requestSequence;
    bundle.loading.value = true;
    try {
      const page = await ports.fetchPage(pageQuery());
      if (sequence !== requestSequence) return;
      bundle.items.value = page.items;
      bundle.nextCursor.value = page.nextCursor;
      bundle.loadError.value = '';
    } catch (error: unknown) {
      if (sequence === requestSequence) loadFailed(error, '物料加载失败');
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
      bundle.items.value = [...bundle.items.value, ...page.items];
      bundle.nextCursor.value = page.nextCursor;
      bundle.loadError.value = '';
    } catch (error: unknown) {
      if (sequence === requestSequence) loadFailed(error, '继续加载失败');
    } finally {
      bundle.loadingMore.value = false;
    }
  };
  // 全量刷新（controller.load——同步 vanilla BOM/路线表单依赖的已发布物料视图）
  // 后回到当前视图：筛选态重取服务端首页，否则沿用全量快照。
  const sync = async (): Promise<void> => {
    bundle.loading.value = true;
    try {
      bundle.snapshot.value = await ports.refresh();
      if (isFiltered()) await reload();
      else showAll();
    } catch (error: unknown) {
      loadFailed(error, '物料刷新失败');
      bundle.loading.value = false;
    }
  };
  // 详情读取：序号守卫——切换行/关闭抽屉后到达的旧响应丢弃（不写详情、不动加载态）。
  const reloadDetail = async (): Promise<void> => {
    const row = bundle.selected.value;
    const itemId = row ? ports.textValue(row.itemId, '') : '';
    if (!row || itemId === '') return;
    const sequence = ++detailSequence;
    bundle.detailLoading.value = true;
    try {
      const detail = await ports.loadDetail(itemId);
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
    bundle.specRows.value = [];
  };
  const settle = (): void => {
    if (isFiltered()) void reload();
    else showAll();
  };

  // 草稿发布走 legacy publish 端点（vanilla 卡片同链：提交后全量重读）。
  const runPublish = async (row: ItemRow): Promise<void> => {
    bundle.submitError.value = '';
    bundle.actionError.value = '';
    try {
      await ports.submit(
        `/api/v1/manufacturing-item-versions/${ports.textValue(row.id, '')}/publish`,
        {},
      );
      await sync();
      // 抽屉上下文保持为用户打开的那一版（以刷新后的行替换），随后重取详情。
      const opened = bundle.selected.value;
      if (opened) {
        const openedId = ports.textValue(opened.id, '');
        bundle.selected.value =
          bundle.snapshot.value.find(
            (candidate) => ports.textValue(candidate.id, '') === openedId,
          ) ?? opened;
        bundle.detail.value = null;
        await reloadDetail();
      }
    } catch (error: unknown) {
      actionFailed(error, '版本发布失败');
    }
  };

  // 创建载荷与原 vanilla「创建物料版本」表单逐字节一致（publish 恒 false；规格参数
  // 经 specificationOf 归一——预设数值键与十进制字面量转数值）。
  const runCreate = async (values: Readonly<Record<string, string>>): Promise<void> => {
    bundle.submitError.value = '';
    bundle.actionError.value = '';
    try {
      await ports.submit('/api/v1/manufacturing-items', {
        sku: values.sku ?? '',
        name: values.name ?? '',
        itemType: bundle.createType.value,
        baseUnitCode: values.baseUnitCode ?? '',
        specification: specificationOf(bundle.specRows.value, values),
        effectiveAt: `${values.effectiveAt ?? ''}T00:00:00.000Z`,
        publish: false,
      });
    } catch (error: unknown) {
      actionFailed(error, '物料创建失败');
      return;
    }
    // 提交成功即关闭表单（避免重复提交）；随后的全量刷新失败只报列表装载错误。
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
    open: (row: ItemRow | null): void => {
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
    addSpecRow: (preset: string): void => {
      specSequence += 1;
      bundle.specRows.value = [...bundle.specRows.value, { id: String(specSequence), preset }];
    },
    removeSpecRow: (id: string): void => {
      bundle.specRows.value = bundle.specRows.value.filter((row) => row.id !== id);
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
  state: ItemViewState,
  row: ItemRow,
  camel: string,
  snake: string,
  fallback = '',
): string => state.ports.recordText(row, camel, snake, fallback);

// 行状态文案与 vanilla 卡片逐字一致（e2e 黑盒契约：`已发布 · 第 N 版`）。
const versionText = (state: ItemViewState, row: ItemRow): string => {
  const status = text(state, row, 'status', 'status');
  const label = STATUS_LABELS[status] ?? state.ports.businessStateLabel(status);
  return `${label} · 第 ${text(state, row, 'version', 'version', '1')} 版`;
};

const columns = (state: ItemViewState): readonly DataTableColumn<ItemRow>[] => [
  {
    key: 'sku',
    header: '物料',
    sortable: true,
    field: (row) => text(state, row, 'sku', 'sku'),
    render: (row) => (
      <span class="mfg-item-cell">
        <strong data-testid="kt-item-sku">{text(state, row, 'sku', 'sku', '—')}</strong>
        <small class="mfg-muted">{text(state, row, 'name', 'name')}</small>
      </span>
    ),
  },
  {
    key: 'itemType',
    header: '类别',
    sortable: true,
    field: (row) => categoryLabel(text(state, row, 'itemType', 'itemType'), ''),
  },
  {
    key: 'specification',
    header: '规格参数',
    field: (row) =>
      specEntries(row.specification)
        .map(([key, value]) => `${key} ${value}`)
        .join(' '),
    render: (row) => <SpecChips specification={row.specification} />,
  },
  {
    key: 'baseUnitCode',
    header: '单位',
    field: (row) => text(state, row, 'baseUnitCode', 'baseUnitCode'),
  },
  {
    key: 'status',
    header: '版本状态',
    sortable: true,
    field: (row) => text(state, row, 'status', 'status'),
    render: (row) => (
      <StatusBadge tone={statusTone(row.status)}>{versionText(state, row)}</StatusBadge>
    ),
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
          data-testid="kt-item-open"
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
            data-testid="kt-item-publish"
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

// 左侧分类导航：全部物料 + 四类物料（计数按物料根去重）+ 版本状态筛选。
const CategoryTree = ({ state }: Readonly<{ state: ItemViewState }>) => {
  const entry = (value: ItemCategoryFilter, label: string, count: number) => (
    <li role="none">
      <button
        type="button"
        role="treeitem"
        aria-selected={state.category === value ? 'true' : 'false'}
        class={state.category === value ? 'mfg-tree-item active' : 'mfg-tree-item'}
        data-testid={`kt-item-category-${value.toLowerCase()}`}
        onClick={() => {
          state.selectCategory(value);
        }}
      >
        <span>{label}</span>
        <span class="mfg-tree-count">{String(count)}</span>
      </button>
    </li>
  );
  return (
    <aside class="console-split-tree" data-testid="kt-item-category-tree">
      <h3>物料分类</h3>
      <ul role="tree" aria-label="物料分类" class="mfg-category-tree">
        {entry(ALL_CATEGORIES, '全部物料', countAllItems(state.snapshot))}
        {ITEM_CATEGORIES.map((category) =>
          entry(
            category,
            CATEGORY_LABELS[category] ?? category,
            countByCategory(state.snapshot, category),
          ),
        )}
      </ul>
      <h3>版本状态</h3>
      <div class="console-filters mfg-status-filters" role="group" aria-label="版本状态">
        {STATUS_FILTERS.map((status) => (
          <button
            key={status}
            type="button"
            class={state.statusFilter === status ? 'secondary compact active' : 'secondary compact'}
            data-testid={`kt-item-status-${status.toLowerCase()}`}
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

// 关键字检索：回车/搜索提交后生效（服务端过滤），避免逐键请求。
const SearchBar = ({ state }: Readonly<{ state: ItemViewState }>) => (
  <form
    class="console-filters mfg-item-search"
    data-testid="kt-item-search-form"
    onSubmit={(event) => {
      event.preventDefault();
      state.applySearch();
    }}
  >
    <input
      type="search"
      placeholder="搜索物料编码或名称（回车搜索）"
      data-testid="kt-item-search"
      value={state.search}
      onInput={(event) => {
        state.setSearch((event.target as { value?: string }).value ?? '');
      }}
    />
    <button type="submit" class="secondary compact" data-testid="kt-item-search-submit">
      搜索
    </button>
    {state.search !== '' || state.appliedQuery !== '' ? (
      <button
        type="button"
        class="secondary compact"
        data-testid="kt-item-search-clear"
        onClick={state.clearSearch}
      >
        清除
      </button>
    ) : null}
    {state.appliedQuery !== '' ? (
      <span class="mfg-muted" data-testid="kt-item-search-applied">
        {`关键字：${state.appliedQuery}`}
      </span>
    ) : null}
  </form>
);

const ItemView = (state: ItemViewState) => (
  <div class="commercial-console-page" data-testid="kt-item-page">
    <PageHeader
      title="物料管理"
      description="按分类浏览物料规格版本；行级发布草稿，详情聚合版本历史、关联 BOM、工艺路线与最近工单"
      actions={
        <>
          <button
            type="button"
            class="secondary"
            data-testid="kt-item-refresh"
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
              data-testid="kt-item-create"
              onClick={state.openCreate}
            >
              ＋ 新建物料
            </button>
          ) : null}
        </>
      }
    />
    <div class="console-split mfg-item-split">
      <CategoryTree state={state} />
      <div class="console-split-main">
        <SearchBar state={state} />
        {state.loadError !== '' ? (
          <p class="console-error" role="alert" data-testid="kt-item-load-error">
            {state.loadError}
          </p>
        ) : null}
        {state.actionError !== '' ? (
          <p class="console-error" role="alert" data-testid="kt-item-action-error">
            {state.actionError}
          </p>
        ) : null}
        <DataTable
          columns={columns(state)}
          rows={state.items}
          rowId={(row) => state.ports.textValue(row.id ?? row.sku, 'row')}
          caption="物料版本主列表（编码、类别、规格参数与版本状态）"
          loading={state.loading}
          pagination={{
            loadedCount: state.items.length,
            hasMore: state.nextCursor !== null,
            loading: state.loadingMore,
            onLoadMore: () => {
              state.loadMore();
            },
          }}
          {...(state.loadError === '' ? {} : { error: state.loadError })}
          emptyTitle={state.filtered ? '没有符合条件的物料版本' : '暂无物料版本'}
          emptyDescription={
            state.filtered ? '调整分类、版本状态或关键字后重试' : '新建物料后会出现在这里'
          }
        />
      </div>
    </div>
    {state.selected ? <ItemDetailDrawer state={state} /> : null}
    {state.activeForm === 'create' ? <ItemCreateDrawer state={state} /> : null}
  </div>
);

export function ItemConsolePage(ports: ItemConsolePorts) {
  const bundle = createBundle(ports);
  const actions = createItemActions(ports, bundle);
  const mayManage = ports.permissions.has('manufacturing-item:manage');

  const state = (): ItemViewState => ({
    permissions: ports.permissions,
    ports,
    snapshot: bundle.snapshot.value,
    items: bundle.items.value,
    nextCursor: bundle.nextCursor.value,
    filtered: actions.isFiltered(),
    category: bundle.category.value,
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
    createType: bundle.createType.value,
    specRows: bundle.specRows.value,
    mayManage,
    selectCategory: (next) => {
      bundle.category.value = next;
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
    setCreateType: (next) => {
      bundle.createType.value = next;
    },
    addSpecRow: actions.addSpecRow,
    removeSpecRow: actions.removeSpecRow,
    runPublish: actions.runPublish,
    runCreate: actions.runCreate,
  });

  const Page = () => ItemView(state());
  return Page;
}
