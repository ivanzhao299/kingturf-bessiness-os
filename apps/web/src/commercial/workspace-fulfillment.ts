import type { WorkspaceAssemblyContext } from './workspace-assembly-ports';
import type { FulfillmentViewContext } from './fulfillment-view-ports';
import { appendProductionOrdersView } from './production-orders-view';
import { appendProductionCostView } from './production-cost-view';
import { appendShipmentsView } from './shipments-view';

export function appendWorkspaceFulfillment(
  context: WorkspaceAssemblyContext<FulfillmentViewContext['controller']>,
  fulfillmentViewPorts: FulfillmentViewContext['ports'],
): void {
  const { workspace, status, controller, permissions } = context;
  if (controller && permissions.has('production:read')) {
    appendProductionOrdersView({
      workspace,
      status,
      controller,
      permissions,
      ports: fulfillmentViewPorts,
    });
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
