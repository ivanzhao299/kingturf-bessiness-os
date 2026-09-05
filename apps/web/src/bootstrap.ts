import {
  buildBusinessDocumentTemplateHtml,
  isLegacyBusinessDocumentOutline,
} from './business-document-content';
import { el, setOperationStatus } from './dom';
import { brandMark } from './brand';
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

export type CrmPermission =
  | 'employee:read'
  | 'customer:read'
  | 'customer:create'
  | 'customer:update'
  | 'customer:lifecycle'
  | 'customer-ownership:assign'
  | 'customer-ownership:reassign'
  | 'customer-activity:create'
  | 'customer-360:read'
  | 'lead:read'
  | 'lead:create'
  | 'lead-pool:read'
  | 'lead-pool:claim'
  | 'lead-pool:release'
  | 'lead:lifecycle'
  | 'lead:assign'
  | 'lead:reassign';
export type CommercialPermission =
  | 'opportunity:read'
  | 'opportunity:create'
  | 'opportunity:update'
  | 'opportunity:lifecycle'
  | 'ctr:read'
  | 'ctr:create'
  | 'ctr:update'
  | 'ctr:submit'
  | 'ctr:approve'
  | 'attachment:read'
  | 'attachment:manage'
  | 'technical-solution:read'
  | 'technical-solution:create'
  | 'technical-solution:update'
  | 'cost-model:read'
  | 'cost-model:manage'
  | 'cost-matrix:read'
  | 'cost-matrix:manage'
  | 'cost-matrix:calculate'
  | 'cost:read'
  | 'cost:evaluate'
  | 'sales-policy:manage'
  | 'sales-policy:read'
  | 'sales-policy:evaluate'
  | 'quote:read'
  | 'quote:create'
  | 'quote:update'
  | 'quote:approve'
  | 'quote:issue'
  | 'credit:read'
  | 'credit:evaluate'
  | 'credit:approve'
  | 'contract:read'
  | 'contract:revise'
  | 'contract:sign'
  | 'contract-document:read'
  | 'contract-document:manage'
  | 'contract-ocr:operate'
  | 'contract-ocr:review'
  | 'contract-signature:send'
  | 'contract-signature:confirm'
  | 'sales-order:read'
  | 'sales-order:create'
  | 'order-360:read'
  | 'ar:read'
  | 'ar:post'
  | 'bank-payment:read'
  | 'bank-payment:intake'
  | 'reconciliation:read'
  | 'reconciliation:run'
  | 'allocation:create'
  | 'commission-policy:read'
  | 'commission-policy:manage'
  | 'commission:read'
  | 'commission:accrue'
  | 'commission:manage'
  | 'commission:pay'
  | 'risk-policy:read'
  | 'risk-policy:manage'
  | 'risk:read'
  | 'risk:evaluate'
  | 'risk:manage'
  | 'executive-dashboard:read'
  | 'manufacturing-item:read'
  | 'manufacturing-item:manage'
  | 'bom:read'
  | 'bom:manage'
  | 'routing:read'
  | 'routing:manage'
  | 'supplier:read'
  | 'supplier:manage'
  | 'procurement:read'
  | 'procurement:manage'
  | 'inventory:read'
  | 'inventory:move'
  | 'mrp-policy:read'
  | 'mrp-policy:manage'
  | 'mrp:read'
  | 'mrp:run'
  | 'mrp:approve'
  | 'mrp:release'
  | 'production:read'
  | 'production:plan'
  | 'production:material'
  | 'production:report'
  | 'production:close'
  | 'manufacturing-cost:read'
  | 'manufacturing-cost:policy'
  | 'manufacturing-cost:calculate'
  | 'manufacturing-cost:approve'
  | 'shipment:read'
  | 'shipment:request'
  | 'shipment:approve-exception'
  | 'shipment:release'
  | 'shipment:dispatch'
  | 'shipment:track'
  | 'collection:read'
  | 'collection:manage'
  | 'collection:escalate'
  | 'collection:close'
  | 'legal-case:read'
  | 'legal-case:decide'
  | 'debt-evidence:generate'
  | 'quality-plan:read'
  | 'quality-plan:manage'
  | 'quality:read'
  | 'quality:inspect'
  | 'quality:disposition'
  | 'traceability:read'
  | 'complaint:read'
  | 'complaint:create'
  | 'complaint:triage'
  | 'complaint:assign'
  | 'complaint:close'
  | 'complaint-sla:read'
  | 'complaint-sla:manage'
  | 'ncr:read'
  | 'ncr:manage'
  | 'ncr:disposition'
  | 'ncr:close'
  | 'capa:read'
  | 'capa:manage'
  | 'capa:verify';
export type Viewport = 'desktop' | 'tablet' | 'mobile';

export type AppRoute =
  | 'overview'
  | 'document-templates'
  | 'leads'
  | 'customers'
  | 'opportunities'
  | 'technical-requirements'
  | 'technical-solutions'
  | 'costing'
  | 'sales-policies'
  | 'quotes'
  | 'credit-review'
  | 'contracts'
  | 'sales-orders'
  | 'order-360'
  | 'receivables'
  | 'collections'
  | 'payments'
  | 'commissions'
  | 'business-risks'
  | 'manufacturing-master'
  | 'procurement'
  | 'material-planning'
  | 'production-orders'
  | 'quality-inspection'
  | 'shipments'
  | 'governance';

export const APP_ROUTE_LABELS: Readonly<Record<AppRoute, string>> = {
  overview: '经营总览',
  'document-templates': '业务文档库',
  leads: '销售线索',
  customers: '客户管理',
  opportunities: '销售商机',
  'technical-requirements': '技术需求',
  'technical-solutions': '技术方案',
  costing: '成本核算',
  'sales-policies': '销售政策',
  quotes: '销售报价',
  'credit-review': '信用审查',
  contracts: '合同管理',
  'sales-orders': '销售订单',
  'order-360': '订单全景',
  receivables: '应收账款',
  collections: '催收与法务',
  payments: '收款与核销',
  commissions: '销售佣金',
  'business-risks': '业务风险',
  'manufacturing-master': '制造主数据',
  procurement: '采购管理',
  'material-planning': '物料计划',
  'production-orders': '生产执行',
  'quality-inspection': '质量检验',
  shipments: '发货与签收',
  governance: '系统管理与治理',
};
const APP_ROUTE_DESCRIPTIONS: Readonly<Record<AppRoute, string>> = {
  overview: '指标、待办与经营异常',
  'document-templates': '技术、采购、合同、质量与交付模板',
  leads: '线索认领、分配与跟进',
  customers: '客户档案、联系人与活动',
  opportunities: '商机阶段、金额与赢率',
  'technical-requirements': '产品规格与工程条件',
  'technical-solutions': '方案版本与技术依据',
  costing: '成本模型、明细与差异',
  'sales-policies': '毛利、折扣与审批规则',
  quotes: '报价版本、毛利与签发',
  'credit-review': '客户额度与信用敞口',
  contracts: '合同版本、条款与签署',
  'sales-orders': '订单创建、释放与状态',
  'order-360': '订单全链路与业务证据',
  receivables: '应收余额、账龄与到期',
  collections: '催收承诺、升级与法务移交',
  payments: '银行收款、认领与核销',
  commissions: '佣金计提、释放与支付',
  'business-risks': '风险评价、责任与处置',
  'manufacturing-master': '物料、BOM 与工艺路线',
  procurement: '供应商、询价、采购与收货',
  'material-planning': '需求运算、库存抵扣与建议',
  'production-orders': '工单、用料、报工与入库',
  'quality-inspection': '检验、处置与批次追溯',
  shipments: '发货门禁、物流与签收',
  governance: '组织、权限与平台配置',
};

type BusinessDocumentTemplate = Readonly<{
  name: string;
  description: string;
  file: string;
  routes: readonly AppRoute[];
}>;

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

export type RoleWorkspaceProfile = Readonly<{
  title: string;
  description: string;
  domains: readonly string[];
}>;

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

export const routeViewSelector = (route: AppRoute): string => `[data-route-view~="${route}"]`;

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

const APP_ROUTES = new Set<AppRoute>(Object.keys(APP_ROUTE_LABELS) as AppRoute[]);

export function appRouteFromHash(hash: string): AppRoute {
  const candidate = hash.replace(/^#\/?/u, '') as AppRoute;
  return APP_ROUTES.has(candidate) ? candidate : 'overview';
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
export type Customer = Readonly<{
  id: string;
  customerNumber?: string;
  name?: string;
  status?: string;
  ownerId?: string | null;
  version?: number;
}>;
export type Lead = Readonly<{
  id: string;
  title?: string;
  source?: string;
  status?: string;
  ownerId?: string | null;
  version?: number;
  createdAt?: string;
}>;
export type Employee = Readonly<{
  id: string;
  employeeNumber?: string;
  displayName?: string;
  active?: boolean;
}>;
export type Customer360 = Readonly<{
  customer: Customer;
  contacts: readonly Readonly<{
    id: string;
    name: string;
    title: string | null;
    email?: string | null;
    phone?: string | null;
    primary?: boolean;
  }>[];
  ownership: readonly Readonly<{
    id: string;
    ownerId: string;
    reason: string;
    startedAt: string;
    endedAt: string | null;
  }>[];
  leads: readonly Lead[];
  opportunities: readonly Readonly<{
    id: string;
    name?: string;
    status?: string;
    value?: Readonly<{ amount?: string; currency?: string }>;
    probabilityBasisPoints?: number;
    expectedCloseDate?: string;
  }>[];
  activities: readonly Readonly<{
    id: string;
    type: string;
    summary: string;
    occurredAt: string;
  }>[];
  unavailableSections: readonly string[];
}>;

type CustomerInput = Readonly<{ name: string; customerNumber: string; tags: readonly string[] }>;
type LeadInput = Readonly<{
  title: string;
  source: string;
  customerId: string | null;
  pool: boolean;
}>;
export type CrmApi = {
  listEmployees(): Promise<readonly Employee[]>;
  listCustomers(): Promise<readonly Customer[]>;
  customer360(id: string): Promise<Customer360>;
  createCustomer(input: CustomerInput): Promise<Customer>;
  transitionCustomer(customer: Customer, status: string, reason: string): Promise<Customer>;
  addContact(customerId: string, name: string, email: string): Promise<void>;
  addActivity(customerId: string, summary: string): Promise<void>;
  assignCustomer(customer: Customer, assigneeId: string, reason: string): Promise<Customer>;
  listPool(): Promise<readonly Lead[]>;
  listLeads(): Promise<readonly Lead[]>;
  createLead(input: LeadInput): Promise<Lead>;
  claimLead(lead: Lead): Promise<Lead>;
  transitionLead(lead: Lead, status: string, reason: string): Promise<Lead>;
  assignLead(lead: Lead, assigneeId: string, reason: string): Promise<Lead>;
  releaseLead(lead: Lead, reason: string): Promise<Lead>;
};

export const viewportFor = (width: number): Viewport =>
  width < 640 ? 'mobile' : width < 1024 ? 'tablet' : 'desktop';

export function visibleCrmSections(permissions: ReadonlySet<CrmPermission>) {
  const customerRead = permissions.has('customer:read');
  return {
    customers: customerRead,
    customer360: customerRead && permissions.has('customer-360:read'),
    customerCreate: permissions.has('customer:create'),
    leads:
      permissions.has('lead:read') ||
      permissions.has('lead-pool:read') ||
      permissions.has('lead:create'),
    leadClaim: permissions.has('lead-pool:read') && permissions.has('lead-pool:claim'),
  } as const;
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

export function isCommercialPermission(item: string): item is CommercialPermission {
  return [
    'opportunity:',
    'ctr:',
    'attachment:',
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
    'ar:',
    'bank-payment:',
    'reconciliation:',
    'allocation:',
    'commission-policy:',
    'commission:',
    'risk-policy:',
    'risk:',
    'executive-dashboard:',
    'manufacturing-item:',
    'manufacturing-cost:',
    'bom:',
    'routing:',
    'supplier:',
    'procurement:',
    'inventory:',
    'mrp-policy:',
    'mrp:',
    'production:',
    'quality-plan:',
    'quality:',
    'traceability:',
    'complaint:',
    'complaint-sla:',
    'ncr:',
    'capa:',
    'shipment:',
    'collection:',
    'legal-case:',
    'debt-evidence:',
  ].some((prefix) => item.startsWith(prefix));
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

export type Opportunity = Readonly<{
  id: string;
  customerId?: string | null;
  leadId?: string | null;
  name?: string;
  status?: string;
  value?: Readonly<{ amount: string; currency: string }>;
  probabilityBasisPoints?: number;
  expectedCloseDate?: string;
  version?: number;
}>;

export function technicalSolutionOpportunityId(
  ctrs: readonly Record<string, unknown>[],
  ctrVersionId: string,
): string {
  const ctr = ctrs.find((item) => item.id === ctrVersionId && item.status === 'APPROVED');
  if (!ctr || typeof ctr.opportunityId !== 'string' || ctr.opportunityId.length === 0)
    throw new Error('所选技术需求单不可用或缺少关联商机');
  return ctr.opportunityId;
}

export type CommercialApi = Readonly<{
  listOpportunities(): Promise<readonly Opportunity[]>;
  list(path: string): Promise<readonly Record<string, unknown>[]>;
  listCostMatrixSummaries?(query: CostMatrixQuery): Promise<CostMatrixPage>;
  get?(path: string): Promise<Record<string, unknown>>;
  submit(
    path: string,
    payload: Record<string, unknown>,
    method?: 'POST' | 'PATCH',
  ): Promise<Record<string, unknown>>;
  uploadCtrAttachment(versionId: string, file: File): Promise<Record<string, unknown>>;
  uploadContractDocument?(
    businessType: 'SALES' | 'PURCHASE',
    subjectType: 'contract-revision' | 'purchase-order',
    subjectId: string,
    file: File,
  ): Promise<Record<string, unknown>>;
  command(
    revisionId: string,
    action: 'approve' | 'issue',
    payload?: Record<string, unknown>,
  ): Promise<Record<string, unknown>>;
}>;

export type CostMatrixAttention =
  | 'ALL'
  | 'NEEDS_INPUT'
  | 'NEEDS_CALCULATION'
  | 'READY_FOR_QUOTE'
  | 'IN_QUOTE';
export type CostMatrixSort = 'ATTENTION' | 'CODE' | 'UPDATED' | 'COST_DESC';
export type CostMatrixQuery = Readonly<{
  page: number;
  pageSize: number;
  query: string;
  productFamily: string;
  attention: CostMatrixAttention;
  sort: CostMatrixSort;
}>;
export type CostMatrixPage = Readonly<{
  items: readonly Record<string, unknown>[];
  total: number;
  page: number;
  pageSize: number;
}>;

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
        [
          this.permissions.has('collection:read') ? 'collection:read' : 'legal-case:read',
          '/api/v1/collection-cases',
        ],
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
    const summary = cashRiskSummary(
      controller.views.get('/api/v1/ar-open-items') ?? [],
      controller.views.get('/api/v1/bank-payments') ?? [],
      controller.views.get('/api/v1/collection-cases') ?? [],
    );
    const grid = el('div', 'cash-risk-grid');
    for (const [label, value, tone] of [
      ['逾期应收', summary.overdueReceivables, 'danger'],
      ['待核销收款', summary.unappliedPayments, 'attention'],
      ['承诺已违约', summary.brokenPromises, 'danger'],
      ['法务待受理', summary.legalPending, 'warning'],
    ] as const) {
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
  if (controller && permissions.has('production:read')) {
    const panel = el('section', 'production-workbench');
    panel.setAttribute('data-testid', 'production-workbench');
    const productionPriority: Readonly<Record<string, number>> = {
      IN_PROGRESS: 0,
      RELEASED: 1,
      COMPLETED: 2,
      DRAFT: 3,
      CLOSED: 4,
    };
    const orders = [...(controller.views.get('/api/v1/production-orders') ?? [])].sort(
      (left, right) =>
        (productionPriority[recordText(left, 'state', 'state')] ?? 9) -
        (productionPriority[recordText(right, 'state', 'state')] ?? 9),
    );
    const refresh = async () => {
      await controller.load();
      status.textContent = controller.message;
    };
    panel.append(
      el('p', 'eyebrow', '车间执行'),
      el('h2', '', '生产工单与车间执行'),
      el('p', 'commercial-help', '生产工单、报工、用料与成品入库'),
    );
    if (permissions.has('production:plan')) {
      const create = el('button', 'primary', '＋ 新建生产工单');
      create.addEventListener('click', () => {
        const items = controller.views.get('/api/v1/manufacturing-items') ?? [];
        const routings = controller.views.get('/api/v1/manufacturing-routings') ?? [];
        openForm(
          workspace,
          '建立生产工单',
          '工单引用已发布物料和工艺版本；保存时固定全部标准工序快照。',
          [
            { name: 'orderNumber', label: '工单编号', required: true },
            {
              name: 'itemVersionId',
              label: '成品版本',
              type: 'select',
              required: true,
              options: items
                .filter((item) => recordText(item, 'status', 'status') === 'PUBLISHED')
                .map((item) => ({
                  value: String(item.id),
                  label: `${recordText(item, 'sku', 'sku')} · ${recordText(item, 'name', 'name')}`,
                })),
            },
            {
              name: 'routingVersionId',
              label: '已发布工艺版本',
              type: 'select',
              required: true,
              options: routings.map((item) => ({
                value: String(item.id),
                label: `${recordText(item, 'code', 'code')} · ${recordText(item, 'name', 'name')}`,
              })),
            },
            { name: 'mrpProposalId', label: '物料需求建议编号（可选）' },
            { name: 'plannedQuantity', label: '计划数量', type: 'number', required: true },
            { name: 'plannedStartAt', label: '计划开始', type: 'date', required: true },
            { name: 'plannedDueAt', label: '计划完成', type: 'date', required: true },
            { name: 'sourceReference', label: '来源唯一编号', required: true },
          ],
          '保存工单',
          async (values) => {
            await controller.submit('/api/v1/production-orders', {
              ...values,
              ...(values.mrpProposalId ? {} : { mrpProposalId: undefined }),
            });
            await refresh();
          },
        );
      });
      panel.append(create);
    }
    const summary = el('div', 'production-summary');
    summary.append(
      el('div', 'metric-card', `生产工单\n${String(orders.length)} 张`),
      el(
        'div',
        'metric-card',
        `执行中\n${String(orders.filter((order) => recordText(order, 'state', 'state') === 'IN_PROGRESS').length)} 张`,
      ),
      el(
        'div',
        'metric-card',
        `累计报工\n${String(orders.reduce((sum, order) => sum + (Array.isArray(order.reports) ? order.reports.length : 0), 0))} 条`,
      ),
      el(
        'div',
        'metric-card',
        `成品卷\n${String(orders.reduce((sum, order) => sum + (Array.isArray(order.rolls) ? order.rolls.length : 0), 0))} 卷`,
      ),
    );
    panel.append(summary);
    const grid = el('div', 'production-order-grid');
    for (const order of orders) {
      const state = recordText(order, 'state', 'state');
      const operations = Array.isArray(order.operations) ? order.operations.map(recordValue) : [];
      const materials = Array.isArray(order.materials) ? order.materials.map(recordValue) : [];
      const reports = Array.isArray(order.reports) ? order.reports.map(recordValue) : [];
      const rolls = Array.isArray(order.rolls) ? order.rolls.map(recordValue) : [];
      const events = Array.isArray(order.events) ? order.events.map(recordValue) : [];
      const card = el('article', 'production-order-card');
      card.append(
        el(
          'h3',
          '',
          `${recordText(order, 'orderNumber', 'order_number')} · ${recordText(order, 'sku', 'sku')}`,
        ),
        el('span', `ctr-state state-${state.toLowerCase()}`, businessStateLabel(state)),
        el(
          'p',
          '',
          `计划 ${recordText(order, 'plannedQuantity', 'planned_quantity')} · ${recordText(order, 'plannedStartAt', 'planned_start_at').slice(0, 10)} → ${recordText(order, 'plannedDueAt', 'planned_due_at').slice(0, 10)}`,
        ),
        el('p', 'next-action-note', `下一步：${operationsNextAction('production', state)}`),
      );
      const flow = el('div', 'production-flow');
      for (const operation of operations) {
        const operationReports = reports.filter(
          (report) =>
            recordText(report, 'productionOrderOperationId', 'production_order_operation_id') ===
            String(operation.id),
        );
        flow.append(
          el(
            'div',
            `production-operation ${operationReports.length ? 'done' : ''}`,
            `${recordText(operation, 'sequence', 'sequence')} · ${recordText(operation, 'name', 'name')}\n${recordText(operation, 'workCenter', 'work_center')} · 良品 ${String(operationReports.reduce((sum, report) => sum + Number(recordText(report, 'goodQuantity', 'good_quantity') || 0), 0))}`,
          ),
        );
      }
      card.append(flow);
      const evidenceGrid = el('div', 'production-evidence-grid');
      evidenceGrid.append(
        el(
          'div',
          'evidence-card',
          `物料台账\n${materials.map((item) => `${businessStateLabel(recordText(item, 'transactionType', 'transaction_type'))} ${recordText(item, 'quantity', 'quantity')}`).join('\n') || '尚未领料'}`,
        ),
        el(
          'div',
          'evidence-card',
          `成品序列\n${rolls.map((item) => `${recordText(item, 'rollNumber', 'roll_number')} · ${recordText(item, 'quantity', 'quantity')} · ${businessStateLabel(recordText(item, 'status', 'status'))}`).join('\n') || '尚未入库'}`,
        ),
        el(
          'div',
          'evidence-card',
          `状态证据\n${events.map((item) => businessStateLabel(recordText(item, 'state', 'state'))).join(' → ')}`,
        ),
      );
      card.append(evidenceGrid);
      const actions = el('div', 'production-actions');
      const transitions: Record<string, readonly [string, string, CommercialPermission]> = {
        DRAFT: ['release', '下达工单', 'production:plan'],
        RELEASED: ['start', '开始生产', 'production:report'],
        IN_PROGRESS: ['complete', '完工确认', 'production:close'],
        COMPLETED: ['close', '关闭工单', 'production:close'],
      };
      const transition = transitions[state];
      if (transition && permissions.has(transition[2])) {
        const button = el('button', 'primary', transition[1]);
        button.addEventListener('click', () => {
          openForm(
            workspace,
            transition[1],
            '状态决定会追加到不可变工单事件台账，并执行完整性门禁。',
            [
              { name: 'reason', label: '操作理由', type: 'textarea', required: true },
              { name: 'evidenceReference', label: '证据编号', required: true },
            ],
            '确认执行',
            async (values) => {
              await controller.submit(
                `/api/v1/production-orders/${String(order.id)}/${transition[0]}`,
                {
                  reason: values.reason,
                  evidence: { reference: values.evidenceReference },
                  idempotencyKey: `${recordText(order, 'orderNumber', 'order_number')}-${transition[0].toUpperCase()}-${String(values.evidenceReference)}`,
                },
              );
              await refresh();
            },
          );
        });
        actions.append(button);
      }
      if (permissions.has('production:report') && state === 'IN_PROGRESS') {
        const report = el('button', 'secondary', '＋ 工序报工');
        report.addEventListener('click', () => {
          openForm(
            workspace,
            '登记工序报工',
            '每次报工使用唯一幂等键；累计良品不能超过工单计划数量。',
            [
              {
                name: 'operationId',
                label: '工序',
                type: 'select',
                required: true,
                options: operations.map((item) => ({
                  value: String(item.id),
                  label: `${recordText(item, 'sequence', 'sequence')} · ${recordText(item, 'name', 'name')}`,
                })),
              },
              { name: 'goodQuantity', label: '良品数量', type: 'number', required: true },
              {
                name: 'scrapQuantity',
                label: '废品数量',
                type: 'number',
                required: true,
                value: '0',
              },
              { name: 'laborMinutes', label: '人工分钟', type: 'number', required: true },
              { name: 'machineMinutes', label: '设备分钟', type: 'number', required: true },
              { name: 'startedAt', label: '开始时间', type: 'datetime-local', required: true },
              { name: 'completedAt', label: '完成时间', type: 'datetime-local', required: true },
              { name: 'notes', label: '班组记录', type: 'textarea' },
              { name: 'idempotencyKey', label: '报工唯一键', required: true },
            ],
            '提交报工',
            async (values) => {
              await controller.submit(
                `/api/v1/production-orders/${String(order.id)}/operation-reports`,
                {
                  ...values,
                  startedAt: new Date(values.startedAt ?? '').toISOString(),
                  completedAt: new Date(values.completedAt ?? '').toISOString(),
                },
              );
              await refresh();
            },
          );
        });
        actions.append(report);
      }
      if (
        permissions.has('production:material') &&
        (state === 'RELEASED' || state === 'IN_PROGRESS')
      ) {
        const balances = controller.views.get('/api/v1/inventory-balances') ?? [];
        const material = el('button', 'secondary', '＋ 领料/退料');
        material.addEventListener('click', () => {
          openForm(
            workspace,
            '登记生产物料',
            '领料同步写入不可变库存移动；只能领用已放行且属于工单 BOM 的批次物料。',
            [
              {
                name: 'transactionType',
                label: '业务类型',
                type: 'select',
                required: true,
                options: [
                  { value: 'ISSUE', label: '领料' },
                  { value: 'RETURN', label: '退料' },
                ],
              },
              {
                name: 'balance',
                label: '批次库位',
                type: 'select',
                required: true,
                options: balances.map((item, index) => ({
                  value: String(index),
                  label: `${recordText(item, 'sku', 'sku')} · ${recordText(item, 'lotNumber', 'lotNumber')} · ${recordText(item, 'locationCode', 'locationCode')} · 可用 ${recordText(item, 'quantity', 'quantity')}`,
                })),
              },
              { name: 'quantity', label: '数量', type: 'number', required: true },
              { name: 'reason', label: '领退料原因', type: 'textarea', required: true },
              { name: 'occurredAt', label: '发生时间', type: 'datetime-local', required: true },
              { name: 'idempotencyKey', label: '业务唯一键', required: true },
            ],
            '确认过账',
            async (values) => {
              const balance = balances[Number(values.balance)];
              if (!balance) throw new Error('请选择有效批次库位');
              await controller.submit(`/api/v1/production-orders/${String(order.id)}/materials`, {
                transactionType: values.transactionType,
                itemVersionId: balance.itemVersionId,
                lotId: balance.lotId,
                locationId: balance.locationId,
                quantity: values.quantity,
                reason: values.reason,
                occurredAt: new Date(values.occurredAt ?? '').toISOString(),
                idempotencyKey: values.idempotencyKey,
              });
              await refresh();
            },
          );
        });
        actions.append(material);
      }
      if (permissions.has('production:report') && state === 'IN_PROGRESS' && reports.length) {
        const locations = controller.views.get('/api/v1/inventory-locations') ?? [];
        const output = el('button', 'secondary', '＋ 成品卷入库');
        output.addEventListener('click', () => {
          openForm(
            workspace,
            '登记成品卷与待检批次',
            '卷号、成品批次和正向库存收货在同一事务内生成，初始质量状态为待检。',
            [
              {
                name: 'operationReportId',
                label: '末工序报工',
                type: 'select',
                required: true,
                options: reports.map((item) => ({
                  value: String(item.id),
                  label: `${recordText(item, 'completedAt', 'completed_at')} · 良品 ${recordText(item, 'goodQuantity', 'good_quantity')}`,
                })),
              },
              { name: 'rollNumber', label: '成品卷号', required: true },
              { name: 'lotNumber', label: '成品批次号', required: true },
              {
                name: 'locationId',
                label: '入库库位',
                type: 'select',
                required: true,
                options: locations.map(inventoryLocationOption),
              },
              { name: 'quantity', label: '卷数量', type: 'number', required: true },
              { name: 'manufacturedAt', label: '生产日期', type: 'date', required: true },
            ],
            '生成卷号并入库',
            async (values) => {
              await controller.submit(
                `/api/v1/production-orders/${String(order.id)}/finished-rolls`,
                {
                  ...values,
                  itemVersionId: recordText(order, 'itemVersionId', 'item_version_id'),
                },
              );
              await refresh();
            },
          );
        });
        actions.append(output);
      }
      card.append(actions);
      grid.append(card);
    }
    panel.append(grid);
    workspace.append(panel);
  }
  if (controller && permissions.has('manufacturing-cost:read')) {
    const panel = el('section', 'production-workbench');
    panel.setAttribute('data-testid', 'manufacturing-cost-workbench');
    const policies = controller.views.get('/api/v1/production-cost-policies') ?? [];
    const runs = controller.views.get('/api/v1/production-cost-runs') ?? [];
    const orders = controller.views.get('/api/v1/production-orders') ?? [];
    panel.append(
      el('p', 'eyebrow', '制造成本分析'),
      el('h2', '', '实际制造成本与差异'),
      el('p', 'commercial-help', '生产成本核算与差异分析'),
    );
    const summary = el('div', 'production-summary');
    summary.append(
      el('div', 'metric-card', `成本政策\n${String(policies.length)} 个版本`),
      el('div', 'metric-card', `已核算工单\n${String(runs.length)} 张`),
      el(
        'div',
        'metric-card',
        `待审批\n${String(runs.filter((x) => recordText(x, 'state', 'state') === 'CALCULATED').length)} 张`,
      ),
      el(
        'div',
        'metric-card',
        `已批准\n${String(runs.filter((x) => recordText(x, 'state', 'state') === 'APPROVED').length)} 张`,
      ),
    );
    panel.append(summary);
    if (permissions.has('manufacturing-cost:policy')) {
      const materialItems = (controller.views.get('/api/v1/manufacturing-items') ?? []).filter(
        (item) =>
          recordText(item, 'status', 'status') === 'PUBLISHED' &&
          recordText(item, 'sku', 'sku').startsWith('RM-'),
      );
      if (materialItems.length) {
        const createPolicy = el('button', 'primary', '＋ 新建成本政策');
        createPolicy.addEventListener('click', () => {
          const latestVersion = policies.reduce(
            (max, policy) => Math.max(max, Number(recordText(policy, 'version', 'version') || 0)),
            0,
          );
          openForm(
            workspace,
            '建立制造成本政策',
            '发布后费率和材料单价保持只读；每个已发布原材料版本都必须给出可追溯计价来源。',
            [
              {
                name: 'version',
                label: '政策版本',
                type: 'number',
                required: true,
                value: String(latestVersion + 1),
              },
              {
                name: 'currency',
                label: '币种',
                type: 'select',
                required: true,
                value: 'CNY',
                options: [{ value: 'CNY', label: '人民币' }],
              },
              {
                name: 'laborRatePerHour',
                label: '人工小时费率',
                type: 'number',
                required: true,
              },
              {
                name: 'machineRatePerHour',
                label: '机器小时费率',
                type: 'number',
                required: true,
              },
              {
                name: 'overheadRatePerMachineHour',
                label: '制造费用/机器小时',
                type: 'number',
                required: true,
              },
              {
                name: 'effectiveFrom',
                label: '生效日期',
                type: 'date',
                required: true,
              },
              { name: 'sourceReference', label: '政策来源编号', required: true },
              ...materialItems.map((item) => ({
                name: `materialRate_${String(item.id)}`,
                label: `${recordText(item, 'sku', 'sku')} 材料单位成本`,
                type: 'number' as const,
                required: true,
              })),
            ],
            '发布成本政策',
            async (values) => {
              await controller.submit('/api/v1/production-cost-policies', {
                version: Number(values.version),
                currency: values.currency,
                laborRatePerHour: values.laborRatePerHour,
                machineRatePerHour: values.machineRatePerHour,
                overheadRatePerMachineHour: values.overheadRatePerMachineHour,
                effectiveFrom: values.effectiveFrom,
                sourceReference: values.sourceReference,
                materialRates: materialItems.map((item) => ({
                  itemVersionId: String(item.id),
                  unitCost: values[`materialRate_${String(item.id)}`],
                  sourceReference: `${String(values.sourceReference)}-${recordText(item, 'sku', 'sku')}`,
                })),
              });
              await controller.load();
              status.textContent = controller.message;
            },
          );
        });
        panel.append(createPolicy);
      }
    }
    if (permissions.has('manufacturing-cost:calculate') && policies.length) {
      for (const order of orders.filter(
        (x) =>
          recordText(x, 'state', 'state') === 'COMPLETED' &&
          !runs.some(
            (r) => recordText(r, 'production_order_id', 'productionOrderId') === String(x.id),
          ),
      )) {
        const orderNumber = recordText(order, 'orderNumber', 'order_number');
        const button = el('button', 'secondary', `核算 ${orderNumber}`);
        button.addEventListener('click', () => {
          void (async () => {
            await controller.submit('/api/v1/production-cost-runs', {
              productionOrderId: String(order.id),
              policyId: String(policies[0]?.id),
              runNumber: `COST-${orderNumber}`,
              idempotencyKey: `COST-${orderNumber}`,
            });
            await controller.load();
            status.textContent = controller.message;
          })();
        });
        panel.append(button);
      }
    }
    const grid = el('div', 'production-order-grid');
    const costPriority: Readonly<Record<string, number>> = { CALCULATED: 0, APPROVED: 1 };
    for (const run of [...runs].sort(
      (left, right) =>
        (costPriority[recordText(left, 'state', 'state')] ?? 9) -
        (costPriority[recordText(right, 'state', 'state')] ?? 9),
    )) {
      const runState = recordText(run, 'state', 'state');
      const card = el('article', 'production-order-card');
      card.append(
        el(
          'h3',
          '',
          `${recordText(run, 'run_number', 'runNumber')} · ${businessStateLabel(recordText(run, 'state', 'state'))}`,
        ),
        el(
          'p',
          '',
          `工单 ${recordText(run, 'orderNumber', 'orderNumber')} · ${recordText(run, 'currency', 'currency')}`,
        ),
        el(
          'p',
          '',
          `计划 ${recordText(run, 'planned_total', 'plannedTotal')} · 实际 ${recordText(run, 'actual_total', 'actualTotal')} · 差异 ${recordText(run, 'variance_total', 'varianceTotal')}`,
        ),
        el('p', 'next-action-note', `下一步：${operationsNextAction('cost', runState)}`),
      );
      if (permissions.has('manufacturing-cost:approve') && runState === 'CALCULATED') {
        const approve = el('button', 'primary', '批准成本');
        approve.addEventListener('click', () => {
          openForm(
            workspace,
            '批准制造成本',
            '请确认计划与实际差异，并留下可追溯的复核依据。',
            [
              { name: 'reason', label: '审批理由', type: 'textarea', required: true },
              { name: 'evidenceReference', label: '复核凭证编号', required: true },
            ],
            '确认批准',
            async (values) => {
              await controller.submit(`/api/v1/production-cost-runs/${String(run.id)}/approve`, {
                reason: values.reason,
                evidence: { reference: values.evidenceReference },
                idempotencyKey: `APPROVE-${String(run.id)}-${String(values.evidenceReference)}`,
              });
              await controller.load();
              status.textContent = controller.message;
            },
          );
        });
        card.append(approve);
      }
      grid.append(card);
    }
    if (!runs.length)
      grid.append(
        el('p', 'success-note', '暂无已核算工单；生产工单完工后由制造成本核算会计发起。'),
      );
    panel.append(grid);
    workspace.append(panel);
  }
  if (controller && permissions.has('shipment:read')) {
    const panel = el('section', 'shipment-workbench');
    panel.setAttribute('data-testid', 'shipment-workbench');
    const releases = controller.views.get('/api/v1/shipment-releases') ?? [];
    const orders = controller.views.get('/api/v1/sales-orders') ?? [];
    const productionOrders = controller.views.get('/api/v1/production-orders') ?? [];
    const lots = controller.views.get('/api/v1/lot-traceability') ?? [];
    const shipmentRecords = (
      release: Record<string, unknown>,
    ): readonly Record<string, unknown>[] =>
      Array.isArray(release.shipments)
        ? release.shipments.filter(
            (item): item is Record<string, unknown> => typeof item === 'object' && item !== null,
          )
        : [];
    panel.append(
      el('p', 'eyebrow', '发货与签收'),
      el('h2', '', '发货放行与物流签收'),
      el('p', 'commercial-help', '发货门禁、例外审批与签收追踪'),
    );
    const summary = el('div', 'production-summary');
    summary.append(
      el('div', 'metric-card', `放行申请\n${String(releases.length)} 张`),
      el(
        'div',
        'metric-card',
        `例外待审\n${String(releases.filter((x) => recordText(x, 'state', 'state') === 'EXCEPTION_PENDING').length)} 张`,
      ),
      el(
        'div',
        'metric-card',
        `已放行\n${String(releases.filter((x) => recordText(x, 'state', 'state') === 'RELEASED').length)} 张`,
      ),
      el(
        'div',
        'metric-card',
        `已签收\n${String(releases.flatMap((x) => shipmentRecords(x)).filter((x) => recordText(x, 'state', 'state') === 'DELIVERED').length)} 票`,
      ),
    );
    panel.append(summary);
    if (
      permissions.has('shipment:request') &&
      orders.length &&
      productionOrders.length &&
      lots.length
    ) {
      const button = el('button', 'primary', '＋ 发起发货门禁检查');
      button.addEventListener('click', () => {
        openForm(
          workspace,
          '发起发货放行申请',
          '系统在提交瞬间冻结九类门禁结果；未通过项只能进入独立例外审批，不能由申请人自行绕过。',
          [
            { name: 'requestNumber', label: '放行申请号', required: true },
            {
              name: 'salesOrderId',
              label: '销售订单',
              type: 'select',
              required: true,
              options: orders.map((x) => ({
                value: String(x.id),
                label: recordText(x, 'orderNumber', 'order_number'),
              })),
            },
            {
              name: 'productionOrderId',
              label: '生产工单',
              type: 'select',
              required: true,
              options: productionOrders.map((x) => ({
                value: String(x.id),
                label: recordText(x, 'orderNumber', 'order_number'),
              })),
            },
            {
              name: 'finishedLotId',
              label: '成品批次',
              type: 'select',
              required: true,
              options: lots
                .filter((x) => recordText(x, 'qualityStatus', 'qualityStatus') === 'RELEASED')
                .map((x) => ({
                  value: String(x.lotId ?? x.id),
                  label: `${recordText(x, 'lotNumber', 'lotNumber')} · ${recordText(x, 'sku', 'sku')}`,
                })),
            },
            { name: 'requestedQuantity', label: '发货数量', type: 'number', required: true },
            {
              name: 'requiredPaymentAmount',
              label: '发货前应收款金额',
              type: 'number',
              required: true,
            },
            { name: 'reason', label: '发货事由', required: true },
          ],
          '执行门禁检查',
          async (values) => {
            const requestNumber = String(values.requestNumber);
            await controller.submit('/api/v1/shipment-releases', {
              ...values,
              idempotencyKey: requestNumber,
            });
            await controller.load();
            status.textContent = controller.message;
          },
        );
      });
      panel.append(button);
    }
    const shipmentPriority: Readonly<Record<string, number>> = {
      EXCEPTION_PENDING: 0,
      READY: 1,
      APPROVED: 2,
      RELEASED: 3,
      REJECTED: 4,
    };
    const grid = el('div', 'production-order-grid');
    for (const release of [...releases].sort(
      (left, right) =>
        (shipmentPriority[recordText(left, 'state', 'state')] ?? 9) -
        (shipmentPriority[recordText(right, 'state', 'state')] ?? 9),
    )) {
      const state = recordText(release, 'state', 'state');
      const snapshot = (release.gate_snapshot ?? release.gateSnapshot ?? {}) as Record<
        string,
        unknown
      >;
      const failures = Array.isArray(snapshot.failures)
        ? snapshot.failures.map(shipmentGateLabel).join('、')
        : '无';
      const card = el('article', 'production-order-card');
      card.append(
        el(
          'h3',
          '',
          `${recordText(release, 'request_number', 'requestNumber')} · ${businessStateLabel(state)}`,
        ),
        el(
          'p',
          '',
          `销售订单 ${recordText(release, 'orderNumber', 'orderNumber')} · 工单 ${recordText(release, 'productionOrderNumber', 'productionOrderNumber')}`,
        ),
        el(
          'p',
          '',
          `批次 ${recordText(release, 'lotNumber', 'lotNumber')} · 数量 ${recordText(release, 'requested_quantity', 'requestedQuantity')}`,
        ),
        el('p', failures === '无' ? 'success-note' : 'risk-note', `门禁未通过：${failures}`),
        el('p', 'next-action-note', `下一步：${operationsNextAction('shipment', state)}`),
      );
      const openShipmentDecision = (path: string, title: string, confirmLabel: string) => {
        openForm(
          workspace,
          title,
          '该决定将写入不可变发货证据链，请复核门禁结果并填写审批依据。',
          [
            { name: 'reason', label: '决定理由', type: 'textarea', required: true },
            { name: 'evidenceReference', label: '审批凭证编号', required: true },
          ],
          confirmLabel,
          async (values) => {
            await controller.submit(path, {
              reason: values.reason,
              evidence: { reference: values.evidenceReference },
              idempotencyKey: `${recordText(release, 'request_number', 'requestNumber')}-${String(values.evidenceReference)}`,
            });
            await controller.load();
            status.textContent = controller.message;
          },
        );
      };
      if (state === 'EXCEPTION_PENDING' && permissions.has('shipment:approve-exception')) {
        const approve = el('button', 'primary', '批准例外');
        approve.addEventListener('click', () => {
          openShipmentDecision(
            `/api/v1/shipment-releases/${String(release.id)}/approve-exception`,
            '批准发货例外',
            '确认批准例外',
          );
        });
        card.append(approve);
      }
      if ((state === 'READY' || state === 'APPROVED') && permissions.has('shipment:release')) {
        const releaseButton = el('button', 'primary', '执行仓库放行');
        releaseButton.addEventListener('click', () => {
          openShipmentDecision(
            `/api/v1/shipment-releases/${String(release.id)}/release`,
            '执行仓库放行',
            '确认仓库放行',
          );
        });
        card.append(releaseButton);
      }
      if (
        state === 'RELEASED' &&
        permissions.has('shipment:dispatch') &&
        (!Array.isArray(release.shipments) || release.shipments.length === 0)
      ) {
        const dispatch = el('button', 'secondary', '登记承运发车');
        dispatch.addEventListener('click', () => {
          openForm(
            workspace,
            '登记承运发车',
            '录入唯一运单与封车证据。',
            [
              { name: 'shipmentNumber', label: '发运单号', required: true },
              { name: 'carrierName', label: '承运商', required: true },
              { name: 'trackingNumber', label: '物流单号', required: true },
              { name: 'dispatchedAt', label: '发车时间', required: true },
              { name: 'location', label: '发车地点', required: true },
              { name: 'sealReference', label: '封车/装车凭证编号', required: true },
            ],
            '确认发车',
            async (values) => {
              await controller.submit(`/api/v1/shipment-releases/${String(release.id)}/dispatch`, {
                shipmentNumber: values.shipmentNumber,
                carrierName: values.carrierName,
                trackingNumber: values.trackingNumber,
                dispatchedAt: values.dispatchedAt,
                location: values.location,
                evidence: { sealReference: values.sealReference },
                idempotencyKey: String(values.shipmentNumber),
              });
              await controller.load();
              status.textContent = controller.message;
            },
          );
        });
        card.append(dispatch);
      }
      for (const shipment of shipmentRecords(release)) {
        if (
          recordText(shipment, 'state', 'state') !== 'DELIVERED' &&
          permissions.has('shipment:track')
        ) {
          const pod = el(
            'button',
            'secondary',
            `登记签收 ${recordText(shipment, 'tracking_number', 'trackingNumber')}`,
          );
          pod.addEventListener('click', () => {
            openForm(
              workspace,
              '登记客户签收回单',
              '签收人、签收时间和回单编号为强制证据。',
              [
                { name: 'receiverName', label: '签收人', required: true },
                { name: 'receivedAt', label: '签收时间', required: true },
                { name: 'proofReference', label: '回单/附件编号', required: true },
                { name: 'location', label: '签收地点', required: true },
              ],
              '确认签收',
              async (values) => {
                await controller.submit(`/api/v1/shipments/${String(shipment.id)}/deliver`, {
                  occurredAt: values.receivedAt,
                  location: values.location,
                  evidence: {
                    receiverName: values.receiverName,
                    receivedAt: values.receivedAt,
                    proofReference: values.proofReference,
                  },
                  idempotencyKey: `POD-${String(shipment.id)}`,
                });
                await controller.load();
                status.textContent = controller.message;
              },
            );
          });
          card.append(pod);
        }
      }
      grid.append(card);
    }
    if (!releases.length)
      grid.append(
        el('p', 'success-note', '暂无发货放行申请；由发货申请员从已完工且质量放行的批次发起。'),
      );
    panel.append(grid);
    workspace.append(panel);
  }
  if (controller && permissions.has('opportunity:read')) {
    const pipeline = document.createElement('section');
    pipeline.className = 'pipeline-board';
    const heading = document.createElement('div');
    heading.className = 'pipeline-heading';
    const headingCopy = document.createElement('div');
    const title = document.createElement('h2');
    title.textContent = '商机阶段看板';
    const subtitle = document.createElement('p');
    subtitle.textContent = '按阶段推进预计金额、赢率与成交日期';
    headingCopy.append(title, subtitle);
    if (permissions.has('opportunity:create')) {
      const create = document.createElement('button');
      create.className = 'primary';
      create.textContent = '＋ 新建商机';
      create.addEventListener('click', () => {
        openForm(
          workspace,
          '新建商机',
          '建立销售机会并设置初始金额、赢率与预计成交日期。',
          [
            {
              name: 'customerId',
              label: '关联客户',
              type: 'select',
              options: [
                { value: 'none', label: '暂不关联客户' },
                ...controller.customers.map((customer) => ({
                  value: customer.id,
                  label: customer.name ?? customer.id,
                })),
              ],
            },
            {
              name: 'name',
              label: '商机名称',
              required: true,
              placeholder: '例如：国际学校足球场项目',
            },
            {
              name: 'value',
              label: '预计金额',
              type: 'number',
              required: true,
              placeholder: '500000',
            },
            {
              name: 'currency',
              label: '币种',
              type: 'select',
              required: true,
              options: [
                { value: 'CNY', label: '人民币' },
                { value: 'USD', label: '美元 USD' },
                { value: 'EUR', label: '欧元 EUR' },
              ],
            },
            {
              name: 'probability',
              label: '成交概率（%）',
              type: 'number',
              required: true,
              placeholder: '30',
            },
            { name: 'expectedCloseDate', label: '预计成交日期', type: 'date', required: true },
          ],
          '创建商机',
          async (values) => {
            await controller.submit('/api/v1/opportunities', {
              customerId: values.customerId === 'none' ? null : (values.customerId ?? null),
              leadId: null,
              name: values.name ?? '',
              value: values.value ?? '',
              currency: values.currency ?? 'CNY',
              probabilityBasisPoints: Math.round(Number(values.probability ?? 0) * 100),
              expectedCloseDate: values.expectedCloseDate ?? '',
            });
            pipeline.replaceWith(
              commercialWorkspaceStructure(viewport, immutable, controller).querySelector(
                '.pipeline-board',
              ) ?? pipeline,
            );
          },
        );
      });
      heading.append(headingCopy, create);
    } else heading.append(headingCopy);
    pipeline.append(heading);
    const pipelineSummary = opportunityPipelineSummary(controller.opportunities);
    const summary = el('div', 'pipeline-summary');
    for (const [label, value, tone] of [
      ['在途商机', pipelineSummary.active, 'neutral'],
      ['已逾期', pipelineSummary.overdue, pipelineSummary.overdue > 0 ? 'danger' : 'success'],
      ['30 天内预计成交', pipelineSummary.closingSoon, 'attention'],
      [
        '未关联客户',
        pipelineSummary.customerMissing,
        pipelineSummary.customerMissing > 0 ? 'warning' : 'success',
      ],
    ] as const) {
      const metric = el('article', `pipeline-metric ${tone}`);
      metric.append(el('span', '', label), el('strong', '', String(value)));
      summary.append(metric);
    }
    pipeline.append(summary);
    const columns = document.createElement('div');
    columns.className = 'pipeline-columns';
    const stages = [
      ['OPEN', '初步接洽'],
      ['QUALIFIED', '需求确认'],
      ['PROPOSAL', '方案报价'],
      ['WON', '赢单'],
      ['LOST', '输单'],
    ] as const;
    for (const [stage, label] of stages) {
      const column = document.createElement('section');
      column.className = `pipeline-column stage-${stage.toLocaleLowerCase()}`;
      const opportunities = controller.opportunities.filter((item) => item.status === stage);
      const columnHeading = document.createElement('header');
      columnHeading.textContent = `${label} · ${String(opportunities.length)}`;
      column.append(columnHeading);
      for (const opportunity of opportunities) {
        const card = document.createElement('article');
        card.className = 'opportunity-card';
        const expectedDate = opportunity.expectedCloseDate?.slice(0, 10);
        const overdue =
          !['WON', 'LOST'].includes(stage) &&
          Boolean(expectedDate) &&
          String(expectedDate) < new Date().toISOString().slice(0, 10);
        if (overdue) card.classList.add('overdue');
        const name = document.createElement('strong');
        name.textContent = opportunity.name ?? opportunity.id;
        const amount = document.createElement('span');
        amount.textContent = opportunity.value
          ? displayMoney(opportunity.value.currency, opportunity.value.amount)
          : '金额受限';
        const meta = document.createElement('small');
        meta.textContent = `${String((opportunity.probabilityBasisPoints ?? 0) / 100)}% · ${opportunity.expectedCloseDate?.slice(0, 10) ?? '日期未定'}`;
        card.append(name, amount, meta);
        if (overdue) card.append(el('span', 'opportunity-alert', '成交日期已逾期'));
        const nextStage =
          stage === 'OPEN'
            ? 'QUALIFIED'
            : stage === 'QUALIFIED'
              ? 'PROPOSAL'
              : stage === 'PROPOSAL'
                ? 'WON'
                : null;
        if (nextStage && permissions.has('opportunity:lifecycle')) {
          const advance = document.createElement('button');
          advance.className = 'text-button';
          advance.textContent = '推进 →';
          advance.addEventListener('click', () => {
            openForm(
              workspace,
              '推进商机阶段',
              `从“${label}”推进至下一阶段。`,
              [{ name: 'reason', label: '推进依据', type: 'textarea', required: true }],
              '确认推进',
              async (values) => {
                await controller.transitionOpportunity(opportunity, nextStage, values.reason ?? '');
                status.textContent = controller.message;
              },
            );
          });
          card.append(advance);
        }
        column.append(card);
      }
      if (opportunities.length === 0) {
        const empty = document.createElement('p');
        empty.className = 'pipeline-empty';
        empty.textContent = '暂无商机';
        column.append(empty);
      }
      columns.append(column);
    }
    pipeline.append(columns);
    workspace.append(pipeline);
  }
  if (controller && permissions.has('ctr:read')) {
    const ctrPanel = document.createElement('section');
    ctrPanel.className = 'ctr-workbench';
    const heading = document.createElement('div');
    heading.className = 'pipeline-heading';
    const copy = document.createElement('div');
    const title = document.createElement('h2');
    title.textContent = '技术需求单';
    const subtitle = document.createElement('p');
    subtitle.textContent = '结构化记录场景、规格、数量和交付要求，提交后形成不可变快照';
    copy.append(title, subtitle);
    if (permissions.has('ctr:create')) {
      const create = document.createElement('button');
      create.className = 'primary';
      create.textContent = '＋ 新建技术需求';
      create.addEventListener('click', () => {
        openForm(
          workspace,
          '新建技术需求',
          '技术需求单必须关联一个商机，提交前可以继续创建修订版本。',
          [
            {
              name: 'opportunityId',
              label: '关联商机',
              type: 'select',
              required: true,
              options: controller.opportunities.map((item) => ({
                value: item.id,
                label: item.name ?? item.id,
              })),
            },
            {
              name: 'code',
              label: '技术需求单编号',
              required: true,
              placeholder: 'JSXQ-2026-001',
            },
            {
              name: 'title',
              label: '需求标题',
              required: true,
              placeholder: '学校足球场人造草坪技术需求',
            },
            {
              name: 'application',
              label: '应用场景',
              type: 'select',
              required: true,
              options: [
                { value: '足球场', label: '足球场' },
                { value: '休闲景观', label: '休闲景观' },
                { value: '多功能运动场', label: '多功能运动场' },
                { value: '门球场', label: '门球场' },
                { value: '幼儿园活动区', label: '幼儿园活动区' },
                { value: '屋顶及露台', label: '屋顶及露台' },
              ],
            },
            { name: 'projectRegion', label: '项目地区', required: true, placeholder: '山东青岛' },
            {
              name: 'performanceStandard',
              label: '执行标准',
              type: 'select',
              required: true,
              options: [
                { value: '企业验收标准', label: '企业验收标准' },
                { value: 'GB/T 20394', label: 'GB/T 20394 体育用人造草' },
                { value: '国际足联场地质量标准', label: '国际足联场地质量标准' },
                { value: '客户技术规范', label: '客户技术规范' },
              ],
            },
            {
              name: 'pileHeight',
              label: '草高（mm）',
              type: 'number',
              required: true,
              placeholder: '50',
            },
            {
              name: 'quantity',
              label: '预计面积（㎡）',
              type: 'number',
              required: true,
              placeholder: '8000',
            },
            { name: 'color', label: '颜色要求', required: true, placeholder: '双色翠绿' },
            {
              name: 'baseCondition',
              label: '场地基础条件',
              required: true,
              placeholder: '沥青基础已完工，平整度待复测',
            },
            {
              name: 'drainageRequirement',
              label: '排水要求',
              required: true,
              placeholder: '暴雨后 30 分钟内无明显积水',
            },
            { name: 'fireRating', label: '阻燃要求', required: true, placeholder: '按项目规范' },
            {
              name: 'warrantyYears',
              label: '质保年限',
              type: 'number',
              required: true,
              value: '8',
            },
            { name: 'delivery', label: '交付要求', type: 'textarea', required: true },
          ],
          '创建技术需求',
          async (values) => {
            await controller.submit('/api/v1/ctrs', {
              opportunityId: values.opportunityId ?? '',
              code: values.code ?? '',
              title: values.title ?? '',
              requirements: {
                application: values.application ?? '',
                projectRegion: values.projectRegion ?? '',
                performanceStandard: values.performanceStandard ?? '',
                pileHeightMm: Number(values.pileHeight ?? 0),
                quantitySquareMeters: Number(values.quantity ?? 0),
                color: values.color ?? '',
                baseCondition: values.baseCondition ?? '',
                drainageRequirement: values.drainageRequirement ?? '',
                fireRating: values.fireRating ?? '',
                warrantyYears: Number(values.warrantyYears ?? 0),
                delivery: values.delivery ?? '',
              },
            });
            await controller.load();
            status.textContent = controller.message;
          },
        );
      });
      heading.append(copy, create);
    } else heading.append(copy);
    ctrPanel.append(heading);
    const table = document.createElement('div');
    table.className = 'ctr-table';
    const ctrs = controller.views.get('/api/v1/ctrs') ?? [];
    const latestVersionByCtr = new Map<string, number>();
    for (const item of ctrs) {
      const rootId = typeof item.ctrId === 'string' ? item.ctrId : '';
      const revision = typeof item.version === 'number' ? item.version : 0;
      latestVersionByCtr.set(rootId, Math.max(latestVersionByCtr.get(rootId) ?? 0, revision));
    }
    for (const ctr of ctrs) {
      const ctrCode = typeof ctr.code === 'string' ? ctr.code : '技术需求单';
      const ctrTitle = typeof ctr.title === 'string' ? ctr.title : '未命名需求';
      const ctrVersion = typeof ctr.version === 'number' ? ctr.version : 1;
      const ctrStatus = typeof ctr.status === 'string' ? ctr.status : 'DRAFT';
      const ctrId = typeof ctr.ctrId === 'string' ? ctr.ctrId : '';
      const requirements = recordValue(ctr.requirements);
      const attachments = Array.isArray(ctr.attachments) ? ctr.attachments : [];
      const row = document.createElement('article');
      row.className = 'ctr-row';
      const identity = document.createElement('div');
      const code = document.createElement('strong');
      code.textContent = ctrCode;
      const name = document.createElement('span');
      name.textContent = ctrTitle;
      identity.append(code, name);
      const version = document.createElement('span');
      version.textContent = `第 ${String(ctrVersion)} 版`;
      const state = document.createElement('span');
      state.className = `ctr-state state-${ctrStatus.toLocaleLowerCase()}`;
      state.textContent = ctrStatus;
      const actions = document.createElement('div');
      actions.className = 'ctr-actions';
      if (
        ctrStatus === 'DRAFT' &&
        permissions.has('ctr:update') &&
        permissions.has('attachment:manage')
      ) {
        const upload = document.createElement('button');
        upload.className = 'secondary';
        upload.textContent = '上传附件';
        upload.addEventListener('click', () => {
          openFileForm(
            workspace,
            `为 ${ctrCode} 第 ${String(ctrVersion)} 版上传附件`,
            async (file) => {
              await controller.uploadCtrAttachment(String(ctr.id), file);
              status.textContent = controller.message;
            },
          );
        });
        actions.append(upload);
      }
      if (
        ctrId !== '' &&
        ctrVersion === latestVersionByCtr.get(ctrId) &&
        ctrStatus !== 'DRAFT' &&
        permissions.has('ctr:update')
      ) {
        const revise = document.createElement('button');
        revise.className = 'secondary';
        revise.textContent = '新建修订';
        revise.addEventListener('click', () => {
          openForm(
            workspace,
            `新建 ${ctrCode} 修订`,
            `基于第 ${String(ctrVersion)} 版创建新的可编辑草稿，历史版本保持不变。`,
            [
              { name: 'title', label: '需求标题', required: true, value: ctrTitle },
              {
                name: 'application',
                label: '应用场景',
                required: true,
                value: displayRequirement(requirements.application),
              },
              {
                name: 'projectRegion',
                label: '项目地区',
                required: true,
                value: displayRequirement(requirements.projectRegion),
              },
              {
                name: 'performanceStandard',
                label: '执行标准',
                required: true,
                value: displayRequirement(requirements.performanceStandard),
              },
              {
                name: 'pileHeight',
                label: '草高（mm）',
                type: 'number',
                required: true,
                value: displayRequirement(requirements.pileHeightMm),
              },
              {
                name: 'quantity',
                label: '预计面积（㎡）',
                type: 'number',
                required: true,
                value: displayRequirement(requirements.quantitySquareMeters),
              },
              {
                name: 'color',
                label: '颜色要求',
                required: true,
                value: displayRequirement(requirements.color),
              },
              {
                name: 'baseCondition',
                label: '场地基础条件',
                required: true,
                value: displayRequirement(requirements.baseCondition),
              },
              {
                name: 'drainageRequirement',
                label: '排水要求',
                required: true,
                value: displayRequirement(requirements.drainageRequirement),
              },
              {
                name: 'fireRating',
                label: '阻燃要求',
                required: true,
                value: displayRequirement(requirements.fireRating),
              },
              {
                name: 'warrantyYears',
                label: '质保年限',
                type: 'number',
                required: true,
                value: displayRequirement(requirements.warrantyYears),
              },
              {
                name: 'delivery',
                label: '交付要求',
                type: 'textarea',
                required: true,
                value: displayRequirement(requirements.delivery),
              },
            ],
            '创建修订草稿',
            async (values) => {
              await controller.submit(`/api/v1/ctrs/${ctrId}/versions`, {
                title: values.title ?? '',
                requirements: {
                  application: values.application ?? '',
                  projectRegion: values.projectRegion ?? '',
                  performanceStandard: values.performanceStandard ?? '',
                  pileHeightMm: Number(values.pileHeight ?? 0),
                  quantitySquareMeters: Number(values.quantity ?? 0),
                  color: values.color ?? '',
                  baseCondition: values.baseCondition ?? '',
                  drainageRequirement: values.drainageRequirement ?? '',
                  fireRating: values.fireRating ?? '',
                  warrantyYears: Number(values.warrantyYears ?? 0),
                  delivery: values.delivery ?? '',
                },
              });
              await controller.load();
              status.textContent = controller.message;
            },
          );
        });
        actions.append(revise);
      }
      if (ctrStatus === 'DRAFT' && permissions.has('ctr:submit')) {
        const submit = document.createElement('button');
        submit.className = 'secondary';
        submit.textContent = '提交评审';
        submit.addEventListener('click', () => {
          openForm(
            workspace,
            '提交技术需求评审',
            '提交后当前版本将冻结，并生成不可变需求快照。',
            [],
            '确认提交评审',
            async () => {
              await controller.submit(`/api/v1/ctr-versions/${String(ctr.id)}/submit`, {
                expectedVersion: ctrVersion,
              });
              status.textContent = '技术需求已提交并生成不可变快照';
            },
          );
        });
        actions.append(submit);
      }
      if (ctrStatus === 'SUBMITTED' && permissions.has('ctr:approve')) {
        for (const [decision, label] of [
          ['APPROVED', '批准'],
          ['REJECTED', '驳回'],
        ] as const) {
          const decide = document.createElement('button');
          decide.className = decision === 'APPROVED' ? 'primary' : 'secondary';
          decide.textContent = label;
          decide.addEventListener('click', () => {
            openForm(
              workspace,
              `${label}技术需求`,
              '审批决定和理由将永久保留。',
              [{ name: 'reason', label: '审批意见', type: 'textarea', required: true }],
              `确认${label}`,
              async (values) => {
                await controller.submit(`/api/v1/ctr-versions/${String(ctr.id)}/decision`, {
                  decision,
                  reason: values.reason ?? '',
                });
                status.textContent = `技术需求已${label}`;
              },
            );
          });
          actions.append(decide);
        }
      }
      const evidence = document.createElement('details');
      evidence.className = 'ctr-evidence';
      const summary = document.createElement('summary');
      summary.textContent = `规格与证据 · ${String(attachments.length)} 个附件`;
      const specification = document.createElement('dl');
      specification.className = 'ctr-specification';
      const previous = ctrs.find((item) => item.ctrId === ctrId && item.version === ctrVersion - 1);
      const previousRequirements = recordValue(previous?.requirements);
      for (const [key, label] of ctrRequirementFields) {
        const term = document.createElement('dt');
        term.textContent = label;
        const definition = document.createElement('dd');
        const currentValue = displayRequirement(requirements[key]);
        const previousValue = displayRequirement(previousRequirements[key]);
        definition.textContent =
          previous && currentValue !== previousValue
            ? `${currentValue}（上一版：${previousValue}）`
            : currentValue;
        if (previous && currentValue !== previousValue) definition.className = 'changed';
        specification.append(term, definition);
      }
      evidence.append(summary, specification);
      row.append(identity, version, state, actions, evidence);
      table.append(row);
    }
    if (ctrs.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'pipeline-empty';
      empty.textContent = '暂无技术需求单，请先从已确认需求的商机创建。';
      table.append(empty);
    }
    ctrPanel.append(table);
    workspace.append(ctrPanel);
  }
  if (controller && permissions.has('technical-solution:read')) {
    const solutionPanel = el('section', 'solution-workbench');
    const solutionHeading = el('div', 'pipeline-heading');
    const solutionCopy = el('div');
    solutionCopy.append(el('h2', '', '技术方案'), el('p', '', '产品规格、工程条件与版本修订'));
    const solutions = controller.views.get('/api/v1/technical-solutions') ?? [];
    const ctrs = controller.views.get('/api/v1/ctrs') ?? [];
    const eligibleCtrs = ctrs.filter((item) => item.status === 'APPROVED');
    const solutionFields = (
      specification: Record<string, unknown> = {},
      assumptions: readonly unknown[] = [],
      ctrVersionId = '',
      state = 'DRAFT',
    ): readonly FormField[] => [
      {
        name: 'ctrVersionId',
        label: '已批准技术需求版本',
        type: 'select',
        required: true,
        value: ctrVersionId,
        options: eligibleCtrs.map((item) => ({
          value: String(item.id),
          label: `${textValue(item.code, '技术需求')} · 第 ${textValue(item.version, '1')} 版 · ${textValue(item.title, '')}`,
        })),
      },
      {
        name: 'productFamily',
        label: '产品系列',
        required: true,
        value: formValue(specification.productFamily),
      },
      {
        name: 'pileHeight',
        label: '草高（mm）',
        type: 'number',
        required: true,
        value: formValue(specification.pileHeightMm),
      },
      {
        name: 'dtex',
        label: '草丝纤度（分特）',
        type: 'number',
        required: true,
        value: formValue(specification.dtex),
      },
      {
        name: 'yarnMaterial',
        label: '草丝材质与形态',
        required: true,
        value: formValue(specification.yarnMaterial),
        placeholder: '聚乙烯单丝 + 曲丝',
      },
      {
        name: 'gauge',
        label: '行距',
        required: true,
        value: formValue(specification.gauge),
        placeholder: '3/4 英寸',
      },
      {
        name: 'stitchRate',
        label: '簇密度（针/㎡）',
        type: 'number',
        required: true,
        value: formValue(specification.stitchRate),
      },
      {
        name: 'backing',
        label: '底布系统',
        required: true,
        value: formValue(specification.backing),
      },
      {
        name: 'rollWidthMeters',
        label: '卷宽（米）',
        type: 'number',
        required: true,
        value: formValue(specification.rollWidthMeters),
      },
      {
        name: 'drainageRate',
        label: '排水能力（升/分钟/㎡）',
        type: 'number',
        required: true,
        value: formValue(specification.drainageRate),
      },
      {
        name: 'infill',
        label: '填充建议',
        required: true,
        value: formValue(specification.infill),
      },
      {
        name: 'warrantyYears',
        label: '质保年限',
        type: 'number',
        required: true,
        value: formValue(specification.warrantyYears),
      },
      {
        name: 'assumptions',
        label: '工程假设（每行一项）',
        type: 'textarea',
        required: true,
        value: assumptions.map(String).join('\n'),
      },
      {
        name: 'state',
        label: '方案状态',
        type: 'select',
        required: true,
        value: state,
        options: [
          { value: 'DRAFT', label: '草稿' },
          { value: 'FINAL', label: '定稿（可进入成本核算）' },
        ],
      },
    ];
    const solutionPayload = (values: Record<string, string>) => ({
      ctrVersionId: values.ctrVersionId ?? '',
      specification: {
        productFamily: values.productFamily ?? '',
        pileHeightMm: Number(values.pileHeight ?? 0),
        dtex: Number(values.dtex ?? 0),
        yarnMaterial: values.yarnMaterial ?? '',
        gauge: values.gauge ?? '',
        stitchRate: Number(values.stitchRate ?? 0),
        backing: values.backing ?? '',
        rollWidthMeters: Number(values.rollWidthMeters ?? 0),
        drainageRate: Number(values.drainageRate ?? 0),
        infill: values.infill ?? '',
        warrantyYears: Number(values.warrantyYears ?? 0),
      },
      assumptions: (values.assumptions ?? '')
        .split('\n')
        .map((item) => item.trim())
        .filter(Boolean),
      final: values.state === 'FINAL',
    });
    if (permissions.has('technical-solution:create') && eligibleCtrs.length > 0) {
      const createSolution = el('button', 'primary', '＋ 新建技术方案');
      createSolution.addEventListener('click', () => {
        openForm(
          workspace,
          '新建技术方案',
          '方案的每项规格都将关联到选定的已批准技术需求版本。',
          [
            { name: 'code', label: '方案编号', required: true, placeholder: 'TS-2026-001' },
            ...solutionFields(),
          ],
          '保存技术方案',
          async (values) => {
            await controller.submit('/api/v1/technical-solutions', {
              opportunityId: technicalSolutionOpportunityId(ctrs, values.ctrVersionId ?? ''),
              code: values.code ?? '',
              ...solutionPayload(values),
            });
            await controller.load();
            status.textContent = controller.message;
          },
        );
      });
      solutionHeading.append(solutionCopy, createSolution);
    } else solutionHeading.append(solutionCopy);
    solutionPanel.append(solutionHeading);
    const solutionList = el('div', 'solution-list');
    for (const solution of solutions) {
      const card = el('article', 'solution-card');
      const specification = recordValue(solution.specification);
      card.append(
        el(
          'strong',
          '',
          `${textValue(solution.code, '方案')} · 第 ${textValue(solution.revision, '1')} 版`,
        ),
        el(
          'span',
          `ctr-state state-${textValue(solution.status, 'DRAFT').toLocaleLowerCase()}`,
          textValue(solution.status, 'DRAFT'),
        ),
        el('p', 'muted', `技术需求版本：${textValue(solution.ctrVersionId, '—')}`),
      );
      const specs = el('dl', 'ctr-specification');
      const previousSolution = solutions.find(
        (item) =>
          item.technicalSolutionId === solution.technicalSolutionId &&
          Number(item.revision) === Number(solution.revision) - 1,
      );
      const previousSpecification = recordValue(previousSolution?.specification);
      for (const [key, label] of [
        ['productFamily', '产品系列'],
        ['pileHeightMm', '草高（mm）'],
        ['dtex', '草丝纤度（分特）'],
        ['yarnMaterial', '草丝材质与形态'],
        ['gauge', '行距'],
        ['stitchRate', '簇密度'],
        ['backing', '底布系统'],
        ['rollWidthMeters', '卷宽（米）'],
        ['drainageRate', '排水能力'],
        ['infill', '填充建议'],
        ['warrantyYears', '质保年限'],
      ] as const) {
        const currentValue = displayRequirement(specification[key]);
        const previousValue = displayRequirement(previousSpecification[key]);
        specs.append(
          el('dt', '', label),
          el(
            'dd',
            previousSolution && currentValue !== previousValue ? 'changed' : '',
            previousSolution && currentValue !== previousValue
              ? `${currentValue}（上一版：${previousValue}）`
              : currentValue,
          ),
        );
      }
      card.append(specs);
      if (permissions.has('technical-solution:update')) {
        const revise = el('button', 'secondary', '创建方案修订');
        revise.addEventListener('click', () => {
          openForm(
            workspace,
            `修订 ${textValue(solution.code, '技术方案')}`,
            '新修订将保留旧版本及其技术需求引用。',
            solutionFields(
              specification,
              Array.isArray(solution.assumptions) ? solution.assumptions : [],
              textValue(solution.ctrVersionId, ''),
              textValue(solution.status, 'DRAFT'),
            ),
            '保存新修订',
            async (values) => {
              await controller.submit(
                `/api/v1/technical-solutions/${textValue(solution.technicalSolutionId, '')}/revisions`,
                solutionPayload(values),
              );
              await controller.load();
              status.textContent = controller.message;
            },
          );
        });
        card.append(revise);
      }
      solutionList.append(card);
    }
    if (solutions.length === 0)
      solutionList.append(
        el('p', 'pipeline-empty', '暂无技术方案；请先批准技术需求，再建立结构化方案。'),
      );
    solutionPanel.append(solutionList);
    workspace.append(solutionPanel);
  }
  if (
    controller &&
    (permissions.has('cost:read') ||
      permissions.has('cost-model:read') ||
      permissions.has('cost-matrix:read'))
  ) {
    const costPanel = el('section', 'decision-workbench cost-workbench');
    const costHeading = el('div', 'pipeline-heading');
    const costCopy = el('div');
    costCopy.append(el('h2', '', '成本核算'), el('p', '', '成本模型、核算明细与版本依据'));
    const models = controller.views.get('/api/v1/cost-models') ?? [];
    const publishedModels = models.filter((item) => item.status === 'PUBLISHED');
    const solutions = (controller.views.get('/api/v1/technical-solutions') ?? []).filter(
      (item) => item.status === 'FINAL',
    );
    if (permissions.has('cost-model:manage')) {
      const createModel = el('button', 'secondary', '新建成本模型');
      createModel.addEventListener('click', () => {
        openForm(
          workspace,
          '新建成本模型',
          '发布后该版本可用于成本核算；管理费按成本小计的比例追加。',
          [
            { name: 'code', label: '模型编号', required: true, placeholder: 'CM-2026-01' },
            { name: 'name', label: '模型名称', required: true, placeholder: '标准项目成本模型' },
            {
              name: 'currency',
              label: '币种',
              type: 'select',
              required: true,
              options: [
                { value: 'CNY', label: '人民币' },
                { value: 'USD', label: '美元 USD' },
              ],
            },
            {
              name: 'overheadPercent',
              label: '管理费率（%）',
              type: 'number',
              required: true,
              value: '3',
            },
          ],
          '发布模型',
          async (values) => {
            const multiplier = 1 + Number(values.overheadPercent ?? 0) / 100;
            await controller.submit('/api/v1/cost-models', {
              code: values.code ?? '',
              name: values.name ?? '',
              currency: values.currency ?? 'CNY',
              rules: [
                {
                  when: { op: 'literal', value: true },
                  adjustment: { kind: 'MULTIPLY', value: multiplier.toFixed(6) },
                  reason: `管理费率 ${values.overheadPercent ?? '0'}%`,
                },
              ],
              publish: true,
            });
            await controller.load();
            status.textContent = controller.message;
          },
        );
      });
      costHeading.append(costCopy, createModel);
    } else costHeading.append(costCopy);
    costPanel.append(costHeading);
    const costFlow = el('ol', 'cost-governance-flow');
    for (const [role, action] of [
      ['采购专员', '维护采购订单、合同价与有效供应商报价'],
      ['成本测算专员', '维护因子、核验来源并冻结成本快照'],
      ['报价编制专员', '按商机与技术方案引用成本生成报价'],
      ['报价审批 / 签发', '校验毛利、折扣与销售政策后冻结版本'],
      ['合同与订单岗位', '签署合同并由已签发报价创建销售订单'],
    ]) {
      const step = el('li');
      step.append(el('strong', '', role ?? ''), el('span', '', action ?? ''));
      costFlow.append(step);
    }
    costPanel.append(costFlow);
    const matrices = controller.views.get('/api/v1/cost-matrices') ?? [];
    const itemVersions = (controller.views.get('/api/v1/manufacturing-items') ?? []).flatMap(
      (item) =>
        (Array.isArray(item.versions) ? item.versions : []).map((candidate) => {
          const version = candidate as Record<string, unknown>;
          return {
            value: textValue(version.id, ''),
            label: `${textValue(item.sku, '物料')} · ${textValue(item.name, '')} · 第 ${textValue(version.version, '1')} 版`,
          };
        }),
    );
    const categoryOptions = [
      ['DIRECT_MATERIAL', '直接材料'],
      ['DIRECT_LABOR', '直接人工'],
      ['DIRECT_ENERGY', '直接能源'],
      ['DIRECT_OVERHEAD', '直接制造费用'],
      ['FIXED', '固定成本（预留）'],
      ['PERSONNEL', '人员成本（预留）'],
      ['FINANCE', '财务费用（预留）'],
      ['MARKETING', '营销费用（预留）'],
      ['OTHER', '其他费用'],
    ].map(([value, label]) => ({ value: value ?? '', label: label ?? '' }));
    const sourceOptions = [
      { value: 'PURCHASE_ORDER', label: '已下达采购订单 / 合同价' },
      { value: 'SUPPLIER_QUOTE', label: '有效供应商报价' },
      { value: 'MARKET_REFERENCE', label: '市场公开参考价' },
      { value: 'INTERNAL_BENCHMARK', label: '企业计划成本基准' },
      { value: 'MANUAL', label: '临时手工录入' },
    ];
    const unitOptions = [
      { value: 'KG', label: '千克 kg' },
      { value: 'M2', label: '平方米 m²' },
      { value: 'HOUR', label: '工时' },
      { value: 'KWH', label: '千瓦时 kWh' },
      { value: 'EA', label: '项 / 件' },
    ];
    const matrixSection = el('section', 'cost-matrix-section cost-matrix-ledger-workspace');
    const costDialogHost = () =>
      matrixSection.closest<HTMLElement>('.commercial-workspace') ?? workspace;
    const setCostStatus = (message: string) => {
      const liveStatus = costDialogHost().querySelector<HTMLElement>('.commercial-status');
      (liveStatus ?? status).textContent = message;
    };
    const replaceCostMatrixSection = (accepted = true) => {
      if (!accepted) return;
      const host = costDialogHost();
      const focused = document.activeElement;
      const input =
        typeof HTMLInputElement !== 'undefined' &&
        focused instanceof HTMLInputElement &&
        matrixSection.contains(focused)
          ? focused
          : null;
      const label = input?.getAttribute('aria-label');
      const selection = input ? ([input.selectionStart, input.selectionEnd] as const) : null;
      const refreshedSection = commercialWorkspaceStructure(
        viewport,
        immutable,
        controller,
      ).querySelector<HTMLElement>('.cost-matrix-section');
      const liveSection = host.querySelector<HTMLElement>('.cost-matrix-section');
      if (refreshedSection && liveSection) {
        liveSection.replaceWith(refreshedSection);
        if (input && label) {
          const replacement = Array.from(refreshedSection.querySelectorAll('input')).find(
            (item) => item.getAttribute('aria-label') === label,
          );
          if (replacement) {
            replacement.value = input.value;
            replacement.focus();
            if (selection) replacement.setSelectionRange(...selection);
          }
        }
      }
    };
    const refreshCostWorkspace = async (message: string) => {
      await controller.loadCostMatrixPage();
      await controller.refreshSelectedCostMatrix();
      controller.message = message;
      setCostStatus(message);
      replaceCostMatrixSection();
    };
    const openMatrix = (matrix: Record<string, unknown>, trigger: HTMLButtonElement) => {
      void (async () => {
        trigger.disabled = true;
        trigger.textContent = '加载中…';
        trigger.setAttribute('aria-busy', 'true');
        try {
          await controller.openCostMatrix(textValue(matrix.id, ''));
          replaceCostMatrixSection();
        } catch (failure) {
          setCostStatus(
            failure instanceof Error ? `模型详情加载失败：${failure.message}` : '模型详情加载失败',
          );
          trigger.disabled = false;
          trigger.textContent = '查看模型';
          trigger.setAttribute('aria-busy', 'false');
        }
      })();
    };
    const factorFields = (
      matrix: Record<string, unknown>,
      factor?: Record<string, unknown>,
    ): readonly FormField[] => [
      ...(factor
        ? []
        : [
            {
              name: 'factorCode',
              label: '因子编号',
              required: true,
              placeholder: 'YARN-PE',
              section: '基本信息',
            },
          ]),
      {
        name: 'factorName',
        label: '因子名称',
        required: true,
        value: textValue(factor?.factorName, ''),
        placeholder: 'PE 草丝',
        ...(factor ? { section: '基本信息' } : {}),
      },
      {
        name: 'category',
        label: '成本类别',
        type: 'select',
        required: true,
        value: textValue(factor?.category, 'DIRECT_MATERIAL'),
        options: categoryOptions,
      },
      {
        name: 'sourceType',
        label: '价格来源',
        type: 'select',
        required: true,
        value: textValue(factor?.sourceType, 'MARKET_REFERENCE'),
        options: sourceOptions,
        section: '耗用与价格',
      },
      ...(itemVersions.length
        ? [
            {
              name: 'sourceItemVersionId',
              label: '关联采购物料',
              type: 'select' as const,
              required: false,
              value: textValue(factor?.sourceItemVersionId, ''),
              options: [{ value: '', label: '市场/计划因子无需关联' }, ...itemVersions],
            },
          ]
        : []),
      {
        name: 'quantity',
        label: '单位产品耗用量',
        type: 'number',
        required: true,
        step: 0.000001,
        value: textValue(factor?.quantity, '1'),
      },
      {
        name: 'unitCode',
        label: '耗用单位',
        type: 'select',
        required: true,
        value: textValue(factor?.unitCode, 'KG'),
        options: unitOptions,
      },
      {
        name: 'manualUnitPriceTaxInclusive',
        label: '含税单价 / 回退价',
        type: 'number',
        required: true,
        step: 0.000001,
        value: textValue(factor?.manualUnitPriceTaxInclusive, '1'),
      },
      {
        name: 'taxRate',
        label: '税率（小数）',
        type: 'number',
        required: true,
        step: 0.000001,
        value: textValue(factor?.taxRate, textValue(matrix.defaultTaxRate, '0.13')),
      },
      {
        name: 'priceSourceName',
        label: '来源名称',
        required: true,
        value: textValue(factor?.priceSourceName, ''),
        placeholder: '采购合同、供应商报价或市场数据平台',
        section: '价格依据与追溯',
      },
      {
        name: 'priceSourceReference',
        label: '单号 / 合同号 / 来源链接',
        value: textValue(factor?.priceSourceReference, ''),
      },
      {
        name: 'priceEffectiveAt',
        label: '价格生效日期',
        type: 'date',
        value: textValue(factor?.priceEffectiveAt, ''),
      },
      {
        name: 'sortOrder',
        label: '显示顺序',
        type: 'number',
        required: true,
        value: textValue(factor?.sortOrder, '0'),
      },
      {
        name: 'priceNote',
        label: '取数说明',
        type: 'textarea',
        value: textValue(factor?.priceNote, ''),
        fullWidth: true,
      },
    ];
    const factorPayload = (
      values: Readonly<Record<string, string>>,
      includeCode: boolean,
    ): Record<string, unknown> => ({
      ...(includeCode ? { factorCode: values.factorCode ?? '' } : {}),
      factorName: values.factorName ?? '',
      category: values.category ?? 'DIRECT_MATERIAL',
      sourceType: values.sourceType ?? 'MANUAL',
      ...(values.sourceItemVersionId ? { sourceItemVersionId: values.sourceItemVersionId } : {}),
      quantity: values.quantity ?? '1',
      unitCode: values.unitCode ?? 'EA',
      manualUnitPriceTaxInclusive: values.manualUnitPriceTaxInclusive ?? '0',
      taxRate: values.taxRate ?? '0.13',
      priceSourceName: values.priceSourceName ?? '人工录入',
      ...(values.priceSourceReference ? { priceSourceReference: values.priceSourceReference } : {}),
      ...(values.priceEffectiveAt ? { priceEffectiveAt: values.priceEffectiveAt } : {}),
      ...(values.priceNote ? { priceNote: values.priceNote } : {}),
      adjustable: true,
      sortOrder: Number(values.sortOrder ?? 0),
    });
    const selectedId = controller.selectedCostMatrixId;
    const selectedMatrix = selectedId ? controller.costMatrixDetails.get(selectedId) : undefined;

    if (selectedId && selectedMatrix) {
      const latest = recordValue(selectedMatrix.latestCalculation);
      const factors = Array.isArray(selectedMatrix.factors) ? selectedMatrix.factors : [];
      const calculations = Array.isArray(selectedMatrix.calculations)
        ? selectedMatrix.calculations
        : latest.id
          ? [latest]
          : [];
      const auditTrail = Array.isArray(selectedMatrix.auditTrail) ? selectedMatrix.auditTrail : [];
      const detailHeading = el('div', 'cost-matrix-detail-heading');
      const back = el('button', 'secondary cost-matrix-back', '← 返回成本模型');
      back.addEventListener('click', () => {
        controller.closeCostMatrix();
        replaceCostMatrixSection();
      });
      const headingCopy = el('div');
      headingCopy.append(
        el('p', 'eyebrow', textValue(selectedMatrix.code, '规格成本模型')),
        el('h3', '', textValue(selectedMatrix.name, '未命名规格模型')),
        el(
          'p',
          'muted',
          `${textValue(selectedMatrix.productSku, '未关联成品')} · ${currencyLabel(selectedMatrix.currency)} · 默认税率 ${(
            Number(selectedMatrix.defaultTaxRate ?? 0) * 100
          ).toFixed(0)}%`,
        ),
      );
      detailHeading.append(back, headingCopy);
      if (selectedMatrix.isSystemPreset === true)
        detailHeading.append(el('span', 'ctr-state state-approved', '系统预置'));
      matrixSection.append(detailHeading);

      const summary = el('div', 'cost-matrix-detail-summary');
      const missingFactors = factors.filter((candidate) => {
        const factor = recordValue(candidate);
        return (
          Number(factor.quantity ?? 0) > 0 &&
          (Number(factor.manualUnitPriceTaxInclusive ?? 0) <= 0 ||
            !textValue(factor.priceSourceName, '') ||
            !textValue(factor.priceEffectiveAt, ''))
        );
      }).length;
      for (const [label, value, tone] of [
        ['成本因子', `${String(factors.length)} 项`, ''],
        ['待补数据', `${String(missingFactors)} 项`, missingFactors > 0 ? 'attention' : ''],
        [
          '直接生产成本',
          latest.id ? `¥ ${Number(latest.directProductionCost ?? 0).toFixed(2)}` : '未核算',
          '',
        ],
        [
          '综合成本',
          latest.id ? `¥ ${Number(latest.totalCost ?? 0).toFixed(2)}` : '未核算',
          'strong',
        ],
      ] as const) {
        const metric = el('div', `cost-matrix-detail-metric ${tone}`.trim());
        metric.append(el('span', '', label), el('strong', '', value));
        summary.append(metric);
      }
      matrixSection.append(summary);

      const detailActions = el('div', 'cost-matrix-detail-actions');
      const actionStatus = el(
        'p',
        'cost-matrix-action-status',
        latest.id
          ? `最近核算：${textValue(latest.pricingMode, '') === 'TAX_EXCLUSIVE' ? '未税成本' : '含税成本'} · ${textValue(latest.calculatedAt, '') ? new Date(textValue(latest.calculatedAt, '')).toLocaleString('zh-CN') : '时间未知'}`
          : '尚未核算；请先核验所有价格来源。',
      );
      actionStatus.setAttribute('role', 'status');
      actionStatus.setAttribute('aria-live', 'polite');
      if (permissions.has('cost-matrix:manage')) {
        const add = el('button', 'secondary', '添加成本因子');
        add.addEventListener('click', () => {
          openForm(
            costDialogHost(),
            `添加因子 · ${textValue(selectedMatrix.name, '')}`,
            '按基本信息、耗用价格和追溯依据分区维护；采购来源须关联物料。',
            factorFields(selectedMatrix),
            '保存因子',
            async (values) => {
              await controller.submit(
                `/api/v1/cost-matrices/${selectedId}/factors`,
                factorPayload(values, true),
              );
              await refreshCostWorkspace(`${values.factorName ?? '成本因子'}已添加并显示`);
            },
            { className: 'cost-factor-dialog' },
          );
        });
        detailActions.append(add);
      }
      const calculateButtons: HTMLButtonElement[] = [];
      if (permissions.has('cost-matrix:calculate'))
        for (const [mode, label] of [
          ['TAX_INCLUSIVE', '重新核算含税成本'],
          ['TAX_EXCLUSIVE', '重新核算未税成本'],
        ] as const) {
          const calculate = el('button', mode === 'TAX_INCLUSIVE' ? 'primary' : 'secondary', label);
          calculate.setAttribute('data-cost-matrix-calculate', mode);
          calculate.addEventListener('click', () => {
            void (async () => {
              for (const button of calculateButtons) button.disabled = true;
              calculate.textContent = '核算中…';
              calculate.setAttribute('aria-busy', 'true');
              actionStatus.className = 'cost-matrix-action-status pending';
              actionStatus.textContent = `正在核算${mode === 'TAX_INCLUSIVE' ? '含税' : '未税'}成本，请稍候…`;
              setCostStatus(actionStatus.textContent);
              try {
                const previousTotal = Number(latest.totalCost ?? 0);
                await controller.submit(`/api/v1/cost-matrices/${selectedId}/calculate`, {
                  pricingMode: mode,
                });
                const total = Number(controller.revisionState?.totalCost ?? 0);
                const delta = latest.id ? total - previousTotal : 0;
                await refreshCostWorkspace(
                  `${textValue(selectedMatrix.name, '成本模型')}核算完成：综合成本 ¥ ${total.toFixed(2)}${latest.id ? `，较上次 ${delta >= 0 ? '+' : ''}${delta.toFixed(2)}` : ''}`,
                );
              } catch (failure) {
                actionStatus.className = 'cost-matrix-action-status error';
                actionStatus.textContent =
                  failure instanceof Error ? `核算失败：${failure.message}` : '核算失败';
                setCostStatus(actionStatus.textContent);
              } finally {
                for (const button of calculateButtons) button.disabled = false;
                calculate.textContent = label;
                calculate.setAttribute('aria-busy', 'false');
              }
            })();
          });
          calculateButtons.push(calculate);
          detailActions.append(calculate);
        }
      if (
        latest.id &&
        permissions.has('cost:evaluate') &&
        publishedModels.length > 0 &&
        solutions.length > 0
      ) {
        if (latest.costDecisionId) {
          detailActions.append(el('span', 'ctr-state state-approved', '已进入报价成本池'));
          if (permissions.has('quote:read') && permissions.has('quote:create')) {
            const continueQuote = el('button', 'primary', '继续销售报价');
            continueQuote.addEventListener('click', () => {
              controller.preferredQuoteCostDecisionId = textValue(latest.costDecisionId, '');
              setAppRoute('quotes');
              costDialogHost()
                .querySelector<HTMLButtonElement>('.quote-workbench [data-create-quote]')
                ?.click();
            });
            detailActions.append(continueQuote);
          }
        } else {
          const quoteCost = el('button', 'primary', '冻结并用于报价');
          quoteCost.addEventListener('click', () => {
            openForm(
              costDialogHost(),
              `生成报价成本 · ${textValue(selectedMatrix.name, '')}`,
              '冻结本次因子取数，生成报价可选用的成本决策；后续报价、审批、合同和订单均引用该快照。',
              [
                {
                  name: 'technicalSolutionRevisionId',
                  label: '最终技术方案 / 商机',
                  type: 'select',
                  required: true,
                  options: solutions.map((solution) => ({
                    value: textValue(solution.id, ''),
                    label: `${textValue(solution.code, '技术方案')} · 商机 ${textValue(solution.opportunityId, '')}`,
                  })),
                },
                {
                  name: 'modelVersionId',
                  label: '企业成本规则版本',
                  type: 'select',
                  required: true,
                  options: publishedModels.map((model) => ({
                    value: textValue(model.id, ''),
                    label: `${textValue(model.code, '成本规则')} · v${textValue(model.version, '1')}`,
                  })),
                },
              ],
              '冻结并进入报价',
              async (values) => {
                await controller.submit(
                  `/api/v1/cost-matrix-calculations/${textValue(latest.id, '')}/quote-cost-decision`,
                  {
                    technicalSolutionRevisionId: values.technicalSolutionRevisionId ?? '',
                    modelVersionId: values.modelVersionId ?? '',
                  },
                );
                const costDecisionId = textValue(controller.revisionState?.costDecisionId, '');
                if (!costDecisionId) throw new Error('服务器未返回报价成本决策编号');
                controller.preferredQuoteCostDecisionId = costDecisionId;
                await controller.refreshViews(['/api/v1/cost-evaluations']);
                await controller.loadCostMatrixPage();
                await controller.refreshSelectedCostMatrix();
                const canContinueQuote =
                  permissions.has('quote:read') && permissions.has('quote:create');
                controller.message = canContinueQuote
                  ? `${textValue(selectedMatrix.name, '成本模型')}已形成报价成本快照，正在进入销售报价`
                  : `${textValue(selectedMatrix.name, '成本模型')}已进入报价成本池，等待报价编制专员处理`;
                const liveWorkspace = costDialogHost();
                const refreshedWorkspace = commercialWorkspaceStructure(
                  viewport,
                  immutable,
                  controller,
                );
                liveWorkspace.replaceWith(refreshedWorkspace);
                if (!canContinueQuote) return;
                setAppRoute('quotes');
                const continueToQuote = () =>
                  refreshedWorkspace
                    .querySelector<HTMLButtonElement>('[data-create-quote]')
                    ?.click();
                if (typeof globalThis.requestAnimationFrame === 'function')
                  globalThis.requestAnimationFrame(continueToQuote);
                else continueToQuote();
              },
            );
          });
          detailActions.append(quoteCost);
        }
      }
      matrixSection.append(detailActions, actionStatus);

      const tabs = el('div', 'cost-matrix-tabs');
      tabs.setAttribute('role', 'tablist');
      tabs.setAttribute('aria-label', '成本模型详情');
      const tabPanels = new Map<string, HTMLElement>();
      const selectTab = (tabId: string) => {
        for (const button of Array.from(tabs.querySelectorAll<HTMLButtonElement>('button'))) {
          const selected = button.dataset.costMatrixTab === tabId;
          button.classList.toggle('active', selected);
          button.setAttribute('aria-selected', String(selected));
          button.tabIndex = selected ? 0 : -1;
        }
        for (const [id, panel] of tabPanels) panel.hidden = id !== tabId;
      };
      for (const [id, label] of [
        ['factors', `成本因子（${String(factors.length)}）`],
        ['calculations', `核算记录（${String(calculations.length)}）`],
        ['quote', '报价引用'],
        ['audit', `变更日志（${String(auditTrail.length)}）`],
      ]) {
        if (id === 'audit' && selectedMatrix.auditTrailVisible !== true) continue;
        const button = el('button', id === 'factors' ? 'active' : '', label ?? '');
        button.type = 'button';
        button.dataset.costMatrixTab = id;
        button.setAttribute('role', 'tab');
        button.setAttribute('aria-selected', String(id === 'factors'));
        button.id = `cost-tab-${id ?? ''}`;
        button.setAttribute('aria-controls', `cost-panel-${id ?? ''}`);
        button.tabIndex = id === 'factors' ? 0 : -1;
        button.addEventListener('keydown', (event) => {
          const buttons = Array.from(tabs.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
          const index = buttons.indexOf(button);
          const nextIndex =
            event.key === 'ArrowRight'
              ? (index + 1) % buttons.length
              : event.key === 'ArrowLeft'
                ? (index + buttons.length - 1) % buttons.length
                : event.key === 'Home'
                  ? 0
                  : event.key === 'End'
                    ? buttons.length - 1
                    : -1;
          const next = buttons[nextIndex];
          if (!next) return;
          event.preventDefault();
          selectTab(next.dataset.costMatrixTab ?? 'factors');
          next.focus();
        });
        button.addEventListener('click', () => {
          selectTab(id ?? 'factors');
        });
        tabs.append(button);
      }
      matrixSection.append(tabs);

      const factorsPanel = el('section', 'cost-matrix-tab-panel cost-factor-ledger');
      factorsPanel.setAttribute('role', 'tabpanel');
      const factorHeader = el('div', 'cost-factor-ledger-row header');
      for (const label of [
        '成本因子',
        '类别',
        '耗用量',
        '价格来源',
        '含税单价',
        '参考成本',
        '操作',
      ])
        factorHeader.append(el('span', '', label));
      factorsPanel.append(factorHeader);
      for (const candidate of factors) {
        const factor = recordValue(candidate);
        const procurementPriced =
          factor.sourceType === 'PURCHASE_ORDER' || factor.sourceType === 'SUPPLIER_QUOTE';
        const row = el('div', 'cost-factor-ledger-row');
        const identity = el('div', 'cost-factor-ledger-name');
        identity.append(
          el('strong', '', textValue(factor.factorName, '成本因子')),
          el('small', '', textValue(factor.factorCode, '')),
        );
        row.append(
          identity,
          el(
            'span',
            '',
            categoryOptions.find((option) => option.value === factor.category)?.label ??
              textValue(factor.category, '其他费用'),
          ),
          el(
            'span',
            'numeric',
            `${textValue(factor.quantity, '0')} ${textValue(factor.unitCode, 'EA')}/㎡`,
          ),
        );
        const source = el('div', 'cost-factor-ledger-source');
        source.append(
          el(
            'strong',
            '',
            sourceOptions.find((option) => option.value === factor.sourceType)?.label ??
              textValue(factor.sourceType, '人工录入'),
          ),
          el(
            'small',
            '',
            `${textValue(factor.priceSourceName, '未说明')} · ${textValue(factor.priceEffectiveAt, '未标日期')}`,
          ),
        );
        row.append(
          source,
          el(
            'span',
            'numeric',
            procurementPriced
              ? '核算时取有效采购价'
              : `¥ ${Number(factor.manualUnitPriceTaxInclusive ?? 0).toFixed(4)}`,
          ),
          el(
            'strong',
            'numeric cost-factor-amount',
            procurementPriced
              ? '以核算快照为准'
              : `¥ ${(
                  Number(factor.quantity ?? 0) * Number(factor.manualUnitPriceTaxInclusive ?? 0)
                ).toFixed(4)}`,
          ),
        );
        const rowActions = el('div', 'cost-factor-ledger-actions');
        if (permissions.has('cost-matrix:manage') && factor.adjustable !== false) {
          const edit = el('button', 'secondary compact-action', '编辑');
          edit.setAttribute('aria-label', `编辑${textValue(factor.factorName, '成本因子')}`);
          edit.addEventListener('click', () => {
            openForm(
              costDialogHost(),
              `维护因子 · ${textValue(factor.factorName, '')}`,
              '采购来源需绑定物料；市场或企业基准必须保留来源和生效日期。',
              factorFields(selectedMatrix, factor),
              '保存因子',
              async (values) => {
                await controller.submit(
                  `/api/v1/cost-matrices/${selectedId}/factors/${textValue(factor.id, '')}`,
                  factorPayload(values, false),
                  'PATCH',
                );
                await refreshCostWorkspace(`${textValue(factor.factorName, '成本因子')}已更新`);
              },
              { className: 'cost-factor-dialog' },
            );
          });
          rowActions.append(edit);
        } else rowActions.append(el('span', 'muted', '只读'));
        row.append(rowActions);
        for (const [index, label] of [
          '成本因子',
          '类别',
          '耗用量',
          '价格来源',
          '含税单价',
          '参考成本',
          '操作',
        ].entries())
          row.children[index]?.setAttribute('data-field-label', label);
        factorsPanel.append(row);
      }
      if (factors.length === 0)
        factorsPanel.append(
          el('p', 'pipeline-empty', '尚未配置成本因子。请先录入材料、人工、能源与预留费用。'),
        );
      tabPanels.set('factors', factorsPanel);
      matrixSection.append(factorsPanel);

      const calculationsPanel = el('section', 'cost-matrix-tab-panel cost-calculation-ledger');
      calculationsPanel.hidden = true;
      const calculationHeader = el('div', 'cost-calculation-row header');
      for (const label of ['核算时间', '口径', '直接成本', '预留费用', '综合成本', '报价状态'])
        calculationHeader.append(el('span', '', label));
      calculationsPanel.append(calculationHeader);
      for (const candidate of calculations) {
        const calculation = recordValue(candidate);
        const row = el('div', 'cost-calculation-row');
        row.append(
          el(
            'span',
            '',
            textValue(calculation.calculatedAt, '')
              ? new Date(textValue(calculation.calculatedAt, '')).toLocaleString('zh-CN')
              : '时间未知',
          ),
          el(
            'span',
            '',
            textValue(calculation.pricingMode, '') === 'TAX_EXCLUSIVE' ? '未税成本' : '含税成本',
          ),
          el('span', 'numeric', `¥ ${Number(calculation.directProductionCost ?? 0).toFixed(2)}`),
          el('span', 'numeric', `¥ ${Number(calculation.reservedExpenseCost ?? 0).toFixed(2)}`),
          el('strong', 'numeric', `¥ ${Number(calculation.totalCost ?? 0).toFixed(2)}`),
          el(
            'span',
            calculation.costDecisionId ? 'state-inline success' : 'state-inline',
            calculation.costDecisionId ? '已进入报价' : '未引用',
          ),
        );
        for (const [index, label] of [
          '核算时间',
          '口径',
          '直接成本',
          '预留费用',
          '综合成本',
          '报价状态',
        ].entries())
          row.children[index]?.setAttribute('data-field-label', label);
        calculationsPanel.append(row);
      }
      if (calculations.length === 0)
        calculationsPanel.append(el('p', 'pipeline-empty', '暂无核算记录。'));
      tabPanels.set('calculations', calculationsPanel);
      matrixSection.append(calculationsPanel);

      const quotePanel = el('section', 'cost-matrix-tab-panel cost-matrix-quote-panel');
      quotePanel.hidden = true;
      quotePanel.append(
        el('h4', '', latest.costDecisionId ? '该模型已进入报价流程' : '当前模型尚未进入报价流程'),
        el(
          'p',
          'muted',
          latest.costDecisionId
            ? `报价成本决策：${textValue(latest.costDecisionId, '')}。后续报价、审批、合同和订单将引用这一冻结快照。`
            : '完成核算后，由具备成本评价权限的岗位选择最终技术方案和企业成本规则，冻结成本并交给报价编制专员。',
        ),
      );
      tabPanels.set('quote', quotePanel);
      matrixSection.append(quotePanel);

      const auditPanel = el('section', 'cost-matrix-tab-panel cost-matrix-audit-ledger');
      auditPanel.hidden = true;
      for (const candidate of auditTrail) {
        const audit = recordValue(candidate);
        const row = el('div', 'cost-matrix-audit-row');
        row.append(
          el('strong', '', costMatrixAuditLabel(textValue(audit.action, ''))),
          el(
            'span',
            '',
            `${textValue(audit.actorName, textValue(audit.actorId, '系统'))} · ${textValue(audit.occurredAt, '') ? new Date(textValue(audit.occurredAt, '')).toLocaleString('zh-CN') : '时间未知'}`,
          ),
        );
        auditPanel.append(row);
      }
      if (auditTrail.length === 0)
        auditPanel.append(el('p', 'pipeline-empty', '暂无可见变更日志。'));
      tabPanels.set('audit', auditPanel);
      if (selectedMatrix.auditTrailVisible === true) matrixSection.append(auditPanel);
      for (const [id, panel] of tabPanels) {
        panel.id = `cost-panel-${id}`;
        panel.setAttribute('role', 'tabpanel');
        panel.setAttribute('aria-labelledby', `cost-tab-${id}`);
        panel.tabIndex = 0;
      }
    } else {
      const matrixHeading = el('div', 'pipeline-heading');
      const matrixHeadingCopy = el('div');
      matrixHeadingCopy.append(
        el('h3', '', '规格成本模型台账'),
        el('p', 'muted', costMatrixRoleGuidance(permissions)),
      );
      matrixHeading.append(matrixHeadingCopy);
      if (permissions.has('cost-matrix:manage')) {
        const createMatrix = el('button', 'primary', '新建规格模型');
        createMatrix.addEventListener('click', () => {
          openForm(
            costDialogHost(),
            '新建规格成本模型',
            '每种成品规格独立维护成本因子、税率和价格来源。',
            [
              { name: 'code', label: '规格模型编号', required: true, placeholder: 'KT-50-3/8' },
              {
                name: 'name',
                label: '产品规格名称',
                required: true,
                placeholder: '50mm 单丝加密型',
              },
              ...(itemVersions.length
                ? [
                    {
                      name: 'productItemVersionId',
                      label: '关联成品规格',
                      type: 'select' as const,
                      required: false,
                      options: [{ value: '', label: '暂不关联' }, ...itemVersions],
                    },
                  ]
                : []),
              {
                name: 'currency',
                label: '币种',
                type: 'select',
                required: true,
                options: [{ value: 'CNY', label: '人民币' }],
              },
              {
                name: 'defaultTaxRate',
                label: '默认税率（小数）',
                type: 'number',
                required: true,
                value: '0.13',
              },
            ],
            '创建模型',
            async (values) => {
              await controller.submit('/api/v1/cost-matrices', {
                code: values.code ?? '',
                name: values.name ?? '',
                ...(values.productItemVersionId
                  ? { productItemVersionId: values.productItemVersionId }
                  : {}),
                productSpecification: { displayName: values.name ?? '' },
                currency: values.currency ?? 'CNY',
                defaultTaxRate: values.defaultTaxRate ?? '0.13',
              });
              await controller.loadCostMatrixPage({ page: 1 });
              controller.message = `${values.name ?? '规格模型'}已创建`;
              setCostStatus(controller.message);
              replaceCostMatrixSection();
            },
          );
        });
        matrixHeading.append(createMatrix);
      }
      matrixSection.append(matrixHeading);

      const missingOnPage = matrices.filter(
        (matrix) =>
          Number(matrix.factorCount ?? 0) === 0 ||
          Number(matrix.missingPriceCount ?? 0) > 0 ||
          Number(matrix.missingSourceCount ?? 0) > 0,
      ).length;
      const recalculateOnPage = matrices.filter(
        (matrix) => matrix.needsRecalculation === true,
      ).length;
      const inQuoteOnPage = matrices.filter((matrix) =>
        Boolean(recordValue(matrix.latestCalculation).costDecisionId),
      ).length;
      const metrics = el('div', 'cost-matrix-ledger-metrics');
      for (const [label, value, tone] of [
        ['全部模型', String(controller.costMatrixTotal || matrices.length), ''],
        ['本页待补数据', String(missingOnPage), missingOnPage > 0 ? 'attention' : ''],
        ['本页待重新核算', String(recalculateOnPage), recalculateOnPage > 0 ? 'attention' : ''],
        ['本页已进入报价', String(inQuoteOnPage), 'success'],
      ] as const) {
        const metric = el('div', `cost-matrix-ledger-metric ${tone}`.trim());
        metric.append(el('span', '', label), el('strong', '', value));
        metrics.append(metric);
      }
      matrixSection.append(metrics);

      const toolbar = el('div', 'cost-matrix-toolbar cost-matrix-ledger-toolbar');
      const search = document.createElement('input');
      search.className = 'cost-matrix-search';
      search.type = 'search';
      search.placeholder = '搜索规格、名称、SKU 或模型编号';
      search.setAttribute('aria-label', '搜索成本模型');
      search.value = controller.costMatrixQuery.query;
      let searchTimer: ReturnType<typeof setTimeout> | undefined;
      search.addEventListener('input', () => {
        if (searchTimer) globalThis.clearTimeout(searchTimer);
        searchTimer = globalThis.setTimeout(() => {
          void controller
            .loadCostMatrixPage({ page: 1, query: search.value.trim() })
            .then(replaceCostMatrixSection)
            .catch((failure: unknown) => {
              setCostStatus(failure instanceof Error ? failure.message : '成本模型搜索失败');
            });
        }, 280);
      });
      const productFamily = document.createElement('input');
      productFamily.className = 'cost-matrix-filter';
      productFamily.type = 'search';
      productFamily.placeholder = '产品族';
      productFamily.setAttribute('aria-label', '筛选成本模型产品族');
      productFamily.value = controller.costMatrixQuery.productFamily;
      let productFamilyTimer: ReturnType<typeof setTimeout> | undefined;
      productFamily.addEventListener('input', () => {
        if (productFamilyTimer) globalThis.clearTimeout(productFamilyTimer);
        productFamilyTimer = globalThis.setTimeout(() => {
          void controller
            .loadCostMatrixPage({ page: 1, productFamily: productFamily.value.trim() })
            .then(replaceCostMatrixSection)
            .catch((failure: unknown) => {
              setCostStatus(failure instanceof Error ? failure.message : '产品族筛选失败');
            });
        }, 280);
      });
      const attention = el('select', 'cost-matrix-filter');
      attention.setAttribute('aria-label', '筛选成本模型处理状态');
      for (const [value, label] of [
        ['ALL', '全部处理状态'],
        ['NEEDS_INPUT', '待补价格或来源'],
        ['NEEDS_CALCULATION', '待重新核算'],
        ['READY_FOR_QUOTE', '可进入报价'],
        ['IN_QUOTE', '已进入报价'],
      ]) {
        const option = el('option', '', label ?? '');
        option.value = value ?? '';
        attention.append(option);
      }
      attention.value = controller.costMatrixQuery.attention;
      attention.addEventListener('change', () => {
        void controller
          .loadCostMatrixPage({
            page: 1,
            attention: attention.value as CostMatrixAttention,
          })
          .then(replaceCostMatrixSection)
          .catch((failure: unknown) => {
            setCostStatus(failure instanceof Error ? failure.message : '成本模型筛选失败');
          });
      });
      const sort = el('select', 'cost-matrix-filter');
      sort.setAttribute('aria-label', '排序成本模型');
      for (const [value, label] of [
        ['ATTENTION', '异常优先'],
        ['UPDATED', '最近更新'],
        ['COST_DESC', '综合成本从高到低'],
        ['CODE', '模型编号'],
      ]) {
        const option = el('option', '', label ?? '');
        option.value = value ?? '';
        sort.append(option);
      }
      sort.value = controller.costMatrixQuery.sort;
      sort.addEventListener('change', () => {
        void controller
          .loadCostMatrixPage({ page: 1, sort: sort.value as CostMatrixSort })
          .then(replaceCostMatrixSection)
          .catch((failure: unknown) => {
            setCostStatus(failure instanceof Error ? failure.message : '成本模型排序失败');
          });
      });
      toolbar.append(search, productFamily, attention, sort);
      matrixSection.append(toolbar);

      const ledger = el('div', 'cost-matrix-ledger');
      ledger.setAttribute('role', 'table');
      const header = el('div', 'cost-matrix-ledger-row header');
      header.setAttribute('role', 'row');
      for (const label of [
        '模型 / 产品规格',
        '因子完整度',
        '最近综合成本',
        '处理状态',
        '最近更新',
        '操作',
      ])
        header.append(el('span', '', label));
      ledger.append(header);
      for (const cell of Array.from(header.children)) cell.setAttribute('role', 'columnheader');
      for (const matrix of matrices) {
        const latest = recordValue(matrix.latestCalculation);
        const factorCount = Number(
          matrix.factorCount ?? (Array.isArray(matrix.factors) ? matrix.factors.length : 0),
        );
        const missing =
          Number(matrix.missingPriceCount ?? 0) + Number(matrix.missingSourceCount ?? 0);
        const state =
          factorCount === 0 || missing > 0
            ? {
                label: factorCount === 0 ? '尚未配置因子' : `待补 ${String(missing)} 项数据`,
                className: 'attention',
              }
            : matrix.needsRecalculation === true
              ? { label: '待重新核算', className: 'attention' }
              : latest.costDecisionId
                ? { label: '已进入报价', className: 'success' }
                : latest.id
                  ? { label: '可进入报价', className: 'ready' }
                  : { label: '尚未核算', className: '' };
        const row = el('div', 'cost-matrix-ledger-row');
        row.setAttribute('role', 'row');
        const identity = el('div', 'cost-matrix-ledger-identity');
        const openName = el(
          'button',
          'cost-matrix-ledger-link',
          textValue(matrix.name, '未命名规格模型'),
        );
        openName.addEventListener('click', () => {
          openMatrix(matrix, openName);
        });
        identity.append(
          openName,
          el(
            'small',
            '',
            `${textValue(matrix.code, '规格')} · ${textValue(matrix.productSku, '未关联 SKU')}${matrix.isSystemPreset === true ? ' · 系统预置' : ''}`,
          ),
        );
        const completeness = el('div', 'cost-matrix-completeness');
        completeness.append(
          el('strong', '', `${String(factorCount)} 个因子`),
          el(
            'small',
            missing > 0 ? 'attention-text' : '',
            missing > 0 ? `${String(missing)} 项需补充` : '价格依据完整',
          ),
        );
        const cost = el('div', 'cost-matrix-ledger-cost');
        cost.append(
          el('strong', '', latest.id ? `¥ ${Number(latest.totalCost ?? 0).toFixed(2)}` : '—'),
          el(
            'small',
            '',
            latest.id
              ? textValue(latest.pricingMode, '') === 'TAX_EXCLUSIVE'
                ? '未税口径'
                : '含税口径'
              : '等待核算',
          ),
        );
        const stateCell = el('div', `cost-matrix-ledger-state ${state.className}`.trim());
        stateCell.append(el('span', '', state.label));
        const updated = textValue(matrix.updatedAt, textValue(latest.calculatedAt, ''));
        const action = el('div', 'cost-matrix-ledger-actions');
        const view = el('button', 'secondary compact-action', '查看模型');
        view.addEventListener('click', () => {
          openMatrix(matrix, view);
        });
        action.append(view);
        row.append(
          identity,
          completeness,
          cost,
          stateCell,
          el('span', '', updated ? new Date(updated).toLocaleDateString('zh-CN') : '—'),
          action,
        );
        for (const [index, label] of [
          '模型 / 产品规格',
          '因子完整度',
          '最近综合成本',
          '处理状态',
          '最近更新',
          '操作',
        ].entries()) {
          row.children[index]?.setAttribute('data-field-label', label);
          row.children[index]?.setAttribute('role', 'cell');
        }
        ledger.append(row);
      }
      if (matrices.length === 0)
        ledger.append(
          el(
            'p',
            'pipeline-empty',
            controller.costMatrixQuery.query ||
              controller.costMatrixQuery.productFamily ||
              controller.costMatrixQuery.attention !== 'ALL'
              ? '没有符合当前条件的成本模型，请调整搜索或筛选条件。'
              : '暂无规格成本模型。请先按常用产品规格建立模型。',
          ),
        );
      matrixSection.append(ledger);

      const pageCount = Math.max(
        1,
        Math.ceil(controller.costMatrixTotal / controller.costMatrixQuery.pageSize),
      );
      const pagination = el('div', 'cost-matrix-pagination');
      const previous = el('button', 'secondary', '上一页');
      previous.disabled = controller.costMatrixQuery.page <= 1;
      previous.addEventListener('click', () => {
        previous.disabled = true;
        next.disabled = true;
        setCostStatus('正在加载成本模型…');
        void controller
          .loadCostMatrixPage({ page: controller.costMatrixQuery.page - 1 })
          .then((accepted) => {
            if (accepted)
              setCostStatus(`已加载第 ${String(controller.costMatrixQuery.page)} 页成本模型`);
            replaceCostMatrixSection(accepted);
          })
          .catch((failure: unknown) => {
            setCostStatus(failure instanceof Error ? failure.message : '分页加载失败，请重试');
            previous.disabled = controller.costMatrixQuery.page <= 1;
            next.disabled = controller.costMatrixQuery.page >= pageCount;
          });
      });
      const next = el('button', 'secondary', '下一页');
      next.disabled = controller.costMatrixQuery.page >= pageCount;
      next.addEventListener('click', () => {
        previous.disabled = true;
        next.disabled = true;
        setCostStatus('正在加载成本模型…');
        void controller
          .loadCostMatrixPage({ page: controller.costMatrixQuery.page + 1 })
          .then((accepted) => {
            if (accepted)
              setCostStatus(`已加载第 ${String(controller.costMatrixQuery.page)} 页成本模型`);
            replaceCostMatrixSection(accepted);
          })
          .catch((failure: unknown) => {
            setCostStatus(failure instanceof Error ? failure.message : '分页加载失败，请重试');
            previous.disabled = controller.costMatrixQuery.page <= 1;
            next.disabled = controller.costMatrixQuery.page >= pageCount;
          });
      });
      pagination.append(
        previous,
        el(
          'span',
          '',
          `第 ${String(controller.costMatrixQuery.page)} / ${String(pageCount)} 页 · 共 ${String(controller.costMatrixTotal)} 个模型`,
        ),
        next,
      );
      matrixSection.append(pagination);
    }
    costPanel.append(matrixSection);
    const modelCatalog = el('div', 'definition-catalog');
    const latestModelVersions = new Map<string, number>();
    for (const model of models) {
      const definitionId = textValue(model.definitionId, '');
      latestModelVersions.set(
        definitionId,
        Math.max(latestModelVersions.get(definitionId) ?? 0, Number(model.version ?? 0)),
      );
    }
    for (const model of models) {
      const modelCard = el('article', 'definition-card');
      const rules = Array.isArray(model.rules) ? model.rules : [];
      modelCard.append(
        el(
          'strong',
          '',
          `${textValue(model.code, '模型')} · 第 ${textValue(model.version, '1')} 版`,
        ),
        el(
          'span',
          `ctr-state state-${textValue(model.status, 'DRAFT').toLocaleLowerCase()}`,
          textValue(model.status, 'DRAFT'),
        ),
        el(
          'p',
          'muted',
          `${textValue(model.name, '')} · ${currencyLabel(model.currency)} · ${String(rules.length)} 条规则`,
        ),
      );
      if (
        permissions.has('cost-model:manage') &&
        Number(model.version) === latestModelVersions.get(textValue(model.definitionId, ''))
      ) {
        const reviseModel = el('button', 'secondary', '新建模型版本');
        reviseModel.addEventListener('click', () => {
          openForm(
            workspace,
            `修订 ${textValue(model.code, '成本模型')}`,
            '创建新的发布版本；历史成本决策继续引用原模型版本。',
            [
              {
                name: 'overheadPercent',
                label: '管理费率（%）',
                type: 'number',
                required: true,
                value: '3',
              },
            ],
            '发布新版本',
            async (values) => {
              const multiplier = 1 + Number(values.overheadPercent ?? 0) / 100;
              await controller.submit(
                `/api/v1/cost-models/${textValue(model.definitionId, '')}/versions`,
                {
                  currency: textValue(model.currency, 'CNY'),
                  rules: [
                    {
                      when: { op: 'literal', value: true },
                      adjustment: { kind: 'MULTIPLY', value: multiplier.toFixed(6) },
                      reason: `管理费率 ${values.overheadPercent ?? '0'}%`,
                    },
                  ],
                  publish: true,
                },
              );
              await controller.load();
              status.textContent = controller.message;
            },
          );
        });
        modelCard.append(reviseModel);
      }
      modelCatalog.append(modelCard);
    }
    costPanel.append(modelCatalog);
    if (permissions.has('cost:evaluate') && publishedModels.length > 0 && solutions.length > 0) {
      const evaluate = el('button', 'primary', '＋ 新建成本核算');
      evaluate.addEventListener('click', () => {
        openForm(
          workspace,
          '新建成本核算',
          '每一行都保存数量、单位、单价和币种；服务器重新计算小计及模型调整。',
          [
            {
              name: 'modelVersionId',
              label: '已发布成本模型',
              type: 'select',
              required: true,
              options: publishedModels.map((item) => ({
                value: textValue(item.id, ''),
                label: `${textValue(item.code, '模型')} · 第 ${textValue(item.version, '1')} 版 · ${textValue(item.currency, '人民币')}`,
              })),
            },
            {
              name: 'technicalSolutionRevisionId',
              label: '定稿技术方案',
              type: 'select',
              required: true,
              options: solutions.map((item) => ({
                value: textValue(item.id, ''),
                label: `${textValue(item.code, '方案')} · 第 ${textValue(item.revision, '1')} 版`,
              })),
            },
            { name: 'materialQuantity', label: '草坪面积（㎡）', type: 'number', required: true },
            {
              name: 'materialUnitCost',
              label: '草坪单位成本（元/㎡）',
              type: 'number',
              required: true,
            },
            {
              name: 'installationQuantity',
              label: '铺装面积（㎡）',
              type: 'number',
              required: true,
            },
            {
              name: 'installationUnitCost',
              label: '铺装单位成本（元/㎡）',
              type: 'number',
              required: true,
            },
            {
              name: 'logisticsQuantity',
              label: '物流批次',
              type: 'number',
              required: true,
              value: '1',
            },
            {
              name: 'logisticsUnitCost',
              label: '单批物流成本（元）',
              type: 'number',
              required: true,
            },
            { name: 'region', label: '项目区域', required: true, value: 'CN' },
          ],
          '执行核算',
          async (values) => {
            const model = publishedModels.find((item) => item.id === values.modelVersionId);
            const currency = textValue(model?.currency, 'CNY');
            await controller.submit('/api/v1/cost-evaluations', {
              modelVersionId: values.modelVersionId ?? '',
              technicalSolutionRevisionId: values.technicalSolutionRevisionId ?? '',
              currency,
              lines: [
                ['turf', '人造草坪材料', values.materialQuantity, 'M2', values.materialUnitCost],
                [
                  'installation',
                  '铺装施工',
                  values.installationQuantity,
                  'M2',
                  values.installationUnitCost,
                ],
                [
                  'logistics',
                  '运输与装卸',
                  values.logisticsQuantity,
                  'EA',
                  values.logisticsUnitCost,
                ],
              ].map(([key, description, quantity, unit, unitCost]) => ({
                key,
                description,
                quantity,
                unit,
                unitCost,
                currency,
              })),
              context: { region: values.region ?? 'CN' },
            });
            await controller.load();
            status.textContent = controller.message;
          },
        );
      });
      costPanel.append(evaluate);
    }
    const decisions = controller.views.get('/api/v1/cost-evaluations') ?? [];
    const decisionList = el('div', 'decision-list');
    for (const decision of decisions) {
      const card = el('article', 'decision-card');
      card.append(
        el('p', 'eyebrow', `COST · ${textValue(decision.currency, '—')}`),
        el(
          'strong',
          'decision-total',
          `${textValue(decision.currency, '')} ${textValue(decision.total, '—')}`,
        ),
        el(
          'p',
          'muted',
          `小计 ${textValue(decision.subtotal, '—')} · ${displayTime(textValue(decision.evaluatedAt, ''))}`,
        ),
        el(
          'p',
          'version-pin',
          `模型 ${textValue(decision.modelVersionId, '').slice(0, 8)} · 方案 ${textValue(decision.technicalSolutionRevisionId, '').slice(0, 8)}`,
        ),
      );
      const lines = Array.isArray(decision.lines) ? decision.lines : [];
      const lineList = el('ul', 'decision-lines');
      for (const line of lines) {
        const item = recordValue(line);
        lineList.append(
          el(
            'li',
            '',
            `${textValue(item.description, '成本项')} · ${textValue(item.quantity, '—')} ${textValue(item.unit_code, '')} × ${textValue(item.unit_cost, '—')} = ${textValue(item.total, '—')}`,
          ),
        );
      }
      const trace = Array.isArray(decision.trace) ? decision.trace : [];
      for (const entry of trace) {
        const rule = recordValue(entry);
        card.append(
          el(
            'p',
            rule.matched === true ? 'rule-hit' : 'rule-miss',
            `${rule.matched === true ? '已命中' : '未命中'} · ${textValue(rule.reason, '规则')}`,
          ),
        );
      }
      card.append(lineList, el('code', 'input-hash', textValue(decision.inputHash, '')));
      decisionList.append(card);
    }
    if (decisions.length === 0)
      decisionList.append(el('p', 'pipeline-empty', '暂无成本核算结果。'));
    costPanel.append(decisionList);
    workspace.append(costPanel);
  }
  if (controller && permissions.has('sales-policy:read')) {
    const policyPanel = el('section', 'decision-workbench policy-workbench');
    const policyHeading = el('div', 'pipeline-heading');
    const policyCopy = el('div');
    policyCopy.append(el('h2', '', '销售政策评估'), el('p', '', '毛利、折扣与审批政策'));
    const policies = controller.views.get('/api/v1/sales-policies') ?? [];
    const publishedPolicies = policies.filter((item) => item.status === 'PUBLISHED');
    if (permissions.has('sales-policy:manage')) {
      const createPolicy = el('button', 'secondary', '新建销售政策');
      createPolicy.addEventListener('click', () => {
        openForm(
          workspace,
          '新建销售政策',
          '低于最低毛利率将阻止通过；超过折扣上限将要求人工审批。',
          [
            { name: 'code', label: '政策编号', required: true, placeholder: 'SP-2026-01' },
            { name: 'name', label: '政策名称', required: true, placeholder: '标准销售政策' },
            {
              name: 'minimumMargin',
              label: '最低毛利率（%）',
              type: 'number',
              required: true,
              value: '20',
            },
            {
              name: 'maximumDiscount',
              label: '最大折扣（%）',
              type: 'number',
              required: true,
              value: '10',
            },
          ],
          '发布政策',
          async (values) => {
            const minimumMargin = Math.round(Number(values.minimumMargin ?? 0) * 100);
            const maximumDiscount = Math.round(Number(values.maximumDiscount ?? 0) * 100);
            await controller.submit('/api/v1/sales-policies', {
              code: values.code ?? '',
              name: values.name ?? '',
              rules: [
                {
                  when: {
                    op: 'lt',
                    left: { op: 'input', path: 'marginBasisPoints' },
                    right: { op: 'literal', value: minimumMargin },
                  },
                  effect: {
                    passed: false,
                    approvalRequired: true,
                    minimumMarginBasisPoints: minimumMargin,
                  },
                  reason: `毛利率低于 ${values.minimumMargin ?? '0'}% 红线`,
                },
                {
                  when: {
                    op: 'gt',
                    left: { op: 'input', path: 'discountBasisPoints' },
                    right: { op: 'literal', value: maximumDiscount },
                  },
                  effect: { approvalRequired: true, maximumDiscountBasisPoints: maximumDiscount },
                  reason: `折扣超过 ${values.maximumDiscount ?? '0'}% 上限`,
                },
              ],
              publish: true,
            });
            await controller.load();
            status.textContent = controller.message;
          },
        );
      });
      policyHeading.append(policyCopy, createPolicy);
    } else policyHeading.append(policyCopy);
    policyPanel.append(policyHeading);
    const policyCatalog = el('div', 'definition-catalog');
    const latestPolicyVersions = new Map<string, number>();
    for (const policy of policies) {
      const definitionId = textValue(policy.definitionId, '');
      latestPolicyVersions.set(
        definitionId,
        Math.max(latestPolicyVersions.get(definitionId) ?? 0, Number(policy.version ?? 0)),
      );
    }
    for (const policy of policies) {
      const policyCard = el('article', 'definition-card');
      const rules = Array.isArray(policy.rules) ? policy.rules : [];
      policyCard.append(
        el(
          'strong',
          '',
          `${textValue(policy.code, '政策')} · 第 ${textValue(policy.version, '1')} 版`,
        ),
        el(
          'span',
          `ctr-state state-${textValue(policy.status, 'DRAFT').toLocaleLowerCase()}`,
          textValue(policy.status, 'DRAFT'),
        ),
        el('p', 'muted', `${textValue(policy.name, '')} · ${String(rules.length)} 条规则`),
      );
      if (
        permissions.has('sales-policy:manage') &&
        Number(policy.version) === latestPolicyVersions.get(textValue(policy.definitionId, ''))
      ) {
        const revisePolicy = el('button', 'secondary', '新建政策版本');
        revisePolicy.addEventListener('click', () => {
          openForm(
            workspace,
            `修订 ${textValue(policy.code, '销售政策')}`,
            '新版本只影响后续评估，历史政策决策保持原版本引用。',
            [
              {
                name: 'minimumMargin',
                label: '最低毛利率（%）',
                type: 'number',
                required: true,
                value: '20',
              },
              {
                name: 'maximumDiscount',
                label: '最大折扣（%）',
                type: 'number',
                required: true,
                value: '10',
              },
            ],
            '发布新版本',
            async (values) => {
              const minimumMargin = Math.round(Number(values.minimumMargin ?? 0) * 100);
              const maximumDiscount = Math.round(Number(values.maximumDiscount ?? 0) * 100);
              await controller.submit(
                `/api/v1/sales-policies/${textValue(policy.definitionId, '')}/versions`,
                {
                  rules: [
                    {
                      when: {
                        op: 'lt',
                        left: { op: 'input', path: 'marginBasisPoints' },
                        right: { op: 'literal', value: minimumMargin },
                      },
                      effect: {
                        passed: false,
                        approvalRequired: true,
                        minimumMarginBasisPoints: minimumMargin,
                      },
                      reason: `毛利率低于 ${values.minimumMargin ?? '0'}% 红线`,
                    },
                    {
                      when: {
                        op: 'gt',
                        left: { op: 'input', path: 'discountBasisPoints' },
                        right: { op: 'literal', value: maximumDiscount },
                      },
                      effect: {
                        approvalRequired: true,
                        maximumDiscountBasisPoints: maximumDiscount,
                      },
                      reason: `折扣超过 ${values.maximumDiscount ?? '0'}% 上限`,
                    },
                  ],
                  publish: true,
                },
              );
              await controller.load();
              status.textContent = controller.message;
            },
          );
        });
        policyCard.append(revisePolicy);
      }
      policyCatalog.append(policyCard);
    }
    policyPanel.append(policyCatalog);
    const costs = controller.views.get('/api/v1/cost-evaluations') ?? [];
    if (
      permissions.has('sales-policy:evaluate') &&
      publishedPolicies.length > 0 &&
      costs.length > 0
    ) {
      const evaluatePolicy = el('button', 'primary', '＋ 评估报价政策');
      evaluatePolicy.addEventListener('click', () => {
        openForm(
          workspace,
          '评估销售政策',
          '利润率和折扣以百分比输入；其他项目上下文由成本决策固定。',
          [
            {
              name: 'policyVersionId',
              label: '已发布政策',
              type: 'select',
              required: true,
              options: publishedPolicies.map((item) => ({
                value: textValue(item.id, ''),
                label: `${textValue(item.code, '政策')} · 第 ${textValue(item.version, '1')} 版`,
              })),
            },
            {
              name: 'costDecisionId',
              label: '成本决策',
              type: 'select',
              required: true,
              options: costs.map((item) => ({
                value: textValue(item.id, ''),
                label: `${textValue(item.currency, '')} ${textValue(item.total, '—')} · ${textValue(item.id, '').slice(0, 8)}`,
              })),
            },
            {
              name: 'margin',
              label: '拟定毛利率（%）',
              type: 'number',
              required: true,
              value: '30',
            },
            {
              name: 'discount',
              label: '拟定折扣（%）',
              type: 'number',
              required: true,
              value: '0',
            },
          ],
          '执行政策评估',
          async (values) => {
            await controller.submit('/api/v1/sales-policy-evaluations', {
              policyVersionId: values.policyVersionId ?? '',
              costDecisionId: values.costDecisionId ?? '',
              context: {
                marginBasisPoints: Math.round(Number(values.margin ?? 0) * 100),
                discountBasisPoints: Math.round(Number(values.discount ?? 0) * 100),
              },
            });
            await controller.load();
            status.textContent = controller.message;
          },
        );
      });
      policyPanel.append(evaluatePolicy);
    }
    const evaluations = controller.views.get('/api/v1/sales-policy-evaluations') ?? [];
    const evaluationList = el('div', 'decision-list');
    for (const evaluation of evaluations) {
      const card = el('article', 'decision-card');
      const passed = evaluation.passed === true;
      const approval = evaluation.approvalRequired === true;
      card.append(
        el('p', 'eyebrow', '销售政策判定'),
        el(
          'strong',
          passed ? 'decision-pass' : 'decision-fail',
          passed ? '政策通过' : '政策未通过',
        ),
        el('p', 'muted', approval ? '需要人工审批' : '无需额外审批'),
        el(
          'p',
          'version-pin',
          `政策 ${textValue(evaluation.policyVersionId, '').slice(0, 8)} · 成本 ${textValue(evaluation.costDecisionId, '').slice(0, 8)}`,
        ),
      );
      const reasons = Array.isArray(evaluation.reasons) ? evaluation.reasons : [];
      for (const reason of reasons) card.append(el('p', 'rule-hit', textValue(reason, '规则命中')));
      card.append(
        el(
          'p',
          'policy-boundary',
          `最低毛利率 ${String(Number(evaluation.minimumMarginBasisPoints ?? 0) / 100)}% · 最大折扣 ${String(Number(evaluation.maximumDiscountBasisPoints ?? 0) / 100)}%`,
        ),
        el('code', 'input-hash', textValue(evaluation.inputHash, '')),
      );
      evaluationList.append(card);
    }
    if (evaluations.length === 0)
      evaluationList.append(el('p', 'pipeline-empty', '暂无销售政策评估结果。'));
    policyPanel.append(evaluationList);
    workspace.append(policyPanel);
  }
  if (controller && permissions.has('quote:read')) {
    const quotePanel = el('section', 'quote-workbench');
    const quoteHeading = el('div', 'pipeline-heading');
    const quoteCopy = el('div');
    quoteCopy.append(el('h2', '', '销售报价'), el('p', '', '报价明细、毛利与政策校验'));
    const costs = controller.views.get('/api/v1/cost-evaluations') ?? [];
    const policies = (controller.views.get('/api/v1/sales-policies') ?? []).filter(
      (item) => item.status === 'PUBLISHED',
    );
    const solutions = controller.views.get('/api/v1/technical-solutions') ?? [];
    const ctrs = controller.views.get('/api/v1/ctrs') ?? [];
    if (permissions.has('quote:create') && costs.length > 0 && policies.length > 0) {
      const createQuote = el('button', 'primary', '＋ 新建报价');
      createQuote.setAttribute('data-create-quote', 'true');
      createQuote.addEventListener('click', () => {
        openForm(
          workspace,
          '新建销售报价',
          '系统先校验销售政策，再由服务器重算每一行、折扣与毛利。',
          [
            { name: 'quoteNumber', label: '报价编号', required: true, placeholder: 'Q-2026-001' },
            {
              name: 'costDecisionId',
              label: '成本决策',
              type: 'select',
              required: true,
              ...(controller.preferredQuoteCostDecisionId
                ? { value: controller.preferredQuoteCostDecisionId }
                : {}),
              options: costs.map((item) => ({
                value: textValue(item.id, ''),
                label: `${textValue(item.currency, '')} ${textValue(item.total, '—')} · ${textValue(item.id, '').slice(0, 8)}`,
              })),
            },
            {
              name: 'policyVersionId',
              label: '销售政策版本',
              type: 'select',
              required: true,
              options: policies.map((item) => ({
                value: textValue(item.id, ''),
                label: `${textValue(item.code, '政策')} · 第 ${textValue(item.version, '1')} 版`,
              })),
            },
            {
              name: 'turfQuantity',
              label: '草坪数量（㎡）',
              type: 'number',
              required: true,
              value: '8050',
            },
            {
              name: 'turfPrice',
              label: '草坪销售单价（元/㎡）',
              type: 'number',
              required: true,
              value: '108',
            },
            {
              name: 'installationQuantity',
              label: '铺装数量（㎡）',
              type: 'number',
              required: true,
              value: '8050',
            },
            {
              name: 'installationPrice',
              label: '铺装销售单价（元/㎡）',
              type: 'number',
              required: true,
              value: '28',
            },
            {
              name: 'serviceQuantity',
              label: '项目服务项数量',
              type: 'number',
              required: true,
              value: '1',
            },
            {
              name: 'servicePrice',
              label: '项目服务费（元）',
              type: 'number',
              required: true,
              value: '60000',
            },
            {
              name: 'discountPercent',
              label: '整单折扣（%）',
              type: 'number',
              required: true,
              value: '0',
            },
            { name: 'validUntil', label: '报价有效期至', type: 'date', required: true },
          ],
          '校验并创建报价',
          async (values) => {
            const cost = costs.find((item) => item.id === values.costDecisionId);
            if (!cost) throw new Error('请选择有效成本决策');
            const solutionId = textValue(cost.technicalSolutionRevisionId, '');
            const solution = solutions.find((item) => item.id === solutionId);
            if (!solution) throw new Error('成本决策对应的技术方案不可见');
            const ctrVersionId = textValue(solution.ctrVersionId, '');
            const ctr = ctrs.find((item) => item.id === ctrVersionId);
            if (!ctr) throw new Error('技术方案对应的技术需求版本不可见');
            const currency = textValue(cost.currency, 'CNY');
            const lineInputs = [
              ['人造草坪系统', values.turfQuantity, 'M2', values.turfPrice],
              ['铺装施工服务', values.installationQuantity, 'M2', values.installationPrice],
              ['项目技术服务', values.serviceQuantity, 'EA', values.servicePrice],
            ] as const;
            const lines = lineInputs.map(([description, quantity, unitCode, unitPrice]) => ({
              description,
              quantity: decimalValue(Number(quantity ?? 0)),
              unitCode,
              unitPrice: decimalValue(Number(unitPrice ?? 0)),
              total: decimalValue(Number(quantity ?? 0) * Number(unitPrice ?? 0)),
            }));
            const subtotal = lines.reduce((sum, line) => sum + Number(line.total), 0);
            const discount = subtotal * (Number(values.discountPercent ?? 0) / 100);
            const total = subtotal - discount;
            const costTotal = Number(cost.total ?? 0);
            const margin = total - costTotal;
            if (total <= 0) throw new Error('折扣后报价金额必须大于零');
            const marginBasisPoints = Math.trunc((margin * 10_000) / total);
            const discountBasisPoints = Math.trunc((discount * 10_000) / subtotal);
            await controller.submit('/api/v1/sales-policy-evaluations', {
              policyVersionId: values.policyVersionId ?? '',
              costDecisionId: values.costDecisionId ?? '',
              context: { marginBasisPoints, discountBasisPoints },
            });
            const policyEvaluation = controller.revisionState;
            if (policyEvaluation?.passed !== true || typeof policyEvaluation.id !== 'string') {
              const reasons = Array.isArray(policyEvaluation?.reasons)
                ? policyEvaluation.reasons.map((item) => textValue(item, '')).filter(Boolean)
                : [];
              throw new Error(
                `销售政策未通过${reasons.length > 0 ? `：${reasons.join('；')}` : ''}`,
              );
            }
            await controller.submit('/api/v1/quotes', {
              quoteNumber: values.quoteNumber ?? '',
              opportunityId: textValue(cost.opportunityId, ''),
              ctrVersionId,
              technicalSolutionRevisionId: solutionId,
              costDecisionId: values.costDecisionId ?? '',
              policyVersionId: values.policyVersionId ?? '',
              policyEvaluationId: policyEvaluation.id,
              currency,
              subtotal: decimalValue(subtotal),
              discount: decimalValue(discount),
              total: decimalValue(total),
              costTotal: decimalValue(costTotal),
              margin: decimalValue(margin),
              marginBasisPoints,
              validUntil: new Date(`${values.validUntil ?? ''}T23:59:59.000Z`).toISOString(),
              lines,
            });
            controller.preferredQuoteCostDecisionId = '';
            await controller.refreshViews(['/api/v1/sales-policy-evaluations', '/api/v1/quotes']);
            controller.message = `报价 ${values.quoteNumber ?? ''} 已创建为草稿，等待报价审批`;
            status.textContent = controller.message;
            const refreshedWorkspace = commercialWorkspaceStructure(
              viewport,
              immutable,
              controller,
            );
            workspace.replaceWith(refreshedWorkspace);
            setAppRoute('quotes');
          },
        );
      });
      quoteHeading.append(quoteCopy, createQuote);
    } else quoteHeading.append(quoteCopy);
    quotePanel.append(quoteHeading);
    const quotes = controller.views.get('/api/v1/quotes') ?? [];
    const latestQuoteVersions = new Map<string, number>();
    for (const quote of quotes) {
      const quoteId = textValue(quote.quoteId, '');
      latestQuoteVersions.set(
        quoteId,
        Math.max(latestQuoteVersions.get(quoteId) ?? 0, Number(quote.revision ?? 0)),
      );
    }
    const quoteList = el('div', 'quote-list');
    for (const quote of quotes) {
      const card = el('article', 'quote-card');
      const quoteStatus = textValue(quote.status, 'DRAFT');
      card.append(
        el(
          'p',
          'eyebrow',
          `${textValue(quote.quoteNumber, '报价')} · 第 ${textValue(quote.revision, '1')} 版`,
        ),
        el(
          'strong',
          'quote-total',
          `${textValue(quote.currency, '')} ${textValue(quote.total, '—')}`,
        ),
        el('span', `ctr-state state-${quoteStatus.toLocaleLowerCase()}`, quoteStatus),
        el(
          'p',
          'quote-economics',
          `折扣 ${textValue(quote.discount, '0')} · 成本 ${textValue(quote.costTotal, '—')} · 毛利 ${textValue(quote.margin, '—')}（${String(Number(quote.marginBasisPoints ?? 0) / 100)}%）`,
        ),
        el(
          'p',
          'version-pin',
          `技术需求 ${textValue(quote.ctrVersionId, '').slice(0, 8)} · 方案 ${textValue(quote.technicalSolutionRevisionId, '').slice(0, 8)} · 成本 ${textValue(quote.costDecisionId, '').slice(0, 8)} · 政策 ${textValue(quote.policyVersionId, '').slice(0, 8)}`,
        ),
      );
      const lines = Array.isArray(quote.lines) ? quote.lines : [];
      const lineTable = el('div', 'quote-lines');
      for (const line of lines) {
        const item = recordValue(line);
        lineTable.append(
          el('span', '', textValue(item.description, '报价行')),
          el('span', '', `${textValue(item.quantity, '—')} ${textValue(item.unit_code, '')}`),
          el('span', '', `${textValue(item.unit_price, '—')} / ${textValue(item.total, '—')}`),
        );
      }
      card.append(lineTable);
      const actions = el('div', 'quote-actions');
      if (
        permissions.has('quote:update') &&
        ['ISSUED', 'REJECTED'].includes(quoteStatus) &&
        Number(quote.revision) === latestQuoteVersions.get(textValue(quote.quoteId, ''))
      ) {
        const revise = el('button', 'secondary', '创建报价修订');
        revise.addEventListener('click', () => {
          openForm(
            workspace,
            `修订 ${textValue(quote.quoteNumber, '报价')}`,
            '基于当前签发版本调整整单折扣与有效期；原签发快照保持只读。',
            [
              {
                name: 'discountPercent',
                label: '新整单折扣（%）',
                type: 'number',
                required: true,
                value: String((Number(quote.discount ?? 0) * 100) / Number(quote.subtotal ?? 1)),
              },
              { name: 'validUntil', label: '新有效期至', type: 'date', required: true },
            ],
            '校验并创建修订',
            async (values) => {
              const quoteLines = (Array.isArray(quote.lines) ? quote.lines : []).map((line) => {
                const item = recordValue(line);
                return {
                  description: textValue(item.description, '报价行'),
                  quantity: textValue(item.quantity, '0'),
                  unitCode: textValue(item.unit_code, ''),
                  unitPrice: textValue(item.unit_price, '0'),
                  total: textValue(item.total, '0'),
                };
              });
              const subtotal = quoteLines.reduce((sum, line) => sum + Number(line.total), 0);
              const discount = subtotal * (Number(values.discountPercent ?? 0) / 100);
              const total = subtotal - discount;
              const costTotal = Number(quote.costTotal ?? 0);
              const margin = total - costTotal;
              if (total <= 0) throw new Error('折扣后报价金额必须大于零');
              const marginBasisPoints = Math.trunc((margin * 10_000) / total);
              const discountBasisPoints = Math.trunc((discount * 10_000) / subtotal);
              await controller.submit('/api/v1/sales-policy-evaluations', {
                policyVersionId: textValue(quote.policyVersionId, ''),
                costDecisionId: textValue(quote.costDecisionId, ''),
                context: { marginBasisPoints, discountBasisPoints },
              });
              const policyEvaluation = controller.revisionState;
              if (policyEvaluation?.passed !== true || typeof policyEvaluation.id !== 'string')
                throw new Error('修订后的报价未通过销售政策');
              await controller.submit(`/api/v1/quotes/${textValue(quote.quoteId, '')}/revisions`, {
                quoteNumber: textValue(quote.quoteNumber, ''),
                opportunityId: textValue(quote.opportunityId, ''),
                ctrVersionId: textValue(quote.ctrVersionId, ''),
                technicalSolutionRevisionId: textValue(quote.technicalSolutionRevisionId, ''),
                costDecisionId: textValue(quote.costDecisionId, ''),
                policyVersionId: textValue(quote.policyVersionId, ''),
                policyEvaluationId: policyEvaluation.id,
                currency: textValue(quote.currency, 'CNY'),
                subtotal: decimalValue(subtotal),
                discount: decimalValue(discount),
                total: decimalValue(total),
                costTotal: decimalValue(costTotal),
                margin: decimalValue(margin),
                marginBasisPoints,
                validUntil: new Date(`${values.validUntil ?? ''}T23:59:59.000Z`).toISOString(),
                lines: quoteLines,
              });
              await controller.load();
              status.textContent = controller.message;
            },
          );
        });
        actions.append(revise);
      }
      if (quoteStatus === 'DRAFT' && permissions.has('quote:approve')) {
        const approve = el('button', 'primary', '批准报价');
        approve.addEventListener('click', () => {
          openForm(
            workspace,
            '批准报价',
            '审批决定和理由将进入不可变证据链。',
            [{ name: 'reason', label: '审批意见', type: 'textarea', required: true }],
            '确认批准',
            async (values) => {
              await controller.quoteCommand(textValue(quote.id, ''), 'approve', {
                decision: 'APPROVED',
                reason: values.reason ?? '',
              });
              await controller.load();
              status.textContent = controller.message;
            },
          );
        });
        actions.append(approve);
      }
      if (quoteStatus === 'APPROVED' && permissions.has('quote:issue')) {
        const issue = el('button', 'primary', '签发报价');
        issue.addEventListener('click', () => {
          openForm(
            workspace,
            '签发报价',
            '签发后将生成只读快照，后续合同只能引用该快照。',
            [],
            '确认签发',
            async () => {
              await controller.quoteCommand(textValue(quote.id, ''), 'issue');
              await controller.load();
              status.textContent = controller.message;
            },
          );
        });
        actions.append(issue);
      }
      if (quoteStatus === 'ISSUED') {
        const print = el('button', 'secondary', '打印 / 保存 PDF');
        print.addEventListener('click', () => {
          printIssuedQuote(quote);
        });
        actions.append(print);
      }
      card.append(actions);
      quoteList.append(card);
    }
    if (quotes.length === 0) quoteList.append(el('p', 'pipeline-empty', '暂无报价。'));
    quotePanel.append(quoteList);
    workspace.append(quotePanel);
  }
  if (controller && permissions.has('credit:read')) {
    const creditPanel = el('section', 'qtc-workbench credit-workbench');
    const heading = el('div', 'pipeline-heading');
    const copy = el('div');
    copy.append(el('h2', '', '信用审查'), el('p', '', '客户额度、应收与信用敞口'));
    if (permissions.has('credit:approve')) {
      const setLimit = el('button', 'secondary', '设置客户额度');
      setLimit.addEventListener('click', () => {
        openForm(
          workspace,
          '设置客户信用额度',
          '额度按客户、币种和有效期形成不可变版本记录。',
          [
            {
              name: 'customerId',
              label: '客户',
              type: 'select',
              required: true,
              options: controller.customers.map((item) => ({
                value: item.id,
                label: item.name ?? item.id,
              })),
            },
            { name: 'amount', label: '信用额度', type: 'number', required: true },
            {
              name: 'currency',
              label: '币种',
              type: 'select',
              required: true,
              options: [
                { value: 'CNY', label: '人民币' },
                { value: 'USD', label: '美元 USD' },
              ],
            },
            { name: 'effectiveAt', label: '生效日期', type: 'date', required: true },
            { name: 'expiresAt', label: '失效日期', type: 'date', required: true },
          ],
          '保存额度',
          async (values) => {
            await controller.submit('/api/v1/credit-limits', {
              customerId: values.customerId ?? '',
              currency: values.currency ?? 'CNY',
              amount: values.amount ?? '',
              effectiveAt: new Date(`${values.effectiveAt ?? ''}T00:00:00.000Z`).toISOString(),
              expiresAt: new Date(`${values.expiresAt ?? ''}T23:59:59.000Z`).toISOString(),
            });
            await controller.load();
            status.textContent = controller.message;
          },
        );
      });
      heading.append(copy, setLimit);
    } else heading.append(copy);
    creditPanel.append(heading);
    const limits = controller.views.get('/api/v1/credit-limits') ?? [];
    const issuedQuotes = (controller.views.get('/api/v1/quotes') ?? []).filter(
      (item) => item.status === 'ISSUED' && typeof item.issuedSnapshotId === 'string',
    );
    if (permissions.has('credit:evaluate') && limits.length > 0 && issuedQuotes.length > 0) {
      const evaluateCredit = el('button', 'primary', '＋ 发起信用评估');
      evaluateCredit.addEventListener('click', () => {
        openForm(
          workspace,
          '发起信用评估',
          '服务器会锁定客户信用台账并重新计算敞口，不能由前端覆盖。',
          [
            {
              name: 'quoteRevisionId',
              label: '已签发报价',
              type: 'select',
              required: true,
              options: issuedQuotes.map((item) => ({
                value: textValue(item.id, ''),
                label: `${textValue(item.quoteNumber, '报价')} · 第 ${textValue(item.revision, '1')} 版 · ${textValue(item.currency, '')} ${textValue(item.total, '—')}`,
              })),
            },
            {
              name: 'creditLimitId',
              label: '信用额度版本',
              type: 'select',
              required: true,
              options: limits.map((item) => ({
                value: textValue(item.id, ''),
                label: `${currencyLabel(recordText(item, 'currency', 'currency', 'CNY'))} ${recordText(item, 'amount', 'amount', '—')} · ${recordText(item, 'expiresAt', 'expires_at', '').slice(0, 10)}`,
              })),
            },
            { name: 'validUntil', label: '信用决定有效期至', type: 'date', required: true },
          ],
          '执行信用评估',
          async (values) => {
            const quote = issuedQuotes.find((item) => item.id === values.quoteRevisionId);
            const opportunity = controller.opportunities.find(
              (item) => item.id === quote?.opportunityId,
            );
            if (!quote || typeof opportunity?.customerId !== 'string')
              throw new Error('报价未关联有效客户');
            await controller.submit('/api/v1/credit-decisions', {
              customerId: opportunity.customerId,
              quoteRevisionId: textValue(quote.id, ''),
              quoteSnapshotId: textValue(quote.issuedSnapshotId, ''),
              creditLimitId: values.creditLimitId ?? '',
              validUntil: new Date(`${values.validUntil ?? ''}T23:59:59.000Z`).toISOString(),
            });
            await controller.load();
            status.textContent = controller.message;
          },
        );
      });
      creditPanel.append(evaluateCredit);
    }
    const decisions = controller.views.get('/api/v1/credit-decisions') ?? [];
    const list = el('div', 'qtc-list');
    for (const decision of decisions) {
      const state = recordText(decision, 'effectiveStatus', 'effective_status', 'PENDING_APPROVAL');
      const card = el('article', 'qtc-card');
      card.append(
        el('p', 'eyebrow', '信用审查结果'),
        el(
          'strong',
          '',
          state === 'APPROVED'
            ? '信用已批准'
            : state === 'REJECTED'
              ? '信用已拒绝'
              : state === 'EXPIRED'
                ? '信用已过期'
                : '等待信用审批',
        ),
        el('span', `ctr-state state-${state.toLocaleLowerCase()}`, state),
        el(
          'p',
          'qtc-metrics',
          `申请 ${displayMoney(decision.currency, decision.requestedAmount ?? decision.requested_amount)} · 敞口 ${displayMoney(decision.currency, decision.exposureAmount ?? decision.exposure_amount)} · 额度 ${displayMoney(decision.currency, decision.creditLimit ?? decision.limit_amount)}`,
        ),
        el(
          'p',
          'version-pin',
          `报价 ${recordText(decision, 'quoteRevisionId', 'quote_revision_id').slice(0, 8)} · 敞口快照 ${recordText(decision, 'exposureSnapshotId', 'exposure_snapshot_id').slice(0, 8)}`,
        ),
      );
      if (state === 'PENDING_APPROVAL' && permissions.has('credit:approve')) {
        const actions = el('div', 'qtc-actions');
        for (const [result, label] of [
          ['APPROVED', '批准信用'],
          ['REJECTED', '拒绝信用'],
        ] as const) {
          const button = el('button', result === 'APPROVED' ? 'primary' : 'secondary', label);
          button.addEventListener('click', () => {
            openForm(
              workspace,
              label,
              '审批决定将永久保留并影响订单释放资格。',
              [{ name: 'reason', label: '审批理由', type: 'textarea', required: true }],
              '确认决定',
              async (values) => {
                await controller.submit(
                  `/api/v1/credit-decisions/${textValue(decision.id, '')}/approve`,
                  { decision: result, reason: values.reason ?? '' },
                );
                await controller.load();
                status.textContent = controller.message;
              },
            );
          });
          actions.append(button);
        }
        card.append(actions);
      }
      list.append(card);
    }
    if (decisions.length === 0) list.append(el('p', 'pipeline-empty', '暂无信用决定。'));
    creditPanel.append(list);
    workspace.append(creditPanel);
  }
  if (controller && permissions.has('contract:read')) {
    const contractPanel = el('section', 'qtc-workbench contract-workbench');
    const heading = el('div', 'pipeline-heading');
    const copy = el('div');
    copy.append(el('h2', '', '合同与签署'), el('p', '', '合同版本、报价依据与签署记录'));
    const issuedQuotes = (controller.views.get('/api/v1/quotes') ?? []).filter(
      (item) => item.status === 'ISSUED' && typeof item.issuedSnapshotId === 'string',
    );
    if (permissions.has('contract:revise') && issuedQuotes.length > 0) {
      const createContract = el('button', 'primary', '＋ 新建合同');
      createContract.addEventListener('click', () => {
        openForm(
          workspace,
          '新建合同修订',
          '合同正文使用结构化商务条款生成，并固定到所选报价快照。',
          [
            {
              name: 'quoteRevisionId',
              label: '已签发报价',
              type: 'select',
              required: true,
              options: issuedQuotes.map((item) => ({
                value: textValue(item.id, ''),
                label: `${textValue(item.quoteNumber, '报价')} · 第 ${textValue(item.revision, '1')} 版`,
              })),
            },
            { name: 'contractNumber', label: '合同编号', required: true },
            { name: 'paymentTerms', label: '付款条款', type: 'textarea', required: true },
            { name: 'deliveryTerms', label: '交付条款', type: 'textarea', required: true },
            { name: 'warranty', label: '质保条款', type: 'textarea', required: true },
            { name: 'acceptance', label: '验收标准', type: 'textarea', required: true },
          ],
          '创建合同修订',
          async (values) => {
            const quote = issuedQuotes.find((item) => item.id === values.quoteRevisionId);
            const opportunity = controller.opportunities.find(
              (item) => item.id === quote?.opportunityId,
            );
            if (!quote || typeof opportunity?.customerId !== 'string')
              throw new Error('报价未关联有效客户');
            await controller.submit('/api/v1/contracts', {
              customerId: opportunity.customerId,
              opportunityId: textValue(quote.opportunityId, ''),
              contractNumber: values.contractNumber ?? '',
              quoteRevisionId: textValue(quote.id, ''),
              quoteSnapshotId: textValue(quote.issuedSnapshotId, ''),
              content: {
                paymentTerms: values.paymentTerms ?? '',
                deliveryTerms: values.deliveryTerms ?? '',
                warranty: values.warranty ?? '',
                acceptance: values.acceptance ?? '',
              },
            });
            await controller.load();
            status.textContent = controller.message;
          },
        );
      });
      heading.append(copy, createContract);
    } else heading.append(copy);
    contractPanel.append(heading);
    const contracts = controller.views.get('/api/v1/contracts') ?? [];
    const list = el('div', 'qtc-list');
    for (const contract of contracts) {
      const state = recordText(contract, 'effectiveStatus', 'effectiveStatus', 'DRAFT');
      const content = recordValue(contract.content);
      const card = el('article', 'qtc-card');
      card.append(
        el(
          'p',
          'eyebrow',
          `${recordText(contract, 'contractNumber', 'contractNumber', '合同')} · 第 ${recordText(contract, 'revision', 'revision', '1')} 版`,
        ),
        el('strong', '', state === 'SIGNED' ? '合同已签署' : '合同待签署'),
        el('span', `ctr-state state-${state.toLocaleLowerCase()}`, state),
        el('p', 'muted', `付款：${textValue(content.paymentTerms, '—')}`),
        el('p', 'muted', `交付：${textValue(content.deliveryTerms, '—')}`),
        el(
          'code',
          'input-hash',
          `签署存证 ${recordText(contract, 'contentHash', 'content_hash').slice(0, 16)}…`,
        ),
      );
      const contractDocuments = (controller.views.get('/api/v1/contract-documents') ?? []).filter(
        (document) =>
          recordText(document, 'subjectId', 'subject_id') === recordText(contract, 'id', 'id'),
      );
      const documentPanel = el('div', 'contract-document-panel');
      documentPanel.append(el('strong', '', '合同文件'));
      for (const document of contractDocuments) {
        const documentState = recordText(document, 'state', 'state', 'UPLOADED');
        const row = el('div', 'contract-document-row');
        row.append(
          el('span', '', recordText(document, 'attachmentName', 'attachment_name', '合同文件')),
          el(
            'span',
            `ctr-state state-${documentState.toLocaleLowerCase()}`,
            businessStateLabel(documentState),
          ),
        );
        if (documentState === 'UPLOADED' && permissions.has('contract-ocr:operate')) {
          const ocr = el('button', 'secondary compact', '提交识别结果');
          ocr.addEventListener('click', () => {
            openForm(
              workspace,
              '合同 OCR 识别结果',
              '识别结果须经人工复核后方可送签。',
              [
                { name: 'provider', label: 'OCR 服务', required: true, value: '企业OCR适配器' },
                { name: 'text', label: '识别全文', type: 'textarea', required: true },
                { name: 'contractNumber', label: '识别合同编号' },
                { name: 'counterparty', label: '识别相对方' },
                { name: 'amount', label: '识别含税金额' },
                { name: 'confidence', label: '置信度（0-1）', required: true, value: '0.90' },
              ],
              '保存识别结果',
              async (values) => {
                await controller.submit(
                  `/api/v1/contract-documents/${recordText(document, 'id', 'id')}/ocr`,
                  {
                    provider: values.provider ?? '',
                    text: values.text ?? '',
                    fields: {
                      contractNumber: values.contractNumber ?? '',
                      counterparty: values.counterparty ?? '',
                      amount: values.amount ?? '',
                    },
                    confidence: Number(values.confidence ?? 0),
                  },
                );
                await controller.load();
                status.textContent = controller.message;
              },
            );
          });
          row.append(ocr);
        }
        if (documentState === 'OCR_REVIEW' && permissions.has('contract-ocr:review')) {
          const review = el('button', 'primary compact', '复核并确认');
          review.addEventListener('click', () => {
            openForm(
              workspace,
              '复核合同识别结果',
              '请对照合同原件校正关键字段。',
              [
                {
                  name: 'text',
                  label: '合同全文',
                  type: 'textarea',
                  required: true,
                  value: recordText(document, 'ocrText', 'ocr_text'),
                },
                {
                  name: 'contractNumber',
                  label: '合同编号',
                  value: textValue(recordValue(document.extractedFields).contractNumber, ''),
                },
                {
                  name: 'counterparty',
                  label: '相对方',
                  value: textValue(recordValue(document.extractedFields).counterparty, ''),
                },
                {
                  name: 'amount',
                  label: '含税金额',
                  value: textValue(recordValue(document.extractedFields).amount, ''),
                },
              ],
              '确认可送签',
              async (values) => {
                await controller.submit(
                  `/api/v1/contract-documents/${recordText(document, 'id', 'id')}/ocr-review`,
                  {
                    provider: recordText(document, 'ocrProvider', 'ocr_provider', '人工复核'),
                    text: values.text ?? '',
                    fields: {
                      contractNumber: values.contractNumber ?? '',
                      counterparty: values.counterparty ?? '',
                      amount: values.amount ?? '',
                    },
                    confidence: Number(document.ocrConfidence ?? document.ocr_confidence ?? 1),
                  },
                );
                await controller.load();
                status.textContent = controller.message;
              },
            );
          });
          row.append(review);
        }
        if (documentState === 'READY_TO_SIGN' && permissions.has('contract-signature:send')) {
          const send = el('button', 'primary compact', '发起电子签署');
          send.addEventListener('click', () => {
            openForm(
              workspace,
              '发起电子签署',
              '签署服务商回执用于后续状态回调和证据归档。',
              [
                { name: 'provider', label: '电子签服务', required: true },
                { name: 'providerEnvelopeId', label: '签署任务编号', required: true },
                { name: 'signerName', label: '签署人', required: true },
                { name: 'signerContact', label: '手机号或邮箱', required: true },
              ],
              '确认发起',
              async (values) => {
                await controller.submit(
                  `/api/v1/contract-documents/${recordText(document, 'id', 'id')}/signature-envelopes`,
                  {
                    provider: values.provider ?? '',
                    providerEnvelopeId: values.providerEnvelopeId ?? '',
                    signingOrder: 'SEQUENTIAL',
                    expiresAt: null,
                    signers: [
                      {
                        sequence: 1,
                        role: '相对方签署人',
                        name: values.signerName ?? '',
                        contact: values.signerContact ?? '',
                      },
                    ],
                  },
                );
                await controller.load();
                status.textContent = controller.message;
              },
            );
          });
          row.append(send);
        }
        documentPanel.append(row);
      }
      if (permissions.has('contract-document:manage') && controller.api.uploadContractDocument) {
        const upload = el('button', 'secondary compact', '上传合同原件');
        upload.addEventListener('click', () => {
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = '.pdf,.doc,.docx,.png,.jpg,.jpeg';
          input.addEventListener('change', () => {
            const file = input.files?.[0];
            if (!file) return;
            void controller.api
              .uploadContractDocument?.(
                'SALES',
                'contract-revision',
                recordText(contract, 'id', 'id'),
                file,
              )
              .then(async () => {
                await controller.load();
                status.textContent = `${file.name} 已上传，等待 OCR 识别`;
              });
          });
          input.click();
        });
        documentPanel.append(upload);
      }
      card.append(documentPanel);
      if (state === 'DRAFT' && permissions.has('contract:sign')) {
        const sign = el('button', 'primary', '记录签署回执');
        sign.addEventListener('click', () => {
          openForm(
            workspace,
            '记录合同签署',
            '签署平台回执、签署时间和载荷哈希将作为不可变证据保存。',
            [
              { name: 'provider', label: '签署平台', required: true, value: '线下盖章' },
              { name: 'providerReceiptId', label: '回执编号', required: true },
              { name: 'signedAt', label: '签署日期', type: 'date', required: true },
              { name: 'signer', label: '签署人 / 经办人', required: true },
            ],
            '确认签署',
            async (values) => {
              await controller.submit(`/api/v1/contracts/${textValue(contract.id, '')}/sign`, {
                provider: values.provider ?? '',
                providerReceiptId: values.providerReceiptId ?? '',
                payload: { signer: values.signer ?? '', acknowledged: true },
                signedAt: new Date(`${values.signedAt ?? ''}T12:00:00.000Z`).toISOString(),
              });
              await controller.load();
              status.textContent = controller.message;
            },
          );
        });
        card.append(sign);
      }
      list.append(card);
    }
    if (contracts.length === 0) list.append(el('p', 'pipeline-empty', '暂无合同修订。'));
    contractPanel.append(list);
    workspace.append(contractPanel);
  }
  if (controller && permissions.has('sales-order:read')) {
    const panel = el('section', 'qtc-workbench order-workbench');
    const heading = el('div', 'pipeline-heading');
    const copy = el('div');
    copy.append(el('h2', '', '订单释放'), el('p', '', '报价、信用、合同与订单依据'));
    const quotes = (controller.views.get('/api/v1/quotes') ?? []).filter(
      (item) => item.status === 'ISSUED' && typeof item.issuedSnapshotId === 'string',
    );
    const decisions = (controller.views.get('/api/v1/credit-decisions') ?? []).filter(
      (item) => recordText(item, 'effectiveStatus', 'effective_status') === 'APPROVED',
    );
    const contracts = (controller.views.get('/api/v1/contracts') ?? []).filter(
      (item) =>
        recordText(item, 'effectiveStatus', 'effectiveStatus') === 'SIGNED' &&
        Boolean(recordText(item, 'signatureEvidenceId', 'signatureEvidenceId')),
    );
    if (
      permissions.has('sales-order:create') &&
      quotes.length &&
      decisions.length &&
      contracts.length
    ) {
      const create = el('button', 'primary', '＋ 释放销售订单');
      create.addEventListener('click', () => {
        openForm(
          workspace,
          '释放销售订单',
          '请选择同一报价链上的信用和合同证据，服务器会再次验证全部引用。',
          [
            {
              name: 'quoteRevisionId',
              label: '已签发报价',
              type: 'select',
              required: true,
              options: quotes.map((item) => ({
                value: textValue(item.id, ''),
                label: `${textValue(item.quoteNumber, '报价')} · ${recordText(item, 'currency', 'currency')} ${recordText(item, 'total', 'total')}`,
              })),
            },
            {
              name: 'creditDecisionId',
              label: '已批准信用决定',
              type: 'select',
              required: true,
              options: decisions.map((item) => ({
                value: textValue(item.id, ''),
                label: `${textValue(item.id, '').slice(0, 8)} · 有效至 ${recordText(item, 'validUntil', 'valid_until').slice(0, 10)}`,
              })),
            },
            {
              name: 'contractRevisionId',
              label: '已签合同',
              type: 'select',
              required: true,
              options: contracts.map((item) => ({
                value: textValue(item.id, ''),
                label: recordText(
                  item,
                  'contractNumber',
                  'contractNumber',
                  textValue(item.id, '').slice(0, 8),
                ),
              })),
            },
            {
              name: 'orderNumber',
              label: '订单编号',
              required: true,
              minLength: 3,
              maxLength: 64,
              hint: '使用公司统一订单编号，避免与已有订单重复。',
            },
            {
              name: 'description',
              label: '订单行说明',
              required: true,
              minLength: 2,
              maxLength: 500,
            },
            {
              name: 'quantity',
              label: '数量',
              type: 'number',
              required: true,
              value: '1',
              min: 0.000001,
              step: 0.000001,
            },
            {
              name: 'unitPrice',
              label: '含税单价',
              type: 'number',
              required: true,
              min: 0.000001,
              step: 0.000001,
            },
          ],
          '验证并释放',
          async (values) => {
            const quote = quotes.find((item) => item.id === values.quoteRevisionId);
            const contract = contracts.find((item) => item.id === values.contractRevisionId);
            const opportunity = controller.opportunities.find(
              (item) => item.id === quote?.opportunityId,
            );
            if (!quote || !contract || typeof opportunity?.customerId !== 'string')
              throw new Error('订单依据未形成完整客户链');
            const quantity = Number(values.quantity ?? '0');
            const unitPrice = Number(values.unitPrice ?? '0');
            const total = decimalValue(quantity * unitPrice);
            await controller.submit('/api/v1/sales-orders', {
              customerId: opportunity.customerId,
              opportunityId: textValue(quote.opportunityId, ''),
              orderNumber: values.orderNumber ?? '',
              quoteRevisionId: textValue(quote.id, ''),
              quoteSnapshotId: textValue(quote.issuedSnapshotId, ''),
              creditDecisionId: values.creditDecisionId ?? '',
              contractRevisionId: textValue(contract.id, ''),
              signatureEvidenceId: recordText(
                contract,
                'signatureEvidenceId',
                'signatureEvidenceId',
              ),
              currency: recordText(quote, 'currency', 'currency', 'CNY'),
              total,
              lines: [
                {
                  description: values.description ?? '',
                  quantity: decimalValue(quantity),
                  unitPrice: decimalValue(unitPrice),
                  total,
                },
              ],
            });
            await controller.load();
            status.textContent = controller.message;
          },
        );
      });
      heading.append(copy, create);
    } else heading.append(copy);
    panel.append(heading);
    const list = el('div', 'qtc-list');
    for (const order of controller.views.get('/api/v1/sales-orders') ?? []) {
      const card = el('article', 'qtc-card');
      card.append(
        el('p', 'eyebrow', recordText(order, 'orderNumber', 'order_number', '销售订单')),
        el(
          'strong',
          '',
          displayMoney(
            recordText(order, 'currency', 'currency'),
            recordText(order, 'total', 'total', '—'),
          ),
        ),
        el('span', 'ctr-state state-released', recordText(order, 'status', 'status', 'RELEASED')),
        el(
          'p',
          'version-pin',
          `报价 ${recordText(order, 'quoteRevisionId', 'quote_revision_id').slice(0, 8)} · 信用 ${recordText(order, 'creditDecisionId', 'credit_decision_id').slice(0, 8)} · 合同 ${recordText(order, 'contractRevisionId', 'contract_revision_id').slice(0, 8)}`,
        ),
      );
      list.append(card);
    }
    if (!list.childElementCount) list.append(el('p', 'pipeline-empty', '暂无已释放订单。'));
    panel.append(list);
    workspace.append(panel);
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
    const riskPercent = (value: string) => String(Number(value) / 100);
    if (permissions.has('risk-policy:manage')) {
      const create = el('button', 'secondary', '＋ 新建风险政策');
      create.addEventListener('click', () => {
        openForm(
          workspace,
          '新建风险政策',
          '政策发布后，评价会固定其版本、阈值和规则清单。',
          [
            { name: 'code', label: '政策代码', required: true },
            { name: 'name', label: '政策名称', required: true },
            {
              name: 'minimumMarginBasisPoints',
              label: '最低毛利率（bp）',
              type: 'number',
              required: true,
              value: '2500',
            },
            {
              name: 'overdueGraceDays',
              label: '逾期宽限天数',
              type: 'number',
              required: true,
              value: '0',
            },
            {
              name: 'creditWarningDays',
              label: '信用预警天数',
              type: 'number',
              required: true,
              value: '30',
            },
            { name: 'effectiveAt', label: '生效日期', type: 'date', required: true },
          ],
          '发布风险政策',
          async (values) => {
            await controller.submit('/api/v1/risk-policies', {
              code: values.code ?? '',
              name: values.name ?? '',
              minimumMarginBasisPoints: Number(values.minimumMarginBasisPoints),
              overdueGraceDays: Number(values.overdueGraceDays),
              creditWarningDays: Number(values.creditWarningDays),
              effectiveAt: new Date(`${values.effectiveAt ?? ''}T00:00:00.000Z`).toISOString(),
              rules: [
                { code: 'LOW_MARGIN' },
                { code: 'OVERDUE_AR' },
                { code: 'CREDIT_EXPIRY' },
                { code: 'CONTRACT_SIGNATURE' },
                { code: 'ORDER_RELEASE_GATE' },
              ],
              publish: true,
            });
            await controller.load();
            status.textContent = controller.message;
          },
        );
      });
      heading.append(copy);
      riskPolicyControls.append(create);
    } else heading.append(copy);
    panel.append(heading);
    const policyStrip = el('div', 'version-strip risk-policy-strip');
    for (const policy of riskPolicies) {
      const policyCard = el('article', 'version-card');
      policyCard.append(
        el(
          'strong',
          '',
          `${recordText(policy, 'code', 'code')} 第 ${recordText(policy, 'version', 'version')} 版`,
        ),
        el('span', 'version-pin', recordText(policy, 'status', 'status')),
        el(
          'p',
          'muted',
          `毛利门槛 ${riskPercent(recordText(policy, 'minimumMarginBasisPoints', 'minimum_margin_basis_points', '0'))}% · 逾期宽限 ${recordText(policy, 'overdueGraceDays', 'overdue_grace_days', '0')} 天 · 信用预警 ${recordText(policy, 'creditWarningDays', 'credit_warning_days', '0')} 天`,
        ),
      );
      if (permissions.has('risk-policy:manage') && policy.status === 'DRAFT') {
        const publish = el('button', 'primary', '发布版本');
        publish.addEventListener(
          'click',
          () =>
            void controller
              .submit(`/api/v1/risk-policy-versions/${textValue(policy.id, '')}/publish`, {})
              .then(() => controller.load()),
        );
        policyCard.append(publish);
      }
      if (permissions.has('risk-policy:manage') && policy.status === 'PUBLISHED') {
        const revise = el('button', 'secondary', '创建新版本');
        revise.addEventListener('click', () => {
          openForm(
            workspace,
            '创建风险政策版本',
            '新版本先保存为草稿，发布后历史评价仍固定原版本。',
            [
              {
                name: 'minimumMarginBasisPoints',
                label: '最低毛利率（bp）',
                type: 'number',
                required: true,
                value: recordText(
                  policy,
                  'minimumMarginBasisPoints',
                  'minimum_margin_basis_points',
                  '2500',
                ),
              },
              {
                name: 'overdueGraceDays',
                label: '逾期宽限天数',
                type: 'number',
                required: true,
                value: recordText(policy, 'overdueGraceDays', 'overdue_grace_days', '0'),
              },
              {
                name: 'creditWarningDays',
                label: '信用预警天数',
                type: 'number',
                required: true,
                value: recordText(policy, 'creditWarningDays', 'credit_warning_days', '30'),
              },
              { name: 'effectiveAt', label: '生效日期', type: 'date', required: true },
            ],
            '保存草稿',
            async (values) => {
              await controller.submit(
                `/api/v1/risk-policies/${recordText(policy, 'policyId', 'policy_id')}/versions`,
                {
                  minimumMarginBasisPoints: Number(values.minimumMarginBasisPoints),
                  overdueGraceDays: Number(values.overdueGraceDays),
                  creditWarningDays: Number(values.creditWarningDays),
                  effectiveAt: new Date(`${values.effectiveAt ?? ''}T00:00:00.000Z`).toISOString(),
                  rules: [
                    { code: 'LOW_MARGIN' },
                    { code: 'OVERDUE_AR' },
                    { code: 'CREDIT_EXPIRY' },
                    { code: 'CONTRACT_SIGNATURE' },
                    { code: 'ORDER_RELEASE_GATE' },
                  ],
                },
              );
              await controller.load();
              status.textContent = controller.message;
            },
          );
        });
        policyCard.append(revise);
      }
      policyStrip.append(policyCard);
    }
    riskPolicyControls.append(policyStrip);
    if (permissions.has('risk:evaluate') && riskOrders.length && riskPolicies.length) {
      const evaluate = el('button', 'primary', '运行订单风险评价');
      evaluate.addEventListener('click', () => {
        openForm(
          workspace,
          '运行订单风险评价',
          '风险分数由订单利润、应收和信用事实推导。',
          [
            {
              name: 'salesOrderId',
              label: '销售订单',
              type: 'select',
              required: true,
              options: riskOrders.map((order) => ({
                value: textValue(order.id, ''),
                label: recordText(order, 'orderNumber', 'order_number'),
              })),
            },
            {
              name: 'policyVersionId',
              label: '已发布政策',
              type: 'select',
              required: true,
              options: riskPolicies
                .filter((policy) => policy.status === 'PUBLISHED')
                .map((policy) => ({
                  value: textValue(policy.id, ''),
                  label: `${recordText(policy, 'code', 'code')} 第 ${recordText(policy, 'version', 'version')} 版`,
                })),
            },
            {
              name: 'assigneeEmployeeId',
              label: '责任人',
              type: 'select',
              required: true,
              options: controller.employees.map((employee) => ({
                value: employee.id,
                label: employee.displayName ?? employee.id,
              })),
            },
            { name: 'validUntil', label: '评价有效至', type: 'date', required: true },
            { name: 'dueAt', label: '任务到期日', type: 'date', required: true },
          ],
          '计算风险',
          async (values) => {
            await controller.submit('/api/v1/risk-evaluations', {
              salesOrderId: values.salesOrderId ?? '',
              policyVersionId: values.policyVersionId ?? '',
              assigneeEmployeeId: values.assigneeEmployeeId ?? '',
              validUntil: new Date(`${values.validUntil ?? ''}T23:59:59.000Z`).toISOString(),
              dueAt: new Date(`${values.dueAt ?? ''}T23:59:59.000Z`).toISOString(),
            });
            await controller.load();
            status.textContent = controller.message;
          },
        );
      });
      riskPolicyControls.append(evaluate);
    }
    const list = el('div', 'order-360-list');
    const renderOrderEvidence = (aggregate: Record<string, unknown>) => {
      const order = recordValue(aggregate.order);
      const quote = recordValue(aggregate.quote);
      const credit = recordValue(aggregate.credit);
      const contract = recordValue(aggregate.contract);
      const receivables = Array.isArray(aggregate.receivables) ? aggregate.receivables : [];
      const payments = Array.isArray(aggregate.payments) ? aggregate.payments : [];
      const commissions = Array.isArray(aggregate.commissions) ? aggregate.commissions : [];
      const risks = Array.isArray(aggregate.risks) ? aggregate.risks : [];
      const collections = Array.isArray(aggregate.collections) ? aggregate.collections : [];
      const anomalies = Array.isArray(aggregate.anomalies)
        ? aggregate.anomalies.map(recordValue).filter((item) => item.active === true)
        : [];
      const timeline = Array.isArray(aggregate.timeline)
        ? aggregate.timeline
            .map(recordValue)
            .sort(
              (left, right) =>
                Date.parse(recordText(right, 'occurredAt', 'occurredAt')) -
                Date.parse(recordText(left, 'occurredAt', 'occurredAt')),
            )
        : [];
      const card = el('article', 'order-360-card');
      card.append(
        el('p', 'eyebrow', recordText(order, 'orderNumber', 'order_number', '销售订单')),
        el(
          'h3',
          '',
          `${displayMoney(recordText(order, 'currency', 'currency'), recordText(order, 'total', 'total', '—'))} · ${businessStateLabel(recordText(order, 'status', 'status'))}`,
        ),
        el(
          'p',
          'qtc-metrics',
          `报价 ${recordText(quote, 'quoteNumber', 'quoteNumber', '—')} · 信用 ${businessStateLabel(recordText(credit, 'effectiveStatus', 'effective_status', '—'), '—')} · 合同 ${recordText(contract, 'contractNumber', 'contractNumber', '—')}`,
        ),
        el(
          'p',
          anomalies.length ? 'risk-alert' : 'success-note',
          anomalies.length
            ? `当前异常 ${String(anomalies.length)} 项：${anomalies.map((item) => textValue(item.message, '')).join('；')}`
            : '当前未发现活动异常',
        ),
        el(
          'p',
          'muted',
          `应收 ${String(receivables.length)} · 回款 ${String(payments.length)} · 催收 ${String(collections.length)} · 佣金 ${String(commissions.length)} · 风险 ${String(risks.length)} · 证据 ${String(timeline.length)}`,
        ),
      );
      const evidenceTools = el('div', 'evidence-tools');
      const eventFilter = el('select', 'filter-select');
      eventFilter.setAttribute('aria-label', '筛选证据事件');
      for (const [value, label] of [
        ['ALL', '全部事件'],
        ['COMMERCIAL', '商务与订单'],
        ['FINANCE', '应收、回款与佣金'],
        ['RISK', '风险与审批'],
        ['DELIVERY', '发货与签收'],
        ['LEGAL', '催收与法务'],
      ] as const) {
        const option = el('option', '', label);
        option.setAttribute('value', value);
        eventFilter.append(option);
      }
      const sortEvidence = el('button', 'secondary compact-action', '时间：最新在前');
      sortEvidence.type = 'button';
      const copyEvidence = el('button', 'secondary compact-action', '复制当前证据');
      copyEvidence.type = 'button';
      evidenceTools.append(eventFilter, sortEvidence, copyEvidence);
      const evidence = el('ol', 'order-360-timeline');
      const eventCategory = (type: string): string => {
        if (/COLLECTION|LEGAL_HANDOFF|DEBT_EVIDENCE/iu.test(type)) return 'LEGAL';
        if (/PAYMENT|AR_|COMMISSION/iu.test(type)) return 'FINANCE';
        if (/RISK|EXCEPTION|APPROV|REJECT/iu.test(type)) return 'RISK';
        if (/SHIPMENT|DISPATCH|DELIVER/iu.test(type)) return 'DELIVERY';
        return 'COMMERCIAL';
      };
      for (const event of timeline) {
        const type = recordText(event, 'type', 'type');
        const item = el(
          'li',
          '',
          `${recordText(event, 'occurredAt', 'occurredAt').slice(0, 16).replace('T', ' ')} · ${businessEventLabel(type)} · ${businessEventDetailLabel(type, recordText(event, 'label', 'label'))}`,
        );
        item.setAttribute('data-event-category', eventCategory(type));
        item.setAttribute('data-event-time', recordText(event, 'occurredAt', 'occurredAt'));
        item.setAttribute('title', `事件编码：${type}`);
        evidence.append(item);
      }
      const applyEvidenceFilter = () => {
        const selected = eventFilter.value;
        for (const item of Array.from(evidence.children) as HTMLElement[])
          item.hidden = selected !== 'ALL' && item.dataset.eventCategory !== selected;
      };
      eventFilter.addEventListener('change', applyEvidenceFilter);
      let newestFirst = true;
      sortEvidence.addEventListener('click', () => {
        newestFirst = !newestFirst;
        const items = Array.from(evidence.children) as HTMLElement[];
        items.sort((left, right) => {
          const delta =
            Date.parse(left.dataset.eventTime ?? '') - Date.parse(right.dataset.eventTime ?? '');
          return newestFirst ? -delta : delta;
        });
        evidence.replaceChildren(...items);
        sortEvidence.textContent = newestFirst ? '时间：最新在前' : '时间：最早在前';
      });
      copyEvidence.addEventListener('click', () => {
        const lines = (Array.from(evidence.children) as HTMLElement[])
          .filter((item) => !item.hidden)
          .map((item) => item.textContent.trim());
        void globalThis.navigator.clipboard
          .writeText(lines.join('\n'))
          .then(() => {
            status.textContent = `已复制 ${String(lines.length)} 条订单证据`;
          })
          .catch(() => {
            status.textContent = '复制失败，请检查浏览器剪贴板权限';
          });
      });
      card.append(evidenceTools, evidence);
      return card;
    };
    for (const order of controller.views.get('/api/v1/sales-orders') ?? []) {
      if (typeof order.id !== 'string') continue;
      const orderId = order.id;
      const card = el('article', 'order-360-card');
      card.append(
        el('h3', '', recordText(order, 'orderNumber', 'order_number', orderId)),
        el(
          'p',
          '',
          `${displayMoney(recordText(order, 'currency', 'currency'), recordText(order, 'total', 'total', '—'))} · ${businessStateLabel(recordText(order, 'status', 'status'))}`,
        ),
      );
      const open = el('button', 'secondary compact-action', '查看全链路证据');
      open.type = 'button';
      open.setAttribute('aria-expanded', 'false');
      const feedback = el('p', 'muted');
      feedback.setAttribute('role', 'status');
      const detail = el('div', 'order-360-detail');
      detail.id = `order-evidence-${orderId}`;
      detail.hidden = true;
      open.setAttribute('aria-controls', detail.id);
      open.addEventListener('click', () => {
        if (!detail.hidden) {
          detail.hidden = true;
          open.setAttribute('aria-expanded', 'false');
          open.textContent = '查看全链路证据';
          return;
        }
        open.disabled = true;
        open.setAttribute('aria-busy', 'true');
        feedback.textContent = '正在加载该订单的合同、履约、回款与风险证据…';
        void controller
          .loadOrder360(orderId)
          .then((aggregate) => {
            detail.replaceChildren(renderOrderEvidence(aggregate));
            detail.hidden = false;
            open.setAttribute('aria-expanded', 'true');
            open.textContent = '收起全链路证据';
            feedback.textContent = '已读取最新订单证据；再次展开将刷新。';
          })
          .catch((failure: unknown) => {
            feedback.textContent = failure instanceof Error ? failure.message : '订单证据加载失败';
            open.textContent = '重试加载订单证据';
          })
          .finally(() => {
            open.disabled = false;
            open.removeAttribute('aria-busy');
          });
      });
      card.append(open, feedback, detail);
      list.append(card);
    }
    if (list.children.length === 0) list.append(el('p', 'pipeline-empty', '暂无可见订单证据。'));
    panel.append(list);
    workspace.append(panel);
  }
  if (controller && permissions.has('ar:read')) {
    const panel = el('section', 'qtc-workbench ar-workbench');
    const heading = el('div', 'pipeline-heading');
    const copy = el('div');
    copy.append(el('h2', '', '应收与账龄'), el('p', '', '应收余额、到期日与核销进度'));
    const orders = controller.views.get('/api/v1/sales-orders') ?? [];
    if (permissions.has('ar:post') && orders.length) {
      const post = el('button', 'primary', '＋ 过账应收');
      post.addEventListener('click', () => {
        openForm(
          workspace,
          '过账应收发票',
          '发票固定关联已释放订单，余额将进入信用敞口。',
          [
            {
              name: 'salesOrderId',
              label: '销售订单',
              type: 'select',
              required: true,
              options: orders.map((item) => ({
                value: textValue(item.id, ''),
                label: `${recordText(item, 'orderNumber', 'order_number')} · ${recordText(item, 'currency', 'currency')} ${recordText(item, 'total', 'total')}`,
              })),
            },
            { name: 'documentNumber', label: '发票号码', required: true },
            { name: 'amount', label: '发票金额', type: 'number', required: true },
            { name: 'dueAt', label: '到期日', type: 'date', required: true },
          ],
          '确认过账',
          async (values) => {
            const order = orders.find((item) => item.id === values.salesOrderId);
            if (!order) throw new Error('请选择有效订单');
            await controller.submit('/api/v1/ar-open-items', {
              customerId: recordText(order, 'customerId', 'customer_id'),
              salesOrderId: textValue(order.id, ''),
              documentNumber: values.documentNumber ?? '',
              documentType: 'INVOICE',
              currency: recordText(order, 'currency', 'currency', 'CNY'),
              amount: values.amount ?? '',
              dueAt: new Date(`${values.dueAt ?? ''}T23:59:59.000Z`).toISOString(),
            });
            await controller.load();
            status.textContent = controller.message;
          },
        );
      });
      heading.append(copy, post);
    } else heading.append(copy);
    panel.append(heading);
    const list = el('div', 'qtc-list');
    const receivables = [...(controller.views.get('/api/v1/ar-open-items') ?? [])].sort(
      (left, right) =>
        Date.parse(recordText(left, 'dueAt', 'due_at')) -
        Date.parse(recordText(right, 'dueAt', 'due_at')),
    );
    for (const item of receivables) {
      const original = Number(recordText(item, 'originalAmount', 'original_amount', '0'));
      const remaining = Number(recordText(item, 'remainingAmount', 'remaining_amount', '0'));
      const overdue =
        remaining > 0 &&
        recordText(item, 'dueAt', 'due_at').slice(0, 10) < new Date().toISOString().slice(0, 10);
      const card = el('article', `qtc-card${overdue ? ' overdue' : ''}`);
      card.append(
        el('p', 'eyebrow', recordText(item, 'documentNumber', 'document_number', '应收单')),
        el(
          'strong',
          '',
          `未核销 ${displayMoney(recordText(item, 'currency', 'currency'), remaining)}`,
        ),
        el(
          'p',
          'qtc-metrics',
          `原始 ${decimalValue(original)} · 已核销 ${decimalValue(original - remaining)} · 到期 ${recordText(item, 'dueAt', 'due_at').slice(0, 10)}`,
        ),
      );
      if (overdue) card.append(el('span', 'opportunity-alert', '已逾期'));
      list.append(card);
    }
    if (!list.childElementCount) list.append(el('p', 'pipeline-empty', '暂无应收开放项。'));
    panel.append(list);
    workspace.append(panel);
  }
  if (controller && (permissions.has('collection:read') || permissions.has('legal-case:read'))) {
    const panel = el('section', 'qtc-workbench collection-workbench');
    const heading = el('div', 'pipeline-heading');
    const copy = el('div');
    copy.append(el('h2', '', '催收与法务证据'), el('p', '', '逾期催收、付款承诺与法务移交'));
    const receivables = (controller.views.get('/api/v1/ar-open-items') ?? []).filter(
      (item) =>
        Number(recordText(item, 'remainingAmount', 'remaining_amount', '0')) > 0 &&
        Date.parse(recordText(item, 'dueAt', 'due_at')) < Date.now(),
    );
    if (permissions.has('collection:manage') && receivables.length && controller.employees.length) {
      const create = el('button', 'primary', '＋ 建立催收案件');
      create.addEventListener('click', () => {
        openForm(
          workspace,
          '建立逾期催收案件',
          '余额、币种和到期日由服务器重新核对；同一应收项目只能建立一个案件。',
          [
            { name: 'caseNumber', label: '案件编号', required: true },
            {
              name: 'arOpenItemId',
              label: '逾期应收',
              type: 'select',
              required: true,
              options: receivables.map((item) => ({
                value: textValue(item.id, ''),
                label: `${recordText(item, 'documentNumber', 'document_number')} · ${recordText(item, 'currency', 'currency')} ${recordText(item, 'remainingAmount', 'remaining_amount')}`,
              })),
            },
            {
              name: 'assignedTo',
              label: '催收责任人',
              type: 'select',
              required: true,
              options: controller.employees.map((item) => ({
                value: item.id,
                label: item.displayName ?? item.employeeNumber ?? item.id,
              })),
            },
            {
              name: 'priority',
              label: '优先级',
              type: 'select',
              required: true,
              options: [
                { value: 'CRITICAL', label: '紧急' },
                { value: 'HIGH', label: '高' },
                { value: 'MEDIUM', label: '中' },
                { value: 'LOW', label: '低' },
              ],
            },
            { name: 'reason', label: '建案原因', type: 'textarea', required: true },
          ],
          '确认建案',
          async (values) => {
            await controller.submit('/api/v1/collection-cases', {
              caseNumber: values.caseNumber ?? '',
              arOpenItemId: values.arOpenItemId ?? '',
              assignedTo: values.assignedTo ?? '',
              priority: values.priority ?? 'HIGH',
              reason: values.reason ?? '',
              idempotencyKey: `COL-${Date.now().toString(36)}`,
            });
            await controller.load();
            status.textContent = controller.message;
          },
        );
      });
      heading.append(copy, create);
    } else heading.append(copy);
    panel.append(heading);
    const cases = controller.views.get('/api/v1/collection-cases') ?? [];
    const list = el('div', 'qtc-list collection-case-list');
    for (const item of cases) {
      const caseId = textValue(item.id, '');
      const state = recordText(item, 'state', 'state');
      const promises = Array.isArray(item.promises)
        ? (item.promises as readonly Record<string, unknown>[])
        : [];
      const handoffs = Array.isArray(item.legalHandoffs)
        ? (item.legalHandoffs as readonly Record<string, unknown>[])
        : [];
      const card = el('article', 'qtc-card collection-case-card');
      card.append(
        el('p', 'eyebrow', recordText(item, 'caseNumber', 'case_number', 'COLLECTION')),
        el(
          'strong',
          '',
          `${recordText(item, 'customerName', 'customer_name', '客户')} · ${displayMoney(recordText(item, 'currency', 'currency'), recordText(item, 'remainingAmount', 'remaining_amount', '0'))}`,
        ),
        el(
          'p',
          'qtc-metrics',
          `${businessStateLabel(state)} · 逾期 ${recordText(item, 'overdueDays', 'overdue_days', '0')} 天 · ${recordText(item, 'documentNumber', 'document_number', '应收单据')}`,
        ),
      );
      const actions = el('div', 'inline-actions');
      if (permissions.has('collection:manage') && !['LEGAL_ACCEPTED', 'CLOSED'].includes(state)) {
        const follow = el('button', 'secondary', '记录催收跟进');
        follow.addEventListener('click', () => {
          openForm(
            workspace,
            '记录催收跟进',
            '联系结果和下一动作将形成不可变证据。',
            [
              {
                name: 'channel',
                label: '联系渠道',
                type: 'select',
                required: true,
                options: [
                  { value: 'PHONE', label: '电话' },
                  { value: 'EMAIL', label: '邮件' },
                  { value: 'LETTER', label: '函件' },
                  { value: 'MEETING', label: '会议' },
                  { value: 'VISIT', label: '上门' },
                  { value: 'OTHER', label: '其他' },
                ],
              },
              { name: 'occurredAt', label: '联系时间', type: 'datetime-local', required: true },
              { name: 'contactPerson', label: '对方联系人', required: true },
              { name: 'outcome', label: '联系结果', type: 'textarea', required: true },
              { name: 'nextActionAt', label: '下一动作时间', type: 'datetime-local' },
              { name: 'evidenceReference', label: '证据引用', required: true },
            ],
            '保存跟进',
            async (values) => {
              await controller.submit(`/api/v1/collection-cases/${caseId}/followups`, {
                channel: values.channel ?? 'PHONE',
                occurredAt: new Date(values.occurredAt ?? '').toISOString(),
                contactPerson: values.contactPerson ?? '',
                outcome: values.outcome ?? '',
                ...(values.nextActionAt
                  ? { nextActionAt: new Date(values.nextActionAt).toISOString() }
                  : {}),
                evidence: { reference: values.evidenceReference ?? '' },
                idempotencyKey: `FOLLOW-${Date.now().toString(36)}`,
              });
              await controller.load();
              status.textContent = controller.message;
            },
          );
        });
        actions.append(follow);
        if (['OPEN', 'CONTACTING', 'PROMISE_BROKEN'].includes(state)) {
          const promise = el('button', 'secondary', '登记付款承诺');
          promise.addEventListener('click', () => {
            openForm(
              workspace,
              '登记付款承诺',
              '承诺金额不得超过实时应收余额；履约只能引用真实核销条目。',
              [
                { name: 'promisedAmount', label: '承诺金额', type: 'number', required: true },
                {
                  name: 'currency',
                  label: '币种',
                  type: 'select',
                  required: true,
                  options: [
                    {
                      value: recordText(item, 'currency', 'currency', 'CNY'),
                      label: currencyLabel(recordText(item, 'currency', 'currency', 'CNY')),
                    },
                  ],
                },
                { name: 'promisedAt', label: '承诺时间', type: 'datetime-local', required: true },
                { name: 'dueAt', label: '承诺付款期限', type: 'datetime-local', required: true },
                { name: 'debtorContact', label: '承诺人', required: true },
                { name: 'evidenceReference', label: '承诺证据引用', required: true },
              ],
              '保存承诺',
              async (values) => {
                await controller.submit(`/api/v1/collection-cases/${caseId}/promises`, {
                  promisedAmount: values.promisedAmount ?? '',
                  currency: values.currency ?? 'CNY',
                  promisedAt: new Date(values.promisedAt ?? '').toISOString(),
                  dueAt: new Date(values.dueAt ?? '').toISOString(),
                  debtorContact: values.debtorContact ?? '',
                  evidence: { reference: values.evidenceReference ?? '' },
                  idempotencyKey: `PROMISE-${Date.now().toString(36)}`,
                });
                await controller.load();
                status.textContent = controller.message;
              },
            );
          });
          actions.append(promise);
        }
      }
      if (permissions.has('collection:escalate')) {
        for (const promise of promises.filter((candidate) => candidate.state === 'PENDING')) {
          const broken = el('button', 'secondary', '确认承诺违约');
          broken.addEventListener('click', () => {
            openForm(
              workspace,
              '确认付款承诺违约',
              '确认前应核对承诺期限和最新核销记录。',
              [
                { name: 'reason', label: '违约说明', type: 'textarea', required: true },
                { name: 'evidenceReference', label: '复核证据引用', required: true },
              ],
              '确认违约',
              async (values) => {
                await controller.submit(
                  `/api/v1/collection-promises/${textValue(promise.id, '')}/break`,
                  {
                    reason: values.reason ?? '',
                    allocationEntryIds: [],
                    evidence: { reference: values.evidenceReference ?? '' },
                    idempotencyKey: `BROKEN-${Date.now().toString(36)}`,
                  },
                );
                await controller.load();
                status.textContent = controller.message;
              },
            );
          });
          actions.append(broken);
        }
        if (['CONTACTING', 'PROMISE_BROKEN'].includes(state)) {
          const legal = el('button', 'primary', '申请法务移交');
          legal.addEventListener('click', () => {
            openForm(
              workspace,
              '申请法务移交',
              '申请人不能受理自己的移交；索赔金额由实时应收余额冻结。',
              [
                { name: 'handoffNumber', label: '移交编号', required: true },
                { name: 'reason', label: '移交原因', type: 'textarea', required: true },
              ],
              '提交法务',
              async (values) => {
                await controller.submit(`/api/v1/collection-cases/${caseId}/legal-handoffs`, {
                  handoffNumber: values.handoffNumber ?? '',
                  reason: values.reason ?? '',
                  idempotencyKey: `LEGAL-${Date.now().toString(36)}`,
                });
                await controller.load();
                status.textContent = controller.message;
              },
            );
          });
          actions.append(legal);
        }
      }
      for (const handoff of handoffs) {
        if (permissions.has('legal-case:decide') && handoff.state === 'REQUESTED') {
          const accept = el('button', 'primary', '受理法务移交');
          accept.addEventListener('click', () => {
            openForm(
              workspace,
              '独立受理法务移交',
              '服务器和数据库会拒绝申请人自受理。',
              [
                { name: 'reason', label: '受理意见', type: 'textarea', required: true },
                { name: 'reviewReference', label: '审查记录引用', required: true },
              ],
              '确认受理',
              async (values) => {
                await controller.submit(
                  `/api/v1/legal-handoffs/${textValue(handoff.id, '')}/accept`,
                  {
                    reason: values.reason ?? '',
                    evidence: { reviewReference: values.reviewReference ?? '' },
                    idempotencyKey: `LEGAL-ACCEPT-${Date.now().toString(36)}`,
                  },
                );
                await controller.load();
                status.textContent = controller.message;
              },
            );
          });
          actions.append(accept);
        }
        if (permissions.has('debt-evidence:generate') && handoff.state === 'ACCEPTED') {
          const packageAction = el('button', 'primary', '生成债权证据包');
          packageAction.addEventListener('click', () => {
            openForm(
              workspace,
              '生成不可变债权证据包',
              '系统会列出缺失项；不完整证据包不能用于法务结案。',
              [{ name: 'packageNumber', label: '证据包编号', required: true }],
              '冻结证据包',
              async (values) => {
                await controller.submit(
                  `/api/v1/legal-handoffs/${textValue(handoff.id, '')}/evidence-packages`,
                  {
                    packageNumber: values.packageNumber ?? '',
                    idempotencyKey: `DEBT-${Date.now().toString(36)}`,
                  },
                );
                await controller.load();
                status.textContent = controller.message;
              },
            );
          });
          actions.append(packageAction);
        }
      }
      if (actions.childElementCount) card.append(actions);
      for (const handoff of handoffs) {
        const packages = Array.isArray(handoff.packages)
          ? (handoff.packages as readonly Record<string, unknown>[])
          : [];
        for (const evidencePackage of packages)
          card.append(
            el(
              'p',
              'version-pin',
              `证据包 ${recordText(evidencePackage, 'packageNumber', 'package_number')} · ${businessStateLabel(recordText(evidencePackage, 'state', 'state'))} · ${recordText(evidencePackage, 'packageHash', 'package_hash').slice(0, 12)}`,
            ),
          );
      }
      list.append(card);
    }
    if (!list.childElementCount)
      list.append(el('p', 'pipeline-empty', '暂无催收案件；逾期应收可从这里建立闭环。'));
    panel.append(list);
    workspace.append(panel);
  }
  if (controller && permissions.has('bank-payment:read')) {
    const panel = el('section', 'qtc-workbench payment-workbench');
    const heading = el('div', 'pipeline-heading');
    const copy = el('div');
    copy.append(el('h2', '', '收款与核销'), el('p', '', '银行收款、认领与应收核销'));
    if (permissions.has('bank-payment:intake')) {
      const intake = el('button', 'primary', '＋ 登记银行收款');
      intake.addEventListener('click', () => {
        openForm(
          workspace,
          '登记银行收款',
          '银行引用和原始摘要将生成不可变哈希。',
          [
            {
              name: 'customerId',
              label: '客户',
              type: 'select',
              required: true,
              options: controller.customers.map((item) => ({
                value: item.id,
                label: item.name ?? item.id,
              })),
            },
            { name: 'bankReference', label: '银行流水号', required: true },
            { name: 'amount', label: '到账金额', type: 'number', required: true },
            {
              name: 'currency',
              label: '币种',
              type: 'select',
              required: true,
              options: [
                { value: 'CNY', label: '人民币' },
                { value: 'USD', label: '美元 USD' },
              ],
            },
            { name: 'receivedAt', label: '到账日期', type: 'date', required: true },
            { name: 'payer', label: '付款方户名', required: true },
          ],
          '保存收款',
          async (values) => {
            await controller.submit('/api/v1/bank-payments', {
              customerId: values.customerId ?? '',
              currency: values.currency ?? 'CNY',
              amount: values.amount ?? '',
              receivedAt: new Date(`${values.receivedAt ?? ''}T12:00:00.000Z`).toISOString(),
              bankReference: values.bankReference ?? '',
              rawPayload: { payer: values.payer ?? '', source: 'MANUAL_BANK_RECEIPT' },
            });
            await controller.load();
            status.textContent = controller.message;
          },
        );
      });
      heading.append(copy, intake);
    } else heading.append(copy);
    panel.append(heading);
    const list = el('div', 'qtc-list');
    for (const payment of controller.views.get('/api/v1/bank-payments') ?? []) {
      const card = el('article', 'qtc-card');
      card.append(
        el('p', 'eyebrow', recordText(payment, 'bankReference', 'bank_reference', '银行收款')),
        el(
          'strong',
          '',
          displayMoney(
            recordText(payment, 'currency', 'currency'),
            recordText(payment, 'amount', 'amount', '—'),
          ),
        ),
        el(
          'p',
          'qtc-metrics',
          `待核销 ${recordText(payment, 'remainingAmount', 'remaining_amount', '—')} · 到账 ${recordText(payment, 'receivedAt', 'received_at').slice(0, 10)}`,
        ),
      );
      if (
        permissions.has('reconciliation:run') &&
        Number(recordText(payment, 'remainingAmount', 'remaining_amount', '0')) > 0
      ) {
        const reconcile = el('button', 'primary', '运行自动核销');
        reconcile.addEventListener('click', () => {
          openForm(
            workspace,
            '运行自动核销',
            '系统将按客户、币种和稳定账龄顺序分配到账金额，并保存结果哈希。',
            [],
            '确认运行核销',
            async () => {
              await controller.submit('/api/v1/reconciliation-runs', {
                paymentId: textValue(payment.id, ''),
              });
              await controller.load();
              status.textContent = controller.message;
            },
          );
        });
        card.append(reconcile);
      }
      list.append(card);
    }
    if (!list.childElementCount) list.append(el('p', 'pipeline-empty', '暂无银行收款。'));
    panel.append(list);
    const runs = controller.views.get('/api/v1/reconciliation-runs') ?? [];
    const latestRun = runs[0];
    if (latestRun)
      panel.append(
        el(
          'p',
          'version-pin',
          `最近核销 ${recordText(latestRun, 'resultHash', 'result_hash').slice(0, 12)} · 共 ${String(runs.length)} 次可审计运行`,
        ),
      );
    workspace.append(panel);
  }
  if (
    controller &&
    (permissions.has('commission:read') || permissions.has('commission-policy:read'))
  ) {
    const panel = el('section', 'qtc-workbench commission-workbench');
    const percent = (value: string) => String(Number(value) / 100);
    const heading = el('div', 'pipeline-heading');
    const copy = el('div');
    copy.append(el('h2', '', '佣金引擎与不可变台账'), el('p', '', '佣金计提、释放、支付与追回'));
    if (permissions.has('commission-policy:manage')) {
      const createPolicy = el('button', 'secondary', '新建佣金政策');
      createPolicy.addEventListener('click', () => {
        openForm(
          workspace,
          '新建并发布佣金政策',
          '政策发布后不可修改；后续调整必须创建新版本。比例使用百分数输入。',
          [
            { name: 'code', label: '政策编码', required: true },
            { name: 'name', label: '政策名称', required: true },
            { name: 'baseRate', label: '基础佣金率（%）', type: 'number', required: true },
            { name: 'minimumMargin', label: '最低毛利率（%）', type: 'number', required: true },
            {
              name: 'releaseCollection',
              label: '释放回款比例（%）',
              type: 'number',
              required: true,
            },
            { name: 'effectiveAt', label: '生效日期', type: 'date', required: true },
          ],
          '发布政策',
          async (values) => {
            const bps = (value: string | undefined) => Math.round(Number(value ?? '0') * 100);
            await controller.submit('/api/v1/commission-policies', {
              code: values.code ?? '',
              name: values.name ?? '',
              applicability: { business: 'ARTIFICIAL_TURF', region: 'ALL' },
              baseRateBasisPoints: bps(values.baseRate),
              minimumMarginBasisPoints: bps(values.minimumMargin),
              releaseCollectionBasisPoints: bps(values.releaseCollection),
              effectiveAt: new Date(`${values.effectiveAt ?? ''}T00:00:00.000Z`).toISOString(),
              rules: [
                { code: 'MIN_MARGIN', description: '实际毛利率达到政策门槛' },
                { code: 'COLLECTION_RELEASE', description: '回款比例达到释放门槛' },
              ],
              publish: true,
            });
            await controller.load();
            status.textContent = controller.message;
          },
        );
      });
      heading.append(copy, createPolicy);
    } else heading.append(copy);
    panel.append(heading);
    const policies = controller.views.get('/api/v1/commission-policies') ?? [];
    const publishedPolicies = policies.filter((item) => item.status === 'PUBLISHED');
    if (permissions.has('commission:accrue') && publishedPolicies.length) {
      const accrue = el('button', 'primary', '＋ 计算并计提佣金');
      accrue.addEventListener('click', () => {
        const orders = controller.views.get('/api/v1/sales-orders') ?? [];
        openForm(
          workspace,
          '计算并计提佣金',
          '服务器读取订单、报价毛利与核销台账，金额和状态不能由前端指定。',
          [
            {
              name: 'salesOrderId',
              label: '销售订单',
              type: 'select',
              required: true,
              options: orders.map((item) => ({
                value: textValue(item.id, ''),
                label: `${recordText(item, 'orderNumber', 'order_number')} · ${recordText(item, 'currency', 'currency')} ${recordText(item, 'total', 'total')}`,
              })),
            },
            {
              name: 'beneficiaryEmployeeId',
              label: '佣金受益人',
              type: 'select',
              required: true,
              options: controller.employees
                .filter((item) => item.active !== false)
                .map((item) => ({ value: item.id, label: item.displayName ?? item.id })),
            },
            {
              name: 'policyVersionId',
              label: '已发布政策版本',
              type: 'select',
              required: true,
              options: publishedPolicies.map((item) => ({
                value: textValue(item.id, ''),
                label: `${recordText(item, 'code', 'code')} · 第 ${recordText(item, 'version', 'version', '1')} 版 · ${percent(recordText(item, 'baseRateBasisPoints', 'base_rate_basis_points', '0'))}%`,
              })),
            },
            { name: 'accountingPeriod', label: '会计期间（YYYY-MM）', required: true },
          ],
          '执行计提',
          async (values) => {
            await controller.submit('/api/v1/commissions/accrue', {
              salesOrderId: values.salesOrderId ?? '',
              beneficiaryEmployeeId: values.beneficiaryEmployeeId ?? '',
              policyVersionId: values.policyVersionId ?? '',
              accountingPeriod: values.accountingPeriod ?? '',
            });
            await controller.load();
            status.textContent = controller.message;
          },
        );
      });
      panel.append(accrue);
    }
    if (policies.length) {
      const policyStrip = el('div', 'commission-policy-strip');
      for (const policy of policies.slice(0, 4)) {
        const policyCard = el('div', 'commission-policy-card');
        policyCard.append(
          el(
            'span',
            'version-pin',
            `${recordText(policy, 'code', 'code')} 第 ${recordText(policy, 'version', 'version')} 版 · ${businessStateLabel(recordText(policy, 'status', 'status'))} · 佣金率 ${percent(recordText(policy, 'baseRateBasisPoints', 'base_rate_basis_points', '0'))}% · 毛利门槛 ${percent(recordText(policy, 'minimumMarginBasisPoints', 'minimum_margin_basis_points', '0'))}% · 回款门槛 ${percent(recordText(policy, 'releaseCollectionBasisPoints', 'release_collection_basis_points', '0'))}%`,
          ),
        );
        if (permissions.has('commission-policy:manage') && policy.status === 'PUBLISHED') {
          const revise = el('button', 'secondary', '创建新版本');
          revise.addEventListener('click', () => {
            openForm(
              workspace,
              '创建佣金政策新版本',
              '历史版本保持不变；新版本先保存为草稿，复核后单独发布。',
              [
                { name: 'baseRate', label: '基础佣金率（%）', type: 'number', required: true },
                {
                  name: 'minimumMargin',
                  label: '最低毛利率（%）',
                  type: 'number',
                  required: true,
                },
                {
                  name: 'releaseCollection',
                  label: '释放回款比例（%）',
                  type: 'number',
                  required: true,
                },
                { name: 'effectiveAt', label: '生效日期', type: 'date', required: true },
              ],
              '保存版本草稿',
              async (values) => {
                const bps = (value: string | undefined) => Math.round(Number(value ?? '0') * 100);
                await controller.submit(
                  `/api/v1/commission-policies/${recordText(policy, 'policyId', 'policyId')}/versions`,
                  {
                    baseRateBasisPoints: bps(values.baseRate),
                    minimumMarginBasisPoints: bps(values.minimumMargin),
                    releaseCollectionBasisPoints: bps(values.releaseCollection),
                    effectiveAt: new Date(
                      `${values.effectiveAt ?? ''}T00:00:00.000Z`,
                    ).toISOString(),
                    rules: [
                      { code: 'MIN_MARGIN', description: '实际毛利率达到政策门槛' },
                      { code: 'COLLECTION_RELEASE', description: '回款比例达到释放门槛' },
                    ],
                  },
                );
                await controller.load();
                status.textContent = controller.message;
              },
            );
          });
          policyCard.append(revise);
        }
        if (permissions.has('commission-policy:manage') && policy.status === 'DRAFT') {
          const publish = el('button', 'primary', '发布此版本');
          publish.addEventListener('click', () => {
            void controller
              .submit(`/api/v1/commission-policy-versions/${textValue(policy.id, '')}/publish`, {})
              .then(async () => {
                await controller.load();
                status.textContent = controller.message;
              });
          });
          policyCard.append(publish);
        }
        policyStrip.append(policyCard);
      }
      panel.append(policyStrip);
    }
    const commissionPriority: Readonly<Record<string, number>> = {
      RELEASED: 0,
      FROZEN: 1,
      ACCRUED: 2,
      PAID: 3,
      CLAWED_BACK: 4,
      CANCELLED: 5,
    };
    const cases = [...(controller.views.get('/api/v1/commissions') ?? [])].sort(
      (left, right) =>
        (commissionPriority[recordText(left, 'effectiveState', 'effective_state')] ?? 9) -
        (commissionPriority[recordText(right, 'effectiveState', 'effective_state')] ?? 9),
    );
    if (cases.length) {
      const summary = el('div', 'workbench-summary-grid');
      const released = cases.filter(
        (item) => recordText(item, 'effectiveState', 'effective_state') === 'RELEASED',
      ).length;
      const frozen = cases.filter(
        (item) => recordText(item, 'effectiveState', 'effective_state') === 'FROZEN',
      ).length;
      summary.append(
        el('div', 'summary-card', `待登记支付\n${String(released)} 笔`),
        el('div', 'summary-card', `冻结待处理\n${String(frozen)} 笔`),
        el('div', 'summary-card', `全部佣金\n${String(cases.length)} 笔`),
      );
      panel.append(summary);
    }
    const list = el('div', 'qtc-list commission-list');
    const labels: Record<string, string> = {
      ACCRUED: '已计提',
      FROZEN: '已冻结',
      RELEASED: '已释放',
      PAID: '已支付',
      CLAWED_BACK: '已追回',
      CANCELLED: '已取消',
    };
    for (const commission of cases) {
      const state = recordText(commission, 'effectiveState', 'effective_state', 'ACCRUED');
      const ledger = Array.isArray(commission.ledger)
        ? commission.ledger.map((item) => recordValue(item))
        : [];
      const card = el('article', 'qtc-card commission-card');
      card.append(
        el(
          'p',
          'eyebrow',
          `${recordText(commission, 'orderNumber', 'orderNumber', 'ORDER')} · ${recordText(commission, 'accountingPeriod', 'accounting_period')}`,
        ),
        el(
          'strong',
          '',
          displayMoney(
            recordText(commission, 'currency', 'currency'),
            recordText(commission, 'commissionAmount', 'commission_amount', '—'),
          ),
        ),
        el('span', `ctr-state state-${state.toLocaleLowerCase()}`, labels[state] ?? state),
        el(
          'p',
          'qtc-metrics',
          `收入 ${recordText(commission, 'eligibleRevenue', 'eligible_revenue', '—')} · 毛利率 ${percent(recordText(commission, 'marginBasisPoints', 'margin_basis_points', '0'))}% · 计提时回款 ${percent(recordText(commission, 'collectionBasisPoints', 'collection_basis_points', '0'))}%`,
        ),
        el(
          'p',
          'muted',
          `受益人 ${recordText(commission, 'beneficiaryName', 'beneficiaryName', '—')} · 政策 ${recordText(commission, 'policyCode', 'policyCode', '—')} 第 ${recordText(commission, 'policyVersion', 'policyVersion', '—')} 版`,
        ),
        el('p', 'next-action-note', `下一步：${commissionNextAction(state)}`),
      );
      const timeline = el('ol', 'commission-ledger');
      for (const entry of ledger)
        timeline.append(
          el(
            'li',
            '',
            `${recordText(entry, 'sequence', 'sequence')} · ${labels[recordText(entry, 'state', 'state')] ?? recordText(entry, 'state', 'state')} · ${recordText(entry, 'reason', 'reason')} · ${recordText(entry, 'externalReference', 'external_reference', '无外部引用')}`,
          ),
        );
      card.append(timeline);
      const actions = el('div', 'qtc-actions');
      const addCommand = (
        action: 'freeze' | 'release' | 'pay' | 'clawback' | 'cancel',
        label: string,
        needsReference = false,
      ) => {
        const button = el(
          'button',
          action === 'pay' || action === 'release' ? 'primary' : 'secondary',
          label,
        );
        button.addEventListener('click', () => {
          openForm(
            workspace,
            label,
            '该操作追加一条不可变佣金台账，不会覆盖任何历史记录。',
            [
              { name: 'reason', label: '操作理由', type: 'textarea', required: true },
              ...(needsReference
                ? [{ name: 'externalReference', label: '外部凭证号', required: true } as const]
                : []),
            ],
            '确认追加台账',
            async (values) => {
              await controller.submit(
                `/api/v1/commissions/${textValue(commission.id, '')}/${action}`,
                {
                  reason: values.reason ?? '',
                  ...(needsReference ? { externalReference: values.externalReference ?? '' } : {}),
                },
              );
              await controller.load();
              status.textContent = controller.message;
            },
          );
        });
        actions.append(button);
      };
      if (permissions.has('commission:manage')) {
        if (state === 'ACCRUED') addCommand('freeze', '冻结');
        if (state === 'ACCRUED' || state === 'FROZEN') addCommand('release', '复核并释放');
        if (['ACCRUED', 'FROZEN', 'RELEASED'].includes(state)) addCommand('cancel', '取消');
        if (state === 'RELEASED') addCommand('freeze', '重新冻结');
        if (state === 'PAID') addCommand('clawback', '追回', true);
      }
      if (state === 'RELEASED' && permissions.has('commission:pay'))
        addCommand('pay', '记录支付', true);
      if (actions.children.length > 0) card.append(actions);
      list.append(card);
    }
    if (list.children.length === 0) list.append(el('p', 'pipeline-empty', '暂无佣金计提。'));
    panel.append(list);
    workspace.append(panel);
  }
  if (controller && (permissions.has('risk:read') || permissions.has('risk-policy:read'))) {
    const panel = el('section', 'qtc-workbench risk-workbench');
    const heading = el('div', 'pipeline-heading');
    const copy = el('div');
    copy.append(
      el('p', 'eyebrow', '风险评估'),
      el('h2', '', '风险评价与责任任务'),
      el('p', '', '风险评价、责任任务与处置记录'),
    );
    heading.append(copy);
    panel.append(heading);
    if (riskPolicyControls) panel.append(riskPolicyControls);
    const riskPriority: Readonly<Record<string, number>> = {
      CRITICAL: 0,
      HIGH: 1,
      MEDIUM: 2,
      LOW: 3,
    };
    const evaluations = [...(controller.views.get('/api/v1/risk-evaluations') ?? [])].sort(
      (left, right) =>
        (riskPriority[recordText(left, 'severity', 'severity')] ?? 9) -
        (riskPriority[recordText(right, 'severity', 'severity')] ?? 9),
    );
    if (evaluations.length) {
      const openTasks = evaluations.filter((item) => {
        const task = recordValue(item.task);
        return (
          Boolean(task.id) && recordText(task, 'effective_state', 'effective_state') !== 'CLOSED'
        );
      }).length;
      const highRisk = evaluations.filter((item) =>
        ['CRITICAL', 'HIGH'].includes(recordText(item, 'severity', 'severity')),
      ).length;
      const summary = el('div', 'workbench-summary-grid');
      summary.append(
        el('div', 'summary-card', `高风险评价\n${String(highRisk)} 项`),
        el('div', 'summary-card', `未关闭责任任务\n${String(openTasks)} 项`),
        el('div', 'summary-card', `全部评价\n${String(evaluations.length)} 项`),
      );
      panel.append(summary);
    }
    const list = el('div', 'risk-list');
    for (const evaluation of evaluations) {
      const task = recordValue(evaluation.task);
      const findings = Array.isArray(evaluation.findings)
        ? evaluation.findings.map(recordValue)
        : [];
      const events = Array.isArray(evaluation.taskEvents)
        ? evaluation.taskEvents.map(recordValue)
        : [];
      const card = el('article', 'qtc-card risk-card');
      card.append(
        el('p', 'eyebrow', recordText(evaluation, 'orderNumber', 'orderNumber', 'ORDER')),
        el(
          'strong',
          '',
          `${businessStateLabel(recordText(evaluation, 'severity', 'severity'))}风险 · ${recordText(evaluation, 'score', 'score')} 分`,
        ),
        el(
          'span',
          `ctr-state state-${recordText(task, 'effective_state', 'effective_state', 'LOW').toLocaleLowerCase()}`,
          businessStateLabel(
            recordText(task, 'effective_state', 'effective_state', '无需任务'),
            '无需任务',
          ),
        ),
        el(
          'p',
          'qtc-metrics',
          findings.length
            ? findings
                .map(
                  (finding) =>
                    `${riskRuleLabel(finding.code)}：实际 ${recordText(finding, 'actual', 'amount', '—')} / 门槛 ${recordText(finding, 'threshold', 'graceDays', '—')}`,
                )
                .join('；')
            : '未命中风险规则',
        ),
      );
      const timeline = el('ol', 'risk-task-timeline');
      for (const event of events)
        timeline.append(
          el(
            'li',
            '',
            `${recordText(event, 'sequence', 'sequence')} · ${businessStateLabel(recordText(event, 'state', 'state'))} · ${recordText(event, 'reason', 'reason')}`,
          ),
        );
      card.append(timeline);
      const taskState = recordText(task, 'effective_state', 'effective_state');
      if (permissions.has('risk:manage') && typeof task.id === 'string' && taskState !== 'CLOSED') {
        const commands =
          taskState === 'OPEN'
            ? ([
                ['acknowledge', '确认'],
                ['escalate', '升级'],
                ['close', '关闭'],
              ] as const)
            : taskState === 'ACKNOWLEDGED'
              ? ([
                  ['escalate', '升级'],
                  ['close', '关闭'],
                ] as const)
              : ([['close', '关闭']] as const);
        for (const [action, label] of commands) {
          const command = el('button', 'secondary', label);
          command.addEventListener('click', () => {
            openForm(
              workspace,
              `${label}风险任务`,
              '本操作只追加任务事件；关闭必须提供可追溯证据编号。',
              [
                { name: 'reason', label: '处理理由', type: 'textarea', required: true },
                { name: 'evidence', label: '证据编号', required: true },
              ],
              '追加任务事件',
              async (values) => {
                await controller.submit(`/api/v1/risk-tasks/${task.id as string}/${action}`, {
                  reason: values.reason ?? '',
                  evidence: { reference: values.evidence ?? '' },
                });
                await controller.load();
                status.textContent = controller.message;
              },
            );
          });
          card.append(command);
        }
      }
      list.append(card);
    }
    if (list.children.length === 0) list.append(el('p', 'pipeline-empty', '暂无风险评价。'));
    panel.append(list);
    workspace.append(panel);
  }
  if (
    controller &&
    (permissions.has('manufacturing-item:read') ||
      permissions.has('bom:read') ||
      permissions.has('routing:read'))
  ) {
    const panel = el('section', 'manufacturing-workbench');
    panel.setAttribute('data-testid', 'manufacturing-workbench');
    panel.append(
      el('p', 'eyebrow', '制造主数据'),
      el('h2', '', '制造主数据工作台'),
      el('p', 'commercial-help', '物料、BOM 与工艺路线版本'),
    );
    const grid = el('div', 'manufacturing-grid');
    const definitions = [
      {
        title: '物料与规格版本',
        path: '/api/v1/manufacturing-items',
        read: 'manufacturing-item:read',
        manage: 'manufacturing-item:manage',
        publish: 'manufacturing-item',
        example: {
          sku: 'FG-KT-PRO-50',
          name: '金特夫 50mm 景观草',
          itemType: 'FINISHED_GOOD',
          baseUnitCode: 'M2',
          specification: { pileHeightMm: 50 },
          effectiveAt: new Date().toISOString(),
          publish: false,
        },
      },
      {
        title: 'BOM 与替代料',
        path: '/api/v1/manufacturing-boms',
        read: 'bom:read',
        manage: 'bom:manage',
        publish: 'manufacturing-bom',
        example: {
          code: 'BOM-KT-PRO-50',
          name: '50mm 标准 BOM',
          productItemId: '产品主编号',
          productItemVersionId: '产品版本编号',
          outputQuantity: '1',
          effectiveAt: new Date().toISOString(),
          lines: [
            {
              componentItemVersionId: '组件版本编号',
              quantity: '1.25',
              scrapBasisPoints: 300,
              substitutes: [],
            },
          ],
          publish: false,
        },
      },
      {
        title: '工艺路线与工序',
        path: '/api/v1/manufacturing-routings',
        read: 'routing:read',
        manage: 'routing:manage',
        publish: 'manufacturing-routing',
        example: {
          code: 'RT-KT-PRO-50',
          name: '50mm 标准工艺',
          productItemId: '产品主编号',
          productItemVersionId: '产品版本编号',
          effectiveAt: new Date().toISOString(),
          operations: [
            {
              operationCode: 'TUFT',
              name: '簇绒',
              workCenterCode: 'WC-TUFT-01',
              sequence: 10,
              setupMinutes: '60',
              runMinutesPerUnit: '0.8',
              instructions: {},
            },
          ],
          publish: false,
        },
      },
    ] as const;
    for (const definition of definitions) {
      if (!permissions.has(definition.read)) continue;
      const card = el('article', 'manufacturing-card');
      card.append(el('h3', '', definition.title));
      const items = controller.views.get(definition.path) ?? [];
      for (const item of items) {
        const row = el('div', 'manufacturing-version');
        row.append(
          el(
            'strong',
            '',
            recordText(item, 'sku', 'code', recordText(item, 'name', 'name', '未命名')),
          ),
          el(
            'span',
            `ctr-state state-${recordText(item, 'status', 'status', 'DRAFT').toLowerCase()}`,
            `${businessStateLabel(recordText(item, 'status', 'status', 'DRAFT'))} · 第 ${recordText(item, 'version', 'version', '1')} 版`,
          ),
          el(
            'p',
            'muted',
            recordText(
              item,
              'name',
              'name',
              recordText(item, 'canonical_hash', 'canonical_hash').slice(0, 16),
            ),
          ),
        );
        if (
          permissions.has(definition.manage) &&
          recordText(item, 'status', 'status') === 'DRAFT' &&
          typeof item.id === 'string'
        ) {
          const publish = el('button', 'secondary', '发布版本');
          publish.addEventListener('click', () => {
            void controller
              .submit(`/api/v1/${definition.publish}-versions/${item.id as string}/publish`, {})
              .then(async () => {
                await controller.load();
                status.textContent = controller.message;
              });
          });
          row.append(publish);
        }
        card.append(row);
      }
      if (!items.length) card.append(el('p', 'pipeline-empty', '暂无版本。'));
      if (permissions.has(definition.manage)) {
        const create = el('button', 'primary', '＋ 创建版本');
        create.addEventListener('click', () => {
          const publishedItems = (controller.views.get('/api/v1/manufacturing-items') ?? []).filter(
            (item) => recordText(item, 'status', 'status') === 'PUBLISHED',
          );
          const itemOptions = publishedItems.map((item) => ({
            value: String(item.id),
            label: `${recordText(item, 'sku', 'sku')} · ${recordText(item, 'name', 'name')}`,
          }));
          const finish = async (payload: Record<string, unknown>) => {
            await controller.submit(definition.path, payload);
            await controller.load();
            status.textContent = controller.message;
          };
          if (definition.path === '/api/v1/manufacturing-items')
            openForm(
              workspace,
              '创建物料版本',
              '建立稳定 SKU 和规格版本；确认后可发布并冻结历史。',
              [
                { name: 'sku', label: 'SKU 编码', required: true, placeholder: 'FG-KT-PRO-50' },
                { name: 'name', label: '物料名称', required: true },
                {
                  name: 'itemType',
                  label: '物料类型',
                  type: 'select',
                  required: true,
                  options: [
                    { value: 'RAW_MATERIAL', label: '原材料' },
                    { value: 'SEMI_FINISHED', label: '半成品' },
                    { value: 'FINISHED_GOOD', label: '成品' },
                    { value: 'PACKAGING', label: '包装物' },
                  ],
                },
                { name: 'baseUnitCode', label: '基本单位', required: true, value: 'M2' },
                { name: 'pileHeightMm', label: '草高（mm，可选）', type: 'number' },
                {
                  name: 'effectiveAt',
                  label: '生效日期',
                  type: 'date',
                  required: true,
                  value: new Date().toISOString().slice(0, 10),
                },
              ],
              '保存草稿',
              async (values) =>
                finish({
                  sku: values.sku,
                  name: values.name,
                  itemType: values.itemType,
                  baseUnitCode: values.baseUnitCode,
                  specification: values.pileHeightMm
                    ? { pileHeightMm: Number(values.pileHeightMm) }
                    : {},
                  effectiveAt: `${values.effectiveAt ?? ''}T00:00:00.000Z`,
                  publish: false,
                }),
            );
          else if (definition.path === '/api/v1/manufacturing-boms')
            openForm(
              workspace,
              '创建标准 BOM',
              '从已发布物料版本选择成品、主料和可选替代料。',
              [
                { name: 'code', label: 'BOM 编码', required: true },
                { name: 'name', label: 'BOM 名称', required: true },
                {
                  name: 'product',
                  label: '成品版本',
                  type: 'select',
                  required: true,
                  options: itemOptions,
                },
                {
                  name: 'component',
                  label: '主料版本',
                  type: 'select',
                  required: true,
                  options: itemOptions,
                },
                { name: 'quantity', label: '单位用量', type: 'number', required: true, value: '1' },
                {
                  name: 'scrap',
                  label: '损耗（基点）',
                  type: 'number',
                  required: true,
                  value: '0',
                },
                {
                  name: 'substitute',
                  label: '替代料版本（可选）',
                  type: 'select',
                  options: [{ value: '', label: '无替代料' }, ...itemOptions],
                },
                {
                  name: 'effectiveAt',
                  label: '生效日期',
                  type: 'date',
                  required: true,
                  value: new Date().toISOString().slice(0, 10),
                },
              ],
              '保存 BOM 草稿',
              async (values) => {
                const product = publishedItems.find((item) => item.id === values.product);
                return finish({
                  code: values.code,
                  name: values.name,
                  productItemId: product?.itemId,
                  productItemVersionId: values.product,
                  outputQuantity: '1',
                  effectiveAt: `${values.effectiveAt ?? ''}T00:00:00.000Z`,
                  lines: [
                    {
                      componentItemVersionId: values.component,
                      quantity: values.quantity,
                      scrapBasisPoints: Number(values.scrap),
                      substitutes: values.substitute
                        ? [{ itemVersionId: values.substitute, priority: 1, conversionFactor: '1' }]
                        : [],
                    },
                  ],
                  publish: false,
                });
              },
            );
          else
            openForm(
              workspace,
              '创建标准工艺路线',
              '定义成品的簇绒、背胶和包装标准工序及节拍。',
              [
                { name: 'code', label: '路线编码', required: true },
                { name: 'name', label: '路线名称', required: true },
                {
                  name: 'product',
                  label: '成品版本',
                  type: 'select',
                  required: true,
                  options: itemOptions,
                },
                {
                  name: 'tuftRate',
                  label: '簇绒分钟/㎡',
                  type: 'number',
                  required: true,
                  value: '0.8',
                },
                {
                  name: 'coatRate',
                  label: '背胶分钟/㎡',
                  type: 'number',
                  required: true,
                  value: '0.5',
                },
                {
                  name: 'packRate',
                  label: '包装分钟/㎡',
                  type: 'number',
                  required: true,
                  value: '0.2',
                },
                {
                  name: 'effectiveAt',
                  label: '生效日期',
                  type: 'date',
                  required: true,
                  value: new Date().toISOString().slice(0, 10),
                },
              ],
              '保存路线草稿',
              async (values) => {
                const product = publishedItems.find((item) => item.id === values.product);
                return finish({
                  code: values.code,
                  name: values.name,
                  productItemId: product?.itemId,
                  productItemVersionId: values.product,
                  effectiveAt: `${values.effectiveAt ?? ''}T00:00:00.000Z`,
                  publish: false,
                  operations: [
                    {
                      operationCode: 'TUFT',
                      name: '簇绒',
                      workCenterCode: 'WC-TUFT-01',
                      sequence: 10,
                      setupMinutes: '60',
                      runMinutesPerUnit: values.tuftRate,
                      instructions: {},
                    },
                    {
                      operationCode: 'COAT',
                      name: '背胶',
                      workCenterCode: 'WC-COAT-01',
                      sequence: 20,
                      setupMinutes: '45',
                      runMinutesPerUnit: values.coatRate,
                      instructions: {},
                    },
                    {
                      operationCode: 'PACK',
                      name: '裁切包装',
                      workCenterCode: 'WC-PACK-01',
                      sequence: 30,
                      setupMinutes: '20',
                      runMinutesPerUnit: values.packRate,
                      instructions: {},
                    },
                  ],
                });
              },
            );
        });
        card.append(create);
      }
      grid.append(card);
    }
    panel.append(grid);
    workspace.append(panel);
  }
  if (
    controller &&
    (permissions.has('supplier:read') ||
      permissions.has('procurement:read') ||
      permissions.has('inventory:read') ||
      permissions.has('inventory:move'))
  ) {
    const panel = el('section', 'procurement-workbench');
    panel.setAttribute('data-testid', 'procurement-workbench');
    panel.append(
      el('p', 'eyebrow', '采购到入库'),
      el('h2', '', '供应商、采购与批次库存'),
      el('p', 'commercial-help', '供应商、询报价、采购与批次收货'),
    );
    const suppliers = controller.views.get('/api/v1/suppliers') ?? [],
      rfqs = controller.views.get('/api/v1/procurement-rfqs') ?? [],
      supplierQuotes = controller.views.get('/api/v1/supplier-quotes') ?? [],
      purchaseOrders = controller.views.get('/api/v1/purchase-orders') ?? [],
      receipts = controller.views.get('/api/v1/goods-receipts') ?? [],
      locations = controller.views.get('/api/v1/inventory-locations') ?? [],
      balances = controller.views.get('/api/v1/inventory-balances') ?? [],
      manufacturingItems = controller.views.get('/api/v1/manufacturing-items') ?? [];
    const refresh = async () => {
      await controller.load();
      status.textContent = controller.message;
    };
    const procurementSummary = el('div', 'production-summary');
    procurementSummary.append(
      el(
        'div',
        'metric-card',
        `待准入供应商\n${String(suppliers.filter((item) => recordText(item, 'status', 'status') !== 'APPROVED').length)} 家`,
      ),
      el(
        'div',
        'metric-card',
        `询价进行中\n${String(rfqs.filter((item) => !['CLOSED', 'CANCELLED'].includes(recordText(item, 'status', 'status'))).length)} 单`,
      ),
      el(
        'div',
        'metric-card',
        `待收采购单\n${String(purchaseOrders.filter((item) => ['ISSUED', 'PARTIALLY_RECEIVED'].includes(recordText(item, 'status', 'status'))).length)} 单`,
      ),
      el(
        'div',
        'metric-card',
        `待检库存\n${String(balances.filter((item) => recordText(item, 'qualityStatus', 'qualityStatus') === 'QUARANTINE').length)} 批`,
      ),
    );
    panel.append(procurementSummary);
    const grid = el('div', 'procurement-grid');
    const supplierPanel = el('article', 'procurement-column supplier-register');
    supplierPanel.append(el('h3', '', '供应商与准入'));
    for (const supplier of suppliers) {
      const qualifications = Array.isArray(supplier.qualifications)
        ? supplier.qualifications.map(recordValue)
        : [];
      supplierPanel.append(
        el(
          'div',
          'procurement-card',
          `${recordText(supplier, 'supplierNumber', 'supplier_number')} · ${recordText(supplier, 'name', 'name')}\n${businessStateLabel(recordText(supplier, 'status', 'status'))} · 账期 ${recordText(supplier, 'paymentTermsDays', 'payment_terms_days')} 天 · 已准入 ${String(qualifications.filter((item) => item.status === 'APPROVED').length)} 项`,
        ),
      );
    }
    if (permissions.has('supplier:manage')) {
      const createSupplier = el('button', 'primary', '＋ 新建供应商');
      createSupplier.addEventListener('click', () => {
        openForm(
          workspace,
          '新建供应商',
          '建立供应商编号、结算条件和质量评级。',
          [
            { name: 'supplierNumber', label: '供应商编号', required: true },
            { name: 'name', label: '供应商名称', required: true },
            {
              name: 'paymentTermsDays',
              label: '账期（天）',
              type: 'number',
              required: true,
              value: '30',
            },
            {
              name: 'qualityRating',
              label: '质量评分（0-100）',
              type: 'number',
              required: true,
              value: '90',
            },
            { name: 'contactName', label: '联系人', required: true },
            { name: 'contactPhone', label: '联系电话', type: 'tel', required: true },
          ],
          '保存供应商',
          async (values) => {
            await controller.submit('/api/v1/suppliers', {
              supplierNumber: values.supplierNumber,
              name: values.name,
              currency: 'CNY',
              paymentTermsDays: Number(values.paymentTermsDays),
              qualityRatingBasisPoints: Number(values.qualityRating) * 100,
              contact: { name: values.contactName, phone: values.contactPhone },
            });
            await refresh();
          },
        );
      });
      supplierPanel.append(createSupplier);
      const qualify = el('button', 'secondary', '＋ 物料准入');
      qualify.addEventListener('click', () => {
        openForm(
          workspace,
          '供应商物料准入',
          '准入引用精确的已发布物料版本，并保留审核证据和有效期。',
          [
            {
              name: 'supplierId',
              label: '供应商',
              type: 'select',
              required: true,
              options: suppliers.map((item) => ({
                value: String(item.id),
                label: recordText(item, 'name', 'name'),
              })),
            },
            {
              name: 'itemVersionId',
              label: '物料版本',
              type: 'select',
              required: true,
              options: manufacturingItems
                .filter((item) => recordText(item, 'status', 'status') === 'PUBLISHED')
                .map((item) => ({
                  value: String(item.id),
                  label: `${recordText(item, 'sku', 'sku')} · ${recordText(item, 'name', 'name')}`,
                })),
            },
            { name: 'validFrom', label: '有效起始日', type: 'date', required: true },
            { name: 'validTo', label: '有效截止日', type: 'date', required: true },
            {
              name: 'minimumOrderQuantity',
              label: '最小订购量',
              type: 'number',
              required: true,
              value: '0',
            },
            { name: 'leadTimeDays', label: '交期（天）', type: 'number', required: true },
            { name: 'evidenceReference', label: '审核证据编号', required: true },
          ],
          '批准准入',
          async (values) => {
            await controller.submit(`/api/v1/suppliers/${values.supplierId ?? ''}/qualifications`, {
              itemVersionId: values.itemVersionId,
              status: 'APPROVED',
              validFrom: values.validFrom,
              validTo: values.validTo,
              minimumOrderQuantity: values.minimumOrderQuantity,
              leadTimeDays: Number(values.leadTimeDays),
              evidence: { reference: values.evidenceReference },
            });
            await refresh();
          },
        );
      });
      supplierPanel.append(qualify);
    }
    const sourcingPanel = el('article', 'procurement-column sourcing-register');
    sourcingPanel.append(el('h3', '', '询价与报价'));
    for (const rfq of rfqs)
      sourcingPanel.append(
        el(
          'div',
          'procurement-card',
          `${recordText(rfq, 'rfqNumber', 'rfq_number')} · ${businessStateLabel(recordText(rfq, 'status', 'status'))} · ${String(Array.isArray(rfq.lines) ? rfq.lines.length : 0)} 项`,
        ),
      );
    for (const quote of supplierQuotes)
      sourcingPanel.append(
        el(
          'div',
          'procurement-card quote-card',
          `报价 ${recordText(quote, 'quoteReference', 'quote_reference')} · ${recordText(quote, 'supplierName', 'supplierName')} · 有效至 ${recordText(quote, 'validUntil', 'valid_until')}`,
        ),
      );
    if (permissions.has('procurement:manage')) {
      const publishedItemOptions = manufacturingItems
        .filter((item) => recordText(item, 'status', 'status') === 'PUBLISHED')
        .map((item) => ({
          value: String(item.id),
          label: `${recordText(item, 'sku', 'sku')} · ${recordText(item, 'name', 'name')}`,
        }));
      const createRfq = el('button', 'secondary', '＋ 新建并发出询价单');
      createRfq.addEventListener('click', () => {
        openForm(
          workspace,
          '创建采购询价',
          '选择已发布物料版本并明确数量、交期和报价截止时间。',
          [
            { name: 'rfqNumber', label: '询价单编号', required: true },
            {
              name: 'itemVersionId',
              label: '采购物料',
              type: 'select',
              required: true,
              options: publishedItemOptions,
            },
            { name: 'quantity', label: '询价数量', type: 'number', required: true },
            { name: 'requiredAt', label: '要求到货日', type: 'date', required: true },
            { name: 'responseDue', label: '报价截止日', type: 'date', required: true },
          ],
          '发出询价单',
          async (values) => {
            await controller.submit('/api/v1/procurement-rfqs', {
              rfqNumber: values.rfqNumber,
              responseDueAt: `${values.responseDue ?? ''}T23:59:59.000Z`,
              currency: 'CNY',
              issue: true,
              lines: [
                {
                  itemVersionId: values.itemVersionId,
                  quantity: values.quantity,
                  requiredAt: values.requiredAt,
                },
              ],
            });
            await refresh();
          },
        );
      });
      sourcingPanel.append(createRfq);
      const rfqLineOptions = rfqs.flatMap((rfq) =>
        (Array.isArray(rfq.lines) ? rfq.lines.map(recordValue) : []).map((line) => ({
          value: `${String(rfq.id)}|${String(line.id)}`,
          label: `${recordText(rfq, 'rfqNumber', 'rfq_number')} · ${recordText(line, 'sku', 'sku')}`,
        })),
      );
      const receiveQuote = el('button', 'secondary', '＋ 登记供应商报价');
      receiveQuote.addEventListener('click', () => {
        openForm(
          workspace,
          '登记供应商报价',
          '报价必须引用已发出的询价单、有效准入供应商和精确询价明细。',
          [
            {
              name: 'rfqLine',
              label: '询价单明细',
              type: 'select',
              required: true,
              options: rfqLineOptions,
            },
            {
              name: 'supplierId',
              label: '供应商',
              type: 'select',
              required: true,
              options: suppliers.map((item) => ({
                value: String(item.id),
                label: recordText(item, 'name', 'name'),
              })),
            },
            { name: 'quoteReference', label: '供应商报价编号', required: true },
            { name: 'unitPrice', label: '单价', type: 'number', required: true },
            {
              name: 'minimumOrderQuantity',
              label: '最小订购量',
              type: 'number',
              required: true,
              value: '0',
            },
            { name: 'promisedAt', label: '承诺到货日', type: 'date', required: true },
            { name: 'validUntil', label: '报价有效期', type: 'date', required: true },
          ],
          '保存不可变报价',
          async (values) => {
            const [rfqId, rfqLineId] = (values.rfqLine ?? '').split('|');
            await controller.submit('/api/v1/supplier-quotes', {
              rfqId,
              supplierId: values.supplierId,
              quoteReference: values.quoteReference,
              receivedAt: new Date().toISOString(),
              validUntil: values.validUntil,
              terms: { currency: 'CNY' },
              lines: [
                {
                  rfqLineId,
                  unitPrice: values.unitPrice,
                  promisedAt: values.promisedAt,
                  minimumOrderQuantity: values.minimumOrderQuantity,
                },
              ],
            });
            await refresh();
          },
        );
      });
      sourcingPanel.append(receiveQuote);
    }
    const orderPanel = el('article', 'procurement-column purchase-register');
    orderPanel.append(el('h3', '', '采购订单与收货'));
    for (const order of purchaseOrders) {
      const lines = Array.isArray(order.lines) ? order.lines.map(recordValue) : [];
      const total = lines.reduce(
        (sum, line) =>
          sum + Number(line.quantity ?? 0) * Number(line.unit_price ?? line.unitPrice ?? 0),
        0,
      );
      const orderCard = el(
        'div',
        'procurement-card purchase-order-card',
        `${recordText(order, 'poNumber', 'po_number')} · ${businessStateLabel(recordText(order, 'status', 'status'))}\n${recordText(order, 'supplierName', 'supplierName')} · 人民币 ${decimalValue(total)} · ${String(lines.length)} 项`,
      );
      const documents = (controller.views.get('/api/v1/contract-documents') ?? []).filter(
        (item) => recordText(item, 'subjectId', 'subject_id') === recordText(order, 'id', 'id'),
      );
      for (const item of documents) {
        const itemState = recordText(item, 'state', 'state');
        const documentRow = el(
          'div',
          'contract-document-row',
          `${recordText(item, 'attachmentName', 'attachment_name', '采购合同')} · ${businessStateLabel(itemState)}`,
        );
        if (itemState === 'UPLOADED' && permissions.has('contract-ocr:operate')) {
          const recognize = el('button', 'secondary compact', '提交识别结果');
          recognize.addEventListener('click', () => {
            openForm(
              workspace,
              '采购合同 OCR 识别结果',
              '识别内容完成复核后才能发起签署。',
              [
                { name: 'provider', label: 'OCR 服务', required: true, value: '企业OCR适配器' },
                { name: 'text', label: '识别全文', type: 'textarea', required: true },
                { name: 'contractNumber', label: '合同编号' },
                { name: 'supplier', label: '供应商' },
                { name: 'amount', label: '含税金额' },
                { name: 'confidence', label: '置信度（0-1）', required: true, value: '0.90' },
              ],
              '保存识别结果',
              async (values) => {
                await controller.submit(
                  `/api/v1/contract-documents/${recordText(item, 'id', 'id')}/ocr`,
                  {
                    provider: values.provider ?? '',
                    text: values.text ?? '',
                    fields: {
                      contractNumber: values.contractNumber ?? '',
                      supplier: values.supplier ?? '',
                      amount: values.amount ?? '',
                    },
                    confidence: Number(values.confidence ?? 0),
                  },
                );
                await refresh();
              },
            );
          });
          documentRow.append(recognize);
        }
        if (itemState === 'OCR_REVIEW' && permissions.has('contract-ocr:review')) {
          const review = el('button', 'primary compact', '复核并确认');
          review.addEventListener('click', () => {
            openForm(
              workspace,
              '复核采购合同',
              '请对照原件校正全文与关键字段。',
              [
                {
                  name: 'text',
                  label: '合同全文',
                  type: 'textarea',
                  required: true,
                  value: recordText(item, 'ocrText', 'ocr_text'),
                },
                {
                  name: 'contractNumber',
                  label: '合同编号',
                  value: textValue(recordValue(item.extractedFields).contractNumber, ''),
                },
                {
                  name: 'supplier',
                  label: '供应商',
                  value: textValue(recordValue(item.extractedFields).supplier, ''),
                },
                {
                  name: 'amount',
                  label: '含税金额',
                  value: textValue(recordValue(item.extractedFields).amount, ''),
                },
              ],
              '确认可送签',
              async (values) => {
                await controller.submit(
                  `/api/v1/contract-documents/${recordText(item, 'id', 'id')}/ocr-review`,
                  {
                    provider: recordText(item, 'ocrProvider', 'ocr_provider', '人工复核'),
                    text: values.text ?? '',
                    fields: {
                      contractNumber: values.contractNumber ?? '',
                      supplier: values.supplier ?? '',
                      amount: values.amount ?? '',
                    },
                    confidence: Number(item.ocrConfidence ?? item.ocr_confidence ?? 1),
                  },
                );
                await refresh();
              },
            );
          });
          documentRow.append(review);
        }
        if (itemState === 'READY_TO_SIGN' && permissions.has('contract-signature:send')) {
          const sign = el('button', 'primary compact', '发起电子签署');
          sign.addEventListener('click', () => {
            openForm(
              workspace,
              '发起采购合同电子签署',
              '录入签署平台任务信息并按顺序通知签署人。',
              [
                { name: 'provider', label: '电子签服务', required: true },
                { name: 'providerEnvelopeId', label: '签署任务编号', required: true },
                { name: 'signerName', label: '供应商签署人', required: true },
                { name: 'signerContact', label: '手机号或邮箱', required: true },
              ],
              '确认发起',
              async (values) => {
                await controller.submit(
                  `/api/v1/contract-documents/${recordText(item, 'id', 'id')}/signature-envelopes`,
                  {
                    provider: values.provider ?? '',
                    providerEnvelopeId: values.providerEnvelopeId ?? '',
                    signingOrder: 'SEQUENTIAL',
                    expiresAt: null,
                    signers: [
                      {
                        sequence: 1,
                        role: '供应商签署人',
                        name: values.signerName ?? '',
                        contact: values.signerContact ?? '',
                      },
                    ],
                  },
                );
                await refresh();
              },
            );
          });
          documentRow.append(sign);
        }
        orderCard.append(documentRow);
      }
      if (permissions.has('contract-document:manage') && controller.api.uploadContractDocument) {
        const upload = el('button', 'secondary compact', '上传采购合同');
        upload.addEventListener('click', () => {
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = '.pdf,.doc,.docx,.png,.jpg,.jpeg';
          input.addEventListener('change', () => {
            const file = input.files?.[0];
            if (!file) return;
            void controller.api
              .uploadContractDocument?.(
                'PURCHASE',
                'purchase-order',
                recordText(order, 'id', 'id'),
                file,
              )
              .then(refresh);
          });
          input.click();
        });
        orderCard.append(upload);
      }
      orderPanel.append(orderCard);
    }
    for (const receipt of receipts)
      orderPanel.append(
        el(
          'div',
          'procurement-card receipt-card',
          `收货 ${recordText(receipt, 'receiptNumber', 'receipt_number')} · ${recordText(receipt, 'poNumber', 'poNumber')} · ${String(Array.isArray(receipt.lines) ? receipt.lines.length : 0)} 批`,
        ),
      );
    if (permissions.has('procurement:manage')) {
      const supplierOptions = suppliers.map((item) => ({
        value: String(item.id),
        label: `${recordText(item, 'supplierNumber', 'supplier_number')} · ${recordText(item, 'name', 'name')}`,
      }));
      const itemOptions = manufacturingItems
        .filter((item) => recordText(item, 'status', 'status') === 'PUBLISHED')
        .map((item) => ({
          value: String(item.id),
          label: `${recordText(item, 'sku', 'sku')} · ${recordText(item, 'name', 'name')}`,
        }));
      const createOrder = el('button', 'primary', '＋ 创建并签发采购订单');
      createOrder.addEventListener('click', () => {
        openForm(
          workspace,
          '创建采购订单',
          '订单只允许选择已准入供应商和已发布物料版本。',
          [
            { name: 'poNumber', label: '采购订单号', required: true },
            {
              name: 'supplierId',
              label: '供应商',
              type: 'select',
              required: true,
              options: supplierOptions,
            },
            {
              name: 'itemVersionId',
              label: '物料',
              type: 'select',
              required: true,
              options: itemOptions,
            },
            { name: 'quantity', label: '数量', type: 'number', required: true },
            { name: 'unitPrice', label: '含税单价', type: 'number', required: true },
            { name: 'requiredAt', label: '要求到货日', type: 'date', required: true },
          ],
          '签发采购订单',
          async (values) => {
            await controller.submit('/api/v1/purchase-orders', {
              poNumber: values.poNumber,
              supplierId: values.supplierId,
              supplierQuoteId: null,
              currency: 'CNY',
              issue: true,
              lines: [
                {
                  itemVersionId: values.itemVersionId,
                  quantity: values.quantity,
                  unitPrice: values.unitPrice,
                  requiredAt: values.requiredAt,
                },
              ],
            });
            await refresh();
          },
        );
      });
      orderPanel.append(createOrder);
      const openOrderLineOptions = purchaseOrders.flatMap((order) =>
        ['ISSUED', 'PARTIALLY_RECEIVED'].includes(recordText(order, 'status', 'status'))
          ? (Array.isArray(order.lines) ? order.lines.map(recordValue) : []).map((line) => ({
              value: `${String(order.id)}|${String(line.id)}`,
              label: `${recordText(order, 'poNumber', 'po_number')} · ${recordText(line, 'sku', 'sku')} · 未收 ${decimalValue(Number(line.quantity ?? 0) - Number(line.receivedQuantity ?? 0))}`,
            }))
          : [],
      );
      if (openOrderLineOptions.length && locations.length) {
        const receiveGoods = el('button', 'secondary', '＋ 登记批次收货');
        receiveGoods.addEventListener('click', () => {
          openForm(
            workspace,
            '登记采购收货',
            '收货将同时建立批次、收货证据和不可变 RECEIPT 库存移动。',
            [
              {
                name: 'orderLine',
                label: '采购订单行',
                type: 'select',
                required: true,
                options: openOrderLineOptions,
              },
              { name: 'receiptNumber', label: '收货单号', required: true },
              { name: 'sourceReference', label: '送货单号', required: true },
              { name: 'lotNumber', label: '供应批次号', required: true },
              {
                name: 'locationCode',
                label: '入库库位',
                type: 'select',
                required: true,
                options: locations.map((item) => ({
                  ...inventoryLocationOption(item),
                  value: recordText(item, 'code', 'code'),
                })),
              },
              { name: 'quantity', label: '实收数量', type: 'number', required: true },
              { name: 'manufacturedAt', label: '生产日期', type: 'date', required: true },
            ],
            '过账收货',
            async (values) => {
              const [purchaseOrderId, purchaseOrderLineId] = (values.orderLine ?? '').split('|');
              await controller.submit('/api/v1/goods-receipts', {
                receiptNumber: values.receiptNumber,
                purchaseOrderId,
                receivedAt: new Date().toISOString(),
                sourceReference: values.sourceReference,
                lines: [
                  {
                    purchaseOrderLineId,
                    lotNumber: values.lotNumber,
                    locationCode: values.locationCode,
                    quantity: values.quantity,
                    manufacturedAt: values.manufacturedAt,
                    expiresAt: null,
                  },
                ],
              });
              await refresh();
            },
          );
        });
        orderPanel.append(receiveGoods);
      }
    }
    const inventoryPanel = el('article', 'procurement-column inventory-register');
    inventoryPanel.append(el('h3', '', '批次库存台账'));
    for (const balance of balances) {
      const movements = Array.isArray(balance.movements) ? balance.movements : [];
      const balanceCard = el(
        'div',
        'procurement-card inventory-balance-card',
        `${recordText(balance, 'sku', 'sku')} · 批次 ${recordText(balance, 'lotNumber', 'lotNumber')}\n${recordText(balance, 'locationCode', 'locationCode')} · 结存 ${recordText(balance, 'quantity', 'quantity')} · ${businessStateLabel(recordText(balance, 'qualityStatus', 'qualityStatus'))} · ${String(movements.length)} 笔移动`,
      );
      if (permissions.has('inventory:move')) {
        const move = el('button', 'secondary', '领用 / 调整');
        move.addEventListener('click', () => {
          openForm(
            workspace,
            '登记库存移动',
            '移动记录不可修改；出库数量不得造成该批次库位负库存。',
            [
              {
                name: 'movementType',
                label: '移动类型',
                type: 'select',
                required: true,
                options: [
                  { value: 'ISSUE', label: '生产领用' },
                  { value: 'RETURN', label: '退料入库' },
                  { value: 'ADJUSTMENT_IN', label: '盘盈' },
                  { value: 'ADJUSTMENT_OUT', label: '盘亏' },
                ],
              },
              { name: 'quantity', label: '数量', type: 'number', required: true },
              { name: 'sourceType', label: '业务来源类型', required: true, value: 'WORK-ORDER' },
              { name: 'sourceId', label: '业务来源编号', required: true },
            ],
            '追加库存移动',
            async (values) => {
              await controller.submit('/api/v1/inventory-movements', {
                movementType: values.movementType,
                itemVersionId: balance.itemVersionId,
                lotId: balance.lotId,
                locationId: balance.locationId,
                quantity: values.quantity,
                occurredAt: new Date().toISOString(),
                sourceType: values.sourceType,
                sourceId: values.sourceId,
              });
              await refresh();
            },
          );
        });
        balanceCard.append(move);
      }
      inventoryPanel.append(balanceCard);
    }
    if (permissions.has('inventory:move') && !locations.length) {
      const createLocation = el('button', 'secondary', '＋ 建立首个库位');
      createLocation.addEventListener('click', () => {
        openForm(
          workspace,
          '建立库存库位',
          '库位用于批次收货和不可变库存移动。',
          [
            { name: 'code', label: '库位编码', required: true },
            { name: 'name', label: '库位名称', required: true },
            {
              name: 'locationType',
              label: '库位类型',
              type: 'select',
              required: true,
              options: [
                { value: 'RECEIVING', label: '收货区' },
                { value: 'STORAGE', label: '存储区' },
                { value: 'PRODUCTION', label: '生产区' },
                { value: 'QUARANTINE', label: '隔离区' },
                { value: 'SHIPPING', label: '发货区' },
              ],
            },
          ],
          '保存库位',
          async (values) => {
            await controller.submit('/api/v1/inventory-locations', values);
            await refresh();
          },
        );
      });
      inventoryPanel.append(createLocation);
    }
    grid.append(supplierPanel, sourcingPanel, orderPanel, inventoryPanel);
    panel.append(grid);
    workspace.append(panel);
  }
  if (controller && (permissions.has('mrp:read') || permissions.has('mrp-policy:read'))) {
    const panel = el('section', 'mrp-workbench');
    panel.setAttribute('data-testid', 'mrp-workbench');
    panel.append(
      el('p', 'eyebrow', '物料需求计划'),
      el('h2', '', '物料需求与建议审批'),
      el('p', 'commercial-help', '物料需求、库存抵扣与供需建议'),
    );
    const policies = controller.views.get('/api/v1/mrp-policies') ?? [],
      demands = controller.views.get('/api/v1/mrp-demands') ?? [],
      runs = controller.views.get('/api/v1/mrp-runs') ?? [],
      items = controller.views.get('/api/v1/manufacturing-items') ?? [],
      latestRun = runs[0];
    const heading = el('div', 'mrp-summary');
    heading.append(
      el('div', 'metric-card', `计划政策\n${String(policies.length)} 项`),
      el('div', 'metric-card', `需求信号\n${String(demands.length)} 项`),
      el('div', 'metric-card', `计算批次\n${String(runs.length)} 次`),
      el(
        'div',
        'metric-card',
        `当前建议\n${String(Array.isArray(latestRun?.proposals) ? latestRun.proposals.length : 0)} 项`,
      ),
    );
    panel.append(heading);
    const actions = el('div', 'mrp-actions');
    const publishedItemOptions = items
      .filter((item) => recordText(item, 'status', 'status') === 'PUBLISHED')
      .map((item) => ({
        value: String(item.id),
        label: `${recordText(item, 'sku', 'sku')} · ${recordText(item, 'name', 'name')}`,
      }));
    const refresh = async () => {
      await controller.load();
      status.textContent = controller.message;
    };
    if (permissions.has('mrp-policy:manage')) {
      const policy = el('button', 'secondary', '＋ 计划政策');
      policy.addEventListener('click', () => {
        openForm(
          workspace,
          '新建物料计划政策',
          '政策按生效时间追加，固定安全库存、批量、交期和制造/采购方式。',
          [
            {
              name: 'itemVersionId',
              label: '物料版本',
              type: 'select',
              required: true,
              options: publishedItemOptions,
            },
            {
              name: 'makeOrBuy',
              label: '供应方式',
              type: 'select',
              required: true,
              options: [
                { value: 'MAKE', label: '自制' },
                { value: 'BUY', label: '采购' },
              ],
            },
            { name: 'safetyStock', label: '安全库存', type: 'number', required: true, value: '0' },
            {
              name: 'minimumOrderQuantity',
              label: '最小批量',
              type: 'number',
              required: true,
              value: '0',
            },
            {
              name: 'orderMultiple',
              label: '批量倍数',
              type: 'number',
              required: true,
              value: '1',
            },
            {
              name: 'leadTimeDays',
              label: '提前期（天）',
              type: 'number',
              required: true,
              value: '0',
            },
            {
              name: 'freezeWindowDays',
              label: '冻结窗口（天）',
              type: 'number',
              required: true,
              value: '0',
            },
            { name: 'effectiveAt', label: '生效日期', type: 'date', required: true },
          ],
          '保存政策',
          async (values) => {
            await controller.submit('/api/v1/mrp-policies', {
              itemVersionId: values.itemVersionId,
              makeOrBuy: values.makeOrBuy,
              safetyStock: values.safetyStock,
              minimumOrderQuantity: values.minimumOrderQuantity,
              orderMultiple: values.orderMultiple,
              leadTimeDays: Number(values.leadTimeDays),
              freezeWindowDays: Number(values.freezeWindowDays),
              effectiveAt: `${values.effectiveAt ?? ''}T00:00:00.000Z`,
            });
            await refresh();
          },
        );
      });
      actions.append(policy);
    }
    if (permissions.has('mrp:run')) {
      const demand = el('button', 'secondary', '＋ 需求信号');
      demand.addEventListener('click', () => {
        openForm(
          workspace,
          '登记独立需求',
          '需求必须引用已发布物料和业务来源，运行时生成不可变快照。',
          [
            {
              name: 'itemVersionId',
              label: '需求物料',
              type: 'select',
              required: true,
              options: publishedItemOptions,
            },
            { name: 'sourceType', label: '来源类型', required: true, value: 'SALES-FORECAST' },
            { name: 'sourceId', label: '来源业务编号', required: true },
            { name: 'requiredAt', label: '需求日期', type: 'date', required: true },
            { name: 'quantity', label: '需求数量', type: 'number', required: true },
            { name: 'priority', label: '优先级', type: 'number', required: true, value: '100' },
          ],
          '保存需求',
          async (values) => {
            await controller.submit('/api/v1/mrp-demands', {
              itemVersionId: values.itemVersionId,
              sourceType: values.sourceType,
              sourceId: values.sourceId,
              requiredAt: values.requiredAt,
              quantity: values.quantity,
              priority: Number(values.priority),
            });
            await refresh();
          },
        );
      });
      const run = el('button', 'primary', '运行物料需求计算');
      run.addEventListener('click', () => {
        openForm(
          workspace,
          '运行物料需求计算',
          '运行将固定需求、BOM、政策、合格库存和在途采购快照，并生成可解释建议。',
          [
            { name: 'runNumber', label: '运行编号', required: true },
            { name: 'asOf', label: '计划基准日', type: 'date', required: true },
            { name: 'horizonEnd', label: '计划截止日', type: 'date', required: true },
          ],
          '开始计算',
          async (values) => {
            await controller.submit('/api/v1/mrp-runs', {
              runNumber: values.runNumber,
              asOf: `${values.asOf ?? ''}T00:00:00.000Z`,
              horizonEnd: values.horizonEnd,
            });
            await refresh();
          },
        );
      });
      actions.append(demand, run);
    }
    panel.append(actions);
    const policyGrid = el('div', 'mrp-policy-grid');
    for (const policy of policies)
      policyGrid.append(
        el(
          'article',
          'mrp-policy-card',
          `${recordText(policy, 'sku', 'sku')} · ${supplyModeLabel(recordText(policy, 'makeOrBuy', 'make_or_buy'))}\n安全库存 ${recordText(policy, 'safetyStock', 'safety_stock')} · 最小批量 ${recordText(policy, 'minimumOrderQuantity', 'minimum_order_quantity')} · 批量倍数 ${recordText(policy, 'orderMultiple', 'order_multiple')} · 提前期 ${recordText(policy, 'leadTimeDays', 'lead_time_days')} 天`,
        ),
      );
    panel.append(policyGrid);
    if (latestRun) {
      const runPanel = el('article', 'mrp-run-card');
      runPanel.append(
        el(
          'h3',
          '',
          `${recordText(latestRun, 'runNumber', 'run_number')} · ${businessStateLabel(recordText(latestRun, 'status', 'status'))}`,
        ),
        el(
          'p',
          'muted',
          `基准 ${recordText(latestRun, 'asOf', 'as_of').slice(0, 10)} · 冻结至 ${recordText(latestRun, 'freezeUntil', 'freeze_until')} · 输入哈希 ${recordText(latestRun, 'inputHash', 'input_hash').slice(0, 16)}…`,
        ),
      );
      const proposals = Array.isArray(latestRun.proposals)
        ? latestRun.proposals.map(recordValue)
        : [];
      const proposalPriority: Readonly<Record<string, number>> = {
        PROPOSED: 0,
        APPROVED: 1,
        RELEASED: 2,
        REJECTED: 3,
      };
      const proposalGrid = el('div', 'mrp-proposal-grid');
      for (const proposal of [...proposals].sort((left, right) => {
        const leftState = recordText(left, 'effectiveState', 'effectiveState');
        const rightState = recordText(right, 'effectiveState', 'effectiveState');
        return (proposalPriority[leftState] ?? 9) - (proposalPriority[rightState] ?? 9);
      })) {
        const explanation = recordValue(proposal.explanation),
          state = recordText(proposal, 'effectiveState', 'effectiveState'),
          card = el('article', `mrp-proposal-card ${proposal.frozen === true ? 'frozen' : ''}`);
        card.append(
          el(
            'strong',
            '',
            `${recordText(proposal, 'sku', 'sku')} · ${supplyModeLabel(recordText(proposal, 'proposalType', 'proposal_type'))}`,
          ),
          el('span', `ctr-state state-${state.toLowerCase()}`, businessStateLabel(state)),
          el(
            'p',
            '',
            `建议 ${recordText(proposal, 'quantity', 'quantity')} · ${recordText(proposal, 'startAt', 'start_at')} → ${recordText(proposal, 'dueAt', 'due_at')}`,
          ),
          el(
            'p',
            'mrp-formula',
            `毛需求 ${recordText(explanation, 'grossDemand', 'grossDemand')} + 安全库存 ${recordText(explanation, 'safetyStock', 'safetyStock')} − 可用库存 ${recordText(explanation, 'onHand', 'onHand')} − 在途 ${recordText(explanation, 'scheduledReceipts', 'scheduledReceipts')} = 净需求 ${recordText(explanation, 'netRequirement', 'netRequirement')}；按批量取整为 ${recordText(explanation, 'plannedQuantity', 'plannedQuantity')}`,
          ),
          el('p', 'next-action-note', `下一步：${operationsNextAction('mrp', state)}`),
        );
        if (proposal.frozen === true)
          card.append(el('p', 'warning-note', '冻结窗口内：批准必须提供覆盖审批证据'));
        if (permissions.has('mrp:approve') && state === 'PROPOSED') {
          for (const [action, label] of [
            ['approve', '批准'],
            ['reject', '拒绝'],
          ] as const) {
            const command = el('button', action === 'approve' ? 'primary' : 'secondary', label);
            command.addEventListener('click', () => {
              openForm(
                workspace,
                `${label}物料需求建议`,
                '决定将追加到不可变事件台账。冻结建议必须提供覆盖审批编号。',
                [
                  { name: 'reason', label: '决定理由', type: 'textarea', required: true },
                  { name: 'approval', label: '审批证据编号', required: true },
                  ...(proposal.frozen === true
                    ? [
                        {
                          name: 'freezeOverrideApproval',
                          label: '冻结覆盖审批编号',
                          required: true,
                        },
                      ]
                    : []),
                ],
                `确认${label}`,
                async (values) => {
                  await controller.submit(
                    `/api/v1/mrp-proposals/${String(proposal.id)}/${action}`,
                    {
                      reason: values.reason,
                      evidence: {
                        approval: values.approval,
                        ...(values.freezeOverrideApproval
                          ? { freezeOverrideApproval: values.freezeOverrideApproval }
                          : {}),
                      },
                    },
                  );
                  await refresh();
                },
              );
            });
            card.append(command);
          }
        }
        if (permissions.has('mrp:release') && state === 'APPROVED') {
          const release = el('button', 'primary', '释放到执行');
          release.addEventListener('click', () => {
            openForm(
              workspace,
              '释放物料需求建议',
              '释放后将进入采购或生产执行，请核对数量、日期和供应方式。',
              [
                { name: 'reason', label: '释放理由', type: 'textarea', required: true },
                { name: 'evidenceReference', label: '计划凭证编号', required: true },
              ],
              '确认释放',
              async (values) => {
                await controller.submit(`/api/v1/mrp-proposals/${String(proposal.id)}/release`, {
                  reason: values.reason,
                  evidence: { reference: values.evidenceReference },
                });
                await refresh();
              },
            );
          });
          card.append(release);
        }
        proposalGrid.append(card);
      }
      runPanel.append(proposalGrid);
      panel.append(runPanel);
    }
    workspace.append(panel);
  }
  if (
    controller &&
    (permissions.has('quality-plan:read') ||
      permissions.has('quality:read') ||
      permissions.has('traceability:read') ||
      permissions.has('complaint:read'))
  ) {
    const panel = el('section', 'quality-workbench');
    panel.setAttribute('data-testid', 'quality-workbench');
    panel.append(
      el('p', 'eyebrow', '质量与仓储'),
      el('h2', '', '质量检验与批次追溯'),
      el('p', 'commercial-help', '检验计划、质量处置与批次放行'),
    );
    const plans = controller.views.get('/api/v1/quality-plans') ?? [];
    const inspections = controller.views.get('/api/v1/quality-inspections') ?? [];
    const lots = controller.views.get('/api/v1/lot-traceability') ?? [];
    const refresh = async () => {
      await controller.load();
      status.textContent = controller.message;
    };
    const qualitySummary = el('div', 'production-summary');
    qualitySummary.append(
      el(
        'div',
        'metric-card',
        `待抽样\n${String(inspections.filter((item) => recordText(item, 'state', 'state') === 'OPEN').length)} 单`,
      ),
      el(
        'div',
        'metric-card',
        `检验进行中\n${String(inspections.filter((item) => recordText(item, 'state', 'state') === 'SAMPLED').length)} 单`,
      ),
      el(
        'div',
        'metric-card',
        `待质量处置\n${String(inspections.filter((item) => recordText(item, 'state', 'state') === 'COMPLETED').length)} 单`,
      ),
      el(
        'div',
        'metric-card',
        `隔离批次\n${String(lots.filter((item) => recordText(item, 'qualityStatus', 'qualityStatus') === 'QUARANTINE').length)} 批`,
      ),
    );
    panel.append(qualitySummary);
    if (permissions.has('complaint:read')) {
      const complaints = controller.views.get('/api/v1/complaints') ?? [];
      const slaPolicies = controller.views.get('/api/v1/complaint-sla-policies') ?? [];
      const complaintPanel = el('article', 'quality-section complaint-ledger');
      const complaintHead = el('div', 'panel-head');
      complaintHead.append(el('h3', '', '客户投诉与整改闭环'));
      const selected = new Map<string, Record<string, unknown>>();
      if (
        permissions.has('complaint:create') &&
        slaPolicies.length &&
        controller.customers.length
      ) {
        const createComplaint = el('button', 'primary', '＋ 登记投诉');
        createComplaint.addEventListener('click', () => {
          openForm(
            workspace,
            '登记客户投诉',
            '选择已发布的服务时限策略后，系统自动计算响应、遏制、根因和关闭期限。',
            [
              { name: 'complaintNumber', label: '投诉单号', required: true },
              {
                name: 'customerId',
                label: '客户',
                type: 'select',
                required: true,
                options: controller.customers.map((customer) => ({
                  value: customer.id,
                  label: customer.name ?? customer.customerNumber ?? '未命名客户',
                })),
              },
              {
                name: 'slaPolicyVersionId',
                label: '投诉等级与处理时限',
                type: 'select',
                required: true,
                options: slaPolicies.map((policy) => ({
                  value: String(policy.id),
                  label: `${COMPLAINT_SEVERITY_LABELS[recordText(policy, 'severity', 'severity')] ?? '未分级'} · ${recordText(policy, 'policyCode', 'policy_code')} 第 ${recordText(policy, 'version', 'version')} 版`,
                })),
              },
              {
                name: 'channel',
                label: '受理渠道',
                type: 'select',
                required: true,
                options: [
                  { value: 'CUSTOMER_SERVICE', label: '客户服务' },
                  { value: 'SALES', label: '销售反馈' },
                  { value: 'EMAIL', label: '电子邮件' },
                  { value: 'PHONE', label: '电话' },
                  { value: 'ONSITE', label: '现场' },
                  { value: 'OTHER', label: '其他' },
                ],
              },
              { name: 'defectCategory', label: '问题分类', required: true, value: 'OTHER' },
              { name: 'occurredAt', label: '问题发生时间', type: 'datetime-local', required: true },
              { name: 'reportedAt', label: '客户反馈时间', type: 'datetime-local', required: true },
              { name: 'description', label: '问题描述', type: 'textarea', required: true },
              { name: 'customerRequest', label: '客户诉求', type: 'textarea', required: true },
              { name: 'customerReference', label: '客户凭证编号', required: true },
            ],
            '确认登记',
            async (values) => {
              const policy = slaPolicies.find(
                (item) => String(item.id) === values.slaPolicyVersionId,
              );
              if (!policy) throw new Error('所选投诉处理时限策略不可用');
              await controller.submit('/api/v1/complaints', {
                complaintNumber: values.complaintNumber,
                customerId: values.customerId,
                slaPolicyVersionId: values.slaPolicyVersionId,
                channel: values.channel,
                defectCategory: values.defectCategory,
                severity: recordText(policy, 'severity', 'severity'),
                occurredAt: new Date(values.occurredAt ?? '').toISOString(),
                reportedAt: new Date(values.reportedAt ?? '').toISOString(),
                description: values.description,
                customerRequest: values.customerRequest,
                initialSnapshot: { customerReference: values.customerReference },
                idempotencyKey: requestId(),
              });
              await refresh();
            },
          );
        });
        complaintHead.append(createComplaint);
      }
      if (permissions.has('complaint-sla:manage')) {
        const publishPolicy = el('button', 'secondary', '发布处理时限');
        publishPolicy.addEventListener('click', () => {
          openForm(
            workspace,
            '发布投诉处理时限',
            '时限按投诉等级独立发布；新版不会修改历史投诉使用的策略。',
            [
              { name: 'policyCode', label: '策略编码', required: true },
              { name: 'version', label: '版本', type: 'number', required: true, value: '1' },
              {
                name: 'severity',
                label: '投诉等级',
                type: 'select',
                required: true,
                options: [
                  { value: 'LOW', label: '一般' },
                  { value: 'MEDIUM', label: '较重' },
                  { value: 'MAJOR', label: '重大' },
                  { value: 'CRITICAL', label: '紧急' },
                ],
              },
              { name: 'responseHours', label: '首次响应（小时）', type: 'number', required: true },
              {
                name: 'containmentHours',
                label: '遏制措施（小时）',
                type: 'number',
                required: true,
              },
              { name: 'rootCauseHours', label: '根因确认（小时）', type: 'number', required: true },
              { name: 'closureHours', label: '闭环期限（小时）', type: 'number', required: true },
              { name: 'effectiveAt', label: '生效时间', type: 'datetime-local', required: true },
            ],
            '确认发布',
            async (values) => {
              await controller.submit('/api/v1/complaint-sla-policies', {
                policyCode: values.policyCode,
                version: Number(values.version),
                severity: values.severity,
                responseHours: Number(values.responseHours),
                containmentHours: Number(values.containmentHours),
                rootCauseHours: Number(values.rootCauseHours),
                closureHours: Number(values.closureHours),
                effectiveAt: new Date(values.effectiveAt ?? '').toISOString(),
              });
              await refresh();
            },
          );
        });
        complaintHead.append(publishPolicy);
      }
      if (
        permissions.has('complaint:triage') &&
        permissions.has('complaint:assign') &&
        controller.employees.length
      ) {
        const batch = el('button', 'primary', '批量分派');
        batch.disabled = true;
        batch.addEventListener('click', () => {
          openForm(
            workspace,
            '批量分派投诉',
            `已选择 ${String(selected.size)} 条待分诊投诉。系统会逐条校验权限和版本，失败项不会影响其他记录。`,
            [
              {
                name: 'assignedTo',
                label: '调查负责人',
                type: 'select',
                required: true,
                options: controller.employees.map((employee) => ({
                  value: employee.id,
                  label: `${employee.displayName ?? '未命名员工'} · ${employee.employeeNumber ?? '无工号'}`,
                })),
              },
              { name: 'reason', label: '分派说明', type: 'textarea', required: true },
            ],
            '确认分派',
            async (values) => {
              await controller.submit('/api/v1/complaints/batch-triage', {
                batchKey: requestId(),
                items: [...selected.values()].map((item) => ({
                  id: item.id,
                  expectedVersion: item.version,
                  assignedTo: values.assignedTo,
                  reason: values.reason,
                })),
              });
              await refresh();
            },
          );
        });
        complaintHead.append(batch);
        complaintPanel.addEventListener('change', () => {
          batch.disabled = selected.size === 0;
          batch.textContent = selected.size ? `批量分派（${String(selected.size)}）` : '批量分派';
        });
      }
      complaintPanel.append(complaintHead);
      const tableWrap = el('div', 'governance-table-wrap complaint-table-wrap');
      const table = el('table', 'governance-table complaint-table');
      const head = el('thead');
      const headRow = el('tr');
      for (const label of [
        '选择',
        '投诉单号',
        '客户',
        '等级',
        '状态',
        '负责人',
        '关闭期限',
        '操作',
      ])
        headRow.append(el('th', '', label));
      head.append(headRow);
      const body = el('tbody');
      for (const complaint of complaints) {
        const row = el('tr');
        const id = recordText(complaint, 'id', 'id');
        const state = recordText(complaint, 'state', 'state');
        const selectCell = el('td');
        if (
          state === 'REPORTED' &&
          permissions.has('complaint:triage') &&
          permissions.has('complaint:assign')
        ) {
          const checkbox = document.createElement('input');
          checkbox.type = 'checkbox';
          checkbox.className = 'record-select';
          checkbox.setAttribute(
            'aria-label',
            `选择投诉 ${recordText(complaint, 'complaintNumber', 'complaint_number')}`,
          );
          checkbox.addEventListener('change', () => {
            if (checkbox.checked) selected.set(id, complaint);
            else selected.delete(id);
            complaintPanel.dispatchEvent(new Event('change'));
          });
          selectCell.append(checkbox);
        } else selectCell.textContent = '—';
        const due = recordText(complaint, 'closureDueAt', 'closure_due_at');
        const assigneeId = recordText(complaint, 'assignedTo', 'assigned_to');
        const assignee = controller.employees.find((employee) => employee.id === assigneeId);
        const actionCell = el('td');
        const command = (action: 'investigate' | 'close', label: string, description: string) => {
          const button = el('button', action === 'close' ? 'primary' : 'secondary', label);
          button.addEventListener('click', () => {
            openForm(
              workspace,
              label,
              description,
              [
                { name: 'reason', label: '处理说明', type: 'textarea', required: true },
                { name: 'evidenceReference', label: '证据编号', required: true },
              ],
              `确认${label}`,
              async (values) => {
                await controller.submit(`/api/v1/complaints/${id}/${action}`, {
                  expectedVersion: complaint.version,
                  reason: values.reason,
                  evidence: { reference: values.evidenceReference },
                  idempotencyKey: requestId(),
                });
                await refresh();
              },
            );
          });
          actionCell.append(button);
        };
        if (state === 'TRIAGED' && permissions.has('complaint:triage'))
          command('investigate', '开始调查', '确认责任人已接单，并填写启动调查的依据。');
        if (
          state === 'INVESTIGATING' &&
          permissions.has('ncr:manage') &&
          controller.employees.length
        ) {
          const openNcr = el('button', 'primary', '开立不合格报告');
          openNcr.addEventListener('click', () => {
            openForm(
              workspace,
              '开立不合格报告',
              '不合格报告将锁定当前投诉版本，并把质量调查、临时遏制和后续整改串成同一证据链。',
              [
                { name: 'ncrNumber', label: '不合格报告编号', required: true },
                { name: 'defectType', label: '缺陷类型', required: true },
                { name: 'affectedScope', label: '影响范围', type: 'textarea', required: true },
                {
                  name: 'investigatorId',
                  label: '质量调查员',
                  type: 'select',
                  required: true,
                  options: controller.employees.map((employee) => ({
                    value: employee.id,
                    label: employee.displayName ?? employee.employeeNumber ?? '未命名员工',
                  })),
                },
                {
                  name: 'quarantinedQuantity',
                  label: '隔离数量',
                  type: 'number',
                  required: true,
                  value: '0',
                },
                { name: 'temporaryContainment', label: '临时遏制措施', type: 'textarea' },
                { name: 'evidenceReference', label: '现场证据编号', required: true },
              ],
              '确认开立',
              async (values) => {
                await controller.submit(`/api/v1/complaints/${id}/ncrs`, {
                  ncrNumber: values.ncrNumber,
                  defectType: values.defectType,
                  affectedScope: values.affectedScope,
                  investigatorId: values.investigatorId,
                  quarantinedQuantity: values.quarantinedQuantity,
                  temporaryContainment: values.temporaryContainment ?? '',
                  complaintExpectedVersion: complaint.version,
                  evidence: { reference: values.evidenceReference },
                  idempotencyKey: requestId(),
                });
                await refresh();
              },
            );
          });
          actionCell.append(openNcr);
        }
        if (['NCR_OPEN', 'CAPA_ACTIVE', 'VERIFIED'].includes(state) && controller.api.get) {
          const workflow = el('button', 'primary', '处理质量闭环');
          workflow.addEventListener('click', () => {
            void (async () => {
              const detail = await controller.api.get?.(`/api/v1/complaints/${id}`);
              if (!detail) return;
              const ncr = recordValue(detail.ncr);
              const capa = recordValue(ncr.capa);
              const ncrId = recordText(ncr, 'id', 'id');
              const ncrState = recordText(ncr, 'state', 'state');
              const ncrVersion = Number(ncr.version ?? 0);
              const capaId = recordText(capa, 'id', 'id');
              const capaState = recordText(capa, 'state', 'state');
              const capaVersion = Number(capa.version ?? 0);
              const evidenceFields = [
                { name: 'reason', label: '处理说明', type: 'textarea' as const, required: true },
                { name: 'evidenceReference', label: '证据编号', required: true },
              ];
              const transitionNcr = (
                action: 'contain' | 'root-cause' | 'disposition' | 'close',
                title: string,
                extra: Parameters<typeof openForm>[3] = [],
              ) => {
                openForm(
                  workspace,
                  title,
                  '填写业务结论和可追溯证据后提交。',
                  [...extra, ...evidenceFields],
                  `确认${title}`,
                  async (values) => {
                    await controller.submit(`/api/v1/ncrs/${ncrId}/${action}`, {
                      expectedVersion: ncrVersion,
                      reason: values.reason,
                      evidence: { reference: values.evidenceReference },
                      ...(action === 'root-cause'
                        ? {
                            rootCauseMethod: values.rootCauseMethod,
                            rootCause: { conclusion: values.rootCause },
                          }
                        : {}),
                      ...(action === 'disposition' ? { disposition: values.disposition } : {}),
                      idempotencyKey: requestId(),
                    });
                    await refresh();
                  },
                );
              };
              if (ncrState === 'OPEN' && permissions.has('ncr:manage')) {
                transitionNcr('contain', '确认临时遏制');
                return;
              }
              if (ncrState === 'CONTAINED' && permissions.has('ncr:manage')) {
                transitionNcr('root-cause', '确认根本原因', [
                  {
                    name: 'rootCauseMethod',
                    label: '分析方法',
                    type: 'select',
                    required: true,
                    options: [
                      { value: 'FIVE_WHY', label: '五个为什么' },
                      { value: 'FISHBONE', label: '鱼骨图' },
                      { value: 'FAULT_TREE', label: '故障树' },
                      { value: 'OTHER', label: '其他方法' },
                    ],
                  },
                  { name: 'rootCause', label: '根本原因结论', type: 'textarea', required: true },
                ]);
                return;
              }
              if (ncrState === 'ROOT_CAUSE_CONFIRMED' && permissions.has('ncr:disposition')) {
                transitionNcr('disposition', '批准处置方案', [
                  {
                    name: 'disposition',
                    label: '处置方式',
                    type: 'select',
                    required: true,
                    options: [
                      { value: 'REWORK', label: '返工' },
                      { value: 'REPAIR', label: '修复' },
                      { value: 'CONCESSION', label: '让步接收' },
                      { value: 'RETURN', label: '退货' },
                      { value: 'SCRAP', label: '报废' },
                      { value: 'SUPPLIER_CLAIM', label: '供应商索赔' },
                    ],
                  },
                ]);
                return;
              }
              if (ncrState === 'DISPOSITIONED' && !capaId && permissions.has('capa:manage')) {
                openForm(
                  workspace,
                  '建立纠正预防措施',
                  '指定整改责任人、目标日期和根因快照。',
                  [
                    { name: 'capaNumber', label: '整改单号', required: true },
                    {
                      name: 'ownerId',
                      label: '整改责任人',
                      type: 'select',
                      required: true,
                      options: controller.employees.map((employee) => ({
                        value: employee.id,
                        label: employee.displayName ?? employee.employeeNumber ?? '未命名员工',
                      })),
                    },
                    {
                      name: 'targetAt',
                      label: '目标完成时间',
                      type: 'datetime-local',
                      required: true,
                    },
                    { name: 'rootCause', label: '根因摘要', type: 'textarea', required: true },
                    { name: 'evidenceReference', label: '处置证据编号', required: true },
                  ],
                  '确认建立',
                  async (values) => {
                    await controller.submit(`/api/v1/ncrs/${ncrId}/capas`, {
                      capaNumber: values.capaNumber,
                      ownerId: values.ownerId,
                      targetAt: values.targetAt,
                      riskLevel: recordText(complaint, 'severity', 'severity'),
                      rootCauseSnapshot: { conclusion: values.rootCause },
                      complaintExpectedVersion: complaint.version,
                      evidence: { reference: values.evidenceReference },
                      idempotencyKey: requestId(),
                    });
                    await refresh();
                  },
                );
                return;
              }
              const actions = Array.isArray(capa.actions) ? capa.actions.map(recordValue) : [];
              const incomplete = actions.find((item) => !item.completion);
              if (
                capaId &&
                ['OPEN', 'ACTIONS_IN_PROGRESS'].includes(capaState) &&
                permissions.has('capa:manage') &&
                !actions.length
              ) {
                openForm(
                  workspace,
                  '新增整改措施',
                  '措施必须有明确责任人和完成期限。',
                  [
                    {
                      name: 'actionType',
                      label: '措施类型',
                      type: 'select',
                      required: true,
                      options: [
                        { value: 'CORRECTIVE', label: '纠正措施' },
                        { value: 'PREVENTIVE', label: '预防措施' },
                      ],
                    },
                    { name: 'description', label: '措施内容', type: 'textarea', required: true },
                    {
                      name: 'ownerId',
                      label: '责任人',
                      type: 'select',
                      required: true,
                      options: controller.employees.map((employee) => ({
                        value: employee.id,
                        label: employee.displayName ?? employee.employeeNumber ?? '未命名员工',
                      })),
                    },
                    { name: 'dueAt', label: '完成期限', type: 'datetime-local', required: true },
                  ],
                  '确认新增',
                  async (values) => {
                    await controller.submit(`/api/v1/capas/${capaId}/actions`, {
                      ...values,
                      expectedVersion: capaVersion,
                      idempotencyKey: requestId(),
                    });
                    await refresh();
                  },
                );
                return;
              }
              if (incomplete && permissions.has('capa:manage')) {
                openForm(
                  workspace,
                  '完成整改措施',
                  recordText(incomplete, 'description', 'description'),
                  [{ name: 'evidenceReference', label: '完成证据编号', required: true }],
                  '确认完成',
                  async (values) => {
                    await controller.submit(
                      `/api/v1/capa-actions/${recordText(incomplete, 'id', 'id')}/complete`,
                      {
                        completedAt: new Date().toISOString(),
                        evidence: { reference: values.evidenceReference },
                        expectedCapaVersion: capaVersion,
                        idempotencyKey: requestId(),
                      },
                    );
                    await refresh();
                  },
                );
                return;
              }
              if (capaState === 'READY_FOR_VERIFICATION' && permissions.has('capa:verify')) {
                openForm(
                  workspace,
                  '验证整改效果',
                  '验证人必须独立于整改责任人。',
                  [
                    { name: 'standard', label: '验证标准', required: true },
                    { name: 'sampleScope', label: '抽样范围', required: true },
                    {
                      name: 'observationUntil',
                      label: '观察期截止',
                      type: 'datetime-local',
                      required: true,
                    },
                    {
                      name: 'result',
                      label: '验证结论',
                      type: 'select',
                      required: true,
                      options: [
                        { value: 'PASSED', label: '通过' },
                        { value: 'FAILED', label: '未通过' },
                      ],
                    },
                    { name: 'evidenceReference', label: '验证报告编号', required: true },
                  ],
                  '提交验证',
                  async (values) => {
                    await controller.submit(`/api/v1/capas/${capaId}/verify`, {
                      verifiedAt: new Date().toISOString(),
                      standard: values.standard,
                      sampleScope: values.sampleScope,
                      observationUntil: values.observationUntil,
                      result: values.result,
                      evidence: { reference: values.evidenceReference },
                      expectedVersion: capaVersion,
                      complaintExpectedVersion: complaint.version,
                      idempotencyKey: requestId(),
                    });
                    await refresh();
                  },
                );
                return;
              }
              if (capaState === 'VERIFIED' && permissions.has('capa:manage')) {
                openForm(
                  workspace,
                  '关闭整改单',
                  '整改验证通过后归档整改单。',
                  evidenceFields,
                  '确认关闭',
                  async (values) => {
                    await controller.submit(`/api/v1/capas/${capaId}/close`, {
                      expectedVersion: capaVersion,
                      reason: values.reason,
                      evidence: { reference: values.evidenceReference },
                      idempotencyKey: requestId(),
                    });
                    await refresh();
                  },
                );
                return;
              }
              if (
                capaState === 'CLOSED' &&
                ncrState === 'DISPOSITIONED' &&
                permissions.has('ncr:close')
              ) {
                transitionNcr('close', '关闭不合格报告');
                return;
              }
              if (
                ncrState === 'CLOSED' &&
                capaState === 'CLOSED' &&
                permissions.has('complaint:close')
              )
                command('close', '关闭投诉', '确认整改单和不合格报告均已归档。');
            })();
          });
          actionCell.append(workflow);
        }
        if (!actionCell.children.length) actionCell.textContent = '—';
        row.append(
          selectCell,
          el('td', '', recordText(complaint, 'complaintNumber', 'complaint_number')),
          el('td', '', recordText(complaint, 'customerName', 'customer_name')),
          el(
            'td',
            '',
            COMPLAINT_SEVERITY_LABELS[recordText(complaint, 'severity', 'severity')] ?? '未分级',
          ),
          el('td', '', COMPLAINT_STATE_LABELS[state] ?? '状态待确认'),
          el('td', '', assignee?.displayName ?? '待分派'),
          el(
            'td',
            recordText(complaint, 'overdue', 'overdue') === 'true' ? 'danger-note' : '',
            due ? new Date(due).toLocaleDateString('zh-CN') : '—',
          ),
          actionCell,
        );
        body.append(row);
      }
      table.append(head, body);
      tableWrap.append(table);
      complaintPanel.append(tableWrap);
      if (!complaints.length)
        complaintPanel.append(el('p', 'pipeline-empty', '当前没有可见的客户投诉。'));
      panel.append(complaintPanel);
    }
    const planPanel = el('article', 'quality-section quality-plans');
    planPanel.append(el('h3', '', '检验计划'));
    if (permissions.has('quality-plan:manage')) {
      const createPlan = el('button', 'primary', '＋ 创建检验计划');
      createPlan.addEventListener('click', () => {
        openForm(
          workspace,
          '创建检验计划',
          '计划版本发布后不可修改；每个特性必须有明确的数据类型和验收边界。',
          [
            { name: 'code', label: '计划编码', required: true },
            { name: 'name', label: '计划名称', required: true },
            { name: 'itemVersionId', label: '物料版本编号', required: true },
            {
              name: 'inspectionStage',
              label: '检验阶段',
              type: 'select',
              required: true,
              options: [
                { value: 'INCOMING', label: '来料' },
                { value: 'IN_PROCESS', label: '过程' },
                { value: 'FINAL', label: '终检' },
              ],
            },
            { name: 'samplingMethod', label: '抽样方式', required: true, value: '全检' },
            { name: 'acceptanceRule', label: '验收规则', required: true, value: '全部必检项通过' },
            { name: 'effectiveAt', label: '生效时间', type: 'datetime-local', required: true },
            { name: 'characteristicCode', label: '特性编码', required: true },
            { name: 'characteristicName', label: '特性名称', required: true },
            { name: 'lowerLimit', label: '下限（可选）', type: 'number' },
            { name: 'upperLimit', label: '上限（可选）', type: 'number' },
          ],
          '保存并发布计划',
          async (values) => {
            await controller.submit('/api/v1/quality-plans', {
              code: values.code,
              name: values.name,
              itemVersionId: values.itemVersionId,
              inspectionStage: values.inspectionStage,
              samplingMethod: values.samplingMethod,
              acceptanceRule: { description: values.acceptanceRule },
              effectiveAt: new Date(values.effectiveAt ?? '').toISOString(),
              characteristics: [
                {
                  code: values.characteristicCode,
                  name: values.characteristicName,
                  dataType: 'NUMERIC',
                  lowerLimit: values.lowerLimit ?? undefined,
                  upperLimit: values.upperLimit ?? undefined,
                  required: true,
                  instructions: '',
                },
              ],
              publish: true,
            });
            await refresh();
          },
        );
      });
      planPanel.append(createPlan);
    }
    for (const plan of plans) {
      const row = el('article', 'quality-plan-card');
      const characteristics = Array.isArray(plan.characteristics)
        ? plan.characteristics.map(recordValue)
        : [];
      row.append(
        el(
          'strong',
          '',
          `${recordText(plan, 'code', 'code')} · ${recordText(plan, 'name', 'name')}`,
        ),
        el(
          'span',
          `ctr-state state-${recordText(plan, 'status', 'status', 'DRAFT').toLowerCase()}`,
          `${businessStateLabel(recordText(plan, 'status', 'status', 'DRAFT'))} · 第 ${recordText(plan, 'version', 'version', '1')} 版`,
        ),
        el(
          'p',
          'muted',
          `${qualityStageLabel(recordText(plan, 'inspectionStage', 'inspection_stage'))} · ${characteristics.map((item) => recordText(item, 'name', 'name')).join('、') || '暂无特性'}`,
        ),
      );
      if (
        permissions.has('quality-plan:manage') &&
        recordText(plan, 'status', 'status') === 'DRAFT' &&
        typeof plan.id === 'string'
      ) {
        const publish = el('button', 'secondary', '发布计划');
        publish.addEventListener('click', () => {
          openForm(
            workspace,
            '发布检验计划',
            '发布后计划版本不可修改，请确认检验阶段、特性和验收边界。',
            [{ name: 'confirmation', label: '发布确认说明', type: 'textarea', required: true }],
            '确认发布',
            async () => {
              await controller.submit(`/api/v1/quality-plans/${plan.id as string}/publish`, {});
              await refresh();
            },
          );
        });
        row.append(publish);
      }
      planPanel.append(row);
    }
    if (!plans.length) planPanel.append(el('p', 'pipeline-empty', '暂无检验计划。'));
    panel.append(planPanel);

    const inspectionPanel = el('article', 'quality-section quality-inspections');
    const inspectionHeading = el('div', 'panel-head');
    inspectionHeading.append(el('h3', '', '检验队列'));
    if (permissions.has('quality:inspect')) {
      const open = el('button', 'primary', '＋ 开立检验');
      open.addEventListener('click', () => {
        const publishedPlans = plans.filter(
          (item) => recordText(item, 'status', 'status') === 'PUBLISHED',
        );
        openForm(
          workspace,
          '开立批次检验',
          '开立会先将批次置于隔离状态；只有完成检验并通过放行门禁后才能进入可用库存。',
          [
            {
              name: 'planVersionId',
              label: '已发布计划',
              type: 'select',
              required: true,
              options: publishedPlans.map((item) => ({
                value: String(item.id),
                label: `${recordText(item, 'code', 'code')} · ${recordText(item, 'name', 'name')}`,
              })),
            },
            {
              name: 'lotId',
              label: '待检批次',
              type: 'select',
              required: true,
              options: lots.map((item) => ({
                value: String(item.lotId ?? item.id),
                label: `${recordText(item, 'lotNumber', 'lotNumber')} · ${recordText(item, 'sku', 'sku')}`,
              })),
            },
            { name: 'inspectionNumber', label: '检验单号', required: true },
            { name: 'sourceId', label: '来源业务编号', required: true },
            { name: 'sampleSize', label: '抽样数量', type: 'number', required: true, value: '1' },
          ],
          '开立检验',
          async (values) => {
            await controller.submit('/api/v1/quality-inspections', {
              inspectionNumber: values.inspectionNumber,
              planVersionId: values.planVersionId,
              lotId: values.lotId,
              sourceType: 'PRODUCTION_ROLL',
              sourceId: values.sourceId,
              sampleSize: values.sampleSize,
            });
            await refresh();
          },
        );
      });
      inspectionHeading.append(open);
    }
    inspectionPanel.append(inspectionHeading);
    const inspectionPriority: Readonly<Record<string, number>> = {
      COMPLETED: 0,
      DISPOSITIONED: 1,
      SAMPLED: 2,
      OPEN: 3,
      RELEASED: 4,
      REJECTED: 5,
      CANCELLED: 6,
    };
    for (const inspection of [...inspections].sort(
      (left, right) =>
        (inspectionPriority[recordText(left, 'state', 'state')] ?? 9) -
        (inspectionPriority[recordText(right, 'state', 'state')] ?? 9),
    )) {
      const state = recordText(inspection, 'state', 'state', 'OPEN');
      const card = el('article', 'quality-inspection-card');
      const results = Array.isArray(inspection.results) ? inspection.results.map(recordValue) : [];
      const events = Array.isArray(inspection.events) ? inspection.events.map(recordValue) : [];
      card.append(
        el(
          'strong',
          '',
          `${recordText(inspection, 'inspectionNumber', 'inspection_number')} · ${recordText(inspection, 'lotNumber', 'lot_number')}`,
        ),
        el('span', `ctr-state state-${state.toLowerCase()}`, businessStateLabel(state)),
        el(
          'p',
          'muted',
          `${recordText(inspection, 'planCode', 'plan_code')} · ${String(results.length)} 项结果 · ${String(events.length)} 条状态证据`,
        ),
        el('p', 'next-action-note', `下一步：${operationsNextAction('quality', state)}`),
      );
      const actions = el('div', 'quality-actions');
      const command = (action: 'sample' | 'complete' | 'cancel', label: string) => {
        const button = el('button', action === 'complete' ? 'primary' : 'secondary', label);
        button.addEventListener('click', () => {
          openForm(
            workspace,
            label,
            '状态变化写入不可变检验事件；请提供操作理由和证据编号。',
            [
              { name: 'reason', label: '操作理由', type: 'textarea', required: true },
              { name: 'evidence', label: '证据编号', required: true },
              { name: 'idempotencyKey', label: '幂等键', required: true },
            ],
            `确认${label}`,
            async (values) => {
              await controller.submit(
                `/api/v1/quality-inspections/${String(inspection.id)}/${action}`,
                {
                  reason: values.reason,
                  evidence: { reference: values.evidence },
                  idempotencyKey: values.idempotencyKey,
                },
              );
              await refresh();
            },
          );
        });
        actions.append(button);
      };
      if (permissions.has('quality:inspect')) {
        if (state === 'OPEN') command('sample', '开始抽样');
        if (state === 'SAMPLED') command('complete', '完成检验');
        if (state === 'OPEN' || state === 'SAMPLED') command('cancel', '取消检验');
        if ((state === 'SAMPLED' || state === 'COMPLETED') && typeof inspection.id === 'string') {
          const result = el('button', 'secondary', '＋ 记录结果');
          result.addEventListener('click', () => {
            openForm(
              workspace,
              '记录检验结果',
              '结果按计划特性逐项保存；服务端会校验数据类型和必检项。',
              [
                { name: 'characteristicId', label: '特性编号', required: true },
                { name: 'measuredNumeric', label: '实测数值', type: 'number' },
                { name: 'passed', label: '通过（true/false）', required: true, value: 'true' },
                { name: 'notes', label: '备注', type: 'textarea' },
                { name: 'idempotencyKey', label: '幂等键', required: true },
              ],
              '保存结果',
              async (values) => {
                await controller.submit(
                  `/api/v1/quality-inspections/${inspection.id as string}/results`,
                  {
                    characteristicId: values.characteristicId,
                    measuredNumeric: values.measuredNumeric ?? undefined,
                    passed: values.passed === 'true',
                    notes: values.notes ?? '',
                    occurredAt: new Date().toISOString(),
                    idempotencyKey: values.idempotencyKey,
                  },
                );
                await refresh();
              },
            );
          });
          actions.append(result);
        }
      }
      if (
        permissions.has('quality:disposition') &&
        (state === 'COMPLETED' || state === 'SAMPLED') &&
        typeof inspection.id === 'string'
      ) {
        for (const [action, label] of [
          ['release', '放行批次'],
          ['reject', '拒收批次'],
        ] as const) {
          const button = el('button', action === 'release' ? 'primary' : 'secondary', label);
          button.addEventListener('click', () => {
            openForm(
              workspace,
              label,
              '批次处置会同步更新质量状态和库存可用性，并追加追溯证据。',
              [
                { name: 'reason', label: '处置理由', type: 'textarea', required: true },
                { name: 'evidence', label: '证据编号', required: true },
                { name: 'idempotencyKey', label: '幂等键', required: true },
              ],
              `确认${label}`,
              async (values) => {
                await controller.submit(
                  `/api/v1/quality-inspections/${inspection.id as string}/${action}`,
                  {
                    reason: values.reason,
                    evidence: { reference: values.evidence },
                    idempotencyKey: values.idempotencyKey,
                  },
                );
                await refresh();
              },
            );
          });
          actions.append(button);
        }
      }
      if (actions.children.length) card.append(actions);
      inspectionPanel.append(card);
    }
    if (!inspections.length) inspectionPanel.append(el('p', 'pipeline-empty', '暂无检验单。'));
    panel.append(inspectionPanel);

    if (permissions.has('traceability:read')) {
      const traceability = el('article', 'quality-section traceability-section');
      traceability.append(el('h3', '', '批次追溯与库存状态'));
      for (const lot of lots) {
        const used = Array.isArray(lot.usedByOrders) ? lot.usedByOrders.length : 0;
        const produced = Array.isArray(lot.producedRolls) ? lot.producedRolls.length : 0;
        traceability.append(
          el(
            'article',
            'traceability-card',
            `${recordText(lot, 'lotNumber', 'lotNumber')} · ${recordText(lot, 'sku', 'sku')} · ${businessStateLabel(recordText(lot, 'qualityStatus', 'qualityStatus'))}\n使用工单 ${String(used)} · 成品卷 ${String(produced)} · 移动 ${String(Array.isArray(lot.movements) ? lot.movements.length : 0)} 笔`,
          ),
        );
      }
      if (!lots.length) traceability.append(el('p', 'pipeline-empty', '暂无批次追溯记录。'));
      panel.append(traceability);
    }
    workspace.append(panel);
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

export const createFetchCommercialApi = (token: string): CommercialApi => ({
  async listOpportunities() {
    const response = await json<{
      items: readonly Opportunity[];
    }>('/api/v1/opportunities', token);
    return response.items;
  },
  async list(path) {
    if (
      path !== '/api/v1/ar-open-items' &&
      path !== '/api/v1/bank-payments' &&
      path !== '/api/v1/complaints'
    )
      return (await json<{ items: readonly Record<string, unknown>[] }>(path, token)).items;
    const items: Record<string, unknown>[] = [];
    let cursor: string | null = null;
    const visitedCursors = new Set<string>();
    do {
      const query = new URLSearchParams({ limit: '100' });
      if (cursor) query.set('cursor', cursor);
      const page = await json<{
        items: readonly Record<string, unknown>[];
        nextCursor: string | null;
      }>(`${path}?${query.toString()}`, token);
      items.push(...page.items);
      if (page.nextCursor && visitedCursors.has(page.nextCursor))
        throw new Error('服务器返回了重复分页游标，已停止加载以避免重复数据');
      cursor = page.nextCursor;
      if (cursor) visitedCursors.add(cursor);
    } while (cursor);
    return items;
  },
  async listCostMatrixSummaries(query) {
    const parameters = new URLSearchParams({
      page: String(query.page),
      pageSize: String(query.pageSize),
      attention: query.attention,
      sort: query.sort,
    });
    if (query.query) parameters.set('q', query.query);
    if (query.productFamily) parameters.set('productFamily', query.productFamily);
    return json<CostMatrixPage>(`/api/v1/cost-matrix-summaries?${parameters.toString()}`, token);
  },
  get: (path) => json<Record<string, unknown>>(path, token),
  submit: (path, payload, method = 'POST') =>
    json<Record<string, unknown>>(path, token, {
      method,
      ...(method === 'POST' ? { headers: { 'idempotency-key': requestId() } } : {}),
      body: JSON.stringify(payload),
    }),
  async uploadCtrAttachment(versionId, file) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
    const hex = [...digest].map((value) => value.toString(16).padStart(2, '0')).join('');
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    const metadata = await json<Record<string, unknown>>('/api/v1/attachments', token, {
      method: 'POST',
      body: JSON.stringify({
        name: file.name,
        mimeType: file.type === '' ? 'application/octet-stream' : file.type,
        size: file.size,
        checksum: hex,
      }),
    });
    if (typeof metadata.id !== 'string') throw new Error('附件元数据响应无效');
    const uploaded = await json<Record<string, unknown>>(
      `/api/v1/attachments/${metadata.id}/content`,
      token,
      { method: 'PUT', body: JSON.stringify({ contentBase64: btoa(binary) }) },
    );
    await json(`/api/v1/ctr-versions/${versionId}/attachments`, token, {
      method: 'POST',
      body: JSON.stringify({ attachmentId: metadata.id }),
    });
    return uploaded;
  },
  async uploadContractDocument(businessType, subjectType, subjectId, file) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
    const checksum = [...digest].map((value) => value.toString(16).padStart(2, '0')).join('');
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    const metadata = await json<Record<string, unknown>>('/api/v1/attachments', token, {
      method: 'POST',
      body: JSON.stringify({
        name: file.name,
        mimeType: file.type || 'application/octet-stream',
        size: file.size,
        checksum,
      }),
    });
    if (typeof metadata.id !== 'string') throw new Error('附件元数据响应无效');
    await json(`/api/v1/attachments/${metadata.id}/content`, token, {
      method: 'PUT',
      body: JSON.stringify({ contentBase64: btoa(binary) }),
    });
    return json<Record<string, unknown>>('/api/v1/contract-documents', token, {
      method: 'POST',
      headers: { 'idempotency-key': requestId() },
      body: JSON.stringify({
        businessType,
        subjectType,
        subjectId,
        attachmentId: metadata.id,
        title: file.name,
      }),
    });
  },
  command: (revisionId, action, payload = {}) =>
    json<Record<string, unknown>>(`/api/v1/quote-revisions/${revisionId}/${action}`, token, {
      method: 'POST',
      headers: { 'idempotency-key': requestId() },
      body: JSON.stringify(payload),
    }),
});

export function createFetchCrmApi(token: string): CrmApi {
  const post = <T>(path: string, body: unknown, headers?: HeadersInit) =>
    json<T>(path, token, {
      method: 'POST',
      body: JSON.stringify(body),
      ...(headers === undefined ? {} : { headers }),
    });
  return {
    listEmployees: () => json<readonly Employee[]>('/api/v1/employees', token),
    async listCustomers() {
      return (await json<{ items: Customer[] }>('/api/v1/customers', token)).items;
    },
    customer360: (id) => json(`/api/v1/customers/${id}/360`, token),
    createCustomer: (input) => post('/api/v1/customers', input),
    transitionCustomer: (customer, status, reason) =>
      json(`/api/v1/customers/${customer.id}`, token, {
        method: 'PATCH',
        body: JSON.stringify({ status, reason, expectedVersion: customer.version }),
      }),
    addContact: (id, name, email) =>
      post(`/api/v1/customers/${id}/contacts`, {
        name,
        email,
        title: null,
        phone: null,
        primary: false,
      }),
    addActivity: (id, summary) =>
      post(
        `/api/v1/customers/${id}/activities`,
        { leadId: null, type: 'NOTE', occurredAt: new Date().toISOString(), summary, details: {} },
        { 'idempotency-key': requestId() },
      ),
    assignCustomer: (customer, assigneeId, reason) =>
      post(`/api/v1/customers/${customer.id}/ownership`, {
        assigneeId,
        reason,
        expectedVersion: customer.version,
        reassignment: customer.ownerId !== null,
      }),
    async listPool() {
      return (await json<{ items: Lead[] }>('/api/v1/leads/pool', token)).items;
    },
    async listLeads() {
      return (await json<{ items: Lead[] }>('/api/v1/leads', token)).items;
    },
    createLead: (input) => post('/api/v1/leads', input),
    claimLead: (lead) =>
      post(
        `/api/v1/leads/${lead.id}/claim`,
        { expectedVersion: lead.version },
        { 'idempotency-key': requestId() },
      ),
    transitionLead: (lead, status, reason) =>
      post(`/api/v1/leads/${lead.id}/transition`, {
        status,
        reason,
        expectedVersion: lead.version,
      }),
    assignLead: (lead, assigneeId, reason) =>
      post(`/api/v1/leads/${lead.id}/${lead.ownerId === null ? 'assign' : 'reassign'}`, {
        assigneeId,
        reason,
        expectedVersion: lead.version,
      }),
    releaseLead: (lead, reason) =>
      post(`/api/v1/leads/${lead.id}/release`, { reason, expectedVersion: lead.version }),
  };
}

export class CrmController {
  public employees: readonly Employee[] = [];
  public customers: readonly Customer[] = [];
  public pool: readonly Lead[] = [];
  public leads: readonly Lead[] = [];
  public selected: Customer360 | null = null;
  public error: string | null = null;
  public customerQuery = '';
  public customerStatus = 'ALL';
  public leadQuery = '';
  public customerPage = 1;
  public leadPage = 1;
  public readonly pageSize = 10;
  public constructor(
    public readonly permissions: ReadonlySet<CrmPermission>,
    private readonly api: CrmApi,
  ) {}
  public async load(): Promise<void> {
    const sections = visibleCrmSections(this.permissions);
    const [customers, pool, leads, employees] = await Promise.all([
      sections.customers ? this.api.listCustomers() : Promise.resolve([]),
      this.permissions.has('lead-pool:read') ? this.api.listPool() : Promise.resolve([]),
      this.permissions.has('lead:read') ? this.api.listLeads() : Promise.resolve([]),
      this.permissions.has('employee:read') ? this.api.listEmployees() : Promise.resolve([]),
    ]);
    this.customers = customers;
    this.pool = pool;
    this.leads = leads;
    this.employees = employees.filter((employee) => employee.active !== false);
  }
  public visibleCustomers(): readonly Customer[] {
    const query = this.customerQuery.trim().toLocaleLowerCase('zh-CN');
    return this.customers.filter(
      (customer) =>
        (this.customerStatus === 'ALL' || customer.status === this.customerStatus) &&
        (query.length === 0 ||
          [customer.name, customer.customerNumber, customer.ownerId].some((item) =>
            item?.toLocaleLowerCase('zh-CN').includes(query),
          )),
    );
  }
  public visibleLeads(): readonly Lead[] {
    const query = this.leadQuery.trim().toLocaleLowerCase('zh-CN');
    return [...this.pool, ...this.leads]
      .filter(
        (lead, index, all) => all.findIndex((candidate) => candidate.id === lead.id) === index,
      )
      .filter(
        (lead) =>
          query.length === 0 ||
          [lead.title, lead.source, lead.status].some((item) =>
            item?.toLocaleLowerCase('zh-CN').includes(query),
          ),
      );
  }
  public customerPageItems(): readonly Customer[] {
    const start = (this.customerPage - 1) * this.pageSize;
    return this.visibleCustomers().slice(start, start + this.pageSize);
  }
  public leadPageItems(): readonly Lead[] {
    const start = (this.leadPage - 1) * this.pageSize;
    return this.visibleLeads().slice(start, start + this.pageSize);
  }
  public async selectCustomer(id: string): Promise<void> {
    if (!visibleCrmSections(this.permissions).customer360) return;
    this.selected = await this.api.customer360(id);
  }
  public async createCustomer(input: CustomerInput): Promise<void> {
    if (!this.permissions.has('customer:create')) return;
    await this.api.createCustomer(input);
    this.customers = await this.api.listCustomers();
  }
  public async createLead(input: LeadInput): Promise<void> {
    if (!this.permissions.has('lead:create')) return;
    await this.api.createLead(input);
    if (this.permissions.has('lead-pool:read')) this.pool = await this.api.listPool();
  }
  public async claim(lead: Lead): Promise<void> {
    if (!visibleCrmSections(this.permissions).leadClaim) return;
    await this.api.claimLead(lead);
    this.pool = await this.api.listPool();
  }
  public async mutateLead(
    lead: Lead,
    action: 'lifecycle' | 'assignment' | 'release',
    first: string,
    reason: string,
  ): Promise<void> {
    if (!Number.isInteger(lead.version)) return;
    if (action === 'lifecycle' && this.permissions.has('lead:lifecycle'))
      await this.api.transitionLead(lead, first, reason);
    else if (
      action === 'assignment' &&
      lead.ownerId !== undefined &&
      this.permissions.has(lead.ownerId === null ? 'lead:assign' : 'lead:reassign')
    )
      await this.api.assignLead(lead, first, reason);
    else if (action === 'release' && this.permissions.has('lead-pool:release'))
      await this.api.releaseLead(lead, reason);
    else return;
    if (this.permissions.has('lead-pool:read')) this.pool = await this.api.listPool();
    if (this.permissions.has('lead:read')) this.leads = await this.api.listLeads();
  }
  public async mutateSelected(
    action: 'contact' | 'activity' | 'lifecycle' | 'ownership',
    first: string,
    second = '',
  ): Promise<void> {
    if (!this.selected) return;
    const customer = this.selected.customer;
    if ((action === 'lifecycle' || action === 'ownership') && !Number.isInteger(customer.version))
      return;
    if (action === 'ownership' && customer.ownerId === undefined) return;
    if (action === 'contact' && this.permissions.has('customer:update'))
      await this.api.addContact(customer.id, first, second);
    else if (action === 'activity' && this.permissions.has('customer-activity:create'))
      await this.api.addActivity(customer.id, first);
    else if (action === 'lifecycle' && this.permissions.has('customer:lifecycle'))
      await this.api.transitionCustomer(customer, first, second);
    else if (
      action === 'ownership' &&
      this.permissions.has(
        customer.ownerId === null ? 'customer-ownership:assign' : 'customer-ownership:reassign',
      )
    )
      await this.api.assignCustomer(customer, first, second);
    else return;
    this.selected = await this.api.customer360(customer.id);
    this.customers = await this.api.listCustomers();
  }
}

type OnlineBusinessDocument = Readonly<{
  id: string;
  templateKey: string;
  title: string;
  route: string;
  state?: 'DRAFT' | 'IN_REVIEW' | 'APPROVED' | 'REJECTED' | 'ARCHIVED';
  currentVersion: number;
  customerId?: string;
  customerName?: string;
  salesOrderId?: string;
  salesOrderNumber?: string;
  operatorId?: string;
  operatorName?: string;
  salespersonId?: string;
  salespersonName?: string;
  assignedTo?: string;
  assigneeName?: string;
  reviewEvents?: readonly Readonly<{
    action: 'SUBMITTED' | 'APPROVED' | 'REJECTED';
    reason: string;
    createdAt?: string;
  }>[];
  versions?: readonly Readonly<{
    version: number;
    content: Readonly<{ body?: string; html?: string }>;
    changeSummary: string;
    createdAt?: string;
  }>[];
  translations?: readonly Readonly<{
    id: string;
    sourceVersion: number;
    targetLocale: string;
    provider: 'MANUAL' | 'CONNECTED_PROVIDER';
    status: 'QUEUED' | 'READY';
    content?: Readonly<{ body?: string; html?: string }>;
    createdAt?: string;
  }>[];
  dispatches?: readonly Readonly<{
    id: string;
    documentVersion: number;
    translationId?: string;
    channel: DocumentConnectorKey;
    recipientName: string;
    recipientMasked: string;
    subject: string;
    status: 'QUEUED' | 'DELIVERED' | 'RETRY' | 'FAILED';
    requestedAt?: string;
    deliveredAt?: string;
  }>[];
}>;

type DocumentConnectorKey =
  | 'EMAIL'
  | 'WECHAT_WORK'
  | 'WHATSAPP_BUSINESS'
  | 'MICROSOFT_TEAMS'
  | 'TELEGRAM'
  | 'LINE'
  | 'TRANSLATION';
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
type FormField = Readonly<{
  name: string;
  label: string;
  type?:
    | 'text'
    | 'password'
    | 'email'
    | 'tel'
    | 'number'
    | 'date'
    | 'datetime-local'
    | 'select'
    | 'textarea';
  required?: boolean;
  placeholder?: string;
  value?: string;
  hint?: string;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  step?: number;
  section?: string;
  fullWidth?: boolean;
  options?: readonly Readonly<{ value: string; label: string }>[];
}>;
function openForm(
  host: HTMLElement,
  title: string,
  description: string,
  fields: readonly FormField[],
  submitLabel: string,
  onSubmit: (values: Readonly<Record<string, string>>) => Promise<void>,
  options: Readonly<{ className?: string }> = {},
): void {
  const dialog = el('dialog', `form-dialog ${options.className ?? ''}`.trim());
  const form = el('form', 'entity-form');
  form.setAttribute('method', 'dialog');
  const heading = el('div', 'dialog-heading');
  heading.append(
    el('p', 'eyebrow', '业务流程'),
    el('h2', '', title),
    el('p', 'muted', description),
  );
  form.append(heading);
  let dirty = false;
  for (const field of fields) {
    if (field.section) form.append(el('h3', 'form-section-heading', field.section));
    const label = el('label', field.fullWidth ? 'form-field full-width' : 'form-field');
    const fieldLabel = el('span', '', field.label);
    if (field.required) fieldLabel.append(el('em', 'required-mark', '必填'));
    label.append(fieldLabel);
    const control =
      field.type === 'textarea'
        ? el('textarea')
        : field.type === 'select'
          ? el('select')
          : el('input');
    control.setAttribute('name', field.name);
    if (field.required) {
      control.setAttribute('required', '');
      control.setAttribute('aria-required', 'true');
    }
    if (field.placeholder) control.setAttribute('placeholder', field.placeholder);
    if (field.minLength !== undefined) control.setAttribute('minlength', String(field.minLength));
    if (field.maxLength !== undefined) control.setAttribute('maxlength', String(field.maxLength));
    if (field.min !== undefined) control.setAttribute('min', String(field.min));
    if (field.max !== undefined) control.setAttribute('max', String(field.max));
    if (field.step !== undefined) control.setAttribute('step', String(field.step));
    if (control instanceof HTMLInputElement)
      control.type = ['password', 'email', 'tel', 'number', 'date'].includes(field.type ?? '')
        ? (field.type as 'password' | 'email' | 'tel' | 'number' | 'date')
        : 'text';
    if (control instanceof HTMLSelectElement)
      for (const option of field.options ?? []) {
        const item = el('option', '', option.label);
        item.value = option.value;
        control.append(item);
      }
    if (field.value !== undefined && 'value' in control) control.value = field.value;
    label.append(control);
    if (field.hint) label.append(el('small', 'field-hint', field.hint));
    control.addEventListener('invalid', () => {
      control.setAttribute('aria-invalid', 'true');
      label.classList.add('invalid');
    });
    control.addEventListener('input', () => {
      dirty = true;
      if (control.checkValidity()) {
        control.removeAttribute('aria-invalid');
        label.classList.remove('invalid');
      }
    });
    form.append(label);
  }
  const error = el('p', 'form-error');
  error.setAttribute('role', 'alert');
  error.tabIndex = -1;
  const progress = el('p', 'form-progress');
  progress.setAttribute('role', 'status');
  progress.setAttribute('aria-live', 'polite');
  const actions = el('div', 'dialog-actions');
  const cancel = el('button', 'secondary', '取消');
  cancel.type = 'button';
  cancel.addEventListener('click', () => {
    if (
      dirty &&
      typeof globalThis.confirm === 'function' &&
      !globalThis.confirm('当前修改尚未保存，确定关闭吗？')
    )
      return;
    dialog.close();
  });
  const submit = el('button', 'primary', submitLabel);
  submit.type = 'submit';
  let confirmationCheckbox: HTMLInputElement | null = null;
  const sensitive = /删除|停用|取消|驳回|拒绝|追回|关闭|释放/u.test(submitLabel);
  if (sensitive) {
    const confirmation = el('label', 'operation-confirmation');
    const checkbox = el('input');
    checkbox.type = 'checkbox';
    confirmationCheckbox = checkbox;
    confirmation.append(checkbox, el('span', '', '我已核对当前单据、操作理由及其对后续流程的影响'));
    submit.disabled = true;
    checkbox.addEventListener('change', () => {
      submit.disabled = !checkbox.checked;
    });
    form.append(
      el('p', 'operation-warning', '此操作会改变业务状态并写入审计记录，请确认后继续。'),
      confirmation,
    );
  }
  actions.append(cancel, submit);
  form.append(error, progress, actions);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (form.getAttribute('aria-busy') === 'true') return;
    error.textContent = '';
    if (!form.checkValidity()) {
      const invalid = Array.from(form.elements).filter(
        (item) =>
          (item instanceof HTMLInputElement ||
            item instanceof HTMLSelectElement ||
            item instanceof HTMLTextAreaElement) &&
          !item.checkValidity(),
      );
      error.textContent = `请检查 ${String(invalid.length)} 个必填或格式不正确的字段`;
      const firstInvalid = invalid[0];
      if (firstInvalid instanceof HTMLElement) firstInvalid.focus();
      form.reportValidity();
      return;
    }
    setOperationStatus(error, 'idle');
    setOperationStatus(progress, 'loading', '正在提交，请勿重复操作…');
    form.setAttribute('aria-busy', 'true');
    submit.disabled = true;
    cancel.disabled = true;
    submit.textContent = '处理中…';
    const values = Object.fromEntries(
      [...new FormData(form).entries()].map(([key, entry]) => [
        key,
        typeof entry === 'string' ? entry.trim() : '',
      ]),
    );
    void onSubmit(values)
      .then(() => {
        dirty = false;
        setOperationStatus(progress, 'success', '操作成功');
        dialog.close();
      })
      .catch((failure: unknown) => {
        setOperationStatus(
          error,
          'error',
          failure instanceof Error ? failure.message : '操作失败，请稍后重试',
        );
        setOperationStatus(progress, 'idle');
        error.focus();
      })
      .finally(() => {
        form.removeAttribute('aria-busy');
        cancel.disabled = false;
        submit.disabled = confirmationCheckbox?.checked === false;
        submit.textContent = submitLabel;
      });
  });
  dialog.append(form);
  host.append(dialog);
  dialog.addEventListener('cancel', (event) => {
    if (
      dirty &&
      typeof globalThis.confirm === 'function' &&
      !globalThis.confirm('当前修改尚未保存，确定关闭吗？')
    )
      event.preventDefault();
  });
  dialog.addEventListener('close', () => {
    dialog.remove();
  });
  dialog.showModal();
}
function openFileForm(
  host: HTMLElement,
  title: string,
  onSubmit: (file: File) => Promise<void>,
): void {
  const dialog = el('dialog', 'form-dialog');
  const form = el('form', 'entity-form');
  const heading = el('div', 'dialog-heading');
  heading.append(
    el('p', 'eyebrow', '技术需求证据'),
    el('h2', '', title),
    el('p', 'muted', '附件最大 25 MB；提交技术需求后附件集合将被冻结。'),
  );
  const label = el('label', 'form-field file-field');
  label.append(el('span', '', '选择技术资料或客户需求文件'));
  const input = el('input');
  input.type = 'file';
  input.required = true;
  input.accept = '.pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.txt';
  label.append(input);
  const error = el('p', 'form-error');
  error.setAttribute('role', 'alert');
  const actions = el('div', 'dialog-actions');
  const cancel = el('button', 'secondary', '取消');
  cancel.type = 'button';
  cancel.addEventListener('click', () => {
    dialog.close();
  });
  const submit = el('button', 'primary', '上传并关联');
  submit.type = 'submit';
  actions.append(cancel, submit);
  form.append(heading, label, error, actions);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const file = input.files?.[0];
    if (!file) return;
    if (file.size > 26_214_400) {
      error.textContent = '文件超过 25 MB 限制';
      return;
    }
    submit.disabled = true;
    submit.textContent = '上传中…';
    void onSubmit(file)
      .then(() => {
        dialog.close();
      })
      .catch((failure: unknown) => {
        error.textContent = failure instanceof Error ? failure.message : '附件上传失败';
      })
      .finally(() => {
        submit.disabled = false;
        submit.textContent = '上传并关联';
      });
  });
  dialog.append(form);
  host.append(dialog);
  dialog.addEventListener('close', () => {
    dialog.remove();
  });
  dialog.showModal();
}
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

function setAppRoute(route: AppRoute): void {
  if (typeof globalThis.location === 'undefined') return;
  const hash = `#/${route}`;
  if (globalThis.location.hash !== hash) globalThis.location.hash = hash;
}

export function installAppNavigation(shell: HTMLElement): void {
  const availableRoutes = new Set(
    Array.from(shell.querySelectorAll<HTMLElement>('[data-app-route]')).map(
      (item) => item.dataset.appRoute as AppRoute,
    ),
  );
  const fallbackRoute = availableRoutes.values().next().value;
  const allowedRoute = (requested: AppRoute): AppRoute | undefined =>
    availableRoutes.has(requested) ? requested : fallbackRoute;
  const apply = (route: AppRoute) => {
    for (const item of Array.from(shell.querySelectorAll<HTMLElement>('[data-app-route]'))) {
      const active = item.dataset.appRoute === route;
      item.classList.toggle('active', active);
      item.setAttribute('aria-current', active ? 'page' : 'false');
    }
    for (const parent of Array.from(shell.querySelectorAll<HTMLElement>('[data-nav-routes]'))) {
      const routes = (parent.dataset.navRoutes ?? '').split(/\s+/u);
      const active = routes.includes(route);
      const group = parent.parentElement;
      parent.classList.toggle('active', active);
      group?.classList.toggle('active-domain', active);
      if (active) {
        group?.classList.add('open');
        parent.setAttribute('aria-expanded', 'true');
      }
    }
    for (const view of Array.from(shell.querySelectorAll<HTMLElement>('[data-route-view]'))) {
      const routes = (view.dataset.routeView ?? '').split(/\s+/u);
      view.hidden = !routes.includes(route);
    }
    const routeContext = shell.querySelector<HTMLElement>('[data-route-context]');
    if (routeContext) {
      routeContext.hidden = route === 'overview';
      const heading = routeContext.querySelector<HTMLElement>('h1');
      const description = routeContext.querySelector<HTMLElement>('.page-subtitle');
      const breadcrumb = routeContext.querySelector<HTMLElement>('.eyebrow');
      if (heading) heading.textContent = APP_ROUTE_LABELS[route];
      if (description) description.textContent = APP_ROUTE_DESCRIPTIONS[route];
      if (breadcrumb) breadcrumb.textContent = `金特夫业务系统 · ${APP_ROUTE_LABELS[route]}`;
    }
    const utilityContext = shell.querySelector<HTMLElement>('[data-utility-context]');
    if (utilityContext) utilityContext.textContent = APP_ROUTE_LABELS[route];
    const placeholder = shell.querySelector<HTMLElement>('[data-route-placeholder]');
    if (!placeholder) return;
    const hasView = Array.from(shell.querySelectorAll<HTMLElement>('[data-route-view]')).some(
      (view) => !view.hidden && (view.dataset.routeView ?? '').split(/\s+/u).includes(route),
    );
    placeholder.hidden = hasView;
    placeholder.textContent = `${APP_ROUTE_LABELS[route]}：当前账号在本模块暂无可用功能，请联系权限管理员核对岗位职责。`;
  };
  for (const item of Array.from(shell.querySelectorAll<HTMLElement>('[data-app-route]'))) {
    item.addEventListener('click', () => {
      setAppRoute(item.dataset.appRoute as AppRoute);
    });
  }
  const initial =
    typeof globalThis.location === 'undefined'
      ? 'overview'
      : appRouteFromHash(globalThis.location.hash);
  const initialAllowed = allowedRoute(initial);
  if (initialAllowed === undefined) return;
  apply(initialAllowed);
  if (initialAllowed !== initial) setAppRoute(initialAllowed);
  globalThis.addEventListener('hashchange', () => {
    const requested = appRouteFromHash(globalThis.location.hash);
    const allowed = allowedRoute(requested);
    if (allowed === undefined) return;
    apply(allowed);
    if (allowed !== requested) setAppRoute(allowed);
  });
}

function installRouteSectionNavigation(shell: HTMLElement): void {
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

type NavIconName =
  | 'overview'
  | 'sales'
  | 'operations'
  | 'customers'
  | 'opportunities'
  | 'cost'
  | 'contracts'
  | 'receivables'
  | 'production'
  | 'quality'
  | 'delivery'
  | 'governance';

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

const ENTERPRISE_STATUS_LABELS: Readonly<Record<string, string>> = {
  ACTIVE: '已启用',
  ACCEPTED: '已受理',
  ACCRUED: '已计提',
  APPROVED: '已批准',
  ARCHIVED: '已归档',
  AWARDED: '已定标',
  BLACKLISTED: '已禁用',
  CALCULATED: '已核算',
  CANCELLED: '已取消',
  CLAIMED: '已认领',
  CLOSED: '已关闭',
  COMPLETED: '已完成',
  COMPUTED: '已计算',
  CONVERTED: '已转化',
  CONTACTING: '联系中',
  DRAFT: '草稿',
  DELIVERED: '已签收',
  DISPATCHED: '已发运',
  DISQUALIFIED: '无效',
  EXPIRED: '已过期',
  EXCEPTION_PENDING: '例外待审批',
  FINAL: '已定稿',
  FROZEN: '已冻结',
  IN_PROGRESS: '进行中',
  INACTIVE: '已停用',
  ISSUED: '已签发',
  ISSUE: '领料',
  OPEN: '待处理',
  PAID: '已支付',
  PARTIALLY_PAID: '部分支付',
  PARTIALLY_RECEIVED: '部分收货',
  PENDING: '待处理',
  PENDING_APPROVAL: '待审批',
  POOL: '公海',
  PUBLISHED: '已发布',
  PROMISE_BROKEN: '付款承诺已违约',
  PROPOSED: '待审批',
  QUARANTINE: '待检隔离',
  QUALIFIED: '已确认',
  REJECTED: '已拒绝',
  READY: '待执行',
  RELEASED: '已放行',
  REQUESTED: '待受理',
  SAMPLED: '已抽样',
  SIGNED: '已签署',
  SUBMITTED: '已提交',
  SUSPENDED: '已暂停',
  RETURNED: '已退回',
  RETURN: '退料',
  VOIDED: '已作废',
  LEGAL_ACCEPTED: '法务已受理',
  WON: '已赢单',
  LOST: '已输单',
};

const ENTERPRISE_EYEBROW_LABELS: Readonly<Record<string, string>> = {
  'EXECUTIVE COCKPIT': '经营驾驶舱',
  'SHOP-FLOOR EXECUTION': '车间执行',
  'ACTUAL COST & VARIANCE': '制造成本分析',
  'SHIPMENT RELEASE & PROOF OF DELIVERY': '发货与签收',
  'CTR EVIDENCE': '技术需求证据',
  'POLICY DECISION': '销售政策判定',
  'CREDIT DECISION': '信用审查结果',
  'ORDER 360': '订单全景',
  'RISK ENGINE V1': '风险评估',
  'MANUFACTURING MASTER DATA': '制造主数据',
  'SOURCE TO STOCK': '采购到入库',
  'EXPLAINABLE MATERIAL PLANNING': '物料需求计划',
  'QUALITY & WAREHOUSE': '质量与仓储',
  'KINGTURF WORKFLOW': '业务流程',
};

function localizeEnterpriseCopy(root: HTMLElement): void {
  for (const item of Array.from(
    root.querySelectorAll<HTMLElement>('.ctr-state, .status-badge, .version-pin'),
  )) {
    const source = item.textContent.trim();
    const label = ENTERPRISE_STATUS_LABELS[source];
    if (label) {
      item.textContent = label;
      item.setAttribute('title', source);
    }
  }
  for (const item of Array.from(root.querySelectorAll<HTMLElement>('.eyebrow'))) {
    const source = item.textContent.trim();
    const label = ENTERPRISE_EYEBROW_LABELS[source];
    if (label) item.textContent = label;
  }
}

export function createCrmShell(
  controller: CrmController,
  width = window.innerWidth,
  allPermissions: ReadonlySet<string> = controller.permissions,
  profileLabel = '当前账号',
): HTMLElement {
  let viewportWidth = width;
  const sections = visibleCrmSections(controller.permissions);
  const employeeChoices = controller.employees.map((employee) => ({
    value: employee.id,
    label: `${employee.displayName ?? employee.id}${employee.employeeNumber ? ` · ${employee.employeeNumber}` : ''}`,
  }));
  const pagination = (total: number, page: number, change: (page: number) => void) => {
    const pages = Math.max(1, Math.ceil(total / controller.pageSize));
    const footer = el('footer', 'pagination');
    const previous = el('button', 'page-button', '← 上一页');
    previous.disabled = page <= 1;
    previous.addEventListener('click', () => {
      change(page - 1);
    });
    const state = el('span', '', `${String(page)} / ${String(pages)} 页 · ${String(total)} 条`);
    const next = el('button', 'page-button', '下一页 →');
    next.disabled = page >= pages;
    next.addEventListener('click', () => {
      change(page + 1);
    });
    footer.append(previous, state, next);
    return footer;
  };
  const shell = el('main', `app-shell ${viewportFor(viewportWidth)}`);
  let sidebarCollapsed = false;
  try {
    sidebarCollapsed = globalThis.localStorage.getItem('kingturf.sidebar.collapsed') === 'true';
  } catch {
    sidebarCollapsed = false;
  }
  const renderSidebarState = () => {
    shell.className = `app-shell ${viewportFor(viewportWidth)}${sidebarCollapsed ? ' sidebar-collapsed' : ''}`;
    const workspace = shell.querySelector<HTMLElement>('.commercial-workspace');
    if (workspace) {
      workspace.classList.remove('desktop', 'tablet', 'mobile');
      workspace.classList.add(viewportFor(viewportWidth));
    }
  };
  renderSidebarState();
  const resizeTarget = globalThis as unknown as {
    addEventListener?: (type: string, listener: () => void) => void;
    removeEventListener?: (type: string, listener: () => void) => void;
  };
  const handleViewportResize = () => {
    if (!shell.isConnected) {
      resizeTarget.removeEventListener?.('resize', handleViewportResize);
      return;
    }
    viewportWidth = globalThis.innerWidth || viewportWidth;
    renderSidebarState();
  };
  resizeTarget.addEventListener?.('resize', handleViewportResize);
  const aside = el('aside', 'sidebar');
  const brand = el('div', 'brand-lockup');
  const brandLogoFrame = el('span', 'brand-logo-frame');
  const brandLogo = document.createElement('img');
  brandLogo.className = 'brand-logo';
  brandLogo.src = brandMark;
  brandLogo.alt = '';
  brandLogo.width = 512;
  brandLogo.height = 512;
  const brandIdentity = el('span', 'brand-identity');
  brandIdentity.append(
    el('strong', 'brand-name', '金特夫'),
    el('small', 'brand-english', 'KING TURF'),
  );
  brandLogoFrame.setAttribute('aria-label', '金特夫 King Turf');
  brandLogoFrame.append(brandLogo, brandIdentity);
  brand.append(brandLogoFrame);
  const sidebarToggle = el('button', 'sidebar-toggle');
  sidebarToggle.type = 'button';
  const renderSidebarToggle = () => {
    sidebarToggle.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${sidebarCollapsed ? 'm9 18 6-6-6-6' : 'm15 18-6-6 6-6'}"></path></svg>`;
    sidebarToggle.setAttribute('aria-label', sidebarCollapsed ? '展开左侧导航' : '收起左侧导航');
    sidebarToggle.setAttribute('title', sidebarCollapsed ? '展开导航' : '收起导航');
    sidebarToggle.setAttribute('aria-expanded', String(!sidebarCollapsed));
  };
  renderSidebarToggle();
  sidebarToggle.addEventListener('click', () => {
    sidebarCollapsed = !sidebarCollapsed;
    renderSidebarState();
    renderSidebarToggle();
    try {
      globalThis.localStorage.setItem('kingturf.sidebar.collapsed', String(sidebarCollapsed));
    } catch {
      // The visible state still works when storage is unavailable.
    }
  });
  aside.append(brand);
  const nav = el('nav');
  const visibleRoutes = visibleAppRoutes(allPermissions);
  const roleProfile = roleWorkspaceProfile(allPermissions);
  const currentRoute =
    typeof globalThis.location === 'undefined'
      ? 'overview'
      : appRouteFromHash(globalThis.location.hash);
  const navGroup = (
    title: string,
    domainIcon: NavIconName,
    items: readonly [NavIconName, string, AppRoute][],
  ) => {
    const visibleItems = items.filter(([, , route]) => visibleRoutes.has(route));
    if (visibleItems.length === 0) return;
    const routes = visibleItems.map(([, , route]) => route);
    const group = el(
      'section',
      `nav-group${routes.includes(currentRoute) ? ' open active-domain' : ''}`,
    );
    const childrenId = `nav-domain-${routes[0] ?? 'available'}`;
    const parent = el('button', 'nav-parent');
    parent.type = 'button';
    parent.title = title;
    parent.setAttribute('data-nav-routes', routes.join(' '));
    parent.setAttribute('aria-controls', childrenId);
    parent.setAttribute('aria-expanded', String(routes.includes(currentRoute)));
    const parentIcon = el('span', 'nav-glyph');
    parentIcon.append(navIcon(domainIcon));
    parent.append(parentIcon, el('span', 'nav-text', title), el('span', 'nav-parent-chevron', '›'));
    const children = el('div', 'nav-children');
    children.id = childrenId;
    parent.addEventListener('click', () => {
      if (sidebarCollapsed) {
        sidebarCollapsed = false;
        renderSidebarState();
        renderSidebarToggle();
      }
      const open = !group.classList.contains('open');
      group.classList.toggle('open', open);
      parent.setAttribute('aria-expanded', String(open));
    });
    for (const [icon, label, route] of visibleItems) {
      const item = el('button', `nav-item${currentRoute === route ? ' active' : ''}`);
      item.title = label;
      item.setAttribute('data-app-route', route);
      item.setAttribute('aria-current', currentRoute === route ? 'page' : 'false');
      item.addEventListener('click', () => {
        setAppRoute(route);
      });
      const iconBox = el('span', 'nav-glyph');
      iconBox.append(navIcon(icon));
      item.append(iconBox, el('span', 'nav-text', label));
      children.append(item);
    }
    group.append(parent, children);
    nav.append(group);
  };
  navGroup('经营管理', 'overview', [['overview', '经营总览', 'overview']]);
  navGroup('业务文档', 'operations', [['operations', '业务文档库', 'document-templates']]);
  navGroup('客户与商机', 'sales', [
    ['opportunities', '销售线索', 'leads'],
    ['customers', '客户管理', 'customers'],
    ['opportunities', '销售商机', 'opportunities'],
  ]);
  navGroup('技术与报价', 'cost', [
    ['opportunities', '技术需求', 'technical-requirements'],
    ['operations', '技术方案', 'technical-solutions'],
    ['cost', '成本核算', 'costing'],
    ['cost', '销售政策', 'sales-policies'],
    ['contracts', '销售报价', 'quotes'],
  ]);
  navGroup('合同与订单', 'contracts', [
    ['receivables', '信用审查', 'credit-review'],
    ['contracts', '合同管理', 'contracts'],
    ['contracts', '销售订单', 'sales-orders'],
    ['overview', '订单全景', 'order-360'],
  ]);
  navGroup('财务与风控', 'receivables', [
    ['receivables', '应收账款', 'receivables'],
    ['receivables', '催收与法务', 'collections'],
    ['receivables', '收款与核销', 'payments'],
    ['cost', '销售佣金', 'commissions'],
    ['quality', '业务风险', 'business-risks'],
  ]);
  navGroup('供应链与生产', 'production', [
    ['operations', '制造主数据', 'manufacturing-master'],
    ['delivery', '采购管理', 'procurement'],
    ['production', '物料计划', 'material-planning'],
    ['production', '生产执行', 'production-orders'],
  ]);
  navGroup('质量与交付', 'quality', [
    ['quality', '质量检验', 'quality-inspection'],
    ['delivery', '发货与签收', 'shipments'],
  ]);
  navGroup('系统管理', 'governance', [['governance', '组织、权限与配置', 'governance']]);
  aside.append(nav);
  const sidebarFooter = el('div', 'sidebar-footer');
  sidebarFooter.append(el('span', 'online-dot'), el('span', '', '生产环境 · erp.kingturf.cn'));
  aside.append(sidebarFooter);
  const content = el('section', 'workspace');
  const utility = el('header', 'utility-bar');
  const utilityLeading = el('div', 'utility-leading');
  const utilityContext = el('span', 'utility-context', APP_ROUTE_LABELS[currentRoute]);
  utilityContext.setAttribute('data-utility-context', 'true');
  utilityLeading.append(sidebarToggle, utilityContext);
  const search = el('button', 'global-search');
  search.type = 'button';
  search.setAttribute('aria-label', '进入客户与业务查询');
  search.append(
    el('span', 'search-symbol', '⌕'),
    el('span', '', '搜索客户、订单或业务编号'),
    el('span', 'search-action', '进入查询'),
  );
  search.addEventListener('click', () => {
    setAppRoute('customers');
  });
  const profile = el('div', 'profile-chip');
  profile.append(
    el('span', 'profile-avatar', profileLabel.slice(0, 1)),
    el('span', '', profileLabel),
    el('span', 'profile-role', roleProfile.title),
  );
  utility.append(utilityLeading, search, profile);
  content.append(utility);
  const routeContext = el('header', 'route-context-header');
  routeContext.setAttribute('data-route-context', 'true');
  routeContext.hidden = currentRoute === 'overview';
  routeContext.append(
    el('p', 'eyebrow', `金特夫业务系统 · ${APP_ROUTE_LABELS[currentRoute]}`),
    el('h1', '', APP_ROUTE_LABELS[currentRoute]),
    el('p', 'page-subtitle', APP_ROUTE_DESCRIPTIONS[currentRoute]),
  );
  content.append(routeContext);
  const header = el('header', 'topbar');
  const title = el('div');
  const today = new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  }).format(new Date());
  title.append(el('p', 'eyebrow', `经营总览 · ${today}`), el('h1', '', '经营概览'));
  title.append(el('p', 'page-subtitle', '经营指标、重点待办与异常事项'));
  header.append(title);
  if (sections.customerCreate) {
    const create = el('button', 'primary', '＋ 新建客户');
    create.addEventListener('click', () => {
      openForm(
        shell,
        '新建客户',
        '建立客户主档后，可继续补充联系人、商机和跟进活动。',
        [
          {
            name: 'name',
            label: '客户名称',
            required: true,
            placeholder: '例如：华东体育设施有限公司',
            minLength: 2,
            maxLength: 120,
          },
          {
            name: 'customerNumber',
            label: '客户编号',
            required: true,
            placeholder: '例如：CUS-2026-001',
            minLength: 3,
            maxLength: 64,
            hint: '建议使用公司统一的客户编码规则。',
          },
          { name: 'tags', label: '客户标签', placeholder: '多个标签用逗号分隔' },
        ],
        '创建客户',
        async (values) => {
          await controller.createCustomer({
            name: values.name ?? '',
            customerNumber: values.customerNumber ?? '',
            tags: (values.tags ?? '')
              .split(/[,，]/u)
              .map((tag) => tag.trim())
              .filter(Boolean),
          });
          bootstrapView(shell, controller);
        },
      );
    });
    header.append(create);
  }
  content.append(header);
  header.setAttribute('data-route-view', 'overview');
  const roleHome = el('section', 'role-home');
  roleHome.setAttribute('data-route-view', 'overview');
  const roleHomeHead = el('header', 'role-home-head');
  const roleHomeCopy = el('div');
  roleHomeCopy.append(
    el('p', 'eyebrow', '我的岗位工作台'),
    el('h2', '', roleProfile.title),
    el('p', 'muted', roleProfile.description),
  );
  const domainList = el('div', 'role-domain-list');
  for (const domain of roleProfile.domains) domainList.append(el('span', 'role-domain', domain));
  roleHomeHead.append(roleHomeCopy, domainList);
  roleHome.append(roleHomeHead);
  const roleTaskGrid = el('div', 'role-task-grid');
  for (const route of visibleRoutes) {
    if (route === 'overview') continue;
    const task = el('button', 'role-task');
    task.type = 'button';
    task.setAttribute('data-role-task-route', route);
    task.addEventListener('click', () => {
      setAppRoute(route);
    });
    task.append(
      el('span', 'role-task-state', '可处理'),
      el('strong', '', APP_ROUTE_LABELS[route]),
      el('small', '', APP_ROUTE_DESCRIPTIONS[route]),
      el('span', 'role-task-count', '正在汇总当前岗位数据…'),
      el('span', 'role-task-action', '进入工作台 →'),
    );
    roleTaskGrid.append(task);
  }
  if (roleTaskGrid.children.length === 0)
    roleTaskGrid.append(el('p', 'empty', '当前岗位暂无可处理业务入口'));
  roleHome.append(roleTaskGrid);
  content.append(roleHome);
  if (controller.error) content.append(el('p', 'error', controller.error));
  const metrics = el('section', 'metrics');
  metrics.setAttribute('data-route-view', 'overview');
  for (const [label, metric, note, tone] of [
    ['本月销售预测', '¥ 0', '等待商机数据', 'emerald'],
    ['活跃线索', String(controller.visibleLeads().length), '需持续推进', 'blue'],
    ['待审批事项', '0', '当前无阻塞', 'amber'],
    ['应收余额', '¥ 0', '回款风险正常', 'violet'],
  ] as const) {
    const card = el('article', `metric ${tone}`);
    card.append(el('span', 'metric-label', label), el('strong', '', metric), el('small', '', note));
    metrics.append(card);
  }
  if (allPermissions.has('executive-dashboard:read')) content.append(metrics);
  const flow = el('section', 'panel business-flow');
  flow.setAttribute('data-route-view', 'overview');
  const flowHead = el('div', 'panel-head');
  flowHead.append(el('div', '', '销售到回款主链'), el('span', 'flow-caption', '端到端业务进度'));
  flow.append(flowHead);
  const flowRail = el('div', 'flow-rail');
  for (const [index, label] of [
    '线索',
    '客户',
    '商机',
    '技术需求',
    '报价',
    '合同',
    '订单',
    '回款',
  ].entries()) {
    const step = el('div', `flow-step${index === 0 ? ' current' : ''}`);
    step.append(el('span', 'flow-node', String(index + 1)), el('span', '', label));
    flowRail.append(step);
  }
  flow.append(flowRail);
  if (allPermissions.has('executive-dashboard:read')) content.append(flow);
  const documentLibrary = el('section', 'role-home');
  documentLibrary.setAttribute('data-route-view', 'document-templates');
  const documentLibraryHead = el('header', 'role-home-head');
  const documentLibraryCopy = el('div');
  documentLibraryCopy.append(
    el('p', 'eyebrow', '受控业务模板'),
    el('h2', '', '金特夫业务文档库'),
    el('p', 'muted', '下载后可直接修改项目、客户、数量、价格、交期和签署信息'),
  );
  documentLibraryHead.append(documentLibraryCopy, el('span', 'role-domain', 'V2.0 · 25份'));
  documentLibrary.append(documentLibraryHead);
  const documentGrid = el('div', 'role-task-grid');
  for (const [name, description, file] of [
    [
      '技术需求确认书',
      '冻结场景、草高、Dtex、密度、底布、填充和验收标准',
      '01-人造草坪项目技术需求确认书.docx',
    ],
    [
      '产品技术规格书',
      '标准足球草型号、结构、批次检验、储运和订单确认',
      '02-体育用人造草产品技术规格书.docx',
    ],
    [
      '采购询价及比价文件',
      '采购清单、供应商响应、加权比价和定标记录',
      '03-采购询价及比价文件.docx',
    ],
    ['采购合同', '原辅材料采购、质量追溯、交付验收、付款和违约条款', '04-采购合同模板.docx'],
    ['销售合同', '产品销售、技术附件、价款、交付、质保和争议条款', '05-销售合同模板.docx'],
    [
      '成品检验与项目验收单',
      '批次检验、验收判定、不合格处置和双方确认',
      '06-成品检验与项目验收单.docx',
    ],
    [
      '发货到货与签收确认单',
      '卷号批次、承运信息、到货核验、异常证据和签收',
      '07-发货到货与签收确认单.docx',
    ],
    [
      '产品规格与选型总表',
      '12类常用产品族、型号、草高、Dtex、密度与适用边界',
      '08-常用产品规格与选型总表.docx',
    ],
    [
      '足球草系统规格书',
      '40/50/60mm足球系统、填充、减震垫与系统测试要求',
      '09-足球用人造草系统规格书.docx',
    ],
    [
      '中小学足球场规格书',
      '校园材料、环保、运动性能、进场和施工追溯要求',
      '10-中小学足球场系统规格书.docx',
    ],
    [
      '景观休闲草规格书',
      '20-40mm景观系列、密度、结构、排水、阻燃和场景确认',
      '11-景观休闲人造草规格书.docx',
    ],
    [
      '门球与多用途草规格书',
      '短草密度、填砂、球速、平整度和试铺确认',
      '12-门球及多用途短草规格书.docx',
    ],
    [
      '项目正式报价单',
      '产品、辅材、运输施工、税率、付款、交期和报价边界',
      '13-项目正式报价单.docx',
    ],
    ['合同评审记录', '法务、技术、质量、财务、产能、交期和风险会签', '14-合同评审记录.docx'],
    [
      '订单评审与交付启动单',
      '合同信用、技术冻结、物料、产能、质量和物流启动',
      '15-订单评审与交付启动单.docx',
    ],
    [
      '标准BOM与用料核算表',
      '草丝、底布、背胶、包装、标准用量、损耗和订单需求',
      '16-标准BOM与用料核算表.docx',
    ],
    ['生产任务单', '物料色批、簇绒、背胶、排版、包装和实际生产记录', '17-生产任务单.docx'],
    ['工艺流转卡', '备料、簇绒、背胶、裁切、成检和包装全过程追溯', '18-工艺流转卡.docx'],
    [
      '原辅材料来料检验单',
      '草丝、底布、背胶、包装的批次接收和不合格控制',
      '19-原辅材料来料检验单.docx',
    ],
    ['生产首件检验单', '换型、换色、换料和调机后的首件批准与留样', '20-首件检验确认单.docx'],
    ['生产过程巡检记录', '草高、密度、色差、背胶、幅宽和异常趋势控制', '21-过程巡检记录.docx'],
    [
      '成品入库与库位卡',
      '卷号、型号、色批、面积、质量状态和库位一致性',
      '22-成品入库与库位卡.docx',
    ],
    [
      '装箱单与卷号清单',
      '订单、卷号、色批、卷长、面积、装车和排版追溯',
      '23-装箱单与卷号清单.docx',
    ],
    [
      '铺装维护与质保手册',
      '储存、铺装、使用、维护、异常报修和质保边界',
      '24-铺装维护与质保手册.docx',
    ],
    [
      '投诉与不合格闭环单',
      '投诉、NCR、控制、根因、纠正预防和效果验证',
      '25-客户投诉与不合格闭环单.docx',
    ],
  ] as const) {
    const link = document.createElement('a');
    link.className = 'role-task';
    link.href = `/business-templates/${file}`;
    link.download = file;
    link.append(
      el('span', 'role-task-state', '正式模板'),
      el('strong', '', name),
      el('small', '', description),
      el('span', 'role-task-count', 'Word 可编辑文件'),
      el('span', 'role-task-action', '下载并填写 →'),
    );
    documentGrid.append(link);
  }
  documentLibrary.append(documentGrid);
  if (
    allPermissions.has('business-document:configure') ||
    allPermissions.has('business-document:audit')
  ) {
    const communicationAdmin = el('section', 'document-communication-admin');
    communicationAdmin.append(
      el('p', 'eyebrow', '管理员专属'),
      el('h2', '', '文档发送配置与审计'),
      el(
        'p',
        'muted',
        '第三方密钥不写入业务数据库；这里只维护连接器状态、发送身份和安全密钥引用。',
      ),
    );
    if (allPermissions.has('business-document:configure')) {
      const connectorGrid = el('div', 'document-connector-grid');
      renderDocumentConnectors(connectorGrid);
      communicationAdmin.append(el('h3', '', '发送与翻译连接器'), connectorGrid);
    }
    if (allPermissions.has('business-document:audit')) {
      const auditList = el('div', 'document-audit-list');
      auditList.append(el('p', 'operation-status', '正在加载逐用户文档日志…'));
      void onlineDocumentApi<{
        items: readonly Readonly<{
          id: string;
          occurredAt: string;
          action: string;
          outcome: string;
          actorName?: string;
          documentTitle?: string;
          targetId?: string;
          correlationId: string;
        }>[];
      }>('/api/v1/business-document-activity?limit=100')
        .then(({ items }) => {
          auditList.replaceChildren();
          if (items.length === 0) auditList.append(el('p', 'empty', '暂无文档操作日志'));
          for (const item of items) {
            const row = el('article', 'document-audit-row');
            row.append(
              el('strong', '', item.actorName ?? '系统用户'),
              el('span', '', item.action.replace('business-document.', '')),
              el('span', '', item.documentTitle ?? item.targetId ?? '文档配置'),
              el('time', '', new Date(item.occurredAt).toLocaleString('zh-CN')),
              el('small', '', `关联号 ${item.correlationId}`),
            );
            auditList.append(row);
          }
        })
        .catch((failure: unknown) => {
          auditList.replaceChildren(
            el('p', 'error', failure instanceof Error ? failure.message : '文档审计日志加载失败'),
          );
        });
      communicationAdmin.append(el('h3', '', '逐用户文档操作日志'), auditList);
    }
    documentLibrary.append(communicationAdmin);
  }
  content.append(documentLibrary);
  const permittedRoutes = visibleAppRoutes(allPermissions);
  const templateRoutes = Array.from(
    new Set(BUSINESS_DOCUMENT_TEMPLATES.flatMap((template) => template.routes)),
  ).filter((route) => permittedRoutes.has(route));
  for (const route of templateRoutes) {
    const routeTemplates = templatesForRoute(route);
    const contextualDocuments = el('section', 'panel contextual-documents');
    contextualDocuments.setAttribute('data-route-view', route);
    const contextualHead = el('div', 'panel-head contextual-documents-head');
    const contextualCopy = el('div');
    contextualCopy.append(
      el('p', 'eyebrow', '业务文件'),
      el('h2', '', `${APP_ROUTE_LABELS[route]}常用模板`),
      el(
        'p',
        'muted',
        route === 'technical-requirements'
          ? '选用模板后下载编辑，完成后在技术需求附件区回传并随版本冻结'
          : '按当前业务选择受控模板，下载编辑后作为本业务单据附件留存',
      ),
    );
    const libraryLink = document.createElement('a');
    libraryLink.className = 'text-button';
    libraryLink.href = '#/document-templates';
    libraryLink.textContent = '全部模板';
    contextualHead.append(contextualCopy, libraryLink);
    contextualDocuments.append(contextualHead);
    const subjectConfig = BUSINESS_DOCUMENT_SUBJECTS[route];
    const subjectSelect = el('select', 'business-document-subject-select');
    const subjectRecords = new Map<string, Record<string, unknown>>();
    subjectSelect.setAttribute('aria-label', '关联业务单据');
    subjectSelect.append(businessDocumentOption('不关联具体业务单据', ''));
    if (subjectConfig && allPermissions.has('business-document:manage')) {
      subjectSelect.append(businessDocumentOption('正在加载可关联业务…', ''));
      void onlineDocumentRead<
        readonly Record<string, unknown>[] | { items?: readonly Record<string, unknown>[] }
      >(subjectConfig.endpoint)
        .then((result) => {
          const items: readonly Record<string, unknown>[] = Array.isArray(result)
            ? (result as readonly Record<string, unknown>[])
            : ((result as { items?: readonly Record<string, unknown>[] }).items ?? []);
          subjectSelect.replaceChildren(businessDocumentOption('不关联具体业务单据', ''));
          for (const item of items.slice(0, 100)) {
            const id = typeof item.id === 'string' ? item.id : '';
            if (!id) continue;
            subjectRecords.set(id, item);
            subjectSelect.append(
              businessDocumentOption(
                businessDocumentSubjectLabel(item, subjectConfig.numberKeys),
                id,
              ),
            );
          }
        })
        .catch(() => {
          subjectSelect.replaceChildren(businessDocumentOption('业务单据加载失败，可稍后重试', ''));
        });
      contextualDocuments.append(subjectSelect);
    }
    const bindingValues = {
      customers: new Map<string, string>(),
      orders: new Map<string, Readonly<{ name: string; customerId: string }>>(),
      employees: new Map<string, string>(),
    };
    const bindingGrid = el('div', 'business-document-binding-grid');
    const bindingSelect = (label: string): HTMLSelectElement => {
      const select = el('select');
      select.setAttribute('aria-label', label);
      select.append(businessDocumentOption(`选择${label}`, ''));
      return select;
    };
    const customerBinding = bindingSelect('客户');
    const orderBinding = bindingSelect('销售订单');
    const operatorBinding = bindingSelect('经办人');
    const salespersonBinding = bindingSelect('业务员');
    const assigneeBinding = bindingSelect('下一处理人');
    if (allPermissions.has('business-document:manage')) {
      for (const [label, select] of [
        ['客户', customerBinding],
        ['销售订单', orderBinding],
        ['经办人', operatorBinding],
        ['业务员', salespersonBinding],
        ['下一处理人', assigneeBinding],
      ] as const) {
        const field = el('label', 'business-document-binding-field');
        field.append(el('span', '', label), select);
        bindingGrid.append(field);
      }
      contextualDocuments.append(bindingGrid);
      void onlineDocumentRead<{
        customers: readonly Readonly<{ id: string; name: string; number: string }>[];
        orders: readonly Readonly<{ id: string; name: string; customerId: string }>[];
        employees: readonly Readonly<{ id: string; name: string; number: string }>[];
      }>('/api/v1/business-documents/reference-data')
        .then((references) => {
          for (const customer of references.customers) {
            bindingValues.customers.set(customer.id, customer.name);
            customerBinding.append(
              businessDocumentOption(`${customer.number} · ${customer.name}`, customer.id),
            );
          }
          for (const order of references.orders) {
            bindingValues.orders.set(order.id, order);
            orderBinding.append(businessDocumentOption(order.name, order.id));
          }
          for (const employee of references.employees) {
            bindingValues.employees.set(employee.id, employee.name);
            for (const select of [operatorBinding, salespersonBinding, assigneeBinding])
              select.append(
                businessDocumentOption(`${employee.number} · ${employee.name}`, employee.id),
              );
          }
        })
        .catch(() => {
          bindingGrid.append(el('p', 'operation-status', '业务绑定数据加载失败，请刷新后重试'));
        });
      orderBinding.addEventListener('change', () => {
        const order = bindingValues.orders.get(orderBinding.value);
        if (order?.customerId) customerBinding.value = order.customerId;
      });
    }
    const contextualGrid = el('div', 'contextual-document-grid');
    const selectionStatus = el(
      'p',
      'operation-status contextual-document-status',
      '请选择本次业务需要的文件',
    );
    selectionStatus.setAttribute('aria-live', 'polite');
    for (const template of routeTemplates) {
      const card = el('article', 'contextual-document-card');
      card.append(
        el('span', 'role-task-state', '受控模板'),
        el('strong', '', template.name),
        el('small', '', template.description),
      );
      const actions = el('div', 'contextual-document-actions');
      const use = el('button', 'secondary compact', '下载 Word');
      use.type = 'button';
      const download = document.createElement('a');
      download.className = 'text-button';
      download.href = `/business-templates/${template.file}`;
      download.download = template.file;
      download.textContent = '仅下载';
      use.addEventListener('click', () => {
        for (const sibling of Array.from(contextualGrid.querySelectorAll('article')))
          sibling.classList.remove('selected');
        card.classList.add('selected');
        selectionStatus.textContent = `已下载“${template.name}”Word 交换文件`;
        selectionStatus.dataset.state = 'success';
        download.click();
      });
      if (allPermissions.has('business-document:manage')) {
        const online = el('button', 'primary compact', '新建在线文档');
        online.type = 'button';
        online.addEventListener('click', () => {
          online.disabled = true;
          setOperationStatus(selectionStatus, 'loading', `正在创建“${template.name}”…`);
          void onlineDocumentApi<OnlineBusinessDocument>('/api/v1/business-documents', {
            method: 'POST',
            body: JSON.stringify({
              templateKey: onlineTemplateKey(template, route),
              title: `${template.name} · ${new Date().toLocaleDateString('zh-CN')}`,
              route,
              ...(subjectConfig && subjectSelect.value
                ? { subjectType: subjectConfig.type, subjectId: subjectSelect.value }
                : {}),
              ...(customerBinding.value ? { customerId: customerBinding.value } : {}),
              ...(orderBinding.value ? { salesOrderId: orderBinding.value } : {}),
              ...(operatorBinding.value ? { operatorId: operatorBinding.value } : {}),
              ...(salespersonBinding.value ? { salespersonId: salespersonBinding.value } : {}),
              ...(assigneeBinding.value ? { assignedTo: assigneeBinding.value } : {}),
              content: {
                html: buildBusinessDocumentTemplateHtml(
                  template.file,
                  template.name,
                  template.description,
                  [
                    businessDocumentPrefill(subjectRecords.get(subjectSelect.value)),
                    customerBinding.value
                      ? `客户：${bindingValues.customers.get(customerBinding.value) ?? customerBinding.value}`
                      : '',
                    orderBinding.value
                      ? `销售订单：${bindingValues.orders.get(orderBinding.value)?.name ?? orderBinding.value}`
                      : '',
                    operatorBinding.value
                      ? `经办人：${bindingValues.employees.get(operatorBinding.value) ?? operatorBinding.value}`
                      : '',
                    salespersonBinding.value
                      ? `业务员：${bindingValues.employees.get(salespersonBinding.value) ?? salespersonBinding.value}`
                      : '',
                    assigneeBinding.value
                      ? `下一处理人：${bindingValues.employees.get(assigneeBinding.value) ?? assigneeBinding.value}`
                      : '',
                  ]
                    .filter(Boolean)
                    .join('\n'),
                  new Date().toLocaleDateString('zh-CN'),
                ),
              },
            }),
          })
            .then((created) => {
              setOperationStatus(selectionStatus, 'success', `已创建“${template.name}”在线文档 V1`);
              openOnlineDocumentEditor(
                created,
                {
                  manage: allPermissions.has('business-document:manage'),
                  approve: allPermissions.has('business-document:approve'),
                  send: allPermissions.has('business-document:send'),
                  translate: allPermissions.has('business-document:translate'),
                  configure: allPermissions.has('business-document:configure'),
                },
                (currentVersion) => {
                  online.disabled = false;
                  setOperationStatus(
                    selectionStatus,
                    'success',
                    `“${template.name}”已保存为 V${String(currentVersion)}；关闭编辑窗口后可在“已保存在线文档”中重新打开。`,
                  );
                },
              );
              online.disabled = false;
            })
            .catch((failure: unknown) => {
              online.disabled = false;
              setOperationStatus(
                selectionStatus,
                'error',
                failure instanceof Error ? failure.message : '在线文档创建失败',
              );
            });
        });
        actions.append(online);
      }
      actions.append(use, download);
      card.append(actions);
      contextualGrid.append(card);
    }
    if (allPermissions.has('business-document:read')) {
      const savedDocuments = el('div', 'business-document-register');
      savedDocuments.append(el('strong', '', '已保存在线文档'), el('span', 'muted', '正在加载…'));
      void onlineDocumentRead<{ items: readonly OnlineBusinessDocument[] }>(
        `/api/v1/business-documents?route=${encodeURIComponent(route)}`,
      )
        .then((result) => {
          savedDocuments.replaceChildren(el('strong', '', '已保存在线文档'));
          if (result.items.length === 0) {
            savedDocuments.append(el('span', 'muted', '暂无，选择上方模板新建'));
            return;
          }
          for (const item of result.items.slice(0, 8)) {
            const open = el(
              'button',
              'business-document-open',
              `${item.title} · V${String(item.currentVersion)}${item.assigneeName ? ` · 待办：${item.assigneeName}` : ''}`,
            );
            open.type = 'button';
            open.addEventListener('click', () => {
              open.disabled = true;
              void onlineDocumentApi<OnlineBusinessDocument>(
                `/api/v1/business-documents/${item.id}`,
              )
                .then((full) => {
                  openOnlineDocumentEditor(
                    full,
                    {
                      manage: allPermissions.has('business-document:manage'),
                      approve: allPermissions.has('business-document:approve'),
                      send: allPermissions.has('business-document:send'),
                      translate: allPermissions.has('business-document:translate'),
                      configure: allPermissions.has('business-document:configure'),
                    },
                    (currentVersion) => {
                      open.textContent = `${item.title} · V${String(currentVersion)}${item.assigneeName ? ` · 待办：${item.assigneeName}` : ''}`;
                      setOperationStatus(
                        selectionStatus,
                        'success',
                        `${item.title} 已保存为 V${String(currentVersion)}，仍保留在当前业务页的“已保存在线文档”。`,
                      );
                    },
                  );
                  open.disabled = false;
                })
                .catch((failure: unknown) => {
                  open.disabled = false;
                  setOperationStatus(
                    selectionStatus,
                    'error',
                    failure instanceof Error ? failure.message : '在线文档读取失败',
                  );
                });
            });
            savedDocuments.append(open);
          }
        })
        .catch((failure: unknown) => {
          savedDocuments.replaceChildren(
            el('strong', '', '已保存在线文档'),
            el('span', 'error', failure instanceof Error ? failure.message : '读取失败'),
          );
        });
      contextualDocuments.append(savedDocuments);
    }
    contextualDocuments.append(contextualGrid, selectionStatus);
    content.append(contextualDocuments);
  }
  const sectionHeader = el('div', 'section-heading');
  sectionHeader.append(el('div', '', '今日业务'), el('span', '', '数据实时来自业务台账'));
  sectionHeader.setAttribute('data-route-view', 'leads customers');
  content.append(sectionHeader);
  const split = el('section', 'split');
  split.setAttribute('data-route-view', 'leads customers');
  if (sections.customers) {
    const list = el('article', 'panel customer-list');
    list.setAttribute('data-route-view', 'customers');
    const listHead = el('div', 'panel-head');
    const listTitle = el('div');
    listTitle.append(
      el('h2', '', '重点客户'),
      el('p', 'muted', `${String(controller.customers.length)} 个可见客户`),
    );
    listHead.append(listTitle, el('button', 'text-button', '查看全部 →'));
    const filters = el('div', 'list-filters');
    const customerSearch = el('input', 'filter-search');
    customerSearch.type = 'search';
    customerSearch.placeholder = '搜索客户名称或编号';
    customerSearch.value = controller.customerQuery;
    customerSearch.addEventListener('input', () => {
      controller.customerQuery = customerSearch.value;
      controller.customerPage = 1;
      bootstrapView(shell, controller);
    });
    const statusFilter = el('select', 'filter-select');
    for (const [status, label] of [
      ['ALL', '全部状态'],
      ['PROSPECT', '潜在客户'],
      ['ACTIVE', '合作客户'],
      ['INACTIVE', '暂停合作'],
      ['ARCHIVED', '已归档'],
    ] as const) {
      const option = el('option', '', label);
      option.value = status;
      option.selected = controller.customerStatus === status;
      statusFilter.append(option);
    }
    statusFilter.addEventListener('change', () => {
      controller.customerStatus = statusFilter.value;
      controller.customerPage = 1;
      bootstrapView(shell, controller);
    });
    filters.append(customerSearch, statusFilter);
    list.append(listHead, filters);
    const visibleCustomers = controller.visibleCustomers();
    if (controller.customers.length === 0) {
      const empty = el('div', 'empty-state');
      empty.append(
        el('span', 'empty-icon', '◇'),
        el('strong', '', '还没有客户数据'),
        el('p', '', '新建第一个客户，开始沉淀线索、商机与跟进记录。'),
      );
      list.append(empty);
    } else if (visibleCustomers.length === 0) {
      list.append(el('p', 'empty filter-empty', '没有符合当前筛选条件的客户'));
    }
    for (const customer of controller.customerPageItems()) {
      const row = el('button', 'customer-row');
      row.append(
        el('span', 'avatar', customer.name?.slice(0, 1) ?? '?'),
        el('span', 'identity', customer.name ?? customer.id),
        el('span', 'status', customerStateLabel(customer.status)),
        el('span', 'owner', customer.ownerId ?? '未分配'),
      );
      row.addEventListener('click', () => {
        void controller.selectCustomer(customer.id).then(() => {
          bootstrapView(shell, controller);
        });
      });
      list.append(row);
    }
    if (visibleCustomers.length > 0)
      list.append(
        pagination(visibleCustomers.length, controller.customerPage, (page) => {
          controller.customerPage = page;
          bootstrapView(shell, controller);
        }),
      );
    split.append(list);
  }
  if (sections.customer360 && controller.selected) {
    const detail = el('article', 'panel detail');
    detail.setAttribute('data-route-view', 'customers');
    detail.append(
      el('p', 'eyebrow', '客户全景'),
      el('h2', '', controller.selected.customer.name),
      el(
        'p',
        'customer-identity',
        `${controller.selected.customer.customerNumber ?? '编号受限'} · ${customerStateLabel(controller.selected.customer.status)} · ${controller.selected.customer.ownerId ?? '未分配或负责人受限'}`,
      ),
      el(
        'p',
        'muted',
        `${String(controller.selected.contacts.length)} 联系人 · ${String(controller.selected.leads.length)} 线索 · ${String(controller.selected.opportunities.length)} 商机 · ${String(controller.selected.activities.length)} 活动`,
      ),
      customer360Content(controller.selected),
    );
    const ownershipPermission: CrmPermission =
      controller.selected.customer.ownerId === null
        ? 'customer-ownership:assign'
        : 'customer-ownership:reassign';
    const actions: readonly [CrmPermission, string][] = [
      ['customer:update', '添加联系人'],
      ['customer-activity:create', '记录活动'],
      ['customer:lifecycle', '变更状态'],
      [
        ownershipPermission,
        ownershipPermission === 'customer-ownership:assign' ? '分配客户' : '重新分配客户',
      ],
    ];
    for (const [permission, label] of actions)
      if (
        controller.permissions.has(permission) &&
        (permission !== 'customer:lifecycle' ||
          Number.isInteger(controller.selected.customer.version)) &&
        (!['customer-ownership:assign', 'customer-ownership:reassign'].includes(permission) ||
          (Number.isInteger(controller.selected.customer.version) &&
            controller.selected.customer.ownerId !== undefined))
      ) {
        const button = el('button', 'secondary', label);
        button.addEventListener('click', () => {
          const definitions: Record<string, { description: string; fields: readonly FormField[] }> =
            {
              添加联系人: {
                description: '联系人至少需要填写邮箱；联系方式会受字段权限保护。',
                fields: [
                  { name: 'first', label: '联系人姓名', required: true },
                  { name: 'second', label: '联系人邮箱', type: 'email', required: true },
                ],
              },
              记录活动: {
                description: '跟进记录会进入 Customer 360 活动时间线。',
                fields: [{ name: 'first', label: '活动摘要', type: 'textarea', required: true }],
              },
              变更状态: {
                description: '状态变更会保留原因、操作人和完整审计记录。',
                fields: [
                  {
                    name: 'first',
                    label: '目标状态',
                    type: 'select',
                    required: true,
                    options: [
                      { value: 'PROSPECT', label: '潜在客户' },
                      { value: 'ACTIVE', label: '合作客户' },
                      { value: 'INACTIVE', label: '暂停合作' },
                      { value: 'ARCHIVED', label: '归档' },
                    ],
                  },
                  { name: 'second', label: '变更原因', type: 'textarea', required: true },
                ],
              },
              分配客户: {
                description: '指定客户负责人并记录分配原因。',
                fields: [
                  employeeChoices.length > 0
                    ? {
                        name: 'first',
                        label: '负责人',
                        type: 'select',
                        required: true,
                        options: employeeChoices,
                      }
                    : { name: 'first', label: '负责人编号', required: true },
                  { name: 'second', label: '分配原因', required: true },
                ],
              },
              重新分配客户: {
                description: '改派操作会保留原负责人和新负责人记录。',
                fields: [
                  employeeChoices.length > 0
                    ? {
                        name: 'first',
                        label: '新负责人',
                        type: 'select',
                        required: true,
                        options: employeeChoices,
                      }
                    : { name: 'first', label: '新负责人编号', required: true },
                  { name: 'second', label: '改派原因', required: true },
                ],
              },
            };
          const definition = definitions[label];
          if (!definition) return;
          openForm(
            shell,
            label,
            definition.description,
            definition.fields,
            '确认提交',
            async (values) => {
              const action =
                label === '添加联系人'
                  ? 'contact'
                  : label === '记录活动'
                    ? 'activity'
                    : label === '变更状态'
                      ? 'lifecycle'
                      : 'ownership';
              await controller.mutateSelected(action, values.first ?? '', values.second ?? '');
              bootstrapView(shell, controller);
            },
          );
        });
        detail.append(button);
      }
    split.append(detail);
  }
  if (sections.leads) {
    const leads = el('article', 'panel lead-pool');
    leads.setAttribute('data-route-view', 'leads');
    const leadHeader = el('div', 'panel-head');
    leadHeader.append(el('h2', '', '线索公海'));
    if (controller.permissions.has('lead:create')) {
      const createLead = el('button', 'secondary', '新建线索');
      createLead.addEventListener('click', () => {
        openForm(
          shell,
          '新建线索',
          '线索默认进入公海，具备权限的销售人员可以认领。',
          [
            {
              name: 'title',
              label: '线索标题',
              required: true,
              placeholder: '例如：学校运动场改造项目',
              minLength: 2,
              maxLength: 160,
            },
            {
              name: 'source',
              label: '线索来源',
              type: 'select',
              required: true,
              options: [
                { value: '展会', label: '展会' },
                { value: '网站', label: '网站' },
                { value: '转介绍', label: '转介绍' },
                { value: '主动开发', label: '主动开发' },
              ],
            },
          ],
          '创建线索',
          async (values) => {
            await controller.createLead({
              title: values.title ?? '',
              source: values.source ?? '',
              customerId: null,
              pool: true,
            });
            bootstrapView(shell, controller);
          },
        );
      });
      leadHeader.append(createLead);
    }
    leads.append(leadHeader);
    const leadSearch = el('input', 'filter-search lead-search');
    leadSearch.type = 'search';
    leadSearch.placeholder = '搜索线索标题、来源或状态';
    leadSearch.value = controller.leadQuery;
    leadSearch.addEventListener('input', () => {
      controller.leadQuery = leadSearch.value;
      controller.leadPage = 1;
      bootstrapView(shell, controller);
    });
    leads.append(leadSearch);
    const visibleLeads = controller.visibleLeads();
    for (const lead of controller.leadPageItems()) {
      const row = el('div', 'lead-row', `${lead.title ?? lead.id} · ${lead.source ?? '—'}`);
      if (sections.leadClaim && lead.status === 'POOL' && Number.isInteger(lead.version)) {
        const claim = el('button', 'primary', '认领');
        claim.addEventListener('click', () => {
          void controller.claim(lead).then(() => {
            bootstrapView(shell, controller);
          });
        });
        row.append(claim);
      }
      if (controller.permissions.has('lead:lifecycle') && Number.isInteger(lead.version)) {
        const transition = el('button', 'secondary', '变更状态');
        transition.addEventListener('click', () => {
          openForm(
            shell,
            '变更线索状态',
            '线索状态变更将写入审计记录。',
            [
              {
                name: 'status',
                label: '目标状态',
                type: 'select',
                required: true,
                options: [
                  { value: 'QUALIFIED', label: '已确认' },
                  { value: 'DISQUALIFIED', label: '无效线索' },
                  { value: 'CONVERTED', label: '已转化' },
                ],
              },
              { name: 'reason', label: '变更原因', type: 'textarea', required: true },
            ],
            '确认变更',
            async (values) => {
              await controller.mutateLead(
                lead,
                'lifecycle',
                values.status ?? '',
                values.reason ?? '',
              );
              bootstrapView(shell, controller);
            },
          );
        });
        row.append(transition);
      }
      const assignmentPermission =
        lead.ownerId === undefined ? null : lead.ownerId === null ? 'lead:assign' : 'lead:reassign';
      if (
        assignmentPermission !== null &&
        controller.permissions.has(assignmentPermission) &&
        Number.isInteger(lead.version)
      ) {
        const assign = el('button', 'secondary', lead.ownerId === null ? '分配' : '改派');
        assign.addEventListener('click', () => {
          openForm(
            shell,
            lead.ownerId === null ? '分配线索' : '改派线索',
            '指定负责人并保留分配原因。',
            [
              employeeChoices.length > 0
                ? {
                    name: 'assigneeId',
                    label: '负责人',
                    type: 'select',
                    required: true,
                    options: employeeChoices,
                  }
                : { name: 'assigneeId', label: '负责人编号', required: true },
              { name: 'reason', label: '分配原因', type: 'textarea', required: true },
            ],
            '确认分配',
            async (values) => {
              await controller.mutateLead(
                lead,
                'assignment',
                values.assigneeId ?? '',
                values.reason ?? '',
              );
              bootstrapView(shell, controller);
            },
          );
        });
        row.append(assign);
      }
      if (
        typeof lead.ownerId === 'string' &&
        lead.status === 'CLAIMED' &&
        controller.permissions.has('lead-pool:release') &&
        Number.isInteger(lead.version)
      ) {
        const release = el('button', 'secondary', '释放公海');
        release.addEventListener('click', () => {
          openForm(
            shell,
            '释放至线索公海',
            '释放后其他具备权限的销售人员可以认领。',
            [{ name: 'reason', label: '释放原因', type: 'textarea', required: true }],
            '确认释放',
            async (values) => {
              await controller.mutateLead(lead, 'release', '', values.reason ?? '');
              bootstrapView(shell, controller);
            },
          );
        });
        row.append(release);
      }
      leads.append(row);
    }
    if (visibleLeads.length > 0)
      leads.append(
        pagination(visibleLeads.length, controller.leadPage, (page) => {
          controller.leadPage = page;
          bootstrapView(shell, controller);
        }),
      );
    if (visibleLeads.length === 0) {
      const queue = el('div', 'queue-list');
      for (const [title, detail, badge] of [
        ['待跟进线索', '暂无逾期线索', '0'],
        ['待提交技术需求', '技术需求等待确认', '0'],
        ['待审批报价', '价格与利润率检查', '0'],
      ]) {
        const item = el('div', 'queue-item');
        item.append(el('span', 'queue-status'), el('div', 'queue-copy', title));
        item.append(el('small', '', detail), el('b', '', badge));
        queue.append(item);
      }
      leads.append(queue);
    }
    split.append(leads);
  }
  content.append(split);
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

function bootstrapView(current: HTMLElement, controller: CrmController): void {
  current.replaceWith(createCrmShell(controller));
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
      workspace.replaceWith(governanceWorkspace(controller));
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
  root.replaceChildren(shell);
}
