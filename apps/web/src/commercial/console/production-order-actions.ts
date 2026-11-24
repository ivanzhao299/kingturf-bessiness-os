// U3-MFG-4：工单控制台动作工厂（沿 routing-console-actions / bom-console-actions 先例）。
// 装载/筛选/分页/详情闭包（createProductionOrderLoaders）与变更闭包
//（createProductionOrderMutations：创建载荷 / 状态流转）分离；bundle 为页面 signal 束的
// 最小面，请求序号守卫丢弃过期响应。
import type { Signal } from '@preact/signals';
import {
  ALL_STATUSES,
  byLegacyPriority,
  PRODUCTION_ORDER_PAGE_SIZE,
  type ProductionOrderAction,
  type ProductionOrderForm,
  type ProductionOrderStatusFilter,
} from './production-order-state';
import type {
  ProductionOrderConsolePorts,
  ProductionOrderPageQuery,
  ProductionOrderRow,
} from './production-order-ports';

export type ProductionOrderBundle = Readonly<{
  snapshot: Signal<readonly ProductionOrderRow[]>;
  orders: Signal<readonly ProductionOrderRow[]>;
  nextCursor: Signal<string | null>;
  statusFilter: Signal<ProductionOrderStatusFilter>;
  search: Signal<string>;
  appliedQuery: Signal<string>;
  loading: Signal<boolean>;
  loadingMore: Signal<boolean>;
  loadError: Signal<string>;
  actionError: Signal<string>;
  submitError: Signal<string>;
  selected: Signal<ProductionOrderRow | null>;
  detail: Signal<ProductionOrderRow | null>;
  detailLoading: Signal<boolean>;
  activeForm: Signal<ProductionOrderForm | null>;
  // 待执行的流转（行 + 动作）；流转抽屉打开期间非空。
  pending: Signal<Readonly<{ row: ProductionOrderRow; action: ProductionOrderAction }> | null>;
}>;

