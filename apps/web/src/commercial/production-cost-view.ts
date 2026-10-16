import { el } from '../dom';
import { openForm } from '../shared/forms';
import type { FulfillmentViewContext } from './fulfillment-view-ports';
import { createProductionCostPolicyButton } from './production-cost-policy';

function createProductionCostCard(
  context: FulfillmentViewContext,
  run: Record<string, unknown>,
): HTMLElement {
  const { workspace, status, controller, permissions } = context;
  const { recordText, businessStateLabel, operationsNextAction } = context.ports;
  const runState = recordText(run, 'state', 'state');
  const card = el('article', 'production-order-card');
  card.append(
    el(
      'h3',
      '',
      `${recordText(run, 'run_number', 'runNumber')} · ${businessStateLabel(recordText(run, 'state', 'state'))}`,
    ),
    el(
      'p',
      '',
      `工单 ${recordText(run, 'orderNumber', 'orderNumber')} · ${recordText(run, 'currency', 'currency')}`,
    ),
    el(
      'p',
      '',
      `计划 ${recordText(run, 'planned_total', 'plannedTotal')} · 实际 ${recordText(run, 'actual_total', 'actualTotal')} · 差异 ${recordText(run, 'variance_total', 'varianceTotal')}`,
    ),
    el('p', 'next-action-note', `下一步：${operationsNextAction('cost', runState)}`),
  );
  if (permissions.has('manufacturing-cost:approve') && runState === 'CALCULATED') {
    const approve = el('button', 'primary', '批准成本');
    approve.addEventListener('click', () => {
      openForm(
        workspace,
        '批准制造成本',
        '请确认计划与实际差异，并留下可追溯的复核依据。',
        [
          { name: 'reason', label: '审批理由', type: 'textarea', required: true },
          { name: 'evidenceReference', label: '复核凭证编号', required: true },
        ],
        '确认批准',
        async (values) => {
          await controller.submit(`/api/v1/production-cost-runs/${String(run.id)}/approve`, {
            reason: values.reason,
            evidence: { reference: values.evidenceReference },
            idempotencyKey: `APPROVE-${String(run.id)}-${String(values.evidenceReference)}`,
          });
          await controller.load();
          status.textContent = controller.message;
        },
      );
    });
    card.append(approve);
  }
  return card;
}

export function appendProductionCostView(context: FulfillmentViewContext): void {
  const { workspace, status, controller, permissions } = context;
  const { recordText } = context.ports;
  const panel = el('section', 'production-workbench');
  panel.setAttribute('data-testid', 'manufacturing-cost-workbench');
  const policies = controller.views.get('/api/v1/production-cost-policies') ?? [];
  const runs = controller.views.get('/api/v1/production-cost-runs') ?? [];
  const orders = controller.views.get('/api/v1/production-orders') ?? [];
  panel.append(
    el('p', 'eyebrow', '制造成本分析'),
    el('h2', '', '实际制造成本与差异'),
    el('p', 'commercial-help', '生产成本核算与差异分析'),
  );
  const summary = el('div', 'production-summary');
  summary.append(
    el('div', 'metric-card', `成本政策\n${String(policies.length)} 个版本`),
    el('div', 'metric-card', `已核算工单\n${String(runs.length)} 张`),
    el(
      'div',
      'metric-card',
      `待审批\n${String(runs.filter((x) => recordText(x, 'state', 'state') === 'CALCULATED').length)} 张`,
    ),
    el(
      'div',
      'metric-card',
      `已批准\n${String(runs.filter((x) => recordText(x, 'state', 'state') === 'APPROVED').length)} 张`,
    ),
  );
  panel.append(summary);
  if (permissions.has('manufacturing-cost:policy')) {
    const materialItems = (controller.views.get('/api/v1/manufacturing-items') ?? []).filter(
      (item) =>
        recordText(item, 'status', 'status') === 'PUBLISHED' &&
        recordText(item, 'sku', 'sku').startsWith('RM-'),
    );
    if (materialItems.length) {
      const createPolicy = createProductionCostPolicyButton(context, policies, materialItems);
      panel.append(createPolicy);
    }
  }
  if (permissions.has('manufacturing-cost:calculate') && policies.length) {
    for (const order of orders.filter(
      (x) =>
        recordText(x, 'state', 'state') === 'COMPLETED' &&
        !runs.some(
          (r) => recordText(r, 'production_order_id', 'productionOrderId') === String(x.id),
        ),
    )) {
      const orderNumber = recordText(order, 'orderNumber', 'order_number');
      const button = el('button', 'secondary', `核算 ${orderNumber}`);
      button.addEventListener('click', () => {
        void (async () => {
          await controller.submit('/api/v1/production-cost-runs', {
            productionOrderId: String(order.id),
            policyId: String(policies[0]?.id),
            runNumber: `COST-${orderNumber}`,
            idempotencyKey: `COST-${orderNumber}`,
          });
          await controller.load();
          status.textContent = controller.message;
        })();
      });
      panel.append(button);
    }
  }
  const grid = el('div', 'production-order-grid');
  const costPriority: Readonly<Record<string, number>> = { CALCULATED: 0, APPROVED: 1 };
  for (const run of [...runs].sort(
    (left, right) =>
      (costPriority[recordText(left, 'state', 'state')] ?? 9) -
      (costPriority[recordText(right, 'state', 'state')] ?? 9),
  )) {
    const card = createProductionCostCard(context, run);
    grid.append(card);
  }
  if (!runs.length)
    grid.append(el('p', 'success-note', '暂无已核算工单；生产工单完工后由制造成本核算会计发起。'));
  panel.append(grid);
  workspace.append(panel);
}
