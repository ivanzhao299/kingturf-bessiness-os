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
import type { CreditContractViewContext } from './credit-contract-view-ports';
import type { CrmController } from '../crm/controller';
import type { Lead } from '../crm/types';
import { itemVersionOptions } from './cost-factor-form';
import type { OpportunityListPorts } from './console/opportunity-list';
import type { SolutionConsolePorts } from './console/solution-ports';
import type { QuoteConsolePorts, QuoteSnapshot } from './console/quote-ports';
import type { CostMatrixConsolePorts } from './console/cost-matrix-ports';
import type { CtrConsolePorts } from './console/ctr-ports';
import type { PolicyConsolePorts } from './console/policy-ports';
import type { CreditConsolePorts } from './console/credit-ports';
import type { LeadConsolePorts } from './console/lead-ports';
import type { CustomerConsolePorts } from './console/customer-ports';
import type { SupplierConsolePorts } from './console/supplier-ports';
import type { RfqConsolePorts } from './console/rfq-ports';
import type { PurchaseOrderConsolePorts } from './console/po-ports';
import type { OperationsViewContext } from './operations-view-ports';
import { setAppRoute } from '../shared/navigation';
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

export function appendCostMatrixConsole(
  workspace: HTMLElement,
  controller: PricingViewController,
  permissions: ReadonlySet<string>,
  pricingViewPorts: PricingViewPorts,
): void {
  const summaries = controller.api.listCostMatrixSummaries?.bind(controller.api);
  const initialMatrices = controller.views.get('/api/v1/cost-matrices') ?? [];
  const ports: CostMatrixConsolePorts = {
    permissions,
    initialQuery: controller.costMatrixQuery,
    initialPage: {
      items: initialMatrices,
      total: initialMatrices.length,
      page: controller.costMatrixQuery.page,
      pageSize: controller.costMatrixQuery.pageSize,
    },
    itemVersions: itemVersionOptions(
      controller.views.get('/api/v1/manufacturing-items') ?? [],
      pricingViewPorts.textValue,
    ),
    roleGuidance: (rolePermissions) => pricingViewPorts.costMatrixRoleGuidance(rolePermissions),
    textValue: (value, fallback = '') => pricingViewPorts.textValue(value, fallback),
    recordValue: (value) => pricingViewPorts.recordValue(value),
    decimalValue: (value) => pricingViewPorts.decimalValue(value),
    querySummaries: async (update) => {
      const query = { ...controller.costMatrixQuery, ...update };
      return summaries
        ? await summaries(query)
        : { items: [], total: 0, page: query.page, pageSize: query.pageSize };
    },
    loadMatrix: async (id) => {
      const read = controller.api.get;
      if (!read) return null;
      return await read(`/api/v1/cost-matrices/${id}`);
    },
    submit: async (path, payload, method) => {
      await controller.submit(path, payload, method);
      return controller.revisionState;
    },
    navigateToQuotes: () => {
      setAppRoute('quotes');
    },
    refresh: async () => {
      const query = { ...controller.costMatrixQuery };
      return summaries
        ? await summaries(query)
        : { items: [], total: 0, page: query.page, pageSize: query.pageSize };
    },
  };
  workspace.append(
    createConsoleHost('costing', 'kt-commercial-cost-matrices', {
      kind: 'cost-matrices',
      ports,
    }),
  );
}

export function appendCtrConsole(
  workspace: HTMLElement,
  controller: SalesViewController,
  permissions: ReadonlySet<string>,
  salesViewPorts: SalesViewPorts,
): void {
  const ports: CtrConsolePorts = {
    permissions,
    initialCtrs: controller.views.get('/api/v1/ctrs') ?? [],
    initialSolutions: controller.views.get('/api/v1/technical-solutions') ?? [],
    opportunities: controller.opportunities,
    textValue: (value, fallback = '') => salesViewPorts.textValue(value, fallback),
    recordValue: (value) => salesViewPorts.recordValue(value),
    displayRequirement: (value) => salesViewPorts.displayRequirement(value),
    submit: async (path, payload, method) => {
      await controller.submit(path, payload, method);
      return (controller as unknown as { revisionState: Record<string, unknown> | null })
        .revisionState;
    },
    uploadAttachment: async (versionId, file) => {
      await controller.uploadCtrAttachment(versionId, file);
    },
    refresh: async () => {
      await controller.load();
      return {
        ctrs: controller.views.get('/api/v1/ctrs') ?? [],
        solutions: controller.views.get('/api/v1/technical-solutions') ?? [],
      };
    },
  };
  workspace.append(
    createConsoleHost('technical-requirements', 'kt-commercial-ctrs', {
      kind: 'technical-requirements',
      ports,
    }),
  );
}

