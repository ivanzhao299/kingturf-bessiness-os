import { hasPermissionPrefix } from './shared/permission-prefix';
import { visibleGovernanceSurfaces } from './governance/surfaces';
export {
  GOVERNANCE_SURFACES,
  visibleGovernanceSurfaces,
  type GovernanceSurface,
} from './governance/surfaces';
import { GovernanceController } from './governance/controller';
export { GovernanceController } from './governance/controller';
export { governanceNextAction, governanceChannelLabel } from './governance/presentation';
import { createGovernanceWorkspace } from './governance/workspace';
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
import { localizeEnterpriseCopy } from './shared/locale';
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
import { requestId } from './http';
import type { SessionDto } from './session';
export { setOperationStatus, type OperationState } from './dom';
export { RequestError } from './http';
import './style.css';

export const BOOTSTRAP_TITLE = '金特夫企业经营管理系统';

export type { CommercialPermission } from './commercial/permissions';

export { BUSINESS_DOCUMENT_TEMPLATES } from './shared/document-templates';

export { templatesForRoute } from './shared/document-templates';

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

export const governanceWorkspace = createGovernanceWorkspace({ replaceRouteView });

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
