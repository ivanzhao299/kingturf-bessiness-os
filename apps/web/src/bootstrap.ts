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
  | 'traceability:read';
export type Viewport = 'desktop' | 'tablet' | 'mobile';

export type AppRoute =
  | 'overview'
  | 'sales-workspace'
  | 'operations-workspace'
  | 'crm'
  | 'opportunity-ctr'
  | 'cost-quote'
  | 'contract-order'
  | 'ar-payment'
  | 'planning-production'
  | 'quality-warehouse'
  | 'delivery-evidence'
  | 'governance';

export const APP_ROUTE_LABELS: Readonly<Record<AppRoute, string>> = {
  overview: '经营总览',
  'sales-workspace': '销售工作台',
  'operations-workspace': '运营工作台',
  crm: '线索与客户',
  'opportunity-ctr': '商机与技术需求',
  'cost-quote': '成本与报价',
  'contract-order': '合同与订单',
  'ar-payment': '应收与回款',
  'planning-production': '计划与生产',
  'quality-warehouse': '质量与仓储',
  'delivery-evidence': '交付与证据',
  governance: '系统管理与治理',
};
const APP_ROUTE_DESCRIPTIONS: Readonly<Record<AppRoute, string>> = {
  overview: '指标、待办与经营异常',
  'sales-workspace': '商机、订单与回款风险',
  'operations-workspace': '计划、生产与交付协同',
  crm: '线索、客户与跟进记录',
  'opportunity-ctr': '商机阶段与技术需求',
  'cost-quote': '成本、政策与报价审批',
  'contract-order': '信用、合同与订单履约',
  'ar-payment': '应收、回款、催收与风险',
  'planning-production': '主数据、物料需求与生产执行',
  'quality-warehouse': '检验、库存与批次追溯',
  'delivery-evidence': '放行、物流与签收证据',
  governance: '组织、权限与平台配置',
};

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
    description: '维护公司范围内的组织层级、区域、部门和团队。',
    readPermission: 'organization:read',
    managePermission: 'organization:create',
    paths: ['/api/v1/organizations'],
    disposition: 'USER_FACING',
  },
  {
    id: 'employees',
    title: '员工与身份基础',
    description: '维护员工所属组织和有效状态；账号授权在独立身份权限模块完成。',
    readPermission: 'employee:read',
    managePermission: 'employee:create',
    paths: ['/api/v1/employees'],
    disposition: 'USER_FACING',
  },
  {
    id: 'identity-access',
    title: '身份、角色与授权',
    description: '角色、权限、授权、人员角色和数据范围的统一管理入口。',
    readPermission: 'authorization:read',
    managePermission: 'authorization:manage',
    paths: [
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
    description: '按人员、动作、对象和关联编号查询不可变审计事件。',
    readPermission: 'audit:read',
    paths: ['/api/v1/audit-events'],
    disposition: 'USER_FACING',
  },
  {
    id: 'master-data',
    title: '主数据',
    description: '维护带生效区间的分类和条目，变更由审计记录保护。',
    readPermission: 'master-data:read',
    managePermission: 'master-data:create',
    paths: ['/api/v1/master-data/categories', '/api/v1/master-data/entries'],
    disposition: 'USER_FACING',
  },
  {
    id: 'numbering',
    title: '编号规则',
    description: '管理业务编号、版本、发布状态和受控分配。',
    readPermission: 'number:read',
    managePermission: 'number:create',
    paths: ['/api/v1/number-definitions'],
    disposition: 'USER_FACING',
  },
  {
    id: 'rules',
    title: '业务规则',
    description: '管理规则版本、发布状态和可解释规则试算。',
    readPermission: 'rule:read',
    managePermission: 'rule:create',
    paths: ['/api/v1/rules'],
    disposition: 'USER_FACING',
  },
  {
    id: 'workflow',
    title: '工作流与待办',
    description: '维护流程定义并处理当前账号职责范围内的审批任务。',
    readPermission: 'workflow:read',
    managePermission: 'workflow:create',
    paths: ['/api/v1/workflows', '/api/v1/workflow-tasks'],
    disposition: 'USER_FACING',
  },
  {
    id: 'notifications',
    title: '通知中心',
    description: '查看未读通知并维护本人可用的通知偏好。',
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
    description: '查看业务对象定义；附件上传继续由具体业务单据入口承载。',
    readPermission: 'business-object:read',
    managePermission: 'business-object:manage',
    paths: ['/api/v1/business-objects'],
    disposition: 'USER_FACING',
  },
  {
    id: 'event-operations',
    title: '事件运行状态',
    description: '查看事件积压与失败数量；认领、重试和死信操作仅供受控运行器使用。',
    readPermission: 'event:operate',
    paths: ['/api/v1/operations/events'],
    disposition: 'SUPPORTING',
  },
] as const;

export const visibleGovernanceSurfaces = (permissions: ReadonlySet<string>) =>
  GOVERNANCE_SURFACES.filter(
    (surface) =>
      permissions.has(surface.readPermission) ||
      (surface.managePermission !== undefined && permissions.has(surface.managePermission)),
  );

const hasPermissionPrefix = (permissions: ReadonlySet<string>, prefixes: readonly string[]) =>
  [...permissions].some((permission) => prefixes.some((prefix) => permission.startsWith(prefix)));

