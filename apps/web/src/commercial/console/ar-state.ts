// FIN-1：应收控制台的共享展示契约——筛选词表、单据类型与状态文案、账龄文字、视图状态类型
//（页面工厂、详情抽屉、新建抽屉共用；不持有运行时状态）。
import type { StatusTone } from '@kingturf/ui';
import { finDecimal, finDecimalSortKey, finText } from './fin-kit';
import type { ArConsolePorts, ArRow, ArSummaryRow } from './ar-ports';

// 筛选：未逾期 / 已逾期 / 已结清（任务书口径）+ 全部。NOT_DUE 为加性取值
//（未核销余额 > 0 且到期时间不早于当前时刻）。
export type ArFilter = 'ALL' | 'NOT_DUE' | 'OVERDUE' | 'CLEARED';
export const AR_FILTERS: readonly Readonly<{ key: ArFilter; label: string }>[] = [
  { key: 'ALL', label: '全部' },
  { key: 'NOT_DUE', label: '未逾期' },
  { key: 'OVERDUE', label: '已逾期' },
  { key: 'CLEARED', label: '已结清' },
];

export const AR_DOCUMENT_TYPES: Readonly<Record<string, string>> = {
  INVOICE: '发票',
  CREDIT_NOTE: '贷项通知',
};
export const AR_STATES: Readonly<Record<string, string>> = {
  OPEN: '未逾期',
  OVERDUE: '已逾期',
  CLEARED: '已结清',
};
export const ORDER_STATES: Readonly<Record<string, string>> = {
  RELEASED: '已放行',
  CANCELLED: '已取消',
};

const DAY = 86_400_000;

export const arDocumentType = (row: ArRow): string => {
  const type = finText(row, 'documentType');
  return AR_DOCUMENT_TYPES[type] ?? (type === '' ? '—' : type);
};

/** 行状态：服务端给的 agingState；没有时按余额与到期时间就地推算（同一口径）。 */
export const arState = (row: ArRow): string => {
  const state = finText(row, 'agingState');
  if (state !== '') return state;
  const remaining = finDecimal(row.remainingAmount);
  if (remaining === '') return '—';
  if (remaining === '0') return 'CLEARED';
  const due = Date.parse(finText(row, 'dueAt', 'due_at'));
  return Number.isFinite(due) && due < Date.now() ? 'OVERDUE' : 'OPEN';
};

export const arStateTone = (state: string): StatusTone =>
  state === 'OVERDUE' ? 'danger' : state === 'CLEARED' ? 'success' : 'neutral';

/** 账龄：已结清 / 逾期 N 天 / 今天到期 / 剩余 N 天（按到期时刻计）。 */
export const arAgingText = (row: ArRow, now: number): string => {
  const state = arState(row);
  if (state === 'CLEARED') return '已结清';
  const due = Date.parse(finText(row, 'dueAt', 'due_at'));
  if (state === '—' || !Number.isFinite(due)) return '—';
  if (state === 'OVERDUE')
    return `逾期 ${finText(row, 'overdueDays') || String(Math.floor((now - due) / DAY))} 天`;
  const today = new Date(now).toISOString().slice(0, 10);
  if (finText(row, 'dueAt', 'due_at').slice(0, 10) === today) return '今天到期';
  return `剩余 ${String(Math.ceil((due - now) / DAY))} 天`;
};

export const arAmount = (row: ArRow, key: string): string => finDecimalSortKey(row[key]);

export type ArViewState = Readonly<{
  permissions: ReadonlySet<string>;
  ports: ArConsolePorts;
  rows: readonly ArRow[];
  nextCursor: string | null;
  loading: boolean;
  loadingMore: boolean;
  loadError: string;
  filter: ArFilter;
  search: string;
  appliedSearch: string;
  // null = 尚未读到（或读取失败），卡片显示「—」。
  summary: readonly ArSummaryRow[] | null;
  selected: ArRow | null;
  detailLoading: boolean;
  activeForm: 'create' | null;
  submitError: string;
  notice: string;
  mayPost: boolean;
  // 筛选或关键字生效中（空态文案据此区分）。
  filtered: boolean;
  setFilter: (next: ArFilter) => void;
  setSearch: (next: string) => void;
  applySearch: () => void;
  clearSearch: () => void;
  loadMore: () => void;
  runRefresh: () => Promise<void>;
  open: (row: ArRow | null) => void;
  openCreate: () => void;
  closeForm: () => void;
  runCreate: (values: Readonly<Record<string, string>>) => Promise<void>;
}>;
