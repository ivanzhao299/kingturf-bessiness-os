import type { WorkspaceAssemblyContext, SalesAssemblyController } from './workspace-assembly-ports';
import type { SalesViewPorts } from './sales-view-ports';
import type { PricingViewPorts } from './pricing-view-ports';
import type { CreditContractViewContext } from './credit-contract-view-ports';
import type { FulfillmentViewContext } from './fulfillment-view-ports';
import {
  appendOpportunityConsole,
  appendSolutionConsole,
  appendQuoteConsole,
  appendCostMatrixConsole,
  appendCtrConsole,
  appendPolicyConsole,
} from './console-entry';
import { appendCostView } from './cost-view';
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
    // U3-COM-1：商机路由切换至 Preact 控制台（controller 与展示端口最小面直通；
    // 原 vanilla pipeline-board 随本次迁移退役）。
    appendOpportunityConsole(workspace, controller, permissions, salesViewPorts);
  }
  if (controller && permissions.has('ctr:read')) {
    // U3-COM-5：CTR 路由切换至 Preact 控制台（原 vanilla ctr workbench 随本次迁移退役）。
    appendCtrConsole(workspace, controller, permissions, salesViewPorts);
  }
  if (controller && permissions.has('technical-solution:read')) {
    // U3-COM-2：技术方案路由切换至 Preact 控制台（原 vanilla workbench 随本次迁移退役）。
    appendSolutionConsole(workspace, controller, permissions, salesViewPorts);
  }
  if (
    controller &&
    (permissions.has('cost:read') ||
      permissions.has('cost-model:read') ||
      permissions.has('cost-matrix:read'))
  ) {
    appendCostView({ workspace, status, controller, permissions, ports: pricingViewPorts });
    // U3-COM-4：矩阵区迁移至 Preact 控制台（原 vanilla ledger/detail 随本次迁移退役）。
    appendCostMatrixConsole(workspace, controller, permissions, pricingViewPorts);
  }
  if (controller && permissions.has('sales-policy:read')) {
    // U3-COM-6：销售政策路由切换至 Preact 控制台（原 vanilla policy workbench 随本次迁移退役）。
    appendPolicyConsole(workspace, controller, permissions, pricingViewPorts);
  }
  if (controller && permissions.has('quote:read')) {
    // U3-COM-3：报价路由切换至 Preact 控制台（原 vanilla quote workbench 随本次迁移退役）。
    appendQuoteConsole(workspace, controller, permissions, pricingViewPorts);
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