export function appendPolicyConsole(
  workspace: HTMLElement,
  controller: PricingViewController,
  permissions: ReadonlySet<string>,
  pricingViewPorts: PricingViewPorts,
): void {
  const snapshot = () => ({
    policies: controller.views.get('/api/v1/sales-policies') ?? [],
    costs: controller.views.get('/api/v1/cost-evaluations') ?? [],
    evaluations: controller.views.get('/api/v1/sales-policy-evaluations') ?? [],
  });
  const ports: PolicyConsolePorts = {
    permissions,
    initialPolicies: snapshot().policies,
    initialCosts: snapshot().costs,
    initialEvaluations: snapshot().evaluations,
    textValue: (value, fallback = '') => pricingViewPorts.textValue(value, fallback),
    recordValue: (value) => pricingViewPorts.recordValue(value),
    submit: async (path, payload, method) => {
      await controller.submit(path, payload, method);
      return controller.revisionState;
    },
    refresh: async () => {
      await controller.load();
      return snapshot();
    },
  };
  workspace.append(
    createConsoleHost('sales-policies', 'kt-commercial-policies', {
      kind: 'sales-policies',
      ports,
    }),
  );
}

export function appendCreditConsole(context: CreditContractViewContext): void {
  const { workspace } = context;
  const controller = context.controller;
  const creditContractViewPorts = context.ports;
  const permissions = context.permissions;
  const snapshot = () => ({
    limits: controller.views.get('/api/v1/credit-limits') ?? [],
    decisions: controller.views.get('/api/v1/credit-decisions') ?? [],
  });
  const ports: CreditConsolePorts = {
    permissions,
    initialLimits: snapshot().limits,
    initialDecisions: snapshot().decisions,
    issuedQuotes: (controller.views.get('/api/v1/quotes') ?? []).filter(
      (item) => item.status === 'ISSUED' && typeof item.issuedSnapshotId === 'string',
    ),
    customers: controller.customers,
    textValue: (value, fallback = '') => creditContractViewPorts.textValue(value, fallback),
    recordText: (record: unknown, camel: string, snake: string, fallback?: string) =>
      creditContractViewPorts.recordText(
        typeof record === 'object' && record !== null ? (record as Record<string, unknown>) : {},
        camel,
        snake,
        fallback,
      ),
    displayMoney: (currency, value) => creditContractViewPorts.displayMoney(currency, value),
    currencyLabel: (value) => creditContractViewPorts.currencyLabel(value),
    submit: async (path, payload, method) => {
      await controller.submit(path, payload, method);
      return null;
    },
    refresh: async () => {
      await controller.load();
      return snapshot();
    },
  };
  workspace.append(
    createConsoleHost('credit-review', 'kt-commercial-credit', {
      kind: 'credit-review',
      ports,
    }),
  );
}

export function appendLeadConsole(workspace: HTMLElement, controller: CrmController): void {
  const employeeChoices = controller.employees
    .filter((item: { active?: boolean }) => item.active !== false)
    .map((item: { id: string; displayName?: string }) => ({
      value: item.id,
      label: item.displayName ?? item.id,
    }));
  const ports: LeadConsolePorts = {
    permissions: controller.permissions,
    initialLeads: controller.leads,
    poolMode: false,
    employeeChoices,
    textValue: (value, fallback = '') =>
      typeof value === 'string' || typeof value === 'number' ? String(value) : fallback,
    submit: async (_path, payload, method) => {
      // 线索写路径委托 CrmController（POST 创建/PUT state 经既有 api 面）。
      if (method === 'PUT') {
        const state = payload as { action?: string; lead?: Lead };
        const lead = state.lead;
        if (state.action === 'claim' && lead) await controller.claim(lead);
        else if (lead)
          await controller.mutateLead(
            lead,
            actionKind(state.action),
            firstArg(state),
            reasonArg(state),
          );
        return null;
      }
      await controller.createLead(payload as Parameters<typeof controller.createLead>[0]);
      return null;
    },
    refresh: async () => {
      await controller.load();
      return controller.leads;
    },
  };
  workspace.append(createConsoleHost('leads', 'kt-commercial-leads', { kind: 'leads', ports }));
}

function actionKind(action?: string): 'lifecycle' | 'assignment' | 'release' {
  if (action === 'release') return 'release';
  if (action === 'assign' || action === 'reassign') return 'assignment';
  return 'lifecycle';
}
function firstArg(state: Record<string, unknown>): string {
  return typeof state.status === 'string'
    ? state.status
    : typeof state.assigneeId === 'string'
      ? state.assigneeId
      : '';
}
function reasonArg(state: Record<string, unknown>): string {
  return typeof state.reason === 'string' ? state.reason : '';
}

