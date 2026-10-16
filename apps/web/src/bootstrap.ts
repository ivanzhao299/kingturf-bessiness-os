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
import { appendOpportunityView } from './commercial/opportunity-view';
import { appendCtrView } from './commercial/ctr-view';
import { appendSolutionView } from './commercial/solution-view';
import { appendCostView } from './commercial/cost-view';
import { appendPolicyView } from './commercial/policy-view';
import { appendQuoteView } from './commercial/quote-view';
import { appendCreditView } from './commercial/credit-view';
import { appendContractView } from './commercial/contract-view';
import type { CommercialPermission } from './commercial/permissions';
import { isCommercialPermission } from './commercial/permissions';
export { isCommercialPermission } from './commercial/permissions';
import { appendProductionOrdersView } from './commercial/production-orders-view';
import { appendProductionCostView } from './commercial/production-cost-view';
import { appendShipmentsView } from './commercial/shipments-view';
import { appendSalesOrdersView } from './commercial/sales-orders-view';
import { appendOrder360Content } from './commercial/order360-view';
import { appendReceivablesView } from './commercial/receivables-view';
import { appendCollectionsView } from './commercial/collections-view';
import { appendPaymentsView } from './commercial/payments-view';
import { appendCommissionView } from './commercial/commission-view';
import { appendRiskView } from './commercial/risk-view';
import { appendManufacturingView } from './commercial/manufacturing-view';
import { appendProcurementView } from './commercial/procurement-view';
import { appendMrpView } from './commercial/mrp-view';
import { appendQualityView } from './commercial/quality-view';
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

export const BUSINESS_DOCUMENT_TEMPLATES: readonly BusinessDocumentTemplate[] = [
  {
    name: '技术需求确认书',
    description: '冻结场景、产品参数、工程条件与验收标准',
    file: '01-人造草坪项目技术需求确认书.docx',
    routes: ['opportunities', 'technical-requirements'],
  },
  {
    name: '产品技术规格书',
    description: '产品结构、批次检验、储运与订单确认',
    file: '02-体育用人造草产品技术规格书.docx',
    routes: ['technical-requirements', 'technical-solutions'],
  },
  {
    name: '采购询价及比价文件',
    description: '采购清单、供应商响应、比价与定标',
    file: '03-采购询价及比价文件.docx',
    routes: ['procurement'],
  },
  {
    name: '采购合同',
    description: '质量追溯、交付验收、付款和违约条款',
    file: '04-采购合同模板.docx',
    routes: ['procurement'],
  },
  {
    name: '销售合同',
    description: '技术附件、价款、交付、质保和争议条款',
    file: '05-销售合同模板.docx',
    routes: ['contracts'],
  },
  {
    name: '成品检验与项目验收单',
    description: '批次检验、验收判定与不合格处置',
    file: '06-成品检验与项目验收单.docx',
    routes: ['quality-inspection', 'shipments'],
  },
  {
    name: '发货到货与签收确认单',
    description: '卷号批次、承运、到货异常和签收',
    file: '07-发货到货与签收确认单.docx',
    routes: ['shipments', 'order-360'],
  },
  {
    name: '产品规格与选型总表',
    description: '常用产品族、型号、参数与适用边界',
    file: '08-常用产品规格与选型总表.docx',
    routes: ['opportunities', 'technical-requirements', 'technical-solutions', 'quotes'],
  },
  {
    name: '足球草系统规格书',
    description: '足球系统、填充、减震垫与测试要求',
    file: '09-足球用人造草系统规格书.docx',
    routes: ['technical-requirements', 'technical-solutions'],
  },
  {
    name: '中小学足球场规格书',
    description: '校园材料、环保、运动性能与施工追溯',
    file: '10-中小学足球场系统规格书.docx',
    routes: ['technical-requirements', 'technical-solutions'],
  },
  {
    name: '景观休闲草规格书',
    description: '景观系列、排水、阻燃与场景确认',
    file: '11-景观休闲人造草规格书.docx',
    routes: ['technical-requirements', 'technical-solutions'],
  },
  {
    name: '门球与多用途草规格书',
    description: '短草密度、填砂、球速和平整度',
    file: '12-门球及多用途短草规格书.docx',
    routes: ['technical-requirements', 'technical-solutions'],
  },
  {
    name: '项目正式报价单',
    description: '产品、辅材、运输施工、税率与交期',
    file: '13-项目正式报价单.docx',
    routes: ['quotes'],
  },
  {
    name: '合同评审记录',
    description: '法务、技术、质量、财务、产能和风险会签',
    file: '14-合同评审记录.docx',
    routes: ['credit-review', 'contracts'],
  },
  {
    name: '订单评审与交付启动单',
    description: '合同信用、技术冻结、物料和交付启动',
    file: '15-订单评审与交付启动单.docx',
    routes: ['sales-orders', 'order-360'],
  },
  {
    name: '标准BOM与用料核算表',
    description: '物料、标准用量、损耗和订单需求',
    file: '16-标准BOM与用料核算表.docx',
    routes: ['manufacturing-master', 'material-planning', 'production-orders'],
  },
  {
    name: '生产任务单',
    description: '色批、工艺、包装与实际生产记录',
    file: '17-生产任务单.docx',
    routes: ['production-orders'],
  },
  {
    name: '工艺流转卡',
    description: '备料至包装全过程追溯',
    file: '18-工艺流转卡.docx',
    routes: ['production-orders'],
  },
  {
    name: '原辅材料来料检验单',
    description: '原辅料批次接收和不合格控制',
    file: '19-原辅材料来料检验单.docx',
    routes: ['procurement', 'quality-inspection'],
  },
  {
    name: '生产首件检验单',
    description: '换型、换色、换料后的首件批准',
    file: '20-首件检验确认单.docx',
    routes: ['production-orders', 'quality-inspection'],
  },
  {
    name: '生产过程巡检记录',
    description: '草高、密度、色差、背胶和异常趋势',
    file: '21-过程巡检记录.docx',
    routes: ['production-orders', 'quality-inspection'],
  },
  {
    name: '成品入库与库位卡',
    description: '卷号、色批、面积、质量状态和库位',
    file: '22-成品入库与库位卡.docx',
    routes: ['production-orders', 'quality-inspection'],
  },
  {
    name: '装箱单与卷号清单',
    description: '订单、卷号、卷长、面积和装车追溯',
    file: '23-装箱单与卷号清单.docx',
    routes: ['shipments'],
  },
  {
    name: '铺装维护与质保手册',
    description: '铺装、使用、维护、报修和质保边界',
    file: '24-铺装维护与质保手册.docx',
    routes: ['contracts', 'shipments', 'order-360'],
  },
  {
    name: '投诉与不合格闭环单',
    description: '投诉、NCR、根因、措施和效果验证',
    file: '25-客户投诉与不合格闭环单.docx',
    routes: ['quality-inspection', 'business-risks'],
  },
] as const;

export const templatesForRoute = (route: AppRoute): readonly BusinessDocumentTemplate[] =>
  BUSINESS_DOCUMENT_TEMPLATES.filter((template) => template.routes.includes(route));

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

const recordValue = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};

const ctrRequirementFields = [
  ['application', '应用场景'],
  ['projectRegion', '项目地区'],
  ['performanceStandard', '执行标准'],
  ['pileHeightMm', '草高（mm）'],
  ['quantitySquareMeters', '预计面积（㎡）'],
  ['color', '颜色要求'],
  ['baseCondition', '场地基础'],
  ['drainageRequirement', '排水要求'],
  ['fireRating', '阻燃要求'],
  ['warrantyYears', '质保年限'],
  ['delivery', '交付要求'],
] as const;

const displayRequirement = (value: unknown): string =>
  typeof value === 'string' || typeof value === 'number' ? String(value) : '—';
const formValue = (value: unknown): string =>
  typeof value === 'string' || typeof value === 'number' ? String(value) : '';
const textValue = (value: unknown, fallback: string): string =>
  typeof value === 'string' || typeof value === 'number' ? String(value) : fallback;
const recordText = (
  record: Record<string, unknown>,
  camel: string,
  snake: string,
  fallback = '',
): string => textValue(record[camel] ?? record[snake], fallback);
export const inventoryLocationOption = (item: Record<string, unknown>) => ({
  value: textValue(item.id, ''),
  label: `${recordText(item, 'code', 'code')} · ${recordText(item, 'name', 'name')}`,
});
const decimalValue = (value: number): string =>
  String(Math.round((value + Number.EPSILON) * 1_000_000) / 1_000_000);
const currencyLabel = (value: unknown): string => {
  const code = textValue(value, 'CNY');
  return (
    {
      CNY: '人民币',
      USD: '美元',
      EUR: '欧元',
      GBP: '英镑',
      HKD: '港币',
    }[code] ?? code
  );
};
const displayMoney = (currency: unknown, value: unknown): string => {
  const code = textValue(currency, 'CNY');
  if (!/^[A-Z]{3}$/u.test(code)) return '金额不可见';
  const amount = Number(value);
  if (!Number.isFinite(amount)) return `${code} —`;
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: code,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
};

