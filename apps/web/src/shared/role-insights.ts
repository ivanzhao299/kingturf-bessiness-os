import { routeViewSelector, type AppRoute } from './navigation';
export type RoleTaskInsight = Readonly<{
  recordLabel: string;
  stateLabel: string;
  attention: boolean;
}>;

export function roleTaskInsight(
  recordCount: number,
  statusLabels: readonly string[],
): RoleTaskInsight {
  const attentionPattern = /待|逾期|异常|失败|驳回|拒绝|未分配|冻结|草稿/u;
  const attentionCount = statusLabels.filter((label) => attentionPattern.test(label)).length;
  return {
    recordLabel: recordCount > 0 ? `${String(recordCount)} 条可见业务记录` : '暂无可见业务记录',
    stateLabel: attentionCount > 0 ? `${String(attentionCount)} 项需关注` : '当前无阻塞',
    attention: attentionCount > 0,
  };
}

export function installRoleTaskInsights(shell: HTMLElement): void {
  for (const task of Array.from(shell.querySelectorAll<HTMLElement>('[data-role-task-route]'))) {
    const route = task.getAttribute('data-role-task-route');
    if (!route) continue;
    const scopes = Array.from(
      shell.querySelectorAll<HTMLElement>(routeViewSelector(route as AppRoute)),
    );
    const records = scopes.reduce(
      (total, scope) =>
        total +
        scope.querySelectorAll(
          '.solution-list > *, .decision-list > *, .quote-list > *, .qtc-list > *, .order-360-list > *, .risk-list > *, .production-order-grid > *, .mrp-proposal-grid > *, .shipment-grid > *, .queue-list > *, article',
        ).length,
      0,
    );
    const statusLabels = scopes.flatMap((scope) =>
      Array.from(
        scope.querySelectorAll<HTMLElement>(
          '.status-badge, .ctr-state, .version-pin, .queue-status, .severity-badge',
        ),
      ).map((item) => item.textContent.trim()),
    );
    const insight = roleTaskInsight(records, statusLabels);
    const state = task.querySelector<HTMLElement>('.role-task-state');
    const count = task.querySelector<HTMLElement>('.role-task-count');
    if (state) {
      state.textContent = insight.stateLabel;
      state.classList.toggle('attention', insight.attention);
    }
    if (count) count.textContent = insight.recordLabel;
  }
}
