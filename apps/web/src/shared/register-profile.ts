export type RegisterProfile = {
  label: string;
  headers: readonly [string, string, string, string];
  detailLabels: readonly string[];
};

export const registerProfile = (list: HTMLElement): RegisterProfile => {
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