const BUSINESS_EVENT_LABELS: Readonly<Record<string, string>> = {
  CONTRACT_SIGNED: '合同已签署',
  PAYMENT_RECEIVED: '收到回款',
  OPPORTUNITY_CREATED: '商机已创建',
  QUOTE_ISSUED: '报价已签发',
  CREDIT_DECIDED: '信用审查已决策',
  ORDER_RELEASED: '订单已放行',
  AR_POSTED: '应收已过账',
  COMMISSION_ACCRUED: '佣金已计提',
  COMMISSION_FROZEN: '佣金已冻结',
  COMMISSION_RELEASED: '佣金已释放',
  COMMISSION_PAID: '佣金已支付',
  COMMISSION_CLAWED_BACK: '佣金已追回',
  RISK_EVALUATED: '风险评价已完成',
  RISK_TASK_OPEN: '风险任务已创建',
  RISK_TASK_ACKNOWLEDGED: '风险任务已确认',
  RISK_TASK_ESCALATED: '风险任务已升级',
  RISK_TASK_CLOSED: '风险任务已关闭',
  SHIPMENT_RELEASE_EXCEPTION_PENDING: '发货例外待审批',
  SHIPMENT_RELEASE_APPROVED: '发货例外已批准',
  SHIPMENT_RELEASE_REJECTED: '发货例外已驳回',
  SHIPMENT_RELEASE_RELEASED: '发货已放行',
  SHIPMENT_DISPATCHED: '货物已发运',
  SHIPMENT_DELIVERED: '货物已签收',
  COLLECTION_CASE_OPENED: '催收案件已建立',
  COLLECTION_FOLLOWUP_RECORDED: '已记录催收跟进',
  COLLECTION_PROMISE_CREATED: '已登记付款承诺',
  COLLECTION_PROMISE_BROKEN: '付款承诺已违约',
  COLLECTION_LEGAL_HANDOFF_REQUESTED: '已申请法务移交',
  COLLECTION_LEGAL_HANDOFF_ACCEPTED: '法务已受理',
  COLLECTION_LEGAL_HANDOFF_RETURNED: '法务已退回',
  LEGAL_HANDOFF_REQUESTED: '法务移交待受理',
  LEGAL_HANDOFF_ACCEPTED: '法务移交已受理',
  LEGAL_HANDOFF_RETURNED: '法务移交已退回',
  DEBT_EVIDENCE_READY: '债权证据包已就绪',
  DEBT_EVIDENCE_INCOMPLETE: '债权证据包不完整',
};

const BUSINESS_STATE_LABELS: Readonly<Record<string, string>> = {
  ACTIVE: '已启用',
  ACCEPTED: '已受理',
  ACCRUED: '已计提',
  ARCHIVED: '已归档',
  AWARDED: '已定标',
  BLACKLISTED: '已禁用',
  CALCULATED: '已核算',
  DRAFT: '草稿',
  OPEN: '待处理',
  CLAIMED: '已认领',
  COMPLETED: '已完成',
  COMPUTED: '已计算',
  CONVERTED: '已转化',
  CONTACTING: '联系中',
  ACKNOWLEDGED: '已确认',
  ESCALATED: '已升级',
  CLOSED: '已关闭',
  APPROVED: '已批准',
  CANCELLED: '已取消',
  DELIVERED: '已签收',
  DISPATCHED: '已发运',
  DISPOSITIONED: '已处置',
  DISQUALIFIED: '无效',
  EXCEPTION_PENDING: '例外待审批',
  FINAL: '已定稿',
  FROZEN: '已冻结',
  IN_PROGRESS: '进行中',
  INACTIVE: '已停用',
  ISSUE: '领料',
  ISSUED: '已签发',
  PAID: '已支付',
  PARTIALLY_PAID: '部分支付',
  PARTIALLY_RECEIVED: '部分收货',
  PENDING: '待处理',
  PENDING_APPROVAL: '待审批',
  POOL: '公海',
  PROMISE_BROKEN: '付款承诺已违约',
  PROPOSED: '待审批',
  PUBLISHED: '已发布',
  QUARANTINE: '待检隔离',
  QUALIFIED: '已确认',
  READY: '待执行',
  RECEIVED: '已收货',
  REJECTED: '已驳回',
  RELEASED: '已放行',
  REQUESTED: '待受理',
  SAMPLED: '已抽样',
  SIGNED: '已签署',
  UPLOADED: '已上传',
  OCR_PROCESSING: '识别中',
  OCR_REVIEW: '待人工复核',
  READY_TO_SIGN: '待发起签署',
  SIGNING: '签署中',
  DECLINED: '已拒签',
  SUBMITTED: '已提交',
  SUSPENDED: '已暂停',
  RETURN: '退料',
  RETURNED: '已退回',
  VOIDED: '已作废',
  LEGAL_ACCEPTED: '法务已受理',
  EXPIRED: '已过期',
  LOW: '低',
  MEDIUM: '中',
  HIGH: '高',
  CRITICAL: '严重',
};

export const businessEventLabel = (value: unknown): string => {
  const code = textValue(value, '业务事件');
  return BUSINESS_EVENT_LABELS[code] ?? BUSINESS_STATE_LABELS[code] ?? code;
};

export const businessEventDetailLabel = (eventType: unknown, value: unknown): string => {
  const type = textValue(eventType, '');
  const detail = textValue(value, '—');
  if (type === 'CREDIT_DECIDED') return BUSINESS_STATE_LABELS[detail] ?? detail;
  if (type === 'RISK_EVALUATED') {
    const [level, score] = detail.split('/', 2);
    const levelLabel = BUSINESS_STATE_LABELS[level ?? ''] ?? level ?? '未分级';
    return score ? `${levelLabel}风险 / ${score}分` : `${levelLabel}风险`;
  }
  return detail;
};

const RISK_RULE_LABELS: Readonly<Record<string, string>> = {
  LOW_MARGIN: '毛利率低于政策门槛',
  OVERDUE_AR: '存在逾期应收',
  CREDIT_EXPIRY: '信用审批临近或已经过期',
  CONTRACT_SIGNATURE: '合同签署证据不完整',
  ORDER_RELEASE_GATE: '订单放行条件未满足',
};

export const riskRuleLabel = (value: unknown): string => {
  const code = textValue(value, '风险规则');
  return RISK_RULE_LABELS[code] ?? code;
};

export const commissionNextAction = (state: unknown): string => {
  const code = textValue(state, 'ACCRUED');
  return (
    {
      ACCRUED: '待复核释放或冻结',
      FROZEN: '待满足条件后释放',
      RELEASED: '待登记支付',
      PAID: '已完成支付，可按凭证追回',
      CLAWED_BACK: '已完成追回',
      CANCELLED: '已取消，无后续操作',
    }[code] ?? '请核对当前状态'
  );
};

const SUPPLY_MODE_LABELS: Readonly<Record<string, string>> = {
  MAKE: '自制',
  BUY: '采购',
  PRODUCTION: '生产建议',
  PURCHASE: '采购建议',
};

const QUALITY_STAGE_LABELS: Readonly<Record<string, string>> = {
  INCOMING: '来料检验',
  IN_PROCESS: '过程检验',
  FINAL: '最终检验',
};

const COMPLAINT_STATE_LABELS: Readonly<Record<string, string>> = {
  REPORTED: '待分诊',
  TRIAGED: '已分诊',
  INVESTIGATING: '调查中',
  NCR_OPEN: '不合格处理中',
  CAPA_ACTIVE: '整改中',
  VERIFIED: '整改已验证',
  CLOSED: '已关闭',
  REJECTED: '已驳回',
};

const COMPLAINT_SEVERITY_LABELS: Readonly<Record<string, string>> = {
  LOW: '一般',
  MEDIUM: '较重',
  MAJOR: '重大',
  CRITICAL: '紧急',
};

const SHIPMENT_GATE_LABELS: Readonly<Record<string, string>> = {
  contract: '合同签署',
  credit: '客户信用',
  payment: '发货前收款',
  overdue: '逾期应收',
  orderLink: '订单来源',
  quality: '质量放行',
  production: '生产完工',
  cost: '成本核算',
  inventory: '可用库存',
};

export const supplyModeLabel = (value: unknown): string => {
  const code = textValue(value, '供应方式未设置');
  return SUPPLY_MODE_LABELS[code] ?? code;
};

export const qualityStageLabel = (value: unknown): string => {
  const code = textValue(value, '检验阶段未设置');
  return QUALITY_STAGE_LABELS[code] ?? code;
};

export const shipmentGateLabel = (value: unknown): string => {
  const code = textValue(value, '未知门禁');
  return SHIPMENT_GATE_LABELS[code] ?? code;
};

export const operationsNextAction = (
  domain: 'production' | 'cost' | 'mrp' | 'quality' | 'shipment',
  state: unknown,
): string => {
  const code = textValue(state, 'UNKNOWN');
  const actions: Readonly<Record<string, Readonly<Record<string, string>>>> = {
    production: {
      DRAFT: '待计划员下达工单',
      RELEASED: '待班组开工并按需领料',
      IN_PROGRESS: '待报工、成品入库并完工确认',
      COMPLETED: '待复核后关闭工单',
      CLOSED: '工单已闭环',
    },
    cost: {
      CALCULATED: '待成本审批人复核差异',
      APPROVED: '成本核算已闭环',
    },
    mrp: {
      PROPOSED: '待计划审批人决定',
      APPROVED: '待释放到采购或生产执行',
      RELEASED: '已进入采购或生产执行',
      REJECTED: '已驳回，需重新计算或调整需求',
    },
    quality: {
      OPEN: '待抽样并记录检验结果',
      SAMPLED: '待补齐结果并完成检验',
      COMPLETED: '待质量处置放行或拒收',
      DISPOSITIONED: '检验已处置，请核对批次放行结果',
      RELEASED: '批次已放行',
      REJECTED: '批次已拒收',
      CANCELLED: '检验已取消',
    },
    shipment: {
      EXCEPTION_PENDING: '待独立审批人复核门禁例外',
      READY: '门禁已通过，待仓库放行',
      APPROVED: '例外已批准，待仓库放行',
      RELEASED: '待登记承运发车与签收',
      REJECTED: '例外已驳回，不得发货',
    },
  };
  return actions[domain]?.[code] ?? '请核对当前状态和业务证据';
};

const businessStateLabel = (value: unknown, fallback = '状态受限'): string => {
  const code = textValue(value, fallback);
  return BUSINESS_STATE_LABELS[code] ?? code;
};

const CUSTOMER_STATE_LABELS: Readonly<Record<string, string>> = {
  PROSPECT: '潜在客户',
  ACTIVE: '合作客户',
  INACTIVE: '暂停合作',
  ARCHIVED: '已归档',
};

export const customerStateLabel = (value: unknown, fallback = '状态受限'): string => {
  const code = textValue(value, fallback);
  return CUSTOMER_STATE_LABELS[code] ?? businessStateLabel(code, fallback);
};

export const costMatrixRoleGuidance = (permissions: ReadonlySet<string>): string => {
  if (permissions.has('cost-matrix:manage'))
    return '成本测算岗位视图：异常模型优先，进入详情后维护因子、核验来源并重新核算。';
  if (permissions.has('quote:create'))
    return '报价编制岗位视图：优先选择已核算、已冻结且可追溯的成本决定。';
  if (permissions.has('procurement:manage'))
    return '采购岗位视图：重点核验采购合同、供应商报价和价格生效日期。';
  return '只读岗位视图：查看模型完整度、最近成本、报价引用和变更证据。';
};

