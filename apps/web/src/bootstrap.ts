import { createDocumentReadService } from './shared/document-read-service';
import { createDocumentConnectorRenderer } from './shared/document-connectors';
import {
  onlineTemplateKey,
  BUSINESS_DOCUMENT_SUBJECTS,
  businessDocumentSubjectLabel,
  businessDocumentPrefill,
} from './shared/document-bindings';
import {
  businessDocumentOption,
  sanitizeBusinessDocumentHtml,
  businessDocumentText,
  renderBusinessDocumentComparison,
} from './shared/document-html';
import { printOnlineBusinessDocument } from './shared/document-print';
import { customer360Content } from './crm/customer360-view';
import { navIcon, viewportFor } from './shared/shell-presentation';
export { viewportFor } from './shared/shell-presentation';
import { installRoleTaskInsights } from './shared/role-insights';
export { roleTaskInsight, type RoleTaskInsight } from './shared/role-insights';
import { installRouteSectionNavigation } from './shared/route-sections';
import { createOnlineDocumentEditor } from './shared/online-editor';
import { installWorkspaceListTools } from './shared/workspace-list-tools';
import { BUSINESS_DOCUMENT_TEMPLATES, templatesForRoute } from './shared/document-templates';
import {
  recordValue,
  displayRequirement,
  formValue,
  textValue,
  recordText,
  inventoryLocationOption,
  decimalValue,
  currencyLabel,
  displayMoney,
  displayTime,
} from './shared/business-format';
import {
  businessEventLabel,
  businessEventDetailLabel,
  riskRuleLabel,
  commissionNextAction,
  COMPLAINT_STATE_LABELS,
  COMPLAINT_SEVERITY_LABELS,
  supplyModeLabel,
  qualityStageLabel,
  shipmentGateLabel,
  operationsNextAction,
  businessStateLabel,
  customerStateLabel,
  costMatrixRoleGuidance,
  costMatrixAuditLabel,
} from './shared/business-labels';
import { ctrRequirementFields, technicalSolutionOpportunityId } from './commercial/ctr-fields';
import { printIssuedQuote } from './commercial/quote-print';
import {
  contractOrderReadiness,
  opportunityPipelineSummary,
  quoteWorkflowReadiness,
  cashRiskSummary,
} from './commercial/readiness';
import { el } from './dom';
import { openForm, type FormField } from './shared/forms';
import { ENTERPRISE_STATUS_LABELS, localizeEnterpriseCopy } from './shared/locale';
import { createFetchCrmApi } from './shared/crm-http';
import { CrmController } from './crm/controller';
import { createCrmRecords as renderCrmRecords } from './crm/records';
export { CrmController, visibleCrmSections } from './crm/controller';
import { createFetchCommercialApi } from './shared/commercial-http';
export { createFetchCommercialApi } from './shared/commercial-http';
import {
  applyRouteVisibility,
  navigationDisposers,
  installAppNavigation,
  type AppRoute,
} from './shared/navigation';
export {
  APP_ROUTE_LABELS,
  routeViewSelector,
  appRouteFromHash,
  installAppNavigation,
  type AppRoute,
} from './shared/navigation';
import type {
  Opportunity,
  CommercialApi,
  CostMatrixQuery,
  CostMatrixPage,
} from './commercial/types';
export type {
  Opportunity,
  CommercialApi,
  CostMatrixAttention,
  CostMatrixSort,
  CostMatrixQuery,
  CostMatrixPage,
} from './commercial/types';
export { createFetchCrmApi } from './shared/crm-http';
import type { Customer, CrmPermission, Employee } from './crm/types';
export type { Customer, Lead, Employee, Customer360, CrmApi, CrmPermission } from './crm/types';
import { createShellSidebar, createShellOverview } from './crm/shell-frame';
import { appendDocumentLibrary } from './shared/document-library';
import { appendContextualDocuments } from './shared/contextual-documents';
import type { CommercialPermission } from './commercial/permissions';
import { isCommercialPermission } from './commercial/permissions';
export { isCommercialPermission } from './commercial/permissions';
import { appendOrder360Content } from './commercial/order360-view';
import { appendWorkspaceReadiness } from './commercial/workspace-readiness';
import { appendWorkspaceDashboard } from './commercial/workspace-dashboard';
import { appendWorkspaceFulfillment } from './commercial/workspace-fulfillment';
import { appendWorkspaceSales } from './commercial/workspace-sales';
import { appendWorkspaceFinance } from './commercial/workspace-finance';
import { appendWorkspaceOperations } from './commercial/workspace-operations';
import { assignCommercialRouteViews, assignLegacyRouteViews } from './commercial/workspace-routes';
import { appendLegacyCommercialPanels } from './commercial/workspace-legacy-panels';
import type { Viewport, RoleWorkspaceProfile } from './shared/shell-types';
export type { Viewport, RoleWorkspaceProfile } from './shared/shell-types';
import { json, requestId } from './http';
import type { SessionDto } from './session';
export { setOperationStatus, type OperationState } from './dom';
export { RequestError } from './http';
import './style.css';

export const BOOTSTRAP_TITLE = '金特夫企业经营管理系统';

export type { CommercialPermission } from './commercial/permissions';

export { BUSINESS_DOCUMENT_TEMPLATES } from './shared/document-templates';

export { templatesForRoute } from './shared/document-templates';

export type GovernanceSurface = Readonly<{
  id: string;
  title: string;
  description: string;
  readPermission: string;
  managePermission?: string;
  paths: readonly string[];
  disposition: 'USER_FACING' | 'SUPPORTING' | 'INTERNAL_ONLY';
}>;

export const GOVERNANCE_SURFACES: readonly GovernanceSurface[] = [
  {
    id: 'organizations',
    title: '组织架构',
    description: '公司、区域、部门与团队',
    readPermission: 'organization:read',
    managePermission: 'organization:create',
    paths: ['/api/v1/organizations'],
    disposition: 'USER_FACING',
  },
  {
    id: 'employees',
    title: '员工与身份基础',
    description: '员工归属与任职状态',
    readPermission: 'employee:read',
    managePermission: 'employee:create',
    paths: ['/api/v1/employees'],
    disposition: 'USER_FACING',
  },
  {
    id: 'identity-access',
    title: '身份、角色与授权',
    description: '角色、权限与数据范围',
    readPermission: 'authorization:read',
    managePermission: 'authorization:manage',
    paths: [
      '/api/v1/user-access-profiles',
      '/api/v1/roles',
      '/api/v1/permissions',
      '/api/v1/grants',
      '/api/v1/assignments',
      '/api/v1/scope-grants',
    ],
    disposition: 'USER_FACING',
  },
  {
    id: 'audit',
    title: '审计中心',
    description: '人员、操作与业务审计记录',
    readPermission: 'audit:read',
    paths: ['/api/v1/audit-events'],
    disposition: 'USER_FACING',
  },
  {
    id: 'master-data',
    title: '主数据',
    description: '业务分类、条目与生效版本',
    readPermission: 'master-data:read',
    managePermission: 'master-data:create',
    paths: ['/api/v1/master-data/categories', '/api/v1/master-data/entries'],
    disposition: 'USER_FACING',
  },
  {
    id: 'numbering',
    title: '编号规则',
    description: '业务编号、版本与分配规则',
    readPermission: 'number:read',
    managePermission: 'number:create',
    paths: ['/api/v1/number-definitions'],
    disposition: 'USER_FACING',
  },
  {
    id: 'rules',
    title: '业务规则',
    description: '规则版本、发布与试算',
    readPermission: 'rule:read',
    managePermission: 'rule:create',
    paths: ['/api/v1/rules'],
    disposition: 'USER_FACING',
  },
  {
    id: 'workflow',
    title: '工作流与待办',
    description: '流程定义与审批待办',
    readPermission: 'workflow:read',
    managePermission: 'workflow:create',
    paths: ['/api/v1/workflows', '/api/v1/workflow-tasks'],
    disposition: 'USER_FACING',
  },
  {
    id: 'notifications',
    title: '通知中心',
    description: '消息通知与个人偏好',
    readPermission: 'notification:read',
    managePermission: 'notification:manage',
    paths: [
      '/api/v1/notifications',
      '/api/v1/notifications/unread-count',
      '/api/v1/notification-preferences',
    ],
    disposition: 'USER_FACING',
  },
  {
    id: 'registry',
    title: '业务对象与附件',
    description: '业务对象定义与附件关联',
    readPermission: 'business-object:read',
    managePermission: 'business-object:manage',
    paths: ['/api/v1/business-objects'],
    disposition: 'USER_FACING',
  },
  {
    id: 'event-operations',
    title: '事件运行状态',
    description: '事件积压、失败与运行状态',
    readPermission: 'event:operate',
    paths: ['/api/v1/operations/events'],
    disposition: 'SUPPORTING',
  },
] as const;

export const visibleGovernanceSurfaces = (permissions: ReadonlySet<string>) =>
  GOVERNANCE_SURFACES.filter(
    (surface) =>
      permissions.has(surface.readPermission) ||
      (surface.id === 'identity-access' &&
        hasPermissionPrefix(permissions, [
          'identity:',
          'role:',
          'permission:',
          'role-assignment:',
          'data-scope:',
        ])) ||
      (surface.managePermission !== undefined && permissions.has(surface.managePermission)),
  );

const hasPermissionPrefix = (permissions: ReadonlySet<string>, prefixes: readonly string[]) =>
  [...permissions].some((permission) => prefixes.some((prefix) => permission.startsWith(prefix)));

export function visibleAppRoutes(permissions: ReadonlySet<string>): ReadonlySet<AppRoute> {
  const routes = new Set<AppRoute>();
  if (permissions.has('executive-dashboard:read')) routes.add('overview');
  const addWhen = (route: AppRoute, prefixes: readonly string[]) => {
    if (hasPermissionPrefix(permissions, prefixes)) routes.add(route);
  };
  addWhen('leads', ['lead:', 'lead-']);
  addWhen('customers', ['customer:', 'customer-']);
  addWhen('opportunities', ['opportunity:']);
  addWhen('technical-requirements', ['ctr:']);
  addWhen('technical-solutions', ['technical-solution:']);
  addWhen('costing', ['cost-model:', 'cost-matrix:', 'cost:']);
  addWhen('sales-policies', ['sales-policy:']);
  addWhen('quotes', ['quote:']);
  addWhen('credit-review', ['credit:']);
  addWhen('contracts', ['contract:']);
  addWhen('sales-orders', ['sales-order:']);
  addWhen('order-360', ['order-360:']);
  addWhen('receivables', ['ar:']);
  addWhen('collections', ['collection:', 'legal-case:', 'debt-evidence:']);
  addWhen('payments', ['bank-payment:', 'reconciliation:']);
  addWhen('commissions', ['commission:', 'commission-policy:']);
  addWhen('business-risks', ['risk:', 'risk-policy:']);
  addWhen('manufacturing-master', ['manufacturing-item:', 'bom:', 'routing:']);
  addWhen('procurement', ['supplier:', 'procurement:', 'inventory:']);
  addWhen('material-planning', ['mrp:', 'mrp-policy:']);
  addWhen('production-orders', ['production:', 'manufacturing-cost:']);
  addWhen('quality-inspection', [
    'quality:',
    'quality-plan:',
    'traceability:',
    'complaint:',
    'complaint-sla:',
    'ncr:',
    'capa:',
  ]);
  addWhen('shipments', ['shipment:']);
  if (visibleGovernanceSurfaces(permissions).length > 0) routes.add('governance');
  if (routes.size > 0) {
    routes.add('overview');
    routes.add('document-templates');
  }
  return routes;
}

