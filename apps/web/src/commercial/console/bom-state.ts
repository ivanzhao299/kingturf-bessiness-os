// U3-MFG-2：BOM 控制台共享展示契约——产品类型词表、版本对比纯函数（新增/删除/
// 变化三类差异）、层级树展平助手与视图状态类型（页面工厂、详情抽屉、新建抽屉共用；
// 不持有运行时状态）。
import type { StatusTone } from '@kingturf/ui';
import type { ConfirmSignal } from './console-confirm';
import type { BomConsolePorts, BomRow } from './bom-ports';

export type BomProductFilter = 'ALL' | 'FINISHED_GOOD' | 'SEMI_FINISHED';
export type BomStatusFilter = 'ALL' | 'DRAFT' | 'PUBLISHED' | 'RETIRED';

export const PRODUCT_FILTERS: readonly BomProductFilter[] = [
  'ALL',
  'FINISHED_GOOD',
  'SEMI_FINISHED',
];
export const PRODUCT_LABELS: Readonly<Record<string, string>> = {
  FINISHED_GOOD: '成品',
  SEMI_FINISHED: '半成品',
  RAW_MATERIAL: '原材料',
  PACKAGING: '包装物',
};
export const STATUS_FILTERS: readonly BomStatusFilter[] = ['ALL', 'DRAFT', 'PUBLISHED', 'RETIRED'];
export const STATUS_LABELS: Readonly<Record<string, string>> = {
  DRAFT: '草稿',
  PUBLISHED: '已发布',
  RETIRED: '已退役',
};
// 筛选态分页窗口（显式 limit 才启用服务端游标；默认视图为路由加载的全量快照）。
export const BOM_PAGE_SIZE = 50;
export const ALL_PRODUCTS = 'ALL' as const;

export type BomViewState = Readonly<{
  permissions: ReadonlySet<string>;
  ports: BomConsolePorts;
  // 全量快照（默认视图行与产品类型计数据此呈现）与当前展示行（筛选态为服务端分页行）。
  snapshot: readonly BomRow[];
  boms: readonly BomRow[];
  nextCursor: string | null;
  filtered: boolean;
  productFilter: BomProductFilter;
  statusFilter: BomStatusFilter;
  search: string;
  appliedQuery: string;
  loading: boolean;
  loadingMore: boolean;
  loadError: string;
  actionError: string;
  submitError: string;
  selected: BomRow | null;
  detail: BomRow | null;
  detailLoading: boolean;
  activeForm: 'create' | null;
  versionSource: BomRow | null;
  openVersion: (row: BomRow) => void;
  // 组件行标识（'r1' 恒为首个组件行；追加行 'r2'…——字段名 r1 用裸名，后续行带前缀）。
  substituteRows: Readonly<Record<string, readonly string[]>>;
  addSubstitute: (row: string) => void;
  removeSubstitute: (row: string, substitute: string) => void;
  componentRows: readonly string[];
  compareVersions: readonly [string, string] | null;
  // 组件层级树折叠集合（bomVersionId）；默认全展开。
  collapsed: ReadonlySet<string>;
  // TD-WF-014①：最近一次写操作的成功提示。
  notice: string;
  mayManage: boolean;
  // TD-WF-014②：等待确认的不可逆动作（发布版本）；null 表示没有确认框。
  confirm: ConfirmSignal;
  selectProduct: (next: BomProductFilter) => void;
  setStatusFilter: (next: BomStatusFilter) => void;
  setSearch: (next: string) => void;
  applySearch: () => void;
  clearSearch: () => void;
  loadMore: () => void;
  runRefresh: () => Promise<void>;
  open: (row: BomRow | null) => void;
  openCreate: () => void;
  closeForm: () => void;
  runPublish: (row: BomRow) => Promise<void>;
  setCompareVersions: (next: readonly [string, string] | null) => void;
  toggleNode: (bomVersionId: string) => void;
  addComponentRow: () => void;
  removeComponentRow: (id: string) => void;
  runCreate: (values: Readonly<Record<string, string>>) => Promise<void>;
}>;

export const productLabel = (value: unknown, fallback = '—'): string =>
  PRODUCT_LABELS[String(value)] ?? fallback;