export const costMatrixAuditLabel = (action: string): string =>
  ({
    'cost-matrix.created': '创建成本模型',
    'cost-matrix.factor-added': '添加成本因子',
    'cost-matrix.factor-updated': '更新成本因子',
    'cost-matrix.calculated': '执行成本核算',
    'cost-matrix.quote-cost-created': '冻结并提交报价成本',
  })[action] ?? action.replaceAll('-', ' ').replaceAll('.', ' · ');

function printIssuedQuote(quote: Record<string, unknown>): void {
  const popup = globalThis.open('', '_blank', 'noopener,noreferrer');
  if (!popup) throw new Error('浏览器阻止了报价打印窗口，请允许本站弹出窗口');
  popup.document.title = `${textValue(quote.quoteNumber, '金特夫报价')}-第${textValue(quote.revision, '1')}版`;
  const style = popup.document.createElement('style');
  style.textContent = `
    @page { size: A4; margin: 16mm 18mm; }
    * { box-sizing: border-box; }
    body { margin: 0; color: #263a31; font: 13px/1.55 -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif; }
    header { display: flex; justify-content: space-between; align-items: flex-start; color: #176846; }
    h1 { margin: 0; font-size: 28px; letter-spacing: .04em; }
    h2 { margin: 0; font-size: 24px; font-weight: 500; }
    .meta, table { width: 100%; border-collapse: collapse; margin-top: 22px; }
    th, td { padding: 9px 10px; border: 1px solid #dce5e0; text-align: left; }
    th { background: #176846; color: white; font-weight: 600; }
    .meta td:nth-child(odd) { width: 15%; background: #f2f6f4; }
    .money { text-align: right; }
    .totals { width: 48%; margin: 18px 0 0 auto; }
    .totals div { display: flex; justify-content: space-between; padding: 5px 0; }
    .grand { border-top: 2px solid #176846; color: #176846; font-size: 18px; }
    .pins { margin-top: 28px; padding: 14px; background: #f4f7f5; font-size: 10px; word-break: break-all; }
    footer { position: fixed; bottom: 0; width: 100%; border-top: 1px solid #dce5e0; padding-top: 7px; color: #71847a; font-size: 9px; }
  `;
  popup.document.head.append(style);
  const body = popup.document.body;
  const header = popup.document.createElement('header');
  const brand = popup.document.createElement('div');
  brand.innerHTML = '<h1>金特夫</h1><small>企业经营管理系统</small>';
  const title = popup.document.createElement('h2');
  title.textContent = '正式报价单';
  header.append(brand, title);
  const metadata = popup.document.createElement('table');
  metadata.className = 'meta';
  const metadataRow = popup.document.createElement('tr');
  for (const value of [
    '报价编号',
    textValue(quote.quoteNumber, '—'),
    '版本 / 状态',
    `第 ${textValue(quote.revision, '1')} 版 / ${businessStateLabel(textValue(quote.status, 'ISSUED'))}`,
  ]) {
    const cell = popup.document.createElement('td');
    cell.textContent = value;
    metadataRow.append(cell);
  }
  metadata.append(metadataRow);
  const heading = popup.document.createElement('h3');
  heading.textContent = '报价明细';
  const table = popup.document.createElement('table');
  const tableHead = popup.document.createElement('tr');
  for (const label of ['序号', '产品 / 服务', '数量', '单位', '单价', '金额']) {
    const cell = popup.document.createElement('th');
    cell.textContent = label;
    tableHead.append(cell);
  }
  table.append(tableHead);
  const lines = Array.isArray(quote.lines) ? quote.lines : [];
  lines.forEach((line, index) => {
    const item = recordValue(line);
    const row = popup.document.createElement('tr');
    for (const value of [
      String(index + 1),
      textValue(item.description, '报价行'),
      textValue(item.quantity, '—'),
      textValue(item.unit_code, ''),
      textValue(item.unit_price, '—'),
      textValue(item.total, '—'),
    ]) {
      const cell = popup.document.createElement('td');
      cell.textContent = value;
      row.append(cell);
    }
    table.append(row);
  });
  const totals = popup.document.createElement('section');
  totals.className = 'totals';
  for (const [label, value, className] of [
    ['报价小计', textValue(quote.subtotal, '—'), ''],
    ['整单折扣', `- ${textValue(quote.discount, '0')}`, ''],
    ['报价总额', textValue(quote.total, '—'), 'grand'],
    [
      '预计毛利',
      `${textValue(quote.margin, '—')} (${String(Number(quote.marginBasisPoints ?? 0) / 100)}%)`,
      '',
    ],
  ] as const) {
    const row = popup.document.createElement('div');
    row.className = className;
    const labelNode = popup.document.createElement('span');
    labelNode.textContent = label;
    const valueNode = popup.document.createElement('strong');
    valueNode.textContent = `${textValue(quote.currency, '')} ${value}`;
    row.append(labelNode, valueNode);
    totals.append(row);
  }
  const pins = popup.document.createElement('section');
  pins.className = 'pins';
  pins.textContent = `版本证据：技术需求 ${textValue(quote.ctrVersionId, '')} · 技术方案 ${textValue(quote.technicalSolutionRevisionId, '')} · 成本 ${textValue(quote.costDecisionId, '')} · 政策 ${textValue(quote.policyVersionId, '')} · 签发快照 ${textValue(quote.issuedSnapshotHash, '')}`;
  const footer = popup.document.createElement('footer');
  footer.textContent = '金特夫 KingTurf · 系统签发报价 · 签发版本只读';
  body.append(header, metadata, heading, table, totals, pins, footer);
  popup.focus();
  popup.print();
}

export function technicalSolutionOpportunityId(
  ctrs: readonly Record<string, unknown>[],
  ctrVersionId: string,
): string {
  const ctr = ctrs.find((item) => item.id === ctrVersionId && item.status === 'APPROVED');
  if (!ctr || typeof ctr.opportunityId !== 'string' || ctr.opportunityId.length === 0)
    throw new Error('所选技术需求单不可用或缺少关联商机');
  return ctr.opportunityId;
}

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

export type ContractOrderReadinessStep = Readonly<{
  key: 'quote' | 'credit' | 'contract' | 'order';
  label: string;
  count: number;
  state: 'complete' | 'current' | 'blocked';
}>;
export function contractOrderReadiness(
  quotes: readonly Record<string, unknown>[],
  decisions: readonly Record<string, unknown>[],
  contracts: readonly Record<string, unknown>[],
  orders: readonly Record<string, unknown>[],
): readonly ContractOrderReadinessStep[] {
  const counts = [
    quotes.filter((item) => item.status === 'ISSUED' && typeof item.issuedSnapshotId === 'string')
      .length,
    decisions.filter(
      (item) => recordText(item, 'effectiveStatus', 'effective_status') === 'APPROVED',
    ).length,
    contracts.filter(
      (item) =>
        recordText(item, 'effectiveStatus', 'effectiveStatus') === 'SIGNED' &&
        Boolean(recordText(item, 'signatureEvidenceId', 'signature_evidence_id')),
    ).length,
    orders.length,
  ] as const;
  const firstMissing = counts.findIndex((count) => count === 0);
  return (['quote', 'credit', 'contract', 'order'] as const).map((key, index) => {
    const count = counts[index] ?? 0;
    return {
      key,
      label: ['已签发报价', '有效信用', '已签合同', '已释放订单'][index] ?? key,
      count,
      state:
        count > 0
          ? 'complete'
          : index === (firstMissing === -1 ? counts.length - 1 : firstMissing)
            ? 'current'
            : 'blocked',
    };
  });
}

export type OpportunityPipelineSummary = Readonly<{
  active: number;
  overdue: number;
  closingSoon: number;
  customerMissing: number;
}>;
export function opportunityPipelineSummary(
  opportunities: readonly Opportunity[],
  today = new Date().toISOString().slice(0, 10),
): OpportunityPipelineSummary {
  const active = opportunities.filter((item) => !['WON', 'LOST'].includes(item.status ?? 'OPEN'));
  const horizon = new Date(`${today}T00:00:00.000Z`);
  horizon.setUTCDate(horizon.getUTCDate() + 30);
  const horizonDate = horizon.toISOString().slice(0, 10);
  return {
    active: active.length,
    overdue: active.filter(
      (item) =>
        Boolean(item.expectedCloseDate) && String(item.expectedCloseDate).slice(0, 10) < today,
    ).length,
    closingSoon: active.filter((item) => {
      const date = item.expectedCloseDate?.slice(0, 10);
      return Boolean(date && date >= today && date <= horizonDate);
    }).length,
    customerMissing: active.filter((item) => !item.customerId).length,
  };
}

export type QuoteWorkflowReadinessStep = Readonly<{
  key: 'ctr' | 'solution' | 'cost' | 'policy' | 'quote';
  label: string;
  count: number;
  state: 'complete' | 'current' | 'blocked';
}>;
export function quoteWorkflowReadiness(
  ctrs: readonly Record<string, unknown>[],
  solutions: readonly Record<string, unknown>[],
  costs: readonly Record<string, unknown>[],
  policies: readonly Record<string, unknown>[],
  quotes: readonly Record<string, unknown>[],
): readonly QuoteWorkflowReadinessStep[] {
  const counts = [
    ctrs.filter((item) => item.status === 'APPROVED').length,
    solutions.filter((item) => item.status === 'FINAL').length,
    costs.length,
    policies.filter((item) => item.status === 'PUBLISHED').length,
    quotes.length,
  ] as const;
  const firstMissing = counts.findIndex((count) => count === 0);
  return (['ctr', 'solution', 'cost', 'policy', 'quote'] as const).map((key, index) => {
    const count = counts[index] ?? 0;
    return {
      key,
      label: ['已批准技术需求', '定稿方案', '成本决策', '已发布政策', '报价版本'][index] ?? key,
      count,
      state:
        count > 0
          ? 'complete'
          : index === (firstMissing === -1 ? counts.length - 1 : firstMissing)
            ? 'current'
            : 'blocked',
    };
  });
}

