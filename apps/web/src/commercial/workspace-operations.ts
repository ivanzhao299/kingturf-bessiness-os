import { el } from '../dom';
import type { WorkspaceAssemblyContext } from './workspace-assembly-ports';
import type { OperationsViewContext } from './operations-view-ports';
import { appendManufacturingView } from './manufacturing-view';
import { appendProcurementView } from './procurement-view';
import { appendMrpView } from './mrp-view';
import { appendQualityView } from './quality-view';

export function appendWorkspaceOperations(
  context: WorkspaceAssemblyContext<OperationsViewContext['controller']>,
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
  if (controller && (permissions.has('mrp:read') || permissions.has('mrp-policy:read'))) {
    appendMrpView({ workspace, status, controller, permissions, ports: operationsViewPorts });
  }
  if (
    controller &&
    (permissions.has('quality-plan:read') ||
      permissions.has('quality:read') ||
      permissions.has('traceability:read') ||
      permissions.has('complaint:read'))
  ) {
    appendQualityView({ workspace, status, controller, permissions, ports: operationsViewPorts });
  }
}