export function appendCustomerConsole(content: HTMLElement, controller: CrmController): void {
  const ports: CustomerConsolePorts = {
    permissions: controller.permissions,
    initialCustomers: controller.customers,
    opportunities: [],
    textValue: (value, fallback = '') =>
      typeof value === 'string' || typeof value === 'number' ? String(value) : fallback,
    submit: async (_path, payload, method) => {
      // 客户创建走 legacy POST（controller.createCustomer）；PUT 更新为桥轨 API 端点，
      // legacy web 无既有编辑表单——控制台亦不提供（method 非 POST 时拒绝以防误调）。
      if (method !== undefined && method !== 'POST')
        throw new Error('Customer updates are not available in this console');
      await controller.createCustomer(payload as Parameters<typeof controller.createCustomer>[0]);
      return null;
    },
    load360: async (customerId) => {
      await controller.selectCustomer(customerId);
      return controller.selected;
    },
    createActivity: async (customerId, payload) => {
      // 活动创建走 controller.createActivity（additive：customer-activity:create 门 +
      // 360 刷新），POST /api/v1/customers/:id/activities 生产由 Fastify 桥轨认领。
      await controller.createActivity(
        customerId,
        payload as Parameters<typeof controller.createActivity>[1],
      );
      return null;
    },
    createContact: async (customerId, payload) => {
      await controller.createContact(
        customerId,
        payload as {
          name: string;
          title: string | null;
          email: string | null;
          phone: string | null;
          primary: boolean;
        },
      );
      return null;
    },
    refresh: async () => {
      await controller.load();
      return controller.customers;
    },
  };
  content.append(
    createConsoleHost('customers', 'kt-commercial-customers', {
      kind: 'customers',
      ports,
    }),
  );
}

// U3-PROC-1：供应商控制台宿主——供应商区迁移至 Preact。suppliers 非独立 AppRoute，
// 宿主挂载于 procurement-workbench 面板内且刻意不携带 data-route-view（父面板的
// procurement 路由可见性统一治理——挂工作区根会在其它路由下常显，属接线缺陷）。
export function appendSupplierConsole(context: OperationsViewContext, target: HTMLElement): void {
  const { controller, permissions } = context;
  const recordText = context.ports.recordText;
  // 物料版本选项与原 vanilla 物料准入表单同源（已发布制造物料版本行）。
  const itemVersionChoices = (controller.views.get('/api/v1/manufacturing-items') ?? [])
    .filter((item) => recordText(item, 'status', 'status') === 'PUBLISHED')
    .map((item) => ({
      value: recordText(item, 'id', 'id'),
      label: `${recordText(item, 'sku', 'sku')} · ${recordText(item, 'name', 'name')}`,
    }));
  const snapshot = () => ({
    suppliers: controller.views.get('/api/v1/suppliers') ?? [],
    quotes: controller.views.get('/api/v1/supplier-quotes') ?? [],
  });
  const ports: SupplierConsolePorts = {
    permissions,
    initialSuppliers: snapshot().suppliers,
    itemVersionChoices,
    initialQuotes: snapshot().quotes,
    recordText: (record, camel, snake, fallback) => recordText(record, camel, snake, fallback),
    textValue: (value, fallback = '') =>
      typeof value === 'string' || typeof value === 'number' ? String(value) : fallback,
    submit: async (path, payload, method) => {
      await controller.submit(path, payload, method);
      return null;
    },
    refresh: async () => {
      await controller.load();
      return snapshot();
    },
  };
  const section = el('section', 'commercial-console suppliers-console');
  section.setAttribute('data-testid', 'kt-proc-suppliers');
  target.append(section);
  void import('./console/mount').then(({ mountCommercialConsole }) => {
    if (section.isConnected && typeof globalThis.document === 'object')
      mountCommercialConsole(section, { kind: 'suppliers', ports });
  });
}

