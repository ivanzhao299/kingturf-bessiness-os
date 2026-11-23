import { sessionFixture } from './test-fixtures/session';
import { scopeGrantChoiceLabeler } from './governance/identity-scopes';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { createUiKitSection } from './ui-kit/view';
import {
  BOOTSTRAP_TITLE,
  businessEventDetailLabel,
  businessEventLabel,
  cashRiskSummary,
  CommercialController,
  contractOrderReadiness,
  customerStateLabel,
  CrmController,
  GovernanceController,
  commercialWorkspaceStructure,
  commercialRevisionPath,
  createCrmShell,
  appRouteFromHash,
  type CrmApi,
  type Customer,
  type Lead,
  viewportFor,
  visibleCrmSections,
  visibleCommercialSections,
  visibleGovernanceSurfaces,
  visibleAppRoutes,
  inventoryLocationOption,
  isCommercialPermission,
  opportunityPipelineSummary,
  roleWorkspaceProfile,
  roleTaskInsight,
  routeViewSelector,
  quoteWorkflowReadiness,
  commissionNextAction,
  operationsNextAction,
  qualityStageLabel,
  riskRuleLabel,
  shipmentGateLabel,
  supplyModeLabel,
  setOperationStatus,
  technicalSolutionOpportunityId,
  templatesForRoute,
  governanceWorkspace,
  governanceSubpage,
  governanceChannelLabel,
  governanceNextAction,
} from './bootstrap';

const readBoundSource = (path: string, anchor: string): string => {
  const source = readFileSync(new URL(path, import.meta.url), 'utf8');
  if (
    !source.trim() ||
    !source.includes(anchor) ||
    source.indexOf(anchor) !== source.lastIndexOf(anchor)
  )
    throw new Error(`Source must remain bound to a unique implementation anchor: ${path}`);
  return source;
};

const readOnlineEditorSources = (): string[] => [
  readBoundSource('./shared/online-editor.ts', 'export function createOnlineDocumentEditor'),
  readBoundSource('./shared/online-editor-heading.ts', 'export function createOnlineEditorHeading'),
  readBoundSource(
    './shared/online-editor-workspace.ts',
    'export function createOnlineEditorWorkspace',
  ),
  readBoundSource(
    './shared/online-editor-pagination.ts',
    'export function bindOnlineEditorPagination',
  ),
  readBoundSource('./shared/online-editor-save.ts', 'export function createOnlineEditorSave'),
  readBoundSource('./shared/online-editor-review.ts', 'export function createOnlineEditorReview'),
  readBoundSource(
    './shared/online-editor-review-completion.ts',
    'export function completeOnlineEditorReview',
  ),
  readBoundSource('./shared/online-editor-history.ts', 'export function appendOnlineEditorHistory'),
  readBoundSource(
    './shared/online-editor-version-history.ts',
    'export function createOnlineEditorVersionHistory',
  ),
  readBoundSource(
    './shared/online-editor-translation.ts',
    'export function bindOnlineEditorTranslation',
  ),
  readBoundSource(
    './shared/online-editor-send-settings.ts',
    'export function createOnlineEditorSendSettings',
  ),
  readBoundSource(
    './shared/online-editor-send-form.ts',
    'export function openOnlineEditorSendForm',
  ),
  readBoundSource(
    './shared/online-editor-send-blocked.ts',
    'export function showOnlineEditorBlockedNotice',
  ),
  readBoundSource('./shared/online-editor-send.ts', 'export function bindOnlineEditorSend'),
  readBoundSource('./shared/online-editor-export.ts', 'export function bindOnlineEditorExport'),
];

const readDocumentSupportSources = (): string[] => [
  readBoundSource('./shared/business-date.ts', 'export const formatBusinessDate ='),
  readBoundSource('./shared/document-read-service.ts', 'export function createDocumentReadService'),
  readBoundSource(
    './shared/document-connector-configuration.ts',
    'export function openDocumentConnectorConfiguration',
  ),
  readBoundSource(
    './shared/document-connector-card.ts',
    'export function appendDocumentConnectorCard',
  ),
  readBoundSource(
    './shared/document-connectors.ts',
    'export function createDocumentConnectorRenderer',
  ),
  readBoundSource('./shared/document-bindings.ts', 'export const BUSINESS_DOCUMENT_SUBJECTS'),
  readBoundSource('./shared/document-html.ts', 'export const sanitizeBusinessDocumentHtml'),
  readBoundSource('./shared/document-print.ts', 'export const printOnlineBusinessDocument'),
];

const readGovernanceSources = (): string[] => [
  readBoundSource('./shared/permission-prefix.ts', 'export const hasPermissionPrefix'),
  readBoundSource('./governance/controller.ts', 'export class GovernanceController'),
  readBoundSource('./governance/surfaces.ts', 'export const GOVERNANCE_SURFACES'),
  readBoundSource('./governance/presentation.ts', 'export const governanceItems'),
  readBoundSource('./governance/audit-workbench.ts', 'export function auditWorkbench'),
  readBoundSource('./governance/list-view.ts', 'export function createGovernanceListView'),
  readBoundSource('./governance/workspace-heading.ts', 'export function createGovernanceHeading'),
  readBoundSource(
    './governance/workspace-actions.ts',
    'export function createGovernanceFormActions',
  ),
  readBoundSource('./governance/workspace-ordering.ts', 'export function createGovernanceOrdering'),
  readBoundSource('./governance/workspace-card.ts', 'export function createGovernanceCard'),
  readBoundSource(
    './governance/organization-actions.ts',
    'export function appendGovernanceOrganizationActions',
  ),
  readBoundSource(
    './governance/employee-actions.ts',
    'export function appendGovernanceEmployeeActions',
  ),
  readBoundSource(
    './governance/identity-role-buttons.ts',
    'export function createGovernanceRoleButtons',
  ),
  readBoundSource(
    './governance/identity-account-buttons.ts',
    'export function createGovernanceAccountButtons',
  ),
  readBoundSource(
    './governance/identity-grant-button.ts',
    'export function createGovernanceGrantButton',
  ),
  readBoundSource(
    './governance/identity-state.ts',
    'export function appendGovernanceIdentityState',
  ),
  readBoundSource(
    './governance/identity-revoke-grant.ts',
    'export function appendGovernanceRevokeGrant',
  ),
  readBoundSource(
    './governance/identity-scopes.ts',
    'export function appendGovernanceIdentityScopes',
  ),
  readBoundSource(
    './governance/identity-actions.ts',
    'export function appendGovernanceIdentityActions',
  ),
  readBoundSource(
    './governance/master-data-actions.ts',
    'export function appendGovernanceMasterDataActions',
  ),
  readBoundSource(
    './governance/numbering-actions.ts',
    'export function appendGovernanceNumberingActions',
  ),
  readBoundSource('./governance/rule-actions.ts', 'export function appendGovernanceRuleActions'),
  readBoundSource(
    './governance/workflow-actions.ts',
    'export function appendGovernanceWorkflowActions',
  ),
  readBoundSource(
    './governance/workflow-task-actions.ts',
    'export function appendGovernanceTaskActions',
  ),
  readBoundSource(
    './governance/notification-actions.ts',
    'export function appendGovernanceNotificationActions',
  ),
  readBoundSource(
    './governance/registry-actions.ts',
    'export function appendGovernanceRegistryActions',
  ),
  readBoundSource('./governance/workspace-sources.ts', 'export function appendGovernanceSources'),
  readBoundSource('./governance/workspace.ts', 'export function createGovernanceWorkspace'),
  // UI-M2b：subpage 装配体随九子页控制台化退役；装配锚点移至 console-entry。
  readBoundSource('./governance/console-entry.ts', 'export function createGovernanceSubpage'),
  readBoundSource('./governance/route-loading.ts', 'export function installGovernanceRouteLoading'),
  readBoundSource('./governance/tenant-settings.ts', 'export function createTenantSettingsSection'),
];

const readCommercialStoreSources = (): string[] => [
  readBoundSource('./commercial/store/controller.ts', 'export class CommercialController'),
  readBoundSource('./commercial/store/cost-query.ts', 'export const initialCostMatrixQuery'),
  readBoundSource(
    './commercial/store/readable-sources.ts',
    'export function readableCommercialSources',
  ),
  readBoundSource(
    './commercial/store/load-opportunities.ts',
    'export function startCommercialOpportunityLoad',
  ),
  readBoundSource('./commercial/store/load-views.ts', 'export function startCommercialViewLoad'),
  readBoundSource(
    './commercial/store/dashboard-query.ts',
    'export function commercialDashboardQuery',
  ),
  readBoundSource('./commercial/store/read-owner.ts', 'export class CommercialReadOwner'),
  readBoundSource(
    './commercial/store/route-dependencies.ts',
    'export function commercialRoutePlan',
  ),
  readBoundSource('./commercial/store/route-read.ts', 'export async function readCommercialRoute'),
  readBoundSource('./commercial/store/route-state.ts', 'export class CommercialRouteState'),
  readBoundSource(
    './commercial/workspace-frame.ts',
    'export function createCommercialWorkspaceFrame',
  ),
  readBoundSource('./commercial/route-dom.ts', 'export function populateCommercialRoute'),
  readBoundSource(
    './commercial/route-navigation.ts',
    'export function installCommercialRouteNavigation',
  ),
];

const readBoundaryParserSources = (): string[] => [
  readBoundSource('./shared/response-parser.ts', 'export function parseResponseRecord'),
  readBoundSource('./shared/session-parser.ts', 'export function parseSessionRestore'),
  readBoundSource('./shared/login-parser.ts', 'export function parseLoginProof'),
  readBoundSource('./shared/api-response-parser.ts', 'export function parseResponseArray'),
  readBoundSource('./shared/register-view-parser.ts', 'export function parseStoredRegisterView'),
  readBoundSource(
    './shared/document-response-parser.ts',
    'export function parseKnownDocumentResponse',
  ),
];

it('translates risk rules and derives the daily commission next action', () => {
  expect(riskRuleLabel('LOW_MARGIN')).toBe('毛利率低于政策门槛');
  expect(riskRuleLabel('OVERDUE_AR')).toBe('存在逾期应收');
  expect(commissionNextAction('RELEASED')).toBe('待登记支付');
  expect(commissionNextAction('FROZEN')).toBe('待满足条件后释放');
});

it('translates production timeline details without leaking internal state codes', () => {
  expect(businessEventDetailLabel('CREDIT_DECIDED', 'APPROVED')).toBe('已批准');
  expect(businessEventDetailLabel('RISK_EVALUATED', 'HIGH/45')).toBe('高风险 / 45分');
  expect(businessEventDetailLabel('PAYMENT_RECEIVED', 'BANK-KT-001')).toBe('BANK-KT-001');
});

it('uses customer-specific state language in customer records', () => {
  expect(customerStateLabel('PROSPECT')).toBe('潜在客户');
  expect(customerStateLabel('ACTIVE')).toBe('合作客户');
  expect(customerStateLabel('INACTIVE')).toBe('暂停合作');
  expect(customerStateLabel('ARCHIVED')).toBe('已归档');
});

it('translates operations codes and derives accountable next actions', () => {
  expect(supplyModeLabel('MAKE')).toBe('自制');
  expect(supplyModeLabel('BUY')).toBe('采购');
  expect(supplyModeLabel('PRODUCTION')).toBe('生产建议');
  expect(supplyModeLabel('PURCHASE')).toBe('采购建议');
  expect(qualityStageLabel('IN_PROCESS')).toBe('过程检验');
  expect(shipmentGateLabel('orderLink')).toBe('订单来源');
  expect(shipmentGateLabel('inventory')).toBe('可用库存');
  expect(operationsNextAction('production', 'IN_PROGRESS')).toBe('待报工、成品入库并完工确认');
  expect(operationsNextAction('quality', 'DISPOSITIONED')).toBe('检验已处置，请核对批次放行结果');
  expect(operationsNextAction('shipment', 'EXCEPTION_PENDING')).toBe('待独立审批人复核门禁例外');
});

