// U3-MFG-4：工单控制台动作工厂（沿 routing-console-actions / bom-console-actions 先例）。
// 装载/筛选/分页/详情闭包（createProductionOrderLoaders）与变更闭包
//（createProductionOrderMutations：创建载荷 / 状态流转 / 车间执行）分离；bundle 为页面
// signal 束的最小面，请求序号守卫丢弃过期响应。
// U3-MFG-5：车间执行三张表单（工序报工 / 领退料 / 成品卷入库）的打开与提交——载荷与 legacy
// 表单同形（字段、类型、日期转换），幂等键由前端生成；提交成功后整站刷新一次并重读详情。
import type { Signal } from '@preact/signals';
import {
  ALL_STATUSES,
  byLegacyPriority,
  materialBatchesOf,
  PRODUCTION_ORDER_PAGE_SIZE,
  type ExecutionDraft,
  type ProductionOrderAction,
  type ProductionOrderExecution,
  type ProductionOrderForm,
  type ProductionOrderStatusFilter,
} from './production-order-state';
import type {
  ProductionOrderConsolePorts,
  ProductionOrderPageQuery,
  ProductionOrderRow,
} from './production-order-ports';
import { failureMessage } from '../../shared/api-error-message';

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
  notice: Signal<string>;
  selected: Signal<ProductionOrderRow | null>;
  detail: Signal<ProductionOrderRow | null>;
  detailLoading: Signal<boolean>;
  activeForm: Signal<ProductionOrderForm | null>;
  // 待执行的流转（行 + 动作）；流转抽屉打开期间非空。
  pending: Signal<Readonly<{ row: ProductionOrderRow; action: ProductionOrderAction }> | null>;
  // 当前打开的车间执行表单草稿；执行抽屉打开期间非空。
  execution: Signal<ExecutionDraft | null>;
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
  // 失败文案统一经 failureMessage：接口的常见英文消息转成中文，其余原样（TD-WF-006；MFG-3B 同款）。
  // 控制台自己抛出的中文提示（「开始时间格式不正确」等）不动。
  const messageOf = failureMessage;
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
      if (row !== null) bundle.notice.value = '';
      bundle.activeForm.value = null;
      bundle.pending.value = null;
      bundle.execution.value = null;
      bundle.submitError.value = '';
      bundle.detail.value = null;
      if (row === null) detailSequence += 1;
      else void reloadDetail();
    },
    // 打开车间执行表单：幂等键在此时生成一次（提交失败后重试沿用同一把键）；领退料的批次
    // 候选也在此刻定下（下拉 value 是候选序号，提交时按同一份候选取批次）。
    openExecution: (kind: ProductionOrderExecution): void => {
      const row = bundle.selected.value;
      if (!row) return;
      bundle.notice.value = '';
      bundle.activeForm.value = kind;
      bundle.pending.value = null;
      bundle.submitError.value = '';
      bundle.execution.value = {
        kind,
        // 成品卷入库端点没有幂等键；报工与领退料的键在此时生成一次。
        idempotencyKey:
          kind === 'output'
            ? ''
            : ports.nextIdempotencyKey(
                ports.recordText(row, 'orderNumber', 'order_number'),
                kind === 'report' ? 'RPT' : 'MAT',
              ),
        material: materialBatchesOf(bundle.detail.value, ports.inventoryBalances()),
      };
    },
    openCreate: (): void => {
      bundle.notice.value = '';
      bundle.activeForm.value = 'create';
      bundle.pending.value = null;
      bundle.submitError.value = '';
    },
    openTransition: (row: ProductionOrderRow, action: ProductionOrderAction): void => {
      // 流转抽屉独立于详情抽屉：不置 selected，两个抽屉不会同时渲染。
      bundle.notice.value = '';
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
// vanilla 流转表单逐字节一致，经现代化统一动作端点 PUT /:id/state）、车间执行（工序报工 /
// 领退料 / 成品卷入库：载荷与 vanilla 表单同形，幂等键由前端生成）。装载侧 io 经注入。
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
    bundle.execution.value = null;
    bundle.submitError.value = '';
  };
  // 非 Error 拒绝（拿不到消息）时的兜底提示。
  const FALLBACK_OF: Readonly<Record<ProductionOrderExecution, string>> = {
    report: '工序报工失败',
    material: '领料/退料失败',
    output: '成品卷入库失败',
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
    bundle.notice.value = `已创建工单 ${input.orderNumber ?? ''}`;
  };

  // 提交成功后的收尾：关表单 → 整站刷新一次 → 详情抽屉仍开着就重读详情（工序进度、物料
  // 台账、报工记录、成品序列随之就地更新）。
  const committed = async (notice: string): Promise<void> => {
    closeForm();
    await io.sync();
    if (bundle.selected.value) {
      bundle.detail.value = null;
      await io.reloadDetail();
    }
    bundle.notice.value = notice;
  };
  // 日期时间输入按本地时间解析后转 UTC ISO（与 legacy 表单的 new Date(value).toISOString()
  // 同式）；无效值在提交前拦下——不触达服务端、不刷新。
  const timestampOf = (value: string, label: string): string => {
    const parsed = new Date(value);
    if (!Number.isFinite(parsed.getTime())) throw new Error(`${label}格式不正确，请重新选择`);
    return parsed.toISOString();
  };
  const transitionMessage = {
    release: '已下达',
    start: '已开始生产',
    complete: '已完工',
    close: '已关闭',
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
    // 详情抽屉仍开着（抽屉内发起的流转）：sync 已把行换成刷新后的对象，再重读详情。
    await committed(`工单 ${orderNumber} ${transitionMessage[action]}`);
  };

  // 车间执行提交。载荷与 legacy 表单同形、键序相同：
  // - 工序报工 = 表单八字段（值 trim）+ 两个时间转 ISO + 幂等键（前端生成，取代旧表单里
  //   手填的「报工唯一键」）；
  // - 领退料 = 业务类型 + 所选批次的物料版本 / 批次 / 库位 + 数量 + 原因 + 时间 + 幂等键
  //  （前端生成，取代手填的「业务唯一键」）；批次取自打开表单时定下的候选；
  // - 成品卷入库 = 表单六字段（值 trim）+ 工单成品版本（该端点没有幂等键）。
  const runExecution = async (values: Readonly<Record<string, string>>): Promise<void> => {
    const row = bundle.selected.value;
    const draft = bundle.execution.value;
    if (!row || !draft) return;
    // 只有当前打开的正是这张表单时才提交（防陈旧回调）。
    if (bundle.activeForm.value !== draft.kind) return;
    bundle.submitError.value = '';
    bundle.actionError.value = '';
    const input = trimmed(values);
    const orderId = ports.textValue(row.id, '');
    const path = `/api/v1/production-orders/${orderId}`;
    try {
      if (draft.kind === 'report')
        await ports.submit(`${path}/operation-reports`, {
          ...input,
          startedAt: timestampOf(input.startedAt ?? '', '开始时间'),
          completedAt: timestampOf(input.completedAt ?? '', '完成时间'),
          idempotencyKey: draft.idempotencyKey,
        });
      else if (draft.kind === 'material') await postMaterial(input, draft, path);
      else
        await ports.submit(`${path}/finished-rolls`, {
          ...input,
          itemVersionId: ports.recordText(row, 'itemVersionId', 'item_version_id'),
        });
    } catch (error: unknown) {
      io.actionFailed(error, FALLBACK_OF[draft.kind]);
      return;
    }
    const materialNotice = input.transactionType === 'RETURN' ? '已登记退料' : '已登记领料';
    await committed(
      { report: '已登记工序报工', material: materialNotice, output: '已登记成品卷入库' }[
        draft.kind
      ],
    );
  };
  // legacy 同式的无效选择守卫：候选序号不是非负整数或超出候选范围时报「请选择有效批次库位」。
  const postMaterial = async (
    input: Readonly<Record<string, string>>,
    draft: ExecutionDraft,
    path: string,
  ): Promise<void> => {
    const index = Number(input.balance);
    const balance =
      input.balance === undefined || input.balance === '' || !Number.isInteger(index)
        ? undefined
        : draft.material.balances[index];
    if (!balance) throw new Error('请选择有效批次库位');
    await ports.submit(`${path}/materials`, {
      transactionType: input.transactionType ?? '',
      itemVersionId: balance.itemVersionId,
      lotId: balance.lotId,
      locationId: balance.locationId,
      quantity: input.quantity ?? '',
      reason: input.reason ?? '',
      occurredAt: timestampOf(input.occurredAt ?? '', '发生时间'),
      idempotencyKey: draft.idempotencyKey,
    });
  };

  return { closeForm, runCreate, runTransition, runExecution };
}
