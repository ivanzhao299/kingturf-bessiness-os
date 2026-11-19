import type { AppRoute } from '../shared/navigation';
import type { GovernanceController } from './controller';
import { createGovernanceConsoleHost } from './console/host';

// UI-M2b：九个 governance 子页全部 Preact 控制台化（identity/organization/audit 试点
// + master-data/numbering/rules/workflow/notifications/system 六配置页）；原 subpage
// 卡片墙装配体随九页迁移整体退役（概览 #/governance 卡片墙保留，见 workspace.ts）。
const CONSOLE_ROUTES: readonly AppRoute[] = [
  'governance/identity',
  'governance/organization',
  'governance/audit',
  'governance/master-data',
  'governance/numbering',
  'governance/rules',
  'governance/workflow',
  'governance/notifications',
  'governance/system',
];

export function createGovernanceSubpage(ports: Readonly<{ replaceRouteView: unknown }>) {
  void ports;
  return (controller: GovernanceController, route: AppRoute): HTMLElement =>
    createGovernanceConsoleHost(route, controller);
}

void CONSOLE_ROUTES;