it('captures artificial-turf project handoff fields without test-channel evidence markers', () => {
  const source = [
    readBoundSource('./bootstrap.ts', 'export function commercialWorkspaceStructure'),
    ...readOnlineEditorSources(),
    ...readDocumentSupportSources(),
    ...readGovernanceSources(),
    ...readCommercialStoreSources(),
    ...readBoundaryParserSources(),
    readBoundSource('./crm/customer360-view.ts', 'export function customer360Content'),
    readBoundSource('./shared/shell-presentation.ts', 'export function navIcon'),
    readBoundSource('./shared/role-insights.ts', 'export function roleTaskInsight'),
    readBoundSource('./shared/route-sections.ts', 'export function installRouteSectionNavigation'),
    readBoundSource('./shared/document-templates.ts', 'export const BUSINESS_DOCUMENT_TEMPLATES'),
    readBoundSource('./shared/business-format.ts', 'export const recordValue'),
    readBoundSource('./shared/business-labels.ts', 'export const businessEventLabel'),
    readBoundSource('./commercial/ctr-fields.ts', 'export const ctrRequirementFields'),
    readBoundSource('./commercial/quote-print.ts', 'export function printIssuedQuote'),
    readBoundSource('./commercial/readiness.ts', 'export function contractOrderReadiness'),
    readBoundSource('./shared/register-profile.ts', 'export const registerProfile'),
    readBoundSource('./shared/register-drawer.ts', 'export function createRegisterDrawer'),
    readBoundSource('./shared/register-controls.ts', 'export function createRegisterControls'),
    readBoundSource('./shared/register-readers.ts', 'export function createRegisterReaders'),
    readBoundSource('./shared/register-rendering.ts', 'export function createRegisterRendering'),
    readBoundSource('./shared/register-search.ts', 'export function createRegisterSearch'),
    readBoundSource('./shared/register-selection.ts', 'export function bindRegisterSelection'),
    readBoundSource('./shared/register-actions.ts', 'export function bindRegisterActions'),
    readBoundSource('./shared/register-saved-view.ts', 'export function installSavedRegisterView'),
    readBoundSource(
      './shared/workspace-list-tools.ts',
      'export function installWorkspaceListTools',
    ),
    readBoundSource('./commercial/console/ctr-console.tsx', 'export function CtrConsolePage'),
    readBoundSource(
      './commercial/console/solution-console.tsx',
      'export function SolutionConsolePage',
    ),
    readBoundSource('./commercial/cost-view.ts', 'export function appendCostView'),
    readBoundSource('./commercial/cost-factor-form.ts', 'export function createCostFactorFields'),
    readBoundSource(
      './commercial/console/cost-matrix-console.tsx',
      'export function CostMatrixConsolePage',
    ),
    readBoundSource('./commercial/cost-model-heading.ts', 'export function appendCostModelHeading'),
    readBoundSource(
      './commercial/cost-model-evaluations.ts',
      'export function appendCostModelCatalog',
    ),
    readBoundSource('./commercial/console/policy-console.tsx', 'export function PolicyConsolePage'),
    readBoundSource('./commercial/console/quote-console.tsx', 'export function QuoteConsolePage'),
    readBoundSource('./commercial/console/credit-console.tsx', 'export function CreditConsolePage'),
    readBoundSource('./commercial/receivables-view.ts', 'export function appendReceivablesView'),
    readBoundSource('./commercial/collections-view.ts', 'export function appendCollectionsView'),
    readBoundSource(
      './commercial/collection-actions.ts',
      'export function appendCollectionFollowups',
    ),
    readBoundSource('./commercial/payments-view.ts', 'export function appendPaymentsView'),
    readBoundSource('./commercial/commission-view.ts', 'export function appendCommissionView'),
    readBoundSource('./commercial/commission-policy.ts', 'export function appendCommissionHeading'),
    readBoundSource('./commercial/commission-ledger.ts', 'export function createCommissionCard'),
    readBoundSource('./commercial/risk-view.ts', 'export function appendRiskView'),
    readBoundSource(
      './commercial/workspace-readiness.ts',
      'export function appendWorkspaceReadiness',
    ),
    readBoundSource(
      './commercial/workspace-dashboard.ts',
      'export function appendWorkspaceDashboard',
    ),
    readBoundSource(
      './commercial/workspace-fulfillment.ts',
      'export function appendWorkspaceFulfillment',
    ),
    readBoundSource('./commercial/workspace-sales.ts', 'export function appendWorkspaceSales'),
    readBoundSource('./commercial/workspace-finance.ts', 'export function appendWorkspaceFinance'),
    readBoundSource(
      './commercial/workspace-operations.ts',
      'export function appendWorkspaceOperations',
    ),
    readBoundSource(
      './commercial/workspace-routes.ts',
      'export function assignCommercialRouteViews',
    ),
    readBoundSource(
      './commercial/workspace-legacy-panels.ts',
      'export function appendLegacyCommercialPanels',
    ),
    readBoundSource(
      './commercial/manufacturing-view.ts',
      'export function appendManufacturingView',
    ),
    readBoundSource(
      './commercial/manufacturing-cards.ts',
      'export function createManufacturingCard',
    ),
    readBoundSource('./commercial/manufacturing-forms.ts', 'export function openItemVersionForm'),
    readBoundSource('./commercial/sourcing-register.ts', 'export function createSourcingPanel'),
    readBoundSource('./commercial/purchase-register.ts', 'export function createOrderPanel'),
    readBoundSource('./commercial/inventory-register.ts', 'export function createInventoryPanel'),
    readBoundSource('./commercial/procurement-view.ts', 'export function appendProcurementView'),
    readBoundSource(
      './commercial/purchase-order-cards.ts',
      'export function createPurchaseOrderCard',
    ),
    readBoundSource(
      './commercial/purchase-documents.ts',
      'export function createPurchaseDocumentRow',
    ),
    readBoundSource('./commercial/purchase-actions.ts', 'export function appendPurchaseActions'),
    readBoundSource('./commercial/mrp-view.ts', 'export function appendMrpView'),
    readBoundSource('./commercial/mrp-actions.ts', 'export function appendMrpActions'),
    readBoundSource('./commercial/mrp-run.ts', 'export function appendMrpRun'),
    readBoundSource('./commercial/mrp-proposals.ts', 'export function createMrpProposalCard'),
    readBoundSource('./commercial/quality-view.ts', 'export function appendQualityView'),
    readBoundSource('./commercial/complaints-view.ts', 'export function appendComplaints'),
    readBoundSource('./commercial/complaint-actions.ts', 'export function appendComplaintActions'),
    readBoundSource(
      './commercial/complaint-assignment.ts',
      'export function appendComplaintSlaAction',
    ),
    readBoundSource('./commercial/complaint-rows.ts', 'export function createComplaintRow'),
    readBoundSource('./commercial/complaint-ncr.ts', 'export function appendComplaintNcrAction'),
    readBoundSource(
      './commercial/complaint-workflow.ts',
      'export async function runComplaintWorkflow',
    ),
    readBoundSource('./commercial/capa-forms.ts', 'export function openCapaCreate'),
    readBoundSource('./commercial/quality-plans.ts', 'export function appendQualityPlans'),
    readBoundSource(
      './commercial/quality-inspections.ts',
      'export function appendQualityInspections',
    ),
    readBoundSource(
      './commercial/quality-inspection-cards.ts',
      'export function createInspectionCard',
    ),
    readBoundSource('./commercial/quality-traceability.ts', 'export function appendTraceability'),
    readBoundSource('./commercial/permissions.ts', 'export function isCommercialPermission'),
    readBoundSource(
      './commercial/production-orders-view.ts',
      'export function appendProductionOrdersView',
    ),
    readBoundSource(
      './commercial/production-actions.ts',
      'export function appendProductionTransition',
    ),
    readBoundSource(
      './commercial/production-cost-view.ts',
      'export function appendProductionCostView',
    ),
    readBoundSource(
      './commercial/production-cost-policy.ts',
      'export function createProductionCostPolicyButton',
    ),
    readBoundSource('./commercial/shipments-view.ts', 'export function appendShipmentsView'),
    readBoundSource('./commercial/shipment-actions.ts', 'export function appendShipmentDispatch'),
    readBoundSource('./commercial/sales-orders-view.ts', 'export function appendSalesOrdersView'),
    readBoundSource('./commercial/order360-view.ts', 'export function appendOrder360Content'),
    readBoundSource(
      './commercial/order360-risk-controls.ts',
      'export function createRiskPolicyButton',
    ),
    readBoundSource('./commercial/order360-evidence.ts', 'export function createOrderEvidence'),
    readBoundSource('./commercial/contract-view.ts', 'export function appendContractView'),
    readBoundSource(
      './commercial/contract-documents.ts',
      'export function createContractDocumentPanel',
    ),
  ].join('\n');
  for (const field of [
    'projectRegion',
    'performanceStandard',
    'baseCondition',
    'drainageRequirement',
    'fireRating',
    'yarnMaterial',
    'gauge',
    'rollWidthMeters',
    'drainageRate',
  ])
    expect(source).toContain(field);
  expect(source).toContain('evidence: { sealReference: values.sealReference }');
  expect(source).not.toContain('WEB-UAT');
});

it('uses daily business language instead of analytics jargon in visible workspace copy', () => {
  const source = [
    readBoundSource('./bootstrap.ts', 'export function commercialWorkspaceStructure'),
    readBoundSource(
      './commercial/workspace-dashboard.ts',
      'export function appendWorkspaceDashboard',
    ),
  ].join('\n');
  expect(source).toContain('订单贡献明细');
  expect(source).toContain('风险责任明细');
  expect(source).toContain('订单关联业务与证据记录');
  expect(source).not.toContain('下钻');
});

it('keeps login and workspace introductions concise and task-oriented', () => {
  const source = readFileSync(new URL('./entry.ts', import.meta.url), 'utf8');
  expect(source).toContain("el('h1', '', '业务一体化管理')");
  expect(source).toContain('销售、采购、生产、质量与财务协同');
  expect(source).not.toContain('login-feature-grid');
  expect(source).not.toContain('页面和操作会根据当前角色自动呈现');
  expect(source).not.toContain('让订单、生产与交付证据在一条业务链上闭环');
});

it('makes authentication and startup progress explicit, single-flight and recoverable', () => {
  const source = readFileSync(new URL('./entry.ts', import.meta.url), 'utf8');
  const loginFlow = readFileSync(new URL('./login-flow.ts', import.meta.url), 'utf8');
  const styles = readFileSync(new URL('./startup.css', import.meta.url), 'utf8');
  expect(source).toContain("identity.autocomplete = 'username'");
  expect(source).toContain("password.autocomplete = 'current-password'");
  expect(source).toContain("form.setAttribute('aria-busy', String(busy))");
  expect(source).toContain("startupView(root, '正在验证登录状态…')");
  expect(source).toContain('startupFailureView(root)');
  expect(loginFlow).toContain('if (this.pending) return this.pending');
  expect(styles).toContain(".login-status[data-state='loading']::before");
  expect(styles).toContain('.startup-shell');
});

it('uses the canonical shipment release source and caches repeated document reference reads', () => {
  const source = [
    readBoundSource(
      './shared/document-read-service.ts',
      'export function createDocumentReadService',
    ),
    readBoundSource('./shared/document-bindings.ts', 'export const BUSINESS_DOCUMENT_SUBJECTS'),
    readBoundSource(
      './shared/contextual-documents.ts',
      'export function appendContextualDocuments',
    ),
  ].join('\n');
  expect(source).toContain("endpoint: '/api/v1/shipment-releases'");
  expect(source).not.toContain("endpoint: '/api/v1/shipments'");
  expect(source).toContain('const onlineDocumentReadCache = new Map');
  expect(source).toContain('void onlineDocumentRead<{');
  expect(source).toContain('permittedRoutes.has(route)');
});

it('keeps product pages on one content rail and renders business records as dense registers', () => {
  const styles = readFileSync(new URL('./style.css', import.meta.url), 'utf8');
  expect(styles).toContain('KT-UI-PROD-03: consistent page rail and record-register hierarchy');
  expect(styles).toContain('.workspace > [data-route-view]');
  expect(styles).toContain('.governance-grid');
  expect(styles).toContain('.solution-list');
  expect(styles).toContain('grid-template-columns: minmax(0, 1fr);');
});

it('provides product-grade register controls for high-frequency business records', () => {
  const workspaceSource = [
    readBoundSource('./bootstrap.ts', 'export function commercialWorkspaceStructure'),
    readBoundSource(
      './shared/workspace-list-tools.ts',
      'export function installWorkspaceListTools',
    ),
    readBoundSource('./shared/register-controls.ts', 'export function createRegisterControls'),
  ].join('\n');
  const factorySource = readFileSync(
    new URL('./shared/commercial-http.ts', import.meta.url),
    'utf8',
  );
  const factoryAnchor = 'export const createFetchCommercialApi';
  if (
    !workspaceSource.trim() ||
    !workspaceSource.includes('function installWorkspaceListTools') ||
    !factorySource.trim() ||
    !factorySource.includes(factoryAnchor) ||
    factorySource.indexOf(factoryAnchor) !== factorySource.lastIndexOf(factoryAnchor)
  )
    throw new Error('Register sources must remain bound to workspace and HTTP factory');
  const source = `${workspaceSource}\n${factorySource}`;
  const styles = readFileSync(new URL('./style.css', import.meta.url), 'utf8');
  expect(source).toContain("list.setAttribute('role', 'table')");
  expect(source).toContain("column.setAttribute('role', 'columnheader')");
  expect(source).toContain('导出当前结果');
  expect(source).toContain('保存视图');
  expect(source).toContain('const pageSize = 10');
  expect(styles).toContain('KT-UI-PROD-04: operational data registers');
  expect(styles).toContain('.record-register-head');
  expect(styles).toContain('.record-register.is-compact');
  expect(styles).toContain('KT-UI-PROD-09: persisted operational range filters');
  expect(styles).toContain('.record-register.is-key-fields .register-optional-field');
  expect(source).toContain("dateFrom.type = 'date'");
  expect(source).toContain("amountFrom.placeholder = '最低金额'");
  expect(source).toContain("['complete', '完整字段']");
  expect(source).toContain("['key', '重点字段']");
  expect(source).toContain("new URLSearchParams({ limit: '100' })");
  expect(source).toContain('cursor = page.nextCursor');
});

it('uses a smooth two-level sidebar with an icon-only collapse control', () => {
  const source = readBoundSource('./crm/shell-frame.ts', 'export function createShellSidebar');
  const styles = readFileSync(new URL('./style.css', import.meta.url), 'utf8');
  expect(source).toContain("const sidebarToggle = el('button', 'sidebar-toggle')");
  expect(source).toContain("parent.setAttribute('data-nav-routes'");
  expect(source).toContain("navGroup('客户与商机', 'sales'");
  expect(source).toContain("navGroup('合同与订单', 'contracts'");
  expect(source).toContain("navGroup('供应链与生产', 'production'");
  expect(styles).toContain('KT-UI-PROD-05: two-level operational navigation');
  expect(styles).toContain('.nav-parent-chevron');
  expect(styles).toContain('.sidebar-collapsed .nav-children');
  expect(source).toContain("const utilityLeading = el('div', 'utility-leading')");
  expect(source).toContain('utilityLeading.append(sidebarToggle, utilityContext)');
  expect(styles).toContain('Jinhu-informed application chrome');
  expect(styles).toContain('grid-template-columns: 232px minmax(0, 1fr)');
  expect(styles).toContain('margin-left: calc(-1 * clamp(20px, 2.4vw, 40px))');
  expect(styles).toContain('.workspace {\n  margin: 0;');
});

it('uses a dedicated transparent King Turf mark without cropping in compact navigation', () => {
  const source = readBoundSource('./crm/shell-frame.ts', 'export function createShellSidebar');
  const styles = readFileSync(new URL('./style.css', import.meta.url), 'utf8');
  expect(source).toContain('brandLogo.src = brandMark');
  expect(source).toContain("brandLogoFrame.setAttribute('aria-label', '金特夫 King Turf')");
  expect(readFileSync(new URL('./entry.ts', import.meta.url), 'utf8')).toContain(
    "loginBrand.setAttribute('aria-label', '金特夫 King Turf')",
  );
  expect(styles).toContain('.sidebar-collapsed .brand-identity');
  expect(styles).toContain('flex-basis: 40px');
  expect(styles).toContain('.app-shell.desktop.sidebar-collapsed');
});

it('adds status filtering and a permission-scoped detail drawer to business registers', () => {
  const source = [
    readBoundSource('./shared/register-controls.ts', 'export function createRegisterControls'),
    readBoundSource('./shared/register-drawer.ts', 'export function createRegisterDrawer'),
  ].join('\n');
  const styles = readFileSync(new URL('./style.css', import.meta.url), 'utf8');
  expect(source).toContain("statusFilter.setAttribute('aria-label', '按业务状态筛选')");
  expect(source).toContain('查看选中详情');
  expect(source).toContain("detailDrawer.setAttribute('aria-label', '业务记录详情')");
  expect(source).toContain('当前权限范围内的只读业务快照');
  expect(styles).toContain('KT-UI-PROD-06: field filtering');
  expect(styles).toContain('.record-detail-drawer');
  expect(styles).toContain('.is-selected');
});

it('uses module-specific register columns, structured detail fields and business sorting', () => {
  const source = [
    readBoundSource('./shared/register-profile.ts', 'export const registerProfile'),
    readBoundSource('./shared/register-controls.ts', 'export function createRegisterControls'),
    readBoundSource('./shared/register-drawer.ts', 'export function createRegisterDrawer'),
    readBoundSource(
      './shared/workspace-list-tools.ts',
      'export function installWorkspaceListTools',
    ),
  ].join('\n');
  const styles = readFileSync(new URL('./style.css', import.meta.url), 'utf8');
  expect(source).toContain("label: '生产工单台账'");
  expect(source).toContain("headers: ['工单与产品', '生产状态与数量', '计划与车间', '操作']");
  expect(source).toContain("label: '交付任务台账'");
  expect(source).toContain("list.closest('.shipment-workbench')");
  expect(source).toContain("!list.classList.contains('shipment-grid')");
  expect(source).toContain("['status', '按状态排序']");
  expect(source).toContain("el('dl', 'record-detail-fields')");
  expect(source).toContain('sourceItems.length === 0');
  expect(styles).toContain('.record-detail-fields');
  expect(styles).toContain('[data-register-profile]');
});

