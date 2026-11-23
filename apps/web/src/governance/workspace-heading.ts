import { el } from '../dom';
import { visibleGovernanceSurfaces } from './surfaces';
import { dashboardMetrics, dashboardModel } from './dashboard-model';
import type { GovernanceActionContext } from './workspace-types';

export function createGovernanceHeading(
  context: Pick<GovernanceActionContext, 'permissions' | 'views'>,
) {
  const { permissions, views } = context;
  const workspace = el('section', 'governance-workspace');
  workspace.setAttribute('data-route-view', 'governance');
  const header = el('header', 'governance-hero');
  header.append(
    el('p', 'eyebrow', '企业管理控制台'),
    el('h2', '', '治理工作台'),
    el('p', 'muted', '组织、账号、权限与平台配置'),
  );
  workspace.append(header);
  const summary = el('section', 'governance-metrics');
  const visible = visibleGovernanceSurfaces(permissions);
  // GOV-UX ⑤：指标口径收敛到 dashboard-model（与 Preact 仪表盘组件同源）。本段是
  // 同步渲染的 vanilla 基线；真实浏览器中由 upgradeGovernanceDashboard 以组件化
  // 仪表盘（异常提示条 + 可钻取指标卡）替换本区内容。
  for (const { label, value } of dashboardMetrics(dashboardModel(views, visible))) {
    const metric = el('article', 'metric');
    metric.append(el('span', '', label), el('strong', '', value));
    summary.append(metric);
  }
  workspace.append(summary);
  return { workspace, visible };
}
