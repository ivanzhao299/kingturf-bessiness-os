// U3-MFG-4：工单控制台共享展示契约——状态词表、行级下一步动作表、legacy 默认排序、
// 完工进度推算与视图状态类型。U3-MFG-5：车间执行表单草稿、执行入口的出现条件，以及领退料
// 「批次库位」的候选范围（TD-MFG-010：只列属于工单 BOM 的批次）。
import type { StatusTone } from '@kingturf/ui';
import type { ProductionOrderConsolePorts, ProductionOrderRow } from './production-order-ports';

export type ProductionOrderStatus =
  | 'DRAFT'
  | 'RELEASED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CLOSED'
  | 'CANCELLED';
export type ProductionOrderStatusFilter = 'ALL' | ProductionOrderStatus;
// 行级状态流转动作（PUT /api/v1/production-orders/:id/state 的 action）。与 vanilla 卡片
// 的四个按钮逐一对应；legacy 另有 cancel 写路径，vanilla 从未暴露，本批不新增入口。
export type ProductionOrderAction = 'release' | 'start' | 'complete' | 'close';
// 车间执行表单：工序报工 / 领料退料 / 成品卷入库。
export type ProductionOrderExecution = 'report' | 'material' | 'output';
export type ProductionOrderForm = 'create' | 'transition' | ProductionOrderExecution;
// 一次打开的执行表单草稿：幂等键在打开时生成一次（提交失败后重试沿用同一把键）；领退料的
// 批次候选在打开时定下（下拉的 value 是候选序号，提交时按同一份候选取批次）。成品卷入库
// 端点没有幂等键（唯一性由卷号 / 批次号约束），其草稿的 idempotencyKey 为空串。
export type ExecutionDraft = Readonly<{
  kind: ProductionOrderExecution;
  idempotencyKey: string;
  material: MaterialBatchScope;
}>;
// 领退料「批次库位」候选及其依据：bom = 按工单物料需求过滤；no-bom = 工单成品没有已发布
// BOM（没有可领的批次）；unknown = 详情响应不带 materialRequirements（账号没有 bom:read，
// 或详情未到达 / 读取失败），列出全部并由表单说明可能被拒绝。
export type MaterialBatchScope = Readonly<{
  balances: readonly ProductionOrderRow[];
  basis: 'bom' | 'no-bom' | 'unknown';
}>;
export const materialBatchesOf = (
  detail: ProductionOrderRow | null,
  balances: readonly ProductionOrderRow[],
): MaterialBatchScope => {
  if (!Array.isArray(detail?.materialRequirements)) return { balances, basis: 'unknown' };
  const components = new Set(
    records(detail.materialRequirements).map((item) => idOf(item.componentItemVersionId)),
  );
  return {
    balances: balances.filter((item) => components.has(idOf(item.itemVersionId))),
    basis: components.size > 0 ? 'bom' : 'no-bom',
  };
};
// 车间执行入口及其出现条件——与 legacy appendProductionReport / Material / Output 逐条一致：
// 工序报工 = production:report 且进行中；领料/退料 = production:material 且已放行或进行中；
// 成品卷入库 = production:report 且进行中且已有报工。顺序同 legacy（报工、领退料、成品卷入库）。
export type ExecutionEntry = Readonly<{ kind: ProductionOrderExecution; label: string }>;
export const EXECUTION_ENTRIES: Readonly<Record<ProductionOrderExecution, ExecutionEntry>> = {
  report: { kind: 'report', label: '＋ 工序报工' },
  material: { kind: 'material', label: '＋ 领料/退料' },
  output: { kind: 'output', label: '＋ 成品卷入库' },
};
export const availableExecutions = (
  permissions: ReadonlySet<string>,
  status: string,
  reportCount: number,
): readonly ExecutionEntry[] => {
  const running = status === 'IN_PROGRESS';
  const entries: ExecutionEntry[] = [];
  if (permissions.has('production:report') && running) entries.push(EXECUTION_ENTRIES.report);
  if (permissions.has('production:material') && (status === 'RELEASED' || running))
    entries.push(EXECUTION_ENTRIES.material);
  if (permissions.has('production:report') && running && reportCount > 0)
    entries.push(EXECUTION_ENTRIES.output);
  return entries;
};