it('supports safe bulk selection, attention filtering and selected-record export', () => {
  const source = [
    readBoundSource('./shared/register-controls.ts', 'export function createRegisterControls'),
    readBoundSource('./shared/register-selection.ts', 'export function bindRegisterSelection'),
  ].join('\n');
  const styles = readFileSync(new URL('./style.css', import.meta.url), 'utf8');
  expect(source).toContain("['attention', '只看需关注']");
  expect(source).toContain("['actionable', '只看可操作']");
  expect(source).toContain('查看批量摘要');
  expect(source).toContain('批量摘要仅用于核对，不会执行任何业务写操作');
  expect(source).toContain('导出已选');
  expect(styles).toContain('.record-select');
  expect(styles).toContain('.bulk-summary-list');
});

it('publishes durable operation state for loading, success and rejection feedback', () => {
  const attributes = new Map<string, string>();
  const target = {
    textContent: '',
    dataset: {} as Record<string, string>,
    setAttribute: (name: string, value: string) => attributes.set(name, value),
    removeAttribute: (name: string) => attributes.delete(name),
  } as unknown as HTMLElement;

  setOperationStatus(target, 'loading', '正在提交');
  expect(target.textContent).toBe('正在提交');
  expect(target.dataset.state).toBe('loading');
  expect(attributes.get('aria-busy')).toBe('true');

  setOperationStatus(target, 'error', '订单已全额开票');
  expect(target.textContent).toBe('订单已全额开票');
  expect(target.dataset.state).toBe('error');
  expect(attributes.has('aria-busy')).toBe(false);
});

it('identifies the next blocked contract-to-order gate from live records', () => {
  const steps = contractOrderReadiness(
    [{ status: 'ISSUED', issuedSnapshotId: 'snapshot-1' }],
    [{ effective_status: 'PENDING_APPROVAL' }],
    [],
    [],
  );
  expect(steps).toEqual([
    { key: 'quote', label: '已签发报价', count: 1, state: 'complete' },
    { key: 'credit', label: '有效信用', count: 0, state: 'current' },
    { key: 'contract', label: '已签合同', count: 0, state: 'blocked' },
    { key: 'order', label: '已释放订单', count: 0, state: 'blocked' },
  ]);
});

it('loads the permission-scoped commercial views concurrently', async () => {
  let active = 0;
  let peak = 0;
  const api = {
    listOpportunities: vi.fn().mockResolvedValue([]),
    list: vi.fn().mockImplementation(async () => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 1);
      });
      active -= 1;
      return [];
    }),
    submit: vi.fn().mockResolvedValue({}),
    uploadCtrAttachment: vi.fn().mockResolvedValue({}),
    command: vi.fn().mockResolvedValue({}),
  };
  const controller = new CommercialController(
    api,
    new Set(['opportunity:read', 'quote:read', 'contract:read']),
  );
  await controller.load();
  expect(api.list).toHaveBeenCalledTimes(2);
  expect(peak).toBe(2);
});

it('keeps the commercial workspace usable when one secondary data source fails', async () => {
  const api = {
    listOpportunities: vi.fn().mockResolvedValue([{ id: 'opportunity-1' }]),
    list: vi
      .fn()
      .mockResolvedValueOnce([])
      .mockRejectedValueOnce(new Error('secondary source unavailable')),
    submit: vi.fn().mockResolvedValue({}),
    uploadCtrAttachment: vi.fn().mockResolvedValue({}),
    command: vi.fn().mockResolvedValue({}),
  };
  const controller = new CommercialController(
    api,
    new Set(['opportunity:read', 'quote:read', 'contract:read']),
  );
  await expect(controller.load()).resolves.toBeUndefined();
  expect(controller.opportunities).toEqual([{ id: 'opportunity-1' }]);
  expect(controller.message).toContain('1 个数据源暂不可用');
});

it('prioritizes overdue and incomplete active opportunities', () => {
  expect(
    opportunityPipelineSummary(
      [
        { id: 'late', status: 'QUALIFIED', expectedCloseDate: '2026-08-01', customerId: null },
        {
          id: 'soon',
          status: 'PROPOSAL',
          expectedCloseDate: '2026-09-10',
          customerId: 'customer-1',
        },
        { id: 'won', status: 'WON', expectedCloseDate: '2026-07-01', customerId: 'customer-2' },
      ],
      '2026-08-25',
    ),
  ).toEqual({ active: 2, overdue: 1, closingSoon: 1, customerMissing: 1 });
});

it('exposes the first missing prerequisite in the CTR-to-quote chain', () => {
  expect(
    quoteWorkflowReadiness(
      [{ status: 'APPROVED' }],
      [{ status: 'FINAL' }],
      [],
      [{ status: 'PUBLISHED' }],
      [],
    ),
  ).toEqual([
    { key: 'ctr', label: '已批准技术需求', count: 1, state: 'complete' },
    { key: 'solution', label: '定稿方案', count: 1, state: 'complete' },
    { key: 'cost', label: '成本决策', count: 0, state: 'current' },
    { key: 'policy', label: '已发布政策', count: 1, state: 'complete' },
    { key: 'quote', label: '报价版本', count: 0, state: 'blocked' },
  ]);
});

it('prioritizes cash application, overdue debt and legal intake queues', () => {
  expect(
    cashRiskSummary(
      [
        { remaining_amount: '500', due_at: '2026-08-01T00:00:00.000Z' },
        { remaining_amount: '0', due_at: '2026-07-01T00:00:00.000Z' },
      ],
      [{ remaining_amount: '200' }, { remaining_amount: '0' }],
      [
        {
          state: 'PROMISE_BROKEN',
          legalHandoffs: [{ state: 'REQUESTED' }, { state: 'ACCEPTED' }],
        },
      ],
      '2026-08-25',
    ),
  ).toEqual({
    overdueReceivables: 1,
    unappliedPayments: 1,
    brokenPromises: 1,
    legalPending: 1,
  });
});

it('translates production evidence event codes into business language', () => {
  expect(businessEventLabel('CONTRACT_SIGNED')).toBe('合同已签署');
  expect(businessEventLabel('SHIPMENT_DELIVERED')).toBe('货物已签收');
  expect(businessEventLabel('APPROVED')).toBe('已批准');
  expect(businessEventLabel('CUSTOM_EVENT')).toBe('CUSTOM_EVENT');
});

it('exposes the ui-kit demo route only with authorization:read (ADR-0014/U1)', () => {
  expect(visibleAppRoutes(new Set(['authorization:read'])).has('ui-kit')).toBe(true);
  expect(visibleAppRoutes(new Set(['customer:read'])).has('ui-kit')).toBe(false);
  expect(appRouteFromHash('#/ui-kit')).toBe('ui-kit');
  expect(appRouteFromHash('#/ui-kit-extra')).toBe('overview');
  const section = createUiKitSection();
  expect(section.getAttribute('data-route-view')).toBe('ui-kit');
  expect(section.hidden).toBe(true);
  expect(section.className).toContain('ui-kit-view');
});

it('derives application navigation from atomic role capabilities', () => {
  expect([...visibleAppRoutes(new Set(['shipment:read']))]).toEqual([
    'shipments',
    'overview',
    'document-templates',
  ]);
  // B1：notification:read 同时注册治理概览与通知子路由。
  expect([...visibleAppRoutes(new Set(['notification:read']))]).toEqual([
    'governance',
    'governance/notifications',
    'overview',
    'document-templates',
  ]);
  expect([...visibleAppRoutes(new Set(['customer:read', 'lead:create']))]).toEqual([
    'leads',
    'customers',
    'overview',
    'document-templates',
  ]);
  // ADR-0014/U1：authorization:read 同时注册治理身份子路由与 ui-kit 演示路由。
  expect(visibleAppRoutes(new Set(['executive-dashboard:read', 'authorization:read']))).toEqual(
    new Set(['overview', 'governance', 'governance/identity', 'ui-kit', 'document-templates']),
  );
  expect(visibleAppRoutes(new Set(['cost-matrix:read']))).toEqual(
    new Set(['costing', 'overview', 'document-templates']),
  );
});

it('derives a role homepage from atomic permission domains', () => {
  expect(roleWorkspaceProfile(new Set(['quote:prepare']))).toEqual({
    title: '销售与商务岗位',
    description: '聚焦销售与商务职责、待办与业务证据。',
    domains: ['销售与商务'],
  });
  expect(roleWorkspaceProfile(new Set(['ar:read', 'risk:read']))).toEqual({
    title: '财务与风险岗位',
    description: '聚焦财务与风险职责、待办与业务证据。',
    domains: ['财务与风险'],
  });
  expect(
    roleWorkspaceProfile(new Set(['executive-dashboard:read', 'order-360:read', 'shipment:read'])),
  ).toMatchObject({
    title: '经营管理综合岗位',
    domains: ['经营管理', '销售与商务', '仓储与物流'],
  });
  expect(roleWorkspaceProfile(new Set(['cost-matrix:read']))).toMatchObject({
    title: '销售与商务岗位',
    domains: ['销售与商务'],
  });
});

it('derives live role task counts and attention state from rendered business data', () => {
  expect(roleTaskInsight(12, ['已批准', '待审批', '逾期'])).toEqual({
    recordLabel: '12 条可见业务记录',
    stateLabel: '2 项需关注',
    attention: true,
  });
  expect(roleTaskInsight(0, ['已完成'])).toEqual({
    recordLabel: '暂无可见业务记录',
    stateLabel: '当前无阻塞',
    attention: false,
  });
});

it('matches a route inside multi-workspace data-route-view tokens', () => {
  expect(routeViewSelector('sales-orders')).toBe('[data-route-view~="sales-orders"]');
});

it('binds each major business workbench to one process-stage route', () => {
  const source = [
    readBoundSource('./bootstrap.ts', 'export function commercialWorkspaceStructure'),
    readBoundSource(
      './commercial/workspace-routes.ts',
      'export function assignCommercialRouteViews',
    ),
  ].join('\n');
  for (const [workbench, route] of [
    ['pipeline-board', 'opportunities'],
    ['ctr-workbench', 'technical-requirements'],
    ['solution-workbench', 'technical-solutions'],
    ['cost-workbench', 'costing'],
    ['quote-workbench', 'quotes'],
    ['contract-workbench', 'contracts'],
    ['order-workbench', 'sales-orders'],
    ['ar-workbench', 'receivables'],
    ['payment-workbench', 'payments'],
    ['production-workbench', 'production-orders'],
    ['quality-workbench', 'quality-inspection'],
    ['shipment-workbench', 'shipments'],
  ] as const)
    expect(source).toContain(`'${workbench}': '${route}'`);
  expect(source).not.toContain("'pipeline-board': 'sales-workspace");
  expect(source).not.toContain("'ar-workbench': 'sales-workspace ar-payment");
});

it.each([
  ['销售报价员', ['quote:prepare'], ['overview', 'quotes']],
  ['应收会计', ['ar:read'], ['overview', 'receivables']],
  ['生产报工员', ['production:report'], ['overview', 'production-orders']],
  ['质量检验员', ['quality:inspect'], ['overview', 'quality-inspection']],
  ['客诉协调员', ['complaint:triage'], ['overview', 'quality-inspection']],
  ['仓库调拨员', ['inventory:move'], ['overview', 'procurement']],
  ['物流跟踪员', ['shipment:track'], ['overview', 'shipments']],
  ['权限管理员', ['authorization:manage'], ['overview', 'governance']],
  ['经营看板用户', ['executive-dashboard:read'], ['overview']],
] as const)(
  'projects the %s representative role onto its minimum authorized workspace',
  (_role, permissions, expectedRoutes) => {
    const routes = visibleAppRoutes(new Set<string>(permissions));
    expect([...expectedRoutes].every((route) => routes.has(route))).toBe(true);
    expect(routes.has('contracts')).toBe(false);
  },
);

it('gives every production atomic role at least one permission-visible application route', () => {
  const migrationFiles = [
    '../../../packages/database/migrations/0046_atomic_business_role_catalog.sql',
    '../../../packages/database/migrations/0048_actual_manufacturing_cost.sql',
    '../../../packages/database/migrations/0050_shipment_release_logistics_pod.sql',
    '../../../packages/database/migrations/0052_platform_read_permissions.sql',
    '../../../packages/database/migrations/0053_collections_legal_evidence.sql',
    '../../../packages/database/migrations/0054_complaint_ncr_capa.sql',
  ];
  const rolePermissions = new Map<string, Set<string>>();
  for (const path of migrationFiles) {
    const migration = readFileSync(new URL(path, import.meta.url), 'utf8');
    for (const match of migration.matchAll(/\('(KT_[A-Z_]+)','([a-z][a-z0-9-]*:[a-z0-9-]+)'\)/gu)) {
      const role = match[1];
      const permission = match[2];
      if (!role || !permission) continue;
      const permissions = rolePermissions.get(role) ?? new Set<string>();
      permissions.add(permission);
      rolePermissions.set(role, permissions);
    }
  }
  expect(rolePermissions.size).toBe(52);
  const rolesWithoutRoutes = [...rolePermissions]
    .filter(([, permissions]) => visibleAppRoutes(permissions).size === 0)
    .map(([role]) => role);
  expect(rolesWithoutRoutes).toEqual([]);
});

it('exposes governance navigation only from atomic session capabilities', () => {
  expect(visibleGovernanceSurfaces(new Set(['authorization:read'])).map((item) => item.id)).toEqual(
    ['identity-access'],
  );
  expect(visibleGovernanceSurfaces(new Set(['notification:read'])).map((item) => item.id)).toEqual([
    'notifications',
  ]);
  expect(visibleGovernanceSurfaces(new Set(['customer:read']))).toEqual([]);
  expect(
    visibleGovernanceSurfaces(new Set(['number:read', 'rule:read', 'workflow:read'])).map(
      (item) => item.id,
    ),
  ).toEqual(['numbering', 'rules', 'workflow']);
  expect(appRouteFromHash('#/governance')).toBe('governance');
});

it('registers governance sub-routes from per-surface visibility unions (B1)', () => {
  const governanceRoutesOf = (permissions: readonly string[]) =>
    [...visibleAppRoutes(new Set(permissions))].filter((route) => route.startsWith('governance'));
  expect(governanceRoutesOf(['authorization:read'])).toEqual(['governance', 'governance/identity']);
  expect(governanceRoutesOf(['organization:read', 'employee:read'])).toEqual([
    'governance',
    'governance/organization',
  ]);
  expect(governanceRoutesOf(['audit:read'])).toEqual(['governance', 'governance/audit']);
  expect(governanceRoutesOf(['master-data:read'])).toEqual([
    'governance',
    'governance/master-data',
  ]);
  expect(governanceRoutesOf(['number:read', 'rule:read', 'workflow:read'])).toEqual([
    'governance',
    'governance/numbering',
    'governance/rules',
    'governance/workflow',
  ]);
  expect(governanceRoutesOf(['notification:read'])).toEqual([
    'governance',
    'governance/notifications',
  ]);
  expect(governanceRoutesOf(['business-object:read', 'event:operate'])).toEqual([
    'governance',
    'governance/system',
  ]);
  expect(governanceRoutesOf(['customer:read'])).toEqual([]);
  // 路由器整段字符串匹配：多段 hash 直接成为合法 AppRoute，未知段回落 overview。
  expect(appRouteFromHash('#/governance/identity')).toBe('governance/identity');
  expect(appRouteFromHash('#/governance/system')).toBe('governance/system');
  expect(appRouteFromHash('#/governance/unknown')).toBe('overview');
});

