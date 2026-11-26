// 供应商三态的中文标签与徽章色调。供应商控制台（列表列、抽屉、筛选按钮）与登记供应商报价的
// 候选控件（TD-PROC-021）共用这一份，文案只写一处。
import type { StatusTone } from '@kingturf/ui';

// businessStateLabel 同口径的中文标签。ON_HOLD 此前没有标签，筛选按钮与状态徽章直接显示枚举原文
// （TD-WF-014③）；它与「已停用」是两个状态（INACTIVE 才是停用），所以译作「暂停」。
export const SUPPLIER_STATUS_LABELS: Readonly<Record<string, string>> = {
  ACTIVE: '已启用',
  ON_HOLD: '暂停',
  INACTIVE: '已停用',
};

export const supplierStatusTone = (status: unknown): StatusTone => {
  if (status === 'ACTIVE') return 'success';
  if (status === 'INACTIVE') return 'danger';
  if (status === 'ON_HOLD') return 'warning';
  return 'neutral';
};