// 汇总卡与筛选条按作业队列顺序排列（与 legacy 默认视图排序一致）。
export const STATUS_FILTERS: readonly ProductionOrderStatusFilter[] = [
  'ALL',
  'IN_PROGRESS',
  'RELEASED',
  'COMPLETED',
  'DRAFT',
  'CLOSED',
  'CANCELLED',
];
export const STATUS_LABELS: Readonly<Record<string, string>> = {
  DRAFT: '草稿',
  RELEASED: '已放行',
  IN_PROGRESS: '进行中',
  COMPLETED: '已完成',
  CLOSED: '已关闭',
  CANCELLED: '已取消',
};
export const statusTone = (status: unknown): StatusTone => {
  if (status === 'IN_PROGRESS') return 'info';
  if (status === 'COMPLETED') return 'success';
  if (status === 'CANCELLED') return 'danger';
  if (status === 'RELEASED' || status === 'DRAFT') return 'warning';
  return 'neutral';
};

// vanilla 卡片的四个流转按钮（状态 → 动作 / 文案 / 能力键），与 legacy
// production-actions.ts 的 transitions 表同值；前态约束的权威在 DB 触发器（迁移 0042）。
export const NEXT_ACTION: Readonly<
  Record<
    string,
    Readonly<{ action: ProductionOrderAction; label: string; capability: string }> | null
  >
> = {
  DRAFT: { action: 'release', label: '下达工单', capability: 'production:plan' },
  RELEASED: { action: 'start', label: '开始生产', capability: 'production:report' },
  IN_PROGRESS: { action: 'complete', label: '完工确认', capability: 'production:close' },
  COMPLETED: { action: 'close', label: '关闭工单', capability: 'production:close' },
  CLOSED: null,
  CANCELLED: null,
};
export const nextActionOf = (status: unknown) => NEXT_ACTION[String(status)] ?? null;

// legacy 默认视图排序（production-orders-view.ts 的 productionPriority：进行中 → 已放行
// → 已完成 → 草稿 → 已关闭，未知状态殿后并保持快照原序）。
const LEGACY_PRIORITY: Readonly<Record<string, number>> = {
  IN_PROGRESS: 0,
  RELEASED: 1,
  COMPLETED: 2,
  DRAFT: 3,
  CLOSED: 4,
};
export const byLegacyPriority = (
  rows: readonly ProductionOrderRow[],
  stateOf: (row: ProductionOrderRow) => string,
): readonly ProductionOrderRow[] =>
  [...rows].sort(
    (left, right) => (LEGACY_PRIORITY[stateOf(left)] ?? 9) - (LEGACY_PRIORITY[stateOf(right)] ?? 9),
  );

const isRecord = (value: unknown): value is ProductionOrderRow =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
export const records = (value: unknown): readonly ProductionOrderRow[] =>
  Array.isArray(value) ? value.filter(isRecord) : [];
// 行投影取值的安全字符串化/数值化（JsonObject 值 unknown；非有限数值按 0）。
export const textOf = (value: unknown): string => (typeof value === 'string' ? value : '');
// 行投影 id 的安全字符串化（uuid 字符串；非字符串一律空串，不做对象字符串化）。
export const idOf = (value: unknown): string =>
  typeof value === 'string' ? value : typeof value === 'number' ? String(value) : '';
export const quantityOf = (value: unknown): number => {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};
// 数量展示：至多 6 位小数、去尾零（与 legacy recordText 对数值的呈现一致）。
export const formatQuantity = (value: unknown): string =>
  String(Number(quantityOf(value).toFixed(6)));

