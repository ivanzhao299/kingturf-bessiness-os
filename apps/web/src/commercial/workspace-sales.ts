import type { WorkspaceAssemblyContext, SalesAssemblyController } from './workspace-assembly-ports';
import type { SalesViewPorts } from './sales-view-ports';
import type { PricingViewPorts } from './pricing-view-ports';
import type { CreditContractViewContext } from './credit-contract-view-ports';
import type { FulfillmentViewContext } from './fulfillment-view-ports';
import { appendOpportunityView } from './opportunity-view';
import { appendCtrView } from './ctr-view';
import { appendSolutionView } from './solution-view';
import { appendCostView } from './cost-view';
import { appendPolicyView } from './policy-view';
import { appendQuoteView } from './quote-view';
import { appendCreditView } from './credit-view';
import { appendContractView } from './contract-view';
import { appendSalesOrdersView } from './sales-orders-view';

export function appendWorkspaceSales(
  context: WorkspaceAssemblyContext<SalesAssemblyController>,
  salesViewPorts: SalesViewPorts,
  pricingViewPorts: PricingViewPorts,
  creditContractViewPorts: CreditContractViewContext['ports'],
  fulfillmentViewPorts: FulfillmentViewContext['ports'],
): void {
  const { workspace, status, controller, permissions } = context;
  if (controller && permissions.has('opportunity:read')) {
    appendOpportunityView(workspace, status, controller, permissions, salesViewPorts);
  }
  if (controller && permissions.has('ctr:read')) {
    appendCtrView(workspace, status, controller, permissions, salesViewPorts);
  }
  if (controller && permissions.has('technical-solution:read')) {
    appendSolutionView(workspace, status, controller, permissions, salesViewPorts);
  }
  if (
    controller &&
    (permissions.has('cost:read') ||
      permissions.has('cost-model:read') ||
      permissions.has('cost-matrix:read'))
  ) {
    appendCostView({ workspace, status, controller, permissions, ports: pricingViewPorts });
  }
  if (controller && permissions.has('sales-policy:read')) {
    appendPolicyView({ workspace, status, controller, permissions, ports: pricingViewPorts });
  }
  if (controller && permissions.has('quote:read')) {
    appendQuoteView({ workspace, status, controller, permissions, ports: pricingViewPorts });
  }
  if (controller && permissions.has('credit:read')) {
    appendCreditView({
      workspace,
      status,
      controller,
      permissions,
      ports: creditContractViewPorts,
    });
  }
  if (controller && permissions.has('contract:read')) {
    appendContractView({
      workspace,
      status,
      controller,
      permissions,
      ports: creditContractViewPorts,
    });
  }
  if (controller && permissions.has('sales-order:read')) {
    appendSalesOrdersView({
      workspace,
      status,
      controller,
      permissions,
      ports: fulfillmentViewPorts,
    });
  }
}
