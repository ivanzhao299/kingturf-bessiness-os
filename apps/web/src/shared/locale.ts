export const ENTERPRISE_STATUS_LABELS: Readonly<Record<string, string>> = {
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

export function localizeEnterpriseCopy(root: HTMLElement): void {
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
