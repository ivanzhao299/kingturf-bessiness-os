// U3-COM-1：商机列表控制台宿主（governance console-entry 同模式）。
// 裁定15（2026-11-20）：cssCodeSplit:false 后全部 CSS 合并进主包并经 index.html
// 静态 <link> 加载——样式 import 落在本宿主的静态图上；页面渲染体经动态 import
// 独立 chunk（登录入口预算不受影响），宿主连接浏览器 DOM 后挂载。
import '@kingturf/ui/tokens.css';
import '@kingturf/ui/components.css';
import './console/commercial-console.css';
import { el } from '../dom';
import type { SalesViewController, SalesViewPorts } from './sales-view-ports';
import type { OpportunityListPorts } from './console/opportunity-list';

export function appendOpportunityConsole(
  workspace: HTMLElement,
  controller: SalesViewController,
  permissions: ReadonlySet<string>,
  salesViewPorts: SalesViewPorts,
): void {
  const ports: OpportunityListPorts = {
    permissions,
    initialOpportunities: controller.opportunities,
    customers: controller.customers,
    today: new Date().toISOString().slice(0, 10),
    displayMoney: salesViewPorts.displayMoney,
    pipelineSummary: (opportunities, today) =>
      salesViewPorts.opportunityPipelineSummary(opportunities, today),
    createOpportunity: async (payload) => {
      await controller.submit('/api/v1/opportunities', payload);
      return controller.opportunities;
    },
    transitionOpportunity: async (opportunity, status, reason) => {
      await controller.transitionOpportunity(opportunity, status, reason);
      return controller.opportunities;
    },
    refresh: async () => {
      await controller.load();
      return controller.opportunities;
    },
  };
  const section = el('section', 'commercial-console opportunity-console');
  section.setAttribute('data-route-view', 'opportunities');
  section.setAttribute('data-testid', 'kt-commercial-opportunities');
  void import('./console/mount').then(({ mountOpportunityConsole }) => {
    if (section.isConnected && typeof globalThis.document === 'object')
      mountOpportunityConsole(section, ports);
  });
  workspace.append(section);
}
