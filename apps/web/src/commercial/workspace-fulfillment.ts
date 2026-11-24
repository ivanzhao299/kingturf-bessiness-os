import { el } from '../dom';
import type { WorkspaceAssemblyContext } from './workspace-assembly-ports';
import type { FulfillmentViewContext } from './fulfillment-view-ports';
import { appendProductionOrderConsole } from './console/production-order-host';
import type { ProductionOrderHostContext } from './console/production-order-host';
import { appendProductionCostView } from './production-cost-view';
import { appendShipmentsView } from './shipments-view';

// 工单区已迁 Preact 控制台（U3-MFG-4），其宿主需要 controller.api.get 走桥轨分页与详情；
// 成本与发货两区仍是 vanilla 视图，controller 最小面不变。
export function appendWorkspaceFulfillment(
  context: WorkspaceAssemblyContext<ProductionOrderHostContext['controller']>,
  fulfillmentViewPorts: FulfillmentViewContext['ports'],
): void {
  const { workspace, status, controller, permissions } = context;
  if (controller && permissions.has('production:read')) {
    // 面板与其 data-testid / 路由标记（.production-workbench → production-orders）保持不变。
    const panel = el('section', 'production-workbench');
    panel.setAttribute('data-testid', 'production-workbench');
    panel.append(
      el('p', 'eyebrow', '车间执行'),
      el('h2', '', '生产工单与车间执行'),
      el('p', 'commercial-help', '生产工单、报工、用料与成品入库'),
    );
    // U3-MFG-4：工单卡片迁移至 Preact 控制台（状态汇总 / 主表 / 详情与流转抽屉）；原
    // vanilla 卡片视图退役（裁定 17 语义）。工序报工 / 领退料 / 成品卷入库表单仍为
    // vanilla（MFG-5 报工入库范围），经宿主挂进控制台详情抽屉。
    appendProductionOrderConsole(
      { workspace, status, controller, permissions, ports: fulfillmentViewPorts },
      panel,
    );
    workspace.append(panel);
  }
  if (controller && permissions.has('manufacturing-cost:read')) {
    appendProductionCostView({
      workspace,
      status,
      controller,
      permissions,
      ports: fulfillmentViewPorts,
    });
  }
  if (controller && permissions.has('shipment:read')) {
    appendShipmentsView({
      workspace,
      status,
      controller,
      permissions,
      ports: fulfillmentViewPorts,
    });
  }
}
