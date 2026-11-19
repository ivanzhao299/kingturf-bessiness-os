import { el } from '../../dom';
import type { AppRoute } from '../../shared/navigation';
import type { GovernanceController } from '../controller';
import { consolePorts } from './ports';

// UI-M2：governance 三页（identity/organization/audit）由 Preact 控制台渲染；
// 宿主为轻壳，渲染体经动态 import 独立 chunk（登录入口预算不受影响），浏览器 DOM
// 可用时挂载；node 行为测试经宿主直挂 double 渲染。
export const createGovernanceConsoleHost = (
  route: AppRoute,
  controller: GovernanceController,
): HTMLElement => {
  const section = el('section', 'governance-workspace governance-console');
  section.setAttribute('data-route-view', route);
  section.setAttribute('data-testid', `kt-console-${route.split('/')[1] ?? ''}`);
  void import('./mount').then(({ mountGovernanceConsole }) => {
    if (section.isConnected && typeof globalThis.document === 'object')
      mountGovernanceConsole(section, consolePorts(controller, route));
  });
  return section;
};
