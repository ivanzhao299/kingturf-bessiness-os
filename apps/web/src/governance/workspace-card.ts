import { el } from '../dom';
import { governanceItems } from './presentation';
import { governanceNextAction } from './presentation';
import type { GovernanceActionContext } from './workspace-types';
export function createGovernanceCard(context: Pick<GovernanceActionContext, 'views' | 'surface'>) {
  const { views, surface } = context;
  const surfaceViews = views.filter((view) => surface.paths.includes(view.path));
  const surfaceFailures = surfaceViews.filter((view) => view.error !== undefined).length;
  const surfaceRecords = surfaceViews.reduce(
    (sum, view) => sum + (view.error ? 0 : governanceItems(view.value).length),
    0,
  );
  const panel = el('article', 'governance-card');
  const heading = el('header', 'panel-head');
  heading.append(
    el('div', '', surface.title),
    el(
      'span',
      `status-badge ${surface.disposition === 'SUPPORTING' ? 'warning' : 'success'}`,
      surface.disposition === 'SUPPORTING' ? '运行监控' : '配置管理',
    ),
  );
  panel.append(
    heading,
    el(
      'p',
      surfaceFailures > 0 ? 'risk-note' : 'governance-card-summary',
      `${String(surfaceRecords)} 条记录 · ${surfaceFailures > 0 ? `${String(surfaceFailures)} 个数据异常` : '数据读取正常'}`,
    ),
    el(
      'p',
      'next-action-note',
      `下一步：${governanceNextAction(surface.id, surfaceRecords, surfaceFailures)}`,
    ),
  );
  const actions = el('div', 'governance-actions');
  return { panel, actions };
}
