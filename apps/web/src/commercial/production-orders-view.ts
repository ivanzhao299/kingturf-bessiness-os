import { el } from '../dom';
import { openForm } from '../shared/forms';
import type { FulfillmentViewContext } from './fulfillment-view-ports';
import {
  appendProductionTransition,
  appendProductionReport,
  appendProductionMaterial,
  appendProductionOutput,
} from './production-actions';

function appendProductionCreation(
  context: FulfillmentViewContext,
  panel: HTMLElement,
  refresh: () => Promise<void>,
): void {
  const { workspace, controller, permissions } = context;
  const { recordText } = context.ports;
  if (permissions.has('production:plan')) {
    const create = el('button', 'primary', '＋ 新建生产工单');
    create.addEventListener('click', () => {
      const items = controller.views.get('/api/v1/manufacturing-items') ?? [];
      const routings = controller.views.get('/api/v1/manufacturing-routings') ?? [];
      openForm(
        workspace,
        '建立生产工单',
        '工单引用已发布物料和工艺版本；保存时固定全部标准工序快照。',
        [
          { name: 'orderNumber', label: '工单编号', required: true },
          {
            name: 'itemVersionId',
            label: '成品版本',
            type: 'select',
            required: true,
            options: items
              .filter((item) => recordText(item, 'status', 'status') === 'PUBLISHED')
              .map((item) => ({
                value: String(item.id),
                label: `${recordText(item, 'sku', 'sku')} · ${recordText(item, 'name', 'name')}`,
              })),
          },
          {
            name: 'routingVersionId',
            label: '已发布工艺版本',
            type: 'select',
            required: true,
            options: routings.map((item) => ({
              value: String(item.id),
              label: `${recordText(item, 'code', 'code')} · ${recordText(item, 'name', 'name')}`,
            })),
          },
          { name: 'mrpProposalId', label: '物料需求建议编号（可选）' },
          { name: 'plannedQuantity', label: '计划数量', type: 'number', required: true },
          { name: 'plannedStartAt', label: '计划开始', type: 'date', required: true },
          { name: 'plannedDueAt', label: '计划完成', type: 'date', required: true },
          { name: 'sourceReference', label: '来源唯一编号', required: true },
        ],
        '保存工单',
        async (values) => {
          await controller.submit('/api/v1/production-orders', {
            ...values,
            ...(values.mrpProposalId ? {} : { mrpProposalId: undefined }),
          });
          await refresh();
        },
      );
    });
    panel.append(create);
  }
}