export function roleWorkspaceProfile(permissions: ReadonlySet<string>): RoleWorkspaceProfile {
  const domains: string[] = [];
  if (permissions.has('executive-dashboard:read')) domains.push('经营管理');
  if (
    hasPermissionPrefix(permissions, [
      'customer:',
      'customer-',
      'lead:',
      'lead-',
      'opportunity:',
      'ctr:',
      'technical-solution:',
      'cost-model:',
      'cost-matrix:',
      'cost:',
      'sales-policy:',
      'quote:',
      'credit:',
      'contract:',
      'sales-order:',
      'order-360:',
    ])
  )
    domains.push('销售与商务');
  if (
    hasPermissionPrefix(permissions, [
      'ar:',
      'bank-payment:',
      'reconciliation:',
      'commission:',
      'commission-policy:',
      'risk:',
      'risk-policy:',
    ])
  )
    domains.push('财务与风险');
  if (
    hasPermissionPrefix(permissions, [
      'manufacturing-item:',
      'bom:',
      'routing:',
      'supplier:',
      'procurement:',
      'inventory:',
      'mrp:',
      'mrp-policy:',
      'production:',
      'manufacturing-cost:',
    ])
  )
    domains.push('供应链与生产');
  if (hasPermissionPrefix(permissions, ['quality:', 'quality-plan:', 'traceability:']))
    domains.push('质量与追溯');
  if (hasPermissionPrefix(permissions, ['shipment:'])) domains.push('仓储与物流');
  if (visibleGovernanceSurfaces(permissions).length > 0) domains.push('系统治理');
  if (domains.length === 0)
    return { title: '受限岗位', description: '当前账号尚未获得可用业务职责。', domains: [] };
  if (domains.length === 1) {
    const primaryDomain = domains[0] ?? '业务';
    return {
      title: `${primaryDomain}岗位`,
      description: `聚焦${primaryDomain}职责、待办与业务证据。`,
      domains,
    };
  }
  return {
    title: permissions.has('executive-dashboard:read') ? '经营管理综合岗位' : '综合业务岗位',
    description: `当前账号覆盖 ${domains.join('、')}，首页仅呈现已授权职责。`,
    domains,
  };
}

export function commercialRevisionPath(section: string, rootId: string): string | null {
  const definition = (
    {
      'ctr-revisions': ['/api/v1/ctrs', 'versions'],
      'technical-solution-history': ['/api/v1/technical-solutions', 'revisions'],
      'cost-explanation': ['/api/v1/cost-models', 'versions'],
      'policy-explanation': ['/api/v1/sales-policies', 'versions'],
      'quote-builder': ['/api/v1/quotes', 'revisions'],
    } as Record<string, readonly [string, string]>
  )[section];
  return definition ? `${definition[0]}/${encodeURIComponent(rootId)}/${definition[1]}` : null;
}

/** Server grants drive workspace affordances; every action remains server-authorized. */
export function visibleCommercialSections(permissions: ReadonlySet<CommercialPermission>) {
  return {
    opportunities: permissions.has('opportunity:read'),
    opportunityCreate: permissions.has('opportunity:create'),
    ctr: permissions.has('ctr:read'),
    technicalSolutions: permissions.has('technical-solution:read'),
    costExplanation:
      permissions.has('cost:read') ||
      permissions.has('cost-model:read') ||
      permissions.has('cost-matrix:read'),
    policyExplanation: permissions.has('sales-policy:read'),
    quotes: permissions.has('quote:read'),
    quoteIssue: permissions.has('quote:read') && permissions.has('quote:issue'),
    credit: permissions.has('credit:read'),
    contracts: permissions.has('contract:read'),
    orders: permissions.has('sales-order:read'),
    order360: permissions.has('sales-order:read') && permissions.has('order-360:read'),
    ar: permissions.has('ar:read'),
    payments: permissions.has('bank-payment:read'),
    reconciliation: permissions.has('reconciliation:read'),
    commissions: permissions.has('commission:read') || permissions.has('commission-policy:read'),
    risks: permissions.has('risk:read') || permissions.has('risk-policy:read'),
    dashboard: permissions.has('executive-dashboard:read'),
    manufacturing:
      permissions.has('manufacturing-item:read') ||
      permissions.has('bom:read') ||
      permissions.has('routing:read'),
    procurement:
      permissions.has('supplier:read') ||
      permissions.has('procurement:read') ||
      permissions.has('inventory:read') ||
      permissions.has('inventory:move'),
    mrp: permissions.has('mrp:read') || permissions.has('mrp-policy:read'),
    production: permissions.has('production:read'),
  } as const;
}

export { inventoryLocationOption } from './shared/business-format';

export { businessEventLabel } from './shared/business-labels';

export { businessEventDetailLabel } from './shared/business-labels';

export { riskRuleLabel } from './shared/business-labels';

export { commissionNextAction } from './shared/business-labels';

export { supplyModeLabel } from './shared/business-labels';

export { qualityStageLabel } from './shared/business-labels';

export { shipmentGateLabel } from './shared/business-labels';

export { operationsNextAction } from './shared/business-labels';

export { customerStateLabel } from './shared/business-labels';

export { costMatrixRoleGuidance } from './shared/business-labels';

export { costMatrixAuditLabel } from './shared/business-labels';

export { technicalSolutionOpportunityId } from './commercial/ctr-fields';

const initialCostMatrixQuery = (): CostMatrixQuery => ({
  page: 1,
  pageSize: 20,
  query: '',
  productFamily: '',
  attention: 'ALL',
  sort: 'ATTENTION',
});

