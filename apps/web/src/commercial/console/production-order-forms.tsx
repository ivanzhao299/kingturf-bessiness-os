// U3-MFG-4（ADR-0014 分域重写）：工单表单抽屉——新建工单（字段与 legacy「建立生产工单」
// 表单一致，载荷逐字节相同）与状态流转（操作理由 + 证据编号，legacy 流转表单同字段同
// 载荷，经现代化统一动作端点 PUT /:id/state）。
import { DetailDrawer, FormSection, StatusBadge, type FormSectionField } from '@kingturf/ui';
import {
  nextActionOf,
  STATUS_LABELS,
  statusTone,
  type ProductionOrderAction,
  type ProductionOrderViewState,
} from './production-order-state';

type FormProps = Readonly<{ state: ProductionOrderViewState }>;

const TARGET_STATE: Readonly<Record<ProductionOrderAction, string>> = {
  release: 'RELEASED',
  start: 'IN_PROGRESS',
  complete: 'COMPLETED',
  close: 'CLOSED',
};

const createFields = (state: ProductionOrderViewState): readonly FormSectionField[] => [
  { name: 'orderNumber', label: '工单编号', required: true },
  {
    name: 'itemVersionId',
    label: '成品版本',
    type: 'select',
    required: true,
    options: state.ports.itemVersionChoices,
  },
  {
    name: 'routingVersionId',
    label: '已发布工艺版本',
    type: 'select',
    required: true,
    options: state.ports.routingChoices,
  },
  {
    name: 'mrpProposalId',
    label: '物料需求建议编号（可选）',
    hint: '填物料需求建议的 UUID；关联后下达时该建议须已释放',
  },
  { name: 'plannedQuantity', label: '计划数量', type: 'number', required: true },
  { name: 'plannedStartAt', label: '计划开始', type: 'date', required: true },
  { name: 'plannedDueAt', label: '计划完成', type: 'date', required: true },
  { name: 'sourceReference', label: '来源唯一编号', required: true },
];

const submitError = (state: ProductionOrderViewState, testId: string) =>
  state.submitError !== '' ? (
    <p class="console-error" role="alert" data-testid={testId}>
      {state.submitError}
    </p>
  ) : null;

export const ProductionOrderCreateDrawer = ({ state }: FormProps) => (
  <DetailDrawer title="新建生产工单" onClose={state.closeForm}>
    {submitError(state, 'kt-wo-create-error')}
    <FormSection
      title="建立生产工单"
      description="工单引用已发布物料和工艺版本；保存时固定全部标准工序快照。"
      fields={createFields(state)}
      submitLabel="保存工单"
      onSubmit={(values) => state.runCreate(values)}
    />
  </DetailDrawer>
);

export const ProductionOrderTransitionDrawer = ({ state }: FormProps) => {
  const pending = state.pending;
  if (!pending) return null;
  const { ports } = state;
  const current = ports.recordText(pending.row, 'state', 'state');
  const next = nextActionOf(current);
  const label = next?.label ?? '';
  const orderNumber = ports.recordText(pending.row, 'orderNumber', 'order_number');
  const stateLabel = (value: unknown): string =>
    STATUS_LABELS[String(value)] ?? ports.businessStateLabel(value);
  return (
    <DetailDrawer title={`${label} · ${orderNumber}`} onClose={state.closeForm}>
      <div class="console-summary" data-testid="kt-wo-transition-summary">
        <p>
          <span class="console-label">工单</span>
          {orderNumber}
          <span class="console-label">产品</span>
          {`${ports.recordText(pending.row, 'sku', 'sku', '—')} · ${ports.recordText(pending.row, 'itemName', 'itemName', '')}`}
        </p>
        <p>
          <span class="console-label">当前</span>
          <StatusBadge tone={statusTone(current)}>{stateLabel(current)}</StatusBadge>
          <span class="console-label">流转后</span>
          <StatusBadge tone="success">{stateLabel(TARGET_STATE[pending.action])}</StatusBadge>
        </p>
      </div>
      {submitError(state, 'kt-wo-transition-error')}
      <FormSection
        title={label}
        description="状态决定会追加到不可变工单事件台账，并执行完整性门禁。"
        fields={[
          { name: 'reason', label: '操作理由', type: 'textarea', required: true },
          { name: 'evidenceReference', label: '证据编号', required: true },
        ]}
        submitLabel="确认执行"
        onSubmit={(values) => state.runTransition(values)}
      />
    </DetailDrawer>
  );
};
