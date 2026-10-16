import { el } from '../dom';
import type { WorkspaceAssemblyContext, WorkspaceDashboardPorts } from './workspace-assembly-ports';

export function appendWorkspaceDashboard(
  context: WorkspaceAssemblyContext<{ dashboard: Record<string, unknown> | null }>,
  ports: WorkspaceDashboardPorts,
): void {
  const { workspace, controller, permissions } = context;
  const { recordValue, recordText, currencyLabel, businessStateLabel } = ports;
  if (controller?.dashboard && permissions.has('executive-dashboard:read')) {
    const dashboard = controller.dashboard,
      metrics = recordValue(dashboard.metrics),
      filters = recordValue(dashboard.filters),
      drilldowns = recordValue(dashboard.drilldowns);
    const panel = el('section', 'executive-dashboard');
    const heading = el('div', 'pipeline-heading');
    const copy = el('div');
    copy.append(
      el('p', 'eyebrow', '经营驾驶舱'),
      el('h2', '', '管理驾驶舱'),
      el(
        'p',
        '',
        `${currencyLabel(recordText(filters, 'currency', 'currency', 'CNY'))} · ${recordText(filters, 'from', 'from').slice(0, 10)} 至 ${recordText(filters, 'to', 'to').slice(0, 10)} · 刷新 ${recordText(dashboard, 'refreshedAt', 'refreshedAt').slice(0, 16).replace('T', ' ')}`,
      ),
    );
    heading.append(copy);
    panel.append(heading);
    const labels: Record<string, string> = {
      weightedForecast: '加权销售预测',
      bookedRevenue: '已签订单',
      grossMargin: '订单毛利',
      cashCollected: '已核销现金',
      openReceivable: '应收余额',
      overdueReceivable: '逾期应收',
      releasedOrders: '已释放订单',
      activeRisks: '活动风险',
      criticalRisks: '严重风险',
      commissionAccrued: '佣金计提',
    };
    const grid = el('div', 'metric-grid executive-metrics');
    for (const [key, raw] of Object.entries(metrics)) {
      const metric = recordValue(raw),
        card = el('article', `metric-card metric-${key}`);
      card.append(
        el('span', 'metric-label', labels[key] ?? key),
        el(
          'strong',
          'metric-value',
          `${recordText(metric, 'unit', 'unit')} ${recordText(metric, 'value', 'value', '0')}`,
        ),
        el(
          'p',
          'muted',
          `${recordText(metric, 'basis', 'basis')} · 来源 ${recordText(metric, 'source', 'source')}`,
        ),
      );
      grid.append(card);
    }
    panel.append(grid);
    const orders = Array.isArray(drilldowns.orders) ? drilldowns.orders.map(recordValue) : [],
      risks = Array.isArray(drilldowns.risks) ? drilldowns.risks.map(recordValue) : [];
    const details = el('div', 'dashboard-drilldowns'),
      orderList = el('article', 'dashboard-list'),
      riskList = el('article', 'dashboard-list');
    orderList.append(el('h3', '', '订单贡献明细'));
    for (const order of orders)
      orderList.append(
        el(
          'p',
          '',
          `${recordText(order, 'orderNumber', 'orderNumber')} · ${recordText(filters, 'currency', 'currency')} ${recordText(order, 'total', 'total')} · 毛利 ${recordText(order, 'margin', 'margin')}`,
        ),
      );
    riskList.append(el('h3', '', '风险责任明细'));
    for (const risk of risks)
      riskList.append(
        el(
          'p',
          '',
          `${businessStateLabel(recordText(risk, 'severity', 'severity'))} / ${recordText(risk, 'score', 'score')} 分 · ${businessStateLabel(recordText(risk, 'state', 'state'))} · 订单 ${recordText(risk, 'salesOrderId', 'salesOrderId').slice(0, 8)}`,
        ),
      );
    if (!risks.length) riskList.append(el('p', 'success-note', '当前无风险评价。'));
    details.append(orderList, riskList);
    panel.append(details);
    workspace.append(panel);
  }
}