export class CommercialController {
  public opportunities: readonly Opportunity[] = [];
  public customers: readonly Customer[] = [];
  public employees: readonly Employee[] = [];
  public loading = false;
  public message = '';
  public revisionState: Record<string, unknown> | null = null;
  public preferredQuoteCostDecisionId = '';
  public selectedCostMatrixId = '';
  public costMatrixQuery = initialCostMatrixQuery();
  public costMatrixTotal = 0;
  public readonly costMatrixDetails = new Map<string, Record<string, unknown>>();
  public readonly views = new Map<string, readonly Record<string, unknown>[]>();
  public readonly order360 = new Map<string, Record<string, unknown>>();
  public dashboard: Record<string, unknown> | null = null;
  public constructor(
    public readonly api: CommercialApi,
    public readonly permissions: ReadonlySet<CommercialPermission> = new Set(),
  ) {}
  public async load(): Promise<void> {
    this.loading = true;
    try {
      const failures: string[] = [];
      const readable = [
        ['ctr:read', '/api/v1/ctrs'],
        ['technical-solution:read', '/api/v1/technical-solutions'],
        ['cost-model:read', '/api/v1/cost-models'],
        ['cost-matrix:read', '/api/v1/cost-matrices'],
        ['cost:read', '/api/v1/cost-evaluations'],
        ['sales-policy:read', '/api/v1/sales-policies'],
        ['sales-policy:read', '/api/v1/sales-policy-evaluations'],
        ['quote:read', '/api/v1/quotes'],
        ['credit:read', '/api/v1/credit-limits'],
        ['credit:read', '/api/v1/credit-decisions'],
        ['contract:read', '/api/v1/contracts'],
        ['contract-document:read', '/api/v1/contract-documents'],
        ['sales-order:read', '/api/v1/sales-orders'],
        ['ar:read', '/api/v1/ar-open-items'],
        ['bank-payment:read', '/api/v1/bank-payments'],
        ['reconciliation:read', '/api/v1/reconciliation-runs'],
        ['commission-policy:read', '/api/v1/commission-policies'],
        ['commission:read', '/api/v1/commissions'],
        ['risk-policy:read', '/api/v1/risk-policies'],
        ['risk:read', '/api/v1/risk-evaluations'],
        ['manufacturing-item:read', '/api/v1/manufacturing-items'],
        ['bom:read', '/api/v1/manufacturing-boms'],
        ['routing:read', '/api/v1/manufacturing-routings'],
        ['supplier:read', '/api/v1/suppliers'],
        ['procurement:read', '/api/v1/procurement-rfqs'],
        ['procurement:read', '/api/v1/supplier-quotes'],
        ['procurement:read', '/api/v1/purchase-orders'],
        ['procurement:read', '/api/v1/goods-receipts'],
        [
          this.permissions.has('inventory:read') ? 'inventory:read' : 'inventory:move',
          '/api/v1/inventory-locations',
        ],
        ['inventory:read', '/api/v1/inventory-balances'],
        ['mrp-policy:read', '/api/v1/mrp-policies'],
        ['mrp:read', '/api/v1/mrp-demands'],
        ['mrp:read', '/api/v1/mrp-runs'],
        ['production:read', '/api/v1/production-orders'],
        ['manufacturing-cost:read', '/api/v1/production-cost-policies'],
        ['manufacturing-cost:read', '/api/v1/production-cost-runs'],
        ['quality-plan:read', '/api/v1/quality-plans'],
        ['quality:read', '/api/v1/quality-inspections'],
        ['traceability:read', '/api/v1/lot-traceability'],
        ['complaint:read', '/api/v1/complaints'],
        ['complaint-sla:read', '/api/v1/complaint-sla-policies'],
        ['shipment:read', '/api/v1/shipment-releases'],
        ['collection:read', '/api/v1/collection-cases'],
      ] as const;
      const readableViews = readable.filter(([permission]) => this.permissions.has(permission));
      const opportunityTask = this.permissions.has('opportunity:read')
        ? this.api
            .listOpportunities()
            .then((value) => {
              this.opportunities = value;
            })
            .catch(() => {
              this.opportunities = [];
              failures.push('商机');
            })
        : Promise.resolve();
      const viewTask = Promise.allSettled(
        readableViews.map(async ([, path]) => {
          if (path !== '/api/v1/cost-matrices') return [path, await this.api.list(path)] as const;
          await this.loadCostMatrixPage();
          return [path, this.views.get(path) ?? []] as const;
        }),
      ).then((results) => {
        results.forEach((result, index) => {
          const source = readableViews[index];
          if (!source) return;
          if (result.status === 'fulfilled') {
            if (result.value[0] !== '/api/v1/cost-matrices')
              this.views.set(result.value[0], result.value[1]);
          } else failures.push(source[1]);
        });
      });
      await Promise.all([opportunityTask, viewTask]);
      if (this.api.get && this.permissions.has('executive-dashboard:read')) {
        const year = new Date().getUTCFullYear();
        const query = new URLSearchParams({
          from: `${String(year)}-01-01T00:00:00.000Z`,
          to: `${String(year + 1)}-01-01T00:00:00.000Z`,
          currency: 'CNY',
        });
        try {
          this.dashboard = await this.api.get(`/api/v1/executive-dashboard?${query.toString()}`);
        } catch {
          failures.push('经营看板');
        }
      }
      this.message =
        failures.length === 0
          ? `已加载 ${String(this.opportunities.length)} 个商机`
          : `核心工作台已加载；${String(failures.length)} 个数据源暂不可用`;
    } finally {
      this.loading = false;
    }
  }
  public async refreshViews(paths: readonly string[]): Promise<void> {
    this.loading = true;
    try {
      const results = await Promise.allSettled(
        paths.map(async (path) => {
          if (path !== '/api/v1/cost-matrices') return [path, await this.api.list(path)] as const;
          await this.loadCostMatrixPage();
          return [path, this.views.get(path) ?? []] as const;
        }),
      );
      const failed: string[] = [];
      results.forEach((result, index) => {
        const path = paths[index];
        if (!path) return;
        if (result.status === 'fulfilled') {
          if (result.value[0] !== '/api/v1/cost-matrices')
            this.views.set(result.value[0], result.value[1]);
        } else failed.push(path);
      });
      if (failed.length > 0)
        throw new Error(`数据已保存，但刷新失败：${failed.join('、')}，请重新进入本页面`);
    } finally {
      this.loading = false;
    }
  }
  private async fetchCostMatrixPage(query: CostMatrixQuery): Promise<CostMatrixPage> {
    if (this.api.listCostMatrixSummaries) {
      return this.api.listCostMatrixSummaries(query);
    }
    const items = await this.api.list('/api/v1/cost-matrices');
    return { items, total: items.length, page: 1, pageSize: Math.max(items.length, 1) };
  }
  private costMatrixRequest = 0;
  private pendingCostMatrixQuery: CostMatrixQuery | undefined;
  public async loadCostMatrixPage(update: Partial<CostMatrixQuery> = {}): Promise<boolean> {
    const request = ++this.costMatrixRequest;
    const query = { ...(this.pendingCostMatrixQuery ?? this.costMatrixQuery), ...update };
    this.pendingCostMatrixQuery = query;
    this.loading = true;
    try {
      const page = await this.fetchCostMatrixPage(query);
      if (request !== this.costMatrixRequest) return false;
      this.costMatrixQuery = query;
      this.costMatrixTotal = page.total;
      this.views.set('/api/v1/cost-matrices', page.items);
      return true;
    } catch (failure) {
      if (request !== this.costMatrixRequest) return false;
      throw failure;
    } finally {
      if (request === this.costMatrixRequest) {
        this.pendingCostMatrixQuery = undefined;
        this.loading = false;
      }
    }
  }
  private readonly order360Requests = new Map<string, Promise<Record<string, unknown>>>();
  public async loadOrder360(orderId: string): Promise<Record<string, unknown>> {
    if (
      !this.api.get ||
      !this.permissions.has('order-360:read') ||
      !this.permissions.has('sales-order:read')
    )
      throw new Error('当前用户无权查看订单全景');
    const pending = this.order360Requests.get(orderId);
    if (pending) return pending;
    const request = this.api.get(`/api/v1/sales-orders/${encodeURIComponent(orderId)}/360`);
    this.order360Requests.set(orderId, request);
    try {
      const aggregate = await request;
      this.order360.set(orderId, aggregate);
      return aggregate;
    } finally {
      this.order360Requests.delete(orderId);
    }
  }
  public async openCostMatrix(modelId: string): Promise<void> {
    this.selectedCostMatrixId = modelId;
    const summary = (this.views.get('/api/v1/cost-matrices') ?? []).find(
      (candidate) => candidate.id === modelId,
    );
    if (summary && Array.isArray(summary.factors)) {
      this.costMatrixDetails.set(modelId, summary);
      return;
    }
    if (!this.api.get) throw new Error('当前连接不支持成本模型详情查询');
    this.loading = true;
    try {
      this.costMatrixDetails.set(
        modelId,
        await this.api.get(`/api/v1/cost-matrices/${encodeURIComponent(modelId)}`),
      );
    } finally {
      this.loading = false;
    }
  }
  public closeCostMatrix(): void {
    this.selectedCostMatrixId = '';
  }
  public async refreshSelectedCostMatrix(): Promise<void> {
    const modelId = this.selectedCostMatrixId;
    if (!modelId || !this.api.get) return;
    this.costMatrixDetails.set(
      modelId,
      await this.api.get(`/api/v1/cost-matrices/${encodeURIComponent(modelId)}`),
    );
  }
  public async submit(
    path: string,
    payload: Record<string, unknown>,
    method: 'POST' | 'PATCH' = 'POST',
  ): Promise<void> {
    this.loading = true;
    try {
      this.revisionState = await this.api.submit(path, payload, method);
      this.message = '已保存；版本与决策引用已由服务器返回';
      if (path === '/api/v1/opportunities') await this.load();
    } finally {
      this.loading = false;
    }
  }
  public async transitionOpportunity(
    opportunity: Opportunity,
    status: string,
    reason: string,
  ): Promise<void> {
    if (!Number.isInteger(opportunity.version)) throw new Error('商机版本信息不可用');
    await this.submit(
      `/api/v1/opportunities/${opportunity.id}`,
      { status, reason, expectedVersion: opportunity.version },
      'PATCH',
    );
    await this.load();
  }
  public async uploadCtrAttachment(versionId: string, file: File): Promise<void> {
    this.loading = true;
    try {
      this.revisionState = await this.api.uploadCtrAttachment(versionId, file);
      this.message = `附件 ${file.name} 已上传并关联到技术需求草稿`;
      await this.load();
    } finally {
      this.loading = false;
    }
  }
  public async quoteCommand(
    revisionId: string,
    action: 'approve' | 'issue',
    payload: Record<string, unknown> = {},
  ): Promise<void> {
    this.loading = true;
    try {
      this.revisionState = await this.api.command(revisionId, action, payload);
      this.message = action === 'issue' ? '报价已签发并进入只读状态' : '审批决定已保存';
    } finally {
      this.loading = false;
    }
  }
}

export type { ContractOrderReadinessStep } from './commercial/readiness';
export { contractOrderReadiness } from './commercial/readiness';

export type { OpportunityPipelineSummary } from './commercial/readiness';
export { opportunityPipelineSummary } from './commercial/readiness';

export type { QuoteWorkflowReadinessStep } from './commercial/readiness';
export { quoteWorkflowReadiness } from './commercial/readiness';

export type { CashRiskSummary } from './commercial/readiness';
export { cashRiskSummary } from './commercial/readiness';

export function commercialWorkspaceStructure(
  viewport: Viewport,
  immutable = false,
  controller?: CommercialController,
): HTMLElement {
  const workspace = document.createElement('section');
  workspace.className = `commercial-workspace ${viewport}${immutable ? ' immutable' : ''}`;
  workspace.setAttribute('aria-label', '业务工作区');
  const status = document.createElement('p');
  status.className = 'commercial-status';
  status.setAttribute('role', 'status');
  status.setAttribute(
    'data-route-view',
    'opportunities technical-requirements technical-solutions costing sales-policies quotes credit-review contracts sales-orders order-360 receivables collections payments commissions business-risks manufacturing-master procurement material-planning production-orders quality-inspection shipments',
  );
  const statusMessage = controller?.loading ? '正在加载业务数据…' : (controller?.message ?? '');
  status.textContent = statusMessage.startsWith('已加载') ? '' : statusMessage;
  workspace.append(status);
  let riskPolicyControls: HTMLElement | null = null;
  const permissions = controller?.permissions ?? new Set<CommercialPermission>(),
    permittedPaths = new Map<string, readonly [CommercialPermission, CommercialPermission]>([
      ['/api/v1/opportunities', ['opportunity:read', 'opportunity:create']],
      ['/api/v1/ctrs', ['ctr:read', 'ctr:create']],
      ['/api/v1/technical-solutions', ['technical-solution:read', 'technical-solution:create']],
      ['/api/v1/cost-evaluations', ['cost:read', 'cost:evaluate']],
      ['/api/v1/sales-policy-evaluations', ['sales-policy:read', 'sales-policy:evaluate']],
      ['/api/v1/quotes', ['quote:read', 'quote:create']],
      ['/api/v1/credit-decisions', ['credit:read', 'credit:evaluate']],
      ['/api/v1/contracts', ['contract:read', 'contract:revise']],
      ['/api/v1/sales-orders', ['sales-order:read', 'sales-order:create']],
      ['/api/v1/ar-open-items', ['ar:read', 'ar:post']],
      ['/api/v1/bank-payments', ['bank-payment:read', 'bank-payment:intake']],
      ['/api/v1/reconciliation-runs', ['reconciliation:read', 'reconciliation:run']],
      ['/api/v1/commission-policies', ['commission-policy:read', 'commission-policy:manage']],
      ['/api/v1/commissions', ['commission:read', 'commission:accrue']],
      ['/api/v1/risk-policies', ['risk-policy:read', 'risk-policy:manage']],
      ['/api/v1/risk-evaluations', ['risk:read', 'risk:evaluate']],
      ['/api/v1/collection-cases', ['collection:read', 'collection:manage']],
    ]);
  const assemblyContext = { workspace, status, controller, permissions };
  appendWorkspaceReadiness(assemblyContext, {
    recordValue,
    contractOrderReadiness,
    quoteWorkflowReadiness,
    cashRiskSummary,
  });
  appendWorkspaceDashboard(assemblyContext, {
    recordValue,
    recordText,
    currencyLabel,
    businessStateLabel,
  });
  const fulfillmentViewPorts = {
    recordValue,
    recordText,
    textValue,
    displayMoney,
    decimalValue,
    inventoryLocationOption,
    businessStateLabel,
    operationsNextAction,
    shipmentGateLabel,
    businessEventLabel,
    businessEventDetailLabel,
  };
  appendWorkspaceFulfillment(assemblyContext, fulfillmentViewPorts);
  const creditContractViewPorts = {
    textValue,
    recordValue,
    recordText,
    displayMoney,
    currencyLabel,
    businessStateLabel,
  };
  const pricingViewPorts = {
    textValue,
    recordValue,
    displayTime,
    currencyLabel,
    decimalValue,
    printIssuedQuote,
    costMatrixAuditLabel,
    costMatrixRoleGuidance,
    replaceRouteView,
    rebuildWorkspace: () => commercialWorkspaceStructure(viewport, immutable, controller),
  };
  const salesViewPorts = {
    recordValue,
    displayRequirement,
    formValue,
    textValue,
    displayMoney,
    ctrRequirementFields,
    technicalSolutionOpportunityId,
    opportunityPipelineSummary,
    replaceRouteView,
    rebuildWorkspace: () => commercialWorkspaceStructure(viewport, immutable, controller),
  };
  appendWorkspaceSales(
    assemblyContext,
    salesViewPorts,
    pricingViewPorts,
    creditContractViewPorts,
    fulfillmentViewPorts,
  );
  if (controller && permissions.has('sales-order:read') && permissions.has('order-360:read')) {
    const panel = el('section', 'qtc-workbench order-360-workbench');
    const heading = el('div', 'pipeline-heading');
    const copy = el('div');
    copy.append(
      el('p', 'eyebrow', '订单全景'),
      el('h2', '', '订单全链路与证据时间线'),
      el('p', '', '订单关联业务与证据记录'),
    );
    /* Risk policy controls are rendered in the dedicated risk workbench below. */
    const riskPolicies = controller.views.get('/api/v1/risk-policies') ?? [];
    const riskOrders = controller.views.get('/api/v1/sales-orders') ?? [];
    riskPolicyControls = el('div', 'risk-policy-controls');
    appendOrder360Content(
      { workspace, status, controller, permissions, ports: fulfillmentViewPorts },
      panel,
      heading,
      copy,
      riskPolicies,
      riskOrders,
      riskPolicyControls,
    );
  }
  const financeRiskViewPorts = {
    recordValue,
    recordText,
    textValue,
    displayMoney,
    decimalValue,
    currencyLabel,
    businessStateLabel,
    commissionNextAction,
    riskRuleLabel,
  };
  appendWorkspaceFinance(assemblyContext, financeRiskViewPorts, riskPolicyControls);
  const operationsViewPorts = {
    recordValue,
    recordText,
    textValue,
    decimalValue,
    inventoryLocationOption,
    businessStateLabel,
    supplyModeLabel,
    qualityStageLabel,
    operationsNextAction,
    COMPLAINT_SEVERITY_LABELS,
    COMPLAINT_STATE_LABELS,
    requestId,
  };
  appendWorkspaceOperations(assemblyContext, operationsViewPorts);
  assignCommercialRouteViews(workspace);
  appendLegacyCommercialPanels(assemblyContext, immutable, permittedPaths, commercialRevisionPath);
  assignLegacyRouteViews(workspace);
  return workspace;
}