export type CashRiskSummary = Readonly<{
  overdueReceivables: number;
  unappliedPayments: number;
  brokenPromises: number;
  legalPending: number;
}>;
export function cashRiskSummary(
  receivables: readonly Record<string, unknown>[],
  payments: readonly Record<string, unknown>[],
  collectionCases: readonly Record<string, unknown>[],
  today = new Date().toISOString().slice(0, 10),
): CashRiskSummary {
  const handoffs = collectionCases.flatMap((item) =>
    Array.isArray(item.legalHandoffs)
      ? item.legalHandoffs.filter(
          (handoff): handoff is Record<string, unknown> =>
            typeof handoff === 'object' && handoff !== null,
        )
      : [],
  );
  return {
    overdueReceivables: receivables.filter(
      (item) =>
        Number(recordText(item, 'remainingAmount', 'remaining_amount', '0')) > 0 &&
        recordText(item, 'dueAt', 'due_at').slice(0, 10) < today,
    ).length,
    unappliedPayments: payments.filter(
      (item) => Number(recordText(item, 'remainingAmount', 'remaining_amount', '0')) > 0,
    ).length,
    brokenPromises: collectionCases.filter(
      (item) => recordText(item, 'state', 'state') === 'PROMISE_BROKEN',
    ).length,
    legalPending: handoffs.filter((item) => recordText(item, 'state', 'state') === 'REQUESTED')
      .length,
  };
}

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
  if (
    controller &&
    ['quote:read', 'credit:read', 'contract:read', 'sales-order:read'].some((permission) =>
      permissions.has(permission as CommercialPermission),
    )
  ) {
    const flow = el('section', 'contract-order-readiness');
    flow.setAttribute('data-route-view', 'sales-orders');
    const heading = el('div', 'readiness-heading');
    heading.append(el('strong', '', '订单释放门禁'), el('span', '', '按当前可见业务数据计算'));
    flow.append(heading);
    const steps = el('ol', 'readiness-steps');
    const readiness = contractOrderReadiness(
      controller.views.get('/api/v1/quotes') ?? [],
      controller.views.get('/api/v1/credit-decisions') ?? [],
      controller.views.get('/api/v1/contracts') ?? [],
      controller.views.get('/api/v1/sales-orders') ?? [],
    );
    for (const [index, step] of readiness.entries()) {
      const item = el('li', `readiness-step ${step.state}`);
      item.append(
        el('span', 'readiness-index', step.state === 'complete' ? '✓' : String(index + 1)),
        el('span', 'readiness-label', step.label),
        el('strong', 'readiness-count', String(step.count)),
      );
      steps.append(item);
    }
    flow.append(steps);
    workspace.append(flow);
  }
  if (
    controller &&
    ['cost:read', 'sales-policy:read', 'quote:read'].some((permission) =>
      permissions.has(permission as CommercialPermission),
    )
  ) {
    const flow = el('section', 'contract-order-readiness quote-readiness');
    flow.setAttribute('data-route-view', 'quotes');
    const heading = el('div', 'readiness-heading');
    heading.append(el('strong', '', '报价生成门禁'), el('span', '', '仅展示当前账号可见数据'));
    flow.append(heading);
    const steps = el('ol', 'readiness-steps five-steps');
    const readiness = quoteWorkflowReadiness(
      controller.views.get('/api/v1/ctrs') ?? [],
      controller.views.get('/api/v1/technical-solutions') ?? [],
      controller.views.get('/api/v1/cost-evaluations') ?? [],
      controller.views.get('/api/v1/sales-policies') ?? [],
      controller.views.get('/api/v1/quotes') ?? [],
    );
    for (const [index, step] of readiness.entries()) {
      const item = el('li', `readiness-step ${step.state}`);
      item.append(
        el('span', 'readiness-index', step.state === 'complete' ? '✓' : String(index + 1)),
        el('span', 'readiness-label', step.label),
        el('strong', 'readiness-count', String(step.count)),
      );
      steps.append(item);
    }
    flow.append(steps);
    workspace.append(flow);
  }
  if (
    controller &&
    ['ar:read', 'bank-payment:read', 'collection:read', 'legal-case:read'].some((permission) =>
      permissions.has(permission as CommercialPermission),
    )
  ) {
    const queue = el('section', 'cash-risk-summary');
    queue.setAttribute('data-route-view', 'receivables');
    const heading = el('div', 'readiness-heading');
    heading.append(el('strong', '', '今日资金与债权队列'), el('span', '', '异常优先'));
    queue.append(heading);
    const collectionRows = controller.views.get('/api/v1/collection-cases') ?? [];
    const legalQueueVisible =
      collectionRows.length > 0 &&
      collectionRows.every(
        (item) =>
          Array.isArray(item.legalHandoffs) &&
          item.legalHandoffs.every((handoff: unknown) =>
            ['REQUESTED', 'ACCEPTED', 'RETURNED'].includes(String(recordValue(handoff).state)),
          ),
      );
    const summary = cashRiskSummary(
      controller.views.get('/api/v1/ar-open-items') ?? [],
      controller.views.get('/api/v1/bank-payments') ?? [],
      collectionRows,
    );
    const grid = el('div', 'cash-risk-grid');
    for (const [label, value, tone] of [
      ['逾期应收', summary.overdueReceivables, 'danger'],
      ['待核销收款', summary.unappliedPayments, 'attention'],
      ['承诺已违约', summary.brokenPromises, 'danger'],
      ['法务待受理', summary.legalPending, 'warning'],
    ] as const) {
      if (label === '逾期应收' && !permissions.has('ar:read')) continue;
      if (label === '待核销收款' && !permissions.has('bank-payment:read')) continue;
      if (label === '承诺已违约' && !permissions.has('collection:read')) continue;
      if (
        label === '法务待受理' &&
        (!permissions.has('legal-case:read') ||
          !permissions.has('collection:read') ||
          !legalQueueVisible)
      )
        continue;
      const item = el('article', `pipeline-metric ${value > 0 ? tone : 'success'}`);
      item.append(el('span', '', label), el('strong', '', String(value)));
      grid.append(item);
    }
    queue.append(grid);
    workspace.append(queue);
  }
  if (controller?.dashboard && permissions.has('executive-dashboard:read')) {
    const dashboard = controller.dashboard,
      metrics = recordValue(dashboard.metrics),
      filters = recordValue(dashboard.filters),
      drilldowns = recordValue(dashboard.drilldowns);
    const panel = el('section', 'executive-dashboard');
    const heading = el('div', 'pipeline-heading');
    const copy = el('div');
    copy.append(
      el('p', 'eyebrow', '经营驾驶舱'),
      el('h2', '', '管理驾驶舱'),
      el(
        'p',
        '',
        `${currencyLabel(recordText(filters, 'currency', 'currency', 'CNY'))} · ${recordText(filters, 'from', 'from').slice(0, 10)} 至 ${recordText(filters, 'to', 'to').slice(0, 10)} · 刷新 ${recordText(dashboard, 'refreshedAt', 'refreshedAt').slice(0, 16).replace('T', ' ')}`,
      ),
    );
    heading.append(copy);
    panel.append(heading);
    const labels: Record<string, string> = {
      weightedForecast: '加权销售预测',
      bookedRevenue: '已签订单',
      grossMargin: '订单毛利',
      cashCollected: '已核销现金',
      openReceivable: '应收余额',
      overdueReceivable: '逾期应收',
      releasedOrders: '已释放订单',
      activeRisks: '活动风险',
      criticalRisks: '严重风险',
      commissionAccrued: '佣金计提',
    };
    const grid = el('div', 'metric-grid executive-metrics');
    for (const [key, raw] of Object.entries(metrics)) {
      const metric = recordValue(raw),
        card = el('article', `metric-card metric-${key}`);
      card.append(
        el('span', 'metric-label', labels[key] ?? key),
        el(
          'strong',
          'metric-value',
          `${recordText(metric, 'unit', 'unit')} ${recordText(metric, 'value', 'value', '0')}`,
        ),
        el(
          'p',
          'muted',
          `${recordText(metric, 'basis', 'basis')} · 来源 ${recordText(metric, 'source', 'source')}`,
        ),
      );
      grid.append(card);
    }
    panel.append(grid);
    const orders = Array.isArray(drilldowns.orders) ? drilldowns.orders.map(recordValue) : [],
      risks = Array.isArray(drilldowns.risks) ? drilldowns.risks.map(recordValue) : [];
    const details = el('div', 'dashboard-drilldowns'),
      orderList = el('article', 'dashboard-list'),
      riskList = el('article', 'dashboard-list');
    orderList.append(el('h3', '', '订单贡献明细'));
    for (const order of orders)
      orderList.append(
        el(
          'p',
          '',
          `${recordText(order, 'orderNumber', 'orderNumber')} · ${recordText(filters, 'currency', 'currency')} ${recordText(order, 'total', 'total')} · 毛利 ${recordText(order, 'margin', 'margin')}`,
        ),
      );
    riskList.append(el('h3', '', '风险责任明细'));
    for (const risk of risks)
      riskList.append(
        el(
          'p',
          '',
          `${businessStateLabel(recordText(risk, 'severity', 'severity'))} / ${recordText(risk, 'score', 'score')} 分 · ${businessStateLabel(recordText(risk, 'state', 'state'))} · 订单 ${recordText(risk, 'salesOrderId', 'salesOrderId').slice(0, 8)}`,
        ),
      );
    if (!risks.length) riskList.append(el('p', 'success-note', '当前无风险评价。'));
    details.append(orderList, riskList);
    panel.append(details);
    workspace.append(panel);
  }
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
  if (controller && permissions.has('production:read')) {
    appendProductionOrdersView({
      workspace,
      status,
      controller,
      permissions,
      ports: fulfillmentViewPorts,
    });
  }
  if (controller && permissions.has('manufacturing-cost:read')) {
    appendProductionCostView({
      workspace,
      status,
      controller,
      permissions,
      ports: fulfillmentViewPorts,
    });
  }
  if (controller && permissions.has('shipment:read')) {
    appendShipmentsView({
      workspace,
      status,
      controller,
      permissions,
      ports: fulfillmentViewPorts,
    });
  }
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
  if (controller && permissions.has('opportunity:read')) {
    appendOpportunityView(workspace, status, controller, permissions, salesViewPorts);
  }
  if (controller && permissions.has('ctr:read')) {
    appendCtrView(workspace, status, controller, permissions, salesViewPorts);
  }
  if (controller && permissions.has('technical-solution:read')) {
    appendSolutionView(workspace, status, controller, permissions, salesViewPorts);
  }
  if (
    controller &&
    (permissions.has('cost:read') ||
      permissions.has('cost-model:read') ||
      permissions.has('cost-matrix:read'))
  ) {
    appendCostView({ workspace, status, controller, permissions, ports: pricingViewPorts });
  }
  if (controller && permissions.has('sales-policy:read')) {
    appendPolicyView({ workspace, status, controller, permissions, ports: pricingViewPorts });
  }
  if (controller && permissions.has('quote:read')) {
    appendQuoteView({ workspace, status, controller, permissions, ports: pricingViewPorts });
  }
  if (controller && permissions.has('credit:read')) {
    appendCreditView({
      workspace,
      status,
      controller,
      permissions,
      ports: creditContractViewPorts,
    });
  }
  if (controller && permissions.has('contract:read')) {
    appendContractView({
      workspace,
      status,
      controller,
      permissions,
      ports: creditContractViewPorts,
    });
  }
  if (controller && permissions.has('sales-order:read')) {
    appendSalesOrdersView({
      workspace,
      status,
      controller,
      permissions,
      ports: fulfillmentViewPorts,
    });
  }
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
  if (controller && permissions.has('ar:read')) {
    appendReceivablesView({
      workspace,
      status,
      controller,
      permissions,
      ports: financeRiskViewPorts,
    });
  }
  if (controller && permissions.has('collection:read')) {
    appendCollectionsView({
      workspace,
      status,
      controller,
      permissions,
      ports: financeRiskViewPorts,
    });
  }
  if (controller && permissions.has('bank-payment:read')) {
    appendPaymentsView({ workspace, status, controller, permissions, ports: financeRiskViewPorts });
  }
  if (
    controller &&
    (permissions.has('commission:read') || permissions.has('commission-policy:read'))
  ) {
    appendCommissionView({
      workspace,
      status,
      controller,
      permissions,
      ports: financeRiskViewPorts,
    });
  }
  if (controller && (permissions.has('risk:read') || permissions.has('risk-policy:read'))) {
    appendRiskView(
      { workspace, status, controller, permissions, ports: financeRiskViewPorts },
      riskPolicyControls,
    );
  }
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
  if (
    controller &&
    (permissions.has('manufacturing-item:read') ||
      permissions.has('bom:read') ||
      permissions.has('routing:read'))
  ) {
    const panel = el('section', 'manufacturing-workbench');
    appendManufacturingView(
      {
        workspace,
        status,
        controller,
        permissions,
        ports: operationsViewPorts,
      },
      panel,
    );
  }
  if (
    controller &&
    (permissions.has('supplier:read') ||
      permissions.has('procurement:read') ||
      permissions.has('inventory:read') ||
      permissions.has('inventory:move'))
  ) {
    appendProcurementView({
      workspace,
      status,
      controller,
      permissions,
      ports: operationsViewPorts,
    });
  }
  if (controller && (permissions.has('mrp:read') || permissions.has('mrp-policy:read'))) {
    appendMrpView({ workspace, status, controller, permissions, ports: operationsViewPorts });
  }
  if (
    controller &&
    (permissions.has('quality-plan:read') ||
      permissions.has('quality:read') ||
      permissions.has('traceability:read') ||
      permissions.has('complaint:read'))
  ) {
    appendQualityView({ workspace, status, controller, permissions, ports: operationsViewPorts });
  }
  const commercialRouteTokens: Readonly<Record<string, string>> = {
    'executive-dashboard': 'overview',
    'pipeline-board': 'opportunities',
    'ctr-workbench': 'technical-requirements',
    'solution-workbench': 'technical-solutions',
    'cost-workbench': 'costing',
    'policy-workbench': 'sales-policies',
    'quote-workbench': 'quotes',
    'credit-workbench': 'credit-review',
    'contract-workbench': 'contracts',
    'order-workbench': 'sales-orders',
    'order-360-workbench': 'order-360',
    'ar-workbench': 'receivables',
    'collection-workbench': 'collections',
    'payment-workbench': 'payments',
    'commission-workbench': 'commissions',
    'risk-workbench': 'business-risks',
    'manufacturing-workbench': 'manufacturing-master',
    'procurement-workbench': 'procurement',
    'mrp-workbench': 'material-planning',
    'production-workbench': 'production-orders',
    'quality-workbench': 'quality-inspection',
    'shipment-workbench': 'shipments',
  };
  for (const child of Array.from(workspace.children)) {
    const routeTokens = Object.entries(commercialRouteTokens).find(([className]) =>
      child.className.split(' ').includes(className),
    )?.[1];
    if (routeTokens) child.setAttribute('data-route-view', routeTokens);
  }
  for (const [className, title, description, fields, action, path] of [
    [
      'opportunity-pipeline',
      '商机',
      '按负责人和阶段管理预计金额、赢率与成交日期',
      ['商机名称', '客户编号', '金额', '币种', '预计成交日'],
      '新建商机',
      '/api/v1/opportunities',
    ],
    [
      'ctr-revisions',
      '技术需求版本',
      '编辑需求草稿，提交后保留哈希、附件和审批证据',
      ['商机编号', '技术需求编号', '标题', '结构化需求'],
      '保存技术需求草稿',
      '/api/v1/ctrs',
    ],
    [
      'technical-solution-history',
      '技术方案',
      '方案修订精确引用已提交的技术需求版本',
      ['商机编号', '技术需求版本编号', '方案编码', '规格与假设'],
      '创建方案修订',
      '/api/v1/technical-solutions',
    ],
    [
      'cost-explanation',
      '成本说明',
      '使用固定币种、单位和已发布模型生成可解释成本决策',
      ['模型版本编号', '方案修订编号', '成本明细'],
      '计算成本',
      '/api/v1/cost-evaluations',
    ],
    [
      'policy-explanation',
      '销售政策',
      '显示命中规则、利润率边界、审批要求与原因',
      ['政策版本编号', '成本决策编号', '报价上下文'],
      '评估政策',
      '/api/v1/sales-policy-evaluations',
    ],
    [
      'quote-builder',
      '报价',
      '汇总行项目、折扣、成本、利润、有效期与全部版本引用',
      ['商机编号', '技术需求/方案/成本/政策引用', '报价明细', '有效期'],
      immutable ? '已签发（只读）' : '创建报价修订',
      '/api/v1/quotes',
    ],
    [
      'credit-review',
      '信用审查',
      '服务器从应收与未分配收款计算信用敞口，显示审批及到期状态',
      ['报价修订/快照', '敞口快照', '额度与有效期'],
      '评估信用',
      '/api/v1/credit-decisions',
    ],
    [
      'contract-evidence',
      '合同与签署证据',
      '显示精确报价引用、合同修订、签名回执和不可变哈希',
      ['报价快照', '合同内容', '签名回执'],
      '创建合同修订',
      '/api/v1/contracts',
    ],
    [
      'order-release',
      '订单释放',
      '仅使用已签发报价、有效信用决定与已签合同的精确引用',
      ['报价/信用/合同/签名编号', '订单行'],
      '释放订单',
      '/api/v1/sales-orders',
    ],
    [
      'ar-aging',
      '应收与账龄',
      '余额由过账与分配推导，不提供人工覆盖',
      ['客户', '原始金额', '到期日', '剩余余额'],
      '过账应收',
      '/api/v1/ar-open-items',
    ],
    [
      'payment-intake',
      '收款登记',
      '原始银行载荷、引用与哈希只读且不可删除',
      ['客户', '银行引用', '金额', '原始载荷'],
      '登记收款',
      '/api/v1/bank-payments',
    ],
    [
      'reconciliation',
      '核销',
      '按稳定顺序展示匹配解释、分配次序与剩余余额',
      ['收款余额', '开放项余额', '规范结果哈希'],
      '运行核销',
      '/api/v1/reconciliation-runs',
    ],
  ] as const) {
    if (
      controller &&
      [
        '/api/v1/opportunities',
        '/api/v1/ctrs',
        '/api/v1/technical-solutions',
        '/api/v1/cost-evaluations',
        '/api/v1/sales-policy-evaluations',
        '/api/v1/quotes',
        '/api/v1/credit-decisions',
        '/api/v1/contracts',
        '/api/v1/sales-orders',
        '/api/v1/ar-open-items',
        '/api/v1/bank-payments',
        '/api/v1/reconciliation-runs',
      ].includes(path)
    )
      continue;
    const requiredPermission = permittedPaths.get(path),
      canRead = Boolean(requiredPermission && permissions.has(requiredPermission[0])),
      canAct =
        (requiredPermission?.[1] !== undefined && permissions.has(requiredPermission[1])) ||
        (path === '/api/v1/ctrs' &&
          (permissions.has('ctr:submit') || permissions.has('ctr:approve'))) ||
        (path === '/api/v1/quotes' &&
          (permissions.has('quote:approve') || permissions.has('quote:issue')));
    if (controller && !canRead && !canAct) continue;
    const panel = document.createElement('section');
    panel.className = `commercial-panel ${className}`;
    const heading = document.createElement('h2');
    heading.textContent = title;
    const help = document.createElement('p');
    help.className = 'commercial-help';
    help.textContent = description;
    const form = document.createElement('form');
    form.className = 'commercial-form';
    const hint = document.createElement('p');
    hint.className = 'field-hint';
    hint.textContent = fields.join(' · ');
    const request = document.createElement('textarea');
    request.setAttribute('aria-label', `${title}高级配置请求`);
    request.placeholder = '{ }';
    request.disabled = immutable || Boolean(controller && !canAct);
    form.append(hint, request);
    const button = document.createElement('button');
    button.type = 'submit';
    button.disabled = request.disabled;
    button.textContent = action;
    form.append(button);
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      if (!controller) return;
      try {
        const parsed = JSON.parse(request.value || '{}') as unknown;
        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed))
          throw new Error('请求必须是键值对象格式');
        const payload = { ...(parsed as Record<string, unknown>) };
        const rootId = typeof payload.rootId === 'string' ? payload.rootId : null;
        delete payload.rootId;
        const target = (rootId ? commercialRevisionPath(className, rootId) : null) ?? path;
        setOperationStatus(status, 'loading', '正在提交，请勿重复操作…');
        button.disabled = true;
        button.textContent = '处理中…';
        void controller
          .submit(target, payload)
          .then(() => {
            setOperationStatus(status, 'success', controller.message);
            evidence.textContent = JSON.stringify(controller.revisionState, null, 2);
          })
          .catch((error: unknown) => {
            setOperationStatus(
              status,
              'error',
              error instanceof Error ? error.message : '操作失败，请稍后重试',
            );
          })
          .finally(() => {
            button.disabled = false;
            button.textContent = action;
          });
      } catch (error) {
        setOperationStatus(
          status,
          'error',
          error instanceof Error ? error.message : '请求格式无效',
        );
      }
    });
    const evidence = document.createElement('details');
    evidence.className = 'decision-evidence';
    const summary = document.createElement('summary');
    summary.textContent = '版本引用与决策证据';
    evidence.append(summary);
    const loaded = canRead ? controller?.views.get(path) : undefined;
    if (loaded) evidence.append(document.createTextNode(JSON.stringify(loaded, null, 2)));
    else if (controller && !canRead) evidence.hidden = true;
    if (className === 'ctr-revisions' && controller && !immutable) {
      const versionId = document.createElement('input');
      versionId.setAttribute('aria-label', '技术需求版本编号');
      const expectedCtrVersion = document.createElement('input');
      expectedCtrVersion.type = 'number';
      expectedCtrVersion.min = '1';
      expectedCtrVersion.value = '1';
      expectedCtrVersion.setAttribute('aria-label', '技术需求预期版本号');
      const submitCtr = document.createElement('button');
      submitCtr.type = 'button';
      submitCtr.textContent = '提交技术需求';
      submitCtr.hidden = !permissions.has('ctr:submit');
      submitCtr.addEventListener('click', () => {
        void controller.submit(`/api/v1/ctr-versions/${versionId.value}/submit`, {
          expectedVersion: Number(expectedCtrVersion.value),
        });
      });
      const approveCtr = document.createElement('button');
      approveCtr.type = 'button';
      approveCtr.textContent = '批准技术需求';
      approveCtr.hidden = !permissions.has('ctr:approve');
      approveCtr.addEventListener('click', () => {
        void controller.submit(`/api/v1/ctr-versions/${versionId.value}/decision`, {
          decision: 'APPROVED',
          reason: 'UI approval',
        });
      });
      panel.append(versionId, expectedCtrVersion, submitCtr, approveCtr);
    }
    if (className === 'quote-builder' && controller && !immutable) {
      const revisionId = document.createElement('input');
      revisionId.setAttribute('aria-label', '报价修订编号');
      const approve = document.createElement('button');
      approve.type = 'button';
      approve.textContent = '批准报价';
      approve.hidden = !permissions.has('quote:approve');
      approve.addEventListener('click', () => {
        void controller
          .quoteCommand(revisionId.value, 'approve', {
            decision: 'APPROVED',
            reason: 'UI approval',
          })
          .then(() => {
            status.textContent = controller.message;
          });
      });
      const issue = document.createElement('button');
      issue.type = 'button';
      issue.textContent = '签发报价';
      issue.hidden = !permissions.has('quote:issue');
      issue.addEventListener('click', () => {
        void controller.quoteCommand(revisionId.value, 'issue').then(() => {
          workspace.classList.add('immutable');
          request.disabled = true;
          button.disabled = true;
          status.textContent = controller.message;
        });
      });
      panel.append(revisionId, approve, issue);
    }
    panel.append(heading, help, form, evidence);
    workspace.append(panel);
  }
  const genericRouteTokens: Readonly<Record<string, string>> = {
    'opportunity-pipeline': 'opportunities',
    'ctr-revisions': 'technical-requirements',
    'technical-solution-history': 'technical-solutions',
    'cost-explanation': 'costing',
    'policy-explanation': 'sales-policies',
    'quote-builder': 'quotes',
    'credit-review': 'credit-review',
    'contract-evidence': 'contracts',
    'order-release': 'sales-orders',
    'ar-aging': 'receivables',
    'payment-intake': 'payments',
    reconciliation: 'payments',
  };
  for (const child of Array.from(workspace.children)) {
    const routeTokens = Object.entries(genericRouteTokens).find(([className]) =>
      child.className.split(' ').includes(className),
    )?.[1];
    if (routeTokens) child.setAttribute('data-route-view', routeTokens);
  }
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

