// U3-MFG-5（ADR-0014 分域重写）：车间执行表单抽屉。字段、提交载荷与 legacy openForm 表单
// 同形（字段、类型、日期转换）。一处有意的差别：幂等键由前端生成（不再让用户手填），在
// 表单说明里给出以便追溯。
// 已迁入：工序报工（领退料 / 成品卷入库随后两步迁入）。
import { DetailDrawer, FormSection, StatusBadge, type FormSectionField } from '@kingturf/ui';
import {
  formatQuantity,
  idOf,
  progressOf,
  quantityOf,
  records,
  statusTone,
  textOf,
  STATUS_LABELS,
  type ProductionOrderViewState,
} from './production-order-state';
import type { ProductionOrderRow } from './production-order-ports';

type FormProps = Readonly<{ state: ProductionOrderViewState }>;

// legacy 表单的标题 / 说明 / 提交按钮文案（逐字沿用）。
const COPY = {
  report: {
    heading: '登记工序报工',
    section: '工序报工',
    description: '每次报工使用唯一幂等键；累计良品不能超过工单计划数量。',
    submit: '提交报工',
  },
} as const;

const submitError = (state: ProductionOrderViewState, testId: string) =>
  state.submitError !== '' ? (
    <p class="console-error" role="alert" data-testid={testId}>
      {state.submitError}
    </p>
  ) : null;

// 抽屉顶部的工单概要：报工要看计划数量与成品。
const Summary = ({
  state,
  row,
  testId,
}: Readonly<{ state: ProductionOrderViewState; row: ProductionOrderRow; testId: string }>) => {
  const { ports } = state;
  const text = (camel: string, snake = camel): string => ports.recordText(row, camel, snake, '—');
  const status = ports.recordText(row, 'state', 'state');
  return (
    <div class="console-summary" data-testid={testId}>
      <p>
        <StatusBadge tone={statusTone(status)}>
          {STATUS_LABELS[status] ?? ports.businessStateLabel(status)}
        </StatusBadge>
        <span class="console-label">产品</span>
        {`${text('sku')} · ${ports.recordText(row, 'itemName', 'itemName', '')}`}
      </p>
      <p>
        <span class="console-label">计划数量</span>
        {formatQuantity(progressOf(row).planned)}
      </p>
    </div>
  );
};

// 报工可选的工序：详情聚合（含各工序累计良品）优先；详情未到达时按列表行就地推算（与
// 详情抽屉同一算法）。value 是工序 id（载荷 operationId）；label 在 legacy 的
// `工序号 · 名称` 之后附上已报良品，避免累计超过计划数量。
const reportableOf = (
  detail: ProductionOrderRow | null,
  row: ProductionOrderRow,
): readonly Readonly<{
  id: string;
  sequence: number;
  name: string;
  good: number;
  planned: number;
}>[] => {
  const server = records(detail?.operationProgress);
  if (server.length > 0)
    return server
      .map((item) => ({
        id: idOf(item.id),
        sequence: quantityOf(item.sequence),
        name: textOf(item.operationName),
        good: quantityOf(item.reportedGoodQuantity),
        planned: quantityOf(item.plannedQuantity),
      }))
      .sort((left, right) => left.sequence - right.sequence);
  return progressOf(row).operations.map((item) => ({
    id: item.id,
    sequence: item.sequence,
    name: item.name,
    good: item.good,
    planned: quantityOf(row.planned_quantity),
  }));
};

const reportFields = (
  detail: ProductionOrderRow | null,
  row: ProductionOrderRow,
): readonly FormSectionField[] => [
  {
    name: 'operationId',
    label: '工序',
    type: 'select',
    required: true,
    options: reportableOf(detail, row).map((step) => ({
      value: step.id,
      label: `${String(step.sequence)} · ${step.name} · 已报良品 ${formatQuantity(step.good)} / 计划 ${formatQuantity(step.planned)}`,
    })),
  },
  {
    name: 'goodQuantity',
    label: '良品数量',
    type: 'number',
    required: true,
    hint: '可填小数；与该工序此前报工的良品累计，不能超过计划数量',
  },
  { name: 'scrapQuantity', label: '废品数量', type: 'number', required: true, value: '0' },
  { name: 'laborMinutes', label: '人工分钟', type: 'number', required: true },
  { name: 'machineMinutes', label: '设备分钟', type: 'number', required: true },
  { name: 'startedAt', label: '开始时间', type: 'datetime-local', required: true },
  { name: 'completedAt', label: '完成时间', type: 'datetime-local', required: true },
  // legacy 表单没有标必填，但解析链要求非空（留空提交得到 notes is required）；这里如实标必填。
  { name: 'notes', label: '班组记录', type: 'textarea', required: true },
];

export const ProductionOrderExecutionDrawer = ({ state }: FormProps) => {
  const draft = state.execution;
  const row = state.selected;
  if (!draft || !row) return null;
  const { ports } = state;
  const copy = COPY[draft.kind];
  const orderNumber = ports.recordText(row, 'orderNumber', 'order_number');
  return (
    <DetailDrawer
      title={`${copy.heading} · ${orderNumber}`}
      onClose={() => {
        state.closeForm();
      }}
    >
      <Summary state={state} row={row} testId="kt-wo-report-summary" />
      {submitError(state, 'kt-wo-report-error')}
      <div data-testid="kt-wo-report-form">
        <FormSection
          title={copy.section}
          // 幂等键由系统生成：写进说明以便按它追溯服务端记录，用户无需填写。
          description={`${copy.description}本次唯一键由系统生成：${draft.idempotencyKey}。`}
          fields={reportFields(state.detail, row)}
          submitLabel={copy.submit}
          onSubmit={(values) => state.runExecution(values)}
        />
      </div>
    </DetailDrawer>
  );
};