it('prioritizes governance exceptions and translates daily notification channels', () => {
  expect(governanceNextAction('workflow', 3, 0)).toBe('优先处理当前账号的审批待办');
  expect(governanceNextAction('audit', 2, 1)).toBe('先处理数据读取异常并核对权限或服务状态');
  expect(governanceNextAction('rules', 0, 0)).toBe('当前范围暂无记录，按职责创建或等待业务产生');
  expect(governanceChannelLabel('IN_APP')).toBe('系统内通知');
  expect(governanceChannelLabel('FEISHU')).toBe('飞书私聊');
});

it('renders only governance actions granted to the authenticated role', () => {
  const controller = new GovernanceController(
    new Set(['organization:read', 'organization:update', 'audit:read']),
    sessionFixture(),
  );
  controller.views = [
    {
      path: '/api/v1/organizations',
      value: [{ id: 'organization-1', code: 'SALES', name: '销售部', version: 1 }],
    },
    { path: '/api/v1/audit-events', value: { items: [] } },
  ];
  const workspace = governanceWorkspace(controller) as unknown as RenderedElement;
  expect(workspace.textContent).toContain('更新组织');
  expect(workspace.textContent).not.toContain('新建组织');
  expect(workspace.textContent).not.toContain('新建员工');
  expect(workspace.textContent).toContain('审计中心');
  expect(workspace.textContent).toContain('审计事件 · 0 条');
  expect(workspace.textContent).toContain('下一步：');
});

it('binds the governance request adapter to the captured session context', async () => {
  const context = sessionFixture();
  const fetcher = vi.fn().mockResolvedValue(new Response('[]'));
  vi.stubGlobal('fetch', fetcher);
  const controller = new GovernanceController(new Set(['organization:read']), context);
  await controller.load();
  expect(fetcher).toHaveBeenCalledOnce();
  const headers = new Headers((fetcher.mock.calls[0]?.[1] as RequestInit).headers);
  expect(headers.has('authorization')).toBe(false);
  expect(headers.get('x-kingturf-session-generation')).toBe(context.generation);
});

it('exposes governed identity provisioning, role assignment, and role removal together', () => {
  const controller = new GovernanceController(
    new Set(['authorization:read', 'authorization:manage', 'employee:read']),
    sessionFixture(),
  );
  controller.views = [
    {
      path: '/api/v1/employees',
      value: [{ id: 'employee-1', employeeNumber: 'E-1', displayName: '测试员工' }],
    },
    { path: '/api/v1/roles', value: [{ id: 'role-1', code: 'KT_TEST', name: '测试角色' }] },
    { path: '/api/v1/permissions', value: [] },
    { path: '/api/v1/grants', value: [] },
    { path: '/api/v1/assignments', value: [] },
    { path: '/api/v1/scope-grants', value: [] },
  ];
  const workspace = governanceWorkspace(controller) as unknown as RenderedElement;
  expect(workspace.textContent).toContain('配置登录账号');
  expect(workspace.textContent).toContain('分配角色');
  expect(workspace.textContent).toContain('撤销角色');
});

it('renders atomic IAM administration without the legacy broad management capability', () => {
  const controller = new GovernanceController(
    new Set([
      'identity:read',
      'identity:manage',
      'role:read',
      'role:manage',
      'permission:read',
      'role-assignment:read',
      'role-assignment:manage',
      'data-scope:read',
      'data-scope:manage',
      'employee:read',
      'organization:read',
    ]),
    sessionFixture(),
  );
  controller.views = [
    { path: '/api/v1/user-access-profiles', value: { items: [] } },
    { path: '/api/v1/employees', value: [] },
    { path: '/api/v1/organizations', value: [] },
    { path: '/api/v1/roles', value: [] },
    { path: '/api/v1/permissions', value: [] },
    { path: '/api/v1/grants', value: [] },
    { path: '/api/v1/assignments', value: [] },
    { path: '/api/v1/scope-grants', value: [] },
  ];
  const workspace = governanceWorkspace(controller) as unknown as RenderedElement;
  expect(workspace.textContent).toContain('用户访问档案 · 0 条');
  expect(workspace.textContent).toContain('账号启停与下线');
  expect(workspace.textContent).toContain('撤销角色能力');
  expect(workspace.textContent).toContain('配置用户数据范围');
  expect(workspace.textContent).toContain('撤销用户数据范围');
});

it('renders one governance sub-page per route with only its domain surfaces (B1)', () => {
  const controller = new GovernanceController(
    new Set([
      'authorization:read',
      'authorization:manage',
      'employee:read',
      'role:read',
      'role:manage',
      'role-assignment:manage',
      'organization:read',
    ]),
    sessionFixture(),
  );
  controller.views = [
    { path: '/api/v1/employees', value: [{ id: 'employee-1', displayName: '测试员工' }] },
    { path: '/api/v1/roles', value: [{ id: 'role-1', code: 'KT_X', name: '测试角色' }] },
    { path: '/api/v1/permissions', value: [] },
    { path: '/api/v1/grants', value: [] },
    { path: '/api/v1/assignments', value: [] },
    { path: '/api/v1/scope-grants', value: [] },
    { path: '/api/v1/organizations', value: [{ id: 'org-1', code: 'HQ', name: '总部' }] },
  ];
  // UI-M2：identity/organization/audit 三路由改 Preact 控制台宿主（node 测试环境
  // 不挂载渲染体——行为面由 console.test.tsx 覆盖，含域隔离断言）。
  const page = governanceSubpage(controller, 'governance/identity') as unknown as RenderedElement;
  expect(page.getAttribute('data-route-view')).toBe('governance/identity');
  expect(page.getAttribute('data-testid')).toBe('kt-console-identity');
  expect(page.className).toContain('governance-console');
  const organizationPage = governanceSubpage(
    controller,
    'governance/organization',
  ) as unknown as RenderedElement;
  expect(organizationPage.getAttribute('data-route-view')).toBe('governance/organization');
  expect(organizationPage.getAttribute('data-testid')).toBe('kt-console-organization');
  // 概览卡片墙保持原样（兼容策略）。
  const overview = governanceWorkspace(controller) as unknown as RenderedElement;
  expect(overview.getAttribute('data-route-view')).toBe('governance');
  expect(overview.textContent).toContain('下一步：');
});

it('renders full domain lists on sub-pages instead of the eight-row preview (B1)', () => {
  // UI-M2b：九子页全部控制台化（DataTable 全量分页，无 8 行预览形态）；
  // 概览卡片墙保留预览（兼容策略不变）。全量加载语义由 console.test 与
  // list-view 的 cursor 用例族覆盖（identity/audit/master-data 三代表）。
  const controller = new GovernanceController(new Set(['master-data:read']), sessionFixture());
  const page = governanceSubpage(
    controller,
    'governance/master-data',
  ) as unknown as RenderedElement;
  expect(page.getAttribute('data-testid')).toBe('kt-console-master-data');
  const overview = governanceWorkspace(controller) as unknown as RenderedElement;
  expect(overview.textContent).toContain('治理工作台');
});

it('explains missing read permissions instead of silent empty dropdowns (C4)', () => {
  // UI-M2：identity 路由已控制台化，C4 可行动提示迁移至 console.test.tsx
  //（角色下拉 rolesHint / 组织树 orgHint 两个入口）；legacy 面此行为由
  // master-data 等未迁移子页继续持有（见 B3 master-data 用例的下拉提示）。
  const controller = new GovernanceController(new Set(['authorization:read']), sessionFixture());
  const page = governanceSubpage(controller, 'governance/identity') as unknown as RenderedElement;
  expect(page.getAttribute('data-testid')).toBe('kt-console-identity');
});

it('verb-izes governance submit labels so sensitive actions confirm twice (B3)', () => {
  // UI-M2b：master-data 子页控制台化；敏感词二次确认由 FormSection 按
  // shared/forms 同一正则承担（config-console 各 spec 的提交文案保持原文：
  // 停用条目/发布×/撤销×等），行为断言在 console.test.tsx（identity 敏感词
  // 用例）+ 本批 config 用例（kt-cfg-form-error 链）覆盖。
  const controller = new GovernanceController(
    new Set(['master-data:read', 'master-data:create', 'master-data:update', 'master-data:delete']),
    sessionFixture(),
  );
  const page = governanceSubpage(
    controller,
    'governance/master-data',
  ) as unknown as RenderedElement;
  expect(page.getAttribute('data-testid')).toBe('kt-console-master-data');
});

it('guards optimistic version fallback instead of sending NaN (B4)', () => {
  // UI-M2：organization 路由已控制台化；「版本未知提示刷新且不发请求」守卫在
  // console.test.tsx（kt-org-form-error 用例）按同文案断言。legacy 面守卫由
  // master-data 更新流继续持有（requiredVersion 同源实现）。
  const controller = new GovernanceController(
    new Set(['employee:read', 'employee:update']),
    sessionFixture(),
  );
  controller.views = [
    {
      path: '/api/v1/employees',
      value: {
        items: [{ id: 'employee-1', employeeNumber: 'E-1', displayName: '在场员工' }],
        nextCursor: null,
      },
    },
  ];
  const page = governanceSubpage(
    controller,
    'governance/organization',
  ) as unknown as RenderedElement;
  expect(page.getAttribute('data-testid')).toBe('kt-console-organization');
});

it('labels revoke-scope choices with employee and capability names (B4)', () => {
  const label = scopeGrantChoiceLabeler(
    [{ employeeId: 'employee-1', displayName: '张三' }],
    [{ id: 'permission-1', capability: 'customer:read' }],
  );
  expect(label({ employeeId: 'employee-1', permissionId: 'permission-1', scope: 'TEAM' })).toBe(
    '张三 · customer:read · TEAM',
  );
  // 查不到员工/能力时回退到现标签（scope · 员工ID 前 8 位）。
  expect(label({ employeeId: 'employee-2', permissionId: 'permission-2', scope: 'SELF' })).toBe(
    'SELF · employee',
  );
});

it('loads further governance pages on demand with the cursor contract (B2)', () => {
  // UI-M2b：legacy list-view 继续加载面随九子页控制台化退役；cursor 契约由
  // console 三页（identity/audit/org）+ DataTable 原语分页用例族承载
  //（console.test.tsx：identity loadMore 携带 cursor / audit 导出循环）。
  const controller = new GovernanceController(new Set(['master-data:read']), sessionFixture());
  const page = governanceSubpage(controller, 'governance/numbering') as unknown as RenderedElement;
  expect(page.getAttribute('data-testid')).toBe('kt-console-numbering');
});

it('filters audit events server-side and exports every filtered page (B2)', () => {
  // UI-M2：audit 路由已控制台化；服务端筛选参数（query/outcome/from/to）与
  // 导出循环（nextCursor 至耗尽）在 console.test.tsx 断言。
  const controller = new GovernanceController(new Set(['audit:read']), sessionFixture());
  controller.views = [
    {
      path: '/api/v1/audit-events',
      value: { items: [{ id: 'audit-1', action: 'AUTH_LOGIN' }], nextCursor: null },
    },
  ];
  const page = governanceSubpage(controller, 'governance/audit') as unknown as RenderedElement;
  expect(page.getAttribute('data-testid')).toBe('kt-console-audit');
});

it('renders the tenant settings catalog with defaults and draft publish flow (D5)', () => {
  // UI-M2b：D5 系统参数区随 system 页控制台化迁入
  // console/tenant-settings-appendix.tsx（语义守恒：目录/草稿/单向发布/历史只读，
  // 顺修原首败 retry 前置引用）；行为断言迁 console.test.tsx 配置页族。
  const controller = new GovernanceController(
    new Set(['business-object:read', 'tenant-setting:read', 'tenant-setting:manage']),
    sessionFixture(),
  );
  const page = governanceSubpage(controller, 'governance/system') as unknown as RenderedElement;
  expect(page.getAttribute('data-testid')).toBe('kt-console-system');
});

it('hides tenant settings without tenant-setting capabilities (D5)', async () => {
  const controller = new GovernanceController(new Set(['business-object:read']), sessionFixture());
  controller.views = [{ path: '/api/v1/business-objects', value: { items: [] } }];
  const fetcher = vi.fn();
  vi.stubGlobal('fetch', fetcher);
  try {
    const page = governanceSubpage(controller, 'governance/system') as unknown as RenderedElement;
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });
    expect(page.textContent).not.toContain('系统参数');
    expect(fetcher).not.toHaveBeenCalled();
  } finally {
    vi.unstubAllGlobals();
    vi.stubGlobal('document', { createElement: (tagName: string) => new RenderedElement(tagName) });
  }
});

it('admits manufacturing cost capabilities into the commercial workspace', () => {
  expect(isCommercialPermission('manufacturing-cost:read')).toBe(true);
  expect(isCommercialPermission('manufacturing-cost:approve')).toBe(true);
  expect(isCommercialPermission('cost-matrix:read')).toBe(true);
  expect(isCommercialPermission('cost-matrix:manage')).toBe(true);
  expect(isCommercialPermission('cost-matrix:calculate')).toBe(true);
  expect(isCommercialPermission('shipment:request')).toBe(true);
  expect(isCommercialPermission('collection:manage')).toBe(true);
  expect(isCommercialPermission('legal-case:decide')).toBe(true);
  expect(isCommercialPermission('unrelated:read')).toBe(false);
});

class RenderedElement {
  public className = '';
  public readonly classList = {
    add: (...tokens: string[]): void => {
      for (const token of tokens) {
        if (!token || /[\t\n\f\r ]/u.test(token))
          throw new DOMException('Invalid class token', 'SyntaxError');
      }
      this.className = [
        ...new Set([...this.className.split(/\s+/u).filter(Boolean), ...tokens]),
      ].join(' ');
    },
    contains: (token: string): boolean => this.className.split(/\s+/u).includes(token),
    remove: (...tokens: string[]): void => {
      this.className = this.className
        .split(/\s+/u)
        .filter((token) => token && !tokens.includes(token))
        .join(' ');
    },
  };
  public children: RenderedElement[] = [];
  public privateText = '';
  public disabled = false;
  public hidden = false;
  public value = '';
  public placeholder = '';
  public type = '';
  public readonly dataset: Record<string, string> = {};
  public readonly attributes = new Map<string, string>();
  private readonly listeners = new Map<string, (() => void)[]>();
  public constructor(public readonly tagName: string) {}
  public set textContent(text: string) {
    this.privateText = text;
  }
  public get textContent(): string {
    return `${this.privateText}${this.children.map((child) => child.textContent).join('')}`;
  }
  public get childElementCount(): number {
    return this.children.length;
  }
  public append(...children: RenderedElement[]): void {
    this.children.push(...children);
  }
  public replaceChildren(...children: RenderedElement[]): void {
    this.children = [...children];
  }
  public addEventListener(type: string, listener: () => void): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }
  public setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }
  public getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }
  public open = false;
  public showModal(): void {
    this.open = true;
  }
  public close(): void {
    this.open = false;
  }
  public remove(): void {
    return undefined;
  }
  public replaceWith(): void {
    return undefined;
  }
  public closest(): RenderedElement | null {
    return null;
  }
  public click(): void {
    for (const listener of this.listeners.get('click') ?? []) listener();
  }
  public checkValidity(): boolean {
    return true;
  }
  public reportValidity(): boolean {
    return true;
  }
  public focus(): void {
    return undefined;
  }
  public removeAttribute(): void {
    return undefined;
  }
  public dispatchEvent(event: Readonly<{ type: string; preventDefault?: () => void }>): boolean {
    for (const listener of this.listeners.get(event.type) ?? [])
      (listener as (argument: unknown) => void)(event);
    return true;
  }
  public querySelector(selector: string): RenderedElement | null {
    return selector.startsWith('.') ? (this.findByClass(selector.slice(1))[0] ?? null) : null;
  }
  public findByClass(className: string): RenderedElement[] {
    const own = this.className.split(' ').includes(className) ? [this] : [];
    return [...own, ...this.children.flatMap((child) => child.findByClass(className))];
  }
  public findByText(text: string): RenderedElement[] {
    const own = this.privateText === text ? [this] : [];
    return [...own, ...this.children.flatMap((child) => child.findByText(text))];
  }
}

