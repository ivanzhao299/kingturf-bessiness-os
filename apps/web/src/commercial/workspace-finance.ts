import type { WorkspaceAssemblyContext } from './workspace-assembly-ports';
import type { FinanceRiskViewContext } from './finance-risk-view-ports';
import { appendReceivablesView } from './receivables-view';
import { appendCollectionsView } from './collections-view';
import { appendPaymentsView } from './payments-view';
import { appendCommissionView } from './commission-view';
import { appendRiskView } from './risk-view';

export function appendWorkspaceFinance(
  context: WorkspaceAssemblyContext<FinanceRiskViewContext['controller']>,
  financeRiskViewPorts: FinanceRiskViewContext['ports'],
  riskPolicyControls: HTMLElement | null,
): void {
  const { workspace, status, controller, permissions } = context;
  if (controller && permissions.has('ar:read')) {
    appendReceivablesView({
      workspace,
      status,
      controller,
      permissions,
      ports: financeRiskViewPorts,
    });
  }
  if (controller && permissions.has('collection:read')) {
    appendCollectionsView({
      workspace,
      status,
      controller,
      permissions,
      ports: financeRiskViewPorts,
    });
  }
  if (controller && permissions.has('bank-payment:read')) {
    appendPaymentsView({ workspace, status, controller, permissions, ports: financeRiskViewPorts });
  }
  if (
    controller &&
    (permissions.has('commission:read') || permissions.has('commission-policy:read'))
  ) {
    appendCommissionView({
      workspace,
      status,
      controller,
      permissions,
      ports: financeRiskViewPorts,
    });
  }
  if (controller && (permissions.has('risk:read') || permissions.has('risk-policy:read'))) {
    appendRiskView(
      { workspace, status, controller, permissions, ports: financeRiskViewPorts },
      riskPolicyControls,
    );
  }
}
