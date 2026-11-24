// PROC-2（TD-PROC-010）：采购概览汇总卡。口径与文案沿用原 #/procurement 面板顶部的四张
// metric-card；目标子路由对当前账号可见时整卡为指向该路由的锚点（hash 导航，同治理域概览的
// a.metric 做法，不依赖点击处理器），不可见时保持纯指标卡——否则点入会被导航兜底弹回首个
// 可用路由。
import { el } from '../dom';
import type { AppRoute } from '../shared/navigation';
import type { OperationsViewContext } from './operations-view-ports';

type Rows = readonly Record<string, unknown>[];
type RecordText = OperationsViewContext['ports']['recordText'];

export type ProcurementSummaryInput = Readonly<{
  suppliers: Rows;
  rfqs: Rows;
  purchaseOrders: Rows;
  balances: Rows;
}>;

type SummaryCard = Readonly<{
  id: string;
  label: string;
  unit: string;
  route: AppRoute;
  count: (input: ProcurementSummaryInput, recordText: RecordText) => number;
}>;

// 四张卡的口径（与原面板逐条一致）：状态非 APPROVED 的供应商、未关闭未取消的询价单、
// 已签发与部分收货的采购单、待检隔离的库存批次。四卡按位对应四条子路由。
const SUMMARY_CARDS: readonly SummaryCard[] = [
  {
    id: 'suppliers',
    label: '待准入供应商',
    unit: ' 家',
    route: 'procurement/suppliers',
    count: (input, recordText) =>
      input.suppliers.filter((item) => recordText(item, 'status', 'status') !== 'APPROVED').length,
  },
  {
    id: 'rfqs',
    label: '询价进行中',
    unit: ' 单',
    route: 'procurement/rfqs',
    count: (input, recordText) =>
      input.rfqs.filter(
        (item) => !['CLOSED', 'CANCELLED'].includes(recordText(item, 'status', 'status')),
      ).length,
  },
  {
    id: 'purchase-orders',
    label: '待收采购单',
    unit: ' 单',
    route: 'procurement/purchase-orders',
    count: (input, recordText) =>
      input.purchaseOrders.filter((item) =>
        ['ISSUED', 'PARTIALLY_RECEIVED'].includes(recordText(item, 'status', 'status')),
      ).length,
  },
  {
    id: 'inventory',
    label: '待检库存',
    unit: ' 批',
    route: 'procurement/goods-receipts',
    count: (input, recordText) =>
      input.balances.filter(
        (item) => recordText(item, 'qualityStatus', 'qualityStatus') === 'QUARANTINE',
      ).length,
  },
];

export function appendProcurementSummary(
  target: HTMLElement,
  input: ProcurementSummaryInput,
  recordText: RecordText,
  visibleRoutes: ReadonlySet<string>,
): void {
  const summary = el('div', 'production-summary procurement-summary');
  for (const card of SUMMARY_CARDS) {
    const text = `${card.label}\n${String(card.count(input, recordText))}${card.unit}`;
    const link = visibleRoutes.has(card.route)
      ? el('a', 'metric-card procurement-summary-link', text)
      : null;
    if (link) link.href = `#/${card.route}`;
    const node: HTMLElement = link ?? el('div', 'metric-card', text);
    node.setAttribute('data-testid', `procurement-summary-${card.id}`);
    summary.append(node);
  }
  target.append(summary);
}