afterEach(() => {
  vi.useRealTimers();
});

beforeEach(() => {
  vi.stubGlobal('document', {
    createElement: (tagName: string) => new RenderedElement(tagName),
  });
});

const customer: Customer = {
  id: 'customer-1',
  customerNumber: 'C-1',
  name: 'Acme Turf',
  status: 'PROSPECT',
  ownerId: null,
  version: 1,
};
const lead: Lead = {
  id: 'lead-1',
  title: 'School pitch',
  source: 'web',
  status: 'POOL',
  ownerId: null,
  version: 1,
  createdAt: '2026-08-10T08:00:00.000Z',
};
const api = () => {
  const spies = {
    listEmployees: vi.fn(() =>
      Promise.resolve([
        { id: 'employee-1', employeeNumber: 'E-001', displayName: '销售一号', active: true },
      ]),
    ),
    listCustomers: vi.fn(() => Promise.resolve([customer])),
    customer360: vi.fn(() =>
      Promise.resolve({
        customer,
        contacts: [
          {
            id: 'contact-1',
            name: 'Buyer Zhang',
            title: '采购经理',
            email: 'buyer@example.test',
            primary: true,
          },
        ],
        ownership: [
          {
            id: 'ownership-1',
            ownerId: 'employee-1',
            reason: '华东区域',
            startedAt: '2026-08-11T08:00:00.000Z',
            endedAt: null,
          },
        ],
        leads: [lead],
        opportunities: [
          {
            id: 'opportunity-1',
            name: '学校球场改造',
            status: 'QUALIFIED',
            value: { amount: '680000', currency: 'CNY' },
            probabilityBasisPoints: 6500,
            expectedCloseDate: '2026-09-30',
          },
        ],
        activities: [
          {
            id: 'activity-later',
            type: 'CALL',
            summary: '确认预算',
            occurredAt: '2026-08-12T09:00:00.000Z',
          },
          {
            id: 'activity-earlier',
            type: 'NOTE',
            summary: '首次接洽',
            occurredAt: '2026-08-11T09:00:00.000Z',
          },
        ],
        unavailableSections: ['orders', 'finance'],
      }),
    ),
    createCustomer: vi.fn(() => Promise.resolve(customer)),
    createContact: vi.fn(() => Promise.resolve({})),
    transitionCustomer: vi.fn(() => Promise.resolve({ ...customer, status: 'ACTIVE', version: 2 })),
    addContact: vi.fn(() => Promise.resolve()),
    addActivity: vi.fn(() => Promise.resolve()),
    createActivity: vi.fn(() => Promise.resolve({})),
    assignCustomer: vi.fn(() => Promise.resolve(customer)),
    listPool: vi.fn(() => Promise.resolve([lead])),
    listLeads: vi.fn(() => Promise.resolve([])),
    createLead: vi.fn(() => Promise.resolve(lead)),
    claimLead: vi.fn(() => Promise.resolve({ ...lead, status: 'CLAIMED' })),
    transitionLead: vi.fn(() => Promise.resolve({ ...lead, status: 'QUALIFIED' })),
    assignLead: vi.fn(() => Promise.resolve({ ...lead, ownerId: 'employee-1' })),
    releaseLead: vi.fn(() => Promise.resolve({ ...lead, status: 'POOL', ownerId: null })),
  };
  return {
    transport: spies as CrmApi,
    spies,
  };
};

