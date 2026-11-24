// MFG-3B（TD-MFG-003）：制造概览汇总卡。三张卡按位对应三条子路由，各显示该控制台列表
// （版本行）里「已发布 / 草稿」的行数——口径取各控制台列表已有的行状态字段 status（与控制台
// 状态列同源：recordText(row, 'status', 'status')）；列表为无参 legacy 全量，故为全量计数；
// RETIRED 行既不是已发布也不是草稿，不计入两者。
// 目标子路由对当前账号可见时整卡为指向该路由的锚点（hash 导航，同采购概览与治理域概览的
// a.metric 做法，不依赖点击处理器），不可见时保持纯指标卡——否则点入会被导航兜底弹回首个
// 可用路由。读不到该列表时（没有对应读权限）数字无从得出，显示「—」而不是编一个 0。
import { el } from '../dom';
import type { AppRoute } from '../shared/navigation';
import type { OperationsViewContext } from './operations-view-ports';

type Rows = readonly Record<string, unknown>[];
type RecordText = OperationsViewContext['ports']['recordText'];

export type ManufacturingSummaryInput = Readonly<{
  items: Rows;
  boms: Rows;
  routings: Rows;
}>;

type SummaryCard = Readonly<{
  id: 'items' | 'boms' | 'routings';
  label: string;
  // 该卡对应的子路由；子路由不可见（列表读不到）时卡片保持纯指标。
  route: AppRoute;
  rows: (input: ManufacturingSummaryInput) => Rows;
}>;

export const MANUFACTURING_SUMMARY_CARDS: readonly SummaryCard[] = [
  { id: 'items', label: '物料', route: 'manufacturing/items', rows: (input) => input.items },
  { id: 'boms', label: 'BOM', route: 'manufacturing/boms', rows: (input) => input.boms },
  {
    id: 'routings',
    label: '工艺路线',
    route: 'manufacturing/routings',
    rows: (input) => input.routings,
  },
];

export const countByStatus = (rows: Rows, status: string, recordText: RecordText): number =>
  rows.filter((row) => recordText(row, 'status', 'status') === status).length;

export function appendManufacturingSummary(
  target: HTMLElement,
  input: ManufacturingSummaryInput,
  recordText: RecordText,
  visibleRoutes: ReadonlySet<string>,
): void {
  const summary = el('div', 'production-summary manufacturing-summary');
  for (const card of MANUFACTURING_SUMMARY_CARDS) {
    const readable = visibleRoutes.has(card.route);
    const rows = card.rows(input);
    const text = readable
      ? `${card.label}\n已发布 ${String(countByStatus(rows, 'PUBLISHED', recordText))} / 草稿 ${String(countByStatus(rows, 'DRAFT', recordText))}`
      : `${card.label}\n已发布 — / 草稿 —`;
    const link = readable ? el('a', 'metric-card manufacturing-summary-link', text) : null;
    if (link) link.href = `#/${card.route}`;
    const node: HTMLElement = link ?? el('div', 'metric-card', text);
    node.setAttribute('data-testid', `manufacturing-summary-${card.id}`);
    summary.append(node);
  }
  target.append(summary);
}
