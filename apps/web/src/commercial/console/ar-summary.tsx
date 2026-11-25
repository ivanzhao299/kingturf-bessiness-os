// FIN-1：应收控制台的汇总卡（@kingturf/ui SummaryCards）。数字与口径都来自服务端的按币种聚合
// （GET /api/v1/ar-open-items?summary=1）——不在前端相加，币种之间不相加。
// 读不到汇总时显示「—」，不显示 0。
import { SummaryCards, type SummaryCardItem } from '@kingturf/ui';
import { finMoneyText, finText, type FinRow } from './fin-kit';
import type { ArFilter } from './ar-state';

const count = (row: FinRow, key: string): string => `${finText(row, key)} 笔`;

export const ArSummaryCards = (
  props: Readonly<{
    summary: readonly FinRow[] | null;
    filter: ArFilter;
    onSelectOverdue: () => void;
  }>,
) => {
  let items: readonly SummaryCardItem[];
  if (props.summary === null) {
    // 尚未读到或读取失败：口径照写，数字是「—」。
    items = [
      { id: 'outstanding', label: '未核销余额', value: '—', hint: '按币种汇总暂不可用' },
      { id: 'overdue', label: '已逾期', value: '—', hint: '按币种汇总暂不可用' },
      { id: 'due7', label: '7 天内到期', value: '—', hint: '按币种汇总暂不可用' },
      { id: 'due30', label: '30 天内到期', value: '—', hint: '按币种汇总暂不可用' },
    ];
  } else if (props.summary.length === 0) {
    items = [{ id: 'outstanding', label: '未核销余额', value: '—', hint: '暂无应收单据' }];
  } else {
    items = props.summary.flatMap((row): readonly SummaryCardItem[] => {
      const currency = finText(row, 'currency');
      const overdue = Number(finText(row, 'overdueCount')) > 0;
      const due7 = Number(finText(row, 'due7Count')) > 0;
      return [
        {
          id: `outstanding-${currency}`,
          label: '未核销余额',
          value: finMoneyText(row.currency, row.outstandingAmount),
          hint: `${currency} · 未结清 ${count(row, 'openCount')}的余额合计`,
        },
        {
          id: `overdue-${currency}`,
          label: '已逾期',
          value: finMoneyText(row.currency, row.overdueAmount),
          hint: `${currency} · 到期未结清 ${count(row, 'overdueCount')}`,
          tone: overdue ? 'danger' : undefined,
          onSelect: props.onSelectOverdue,
          active: props.filter === 'OVERDUE',
        },
        {
          id: `due7-${currency}`,
          label: '7 天内到期',
          value: finMoneyText(row.currency, row.due7Amount),
          hint: `${currency} · 未逾期且 7 天内到期 ${count(row, 'due7Count')}`,
          tone: due7 ? 'warning' : undefined,
        },
        {
          id: `due30-${currency}`,
          label: '30 天内到期',
          value: finMoneyText(row.currency, row.due30Amount),
          hint: `${currency} · 未逾期且 30 天内到期 ${count(row, 'due30Count')}（含 7 天内）`,
        },
      ];
    });
  }
  return <SummaryCards label="应收汇总" testId="kt-ar-summary" items={items} />;
};