export type OperationProgress = Readonly<{
  id: string;
  sequence: number;
  code: string;
  name: string;
  workCenter: string;
  good: number;
  scrap: number;
  reportCount: number;
  ratio: number;
  completed: boolean;
}>;
export type OrderProgress = Readonly<{
  planned: number;
  completed: number;
  ratio: number;
  operations: readonly OperationProgress[];
}>;

// 完工进度与完工门禁同口径（迁移 0042：每道工序累计良品 ≥ 计划数量）——工单级「已完成
// 数」取各工序累计良品（封顶计划数量）的最小值，最小值到达计划数量即门禁的数量条件
// 满足。legacy 没有工单级完成数，这是 additive 的呈现口径。
export const progressOf = (row: ProductionOrderRow): OrderProgress => {
  const planned = quantityOf(row.planned_quantity);
  const reports = records(row.reports);
  const operations = records(row.operations)
    .map((operation) => {
      const own = reports.filter(
        (report) => idOf(report.production_order_operation_id) === idOf(operation.id),
      );
      const good = own.reduce((sum, report) => sum + quantityOf(report.good_quantity), 0);
      return {
        id: idOf(operation.id),
        sequence: quantityOf(operation.sequence),
        code: textOf(operation.operation_code),
        name: textOf(operation.name),
        workCenter: textOf(operation.work_center),
        good,
        scrap: own.reduce((sum, report) => sum + quantityOf(report.scrap_quantity), 0),
        reportCount: own.length,
        ratio: planned > 0 ? Math.min(1, good / planned) : 0,
        completed: good >= planned,
      };
    })
    .sort((left, right) => left.sequence - right.sequence);
  const completed =
    operations.length > 0
      ? Math.min(...operations.map((operation) => Math.min(operation.good, planned)))
      : 0;
  return {
    planned,
    completed,
    ratio: planned > 0 ? Math.min(1, completed / planned) : 0,
    operations,
  };
};

// 筛选态分页窗口（显式 limit 才启用服务端游标；默认视图为路由加载的全量快照）。
export const PRODUCTION_ORDER_PAGE_SIZE = 50;
export const ALL_STATUSES = 'ALL' as const;

export type ProductionOrderViewState = Readonly<{
  permissions: ReadonlySet<string>;
  ports: ProductionOrderConsolePorts;
  snapshot: readonly ProductionOrderRow[];
  orders: readonly ProductionOrderRow[];
  nextCursor: string | null;
  filtered: boolean;
  statusFilter: ProductionOrderStatusFilter;
  search: string;
  appliedQuery: string;
  loading: boolean;
  loadingMore: boolean;
  loadError: string;
  actionError: string;
  submitError: string;
  notice: string;
  selected: ProductionOrderRow | null;
  detail: ProductionOrderRow | null;
  detailLoading: boolean;
  activeForm: ProductionOrderForm | null;
  pending: Readonly<{ row: ProductionOrderRow; action: ProductionOrderAction }> | null;
  mayCreate: boolean;
  setStatusFilter: (next: ProductionOrderStatusFilter) => void;
  setSearch: (next: string) => void;
  applySearch: () => void;
  clearSearch: () => void;
  loadMore: () => void;
  runRefresh: () => Promise<void>;
  open: (row: ProductionOrderRow | null) => void;
  openCreate: () => void;
  openTransition: (row: ProductionOrderRow, action: ProductionOrderAction) => void;
  closeForm: () => void;
  runTransition: (values: Readonly<Record<string, string>>) => Promise<void>;
  runCreate: (values: Readonly<Record<string, string>>) => Promise<void>;
  // 当前打开的执行表单草稿（activeForm 为执行表单种类时非空）。
  execution: ExecutionDraft | null;
  openExecution: (kind: ProductionOrderExecution) => void;
  runExecution: (values: Readonly<Record<string, string>>) => Promise<void>;
}>;