export function visibleAppRoutes(permissions: ReadonlySet<string>): ReadonlySet<AppRoute> {
  const routes = new Set<AppRoute>();
  if (permissions.has('executive-dashboard:read')) routes.add('overview');
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
      'cost:',
      'sales-policy:',
      'quote:',
      'credit:',
      'contract:',
      'sales-order:',
      'order-360:',
      'order-360:',
      'ar:',
      'bank-payment:',
      'reconciliation:',
      'commission:',
      'commission-policy:',
      'risk:',
      'risk-policy:',
      'collection:',
      'legal-case:',
      'debt-evidence:',
    ])
  )
    routes.add('sales-workspace');
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
      'quality:',
      'quality-plan:',
      'traceability:',
      'shipment:',
    ])
  )
    routes.add('operations-workspace');
  if (hasPermissionPrefix(permissions, ['customer:', 'customer-', 'lead:', 'lead-']))
    routes.add('crm');
  if (hasPermissionPrefix(permissions, ['opportunity:', 'ctr:', 'technical-solution:']))
    routes.add('opportunity-ctr');
  if (hasPermissionPrefix(permissions, ['cost-model:', 'cost:', 'sales-policy:', 'quote:']))
    routes.add('cost-quote');
  if (hasPermissionPrefix(permissions, ['credit:', 'contract:', 'sales-order:', 'order-360:']))
    routes.add('contract-order');
  if (
    hasPermissionPrefix(permissions, [
      'ar:',
      'bank-payment:',
      'reconciliation:',
      'commission:',
      'commission-policy:',
      'risk:',
      'risk-policy:',
      'collection:',
      'legal-case:',
      'debt-evidence:',
    ])
  )
    routes.add('ar-payment');
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
    routes.add('planning-production');
  if (hasPermissionPrefix(permissions, ['quality:', 'quality-plan:', 'traceability:']))
    routes.add('quality-warehouse');
  if (hasPermissionPrefix(permissions, ['shipment:'])) routes.add('delivery-evidence');
  if (visibleGovernanceSurfaces(permissions).length > 0) routes.add('governance');
  if (routes.size > 0) routes.add('overview');
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
    costExplanation: permissions.has('cost:read'),
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
  ['pileHeightMm', '草高（mm）'],
  ['quantitySquareMeters', '预计面积（㎡）'],
  ['color', '颜色要求'],
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
  REJECTED: '已驳回',
  RELEASED: '已放行',
  REQUESTED: '待受理',
  SAMPLED: '已抽样',
  SIGNED: '已签署',
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

const businessStateLabel = (value: unknown, fallback = '状态受限'): string => {
  const code = textValue(value, fallback);
  return BUSINESS_STATE_LABELS[code] ?? code;
};

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
  get?(path: string): Promise<Record<string, unknown>>;
  submit(
    path: string,
    payload: Record<string, unknown>,
    method?: 'POST' | 'PATCH',
  ): Promise<Record<string, unknown>>;
  uploadCtrAttachment(versionId: string, file: File): Promise<Record<string, unknown>>;
  command(
    revisionId: string,
    action: 'approve' | 'issue',
    payload?: Record<string, unknown>,
  ): Promise<Record<string, unknown>>;
}>;