function createProductionCard(
  context: FulfillmentViewContext,
  order: Record<string, unknown>,
  refresh: () => Promise<void>,
): HTMLElement {
  const { recordText, recordValue, businessStateLabel, operationsNextAction } = context.ports;
  const state = recordText(order, 'state', 'state');
  const operations = Array.isArray(order.operations) ? order.operations.map(recordValue) : [];
  const materials = Array.isArray(order.materials) ? order.materials.map(recordValue) : [];
  const reports = Array.isArray(order.reports) ? order.reports.map(recordValue) : [];
  const rolls = Array.isArray(order.rolls) ? order.rolls.map(recordValue) : [];
  const events = Array.isArray(order.events) ? order.events.map(recordValue) : [];
  const card = el('article', 'production-order-card');
  card.append(
    el(
      'h3',
      '',
      `${recordText(order, 'orderNumber', 'order_number')} · ${recordText(order, 'sku', 'sku')}`,
    ),
    el('span', `ctr-state state-${state.toLowerCase()}`, businessStateLabel(state)),
    el(
      'p',
      '',
      `计划 ${recordText(order, 'plannedQuantity', 'planned_quantity')} · ${recordText(order, 'plannedStartAt', 'planned_start_at').slice(0, 10)} → ${recordText(order, 'plannedDueAt', 'planned_due_at').slice(0, 10)}`,
    ),
    el('p', 'next-action-note', `下一步：${operationsNextAction('production', state)}`),
  );
  const flow = el('div', 'production-flow');
  for (const operation of operations) {
    const operationReports = reports.filter(
      (report) =>
        recordText(report, 'productionOrderOperationId', 'production_order_operation_id') ===
        String(operation.id),
    );
    flow.append(
      el(
        'div',
        `production-operation ${operationReports.length ? 'done' : ''}`,
        `${recordText(operation, 'sequence', 'sequence')} · ${recordText(operation, 'name', 'name')}\n${recordText(operation, 'workCenter', 'work_center')} · 良品 ${String(operationReports.reduce((sum, report) => sum + Number(recordText(report, 'goodQuantity', 'good_quantity') || 0), 0))}`,
      ),
    );
  }
  card.append(flow);
  const evidenceGrid = el('div', 'production-evidence-grid');
  evidenceGrid.append(
    el(
      'div',
      'evidence-card',
      `物料台账\n${materials.map((item) => `${businessStateLabel(recordText(item, 'transactionType', 'transaction_type'))} ${recordText(item, 'quantity', 'quantity')}`).join('\n') || '尚未领料'}`,
    ),
    el(
      'div',
      'evidence-card',
      `成品序列\n${rolls.map((item) => `${recordText(item, 'rollNumber', 'roll_number')} · ${recordText(item, 'quantity', 'quantity')} · ${businessStateLabel(recordText(item, 'status', 'status'))}`).join('\n') || '尚未入库'}`,
    ),
    el(
      'div',
      'evidence-card',
      `状态证据\n${events.map((item) => businessStateLabel(recordText(item, 'state', 'state'))).join(' → ')}`,
    ),
  );
  card.append(evidenceGrid);
  const actions = el('div', 'production-actions');
  appendProductionTransition(context, order, state, actions, refresh);
  appendProductionReport(context, order, state, operations, actions, refresh);
  appendProductionMaterial(context, order, state, actions, refresh);
  appendProductionOutput(context, order, state, reports, actions, refresh);
  card.append(actions);
  return card;
}

export function appendProductionOrdersView(context: FulfillmentViewContext): void {
  const { workspace, status, controller } = context;
  const { recordText } = context.ports;
  const panel = el('section', 'production-workbench');
  panel.setAttribute('data-testid', 'production-workbench');
  const productionPriority: Readonly<Record<string, number>> = {
    IN_PROGRESS: 0,
    RELEASED: 1,
    COMPLETED: 2,
    DRAFT: 3,
    CLOSED: 4,
  };
  const orders = [...(controller.views.get('/api/v1/production-orders') ?? [])].sort(
    (left, right) =>
      (productionPriority[recordText(left, 'state', 'state')] ?? 9) -
      (productionPriority[recordText(right, 'state', 'state')] ?? 9),
  );
  const refresh = async () => {
    await controller.load();
    status.textContent = controller.message;
  };
  panel.append(
    el('p', 'eyebrow', '车间执行'),
    el('h2', '', '生产工单与车间执行'),
    el('p', 'commercial-help', '生产工单、报工、用料与成品入库'),
  );
  appendProductionCreation(context, panel, refresh);
  const summary = el('div', 'production-summary');
  summary.append(
    el('div', 'metric-card', `生产工单\n${String(orders.length)} 张`),
    el(
      'div',
      'metric-card',
      `执行中\n${String(orders.filter((order) => recordText(order, 'state', 'state') === 'IN_PROGRESS').length)} 张`,
    ),
    el(
      'div',
      'metric-card',
      `累计报工\n${String(orders.reduce((sum, order) => sum + (Array.isArray(order.reports) ? order.reports.length : 0), 0))} 条`,
    ),
    el(
      'div',
      'metric-card',
      `成品卷\n${String(orders.reduce((sum, order) => sum + (Array.isArray(order.rolls) ? order.rolls.length : 0), 0))} 卷`,
    ),
  );
  panel.append(summary);
  const grid = el('div', 'production-order-grid');
  for (const order of orders) {
    const card = createProductionCard(context, order, refresh);
    grid.append(card);
  }
  panel.append(grid);
  workspace.append(panel);
}
