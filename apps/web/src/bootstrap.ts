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
import {
  buildBusinessDocumentTemplateHtml,
  isLegacyBusinessDocumentOutline,
} from './business-document-content';
import { el, setOperationStatus } from './dom';
import { openForm, type FormField } from './shared/forms';
import { ENTERPRISE_STATUS_LABELS, localizeEnterpriseCopy } from './shared/locale';
import { createFetchCrmApi } from './shared/crm-http';
import { CrmController } from './crm/controller';
import { createCrmRecords as renderCrmRecords } from './crm/records';
export { CrmController, visibleCrmSections } from './crm/controller';
import { createFetchCommercialApi } from './shared/commercial-http';
export { createFetchCommercialApi } from './shared/commercial-http';
import {
  APP_ROUTE_LABELS,
  routeViewSelector,
  APP_ROUTES,
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
import type { Customer, CrmPermission, Employee, Customer360 } from './crm/types';
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
import type {
  Viewport,
  RoleWorkspaceProfile,
  NavIconName,
  BusinessDocumentTemplate,
  OnlineBusinessDocument,
  DocumentConnectorKey,
} from './shared/shell-types';
export type { Viewport, RoleWorkspaceProfile } from './shared/shell-types';
import {
  documentSendBlockReason,
  documentSendNotice,
  documentDispatchStatus,
} from './document-send';
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
export const viewportFor = (width: number): Viewport =>
  width < 640 ? 'mobile' : width < 1024 ? 'tablet' : 'desktop';

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

type DocumentConnector = Readonly<{
  connector: DocumentConnectorKey;
  label: string;
  provider: string;
  displayName: string;
  senderIdentity?: string;
  secretReference?: string;
  configuration?: Readonly<Record<string, unknown>>;
  status: 'UNCONFIGURED' | 'READY' | 'DISABLED';
  version: number;
  configuredAt?: string;
}>;

const renderDocumentConnectors = (connectorGrid: HTMLElement, saved = false): void => {
  const progress = el(
    'p',
    'operation-status',
    saved ? '配置已保存，正在刷新渠道状态…' : '正在加载发送与翻译连接器…',
  );
  progress.setAttribute('role', 'status');
  connectorGrid.replaceChildren(progress);
  void onlineDocumentApi<{ items: readonly DocumentConnector[] }>('/api/v1/document-connectors')
    .then(({ items }) => {
      connectorGrid.replaceChildren();
      if (saved) {
        progress.textContent = '配置已保存。返回文档后可重新检查发送条件。';
        connectorGrid.append(progress);
      }
      if (items.length === 0) throw new Error('未读取到连接器，请重试或联系管理员');
      for (const connector of items) {
        const card = el('article', 'document-connector-card');
        card.append(
          el(
            'span',
            `role-task-state ${connector.status === 'READY' ? 'success' : 'warning'}`,
            connector.status === 'READY'
              ? '已配置'
              : connector.status === 'DISABLED'
                ? '已停用'
                : '待配置',
          ),
          el('strong', '', connector.label),
          el(
            'small',
            '',
            `${connector.provider} · ${connector.senderIdentity ?? '未设置发送身份'}`,
          ),
        );
        const configure = el('button', 'secondary compact', '配置');
        configure.type = 'button';
        configure.addEventListener('click', () => {
          openForm(
            document.body,
            `配置${connector.label}`,
            '只填写非敏感元数据和密钥引用名称。真实密钥由运维放入受控密钥存储。',
            [
              {
                name: 'provider',
                label: '服务提供方代码',
                required: true,
                value: connector.provider,
                placeholder: '例如 RESEND 或 META_CLOUD_API',
              },
              {
                name: 'displayName',
                label: '内部显示名称',
                required: true,
                value: connector.displayName,
              },
              {
                name: 'senderIdentity',
                label: '发送身份/账号',
                value: connector.senderIdentity ?? '',
              },
              {
                name: 'secretReference',
                label: '安全密钥引用',
                value: connector.secretReference ?? '',
                placeholder: 'KINGTURF_CONNECTOR_…',
                hint: '只填密钥名称，不得在此粘贴令牌、密码或 API Key。',
              },
              {
                name: 'configuration',
                label: '非敏感配置 JSON',
                type: 'textarea',
                value: JSON.stringify(connector.configuration ?? {}, undefined, 2),
              },
              {
                name: 'status',
                label: '状态',
                type: 'select',
                required: true,
                value: connector.status,
                options: [
                  { value: 'UNCONFIGURED', label: '待配置' },
                  { value: 'READY', label: '启用' },
                  { value: 'DISABLED', label: '停用' },
                ],
              },
            ],
            '保存连接器配置',
            async (values) => {
              const configurationText = values.configuration ?? '';
              const senderIdentity = values.senderIdentity?.trim() ?? '';
              const secretReference = values.secretReference?.trim() ?? '';
              let configuration: Record<string, unknown>;
              try {
                configuration = JSON.parse(
                  configurationText.length > 0 ? configurationText : '{}',
                ) as Record<string, unknown>;
              } catch {
                throw new Error('非敏感配置必须是有效 JSON');
              }
              await onlineDocumentApi(`/api/v1/document-connectors/${connector.connector}`, {
                method: 'PUT',
                body: JSON.stringify({
                  provider: values.provider,
                  displayName: values.displayName,
                  senderIdentity: senderIdentity.length > 0 ? senderIdentity : null,
                  secretReference: secretReference.length > 0 ? secretReference : null,
                  configuration,
                  status: values.status,
                  expectedVersion: connector.version,
                }),
              });
              renderDocumentConnectors(connectorGrid, true);
            },
          );
        });
        card.append(configure);
        connectorGrid.append(card);
      }
    })
    .catch((failure: unknown) => {
      connectorGrid.replaceChildren(
        el(
          'p',
          'error',
          (saved ? '配置已保存，但刷新失败：' : '') +
            (failure instanceof Error ? failure.message : '连接器配置加载失败'),
        ),
      );
      const retry = el('button', 'secondary', '重试加载配置');
      retry.type = 'button';
      retry.addEventListener('click', () => {
        renderDocumentConnectors(connectorGrid, saved);
      });
      connectorGrid.append(retry);
    });
};

const onlineTemplateKey = (template: BusinessDocumentTemplate, route: AppRoute): string =>
  `${template.file.slice(0, 2)}-${route}`;

const onlineDocumentApi = <T>(path: string, init?: RequestInit): Promise<T> => {
  const token = sessionStorage.getItem('kingturf.session');
  if (!token) throw new Error('登录状态已失效，请重新登录');
  return json<T>(path, token, init);
};

const onlineDocumentReadCache = new Map<string, Promise<unknown>>();
const clearSessionReadCache = (): void => {
  onlineDocumentReadCache.clear();
};
const onlineDocumentRead = <T>(path: string): Promise<T> => {
  const cached = onlineDocumentReadCache.get(path);
  if (cached) return cached as Promise<T>;
  const request = onlineDocumentApi<T>(path).catch((error: unknown) => {
    onlineDocumentReadCache.delete(path);
    throw error;
  });
  onlineDocumentReadCache.set(path, request);
  return request;
};

const BUSINESS_DOCUMENT_SUBJECTS: Partial<
  Record<AppRoute, Readonly<{ endpoint: string; type: string; numberKeys: readonly string[] }>>
> = {
  quotes: {
    endpoint: '/api/v1/quotes',
    type: 'quote',
    numberKeys: ['quoteNumber', 'number', 'id'],
  },
  contracts: {
    endpoint: '/api/v1/contracts',
    type: 'contract',
    numberKeys: ['contractNumber', 'number', 'id'],
  },
  'sales-orders': {
    endpoint: '/api/v1/sales-orders',
    type: 'sales-order',
    numberKeys: ['orderNumber', 'number', 'id'],
  },
  'production-orders': {
    endpoint: '/api/v1/production-orders',
    type: 'production-order',
    numberKeys: ['orderNumber', 'number', 'id'],
  },
  shipments: {
    endpoint: '/api/v1/shipment-releases',
    type: 'shipment-release',
    numberKeys: ['trackingNumber', 'shipmentNumber', 'id'],
  },
};

const businessDocumentSubjectLabel = (
  item: Record<string, unknown>,
  keys: readonly string[],
): string => {
  for (const key of keys) if (typeof item[key] === 'string' && item[key]) return item[key];
  return typeof item.id === 'string' ? item.id : '业务记录';
};

const businessDocumentPrefill = (item: Record<string, unknown> | undefined): string => {
  if (!item) return '';
  const labels: Readonly<Record<string, string>> = {
    quoteNumber: '报价编号',
    contractNumber: '合同编号',
    orderNumber: '订单编号',
    customerName: '客户名称',
    totalAmount: '含税金额',
    currency: '币种',
    deliveryDate: '交付日期',
    trackingNumber: '物流单号',
  };
  return Object.entries(labels)
    .filter(([key]) => item[key] !== undefined && item[key] !== null)
    .map(([key, label]) => `${label}：${String(item[key])}`)
    .join('\n');
};

const businessDocumentOption = (label: string, value: string): HTMLOptionElement => {
  const option = document.createElement('option');
  option.textContent = label;
  option.value = value;
  return option;
};

const sanitizeBusinessDocumentHtml = (value: string): string => {
  const parsed = new DOMParser().parseFromString(value, 'text/html');
  const allowed = new Set([
    'B',
    'BR',
    'DIV',
    'EM',
    'H2',
    'H3',
    'I',
    'LI',
    'OL',
    'P',
    'STRONG',
    'U',
    'UL',
  ]);
  for (const node of Array.from(parsed.body.querySelectorAll('*'))) {
    if (!allowed.has(node.tagName)) {
      node.replaceWith(document.createTextNode(node.textContent));
      continue;
    }
    for (const attribute of Array.from(node.attributes)) node.removeAttribute(attribute.name);
  }
  return parsed.body.innerHTML;
};

const businessDocumentText = (content: Readonly<{ body?: string; html?: string }>): string => {
  if (!content.html) return content.body ?? '';
  const parsed = new DOMParser().parseFromString(content.html, 'text/html');
  return parsed.body.textContent;
};

const renderBusinessDocumentComparison = (
  target: HTMLElement,
  earlier: string,
  latest: string,
  earlierVersion: number,
  latestVersion: number,
): void => {
  const left = earlier.split('\n');
  const right = latest.split('\n');
  const rows = Math.max(left.length, right.length);
  target.replaceChildren(
    el('h3', '', `V${String(earlierVersion)} 与 V${String(latestVersion)} 对比`),
  );
  const grid = el('div', 'business-document-diff-grid');
  for (let index = 0; index < rows; index += 1) {
    const changed = (left[index] ?? '') !== (right[index] ?? '');
    grid.append(
      el('pre', changed ? 'changed' : '', left[index] ?? ''),
      el('pre', changed ? 'changed' : '', right[index] ?? ''),
    );
  }
  target.append(grid);
};

type BusinessDocumentPageSize = 'adaptive' | 'a4-portrait' | 'a4-landscape' | 'a3-portrait';

const printOnlineBusinessDocument = (
  title: string,
  html: string,
  pageSize: BusinessDocumentPageSize,
): void => {
  const popup = window.open('', '_blank');
  if (!popup) throw new Error('浏览器阻止了打印窗口，请允许本站打开新窗口');
  const page = pageSize === 'adaptive' ? 'A4 portrait' : pageSize.replace('-', ' ');
  popup.document.title = title;
  const style = popup.document.createElement('style');
  style.textContent = `
    @page { size: ${page}; margin: 18mm 17mm; }
    * { box-sizing: border-box; }
    body { margin: 0; color: #111; background: #fff; font-family: "Songti SC", SimSun, serif; font-size: 11pt; line-height: 1.8; }
    h1 { margin: 0 0 12mm; text-align: center; font: 700 20pt/1.35 "PingFang SC", sans-serif; }
    h2 { margin: 8mm 0 3mm; font-size: 15pt; break-after: avoid; }
    h3 { margin: 6mm 0 2mm; font-size: 12.5pt; break-after: avoid; }
    p { margin: 0 0 3mm; orphans: 3; widows: 3; }
    li { break-inside: avoid; }
    .document-meta { margin-bottom: 8mm; padding-bottom: 4mm; border-bottom: 1px solid #bbb; color: #555; font-family: "PingFang SC", sans-serif; font-size: 9pt; }
    @media screen { body { max-width: 210mm; margin: 20px auto; padding: 18mm 17mm; box-shadow: 0 8px 28px #0002; } }
  `;
  popup.document.head.append(style);
  const meta = popup.document.createElement('div');
  meta.className = 'document-meta';
  meta.textContent = `金特夫企业经营管理系统 · 打印时间 ${new Date().toLocaleString('zh-CN')}`;
  const heading = popup.document.createElement('h1');
  heading.textContent = title;
  const content = popup.document.createElement('main');
  content.innerHTML = sanitizeBusinessDocumentHtml(html);
  popup.document.body.append(meta, heading, content);
  window.setTimeout(() => {
    popup.focus();
    popup.print();
  }, 200);
};

const openOnlineDocumentEditor = (
  documentData: OnlineBusinessDocument,
  permissions: Readonly<{
    manage: boolean;
    approve: boolean;
    send: boolean;
    translate: boolean;
    configure: boolean;
  }>,
  onSaved?: (currentVersion: number) => void,
): void => {
  let activeVersion = documentData.currentVersion;
  let documentState = documentData.state;
  let latestContent =
    documentData.versions?.find((item) => item.version === activeVersion)?.content ?? {};
  const dialog = document.createElement('dialog');
  dialog.className = 'form-dialog business-document-dialog';
  const heading = el('div', 'dialog-heading');
  const headingCopy = el('div');
  const versionStatus = el(
    'p',
    'muted',
    `当前版本 V${String(activeVersion)} · ${documentData.state === 'APPROVED' ? '已批准锁版' : '保存不会覆盖历史版本'}`,
  );
  headingCopy.append(
    el('p', 'eyebrow', '在线业务文档'),
    el('h2', '', documentData.title),
    versionStatus,
  );
  const close = el('button', 'icon-button', '×');
  close.type = 'button';
  close.setAttribute('aria-label', '关闭在线文档');
  close.addEventListener('click', () => {
    dialog.close();
  });
  heading.append(headingCopy, close);
  const versions = [...(documentData.versions ?? [])].sort((a, b) => b.version - a.version);
  const current = versions.find((item) => item.version === activeVersion) ?? versions[0];
  latestContent = current?.content ?? latestContent;
  const workspace = el('div', 'business-document-workspace');
  workspace.dataset.pageSize = 'a4-portrait';
  workspace.dataset.viewMode = 'edit';
  if (window.innerWidth < 1200) workspace.classList.add('history-collapsed');
  const layout = el('div', 'business-document-layout');
  const editor = el('section', 'business-document-editor');
  const documentScroll = el('div', 'business-document-scroll');
  documentScroll.setAttribute('data-document-scroll', 'true');
  documentScroll.tabIndex = 0;
  documentScroll.setAttribute('aria-label', '文档页面');
  const actionPanel = el('section', 'business-document-action-panel');
  actionPanel.setAttribute('aria-label', '版本保存与审核');
  const history = el('aside', 'business-document-history');
  history.append(el('h3', '', '版本记录'));
  const bindingSummary = el(
    'p',
    'business-document-binding-summary',
    [
      documentData.customerName ? `客户：${documentData.customerName}` : '',
      documentData.salesOrderNumber ? `订单：${documentData.salesOrderNumber}` : '',
      documentData.operatorName ? `经办人：${documentData.operatorName}` : '',
      documentData.salespersonName ? `业务员：${documentData.salespersonName}` : '',
      documentData.assigneeName ? `下一处理人：${documentData.assigneeName}` : '',
    ]
      .filter(Boolean)
      .join('　') || '尚未绑定客户、订单或处理人',
  );
  const title = el('input');
  title.value = documentData.title;
  title.readOnly = true;
  title.setAttribute('aria-label', '文档标题');
  const toolbar = el('div', 'business-document-toolbar');
  const commandBar = el('div', 'business-document-commandbar');
  const viewGroup = el('div', 'business-document-command-group');
  const editMode = el('button', 'secondary compact active', '编辑');
  const previewMode = el('button', 'secondary compact', '阅读预览');
  editMode.type = previewMode.type = 'button';
  editMode.setAttribute('aria-pressed', 'true');
  previewMode.setAttribute('aria-pressed', 'false');
  viewGroup.append(editMode, previewMode);
  const pageSize = el('select', 'business-document-page-select');
  pageSize.setAttribute('aria-label', '页面规格');
  pageSize.append(
    businessDocumentOption('A4 纵向', 'a4-portrait'),
    businessDocumentOption('A4 横向', 'a4-landscape'),
    businessDocumentOption('A3 纵向', 'a3-portrait'),
    businessDocumentOption('自适应阅读', 'adaptive'),
  );
  const zoom = el('select', 'business-document-zoom-select');
  zoom.setAttribute('aria-label', '文档缩放');
  zoom.append(
    businessDocumentOption('75%', '0.75'),
    businessDocumentOption('90%', '0.9'),
    businessDocumentOption('100%', '1'),
    businessDocumentOption('110%', '1.1'),
    businessDocumentOption('125%', '1.25'),
  );
  zoom.value = '0.9';
  const toggleHistory = el('button', 'secondary compact', '收起版本栏');
  toggleHistory.type = 'button';
  if (workspace.classList.contains('history-collapsed')) toggleHistory.textContent = '版本记录';
  toggleHistory.setAttribute(
    'aria-expanded',
    String(!workspace.classList.contains('history-collapsed')),
  );
  const pagination = el('div', 'business-document-pagination');
  pagination.setAttribute('data-document-pagination', 'true');
  const previousPage = el('button', 'secondary compact', '上一页');
  const pageIndicator = el('span', 'business-document-page-indicator', '第 1 / 1 页');
  const nextPage = el('button', 'secondary compact', '下一页');
  previousPage.type = nextPage.type = 'button';
  previousPage.setAttribute('aria-label', '上一页');
  nextPage.setAttribute('aria-label', '下一页');
  pageIndicator.setAttribute('aria-live', 'polite');
  pagination.append(previousPage, pageIndicator, nextPage);
  const print = el('button', 'secondary compact', '打印 / 导出 PDF');
  print.type = 'button';
  print.setAttribute('aria-label', '打印或导出 PDF');
  const downloadOnline = el('button', 'secondary compact', '下载 HTML');
  downloadOnline.type = 'button';
  downloadOnline.setAttribute('aria-label', '下载当前文档内容');
  const translate = el('button', 'secondary compact', '翻译文档');
  translate.type = 'button';
  translate.hidden = !permissions.translate;
  const send = el('button', 'primary compact', '发送给客户');
  send.type = 'button';
  send.hidden = !permissions.send;
  send.title = '查看发送条件并选择客户沟通渠道';
  commandBar.append(
    viewGroup,
    pageSize,
    zoom,
    pagination,
    toggleHistory,
    translate,
    print,
    downloadOnline,
    send,
  );
  const body = el('div');
  body.className = 'business-document-body';
  body.contentEditable = 'true';
  const storedBody = current?.content.body ?? businessDocumentText(current?.content ?? {});
  const upgradedLegacyOutline = isLegacyBusinessDocumentOutline(storedBody);
  body.innerHTML = sanitizeBusinessDocumentHtml(
    upgradedLegacyOutline
      ? buildBusinessDocumentTemplateHtml(
          `${documentData.templateKey.slice(0, 2)}-历史在线文档.docx`,
          documentData.title.split(' · ')[0] ?? documentData.title,
          '',
          '',
          new Date().toLocaleDateString('zh-CN'),
        )
      : (current?.content.html ??
          `<p>${storedBody.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('\n', '<br>')}</p>`),
  );
  body.setAttribute('aria-label', '文档正文');
  body.setAttribute('role', 'textbox');
  let editable = !documentState || ['DRAFT', 'REJECTED'].includes(documentState);
  let savedEditorHtml = body.innerHTML;
  body.contentEditable = String(editable && permissions.manage);
  const documentPageHeight = (): number => {
    const pageHeights: Readonly<Record<BusinessDocumentPageSize, number>> = {
      'a4-portrait': 1123,
      'a4-landscape': 794,
      'a3-portrait': 1587,
      adaptive: Math.max(680, editor.clientHeight),
    };
    return pageHeights[pageSize.value as BusinessDocumentPageSize] * Number(zoom.value);
  };
  const documentPageState = (): Readonly<{ current: number; total: number }> => {
    const pageHeight = Math.max(1, documentPageHeight());
    const total = Math.max(1, Math.ceil(body.scrollHeight / pageHeight));
    const readingOffset = Math.max(0, documentScroll.scrollTop - body.offsetTop + 24);
    const atDocumentEnd =
      documentScroll.scrollTop >= documentScroll.scrollHeight - documentScroll.clientHeight - 8;
    const current = atDocumentEnd
      ? total
      : Math.min(total, Math.max(1, Math.floor(readingOffset / pageHeight) + 1));
    return { current, total };
  };
  const updateDocumentPagination = (): void => {
    const { current, total } = documentPageState();
    pageIndicator.textContent = `第 ${String(current)} / ${String(total)} 页`;
    previousPage.disabled = current <= 1;
    nextPage.disabled = current >= total;
    pagination.hidden = pageSize.value === 'adaptive';
  };
  const goToDocumentPage = (direction: -1 | 1): void => {
    const { current, total } = documentPageState();
    const target = Math.min(total, Math.max(1, current + direction));
    documentScroll.scrollTo({
      top: Math.max(0, body.offsetTop + (target - 1) * documentPageHeight() - 12),
      behavior: 'auto',
    });
    window.requestAnimationFrame(updateDocumentPagination);
  };
  previousPage.addEventListener('click', () => {
    goToDocumentPage(-1);
  });
  nextPage.addEventListener('click', () => {
    goToDocumentPage(1);
  });
  documentScroll.addEventListener('scroll', updateDocumentPagination, { passive: true });
  body.addEventListener('input', updateDocumentPagination);
  documentScroll.addEventListener('keydown', (event) => {
    if (event.key !== 'PageUp' && event.key !== 'PageDown') return;
    event.preventDefault();
    goToDocumentPage(event.key === 'PageUp' ? -1 : 1);
  });
  const setViewMode = (mode: 'edit' | 'preview'): void => {
    workspace.dataset.viewMode = mode;
    const canEdit = mode === 'edit' && editable && permissions.manage;
    body.contentEditable = String(canEdit);
    toolbar.hidden = !canEdit;
    editMode.classList.toggle('active', mode === 'edit');
    previewMode.classList.toggle('active', mode === 'preview');
    editMode.setAttribute('aria-pressed', String(mode === 'edit'));
    previewMode.setAttribute('aria-pressed', String(mode === 'preview'));
  };
  editMode.addEventListener('click', () => {
    setViewMode('edit');
  });
  previewMode.addEventListener('click', () => {
    setViewMode('preview');
  });
  pageSize.addEventListener('change', () => {
    workspace.dataset.pageSize = pageSize.value;
    documentScroll.scrollTop = 0;
    updateDocumentPagination();
  });
  zoom.addEventListener('change', () => {
    workspace.style.setProperty('--document-zoom', zoom.value);
    documentScroll.scrollTop = 0;
    updateDocumentPagination();
  });
  for (const [label, command, value] of [
    ['正文', 'formatBlock', 'p'],
    ['一级标题', 'formatBlock', 'h2'],
    ['二级标题', 'formatBlock', 'h3'],
    ['加粗', 'bold', ''],
    ['项目符号', 'insertUnorderedList', ''],
    ['编号', 'insertOrderedList', ''],
  ] as const) {
    const action = el('button', 'secondary compact', label);
    action.type = 'button';
    action.addEventListener('click', () => {
      body.focus();
      // eslint-disable-next-line @typescript-eslint/no-deprecated -- execCommand preserves the active selection in contenteditable across supported enterprise browsers.
      document.execCommand(command, false, value);
    });
    toolbar.append(action);
  }
  const summary = el('input');
  summary.placeholder = '本版修改说明，例如：调整数量、价格和交期';
  summary.setAttribute('aria-label', '本版修改说明');
  const status = el(
    'p',
    'operation-status',
    upgradedLegacyOutline
      ? '已将旧提纲升级为完整正文，请核对业务信息后保存为新版本'
      : '编辑完成后保存为新版本',
  );
  if (upgradedLegacyOutline) status.dataset.state = 'warning';
  status.setAttribute('aria-live', 'polite');
  const save = el('button', 'primary', '保存为新版本');
  save.type = 'button';
  save.hidden = !editable || !permissions.manage;
  save.addEventListener('click', () => {
    if (save.disabled) return;
    const editingSnapshot = body.innerHTML;
    const cleanHtml = sanitizeBusinessDocumentHtml(body.innerHTML);
    const plainText = businessDocumentText({ html: cleanHtml });
    if (!plainText.trim()) {
      setOperationStatus(status, 'error', '文档正文不能为空');
      return;
    }
    if (!summary.value.trim()) {
      setOperationStatus(status, 'error', '请填写本版修改说明');
      return;
    }
    save.disabled = true;
    setOperationStatus(status, 'loading', '正在保存新版本…');
    void onlineDocumentApi<{ currentVersion: number }>(
      `/api/v1/business-documents/${documentData.id}/versions`,
      {
        method: 'POST',
        body: JSON.stringify({
          expectedVersion: activeVersion,
          content: { body: plainText, html: cleanHtml },
          changeSummary: summary.value,
        }),
      },
    )
      .then((saved) => {
        activeVersion = saved.currentVersion;
        latestContent = { body: plainText, html: cleanHtml };
        savedEditorHtml = cleanHtml;
        if (body.innerHTML === editingSnapshot) body.innerHTML = cleanHtml;
        const savedVersion = {
          version: activeVersion,
          content: latestContent,
          changeSummary: summary.value.trim(),
          createdAt: new Date().toISOString(),
        };
        versions.unshift(savedVersion);
        addVersionToHistory(savedVersion, true);
        versionStatus.textContent = `当前版本 V${String(activeVersion)} · 保存不会覆盖历史版本`;
        setOperationStatus(
          status,
          'success',
          `已保存到当前业务页的“已保存在线文档”及右侧“版本记录”：V${String(activeVersion)}。编辑窗口保持打开，可继续修改。`,
        );
        summary.value = '';
        save.disabled = false;
        save.textContent = '继续保存为新版本';
        clearSessionReadCache();
        onSaved?.(activeVersion);
      })
      .catch((failure: unknown) => {
        save.disabled = false;
        setOperationStatus(
          status,
          'error',
          failure instanceof Error ? failure.message : '在线文档保存失败',
        );
      });
  });
  documentScroll.append(title, bindingSummary, toolbar, body);
  actionPanel.append(summary, save, status);
  editor.append(documentScroll, actionPanel);
  toolbar.hidden = !editable || !permissions.manage;
  summary.hidden = !editable || !permissions.manage;
  const reviewActions = el('div', 'business-document-review-actions');
  const reviewReason = el('input');
  reviewReason.placeholder = '填写提交说明或审批意见';
  reviewReason.setAttribute('aria-label', '文档审核意见');
  const addReviewAction = (
    label: string,
    action: 'submit' | 'approve' | 'reject',
    primary: boolean,
  ) => {
    const button = el('button', primary ? 'primary' : 'secondary', label);
    button.type = 'button';
    button.addEventListener('click', () => {
      if (button.disabled) return;
      if (action === 'submit' && body.innerHTML !== savedEditorHtml) {
        setOperationStatus(status, 'error', '正文有未保存的修改，请先保存为新版本，再提交审核');
        return;
      }
      if (reviewReason.value.trim().length < 2) {
        setOperationStatus(status, 'error', '请填写至少 2 个字的审核意见');
        return;
      }
      button.disabled = true;
      void onlineDocumentApi(`/api/v1/business-documents/${documentData.id}/${action}`, {
        method: 'POST',
        body: JSON.stringify({
          expectedVersion: activeVersion,
          reason: reviewReason.value.trim(),
        }),
      })
        .then(() => {
          documentState =
            action === 'approve' ? 'APPROVED' : action === 'reject' ? 'REJECTED' : 'IN_REVIEW';
          editable = ['DRAFT', 'REJECTED'].includes(documentState);
          setViewMode(editable ? 'edit' : 'preview');
          save.hidden = !editable || !permissions.manage;
          summary.hidden = !editable || !permissions.manage;
          versionStatus.textContent = `当前版本 V${String(activeVersion)} · ${documentState === 'APPROVED' ? '已批准锁版' : documentState === 'IN_REVIEW' ? '等待审批' : '可修改后重新提审'}`;
          renderReviewActions();
          reviewReason.value = '';
          setOperationStatus(status, 'success', `${label}成功`);
          clearSessionReadCache();
          onSaved?.(activeVersion);
        })
        .catch((failure: unknown) => {
          button.disabled = false;
          setOperationStatus(
            status,
            'error',
            failure instanceof Error ? failure.message : `${label}失败`,
          );
        });
    });
    reviewActions.append(button);
  };
  const renderReviewActions = (): void => {
    reviewActions.replaceChildren();
    if (editable && permissions.manage) addReviewAction('提交审核', 'submit', true);
    if (documentState === 'IN_REVIEW' && permissions.approve) {
      addReviewAction('批准并锁版', 'approve', true);
      addReviewAction('驳回修改', 'reject', false);
    }
    reviewReason.hidden = reviewActions.childElementCount === 0;
    reviewActions.hidden = reviewReason.hidden;
  };
  renderReviewActions();
  actionPanel.append(reviewReason, reviewActions);
  const comparison = el('section', 'business-document-comparison');
  for (const item of documentData.dispatches ?? [])
    history.append(
      el(
        'p',
        'business-document-review-event',
        `${documentDispatchStatus(item.status)} · ${item.channel} · ${item.recipientName}（${item.recipientMasked}）`,
      ),
    );
  for (const item of documentData.translations ?? []) {
    const translationEntry = el('div', 'business-document-review-event');
    translationEntry.append(
      el(
        'span',
        '',
        `译文 · ${item.targetLocale} · V${String(item.sourceVersion)} · ${item.status === 'READY' ? '可发送' : '处理中'}`,
      ),
    );
    if (item.status === 'READY' && item.content) {
      const preview = el('button', 'secondary compact', '查看译文');
      preview.type = 'button';
      preview.addEventListener('click', () => {
        const previewDialog = document.createElement('dialog');
        previewDialog.className = 'business-document-dialog translation-preview-dialog';
        const closePreview = el('button', 'secondary compact', '关闭');
        closePreview.type = 'button';
        closePreview.addEventListener('click', () => {
          previewDialog.close();
        });
        const translatedBody = el('article', 'business-document-body translation-preview');
        if (item.content?.html)
          translatedBody.innerHTML = sanitizeBusinessDocumentHtml(item.content.html);
        else translatedBody.textContent = item.content?.body ?? '';
        previewDialog.append(
          el('h2', '', `${item.targetLocale} 译文 · 版本 ${String(item.sourceVersion)}`),
          translatedBody,
          closePreview,
        );
        previewDialog.addEventListener('close', () => {
          previewDialog.remove();
        });
        document.body.append(previewDialog);
        previewDialog.showModal();
      });
      translationEntry.append(preview);
    }
    history.append(translationEntry);
  }
  if (versions.length === 0) history.append(el('p', 'empty', '暂无版本记录'));
  for (const event of documentData.reviewEvents ?? [])
    history.append(
      el(
        'p',
        'business-document-review-event',
        `${event.action === 'SUBMITTED' ? '已提交' : event.action === 'APPROVED' ? '已批准' : '已驳回'} · ${event.reason}`,
      ),
    );
  const addVersionToHistory = (
    item: NonNullable<OnlineBusinessDocument['versions']>[number],
    newest = false,
  ): void => {
    const versionItem = el('button', 'business-document-version');
    versionItem.type = 'button';
    versionItem.append(
      el('strong', '', `V${String(item.version)}`),
      el('span', '', item.changeSummary),
      el('small', '', item.createdAt ? new Date(item.createdAt).toLocaleString('zh-CN') : ''),
    );
    versionItem.addEventListener('click', () => {
      body.innerHTML = sanitizeBusinessDocumentHtml(
        item.content.html ??
          `<p>${(item.content.body ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('\n', '<br>')}</p>`,
      );
      renderBusinessDocumentComparison(
        comparison,
        businessDocumentText(item.content),
        businessDocumentText(latestContent),
        item.version,
        activeVersion,
      );
      setOperationStatus(
        status,
        'idle',
        `正在查看 V${String(item.version)}；继续保存将基于当前最新版生成新版本`,
      );
    });
    if (newest) history.insertBefore(versionItem, history.children[1] ?? null);
    else history.append(versionItem);
  };
  for (const item of versions) addVersionToHistory(item);
  toggleHistory.addEventListener('click', () => {
    const collapsed = workspace.classList.toggle('history-collapsed');
    toggleHistory.textContent = collapsed ? '展开版本栏' : '收起版本栏';
    toggleHistory.setAttribute('aria-expanded', String(!collapsed));
  });
  translate.addEventListener('click', () => {
    openForm(
      document.body,
      '创建文档译文',
      '译文固定关联当前版本。可使用已配置的自动翻译服务，也可人工录入并复核译文。',
      [
        {
          name: 'targetLocale',
          label: '目标语言',
          type: 'select',
          required: true,
          options: [
            { value: 'en-US', label: '英语（美国）' },
            { value: 'en-GB', label: '英语（英国）' },
            { value: 'es-ES', label: '西班牙语' },
            { value: 'fr-FR', label: '法语' },
            { value: 'de-DE', label: '德语' },
            { value: 'ar-SA', label: '阿拉伯语' },
            { value: 'ja-JP', label: '日语' },
            { value: 'ko-KR', label: '韩语' },
          ],
        },
        {
          name: 'mode',
          label: '翻译方式',
          type: 'select',
          required: true,
          options: [
            { value: 'AUTO', label: '自动翻译（需管理员配置服务）' },
            { value: 'MANUAL', label: '人工录入并复核' },
          ],
        },
        {
          name: 'translatedContent',
          label: '人工译文正文',
          type: 'textarea',
          placeholder: '选择人工录入时填写；自动翻译时保持为空',
          hint: '人工译文会作为不可变版本保存，发送时可明确选择。',
        },
      ],
      '创建译文',
      async (values) => {
        const manual = values.mode === 'MANUAL';
        if (manual && !values.translatedContent?.trim())
          throw new Error('人工翻译方式必须填写译文正文');
        const translated = await onlineDocumentApi<{ status: 'QUEUED' | 'READY' }>(
          `/api/v1/business-documents/${documentData.id}/translations`,
          {
            method: 'POST',
            body: JSON.stringify({
              expectedVersion: activeVersion,
              targetLocale: values.targetLocale,
              ...(manual
                ? {
                    content: {
                      body: values.translatedContent?.trim(),
                      html: `<p>${(values.translatedContent ?? '')
                        .replaceAll('&', '&amp;')
                        .replaceAll('<', '&lt;')
                        .replaceAll('>', '&gt;')
                        .replaceAll('\n', '<br>')}</p>`,
                    },
                  }
                : {}),
            }),
          },
        );
        setOperationStatus(
          status,
          'success',
          translated.status === 'READY' ? '人工译文已保存并可用于发送' : '自动翻译任务已进入队列',
        );
        clearSessionReadCache();
        onSaved?.(activeVersion);
      },
    );
  });
  send.addEventListener('click', () => {
    if (send.disabled) return;
    const openSettings = (): void => {
      if (!permissions.configure) return;
      const settings = el('dialog', 'form-dialog document-send-settings');
      settings.setAttribute('aria-label', '发送与翻译连接器');
      const content = el('div', 'entity-form');
      const grid = el('div', 'document-connector-grid');
      const back = el('button', 'secondary', '返回文档');
      back.type = 'button';
      back.addEventListener('click', () => {
        settings.close();
      });
      content.append(
        el('h2', '', '发送与翻译连接器'),
        el(
          'p',
          'muted',
          '当前文档和未保存内容会保留。配置元数据后仍需运维接入实际发送服务；入队不代表送达。保存后返回文档，重新点击发送以检查最新配置。',
        ),
        grid,
        back,
      );
      settings.append(content);
      settings.addEventListener('close', () => {
        settings.remove();
        send.focus();
      });
      document.body.append(settings);
      settings.showModal();
      renderDocumentConnectors(grid);
    };
    const blocked = documentSendBlockReason(documentState, documentData.customerId);
    if (blocked) {
      const notice = documentSendNotice(
        (editable && body.innerHTML !== savedEditorHtml ? '正文有未保存的修改。' : '') + blocked,
      );
      if (editable && permissions.manage) {
        notice.addAction('去保存 / 提交审核', () => {
          actionPanel.scrollIntoView({ block: 'nearest' });
          if (body.innerHTML !== savedEditorHtml) summary.focus();
          else reviewReason.focus();
        });
      } else if (documentState === 'IN_REVIEW' && permissions.approve) {
        notice.addAction('去审批', () => {
          actionPanel.scrollIntoView({ block: 'nearest' });
          reviewReason.focus();
        });
      }
      if (permissions.configure) notice.addAction('发送渠道配置', openSettings);
      return;
    }
    const notice = documentSendNotice('正在读取可用发送渠道，请稍候…');
    const abort = new AbortController();
    notice.dialog.addEventListener(
      'close',
      () => {
        abort.abort();
      },
      { once: true },
    );
    send.disabled = true;
    send.textContent = '正在读取渠道…';
    void onlineDocumentApi<{ items: readonly DocumentConnector[] }>('/api/v1/document-connectors', {
      signal: abort.signal,
    })
      .then(({ items }) => {
        if (!notice.dialog.open) return;
        const channels = items.filter(
          (item) => item.connector !== 'TRANSLATION' && item.status === 'READY',
        );
        if (channels.length === 0) {
          notice.message.textContent =
            '尚未配置可用发送渠道。' +
            (permissions.configure
              ? '点击“前往发送配置”设置企业账号和密钥引用；实际发送服务需运维接入。'
              : '您没有发送渠道配置权限，请联系管理员进入“业务文档库 → 发送与翻译连接器”完成企业账号和发送服务接入。') +
            '当前文档已保留，尚未发送给客户。';
          if (permissions.configure) notice.addAction('前往发送配置', openSettings);
          notice.addAction('重新检查配置', () => {
            send.click();
          });
          return;
        }
        notice.dialog.close();
        const sendKeys = new Map<string, string>();
        openForm(
          document.body,
          '发送给客户',
          '仅提交当前已批准锁版内容。进入队列不等于客户已收到，须以发送服务回执为准。收件地址受控保存，日志仅显示脱敏信息。',
          [
            {
              name: 'channel',
              label: '发送渠道',
              type: 'select',
              required: true,
              options: channels.map((item) => ({
                value: item.connector,
                label: `${item.label} · ${item.status === 'READY' ? '已配置' : item.status === 'DISABLED' ? '已停用' : '待管理员配置'}`,
              })),
            },
            { name: 'recipientName', label: '收件人姓名', required: true, maxLength: 200 },
            {
              name: 'recipientAddress',
              label: '邮箱或平台客户标识',
              required: true,
              maxLength: 320,
              hint: '邮件填写邮箱；其他平台填写经客户授权的平台标识。',
            },
            {
              name: 'translationId',
              label: '发送语言版本',
              type: 'select',
              options: [
                { value: '', label: '原文' },
                ...(documentData.translations ?? [])
                  .filter((item) => item.status === 'READY' && item.sourceVersion === activeVersion)
                  .map((item) => ({ value: item.id, label: `${item.targetLocale} 译文` })),
              ],
            },
            {
              name: 'subject',
              label: '主题',
              required: true,
              value: documentData.title,
              maxLength: 200,
            },
            {
              name: 'message',
              label: '给客户的说明',
              type: 'textarea',
              required: true,
              value: '您好，请查收并确认本次业务文档。如有问题，请直接联系对应业务人员。',
              maxLength: 4000,
            },
          ],
          '确认进入发送队列',
          async (values) => {
            const payload = JSON.stringify({
              expectedVersion: activeVersion,
              channel: values.channel,
              recipientName: values.recipientName,
              recipientAddress: values.recipientAddress,
              subject: values.subject,
              message: values.message,
              ...(values.translationId ? { translationId: values.translationId } : {}),
            });
            if (!sendKeys.has(payload)) sendKeys.set(payload, requestId());
            const result = await onlineDocumentApi<{ id: string; status: string }>(
              `/api/v1/business-documents/${documentData.id}/send`,
              {
                method: 'POST',
                headers: { 'idempotency-key': sendKeys.get(payload) ?? requestId() },
                body: payload,
              },
            );
            const receipt = `发送任务 ${result.id}：${documentDispatchStatus(result.status)}。可在文档版本栏查看发送记录。`;
            setOperationStatus(status, 'success', receipt);
            history.append(el('p', 'business-document-review-event', receipt));
            clearSessionReadCache();
            onSaved?.(activeVersion);
          },
        );
      })
      .catch((failure: unknown) => {
        if (!notice.dialog.open) return;
        setOperationStatus(
          notice.message,
          'error',
          `发送渠道读取失败：${failure instanceof Error ? failure.message : '网络异常'}。请返回文档后重试；未发送任何文档。`,
        );
        notice.addAction('重试读取渠道', () => {
          send.click();
        });
      })
      .finally(() => {
        send.disabled = false;
        send.textContent = '发送给客户';
      });
  });
  print.addEventListener('click', () => {
    try {
      printOnlineBusinessDocument(
        documentData.title,
        body.innerHTML,
        pageSize.value as BusinessDocumentPageSize,
      );
      void onlineDocumentApi(`/api/v1/business-documents/${documentData.id}/activity`, {
        method: 'POST',
        body: JSON.stringify({ action: 'PRINTED', version: activeVersion }),
      }).catch(() => {
        setOperationStatus(status, 'error', '打印已打开，但审计记录暂时写入失败');
      });
    } catch (failure) {
      setOperationStatus(
        status,
        'error',
        failure instanceof Error ? failure.message : '无法打开打印预览',
      );
    }
  });
  downloadOnline.addEventListener('click', () => {
    const safeTitle = documentData.title
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;');
    const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>${safeTitle}</title></head><body><h1>${safeTitle}</h1>${sanitizeBusinessDocumentHtml(body.innerHTML)}</body></html>`;
    const href = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = href;
    link.download = `${documentData.title.replaceAll(/[\\/:*?"<>|]/gu, '-')}-V${String(activeVersion)}.html`;
    link.click();
    URL.revokeObjectURL(href);
    void onlineDocumentApi(`/api/v1/business-documents/${documentData.id}/activity`, {
      method: 'POST',
      body: JSON.stringify({ action: 'DOWNLOADED', version: activeVersion }),
    }).catch(() => {
      setOperationStatus(status, 'error', '文件已下载，但审计记录暂时写入失败');
    });
  });
  layout.append(editor, history);
  workspace.append(commandBar, layout, comparison);
  dialog.append(heading, workspace);
  dialog.addEventListener('close', () => {
    dialog.remove();
  });
  document.body.append(dialog);
  dialog.showModal();
  window.requestAnimationFrame(updateDocumentPagination);
};
const displayTime = (timestamp: string | undefined) =>
  timestamp ? new Date(timestamp).toLocaleString('zh-CN') : '时间未知';

function customer360Content(view: Customer360): HTMLElement {
  const content = el('section', 'customer-360-content');

  const contacts = el('section', 'detail-section contacts-section');
  contacts.append(el('h3', '', '联系人'));
  if (view.contacts.length === 0) contacts.append(el('p', 'empty', '暂无可见联系人'));
  for (const contact of view.contacts) {
    const card = el('article', 'info-card contact-card');
    card.append(
      el('strong', '', `${contact.name}${contact.primary === true ? ' · 主要联系人' : ''}`),
    );
    if (contact.title) card.append(el('span', 'contact-title', contact.title));
    const details = el('p', 'contact-details');
    const visibleDetails = [
      Object.hasOwn(contact, 'email') ? contact.email : undefined,
      Object.hasOwn(contact, 'phone') ? contact.phone : undefined,
    ].filter((item): item is string => typeof item === 'string' && item.length > 0);
    details.textContent =
      visibleDetails.length > 0 ? visibleDetails.join(' · ') : '联系方式受限或未提供';
    card.append(details);
    contacts.append(card);
  }

  const ownership = el('section', 'detail-section ownership-section');
  ownership.append(el('h3', '', '归属历史'));
  if (view.ownership.length === 0) ownership.append(el('p', 'empty', '暂无可见归属记录'));
  for (const item of view.ownership) {
    const row = el('article', 'history-row');
    row.append(
      el('strong', '', item.ownerId),
      el('span', '', item.reason),
      el(
        'time',
        '',
        `${displayTime(item.startedAt)}${item.endedAt ? ` — ${displayTime(item.endedAt)}` : ' — 当前'}`,
      ),
    );
    ownership.append(row);
  }

  const leads = el('section', 'detail-section related-leads-section');
  leads.append(el('h3', '', '关联线索'));
  if (view.leads.length === 0) leads.append(el('p', 'empty', '暂无可见关联线索'));
  for (const lead of view.leads) {
    const row = el('article', 'history-row related-lead');
    row.append(
      el('strong', '', lead.title ?? lead.id),
      el('span', '', `${lead.source ?? '来源未知'} · ${lead.status ?? '状态未知'}`),
      el('time', '', displayTime(lead.createdAt)),
    );
    leads.append(row);
  }

  const timeline = el('section', 'detail-section activity-timeline');
  timeline.append(el('h3', '', '活动时间线'));
  const activities = [...view.activities].sort(
    (left, right) => Date.parse(right.occurredAt) - Date.parse(left.occurredAt),
  );
  if (activities.length === 0) timeline.append(el('p', 'empty', '暂无可见活动'));
  for (const activity of activities) {
    const row = el('article', 'timeline-item');
    row.append(
      el('time', '', displayTime(activity.occurredAt)),
      el('strong', '', businessEventLabel(activity.type)),
      el('p', '', activity.summary),
    );
    timeline.append(row);
  }

  const opportunities = el('section', 'detail-section related-opportunities-section');
  opportunities.append(el('h3', '', '关联商机'));
  if (view.opportunities.length === 0) opportunities.append(el('p', 'empty', '暂无可见关联商机'));
  for (const item of view.opportunities) {
    const row = el('article', 'history-row related-opportunity');
    const amount = item.value?.amount;
    const currency = item.value?.currency;
    const probability =
      typeof item.probabilityBasisPoints === 'number'
        ? `${(item.probabilityBasisPoints / 100).toFixed(0)}%`
        : '概率受限';
    row.append(
      el('strong', '', item.name ?? item.id),
      el(
        'span',
        '',
        `${businessStateLabel(item.status)} · ${currency && amount ? displayMoney(currency, amount) : '金额受限'} · ${probability}`,
      ),
      el('time', '', item.expectedCloseDate ?? '预计日期受限'),
    );
    opportunities.append(row);
  }

  content.append(contacts, ownership, leads, opportunities, timeline);
  return content;
}

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

function installRouteSectionNavigation(shell: HTMLElement): void {
  for (const previous of shell.querySelectorAll('.route-section-nav')) previous.remove();
  const routeContext = shell.querySelector<HTMLElement>('[data-route-context]');
  if (!routeContext?.parentElement) return;
  for (const route of APP_ROUTES) {
    if (route === 'overview' || route === 'governance') continue;
    const sections = Array.from(shell.querySelectorAll<HTMLElement>('[data-route-view]'))
      .filter((view) => (view.dataset.routeView ?? '').split(/\s+/u).includes(route))
      .map((view) => ({ view, heading: view.querySelector<HTMLElement>('h2, h3') }))
      .filter(
        (entry): entry is { view: HTMLElement; heading: HTMLElement } =>
          entry.heading !== null && entry.heading.textContent.trim() !== APP_ROUTE_LABELS[route],
      );
    const unique = sections.filter(
      (entry, index) =>
        sections.findIndex(
          (candidate) => candidate.heading.textContent === entry.heading.textContent,
        ) === index,
    );
    if (unique.length < 2) continue;
    const nav = el('nav', 'route-section-nav');
    nav.setAttribute('data-route-view', route);
    nav.setAttribute('aria-label', `${APP_ROUTE_LABELS[route]}页面分区`);
    nav.append(el('span', 'route-section-label', '本页导航'));
    for (const { view, heading } of unique.slice(0, 6)) {
      const button = el('button', 'route-section-link', heading.textContent.trim());
      button.type = 'button';
      button.addEventListener('click', () => {
        view.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      nav.append(button);
    }
    routeContext.parentElement.insertBefore(nav, routeContext.nextSibling);
  }
}

function installRoleTaskInsights(shell: HTMLElement): void {
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

const NAV_ICON_PATHS: Readonly<Record<NavIconName, readonly string[]>> = {
  overview: ['M3 3v7h7V3H3Z', 'M14 3v4h7V3h-7Z', 'M14 11v10h7V11h-7Z', 'M3 14v7h7v-7H3Z'],
  sales: ['M4 19V9', 'M10 19V5', 'M16 19v-7', 'M22 19H2'],
  operations: ['M4 5h16v14H4z', 'M8 9h8', 'M8 13h5'],
  customers: [
    'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2',
    'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z',
    'M22 21v-2a4 4 0 0 0-3-3.87',
    'M16 3.13a4 4 0 0 1 0 7.75',
  ],
  opportunities: ['M12 2v20', 'M17 5H9.5a3.5 3.5 0 0 0 0 7H14a3.5 3.5 0 0 1 0 7H6'],
  cost: ['M3 3v18h18', 'M7 16l4-4 3 3 5-7'],
  contracts: ['M6 2h9l5 5v15H6z', 'M14 2v6h6', 'M9 13h6', 'M9 17h6'],
  receivables: ['M2 7h20v10H2z', 'M6 12h4', 'M17 10v4'],
  production: ['M3 21V9l6 4V9l6 4V3h6v18z', 'M7 17h2', 'M13 17h2'],
  quality: ['M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z', 'm9 12 2 2 4-4'],
  delivery: [
    'M3 6h13v11H3z',
    'M16 10h3l3 3v4h-6z',
    'M7 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z',
    'M18 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z',
  ],
  governance: [
    'M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z',
    'M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.12 3.67-.08-.03a1.7 1.7 0 0 0-1.84-.28l-.28.16a1.7 1.7 0 0 0-.84 1.48V22h-4.24v-.08a1.7 1.7 0 0 0-.84-1.48l-.28-.16a1.7 1.7 0 0 0-1.84.28l-.08.03-2.12-3.67.06-.06A1.7 1.7 0 0 0 4.6 15v-.32a1.7 1.7 0 0 0-.99-1.55L3.5 13.1V8.9l.11-.03a1.7 1.7 0 0 0 .99-1.55V7a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.12-3.67.08.03a1.7 1.7 0 0 0 1.84.28l.28-.16A1.7 1.7 0 0 0 9.36.06V0h4.24v.08a1.7 1.7 0 0 0 .84 1.48l.28.16a1.7 1.7 0 0 0 1.84-.28l.08-.03 2.12 3.67-.06.06A1.7 1.7 0 0 0 19.4 7v.32a1.7 1.7 0 0 0 .99 1.55l.11.03v4.2l-.11.03a1.7 1.7 0 0 0-.99 1.55V15Z',
  ],
};

function navIcon(name: NavIconName): HTMLElement {
  const icon = el('span', 'nav-icon');
  icon.setAttribute('aria-hidden', 'true');
  const paths = NAV_ICON_PATHS[name].map((data) => `<path d="${data}"></path>`).join('');
  icon.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
  return icon;
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
