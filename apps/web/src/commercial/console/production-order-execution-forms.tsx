// U3-MFG-5（ADR-0014 分域重写）：车间执行表单抽屉。字段、提交载荷与 legacy openForm 表单
// 同形（字段、类型、日期转换）。两处有意的差别：
// 1) 幂等键由前端生成（不再让用户手填），在表单说明里给出以便追溯；
// 2) 领退料的「批次库位」只列属于工单 BOM 的批次（TD-MFG-010）；详情读不到工单 BOM 时列出
//    全部并在表单里说明可能被拒绝。
// 已迁入：工序报工 / 领退料（成品卷入库随后一步迁入）。
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
  material: {
    heading: '登记生产物料',
    section: '领料 / 退料',
    description: '领料同步写入不可变库存移动；只能领用已放行且属于工单 BOM 的批次物料。',
    submit: '确认过账',
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

// 领退料「批次库位」候选范围的说明（依据见 materialBatchesOf）。
const materialScopeNote = (state: ProductionOrderViewState): string => {
  const scope = state.execution?.material;
  if (!scope) return '';
  if (scope.basis === 'bom')
    return scope.balances.length > 0
      ? '批次库位只列出属于本工单 BOM 的库存批次。'
      : '本工单 BOM 内的物料当前没有库存批次，暂时无法领料。';
  if (scope.basis === 'no-bom') return '该成品没有已发布的 BOM，没有可领的批次；领料会被拒绝。';
  return '当前读不到本工单的 BOM（账号没有 BOM 查看权限，或工单详情尚未加载），批次库位列出全部库存批次；不属于本工单 BOM 的批次领料会被拒绝。退料请选本工单此前领出的批次。';
};

const materialFields = (state: ProductionOrderViewState): readonly FormSectionField[] => [
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
    // value 是候选序号（legacy 同式），提交时按同一份候选取物料版本 / 批次 / 库位。
    options: (state.execution?.material.balances ?? []).map((item, index) => ({
      value: String(index),
      label: `${state.ports.recordText(item, 'sku', 'sku')} · ${state.ports.recordText(item, 'lotNumber', 'lotNumber')} · ${state.ports.recordText(item, 'locationCode', 'locationCode')} · 可用 ${state.ports.recordText(item, 'quantity', 'quantity')}`,
    })),
  },
  { name: 'quantity', label: '数量', type: 'number', required: true },
  { name: 'reason', label: '领退料原因', type: 'textarea', required: true },
  { name: 'occurredAt', label: '发生时间', type: 'datetime-local', required: true },
];

export const ProductionOrderExecutionDrawer = ({ state }: FormProps) => {
  const draft = state.execution;
  const row = state.selected;
  if (!draft || !row) return null;
  const { ports } = state;
  const copy = COPY[draft.kind];
  const orderNumber = ports.recordText(row, 'orderNumber', 'order_number');
  const prefix = `kt-wo-${draft.kind}`;
  return (
    <DetailDrawer
      title={`${copy.heading} · ${orderNumber}`}
      onClose={() => {
        state.closeForm();
      }}
    >
      <Summary state={state} row={row} testId={`${prefix}-summary`} />
      {submitError(state, `${prefix}-error`)}
      {draft.kind === 'material' ? (
        <p class="console-hint" data-testid="kt-wo-material-scope">
          {materialScopeNote(state)}
        </p>
      ) : null}
      <div data-testid={`${prefix}-form`}>
        <FormSection
          title={copy.section}
          // 幂等键由系统生成：写进说明以便按它追溯服务端记录，用户无需填写。
          description={`${copy.description}本次唯一键由系统生成：${draft.idempotencyKey}。`}
          fields={draft.kind === 'report' ? reportFields(state.detail, row) : materialFields(state)}
          submitLabel={copy.submit}
          onSubmit={(values) => state.runExecution(values)}
        />
      </div>
    </DetailDrawer>
  );
};
