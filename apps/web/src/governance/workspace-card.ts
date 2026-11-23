import { el } from '../dom';
import { governanceItems } from './presentation';
import { governanceNextAction } from './presentation';
import type { GovernanceActionContext } from './workspace-types';

// GOV-UX ⑤：模块卡片可点击跳转对应子页（原生锚点 + 样式拉伸覆盖整卡，键盘可达；
// 卡内操作区与数据源预览在其上层不受影响）；数据源读取异常时给出醒目异常徽章。
// 卡片标题节点（.panel-head > div）文本保持不变（外部黑盒探针按标题定位卡片）。
const appendDrillDown = (
  heading: HTMLElement,
  surface: GovernanceActionContext['surface'],
): void => {
  const drill = el('a', 'gov-card-link', '进入');
  drill.setAttribute('href', `#/${surface.route}`);
  drill.setAttribute('aria-label', `进入${surface.title}`);
  drill.setAttribute('data-testid', `kt-gov-card-${surface.id}`);
  heading.append(drill);
};

const appendAnomaly = (heading: HTMLElement, failures: number): void => {
  if (failures === 0) return;
  const anomaly = el('span', 'gov-anomaly', `${String(failures)} 个异常`);
  anomaly.setAttribute('role', 'status');
  anomaly.setAttribute('data-testid', 'kt-gov-card-anomaly');
  heading.append(anomaly);
};

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
  appendDrillDown(heading, surface);
  appendAnomaly(heading, surfaceFailures);
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