type RegisterProfile = {
  label: string;
  headers: readonly [string, string, string, string];
  detailLabels: readonly string[];
};

const registerProfile = (list: HTMLElement): RegisterProfile => {
  if (list.closest('.shipment-workbench'))
    return {
      label: '交付任务台账',
      headers: ['发运单与客户', '交付状态与数量', '物流与签收节点', '操作'],
      detailLabels: ['发运信息', '交付状态', '数量与物流', '签收与证据'],
    };
  if (list.classList.contains('solution-list'))
    return {
      label: '技术方案台账',
      headers: ['方案与版本', '评审状态', '关联技术需求', '操作'],
      detailLabels: ['方案信息', '评审状态', '关联技术需求', '规格与依据'],
    };
  if (list.classList.contains('quote-list'))
    return {
      label: '报价台账',
      headers: ['报价与版本', '报价状态与金额', '客户与有效期', '操作'],
      detailLabels: ['报价信息', '状态与金额', '客户与有效期', '核价依据'],
    };
  if (list.classList.contains('order-360-list'))
    return {
      label: '订单履约台账',
      headers: ['订单与客户', '履约状态与金额', '交付与责任', '操作'],
      detailLabels: ['订单信息', '履约状态', '金额与信用', '交付与责任'],
    };
  if (list.classList.contains('collection-case-list'))
    return {
      label: '催收案件台账',
      headers: ['案件与客户', '催收状态与逾期', '责任人与节点', '操作'],
      detailLabels: ['案件信息', '催收状态', '逾期与金额', '责任与下一节点'],
    };
  if (list.classList.contains('commission-list'))
    return {
      label: '佣金台账',
      headers: ['佣金单与人员', '核算状态与金额', '归属与期间', '操作'],
      detailLabels: ['佣金信息', '核算状态', '金额与期间', '归属依据'],
    };
  if (list.classList.contains('qtc-list'))
    return {
      label: '合同与应收台账',
      headers: ['业务单据', '状态与金额', '客户与账期', '操作'],
      detailLabels: ['单据信息', '业务状态', '金额与账期', '客户与责任'],
    };
  if (list.classList.contains('risk-list'))
    return {
      label: '经营风险台账',
      headers: ['风险事项', '风险等级与敞口', '责任人与期限', '操作'],
      detailLabels: ['风险事项', '等级与敞口', '责任与期限', '处置进展'],
    };
  if (list.classList.contains('production-order-grid') && !list.classList.contains('shipment-grid'))
    return {
      label: '生产工单台账',
      headers: ['工单与产品', '生产状态与数量', '计划与车间', '操作'],
      detailLabels: ['工单信息', '生产状态', '计划数量与日期', '工序与物料证据'],
    };
  if (list.classList.contains('mrp-proposal-grid'))
    return {
      label: '物料建议台账',
      headers: ['物料与建议类型', '建议状态与数量', '需求日期与依据', '操作'],
      detailLabels: ['物料建议', '建议状态', '数量与日期', '净需求计算依据'],
    };
  return {
    label: '业务决策台账',
    headers: ['业务事项', '状态与结果', '依据与责任', '操作'],
    detailLabels: ['业务事项', '当前状态', '结果与依据', '责任与下一步'],
  };
};

