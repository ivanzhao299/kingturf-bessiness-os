// U3-MFG-3：工艺路线控制台共享展示契约——产品类型词表（复用 BOM 口径）、状态词表、
// 工序编辑器行模型、纯展示助手与视图状态类型。
import type { StatusTone } from '@kingturf/ui';
import type { ConfirmSignal } from './console-confirm';
import type { RoutingConsolePorts, RoutingRow } from './routing-ports';

export type RoutingProductFilter = 'ALL' | 'FINISHED_GOOD' | 'SEMI_FINISHED';
export type RoutingStatusFilter = 'ALL' | 'DRAFT' | 'PUBLISHED' | 'RETIRED';

export const PRODUCT_FILTERS: readonly RoutingProductFilter[] = [
  'ALL',
  'FINISHED_GOOD',
  'SEMI_FINISHED',
];
export const PRODUCT_LABELS: Readonly<Record<string, string>> = {
  FINISHED_GOOD: '成品',
  SEMI_FINISHED: '半成品',
};
export const STATUS_FILTERS: readonly RoutingStatusFilter[] = [
  'ALL',
  'DRAFT',
  'PUBLISHED',
  'RETIRED',
];
export const STATUS_LABELS: Readonly<Record<string, string>> = {
  DRAFT: '草稿',
  PUBLISHED: '已发布',
  RETIRED: '已退役',
};
// 筛选态分页窗口（显式 limit 才启用服务端游标；默认视图为路由加载的全量快照）。
export const ROUTING_PAGE_SIZE = 50;
export const ALL_PRODUCTS = 'ALL' as const;

// 工序编辑器行标识：'o1' 恒为首工序行（字段名与 legacy 表单逐字节对齐），追加行
// 'o2'… 带前缀；上移/下移交换数组位置，载荷 sequence 按 10/20/30… 重排。
export type OperationRowId = string;

export type RoutingViewState = Readonly<{
  permissions: ReadonlySet<string>;
  ports: RoutingConsolePorts;
  snapshot: readonly RoutingRow[];
  routings: readonly RoutingRow[];
  nextCursor: string | null;
  filtered: boolean;
  productFilter: RoutingProductFilter;
  statusFilter: RoutingStatusFilter;
  search: string;
  appliedQuery: string;
  loading: boolean;
  loadingMore: boolean;
  loadError: string;
  actionError: string;
  submitError: string;
  selected: RoutingRow | null;
  detail: RoutingRow | null;
  detailLoading: boolean;
  activeForm: 'create' | null;
  operationRows: readonly OperationRowId[];
  mayManage: boolean;
  // TD-WF-014②：等待确认的不可逆动作（发布版本）；null 表示没有确认框。
  confirm: ConfirmSignal;
  selectProduct: (next: RoutingProductFilter) => void;
  setStatusFilter: (next: RoutingStatusFilter) => void;
  setSearch: (next: string) => void;
  applySearch: () => void;
  clearSearch: () => void;
  loadMore: () => void;
  runRefresh: () => Promise<void>;
  open: (row: RoutingRow | null) => void;
  openCreate: () => void;
  closeForm: () => void;
  runPublish: (row: RoutingRow) => Promise<void>;
  addOperationRow: () => void;
  removeOperationRow: (id: OperationRowId) => void;
  moveOperationRow: (id: OperationRowId, direction: 'up' | 'down') => void;
  runCreate: (values: Readonly<Record<string, string>>) => Promise<void>;
}>;

export const statusTone = (status: unknown): StatusTone => {
  if (status === 'PUBLISHED') return 'success';
  if (status === 'DRAFT') return 'info';
  return 'neutral';
};

const recordOf = (value: unknown): RoutingRow =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as RoutingRow) : {};
export const routingRecords = (value: unknown): readonly RoutingRow[] =>
  Array.isArray(value) ? value.map(recordOf) : [];

// 工序展示行（sequence 升序由服务端投影保证）。
export const routingOperations = (row: RoutingRow | null): readonly RoutingRow[] =>
  routingRecords(row?.operations);

export const versionHead = (state: RoutingViewState, version: RoutingRow): string => {
  const status = state.ports.textValue(version.status, '');
  return `v${state.ports.textValue(version.version, '?')} ${STATUS_LABELS[status] ?? state.ports.businessStateLabel(status)}`;
};

// 工序编辑器行 → operations 载荷：sequence 按行序 10/20/30… 重排。字段名一律带
// 行前缀（`${row}:${name}`）——首工序行的 name/名称与路线级字段同名，FormSection
// 按字段名存状态会互相覆盖（vanilla 表单无逐工序字段故无此冲突）；载荷形状不受
// 字段名影响，与 vanilla 单工序载荷逐字节一致。
export const operationsOf = (
  rows: readonly OperationRowId[],
  values: Readonly<Record<string, string>>,
): readonly Record<string, unknown>[] =>
  rows.map((row, index) => {
    const field = (name: string): string => values[`${row}:${name}`] ?? '';
    return {
      operationCode: field('operationCode'),
      name: field('name'),
      workCenterCode: field('workCenterCode'),
      sequence: (index + 1) * 10,
      setupMinutes: field('setupMinutes'),
      runMinutesPerUnit: field('runMinutesPerUnit'),
      instructions: {},
    };
  });