const renderDocumentConnectors = createDocumentConnectorRenderer({
  get onlineDocumentApi() {
    return onlineDocumentApi;
  },
});

const { onlineDocumentApi, clearSessionReadCache, onlineDocumentRead } =
  createDocumentReadService();

const openOnlineDocumentEditor = createOnlineDocumentEditor({
  businessDocumentOption,
  sanitizeBusinessDocumentHtml,
  businessDocumentText,
  onlineDocumentApi,
  clearSessionReadCache,
  renderBusinessDocumentComparison,
  renderDocumentConnectors,
  printOnlineBusinessDocument,
});

function replaceRouteView(current: HTMLElement, replacement: HTMLElement): void {
  if (!current.isConnected) return;
  const shell = current.closest<HTMLElement>('.app-shell');
  applyRouteVisibility(replacement);
  current.replaceWith(replacement);
  if (shell) {
    localizeEnterpriseCopy(replacement);
    installRouteSectionNavigation(shell);
    installWorkspaceListTools(shell);
    installRoleTaskInsights(shell);
    applyRouteVisibility(shell);
  }
}

export function createCrmShell(
  controller: CrmController,
  width = window.innerWidth,
  allPermissions: ReadonlySet<string> = controller.permissions,
  profileLabel = '当前账号',
): HTMLElement {
  const framePorts = {
    viewportFor,
    visibleAppRoutes,
    roleWorkspaceProfile,
    navIcon,
    bootstrapView,
  };
  const frame = createShellSidebar(controller, width, allPermissions, framePorts);
  const { shell, aside } = frame;
  const content = createShellOverview(frame, controller, allPermissions, profileLabel, framePorts);
  appendDocumentLibrary(content, allPermissions, { renderDocumentConnectors, onlineDocumentApi });
  appendContextualDocuments(content, allPermissions, {
    visibleAppRoutes,
    BUSINESS_DOCUMENT_TEMPLATES,
    BUSINESS_DOCUMENT_SUBJECTS,
    templatesForRoute,
    businessDocumentOption,
    businessDocumentSubjectLabel,
    businessDocumentPrefill,
    onlineTemplateKey,
    onlineDocumentApi,
    onlineDocumentRead,
    openOnlineDocumentEditor,
  });
  content.append(createCrmRecords(shell, controller));
  const placeholder = el(
    'p',
    'route-placeholder',
    '当前账号在本模块暂无可用功能，请联系权限管理员核对岗位职责。',
  );
  placeholder.setAttribute('data-route-placeholder', 'true');
  placeholder.hidden = true;
  content.append(placeholder);
  shell.append(aside, content);
  return shell;
}

function createCrmRecords(shell: HTMLElement, controller: CrmController): HTMLElement {
  return renderCrmRecords(shell, controller, {
    bootstrapView,
    customer360Content,
    customerStateLabel,
  });
}

function bootstrapView(current: HTMLElement, controller: CrmController): void {
  if (!current.isConnected) return;
  const records = current.querySelector<HTMLElement>('.crm-records');
  if (!records) return;
  const focused = document.activeElement;
  const input = focused instanceof HTMLInputElement && records.contains(focused) ? focused : null;
  const placeholder = input?.placeholder;
  const selection = input ? ([input.selectionStart, input.selectionEnd] as const) : null;
  replaceRouteView(records, createCrmRecords(current, controller));
  if (input && placeholder) {
    const replacement = Array.from(
      current.querySelectorAll<HTMLInputElement>('.crm-records input'),
    ).find((item) => item.placeholder === placeholder);
    replacement?.focus();
    if (replacement && selection) replacement.setSelectionRange(...selection);
  }
}

type GovernanceView = Readonly<{
  path: string;
  value: unknown;
  error?: string;
}>;

export class GovernanceController {
  public views: readonly GovernanceView[] = [];
  public message = '';
  public constructor(
    public readonly permissions: ReadonlySet<string>,
    private readonly token: string,
  ) {}
  public async load(): Promise<void> {
    const paths = [
      ...new Set(visibleGovernanceSurfaces(this.permissions).flatMap((surface) => surface.paths)),
    ];
    this.views = await Promise.all(
      paths.map(async (path): Promise<GovernanceView> => {
        try {
          return { path, value: await json<unknown>(path, this.token) };
        } catch (error) {
          return {
            path,
            value: null,
            error: error instanceof Error ? error.message : '数据源加载失败',
          };
        }
      }),
    );
  }
  public async submit(
    path: string,
    payload: Record<string, unknown>,
    method: 'POST' | 'PUT' | 'PATCH' | 'DELETE' = 'POST',
  ): Promise<void> {
    await json<unknown>(path, this.token, {
      method,
      headers: { 'idempotency-key': requestId() },
      body: JSON.stringify(payload),
    });
    this.message = '操作已完成并重新读取服务器状态';
    await this.load();
  }
}

const governanceItems = (value: unknown): readonly unknown[] => {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'object' || value === null) return [];
  const record = value as Record<string, unknown>;
  if (Array.isArray(record.items)) return record.items;
  return [value];
};

const GOVERNANCE_SOURCE_LABELS: Readonly<Record<string, string>> = {
  '/api/v1/user-access-profiles': '用户访问档案',
  '/api/v1/organizations': '组织清单',
  '/api/v1/employees': '员工清单',
  '/api/v1/roles': '角色清单',
  '/api/v1/permissions': '权限清单',
  '/api/v1/grants': '角色授权',
  '/api/v1/assignments': '人员角色',
  '/api/v1/scope-grants': '数据范围',
  '/api/v1/audit-events': '审计事件',
  '/api/v1/master-data/categories': '主数据分类',
  '/api/v1/master-data/entries': '主数据条目',
  '/api/v1/number-definitions': '编号规则',
  '/api/v1/rules': '业务规则',
  '/api/v1/workflows': '工作流定义',
  '/api/v1/workflow-tasks': '审批待办',
  '/api/v1/notifications': '通知消息',
  '/api/v1/notifications/unread-count': '未读数量',
  '/api/v1/notification-preferences': '通知偏好',
  '/api/v1/business-objects': '业务对象',
  '/api/v1/operations/events': '事件运行记录',
};

const GOVERNANCE_CHANNEL_LABELS: Readonly<Record<string, string>> = {
  IN_APP: '系统内通知',
  EMAIL: '电子邮件',
  FEISHU: '飞书私聊',
  SMS: '短信',
};

export const governanceNextAction = (
  surfaceId: string,
  recordCount: number,
  failureCount: number,
): string => {
  if (failureCount > 0) return '先处理数据读取异常并核对权限或服务状态';
  const actions: Readonly<Record<string, string>> = {
    organizations: '核对组织层级和停用组织',
    employees: '核对员工归属、账号状态和离职停用',
    'identity-access': '优先处理人员角色、授权和数据范围',
    audit: '按人员、动作和关联编号复核异常操作',
    'master-data': '核对生效期、停用项和重复编码',
    numbering: '检查草稿版本并发布合规编号规则',
    rules: '检查草稿规则并完成试算后发布',
    workflow: '优先处理当前账号的审批待办',
    notifications: '处理未读通知并核对本人通知通道',
    registry: '核对业务对象定义和版本状态',
    'event-operations': '优先排查失败、重试和积压事件',
  };
  if (recordCount === 0) return '当前范围暂无记录，按职责创建或等待业务产生';
  return actions[surfaceId] ?? '核对当前记录和待处理事项';
};

export const governanceChannelLabel = (value: unknown): string => {
  const code = textValue(value, '通知通道');
  return GOVERNANCE_CHANNEL_LABELS[code] ?? code;
};

