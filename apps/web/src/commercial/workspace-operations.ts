import { el } from '../dom';
import type { WorkspaceAssemblyContext } from './workspace-assembly-ports';
import type { CommercialController } from './store/controller';
import type { OperationsViewContext } from './operations-view-ports';
import { appendManufacturingView } from './manufacturing-view';
import { appendProcurementView } from './procurement-view';
import { appendMrpConsole } from './console/mrp-host';
import { appendQualityConsole } from './console/quality-host';

export function appendWorkspaceOperations(
  context: WorkspaceAssemblyContext<
    OperationsViewContext['controller'] & Pick<CommercialController, 'refreshViews'>
  >,
  operationsViewPorts: OperationsViewContext['ports'],
): void {
  const { workspace, status, controller, permissions } = context;
  if (
    controller &&
    (permissions.has('manufacturing-item:read') ||
      permissions.has('bom:read') ||
      permissions.has('routing:read'))
  ) {
    const panel = el('section', 'manufacturing-workbench');
    appendManufacturingView(
      {
        workspace,
        status,
        controller,
        permissions,
        ports: operationsViewPorts,
      },
      panel,
    );
  }
  if (
    controller &&
    (permissions.has('supplier:read') ||
      permissions.has('procurement:read') ||
      permissions.has('inventory:read') ||
      permissions.has('inventory:move'))
  ) {
    appendProcurementView({
      workspace,
      status,
      controller,
      permissions,
      ports: operationsViewPorts,
    });
  }
  // MFG-6：物料需求计划迁入 Preact 控制台（旧版 mrp-view / mrp-actions / mrp-run / mrp-proposals
  // 退役）；面板 .mrp-workbench、它的 data-testid 与路由标记保持不变。
  if (controller && (permissions.has('mrp:read') || permissions.has('mrp-policy:read'))) {
    const panel = el('section', 'mrp-workbench');
    panel.setAttribute('data-testid', 'mrp-workbench');
    appendMrpConsole(
      { workspace, status, controller, permissions, ports: operationsViewPorts },
      panel,
    );
    workspace.append(panel);
  }
  if (
    controller &&
    (permissions.has('quality-plan:read') ||
      permissions.has('quality:read') ||
      permissions.has('traceability:read') ||
      permissions.has('complaint:read'))
  ) {
    appendQualityConsole({
      workspace,
      status,
      controller,
      permissions,
      ports: operationsViewPorts,
    });
  }
}
