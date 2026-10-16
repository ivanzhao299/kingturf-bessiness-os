import { textValue } from './business-format';

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

export const COMPLAINT_STATE_LABELS: Readonly<Record<string, string>> = {
  REPORTED: '待分诊',
  TRIAGED: '已分诊',
  INVESTIGATING: '调查中',
  NCR_OPEN: '不合格处理中',
  CAPA_ACTIVE: '整改中',
  VERIFIED: '整改已验证',
  CLOSED: '已关闭',
  REJECTED: '已驳回',
};

export const COMPLAINT_SEVERITY_LABELS: Readonly<Record<string, string>> = {
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

export const businessStateLabel = (value: unknown, fallback = '状态受限'): string => {
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
