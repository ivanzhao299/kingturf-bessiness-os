import {
  FinFacts,
  FinSection,
  FinTable,
  finRecord,
  finRows,
  finText,
  finWhen,
  type FinRow,
} from './fin-kit';
import { OpsTimeline } from './ops-ledger';

export type QualityView = 'plans' | 'inspections' | 'complaints' | 'lots';
type DetailProps = Readonly<{ row: FinRow; label: (value: string) => string }>;

const evidence = (value: unknown): string => {
  const data = finRecord(value);
  return (
    finText(data, 'reference', 'customerReference') ||
    (Object.keys(data).length ? JSON.stringify(data) : '—')
  );
};

export const QualityPlanDetail = ({ row }: DetailProps) => (
  <>
    <FinFacts
      items={[
        ['计划名称', finText(row, 'name')],
        ['物料', finText(row, 'sku')],
        ['版本', finText(row, 'version')],
        ['生效时间', finWhen(row, 'effectiveAt', 'effective_at')],
        ['抽样方式', finText(row, 'samplingMethod', 'sampling_method')],
        [
          '验收规则',
          finText(finRecord(row.acceptance_rule ?? row.acceptanceRule), 'description') || '—',
        ],
      ]}
    />
    <FinSection title="检验项目" testId="kt-qi-characteristics">
      <FinTable
        testId="kt-qi-characteristics-grid"
        head={['编码', '项目', '下限', '上限', '必检']}
        empty="暂无检验项目"
        rows={finRows(row.characteristics).map((item) => [
          finText(item, 'code'),
          finText(item, 'name'),
          finText(item, 'lower_limit') || '—',
          finText(item, 'upper_limit') || '—',
          item.required === true ? '是' : '否',
        ])}
      />
    </FinSection>
  </>
);

export const QualityInspectionDetail = ({ row, label }: DetailProps) => (
  <>
    <FinFacts
      items={[
        ['关联检验计划', finText(row, 'planCode', 'plan_code') || '—'],
        ['关联批次', finText(row, 'lotNumber', 'lot_number') || '—'],
        ['物料', finText(row, 'sku') || '—'],
        ['抽样数量', finText(row, 'sampleSize', 'sample_size') || '—'],
        ['状态', label(finText(row, 'state'))],
      ]}
    />
    <FinSection title="检验结果" testId="kt-qi-results">
      <FinTable
        testId="kt-qi-result-grid"
        head={['项目', '测量值', '判定', '备注']}
        empty="暂无检验结果"
        rows={finRows(row.results).map((item) => [
          finText(item, 'characteristicName', 'characteristicCode') || '—',
          finText(item, 'measured_numeric', 'measured_text') ||
            (typeof item.measured_boolean === 'boolean'
              ? item.measured_boolean
                ? '是'
                : '否'
              : '—'),
          item.passed === true ? '合格' : '不合格',
          finText(item, 'notes') || '—',
        ])}
      />
    </FinSection>
    <FinSection title="状态与处置记录" testId="kt-qi-disposition">
      <OpsTimeline
        testId="kt-qi-disposition-grid"
        empty="暂无状态记录"
        value={row.events}
        stateLabel={(value) => label(typeof value === 'string' ? value : '')}
      />
    </FinSection>
  </>
);

export const slaRemaining = (row: FinRow, now = Date.now()): string => {
  if (['CLOSED', 'REJECTED'].includes(finText(row, 'state'))) return '已结案';
  const due = Date.parse(finText(row, 'closureDueAt', 'closure_due_at'));
  if (Number.isNaN(due)) return '—';
  const minutes = Math.ceil(Math.abs(due - now) / 60000);
  return `${due < now ? '已逾期' : '剩余'} ${String(Math.floor(minutes / 60))} 小时 ${String(minutes % 60)} 分`;
};

export const ComplaintDetail = ({ row, label }: DetailProps) => (
  <>
    <FinFacts
      items={[
        ['客户', finText(row, 'customerName', 'customer_name') || '—'],
        ['问题描述', finText(row, 'description') || '—'],
        ['客户诉求', finText(row, 'customerRequest', 'customer_request') || '—'],
      ]}
    />
    <FinSection title="SLA 处理时限" testId="kt-qi-complaint-sla">
      <FinFacts
        items={[
          ['首次响应', finWhen(row, 'responseDueAt', 'response_due_at')],
          ['临时遏制', finWhen(row, 'containmentDueAt', 'containment_due_at')],
          ['根因确认', finWhen(row, 'rootCauseDueAt', 'root_cause_due_at')],
          ['关闭期限', finWhen(row, 'closureDueAt', 'closure_due_at')],
          ['关闭倒计时', slaRemaining(row)],
        ]}
      />
    </FinSection>
    <FinSection title="投诉时间线" testId="kt-qi-complaint-timeline">
      <OpsTimeline
        testId="kt-qi-complaint-events"
        empty="暂无投诉记录"
        value={row.events}
        stateLabel={(value) => label(typeof value === 'string' ? value : '')}
      />
    </FinSection>
  </>
);

const lotGroups = [
  {
    key: 'producedRolls',
    title: '来源 · 成品卷',
    text: (item: FinRow) => [
      finText(item, 'orderNumber'),
      finText(item, 'rollNumber'),
      finText(item, 'quantity'),
    ],
  },
  {
    key: 'usedByOrders',
    title: '去向 · 工单领退料',
    text: (item: FinRow) => [
      finText(item, 'orderNumber'),
      finText(item, 'transactionType'),
      finText(item, 'quantity'),
    ],
  },
  {
    key: 'movements',
    title: '库存移动',
    text: (item: FinRow) => [
      finWhen(item, 'occurred_at', 'created_at'),
      finText(item, 'movement_type'),
      finText(item, 'quantity_delta', 'quantity'),
      finText(item, 'source_type', 'reference_type'),
    ],
  },
] as const;

export const LotDetail = ({ row, label }: DetailProps) => (
  <>
    <FinFacts
      items={[
        ['批次', finText(row, 'lotNumber', 'lot_number')],
        ['物料', finText(row, 'sku')],
        ['质量状态', label(finText(row, 'qualityStatus', 'quality_status'))],
        ['处置说明', finText(row, 'reason') || '—'],
        ['处置证据', evidence(row.evidence)],
      ]}
    />
    <FinSection title="批次来源与去向" testId="kt-qi-lot-tree">
      {lotGroups.map((group) => {
        const entries = finRows(row[group.key]);
        return (
          <details key={group.key} class="fin-section" open={entries.length > 0}>
            <summary>{`${group.title}（${String(entries.length)}）`}</summary>
            {entries.length ? (
              <ul class="bom-tree">
                {entries.map((item, index) => (
                  <li key={String(index)}>{group.text(item).filter(Boolean).join(' · ')}</li>
                ))}
              </ul>
            ) : (
              <p>暂无记录</p>
            )}
          </details>
        );
      })}
    </FinSection>
    <FinSection title="批次质量记录" testId="kt-qi-lot-quality">
      <OpsTimeline
        testId="kt-qi-lot-events"
        empty="暂无质量记录"
        value={row.qualityEvents}
        stateLabel={(value) => label(typeof value === 'string' ? value : '')}
      />
    </FinSection>
  </>
);
