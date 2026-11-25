// MFG-3B（TD-MFG-003）：制造概览汇总卡。三张卡按位对应三条子路由，各显示该控制台列表
// （版本行）里「已发布 / 草稿」的行数——口径取各控制台列表已有的行状态字段 status（与控制台
// 状态列同源：recordText(row, 'status', 'status')）；列表为无参 legacy 全量，故为全量计数；
// RETIRED 行既不是已发布也不是草稿，不计入两者。
// 目标子路由对当前账号可见时整卡为指向该路由的锚点（hash 导航，同采购概览与治理域概览的
// a.metric 做法，不依赖点击处理器），不可见时保持纯指标卡——否则点入会被导航兜底弹回首个
// 可用路由。读不到该列表时（没有对应读权限）数字无从得出，显示「—」而不是编一个 0。
// 数据经取数回调读取而不是渲染那一刻的数组：路由视图只构建一次，三个控制台新建 / 发布 /
// 刷新后（宿主 refresh 端口 controller.load 重读）由返回的重算函数更新卡片文字，已挂载的
// 节点（锚点、标识、可见性）保持同一实例。
import type { SummaryCardItem } from '@kingturf/ui';
import { appendOverviewCards } from '../shared/overview-summary-cards';
import type { AppRoute } from '../shared/navigation';
import type { OperationsViewContext } from './operations-view-ports';

type Rows = readonly Record<string, unknown>[];
type RecordText = OperationsViewContext['ports']['recordText'];

export type ManufacturingSummaryInput = Readonly<{
  items: Rows | undefined;
  boms: Rows | undefined;
  routings: Rows | undefined;
}>;

type SummaryCard = Readonly<{
  id: 'items' | 'boms' | 'routings';
  label: string;
  // 链接按路由可见性判断，数字按清单是否已读取判断。
  route: AppRoute;
  rows: (input: ManufacturingSummaryInput) => Rows | undefined;
}>;

const MANUFACTURING_SUMMARY_CARDS: readonly SummaryCard[] = [
  { id: 'items', label: '物料', route: 'manufacturing/items', rows: (input) => input.items },
  { id: 'boms', label: 'BOM', route: 'manufacturing/boms', rows: (input) => input.boms },
  {
    id: 'routings',
    label: '工艺路线',
    route: 'manufacturing/routings',
    rows: (input) => input.routings,
  },
];

const countByStatus = (rows: Rows, status: string, recordText: RecordText): number =>
  rows.filter((row) => recordText(row, 'status', 'status') === status).length;

function itemOf(
  card: SummaryCard,
  snapshot: ManufacturingSummaryInput,
  recordText: RecordText,
  visibleRoutes: ReadonlySet<string>,
): SummaryCardItem {
  const visible = visibleRoutes.has(card.route);
  const rows = visible ? card.rows(snapshot) : undefined;
  return {
    id: card.id,
    label: `${card.label} · 已发布版本`,
    value: rows ? String(countByStatus(rows, 'PUBLISHED', recordText)) : '—',
    hint: rows ? `草稿 ${String(countByStatus(rows, 'DRAFT', recordText))}` : '读不到清单',
    href: visible ? `#/${card.route}` : undefined,
  };
}

/** 子控制台读取新快照后只更新 signal，已挂载的卡片继续使用原来的节点。 */
export function appendManufacturingSummary(
  target: HTMLElement,
  input: () => ManufacturingSummaryInput,
  recordText: RecordText,
  visibleRoutes: ReadonlySet<string>,
): () => void {
  return appendOverviewCards(
    target,
    input,
    (snapshot) =>
      MANUFACTURING_SUMMARY_CARDS.map((card) => itemOf(card, snapshot, recordText, visibleRoutes)),
    '制造主数据版本汇总',
    'manufacturing-summary',
  );
}
