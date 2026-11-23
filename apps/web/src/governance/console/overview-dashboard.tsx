import { h, render } from 'preact';
import type { AppRoute } from '../../shared/navigation';
import type { GovernanceController } from '../controller';
import { dashboardMetrics, dashboardModel } from '../dashboard-model';
import { visibleGovernanceSurfaces } from '../surfaces';
import { consolePorts, type ConsolePorts } from './ports';

// GOV-UX ⑤ 概览仪表盘（Preact 组件，ADR-0014「仪表盘页 = 指标卡 + 钻取」）：
// · 异常提示条：数据源读取异常 / 待审批任务 / 未读通知 的醒目计数，逐项可点击钻取；
// · 指标卡：四项口径与原 vanilla 标题逐项一致（.governance-metrics strong 顺序不变），
//   可钻取的卡片渲染为链接（待审批→工作流、未读/异常→通知中心）。
// 由 dashboard-upgrade 在真实浏览器挂载，替换 vanilla 指标区内容。
// 四项指标各自可钻取的子页（前两项为汇总口径，无单一去向，保持静态卡片）。
const DRILLDOWN: readonly (AppRoute | null)[] = [
  null,
  null,
  'governance/workflow',
  'governance/notifications',
];

const kpiNotes = (model: ReturnType<typeof dashboardModel>): readonly string[] => [
  '个对当前账号可见的治理模块',
  '条已读取的业务记录',
  model.pending > 0 ? '有审批待你处理' : '暂无待办',
  `${String(model.unread)} 条未读 · ${String(model.failed)} 个数据源读取异常`,
];

const kpiTones = (model: ReturnType<typeof dashboardModel>): readonly (string | null)[] => [
  null,
  null,
  model.pending > 0 ? 'warning' : null,
  model.failed > 0 ? 'danger' : model.unread > 0 ? 'warning' : null,
];

const KpiCard = ({
  label,
  value,
  note,
  route,
  tone,
}: Readonly<{
  label: string;
  value: string;
  note: string;
  route: AppRoute | null;
  tone: string | null;
}>) => {
  const toneAttrs = tone === null ? {} : { 'data-tone': tone };
  const testId = { 'data-testid': 'kt-gov-kpi' };
  if (route !== null)
    return (
      <a class="metric gov-kpi" href={`#/${route}`} {...testId} {...toneAttrs}>
        <span>{label}</span>
        <strong>{value}</strong>
        <small class="gov-kpi-note">{note}</small>
      </a>
    );
  return (
    <article class="metric gov-kpi" {...testId} {...toneAttrs}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small class="gov-kpi-note">{note}</small>
    </article>
  );
};

const AlertBar = ({
  alerts,
}: Readonly<{ alerts: ReturnType<typeof dashboardModel>['alerts'] }>) => {
  if (alerts.length === 0)
    return (
      <p class="gov-alerts is-clear" role="status" data-testid="kt-gov-alerts">
        运行正常：没有需要处理的异常
      </p>
    );
  return (
    <div class="gov-alerts" role="status" data-testid="kt-gov-alerts">
      <strong>需要关注</strong>
      {alerts.map((alert) => (
        <span class="gov-alert" data-alert={alert.id} data-tone={alert.tone}>
          {alert.text}
          {alert.links.map((link) => (
            <a href={`#/${link.route}`} data-testid="kt-gov-alert-link">
              {link.label}
            </a>
          ))}
        </span>
      ))}
    </div>
  );
};

export function OverviewDashboard(ports: ConsolePorts) {
  const Page = () => {
    const visible = visibleGovernanceSurfaces(ports.permissions);
    const model = dashboardModel(ports.views(), visible);
    const metrics = dashboardMetrics(model);
    const notes = kpiNotes(model);
    const tones = kpiTones(model);
    // 仅当该子页对当前账号可见时才渲染为链接（不产生无权限路由链接）。
    const routeOf = (index: number): AppRoute | null => {
      const target = DRILLDOWN[index] ?? null;
      return target !== null && visible.some((surface) => surface.route === target) ? target : null;
    };
    return (
      <>
        <AlertBar alerts={model.alerts} />
        {metrics.map((metric, index) => (
          <KpiCard
            key={metric.label}
            label={metric.label}
            value={metric.value}
            note={notes[index] ?? ''}
            route={routeOf(index)}
            tone={tones[index] ?? null}
          />
        ))}
      </>
    );
  };
  return Page;
}

export function mountGovernanceDashboard(
  host: HTMLElement,
  controller: GovernanceController,
): void {
  // 宿主内是 vanilla 指标基线：先清空再挂载，避免两套指标并存。
  host.textContent = '';
  const Page = OverviewDashboard(consolePorts(controller, 'governance'));
  render(h(Page, {}), host);
}