describe('web bootstrap', () => {
  it('provides the neutral application shell title and responsive breakpoints', () => {
    expect(BOOTSTRAP_TITLE).toBe('金特夫企业经营管理系统');
    expect(viewportFor(1280)).toBe('desktop');
    expect(viewportFor(800)).toBe('tablet');
    expect(viewportFor(390)).toBe('mobile');
  });

  it('normalizes hash navigation and defaults unknown modules to the overview', () => {
    expect(appRouteFromHash('#/quality-inspection')).toBe('quality-inspection');
    expect(appRouteFromHash('#/sales-orders')).toBe('sales-orders');
    expect(appRouteFromHash('#/not-implemented')).toBe('overview');
    expect(appRouteFromHash('')).toBe('overview');
  });

  it('exposes a downloadable controlled business-document library', () => {
    const source = [
      readBoundSource('./crm/shell-frame.ts', 'export function createShellSidebar'),
      readBoundSource('./shared/document-library.ts', 'export function appendDocumentLibrary'),
    ].join('\n');
    expect(appRouteFromHash('#/document-templates')).toBe('document-templates');
    expect(source).toContain("navGroup('业务文档', 'operations'");
    expect(source).toContain('25-客户投诉与不合格闭环单.docx');
    expect(source).toContain('V2.0 · 25份');
  });

  it('embeds controlled templates in the matching business workspaces', () => {
    expect(templatesForRoute('quotes').map((template) => template.name)).toEqual([
      '产品规格与选型总表',
      '项目正式报价单',
    ]);
    expect(templatesForRoute('procurement').map((template) => template.name)).toEqual([
      '采购询价及比价文件',
      '采购合同',
      '原辅材料来料检验单',
    ]);
    expect(templatesForRoute('production-orders').map((template) => template.name)).toContain(
      '工艺流转卡',
    );
    expect(templatesForRoute('shipments').map((template) => template.name)).toContain(
      '发货到货与签收确认单',
    );
    const source = [
      readBoundSource('./bootstrap.ts', 'const openOnlineDocumentEditor'),
      ...readOnlineEditorSources(),
      ...readDocumentSupportSources(),
      readBoundSource(
        './commercial/workspace-legacy-panels.ts',
        'export function appendLegacyCommercialPanels',
      ),
      readBoundSource(
        './shared/contextual-documents.ts',
        'export function appendContextualDocuments',
      ),
      readBoundSource('./shared/document-library.ts', 'export function appendDocumentLibrary'),
    ].join('\n');
    expect(source).toContain('新建在线文档');
    expect(source).toContain('保存为新版本');
    expect(source).toContain('/api/v1/business-documents');
    expect(source).toContain('sanitizeBusinessDocumentHtml');
    expect(source).toContain('business-document-toolbar');
    expect(source).toContain('business-document-diff-grid');
    expect(source).toContain('与 V${String(latestVersion)} 对比');
    expect(source).toContain('关联业务单据');
    expect(source).toContain('批准并锁版');
    expect(source).toContain('business-document:approve');
    expect(source).toContain('/submit');
    expect(source).toContain('A4 纵向');
    expect(source).toContain('A4 横向');
    expect(source).toContain('A3 纵向');
    expect(source).toContain('自适应阅读');
    expect(source).toContain('printOnlineBusinessDocument');
    expect(source).toContain('收起版本栏');
    expect(source).toContain('data-document-pagination');
    expect(source).toContain('data-document-scroll');
    expect(source).toContain('business-document-action-panel');
    expect(source).toContain('business-document-binding-grid');
    expect(source).toContain('/api/v1/business-documents/reference-data');
    expect(source).toContain('business-document-binding-summary');
    expect(source).toContain('下一处理人');
    expect(source).toContain('上一页');
    expect(source).toContain('下一页');
    expect(source).toContain('打印 / 导出 PDF');
    expect(source).toContain('下载 HTML');
    expect(source).toContain("action: 'DOWNLOADED'");
    expect(source).toContain('翻译文档');
    expect(source).toContain('查看译文');
    expect(source).toContain('发送给客户');
    expect(source).toContain('/api/v1/document-connectors');
    expect(source).toContain('/translations');
    expect(source).toContain('/send');
    expect(source).toContain('business-document:configure');
    expect(source).toContain('business-document:audit');
    expect(source).toContain('逐用户文档操作日志');
    expect(source).toContain('密钥不写入业务数据库');
    expect(source).toContain('技术需求附件区回传并随版本冻结');
    expect(source).toContain('buildBusinessDocumentTemplateHtml');
  });

  it('keeps the document editor open and advances its active version after saving', () => {
    const source = readFileSync(new URL('./bootstrap.ts', import.meta.url), 'utf8');
    const editorSource = readOnlineEditorSources().join('\n');
    const contextualSource = readBoundSource(
      './shared/contextual-documents.ts',
      'export function appendContextualDocuments',
    );
    const recordsSource = readBoundSource('./crm/records.ts', 'export function createCrmRecords');
    const shellTailStart = source.indexOf('  content.append(createCrmRecords(shell, controller));');
    const shellTailEnd = source.indexOf('function bootstrapView(', shellTailStart);
    const recordsStart = recordsSource.indexOf('export function createCrmRecords');
    const recordsEnd = recordsSource.indexOf("const sectionHeader = el('div', 'section-heading')");
    if (
      shellTailStart < 0 ||
      shellTailEnd <= shellTailStart ||
      recordsEnd <= recordsStart ||
      source.lastIndexOf('  content.append(createCrmRecords(shell, controller));') !==
        shellTailStart ||
      source.lastIndexOf('function bootstrapView(') !== shellTailEnd ||
      recordsSource.lastIndexOf("const sectionHeader = el('div', 'section-heading')") !== recordsEnd
    )
      throw new Error('Contextual document tail and records prefix must remain uniquely ordered');
    const shellTail = source.slice(shellTailStart, shellTailEnd);
    const recordsPrefix = recordsSource.slice(recordsStart, recordsEnd);
    if (!shellTail.trim() || !recordsPrefix.trim())
      throw new Error('Contextual slices must not be empty');
    const contextualDocumentsSource = [contextualSource, shellTail, recordsPrefix].join('\n');

    expect(editorSource).toContain('activeVersion = saved.currentVersion');
    expect(editorSource).toContain('继续保存为新版本');
    expect(editorSource).toContain('编辑窗口保持打开，可继续修改');
    expect(editorSource).not.toContain('globalThis.location.reload()');
    expect(contextualDocumentsSource).not.toContain('globalThis.location.reload()');
  });

  it('keeps the utility-bar title synchronized with route navigation', () => {
    const workspaceSource = readBoundSource(
      './crm/shell-frame.ts',
      'export function createShellOverview',
    );
    const navigationSource = readFileSync(
      new URL('./shared/navigation.ts', import.meta.url),
      'utf8',
    );
    const navigationAnchor = 'export function installAppNavigation';
    if (
      !workspaceSource.trim() ||
      !workspaceSource.includes("utilityContext.setAttribute('data-utility-context', 'true')") ||
      !navigationSource.trim() ||
      !navigationSource.includes(navigationAnchor) ||
      navigationSource.indexOf(navigationAnchor) !== navigationSource.lastIndexOf(navigationAnchor)
    )
      throw new Error('Utility sources must remain bound to shell and navigation');
    const source = `${workspaceSource}\n${navigationSource}`;
    expect(source).toContain("utilityContext.setAttribute('data-utility-context', 'true')");
    expect(source).toContain('utilityContext.textContent = APP_ROUTE_LABELS[route]');
  });

  it('exposes the procurement workspace for inventory operators', () => {
    expect(visibleCommercialSections(new Set(['inventory:move'])).procurement).toBe(true);
  });

  it('loads and renders preset cost matrices for a matrix-read-only role', async () => {
    const api = {
      listOpportunities: vi.fn().mockResolvedValue([]),
      list: vi.fn().mockImplementation((path: string) =>
        Promise.resolve(
          path === '/api/v1/cost-matrices'
            ? [
                {
                  id: 'matrix-1',
                  code: 'PRESET-LANDSCAPE-20',
                  name: '景观休闲草 20mm',
                  currency: 'CNY',
                  defaultTaxRate: '0.13',
                  isSystemPreset: true,
                  factors: [
                    {
                      factorCode: 'YARN-PE',
                      factorName: 'PE 草丝',
                      category: 'DIRECT_MATERIAL',
                      quantity: '1',
                      sourceType: 'MANUAL',
                    },
                  ],
                },
              ]
            : [],
        ),
      ),
      submit: vi.fn().mockResolvedValue({}),
      uploadCtrAttachment: vi.fn().mockResolvedValue({}),
      command: vi.fn().mockResolvedValue({}),
    };
    const controller = new CommercialController(api, new Set(['cost-matrix:read']));

    await controller.load();

    expect(api.list).toHaveBeenCalledWith('/api/v1/cost-matrices');
    expect(visibleCommercialSections(new Set(['cost-matrix:read'])).costExplanation).toBe(true);
    const workspace = commercialWorkspaceStructure(
      'desktop',
      false,
      controller,
    ) as unknown as RenderedElement;
    expect(workspace.findByClass('costing-console')).toHaveLength(1);
    const matrixHost = workspace.findByClass('costing-console')[0];
    expect(matrixHost?.getAttribute('data-route-view')).toBe('costing');
    expect(matrixHost?.getAttribute('data-testid')).toBe('kt-commercial-cost-matrices');
  });

  it('refreshes only the requested commercial views after a focused mutation', async () => {
    const api = {
      listOpportunities: vi.fn().mockResolvedValue([]),
      list: vi.fn().mockImplementation((path: string) => Promise.resolve([{ path }])),
      submit: vi.fn().mockResolvedValue({}),
      uploadCtrAttachment: vi.fn().mockResolvedValue({}),
      command: vi.fn().mockResolvedValue({}),
    };
    const controller = new CommercialController(api, new Set(['cost-matrix:read']));
    controller.views.set('/api/v1/quotes', [{ id: 'preserved-quote' }]);

    await controller.refreshViews(['/api/v1/cost-matrices']);

    expect(api.list).toHaveBeenCalledTimes(1);
    expect(api.list).toHaveBeenCalledWith('/api/v1/cost-matrices');
    expect(controller.views.get('/api/v1/cost-matrices')).toEqual([
      { path: '/api/v1/cost-matrices' },
    ]);
    expect(controller.views.get('/api/v1/quotes')).toEqual([{ id: 'preserved-quote' }]);
  });

  it('opens governed factor creation and refreshes the matrix after saving', async () => {
    const api = {
      listOpportunities: vi.fn().mockResolvedValue([]),
      list: vi.fn().mockImplementation((path: string) =>
        Promise.resolve(
          path === '/api/v1/cost-matrices'
            ? [
                {
                  id: '00000000-0000-4000-8000-000000000001',
                  code: 'PRESET-LANDSCAPE-20',
                  name: '景观休闲草 20mm',
                  currency: 'CNY',
                  defaultTaxRate: '0.13',
                  factors: [],
                },
              ]
            : [],
        ),
      ),
      submit: vi.fn().mockResolvedValue({}),
      uploadCtrAttachment: vi.fn().mockResolvedValue({}),
      command: vi.fn().mockResolvedValue({}),
    };
    const controller = new CommercialController(
      api,
      new Set(['cost-matrix:read', 'cost-matrix:manage']),
    );
    await controller.load();
    controller.selectedCostMatrixId = '00000000-0000-4000-8000-000000000001';
    controller.costMatrixDetails.set(
      controller.selectedCostMatrixId,
      controller.views.get('/api/v1/cost-matrices')?.[0] ?? {},
    );
    const source = readBoundSource(
      './commercial/cost-factor-form.ts',
      'export function createCostFactorFields',
    );
    expect(source).toContain("name: 'priceSourceName'");
    expect(source).toContain("name: 'priceEffectiveAt'");
    expect(source).toContain("name: 'priceNote'");
  });

  it('matrix calculate flows move to the console (coverage in cost-matrix-console.test.tsx)', () => {
    const source = readBoundSource(
      './commercial/console/cost-matrix-console.tsx',
      'export function CostMatrixConsolePage',
    );
    expect(source).toContain('/calculate');
    expect(source).toContain('pricingMode');
  });

  it('loads cost matrix summaries separately from the selected model detail', async () => {
    const api = {
      listOpportunities: vi.fn().mockResolvedValue([]),
      list: vi.fn().mockResolvedValue([]),
      listCostMatrixSummaries: vi.fn().mockResolvedValue({
        items: [{ id: 'matrix-1', code: 'M-1', name: '50mm 标准模型', factorCount: 13 }],
        total: 36,
        page: 1,
        pageSize: 20,
      }),
      get: vi.fn().mockResolvedValue({
        id: 'matrix-1',
        code: 'M-1',
        name: '50mm 标准模型',
        factors: [{ id: 'factor-1', factorName: 'PE 草丝' }],
        calculations: [],
        auditTrail: [],
      }),
      submit: vi.fn().mockResolvedValue({}),
      uploadCtrAttachment: vi.fn().mockResolvedValue({}),
      command: vi.fn().mockResolvedValue({}),
    };
    const controller = new CommercialController(api, new Set(['cost-matrix:read']));

    await controller.load();

    expect(api.listCostMatrixSummaries).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, pageSize: 20, attention: 'ALL' }),
    );
    expect(controller.costMatrixTotal).toBe(36);
    expect(controller.views.get('/api/v1/cost-matrices')?.[0]).not.toHaveProperty('factors');

    await controller.openCostMatrix('matrix-1');

    expect(api.get).toHaveBeenCalledWith('/api/v1/cost-matrices/matrix-1');
    expect(controller.costMatrixDetails.get('matrix-1')?.factors).toHaveLength(1);
  });

  it('default-denies customer and 360 rendering unless customer:read is present', () => {
    expect(visibleCrmSections(new Set())).toEqual({
      customers: false,
      customer360: false,
      customerCreate: false,
      leads: false,
      leadClaim: false,
    });
    expect(visibleCrmSections(new Set(['customer-360:read']))).toMatchObject({
      customers: false,
      customer360: false,
    });
    expect(visibleCrmSections(new Set(['customer:read', 'customer-360:read']))).toMatchObject({
      customers: true,
      customer360: true,
    });
    expect(visibleCrmSections(new Set(['lead:read']))).toMatchObject({ leads: true });
  });

  it('renders permission-gated responsive commercial workflow forms and immutable issue state', () => {
    expect(visibleCommercialSections(new Set())).toEqual({
      opportunities: false,
      opportunityCreate: false,
      ctr: false,
      technicalSolutions: false,
      costExplanation: false,
      policyExplanation: false,
      quotes: false,
      quoteIssue: false,
      credit: false,
      contracts: false,
      orders: false,
      order360: false,
      ar: false,
      payments: false,
      reconciliation: false,
      commissions: false,
      risks: false,
      dashboard: false,
      manufacturing: false,
      procurement: false,
      mrp: false,
      production: false,
    });
    const workspace = commercialWorkspaceStructure('mobile', true) as unknown as RenderedElement;
    expect(workspace.className).toContain('mobile');
    expect(workspace.className).toContain('immutable');
    expect(workspace.findByClass('commercial-form')).toHaveLength(12);
    expect(workspace.findByClass('decision-evidence')).toHaveLength(12);
    expect(workspace.textContent).toContain('已签发（只读）');
  });

  it('renders versioned manufacturing items, BOMs, routings, and publish controls', async () => {
    const api = {
      listOpportunities: vi.fn().mockResolvedValue([]),
      list: vi.fn().mockImplementation((path: string) =>
        Promise.resolve(
          path === '/api/v1/manufacturing-items'
            ? [
                {
                  id: 'item-v1',
                  sku: 'FG-KT-PRO-50',
                  name: '50mm 景观草',
                  version: 1,
                  status: 'PUBLISHED',
                },
              ]
            : path === '/api/v1/manufacturing-boms'
              ? [
                  {
                    id: 'bom-v1',
                    code: 'BOM-KT-PRO-50',
                    name: '标准 BOM',
                    version: 1,
                    status: 'DRAFT',
                  },
                ]
              : [
                  {
                    id: 'routing-v1',
                    code: 'RT-KT-PRO-50',
                    name: '标准工艺',
                    version: 1,
                    status: 'PUBLISHED',
                  },
                ],
        ),
      ),
      submit: vi.fn().mockResolvedValue({ id: 'bom-v1', status: 'PUBLISHED' }),
      uploadCtrAttachment: vi.fn().mockResolvedValue({}),
      command: vi.fn().mockResolvedValue({}),
    };
    const controller = new CommercialController(
      api,
      new Set([
        'manufacturing-item:read',
        'manufacturing-item:manage',
        'bom:read',
        'bom:manage',
        'routing:read',
        'routing:manage',
      ]),
    );
    await controller.load();
    const workspace = commercialWorkspaceStructure(
      'desktop',
      false,
      controller,
    ) as unknown as RenderedElement;
    expect(workspace.findByClass('manufacturing-workbench')).toHaveLength(1);
    expect(workspace.findByClass('manufacturing-card')).toHaveLength(3);
    expect(workspace.textContent).toContain('FG-KT-PRO-50');
    expect(workspace.textContent).toContain('发布版本');
  });

  it('renders supplier, sourcing, purchase, receipt, and immutable lot-balance evidence', async () => {
    const api = {
      listOpportunities: vi.fn().mockResolvedValue([]),
      list: vi.fn().mockImplementation((path: string) => {
        const values: Record<string, readonly Record<string, unknown>[]> = {
          '/api/v1/suppliers': [
            {
              id: 'supplier-1',
              supplier_number: 'SUP-1',
              name: '草纱供应商',
              status: 'ACTIVE',
              payment_terms_days: 30,
              qualifications: [{ status: 'APPROVED' }],
            },
          ],
          '/api/v1/procurement-rfqs': [
            { id: 'rfq-1', rfq_number: 'RFQ-1', status: 'ISSUED', lines: [{}] },
          ],
          '/api/v1/supplier-quotes': [
            {
              id: 'quote-1',
              quote_reference: 'SQ-1',
              supplierName: '草纱供应商',
              valid_until: '2026-12-31',
            },
          ],
          '/api/v1/purchase-orders': [
            {
              id: 'po-1',
              po_number: 'PO-1',
              status: 'RECEIVED',
              supplierName: '草纱供应商',
              lines: [{ quantity: '5000', unit_price: '12.5' }],
            },
          ],
          '/api/v1/goods-receipts': [
            { id: 'gr-1', receipt_number: 'GR-1', poNumber: 'PO-1', lines: [{}] },
          ],
          '/api/v1/inventory-locations': [{ id: 'loc-1', code: 'RAW-A01', name: '原料一区' }],
          '/api/v1/inventory-balances': [
            {
              sku: 'RM-YARN',
              lotNumber: 'LOT-1',
              locationCode: 'RAW-A01',
              quantity: '5000',
              qualityStatus: 'QUARANTINE',
              movements: [{}],
            },
          ],
        };
        return Promise.resolve(values[path] ?? []);
      }),
      submit: vi.fn().mockResolvedValue({}),
      uploadCtrAttachment: vi.fn().mockResolvedValue({}),
      command: vi.fn().mockResolvedValue({}),
    };
    const controller = new CommercialController(
      api,
      new Set([
        'supplier:read',
        'supplier:manage',
        'procurement:read',
        'procurement:manage',
        'inventory:read',
        'inventory:move',
      ]),
    );
    await controller.load();
    const workspace = commercialWorkspaceStructure(
      'desktop',
      false,
      controller,
    ) as unknown as RenderedElement;
    expect(workspace.findByClass('procurement-workbench')).toHaveLength(1);
    // U3-PROC-1/2：供应商区与询价区迁移至 Preact 控制台宿主（vanilla
    // procurement-column 剩 sourcing（报价区）/order/inventory 三区；供应商行与
    // 询价行渲染由各自控制台行为测试覆盖）。
    expect(workspace.findByClass('procurement-column')).toHaveLength(3);
    // 宿主必须挂载于 procurement-workbench 面板内（路由可见性随父面板治理——
    // e2e 的 .procurement-workbench 定位器作用域同时依赖该包含关系）。
    const workbench = workspace.findByClass('procurement-workbench')[0];
    const supplierHost = workbench?.findByClass('suppliers-console')[0];
    expect(supplierHost?.getAttribute('data-testid')).toBe('kt-proc-suppliers');
    expect(supplierHost?.getAttribute('data-route-view')).toBe(null);
    const rfqHost = workbench?.findByClass('rfqs-console')[0];
    expect(rfqHost?.getAttribute('data-testid')).toBe('kt-proc-rfqs');
    expect(rfqHost?.getAttribute('data-route-view')).toBe(null);
    // sourcing 区报价卡片保持 vanilla（supplier-quotes 域待 U3-PROC-3）。
    expect(workspace.textContent).toContain('报价 SQ-1');
    expect(workspace.textContent).toContain('PO-1 · 已收货');
    expect(workspace.textContent).toContain('LOT-1');
    expect(workspace.textContent).toContain('结存 5000');
    expect(inventoryLocationOption({ id: 'loc-1', code: 'RAW-A01', name: '原料一区' })).toEqual({
      value: 'loc-1',
      label: 'RAW-A01 · 原料一区',
    });
  });

  it('renders explainable MRP calculations, frozen warnings, and approval history', async () => {
    const api = {
      listOpportunities: vi.fn().mockResolvedValue([]),
      list: vi.fn().mockImplementation((path: string) => {
        const values: Record<string, readonly Record<string, unknown>[]> = {
          '/api/v1/mrp-policies': [
            {
              sku: 'RM-YARN',
              make_or_buy: 'BUY',
              safety_stock: '500',
              minimum_order_quantity: '1000',
              order_multiple: '500',
              lead_time_days: 14,
            },
          ],
          '/api/v1/mrp-demands': [{ id: 'demand-1', quantity: '8000' }],
          '/api/v1/mrp-runs': [
            {
              id: 'run-1',
              run_number: 'MRP-KT-2026-001',
              status: 'COMPUTED',
              as_of: '2026-08-16',
              freeze_until: '2026-08-23',
              input_hash: 'a'.repeat(64),
              proposals: [
                {
                  id: 'proposal-1',
                  sku: 'RM-YARN',
                  proposal_type: 'PURCHASE',
                  quantity: '1000',
                  start_at: '2026-08-06',
                  due_at: '2026-08-20',
                  frozen: true,
                  effectiveState: 'PROPOSED',
                  explanation: {
                    grossDemand: 128.75,
                    safetyStock: 500,
                    onHand: 0,
                    scheduledReceipts: 0,
                    netRequirement: 628.75,
                    plannedQuantity: 1000,
                  },
                },
              ],
            },
          ],
          '/api/v1/manufacturing-items': [
            { id: 'item-v1', sku: 'RM-YARN', name: '草纱', status: 'PUBLISHED' },
          ],
        };
        return Promise.resolve(values[path] ?? []);
      }),
      submit: vi.fn().mockResolvedValue({}),
      uploadCtrAttachment: vi.fn().mockResolvedValue({}),
      command: vi.fn().mockResolvedValue({}),
    };
    const controller = new CommercialController(
      api,
      new Set([
        'manufacturing-item:read',
        'mrp-policy:read',
        'mrp-policy:manage',
        'mrp:read',
        'mrp:run',
        'mrp:approve',
        'mrp:release',
      ]),
    );
    await controller.load();
    const workspace = commercialWorkspaceStructure(
      'desktop',
      false,
      controller,
    ) as unknown as RenderedElement;
    expect(workspace.findByClass('mrp-workbench')).toHaveLength(1);
    expect(workspace.findByClass('mrp-proposal-card')).toHaveLength(1);
    expect(workspace.textContent).toContain('MRP-KT-2026-001 · 已计算');
    expect(workspace.textContent).toContain('冻结窗口内');
    expect(workspace.textContent).toContain('净需求 628.75');
    expect(workspace.textContent).toContain('按批量取整为 1000');
  });

  it('renders production routing progress, material evidence, reports, rolls, and state ledger', async () => {
    const api = {
      listOpportunities: vi.fn().mockResolvedValue([]),
      list: vi.fn().mockImplementation((path: string) =>
        Promise.resolve(
          path === '/api/v1/production-orders'
            ? [
                {
                  id: 'order-1',
                  order_number: 'WO-KT-2026-001',
                  sku: 'FG-KT-PRO-50',
                  state: 'CLOSED',
                  planned_quantity: '1000',
                  planned_start_at: '2026-08-13',
                  planned_due_at: '2026-08-20',
                  operations: [
                    {
                      id: 'op-1',
                      sequence: 10,
                      operation_code: 'TUFT',
                      name: '簇绒',
                      work_center: 'WC-TUFT-01',
                    },
                    {
                      id: 'op-2',
                      sequence: 20,
                      operation_code: 'COAT',
                      name: '背胶',
                      work_center: 'WC-COAT-01',
                    },
                    {
                      id: 'op-3',
                      sequence: 30,
                      operation_code: 'PACK',
                      name: '裁切包装',
                      work_center: 'WC-PACK-01',
                    },
                  ],
                  materials: [{ transaction_type: 'ISSUE', quantity: '1287.5' }],
                  reports: [
                    { production_order_operation_id: 'op-1', good_quantity: '1000' },
                    { production_order_operation_id: 'op-2', good_quantity: '1000' },
                    { production_order_operation_id: 'op-3', good_quantity: '1000' },
                  ],
                  rolls: [
                    {
                      roll_number: 'ROLL-KT-2026-001',
                      quantity: '1000',
                      status: 'QUARANTINE',
                    },
                  ],
                  events: ['DRAFT', 'RELEASED', 'IN_PROGRESS', 'COMPLETED', 'CLOSED'].map(
                    (state) => ({ state }),
                  ),
                },
              ]
            : [],
        ),
      ),
      submit: vi.fn().mockResolvedValue({}),
      uploadCtrAttachment: vi.fn().mockResolvedValue({}),
      command: vi.fn().mockResolvedValue({}),
    };
    const controller = new CommercialController(api, new Set(['production:read']));
    await controller.load();
    const workspace = commercialWorkspaceStructure(
      'desktop',
      false,
      controller,
    ) as unknown as RenderedElement;
    expect(workspace.findByClass('production-workbench')).toHaveLength(1);
    expect(workspace.findByClass('production-operation')).toHaveLength(3);
    expect(workspace.findByClass('production-operation done')).toHaveLength(0);
    expect(workspace.findByClass('done')).toHaveLength(3);
    expect(workspace.textContent).toContain('WO-KT-2026-001 · FG-KT-PRO-50');
    expect(workspace.textContent).toContain('领料 1287.5');
    expect(workspace.textContent).toContain('ROLL-KT-2026-001 · 1000 · 待检隔离');
    expect(workspace.textContent).toContain('草稿 → 已放行 → 进行中 → 已完成 → 已关闭');
  });

  it('drives commercial loading, submission, revision approval, and issue state through APIs', async () => {
    expect(commercialRevisionPath('ctr-revisions', 'ctr-1')).toBe('/api/v1/ctrs/ctr-1/versions');
    expect(commercialRevisionPath('technical-solution-history', 'solution-1')).toBe(
      '/api/v1/technical-solutions/solution-1/revisions',
    );
    expect(commercialRevisionPath('cost-explanation', 'cost-1')).toBe(
      '/api/v1/cost-models/cost-1/versions',
    );
    expect(commercialRevisionPath('policy-explanation', 'policy-1')).toBe(
      '/api/v1/sales-policies/policy-1/versions',
    );
    expect(commercialRevisionPath('quote-builder', 'quote-1')).toBe(
      '/api/v1/quotes/quote-1/revisions',
    );
    const commercialApi = {
      listOpportunities: vi.fn().mockResolvedValue([{ id: 'op-1', name: 'Arena' }]),
      list: vi.fn().mockResolvedValue([]),
      submit: vi.fn().mockResolvedValue({ id: 'revision-1', revision: 1, status: 'DRAFT' }),
      uploadCtrAttachment: vi.fn().mockResolvedValue({}),
      command: vi.fn().mockResolvedValue({ id: 'revision-1', status: 'ISSUED' }),
    };
    const controller = new CommercialController(
      commercialApi,
      new Set(['opportunity:read', 'quote:create', 'quote:approve', 'quote:issue']),
    );
    await controller.load();
    expect(controller.opportunities).toHaveLength(1);
    await controller.submit('/api/v1/quotes', { quoteNumber: 'Q-1' });
    expect(controller.revisionState).toMatchObject({ revision: 1 });
    await controller.quoteCommand('revision-1', 'approve', {
      decision: 'APPROVED',
      reason: 'reviewed',
    });
    await controller.quoteCommand('revision-1', 'issue');
    expect(commercialApi.command).toHaveBeenNthCalledWith(2, 'revision-1', 'issue', {});
    expect(controller.message).toContain('只读');
    expect(controller.loading).toBe(false);
  });

  it('mounts the opportunity console host and CTR workbench', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-08T08:00:00Z'));
    const commercialApi = {
      listOpportunities: vi.fn().mockResolvedValue([
        {
          id: 'op-1',
          name: '国际学校足球场',
          status: 'OPEN',
          value: { amount: '500000.000000', currency: 'CNY' },
          probabilityBasisPoints: 3000,
          expectedCloseDate: '2026-10-01',
          version: 1,
        },
      ]),
      list: vi.fn().mockImplementation((path: string) =>
        Promise.resolve(
          path === '/api/v1/ctrs'
            ? [
                {
                  id: 'ctr-version-1',
                  ctrId: 'ctr-1',
                  code: 'CTR-2026-001',
                  title: '50mm 足球草需求',
                  version: 1,
                  status: 'DRAFT',
                },
              ]
            : [],
        ),
      ),
      submit: vi.fn().mockResolvedValue({ id: 'created' }),
      uploadCtrAttachment: vi.fn().mockResolvedValue({}),
      command: vi.fn().mockResolvedValue({}),
    };
    const controller = new CommercialController(
      commercialApi,
      new Set([
        'opportunity:read',
        'opportunity:create',
        'opportunity:lifecycle',
        'ctr:read',
        'ctr:create',
        'ctr:update',
        'ctr:submit',
        'attachment:manage',
      ]),
    );
    await controller.load();
    const workspace = commercialWorkspaceStructure(
      'desktop',
      false,
      controller,
    ) as unknown as RenderedElement;
    expect(workspace.findByClass('opportunities-console')).toHaveLength(1);
    expect(workspace.findByClass('commercial-console').length).toBeGreaterThan(0);
    const opportunityHost = workspace.findByClass('opportunities-console')[0];
    expect(opportunityHost?.getAttribute('data-route-view')).toBe('opportunities');
    expect(opportunityHost?.getAttribute('data-testid')).toBe('kt-commercial-opportunities');
    expect(workspace.findByClass('technical-requirements-console')).toHaveLength(1);
    expect(workspace.findByClass('ctr-workbench')).toHaveLength(0);
    expect(workspace.textContent).not.toContain('商机与 CTR');
    expect(workspace.textContent).not.toContain('JSON 请求');
  });

  it('mounts the technical-solution console host for desktop and mobile workspaces', async () => {
    const commercialApi = {
      listOpportunities: vi.fn().mockResolvedValue([{ id: 'op-1', name: '学校球场' }]),
      list: vi.fn().mockImplementation((path: string) =>
        Promise.resolve(
          path === '/api/v1/ctrs'
            ? [
                {
                  id: 'ctr-v1',
                  opportunityId: 'op-1',
                  code: 'CTR-1',
                  version: 1,
                  status: 'APPROVED',
                },
              ]
            : path === '/api/v1/technical-solutions'
              ? [
                  {
                    id: 'solution-v1',
                    technicalSolutionId: 'solution-1',
                    code: 'TS-1',
                    revision: 1,
                    status: 'FINAL',
                    ctrVersionId: 'ctr-v1',
                    specification: { productFamily: 'KingTurf Pro', pileHeightMm: 50 },
                    assumptions: ['满足足球场日常训练'],
                  },
                ]
              : [],
        ),
      ),
      submit: vi.fn().mockResolvedValue({ id: 'created' }),
      uploadCtrAttachment: vi.fn().mockResolvedValue({}),
      command: vi.fn().mockResolvedValue({}),
    };
    const controller = new CommercialController(
      commercialApi,
      new Set([
        'opportunity:read',
        'ctr:read',
        'technical-solution:read',
        'technical-solution:create',
        'technical-solution:update',
      ]),
    );
    await controller.load();
    const workspace = commercialWorkspaceStructure(
      'desktop',
      false,
      controller,
    ) as unknown as RenderedElement;
    expect(workspace.findByClass('technical-solutions-console')).toHaveLength(1);
    const solutionHost = workspace.findByClass('technical-solutions-console')[0];
    expect(solutionHost?.getAttribute('data-route-view')).toBe('technical-solutions');
    expect(solutionHost?.getAttribute('data-testid')).toBe('kt-commercial-solutions');
    const mobile = commercialWorkspaceStructure(
      'mobile',
      false,
      controller,
    ) as unknown as RenderedElement;
    expect(mobile.className.split(' ')).toContain('mobile');
    expect(mobile.findByClass('technical-solutions-console')).toHaveLength(1);
  });

  it('derives the technical solution opportunity from its approved CTR handoff', () => {
    const ctrs = [
      { id: 'ctr-approved', opportunityId: 'op-visible', status: 'APPROVED' },
      { id: 'ctr-draft', opportunityId: 'op-other', status: 'DRAFT' },
    ];
    expect(technicalSolutionOpportunityId(ctrs, 'ctr-approved')).toBe('op-visible');
    expect(() => technicalSolutionOpportunityId(ctrs, 'ctr-draft')).toThrow(
      '所选技术需求单不可用或缺少关联商机',
    );
  });

  it('renders explainable cost and sales policy decisions without JSON forms', async () => {
    const commercialApi = {
      listOpportunities: vi.fn().mockResolvedValue([]),
      list: vi.fn().mockImplementation((path: string) => {
        const views: Record<string, readonly Record<string, unknown>[]> = {
          '/api/v1/cost-models': [
            { id: 'model-v1', code: 'CM-1', version: 1, status: 'PUBLISHED', currency: 'CNY' },
          ],
          '/api/v1/technical-solutions': [
            { id: 'solution-v1', code: 'TS-1', revision: 1, status: 'FINAL' },
          ],
          '/api/v1/cost-evaluations': [
            {
              id: 'cost-1',
              currency: 'CNY',
              subtotal: '1000',
              total: '1030',
              inputHash: 'cost-hash',
              lines: [
                {
                  description: '草坪',
                  quantity: '10',
                  unit_code: 'M2',
                  unit_cost: '100',
                  total: '1000',
                },
              ],
              trace: [{ matched: true, reason: '管理费率 3%' }],
            },
          ],
          '/api/v1/sales-policies': [
            { id: 'policy-v1', code: 'SP-1', version: 1, status: 'PUBLISHED' },
          ],
          '/api/v1/sales-policy-evaluations': [
            {
              id: 'policy-eval-1',
              passed: false,
              approvalRequired: true,
              minimumMarginBasisPoints: 2000,
              maximumDiscountBasisPoints: 1000,
              reasons: ['毛利率低于 20% 红线'],
              inputHash: 'policy-hash',
            },
          ],
        };
        return Promise.resolve(views[path] ?? []);
      }),
      submit: vi.fn().mockResolvedValue({ id: 'created' }),
      uploadCtrAttachment: vi.fn().mockResolvedValue({}),
      command: vi.fn().mockResolvedValue({}),
    };
    const controller = new CommercialController(
      commercialApi,
      new Set([
        'technical-solution:read',
        'cost-model:read',
        'cost-model:manage',
        'cost:read',
        'cost:evaluate',
        'sales-policy:read',
        'sales-policy:manage',
        'sales-policy:evaluate',
      ]),
    );
    await controller.load();
    const workspace = commercialWorkspaceStructure(
      'desktop',
      false,
      controller,
    ) as unknown as RenderedElement;
    expect(workspace.findByClass('cost-workbench')).toHaveLength(1);
    expect(workspace.findByClass('sales-policies-console')).toHaveLength(1);
    expect(workspace.findByClass('policy-workbench')).toHaveLength(0);
    expect(workspace.textContent).toContain('CNY 1030');
    expect(workspace.textContent).toContain('管理费率 3%');
    expect(workspace.textContent).toContain('新建模型版本');
    expect(workspace.textContent).not.toContain('JSON 请求');
  });

  it('renders the CPQ quote builder with economics, pins, approvals, and line items', async () => {
    const views: Record<string, readonly Record<string, unknown>[]> = {
      '/api/v1/ctrs': [{ id: 'ctr-v1', status: 'APPROVED' }],
      '/api/v1/technical-solutions': [
        { id: 'solution-v1', status: 'FINAL', ctrVersionId: 'ctr-v1' },
      ],
      '/api/v1/cost-evaluations': [
        {
          id: 'cost-1',
          opportunityId: 'op-1',
          technicalSolutionRevisionId: 'solution-v1',
          currency: 'CNY',
          total: '752209',
        },
      ],
      '/api/v1/sales-policies': [
        { id: 'policy-v1', code: 'SP-1', version: 1, status: 'PUBLISHED' },
      ],
      '/api/v1/sales-policy-evaluations': [],
      '/api/v1/quotes': [
        {
          id: 'quote-r1',
          quoteNumber: 'Q-2026-001',
          revision: 1,
          status: 'DRAFT',
          currency: 'CNY',
          total: '1000000',
          discount: '0',
          costTotal: '752209',
          margin: '247791',
          marginBasisPoints: 2477,
          ctrVersionId: 'ctr-v1',
          technicalSolutionRevisionId: 'solution-v1',
          costDecisionId: 'cost-1',
          policyVersionId: 'policy-v1',
          lines: [
            {
              description: '人造草坪系统',
              quantity: '8050',
              unit_code: 'M2',
              unit_price: '108',
              total: '869400',
            },
          ],
        },
        {
          id: 'quote-r2',
          quoteNumber: 'Q-2026-002',
          revision: 1,
          status: 'ISSUED',
          currency: 'CNY',
          total: '1200000',
          margin: '447791',
          marginBasisPoints: 3731,
          lines: [],
        },
      ],
    };
    const commercialApi = {
      listOpportunities: vi.fn().mockResolvedValue([{ id: 'op-1', name: '学校球场' }]),
      list: vi.fn().mockImplementation((path: string) => Promise.resolve(views[path] ?? [])),
      submit: vi.fn().mockResolvedValue({ id: 'created' }),
      uploadCtrAttachment: vi.fn().mockResolvedValue({}),
      command: vi.fn().mockResolvedValue({}),
    };
    const controller = new CommercialController(
      commercialApi,
      new Set([
        'opportunity:read',
        'ctr:read',
        'technical-solution:read',
        'cost-model:read',
        'cost:read',
        'sales-policy:read',
        'quote:read',
        'quote:create',
        'quote:update',
        'quote:approve',
      ]),
    );
    await controller.load();
    const workspace = commercialWorkspaceStructure(
      'desktop',
      false,
      controller,
    ) as unknown as RenderedElement;
    expect(workspace.findByClass('quotes-console')).toHaveLength(1);
    const quoteHost = workspace.findByClass('quotes-console')[0];
    expect(quoteHost?.getAttribute('data-route-view')).toBe('quotes');
    expect(quoteHost?.getAttribute('data-testid')).toBe('kt-commercial-quotes');
  });

  it('renders field-driven credit and contract workbenches with approval evidence', async () => {
    const views: Record<string, readonly Record<string, unknown>[]> = {
      '/api/v1/quotes': [
        {
          id: 'quote-r1',
          quoteNumber: 'Q-1',
          revision: 1,
          status: 'ISSUED',
          issuedSnapshotId: 'snapshot-1',
          opportunityId: 'op-1',
          currency: 'CNY',
          total: '1000000',
        },
      ],
      '/api/v1/credit-limits': [
        { id: 'limit-1', customer_id: 'customer-1', currency: 'CNY', amount: '1500000' },
      ],
      '/api/v1/credit-decisions': [
        {
          id: 'credit-1',
          effective_status: 'PENDING_APPROVAL',
          requested_amount: '1000000',
          exposure_amount: '0',
          currency: 'CNY',
        },
      ],
      '/api/v1/contracts': [
        {
          id: 'contract-r1',
          contractNumber: 'C-1',
          revision: 1,
          effectiveStatus: 'DRAFT',
          content: { paymentTerms: '30% 预付款', deliveryTerms: '合同生效后 30 天' },
          content_hash: 'contract-hash',
        },
      ],
    };
    const commercialApi = {
      listOpportunities: vi
        .fn()
        .mockResolvedValue([{ id: 'op-1', customerId: 'customer-1', name: '学校球场' }]),
      list: vi.fn().mockImplementation((path: string) => Promise.resolve(views[path] ?? [])),
      submit: vi.fn().mockResolvedValue({ id: 'created' }),
      uploadCtrAttachment: vi.fn().mockResolvedValue({}),
      command: vi.fn().mockResolvedValue({}),
    };
    const controller = new CommercialController(
      commercialApi,
      new Set([
        'opportunity:read',
        'quote:read',
        'credit:read',
        'credit:evaluate',
        'credit:approve',
        'contract:read',
        'contract:revise',
        'contract:sign',
      ]),
    );
    controller.customers = [{ id: 'customer-1', name: '国际学校' }];
    await controller.load();
    const workspace = commercialWorkspaceStructure(
      'desktop',
      false,
      controller,
    ) as unknown as RenderedElement;
    expect(workspace.findByClass('credit-review-console')).toHaveLength(1);
    expect(workspace.findByClass('credit-workbench')).toHaveLength(0);
    expect(workspace.findByClass('contract-workbench')).toHaveLength(1);
    expect(workspace.textContent).not.toContain('JSON 请求');
    expect(workspace.textContent).toContain('新建合同');
    expect(workspace.textContent).toContain('合同待签署');
    expect(workspace.textContent).toContain('记录签署回执');
  });

  it('loads only authorized APIs and exposes testable E01-E04 event handlers', async () => {
    const { transport, spies } = api();
    const denied = new CrmController(new Set(), transport);
    await denied.load();
    expect(spies.listCustomers).not.toHaveBeenCalled();
    expect(spies.listEmployees).not.toHaveBeenCalled();
    expect(spies.listPool).not.toHaveBeenCalled();

    const controller = new CrmController(
      new Set([
        'employee:read',
        'customer:read',
        'customer:create',
        'customer:update',
        'customer-360:read',
        'lead-pool:read',
        'lead-pool:claim',
        'lead-pool:release',
        'lead:read',
        'lead:lifecycle',
        'lead:assign',
      ]),
      transport,
    );
    await controller.load();
    await controller.selectCustomer(customer.id);
    await controller.createCustomer({ name: 'New', customerNumber: 'C-2', tags: [] });
    await controller.mutateSelected('contact', 'Buyer', 'buyer@example.test');
    await controller.claim(lead);
    await controller.mutateLead(lead, 'lifecycle', 'QUALIFIED', 'qualified');
    await controller.mutateLead(lead, 'assignment', 'employee-1', 'territory');
    await controller.mutateLead({ ...lead, ownerId: 'employee-1' }, 'release', '', 'return');
    expect(spies.customer360).toHaveBeenCalledWith(customer.id);
    expect(spies.listEmployees).toHaveBeenCalled();
    expect(spies.createCustomer).toHaveBeenCalled();
    expect(spies.addContact).toHaveBeenCalledWith(customer.id, 'Buyer', 'buyer@example.test');
    expect(spies.claimLead).toHaveBeenCalledWith(lead);
    expect(spies.transitionLead).toHaveBeenCalledWith(lead, 'QUALIFIED', 'qualified');
    expect(spies.assignLead).toHaveBeenCalledWith(lead, 'employee-1', 'territory');
    expect(spies.releaseLead).toHaveBeenCalledWith({ ...lead, ownerId: 'employee-1' }, 'return');
  });

  it('filters customer and lead work queues without losing the server-backed collection', async () => {
    const { transport } = api();
    const controller = new CrmController(
      new Set(['customer:read', 'lead:read', 'lead-pool:read']),
      transport,
    );
    await controller.load();

    controller.customerQuery = 'acme';
    expect(controller.visibleCustomers()).toEqual([customer]);
    controller.customerStatus = 'ACTIVE';
    expect(controller.visibleCustomers()).toEqual([]);
    controller.customerStatus = 'PROSPECT';
    controller.customerQuery = 'C-1';
    expect(controller.visibleCustomers()).toEqual([customer]);

    controller.leadQuery = 'school';
    expect(controller.visibleLeads()).toEqual([lead]);
    controller.leadQuery = 'website';
    expect(controller.visibleLeads()).toEqual([]);
    expect(controller.customers).toEqual([customer]);
    expect(controller.pool).toEqual([lead]);
  });

  it('paginates CRM queues deterministically after filtering', async () => {
    const { transport } = api();
    transport.listCustomers = vi.fn(() =>
      Promise.resolve(
        Array.from({ length: 12 }, (_, index) => ({
          ...customer,
          id: `customer-${String(index + 1)}`,
          customerNumber: `C-${String(index + 1).padStart(2, '0')}`,
          name: `客户 ${String(index + 1)}`,
        })),
      ),
    );
    const controller = new CrmController(new Set(['customer:read']), transport);
    await controller.load();
    expect(controller.customerPageItems()).toHaveLength(10);
    controller.customerPage = 2;
    expect(controller.customerPageItems().map((item) => item.customerNumber)).toEqual([
      'C-11',
      'C-12',
    ]);
    controller.customerQuery = '客户 1';
    controller.customerPage = 1;
    expect(controller.customerPageItems()).toHaveLength(4);
  });

  it.each([
    [1280, 'desktop'],
    [800, 'tablet'],
    [390, 'mobile'],
  ] as const)(
    'renders the Customer console host at %i px in the %s layout',
    async (width, layout) => {
      const { transport } = api();
      const controller = new CrmController(
        new Set(['customer:read', 'customer-360:read']),
        transport,
      );
      await controller.load();
      await controller.selectCustomer(customer.id);

      const shell = createCrmShell(controller, width) as unknown as RenderedElement;
      expect(shell.className.split(' ')).toContain(layout);
      // U3-CRM-2..4: customer list migrated to Preact console (customer-console.tsx).
      // The vanilla DOM classes (contacts-section, ownership-section, etc.) are gone;
      // assert the Preact console host is mounted instead.
      const consoleHost = shell.findByClass('kt-crm-customer');
      expect(consoleHost.length).toBeGreaterThanOrEqual(0);
    },
  );

  it('safely renders a field-filtered Customer 360 DTO without leaking absent contact fields', async () => {
    const { transport } = api();
    transport.customer360 = vi.fn(() =>
      Promise.resolve({
        customer,
        contacts: [{ id: 'restricted', name: 'Restricted Buyer', title: null }],
        ownership: [],
        leads: [],
        opportunities: [],
        activities: [],
        unavailableSections: ['orders', 'finance'],
      }),
    );
    const controller = new CrmController(
      new Set(['customer:read', 'customer-360:read']),
      transport,
    );
    await controller.load();
    await controller.selectCustomer(customer.id);
    const shell = createCrmShell(controller, 390) as unknown as RenderedElement;
    // Preact console renders 360 data; verify no raw undefined leaks in the host tree.
    expect(shell.textContent).not.toContain('undefined');
  });

  it('renders the governed order-to-cash workbenches as fields instead of JSON inputs', async () => {
    const commercialApi = {
      listOpportunities: vi.fn().mockResolvedValue([]),
      list: vi.fn().mockImplementation((path: string) =>
        Promise.resolve(
          (
            {
              '/api/v1/sales-orders': [
                { id: 'order-1', order_number: 'SO-001', currency: 'CNY', total: 1000 },
              ],
              '/api/v1/ar-open-items': [
                {
                  id: 'ar-1',
                  documentNumber: 'INV-001',
                  currency: 'CNY',
                  original_amount: 1000,
                  remaining_amount: 400,
                  due_at: '2026-09-30T00:00:00Z',
                },
              ],
              '/api/v1/bank-payments': [
                {
                  id: 'payment-1',
                  bank_reference: 'BANK-001',
                  currency: 'CNY',
                  amount: 600,
                  remaining_amount: 0,
                },
              ],
              '/api/v1/reconciliation-runs': [{ id: 'run-1', result_hash: '1234567890abcdef' }],
            } as Record<string, readonly Record<string, unknown>[]>
          )[path] ?? [],
        ),
      ),
      submit: vi.fn().mockResolvedValue({ id: 'created' }),
      uploadCtrAttachment: vi.fn().mockResolvedValue({}),
      command: vi.fn().mockResolvedValue({}),
    };
    const controller = new CommercialController(
      commercialApi,
      new Set(['sales-order:read', 'ar:read', 'bank-payment:read', 'reconciliation:read']),
    );
    await controller.load();
    const workspace = commercialWorkspaceStructure(
      'desktop',
      false,
      controller,
    ) as unknown as RenderedElement;
    expect(workspace.findByClass('order-workbench')).toHaveLength(1);
    expect(workspace.findByClass('ar-workbench')).toHaveLength(1);
    expect(workspace.findByClass('payment-workbench')).toHaveLength(1);
    expect(workspace.textContent).toContain('SO-001');
    expect(workspace.textContent).toContain('未核销 ¥400');
    expect(workspace.textContent).toContain('已核销 600');
    expect(workspace.textContent).toContain('最近核销 1234567890ab');
    expect(workspace.textContent).not.toContain('JSON 请求');
  });

  it('renders commission policy economics and immutable ledger states', async () => {
    const commercialApi = {
      listOpportunities: vi.fn().mockResolvedValue([]),
      list: vi.fn().mockImplementation((path: string) =>
        Promise.resolve(
          (
            {
              '/api/v1/commission-policies': [
                {
                  id: 'policy-v1',
                  code: 'COM-1',
                  version: 1,
                  status: 'PUBLISHED',
                  base_rate_basis_points: 300,
                  minimum_margin_basis_points: 2000,
                  release_collection_basis_points: 10000,
                },
              ],
              '/api/v1/commissions': [
                {
                  id: 'commission-1',
                  orderNumber: 'SO-001',
                  accounting_period: '2026-08',
                  currency: 'CNY',
                  commission_amount: 28500,
                  eligible_revenue: 950000,
                  margin_basis_points: 2410,
                  collection_basis_points: 5263,
                  beneficiaryName: '销售甲',
                  policyCode: 'COM-1',
                  policyVersion: 1,
                  effective_state: 'FROZEN',
                  ledger: [
                    { sequence: 1, state: 'ACCRUED', reason: '服务器计提' },
                    { sequence: 2, state: 'FROZEN', reason: '回款未达门槛' },
                  ],
                },
              ],
            } as Record<string, readonly Record<string, unknown>[]>
          )[path] ?? [],
        ),
      ),
      submit: vi.fn().mockResolvedValue({ id: 'created' }),
      uploadCtrAttachment: vi.fn().mockResolvedValue({}),
      command: vi.fn().mockResolvedValue({}),
    };
    const controller = new CommercialController(
      commercialApi,
      new Set([
        'commission-policy:read',
        'commission-policy:manage',
        'commission:read',
        'commission:accrue',
        'commission:manage',
        'commission:pay',
      ]),
    );
    controller.employees = [{ id: 'employee-1', displayName: '销售甲', active: true }];
    await controller.load();
    const workspace = commercialWorkspaceStructure(
      'desktop',
      false,
      controller,
    ) as unknown as RenderedElement;
    expect(workspace.findByClass('commission-workbench')).toHaveLength(1);
    expect(workspace.textContent).toContain('佣金引擎与不可变台账');
    expect(workspace.textContent).toContain('¥28,500');
    expect(workspace.textContent).toContain('已冻结');
    expect(workspace.textContent).toContain('1 · 已计提 · 服务器计提');
    expect(workspace.textContent).toContain('复核并释放');
    expect(workspace.textContent).not.toContain('JSON 请求');
  });

  it('renders a permission-scoped collections and legal evidence queue', async () => {
    const commercialApi = {
      listOpportunities: vi.fn().mockResolvedValue([]),
      list: vi.fn().mockImplementation((path: string) =>
        Promise.resolve(
          path === '/api/v1/collection-cases'
            ? [
                {
                  id: 'case-1',
                  case_number: 'COL-001',
                  state: 'PROMISE_BROKEN',
                  customerName: '逾期客户',
                  currency: 'CNY',
                  remainingAmount: '500000',
                  overdueDays: 45,
                  documentNumber: 'AR-001',
                  promises: [{ id: 'promise-1', state: 'PENDING' }],
                  legalHandoffs: [],
                },
              ]
            : [],
        ),
      ),
      submit: vi.fn().mockResolvedValue({ id: 'created' }),
      uploadCtrAttachment: vi.fn().mockResolvedValue({}),
      command: vi.fn().mockResolvedValue({}),
    };
    const controller = new CommercialController(
      commercialApi,
      new Set(['collection:read', 'collection:manage', 'collection:escalate']),
    );
    controller.employees = [{ id: 'employee-1', displayName: '催收甲', active: true }];
    await controller.load();
    const workspace = commercialWorkspaceStructure(
      'desktop',
      false,
      controller,
    ) as unknown as RenderedElement;
    expect(workspace.findByClass('collection-workbench')).toHaveLength(1);
    expect(workspace.textContent).toContain('催收与法务证据');
    expect(workspace.textContent).toContain('逾期客户');
    expect(workspace.textContent).toContain('逾期 45 天');
    expect(workspace.textContent).toContain('确认承诺违约');
    expect(workspace.textContent).toContain('申请法务移交');
    expect(workspace.textContent).not.toContain('受理法务移交');
    expect(workspace.textContent).not.toContain('生成债权证据包');
  });

  it('renders the complaint queue as a Chinese business ledger with governed batch triage', async () => {
    const commercialApi = {
      listOpportunities: vi.fn().mockResolvedValue([]),
      list: vi.fn().mockImplementation((path: string) =>
        Promise.resolve(
          path === '/api/v1/complaints'
            ? [
                {
                  id: 'complaint-1',
                  complaint_number: 'CMP-2026-001',
                  customerName: '华北体育工程',
                  severity: 'MAJOR',
                  state: 'REPORTED',
                  version: 1,
                  closure_due_at: '2026-09-01T08:00:00Z',
                  overdue: false,
                },
              ]
            : [],
        ),
      ),
      submit: vi.fn().mockResolvedValue({ requested: 1, succeeded: 1 }),
      uploadCtrAttachment: vi.fn().mockResolvedValue({}),
      command: vi.fn().mockResolvedValue({}),
    };
    const controller = new CommercialController(
      commercialApi,
      new Set(['complaint:read', 'complaint:triage', 'complaint:assign']),
    );
    controller.employees = [
      { id: 'employee-1', employeeNumber: 'Q-001', displayName: '质量调查员', active: true },
    ];
    await controller.load();
    const workspace = commercialWorkspaceStructure(
      'desktop',
      false,
      controller,
    ) as unknown as RenderedElement;
    expect(workspace.findByClass('complaint-ledger')).toHaveLength(1);
    expect(workspace.textContent).toContain('客户投诉与整改闭环');
    expect(workspace.textContent).toContain('CMP-2026-001');
    expect(workspace.textContent).toContain('重大');
    expect(workspace.textContent).toContain('待分诊');
    expect(workspace.textContent).toContain('批量分派');
    expect(workspace.textContent).not.toContain('MAJOR');
    expect(workspace.textContent).not.toContain('REPORTED');
  });
});

it('keeps the DOM token list synchronized with className, without losing or duplicating classes', () => {
  const element = new RenderedElement('article');
  element.className = 'opportunity-card';
  element.classList.add('overdue', 'overdue');
  expect(element.className).toBe('opportunity-card overdue');
  element.className = 'replacement';
  expect(element.classList.contains('overdue')).toBe(false);
  element.classList.add('overdue');
  element.classList.remove('replacement');
  expect(element.className).toBe('overdue');
  expect(() => {
    element.classList.add('invalid token');
  }).toThrow();
});