// 装载/筛选/分页/详情闭包（变更动作经 createProductionOrderMutations 注入 io）。
export function createProductionOrderLoaders(
  ports: ProductionOrderConsolePorts,
  bundle: ProductionOrderBundle,
) {
  let requestSequence = 0;
  let detailSequence = 0;
  const stateOf = (row: ProductionOrderRow): string => ports.recordText(row, 'state', 'state');
  const isFiltered = (): boolean =>
    bundle.statusFilter.value !== ALL_STATUSES || bundle.appliedQuery.value !== '';
  const pageQuery = (cursor?: string): ProductionOrderPageQuery => ({
    ...(bundle.statusFilter.value === ALL_STATUSES ? {} : { state: bundle.statusFilter.value }),
    ...(bundle.appliedQuery.value === '' ? {} : { query: bundle.appliedQuery.value }),
    limit: PRODUCTION_ORDER_PAGE_SIZE,
    ...(cursor ? { cursor } : {}),
  });
  const messageOf = (error: unknown, fallback: string): string =>
    error instanceof Error ? error.message : fallback;
  const loadFailed = (error: unknown, fallback: string): void => {
    bundle.loadError.value = messageOf(error, fallback);
  };
  const actionFailed = (error: unknown, fallback: string): void => {
    // 抽屉/表单开着时错误就近显示在抽屉里，否则显示在列表上方。
    if (bundle.selected.value !== null || bundle.activeForm.value !== null)
      bundle.submitError.value = messageOf(error, fallback);
    else bundle.actionError.value = messageOf(error, fallback);
  };
  const showAll = (): void => {
    requestSequence += 1;
    bundle.actionError.value = '';
    // 默认视图沿用 legacy 卡片的作业队列排序（进行中 → 已放行 → 已完成 → 草稿 → 已关闭）。
    bundle.orders.value = byLegacyPriority(bundle.snapshot.value, stateOf);
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
      bundle.orders.value = page.items;
      bundle.nextCursor.value = page.nextCursor;
      bundle.loadError.value = '';
    } catch (error: unknown) {
      if (sequence === requestSequence) loadFailed(error, '工单加载失败');
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
      bundle.orders.value = [...bundle.orders.value, ...page.items];
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
      // 已打开的行换成刷新后的行对象（车间执行按钮随之重挂，拿到最新的报工/物料数据）。
      const opened = bundle.selected.value;
      if (opened)
        bundle.selected.value =
          bundle.snapshot.value.find(
            (candidate) => ports.textValue(candidate.id, '') === ports.textValue(opened.id, ''),
          ) ?? opened;
      if (isFiltered()) await reload();
      else showAll();
    } catch (error: unknown) {
      loadFailed(error, '工单刷新失败');
      bundle.loading.value = false;
    }
  };
  const reloadDetail = async (): Promise<void> => {
    const row = bundle.selected.value;
    const orderId = row ? ports.textValue(row.id, '') : '';
    if (!row || orderId === '') return;
    const sequence = ++detailSequence;
    bundle.detailLoading.value = true;
    try {
      const detail = await ports.loadDetail(orderId);
      if (sequence === detailSequence && detail) bundle.detail.value = detail;
    } catch {
      // 详情读取失败静默回退列表行数据。
    } finally {
      if (sequence === detailSequence) bundle.detailLoading.value = false;
    }
  };
  const settle = (): void => {
    if (isFiltered()) void reload();
    else showAll();
  };

  return {
    isFiltered,
    sync,
    settle,
    loadMore,
    reloadDetail,
    actionFailed,
    open: (row: ProductionOrderRow | null): void => {
      bundle.selected.value = row;
      bundle.activeForm.value = null;
      bundle.pending.value = null;
      bundle.submitError.value = '';
      bundle.detail.value = null;
      if (row === null) detailSequence += 1;
      else void reloadDetail();
    },
    openCreate: (): void => {
      bundle.activeForm.value = 'create';
      bundle.pending.value = null;
      bundle.submitError.value = '';
    },
    openTransition: (row: ProductionOrderRow, action: ProductionOrderAction): void => {
      // 流转抽屉独立于详情抽屉：不置 selected，两个抽屉不会同时渲染。
      bundle.activeForm.value = 'transition';
      bundle.pending.value = { row, action };
      bundle.submitError.value = '';
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

// 变更动作工厂：创建（载荷与 vanilla「建立生产工单」表单逐字节一致）、状态流转（载荷与
// vanilla 流转表单逐字节一致，经现代化统一动作端点 PUT /:id/state）。装载侧 io 经注入。
export function createProductionOrderMutations(
  ports: ProductionOrderConsolePorts,
  bundle: ProductionOrderBundle,
  io: Readonly<{
    sync: () => Promise<void>;
    reloadDetail: () => Promise<void>;
    actionFailed: (error: unknown, fallback: string) => void;
  }>,
) {
  const closeForm = (): void => {
    bundle.activeForm.value = null;
    bundle.pending.value = null;
    bundle.submitError.value = '';
  };
  // vanilla openForm 提交前对每个值 trim；FormSection 不 trim，这里补齐以保持载荷一致。
  const trimmed = (values: Readonly<Record<string, string>>): Readonly<Record<string, string>> =>
    Object.fromEntries(Object.entries(values).map(([key, value]) => [key, value.trim()]));

  const runCreate = async (values: Readonly<Record<string, string>>): Promise<void> => {
    bundle.submitError.value = '';
    bundle.actionError.value = '';
    const input = trimmed(values);
    try {
      // mrpProposalId 留空时以 undefined 占位——JSON 序列化丢弃该键，与 legacy 表单同式。
      await ports.submit('/api/v1/production-orders', {
        ...input,
        ...(input.mrpProposalId ? {} : { mrpProposalId: undefined }),
      });
    } catch (error: unknown) {
      io.actionFailed(error, '工单创建失败');
      return;
    }
    closeForm();
    await io.sync();
  };

  const runTransition = async (values: Readonly<Record<string, string>>): Promise<void> => {
    const pending = bundle.pending.value;
    if (!pending) return;
    const { row, action } = pending;
    bundle.submitError.value = '';
    bundle.actionError.value = '';
    // noUncheckedIndexedAccess：索引访问得 string | undefined，回退空串由服务端负例兜底。
    const input = trimmed(values);
    const reason = input.reason ?? '';
    const evidenceReference = input.evidenceReference ?? '';
    const orderId = ports.textValue(row.id, '');
    const orderNumber = ports.recordText(row, 'orderNumber', 'order_number');
    try {
      await ports.submit(
        `/api/v1/production-orders/${orderId}/state`,
        {
          action,
          reason,
          evidence: { reference: evidenceReference },
          idempotencyKey: `${orderNumber}-${action.toUpperCase()}-${evidenceReference}`,
        },
        'PUT',
      );
    } catch (error: unknown) {
      io.actionFailed(error, '状态流转失败');
      return;
    }
    closeForm();
    await io.sync();
    // 详情抽屉仍开着（抽屉内发起的流转）：sync 已把行换成刷新后的对象，再重读详情。
    if (bundle.selected.value) {
      bundle.detail.value = null;
      await io.reloadDetail();
    }
  };

  return { closeForm, runCreate, runTransition };
}
