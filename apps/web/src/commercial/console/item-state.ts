// U3-MFG-1：物料控制台共享展示契约——分类/版本状态词表、规格参数预设、纯展示助手
// 与视图状态类型（页面工厂、详情抽屉、新建抽屉共用；不持有运行时状态）。
import type { StatusTone } from '@kingturf/ui';
import type { ItemConsolePorts, ItemRow } from './item-ports';

export type ItemCategory = 'RAW_MATERIAL' | 'SEMI_FINISHED' | 'FINISHED_GOOD' | 'PACKAGING';
export type ItemCategoryFilter = 'ALL' | ItemCategory;
export type ItemStatusFilter = 'ALL' | 'DRAFT' | 'PUBLISHED' | 'RETIRED';
// 新建表单规格行：preset 为预设键名（按物料类型给出），'' = 自定义键值行；id 为
// 行内稳定标识（表单字段名据此派生，移除中间行不会串值）。
export type SpecRowDraft = Readonly<{ id: string; preset: string }>;

export const ITEM_CATEGORIES: readonly ItemCategory[] = [
  'RAW_MATERIAL',
  'SEMI_FINISHED',
  'FINISHED_GOOD',
  'PACKAGING',
];
export const CATEGORY_LABELS: Readonly<Record<string, string>> = {
  RAW_MATERIAL: '原材料',
  SEMI_FINISHED: '半成品',
  FINISHED_GOOD: '成品',
  PACKAGING: '包装物',
};
export const STATUS_FILTERS: readonly ItemStatusFilter[] = ['ALL', 'DRAFT', 'PUBLISHED', 'RETIRED'];
// 版本状态词表：草稿/已发布与 businessStateLabel 同口径，RETIRED 为 additive 本地化。
export const STATUS_LABELS: Readonly<Record<string, string>> = {
  DRAFT: '草稿',
  PUBLISHED: '已发布',
  RETIRED: '已退役',
};
// 筛选态分页窗口（显式 limit 才启用服务端游标；默认视图为路由加载的全量快照）。
export const ITEM_PAGE_SIZE = 50;
export const ALL_CATEGORIES = 'ALL' as const;

export type SpecPreset = Readonly<{ key: string; label: string; numeric: boolean }>;
// 规格参数预设（按物料类型动态给出；键名取自既有物料规格数据的实际用法——
// 草高/针距/旦数/颜色/层数），自定义键值行始终可加。
export const SPEC_PRESETS: Readonly<Record<ItemCategory, readonly SpecPreset[]>> = {
  RAW_MATERIAL: [
    { key: 'dtex', label: '旦数（dtex）', numeric: true },
    { key: 'color', label: '颜色', numeric: false },
    { key: 'layers', label: '层数', numeric: true },
  ],
  SEMI_FINISHED: [
    { key: 'pileHeightMm', label: '草高（mm）', numeric: true },
    { key: 'gauge', label: '针距', numeric: false },
  ],
  FINISHED_GOOD: [
    { key: 'pileHeightMm', label: '草高（mm）', numeric: true },
    { key: 'gauge', label: '针距', numeric: false },
  ],
  PACKAGING: [],
};
const PRESET_BY_KEY: Readonly<Record<string, SpecPreset>> = Object.fromEntries(
  ITEM_CATEGORIES.flatMap((category) =>
    SPEC_PRESETS[category].map((preset) => [preset.key, preset]),
  ),
);
const DECIMAL = /^-?\d+(?:\.\d+)?$/u;
export const specPreset = (key: string): SpecPreset | undefined => PRESET_BY_KEY[key];

export type ItemViewState = Readonly<{
  permissions: ReadonlySet<string>;
  ports: ItemConsolePorts;
  // 全量快照（默认视图行与分类计数来源）与当前展示行（筛选态为服务端分页行）。
  snapshot: readonly ItemRow[];
  items: readonly ItemRow[];
  nextCursor: string | null;
  filtered: boolean;
  category: ItemCategoryFilter;
  statusFilter: ItemStatusFilter;
  search: string;
  appliedQuery: string;
  loading: boolean;
  loadingMore: boolean;
  loadError: string;
  actionError: string;
  submitError: string;
  selected: ItemRow | null;
  detail: ItemRow | null;
  detailLoading: boolean;
  activeForm: 'create' | null;
  createType: ItemCategory;
  specRows: readonly SpecRowDraft[];
  mayManage: boolean;
  selectCategory: (next: ItemCategoryFilter) => void;
  setStatusFilter: (next: ItemStatusFilter) => void;
  setSearch: (next: string) => void;
  applySearch: () => void;
  clearSearch: () => void;
  loadMore: () => void;
  runRefresh: () => Promise<void>;
  open: (row: ItemRow | null) => void;
  openCreate: () => void;
  closeForm: () => void;
  setCreateType: (next: ItemCategory) => void;
  addSpecRow: (preset: string) => void;
  removeSpecRow: (id: string) => void;
  runPublish: (row: ItemRow) => Promise<void>;
  runCreate: (values: Readonly<Record<string, string>>) => Promise<void>;
}>;

export const categoryLabel = (value: unknown, fallback = '—'): string =>
  CATEGORY_LABELS[String(value)] ?? fallback;

export const statusTone = (status: unknown): StatusTone => {
  if (status === 'PUBLISHED') return 'success';
  if (status === 'DRAFT') return 'info';
  return 'neutral';
};

// 规格参数 → 键值对（非对象按空处理；嵌套值取 JSON 文本）。
export const specEntries = (specification: unknown): readonly (readonly [string, string])[] => {
  if (typeof specification !== 'object' || specification === null || Array.isArray(specification))
    return [];
  return Object.entries(specification as Record<string, unknown>).map(([key, value]) => [
    key,
    typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value),
  ]);
};

// 分类计数按物料根（itemId 去重）——列表行为版本行，同物料多版本只计一次。
const itemRootId = (row: ItemRow): string => {
  const root = row.itemId ?? row.id;
  return typeof root === 'string' ? root : '';
};

export const countByCategory = (rows: readonly ItemRow[], category: ItemCategory): number =>
  new Set(
    rows.flatMap((row) =>
      row.itemType === category && itemRootId(row) !== '' ? [itemRootId(row)] : [],
    ),
  ).size;

export const countAllItems = (rows: readonly ItemRow[]): number =>
  new Set(rows.map(itemRootId).filter((id) => id !== '')).size;

// 规格行 → specification 载荷：预设数值键与十进制字面量转数值（legacy 表单
// Number(pileHeightMm) 同口径），其余保留去空白后的字符串；空行丢弃。
export const specificationOf = (
  rows: readonly SpecRowDraft[],
  values: Readonly<Record<string, string>>,
): Readonly<Record<string, string | number>> => {
  const specification: Record<string, string | number> = {};
  rows.forEach((row) => {
    const preset: SpecPreset | undefined = PRESET_BY_KEY[row.preset];
    const key = row.preset !== '' ? row.preset : (values[`spec:${row.id}:key`] ?? '').trim();
    const raw = (values[`spec:${row.id}:value`] ?? '').trim();
    if (key === '' || raw === '') return;
    if (preset?.numeric === true) specification[key] = Number(raw);
    else specification[key] = DECIMAL.test(raw) ? Number(raw) : raw;
  });
  return specification;
};
