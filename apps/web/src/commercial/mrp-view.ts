import { el } from '../dom';
import type { OperationsViewContext } from './operations-view-ports';
import { appendMrpActions } from './mrp-actions';
import { appendMrpRun } from './mrp-run';

export function appendMrpView(context: OperationsViewContext): void {
  const { workspace, status, controller } = context;
  const { recordText, supplyModeLabel } = context.ports;
  const panel = el('section', 'mrp-workbench');
  panel.setAttribute('data-testid', 'mrp-workbench');
  panel.append(
    el('p', 'eyebrow', '物料需求计划'),
    el('h2', '', '物料需求与建议审批'),
    el('p', 'commercial-help', '物料需求、库存抵扣与供需建议'),
  );
  const policies = controller.views.get('/api/v1/mrp-policies') ?? [],
    demands = controller.views.get('/api/v1/mrp-demands') ?? [],
    runs = controller.views.get('/api/v1/mrp-runs') ?? [],
    items = controller.views.get('/api/v1/manufacturing-items') ?? [],
    latestRun = runs[0];
  const heading = el('div', 'mrp-summary');
  heading.append(
    el('div', 'metric-card', `计划政策\n${String(policies.length)} 项`),
    el('div', 'metric-card', `需求信号\n${String(demands.length)} 项`),
    el('div', 'metric-card', `计算批次\n${String(runs.length)} 次`),
    el(
      'div',
      'metric-card',
      `当前建议\n${String(Array.isArray(latestRun?.proposals) ? latestRun.proposals.length : 0)} 项`,
    ),
  );
  panel.append(heading);
  const actions = el('div', 'mrp-actions');
  const publishedItemOptions = items
    .filter((item) => recordText(item, 'status', 'status') === 'PUBLISHED')
    .map((item) => ({
      value: String(item.id),
      label: `${recordText(item, 'sku', 'sku')} · ${recordText(item, 'name', 'name')}`,
    }));
  const refresh = async () => {
    await controller.load();
    status.textContent = controller.message;
  };
  appendMrpActions(context, actions, publishedItemOptions, refresh);
  panel.append(actions);
  const policyGrid = el('div', 'mrp-policy-grid');
  for (const policy of policies)
    policyGrid.append(
      el(
        'article',
        'mrp-policy-card',
        `${recordText(policy, 'sku', 'sku')} · ${supplyModeLabel(recordText(policy, 'makeOrBuy', 'make_or_buy'))}\n安全库存 ${recordText(policy, 'safetyStock', 'safety_stock')} · 最小批量 ${recordText(policy, 'minimumOrderQuantity', 'minimum_order_quantity')} · 批量倍数 ${recordText(policy, 'orderMultiple', 'order_multiple')} · 提前期 ${recordText(policy, 'leadTimeDays', 'lead_time_days')} 天`,
      ),
    );
  panel.append(policyGrid);
  if (latestRun) {
    appendMrpRun(context, panel, latestRun, refresh);
  }
  workspace.append(panel);
}
