import type { GovernanceController } from './controller';

// GOV-UX ⑤：真实浏览器中把概览的 vanilla 指标区升级为组件化仪表盘（异常提示条 +
// 可钻取指标卡，console/overview-dashboard）。与控制台宿主（console/host.ts）同口径：
// 渲染体经动态 import 独立 chunk 懒载、宿主已接入文档（isConnected）才挂载——node 行为
// 测试的 DOM 桩无 isConnected，保留同步 vanilla 指标基线；chunk 不可达时基线仍可见。
export const upgradeGovernanceDashboard = (
  workspace: HTMLElement,
  controller: GovernanceController,
): void => {
  void import('./console/overview-dashboard').then(({ mountGovernanceDashboard }) => {
    const host = workspace.querySelector<HTMLElement>('.governance-metrics');
    if (host?.isConnected === true) mountGovernanceDashboard(host, controller);
  });
};
