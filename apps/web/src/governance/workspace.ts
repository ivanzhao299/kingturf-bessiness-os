import { el } from '../dom';
import type { GovernanceController } from './controller';
import type { GovernanceWorkspacePorts } from './workspace-types';
import { createGovernanceFormActions } from './workspace-actions';
import { createGovernanceHeading } from './workspace-heading';
import { createGovernanceOrdering } from './workspace-ordering';
import { createGovernanceCard } from './workspace-card';
import { appendGovernanceSources } from './workspace-sources';
import { appendGovernanceOrganizationActions } from './organization-actions';
import { appendGovernanceEmployeeActions } from './employee-actions';
import { appendGovernanceIdentityActions } from './identity-actions';
import { appendGovernanceMasterDataActions } from './master-data-actions';
import { appendGovernanceNumberingActions } from './numbering-actions';
import { appendGovernanceRuleActions } from './rule-actions';
import { appendGovernanceWorkflowActions } from './workflow-actions';
import { appendGovernanceTaskActions } from './workflow-task-actions';
import { appendGovernanceNotificationActions } from './notification-actions';
import { appendGovernanceRegistryActions } from './registry-actions';
export function createGovernanceWorkspace(ports: GovernanceWorkspacePorts) {
  const { replaceRouteView } = ports;
  function governanceWorkspace(controller: GovernanceController): HTMLElement {
    const { permissions, views } = controller;
    const headingNodes = createGovernanceHeading({ permissions, views });
    const { workspace, visible } = headingNodes;
    const formActions = createGovernanceFormActions(
      { controller, views, workspace },
      { replaceRouteView, governanceWorkspace },
    );
    const renderContext = { controller, permissions, views, workspace, visible, ...formActions };
    const grid = el('section', 'governance-grid');
    const { prioritizedSurfaces } = createGovernanceOrdering(renderContext);
    for (const surface of prioritizedSurfaces) {
      const card = createGovernanceCard({ views, surface });
      const { panel, actions } = card;
      const context = { ...renderContext, surface, ...card };
      appendGovernanceOrganizationActions(context);
      appendGovernanceEmployeeActions(context);
      appendGovernanceIdentityActions(context);
      appendGovernanceMasterDataActions(context);
      appendGovernanceNumberingActions(context);
      appendGovernanceRuleActions(context);
      appendGovernanceWorkflowActions(context);
      appendGovernanceTaskActions(context);
      appendGovernanceNotificationActions(context);
      appendGovernanceRegistryActions(context);
      if (actions.children.length > 0) panel.append(actions);
      appendGovernanceSources(context);
      grid.append(panel);
    }
    workspace.append(grid);
    return workspace;
  }
  return governanceWorkspace;
}