function installWorkspaceListTools(shell: HTMLElement): void {
  let detailDrawer: HTMLElement | undefined;
  const showDrawer = (profile: RegisterProfile, title: string, content: HTMLElement) => {
    if (!detailDrawer) {
      detailDrawer = el('aside', 'record-detail-drawer');
      detailDrawer.setAttribute('aria-label', '业务记录详情');
      detailDrawer.setAttribute('aria-live', 'polite');
      shell.append(detailDrawer);
    }
    const close = el('button', 'record-detail-close', '关闭');
    close.type = 'button';
    close.setAttribute('aria-label', '关闭业务记录详情');
    close.addEventListener('click', () => {
      if (detailDrawer) detailDrawer.hidden = true;
    });
    const head = el('div', 'record-detail-head');
    const identity = el('div');
    identity.append(el('p', 'eyebrow', profile.label), el('h2', '', title));
    head.append(identity, close);
    detailDrawer.replaceChildren(head, content);
    detailDrawer.hidden = false;
    close.focus();
  };
  const openDetailDrawer = (item: HTMLElement, profile: RegisterProfile) => {
    const name =
      item.querySelector<HTMLElement>('strong, h3, h4')?.textContent.trim() ?? '业务记录';
    const statuses = Array.from(
      item.querySelectorAll<HTMLElement>('.status-badge, .ctr-state, .version-pin'),
    )
      .map((entry) => entry.textContent.trim())
      .filter(Boolean);
    const status = el('div', 'record-detail-status');
    status.append(
      el('span', 'record-detail-label', '当前状态'),
      el('strong', '', statuses.join('、') || '状态未标记'),
    );
    const summary = el('section', 'record-detail-summary');
    summary.append(el('h3', '', '关键业务字段'));
    const fields = el('dl', 'record-detail-fields');
    const segments = Array.from(item.children)
      .filter(
        (entry): entry is HTMLElement =>
          entry instanceof HTMLElement &&
          !entry.matches('button, .quality-actions, .ctr-actions') &&
          entry.textContent.trim().length > 0,
      )
      .map((entry) => entry.textContent.replace(/\s+/gu, ' ').trim());
    const values = segments.length > 1 ? segments : [item.textContent.replace(/\s+/gu, ' ').trim()];
    for (const [index, value] of values.slice(0, profile.detailLabels.length).entries()) {
      fields.append(
        el('dt', '', profile.detailLabels[index] ?? `业务字段 ${String(index + 1)}`),
        el('dd', '', value),
      );
    }
    summary.append(fields);
    const note = el(
      'p',
      'record-detail-note',
      '此处展示当前权限范围内的只读业务快照；业务操作仍在原记录行中执行。',
    );
    const body = el('div', 'record-detail-body');
    body.append(status, summary, note);
    showDrawer(profile, name, body);
  };
  const selectors = [
    '.solution-list',
    '.decision-list',
    '.quote-list',
    '.qtc-list',
    '.order-360-list',
    '.risk-list',
    '.production-order-grid',
    '.mrp-proposal-grid',
    '.shipment-grid',
  ].join(',');
  for (const list of Array.from(shell.querySelectorAll<HTMLElement>(selectors))) {
    const sourceItems = Array.from(list.children).filter(
      (item): item is HTMLElement => item instanceof HTMLElement,
    );
    if (
      sourceItems.length === 0 ||
      sourceItems.every((item) => item.classList.contains('pipeline-empty')) ||
      list.dataset.listTools === 'true' ||
      !list.parentElement
    )
      continue;
    list.dataset.listTools = 'true';
    const profile = registerProfile(list);
    list.dataset.registerProfile = profile.label;
    list.classList.add('record-register');
    list.setAttribute('role', 'table');
    list.setAttribute('aria-label', profile.label);
    list.setAttribute('aria-rowcount', String(sourceItems.length));
    for (const item of sourceItems) {
      item.setAttribute('role', 'row');
      item.tabIndex = 0;
    }
    const header = el('div', 'record-register-head');
    header.setAttribute('role', 'row');
    for (const label of profile.headers) {
      const column = el('span', '', label);
      column.setAttribute('role', 'columnheader');
      header.append(column);
    }
    const tools = el('div', 'workspace-list-tools');
    const search = el('input', 'filter-search');
    search.type = 'search';
    search.placeholder = '在当前列表中搜索';
    search.setAttribute('aria-label', '在当前业务列表中搜索');
    const statuses = Array.from(
      new Set(
        sourceItems.flatMap((item) =>
          Array.from(item.querySelectorAll<HTMLElement>('.status-badge, .ctr-state, .version-pin'))
            .map((entry) => entry.textContent.trim())
            .filter(Boolean),
        ),
      ),
    );
    const statusFilter = el('select', 'filter-select register-status-filter');
    statusFilter.setAttribute('aria-label', '按业务状态筛选');
    const allStatuses = el('option', '', '全部状态');
    allStatuses.value = '';
    statusFilter.append(allStatuses);
    for (const status of statuses) {
      const option = el('option', '', status);
      option.value = status;
      statusFilter.append(option);
    }
    const attentionFilter = el('select', 'filter-select register-attention-filter');
    attentionFilter.setAttribute('aria-label', `筛选${profile.label}关注程度`);
    for (const [value, label] of [
      ['', '全部记录'],
      ['attention', '只看需关注'],
      ['actionable', '只看可操作'],
    ] as const) {
      const option = el('option', '', label);
      option.value = value;
      attentionFilter.append(option);
    }
    const dateFrom = el('input', 'filter-search register-range-filter');
    dateFrom.type = 'date';
    dateFrom.setAttribute('aria-label', `${profile.label}开始日期`);
    dateFrom.title = '开始日期';
    const dateTo = el('input', 'filter-search register-range-filter');
    dateTo.type = 'date';
    dateTo.setAttribute('aria-label', `${profile.label}结束日期`);
    dateTo.title = '结束日期';
    const amountFrom = el('input', 'filter-search register-range-filter');
    amountFrom.type = 'number';
    amountFrom.min = '0';
    amountFrom.step = '0.01';
    amountFrom.placeholder = '最低金额';
    amountFrom.setAttribute('aria-label', `${profile.label}最低金额`);
    const amountTo = el('input', 'filter-search register-range-filter');
    amountTo.type = 'number';
    amountTo.min = '0';
    amountTo.step = '0.01';
    amountTo.placeholder = '最高金额';
    amountTo.setAttribute('aria-label', `${profile.label}最高金额`);
    const count = el('span', 'workspace-list-count', `共 ${String(sourceItems.length)} 条`);
    const sort = el('select', 'filter-select register-sort');
    sort.setAttribute('aria-label', `设置${profile.label}排序方式`);
    for (const [value, label] of [
      ['business', '业务优先'],
      ['name', '按名称排序'],
      ['status', '按状态排序'],
    ] as const) {
      const option = el('option', '', label);
      option.value = value;
      sort.append(option);
    }
    const density = el('button', 'secondary compact-action', '紧凑显示');
    density.type = 'button';
    const fieldMode = el('select', 'filter-select register-field-mode');
    fieldMode.setAttribute('aria-label', `设置${profile.label}字段显示范围`);
    for (const [value, label] of [
      ['complete', '完整字段'],
      ['key', '重点字段'],
    ] as const) {
      const option = el('option', '', label);
      option.value = value;
      fieldMode.append(option);
    }
    const saveView = el('button', 'secondary compact-action', '保存视图');
    saveView.type = 'button';
    const exportList = el('button', 'secondary compact-action', '导出当前结果');
    exportList.type = 'button';
    const inspect = el('button', 'secondary compact-action', '查看选中详情');
    inspect.type = 'button';
    inspect.disabled = true;
    const selectedCount = el('span', 'workspace-list-count register-selection-count', '已选 0 条');
    const bulkInspect = el('button', 'secondary compact-action', '查看批量摘要');
    bulkInspect.type = 'button';
    bulkInspect.disabled = true;
    const exportSelected = el('button', 'secondary compact-action', '导出已选');
    exportSelected.type = 'button';
    exportSelected.disabled = true;
    const reset = el('button', 'secondary compact-action', '重置');
    reset.type = 'button';
    const pager = el('div', 'record-register-pager');
    const previous = el('button', 'secondary compact-action', '上一页');
    previous.type = 'button';
    const pageState = el('span', 'workspace-list-count');
    const next = el('button', 'secondary compact-action', '下一页');
    next.type = 'button';
    pager.append(previous, pageState, next);
    const pageSize = 10;
    const viewKey = `kingturf.register-view.${list.classList.item(0) ?? 'records'}`;
    let page = 1;
    let filteredItems = [...sourceItems];
    let sortMode: 'business' | 'name' | 'status' = 'business';
    let compact = false;
    let fields: 'complete' | 'key' = 'complete';
    let selectedItem: HTMLElement | undefined;
    const selectedItems = new Set<HTMLElement>();
    const selectAll = document.createElement('input');
    selectAll.type = 'checkbox';
    selectAll.className = 'record-select record-select-all';
    selectAll.setAttribute('aria-label', `全选当前${profile.label}结果`);
    header.prepend(selectAll);
    const recordName = (item: HTMLElement) =>
      item.querySelector<HTMLElement>('strong, h3, h4')?.textContent.trim() ?? '业务记录';
    const recordStatus = (item: HTMLElement) =>
      Array.from(item.querySelectorAll<HTMLElement>('.status-badge, .ctr-state, .version-pin'))
        .map((entry) => entry.textContent.trim())
        .filter(Boolean)
        .join('、');
    const recordDates = (item: HTMLElement) =>
      Array.from(item.textContent.matchAll(/\b(20\d{2}-\d{2}-\d{2})\b/gu), (match) =>
        Date.parse(`${match[1] ?? ''}T00:00:00Z`),
      ).filter(Number.isFinite);
    const recordAmounts = (item: HTMLElement) => {
      const text = item.textContent.replace(/,/gu, '');
      const values = [
        ...Array.from(text.matchAll(/(?:CNY|RMB|人民币|¥|￥)\s*(-?\d+(?:\.\d+)?)/giu), (match) =>
          Number(match[1]),
        ),
        ...Array.from(
          text.matchAll(
            /(?:金额|货值|应收|回款|到账|余额|成本|报价|合同额|差异)\s*[：:]?\s*(-?\d+(?:\.\d+)?)/gu,
          ),
          (match) => Number(match[1]),
        ),
      ];
      return values.filter(Number.isFinite);
    };
    const updateFieldMode = () => {
      list.classList.toggle('is-key-fields', fields === 'key');
      for (const item of sourceItems) {
        const details = Array.from(item.children).filter(
          (child): child is HTMLElement =>
            child instanceof HTMLElement &&
            !child.matches(
              '.record-select, button, .quality-actions, .ctr-actions, .status-badge, .ctr-state, .version-pin, .order-360-detail, [role="status"]',
            ),
        );
        details.forEach((child, index) => {
          child.classList.toggle('register-optional-field', index >= 3);
        });
      }
      fieldMode.value = fields;
    };
    const updateSelection = () => {
      selectedCount.textContent = `已选 ${String(selectedItems.size)} 条`;
      bulkInspect.disabled = selectedItems.size === 0;
      exportSelected.disabled = selectedItems.size === 0;
      const visible = filteredItems.slice((page - 1) * pageSize, page * pageSize);
      selectAll.checked = visible.length > 0 && visible.every((item) => selectedItems.has(item));
      selectAll.indeterminate =
        visible.some((item) => selectedItems.has(item)) && !selectAll.checked;
    };
    const renderItems = () => {
      const pageCount = Math.max(1, Math.ceil(filteredItems.length / pageSize));
      page = Math.min(Math.max(page, 1), pageCount);
      const start = (page - 1) * pageSize;
      list.replaceChildren(header, ...filteredItems.slice(start, start + pageSize));
      count.textContent = `显示 ${String(filteredItems.length)} / ${String(sourceItems.length)} 条`;
      pageState.textContent = `第 ${String(page)} / ${String(pageCount)} 页`;
      previous.disabled = page <= 1;
      next.disabled = page >= pageCount;
      pager.hidden = filteredItems.length <= pageSize;
      updateSelection();
    };
    const applySearch = () => {
      const query = search.value.trim().toLocaleLowerCase('zh-CN');
      const fromDate = dateFrom.value ? Date.parse(`${dateFrom.value}T00:00:00Z`) : undefined;
      const toDate = dateTo.value ? Date.parse(`${dateTo.value}T23:59:59Z`) : undefined;
      const minimumAmount = amountFrom.value.length > 0 ? Number(amountFrom.value) : undefined;
      const maximumAmount = amountTo.value.length > 0 ? Number(amountTo.value) : undefined;
      filteredItems = sourceItems.filter((item) => {
        const dates = recordDates(item);
        const amounts = recordAmounts(item);
        const dateMatches =
          fromDate === undefined && toDate === undefined
            ? true
            : dates.some(
                (date) =>
                  (fromDate === undefined || date >= fromDate) &&
                  (toDate === undefined || date <= toDate),
              );
        const amountMatches =
          minimumAmount === undefined && maximumAmount === undefined
            ? true
            : amounts.some(
                (amount) =>
                  (minimumAmount === undefined || amount >= minimumAmount) &&
                  (maximumAmount === undefined || amount <= maximumAmount),
              );
        return (
          (query.length === 0 || item.textContent.toLocaleLowerCase('zh-CN').includes(query)) &&
          (statusFilter.value.length === 0 ||
            Array.from(
              item.querySelectorAll<HTMLElement>('.status-badge, .ctr-state, .version-pin'),
            ).some((entry) => entry.textContent.trim() === statusFilter.value)) &&
          (attentionFilter.value.length === 0 ||
            (attentionFilter.value === 'attention'
              ? /逾期|驳回|未通过|隔离|待审|异常|冻结|退回/u.test(item.textContent)
              : item.querySelector('button:not(:disabled)') !== null)) &&
          dateMatches &&
          amountMatches
        );
      });
      if (sortMode === 'name')
        filteredItems.sort((left, right) =>
          left.textContent.localeCompare(right.textContent, 'zh-CN'),
        );
      if (sortMode === 'status')
        filteredItems.sort((left, right) => {
          const statusOf = (entry: HTMLElement) =>
            entry.querySelector<HTMLElement>('.status-badge, .ctr-state, .version-pin')
              ?.textContent ?? '';
          return statusOf(left).localeCompare(statusOf(right), 'zh-CN');
        });
      page = 1;
      renderItems();
    };
    search.addEventListener('input', applySearch);
    statusFilter.addEventListener('change', applySearch);
    attentionFilter.addEventListener('change', applySearch);
    dateFrom.addEventListener('change', applySearch);
    dateTo.addEventListener('change', applySearch);
    amountFrom.addEventListener('input', applySearch);
    amountTo.addEventListener('input', applySearch);
    for (const item of sourceItems) {
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = 'record-select';
      checkbox.setAttribute('aria-label', `选择 ${recordName(item)}`);
      checkbox.addEventListener('change', () => {
        if (checkbox.checked) selectedItems.add(item);
        else selectedItems.delete(item);
        item.classList.toggle('is-bulk-selected', checkbox.checked);
        updateSelection();
      });
      item.prepend(checkbox);
      const selectItem = () => {
        selectedItem?.classList.remove('is-selected');
        selectedItem = item;
        item.classList.add('is-selected');
        inspect.disabled = false;
      };
      item.addEventListener('click', (event) => {
        const target = event.target;
        if (target instanceof Element && target.closest('button, input, select, textarea, a'))
          return;
        selectItem();
      });
      item.addEventListener('dblclick', () => {
        selectItem();
        openDetailDrawer(item, profile);
      });
      item.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' || event.target !== item) return;
        selectItem();
        openDetailDrawer(item, profile);
      });
    }
    selectAll.addEventListener('change', () => {
      const visible = filteredItems.slice((page - 1) * pageSize, page * pageSize);
      for (const item of visible) {
        const checkbox = item.querySelector<HTMLInputElement>('.record-select');
        if (selectAll.checked) selectedItems.add(item);
        else selectedItems.delete(item);
        if (checkbox) checkbox.checked = selectAll.checked;
        item.classList.toggle('is-bulk-selected', selectAll.checked);
      }
      updateSelection();
    });
    inspect.addEventListener('click', () => {
      if (selectedItem) openDetailDrawer(selectedItem, profile);
    });
    bulkInspect.addEventListener('click', () => {
      const body = el('div', 'bulk-summary');
      body.append(el('p', 'record-detail-note', '批量摘要仅用于核对，不会执行任何业务写操作。'));
      const listSummary = el('ul', 'bulk-summary-list');
      for (const item of selectedItems) {
        const row = el('li');
        row.append(
          el('strong', '', recordName(item)),
          el('span', '', recordStatus(item) || '状态未标记'),
        );
        listSummary.append(row);
      }
      body.append(listSummary);
      showDrawer(profile, `已选 ${String(selectedItems.size)} 条记录`, body);
    });
    sort.addEventListener('change', () => {
      sortMode = sort.value === 'name' || sort.value === 'status' ? sort.value : 'business';
      applySearch();
    });
    density.addEventListener('click', () => {
      compact = !compact;
      list.classList.toggle('is-compact', compact);
      density.textContent = compact ? '标准显示' : '紧凑显示';
    });
    fieldMode.addEventListener('change', () => {
      fields = fieldMode.value === 'key' ? 'key' : 'complete';
      updateFieldMode();
    });
    saveView.addEventListener('click', () => {
      try {
        globalThis.localStorage.setItem(
          viewKey,
          JSON.stringify({
            query: search.value,
            status: statusFilter.value,
            attention: attentionFilter.value,
            dateFrom: dateFrom.value,
            dateTo: dateTo.value,
            amountFrom: amountFrom.value,
            amountTo: amountTo.value,
            sortMode,
            compact,
            fields,
          }),
        );
        saveView.textContent = '视图已保存';
      } catch {
        saveView.textContent = '当前浏览器无法保存';
      }
    });
    const exportRows = (items: readonly HTMLElement[], suffix: string) => {
      const rows = items.map((item) => [
        recordName(item),
        recordStatus(item),
        item.textContent.replace(/\s+/gu, ' ').trim(),
      ]);
      const escapeCsv = (value: string) => `"${value.replace(/"/gu, '""')}"`;
      const csv = [['业务记录', '状态', '业务摘要'], ...rows]
        .map((row) => row.map(escapeCsv).join(','))
        .join('\n');
      const link = document.createElement('a');
      link.href = `data:text/csv;charset=utf-8,${encodeURIComponent(`\uFEFF${csv}`)}`;
      link.download = `金特夫${profile.label}-${suffix}-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
    };
    exportList.addEventListener('click', () => {
      exportRows(filteredItems, '当前结果');
    });
    exportSelected.addEventListener('click', () => {
      exportRows([...selectedItems], '已选记录');
    });
    previous.addEventListener('click', () => {
      page -= 1;
      renderItems();
    });
    next.addEventListener('click', () => {
      page += 1;
      renderItems();
    });
    reset.addEventListener('click', () => {
      search.value = '';
      statusFilter.value = '';
      attentionFilter.value = '';
      dateFrom.value = '';
      dateTo.value = '';
      amountFrom.value = '';
      amountTo.value = '';
      sortMode = 'business';
      sort.value = 'business';
      compact = false;
      fields = 'complete';
      selectedItems.clear();
      for (const item of sourceItems) {
        item.classList.remove('is-bulk-selected');
        const checkbox = item.querySelector<HTMLInputElement>('.record-select');
        if (checkbox) checkbox.checked = false;
      }
      list.classList.remove('is-compact');
      density.textContent = '紧凑显示';
      updateFieldMode();
      applySearch();
    });
    const advanced = document.createElement('details');
    advanced.className = 'workspace-list-advanced';
    const advancedSummary = el('summary', '', '更多筛选与列表操作');
    const updateAdvancedSummary = () => {
      advancedSummary.textContent =
        dateFrom.value || dateTo.value || amountFrom.value || amountTo.value
          ? '更多筛选与列表操作 · 已启用范围筛选'
          : '更多筛选与列表操作';
    };
    advanced.addEventListener('input', updateAdvancedSummary);
    advanced.addEventListener('toggle', updateAdvancedSummary);
    advanced.append(advancedSummary);
    const advancedControls = el('div', 'workspace-list-advanced-controls');
    advancedControls.append(
      dateFrom,
      dateTo,
      amountFrom,
      amountTo,
      selectedCount,
      sort,
      density,
      fieldMode,
      inspect,
      bulkInspect,
      saveView,
      exportList,
      exportSelected,
      reset,
    );
    advanced.append(advancedControls);
    tools.append(search, statusFilter, attentionFilter, count, advanced);
    list.parentElement.insertBefore(tools, list);
    list.parentElement.insertBefore(pager, list.nextSibling);
    try {
      const stored = globalThis.localStorage.getItem(viewKey);
      const view = stored
        ? (JSON.parse(stored) as {
            query?: unknown;
            status?: unknown;
            attention?: unknown;
            dateFrom?: unknown;
            dateTo?: unknown;
            amountFrom?: unknown;
            amountTo?: unknown;
            sortMode?: unknown;
            compact?: unknown;
            fields?: unknown;
          })
        : undefined;
      search.value = typeof view?.query === 'string' ? view.query : '';
      statusFilter.value =
        typeof view?.status === 'string' && statuses.includes(view.status) ? view.status : '';
      attentionFilter.value =
        view?.attention === 'attention' || view?.attention === 'actionable' ? view.attention : '';
      dateFrom.value = typeof view?.dateFrom === 'string' ? view.dateFrom : '';
      dateTo.value = typeof view?.dateTo === 'string' ? view.dateTo : '';
      amountFrom.value = typeof view?.amountFrom === 'string' ? view.amountFrom : '';
      amountTo.value = typeof view?.amountTo === 'string' ? view.amountTo : '';
      advanced.open = Boolean(dateFrom.value || dateTo.value || amountFrom.value || amountTo.value);
      sortMode =
        view?.sortMode === 'name' || view?.sortMode === 'status' ? view.sortMode : 'business';
      sort.value = sortMode;
      compact = view?.compact === true;
      fields = view?.fields === 'key' ? 'key' : 'complete';
      list.classList.toggle('is-compact', compact);
      density.textContent = compact ? '标准显示' : '紧凑显示';
    } catch {
      // A corrupt or unavailable local view must never block the operational register.
    }
    updateFieldMode();
    applySearch();
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