const GOVERNANCE_FIELD_LABELS: Readonly<Record<string, string>> = {
  code: '编码',
  name: '名称',
  displayName: '姓名',
  loginName: '登录名',
  employeeActive: '员工状态',
  identityActive: '账号状态',
  activeSessionCount: '活动会话',
  passwordChangedAt: '密码更新时间',
  roles: '原子角色',
  capabilities: '有效能力',
  directScopes: '直接数据范围',
  employeeNumber: '员工编号',
  title: '标题',
  description: '说明',
  status: '状态',
  state: '状态',
  active: '启用状态',
  version: '版本',
  email: '邮箱',
  phone: '电话',
  action: '操作',
  outcome: '结果',
  channel: '通知通道',
  enabled: '启用状态',
  stepKey: '审批环节',
  subjectType: '业务对象',
  eventType: '事件类型',
  attemptCount: '尝试次数',
  lastErrorCode: '最近错误',
  unreadCount: '未读数量',
  count: '数量',
  createdAt: '创建时间',
  updatedAt: '更新时间',
};

const governanceFieldPriority = [
  'displayName',
  'loginName',
  'employeeActive',
  'identityActive',
  'activeSessionCount',
  'roles',
  'capabilities',
  'name',
  'title',
  'employeeNumber',
  'code',
  'status',
  'state',
  'active',
  'version',
  'email',
  'phone',
  'action',
  'outcome',
  'channel',
  'enabled',
  'stepKey',
  'subjectType',
  'eventType',
  'attemptCount',
  'lastErrorCode',
  'unreadCount',
  'count',
  'createdAt',
  'updatedAt',
] as const;

const governanceHiddenField = (key: string): boolean =>
  /(^id$|Id$|password|token|secret|hash|schema|payload|permissions)/iu.test(key);

const governanceCellText = (value: unknown): string => {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? '已启用' : '已停用';
  if (Array.isArray(value)) return `${String(value.length)} 项`;
  if (typeof value === 'object') return '已配置';
  if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'bigint')
    return '—';
  const text = String(value);
  return GOVERNANCE_CHANNEL_LABELS[text] ?? ENTERPRISE_STATUS_LABELS[text] ?? text;
};

const governanceTable = (items: readonly unknown[]): HTMLElement => {
  const records = items.slice(0, 8).map(recordValue);
  const availableFields = new Set(records.flatMap((record) => Object.keys(record)));
  const fields = [
    ...governanceFieldPriority.filter((field) => availableFields.has(field)),
    ...Array.from(availableFields).filter(
      (field) =>
        !governanceFieldPriority.includes(field as (typeof governanceFieldPriority)[number]),
    ),
  ]
    .filter((field) => !governanceHiddenField(field))
    .slice(0, 5);
  const wrap = el('div', 'governance-table-wrap');
  if (fields.length === 0) {
    wrap.append(el('p', 'empty', '记录已存在，详细配置受权限保护'));
    return wrap;
  }
  const table = el('table', 'governance-table');
  const head = el('thead');
  const headRow = el('tr');
  for (const field of fields) headRow.append(el('th', '', GOVERNANCE_FIELD_LABELS[field] ?? field));
  head.append(headRow);
  const body = el('tbody');
  for (const record of records) {
    const row = el('tr');
    for (const field of fields) row.append(el('td', '', governanceCellText(record[field])));
    body.append(row);
  }
  table.append(head, body);
  wrap.append(table);
  if (items.length > records.length)
    wrap.append(el('p', 'table-footnote', `当前预览前 ${String(records.length)} 条记录`));
  return wrap;
};

