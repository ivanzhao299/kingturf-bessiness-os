// MFG-6（ADR-0014 分域重写）：物料需求计划控制台的纯函数层——页签、状态文案、行取值、汇总口径、
// 与 legacy openForm 表单逐字节一致的载荷构造。不依赖 DOM，不经 IO。
import type { StatusTone } from '@kingturf/ui';
import type { MrpConsolePorts, MrpRow, MrpSnapshot } from './mrp-ports';

export type MrpTab = 'proposals' | 'runs' | 'demands' | 'policies';
export const MRP_TABS: readonly MrpTab[] = ['proposals', 'runs', 'demands', 'policies'];
export const TAB_LABELS: Readonly<Record<MrpTab, string>> = {
  proposals: '建议',
  runs: '计算批次',
  demands: '需求信号',
  policies: '计划政策',
};
// 每个页签内容各自的读权限（沿用现有权限键）：没有时该页签里显示「—」并说明原因。
export const TAB_READ: Readonly<Record<MrpTab, string>> = {
  proposals: 'mrp:read',
  runs: 'mrp:read',
  demands: 'mrp:read',
  policies: 'mrp-policy:read',
};

export type ProposalState = 'PROPOSED' | 'APPROVED' | 'REJECTED' | 'RELEASED' | 'CANCELLED';
export type StateFilter = 'ALL' | ProposalState;
export const STATE_FILTERS: readonly StateFilter[] = [
  'ALL',
  'PROPOSED',
  'APPROVED',
  'REJECTED',
  'RELEASED',
];
// 建议状态的本域文案（legacy 卡片用的是通用状态表：PROPOSED 待审批、RELEASED 已放行）。
export const STATE_LABELS: Readonly<Record<string, string>> = {
  PROPOSED: '待处理',
  APPROVED: '已审批',
  REJECTED: '已拒绝',
  RELEASED: '已下达',
  CANCELLED: '已取消',
};
export const RUN_STATE_LABELS: Readonly<Record<string, string>> = {
  DRAFT: '草稿',
  COMPUTED: '已计算',
  APPROVED: '已批准',
  CANCELLED: '已取消',
};
export const TYPE_LABELS: Readonly<Record<string, string>> = {
  PRODUCTION: '生产建议',
  PURCHASE: '采购建议',
  MAKE: '自制',
  BUY: '采购',
};
export const stateTone = (state: string): StatusTone => {
  if (state === 'RELEASED') return 'success';
  if (state === 'APPROVED') return 'info';
  if (state === 'REJECTED' || state === 'CANCELLED') return 'danger';
  if (state === 'PROPOSED') return 'warning';
  return 'neutral';
};

export const records = (value: unknown): readonly MrpRow[] =>
  Array.isArray(value)
    ? value.filter((entry): entry is MrpRow => typeof entry === 'object' && entry !== null)
    : [];
// 取值即原文：数字按 JSON 数字转字符串（10300 → "10300"，5928.75 → "5928.75"），与 legacy 卡片一致。
export const textOf = (value: unknown): string =>
  typeof value === 'string' || typeof value === 'number' ? String(value) : '';
export const numOf = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : 0;
export const idOf = (row: MrpRow): string => textOf(row.id);
export const dayOf = (value: unknown): string => textOf(value).slice(0, 10);
// 行取值：按驼峰 / 蛇形两个键取（列表行是数据库列名，详情行项是驼峰键），缺省空串。
export const rowText = (
  recordText: MrpConsolePorts['recordText'],
  row: MrpRow,
  camel: string,
  snake: string,
  fallback = '',
): string => recordText(row, camel, snake, fallback);

// 汇总卡口径。三个列表的数字是该列表的行数；建议的数字取自最新批次（列表首行，与 legacy 的
// latestRun = runs[0] 同源）。「当前待处理建议」= 最新批次里状态为待处理的建议数。
export type MrpSummary = Readonly<{
  policies: number | null;
  demands: number | null;
  runs: number | null;
  latest: MrpRow | null;
  pending: number;
  approved: number;
  released: number;
  rejected: number;
  total: number;
}>;
export const summaryOf = (snapshot: MrpSnapshot): MrpSummary => {
  const latest = snapshot.runs?.[0] ?? null;
  const proposals = latest ? records(latest.proposals) : [];
  const count = (state: string): number =>
    proposals.filter((proposal) => textOf(proposal.effectiveState) === state).length;
  return {
    policies: snapshot.policies?.length ?? null,
    demands: snapshot.demands?.length ?? null,
    runs: snapshot.runs?.length ?? null,
    latest,
    pending: latest ? count('PROPOSED') : 0,
    approved: count('APPROVED'),
    released: count('RELEASED'),
    rejected: count('REJECTED'),
    total: proposals.length,
  };
};

// —— 载荷构造：与 legacy openForm 表单逐字节一致（openForm 提交前对每个值 trim）——
type Values = Readonly<Record<string, string>>;
const trimmed = (values: Values): Values =>
  Object.fromEntries(Object.entries(values).map(([key, value]) => [key, value.trim()]));
const at = (values: Values, key: string): string => values[key] ?? '';

/** 新建计划政策（字段顺序与类型同 legacy：数量是字符串，天数是数字，日期补到 UTC 零点）。 */
export const policyPayload = (values: Values): Record<string, unknown> => {
  const input = trimmed(values);
  return {
    itemVersionId: at(input, 'itemVersionId'),
    makeOrBuy: at(input, 'makeOrBuy'),
    safetyStock: at(input, 'safetyStock'),
    minimumOrderQuantity: at(input, 'minimumOrderQuantity'),
    orderMultiple: at(input, 'orderMultiple'),
    leadTimeDays: Number(at(input, 'leadTimeDays')),
    freezeWindowDays: Number(at(input, 'freezeWindowDays')),
    effectiveAt: `${at(input, 'effectiveAt')}T00:00:00.000Z`,
  };
};

/** 登记需求信号（来源类型是稳定编码，数量是字符串，优先级是数字）。 */
export const demandPayload = (values: Values): Record<string, unknown> => {
  const input = trimmed(values);
  return {
    itemVersionId: at(input, 'itemVersionId'),
    sourceType: at(input, 'sourceType'),
    sourceId: at(input, 'sourceId'),
    requiredAt: at(input, 'requiredAt'),
    quantity: at(input, 'quantity'),
    priority: Number(at(input, 'priority')),
  };
};

/** 运行物料需求计算（基准日补到 UTC 零点，截止日是日历日期）。 */
export const runPayload = (values: Values): Record<string, unknown> => {
  const input = trimmed(values);
  return {
    runNumber: at(input, 'runNumber'),
    asOf: `${at(input, 'asOf')}T00:00:00.000Z`,
    horizonEnd: at(input, 'horizonEnd'),
  };
};

/** 批准 / 拒绝： 冻结覆盖审批编号留空时不带该键（legacy 同式）。 */
export const decisionPayload = (values: Values): Record<string, unknown> => {
  const input = trimmed(values);
  const override = at(input, 'freezeOverrideApproval');
  return {
    reason: at(input, 'reason'),
    evidence: {
      approval: at(input, 'approval'),
      ...(override ? { freezeOverrideApproval: override } : {}),
    },
  };
};

/** 下达： 理由 + 计划凭证编号。 */
export const releasePayload = (values: Values): Record<string, unknown> => {
  const input = trimmed(values);
  return {
    reason: at(input, 'reason'),
    evidence: { reference: at(input, 'evidenceReference') },
  };
};
