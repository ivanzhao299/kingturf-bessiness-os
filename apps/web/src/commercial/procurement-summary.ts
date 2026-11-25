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
  // 承载该指标明细的子路由；没有这样的子路由时为 null，卡片保持纯指标。
  route: AppRoute | null;
  query?: string;
  count: (input: ProcurementSummaryInput, recordText: RecordText) => number;
}>;

// TD-PROC-012（2026-11-24 裁定）：待准入供应商 = 没有任何已批准或可有条件批准的物料准入记录的供应商
// （APPROVED / CONDITIONAL 都算已准入）。原口径按 suppliers.status 过滤，而供应商状态只有
// ACTIVE / ON_HOLD / INACTIVE，没有 APPROVED——这张卡恒等于供应商总数。供应商列表每行自带
// qualifications 聚合（supplier_item_qualifications，状态 APPROVED | CONDITIONAL | REJECTED），
// 所以不必新增请求；按裁定只看准入状态，不看准入记录的有效期。
const ADMITTED_QUALIFICATIONS: readonly string[] = ['APPROVED', 'CONDITIONAL'];
const isAdmitted = (supplier: Rows[number], recordText: RecordText): boolean => {
  const raw = supplier.qualifications;
  const qualifications: readonly unknown[] = Array.isArray(raw) ? raw : [];
  return qualifications.some((item) =>
    ADMITTED_QUALIFICATIONS.includes(
      recordText(item as Record<string, unknown>, 'status', 'status'),
    ),
  );
};

// 四张卡的口径：没有任何已批准 / 可有条件批准准入记录的供应商（见上）、未关闭未取消的询价单、
// 已签发与部分收货的采购单、待检隔离的库存批次（后三张与原面板逐条一致）。前三张对应三条子路由；
// 「待检库存」打开批次库存的待检隔离筛选。
const SUMMARY_CARDS: readonly SummaryCard[] = [
  {
    id: 'suppliers',
    label: '待准入供应商',
    unit: ' 家',
    route: 'procurement/suppliers',
    count: (input, recordText) =>
      input.suppliers.filter((item) => !isAdmitted(item, recordText)).length,
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
    route: 'procurement/inventory',
    query: 'quality=QUARANTINE',
    count: (input, recordText) =>
      input.balances.filter(
        (item) => recordText(item, 'qualityStatus', 'qualityStatus') === 'QUARANTINE',
      ).length,
  },
];

/** 渲染四张汇总卡并返回重算函数（TD-PROC-013）：按 input() 的当前值更新各卡文字，不新增、不替换节点。
 *  数据经取数回调读取而不是渲染那一刻的数组——路由视图只构建一次，子路由上新建供应商 / 发出询价 /
 *  签发订单之后回到概览，面板不会重建；四个采购宿主的 refresh 端口在 controller.load 重读完成后调用它。 */
export function appendProcurementSummary(
  target: HTMLElement,
  input: () => ProcurementSummaryInput,
  recordText: RecordText,
  visibleRoutes: ReadonlySet<string>,
): () => void {
  const summary = el('div', 'production-summary procurement-summary');
  const nodes: (HTMLElement | undefined)[] = [];
  const render = (): void => {
    const current = input();
    SUMMARY_CARDS.forEach((card, index) => {
      const text = `${card.label}\n${String(card.count(current, recordText))}${card.unit}`;
      const existing = nodes[index];
      if (existing) {
        existing.textContent = text;
        return;
      }
      const link =
        card.route !== null && visibleRoutes.has(card.route)
          ? el('a', 'metric-card procurement-summary-link', text)
          : null;
      if (link) link.href = `#/${String(card.route)}${card.query ? `?${card.query}` : ''}`;
      const node: HTMLElement = link ?? el('div', 'metric-card', text);
      node.setAttribute('data-testid', `procurement-summary-${card.id}`);
      nodes[index] = node;
      summary.append(node);
    });
  };
  render();
  target.append(summary);
  return render;
}
