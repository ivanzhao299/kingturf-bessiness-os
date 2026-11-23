import { recordText, recordValue } from '../shared/business-format';
import type { AppRoute } from '../shared/navigation';
import type { GovernanceView } from './controller';
import { governanceItems } from './presentation';
import type { GovernanceSurface } from './surfaces';

// GOV-UX ⑤ 概览仪表盘模型（纯函数，vanilla 指标基线与 Preact 仪表盘组件同源）：
// 四项指标口径与原 createGovernanceHeading 逐项一致（治理模块/业务记录/待审批任务/
// 未读·异常），并派生「需要关注」清单——数据源读取异常按受影响模块可点击钻取，
// 待审批任务与未读通知仅在对应子页对当前账号可见时才给出去向。
export type DashboardAlertLink = Readonly<{ label: string; route: AppRoute }>;
export type DashboardAlert = Readonly<{
  id: 'failed' | 'pending' | 'unread';
  tone: 'danger' | 'warning' | 'info';
  text: string;
  links: readonly DashboardAlertLink[];
}>;
export type DashboardModel = Readonly<{
  modules: number;
  records: number;
  pending: number;
  unread: number;
  failed: number;
  alerts: readonly DashboardAlert[];
}>;
export type DashboardMetric = Readonly<{ label: string; value: string }>;

// 审批任务终态：不计入待审批。
const CLOSED_TASK_STATES = ['APPROVED', 'REJECTED', 'COMPLETED', 'CANCELLED'];
const WORKFLOW_TASKS = '/api/v1/workflow-tasks';
const UNREAD_COUNT = '/api/v1/notifications/unread-count';

const pendingApprovals = (views: readonly GovernanceView[]): number =>
  governanceItems(views.find((view) => view.path === WORKFLOW_TASKS)?.value).filter((item) => {
    const state = recordText(recordValue(item), 'state', 'status');
    return !CLOSED_TASK_STATES.includes(state);
  }).length;

const unreadNotifications = (views: readonly GovernanceView[]): number => {
  const record = recordValue(views.find((view) => view.path === UNREAD_COUNT)?.value);
  return Number(record.unreadCount ?? record.count ?? record.unread ?? 0);
};

const routeVisible = (visible: readonly GovernanceSurface[], route: AppRoute): boolean =>
  visible.some((surface) => surface.route === route);

const failedAlert = (
  views: readonly GovernanceView[],
  visible: readonly GovernanceSurface[],
): DashboardAlert | null => {
  const failed = views.filter((view) => view.error !== undefined);
  if (failed.length === 0) return null;
  const failedPaths = new Set(failed.map((view) => view.path));
  const links = visible
    .filter((surface) => surface.paths.some((path) => failedPaths.has(path)))
    .map((surface) => ({ label: surface.title, route: surface.route }));
  return {
    id: 'failed',
    tone: 'danger',
    text: `${String(failed.length)} 个数据源读取异常`,
    links,
  };
};

const pendingAlert = (
  pending: number,
  visible: readonly GovernanceSurface[],
): DashboardAlert | null =>
  pending > 0 && routeVisible(visible, 'governance/workflow')
    ? {
        id: 'pending',
        tone: 'warning',
        text: `${String(pending)} 个待审批任务`,
        links: [{ label: '去处理', route: 'governance/workflow' }],
      }
    : null;

const unreadAlert = (
  unread: number,
  visible: readonly GovernanceSurface[],
): DashboardAlert | null =>
  unread > 0 && routeVisible(visible, 'governance/notifications')
    ? {
        id: 'unread',
        tone: 'info',
        text: `${String(unread)} 条未读通知`,
        links: [{ label: '查看', route: 'governance/notifications' }],
      }
    : null;

export const dashboardModel = (
  views: readonly GovernanceView[],
  visible: readonly GovernanceSurface[],
): DashboardModel => {
  const pending = pendingApprovals(views);
  const unread = unreadNotifications(views);
  const failed = views.filter((view) => view.error !== undefined).length;
  return {
    modules: visible.length,
    records: views.reduce(
      (sum, view) => sum + (view.error ? 0 : governanceItems(view.value).length),
      0,
    ),
    pending,
    unread,
    failed,
    alerts: [
      failedAlert(views, visible),
      pendingAlert(pending, visible),
      unreadAlert(unread, visible),
    ].filter((alert): alert is DashboardAlert => alert !== null),
  };
};

// 四项指标（标签与取值格式与原 vanilla 标题逐字一致：第四项为「未读 / 异常」合并值）。
export const dashboardMetrics = (model: DashboardModel): readonly DashboardMetric[] => [
  { label: '治理模块', value: String(model.modules) },
  { label: '业务记录', value: String(model.records) },
  { label: '待审批任务', value: String(model.pending) },
  { label: '未读 / 异常', value: `${String(model.unread)} / ${String(model.failed)}` },
];
