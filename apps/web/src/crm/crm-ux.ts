// CRM-UX：客户域控制台展示助手——纯函数（无 DOM/信号依赖），组件与单测共用。
// 行记录沿控制台端口口径为宽松 Record：服务端按字段权限裁剪，业务键可能缺失，
// 因此取值一律经 textOf/recordOf 收敛，不假设键存在。
import type { StatusTone } from '@kingturf/ui';
import { displayMoney } from '../shared/business-format';

export type CrmRecord = Readonly<Record<string, unknown>>;

export const recordOf = (value: unknown): CrmRecord =>
  typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};

export const textOf = (value: unknown, fallback = ''): string =>
  typeof value === 'string' || typeof value === 'number' ? String(value) : fallback;

/** 服务端归一化时间（ISO）；不可解析返回 null，调用方按「—」呈现。 */
export const timeOf = (value: unknown): number | null => {
  const time = Date.parse(textOf(value));
  return Number.isFinite(time) ? time : null;
};

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

const pad = (part: number): string => String(part).padStart(2, '0');

/** 本地日历键 YYYY-MM-DD（时间线按用户所在时区的自然日分组）。 */
export const dayKeyOf = (value: unknown): string | null => {
  const time = timeOf(value);
  if (time === null) return null;
  const date = new Date(time);
  return `${String(date.getFullYear())}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

export const UNKNOWN_DAY = 'unknown';
const WEEKDAYS: readonly string[] = ['日', '一', '二', '三', '四', '五', '六'];

const startOfDay = (time: number): number => {
  const date = new Date(time);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
};

/** 日期分组标题：今天 / 昨天 / 2026年11月20日 周五。 */
export const dayLabelOf = (key: string, now: number): string => {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  if (key === dayKeyOf(today.toISOString())) return '今天';
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (key === dayKeyOf(yesterday.toISOString())) return '昨天';
  const [year, month, day] = key.split('-').map(Number);
  if (year === undefined || month === undefined || day === undefined) return '时间未知';
  const weekday = WEEKDAYS[new Date(year, month - 1, day).getDay()] ?? '';
  return `${String(year)}年${String(month)}月${String(day)}日 周${weekday}`;
};

const absoluteDateLabel = (time: number): string => {
  const date = new Date(time);
  return `${String(date.getFullYear())}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

/** 相对时间：刚刚 / 5 分钟前 / 3 小时前 / 昨天 / 4 天前；超过 30 天回落为日期。 */
export const relativeTimeOf = (value: unknown, now: number): string => {
  const time = timeOf(value);
  if (time === null) return '';
  const elapsed = now - time;
  if (elapsed < MINUTE) return '刚刚';
  if (elapsed < HOUR) return `${String(Math.floor(elapsed / MINUTE))} 分钟前`;
  const days = Math.round((startOfDay(now) - startOfDay(time)) / (24 * HOUR));
  if (days === 0) return `${String(Math.floor(elapsed / HOUR))} 小时前`;
  if (days === 1) return '昨天';
  if (days > 0 && days <= 30) return `${String(days)} 天前`;
  return absoluteDateLabel(time);
};

/** 绝对时间 YYYY-MM-DD HH:mm（悬停/辅助信息，补足相对时间的精度）。 */
export const dateTimeLabelOf = (value: unknown): string => {
  const time = timeOf(value);
  if (time === null) return '';
  const date = new Date(time);
  return `${absoluteDateLabel(time)} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

/** 超过 7 天没有更新的线索标为滞留（卡片以警示色提示，不改变任何业务状态）。 */
export const STALE_AFTER_DAYS = 7;

export const isStale = (value: unknown, now: number): boolean => {
  const time = timeOf(value);
  if (time === null) return false;
  return now - time > STALE_AFTER_DAYS * 24 * HOUR;
};

const maskTail = (value: string): string =>
  value.length <= 2
    ? '*'.repeat(value.length)
    : `${'*'.repeat(value.length - 2)}${value.slice(-2)}`;

/** 邮箱遮蔽：保留首字符与域名（b***@example.test）；无 @ 时仅保留末两位。 */
export const maskEmail = (value: string): string => {
  const at = value.lastIndexOf('@');
  if (at <= 0) return maskTail(value);
  return `${value.slice(0, 1)}***${value.slice(at)}`;
};

/** 电话遮蔽：保留前 3 后 4（138****5678）；不足 7 位仅保留末两位。 */
export const maskPhone = (value: string): string =>
  value.length < 7
    ? maskTail(value)
    : `${value.slice(0, 3)}${'*'.repeat(value.length - 7)}${value.slice(-4)}`;

/** 头像字：取首字（中文名即姓氏，拉丁名转大写）；按码点切分，不切断代理对。 */
export const initialOf = (value: unknown): string => {
  const [first] = Array.from(textOf(value).trim());
  return first === undefined ? '' : first.toLocaleUpperCase('zh-CN');
};

export type LeadTab = 'POOL' | 'PRIVATE';

/** 公海 = 未认领（status=POOL）；其余状态（含 NEW）归私海视图，保证没有任何线索因分栏而不可见。 */
export const isPoolLead = (row: unknown): boolean => recordOf(row).status === 'POOL';

export const LEAD_STATUS_LABELS: Readonly<Record<string, string>> = {
  POOL: '公海',
  CLAIMED: '已认领',
  QUALIFIED: '已确认',
  DISQUALIFIED: '无效线索',
  CONVERTED: '已转化',
};

export const leadStatusLabel = (status: unknown): string => {
  const key = textOf(status, 'POOL');
  return LEAD_STATUS_LABELS[key] ?? key;
};

export const CUSTOMER_STATUS_LABELS: Readonly<Record<string, string>> = {
  PROSPECT: '潜在客户',
  ACTIVE: '活跃客户',
  INACTIVE: '非活跃',
  ARCHIVED: '已归档',
};

export const customerStatusLabel = (status: unknown): string => {
  const key = textOf(status, 'PROSPECT');
  return CUSTOMER_STATUS_LABELS[key] ?? key;
};

export type LeadSourceIcon = 'expo' | 'website' | 'referral' | 'outreach' | 'other';

const SOURCE_ICONS: readonly (readonly [RegExp, LeadSourceIcon])[] = [
  [/展会|博览|expo|event|trade/iu, 'expo'],
  [/网站|官网|网页|web|site|online|搜索|seo/iu, 'website'],
  [/转介绍|介绍|推荐|referral|refer/iu, 'referral'],
  [/主动|开发|外呼|陌拜|地推|cold|outreach/iu, 'outreach'],
];

/** 线索来源 → 图标键；来源为自由文本，未命中回落为通用图标（文案仍原样显示）。 */
export const leadSourceIconOf = (source: unknown): LeadSourceIcon =>
  SOURCE_ICONS.find(([pattern]) => pattern.test(textOf(source)))?.[1] ?? 'other';

export type ActivityIcon = 'visit' | 'call' | 'mail' | 'expo' | 'note' | 'other';

const ACTIVITY_ICONS: readonly (readonly [RegExp, ActivityIcon])[] = [
  [/拜访|走访|会见|meet|visit/iu, 'visit'],
  [/电话|通话|call|phone/iu, 'call'],
  [/邮件|邮箱|mail|email/iu, 'mail'],
  [/展会|博览|expo|event/iu, 'expo'],
  [/备注|记录|跟进|note/iu, 'note'],
];

/** 活动类型 → 图标键；类型由 businessEventLabel 负责文案，这里只决定图形。 */
export const activityIconOf = (type: unknown): ActivityIcon =>
  ACTIVITY_ICONS.find(([pattern]) => pattern.test(textOf(type)))?.[1] ?? 'other';

// 商机阶段文案与 commercial 商机控制台 stageLabel 保持一致（该常量未导出，此处镜像）。
const OPPORTUNITY_STAGE_LABELS: Readonly<Record<string, string>> = {
  OPEN: '初步接洽',
  QUALIFIED: '需求确认',
  PROPOSAL: '方案报价',
  WON: '赢单',
  LOST: '输单',
  CANCELLED: '已取消',
};

export const opportunityStageLabel = (status: unknown): string => {
  const key = textOf(status, '—');
  return OPPORTUNITY_STAGE_LABELS[key] ?? key;
};

export const opportunityStageTone = (status: unknown): StatusTone => {
  if (status === 'WON') return 'success';
  if (status === 'LOST') return 'danger';
  if (status === 'QUALIFIED' || status === 'PROPOSAL') return 'info';
  return 'neutral';
};

export const leadStatusTone = (status: unknown): StatusTone => {
  if (status === 'QUALIFIED' || status === 'CONVERTED') return 'success';
  if (status === 'DISQUALIFIED') return 'danger';
  if (status === 'CLAIMED') return 'info';
  return 'neutral';
};

export const customerStatusTone = (status: unknown): StatusTone => {
  if (status === 'ACTIVE') return 'success';
  if (status === 'INACTIVE' || status === 'ARCHIVED') return 'neutral';
  return 'info';
};

export type FunnelStage = Readonly<{
  stage: string;
  label: string;
  count: number;
  /** 按币种分列的金额合计（不同币种不可相加）。 */
  amounts: readonly Readonly<{ currency: string; amount: number }>[];
  /** 相对最大阶段的宽度占比 0..1（漏斗条宽度）。 */
  share: number;
}>;

/** 漏斗阶段按推进顺序；LOST/CANCELLED 为终态出口，不占漏斗层级。 */
export const FUNNEL_STAGES: readonly (readonly [string, string])[] = [
  ['OPEN', '初步接洽'],
  ['QUALIFIED', '需求确认'],
  ['PROPOSAL', '方案报价'],
  ['WON', '赢单'],
];

const amountOf = (value: unknown): number | null => {
  const amount = Number(recordOf(value).amount);
  return Number.isFinite(amount) && amount >= 0 ? amount : null;
};

const sumByCurrency = (
  rows: readonly CrmRecord[],
): readonly Readonly<{ currency: string; amount: number }>[] => {
  const sums = new Map<string, number>();
  for (const row of rows) {
    const amount = amountOf(row.value);
    if (amount === null) continue;
    const currency = textOf(recordOf(row.value).currency, 'CNY');
    sums.set(currency, (sums.get(currency) ?? 0) + amount);
  }
  return [...sums].map(([currency, amount]) => ({ currency, amount }));
};

/** 客户 360 商机漏斗：各在途阶段的商机数与金额（按币种）。 */
export const funnelOf = (opportunities: readonly CrmRecord[]): readonly FunnelStage[] => {
  const rows = opportunities.map((row) => ({ row, stage: textOf(row.status, 'OPEN') }));
  const max = Math.max(
    0,
    ...FUNNEL_STAGES.map(([stage]) => rows.filter((item) => item.stage === stage).length),
  );
  return FUNNEL_STAGES.map(([stage, label]) => {
    const matched = rows.filter((item) => item.stage === stage).map((item) => item.row);
    return {
      stage,
      label,
      count: matched.length,
      amounts: sumByCurrency(matched),
      share: max === 0 ? 0 : matched.length / max,
    };
  });
};

export const closedOpportunitiesOf = (
  opportunities: readonly CrmRecord[],
): Readonly<{ lost: number; cancelled: number }> => ({
  lost: opportunities.filter((row) => row.status === 'LOST').length,
  cancelled: opportunities.filter((row) => row.status === 'CANCELLED').length,
});

export const amountsLabel = (
  amounts: readonly Readonly<{ currency: string; amount: number }>[],
): string => amounts.map((item) => displayMoney(item.currency, item.amount)).join(' · ');

/** 客户列表接口单次最多返回 100 行（legacy LIMIT 100）；触顶时总数只可表述为下界。 */
export const CUSTOMER_LIST_CAP = 100;

export type CustomerStats = Readonly<{
  total: number;
  /** 列表触顶：真实总数可能更大，界面显示 100+。 */
  capped: boolean;
  active: number;
  newThisMonth: number;
}>;

/** 客户列表顶部统计：基于已加载的可见客户全集（不随筛选/检索变化）。 */
export const customerStatsOf = (customers: readonly CrmRecord[], now: number): CustomerStats => {
  const today = new Date(now);
  const monthKey = `${String(today.getFullYear())}-${pad(today.getMonth() + 1)}`;
  const isNewThisMonth = (row: CrmRecord): boolean =>
    dayKeyOf(row.createdAt)?.startsWith(monthKey) === true;
  return {
    total: customers.length,
    capped: customers.length >= CUSTOMER_LIST_CAP,
    active: customers.filter((row) => row.status === 'ACTIVE').length,
    newThisMonth: customers.filter(isNewThisMonth).length,
  };
};

/** 活动关联对象：直接挂载的线索，以及 details.opportunityId 或由该线索转出的商机。 */
export const relatedOf = (
  activity: CrmRecord,
  leads: readonly CrmRecord[],
  opportunities: readonly CrmRecord[],
): Readonly<{ leads: readonly CrmRecord[]; opportunities: readonly CrmRecord[] }> => {
  const leadId = textOf(activity.leadId);
  const opportunityId = textOf(recordOf(activity.details).opportunityId);
  return {
    leads: leads.filter((lead) => leadId !== '' && textOf(lead.id) === leadId),
    opportunities: opportunities.filter(
      (opportunity) =>
        (opportunityId !== '' && textOf(opportunity.id) === opportunityId) ||
        (leadId !== '' && textOf(opportunity.leadId) === leadId),
    ),
  };
};

/** 时间线稳定排序：发生时间倒序，不可解析的排最后；同值保持服务端顺序。 */
export const sortActivities = (activities: readonly CrmRecord[]): readonly CrmRecord[] =>
  activities
    .map((row, index) => ({ row, index, time: timeOf(row.occurredAt) }))
    .sort((left, right) => {
      if (left.time === right.time) return left.index - right.index;
      if (left.time === null) return 1;
      if (right.time === null) return -1;
      return right.time - left.time;
    })
    .map((item) => item.row);

export type DayGroup<T> = Readonly<{ key: string; rows: readonly T[] }>;

/** 按本地自然日分组，保持输入顺序（调用方先 sortActivities）。 */
export const groupByDay = <T>(
  rows: readonly T[],
  timeOfRow: (row: T) => unknown,
): readonly DayGroup<T>[] => {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const key = dayKeyOf(timeOfRow(row)) ?? UNKNOWN_DAY;
    const bucket = groups.get(key);
    if (bucket) bucket.push(row);
    else groups.set(key, [row]);
  }
  return [...groups].map(([key, grouped]) => ({ key, rows: grouped }));
};

export type CreditMoney = Readonly<{ currency: string; amount: number }>;

/** 客户 360 信用概要：额度、敞口与最近一次信用决定（任一项缺失为 null）。 */
export type CustomerCreditSummary = Readonly<{
  limit: CreditMoney | null;
  exposure: CreditMoney | null;
  decision: Readonly<{ status: string; decidedAt: string }> | null;
}>;

const creditMoneyOf = (value: unknown): CreditMoney | null => {
  const record = recordOf(value);
  const amount = Number(record.amount);
  const currency = textOf(record.currency, 'CNY');
  return Number.isFinite(amount) && currency !== '' ? { currency, amount } : null;
};

/** 从宽松记录（端口返回或 360 响应内嵌）解析信用概要；非对象或全空返回 null。 */
export const creditSummaryOf = (value: unknown): CustomerCreditSummary | null => {
  if (typeof value !== 'object' || value === null) return null;
  const record = recordOf(value);
  const decision = recordOf(record.decision);
  return {
    limit: creditMoneyOf(record.limit),
    exposure: creditMoneyOf(record.exposure),
    decision:
      Object.keys(decision).length === 0
        ? null
        : { status: textOf(decision.status, '—'), decidedAt: textOf(decision.decidedAt) },
  };
};

export const isCreditSummaryEmpty = (summary: CustomerCreditSummary): boolean =>
  summary.limit === null && summary.exposure === null && summary.decision === null;

export type CreditLevel = 'ok' | 'warning' | 'danger';

/** 额度使用率 = 敞口 / 额度（同币种）；≥90% 告急、≥70% 预警。缺项或币种不一致时不可计算。 */
export const creditUsageOf = (
  summary: CustomerCreditSummary,
): Readonly<{ ratio: number | null; level: CreditLevel }> => {
  const { limit, exposure } = summary;
  if (limit === null || exposure === null) return { ratio: null, level: 'ok' };
  if (limit.currency !== exposure.currency) return { ratio: null, level: 'ok' };
  if (limit.amount <= 0) return { ratio: null, level: exposure.amount > 0 ? 'danger' : 'ok' };
  const ratio = exposure.amount / limit.amount;
  return { ratio, level: ratio >= 0.9 ? 'danger' : ratio >= 0.7 ? 'warning' : 'ok' };
};

/** 信用决定文案与色调，与 commercial 信用审查控制台一致（该常量未导出，此处镜像）。 */
const CREDIT_DECISION_LABELS: Readonly<Record<string, string>> = {
  PENDING_APPROVAL: '等待信用审批',
  APPROVED: '信用已批准',
  REJECTED: '信用已拒绝',
  EXPIRED: '信用已过期',
};

export const creditDecisionLabel = (status: unknown): string => {
  const key = textOf(status, '—');
  return CREDIT_DECISION_LABELS[key] ?? key;
};

export const creditDecisionTone = (status: unknown): StatusTone => {
  if (status === 'APPROVED') return 'success';
  if (status === 'REJECTED') return 'danger';
  if (status === 'PENDING_APPROVAL') return 'warning';
  return 'neutral';
};
