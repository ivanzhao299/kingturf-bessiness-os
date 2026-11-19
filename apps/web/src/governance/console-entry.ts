import type { AppRoute } from '../shared/navigation';
import type { GovernanceController } from './controller';
import { createGovernanceSubpages } from './subpage';
import { createGovernanceConsoleHost } from './console/host';

// UI-M2：governance 子页装配——identity/organization/audit 三路由改走 Preact 控制台
//（ADR-0014 首批直面页面），其余子页保持 B1 卡片墙兼容形态。
const CONSOLE_ROUTES: readonly AppRoute[] = [
  'governance/identity',
  'governance/organization',
  'governance/audit',
];

export function createGovernanceSubpage(ports: Readonly<{ replaceRouteView: unknown }>) {
  const legacy = createGovernanceSubpages(ports as Parameters<typeof createGovernanceSubpages>[0]);
  return (controller: GovernanceController, route: AppRoute): HTMLElement =>
    CONSOLE_ROUTES.includes(route)
      ? createGovernanceConsoleHost(route, controller)
      : legacy(controller, route);
}
