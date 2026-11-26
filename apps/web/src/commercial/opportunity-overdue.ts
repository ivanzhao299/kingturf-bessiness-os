import type { Opportunity } from './types';

// 商机「成交日期已逾期」的统一口径（TD-COMX-003，2026-11-26 项目所有者裁定：已取消的商机
// 不算逾期，属行为变更）。终态 WON/LOST/CANCELLED 一律不算逾期；无预计成交日期不算逾期；
// 其余在途状态按预计成交日期早于今天判定。opportunityPipelineSummary（readiness.ts）与
// 商机列表/看板卡片共用本判定，避免两处口径分叉。
export const isOpportunityOverdue = (opportunity: Opportunity, today: string): boolean =>
  !['WON', 'LOST', 'CANCELLED'].includes(opportunity.status ?? 'OPEN') &&
  Boolean(opportunity.expectedCloseDate) &&
  String(opportunity.expectedCloseDate).slice(0, 10) < today;
