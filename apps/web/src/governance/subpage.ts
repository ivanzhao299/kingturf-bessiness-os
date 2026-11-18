import { el } from '../dom';
import { APP_ROUTE_DESCRIPTIONS, APP_ROUTE_LABELS, type AppRoute } from '../shared/navigation';
import type { GovernanceController } from './controller';
import { governanceSurfacesForRoute, visibleGovernanceSurfaces } from './surfaces';
import { createGovernanceFormActions } from './workspace-actions';
import type { GovernanceWorkspacePorts } from './workspace-types';
type SubpageAssemblyPorts = Pick<GovernanceWorkspacePorts, 'replaceRouteView'>;
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
import { createTenantSettingsSection } from './tenant-settings';

// B1 治理子路由页：标题 + 该域全量列表 + 既有操作按钮组（*-actions 原样挂载）。
// surface 定义复用为路由注册表（surfaces.ts route 字段），此处不重复权限判定。
const SURFACE_APPENDERS = [
  appendGovernanceOrganizationActions,
  appendGovernanceEmployeeActions,
  appendGovernanceIdentityActions,
  appendGovernanceMasterDataActions,
  appendGovernanceNumberingActions,
  appendGovernanceRuleActions,
  appendGovernanceWorkflowActions,
  appendGovernanceTaskActions,
  appendGovernanceNotificationActions,
  appendGovernanceRegistryActions,
] as const;

export function createGovernanceSubpages(ports: SubpageAssemblyPorts) {
  const { replaceRouteView } = ports;
  const build = (controller: GovernanceController, route: AppRoute): HTMLElement => {
    const { permissions, views } = controller;
    const section = el('section', 'governance-workspace governance-subpage');
    section.setAttribute('data-route-view', route);
    const header = el('header', 'governance-hero');
    header.append(
      el('p', 'eyebrow', '企业管理控制台'),
      el('h2', '', APP_ROUTE_LABELS[route]),
      el('p', 'muted', APP_ROUTE_DESCRIPTIONS[route]),
    );
    section.append(header);
    const visible = visibleGovernanceSurfaces(permissions);
    const formActions = createGovernanceFormActions(
      { controller, views, workspace: section },
      { replaceRouteView, rebuild: () => build(controller, route) },
    );
    const renderContext = {
      controller,
      permissions,
      views,
      workspace: section,
      visible,
      ...formActions,
    };
    for (const surface of governanceSurfacesForRoute(visible, route)) {
      const panel = el('article', 'governance-card governance-domain-card');
      const heading = el('header', 'panel-head');
      heading.append(
        el('div', '', surface.title),
        el(
          'span',
          `status-badge ${surface.disposition === 'SUPPORTING' ? 'warning' : 'success'}`,
          surface.disposition === 'SUPPORTING' ? '运行监控' : '配置管理',
        ),
      );
      panel.append(heading);
      const actions = el('div', 'governance-actions');
      const context = { ...renderContext, surface, panel, actions };
      for (const append of SURFACE_APPENDERS) append(context);
      if (actions.children.length > 0) panel.append(actions);
      appendGovernanceSources(context, { full: true });
      section.append(panel);
    }
    // D5（ADR-0013）：系统管理子页附加「系统参数」区（键目录由服务端提供）。
    if (route === 'governance/system' && permissions.has('tenant-setting:read'))
      section.append(createTenantSettingsSection(renderContext));
    return section;
  };
  return (controller: GovernanceController, route: AppRoute): HTMLElement =>
    build(controller, route);
}