// U3-PROC-2：询价控制台宿主——RFQ 区迁移至 Preact（同供应商宿主口径：挂
// procurement-workbench 面板内、不带 data-route-view；详情经桥轨 additive
// GET /api/v1/procurement-rfqs/:id，失败回退列表行）。
export function appendRfqConsole(context: OperationsViewContext, target: HTMLElement): void {
  const { controller, permissions } = context;
  const recordText = context.ports.recordText;
  // 物料版本选项与原 vanilla 采购询价表单同源（已发布制造物料版本行）。
  const itemVersionChoices = (controller.views.get('/api/v1/manufacturing-items') ?? [])
    .filter((item) => recordText(item, 'status', 'status') === 'PUBLISHED')
    .map((item) => ({
      value: recordText(item, 'id', 'id'),
      label: `${recordText(item, 'sku', 'sku')} · ${recordText(item, 'name', 'name')}`,
    }));
  const ports: RfqConsolePorts = {
    permissions,
    initialRfqs: controller.views.get('/api/v1/procurement-rfqs') ?? [],
    itemVersionChoices,
    recordText: (record, camel, snake, fallback) => recordText(record, camel, snake, fallback),
    textValue: (value, fallback = '') =>
      typeof value === 'string' || typeof value === 'number' ? String(value) : fallback,
    submit: async (path, payload, method) => {
      await controller.submit(path, payload, method);
      return null;
    },
    loadDetail: async (rfqId) => {
      const read = controller.api.get;
      if (!read) return null;
      return await read(`/api/v1/procurement-rfqs/${rfqId}`);
    },
    refresh: async () => {
      await controller.load();
      return controller.views.get('/api/v1/procurement-rfqs') ?? [];
    },
  };
  const section = el('section', 'commercial-console rfqs-console');
  section.setAttribute('data-testid', 'kt-proc-rfqs');
  target.append(section);
  void import('./console/mount').then(({ mountCommercialConsole }) => {
    if (section.isConnected && typeof globalThis.document === 'object')
      mountCommercialConsole(section, { kind: 'rfqs', ports });
  });
}

// U3-PROC-3：采购单控制台宿主——PO 区迁移至 Preact（同供应商/询价宿主口径：挂
// procurement-workbench 面板内、不带 data-route-view；详情经桥轨 additive
// GET /api/v1/purchase-orders/:id，失败回退列表行；采购合同文档工作流随控制台
// 迁移——PURCHASE 主体文档在 vanilla 仅挂 PO 卡片，PO 卡片退役则文档链唯一
// 挂载点消失，故等价迁移至详情抽屉）。
export function appendPurchaseOrderConsole(
  context: OperationsViewContext,
  target: HTMLElement,
): void {
  const { controller, permissions } = context;
  const recordText = context.ports.recordText;
  // 物料版本/供应商选项与原 vanilla 采购订单表单同源。
  const itemVersionChoices = (controller.views.get('/api/v1/manufacturing-items') ?? [])
    .filter((item) => recordText(item, 'status', 'status') === 'PUBLISHED')
    .map((item) => ({
      value: recordText(item, 'id', 'id'),
      label: `${recordText(item, 'sku', 'sku')} · ${recordText(item, 'name', 'name')}`,
    }));
  const supplierChoices = (controller.views.get('/api/v1/suppliers') ?? []).map((item) => ({
    value: recordText(item, 'id', 'id'),
    label: `${recordText(item, 'supplierNumber', 'supplier_number')} · ${recordText(item, 'name', 'name')}`,
  }));
  const snapshot = () => ({
    orders: controller.views.get('/api/v1/purchase-orders') ?? [],
    documents: controller.views.get('/api/v1/contract-documents') ?? [],
  });
  const ports: PurchaseOrderConsolePorts = {
    permissions,
    initialOrders: snapshot().orders,
    itemVersionChoices,
    supplierChoices,
    initialDocuments: snapshot().documents,
    recordText: (record, camel, snake, fallback) => recordText(record, camel, snake, fallback),
    textValue: (value, fallback = '') =>
      typeof value === 'string' || typeof value === 'number' ? String(value) : fallback,
    decimalValue: (value) => context.ports.decimalValue(value),
    businessStateLabel: (value, fallback) => context.ports.businessStateLabel(value, fallback),
    submit: async (path, payload, method) => {
      await controller.submit(path, payload, method);
      return null;
    },
    uploadContractDocument: async (businessType, subjectType, subjectId, file) => {
      const uploaded = await controller.api.uploadContractDocument?.(
        businessType,
        subjectType,
        subjectId,
        file,
      );
      return uploaded ?? {};
    },
    loadDetail: async (orderId) => {
      const read = controller.api.get;
      if (!read) return null;
      return await read(`/api/v1/purchase-orders/${orderId}`);
    },
    refresh: async () => {
      await controller.load();
      return snapshot();
    },
  };
  const section = el('section', 'commercial-console purchase-orders-console');
  section.setAttribute('data-testid', 'kt-proc-purchase-orders');
  target.append(section);
  void import('./console/mount').then(({ mountCommercialConsole }) => {
    if (section.isConnected && typeof globalThis.document === 'object')
      mountCommercialConsole(section, { kind: 'purchase-orders', ports });
  });
}
