// 裁定10：多入口构建关闭 modulePreload polyfill 后，动态 chunk 的 preload 助手没有
// stylesheet 注入分支——mount.tsx 的 CSS import 产出 mount-*.css 但运行时永不注入
// （九页控制台在生产退化为纯文本列表）。样式改为在 bootstrap 静态图的宿主入口并入
// 主 CSS 包，由 index 入口的完整助手统一注入；mount.tsx 内既有 import 保留（懒载
// 独立场景仍可用）。守卫：scripts/check-console-css.mjs 断言 bootstrap 主 CSS 包
// 必须携带 console 样式与 kt tokens。
import '@kingturf/ui/tokens.css';
import './console/console.css';
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
