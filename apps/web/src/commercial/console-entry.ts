// U3-COM-1/2：commercial 控制台宿主（governance console-entry 同模式）。
// 裁定15（2026-11-20）：cssCodeSplit:false 后全部 CSS 合并进主包并经 index.html
// 静态 <link> 加载——样式 import 落在本宿主的静态图上；页面渲染体经动态 import
// 独立 chunk（登录入口预算不受影响），宿主连接浏览器 DOM 后挂载。
import '@kingturf/ui/tokens.css';
import '@kingturf/ui/components.css';
import './console/commercial-console.css';
import { el } from '../dom';
import type { SalesViewController, SalesViewPorts } from './sales-view-ports';
import type { PricingViewController, PricingViewPorts } from './pricing-view-ports';
import type { OpportunityListPorts } from './console/opportunity-list';
import type { SolutionConsolePorts } from './console/solution-ports';
import type { QuoteConsolePorts, QuoteSnapshot } from './console/quote-ports';
import type { ConsoleMountPorts } from './console/mount';

const createConsoleHost = (
  route: string,
  testId: string,
  mount: ConsoleMountPorts,
): HTMLElement => {
  const section = el('section', `commercial-console ${route}-console`);
  section.setAttribute('data-route-view', route);
  section.setAttribute('data-testid', testId);
  void import('./console/mount').then(({ mountCommercialConsole }) => {
    if (section.isConnected && typeof globalThis.document === 'object')
      mountCommercialConsole(section, mount);
  });
  return section;
};

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
  workspace.append(
    createConsoleHost('opportunities', 'kt-commercial-opportunities', {
      kind: 'opportunities',
      ports,
    }),
  );
}

export function appendSolutionConsole(
  workspace: HTMLElement,
  controller: SalesViewController,
  permissions: ReadonlySet<string>,
  salesViewPorts: SalesViewPorts,
): void {
  const ports: SolutionConsolePorts = {
    permissions,
    initialSolutions: controller.views.get('/api/v1/technical-solutions') ?? [],
    initialCtrs: controller.views.get('/api/v1/ctrs') ?? [],
    technicalSolutionOpportunityId: salesViewPorts.technicalSolutionOpportunityId,
    textValue: (value, fallback = '') => salesViewPorts.textValue(value, fallback),
    formValue: (value) => salesViewPorts.formValue(value),
    displayRequirement: (value) => salesViewPorts.displayRequirement(value),
    submit: async (path, payload, method) => {
      await controller.submit(path, payload, method);
    },
    refresh: async () => {
      await controller.load();
      return {
        solutions: controller.views.get('/api/v1/technical-solutions') ?? [],
        ctrs: controller.views.get('/api/v1/ctrs') ?? [],
      };
    },
  };
  workspace.append(
    createConsoleHost('technical-solutions', 'kt-commercial-solutions', {
      kind: 'technical-solutions',
      ports,
    }),
  );
}

export function appendQuoteConsole(
  workspace: HTMLElement,
  controller: PricingViewController,
  permissions: ReadonlySet<string>,
  pricingViewPorts: PricingViewPorts,
): void {
  const initialSnapshot = (): QuoteSnapshot => ({
    quotes: controller.views.get('/api/v1/quotes') ?? [],
    costs: controller.views.get('/api/v1/cost-evaluations') ?? [],
    policies: (controller.views.get('/api/v1/sales-policies') ?? []).filter(
      (item) => item.status === 'PUBLISHED',
    ),
    solutions: controller.views.get('/api/v1/technical-solutions') ?? [],
    ctrs: controller.views.get('/api/v1/ctrs') ?? [],
    preferredCostDecisionId: controller.preferredQuoteCostDecisionId,
  });
  const ports: QuoteConsolePorts = {
    permissions,
    initialSnapshot: initialSnapshot(),
    textValue: (value, fallback = '') => pricingViewPorts.textValue(value, fallback),
    recordValue: (value) => pricingViewPorts.recordValue(value),
    decimalValue: (value) => pricingViewPorts.decimalValue(value),
    printIssuedQuote: (quote) => {
      pricingViewPorts.printIssuedQuote(quote);
    },
    submit: async (path, payload, method) => {
      await controller.submit(path, payload, method);
      return controller.revisionState;
    },
    command: async (revisionId, action, payload) => {
      await controller.quoteCommand(revisionId, action, payload);
    },
    clearPreferredCostDecisionId: () => {
      controller.preferredQuoteCostDecisionId = '';
    },
    refresh: async () => {
      await controller.load();
      return initialSnapshot();
    },
  };
  workspace.append(createConsoleHost('quotes', 'kt-commercial-quotes', { kind: 'quotes', ports }));
}