export const statusTone = (status: unknown): StatusTone => {
  if (status === 'PUBLISHED') return 'success';
  if (status === 'DRAFT') return 'info';
  return 'neutral';
};

const recordOf = (value: unknown): BomRow =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as BomRow) : {};
const recordsOf = (value: unknown): readonly BomRow[] =>
  Array.isArray(value) ? value.map(recordOf) : [];
const textOf = (value: unknown, fallback = ''): string =>
  typeof value === 'string' ? value : typeof value === 'number' ? String(value) : fallback;

export const bomLines = (row: BomRow | null): readonly BomRow[] => recordsOf(row?.lines);
export const bomVersions = (detail: BomRow | null): readonly BomRow[] =>
  recordsOf(detail?.versions);

// 版本对比行差异：按组件物料 id 匹配（同组件跨版本可比）。
export type DiffKind = 'ADDED' | 'REMOVED' | 'CHANGED';
export type LineDiff = Readonly<{
  kind: DiffKind;
  component: BomRow;
  next: BomRow | null;
  prev: BomRow | null;
  changes: readonly DiffField[];
}>;
export type DiffField = Readonly<{ label: string; from: string; to: string }>;

const substituteKey = (row: BomRow): string =>
  recordsOf(row.substitutes)
    .map((substitute) => `${textOf(substitute.itemVersionId)}@${textOf(substitute.priority)}`)
    .sort()
    .join('|');
const substitutesChanged = (left: BomRow, right: BomRow): boolean =>
  substituteKey(left) !== substituteKey(right);

// 三类差异（同指令口径）：新增 / 删除 / 变化（用量/损耗率/替代料——字段级 old→new）。
export const diffVersions = (newer: BomRow, older: BomRow): readonly LineDiff[] => {
  const newerLines = bomLines(newer);
  const olderLines = bomLines(older);
  const prevByItem = new Map(
    olderLines.map((line) => [textOf(recordOf(line.component).itemId), line]),
  );
  const nextByItem = new Map(
    newerLines.map((line) => [textOf(recordOf(line.component).itemId), line]),
  );
  const diffs: LineDiff[] = [];
  for (const line of newerLines) {
    const component = recordOf(line.component);
    const key = textOf(component.itemId);
    const prev = prevByItem.get(key);
    if (prev === undefined) {
      diffs.push({ kind: 'ADDED', component, next: line, prev: null, changes: [] });
      continue;
    }
    const changes: DiffField[] = [];
    if (textOf(line.quantity) !== textOf(prev.quantity))
      changes.push({ label: '用量', from: textOf(prev.quantity), to: textOf(line.quantity) });
    if (textOf(line.scrapBasisPoints) !== textOf(prev.scrapBasisPoints))
      changes.push({
        label: '损耗率',
        from: `${textOf(prev.scrapBasisPoints)}bp`,
        to: `${textOf(line.scrapBasisPoints)}bp`,
      });
    if (substitutesChanged(line, prev))
      changes.push({
        label: '替代料',
        from: substituteSummary(prev),
        to: substituteSummary(line),
      });
    if (changes.length > 0) diffs.push({ kind: 'CHANGED', component, next: line, prev, changes });
  }
  for (const line of olderLines) {
    const component = recordOf(line.component);
    if (!nextByItem.has(textOf(component.itemId)))
      diffs.push({ kind: 'REMOVED', component, next: null, prev: line, changes: [] });
  }
  return diffs;
};

// 替代料集合摘要（对比字段显示用）。
export const substituteSummary = (line: BomRow): string => {
  const substitutes = recordsOf(line.substitutes);
  if (substitutes.length === 0) return '无';
  return substitutes.map((substitute) => `v${textOf(substitute.version)}`).join('/');
};

// 默认对比版本对：最新已发布版本 vs 上一版本（不足两个版本时返回 null）。
export const defaultCompare = (versions: readonly BomRow[]): readonly [string, string] | null => {
  if (versions.length < 2) return null;
  return [textOf(versions[0]?.id), textOf(versions[1]?.id)];
};

export const versionHead = (version: BomRow): string =>
  `v${textOf(version.version, '?')} ${STATUS_LABELS[textOf(version.status)] ?? textOf(version.status)}`;