const auditLogWorkbench = (items: readonly unknown[]): HTMLElement => {
  const container = el('div', 'audit-log-workbench');
  const tools = el('div', 'audit-log-tools');
  const query = document.createElement('input');
  query.type = 'search';
  query.placeholder = '搜索人员、操作、对象或关联编号';
  query.setAttribute('aria-label', '搜索系统日志');
  const outcome = document.createElement('select');
  outcome.setAttribute('aria-label', '日志结果');
  for (const [value, label] of [
    ['', '全部结果'],
    ['SUCCESS', '成功'],
    ['FAILURE', '失败'],
  ] as const) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    outcome.append(option);
  }
  const result = el('div', 'audit-log-results');
  const render = () => {
    const keyword = query.value.trim().toLocaleLowerCase();
    const filtered = items.map(recordValue).filter((item) => {
      if (outcome.value && textValue(item.outcome, '') !== outcome.value) return false;
      if (!keyword) return true;
      return [item.action, item.actorId, item.targetType, item.targetId, item.correlationId]
        .map((value) => textValue(value, '').toLocaleLowerCase())
        .some((value) => value.includes(keyword));
    });
    result.replaceChildren(governanceTable(filtered));
    result.prepend(el('p', 'table-footnote', `筛选结果 ${String(filtered.length)} 条`));
  };
  query.addEventListener('input', render);
  outcome.addEventListener('change', render);
  const exportButton = el('button', 'secondary compact', '导出当前日志');
  exportButton.addEventListener('click', () => {
    const rows = items.map(recordValue);
    const escape = (value: unknown) => `"${textValue(value, '').replaceAll('"', '""')}"`;
    const csv = [
      '时间,结果,操作,人员,对象类型,对象编号,关联编号',
      ...rows.map((item) =>
        [
          item.occurredAt,
          item.outcome,
          item.action,
          item.actorId,
          item.targetType,
          item.targetId,
          item.correlationId,
        ]
          .map(escape)
          .join(','),
      ),
    ].join('\n');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }));
    link.download = `系统审计日志-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  });
  tools.append(query, outcome, exportButton);
  container.append(tools, result);
  render();
  return container;
};

export function governanceWorkspace(controller: GovernanceController): HTMLElement {
  const { permissions, views } = controller;
  const workspace = el('section', 'governance-workspace');
  workspace.setAttribute('data-route-view', 'governance');
  const header = el('header', 'governance-hero');
  header.append(
    el('p', 'eyebrow', '企业管理控制台'),
    el('h2', '', '治理工作台'),
    el('p', 'muted', '组织、账号、权限与平台配置'),
  );
  workspace.append(header);
  const summary = el('section', 'governance-metrics');
  const visible = visibleGovernanceSurfaces(permissions);
  const failed = views.filter((view) => view.error !== undefined).length;
  const totalRecords = views.reduce(
    (sum, view) => sum + (view.error ? 0 : governanceItems(view.value).length),
    0,
  );
  const pendingWorkflowTasks = governanceItems(
    views.find((view) => view.path === '/api/v1/workflow-tasks')?.value,
  ).filter((item) => {
    const state = recordText(recordValue(item), 'state', 'status');
    return !['APPROVED', 'REJECTED', 'COMPLETED', 'CANCELLED'].includes(state);
  }).length;
  const unreadView = views.find((view) => view.path === '/api/v1/notifications/unread-count');
  const unreadRecord = recordValue(unreadView?.value);
  const unreadNotifications = Number(
    unreadRecord.unreadCount ?? unreadRecord.count ?? unreadRecord.unread ?? 0,
  );
  for (const [label, value] of [
    ['治理模块', String(visible.length)],
    ['业务记录', String(totalRecords)],
    ['待审批任务', String(pendingWorkflowTasks)],
    ['未读 / 异常', `${String(unreadNotifications)} / ${String(failed)}`],
  ] as const) {
    const metric = el('article', 'metric');
    metric.append(el('span', '', label), el('strong', '', value));
    summary.append(metric);
  }
  workspace.append(summary);
  const records = (path: string) => {
    const view = views.find((item) => item.path === path);
    return governanceItems(view?.value).map((item) => recordValue(item));
  };
  const choices = (path: string, label: (item: Record<string, unknown>) => string) =>
    records(path)
      .filter((item) => typeof item.id === 'string')
      .map((item) => ({ value: String(item.id), label: label(item) }));
  const openAction = (
    title: string,
    description: string,
    fields: readonly FormField[],
    submit: (values: Record<string, string>) => Promise<void>,
  ) => {
    openForm(workspace, title, description, fields, '确认提交', async (values) => {
      await submit(values);
      replaceRouteView(workspace, governanceWorkspace(controller));
    });
  };
  const jsonField = (value: string | undefined, label: string): Record<string, unknown> => {
    try {
      const parsed = JSON.parse(value ?? '{}') as unknown;
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed))
        throw new Error(`${label}必须是键值对象格式`);
      return parsed as Record<string, unknown>;
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : `${label}格式无效`);
    }
  };
  const requiredValue = (value: string | undefined, label: string): string => {
    const normalized = value?.trim();
    if (!normalized) throw new Error(`${label}不能为空`);
    return normalized;
  };
  const grid = el('section', 'governance-grid');
  const surfacePriority: Readonly<Record<string, number>> = {
    workflow: 0,
    notifications: 1,
    'event-operations': 2,
    'identity-access': 3,
    audit: 4,
  };
  const prioritizedSurfaces = [...visible].sort((left, right) => {
    const leftFailures = views.filter(
      (view) => left.paths.includes(view.path) && view.error !== undefined,
    ).length;
    const rightFailures = views.filter(
      (view) => right.paths.includes(view.path) && view.error !== undefined,
    ).length;
    if (leftFailures !== rightFailures) return rightFailures - leftFailures;
    return (surfacePriority[left.id] ?? 20) - (surfacePriority[right.id] ?? 20);
  });
  for (const surface of prioritizedSurfaces) {
    const surfaceViews = views.filter((view) => surface.paths.includes(view.path));
    const surfaceFailures = surfaceViews.filter((view) => view.error !== undefined).length;
    const surfaceRecords = surfaceViews.reduce(
      (sum, view) => sum + (view.error ? 0 : governanceItems(view.value).length),
      0,
    );
    const panel = el('article', 'governance-card');
    const heading = el('header', 'panel-head');
    heading.append(
      el('div', '', surface.title),
      el(
        'span',
        `status-badge ${surface.disposition === 'SUPPORTING' ? 'warning' : 'success'}`,
        surface.disposition === 'SUPPORTING' ? '运行监控' : '配置管理',
      ),
    );
    panel.append(
      heading,
      el(
        'p',
        surfaceFailures > 0 ? 'risk-note' : 'governance-card-summary',
        `${String(surfaceRecords)} 条记录 · ${surfaceFailures > 0 ? `${String(surfaceFailures)} 个数据异常` : '数据读取正常'}`,
      ),
      el(
        'p',
        'next-action-note',
        `下一步：${governanceNextAction(surface.id, surfaceRecords, surfaceFailures)}`,
      ),
    );
    const actions = el('div', 'governance-actions');
    if (surface.id === 'organizations' && permissions.has('organization:create')) {
      const create = el('button', 'secondary', '新建组织');
      create.addEventListener('click', () => {
        openAction(
          '新建组织',
          '组织将自动绑定当前公司，父组织必须处于同一公司。',
          [
            { name: 'code', label: '组织编码', required: true },
            { name: 'name', label: '组织名称', required: true },
            {
              name: 'parentId',
              label: '父组织',
              type: 'select',
              options: [
                { value: '', label: '无父组织' },
                ...choices(
                  '/api/v1/organizations',
                  (item) => `${textValue(item.code, '')} · ${textValue(item.name, '')}`,
                ),
              ],
            },
          ],
          (values) =>
            controller.submit('/api/v1/organizations', {
              parentId: values.parentId?.trim() ? values.parentId : null,
              code: values.code,
              name: values.name,
              locale: 'zh-CN',
              currency: 'CNY',
            }),
        );
      });
      actions.append(create);
    }
    if (surface.id === 'organizations' && permissions.has('organization:update')) {
      const update = el('button', 'secondary', '更新组织');
      update.addEventListener('click', () => {
        openAction(
          '更新组织',
          '使用服务器当前版本执行乐观并发更新，避免覆盖其他管理员的修改。',
          [
            {
              name: 'organizationId',
              label: '组织',
              type: 'select',
              required: true,
              options: choices(
                '/api/v1/organizations',
                (item) => `${textValue(item.code, '')} · ${textValue(item.name, '')}`,
              ),
            },
            { name: 'name', label: '新名称', required: true },
          ],
          async (values) => {
            const selected = records('/api/v1/organizations').find(
              (item) => item.id === values.organizationId,
            );
            await controller.submit(
              `/api/v1/organizations/${requiredValue(values.organizationId, '组织')}`,
              { name: values.name, version: Number(selected?.version) },
              'PATCH',
            );
          },
        );
      });
      actions.append(update);
    }
    if (surface.id === 'employees' && permissions.has('employee:create')) {
      const create = el('button', 'secondary', '新建员工');
      create.addEventListener('click', () => {
        openAction(
          '新建员工',
          '员工必须归属当前公司下的有效组织；账号和角色在后续授权步骤配置。',
          [
            {
              name: 'organizationId',
              label: '所属组织',
              type: 'select',
              required: true,
              options: choices(
                '/api/v1/organizations',
                (item) => `${textValue(item.code, '')} · ${textValue(item.name, '')}`,
              ),
            },
            { name: 'employeeNumber', label: '员工编号', required: true },
            { name: 'displayName', label: '员工姓名', required: true },
            { name: 'email', label: '登录邮箱', type: 'email', required: true },
          ],
          (values) =>
            controller.submit('/api/v1/employees', {
              organizationId: values.organizationId,
              employeeNumber: values.employeeNumber,
              displayName: values.displayName,
              email: values.email,
            }),
        );
      });
      actions.append(create);
    }
    if (surface.id === 'employees' && permissions.has('employee:update')) {
      const update = el('button', 'secondary', '更新员工');
      update.addEventListener('click', () => {
        openAction(
          '更新员工',
          '更新显示名称或有效状态；字段权限和数据范围仍由服务器强制执行。',
          [
            {
              name: 'employeeId',
              label: '员工',
              type: 'select',
              required: true,
              options: choices(
                '/api/v1/employees',
                (item) =>
                  `${textValue(item.employeeNumber, '')} · ${textValue(item.displayName, '')}`,
              ),
            },
            { name: 'displayName', label: '显示名称', required: true },
            {
              name: 'active',
              label: '账号状态',
              type: 'select',
              required: true,
              options: [
                { value: 'true', label: '有效' },
                { value: 'false', label: '停用' },
              ],
            },
          ],
          async (values) => {
            const selected = records('/api/v1/employees').find(
              (item) => item.id === values.employeeId,
            );
            await controller.submit(
              `/api/v1/employees/${requiredValue(values.employeeId, '员工')}`,
              {
                displayName: values.displayName,
                active: values.active === 'true',
                version: Number(selected?.version),
              },
              'PATCH',
            );
          },
        );
      });
      actions.append(update);
    }
    if (
      surface.id === 'identity-access' &&
      (permissions.has('authorization:manage') ||
        hasPermissionPrefix(permissions, [
          'identity:manage',
          'role:manage',
          'permission:manage',
          'role-assignment:manage',
          'data-scope:manage',
        ]))
    ) {
      const legacyManage = permissions.has('authorization:manage');
      const mayManageIdentity = legacyManage || permissions.has('identity:manage');
      const mayManageRoles = legacyManage || permissions.has('role:manage');
      const mayManageAssignments = legacyManage || permissions.has('role-assignment:manage');
      const mayManageScopes = legacyManage || permissions.has('data-scope:manage');
      const role = el('button', 'secondary', '新建角色');
      role.addEventListener('click', () => {
        openAction(
          '新建原子角色',
          '角色只承载一组职责；权限和数据范围通过独立授权配置。',
          [
            { name: 'code', label: '角色编码', required: true },
            { name: 'name', label: '角色名称', required: true },
          ],
          (values) => controller.submit('/api/v1/roles', { code: values.code, name: values.name }),
        );
      });
      const assignment = el('button', 'secondary', '分配角色');
      assignment.addEventListener('click', () => {
        openAction(
          '为员工分配角色',
          '分配前应确认职责分离规则；服务器会拒绝冲突组合。',
          [
            {
              name: 'employeeId',
              label: '员工',
              type: 'select',
              required: true,
              options: choices(
                '/api/v1/employees',
                (item) =>
                  `${textValue(item.employeeNumber, '')} · ${textValue(item.displayName, '')}`,
              ),
            },
            {
              name: 'roleId',
              label: '角色',
              type: 'select',
              required: true,
              options: choices(
                '/api/v1/roles',
                (item) => `${textValue(item.code, '')} · ${textValue(item.name, '')}`,
              ),
            },
          ],
          (values) =>
            controller.submit('/api/v1/assignments', {
              employeeId: values.employeeId,
              roleId: values.roleId,
            }),
        );
      });
      const identity = el('button', 'secondary', '配置登录账号');
      identity.addEventListener('click', () => {
        openAction(
          '配置员工登录账号',
          '登录名必须唯一；密码只在本次提交中发送，不会在管理页面回显。',
          [
            {
              name: 'employeeId',
              label: '员工',
              type: 'select',
              required: true,
              options: choices(
                '/api/v1/employees',
                (item) =>
                  `${textValue(item.employeeNumber, '')} · ${textValue(item.displayName, '')}`,
              ),
            },
            { name: 'login', label: '登录名', required: true, minLength: 3, maxLength: 120 },
            {
              name: 'password',
              label: '临时密码',
              type: 'password',
              required: true,
              minLength: 12,
              hint: '至少 12 位；测试账号完成验收后必须停用。',
            },
          ],
          (values) =>
            controller.submit(
              `/api/v1/employees/${requiredValue(values.employeeId, '员工')}/identity`,
              { login: values.login, password: values.password },
              'PUT',
            ),
        );
      });
      const unassignment = el('button', 'secondary', '撤销角色');
      unassignment.addEventListener('click', () => {
        openAction(
          '撤销员工角色',
          '撤销后员工会立即失去该角色能力；当前会话仍由服务器逐次校验有效状态。',
          [
            {
              name: 'employeeId',
              label: '员工',
              type: 'select',
              required: true,
              options: choices(
                '/api/v1/employees',
                (item) =>
                  `${textValue(item.employeeNumber, '')} · ${textValue(item.displayName, '')}`,
              ),
            },
            {
              name: 'roleId',
              label: '角色',
              type: 'select',
              required: true,
              options: choices(
                '/api/v1/roles',
                (item) => `${textValue(item.code, '')} · ${textValue(item.name, '')}`,
              ),
            },
          ],
          (values) =>
            controller.submit(
              '/api/v1/assignments',
              { employeeId: values.employeeId, roleId: values.roleId },
              'DELETE',
            ),
        );
      });
      const grant = el('button', 'secondary', '授予能力');
      grant.addEventListener('click', () => {
        openAction(
          '为角色授予能力',
          '默认使用公司范围；字段白名单可在后续精细授权中继续收窄。',
          [
            {
              name: 'roleId',
              label: '角色',
              type: 'select',
              required: true,
              options: choices('/api/v1/roles', (item) => textValue(item.code, '角色')),
            },
            {
              name: 'permissionId',
              label: '能力',
              type: 'select',
              required: true,
              options: choices('/api/v1/permissions', (item) => textValue(item.capability, '能力')),
            },
          ],
          (values) =>
            controller.submit('/api/v1/grants', {
              roleId: values.roleId,
              permissionId: values.permissionId,
              scopes: ['COMPANY'],
              fields: null,
            }),
        );
      });
      if (mayManageRoles) actions.append(role, grant);
      if (mayManageIdentity) actions.append(identity);
      if (mayManageAssignments) actions.append(assignment, unassignment);

      if (mayManageIdentity) {
        const identityState = el('button', 'secondary', '账号启停与下线');
        identityState.addEventListener('click', () => {
          const profiles = records('/api/v1/user-access-profiles').filter(
            (item) => typeof item.identityId === 'string',
          );
          openAction(
            '账号启停与会话管理',
            '停用账号会立即撤销全部活动会话；启用账号不会恢复旧会话。',
            [
              {
                name: 'identityId',
                label: '登录账号',
                type: 'select',
                required: true,
                options: profiles.map((item) => ({
                  value: String(item.identityId),
                  label: `${textValue(item.employeeNumber, '')} · ${textValue(item.displayName, '')} · ${textValue(item.loginName, '')}`,
                })),
              },
              {
                name: 'active',
                label: '账号状态',
                type: 'select',
                required: true,
                options: [
                  { value: 'true', label: '启用' },
                  { value: 'false', label: '停用并强制下线' },
                ],
              },
              {
                name: 'revokeSessions',
                label: '强制撤销活动会话',
                type: 'select',
                required: true,
                options: [
                  { value: 'true', label: '是' },
                  { value: 'false', label: '否' },
                ],
              },
            ],
            (values) =>
              controller.submit(
                `/api/v1/identities/${requiredValue(values.identityId, '登录账号')}/state`,
                {
                  active: values.active === 'true',
                  revokeSessions: values.revokeSessions === 'true',
                },
                'PATCH',
              ),
          );
        });
        actions.append(identityState);
      }

      if (mayManageRoles) {
        const revokeGrant = el('button', 'secondary danger', '撤销角色能力');
        revokeGrant.addEventListener('click', () => {
          openAction(
            '撤销角色能力',
            '撤销后持有该角色的用户将立即失去对应操作能力。',
            [
              {
                name: 'roleId',
                label: '角色',
                type: 'select',
                required: true,
                options: choices(
                  '/api/v1/roles',
                  (item) => `${textValue(item.code, '')} · ${textValue(item.name, '')}`,
                ),
              },
              {
                name: 'permissionId',
                label: '能力',
                type: 'select',
                required: true,
                options: choices('/api/v1/permissions', (item) =>
                  textValue(item.capability, '能力'),
                ),
              },
            ],
            (values) =>
              controller.submit(
                '/api/v1/grants',
                { roleId: values.roleId, permissionId: values.permissionId },
                'DELETE',
              ),
          );
        });
        actions.append(revokeGrant);
      }

      if (mayManageScopes) {
        const scopeGrant = el('button', 'secondary', '配置用户数据范围');
        scopeGrant.addEventListener('click', () => {
          openAction(
            '配置用户直接数据范围',
            '直接数据范围只用于岗位角色之外的必要例外，应遵循最小授权原则。',
            [
              {
                name: 'employeeId',
                label: '员工',
                type: 'select',
                required: true,
                options: choices(
                  '/api/v1/employees',
                  (item) =>
                    `${textValue(item.employeeNumber, '')} · ${textValue(item.displayName, '')}`,
                ),
              },
              {
                name: 'permissionId',
                label: '能力',
                type: 'select',
                required: true,
                options: choices('/api/v1/permissions', (item) =>
                  textValue(item.capability, '能力'),
                ),
              },
              {
                name: 'scope',
                label: '数据范围',
                type: 'select',
                required: true,
                options: [
                  { value: 'SELF', label: '本人' },
                  { value: 'TEAM', label: '团队' },
                  { value: 'DEPARTMENT', label: '部门' },
                  { value: 'REGION', label: '区域' },
                  { value: 'COMPANY', label: '公司' },
                ],
              },
              {
                name: 'organizationId',
                label: '团队/部门/区域',
                type: 'select',
                options: [
                  { value: '', label: '不适用' },
                  ...choices(
                    '/api/v1/organizations',
                    (item) => `${textValue(item.code, '')} · ${textValue(item.name, '')}`,
                  ),
                ],
              },
            ],
            (values) =>
              controller.submit('/api/v1/scope-grants', {
                employeeId: values.employeeId,
                permissionId: values.permissionId,
                scope: values.scope,
                organizationId: ['TEAM', 'DEPARTMENT', 'REGION'].includes(values.scope ?? '')
                  ? requiredValue(values.organizationId, '组织范围')
                  : null,
              }),
          );
        });
        const revokeScope = el('button', 'secondary danger', '撤销用户数据范围');
        revokeScope.addEventListener('click', () => {
          openAction(
            '撤销用户直接数据范围',
            '撤销后用户只保留角色自带的数据范围。',
            [
              {
                name: 'scopeGrantId',
                label: '数据范围记录',
                type: 'select',
                required: true,
                options: choices(
                  '/api/v1/scope-grants',
                  (item) =>
                    `${textValue(item.scope, '')} · ${textValue(item.employeeId, '').slice(0, 8)}`,
                ),
              },
            ],
            (values) =>
              controller.submit(
                `/api/v1/scope-grants/${requiredValue(values.scopeGrantId, '数据范围记录')}`,
                {},
                'DELETE',
              ),
          );
        });
        actions.append(scopeGrant, revokeScope);
      }
    }
    if (surface.id === 'master-data' && permissions.has('master-data:create')) {
      const category = el('button', 'secondary', '新建分类');
      category.addEventListener('click', () => {
        openAction(
          '新建主数据分类',
          '分类编码保持稳定；名称和生效区间可以通过新版本调整。',
          [
            { name: 'code', label: '分类编码', required: true },
            { name: 'name', label: '分类名称', required: true },
            { name: 'description', label: '说明', type: 'textarea' },
            { name: 'effectiveFrom', label: '生效时间', required: true },
          ],
          (values) =>
            controller.submit('/api/v1/master-data/categories', {
              code: values.code,
              name: values.name,
              description: values.description ?? null,
              effectiveFrom: values.effectiveFrom,
              effectiveTo: null,
            }),
        );
      });
      const entry = el('button', 'secondary', '新建条目');
      entry.addEventListener('click', () => {
        openAction(
          '新建主数据条目',
          '条目值使用结构化配置保存，并继承分类的公司隔离。',
          [
            {
              name: 'categoryId',
              label: '分类',
              type: 'select',
              required: true,
              options: choices(
                '/api/v1/master-data/categories',
                (item) => `${textValue(item.code, '')} · ${textValue(item.name, '')}`,
              ),
            },
            { name: 'code', label: '条目编码', required: true },
            { name: 'label', label: '显示名称', required: true },
            { name: 'value', label: '结构化值（高级配置）', type: 'textarea', required: true },
            { name: 'effectiveFrom', label: '生效时间', required: true },
          ],
          (values) =>
            controller.submit('/api/v1/master-data/entries', {
              categoryId: values.categoryId,
              code: values.code,
              label: values.label,
              value: jsonField(values.value, '结构化值'),
              effectiveFrom: values.effectiveFrom,
              effectiveTo: null,
            }),
        );
      });
      actions.append(category, entry);
    }
    if (surface.id === 'master-data' && permissions.has('master-data:update')) {
      const update = el('button', 'secondary', '更新主数据条目');
      update.addEventListener('click', () => {
        openAction(
          '更新主数据条目',
          '生成新的有效版本；服务器使用当前记录版本防止并发覆盖。',
          [
            {
              name: 'entryId',
              label: '条目',
              type: 'select',
              required: true,
              options: choices(
                '/api/v1/master-data/entries',
                (item) => `${textValue(item.code, '')} · ${textValue(item.label, '')}`,
              ),
            },
            { name: 'label', label: '显示名称', required: true },
            { name: 'value', label: '结构化值（高级配置）', type: 'textarea', required: true },
            { name: 'effectiveFrom', label: '生效时间', required: true },
          ],
          async (values) => {
            const selected = records('/api/v1/master-data/entries').find(
              (item) => item.id === values.entryId,
            );
            await controller.submit(
              `/api/v1/master-data/entries/${requiredValue(values.entryId, '主数据条目')}`,
              {
                label: values.label,
                value: jsonField(values.value, '结构化值'),
                effectiveFrom: values.effectiveFrom,
                effectiveTo: null,
                version: Number(selected?.version),
              },
              'PATCH',
            );
          },
        );
      });
      actions.append(update);
    }
    if (surface.id === 'master-data' && permissions.has('master-data:delete')) {
      const remove = el('button', 'secondary danger', '停用主数据条目');
      remove.addEventListener('click', () => {
        openAction(
          '停用主数据条目',
          '停用属于受控逻辑删除，历史版本和审计记录继续保留。',
          [
            {
              name: 'entryId',
              label: '条目',
              type: 'select',
              required: true,
              options: choices(
                '/api/v1/master-data/entries',
                (item) => `${textValue(item.code, '')} · ${textValue(item.label, '')}`,
              ),
            },
          ],
          async (values) => {
            const selected = records('/api/v1/master-data/entries').find(
              (item) => item.id === values.entryId,
            );
            await controller.submit(
              `/api/v1/master-data/entries/${requiredValue(values.entryId, '主数据条目')}?version=${String(Number(selected?.version))}`,
              {},
              'DELETE',
            );
          },
        );
      });
      actions.append(remove);
    }
    if (surface.id === 'numbering' && permissions.has('number:create')) {
      const number = el('button', 'secondary', '新建编号规则');
      number.addEventListener('click', () => {
        openAction(
          '新建编号规则',
          '规则发布后才能分配正式编号。',
          [
            { name: 'code', label: '规则编码', required: true },
            { name: 'prefix', label: '前缀' },
            { name: 'padding', label: '数字位数', type: 'number', required: true },
            { name: 'startingValue', label: '起始值', type: 'number', required: true },
            { name: 'increment', label: '步长', type: 'number', required: true },
          ],
          (values) =>
            controller.submit('/api/v1/number-definitions', {
              code: values.code,
              prefix: values.prefix ?? '',
              suffix: '',
              padding: Number(values.padding),
              startingValue: Number(values.startingValue),
              increment: Number(values.increment),
              resetPeriod: 'NEVER',
            }),
        );
      });
      actions.append(number);
    }
    if (surface.id === 'numbering' && permissions.has('number:update')) {
      const publish = el('button', 'secondary', '发布编号版本');
      publish.addEventListener('click', () => {
        openAction(
          '发布编号版本',
          '发布后的编号格式不可修改；后续调整必须创建新版本。',
          [
            {
              name: 'definitionId',
              label: '编号规则',
              type: 'select',
              required: true,
              options: choices('/api/v1/number-definitions', (item) =>
                textValue(item.code, '编号规则'),
              ),
            },
            { name: 'version', label: '待发布版本', type: 'number', required: true },
          ],
          (values) =>
            controller.submit(
              `/api/v1/number-definitions/${requiredValue(values.definitionId, '编号规则')}/publish`,
              {
                version: Number(values.version),
              },
            ),
        );
      });
      actions.append(publish);
    }
    if (surface.id === 'numbering' && permissions.has('number:allocate')) {
      const allocate = el('button', 'secondary', '分配测试编号');
      allocate.addEventListener('click', () => {
        openAction(
          '分配受控编号',
          '每次提交使用独立幂等键，返回值由服务器序列化生成。',
          [
            {
              name: 'definitionId',
              label: '编号规则',
              type: 'select',
              required: true,
              options: choices('/api/v1/number-definitions', (item) =>
                textValue(item.code, '编号规则'),
              ),
            },
          ],
          (values) =>
            controller.submit(
              `/api/v1/number-definitions/${requiredValue(values.definitionId, '编号规则')}/allocate`,
              {},
            ),
        );
      });
      actions.append(allocate);
    }
    if (surface.id === 'rules' && permissions.has('rule:create')) {
      const rule = el('button', 'secondary', '新建业务规则');
      rule.addEventListener('click', () => {
        openAction(
          '新建业务规则',
          '规则表达式和必需输入由服务器校验；草稿发布后才能用于业务判断。',
          [
            { name: 'code', label: '规则编码', required: true },
            { name: 'ast', label: '规则表达式（高级配置）', type: 'textarea', required: true },
            { name: 'requiredInputs', label: '必需输入（每行一个）', type: 'textarea' },
          ],
          (values) =>
            controller.submit('/api/v1/rules', {
              code: values.code,
              ast: jsonField(values.ast, '规则表达式'),
              requiredInputs: (values.requiredInputs ?? '')
                .split(/\r?\n/u)
                .map((item) => item.trim())
                .filter(Boolean),
            }),
        );
      });
      actions.append(rule);
    }
    if (surface.id === 'rules' && permissions.has('rule:update')) {
      const publish = el('button', 'secondary', '发布规则版本');
      publish.addEventListener('click', () => {
        openAction(
          '发布业务规则',
          '已发布规则不可修改，试算和业务执行始终引用冻结版本。',
          [
            {
              name: 'ruleId',
              label: '业务规则',
              type: 'select',
              required: true,
              options: choices('/api/v1/rules', (item) => textValue(item.code, '规则')),
            },
            { name: 'version', label: '待发布版本', type: 'number', required: true },
          ],
          (values) =>
            controller.submit(`/api/v1/rules/${requiredValue(values.ruleId, '业务规则')}/publish`, {
              version: Number(values.version),
            }),
        );
      });
      actions.append(publish);
    }
    if (surface.id === 'rules' && permissions.has('rule:evaluate')) {
      const evaluate = el('button', 'secondary', '试算规则');
      evaluate.addEventListener('click', () => {
        openAction(
          '试算业务规则',
          '试算返回决策、输入哈希和逐步计算轨迹。',
          [
            {
              name: 'ruleId',
              label: '业务规则',
              type: 'select',
              required: true,
              options: choices('/api/v1/rules', (item) => textValue(item.code, '规则')),
            },
            { name: 'input', label: '输入数据（高级配置）', type: 'textarea', required: true },
          ],
          (values) =>
            controller.submit(
              `/api/v1/rules/${requiredValue(values.ruleId, '业务规则')}/evaluate`,
              {
                input: jsonField(values.input, '输入数据'),
              },
            ),
        );
      });
      actions.append(evaluate);
    }
    if (surface.id === 'workflow' && permissions.has('workflow:create')) {
      const workflow = el('button', 'secondary', '新建工作流');
      workflow.addEventListener('click', () => {
        openAction(
          '新建工作流',
          '流程定义采用受校验的结构化规范；发布和启动由独立能力控制。',
          [
            { name: 'code', label: '工作流编码', required: true },
            { name: 'spec', label: '流程规范（高级配置）', type: 'textarea', required: true },
          ],
          (values) =>
            controller.submit('/api/v1/workflows', {
              code: values.code,
              spec: jsonField(values.spec, '流程规范'),
            }),
        );
      });
      actions.append(workflow);
    }
    if (surface.id === 'workflow' && permissions.has('workflow:update')) {
      const publish = el('button', 'secondary', '发布工作流');
      publish.addEventListener('click', () => {
        openAction(
          '发布工作流',
          '发布后启动的实例固定引用该流程版本。',
          [
            {
              name: 'workflowId',
              label: '工作流',
              type: 'select',
              required: true,
              options: choices('/api/v1/workflows', (item) => textValue(item.code, '工作流')),
            },
            { name: 'version', label: '待发布版本', type: 'number', required: true },
          ],
          (values) =>
            controller.submit(
              `/api/v1/workflows/${requiredValue(values.workflowId, '工作流')}/publish`,
              {
                version: Number(values.version),
              },
            ),
        );
      });
      actions.append(publish);
    }
    if (surface.id === 'workflow' && permissions.has('workflow:start')) {
      const start = el('button', 'secondary', '启动工作流');
      start.addEventListener('click', () => {
        openAction(
          '启动工作流实例',
          '流程实例绑定业务对象类型和对象编号，并使用防重键避免重复启动。',
          [
            {
              name: 'workflowId',
              label: '工作流',
              type: 'select',
              required: true,
              options: choices('/api/v1/workflows', (item) => textValue(item.code, '工作流')),
            },
            { name: 'subjectType', label: '业务对象类型', required: true },
            { name: 'subjectId', label: '业务对象编号', required: true },
          ],
          (values) =>
            controller.submit(
              `/api/v1/workflows/${requiredValue(values.workflowId, '工作流')}/instances`,
              {
                subjectType: values.subjectType,
                subjectId: values.subjectId,
              },
            ),
        );
      });
      actions.append(start);
    }
    if (surface.id === 'workflow' && permissions.has('workflow:decide')) {
      const decide = el('button', 'secondary', '处理审批待办');
      decide.addEventListener('click', () => {
        openAction(
          '处理工作流待办',
          '审批人、法定人数和申请人隔离由服务器校验。',
          [
            {
              name: 'taskId',
              label: '待办任务',
              type: 'select',
              required: true,
              options: choices(
                '/api/v1/workflow-tasks',
                (item) =>
                  `${textValue(item.stepKey, '待办')} · ${businessStateLabel(item.state, '待处理')}`,
              ),
            },
            {
              name: 'decision',
              label: '决定',
              type: 'select',
              required: true,
              options: [
                { value: 'approve', label: '批准' },
                { value: 'reject', label: '拒绝' },
              ],
            },
            { name: 'comment', label: '审批意见', type: 'textarea' },
          ],
          async (values) => {
            const selected = records('/api/v1/workflow-tasks').find(
              (item) => item.id === values.taskId,
            );
            await controller.submit(
              `/api/v1/workflow-tasks/${requiredValue(values.taskId, '审批任务')}/decisions`,
              {
                decision: values.decision,
                comment: values.comment ?? null,
                version: Number(selected?.version),
              },
            );
          },
        );
      });
      actions.append(decide);
    }
    if (surface.id === 'notifications' && permissions.has('notification:manage')) {
      const preference = el('button', 'secondary', '通知偏好');
      preference.addEventListener('click', () => {
        openAction(
          '更新通知偏好',
          '仅调整当前账号的通知通道，使用版本号防止并发覆盖。',
          [
            {
              name: 'channel',
              label: '通知通道',
              type: 'select',
              required: true,
              options: records('/api/v1/notification-preferences').map((item) => ({
                value: textValue(item.channel, ''),
                label: `${governanceChannelLabel(item.channel)} · ${item.enabled === false ? '关闭' : '开启'}`,
              })),
            },
            {
              name: 'enabled',
              label: '状态',
              type: 'select',
              required: true,
              options: [
                { value: 'true', label: '开启' },
                { value: 'false', label: '关闭' },
              ],
            },
          ],
          async (values) => {
            const selected = records('/api/v1/notification-preferences').find(
              (item) => item.channel === values.channel,
            );
            await controller.submit(
              '/api/v1/notification-preferences',
              {
                channel: values.channel,
                enabled: values.enabled === 'true',
                expectedVersion: Number(selected?.version ?? 0),
              },
              'PUT',
            );
          },
        );
      });
      actions.append(preference);
    }
    if (surface.id === 'registry' && permissions.has('business-object:manage')) {
      const object = el('button', 'secondary', '新建业务对象');
      object.addEventListener('click', () => {
        openAction(
          '新建业务对象',
          '对象定义用于统一字段、关系和附件绑定语义。',
          [
            { name: 'code', label: '对象编码', required: true },
            { name: 'name', label: '对象名称', required: true },
            { name: 'schema', label: '对象结构（高级配置）', type: 'textarea', required: true },
          ],
          (values) =>
            controller.submit('/api/v1/business-objects', {
              code: values.code,
              name: values.name,
              schema: jsonField(values.schema, '对象结构'),
            }),
        );
      });
      actions.append(object);
    }
    if (actions.children.length > 0) panel.append(actions);
    for (const path of surface.paths) {
      const view = views.find((item) => item.path === path);
      const row = el('details', 'governance-source');
      const items = view ? governanceItems(view.value) : [];
      const sourceLabel = GOVERNANCE_SOURCE_LABELS[path] ?? '业务数据';
      const source = el(
        'summary',
        '',
        view?.error ? `${sourceLabel} · 读取失败` : `${sourceLabel} · ${String(items.length)} 条`,
      );
      row.append(source);
      if (view?.error) row.append(el('p', 'error', view.error));
      else if (items.length === 0) row.append(el('p', 'empty', '当前范围内暂无记录'));
      else
        row.append(
          path === '/api/v1/audit-events' ? auditLogWorkbench(items) : governanceTable(items),
        );
      panel.append(row);
    }
    grid.append(panel);
  }
  workspace.append(grid);
  return workspace;
}

export async function mountWorkspace(
  root: HTMLElement,
  session: SessionDto,
  token: string,
  onProgress: (message: string) => void,
): Promise<void> {
  // Reset document reads when the authenticated identity changes.
  clearSessionReadCache();
  const allowed = new Set<CrmPermission>([
    'employee:read',
    'customer:read',
    'customer:create',
    'customer:update',
    'customer:lifecycle',
    'customer-ownership:assign',
    'customer-ownership:reassign',
    'customer-activity:create',
    'customer-360:read',
    'lead:read',
    'lead:create',
    'lead-pool:read',
    'lead-pool:claim',
    'lead-pool:release',
    'lead:lifecycle',
    'lead:assign',
    'lead:reassign',
  ]);
  onProgress('登录成功，正在并行加载业务数据…');
  const permissions = new Set(
    session.permissions.filter((item): item is CrmPermission => allowed.has(item as CrmPermission)),
  );
  const allPermissions = new Set(session.permissions);
  const controller = new CrmController(permissions, createFetchCrmApi(token));
  const commercialPermissions = new Set(session.permissions.filter(isCommercialPermission));
  const commercialController = Object.values(visibleCommercialSections(commercialPermissions)).some(
    Boolean,
  )
    ? new CommercialController(createFetchCommercialApi(token), commercialPermissions)
    : null;
  const governanceController =
    visibleGovernanceSurfaces(allPermissions).length > 0
      ? new GovernanceController(allPermissions, token)
      : null;
  await Promise.all([
    controller.load().catch((error: unknown) => {
      controller.error = error instanceof Error ? error.message : '客户业务数据加载失败';
    }),
    commercialController?.load().catch((error: unknown) => {
      commercialController.message = error instanceof Error ? error.message : '商业工作台加载失败';
    }),
    governanceController?.load(),
  ]);
  onProgress('业务数据已就绪，正在构建工作台…');
  const currentEmployee = controller.employees.find(
    (employee) => employee.id === session.employeeId,
  );
  const profileLabel =
    session.displayName ??
    currentEmployee?.displayName ??
    session.employeeNumber ??
    currentEmployee?.employeeNumber ??
    `用户 ${session.employeeId.slice(0, 8)}`;
  const shell = createCrmShell(
    controller,
    globalThis.innerWidth || 1280,
    allPermissions,
    profileLabel,
  );
  if (commercialController) {
    commercialController.customers = controller.customers;
    commercialController.employees = controller.employees;
    shell
      .querySelector<HTMLElement>('.workspace')
      ?.append(
        commercialWorkspaceStructure(
          viewportFor(globalThis.innerWidth || 1280),
          false,
          commercialController,
        ),
      );
  }
  if (governanceController) {
    shell
      .querySelector<HTMLElement>('.workspace')
      ?.append(governanceWorkspace(governanceController));
  }
  localizeEnterpriseCopy(shell);
  installRouteSectionNavigation(shell);
  installWorkspaceListTools(shell);
  installRoleTaskInsights(shell);
  installAppNavigation(shell);
  const previousShell = root.querySelector<HTMLElement>('.app-shell');
  if (previousShell) navigationDisposers.get(previousShell)?.();
  root.replaceChildren(shell);
}
