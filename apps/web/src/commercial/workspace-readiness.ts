import { el } from '../dom';
import type { CommercialPermission } from './permissions';
import type {
  WorkspaceAssemblyContext,
  WorkspaceReadinessController,
  WorkspaceReadinessPorts,
} from './workspace-assembly-ports';

export function appendWorkspaceReadiness(
  context: WorkspaceAssemblyContext<WorkspaceReadinessController>,
  ports: WorkspaceReadinessPorts,
): void {
  const { workspace, controller, permissions } = context;
  const { recordValue, contractOrderReadiness, quoteWorkflowReadiness, cashRiskSummary } = ports;
  if (
    controller &&
    ['quote:read', 'credit:read', 'contract:read', 'sales-order:read'].some((permission) =>
      permissions.has(permission as CommercialPermission),
    )
  ) {
    const flow = el('section', 'contract-order-readiness');
    flow.setAttribute('data-route-view', 'sales-orders');
    const heading = el('div', 'readiness-heading');
    heading.append(el('strong', '', '订单释放门禁'), el('span', '', '按当前可见业务数据计算'));
    flow.append(heading);
    const steps = el('ol', 'readiness-steps');
    const readiness = contractOrderReadiness(
      controller.views.get('/api/v1/quotes') ?? [],
      controller.views.get('/api/v1/credit-decisions') ?? [],
      controller.views.get('/api/v1/contracts') ?? [],
      controller.views.get('/api/v1/sales-orders') ?? [],
    );
    for (const [index, step] of readiness.entries()) {
      const item = el('li', `readiness-step ${step.state}`);
      item.append(
        el('span', 'readiness-index', step.state === 'complete' ? '✓' : String(index + 1)),
        el('span', 'readiness-label', step.label),
        el('strong', 'readiness-count', String(step.count)),
      );
      steps.append(item);
    }
    flow.append(steps);
    workspace.append(flow);
  }
  if (
    controller &&
    ['cost:read', 'sales-policy:read', 'quote:read'].some((permission) =>
      permissions.has(permission as CommercialPermission),
    )
  ) {
    const flow = el('section', 'contract-order-readiness quote-readiness');
    flow.setAttribute('data-route-view', 'quotes');
    const heading = el('div', 'readiness-heading');
    heading.append(el('strong', '', '报价生成门禁'), el('span', '', '仅展示当前账号可见数据'));
    flow.append(heading);
    const steps = el('ol', 'readiness-steps five-steps');
    const readiness = quoteWorkflowReadiness(
      controller.views.get('/api/v1/ctrs') ?? [],
      controller.views.get('/api/v1/technical-solutions') ?? [],
      controller.views.get('/api/v1/cost-evaluations') ?? [],
      controller.views.get('/api/v1/sales-policies') ?? [],
      controller.views.get('/api/v1/quotes') ?? [],
    );
    for (const [index, step] of readiness.entries()) {
      const item = el('li', `readiness-step ${step.state}`);
      item.append(
        el('span', 'readiness-index', step.state === 'complete' ? '✓' : String(index + 1)),
        el('span', 'readiness-label', step.label),
        el('strong', 'readiness-count', String(step.count)),
      );
      steps.append(item);
    }
    flow.append(steps);
    workspace.append(flow);
  }
  if (
    controller &&
    ['ar:read', 'bank-payment:read', 'collection:read', 'legal-case:read'].some((permission) =>
      permissions.has(permission as CommercialPermission),
    )
  ) {
    const queue = el('section', 'cash-risk-summary');
    queue.setAttribute('data-route-view', 'receivables');
    const heading = el('div', 'readiness-heading');
    heading.append(el('strong', '', '今日资金与债权队列'), el('span', '', '异常优先'));
    queue.append(heading);
    const collectionRows = controller.views.get('/api/v1/collection-cases') ?? [];
    const legalQueueVisible =
      collectionRows.length > 0 &&
      collectionRows.every(
        (item) =>
          Array.isArray(item.legalHandoffs) &&
          item.legalHandoffs.every((handoff: unknown) =>
            ['REQUESTED', 'ACCEPTED', 'RETURNED'].includes(String(recordValue(handoff).state)),
          ),
      );
    const summary = cashRiskSummary(
      controller.views.get('/api/v1/ar-open-items') ?? [],
      controller.views.get('/api/v1/bank-payments') ?? [],
      collectionRows,
    );
    const grid = el('div', 'cash-risk-grid');
    for (const [label, value, tone] of [
      ['逾期应收', summary.overdueReceivables, 'danger'],
      ['待核销收款', summary.unappliedPayments, 'attention'],
      ['承诺已违约', summary.brokenPromises, 'danger'],
      ['法务待受理', summary.legalPending, 'warning'],
    ] as const) {
      if (label === '逾期应收' && !permissions.has('ar:read')) continue;
      if (label === '待核销收款' && !permissions.has('bank-payment:read')) continue;
      if (label === '承诺已违约' && !permissions.has('collection:read')) continue;
      if (
        label === '法务待受理' &&
        (!permissions.has('legal-case:read') ||
          !permissions.has('collection:read') ||
          !legalQueueVisible)
      )
        continue;
      const item = el('article', `pipeline-metric ${value > 0 ? tone : 'success'}`);
      item.append(el('span', '', label), el('strong', '', String(value)));
      grid.append(item);
    }
    queue.append(grid);
    workspace.append(queue);
  }
}