export class CommercialController {
  public opportunities: readonly Opportunity[] = [];
  public customers: readonly Customer[] = [];
  public employees: readonly Employee[] = [];
  public loading = false;
  public message = '';
  public revisionState: Record<string, unknown> | null = null;
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
      this.opportunities = this.permissions.has('opportunity:read')
        ? await this.api.listOpportunities()
        : [];
      const readable = [
        ['ctr:read', '/api/v1/ctrs'],
        ['technical-solution:read', '/api/v1/technical-solutions'],
        ['cost-model:read', '/api/v1/cost-models'],
        ['cost:read', '/api/v1/cost-evaluations'],
        ['sales-policy:read', '/api/v1/sales-policies'],
        ['sales-policy:read', '/api/v1/sales-policy-evaluations'],
        ['quote:read', '/api/v1/quotes'],
        ['credit:read', '/api/v1/credit-limits'],
        ['credit:read', '/api/v1/credit-decisions'],
        ['contract:read', '/api/v1/contracts'],
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
        ['shipment:read', '/api/v1/shipment-releases'],
        [
          this.permissions.has('collection:read') ? 'collection:read' : 'legal-case:read',
          '/api/v1/collection-cases',
        ],
      ] as const;
      const readableViews = readable.filter(([permission]) => this.permissions.has(permission));
      const loadedViews = await Promise.all(
        readableViews.map(async ([, path]) => [path, await this.api.list(path)] as const),
      );
      for (const [path, value] of loadedViews) this.views.set(path, value);
      if (
        this.api.get &&
        this.permissions.has('order-360:read') &&
        this.permissions.has('sales-order:read')
      ) {
        const get = this.api.get;
        await Promise.all(
          (this.views.get('/api/v1/sales-orders') ?? []).map(async (order) => {
            if (typeof order.id !== 'string') return;
            this.order360.set(order.id, await get(`/api/v1/sales-orders/${order.id}/360`));
          }),
        );
      }
      if (this.api.get && this.permissions.has('executive-dashboard:read')) {
        const year = new Date().getUTCFullYear();
        const query = new URLSearchParams({
          from: `${String(year)}-01-01T00:00:00.000Z`,
          to: `${String(year + 1)}-01-01T00:00:00.000Z`,
          currency: 'CNY',
        });
        this.dashboard = await this.api.get(`/api/v1/executive-dashboard?${query.toString()}`);
      }
      this.message = `已加载 ${String(this.opportunities.length)} 个商机`;
    } finally {
      this.loading = false;
    }
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
  workspace.setAttribute('aria-label', 'Commercial workspace');
  const status = document.createElement('p');
  status.className = 'commercial-status';
  status.setAttribute('role', 'status');
  status.setAttribute(
    'data-route-view',
    'sales-workspace operations-workspace opportunity-ctr cost-quote contract-order ar-payment planning-production quality-warehouse delivery-evidence',
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
    flow.setAttribute('data-route-view', 'contract-order');
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
    flow.setAttribute('data-route-view', 'cost-quote');
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
    queue.setAttribute('data-route-view', 'ar-payment');
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
        `${recordText(filters, 'currency', 'currency', 'CNY')} · ${recordText(filters, 'from', 'from').slice(0, 10)} 至 ${recordText(filters, 'to', 'to').slice(0, 10)} · 刷新 ${recordText(dashboard, 'refreshedAt', 'refreshedAt').slice(0, 16).replace('T', ' ')}`,
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
    orderList.append(el('h3', '', '订单贡献下钻'));
    for (const order of orders)
      orderList.append(
        el(
          'p',
          '',
          `${recordText(order, 'orderNumber', 'orderNumber')} · ${recordText(filters, 'currency', 'currency')} ${recordText(order, 'total', 'total')} · 毛利 ${recordText(order, 'margin', 'margin')}`,
        ),
      );
    riskList.append(el('h3', '', '风险责任下钻'));
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
    const orders = controller.views.get('/api/v1/production-orders') ?? [];
    const refresh = async () => {
      await controller.load();
      status.textContent = controller.message;
    };
    panel.append(
      el('p', 'eyebrow', '车间执行'),
      el('h2', '', '生产工单与车间执行'),
      el(
        'p',
        'commercial-help',
        '从已下达物料需求建议建立工单，固定工艺快照，贯通领退料、工序报工、成品卷号和库存收货。',
      ),
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
        el('span', `ctr-state state-${state.toLowerCase()}`, state),
        el(
          'p',
          '',
          `计划 ${recordText(order, 'plannedQuantity', 'planned_quantity')} · ${recordText(order, 'plannedStartAt', 'planned_start_at')} → ${recordText(order, 'plannedDueAt', 'planned_due_at')}`,
        ),
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
      el(
        'p',
        'commercial-help',
        '冻结材料计价、人工和制造费用费率，按生产工单对比计划与实际成本；核算与审批职责强制分离。',
      ),
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
              { name: 'currency', label: '币种', required: true, value: 'CNY' },
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
    for (const run of runs) {
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
      );
      if (
        permissions.has('manufacturing-cost:approve') &&
        recordText(run, 'state', 'state') === 'CALCULATED'
      ) {
        const approve = el('button', 'primary', '批准成本');
        approve.addEventListener('click', () => {
          void (async () => {
            await controller.submit(`/api/v1/production-cost-runs/${String(run.id)}/approve`, {
              reason: '成本差异复核通过',
              evidence: { channel: 'WEB-UAT' },
              idempotencyKey: `APPROVE-${String(run.id)}`,
            });
            await controller.load();
            status.textContent = controller.message;
          })();
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
      el(
        'p',
        'commercial-help',
        '合同、信用、收款、逾期、订单来源、质量、生产、成本和库存九类门禁自动冻结；例外审批、仓库放行、承运轨迹与签收回单形成同一证据链。',
      ),
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
    const grid = el('div', 'production-order-grid');
    for (const release of releases) {
      const state = recordText(release, 'state', 'state');
      const snapshot = (release.gate_snapshot ?? release.gateSnapshot ?? {}) as Record<
        string,
        unknown
      >;
      const failures = Array.isArray(snapshot.failures) ? snapshot.failures.join('、') : '无';
      const card = el('article', 'production-order-card');
      card.append(
        el('h3', '', `${recordText(release, 'request_number', 'requestNumber')} · ${state}`),
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
      );
      const action = async (
        path: string,
        reason: string,
        evidence: Record<string, unknown>,
        key: string,
      ) => {
        await controller.submit(path, { reason, evidence, idempotencyKey: key });
        await controller.load();
        status.textContent = controller.message;
      };
      if (state === 'EXCEPTION_PENDING' && permissions.has('shipment:approve-exception')) {
        const approve = el('button', 'primary', '批准例外');
        approve.addEventListener(
          'click',
          () =>
            void action(
              `/api/v1/shipment-releases/${String(release.id)}/approve-exception`,
              '例外风险已复核',
              { channel: 'WEB-UAT' },
              `SHIP-EX-${String(release.id)}`,
            ),
        );
        card.append(approve);
      }
      if ((state === 'READY' || state === 'APPROVED') && permissions.has('shipment:release')) {
        const releaseButton = el('button', 'primary', '执行仓库放行');
        releaseButton.addEventListener(
          'click',
          () =>
            void action(
              `/api/v1/shipment-releases/${String(release.id)}/release`,
              '仓库复核后放行',
              { channel: 'WEB-UAT' },
              `SHIP-REL-${String(release.id)}`,
            ),
        );
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
            ],
            '确认发车',
            async (values) => {
              await controller.submit(`/api/v1/shipment-releases/${String(release.id)}/dispatch`, {
                ...values,
                evidence: { channel: 'WEB-UAT' },
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
                { value: 'CNY', label: '人民币 CNY' },
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
                pileHeightMm: Number(values.pileHeight ?? 0),
                quantitySquareMeters: Number(values.quantity ?? 0),
                color: values.color ?? '',
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
                  pileHeightMm: Number(values.pileHeight ?? 0),
                  quantitySquareMeters: Number(values.quantity ?? 0),
                  color: values.color ?? '',
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
    solutionCopy.append(
      el('h2', '', '技术方案'),
      el('p', '', '将产品规格和工程假设固定到明确的技术需求版本，保留修订差异。'),
    );
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
        label: '纤度（Dtex）',
        type: 'number',
        required: true,
        value: formValue(specification.dtex),
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
        stitchRate: Number(values.stitchRate ?? 0),
        backing: values.backing ?? '',
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
        ['dtex', '纤度（Dtex）'],
        ['stitchRate', '簇密度'],
        ['backing', '底布系统'],
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
  if (controller && permissions.has('cost:read')) {
    const costPanel = el('section', 'decision-workbench cost-workbench');
    const costHeading = el('div', 'pipeline-heading');
    const costCopy = el('div');
    costCopy.append(
      el('h2', '', '成本核算'),
      el('p', '', '固定模型、技术方案和成本行输入，输出可复核的规则轨迹与输入哈希。'),
    );
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
                { value: 'CNY', label: '人民币 CNY' },
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
          `${textValue(model.name, '')} · ${textValue(model.currency, 'CNY')} · ${String(rules.length)} 条规则`,
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
    policyCopy.append(
      el('h2', '', '销售政策评估'),
      el('p', '', '用版本化利润率和折扣红线生成通过、审批要求与命中理由。'),
    );
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
    quoteCopy.append(
      el('h2', '', '销售报价'),
      el('p', '', '从成本决策生成行项目，实时计算折扣、毛利并执行销售政策。'),
    );
    const costs = controller.views.get('/api/v1/cost-evaluations') ?? [];
    const policies = (controller.views.get('/api/v1/sales-policies') ?? []).filter(
      (item) => item.status === 'PUBLISHED',
    );
    const solutions = controller.views.get('/api/v1/technical-solutions') ?? [];
    const ctrs = controller.views.get('/api/v1/ctrs') ?? [];
    if (permissions.has('quote:create') && costs.length > 0 && policies.length > 0) {
      const createQuote = el('button', 'primary', '＋ 新建报价');
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
            await controller.load();
            status.textContent = controller.message;
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
    copy.append(
      el('h2', '', '信用审查'),
      el('p', '', '按客户额度、应收、未开票订单和未分配收款计算真实信用敞口。'),
    );
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
                { value: 'CNY', label: '人民币 CNY' },
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
                label: `${recordText(item, 'currency', 'currency', 'CNY')} ${recordText(item, 'amount', 'amount', '—')} · ${recordText(item, 'expiresAt', 'expires_at', '').slice(0, 10)}`,
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
    copy.append(
      el('h2', '', '合同与签署'),
      el('p', '', '合同修订固定引用已签发报价快照，签署回执与载荷哈希只读保存。'),
    );
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
    copy.append(
      el('h2', '', '订单释放'),
      el('p', '', '订单同时锁定已签发报价、有效信用审批和已签合同，避免商务依据漂移。'),
    );
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
      el('p', '', '从已释放订单下钻报价、成本、信用、合同、应收、回款、佣金与异常。'),
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
    for (const aggregate of controller.order360.values()) {
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
          `${recordText(event, 'occurredAt', 'occurredAt').slice(0, 16).replace('T', ' ')} · ${businessEventLabel(type)} · ${recordText(event, 'label', 'label')}`,
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
    copy.append(
      el('h2', '', '应收与账龄'),
      el('p', '', '应收余额由发票和核销分配实时推导，不允许人工改写。'),
    );
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
        el('p', 'eyebrow', recordText(item, 'documentNumber', 'document_number', 'AR')),
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
    copy.append(
      el('h2', '', '催收与法务证据'),
      el('p', '', '逾期案件、付款承诺、法务移交与债权证据。'),
    );
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
                      label: recordText(item, 'currency', 'currency', 'CNY'),
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
    copy.append(
      el('h2', '', '收款与核销'),
      el('p', '', '银行原始载荷留痕；核销按稳定顺序匹配同客户、同币种开放项。'),
    );
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
                { value: 'CNY', label: '人民币 CNY' },
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
    copy.append(
      el('h2', '', '佣金引擎与不可变台账'),
      el('p', '', '佣金由订单收入、报价毛利和实时回款推导；冻结、释放、支付与追回保留完整证据。'),
    );
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
    const cases = controller.views.get('/api/v1/commissions') ?? [];
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
      el('p', 'eyebrow', 'RISK ENGINE V1'),
      el('h2', '', '风险评价与责任任务'),
      el('p', '', '规则版本、规范输入、命中原因和处理事件均由服务器留痕。'),
    );
    heading.append(copy);
    panel.append(heading);
    if (riskPolicyControls) panel.append(riskPolicyControls);
    const list = el('div', 'risk-list');
    for (const evaluation of controller.views.get('/api/v1/risk-evaluations') ?? []) {
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
                    `${textValue(finding.code, '')}：实际 ${recordText(finding, 'actual', 'amount', '—')} / 门槛 ${recordText(finding, 'threshold', 'graceDays', '—')}`,
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
      el('p', 'eyebrow', 'MANUFACTURING MASTER DATA'),
      el('h2', '', '制造主数据工作台'),
      el('p', 'commercial-help', '物料、BOM 与工艺路线按版本发布；已发布结构保持不可变。'),
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
      el('p', 'eyebrow', 'SOURCE TO STOCK'),
      el('h2', '', '供应商、采购与批次库存'),
      el(
        'p',
        'commercial-help',
        '从供应商准入、询报价、采购签发到批次收货；库存只由不可变移动台账推导。',
      ),
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
      const createRfq = el('button', 'secondary', '＋ 新建并发出 RFQ');
      createRfq.addEventListener('click', () => {
        openForm(
          workspace,
          '创建采购询价',
          '选择已发布物料版本并明确数量、交期和报价截止时间。',
          [
            { name: 'rfqNumber', label: 'RFQ 编号', required: true },
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
          '发出 RFQ',
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
          '报价必须引用已发出 RFQ、有效准入供应商和精确询价行。',
          [
            {
              name: 'rfqLine',
              label: 'RFQ 行',
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
      orderPanel.append(
        el(
          'div',
          'procurement-card purchase-order-card',
          `${recordText(order, 'poNumber', 'po_number')} · ${businessStateLabel(recordText(order, 'status', 'status'))}\n${recordText(order, 'supplierName', 'supplierName')} · 人民币 ${decimalValue(total)} · ${String(lines.length)} 项`,
        ),
      );
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
        `${recordText(balance, 'sku', 'sku')} · 批次 ${recordText(balance, 'lotNumber', 'lotNumber')}\n${recordText(balance, 'locationCode', 'locationCode')} · 结存 ${recordText(balance, 'quantity', 'quantity')} · ${recordText(balance, 'qualityStatus', 'qualityStatus')} · ${String(movements.length)} 笔移动`,
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
      el('p', 'eyebrow', 'EXPLAINABLE MATERIAL PLANNING'),
      el('h2', '', '物料需求与建议审批'),
      el(
        'p',
        'commercial-help',
        '递归展开已发布 BOM，按时间抵扣合格库存和在途采购，并应用安全库存、批量、交期与冻结窗口。',
      ),
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
          `${recordText(policy, 'sku', 'sku')} · ${recordText(policy, 'makeOrBuy', 'make_or_buy')}\n安全库存 ${recordText(policy, 'safetyStock', 'safety_stock')} · MOQ ${recordText(policy, 'minimumOrderQuantity', 'minimum_order_quantity')} · 倍数 ${recordText(policy, 'orderMultiple', 'order_multiple')} · 提前 ${recordText(policy, 'leadTimeDays', 'lead_time_days')} 天`,
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
      const proposalGrid = el('div', 'mrp-proposal-grid');
      for (const proposal of proposals) {
        const explanation = recordValue(proposal.explanation),
          state = recordText(proposal, 'effectiveState', 'effectiveState'),
          card = el('article', `mrp-proposal-card ${proposal.frozen === true ? 'frozen' : ''}`);
        card.append(
          el(
            'strong',
            '',
            `${recordText(proposal, 'sku', 'sku')} · ${recordText(proposal, 'proposalType', 'proposal_type')}`,
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
            void controller
              .submit(`/api/v1/mrp-proposals/${String(proposal.id)}/release`, {
                reason: '计划员从工作台释放',
                evidence: { releasedAt: new Date().toISOString() },
              })
              .then(refresh);
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
      permissions.has('traceability:read'))
  ) {
    const panel = el('section', 'quality-workbench');
    panel.setAttribute('data-testid', 'quality-workbench');
    panel.append(
      el('p', 'eyebrow', 'QUALITY & WAREHOUSE'),
      el('h2', '', '质量检验与批次追溯'),
      el(
        'p',
        'commercial-help',
        '检验计划、抽检结果和批次放行均通过服务器状态机；质量状态直接约束库存与生产领料。',
      ),
    );
    const plans = controller.views.get('/api/v1/quality-plans') ?? [];
    const inspections = controller.views.get('/api/v1/quality-inspections') ?? [];
    const lots = controller.views.get('/api/v1/lot-traceability') ?? [];
    const refresh = async () => {
      await controller.load();
      status.textContent = controller.message;
    };
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
          `${recordText(plan, 'inspectionStage', 'inspection_stage')} · ${characteristics.map((item) => recordText(item, 'name', 'name')).join('、') || '暂无特性'}`,
        ),
      );
      if (
        permissions.has('quality-plan:manage') &&
        recordText(plan, 'status', 'status') === 'DRAFT' &&
        typeof plan.id === 'string'
      ) {
        const publish = el('button', 'secondary', '发布计划');
        publish.addEventListener('click', () => {
          void controller
            .submit(`/api/v1/quality-plans/${plan.id as string}/publish`, {})
            .then(refresh);
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
    for (const inspection of inspections) {
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
        el('span', `ctr-state state-${state.toLowerCase()}`, state),
        el(
          'p',
          'muted',
          `${recordText(inspection, 'planCode', 'plan_code')} · ${String(results.length)} 项结果 · ${String(events.length)} 条状态证据`,
        ),
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
            `${recordText(lot, 'lotNumber', 'lotNumber')} · ${recordText(lot, 'sku', 'sku')} · ${recordText(lot, 'qualityStatus', 'qualityStatus')}\n使用工单 ${String(used)} · 成品卷 ${String(produced)} · 移动 ${String(Array.isArray(lot.movements) ? lot.movements.length : 0)} 笔`,
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
    'pipeline-board': 'sales-workspace opportunity-ctr',
    'ctr-workbench': 'sales-workspace opportunity-ctr',
    'solution-workbench': 'sales-workspace opportunity-ctr',
    'cost-workbench': 'sales-workspace cost-quote',
    'policy-workbench': 'sales-workspace cost-quote',
    'quote-workbench': 'sales-workspace cost-quote',
    'credit-workbench': 'sales-workspace contract-order',
    'contract-workbench': 'sales-workspace contract-order',
    'order-workbench': 'sales-workspace contract-order',
    'order-360-workbench': 'sales-workspace contract-order',
    'ar-workbench': 'sales-workspace ar-payment',
    'payment-workbench': 'sales-workspace ar-payment',
    'commission-workbench': 'sales-workspace ar-payment',
    'risk-workbench': 'sales-workspace ar-payment',
    'collection-workbench': 'sales-workspace ar-payment',
    'manufacturing-workbench': 'operations-workspace planning-production',
    'procurement-workbench': 'operations-workspace planning-production',
    'mrp-workbench': 'operations-workspace planning-production',
    'production-workbench': 'operations-workspace planning-production',
    'quality-workbench': 'operations-workspace quality-warehouse',
    'shipment-workbench': 'operations-workspace delivery-evidence',
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
      '服务器从 AR 与未分配收款计算敞口，显示审批及到期状态',
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
    request.setAttribute('aria-label', `${title} JSON 请求`);
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
          throw new Error('请求必须是 JSON 对象');
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
    'opportunity-pipeline': 'sales-workspace opportunity-ctr',
    'ctr-revisions': 'sales-workspace opportunity-ctr',
    'technical-solution-history': 'sales-workspace opportunity-ctr',
    'cost-explanation': 'sales-workspace cost-quote',
    'policy-explanation': 'sales-workspace cost-quote',
    'quote-builder': 'sales-workspace cost-quote',
    'credit-review': 'sales-workspace contract-order',
    'contract-evidence': 'sales-workspace contract-order',
    'order-release': 'sales-workspace contract-order',
    'ar-aging': 'sales-workspace ar-payment',
    'payment-intake': 'sales-workspace ar-payment',
    reconciliation: 'sales-workspace ar-payment',
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
    return (await json<{ items: readonly Record<string, unknown>[] }>(path, token)).items;
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
  command: (revisionId, action, payload = {}) =>
    json<Record<string, unknown>>(`/api/v1/quote-revisions/${revisionId}/${action}`, token, {
      method: 'POST',
      headers: { 'idempotency-key': requestId() },
      body: JSON.stringify(payload),
    }),
});

const requestId = () => globalThis.crypto.randomUUID();
export type OperationState = 'idle' | 'loading' | 'success' | 'error';
export function setOperationStatus(target: HTMLElement, state: OperationState, message = ''): void {
  target.textContent = message;
  target.dataset.state = state;
  if (state === 'loading') target.setAttribute('aria-busy', 'true');
  else target.removeAttribute('aria-busy');
}
async function json<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set('content-type', 'application/json');
  headers.set('x-correlation-id', requestId());
  if (token) headers.set('authorization', `Bearer ${token}`);
  const response = await fetch(path, {
    ...init,
    credentials: 'same-origin',
    headers,
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as {
      message?: string;
      error?: { message?: string };
    };
    throw new Error(
      body.error?.message ?? body.message ?? `Request failed (${String(response.status)})`,
    );
  }
  return (response.status === 204 ? undefined : await response.json()) as T;
}
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

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
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
  options?: readonly Readonly<{ value: string; label: string }>[];
}>;
function openForm(
  host: HTMLElement,
  title: string,
  description: string,
  fields: readonly FormField[],
  submitLabel: string,
  onSubmit: (values: Readonly<Record<string, string>>) => Promise<void>,
): void {
  const dialog = el('dialog', 'form-dialog');
  const form = el('form', 'entity-form');
  form.setAttribute('method', 'dialog');
  const heading = el('div', 'dialog-heading');
  heading.append(
    el('p', 'eyebrow', '业务流程'),
    el('h2', '', title),
    el('p', 'muted', description),
  );
  form.append(heading);
  for (const field of fields) {
    const label = el('label', 'form-field');
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
    const placeholder = shell.querySelector<HTMLElement>('[data-route-placeholder]');
    if (!placeholder) return;
    const hasView = Array.from(shell.querySelectorAll<HTMLElement>('[data-route-view]')).some(
      (view) => !view.hidden && (view.dataset.routeView ?? '').split(/\s+/u).includes(route),
    );
    placeholder.hidden = hasView;
    placeholder.textContent = `${APP_ROUTE_LABELS[route]}：该模块已纳入产品导航，当前版本尚未提供可操作工作台。API 与权限不会被前端绕过。`;
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

function installWorkspaceListTools(shell: HTMLElement): void {
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
    if (sourceItems.length < 2 || list.dataset.listTools === 'true' || !list.parentElement)
      continue;
    list.dataset.listTools = 'true';
    const tools = el('div', 'workspace-list-tools');
    const search = el('input', 'filter-search');
    search.type = 'search';
    search.placeholder = '在当前列表中搜索';
    search.setAttribute('aria-label', '在当前业务列表中搜索');
    const count = el('span', 'workspace-list-count', `共 ${String(sourceItems.length)} 条`);
    const sort = el('button', 'secondary compact-action', '排序：业务顺序');
    sort.type = 'button';
    const reset = el('button', 'secondary compact-action', '重置');
    reset.type = 'button';
    const applySearch = () => {
      const query = search.value.trim().toLocaleLowerCase('zh-CN');
      let visible = 0;
      for (const item of sourceItems) {
        item.hidden =
          query.length > 0 && !item.textContent.toLocaleLowerCase('zh-CN').includes(query);
        if (!item.hidden) visible += 1;
      }
      count.textContent =
        query.length > 0
          ? `显示 ${String(visible)} / ${String(sourceItems.length)} 条`
          : `共 ${String(sourceItems.length)} 条`;
    };
    search.addEventListener('input', applySearch);
    let alphabetical = false;
    sort.addEventListener('click', () => {
      alphabetical = !alphabetical;
      const ordered = alphabetical
        ? [...sourceItems].sort((left, right) =>
            left.textContent.localeCompare(right.textContent, 'zh-CN'),
          )
        : sourceItems;
      list.replaceChildren(...ordered);
      sort.textContent = alphabetical ? '排序：名称' : '排序：业务顺序';
    });
    reset.addEventListener('click', () => {
      search.value = '';
      alphabetical = false;
      list.replaceChildren(...sourceItems);
      sort.textContent = '排序：业务顺序';
      applySearch();
    });
    tools.append(search, count, sort, reset);
    list.parentElement.insertBefore(tools, list);
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
  const shell = el('main', `app-shell ${viewportFor(width)}`);
  let sidebarCollapsed = false;
  try {
    sidebarCollapsed = globalThis.localStorage.getItem('kingturf.sidebar.collapsed') === 'true';
  } catch {
    sidebarCollapsed = false;
  }
  const renderSidebarState = () => {
    shell.className = `app-shell ${viewportFor(width)}${sidebarCollapsed ? ' sidebar-collapsed' : ''}`;
  };
  renderSidebarState();
  const aside = el('aside', 'sidebar');
  const brand = el('div', 'brand-lockup');
  brand.append(el('span', 'brand-mark', 'K'), el('div', 'brand', '金特夫'));
  brand.append(el('p', 'brand-caption', '企业经营管理系统'));
  const sidebarToggle = el('button', 'sidebar-toggle', sidebarCollapsed ? '展开' : '收起');
  sidebarToggle.type = 'button';
  sidebarToggle.setAttribute('aria-label', sidebarCollapsed ? '展开左侧导航' : '收起左侧导航');
  sidebarToggle.setAttribute('aria-expanded', String(!sidebarCollapsed));
  sidebarToggle.addEventListener('click', () => {
    sidebarCollapsed = !sidebarCollapsed;
    renderSidebarState();
    sidebarToggle.textContent = sidebarCollapsed ? '展开' : '收起';
    sidebarToggle.setAttribute('aria-label', sidebarCollapsed ? '展开左侧导航' : '收起左侧导航');
    sidebarToggle.setAttribute('aria-expanded', String(!sidebarCollapsed));
    try {
      globalThis.localStorage.setItem('kingturf.sidebar.collapsed', String(sidebarCollapsed));
    } catch {
      // The visible state still works when storage is unavailable.
    }
  });
  brand.append(sidebarToggle);
  aside.append(brand);
  const nav = el('nav');
  const visibleRoutes = visibleAppRoutes(allPermissions);
  const roleProfile = roleWorkspaceProfile(allPermissions);
  const currentRoute =
    typeof globalThis.location === 'undefined'
      ? 'overview'
      : appRouteFromHash(globalThis.location.hash);
  const navGroup = (title: string, items: readonly [NavIconName, string, AppRoute][]) => {
    const visibleItems = items.filter(([, , route]) => visibleRoutes.has(route));
    if (visibleItems.length === 0) return;
    const group = el('section', 'nav-group');
    group.append(el('p', 'nav-label', title));
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
      group.append(item);
    }
    nav.append(group);
  };
  navGroup('工作空间', [
    ['overview', '经营总览', 'overview'],
    ['sales', '销售工作台', 'sales-workspace'],
    ['operations', '运营工作台', 'operations-workspace'],
  ]);
  navGroup('销售到回款', [
    ['customers', '线索与客户', 'crm'],
    ['opportunities', '商机与技术需求', 'opportunity-ctr'],
    ['cost', '成本与报价', 'cost-quote'],
    ['contracts', '合同与订单', 'contract-order'],
    ['receivables', '应收与回款', 'ar-payment'],
  ]);
  navGroup('履约协同', [
    ['production', '计划与生产', 'planning-production'],
    ['quality', '质量与仓储', 'quality-warehouse'],
    ['delivery', '交付与证据', 'delivery-evidence'],
  ]);
  navGroup('平台治理', [['governance', '系统管理与治理', 'governance']]);
  aside.append(nav);
  const sidebarFooter = el('div', 'sidebar-footer');
  sidebarFooter.append(el('span', 'online-dot'), el('span', '', '生产环境 · erp.kingturf.cn'));
  aside.append(sidebarFooter);
  const content = el('section', 'workspace');
  const utility = el('header', 'utility-bar');
  const search = el('button', 'global-search');
  search.type = 'button';
  search.setAttribute('aria-label', '进入客户与业务查询');
  search.append(
    el('span', 'search-symbol', '⌕'),
    el('span', '', '搜索客户、订单或业务编号'),
    el('span', 'search-action', '进入查询'),
  );
  search.addEventListener('click', () => {
    setAppRoute('crm');
  });
  const profile = el('div', 'profile-chip');
  profile.append(
    el('span', 'profile-avatar', profileLabel.slice(0, 1)),
    el('span', '', profileLabel),
    el('span', 'profile-role', roleProfile.title),
  );
  utility.append(search, profile);
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
  title.append(el('p', 'page-subtitle', '从客户机会到订单回款，关注今天最需要推进的事项。'));
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
  const taskCopy: Readonly<Partial<Record<AppRoute, readonly [string, string]>>> = {
    'sales-workspace': ['推进销售事项', '查看重点客户、商机、报价和回款风险'],
    'operations-workspace': ['处理运营事项', '查看计划、生产、质量和交付异常'],
    crm: ['维护客户与线索', '处理客户主档、跟进记录和分配事项'],
    'opportunity-ctr': ['推进商机与技术需求', '处理商机阶段、技术需求与技术方案'],
    'cost-quote': ['处理成本与报价', '完成测算、政策判定、审批或签发'],
    'contract-order': ['处理合同与订单', '完成信用、合同、订单和证据复核'],
    'ar-payment': ['处理应收与回款', '查看到账、核销、佣金和风险任务'],
    'planning-production': ['处理计划与生产', '推进采购、物料需求、工单和制造成本'],
    'quality-warehouse': ['处理质量与库存', '完成检验、放行、批次和追溯事项'],
    'delivery-evidence': ['处理交付任务', '完成发货放行、物流和签收证据'],
    governance: ['处理系统治理', '维护身份、权限、流程和运行规则'],
  };
  for (const route of visibleRoutes) {
    if (route === 'overview') continue;
    const copy = taskCopy[route];
    if (!copy) continue;
    const task = el('button', 'role-task');
    task.type = 'button';
    task.setAttribute('data-role-task-route', route);
    task.addEventListener('click', () => {
      setAppRoute(route);
    });
    task.append(
      el('span', 'role-task-state', '可处理'),
      el('strong', '', copy[0]),
      el('small', '', copy[1]),
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
  const sectionHeader = el('div', 'section-heading');
  sectionHeader.append(el('div', '', '今日业务'), el('span', '', '数据实时来自业务台账'));
  content.append(sectionHeader);
  const split = el('section', 'split');
  if (sections.customers) {
    const list = el('article', 'panel customer-list');
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
        el('span', 'status', customer.status ?? '—'),
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
    detail.append(
      el('p', 'eyebrow', '客户全景'),
      el('h2', '', controller.selected.customer.name),
      el(
        'p',
        'customer-identity',
        `${controller.selected.customer.customerNumber ?? '编号受限'} · ${controller.selected.customer.status ?? '状态受限'} · ${controller.selected.customer.ownerId ?? '未分配或负责人受限'}`,
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
  for (const child of Array.from(content.children)) {
    if (
      !child.className.split(' ').includes('utility-bar') &&
      !child.className.split(' ').includes('route-context-header') &&
      child !== header &&
      child !== roleHome &&
      child !== metrics &&
      child !== flow
    )
      child.setAttribute('data-route-view', 'overview sales-workspace crm');
  }
  const placeholder = el(
    'p',
    'route-placeholder',
    '该模块已纳入产品导航，当前版本尚未提供可操作工作台。',
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

const GOVERNANCE_FIELD_LABELS: Readonly<Record<string, string>> = {
  code: '编码',
  name: '名称',
  displayName: '姓名',
  employeeNumber: '员工编号',
  title: '标题',
  description: '说明',
  status: '状态',
  state: '状态',
  active: '启用状态',
  version: '版本',
  email: '邮箱',
  phone: '电话',
  createdAt: '创建时间',
  updatedAt: '更新时间',
};

const governanceFieldPriority = [
  'displayName',
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
  return ENTERPRISE_STATUS_LABELS[text] ?? text;
};

const governanceTable = (items: readonly unknown[]): HTMLElement => {
  const records = items.slice(0, 5).map(recordValue);
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

export function governanceWorkspace(controller: GovernanceController): HTMLElement {
  const { permissions, views } = controller;
  const workspace = el('section', 'governance-workspace');
  workspace.setAttribute('data-route-view', 'governance');
  const header = el('header', 'governance-hero');
  header.append(
    el('p', 'eyebrow', '企业管理控制台'),
    el('h1', '', '系统管理与治理'),
    el('p', 'muted', '组织、账号、权限和平台运行配置。'),
  );
  workspace.append(header);
  const summary = el('section', 'governance-metrics');
  const visible = visibleGovernanceSurfaces(permissions);
  const failed = views.filter((view) => view.error !== undefined).length;
  for (const [label, value] of [
    ['可管理模块', String(visible.length)],
    ['业务配置项', String(views.length - failed)],
    ['待处理异常', String(failed)],
    ['已授权操作', String(permissions.size)],
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
        throw new Error(`${label}必须是 JSON 对象`);
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
  for (const surface of visible) {
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
    panel.append(heading, el('p', 'muted', surface.description));
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
    if (surface.id === 'identity-access' && permissions.has('authorization:manage')) {
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
      actions.append(role, identity, assignment, unassignment, grant);
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
          '条目值使用结构化 JSON 保存，并继承分类的公司隔离。',
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
            { name: 'value', label: '结构化值（JSON）', type: 'textarea', required: true },
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
            { name: 'value', label: '结构化值（JSON）', type: 'textarea', required: true },
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
            { name: 'ast', label: '规则表达式（JSON）', type: 'textarea', required: true },
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
            { name: 'input', label: '输入数据（JSON）', type: 'textarea', required: true },
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
            { name: 'spec', label: '流程规范（JSON）', type: 'textarea', required: true },
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
                (item) => `${textValue(item.stepKey, '待办')} · ${textValue(item.state, '')}`,
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
                label: `${textValue(item.channel, '')} · ${item.enabled === false ? '关闭' : '开启'}`,
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
            { name: 'schema', label: '对象结构（JSON）', type: 'textarea', required: true },
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
      const source = el(
        'summary',
        '',
        view?.error ? '数据读取失败' : `查看数据明细 · ${String(items.length)} 条`,
      );
      row.append(source);
      if (view?.error) row.append(el('p', 'error', view.error));
      else if (items.length === 0) row.append(el('p', 'empty', '当前范围内暂无记录'));
      else row.append(governanceTable(items));
      panel.append(row);
    }
    if (surface.managePermission && permissions.has(surface.managePermission))
      panel.append(el('p', 'permission-note', '当前账号具备编辑权限'));
    grid.append(panel);
  }
  workspace.append(grid);
  return workspace;
}

type SessionDto = Readonly<{
  employeeId: string;
  companyId: string;
  displayName: string | null;
  employeeNumber: string | null;
  permissions: readonly string[];
}>;
async function login(login: string, password: string): Promise<string> {
  const result = await json<{ token: string }>('/api/v1/auth/login', '', {
    method: 'POST',
    body: JSON.stringify({ login, password }),
  });
  return result.token;
}
function loginView(root: HTMLElement): void {
  const shell = el('main', 'login-shell');
  const story = el('section', 'login-story');
  story.append(
    el('p', 'eyebrow', '金特夫 · 企业经营管理系统'),
    el('h1', '', '让订单、生产与交付证据在一条业务链上闭环'),
    el(
      'p',
      'login-intro',
      '面向销售、财务、供应链、生产、质量与管理岗位的统一工作台。页面和操作会根据当前角色自动呈现。',
    ),
  );
  const features = el('div', 'login-feature-grid');
  for (const [number, title, detail] of [
    ['01', '业务贯通', '从客户需求到回款、生产和签收证据'],
    ['02', '权限清晰', '原子角色、字段权限和数据范围逐层生效'],
    ['03', '证据可信', '审批、版本、哈希和时间线不可变留痕'],
  ] as const) {
    const item = el('article', 'login-feature');
    item.append(el('span', '', number), el('strong', '', title), el('p', '', detail));
    features.append(item);
  }
  story.append(features);
  const form = el('form', 'login-card');
  form.append(
    el('p', 'eyebrow', 'SECURE ACCESS'),
    el('h2', '', '登录金特夫'),
    el('p', 'muted', '使用已分配的组织账号进入角色工作台。'),
  );
  const identity = el('input');
  identity.name = 'login';
  identity.placeholder = '账号';
  identity.required = true;
  const password = el('input');
  password.name = 'password';
  password.type = 'password';
  password.placeholder = '密码';
  password.required = true;
  const submit = el('button', 'primary', '登录');
  submit.type = 'submit';
  form.append(identity, password, submit);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    void login(identity.value, password.value)
      .then((token) => {
        sessionStorage.setItem('kingturf.session', token);
        void bootstrap(root);
      })
      .catch(() => {
        form.append(el('p', 'error', '登录失败'));
      });
  });
  shell.append(story, form);
  root.replaceChildren(shell);
}
export async function bootstrap(root: HTMLElement): Promise<void> {
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
  const token = sessionStorage.getItem('kingturf.session');
  if (!token) {
    loginView(root);
    return;
  }
  let session: SessionDto;
  try {
    session = await json<SessionDto>('/api/v1/auth/session', token);
  } catch {
    sessionStorage.removeItem('kingturf.session');
    loginView(root);
    return;
  }
  const permissions = new Set(
    session.permissions.filter((item): item is CrmPermission => allowed.has(item as CrmPermission)),
  );
  const controller = new CrmController(permissions, createFetchCrmApi(token));
  try {
    await controller.load();
  } catch (error) {
    controller.error = error instanceof Error ? error.message : 'CRM 加载失败';
  }
  const allPermissions = new Set(session.permissions);
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
  const commercialPermissions = new Set(session.permissions.filter(isCommercialPermission));
  if (Object.values(visibleCommercialSections(commercialPermissions)).some(Boolean)) {
    const commercialController = new CommercialController(
      createFetchCommercialApi(token),
      commercialPermissions,
    );
    commercialController.customers = controller.customers;
    commercialController.employees = controller.employees;
    try {
      await commercialController.load();
    } catch (error) {
      commercialController.message = error instanceof Error ? error.message : '商业工作台加载失败';
    }
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
  const governanceSurfaces = visibleGovernanceSurfaces(allPermissions);
  if (governanceSurfaces.length > 0) {
    const governanceController = new GovernanceController(allPermissions, token);
    await governanceController.load();
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
